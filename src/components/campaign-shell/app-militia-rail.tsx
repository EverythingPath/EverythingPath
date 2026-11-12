'use client';

import { useId, useState, useSyncExternalStore } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import type { NavigationLink } from '~/lib/app-navigation';
import { RailLink } from './rail-link';

const WIDE_RAIL = '(min-width: 1280px)';
function isWide() {
  return window.matchMedia?.(WIDE_RAIL).matches ?? false;
}
function subscribeWide(onChange: () => void) {
  const query = window.matchMedia?.(WIDE_RAIL);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

// The militia's second level from tablet width. The navigation model chooses
// the desktop default; a toggle overrides it while this rail is mounted.
// The icon column widens on touch so each icon keeps a caption.
export function AppMilitiaRail({
  links,
  expandedOnDesktop,
}: {
  links: NavigationLink[];
  expandedOnDesktop: boolean;
}) {
  const wide = useSyncExternalStore(subscribeWide, isWide, () => false);
  const [pinned, setPinned] = useState<boolean | null>(null);
  const expanded = pinned ?? (wide && expandedOnDesktop);
  const pagesId = useId();
  return (
    <aside
      aria-label="Militia"
      className={cn(
        'bg-sidebar border-sidebar-border hidden shrink-0 flex-col border-r p-2 md:flex',
        expanded ? 'w-56' : 'touch:w-20 w-14',
      )}
    >
      <div
        className={cn(
          'flex items-center pb-2',
          expanded ? 'justify-between pl-2.5' : 'justify-center',
        )}
      >
        {expanded ? (
          <p className="text-muted-foreground text-xs tracking-widest uppercase">
            Militia
          </p>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Militia navigation"
          aria-expanded={expanded}
          aria-controls={pagesId}
          onClick={() => setPinned(!expanded)}
        >
          {expanded ? (
            <PanelLeftClose aria-hidden />
          ) : (
            <PanelLeftOpen aria-hidden />
          )}
        </Button>
      </div>
      <nav
        id={pagesId}
        aria-label="Militia pages"
        className="flex min-h-0 flex-1 flex-col gap-1"
      >
        {links.map((item) =>
          item.key === 'setup' ? (
            <div
              key={item.key}
              className="border-sidebar-border mt-auto border-t pt-2"
            >
              <RailLink item={item} expanded={expanded} />
            </div>
          ) : (
            <RailLink key={item.key} item={item} expanded={expanded} />
          ),
        )}
      </nav>
    </aside>
  );
}
