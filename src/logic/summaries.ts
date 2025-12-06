import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../db.js';
import type { DailySummaryData, CategoryBreakdown } from '../types/index.js';
import { config } from '../config.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export async function computeDailySummary(userId: number, date: Date): Promise<DailySummaryData | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) return null;

  const userTimezone = user.timezone || config.business.defaultTimezone;
  const targetDate = dayjs(date).tz(userTimezone);
  const startOfDay = targetDate.startOf('day').toDate();
  const endOfDay = targetDate.endOf('day').toDate();

  const expenses = await prisma.expense.findMany({
    where: {
      userId,
      expenseDatetime: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    orderBy: { expenseDatetime: 'asc' },
  });

  if (expenses.length === 0) return null;

  const categoryTotals = new Map<string, { total: Decimal; count: number }>();
  let totalAmount = new Decimal(0);
  let reimbursementTotal = new Decimal(0);
  const reimbursements: Array<{ description: string; amount: number }> = [];

  for (const expense of expenses) {
    totalAmount = totalAmount.add(expense.amount);

    const existing = categoryTotals.get(expense.category) || { total: new Decimal(0), count: 0 };
    categoryTotals.set(expense.category, {
      total: existing.total.add(expense.amount),
      count: existing.count + 1,
    });

    if (expense.isReimbursement) {
      reimbursementTotal = reimbursementTotal.add(expense.amount);
      reimbursements.push({
        description: expense.description,
        amount: expense.amount.toNumber(),
      });
    }
  }

  const categoryBreakdowns: CategoryBreakdown[] = [];
  for (const [category, data] of categoryTotals) {
    categoryBreakdowns.push({
      category,
      total: data.total.toNumber(),
      count: data.count,
    });
  }

  categoryBreakdowns.sort((a, b) => b.total - a.total);

  return {
    date: targetDate.format('YYYY-MM-DD'),
    totalAmount: totalAmount.toNumber(),
    categoryBreakdowns,
    reimbursementTotal: reimbursementTotal.toNumber(),
    reimbursements,
  };
}

export function formatDailySummaryMessage(summary: DailySummaryData, _userName?: string): string {
  const lines: string[] = [];

  lines.push(`Your PinMe summary for ${summary.date}`);
  lines.push(`Total spent: ₹${summary.totalAmount.toLocaleString('en-IN')}`);
  lines.push('');

  for (const breakdown of summary.categoryBreakdowns) {
    const categoryName = formatCategoryName(breakdown.category);
    lines.push(`${categoryName}: ₹${breakdown.total.toLocaleString('en-IN')} (${breakdown.count} item${breakdown.count > 1 ? 's' : ''})`);
  }

  if (summary.reimbursementTotal > 0) {
    lines.push('');
    lines.push(`Reimbursements to claim: ₹${summary.reimbursementTotal.toLocaleString('en-IN')}`);
    for (const r of summary.reimbursements) {
      lines.push(`• ${r.description} ₹${r.amount.toLocaleString('en-IN')}`);
    }
  }

  lines.push('');
  lines.push('Good night!');

  return lines.join('\n');
}

export async function saveDailySummary(userId: number, summary: DailySummaryData): Promise<void> {
  const date = dayjs(summary.date).toDate();

  await prisma.dailySummary.upsert({
    where: {
      userId_date: {
        userId,
        date,
      },
    },
    update: {
      totalAmount: summary.totalAmount,
      perCategoryBreakdown: summary.categoryBreakdowns as object,
      reimbursementTotal: summary.reimbursementTotal,
      computedAt: new Date(),
    },
    create: {
      userId,
      date,
      totalAmount: summary.totalAmount,
      perCategoryBreakdown: summary.categoryBreakdowns as object,
      reimbursementTotal: summary.reimbursementTotal,
    },
  });
}

export async function getAllOnboardedUsers(): Promise<Array<{ id: number; phoneNumber: string; name: string | null; timezone: string }>> {
  return prisma.user.findMany({
    where: { onboarded: true },
    select: {
      id: true,
      phoneNumber: true,
      name: true,
      timezone: true,
    },
  });
}

function formatCategoryName(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
}
