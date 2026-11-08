import { useLayoutEffect, type RefObject } from 'react';

const edgeGapPx = 8;

/**
 * The panel sits under its number, shifted to stay inside the viewport and
 * flipped above when the viewport ends first; measured once it exists and
 * written straight to its style. It is a sibling of the number in the
 * document, so it scrolls with the sheet and reads in order.
 */
export function useBreakdownPlacement(
  trigger: RefObject<HTMLButtonElement | null>,
  panel: RefObject<HTMLDivElement | null>,
) {
  useLayoutEffect(() => {
    const element = panel.current;
    const anchor = trigger.current?.getBoundingClientRect();
    if (!element || !anchor) return;
    const left = Math.max(
      edgeGapPx,
      Math.min(
        anchor.left,
        window.innerWidth - element.offsetWidth - edgeGapPx,
      ),
    );
    const height = element.offsetHeight;
    const isAbove =
      anchor.bottom + height > window.innerHeight - edgeGapPx &&
      anchor.top - height > edgeGapPx;
    element.style.left = `${left - anchor.left}px`;
    element.style.top = isAbove ? 'auto' : '100%';
    element.style.bottom = isAbove ? '100%' : 'auto';
    element.style.marginTop = isAbove ? '0' : '0.25rem';
    element.style.marginBottom = isAbove ? '0.25rem' : '0';
  }, [trigger, panel]);
}
