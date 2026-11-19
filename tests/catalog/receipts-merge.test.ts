import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { runCapturedProcess } from '../../scripts/catalog/process';
import {
  mergeReviewReceipts,
  type ReviewReceiptsMerge,
  reviewReceiptsPath,
} from '../../scripts/catalog/receipts-merge.ts';

// The review receipts' union catalog:merge writes for a rebase (regen-carry,
// code-regen-v3): append-only, by runId; gate_core.receipts_union proves the
// same rule from Git objects.
const sha = (digit: string) => digit.repeat(64);
const receipt = (runId: string, ids: string[] = [runId]) => ({
  runId,
  reportSha256: sha('0'),
  covers: ids.map((id) => ({
    id,
    sources: [{ subject: `pcgen:${id}`, sourceSha256: sha('1') }],
    payloadSha256: sha('2'),
  })),
});
const file = (...receipts: ReturnType<typeof receipt>[]) =>
  `${JSON.stringify({ receipts }, null, 2)}\n`;
const legacy = (n: number) => `reviewer-20261018-08162${n}-1216172`;

describe('mergeReviewReceipts', () => {
  it("is the base movement's list, then the slice's additions in its order", () => {
    const result = mergeReviewReceipts({
      base: file(receipt(legacy(0))),
      ours: file(receipt(legacy(0)), receipt(legacy(1))),
      theirs: file(receipt(legacy(0)), receipt(legacy(3)), receipt(legacy(2))),
    });
    expect(result).toEqual({
      kind: 'merged',
      text: file(
        receipt(legacy(0)),
        receipt(legacy(1)),
        receipt(legacy(3)),
        receipt(legacy(2)),
      ),
    });
  });

  it('takes a receipt both sides added once when it is the same', () => {
    const result = mergeReviewReceipts({
      base: file(receipt(legacy(0))),
      ours: file(receipt(legacy(0)), receipt(legacy(1))),
      theirs: file(receipt(legacy(0)), receipt(legacy(1))),
    });
    expect(result).toEqual({
      kind: 'merged',
      text: file(receipt(legacy(0)), receipt(legacy(1))),
    });
  });

  it('refuses a receipt the two sides hold differently, a covers list one side extended included', () => {
    const result = mergeReviewReceipts({
      base: file(receipt(legacy(0))),
      ours: file(receipt(legacy(0)), receipt(legacy(1))),
      theirs: file(
        receipt(legacy(0), [legacy(0), 'another record']),
        receipt(legacy(1), [legacy(1), 'another record']),
      ),
    });
    expect(result).toEqual({
      kind: 'conflicts',
      conflicts: [
        `review receipt ${legacy(0)} is changed by a side`,
        `review receipt ${legacy(1)} is held differently on the two sides`,
      ],
    });
  });

  it('refuses a removed receipt: the receipts are append-only', () => {
    const result = mergeReviewReceipts({
      base: file(receipt(legacy(0)), receipt(legacy(1))),
      ours: file(receipt(legacy(0)), receipt(legacy(1)), receipt(legacy(2))),
      theirs: file(receipt(legacy(1)), receipt(legacy(3))),
    });
    expect(result).toEqual({
      kind: 'conflicts',
      conflicts: [`review receipt ${legacy(0)} is removed by one side`],
    });
  });

  it('refuses an existing receipt both sides edited alike: the receipts are append-only', () => {
    // Review r1: the same covers extension on both sides; then the same
    // report digest and the same key order changed on both sides.
    const extended = receipt(legacy(0), [legacy(0), 'another record']);
    const redigested = { ...receipt(legacy(0)), reportSha256: sha('9') };
    const { runId, ...rest } = receipt(legacy(0));
    const reordered = { ...rest, runId };
    for (const edited of [extended, redigested, reordered]) {
      const result = mergeReviewReceipts({
        base: file(receipt(legacy(0))),
        ours: file(edited, receipt(legacy(1))),
        theirs: file(edited, receipt(legacy(2))),
      });
      expect(result).toEqual({
        kind: 'conflicts',
        conflicts: [`review receipt ${legacy(0)} is changed by a side`],
      });
    }
  });

  it('is a result its kind discriminates, and a refusal names at least one conflict', () => {
    // Review r2 standards #4: the result permitted a refusal with an empty
    // conflict list, and told its variants apart by text alone.
    expectTypeOf<
      Extract<ReviewReceiptsMerge, { kind: 'conflicts' }>['conflicts']
    >().toEqualTypeOf<readonly [string, ...string[]]>();
    expectTypeOf<
      Extract<ReviewReceiptsMerge, { kind: 'merged' }>
    >().toEqualTypeOf<{ kind: 'merged'; text: string }>();
    // @ts-expect-error a refusal with no conflicts is not a result
    const empty: ReviewReceiptsMerge = { kind: 'conflicts', conflicts: [] };
    const both: ReviewReceiptsMerge = {
      kind: 'merged',
      text: '',
      // @ts-expect-error a merged result carries no conflicts
      conflicts: [],
    };
    expect([empty, both]).toHaveLength(2);
  });

  it('refuses a side that is not a receipts file', () => {
    expect(() =>
      mergeReviewReceipts({
        base: file(),
        ours: file(),
        theirs: '{"receipts": [{"runId": "x"}]}',
      }),
    ).toThrow(/theirs/);
  });
});

describe('catalog:merge with the review receipts', () => {
  const temporary: string[] = [];
  afterEach(async () => {
    await Promise.all(
      temporary.map((path) => rm(path, { recursive: true, force: true })),
    );
  });

  it('writes the union to the file it names, as code-rebase.sh runs it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'receipts-merge-'));
    temporary.push(root);
    const target = join(root, reviewReceiptsPath);
    await mkdir(dirname(target), { recursive: true });
    const sides = {
      base: file(receipt(legacy(0))),
      ours: file(receipt(legacy(0)), receipt(legacy(1))),
      theirs: file(receipt(legacy(0)), receipt(legacy(2))),
    };
    for (const [name, text] of Object.entries(sides))
      await writeFile(join(root, `${name}.json`), text);
    await writeFile(target, sides.ours);
    const git = runCapturedProcess({
      command: 'git',
      args: ['init', '-q'],
      cwd: root,
    });
    expect(git.status).toBe(0);
    const merge = runCapturedProcess({
      command: process.execPath,
      args: [
        '--import',
        fileURLToPath(import.meta.resolve('tsx')),
        resolve('scripts/catalog-merge.ts'),
        reviewReceiptsPath,
        '--base',
        'base.json',
        '--ours',
        'ours.json',
        '--theirs',
        'theirs.json',
      ],
      cwd: root,
    });
    expect(merge.stderr).toBe('');
    expect(merge.status).toBe(0);
    expect(await readFile(target, 'utf8')).toBe(
      file(receipt(legacy(0)), receipt(legacy(1)), receipt(legacy(2))),
    );
  }, 30_000);
});
