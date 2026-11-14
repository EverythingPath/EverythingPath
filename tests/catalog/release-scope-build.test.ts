// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { parseLaunchInventory } from '../../scripts/catalog/launch-inventory-document';
import type { LaunchManifest } from '../../scripts/catalog/launch-inventory-schema';
import { runCatalogReleaseOperator } from '../../scripts/catalog/release-operator';
import type { PartyScopeReport } from '../../scripts/catalog/party/party-release-scope';
import {
  decodePartyScope,
  partyScopeBytes,
} from '../../scripts/catalog/party/party-scope';
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
    // No assessments and no reviewed notice: every candidate is held (#227
    // admits a declared book only on a reviewed Registry notice).
    attribution = join(root, 'attribution.json');
    await writeFile(
      attribution,
      JSON.stringify({ assessments: [], evidence: {}, registry: {} }),
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
    // The scope's record coverage beside the corpus's (G1): this tree holds
    // only the scope's files, so both are complete.
    expect(report.release).toEqual({
      artifactFingerprint: artifact.manifest.artifactFingerprint,
      coverageComplete: true,
      corpus: { coverageComplete: true, unassigned: 0 },
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

  it('refuses a mistyped built-in rule resource before holding anything, scoped or not', async () => {
    // An authoring error, not a hold: the build would emit the supplied
    // resource again whatever it holds, and no release ever accepts it.
    const resources = join(root, 'mistyped-resources.json');
    await writeFile(
      resources,
      JSON.stringify([
        { key: 'builtin:casting-table', payload: { tables: [] } },
      ]),
    );
    const refusal =
      'Rule resource builtin:casting-table is no built-in resource; a supplied rule resource must be one of builtin:casting-tables, builtin:representative-class-catalog, builtin:representative-race-catalog, builtin:representative-archetype-catalog, builtin:representative-selection-catalog, builtin:representative-spellcasting-catalog.';
    const plain = await manifestFile('mistyped', reducedManifest(baseRoots));
    const artifact = join(root, 'mistyped/release.json');
    const message = await build(
      buildArgs(artifact, plain, ['--rule-resources', resources]),
    );
    expect(message).toContain('Scoped qualification FAILED');
    // The message quotes the first 300 characters; the report all of it.
    expect(message).toContain(
      'Release inputs refused: Rule resource builtin:casting-table is no built-in resource',
    );
    await expect(readFile(artifact, 'utf8')).rejects.toThrow('ENOENT');
    expect((await readReport(artifact)).release).toEqual({
      refused: refusal,
    });
    const unscoped = join(root, 'mistyped-unscoped/release.json');
    await expect(
      runCatalogReleaseOperator({
        args: [
          ...buildArgs(unscoped, plain).slice(0, -4),
          '--rule-resources',
          resources,
        ],
      }),
    ).rejects.toThrow(refusal);
    await expect(readFile(unscoped, 'utf8')).rejects.toThrow('ENOENT');
  }, 60_000);

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
      // 16,745 since wave CL7: Shadow Conjuration's Harrow bloodline mapping
      // requires PZO9446.
      expect(report.qualification.counts).toMatchObject({
        required: 16_745,
        included: 0,
      });
    },
    slow,
  );

  it(
    'builds campaign-party-v1 from a supplied copy, reporting each failing row per character, and refuses --pcgen for a scope without PCGen rows',
    async () => {
      // The committed party scope with Human alone: a drifted copy.
      const committedParty = decodePartyScope(
        JSON.parse(
          await readFile(
            'scripts/catalog/scopes/campaign-party-v1.json',
            'utf8',
          ),
        ),
      );
      const human = {
        key: race.human,
        kind: 'race',
        name: 'Human',
        characters: ['3'] as [string],
      };
      const supplied = join(root, 'party.json');
      await writeFile(
        supplied,
        partyScopeBytes({
          ...committedParty,
          roots: [{ key: race.human, group: 'race', characters: ['3'] }],
          rows: [human],
          edges: [],
        }),
      );
      const artifactPath = join(root, 'party/release.json');
      const args = buildArgs(artifactPath, supplied);
      args[args.indexOf('campaign-mvp-v1')] = 'campaign-party-v1';
      const failure = await build(args);
      expect(failure).toContain(
        'Scoped qualification FAILED for campaign-party-v1; artifact',
      );
      expect(failure).toContain('drift campaign-party-v1:');
      const report = (await readReport(
        artifactPath,
      )) as unknown as PartyScopeReport;
      expect(report.binding).toMatchObject({
        version: 'campaign-party-v1',
        roots: [race.human],
      });
      expect(report.qualification.findings.map(({ code }) => code)).toEqual([
        'drift',
      ]);
      // No reviewed notice: the gate holds Human, with its reason.
      expect(report.rows.find((row) => row.name === 'Human')).toMatchObject({
        subject: 'row',
        outcome: 'failed',
        cause: 'held',
      });
      // The committed exceptions pass their names; other names fail.
      expect(
        report.rows.find((row) => row.name === 'Lethal Stance'),
      ).toMatchObject({ subject: 'gap', outcome: 'excepted' });
      const third = report.qualification.characters.find(
        ({ id }) => id === '3',
      );
      expect(third).toEqual({
        id: '3',
        served: false,
        failing: [{ key: race.human, name: 'Human', cause: 'held' }],
        unreleased: 0,
      });
      const artifact = await validateCatalogReleaseArtifact(
        JSON.parse(await readFile(artifactPath, 'utf8')),
      );
      expect(
        rows(artifact).find(
          (row) => row.kind === 'report' && row.key === 'content:scope',
        )?.payload,
      ).toEqual({
        binding: report.binding,
        qualification: report.qualification,
      });

      const mvp = await manifestFile('pcgen', reducedManifest([race.human]));
      expect(
        await build([
          ...buildArgs(join(root, 'pcgen/release.json'), mvp),
          '--pcgen',
          tree.contentPath,
        ]),
      ).toContain(
        '--pcgen applies only to a scope with PCGen rows; campaign-mvp-v1 has none.',
      );
    },
    slow,
  );
});

// #413 F6c: `--production` lifts only the allocation refusal, so a party
// build that names it is refused before it reads an input or writes a file.
it('refuses --production on a campaign-party-v1 build before reading any input', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'party-production-'));
  try {
    const artifactPath = join(directory, 'release.json');
    await expect(
      runCatalogReleaseOperator({
        args: [
          'build',
          '--number',
          '1',
          '--system',
          '/nonexistent/system',
          '--content',
          '/nonexistent/content',
          '--pcgen',
          '/nonexistent/pcgen',
          '--artifact',
          artifactPath,
          '--scope',
          'campaign-party-v1',
          '--production',
        ],
      }),
    ).rejects.toThrow(
      '--production applies only to allocate with --target-kind production.',
    );
    await expect(readFile(artifactPath)).rejects.toThrow('ENOENT');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
