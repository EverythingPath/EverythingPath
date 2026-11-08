import { z } from 'zod';
import {
  requiredTests,
  suites,
  suiteSchema,
} from '../../e2e/support/matrix.ts';
import { evaluateResults } from '../../e2e/support/results.ts';
import type { TestResults } from './check-coverage.ts';

// Each service tag and the journey file whose every journey must have passed
// in the report. `live.cutover` has no journey since #752 deleted
// `canonical-cutover` (D-1), so no report provides it.
const serviceFiles = {
  workspace: 'canonical-workspace.spec.ts',
  persistence: 'canonical-persistence.spec.ts',
  confirmation: 'canonical-confirmation.spec.ts',
} as const;

// The runner independently checks exact files, titles, projects,
// authentication, and first-attempt success for the report's own recorded
// scope before any service evidence counts. A tag counts only if that scope
// ran every journey of its file (since #752 they span the mandatory, focused
// and live suites; a nightly run has them all).
export function collectServiceEvidence(
  report: unknown,
  sourceFingerprint: string,
): TestResults {
  const provenance = z
    .object({ sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/) })
    .safeParse(report);
  if (
    !provenance.success ||
    provenance.data.sourceFingerprint !== sourceFingerprint
  )
    throw new Error('Service evidence has missing or stale source fingerprint');
  const suite = z.object({ suite: suiteSchema }).safeParse(report);
  if (!suite.success || !evaluateResults(report, suite.data.suite))
    throw new Error('Service evidence is incomplete or unsuccessful');
  const ran = requiredTests(suite.data.suite);
  const names = Object.entries(serviceFiles).flatMap(([name, file]) =>
    requiredTests(suites.nightly)
      .filter(([candidate]) => candidate === file)
      .every(([, , title]) =>
        ran.some(
          ([ranFile, , ranTitle]) => ranFile === file && ranTitle === title,
        ),
      )
      ? [name]
      : [],
  );
  return {
    success: true,
    testResults: names.map((name) => ({
      name: `e2e/canonical-${name}.spec.ts`,
      status: 'passed',
      assertionResults: [{ fullName: `[live.${name}]`, status: 'passed' }],
    })),
  };
}
