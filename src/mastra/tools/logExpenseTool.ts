import { createTool } from '@mastra/core';
import { z } from 'zod';
import { createExpense } from '../../logic/expenses.js';
import { ExpenseCategory, ExpenseSource } from '../../types/index.js';

export const logExpenseTool = createTool({
  id: 'log-expense',
  description: 'Log a new expense for a user. Use this when the user reports spending money on something.',
  inputSchema: z.object({
    userPhone: z.string().describe('The phone number of the user logging the expense'),
    amount: z.number().positive().describe('The expense amount in the currency specified'),
    currency: z.string().default('INR').describe('Currency code (default: INR)'),
    category: z.enum(['FOOD', 'TRAVEL', 'GROCERIES', 'SHOPPING', 'BILLS', 'OTHER']).describe('Category of the expense'),
    description: z.string().describe('Brief description of the expense'),
    expenseDatetime: z.string().describe('ISO 8601 datetime string of when the expense occurred'),
    isReimbursement: z.boolean().default(false).describe('Whether this is an office/work reimbursement'),
    rawMessageText: z.string().optional().describe('The original message text from the user'),
    source: z.enum(['TEXT', 'RECEIPT_IMAGE', 'MANUAL']).default('TEXT').describe('How this expense was recorded'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    expenseId: z.number().optional(),
    amount: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    isReimbursement: z.boolean().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const result = await createExpense({
        userPhone: context.userPhone,
        amount: context.amount,
        currency: context.currency,
        category: context.category as typeof ExpenseCategory[keyof typeof ExpenseCategory],
        description: context.description,
        expenseDatetime: context.expenseDatetime,
        isReimbursement: context.isReimbursement,
        rawMessageText: context.rawMessageText,
        source: context.source as typeof ExpenseSource[keyof typeof ExpenseSource],
      });

      return {
        success: true,
        expenseId: result.id,
        amount: result.amount,
        category: result.category,
        description: result.description,
        isReimbursement: result.isReimbursement,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
