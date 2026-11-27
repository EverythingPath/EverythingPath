'use client';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { useRef, useState } from 'react';
import { classifyWriteFailure, refusalReason } from '~/lib/write-outcome';
import type { CharacterScope } from './character-scope';
import type { SaveStatus } from './save-status';

type WriteScope = CharacterScope<Id<'character'>> & {
  operationId: string;
};

/** The sheet host's view of a private deletion, so it can outlive the sheet. */
export type Deletion =
  | { kind: 'none' }
  | { kind: 'pending'; name: string }
  | { kind: 'done'; name: string };

/**
 * A Character's lifecycle writes: a campaign Character is archived and
 * restored, a private one deleted. One write at a time; the server decides
 * which of the two the Character allows. Each write resolves to whether it
 * was confirmed.
 */
export function useCharacterLifecycle({
  organizationId,
  campaignId,
  characterId,
  characterName,
  onDeletion,
}: CharacterScope<Id<'character'>> & {
  characterName: string;
  onDeletion: (deletion: Deletion) => void;
}) {
  const archive = useMutation(api.characterSheet.archive);
  const deletePrivate = useMutation(api.characterSheet.deletePrivate);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const isBusy = useRef(false);

  async function write({
    run,
    refused,
    uncertain,
  }: {
    run: (scope: WriteScope) => Promise<unknown>;
    refused: string;
    uncertain: string;
  }) {
    if (isBusy.current) return false;
    isBusy.current = true;
    setStatus({ kind: 'saving' });
    try {
      await run({
        organizationId,
        campaignId,
        characterId,
        operationId: crypto.randomUUID(),
      });
      setStatus({ kind: 'saved' });
      return true;
    } catch (error) {
      const failure = classifyWriteFailure(error);
      setStatus({
        kind: 'error',
        message:
          failure.kind === 'rejected'
            ? `${refused}${refusalReason(failure.message)} Try again.`
            : uncertain,
      });
      return false;
    } finally {
      isBusy.current = false;
    }
  }

  return {
    status,
    saveIsActive: (isActive: boolean) =>
      write({
        run: (scope) => archive({ ...scope, isActive }),
        refused: isActive
          ? "Character wasn't restored"
          : "Character wasn't archived",
        uncertain:
          'The change may not have been saved. Check the campaign row before trying again.',
      }),
    deleteCharacter: () =>
      write({
        run: async (scope) => {
          onDeletion({ kind: 'pending', name: characterName });
          try {
            await deletePrivate(scope);
          } catch (error) {
            onDeletion({ kind: 'none' });
            throw error;
          }
          onDeletion({ kind: 'done', name: characterName });
        },
        refused: "Character wasn't deleted",
        uncertain:
          'Character may have been deleted. Reload the page before trying again.',
      }),
  };
}
