import type { LedgerData } from '../types';
import SummaryCards from './SummaryCards';
import CategoryBreakdown from './CategoryBreakdown';
import DayBreakdown from './DayBreakdown';
import TransactionsList from './TransactionsList';
import IdeasPanel from './IdeasPanel';

interface LedgerViewProps {
  data: LedgerData;
  onRefresh: () => void;
}

export default function LedgerView({ data, onRefresh }: LedgerViewProps) {
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

      <SummaryCards summary={data.summary} userName={data.user.name} />

      <CategoryBreakdown categories={data.byCategory} total={data.summary.totalAmount} />

      <DayBreakdown days={data.byDay} />

      <TransactionsList transactions={data.transactions} />

      <IdeasPanel ideas={data.ideas} />
    </div>
  );
}
