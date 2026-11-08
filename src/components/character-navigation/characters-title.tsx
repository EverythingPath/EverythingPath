import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { Button } from '~/components/ui/button';

export function CharactersTitle({
  eyebrow,
  actions,
  newHref,
}: {
  eyebrow?: ReactNode;
  /** Further page actions, before New character. */
  actions?: ReactNode;
  newHref?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-muted-foreground text-xs tracking-widest uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl md:text-xl">Characters</h1>
      </div>
      {actions || newHref ? (
        <div className="flex flex-wrap gap-2">
          {actions}
          {newHref ? (
            <Button asChild className="min-h-11 md:min-h-9">
              <GuardedLink href={newHref}>
                <Plus aria-hidden />
                New character
              </GuardedLink>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
