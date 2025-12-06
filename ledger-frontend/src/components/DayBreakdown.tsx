import type { DayData } from '../types';

interface DayBreakdownProps {
  days: DayData[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDay(dateStr: string): { day: string; date: string } {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = dateStr === today.toISOString().split('T')[0];
  const isYesterday = dateStr === yesterday.toISOString().split('T')[0];

  if (isToday) return { day: 'Today', date: '' };
  if (isYesterday) return { day: 'Yesterday', date: '' };

  return {
    day: date.toLocaleDateString('en-IN', { weekday: 'short' }),
    date: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
  };
}

export default function DayBreakdown({ days }: DayBreakdownProps) {
  if (days.length === 0) {
    return null;
  }

  const maxAmount = Math.max(...days.map((d) => d.totalAmount));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
      <h3 className="font-semibold text-gray-900 mb-3">Daily Spending</h3>

      <div className="space-y-2">
        {days.slice(0, 7).map((day) => {
          const { day: dayLabel, date } = formatDay(day.date);
          const barWidth = maxAmount > 0 ? (day.totalAmount / maxAmount) * 100 : 0;

          return (
            <div key={day.date} className="flex items-center gap-3">
              <div className="w-20 flex-shrink-0">
                <span className="text-sm font-medium text-gray-700">{dayLabel}</span>
                {date && <span className="text-xs text-gray-400 ml-1">{date}</span>}
              </div>
              <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden relative">
                <div
                  className="h-full bg-primary-400 rounded-md transition-all duration-500"
                  style={{ width: `${Math.max(barWidth, 3)}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-medium text-gray-600">
                  {formatCurrency(day.totalAmount)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {days.length > 7 && (
        <p className="text-xs text-gray-500 mt-3 text-center">
          Showing last 7 days
        </p>
      )}
    </div>
  );
}
