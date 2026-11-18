'use client';

import { useEffect, useRef } from 'react';
import { cn } from '~/lib/utils';
import type { NavigationLink } from '~/lib/app-navigation';
import {
  activeLinkClass,
  idleLinkClass,
  navigationLinkClass,
} from './app-navigation-presentation';
import { GuardedLink } from './navigation-guard';

// Keeps the lit page in view when the strip is wider than the phone.
export function StripLink({ item }: { item: NavigationLink }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (item.active)
      ref.current?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }, [item.active]);
  return (
    <GuardedLink
      ref={ref}
      href={item.href}
      aria-current={item.active ? 'page' : undefined}
      className={cn(
        navigationLinkClass,
        item.active ? activeLinkClass : idleLinkClass,
      )}
    >
      {item.label}
    </GuardedLink>
  );
}
