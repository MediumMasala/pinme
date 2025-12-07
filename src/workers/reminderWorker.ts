// src/workers/reminderWorker.ts
// REMINDER WORKER - Polls for due reminders and sends WhatsApp messages
import { prisma } from '../db.js';
import { whatsappClient } from '../whatsapp/client.js';
import type { Reminder, User } from '@prisma/client';

const POLL_INTERVAL_MS = 60_000; // 1 minute

type ReminderWithUser = Reminder & { user: User };

/**
 * Build the reminder message in PinMe's chill style
 */
function buildReminderMessage(reminder: ReminderWithUser): string {
  const userName = reminder.user?.name && reminder.user.name.trim().length > 0
    ? reminder.user.name.split(' ')[0]
    : 'bhai';
  const text = reminder.text;

  return `Ping ping ⚡ ${userName}, ${text} karna tha abhi yaad hai?`;
}

/**
 * Send a single reminder via WhatsApp and mark as sent
 */
async function dispatchReminder(reminder: ReminderWithUser): Promise<void> {
  try {
    const message = buildReminderMessage(reminder);

    // Send via WhatsApp
    await whatsappClient.sendTextMessage(reminder.user.phoneNumber, message);

    // Mark as sent
    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { sentAt: new Date() },
    });

    console.log(`[ReminderWorker] Sent reminder ${reminder.id} to ${reminder.user.phoneNumber}`);
  } catch (error) {
    // Log error but don't mark as sent - will retry on next tick
    console.error(`[ReminderWorker] Failed to send reminder ${reminder.id}:`, error);
  }
}

/**
 * Poll for due reminders and dispatch them
 */
async function pollReminders(): Promise<void> {
  try {
    const now = new Date();

    // Fetch due reminders (not sent, not cancelled, time has passed)
    const dueReminders = await prisma.reminder.findMany({
      where: {
        sentAt: null,
        cancelledAt: null,
        remindAt: {
          lte: now,
        },
      },
      include: {
        user: true,
      },
      take: 50, // Safety limit per tick
    });

    if (dueReminders.length > 0) {
      console.log(`[ReminderWorker] Found ${dueReminders.length} due reminder(s)`);
    }

    for (const reminder of dueReminders) {
      await dispatchReminder(reminder);
    }
  } catch (error) {
    console.error('[ReminderWorker] Error while polling reminders:', error);
  }
}

/**
 * Start the reminder worker loop
 */
export function startReminderWorker(): void {
  console.log('[ReminderWorker] Starting reminder worker...');
  console.log(`[ReminderWorker] Polling interval: ${POLL_INTERVAL_MS / 1000}s`);

  // Run immediately on startup
  pollReminders();

  // Then run on interval
  setInterval(pollReminders, POLL_INTERVAL_MS);
}
