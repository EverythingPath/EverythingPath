'use client';

import type { NavigationLink } from '~/lib/app-navigation';
import { StripLink } from './strip-link';
import { usePageStripCurrentLink } from './use-page-strip-current-link';

export function AppPageStrip({ links }: { links: NavigationLink[] }) {
  const ref = usePageStripCurrentLink(links);
  if (!links.length) return null;
  return (
    <nav
      ref={ref}
      aria-label="Pages"
      className="flex gap-1 overflow-x-auto px-2 pb-1.5 [scrollbar-width:none] md:hidden"
    >
      {links.map((item) => (
        <StripLink key={item.key} item={item} />
      ))}
    </nav>
  );
}
