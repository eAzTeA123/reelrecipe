"use client";

import { useEffect, useState } from "react";
import { getImageRepository } from "@/data";
import { getRecipeRepository } from "@/data";
import { LOCAL_IMAGE_PREFIX } from "@/data/local/LocalImageRepository";
import { compressImage } from "@/lib/image";

const fetching = new Set<string>();

export function useImageUrlWithCache(
  ref: string | undefined,
  recipeId?: string,
): string | undefined {
  const [url, setUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!ref) return;
    
    // Bereits lokal → normal auflösen
    if (ref.startsWith(LOCAL_IMAGE_PREFIX)) {
      let objectUrl: string | undefined;
      let cancelled = false;
      getImageRepository().get(ref).then(img => {
        if (cancelled || !img) return;
        objectUrl = URL.createObjectURL(img.blob);
        setUrl(objectUrl);
      });
      return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }

    // Externe URL → anzeigen UND im Hintergrund cachen
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(ref);
    
    if (recipeId && ref.startsWith("http")) {
      const cacheKey = `${recipeId}-${ref}`;
      if (fetching.has(cacheKey)) return;
      fetching.add(cacheKey);
      
      // Im Hintergrund als local-image cachen
      fetch(`/api/instagram/image?url=${encodeURIComponent(ref)}`)
        .then(res => res.ok ? res.blob() : null)
        .then(blob => blob ? compressImage(blob) : null)
        .then(async (compressed) => {
          if (!compressed) return;
          const imageRef = await getImageRepository().save(compressed);
          await getRecipeRepository().update(recipeId, { image: `local-image:${imageRef}` });
        })
        .catch(() => {})
        .finally(() => fetching.delete(cacheKey));
    }
  }, [ref, recipeId]);

  return url;
}
