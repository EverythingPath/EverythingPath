'use client';
import { useEffect, type RefObject } from 'react';

// Bars pinned to the viewport's bottom edge (the phone bottom bar, the
// Characters save point from 768px) cover the end of a scrolled
// page, and the browser counts a control under one as in view, so focus
// never scrolls it clear. Each bar reserves its measured height (as it grows
// and shrinks) as scroll padding on its scrolling ancestor while shown; one that is
// display:none measures 0 and reserves nothing. The reservations add up, so
// one bar coming or going never clears another's.
const reserved = new Map<object, { container: HTMLElement; height: number }>();

function scrollContainer(cover: HTMLElement) {
  for (
    let parent = cover.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    const style = getComputedStyle(parent);
    if (/^(auto|scroll)$/.test(style.overflowY || style.overflow))
      return parent;
  }
  return document.documentElement;
}

function applyReserved(container: HTMLElement) {
  let total = 0;
  for (const reservation of reserved.values())
    if (reservation.container === container) total += reservation.height;
  container.style.scrollPaddingBottom = total > 0 ? `${total + 16}px` : '';
}

export function useScrollPaddingFor(bar: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const cover = bar.current;
    if (!cover || typeof ResizeObserver === 'undefined') return;
    const key = {};
    const measure = () => {
      const previous = reserved.get(key)?.container;
      const container = scrollContainer(cover);
      reserved.set(key, { container, height: cover.offsetHeight });
      if (previous && previous !== container) applyReserved(previous);
      applyReserved(container);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(cover);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      const container = reserved.get(key)?.container;
      reserved.delete(key);
      if (container) applyReserved(container);
    };
  }, [bar]);
}
