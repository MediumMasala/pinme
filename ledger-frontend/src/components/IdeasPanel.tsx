import type { IdeasData } from '../types';

interface IdeasPanelProps {
  ideas: IdeasData;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function truncateContent(content: string, maxLength: number = 150): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength).trim() + '...';
}

export default function IdeasPanel({ ideas }: IdeasPanelProps) {
  if (ideas.total === 0) {
    return (
      <div className="mt-6">
        <h3 className="text-base font-semibold text-gray-900 mb-3">
          Ideas shared with PinMe
        </h3>
        <div className="bg-gray-50 rounded-xl p-6 text-center">
          <div className="text-4xl mb-3">💡</div>
          <p className="text-gray-600 text-sm">
            You haven't shared any ideas or links with PinMe yet.
          </p>
          <p className="text-gray-500 text-xs mt-2">
            Drop your ideas on WhatsApp and they'll start showing up here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-900">
          Ideas shared with PinMe
        </h3>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          {ideas.total} idea{ideas.total !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-3">
        {ideas.items.map((idea) => (
          <div
            key={idea.id}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
          >
            {/* Content */}
            <p className="text-gray-800 text-sm leading-relaxed">
              {truncateContent(idea.content)}
            </p>

            {/* URL if present */}
            {idea.sourceUrl && (
              <a
                href={idea.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-primary-600 hover:text-primary-700"
              >
                <span>🔗</span>
                <span className="underline truncate max-w-[200px]">
                  {idea.sourceUrl.replace(/^https?:\/\//, '').substring(0, 30)}
                  {idea.sourceUrl.length > 30 ? '...' : ''}
                </span>
              </a>
            )}

            {/* Tags and Date */}
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50">
              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                {idea.tags.slice(0, 3).map((tag, index) => (
                  <span
                    key={index}
                    className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
                {idea.tags.length > 3 && (
                  <span className="text-xs text-gray-400">
                    +{idea.tags.length - 3}
                  </span>
                )}
              </div>

              {/* Date */}
              <span className="text-xs text-gray-400">
                {formatDate(idea.createdAt)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {ideas.total > ideas.items.length && (
        <p className="text-center text-xs text-gray-400 mt-4">
          Showing {ideas.items.length} of {ideas.total} ideas
        </p>
      )}
    </div>
  );
}
