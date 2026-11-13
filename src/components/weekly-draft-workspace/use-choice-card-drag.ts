'use client';
import {
  useRef,
  useState,
  type PointerEvent,
  type MouseEvent,
  type KeyboardEvent,
} from 'react';
type Drag = {
  value: string;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
  overTarget: boolean;
};
// Pointer geometry and click suppression belong to the browser boundary. Only
// a successfully placed semantic choice reaches the Workspace or form adapter.
// Only a mouse drags: a finger or pen that moves over a card scrolls the page,
// and its tap arrives as an ordinary click that chooses the card.
export function useChoiceCardDrag({
  disabled,
  onChoose,
}: {
  disabled: boolean;
  onChoose: (value: string) => void;
}) {
  const targetRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  function update(value: Drag | null) {
    activeRef.current = value;
    setDrag(value);
  }
  function inside(x: number, y: number) {
    const rect = targetRef.current?.getBoundingClientRect();
    return Boolean(
      rect &&
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom,
    );
  }
  function cancel() {
    if (!activeRef.current) return;
    if (activeRef.current.moved) {
      suppressClick.current = true;
      setFeedback(
        'Place the card in the highlighted selection area. Your selection is unchanged.',
      );
    }
    update(null);
  }
  function down(event: PointerEvent<HTMLButtonElement>, value: string) {
    // Only the click that ends a drag is suppressed. A browser may not send
    // it (a card dropped outside glides away under the pointer), so any new
    // press, a finger's included, starts without a stale suppression.
    if (!activeRef.current) suppressClick.current = false;
    if (
      disabled ||
      event.pointerType !== 'mouse' ||
      event.button !== 0 ||
      event.isPrimary === false ||
      activeRef.current
    )
      return;
    setFeedback(null);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    update({
      value,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      overTarget: false,
    });
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = activeRef.current;
    if (current?.pointerId !== event.pointerId) return;
    if (disabled) {
      cancel();
      return;
    }
    const moved =
      current.moved ||
      Math.hypot(
        event.clientX - current.startX,
        event.clientY - current.startY,
      ) >= 6;
    if (moved) event.preventDefault();
    update({
      ...current,
      x: event.clientX,
      y: event.clientY,
      moved,
      overTarget: moved && inside(event.clientX, event.clientY),
    });
  }
  function up(event: PointerEvent<HTMLButtonElement>) {
    const current = activeRef.current;
    if (current?.pointerId !== event.pointerId) return;
    update(null);
    if (!current.moved) return;
    suppressClick.current = true;
    if (!disabled && inside(event.clientX, event.clientY)) {
      onChoose(current.value);
      setFeedback('Choice selected.');
    } else
      setFeedback(
        'Place the card in the highlighted selection area. Your selection is unchanged.',
      );
  }
  function click(event: MouseEvent<HTMLButtonElement>, value: string) {
    if (disabled) return;
    if (suppressClick.current && event.detail !== 0) {
      suppressClick.current = false;
      event.preventDefault();
      return;
    }
    suppressClick.current = false;
    setFeedback(null);
    onChoose(value);
  }
  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape' && activeRef.current) {
      event.preventDefault();
      cancel();
    }
  }
  return { targetRef, drag, feedback, down, move, up, click, keyDown, cancel };
}
