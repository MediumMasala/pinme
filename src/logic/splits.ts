import { prisma } from '../db.js';
import { SplitStatus } from '../types/index.js';
import { findOrCreateContactsForSplit } from './contacts.js';
import type { SplitBillInput } from '../types/index.js';

export interface SplitResult {
  billSplitId: number;
  expenseId: number;
  totalAmount: string;
  amountPerPerson: string;
  payerName: string | null;
  participants: Array<{
    contactId: number;
    name: string | null;
    phoneNumber: string;
    amount: string;
    status: string;
  }>;
}

export async function createBillSplit(input: SplitBillInput): Promise<SplitResult> {
  const payer = await prisma.user.findUnique({
    where: { phoneNumber: input.payerPhone },
  });

  if (!payer) {
    throw new Error(`Payer not found for phone: ${input.payerPhone}`);
  }

  const expense = await prisma.expense.findUnique({
    where: { id: input.expenseId },
  });

  if (!expense) {
    throw new Error(`Expense not found: ${input.expenseId}`);
  }

  if (expense.userId !== payer.id) {
    throw new Error('Expense does not belong to this user');
  }

  const existingSplit = await prisma.billSplit.findUnique({
    where: { expenseId: input.expenseId },
  });

  if (existingSplit) {
    throw new Error('This expense has already been split');
  }

  const contacts = await findOrCreateContactsForSplit(input.payerPhone, input.contacts);

  const totalPeople = contacts.length + 1;
  const totalAmount = expense.amount;
  const amountPerPerson = totalAmount.div(totalPeople).toDecimalPlaces(2);

  const billSplit = await prisma.billSplit.create({
    data: {
      expenseId: expense.id,
      payerUserId: payer.id,
      totalAmount,
      amountPerPerson,
      participants: {
        create: contacts.map((contact) => ({
          contactId: contact.id,
          amount: amountPerPerson,
          status: SplitStatus.PENDING,
        })),
      },
    },
    include: {
      participants: {
        include: {
          contact: true,
        },
      },
    },
  });

  return {
    billSplitId: billSplit.id,
    expenseId: billSplit.expenseId,
    totalAmount: billSplit.totalAmount.toString(),
    amountPerPerson: billSplit.amountPerPerson.toString(),
    payerName: payer.name,
    participants: billSplit.participants.map((p) => ({
      contactId: p.contactId,
      name: p.contact.name,
      phoneNumber: p.contact.phoneNumber,
      amount: p.amount.toString(),
      status: p.status,
    })),
  };
}

export async function getSplitByExpenseId(expenseId: number): Promise<SplitResult | null> {
  const split = await prisma.billSplit.findUnique({
    where: { expenseId },
    include: {
      payer: true,
      participants: {
        include: {
          contact: true,
        },
      },
    },
  });

  if (!split) return null;

  return {
    billSplitId: split.id,
    expenseId: split.expenseId,
    totalAmount: split.totalAmount.toString(),
    amountPerPerson: split.amountPerPerson.toString(),
    payerName: split.payer.name,
    participants: split.participants.map((p) => ({
      contactId: p.contactId,
      name: p.contact.name,
      phoneNumber: p.contact.phoneNumber,
      amount: p.amount.toString(),
      status: p.status,
    })),
  };
}

export async function updateParticipantStatus(
  billSplitId: number,
  contactId: number,
  status: typeof SplitStatus[keyof typeof SplitStatus]
): Promise<void> {
  await prisma.billSplitParticipant.update({
    where: {
      billSplitId_contactId: {
        billSplitId,
        contactId,
      },
    },
    data: { status },
  });
}
