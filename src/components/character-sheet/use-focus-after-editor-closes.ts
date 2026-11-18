'use client';
import { useEffect, useRef } from 'react';

/**
 * Where the editor's focus goes once it closes: its opener, else the heading
 * (the wrapper's first `headingSelector` match).
 */
export function useFocusAfterEditorCloses(
  editorKey: string | null,
  headingSelector = 'h2',
) {
  const wrapper = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const previousEditorKey = useRef(editorKey);
  useEffect(() => {
    const wasOpen = previousEditorKey.current !== null;
    previousEditorKey.current = editorKey;
    if (!wasOpen || editorKey !== null) return;
    const heading =
      wrapper.current?.querySelector<HTMLElement>(headingSelector);
    const target = opener.current?.isConnected ? opener.current : heading;
    opener.current = null;
    if (!target) return;
    if (target === heading) target.tabIndex = -1;
    target.focus();
  }, [editorKey, headingSelector]);
  return {
    wrapper,
    rememberOpener: (element: HTMLElement) => {
      opener.current = element;
    },
  };
}
