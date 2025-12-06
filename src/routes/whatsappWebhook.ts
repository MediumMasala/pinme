import { Router, type Request, type Response } from 'express';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { processMessage } from '../mastra/index.js';
import { whatsappClient } from '../whatsapp/client.js';
import { MessageDirection, MessageChannel } from '../types/index.js';
import type { WhatsAppWebhookPayload, WhatsAppMessage, NormalizedMessage } from '../types/index.js';
import { normalizePhoneNumber } from '../logic/contacts.js';

export const whatsappWebhookRouter = Router();

// Webhook verification (GET) - required by WhatsApp
whatsappWebhookRouter.get('/', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    console.log('WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    console.warn('WhatsApp webhook verification failed');
    res.sendStatus(403);
  }
});

// Webhook messages (POST) - receives messages
whatsappWebhookRouter.post('/', async (req: Request, res: Response) => {
  try {
    const payload = req.body as WhatsAppWebhookPayload;

    // Always respond 200 quickly to avoid retries
    res.sendStatus(200);

    // Process the webhook asynchronously
    await processWebhook(payload);
  } catch (error) {
    console.error('Error processing webhook:', error);
    // Still return 200 to prevent retries
    if (!res.headersSent) {
      res.sendStatus(200);
    }
  }
});

async function processWebhook(payload: WhatsAppWebhookPayload): Promise<void> {
  if (payload.object !== 'whatsapp_business_account') {
    return;
  }

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue;

      const value = change.value;
      const messages = value.messages || [];

      for (const message of messages) {
        await processIncomingMessage(message, value.contacts?.[0]);
      }
    }
  }
}

async function processIncomingMessage(
  message: WhatsAppMessage,
  _contact?: { profile: { name: string }; wa_id: string }
): Promise<void> {
  const normalized = normalizeMessage(message);

  // Mark message as read immediately (shows blue ticks)
  if (normalized.messageId) {
    try {
      await whatsappClient.markAsRead(normalized.messageId);
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  }

  // Log the inbound message
  await logInboundMessage(normalized, message);

  // Process with the Mastra agent
  await processMessage({
    userPhone: normalized.phoneNumber,
    messageText: normalized.messageText,
    mediaType: normalized.mediaType,
    mediaId: normalized.mediaId,
    caption: normalized.caption,
    timestamp: normalized.timestamp,
    messageId: normalized.messageId,
  });
}

function normalizeMessage(message: WhatsAppMessage): NormalizedMessage {
  const phoneNumber = normalizePhoneNumber(message.from);
  const timestamp = new Date(parseInt(message.timestamp) * 1000);

  const normalized: NormalizedMessage = {
    phoneNumber,
    timestamp,
    messageId: message.id,
  };

  switch (message.type) {
    case 'text':
      normalized.messageText = message.text?.body;
      break;

    case 'image':
      normalized.mediaType = 'image';
      normalized.mediaId = message.image?.id;
      normalized.caption = message.image?.caption;
      break;

    case 'document':
      normalized.mediaType = 'document';
      normalized.mediaId = message.document?.id;
      normalized.caption = message.document?.caption;
      break;

    case 'audio':
      normalized.mediaType = 'audio';
      normalized.mediaId = message.audio?.id;
      break;

    case 'video':
      normalized.mediaType = 'video';
      normalized.mediaId = message.video?.id;
      normalized.caption = message.video?.caption;
      break;

    default:
      // For unsupported message types, treat as empty text
      normalized.messageText = `[Unsupported message type: ${message.type}]`;
  }

  return normalized;
}

async function logInboundMessage(normalized: NormalizedMessage, rawMessage: WhatsAppMessage): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { phoneNumber: normalized.phoneNumber },
    select: { id: true },
  });

  await prisma.messageLog.create({
    data: {
      userId: user?.id ?? null,
      direction: MessageDirection.INBOUND,
      channel: MessageChannel.WHATSAPP,
      payload: {
        normalized: normalized as object,
        raw: rawMessage as object,
      },
    },
  });
}
