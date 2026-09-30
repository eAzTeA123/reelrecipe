"use client";

import { useEffect } from "react";
import { Button } from "@/components/Button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("page error", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="font-display text-h1">Etwas ist schiefgelaufen</p>
      <p className="max-w-sm text-body text-ink-2">
        Die Seite konnte nicht geladen werden. Deine gespeicherten Rezepte sind davon nicht betroffen.
      </p>
      <Button variant="secondary" onClick={reset}>
        Erneut versuchen
      </Button>
    </div>
  );
}
