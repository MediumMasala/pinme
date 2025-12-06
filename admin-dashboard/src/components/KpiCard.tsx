interface SecondaryValue {
  label: string;
  value: string | number;
}

interface KpiCardProps {
  title: string;
  primaryValue: string | number;
  subLabel?: string;
  secondaryValues?: SecondaryValue[];
  icon?: string;
}

export function KpiCard({ title, primaryValue, subLabel, secondaryValues, icon }: KpiCardProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">{title}</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{primaryValue}</p>
          {subLabel && (
            <p className="text-xs text-slate-400 mt-1">{subLabel}</p>
          )}
        </div>
        {icon && <span className="text-3xl">{icon}</span>}
      </div>

      {secondaryValues && secondaryValues.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
          {secondaryValues.map((item, index) => (
            <div key={index} className="text-sm">
              <span className="text-slate-400">{item.label}: </span>
              <span className="font-medium text-slate-600">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
