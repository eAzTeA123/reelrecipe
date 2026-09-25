"use client";
import { useI18n } from "@/lib/i18n/context";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getRecipeRepository, getShoppingListRepository } from "@/data";
import { buildBackup, importBackup, parseBackup, type ParsedBackup } from "@/data/backup";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { Spinner } from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import { IconDownload, IconUpload } from "@/components/Icons";
import { useRecipes } from "@/hooks/useRecipes";

interface ImportPreview {
  backup: ParsedBackup;
  newCount: number;
  existingCount: number;
  newShoppingCount: number;
  existingShoppingCount: number;
}

export default function SettingsPage() {

  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const { recipes } = useRecipes();
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importError, setImportError] = useState<string>();
  const [storageText, setStorageText] = useState<string>();

  useEffect(() => {
    void navigator.storage?.estimate?.()
      .then((estimate) => {
        if (!estimate.usage) return;
        const mb = estimate.usage / 1024 / 1024;
        setStorageText(`Lokale Nutzung: ${mb < 1 ? "<1" : mb.toFixed(1)} MB`);
      })
      .catch(() => {});
  }, []);

  async function doExport() {
    setExporting(true);
    try {
      const backup = await buildBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "recipes-backup.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast("Backup exportiert");
    } catch (e) {
      console.error("export failed", e);
      toast("Der Export ist fehlgeschlagen.");
    } finally {
      setExporting(false);
    }
  }

  async function onFilePicked(file: File | undefined) {
    if (!file) return;
    setImportError(undefined);
    try {
      const text = await file.text();
      const backup = parseBackup(text);
      const [existingRecipes, existingShopping] = await Promise.all([
        getRecipeRepository().list(),
        getShoppingListRepository().list(),
      ]);
      const existingRecipeIds = new Set(existingRecipes.map((r) => r.id));
      const existingShoppingIds = new Set(existingShopping.map((item) => item.id));
      const newCount = backup.recipes.filter((r) => !existingRecipeIds.has(r.id)).length;
      const newShoppingCount = backup.shopping.filter(
        (item) => !existingShoppingIds.has(item.id),
      ).length;
      setPreview({
        backup,
        newCount,
        existingCount: backup.recipes.length - newCount,
        newShoppingCount,
        existingShoppingCount: backup.shopping.length - newShoppingCount,
      });
    } catch (e) {
      console.error("backup parse failed", e);
      setImportError(e instanceof Error ? e.message : "Das Backup konnte nicht gelesen werden.");
    }
  }

  async function doImport(mode: "skip" | "replace") {
    if (!preview) return;
    setImporting(true);
    try {
      const result = await importBackup(preview.backup, mode);
      setPreview(null);
      toast(
        `Backup importiert: ${result.addedRecipes} Rezepte, ${result.skippedRecipes} übersprungen`,
      );
      router.refresh();
    } catch (e) {
      console.error("import failed", e);
      setImportError("Der Import ist fehlgeschlagen. Deine Daten wurden nicht verändert.");
      setPreview(null);
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <PageHeader title={t("settings.title")} />

      <section className="mb-6 rounded-card bg-surface p-5 shadow-card" aria-labelledby="lang-h">
        <h2 id="lang-h" className="mb-1 text-[17px] font-bold">{t("settings.language")}</h2>
        <div className="flex gap-4 mt-3">
          <Button
            variant={lang === "de" ? "primary" : "secondary"}
            onClick={() => setLang("de")}
          >
            Deutsch
          </Button>
          <Button
            variant={lang === "en" ? "primary" : "secondary"}
            onClick={() => setLang("en")}
          >
            English
          </Button>
        </div>
      </section>

      <section className="mb-6 rounded-card bg-surface p-5 shadow-card" aria-labelledby="storage-h">
        <h2 id="storage-h" className="mb-1 text-[17px] font-bold">Lokale Daten</h2>
        <p className="mb-4 text-[14px] leading-relaxed text-ink-2">
          {recipes.length} {recipes.length === 1 ? t("recipes.countSingular") : t("recipes.countPlural")} werden aktuell nur in
          diesem Browser gespeichert (IndexedDB). Exportiere regelmäßig ein Backup, damit nichts
          verloren geht.
        </p>
        {storageText && <p className="mb-4 text-[13px] font-medium text-ink-3">{storageText}</p>}
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button onClick={() => void doExport()} disabled={exporting} size="lg" fullWidth>
            {exporting ? <Spinner size={18} /> : <IconDownload size={18} />}
            {t("settings.exportButton")}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => fileRef.current?.click()}
          >
            <IconUpload size={18} /> Backup importieren
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Backup-Datei auswählen"
            onChange={(e) => {
              void onFilePicked(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        {importError && (
          <p role="alert" className="mt-3 rounded-ctl bg-[#fdeeec] px-4 py-3 text-[14px] text-danger">
            {importError}
          </p>
        )}
      </section>

      <section className="mb-6 rounded-card bg-surface p-5 shadow-card" aria-labelledby="tour-h">
        <h2 id="tour-h" className="mb-1 text-[17px] font-bold">{t("tour.restart")}</h2>
        <p className="mb-4 text-[14px] leading-relaxed text-ink-2">
          {t("tour.restartDesc")}
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            localStorage.removeItem("tourSeen");
            router.push("/?tour=1");
          }}
        >
          {t("tour.restart")}
        </Button>
      </section>

      <section className="rounded-card bg-surface p-5 shadow-card" aria-labelledby="about-h">
        <h2 id="about-h" className="mb-1 text-[17px] font-bold">{t("settings.about")}</h2>
        <p className="text-[14px] leading-relaxed text-ink-2">
          {t("settings.aboutDesc")}
        </p>
      </section>

      <Sheet
        open={!!preview}
        onClose={() => !importing && setPreview(null)}
        title="Backup importieren"
      >
        {preview && (
          <div className="flex flex-col gap-4">
            <p className="text-[15px] text-ink-2">
              Das Backup enthält <strong>{preview.backup.recipes.length} Rezepte</strong>
              {preview.backup.shopping.length > 0 &&
                ` und ${preview.backup.shopping.length} Einkaufsliste-Einträge`}.
            </p>
            <p className="text-[15px] text-ink-2">
              Rezepte: {preview.newCount} neu · {preview.existingCount} bereits vorhanden
            </p>
            {preview.backup.shopping.length > 0 && (
              <p className="text-[15px] text-ink-2">
                Einkaufsliste: {preview.newShoppingCount} neu ·{" "}
                {preview.existingShoppingCount} bereits vorhanden
              </p>
            )}
            <div className="flex flex-col gap-2.5">
              <Button
                size="lg"
                fullWidth
                disabled={importing}
                onClick={() => void doImport("skip")}
              >
                {importing ? <Spinner size={18} /> : null}
                Vorhandene überspringen
              </Button>
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                disabled={importing || preview.existingCount === 0}
                onClick={() => void doImport("replace")}
              >
                Vorhandene ersetzen
              </Button>
              <Button
                variant="ghost"
                fullWidth
                disabled={importing}
                onClick={() => setPreview(null)}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
