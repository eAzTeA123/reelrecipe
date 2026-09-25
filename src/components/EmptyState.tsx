export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 py-14 text-center">
      {icon && <div className="mb-1 text-ink-3">{icon}</div>}
      <p className="text-[19px] font-bold text-ink">{title}</p>
      {subtitle && <p className="max-w-72 text-[15px] text-ink-2">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
