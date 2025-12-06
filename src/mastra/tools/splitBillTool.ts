import { createTool } from '@mastra/core';
import { z } from 'zod';
import { createBillSplit } from '../../logic/splits.js';

export const splitBillTool = createTool({
  id: 'split-bill',
  description: 'Split an expense among friends. Creates a bill split and returns participant details for sending payment requests.',
  inputSchema: z.object({
    expenseId: z.number().describe('The ID of the expense to split'),
    payerPhone: z.string().describe('Phone number of the user who paid (the payer)'),
    contacts: z.array(z.object({
      phone: z.string().describe('Phone number of the friend'),
      name: z.string().optional().describe('Name of the friend'),
      relationshipType: z.enum(['FRIEND', 'COLLEAGUE', 'OTHER']).optional().describe('Type of relationship'),
    })).min(1).max(10).describe('List of friends to split the bill with'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    billSplitId: z.number().optional(),
    totalAmount: z.string().optional(),
    amountPerPerson: z.string().optional(),
    payerName: z.string().nullable().optional(),
    participants: z.array(z.object({
      contactId: z.number(),
      name: z.string().nullable(),
      phoneNumber: z.string(),
      amount: z.string(),
    })).optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const result = await createBillSplit({
        expenseId: context.expenseId,
        payerPhone: context.payerPhone,
        contacts: context.contacts,
      });

      return {
        success: true,
        billSplitId: result.billSplitId,
        totalAmount: result.totalAmount,
        amountPerPerson: result.amountPerPerson,
        payerName: result.payerName,
        participants: result.participants.map(p => ({
          contactId: p.contactId,
          name: p.name,
          phoneNumber: p.phoneNumber,
          amount: p.amount,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
