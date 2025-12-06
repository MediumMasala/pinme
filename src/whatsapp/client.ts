import axios, { type AxiosInstance } from 'axios';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { MessageDirection, MessageChannel } from '../types/index.js';
import type { WhatsAppSendMessageResponse, WhatsAppTemplateComponent } from '../types/index.js';

class WhatsAppClient {
  private client: AxiosInstance;
  private phoneNumberId: string;

  constructor() {
    this.phoneNumberId = config.whatsapp.phoneNumberId;
    this.client = axios.create({
      baseURL: `https://graph.facebook.com/${config.whatsapp.apiVersion}/${this.phoneNumberId}`,
      headers: {
        Authorization: `Bearer ${config.whatsapp.token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async sendTextMessage(toPhone: string, text: string): Promise<WhatsAppSendMessageResponse> {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toPhone,
      type: 'text',
      text: { body: text },
    };

    const response = await this.client.post<WhatsAppSendMessageResponse>('/messages', payload);

    await this.logOutboundMessage(toPhone, payload);

    return response.data;
  }

  async sendTemplateMessage(
    toPhone: string,
    templateName: string,
    languageCode: string = 'en',
    components?: WhatsAppTemplateComponent[]
  ): Promise<WhatsAppSendMessageResponse> {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components && { components }),
      },
    };

    const response = await this.client.post<WhatsAppSendMessageResponse>('/messages', payload);

    await this.logOutboundMessage(toPhone, payload);

    return response.data;
  }

  async reactToMessage(toPhone: string, messageId: string, emoji: string): Promise<WhatsAppSendMessageResponse> {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toPhone,
      type: 'reaction',
      reaction: {
        message_id: messageId,
        emoji: emoji,
      },
    };

    const response = await this.client.post<WhatsAppSendMessageResponse>('/messages', payload);

    return response.data;
  }

  async markAsRead(messageId: string): Promise<void> {
    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    };

    await this.client.post('/messages', payload);
  }

  async sendVideo(toPhone: string, videoUrl: string, caption?: string): Promise<WhatsAppSendMessageResponse> {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toPhone,
      type: 'video',
      video: {
        link: videoUrl,
        ...(caption && { caption }),
      },
    };

    const response = await this.client.post<WhatsAppSendMessageResponse>('/messages', payload);
    await this.logOutboundMessage(toPhone, payload);
    return response.data;
  }

  async sendImage(toPhone: string, imageUrl: string, caption?: string): Promise<WhatsAppSendMessageResponse> {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toPhone,
      type: 'image',
      image: {
        link: imageUrl,
        ...(caption && { caption }),
      },
    };

    const response = await this.client.post<WhatsAppSendMessageResponse>('/messages', payload);
    await this.logOutboundMessage(toPhone, payload);
    return response.data;
  }

  async sendSticker(toPhone: string, stickerUrl: string): Promise<WhatsAppSendMessageResponse> {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toPhone,
      type: 'sticker',
      sticker: {
        link: stickerUrl,
      },
    };

    const response = await this.client.post<WhatsAppSendMessageResponse>('/messages', payload);
    await this.logOutboundMessage(toPhone, payload);
    return response.data;
  }

  async getMediaUrl(mediaId: string): Promise<string> {
    const response = await axios.get<{ url: string }>(
      `https://graph.facebook.com/${config.whatsapp.apiVersion}/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${config.whatsapp.token}`,
        },
      }
    );
    return response.data.url;
  }

  async downloadMedia(mediaUrl: string): Promise<Buffer> {
    const response = await axios.get<ArrayBuffer>(mediaUrl, {
      headers: {
        Authorization: `Bearer ${config.whatsapp.token}`,
      },
      responseType: 'arraybuffer',
    });
    return Buffer.from(response.data);
  }

  private async logOutboundMessage(toPhone: string, payload: Record<string, unknown>): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { phoneNumber: toPhone },
      select: { id: true },
    });

    await prisma.messageLog.create({
      data: {
        userId: user?.id ?? null,
        direction: MessageDirection.OUTBOUND,
        channel: MessageChannel.WHATSAPP,
        payload: payload as object,
      },
    });
  }
}

export const whatsappClient = new WhatsAppClient();
