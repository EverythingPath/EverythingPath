'use client';
import { useState } from 'react';
import type { SituationGroup } from './stat-breakdown-groups';

/** A local preview lens; selecting Situations never writes character state. */
export function useSituationSelection({
  groups,
  scopeKey,
}: {
  groups: readonly SituationGroup[];
  scopeKey: string;
}) {
  const [selection, setSelection] = useState<{
    scopeKey: string;
    keys: string[];
  }>({ scopeKey, keys: [] });
  if (selection.scopeKey !== scopeKey) setSelection({ scopeKey, keys: [] });
  const keys = selection.scopeKey === scopeKey ? selection.keys : [];
  const selectedGroups = keys.flatMap((key) =>
    groups.filter((group) => group.key === key),
  );
  if (selection.scopeKey === scopeKey && selectedGroups.length !== keys.length)
    setSelection({ scopeKey, keys: selectedGroups.map((group) => group.key) });
  return {
    selections: selectedGroups.map((group) => group.selection),
    selectedKeys: selectedGroups.map((group) => group.key),
    isSelected: (key: string) =>
      selectedGroups.some((group) => group.key === key),
    toggle: (key: string) => {
      if (!groups.some((group) => group.key === key)) return;
      setSelection((previous) => {
        const current = previous.scopeKey === scopeKey ? previous.keys : [];
        return {
          scopeKey,
          keys: current.includes(key)
            ? current.filter((item) => item !== key)
            : [...current, key],
        };
      });
    },
    clear: () => setSelection({ scopeKey, keys: [] }),
  };
}
