import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { IconX } from "./Icons";

export function ErrorState({
  title = "Etwas hat nicht funktioniert",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-card bg-surface shadow-card" role="alert">
      <EmptyState
        icon={<IconX size={38} />}
        title={title}
        subtitle={message ?? "Bitte versuche es erneut."}
        action={onRetry ? <Button variant="secondary" onClick={onRetry}>Erneut versuchen</Button> : undefined}
      />
    </div>
  );
}
