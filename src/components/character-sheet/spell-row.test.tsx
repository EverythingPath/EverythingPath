import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import type * as NavigationGuard from '~/components/campaign-shell/navigation-guard';
import { buildCastingSheet } from './casting-features-test-fixture';
import { CharacterSpellsPage } from './character-spells-page';
import {
  characterId,
  findCalculatedWarning,
  type Accepted,
} from './character-sheet-test-fixture';
import {
  buildSpellSheet,
  lastWrite,
  resetSpellsTransport,
  sheetOrigin,
  spells,
  spellsTransport,
  type Recorded,
} from './character-spells-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// One Spell row (#315): the record check, the explicit level of an off-list
// Spell, its own save feedback and warnings, and its phone description.

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

function renderPage(snapshot: CharacterSheetSnapshot) {
  spellsTransport.snapshot = snapshot;
  const page = () => (
    <CharacterSpellsPage characterId={characterId} origin={sheetOrigin} />
  );
  const view = render(page());
  return {
    show: (next: CharacterSheetSnapshot) => {
      spellsTransport.snapshot = next;
      view.rerender(page());
    },
  };
}
const check = (name: string) =>
  screen.getByRole('checkbox', { name: `Record ${name}` });
const rowOf = (name: string) => {
  const row = check(name).closest('li');
  if (!row) throw new Error(`Expected a ${name} row`);
  return within(row);
};
const levelField = (name: string) =>
  rowOf(name).getByRole('textbox', { name: `Level of ${name}` });
const saveLevel = (name: string) =>
  fireEvent.click(
    rowOf(name).getByRole('button', { name: `Save level of ${name}` }),
  );
const recordWrites = () =>
  spellsTransport.writes.filter((write) => write.name === 'recordSpell');
const wizard = (recorded: Recorded[] = [], options = {}) =>
  buildSpellSheet({ classes: ['wizard'], recorded, ...options });

test('checking an on-list Spell records it at once; only its own row waits, and a refusal stays on that row for a retry', async () => {
  const { show } = renderPage(wizard());
  fireEvent.click(check('Shield'));
  expect(lastWrite('recordSpell').args).toEqual({
    characterId,
    castingClassId: 'wizard',
    catalogEntryId: 'shield',
    operationId: expect.any(String),
  });
  expect(check('Shield')).toBeDisabled();
  expect(check('Magic missile')).toBeEnabled();

  fireEvent.click(check('Magic missile'));
  await act(async () =>
    lastWrite('recordSpell').reject(new ConvexError('Character is read only')),
  );
  expect(rowOf('Magic missile').getByRole('alert')).toHaveTextContent(
    "Magic missile wasn't saved",
  );
  expect(rowOf('Shield').queryByRole('alert')).toBeNull();
  expect(check('Magic missile')).not.toBeChecked();
  expect(check('Magic missile')).toBeEnabled();
  fireEvent.click(check('Magic missile'));
  expect(recordWrites()).toHaveLength(3);

  await act(async () => recordWrites()[0]?.resolve('row-shield'));
  show(
    wizard([
      { id: 'row-shield', spell: spells.shield, castingClassId: 'wizard' },
    ]),
  );
  expect(check('Shield')).toBeChecked();
  fireEvent.click(check('Shield'));
  expect(lastWrite('removeRecordedSpell').args).toMatchObject({
    entryId: 'row-shield',
  });
});

test('an off-list Spell records only with a valid explicit level: empty and malformed levels say different things and save nothing; a high level saves and earns its warnings', async () => {
  spellsTransport.params.set('other', '1');
  const { show } = renderPage(wizard());
  fireEvent.click(check('Bless'));
  expect(check('Bless')).toBeChecked();
  saveLevel('Bless');
  expect(await rowOf('Bless').findByRole('alert')).toHaveTextContent(
    'Spell level is required',
  );
  expect(levelField('Bless')).toHaveAttribute('aria-invalid', 'true');
  expect(levelField('Bless')).toHaveAccessibleDescription(
    'Spell level is required',
  );
  for (const malformed of ['1.5', '-1', 'two', '99999999999999999999']) {
    fireEvent.change(levelField('Bless'), { target: { value: malformed } });
    saveLevel('Bless');
    expect(await rowOf('Bless').findByRole('alert')).toHaveTextContent(
      'Spell level must be a whole number of 0 or more',
    );
  }
  expect(spellsTransport.writes).toEqual([]);

  fireEvent.change(levelField('Bless'), { target: { value: '7' } });
  saveLevel('Bless');
  await act(async () => undefined);
  expect(lastWrite('recordSpell').args).toMatchObject({
    castingClassId: 'wizard',
    catalogEntryId: 'bless',
    level: 7,
  });
  await act(async () =>
    lastWrite('recordSpell').reject(new ConvexError('Character is read only')),
  );
  expect(rowOf('Bless').getByRole('alert')).toHaveTextContent(
    "Bless wasn't saved",
  );
  expect(levelField('Bless')).toHaveValue('7');
  expect(levelField('Bless')).toHaveFocus();
  expect(check('Bless')).toBeChecked();

  saveLevel('Bless');
  await act(async () => undefined);
  await act(async () => lastWrite('recordSpell').resolve('row-bless'));
  show(
    wizard([
      {
        id: 'row-bless',
        spell: spells.bless,
        castingClassId: 'wizard',
        level: 7,
      },
    ]),
  );
  fireEvent.mouseDown(screen.getByRole('tab', { name: '7th' }));
  const bless = rowOf('Bless');
  expect(bless.getByText('off-list')).toBeVisible();
  expect(bless.getByText('too high')).toHaveAttribute(
    'title',
    'Wizard casts up to 1st level now',
  );
  expect(
    bless.getByText('Bless is not on the Wizard spell list.'),
  ).toBeVisible();
  expect(
    bless.getByText('Wizard cannot cast level 7 spells yet.'),
  ).toBeVisible();
});

test('unchecking an unsaved off-list draft closes its level field without a write', () => {
  spellsTransport.params.set('other', '1');
  renderPage(wizard());
  fireEvent.click(check('Bless'));
  expect(levelField('Bless')).toBeVisible();
  fireEvent.click(check('Bless'));
  expect(rowOf('Bless').queryByRole('textbox')).toBeNull();
  expect(check('Bless')).not.toBeChecked();
  expect(spellsTransport.writes).toEqual([]);
});

test('a Spell its class list lost stays in the Spellbook at its explicit level, off-list and warned; editing the level saves onto the same Spell', async () => {
  const shieldOffList = { ...spells.shield, levels: { sorcerer: 1 } };
  const definitions = Object.values(spells).map((spell) =>
    spell.id === 'shield' ? shieldOffList : spell,
  );
  spellsTransport.params.delete('add');
  renderPage(
    wizard(
      [
        {
          id: 'row-shield',
          spell: shieldOffList,
          castingClassId: 'wizard',
          level: 1,
        },
      ],
      { definitions },
    ),
  );
  const book = within(screen.getByRole('region', { name: 'Spellbook' }));
  expect(book.getByText('off-list')).toBeVisible();
  expect(levelField('Shield')).toHaveValue('1');
  expect(
    book.getByText('Shield is not on the Wizard spell list.'),
  ).toBeVisible();
  fireEvent.change(levelField('Shield'), { target: { value: '0' } });
  saveLevel('Shield');
  await act(async () => undefined);
  expect(lastWrite('recordSpell').args).toMatchObject({
    castingClassId: 'wizard',
    catalogEntryId: 'shield',
    level: 0,
  });
  expect(spellsTransport.writes).toHaveLength(1);
});

test('a count over the allowance warns under its level; Accept and Reopen use the sheet’s warning controls, keep the counts, and a changed count reopens it', async () => {
  spellsTransport.params.delete('add');
  const mageArmor = {
    id: 'mage-armor',
    name: 'Mage armor',
    levels: { sorcerer: 1, wizard: 1 },
    school: 'con',
  };
  const sleep = {
    id: 'sleep',
    name: 'Sleep',
    levels: { sorcerer: 1, wizard: 1 },
    school: 'enc',
  };
  const definitions = [...Object.values(spells), mageArmor, sleep];
  const recordedFor = (list: typeof definitions) =>
    list.map((spell) => ({
      id: `row-${spell.id}`,
      spell,
      castingClassId: 'sorcerer',
    }));
  const three = recordedFor([spells.shield, spells.magicMissile, mageArmor]);
  const four = recordedFor([
    spells.shield,
    spells.magicMissile,
    mageArmor,
    sleep,
  ]);
  const known = (recorded: Recorded[], accepted: Accepted[] = []) =>
    buildSpellSheet({
      classes: ['sorcerer'],
      recorded,
      definitions,
      accepted,
    });
  const acceptance = findCalculatedWarning(known(three), 'spellCount');
  const { show } = renderPage(known(three));
  const first = () => {
    const section = screen
      .getByRole('heading', { name: /^1st-level/ })
      .closest('section');
    if (!section) throw new Error('Expected the 1st-level group');
    return within(section);
  };
  expect(first().getByText('3/2 known')).toBeVisible();
  const warning = '3 level 1 spells known exceeds the allowance of 2.';
  expect(first().getByText(warning)).toBeVisible();
  fireEvent.click(first().getByRole('button', { name: 'Accept' }));
  expect(lastWrite('accept').args).toMatchObject({ check: 'spellCount' });
  await act(async () => lastWrite('accept').resolve(null));

  show(known(three, [acceptance]));
  expect(first().getByText('Accepted')).toBeVisible();
  expect(first().getByRole('button', { name: 'Reopen' })).toBeVisible();
  expect(first().getByText('3/2 known')).toBeVisible();

  show(known(four, [acceptance]));
  expect(
    first().getByText('4 level 1 spells known exceeds the allowance of 2.'),
  ).toBeVisible();
  expect(first().getByRole('button', { name: 'Accept' })).toBeVisible();
  expect(first().getByText('4/2 known')).toBeVisible();
  expect(screen.queryByText(/prepared/i)).toBeNull();
  expect(screen.queryByRole('button', { name: /^Cast/ })).toBeNull();
  expect(screen.queryByRole('spinbutton')).toBeNull();
});

test('a whole-list caster that once recorded keeps those Spells under no Spellcasting, removable, while its list stays read-only', () => {
  spellsTransport.params.delete('add');
  renderPage(
    buildSpellSheet({
      classes: ['cleric'],
      recorded: [
        { id: 'row-bless', spell: spells.bless, castingClassId: 'cleric' },
      ],
    }),
  );
  const list = within(screen.getByRole('region', { name: 'The cleric list' }));
  expect(list.queryByRole('checkbox')).toBeNull();
  const orphans = within(
    screen.getByRole('region', { name: 'Not under any Spellcasting' }),
  );
  expect(orphans.getByText('recorded for Cleric')).toBeVisible();
  expect(
    orphans.getByText('Bless is not under any Spellcasting.'),
  ).toBeVisible();
  fireEvent.click(orphans.getByRole('button', { name: 'Remove Bless' }));
  expect(lastWrite('removeRecordedSpell').args).toMatchObject({
    entryId: 'row-bless',
  });
  expect(list.queryByRole('checkbox')).toBeNull();
});

test('on the phone the name opens and closes the description without touching the record check; wider rows keep the school short with its full name', () => {
  renderPage(wizard());
  const shield = rowOf('Shield');
  const name = shield.getByRole('button', { name: 'Shield' });
  expect(name).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(name);
  expect(name).toHaveAttribute('aria-expanded', 'true');
  const description = document.getElementById(
    name.getAttribute('aria-controls') ?? '',
  );
  expect(description).toHaveTextContent(
    'Abjuration · Invisible disc gives +4 to AC, blocks magic missiles.',
  );
  expect(check('Shield')).not.toBeChecked();
  expect(spellsTransport.writes).toEqual([]);
  fireEvent.click(name);
  expect(name).toHaveAttribute('aria-expanded', 'false');
  expect(name).not.toHaveAttribute('aria-controls');

  expect(
    shield.getAllByText('Abj').every((abbr) => abbr.title === 'Abjuration'),
  ).toBe(true);
  expect(
    rowOf('Magic missile')
      .getAllByText('Evoc')
      .every((abbr) => abbr.title === 'Evocation'),
  ).toBe(true);
  expect(
    shield.getByText('Invisible disc gives +4 to AC, blocks magic missiles.'),
  ).toHaveAttribute(
    'title',
    'Invisible disc gives +4 to AC, blocks magic missiles.',
  );
});

test('maintenance disables recording and removal with one stated reason, while filters and tabs stay usable', () => {
  spellsTransport.maintenance = {
    kind: 'maintenance',
    readOnly: true,
    message: 'Saving is paused for maintenance.',
  };
  renderPage(
    buildSpellSheet({
      classes: ['wizard'],
      recorded: [
        { id: 'row-shield', spell: spells.shield, castingClassId: 'wizard' },
        { id: 'row-bless', spell: spells.bless, castingClassId: 'fighter' },
      ],
    }),
  );
  expect(screen.getAllByText('Saving is paused for maintenance.')).toHaveLength(
    1,
  );
  expect(check('Shield')).toBeDisabled();
  expect(check('Shield')).toHaveAccessibleDescription(
    'Saving is paused for maintenance.',
  );
  expect(check('Magic missile')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Remove Bless' })).toBeDisabled();
  fireEvent.change(
    screen.getByRole('searchbox', { name: 'Search the wizard list' }),
    { target: { value: 'fire' } },
  );
  expect(check('Fireball')).toBeDisabled();
  expect(spellsTransport.writes).toEqual([]);
});

// #415: a specialist's recorded opposition-school Spell takes two slots to
// prepare (CRB p. 77); a spontaneous caster's never does.
test('a recorded opposition-school Spell of an Evocation specialist is tagged 2 slots; the same Spell under a sorcerer is not', () => {
  resetSpellsTransport('from=%2Fcharacters');
  renderPage(
    buildCastingSheet({
      levels: ['wizard', 'sorcerer'],
      selections: [
        {
          id: 'evocation',
          catalogEntryId: 'school-evocation',
          classIdentity: 'wizard',
          feature: 'wizard-arcane-school',
          list: 'Arcane schools',
          oppositionSchools: ['enc', 'nec'],
        },
      ],
      recorded: [
        { id: 'row-fear-wizard', spell: 'fear', castingClassId: 'wizard' },
        { id: 'row-fear-sorcerer', spell: 'fear', castingClassId: 'sorcerer' },
        { id: 'row-fly-wizard', spell: 'fly', castingClassId: 'wizard' },
      ],
    }),
  );
  const tag = rowOf('Fear').getByText('2 slots');
  expect(tag).toHaveAttribute(
    'title',
    'An opposition-school spell uses two slots of its level.',
  );
  expect(tag).toHaveClass('text-amber-300');
  expect(rowOf('Fly').queryByText('2 slots')).toBeNull();

  fireEvent.mouseDown(screen.getByRole('tab', { name: /^Sorcerer/ }));
  expect(rowOf('Fear').queryByText('2 slots')).toBeNull();
});

// #422: a recorded Spell whose place on the list waits for an Archetype
// choice has no level and no warning. Questioner (MTT p. 26) against Psychic
// Detective (OA p. 119) on an investigator leaves its list open; Daylight
// is at 3rd on either, Fireball on neither until the list is chosen.
const investigator = (questionerChoices?: string[]) =>
  buildCastingSheet({
    levels: Array.from({ length: 7 }, () => 'investigator'),
    scores: { intelligence: 16 },
    archetypes: [
      { key: 'investigator-questioner', choices: questionerChoices },
      { key: 'investigator-psychic-detective' },
    ],
    recorded: [
      { id: 'row-daylight', spell: 'daylight', castingClassId: 'investigator' },
      { id: 'row-fireball', spell: 'fireball', castingClassId: 'investigator' },
    ],
  });

test('a Spell whose list level waits for an Archetype choice says so in place of its level, with no warning or level field, under a heading that says the same; the numbers list the Archetype’s added Spell and its waiting list; choosing the list makes it off-list', () => {
  spellsTransport.params.delete('add');
  const { show } = renderPage(investigator());
  const known = within(screen.getByRole('region', { name: 'Spells known' }));
  expect(
    known.getByText('Level waits for a choice', { selector: 'h3 span' }),
  ).toBeVisible();
  const fireball = rowOf('Fireball');
  expect(
    fireball.getByText('Level waits for a choice', {
      selector: 'li > span > span',
    }),
  ).toBeVisible();
  expect(fireball.queryByText(/—/)).toBeNull();
  expect(fireball.queryByText('off-list')).toBeNull();
  expect(fireball.queryByRole('textbox')).toBeNull();
  expect(fireball.queryByText(/not on the|cannot cast/)).toBeNull();
  expect(known.getByText('3rd-level')).toBeVisible();
  expect(rowOf('Daylight').getByText('3rd')).toBeVisible();

  const numbers = within(
    screen.getByRole('region', { name: 'Investigator · Spells known' }),
  );
  expect(numbers.getByText('Spell list').nextElementSibling).toHaveTextContent(
    'Waiting for a choice',
  );
  const changes = within(
    numbers.getByRole('group', { name: 'Archetype list changes' }),
  );
  expect(changes.getByText('Daylight added at level 3')).toBeVisible();
  expect(
    changes.getByText('Daylight added at level 3').nextElementSibling,
  ).toHaveTextContent('from Psychic Detective');

  show(investigator(['spellList']));
  expect(numbers.getByText('Spell list').nextElementSibling).toHaveTextContent(
    'Bard listfrom Questioner (your choice)',
  );
  expect(rowOf('Fireball').getByText('off-list')).toBeVisible();
  expect(levelField('Fireball')).toBeVisible();
  expect(screen.queryByText('Level waits for a choice')).toBeNull();
  expect(
    screen.getByText('Level not set', { selector: 'h3 span' }),
  ).toBeVisible();
});
