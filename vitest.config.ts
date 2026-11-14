import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { lightLaneReaderGuardPlugin } from './tests/light-lane-reader-guard';
import { WeightedSequencer } from './tests/shard-plan';

export default defineConfig({
  // Refuses module loads of lane-eligible files (tests/light-lane-reader-guard.ts).
  plugins: [lightLaneReaderGuardPlugin(__dirname)],
  test: {
    environment: 'jsdom',
    // The duration budget lists tests that took half their timeout or more.
    // A command line `--reporter` replaces this list, so add it there too.
    reporters: ['default', './tests/duration-budget-reporter.ts'],
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'convex/**/*.test.ts',
      'tests/**/*.test.ts',
      'e2e/support/**/*.test.ts',
    ],
    // UI tests are CPU-bound in jsdom (role queries spend most of their time
    // in getComputedStyle). The 4-vCPU CI runner runs them about 2.2x slower
    // than a local run pinned to 4 CPUs: [rules.P83.details] takes 2.2 s
    // locally and hit 5 s in CI, where 33 tests exceed half the default.
    // Local runs keep Vitest's 5 s default so slow tests stay visible.
    // With CI=true (the gate host and GitHub CI) the limit is 3x the worst
    // test on it in GitHub runs 41593918959 and 41596995308: tests that timed
    // out at 15 s ran up to 3.06x their gate-host time, so
    // release-operator's 11 s gated build may take about 34 s there. Hooks
    // get the same limit: its shared beforeAll hit the 10 s hook default,
    // which skipped the file's tests. Tests that need more set their own.
    testTimeout: process.env.CI === 'true' ? 120_000 : 5_000,
    hookTimeout: process.env.CI === 'true' ? 120_000 : 10_000,
    // `--shard=i/N` (the gate's CI shards) deals files by recorded duration,
    // Chromium's in shard 1 alone (tests/shard-plan.ts); other runs keep
    // Vitest's own order.
    sequence: { sequencer: WeightedSequencer },
    clearMocks: true,
    mockReset: true,
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
      '@convex': path.resolve(__dirname, './convex'),
    },
  },
});
