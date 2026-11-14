import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { Id } from '@convex/_generated/dataModel';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { defaultAbilityScores } from '~/lib/character-sheet';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import {
  buildSheet,
  emptyOwnerCandidates,
  type CatalogSheetEntry,
} from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';
import { api } from '@convex/_generated/api';

// Equipping armor and shields (#306): the Equipment block's rows, totals and
// gear-state editor, beside the Defenses and Skills that already include
// their effects.

type Call = {
  name: string;
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
let calls: Call[] = [];
let snapshot: CharacterSheetSnapshot | null | undefined;
const maintenance = vi.fn<() => MigrationMaintenance>();

vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));
const nameOf = characterSheetNames({
  editClassLevel: api.characterSheet.editClassLevel,
});
vi.mock('convex/react', () => ({
  useQuery: (query: FunctionReference<'query'>) => {
    const name = nameOf(query);
    return name === 'read' ? snapshot : name === 'companions' ? [] : undefined;
  },
  usePaginatedQuery: () => emptyOwnerCandidates(),
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
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
});

const fullPlate: CatalogSheetEntry = {
  id: 'plate',
  name: 'Full plate',
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
  modifiers: [],
  itemState: { enhancement: 1 },
};
const heavyShield: CatalogSheetEntry = {
  id: 'shield',
  name: 'Heavy steel shield',
  detail: {
    kind: 'item',
    consumable: false,
    armor: {
      slot: 'shield',
      category: 'heavyShield',
      bonus: 2,
      maxDex: null,
      armorCheckPenalty: 2,
      asf: 15,
    },
  },
  modifiers: [],
};
// CRB p. 152: a heavy shield's bash is a one-handed martial weapon.
const bashingShield: CatalogSheetEntry = {
  ...heavyShield,
  detail: {
    kind: 'item',
    consumable: false,
    armor: {
      slot: 'shield',
      category: 'heavyShield',
      bonus: 2,
      maxDex: null,
      armorCheckPenalty: 2,
      asf: 15,
    },
    weapon: {
      baseType: 'heavy shield',
      proficiency: 'martial',
      handedness: 'oneHanded',
      dice: '1d4',
      threat: 20,
      mult: 2,
    },
  },
};
const buckler: CatalogSheetEntry = {
  id: 'buckler',
  name: 'Buckler',
  detail: {
    kind: 'item',
    consumable: false,
    armor: {
      slot: 'shield',
      category: 'buckler',
      bonus: 1,
      armorCheckPenalty: 1,
    },
  },
  modifiers: [],
  active: false,
};
const nimble = { ...defaultAbilityScores, dexterity: 18 };
const armored = (
  input: Parameters<typeof buildSheet>[0] = {},
): Parameters<typeof buildSheet>[0] => ({
  scores: nimble,
  levels: [{ id: 'level-1', hp: 10, classId: 'fighter' }],
  sheetEntries: [fullPlate, heavyShield, buckler],
  ...input,
});

const page = () => (
  <CharacterSheetBlocks blocks={['defenses', 'equipment', 'skills']} />
);
function renderSheet(initial: CharacterSheetSnapshot | undefined) {
  snapshot = initial;
  const view = render(page());
  return {
    show(next: CharacterSheetSnapshot) {
      snapshot = next;
      view.rerender(page());
    },
  };
}
const equipment = () => screen.getByRole('region', { name: 'Equipment' });
const item = (name: string) =>
  within(equipment()).getByRole('listitem', { name });
const button = (name: string | RegExp) =>
  within(equipment()).getByRole('button', { name });
const typeInto = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } });
function lastCall() {
  const call = calls.at(-1);
  if (!call) throw new Error('Expected a write');
  return call;
}
// The item editor (#408): a panel named for the item, a group per part.
function renderEquipment(initial: CharacterSheetSnapshot) {
  snapshot = initial;
  const blocks = () => <CharacterSheetBlocks blocks={['equipment']} />;
  const view = render(blocks());
  return {
    show(next: CharacterSheetSnapshot) {
      snapshot = next;
      view.rerender(blocks());
    },
  };
}
function openEditor(name: string) {
  fireEvent.click(button(`Edit ${name}`));
  return screen.getByRole('dialog', { name });
}
const section = (panel: HTMLElement, name: string) =>
  within(panel).getByRole('group', { name });
const textbox = (group: HTMLElement, name: string) =>
  within(group).getByRole('textbox', { name });
const settle = (action: () => void) =>
  act(async () => {
    action();
    await Promise.resolve();
  });
async function closeEditor(panel: HTMLElement) {
  fireEvent.click(within(panel).getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}

test('full plate and a shield show their authoritative totals, a numeric nonproficiency penalty and no warning; AC is capped, CMD is not, and skills carry the penalty once', () => {
  const sheet = buildSheet(armored());
  renderSheet(sheet);
  const { derivedStatistics, breakdowns } = sheet.calculated;
  expect(button('Armor check penalty −7, breakdown')).toBeVisible();
  expect(button('Arcane spell failure 50%, breakdown')).toBeVisible();
  expect(button('Maximum Dexterity bonus to AC +1, breakdown')).toBeVisible();
  expect(
    within(item('Full plate')).getByText(
      'Not proficient: Full plate −5 to attacks',
    ),
  ).toBeVisible();
  expect(
    within(item('Heavy steel shield')).getByText(
      'Not proficient: Heavy steel shield −2 to attacks',
    ),
  ).toBeVisible();
  expect(within(item('Buckler')).getByText('Not equipped')).toBeVisible();
  expect(
    within(item('Buckler')).queryByText(/Not proficient/),
  ).not.toBeInTheDocument();
  expect(within(equipment()).queryByRole('alert')).not.toBeInTheDocument();
  expect(
    within(equipment()).queryByRole('button', { name: 'Accept' }),
  ).not.toBeInTheDocument();

  fireEvent.click(button('Arcane spell failure 50%, breakdown'));
  const failure = within(equipment()).getByRole('group', {
    name: 'Arcane spell failure breakdown',
  });
  expect(within(failure).getByText('35%')).toBeVisible();
  expect(within(failure).getByText('15%')).toBeVisible();

  const defenses = within(screen.getByRole('region', { name: 'Defenses' }));
  fireEvent.click(
    defenses.getByRole('button', {
      name: 'Armor Class 23, breakdown',
    }),
  );
  const ac = defenses.getByRole('group', { name: 'Armor Class breakdown' });
  expect(within(ac).getByText('Dexterity (armor maximum +1)')).toBeVisible();
  // Base 10 + capped Dex 1 + effective plate (9 + 1) + shield 2 = 23.
  // Enhancement belongs to the armor bonus, never an additional applied row.
  const plateBonus = within(ac).getByText(
    'Full plate (9 + 1 enhancement: Full plate enhancement)',
  );
  expect(plateBonus).toBeVisible();
  const plateRow = within(plateBonus.closest('li')!);
  expect(plateRow.getByText('armor')).toBeVisible();
  expect(plateRow.getByText('+10')).toBeVisible();
  const shieldRow = within(
    within(ac).getByText('Heavy steel shield').closest('li')!,
  );
  expect(shieldRow.getByText('shield')).toBeVisible();
  expect(shieldRow.getByText('+2')).toBeVisible();
  expect(within(ac).getAllByRole('listitem')).toHaveLength(4);
  expect(
    within(ac).queryByText('Full plate enhancement'),
  ).not.toBeInTheDocument();
  expect(derivedStatistics.cmd.applied).toContainEqual(
    expect.objectContaining({ entryName: 'Dexterity', value: 4 }),
  );
  expect(breakdowns['skill.clm'].total).toBe(-7);
  expect(
    screen.getByRole('button', { name: 'Climb -7, breakdown' }),
  ).toBeVisible();
});

test('equip and unequip write the row identity with feedback on that row while other rows stay usable; a refusal is reported there and can be retried', async () => {
  const view = renderSheet(buildSheet(armored()));
  fireEvent.click(button('Unequip Full plate'));
  expect(lastCall()).toMatchObject({
    name: 'editEquipment',
    args: { entryId: 'plate', active: false },
  });
  expect(button('Unequip Full plate')).toBeDisabled();
  expect(within(item('Full plate')).getByText('Saving…')).toBeVisible();
  expect(button('Equip Buckler')).toBeEnabled();
  expect(
    within(item('Buckler')).queryByText('Saving…'),
  ).not.toBeInTheDocument();

  view.show(
    buildSheet(
      armored({
        sheetEntries: [{ ...fullPlate, active: false }, heavyShield, buckler],
        lastOperationId: String(lastCall().args.operationId),
      }),
    ),
  );
  await act(async () => lastCall().resolve(null));
  expect(within(item('Full plate')).getByText('Saved')).toBeVisible();
  expect(within(item('Full plate')).getByText('Not equipped')).toBeVisible();

  fireEvent.click(button('Equip Buckler'));
  await act(async () =>
    lastCall().reject(new ConvexError('Character is read only')),
  );
  expect(within(item('Buckler')).getByRole('alert')).toHaveTextContent(
    "Buckler wasn't saved: Character is read only. Try again.",
  );
  expect(
    within(item('Full plate')).queryByRole('alert'),
  ).not.toBeInTheDocument();
  fireEvent.click(button('Equip Buckler'));
  expect(calls).toHaveLength(3);
  expect(lastCall().args).toMatchObject({ entryId: 'buckler', active: true });
});

test('Edit opens the item’s panel with a group per part; enhancement, masterwork and material save at once for that part, an invalid enhancement stays local with its error, and the bash steps its own enhancement', async () => {
  renderEquipment(
    buildSheet(armored({ sheetEntries: [fullPlate, bashingShield] })),
  );
  const panel = openEditor('Heavy steel shield');
  expect(within(panel).getByRole('form')).toHaveAttribute('novalidate');
  const shield = section(panel, 'Shield');
  const bash = section(panel, 'Shield bash');
  expect(bash).toHaveTextContent(
    "Shield bash: its own enhancement and Item Abilities, apart from the shield's AC bonus.",
  );
  const enhancement = textbox(shield, 'Enhancement');
  expect(enhancement).toHaveValue('0');
  expect(
    within(shield).getByRole('button', { name: 'Decrease enhancement' }),
  ).toBeDisabled();

  await settle(() => typeInto(enhancement, '2'));
  expect(lastCall()).toMatchObject({
    name: 'editEquipment',
    args: { entryId: 'shield', end: 'primary', enhancement: 2 },
  });
  expect(lastCall().args).not.toHaveProperty('masterwork');
  expect(lastCall().args).not.toHaveProperty('material');
  await settle(() => lastCall().resolve(null));
  expect(within(shield).getByText('Saved')).toBeVisible();

  await settle(() =>
    fireEvent.click(
      within(shield).getByRole('checkbox', { name: 'Masterwork' }),
    ),
  );
  expect(lastCall().args).toMatchObject({
    entryId: 'shield',
    end: 'primary',
    masterwork: true,
  });
  await settle(() => lastCall().resolve(null));

  const material = within(shield).getByRole('combobox', { name: 'Material' });
  expect(material).toHaveValue('none');
  await settle(() => typeInto(material, 'mithral'));
  expect(lastCall().args).toMatchObject({
    entryId: 'shield',
    end: 'primary',
    material: 'mithral',
  });
  await settle(() => lastCall().resolve(null));

  await settle(() =>
    fireEvent.click(
      within(bash).getByRole('button', { name: 'Increase enhancement' }),
    ),
  );
  expect(lastCall().args).toMatchObject({
    entryId: 'shield',
    end: 'bash',
    enhancement: 1,
  });
  expect(textbox(bash, 'Enhancement')).toHaveValue('1');
  await settle(() => lastCall().resolve(null));
  expect(calls.every((call) => call.args.end !== undefined)).toBe(true);

  const written = calls.length;
  await settle(() => typeInto(enhancement, ''));
  expect(within(shield).getByRole('alert')).toHaveTextContent(
    'Enhancement is required',
  );
  expect(enhancement).toHaveAccessibleDescription('Enhancement is required');
  await settle(() => typeInto(enhancement, 'two'));
  expect(within(shield).getByRole('alert')).toHaveTextContent(
    'Enhancement must be a whole number of 0 or more',
  );
  expect(calls).toHaveLength(written);
});

test('Item Abilities: the picker suits the part, adding and removing save the whole list for that part, and bane’s foe saves trimmed with the blue outline until it is chosen', async () => {
  const plate: CatalogSheetEntry = {
    ...fullPlate,
    itemState: {
      enhancement: 1,
      abilities: [{ catalogEntryId: 'light-fortification' }],
    },
  };
  const shield: CatalogSheetEntry = {
    ...bashingShield,
    itemState: {
      enhancement: 1,
      bash: { enhancement: 1, abilities: [{ catalogEntryId: 'bane' }] },
    },
  };
  renderEquipment(
    buildSheet(
      armored({
        sheetEntries: [plate, shield],
        itemAbilities: [
          'flaming',
          'keen',
          'bane',
          'light-fortification',
          'shadow',
        ],
      }),
    ),
  );
  let panel = openEditor('Full plate');
  const armor = section(panel, 'Armor');
  // Enhancement +1 makes it masterwork; the toggle gives way to the fact.
  expect(armor).toHaveTextContent(
    'Masterwork (from its enhancement or material)',
  );
  expect(within(armor).queryByRole('checkbox')).toBeNull();
  const abilities = section(armor, 'Item Abilities');
  expect(abilities).toHaveTextContent('Light fortification');
  expect(within(abilities).getByText('+1')).toBeVisible();
  const add = within(abilities).getByRole('combobox', { name: 'Add ability' });
  expect(
    within(add)
      .getAllByRole('option')
      .map((option) => (option as HTMLOptionElement).value),
  ).toEqual(['', 'light-fortification', 'shadow']);
  await settle(() => typeInto(add, 'shadow'));
  expect(lastCall()).toMatchObject({
    name: 'editEquipment',
    args: {
      entryId: 'plate',
      end: 'primary',
      abilities: [
        { catalogEntryId: 'light-fortification' },
        { catalogEntryId: 'shadow' },
      ],
    },
  });
  expect(lastCall().args).not.toHaveProperty('enhancement');
  await settle(() => lastCall().resolve(null));
  expect(abilities).toHaveTextContent('Shadow');
  expect(within(abilities).getByText('Saved')).toBeVisible();
  await settle(() =>
    fireEvent.click(
      within(abilities).getByRole('button', {
        name: 'Remove Light fortification',
      }),
    ),
  );
  expect(lastCall().args).toMatchObject({
    entryId: 'plate',
    end: 'primary',
    abilities: [{ catalogEntryId: 'shadow' }],
  });
  await settle(() => lastCall().resolve(null));
  await closeEditor(panel);

  panel = openEditor('Heavy steel shield');
  const shieldAdd = within(section(panel, 'Shield')).getByRole('combobox', {
    name: 'Add ability',
  });
  expect(
    within(shieldAdd)
      .getAllByRole('option')
      .map((option) => (option as HTMLOptionElement).value),
  ).toEqual(['', 'light-fortification']);
  const bashAbilities = section(
    section(panel, 'Shield bash'),
    'Item Abilities, shield bash',
  );
  expect(
    within(bashAbilities)
      .getAllByRole('option')
      .map((option) => (option as HTMLOptionElement).value),
  ).toEqual(['', 'bane', 'flaming', 'keen']);
  const foe = textbox(bashAbilities, 'Foe');
  expect(foe).toHaveClass('ring-sky-400/80');
  expect(foe).toHaveAccessibleDescription(
    'Choose a foe; bane adds nothing until then.',
  );
  expect(
    within(panel).queryByRole('button', { name: /Accept/ }),
  ).not.toBeInTheDocument();
  typeInto(foe, '  undead ');
  await settle(() => fireEvent.blur(foe));
  expect(lastCall()).toMatchObject({
    name: 'editEquipment',
    args: {
      entryId: 'shield',
      end: 'bash',
      abilities: [{ catalogEntryId: 'bane', choice: 'undead' }],
    },
  });
  expect(foe).toHaveValue('undead');
  expect(foe).not.toHaveClass('ring-sky-400/80');
  // The bash's abilities never touch the shield's own part.
  expect(
    calls.some(
      (call) => call.args.entryId === 'shield' && call.args.end === 'primary',
    ),
  ).toBe(false);
});

test('construction warnings read under their own part with Accept, a specific item names its Base Item and states its own material, and adamantine notes its damage reduction', async () => {
  const shield: CatalogSheetEntry = {
    ...bashingShield,
    itemState: {
      enhancement: 6,
      bash: {
        abilities: [
          { catalogEntryId: 'flaming' },
          { catalogEntryId: 'flaming' },
        ],
      },
    },
  };
  const chainShirt: CatalogSheetEntry = {
    id: 'chain',
    name: 'Chain shirt',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      armor: {
        slot: 'armor',
        category: 'light',
        bonus: 4,
        maxDex: 4,
        armorCheckPenalty: 2,
        asf: 20,
      },
    },
  };
  const shirt: CatalogSheetEntry = {
    id: 'shirt',
    name: 'Mithral shirt',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      baseItem: 'chain-catalog' as Id<'catalogEntry'>,
      material: 'mithral',
      armor: {
        slot: 'armor',
        category: 'light',
        bonus: 4,
        maxDex: 6,
        armorCheckPenalty: 0,
        asf: 10,
      },
    },
  };
  const plate: CatalogSheetEntry = {
    ...fullPlate,
    itemState: { enhancement: 1, material: 'adamantine' },
  };
  renderEquipment(
    buildSheet(
      armored({
        sheetEntries: [plate, shield, shirt],
        catalogOnly: [chainShirt],
        itemAbilities: ['flaming'],
      }),
    ),
  );
  expect(
    within(item('Full plate')).getByText('Adamantine: damage reduction 3/—.'),
  ).toBeVisible();

  let panel = openEditor('Heavy steel shield');
  const shieldGroup = section(panel, 'Shield');
  const bash = section(panel, 'Shield bash');
  expect(shieldGroup).toHaveTextContent(
    'Heavy steel shield has +6 enhancement; the usual maximum is +5.',
  );
  expect(shieldGroup).not.toHaveTextContent('special abilities');
  expect(bash).not.toHaveTextContent('+6 enhancement');
  expect(bash).toHaveTextContent(
    'Heavy steel shield bash has special abilities without a +1 enhancement bonus.',
  );
  expect(bash).toHaveTextContent(
    'Heavy steel shield bash has the same Item Ability more than once: Flaming.',
  );
  expect(within(bash).getAllByRole('button', { name: 'Accept' })).toHaveLength(
    2,
  );
  fireEvent.click(within(shieldGroup).getByRole('button', { name: 'Accept' }));
  expect(lastCall()).toMatchObject({
    name: 'accept',
    args: { check: 'equipmentEnhancement', subject: 'shield' },
  });
  fireEvent.click(within(bash).getAllByRole('button', { name: 'Accept' })[1]!);
  expect(lastCall()).toMatchObject({
    name: 'accept',
    args: { check: 'itemDuplicateAbility', subject: 'shield:bash' },
  });
  await closeEditor(panel);

  panel = openEditor('Mithral shirt');
  expect(panel).toHaveTextContent('Based on Chain shirt');
  const armor = section(panel, 'Armor');
  expect(armor).toHaveTextContent('Mithral (included in its numbers)');
  expect(
    within(armor).queryByRole('combobox', { name: 'Material' }),
  ).toBeNull();
  expect(armor).toHaveTextContent(
    'Masterwork (from its enhancement or material)',
  );
});

test('an item that is not equipped edits its resolved parts, Item Abilities and warnings included', async () => {
  renderEquipment(
    buildSheet(
      armored({
        sheetEntries: [
          fullPlate,
          heavyShield,
          { ...buckler, itemState: { enhancement: 6 } },
        ],
        itemAbilities: ['light-fortification'],
      }),
    ),
  );
  const shield = section(openEditor('Buckler'), 'Shield');
  expect(shield).not.toHaveTextContent('Equip it');
  expect(textbox(shield, 'Enhancement')).toHaveValue('6');
  // Construction checks come from state, equipped or not (#236).
  expect(shield).toHaveTextContent(
    'Buckler has +6 enhancement; the usual maximum is +5.',
  );
  const add = within(shield).getByRole('combobox', { name: 'Add ability' });
  await settle(() =>
    fireEvent.change(add, { target: { value: 'light-fortification' } }),
  );
  expect(lastCall()).toMatchObject({
    name: 'editEquipment',
    args: {
      entryId: 'buckler',
      end: 'primary',
      abilities: [{ catalogEntryId: 'light-fortification' }],
    },
  });
});

test('a specific item built on its Base Item’s numbers states its own material as applied to them', () => {
  const dwarvenPlate: CatalogSheetEntry = {
    id: 'dwarven',
    name: 'Dwarven plate',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      baseItem: 'plate-catalog' as Id<'catalogEntry'>,
      material: 'adamantine',
    },
  };
  renderEquipment(
    buildSheet(armored({ sheetEntries: [fullPlate, dwarvenPlate] })),
  );
  const armor = section(openEditor('Dwarven plate'), 'Armor');
  expect(armor).toHaveTextContent('Adamantine (applied to its numbers)');
  expect(armor).not.toHaveTextContent('included in its numbers');
});

test('a refused save keeps the draft with Try again, and another player’s change refreshes only untouched fields', async () => {
  const mithral: CatalogSheetEntry = {
    ...fullPlate,
    itemState: { enhancement: 1, material: 'mithral' },
  };
  const view = renderEquipment(
    buildSheet(armored({ sheetEntries: [mithral, heavyShield] })),
  );
  const panel = openEditor('Full plate');
  const armor = section(panel, 'Armor');
  const material = within(armor).getByRole('combobox', { name: 'Material' });
  expect(material).toHaveValue('mithral');
  await settle(() => typeInto(material, 'none'));
  expect(lastCall().args).toMatchObject({
    entryId: 'plate',
    end: 'primary',
    material: null,
  });
  await settle(() =>
    lastCall().reject(new ConvexError('Character is read only')),
  );
  expect(within(armor).getByRole('alert')).toHaveTextContent(
    "Changes weren't saved: Character is read only. Your edits are kept. Try again.",
  );
  expect(material).toHaveValue('none');

  view.show(
    buildSheet(
      armored({
        sheetEntries: [
          { ...mithral, itemState: { enhancement: 3, material: 'mithral' } },
          heavyShield,
        ],
        lastOperationId: 'another-player',
      }),
    ),
  );
  expect(textbox(armor, 'Enhancement')).toHaveValue('3');
  expect(material).toHaveValue('none');
  expect(
    within(armor).getByText('Changed by another player. Your edits are kept.'),
  ).toBeVisible();

  const written = calls.length;
  await settle(() =>
    fireEvent.click(
      within(armor).getByRole('button', {
        name: 'Try again saving material for Armor',
      }),
    ),
  );
  expect(calls).toHaveLength(written + 1);
  expect(lastCall().args).toMatchObject({ entryId: 'plate', material: null });
  expect(lastCall().args).not.toHaveProperty('enhancement');
});

test('Other… keeps a material the sheet does not apply as the words entered', async () => {
  renderEquipment(buildSheet(armored({ sheetEntries: [fullPlate] })));
  const armor = section(openEditor('Full plate'), 'Armor');
  const material = within(armor).getByRole('combobox', { name: 'Material' });
  typeInto(material, 'other');
  expect(calls).toHaveLength(0);
  await settle(() => typeInto(textbox(armor, 'Material, other'), 'bone'));
  expect(lastCall().args).toMatchObject({ entryId: 'plate', material: 'bone' });
});

test('a granted shield with no stored entry is equipped and edited through its row', async () => {
  const base = buildSheet(armored({ sheetEntries: [heavyShield] }));
  const catalog = base.catalogEntries.find(
    (entry) => entry.name === 'Heavy steel shield',
  );
  if (!catalog) throw new Error('Missing shield definition');
  const grantKey = { source: 'fighter', classLevel: 1, entry: 'shield' };
  const granted: CharacterSheetSnapshot = {
    ...base,
    entries: base.entries.filter((entry) => entry._id !== 'shield'),
    calculated: {
      ...base.calculated,
      resolvedEntries: [
        ...base.calculated.resolvedEntries.filter(
          (resolved) => resolved.entry._id !== 'shield',
        ),
        {
          entry: {
            _id: 'granted-shield',
            kind: 'item',
            active: false,
            catalogEntryId: catalog._id,
            grantKey,
            state: { kind: 'item' },
          },
          origin: 'grant',
          recorded: false,
          dormant: false,
          counting: true,
        },
      ],
      itemParts: [
        {
          entryId: 'granted-shield',
          name: 'Heavy steel shield',
          active: false,
          baseItemId: null,
          bakedMaterial: null,
          parts: [
            {
              part: 'primary',
              kind: 'shield',
              enhancement: 0,
              recordedMasterwork: false,
              masterwork: false,
              material: null,
              bonusEquivalent: 0,
              abilities: [],
            },
          ],
        },
      ],
    },
  };
  renderEquipment(granted);
  fireEvent.click(button('Equip Heavy steel shield'));
  expect(lastCall().args).toMatchObject({ grantKey, active: true });
  expect(lastCall().args).not.toHaveProperty('entryId');
  const shield = section(openEditor('Heavy steel shield'), 'Shield');
  await settle(() => typeInto(textbox(shield, 'Enhancement'), '1'));
  expect(lastCall().args).toMatchObject({
    grantKey,
    enhancement: 1,
    end: 'primary',
  });
  expect(lastCall().args).not.toHaveProperty('entryId');
});

test('the panel is a bottom sheet below 768px and returns focus to Edit when closed', async () => {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  try {
    renderEquipment(buildSheet(armored()));
    const edit = button('Edit Full plate');
    edit.focus();
    const panel = openEditor('Full plate');
    expect(panel).toHaveClass('bottom-0', 'max-h-[85vh]');
    expect(within(panel).getByRole('form')).toHaveClass(
      'min-h-0',
      'overflow-y-auto',
    );
    fireEvent.keyDown(document.activeElement ?? panel, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(edit).toHaveFocus());
    expect(calls).toHaveLength(0);
  } finally {
    window.matchMedia = original;
  }
});

test('without armor the block says so, with no penalty and no Dexterity limit', () => {
  renderSheet(buildSheet({ levels: [{ id: 'level-1', hp: 10 }] }));
  expect(within(equipment()).getByText('No armor or shields.')).toBeVisible();
  expect(within(equipment()).getByText('No limit')).toBeVisible();
  expect(button('Armor check penalty 0, breakdown')).toBeVisible();
});

test('maintenance disables Equip with the reason stated once in the block and writes nothing', () => {
  const message = 'Editing is paused for maintenance.';
  maintenance.mockReturnValue({ kind: 'maintenance', readOnly: true, message });
  renderSheet(buildSheet(armored()));
  expect(button('Unequip Full plate')).toBeDisabled();
  expect(button('Unequip Full plate')).toHaveAccessibleDescription(message);
  expect(within(equipment()).getAllByText(message)).toHaveLength(1);
  fireEvent.click(button('Unequip Full plate'));
  expect(calls).toEqual([]);
});

test('no Equipment controls render before the sheet arrives', () => {
  renderSheet(undefined);
  expect(screen.queryByRole('region', { name: 'Equipment' })).toBeNull();
});

// Spell Effects on items (#416): the Gear row names each active effect
// targeting the item; the chip goes to the effect's row.
test('an armor row shows a chip per active Spell Effect targeting it, and tapping the chip focuses the effect’s row', () => {
  const vestment: CatalogSheetEntry = {
    id: 'vestment',
    name: 'Magic vestment',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 5,
      itemTarget: 'armorOrShield',
    },
    modifiers: [
      {
        target: 'ac',
        bonusType: 'enhancement',
        value: 1,
        condition: { weapon: '$target' },
      },
    ],
    casterLevel: 5,
    onItem: { entry: 'plate' },
  };
  const inactive: CatalogSheetEntry = {
    ...vestment,
    id: 'vestment-off',
    active: false,
    onItem: { entry: 'shield' },
  };
  snapshot = buildSheet(
    armored({ sheetEntries: [fullPlate, heavyShield, vestment, inactive] }),
  );
  render(<CharacterSheetBlocks blocks={['equipment', 'entries']} />);
  const chip = within(item('Full plate')).getByRole('button', {
    name: /Magic vestment · CL 5/,
  });
  expect(chip).toHaveClass('min-h-11');
  expect(
    within(item('Heavy steel shield')).queryByRole('list', {
      name: 'Spell Effects on this item',
    }),
  ).not.toBeInTheDocument();
  fireEvent.click(chip);
  expect(
    screen.getByRole('switch', { name: 'Magic vestment: active' }),
  ).toHaveFocus();
});
