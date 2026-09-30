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
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      {icon && (
        <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-frame bg-surface-2 text-accent">
          {icon}
        </div>
      )}
      <p className="font-display text-h1 text-ink">{title}</p>
      {subtitle && <p className="max-w-[42ch] text-body text-ink-2">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
