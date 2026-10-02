"use client";
import { useI18n } from "@/lib/i18n/context";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getRecipeRepository, getShoppingListRepository, getCorrectionRepository, getAisleOrderRepository } from "@/data";
import { buildBackup, importBackup, parseBackup, type ParsedBackup } from "@/data/backup";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Sheet } from "@/components/Sheet";
import { Spinner } from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import { IconDownload, IconUpload, IconRefresh } from "@/components/Icons";
import { Segmented } from "@/components/Segmented";
import { setThemeChoice, useThemeChoice } from "@/lib/theme";
import { useRecipes } from "@/hooks/useRecipes";

import {
  fetchParsedRecipe,
  planRefreshTargets,
  refreshRecipes,
  summarizeRefresh,
  type RefreshOutcome,
} from "@/lib/refreshRecipes";

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
  const [correctionCount, setCorrectionCount] = useState(0);
  const [exportingCorrections, setExportingCorrections] = useState(false);
  const [confirmClearCorrections, setConfirmClearCorrections] = useState(false);
  const [aisleOrderDone, setAisleOrderDone] = useState(false);
  const theme = useThemeChoice();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<string>();
  const [refreshOutcomes, setRefreshOutcomes] = useState<RefreshOutcome[]>();
  const refreshable = planRefreshTargets(recipes);
  const refreshFromCaption = refreshable.filter((target) => target.mode === "caption").length;
  const refreshFromUrl = refreshable.filter((target) => target.mode === "url").length;
  const refreshSummary = refreshOutcomes ? summarizeRefresh(refreshOutcomes) : undefined;

  useEffect(() => {
    void getCorrectionRepository()
      .count()
      .then(setCorrectionCount)
      .catch(() => {});
  }, []);

  useEffect(() => {
    void navigator.storage?.estimate?.()
      .then((estimate) => {
        if (!estimate.usage) return;
        const mb = estimate.usage / 1024 / 1024;
        setStorageText(`Lokale Nutzung: ${mb < 1 ? "<1" : mb.toFixed(1)} MB`);
      })
      .catch(() => {});
  }, []);

  /**
   * Liest **alle** gespeicherten Rezepte mit dem aktuellen Parser neu ein.
   * Rezepte mit gespeichertem Originaltext laufen lokal und sofort; Rezepte mit
   * Link werden von der Seite neu abgerufen (siehe `lib/refreshRecipes.ts`).
   * Eigene Änderungen bleiben erhalten, fehlende Angaben wie Tipps werden
   * ergänzt. Nacheinander, damit fremde Seiten nicht in einem Schwall angefragt
   * werden.
   */
  async function doRefresh() {
    if (refreshing || refreshable.length === 0) return;
    setRefreshing(true);
    setRefreshOutcomes(undefined);
    setRefreshProgress("Wird vorbereitet …");
    try {
      const repository = getRecipeRepository();
      const outcomes = await refreshRecipes(refreshable, {
        parseUrl: fetchParsedRecipe,
        update: (id, patch) => repository.update(id, patch),
        onProgress: (done, total, title) => setRefreshProgress(`${done} von ${total}: ${title}`),
      });
      setRefreshOutcomes(outcomes);
      setRefreshProgress(undefined);
    } catch {
      setRefreshProgress("Aktualisieren nicht möglich – bitte später erneut versuchen.");
    } finally {
      setRefreshing(false);
    }
  }

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

  /** Nutzerkorrekturen als Corpus-Fixtures exportieren (Ablage: src/parser/corpus/fixtures/) */
  async function exportCorrections() {
    setExportingCorrections(true);
    try {
      const json = await getCorrectionRepository().exportFixtures();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `parser-fixtures-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast(`${correctionCount} Korrektur(en) exportiert`);
    } catch (e) {
      console.error("correction export failed", e);
      toast("Der Export ist fehlgeschlagen.");
    } finally {
      setExportingCorrections(false);
    }
  }

  /** Gelernte Abteilungs-Reihenfolge der Einkaufsliste verwerfen. */
  async function resetAisleOrder() {
    try {
      await getAisleOrderRepository().clear();
      setAisleOrderDone(true);
    } catch (e) {
      console.error("aisle order reset failed", e);
    }
  }

  async function clearCorrections() {
    try {
      await getCorrectionRepository().clearAll();
      setCorrectionCount(0);
      toast("Korrektur-Log geleert");
    } catch (e) {
      console.error("clear corrections failed", e);
      toast("Das Log konnte nicht geleert werden.");
    } finally {
      setConfirmClearCorrections(false);
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
      // Erwarteter Fall (falsche Datei), kein interner Fehler: warn statt error,
      // sonst blendet das Dev-Overlay die Meldung zusätzlich ein.
      console.warn("backup parse failed", e);
      setImportError(e instanceof Error ? e.message : "Das Backup konnte nicht gelesen werden.");
    }
  }

  async function doImport(mode: "skip" | "replace") {
    if (!preview) return;
    setImporting(true);
    try {
      const result = await importBackup(preview.backup, mode);
      setPreview(null);
      const extras = [
        result.addedMealPlanEntries > 0 ? `${result.addedMealPlanEntries} Planeinträge` : null,
        result.addedCorrections > 0 ? `${result.addedCorrections} Korrekturen` : null,
        result.addedCollections > 0 ? `${result.addedCollections} Sammlungen` : null,
        result.addedShoppingItems > 0 ? `${result.addedShoppingItems} Einkaufslisten-Einträge` : null,
      ].filter(Boolean);
      toast(
        `Backup importiert: ${result.addedRecipes} Rezepte, ${result.skippedRecipes} übersprungen` +
          (extras.length > 0 ? `, dazu ${extras.join(", ")}` : "") +
          (result.removedOrphanImages > 0 ? `. ${result.removedOrphanImages} verwaiste Bilder aufgeräumt` : ""),
      );
      if (result.warnings.length > 0) {
        setImportError(result.warnings.join(" "));
      }
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

      <section className="mb-6 rounded-card border border-line bg-surface p-5 shadow-card" aria-labelledby="theme-h">
        <h2 id="theme-h" className="mb-1 font-display text-h2">{t("settings.appearance")}</h2>
        <p className="mb-4 text-meta leading-relaxed text-ink-2">{t("settings.appearanceDesc")}</p>
        <Segmented
          ariaLabel={t("settings.appearance")}
          className="max-w-sm"
          value={theme}
          onChange={setThemeChoice}
          options={[
            { value: "system", label: t("settings.themeSystem") },
            { value: "light", label: t("settings.themeLight") },
            { value: "dark", label: t("settings.themeDark") },
          ]}
        />
      </section>

      <section className="mb-6 rounded-card border border-line bg-surface p-5 shadow-card" aria-labelledby="lang-h">
        <h2 id="lang-h" className="mb-1 font-display text-h2">{t("settings.language")}</h2>
        <Segmented
          ariaLabel={t("settings.language")}
          className="mt-3 max-w-xs"
          value={lang}
          onChange={setLang}
          options={[
            { value: "de", label: "Deutsch" },
            { value: "en", label: "English" },
          ]}
        />
      </section>

      <section className="mb-6 rounded-card border border-line bg-surface p-5 shadow-card" aria-labelledby="storage-h">
        <h2 id="storage-h" className="mb-1 font-display text-h2">Lokale Daten</h2>
        <p className="mb-4 text-[14px] leading-relaxed text-ink-2">
          {recipes.length} {recipes.length === 1 ? t("recipes.countSingular") : t("recipes.countPlural")} werden aktuell nur in
          diesem Browser gespeichert (IndexedDB). Exportiere regelmäßig ein Backup, damit nichts
          verloren geht.
        </p>
        {storageText && <p className="mb-4 text-meta font-medium text-ink-3">{storageText}</p>}
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
          <p role="alert" className="mt-3 rounded-ctl bg-[#f7e3e0] px-4 py-3 text-[14px] text-danger">
            {importError}
          </p>
        )}
      </section>

      <section className="mb-6 rounded-card border border-line bg-surface p-5 shadow-card" aria-labelledby="refresh-h">
        <h2 id="refresh-h" className="mb-1 font-display text-h2">Rezepte aktualisieren</h2>
        <p className="mb-4 text-[14px] leading-relaxed text-ink-2">
          Der Import wird laufend besser – inzwischen liest die App zum Beispiel die Tipps von
          rezeptwelt.de mit und erkennt Zutatenzeilen genauer. Hier schickst du{" "}
          <strong className="font-medium text-ink">alle gespeicherten Rezepte</strong> noch einmal durch
          den Parser. Rezepte mit gespeichertem Originaltext laufen dabei sofort und ohne Internet;
          Rezepte mit einem Link werden von der Seite neu gelesen.{" "}
          <strong className="font-medium text-ink">Deine eigenen Änderungen bleiben erhalten</strong>:
          umbenannte oder gelöschte Zutaten, selbst geschriebene Schritte und ein eigener Titel werden
          nicht überschrieben. Ergänzt wird nur, was fehlt.
        </p>
        <Button
          onClick={() => void doRefresh()}
          disabled={refreshing || refreshable.length === 0}
          size="lg"
          fullWidth
        >
          {refreshing ? <Spinner size={18} /> : <IconRefresh size={18} />}
          {refreshable.length === 0
            ? "Keine Rezepte zum Aktualisieren"
            : `Alle ${refreshable.length} Rezepte neu einlesen`}
        </Button>
        {refreshable.length > 0 && (
          <p className="mt-3 text-meta text-ink-3">
            {refreshFromCaption} aus gespeichertem Text (sofort, ohne Internet)
            {refreshFromUrl > 0 ? ` · ${refreshFromUrl} über die Webseite (Abruf)` : ""}
          </p>
        )}
        {refreshProgress && (
          <p role="status" className="mt-3 text-meta text-ink-3">{refreshProgress}</p>
        )}
        {refreshOutcomes && refreshSummary && (
          <div className="mt-4 rounded-ctl bg-surface-2 p-4 text-[14px] leading-relaxed text-ink-2">
            <p className="font-medium text-ink">
              {refreshSummary.updated} aktualisiert · {refreshSummary.unchanged} unverändert ·{" "}
              {refreshSummary.failed} fehlgeschlagen
            </p>
            <p className="mt-1 text-ink-3">
              {refreshSummary.fromCaption} aus Text
              {refreshSummary.fromUrl > 0 ? ` · ${refreshSummary.fromUrl} über Webseite` : ""}
            </p>
            {refreshSummary.tipsFilled > 0 && (
              <p className="mt-1">Tipps ergänzt: {refreshSummary.tipsFilled}</p>
            )}
            {refreshSummary.protectedEdits > 0 && (
              <p className="mt-1">
                Eigene Änderungen geschützt: {refreshSummary.protectedEdits} (nicht überschrieben)
              </p>
            )}
            {refreshOutcomes.some((outcome) => outcome.filled.length > 0) && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5">
                {refreshOutcomes
                  .filter((outcome) => outcome.filled.length > 0)
                  .map((outcome) => (
                    <li key={outcome.id}>
                      <span className="text-ink">{outcome.title}</span>: ergänzt {outcome.filled.join(", ")}
                      {outcome.kept.length > 0 ? ` · unangetastet: ${outcome.kept.join(", ")}` : ""}
                    </li>
                  ))}
              </ul>
            )}
            {refreshSummary.failed > 0 && (
              <ul className="mt-3 space-y-0.5 text-danger">
                {refreshOutcomes
                  .filter((outcome) => outcome.status === "failed")
                  .map((outcome) => (
                    <li key={outcome.id}>
                      {outcome.title}: {outcome.reason}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="mb-6 rounded-card border border-line bg-surface p-5 shadow-card" aria-labelledby="parser-h">
        <h2 id="parser-h" className="mb-1 font-display text-h2">Parser-Testfälle</h2>
        <p className="mb-4 text-[14px] leading-relaxed text-ink-2">
          Wenn du beim Import Zutaten oder Schritte korrigierst, wird die Korrektur anonym lokal
          gespeichert ({correctionCount} {correctionCount === 1 ? "Eintrag" : "Einträge"}). Über den
          Export werden daraus Testfälle für den Rezeptparser – damit dieselbe Caption nie wieder
          falsch gelesen wird. Die Daten verlassen deinen Browser nicht.
        </p>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button
            onClick={() => void exportCorrections()}
            disabled={exportingCorrections || correctionCount === 0}
            size="lg"
            fullWidth
          >
            {exportingCorrections ? <Spinner size={18} /> : <IconDownload size={18} />}
            Testfälle exportieren
          </Button>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            disabled={correctionCount === 0}
            onClick={() => setConfirmClearCorrections(true)}
          >
            Log leeren
          </Button>
        </div>
      </section>

      <section className="mb-6 rounded-card border border-line bg-surface p-5 shadow-card" aria-labelledby="aisle-h">
        <h2 id="aisle-h" className="mb-1 font-display text-h2">
          {t("settings.aisleOrderTitle")}
        </h2>
        <p className="mb-4 text-[14px] leading-relaxed text-ink-2">
          {t("settings.aisleOrderDesc")}
        </p>
        <Button variant="secondary" size="lg" fullWidth onClick={() => void resetAisleOrder()}>
          {t("settings.aisleOrderReset")}
        </Button>
        {aisleOrderDone && (
          <p role="status" className="mt-3 text-[14px] text-ink-2">
            {t("settings.aisleOrderResetDone")}
          </p>
        )}
      </section>

      <section className="mb-6 rounded-card border border-line bg-surface p-5 shadow-card" aria-labelledby="onboarding-h">
        <h2 id="onboarding-h" className="mb-1 font-display text-h2">{t("onboarding.restart")}</h2>
        <p className="mb-4 text-[14px] leading-relaxed text-ink-2">
          {t("onboarding.restartDesc")}
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            localStorage.removeItem("onboardingSeen");
            localStorage.removeItem("onboardingSeenV3");
            localStorage.removeItem("tourSeen");
            router.push("/?onboarding=1");
          }}
        >
          {t("onboarding.restart")}
        </Button>
      </section>

      <section className="rounded-card border border-line bg-surface p-5 shadow-card" aria-labelledby="about-h">
        <h2 id="about-h" className="mb-1 font-display text-h2">{t("settings.about")}</h2>
        <p className="text-[14px] leading-relaxed text-ink-2">
          {t("settings.aboutDesc")}
        </p>
      </section>

      <ConfirmDialog
        open={confirmClearCorrections}
        title="Korrektur-Log leeren?"
        message={`${correctionCount} ${
          correctionCount === 1 ? "Eintrag wird" : "Einträge werden"
        } gelöscht. Bereits exportierte Testfälle bleiben erhalten.`}
        confirmLabel="Log leeren"
        onConfirm={() => void clearCorrections()}
        onCancel={() => setConfirmClearCorrections(false)}
      />

      <Sheet
        open={!!preview}
        onClose={() => !importing && setPreview(null)}
        title="Backup importieren"
      >
        {preview && (
          <div className="flex flex-col gap-4">
            <p className="text-body text-ink-2">
              Das Backup enthält <strong>{preview.backup.recipes.length} Rezepte</strong>
              {preview.backup.shopping.length > 0 &&
                ` und ${preview.backup.shopping.length} Einkaufsliste-Einträge`}.
            </p>
            <p className="text-body text-ink-2">
              Rezepte: {preview.newCount} neu · {preview.existingCount} bereits vorhanden
            </p>
            {preview.backup.shopping.length > 0 && (
              <p className="text-body text-ink-2">
                Einkaufsliste: {preview.newShoppingCount} neu ·{" "}
                {preview.existingShoppingCount} bereits vorhanden
              </p>
            )}
            {preview.backup.mealPlan.length > 0 && (
              <p className="text-body text-ink-2">
                Wochenplan: {preview.backup.mealPlan.length} Einträge
                {preview.backup.corrections.length > 0 &&
                  ` · Korrektur-Log: ${preview.backup.corrections.length}`}
                {preview.backup.aisleOrder.length > 0 &&
                  ` · Aisle-Reihenfolge: ${preview.backup.aisleOrder.length}`}
              </p>
            )}
            {preview.backup.warnings.length > 0 && (
              <div className="rounded-ctl bg-surface-2 p-3 text-[14px] text-ink-2" role="alert">
                {preview.backup.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
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
