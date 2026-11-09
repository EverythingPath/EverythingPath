import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { buildAssessmentBinding } from '../../scripts/catalog/admission';
import { importCatalog } from '../../scripts/catalog/import';
import { parseLaunchInventory } from '../../scripts/catalog/launch-inventory-document';
import type { LaunchManifest } from '../../scripts/catalog/launch-inventory-schema';
import { runCatalogReleaseOperator } from '../../scripts/catalog/release-operator';
import { readReleaseScope } from '../../scripts/catalog/release-scope';
import { reviewedAdmissionSchema } from '../../src/lib/catalog/admission-schema';
import {
  validateCatalogReleaseArtifact,
  type CatalogReleaseArtifact,
} from '../../src/lib/catalog/release-schema';
import { catalogRuntimeCompatibility } from '../../src/lib/catalog/runtime-compatibility';
import { materializePinnedTree } from './pinned-sources';
import {
  exploiter,
  magicalLineage,
  race,
  reducedManifest,
} from './release-scope-fixtures';

/**
 * #770 slice B: real campaign-mvp-v1 rows whose scoped release stages
 * through the real `catalogRelease` functions. Each is reached from a kept
 * root by committed edges, so a reduced manifest imports it, and the
 * unchanged gates (the real Section 15 Registry, committed curation and
 * notice holds) admit it or hold it without failing the release.
 *
 * The Wizard (CRB pp. 77-80) is admitted since the notice-hold clearance
 * (2026-10-30), and (S3) with it the three later Bonus Feats rows of its
 * reviewed schedule; its imported casting names its ability as stored
 * casting does, so it converts against its reviewed casting record.
 */
export const wizard = 'pf1/0c4lYDywj6bQ0i8r';
export const wizardFeatures = {
  arcaneSchool: 'pf1/20JWTam2dn7jjZFV',
  bonusFeats: 'pf1/2h3lI574tmVjOalQ',
  spellbooks: 'pf1/4wdsdOkgv4uEkS9K',
  scribeScroll: 'pf1/BS9WDbCy2Up3QHw9',
  cantrips: 'pf1/IPy4aqFYbOppaqKC',
  wizardSpells: 'pf1/LrjNAKP05lZq2tZZ',
  arcaneBond: 'pf1/pW1PNlDcdGl7KuEa',
};
/** S3: the Wizard table's later Bonus Feats rows (CRB pp. 77-80). */
export const wizardIncrements = [10, 15, 20].map(
  (level) => `everythingpath/wizard-bonus-feats-${level}`,
);
export const fireball = 'pf1/6oq1wcryviik9ice';
export const readMagic = 'pf1/j0bc0iii8zp1jiwr';
/** Bonus Feats (WIZ) depends on it, so dropping it fails the gate. */
export const spellMastery = 'pf1/KlE26ofz7uAkd0IJ';
export const scribeScrollFeat = 'pf1/tlRu8SYjzA7WCHN7';
export const craftMagicArms = 'pf1/4hNO4OAWYF5vXphH';
/** The UE Spellbook, held by its PZO1123 notice holds. */
export const spellbook = 'pf1/onurpjwtdogsedsg';
export const dwarfAbility = `local/race-ability-scores/${race.dwarf}`;
/** A requirement the Exploiter root grants; it grants Alertness, Scrying and the familiar's abilities. */
export const familiarAdvancement = 'rule/companions/familiar-advancement';
/** Alertness (CRB p. 117): no included definition depends on it. */
export const alertness = 'pf1/Q1cY8r0Pvb66pMG0';
export const scrying = 'pf1/g66w32kdup1f43bp';
/** Share Spells (CRB p. 83), a companionFeature resource. */
export const shareSpells = 'pf1/B4tsrPOAtyEOmwAr';

/** Release 1's rows: every definition kind the gates admit at HEAD. */
export const roundTripRows = [
  wizard,
  ...Object.values(wizardFeatures),
  ...wizardIncrements,
  fireball,
  readMagic,
  spellMastery,
  scribeScrollFeat,
  craftMagicArms,
  spellbook,
  race.dwarf,
  exploiter,
  familiarAdvancement,
  alertness,
  scrying,
];

/**
 * Real pinned bodies the gates hold at HEAD, so no scoped release can carry
 * them: Fighter (CRB pp. 55-57; its confirmed assessment leaves it
 * dependently omitted on Weapon Training and its 9/13/17 increments, held
 * on owner-owed evidence, #625), Magical Lineage (its APG, Ultimate Campaign and Second Darkness
 * notices are held), Seeking (UE notices held), Longsword (CRB p. 142; its
 * UE notices held), Unarmed Strike (reachable only through the Fighter; the
 * importer gives it a legacy weapon shape) and Ward (APG p. 67, the scope's one spellEffect
 * row, which imports as a class feature).
 */
export const fighter = 'pf1/WLqBCT5DqmGAx8Wd';
export const fighterFeatures = [
  'pf1/CV8BsY3ciUb9TA1Y',
  'pf1/h0Brxw6khcjlEf1T',
  'pf1/5JFfSqLMCpbRmERa',
  'pf1/RzEzudurxQFirFoF',
  'pf1/iqeyCQIIVnNt0p3h',
  // S3: Armor Mastery, which Foundry links to no class, is the 19th-level row.
  'pf1/NwTe1Q2utlsmOAqK',
  'pf1/McXAM1BoPHZLO1n4',
];
/**
 * S3: the Fighter table's 20 later rows (CRB p. 56), which the importer
 * emits with the Fighter from its reviewed schedule; with the seven features
 * they are its 27 rows.
 */
export const fighterIncrements = [
  ...[2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map(
    (level) => `everythingpath/fighter-bonus-feats-${level}`,
  ),
  ...[6, 10, 14, 18].map((level) => `everythingpath/fighter-bravery-${level}`),
  ...[7, 11, 15].map(
    (level) => `everythingpath/fighter-armor-training-${level}`,
  ),
  ...[9, 13, 17].map(
    (level) => `everythingpath/fighter-weapon-training-${level}`,
  ),
];
export const bravery = 'pf1/h0Brxw6khcjlEf1T';
export const seeking = 'pf1-content/1TO09L6Wa8VasAVe';
export const keen = 'pf1-content/cif1888zADQza8QS';
export const longsword = 'pf1/zWRlna42PMJVX6un';
export const unarmedStrike = 'pf1/1sU57tRb1My6XZMC';
export const ward = 'pf1/e6LhyzMnHZc5Vlni';
export { magicalLineage };

const committedUrl = new URL(
  '../../scripts/catalog/scopes/campaign-mvp-v1.json',
  import.meta.url,
);

/** The committed manifest; each parsed copy costs about 1 GB, so read it once. */
export async function readCommittedManifest() {
  return parseLaunchInventory(JSON.parse(await readFile(committedUrl, 'utf8')));
}

/** A row's file in the pinned store, from its committed source binding. */
function pinnedFileOf(manifest: LaunchManifest, key: string) {
  const source = manifest.rows
    .find((row) => row.key === key)
    ?.sources.find(({ repository }) => repository.startsWith('pf1'));
  if (!source) throw new Error(`No pinned source for ${key}.`);
  return `${source.repository}/${source.locator}`;
}

async function readCatalogInput(name: string): Promise<unknown> {
  return JSON.parse(
    await readFile(
      new URL(`../../scripts/catalog/${name}`, import.meta.url),
      'utf8',
    ),
  );
}

/** The importer as the operator runs it, with the committed remaps and curation. */
async function importScoped(
  tree: { systemPath: string; contentPath: string },
  scopeKeys: string[],
) {
  return importCatalog({
    ...tree,
    remaps: await readCatalogInput('reviewed-remaps.json'),
    curation: await readCatalogInput('reviewed-curation.json'),
    scopeKeys,
  });
}

/**
 * A reduced copy holding `rows` (and the dwarf's generated trait) with the
 * committed edges among them, citations included. It drifts from the
 * committed scope and its inventory is incomplete, so it never qualifies.
 */
export function roundTripManifest(committed: LaunchManifest, rows: string[]) {
  const kept = new Set(rows);
  return reducedManifest(committed, rows, {
    edges: committed.edges.filter(
      ({ from, to, kind }) =>
        kind === 'citation' && kept.has(from) && kept.has(to),
    ),
  });
}

/**
 * A test-only attribution confirming every candidate the release inputs
 * import for `manifest` (except the `held` keys, which it leaves unresolved),
 * bound with `buildAssessmentBinding` against the real Section 15 Registry,
 * so the unchanged admission gate and curation decide. Since the owner's
 * notice-hold clearance (2026-10-30) no notice hold keeps a candidate out.
 * Supplying it keeps the 93 MB reviewed evidence unloaded.
 */
async function testAttribution({
  tree,
  manifestPath,
  held,
}: {
  tree: { systemPath: string; contentPath: string };
  manifestPath: string;
  held: Readonly<Record<string, string>>;
}) {
  const scope = await readReleaseScope({
    version: 'campaign-mvp-v1',
    manifestPath,
  });
  const artifact = await importScoped(tree, scope.importKeys);
  const registry = reviewedAdmissionSchema.shape.registry.parse(
    JSON.parse(
      await readFile(
        new URL(
          '../../src/lib/catalog/data/section15-registry.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ),
  );
  const evidence = {
    'slice-b': {
      content:
        'Test-only whole-content comparison (#770 slice B); not a reviewed assessment.',
    },
  };
  const assessments = [
    ...artifact.catalog.entries,
    ...artifact.catalog.resources,
  ]
    .filter((entry) => !entry.attributionFrom)
    .map((entry) => {
      const requiredNotices = [
        ...new Set(entry.sources.map(({ book }) => book)),
      ].sort();
      const heldReason = held[entry.externalKey];
      return {
        externalKey: entry.externalKey,
        status: heldReason ? ('unresolved' as const) : ('confirmed' as const),
        ...buildAssessmentBinding({
          entry,
          artifact,
          evidence,
          registry,
          requiredNotices,
          evidenceIds: ['slice-b'],
        }),
        requiredNotices,
        rationale: heldReason ?? 'Test-only confirmation (#770 slice B).',
        reviewedBy: 'Test fixture',
        reviewedOn: '2026-10-29',
      };
    });
  return { assessments, evidence, registry };
}

/**
 * The scope report sidecar as these tests read it: every field the operator
 * wrote is kept, so it still compares equal to the staged `content:scope`
 * rows.
 */
const scopeReportSchema = z.looseObject({
  binding: z.looseObject({ version: z.string() }),
  qualification: z.looseObject({
    status: z.enum(['QUALIFIED', 'FAILED']),
    findings: z.array(z.looseObject({ code: z.string(), key: z.string() })),
    counts: z.looseObject({ required: z.number(), included: z.number() }),
  }),
  rows: z.array(
    z.looseObject({
      key: z.string(),
      outcome: z.enum(['included', 'held', 'dependent-omitted', 'outside-mvp']),
    }),
  ),
  release: z.looseObject({
    artifactFingerprint: z.string().optional(),
    refused: z.string().optional(),
  }),
});

export type ScopedBuild = {
  artifactPath: string;
  /** The operator's refusal; a scoped build always refuses unless QUALIFIED. */
  message: string;
  report: z.infer<typeof scopeReportSchema>;
  artifact?: CatalogReleaseArtifact;
};

/**
 * Builds scoped releases of reduced manifests with the operator's
 * `build --scope campaign-mvp-v1 --scope-manifest … --attribution …` over
 * one pinned tree holding every row's file. The test attribution covers the
 * widest set, `rows`, so every release shares it, and holds each `held` key
 * with an unresolved test-only assessment giving its reason. Write every
 * manifest before releasing the committed copy.
 */
export async function createScopedReleaseBuilder({
  committed,
  rows,
  held = {},
}: {
  committed: LaunchManifest;
  rows: string[];
  held?: Readonly<Record<string, string>>;
}) {
  const root = await mkdtemp(join(tmpdir(), 'release-scope-round-trip-'));
  const widest = roundTripManifest(committed, rows);
  const tree = await materializePinnedTree([
    ...new Set(
      widest.rows
        .filter(({ key }) => /^(?:pf1|pf1-content)\//.test(key))
        .map(({ key }) => pinnedFileOf(committed, key)),
    ),
  ]);
  async function writeManifest(name: string, manifest: LaunchManifest) {
    const path = join(root, 'manifests', `${name}.json`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(manifest));
    return path;
  }
  const attribution = join(root, 'attribution.json');
  try {
    await writeFile(
      attribution,
      JSON.stringify(
        await testAttribution({
          tree,
          manifestPath: await writeManifest('widest', widest),
          held,
        }),
      ),
    );
  } catch (error) {
    await tree.dispose();
    await rm(root, { recursive: true, force: true });
    throw error;
  }

  async function build({
    name,
    manifestPath,
    number = 1,
    previous,
  }: {
    name: string;
    manifestPath: string;
    number?: number;
    previous?: string;
  }): Promise<ScopedBuild> {
    const artifactPath = join(root, name, 'release.json');
    const message = await runCatalogReleaseOperator({
      args: [
        'build',
        '--number',
        String(number),
        '--schema',
        catalogRuntimeCompatibility.schema,
        '--calculation',
        catalogRuntimeCompatibility.calculation,
        '--system',
        tree.systemPath,
        '--content',
        tree.contentPath,
        '--artifact',
        artifactPath,
        '--allow-unverified-checkouts',
        '--attribution',
        attribution,
        '--scope',
        'campaign-mvp-v1',
        '--scope-manifest',
        manifestPath,
        ...(previous ? ['--previous', previous] : []),
      ],
    }).then(
      () => '',
      (error: unknown) =>
        error instanceof Error ? error.message : String(error),
    );
    const report = scopeReportSchema.parse(
      JSON.parse(
        await readFile(artifactPath.replace(/\.json$/, '.scope.json'), 'utf8'),
      ),
    );
    const text = await readFile(artifactPath, 'utf8').catch(() => undefined);
    return {
      artifactPath,
      message,
      report,
      ...(text && {
        artifact: await validateCatalogReleaseArtifact(JSON.parse(text)),
      }),
    };
  }

  return {
    /** Writes a reduced manifest of `keep`. */
    manifest: (name: string, keep: string[]) =>
      writeManifest(name, roundTripManifest(committed, keep)),
    build,
    async dispose() {
      await tree.dispose();
      await rm(root, { recursive: true, force: true });
    },
  };
}

/**
 * The importer's bodies for real pinned rows, imported together with no
 * admission: the conversion seam for kinds the gates hold at HEAD.
 */
export async function importPinnedBodies(
  committed: LaunchManifest,
  keys: string[],
) {
  const tree = await materializePinnedTree(
    keys.map((key) => pinnedFileOf(committed, key)),
  );
  try {
    return (await importScoped(tree, keys)).catalog.entries;
  } finally {
    await tree.dispose();
  }
}
