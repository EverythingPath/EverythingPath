'use client';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import type { FunctionArgs } from 'convex/server';
import { useRef, useState } from 'react';
import {
  createCharacterSheetOperationId,
  isOwnCharacterSheetOperation,
} from '~/lib/character-sheet-operations';
import { isCatalogSheetEntry } from '~/lib/character-sheet-entries';
import {
  isUnarmedStrike,
  UNARMED_STRIKE_ID,
} from '~/lib/character-sheet-attack-types';
import { classifyWriteFailure, refusalReason } from '~/lib/write-outcome';
import type { CharacterScope } from './character-scope';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import type { SaveStatus } from './save-status';

export type AbilityChangeInput = Pick<
  FunctionArgs<typeof api.characterSheet.createAbilityChange>,
  'kind' | 'ability' | 'points'
>;
export type SheetEntryInput = Pick<
  FunctionArgs<typeof api.characterSheet.createSheetEntry>,
  'name' | 'modifiers' | 'detail' | 'casterLevel'
>;
export type SheetEntryEditInput = Pick<
  FunctionArgs<typeof api.characterSheet.editSheetEntry>,
  'name' | 'modifiers' | 'detail' | 'casterLevel' | 'active'
>;
/**
 * A Spell Effect's own state: caster level (null restores its default),
 * target (null clears it) and active flag.
 */
export type SheetEntryStateInput = Pick<
  FunctionArgs<typeof api.characterSheet.editSheetEntry>,
  'casterLevel' | 'onItem' | 'active'
>;

/** One of a Spell Effect's offered targets: an item part or the unarmed strike. */
export type SpellEffectTargetChoice = {
  entry: string;
  end: 'otherEnd' | 'bash' | null;
};

type WriteObservation<T> = {
  key: string;
  operationId: string | null | undefined;
  value: T;
};

export function useEntryWriteStatus<T = never>({
  signature = null,
  operationId,
  subject,
  scopeKey: scope = '',
  observations,
  isEqual,
}: {
  signature?: string | null;
  operationId?: string | null;
  subject: string;
  scopeKey?: string;
  observations?: WriteObservation<T>[] | null;
  isEqual?: (before: T, after: T) => boolean;
}) {
  const current = useRef({ scope, generation: 0 });
  if (current.current.scope !== scope)
    current.current = { scope, generation: current.current.generation + 1 };
  const scopeKey = `${scope}/${current.current.generation}`;
  const isCurrent = () =>
    `${current.current.scope}/${current.current.generation}` === scopeKey;
  const [statuses, setStatuses] = useState<{
    scopeKey: string;
    values: Record<string, SaveStatus>;
  }>({ scopeKey, values: {} });
  const [previous, setPrevious] = useState({
    scopeKey,
    signature,
    operationId,
    observations,
  });
  const [remoteScopeKey, setRemoteScopeKey] = useState<string | null>(null);
  const pending = useRef(new Set<string>());
  const hasObservationChange =
    observations !== undefined &&
    previous.observations !== observations &&
    (!observations ||
      observations.length !== previous.observations?.length ||
      observations.some((row, index) => {
        const old = previous.observations?.[index];
        return (
          old?.key !== row.key ||
          old.operationId !== row.operationId ||
          !(isEqual?.(old.value, row.value) ?? Object.is(old.value, row.value))
        );
      }));
  if (
    previous.scopeKey !== scopeKey ||
    previous.signature !== signature ||
    hasObservationChange
  ) {
    setPrevious({ scopeKey, signature, operationId, observations });
    if (previous.scopeKey === scopeKey) {
      if (previous.observations && observations && isEqual) {
        const before = new Map(
          previous.observations.map((row) => [row.key, row]),
        );
        const hasRemoteChange = observations.some((row) => {
          const old = before.get(row.key);
          before.delete(row.key);
          return (
            (!old || !isEqual(old.value, row.value)) &&
            (!isOwnCharacterSheetOperation(row.operationId) ||
              old?.operationId === row.operationId)
          );
        });
        if (hasRemoteChange || before.size > 0) setRemoteScopeKey(scopeKey);
      } else if (
        previous.signature !== null &&
        signature !== null &&
        (!isOwnCharacterSheetOperation(operationId) ||
          previous.operationId === operationId)
      ) {
        setRemoteScopeKey(scopeKey);
      }
    }
  }
  function update(key: string, status: SaveStatus) {
    if (!isCurrent()) return;
    setStatuses((previous) => ({
      scopeKey,
      values: {
        ...(previous.scopeKey === scopeKey ? previous.values : {}),
        [key]: status,
      },
    }));
  }
  async function write(
    action: () => Promise<unknown>,
    { key = '', subject: entrySubject = subject, plural = false } = {},
  ) {
    const pendingKey = `${scopeKey}/${key}`;
    if (!isCurrent() || pending.current.has(pendingKey)) return false;
    pending.current.add(pendingKey);
    update(key, { kind: 'saving' });
    try {
      await action();
      update(key, { kind: 'saved' });
      return true;
    } catch (error) {
      const failure = classifyWriteFailure(error);
      update(key, {
        kind: 'error',
        message:
          failure.kind === 'rejected'
            ? `${entrySubject} ${plural ? "weren't" : "wasn't"} saved${refusalReason(failure.message)} Try again.`
            : `${entrySubject} may not have been saved. Check it before trying again.`,
      });
      return false;
    } finally {
      pending.current.delete(pendingKey);
    }
  }
  function statusFor(key: string): SaveStatus {
    return statuses.scopeKey === scopeKey
      ? (statuses.values[key] ?? { kind: 'idle' })
      : { kind: 'idle' };
  }
  return {
    scopeKey,
    isCurrent,
    status: statusFor(''),
    statusFor,
    resetStatus: (key: string) => update(key, { kind: 'idle' }),
    hasRemoteChange: remoteScopeKey === scopeKey,
    dismissRemoteChange: () => setRemoteScopeKey(null),
    write,
  };
}

export function useCharacterSheetEntries(
  scope: CharacterScope,
  snapshot: CharacterSheetSnapshot | null | undefined,
) {
  const createAbilityChange = useMutation(
    api.characterSheet.createAbilityChange,
  );
  const editAbilityChange = useMutation(api.characterSheet.editAbilityChange);
  const removeAbilityChange = useMutation(
    api.characterSheet.removeAbilityChange,
  );
  const createSheetEntry = useMutation(api.characterSheet.createSheetEntry);
  const editSheetEntry = useMutation(api.characterSheet.editSheetEntry);
  const removeSheetEntry = useMutation(api.characterSheet.removeSheetEntry);
  const abilitySignature = snapshot
    ? JSON.stringify(
        snapshot.entries.filter(
          (row) => row.kind === 'abilityDamage' || row.kind === 'abilityDrain',
        ),
      )
    : null;
  const entrySignature = snapshot
    ? JSON.stringify({
        entries: snapshot.entries.filter(isCatalogSheetEntry),
        catalog: snapshot.catalogEntries.filter((row) =>
          isCatalogSheetEntry(row.detail),
        ),
      })
    : null;
  const abilityState = useEntryWriteStatus({
    signature: abilitySignature,
    operationId: snapshot?.lastOperationId,
    subject: 'Ability change',
  });
  const entryState = useEntryWriteStatus({
    signature: entrySignature,
    operationId: snapshot?.lastOperationId,
    subject: 'Character Sheet Entry',
  });
  function spellEffectTarget({
    entry,
    end,
  }: SpellEffectTargetChoice): SheetEntryStateInput['onItem'] {
    const reference:
      | Id<'characterSheetEntry'>
      | typeof UNARMED_STRIKE_ID
      | undefined = isUnarmedStrike(entry)
      ? UNARMED_STRIKE_ID
      : snapshot?.entries.find(
          (row) => row._id === entry && row.kind === 'item',
        )?._id;
    if (!reference)
      throw new Error('This target is no longer available. Choose another.');
    return { entry: reference, ...(end ? { end } : {}) };
  }
  function operation() {
    if (!snapshot) throw new Error('Character sheet is not available.');
    return {
      ...scope,
      characterId: snapshot.character._id,
      operationId: createCharacterSheetOperationId(),
    };
  }
  return {
    abilityChanges: {
      status: abilityState.status,
      hasRemoteChange: abilityState.hasRemoteChange,
      dismissRemoteChange: abilityState.dismissRemoteChange,
      create: (input: AbilityChangeInput) =>
        createAbilityChange({ ...operation(), ...input }),
      edit: (
        entryId: Id<'characterSheetEntry'>,
        input: Partial<Omit<AbilityChangeInput, 'kind'>>,
      ) => editAbilityChange({ ...operation(), entryId, ...input }),
      setActive: (entryId: Id<'characterSheetEntry'>, active: boolean) =>
        abilityState.write(() =>
          editAbilityChange({ ...operation(), entryId, active }),
        ),
      remove: (entryId: Id<'characterSheetEntry'>) =>
        abilityState.write(() =>
          removeAbilityChange({ ...operation(), entryId }),
        ),
    },
    sheetEntries: {
      status: entryState.status,
      hasRemoteChange: entryState.hasRemoteChange,
      dismissRemoteChange: entryState.dismissRemoteChange,
      create: (input: SheetEntryInput) =>
        createSheetEntry({ ...operation(), ...input }),
      edit: (entryId: Id<'characterSheetEntry'>, input: SheetEntryEditInput) =>
        editSheetEntry({ ...operation(), entryId, ...input }),
      editState: (
        entryId: Id<'characterSheetEntry'>,
        { casterLevel, onItem, active }: SheetEntryStateInput,
      ) =>
        editSheetEntry({
          ...operation(),
          entryId,
          ...(casterLevel !== undefined ? { casterLevel } : {}),
          ...(onItem !== undefined ? { onItem } : {}),
          ...(active !== undefined ? { active } : {}),
        }),
      setActive: (entryId: Id<'characterSheetEntry'>, active: boolean) =>
        entryState.write(() =>
          editSheetEntry({ ...operation(), entryId, active }),
        ),
      /**
       * A Spell Effect's target from `calculated.spellEffects[i].target
       * .options`, or null to clear it.
       */
      setTarget: (
        entryId: Id<'characterSheetEntry'>,
        target: SpellEffectTargetChoice | null,
      ) =>
        entryState.write(() =>
          editSheetEntry({
            ...operation(),
            entryId,
            onItem: target ? spellEffectTarget(target) : null,
          }),
        ),
      remove: (entryId: Id<'characterSheetEntry'>) =>
        entryState.write(() => removeSheetEntry({ ...operation(), entryId })),
    },
  };
}
