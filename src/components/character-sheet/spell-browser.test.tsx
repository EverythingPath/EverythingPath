import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type * as NavigationGuard from '~/components/campaign-shell/navigation-guard';
import { CharacterSpellsPage } from './character-spells-page';
import { characterId } from './character-sheet-test-fixture';
import {
  buildSpellSheet,
  resetSpellsTransport,
  sheetOrigin,
  spells,
  spellsTransport,
} from './character-spells-test-fixture';

// The Spells page's class-list browser (#315): one spell level at a time,
// a search across every level, a school filter, other lists for a
// recorder, and paging that never claims a total it has not loaded.

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

beforeEach(() => resetSpellsTransport('from=%2Fcharacters&add=1'));

function renderBrowser(snapshot = buildSpellSheet({ classes: ['wizard'] })) {
  spellsTransport.snapshot = snapshot;
  const page = () => (
    <CharacterSpellsPage characterId={characterId} origin={sheetOrigin} />
  );
  const view = render(page());
  return { rerender: () => view.rerender(page()) };
}
const browser = () =>
  within(screen.getByRole('region', { name: /^Add to the/ }));
const levelTab = (name: string) =>
  within(screen.getByRole('tablist', { name: 'Spell level' })).getByRole(
    'tab',
    { name },
  );
const search = () =>
  screen.getByRole('searchbox', { name: 'Search the wizard list' });
const recordCheck = (name: string) =>
  screen.queryByRole('checkbox', { name: `Record ${name}` });

test('level tabs show one level; a search reaches every level and a level tab ends it; the school filter sends its raw key and labels both codes and names', () => {
  renderBrowser();
  expect(levelTab('1st')).toHaveAttribute('aria-selected', 'true');
  expect(recordCheck('Shield')).toBeInTheDocument();
  expect(recordCheck('Magic missile')).toBeInTheDocument();
  expect(recordCheck('Fireball')).toBeNull();
  expect(browser().getByText('2 on the wizard list')).toBeVisible();

  fireEvent.change(search(), { target: { value: 'fire' } });
  expect(spellsTransport.params.get('q')).toBe('fire');
  expect(recordCheck('Fireball')).toBeInTheDocument();
  expect(recordCheck('Shield')).toBeNull();
  expect(browser().getByText('1 match for “fire”')).toBeVisible();
  expect(levelTab('1st')).toHaveAttribute('aria-selected', 'false');

  fireEvent.click(browser().getByRole('button', { name: 'Clear search' }));
  expect(spellsTransport.params.get('q')).toBeNull();
  expect(recordCheck('Shield')).toBeInTheDocument();

  fireEvent.change(search(), { target: { value: 'shield' } });
  fireEvent.mouseDown(levelTab('3rd'));
  expect(spellsTransport.params.get('q')).toBeNull();
  expect(spellsTransport.params.get('level')).toBe('3');
  expect(search()).toHaveValue('');
  expect(levelTab('3rd')).toHaveAttribute('aria-selected', 'true');
  expect(recordCheck('Fireball')).toBeEnabled();
  expect(levelTab('3rd')).toHaveAttribute(
    'title',
    'Wizard casts up to 1st level now',
  );

  fireEvent.mouseDown(levelTab('1st'));
  const school = browser().getByRole('combobox', { name: 'School' });
  expect(
    within(school)
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual([
    'All schools',
    'Abjuration',
    'Divination',
    'Evocation',
    'Evocation',
  ]);
  fireEvent.change(school, { target: { value: 'abj' } });
  expect(spellsTransport.params.get('school')).toBe('abj');
  expect(recordCheck('Shield')).toBeInTheDocument();
  expect(recordCheck('Magic missile')).toBeNull();
  fireEvent.change(school, { target: { value: 'none' } });
  expect(spellsTransport.params.get('school')).toBeNull();
  expect(spellsTransport.params.get('from')).toBe('/characters');
});

test('Include other lists reveals off-list Spells marked as such, whose check asks for an explicit level before anything is recorded', () => {
  renderBrowser();
  const other = browser().getByRole('button', { name: 'Include other lists' });
  expect(other).toHaveAttribute('aria-pressed', 'false');
  expect(recordCheck('Bless')).toBeNull();
  fireEvent.click(other);
  expect(spellsTransport.params.get('other')).toBe('1');
  expect(other).toHaveAttribute('aria-pressed', 'true');
  expect(browser().getByText('4 on any list')).toBeVisible();
  const bless = recordCheck('Bless');
  if (!bless) throw new Error('Expected Bless');
  const row = within(bless.closest('li') as HTMLElement);
  expect(row.getByText('off-list')).toBeVisible();
  fireEvent.click(bless);
  expect(row.getByRole('textbox', { name: 'Level of Bless' })).toHaveFocus();
  expect(spellsTransport.writes).toEqual([]);
});

test('loading, paging, exhausted and empty results keep the filters usable and never claim a total while more remain', () => {
  spellsTransport.browserInfoLoaded = false;
  const { rerender } = renderBrowser();
  expect(browser().getByText('Loading Spells…')).toBeVisible();
  expect(search()).toBeEnabled();

  spellsTransport.browserInfoLoaded = true;
  spellsTransport.browserStatus = 'CanLoadMore';
  rerender();
  expect(browser().getByText('2 loaded')).toBeVisible();
  fireEvent.click(browser().getByRole('button', { name: 'Load more' }));
  expect(spellsTransport.loadMore).toHaveBeenCalledWith(25);

  spellsTransport.browserStatus = 'LoadingMore';
  rerender();
  expect(recordCheck('Shield')).toBeInTheDocument();
  expect(browser().getByText('Loading more Spells…')).toBeVisible();
  expect(browser().queryByRole('button', { name: 'Load more' })).toBeNull();

  spellsTransport.browserStatus = 'Exhausted';
  rerender();
  expect(browser().getByText('2 on the wizard list')).toBeVisible();
  expect(browser().queryByRole('button', { name: 'Load more' })).toBeNull();

  fireEvent.change(search(), { target: { value: 'nothing like it' } });
  expect(browser().getByText('No Spells match these filters.')).toBeVisible();
  expect(levelTab('1st')).toBeEnabled();
  expect(search()).toHaveValue('nothing like it');
});

test('Spellcasting tabs keep each collection and its browser apart, and both tab lists move by arrow key and select with Enter', async () => {
  renderBrowser(
    buildSpellSheet({
      classes: ['wizard', 'sorcerer'],
      recorded: [
        { id: 'row-shield', spell: spells.shield, castingClassId: 'wizard' },
      ],
    }),
  );
  expect(recordCheck('Shield')).toBeChecked();
  const casting = within(screen.getByRole('tablist', { name: 'Spellcasting' }));
  const wizard = casting.getByRole('tab', { name: 'Wizard spellbook · 1' });
  wizard.focus();
  fireEvent.keyDown(wizard, { key: 'ArrowRight' });
  const sorcerer = casting.getByRole('tab', {
    name: 'Sorcerer spells known · 0',
  });
  await waitFor(() => expect(sorcerer).toHaveFocus());
  fireEvent.keyDown(sorcerer, { key: 'Enter' });
  expect(spellsTransport.params.get('spellcasting')).toBe('sorcerer');
  expect(spellsTransport.params.get('add')).toBeNull();
  expect(
    screen.getByRole('region', { name: 'Spells known' }),
  ).toHaveTextContent('Nothing in the spells known yet.');

  fireEvent.click(screen.getByRole('button', { name: 'Add Spells' }));
  expect(recordCheck('Shield')).not.toBeChecked();
  const first = levelTab('1st');
  first.focus();
  fireEvent.keyDown(first, { key: 'ArrowLeft' });
  await waitFor(() => expect(levelTab('0')).toHaveFocus());
  fireEvent.keyDown(levelTab('0'), { key: 'Enter' });
  expect(spellsTransport.params.get('level')).toBe('0');
  expect(recordCheck('Detect magic')).toBeInTheDocument();
});
