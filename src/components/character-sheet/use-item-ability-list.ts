'use client';

import { useRef, useState } from 'react';
import { classifyWriteFailure, refusalReason } from '~/lib/write-outcome';
import type { ItemAbilityInput } from './item-ability-options';
import type { SaveStatus } from './save-status';

type Pending = { list: ItemAbilityInput[]; incoming: string };

/**
 * One part's Item Abilities, saved as the whole list at once. A list being
 * saved, or one the sheet refused, stays shown until it is retried or the
 * sheet's own list changes (its echo, or another player's edit), as the
 * other end fields do.
 */
export function useItemAbilityList({
  value,
  save,
}: {
  value: readonly ItemAbilityInput[];
  save: (abilities: ItemAbilityInput[]) => Promise<unknown>;
}) {
  const incoming = JSON.stringify(value);
  const [pending, setPending] = useState<Pending | null>(null);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const generation = useRef(0);
  if (pending && pending.incoming !== incoming) {
    setPending(null);
    if (status.kind === 'error') setStatus({ kind: 'idle' });
  }
  const list = pending?.incoming === incoming ? pending.list : value;

  async function change(next: ItemAbilityInput[]) {
    const own = ++generation.current;
    setPending({ list: next, incoming });
    setStatus({ kind: 'saving' });
    try {
      await save(next);
      if (generation.current === own) setStatus({ kind: 'saved' });
    } catch (error) {
      if (generation.current !== own) return;
      const failure = classifyWriteFailure(error);
      setStatus({
        kind: 'error',
        message:
          failure.kind === 'rejected'
            ? `Changes weren't saved${refusalReason(failure.message)} Your edits are kept. Try again.`
            : 'Changes may not have been saved. Your edits are kept. Check them, then try again.',
      });
    }
  }

  return {
    list,
    status,
    change,
    retry: () => change([...list]),
  };
}
