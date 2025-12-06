import type { ExpenseCategory, ExpenseSource, RelationshipType } from './enums.js';

export interface LogExpenseInput {
  userPhone: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  description: string;
  expenseDatetime: string;
  isReimbursement: boolean;
  rawMessageText?: string;
  source?: ExpenseSource;
  receiptMetadata?: Record<string, unknown>;
}

export interface MarkReimbursementInput {
  userPhone: string;
  expenseIds?: number[];
  strategy?: 'LAST' | 'ALL_MATCHING';
  filterText?: string;
  note?: string;
}

export interface ContactInput {
  phone: string;
  name?: string;
  relationshipType?: RelationshipType;
}

export interface SaveContactsInput {
  ownerPhone: string;
  contacts: ContactInput[];
}

export interface SplitBillInput {
  expenseId: number;
  payerPhone: string;
  contacts: ContactInput[];
}

export interface SendMessageInput {
  toPhone: string;
  text?: string;
  templateName?: string;
  templateVars?: Record<string, string>;
}

export interface CreateUserInput {
  phoneNumber: string;
  name?: string;
}

export interface CategoryBreakdown {
  category: string;
  total: number;
  count: number;
}

export interface DailySummaryData {
  date: string;
  totalAmount: number;
  categoryBreakdowns: CategoryBreakdown[];
  reimbursementTotal: number;
  reimbursements: Array<{
    description: string;
    amount: number;
  }>;
}

export interface NormalizedMessage {
  phoneNumber: string;
  messageText?: string;
  mediaType?: 'image' | 'document' | 'audio' | 'video';
  mediaId?: string;
  mediaUrl?: string;
  caption?: string;
  timestamp: Date;
  messageId: string;
}
