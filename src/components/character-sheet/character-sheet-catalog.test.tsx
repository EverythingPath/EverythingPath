import {
  calculateFixtureSheet as calculateCharacterSheet,
  buildSheet,
  characterId,
  type Adjustment,
  type CatalogSheetEntry,
} from './character-sheet-test-fixture';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';

import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';

import type { CharacterSheetSnapshot } from './use-character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';

// Catalog Copies on the living sheet (#308): one-offs, Save to catalog,
// Customize for campaign, Detach, read-only global content and changed-copy
// notices, beside the rows that use each definition.

type Call = {
  name: string;
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
type CatalogEntry = CharacterSheetSnapshot['catalogEntries'][number];
type Advisory = {
  catalogEntryId: string;
  originalId: string;
  originalName: string;
};
let calls: Call[] = [];
let snapshot: CharacterSheetSnapshot | null | undefined;
let definitions: CatalogEntry[] | undefined;
let advisories: Advisory[] | undefined;
const maintenance = vi.fn<() => MigrationMaintenance>();

vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));
const nameOf = characterSheetNames();
vi.mock('convex/react', () => ({
  useQuery: (query: FunctionReference<'query'>, args: unknown) => {
    const name = nameOf(query);
    if (args === 'skip') return undefined;
    // Not a Synthesist: no Combined Form (#421).
    if (name === 'combinedForm') return null;
    if (name === 'companions') return [];
    if (name === 'catalogList') return definitions;
    if (name === 'catalogAdvisories') return advisories;
    return snapshot;
  },
  usePaginatedQuery: () => ({
    results: [],
    status: 'Exhausted',
    loadMore: vi.fn(),
  }),
  useMutation: (mutation: FunctionReference<'mutation'>) => {
    const name = nameOf(mutation);
    return (args: Record<string, unknown>) =>
      new Promise((resolve, reject) => {
        calls.push({ name, args, resolve, reject });
      });
  },
}));
vi.mock(
  '~/components/ui/select',
  () => import('../weekly-draft-workspace/native-select-test-double'),
);

beforeEach(() => {
  calls = [];
  definitions = [];
  advisories = [];
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
});

type Blocks = Array<
  | 'catalog'
  | 'adjustments'
  | 'grants'
  | 'levels'
  | 'entries'
  | 'races'
  | 'equipment'
  | 'selections'
>;
const page = (blocks: Blocks) => <CharacterSheetBlocks blocks={blocks} />;
function renderSheet(
  initial: CharacterSheetSnapshot,
  blocks: Blocks = ['catalog', 'adjustments'],
) {
  snapshot = initial;
  const view = render(page(blocks));
  return {
    show(next: CharacterSheetSnapshot) {
      snapshot = next;
      view.rerender(page(blocks));
    },
    refresh() {
      view.rerender(page(blocks));
    },
  };
}

const blessing: Adjustment = {
  id: 'blessing',
  name: 'Battle blessing',
  modifiers: [{ target: 'ability.str', bonusType: 'morale', value: 2 }],
};
const ward: Adjustment = {
  id: 'ward',
  name: 'Warding charm',
  modifiers: [{ target: 'save.will', bonusType: 'luck', value: 1 }],
};

/** The fixture sheet with some definitions shared from a wider catalog. */
function withScopes(
  sheet: CharacterSheetSnapshot,
  scopes: Record<string, 'global' | 'campaign'>,
): CharacterSheetSnapshot {
  return {
    ...sheet,
    catalogEntries: sheet.catalogEntries.map((entry) => {
      const scope = scopes[entry._id];
      if (!scope) return entry;
      const { characterId: _owner, ...shared } = entry;
      return scope === 'global'
        ? { ...shared, scope }
        : { ...shared, scope, campaignId: sheet.campaign?.campaignId };
    }),
  };
}
function withoutCampaign(sheet: CharacterSheetSnapshot) {
  return {
    ...sheet,
    campaign: null,
    character: { ...sheet.character, campaignId: undefined },
  };
}

const catalogRegion = () => screen.getByRole('region', { name: 'Catalog' });
const adjustmentsRegion = () =>
  screen.getByRole('region', { name: 'Personal adjustments' });
const adjustment = (name: string) =>
  within(adjustmentsRegion()).getByRole('listitem', { name });
function openDefinition(row: HTMLElement, name: string) {
  fireEvent.click(
    within(row).getByRole('button', { name: `Definition ${name}` }),
  );
}
const action = (row: HTMLElement, name: string) =>
  within(row).getByRole('button', { name: new RegExp(`^${name}`) });
function lastCall(name: string) {
  const call = calls.filter((item) => item.name === name).at(-1);
  if (!call) throw new Error(`Expected a ${name} write`);
  return call;
}

function recalculate(sheet: CharacterSheetSnapshot): CharacterSheetSnapshot {
  const input = {
    entries: sheet.entries,
    catalogEntries: sheet.catalogEntries,
    characterKind: 'pc' as const,
  };
  return {
    ...sheet,
    calculated: calculateCharacterSheet(input),
    permanentCalculated: calculateCharacterSheet(input, {
      permanentOnly: true,
    }),
  };
}

/**
 * The live read after Customize for campaign or Detach: a copy of `sourceId`
 * replaces it, and every reference on this sheet points at the copy.
 */
function withCopy(
  sheet: CharacterSheetSnapshot,
  {
    sourceId,
    copyId,
    scope,
    operation,
  }: {
    sourceId: string;
    copyId: string;
    scope: 'campaign' | 'character';
    operation: Call;
  },
): CharacterSheetSnapshot {
  const repoint = <Value,>(value: Value): Value =>
    JSON.parse(
      JSON.stringify(value).replaceAll(`"${sourceId}"`, `"${copyId}"`),
    ) as Value;
  const catalogEntries = sheet.catalogEntries.map((entry): CatalogEntry => {
    if (entry._id !== sourceId) return repoint(entry);
    const {
      characterId: _owner,
      campaignId: _campaign,
      campaignPreference: _preference,
      ...body
    } = repoint(entry);
    const owner =
      scope === 'campaign'
        ? { campaignId: sheet.campaign?.campaignId, campaignPreference: true }
        : { characterId };
    return { ...body, ...owner, scope, copiedFrom: sourceId } as CatalogEntry;
  });
  return recalculate({
    ...sheet,
    entries: repoint(sheet.entries),
    catalogEntries,
    lastOperationId: String(operation.args.operationId),
  });
}

function openOneOff() {
  fireEvent.click(
    within(catalogRegion()).getByRole('button', { name: 'Create one-off' }),
  );
  const form = within(catalogRegion()).getByRole('form', {
    name: 'New one-off',
  });
  return {
    form,
    name: within(form).getByRole('textbox', { name: 'Name' }),
    value: within(form).getByRole('textbox', { name: 'Modifier 1 value' }),
    save: () =>
      fireEvent.click(
        within(form).getByRole('button', { name: 'Save one-off' }),
      ),
  };
}

test('Create one-off tells a blank name from missing and malformed Modifier values in place, without a write', async () => {
  renderSheet(buildSheet());
  const { form, name, value, save } = openOneOff();
  expect(
    within(form).getByText('Only this character uses this definition.'),
  ).toBeVisible();
  expect(within(form).getByRole('radio', { name: 'Feat' })).toBeChecked();

  save();
  expect(await within(form).findByText('Name is required')).toBeVisible();
  expect(within(form).getByText('Modifier value is required')).toBeVisible();
  expect(name).toHaveAttribute('aria-invalid', 'true');
  fireEvent.change(value, { target: { value: 'two' } });
  save();
  expect(
    await within(form).findByText('Modifier value must be a number'),
  ).toBeVisible();
  expect(calls).toEqual([]);
});

test('Create one-off offers every one-off kind, sends races and archetypes with their required details, keeps a refused draft, and Cancel returns focus to Create one-off', async () => {
  renderSheet(buildSheet());
  const { form, name, value, save } = openOneOff();
  const kinds = within(form).getByRole('radiogroup', { name: 'Kind' });
  expect(
    within(kinds)
      .getAllByRole('radio')
      .map((option) => option.getAttribute('aria-label')),
  ).toEqual([
    'Feat',
    'Trait',
    'Class feature',
    'Race',
    'Racial trait',
    'Archetype',
    'Personal adjustment',
  ]);

  fireEvent.click(within(kinds).getByRole('radio', { name: 'Archetype' }));
  fireEvent.change(name, { target: { value: 'Bladebound' } });
  fireEvent.change(value, { target: { value: '1' } });
  save();
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall('createOneOff').args).toMatchObject({
    definition: {
      name: 'Bladebound',
      detail: { kind: 'archetype', classEntryIds: [], replaces: [], adds: [] },
    },
  });
  await act(async () =>
    lastCall('createOneOff').reject(new ConvexError('Sheet is archived')),
  );
  expect(within(form).getByRole('alert')).toHaveTextContent(
    /weren't saved.*Sheet is archived/,
  );
  expect(name).toHaveValue('Bladebound');

  fireEvent.click(within(kinds).getByRole('radio', { name: 'Race' }));
  save();
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall('createOneOff').args).toMatchObject({
    definition: { detail: { kind: 'race', racialTraits: [] } },
  });
  await act(async () =>
    lastCall('createOneOff').reject(new ConvexError('Sheet is archived')),
  );

  fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('form', { name: 'New one-off' })).toBeNull();
  const create = within(catalogRegion()).getByRole('button', {
    name: 'Create one-off',
  });
  expect(create).toBeEnabled();
  expect(create).toHaveFocus();
});

test('a saved one-off adds the definition with its entry, closes, and focuses the new row', async () => {
  const sheet = renderSheet(buildSheet());
  const { form, name, value, save } = openOneOff();
  fireEvent.click(
    within(form).getByRole('radio', { name: 'Personal adjustment' }),
  );
  fireEvent.change(name, { target: { value: 'Lucky charm' } });
  fireEvent.change(value, { target: { value: '1' } });
  save();
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall('createOneOff').args).toMatchObject({
    characterId,
    definition: {
      name: 'Lucky charm',
      stacksWithItself: false,
      sources: [],
      detail: { kind: 'manual' },
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 1 }],
    },
  });
  await act(async () => lastCall('createOneOff').resolve('charm'));
  expect(screen.queryByRole('form', { name: 'New one-off' })).toBeNull();

  sheet.show(
    buildSheet({
      adjustments: [
        {
          id: 'charm',
          name: 'Lucky charm',
          modifiers: [
            { target: 'ability.str', bonusType: 'untyped', value: 1 },
          ],
        },
      ],
      lastOperationId: String(lastCall('createOneOff').args.operationId),
    }),
  );
  expect(
    screen.getByRole('switch', { name: 'Lucky charm: active' }),
  ).toHaveFocus();
  expect(
    within(adjustment('Lucky charm')).getByText('This character only'),
  ).toBeVisible();
});

test('a global definition reads as read-only, offers Customize for campaign and Detach, and its row state still toggles', () => {
  renderSheet(
    withScopes(buildSheet({ adjustments: [blessing] }), {
      'blessing-catalog': 'global',
    }),
  );
  const row = adjustment('Battle blessing');
  expect(within(row).getByText('Global catalog')).toBeVisible();
  expect(
    within(row).queryByRole('button', { name: 'Edit Battle blessing' }),
  ).toBeNull();
  openDefinition(row, 'Battle blessing');
  expect(
    within(row).getByText('Global catalog content is read-only.'),
  ).toBeVisible();
  expect(
    within(row).queryByRole('button', { name: /^Edit definition/ }),
  ).toBeNull();
  expect(action(row, 'Customize for campaign')).toBeEnabled();
  expect(action(row, 'Detach')).toBeEnabled();
  expect(
    within(row).getByText(
      'Characters in this campaign using this definition will use the campaign copy.',
    ),
  ).toBeVisible();

  fireEvent.click(
    within(row).getByRole('switch', { name: 'Battle blessing: active' }),
  );
  expect(lastCall('editAdjustment').args).toMatchObject({
    entryId: 'blessing',
    active: false,
  });
});

test('a private Character explains that Save to catalog and Customize for campaign need a campaign; a campaign Character may use them', () => {
  const shared = buildSheet({ adjustments: [blessing, ward] });
  const scoped = withScopes(shared, { 'ward-catalog': 'global' });
  const sheet = renderSheet(withoutCampaign(scoped));
  openDefinition(adjustment('Battle blessing'), 'Battle blessing');
  openDefinition(adjustment('Warding charm'), 'Warding charm');
  expect(
    action(adjustment('Battle blessing'), 'Save to catalog'),
  ).toBeDisabled();
  expect(
    within(adjustment('Battle blessing')).getByText(
      'Save to catalog requires a campaign.',
    ),
  ).toBeVisible();
  expect(
    action(adjustment('Warding charm'), 'Customize for campaign'),
  ).toBeDisabled();
  expect(
    within(adjustment('Warding charm')).getByText(
      'Customize for campaign requires a campaign.',
    ),
  ).toBeVisible();

  sheet.show(scoped);
  expect(
    action(adjustment('Battle blessing'), 'Save to catalog'),
  ).toBeEnabled();
  expect(
    within(adjustment('Battle blessing')).getByText(
      'Share this definition with the campaign.',
    ),
  ).toBeVisible();
  expect(
    action(adjustment('Warding charm'), 'Customize for campaign'),
  ).toBeEnabled();
});

test('Save to catalog shows Saving and Saved beside itself, a refusal stays beside it for a retry, and other rows stay usable', async () => {
  renderSheet(buildSheet({ adjustments: [blessing, ward] }));
  const row = adjustment('Battle blessing');
  openDefinition(row, 'Battle blessing');
  fireEvent.click(action(row, 'Save to catalog'));
  expect(lastCall('saveToCatalog').args).toMatchObject({
    catalogEntryId: 'blessing-catalog',
  });
  expect(within(row).getByText('Saving…')).toBeVisible();
  expect(action(row, 'Save to catalog')).toBeDisabled();
  expect(
    screen.getByRole('switch', { name: 'Warding charm: active' }),
  ).toBeEnabled();

  await act(async () =>
    lastCall('saveToCatalog').reject(new ConvexError('Campaign is archived')),
  );
  expect(within(row).getByRole('alert')).toHaveTextContent(
    /wasn't saved.*Campaign is archived/,
  );
  fireEvent.click(action(row, 'Save to catalog'));
  await act(async () => lastCall('saveToCatalog').resolve('blessing-catalog'));
  expect(within(row).getByText('Saved')).toBeVisible();
  expect(within(row).queryByRole('alert')).toBeNull();
});

test('Customize for campaign shows Saving beside itself, a refusal stays beside it for a retry, and the retried copy opens its campaign editor from the live read while other rows stay usable', async () => {
  const base = withScopes(buildSheet({ adjustments: [blessing, ward] }), {
    'blessing-catalog': 'global',
  });
  definitions = base.catalogEntries;
  const sheet = renderSheet(base);
  const row = adjustment('Battle blessing');
  openDefinition(row, 'Battle blessing');
  fireEvent.click(action(row, 'Customize for campaign'));
  expect(lastCall('customizeForCampaign').args).toMatchObject({
    catalogEntryId: 'blessing-catalog',
  });
  expect(within(row).getByText('Saving…')).toBeVisible();
  expect(action(row, 'Customize for campaign')).toBeDisabled();
  expect(
    screen.getByRole('switch', { name: 'Warding charm: active' }),
  ).toBeEnabled();
  expect(
    within(adjustment('Warding charm')).getByRole('button', {
      name: 'Definition Warding charm',
    }),
  ).toBeEnabled();

  await act(async () =>
    lastCall('customizeForCampaign').reject(
      new ConvexError('Campaign is archived'),
    ),
  );
  expect(within(row).getByRole('alert')).toHaveTextContent(
    /wasn't saved.*Campaign is archived/,
  );
  expect(within(row).getByText('Global catalog')).toBeVisible();

  fireEvent.click(action(row, 'Customize for campaign'));
  const retry = lastCall('customizeForCampaign');
  await act(async () => retry.resolve('blessing-copy'));
  expect(within(row).getByText('Saved')).toBeVisible();
  expect(within(row).queryByRole('alert')).toBeNull();
  expect(within(row).queryByRole('form')).toBeNull();

  const customized = withCopy(base, {
    sourceId: 'blessing-catalog',
    copyId: 'blessing-copy',
    scope: 'campaign',
    operation: retry,
  });
  definitions = customized.catalogEntries;
  sheet.show(customized);
  expect(within(row).getByText('Campaign catalog')).toBeVisible();
  const form = within(row).getByRole('form', {
    name: 'Edit definition Battle blessing',
  });
  expect(within(form).getByRole('textbox', { name: 'Name' })).toHaveFocus();
  expect(within(form).getByRole('textbox', { name: 'Name' })).toHaveValue(
    'Battle blessing',
  );
  expect(
    within(form).getByText(
      'Changes apply to characters using this campaign definition.',
    ),
  ).toBeVisible();
  expect(
    screen.getByRole('switch', { name: 'Battle blessing: active' }),
  ).toBeChecked();
});

test('a refused campaign definition edit keeps its draft beside the error, and a retry saves and closes the editor', async () => {
  const base = withScopes(buildSheet({ adjustments: [blessing] }), {
    'blessing-catalog': 'campaign',
  });
  definitions = base.catalogEntries;
  renderSheet(base);
  const row = adjustment('Battle blessing');
  expect(
    within(row).queryByRole('button', { name: 'Edit Battle blessing' }),
  ).toBeNull();
  openDefinition(row, 'Battle blessing');
  expect(
    within(row).getByText(
      'Changes apply to characters using this campaign definition.',
    ),
  ).toBeVisible();
  fireEvent.click(action(row, 'Edit definition'));
  const form = within(row).getByRole('form', {
    name: 'Edit definition Battle blessing',
  });
  const name = within(form).getByRole('textbox', { name: 'Name' });
  fireEvent.change(name, { target: { value: 'Blessing of war' } });
  fireEvent.click(
    within(form).getByRole('button', { name: 'Save definition' }),
  );
  await waitFor(() => expect(lastCall('editDefinition').args).toBeDefined());
  expect(lastCall('editDefinition').args).toMatchObject({
    catalogEntryId: 'blessing-catalog',
    name: 'Blessing of war',
  });
  await act(async () =>
    lastCall('editDefinition').reject(new ConvexError('Campaign is archived')),
  );
  expect(within(form).getByRole('alert')).toHaveTextContent(
    /weren't saved.*Your edits are kept/,
  );
  expect(name).toHaveValue('Blessing of war');

  fireEvent.click(
    within(form).getByRole('button', { name: 'Save definition' }),
  );
  await waitFor(() => expect(calls).toHaveLength(2));
  await act(async () => lastCall('editDefinition').resolve(null));
  expect(
    within(row).queryByRole('form', { name: /^Edit definition/ }),
  ).toBeNull();
  expect(action(row, 'Edit definition')).toHaveFocus();
});

// --- Grants --------------------------------------------------------------

const armorTraining = {
  _id: 'armor-training',
  _creationTime: 4,
  scope: 'global',
  name: 'Armor Training 1',
  ruleIdentity: 'feature/armor-training',
  stacksWithItself: false,
  detail: { kind: 'classFeature' },
  sources: [],
  modifiers: [{ target: 'ac.other', bonusType: 'untyped', value: 1 }],
} as unknown as CatalogEntry;

/** Fighter 1 granting a global Armor Training 1 that no row has stored. */
function withGrant(base: CharacterSheetSnapshot): CharacterSheetSnapshot {
  const catalogEntries = [
    ...base.catalogEntries.map((entry) =>
      entry._id === 'fighter' && entry.detail.kind === 'class'
        ? ({
            ...entry,
            detail: {
              ...entry.detail,
              featuresByLevel: [
                { classLevel: 1, catalogEntryId: 'armor-training' },
              ],
            },
          } as CatalogEntry)
        : entry,
    ),
    armorTraining,
  ];
  return recalculate({ ...base, catalogEntries });
}

test('Detach on an unstored Grant sends its Grant Key and keeps the Grant row; a Character definition offers no Detach', async () => {
  renderSheet(
    withGrant(
      buildSheet({
        levels: [{ id: 'level-1', hp: 10, classId: 'fighter' }],
        adjustments: [blessing],
      }),
    ),
    ['catalog', 'adjustments', 'grants'],
  );
  const features = screen.getByRole('region', { name: 'Class features' });
  const row = within(features).getByRole('listitem', {
    name: 'Armor Training 1',
  });
  openDefinition(row, 'Armor Training 1');
  fireEvent.click(action(row, 'Detach'));
  expect(lastCall('detach').args).toMatchObject({
    target: {
      kind: 'grant',
      grantKey: {
        source: 'fighter',
        classLevel: 1,
        entry: 'feature/armor-training',
      },
    },
  });
  await act(async () => lastCall('detach').resolve('armor-copy'));
  expect(within(row).getByText('Saved')).toBeVisible();
  expect(within(row).getByText('Fighter 1')).toBeVisible();
  expect(
    within(row).getByRole('switch', { name: 'Armor Training 1: on' }),
  ).toBeEnabled();
  expect(
    within(row).getByRole('button', { name: 'Definition Armor Training 1' }),
  ).toHaveFocus();

  const own = adjustment('Battle blessing');
  openDefinition(own, 'Battle blessing');
  expect(within(own).queryByRole('button', { name: /^Detach/ })).toBeNull();
});

// --- Catalog list and changed-copy notices -------------------------------

test('Browse catalog waits without inventing entries and counts only addable cards; a Customize copy replaces its original card, opens its campaign editor there, and keeps its fields when the original changes', async () => {
  definitions = undefined;
  const base = buildSheet();
  const sheet = renderSheet(base);
  fireEvent.click(
    within(catalogRegion()).getByRole('button', { name: 'Browse catalog' }),
  );
  expect(within(catalogRegion()).getByText('Loading catalog…')).toBeVisible();
  expect(
    within(catalogRegion()).getByRole('searchbox', { name: 'Search catalog' }),
  ).toBeDisabled();

  definitions = [];
  sheet.refresh();
  expect(
    within(catalogRegion()).getByText('No catalog entries available.'),
  ).toBeVisible();
  definitions = [
    {
      ...armorTraining,
      _id: 'paladin',
      name: 'Paladin',
      detail: { kind: 'class' },
    } as unknown as CatalogEntry,
  ];
  sheet.refresh();
  expect(
    within(catalogRegion()).getByText('No catalog entries available.'),
  ).toBeVisible();
  expect(within(catalogRegion()).queryByText('Paladin')).toBeNull();

  const powerAttack = {
    ...armorTraining,
    _id: 'power-attack',
    name: 'Power Attack',
    detail: { kind: 'feat' },
  } as unknown as CatalogEntry;
  definitions = [powerAttack];
  sheet.show({
    ...base,
    catalogEntries: [...base.catalogEntries, powerAttack],
  });
  const list = () =>
    within(catalogRegion()).getByRole('list', { name: 'Catalog entries' });
  expect(
    within(catalogCard('Power Attack')).getByText('Global catalog'),
  ).toBeVisible();
  openDefinition(catalogCard('Power Attack'), 'Power Attack');
  fireEvent.click(
    action(catalogCard('Power Attack'), 'Customize for campaign'),
  );
  expect(lastCall('customizeForCampaign').args).toMatchObject({
    catalogEntryId: 'power-attack',
  });
  await act(async () =>
    lastCall('customizeForCampaign').resolve('power-attack-copy'),
  );

  const copy = {
    ...powerAttack,
    _id: 'power-attack-copy',
    scope: 'campaign',
    campaignId: base.campaign?.campaignId,
    copiedFrom: 'power-attack',
    campaignPreference: true,
  } as unknown as CatalogEntry;
  definitions = [copy];
  sheet.show({ ...base, catalogEntries: [...base.catalogEntries, copy] });
  const cards = within(list()).getAllByRole('listitem', {
    name: 'Power Attack',
  });
  expect(cards).toHaveLength(1);
  expect(within(cards[0]!).getByText('Campaign catalog')).toBeVisible();
  const form = within(cards[0]!).getByRole('form', {
    name: 'Edit definition Power Attack',
  });
  const name = within(form).getByRole('textbox', { name: 'Name' });
  const value = within(form).getByRole('textbox', { name: 'Modifier 1 value' });
  expect(name).toHaveFocus();
  expect(name).toHaveValue('Power Attack');
  expect(value).toHaveValue('1');

  const revised = {
    ...powerAttack,
    name: 'Power Attack (revised)',
    modifiers: [{ target: 'ac.other', bonusType: 'untyped', value: 3 }],
  } as unknown as CatalogEntry;
  sheet.show({
    ...base,
    catalogEntries: [...base.catalogEntries, revised, copy],
  });
  expect(screen.queryByText(/revised/)).toBeNull();
  expect(catalogCard('Power Attack')).toBe(cards[0]);
  expect(name).toHaveValue('Power Attack');
  expect(value).toHaveValue('1');
});

test('a changed original is named only while the advisory read returns it, and the copy keeps its own fields', () => {
  const base = withScopes(buildSheet({ adjustments: [blessing] }), {
    'blessing-catalog': 'campaign',
  });
  advisories = undefined;
  const sheet = renderSheet(base);
  const notice = /has changed\. Your copy is unchanged\./;
  expect(screen.queryByText(notice)).toBeNull();
  expect(screen.queryByText(/unavailable|unchanged/i)).toBeNull();

  advisories = [
    {
      catalogEntryId: 'blessing-catalog',
      originalId: 'original-blessing',
      originalName: 'Blessing of the Front',
    },
  ];
  sheet.refresh();
  const row = adjustment('Battle blessing');
  expect(
    within(row).getByText(
      'The original “Blessing of the Front” has changed. Your copy is unchanged.',
    ),
  ).toBeVisible();
  expect(within(row).getByText('+2 morale to Strength')).toBeVisible();

  advisories = [];
  sheet.refresh();
  expect(screen.queryByText(/Blessing of the Front/)).toBeNull();
  expect(screen.queryByText(notice)).toBeNull();
});

test("another player's definition change is announced once for the catalog and once in the open editor, and every draft survives it and its dismissal", async () => {
  const base = withScopes(buildSheet({ adjustments: [blessing] }), {
    'blessing-catalog': 'campaign',
  });
  definitions = base.catalogEntries;
  const sheet = renderSheet(base);
  const oneOff = openOneOff();
  const trait = within(oneOff.form).getByRole('radio', { name: 'Trait' });
  fireEvent.click(trait);
  fireEvent.change(oneOff.name, { target: { value: 'Reactionary (draft)' } });
  fireEvent.change(oneOff.value, { target: { value: '2' } });
  const row = adjustment('Battle blessing');
  openDefinition(row, 'Battle blessing');
  fireEvent.click(action(row, 'Edit definition'));
  const form = within(row).getByRole('form', {
    name: 'Edit definition Battle blessing',
  });
  const name = within(form).getByRole('textbox', { name: 'Name' });
  const value = within(form).getByRole('textbox', {
    name: 'Modifier 1 value',
  });
  fireEvent.change(name, { target: { value: 'Blessing (draft)' } });
  fireEvent.change(value, { target: { value: '3' } });
  function expectDrafts() {
    expect(name).toHaveValue('Blessing (draft)');
    expect(value).toHaveValue('3');
    expect(oneOff.name).toHaveValue('Reactionary (draft)');
    expect(oneOff.value).toHaveValue('2');
    expect(trait).toBeChecked();
  }

  const changed = {
    ...base,
    catalogEntries: base.catalogEntries.map((entry) =>
      entry._id === 'blessing-catalog'
        ? { ...entry, name: 'Blessing of war' }
        : entry,
    ),
    lastOperationId: 'other-player',
  };
  definitions = changed.catalogEntries;
  sheet.show(changed);
  const catalogNotice =
    'Another player changed these definitions. Your edits are kept.';
  const definitionNotice =
    'Another player changed this definition. Your edits are kept.';
  expect(screen.getAllByText(catalogNotice)).toHaveLength(1);
  expect(within(catalogRegion()).getByText(catalogNotice)).toBeVisible();
  expect(screen.getAllByText(definitionNotice)).toHaveLength(1);
  expect(within(form).getByText(definitionNotice)).toBeVisible();
  expect(
    within(form)
      .getAllByRole('status')
      .filter((status) => status.textContent?.includes(definitionNotice)),
  ).toHaveLength(1);
  expectDrafts();

  fireEvent.click(within(form).getByRole('button', { name: /^Dismiss/ }));
  expect(screen.queryByText(definitionNotice)).toBeNull();
  expect(within(catalogRegion()).getByText(catalogNotice)).toBeVisible();
  fireEvent.click(
    within(catalogRegion()).getByRole('button', {
      name: 'Dismiss definitions update',
    }),
  );
  expect(screen.queryByText(catalogNotice)).toBeNull();
  expectDrafts();
});

test('maintenance disables Create one-off and catalog writes with the reason beside them', () => {
  maintenance.mockReturnValue({
    kind: 'maintenance',
    readOnly: true,
    message: 'Character sheets are read-only during maintenance.',
  });
  renderSheet(buildSheet({ adjustments: [blessing] }));
  expect(
    within(catalogRegion()).getByRole('button', { name: 'Create one-off' }),
  ).toBeDisabled();
  expect(
    within(catalogRegion()).getByText(
      'Character sheets are read-only during maintenance.',
    ),
  ).toBeVisible();
  const row = adjustment('Battle blessing');
  openDefinition(row, 'Battle blessing');
  expect(action(row, 'Save to catalog')).toBeDisabled();
  expect(
    within(row).getByText('Character sheets are read-only during maintenance.'),
  ).toBeVisible();
});

// --- Adding existing definitions -----------------------------------------

const focus: Adjustment = {
  id: 'focus',
  name: 'Weapon Focus',
  modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 1 }],
};
const haste: CatalogSheetEntry = {
  id: 'haste',
  name: 'Haste',
  detail: {
    kind: 'spellEffect',
    lastsOverOneDay: false,
    defaultCasterLevel: 5,
  },
  modifiers: [{ target: 'ac.other', bonusType: 'dodge', value: 1 }],
  casterLevel: 7,
};

/** Character, campaign and global definitions, one a feat and one a Spell Effect. */
function withCatalogChoices() {
  const base = withScopes(
    buildSheet({
      levels: [{ id: 'level-1', hp: 10, classId: 'fighter' }],
      adjustments: [blessing, ward, focus],
      sheetEntries: [haste],
    }),
    {
      'ward-catalog': 'campaign',
      'focus-catalog': 'global',
      'haste-catalog': 'global',
    },
  );
  return recalculate({
    ...base,
    entries: base.entries.map(
      (entry): CharacterSheetSnapshot['entries'][number] =>
        entry._id === 'focus' && entry.kind === 'manual'
          ? { ...entry, kind: 'feat', state: { kind: 'feat' } }
          : entry,
    ),
    catalogEntries: base.catalogEntries.map(
      (entry): CatalogEntry =>
        entry._id === 'focus-catalog' && entry.detail.kind === 'manual'
          ? { ...entry, detail: { kind: 'feat' } }
          : entry,
    ),
  });
}
const catalogCard = (name: string) =>
  within(
    within(catalogRegion()).getByRole('list', { name: 'Catalog entries' }),
  ).getByRole('listitem', { name });
const addToSheet = (card: HTMLElement) => action(card, 'Add to sheet');

test('Add to sheet selects global, campaign and Character definitions as they are, keeps a refused choice for a retry, and focuses the new row', async () => {
  const base = withCatalogChoices();
  definitions = undefined;
  const sheet = renderSheet(base);
  fireEvent.click(
    within(catalogRegion()).getByRole('button', { name: 'Browse catalog' }),
  );
  expect(within(catalogRegion()).getByText('Loading catalog…')).toBeVisible();
  expect(
    within(catalogRegion()).queryByRole('button', { name: /^Add to sheet/ }),
  ).toBeNull();

  definitions = base.catalogEntries.filter(
    (entry) => entry.detail.kind !== 'base',
  );
  sheet.refresh();
  expect(
    within(
      within(catalogRegion()).getByRole('list', { name: 'Catalog entries' }),
    ).queryByRole('listitem', { name: 'Fighter' }),
  ).toBeNull();

  const feat = catalogCard('Weapon Focus');
  fireEvent.click(addToSheet(feat));
  const form = within(feat).getByRole('form', { name: 'Add Weapon Focus' });
  const choice = within(form).getByRole('textbox', { name: 'Choice' });
  fireEvent.change(choice, { target: { value: 'Longsword' } });
  fireEvent.click(
    within(form).getByRole('button', { name: 'Add Weapon Focus' }),
  );
  expect(lastCall('selectEntry').args).toMatchObject({
    characterId,
    catalogEntryId: 'focus-catalog',
    choice: 'Longsword',
  });
  expect(within(feat).getByText('Saving…')).toBeVisible();
  expect(addToSheet(catalogCard('Warding charm'))).toBeEnabled();

  await act(async () =>
    lastCall('selectEntry').reject(new ConvexError('Feat already chosen')),
  );
  expect(within(feat).getByRole('alert')).toHaveTextContent(
    /Feat already chosen/,
  );
  expect(choice).toHaveValue('Longsword');

  fireEvent.click(
    within(form).getByRole('button', { name: 'Add Weapon Focus' }),
  );
  await act(async () => lastCall('selectEntry').resolve('focus-2'));
  expect(within(feat).queryByRole('form')).toBeNull();
  expect(within(feat).getByText('Saved')).toBeVisible();
  sheet.show({
    ...withCatalogChoices(),
    ...buildSheet({
      adjustments: [
        { ...focus, id: 'focus-2', name: 'Weapon Focus (Longsword)' },
      ],
      lastOperationId: String(lastCall('selectEntry').args.operationId),
    }),
  });
  expect(
    screen.getByRole('switch', { name: 'Weapon Focus (Longsword): active' }),
  ).toHaveFocus();

  const campaign = catalogCard('Warding charm');
  fireEvent.click(addToSheet(campaign));
  fireEvent.click(
    within(campaign).getByRole('button', { name: 'Add Warding charm' }),
  );
  expect(lastCall('selectEntry').args).toMatchObject({
    catalogEntryId: 'ward-catalog',
  });
  expect(lastCall('selectEntry').args).not.toHaveProperty('choice');

  fireEvent.click(addToSheet(catalogCard('Haste')));
  expect(lastCall('selectEntry').args).toMatchObject({
    catalogEntryId: 'haste-catalog',
  });
  expect(addToSheet(catalogCard('Battle blessing'))).toBeEnabled();
});

// --- Class Level definitions ---------------------------------------------

test('a Class Level offers Customize for campaign and Detach for its global class; each keeps its hit points, favored class bonus and Class Level controls, and an Unspecified level offers none', async () => {
  const base = withScopes(
    buildSheet({
      levels: [
        {
          id: 'level-1',
          hp: 10,
          classId: 'fighter',
          favoredClassBonus: { choice: 'hp' },
        },
        { id: 'level-2', hp: 6 },
      ],
      favoredClassIds: ['fighter'],
    }),
    { fighter: 'global' },
  );
  definitions = base.catalogEntries;
  const sheet = renderSheet(base, ['catalog', 'levels']);
  const level = (position: number) =>
    within(screen.getByRole('region', { name: 'Class Levels' })).getByRole(
      'listitem',
      { name: `Level ${position}` },
    );
  function expectLevelKept() {
    expect(
      within(level(1)).getByRole('textbox', { name: /^Hit points/ }),
    ).toHaveValue('10');
    expect(
      within(level(1)).getByRole('combobox', {
        name: 'Favored class bonus at level 1',
      }),
    ).toHaveValue('hp');
    expect(
      within(level(1)).getByRole('combobox', { name: 'Class at level 1' }),
    ).toBeEnabled();
  }
  expect(
    within(level(2)).queryByRole('button', { name: /^Definition/ }),
  ).toBeNull();

  openDefinition(level(1), 'Fighter');
  expect(
    within(level(1)).getByText('Global catalog content is read-only.'),
  ).toBeVisible();
  fireEvent.click(action(level(1), 'Customize for campaign'));
  const customize = lastCall('customizeForCampaign');
  expect(customize.args).toMatchObject({ catalogEntryId: 'fighter' });
  await act(async () => customize.resolve('fighter-copy'));
  expect(within(level(1)).getByText('Saved')).toBeVisible();
  const customized = withCopy(base, {
    sourceId: 'fighter',
    copyId: 'fighter-copy',
    scope: 'campaign',
    operation: customize,
  });
  definitions = customized.catalogEntries;
  sheet.show(customized);
  expect(within(level(1)).getByText('Campaign catalog')).toBeVisible();
  expect(within(level(1)).getByRole('textbox', { name: 'Name' })).toHaveFocus();
  expectLevelKept();

  fireEvent.click(action(level(1), 'Detach'));
  const detach = lastCall('detach');
  expect(detach.args).toMatchObject({
    target: { kind: 'entry', entryId: 'level-1' },
  });
  await act(async () => detach.resolve('fighter-own'));
  const toggle = within(level(1)).getByRole('button', {
    name: 'Definition Fighter',
  });
  expect(toggle).toHaveFocus();
  sheet.show(
    withCopy(customized, {
      sourceId: 'fighter-copy',
      copyId: 'fighter-own',
      scope: 'character',
      operation: detach,
    }),
  );
  expect(within(level(1)).getByText('This character only')).toBeVisible();
  expect(toggle).toHaveFocus();
  expectLevelKept();
});

// --- Shared Spell Effect caster level ------------------------------------

function sharedHaste(casterLevel = 7, lastOperationId = 'seed') {
  return withScopes(
    buildSheet({ sheetEntries: [{ ...haste, casterLevel }], lastOperationId }),
    { 'haste-catalog': 'global' },
  );
}
const hasteRow = () =>
  within(screen.getByRole('region', { name: 'Sheet entries' })).getByRole(
    'listitem',
    { name: 'Haste' },
  );
function openCasterLevel() {
  fireEvent.click(action(hasteRow(), 'Edit caster level'));
  const form = within(hasteRow()).getByRole('form', {
    name: 'Caster level Haste',
  });
  return {
    form,
    field: within(form).getByRole('textbox', { name: 'Caster level' }),
    save: () =>
      fireEvent.click(
        within(form).getByRole('button', { name: 'Save caster level' }),
      ),
  };
}

test('a shared Spell Effect saves only its caster level: malformed levels stay in place, a refusal keeps the level, and blank restores the default', async () => {
  renderSheet(sharedHaste(), ['catalog', 'entries']);
  expect(
    within(hasteRow()).queryByRole('button', { name: 'Edit Haste' }),
  ).toBeNull();
  // Its duration carries its own title, so the two read as one line of text.
  expect(hasteRow()).toHaveTextContent('Default CL 5 · Lasts one day or less');
  expect(within(hasteRow()).getByText('Lasts one day or less')).toHaveAttribute(
    'title',
    'Counts in current totals only; militia facts, skill budgets and bonus spells leave it out',
  );
  const { form, field, save } = openCasterLevel();
  expect(field).toHaveValue('7');
  expect(field).toHaveAccessibleDescription(
    'Blank restores the default caster level (5).',
  );

  fireEvent.change(field, { target: { value: '-1' } });
  save();
  expect(
    await within(form).findByText(
      'Caster level must be a whole number of 0 or more',
    ),
  ).toBeVisible();
  expect(field).toHaveAttribute('aria-invalid', 'true');
  expect(calls).toEqual([]);

  fireEvent.change(field, { target: { value: '9' } });
  save();
  await waitFor(() => expect(calls).toHaveLength(1));
  const sent = lastCall('editSheetEntry').args;
  expect(sent).toMatchObject({ entryId: 'haste', casterLevel: 9 });
  for (const definitionField of ['name', 'modifiers', 'detail', 'active'])
    expect(sent).not.toHaveProperty(definitionField);
  await act(async () =>
    lastCall('editSheetEntry').reject(new ConvexError('Spell has ended')),
  );
  expect(within(form).getByRole('alert')).toHaveTextContent(/Spell has ended/);
  expect(field).toHaveValue('9');

  save();
  await waitFor(() => expect(calls).toHaveLength(2));
  await act(async () => lastCall('editSheetEntry').resolve(null));
  expect(within(hasteRow()).queryByRole('form')).toBeNull();
  expect(action(hasteRow(), 'Edit caster level')).toHaveFocus();

  const reopened = openCasterLevel();
  fireEvent.change(reopened.field, { target: { value: '' } });
  reopened.save();
  await waitFor(() => expect(calls).toHaveLength(3));
  expect(lastCall('editSheetEntry').args).toMatchObject({ casterLevel: 5 });
});

test.each([
  {
    name: 'Human',
    definitionId: 'human',
    region: 'Race',
    target: { kind: 'entry', entryId: 'race-entry' },
  },
  {
    name: 'Skilled',
    definitionId: 'human-skilled',
    region: 'Race',
    target: {
      kind: 'grant',
      grantKey: { source: 'human', entry: 'human-skilled' },
    },
  },
  {
    name: 'Full plate',
    definitionId: 'plate-catalog',
    region: 'Equipment',
    target: { kind: 'entry', entryId: 'plate' },
  },
])(
  '$name offers Customize and Detach in its own block without changing recorded row state',
  async ({ name, definitionId, region, target }) => {
    const base = withScopes(
      buildSheet({
        race: { key: 'human' },
        sheetEntries: [
          {
            id: 'plate',
            name: 'Full plate',
            active: false,
            itemState: { enhancement: 2, masterwork: true },
            modifiers: [],
            detail: {
              kind: 'item',
              consumable: false,
              armor: {
                slot: 'armor',
                category: 'heavy',
                bonus: 9,
                maxDex: 1,
                armorCheckPenalty: 6,
                asf: 35,
              },
            },
          },
        ],
      }),
      {
        human: 'global',
        'human-skilled': 'global',
        'plate-catalog': 'global',
      },
    );
    definitions = base.catalogEntries;
    renderSheet(base, ['catalog', 'races', 'equipment']);
    const block = screen.getByRole('region', { name: region });
    const row =
      name === 'Human' ? block : within(block).getByRole('listitem', { name });
    openDefinition(row, name);
    expect(
      within(row).getByText('Global catalog content is read-only.'),
    ).toBeVisible();
    expect(
      within(row).queryByRole('button', { name: /^Edit definition/ }),
    ).toBeNull();

    fireEvent.click(action(row, 'Customize for campaign'));
    expect(lastCall('customizeForCampaign').args).toMatchObject({
      catalogEntryId: definitionId,
    });
    await act(async () =>
      lastCall('customizeForCampaign').resolve('campaign-copy'),
    );
    fireEvent.click(action(row, 'Detach'));
    expect(lastCall('detach').args).toMatchObject({ target });
    await act(async () => lastCall('detach').resolve('character-copy'));
    expect(calls.map((call) => call.name)).toEqual([
      'customizeForCampaign',
      'detach',
    ]);
    expect(
      within(screen.getByRole('region', { name: 'Equipment' })).getByRole(
        'button',
        { name: 'Equip Full plate' },
      ),
    ).toBeEnabled();
    expect(
      within(block).getByRole('button', { name: `Definition ${name}` }),
    ).toHaveFocus();
  },
);

test("another player's caster level change keeps the draft until dismissed; newer input and a conflicting change during a save keep the editor open, and the save's own echo stays quiet", async () => {
  const sheet = renderSheet(sharedHaste(), ['catalog', 'entries']);
  const { form, field, save } = openCasterLevel();
  fireEvent.change(field, { target: { value: '11' } });
  sheet.show(sharedHaste(8, 'other-player'));
  const notice =
    'Another player changed this caster level. Your edits are kept.';
  expect(within(form).getByText(notice)).toBeVisible();
  expect(field).toHaveValue('11');
  fireEvent.click(
    within(form).getByRole('button', { name: 'Dismiss caster level update' }),
  );
  expect(within(form).queryByText(notice)).toBeNull();
  expect(field).toHaveValue('11');

  save();
  await waitFor(() => expect(calls).toHaveLength(1));
  fireEvent.change(field, { target: { value: '12' } });
  expect(field).toBeEnabled();
  await act(async () => lastCall('editSheetEntry').resolve(null));
  expect(within(hasteRow()).getByRole('form')).toBe(form);
  expect(field).toHaveValue('12');

  save();
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall('editSheetEntry').args).toMatchObject({ casterLevel: 12 });
  sheet.show(sharedHaste(9, 'other-player'));
  await act(async () => lastCall('editSheetEntry').resolve(null));
  expect(within(hasteRow()).getByRole('form')).toBe(form);
  expect(field).toHaveValue('12');
  expect(within(form).getByText(notice)).toBeVisible();
  fireEvent.click(
    within(form).getByRole('button', { name: 'Dismiss caster level update' }),
  );

  save();
  await waitFor(() => expect(calls).toHaveLength(3));
  sheet.show(
    sharedHaste(12, String(lastCall('editSheetEntry').args.operationId)),
  );
  expect(within(form).queryByText(notice)).toBeNull();
  await act(async () => lastCall('editSheetEntry').resolve(null));
  expect(within(hasteRow()).queryByRole('form')).toBeNull();
  expect(action(hasteRow(), 'Edit caster level')).toHaveFocus();
});

// --- Phone and tablet ----------------------------------------------------

test('on a phone and a tablet the catalog keeps labeled controls and whole long names, and keyboard or touch reaches Create, Edit, Save, Customize and Detach without hover', () => {
  const longName =
    'Blessing of the Long Road Through the Ironfang Marches and Beyond';
  const sheet = withScopes(
    buildSheet({ adjustments: [{ ...blessing, name: longName }, ward] }),
    { 'blessing-catalog': 'global', 'ward-catalog': 'campaign' },
  );
  definitions = sheet.catalogEntries;
  for (const widthPx of [390, 1180]) {
    Object.defineProperty(window, 'innerWidth', {
      value: widthPx,
      configurable: true,
    });
    renderSheet(sheet);
    const shared = adjustment(longName);
    expect(within(shared).getAllByText(longName)[0]).toBeVisible();
    const toggle = within(shared).getByRole('button', {
      name: `Definition ${longName}`,
    });
    fireEvent.pointerEnter(toggle, { pointerType: 'touch' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    toggle.focus();
    expect(toggle).toHaveFocus();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const customize = within(shared).getByRole('button', {
      name: `Customize for campaign ${longName}`,
    });
    expect(customize).toHaveAccessibleDescription(
      'Characters in this campaign using this definition will use the campaign copy.',
    );
    const detach = within(shared).getByRole('button', {
      name: `Detach ${longName}`,
    });
    expect(detach).toHaveAccessibleDescription(
      'Keep a separate definition for this character.',
    );
    fireEvent.click(detach);
    expect(lastCall('detach').args).toMatchObject({
      target: { kind: 'entry', entryId: 'blessing' },
    });

    const campaign = adjustment('Warding charm');
    openDefinition(campaign, 'Warding charm');
    fireEvent.click(
      within(campaign).getByRole('button', {
        name: 'Edit definition Warding charm',
      }),
    );
    const editor = within(campaign).getByRole('form', {
      name: 'Edit definition Warding charm',
    });
    for (const field of ['Name', 'Modifier 1 value'])
      expect(
        within(editor).getByRole('textbox', { name: field }),
      ).toBeEnabled();
    expect(
      within(editor).getByRole('button', { name: 'Save definition' }),
    ).toBeEnabled();

    const { form } = openOneOff();
    expect(
      within(form).getByRole('radiogroup', { name: 'Kind' }),
    ).toBeVisible();
    expect(within(form).getByRole('radio', { name: 'Feat' })).toHaveProperty(
      'type',
      'radio',
    );
    expect(
      within(form).getByRole('button', { name: 'Save one-off' }),
    ).toBeEnabled();
    cleanup();
  }
  Object.defineProperty(window, 'innerWidth', {
    value: 1024,
    configurable: true,
  });
});

test('feat selection rows retain Customize for campaign and Detach definition controls', async () => {
  const initial = withScopes(buildSheet({ adjustments: [blessing] }), {
    'blessing-catalog': 'global',
  });
  const base = recalculate({
    ...initial,
    entries: initial.entries.map((entry) =>
      entry.kind === 'manual'
        ? {
            ...entry,
            kind: 'feat',
            state: { kind: 'feat' },
            selectionSlot: { id: 'feat:general', position: 0 },
          }
        : entry,
    ),
    catalogEntries: initial.catalogEntries.map((entry) =>
      entry._id === 'blessing-catalog'
        ? { ...entry, detail: { kind: 'feat' } }
        : entry,
    ),
  });
  definitions = base.catalogEntries;
  renderSheet(base, ['catalog', 'selections']);
  const row = within(
    screen.getByRole('region', { name: 'Feats & traits' }),
  ).getByRole('listitem', { name: 'Battle blessing' });
  openDefinition(row, 'Battle blessing');
  fireEvent.click(action(row, 'Customize for campaign'));
  expect(lastCall('customizeForCampaign').args).toMatchObject({
    catalogEntryId: 'blessing-catalog',
  });
  await act(async () =>
    lastCall('customizeForCampaign').resolve('campaign-copy'),
  );
  fireEvent.click(action(row, 'Detach'));
  expect(lastCall('detach').args).toMatchObject({
    target: { kind: 'entry', entryId: 'blessing' },
  });
});

test('a created one-off feat takes focus in Feats & traits after its saved row arrives', async () => {
  const sheet = renderSheet(buildSheet(), ['catalog', 'selections']);
  const { name, value, save } = openOneOff();
  fireEvent.change(name, { target: { value: blessing.name } });
  fireEvent.change(value, { target: { value: '2' } });
  save();
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall('createOneOff').args).toMatchObject({
    definition: { detail: { kind: 'feat' } },
  });
  await act(async () => lastCall('createOneOff').resolve('blessing'));
  const saved = buildSheet({
    adjustments: [blessing],
    lastOperationId: String(lastCall('createOneOff').args.operationId),
  });
  sheet.show(
    recalculate({
      ...saved,
      entries: saved.entries.map((entry) =>
        entry.kind === 'manual'
          ? { ...entry, kind: 'feat', state: { kind: 'feat' } }
          : entry,
      ),
      catalogEntries: saved.catalogEntries.map((entry) =>
        entry._id === 'blessing-catalog'
          ? { ...entry, detail: { kind: 'feat' } }
          : entry,
      ),
    }),
  );
  expect(
    screen.getByRole('switch', { name: 'Battle blessing: on' }),
  ).toHaveFocus();
});
