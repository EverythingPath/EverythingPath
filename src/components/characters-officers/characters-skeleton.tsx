import { Skeleton } from '~/components/ui/skeleton';

// The page's shape while records and the roster load: the officer board
// over the character table.
export function CharactersSkeleton() {
  return (
    <div role="status" aria-label="Loading characters…" className="space-y-8">
      <div aria-hidden className="space-y-3">
        <Skeleton className="h-7 w-40" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-36 rounded-none" />
          ))}
        </div>
      </div>
      <div aria-hidden className="space-y-3">
        <Skeleton className="h-7 w-48" />
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-10" />
        ))}
      </div>
    </div>
  );
}
