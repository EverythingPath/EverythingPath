import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type * as NavigationGuard from '~/components/campaign-shell/navigation-guard';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  defaultAbilityScores,
  type AbilityScores,
  type CharacterSheetClassDetail,
  type CharacterSheetInput,
  type Modifier,
  type ResolveOptions,
} from '~/lib/character-sheet';
import { characterSpellsPath } from '~/lib/campaign-routes';
import { findReviewedClassCasting } from '~/lib/character-sheet-casting-tables';
import { BreakdownResolverProvider } from './breakdown-resolver';
import { CharacterSheetPage } from './character-sheet-page';
import {
  buildSheet,
  characterId,
  emptyOwnerCandidates,
  type Adjustment,
  type CatalogSheetEntry,
  type Level,
} from './character-sheet-test-fixture';
import { buildCharacterSheetView } from './character-sheet-view-model';
import { buildCastingSheet } from './casting-features-test-fixture';
import { buildSpellSheet, spells } from './character-spells-test-fixture';
import { SpellcastingBlock } from './spellcasting-block';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';

// Separate Spellcastings (#307): one summary line per casting class with its
// caster level, concentration and per-day strip; its numbers and allowance
// table on request; every number explained by the shared breakdown. Expected
// values are the CRB class tables and bonus-spell table, not the rendering.

let snapshot: CharacterSheetSnapshot | null | undefined;
const maintenance = vi.fn<() => MigrationMaintenance>();

vi.mock(
  './use-character-move',
  () => import('./use-character-move-test-double'),
);
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
  useMutation: () => () => new Promise(() => undefined),
}));
vi.mock(
  '~/components/campaign-shell/navigation-guard',
  async (importOriginal) => {
    const actual = await importOriginal<typeof NavigationGuard>();
    return {
      ...actual,
      GuardedLink: ({
        href,
        children,
        ...props
      }: ComponentProps<'a'> & { href: string }) => (
        <a href={href} {...props}>
          {children}
        </a>
      ),
    };
  },
);

beforeEach(() => {
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
  snapshot = undefined;
});

type Situation = NonNullable<ResolveOptions['situations']>[number];

// The block alone, resolving Situation previews with the public calculation
// the controller uses, from the same input the snapshot was calculated from.
function blockOf(input: CharacterSheetInput) {
  const calculated = calculateCharacterSheet(input);
  return (
    <BreakdownResolverProvider
      previewSituation={(situation: Situation | readonly Situation[]) =>
        calculateCharacterSheet(input, {
          situations:
            typeof situation === 'string' ||
            'local' in situation ||
            'option' in situation
              ? [situation]
              : situation,
        })
      }
      adjustments={[]}
      spellcastings={calculated.spellcastings}
    >
      <SpellcastingBlock
        characterName="Kesh"
        spellcastings={calculated.spellcastings}
        unresolved={calculated.spellcastingUnresolved}
      />
    </BreakdownResolverProvider>
  );
}
const inputOf = (sheet: CharacterSheetSnapshot): CharacterSheetInput => ({
  ...sheet,
  characterKind: sheet.character.kind,
});
function renderBlock(sheet: CharacterSheetSnapshot) {
  const view = render(blockOf(inputOf(sheet)));
  return {
    show: (next: CharacterSheetSnapshot) =>
      view.rerender(blockOf(inputOf(next))),
  };
}

// A class the representative catalog lacks, with its reviewed casting data.
function classInput(
  classTag: string,
  name: string,
  levels: number,
  scores: Partial<AbilityScores> = {},
): CharacterSheetInput {
  const abilities = { ...defaultAbilityScores, ...scores };
  return {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      ...Array.from({ length: levels }, (_, index) => ({
        _id: `${classTag}-${index}`,
        kind: 'classLevel' as const,
        active: true as const,
        state: {
          kind: 'classLevel' as const,
          classEntryId: classTag,
          position: index + 1,
          hpGained: 8,
        },
      })),
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base' as const,
          value: abilities[ability],
        })),
      },
      {
        _id: classTag,
        name,
        ruleIdentity: `class:${classTag}`,
        modifiers: [],
        detail: {
          kind: 'class',
          classKind: 'base',
          hitDie: 8,
          bab: 'half',
          saves: { fort: 'poor', ref: 'poor', will: 'good' },
          skillRanksPerLevel: 2,
          casting: findReviewedClassCasting(classTag),
        } as CharacterSheetClassDetail,
      },
    ],
  };
}

const scholars: AbilityScores = {
  ...defaultAbilityScores,
  intelligence: 18,
  wisdom: 18,
};
const wizardAndCleric: Level[] = [
  { id: 'wizard-1', hp: 6, classId: 'wizard' },
  { id: 'cleric-1', hp: 8, classId: 'cleric' },
];
const foxsCunning: CatalogSheetEntry = {
  id: 'fox',
  name: "Fox's cunning",
  detail: {
    kind: 'spellEffect',
    lastsOverOneDay: false,
    defaultCasterLevel: 3,
  },
  modifiers: [{ target: 'ability.int', bonusType: 'enhancement', value: 4 }],
};
const wizardOnly = (modifier: Modifier): Modifier => ({
  ...modifier,
  condition: { ...modifier.condition, castingClass: 'wizard' },
});
const spellFocus: Adjustment = {
  id: 'focus',
  name: 'Spell Focus',
  modifiers: [
    wizardOnly({
      target: 'spellDC',
      bonusType: 'untyped',
      value: 1,
      condition: { school: 'evocation' },
    }),
  ],
};
const greaterRod: Adjustment = {
  id: 'greater-rod',
  name: 'Greater rod',
  modifiers: [
    wizardOnly({ target: 'spellDC', bonusType: 'enhancement', value: 2 }),
  ],
};
const lesserRod: Adjustment = {
  id: 'lesser-rod',
  name: 'Lesser rod',
  modifiers: [
    wizardOnly({ target: 'spellDC', bonusType: 'enhancement', value: 1 }),
  ],
};
const combatCasting: Adjustment = {
  id: 'combat',
  name: 'Combat Casting',
  modifiers: [
    {
      target: 'concentration',
      bonusType: 'untyped',
      value: 4,
      condition: { situation: { local: 'casting defensively' } },
    },
  ],
};
const unsupportedKnack: Adjustment = {
  id: 'knack',
  name: 'Magical Knack',
  modifiers: [
    wizardOnly({
      target: 'casterLevel',
      bonusType: 'trait',
      value: { formula: '@missing' },
    }),
  ],
};

const summary = (name: string) =>
  screen.getByRole('button', { name: `View ${name} spellcasting` });
const numbers = (name: string) =>
  screen.getByRole('region', { name: `${name} spellcasting` });
const queryNumbers = (name: string) =>
  screen.queryByRole('region', { name: `${name} spellcasting` });
const table = (name: string) =>
  screen.getByRole('table', { name: `${name} spell allowances` });
const levelRow = (name: string, level: string) =>
  within(table(name)).getByRole('rowheader', { name: level }).closest('tr')!;
const trigger = (name: string) =>
  screen.getByRole('button', { name: new RegExp(`^${name} .+, breakdown$`) });
const panel = (label: string) =>
  screen.getByRole('group', { name: `${label} breakdown` });
const line = (label: string, text: string) =>
  within(panel(label))
    .getByText(text, { selector: 'span' })
    .closest('li') as HTMLElement;
const figure = (name: string, label: string) =>
  within(numbers(name)).getByText(label).nextElementSibling as HTMLElement;

test('a Wizard 1 / Cleric 1 with Intelligence and Wisdom 18 has two independent lines, each opening to its own casting level 1, caster level 1, concentration +5, DC 15 and two 1st-level spells', () => {
  renderBlock(buildSheet({ scores: scholars, levels: wizardAndCleric }));
  expect(screen.getByRole('region', { name: 'Spellcasting' })).toBeVisible();
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  expect(summary('Wizard')).toHaveAttribute('aria-expanded', 'false');
  expect(queryNumbers('Wizard')).not.toBeInTheDocument();

  for (const [name, record] of [
    ['Wizard', 'Spellbook'],
    ['Cleric', 'Whole list'],
  ] as const) {
    const row = summary(name).closest('li')!;
    expect(within(row).getByText(record)).toBeVisible();
    expect(
      within(row).getByRole('button', {
        name: `${name} caster level 1, breakdown`,
      }),
    ).toBeVisible();
    expect(
      within(row).getByRole('button', {
        name: `${name} concentration +5, breakdown`,
      }),
    ).toBeVisible();
    expect(within(row).getByText('Per day').parentElement).toHaveTextContent(
      /^Per day0At will·1st2$/,
    );

    fireEvent.click(summary(name));
    expect(summary(name)).toHaveAttribute('aria-expanded', 'true');
    expect(summary(name)).toHaveAttribute('aria-controls', numbers(name).id);
    expect(figure(name, 'Casting level')).toHaveTextContent('1');
    expect(figure(name, 'Caster level')).toHaveTextContent('1');
    expect(figure(name, 'Concentration')).toHaveTextContent('+5');
    // CRB bonus spells: a score of 18 gives one extra 1st-level spell.
    const first = levelRow(name, '1st');
    expect(first).toHaveTextContent('2');
    expect(within(first).getByText('1 base + 1 bonus')).toBeVisible();
    expect(
      within(first).getByRole('button', {
        name: `${name} 1st-level save DC 15, breakdown`,
      }),
    ).toBeVisible();
    expect(within(levelRow(name, '0')).getByText('At will')).toBeVisible();
    expect(
      within(table(name)).queryByRole('rowheader', { name: '2nd' }),
    ).not.toBeInTheDocument();
    expect(within(table(name)).getAllByRole('columnheader')).toHaveLength(3);
  }
  expect(figure('Wizard', 'Casting ability')).toHaveTextContent(
    'IntelligenceBonus spells use permanent Intelligence.',
  );
  expect(figure('Cleric', 'Casting ability')).toHaveTextContent('Wisdom');
  expect(
    screen.getByRole('region', { name: 'Spellcasting' }),
  ).not.toHaveTextContent(/tableLevel|catalog|wizard:|cleric:/);
});

test('a short Intelligence +4 Spell Effect raises Wizard concentration and DC by +2 in the next snapshot, leaves its per-day allowance to the permanent score, and leaves the Cleric alone', () => {
  const before = buildSheet({ scores: scholars, levels: wizardAndCleric });
  const view = renderBlock(before);
  fireEvent.click(summary('Wizard'));
  fireEvent.click(summary('Cleric'));
  view.show(
    buildSheet({
      scores: scholars,
      levels: wizardAndCleric,
      sheetEntries: [foxsCunning],
    }),
  );
  expect(
    screen.getByRole('button', { name: 'Wizard concentration +7, breakdown' }),
  ).toBeVisible();
  expect(figure('Wizard', 'Concentration')).toHaveTextContent('+7');
  expect(
    within(levelRow('Wizard', '1st')).getByRole('button', {
      name: 'Wizard 1st-level save DC 17, breakdown',
    }),
  ).toBeVisible();
  expect(
    within(levelRow('Wizard', '1st')).getByText('1 base + 1 bonus'),
  ).toBeVisible();
  expect(summary('Wizard').closest('li')).toHaveTextContent('1st2');
  expect(
    screen.getByRole('button', { name: 'Cleric concentration +5, breakdown' }),
  ).toBeVisible();
  expect(
    within(levelRow('Cleric', '1st')).getByRole('button', {
      name: 'Cleric 1st-level save DC 15, breakdown',
    }),
  ).toBeVisible();
});

test('concentration and DC breakdowns name their class-level and ability contributions, what stacking set aside, the school a bonus is confined to and the Situation preview, and Escape returns focus to the number', () => {
  renderBlock(
    buildSheet({
      scores: scholars,
      levels: wizardAndCleric,
      adjustments: [spellFocus, greaterRod, lesserRod, combatCasting],
    }),
  );
  const concentration = trigger('Wizard concentration');
  expect(concentration).toHaveAccessibleName(
    'Wizard concentration +5, breakdown',
  );
  fireEvent.click(concentration);
  expect(concentration).toHaveAttribute('aria-expanded', 'true');
  expect(line('Wizard concentration', 'Caster level')).toHaveTextContent('+1');
  expect(
    line('Wizard concentration', 'Casting ability modifier'),
  ).toHaveTextContent('+4');
  const defensively = within(panel('Wizard concentration'))
    .getByText('casting defensively')
    .closest('li')!;
  expect(defensively).toHaveTextContent('becomes +9');
  expect(within(defensively).getByText('Combat Casting')).toBeVisible();
  fireEvent.keyDown(panel('Wizard concentration'), { key: 'Escape' });
  expect(
    screen.queryByRole('group', { name: 'Wizard concentration breakdown' }),
  ).not.toBeInTheDocument();
  expect(concentration).toHaveFocus();

  fireEvent.click(summary('Wizard'));
  const first = levelRow('Wizard', '1st');
  // 10 + 1 + 4 + the greater rod's +2; the lesser rod is set aside.
  const dc = within(first).getByRole('button', {
    name: 'Wizard 1st-level save DC 17, breakdown',
  });
  fireEvent.click(dc);
  const label = 'Wizard 1st-level save DC';
  expect(line(label, 'Spell level')).toHaveTextContent('+11');
  expect(line(label, 'Casting ability modifier')).toHaveTextContent('+4');
  expect(line(label, 'Greater rod')).toHaveTextContent('enhancement');
  expect(line(label, 'Greater rod')).toHaveTextContent('Wizard spells');
  expect(line(label, 'Lesser rod')).toHaveTextContent(
    'A higher bonus of this type applies. (Greater rod)',
  );
  expect(within(panel(label)).queryByText('Waiting')).not.toBeInTheDocument();
  // The Evocation-only bonus belongs to another number: shown apart, by scope.
  expect(within(panel(label)).getByText('Outside this scope')).toBeVisible();
  expect(line(label, 'Spell Focus')).toHaveTextContent(
    'only for Wizard Evocation spells',
  );
  expect(dc).toHaveTextContent('17');
  fireEvent.keyDown(panel(label), { key: 'Escape' });
  expect(dc).toHaveFocus();

  const school = within(first).getByRole('button', {
    name: 'Wizard 1st-level Evocation save DC 18, breakdown',
  });
  fireEvent.click(school);
  expect(
    line('Wizard 1st-level Evocation save DC', 'Spell Focus'),
  ).toHaveTextContent('+1');
  expect(
    line('Wizard 1st-level Evocation save DC', 'Spell Focus'),
  ).toHaveTextContent('Wizard Evocation spells');
  expect(
    within(panel('Wizard 1st-level Evocation save DC')).queryByText('Not now'),
  ).not.toBeInTheDocument();
});

test('a school-conditioned Wizard DC adds an Evocation column with its own total while the ordinary Wizard and Cleric DCs keep theirs', () => {
  renderBlock(
    buildSheet({
      scores: scholars,
      levels: wizardAndCleric,
      adjustments: [spellFocus],
    }),
  );
  fireEvent.click(summary('Wizard'));
  fireEvent.click(summary('Cleric'));
  expect(
    within(table('Wizard'))
      .getAllByRole('columnheader')
      .map((header) => header.textContent),
  ).toEqual(['Spell level', 'Per day', 'Save DC', 'Evocation DC']);
  const first = levelRow('Wizard', '1st');
  expect(
    within(first).getByRole('button', {
      name: 'Wizard 1st-level save DC 15, breakdown',
    }),
  ).toBeVisible();
  expect(
    within(first).getByRole('button', {
      name: 'Wizard 1st-level Evocation save DC 16, breakdown',
    }),
  ).toBeVisible();
  expect(
    within(levelRow('Wizard', '0')).getByRole('button', {
      name: 'Wizard 0-level Evocation save DC 15, breakdown',
    }),
  ).toBeVisible();
  expect(
    within(table('Cleric'))
      .getAllByRole('columnheader')
      .map((header) => header.textContent),
  ).toEqual(['Spell level', 'Per day', 'Save DC']);
  expect(
    within(levelRow('Cleric', '1st')).getByRole('button', {
      name: 'Cleric 1st-level save DC 15, breakdown',
    }),
  ).toBeVisible();
});

test('a casting scope names the class from its Spellcasting and names its school without showing internal tags', () => {
  const input = classInput('summonerUnchained', 'Unchained summoner', 1, {
    charisma: 18,
  });
  input.entries = [
    ...input.entries,
    {
      _id: 'summoner-focus-row',
      active: true,
      kind: 'manual',
      catalogEntryId: 'summoner-focus',
      state: { kind: 'manual' },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'summoner-focus',
      name: 'Spell Focus',
      ruleIdentity: 'summoner-focus',
      modifiers: [
        {
          target: 'spellDC',
          bonusType: 'untyped',
          value: 1,
          condition: { castingClass: 'summonerUnchained', school: 'evocation' },
        },
      ],
    },
  ];
  render(blockOf(input));
  fireEvent.click(summary('Unchained summoner'));
  fireEvent.click(trigger('Unchained summoner 1st-level Evocation save DC'));
  const explanation = panel('Unchained summoner 1st-level Evocation save DC');
  expect(explanation).toHaveTextContent('Unchained summoner Evocation spells');
  expect(explanation).not.toHaveTextContent('summonerUnchained');
});

test('a failed Evocation formula marks only its school DC incomplete while ordinary DCs and concentration remain usable', () => {
  renderBlock(
    buildSheet({
      scores: scholars,
      levels: wizardAndCleric,
      adjustments: [
        {
          id: 'unsupported-focus',
          name: 'Spell Focus',
          modifiers: [
            wizardOnly({
              target: 'spellDC',
              bonusType: 'untyped',
              value: { formula: '@missing' },
              condition: { school: 'evocation' },
            }),
          ],
        },
      ],
    }),
  );
  fireEvent.click(summary('Wizard'));
  fireEvent.click(summary('Cleric'));
  expect(
    within(levelRow('Wizard', '1st')).getByRole('button', {
      name: 'Wizard 1st-level save DC 15, breakdown',
    }),
  ).toBeVisible();
  const evocation = within(levelRow('Wizard', '1st')).getByRole('button', {
    name: 'Wizard 1st-level Evocation save DC not complete, breakdown',
  });
  expect(evocation).toHaveTextContent('not complete');
  expect(evocation).not.toHaveTextContent('15');
  expect(
    within(levelRow('Cleric', '1st')).getByRole('button', {
      name: 'Cleric 1st-level save DC 15, breakdown',
    }),
  ).toBeVisible();
  expect(
    within(table('Cleric')).queryByRole('columnheader', {
      name: 'Evocation save DC',
    }),
  ).not.toBeInTheDocument();
  expect(
    within(summary('Wizard').closest('li')!).getAllByRole('button', {
      name: 'Wizard concentration +5, breakdown',
    })[0],
  ).toBeVisible();
});

test('a Character without a casting class has no spellcasting and no table; a Class Level without a class is not complete rather than absent', () => {
  const view = renderBlock(
    buildSheet({ levels: [{ id: 'fighter-1', hp: 10, classId: 'fighter' }] }),
  );
  const section = screen.getByRole('region', { name: 'Spellcasting' });
  expect(within(section).getByText('Kesh has no Spellcasting.')).toBeVisible();
  expect(within(section).queryByRole('table')).not.toBeInTheDocument();
  expect(within(section).queryByRole('button')).not.toBeInTheDocument();

  view.show(buildSheet());
  expect(
    within(screen.getByRole('region', { name: 'Spellcasting' })).getByText(
      'Not complete: a Class Level has no class yet.',
    ),
  ).toBeVisible();
  expect(
    screen.queryByText('Kesh has no Spellcasting.'),
  ).not.toBeInTheDocument();
});

test('a paladin before 4th has no spells yet and no caster level, a paladin at 4th has literally zero 1st-level spells per day, and at-will, known and prepared counts stay apart from zero', () => {
  // CRB paladin: spells from 4th level, 0 per day at 1st; caster level −3.
  const view = render(blockOf(classInput('paladin', 'Paladin', 3)));
  const row = summary('Paladin').closest('li')!;
  expect(within(row).getByText('No spells yet')).toBeVisible();
  expect(
    within(row).getByText('Caster level not available'),
  ).toBeInTheDocument();
  expect(
    within(row).getByText('Concentration not available'),
  ).toBeInTheDocument();
  expect(
    within(row).queryByRole('button', { name: /breakdown/ }),
  ).not.toBeInTheDocument();
  fireEvent.click(summary('Paladin'));
  expect(figure('Paladin', 'Casting level')).toHaveTextContent('3');
  expect(figure('Paladin', 'Caster level')).toHaveTextContent('Not available');
  expect(figure('Paladin', 'Caster level')).not.toHaveTextContent(/\d/);
  expect(within(numbers('Paladin')).getByText(/^No spells yet/)).toBeVisible();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();

  view.rerender(blockOf(classInput('paladin', 'Paladin', 4)));
  expect(figure('Paladin', 'Casting level')).toHaveTextContent('4');
  expect(figure('Paladin', 'Caster level')).toHaveTextContent('1');
  const first = levelRow('Paladin', '1st');
  expect(within(first).getByText('0')).toBeVisible();
  expect(within(first).queryByText('At will')).not.toBeInTheDocument();
  expect(within(table('Paladin')).getAllByRole('columnheader')).toHaveLength(3);
  expect(summary('Paladin').closest('li')).toHaveTextContent('Per day1st0');

  // CRB sorcerer 1: cantrips at will with 4 known; 3 1st-level spells, 2 known.
  view.rerender(blockOf(classInput('sorcerer', 'Sorcerer', 1)));
  fireEvent.click(summary('Sorcerer'));
  expect(
    within(table('Sorcerer'))
      .getAllByRole('columnheader')
      .map((header) => header.textContent),
  ).toEqual(['Spell level', 'Per day', 'Known', 'Save DC']);
  expect(within(levelRow('Sorcerer', '0')).getByText('At will')).toBeVisible();
  expect(levelRow('Sorcerer', '0')).toHaveTextContent('4');
  expect(levelRow('Sorcerer', '1st')).toHaveTextContent(/^1st32/);
  expect(summary('Sorcerer').closest('li')).toHaveTextContent('Spells known');

  // CRB adept 1: three 0-level spells per day and no cantrips feature.
  view.rerender(blockOf(classInput('adept', 'Adept', 1)));
  fireEvent.click(summary('Adept'));
  expect(within(levelRow('Adept', '0')).getByText('3')).toBeVisible();
  expect(screen.queryByText('At will')).not.toBeInTheDocument();

  // APG arcanist 1: 2 prepared 1st-level, 2 per day plus one bonus for Int 18.
  view.rerender(
    blockOf(classInput('arcanist', 'Arcanist', 1, { intelligence: 18 })),
  );
  fireEvent.click(summary('Arcanist'));
  expect(
    within(table('Arcanist'))
      .getAllByRole('columnheader')
      .map((header) => header.textContent),
  ).toEqual(['Spell level', 'Per day', 'Prepared', 'Save DC']);
  const arcanistFirst = levelRow('Arcanist', '1st');
  expect(within(arcanistFirst).getByText('2 base + 1 bonus')).toBeVisible();
  expect(arcanistFirst).toHaveTextContent(/^1st32 base \+ 1 bonus2/);
  expect(within(levelRow('Arcanist', '0')).getByText('At will')).toBeVisible();
  expect(within(levelRow('Arcanist', '0')).getByText('4')).toBeVisible();
});

test('an incomplete Evocation DC never shows a partial total in its bright-light Situation preview', () => {
  renderBlock(
    buildSheet({
      scores: scholars,
      levels: [1, 2, 3].map((position) => ({
        id: `wizard-${position}`,
        hp: 6,
        classId: 'wizard',
      })),
      adjustments: [
        {
          id: 'evocation',
          name: 'Evocation focus',
          modifiers: [
            wizardOnly({
              target: 'spellDC',
              bonusType: 'untyped',
              value: { formula: '@missing' },
              condition: { school: 'evocation' },
            }),
            wizardOnly({
              target: 'spellDC',
              bonusType: 'untyped',
              value: 1,
              condition: {
                school: 'evocation',
                situation: { local: 'in bright light' },
              },
            }),
          ],
        },
      ],
    }),
  );
  fireEvent.click(summary('Wizard'));
  const first = levelRow('Wizard', '1st');
  expect(
    within(first).getByRole('button', {
      name: 'Wizard 1st-level save DC 15, breakdown',
    }),
  ).toBeVisible();
  fireEvent.click(
    within(first).getByRole('button', {
      name: 'Wizard 1st-level Evocation save DC not complete, breakdown',
    }),
  );
  const explanation = panel('Wizard 1st-level Evocation save DC');
  expect(within(explanation).getByText('in bright light')).toBeVisible();
  expect(explanation).not.toHaveTextContent('becomes');
});

test('a caster-level failure in bright light omits partial Situation totals for caster level and its dependent DC', () => {
  const situation = { local: 'in bright light' };
  renderBlock(
    buildSheet({
      scores: scholars,
      levels: [1, 2, 3].map((position) => ({
        id: `wizard-${position}`,
        hp: 6,
        classId: 'wizard',
      })),
      adjustments: [
        {
          id: 'bright-light',
          name: 'Bright-light casting',
          modifiers: [
            wizardOnly({
              target: 'casterLevel',
              bonusType: 'untyped',
              value: { formula: '@missing' },
              condition: { situation },
            }),
            wizardOnly({
              target: 'casterLevel',
              bonusType: 'untyped',
              value: 1,
              condition: { situation },
            }),
            wizardOnly({
              target: 'spellDC',
              bonusType: 'untyped',
              value: { formula: '@casterLevel.wizard' },
              condition: { situation },
            }),
          ],
        },
      ],
    }),
  );
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Wizard caster level 3, breakdown',
    }),
  );
  const casterLevel = panel('Wizard caster level');
  expect(within(casterLevel).getByText('in bright light')).toBeVisible();
  expect(casterLevel).not.toHaveTextContent('becomes');
  fireEvent.keyDown(casterLevel, { key: 'Escape' });

  fireEvent.click(summary('Wizard'));
  fireEvent.click(
    within(levelRow('Wizard', '1st')).getByRole('button', {
      name: 'Wizard 1st-level save DC 15, breakdown',
    }),
  );
  const dc = panel('Wizard 1st-level save DC');
  expect(within(dc).getByText('in bright light')).toBeVisible();
  expect(dc).not.toHaveTextContent('becomes');
});

test('an unsupported caster-level formula leaves only that class not complete, with no invented caster level, and a class that disappears takes only its own disclosure', () => {
  const view = renderBlock(
    buildSheet({
      scores: scholars,
      levels: wizardAndCleric,
      adjustments: [unsupportedKnack],
    }),
  );
  const wizard = summary('Wizard').closest('li')!;
  expect(
    within(wizard).getByText('Not complete: caster level, concentration.'),
  ).toBeVisible();
  const casterLevel = within(wizard).getByRole('button', {
    name: 'Wizard caster level not complete, breakdown',
  });
  expect(casterLevel).toHaveTextContent('not complete');
  expect(casterLevel).not.toHaveTextContent(/\d/);
  expect(within(wizard).getByText('Concentration not available')).toBeVisible();
  expect(
    within(wizard).queryByRole('button', {
      name: 'Wizard concentration +5, breakdown',
    }),
  ).not.toBeInTheDocument();
  const cleric = summary('Cleric').closest('li')!;
  expect(within(cleric).queryByText(/Not complete/)).not.toBeInTheDocument();
  expect(
    within(cleric).getByRole('button', {
      name: 'Cleric caster level 1, breakdown',
    }),
  ).toBeVisible();

  fireEvent.click(summary('Wizard'));
  fireEvent.click(summary('Cleric'));
  expect(numbers('Wizard')).toBeVisible();
  expect(numbers('Cleric')).toBeVisible();
  view.show(
    buildSheet({
      scores: scholars,
      levels: [wizardAndCleric[0]!],
      adjustments: [unsupportedKnack],
    }),
  );
  expect(numbers('Wizard')).toBeVisible();
  expect(summary('Wizard')).toHaveAttribute('aria-expanded', 'true');
  expect(queryNumbers('Cleric')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'View Cleric spellcasting' }),
  ).not.toBeInTheDocument();
});

test('the Full sheet carries the Spellcasting section with its class-local incompleteness while the rest of the sheet stays usable', () => {
  snapshot = buildSheet({
    scores: scholars,
    levels: wizardAndCleric,
    adjustments: [unsupportedKnack],
  });
  render(
    <CharacterSheetPage
      organizationId="org"
      characterId={characterId}
      back={{ href: '/campaigns/campaign-1/characters', label: 'Characters' }}
      campaignName="Ironfang"
    />,
  );
  const section = screen.getByRole('region', { name: 'Spellcasting' });
  expect(
    within(section).getByText('Not complete: caster level, concentration.'),
  ).toBeVisible();
  expect(
    within(section).getByRole('button', {
      name: 'Cleric caster level 1, breakdown',
    }),
  ).toBeVisible();
  expect(screen.getByRole('textbox', { name: 'Intelligence' })).toBeEnabled();
  fireEvent.click(summary('Wizard'));
  expect(
    within(section).getByRole('region', { name: 'Wizard spellcasting' }),
  ).toBeVisible();
});

// #315: each line counts its recorded Spells and open warnings and links to
// its Spells page with the sheet's origin; Spells under no Spellcasting keep
// the same group as on the Spells page, even with no Spellcasting left.
const campaignOrigin = {
  href: '/campaigns/campaign-1/characters',
  organization: { kind: 'organization', id: 'org' },
} as const;
const spellWrites = {
  record: vi.fn(),
  editLevel: vi.fn(),
  remove: vi.fn(() => new Promise<boolean>(() => undefined)),
  statusForSpell: () => ({ kind: 'idle' as const }),
  statusForEntry: () => ({ kind: 'idle' as const }),
  hasRemoteChange: false,
  dismissRemoteChange: vi.fn(),
};
const warningControls = {
  accept: vi.fn(),
  reopen: vi.fn(),
  statusFor: () => ({ kind: 'idle' as const }),
  hasRemoteChange: false,
  dismissRemoteChange: vi.fn(),
};
function renderSheetSpells(sheet: CharacterSheetSnapshot) {
  const view = buildCharacterSheetView(sheet);
  render(
    <BreakdownResolverProvider
      previewSituation={() => null}
      adjustments={[]}
      spellcastings={view.calculated.spellcastings}
    >
      <SpellcastingBlock
        characterName={sheet.character.name}
        spellcastings={view.calculated.spellcastings}
        unresolved={view.calculated.spellcastingUnresolved}
        spells={{
          characterId,
          origin: campaignOrigin,
          collections: view.calculated.spellCollections,
          warnings: view.warnings,
          warningController: warningControls,
          writes: spellWrites,
        }}
      />
    </BreakdownResolverProvider>,
  );
  return within(screen.getByRole('region', { name: 'Spellcasting' }));
}

test('sheet summaries name each book collection from its effective casting', () => {
  renderSheetSpells(buildSpellSheet({ classes: ['alchemist', 'witch'] }));
  expect(
    within(summary('Alchemist').closest('li') as HTMLElement).getByText(
      'Formula book',
    ),
  ).toBeVisible();
  expect(
    within(summary('Witch').closest('li') as HTMLElement).getByText('Familiar'),
  ).toBeVisible();
});

test('the empty sheet names the Character who has no Spellcasting', () => {
  const sheet = buildSpellSheet({ classes: ['fighter'] });
  const section = renderSheetSpells(sheet);
  expect(
    section.getByText(`${sheet.character.name} has no Spellcasting.`),
  ).toBeVisible();
});

test('each line counts its recorded Spells and open warnings and opens its own Spells page with the sheet’s origin; a whole-list caster browses its list', () => {
  const section = renderSheetSpells(
    buildSpellSheet({
      classes: ['wizard', 'cleric'],
      recorded: [
        { id: 'row-shield', spell: spells.shield, castingClassId: 'wizard' },
        {
          id: 'row-fireball',
          spell: spells.fireball,
          castingClassId: 'wizard',
        },
      ],
    }),
  );
  const wizardLine = within(summary('Wizard').closest('li') as HTMLElement);
  expect(wizardLine.getByText('2 in spellbook')).toBeVisible();
  expect(
    wizardLine.getByRole('link', { name: 'Open spells for Wizard' }),
  ).toHaveAttribute(
    'href',
    characterSpellsPath(characterId, campaignOrigin, 'wizard'),
  );
  expect(
    wizardLine.getByRole('link', { name: '1 open Wizard Spell warning' }),
  ).toHaveAttribute(
    'href',
    characterSpellsPath(characterId, campaignOrigin, 'wizard'),
  );
  expect(
    section.getByRole('link', { name: 'Browse the cleric list' }),
  ).toHaveAttribute(
    'href',
    characterSpellsPath(characterId, campaignOrigin, 'cleric'),
  );
  expect(
    section.queryByRole('region', { name: 'Not under any Spellcasting' }),
  ).toBeNull();
});

test('the sheet keeps Spells under no Spellcasting with their class, warning and Remove when no Spellcasting is left', () => {
  const section = renderSheetSpells(
    buildSpellSheet({
      classes: ['fighter'],
      recorded: [
        { id: 'row-shield', spell: spells.shield, castingClassId: 'wizard' },
      ],
    }),
  );
  expect(section.getByText('Kesh has no Spellcasting.')).toBeVisible();
  const orphans = within(
    section.getByRole('region', { name: 'Not under any Spellcasting' }),
  );
  expect(orphans.getByText('recorded for Wizard')).toBeVisible();
  expect(
    orphans.getByText('Shield is not under any Spellcasting.'),
  ).toBeVisible();
  fireEvent.click(orphans.getByRole('button', { name: 'Accept' }));
  expect(warningControls.accept).toHaveBeenCalledWith(
    expect.objectContaining({ check: 'spellOrphaned' }),
  );
  fireEvent.click(orphans.getByRole('button', { name: 'Remove Shield' }));
  expect(spellWrites.remove).toHaveBeenCalledWith({
    entryId: 'row-shield',
    name: 'Shield',
  });
});

// #415: a domain's extra slot is in the per-day total and its composition,
// and the line counts the Granted Spells beside the recorded count.
test('a cleric with the Fire domain has one extra 1st-level spell per day, says so in the composition, and counts its Granted Spells and its open domain choice', () => {
  const repeat = (identity: string, count: number) =>
    Array.from({ length: count }, () => identity);
  const section = renderSheetSpells(
    buildCastingSheet({
      levels: repeat('cleric', 3),
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
  const line = within(summary('Cleric').closest('li') as HTMLElement);
  // CRB cleric 3 with Wisdom 10: 2 first-level spells, plus the domain slot.
  expect(line.getByText('Per day').parentElement).toHaveTextContent(
    /^Per day0At will·1st3·2nd2$/,
  );
  expect(line.getByText('2 granted')).toBeVisible();
  expect(
    line.getByRole('link', { name: '1 open Cleric Spell warning' }),
  ).toBeVisible();
  fireEvent.click(summary('Cleric'));
  expect(
    within(levelRow('Cleric', '1st')).getByText('2 base + 1 extra'),
  ).toBeVisible();
  expect(
    within(levelRow('Cleric', '2nd')).getByText('1 base + 1 extra'),
  ).toBeVisible();
  expect(section.queryByText(/castingAdvance|oppositionSchools/)).toBeNull();
});

// #422: a Spellcasting an Archetype choice still decides shows only what
// waits, and keeps every value the choice does not touch. Skirmisher (APG
// p. 128) against Dandy (UI p. 41) on a ranger leaves its presence open.
const rangerWithRemovalConflict = () =>
  buildCastingSheet({
    levels: Array.from({ length: 8 }, () => 'ranger'),
    scores: { ...defaultAbilityScores, wisdom: 12, charisma: 14 },
    archetypes: [{ key: 'ranger-skirmisher' }, { key: 'ranger-dandy' }],
    recorded: [
      { id: 'row-mage-armor', spell: 'mage-armor', castingClassId: 'ranger' },
      { id: 'row-fly', spell: 'fly', castingClassId: 'ranger' },
    ],
  });

test('a Spellcasting whose presence waits for an Archetype choice reads one waiting line linking to the choice, its heading waits too, and its recorded Spells stay counted under it with their Spells link', () => {
  const section = renderSheetSpells(rangerWithRemovalConflict());
  const line = within(summary('Ranger').closest('li') as HTMLElement);
  const waiting = line.getByRole('link', {
    name: 'Waiting for a spellcasting choice for Ranger, in Archetypes',
  });
  expect(waiting).toHaveAttribute('href', '#archetype-casting-ranger');
  expect(waiting).toHaveClass('text-sky-300');
  expect(line.getByText('Waiting for a choice')).toBeVisible();
  expect(line.queryByText('CL')).toBeNull();
  expect(line.queryByText('Conc')).toBeNull();
  expect(line.queryByText('Per day')).toBeNull();
  expect(line.queryByText(/Not complete/)).toBeNull();
  expect(line.queryByText(/—/)).toBeNull();
  expect(line.getByText('2 recorded')).toBeVisible();
  expect(
    line.getByRole('link', { name: 'Open spells for Ranger' }),
  ).toHaveAttribute(
    'href',
    characterSpellsPath(characterId, campaignOrigin, 'ranger'),
  );
  expect(section.queryByText('Not under any Spellcasting')).toBeNull();
  // The waiting line is a touch target on the phone.
  expect(waiting).toHaveClass('min-h-11', 'md:min-h-9');
});
