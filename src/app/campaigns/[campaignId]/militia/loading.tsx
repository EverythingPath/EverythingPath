import { MilitiaPageFrame } from '~/components/campaign-sections/page-frames';
import { MilitiaSkeleton } from '~/components/militia-corrections/militia-skeleton';

// The militia's route fallback, shown at once inside the kept campaign shell
// while the page's own data arrives. Same frame as the page.
export default function Loading() {
  return (
    <MilitiaPageFrame>
      <MilitiaSkeleton />
    </MilitiaPageFrame>
  );
}
