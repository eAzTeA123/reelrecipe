import { Skeleton } from './Skeleton';

export function RecipeCardSkeleton() {
  return (
    <article className="relative block border-b-2 border-line pb-8 mb-8 last:border-b-0">
      <div className="block">
        <Skeleton className="aspect-[4/5] w-full mb-4 rounded-none" />
        <div className="flex flex-col gap-2">
          {/* Category */}
          <Skeleton className="h-4 w-24 mb-1" />
          {/* Title */}
          <Skeleton className="h-8 w-3/4 mb-1" />
          <Skeleton className="h-8 w-1/2" />
          
          {/* Icons row */}
          <div className="mt-2 flex items-center gap-6">
             <Skeleton className="h-5 w-20" />
             <Skeleton className="h-5 w-16" />
          </div>
        </div>
      </div>
      {/* Heart button */}
      <Skeleton className="absolute right-2 top-2 h-14 w-14 rounded-none" />
    </article>
  );
}
