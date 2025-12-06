import { createTool } from '@mastra/core';
import { z } from 'zod';
import { upsertContacts } from '../../logic/contacts.js';

export const saveContactsTool = createTool({
  id: 'save-contacts',
  description: 'Save or update contacts for a user. Use when user provides phone numbers of friends/colleagues.',
  inputSchema: z.object({
    ownerPhone: z.string().describe('Phone number of the user who owns these contacts'),
    contacts: z.array(z.object({
      phone: z.string().describe('Phone number of the contact'),
      name: z.string().optional().describe('Name of the contact'),
      relationshipType: z.enum(['FRIEND', 'COLLEAGUE', 'OTHER']).optional().describe('Type of relationship'),
    })).min(1).max(10).describe('List of contacts to save'),
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
