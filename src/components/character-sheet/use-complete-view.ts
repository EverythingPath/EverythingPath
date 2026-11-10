'use client';

import { useState } from 'react';

/** Retain JSON data while pending; scope changes and explicit null clear it. */
export function useCompleteView<Value>(
  scopeKey: string,
  incoming: Value | undefined,
) {
  const [selected, setSelected] = useState(() => ({
    scopeKey,
    value: incoming,
    content: JSON.stringify(incoming),
  }));
  if (selected.scopeKey !== scopeKey) {
    setSelected({
      scopeKey,
      value: incoming,
      content: JSON.stringify(incoming),
    });
    return incoming;
  }
  if (incoming !== undefined && incoming !== selected.value) {
    const content = JSON.stringify(incoming);
    if (content !== selected.content) {
      setSelected({ scopeKey, value: incoming, content });
      return incoming;
    }
  }
  return selected.value;
}
