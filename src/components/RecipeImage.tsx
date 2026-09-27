"use client";

import { useImageUrlWithCache } from "@/hooks/useImageUrlWithCache";
import { useEffect, useRef, useState } from "react";

import { forwardRef } from "react";

/** Hochwertiger neutraler Placeholder für Rezepte ohne Bild. */
const Placeholder = forwardRef<HTMLDivElement, { className?: string }>(
  ({ className = "" }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex items-center justify-center bg-gradient-to-br from-[#f4efe9] to-[#ece7df] ${className}`}
        aria-hidden
      >
        <img src="/icon.svg" alt="" width={44} height={44} className="opacity-20 grayscale" />
      </div>
    );
  }
);
Placeholder.displayName = "Placeholder";

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
  const rootRef = useRef<HTMLDivElement | HTMLImageElement>(null);

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

  if (!url) {
    return <Placeholder ref={rootRef as any} className={className} />;
  }

  return (
    <img
      ref={rootRef as any}
      src={url}
      alt={alt}
      sizes={sizes}
      loading="lazy"
      className={`object-cover ${className}`}
    />
  );
}
