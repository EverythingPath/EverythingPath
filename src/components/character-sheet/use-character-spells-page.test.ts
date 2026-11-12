import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { buildCharacterSheetView } from './character-sheet-view-model';
import { buildSheet } from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { useCharacterSpellsPage } from './use-character-spells-page';
import { catalogRuntimeCompatibility } from '~/lib/catalog/runtime-compatibility';
import type { SaveStatus } from './save-status';
import type { SpellsPageController } from './character-spells-page-types';

const transport = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
  query: vi.fn(),
  paginated: vi.fn(),
  loadMore: vi.fn(),
  hasFreshResponses: false,
  info: {
    catalogReleaseNumber: null as number | null,
    levels: [0, 1, 2, 3],
    defaultLevel: 1,
    schools: ['abj', 'evo'],
  },
  status: 'CanLoadMore',
  rows: [] as {
    catalogEntryId: string;
    name: string;
    school: string;
    description: string;
    spellLevel: number;
    onList: boolean;
    recorded: boolean;
    ruleIdentity: string;
    catalogReleaseNumber: number | null;
  }[],
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => transport.params,
  usePathname: () => '/characters/character-1',
  useRouter: () => ({ replace: transport.replace }),
}));
vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => {
    transport.query(...args);
    if (args[1] === 'skip') return undefined;
    return transport.hasFreshResponses
      ? structuredClone(transport.info)
      : transport.info;
  },
  usePaginatedQuery: (...args: unknown[]) => {
    transport.paginated(...args);
    if (args[1] === 'skip')
      return {
        results: [],
        status: 'LoadingFirstPage',
        loadMore: transport.loadMore,
      };
    return {
      results: transport.hasFreshResponses
        ? structuredClone(transport.rows)
        : transport.rows,
      status: transport.status,
      loadMore: transport.loadMore,
    };
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  transport.params = new URLSearchParams('from=%2Fcharacters');
  transport.status = 'CanLoadMore';
  transport.hasFreshResponses = false;
  transport.rows = [];
  transport.info = {
    catalogReleaseNumber: null,
    levels: [0, 1, 2, 3],
    defaultLevel: 1,
    schools: ['abj', 'evo'],
  };
  transport.replace.mockImplementation((href: string) => {
    transport.params = new URLSearchParams(href.split('?')[1]);
  });
});

test('an open Spell browser keeps the prior complete view until the matching release metadata and page arrive', () => {
  const old = controller();
  const seedWarning = old.sheet.warnings[0];
  if (!seedWarning) throw new Error('Missing seed warning');
  const oldWarning = {
    ...seedWarning,
    message: 'Prior Spellcasting warning',
    target: {
      kind: 'spellcasting' as const,
      classEntryId: 'wizard',
      spellLevel: 1,
    },
  };
  const initial = buildSheet({
    levels: [{ id: 'caster', classId: 'wizard', hp: 8 }],
  });
  const catalogView = {
    releaseNumber: 1,
    calculationIdentity: 'compatible-test',
    resources: { castingTables: undefined },
    legalInputs: null,
    definitions: initial.catalogEntries,
    advisories: [],
  };
  let sheet = {
    ...old,
    sheet: { ...old.sheet, catalogView, warnings: [oldWarning] },
  };
  transport.params.set('add', '1');
  transport.params.set('other', '1');
  Object.assign(transport.info, { catalogReleaseNumber: 1 });
  transport.rows = [
    {
      catalogEntryId: 'old-spell',
      name: 'Old Spell',
      description: '',
      school: 'evo',
      spellLevel: 1,
      onList: true,
      recorded: false,
      ruleIdentity: 'spell',
      catalogReleaseNumber: 1,
    },
  ];
  const view = renderHook(() =>
    useCharacterSpellsPage({ characterId: initial.character._id }, sheet),
  );
  expect(view.result.current.browserRows[0]?.name).toBe('Old Spell');
  const replacement = sheet.sheet.classChoices.find(
    (entry) => entry.name === 'Cleric',
  );
  if (!replacement) throw new Error('Missing replacement Spellcasting');
  const newWarning = {
    ...oldWarning,
    message: 'Replacement Spellcasting warning',
    target: {
      ...oldWarning.target,
      classEntryId: replacement._id,
      spellLevel: 4,
    },
  };
  const pendingStatus: SaveStatus = { kind: 'saving' };
  const latestRecord = vi.fn();
  sheet = {
    ...sheet,
    spells: {
      ...sheet.spells,
      statusForSpell: vi.fn(() => pendingStatus),
      record: latestRecord,
    },
    sheet: {
      ...sheet.sheet,
      warnings: [newWarning],
      catalogView: { ...catalogView, releaseNumber: 2 },
      calculated: {
        ...sheet.sheet.calculated,
        spellcastings: sheet.sheet.calculated.spellcastings.map((casting) => ({
          ...casting,
          castingLevel: 6,
          classEntryId: replacement._id,
          record: 'none',
        })),
      },
    },
  };
  transport.info = { ...transport.info, levels: [0, 4] };
  Object.assign(transport.info, { catalogReleaseNumber: 2 });
  transport.status = 'LoadingFirstPage';
  transport.rows = [];
  view.rerender();
  expect(view.result.current.browserRows[0]?.name).toBe('Old Spell');
  expect(view.result.current.levels).toEqual([0, 1, 2, 3]);
  expect(view.result.current.selected?.castingLevel).toBe(1);
  expect(view.result.current.selected?.classEntryId).toBe('wizard');
  expect(view.result.current.readOnly).toBe(false);
  expect(view.result.current.includeOtherLists).toBe(true);
  expect(view.result.current.isBrowsing).toBe(true);
  expect(view.result.current.warningsForLevel(1)).toEqual([oldWarning]);
  expect(view.result.current.warningsForLevel(4)).toEqual([]);
  expect(view.result.current.browserRows[0]?.status).toEqual(pendingStatus);
  expect(view.result.current.writes.record).toBe(latestRecord);
  act(() => view.result.current.selectSpellcasting('wizard'));
  expect(transport.params.get('spellcasting')).toBe('wizard');
  transport.status = 'CanLoadMore';
  transport.rows = [
    {
      catalogEntryId: 'new-spell',
      name: 'New Spell',
      description: '',
      school: 'evo',
      spellLevel: 4,
      onList: true,
      recorded: false,
      ruleIdentity: 'spell',
      catalogReleaseNumber: 2,
    },
  ];
  view.rerender();
  expect(view.result.current.browserRows[0]?.name).toBe('New Spell');
  expect(view.result.current.levels).toEqual([0, 4]);
  expect(view.result.current.selected?.castingLevel).toBe(6);
  expect(view.result.current.selected?.classEntryId).toBe(replacement._id);
  expect(view.result.current.readOnly).toBe(true);
  expect(view.result.current.includeOtherLists).toBe(false);
  expect(view.result.current.warningsForLevel(4)).toEqual([newWarning]);
  expect(view.result.current.warningsForLevel(1)).toEqual([]);
  expect(transport.query).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({ catalogReleaseNumber: 2 }),
  );
});

function completeSheet(snapshot: CharacterSheetSnapshot) {
  return buildCharacterSheetView({
    ...snapshot,
    catalogView: {
      releaseNumber: null,
      calculationIdentity: catalogRuntimeCompatibility.calculation,
      resources: { castingTables: undefined },
      legalInputs: null,
      definitions: snapshot.catalogEntries,
      advisories: [],
    },
  });
}

function controller(classId: 'wizard' | 'cleric' = 'wizard') {
  const snapshot = buildSheet({ levels: [{ id: 'caster', classId, hp: 8 }] });
  return {
    sheet: completeSheet(snapshot),
    spells: {
      statusForSpell: vi.fn(),
      statusForEntry: vi.fn(),
      hasRemoteChange: false,
      dismissRemoteChange: vi.fn(),
      record: vi.fn(),
      editLevel: vi.fn(),
      remove: vi.fn(),
    },
    warnings: {
      statusFor: vi.fn(),
      hasRemoteChange: false,
      dismissRemoteChange: vi.fn(),
      accept: vi.fn(),
      reopen: vi.fn(),
    },
    spellcastingChoices: {
      viewFor: vi.fn(() => null),
      schools: [],
      statusFor: vi.fn(),
      setOppositionSchools: vi.fn(),
    },
  } satisfies SpellsPageController;
}

test('fresh equivalent browser and sheet data settle while the latest recording controls remain live', () => {
  transport.hasFreshResponses = true;
  transport.params.set('add', '1');
  transport.rows = [
    {
      catalogEntryId: 'shield',
      ruleIdentity: 'spell:shield',
      name: 'Shield',
      school: 'abj',
      description: 'Invisible disc',
      spellLevel: 1,
      onList: true,
      recorded: false,
      catalogReleaseNumber: null,
    },
  ];
  const sheet = controller();
  let status: SaveStatus = { kind: 'idle' };
  const view = renderHook(() =>
    useCharacterSpellsPage(
      { characterId: sheet.sheet.character._id },
      {
        ...sheet,
        sheet: structuredClone(sheet.sheet),
        spells: { ...sheet.spells, statusForSpell: () => status },
      },
    ),
  );
  expect(view.result.current.browserRows[0]?.name).toBe('Shield');
  expect(view.result.current.isLoading).toBe(false);
  status = { kind: 'saving' };
  view.rerender();
  expect(view.result.current.browserRows[0]?.status).toEqual({
    kind: 'saving',
  });
  act(() => view.result.current.setSchool('abj'));
  expect(view.result.current.school).toBe('abj');
  act(() => view.result.current.loadMore());
  expect(transport.loadMore).toHaveBeenCalledWith(25);
});

test('a missing sheet clears the complete Spell data before the same Character loads again', () => {
  transport.params.set('add', '1');
  const initial = controller();
  let visible: SpellsPageController = initial;
  const view = renderHook(() =>
    useCharacterSpellsPage(
      { characterId: initial.sheet.character._id },
      visible,
    ),
  );
  expect(view.result.current.levels).toEqual([0, 1, 2, 3]);
  visible = { ...initial, sheet: null };
  view.rerender();
  expect(view.result.current.spellcastings).toEqual([]);
  expect(view.result.current.levels).toEqual([]);
  visible = {
    ...initial,
    sheet: {
      ...initial.sheet,
      catalogView: { ...initial.sheet.catalogView!, releaseNumber: 2 },
    },
  };
  transport.status = 'LoadingFirstPage';
  view.rerender();
  expect(view.result.current.levels).toEqual([]);
  expect(view.result.current.selected).toBeNull();
});

test('the recorded view opens the level browser explicitly; searching spans levels and level tabs clear search', () => {
  const sheet = controller();
  const view = renderHook(() =>
    useCharacterSpellsPage({ characterId: sheet.sheet.character._id }, sheet),
  );
  expect(view.result.current.isBrowsing).toBe(false);
  expect(transport.paginated).toHaveBeenLastCalledWith(
    expect.anything(),
    'skip',
    { initialNumItems: 25 },
  );
  act(() => view.result.current.enterBrowser());
  expect(view.result.current.isBrowsing).toBe(true);
  expect(transport.paginated).toHaveBeenLastCalledWith(
    expect.anything(),
    {
      characterId: sheet.sheet.character._id,
      castingClassId: 'wizard',
      catalogReleaseNumber: null,
      spellLevel: 1,
    },
    { initialNumItems: 25 },
  );
  act(() => view.result.current.setQuery('shield'));
  expect(transport.paginated).toHaveBeenLastCalledWith(
    expect.anything(),
    {
      characterId: sheet.sheet.character._id,
      castingClassId: 'wizard',
      catalogReleaseNumber: null,
      search: 'shield',
    },
    { initialNumItems: 25 },
  );
  act(() => view.result.current.setLevel(3));
  expect(view.result.current.query).toBe('');
  expect(transport.params.get('level')).toBe('3');
  expect(transport.params.get('from')).toBe('/characters');
  expect(transport.params.get('q')).toBeNull();
});

test('whole-list casters always browse read-only and cannot enable other lists; load-more requires available results', () => {
  transport.params.set('other', '1');
  const sheet = controller('cleric');
  const view = renderHook(() =>
    useCharacterSpellsPage({ characterId: sheet.sheet.character._id }, sheet),
  );
  expect(view.result.current.isBrowsing).toBe(true);
  expect(view.result.current.readOnly).toBe(true);
  expect(view.result.current.includeOtherLists).toBe(false);
  act(() => view.result.current.setIncludeOtherLists(true));
  expect(transport.params.get('other')).toBe('1');
  act(() => view.result.current.loadMore());
  expect(transport.loadMore).toHaveBeenCalledWith(25);
  transport.status = 'Exhausted';
  view.rerender();
  act(() => view.result.current.loadMore());
  expect(transport.loadMore).toHaveBeenCalledTimes(1);
});

test('school filters and phone description expansion remain local to the selected Spellcasting', () => {
  transport.params.set('add', '1');
  const sheet = controller();
  const view = renderHook(() =>
    useCharacterSpellsPage({ characterId: sheet.sheet.character._id }, sheet),
  );
  act(() => view.result.current.setSchool('abj'));
  expect(transport.params.get('school')).toBe('abj');
  expect(view.result.current.schools).toEqual([
    { value: 'abj', label: 'Abjuration', abbreviation: 'Abj' },
    { value: 'evo', label: 'Evocation', abbreviation: 'Evoc' },
  ]);
  act(() => view.result.current.toggleDescription('shield'));
  expect(view.result.current.isDescriptionExpanded('shield')).toBe(true);
  act(() => view.result.current.leaveBrowser());
  expect(transport.params.get('add')).toBeNull();
  expect(transport.params.get('school')).toBeNull();
});

test('switching Spellcastings clears browser filters, preserves the sheet origin and scopes descriptions', () => {
  transport.params = new URLSearchParams(
    'from=%2Fcharacters&spellcasting=wizard&add=1&level=3&school=abj&q=shield&other=1',
  );
  const sheet = controller();
  sheet.sheet = completeSheet(
    buildSheet({
      levels: [
        { id: 'wizard-level', classId: 'wizard', hp: 6 },
        { id: 'cleric-level', classId: 'cleric', hp: 8 },
      ],
    }),
  );
  const view = renderHook(() =>
    useCharacterSpellsPage({ characterId: sheet.sheet.character._id }, sheet),
  );
  act(() => view.result.current.toggleDescription('shield'));
  expect(view.result.current.isDescriptionExpanded('shield')).toBe(true);
  act(() => view.result.current.selectSpellcasting('cleric'));
  expect(view.result.current.selected?.classEntryId).toBe('cleric');
  expect(view.result.current.isDescriptionExpanded('shield')).toBe(false);
  expect(view.result.current.readOnly).toBe(true);
  expect(transport.params.toString()).toBe(
    'from=%2Fcharacters&spellcasting=cleric',
  );
  act(() => view.result.current.selectSpellcasting('missing-class'));
  expect(view.result.current.selected?.classEntryId).toBe('cleric');
});

test('external navigation replaces local browser choices and invalid filters fall back to available choices', () => {
  transport.params.set('add', '1');
  const sheet = controller();
  const view = renderHook(() =>
    useCharacterSpellsPage({ characterId: sheet.sheet.character._id }, sheet),
  );
  act(() => view.result.current.setQuery('shield'));
  expect(view.result.current.query).toBe('shield');
  transport.params = new URLSearchParams(
    'from=%2Fcharacters&add=1&level=99&school=missing-school',
  );
  view.rerender();
  expect(view.result.current.query).toBe('');
  expect(view.result.current.selectedLevel).toBe(1);
  expect(view.result.current.school).toBeNull();
  act(() => view.result.current.setLevel(99));
  act(() => view.result.current.setSchool('missing-school'));
  expect(view.result.current.selectedLevel).toBe(1);
  expect(view.result.current.school).toBeNull();
});

test('browser edits stay visible while navigation is pending and changing Spellcasting clears them locally', () => {
  transport.replace.mockImplementation(() => undefined);
  const sheet = controller();
  sheet.sheet = completeSheet(
    buildSheet({
      levels: [
        { id: 'wizard-level', classId: 'wizard', hp: 6 },
        { id: 'cleric-level', classId: 'cleric', hp: 8 },
      ],
    }),
  );
  const view = renderHook(() =>
    useCharacterSpellsPage({ characterId: sheet.sheet.character._id }, sheet),
  );
  act(() => view.result.current.enterBrowser());
  act(() => view.result.current.setIncludeOtherLists(true));
  act(() => view.result.current.setQuery('shield'));
  act(() => view.result.current.setSchool('abj'));
  expect(view.result.current.isBrowsing).toBe(true);
  expect(view.result.current.includeOtherLists).toBe(true);
  expect(view.result.current.query).toBe('shield');
  expect(view.result.current.school).toBe('abj');
  expect(transport.params.toString()).toBe('from=%2Fcharacters');
  act(() => view.result.current.toggleDescription('shield'));
  act(() => view.result.current.selectSpellcasting('cleric'));
  expect(view.result.current.selected?.classEntryId).toBe('cleric');
  expect(view.result.current.query).toBe('');
  expect(view.result.current.school).toBeNull();
  expect(view.result.current.includeOtherLists).toBe(false);
  expect(view.result.current.isDescriptionExpanded('shield')).toBe(false);
  expect(transport.replace).toHaveBeenLastCalledWith(
    '/characters/character-1?from=%2Fcharacters&spellcasting=cleric',
    { scroll: false },
  );
});

test('the selected Spellcasting exposes its casting features', () => {
  const base = controller();
  const features = {
    classEntryId: 'wizard',
    castingSum: 'Wizard 1',
    pendingAdvances: 0,
    extraSlots: [],
    grantedSpellsByLevel: [],
    school: null,
  };
  const spellcastingChoices = {
    ...base.spellcastingChoices,
    viewFor: vi.fn((classEntryId: string) =>
      classEntryId === 'wizard' ? features : null,
    ),
  };
  const view = renderHook(() =>
    useCharacterSpellsPage(
      { characterId: base.sheet.character._id },
      { ...base, spellcastingChoices },
    ),
  );
  expect(view.result.current.features).toBe(features);
  expect(view.result.current).not.toHaveProperty('choiceWrites');
  expect(spellcastingChoices.viewFor).toHaveBeenCalledWith('wizard');
});
