// src/mastra/tools/pinme-tools.ts
import { createTool } from '@mastra/core';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { whatsappClient } from '../../whatsapp/client.js';
import { createExpense, markExpensesAsReimbursement } from '../../logic/expenses.js';
import { createBillSplit } from '../../logic/splits.js';
import { upsertContacts } from '../../logic/contacts.js';
import { findUserByPhone, getOrCreateUser, updateUserName, markUserOnboarded } from '../../logic/users.js';
import { ExpenseCategory, ExpenseSource } from '../../types/index.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

// ============================================
// LOG EXPENSE TOOL
// ============================================
export const logExpenseTool = createTool({
  id: 'log-expense',
  description: 'Log a new expense for the user.',
  inputSchema: z.object({
    userPhone: z.string().describe('Full phone number with country code.'),
    amount: z.number().positive().describe('Amount in INR.'),
    currency: z.string().default('INR'),
    category: z.enum(['FOOD', 'TRAVEL', 'GROCERIES', 'SHOPPING', 'BILLS', 'OTHER']).describe('Expense category.'),
    description: z.string().describe('Short description of the expense.'),
    expenseDatetime: z.string().describe('ISO datetime string when the expense happened.'),
    isReimbursement: z.boolean().default(false).describe('Whether this is an office reimbursement.'),
    rawMessageText: z.string().optional().describe('Original user message, for audit/debug.'),
    source: z.enum(['TEXT', 'RECEIPT_IMAGE', 'MANUAL']).default('TEXT'),
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

// ============================================
// MARK REIMBURSEMENT TOOL
// ============================================
export const markReimbursementTool = createTool({
  id: 'mark-reimbursement',
  description: 'Mark one or more expenses as office reimbursement.',
  inputSchema: z.object({
    userPhone: z.string(),
    expenseIds: z.array(z.number()).optional(),
    strategy: z.enum(['LAST', 'ALL_MATCHING']).default('LAST').describe('How to pick expenses if IDs not provided.'),
    filterText: z.string().optional().describe('Free text filter like "Uber", "Ola", etc.'),
    note: z.string().optional(),
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

// ============================================
// SPLIT BILL TOOL
// ============================================
export const splitBillTool = createTool({
  id: 'split-bill',
  description: 'Create a split for a large bill, compute per-head amount, and trigger friend notifications.',
  inputSchema: z.object({
    payerPhone: z.string(),
    expenseId: z.number(),
    contacts: z.array(z.object({
      name: z.string().optional(),
      phone: z.string(),
      relationshipType: z.enum(['FRIEND', 'COLLEAGUE', 'OTHER']).optional(),
    })).min(1).max(4),
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

// ============================================
// SAVE CONTACTS TOOL
// ============================================
export const saveContactsTool = createTool({
  id: 'save-contacts',
  description: 'Save or update contacts (friends/colleagues) for a user.',
  inputSchema: z.object({
    ownerPhone: z.string(),
    contacts: z.array(z.object({
      name: z.string().optional(),
      phone: z.string(),
      relationshipType: z.enum(['FRIEND', 'COLLEAGUE', 'OTHER']).default('FRIEND'),
    })),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    savedContacts: z.array(z.object({
      id: z.number(),
      name: z.string().nullable(),
      phoneNumber: z.string(),
      relationshipType: z.string(),
    })).optional(),
    count: z.number().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const saved = await upsertContacts({
        ownerPhone: context.ownerPhone,
        contacts: context.contacts,
      });

      return {
        success: true,
        savedContacts: saved,
        count: saved.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

// ============================================
// GET SUMMARY TOOL
// ============================================
export const getSummaryTool = createTool({
  id: 'get-summary',
  description: 'Get expense summary for a given date range.',
  inputSchema: z.object({
    userPhone: z.string(),
    range: z.enum(['TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH']).default('TODAY'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    range: z.string(),
    totalAmount: z.number(),
    perCategory: z.array(z.object({
      category: z.string(),
      amount: z.number(),
      count: z.number(),
    })).default([]),
    reimbursableTotal: z.number().default(0),
    reimbursableItems: z.array(z.object({
      description: z.string(),
      amount: z.number(),
    })).default([]),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const { userPhone, range } = context;

      // Find user
      const user = await findUserByPhone(userPhone);
      if (!user) {
        return {
          success: false,
          range,
          totalAmount: 0,
          perCategory: [],
          reimbursableTotal: 0,
          reimbursableItems: [],
          error: 'User not found',
        };
      }

      const tz = 'Asia/Kolkata';
      const now = dayjs().tz(tz);

      let startDate: dayjs.Dayjs;
      let endDate = now.endOf('day');

      switch (range) {
        case 'TODAY':
          startDate = now.startOf('day');
          break;
        case 'YESTERDAY':
          startDate = now.subtract(1, 'day').startOf('day');
          endDate = now.subtract(1, 'day').endOf('day');
          break;
        case 'THIS_WEEK':
          startDate = now.startOf('week');
          break;
        case 'THIS_MONTH':
          startDate = now.startOf('month');
          break;
        default:
          startDate = now.startOf('day');
      }

      const expenses = await prisma.expense.findMany({
        where: {
          userId: user.id,
          expenseDatetime: {
            gte: startDate.toDate(),
            lte: endDate.toDate(),
          },
        },
        orderBy: { expenseDatetime: 'desc' },
      });

      let totalAmount = 0;
      let reimbursableTotal = 0;
      const categoryMap: Record<string, { count: number; amount: number }> = {};
      const reimbursableItems: Array<{ description: string; amount: number }> = [];

      for (const expense of expenses) {
        const amount = Number(expense.amount);
        totalAmount += amount;

        if (expense.isReimbursement) {
          reimbursableTotal += amount;
          reimbursableItems.push({
            description: expense.description,
            amount,
          });
        }

        if (!categoryMap[expense.category]) {
          categoryMap[expense.category] = { count: 0, amount: 0 };
        }
        categoryMap[expense.category].count += 1;
        categoryMap[expense.category].amount += amount;
      }

      const perCategory = Object.entries(categoryMap).map(([category, data]) => ({
        category,
        count: data.count,
        amount: data.amount,
      }));

      return {
        success: true,
        range,
        totalAmount,
        perCategory,
        reimbursableTotal,
        reimbursableItems,
      };
    } catch (error) {
      return {
        success: false,
        range: context.range,
        totalAmount: 0,
        perCategory: [],
        reimbursableTotal: 0,
        reimbursableItems: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

// ============================================
// SEND MESSAGE TOOL
// ============================================
export const sendMessageTool = createTool({
  id: 'send-message',
  description: 'Send a WhatsApp message (either free text or a pre-approved template) to a user.',
  inputSchema: z.object({
    toPhone: z.string(),
    text: z.string().optional().describe('Plain text message to send.'),
    templateName: z.string().optional().describe('WhatsApp template name, if using template.'),
    templateVars: z.record(z.string()).optional().describe('Template variable map.'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      if (!context.text && !context.templateName) {
        return {
          success: false,
          error: 'Either text or templateName must be provided',
        };
      }

      let response;

      if (context.templateName) {
        const components = context.templateVars
          ? [{
              type: 'body' as const,
              parameters: Object.values(context.templateVars).map(value => ({
                type: 'text' as const,
                text: value,
              })),
            }]
          : undefined;

        response = await whatsappClient.sendTemplateMessage(
          context.toPhone,
          context.templateName,
          'en',
          components
        );
      } else if (context.text) {
        response = await whatsappClient.sendTextMessage(context.toPhone, context.text);
      }

      return {
        success: true,
        messageId: response?.messages?.[0]?.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

// ============================================
// USER TOOLS
// ============================================
export const getUserTool = createTool({
  id: 'get-user',
  description: 'Get user information by phone number. Returns null if user does not exist.',
  inputSchema: z.object({
    phoneNumber: z.string().describe('The phone number to look up'),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    user: z.object({
      id: z.number(),
      phoneNumber: z.string(),
      name: z.string().nullable(),
      onboarded: z.boolean(),
      timezone: z.string(),
    }).nullable(),
  }),
  execute: async ({ context }) => {
    const user = await findUserByPhone(context.phoneNumber);
    return {
      found: user !== null,
      user,
    };
  },
});

export const createUserTool = createTool({
  id: 'create-user',
  description: 'Create a new user or get existing user. Use when a new phone number is detected.',
  inputSchema: z.object({
    phoneNumber: z.string().describe('The phone number for the new user'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    user: z.object({
      id: z.number(),
      phoneNumber: z.string(),
      name: z.string().nullable(),
      onboarded: z.boolean(),
      timezone: z.string(),
    }).optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const user = await getOrCreateUser(context.phoneNumber);
      return {
        success: true,
        user,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

export const updateUserNameTool = createTool({
  id: 'update-user-name',
  description: 'Update the name of a user. Use after onboarding when user provides their name.',
  inputSchema: z.object({
    phoneNumber: z.string().describe('The phone number of the user'),
    name: z.string().describe('The name to set for the user'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    user: z.object({
      id: z.number(),
      phoneNumber: z.string(),
      name: z.string().nullable(),
      onboarded: z.boolean(),
      timezone: z.string(),
    }).optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const user = await updateUserName(context.phoneNumber, context.name);
      return {
        success: true,
        user,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

export const completeOnboardingTool = createTool({
  id: 'complete-onboarding',
  description: 'Mark a user as fully onboarded. Call after sending the welcome message with their name.',
  inputSchema: z.object({
    phoneNumber: z.string().describe('The phone number of the user'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    user: z.object({
      id: z.number(),
      phoneNumber: z.string(),
      name: z.string().nullable(),
      onboarded: z.boolean(),
      timezone: z.string(),
    }).optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const user = await markUserOnboarded(context.phoneNumber);
      return {
        success: true,
        user,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
