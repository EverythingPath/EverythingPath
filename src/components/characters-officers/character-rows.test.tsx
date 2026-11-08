import { render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, test, vi } from 'vitest';
import type { Id } from '@convex/_generated/dataModel';
import { CharacterCards, CharacterTable } from './character-rows';
import type { MilitiaCharacterRow } from './use-characters-page';

// A roster row's Hit Dice (#423): a sheet that cannot calculate them yet
// reads Unresolved, never "null HD"; a roster override, zero included,
// always shows its number.

vi.mock('~/components/campaign-shell/navigation-guard', () => ({
  GuardedLink: ({
    href,
    children,
    ...props
  }: ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useNavigationGuard: () => ({ navigate: vi.fn() }),
}));
vi.mock('~/components/character-sheet/use-character-ownership', () => ({
  useCharacterOwnership: () => null,
}));
vi.mock('~/components/character-sheet/character-owner-control', () => ({
  CharacterOwnerControl: () => null,
}));
vi.mock('~/components/character-sheet/build-out-control', () => ({
  BuildOutControl: () => null,
}));

const campaignId = 'campaign' as Id<'campaign'>;
function row(values: Partial<MilitiaCharacterRow> = {}): MilitiaCharacterRow {
  const characterId = 'ixa' as Id<'character'>;
  return {
    characterId,
    name: 'Ixa',
    kind: 'npc',
    archived: false,
    onRoster: true,
    hitDice: null,
    roles: ['overseer'],
    manages: null,
    warnings: [],
    unresolvedAbilities: [],
    level: 4,
    scores: {
      strength: 7,
      dexterity: 11,
      constitution: 9,
      intelligence: 7,
      wisdom: 10,
      charisma: 10,
    },
    statisticsReadOnly: true,
    canBuildOut: false,
    sheetHref: '/characters/ixa',
    owner: null,
    ownershipAvailable: false,
    ownershipScope: { campaignId, organizationId: 'org', characterId },
    ...values,
  };
}
const props: Omit<ComponentProps<typeof CharacterTable>, 'rows'> = {
  hasBoard: true,
  teamsHref: '/teams',
  onEdit: vi.fn(),
  rosterRow: null,
  buildOut: {
    characterId: null,
    status: { kind: 'idle' },
    maintenance: { kind: 'ready', readOnly: false, message: '' },
    run: () => Promise.resolve(null),
  },
};
const note = /Some values can’t be calculated from this sheet yet\./;

describe('Hit Dice', () => {
  test('unknown Hit Dice read Unresolved in the table, with the note and sheet link', () => {
    render(<CharacterTable rows={[row()]} {...props} />);
    const cells = screen.getAllByRole('cell').map((cell) => cell.textContent);
    expect(cells).toContain('Unresolved');
    expect(cells.some((cell) => cell?.includes('HD'))).toBe(false);
    expect(screen.getByLabelText('Hit Dice unresolved')).toHaveTextContent(
      'Unresolved',
    );
    expect(screen.getByText(note)).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Open sheet for Ixa' }),
    ).toHaveAttribute('href', '/characters/ixa');
    expect(screen.getByRole('button', { name: 'Overseer' })).toBeEnabled();
  });

  test('a roster override of zero reads 0 HD with no note', () => {
    render(<CharacterTable rows={[row({ hitDice: 0 })]} {...props} />);
    const cells = screen.getAllByRole('cell').map((cell) => cell.textContent);
    expect(cells).toContain('0 HD');
    expect(screen.queryByText('Unresolved')).toBeNull();
    expect(screen.queryByText(note)).toBeNull();
  });

  test('the phone card reads Unresolved beside the name and 0 HD for the override', () => {
    const { rerender } = render(<CharacterCards rows={[row()]} {...props} />);
    const card = () => within(screen.getByRole('listitem'));
    expect(card().getByLabelText('Hit Dice unresolved')).toBeVisible();
    expect(card().getByText(note)).toBeVisible();
    rerender(<CharacterCards rows={[row({ hitDice: 0 })]} {...props} />);
    expect(card().getByText('0 HD')).toBeVisible();
    expect(card().queryByText(note)).toBeNull();
  });
});
