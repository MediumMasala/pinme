// src/auth/otp.ts
// LEDGER MODULE - OTP Authentication Helpers
import crypto from 'crypto';
import { prisma } from '../db.js';
import { whatsappClient } from '../whatsapp/client.js';

const OTP_EXPIRY_MINUTES = 5;

/**
 * Generate a 6-digit numeric OTP
 */
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Hash an OTP code using SHA-256
 */
function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Create and send OTP for a phone number
 * @throws Error if user not found or not onboarded
 */
export async function createOtpForPhone(phoneNumber: string): Promise<void> {
  // Validate that user exists and is onboarded
  const user = await prisma.user.findUnique({
    where: { phoneNumber },
    select: { id: true, onboarded: true, name: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (!user.onboarded) {
    throw new Error('User not onboarded');
  }

  // Generate OTP
  const otp = generateOtp();
  const codeHash = hashCode(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Invalidate any existing unused tokens for this phone
  await prisma.loginToken.updateMany({
    where: {
      phoneNumber,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: {
      expiresAt: new Date(), // Expire them immediately
    },
  });

  // Store the new token
  await prisma.loginToken.create({
    data: {
      phoneNumber,
      codeHash,
      expiresAt,
    },
  });

  // Send OTP via WhatsApp
  const message = `🔐 Your PinMe ledger login code is: *${otp}*

Valid for ${OTP_EXPIRY_MINUTES} minutes. Don't share it with anyone.`;

  await whatsappClient.sendTextMessage(phoneNumber, message);
}

/**
 * Verify OTP and return the user if valid
 * @returns User object if valid, null if invalid/expired
 */
export async function verifyOtp(
  phoneNumber: string,
  submittedCode: string
): Promise<{ id: number; phoneNumber: string; name: string | null } | null> {
  const codeHash = hashCode(submittedCode);

  // Find the latest valid token for this phone
  const token = await prisma.loginToken.findFirst({
    where: {
      phoneNumber,
      codeHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!token) {
    return null;
  }

  // Mark token as used
  await prisma.loginToken.update({
    where: { id: token.id },
    data: { usedAt: new Date() },
  });

  // Get and return the user
  const user = await prisma.user.findUnique({
    where: { phoneNumber },
    select: { id: true, phoneNumber: true, name: true },
  });

  return user;
}

/**
 * Clean up expired tokens (can be called periodically)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.loginToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { usedAt: { not: null } },
      ],
    },
  });
  return result.count;
}
