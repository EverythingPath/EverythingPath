import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { defaultAbilityScores } from '~/lib/character-sheet';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import {
  buildSheet,
  emptyOwnerCandidates,
  monkClassCatalog,
  representativeWeapon,
  type AttackRoutineFixture,
  type CatalogSheetEntry,
} from './character-sheet-test-fixture';
import type * as StatBreakdownModule from './stat-breakdown';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';

// One routine's attack lines (#314): separate single and full attacks, each
// number a breakdown of its own resolver statistic.

let snapshot: CharacterSheetSnapshot | undefined;
// Each number's breakdown address, by its accessible name.
const targets = vi.hoisted(() => new Map<string, unknown>());
const maintenance = vi.fn<() => MigrationMaintenance>();

vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));
vi.mock('./stat-breakdown', async (importOriginal) => {
  const actual = await importOriginal<typeof StatBreakdownModule>();
  return {
    ...actual,
    StatBreakdown: (props: Parameters<typeof actual.StatBreakdown>[0]) => {
      targets.set(props.label, props.target);
      return <actual.StatBreakdown {...props} />;
    },
  };
});
const nameOf = characterSheetNames();
vi.mock('convex/react', () => ({
  useQuery: (query: FunctionReference<'query'>) => {
    const name = nameOf(query);
    return name === 'read' ? snapshot : name === 'companions' ? [] : undefined;
  },
  usePaginatedQuery: () => emptyOwnerCandidates(),
  useMutation: () => () => new Promise(() => undefined),
}));

beforeEach(() => {
  targets.clear();
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
});

function fighter(level: number, routines: AttackRoutineFixture[]) {
  return buildSheet({
    scores: { ...defaultAbilityScores, strength: 16, dexterity: 14 },
    levels: Array.from({ length: level }, (_, index) => ({
      id: `level-${index + 1}`,
      hp: 10,
      classId: 'fighter' as const,
    })),
    classProficiencies: {
      fighter: [{ category: 'simple' }, { category: 'martial' }],
    },
    sheetEntries: [
      representativeWeapon('longsword', 'sword'),
      representativeWeapon('longbow', 'bow'),
      representativeWeapon('dagger', 'dagger'),
    ],
    attackRoutines: routines,
  });
}
const strike = { id: 'strike', name: 'Sword strike', weaponEntryId: 'sword' };

function renderAttacks(sheet: CharacterSheetSnapshot) {
  snapshot = sheet;
  render(<CharacterSheetBlocks blocks={['attacks']} />);
  return screen.getByRole('listitem', { name: strike.name });
}
const list = (card: HTMLElement, name: string) =>
  within(card).getByRole('list', { name });
const numbers = (container: HTMLElement, statistic: string) =>
  within(container)
    .getAllByRole('button', { name: new RegExp(`: ${statistic} `) })
    .map((button) => button.getAttribute('aria-label'));

test.each([
  [6, ['+9', '+4']],
  [11, ['+14', '+9', '+4']],
  [16, ['+19', '+14', '+9', '+4']],
])(
  'a level %i fighter makes one single attack and an ordered full attack',
  (level, bonuses) => {
    const card = renderAttacks(fighter(level, [strike]));
    expect(numbers(list(card, 'Single attack'), 'attack')).toEqual([
      `Sword strike single attack: attack ${bonuses[0]}, breakdown`,
    ]);
    expect(numbers(list(card, 'Full attack'), 'attack')).toEqual(
      bonuses.map(
        (bonus, index) =>
          `Sword strike full attack ${index + 1} of ${bonuses.length}: attack ${bonus}, breakdown`,
      ),
    );
  },
);

test('each number opens its own breakdown, and damage credits its dice to the weapon', () => {
  const card = renderAttacks(fighter(6, [strike]));
  const second = within(list(card, 'Full attack')).getByRole('button', {
    name: 'Sword strike full attack 2 of 2: attack +4, breakdown',
  });
  fireEvent.click(second);
  const attack = screen.getByRole('group', {
    name: 'Sword strike full attack 2 of 2: attack breakdown',
  });
  expect(attack).toHaveTextContent('Iterative attack 2');
  expect(attack).toHaveTextContent('Strength');
  expect(screen.getAllByRole('group', { name: /breakdown$/ }).length).toBe(1);

  const damage = within(list(card, 'Single attack')).getByRole('button', {
    name: 'Sword strike single attack: damage 1d8+3, breakdown',
  });
  fireEvent.click(damage);
  const damageGroup = screen.getByRole('group', {
    name: 'Sword strike single attack: damage breakdown',
  });
  expect(damageGroup).toHaveTextContent(/Longsword\s*damage dice\s*1d8/);
  expect(damageGroup).toHaveTextContent('slashing');
  expect(damageGroup).toHaveTextContent(/Strength to damage\s*\+3/);
  expect(damageGroup).toHaveTextContent('1d8+3');

  fireEvent.click(
    within(list(card, 'Single attack')).getByRole('button', {
      name: 'Sword strike single attack: critical threat 19–20, breakdown',
    }),
  );
  expect(
    screen.getByRole('group', {
      name: 'Sword strike single attack: critical threat breakdown',
    }),
  ).toHaveTextContent(/Longsword critical threat\s*19/);
  fireEvent.click(
    within(list(card, 'Single attack')).getByRole('button', {
      name: 'Sword strike single attack: critical multiplier ×2, breakdown',
    }),
  );
  expect(
    screen.getByRole('group', {
      name: 'Sword strike single attack: critical multiplier breakdown',
    }),
  ).toHaveTextContent(/Longsword critical multiplier\s*×2/);
  expect(within(card).queryByRole('button', { name: /range increment/ })).toBe(
    null,
  );
});

test('a ranged routine shows its range increment and its source', () => {
  const card = renderAttacks(
    fighter(1, [
      { ...strike, weaponEntryId: 'bow', hands: 'two', mode: 'ranged' },
    ]),
  );
  const range = within(list(card, 'Single attack')).getByRole('button', {
    name: 'Sword strike single attack: range increment 100 ft., breakdown',
  });
  fireEvent.keyDown(range, { key: 'Enter' });
  fireEvent.click(range);
  expect(
    screen.getByRole('group', {
      name: 'Sword strike single attack: range increment breakdown',
    }),
  ).toHaveTextContent(/Longbow range increment\s*100 ft\./);
  expect(within(list(card, 'Single attack')).getByText('Ranged')).toBeVisible();
  expect(
    within(list(card, 'Single attack')).getByRole('button', {
      name: 'Sword strike single attack: attack +3, breakdown',
    }),
  ).toBeVisible();
});

test('an off-hand line names its hand and opens breakdowns at its own place in the full attack', () => {
  const card = renderAttacks(
    fighter(6, [
      {
        ...strike,
        offHand: { kind: 'weapon', weaponEntryId: 'dagger', mode: 'melee' },
      },
    ]),
  );
  const full = list(card, 'Full attack');
  expect(numbers(full, 'attack')).toEqual([
    expect.stringMatching(
      /^Sword strike full attack 1 of 3, main hand: attack /,
    ),
    expect.stringMatching(
      /^Sword strike full attack 2 of 3, main hand: attack /,
    ),
    expect.stringMatching(
      /^Sword strike full attack 3 of 3, off hand: attack /,
    ),
  ]);
  const off = within(full).getAllByRole('listitem')[2];
  if (!off) throw new Error('Expected the off-hand line');
  expect(within(off).getByText('Off hand')).toBeVisible();
  expect(within(off).getByText('Dagger')).toBeVisible();
  // The single attack is the main hand alone, without a hand to name.
  expect(numbers(list(card, 'Single attack'), 'attack')).toEqual([
    expect.stringMatching(/^Sword strike single attack: attack /),
  ]);
  expect(within(list(card, 'Single attack')).queryByText('Off hand')).toBe(
    null,
  );

  const name = 'Sword strike full attack 3 of 3, off hand';
  const damage = within(off).getByRole('button', {
    name: /^Sword strike full attack 3 of 3, off hand: damage 1d4/,
  });
  for (const [statistic, label] of [
    ['attackBonus', 'attack'],
    ['damageBonus', 'damage'],
    ['criticalThreat', 'critical threat'],
    ['criticalMultiplier', 'critical multiplier'],
  ] as const)
    expect(targets.get(`${name}: ${label}`)).toEqual({
      kind: 'attackRoutine',
      entryId: 'strike',
      sequence: 'full',
      attackIndex: 2,
      statistic,
    });
  fireEvent.click(damage);
  expect(
    screen.getByRole('group', { name: `${name}: damage breakdown` }),
  ).toHaveTextContent(/Dagger\s*damage dice\s*1d4/);
});

// Ranged and thrown lines (#322): launcher and ammunition named on every
// line, the range increment and its penalty, reload limits, and the ranged
// Situations through the sheet's picker.

function archer(
  level: number,
  routines: AttackRoutineFixture[],
  input: Parameters<typeof buildSheet>[0] = {},
) {
  return buildSheet({
    scores: { ...defaultAbilityScores, strength: 16, dexterity: 14 },
    levels: Array.from({ length: level }, (_, index) => ({
      id: `level-${index + 1}`,
      hp: 10,
      classId: 'fighter' as const,
    })),
    classProficiencies: {
      fighter: [{ category: 'simple' }, { category: 'martial' }],
    },
    sheetEntries: [
      representativeWeapon('longbow', 'bow'),
      representativeWeapon('light-crossbow', 'crossbow'),
      representativeWeapon('arrows', 'arrows'),
    ],
    attackRoutines: routines,
    ...input,
  });
}
const shot: AttackRoutineFixture = {
  ...strike,
  weaponEntryId: 'bow',
  hands: 'two',
  mode: 'ranged',
};
function renderArcher(
  sheet: CharacterSheetSnapshot,
  blocks: ('situations' | 'attacks')[] = ['attacks'],
) {
  snapshot = sheet;
  const view = render(<CharacterSheetBlocks blocks={blocks} />);
  return {
    card: screen.getByRole('listitem', { name: strike.name }),
    show: (next: CharacterSheetSnapshot) => {
      snapshot = next;
      view.rerender(<CharacterSheetBlocks blocks={blocks} />);
    },
  };
}

test('every single and full line names the launcher and its ammunition and shows the range increment with the penalty for shooting beyond it', () => {
  const { card } = renderArcher(
    archer(6, [{ ...shot, ammunitionEntryId: 'arrows', rangeIncrements: 3 }]),
  );
  const single = list(card, 'Single attack');
  const full = list(card, 'Full attack');
  // Level 6, Dex +2, two increments beyond the first: +8 −4.
  expect(numbers(single, 'attack')).toEqual([
    'Sword strike single attack: attack +4, breakdown',
  ]);
  expect(numbers(full, 'attack')).toEqual([
    'Sword strike full attack 1 of 2: attack +4, breakdown',
    'Sword strike full attack 2 of 2: attack −1, breakdown',
  ]);
  for (const sequence of [single, full]) {
    const lines = within(sequence).getAllByRole('listitem');
    for (const line of lines) {
      expect(within(line).getByText('Longbow')).toBeVisible();
      expect(within(line).getByText('Arrows')).toBeVisible();
      expect(within(line).getByText('Ranged')).toBeVisible();
      expect(
        within(line).getByText('range penalty').parentElement,
      ).toHaveTextContent('range penalty −4');
      expect(
        within(line).getByRole('button', {
          name: /: range increment 100 ft\., breakdown$/,
        }),
      ).toBeVisible();
    }
  }
  expect(
    targets.get('Sword strike full attack 2 of 2: range increment'),
  ).toEqual({
    kind: 'attackRoutine',
    entryId: 'strike',
    sequence: 'full',
    attackIndex: 1,
    statistic: 'rangeIncrement',
  });
  fireEvent.click(
    within(full).getByRole('button', {
      name: 'Sword strike full attack 2 of 2: attack −1, breakdown',
    }),
  );
  expect(
    screen.getByRole('group', {
      name: 'Sword strike full attack 2 of 2: attack breakdown',
    }),
  ).toHaveTextContent(/Range penalty\s*[-−]4/);
  expect(card).toHaveTextContent(
    'Longbow · Two hands · Ranged · Arrows · 3 range increments',
  );
});

test('within the first increment there is no penalty, and a reload-limited crossbow keeps one shot in its full attack with the note on its card', () => {
  const { card, show } = renderArcher(archer(6, [shot]));
  expect(within(card).queryByText(/range penalty/)).toBeNull();
  expect(numbers(list(card, 'Full attack'), 'attack')).toHaveLength(2);
  expect(within(card).queryByRole('list', { name: /attack rate$/ })).toBeNull();

  show(archer(6, [{ ...shot, weaponEntryId: 'crossbow', revision: 1 }]));
  expect(numbers(list(card, 'Full attack'), 'attack')).toEqual([
    'Sword strike full attack 1 of 1: attack +8, breakdown',
  ]);
  expect(
    within(card).getByRole('list', { name: 'Sword strike attack rate' }),
  ).toHaveTextContent('Reload: move action. One attack per full attack.');
  expect(card).toHaveTextContent('Light crossbow · Two hands · Ranged');
});

test('Point-Blank Shot offers within 30 ft. beside ranged attack and damage, shooting into melee waits under Combat situations, and Precise Shot removes it', () => {
  const picker = () => screen.getByRole('region', { name: 'See the sheet' });
  const { card, show } = renderArcher(
    archer(1, [shot], { feats: [{ id: 'pbs', key: 'point-blank-shot' }] }),
    ['situations', 'attacks'],
  );
  const single = list(card, 'Single attack');
  expect(
    within(single).getByRole('button', {
      name: 'Sword strike single attack: attack, within 30 ft. +4, breakdown',
    }),
  ).toBeVisible();
  expect(
    within(single).getByRole('button', {
      name: 'Sword strike single attack: damage, within 30 ft. 1d8+1, breakdown',
    }),
  ).toBeVisible();
  const close = within(picker()).getByRole('button', { name: 'within 30 ft.' });
  fireEvent.click(close);
  expect(close).toHaveAttribute('aria-pressed', 'true');
  expect(
    within(single).getByRole('button', {
      name: 'Sword strike single attack: attack, selected: within 30 ft. +4, breakdown',
    }),
  ).toBeVisible();
  fireEvent.click(close);

  const combat = within(picker()).getByRole('button', {
    name: 'Combat situations',
  });
  fireEvent.click(combat);
  const melee = within(picker()).getByRole('button', {
    name: 'when shooting into melee',
  });
  expect(melee).toBeVisible();
  // Not an alternate until picked: every Character shoots into melee sometimes.
  expect(
    within(single).queryByRole('button', { name: /when shooting into melee/ }),
  ).toBeNull();
  fireEvent.click(melee);
  expect(
    within(single).getByRole('button', {
      name: 'Sword strike single attack: attack, selected: when shooting into melee −1, breakdown',
    }),
  ).toBeVisible();
  expect(
    within(single).queryByRole('button', { name: /: damage, selected/ }),
  ).toBeNull();

  show(
    archer(1, [shot], {
      feats: [
        { id: 'pbs', key: 'point-blank-shot' },
        { id: 'precise', key: 'precise-shot' },
      ],
    }),
  );
  expect(
    within(picker()).queryByRole('button', {
      name: 'when shooting into melee',
      hidden: true,
    }),
  ).toBeNull();
  expect(
    within(single).queryByRole('button', {
      name: /selected: when shooting into melee/,
    }),
  ).toBeNull();
  expect(
    within(single).getByRole('button', {
      name: 'Sword strike single attack: attack +3, breakdown',
    }),
  ).toBeVisible();
});

// Natural and unarmed lines (#323).
function naturalFighter(routines: AttackRoutineFixture[]) {
  return buildSheet({
    scores: { ...defaultAbilityScores, strength: 16, dexterity: 14 },
    levels: Array.from({ length: 6 }, (_, index) => ({
      id: `level-${index + 1}`,
      hp: 10,
      classId: 'fighter' as const,
    })),
    classProficiencies: {
      fighter: [{ category: 'simple' }, { category: 'martial' }],
    },
    sheetEntries: [
      representativeWeapon('longsword', 'sword'),
      representativeWeapon('natural-claw', 'claw'),
      representativeWeapon('natural-bite', 'bite'),
    ],
    attackRoutines: routines,
  });
}

function renderCard(sheet: CharacterSheetSnapshot, name: string) {
  snapshot = sheet;
  render(<CharacterSheetBlocks blocks={['attacks']} />);
  return screen.getByRole('listitem', { name });
}

test('natural attacks after a weapon are secondary on each line, with their own source-backed numbers', () => {
  const card = renderCard(
    naturalFighter([{ ...strike, naturalAttackEntryIds: ['claw', 'bite'] }]),
    'Sword strike',
  );
  const full = list(card, 'Full attack');
  expect(numbers(full, 'damage')).toEqual([
    expect.stringMatching(/^Sword strike full attack 1 of 4: damage 1d8\+3,/),
    expect.stringMatching(/^Sword strike full attack 2 of 4: damage 1d8\+3,/),
    expect.stringMatching(
      /^Sword strike full attack 3 of 4, secondary natural attack: damage 1d4\+1,/,
    ),
    expect.stringMatching(
      /^Sword strike full attack 4 of 4, secondary natural attack: damage 1d6\+1,/,
    ),
  ]);
  const [first, , claw, bite] = within(full).getAllByRole('listitem');
  if (!first || !claw || !bite) throw new Error('Expected four lines');
  expect(within(claw).getByText('Claw')).toBeVisible();
  expect(within(claw).getByText('Secondary natural attack')).toBeVisible();
  expect(within(bite).getByText('Secondary natural attack')).toBeVisible();
  expect(within(first).queryByText(/natural attack/)).toBe(null);
  // The single attack is the weapon alone.
  expect(
    within(list(card, 'Single attack')).getAllByRole('listitem'),
  ).toHaveLength(1);

  const name = 'Sword strike full attack 4 of 4, secondary natural attack';
  expect(targets.get(`${name}: damage`)).toEqual({
    kind: 'attackRoutine',
    entryId: 'strike',
    sequence: 'full',
    attackIndex: 3,
    statistic: 'damageBonus',
  });
  fireEvent.click(
    within(bite).getByRole('button', {
      name: /: damage /,
    }),
  );
  expect(
    screen.getByRole('group', { name: `${name}: damage breakdown` }),
  ).toHaveTextContent(/Bite\s*damage dice\s*1d6/);
});

test('a natural attack on its own is primary in its single and full attacks', () => {
  const card = renderCard(
    naturalFighter([{ id: 'jaws', name: 'Jaws', weaponEntryId: 'bite' }]),
    'Jaws',
  );
  expect(numbers(list(card, 'Single attack'), 'attack')).toEqual([
    expect.stringMatching(
      /^Jaws single attack, primary natural attack: attack /,
    ),
  ]);
  expect(numbers(list(card, 'Full attack'), 'attack')).toEqual([
    expect.stringMatching(
      /^Jaws full attack 1 of 1, primary natural attack: attack /,
    ),
  ]);
  expect(
    within(list(card, 'Single attack')).getByText('Primary natural attack'),
  ).toBeVisible();
  const attack = within(list(card, 'Single attack')).getByRole('button', {
    name: /: attack /,
  });
  fireEvent.click(attack);
  expect(
    screen.getByRole('group', {
      name: 'Jaws single attack, primary natural attack: attack breakdown',
    }),
  ).toHaveTextContent('Strength');
});

test('an unarmed strike says whether its damage is nonlethal, in the card and the preview', () => {
  const sheet = naturalFighter([
    { id: 'fists', name: 'Fists', weaponEntryId: 'unarmed' },
  ]);
  const card = renderCard(sheet, 'Fists');
  expect(
    within(list(card, 'Single attack')).getByText('Nonlethal'),
  ).toBeVisible();
  expect(
    within(list(card, 'Full attack')).getAllByText('Nonlethal'),
  ).toHaveLength(2);
  fireEvent.click(within(card).getByRole('button', { name: 'Edit Fists' }));
  const preview = within(
    screen.getByRole('dialog', { name: 'Attack routine' }),
  ).getByRole('region', { name: 'As it attacks now' });
  expect(preview).toHaveTextContent(
    /Single attack\s*\+\d+ \(1d3\+3\/×2\) Nonlethal/,
  );
});

test('an unarmed strike that may deal either kind of damage says so', () => {
  const sheet = naturalFighter([
    { id: 'fists', name: 'Fists', weaponEntryId: 'unarmed' },
  ]);
  for (const line of sheet.calculated.attackRoutines[0]?.single ?? [])
    line.damageKind = 'lethalOrNonlethal';
  const card = renderCard(sheet, 'Fists');
  expect(
    within(list(card, 'Single attack')).getByText('Lethal or nonlethal'),
  ).toBeVisible();
});

// Routine Options and automatic feats (#407): a rule's tag on the line it
// changes, the Rend's own breakdown address, and the effects outside the
// lines as Situations through the sheet's picker.

test('Rapid Shot tags its extra attack, Manyshot its arrows and the Vital Strike feat the single attack, on the card and in the preview', () => {
  const { card } = renderArcher(
    archer(
      6,
      [
        {
          ...shot,
          options: ['rapid-catalog', 'many-catalog', 'improved-catalog'],
        },
      ],
      {
        feats: [
          { id: 'rapid', key: 'rapid-shot' },
          { id: 'many', key: 'manyshot' },
          { id: 'improved', key: 'improved-vital-strike' },
        ],
      },
    ),
  );
  const single = list(card, 'Single attack');
  const full = list(card, 'Full attack');
  // One extra shot at the highest bonus, −2 on every full-attack line.
  expect(numbers(full, 'attack')).toEqual([
    'Sword strike full attack 1 of 3: attack +6, breakdown',
    'Sword strike full attack 2 of 3: attack +6, breakdown',
    'Sword strike full attack 3 of 3: attack +1, breakdown',
  ]);
  const rapid = within(full).getAllByText('Rapid Shot');
  expect(rapid).toHaveLength(1);
  expect(rapid[0]).toHaveTextContent('extra attack from Rapid Shot');
  expect(within(full).getAllByText('2 arrows')).toHaveLength(1);
  expect(within(single).queryByText(/Rapid Shot/)).toBeNull();
  expect(within(single).queryByText('2 arrows')).toBeNull();

  // The tag names the switched-on feat of the chain.
  const vital = within(single).getByTitle('Improved Vital Strike (1d8 ×3)');
  expect(vital).toHaveTextContent('Improved Vital Strike (1d8 ×3)');
  expect(within(full).queryByText(/Vital Strike/)).toBeNull();
  const damage = within(single).getByRole('button', {
    name: 'Sword strike single attack: damage 3d8, breakdown',
  });
  fireEvent.click(damage);
  expect(
    screen.getByRole('group', {
      name: 'Sword strike single attack: damage breakdown',
    }),
  ).toHaveTextContent(
    'Improved Vital Strike: extra dice are not multiplied on a critical hit.',
  );
  expect(numbers(full, 'damage')).toEqual(
    Array.from(
      { length: 3 },
      (_, index) =>
        `Sword strike full attack ${index + 1} of 3: damage 1d8, breakdown`,
    ),
  );

  fireEvent.click(screen.getByRole('button', { name: 'Edit Sword strike' }));
  const preview = within(
    screen.getByRole('dialog', { name: 'Attack routine' }),
  ).getByRole('region', { name: 'As it attacks now' });
  expect(preview).toHaveTextContent(
    /Single attack\s*\+8 \(3d8\/×3, 100 ft\.\) Improved Vital Strike/,
  );
  expect(preview).toHaveTextContent(
    /Full attack\s*\+6 \(1d8\/×3, 100 ft\.\) 2 arrows\s*\+6 \(1d8\/×3, 100 ft\.\) Rapid Shot\s*\+1 \(1d8\/×3, 100 ft\.\)/,
  );
});

test('the Rend damage is addressed to the routine’s own Rend statistic and shows in the preview', () => {
  snapshot = buildSheet({
    scores: { ...defaultAbilityScores, strength: 16, dexterity: 14 },
    levels: Array.from({ length: 6 }, (_, index) => ({
      id: `level-${index + 1}`,
      hp: 10,
      classId: 'fighter' as const,
    })),
    classProficiencies: {
      fighter: [{ category: 'simple' }, { category: 'martial' }],
    },
    sheetEntries: [
      representativeWeapon('longsword', 'sword'),
      representativeWeapon('dagger', 'dagger'),
    ],
    feats: [{ id: 'rend', key: 'two-weapon-rend' }],
    attackRoutines: [
      {
        ...strike,
        offHand: { kind: 'weapon', weaponEntryId: 'dagger', mode: 'melee' },
      },
    ],
  });
  render(<CharacterSheetBlocks blocks={['attacks']} />);
  const card = screen.getByRole('listitem', { name: strike.name });
  const rend = within(card).getByRole('button', {
    name: 'Sword strike Two-Weapon Rend: damage 1d10+4, breakdown',
  });
  expect(targets.get('Sword strike Two-Weapon Rend: damage')).toEqual({
    kind: 'twoWeaponRend',
    entryId: 'strike',
  });
  fireEvent.keyDown(rend, { key: 'Enter' });
  fireEvent.click(rend);
  const breakdown = screen.getByRole('group', {
    name: 'Sword strike Two-Weapon Rend: damage breakdown',
  });
  expect(breakdown).toHaveTextContent(/Strength/);
  // A paragraph can't hold the breakdown's list.
  expect(breakdown.closest('p')).toBeNull();

  fireEvent.click(
    within(card).getByRole('button', { name: 'Edit Sword strike' }),
  );
  const preview = within(
    screen.getByRole('dialog', { name: 'Attack routine' }),
  ).getByRole('region', { name: 'As it attacks now' });
  expect(preview).toHaveTextContent(
    /Two-Weapon Rend\s*1d10\+4 Once per round, when both hands hit\./,
  );
});

// The NPC Codex Cruel Devotee (monk 5) flurries from a base attack bonus of
// +5, the monk level (CRB p. 57; FAQ naz).
test('the flurry base attack bonus is addressed to the routine’s own flurry statistic', () => {
  snapshot = buildSheet({
    scores: { ...defaultAbilityScores, strength: 16 },
    levels: Array.from({ length: 5 }, (_, index) => ({
      id: `monk-${index + 1}`,
      hp: 8,
      classId: 'monk' as const,
    })),
    hasRaces: true,
    extraCatalog: monkClassCatalog(),
    attackRoutines: [
      {
        id: 'fists',
        name: 'Fists',
        weaponEntryId: 'unarmed',
        options: ['monk-flurry'],
      },
    ],
  });
  render(<CharacterSheetBlocks blocks={['attacks']} />);
  const card = screen.getByRole('listitem', { name: 'Fists' });
  expect(
    within(card).getByRole('button', {
      name: 'Fists Flurry of Blows: base attack bonus +5, breakdown',
    }),
  ).toBeVisible();
  expect(targets.get('Fists Flurry of Blows: base attack bonus')).toEqual({
    kind: 'flurryBaseAttack',
    entryId: 'fists',
  });
});

test('Combat Expertise, Lunge and Power Attack act outside the lines as Situations: listed with the Character’s own, marked and previewed on AC and CMB', () => {
  snapshot = buildSheet({
    levels: [{ id: 'level-1', hp: 10, classId: 'fighter' }],
    classProficiencies: {
      fighter: [{ category: 'simple' }, { category: 'martial' }],
    },
    sheetEntries: [representativeWeapon('longsword', 'sword')],
    feats: [
      { id: 'expertise', key: 'combat-expertise' },
      { id: 'lunge', key: 'lunge' },
      { id: 'power', key: 'power-attack' },
    ],
    attackRoutines: [
      {
        ...strike,
        options: ['expertise-catalog', 'lunge-catalog', 'power-catalog'],
      },
    ],
  });
  render(
    <CharacterSheetBlocks
      blocks={['defenses', 'offense', 'situations', 'attacks']}
    />,
  );
  const picker = screen.getByRole('region', { name: 'See the sheet' });
  const expertise = within(picker).getByRole('button', {
    name: 'when using Combat Expertise',
  });
  const lunge = within(picker).getByRole('button', {
    name: 'when using Lunge',
  });
  const power = within(picker).getByRole('button', {
    name: 'when using Power Attack',
  });
  // The Character's own Situations, not the collapsed Combat situations.
  for (const choice of [expertise, lunge, power]) expect(choice).toBeVisible();
  expect(
    within(picker).queryByRole('button', { name: 'Combat situations' }),
  ).toBeNull();

  const ac = screen.getByRole('button', { name: 'Armor Class 10, breakdown' });
  expect(
    within(ac.parentElement!).getByRole('img', {
      name: 'Situational rules available',
    }),
  ).toBeInTheDocument();
  fireEvent.click(ac);
  const panel = screen.getByRole('group', { name: 'Armor Class breakdown' });
  expect(panel).toHaveTextContent('when using Combat Expertise');
  expect(panel).toHaveTextContent('when using Lunge');
  expect(panel).not.toHaveTextContent('when using Power Attack');
  fireEvent.keyDown(document, { key: 'Escape' });

  fireEvent.click(expertise);
  expect(expertise).toHaveAttribute('aria-pressed', 'true');
  expect(
    screen.getByRole('button', {
      name: 'Armor Class, selected: when using Combat Expertise 11, breakdown',
    }),
  ).toBeVisible();
  expect(
    screen.getByRole('button', {
      name: 'Combat Maneuver Bonus, selected: when using Combat Expertise +0, breakdown',
    }),
  ).toBeVisible();
  fireEvent.click(expertise);

  fireEvent.click(lunge);
  expect(
    screen.getByRole('button', {
      name: 'Armor Class, selected: when using Lunge 8, breakdown',
    }),
  ).toBeVisible();
  expect(
    screen.queryByRole('button', { name: /^Combat Maneuver Bonus, selected/ }),
  ).toBeNull();
  fireEvent.click(lunge);

  fireEvent.click(power);
  expect(
    screen.getByRole('button', {
      name: 'Combat Maneuver Bonus, selected: when using Power Attack +0, breakdown',
    }),
  ).toBeVisible();
  expect(
    screen.queryByRole('button', { name: /^Armor Class, selected/ }),
  ).toBeNull();
  // The routine's switch and the Situation lens stay apart: no toggle here.
  expect(
    within(picker).queryByRole('switch', { name: /Power Attack/ }),
  ).toBeNull();
});

// Item Ability dice (#408).
test('Item Ability dice: flaming reads on the face and in the breakdown, burst dice as a critical-hit note, and Situational dice stay off the face until their Situation is picked, listed under Only when…', () => {
  const sword = representativeWeapon('longsword', 'sword', {
    itemState: {
      enhancement: 1,
      abilities: [
        { catalogEntryId: 'flaming-burst' },
        { catalogEntryId: 'holy' },
        { catalogEntryId: 'bane', choice: 'undead' },
      ],
    },
  });
  const { card } = renderArcher(
    archer(1, [strike], {
      sheetEntries: [sword],
      itemAbilities: ['flaming-burst', 'holy', 'bane'],
    }),
    ['situations', 'attacks'],
  );
  const single = list(card, 'Single attack');
  expect(single).toHaveTextContent('1d8+4');
  expect(single).toHaveTextContent('plus 1d6 fire');
  expect(single).toHaveTextContent('(+1d10 fire on a critical hit)');
  expect(single).not.toHaveTextContent('2d6 vs. undead');
  expect(single).not.toHaveTextContent('2d6 vs. evil');

  const damage = within(single).getByRole('button', {
    name: 'Sword strike single attack: damage 1d8+4, breakdown',
  });
  expect(
    within(damage.parentElement!).getByRole('img', {
      name: 'Situational rules available',
    }),
  ).toBeInTheDocument();
  fireEvent.click(damage);
  const group = screen.getByRole('group', {
    name: 'Sword strike single attack: damage breakdown',
  });
  expect(group).toHaveTextContent(/Flaming burst\s*extra dice\s*\+1d6 fire/);
  expect(group).toHaveTextContent(
    /Flaming burst\s*on a critical hit\s*\+1d10 fire/,
  );
  expect(group).toHaveTextContent('Only when…');
  expect(group).toHaveTextContent(/Bane\s*extra dice\s*\+2d6 vs\. undead/);
  expect(group).toHaveTextContent(
    /vs\. evil.*Holy\s*extra dice\s*\+2d6 vs\. evil/,
  );
  fireEvent.keyDown(document, { key: 'Escape' });

  const picker = screen.getByRole('region', { name: 'See the sheet' });
  fireEvent.click(within(picker).getByRole('button', { name: 'vs. evil' }));
  expect(single).toHaveTextContent('plus 2d6 vs. evil');
  expect(single).not.toHaveTextContent('2d6 vs. undead');
  // Holy changes no total, so the damage has no alternate for it.
  expect(
    within(single).queryByRole('button', { name: /: damage, selected/ }),
  ).toBeNull();
  fireEvent.click(within(picker).getByRole('button', { name: 'vs. undead' }));
  expect(single).toHaveTextContent('plus 2d6 vs. undead');
  expect(
    within(single).getByRole('button', {
      name: 'Sword strike single attack: damage, selected: vs. evil + vs. undead 1d8+6, breakdown',
    }),
  ).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: 'Edit Sword strike' }));
  const preview = within(
    screen.getByRole('dialog', { name: 'Attack routine' }),
  ).getByRole('region', { name: 'As it attacks now' });
  expect(preview).toHaveTextContent(
    /Single attack\s*\+5 \(1d8\+4 plus 1d6 fire plus 2d6 vs\. evil plus 2d6 vs\. undead\/19–20\/×2\) \(\+1d10 fire on a critical hit\)/,
  );
});

// Spell Effects on items (#416): a targeted enhancement reads in the line's
// breakdown as the effect, applied or suppressed by the weapon's own.
const magicWeapon = (onItem?: { entry: string }): CatalogSheetEntry => ({
  id: 'magic-weapon',
  name: 'Magic weapon',
  detail: {
    kind: 'spellEffect',
    lastsOverOneDay: false,
    defaultCasterLevel: 1,
    itemTarget: 'weapon',
  },
  modifiers: [
    {
      target: 'attack',
      bonusType: 'enhancement',
      value: 1,
      condition: { weapon: '$target' },
    },
    {
      target: 'damage',
      bonusType: 'enhancement',
      value: 1,
      condition: { weapon: '$target' },
    },
  ],
  ...(onItem ? { onItem } : {}),
});
// The level 6 fighter with a sword routine and these further entries.
const swordsman = (entries: CatalogSheetEntry[]) =>
  buildSheet({
    scores: { ...defaultAbilityScores, strength: 16, dexterity: 14 },
    levels: Array.from({ length: 6 }, (_, index) => ({
      id: `level-${index + 1}`,
      hp: 10,
      classId: 'fighter' as const,
    })),
    classProficiencies: {
      fighter: [{ category: 'simple' }, { category: 'martial' }],
    },
    sheetEntries: entries,
    attackRoutines: [strike],
  });
const singleAttack = (card: HTMLElement, bonus: string) =>
  within(list(card, 'Single attack')).getByRole('button', {
    name: `Sword strike single attack: attack ${bonus}, breakdown`,
  });
const attackBreakdown = () =>
  screen.getByRole('group', {
    name: 'Sword strike single attack: attack breakdown',
  });

test('magic weapon adds nothing until targeted; on the longsword its +1 is applied in the lines and named in the breakdown, and against a +1 sword it reads under Not applied', () => {
  const sword = representativeWeapon('longsword', 'sword');
  let card = renderAttacks(swordsman([sword, magicWeapon()]));
  expect(singleAttack(card, '+9')).toBeVisible();
  cleanup();

  card = renderAttacks(swordsman([sword, magicWeapon({ entry: 'sword' })]));
  fireEvent.click(singleAttack(card, '+10'));
  expect(attackBreakdown()).toHaveTextContent(
    /Magic weapon\s*enhancement\s*\+1/,
  );
  expect(attackBreakdown()).not.toHaveTextContent('Not applied');
  expect(
    within(list(card, 'Single attack')).getByRole('button', {
      name: 'Sword strike single attack: damage 1d8+4, breakdown',
    }),
  ).toBeVisible();
  cleanup();

  const enhanced = representativeWeapon('longsword', 'sword', {
    itemState: { enhancement: 1 },
  });
  card = renderAttacks(swordsman([enhanced, magicWeapon({ entry: 'sword' })]));
  fireEvent.click(singleAttack(card, '+10'));
  expect(attackBreakdown()).toHaveTextContent(/Not applied.*Magic weapon/);
});
