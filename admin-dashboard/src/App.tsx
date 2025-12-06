import { useState, useEffect, useCallback } from 'react';
import { fetchDashboardData } from './api';
import type { DashboardData } from './types';
import {
  Layout,
  LoadingState,
  ErrorState,
  SectionCard,
  KpiCard,
  ExpensesByCategoryBar,
  RecentUsersTable,
  RecentConversationsList,
  RecentExpensesTable,
} from './components';

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `₹${num.toLocaleString('en-IN')}`;
}

function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const result = await fetchDashboardData();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    loadData(true);
  };

  if (loading) {
    return (
      <Layout>
        <LoadingState />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <ErrorState message={error} onRetry={() => loadData()} />
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <ErrorState message="No data available" onRetry={() => loadData()} />
      </Layout>
    );
  }

  const { overview, expensesByCategory, recentUsers, recentConversations, recentExpenses } = data;

  return (
    <Layout
      generatedAt={data.generatedAt}
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <KpiCard
          title="Total Users"
          primaryValue={overview.users.total}
          icon="👥"
          secondaryValues={[
            { label: 'Onboarded', value: overview.users.onboarded },
            { label: 'New (24h)', value: overview.users.newLast24h },
            { label: 'Active (24h)', value: overview.users.activeLast24h },
            { label: 'Active (7d)', value: overview.users.activeLast7d },
          ]}
        />

        <KpiCard
          title="Total Messages"
          primaryValue={overview.messages.total}
          icon="💬"
          secondaryValues={[
            { label: 'Inbound', value: overview.messages.inbound },
            { label: 'Outbound', value: overview.messages.outbound },
            { label: 'Today', value: overview.messages.today },
            { label: 'Last 24h', value: overview.messages.last24h },
          ]}
        />

        <KpiCard
          title="Total Expenses"
          primaryValue={overview.expenses.total}
          subLabel={`Total: ${formatCurrency(overview.expenses.totalAmount)}`}
          icon="💰"
          secondaryValues={[
            { label: 'Today', value: overview.expenses.today },
            { label: 'Last 7d', value: overview.expenses.last7d },
            { label: 'Last 30d', value: overview.expenses.last30d },
            { label: 'Reimbursable', value: overview.expenses.reimbursable },
          ]}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Expenses by Category */}
        <SectionCard title="Expenses by Category">
          <ExpensesByCategoryBar categories={expensesByCategory} />
        </SectionCard>

        {/* Recent Conversations */}
        <SectionCard title="Recent Conversations">
          <RecentConversationsList conversations={recentConversations} />
        </SectionCard>
      </div>

      {/* Recent Users */}
      <SectionCard title="Recent Users" className="mb-6">
        <RecentUsersTable users={recentUsers} />
      </SectionCard>

      {/* Recent Expenses */}
      <SectionCard title="Recent Expenses">
        <RecentExpensesTable expenses={recentExpenses} />
      </SectionCard>
    </Layout>
  );
}

export default App;
