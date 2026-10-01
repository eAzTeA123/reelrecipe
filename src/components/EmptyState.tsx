export function EmptyState({
  icon,
  title,
  subtitle,
  action,
  iconTone = "accent",
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Farbe der Symbolfläche: Akzent für „noch leer", Ziegel für Fehler. */
  iconTone?: "accent" | "danger";
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-3 py-14 text-center">
      {icon && (
        <div
          className={`mb-2 flex h-16 w-16 items-center justify-center rounded-frame ${
            iconTone === "danger" ? "bg-danger/10 text-danger" : "bg-accent-soft text-accent-text"
          }`}
        >
          {icon}
        </div>
      )}
      <p className="font-display text-balance text-h1 text-ink">{title}</p>
      {subtitle && <p className="max-w-[46ch] text-body text-ink-2">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
