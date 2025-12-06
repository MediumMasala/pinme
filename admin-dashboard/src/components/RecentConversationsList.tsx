import type { DashboardRecentConversation } from '../types';

interface RecentConversationsListProps {
  conversations: DashboardRecentConversation[];
}

function formatTime(isoString: string): string {
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

export function RecentConversationsList({ conversations }: RecentConversationsListProps) {
  if (conversations.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        No recent conversations yet
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[500px] overflow-y-auto">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700 text-sm">
                  {conv.userName !== 'Unknown' ? conv.userName : conv.phoneNumber}
                </span>
                {conv.userName !== 'Unknown' && (
                  <span className="text-xs text-slate-400 font-mono">
                    {conv.phoneNumber}
                  </span>
                )}
              </div>
              <p className="text-slate-600 text-sm mt-1 truncate">
                {conv.messageText}
              </p>
            </div>
            <span className="text-xs text-slate-400 whitespace-nowrap">
              {formatTime(conv.timestamp)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
