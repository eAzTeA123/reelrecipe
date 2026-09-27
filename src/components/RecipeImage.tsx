"use client";

import { useImageUrlWithCache } from "@/hooks/useImageUrlWithCache";
import { useEffect, useRef, useState } from "react";

/** Hochwertiger neutraler Placeholder für Rezepte ohne Bild. */
function Placeholder({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-[#f4efe9] to-[#ece7df] ${className}`}
      aria-hidden
    >
      <img src="/icon.svg" alt="" width={44} height={44} className="opacity-20 grayscale" />
    </div>
  );
}

export function RecipeImage({
  imageRef,
  alt,
  className = "",
  sizes,
  recipeId,
}: {
  imageRef?: string;
  alt: string;
  className?: string;
  sizes?: string;
  recipeId?: string;
}) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!imageRef) return;
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setShouldLoad(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    if (rootRef.current) observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [imageRef]);

  const url = useImageUrlWithCache(shouldLoad ? imageRef : undefined, recipeId);

  return (
    <div ref={rootRef} className={`contents`}>
      {!url ? (
        <Placeholder className={className} />
      ) : (
        <img
          src={url}
          alt={alt}
          sizes={sizes}
          loading="lazy"
          className={`object-cover ${className}`}
        />
      )}
    </div>
  );
}
