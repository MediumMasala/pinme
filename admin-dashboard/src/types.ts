export interface DashboardOverviewUsers {
  total: number;
  onboarded: number;
  newLast24h: number;
  newLast7d: number;
  activeLast24h: number;
  activeLast7d: number;
}

export interface DashboardOverviewMessages {
  total: number;
  inbound: number;
  outbound: number;
  today: number;
  last24h: number;
}

export interface DashboardOverviewExpenses {
  total: number;
  today: number;
  last7d: number;
  last30d: number;
  totalAmount: string;
  reimbursable: number;
}

export interface DashboardOverview {
  users: DashboardOverviewUsers;
  messages: DashboardOverviewMessages;
  expenses: DashboardOverviewExpenses;
}

export interface DashboardExpenseByCategory {
  category: string;
  count: number;
  totalAmount: string;
}

export interface DashboardRecentUserCount {
  expenses: number;
  messageLogs: number;
  contacts: number;
}

export interface DashboardRecentUser {
  id: number;
  phoneNumber: string;
  name: string | null;
  onboarded: boolean;
  createdAt: string;
  updatedAt: string;
  _count: DashboardRecentUserCount;
}

export interface DashboardRecentConversation {
  id: number;
  userId: number | null;
  phoneNumber: string;
  userName: string;
  messageText: string;
  timestamp: string;
}

export interface DashboardRecentExpense {
  id: number;
  amount: string;
  currency: string;
  category: string;
  description: string;
  isReimbursement: boolean;
  userName: string;
  phoneNumber: string;
  createdAt: string;
}

export interface DashboardData {
  success: boolean;
  generatedAt: string;
  overview: DashboardOverview;
  expensesByCategory: DashboardExpenseByCategory[];
  recentUsers: DashboardRecentUser[];
  recentConversations: DashboardRecentConversation[];
  recentExpenses: DashboardRecentExpense[];
}
