'use client';
import { useEffect, useRef, type FocusEvent } from 'react';
import type { useCharacterMove } from './use-character-move';
import { isMoveUnfinished } from './character-move-state';

/**
 * Keeps keyboard focus in a movement control while its actions change under
 * it: a started move replaces the entry actions with its progress, and a
 * completed or cancelled one brings them back. When the focused action has
 * gone or was disabled while saving (focus fell to the page), focus moves to
 * the control's first enabled action, or the control itself until one is
 * enabled again.
 */
export function useKeepMoveFocus(phase: string) {
  const root = useRef<HTMLDivElement>(null);
  const hasFocus = useRef(false);
  useEffect(() => {
    const node = root.current;
    if (!node || !hasFocus.current) return;
    const active = document.activeElement;
    // The control itself only holds focus while its actions are disabled.
    if (active && active !== document.body && active !== node) return;
    const target =
      node.querySelector<HTMLElement>('button:not(:disabled)') ?? node;
    target.focus({ preventScroll: true });
  }, [phase]);
  return {
    ref: root,
    tabIndex: -1,
    onFocus: () => {
      hasFocus.current = true;
    },
    onBlur: (event: FocusEvent<HTMLDivElement>) => {
      const next = event.relatedTarget;
      if (next instanceof Node && !event.currentTarget.contains(next))
        hasFocus.current = false;
    },
  };
}

export function useMovePhaseFocus(
  movement: ReturnType<typeof useCharacterMove>,
) {
  const isPending =
    movement.needsInspection || isMoveUnfinished(movement.progress);
  const focus = useKeepMoveFocus(
    `${isPending ? (movement.progress?.state ?? 'inspect') : 'idle'}/${movement.isBusy}`,
  );
  return { isPending, focus };
}
