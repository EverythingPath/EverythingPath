import {
  SetupPageFrame,
  SetupSkeleton,
} from '~/components/militia-setup/setup-states';

// The setup's route fallback, shown at once inside the kept campaign shell
// while the page's own data arrives. Same frame as the page.
export default function Loading() {
  return (
    <SetupPageFrame>
      <SetupSkeleton />
    </SetupPageFrame>
  );
}
