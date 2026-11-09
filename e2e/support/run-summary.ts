import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { z } from 'zod';
import { finalizeProgress, progressFile } from './progress';
import { describeSuite, requiredTests, suiteSchema } from './matrix';

const reportSchema = z.object({
  status: z.string(),
  suite: z.unknown().optional(),
  preparation: z.string().optional(),
  tests: z
    .array(
      z.object({
        project: z.string().optional(),
        title: z.string(),
        results: z.array(z.object({ status: z.string() })),
      }),
    )
    .default([]),
});
type Report = z.infer<typeof reportSchema>;
type Finalized = Awaited<ReturnType<typeof finalizeProgress>>;
type NamedTest = { project?: string; title: string };

const nameTest = ({ project, title }: NamedTest) => `${project}: ${title}`;
// The run's exact scope, rebuilt from its recorded suite selection; runs
// recorded before #752 have none.
function describeScope(suite: unknown) {
  const parsed = suiteSchema.safeParse(suite);
  return parsed.success
    ? `; scope: ${describeSuite(parsed.data)}, ${requiredTests(parsed.data).length} required results`
    : '';
}
// A reused preparation never qualifies (#754); its line says so.
const describePreparation = (preparation: unknown) =>
  preparation === 'reused'
    ? '; preparation: reused (diagnostic, not qualifying)'
    : '';
const listTests = (tests: NamedTest[]) =>
  tests.length ? `: ${tests.map(nameTest).join('; ')}` : '';

function describeReport(report: Report) {
  const isPassed = (test: Report['tests'][number]) =>
    test.results.length > 0 &&
    test.results.every(({ status }) => status === 'passed');
  const failed = report.tests.filter(
    (test) =>
      !isPassed(test) &&
      !test.results.every(({ status }) => status === 'skipped'),
  );
  return `e2e: ${report.status}: ${report.tests.filter(isPassed).length} journeys passed, ${failed.length} failed${listTests(failed)}${describeScope(report.suite)}${describePreparation(report.preparation)}`;
}

function describeInterruption({
  progress,
  exitCode,
  hasReport,
}: {
  progress: Finalized;
  exitCode: string;
  hasReport: boolean;
}) {
  const { completed, interrupted, unstarted } = progress;
  const failed = completed.filter(({ status }) => status !== 'passed');
  const failures = failed.length
    ? `: ${failed.map((test) => `${nameTest(test)} [${test.status}]`).join('; ')}`
    : '';
  return `e2e: interrupted (exit ${exitCode}${hasReport ? '' : ', no Playwright report'}): ${completed.length} completed (${completed.length - failed.length} passed, ${failed.length} failed${failures}), ${interrupted.length} interrupted${listTests(interrupted)}, ${unstarted.length} not started${listTests(unstarted)}${describeScope(progress.suite)}${describePreparation(progress.preparation)}`;
}

async function findRunFile({
  directory,
  name,
}: {
  directory: string;
  name: string;
}) {
  const entries = await readdir(directory, { recursive: true }).catch(() => []);
  const found = entries.find((entry) => basename(entry) === name);
  return found === undefined ? undefined : join(directory, found);
}

/**
 * The one checkpoint-finalization step after a run, for the runner's wrapper
 * (`e2e-branch.sh`, through `e2e/finalize-evidence.ts`): finalizes the
 * `progress.json` under `directory` (`finalizeProgress`) and returns the
 * one-line result, Playwright's report or an interrupted run's completed,
 * interrupted and unstarted tests.
 */
export async function finalizeRunEvidence({
  directory,
  exitCode,
}: {
  directory: string;
  exitCode: number | string;
}) {
  const reportPath = await findRunFile({ directory, name: 'report.json' });
  const progressPath = await findRunFile({ directory, name: progressFile });
  const report = reportPath
    ? reportSchema.parse(JSON.parse(await readFile(reportPath, 'utf8')))
    : undefined;
  // A checkpoint without a test plan predates #729 and cannot be finalized.
  const progress = progressPath
    ? await finalizeProgress(dirname(progressPath)).catch(() => undefined)
    : undefined;
  if (progress?.status === 'interrupted' || (progress && !report))
    return describeInterruption({
      progress,
      exitCode: String(exitCode),
      hasReport: report !== undefined,
    });
  if (report) return describeReport(report);
  return progressPath
    ? `e2e: exit ${exitCode}, no Playwright report; the checkpoint has no test plan`
    : `e2e: exit ${exitCode}, no Playwright report or progress checkpoint produced`;
}
