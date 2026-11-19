import { createHash } from 'node:crypto';
import { z } from 'zod';
import { requiredTests, suites } from './matrix';
import { evaluateResults, passedTestSchema } from './results';

export const failureCatalog = [
  ...requiredTests(suites.nightly).map(([file, project, journey]) => ({
    key: createHash('sha256')
      .update(`${project}/${file}/${journey}`)
      .digest('hex')
      .slice(0, 20),
    project,
    journey,
  })),
  {
    key: 'infrastructure',
    project: 'nightly',
    journey: 'setup or incomplete results',
  },
];
// Historical summaries may come from an older project/journey catalog.
// Validate the wire format without requiring those journeys to still exist.
export const historySchema = z.object({
  failures: z.array(
    z
      .string()
      .regex(/^(?:infrastructure|[a-f0-9]{20}:(?:[a-f0-9]{20}|not-run))$/),
  ),
});
export type NightlySummary = z.infer<typeof historySchema>;

export function summarizeNightly(report: unknown): NightlySummary {
  if (evaluateResults(report, suites.nightly)) return { failures: [] };
  const parsed = z
    .object({
      tests: z.array(
        z.object({
          file: z.string(),
          project: z.string(),
          title: z.string(),
          expectedStatus: z.string(),
          tags: z.array(z.string()),
          annotations: z.array(z.string()),
          results: z.array(z.object({ status: z.string(), retry: z.number() })),
        }),
      ),
    })
    .safeParse(report);
  if (!parsed.success) return { failures: ['infrastructure'] };
  const failures = requiredTests(suites.nightly).flatMap(
    ([file, project, title], index) => {
      const tests = parsed.data.tests.filter(
        (test) =>
          test.file === file &&
          test.project === project &&
          test.title === title,
      );
      const passed =
        tests.length === 1 && passedTestSchema.safeParse(tests[0]).success;
      if (passed) return [];
      const evidence = z
        .object({
          evidence: z.array(
            z.object({
              project: z.string(),
              journey: z.string(),
              retry: z.number(),
              failureIdentity: z.string().regex(/^[a-f0-9]{20}$/),
            }),
          ),
        })
        .safeParse(report);
      const attempt = evidence.success
        ? evidence.data.evidence.find(
            (item) =>
              item.project === project &&
              item.journey === title &&
              item.retry === 0,
          )
        : undefined;
      return [
        `${failureCatalog[index]!.key}:${attempt?.failureIdentity ?? 'not-run'}`,
      ];
    },
  );
  return { failures: failures.length ? failures : ['infrastructure'] };
}

// Newest run first. A diagnostic retry never becomes a second nightly run.
export function recurringFailures(history: NightlySummary[]) {
  const window = history.slice(0, 20);
  return [...new Set(window[0]?.failures ?? [])].filter(
    (key) => window.filter((run) => run.failures.includes(key)).length >= 2,
  );
}
