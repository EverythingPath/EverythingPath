'use client';

import { useEffect, useRef } from 'react';
import type { NavigationLink } from '~/lib/app-navigation';

export function usePageStripCurrentLink(links: NavigationLink[]) {
  const ref = useRef<HTMLElement>(null);
  const currentHref = links.find((link) => link.active)?.href;
  useEffect(() => {
    const strip = ref.current;
    if (!strip) return;
    const revealCurrent = () => {
      if (!strip.clientWidth) return;
      const current = strip.querySelector<HTMLElement>('[aria-current="page"]');
      if (!current) return;
      const start = strip.getBoundingClientRect().left + strip.clientLeft;
      const end = start + strip.clientWidth;
      const bounds = current.getBoundingClientRect();
      if (bounds.left < start) strip.scrollLeft += bounds.left - start;
      else if (bounds.right > end) strip.scrollLeft += bounds.right - end;
    };
    revealCurrent();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(revealCurrent);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [currentHref]);
  return ref;
}
