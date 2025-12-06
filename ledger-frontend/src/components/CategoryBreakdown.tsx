import type { CategoryData } from '../types';

interface CategoryBreakdownProps {
  categories: CategoryData[];
  total: number;
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

function getEmoji(category: string): string {
  return CATEGORY_EMOJIS[category.toLowerCase()] || CATEGORY_EMOJIS.other;
}

export default function CategoryBreakdown({ categories, total }: CategoryBreakdownProps) {
  if (categories.length === 0) {
    return null;
  }

  const sortedCategories = [...categories].sort((a, b) => b.totalAmount - a.totalAmount);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
      <h3 className="font-semibold text-gray-900 mb-3">By Category</h3>

      <div className="space-y-3">
        {sortedCategories.map((cat) => {
          const percentage = total > 0 ? (cat.totalAmount / total) * 100 : 0;

          return (
            <div key={cat.category}>
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-2 text-sm">
                  <span dangerouslySetInnerHTML={{ __html: getEmoji(cat.category) }} />
                  <span className="capitalize">{cat.category}</span>
                  <span className="text-gray-400 text-xs">({cat.count})</span>
                </span>
                <span className="text-sm font-medium">{formatCurrency(cat.totalAmount)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(percentage, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
