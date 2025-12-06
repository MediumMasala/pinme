import type { DashboardExpenseByCategory } from '../types';

interface ExpensesByCategoryBarProps {
  categories: DashboardExpenseByCategory[];
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `₹${num.toLocaleString('en-IN')}`;
}

const categoryColors: Record<string, string> = {
  FOOD: 'bg-orange-500',
  TRAVEL: 'bg-blue-500',
  GROCERIES: 'bg-green-500',
  SHOPPING: 'bg-purple-500',
  BILLS: 'bg-red-500',
  OTHER: 'bg-slate-500',
};

export function ExpensesByCategoryBar({ categories }: ExpensesByCategoryBarProps) {
  if (categories.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        No category data yet
      </div>
    );
  }

  const maxAmount = Math.max(
    ...categories.map((c) => parseFloat(c.totalAmount) || 0)
  );

  return (
    <div className="space-y-4">
      {categories.map((category) => {
        const amount = parseFloat(category.totalAmount) || 0;
        const percentage = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
        const colorClass = categoryColors[category.category] || categoryColors.OTHER;

        return (
          <div key={category.category} className="space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-slate-700">{category.category}</span>
              <div className="text-slate-500">
                <span className="font-medium text-slate-700">{formatCurrency(category.totalAmount)}</span>
                <span className="text-slate-400 ml-2">({category.count} items)</span>
              </div>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${colorClass} rounded-full transition-all duration-500`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
