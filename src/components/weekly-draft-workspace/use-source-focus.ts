'use client';
import { useEffect, useRef } from 'react';
import { focusTargetWithin, weekEditorAnchor } from './source-anchors';
import type { Phase, SourceLink } from './types';

function bringIntoView(anchor: string | null) {
  const item = anchor ? document.getElementById(anchor) : null;
  const isReducedMotion = window.matchMedia?.(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  const behavior = isReducedMotion ? 'auto' : 'smooth';
  if (item) {
    item.scrollIntoView({ block: 'start', behavior });
    focusTargetWithin(item).focus({ preventScroll: true });
    return;
  }
  // A phase-wide decision, or an item no longer shown: the phase itself.
  const editor = document.getElementById(weekEditorAnchor);
  if (!editor) return;
  editor.scrollTo?.({ top: 0, behavior });
  editor.focus({ preventScroll: true });
}

// Follows a source link (a Persistent "Change it in Activity/Event" link or a
// Review & confirm Go link): shows that phase in this player's Phase View,
// then brings the item into view and focus once it has rendered. Other
// players are unaffected. A link within the phase already shown does not
// choose it again, so a Go link in Review never counts as reviewing the
// updated week.
export function useSourceFocus(
  shown: Phase | null,
  choose: (phase: Phase) => void,
) {
  const pending = useRef<SourceLink | null>(null);
  useEffect(() => {
    const link = pending.current;
    if (!link) return;
    if (link.phase !== shown) return;
    pending.current = null;
    const frame = requestAnimationFrame(() => bringIntoView(link.anchor));
    return () => cancelAnimationFrame(frame);
  }, [shown]);
  return (link: SourceLink) => {
    if (link.phase === shown) {
      pending.current = null;
      requestAnimationFrame(() => bringIntoView(link.anchor));
      return;
    }
    pending.current = link;
    choose(link.phase);
  };
}
