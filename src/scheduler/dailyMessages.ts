// src/scheduler/dailyMessages.ts
import cron from 'node-cron';
import { prisma } from '../db.js';
import { whatsappClient } from '../whatsapp/client.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Kolkata';

// Morning greeting messages (rotate randomly)
const MORNING_GREETINGS = [
  "Good morning! ☀️\nMain hoon, tera expense buddy.\nAaj jo bhi kharcha ho, bas mujhe bata dena.",
  "Namaste! 🙏\nPinMe ready hai aaj ke kharche track karne ke liye.\nBas message kar de amount ke saath.",
  "Hey! 👋\nTera personal accountant reporting for duty.\nAaj ka kharcha mujhe batate rehna!",
  "Good morning! 🌅\nYaad rakh, har chhota kharcha bhi matter karta hai.\nMujhe batate reh, main sab note karunga.",
  "Rise and shine! ✨\nAaj bhi main yahan hoon tera paisa track karne ke liye.\nKuch bhi spend kare, mujhe message kar dena.",
];

// Get random morning greeting
function getRandomGreeting(): string {
  return MORNING_GREETINGS[Math.floor(Math.random() * MORNING_GREETINGS.length)];
}

// Send morning reminder to all onboarded users
async function sendMorningReminders(): Promise<void> {
  console.log(`[${dayjs().tz(TZ).format()}] Running morning reminder job...`);

  try {
    // Get all onboarded users
    const users = await prisma.user.findMany({
      where: { onboarded: true },
      select: { id: true, phoneNumber: true, name: true },
    });

    console.log(`Found ${users.length} onboarded users for morning reminder`);

    for (const user of users) {
      try {
        const greeting = getRandomGreeting();
        await whatsappClient.sendTextMessage(user.phoneNumber, greeting);
        console.log(`Morning reminder sent to ${user.name || user.phoneNumber}`);

        // Small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to send morning reminder to ${user.phoneNumber}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in morning reminder job:', error);
  }
}

// Send end-of-day summary to all onboarded users
async function sendDailySummaries(): Promise<void> {
  console.log(`[${dayjs().tz(TZ).format()}] Running daily summary job...`);

  try {
    // Get all onboarded users
    const users = await prisma.user.findMany({
      where: { onboarded: true },
      select: { id: true, phoneNumber: true, name: true },
    });

    console.log(`Found ${users.length} onboarded users for daily summary`);

    const today = dayjs().tz(TZ);
    const startOfDay = today.startOf('day').toDate();
    const endOfDay = today.endOf('day').toDate();

    for (const user of users) {
      try {
        // Get today's expenses for this user
        const expenses = await prisma.expense.findMany({
          where: {
            userId: user.id,
            expenseDatetime: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
          orderBy: { expenseDatetime: 'desc' },
        });

        if (expenses.length === 0) {
          // No expenses today
          const noExpenseMsg = `Good night ${user.name || ''} 🌙\n\nAaj koi kharcha nahi hua - wallet safe hai!\nKal milte hain.`;
          await whatsappClient.sendTextMessage(user.phoneNumber, noExpenseMsg);
        } else {
          // Calculate totals
          let totalAmount = 0;
          let reimbursableTotal = 0;
          const categoryTotals: Record<string, { count: number; amount: number }> = {};
          const reimbursableItems: Array<{ description: string; amount: number }> = [];

          for (const expense of expenses) {
            const amount = Number(expense.amount);
            totalAmount += amount;

            if (expense.isReimbursement) {
              reimbursableTotal += amount;
              reimbursableItems.push({
                description: expense.description,
                amount,
              });
            }

            if (!categoryTotals[expense.category]) {
              categoryTotals[expense.category] = { count: 0, amount: 0 };
            }
            categoryTotals[expense.category].count += 1;
            categoryTotals[expense.category].amount += amount;
          }

          // Build summary message
          const dateStr = today.format('D MMM YYYY');
          let summaryMsg = `📒 *PinMe Summary - ${dateStr}*\n\n`;
          summaryMsg += `*Total spent:* ₹${totalAmount.toLocaleString('en-IN')}\n\n`;

          // Category breakdown
          for (const [category, data] of Object.entries(categoryTotals)) {
            summaryMsg += `• ${category}: ₹${data.amount.toLocaleString('en-IN')} (${data.count})\n`;
          }

          // Reimbursable section
          if (reimbursableTotal > 0) {
            summaryMsg += `\n*Reimbursement to claim:* ₹${reimbursableTotal.toLocaleString('en-IN')}\n`;
            for (const item of reimbursableItems) {
              summaryMsg += `  - ${item.description} – ₹${item.amount.toLocaleString('en-IN')}\n`;
            }
          }

          summaryMsg += `\nBaaki sab set. Good night 🌙`;

          await whatsappClient.sendTextMessage(user.phoneNumber, summaryMsg);
        }

        console.log(`Daily summary sent to ${user.name || user.phoneNumber}`);

        // Small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to send daily summary to ${user.phoneNumber}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in daily summary job:', error);
  }
}

// Initialize scheduled jobs
export function initializeScheduler(): void {
  console.log('Initializing scheduled jobs (IST timezone)...');

  // Morning reminder at 11:30 AM IST
  // Cron format: minute hour day month weekday
  // IST is UTC+5:30, so 11:30 AM IST = 6:00 AM UTC
  cron.schedule('0 6 * * *', () => {
    sendMorningReminders();
  }, {
    timezone: TZ,
  });
  console.log('✓ Morning reminder scheduled for 11:30 AM IST');

  // Daily summary at 11:30 PM IST
  // 11:30 PM IST = 6:00 PM UTC
  cron.schedule('30 23 * * *', () => {
    sendDailySummaries();
  }, {
    timezone: TZ,
  });
  console.log('✓ Daily summary scheduled for 11:30 PM IST');
}

// Export for manual testing
export { sendMorningReminders, sendDailySummaries };
