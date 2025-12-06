import type { DashboardRecentExpense } from '../types';

interface RecentExpensesTableProps {
  expenses: DashboardRecentExpense[];
}

function formatCurrency(amount: string | number, currency: string = 'INR'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  const symbol = currency === 'INR' ? '₹' : currency;
  return `${symbol}${num.toLocaleString('en-IN')}`;
}

function formatDateTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return isoString;
  }
}

const categoryColors: Record<string, string> = {
  FOOD: 'bg-orange-100 text-orange-700',
  TRAVEL: 'bg-blue-100 text-blue-700',
  GROCERIES: 'bg-green-100 text-green-700',
  SHOPPING: 'bg-purple-100 text-purple-700',
  BILLS: 'bg-red-100 text-red-700',
  OTHER: 'bg-slate-100 text-slate-700',
};

export function RecentExpensesTable({ expenses }: RecentExpensesTableProps) {
  if (expenses.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        No recent expenses yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-100">
            <th className="pb-2 font-medium">User</th>
            <th className="pb-2 font-medium">Amount</th>
            <th className="pb-2 font-medium">Category</th>
            <th className="pb-2 font-medium">Description</th>
            <th className="pb-2 font-medium">Type</th>
            <th className="pb-2 font-medium">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {expenses.map((expense) => (
            <tr key={expense.id} className="hover:bg-slate-50">
              <td className="py-3">
                <div>
                  <p className="font-medium text-slate-700">
                    {expense.userName || 'Unknown'}
                  </p>
                  <p className="text-xs text-slate-400 font-mono">
                    {expense.phoneNumber}
                  </p>
                </div>
              </td>
              <td className="py-3 font-semibold text-slate-800">
                {formatCurrency(expense.amount, expense.currency)}
              </td>
              <td className="py-3">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    categoryColors[expense.category] || categoryColors.OTHER
                  }`}
                >
                  {expense.category}
                </span>
              </td>
              <td className="py-3 text-slate-600 max-w-[200px] truncate">
                {expense.description}
              </td>
              <td className="py-3">
                {expense.isReimbursement ? (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    Reimbursable
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs font-medium">
                    Personal
                  </span>
                )}
              </td>
              <td className="py-3 text-slate-500 text-xs">
                {formatDateTime(expense.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
