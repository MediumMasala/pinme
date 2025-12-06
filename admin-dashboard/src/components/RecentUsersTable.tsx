import { useState } from 'react';
import type { DashboardRecentUser } from '../types';

interface RecentUsersTableProps {
  users: DashboardRecentUser[];
  onDeleteUser?: (phoneNumber: string) => Promise<void>;
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

export function RecentUsersTable({ users, onDeleteUser }: RecentUsersTableProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const handleDelete = async (user: DashboardRecentUser) => {
    if (!onDeleteUser) return;

    setDeletingId(user.id);
    try {
      await onDeleteUser(user.phoneNumber);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };
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
            {onDeleteUser && <th className="pb-2 font-medium text-center">Actions</th>}
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
              {onDeleteUser && (
                <td className="py-3 text-center">
                  {confirmDeleteId === user.id ? (
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleDelete(user)}
                        disabled={deletingId === user.id}
                        className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:opacity-50"
                      >
                        {deletingId === user.id ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={deletingId === user.id}
                        className="px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded hover:bg-slate-300 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(user.id)}
                      className="px-2 py-1 bg-red-100 text-red-600 text-xs rounded hover:bg-red-200 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
