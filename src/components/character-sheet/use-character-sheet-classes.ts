'use client';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { useMemo, useState } from 'react';
import { characterSheetClassFamily } from '~/lib/character-sheet-grants';
import { createCharacterSheetOperationId } from '~/lib/character-sheet-operations';
import type { CharacterScope } from './character-scope';
import { buildCastingAdvanceChoices } from './casting-advances-view-model';
import {
  buildCharacterSheetClassesView,
  describeClassDefinitionSwitch,
  emptyClassCatalogChoices,
} from './character-sheet-classes-view-model';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { useEntryWriteStatus } from './use-character-sheet-entries';

/** Prestige entry and version controls share the sheet's live read. */
export function useCharacterSheetClasses(
  scope: CharacterScope,
  snapshot: CharacterSheetSnapshot | null | undefined,
  catalogChoices: readonly CharacterSheetSnapshot['catalogEntries'][number][] = emptyClassCatalogChoices,
) {
  const switchVersion = useMutation(api.characterSheet.switchClassVersion);
  const assignCastingAdvance = useMutation(
    api.characterSheet.assignCastingAdvance,
  );
  const view = useMemo(
    () =>
      snapshot
        ? buildCharacterSheetClassesView(snapshot, catalogChoices)
        : null,
    [snapshot, catalogChoices],
  );
  const signature = snapshot
    ? JSON.stringify(
        snapshot.entries.flatMap((entry) =>
          entry.kind === 'classLevel'
            ? [[entry._id, entry.active, entry.state.classEntryId]]
            : [],
        ),
      )
    : null;
  const state = useEntryWriteStatus({
    scopeKey: snapshot?.character._id ?? scope.characterId,
    signature,
    operationId: snapshot?.lastOperationId,
    subject: 'Class version',
  });
  const advances = useEntryWriteStatus({
    scopeKey: snapshot?.character._id ?? scope.characterId,
    signature: snapshot
      ? JSON.stringify(
          snapshot.calculated.castingAdvances.map((advance) => [
            advance.entryId,
            advance.index,
            advance.targetClassEntryId,
          ]),
        )
      : null,
    operationId: snapshot?.lastOperationId,
    subject: 'Casting advance',
  });
  // #583: this device's last saved definition switch, for its result.
  const [definitionSwitch, setDefinitionSwitch] = useState<{
    before: CharacterSheetSnapshot;
    entryId: Id<'characterSheetEntry'>;
    classEntryId: Id<'catalogEntry'>;
    operationId: string;
  } | null>(null);
  // Calculated once per saved switch and sheet read, not on every render.
  const definitionSwitchResult = useMemo(() => {
    if (
      !definitionSwitch ||
      snapshot?.character._id !== definitionSwitch.before.character._id ||
      snapshot.lastOperationId !== definitionSwitch.operationId
    )
      return null;
    const description = describeClassDefinitionSwitch({
      before: definitionSwitch.before,
      after: snapshot,
      catalogChoices,
      entryId: definitionSwitch.entryId,
      classEntryId: definitionSwitch.classEntryId,
    });
    return description
      ? {
          entryId: definitionSwitch.entryId,
          classEntryId: definitionSwitch.classEntryId,
          ...description,
        }
      : null;
  }, [definitionSwitch, snapshot, catalogChoices]);
  /**
   * #583: switches the one definition every level of the class uses, a copy
   * or the other version, to exactly the chosen one; its result follows.
   */
  async function switchRules(
    entryId: Id<'characterSheetEntry'>,
    classEntryId: Id<'catalogEntry'>,
  ) {
    if (!snapshot) return false;
    const before = snapshot;
    const operationId = createCharacterSheetOperationId();
    const saved = await state.write(
      () =>
        switchVersion({
          ...scope,
          characterId: before.character._id,
          operationId,
          entryId,
          classEntryId,
        }),
      { key: familyKey(entryId) },
    );
    if (saved)
      setDefinitionSwitch({ before, entryId, classEntryId, operationId });
    return saved;
  }
  const advanceKey = (entryId: string, index: number) => `${entryId}:${index}`;
  function familyKey(entryId: Id<'characterSheetEntry'>) {
    const row = snapshot?.entries.find((entry) => entry._id === entryId);
    if (row?.kind !== 'classLevel') return entryId;
    const definition = snapshot?.catalogEntries.find(
      (entry) => entry._id === row.state.classEntryId,
    );
    return definition && snapshot
      ? characterSheetClassFamily(definition, snapshot.catalogEntries)
      : entryId;
  }
  return {
    lastOperationId: snapshot?.lastOperationId,
    isVersionChange: (previous: string, next: string) =>
      view?.isVersionChange(previous, next) ?? false,
    isLoading: snapshot === undefined,
    isUnavailable: snapshot === null,
    choices: view?.choices ?? [],
    preview: (
      classEntryId: Id<'catalogEntry'>,
      entryId?: Id<'characterSheetEntry'>,
    ) => view?.preview(classEntryId, entryId) ?? null,
    warnings: view?.warnings ?? [],
    /**
     * #583: what this device's last saved definition switch changed, while it
     * is the sheet's latest change; null otherwise.
     */
    definitionSwitchResult,
    dismissDefinitionSwitchResult: () => setDefinitionSwitch(null),
    /**
     * #583 "Rules used": every copy of every version of this level's class,
     * labelled, with the one in use marked; [] with nothing to choose.
     */
    rulesChoicesFor: (entryId: Id<'characterSheetEntry'>) =>
      view?.rulesChoicesFor(entryId) ?? [],
    /** #583: the level of this class that shows "Rules used", its first. */
    firstLevelOfClass: (entryId: Id<'characterSheetEntry'>) =>
      view?.firstLevelOfClass(entryId) ?? null,
    /** #583: what switching to `classEntryId` would recalculate and keep. */
    previewRulesSwitch: (
      entryId: Id<'characterSheetEntry'>,
      classEntryId: Id<'catalogEntry'>,
    ) => view?.previewDefinitionSwitch(entryId, classEntryId) ?? null,
    switchRules,
    statusFor: (entryId: Id<'characterSheetEntry'>) =>
      state.statusFor(familyKey(entryId)),
    /** The "+1 level of existing class" choices of one Prestige Class Level. */
    advancesFor: (entryId: Id<'characterSheetEntry'>) =>
      snapshot ? buildCastingAdvanceChoices(snapshot, entryId) : [],
    advanceStatusFor: (entryId: Id<'characterSheetEntry'>, index: number) =>
      advances.statusFor(advanceKey(entryId, index)),
    hasRemoteAdvanceChange: advances.hasRemoteChange,
    dismissRemoteAdvanceChange: advances.dismissRemoteChange,
    assignAdvance: (
      entryId: Id<'characterSheetEntry'>,
      index: number,
      classEntryId: Id<'catalogEntry'> | null,
    ) =>
      advances.write(
        async () => {
          if (!snapshot) throw new Error('Character sheet is not available.');
          await assignCastingAdvance({
            ...scope,
            characterId: snapshot.character._id,
            operationId: createCharacterSheetOperationId(),
            entryId,
            index,
            classEntryId,
          });
        },
        { key: advanceKey(entryId, index) },
      ),
    hasRemoteChange: state.hasRemoteChange,
    dismissRemoteChange: state.dismissRemoteChange,
  };
}
