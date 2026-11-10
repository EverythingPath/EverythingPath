'use client';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import type {
  Ability,
  CharacterSheetRacialProgression,
} from '~/lib/character-sheet';
import { createCharacterSheetOperationId } from '~/lib/character-sheet-operations';
import type { CharacterScope } from './character-scope';
import type { GrantEntryTarget } from './character-sheet-grants-view-model';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { useEntryWriteStatus } from './use-character-sheet-entries';

/** The live read owns race and trait choices; acknowledgements stay on their controls. */
export function useCharacterSheetRaces(
  scope: CharacterScope,
  snapshot: CharacterSheetSnapshot | null | undefined,
) {
  const selectRace = useMutation(api.characterSheet.selectRace);
  const chooseAbilityScore = useMutation(
    api.characterSheet.chooseRacialAbilityScore,
  );
  const selectTrait = useMutation(api.characterSheet.setRacialTraitSelected);
  const replaceTraits = useMutation(
    api.characterSheet.setRacialTraitReplacements,
  );
  const editRaceStatistics = useMutation(api.characterSheet.editRaceStatistics);
  const discardRaceStatistics = useMutation(
    api.characterSheet.discardRaceStatistics,
  );
  const editGrant = useMutation(api.characterSheet.editGrantState);
  const editSelection = useMutation(api.characterSheet.editSelection);
  const equivalenceIds = new Set<string>(
    snapshot?.catalogEntries
      .filter((entry) => entry.countsAsRaces !== undefined)
      .map((entry) => entry._id),
  );
  const state = useEntryWriteStatus({
    signature: snapshot
      ? JSON.stringify({
          racial: snapshot.calculated.racial,
          entries: snapshot.entries.filter(
            (entry) =>
              entry.kind === 'race' ||
              entry.kind === 'racialTrait' ||
              ('catalogEntryId' in entry &&
                equivalenceIds.has(entry.catalogEntryId)),
          ),
          resolved: snapshot.calculated.resolvedEntries.filter(
            ({ entry }) =>
              entry.kind === 'race' ||
              entry.kind === 'racialTrait' ||
              ('catalogEntryId' in entry &&
                equivalenceIds.has(entry.catalogEntryId)),
          ),
          catalog: snapshot.catalogEntries.filter(
            (entry) =>
              entry.detail.kind === 'race' ||
              entry.detail.kind === 'racialTrait' ||
              entry.countsAsRaces !== undefined,
          ),
        })
      : null,
    operationId: snapshot?.lastOperationId,
    subject: 'Race',
  });
  function operation() {
    if (!snapshot) throw new Error('Character sheet is not available.');
    return {
      ...scope,
      characterId: snapshot.character._id,
      operationId: createCharacterSheetOperationId(),
    };
  }
  function target(reference: GrantEntryTarget) {
    if ('grantKey' in reference) return reference;
    const entry = snapshot?.entries.find(
      (entry) => entry._id === reference.entryId,
    );
    if (!entry) throw new Error('This entry is no longer available.');
    return { entryId: entry._id };
  }
  return {
    statusFor: state.statusFor,
    hasRemoteChange: state.hasRemoteChange,
    dismissRemoteChange: state.dismissRemoteChange,
    editStatistics: (
      entryId: Id<'characterSheetEntry'>,
      input: {
        racialHitDice?: number;
        racialProgression?: CharacterSheetRacialProgression | null;
        racialHpGained?: number | null;
        racialSkillRanks?: Record<string, number>;
      },
    ) =>
      state.write(
        () =>
          editRaceStatistics({
            ...operation(),
            entryId,
            ...input,
          }),
        { key: entryId, subject: 'Racial statistics' },
      ),
    discardStatistics: (entryId: Id<'characterSheetEntry'>) =>
      state.write(() => discardRaceStatistics({ ...operation(), entryId }), {
        key: entryId,
        subject: 'Racial statistics',
      }),
    selectRace: (catalogEntryId: Id<'catalogEntry'> | null) =>
      state.write(() => selectRace({ ...operation(), catalogEntryId }), {
        key: 'race',
        subject: 'Race',
      }),
    chooseAbilityScore: (
      reference: GrantEntryTarget,
      ability: Ability | null,
      rowId: string,
      choiceIndex?: 0 | 1,
    ) =>
      state.write(
        () =>
          chooseAbilityScore({
            ...operation(),
            target: target(reference),
            ability,
            ...(choiceIndex !== undefined ? { choiceIndex } : {}),
          }),
        { key: rowId, subject: 'Ability bonus' },
      ),
    setTraitSelected: (catalogEntryId: Id<'catalogEntry'>, selected: boolean) =>
      state.write(
        () => selectTrait({ ...operation(), catalogEntryId, selected }),
        { key: catalogEntryId, subject: 'Racial Trait' },
      ),
    setReplacements: (
      entryId: Id<'characterSheetEntry'>,
      replaces: Id<'catalogEntry'>[] | null,
    ) =>
      state.write(() => replaceTraits({ ...operation(), entryId, replaces }), {
        key: entryId,
        subject: 'Replaced traits',
      }),
    chooseRaceEquivalence: (
      reference: GrantEntryTarget,
      choice: string | null,
      rowId: string,
    ) =>
      state.write(
        () => {
          const resolved = target(reference);
          return 'grantKey' in resolved
            ? editGrant({
                ...operation(),
                grantKey: resolved.grantKey,
                state: { choice },
              })
            : editSelection({
                ...operation(),
                entryId: resolved.entryId,
                choice,
              });
        },
        { key: rowId, subject: 'Race equivalence' },
      ),
  };
}
