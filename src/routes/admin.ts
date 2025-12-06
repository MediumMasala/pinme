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

// Comprehensive dashboard endpoint
adminRouter.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const today = dayjs().startOf('day').toDate();
    const last24h = dayjs().subtract(24, 'hours').toDate();
    const last7d = dayjs().subtract(7, 'days').toDate();
    const last30d = dayjs().subtract(30, 'days').toDate();

    // User stats
    const totalUsers = await prisma.user.count();
    const onboardedUsers = await prisma.user.count({ where: { onboarded: true } });
    const usersLast24h = await prisma.user.count({ where: { createdAt: { gte: last24h } } });
    const usersLast7d = await prisma.user.count({ where: { createdAt: { gte: last7d } } });

    // Active users (users who sent messages)
    const activeUsersLast24h = await prisma.messageLog.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: last24h },
        direction: 'INBOUND',
        userId: { not: null },
      },
    });

    const activeUsersLast7d = await prisma.messageLog.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: last7d },
        direction: 'INBOUND',
        userId: { not: null },
      },
    });

    // Message stats
    const totalMessages = await prisma.messageLog.count();
    const inboundMessages = await prisma.messageLog.count({ where: { direction: 'INBOUND' } });
    const outboundMessages = await prisma.messageLog.count({ where: { direction: 'OUTBOUND' } });
    const messagesToday = await prisma.messageLog.count({ where: { createdAt: { gte: today } } });
    const messagesLast24h = await prisma.messageLog.count({ where: { createdAt: { gte: last24h } } });

    // Expense stats
    const totalExpenses = await prisma.expense.count();
    const expensesToday = await prisma.expense.count({ where: { createdAt: { gte: today } } });
    const expensesLast7d = await prisma.expense.count({ where: { createdAt: { gte: last7d } } });
    const expensesLast30d = await prisma.expense.count({ where: { createdAt: { gte: last30d } } });

    const totalExpenseAmount = await prisma.expense.aggregate({
      _sum: { amount: true },
    });

    const reimbursableExpenses = await prisma.expense.count({ where: { isReimbursement: true } });

    // Expenses by category
    const expensesByCategory = await prisma.expense.groupBy({
      by: ['category'],
      _count: { id: true },
      _sum: { amount: true },
      orderBy: { _count: { id: 'desc' } },
    });

    // Recent users with details
    const recentUsers = await prisma.user.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        phoneNumber: true,
        name: true,
        onboarded: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            expenses: true,
            messageLogs: true,
            contacts: true,
          },
        },
      },
    });

    // Recent conversations (last 50 inbound messages)
    const recentConversations = await prisma.messageLog.findMany({
      take: 50,
      where: { direction: 'INBOUND' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        createdAt: true,
        payload: true,
        user: {
          select: {
            phoneNumber: true,
            name: true,
          },
        },
      },
    });

    // Format conversations to show message text
    const formattedConversations = recentConversations.map((msg) => {
      const payload = msg.payload as Record<string, unknown>;
      const normalized = payload?.normalized as Record<string, unknown> | undefined;
      return {
        id: msg.id,
        userId: msg.userId,
        phoneNumber: msg.user?.phoneNumber ?? 'Unknown',
        userName: msg.user?.name ?? 'Unknown',
        messageText: normalized?.messageText ?? '[Media/Unknown]',
        timestamp: msg.createdAt,
      };
    });

    // Recent expenses
    const recentExpenses = await prisma.expense.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        currency: true,
        category: true,
        description: true,
        isReimbursement: true,
        createdAt: true,
        user: {
          select: {
            phoneNumber: true,
            name: true,
          },
        },
      },
    });

    res.json({
      success: true,
      generatedAt: now.toISOString(),
      overview: {
        users: {
          total: totalUsers,
          onboarded: onboardedUsers,
          newLast24h: usersLast24h,
          newLast7d: usersLast7d,
          activeLast24h: activeUsersLast24h.length,
          activeLast7d: activeUsersLast7d.length,
        },
        messages: {
          total: totalMessages,
          inbound: inboundMessages,
          outbound: outboundMessages,
          today: messagesToday,
          last24h: messagesLast24h,
        },
        expenses: {
          total: totalExpenses,
          today: expensesToday,
          last7d: expensesLast7d,
          last30d: expensesLast30d,
          totalAmount: totalExpenseAmount._sum.amount?.toString() ?? '0',
          reimbursable: reimbursableExpenses,
        },
      },
      expensesByCategory: expensesByCategory.map((c) => ({
        category: c.category,
        count: c._count.id,
        totalAmount: c._sum.amount?.toString() ?? '0',
      })),
      recentUsers,
      recentConversations: formattedConversations,
      recentExpenses: recentExpenses.map((e) => ({
        id: e.id,
        amount: e.amount.toString(),
        currency: e.currency,
        category: e.category,
        description: e.description,
        isReimbursement: e.isReimbursement,
        userName: e.user.name ?? 'Unknown',
        phoneNumber: e.user.phoneNumber,
        createdAt: e.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error generating dashboard:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Alias for dashboard - /admin/overview
adminRouter.get('/overview', (_req: Request, res: Response) => {
  res.redirect('/admin/dashboard');
});

// Get detailed user info with all their data
adminRouter.get('/user/:phoneNumber', async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.params;
    const normalized = normalizePhoneNumber(phoneNumber);

    const user = await prisma.user.findUnique({
      where: { phoneNumber: normalized },
      include: {
        expenses: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        contacts: true,
        messageLogs: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
        dailySummaries: {
          orderBy: { date: 'desc' },
          take: 30,
        },
        billSplits: {
          include: {
            participants: {
              include: { contact: true },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found', phoneNumber: normalized });
      return;
    }

    // Format message logs to show readable text
    const formattedMessages = user.messageLogs.map((msg) => {
      const payload = msg.payload as Record<string, unknown>;
      const normalized = payload?.normalized as Record<string, unknown> | undefined;
      return {
        id: msg.id,
        direction: msg.direction,
        messageText: msg.direction === 'INBOUND'
          ? (normalized?.messageText ?? '[Media/Unknown]')
          : ((payload as Record<string, unknown>)?.text as Record<string, unknown>)?.body ?? '[Template/Unknown]',
        timestamp: msg.createdAt,
      };
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        name: user.name,
        onboarded: user.onboarded,
        timezone: user.timezone,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      stats: {
        totalExpenses: user.expenses.length,
        totalContacts: user.contacts.length,
        totalMessages: user.messageLogs.length,
        totalSummaries: user.dailySummaries.length,
        totalSplits: user.billSplits.length,
      },
      expenses: user.expenses.map((e) => ({
        id: e.id,
        amount: e.amount.toString(),
        currency: e.currency,
        category: e.category,
        description: e.description,
        isReimbursement: e.isReimbursement,
        createdAt: e.createdAt,
      })),
      contacts: user.contacts,
      messages: formattedMessages,
      billSplits: user.billSplits,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
