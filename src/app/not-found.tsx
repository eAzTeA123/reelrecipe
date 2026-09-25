import Link from "next/link";
import { Button } from "@/components/Button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="text-[22px] font-bold">Seite nicht gefunden</p>
      <p className="text-[15px] text-ink-2">Diese Seite existiert nicht.</p>
      <Link href="/">
        <Button variant="secondary">Zur Startseite</Button>
      </Link>
    </div>
  );
}
