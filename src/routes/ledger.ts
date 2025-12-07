// src/routes/ledger.ts
// LEDGER MODULE - Routes for user ledger authentication and data
import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { createOtpForPhone, verifyOtp } from '../auth/otp.js';
import { normalizePhoneNumber } from '../logic/contacts.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export const ledgerRouter = Router();

// Helper to get ideas for a user
async function getIdeasForUser(userId: number) {
  const ideas = await prisma.ideaItem.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const totalCount = await prisma.ideaItem.count({
    where: { userId },
  });

  return {
    total: totalCount,
    items: ideas.map((idea) => ({
      id: idea.id,
      content: idea.content,
      sourceUrl: idea.sourceUrl,
      tags: idea.tags,
      createdAt: idea.createdAt.toISOString(),
    })),
  };
}

// Helper to get reminders for a user
async function getRemindersForUser(userId: number) {
  const reminders = await prisma.reminder.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const totalCount = await prisma.reminder.count({
    where: { userId },
  });

  const now = new Date();

  return {
    total: totalCount,
    items: reminders.map((r) => {
      // Determine status
      let status: 'CANCELLED' | 'SENT' | 'UPCOMING' | 'OVERDUE';
      if (r.cancelledAt) {
        status = 'CANCELLED';
      } else if (r.sentAt) {
        status = 'SENT';
      } else if (r.remindAt > now) {
        status = 'UPCOMING';
      } else {
        status = 'OVERDUE';
      }

      return {
        id: r.id,
        text: r.text,
        remindAt: r.remindAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
        sentAt: r.sentAt ? r.sentAt.toISOString() : null,
        cancelledAt: r.cancelledAt ? r.cancelledAt.toISOString() : null,
        status,
      };
    }),
  };
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      ledgerUser?: {
        id: number;
        phoneNumber: string;
        name: string | null;
      };
    }
  }
}

// ============================================
// MIDDLEWARE: requireLedgerAuth
// ============================================
export async function requireLedgerAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies?.pinme_ledger_session;

    if (!token) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Verify JWT
    const decoded = jwt.verify(token, config.ledger.jwtSecret) as {
      userId: number;
      phoneNumber: string;
    };

    // Look up user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, phoneNumber: true, name: true },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.ledgerUser = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// ============================================
// POST /ledger/request-otp
// ============================================
ledgerRouter.post('/request-otp', async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // Check if user exists and is onboarded
    const user = await prisma.user.findUnique({
      where: { phoneNumber: normalizedPhone },
      select: { id: true, onboarded: true },
    });

    if (!user || !user.onboarded) {
      res.status(400).json({
        error: 'Number not active on PinMe. Please start a chat on WhatsApp first.',
      });
      return;
    }

    // Create and send OTP
    await createOtpForPhone(normalizedPhone);

    res.json({ success: true });
  } catch (error) {
    console.error('Request OTP error:', error);
    res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
});

// ============================================
// POST /ledger/verify-otp
// ============================================
ledgerRouter.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { phoneNumber, code } = req.body;

    if (!phoneNumber || !code) {
      res.status(400).json({ error: 'Phone number and code are required' });
      return;
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // Verify OTP
    const user = await verifyOtp(normalizedPhone, code);

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired code.' });
      return;
    }

    // Create JWT
    const token = jwt.sign(
      { userId: user.id, phoneNumber: user.phoneNumber },
      config.ledger.jwtSecret,
      { expiresIn: `${config.ledger.jwtExpiryDays}d` }
    );

    // Set HttpOnly cookie
    res.cookie('pinme_ledger_session', token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: config.ledger.jwtExpiryDays * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// ============================================
// POST /ledger/logout
// ============================================
ledgerRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('pinme_ledger_session');
  res.json({ success: true });
});

// ============================================
// GET /ledger/data
// ============================================
ledgerRouter.get('/data', requireLedgerAuth, async (req: Request, res: Response) => {
  try {
    const user = req.ledgerUser!;
    const tz = 'Asia/Kolkata';

    // Get all expenses for the user
    const expenses = await prisma.expense.findMany({
      where: { userId: user.id },
      orderBy: { expenseDatetime: 'desc' },
      take: 100, // Limit to recent 100
    });

    // Calculate summary
    let totalAmount = 0;
    let firstExpenseDate: Date | null = null;
    const categoryMap: Record<string, { totalAmount: number; count: number }> = {};
    const dayMap: Record<string, { totalAmount: number; count: number }> = {};

    for (const expense of expenses) {
      const amount = Number(expense.amount);
      totalAmount += amount;

      // Track first expense date
      if (!firstExpenseDate || expense.expenseDatetime < firstExpenseDate) {
        firstExpenseDate = expense.expenseDatetime;
      }

      // Category breakdown
      if (!categoryMap[expense.category]) {
        categoryMap[expense.category] = { totalAmount: 0, count: 0 };
      }
      categoryMap[expense.category].totalAmount += amount;
      categoryMap[expense.category].count += 1;

      // Day breakdown (IST)
      const dayKey = dayjs(expense.expenseDatetime).tz(tz).format('YYYY-MM-DD');
      if (!dayMap[dayKey]) {
        dayMap[dayKey] = { totalAmount: 0, count: 0 };
      }
      dayMap[dayKey].totalAmount += amount;
      dayMap[dayKey].count += 1;
    }

    // Format response
    const response = {
      user: {
        name: user.name,
        phoneNumber: user.phoneNumber,
      },
      summary: {
        totalAmount,
        currency: 'INR',
        since: firstExpenseDate?.toISOString() || null,
        expenseCount: expenses.length,
      },
      byCategory: Object.entries(categoryMap).map(([category, data]) => ({
        category,
        totalAmount: data.totalAmount,
        count: data.count,
      })),
      byDay: Object.entries(dayMap)
        .map(([date, data]) => ({
          date,
          totalAmount: data.totalAmount,
          count: data.count,
        }))
        .sort((a, b) => b.date.localeCompare(a.date)) // Most recent first
        .slice(0, 30), // Last 30 days
      transactions: expenses.slice(0, 50).map((e) => ({
        id: e.id,
        amount: Number(e.amount),
        currency: e.currency,
        category: e.category,
        description: e.description,
        isReimbursement: e.isReimbursement,
        createdAt: e.createdAt.toISOString(),
        expenseDatetime: e.expenseDatetime.toISOString(),
      })),
      // Ideas shared with PinMe
      ideas: await getIdeasForUser(user.id),
      // Reminders
      reminders: await getRemindersForUser(user.id),
    };

    res.json(response);
  } catch (error) {
    console.error('Get ledger data error:', error);
    res.status(500).json({ error: 'Failed to fetch ledger data' });
  }
});

// ============================================
// GET /ledger/check-auth
// ============================================
ledgerRouter.get('/check-auth', requireLedgerAuth, (req: Request, res: Response) => {
  res.json({
    authenticated: true,
    user: {
      name: req.ledgerUser?.name,
      phoneNumber: req.ledgerUser?.phoneNumber,
    },
  });
});
