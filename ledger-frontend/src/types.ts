export interface LedgerUser {
  name: string | null;
  phoneNumber: string;
}

export interface LedgerSummary {
  totalAmount: number;
  currency: string;
  since: string | null;
  expenseCount: number;
}

export interface CategoryData {
  category: string;
  totalAmount: number;
  count: number;
}

export interface DayData {
  date: string;
  totalAmount: number;
  count: number;
}

export interface Transaction {
  id: number;
  amount: number;
  currency: string;
  category: string;
  description: string;
  isReimbursement: boolean;
  createdAt: string;
  expenseDatetime: string;
}

export interface IdeaItem {
  id: number;
  content: string;
  sourceUrl: string | null;
  tags: string[];
  createdAt: string;
}

export interface IdeasData {
  total: number;
  items: IdeaItem[];
}

export interface ReminderItem {
  id: number;
  text: string;
  remindAt: string;
  createdAt: string;
  sentAt: string | null;
  cancelledAt: string | null;
  status: 'UPCOMING' | 'SENT' | 'CANCELLED' | 'OVERDUE';
}

export interface RemindersData {
  total: number;
  items: ReminderItem[];
}

export interface LedgerData {
  user: LedgerUser;
  summary: LedgerSummary;
  byCategory: CategoryData[];
  byDay: DayData[];
  transactions: Transaction[];
  ideas: IdeasData;
  reminders: RemindersData;
}

export type AuthState = 'loading' | 'phone' | 'otp' | 'authenticated';
