// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AdmissionRow } from '../../scripts/catalog/admission';
import {
  noticeCoverage,
  uncoveredAdmissions,
} from '../../scripts/catalog/notice-coverage';
import {
  bookTitles,
  committedScopes,
  formatCoverageReport,
  runNoticeCoverageCommand,
  summarizeCoverage,
  wholeCorpus,
} from '../../scripts/catalog/notice-coverage-report';
import { runCapturedProcess } from '../../scripts/catalog/process';
import {
  readCommittedRegisterAdmission,
  readRegisterAdmission,
} from '../../scripts/catalog/register-admission';
import { committedStoredNotices } from '../../scripts/catalog/stored-required-notices';
import { section15Registry } from '../../src/lib/catalog/section15-registry-data';

const row = (
  externalKey: string,
  requiredNotices: string[],
  missingNotices: string[] = [],
): AdmissionRow => ({
  externalKey,
  name: externalKey.replace(/^pf1\//, ''),
  reason: 'Fixture.',
  requiredNotices,
  missingNotices,
  evidence: [],
});

// A gate run on the register only, as `catalog:notice-coverage` reads it.
const gate = {
  passed: false,
  admitted: [row('pf1/dodge', ['PZO1110'])],
  held: [
    row('pf1/acid', ['PZO1110', 'PZO9445'], ['PZO9445']),
    row('pf1/tanglefoot', ['PZO9445'], ['PZO9445']),
    row('pf1/fork', ['PZO9445', 'PZO9493'], ['PZO9445', 'PZO9493']),
    row('pf1/evolution', []),
    // Held for another reason, on covered books.
    row('pf1/scaled-fist', ['PZO1110']),
  ],
  dependentOmissions: [row('pf1/fighter', ['pcgen:PZO1110'])],
  retainedExceptions: [],
  requiredNotices: ['PZO1110'],
  failures: [
    { externalKey: 'pf1/broken', reason: 'Broken structure or reference: x.' },
    { externalKey: 'pf1/fighter', reason: 'Inherited.' },
  ],
};

describe('notice coverage, as the gate decides it on the register alone', () => {
  it('reads each row: covered, uncovered by its missing codes, no book or not decided', () => {
    const coverage = noticeCoverage(gate);
    expect(Object.fromEntries(coverage)).toEqual({
      'pf1/dodge': { kind: 'covered', notices: ['PZO1110'] },
      'pf1/acid': {
        kind: 'uncovered',
        notices: ['PZO1110', 'PZO9445'],
        missing: ['PZO9445'],
      },
      'pf1/tanglefoot': {
        kind: 'uncovered',
        notices: ['PZO9445'],
        missing: ['PZO9445'],
      },
      'pf1/fork': {
        kind: 'uncovered',
        notices: ['PZO9445', 'PZO9493'],
        missing: ['PZO9445', 'PZO9493'],
      },
      'pf1/evolution': { kind: 'no-book' },
      'pf1/scaled-fist': { kind: 'covered', notices: ['PZO1110'] },
      'pf1/fighter': { kind: 'covered', notices: ['pcgen:PZO1110'] },
      'pf1/broken': { kind: 'not-decided' },
    });
  });

  it('names each admitted row with a book it does not cover; a row with no book or no decision has none to check', () => {
    const coverage = noticeCoverage(gate);
    expect(
      uncoveredAdmissions({
        admitted: [
          { externalKey: 'pf1/dodge' },
          { externalKey: 'pf1/fork' },
          { externalKey: 'pf1/evolution' },
          { externalKey: 'pf1/broken' },
          { externalKey: 'pf1/unknown' },
        ],
        coverage,
      }),
    ).toEqual(['pf1/fork (no reviewed notice: PZO9445, PZO9493)']);
    expect(uncoveredAdmissions({ admitted: gate.admitted, coverage })).toEqual(
      [],
    );
  });
});

describe('the coverage report', () => {
  const titles: Record<string, string> = {
    PZO9445: 'Player Companion: Alchemy Manual',
  };
  const entries = [
    ...gate.admitted,
    ...gate.held,
    ...gate.dependentOmissions,
    { externalKey: 'pf1/broken', name: 'broken' },
  ].map(({ externalKey, name }) => ({ externalKey, name }));
  const summary = summarizeCoverage({
    version: 'campaign-party-v1',
    entries,
    gate,
    titleOf: (code) => titles[code],
  });

  it('counts each entry once and lists the books without a reviewed notice with their entries', () => {
    expect(summary.counts).toEqual({
      entries: 8,
      covered: 3,
      uncovered: 3,
      'no-book': 1,
      'not-decided': 1,
    });
    expect(summary.missingBooks).toEqual([
      {
        code: 'PZO9445',
        title: 'Player Companion: Alchemy Manual',
        entries: [
          { externalKey: 'pf1/acid', name: 'acid', gate: 'held' },
          { externalKey: 'pf1/fork', name: 'fork', gate: 'held' },
          { externalKey: 'pf1/tanglefoot', name: 'tanglefoot', gate: 'held' },
        ],
      },
      {
        code: 'PZO9493',
        title: undefined,
        entries: [{ externalKey: 'pf1/fork', name: 'fork', gate: 'held' }],
      },
    ]);
    expect(summary.uncoveredAdmitted).toEqual([]);
  });

  it('prints a short table per scope, then the uncovered entries by book', () => {
    const text = formatCoverageReport([summary]);
    expect(text).toContain(
      [
        '## campaign-party-v1',
        '',
        '| entries | covered | uncovered | no book | not decided |',
        '|---|---|---|---|---|',
        '| 8 | 3 | 3 | 1 | 1 |',
        '',
        'Admitted but uncovered: none.',
        '',
        'Books without a reviewed notice:',
        '',
        '| book | title | entries |',
        '|---|---|---|',
        '| PZO9445 | Player Companion: Alchemy Manual | 3 |',
        '| PZO9493 | (title unknown) | 1 |',
        '',
        '### Uncovered entries by book',
        '',
        '**PZO9445** Player Companion: Alchemy Manual',
        '',
        '| entry | key | gate |',
        '|---|---|---|',
        '| acid | `pf1/acid` | held |',
        '| fork | `pf1/fork` | held |',
        '| tanglefoot | `pf1/tanglefoot` | held |',
      ].join('\n'),
    );
    expect(text.endsWith('| fork | `pf1/fork` | held |\n')).toBe(true);
  });

  it('names an admitted row it does not cover, which fails the command', () => {
    const refused = summarizeCoverage({
      version: 'campaign-mvp-v1',
      entries,
      gate: { ...gate, admitted: [...gate.admitted, gate.held[2]!] },
      titleOf: () => undefined,
    });
    expect(refused.uncoveredAdmitted).toEqual([
      'pf1/fork (no reviewed notice: PZO9445, PZO9493)',
    ]);
    expect(formatCoverageReport([refused])).toContain(
      'Admitted but uncovered (a release refuses these): pf1/fork (no reviewed notice: PZO9445, PZO9493).',
    );
  });

  it('reports both committed scopes by default, the party’s first', () => {
    expect(committedScopes).toEqual(['campaign-party-v1', 'campaign-mvp-v1']);
  });

  it('titles a book by its Registry record, else Foundry’s registry, else the PCGen crosswalk', () => {
    const titleOf = bookTitles({
      registry: section15Registry,
      foundrySources: [
        'export const sources = [',
        '    {',
        '      _id: "PZO9445",',
        '      name: "Alchemy Manual",',
        '      type: "companion",',
        '    },',
        '    {',
        '      _id: "PZO1110",',
        '      name: "Core Rulebook",',
        '      type: "core",',
        '    },',
        '];',
      ].join('\n'),
    });
    expect(titleOf('PZO1110')).toBe('Pathfinder RPG Core Rulebook');
    expect(titleOf('PZO9445')).toBe('Player Companion: Alchemy Manual');
    expect(titleOf('PZO1138')).toBe("Adventurer's Guide");
    expect(titleOf('PZO0000')).toBeUndefined();
  });
});

describe('the gate’s register-only input', () => {
  it('is the committed register and frozen stored notices, with no Attribution Assessment or evidence', async () => {
    const committed = await readCommittedRegisterAdmission();
    expect(committed).toEqual({
      registry: section15Registry,
      storedNotices: committedStoredNotices,
      assessments: [],
      evidence: {},
      retainedUses: [],
      retainedExceptions: [],
    });
  });

  it('keeps an --attribution file’s register, retained uses and its assessments’ notices, never the assessments or evidence', async () => {
    const { CRB: crb } = section15Registry;
    if (!crb) throw new Error('The Registry has no CRB record.');
    const directory = await mkdtemp(join(tmpdir(), 'register-only-'));
    try {
      const path = join(directory, 'attribution.json');
      const exception = {
        useId: 'vessa-cleave-copy',
        externalKey: 'pf1/Cleave',
        definitionFingerprint: 'a'.repeat(64),
        reason: 'Kept.',
        requiredNotices: ['CRB'],
      };
      // The shape `--attribution` has always accepted: plain evidence.
      const assessment = (requiredNotices: string[]) => ({
        externalKey: 'pf1/Cleave',
        status: 'confirmed',
        contentFingerprint: 'b'.repeat(64),
        mappingFingerprint: 'c'.repeat(64),
        evidenceFingerprints: { comparison: 'd'.repeat(64) },
        noticeFingerprints: {},
        requiredNotices,
        rationale: 'Compared.',
        reviewedBy: 'Catalog reviewer',
        reviewedOn: '2026-10-07',
      });
      const file = (assessments: unknown[]) =>
        JSON.stringify({
          assessments,
          evidence: { comparison: { content: 'Compared.' } },
          registry: { CRB: crb },
          retainedExceptions: [exception],
        });
      await writeFile(path, file([assessment(['PZO1116', 'CRB'])]));
      expect(await readRegisterAdmission(path)).toEqual({
        registry: { CRB: crb },
        storedNotices: { 'pf1/Cleave': ['CRB', 'PZO1116'] },
        assessments: [],
        evidence: {},
        retainedUses: [],
        retainedExceptions: [exception],
      });
      // A key assessed twice is refused, as the gate refuses it.
      await writeFile(
        path,
        file([assessment(['CRB']), assessment(['PZO1116'])]),
      );
      await expect(readRegisterAdmission(path)).rejects.toThrow(
        'pf1/Cleave: Duplicate Attribution Assessment.',
      );
      // A malformed file is still refused as before.
      await writeFile(path, JSON.stringify({ registry: { CRB: crb } }));
      await expect(readRegisterAdmission(path)).rejects.toThrow('assessments');
      expect(JSON.parse(await readFile(path, 'utf8'))).toHaveProperty(
        'registry',
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe('catalog:notice-coverage exit statuses', () => {
  const report = (uncoveredAdmitted: string[]) => () =>
    Promise.resolve({ text: '# Notice coverage\n', uncoveredAdmitted });

  it('exits 0 on a report, and 2 when it fails its consistency check or cannot be produced', async () => {
    expect(await runNoticeCoverageCommand([], report([]))).toEqual({
      status: 0,
      stdout: '# Notice coverage\n',
      stderr: '',
    });
    expect(
      await runNoticeCoverageCommand(
        ['--scope', wholeCorpus],
        report(['whole-corpus: pf1/fork (no reviewed notice: PZO9493)']),
      ),
    ).toEqual({
      status: 2,
      stdout: '',
      stderr:
        'Inconsistent coverage report: admitted but uncovered: whole-corpus: pf1/fork (no reviewed notice: PZO9493).\n',
    });
    expect(
      await runNoticeCoverageCommand([], () =>
        Promise.reject(new Error('ENOENT: section15-registry.json')),
      ),
    ).toEqual({
      status: 2,
      stdout: '',
      stderr: 'ENOENT: section15-registry.json\n',
    });
  });

  it('reports the scopes asked for: both committed ones by default', async () => {
    const asked: (readonly string[])[] = [];
    const record = (versions: readonly string[]) => {
      asked.push(versions);
      return Promise.resolve({ text: '', uncoveredAdmitted: [] });
    };
    await runNoticeCoverageCommand([], record);
    await runNoticeCoverageCommand(['--scope', 'campaign-mvp-v1'], record);
    expect(asked).toEqual([
      ['campaign-party-v1', 'campaign-mvp-v1'],
      ['campaign-mvp-v1'],
    ]);
  });

  it.each([
    [['--scope', 'campaign-nope-v1'], 'Unknown scope campaign-nope-v1'],
    [['--bogus'], "Unknown option '--bogus'"],
  ])('the command exits 2 on a usage error (%j)', (args, message) => {
    const result = runCapturedProcess({
      command: process.execPath,
      args: ['--import', 'tsx', 'scripts/catalog-notice-coverage.ts', ...args],
    });
    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(message);
  });

  it('the command exits 2 when its input is unreadable', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'coverage-unreadable-'));
    try {
      // The child's readFile fails for the committed register.
      const stub = join(directory, 'unreadable.mjs');
      await writeFile(
        stub,
        `import fs from 'node:fs';
        import { syncBuiltinESMExports } from 'node:module';
        import { fileURLToPath } from 'node:url';
        const read = fs.promises.readFile;
        fs.promises.readFile = async function (path, ...rest) {
          const file = path instanceof URL ? fileURLToPath(path) : String(path);
          if (file.endsWith('/section15-registry.json'))
            throw new Error('The committed notice register is unreadable');
          return read.call(this, path, ...rest);
        };
        syncBuiltinESMExports();`,
      );
      const result = runCapturedProcess({
        command: process.execPath,
        args: [
          '--import',
          pathToFileURL(stub).href,
          '--import',
          'tsx',
          'scripts/catalog-notice-coverage.ts',
        ],
      });
      expect(result.status).toBe(2);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain(
        'The committed notice register is unreadable',
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('the command exits 0 with its usage on --help', () => {
    const result = runCapturedProcess({
      command: process.execPath,
      args: ['--import', 'tsx', 'scripts/catalog-notice-coverage.ts', '--help'],
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Exits 0 on a report or this help; 2 when');
  });
});
