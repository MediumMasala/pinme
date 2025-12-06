import { useState } from 'react';
import type { Transaction } from '../types';

interface TransactionsListProps {
  transactions: Transaction[];
}

const CATEGORY_EMOJIS: Record<string, string> = {
  food: '&#127829;',
  transport: '&#128663;',
  shopping: '&#128717;',
  entertainment: '&#127910;',
  bills: '&#128193;',
  health: '&#128138;',
  education: '&#128218;',
  travel: '&#128747;',
  other: '&#128178;',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateOnly = dateStr.split('T')[0];
  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (dateOnly === todayStr) return 'Today';
  if (dateOnly === yesterdayStr) return 'Yesterday';

  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}

function getEmoji(category: string): string {
  return CATEGORY_EMOJIS[category.toLowerCase()] || CATEGORY_EMOJIS.other;
}

function groupByDate(transactions: Transaction[]): Record<string, Transaction[]> {
  const groups: Record<string, Transaction[]> = {};
  for (const tx of transactions) {
    const dateKey = tx.expenseDatetime.split('T')[0];
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(tx);
  }
  return groups;
}

export default function TransactionsList({ transactions }: TransactionsListProps) {
  const [expanded, setExpanded] = useState(false);

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
        <div className="text-4xl mb-2">&#128176;</div>
        <p className="text-gray-600">No transactions yet</p>
        <p className="text-gray-400 text-sm mt-1">
          Your expenses will appear here
        </p>
      </div>
    );
  }

  const displayTransactions = expanded ? transactions : transactions.slice(0, 10);
  const grouped = groupByDate(displayTransactions);
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Recent Transactions</h3>
      </div>

      <div className="divide-y divide-gray-50">
        {sortedDates.map((date) => (
          <div key={date}>
            <div className="px-4 py-2 bg-gray-50/50">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {formatDateHeader(grouped[date][0].expenseDatetime)}
              </span>
            </div>
            {grouped[date].map((tx) => (
              <div
                key={tx.id}
                className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg flex-shrink-0"
                  dangerouslySetInnerHTML={{ __html: getEmoji(tx.category) }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {tx.description}
                  </p>
                  <p className="text-xs text-gray-500">
                    <span className="capitalize">{tx.category}</span>
                    <span className="mx-1">•</span>
                    {formatTime(tx.expenseDatetime)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-semibold ${tx.isReimbursement ? 'text-green-600' : 'text-gray-900'}`}>
                    {tx.isReimbursement ? '+' : ''}{formatCurrency(tx.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {transactions.length > 10 && !expanded && (
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={() => setExpanded(true)}
            className="w-full text-sm text-primary-600 hover:text-primary-700 font-medium py-2"
          >
            Show all {transactions.length} transactions
          </button>
        </div>
      )}
    </div>
  );
}
