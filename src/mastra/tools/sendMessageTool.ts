import { createTool } from '@mastra/core';
import { z } from 'zod';
import { whatsappClient } from '../../whatsapp/client.js';

export const sendMessageTool = createTool({
  id: 'send-message',
  description: 'Send a WhatsApp message to a user. Use this to send responses, confirmations, and notifications.',
  inputSchema: z.object({
    toPhone: z.string().describe('Phone number to send the message to'),
    text: z.string().optional().describe('Plain text message to send (use this OR templateName, not both)'),
    templateName: z.string().optional().describe('WhatsApp template name for pre-approved messages'),
    templateVars: z.record(z.string()).optional().describe('Variables for the template message'),
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
