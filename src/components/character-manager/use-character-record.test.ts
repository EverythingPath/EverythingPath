import { act, renderHook } from '@testing-library/react';
import type { Id } from '@convex/_generated/dataModel';
import { beforeEach, expect, test, vi } from 'vitest';
import { isOwnCharacterSheetOperation } from '~/lib/character-sheet-operations';
import type { CharacterRecord } from './types';
import { useCharacterRecord } from './use-character-record';
import { getFunctionName, type FunctionReference } from 'convex/server';

type Call = {
  name: string;
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
let calls: Call[] = [];
let readOnly = false;
vi.mock('convex/react', () => ({
  useMutation: (mutation: FunctionReference<'mutation'>) => {
    const name = getFunctionName(mutation);
    return (args: Record<string, unknown>) =>
      new Promise((resolve, reject) =>
        calls.push({ name, args, resolve, reject }),
      );
  },
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({
    kind: readOnly ? 'maintenance' : 'ready',
    readOnly,
    message: '',
  }),
}));

const campaignId = 'campaign' as Id<'campaign'>;
const characterId = 'character' as Id<'character'>;
const secondId = 'fighter-level' as Id<'characterSheetEntry'>;
const thirdId = 'wizard-level' as Id<'characterSheetEntry'>;
function character(): CharacterRecord {
  return {
    _id: characterId,
    _creationTime: 1,
    ownerId: 'owner',
    owner: null,
    ownershipAvailable: false,
    campaignId,
    name: 'Hessa',
    description: '',
    kind: 'pc',
    sheetMode: 'militiaOnly',
    sheetRevision: 3,
    isActive: true,
    level: 3,
    strength: 16,
    dexterity: 12,
    constitution: 14,
    intelligence: 10,
    wisdom: 8,
    charisma: 10,
    classLevels: [
      {
        entryId: 'first-level' as Id<'characterSheetEntry'>,
        position: 1,
        classEntryId: null,
        name: 'Unspecified Class Level',
      },
      { entryId: secondId, position: 2, classEntryId: null, name: 'Fighter' },
      { entryId: thirdId, position: 3, classEntryId: null, name: 'Wizard' },
    ],
  };
}

beforeEach(() => {
  calls = [];
  readOnly = false;
});

test('lowering a prepared militia level names trailing rows before saving their confirmed identities', async () => {
  const onSaved = vi.fn();
  const view = renderHook(() =>
    useCharacterRecord({
      campaignId,
      organizationId: 'org',
      record: character(),
      onSaved,
    }),
  );
  await act(async () => {
    view.result.current.form.setValue('level', '1');
    view.result.current.save();
  });
  expect(calls).toHaveLength(0);
  expect(view.result.current.removalConfirmation?.levels).toEqual([
    { entryId: secondId, position: 2, classEntryId: null, name: 'Fighter' },
    { entryId: thirdId, position: 3, classEntryId: null, name: 'Wizard' },
  ]);
  expect(view.result.current.removalConfirmation?.targetLevel).toBe(1);
  act(() => view.result.current.removalConfirmation?.confirm());
  expect(isOwnCharacterSheetOperation(String(calls[0]?.args.operationId))).toBe(
    true,
  );
  expect(calls[0]?.args).toEqual({
    operationId: expect.any(String),
    organizationId: 'org',
    characterId,
    patch: { level: 1 },
    confirmedRemovedLevelIds: [secondId, thirdId],
    expectedSheetRevision: 3,
  });
  await act(async () => calls[0]?.resolve(null));
  expect(onSaved).toHaveBeenCalledOnce();
});

test('full statistics stay read-only while edited metadata can be saved and archived', async () => {
  const record = { ...character(), sheetMode: 'full' as const };
  const view = renderHook(() =>
    useCharacterRecord({
      campaignId,
      organizationId: 'org',
      record,
      onSaved: () => undefined,
    }),
  );
  expect(view.result.current.statisticsReadOnly).toBe(true);
  expect(view.result.current.levelLabel).toBe('Level');
  expect(view.result.current.sheetHref).toBe(
    '/characters/character?from=%2Fcampaigns%2Fcampaign%2Fofficers&organizationId=org',
  );
  await act(async () => {
    view.result.current.form.setValue('name', 'Hessa Thorn');
    view.result.current.form.setValue('description', 'Scout');
    view.result.current.form.setValue('kind', 'npc');
    view.result.current.form.setValue('level', '1');
    view.result.current.form.setValue('strength', '20');
    view.result.current.toggleArchive();
  });
  expect(isOwnCharacterSheetOperation(String(calls[0]?.args.operationId))).toBe(
    true,
  );
  expect(calls[0]?.args).toEqual({
    operationId: expect.any(String),
    organizationId: 'org',
    characterId,
    patch: {
      name: 'Hessa Thorn',
      description: 'Scout',
      kind: 'npc',
      isActive: false,
    },
  });
  expect(view.result.current.removalConfirmation).toBeNull();
  await act(async () => calls[0]?.resolve(null));
});

test('a remote level increase never asks to remove rows when this player edits only Notes', async () => {
  let record = character();
  const view = renderHook(() =>
    useCharacterRecord({
      campaignId,
      organizationId: 'org',
      record,
      onSaved: () => undefined,
    }),
  );
  record = {
    ...record,
    level: 4,
    sheetRevision: 4,
    classLevels: [
      ...(record.classLevels ?? []),
      {
        entryId: 'remote-level' as Id<'characterSheetEntry'>,
        position: 4,
        classEntryId: null,
        name: 'Rogue',
      },
    ],
  };
  view.rerender();
  await act(async () => {
    view.result.current.form.setValue('description', 'Scout');
    view.result.current.save();
  });
  expect(view.result.current.removalConfirmation).toBeNull();
  expect(isOwnCharacterSheetOperation(String(calls[0]?.args.operationId))).toBe(
    true,
  );
  expect(calls[0]?.args).toEqual({
    operationId: expect.any(String),
    organizationId: 'org',
    characterId,
    patch: { description: 'Scout' },
  });
  await act(async () => calls[0]?.resolve(null));
});

test('fractional full-sheet scores never block ledger Notes or archive edits', async () => {
  const record = {
    ...character(),
    sheetMode: 'full' as const,
    strength: 10.5,
  };
  const view = renderHook(() =>
    useCharacterRecord({
      campaignId,
      organizationId: 'org',
      record,
      onSaved: () => undefined,
    }),
  );
  await act(async () => {
    view.result.current.form.setValue('description', 'Quartermaster');
    view.result.current.save();
  });
  expect(view.result.current.form.formState.errors).toEqual({});
  expect(calls[0]?.args).toMatchObject({
    patch: { description: 'Quartermaster' },
  });
  await act(async () => calls[0]?.resolve(null));
  await act(async () => view.result.current.toggleArchive());
  expect(calls[1]?.args).toMatchObject({
    patch: { description: 'Quartermaster', isActive: false },
  });
  await act(async () => calls[1]?.resolve(null));
});

test('prepared permanent scores accept whole numbers and distinguish missing from malformed input', async () => {
  const view = renderHook(() =>
    useCharacterRecord({
      campaignId,
      organizationId: 'org',
      record: character(),
      onSaved: () => undefined,
    }),
  );
  await act(async () => {
    view.result.current.form.setValue('strength', '18');
    view.result.current.save();
  });
  expect(calls[0]?.args).toMatchObject({ patch: { strength: 18 } });
  await act(async () => calls[0]?.resolve(null));
  await act(async () => {
    view.result.current.form.setValue('strength', '');
    await view.result.current.form.trigger('strength');
  });
  expect(
    view.result.current.form.getFieldState('strength').error?.message,
  ).toBe('STR is required');
  await act(async () => {
    view.result.current.form.setValue('strength', 'Infinity');
    view.result.current.save();
  });
  expect(
    view.result.current.form.getFieldState('strength').error?.message,
  ).toBe('STR must be a number');
  expect(calls).toHaveLength(1);
});

test('zero level is saveable after confirmation and cancelling keeps the entered level and Notes', async () => {
  const view = renderHook(() =>
    useCharacterRecord({
      campaignId,
      organizationId: 'org',
      record: character(),
      onSaved: () => undefined,
    }),
  );
  await act(async () => {
    view.result.current.form.setValue('level', '0');
    view.result.current.form.setValue('description', 'Rebuilding');
    view.result.current.save();
  });
  expect(view.result.current.removalConfirmation?.levels).toHaveLength(3);
  act(() => view.result.current.removalConfirmation?.cancel());
  expect(view.result.current.form.getValues('level')).toBe('0');
  expect(view.result.current.form.getValues('description')).toBe('Rebuilding');
  expect(calls).toHaveLength(0);
  await act(async () => view.result.current.save());
  act(() => view.result.current.removalConfirmation?.confirm());
  expect(calls[0]?.args).toMatchObject({
    patch: { level: 0, description: 'Rebuilding' },
    expectedSheetRevision: 3,
  });
  await act(async () => calls[0]?.resolve(null));
});

test('a changed sheet rejects an old confirmation, retains input and names current rows on the next Save', async () => {
  let record = character();
  const onSaved = vi.fn();
  const view = renderHook(() =>
    useCharacterRecord({ campaignId, organizationId: 'org', record, onSaved }),
  );
  await act(async () => {
    view.result.current.form.setValue('level', '1');
    view.result.current.form.setValue('description', 'Scout');
    view.result.current.save();
  });
  record = {
    ...record,
    sheetRevision: 4,
    classLevels: record.classLevels?.map((level) =>
      level.entryId === thirdId ? { ...level, name: 'Rogue' } : level,
    ),
  };
  view.rerender();
  act(() => view.result.current.removalConfirmation?.confirm());
  expect(calls[0]?.args.expectedSheetRevision).toBe(3);
  await act(async () =>
    calls[0]?.reject(new Error('Class Levels changed. Review them again.')),
  );
  expect(onSaved).not.toHaveBeenCalled();
  expect(view.result.current.removalConfirmation).toBeNull();
  expect(view.result.current.submitError).toBe(
    'Class Levels changed. Review them again.',
  );
  expect(view.result.current.form.getValues('description')).toBe('Scout');
  await act(async () => view.result.current.save());
  expect(
    view.result.current.removalConfirmation?.levels.map((level) => level.name),
  ).toEqual(['Fighter', 'Rogue']);
  act(() => view.result.current.removalConfirmation?.confirm());
  expect(calls[1]?.args.expectedSheetRevision).toBe(4);
  await act(async () => calls[1]?.resolve(null));
});

test('maintenance prevents Save, Archive and a pending removal confirmation from writing', async () => {
  const view = renderHook(() =>
    useCharacterRecord({
      campaignId,
      organizationId: 'org',
      record: character(),
      onSaved: () => undefined,
    }),
  );
  await act(async () => {
    view.result.current.form.setValue('level', '1');
    view.result.current.save();
  });
  readOnly = true;
  view.rerender();
  await act(async () => {
    view.result.current.removalConfirmation?.confirm();
    view.result.current.save();
    view.result.current.toggleArchive();
  });
  expect(view.result.current.readOnly).toBe(true);
  expect(calls).toHaveLength(0);
  expect(view.result.current.removalConfirmation).not.toBeNull();
});

test.each([
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
] as const)(
  'a fractional %s score stays in its field with a whole-number error and never saves',
  async (ability) => {
    const onSaved = vi.fn();
    const view = renderHook(() =>
      useCharacterRecord({
        campaignId,
        organizationId: 'org',
        record: character(),
        onSaved,
      }),
    );
    await act(async () => {
      view.result.current.form.setValue(ability, '10.5');
      view.result.current.save();
    });
    expect(
      view.result.current.form.getFieldState(ability).error?.message,
    ).toMatch(/must be a whole number/);
    expect(view.result.current.form.getValues(ability)).toBe('10.5');
    expect(calls).toEqual([]);
    expect(onSaved).not.toHaveBeenCalled();
  },
);

test('an ability score outside the safe integer range never saves', async () => {
  const view = renderHook(() =>
    useCharacterRecord({
      campaignId,
      organizationId: 'org',
      record: character(),
      onSaved: vi.fn(),
    }),
  );
  await act(async () => {
    view.result.current.form.setValue('strength', '9007199254740992');
    view.result.current.save();
  });
  expect(
    view.result.current.form.getFieldState('strength').error?.message,
  ).toBe('STR must be a whole number');
  expect(calls).toEqual([]);
});
