import type { LedgerSummary } from '../types';

interface SummaryCardsProps {
  summary: LedgerSummary;
  userName: string | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function SummaryCards({ summary, userName }: SummaryCardsProps) {
  return (
    <div className="mb-6">
      {userName && (
        <p className="text-gray-600 mb-3">
          Welcome back, <span className="font-medium text-gray-900">{userName}</span>
        </p>
      )}

      <div className="bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl p-5 text-white shadow-lg">
        <p className="text-primary-100 text-sm font-medium uppercase tracking-wide">
          Total Expenses
        </p>
        <p className="text-3xl font-bold mt-1">
          {formatCurrency(summary.totalAmount)}
        </p>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-primary-400/30">
          <div>
            <p className="text-primary-100 text-xs">Transactions</p>
            <p className="font-semibold">{summary.expenseCount}</p>
          </div>
          <div className="text-right">
            <p className="text-primary-100 text-xs">Since</p>
            <p className="font-semibold">{formatDate(summary.since)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
