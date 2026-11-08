import { FinishedWeeksSkeleton } from '~/components/historical-week/finished-weeks-view';

// The finished weeks' route fallback, shown at once inside the kept campaign
// shell while the page's own data arrives.
export default function Loading() {
  return <FinishedWeeksSkeleton />;
}
