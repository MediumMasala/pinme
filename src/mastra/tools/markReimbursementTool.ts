import { createTool } from '@mastra/core';
import { z } from 'zod';
import { markExpensesAsReimbursement } from '../../logic/expenses.js';

export const markReimbursementTool = createTool({
  id: 'mark-reimbursement',
  description: 'Mark one or more expenses as office/work reimbursements. Use when user says something is reimbursable or an office expense.',
  inputSchema: z.object({
    userPhone: z.string().describe('The phone number of the user'),
    expenseIds: z.array(z.number()).optional().describe('Specific expense IDs to mark as reimbursement'),
    strategy: z.enum(['LAST', 'ALL_MATCHING']).optional().describe('LAST: mark the most recent expense. ALL_MATCHING: mark all expenses matching filterText'),
    filterText: z.string().optional().describe('Text to match against expense description/category when using ALL_MATCHING strategy'),
    note: z.string().optional().describe('Optional note about the reimbursement'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    markedExpenseIds: z.array(z.number()).optional(),
    count: z.number().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const markedIds = await markExpensesAsReimbursement({
        userPhone: context.userPhone,
        expenseIds: context.expenseIds,
        strategy: context.strategy,
        filterText: context.filterText,
        note: context.note,
      });

      return {
        success: true,
        markedExpenseIds: markedIds,
        count: markedIds.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
