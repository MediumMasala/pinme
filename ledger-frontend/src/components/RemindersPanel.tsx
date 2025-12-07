import type { RemindersData } from '../types';

interface RemindersPanelProps {
  reminders: RemindersData;
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'UPCOMING':
      return 'text-emerald-600 bg-emerald-50';
    case 'SENT':
      return 'text-sky-600 bg-sky-50';
    case 'CANCELLED':
      return 'text-rose-600 bg-rose-50';
    case 'OVERDUE':
      return 'text-amber-600 bg-amber-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'UPCOMING':
      return '⏰';
    case 'SENT':
      return '✅';
    case 'CANCELLED':
      return '❌';
    case 'OVERDUE':
      return '⚠️';
    default:
      return '📝';
  }
}

export default function RemindersPanel({ reminders }: RemindersPanelProps) {
  if (reminders.total === 0) {
    return (
      <div className="mt-6">
        <h3 className="text-base font-semibold text-gray-900 mb-3">
          Reminders
        </h3>
        <div className="bg-gray-50 rounded-xl p-6 text-center">
          <div className="text-4xl mb-3">⏰</div>
          <p className="text-gray-600 text-sm">
            You don't have any reminders yet.
          </p>
          <p className="text-gray-500 text-xs mt-2">
            Ask PinMe on WhatsApp to set one, e.g. "Remind me to pay rent on 5th"
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-900">
          Reminders
        </h3>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          {reminders.total} reminder{reminders.total !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-3">
        {reminders.items.map((reminder) => (
          <div
            key={reminder.id}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
          >
            {/* Status Badge */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-gray-800 text-sm leading-relaxed flex-1">
                {reminder.text}
              </p>
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${getStatusColor(
                  reminder.status
                )}`}
              >
                {getStatusIcon(reminder.status)} {reminder.status}
              </span>
            </div>

            {/* Times */}
            <div className="text-xs text-gray-500 space-y-1 mt-3 pt-2 border-t border-gray-50">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-600">Remind at:</span>
                <span>{formatDateTime(reminder.remindAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-600">Created:</span>
                <span>{formatDateTime(reminder.createdAt)}</span>
              </div>
              {reminder.sentAt && (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-600">Sent:</span>
                  <span>{formatDateTime(reminder.sentAt)}</span>
                </div>
              )}
              {reminder.cancelledAt && (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-600">Cancelled:</span>
                  <span>{formatDateTime(reminder.cancelledAt)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {reminders.total > reminders.items.length && (
        <p className="text-center text-xs text-gray-400 mt-4">
          Showing {reminders.items.length} of {reminders.total} reminders
        </p>
      )}
    </div>
  );
}
