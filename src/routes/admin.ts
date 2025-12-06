import { Router, type Request, type Response } from 'express';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { config } from '../config.js';
import { whatsappClient } from '../whatsapp/client.js';
import {
  getAllOnboardedUsers,
  computeDailySummary,
  formatDailySummaryMessage,
  saveDailySummary,
} from '../logic/summaries.js';
import { prisma } from '../db.js';
import { normalizePhoneNumber } from '../logic/contacts.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export const adminRouter = Router();

// Simple API key auth middleware for admin routes
function requireAdminAuth(req: Request, res: Response, next: () => void): void {
  const apiKey = req.headers['x-api-key'];

  if (config.admin.apiKey && apiKey !== config.admin.apiKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

adminRouter.use(requireAdminAuth);

// Endpoint to trigger daily summaries for all users
adminRouter.post('/run-daily-summaries', async (req: Request, res: Response) => {
  try {
    const targetDate = req.body.date
      ? dayjs(req.body.date).toDate()
      : dayjs().subtract(1, 'day').toDate(); // Default to yesterday

    console.log(`Running daily summaries for date: ${dayjs(targetDate).format('YYYY-MM-DD')}`);

    const users = await getAllOnboardedUsers();
    const results: Array<{
      userId: number;
      phoneNumber: string;
      status: 'sent' | 'skipped' | 'error';
      message?: string;
    }> = [];

    for (const user of users) {
      try {
        // Compute summary in user's timezone
        const userDate = dayjs(targetDate).tz(user.timezone).toDate();
        const summary = await computeDailySummary(user.id, userDate);

        if (!summary) {
          results.push({
            userId: user.id,
            phoneNumber: user.phoneNumber,
            status: 'skipped',
            message: 'No expenses for this date',
          });
          continue;
        }

        // Format and send the summary message
        const messageText = formatDailySummaryMessage(summary, user.name ?? undefined);
        await whatsappClient.sendTextMessage(user.phoneNumber, messageText);

        // Save the computed summary
        await saveDailySummary(user.id, summary);

        results.push({
          userId: user.id,
          phoneNumber: user.phoneNumber,
          status: 'sent',
        });
      } catch (error) {
        console.error(`Error sending summary to user ${user.id}:`, error);
        results.push({
          userId: user.id,
          phoneNumber: user.phoneNumber,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const sent = results.filter((r) => r.status === 'sent').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const errors = results.filter((r) => r.status === 'error').length;

    res.json({
      success: true,
      date: dayjs(targetDate).format('YYYY-MM-DD'),
      summary: {
        total: users.length,
        sent,
        skipped,
        errors,
      },
      results,
    });
  } catch (error) {
    console.error('Error running daily summaries:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Endpoint to send a summary to a specific user
adminRouter.post('/send-summary/:phoneNumber', async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.params;
    const targetDate = req.body.date
      ? dayjs(req.body.date).toDate()
      : dayjs().subtract(1, 'day').toDate();

    const users = await getAllOnboardedUsers();
    const user = users.find((u) => u.phoneNumber === phoneNumber || u.phoneNumber.endsWith(phoneNumber));

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userDate = dayjs(targetDate).tz(user.timezone).toDate();
    const summary = await computeDailySummary(user.id, userDate);

    if (!summary) {
      res.json({
        success: true,
        message: 'No expenses for this date',
      });
      return;
    }

    const messageText = formatDailySummaryMessage(summary, user.name ?? undefined);
    await whatsappClient.sendTextMessage(user.phoneNumber, messageText);
    await saveDailySummary(user.id, summary);

    res.json({
      success: true,
      summary,
      messageSent: true,
    });
  } catch (error) {
    console.error('Error sending summary:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Endpoint to get user stats
adminRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const users = await getAllOnboardedUsers();

    res.json({
      success: true,
      stats: {
        totalOnboardedUsers: users.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Endpoint to delete a user and all their data
adminRouter.delete('/user/:phoneNumber', async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.params;
    const normalized = normalizePhoneNumber(phoneNumber);

    const user = await prisma.user.findUnique({
      where: { phoneNumber: normalized },
      include: {
        expenses: { select: { id: true } },
        contacts: { select: { id: true } },
        messageLogs: { select: { id: true } },
        dailySummaries: { select: { id: true } },
        billSplits: { select: { id: true } },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found', phoneNumber: normalized });
      return;
    }

    // Delete user (cascades to all related data due to Prisma schema)
    await prisma.user.delete({
      where: { id: user.id },
    });

    res.json({
      success: true,
      deleted: {
        userId: user.id,
        phoneNumber: user.phoneNumber,
        name: user.name,
        expensesCount: user.expenses.length,
        contactsCount: user.contacts.length,
        messageLogsCount: user.messageLogs.length,
        dailySummariesCount: user.dailySummaries.length,
        billSplitsCount: user.billSplits.length,
      },
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Endpoint to list all users
adminRouter.get('/users', async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        phoneNumber: true,
        name: true,
        onboarded: true,
        createdAt: true,
        _count: {
          select: {
            expenses: true,
            contacts: true,
            messageLogs: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
