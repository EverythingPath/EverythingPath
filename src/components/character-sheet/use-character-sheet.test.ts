import {
  calculateFixtureSheet as calculateCharacterSheet,
  calculateFixtureSheetProjections,
  buildSheet,
  storedAttackReferences,
} from './character-sheet-test-fixture';
import { useClassLevelChoicesForm } from './use-sheet-forms';
import { act, renderHook, waitFor } from '@testing-library/react';
import { convexTest } from 'convex-test';
import { beforeEach, expect, test, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import schema from '@convex/schema';
import {
  defaultAbilityScores,
  defaultCreationSettings,
} from '~/lib/character-sheet';
import type {
  CompanionLinkedInput,
  CompanionLinkedInputResolution,
} from '~/lib/character-sheet-linked-inputs';
import { useCharacterRecord } from '../character-manager/use-character-record';
import { useCreateCharacterSheet } from './use-create-character-sheet';

import {
  useCharacterSheet,
  type CharacterSheetSnapshot,
} from './use-character-sheet';
import { catalogRuntimeCompatibility } from '~/lib/catalog/runtime-compatibility';
import { retainedPriorCalculationIdentity } from '~/lib/catalog/calculation-identities';
import { reviewedCastingTablesSchema } from '~/lib/character-sheet-casting-tables';
import reviewedCastingTables from '../../../scripts/catalog/reviewed-casting-tables.json';
import { calculateCharacterSheetForRelease } from '~/lib/catalog/calculation-dispatch';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';
import type { Id } from '@convex/_generated/dataModel';

let snapshot: CharacterSheetSnapshot | null | undefined;
let catalogChoices: CharacterSheetSnapshot['catalogEntries'] | undefined;
let hasFreshSnapshot = false;
type Call = {
  name: string;
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
let calls: Call[] = [];
const nameOf = characterSheetNames();
vi.mock('convex/react', () => ({
  useQuery: (query: FunctionReference<'query'>) => {
    const name = nameOf(query);
    return name === 'read'
      ? hasFreshSnapshot && snapshot
        ? structuredClone(snapshot)
        : snapshot
      : name === 'catalogList'
        ? catalogChoices
        : name === 'companions'
          ? []
          : undefined;
  },
  useMutation: (mutation: FunctionReference<'mutation'>) => {
    const name = nameOf(mutation);
    return (args: Record<string, unknown>) =>
      new Promise((resolve, reject) => {
        calls.push({ name, args, resolve, reject });
      });
  },
}));

function isBaseCatalogEntry(
  entry: CharacterSheetSnapshot['catalogEntries'][number],
): entry is CharacterSheetSnapshot['baseScoresEntry'] {
  return entry.detail.kind === 'base';
}

vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({
    kind: 'ready',
    readOnly: false,
    message: '',
  }),
}));

test('the sheet supplies familiar editing alongside its existing spell collection controller', () => {
  const sheet = buildSheet();
  snapshot = sheet;
  const { result } = renderHook(() =>
    useCharacterSheet({ characterId: sheet.character._id }),
  );
  expect(result.current.familiar).toMatchObject({
    isAvailable: false,
    view: null,
    isDisabled: true,
  });
  expect(result.current.spells).toBeDefined();
});

async function fixture(acceptPointBuy = false) {
  const t = convexTest(schema, import.meta.glob('../../../convex/**/*.ts'));
  return await t.run(async (ctx) => {
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Demo',
      description: '',
      organizationId: 'org',
      ownerId: 'owner',
    });
    const characterId = await ctx.db.insert('character', {
      campaignId,
      name: 'Kesh',
      description: '',
      ownerId: 'owner',
      kind: 'pc',
      isActive: true,
      level: 1,
      ...defaultAbilityScores,
    });
    const baseId = await ctx.db.insert('catalogEntry', {
      characterId,
      scope: 'character',
      detail: { kind: 'base' },
      ruleIdentity: 'base-scores',
      stacksWithItself: false,
      sources: [],
      name: 'Base scores',
      modifiers: [
        { target: 'ability.str', bonusType: 'base', value: 10 },
        { target: 'ability.dex', bonusType: 'base', value: 10 },
        { target: 'ability.con', bonusType: 'base', value: 10 },
        { target: 'ability.int', bonusType: 'base', value: 10 },
        { target: 'ability.wis', bonusType: 'base', value: 10 },
        { target: 'ability.cha', bonusType: 'base', value: 10 },
      ],
    });
    const baseEntryId = await ctx.db.insert('characterSheetEntry', {
      characterId,
      kind: 'base',
      active: true,
      catalogEntryId: baseId,
      state: {
        kind: 'base',
      },
    });
    const firstId = await ctx.db.insert('characterSheetEntry', {
      characterId,
      kind: 'classLevel',
      active: true,
      state: {
        kind: 'classLevel',
        classEntryId: null,
        position: 1,
        hpGained: 8,
      },
    });
    const secondId = await ctx.db.insert('characterSheetEntry', {
      characterId,
      kind: 'classLevel',
      active: true,
      state: {
        kind: 'classLevel',
        classEntryId: null,
        position: 2,
        hpGained: 5,
      },
    });
    const adjustmentId = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Bull strength',
      ruleIdentity: 'manual:strength',
      stacksWithItself: false,
      detail: { kind: 'manual' },
      sources: [],
      modifiers: [
        { target: 'ability.str', bonusType: 'enhancement', value: 4 },
      ],
    });
    const adjustmentEntryId = await ctx.db.insert('characterSheetEntry', {
      characterId,
      kind: 'manual',
      active: true,
      catalogEntryId: adjustmentId,
      state: { kind: 'manual' },
    });
    const adjustment = await ctx.db.get('catalogEntry', adjustmentId);
    if (!adjustment) throw new Error('Missing adjustment');
    const character = await ctx.db.get('character', characterId);
    const catalogEntry = await ctx.db.get('catalogEntry', baseId);
    const entries = await Promise.all(
      [baseEntryId, firstId, secondId, adjustmentEntryId].map((id) =>
        ctx.db.get('characterSheetEntry', id),
      ),
    );
    if (
      !character ||
      !catalogEntry ||
      !isBaseCatalogEntry(catalogEntry) ||
      entries.some((entry) => entry === null)
    )
      throw new Error('Fixture missing');
    const completeEntries = entries.filter((entry) => entry !== null);
    const acceptedWarnings = [];
    if (acceptPointBuy) {
      const id = await ctx.db.insert('acceptedWarning', {
        characterId,
        check: 'pointBuy',
        subject: baseEntryId,
        fingerprint: 'spent-22-budget-15',
        acceptedBy: 'other-player',
        acceptedAt: 1,
      });
      const accepted = await ctx.db.get('acceptedWarning', id);
      if (accepted) acceptedWarnings.push(accepted);
    }
    return {
      familiarRelationshipId: null,
      companionCalculationInputs: null,
      character,
      owner: null,
      campaign: {
        campaignId,
        campaignName: 'Demo',
        organizationId: 'org',
        ownershipAvailable: true,
      },
      entries: completeEntries,
      catalogEntries: [catalogEntry, adjustment],
      baseScoresEntry: catalogEntry,
      calculated: calculateCharacterSheet({
        characterKind: character.kind,
        entries: completeEntries,
        catalogEntries: [catalogEntry, adjustment],
      }),
      permanentCalculated: calculateCharacterSheet(
        {
          characterKind: character.kind,
          entries: completeEntries,
          catalogEntries: [catalogEntry, adjustment],
        },
        { permanentOnly: true },
      ),
      acceptedWarnings,
      revision: 1,
      lastOperationId: 'seed',
      updatedBy: 'owner',
    };
  });
}

beforeEach(() => {
  calls = [];
  snapshot = undefined;
  catalogChoices = undefined;
  hasFreshSnapshot = false;
});

test('equivalent fresh sheet responses stay stable and same-revision content changes replace the complete view', () => {
  snapshot = buildSheet();
  hasFreshSnapshot = true;
  const initial = snapshot;
  const view = renderHook(() =>
    useCharacterSheet({ characterId: initial.character._id }),
  );
  const first = view.result.current.catalogSnapshot;
  view.rerender();
  expect(view.result.current.catalogSnapshot).toBe(first);
  snapshot = {
    ...initial,
    character: { ...initial.character, name: 'Updated at the table' },
    calculated: { ...initial.calculated, hp: 99 },
  };
  view.rerender();
  expect(view.result.current.sheet?.character.name).toBe(
    'Updated at the table',
  );
  expect(view.result.current.sheet?.calculated.hp).toBe(99);
  expect(view.result.current.catalogSnapshot?.revision).toBe(initial.revision);
});

test('a loading transition keeps the complete sheet and entered choices until the replacement arrives', async () => {
  snapshot = await fixture();
  const initial = snapshot;
  const first = initial.entries.find((entry) => entry.kind === 'classLevel');
  if (!first) throw new Error('Missing Class Level');
  const view = renderHook(() => {
    const controller = useCharacterSheet({
      characterId: initial.character._id,
    });
    const row = controller.sheet?.levels.find(
      (entry) => entry._id === first._id,
    );
    const choices = useClassLevelChoicesForm({
      classEntryId: row?.state.classEntryId ?? null,
      classChoices: controller.sheet?.classChoices ?? [],
      favoredClassBonus: row?.state.favoredClassBonus,
      abilityIncrease: row?.state.abilityIncrease,
      save: async (changes) => {
        await controller.saveClassLevel(first._id, changes);
      },
    });
    return { controller, choices };
  });
  act(() =>
    view.result.current.choices.form.setValue('abilityIncrease', 'strength', {
      shouldDirty: true,
    }),
  );
  snapshot = undefined;
  view.rerender();
  expect(view.result.current.controller.catalogSnapshot).toEqual(initial);
  expect(view.result.current.controller.sheet?.calculated.hp).toBe(
    initial.calculated.hp,
  );
  expect(view.result.current.choices.form.getValues('abilityIncrease')).toBe(
    'strength',
  );
  snapshot = {
    ...initial,
    revision: 2,
    calculated: { ...initial.calculated, hp: 99 },
  };
  view.rerender();
  expect(view.result.current.controller.sheet?.calculated.hp).toBe(99);
  expect(view.result.current.choices.form.getValues('abilityIncrease')).toBe(
    'strength',
  );
});

test('an open sheet switches catalog choices and calculation resources with the complete release response', () => {
  const initial = buildSheet({
    levels: [
      { id: 'wizard-1', classId: 'wizard', hp: 6 },
      { id: 'wizard-2', classId: 'wizard', hp: 4 },
      { id: 'wizard-3', classId: 'wizard', hp: 4 },
    ],
  });
  const tables = structuredClone(reviewedCastingTables);
  const row = tables.tables['prepared-full'].rows[2];
  if (!row) throw new Error('Missing casting row');
  row.spellsPerDay[1] = 7;
  const resources = {
    castingTables: reviewedCastingTablesSchema.parse(tables),
  };
  const priorIdentity = retainedPriorCalculationIdentity;
  snapshot = {
    ...initial,
    catalogView: {
      releaseNumber: 1,
      calculationIdentity: priorIdentity,
      resources: {
        castingTables: reviewedCastingTablesSchema.parse(reviewedCastingTables),
      },
      legalInputs: null,
      definitions: initial.catalogEntries,
      advisories: [],
    },
  };
  const old = snapshot;
  catalogChoices = [];
  const view = renderHook(() =>
    useCharacterSheet({ characterId: initial.character._id }),
  );
  expect(
    view.result.current.previewSituation(['Charging'])?.spellcastings[0]
      ?.slots[1]?.base,
  ).toBe(2);
  snapshot = undefined;
  catalogChoices = initial.catalogEntries.map((entry) => ({
    ...entry,
    name: 'Premature independent catalog update',
  }));
  view.rerender();
  expect(view.result.current.catalogSnapshot?.catalogView?.releaseNumber).toBe(
    1,
  );
  expect(view.result.current.catalogSnapshot?.catalogView?.definitions).toEqual(
    initial.catalogEntries,
  );
  expect(
    view.result.current.previewSituation(['Charging'])?.spellcastings[0]
      ?.slots[1]?.base,
  ).toBe(2);
  snapshot = {
    ...old,
    catalogView: {
      ...old.catalogView!,
      releaseNumber: 2,
      calculationIdentity: catalogRuntimeCompatibility.calculation,
      resources,
    },
    calculated: storedAttackReferences(
      calculateCharacterSheetForRelease(
        catalogRuntimeCompatibility.calculation,
        { ...initial, characterKind: initial.character.kind, resources },
      ),
      initial.entries,
    ),
  };
  view.rerender();
  expect(view.result.current.catalogSnapshot?.catalogView?.releaseNumber).toBe(
    2,
  );
  expect(
    view.result.current.sheet?.calculated.spellcastings[0]?.slots[1]?.base,
  ).toBe(7);
  expect(
    view.result.current.previewSituation(['Charging'])?.spellcastings[0]
      ?.slots[1]?.base,
  ).toBe(7);
});

test('a missing sheet clears the retained view and another Character never inherits it while loading', () => {
  const initial = buildSheet();
  snapshot = initial;
  let characterId = String(initial.character._id);
  const view = renderHook(() => useCharacterSheet({ characterId }));
  snapshot = null;
  view.rerender();
  expect(view.result.current.sheet).toBeNull();
  snapshot = initial;
  view.rerender();
  characterId = 'other-character';
  snapshot = undefined;
  view.rerender();
  expect(view.result.current.sheet).toBeUndefined();
  expect(view.result.current.catalogSnapshot).toBeUndefined();
});

test('the race picker selects the available shared race while its statistics copy stays on the sheet', () => {
  const initial = buildSheet({ race: { key: 'human', hitDice: 2 } });
  const original = initial.catalogEntries.find(
    (entry) => entry.detail.kind === 'race' && entry.ruleIdentity === 'human',
  );
  const otherRace = initial.catalogEntries.find(
    (entry) => entry.detail.kind === 'race' && entry.ruleIdentity !== 'human',
  );
  if (!original || !otherRace) throw new Error('Missing race definitions');
  const copy = {
    ...original,
    _id: otherRace._id,
    racialStatisticsCopy: true as const,
    copiedFrom: original._id,
  };
  snapshot = {
    ...initial,
    catalogEntries: [
      ...initial.catalogEntries.filter(
        (entry) => entry._id !== original._id && entry._id !== copy._id,
      ),
      copy,
    ],
    entries: initial.entries.map((entry) =>
      entry.kind === 'race'
        ? { ...entry, catalogEntryId: copy._id, catalogOverride: true }
        : entry,
    ),
  };
  catalogChoices = [{ ...original, scope: 'global', characterId: undefined }];
  const view = renderHook(() =>
    useCharacterSheet({ characterId: initial.character._id }),
  );
  expect(view.result.current.sheet?.races.raceOptions).toContainEqual(
    expect.objectContaining({ catalogEntryId: original._id }),
  );
  expect(view.result.current.sheet?.races.raceOptions).not.toContainEqual(
    expect.objectContaining({ catalogEntryId: copy._id }),
  );
  expect(view.result.current.sheet?.races.selectedRaceId).toBe(original._id);
  expect(view.result.current.sheet?.raceStatistics?.racialHitDice).toBe(2);
  expect(view.result.current.sheet?.calculated).toMatchObject({
    hitDice: initial.calculated.hitDice,
    level: initial.calculated.level,
  });
});

test('the shared controller exposes race selection and ability choices with campaign scope and separate acknowledgements', async () => {
  snapshot = buildSheet({ race: { key: 'human' } });
  const initial = snapshot;
  const race = initial.catalogEntries.find(
    (entry) => entry.detail.kind === 'race' && entry.ruleIdentity === 'human',
  );
  if (!race) throw new Error('Expected the Human race');
  if (!initial.campaign) throw new Error('Expected a campaign');
  const scope = {
    organizationId: 'org',
    campaignId: initial.campaign.campaignId,
    characterId: initial.character._id,
  };
  const view = renderHook(() => useCharacterSheet(scope));
  let selection: Promise<boolean> | undefined;
  act(() => {
    selection = view.result.current.races.selectRace(race._id);
  });
  expect(calls[0]).toMatchObject({
    name: 'selectRace',
    args: {
      ...scope,
      catalogEntryId: race._id,
      operationId: expect.any(String),
    },
  });
  expect(view.result.current.races.statusFor('race')).toEqual({
    kind: 'saving',
  });
  expect(view.result.current.races.statusFor('ability')).toEqual({
    kind: 'idle',
  });
  const grantKey = { source: 'human', entry: 'human-ability' };
  let choice: Promise<boolean> | undefined;
  act(() => {
    choice = view.result.current.races.chooseAbilityScore(
      { grantKey },
      'constitution',
      'ability',
    );
  });
  expect(calls[1]).toMatchObject({
    name: 'chooseRacialAbilityScore',
    args: {
      ...scope,
      target: { grantKey },
      ability: 'constitution',
      operationId: expect.any(String),
    },
  });
  await act(async () => {
    calls[1]?.resolve(null);
    expect(await choice).toBe(true);
  });
  expect(view.result.current.races.statusFor('ability')).toEqual({
    kind: 'saved',
  });
  expect(view.result.current.races.statusFor('race')).toEqual({
    kind: 'saving',
  });
  await act(async () => {
    calls[0]?.resolve(race._id);
    expect(await selection).toBe(true);
  });
  expect(view.result.current.races.statusFor('race')).toEqual({
    kind: 'saved',
  });
  expect(view.result.current.companions.rows).toEqual([]);
});

test('the shared sheet exposes ordered stable level identities and localizes a rejected move', async () => {
  snapshot = await fixture();
  const initial = snapshot;
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  const [first, second] = view.result.current.sheet?.levels ?? [];
  if (!first || !second) throw new Error('Expected two levels');
  let move: Promise<void> | undefined;
  act(() => {
    move = view.result.current.levels.move(second._id, 1);
  });
  expect(view.result.current.levels.status.kind).toBe('saving');
  await act(async () => {
    calls[0]?.reject(new ConvexError('Move refused'));
    await move;
  });
  expect(view.result.current.levels.status).toEqual({
    kind: 'error',
    message: "Class Levels weren't saved: Move refused. Try again.",
  });
  expect(view.result.current.sheet?.levels.map((row) => row._id)).toEqual([
    first._id,
    second._id,
  ]);
});

test('a remote reorder carries row HP with its identity, and deleting the final level leaves a warning', async () => {
  snapshot = await fixture();
  const initial = snapshot;
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  const originals = view.result.current.sheet?.levels ?? [];
  snapshot = {
    ...initial,
    revision: 2,
    lastOperationId: 'other-player',
    entries: [...initial.entries].reverse().map((entry) =>
      entry.kind === 'classLevel'
        ? {
            ...entry,
            state: { ...entry.state, position: 3 - entry.state.position },
          }
        : entry,
    ),
  };
  view.rerender();
  expect(
    view.result.current.sheet?.levels.map((entry) => [
      entry._id,
      entry.state.hpGained,
    ]),
  ).toEqual([
    [originals[1]?._id, 5],
    [originals[0]?._id, 8],
  ]);
  expect(view.result.current.levels.hasRemoteChange).toBe(true);
  snapshot = {
    ...snapshot,
    revision: 3,
    lastOperationId: 'delete-other',
    entries: initial.entries.filter((entry) => entry.kind === 'base'),
    calculated: calculateCharacterSheet({
      entries: initial.entries.filter((entry) => entry.kind === 'base'),
      catalogEntries: initial.catalogEntries,
      characterKind: 'pc',
    }),
  };
  view.rerender();
  expect(view.result.current.sheet?.calculated.level).toBe(0);
  expect(view.result.current.sheet?.calculated.hp).toBe(0);
  expect(view.result.current.sheet?.warning).toBeNull();
  expect(view.result.current.sheet?.warnings).toContainEqual(
    expect.objectContaining({
      check: 'levelZero',
      message: 'A PC has no Class Levels.',
    }),
  );
});

test('a local move waits once and its own echo never reports another player', async () => {
  snapshot = await fixture();
  const initial = snapshot;
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  const second = view.result.current.sheet?.levels[1];
  if (!second) throw new Error('Expected level');
  let pending: Promise<void> | undefined;
  act(() => {
    pending = view.result.current.levels.move(second._id, 1);
  });
  await act(async () => {
    await view.result.current.levels.remove(second._id);
  });
  expect(calls).toHaveLength(1);
  const operationId = calls[0]?.args.operationId;
  if (typeof operationId !== 'string') throw new Error('Expected operation ID');
  snapshot = {
    ...initial,
    revision: 2,
    lastOperationId: operationId,
    entries: [...initial.entries].reverse().map((entry) =>
      entry.kind === 'classLevel'
        ? {
            ...entry,
            state: { ...entry.state, position: 3 - entry.state.position },
          }
        : entry,
    ),
  };
  view.rerender();
  expect(view.result.current.levels.hasRemoteChange).toBe(false);
  await act(async () => {
    calls[0]?.resolve(null);
    await pending;
  });
  expect(view.result.current.levels.status.kind).toBe('saved');
});

test('creation validates the name, holds one pending request and opens the created sheet', async () => {
  const initial = await fixture();
  const opened: string[] = [];
  const view = renderHook(() =>
    useCreateCharacterSheet({
      organizationId: 'org',
      campaignId: initial.character.campaignId,
      onCreated: (id) => {
        opened.push(id);
      },
    }),
  );
  await act(async () => {
    await view.result.current.create();
  });
  expect(view.result.current.form.formState.errors.name?.message).toBe(
    'Character name is required',
  );
  expect(calls).toHaveLength(0);
  act(() =>
    view.result.current.form.setValue('name', 'New hero', {
      shouldDirty: true,
    }),
  );
  let pending: Promise<void> | undefined;
  await act(async () => {
    pending = view.result.current.create();
  });
  await act(async () => {
    await view.result.current.create();
  });
  expect(calls).toHaveLength(1);
  expect(view.result.current.status.kind).toBe('saving');
  await act(async () => {
    calls[0]?.resolve(initial.character._id);
    await pending;
  });
  expect(opened).toEqual([initial.character._id]);
});

test('sheet rules warnings expose inline targets, preserve incomplete choices and localize refusal', async () => {
  snapshot = await fixture();
  const initial = snapshot;
  snapshot = {
    ...initial,
    calculated: {
      ...initial.calculated,
      warnings: [
        {
          kind: 'rules',
          check: 'pointBuy' as const,
          target: { kind: 'pointBuy' as const },
          subject: initial.entries[0]!._id,
          fingerprint: 'spent-22-budget-15',
          message: '22 points exceeds 15.',
        },
        {
          kind: 'incomplete',
          check: 'class',
          target: {
            kind: 'classLevel',
            entryId: initial.entries[1]!._id,
            field: 'class',
          },
          subject: initial.entries[1]!._id,
          fingerprint: 'class-unfilled',
          message: 'Choose a class.',
        },
      ],
    },
  };
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  const [rule, incomplete] = view.result.current.sheet!.warnings;
  if (!rule || !incomplete) throw new Error('Expected warnings');
  expect(rule).toMatchObject({ accepted: false, target: { kind: 'pointBuy' } });
  expect(incomplete).toMatchObject({
    accepted: false,
    target: {
      kind: 'classLevel',
      entryId: initial.entries[1]!._id,
      field: 'class',
    },
  });
  await act(async () => {
    await view.result.current.warnings.accept(incomplete);
  });
  expect(calls).toEqual([]);
  let pending: Promise<void> | undefined;
  act(() => {
    pending = view.result.current.warnings.accept(rule);
  });
  expect(view.result.current.warnings.statusFor(rule).kind).toBe('saving');
  expect(view.result.current.warnings.statusFor(incomplete).kind).toBe('idle');
  await act(async () => {
    calls[0]?.reject(new ConvexError('Editing is paused'));
    await pending;
  });
  expect(view.result.current.warnings.statusFor(rule)).toEqual({
    kind: 'error',
    message: "Warning wasn't saved: Editing is paused. Try again.",
  });
  expect(view.result.current.sheet!.warnings[0]?.accepted).toBe(false);
  expect(view.result.current.sheet!.calculated.hp).toBe(initial.calculated.hp);
});

test('remote acceptance is announced even when combined with an unrelated local save', async () => {
  const initial = await fixture(true);
  const calculated = {
    ...initial.calculated,
    warnings: [
      {
        kind: 'rules' as const,
        check: 'pointBuy' as const,
        target: { kind: 'pointBuy' as const },
        subject: initial.entries[0]!._id,
        fingerprint: 'spent-22-budget-15',
        message: '22 points exceeds 15.',
      },
    ],
  };
  snapshot = { ...initial, calculated, acceptedWarnings: [] };
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  let save: Promise<void> | undefined;
  act(() => {
    save = view.result.current.saveHitPoints(initial.entries[1]!._id, 10);
  });
  const operationId = calls[0]?.args.operationId;
  if (typeof operationId !== 'string') throw new Error('Expected operation ID');
  snapshot = { ...initial, calculated, lastOperationId: operationId };
  view.rerender();
  expect(view.result.current.sheet!.warnings[0]?.accepted).toBe(true);
  expect(view.result.current.warnings.hasRemoteChange).toBe(true);
  await act(async () => {
    calls[0]?.resolve(null);
    await save;
  });
});

test('own acceptance echoes stay quiet, unrelated edits preserve it and another player can reopen it', async () => {
  const initial = await fixture(true);
  const calculated = {
    ...initial.calculated,
    warnings: [
      {
        kind: 'rules' as const,
        check: 'pointBuy' as const,
        target: { kind: 'pointBuy' as const },
        subject: initial.entries[0]!._id,
        fingerprint: 'spent-22-budget-15',
        message: '22 points exceeds 15.',
      },
    ],
  };
  snapshot = { ...initial, calculated, acceptedWarnings: [] };
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  const warning = view.result.current.sheet!.warnings[0]!;
  let pending: Promise<void> | undefined;
  act(() => {
    pending = view.result.current.warnings.accept(warning);
  });
  const operationId = calls[0]?.args.operationId;
  if (typeof operationId !== 'string') throw new Error('Expected operation ID');
  snapshot = { ...initial, calculated, lastOperationId: operationId };
  view.rerender();
  expect(view.result.current.sheet!.warnings[0]?.accepted).toBe(true);
  expect(view.result.current.warnings.hasRemoteChange).toBe(false);
  await act(async () => {
    calls[0]?.resolve(null);
    await pending;
  });
  expect(view.result.current.warnings.statusFor(warning).kind).toBe('saved');
  snapshot = {
    ...snapshot,
    character: { ...initial.character, description: 'A new note' },
    lastOperationId: 'other-player-note',
  };
  view.rerender();
  expect(view.result.current.sheet!.warnings[0]?.accepted).toBe(true);
  expect(view.result.current.warnings.hasRemoteChange).toBe(false);
  snapshot = {
    ...snapshot,
    acceptedWarnings: [],
    lastOperationId: 'other-player-reopen',
  };
  view.rerender();
  expect(view.result.current.sheet!.warnings[0]?.accepted).toBe(false);
  expect(view.result.current.warnings.hasRemoteChange).toBe(true);
});

test('changed facts reopen a warning while an earlier acceptance is still pending', async () => {
  const initial = await fixture(true);
  const warning = {
    kind: 'rules' as const,
    check: 'pointBuy' as const,
    target: { kind: 'pointBuy' as const },
    subject: initial.entries[0]!._id,
    fingerprint: 'spent-22-budget-15',
    message: '22 points exceeds 15.',
  };
  snapshot = {
    ...initial,
    calculated: { ...initial.calculated, warnings: [warning] },
    acceptedWarnings: [],
  };
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  let pending: Promise<void> | undefined;
  act(() => {
    pending = view.result.current.warnings.accept(
      view.result.current.sheet!.warnings[0]!,
    );
  });
  snapshot = {
    ...initial,
    lastOperationId: 'other-player-scores',
    calculated: {
      ...initial.calculated,
      warnings: [
        {
          ...warning,
          fingerprint: 'spent-25-budget-15',
          message: '25 points exceeds 15.',
        },
      ],
    },
  };
  view.rerender();
  const changed = view.result.current.sheet!.warnings[0]!;
  expect(changed.accepted).toBe(false);
  expect(view.result.current.warnings.statusFor(changed).kind).toBe('idle');
  await act(async () => {
    calls[0]?.resolve(null);
    await pending;
  });
  expect(view.result.current.sheet!.warnings[0]?.accepted).toBe(false);
  expect(view.result.current.sheet!.calculated.hp).toBe(initial.calculated.hp);
});

test('an own acceptance echo combined with an unrelated remote edit is not a remote warning change', async () => {
  const initial = await fixture(true);
  const calculated = {
    ...initial.calculated,
    warnings: [
      {
        kind: 'rules' as const,
        check: 'pointBuy' as const,
        target: { kind: 'pointBuy' as const },
        subject: initial.entries[0]!._id,
        fingerprint: 'spent-22-budget-15',
        message: '22 points exceeds 15.',
      },
    ],
  };
  snapshot = { ...initial, calculated, acceptedWarnings: [] };
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  let pending: Promise<void> | undefined;
  act(() => {
    pending = view.result.current.warnings.accept(
      view.result.current.sheet!.warnings[0]!,
    );
  });
  snapshot = { ...initial, calculated, lastOperationId: 'remote-note-edit' };
  view.rerender();
  expect(view.result.current.sheet!.warnings[0]?.accepted).toBe(true);
  expect(view.result.current.warnings.hasRemoteChange).toBe(false);
  await act(async () => {
    calls[0]?.resolve(null);
    await pending;
  });
});

test('a coalesced reopen retires completed acceptance so a later remote acceptance is announced', async () => {
  const initial = await fixture(true);
  const calculated = {
    ...initial.calculated,
    warnings: [
      {
        kind: 'rules' as const,
        check: 'pointBuy' as const,
        target: { kind: 'pointBuy' as const },
        subject: initial.entries[0]!._id,
        fingerprint: 'spent-22-budget-15',
        message: '22 points exceeds 15.',
      },
    ],
  };
  snapshot = { ...initial, calculated, acceptedWarnings: [] };
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  let pending: Promise<void> | undefined;
  act(() => {
    pending = view.result.current.warnings.accept(
      view.result.current.sheet!.warnings[0]!,
    );
  });
  snapshot = { ...snapshot, revision: 3, lastOperationId: 'remote-reopen' };
  view.rerender();
  await act(async () => {
    calls[0]?.resolve(null);
    await pending;
  });
  expect(view.result.current.sheet!.warnings[0]?.accepted).toBe(false);
  snapshot = {
    ...initial,
    calculated,
    revision: 4,
    lastOperationId: 'later-remote-accept',
  };
  view.rerender();
  expect(view.result.current.sheet!.warnings[0]?.accepted).toBe(true);
  expect(view.result.current.warnings.hasRemoteChange).toBe(true);
});

test('an own echo after the save reply is acknowledged while the previous revision is still displayed', async () => {
  const initial = await fixture(true);
  const calculated = {
    ...initial.calculated,
    warnings: [
      {
        kind: 'rules' as const,
        check: 'pointBuy' as const,
        target: { kind: 'pointBuy' as const },
        subject: initial.entries[0]!._id,
        fingerprint: 'spent-22-budget-15',
        message: '22 points exceeds 15.',
      },
    ],
  };
  snapshot = { ...initial, calculated, acceptedWarnings: [] };
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  let pending: Promise<void> | undefined;
  act(() => {
    pending = view.result.current.warnings.accept(
      view.result.current.sheet!.warnings[0]!,
    );
  });
  const operationId = calls[0]?.args.operationId;
  if (typeof operationId !== 'string') throw new Error('Expected operation ID');
  await act(async () => {
    calls[0]?.resolve(null);
    await pending;
  });
  snapshot = {
    ...initial,
    calculated,
    revision: 2,
    lastOperationId: operationId,
  };
  view.rerender();
  expect(view.result.current.sheet!.warnings[0]?.accepted).toBe(true);
  expect(view.result.current.warnings.hasRemoteChange).toBe(false);
});

test.each(['own', 'another session'])(
  'a kind edit from %s reports warning changes only to other sessions',
  async (session) => {
    const seeded = await fixture();
    const entries = seeded.entries.filter((entry) => entry.kind === 'base');
    snapshot = {
      ...seeded,
      entries,
      calculated: calculateCharacterSheet({
        entries,
        catalogEntries: seeded.catalogEntries,
        characterKind: 'pc',
      }),
      permanentCalculated: calculateCharacterSheet(
        {
          entries,
          catalogEntries: seeded.catalogEntries,
          characterKind: 'pc',
        },
        { permanentOnly: true },
      ),
    };
    const initial = snapshot;
    const campaignId = initial.character.campaignId;
    if (!campaignId) throw new Error('Expected a campaign Character');
    const sheet = renderHook(() =>
      useCharacterSheet({
        organizationId: 'org',
        characterId: initial.character._id,
      }),
    );
    const record = renderHook(() =>
      useCharacterRecord({
        organizationId: 'org',
        campaignId,
        record: {
          ...initial.character,
          owner: initial.owner,
          ownershipAvailable: initial.campaign?.ownershipAvailable ?? false,
        },
        onSaved: vi.fn(),
      }),
    );
    act(() => {
      record.result.current.form.setValue('kind', 'npc', { shouldDirty: true });
      record.result.current.save();
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    const call = calls[0]!;
    expect(call.name).toBe('kind');
    expect(call.args.operationId).toEqual(expect.any(String));
    snapshot = {
      ...initial,
      character: { ...initial.character, kind: 'npc' },
      calculated: calculateCharacterSheet({
        entries,
        catalogEntries: initial.catalogEntries,
        characterKind: 'npc',
      }),
      permanentCalculated: calculateCharacterSheet(
        {
          entries,
          catalogEntries: initial.catalogEntries,
          characterKind: 'npc',
        },
        { permanentOnly: true },
      ),
      revision: 2,
      lastOperationId:
        session === 'own'
          ? String(call.args.operationId)
          : 'other-session:kind-edit',
      updatedBy: initial.updatedBy,
    };
    sheet.rerender();
    expect(
      sheet.result.current.sheet!.warnings.some(
        (warning) => warning.check === 'levelZero',
      ),
    ).toBe(false);
    expect(sheet.result.current.warnings.hasRemoteChange).toBe(
      session !== 'own',
    );
    await act(async () => call.resolve(null));
  },
);

test('a personal Strength adjustment changes the total without changing base scores or point buy', async () => {
  // CRB Ability Scores: point buy purchases the base score before other adjustments.
  const initial = await fixture();
  const entries = initial.entries.map((entry) =>
    entry.kind === 'base'
      ? { ...entry, state: { ...entry.state, ...defaultCreationSettings } }
      : entry,
  );
  const catalogEntries = initial.catalogEntries.map((entry) =>
    entry.detail.kind === 'manual'
      ? {
          ...entry,
          detail: { kind: 'manual' as const },
          modifiers: [
            {
              target: 'ability.str' as const,
              bonusType: 'enhancement' as const,
              value: 2,
            },
          ],
        }
      : entry,
  );
  snapshot = {
    ...initial,
    entries,
    catalogEntries,
    calculated: calculateCharacterSheet({
      entries,
      catalogEntries,
      characterKind: 'pc',
    }),
    permanentCalculated: calculateCharacterSheet(
      {
        entries,
        catalogEntries,
        characterKind: 'pc',
      },
      { permanentOnly: true },
    ),
  };
  const view = renderHook(() =>
    useCharacterSheet({ organizationId: 'org', characterId: 'hero' }),
  );
  expect(view.result.current.sheet?.baseScores.strength).toBe(10);
  expect(view.result.current.sheet?.calculated.abilities.strength.score).toBe(
    12,
  );
  expect(view.result.current.sheet?.calculated.pointBuy?.spent).toBe(0);
});

test('personal adjustments expose their saved definition and keep refused changes local', async () => {
  snapshot = await fixture();
  const view = renderHook(() =>
    useCharacterSheet({ organizationId: 'org', characterId: 'hero' }),
  );
  const adjustment = view.result.current.sheet?.adjustments[0];
  if (!adjustment) throw new Error('Expected adjustment');
  expect(adjustment.name).toBe('Bull strength');
  expect(adjustment.modifiers).toEqual([
    { target: 'ability.str', bonusType: 'enhancement', value: 4 },
  ]);
  let pending: Promise<void> | undefined;
  act(() => {
    pending = view.result.current.adjustments.setActive(
      adjustment.entryId,
      false,
    );
  });
  expect(view.result.current.adjustments.status.kind).toBe('saving');
  expect(calls[0]?.args).toMatchObject({
    entryId: adjustment.entryId,
    active: false,
  });
  expect(calls[0]?.args).not.toHaveProperty('name');
  expect(calls[0]?.args).not.toHaveProperty('modifiers');
  await act(async () => {
    calls[0]?.reject(new ConvexError('Editing is paused'));
    await pending;
  });
  expect(view.result.current.adjustments.status).toEqual({
    kind: 'error',
    message: "Personal adjustment wasn't saved: Editing is paused. Try again.",
  });
  expect(view.result.current.sheet?.adjustments[0]?.active).toBe(true);
});

test('adjustment changes from another player are marked while own echoes stay quiet', async () => {
  snapshot = await fixture();
  const initial = snapshot;
  const view = renderHook(() =>
    useCharacterSheet({ organizationId: 'org', characterId: 'hero' }),
  );
  const adjustment = view.result.current.sheet?.adjustments[0];
  if (!adjustment) throw new Error('Expected adjustment');
  let pending: Promise<void> | undefined;
  act(() => {
    pending = view.result.current.adjustments.setActive(
      adjustment.entryId,
      false,
    );
  });
  const operationId = calls[0]?.args.operationId;
  if (typeof operationId !== 'string') throw new Error('Expected operation ID');
  snapshot = {
    ...initial,
    revision: 2,
    lastOperationId: operationId,
    entries: initial.entries.map((entry) =>
      entry.kind === 'manual' ? { ...entry, active: false } : entry,
    ),
  };
  view.rerender();
  expect(view.result.current.adjustments.hasRemoteChange).toBe(false);
  await act(async () => {
    calls[0]?.resolve(null);
    await pending;
  });
  expect(view.result.current.adjustments.status.kind).toBe('saved');
  snapshot = {
    ...snapshot,
    revision: 3,
    lastOperationId: 'other-player',
    catalogEntries: snapshot.catalogEntries.map((entry) =>
      entry.detail.kind === 'manual'
        ? { ...entry, name: 'Updated strength' }
        : entry,
    ),
  };
  view.rerender();
  expect(view.result.current.adjustments.hasRemoteChange).toBe(true);
  expect(view.result.current.sheet?.adjustments[0]?.name).toBe(
    'Updated strength',
  );
  act(() => view.result.current.adjustments.dismissRemoteChange());
  expect(view.result.current.adjustments.hasRemoteChange).toBe(false);
});

test('a minimal sheet offers Build out and shows only the structured level-zero warning', async () => {
  const initial = await fixture(true);
  const entries = initial.entries.filter((entry) => entry.kind === 'base');
  snapshot = {
    ...initial,
    character: { ...initial.character, sheetMode: 'militiaOnly' },
    entries,
    calculated: calculateCharacterSheet({
      entries,
      catalogEntries: initial.catalogEntries,
      characterKind: 'pc',
      sheetMode: 'militiaOnly',
    }),
  };
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  expect(view.result.current.sheet?.warnings).toEqual([
    expect.objectContaining({
      check: 'levelZero',
      target: { kind: 'classLevels' },
      accepted: false,
    }),
  ]);
  expect(view.result.current.sheet?.showMissingChoices).toBe(false);
  expect(view.result.current.sheet?.warning).toBe('A PC has no Class Levels.');
  expect(view.result.current.buildOut.available).toBe(true);
  snapshot = {
    ...snapshot,
    character: { ...snapshot.character, kind: 'npc' },
    calculated: calculateCharacterSheet({
      entries,
      catalogEntries: initial.catalogEntries,
      characterKind: 'npc',
      sheetMode: 'militiaOnly',
    }),
  };
  view.rerender();
  expect(view.result.current.sheet?.warnings).toEqual([]);
  expect(view.result.current.sheet?.warning).toBeNull();
});

test.each(['own', 'another session'])(
  'Build out from %s announces new warnings only to other sessions',
  async (session) => {
    const initial = await fixture();
    snapshot = {
      ...initial,
      character: { ...initial.character, sheetMode: 'militiaOnly' },
      calculated: calculateCharacterSheet({
        ...initial,
        characterKind: initial.character.kind,
        sheetMode: 'militiaOnly',
      }),
    };
    const view = renderHook(() =>
      useCharacterSheet({
        organizationId: 'org',
        characterId: initial.character._id,
      }),
    );
    expect(view.result.current.sheet?.warnings).toEqual([]);
    let pending: Promise<unknown> | undefined;
    act(() => {
      pending = view.result.current.buildOut.run();
    });
    const call = required(calls[0]);
    expect(call.name).toBe('buildOut');
    snapshot = {
      ...initial,
      character: { ...initial.character, sheetMode: 'full' },
      revision: 2,
      lastOperationId:
        session === 'own'
          ? String(call.args.operationId)
          : 'other-session:build-out',
    };
    view.rerender();
    expect(view.result.current.sheet?.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          check: 'class',
          target: {
            kind: 'classLevel',
            entryId: required(initial.entries[1])._id,
            field: 'class',
          },
        }),
      ]),
    );
    expect(view.result.current.sheet?.showMissingChoices).toBe(true);
    expect(view.result.current.buildOut.available).toBe(false);
    expect(view.result.current.warnings.hasRemoteChange).toBe(
      session !== 'own',
    );
    await act(async () => {
      call.resolve(null);
      await pending;
    });
  },
);

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Expected fixture value');
  return value;
}

test('Character Sheet Entries and ability changes expose save acknowledgements and localize refused writes', async () => {
  snapshot = await fixture();
  const initial = snapshot;
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  expect(
    view.result.current.sheet?.permanentCalculated.abilities.strength.score,
  ).toBe(14);
  let pending: Promise<boolean> | undefined;
  act(() => {
    pending = view.result.current.abilityChanges.setActive(
      initial.entries[0]!._id,
      false,
    );
  });
  expect(view.result.current.abilityChanges.status.kind).toBe('saving');
  expect(calls[0]?.name).toBe('editAbilityChange');
  await act(async () => {
    calls[0]?.reject(new ConvexError('Editing is paused'));
    await pending;
  });
  expect(view.result.current.abilityChanges.status.kind).toBe('error');
  act(() => {
    pending = view.result.current.sheetEntries.remove(initial.entries[0]!._id);
  });
  expect(view.result.current.sheetEntries.status.kind).toBe('saving');
  expect(calls[1]?.name).toBe('removeSheetEntry');
  await act(async () => {
    calls[1]?.resolve(null);
    await pending;
  });
  expect(view.result.current.sheetEntries.status.kind).toBe('saved');
});

test('level-up and insertion return a scroll target to the initiating device only and keep HP out of the command', async () => {
  snapshot = await fixture();
  const initial = snapshot;
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  const classEntryId = initial.baseScoresEntry._id;
  const levelId = view.result.current.sheet?.levels[0]?._id;
  if (!levelId) throw new Error('Missing row');
  let pending: Promise<void> | undefined;
  act(() => {
    pending = view.result.current.levels.add(classEntryId);
  });
  expect(calls[0]?.args).toMatchObject({ classEntryId });
  expect(calls[0]?.args).not.toHaveProperty('hpGained');
  await act(async () => {
    calls[0]?.resolve(levelId);
    await pending;
  });
  expect(view.result.current.levels.appendedEntryId).toBe(levelId);
  act(() => view.result.current.levels.acknowledgeAppend());
  expect(view.result.current.levels.appendedEntryId).toBeNull();
  snapshot = { ...initial, revision: 2, lastOperationId: 'remote-level-up' };
  view.rerender();
  expect(view.result.current.levels.appendedEntryId).toBeNull();
  act(() => {
    pending = view.result.current.levels.insert(1);
  });
  expect(calls[1]?.args).toMatchObject({ position: 1 });
  await act(async () => {
    calls[1]?.resolve(levelId);
    await pending;
  });
  expect(view.result.current.levels.appendedEntryId).toBe(levelId);
});

test('a rejected choice-form mutation retains the draft and retries it through the sheet writer', async () => {
  snapshot = await fixture();
  const first = snapshot.entries.find((entry) => entry.kind === 'classLevel');
  if (!first) throw new Error('Missing row');
  const view = renderHook(() => {
    const controller = useCharacterSheet({
      organizationId: 'org',
      characterId: first.characterId,
    });
    const row = controller.sheet?.levels.find(
      (entry) => entry._id === first._id,
    );
    const choices = useClassLevelChoicesForm({
      classEntryId: row?.state.classEntryId ?? null,
      classChoices: controller.sheet?.classChoices ?? [],
      favoredClassBonus: row?.state.favoredClassBonus,
      abilityIncrease: row?.state.abilityIncrease,
      save: async (changes) => {
        await controller.saveClassLevel(first._id, changes);
      },
    });
    return { controller, choices };
  });
  act(() =>
    view.result.current.choices.form.setValue('abilityIncrease', 'strength', {
      shouldDirty: true,
    }),
  );
  let pending: Promise<void> | undefined;
  act(() => {
    pending = view.result.current.choices.save();
  });
  await waitFor(() => expect(calls).toHaveLength(1));
  await act(async () => {
    calls[0]?.reject(new ConvexError('Editing is paused'));
    await pending;
  });
  expect(view.result.current.choices.status.kind).toBe('error');
  expect(view.result.current.choices.form.getValues('abilityIncrease')).toBe(
    'strength',
  );
  act(() => {
    pending = view.result.current.choices.save();
  });
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(calls[1]?.args).toMatchObject({
    entryId: first._id,
    abilityIncrease: 'strength',
  });
  await act(async () => {
    calls[1]?.resolve(null);
    await pending;
  });
  expect(view.result.current.choices.status.kind).toBe('saved');
});

test('a selection linked to a deleted Class Level is exposed as unplaced without moving to its successor', async () => {
  snapshot = await fixture();
  const initial = snapshot;
  const first = initial.entries.find((entry) => entry.kind === 'classLevel');
  const selection = initial.entries.find((entry) => entry.kind === 'manual');
  if (!first || !selection) throw new Error('Missing fixtures');
  snapshot = {
    ...initial,
    entries: initial.entries.map((entry) =>
      entry._id === selection._id && entry.kind === 'manual'
        ? { ...entry, gainedAtClassLevel: first._id }
        : entry,
    ),
  };
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  expect(view.result.current.sheet?.unplacedSelections).toEqual([]);
  snapshot = {
    ...snapshot,
    revision: 2,
    lastOperationId: 'delete-level',
    entries: snapshot.entries
      .filter((entry) => entry._id !== first._id)
      .map((entry) =>
        entry.kind === 'classLevel'
          ? { ...entry, state: { ...entry.state, position: 1 } }
          : entry,
      ),
  };
  view.rerender();
  expect(view.result.current.sheet?.unplacedSelections).toMatchObject([
    { _id: selection._id, gainedAtClassLevel: first._id },
  ]);
});

function isManualCatalogEntry(
  entry: CharacterSheetSnapshot['catalogEntries'][number],
): entry is Extract<
  CharacterSheetSnapshot['catalogEntries'][number],
  { detail: { kind: 'manual' } }
> {
  return entry.detail.kind === 'manual';
}

test('equivalent level and adjustment data stays quiet when property order changes', async () => {
  snapshot = await fixture();
  const initial = snapshot;
  const view = renderHook(() =>
    useCharacterSheet({
      organizationId: 'org',
      characterId: initial.character._id,
    }),
  );
  snapshot = {
    ...initial,
    revision: 2,
    lastOperationId: 'other-player:equivalent-data',
    entries: initial.entries.map((entry) => {
      if (entry.kind !== 'classLevel') return entry;
      return {
        ...entry,
        state: {
          hpGained: entry.state.hpGained,
          position: entry.state.position,
          classEntryId: entry.state.classEntryId,
          kind: entry.state.kind,
        },
      };
    }),
    catalogEntries: initial.catalogEntries.map(
      (entry): CharacterSheetSnapshot['catalogEntries'][number] => {
        if (!isManualCatalogEntry(entry)) return entry;
        return {
          ...entry,
          modifiers: entry.modifiers.map((modifier) => ({
            value: modifier.value,
            bonusType: modifier.bonusType,
            target: modifier.target,
          })),
        };
      },
    ),
  };
  view.rerender();
  expect(view.result.current.levels.hasRemoteChange).toBe(false);
  expect(view.result.current.adjustments.hasRemoteChange).toBe(false);
});

test('Situation preview supports explicit combinations and empty ordinary selections without saving', () => {
  snapshot = buildSheet({
    adjustments: [
      {
        id: 'fearless',
        name: 'Fearless',
        modifiers: [
          {
            target: 'save.will',
            bonusType: 'racial',
            value: 2,
            condition: { situation: 'fear' },
          },
        ],
      },
      {
        id: 'superstition',
        name: 'Superstition',
        modifiers: [
          {
            target: 'save.will',
            bonusType: 'morale',
            value: 3,
            condition: { situation: 'spells' },
          },
        ],
      },
    ],
  });
  const scope = { characterId: snapshot.character._id };
  const view = renderHook(() => useCharacterSheet(scope));
  expect(
    view.result.current.previewSituation(['fear', 'spells'])?.breakdowns[
      'save.will'
    ].total,
  ).toBe(5);
  expect(
    view.result.current.previewSituation(['fear'])?.breakdowns['save.will']
      .total,
  ).toBe(2);
  expect(
    view.result.current.previewSituation([])?.breakdowns['save.will'].total,
  ).toBe(0);
  expect(calls).toEqual([]);
});

test('Situation previews keep the familiar’s creature and current associated values even without relationship controls', () => {
  const initial = buildSheet({
    levels: [],
    adjustments: [
      {
        id: 'fearless',
        name: 'Fearless',
        modifiers: [
          {
            target: 'save.will',
            bonusType: 'racial',
            value: 2,
            condition: { situation: 'fear' },
          },
        ],
      },
    ],
  });
  function linked(
    input: CompanionLinkedInput,
    value: number,
  ): CompanionLinkedInputResolution {
    return {
      input,
      value,
      status: 'available',
      resolution: 'calculated',
      candidates: [],
      contributions: [],
      fallback: null,
      interpretation: null,
      fallbackState: 'none',
      prerequisiteStatus: 'resolved',
    };
  }
  const common = [
    linked({ kind: 'characterLevel' }, 7),
    linked({ kind: 'familiarProgressionLevels' }, 5),
    linked({ kind: 'baseAttackBonus' }, 3),
    linked({ kind: 'baseSave', save: 'will' }, 5),
  ];
  const calculated = calculateFixtureSheetProjections(
    {
      ...initial,
      characterKind: 'npc',
      familiarBaseCreatureKey: 'cat',
    },
    {
      projectionInputs: {
        current: {
          familiar: {
            baseCreatureKey: 'cat',
            linkedInputs: [...common, linked({ kind: 'maximumHp' }, 49)],
          },
        },
        permanent: {
          familiar: {
            baseCreatureKey: 'cat',
            linkedInputs: [...common, linked({ kind: 'maximumHp' }, 41)],
          },
        },
      },
    },
  );
  snapshot = {
    ...initial,
    character: {
      ...initial.character,
      kind: 'npc',
      familiarBaseCreatureKey: 'cat',
    },
    calculated: calculated.current,
    permanentCalculated: calculated.permanent,
  };
  const view = renderHook(() =>
    useCharacterSheet({ characterId: initial.character._id }),
  );
  expect(view.result.current.familiar.isAvailable).toBe(false);
  const ordinary = view.result.current.previewSituation([]);
  expect(ordinary).toMatchObject({
    hitDice: 1,
    hp: 24,
    familiar: { baseAttackBonus: 3, baseSaves: { will: 5 } },
    breakdowns: { 'save.will': { total: 5 } },
  });
  const fear = view.result.current.previewSituation(['fear']);
  expect(fear).toMatchObject({
    hitDice: 1,
    hp: 24,
    breakdowns: { 'save.will': { total: 7 } },
  });
  expect(calls).toEqual([]);
});

test('Situation previews remain stable through local interaction and refresh with sheet changes', () => {
  snapshot = buildSheet({
    adjustments: [
      {
        id: 'fearless',
        name: 'Fearless',
        modifiers: [
          {
            target: 'save.will',
            bonusType: 'racial',
            value: 2,
            condition: { situation: 'fear' },
          },
        ],
      },
    ],
  });
  const view = renderHook(() => useCharacterSheet({ characterId: 'hero' }));
  const preview = view.result.current.previewSituation;
  view.rerender();
  expect(view.result.current.previewSituation).toBe(preview);
  act(() => view.result.current.adjustments.dismissRemoteChange());
  expect(view.result.current.previewSituation).toBe(preview);
  snapshot = { ...snapshot, revision: snapshot.revision + 1 };
  view.rerender();
  expect(view.result.current.previewSituation).not.toBe(preview);
  expect(
    view.result.current.previewSituation(['fear'])?.breakdowns['save.will']
      .total,
  ).toBe(2);
});

test('an original to Unchained switch acknowledges a save beside the class and retries a refused switch without changing recorded levels', async () => {
  snapshot = buildSheet({
    levels: [{ id: 'rogue-1', hp: 8, classId: 'rogue' }],
  });
  const original = snapshot.catalogEntries.find(
    (
      entry,
    ): entry is Extract<
      CharacterSheetSnapshot['catalogEntries'][number],
      { detail: { kind: 'class'; hitDie: number } }
    > =>
      entry.ruleIdentity === 'rogue' &&
      entry.detail.kind === 'class' &&
      'hitDie' in entry.detail,
  );
  if (!original) throw new Error('Missing Rogue');
  const target = {
    ...original,
    _id: 'unchained-rogue' as typeof original._id,
    ruleIdentity: 'unchained-rogue',
    name: 'Rogue (Unchained)',
    detail: { ...original.detail, counterpartOf: original._id },
  };
  catalogChoices = [target];
  const row = snapshot.entries.find((entry) => entry.kind === 'classLevel');
  if (!row) throw new Error('Missing Class Level');
  const view = renderHook(() =>
    useCharacterSheet({ organizationId: 'org', characterId: row.characterId }),
  );
  let pending: Promise<boolean> | undefined;
  act(() => {
    pending = view.result.current.classes.switchRules(row._id, target._id);
  });
  expect(view.result.current.classes.statusFor(row._id)).toEqual({
    kind: 'saving',
  });
  expect(calls[0]).toMatchObject({
    name: 'switchClassVersion',
    args: {
      entryId: row._id,
      classEntryId: target._id,
      organizationId: 'org',
      characterId: row.characterId,
      operationId: expect.any(String),
    },
  });
  await act(async () => {
    calls[0]?.reject(new ConvexError('Editing is paused'));
    await pending;
  });
  expect(view.result.current.classes.statusFor(row._id)).toEqual({
    kind: 'error',
    message: "Class version wasn't saved: Editing is paused. Try again.",
  });
  expect(view.result.current.sheet?.levels[0]?.state.classEntryId).toBe(
    original._id,
  );
  act(() => {
    pending = view.result.current.classes.switchRules(row._id, target._id);
  });
  await act(async () => {
    calls[1]?.resolve(null);
    await pending;
  });
  expect(view.result.current.classes.statusFor(row._id)).toEqual({
    kind: 'saved',
  });
});

test('switching a class to its campaign copy previews and reports what the switch keeps, through the version writer', async () => {
  // CRB p. 56: a d10 allows at most 10 hit points; 12 is recorded.
  const levels = [
    { id: 'fighter-1', hp: 10, classId: 'fighter' as const },
    { id: 'fighter-2', hp: 12, classId: 'fighter' as const },
  ];
  const warning = buildSheet({ levels }).calculated.warnings.find(
    (row) => row.kind === 'rules' && row.check === 'hpGainedAboveMaximum',
  );
  if (!warning) throw new Error('Missing HP warning');
  const accepted = [
    {
      check: warning.check,
      subject: warning.subject,
      fingerprint: warning.fingerprint,
    },
  ];
  snapshot = buildSheet({ levels, accepted });
  const fighter = snapshot.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'fighter',
  );
  if (fighter?.detail.kind !== 'class') throw new Error('Missing Fighter');
  // The campaign's Customize copy of the same Fighter.
  const { characterId: _characterId, ...shared } = fighter;
  const copy = {
    ...shared,
    _id: 'fighter-campaign' as typeof fighter._id,
    scope: 'campaign' as const,
    campaignId: snapshot.character.campaignId,
    copiedFrom: fighter._id,
    campaignPreference: true as const,
  };
  catalogChoices = [copy];
  const view = renderHook(() =>
    useCharacterSheet({ organizationId: 'org', characterId: 'hero' }),
  );
  const classes = () => view.result.current.classes;
  const rowId = 'fighter-2' as Id<'characterSheetEntry'>;
  // Campaign copies come before the Character's own, whichever is in use.
  expect(classes().rulesChoicesFor(rowId)).toMatchObject([
    {
      classEntryId: copy._id,
      inUse: false,
      scope: 'campaign',
      isCampaignPreference: true,
      isCopy: true,
    },
    { classEntryId: fighter._id, inUse: true, isCopy: false },
  ]);
  const kept = {
    levelIds: ['fighter-1', 'fighter-2'],
    statistics: [],
    dormant: [],
    restored: [],
    keptWarnings: [{ check: warning.check, subject: warning.subject }],
    reopenedWarnings: [],
    clearedWarnings: [],
  };
  expect(classes().previewRulesSwitch(rowId, copy._id)).toEqual(kept);
  expect(classes().previewRulesSwitch(rowId, fighter._id)).toBeNull();
  let pending: Promise<boolean> | undefined;
  act(() => {
    pending = classes().switchRules(rowId, copy._id);
  });
  expect(classes().statusFor(rowId)).toEqual({ kind: 'saving' });
  const call = calls.at(-1);
  expect(call).toMatchObject({
    name: 'switchClassVersion',
    args: { entryId: rowId, classEntryId: copy._id },
  });
  await act(async () => {
    call?.resolve(null);
    await pending;
  });
  expect(classes().definitionSwitchResult).toBeNull();
  const saved = buildSheet({
    levels: levels.map((level) => ({
      ...level,
      classId: copy._id as unknown as typeof level.classId,
    })),
    accepted,
    lastOperationId: String(call?.args.operationId),
  });
  snapshot = { ...saved, catalogEntries: [...saved.catalogEntries, copy] };
  view.rerender();
  expect(classes().definitionSwitchResult).toEqual({
    entryId: rowId,
    classEntryId: copy._id,
    ...kept,
  });
  act(() => classes().dismissDefinitionSwitchResult());
  expect(classes().definitionSwitchResult).toBeNull();
});

test('class choices keep their memoized read when the catalog has not loaded and an unrelated render occurs', () => {
  const initial = buildSheet();
  snapshot = initial;
  catalogChoices = undefined;
  const view = renderHook(() =>
    useCharacterSheet({ characterId: initial.character._id }),
  );
  const choices = view.result.current.classes.choices;
  view.rerender();
  expect(view.result.current.classes.choices).toBe(choices);
});

test('Situation previews preserve animal progression inputs and physical scores without relationship controls', () => {
  const sheet = buildSheet({
    levels: [],
    adjustments: [
      {
        id: 'fearless',
        name: 'Fearless',
        modifiers: [
          {
            target: 'save.will',
            bonusType: 'racial',
            value: 2,
            condition: { situation: 'fear' },
          },
        ],
      },
    ],
  });
  const progression = {
    species: 'wolf' as const,
    hpGained: 27,
    skillRanks: {},
    abilityIncreases: [],
    advancementChoice: 'species' as const,
    keep: false,
  };
  const linked: CompanionLinkedInputResolution = {
    input: { kind: 'classLevels', classRuleIdentity: 'druid' },
    value: 7,
    status: 'available',
    resolution: 'calculated',
    candidates: [],
    contributions: [],
    fallback: null,
    interpretation: null,
    fallbackState: 'none',
    prerequisiteStatus: 'resolved',
  };
  const current = {
    companionProgressionSources: [
      {
        sourceKey: 'nature-bond',
        ruleKind: 'druidCompanion' as const,
        counting: true,
      },
    ],
    companionLinkedInputs: [linked],
  };
  const projections = calculateFixtureSheetProjections(
    { ...sheet, characterKind: 'npc', companionProgression: progression },
    { projectionInputs: { current, permanent: current } },
  );
  snapshot = {
    ...sheet,
    character: { ...sheet.character, kind: 'npc' },
    entries: sheet.entries.map((entry) =>
      entry.kind === 'base'
        ? {
            ...entry,
            state: { ...entry.state, companionProgression: progression },
          }
        : entry,
    ),
    calculated: projections.current,
    permanentCalculated: projections.permanent,
    companionCalculationInputs: { kind: 'progression', ...current },
  };
  const view = renderHook(() =>
    useCharacterSheet({ characterId: sheet.character._id }),
  );
  expect(view.result.current.previewSituation([])).toMatchObject({
    hitDice: 6,
    companionProgression: { effectiveLevel: 7 },
    derivedStatistics: { bab: { total: 4 }, will: { total: 2 } },
    abilities: { strength: { score: 20 } },
  });
  expect(view.result.current.previewSituation(['fear'])).toMatchObject({
    hitDice: 6,
    breakdowns: { 'save.will': { total: 4 } },
  });
  const unavailable = {
    ...current,
    companionLinkedInputs: [
      {
        ...linked,
        value: null,
        status: 'unavailable' as const,
        resolution: 'unresolved' as const,
        prerequisiteStatus: 'unresolved' as const,
      },
    ],
  };
  const unresolved = calculateFixtureSheetProjections(
    { ...sheet, characterKind: 'npc', companionProgression: progression },
    { projectionInputs: { current: unavailable, permanent: unavailable } },
  );
  snapshot = {
    ...snapshot,
    companionCalculationInputs: { kind: 'progression', ...unavailable },
    calculated: unresolved.current,
    permanentCalculated: unresolved.permanent,
  };
  view.rerender();
  expect(view.result.current.previewSituation(['fear'])).toMatchObject({
    hitDice: null,
    companionProgression: { effectiveLevel: null },
    affectedStatisticTargets: expect.arrayContaining([
      'derived.bab',
      'ability.str',
    ]),
  });
  expect(calls).toEqual([]);
});

test('Situation previews keep a cohort’s recorded equivalence and its leader’s inputs', () => {
  const sheet = buildSheet({
    levels: [
      { id: 'level-1', hp: 6 },
      { id: 'level-2', hp: 6 },
    ],
  });
  const equivalence = {
    kind: 'published' as const,
    creatureKey: 'worg' as const,
  };
  const available = (
    input: CompanionLinkedInputResolution['input'],
    value: number,
  ): CompanionLinkedInputResolution => ({
    input,
    value,
    status: 'available',
    resolution: 'calculated',
    candidates: [],
    contributions: [],
    fallback: null,
    interpretation: null,
    fallbackState: 'none',
    prerequisiteStatus: 'resolved',
  });
  const current = {
    cohort: {
      sources: [{ sourceKey: 'leadership', counting: true }],
      linkedInputs: [
        available({ kind: 'characterLevel' }, 9),
        available({ kind: 'abilityModifier', ability: 'charisma' }, 2),
      ],
    },
  };
  const projections = calculateFixtureSheetProjections(
    { ...sheet, characterKind: 'npc', cohortEquivalence: equivalence },
    { projectionInputs: { current, permanent: current } },
  );
  snapshot = {
    ...sheet,
    entries: sheet.entries.map((entry) =>
      entry.kind === 'base'
        ? {
            ...entry,
            state: { ...entry.state, cohortEquivalence: equivalence },
          }
        : entry,
    ),
    calculated: projections.current,
    permanentCalculated: projections.permanent,
    companionCalculationInputs: { kind: 'cohort', ...current },
  };
  const view = renderHook(() =>
    useCharacterSheet({ characterId: sheet.character._id }),
  );
  // Worg 5 + 2 Class Levels; leader 9 with Cha +2 allows 7th.
  expect(view.result.current.previewSituation([])).toMatchObject({
    cohort: {
      equivalence: { basis: 'published', value: 7 },
      leadership: { score: 11, maximumLevel: 7 },
      overLevel: false,
    },
  });
});
