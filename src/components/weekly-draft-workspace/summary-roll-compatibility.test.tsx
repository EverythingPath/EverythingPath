import { cleanup, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { upkeepFixture } from '../../../tests/rules/upkeep-fixture';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import { phaseView } from './phase-view';
import { SummaryView } from './summary-view';
import { confirmControlFixture } from './confirm-control-test-helpers';

// Test-only representation; the app never writes totals in this delivery.
function total(sides: number, diceCount: number, diceTotal: number): RawRoll {
  return {
    sides,
    diceCount,
    diceTotal,
    provenance: { kind: 'table' },
    modifiers: [],
  };
}
const controls = {
  disabled: false,
  confirmation: confirmControlFixture({ disabled: true }),
  forecastPending: false,
  reviewRequired: false,
  review: vi.fn(),
};
function summary(
  rolls: NonNullable<
    ReturnType<typeof upkeepFixture>['draft']['upkeep']['rolls']
  >,
) {
  const { draft, snapshot } = upkeepFixture();
  snapshot.training = 20;
  snapshot.treasuryCopper = 10000;
  draft.upkeep.rolls = rolls;
  draft.event.chanceRoll = total(100, 1, 100);
  const source = workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [{ characterId: 'pc', name: 'Aubrin' }],
  });
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: source.snapshot,
  });
  const view = phaseView('summary', draft, source, preview);
  if (view.phase !== 'summary') throw new Error('Expected Summary');
  return { view, preview };
}

test('[rules.SUM-02.total-readiness] the current Summary treats an incoming complete total as ready and names an incompatible total as still required', () => {
  const ready = summary({ check: total(20, 1, 4), training: total(4, 2, 7) });
  expect(ready.preview.status).toBe('ready');
  expect(ready.view.ready).toBe(true);
  render(
    <SummaryView
      view={ready.view}
      {...controls}
      edit={vi.fn()}
      confirmation={confirmControlFixture()}
    />,
  );
  // Ready: Confirm is available with no decision or readiness sentence (#110).
  expect(screen.getByRole('button', { name: 'Confirm week' })).toBeEnabled();
  expect(
    screen.queryByRole('region', { name: 'Required decisions' }),
  ).not.toBeInTheDocument();
  cleanup();
  const stale = summary({ check: total(20, 1, 4), training: total(6, 1, 5) });
  expect(stale.preview.status).toBe('incomplete');
  render(<SummaryView view={stale.view} {...controls} edit={vi.fn()} />);
  expect(
    within(
      screen.getByRole('region', { name: 'Required decisions' }),
    ).getByText('Upkeep: Enter the attrition training roll (2d4).'),
  ).toBeVisible();
});

test('[rules.SUM-09.total-range] an out-of-range total warns in the current Summary without blocking readiness', () => {
  const totals = summary({ check: total(20, 1, 0), training: total(4, 2, 7) });
  expect(totals.preview.status).toBe('ready');
  expect(totals.view.warnings).toContain('upkeep:attrition:roll-range');
  render(
    <SummaryView
      view={totals.view}
      {...controls}
      edit={vi.fn()}
      confirmation={confirmControlFixture()}
    />,
  );
  // Named in the Warnings card and again as the Upkeep item's warning note.
  expect(
    screen.getAllByText(/Upkeep: .*outside its usual range/)[0],
  ).toBeVisible();
});
