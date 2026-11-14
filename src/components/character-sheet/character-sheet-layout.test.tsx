import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type * as NavigationGuard from '~/components/campaign-shell/navigation-guard';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import {
  buildSheet,
  emptyOwnerCandidates,
  type AbilityChange,
  type Adjustment,
  type CatalogSheetEntry,
} from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';

// Phone and tablet layouts (#298): the sheet's blocks reflow with CSS alone,
// so the same controls stay present, named and operable at every width. The
// phone keeps touch-sized targets; the tablet compacts them from 768px.

type Call = { name: string; args: Record<string, unknown> };
let calls: Call[] = [];
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
  usePaginatedQuery: () => emptyOwnerCandidates(),
  useMutation: (mutation: FunctionReference<'mutation'>) => {
    const name = nameOf(mutation);
    return (args: Record<string, unknown>) =>
      new Promise(() => {
        calls.push({ name, args });
      });
  },
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
vi.mock(
  '~/components/ui/select',
  () => import('../weekly-draft-workspace/native-select-test-double'),
);

// Phone below 768px, tablet and wider above; the sheet reads no other query.
function stubViewport(wide: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches: wide,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

const shield: CatalogSheetEntry = {
  id: 'entry-1',
  name: 'Shield',
  detail: {
    kind: 'spellEffect',
    lastsOverOneDay: false,
    defaultCasterLevel: 6,
  },
  modifiers: [{ target: 'ac.other', bonusType: 'deflection', value: 4 }],
};
const bullStrength: Adjustment = {
  id: 'adj-1',
  name: 'Bull strength',
  modifiers: [{ target: 'ability.str', bonusType: 'enhancement', value: 4 }],
};
const strengthDamage: AbilityChange = {
  id: 'dmg-1',
  kind: 'abilityDamage',
  ability: 'strength',
  points: 3,
};

function renderSheet(
  blocks: Parameters<typeof CharacterSheetBlocks>[0]['blocks'],
) {
  snapshot = buildSheet({
    sheetEntries: [shield],
    adjustments: [bullStrength],
    abilityChanges: [strengthDamage],
  });
  render(<CharacterSheetBlocks blocks={blocks} />);
}
const region = (name: string) => screen.getByRole('region', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const radio = (name: string) => screen.getByRole('radio', { name });
const field = (name: string) => screen.getByRole('textbox', { name });
const picker = (name: string) => screen.getByRole('combobox', { name });
const toggle = (name: string) => screen.getByRole('switch', { name });

/** The row's switch, Edit and Remove, present, enabled and touch-sized. */
function expectRowControls(name: string, active = 'active') {
  const rowToggle = toggle(`${name}: ${active}`);
  expect(rowToggle).toBeEnabled();
  expect(rowToggle).toHaveClass('size-11', 'md:size-7');
  for (const control of [button(`Edit ${name}`), button(`Remove ${name}`)]) {
    expect(control).toBeEnabled();
    expect(control).toHaveClass('size-11', 'md:size-8');
  }
}

const widths = [
  { wide: false, label: 'phone' },
  { wide: true, label: 'tablet' },
];

beforeEach(() => {
  calls = [];
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
  snapshot = undefined;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

test.each(widths)(
  'every block keeps its row controls and Add action on the $label, and they work',
  ({ wide }) => {
    stubViewport(wide);
    renderSheet(['abilityChanges', 'adjustments', 'entries']);
    expectRowControls('Strength damage');
    expectRowControls('Bull strength');
    expectRowControls('Shield');
    for (const name of [
      'Add ability damage or drain',
      'Add personal adjustment',
      'Add entry',
    ]) {
      expect(button(name)).toBeEnabled();
      expect(button(name)).toHaveClass('min-h-11', 'md:min-h-9');
    }

    fireEvent.click(toggle('Shield: active'));
    expect(calls.map((call) => call.name)).toEqual(['editSheetEntry']);
    expect(calls[0]?.args).toMatchObject({ entryId: 'entry-1', active: false });
    fireEvent.click(button('Remove Bull strength'));
    expect(calls.map((call) => call.name)).toEqual([
      'editSheetEntry',
      'removeAdjustment',
    ]);
    fireEvent.click(button('Edit Strength damage'));
    expect(
      screen.getByRole('form', { name: 'Edit ability damage' }),
    ).toBeVisible();
    expect(button('Edit Strength damage')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  },
);

test.each(widths)(
  'the entry editor on the $label keeps its kind cards, labeled fields and touch-sized inputs; the phone-only Modifier captions never replace the field names',
  ({ wide }) => {
    stubViewport(wide);
    renderSheet(['entries']);
    fireEvent.click(button('Edit Shield'));
    const editor = screen.getByRole('form', { name: 'Edit entry' });
    const kinds = within(editor).getByRole('radiogroup', { name: 'Kind' });
    expect(kinds).toHaveClass('grid-cols-2', 'md:grid-cols-4');
    expect(within(kinds).getAllByRole('radio')).toHaveLength(4);
    expect(radio('Spell Effect')).toBeChecked();
    for (const name of ['Default caster level', 'Caster level']) {
      expect(field(name)).toBeEnabled();
      expect(field(name)).toHaveClass('h-11', 'md:h-8');
    }
    expect(
      screen.getByRole('checkbox', { name: 'Lasts more than one day' }),
    ).toBeEnabled();

    // The Modifier header is for the eye from tablet width; each phone row
    // carries its own captions, hidden from the accessibility tree.
    const modifiers = within(editor).getByRole('list', { name: 'Modifiers' });
    const header = modifiers.previousElementSibling;
    expect(header).toHaveTextContent('StatisticBonus typeValueOnly when…');
    expect(header).toHaveClass('hidden', 'md:grid');
    expect(header).toHaveAttribute('aria-hidden', 'true');
    const modifier = within(editor).getByRole('listitem', {
      name: 'Modifier 1',
    });
    expect(modifier).toHaveClass(
      'md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(8rem,1.2fr)_minmax(0,1fr)_auto]',
    );
    for (const caption of ['Statistic', 'Bonus type', 'Value', 'Only when…'])
      expect(within(modifier).getByText(caption)).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    expect(picker('Modifier 1 statistic')).toHaveValue('ac.other');
    expect(picker('Modifier 1 bonus type')).toHaveValue('deflection');
    expect(field('Modifier 1 value')).toHaveValue('4');
    expect(field('Modifier 1 value')).toHaveClass('h-11', 'md:h-8');
    expect(field('Modifier 1 only when')).toBeEnabled();
    expect(button('Modifier 1 as formula')).toHaveClass('size-11', 'md:size-8');

    fireEvent.click(button('Add modifier'));
    expect(
      within(editor).getByRole('listitem', { name: 'Modifier 2' }),
    ).toBeVisible();
    expect(field('Modifier 2 value')).toHaveAccessibleName();
    fireEvent.change(field('Modifier 2 value'), { target: { value: '2' } });
    expect(field('Modifier 2 value')).toHaveValue('2');
    expect(button('Save entry')).toHaveClass('min-h-11', 'md:min-h-9');
  },
);

test.each(widths)(
  'the damage and drain editor on the $label stacks its kind cards, wraps the ability cards and keeps Points touch-sized',
  ({ wide }) => {
    stubViewport(wide);
    renderSheet(['abilityChanges']);
    fireEvent.click(button('Add ability damage or drain'));
    const editor = screen.getByRole('form', {
      name: 'New ability damage or drain',
    });
    expect(
      within(editor).getByRole('radiogroup', { name: 'Kind' }),
    ).toHaveClass('grid-cols-1', 'sm:grid-cols-2');
    expect(
      within(editor).getByRole('radiogroup', { name: 'Ability' }),
    ).toHaveClass('grid-cols-3', 'md:grid-cols-6', 'lg:grid-cols-3');
    fireEvent.click(radio('Ability drain'));
    expect(radio('Ability drain')).toBeChecked();
    fireEvent.click(radio('Dexterity'));
    expect(radio('Dexterity')).toBeChecked();
    const points = field('Points');
    expect(points).toHaveClass('h-11', 'md:h-8');
    fireEvent.change(points, { target: { value: '2' } });
    expect(points).toHaveValue('2');
    expect(
      within(region('Ability damage and drain')).getByRole('button', {
        name: 'Save ability change',
      }),
    ).toBeEnabled();
  },
);
