import { prisma } from '../db.js';
import type { CreateUserInput } from '../types/index.js';
import { config } from '../config.js';
import { normalizePhoneNumber } from './contacts.js';

export interface UserResult {
  id: number;
  phoneNumber: string;
  name: string | null;
  onboarded: boolean;
  timezone: string;
}

export async function findUserByPhone(phoneNumber: string): Promise<UserResult | null> {
  const normalized = normalizePhoneNumber(phoneNumber);
  const user = await prisma.user.findUnique({
    where: { phoneNumber: normalized },
  });

  if (!user) return null;

  return {
    id: user.id,
    phoneNumber: user.phoneNumber,
    name: user.name,
    onboarded: user.onboarded,
    timezone: user.timezone,
  };
}

export async function createUser(input: CreateUserInput): Promise<UserResult> {
  const normalized = normalizePhoneNumber(input.phoneNumber);

  const user = await prisma.user.create({
    data: {
      phoneNumber: normalized,
      name: input.name,
      onboarded: false,
      timezone: config.business.defaultTimezone,
    },
  });

  return {
    id: user.id,
    phoneNumber: user.phoneNumber,
    name: user.name,
    onboarded: user.onboarded,
    timezone: user.timezone,
  };
}

export async function updateUserName(phoneNumber: string, name: string): Promise<UserResult> {
  const normalized = normalizePhoneNumber(phoneNumber);

  const user = await prisma.user.update({
    where: { phoneNumber: normalized },
    data: { name },
  });

  return {
    id: user.id,
    phoneNumber: user.phoneNumber,
    name: user.name,
    onboarded: user.onboarded,
    timezone: user.timezone,
  };
}

export async function markUserOnboarded(phoneNumber: string): Promise<UserResult> {
  const normalized = normalizePhoneNumber(phoneNumber);

  const user = await prisma.user.update({
    where: { phoneNumber: normalized },
    data: { onboarded: true },
  });

  return {
    id: user.id,
    phoneNumber: user.phoneNumber,
    name: user.name,
    onboarded: user.onboarded,
    timezone: user.timezone,
  };
}

export async function getOrCreateUser(phoneNumber: string): Promise<UserResult> {
  const existing = await findUserByPhone(phoneNumber);
  if (existing) return existing;

  return createUser({ phoneNumber });
}
