import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import { RollTotalField } from './roll-total-field';

const generated = { kind: 'generated' as const, sourceId: 'roller' };
const modifiers = [{ sourceId: 'helpful', value: 2, reason: 'Allies' }];
const spec = { count: 2, sides: 4 };

test('[rules.WEEK-15.total-writer] a typed total writes the strict total form against the rule specification while preserving prior metadata', () => {
  const onRoll = vi.fn();
  const prior: RawRoll = {
    diceTotal: 9,
    diceCount: 2,
    sides: 4,
    provenance: generated,
    modifiers,
  };
  render(
    <RollTotalField
      label="Training roll"
      spec={spec}
      recorded={prior}
      onRoll={onRoll}
    />,
  );
  const input = screen.getByRole('textbox', { name: 'Training roll' });
  // A recorded total shows without a write, with its range advisory.
  expect(input).toHaveValue('9');
  expect(onRoll).not.toHaveBeenCalled();
  expect(screen.getByText(/usual range is 2–8/)).toBeVisible();
  fireEvent.change(input, { target: { value: '7' } });
  expect(onRoll).toHaveBeenLastCalledWith({
    diceTotal: 7,
    diceCount: 2,
    sides: 4,
    provenance: generated,
    modifiers,
  });
});

test('[rules.WEEK-14.total-input] malformed text is blocked before any write, zero is accepted with a range advisory, and blank clears through the caller', () => {
  const onRoll = vi.fn();
  const { rerender } = render(
    <RollTotalField
      label="Check roll"
      spec={{ count: 1, sides: 20 }}
      recorded={null}
      required
      onRoll={onRoll}
    />,
  );
  const input = screen.getByRole('textbox', { name: 'Check roll' });
  for (const invalid of ['-1', '1.5', '1e2', ' 4', 'x', '99999999999999999']) {
    fireEvent.change(input, { target: { value: invalid } });
    expect(onRoll).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      /digits only|smaller whole number/,
    );
  }
  fireEvent.change(input, { target: { value: '0' } });
  expect(onRoll).toHaveBeenLastCalledWith({
    diceTotal: 0,
    diceCount: 1,
    sides: 20,
    provenance: { kind: 'table' },
    modifiers: [],
  });
  rerender(
    <RollTotalField
      label="Check roll"
      spec={{ count: 1, sides: 20 }}
      recorded={onRoll.mock.lastCall![0] as RawRoll}
      required
      onRoll={onRoll}
    />,
  );
  expect(input).toHaveValue('0');
  expect(screen.getByText(/usual range is 1–20/)).toBeVisible();
  fireEvent.change(input, { target: { value: '' } });
  expect(onRoll).toHaveBeenLastCalledWith(null);
});

test('[rules.WEEK-15.total-incomplete] a total for another specification stays recorded, shows an empty field with an explanation, and clears explicitly', () => {
  const onRoll = vi.fn();
  const stale: RawRoll = {
    diceTotal: 5,
    diceCount: 1,
    sides: 6,
    provenance: generated,
    modifiers: [],
  };
  render(
    <RollTotalField
      label="Training roll"
      spec={spec}
      recorded={stale}
      onRoll={onRoll}
    />,
  );
  expect(screen.getByRole('textbox', { name: 'Training roll' })).toHaveValue(
    '',
  );
  expect(
    screen.getByText(
      /Recorded total 5 was entered for 1d6, but this step needs 2d4/,
    ),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Clear training roll' }));
  expect(onRoll).toHaveBeenLastCalledWith(null);
});

test('the dice notation and provenance describe the input directly beneath it', () => {
  const recorded = {
    diceTotal: 5,
    diceCount: 2,
    sides: 4,
    modifiers: [],
  };
  const { rerender } = render(
    <RollTotalField
      label="Training roll"
      spec={spec}
      recorded={{ ...recorded, provenance: { kind: 'table' } }}
      onRoll={vi.fn()}
    />,
  );
  const input = screen.getByRole('textbox', { name: 'Training roll' });
  expect(input).toHaveAccessibleDescription('2d4 · total of the dice only');
  rerender(
    <RollTotalField
      label="Training roll"
      spec={spec}
      recorded={{ ...recorded, provenance: generated }}
      onRoll={vi.fn()}
    />,
  );
  expect(input).toHaveAccessibleDescription(
    '2d4 · total of the dice only · Recorded roll.',
  );
});
