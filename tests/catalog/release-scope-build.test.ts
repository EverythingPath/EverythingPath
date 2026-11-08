// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { parseLaunchInventory } from '../../scripts/catalog/launch-inventory-document';
import type { LaunchManifest } from '../../scripts/catalog/launch-inventory-schema';
import { runCatalogReleaseOperator } from '../../scripts/catalog/release-operator';
import type { ReleaseScopeReport } from '../../scripts/catalog/release-scope';
import {
  validateCatalogReleaseArtifact,
  type ReleaseRow,
} from '../../src/lib/catalog/release-schema';
import { materializePinnedTree } from './pinned-sources';
import {
  exploiter,
  findOutcome,
  magicalLineage,
  pinnedFile,
  race,
  reducedManifest as reduce,
} from './release-scope-fixtures';

// The committed reviewed attribution data (93 MB of encoded evidence) loads
// only for a build without --attribution; these builds supply their own, so
// it never loads.
vi.mock('../../scripts/catalog/reviewed-data-files', () => ({
  readCommittedReviewedAdmission: () =>
    Promise.reject(new Error('The reviewed attribution data was loaded.')),
}));

// Each scoped build inspects its manifest: a few seconds even when reduced.
const slow = 120_000;
const committed = parseLaunchInventory(
  JSON.parse(
    await readFile(
      new URL(
        '../../scripts/catalog/scopes/campaign-mvp-v1.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ),
);

function reducedManifest(
  roots: string[],
  extra?: Parameters<typeof reduce>[2],
) {
  return reduce(committed, roots, extra);
}

describe('a scoped build', () => {
  const temporary: string[] = [];
  let tree: Awaited<ReturnType<typeof materializePinnedTree>>;
  let root: string;
  let attribution: string;
  const baseRoots = [
    race.human,
    race.halfOrc,
    race.dwarf,
    magicalLineage,
    exploiter,
  ];
  // A real requirement row the Human root reaches in the committed manifest.
  const humanRequirement = committed.edges.find(
    ({ from, to, kind }) =>
      from === race.human &&
      kind !== 'citation' &&
      /^(?:rule|notice)\//.test(to),
  )!;
  const humanRule = committed.rows.find(
    ({ key }) => key === humanRequirement.to,
  )!;

  async function manifestFile(name: string, manifest: LaunchManifest) {
    const path = join(root, `${name}.json`);
    await writeFile(path, JSON.stringify(manifest));
    return path;
  }
  function buildArgs(
    artifact: string,
    manifest: string,
    extra: string[] = [],
    number = '1',
  ) {
    return [
      'build',
      '--number',
      number,
      '--schema',
      'character-sheet-v1',
      '--calculation',
      'facts-v1',
      '--system',
      tree.systemPath,
      '--content',
      tree.contentPath,
      '--artifact',
      artifact,
      '--allow-unverified-checkouts',
      '--attribution',
      attribution,
      '--scope',
      'campaign-mvp-v1',
      '--scope-manifest',
      manifest,
      ...extra,
    ];
  }
  async function build(args: string[]) {
    const error = await runCatalogReleaseOperator({ args }).then(
      () => undefined,
      (failure: unknown) => failure,
    );
    return error instanceof Error ? error.message : String(error);
  }
  async function readReport(artifact: string) {
    return JSON.parse(
      await readFile(artifact.replace(/\.json$/, '.scope.json'), 'utf8'),
    ) as ReleaseScopeReport & {
      release: { artifactFingerprint?: string; refused?: string };
    };
  }
  function chunkIndex(row: ReleaseRow) {
    return Number(row.key.slice('content:scope:'.length));
  }
  function rows(artifact: { batches: ReleaseRow[][] }) {
    return artifact.batches.flat();
  }

  beforeAll(async () => {
    tree = await materializePinnedTree(
      [race.human, race.halfOrc, race.dwarf, magicalLineage].map(
        (key) => pinnedFile[key]!,
      ),
    );
    root = await mkdtemp(join(tmpdir(), 'release-scope-'));
    temporary.push(root);
    // The real Section 15 registry and no assessments: every candidate is held.
    attribution = join(root, 'attribution.json');
    await writeFile(
      attribution,
      JSON.stringify({
        assessments: [],
        evidence: {},
        registry: JSON.parse(
          await readFile(
            new URL(
              '../../src/lib/catalog/data/section15-registry.json',
              import.meta.url,
            ),
            'utf8',
          ),
        ),
      }),
    );
  });
  afterAll(async () => {
    await tree.dispose();
    await Promise.all(
      temporary.map((path) => rm(path, { recursive: true, force: true })),
    );
  });

  it('binds scope and closure into a deterministic artifact and an always-written report', async () => {
    const plain = await manifestFile('plain', reducedManifest(baseRoots));
    const first = join(root, 'a/release.json');
    const second = join(root, 'b/release.json');
    for (const artifact of [first, second])
      expect(await build(buildArgs(artifact, plain))).toContain(
        'Scoped qualification FAILED',
      );
    const bytes = await readFile(first, 'utf8');
    expect(await readFile(second, 'utf8')).toBe(bytes);
    expect(await readReport(second)).toEqual(await readReport(first));
    const artifact = await validateCatalogReleaseArtifact(JSON.parse(bytes));
    const report = await readReport(first);
    expect(report.release).toEqual({
      artifactFingerprint: artifact.manifest.artifactFingerprint,
    });
    expect(report.qualification.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'drift' }),
        expect.objectContaining({ code: 'inventory-incomplete' }),
      ]),
    );
    const summary = rows(artifact).find(
      (row) => row.kind === 'report' && row.key === 'content:scope',
    )?.payload;
    expect(summary).toEqual({
      binding: report.binding,
      qualification: report.qualification,
    });
    expect(
      rows(artifact)
        .filter((row) => row.key.startsWith('content:scope:'))
        .sort((a, b) => chunkIndex(a) - chunkIndex(b))
        .flatMap((row) => row.payload as unknown[]),
    ).toEqual(report.rows);
    expect(findOutcome(report, exploiter)).toMatchObject({
      outcome: 'held',
      cause: 'no-candidate',
    });
    expect(findOutcome(report, race.human)).toMatchObject({
      outcome: 'held',
      cause: 'held',
      gate: 'held',
    });
    expect(
      findOutcome(report, `local/race-ability-scores/${race.dwarf}`),
    ).toMatchObject({ outcome: 'held', gate: 'held' });

    // The scope is an input: the same import with no scope binds differently.
    const unscopedPath = join(root, 'unscoped/release.json');
    await runCatalogReleaseOperator({
      args: buildArgs(unscopedPath, plain).slice(0, -4),
    });
    const unscoped = await validateCatalogReleaseArtifact(
      JSON.parse(await readFile(unscopedPath, 'utf8')),
    );
    expect(unscoped.manifest.inputs.upstream).toBe(
      artifact.manifest.inputs.upstream,
    );
    expect(unscoped.manifest.inputs.localData).not.toBe(
      artifact.manifest.inputs.localData,
    );
    expect(
      rows(unscoped).some((row) => row.key.startsWith('content:scope')),
    ).toBe(false);

    // A changed closure (one more reached requirement) or root set rebinds.
    const wider = await manifestFile(
      'wider',
      reducedManifest(baseRoots, {
        rows: [humanRule],
        edges: [humanRequirement],
      }),
    );
    const fewer = await manifestFile(
      'fewer',
      reducedManifest(baseRoots.filter((key) => key !== exploiter)),
    );
    const fingerprints = [];
    for (const [name, manifest] of [
      ['wider', wider],
      ['fewer', fewer],
    ] as const) {
      const path = join(root, `${name}/release.json`);
      await build(buildArgs(path, manifest));
      const changed = await validateCatalogReleaseArtifact(
        JSON.parse(await readFile(path, 'utf8')),
      );
      expect(changed.manifest.inputs.upstream).toBe(
        artifact.manifest.inputs.upstream,
      );
      fingerprints.push(changed.manifest.artifactFingerprint);
    }
    expect(
      new Set([artifact.manifest.artifactFingerprint, ...fingerprints]).size,
    ).toBe(3);
    expect(
      findOutcome(
        await readReport(join(root, 'wider/release.json')),
        humanRule.key,
      ),
    ).toMatchObject({
      outcome: 'held',
      cause: 'requirement',
      path: [race.human, humanRule.key],
    });
  }, 150_000);

  it(
    'refuses a reused release number and a different scope identity against --previous',
    async () => {
      const plain = await manifestFile('previous', reducedManifest(baseRoots));
      const previous = join(root, 'p1/release.json');
      await build(buildArgs(previous, plain));
      expect(
        await build(
          buildArgs(join(root, 'p1-again/release.json'), plain, [
            '--previous',
            previous,
          ]),
        ),
      ).toContain('Release number must increase');
      const wider = await manifestFile(
        'previous-wider',
        reducedManifest(baseRoots, {
          rows: [humanRule],
          edges: [humanRequirement],
        }),
      );
      const next = join(root, 'p2/release.json');
      await build(buildArgs(next, wider, ['--previous', previous], '2'));
      expect((await readReport(next)).qualification.findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'previous-drift' }),
        ]),
      );
      const same = join(root, 'p2-same/release.json');
      await build(buildArgs(same, plain, ['--previous', previous], '2'));
      expect(
        (await readReport(same)).qualification.findings.map(({ code }) => code),
      ).not.toContain('previous-drift');
    },
    slow,
  );

  it(
    'writes the report but no artifact when the existing gates fail',
    async () => {
      const races = Object.values(race);
      const manifest = await manifestFile('races', reducedManifest(races));
      const artifact = join(root, 'races/release.json');
      const racesTree = await materializePinnedTree(
        races.map((key) => pinnedFile[key]!),
      );
      const args = buildArgs(artifact, manifest);
      args[args.indexOf(tree.systemPath)] = racesTree.systemPath;
      args[args.indexOf(tree.contentPath)] = racesTree.contentPath;
      const message = await build(args).finally(() => racesTree.dispose());
      expect(message).toContain('Scoped qualification FAILED');
      expect(message).toContain('gates failed');
      await expect(readFile(artifact, 'utf8')).rejects.toThrow('ENOENT');
      const report = await readReport(artifact);
      expect(report.release).toMatchObject({
        refused: expect.stringContaining('Catalog Release gates failed'),
        gateFailures: 5,
        curationPassed: true,
        coverageComplete: true,
      });
      expect(findOutcome(report, race.halfling)).toMatchObject({
        outcome: 'held',
        cause: 'failed',
        gate: 'failed',
        reason: expect.stringContaining('unresolved imported reference'),
      });
      const local = report.rows.filter(({ key }) => key.startsWith('local/'));
      expect(local.map(({ key }) => key).sort()).toEqual(
        [race.dwarf, race.elf, race.gnome, race.halfling, race.tiefling]
          .map((key) => `local/race-ability-scores/${key}`)
          .sort(),
      );
      expect(local.every(({ outcome }) => outcome === 'held')).toBe(true);
      expect(report.qualification.counts).toMatchObject({
        required: 13,
        included: 0,
        held: 13,
      });
    },
    slow,
  );

  it(
    'refuses scope options without a scope, an unknown version and a malformed manifest',
    async () => {
      const malformed = join(root, 'malformed.json');
      await writeFile(
        malformed,
        JSON.stringify({ scopeVersion: 'campaign-mvp-v1' }),
      );
      const args = buildArgs(join(root, 'malformed/release.json'), malformed);
      const at = args.indexOf('--scope');
      expect(
        await build([...args.slice(0, at), ...args.slice(at + 2)]),
      ).toContain('--scope-manifest requires --scope');
      const unknown = [...args];
      unknown[at + 1] = 'campaign-mvp-v2';
      expect(await build(unknown)).toContain('Unknown release scope');
      expect(await build(args)).not.toContain('Scoped qualification');
      await expect(
        readFile(join(root, 'malformed/release.scope.json'), 'utf8'),
      ).rejects.toThrow('ENOENT');
    },
    slow,
  );

  it(
    'loads the reviewed attribution data only for a build without --attribution',
    async () => {
      // Unscoped, so the import error isn't recorded as a refused scope input.
      const args = buildArgs(join(root, 'lazy/release.json'), '').slice(0, -4);
      const at = args.indexOf('--attribution');
      await expect(
        runCatalogReleaseOperator({
          args: [...args.slice(0, at), ...args.slice(at + 2)],
        }),
      ).rejects.toThrow('The reviewed attribution data was loaded.');
    },
    slow,
  );

  it(
    'writes the scope report when the release inputs are refused',
    async () => {
      // The committed scope against a checkout holding four of its roots.
      const artifact = join(root, 'incomplete/release.json');
      const args = buildArgs(artifact, '');
      const at = args.indexOf('--scope-manifest');
      const message = await build([
        ...args.slice(0, at),
        ...args.slice(at + 2),
      ]);
      expect(message).toContain('Scoped qualification FAILED');
      expect(message).toContain('Unknown candidate key');
      await expect(readFile(artifact, 'utf8')).rejects.toThrow('ENOENT');
      const report = await readReport(artifact);
      expect(report.binding.roots).toHaveLength(31);
      expect(report.release).toMatchObject({
        refused: expect.stringContaining('Unknown candidate key'),
      });
      for (const key of report.binding.roots)
        expect(findOutcome(report, key)).toMatchObject({
          outcome: 'held',
          path: [key],
        });
      expect(findOutcome(report, race.halfling)).toMatchObject({
        cause: 'failed',
        reason: expect.stringContaining('Unknown candidate key'),
      });
      // 16,737 since #615 wave D: held Mercy requires PZO9475. 16,744 since
      // the waves 1-2 correction: seven mapping-book notice rows turn required
      // (PZO9283, PZO9424, PZO9431, PZO9441, PZO9443, PZO9448, PZO9460).
      expect(report.qualification.counts).toMatchObject({
        required: 16_744,
        included: 0,
      });
    },
    slow,
  );
});
