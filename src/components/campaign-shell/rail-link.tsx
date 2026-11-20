'use client';

import { cn } from '~/lib/utils';
import type { NavigationLink } from '~/lib/app-navigation';
import {
  activeLinkClass,
  idleLinkClass,
  navigationIcons,
} from './app-navigation-presentation';
import { GuardedLink } from './navigation-guard';

// Collapsed, the link is its icon and the name stays on `aria-label`. With a
// pointer the label shows beside the icon on hover or keyboard focus (no
// tooltip component is installed; a native `title` would be unreachable from
// the keyboard). Without hover, on touch, it is a caption under the icon.
const collapsedLabelClass =
  'bg-popover text-popover-foreground pointer-events-none absolute left-full z-50 ml-3 hidden w-max rounded-md border px-2 py-1 shadow-md group-hover:block group-focus-visible:block touch:static touch:ml-0 touch:line-clamp-2 touch:w-full touch:rounded-none touch:border-0 touch:bg-transparent touch:px-1 touch:py-0 touch:text-center touch:text-[10px] touch:leading-tight touch:text-inherit touch:shadow-none touch:[overflow-wrap:anywhere]';

export function RailLink({
  item,
  expanded,
}: {
  item: NavigationLink;
  expanded: boolean;
}) {
  const Icon = navigationIcons[item.key];
  return (
    <GuardedLink
      href={item.href}
      aria-label={item.label}
      aria-current={item.active ? 'page' : undefined}
      className={cn(
        'focus-visible:ring-ring/50 group relative flex min-h-11 items-center rounded-md text-sm outline-none focus-visible:ring-[3px]',
        expanded
          ? 'gap-3 px-2.5'
          : 'touch:py-1.5 flex-col justify-center gap-0.5 px-0',
        item.active ? activeLinkClass : idleLinkClass,
      )}
    >
      <Icon aria-hidden className="size-5 shrink-0" />
      {expanded ? (
        <>
          <span className="min-w-0 flex-1 truncate text-left">
            {item.label}
          </span>
          {item.key === 'week' ? (
            <span className="bg-primary/15 text-primary rounded px-1 py-px font-mono text-[10px] tracking-wide uppercase">
              current
            </span>
          ) : null}
        </>
      ) : (
        <span aria-hidden className={collapsedLabelClass}>
          {item.label}
        </span>
      )}
    </GuardedLink>
  );
}
