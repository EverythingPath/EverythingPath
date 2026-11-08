// @vitest-environment node
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import {
  focused,
  requiredTests,
  selectSuite,
  suites,
  type Suite,
} from './matrix';
import { evaluateResults } from './results';

it.each([
  ['nightly', suites.nightly, 64],
  ['release', suites.release, 2],
] as const)(
  'requires the exact titles declared by the selected %s journey sources',
  (_name, suite, count) => {
    const required = requiredTests(suite);
    expect(required).toHaveLength(count);
    for (const file of new Set(required.map(([file]) => file))) {
      const source = ts.createSourceFile(
        file,
        readFileSync(join(process.cwd(), 'e2e', file), 'utf8'),
        ts.ScriptTarget.Latest,
      );
      const titles = source.statements.flatMap((statement) => {
        if (!ts.isExpressionStatement(statement)) return [];
        const call = statement.expression;
        if (
          !ts.isCallExpression(call) ||
          !ts.isIdentifier(call.expression) ||
          !['test', 'setup'].includes(call.expression.text)
        )
          return [];
        const title = call.arguments[0];
        return title && ts.isStringLiteral(title) ? [title.text] : [];
      });
      // Each title once, whichever projects require it.
      expect(titles.sort(), file).toEqual(
        [
          ...new Set(
            required
              .filter(([name]) => name === file)
              .map(([, , title]) => title),
          ),
        ].sort(),
      );
    }
  },
);

// A report in which every required result of the suite passed once.
function passing(suite: Suite = suites.mandatory) {
  return {
    status: 'passed',
    errors: 0,
    tests: requiredTests(suite).map(([file, project, title]) => ({
      file,
      project,
      title,
      expectedStatus: 'passed',
      tags: [] as string[],
      annotations: [] as string[],
      results: [{ status: 'passed', retry: 0 }],
    })),
  };
}

it('accepts the mandatory suite: authentication and six journeys, each passing on its first attempt', () => {
  expect(passing().tests).toHaveLength(7);
  expect(evaluateResults(passing())).toBe(true);
  expect(evaluateResults(passing(), suites.mandatory)).toBe(true);
});

it('rejects a mandatory run without any one of its required results', () => {
  for (let index = 0; index < passing().tests.length; index++) {
    const report = passing();
    report.tests.splice(index, 1);
    expect(evaluateResults(report)).toBe(false);
  }
});

it.each([
  'failed',
  'flaky',
  'cancelled',
  'neutral',
  'skipped',
  'timedOut',
  'interrupted',
  undefined,
])('rejects a required result of %s', (status) => {
  for (let index = 0; index < passing().tests.length; index++) {
    const report = passing();
    Object.assign(report.tests[index]!.results[0]!, { status });
    expect(evaluateResults(report)).toBe(false);
  }
});

it('rejects a diagnostic retry even when it passes', () => {
  const report = passing();
  report.tests[1]!.results = [
    { status: 'failed', retry: 0 },
    { status: 'passed', retry: 1 },
  ];
  expect(evaluateResults(report)).toBe(false);
});

it('rejects missing and substituted journeys, malformed reports and runner errors', () => {
  for (const report of [
    undefined,
    {},
    { ...passing(), tests: passing().tests.slice(0, 1) },
    { ...passing(), tests: [passing().tests[0], passing().tests[0]] },
    { ...passing(), errors: 1 },
    { ...passing(), status: 'timedout' },
  ]) {
    expect(evaluateResults(report)).toBe(false);
  }
});

it.each(['only', 'skip', 'fixme', 'fail', 'quarantine', 'quarantined'])(
  'rejects %s annotations even with a passing result',
  (type) => {
    const report = passing();
    Object.assign(report.tests[1]!, { annotations: [type] });
    expect(evaluateResults(report)).toBe(false);
  },
);

it('rejects expected failures and missing attempts', () => {
  const report = passing();
  report.tests[1]!.expectedStatus = 'failed';
  expect(evaluateResults(report)).toBe(false);
  report.tests[1]!.expectedStatus = 'passed';
  report.tests[1]!.results = [];
  expect(evaluateResults(report)).toBe(false);
});

it.each(['@quarantine', '@quarantined'])(
  'rejects the %s tag on a passing journey',
  (tag) => {
    const report = passing();
    Object.assign(report.tests[1]!, { tags: [tag] });
    expect(evaluateResults(report)).toBe(false);
  },
);

it('rejects a journey moved to another project', () => {
  const report = passing();
  report.tests[1]!.project = 'focused-shell';
  expect(evaluateResults(report)).toBe(false);
});

// Each selection is complete only with exactly its own results: a run of
// another scope, or one with an extra journey, never passes for it.
const selections: [string, Suite][] = [
  ['mandatory', suites.mandatory],
  [
    'mandatory with focused groups and live',
    selectSuite({
      suites: ['mandatory', 'focused', 'live'],
      groups: ['sheet', 'week-activity'],
    })!,
  ],
  ['a focused group', focused('week-upkeep')],
  ['live', suites.live],
  ['nightly', suites.nightly],
  ['release', suites.release],
  ['a journey', selectSuite({ journeys: ['week-links.spec.ts'] })!],
];
it.each(selections)('accepts %s only as itself', (_name, suite) => {
  expect(evaluateResults(passing(suite), suite)).toBe(true);
  for (const [, other] of selections)
    if (other !== suite)
      expect(evaluateResults(passing(other), suite)).toBe(false);
});

it('rejects a mandatory run that also ran a focused journey', () => {
  const report = passing();
  report.tests.push(passing(focused('legal')).tests[1]!);
  expect(evaluateResults(report)).toBe(false);
});

it('requires every selected nightly project journey without skips or retry passes', () => {
  const nightly = () => passing(suites.nightly);
  for (let index = 0; index < nightly().tests.length; index++) {
    const missing = nightly();
    missing.tests.splice(index, 1);
    expect(evaluateResults(missing, suites.nightly)).toBe(false);
    const retry = nightly();
    retry.tests[index]!.results = [
      { status: 'failed', retry: 0 },
      { status: 'passed', retry: 1 },
    ];
    expect(evaluateResults(retry, suites.nightly)).toBe(false);
    const skipped = nightly();
    Object.assign(skipped.tests[index]!, { annotations: ['skip'] });
    expect(evaluateResults(skipped, suites.nightly)).toBe(false);
  }
});
