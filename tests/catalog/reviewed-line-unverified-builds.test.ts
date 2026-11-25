// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  buildAttribution227Matches,
  buildPcgenNameIndex,
} from '../../scripts/catalog/attribution-227-matcher';
import { committedAttribution227Matches } from '../../scripts/catalog/legal/attribution-227-matches';
import { committedReviewedPcgenRecords } from '../../scripts/catalog/reviewed-pcgen-records';
import { importCatalog } from '../../scripts/catalog/import';
import { runCatalogPreviewCommand } from '../../scripts/catalog/preview';
import { runCatalogReleaseOperator } from '../../scripts/catalog/release-operator';
import { parseLaunchInventory } from '../../scripts/catalog/launch-inventory-document';
import {
  decodePartyScope,
  partyScopeBytes,
} from '../../scripts/catalog/party/party-scope';
import { reducedManifest } from './release-scope-fixtures';
import { validateCatalogReleaseArtifact } from '../../src/lib/catalog/release-schema';
import { readPinned } from './pinned-sources';
import {
  admittedOf,
  apgClass,
  cavalier,
  listMissing,
  loseList,
  row,
  slow,
  standInClass,
  useFixture,
} from './reviewed-line-unverified-fixture';

// The property (`reviewed-line-unverified-fixture.ts`) on `catalog:preview`
// and `catalog:release` builds, each with the list missing beside its control
// with the list present.

const probes = await vi.hoisted(
  () => import('./reviewed-line-unverified-probes'),
);
vi.mock('node:fs', probes.nodeFs);
vi.mock('node:fs/promises', probes.nodeFsPromises);
vi.mock('../../scripts/catalog/party/party-builds.ts', probes.partyBuilds);
vi.mock(
  '../../scripts/catalog/reviewed-data-files.ts',
  probes.reviewedDataFiles,
);
vi.mock('../../scripts/catalog/conditions.ts', probes.conditions);
vi.mock(
  '../../scripts/catalog/launch-verification-build.ts',
  probes.launchVerificationBuild,
);
vi.mock(
  '../../scripts/catalog/party/pinned-catalog-checkouts.ts',
  probes.pinnedCatalogCheckouts,
);
vi.mock(
  '../../scripts/catalog/reviewed-pcgen-records',
  probes.reviewedPcgenRecords,
);
vi.mock(
  '../../scripts/catalog/legal/attribution-227-matches.ts',
  probes.attribution227Matches,
);

const fixture = useFixture();

describe('the record checked in memory', () => {
  it('is the record step’s check, and the matches are a generation’s with it checked', async () => {
    expect(committedReviewedPcgenRecords).toMatchObject([
      { externalKey: row, ...probes.checkedReview },
    ]);
    const artifact = await importCatalog({
      systemPath: fixture.tree.systemPath,
      contentPath: fixture.tree.contentPath,
      remaps: [],
      wholeCorpus: false,
    });
    const generated = buildAttribution227Matches({
      entries: artifact.catalog.entries,
      index: buildPcgenNameIndex({
        files: await Promise.all(
          [
            'roleplaying_game/advanced_players_guide/advanced_players_guide.pcc',
            apgClass,
          ].map(async (path) => ({
            path,
            text: await readPinned('pcgen', `data/pathfinder/paizo/${path}`),
          })),
        ),
      }),
      stored: new Map(),
      reviewedRecords: committedReviewedPcgenRecords,
      inputs: {},
    });
    expect(
      committedAttribution227Matches.matches.find(
        ({ externalKey }) => externalKey === row,
      ),
    ).toEqual(generated.matches.find(({ externalKey }) => externalKey === row));
  });
});

describe('catalog:preview', () => {
  async function preview() {
    const out = await mkdtemp(join(fixture.root, 'preview-'));
    const outcome = await runCatalogPreviewCommand({
      args: [
        '--system',
        fixture.tree.systemPath,
        '--content',
        fixture.tree.contentPath,
        '--allow-unverified-checkouts',
        '--attribution',
        fixture.attribution,
        '--out',
        out,
      ],
    });
    const admission = join(out, 'admission.json');
    return {
      outcome,
      admitted: existsSync(admission)
        ? admittedOf(
            (
              JSON.parse(await readFile(admission, 'utf8')) as {
                admitted: { externalKey: string }[];
              }
            ).admitted.map(({ externalKey }) => externalKey),
          )
        : undefined,
    };
  }

  it('admits the row on its reviewed line with the list present', async () => {
    expect((await preview()).admitted).toEqual([row]);
  });

  it('admits neither the row nor the class with the list missing', async () => {
    loseList();
    const { outcome, admitted } = await preview();
    expect(outcome.status).not.toBe(0);
    expect(admitted ?? []).toEqual([]);
  });
});

describe('catalog:release build', () => {
  const committed = parseLaunchInventory(
    JSON.parse(
      readFileSync('scripts/catalog/scopes/campaign-mvp-v1.json', 'utf8'),
    ),
  );
  function buildArgs(
    artifact: string,
    scope?: [string, string],
    checkouts: { systemPath: string; contentPath: string } = fixture.tree,
  ) {
    return [
      'build',
      '--number',
      '1',
      '--schema',
      'character-sheet-v1',
      '--calculation',
      'facts-v1',
      '--system',
      checkouts.systemPath,
      '--content',
      checkouts.contentPath,
      '--artifact',
      artifact,
      '--allow-unverified-checkouts',
      '--attribution',
      fixture.attribution,
      ...(scope ? ['--scope', scope[0], '--scope-manifest', scope[1]] : []),
    ];
  }
  const build = (args: string[]) =>
    runCatalogReleaseOperator({ args }).then(
      () => undefined,
      (failure: unknown) => failure,
    );
  const reportOf = async (artifact: string) =>
    JSON.parse(
      await readFile(artifact.replace(/\.json$/, '.scope.json'), 'utf8'),
    ) as {
      rows: {
        key?: string;
        gate?: string;
        outcome: string;
        cause?: string;
        reason?: string;
      }[];
    };
  const rowsOf = (report: Awaited<ReturnType<typeof reportOf>>) =>
    report.rows.filter(
      ({ key }) => key === row || key === cavalier || key === standInClass,
    );

  const included = async (artifact: string) =>
    admittedOf(
      (
        await validateCatalogReleaseArtifact(
          JSON.parse(await readFile(artifact, 'utf8')),
        )
      ).batches
        .flat()
        .map(({ key }) => key),
    );

  // The whole release writes only when its gates pass, as they do on the
  // stand-in tree with the list present.
  describe('whole', () => {
    it(
      'writes its artifact with both with the list present',
      async () => {
        const artifact = join(fixture.root, 'whole-present/release.json');
        expect(
          await build(buildArgs(artifact, undefined, fixture.standInTree)),
        ).toBeUndefined();
        expect((await included(artifact)).sort()).toEqual(
          [row, standInClass].sort(),
        );
      },
      slow,
    );

    it(
      'writes no artifact with the list missing',
      async () => {
        loseList();
        const artifact = join(fixture.root, 'whole-missing/release.json');
        expect(
          await build(buildArgs(artifact, undefined, fixture.standInTree)),
        ).toMatchObject({ message: expect.stringMatching(listMissing) });
        expect(existsSync(artifact)).toBe(false);
      },
      slow,
    );
  });

  describe('scoped (campaign-mvp-v1: the Cavalier root and the row)', () => {
    let manifest: string;
    beforeAll(async () => {
      manifest = join(fixture.root, 'campaign-mvp-v1.json');
      const tactician = committed.rows.find(({ key }) => key === row);
      if (!tactician) throw new Error(`No committed row ${row}.`);
      await writeFile(
        manifest,
        JSON.stringify(
          reducedManifest(committed, [cavalier], {
            rows: [tactician],
            edges: committed.edges.filter(
              ({ from, to, kind }) =>
                from === cavalier && to === row && kind !== 'citation',
            ),
          }),
        ),
      );
    });

    it(
      'reports the row admitted by the gate with the list present',
      async () => {
        const artifact = join(fixture.root, 'scoped-present/release.json');
        await build(buildArgs(artifact, ['campaign-mvp-v1', manifest]));
        expect(
          rowsOf(await reportOf(artifact)).map(({ key, gate }) => [key, gate]),
        ).toEqual([
          [row, 'admitted'],
          [cavalier, 'failed'],
        ]);
      },
      slow,
    );

    it(
      'admits neither with the list missing: its refusal report admits nothing, and no artifact is written',
      async () => {
        loseList();
        const artifact = join(fixture.root, 'scoped-missing/release.json');
        expect(
          await build(buildArgs(artifact, ['campaign-mvp-v1', manifest])),
        ).toBeInstanceOf(Error);
        expect(existsSync(artifact)).toBe(false);
        const rows = rowsOf(await reportOf(artifact));
        expect(rows.map(({ key }) => key)).toEqual([row, cavalier]);
        for (const outcome of rows) {
          expect(outcome.gate).not.toBe('admitted');
          expect(outcome.outcome).not.toBe('included');
        }
      },
      slow,
    );
  });

  describe('the party’s scoped build (campaign-party-v1: a character with the stand-in Cavalier and the row, the stand-in tree)', () => {
    let scope: string;
    beforeAll(async () => {
      const party = decodePartyScope(
        JSON.parse(
          readFileSync('scripts/catalog/scopes/campaign-party-v1.json', 'utf8'),
        ),
      );
      scope = join(fixture.root, 'campaign-party-v1.json');
      await writeFile(
        scope,
        partyScopeBytes({
          ...party,
          roots: [{ key: standInClass, group: 'classes', characters: ['3'] }],
          rows: [
            {
              key: standInClass,
              kind: 'class',
              name: 'Cavalier',
              characters: ['3'],
            },
            {
              key: row,
              kind: 'classFeature',
              name: 'Master Tacitician',
              characters: ['3'],
            },
          ],
          edges: [{ from: standInClass, to: row, link: 'reference' }],
        }),
      );
    });
    const partyArgs = (artifact: string) =>
      buildArgs(artifact, ['campaign-party-v1', scope], fixture.standInTree);

    it(
      'writes its artifact and includes both in its scope report with the list present',
      async () => {
        const artifact = join(fixture.root, 'party-present/release.json');
        // Its fixture scope does not qualify, so the build fails, after
        // writing its artifact (releases.md, "Scoped builds").
        expect(await build(partyArgs(artifact))).toBeInstanceOf(Error);
        expect(existsSync(artifact)).toBe(true);
        expect(
          rowsOf(await reportOf(artifact))
            .map(({ key, outcome }) => [key, outcome])
            .sort(),
        ).toEqual(
          [
            [row, 'included'],
            [standInClass, 'included'],
          ].sort(),
        );
      },
      slow,
    );

    it(
      'includes neither with the list missing, and writes no artifact',
      async () => {
        loseList();
        const artifact = join(fixture.root, 'party-missing/release.json');
        expect(await build(partyArgs(artifact))).toBeInstanceOf(Error);
        expect(existsSync(artifact)).toBe(false);
        const rows = rowsOf(await reportOf(artifact));
        expect(rows.map(({ key }) => key).sort()).toEqual(
          [row, standInClass].sort(),
        );
        for (const outcome of rows)
          expect(outcome.outcome).not.toBe('included');
      },
      slow,
    );
  });
});
