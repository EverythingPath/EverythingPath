import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type * as NavigationGuard from '~/components/campaign-shell/navigation-guard';
import CharacterSpellsRoute from '~/app/characters/[characterId]/spells/page';
import { characterSheetPath } from '~/lib/campaign-routes';
import { buildCastingSheet } from './casting-features-test-fixture';
import { CharacterSpellsPage } from './character-spells-page';
import { characterId } from './character-sheet-test-fixture';
import {
  buildSpellSheet,
  lastWrite,
  resetSpellsTransport,
  sheetOrigin,
  spells,
  spellsTransport,
} from './character-spells-test-fixture';

// The Spells page (#315): one Character's Spellcastings as tabs, each opening
// on its own record (or a whole-list caster's read-only list), with Spells
// under no Spellcasting kept in their own group.

vi.mock('convex/react', async () =>
  (await import('./character-spells-test-fixture')).createSpellsConvexMock(),
);
vi.mock('next/navigation', async () =>
  (
    await import('./character-spells-test-fixture')
  ).createSpellsNavigationMock(),
);
vi.mock('~/components/ui/select', async () =>
  (await import('./character-spells-test-fixture')).createSelectMock(),
);
vi.mock('~/components/use-initial-migration-maintenance', async () => {
  const { spellsTransport } = await import('./character-spells-test-fixture');
  return { useInitialMigrationMaintenance: () => spellsTransport.maintenance };
});
vi.mock(
  '~/components/campaign-shell/navigation-guard',
  async (importOriginal) => ({
    ...(await importOriginal<typeof NavigationGuard>()),
    GuardedLink: (await import('./character-spells-test-fixture'))
      .GuardedLinkMock,
  }),
);
vi.mock('./use-character-sheet-navigation', () => ({
  useCharacterSheetNavigation: () => ({
    back: { href: '/campaigns/campaign-1/characters', label: 'Characters' },
    origin: {
      href: '/campaigns/campaign-1/characters',
      organization: { kind: 'organization', id: 'org' },
    },
    campaign: null,
    organizationSwitch: { kind: 'idle', retry: vi.fn() },
  }),
}));

beforeEach(() => resetSpellsTransport());

function renderPage(snapshot = spellsTransport.snapshot) {
  spellsTransport.snapshot = snapshot;
  const page = () => (
    <CharacterSpellsPage characterId={characterId} origin={sheetOrigin} />
  );
  const view = render(page());
  return {
    show: (next: typeof snapshot) => {
      spellsTransport.snapshot = next;
      view.rerender(page());
    },
  };
}
const region = (name: string) => screen.getByRole('region', { name });
const level = (name: string) =>
  within(screen.getByRole('heading', { name: new RegExp(`^${name}`) }));
const currentUrl = () => spellsTransport.params;

test('a wizard opens on the Spellbook by level; Add Spells and Done swap the class list in and out while the sheet origin and collection stay', () => {
  renderPage(
    buildSpellSheet({
      classes: ['wizard'],
      recorded: [
        { id: 'row-shield', spell: spells.shield, castingClassId: 'wizard' },
        {
          id: 'row-detect',
          spell: spells.detectMagic,
          castingClassId: 'wizard',
        },
      ],
    }),
  );
  expect(
    screen.getByRole('heading', { level: 1, name: 'Spells' }),
  ).toBeVisible();
  expect(screen.getByRole('link', { name: 'Sheet' })).toHaveAttribute(
    'href',
    characterSheetPath(characterId, sheetOrigin),
  );
  expect(screen.getAllByRole('link')).toHaveLength(1);
  const book = within(region('Spellbook'));
  expect(level('0-level').getByText('1')).toBeVisible();
  expect(level('1st-level').getByText('1')).toBeVisible();
  expect(book.getByRole('checkbox', { name: 'Record Shield' })).toBeChecked();
  expect(region('Wizard · Spellbook')).toHaveTextContent('2 in spellbook');
  expect(screen.queryByRole('tablist', { name: 'Spellcasting' })).toBeNull();

  fireEvent.click(book.getByRole('button', { name: 'Add Spells' }));
  expect(currentUrl().get('add')).toBe('1');
  expect(currentUrl().get('from')).toBe('/characters');
  const adding = within(region('Add to the spellbook'));
  expect(adding.getByRole('tablist', { name: 'Spell level' })).toBeVisible();
  expect(adding.getByRole('checkbox', { name: 'Record Shield' })).toBeChecked();
  expect(
    adding.getByRole('checkbox', { name: 'Record Magic missile' }),
  ).not.toBeChecked();

  fireEvent.click(adding.getByRole('button', { name: 'Done' }));
  expect(currentUrl().get('add')).toBeNull();
  expect(currentUrl().get('from')).toBe('/characters');
  expect(
    within(region('Spellbook')).getAllByRole('checkbox', { checked: true }),
  ).toHaveLength(2);
});

test('an empty record invites Add Spells; known, formula and familiar collections carry their own headings and the sorcerer counts against its allowance', () => {
  renderPage(
    buildSpellSheet({
      classes: ['sorcerer', 'alchemist', 'witch'],
      recorded: [
        {
          id: 'row-missile',
          spell: spells.magicMissile,
          castingClassId: 'sorcerer',
        },
      ],
    }),
  );
  const tabs = within(screen.getByRole('tablist', { name: 'Spellcasting' }));
  expect(
    tabs.getByRole('tab', { name: 'Sorcerer spells known · 1' }),
  ).toHaveAttribute('aria-selected', 'true');
  expect(level('1st-level').getByText('1/2 known')).toBeVisible();

  fireEvent.mouseDown(
    tabs.getByRole('tab', { name: 'Alchemist formula book · 0' }),
  );
  expect(currentUrl().get('spellcasting')).toBe('alchemist');
  const formulas = within(region('Formula book'));
  expect(formulas.getByText('Nothing in the formula book yet.')).toBeVisible();
  expect(formulas.getAllByRole('button', { name: 'Add Spells' })).toHaveLength(
    1,
  );
  expect(formulas.queryByRole('checkbox')).toBeNull();

  fireEvent.mouseDown(tabs.getByRole('tab', { name: 'Witch familiar · 0' }));
  expect(region('Familiar')).toHaveTextContent('Nothing in the familiar yet.');
});

// #326: a witch's Familiar collection stays on the witch whatever happens to
// the familiar, so its page never changes or links to a familiar sheet.
test('the witch’s Familiar keeps the same Spells, heading and count through familiar replacement and restoration, with no familiar sheet link', () => {
  const witch = (lastOperationId: string) =>
    buildSpellSheet({
      classes: ['witch'],
      lastOperationId,
      recorded: [
        {
          id: 'row-detect',
          spell: spells.detectMagic,
          castingClassId: 'witch',
        },
        {
          id: 'row-cure',
          spell: spells.cureLightWounds,
          castingClassId: 'witch',
        },
      ],
    });
  const view = renderPage(witch('seed'));
  const note =
    'Witch Spells stay with the witch through familiar replacement and restoration.';
  const recorded = () =>
    within(region('Familiar'))
      .getAllByRole('checkbox', { checked: true })
      .map((box) => box.getAttribute('aria-label'));
  expect(within(region('Familiar')).getByText(note)).toBeVisible();
  expect(region('Witch · Familiar')).toHaveTextContent('2 in familiar');
  const before = recorded();
  expect(before).toEqual(['Record Detect magic', 'Record Cure light wounds']);

  for (const operation of ['replaced', 'restored']) {
    view.show(witch(operation));
    expect(screen.getAllByRole('region', { name: 'Familiar' })).toHaveLength(1);
    expect(recorded()).toEqual(before);
    expect(region('Witch · Familiar')).toHaveTextContent('2 in familiar');
    expect(screen.getAllByText(note)).toHaveLength(1);
    expect(
      screen.getAllByRole('link').map((link) => link.textContent?.trim()),
    ).toEqual(['Sheet']);
  }
  expect(spellsTransport.writes).toEqual([]);
});

test('a whole-list cleric browses its list read-only from the first visit, with no record checks, Add Spells or other lists', () => {
  renderPage(buildSpellSheet({ classes: ['cleric'] }));
  const list = within(region('The cleric list'));
  expect(list.getByRole('tab', { name: '1st' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(list.getByRole('button', { name: 'Bless' })).toBeVisible();
  expect(list.queryByRole('checkbox')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Add Spells' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'Include other lists' }),
  ).toBeNull();
  expect(region('Cleric · whole list')).toBeVisible();
});

test('Spells whose Spellcasting is gone stay under "Not under any Spellcasting" with their class, warning and Remove, even with no Spellcasting left', async () => {
  const missile = {
    id: 'row-missile',
    spell: spells.magicMissile,
    castingClassId: 'wizard',
  };
  const { show } = renderPage(
    buildSpellSheet({
      classes: ['fighter'],
      recorded: [
        { id: 'row-shield', spell: spells.shield, castingClassId: 'wizard' },
        missile,
      ],
    }),
  );
  const orphans = within(region('Not under any Spellcasting'));
  expect(orphans.getAllByText('recorded for Wizard')).toHaveLength(2);
  expect(
    orphans.getByText('Shield is not under any Spellcasting.'),
  ).toBeVisible();
  expect(orphans.getAllByRole('button', { name: 'Accept' })).toHaveLength(2);
  expect(screen.queryByText('Kesh has no Spellcasting.')).toBeNull();

  const remove = orphans.getByRole('button', { name: 'Remove Shield' });
  remove.focus();
  fireEvent.click(remove);
  expect(lastWrite('removeRecordedSpell').args).toMatchObject({
    entryId: 'row-shield',
  });
  expect(remove).toBeDisabled();
  expect(
    orphans.getByRole('button', { name: 'Remove Magic missile' }),
  ).toBeEnabled();
  await act(async () => lastWrite('removeRecordedSpell').resolve(null));
  show(buildSpellSheet({ classes: ['fighter'], recorded: [missile] }));
  expect(
    within(region('Not under any Spellcasting')).getByRole('button', {
      name: 'Remove Magic missile',
    }),
  ).toHaveFocus();
});

test('a Character with neither Spellcasting nor retained Spells says so; loading and unavailable reads use the sheet boundaries', () => {
  const { show } = renderPage(undefined);
  expect(
    screen.getByRole('status', { name: 'Loading character sheet…' }),
  ).toBeVisible();
  show(null);
  expect(
    screen.getByText("This character's sheet is not available here yet."),
  ).toBeVisible();
  show(buildSpellSheet({ classes: ['fighter'] }));
  expect(screen.getByText('Kesh has no Spellcasting.')).toBeVisible();
  expect(
    screen.queryByRole('region', { name: 'Not under any Spellcasting' }),
  ).toBeNull();
});

test('another player’s recorded Spell updates the rows and counts and is announced until dismissed', () => {
  const recorded = [
    { id: 'row-shield', spell: spells.shield, castingClassId: 'wizard' },
  ];
  const { show } = renderPage(
    buildSpellSheet({ classes: ['wizard'], recorded }),
  );
  expect(level('1st-level').getByText('1')).toBeVisible();
  show(
    buildSpellSheet({
      classes: ['wizard'],
      lastOperationId: 'another-player',
      recorded: [
        ...recorded,
        {
          id: 'row-missile',
          spell: spells.magicMissile,
          castingClassId: 'wizard',
        },
      ],
    }),
  );
  expect(level('1st-level').getByText('2')).toBeVisible();
  expect(
    screen.getByRole('checkbox', { name: 'Record Magic missile' }),
  ).toBeChecked();
  expect(
    screen.getByText('Spells changed. Review the collection.'),
  ).toBeVisible();
  fireEvent.click(
    screen.getByRole('button', { name: 'Dismiss Spells update' }),
  );
  expect(
    screen.queryByText('Spells changed. Review the collection.'),
  ).toBeNull();
});

test('the route opens the Spells page from the address with the sheet’s origin as its one way back', () => {
  spellsTransport.snapshot = buildSpellSheet({ classes: ['wizard'] });
  render(<CharacterSpellsRoute />);
  expect(screen.getByRole('link', { name: 'Sheet' })).toHaveAttribute(
    'href',
    characterSheetPath(characterId, sheetOrigin),
  );
  expect(region('Spellbook')).toBeVisible();
});

// #415: a whole-list cleric keeps its read-only list and gains the advanced
// casting sum, the domain slot and its Granted Spells, the latter after the
// list. Its Domains are picked on the class feature row, not here.
test('a cleric advanced by Mystic Theurge shows its casting sum, domain slot and Granted Spells around its read-only list, with no Domains picker', () => {
  const repeat = (identity: string, count: number) =>
    Array.from({ length: count }, () => identity);
  renderPage(
    buildCastingSheet({
      levels: [
        ...repeat('wizard', 3),
        ...repeat('cleric', 3),
        ...repeat('mystic-theurge', 2),
      ],
      selections: [
        {
          id: 'fire',
          catalogEntryId: 'domain-fire',
          classIdentity: 'cleric',
          feature: 'cleric-domains',
          list: 'Domains',
        },
      ],
    }),
  );
  fireEvent.mouseDown(screen.getByRole('tab', { name: /^Cleric/ }));
  expect(screen.queryByRole('region', { name: 'Domains' })).toBeNull();
  expect(screen.queryByRole('checkbox', { name: /Domain/ })).toBeNull();
  const numbers = region('Cleric · whole list');
  expect(numbers).toHaveTextContent('3 granted');
  expect(numbers).toHaveTextContent(
    'casting level 5 = Cleric 3 +2 from Mystic Theurge',
  );
  expect(numbers).toHaveTextContent('+1 domain');
  expect(region('The cleric list')).toBeVisible();
  const granted = region('Granted Spells');
  expect(
    within(granted).getByRole('button', { name: 'Burning Hands' }),
  ).toBeVisible();
  expect(
    within(granted).getByRole('button', { name: 'Fireball' }),
  ).toBeVisible();
  expect(within(granted).queryByRole('checkbox')).toBeNull();
  expect(
    region('The cleric list').compareDocumentPosition(granted) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    within(
      within(granted)
        .getByRole('button', { name: 'Burning Hands' })
        .closest('li')!,
    ).getByText('granted · Fire Domain'),
  ).toBeVisible();
});
