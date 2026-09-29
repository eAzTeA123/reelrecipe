"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { useToast } from "@/components/Toast";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";

interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Klartext-Fassung (bestehender Weg) */
  onShareText: () => void | Promise<void>;
  /** Weitergabe-Code; null = noch nicht fertig, undefined = nicht verfügbar */
  code?: string | null;
}

/**
 * Auswahl zwischen Text- und Code-Weitergabe.
 *
 * Der Textweg bleibt genau das, was die App bisher macht (der Aufrufer
 * entscheidet, ob nativ geteilt oder kopiert wird). Der Codeweg ist neu und
 * wird hier kopiert bzw. nativ geteilt. Fokusfalle und ESC bringt das Sheet mit.
 */
export function ShareSheet({ open, onClose, title, onShareText, code }: ShareSheetProps) {
  const { t } = useI18n();
  const toast = useToast();
  const [view, setView] = useState<"choose" | "code">("choose");
  const codeRef = useRef<HTMLTextAreaElement | null>(null);

  /** Schließen setzt immer auf die Auswahl zurück (kein Effekt nötig). */
  function close() {
    setView("choose");
    onClose();
  }

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast(t("share.copied"), "success");
    } catch {
      // Fallback: Feld markieren, damit man selbst kopieren kann
      codeRef.current?.focus();
      codeRef.current?.select();
      toast(t("share.copyHint"), "error");
    }
  }

  async function shareCodeNative() {
    if (!code || typeof navigator.share !== "function") return;
    try {
      await navigator.share({ text: code });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      await copyCode();
    }
  }

  return (
    <Sheet open={open} onClose={close} title={title}>
      {view === "choose" ? (
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => {
              close();
              void onShareText();
            }}
            className="flex min-h-[56px] w-full flex-col items-start gap-0.5 rounded-2xl bg-surface-2 px-4 py-3 text-left"
          >
            <span className="text-[15px] font-semibold">{t("share.asText")}</span>
            <span className="text-[13px] text-ink-2">{t("share.asTextHint")}</span>
          </button>
          {code !== undefined && (
            <button
              type="button"
              disabled={code === null}
              onClick={() => setView("code")}
              className="flex min-h-[56px] w-full flex-col items-start gap-0.5 rounded-2xl bg-surface-2 px-4 py-3 text-left disabled:opacity-50"
            >
              <span className="text-[15px] font-semibold">{t("share.asCode")}</span>
              <span className="text-[13px] text-ink-2">
                {code === null ? t("share.codePending") : t("share.asCodeHint")}
              </span>
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-ink-2">{t("share.codeHint")}</p>
          <textarea
            ref={codeRef}
            readOnly
            value={code ?? ""}
            rows={5}
            aria-label={t("share.codeLabel")}
            className="w-full resize-none rounded-2xl border border-line bg-surface-2 p-3 font-mono text-[12px] leading-snug"
            onFocus={(e) => e.currentTarget.select()}
          />
          <p className="text-[12px] text-ink-3">{t("share.codeLength").replace("{n}", String(code?.length ?? 0))}</p>
          <div className="flex flex-col gap-2">
            <Button variant="primary" size="lg" fullWidth onClick={() => void copyCode()}>
              {t("share.copy")}
            </Button>
            {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
              <Button variant="secondary" size="lg" fullWidth onClick={() => void shareCodeNative()}>
                {t("share.send")}
              </Button>
            )}
            <Button variant="ghost" size="lg" fullWidth onClick={() => setView("choose")}>
              {t("general.back")}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

