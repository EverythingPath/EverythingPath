// @vitest-environment node
import { expect, test } from 'vitest';
import {
  focused,
  requiredTests,
  selectSuite,
  suites,
  type Suite,
} from '../../e2e/support/matrix';
import { checkCoverage } from './check-coverage';
import { coverageCatalog } from './coverage-catalog';
import { collectServiceEvidence } from './service-evidence';

const sourceFingerprint = 'a'.repeat(64);
function report(suite: Suite = suites.nightly) {
  return {
    sourceFingerprint,
    suite,
    status: 'passed',
    errors: 0,
    tests: requiredTests(suite).map(([file, project, title]) => ({
      file,
      project,
      title,
      expectedStatus: 'passed',
      tags: [],
      annotations: [],
      results: [{ status: 'passed', retry: 0 }],
    })),
  };
}
const names = (suite: Suite) =>
  collectServiceEvidence(report(suite), sourceFingerprint).testResults.flatMap(
    (file) => file.assertionResults.map((test) => test.fullName),
  );

test('only the complete first-attempt deployed run for this source provides service evidence', () => {
  // No journey provides live.cutover since #752 deleted canonical-cutover.
  expect(names(suites.nightly)).toEqual([
    '[live.workspace]',
    '[live.persistence]',
    '[live.confirmation]',
  ]);
  expect(() => collectServiceEvidence(report(), 'b'.repeat(64))).toThrow(
    'source',
  );
  const missing = report();
  missing.tests.pop();
  expect(() => collectServiceEvidence(missing, sourceFingerprint)).toThrow(
    'incomplete',
  );
  const retry = report();
  retry.tests[0]!.results = [
    { status: 'failed', retry: 0 },
    { status: 'passed', retry: 1 },
  ];
  expect(() => collectServiceEvidence(retry, sourceFingerprint)).toThrow(
    'incomplete',
  );
  expect(() =>
    collectServiceEvidence(
      { ...report(), sourceFingerprint: undefined },
      sourceFingerprint,
    ),
  ).toThrow('source');
  // A report must name the scope it was evaluated against.
  expect(() =>
    collectServiceEvidence(
      { ...report(), suite: undefined },
      sourceFingerprint,
    ),
  ).toThrow('incomplete');
});

test('a tag counts only when the run included every journey of its file', () => {
  // The mandatory suite runs two of the thirteen Workspace journeys and no
  // contract.
  expect(names(suites.mandatory)).toEqual([]);
  expect(names(suites.live)).toEqual([
    '[live.persistence]',
    '[live.confirmation]',
  ]);
  expect(
    names(
      selectSuite({
        suites: ['mandatory', 'focused', 'live'],
        groups: [
          'setup-corrections',
          'week-upkeep',
          'week-activity',
          'week-event-review',
          'week-confirmation',
        ],
      })!,
    ),
  ).toEqual(['[live.workspace]', '[live.persistence]', '[live.confirmation]']);
  expect(names(focused('week-upkeep'))).toEqual([]);
});

test('a complete nightly report supplies every service test the rules catalog maps', () => {
  const serviceResults = collectServiceEvidence(report(), sourceFingerprint);
  // No local results or sources here: only the service references matter.
  const { errors } = checkCoverage(
    coverageCatalog,
    { success: true, testResults: [] },
    {},
    { serviceResults },
  );
  expect(errors.filter((error) => error.includes(' test live.'))).toEqual([]);
  expect(
    coverageCatalog.rules.flatMap((rule) =>
      rule.cases.flatMap((entry) =>
        'serviceTests' in entry ? (entry.serviceTests ?? []) : [],
      ),
    ),
  ).not.toContain('live.cutover');
});
