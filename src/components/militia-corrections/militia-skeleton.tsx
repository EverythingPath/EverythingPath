import { Skeleton } from '~/components/ui/skeleton';

const indexRows = 6;
const detailRows = 5;

// The index/detail layout while the militia loads: rows at the left from
// 768px, stacked below.
export function MilitiaSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading militia ledger…"
      className="grid gap-4 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]"
    >
      <div aria-hidden className="space-y-2">
        {Array.from({ length: indexRows }, (_, index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </div>
      <div aria-hidden className="space-y-3">
        <Skeleton className="h-8 w-48 max-w-full" />
        {Array.from({ length: detailRows }, (_, index) => (
          <Skeleton key={index} className="h-5 w-full max-w-prose" />
        ))}
      </div>
    </div>
  );
}
