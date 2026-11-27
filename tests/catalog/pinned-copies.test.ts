// @vitest-environment node
import { expect, it } from 'vitest';
import {
  boundCopy,
  readFixtureTree,
} from '../../scripts/catalog/link-pinned-copies';

// Earlier batches copied upstream files into their own fixture folders before
// the pinned store existed. Every such copy is now a relative link into the
// store (`pnpm catalog:link-copies`, tests/fixtures/pinned/README.md), and new
// batches read the store, so a fixture folder holds no copy: only the bound
// copy stays a file.
const tree = readFixtureTree(process.cwd());

it('holds no per-batch copy of a pinned file', () => {
  expect(
    tree.copies.map(({ path, pinned }) => `${path} (${pinned})`),
    'A fixture file under tests/fixtures/<batch>/ is byte-identical to a pinned file: link it (pnpm catalog:link-copies --dir <batch>) or read the store',
  ).toEqual([]);
});

it('keeps the one bound copy as a file, with its reason', () => {
  expect(tree.allowed.map(({ path }) => path)).toEqual([boundCopy.path]);
  expect(boundCopy.reason).toMatch(/verification projection/);
});

it('links only to a tracked file in the store, by a relative path, and the store holds no link', () => {
  expect(tree.linkProblems).toEqual([]);
});
