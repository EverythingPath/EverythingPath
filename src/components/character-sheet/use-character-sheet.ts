'use client';

import { useCharacterSheetEquipment } from './use-character-sheet-equipment';
import { useCharacterSheetAttacks } from './use-character-sheet-attacks';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import { useMutation, useQuery } from 'convex/react';
import { useMemo, useRef, useState, type RefObject } from 'react';
import type {
  AbilityScores,
  CreationSettings,
  SheetWarning,
} from '~/lib/character-sheet';
import {
  createCharacterSheetOperationId,
  isOwnCharacterSheetOperation,
} from '~/lib/character-sheet-operations';
import { detectRemoteSheetChange } from '~/lib/character-sheet-changes';
import { classifyWriteFailure, refusalReason } from '~/lib/write-outcome';
import type { CharacterScope } from './character-scope';
import { useCharacterSheetEntries } from './use-character-sheet-entries';
import { useCharacterSheetRaces } from './use-character-sheet-races';
import { useCharacterSheetArchetypes } from './use-character-sheet-archetypes';
import { useCharacterSheetClasses } from './use-character-sheet-classes';
import { useCharacterSheetSelections } from './use-character-sheet-selections';
import { createSelectionSlotPreview } from './character-sheet-selections-view-model';
import { useCharacterSheetGrants } from './use-character-sheet-grants';
import { useCharacterSheetSpells } from './use-character-sheet-spells';
import { useCharacterSheetSpellcastingChoices } from './use-character-sheet-spellcasting-choices';
import { useCharacterCompanions } from './use-character-companions';
import { useCharacterSheetFamiliar } from './use-character-sheet-familiar';
import type { SaveStatus } from './save-status';
import type { CharacterSheetOrigin } from '~/lib/campaign-routes';
import { buildCharacterSheetView } from './character-sheet-view-model';
import { useBuildOutCharacter } from './use-build-out-character';
import { equalClassLevels, equalAdjustments } from './sheet-state-comparison';
import { listCharacterSituationGroups } from './situations-view-model';
import type { RequestedSituation } from '~/lib/character-sheet-situations';
import { useCompleteCharacterSheet } from './use-complete-character-sheet';
import { calculateCharacterSheetPreview } from './calculate-character-sheet-preview';
import { companionCalculationOptions } from '~/lib/character-sheet-companion-calculation-inputs';

export type ClassLevelChanges = Omit<
  FunctionArgs<typeof api.characterSheet.editClassLevel>,
  'characterId' | 'organizationId' | 'campaignId' | 'operationId' | 'entryId'
>;

export type CharacterSheetSnapshot = NonNullable<
  FunctionReturnType<typeof api.characterSheet.read>
>;
export type SheetWarningView = SheetWarning & {
  accepted: boolean;
};
export type PersonalAdjustmentInput = Pick<
  FunctionArgs<typeof api.characterSheet.createPersonalAdjustment>,
  'name' | 'modifiers'
>;

function warningKey(warning: SheetWarning) {
  return JSON.stringify([warning.check, warning.subject, warning.fingerprint]);
}

export function useCharacterSheet(
  scope: CharacterScope,
  origin?: CharacterSheetOrigin,
) {
  const buildOut = useBuildOutCharacter(scope);
  const snapshot = useCompleteCharacterSheet(
    scope,
    useQuery(api.characterSheet.read, scope),
  );
  const legacyCatalogChoices = useQuery(
    api.catalogCopies.list,
    snapshot && !snapshot.catalogView
      ? { ...scope, characterId: snapshot.character._id }
      : 'skip',
  );
  const catalogChoices =
    snapshot?.catalogView?.definitions ?? legacyCatalogChoices;
  const entryWrites = useCharacterSheetEntries(scope, snapshot);
  const equipmentWrites = useCharacterSheetEquipment(scope, snapshot);
  const attacks = useCharacterSheetAttacks(scope, snapshot);
  const grants = useCharacterSheetGrants(scope, snapshot);
  const spells = useCharacterSheetSpells(scope, snapshot);
  const spellcastingChoices = useCharacterSheetSpellcastingChoices(
    scope,
    snapshot,
  );
  const companions = useCharacterCompanions(scope, snapshot, origin);
  const familiar = useCharacterSheetFamiliar(scope, snapshot, companions.rows);
  const races = useCharacterSheetRaces(scope, snapshot);
  const archetypes = useCharacterSheetArchetypes(
    scope,
    snapshot,
    catalogChoices,
  );
  const classes = useCharacterSheetClasses(scope, snapshot, catalogChoices);
  const selections = useCharacterSheetSelections(scope, snapshot);
  const previewSituation = useMemo(() => {
    const baseState = snapshot?.entries.find(
      (entry) => entry.kind === 'base',
    )?.state;
    return (situations: readonly RequestedSituation[]) =>
      snapshot
        ? calculateCharacterSheetPreview(
            snapshot,
            {
              companionProgression: baseState?.companionProgression,
              cohortEquivalence: baseState?.cohortEquivalence,
              familiarBaseCreatureKey:
                snapshot.character.familiarBaseCreatureKey,
            },
            {
              situations,
              ...companionCalculationOptions(
                snapshot.companionCalculationInputs,
              ),
              ...(snapshot.calculated.familiar
                ? {
                    familiar: {
                      baseCreatureKey:
                        snapshot.character.familiarBaseCreatureKey,
                      linkedInputs: snapshot.calculated.familiar.linkedInputs,
                    },
                  }
                : {}),
            },
          )
        : null;
  }, [snapshot]);
  const previewSelection = useMemo(
    () => createSelectionSlotPreview(snapshot, catalogChoices),
    [snapshot, catalogChoices],
  );
  const editBaseScores = useMutation(api.characterSheet.editBaseScores);
  const editClassLevel = useMutation(api.characterSheet.editClassLevel);
  const addClassLevel = useMutation(api.characterSheet.addClassLevel);
  const moveClassLevel = useMutation(api.characterSheet.moveClassLevel);
  const deleteClassLevel = useMutation(api.characterSheet.deleteClassLevel);
  const editCreationSettings = useMutation(
    api.characterSheet.editCreationSettings,
  );
  const acceptWarning = useMutation(api.characterSheet.acceptWarning);
  const reopenWarning = useMutation(api.characterSheet.reopenWarning);
  const pendingWarnings = useRef(new Set<string>());
  const expectedWarnings = useRef(
    new Map<string, { value: boolean; revision: number }>(),
  );
  const [warningStatuses, setWarningStatuses] = useState<
    Record<string, SaveStatus>
  >({});
  const [hasRemoteWarnings, setHasRemoteWarnings] = useState(false);
  const createPersonalAdjustment = useMutation(
    api.characterSheet.createPersonalAdjustment,
  );
  const editPersonalAdjustment = useMutation(
    api.characterSheet.editPersonalAdjustment,
  );
  const removePersonalAdjustment = useMutation(
    api.characterSheet.removePersonalAdjustment,
  );
  const adjustmentBusy = useRef(false);
  const [adjustmentStatus, setAdjustmentStatus] = useState<SaveStatus>({
    kind: 'idle',
  });
  const isBusy = useRef(false);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [appendedEntryId, setAppendedEntryId] =
    useState<Id<'characterSheetEntry'> | null>(null);
  const [hasRemoteChange, setHasRemoteChange] = useState(false);
  const sheet = useMemo(
    () =>
      snapshot ? buildCharacterSheetView(snapshot, catalogChoices) : snapshot,
    [snapshot, catalogChoices],
  );
  const warningStates = sheet
    ? Object.fromEntries(
        [
          ...sheet.warnings,
          ...sheet.permanentWarnings.filter(
            (warning) => warning.subject === 'companionProgression',
          ),
        ].map((warning) => [warningKey(warning), warning.accepted]),
      )
    : null;
  const [previousWarnings, setPreviousWarnings] = useState(warningStates);
  const warningChange = detectRemoteSheetChange({
    previous: previousWarnings,
    next: warningStates,
    expectedOperations: expectedWarnings.current,
    isOwnOperation: isOwnCharacterSheetOperation(snapshot?.lastOperationId),
  });
  if (warningChange.changed) {
    setPreviousWarnings(warningStates);
    for (const key of warningChange.acknowledged)
      expectedWarnings.current.delete(key);
    if (warningChange.hasRemoteChange) setHasRemoteWarnings(true);
  }
  // A successful Convex mutation has reached its query transition. Retire
  // overwritten intentions too, even when coalescing left the warning unchanged.
  for (const [key, expected] of expectedWarnings.current) {
    if (
      snapshot &&
      snapshot.revision > expected.revision &&
      !pendingWarnings.current.has(key)
    )
      expectedWarnings.current.delete(key);
  }
  const ordered = sheet?.levels ?? null;
  const [previousLevels, setPreviousLevels] = useState(ordered);
  if (!equalClassLevels(previousLevels, ordered)) {
    setPreviousLevels(ordered);
    if (
      previousLevels &&
      ordered &&
      !isOwnCharacterSheetOperation(snapshot?.lastOperationId)
    )
      setHasRemoteChange(true);
  }

  const [hasRemoteAdjustmentChange, setHasRemoteAdjustmentChange] =
    useState(false);
  const adjustments = sheet?.adjustments ?? null;
  const [previousAdjustments, setPreviousAdjustments] = useState(adjustments);
  if (!equalAdjustments(previousAdjustments, adjustments)) {
    setPreviousAdjustments(adjustments);
    if (
      previousAdjustments &&
      adjustments &&
      !isOwnCharacterSheetOperation(snapshot?.lastOperationId)
    )
      setHasRemoteAdjustmentChange(true);
  }

  function createOperation() {
    const operationId = createCharacterSheetOperationId();
    if (!snapshot) throw new Error('Character sheet is not available.');
    return { ...scope, characterId: snapshot.character._id, operationId };
  }

  async function saveBaseScores(scores: Partial<AbilityScores>) {
    await editBaseScores({ ...createOperation(), scores });
  }

  async function saveCreationSettings(settings: Partial<CreationSettings>) {
    await editCreationSettings({ ...createOperation(), settings });
  }

  async function changeWarning(warning: SheetWarningView, accept: boolean) {
    if (warning.kind !== 'rules') return;
    const key = warningKey(warning);
    if (pendingWarnings.current.has(key)) return;
    pendingWarnings.current.add(key);
    expectedWarnings.current.set(key, {
      value: accept,
      revision: snapshot?.revision ?? 0,
    });
    const updateStatus = (status: SaveStatus) =>
      setWarningStatuses((previous) => ({ ...previous, [key]: status }));
    updateStatus({ kind: 'saving' });
    try {
      const args = {
        ...createOperation(),
        check: warning.check,
        subject: warning.subject,
      };
      if (accept)
        await acceptWarning({ ...args, fingerprint: warning.fingerprint });
      else await reopenWarning(args);
      updateStatus({ kind: 'saved' });
    } catch (error) {
      expectedWarnings.current.delete(key);
      const failure = classifyWriteFailure(error);
      updateStatus({
        kind: 'error',
        message:
          failure.kind === 'rejected'
            ? `Warning wasn't saved${refusalReason(failure.message)} Try again.`
            : 'Warning may not have been saved. Check it before trying again.',
      });
    } finally {
      pendingWarnings.current.delete(key);
    }
  }

  async function saveHitPoints(
    entryId: Id<'characterSheetEntry'>,
    hpGained: number | null,
  ) {
    await editClassLevel({ ...createOperation(), entryId, hpGained });
  }

  return {
    ...entryWrites,
    ...equipmentWrites,
    attacks,
    grants,
    spells,
    spellcastingChoices,
    companions,
    familiar,
    races,
    archetypes,
    classes,
    selections: {
      ...selections,
      preview: previewSelection,
    },
    sheet,
    situations: sheet ? listCharacterSituationGroups(sheet.calculated) : [],
    findPrerequisiteName: (catalogEntryId: string) =>
      snapshot?.catalogEntries.find((entry) => entry._id === catalogEntryId)
        ?.name ?? null,
    catalogSnapshot: snapshot,
    buildOut: {
      ...buildOut,
      available: sheet?.canBuildOut ?? false,
      run: () => buildOut.run(sheet?.character),
    },
    previewSituation,
    adjustments: {
      status: adjustmentStatus,
      hasRemoteChange: hasRemoteAdjustmentChange,
      dismissRemoteChange: () => setHasRemoteAdjustmentChange(false),
      create: (input: PersonalAdjustmentInput) =>
        createPersonalAdjustment({ ...createOperation(), ...input }),
      edit: (
        entryId: Id<'characterSheetEntry'>,
        input: PersonalAdjustmentInput,
      ) => editPersonalAdjustment({ ...createOperation(), entryId, ...input }),
      setActive: (entryId: Id<'characterSheetEntry'>, active: boolean) =>
        guardedWrite({
          busy: adjustmentBusy,
          setStatus: setAdjustmentStatus,
          subject: 'Personal adjustment',
          inspect: 'it',
          write: () =>
            editPersonalAdjustment({ ...createOperation(), entryId, active }),
        }),
      remove: (entryId: Id<'characterSheetEntry'>) =>
        guardedWrite({
          busy: adjustmentBusy,
          setStatus: setAdjustmentStatus,
          subject: 'Personal adjustment',
          inspect: 'it',
          write: () =>
            removePersonalAdjustment({ ...createOperation(), entryId }),
        }),
    },
    saveBaseScores,
    saveCreationSettings,
    warnings: {
      accept: (warning: SheetWarningView) => changeWarning(warning, true),
      reopen: (warning: SheetWarningView) => changeWarning(warning, false),
      statusFor: (warning: SheetWarning): SaveStatus =>
        warningStatuses[warningKey(warning)] ?? { kind: 'idle' },
      hasRemoteChange: hasRemoteWarnings,
      dismissRemoteChange: () => setHasRemoteWarnings(false),
    },
    saveHitPoints,
    saveClassLevel: (
      entryId: Id<'characterSheetEntry'>,
      changes: ClassLevelChanges,
    ) => editClassLevel({ ...createOperation(), entryId, ...changes }),
    saveFavoredClasses: (favoredClassIds: Id<'catalogEntry'>[]) =>
      editCreationSettings({
        ...createOperation(),
        settings: {},
        favoredClassIds,
      }),
    levels: {
      status,
      hasRemoteChange,
      appendedEntryId,
      dismissRemoteChange: () => setHasRemoteChange(false),
      acknowledgeAppend: () => setAppendedEntryId(null),
      insert: (position: number) =>
        guardedWrite({
          busy: isBusy,
          setStatus,
          subject: 'Class Levels',
          inspect: 'the levels',
          write: async () => {
            setAppendedEntryId(
              await addClassLevel({ ...createOperation(), position }),
            );
          },
        }),
      add: (classEntryId?: Id<'catalogEntry'> | null) =>
        guardedWrite({
          busy: isBusy,
          setStatus,
          subject: 'Class Levels',
          inspect: 'the levels',
          write: async () => {
            setAppendedEntryId(
              await addClassLevel({
                ...createOperation(),
                ...(classEntryId !== undefined ? { classEntryId } : {}),
              }),
            );
          },
        }),
      move: (entryId: Id<'characterSheetEntry'>, position: number) =>
        guardedWrite({
          busy: isBusy,
          setStatus,
          subject: 'Class Levels',
          inspect: 'the levels',
          write: () =>
            moveClassLevel({ ...createOperation(), entryId, position }),
        }),
      remove: (entryId: Id<'characterSheetEntry'>) =>
        guardedWrite({
          busy: isBusy,
          setStatus,
          subject: 'Class Levels',
          inspect: 'the levels',
          write: () => deleteClassLevel({ ...createOperation(), entryId }),
        }),
    },
  };
}

async function guardedWrite({
  busy,
  setStatus,
  subject,
  inspect,
  write,
}: {
  busy: RefObject<boolean>;
  setStatus: (status: SaveStatus) => void;
  subject: 'Class Levels' | 'Personal adjustment';
  inspect: string;
  write: () => Promise<unknown>;
}) {
  if (busy.current) return;
  busy.current = true;
  setStatus({ kind: 'saving' });
  try {
    await write();
    setStatus({ kind: 'saved' });
  } catch (error) {
    const failure = classifyWriteFailure(error);
    const agreement = subject === 'Class Levels' ? "weren't" : "wasn't";
    setStatus({
      kind: 'error',
      message:
        failure.kind === 'rejected'
          ? `${subject} ${agreement} saved${refusalReason(failure.message)} Try again.`
          : `${subject} may not have been saved. Check ${inspect} before trying again.`,
    });
  } finally {
    busy.current = false;
  }
}
