"use client";

import { useEffect, useState } from "react";
import { getImageRepository } from "@/data";
import { LOCAL_IMAGE_PREFIX } from "@/data/local/LocalImageRepository";

/** Löst eine Bild-Referenz ("local-image:<id>" oder URL) zu einer anzeigbaren URL auf. */
export function useImageUrl(ref: string | undefined): string | undefined {
  const [resolved, setResolved] = useState<{ ref: string; url: string } | undefined>();

  useEffect(() => {
    if (!ref || !ref.startsWith(LOCAL_IMAGE_PREFIX)) return;
    let objectUrl: string | undefined;
    let cancelled = false;
    getImageRepository()
      .get(ref)
      .then((img) => {
        if (cancelled || !img) return;
        objectUrl = URL.createObjectURL(img.blob);
        setResolved({ ref, url: objectUrl });
      })
      .catch((err) => console.error("image load failed", err));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ref]);

  if (!ref) return undefined;
  if (!ref.startsWith(LOCAL_IMAGE_PREFIX)) return ref;
  return resolved?.ref === ref ? resolved.url : undefined;
}
