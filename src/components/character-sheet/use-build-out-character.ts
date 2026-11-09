'use client';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { useRef, useState } from 'react';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { classifyWriteFailure, refusalReason } from '~/lib/write-outcome';
import { createCharacterSheetOperationId } from '~/lib/character-sheet-operations';
import { characterLedgerDetails } from '~/lib/character-ledger';
import type { SaveStatus } from './save-status';
import type { CharacterScope } from './character-scope';

export function useBuildOutCharacter(
  scope: Omit<CharacterScope, 'characterId'>,
) {
  const buildOut = useMutation(api.characterSheet.buildOut);
  const maintenance = useInitialMigrationMaintenance();
  const busy = useRef(false);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [characterId, setCharacterId] = useState<Id<'character'> | null>(null);

  async function run(
    character:
      | (Parameters<typeof characterLedgerDetails>[0] & {
          _id: Id<'character'>;
        })
      | null
      | undefined,
  ): Promise<Id<'character'> | null> {
    if (
      !character ||
      !characterLedgerDetails(character).canBuildOut ||
      busy.current ||
      maintenance.readOnly
    )
      return null;
    const id = character._id;
    busy.current = true;
    setCharacterId(id);
    setStatus({ kind: 'saving' });
    try {
      await buildOut({
        ...scope,
        characterId: id,
        operationId: createCharacterSheetOperationId(),
      });
      setStatus({ kind: 'saved' });
      return id;
    } catch (error) {
      const failure = classifyWriteFailure(error);
      setStatus({
        kind: 'error',
        message:
          failure.kind === 'rejected'
            ? `Character wasn't built out${refusalReason(failure.message)} Try again.`
            : 'Character may have been built out. Check its sheet before trying again.',
      });
      return null;
    } finally {
      busy.current = false;
    }
  }

  return { status, characterId, maintenance, run };
}
