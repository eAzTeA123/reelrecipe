export function PageHeader({
  title,
  subtitle,
  action,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Kleine Zeile über dem Titel, z. B. die Kategorie oder ein Hinweis. */
  eyebrow?: string;
}) {
  return (
    <header className="mb-7 flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 text-label font-semibold uppercase text-accent">{eyebrow}</p>
        )}
        <h1 className="font-display text-title text-ink">{title}</h1>
        {subtitle && <p className="mt-2 max-w-prose text-body text-ink-2">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 pt-1.5">{action}</div>}
    </header>
  );
}
