import { expect, test, vi } from 'vitest';
import { locateAuditSequence, type AuditPage } from './audit-ordinal';

// A chain of `count` entries served in newest-first pages of five, exactly as
// `canonicalHistory.read` pages its audit rows.
function chain(count: number) {
  return vi.fn(async (before: number | undefined): Promise<AuditPage> => {
    const top = before ?? count;
    const sequences = Array.from({ length: 6 }, (_, i) => top - 1 - i).filter(
      (sequence) => sequence >= 0,
    );
    return {
      audit: sequences
        .slice(0, 5)
        .map((sequence) => ({ recordId: `entry-${sequence}`, sequence })),
      earlierSequence: sequences.length > 5 ? sequences[4]! : null,
    };
  });
}

test('finds an entry deep in a long correction chain page by page and stops there', async () => {
  const read = chain(14);
  await expect(
    locateAuditSequence(read, 'entry-5', { signal: { cancelled: false } }),
  ).resolves.toBe(5);
  expect(read.mock.calls.map(([before]) => before)).toEqual([undefined, 9]);
});

test('can start after the page already on screen', async () => {
  const read = chain(14);
  await expect(
    locateAuditSequence(read, 'entry-0', {
      from: 9,
      signal: { cancelled: false },
    }),
  ).resolves.toBe(0);
  expect(read.mock.calls.map(([before]) => before)).toEqual([9, 4]);
});

test('an entry that is not in the chain is unknown after the oldest page', async () => {
  const read = chain(7);
  await expect(
    locateAuditSequence(read, 'elsewhere', { signal: { cancelled: false } }),
  ).resolves.toBeNull();
  expect(read).toHaveBeenCalledTimes(2);
});

test('a cancelled search reads no further page and reports nothing', async () => {
  const signal = { cancelled: false };
  const read = chain(20);
  const located = locateAuditSequence(
    async (before) => {
      const page = await read(before);
      signal.cancelled = true;
      return page;
    },
    'entry-0',
    { signal },
  );
  await expect(located).resolves.toBeNull();
  expect(read).toHaveBeenCalledTimes(1);
});

test('a missing week ends the search', async () => {
  await expect(
    locateAuditSequence(async () => null, 'entry-0', {
      signal: { cancelled: false },
    }),
  ).resolves.toBeNull();
});
