import { useState } from 'react';
import type { LedgerData } from '../types';
import SummaryCards from './SummaryCards';
import CategoryBreakdown from './CategoryBreakdown';
import DayBreakdown from './DayBreakdown';
import TransactionsList from './TransactionsList';
import IdeasPanel from './IdeasPanel';
import RemindersPanel from './RemindersPanel';

type TabType = 'EXPENSES' | 'IDEAS' | 'REMINDERS';

interface LedgerViewProps {
  data: LedgerData;
  onRefresh: () => void;
}

export default function LedgerView({ data, onRefresh }: LedgerViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('EXPENSES');

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Your Ledger</h2>
        <button
          onClick={onRefresh}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
        >
          <span>&#8635;</span> Refresh
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-gray-200 mb-4">
        <button
          className={`flex-1 py-2.5 text-center text-sm font-medium transition-colors ${
            activeTab === 'EXPENSES'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('EXPENSES')}
        >
          Expenses
        </button>
        <button
          className={`flex-1 py-2.5 text-center text-sm font-medium transition-colors ${
            activeTab === 'IDEAS'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('IDEAS')}
        >
          Ideas
          {data.ideas.total > 0 && (
            <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
              {data.ideas.total}
            </span>
          )}
        </button>
        <button
          className={`flex-1 py-2.5 text-center text-sm font-medium transition-colors ${
            activeTab === 'REMINDERS'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('REMINDERS')}
        >
          Reminders
          {data.reminders.total > 0 && (
            <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
              {data.reminders.total}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'EXPENSES' && (
        <>
          <SummaryCards summary={data.summary} userName={data.user.name} />
          <CategoryBreakdown categories={data.byCategory} total={data.summary.totalAmount} />
          <DayBreakdown days={data.byDay} />
          <TransactionsList transactions={data.transactions} />
        </>
      )}

      {activeTab === 'IDEAS' && (
        <IdeasPanel ideas={data.ideas} />
      )}

      {activeTab === 'REMINDERS' && (
        <RemindersPanel reminders={data.reminders} />
      )}
    </div>
  );
}
