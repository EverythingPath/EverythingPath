'use client';

import { useState } from 'react';

/** Keep an immutable value's reference while its content key is unchanged. */
export function useStableByKey<T>(value: T, key: string | null): T {
  const [kept, setKept] = useState({ key, value });
  if (kept.key !== key) {
    setKept({ key, value });
    return value;
  }
  return kept.value;
}
