import type { DashboardRecentUser } from '../types';

interface RecentUsersTableProps {
  users: DashboardRecentUser[];
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

export function RecentUsersTable({ users }: RecentUsersTableProps) {
  if (users.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        No recent users yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-100">
            <th className="pb-2 font-medium">Name</th>
            <th className="pb-2 font-medium">Phone</th>
            <th className="pb-2 font-medium">Status</th>
            <th className="pb-2 font-medium">Created</th>
            <th className="pb-2 font-medium text-center">Expenses</th>
            <th className="pb-2 font-medium text-center">Messages</th>
            <th className="pb-2 font-medium text-center">Contacts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-slate-50">
              <td className="py-3 font-medium text-slate-700">
                {user.name || 'Unknown'}
              </td>
              <td className="py-3 text-slate-600 font-mono text-xs">
                {user.phoneNumber}
              </td>
              <td className="py-3">
                {user.onboarded ? (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    Onboarded
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                    Pending
                  </span>
                )}
              </td>
              <td className="py-3 text-slate-500 text-xs">
                {formatDateTime(user.createdAt)}
              </td>
              <td className="py-3 text-center text-slate-600">
                {user._count.expenses}
              </td>
              <td className="py-3 text-center text-slate-600">
                {user._count.messageLogs}
              </td>
              <td className="py-3 text-center text-slate-600">
                {user._count.contacts}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
