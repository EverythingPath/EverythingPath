import { expect, test } from 'vitest';
import { moveAdjustment } from './adjustment-order';

const adjustment = (adjustmentId: string) => ({
  kind: 'event_end' as const,
  adjustmentId,
  eventId: 'event',
  reason: `Reason ${adjustmentId}`,
});

test('[rules.P85.order-swap] moving swaps one neighbour and keeps every other adjustment intact', () => {
  const list = ['a', 'b', 'c'].map(adjustment);
  expect(moveAdjustment(list, 1, -1).map((a) => a.adjustmentId)).toEqual([
    'b',
    'a',
    'c',
  ]);
  expect(moveAdjustment(list, 1, 1).map((a) => a.adjustmentId)).toEqual([
    'a',
    'c',
    'b',
  ]);
  // Ends have no neighbour to swap with; the list is returned unchanged.
  expect(moveAdjustment(list, 0, -1)).toEqual(list);
  expect(moveAdjustment(list, 2, 1)).toEqual(list);
  expect(list.map((a) => a.adjustmentId)).toEqual(['a', 'b', 'c']);
});
