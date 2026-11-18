'use client';

import { useState } from 'react';

export function useSpellDescriptionExpansion(key: string) {
  const [expansion, setExpansion] = useState<{ key: string; ids: Set<string> }>(
    {
      key,
      ids: new Set(),
    },
  );
  return {
    isDescriptionExpanded: (id: string) =>
      expansion.key === key && expansion.ids.has(id),
    toggleDescription: (id: string) =>
      setExpansion((previous) => {
        const ids = new Set(previous.key === key ? previous.ids : []);
        if (ids.has(id)) ids.delete(id);
        else ids.add(id);
        return { key, ids };
      }),
  };
}
