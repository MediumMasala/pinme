// src/mastra/tools/ideas-tools.ts
// IDEAS MODULE - Tools for Second Brain / Thought Dump functionality
import { createTool } from '@mastra/core';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { findUserByPhone } from '../../logic/users.js';

// Helper to extract URL from text
function extractUrl(text: string): string | null {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const match = text.match(urlRegex);
  return match ? match[0] : null;
}

// Helper to extract basic tags from text
function extractTags(text: string): string[] {
  const tags: string[] = [];

  // Extract hashtags
  const hashtagRegex = /#(\w+)/g;
  let match;
  while ((match = hashtagRegex.exec(text)) !== null) {
    tags.push(match[1].toLowerCase());
  }

  // Extract keywords based on common patterns
  const lowerText = text.toLowerCase();

  // Category keywords
  if (lowerText.includes('idea') || lowerText.includes('concept')) tags.push('idea');
  if (lowerText.includes('startup') || lowerText.includes('business')) tags.push('startup');
  if (lowerText.includes('product')) tags.push('product');
  if (lowerText.includes('growth') || lowerText.includes('marketing')) tags.push('growth');
  if (lowerText.includes('whatsapp')) tags.push('whatsapp');
  if (lowerText.includes('tech') || lowerText.includes('ai') || lowerText.includes('ml')) tags.push('tech');
  if (lowerText.includes('design') || lowerText.includes('ui') || lowerText.includes('ux')) tags.push('design');
  if (lowerText.includes('career') || lowerText.includes('job')) tags.push('career');
  if (lowerText.includes('note') || lowerText.includes('reminder')) tags.push('note');
  if (lowerText.includes('article') || lowerText.includes('thread') || lowerText.includes('read')) tags.push('article');

  // Remove duplicates
  return [...new Set(tags)];
}

// Determine source type
function getSourceType(text: string, hasUrl: boolean): string {
  if (hasUrl && text.length > 50) return 'MIXED';
  if (hasUrl) return 'URL';
  return 'TEXT';
}

// ============================================
// SAVE IDEA TOOL
// ============================================
export const saveIdeaTool = createTool({
  id: 'save-idea',
  description:
    'Save an idea, note, thought, or link to the user\'s second brain. Use when user sends ideas, notes, links, or things they want to remember later.',
  inputSchema: z.object({
    userPhone: z.string().describe('Phone number of the user'),
    content: z.string().describe('The full text/idea/note to save'),
    sourceUrl: z.string().optional().describe('URL if the user shared a link'),
    tags: z.array(z.string()).optional().describe('Tags/keywords for categorization'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    ideaId: z.number().optional(),
    message: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      // Find user
      const user = await findUserByPhone(context.userPhone);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Extract URL if not provided
      const url = context.sourceUrl || extractUrl(context.content);

      // Extract/merge tags
      const autoTags = extractTags(context.content);
      const allTags = [...new Set([...(context.tags || []), ...autoTags])];

      // Determine source type
      const sourceType = getSourceType(context.content, !!url);

      // Create idea
      const idea = await prisma.ideaItem.create({
        data: {
          userId: user.id,
          content: context.content,
          sourceType,
          sourceUrl: url,
          tags: allTags,
        },
      });

      return {
        success: true,
        ideaId: idea.id,
        message: `Idea saved with ${allTags.length} tags`,
      };
    } catch (error) {
      console.error('Save idea error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save idea',
      };
    }
  },
});

// ============================================
// LIST IDEAS TOOL
// ============================================
export const listIdeasTool = createTool({
  id: 'list-ideas',
  description: 'List recent ideas/notes saved by the user. Use when user asks to see their saved ideas or notes.',
  inputSchema: z.object({
    userPhone: z.string().describe('Phone number of the user'),
    limit: z.number().optional().default(20).describe('Max number of ideas to return'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    items: z
      .array(
        z.object({
          id: z.number(),
          content: z.string(),
          sourceUrl: z.string().nullable(),
          tags: z.array(z.string()),
          createdAt: z.string(),
        })
      )
      .optional(),
    totalCount: z.number().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      // Find user
      const user = await findUserByPhone(context.userPhone);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Get total count
      const totalCount = await prisma.ideaItem.count({
        where: { userId: user.id },
      });

      // Get recent ideas
      const ideas = await prisma.ideaItem.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: context.limit || 20,
      });

      return {
        success: true,
        items: ideas.map((idea) => ({
          id: idea.id,
          content: idea.content,
          sourceUrl: idea.sourceUrl,
          tags: idea.tags,
          createdAt: idea.createdAt.toISOString(),
        })),
        totalCount,
      };
    } catch (error) {
      console.error('List ideas error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list ideas',
      };
    }
  },
});

// ============================================
// SUGGEST IDEAS TOOL
// ============================================
export const suggestIdeasTool = createTool({
  id: 'suggest-ideas',
  description:
    'Search and suggest ideas based on a topic/query. Use when user asks about their ideas on a specific topic.',
  inputSchema: z.object({
    userPhone: z.string().describe('Phone number of the user'),
    query: z.string().optional().describe('Topic or keyword to search for'),
    limit: z.number().optional().default(10).describe('Max number of ideas to return'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    items: z
      .array(
        z.object({
          id: z.number(),
          content: z.string(),
          sourceUrl: z.string().nullable(),
          tags: z.array(z.string()),
          createdAt: z.string(),
          relevanceNote: z.string().optional(),
        })
      )
      .optional(),
    searchedFor: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      // Find user
      const user = await findUserByPhone(context.userPhone);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      let ideas;

      if (context.query) {
        // Search by content (case-insensitive)
        ideas = await prisma.ideaItem.findMany({
          where: {
            userId: user.id,
            OR: [
              { content: { contains: context.query, mode: 'insensitive' } },
              { tags: { has: context.query.toLowerCase() } },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: context.limit || 10,
        });
      } else {
        // No query - return recent ideas
        ideas = await prisma.ideaItem.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: context.limit || 10,
        });
      }

      return {
        success: true,
        items: ideas.map((idea) => ({
          id: idea.id,
          content: idea.content,
          sourceUrl: idea.sourceUrl,
          tags: idea.tags,
          createdAt: idea.createdAt.toISOString(),
        })),
        searchedFor: context.query || 'recent ideas',
      };
    } catch (error) {
      console.error('Suggest ideas error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search ideas',
      };
    }
  },
});
