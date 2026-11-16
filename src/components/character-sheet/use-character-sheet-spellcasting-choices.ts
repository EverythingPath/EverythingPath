'use client';

import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import { useMemo } from 'react';
import type { SpellSchoolKey } from '~/lib/character-sheet-casting-tables';
import { createCharacterSheetOperationId } from '~/lib/character-sheet-operations';
import type { CharacterScope } from './character-scope';
import {
  buildSpellcastingFeaturesView,
  type SpellcastingFeaturesView,
  type SpellcastingSchoolView,
} from './spellcasting-features-view-model';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { useEntryWriteStatus } from './use-character-sheet-entries';

export type OppositionSchoolsView = {
  classEntryId: string;
  school: SpellcastingSchoolView;
};

/**
 * The casting features of each Spellcasting and its specialist's opposition
 * schools, saved from the Arcane School class feature row. Domain, school
 * and bloodline picks are ordinary prompt Selections on their class feature
 * rows. Acknowledgements stay with the school they change.
 */
export function useCharacterSheetSpellcastingChoices(
  scope: CharacterScope,
  snapshot: CharacterSheetSnapshot | null | undefined,
) {
  const setOppositionSchools = useMutation(
    api.characterSheet.setOppositionSchools,
  );
  // Built once per snapshot: the Spells page and every Class feature row read them.
  const views = useMemo(() => {
    const built = new Map<string, SpellcastingFeaturesView>();
    for (const { classEntryId } of snapshot?.calculated.spellcastings ?? []) {
      const view = snapshot
        ? buildSpellcastingFeaturesView(snapshot, classEntryId)
        : null;
      if (view) built.set(classEntryId, view);
    }
    return built;
  }, [snapshot]);
  const schools = useMemo(
    () =>
      [...views.values()].flatMap(
        ({ classEntryId, school }): OppositionSchoolsView[] =>
          school ? [{ classEntryId, school }] : [],
      ),
    [views],
  );
  const writes = useEntryWriteStatus({
    scopeKey: snapshot?.character._id ?? scope.characterId,
    signature: snapshot
      ? JSON.stringify(
          snapshot.calculated.spellcastings.map((casting) => [
            casting.classEntryId,
            casting.choices,
            casting.school,
          ]),
        )
      : null,
    operationId: snapshot?.lastOperationId,
    subject: 'Spellcasting choice',
  });
  function operation() {
    if (!snapshot) throw new Error('Character sheet is not available.');
    return {
      ...scope,
      characterId: snapshot.character._id,
      operationId: createCharacterSheetOperationId(),
    };
  }
  function storedId(entryId: string) {
    const stored = snapshot?.entries.find((entry) => entry._id === entryId);
    if (!stored) throw new Error('This choice is no longer available.');
    return stored._id;
  }
  function view(classEntryId: string) {
    return views.get(classEntryId) ?? null;
  }
  return {
    viewFor: view,
    /** Each specialist school with its Spellcasting, for its Class feature row. */
    schools,
    statusFor: (key: string) => writes.statusFor(key),
    setOppositionSchools: (classEntryId: string, schools: SpellSchoolKey[]) =>
      writes.write(
        async () => {
          const school = view(classEntryId)?.school;
          if (!school) throw new Error('This arcane school is not available.');
          await setOppositionSchools({
            ...operation(),
            target:
              'grantKey' in school.target
                ? { grantKey: school.target.grantKey }
                : { entryId: storedId(school.target.entryId) },
            schools,
          });
        },
        { key: `${classEntryId}:oppositionSchools` },
      ),
  };
}
