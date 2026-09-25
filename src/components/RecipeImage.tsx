"use client";

import { useImageUrl } from "@/hooks/useImageUrl";

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
