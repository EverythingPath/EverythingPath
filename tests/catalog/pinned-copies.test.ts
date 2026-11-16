// @vitest-environment node
import { expect, it } from 'vitest';
import {
  boundCopy,
  readFixtureTree,
} from '../../scripts/catalog/link-pinned-copies';

// Earlier batches copied upstream files into their own fixture folders before
// the pinned store existed. Each such copy becomes a relative link into the
// store (`pnpm catalog:link-copies`, tests/fixtures/pinned/README.md); new
// batches read the store and add no copy. Until every copy is linked this is
// a ratchet: the count of copies may only fall, and the test is lowered with
// it.
const ratchet = 5_093;

const tree = readFixtureTree(process.cwd());

it('holds no more per-batch copies of pinned files than the ratchet', () => {
  process.stdout.write(
    `pinned-copies: ${tree.copies.length} per-batch copies of pinned files (ratchet ${ratchet}), ${tree.links.length} links into the store\n`,
  );
  expect(
    tree.copies.length,
    'A fixture file under tests/fixtures/<batch>/ is byte-identical to a pinned file: link it (pnpm catalog:link-copies --dir <batch>) or read the store',
  ).toBeLessThanOrEqual(ratchet);
  expect(
    tree.copies.length,
    `Copies were linked or removed: lower the ratchet to ${tree.copies.length}`,
  ).toBe(ratchet);
});

it('keeps the one bound copy as a file, with its reason', () => {
  expect(tree.allowed.map(({ path }) => path)).toEqual([boundCopy.path]);
  expect(boundCopy.reason).toMatch(/verification projection/);
});

it('links only to a tracked file in the store, by a relative path, and the store holds no link', () => {
  expect(tree.linkProblems).toEqual([]);
});
