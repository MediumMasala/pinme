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

export interface LedgerData {
  user: LedgerUser;
  summary: LedgerSummary;
  byCategory: CategoryData[];
  byDay: DayData[];
  transactions: Transaction[];
}

export type AuthState = 'loading' | 'phone' | 'otp' | 'authenticated';
