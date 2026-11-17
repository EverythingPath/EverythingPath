import { createHash } from 'node:crypto';

export interface CoverageCase {
  id: string;
  checkpoint: string;
  expected: string;
  plannedTests: string[];
  tests: string[];
  serviceTests?: string[];
  gap: string | null;
}

export interface CoverageCatalog {
  auditIds: string[];
  sources: {
    id: string;
    path: string;
    // null fingerprints the complete document (audit/accepted decisions).
    heading: string | null;
    parentHeading?: string;
    fingerprint: string;
    reviewGap?: string | null;
  }[];
  rules: {
    id: string;
    sources: string[];
    decisions?: string[];
    cases: CoverageCase[];
  }[];
  corpusReview: {
    gap: string | null;
    reviewedBy?: string;
    reviewReference?: string;
  };
}

// The subset of Vitest's JSON report needed by this boundary. The CLI validates
// external JSON; tests supply small report fixtures without mocking the checker.
export interface TestResults {
  success: boolean;
  testResults: {
    name: string;
    status: string;
    assertionResults: { fullName: string; status: string }[];
  }[];
}

export function sourceSections(text: string) {
  const lines = text.replaceAll('\r\n', '\n').split('\n');
  const starts = lines.flatMap((line, index) =>
    /^#{1,6} /.test(line) ? [index] : [],
  );
  // Track text before the first heading too; new unheaded rules cannot disappear.
  if (starts[0] !== 0 && lines.slice(0, starts[0]).join('\n').trim())
    starts.unshift(0);
  const parents: { level: number; heading: string }[] = [];
  return starts.map((start, index) => {
    const heading = lines[start]!;
    const level = /^#+/.exec(heading)?.[0].length ?? 0;
    while (parents.length && parents[parents.length - 1]!.level >= level)
      parents.pop();
    const parentHeading = parents[parents.length - 1]?.heading;
    parents.push({ level, heading });
    return {
      heading,
      parentHeading,
      text:
        lines
          .slice(start, starts[index + 1])
          .join('\n')
          .trim() + '\n',
    };
  });
}

export function fingerprint(text: string) {
  return createHash('sha256')
    .update(text.replaceAll('\r\n', '\n').trim() + '\n')
    .digest('hex');
}

type CoverageOptions = {
  strict?: boolean;
  requiredCases?: string[];
  corpusPaths?: string[];
  serviceResults?: TestResults;
};
type CoverageSource = CoverageCatalog['sources'][number];
type CoverageRule = CoverageCatalog['rules'][number];

export function checkCoverage(
  catalog: CoverageCatalog,
  results: TestResults,
  files: Record<string, string>,
  options: CoverageOptions = {},
) {
  return new CoverageCheck(catalog, results, files).check(options);
}

class CoverageCheck {
  private serviceResults?: TestResults;
  private errors: string[] = [];
  private covered: string[] = [];
  private gaps: string[] = [];
  private sourceIds = new Set<string>();
  private invalidSources = new Set<string>();
  private ruleIds = new Set<string>();
  private caseIds = new Set<string>();

  private catalog: CoverageCatalog;
  private results: TestResults;
  private files: Record<string, string>;

  constructor(
    catalog: CoverageCatalog,
    results: TestResults,
    files: Record<string, string>,
  ) {
    this.catalog = catalog;
    this.results = results;
    this.files = files;
  }

  check(options: CoverageOptions) {
    this.serviceResults = options.serviceResults;
    if (!this.results.success) this.errors.push('Collected test run failed');
    if (this.serviceResults && !this.serviceResults.success)
      this.errors.push('Collected service run failed');
    for (const source of this.catalog.sources) this.checkSource(source);
    this.checkCorpus(options.corpusPaths ?? []);
    for (const auditId of this.catalog.auditIds) {
      if (!this.catalog.rules.some((rule) => rule.id === auditId))
        this.errors.push(`${auditId}: unmapped audit entry`);
    }
    for (const rule of this.catalog.rules) this.checkRule(rule);
    this.checkRequiredCases(options.requiredCases ?? []);
    this.checkReview();
    if (options.strict && this.gaps.length)
      this.errors.push(`Completeness gate: ${this.gaps.length} remaining gaps`);
    return { errors: this.errors, covered: this.covered, gaps: this.gaps };
  }

  private checkRequiredCases(requiredCases: string[]) {
    for (const id of requiredCases) {
      if (!this.caseIds.has(id))
        this.errors.push(`${id}: unmapped inventoried case`);
    }
  }

  private checkSource(source: CoverageSource) {
    if (this.sourceIds.has(source.id))
      this.errors.push(`${source.id}: duplicate source ID`);
    this.sourceIds.add(source.id);
    const matches = this.sourceMatches(source);
    if (
      matches.length !== 1 ||
      fingerprint(matches[0]!.text) !== source.fingerprint
    ) {
      this.errors.push(
        `${source.id}: ${matches.length === 1 ? 'stale source fingerprint' : 'missing or ambiguous source reference'}`,
      );
      this.invalidSources.add(source.id);
    }
    if (source.reviewGap) this.gaps.push(`${source.id}: ${source.reviewGap}`);
    if (
      !source.reviewGap &&
      !this.catalog.rules.some((rule) => rule.sources.includes(source.id))
    ) {
      this.errors.push(
        `${source.id}: source has neither rule mapping nor explicit review gap`,
      );
    }
  }

  private sourceMatches(source: CoverageSource) {
    const file = this.files[source.path];
    if (file === undefined) return [];
    if (source.heading === null) return [{ text: file }];
    return sourceSections(file).filter((section) =>
      matchesSection(source, section),
    );
  }

  private checkCorpus(corpusPaths: string[]) {
    const paths = new Set([
      ...corpusPaths,
      ...this.catalog.sources
        .filter((source) => source.heading !== null)
        .map((source) => source.path),
    ]);
    for (const path of paths) {
      for (const section of sourceSections(this.files[path] ?? '')) {
        if (
          !this.catalog.sources.some(
            (source) => source.path === path && matchesSection(source, section),
          )
        ) {
          this.errors.push(`${path}: unmapped section ${section.heading}`);
        }
      }
    }
  }

  private checkRule(rule: CoverageRule) {
    if (this.ruleIds.has(rule.id))
      this.errors.push(`${rule.id}: duplicate rule ID`);
    this.ruleIds.add(rule.id);
    if (!rule.sources.length)
      this.errors.push(`${rule.id}: no source reference`);
    if (!rule.cases.length) this.errors.push(`${rule.id}: no expanded cases`);
    for (const source of rule.sources) {
      if (!this.sourceIds.has(source))
        this.errors.push(`${rule.id}: unknown source ${source}`);
    }
    const validSources =
      rule.sources.length > 0 &&
      rule.sources.every(
        (source) =>
          this.sourceIds.has(source) && !this.invalidSources.has(source),
      );
    for (const entry of rule.cases)
      this.checkCase(rule.id, entry, validSources);
  }

  private checkCase(
    ruleId: string,
    entry: CoverageCase,
    validSources: boolean,
  ) {
    const id = `${ruleId}.${entry.id}`;
    this.checkCaseMetadata(id, entry);
    // Check every reference even when sources are invalid or a gap is declared.
    const evidence = entry.tests.map((testId) =>
      this.checkEvidence(id, testId, this.results),
    );
    for (const testId of entry.serviceTests ?? []) {
      if (this.serviceResults)
        evidence.push(this.checkEvidence(id, testId, this.serviceResults));
      else {
        this.gaps.push(`${id}: missing service evidence ${testId}`);
        evidence.push(false);
      }
    }
    const passing =
      evidence.length > 0 && validSources && evidence.every(Boolean);
    if (entry.gap?.trim()) this.gaps.push(`${id}: ${entry.gap}`);
    // Partial passing evidence is reported but an explicit gap still prevents completeness.
    if (passing) this.covered.push(id);
    else if (!evidence.length && !entry.gap?.trim())
      this.errors.push(`${id}: unmapped case`);
  }

  private checkCaseMetadata(id: string, entry: CoverageCase) {
    if (this.caseIds.has(id)) this.errors.push(`${id}: duplicate case ID`);
    this.caseIds.add(id);
    if (
      !entry.id.trim() ||
      !entry.expected.trim() ||
      !entry.checkpoint.trim() ||
      !entry.plannedTests.length
    ) {
      this.errors.push(`${id}: missing case metadata`);
    }
  }

  private checkEvidence(id: string, testId: string, results: TestResults) {
    const matches = results.testResults.flatMap((file) =>
      file.assertionResults
        .filter((test) => test.fullName.includes(`[${testId}]`))
        .map((test) => ({ test, file })),
    );
    if (matches.length !== 1) {
      this.errors.push(
        `${id}: ${matches.length ? 'ambiguous' : 'missing'} test ${testId}`,
      );
      return false;
    }
    if (
      matches.some(
        ({ test, file }) =>
          test.status !== 'passed' || file.status !== 'passed',
      )
    ) {
      this.errors.push(`${id}: test ${testId} did not pass`);
      return false;
    }
    return true;
  }

  private checkReview() {
    const review = this.catalog.corpusReview;
    if (review.gap?.trim()) this.gaps.push(`Corpus review: ${review.gap}`);
    else if (!review.reviewedBy?.trim() || !review.reviewReference?.trim()) {
      this.errors.push('Corpus review requires reviewer and review reference');
    }
  }
}

function matchesSection(
  source: CoverageSource,
  section: { heading: string; parentHeading?: string },
) {
  return (
    source.heading === section.heading &&
    (source.parentHeading === undefined ||
      source.parentHeading === section.parentHeading)
  );
}

export function renderCoverageReport(
  catalog: CoverageCatalog,
  result: ReturnType<typeof checkCoverage>,
) {
  const lines = [
    '# Weekly Draft rules coverage',
    '',
    `${catalog.auditIds.length} audit entries; ${catalog.rules.reduce((sum, rule) => sum + rule.cases.length, 0)} expanded cases; ${result.covered.length} cases with passing mapped evidence; ${result.gaps.length} explicit gaps; ${result.errors.length} errors.`,
    '',
    'Passing evidence is traceability, not proof of semantic completeness. Full-corpus human review and the strict gate remain required before cutover.',
    '',
    '## Errors',
    '',
    ...result.errors.map((error) => `- ${error}`),
    ...(result.errors.length ? [] : ['None.']),
    '',
    '## Human corpus review',
    '',
    catalog.corpusReview.gap ??
      `Reviewed by ${catalog.corpusReview.reviewedBy}; ${catalog.corpusReview.reviewReference}`,
    '',
    'Review every source section against its mapped behavior and tests, including all actions, event outcomes, team trees, officers/managers, sequence, and product/persistence decisions. Classify introductory text explicitly; a fingerprint alone does not establish semantic review. Record reviewer, date, reference, and unresolved findings before clearing review gaps.',
    '',
    '| Source section | SHA-256 | Mapped rules / review gap |',
    '|---|---|---|',
    ...catalog.sources.map((source) => {
      const rules = catalog.rules
        .filter((rule) => rule.sources.includes(source.id))
        .map((rule) => rule.id)
        .join(', ');
      return `| [${source.id}: ${source.heading ?? source.path}](../${source.path}) | ${source.fingerprint} | ${rules || 'No rule mapping'}${source.reviewGap ? '; ' + source.reviewGap : ''} |`;
    }),
    '',
  ];
  for (const rule of catalog.rules) {
    lines.push(
      `## ${rule.id}`,
      '',
      `Sources: ${rule.sources
        .map((id) => {
          const source = catalog.sources.find((item) => item.id === id);
          return source
            ? `[${id}: ${source.heading ?? source.path}](../${source.path})`
            : id;
        })
        .join('; ')}`,
      '',
      '| Case / checkpoint | Expected Phase View or Resolution Preview | Evidence / gap |',
      '|---|---|---|',
    );
    for (const entry of rule.cases) {
      const escape = (value: string) =>
        value.replaceAll('|', '\\|').replaceAll('\n', ' ');
      const id = `${rule.id}.${entry.id}`;
      const status = result.covered.includes(id)
        ? 'PASS'
        : entry.tests.length || entry.serviceTests?.length
          ? 'UNVERIFIED'
          : 'GAP';
      lines.push(
        `| ${id} / ${entry.checkpoint} | ${escape(entry.expected)} | ${status}; planned: ${entry.plannedTests.join(', ')}; mapped: ${entry.tests.join(', ') || 'none'}; service: ${entry.serviceTests?.length ? entry.serviceTests.join(', ') : 'none'}${entry.gap ? '; ' + escape(entry.gap) : ''} |`,
      );
    }
    lines.push('');
  }
  lines.push(
    '## Remaining gaps',
    '',
    ...result.gaps.map((gap) => `- ${gap}`),
    '',
  );
  return lines.join('\n');
}
