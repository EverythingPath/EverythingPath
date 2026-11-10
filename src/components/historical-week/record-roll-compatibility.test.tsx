import { render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import {
  canonicalResolutionRecordSchema,
  type CanonicalResolutionRecord,
} from '~/lib/canonical-resolution-record';
import { weeklyDraftDataSchema } from '~/lib/weekly-draft-contract';
import { createWeeklyDraft } from '~/lib/weekly-draft';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import {
  emptyPlanArtifacts,
  recordSnapshot,
} from '../../../tests/history/resolution-record-fixtures';
import { HistoricalRecordView } from './record-view';

// A recorded dice total; history never rewrites it.
function total(sides: number, diceCount: number, diceTotal: number): RawRoll {
  return {
    sides,
    diceCount,
    diceTotal,
    provenance: { kind: 'table' },
    modifiers: [],
  };
}
function record(
  rolls: NonNullable<CanonicalResolutionRecord['source']['upkeep']['rolls']>,
  transfer: CanonicalResolutionRecord['source']['upkeep']['treasuryTransfers'][number],
): CanonicalResolutionRecord {
  const source = weeklyDraftDataSchema.parse(
    createWeeklyDraft({
      draftId: 'history-draft',
      week: 9,
      slotIds: ['slot'],
      context: {
        firstMilitiaWeek: false,
        startDay: 56,
        uneventfulCarry: false,
        carriedEvents: [],
        queuedEffects: [],
        orders: [],
        lastBuyoffWeek: null,
      },
    }),
  );
  source.upkeep.rolls = rolls;
  source.upkeep.treasuryTransfers = [transfer];
  source.event.occurrences = [
    {
      eventId: 'occurrence',
      origin: { kind: 'rolled' },
      tableRoll: rolls.check!,
    },
  ];
  const { persistentPhaseEligible: _eligible, ...context } = source.context;
  const militiaSnapshot = recordSnapshot();
  return canonicalResolutionRecordSchema.parse({
    recordId: 'record',
    source,
    sourceMilitiaSnapshot: militiaSnapshot,
    rulesetVersion: 5,
    provenance: 'confirmation',
    ...emptyPlanArtifacts({ before: { week: 9, militiaSnapshot, context } }),
    warnings: [],
    adjudication: {
      tableAdjustments: [],
      rulesExceptions: [],
      acknowledgements: [],
    },
    successorContext: { ...context, startDay: 63 },
    supersedesRecordId: null,
  });
}

const region = (name: string) => within(screen.getByRole('region', { name }));
/** One consequence line of a section, as the player reads it. */
const line = (section: string, title: string) =>
  region(section)
    .getAllByRole('listitem')
    .find((item) => item.textContent?.startsWith(title))?.textContent;

test('[rules.HIST-05.new-source] a newer record shows its recorded totals and counts, including zero, without fabricating dice', () => {
  const recent = record(
    { check: total(20, 1, 0), training: total(4, 2, 7) },
    {
      transferId: 'transfer',
      direction: 'withdraw',
      copper: 250,
    },
  );
  const { container } = render(<HistoricalRecordView record={recent} />);
  expect(line('1 Upkeep', 'Training attrition')).toBe(
    'Training attrition · Loyalty check roll: dice total 0 (1d20) · Training loss roll: dice total 7 (2d4)',
  );
  expect(line('1 Upkeep', 'Treasury withdrawal')).toBe(
    'Treasury withdrawal · Recorded amount 2.5 gp',
  );
  expect(container.textContent).not.toMatch(/dice \d/);
  expect(container.querySelector('input, textarea, select')).toBeNull();
  expect(container.textContent).not.toContain('diceTotal');
});

test('[rules.HIST-05.characterless-transfer] a Ruleset Version 6 record shows its characterless transfer without inventing a character', () => {
  const recent = {
    ...record(
      { check: total(20, 1, 12) },
      { transferId: 'transfer', direction: 'deposit', copper: 7 },
    ),
    rulesetVersion: 6,
  };
  const { container } = render(<HistoricalRecordView record={recent} />);
  expect(line('1 Upkeep', 'Treasury deposit')).toBe(
    'Treasury deposit · Recorded amount 0.07 gp',
  );
  expect(container.textContent).not.toContain('Character');
  expect(container.querySelector('input, textarea, select')).toBeNull();
});
