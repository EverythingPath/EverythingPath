import { WeekSkeleton } from '~/components/weekly-draft-workspace/week-frame/week-frame';

// The week's route fallback, shown at once inside the kept campaign shell
// while the page's own data arrives. Same wrapper as the page.
export default function Loading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WeekSkeleton />
    </div>
  );
}
