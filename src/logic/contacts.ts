import { prisma } from '../db.js';
import type { SaveContactsInput, ContactInput } from '../types/index.js';
import { RelationshipType } from '../types/index.js';

export interface ContactResult {
  id: number;
  name: string | null;
  phoneNumber: string;
  relationshipType: string;
}

export async function upsertContacts(input: SaveContactsInput): Promise<ContactResult[]> {
  const user = await prisma.user.findUnique({
    where: { phoneNumber: input.ownerPhone },
  });

  if (!user) {
    throw new Error(`User not found for phone: ${input.ownerPhone}`);
  }

  const results: ContactResult[] = [];

  for (const contact of input.contacts) {
    const upserted = await prisma.contact.upsert({
      where: {
        userId_phoneNumber: {
          userId: user.id,
          phoneNumber: normalizePhoneNumber(contact.phone),
        },
      },
      update: {
        name: contact.name ?? undefined,
        relationshipType: contact.relationshipType ?? undefined,
      },
      create: {
        userId: user.id,
        phoneNumber: normalizePhoneNumber(contact.phone),
        name: contact.name,
        relationshipType: contact.relationshipType ?? RelationshipType.FRIEND,
      },
    });

    results.push({
      id: upserted.id,
      name: upserted.name,
      phoneNumber: upserted.phoneNumber,
      relationshipType: upserted.relationshipType,
    });
  }

  return results;
}

export async function getContactsForUser(ownerPhone: string): Promise<ContactResult[]> {
  const user = await prisma.user.findUnique({
    where: { phoneNumber: ownerPhone },
    include: { contacts: true },
  });

  if (!user) return [];

  return user.contacts.map((c) => ({
    id: c.id,
    name: c.name,
    phoneNumber: c.phoneNumber,
    relationshipType: c.relationshipType,
  }));
}

export async function findOrCreateContactsForSplit(
  ownerPhone: string,
  contacts: ContactInput[]
): Promise<ContactResult[]> {
  return upsertContacts({ ownerPhone, contacts });
}

function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('0')) {
    cleaned = '91' + cleaned.slice(1);
  }

  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }

  return cleaned;
}

export { normalizePhoneNumber };
