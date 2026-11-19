'use client';

import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import type { FunctionArgs } from 'convex/server';
import { createCharacterSheetOperationId } from '~/lib/character-sheet-operations';
import {
  proficiencyKey,
  type ManualProficiency,
} from '~/lib/character-sheet-proficiencies';
import type { CharacterScope } from './character-scope';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { useEntryWriteStatus } from './use-character-sheet-entries';
import { createItemDefinitionLookup } from '~/lib/character-sheet-items';

export type EquipmentEditInput = Pick<
  FunctionArgs<typeof api.characterSheet.editEquipment>,
  'masterwork' | 'enhancement' | 'material' | 'abilities' | 'end'
>;
export type ProficiencyDisposition = FunctionArgs<
  typeof api.characterSheet.setManualProficiency
>['disposition'];

/** Shares the living sheet's subscription; the resolver supplies every total. */
export function useCharacterSheetEquipment(
  scope: CharacterScope,
  snapshot: CharacterSheetSnapshot | null | undefined,
) {
  const editEquipment = useMutation(api.characterSheet.editEquipment);
  const setManualProficiency = useMutation(
    api.characterSheet.setManualProficiency,
  );
  const setProficiencyChoice = useMutation(
    api.characterSheet.setProficiencyChoice,
  );
  const editGrantState = useMutation(api.characterSheet.editGrantState);
  const editClassLevel = useMutation(api.characterSheet.editClassLevel);
  // A specific armor without its own numbers uses its Base Item's.
  const definitionOf = createItemDefinitionLookup(
    snapshot?.catalogEntries ?? [],
  );
  const itemParts = new Map(
    (snapshot?.calculated.itemParts ?? []).map((item) => [item.entryId, item]),
  );
  const calculatedItems = new Map(
    (snapshot?.calculated.equipment.items ?? []).map((item) => [
      item.entryId,
      item,
    ]),
  );
  const rows = (snapshot?.calculated.resolvedEntries ?? []).flatMap(
    (resolved) => {
      const { entry } = resolved;
      if (entry.kind !== 'item') return [];
      const catalog = definitionOf(entry.catalogEntryId);
      if (catalog?.detail.kind !== 'item' || !catalog.detail.armor) return [];
      return [
        {
          entryId: entry._id,
          name: catalog.name,
          active: entry.active,
          dormant: resolved.dormant,
          counting: resolved.counting,
          armor: catalog.detail.armor,
          catalogMaterial: catalog.detail.material ?? null,
          masterwork: entry.state.masterwork ?? false,
          enhancement: entry.state.enhancement ?? 0,
          material: entry.state.material ?? null,
          calculated: calculatedItems.get(entry._id) ?? null,
          /** Its parts as the resolver states them, equipped or not. */
          itemParts: itemParts.get(entry._id) ?? null,
        },
      ];
    },
  );
  const equipmentState = useEntryWriteStatus({
    signature: snapshot
      ? JSON.stringify({ rows, totals: snapshot.calculated.equipment })
      : null,
    operationId: snapshot?.lastOperationId,
    subject: 'Equipment',
  });
  const proficiencyState = useEntryWriteStatus({
    signature: snapshot
      ? JSON.stringify(snapshot.calculated.proficiencies)
      : null,
    operationId: snapshot?.lastOperationId,
    subject: 'Proficiency',
  });
  const choices = snapshot?.calculated.proficiencies.choices ?? [];
  function operation() {
    if (!snapshot) throw new Error('Character sheet is not available.');
    return {
      ...scope,
      characterId: snapshot.character._id,
      operationId: createCharacterSheetOperationId(),
    };
  }
  function recordedEntry(entryId: string) {
    const entry = snapshot?.entries.find(
      (candidate) => candidate._id === entryId,
    );
    if (!entry) throw new Error('This entry is no longer available.');
    return entry;
  }
  function equipmentTarget(entryId: string) {
    const resolved = snapshot?.calculated.resolvedEntries.find(
      (candidate) => candidate.entry._id === entryId,
    );
    if (
      resolved?.origin === 'grant' &&
      'grantKey' in resolved.entry &&
      resolved.entry.grantKey
    )
      return { grantKey: resolved.entry.grantKey };
    return { entryId: recordedEntry(resolved?.storedEntryId ?? entryId)._id };
  }
  return {
    equipment: {
      rows,
      totals: snapshot?.calculated.equipment ?? null,
      statusFor: equipmentState.statusFor,
      hasRemoteChange: equipmentState.hasRemoteChange,
      dismissRemoteChange: equipmentState.dismissRemoteChange,
      save: (entryId: string, input: EquipmentEditInput) =>
        editEquipment({
          ...operation(),
          ...equipmentTarget(entryId),
          ...input,
        }),
      saveActiveWithStatus: (entryId: string, active: boolean) =>
        equipmentState.write(
          () =>
            editEquipment({
              ...operation(),
              ...equipmentTarget(entryId),
              active,
            }),
          {
            key: entryId,
            subject:
              rows.find((row) => row.entryId === entryId)?.name ?? 'Equipment',
          },
        ),
    },
    proficiencies: {
      value: snapshot?.calculated.proficiencies ?? null,
      choices,
      statusFor: proficiencyState.statusFor,
      hasRemoteChange: proficiencyState.hasRemoteChange,
      dismissRemoteChange: proficiencyState.dismissRemoteChange,
      saveManual: (
        proficiency: ManualProficiency,
        disposition: ProficiencyDisposition,
      ) => setManualProficiency({ ...operation(), proficiency, disposition }),
      saveManualWithStatus: (
        proficiency: ManualProficiency,
        disposition: ProficiencyDisposition,
      ) =>
        proficiencyState.write(
          () =>
            setManualProficiency({ ...operation(), proficiency, disposition }),
          { key: proficiencyKey(proficiency) },
        ),
      saveChoice: (entryId: string, choice: string | null) => {
        const resolved = snapshot?.calculated.resolvedEntries.find(
          (candidate) =>
            candidate.entry._id === entryId ||
            candidate.storedEntryId === entryId,
        );
        if (
          resolved?.origin === 'grant' &&
          'grantKey' in resolved.entry &&
          resolved.entry.grantKey
        )
          return editGrantState({
            ...operation(),
            grantKey: resolved.entry.grantKey,
            state: { choice },
          });
        const entry = recordedEntry(entryId);
        return entry.kind === 'classLevel'
          ? editClassLevel({
              ...operation(),
              entryId: entry._id,
              proficiencyChoice: choice,
            })
          : setProficiencyChoice({
              ...operation(),
              entryId: entry._id,
              choice,
            });
      },
    },
  };
}

export function proficiencyLabel(proficiency: ManualProficiency) {
  if ('baseType' in proficiency)
    return proficiency.asMartial
      ? `${proficiency.baseType} (treat as martial)`
      : proficiency.baseType;
  if ('group' in proficiency) return `${proficiency.group} weapon group`;
  return {
    simple: 'Simple weapons',
    martial: 'Martial weapons',
    firearm: 'Firearms',
    light: 'Light armor',
    medium: 'Medium armor',
    heavy: 'Heavy armor',
    shield: 'Shields',
    towerShield: 'Tower shields',
  }[proficiency.category];
}
