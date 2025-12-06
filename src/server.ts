import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { prisma, disconnectDb } from './db.js';
import { whatsappWebhookRouter } from './routes/whatsappWebhook.js';
import { adminRouter } from './routes/admin.js';
import { initializeScheduler } from './scheduler/dailyMessages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'pinme',
  });
});

// Routes
app.use('/whatsapp/webhook', whatsappWebhookRouter);
app.use('/admin', adminRouter);

// Serve admin dashboard static files
const adminDashboardPath = path.join(__dirname, '..', 'public', 'admin');
app.use('/admin-ui', express.static(adminDashboardPath));

// SPA fallback for admin dashboard
app.get('/admin-ui/*', (_req: Request, res: Response) => {
  res.sendFile(path.join(adminDashboardPath, 'index.html'));
});

// Redirect root to admin dashboard
app.get('/', (_req: Request, res: Response) => {
  res.redirect('/admin-ui');
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : undefined,
  });
});

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  await disconnectDb();
  console.log('Database disconnected');

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
async function main(): Promise<void> {
  // Verify database connection
  try {
    await prisma.$connect();
    console.log('Database connected');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🪙 PinMe - WhatsApp Expense Tracker                     ║
║                                                           ║
║   Server running on port ${config.port.toString().padEnd(29)}║
║   Environment: ${config.nodeEnv.padEnd(37)}║
║                                                           ║
║   Endpoints:                                              ║
║   • GET  /health              - Health check              ║
║   • GET  /admin-ui            - Admin Dashboard           ║
║   • GET  /admin/dashboard     - Dashboard API             ║
║   • GET  /whatsapp/webhook    - Webhook verification      ║
║   • POST /whatsapp/webhook    - Receive messages          ║
║                                                           ║
║   Scheduled Jobs:                                         ║
║   • 11:30 AM IST - Morning reminder                       ║
║   • 11:30 PM IST - Daily expense summary                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);

    // Initialize scheduled jobs
    initializeScheduler();
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
