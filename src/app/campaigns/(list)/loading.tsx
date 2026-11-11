import { CampaignHomeSkeleton } from '~/components/campaign-home/campaign-home-status';
import { TopBarRow } from '~/components/campaign-shell/top-bar';
import { Skeleton } from '~/components/ui/skeleton';

// Route fallback for the campaign list and home only. It sits in this
// `(list)` group, above the `(home)` layout it stands in for, so campaign
// section pages (`[campaignId]/…`) keep their own shell and loading and never
// flash this list shape. While the list streams in: the list shell's
// frame and top bar as static placeholders (Keep icon, organization switcher,
// account control) above the same skeleton the home screen shows while it
// resolves, so nothing jumps when the real shell mounts. The frame classes
// mirror ShellFrame, which is not imported here because it pulls in Clerk,
// Convex and the maintenance banner. The screen reader announcement
// ("Loading campaigns…") lives inside CampaignHomeSkeleton.
export default function Loading() {
  return (
    <div className="flex min-h-dvh flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <header
        aria-hidden
        className="bg-sidebar text-sidebar-foreground border-sidebar-border flex shrink-0 flex-col border-b pt-[env(safe-area-inset-top)]"
      >
        <TopBarRow>
          <Skeleton className="size-8 shrink-0 rounded-sm" />
          <Skeleton className="hidden h-4 w-1.5 md:block" />
          <Skeleton className="h-8 w-28" />
          <div className="ml-auto flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
          </div>
        </TopBarRow>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <CampaignHomeSkeleton />
      </div>
    </div>
  );
}
