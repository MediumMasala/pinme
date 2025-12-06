// src/mastra/tools/pinme-tools.ts
import { createTool } from '@mastra/core';
import { z } from 'zod';
import OpenAI from 'openai';
import { prisma } from '../../db.js';
import { config } from '../../config.js';
import { whatsappClient } from '../../whatsapp/client.js';
import { createExpense, markExpensesAsReimbursement } from '../../logic/expenses.js';
import { createBillSplit } from '../../logic/splits.js';
import { upsertContacts } from '../../logic/contacts.js';
import { findUserByPhone, getOrCreateUser, updateUserName, markUserOnboarded } from '../../logic/users.js';
import { getRandomMoneyGif, getGifByCategory } from '../../services/giphy.js';
import { ExpenseCategory, ExpenseSource } from '../../types/index.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

// OpenAI client for vision
const openaiClient = new OpenAI({ apiKey: config.openai.apiKey });

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

      // First expense hook: Send ledger link on first expense
      try {
        const user = await prisma.user.findUnique({
          where: { phoneNumber: context.userPhone },
          select: { id: true },
        });
        if (user) {
          const expenseCount = await prisma.expense.count({
            where: { userId: user.id },
          });
          if (expenseCount === 1) {
            // This is their first expense - send ledger link
            const ledgerUrl = `${config.ledger.baseUrl}/ledger-ui`;
            await whatsappClient.sendTextMessage(
              context.userPhone,
              `P.S. You now have an expense ledger! View all your expenses anytime here: ${ledgerUrl}`
            );
          }
        }
      } catch (hookError) {
        // Don't fail the expense creation if the hook fails
        console.error('First expense hook error:', hookError);
      }

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

// Helper to add delay between messages
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const sendMessageTool = createTool({
  id: 'send-message',
  description: 'Send WhatsApp messages to a user. Use "messages" array for multiple short messages (chunking) instead of one long paragraph. Each message in the array will be sent separately with a small delay.',
  inputSchema: z.object({
    toPhone: z.string(),
    // Single message (backward compatible)
    text: z.string().optional().describe('Single plain text message. Use "messages" instead for chunked messages.'),
    // Multiple messages for chunking
    messages: z.array(z.string()).optional().describe('Array of short messages to send in sequence. Preferred over "text" for natural WhatsApp-style conversation.'),
    // Template support
    templateName: z.string().optional().describe('WhatsApp template name, if using template.'),
    templateVars: z.record(z.string()).optional().describe('Template variable map.'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    messageIds: z.array(z.string()).optional(),
    messageCount: z.number().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const messageIds: string[] = [];

      // Handle template messages
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

        const response = await whatsappClient.sendTemplateMessage(
          context.toPhone,
          context.templateName,
          'en',
          components
        );
        if (response?.messages?.[0]?.id) {
          messageIds.push(response.messages[0].id);
        }
        return {
          success: true,
          messageIds,
          messageCount: 1,
        };
      }

      // Handle multiple messages (chunking)
      if (context.messages && context.messages.length > 0) {
        for (let i = 0; i < context.messages.length; i++) {
          const msg = context.messages[i];
          if (msg.trim()) {
            const response = await whatsappClient.sendTextMessage(context.toPhone, msg);
            if (response?.messages?.[0]?.id) {
              messageIds.push(response.messages[0].id);
            }
            // Add small delay between messages (500ms) to make it feel natural
            if (i < context.messages.length - 1) {
              await delay(500);
            }
          }
        }
        return {
          success: true,
          messageIds,
          messageCount: messageIds.length,
        };
      }

      // Handle single text message (backward compatible)
      if (context.text) {
        const response = await whatsappClient.sendTextMessage(context.toPhone, context.text);
        if (response?.messages?.[0]?.id) {
          messageIds.push(response.messages[0].id);
        }
        return {
          success: true,
          messageIds,
          messageCount: 1,
        };
      }

      return {
        success: false,
        error: 'Either text, messages array, or templateName must be provided',
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

// ============================================
// REACT TO MESSAGE TOOL
// ============================================
export const reactToMessageTool = createTool({
  id: 'react-to-message',
  description: 'React to a WhatsApp message with an emoji. Use this to acknowledge expense messages with 📝 emoji.',
  inputSchema: z.object({
    toPhone: z.string().describe('Phone number of the user'),
    messageId: z.string().describe('WhatsApp message ID to react to'),
    emoji: z.string().default('📝').describe('Emoji to react with. Default is 📝 (memo/noting down)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const response = await whatsappClient.reactToMessage(
        context.toPhone,
        context.messageId,
        context.emoji
      );
      return {
        success: true,
        messageId: response?.messages?.[0]?.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to react to message',
      };
    }
  },
});

// ============================================
// PARSE RECEIPT TOOL (OCR via OpenAI Vision)
// ============================================
export const parseReceiptTool = createTool({
  id: 'parse-receipt',
  description: 'Parse a receipt/bill image to extract expense details. Use when user sends an image of a bill or receipt.',
  inputSchema: z.object({
    mediaId: z.string().describe('WhatsApp media ID of the receipt image'),
    caption: z.string().optional().describe('Any caption the user provided with the image'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    amount: z.number().optional().describe('Total amount on the receipt'),
    currency: z.string().optional(),
    merchant: z.string().optional().describe('Name of the merchant/restaurant/store'),
    category: z.enum(['FOOD', 'TRAVEL', 'GROCERIES', 'SHOPPING', 'BILLS', 'OTHER']).optional(),
    description: z.string().optional(),
    date: z.string().optional().describe('Date on the receipt if visible'),
    items: z.array(z.object({
      name: z.string(),
      amount: z.number(),
    })).optional().describe('Individual line items if visible'),
    rawText: z.string().optional().describe('Raw extracted text from receipt'),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      // 1. Get the media URL from WhatsApp
      const mediaUrl = await whatsappClient.getMediaUrl(context.mediaId);

      // 2. Download the image
      const imageBuffer = await whatsappClient.downloadMedia(mediaUrl);
      const base64Image = imageBuffer.toString('base64');

      // 3. Use OpenAI Vision to parse the receipt
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are a receipt/bill parser. Analyze this image of a receipt or bill and extract the following information in JSON format:

{
  "amount": <total amount as a number, no currency symbol>,
  "currency": "<currency code, default INR>",
  "merchant": "<name of merchant/restaurant/store>",
  "category": "<one of: FOOD, TRAVEL, GROCERIES, SHOPPING, BILLS, OTHER>",
  "description": "<brief 2-4 word description>",
  "date": "<date in YYYY-MM-DD format if visible, otherwise null>",
  "items": [{"name": "<item name>", "amount": <item price>}] or null if not clear,
  "rawText": "<key text from the receipt>"
}

Rules:
- For Indian receipts, look for "Total", "Grand Total", "Net Amount", "Amount Payable"
- Category should be FOOD for restaurants/cafes/food delivery, GROCERIES for supermarkets, TRAVEL for cabs/fuel, SHOPPING for retail, BILLS for utilities
- If it's a Swiggy/Zomato/food delivery receipt, category is FOOD
- Amount must be a number without currency symbols
- Be accurate with the total amount - this is the most important field

${context.caption ? `User's caption: "${context.caption}"` : ''}

Return ONLY valid JSON, no markdown or explanation.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return {
          success: false,
          error: 'No response from vision API',
        };
      }

      // Parse the JSON response
      const parsed = JSON.parse(content);

      return {
        success: true,
        amount: parsed.amount,
        currency: parsed.currency || 'INR',
        merchant: parsed.merchant,
        category: parsed.category,
        description: parsed.description,
        date: parsed.date,
        items: parsed.items,
        rawText: parsed.rawText,
      };
    } catch (error) {
      console.error('Receipt parsing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse receipt',
      };
    }
  },
});

// ============================================
// SEND GIF TOOL
// ============================================
export const sendGifTool = createTool({
  id: 'send-gif',
  description: 'Send a fun money-related GIF to the user. Use during onboarding or to celebrate milestones. Categories: welcome (for new users), expense (when logging), summary (for reports), split (for bill splits).',
  inputSchema: z.object({
    toPhone: z.string().describe('Phone number to send GIF to'),
    category: z.enum(['welcome', 'expense', 'summary', 'split']).optional().describe('Type of GIF to send. Default is random money GIF.'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      // Get a GIF based on category or random
      const gif = context.category
        ? await getGifByCategory(context.category)
        : await getRandomMoneyGif();

      if (!gif || !gif.mp4Url) {
        return {
          success: false,
          error: 'Could not fetch GIF',
        };
      }

      // Send the GIF as a video (WhatsApp plays MP4s as GIFs)
      const response = await whatsappClient.sendVideo(context.toPhone, gif.mp4Url);

      return {
        success: true,
        messageId: response?.messages?.[0]?.id,
      };
    } catch (error) {
      console.error('Send GIF error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send GIF',
      };
    }
  },
});
