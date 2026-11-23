import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { BreakdownResolverProvider } from './breakdown-resolver';
import { buildSheet } from './character-sheet-test-fixture';
import { OffenseBlock } from './offense-block';

// rotation-4 (owner 2026-11-17): land speed reads beside Initiative, in feet,
// with the breakdown every Offense figure opens; a sheet whose race gives no
// base speed shows none.
type Statistics = ReturnType<
  typeof buildSheet
>['calculated']['derivedStatistics'];

function renderOffense(statistics: Statistics) {
  render(
    <BreakdownResolverProvider
      previewSituation={() => null}
      adjustments={[]}
      spellcastings={[]}
    >
      <OffenseBlock statistics={statistics} />
    </BreakdownResolverProvider>,
  );
  return within(screen.getByRole('region', { name: 'Offense' }));
}

test('land speed shows in feet beside Initiative and opens its breakdown', () => {
  const statistics = buildSheet({}).calculated.derivedStatistics;
  const offense = renderOffense({
    ...statistics,
    landSpeed: {
      total: 20,
      applied: [
        {
          target: 'speed.land',
          bonusType: 'base',
          value: 30,
          sheetEntryId: 'race-row',
          entryName: 'Human',
          source: 'pf1/human',
          builtIn: false,
        },
        {
          target: 'speed.land',
          bonusType: 'untyped',
          value: -10,
          sheetEntryId: 'armor-row',
          entryName: 'Chainmail (medium armor)',
          source: 'armor-row',
          builtIn: true,
        },
      ],
      suppressed: [],
      conditional: [],
    },
  });
  const labels = offense
    .getAllByRole('listitem')
    .map((item) => item.textContent);
  const initiative = labels.findIndex((text) => text?.startsWith('Initiative'));
  expect(labels[initiative + 1]).toMatch(/^Speed/);
  expect(
    offense.getByRole('button', { name: 'Land speed 20 ft., breakdown' }),
  ).toBeVisible();
});

test('no land speed shows no Speed row', () => {
  const statistics = buildSheet({}).calculated.derivedStatistics;
  const offense = renderOffense(statistics);
  expect(offense.queryByText('Speed')).not.toBeInTheDocument();
  expect(offense.getByText('Initiative')).toBeVisible();
});

// fix r4 (round 4 Spec 1): an armor reason names the armor, so the Speed
// breakdown shows it once, not again as the entry that also reduces speed;
// the reason says so itself (fix r5, `suppressed-lines.test.tsx`).
test('a bonus lost to armor that also reduces land speed shows its armor reason once', () => {
  const statistics = buildSheet({}).calculated.derivedStatistics;
  const reason =
    'Lost while wearing Chainmail (medium armor) and Unknown coat (its armor category is unknown).';
  const offense = renderOffense({
    ...statistics,
    landSpeed: {
      total: 20,
      applied: [
        {
          target: 'speed.land',
          bonusType: 'base',
          value: 30,
          sheetEntryId: 'race-row',
          entryName: 'Human',
          source: 'pf1/human',
          builtIn: false,
        },
        {
          target: 'speed.land',
          bonusType: 'untyped',
          value: -10,
          sheetEntryId: 'chainmail-row',
          entryName: 'Chainmail (medium armor)',
          source: 'chainmail-row',
          builtIn: true,
        },
      ],
      suppressed: [
        {
          target: 'speed.land',
          bonusType: 'untyped',
          value: 5,
          sheetEntryId: 'fleet-row',
          entryName: 'Fleet',
          source: 'pf1/fleet',
          builtIn: false,
          suppressedBy: 'chainmail-row',
          reason,
          // As the resolver writes an armor limit's reason (fix r5).
          reasonNamesSuppressor: true,
        },
      ],
      conditional: [],
    },
  });
  fireEvent.click(
    offense.getByRole('button', { name: 'Land speed 20 ft., breakdown' }),
  );
  const fleet = within(
    screen.getByRole('group', { name: 'Land speed breakdown' }),
  )
    .getByText('Fleet', { selector: 'span' })
    .closest('li')!;
  expect(fleet.textContent).toContain(reason);
  expect(fleet.textContent).not.toContain('(Chainmail (medium armor))');
});
