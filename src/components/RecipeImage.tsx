"use client";

import { useImageUrl } from "@/hooks/useImageUrl";

/** Hochwertiger neutraler Placeholder für Rezepte ohne Bild. */
function Placeholder({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-[#f4efe9] to-[#ece7df] ${className}`}
      aria-hidden
    >
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#b7afa4" strokeWidth="1.6" strokeLinecap="round">
        <path d="M4 15.5h16" />
        <path d="M5 15.5a7 7 0 0 1 14 0" />
        <path d="M12 8.5v-.8" />
        <path d="M9 10.5c-.5-1 .5-1.8 0-2.8M15 10.5c-.5-1 .5-1.8 0-2.8" />
      </svg>
    </div>
  );
}

export function RecipeImage({
  imageRef,
  alt,
  className = "",
  sizes,
}: {
  imageRef?: string;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  const url = useImageUrl(imageRef);
  if (!url) return <Placeholder className={className} />;
  return (
    <img
      src={url}
      alt={alt}
      sizes={sizes}
      loading="lazy"
      className={`object-cover ${className}`}
    />
  );
}
