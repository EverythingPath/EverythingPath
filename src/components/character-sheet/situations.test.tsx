import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import type { SituationalNote } from '~/lib/character-sheet';
import { BreakdownResolverProvider } from './breakdown-resolver';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import {
  buildSheet,
  calculateFixtureSheet,
  emptyOwnerCandidates,
  representativeWeapon,
  type Adjustment,
} from './character-sheet-test-fixture';
import { DefensesBlock } from './defenses-block';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';

// Situations and Situational Notes (#324): the picker, alternate totals
// beside the numbers they change, markers, waiting and out-of-scope
// contributions, and notes on their own entries, by touch and keyboard.

let snapshot: CharacterSheetSnapshot | null | undefined;
let calls: { name: string; args: Record<string, unknown> }[] = [];
const maintenance = vi.fn<() => MigrationMaintenance>();

vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));
const nameOf = characterSheetNames();
vi.mock('convex/react', () => ({
  useQuery: (query: FunctionReference<'query'>) => {
    const name = nameOf(query);
    return name === 'read' ? snapshot : name === 'companions' ? [] : undefined;
  },
  usePaginatedQuery: () => emptyOwnerCandidates(),
  useMutation: (mutation: FunctionReference<'mutation'>) => {
    const name = nameOf(mutation);
    return (args: Record<string, unknown>) => {
      calls.push({ name, args });
      return new Promise(() => undefined);
    };
  },
}));

beforeEach(() => {
  calls = [];
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
  snapshot = undefined;
});

type Block = Parameters<typeof CharacterSheetBlocks>[0]['blocks'][number];

function renderSheet(
  initial: CharacterSheetSnapshot | undefined,
  blocks: Block[] = ['situations', 'defenses', 'adjustments'],
) {
  snapshot = initial;
  const view = render(<CharacterSheetBlocks blocks={blocks} />);
  return {
    show(next: CharacterSheetSnapshot) {
      snapshot = next;
      view.rerender(<CharacterSheetBlocks blocks={blocks} />);
    },
  };
}

// The sheet with Situational Notes on its entries' definitions, calculated
// as the server would.
function withNotes(
  sheet: CharacterSheetSnapshot,
  notes: Record<string, SituationalNote[]>,
): CharacterSheetSnapshot {
  const catalogEntries = sheet.catalogEntries.map((entry) =>
    notes[entry._id]
      ? ({ ...entry, situationalNotes: notes[entry._id] } as typeof entry)
      : entry,
  );
  const input = {
    entries: sheet.entries,
    catalogEntries,
    characterKind: sheet.character.kind,
  };
  return {
    ...sheet,
    catalogEntries,
    calculated: calculateFixtureSheet(input),
    permanentCalculated: calculateFixtureSheet(input, {
      permanentOnly: true,
    }),
  };
}

const button = (name: string) => screen.getByRole('button', { name });
const queryButton = (name: string | RegExp) =>
  screen.queryByRole('button', { name });
const panel = (label: string) =>
  screen.getByRole('group', { name: `${label} breakdown` });
const queryPanel = (label: string) =>
  screen.queryByRole('group', { name: `${label} breakdown` });
const picker = () => screen.getByRole('region', { name: 'See the sheet' });
const choice = (name: string) => within(picker()).getByRole('button', { name });
const line = (label: string, text: string) =>
  within(panel(label))
    .getByText(text, { selector: 'span' })
    .closest('li') as HTMLElement;

const rage: Adjustment = {
  id: 'rage',
  name: 'Rage',
  modifiers: [{ target: 'save.will', bonusType: 'morale', value: 2 }],
};
const superstition: Adjustment = {
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
};
const fearless: Adjustment = {
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
};

test('an alternate Will total opens its own Situation breakdown by tap and keyboard, closes back to it, and a picked +3 morale / +2 racial combination is +5 with Rage set aside rather than added', () => {
  renderSheet(buildSheet({ adjustments: [rage, superstition, fearless] }));
  const will = button('Will save +2, breakdown');
  expect(
    within(will.parentElement!).getByRole('img', {
      name: 'Situational rules available',
    }),
  ).toBeInTheDocument();
  const spells = button('Will save, vs. spells +3, breakdown');
  expect(button('Will save, vs. fear +4, breakdown')).toBeVisible();

  // A finger arriving does not open it; the tap does, and only its own.
  fireEvent.pointerEnter(spells, { pointerType: 'touch' });
  expect(queryPanel('Will save, vs. spells')).not.toBeInTheDocument();
  fireEvent.click(spells);
  expect(spells).toHaveAttribute('aria-expanded', 'true');
  expect(spells).toHaveAttribute(
    'aria-controls',
    panel('Will save, vs. spells').id,
  );
  expect(queryPanel('Will save')).not.toBeInTheDocument();
  expect(line('Will save, vs. spells', 'Superstition')).toHaveTextContent('+3');
  const setAside = line('Will save, vs. spells', 'Rage');
  expect(within(setAside).getByText('Rage')).toHaveClass('line-through');
  expect(setAside).toHaveTextContent('A higher bonus of this type applies.');
  fireEvent.keyDown(panel('Will save, vs. spells'), { key: 'Escape' });
  expect(queryPanel('Will save, vs. spells')).not.toBeInTheDocument();
  expect(spells).toHaveFocus();

  // Keyboard: a focused button activates on Enter or Space as a click.
  spells.focus();
  fireEvent.click(spells);
  fireEvent.click(
    within(panel('Will save, vs. spells')).getByRole('button', {
      name: 'Close breakdown',
    }),
  );
  expect(spells).toHaveFocus();
  fireEvent.click(spells);
  fireEvent.pointerDown(document.body);
  expect(queryPanel('Will save, vs. spells')).not.toBeInTheDocument();

  fireEvent.click(choice('vs. spells'));
  fireEvent.click(choice('vs. fear'));
  expect(choice('vs. spells')).toHaveAttribute('aria-pressed', 'true');
  expect(choice('vs. fear')).toHaveAttribute('aria-pressed', 'true');
  // The normal number stays; the combination is one fresh total beside it.
  expect(button('Will save +2, breakdown')).toBeVisible();
  const both = button(
    'Will save, selected: vs. spells + vs. fear +5, breakdown',
  );
  expect(queryButton(/^Will save, vs\./)).not.toBeInTheDocument();
  expect(screen.queryByText('+7')).not.toBeInTheDocument();
  fireEvent.click(both);
  const label = 'Will save, selected: vs. spells + vs. fear';
  expect(line(label, 'Superstition')).toHaveTextContent('+3');
  expect(line(label, 'Fearless')).toHaveTextContent('racial');
  expect(within(line(label, 'Rage')).getByText('Rage')).toHaveClass(
    'line-through',
  );
  expect(within(panel(label)).getByText('Not applied')).toBeVisible();
  expect(calls).toEqual([]);
});

test('two entries with the same local words are separate choices named by their owner, and picking the first never activates the second', () => {
  const darkness = (id: string, name: string, value: number): Adjustment => ({
    id,
    name,
    modifiers: [
      {
        target: 'save.will',
        bonusType: 'racial',
        value,
        condition: { situation: { local: 'in darkness' } },
      },
    ],
  });
  renderSheet(
    buildSheet({
      adjustments: [
        darkness('first', 'First', 2),
        darkness('second', 'Second', 4),
      ],
    }),
  );
  expect(choice('First: in darkness')).toHaveAttribute('aria-pressed', 'false');
  expect(choice('Second: in darkness')).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  expect(button('Will save, First: in darkness +2, breakdown')).toBeVisible();
  expect(button('Will save, Second: in darkness +4, breakdown')).toBeVisible();

  fireEvent.click(choice('First: in darkness'));
  expect(choice('First: in darkness')).toHaveAttribute('aria-pressed', 'true');
  expect(choice('Second: in darkness')).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  expect(
    button('Will save, selected: First: in darkness +2, breakdown'),
  ).toBeVisible();
  expect(button('Will save, Second: in darkness +4, breakdown')).toBeVisible();
  expect(queryButton(/^Will save, selected: .* \+6, breakdown$/)).toBeNull();

  fireEvent.click(button('Will save +0, breakdown'));
  const group = within(panel('Will save'))
    .getAllByText('in darkness')
    .map((text) => text.closest('li')!)
    .find((item) => item.textContent?.startsWith('Second'))!;
  expect(group).toHaveTextContent('becomes +4');
  expect(within(group).queryByText('First')).not.toBeInTheDocument();
});

test('a fear-only reroll flags Will and explains itself without a total; an untargeted Critical Focus rule sits on its own entry and on no number', () => {
  const sheet = withNotes(
    buildSheet({
      adjustments: [
        { id: 'resolve', name: 'Steady resolve', modifiers: [] },
        { id: 'focus', name: 'Critical Focus', modifiers: [] },
      ],
    }),
    {
      'resolve-catalog': [
        {
          target: 'save.will',
          situation: 'fear',
          text: 'Reroll a failed save against fear.',
        },
      ],
      'focus-catalog': [{ text: '+4 on rolls to confirm critical hits.' }],
    },
  );
  renderSheet(sheet, ['situations', 'defenses', 'offense', 'adjustments']);
  const will = button('Will save +0, breakdown');
  expect(
    within(will.parentElement!).getByRole('img', {
      name: 'Situational rules available',
    }),
  ).toBeInTheDocument();
  expect(queryButton(/^Will save, /)).not.toBeInTheDocument();

  fireEvent.click(will);
  const fear = within(panel('Will save')).getByText('vs. fear').closest('li')!;
  expect(fear).toHaveTextContent('Reroll a failed save against fear.');
  expect(fear).not.toHaveTextContent('becomes');
  expect(panel('Will save')).not.toHaveTextContent('confirm critical hits');
  fireEvent.keyDown(panel('Will save'), { key: 'Escape' });

  // Picked, it still changes no number: the rule is shown, no total.
  fireEvent.click(choice('vs. fear'));
  expect(queryButton(/^Will save, selected/)).not.toBeInTheDocument();
  fireEvent.click(button('Will save +0, breakdown'));
  expect(panel('Will save')).toHaveTextContent(
    "They don't change this number.",
  );
  expect(panel('Will save')).not.toHaveTextContent(/becomes [+-]?0/);

  const focus = screen.getByRole('listitem', { name: 'Critical Focus' });
  expect(focus).toHaveTextContent('+4 on rolls to confirm critical hits.');
  const resolve = screen.getByRole('listitem', { name: 'Steady resolve' });
  expect(resolve).not.toHaveTextContent('confirm critical hits');
  fireEvent.click(button('Base attack bonus +0, breakdown'));
  expect(panel('Base attack bonus')).not.toHaveTextContent(
    'confirm critical hits',
  );
});

test('a picked spells bonus waiting on inactive Rage says so, a different-school bonus stands apart as out of scope, and turning Rage on through its entry recomputes both', () => {
  const inactiveRage: Adjustment = {
    id: 'rage',
    name: 'Rage',
    active: false,
    modifiers: [{ target: 'ability.str', bonusType: 'morale', value: 4 }],
  };
  const raging: Adjustment = {
    id: 'superstition',
    name: 'Superstition',
    modifiers: [
      {
        target: 'save.will',
        bonusType: 'morale',
        value: 3,
        condition: { situation: 'spells', whileActive: 'rage-catalog' },
      },
    ],
  };
  const schoolBonus: Adjustment = {
    id: 'school',
    name: 'School bonus',
    modifiers: [
      {
        target: 'save.will',
        bonusType: 'untyped',
        value: 20,
        condition: { situation: 'spells', school: 'evocation' },
      },
    ],
  };
  const sheetWith = (rageRow: Adjustment) =>
    withNotes(buildSheet({ adjustments: [rageRow, raging, schoolBonus] }), {
      'superstition-catalog': [
        {
          target: 'save.will',
          text: 'Must attempt saves against helpful spells.',
          condition: { whileActive: 'rage-catalog' },
        },
      ],
    });
  const view = renderSheet(sheetWith(inactiveRage));
  fireEvent.click(choice('vs. spells'));
  // Nothing applies yet, so there is no alternate total to show.
  expect(queryButton(/^Will save, /)).not.toBeInTheDocument();
  fireEvent.click(button('Will save +0, breakdown'));
  const will = panel('Will save');
  expect(will).toHaveTextContent("They don't change this number.");
  expect(within(will).getAllByText('Waiting').length).toBeGreaterThan(0);
  const waiting = within(will)
    .getAllByText('Superstition', { selector: 'span' })
    .map((text) => text.closest('li')!);
  expect(waiting.length).toBeGreaterThan(0);
  for (const item of waiting)
    expect(item).toHaveTextContent('only while Rage is active');
  expect(within(will).getByText('Outside this scope')).toBeVisible();
  expect(line('Will save', 'School bonus')).toHaveTextContent(
    'only for Evocation spells',
  );
  expect(will).toHaveTextContent('Waiting: only while Rage is active');
  expect(will).not.toHaveTextContent(/rage-catalog|evocation\b/);
  fireEvent.keyDown(will, { key: 'Escape' });

  fireEvent.click(screen.getByRole('switch', { name: 'Rage: inactive' }));
  expect(calls).toHaveLength(1);
  expect(JSON.stringify(calls[0]?.args)).toContain('rage');
  view.show(sheetWith({ ...inactiveRage, active: true }));
  expect(choice('vs. spells')).toHaveAttribute('aria-pressed', 'true');
  const picked = button('Will save, selected: vs. spells +3, breakdown');
  fireEvent.click(picked);
  const label = 'Will save, selected: vs. spells';
  expect(line(label, 'Superstition')).toHaveTextContent('+3');
  expect(within(panel(label)).queryByText('Waiting')).not.toBeInTheDocument();
  fireEvent.keyDown(panel(label), { key: 'Escape' });
  fireEvent.click(button('Will save +0, breakdown'));
  expect(panel('Will save')).toHaveTextContent(
    'Must attempt saves against helpful spells.',
  );
  expect(panel('Will save')).not.toHaveTextContent('Waiting: only while');
});

test("scoped numbers keep their own targets: an Evocation Situation changes only the Wizard Evocation DC, not the Wizard's other DCs or the Cleric's", () => {
  const elemental: Adjustment = {
    id: 'elemental',
    name: 'Elemental focus',
    modifiers: [
      {
        target: 'spellDC',
        bonusType: 'untyped',
        value: 2,
        condition: {
          castingClass: 'wizard',
          school: 'evocation',
          situation: { local: 'against fire creatures' },
        },
      },
    ],
  };
  const focus: Adjustment = {
    id: 'focus',
    name: 'Spell Focus',
    modifiers: [
      {
        target: 'spellDC',
        bonusType: 'untyped',
        value: 1,
        condition: { castingClass: 'wizard', school: 'evocation' },
      },
    ],
  };
  renderSheet(
    buildSheet({
      scores: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 18,
        wisdom: 18,
        charisma: 10,
      },
      levels: [
        { id: 'wizard-1', hp: 6, classId: 'wizard' },
        { id: 'cleric-1', hp: 8, classId: 'cleric' },
      ],
      adjustments: [focus, elemental],
    }),
    ['situations', 'spellcasting'],
  );
  fireEvent.click(button('View Wizard spellcasting'));
  fireEvent.click(button('View Cleric spellcasting'));
  const fire = 'Elemental focus: against fire creatures';
  expect(
    button(`Wizard 1st-level Evocation save DC, ${fire} 18, breakdown`),
  ).toBeVisible();
  expect(queryButton(/^Wizard 1st-level save DC, /)).toBeNull();
  expect(queryButton(/^Cleric [^,]*, (?!breakdown)/)).toBeNull();

  fireEvent.click(choice(fire));
  expect(
    button(
      `Wizard 1st-level Evocation save DC, selected: ${fire} 18, breakdown`,
    ),
  ).toBeVisible();
  expect(
    button('Wizard 1st-level Evocation save DC 16, breakdown'),
  ).toBeVisible();
  expect(button('Wizard 1st-level save DC 15, breakdown')).toBeVisible();
  expect(button('Cleric 1st-level save DC 15, breakdown')).toBeVisible();
  expect(
    queryButton(/^(Cleric|Wizard 1st-level save DC).*, selected/),
  ).toBeNull();
});

test('a weapon Situation changes only the routine with that weapon', () => {
  const sword = representativeWeapon('longsword', 'sword', {
    modifiers: [
      {
        target: 'attack',
        bonusType: 'enhancement',
        value: 3,
        condition: { weapon: '$self', situation: 'evil' },
      },
    ],
  });
  renderSheet(
    buildSheet({
      levels: [{ id: 'level-1', hp: 10, classId: 'fighter' }],
      classProficiencies: {
        fighter: [{ category: 'simple' }, { category: 'martial' }],
      },
      sheetEntries: [sword, representativeWeapon('dagger', 'dagger')],
      attackRoutines: [
        { id: 'strike', name: 'Sword strike', weaponEntryId: 'sword' },
        { id: 'stab', name: 'Dagger stab', weaponEntryId: 'dagger' },
      ],
    }),
    ['situations', 'attacks'],
  );
  expect(
    button('Sword strike single attack: attack, vs. evil +4, breakdown'),
  ).toBeVisible();
  expect(queryButton(/^Dagger stab .*, vs\. evil/)).toBeNull();
  fireEvent.click(choice('vs. evil'));
  expect(
    button(
      'Sword strike single attack: attack, selected: vs. evil +4, breakdown',
    ),
  ).toBeVisible();
  expect(queryButton(/^Dagger stab .*, selected/)).toBeNull();
  expect(
    button('Sword strike single attack: attack +1, breakdown'),
  ).toBeVisible();
  expect(
    button('Dagger stab single attack: attack +1, breakdown'),
  ).toBeVisible();
});

test('a charging contribution stays unmarked and collapsed under Combat situations, in the picker and the breakdown, while a non-Combat built-in Situation is marked', () => {
  const reckless: Adjustment = {
    id: 'reckless',
    name: 'Reckless charge',
    modifiers: [
      {
        target: 'ac.other',
        bonusType: 'untyped',
        value: -2,
        condition: { situation: 'charging' },
      },
    ],
  };
  const trapSense: Adjustment = {
    id: 'traps',
    name: 'Trap sense',
    modifiers: [
      {
        target: 'save.ref',
        bonusType: 'dodge',
        value: 1,
        condition: { situation: 'traps' },
      },
    ],
  };
  renderSheet(buildSheet({ adjustments: [reckless, trapSense] }));
  const ac = button('Armor Class 10, breakdown');
  expect(within(ac.parentElement!).queryByRole('img')).not.toBeInTheDocument();
  expect(queryButton(/^Armor Class, /)).toBeNull();
  expect(
    within(button('Reflex save +0, breakdown').parentElement!).getByRole(
      'img',
      { name: 'Situational rules available' },
    ),
  ).toBeInTheDocument();

  const combatChoices = within(picker()).getByRole('button', {
    name: 'Combat situations',
  });
  expect(combatChoices).toHaveAttribute('aria-expanded', 'false');
  expect(
    within(picker()).getByRole('button', {
      name: 'when charging',
      hidden: true,
    }),
  ).not.toBeVisible();
  expect(choice('vs. traps')).toBeVisible();

  fireEvent.click(ac);
  const disclosure = within(panel('Armor Class')).getByRole('button', {
    name: 'Combat situations',
  });
  expect(within(panel('Armor Class')).queryByText('Only when…')).toBeNull();
  expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  const charging = within(panel('Armor Class')).getByText('when charging');
  expect(charging).not.toBeVisible();
  fireEvent.click(disclosure);
  expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  expect(charging).toBeVisible();
  expect(charging.closest('li')).toHaveTextContent('becomes 8');

  fireEvent.click(combatChoices);
  expect(combatChoices).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(choice('when charging'));
  expect(
    button('Armor Class, selected: when charging 8, breakdown'),
  ).toBeVisible();
});

test('while the sheet loads, no number or alternate total is shown', () => {
  renderSheet(undefined);
  expect(
    screen.getByRole('status', { name: 'Loading character sheet…' }),
  ).toBeInTheDocument();
  expect(queryButton(/breakdown/)).toBeNull();
});

test('without Situations there is no picker; with the sheet unable to preview, a breakdown says so and no alternate appears', () => {
  renderSheet(buildSheet());
  expect(screen.queryByRole('region', { name: 'See the sheet' })).toBeNull();
  expect(queryButton(/^Will save, /)).toBeNull();

  const sheet = buildSheet({ adjustments: [superstition] });
  render(
    <BreakdownResolverProvider
      previewSituation={() => null}
      adjustments={[]}
      spellcastings={[]}
      selected={{
        selections: ['spells'],
        selectedKeys: ['x'],
        text: 'vs. spells',
      }}
    >
      <DefensesBlock statistics={sheet.calculated.derivedStatistics} />
    </BreakdownResolverProvider>,
  );
  const will = screen
    .getAllByRole('button', { name: 'Will save +0, breakdown' })
    .at(-1)!;
  expect(queryButton(/^Will save, /)).toBeNull();
  fireEvent.click(will);
  const explanation = panel('Will save');
  expect(
    within(explanation).getAllByText('Situation preview is unavailable.'),
  ).toHaveLength(2);
  expect(explanation).not.toHaveTextContent('becomes');
});

test('Clear Situations, another Character and removing a picked entry each return the ordinary totals', () => {
  const view = renderSheet(
    buildSheet({ adjustments: [rage, superstition, fearless] }),
  );
  fireEvent.click(choice('vs. spells'));
  expect(button('Will save, selected: vs. spells +3, breakdown')).toBeVisible();
  const clear = button('Clear Situations');
  fireEvent.click(clear);
  expect(choice('vs. spells')).toHaveAttribute('aria-pressed', 'false');
  expect(queryButton(/^Will save, selected/)).toBeNull();
  expect(queryButton('Clear Situations')).toBeNull();
  expect(
    within(picker()).getByRole('heading', { name: 'See the sheet' }),
  ).toHaveFocus();

  fireEvent.click(choice('vs. fear'));
  const other = buildSheet({
    adjustments: [rage, superstition, fearless],
    name: 'Brannoc',
  });
  view.show({
    ...other,
    character: {
      ...other.character,
      _id: 'other' as typeof other.character._id,
    },
  });
  expect(choice('vs. fear')).toHaveAttribute('aria-pressed', 'false');
  expect(queryButton(/selected/)).toBeNull();

  view.show(buildSheet({ adjustments: [rage, superstition, fearless] }));
  fireEvent.click(choice('vs. fear'));
  view.show(buildSheet({ adjustments: [rage, superstition] }));
  expect(
    within(picker()).queryByRole('button', { name: 'vs. fear' }),
  ).toBeNull();
  view.show(buildSheet({ adjustments: [rage, superstition, fearless] }));
  expect(choice('vs. fear')).toHaveAttribute('aria-pressed', 'false');
  expect(button('Will save +2, breakdown')).toBeVisible();
});

test('on a phone-sized viewport every choice, alternate and disclosure stays a labelled control that works without hover', () => {
  window.innerWidth = 390;
  fireEvent(window, new Event('resize'));
  renderSheet(buildSheet({ adjustments: [rage, superstition, fearless] }));
  for (const name of ['vs. spells', 'vs. fear'])
    expect(choice(name)).toHaveAttribute('aria-pressed', 'false');
  const alternate = button('Will save, vs. fear +4, breakdown');
  expect(alternate).toHaveAttribute('aria-expanded', 'false');
  fireEvent.pointerEnter(alternate, { pointerType: 'touch' });
  expect(queryPanel('Will save, vs. fear')).toBeNull();
  fireEvent.click(alternate);
  expect(alternate).toHaveAttribute('aria-expanded', 'true');
  expect(panel('Will save, vs. fear')).toHaveTextContent('Fearless');
  // The alternates wrap inside their own row rather than widening the sheet.
  expect(alternate.closest('li')).toContainElement(
    button('Will save +2, breakdown'),
  );
  window.innerWidth = 1024;
});

test('a StatRow presents its normal number before its alternate totals', () => {
  renderSheet(buildSheet({ adjustments: [rage, superstition] }));
  const ordinary = button('Will save +2, breakdown');
  const alternate = button('Will save, vs. spells +3, breakdown');
  expect(
    ordinary.compareDocumentPosition(alternate) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});
