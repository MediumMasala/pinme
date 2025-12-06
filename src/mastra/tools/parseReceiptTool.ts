import { createTool } from '@mastra/core';
import { z } from 'zod';
// import { whatsappClient } from '../../whatsapp/client.js'; // For future OCR integration

export const parseReceiptTool = createTool({
  id: 'parse-receipt',
  description: 'Parse a receipt/bill image to extract expense details. Currently returns stubbed data - integrate with OCR service for production.',
  inputSchema: z.object({
    mediaId: z.string().describe('WhatsApp media ID of the receipt image'),
    mediaType: z.string().optional().describe('MIME type of the media'),
    caption: z.string().optional().describe('Caption provided with the image'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    parsed: z.object({
      amount: z.number().optional(),
      currency: z.string().optional(),
      merchantName: z.string().optional(),
      category: z.string().optional(),
      date: z.string().optional(),
      items: z.array(z.object({
        name: z.string(),
        amount: z.number(),
      })).optional(),
      rawText: z.string().optional(),
    }).optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      // Get media URL from WhatsApp (for future OCR integration)
      // TODO: Integrate with real OCR service (Google Vision, AWS Textract, etc.)
      // const mediaUrl = await whatsappClient.getMediaUrl(context.mediaId);
      // const mediaBuffer = await whatsappClient.downloadMedia(mediaUrl);
      void context.mediaId; // Acknowledge mediaId is available for future use

      // Stubbed response - in production, parse the actual receipt
      return {
        success: true,
        parsed: {
          amount: 500,
          currency: 'INR',
          merchantName: 'Restaurant (OCR pending)',
          category: 'FOOD',
          date: new Date().toISOString(),
          items: [
            { name: 'Food items (OCR pending)', amount: 500 },
          ],
          rawText: '[OCR not yet implemented - integrate with Vision API or Tesseract]',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
