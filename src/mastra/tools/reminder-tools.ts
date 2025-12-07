// src/mastra/tools/reminder-tools.ts
// REMINDERS MODULE - Tools for scheduling reminders
import { createTool } from '@mastra/core';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { findUserByPhone } from '../../logic/users.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

// ============================================
// CREATE REMINDER TOOL
// ============================================
export const createReminderTool = createTool({
  id: 'create-reminder',
  description:
    'Create a reminder for the user. Use when user says "remind me", "yaad dila", or mentions a future time/date for something.',
  inputSchema: z.object({
    userPhone: z.string().describe('Phone number of the user'),
    text: z.string().describe('What to remind the user about'),
    remindAtISO: z.string().describe('When to send the reminder (ISO datetime string in UTC)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    reminderId: z.number().optional(),
    scheduledFor: z.string().optional(),
    scheduledForHuman: z.string().optional(),
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

      // Parse the reminder time
      const remindAt = dayjs(context.remindAtISO).toDate();

      // Validate it's in the future
      if (remindAt <= new Date()) {
        return {
          success: false,
          error: 'Reminder time must be in the future',
        };
      }

      // Create reminder
      const reminder = await prisma.reminder.create({
        data: {
          userId: user.id,
          text: context.text,
          remindAt,
        },
      });

      // Format human-readable time in IST
      const humanTime = dayjs(remindAt).tz('Asia/Kolkata').format('D MMM YYYY, h:mm A');

      return {
        success: true,
        reminderId: reminder.id,
        scheduledFor: remindAt.toISOString(),
        scheduledForHuman: humanTime,
      };
    } catch (error) {
      console.error('Create reminder error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create reminder',
      };
    }
  },
});

// ============================================
// LIST REMINDERS TOOL
// ============================================
export const listRemindersTool = createTool({
  id: 'list-reminders',
  description: 'List upcoming reminders for the user. Use when user asks about their pending reminders.',
  inputSchema: z.object({
    userPhone: z.string().describe('Phone number of the user'),
    includeSent: z.boolean().optional().default(false).describe('Include already sent reminders'),
    limit: z.number().optional().default(10).describe('Max number of reminders to return'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    reminders: z
      .array(
        z.object({
          id: z.number(),
          text: z.string(),
          remindAt: z.string(),
          remindAtHuman: z.string(),
          sent: z.boolean(),
        })
      )
      .optional(),
    totalPending: z.number().optional(),
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

      // Build query
      const whereClause: {
        userId: number;
        sentAt?: null;
      } = { userId: user.id };

      if (!context.includeSent) {
        whereClause.sentAt = null;
      }

      // Get reminders
      const reminders = await prisma.reminder.findMany({
        where: whereClause,
        orderBy: { remindAt: 'asc' },
        take: context.limit || 10,
      });

      // Get total pending count
      const totalPending = await prisma.reminder.count({
        where: {
          userId: user.id,
          sentAt: null,
        },
      });

      return {
        success: true,
        reminders: reminders.map((r) => ({
          id: r.id,
          text: r.text,
          remindAt: r.remindAt.toISOString(),
          remindAtHuman: dayjs(r.remindAt).tz('Asia/Kolkata').format('D MMM, h:mm A'),
          sent: r.sentAt !== null,
        })),
        totalPending,
      };
    } catch (error) {
      console.error('List reminders error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list reminders',
      };
    }
  },
});

// ============================================
// UPDATE REMINDER TOOL
// ============================================
export const updateReminderTool = createTool({
  id: 'update-reminder',
  description:
    'Update an existing reminder (change time, text). Use when user says "change it to 5pm", "make it tomorrow", "actually at 8am", etc. Uses LAST_ACTIVE strategy - updates the most recent pending reminder if no ID specified.',
  inputSchema: z.object({
    userPhone: z.string().describe('Phone number of the user'),
    reminderId: z.number().optional().describe('Specific reminder ID to update (optional - uses most recent if not provided)'),
    newRemindAtISO: z.string().optional().describe('New time for the reminder (ISO datetime string in UTC)'),
    newText: z.string().optional().describe('New text for the reminder'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    reminderId: z.number().optional(),
    oldTime: z.string().optional(),
    newTime: z.string().optional(),
    newTimeHuman: z.string().optional(),
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

      let reminder;

      if (context.reminderId) {
        // Find specific reminder
        reminder = await prisma.reminder.findFirst({
          where: {
            id: context.reminderId,
            userId: user.id,
            sentAt: null,
            cancelledAt: null,
          },
        });
      } else {
        // LAST_ACTIVE strategy: get most recently created pending reminder
        reminder = await prisma.reminder.findFirst({
          where: {
            userId: user.id,
            sentAt: null,
            cancelledAt: null,
          },
          orderBy: { createdAt: 'desc' },
        });
      }

      if (!reminder) {
        return {
          success: false,
          error: 'No pending reminder found to update',
        };
      }

      // Prepare update data
      const updateData: { remindAt?: Date; text?: string } = {};

      if (context.newRemindAtISO) {
        const newRemindAt = dayjs(context.newRemindAtISO).toDate();
        if (newRemindAt <= new Date()) {
          return {
            success: false,
            error: 'New reminder time must be in the future',
          };
        }
        updateData.remindAt = newRemindAt;
      }

      if (context.newText) {
        updateData.text = context.newText;
      }

      if (Object.keys(updateData).length === 0) {
        return {
          success: false,
          error: 'No updates provided (need newRemindAtISO or newText)',
        };
      }

      const oldTime = reminder.remindAt.toISOString();

      // Update the reminder
      const updated = await prisma.reminder.update({
        where: { id: reminder.id },
        data: updateData,
      });

      const newTimeHuman = dayjs(updated.remindAt).tz('Asia/Kolkata').format('D MMM YYYY, h:mm A');

      return {
        success: true,
        reminderId: updated.id,
        oldTime,
        newTime: updated.remindAt.toISOString(),
        newTimeHuman,
        message: `Reminder updated to ${newTimeHuman}`,
      };
    } catch (error) {
      console.error('Update reminder error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update reminder',
      };
    }
  },
});

// ============================================
// CANCEL REMINDER TOOL
// ============================================
export const cancelReminderTool = createTool({
  id: 'cancel-reminder',
  description:
    'Cancel a reminder. Use when user says "cancel that reminder", "never mind", "delete it", etc. Uses LAST_ACTIVE strategy if no ID specified.',
  inputSchema: z.object({
    userPhone: z.string().describe('Phone number of the user'),
    reminderId: z.number().optional().describe('Specific reminder ID to cancel (optional - uses most recent if not provided)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    reminderId: z.number().optional(),
    cancelledText: z.string().optional(),
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

      let reminder;

      if (context.reminderId) {
        // Find specific reminder
        reminder = await prisma.reminder.findFirst({
          where: {
            id: context.reminderId,
            userId: user.id,
            sentAt: null,
            cancelledAt: null,
          },
        });
      } else {
        // LAST_ACTIVE strategy: get most recently created pending reminder
        reminder = await prisma.reminder.findFirst({
          where: {
            userId: user.id,
            sentAt: null,
            cancelledAt: null,
          },
          orderBy: { createdAt: 'desc' },
        });
      }

      if (!reminder) {
        return {
          success: false,
          error: 'No pending reminder found to cancel',
        };
      }

      // Cancel the reminder (soft delete)
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { cancelledAt: new Date() },
      });

      return {
        success: true,
        reminderId: reminder.id,
        cancelledText: reminder.text,
        message: 'Reminder cancelled successfully',
      };
    } catch (error) {
      console.error('Cancel reminder error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel reminder',
      };
    }
  },
});

// ============================================
// NOTE: Reminder Scheduler (Background Job)
// ============================================
// The actual sending of reminders will be handled by a background job/cron.
// This is outside the scope of the agent tools.
// The scheduler should:
// 1. Query for reminders where remindAt <= now AND sentAt IS NULL AND cancelledAt IS NULL
// 2. Send WhatsApp message to user
// 3. Update sentAt timestamp
// TODO: Implement reminder scheduler in src/jobs/reminder-scheduler.ts
