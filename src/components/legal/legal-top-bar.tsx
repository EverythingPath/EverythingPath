import { KeepLink, TopBarRow } from '~/components/campaign-shell/top-bar';

// The shell's top bar without its Clerk-backed controls: the Keep link, the
// crumb and the page title.
export function LegalTopBar({ title }: { title: string }) {
  return (
    <header className="bg-sidebar text-sidebar-foreground border-sidebar-border flex shrink-0 flex-col border-b pt-[env(safe-area-inset-top)]">
      <TopBarRow>
        <KeepLink />
        <span className="text-muted-foreground" aria-hidden>
          /
        </span>
        <span className="truncate text-sm md:text-base">{title}</span>
      </TopBarRow>
    </header>
  );
}
