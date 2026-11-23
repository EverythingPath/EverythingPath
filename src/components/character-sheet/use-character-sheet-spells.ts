'use client';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { createCharacterSheetOperationId } from '~/lib/character-sheet-operations';
import type { CharacterScope } from './character-scope';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { useEntryWriteStatus } from './use-character-sheet-entries';

function spellKey(castingClassId: string, catalogEntryId: string) {
  return `${castingClassId}/${catalogEntryId}`;
}

/** Collection rows share the live sheet read and keep acknowledgements local. */
export function useCharacterSheetSpells(
  scope: CharacterScope,
  snapshot: CharacterSheetSnapshot | null | undefined,
) {
  const record = useMutation(api.characterSheetSpells.record);
  const remove = useMutation(api.characterSheetSpells.remove);
  const writes = useEntryWriteStatus({
    signature: snapshot
      ? JSON.stringify({
          collections: snapshot.calculated.spellCollections,
          casting: snapshot.calculated.spellcastings,
        })
      : null,
    operationId: snapshot?.lastOperationId,
    subject: 'Spell',
    scopeKey: `${scope.organizationId ?? ''}/${scope.campaignId ?? ''}/${scope.characterId}`,
  });
  function operation() {
    if (snapshot?.character._id !== scope.characterId)
      throw new Error('Character sheet is not available.');
    return {
      ...scope,
      characterId: snapshot.character._id,
      operationId: createCharacterSheetOperationId(),
    };
  }
  function storedSpell(entryId: string) {
    const entry = snapshot?.entries.find((item) => item._id === entryId);
    if (entry?.kind !== 'spell')
      throw new Error('This Spell is no longer available.');
    return entry;
  }
  function entryKey(entryId: string) {
    const entry = snapshot?.entries.find((item) => item._id === entryId);
    return entry?.kind === 'spell' && entry.state.castingClassId
      ? spellKey(entry.state.castingClassId, entry.catalogEntryId)
      : entryId;
  }
  return {
    statusForSpell: (castingClassId: string, catalogEntryId: string) =>
      writes.statusFor(spellKey(castingClassId, catalogEntryId)),
    statusForEntry: (entryId: string) => writes.statusFor(entryKey(entryId)),
    hasRemoteChange: writes.hasRemoteChange,
    dismissRemoteChange: writes.dismissRemoteChange,
    record: ({
      castingClassId,
      spell,
      level,
    }: {
      castingClassId: string;
      spell: { catalogEntryId: Id<'catalogEntry'>; name: string };
      level?: number;
    }) =>
      writes.write(
        () => {
          const castingClass = snapshot?.catalogEntries.find(
            (entry) =>
              entry._id === castingClassId && entry.detail.kind === 'class',
          );
          if (!castingClass)
            throw new Error('This Spellcasting is no longer available.');
          return record({
            ...operation(),
            castingClassId: castingClass._id,
            catalogEntryId: spell.catalogEntryId,
            ...(level !== undefined ? { level } : {}),
          });
        },
        {
          key: spellKey(castingClassId, spell.catalogEntryId),
          subject: spell.name,
        },
      ),
    editLevel: ({
      entryId,
      name,
      level,
    }: {
      entryId: string;
      name: string;
      level: number;
    }) =>
      writes.write(
        () => {
          const entry = storedSpell(entryId);
          if (!entry.state.castingClassId)
            throw new Error('This Spellcasting is no longer available.');
          return record({
            ...operation(),
            castingClassId: entry.state.castingClassId,
            catalogEntryId: entry.catalogEntryId,
            level,
          });
        },
        { key: entryKey(entryId), subject: name },
      ),
    remove: ({ entryId, name }: { entryId: string; name: string }) =>
      writes.write(
        () => remove({ ...operation(), entryId: storedSpell(entryId)._id }),
        { key: entryKey(entryId), subject: name },
      ),
  };
}
