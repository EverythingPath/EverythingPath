// @vitest-environment node
import { expect, test } from 'vitest';
import { checkCoverage } from './check-coverage';

test('a named passing behavior establishes coverage; a missing test does not', () => {
  const catalog = fixtureCatalog();
  const result = checkCoverage(
    catalog,
    {
      success: true,
      testResults: [
        {
          name: '/repo/rank.test.ts',
          status: 'passed',
          assertionResults: [
            {
              fullName: '[rules.F01.initial-rank] starts at rank 1',
              status: 'passed',
            },
          ],
        },
      ],
    },
    { 'rules.md': '## Rank\n\nInitial rank is 1.\n' },
  );
  expect(result.covered).toEqual(['F01.initial-rank']);
  const missing = checkCoverage(
    catalog,
    { success: true, testResults: [] },
    {},
  );
  expect(missing.covered).toEqual([]);
  expect(missing.errors).toContain(
    'F01.initial-rank: missing test rules.F01.initial-rank',
  );
});

test.each(['failed', 'skipped', 'pending', 'todo', 'disabled'])(
  '%s referenced tests never count as coverage, even with a known gap',
  (status) => {
    const catalog = fixtureCatalog();
    catalog.rules[0]!.cases[0]!.gap = 'Still migrating';
    const result = checkCoverage(catalog, report(status), fixtureFiles);
    expect(result.covered).toEqual([]);
    expect(result.errors).toContain(
      'F01.initial-rank: test rules.F01.initial-rank did not pass',
    );
  },
);

test('known gaps are allowed during extraction but fail the strict completeness gate', () => {
  const catalog = fixtureCatalog();
  catalog.rules[0]!.cases[0]!.tests = [];
  catalog.rules[0]!.cases[0]!.gap = 'Projection not extracted';
  expect(checkCoverage(catalog, report(), fixtureFiles).errors).toEqual([]);
  expect(
    checkCoverage(catalog, report(), fixtureFiles, { strict: true }).errors,
  ).toContain('Completeness gate: 2 remaining gaps');
});

test('service evidence is required independently of passing local tests', () => {
  const catalog = fixtureCatalog();
  const entry = catalog.rules[0]!.cases[0]!;
  Object.assign(entry, { serviceTests: ['live.workspace'] });
  const missing = checkCoverage(catalog, report(), fixtureFiles);
  expect(missing.covered).toEqual([]);
  expect(missing.gaps).toContain(
    'F01.initial-rank: missing service evidence live.workspace',
  );
  const serviceResults = report();
  serviceResults.testResults[0]!.assertionResults[0]!.fullName =
    '[live.workspace] two players';
  expect(
    checkCoverage(catalog, report(), fixtureFiles, { serviceResults }).covered,
  ).toEqual(['F01.initial-rank']);
  serviceResults.testResults[0]!.assertionResults[0]!.status = 'skipped';
  expect(
    checkCoverage(catalog, report(), fixtureFiles, { serviceResults }).errors,
  ).toContain('F01.initial-rank: test live.workspace did not pass');
});

test('source edits invalidate coverage and new sections require an explicit mapping or review gap', () => {
  const result = checkCoverage(fixtureCatalog(), report(), {
    'rules.md': '## Rank\n\nInitial rank is 2.\n\n## New rule\nNew behavior.\n',
  });
  expect(result.errors).toContain('rank: stale source fingerprint');
  expect(result.errors).toContain('rules.md: unmapped section ## New rule');
  expect(result.covered).toEqual([]);
});

test('removed audit rows, unknown sources, duplicate case IDs and untracked cases fail', () => {
  const catalog = fixtureCatalog();
  catalog.auditIds.push('F02');
  const rule = catalog.rules[0]!;
  rule.sources.push('missing');
  rule.cases.push({ ...rule.cases[0]!, tests: [], gap: null });
  const result = checkCoverage(catalog, report(), fixtureFiles);
  expect(result.errors).toContain('F02: unmapped audit entry');
  expect(result.errors).toContain('F01: unknown source missing');
  expect(result.errors).toContain('F01.initial-rank: duplicate case ID');
  expect(result.errors).toContain('F01.initial-rank: unmapped case');
});

test('a failed suite, failed run, or duplicate named test cannot provide passing evidence', () => {
  const failedSuite = report();
  failedSuite.testResults[0]!.status = 'failed';
  expect(
    checkCoverage(fixtureCatalog(), failedSuite, fixtureFiles).covered,
  ).toEqual([]);
  const failedRun = report();
  failedRun.success = false;
  expect(
    checkCoverage(fixtureCatalog(), failedRun, fixtureFiles).errors,
  ).toContain('Collected test run failed');
  const duplicate = report();
  duplicate.testResults.push(duplicate.testResults[0]!);
  expect(
    checkCoverage(fixtureCatalog(), duplicate, fixtureFiles).errors,
  ).toContain('F01.initial-rank: ambiguous test rules.F01.initial-rank');
});

import { createHash } from 'node:crypto';
import type { CoverageCatalog } from './check-coverage';
const fixtureFiles = { 'rules.md': '## Rank\n\nInitial rank is 1.\n' };
function fixtureCatalog(): CoverageCatalog {
  return {
    auditIds: ['F01'],
    sources: [
      {
        id: 'rank',
        path: 'rules.md',
        heading: '## Rank',
        fingerprint: createHash('sha256')
          .update(fixtureFiles['rules.md'])
          .digest('hex'),
      },
    ],
    rules: [
      {
        id: 'F01',
        sources: ['rank'],
        cases: [
          {
            id: 'initial-rank',
            checkpoint: '4-foundations',
            expected: 'Phase View starts at rank 1.',
            plannedTests: ['rules.F01.initial-rank'],
            tests: ['rules.F01.initial-rank'],
            gap: null,
          },
        ],
      },
    ],
    corpusReview: { gap: 'Human review pending.' },
  };
}
function report(status = 'passed') {
  return {
    success: true,
    testResults: [
      {
        name: '/repo/rank.test.ts',
        status: 'passed',
        assertionResults: [
          { fullName: '[rules.F01.initial-rank] starts at rank 1', status },
        ],
      },
    ],
  };
}

test('deleting an expanded case is detected against the independently pinned inventory', () => {
  const result = checkCoverage(fixtureCatalog(), report(), fixtureFiles, {
    requiredCases: ['F01.initial-rank', 'F01.focus'],
  });
  expect(result.errors).toContain('F01.focus: unmapped inventoried case');
});

test('removing every source from a corpus file cannot hide its sections', () => {
  const catalog = fixtureCatalog();
  catalog.sources = [];
  const result = checkCoverage(catalog, report(), fixtureFiles, {
    corpusPaths: ['rules.md'],
  });
  expect(result.errors).toContain('rules.md: unmapped section ## Rank');
});

test('same-named sections are distinguished by their parent heading', () => {
  const catalog = fixtureCatalog();
  const text =
    '## Terminology\n### Rank\nInitial rank is 1.\n## Teams\n### Rank\nTeam rank.\n';
  catalog.sources = [
    {
      id: 'rank',
      path: 'rules.md',
      heading: '### Rank',
      parentHeading: '## Terminology',
      fingerprint: createHash('sha256')
        .update('### Rank\nInitial rank is 1.\n')
        .digest('hex'),
    },
  ];
  const result = checkCoverage(catalog, report(), { 'rules.md': text });
  expect(result.covered).toEqual(['F01.initial-rank']);
  expect(result.errors).toContain('rules.md: unmapped section ### Rank');
  expect(result.errors).not.toContain(
    'rank: missing or ambiguous source reference',
  );
});
