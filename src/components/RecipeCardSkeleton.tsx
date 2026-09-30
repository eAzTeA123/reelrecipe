import { Skeleton } from './Skeleton';

/** Gleiche Silhouette wie die echte Karte: Cover, Titel, Meta-Zeile. */
export function RecipeCardSkeleton() {
  return (
    <article className="relative flex flex-col">
      <Skeleton className="aspect-[4/3] w-full rounded-frame sm:aspect-[4/5]" />
      <div className="mt-3.5 flex flex-col gap-2">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <div className="mt-1 flex items-center gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-14" />
        </div>
      </div>
    </article>
  );
}
