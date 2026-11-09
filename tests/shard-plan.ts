import { readFileSync } from 'node:fs';
import path from 'node:path';
import { BaseSequencer, type TestSpecification } from 'vitest/node';

/**
 * The suite's `--shard=i/N` plan for the gate's CI shards (speed-ci-shards fix r1).
 * Vitest's own sharding splits by file count: run 42222977832 ran eight
 * count-equal shards in 405 to 1050 s. This plan deals files by their recorded
 * duration instead (tests/shard-weights.json, written by
 * scripts/orchestration/shard_weights.py from a gate run's shard reports).
 *
 * - Shard 1 holds exactly the files that launch Chromium, so only shard 1
 *   installs it (ci.yaml). A slow apt mirror then delays one light shard,
 *   not every shard.
 * - Shards 2..N take every other file by longest-processing-time:
 *   heaviest first, each to the least-loaded shard, with ties broken by path
 *   and by the lower index.
 *
 * Every shard sees the same checkout and computes the same plan, so each file
 * lands in exactly one shard by construction. The gate's verifier also checks
 * that: the shards' reports must compose the merged report. Runs without
 * `--shard` keep Vitest's own order.
 */
export type ShardWeights = {
  kind: 'shard-weights-v1';
  source: string;
  fileOverheadSeconds: number;
  defaultSeconds: number;
  browserFiles: string[];
  seconds: Record<string, number>;
};

/** tests/shard-weights.json under the repository root. */
export function readShardWeights(root: string): ShardWeights {
  const file = path.join(root, 'tests', 'shard-weights.json');
  const value = JSON.parse(readFileSync(file, 'utf8')) as ShardWeights;
  if (value.kind !== 'shard-weights-v1')
    throw new Error(`${file}: not shard-weights-v1`);
  return value;
}

export function fileWeight(file: string, weights: ShardWeights) {
  return (
    (weights.seconds[file] ?? weights.defaultSeconds) +
    weights.fileOverheadSeconds
  );
}

const byWeight = (weights: ShardWeights) => (a: string, b: string) =>
  fileWeight(b, weights) - fileWeight(a, weights) ||
  (a < b ? -1 : a > b ? 1 : 0);

/**
 * The files of each shard, index 0 being shard 1. `files` are paths relative
 * to the repository root, in any order.
 */
export function shardPlan(
  files: readonly string[],
  count: number,
  weights: ShardWeights,
): string[][] {
  if (!Number.isInteger(count) || count < 1)
    throw new Error(`invalid shard count ${count}`);
  const unique = [...new Set(files)];
  const browser = new Set(weights.browserFiles);
  const pinned = new Set(
    count > 1 ? unique.filter((file) => browser.has(file)) : [],
  );
  const rest = unique
    .filter((file) => !pinned.has(file))
    .sort(byWeight(weights));
  const bins = Array.from({ length: pinned.size ? count - 1 : count }, () => ({
    load: 0,
    files: [] as string[],
  }));
  for (const file of rest) {
    const bin = bins.reduce((best, next) =>
      next.load < best.load ? next : best,
    );
    bin.load += fileWeight(file, weights);
    bin.files.push(file);
  }
  return [
    ...(pinned.size ? [[...pinned].sort()] : []),
    ...bins.map((bin) => bin.files),
  ];
}

/** The repository-relative path Vitest's own sharding hashes. */
const relative = (root: string, spec: TestSpecification) =>
  path.relative(root, spec.moduleId).split(path.sep).join('/');

/** vitest.config.ts's sequencer: shardPlan for `--shard`, heaviest first within a shard. */
export class WeightedSequencer extends BaseSequencer {
  override async shard(files: TestSpecification[]) {
    const { index, count } = this.ctx.config.shard!;
    const root = this.ctx.config.root;
    const mine = new Set(
      shardPlan(
        files.map((spec) => relative(root, spec)),
        count,
        readShardWeights(root),
      )[index - 1],
    );
    return files.filter((spec) => mine.has(relative(root, spec)));
  }

  override async sort(files: TestSpecification[]) {
    if (!this.ctx.config.shard) return super.sort(files);
    const root = this.ctx.config.root;
    const order = byWeight(readShardWeights(root));
    return [...files].sort((a, b) =>
      order(relative(root, a), relative(root, b)),
    );
  }
}
