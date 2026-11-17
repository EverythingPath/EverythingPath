import { render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { expect, test, vi } from 'vitest';
import { BreakdownResolverProvider } from './breakdown-resolver';
import { buildSheet } from './character-sheet-test-fixture';
import { DefensesBlock } from './defenses-block';

type Resistances = NonNullable<
  ComponentProps<typeof DefensesBlock>['resistances']
>;
type DamageReduction = Resistances['damageReduction'];
type SpellResistanceStatistic = Resistances['spellResistance'];

// rotation-2 (GLOSSARY: Rule value): damage reduction and spell resistance
// read in Defenses. Every line is listed, the one that applies marked; a
// Barbarian 10 Mad Dog has DR 2/— from both its lines (highest per bypass),
// and the Robe of the Archmagi's SR 18 waits on its Situation.
const none: DamageReduction = { values: [], lines: [], conditional: [] };
const noResistance: SpellResistanceStatistic = {
  value: null,
  lines: [],
  conditional: [],
};
const line = (name: string, value: number | null, applies: boolean) => ({
  entryId: name,
  name,
  ruleValueIndex: 0,
  value,
  applies,
});

function renderDefenses(
  damageReduction: DamageReduction,
  spellResistance: SpellResistanceStatistic,
) {
  const sheet = buildSheet({});
  render(
    <BreakdownResolverProvider
      previewSituation={() => null}
      adjustments={[]}
      spellcastings={[]}
    >
      <DefensesBlock
        statistics={sheet.calculated.derivedStatistics}
        resistances={{ damageReduction, spellResistance }}
      />
    </BreakdownResolverProvider>,
  );
  return within(screen.getByRole('region', { name: 'Defenses' }));
}

test('damage reduction shows the highest per bypass and lists every line', () => {
  const defenses = renderDefenses(
    {
      values: [{ bypass: '-', value: 2, entryId: 'Damage Reduction' }],
      lines: [
        { ...line('Damage Reduction', 2, true), bypass: '-' },
        { ...line('Damage Reduction (Mad Dog)', 1, false), bypass: '-' },
      ],
      conditional: [],
    },
    noResistance,
  );
  const group = within(
    defenses.getByRole('group', { name: 'Damage reduction' }),
  );
  expect(group.getByText('2/—')).toBeVisible();
  expect(group.getByText('Damage Reduction 2/— (applies)')).toBeVisible();
  expect(group.getByText('Damage Reduction (Mad Dog) 1/—')).toBeVisible();
  expect(
    defenses.queryByRole('group', { name: 'Spell resistance' }),
  ).not.toBeInTheDocument();
});

test('spell resistance shows the highest, and a conditional line with its Situation', () => {
  const defenses = renderDefenses(none, {
    value: 11,
    lines: [line('Drow', 11, true)],
    conditional: [
      {
        ...line('Robe of the Archmagi (White)', 18, false),
        situation: { local: 'worn by a good arcane spellcaster' },
      },
    ],
  });
  const group = within(
    defenses.getByRole('group', { name: 'Spell resistance' }),
  );
  expect(group.getByText('11')).toBeVisible();
  expect(group.getByText('Drow 11 (applies)')).toBeVisible();
  expect(
    group.getByText(
      'Robe of the Archmagi (White) 18, only when worn by a good arcane spellcaster',
    ),
  ).toBeVisible();
  expect(
    defenses.queryByRole('group', { name: 'Damage reduction' }),
  ).not.toBeInTheDocument();
});

test('an unresolved line and a statistic with no value read as unresolved', () => {
  const defenses = renderDefenses(none, {
    value: null,
    lines: [line('Drow', null, false)],
    conditional: [],
  });
  const group = within(
    defenses.getByRole('group', { name: 'Spell resistance' }),
  );
  expect(group.getByText('Unresolved')).toBeVisible();
  expect(group.getByText('Drow Unresolved')).toBeVisible();
});

test('a sheet with no damage reduction or spell resistance shows neither', () => {
  const defenses = renderDefenses(none, noResistance);
  expect(
    defenses.queryByRole('group', { name: 'Damage reduction' }),
  ).toBeNull();
  expect(
    defenses.queryByRole('group', { name: 'Spell resistance' }),
  ).toBeNull();
});

// fix r1: the lines are Defenses rows like CMD's, a list item each, and each
// line is keyed by its entry and rule value, so two entries of the same name
// giving the same line are both listed.
test('damage reduction and spell resistance are rows of the Defenses list', () => {
  const defenses = renderDefenses(
    {
      values: [{ bypass: '-', value: 2, entryId: 'barbarian' }],
      lines: [{ ...line('Damage Reduction', 2, true), bypass: '-' }],
      conditional: [],
    },
    { value: 11, lines: [line('Drow', 11, true)], conditional: [] },
  );
  const rows = defenses.getAllByRole('listitem');
  for (const name of ['Damage reduction', 'Spell resistance'])
    expect(rows).toContain(defenses.getByRole('group', { name }).closest('li'));
});

// fix r2: as on CMD's row, the label and the value sit on the same solid rule;
// the lines it comes from are listed beneath it, not between them.
test('a rule-value row puts its label and value on the row rule and its lines beneath', () => {
  const defenses = renderDefenses(
    {
      values: [{ bypass: '-', value: 2, entryId: 'barbarian' }],
      lines: [{ ...line('Damage Reduction', 2, true), bypass: '-' }],
      conditional: [],
    },
    { value: 11, lines: [line('Drow', 11, true)], conditional: [] },
  );
  for (const [name, value] of [
    ['Damage reduction', '2/—'],
    ['Spell resistance', '11'],
  ] as const) {
    const group = within(defenses.getByRole('group', { name }));
    const ruled = group.getByText(name).parentElement;
    expect(group.getByText(value).parentElement).toBe(ruled);
    expect(ruled).toHaveClass('border-b');
    expect(ruled).not.toHaveClass('border-dotted');
    expect(ruled).not.toContainElement(group.getByRole('list'));
  }
});

test('two same-named lines from two entries are both listed', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const hide = (entryId: string) => ({
    ...line('Stone hide', 2, false),
    entryId,
    bypass: '-',
  });
  const defenses = renderDefenses(
    {
      values: [{ bypass: '-', value: 2, entryId: 'first' }],
      lines: [hide('first'), hide('second')],
      conditional: [],
    },
    noResistance,
  );
  const group = within(
    defenses.getByRole('group', { name: 'Damage reduction' }),
  );
  expect(group.getAllByText('Stone hide 2/—')).toHaveLength(2);
  expect(error).not.toHaveBeenCalled();
  error.mockRestore();
});
