// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  fileWeight,
  readShardWeights,
  shardPlan,
  type ShardWeights,
} from './shard-plan';

const root = process.cwd();
const weights = readShardWeights(root);

// The suite's test files, as vitest.config.ts includes them.
const included =
  /^(?:src\/.*\.test\.tsx?|convex\/.*\.test\.ts|tests\/.*\.test\.ts|e2e\/support\/.*\.test\.ts)$/;
const suiteFiles = ['src', 'convex', 'tests', 'e2e/support']
  .flatMap((dir) =>
    readdirSync(path.join(root, dir), {
      recursive: true,
      encoding: 'utf8',
    }).map((file) => `${dir}/${file.split(path.sep).join('/')}`),
  )
  .filter((file) => included.test(file) && !file.includes('/node_modules/'))
  .sort();

const synthetic: ShardWeights = {
  kind: 'shard-weights-v1',
  source: 'fixture',
  fileOverheadSeconds: 1,
  defaultSeconds: 1,
  browserFiles: ['e2e/support/browser.test.ts'],
  seconds: { 'tests/heavy.test.ts': 9, 'tests/mid.test.ts': 4 },
};

const workflowShards = () => {
  const job = (
    parse(
      readFileSync(path.join(root, '.github/workflows/ci.yaml'), 'utf8'),
    ) as {
      jobs: Record<
        string,
        {
          strategy: { matrix: { index: number[] } };
          steps: { name?: string; if?: string; run?: string }[];
        }
      >;
    }
  ).jobs['remote-shard'];
  if (!job) throw new Error('ci.yaml has no remote-shard job');
  return job;
};

describe('the gate shard plan', () => {
  it.each([1, 2, 3, 8, 11, 12])(
    'deals every suite file to exactly one of %i shards, whatever the input order',
    (count) => {
      const plan = shardPlan(suiteFiles, count, weights);
      expect(plan).toHaveLength(count);
      const dealt = plan.flat();
      expect(dealt).toHaveLength(suiteFiles.length);
      expect(new Set(dealt).size).toBe(suiteFiles.length);
      expect([...dealt].sort()).toEqual(suiteFiles);
      expect(plan.every((files) => files.length > 0)).toBe(true);
      expect(shardPlan([...suiteFiles].reverse(), count, weights)).toEqual(
        plan,
      );
    },
  );

  it('puts exactly the files that launch Chromium in shard 1, alone', () => {
    const launches = suiteFiles.filter((file) =>
      /import\s*\{[^}]*\bchromium\b[^}]*\}\s*from\s*'(?:@playwright\/test|playwright(?:-core)?)'/.test(
        readFileSync(path.join(root, file), 'utf8'),
      ),
    );
    expect(launches).toEqual(weights.browserFiles);
    const count = workflowShards().strategy.matrix.index.length;
    expect(shardPlan(suiteFiles, count, weights)[0]).toEqual(
      weights.browserFiles,
    );
    // ci.yaml installs Chromium in shard 1 only.
    const install = workflowShards().steps.find((step) =>
      (step.run ?? '').includes(
        'playwright install --with-deps --only-shell chromium',
      ),
    )!;
    expect(install.if).toBe('${{ matrix.index == 1 }}');
  });

  it('balances the rest by weight: heaviest first, to the least-loaded shard, ties to the lower index', () => {
    const files = [
      'tests/a.test.ts',
      'tests/b.test.ts',
      'tests/heavy.test.ts',
      'tests/mid.test.ts',
      'e2e/support/browser.test.ts',
    ];
    expect(shardPlan(files, 3, synthetic)).toEqual([
      ['e2e/support/browser.test.ts'],
      ['tests/heavy.test.ts'],
      ['tests/mid.test.ts', 'tests/a.test.ts', 'tests/b.test.ts'],
    ]);
    // One shard takes everything, the browser files included; without browser files every shard balances.
    expect(shardPlan(files, 1, synthetic).flat().sort()).toEqual(
      [...files].sort(),
    );
    expect(shardPlan(files.slice(0, 4), 2, synthetic)).toEqual([
      ['tests/heavy.test.ts'],
      ['tests/mid.test.ts', 'tests/a.test.ts', 'tests/b.test.ts'],
    ]);
    expect(() => shardPlan(files, 0, synthetic)).toThrow(
      'invalid shard count 0',
    );
  });

  it('keeps the slowest projected shard of the committed matrix within the ten-minute suite budget', () => {
    const count = workflowShards().strategy.matrix.index.length;
    const loads = shardPlan(suiteFiles, count, weights).map(
      (files) =>
        files.reduce((sum, file) => sum + fileWeight(file, weights), 0) / 2,
    );
    expect(Math.max(...loads.slice(1))).toBeLessThan(600);
    expect(loads[0]).toBeLessThan(120);
  });

  it('weighs an unmeasured file at the default', () => {
    expect(fileWeight('tests/unmeasured.test.ts', weights)).toBe(
      weights.defaultSeconds + weights.fileOverheadSeconds,
    );
  });
});
