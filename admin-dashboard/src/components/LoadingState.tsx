export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
      <p className="text-slate-500 text-sm">Loading dashboard data...</p>
    </div>
  );
}
