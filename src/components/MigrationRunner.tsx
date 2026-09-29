"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n/context";
import { runParserMigration, migrateExternalImages, backfillColors } from "@/data/local/migrationService";
import { useToast } from "@/components/Toast";

export function MigrationRunner() {
  const { lang } = useI18n();
  const toast = useToast();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    
    runParserMigration(lang as "de" | "en").then(result => {
      if (result.updated > 0) {
        const kept = result.respectedRemovals + result.respectedEdits;
        const suffix = kept > 0 ? `, ${kept} eigene Änderung(en) behalten` : "";
        toast(`${result.updated} Rezept(e) aktualisiert${suffix}`, "success");
      }
      if (result.failed > 0) {
        // Fehlgeschlagene Rezepte werden nicht als aktuell gestempelt und beim
        // nächsten Start erneut versucht – das soll der Nutzer wissen.
        toast(
          `${result.failed} Rezept(e) konnten nicht aktualisiert werden. Beim nächsten Start wird es erneut versucht.`,
          "error",
        );
      }
      // Trigger lazy caching of external images
      migrateExternalImages().then(() => {
        return backfillColors();
      }).catch(err => {
        console.error("External images migration/color backfill failed:", err);
      });
    }).catch(err => {
      console.error("Parser migration failed:", err);
    });
  }, [lang, toast]);

  return null;
}
