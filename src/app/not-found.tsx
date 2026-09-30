import Link from "next/link";
import { Button } from "@/components/Button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="font-display text-h1">Seite nicht gefunden</p>
      <p className="text-body text-ink-2">Diese Seite existiert nicht.</p>
      <Link href="/">
        <Button variant="secondary">Zur Startseite</Button>
      </Link>
    </div>
  );
}
