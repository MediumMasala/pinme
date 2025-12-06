import { createTool } from '@mastra/core';
import { z } from 'zod';
import { prisma } from '../../db.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export const getSummaryTool = createTool({
  id: 'getSummary',
  description: 'Get expense summary for a user for a specific time period (today, week, month)',
  inputSchema: z.object({
    userId: z.number().describe('The user ID to get summary for'),
    period: z.enum(['today', 'week', 'month']).describe('Time period for summary'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    period: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    total: z.number(),
    reimbursableTotal: z.number(),
    personalTotal: z.number(),
    byCategory: z.array(z.object({
      category: z.string(),
      count: z.number(),
      total: z.number(),
    })),
    reimbursableExpenses: z.array(z.object({
      id: z.number(),
      description: z.string(),
      amount: z.number(),
      category: z.string(),
      createdAt: z.string(),
    })),
  }),
  execute: async ({ context }) => {
    const { userId, period } = context;

    const tz = 'Asia/Kolkata';
    const now = dayjs().tz(tz);

    let startDate: dayjs.Dayjs;
    let endDate = now.endOf('day');

    switch (period) {
      case 'today':
        startDate = now.startOf('day');
        break;
      case 'week':
        startDate = now.startOf('week');
        break;
      case 'month':
        startDate = now.startOf('month');
        break;
      default:
        startDate = now.startOf('day');
    }

    // Get all expenses in the period
    const expenses = await prisma.expense.findMany({
      where: {
        userId,
        expenseDatetime: {
          gte: startDate.toDate(),
          lte: endDate.toDate(),
        },
      },
      orderBy: { expenseDatetime: 'desc' },
    });

    // Calculate totals
    let total = 0;
    let reimbursableTotal = 0;
    let personalTotal = 0;
    const categoryMap: Record<string, { count: number; total: number }> = {};

    const reimbursableExpenses: Array<{
      id: number;
      description: string;
      amount: number;
      category: string;
      createdAt: string;
    }> = [];

    for (const expense of expenses) {
      const amount = Number(expense.amount);
      total += amount;

      if (expense.isReimbursement) {
        reimbursableTotal += amount;
        reimbursableExpenses.push({
          id: expense.id,
          description: expense.description,
          amount,
          category: expense.category,
          createdAt: expense.createdAt.toISOString(),
        });
      } else {
        personalTotal += amount;
      }

      if (!categoryMap[expense.category]) {
        categoryMap[expense.category] = { count: 0, total: 0 };
      }
      categoryMap[expense.category].count += 1;
      categoryMap[expense.category].total += amount;
    }

    const byCategory = Object.entries(categoryMap).map(([category, data]) => ({
      category,
      count: data.count,
      total: data.total,
    }));

    return {
      success: true,
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      total,
      reimbursableTotal,
      personalTotal,
      byCategory,
      reimbursableExpenses,
    };
  },
});
