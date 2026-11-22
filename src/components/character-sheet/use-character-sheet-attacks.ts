'use client';

import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import {
  UNARMED_STRIKE_ID,
  isUnarmedStrike,
  type ItemPart,
} from '~/lib/character-sheet-attack-types';
import type { FunctionArgs } from 'convex/server';
import { defaultAttackRoutineConfiguration } from '~/lib/character-sheet-attacks';
import { createCharacterSheetOperationId } from '~/lib/character-sheet-operations';
import { characterScopeKey, type CharacterScope } from './character-scope';
import type { AttackRoutineValues } from './use-attack-routine-form';
import type { EquipmentValues } from './equipment-form-schema';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { availableLimbsSchema } from './available-limbs-schema';
import { useEntryWriteStatus } from './use-character-sheet-entries';
import type { SheetEntryInput } from './use-character-sheet-entries';
import {
  listAttackRoutineRows,
  listAttackRoutineOffHands,
  listAttackRoutineWeapons,
  listAttackRoutineNaturalAttacks,
  listAttackWeaponCatalog,
  listAttackRoutineAmmunition,
  listAttackAmmunitionCatalog,
} from './attack-routine-view-model';

/** Whether a form reference is one of the recorded IDs, typed as one. */
function isOneOf<T extends string>(
  ids: readonly T[],
  reference: string,
): reference is T {
  const values: readonly string[] = ids;
  return values.includes(reference);
}

/** One item part's edit: its gear fields or its whole Item Ability list. */
type ItemPartPatch = Partial<EquipmentValues> &
  Pick<FunctionArgs<typeof api.characterSheet.editEquipment>, 'abilities'>;

/** Uses the living sheet's one subscription and preserves routine identity through Undo. */
export function useCharacterSheetAttacks(
  scope: CharacterScope,
  snapshot: CharacterSheetSnapshot | null | undefined,
) {
  const createRoutine = useMutation(api.characterSheet.createAttackRoutine);
  const editRoutine = useMutation(api.characterSheet.editAttackRoutine);
  const deleteRoutine = useMutation(api.characterSheet.deleteAttackRoutine);
  const restoreRoutine = useMutation(api.characterSheet.restoreAttackRoutine);
  const selectEntry = useMutation(api.characterSheet.selectEntry);
  const editEquipment = useMutation(api.characterSheet.editEquipment);
  const createSheetEntry = useMutation(api.characterSheet.createSheetEntry);
  const editSheetEntry = useMutation(api.characterSheet.editSheetEntry);
  const scopeKey = characterScopeKey(scope);
  const recorded =
    snapshot?.entries.filter((entry) => entry.kind === 'attackRoutine') ?? [];
  const rows = listAttackRoutineRows(snapshot);
  const weapons = listAttackRoutineWeapons(snapshot);
  const weaponCatalog = listAttackWeaponCatalog(snapshot);
  const ammunition = listAttackRoutineAmmunition(snapshot);
  const ammunitionCatalog = listAttackAmmunitionCatalog(snapshot);
  const naturalAttacks = listAttackRoutineNaturalAttacks(snapshot);
  const state = useEntryWriteStatus({
    signature: snapshot ? JSON.stringify(rows) : null,
    operationId: snapshot?.lastOperationId,
    subject: 'Attack routine',
    scopeKey,
  });
  const [removed, setRemoved] = useState<{
    scopeKey: string;
    entryId: string;
    name: string;
    revision: number;
  } | null>(null);

  function getOperation() {
    if (!snapshot) throw new Error('Character sheet is not available.');
    return {
      ...scope,
      characterId: snapshot.character._id,
      operationId: createCharacterSheetOperationId(),
    };
  }
  function getRoutine(entryId: string) {
    const entry = recorded.find((candidate) => candidate._id === entryId);
    if (!entry) throw new Error('This attack routine is no longer available.');
    return entry;
  }
  function getWeapon(entryId: string) {
    const entry = weapons.find((candidate) => candidate.entryId === entryId);
    if (!entry)
      throw new Error(
        'This weapon is no longer available. Choose another weapon.',
      );
    return entry;
  }
  async function edit(entryId: string, patch: Partial<AttackRoutineValues>) {
    const entry = getRoutine(entryId);
    const {
      weaponEntryId,
      offHand,
      ammunitionEntryId,
      availableLimbs,
      naturalAttackEntryIds,
      options,
      ...fields
    } = patch;
    const choice =
      weaponEntryId === undefined ? null : getWeapon(weaponEntryId);
    const defaults = choice
      ? defaultAttackRoutineConfiguration(choice.weapon)
      : null;
    if (availableLimbs !== undefined) {
      const parsed = availableLimbsSchema.safeParse(availableLimbs);
      if (!parsed.success)
        throw new Error(`${parsed.error.issues[0]?.message}.`);
    }
    await editRoutine({
      ...getOperation(),
      entryId: entry._id,
      ...(defaults ? { hands: defaults.hands, mode: defaults.mode } : {}),
      ...fields,
      ...(ammunitionEntryId === undefined
        ? {}
        : { ammunitionEntryId: getAmmunitionReference(ammunitionEntryId) }),
      ...(availableLimbs === undefined
        ? {}
        : { availableLimbs: Number(availableLimbs) }),
      ...(naturalAttackEntryIds === undefined
        ? {}
        : {
            naturalAttackEntryIds: naturalAttackEntryIds.map((reference) => {
              const choice = snapshot?.entries.find(
                (candidate) => candidate._id === reference,
              );
              if (choice) return choice._id;
              const retained = entry.state.naturalAttackEntryIds?.find(
                (id) => id === reference,
              );
              if (retained) return retained;
              throw new Error(
                'This natural attack is no longer available. Choose another attack.',
              );
            }),
          }),
      ...(options === undefined
        ? {}
        : { options: options.map(getOptionReference) }),
      ...(offHand === undefined
        ? {}
        : {
            offHand:
              offHand === null
                ? null
                : offHand.kind === 'otherEnd'
                  ? offHand
                  : {
                      ...offHand,
                      weaponEntryId: getOffHandReference(offHand.weaponEntryId),
                    },
          }),
      ...(weaponEntryId === undefined
        ? {}
        : { weaponEntryId: weaponReference(choice?.entryId ?? weaponEntryId) }),
    });

    /** A retained choice stays for repair; a new one must be offered here. */
    function getOptionReference(reference: string) {
      if (isOneOf(entry.state.options ?? [], reference)) return reference;
      const offered = rows
        .find((row) => row.entryId === entry._id)
        ?.options.some(
          (option) => option.catalogEntryId === reference && option.available,
        );
      const definition = snapshot?.catalogEntries.find(
        (candidate) => candidate._id === reference,
      );
      if (!offered || !definition)
        throw new Error(
          'This option is no longer available. Choose another option.',
        );
      return definition._id;
    }
    function getAmmunitionReference(reference: string | null) {
      if (reference === null) return null;
      if (entry.state.ammunitionEntryId === reference)
        return entry.state.ammunitionEntryId;
      const choice = ammunition.find(
        (candidate) => candidate.entryId === reference,
      );
      if (!choice)
        throw new Error(
          'This ammunition is no longer available. Choose other ammunition.',
        );
      return choice.entryId;
    }

    function getOffHandReference(reference: string) {
      if (isUnarmedStrike(reference)) return UNARMED_STRIKE_ID;
      const retained =
        entry.state.offHand?.kind === 'weapon'
          ? entry.state.offHand.weaponEntryId
          : undefined;
      if (retained === reference) return retained;
      const choice = snapshot?.entries.find(
        (candidate) => candidate._id === reference,
      );
      if (choice?.kind !== 'item')
        throw new Error(
          'This off-hand weapon is no longer available. Choose another weapon.',
        );
      return choice._id;
    }
  }
  function weaponReference(reference: string) {
    if (isUnarmedStrike(reference)) return UNARMED_STRIKE_ID;
    const entry = snapshot?.entries.find(
      (candidate) => candidate._id === reference,
    );
    if (entry?.kind !== 'item')
      throw new Error(
        'This weapon is no longer available. Choose another weapon.',
      );
    return entry._id;
  }
  return {
    rows,
    weapons,
    weaponCatalog,
    ammunition,
    ammunitionCatalog,
    naturalAttacks,
    offHandChoices: (mainWeaponEntryId: string) =>
      listAttackRoutineOffHands(weapons, mainWeaponEntryId),
    statusFor: state.statusFor,
    hasRemoteChange: state.hasRemoteChange,
    dismissRemoteChange: state.dismissRemoteChange,
    operationId: snapshot?.lastOperationId,
    addWeapon: (catalogEntryId: string) =>
      state.write(
        () => {
          const choice = weaponCatalog.find(
            (entry) => entry.catalogEntryId === catalogEntryId,
          );
          if (!choice)
            throw new Error(
              'This weapon is no longer available. Choose another weapon.',
            );
          return selectEntry({
            ...getOperation(),
            catalogEntryId: choice.catalogEntryId,
          });
        },
        { key: `weapon:${catalogEntryId}`, subject: 'Weapon' },
      ),
    addAmmunition: (catalogEntryId: string) =>
      state.write(
        () => {
          const choice = ammunitionCatalog.find(
            (entry) => entry.catalogEntryId === catalogEntryId,
          );
          if (!choice)
            throw new Error(
              'This ammunition is no longer available. Choose other ammunition.',
            );
          return selectEntry({
            ...getOperation(),
            catalogEntryId: choice.catalogEntryId,
          });
        },
        { key: `ammunition:${catalogEntryId}`, subject: 'Ammunition' },
      ),
    edit,
    saveWeaponEnd: (
      weaponEntryId: string,
      end: ItemPart,
      patch: ItemPartPatch,
    ) =>
      editEquipment({
        ...getOperation(),
        entryId: gearReference(weaponEntryId),
        // A shield's own details are its bash's.
        end: end === 'primary' ? getWeapon(weaponEntryId).primaryPart : end,
        ...patch,
      }),
    /** The routine's ammunition's own details, shared by every routine firing it. */
    saveAmmunition: (entryId: string, patch: ItemPartPatch) =>
      editEquipment({
        ...getOperation(),
        entryId: gearReference(entryId),
        end: 'primary',
        ...patch,
      }),
    create: async (weaponEntryId: string) => {
      const created: {
        entryId: Awaited<ReturnType<typeof createRoutine>> | null;
      } = { entryId: null };
      await state.write(
        async () => {
          created.entryId = await createRoutine({
            ...getOperation(),
            weaponEntryId: weaponReference(getWeapon(weaponEntryId).entryId),
          });
        },
        { key: 'create' },
      );
      return created.entryId;
    },
    createNaturalAttack: (input: SheetEntryInput) =>
      createSheetEntry({ ...getOperation(), ...input }),
    editNaturalAttack: (entryId: string, input: SheetEntryInput) =>
      editSheetEntry({
        ...getOperation(),
        entryId: gearReference(entryId),
        ...input,
      }),
    remove: (entryId: string) =>
      state.write(
        async () => {
          const entry = getRoutine(entryId);
          const revision = await deleteRoutine({
            ...getOperation(),
            entryId: entry._id,
          });
          if (state.isCurrent())
            setRemoved({ scopeKey, entryId, name: entry.state.name, revision });
        },
        {
          key: entryId,
          subject:
            rows.find((row) => row.entryId === entryId)?.name ??
            'Attack routine',
        },
      ),
    removed: removed?.scopeKey === scopeKey ? removed : null,
    dismissUndo: () => setRemoved(null),
    undo: () =>
      state.write(
        async () => {
          if (removed?.scopeKey !== scopeKey)
            throw new Error('There is no attack routine to restore.');
          const entry = getRoutine(removed.entryId);
          await restoreRoutine({
            ...getOperation(),
            entryId: entry._id,
          });
          if (state.isCurrent()) setRemoved(null);
        },
        { key: 'undo', subject: 'Attack routine' },
      ),
  };
  function gearReference(reference: string) {
    const entry = snapshot?.entries.find(
      (candidate) => candidate._id === reference,
    );
    if (entry?.kind !== 'item')
      throw new Error('This attack entry is no longer available.');
    return entry._id;
  }
}
