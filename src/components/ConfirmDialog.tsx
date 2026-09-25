"use client";

import { Sheet } from "./Sheet";
import { Button } from "./Button";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel }: Props) {
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      <p className="mb-6 text-[15px] text-ink-2">{message}</p>
      <div className="flex flex-col gap-2.5 md:flex-row">
        <Button variant="secondary" size="lg" fullWidth onClick={onCancel} autoFocus>
          Abbrechen
        </Button>
        <Button variant="danger" size="lg" fullWidth onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
