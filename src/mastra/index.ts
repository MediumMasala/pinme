// src/mastra/index.ts
import { Mastra } from '@mastra/core';
import { pinMeAgent } from './agents/pinme-agent.js';
import { findUserByPhone } from '../logic/users.js';
import { getRandomMoneyGif } from '../services/giphy.js';
import { whatsappClient } from '../whatsapp/client.js';

export const mastra = new Mastra({
  agents: {
    pinMe: pinMeAgent,
  },
});

export { pinMeAgent, PINME_SYSTEM_PROMPT } from './agents/pinme-agent.js';

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

// Process incoming WhatsApp message
export async function processMessage(context: AgentContext): Promise<void> {
  const { userPhone, messageText, mediaType, mediaId, caption, timestamp, messageId } = context;

  // Check if this is a new user (for GIF after onboarding intro)
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

  // Build context message with user info
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

  // Get agent from mastra and generate response
  const agent = mastra.getAgent('pinMe');
  await agent.generate(contextMessage);

  // If this was a new user's first message, send a welcome GIF after the agent's intro
  if (isNewUser) {
    try {
      const gif = await getRandomMoneyGif();
      if (gif?.mp4Url) {
        // Small delay so GIF appears after intro messages
        await new Promise(resolve => setTimeout(resolve, 1000));
        await whatsappClient.sendVideo(userPhone, gif.mp4Url);
      }
    } catch (error) {
      console.error('Failed to send welcome GIF:', error);
      // Non-critical, continue without GIF
    }
  }
}
