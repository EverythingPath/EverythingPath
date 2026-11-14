import type { ReactNode } from 'react';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { Button } from '~/components/ui/button';

/** A button-styled link out of a page-level or pane-level state. */
export function ActionLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Button asChild variant="outline" className="min-h-11 md:min-h-9">
      <GuardedLink href={href}>{children}</GuardedLink>
    </Button>
  );
}
