import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type * as NavigationGuard from '~/components/campaign-shell/navigation-guard';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import { buildSheet, type Adjustment } from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';

// Number breakdowns (#263): every sheet number explains its applied,
// set-aside and situational contributions, by touch, keyboard and mouse.

let snapshot: CharacterSheetSnapshot | null | undefined;
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
  usePaginatedQuery: () => ({
    results: [],
    status: 'Exhausted',
    loadMore: vi.fn(),
  }),
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

function renderSheet(initial: CharacterSheetSnapshot) {
  snapshot = initial;
  render(<CharacterSheetBlocks blocks={['scores', 'summary']} />);
}
// The trigger's name is "<label> <visible number>, breakdown" (WCAG 2.5.3).
const trigger = (label: string) =>
  screen.getByRole('button', {
    name: new RegExp(`^${label} (?!modifier ).+, breakdown$`),
  });
const panel = (label: string) =>
  screen.getByRole('group', { name: `${label} breakdown` });
const queryPanel = (label: string) =>
  screen.queryByRole('group', { name: `${label} breakdown` });
const line = (label: string, text: string) =>
  within(panel(label))
    .getByText(text, { selector: 'span' })
    .closest('li') as HTMLElement;

const bullStrength: Adjustment = {
  id: 'bull',
  name: 'Bull strength',
  modifiers: [{ target: 'ability.str', bonusType: 'enhancement', value: 4 }],
};
const belt: Adjustment = {
  id: 'belt',
  name: 'Belt of giant strength',
  modifiers: [{ target: 'ability.str', bonusType: 'enhancement', value: 2 }],
};
const rage: Adjustment = {
  id: 'rage',
  name: 'Rage',
  modifiers: [
    {
      target: 'ability.str',
      bonusType: 'morale',
      value: 2,
      condition: { situation: { local: 'raging' } },
    },
  ],
};
const chant: Adjustment = {
  id: 'chant',
  name: 'War chant',
  modifiers: [
    {
      target: 'ability.str',
      bonusType: 'enhancement',
      value: 8,
      condition: { situation: { local: 'raging' } },
    },
  ],
};

beforeEach(() => {
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
  snapshot = undefined;
});

test('hover, click and keyboard open the same breakdown; Escape, the close button, an outside press and a resize close it and focus stays with the number', () => {
  renderSheet(buildSheet({ adjustments: [bullStrength] }));
  const strength = trigger('Strength');
  expect(strength).toHaveAttribute('aria-expanded', 'false');
  // The visible number is part of the name, so "click 14" reaches it.
  expect(strength).toHaveAccessibleName('Strength 14, breakdown');
  expect(queryPanel('Strength')).not.toBeInTheDocument();

  fireEvent.pointerEnter(strength, { pointerType: 'mouse' });
  expect(panel('Strength')).toBeVisible();
  expect(strength).toHaveAttribute('aria-expanded', 'true');
  fireEvent.pointerEnter(panel('Strength'), { pointerType: 'mouse' });
  expect(panel('Strength')).toBeVisible();
  fireEvent.pointerLeave(strength.parentElement!, { pointerType: 'mouse' });
  expect(queryPanel('Strength')).not.toBeInTheDocument();
  // A finger arriving does not open it; the tap does.
  fireEvent.pointerEnter(strength, { pointerType: 'touch' });
  expect(queryPanel('Strength')).not.toBeInTheDocument();
  fireEvent.click(strength);
  expect(panel('Strength')).toBeVisible();
  expect(strength).toHaveAttribute('aria-controls', panel('Strength').id);
  fireEvent.pointerLeave(strength.parentElement!, { pointerType: 'mouse' });
  expect(panel('Strength')).toBeVisible();
  fireEvent.click(strength);
  expect(queryPanel('Strength')).not.toBeInTheDocument();

  // Keyboard: Enter and Space activate the button; Escape closes.
  strength.focus();
  fireEvent.click(strength);
  expect(panel('Strength')).toBeVisible();
  fireEvent.keyDown(panel('Strength'), { key: 'Escape' });
  expect(queryPanel('Strength')).not.toBeInTheDocument();
  expect(strength).toHaveFocus();
  expect(strength).toHaveAttribute('aria-expanded', 'false');

  fireEvent.click(strength);
  fireEvent.click(
    within(panel('Strength')).getByRole('button', { name: 'Close breakdown' }),
  );
  expect(queryPanel('Strength')).not.toBeInTheDocument();
  expect(strength).toHaveFocus();

  fireEvent.click(strength);
  fireEvent.pointerDown(document.body);
  expect(queryPanel('Strength')).not.toBeInTheDocument();
  expect(trigger('HP')).toHaveAttribute('aria-expanded', 'false');

  fireEvent.click(strength);
  fireEvent(window, new Event('resize'));
  expect(queryPanel('Strength')).not.toBeInTheDocument();
});

test('a breakdown lists built-ins, applied entries, set-aside entries with their reason and the Only when… groups, matching the resolver', () => {
  const sheet = buildSheet({ adjustments: [bullStrength, belt, rage] });
  renderSheet(sheet);
  const strength = trigger('Strength');
  expect(strength).toHaveTextContent(
    String(sheet.calculated.breakdowns['ability.str'].total),
  );
  expect(strength).toHaveTextContent('14');
  expect(
    within(strength.parentElement!).getByRole('img', {
      name: 'Situational rules available',
    }),
  ).toBeInTheDocument();
  expect(
    within(trigger('Dexterity').parentElement!).queryByRole('img'),
  ).not.toBeInTheDocument();

  fireEvent.click(strength);
  expect(line('Strength', 'Base scores')).toHaveTextContent('+10');
  expect(line('Strength', 'Bull strength')).toHaveTextContent('enhancement');
  expect(line('Strength', 'Bull strength')).toHaveTextContent('+4');
  expect(within(panel('Strength')).getByText('Not applied')).toBeVisible();
  const setAside = line('Strength', 'Belt of giant strength');
  expect(setAside).toHaveTextContent('+2');
  expect(setAside).toHaveTextContent(
    'A higher bonus of this type applies. (Bull strength)',
  );
  expect(within(panel('Strength')).getByText('Only when…')).toBeVisible();
  const raging = within(panel('Strength')).getByText('raging').closest('li')!;
  expect(raging).toHaveTextContent('becomes 16');
  expect(within(raging).getByText('Rage')).toBeVisible();
  expect(raging).toHaveTextContent('morale');
  expect(panel('Strength')).not.toHaveTextContent(/adj|catalog|builtin/);
});

test("a Situation preview is the resolver's answer, including what it sets aside, and a local situation never wakes an equally named Modifier on another adjustment", () => {
  const sheet = buildSheet({ adjustments: [bullStrength, rage, chant] });
  renderSheet(sheet);
  fireEvent.click(trigger('Strength'));
  const groups = within(panel('Strength'))
    .getAllByText('raging')
    .map((text) => text.closest('li')!);
  expect(groups).toHaveLength(2);
  const rageGroup = groups.find((group) => within(group).queryByText('Rage'))!;
  const chantGroup = groups.find((group) =>
    within(group).queryByText('War chant'),
  )!;
  // Rage alone: 10 + 4 + 2; the chant's +8 is another adjustment's "raging".
  expect(rageGroup).toHaveTextContent('becomes 16');
  expect(within(rageGroup).queryByText('War chant')).not.toBeInTheDocument();
  // The chant alone: 10 + 8, and the +4 enhancement it beats is set aside.
  expect(chantGroup).toHaveTextContent('becomes 18');
  expect(within(chantGroup).getByText('Bull strength')).toHaveClass(
    'line-through',
  );
  expect(chantGroup).toHaveTextContent('A higher bonus of this type applies.');
  expect(within(chantGroup).queryByText('Rage')).not.toBeInTheDocument();
  expect(panel('Strength')).not.toHaveTextContent(/becomes 2[024]/);
});

test('an adjusted Strength shows 14 as the total while the base score stays 10, and a Modifier set aside is never counted twice', () => {
  renderSheet(buildSheet({ adjustments: [bullStrength, belt] }));
  expect(trigger('Strength')).toHaveTextContent('14');
  const scores = screen.getByRole('region', { name: 'Ability scores' });
  expect(within(scores).getByRole('textbox', { name: 'Strength' })).toHaveValue(
    '10',
  );
  expect(
    within(scores).getByRole('button', {
      name: 'Strength modifier +2, breakdown',
    }),
  ).toBeVisible();
});

test('HP stays not complete while a Class Level lacks hit points, explains why, and lists each contribution once complete', () => {
  const hpBoost: Adjustment = {
    id: 'toughness',
    name: 'Toughness',
    modifiers: [{ target: 'hp', bonusType: 'untyped', value: 5 }],
  };
  renderSheet(
    buildSheet({
      levels: [
        { id: 'a', hp: 8 },
        { id: 'b', hp: null },
      ],
      adjustments: [hpBoost],
    }),
  );
  const hp = trigger('HP');
  expect(hp).toHaveAccessibleName('HP not complete, breakdown');
  expect(hp).toHaveTextContent('not complete');
  expect(hp).not.toHaveTextContent('13');
  fireEvent.click(hp);
  expect(
    within(panel('HP')).getByText(
      'Not complete: Class Level 2 has no hit points yet.',
    ),
  ).toBeVisible();
  expect(line('HP', 'Toughness')).toHaveTextContent('+5');
  expect(line('HP', 'Class Level 1')).toHaveTextContent('+8');
  expect(within(panel('HP')).getAllByText('not complete')).toHaveLength(1);
});

test('a complete HP total opens to its Class Levels, Constitution and adjustments', () => {
  renderSheet(
    buildSheet({
      scores: {
        strength: 10,
        dexterity: 10,
        constitution: 14,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      levels: [
        { id: 'a', hp: 8 },
        { id: 'b', hp: 5 },
      ],
      adjustments: [
        {
          id: 'toughness',
          name: 'Toughness',
          modifiers: [{ target: 'hp', bonusType: 'untyped', value: 3 }],
        },
      ],
    }),
  );
  expect(trigger('HP')).toHaveTextContent('20');
  expect(trigger('HP')).toHaveAccessibleName('HP 20, breakdown');
  fireEvent.click(trigger('HP'));
  expect(line('HP', 'Class Level 1')).toHaveTextContent('+8');
  expect(line('HP', 'Class Level 2')).toHaveTextContent('+5');
  expect(line('HP', 'Constitution')).toHaveTextContent('+4');
  expect(line('HP', 'Toughness')).toHaveTextContent('+3');
  expect(
    within(panel('HP')).queryByText('Not applied'),
  ).not.toBeInTheDocument();
});

// Superstition-like: +3 morale vs. spells, but only while Rage is active.
const superstition: Adjustment = {
  id: 'superstition',
  name: 'Superstition',
  modifiers: [
    {
      target: 'ability.str',
      bonusType: 'morale',
      value: 3,
      condition: { situation: 'spells', whileActive: 'rage-catalog' },
    },
  ],
};
const rageBonus: Adjustment = {
  id: 'rage',
  name: 'Rage',
  modifiers: [{ target: 'ability.str', bonusType: 'morale', value: 4 }],
};

test('a shared Situation reads as its display text, and a Modifier that also waits on an inactive prerequisite explains that instead of a situational total', () => {
  renderSheet(
    buildSheet({
      adjustments: [{ ...rageBonus, active: false }, superstition],
    }),
  );
  fireEvent.click(trigger('Strength'));
  const group = within(panel('Strength'))
    .getByText('vs. spells')
    .closest('li')!;
  expect(within(group).getByText('Superstition')).toBeVisible();
  expect(group).toHaveTextContent('only while Rage is active — not now');
  expect(group).not.toHaveTextContent('becomes');
  expect(panel('Strength')).not.toHaveTextContent(/catalog|shared:|local:/);
});

test('once the prerequisite is active the Situation resolves as usual, and a set-aside Modifier is explained rather than counted', () => {
  renderSheet(buildSheet({ adjustments: [rageBonus, superstition] }));
  expect(trigger('Strength')).toHaveTextContent('14');
  fireEvent.click(trigger('Strength'));
  const group = within(panel('Strength'))
    .getByText('vs. spells')
    .closest('li')!;
  expect(group).toHaveTextContent('becomes 14');
  expect(within(group).getByText('Superstition')).toHaveClass('line-through');
  expect(group).toHaveTextContent(
    'A higher bonus of this type applies. (Rage)',
  );
  expect(group).not.toHaveTextContent('not now');
});
