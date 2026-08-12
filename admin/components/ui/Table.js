export function Table({ children }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function TableHead({ children }) {
  return (
    <thead className="bg-slate-100 text-left text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
      <tr>{children}</tr>
    </thead>
  );
}

export function TableBody({ children }) {
  return <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">{children}</tbody>;
}

export function TableRow({ children, className = "" }) {
  return <tr className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${className}`}>{children}</tr>;
}
