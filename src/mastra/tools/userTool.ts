import { createTool } from '@mastra/core';
import { z } from 'zod';
import { findUserByPhone, getOrCreateUser, updateUserName, markUserOnboarded } from '../../logic/users.js';

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
