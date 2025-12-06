import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../db.js';
import type { LogExpenseInput, MarkReimbursementInput } from '../types/index.js';
import { ExpenseSource } from '../types/index.js';

export interface ExpenseResult {
  id: number;
  amount: string;
  currency: string;
  category: string;
  description: string;
  expenseDatetime: Date;
  isReimbursement: boolean;
}

export async function createExpense(input: LogExpenseInput): Promise<ExpenseResult> {
  const user = await prisma.user.findUnique({
    where: { phoneNumber: input.userPhone },
  });

  if (!user) {
    throw new Error(`User not found for phone: ${input.userPhone}`);
  }

  const expense = await prisma.expense.create({
    data: {
      userId: user.id,
      amount: new Decimal(input.amount),
      currency: input.currency,
      category: input.category,
      description: input.description,
      expenseDatetime: new Date(input.expenseDatetime),
      source: input.source ?? ExpenseSource.TEXT,
      rawMessageText: input.rawMessageText,
      receiptMetadata: input.receiptMetadata as object | undefined,
      isReimbursement: input.isReimbursement,
    },
  });

  return {
    id: expense.id,
    amount: expense.amount.toString(),
    currency: expense.currency,
    category: expense.category,
    description: expense.description,
    expenseDatetime: expense.expenseDatetime,
    isReimbursement: expense.isReimbursement,
  };
}

export async function markExpensesAsReimbursement(input: MarkReimbursementInput): Promise<number[]> {
  const user = await prisma.user.findUnique({
    where: { phoneNumber: input.userPhone },
  });

  if (!user) {
    throw new Error(`User not found for phone: ${input.userPhone}`);
  }

  let expenseIds: number[] = [];

  if (input.expenseIds && input.expenseIds.length > 0) {
    expenseIds = input.expenseIds;
  } else if (input.strategy === 'LAST') {
    const lastExpense = await prisma.expense.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (lastExpense) {
      expenseIds = [lastExpense.id];
    }
  } else if (input.strategy === 'ALL_MATCHING' && input.filterText) {
    const matchingExpenses = await prisma.expense.findMany({
      where: {
        userId: user.id,
        isReimbursement: false,
        OR: [
          { description: { contains: input.filterText, mode: 'insensitive' } },
          { category: { contains: input.filterText, mode: 'insensitive' } },
          { rawMessageText: { contains: input.filterText, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    expenseIds = matchingExpenses.map((e) => e.id);
  }

  if (expenseIds.length > 0) {
    await prisma.expense.updateMany({
      where: {
        id: { in: expenseIds },
        userId: user.id,
      },
      data: {
        isReimbursement: true,
        reimbursementNote: input.note,
      },
    });
  }

  return expenseIds;
}

export async function getExpenseById(expenseId: number): Promise<ExpenseResult | null> {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
  });

  if (!expense) return null;

  return {
    id: expense.id,
    amount: expense.amount.toString(),
    currency: expense.currency,
    category: expense.category,
    description: expense.description,
    expenseDatetime: expense.expenseDatetime,
    isReimbursement: expense.isReimbursement,
  };
}

export async function getLastExpenseForUser(userPhone: string): Promise<ExpenseResult | null> {
  const user = await prisma.user.findUnique({
    where: { phoneNumber: userPhone },
  });

  if (!user) return null;

  const expense = await prisma.expense.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  if (!expense) return null;

  return {
    id: expense.id,
    amount: expense.amount.toString(),
    currency: expense.currency,
    category: expense.category,
    description: expense.description,
    expenseDatetime: expense.expenseDatetime,
    isReimbursement: expense.isReimbursement,
  };
}
