import { cleanup, render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { FinishedWeekEntries } from './finished-week-entries';
import type { AuditEntryView } from './finished-weeks-types';

function entry(sequence: number, overrides: Partial<AuditEntryView>) {
  return {
    recordId: `record-${sequence}`,
    label: `Entry ${sequence}`,
    provenance: 'Confirmed week',
    date: { dateTime: '2026-09-28', label: 'Sep 28, 2026' },
    ruleset: { status: 'ready', version: 8 },
    isSelected: false,
    isEffective: false,
    select: () => undefined,
    ...overrides,
  } satisfies AuditEntryView;
}

function showing(selected: 1 | 2) {
  render(
    <FinishedWeekEntries
      id="entries"
      week={1}
      page={{
        status: 'ready',
        earlier: null,
        entries: [
          entry(2, { isEffective: true, isSelected: selected === 2 }),
          entry(1, { isSelected: selected === 1 }),
        ],
      }}
    />,
  );
  const current = screen
    .getAllByRole('button')
    .find((button) => button.getAttribute('aria-current') === 'true')!;
  return within(current).getByText('showing');
}

// Amber marks a shown entry that is not the effective record; the effective
// record shown as usual is not a warning.
test('the showing chip is amber only on an earlier, non-effective entry', () => {
  expect(showing(1)).toHaveClass('text-amber-300');
  cleanup();
  const effective = showing(2);
  expect(effective).not.toHaveClass('text-amber-300');
  expect(effective).toHaveClass('font-mono');
});
