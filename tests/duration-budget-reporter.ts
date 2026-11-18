import path from 'node:path';
import type { Reporter, TestCase } from 'vitest/node';

declare module 'vitest' {
  interface TaskMeta {
    /** The test's own timeout, recorded by `vitest.setup.ts`. */
    timeout?: number;
  }
}

/**
 * The duration budget: a test that takes half its timeout is listed after the
 * run, so a slowdown surfaces before full-suite load turns it into a timeout.
 * JSON reports carry the same inputs as `duration` and `meta.timeout`.
 */
const budgetShare = 0.5;
const listedTests = 10;

type MeasuredTest = {
  file: string;
  name: string;
  duration?: number;
  timeout?: number;
};

export function formatDurationBudget(tests: readonly MeasuredTest[]) {
  const over = tests
    .flatMap(({ file, name, duration, timeout }) =>
      duration !== undefined && timeout
        ? [{ file, name, duration, timeout, share: duration / timeout }]
        : [],
    )
    .filter((row) => row.share >= budgetShare)
    .sort((a, b) => b.share - a.share);
  if (!over.length) return '';
  return [
    `Duration budget: ${over.length} tests took at least half their timeout.`,
    ...over
      .slice(0, listedTests)
      .map(
        (row) =>
          `${`${Math.round(row.share * 100)}%`.padStart(6)}  ${row.file} > ${row.name} (${Math.round(row.duration)} of ${row.timeout} ms)`,
      ),
    ...(over.length > listedTests
      ? [`  … and ${over.length - listedTests} more`]
      : []),
  ].join('\n');
}

export default class DurationBudgetReporter implements Reporter {
  private tests: MeasuredTest[] = [];

  onTestCaseResult(testCase: TestCase) {
    this.tests.push({
      file: path.relative(process.cwd(), testCase.module.moduleId),
      name: testCase.fullName,
      duration: testCase.diagnostic()?.duration,
      timeout: testCase.meta().timeout,
    });
  }

  onTestRunEnd() {
    const report = formatDurationBudget(this.tests);
    if (report) process.stdout.write(`\n${report}\n`);
    this.tests = [];
  }
}
