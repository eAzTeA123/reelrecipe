"use client";

import { useEffect, useState } from "react";
import { getImageRepository } from "@/data";
import { getRecipeRepository } from "@/data";
import { LOCAL_IMAGE_PREFIX } from "@/data/local/LocalImageRepository";
import { compressImage } from "@/lib/image";

const fetching = new Set<string>();

const objectUrlCache = new Map<string, { url: string; refCount: number }>();
const GC_DELAY_MS = 5000;
const gcTimers = new Map<string, NodeJS.Timeout>();

export function useImageUrlWithCache(
  ref: string | undefined,
  recipeId?: string,
): string | undefined {
  const [url, setUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!ref) return;
    
    // Bereits lokal → normal auflösen
    if (ref.startsWith(LOCAL_IMAGE_PREFIX)) {
      let cancelled = false;
      
      if (objectUrlCache.has(ref)) {
        const cached = objectUrlCache.get(ref)!;
        cached.refCount++;
        setUrl(cached.url);
        if (gcTimers.has(ref)) {
          clearTimeout(gcTimers.get(ref)!);
          gcTimers.delete(ref);
        }
      } else {
        getImageRepository().get(ref).then(img => {
          if (cancelled || !img) return;
          const objectUrl = URL.createObjectURL(img.blob);
          objectUrlCache.set(ref, { url: objectUrl, refCount: 1 });
          setUrl(objectUrl);
        });
      }
      
      return () => {
        cancelled = true;
        if (objectUrlCache.has(ref)) {
          const cached = objectUrlCache.get(ref)!;
          cached.refCount--;
          if (cached.refCount <= 0) {
            const timer = setTimeout(() => {
              if (objectUrlCache.has(ref) && objectUrlCache.get(ref)!.refCount <= 0) {
                URL.revokeObjectURL(objectUrlCache.get(ref)!.url);
                objectUrlCache.delete(ref);
              }
              gcTimers.delete(ref);
            }, GC_DELAY_MS);
            gcTimers.set(ref, timer);
          }
        }
      };
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
          await getRecipeRepository().update(recipeId, { image: imageRef });
        })
        .catch(() => {})
        .finally(() => fetching.delete(cacheKey));
    }
  }, [ref, recipeId]);

  return url;
}
