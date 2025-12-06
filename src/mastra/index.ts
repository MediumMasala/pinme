// src/mastra/index.ts
import { Mastra } from '@mastra/core';
import { pinMeAgent } from './agents/pinme-agent.js';
import { chatAgent } from './agents/chat-agent.js';
import { findUserByPhone } from '../logic/users.js';

export const mastra = new Mastra({
  agents: {
    pinMe: pinMeAgent,
    chat: chatAgent,
  },
});

export { pinMeAgent, PINME_SYSTEM_PROMPT } from './agents/pinme-agent.js';
export { chatAgent, CHAT_SYSTEM_PROMPT } from './agents/chat-agent.js';

// Re-export tools for convenience
export {
  logExpenseTool,
  markReimbursementTool,
  splitBillTool,
  saveContactsTool,
  getSummaryTool,
  sendMessageTool,
  getUserTool,
  createUserTool,
  updateUserNameTool,
  completeOnboardingTool,
  parseReceiptTool,
  reactToMessageTool,
  sendGifTool,
} from './tools/pinme-tools.js';

// Helper interface for agent context
export interface AgentContext {
  userPhone: string;
  messageText?: string;
  mediaType?: 'image' | 'document' | 'audio' | 'video';
  mediaId?: string;
  caption?: string;
  timestamp: Date;
  messageId?: string; // WhatsApp message ID for reactions
}

// Keywords that indicate expense-related messages
const EXPENSE_KEYWORDS = [
  // Numbers and currency
  /\d+/, // any number
  /₹/, /rs\.?/i, /rupee/i, /inr/i,
  // Expense actions
  /spent/i, /spend/i, /paid/i, /pay/i, /kharcha/i, /kharche/i,
  /uda/i, /udaya/i, /gaya/i, /gaye/i, /laga/i,
  /bill/i, /receipt/i, /invoice/i,
  // Categories
  /swiggy/i, /zomato/i, /uber/i, /ola/i, /rapido/i,
  /food/i, /lunch/i, /dinner/i, /breakfast/i, /coffee/i, /chai/i,
  /travel/i, /cab/i, /auto/i, /metro/i, /bus/i, /flight/i, /train/i,
  /shopping/i, /amazon/i, /flipkart/i, /myntra/i,
  /groceries/i, /grocery/i, /blinkit/i, /zepto/i, /bigbasket/i,
  // Expense queries
  /kitna/i, /total/i, /summary/i, /how much/i, /aaj/i, /today/i, /yesterday/i, /kal/i,
  /week/i, /month/i, /hafta/i, /mahina/i,
  // Reimbursement
  /reimburs/i, /office/i, /claim/i,
  // Split
  /split/i, /divide/i, /baant/i,
];

// Check if message is expense-related
function isExpenseRelated(text: string): boolean {
  if (!text) return false;
  return EXPENSE_KEYWORDS.some(pattern => pattern.test(text));
}

// Process incoming WhatsApp message
export async function processMessage(context: AgentContext): Promise<void> {
  const { userPhone, messageText, mediaType, mediaId, caption, timestamp, messageId } = context;

  // Check if user exists and is onboarded
  const existingUser = await findUserByPhone(userPhone);
  const isNewUser = !existingUser || !existingUser.onboarded;

  // Build the user message for the agent
  let userMessage = '';

  if (mediaType === 'image') {
    userMessage = `[User sent a receipt/bill image]
Media ID: ${mediaId}
Caption: ${caption || 'No caption provided'}

IMPORTANT: Use the parseReceipt tool with mediaId "${mediaId}" to extract the bill details (amount, merchant, category).
Then use logExpense to save the expense with source "RECEIPT_IMAGE".
Finally, send a confirmation message to the user.`;
  } else if (messageText) {
    userMessage = messageText;
  } else {
    userMessage = '[Empty message received]';
  }

  // Decide which agent to use:
  // - New users → pinMeAgent (for onboarding)
  // - Media (receipts) → pinMeAgent (for parsing)
  // - Expense-related text → pinMeAgent
  // - Everything else (small talk) → chatAgent

  const shouldUsePinMeAgent = isNewUser ||
                              mediaType === 'image' ||
                              isExpenseRelated(messageText || '');

  if (shouldUsePinMeAgent) {
    // Build full context for pinMeAgent
    const contextMessage = `
CONTEXT:
- User Phone: ${userPhone}
- Timestamp: ${timestamp.toISOString()}
- Has Media: ${mediaType ? 'Yes (' + mediaType + ')' : 'No'}
- Message ID: ${messageId || 'N/A'}

First, check if the user exists using getUser tool with phone number: ${userPhone}
Based on the result, handle onboarding if needed or process their request.

IMPORTANT: If the user is logging an expense (sending amount info), use reactToMessage tool with messageId "${messageId}" and emoji "📝" to acknowledge the message BEFORE logging the expense.

USER MESSAGE:
${userMessage}`;

    const agent = mastra.getAgent('pinMe');
    await agent.generate(contextMessage);
  } else {
    // Use chat agent for non-expense messages
    const chatContext = `
CONTEXT:
- User Phone: ${userPhone}
- User Name: ${existingUser?.name || 'Unknown'}
- Timestamp: ${timestamp.toISOString()}

The user sent a casual/non-expense message. Respond in PinMe's style and gently steer back to expenses.

USER MESSAGE:
${userMessage}`;

    const agent = mastra.getAgent('chat');
    await agent.generate(chatContext);
  }
}
