// @vitest-environment node
import { createHash } from 'node:crypto';
import type * as NodeFs from 'node:fs';
import type * as NodeFsPromises from 'node:fs/promises';
import type * as NodeCrypto from 'node:crypto';
import type * as ReviewedRecordsModule from '../../scripts/catalog/reviewed-pcgen-records';
import type * as MatchesModule from '../../scripts/catalog/legal/attribution-227-matches';
import type * as PartyBuildsModule from '../../scripts/catalog/party/party-builds';
import type * as VerificationBuildModule from '../../scripts/catalog/launch-verification-build';
import type * as ReviewedDataFilesModule from '../../scripts/catalog/reviewed-data-files';
import type * as ConditionsModule from '../../scripts/catalog/conditions';
import type * as PinnedCatalogCheckoutsModule from '../../scripts/catalog/party/pinned-catalog-checkouts';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  buildAttribution227Matches,
  buildPcgenNameIndex,
} from '../../scripts/catalog/attribution-227-matcher';
import { committedAttribution227Matches } from '../../scripts/catalog/legal/attribution-227-matches';
import { committedReviewedPcgenRecords } from '../../scripts/catalog/reviewed-pcgen-records';
import { importCatalog } from '../../scripts/catalog/import';
import { pinnedPcgenListPath } from '../../scripts/catalog/pinned-pcgen-store';
import { runCatalogPreviewCommand } from '../../scripts/catalog/preview';
import { runCatalogReleaseOperator } from '../../scripts/catalog/release-operator';
import { parseLaunchInventory } from '../../scripts/catalog/launch-inventory-document';
import {
  launchVerificationSchema,
  serializeLaunchVerification,
} from '../../scripts/catalog/launch-verification';
import {
  buildPartyScope,
  decodePartyScope,
  partyScopeBytes,
  partyScopePath,
  type PartyCatalogEntry,
} from '../../scripts/catalog/party/party-scope';
import { parsePartyBuilds } from '../../scripts/catalog/party/party-builds';
import { mvpStatus } from '../../scripts/mvp-status';
import { reducedManifest } from './release-scope-fixtures';
import { validateCatalogReleaseArtifact } from '../../src/lib/catalog/release-schema';
import { materializePinnedTree, readPinned } from './pinned-sources';

// The property (root, 2026-11-20): a reviewed-record match is never admitted,
// in any reader, release scope or preview, while the gate cannot read and
// verify its pinned line. Here the line cannot be read: the pinned store
// lacks its list. What each reader prints or returns then is not specified
// (it may stop with the gate's named error, fail a staleness check or write a
// refusal report); what is tested is that no output it produces admits the
// row or its dependent Cavalier class, and that no artifact it writes does.
// Each case with the list missing has a control beside it: the same reader
// with the list present admits the row, or writes or includes it, so each
// missing-list case fails when the missing-file probe below is disabled.

const apgClass =
  'roleplaying_game/advanced_players_guide/apg_abilities_class.lst';
const row = 'pf1/mrJ61WiA6PuZgPTJ';
// Each release build inspects its manifest, and the condition report and
// mvp:status read the committed catalog data: seconds each.
const slow = 120_000;
const cavalier = 'pf1/u1ed3H9xtYQXTP5v';
// A stand-in Cavalier under another key (the stand-in tree, below).
const standInClass = 'pf1/StandInCavalier0';

// The in-memory missing-file probe: a path ending in one of these reads as
// absent through `node:fs` and `node:fs/promises`, as when the pinned store
// lacks it.
const absent = vi.hoisted(() => ({ paths: new Set<string>() }));
const isAbsent = vi.hoisted(
  () => (path: unknown) =>
    [...absent.paths].some((suffix) => String(path).endsWith(suffix)),
);
// The in-memory changed-file probe: a path ending in one of these keys reads
// as its text through `node:fs` and `node:fs/promises`, as when the file was
// edited (the gate's read and every hash of it see the edit).
const replaced = vi.hoisted(() => ({ files: new Map<string, string>() }));
const replacementOf = vi.hoisted(() => (path: unknown, rest: unknown[]) => {
  const text = [...replaced.files].find(([suffix]) =>
    String(path).endsWith(suffix),
  )?.[1];
  if (text === undefined) return undefined;
  const [options] = rest;
  const encoded =
    typeof options === 'string' ||
    (typeof options === 'object' &&
      options !== null &&
      'encoding' in options &&
      options.encoding);
  return encoded ? text : Buffer.from(text);
});
// Every path read through `node:fs` and `node:fs/promises`, from a status
// case's start: the status reads no saved preview.
const reads = vi.hoisted(() => ({ paths: [] as string[] }));
const enoent = vi.hoisted(
  () => (path: unknown) =>
    Object.assign(
      new Error(`ENOENT: no such file or directory, open '${String(path)}'`),
      { code: 'ENOENT' },
    ),
);
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeFs>();
  const readFileSync = ((path: unknown, ...rest: unknown[]) => {
    reads.paths.push(String(path));
    if (isAbsent(path)) throw enoent(path);
    const replacement = replacementOf(path, rest);
    if (replacement !== undefined) return replacement;
    return (actual.readFileSync as (...args: unknown[]) => unknown)(
      path,
      ...rest,
    );
  }) as typeof actual.readFileSync;
  return { ...actual, default: { ...actual, readFileSync }, readFileSync };
});
// A committed file a case stands in for (the party scope and builds, the
// verification projection), by its exact repository path, read as that
// file's text; a write to it is kept here, never on disk. Empty but in the
// cases that set it.
const standIn = vi.hoisted(() => ({
  files: new Map<string, string>(),
  written: new Map<string, string>(),
}));
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeFsPromises>();
  const readFile = ((path: unknown, ...rest: unknown[]) => {
    reads.paths.push(String(path));
    const text = standIn.files.get(String(path));
    if (text !== undefined) return Promise.resolve(text);
    const replacement = replacementOf(path, rest);
    if (replacement !== undefined) return Promise.resolve(replacement);
    return isAbsent(path)
      ? Promise.reject(enoent(path))
      : (actual.readFile as (...args: unknown[]) => Promise<unknown>)(
          path,
          ...rest,
        );
  }) as typeof actual.readFile;
  const writeFile = ((path: unknown, data: unknown, ...rest: unknown[]) => {
    if (!standIn.files.has(String(path)))
      return (actual.writeFile as (...args: unknown[]) => Promise<void>)(
        path,
        data,
        ...rest,
      );
    standIn.written.set(String(path), String(data));
    return Promise.resolve();
  }) as typeof actual.writeFile;
  return {
    ...actual,
    default: { ...actual, readFile, writeFile },
    readFile,
    writeFile,
  };
});
// The party's builds a status case stands in, read as `readPartyBuilds`
// reads them (the bound builds file itself is never replaced, so the
// verification projection's binding of it holds).
const standInBuilds = vi.hoisted(() => ({
  bytes: undefined as string | undefined,
}));
vi.mock(
  '../../scripts/catalog/party/party-builds.ts',
  async (importOriginal) => {
    const actual = await importOriginal<typeof PartyBuildsModule>();
    return {
      ...actual,
      readPartyBuilds: (path?: string) => {
        const bytes = standInBuilds.bytes;
        return bytes === undefined
          ? actual.readPartyBuilds(path)
          : Promise.resolve({
              bytes,
              builds: actual.parsePartyBuilds(JSON.parse(bytes)),
            });
      },
    };
  },
);

// The committed reviewed admission a status case stands in (the fixture's,
// which admits the row on its books alone), read as the committed files are,
// by the status's gate and by a preview made without --attribution alike.
const standInReviewed = vi.hoisted(() => ({
  text: undefined as string | undefined,
}));
vi.mock(
  '../../scripts/catalog/reviewed-data-files.ts',
  async (importOriginal) => {
    const actual = await importOriginal<typeof ReviewedDataFilesModule>();
    const [{ reviewedAdmissionSchema }, { parseReviewedAdmissionInput }] =
      await Promise.all([
        import('../../src/lib/catalog/admission-schema'),
        import('../../src/lib/catalog/attribution-evidence-codec'),
      ]);
    return {
      ...actual,
      readCommittedReviewedAdmission: () => {
        const text = standInReviewed.text;
        return text === undefined
          ? actual.readCommittedReviewedAdmission()
          : Promise.resolve(
              reviewedAdmissionSchema.parse(parseReviewedAdmissionInput(text)),
            );
      },
    };
  },
);

// The condition report's catalog, a stand-in where a case sets its tree: the
// tree's import with the conditions appended, as `catalog:preview
// --conditions` builds it, so the report's gate reads the row and its class.
const conditionsTree = vi.hoisted(() => ({
  paths: undefined as { systemPath: string; contentPath: string } | undefined,
}));
vi.mock('../../scripts/catalog/conditions.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof ConditionsModule>();
  return {
    ...actual,
    buildConditionCatalogArtifact: async () => {
      const paths = conditionsTree.paths;
      if (paths === undefined) return actual.buildConditionCatalogArtifact();
      const { importCatalog } = await import('../../scripts/catalog/import');
      return actual.appendConditionResources(
        await importCatalog({ ...paths, remaps: [], wholeCorpus: false }),
      );
    },
  };
});

// The launch verification's build, a stand-in where a case sets its document
// (the real one reads the pinned upstream checkouts); its calls are counted.
const verificationBuild = vi.hoisted(() => ({
  calls: 0,
  document: undefined as (() => unknown) | undefined,
}));
vi.mock(
  '../../scripts/catalog/launch-verification-build.ts',
  async (importOriginal) => {
    const actual = await importOriginal<typeof VerificationBuildModule>();
    return {
      ...actual,
      buildLaunchVerification: (
        ...args: Parameters<typeof actual.buildLaunchVerification>
      ) => {
        verificationBuild.calls += 1;
        const document = verificationBuild.document;
        return document === undefined
          ? actual.buildLaunchVerification(...args)
          : Promise.resolve(document());
      },
    };
  },
);

// The pinned checkouts `catalog:party-scope` imports, a stand-in where a
// status case sets its tree (remote CI has none): the tree, read as
// `catalog:preview --allow-unverified-checkouts` reads it.
const checkouts = vi.hoisted(() => ({
  tree: undefined as { systemPath: string; contentPath: string } | undefined,
}));
vi.mock(
  '../../scripts/catalog/party/pinned-catalog-checkouts.ts',
  async (importOriginal) => {
    const actual = await importOriginal<typeof PinnedCatalogCheckoutsModule>();
    const { verifyInputs } = await import('../../scripts/catalog/operator');
    return {
      ...actual,
      pinnedCatalogCheckouts: async () => {
        const tree = checkouts.tree;
        if (tree === undefined) return actual.pinnedCatalogCheckouts();
        const [system, content] = [tree.systemPath, tree.contentPath];
        return {
          system,
          content,
          verification: await verifyInputs({
            system,
            content,
            allowUnverified: true,
          }),
        };
      },
    };
  },
);

// The record checked in memory: the committed reviewed PCGen record with a
// record step's review, and the committed matches as a generation with it
// checked writes them (its row's reviewed-record line on APG:206; checked
// against the matcher below). Every reader reads these as committed, while
// `inMemory.checked` holds (a status case sets it false: the committed,
// drafted files, as on disk); a module reads them when it is evaluated or
// called.
const checkedReview = vi.hoisted(() => ({
  status: 'checked' as const,
  reviewedBy: 'Fixture reviewer',
  reviewedOn: '2026-11-20',
  receipt: `t3-review-${'a'.repeat(64)}`,
}));
const inMemory = vi.hoisted(() => ({ checked: true }));
vi.mock(
  '../../scripts/catalog/reviewed-pcgen-records',
  async (importOriginal) => {
    const actual = await importOriginal<typeof ReviewedRecordsModule>();
    const checked = actual.committedReviewedPcgenRecords.map((record) => ({
      ...record,
      ...checkedReview,
    }));
    return {
      ...actual,
      get committedReviewedPcgenRecords() {
        return inMemory.checked
          ? checked
          : actual.committedReviewedPcgenRecords;
      },
    };
  },
);
vi.mock(
  '../../scripts/catalog/legal/attribution-227-matches.ts',
  async (importOriginal) => {
    const actual = await importOriginal<typeof MatchesModule>();
    const records =
      await import('../../scripts/catalog/reviewed-pcgen-records');
    const { readFileSync } = await vi.importActual<typeof NodeFs>('node:fs');
    const { createHash } =
      await vi.importActual<typeof NodeCrypto>('node:crypto');
    const [record] = records.committedReviewedPcgenRecords;
    if (!record) throw new Error('No reviewed PCGen record.');
    const { pinnedPcgenRoot } =
      await import('../../scripts/catalog/pinned-pcgen-store');
    const lines = readFileSync(
      join(pinnedPcgenRoot, record.pcgen.file),
      'utf8',
    ).split(/\r\n|\r|\n/);
    const index = lines.findIndex((text) =>
      text.split('\t').includes(`KEY:${record.pcgen.key}`),
    );
    const document = actual.committedAttribution227Matches;
    const twin = document.matches.find(
      ({ externalKey }) => externalKey === 'pf1/mvyIXBt01WtR0lM1',
    );
    if (twin?.status !== 'matched') throw new Error('No matched twin.');
    const matches = document.matches.map((match) =>
      match.externalKey === record.externalKey
        ? {
            externalKey: match.externalKey,
            name: match.name,
            kind: match.kind,
            status: 'matched' as const,
            evidence: [
              {
                kind: 'pcgen-fallback' as const,
                rule: 'reviewed-record' as const,
                book: 'PZO1115',
                file: record.pcgen.file,
                line: index + 1,
                key: record.pcgen.key,
                lineSha256: createHash('sha256')
                  .update(lines[index] ?? '')
                  .digest('hex'),
                record: records.reviewedPcgenRecordIdentity(record),
              },
            ] as const,
            classes: twin.classes,
          }
        : match,
    );
    const checked = {
      ...document,
      matches,
      binding: {
        ...document.binding,
        matchesSha256: actual.matchesSha256(matches),
      },
    };
    return {
      ...actual,
      get committedAttribution227Matches() {
        return inMemory.checked ? checked : document;
      },
    };
  },
);

afterEach(() => {
  inMemory.checked = true;
  checkouts.tree = undefined;
  absent.paths.clear();
  replaced.files.clear();
  standInReviewed.text = undefined;
  conditionsTree.paths = undefined;
  standIn.files.clear();
  standIn.written.clear();
  standInBuilds.bytes = undefined;
  verificationBuild.document = undefined;
});
const loseList = () => absent.paths.add(pinnedPcgenListPath(apgClass));
/** The error the gate's read of a missing list raises, where a command stops on it. */
const listMissing =
  /^The pinned PCGen list tests\/fixtures\/pinned\/pcgen\/.+\/apg_abilities_class\.lst is missing from the pinned store/;

const temporary: string[] = [];
let tree: Awaited<ReturnType<typeof materializePinnedTree>>;
let standInTree: Awaited<ReturnType<typeof materializePinnedTree>>;
let root: string;
let attribution: string;
beforeAll(async () => {
  // The row and the class that grants it, from the pinned store. Nothing else
  // of the Cavalier is in the store, so the class fails on its other
  // features here whatever the list; the whole corpus admits it with the row.
  tree = await materializePinnedTree([
    'pf1/packs/class-abilities/master-tacitician.mrJ61WiA6PuZgPTJ.yaml',
    'pf1/packs/classes/cavalier.u1ed3H9xtYQXTP5v.yaml',
  ]);
  // The stand-in tree: the row and a stand-in Cavalier, the pinned class
  // under another key (so the class's reviewed schedule, keyed by the
  // Cavalier's own key, does not add the features the store lacks) with one
  // class row, the row's at level 17. A row of a class named Cavalier grants
  // the row, as its reviewed line requires; with the list present the gate
  // admits both, so a release of them is written.
  standInTree = await materializePinnedTree([
    'pf1/packs/class-abilities/master-tacitician.mrJ61WiA6PuZgPTJ.yaml',
    'pf1/packs/classes/cavalier.u1ed3H9xtYQXTP5v.yaml',
  ]);
  const classes = join(standInTree.systemPath, 'packs/classes');
  const original = join(classes, 'cavalier.u1ed3H9xtYQXTP5v.yaml');
  const text = await readFile(original, 'utf8');
  const standIn = text
    .replaceAll('u1ed3H9xtYQXTP5v', standInClass.slice('pf1/'.length))
    .replace(
      /( {4}classAssociations:\n)(?: {6}- level: \d+\n {8}uuid: [^\n]+\n)+/,
      '$1      - level: 17\n        uuid: Compendium.pf1.class-abilities.Item.mrJ61WiA6PuZgPTJ\n',
    );
  expect(standIn.match(/- level:/g)).toHaveLength(1);
  await rm(original);
  await writeFile(
    join(classes, `cavalier.${standInClass.slice('pf1/'.length)}.yaml`),
    standIn,
  );
  root = await mkdtemp(join(tmpdir(), 'reviewed-line-unverified-'));
  temporary.push(root);
  // No assessment: the row is admitted on its books alone, which the
  // committed Registry reviews (PZO1115).
  attribution = join(root, 'attribution.json');
  await writeFile(
    attribution,
    JSON.stringify({
      assessments: [],
      evidence: {},
      registry: JSON.parse(
        readFileSync('src/lib/catalog/data/section15-registry.json', 'utf8'),
      ),
    }),
  );
});
afterAll(async () => {
  await tree.dispose();
  await standInTree.dispose();
  await Promise.all(
    temporary.map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe('the record checked in memory', () => {
  it('is the record step’s check, and the matches are a generation’s with it checked', async () => {
    expect(committedReviewedPcgenRecords).toMatchObject([
      { externalKey: row, ...checkedReview },
    ]);
    const artifact = await importCatalog({
      systemPath: tree.systemPath,
      contentPath: tree.contentPath,
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

/** The keys an output admits, of the row and its class. */
const admittedOf = (keys: readonly string[]) =>
  keys.filter((key) => key === row || key === cavalier || key === standInClass);

describe('catalog:preview', () => {
  async function preview() {
    const out = await mkdtemp(join(root, 'preview-'));
    const outcome = await runCatalogPreviewCommand({
      args: [
        '--system',
        tree.systemPath,
        '--content',
        tree.contentPath,
        '--allow-unverified-checkouts',
        '--attribution',
        attribution,
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
    checkouts: { systemPath: string; contentPath: string } = tree,
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
      attribution,
      ...(scope ? ['--scope', scope[0], '--scope-manifest', scope[1]] : []),
    ];
  }
  /** A build's error, if it throws. */
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

  /** The row and class keys among a written release's rows. */
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

  // The whole release writes its artifact only when its gates pass, so it
  // reads the stand-in tree, where they pass with the list present.
  describe('whole', () => {
    it(
      'writes its artifact with both with the list present',
      async () => {
        const artifact = join(root, 'whole-present/release.json');
        expect(
          await build(buildArgs(artifact, undefined, standInTree)),
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
        const artifact = join(root, 'whole-missing/release.json');
        expect(
          await build(buildArgs(artifact, undefined, standInTree)),
        ).toMatchObject({ message: expect.stringMatching(listMissing) });
        expect(existsSync(artifact)).toBe(false);
      },
      slow,
    );
  });

  describe('scoped (campaign-mvp-v1: the Cavalier root and the row)', () => {
    let manifest: string;
    beforeAll(async () => {
      manifest = join(root, 'campaign-mvp-v1.json');
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
        const artifact = join(root, 'scoped-present/release.json');
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
        const artifact = join(root, 'scoped-missing/release.json');
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
      scope = join(root, 'campaign-party-v1.json');
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
      buildArgs(artifact, ['campaign-party-v1', scope], standInTree);

    // A scoped party build over a fixture scope and partial inputs does not
    // qualify (its scope is not the committed one's, and checked records name
    // entries these inputs lack). A scoped build that passes the gates still
    // writes its artifact when its scope fails to qualify (it exits non-zero:
    // releases.md, "Scoped builds"), so with the list present this one writes
    // an artifact; with the list missing the gate stops it, and it writes
    // none. Its scope report says which rows it includes.
    it(
      'writes its artifact and includes both in its scope report with the list present',
      async () => {
        const artifact = join(root, 'party-present/release.json');
        // Not qualified, so the build fails, after writing its artifact.
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
        const artifact = join(root, 'party-missing/release.json');
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

/**
 * The committed verification projection as a generation after the record
 * step checked the record would bind its inputs: the committed one with the
 * pinned list bound and a row for the record. Its row's four verified
 * observations are synthetic fixture data, written here, not a generation's
 * verification; the cases read only whether the projection is current.
 * `inputs` overrides bound hashes.
 */
const listPath = pinnedPcgenListPath(apgClass);
// Read before any case loses the list.
const listSha256 = createHash('sha256')
  .update(readFileSync(listPath))
  .digest('hex');
function checkedProjection(inputs: Record<string, string> = {}) {
  const committed = JSON.parse(readFileSync(verificationPath, 'utf8')) as {
    binding: { inputs: Record<string, string>; packages: unknown };
    rows: { key: string }[];
  };
  const rows = [
    ...committed.rows,
    {
      key: row,
      verified: ['admission', 'structure', 'contentEvidence', 'noticeEvidence'],
      mechanisms: [],
      prose: [],
      evidence: [],
    },
  ].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return {
    ...committed,
    binding: {
      ...committed.binding,
      inputs: Object.fromEntries(
        Object.entries({
          ...committed.binding.inputs,
          [listPath]: listSha256,
          ...inputs,
        }).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      ),
    },
    rows,
  };
}
const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
const verificationPath =
  'scripts/catalog/scopes/campaign-mvp-v1.verification.json';

/** Runs a script's module as its command would, with `argv`, capturing what it prints on stdout (`printed`) and on stderr (`progress`). */
async function runScript(load: () => Promise<unknown>, argv: string[] = []) {
  const saved = process.argv;
  const savedExitCode = process.exitCode;
  process.argv = [saved[0] ?? 'node', 'script', ...argv];
  let printed = '';
  let progress = '';
  const write = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      printed += String(chunk);
      return true;
    });
  const writeProgress = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      progress += String(chunk);
      return true;
    });
  // A script's `process.exit(0)` ends its run; any other exit is an error.
  const exited = new Error('exit 0');
  const exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw code === 0 || code === undefined
      ? exited
      : new Error(`exit ${String(code)}`);
  });
  // Each run evaluates the script and what it imports afresh, as a command does.
  vi.resetModules();
  try {
    const error = await load().then(
      () => undefined,
      (failure: unknown) => (failure === exited ? undefined : failure),
    );
    return { error, printed, progress };
  } finally {
    write.mockRestore();
    writeProgress.mockRestore();
    exit.mockRestore();
    process.argv = saved;
    process.exitCode = savedExitCode;
  }
}

// `catalog:launch-inventory --verify`, run as its script. The real build
// needs the pinned upstream checkouts, which remote CI lacks, so the build is
// a stand-in that returns the checked projection (`checkedProjection`, which
// verifies the row) and counts its calls; the committed projection is a
// stand-in too, so a write is kept here. With the list present the command
// builds, then compares or writes, and prints its summary; with it missing it
// stops on the gate's named error before it builds, and writes and prints
// nothing. The real build's own read of the list (`launchVerificationInputs`,
// which `buildLaunchVerification` binds its inputs with) is tested in
// `attribution-227-matches.test.ts`.
describe('catalog:launch-inventory --verify', () => {
  async function verify(mode: '--check' | '--write', committed: string) {
    standIn.files.set(verificationPath, committed);
    verificationBuild.calls = 0;
    verificationBuild.document = () =>
      launchVerificationSchema.parse(checkedProjection());
    return runScript(
      () => import('../../scripts/catalog-launch-inventory.ts'),
      ['--verify', mode],
    );
  }
  const built = () =>
    serializeLaunchVerification(
      launchVerificationSchema.parse(checkedProjection()),
    );

  it(
    '--check builds, finds the projection current and prints its summary with the list present',
    async () => {
      const { error, printed } = await verify('--check', built());
      expect(error).toBeUndefined();
      expect(verificationBuild.calls).toBe(1);
      expect(printed).toContain('"allObservationsVerified"');
      expect(standIn.written.size).toBe(0);
    },
    slow,
  );

  it(
    '--check stops before it builds with the list missing, and prints nothing',
    async () => {
      loseList();
      const { error, printed } = await verify('--check', built());
      expect((error as Error | undefined)?.message).toMatch(listMissing);
      expect(verificationBuild.calls).toBe(0);
      expect(printed).toBe('');
    },
    slow,
  );

  it(
    '--write writes the projection, which verifies the row, with the list present',
    async () => {
      const { error, printed } = await verify('--write', 'committed\n');
      expect(error).toBeUndefined();
      const written = standIn.written.get(verificationPath);
      expect(written).toBe(built());
      expect(
        (JSON.parse(written ?? '{}') as { rows: { key: string }[] }).rows.some(
          ({ key }) => key === row,
        ),
      ).toBe(true);
      expect(printed).toContain('"allObservationsVerified"');
    },
    slow,
  );

  it(
    '--write stops before it builds with the list missing, and writes and prints nothing',
    async () => {
      loseList();
      const { error, printed } = await verify('--write', 'committed\n');
      expect((error as Error | undefined)?.message).toMatch(listMissing);
      expect(verificationBuild.calls).toBe(0);
      expect(standIn.written.size).toBe(0);
      expect(printed).toBe('');
    },
    slow,
  );
});

// The condition report runs the gate on its catalog; here its catalog is the
// stand-in tree's with the conditions appended, so with the list present the
// report admits the row and its stand-in class beside the conditions, and
// with it missing the gate stops on its named error and nothing is printed.
describe('catalog:conditions', () => {
  async function report() {
    conditionsTree.paths = standInTree;
    return runScript(() => import('../../scripts/catalog-conditions.ts'));
  }

  it(
    'admits the row and its class in its report with the list present',
    async () => {
      const { error, printed } = await report();
      expect(error).toBeUndefined();
      const { admission } = JSON.parse(printed) as {
        admission: { admitted: { externalKey: string }[] };
      };
      expect(
        admittedOf(
          admission.admitted.map(({ externalKey }) => externalKey),
        ).sort(),
      ).toEqual([row, standInClass].sort());
    },
    slow,
  );

  it(
    'gives no report with the list missing',
    async () => {
      loseList();
      const { error, printed } = await report();
      expect((error as Error | undefined)?.message).toMatch(listMissing);
      expect(printed).toBe('');
    },
    slow,
  );
});

// `mvp:status` applies a projection's rows only while it is current.
describe('mvp:status', () => {
  it(
    'applies the projection’s row for the record (its synthetic observations) with the list present',
    async () => {
      const { verification } = await mvpStatus(checkedProjection());
      expect(verification.stale).toEqual([]);
      expect(verification.rows.map(({ key }) => key)).toContain(row);
    },
    slow,
  );

  it(
    'applies no projection row with the list missing: the projection is stale',
    async () => {
      loseList();
      const { verification, lines } = await mvpStatus(checkedProjection());
      expect(verification.stale.join('; ')).toContain(listPath);
      expect(verification.rows).toEqual([]);
      expect(lines.join('\n')).toContain('Verification stale');
    },
    slow,
  );
});

// Here the party is one character with the Cavalier and the row, with the
// committed party scope, builds and verification projection stood in: the
// scope the row's tree gives, and the projection the one a generation with
// the record checked binds.
// `catalog:party-scope --status`, run as its script. It imports the whole
// catalog at the pinned checkouts and runs the gate on it itself; remote CI
// has no pinned checkouts, so the checkouts are a stand-in, the row's tree
// read as `catalog:preview --allow-unverified-checkouts` reads it, and all
// that follows (the import, the gate, the scope and the labels) is the
// command's own. The property (root, 2026-11-20): whatever saved preview is
// on disk, the status reports exactly the admissions a fresh preview reports
// now; it reads no preview.
describe('catalog:party-scope --status', () => {
  let scope: string;
  let fixtureReviewed: string;
  const builds = JSON.stringify({
    schemaVersion: 1,
    scopeVersion: 'campaign-party-v1',
    note: 'Fixture.',
    characters: [
      {
        id: '3',
        kind: 'character',
        race: { kind: 'open', note: 'Fixture.' },
        levels: {
          kind: 'written',
          build: {
            now: [{ class: 'Cavalier', level: 17 }],
            next: {
              kind: 'known',
              classes: [{ class: 'Cavalier', level: 18 }],
            },
          },
        },
        keys: {
          classes: [{ kind: 'matched', key: cavalier, name: 'Cavalier' }],
          classFeatures: [
            { kind: 'matched', key: row, name: 'Master Tacitician' },
          ],
        },
      },
    ],
  });
  /**
   * `catalog:preview` of the row's tree run now, of the committed inputs (the
   * fixture's reviewed admission standing in), its modules evaluated afresh
   * as a command's are.
   */
  async function previewNow() {
    const out = await mkdtemp(join(root, 'status-preview-'));
    standInReviewed.text = fixtureReviewed;
    vi.resetModules();
    const { runCatalogPreviewCommand } =
      await import('../../scripts/catalog/preview');
    try {
      const outcome = await runCatalogPreviewCommand({
        args: [
          '--system',
          tree.systemPath,
          '--content',
          tree.contentPath,
          '--allow-unverified-checkouts',
          '--out',
          out,
        ],
      });
      return { outcome, out };
    } finally {
      standInReviewed.text = undefined;
    }
  }
  /** A preview made now, as `previewNow`. */
  async function makePreview() {
    const { outcome, out } = await previewNow();
    expect(outcome.stdout).toContain('Admission:');
    return out;
  }
  type Gate = Record<
    'admitted' | 'held' | 'dependentOmissions' | 'failures',
    { externalKey: string }[]
  >;
  const readGate = async (preview: string) =>
    JSON.parse(await readFile(join(preview, 'admission.json'), 'utf8')) as Gate;
  /** Each scope row's state in a preview's gate, as the status counts it (a failure first, then a hold, then an omission). */
  function scopeStates(gate: Gate) {
    const keys = decodePartyScope(JSON.parse(scope)).rows.map(({ key }) => key);
    const has = (rows: { externalKey: string }[], key: string) =>
      rows.some(({ externalKey }) => externalKey === key);
    return Object.fromEntries(
      keys.map((key) => [
        key,
        has(gate.failures, key)
          ? 'failed'
          : has(gate.held, key)
            ? 'held'
            : has(gate.dependentOmissions, key)
              ? 'omitted'
              : has(gate.admitted, key)
                ? 'admitted'
                : 'absent',
      ]),
    );
  }
  const counted = (states: Record<string, string>) => ({
    admitted: Object.values(states).filter((state) => state === 'admitted')
      .length,
    held: Object.values(states).filter((state) => state === 'held').length,
    omitted: Object.values(states).filter((state) => state === 'omitted')
      .length,
    failed: Object.values(states).filter((state) => state === 'failed').length,
  });
  type Report = {
    total: Record<'admitted' | 'held' | 'omitted' | 'failed', number>;
  };
  beforeAll(async () => {
    fixtureReviewed = await readFile(attribution, 'utf8');
    const preview = await makePreview();
    const catalog = JSON.parse(
      await readFile(join(preview, 'catalog.json'), 'utf8'),
    ) as { entries: PartyCatalogEntry[]; resources: PartyCatalogEntry[] };
    scope = partyScopeBytes(
      buildPartyScope({
        builds: parsePartyBuilds(JSON.parse(builds)),
        buildsBytes: builds,
        catalog: {
          entries: [...catalog.entries, ...catalog.resources],
          upstream: [],
        },
      }),
    );
  }, slow);

  async function status(
    projection: unknown,
    { json = true, args = [] as string[], buildsBytes = builds } = {},
  ) {
    standIn.files.set(partyScopePath, scope);
    if (projection === undefined) absent.paths.add(verificationPath);
    else standIn.files.set(verificationPath, JSON.stringify(projection));
    standInBuilds.bytes = buildsBytes;
    standInReviewed.text = fixtureReviewed;
    checkouts.tree = tree;
    reads.paths.length = 0;
    return runScript(
      () => import('../../scripts/catalog-party-scope.ts'),
      ['--status', ...(json ? ['--json'] : []), ...args],
    );
  }
  /** The status's report and a fresh preview's gate made now, for the same inputs. */
  async function statusBesideFresh(projection: unknown) {
    const run = await status(projection);
    expect(run.error).toBeUndefined();
    const fresh = scopeStates(await readGate(await makePreview()));
    return { report: JSON.parse(run.printed) as Report, fresh };
  }
  const reportCounts = ({ total }: Report) => ({
    admitted: total.admitted,
    held: total.held,
    omitted: total.omitted,
    failed: total.failed,
  });
  /** The status's refusal of a stale projection, naming `input`. */
  const staleRefusal = (input: string) =>
    new RegExp(
      `^The committed verification projection is stale \\(.*${escapeRegExp(input)}.*no status is printed`,
    );
  /** A file's text with `edit` applied, and its new SHA-256 as the regenerated projection binds it. */
  function edited(path: string, edit: (text: string) => string) {
    const text = edit(readFileSync(path, 'utf8'));
    return {
      text,
      sha256: createHash('sha256').update(text).digest('hex'),
    };
  }
  /** The pinned list with the row's reviewed line (APG:206) changed. */
  const changedLine = () =>
    edited(listPath, (text) => {
      const [record] = committedReviewedPcgenRecords;
      const lines = text.split('\n');
      const index = lines.findIndex((line) =>
        line.split('\t').includes(`KEY:${record?.pcgen.key ?? ''}`),
      );
      expect(index).toBeGreaterThan(0);
      lines[index] = `${lines[index] ?? ''}\tDESC:Changed.`;
      return lines.join('\n');
    });
  /** A preview made now that admits the row, as an earlier run left it on disk. */
  async function savedAdmittingPreview() {
    const saved = await makePreview();
    expect(scopeStates(await readGate(saved))[row]).toBe('admitted');
    return saved;
  }
  /** No file of a saved preview was read by the status. */
  const readNothingOf = (preview: string) =>
    expect(reads.paths.filter((path) => path.startsWith(preview))).toEqual([]);

  // This head's output for the same inputs, recorded at 0c003c6f from a
  // current preview: the JSON byte for byte, the text but for its first line,
  // which named the preview's gate.
  const recordedJson = String.raw`{
  "scopeVersion": "campaign-party-v1",
  "total": {
    "needed": 3,
    "admitted": 1,
    "verified": 0,
    "unverified": 1,
    "held": 0,
    "omitted": 0,
    "failed": 1,
    "absent": 0,
    "unmatched": 1,
    "heldBy": [],
    "failedBy": [
      {
        "reason": "Broken structure or reference: unresolved imported reference.",
        "rows": [
          "Cavalier"
        ]
      }
    ]
  },
  "characters": [
    {
      "id": "3",
      "needed": 3,
      "admitted": 1,
      "verified": 0,
      "unverified": 1,
      "held": 0,
      "omitted": 0,
      "failed": 1,
      "absent": 0,
      "unmatched": 1,
      "heldBy": [],
      "failedBy": [
        {
          "reason": "Broken structure or reference: unresolved imported reference.",
          "rows": [
            "Cavalier"
          ]
        }
      ],
      "ready": false,
      "firstStop": "race not written (Fixture.)"
    }
  ],
  "omitted": [
    {
      "key": "pf1/u1ed3H9xtYQXTP5v",
      "kind": "class",
      "name": "Cavalier",
      "characters": [
        "3"
      ],
      "state": "failed",
      "on": [
        "Cavalier fails (Broken structure or reference: unresolved imported reference.)"
      ]
    }
  ],
  "upstream": [],
  "labels": "the committed verification projection, current"
}
`;
  const recordedText = String.raw`Party status of campaign-party-v1, the launch measure (owner, 2026-11-10): the admission gate, run now on the whole import at the pins ; labels from the committed verification projection, current.
Needed: the scope rows a character reaches from its builds keys, plus its unmatched entries and open race. Omitted: dependent omission. A character is ready when every row it needs is admitted.
Total (each row once): 3 needed, 1 admitted (0 verified, 1 unverified), 0 held, 0 omitted, 1 failed, 1 unmatched
  failed, Broken structure or reference: unresolved imported reference.: Cavalier
Classes and races not admitted:
  Cavalier (class; 3): failed Cavalier fails (Broken structure or reference: unresolved imported reference.)
Characters:
  3: 3 needed, 1 admitted (0 verified, 1 unverified), 0 held, 0 omitted, 1 failed, 1 unmatched
    failed, Broken structure or reference: unresolved imported reference.: Cavalier
Ready (every row admitted):
  3: not ready: race not written (Fixture.)
`;

  it(
    'prints, for the inputs as they are, what this head printed from a current preview (JSON byte for byte; the text but for its first line)',
    async () => {
      const json = await status(checkedProjection());
      expect(json.error).toBeUndefined();
      expect(json.printed).toBe(recordedJson);
      const text = await status(checkedProjection(), { json: false });
      expect(text.error).toBeUndefined();
      expect(text.printed).toBe(recordedText);
    },
    slow,
  );

  it(
    'takes no saved preview: --preview DIR is refused',
    async () => {
      const saved = await savedAdmittingPreview();
      const { error, printed } = await status(checkedProjection(), {
        args: ['--preview', saved],
      });
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/Unknown option '--preview'/);
      expect(printed).toBe('');
    },
    slow,
  );

  it(
    'round 10 probe: with the reviewed line changed and the projection regenerated, it reports the row held, as a fresh preview does, though a saved preview admits it',
    async () => {
      const saved = await savedAdmittingPreview();
      const line = changedLine();
      replaced.files.set(listPath, line.text);
      const { report, fresh } = await statusBesideFresh(
        checkedProjection({ [listPath]: line.sha256 }),
      );
      readNothingOf(saved);
      expect(fresh[row]).toBe('held');
      expect(reportCounts(report)).toEqual(counted(fresh));
      expect(report.total.held).toBe(1);
    },
    slow,
  );

  it(
    'round 10 probe: with the list lost and the projection current without it, it admits nothing, as a fresh preview admits nothing',
    async () => {
      const saved = await savedAdmittingPreview();
      loseList();
      const { [listPath]: _list, ...withoutList } =
        checkedProjection().binding.inputs;
      expect(_list).toBeDefined();
      const projection = checkedProjection();
      const { error, printed } = await status({
        ...projection,
        binding: { ...projection.binding, inputs: withoutList },
      });
      readNothingOf(saved);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(listMissing);
      expect(printed).toBe('');
      const { outcome } = await previewNow();
      expect(outcome.stderr).toMatch(listMissing);
    },
    slow,
  );

  it(
    'round 11 probe: a preview made while the checked record was loaded, the record drafted again on disk: it reports the row held, as a fresh preview does',
    async () => {
      const saved = await savedAdmittingPreview();
      inMemory.checked = false;
      const { report, fresh } = await statusBesideFresh(
        JSON.parse(readFileSync(verificationPath, 'utf8')),
      );
      readNothingOf(saved);
      expect(fresh[row]).toBe('held');
      expect(reportCounts(report)).toEqual(counted(fresh));
      expect(report.total.held).toBe(1);
    },
    slow,
  );

  it(
    'round 11 probe: a saved preview edited by hand after the reviewed line changed, the projection current: it reports the row held, as a fresh preview does',
    async () => {
      const saved = await savedAdmittingPreview();
      const path = join(saved, 'admission.json');
      const admission = JSON.parse(await readFile(path, 'utf8')) as Record<
        string,
        unknown
      >;
      // A binding as fix r10's previews wrote it (the projection's inputs and
      // package resolution, no replaced input) with only the pinned list's
      // hash omitted, the incomplete binding round 11 found passing.
      const { binding } = checkedProjection();
      const { [listPath]: omitted, ...inputs } = binding.inputs;
      expect(omitted).toBeDefined();
      await writeFile(
        path,
        `${JSON.stringify({ ...admission, gateBinding: { inputs, packages: binding.packages, replacedInputs: [] } }, null, 2)}\n`,
      );
      const line = changedLine();
      replaced.files.set(listPath, line.text);
      const { report, fresh } = await statusBesideFresh(
        checkedProjection({ [listPath]: line.sha256 }),
      );
      readNothingOf(saved);
      expect(fresh[row]).toBe('held');
      expect(reportCounts(report)).toEqual(counted(fresh));
    },
    slow,
  );

  it(
    'a planted preview claiming an admission the gate does not give is not reported: the row is held, as a fresh preview holds it',
    async () => {
      inMemory.checked = false;
      const planted = await makePreview();
      const path = join(planted, 'admission.json');
      const gate = JSON.parse(await readFile(path, 'utf8')) as Gate &
        Record<string, unknown>;
      const claimed = gate.held.find(({ externalKey }) => externalKey === row);
      expect(claimed).toBeDefined();
      await writeFile(
        path,
        `${JSON.stringify(
          {
            ...gate,
            admitted: [...gate.admitted, { externalKey: row }],
            held: gate.held.filter(({ externalKey }) => externalKey !== row),
          },
          null,
          2,
        )}\n`,
      );
      expect(scopeStates(await readGate(planted))[row]).toBe('admitted');
      const { report, fresh } = await statusBesideFresh(
        JSON.parse(readFileSync(verificationPath, 'utf8')),
      );
      readNothingOf(planted);
      expect(fresh[row]).toBe('held');
      expect(reportCounts(report)).toEqual(counted(fresh));
      expect(report.total.admitted).toBe(0);
    },
    slow,
  );

  it(
    "after an unrelated reviewed record's rationale changed (Glorious Heat's), with the projection regenerated, it reports what a fresh preview reports (the row admitted)",
    async () => {
      const records = 'scripts/catalog/reviewed-curation.json';
      const unrelated = 'pf1-content/01MUL5N0meygR4Am';
      const change = edited(records, (text) => {
        const from =
          '"rationale": "#334 independent mechanical review of Glorious Heat';
        expect(text.split(from)).toHaveLength(2);
        return text.replace(
          from,
          '"rationale": "Edited. #334 independent mechanical review of Glorious Heat',
        );
      });
      type Records = { records: { externalKey: string; rationale: string }[] };
      const before = (JSON.parse(readFileSync(records, 'utf8')) as Records)
        .records;
      const after = (JSON.parse(change.text) as Records).records;
      const changed = after.flatMap((record, index) =>
        JSON.stringify(record) === JSON.stringify(before[index])
          ? []
          : [record],
      );
      expect(changed.map(({ externalKey }) => externalKey)).toEqual([
        unrelated,
      ]);
      expect(changed[0]?.rationale).toMatch(/^Edited\. #334 /);
      expect(after).toHaveLength(before.length);
      replaced.files.set(records, change.text);
      const { report, fresh } = await statusBesideFresh(
        checkedProjection({ [records]: change.sha256 }),
      );
      expect(fresh[row]).toBe('admitted');
      expect(reportCounts(report)).toEqual(counted(fresh));
    },
    slow,
  );

  it(
    'refuses scope drift with no status printed (stdout empty), its progress line already on stderr',
    async () => {
      const { error, printed, progress } = await status(checkedProjection(), {
        buildsBytes: `${builds}\n`,
      });
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(
        /^The committed party scope is not this checkout's \(the builds file changed\): run pnpm -s catalog:party-scope --write\.$/,
      );
      expect(printed).toBe('');
      expect(progress).toMatch(
        /^Importing the whole catalog at the pinned checkouts and running the admission gate on it/,
      );
    },
    slow,
  );

  it(
    'counts no admission with the list missing: it refuses the stale projection, naming the list',
    async () => {
      loseList();
      const { error, printed, progress } = await status(checkedProjection());
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(staleRefusal(listPath));
      expect(printed).toBe('');
      // Refused before the import, so before its progress line.
      expect(progress).toBe('');
    },
    slow,
  );

  it(
    'refuses the stale projection with the list missing and three earlier bound inputs changed, its error naming only the first three changed',
    async () => {
      const committed = JSON.parse(readFileSync(verificationPath, 'utf8')) as {
        binding: { inputs: Record<string, string> };
      };
      // Bound inputs that sort before the list, so the error's three named
      // paths are these and the list is the fourth, unnamed.
      const earlier = Object.keys(committed.binding.inputs)
        .filter((path) => path < listPath)
        .sort()
        .slice(0, 3);
      expect(earlier).toHaveLength(3);
      loseList();
      const { error, printed, progress } = await status(
        checkedProjection(
          Object.fromEntries(earlier.map((path) => [path, '0'.repeat(64)])),
        ),
      );
      expect(error).toBeInstanceOf(Error);
      const { message } = error as Error;
      expect(message).toMatch(
        staleRefusal(`4 bound inputs changed (${earlier.join(', ')}, …)`),
      );
      expect(message).not.toContain(listPath);
      expect(printed).toBe('');
      expect(progress).toBe('');
    },
    slow,
  );

  it(
    'refuses with no committed verification projection, as for a stale one',
    async () => {
      const { error, printed, progress } = await status(undefined);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(
        staleRefusal('no committed verification projection'),
      );
      expect(printed).toBe('');
      // Refused before the import, so before its progress line.
      expect(progress).toBe('');
    },
    slow,
  );

  it(
    'refuses after an unrelated bound input changed without regenerating, naming the input',
    async () => {
      const { error, printed } = await status(
        checkedProjection({ 'scripts/catalog/map.ts': '0'.repeat(64) }),
      );
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(
        staleRefusal('scripts/catalog/map.ts'),
      );
      expect(printed).toBe('');
    },
    slow,
  );
});
