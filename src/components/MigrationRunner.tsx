"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n/context";
import { runParserMigration, migrateExternalImages } from "@/data/local/migrationService";
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
        toast(`${result.updated} Rezept(e) aktualisiert`, "success");
      }
      // Trigger lazy caching of external images
      migrateExternalImages().catch(err => {
        console.error("External images migration failed:", err);
      });
    }).catch(err => {
      console.error("Parser migration failed:", err);
    });
  }, [lang, toast]);

  return null;
}
