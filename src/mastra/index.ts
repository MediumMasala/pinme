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
  transcribeVoiceTool,
  parsePdfTool,
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

// Check if message looks like a name (for onboarding detection)
function looksLikeName(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  // Name characteristics: 1-3 words, no numbers, not too long, not a command
  const wordCount = trimmed.split(/\s+/).length;
  const hasNumbers = /\d/.test(trimmed);
  const isCommand = /^(hi|hello|hey|help|stop|quit|exit|yes|no|ok|okay)/i.test(trimmed);
  const isShort = trimmed.length <= 30;

  return wordCount <= 3 && !hasNumbers && !isCommand && isShort;
}

// Process incoming WhatsApp message
export async function processMessage(context: AgentContext): Promise<void> {
  const { userPhone, messageText, mediaType, mediaId, caption, timestamp, messageId } = context;

  // Check if user exists and is onboarded
  const existingUser = await findUserByPhone(userPhone);

  // Determine user state:
  // - brandNewUser: no record exists at all
  // - awaitingName: user exists but not onboarded (likely replied with name)
  // - onboardedUser: fully onboarded
  const brandNewUser = !existingUser;
  const awaitingName = existingUser && !existingUser.onboarded;
  const isNewUser = brandNewUser || awaitingName;

  // Build the user message for the agent
  let userMessage = '';

  if (mediaType === 'image') {
    userMessage = `[User sent a receipt/bill image]
Media ID: ${mediaId}
Caption: ${caption || 'No caption provided'}

IMPORTANT: Use the parseReceipt tool with mediaId "${mediaId}" to extract the bill details (amount, merchant, category).
Then use logExpense to save the expense with source "RECEIPT_IMAGE".
Finally, send a confirmation message to the user.`;
  } else if (mediaType === 'audio') {
    userMessage = `[User sent a voice note]
Media ID: ${mediaId}

IMPORTANT: Use the transcribeVoice tool with mediaId "${mediaId}" to transcribe the voice message.
Then process the transcribed text as if the user had typed it.
If it contains expense information, log the expense. If it's a question or command, handle it accordingly.
Always send a confirmation message to the user after processing.`;
  } else if (mediaType === 'document') {
    userMessage = `[User sent a document/PDF]
Media ID: ${mediaId}
Caption: ${caption || 'No caption provided'}

IMPORTANT: Use the parsePdf tool with mediaId "${mediaId}" to analyze the document.
If it's a bill, invoice, or receipt, extract the expense details and use logExpense to save it.
Send a summary of what you found and confirm with the user.`;
  } else if (messageText) {
    userMessage = messageText;
  } else {
    userMessage = '[Empty message received]';
  }

  // Decide which agent to use:
  // - New users → pinMeAgent (for onboarding)
  // - Media (receipts, voice notes, documents) → pinMeAgent (for parsing)
  // - Expense-related text → pinMeAgent
  // - Everything else (small talk) → chatAgent

  const shouldUsePinMeAgent = isNewUser ||
                              mediaType === 'image' ||
                              mediaType === 'audio' ||
                              mediaType === 'document' ||
                              isExpenseRelated(messageText || '');

  if (shouldUsePinMeAgent) {
    // Build context based on user state
    let onboardingContext = '';

    if (brandNewUser) {
      // Completely new user - introduce and ask for name
      onboardingContext = `
ONBOARDING STATE: NEW USER
This is a BRAND NEW user (no record exists).
1. First use createUser tool with phone: ${userPhone}
2. Then introduce yourself and ask for their name
3. Send a welcome GIF using sendGif tool with category "welcome"
DO NOT complete onboarding yet - wait for them to reply with their name.`;
    } else if (awaitingName && looksLikeName(messageText || '')) {
      // User exists but not onboarded, and message looks like a name
      onboardingContext = `
ONBOARDING STATE: USER REPLIED WITH NAME
The user "${messageText}" has replied with what looks like their NAME.
DO NOT introduce yourself again! They already know you.
1. Use updateUserName tool with phone "${userPhone}" and name "${messageText}"
2. Use completeOnboarding tool with phone "${userPhone}"
3. Send the welcome onboarding message explaining how to use PinMe
This is their NAME, not a new conversation.`;
    } else if (awaitingName) {
      // User exists but not onboarded, message doesn't look like a name
      onboardingContext = `
ONBOARDING STATE: PENDING NAME
User exists but hasn't completed onboarding (we asked for their name).
Their message "${messageText}" doesn't look like a name.
If it IS their name, update it and complete onboarding.
If it's something else, gently remind them: "Hey, pehle bata de kya bulaaun tujhe?"`;
    } else {
      // Fully onboarded user
      onboardingContext = `
ONBOARDING STATE: ONBOARDED USER
User is fully onboarded. Name: ${existingUser?.name || 'Unknown'}
Process their request normally.`;
    }

    const contextMessage = `
CONTEXT:
- User Phone: ${userPhone}
- Timestamp: ${timestamp.toISOString()}
- Has Media: ${mediaType ? 'Yes (' + mediaType + ')' : 'No'}
- Message ID: ${messageId || 'N/A'}
${onboardingContext}

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
