import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { siteContact } from '~/lib/legal/site-contact';
import { cn } from '~/lib/utils';

const linkClass =
  'hover:text-foreground focus-visible:ring-ring/50 rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-[3px]';

// The last line of every frame. One short row of muted text so the bounded
// Week (which cannot scroll past its viewport) keeps its editor room while
// the links stay in view above the phone tabs. The links consult the
// departure guard where a shell provides one and are plain links elsewhere.
export function LegalFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        'text-muted-foreground short:py-0.5 flex shrink-0 flex-wrap items-center gap-x-4 px-3 py-1.5 text-xs md:px-4',
        className,
      )}
    >
      <GuardedLink href="/legal" className={linkClass}>
        Legal notices
      </GuardedLink>
      <GuardedLink href={siteContact.href} className={linkClass}>
        {siteContact.title}
      </GuardedLink>
    </footer>
  );
}
