import { useEffect, useRef, useState } from 'react';

type OpenedBy = 'hover' | 'pinned' | null;

/**
 * Open state for one number's breakdown. A tap, click, Enter or Space pins
 * it; a mouse resting on the number shows it until the mouse leaves number
 * and panel. Escape closes and returns focus to the number; a press outside,
 * or the viewport changing size under the panel, closes it quietly.
 */
export function useStatBreakdownPopup() {
  const [openedBy, setOpenedBy] = useState<OpenedBy>(null);
  const wrapper = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const isOpen = openedBy !== null;

  useEffect(() => {
    if (!isOpen) return;
    const close = () => setOpenedBy(null);
    const closeOnOutsidePress = (event: PointerEvent) => {
      const isInside =
        event.target instanceof Node && wrapper.current?.contains(event.target);
      if (!isInside) close();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close();
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', close);
    };
  }, [isOpen]);

  return {
    isOpen,
    isPinned: openedBy === 'pinned',
    wrapper,
    trigger,
    togglePinned: () => setOpenedBy(openedBy === 'pinned' ? null : 'pinned'),
    showOnHover: (pointerType: string) => {
      if (pointerType === 'mouse' && openedBy === null) setOpenedBy('hover');
    },
    hideAfterHover: () => {
      if (openedBy === 'hover') setOpenedBy(null);
    },
    closeAndRefocus: () => {
      setOpenedBy(null);
      trigger.current?.focus();
    },
  };
}
