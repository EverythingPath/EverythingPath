// archetype-cavalier-1 (#716; docs/catalog-import/archetype-structures-667.md):
// the structure records of four mechanical Cavalier archetypes (#667) of
// Ultimate Combat and Occult Adventures, written drafted; the record step
// checked all fourteen on a captured review, and then Beast Rider's two and
// the Musketeer's three left the tree: a proficiency or a granted feat the
// sheet tracks makes their description alone untrue, so those two archetypes
// are left out whole and keep their state, and their records wait outside the
// repository for the slice that binds those grants (fix r2: a record kept
// here drafted could get its old approval back without a new review). One table
// holds the batch: each archetype's PCGen file, book and reviewed
// replacements, and each owned feature's level; a landed feature also has its
// source hash and PRD paragraphs, a held one only its key and locator, so
// nothing here rebuilds a held record (fix r3). No root has a review item, so every record is a feature's
// description. Ghost Rider replaces Master Tactician, which is held under
// #227, so its root stays omitted behind that row once its features pass. The
// nine other candidates are left out (the report says why) and keep their
// state. Every case runs on the pinned tree.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import { importCatalog } from '../../scripts/catalog/import';
import { pcgenPin } from '../../scripts/catalog/inventory';
import { pcgenOwnerSelection } from '../../scripts/catalog/pcgen-owners';
import { parseReviewReceipts } from '../../scripts/catalog/review-receipts';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import type { StructureRecord } from '../../scripts/catalog/structure-curation';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import {
  ownerEmissionFoundryFiles,
  pcgenOwnerEmissionFiles,
} from '../fixtures/pcgen-716/owner-emission-files';
import {
  materializePinnedTree,
  pinnedPath,
  readPinned,
} from './pinned-sources';

const UC = 'roleplaying_game/ultimate_combat/uc_abilities_class.lst';
const OA = 'roleplaying_game/occult_adventures/oa_abilities_class.lst';
const ISC = 'campaign_setting/inner_sea_combat/isc_abilities_class.lst';
const ANAR = 'player_companion/animal_archive/anar_abilities_class.lst';
const KOTIS =
  'player_companion/knights_of_the_inner_sea/kotis_abilities_class.lst';
const LOD = 'player_companion/legacy_of_dragons/lod_abilities_class.lst';
const UI = 'roleplaying_game/ultimate_intrigue/ui_abilities_class.lst';
const ucPage = 'pages/ultimateCombat/classArchetypes/cavalier.html';
const oaPage = 'pages/occultAdventures/archetypes/other.html';
/** The record step's receipt: the captured review that checked the fourteen records. */
const RECEIPT =
  't3-review-7f52cf6d659a198a038d487c75abb7d61834f27a4808d3e8437c42e9803d1a4c';

/** The Cavalier's rows the four archetypes replace (Foundry ids). */
const cavalier = {
  mount: 'P2XyBCDEUGOFwRAF',
  tactician: 'YKyAQ2o5Yzox79B8',
  cavaliersCharge: 'QGv2YjclwgkruFE6',
  expertTrainer: 'nBpz562qzAntafUI',
  banner: 'pqu1Mvo46iRpVH3I',
  greaterTactician: 'ikVwT8b9zfj701k1',
  mightyCharge: 'fo3SQLOjFcQSmVMJ',
  greaterBanner: '1Yy6Fn3UD82uviFg',
  masterTactician: 'mrJ61WiA6PuZgPTJ',
  supremeCharge: 'pZaZcT8gMPQGX9Ur',
} as const;
type CavalierRow = keyof typeof cavalier;
const row = (name: CavalierRow) => `pf1/${cavalier[name]}`;

/**
 * The Cavalier class and the rows above with every pinned Foundry record they
 * link (`Compendium.pf1.<pack>.…<id>`), transitively. Without them the class
 * and those rows fail on unresolved references and the archetypes are omitted
 * behind them.
 */
async function cavalierClosure() {
  const packs = pinnedPath('pf1', 'packs');
  const byId = new Map<string, string>();
  for (const pack of await readdir(packs))
    for (const file of await readdir(join(packs, pack)).catch(() => []))
      byId.set(file.split('.').at(-2) ?? '', `packs/${pack}/${file}`);
  const files = new Set<string>();
  const queue: string[] = ['u1ed3H9xtYQXTP5v', ...Object.values(cavalier)];
  for (let id = queue.pop(); id; id = queue.pop()) {
    const path = byId.get(id);
    if (!path || files.has(path)) continue;
    files.add(path);
    const text = await readPinned('pf1', path);
    for (const [, linked] of text.matchAll(
      /Compendium\.pf1\.[a-z-]+\.(?:Item\.)?([A-Za-z0-9]{16})/g,
    ))
      if (linked) queue.push(linked);
  }
  return [...files].map((path) => `pf1/${path}`);
}

const pcgenFiles = [
  ...pcgenOwnerEmissionFiles,
  'roleplaying_game/ultimate_combat/_ultimate_combat.pcc',
  UC,
  'roleplaying_game/occult_adventures/_occult_adventures.pcc',
  OA,
  'campaign_setting/inner_sea_combat/_inner_sea_combat.pcc',
  ISC,
  'player_companion/knights_of_the_inner_sea/_knights_of_the_inner_sea.pcc',
  KOTIS,
  'player_companion/legacy_of_dragons/_legacy_of_dragons.pcc',
  LOD,
  'roleplaying_game/ultimate_intrigue/_ultimate_intrigue.pcc',
  UI,
];
const tree = await materializePinnedTree([
  ...new Set([...ownerEmissionFoundryFiles, ...(await cavalierClosure())]),
  ...[...new Set(pcgenFiles)].map(
    (path) => `pcgen/${pcgenPin.directory}/${path}`,
  ),
]);
afterAll(() => tree.dispose());

const { receipts } = parseReviewReceipts(
  JSON.parse(await readFile('scripts/catalog/review-receipts.json', 'utf8')),
);
const remaps: unknown = JSON.parse(
  await readFile('scripts/catalog/reviewed-remaps.json', 'utf8'),
);

/** A feature's slug, PCGen name and level: what its key, locator and level read. */
type FeatureRow = readonly [
  slug: string,
  /** The feature's name in its PCGen KEY (`<archetype> ~ <name>`). */
  pcgenName: string,
  classLevel: number,
  ...record: readonly unknown[],
];
/** A held feature: no record, so no source hash and no PRD paragraphs. */
type HeldFeature = readonly [
  slug: string,
  pcgenName: string,
  classLevel: number,
];
/** A landed feature, with what its record gives. */
type Feature = readonly [
  ...HeldFeature,
  sourceSha256: string,
  /** The feature's paragraphs on the archetype's PRD page. */
  prdLines: readonly number[],
];
type ArchetypeRow = {
  /** PCGen's name: the record is `Cavalier Archetype ~ <name>`, a feature `<name> ~ <feature>`. */
  name: string;
  slug: string;
  file: string;
  book: string;
  /** The rows the archetype's own text replaces, whole, in the mapper's order. */
  replaces: readonly (readonly [CavalierRow, number])[];
  /** A replaced row held under #227, which keeps the root omitted once its features pass. */
  rootOmittedBehind?: CavalierRow;
};
type LandedArchetype = ArchetypeRow & {
  held?: undefined;
  page: string;
  features: readonly Feature[];
};
type HeldArchetype = ArchetypeRow & {
  /**
   * Why the archetype is left out whole (the 2026-11-18 description-only
   * bar): its records are not in the tree, and its rows keep their state.
   */
  held: string;
  features: readonly HeldFeature[];
};
type Archetype = LandedArchetype | HeldArchetype;
const lines = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

/** The batch, as the boundary and report give it (archetype-structures-667.md). */
const batch: readonly Archetype[] = [
  {
    name: 'Beast Rider',
    slug: 'beast-rider',
    file: UC,
    book: 'PZO1118',
    held: 'Armor Proficiency removes heavy armor proficiency, which the sheet tracks',
    replaces: [
      ['mount', 1],
      ['expertTrainer', 4],
    ],
    features: [
      ['armor-proficiency', 'Armor Proficiency', 1],
      ['exotic-mount', 'Exotic Mount', 1],
    ],
  },
  {
    name: 'Musketeer',
    slug: 'musketeer',
    file: UC,
    book: 'PZO1118',
    held: 'its proficiency change and two granted feats are tracked by the sheet',
    replaces: [
      ['mount', 1],
      ['expertTrainer', 4],
    ],
    features: [
      ['weapon-and-armor-proficiency', 'Weapon And Armor Proficiency', 1],
      ['gifted-firearm', 'Gifted Firearm', 1],
      ['swift-powder', 'Swift Powder', 4],
    ],
  },
  {
    name: 'Standard Bearer',
    slug: 'standard-bearer',
    file: UC,
    book: 'PZO1118',
    page: ucPage,
    replaces: [
      ['mount', 1],
      ['banner', 5],
      ['mightyCharge', 11],
      ['supremeCharge', 20],
    ],
    features: [
      [
        'banner',
        'Banner',
        1,
        'f2c7bad761b7b68f2aeb974462bf0ffde4538c10fcf314e89c3b7fc703dbc990',
        [431],
      ],
      [
        'mount',
        'Mount',
        5,
        '96067b99bdffe7e3e8ea1d67bedbbf93d4361b02a83adecbf5c356bca0671457',
        [432],
      ],
      [
        'banner-of-solace',
        'Banner Of Solace',
        11,
        '65a3e4745a3d5cdac787a42b4c6ecfe988dd640b0dd85a92d574ee2f1d825829',
        [433],
      ],
      [
        'awesome-pennon',
        'Awesome Pennon',
        20,
        'ecc04bbfaaa61a57261170933f2dd4d92f22c285f98ee31d321c1b86d0dad31c',
        [434],
      ],
    ],
  },
  {
    name: 'Ghost Rider',
    slug: 'ghost-rider',
    file: OA,
    book: 'PZO1132',
    page: oaPage,
    replaces: [
      ['expertTrainer', 4],
      ['banner', 5],
      ['mightyCharge', 11],
      ['greaterBanner', 14],
      ['cavaliersCharge', 3],
      ['tactician', 1],
      ['greaterTactician', 9],
      ['masterTactician', 17],
      ['mount', 1],
    ],
    rootOmittedBehind: 'masterTactician',
    features: [
      [
        'ghost-mount',
        'Ghost Mount',
        1,
        '8dc9b7f99fb597eeec11e332782d7bf40c231879a6e054aebc0bb3a8b047743b',
        lines(470, 474),
      ],
      [
        'frightful-gaze',
        'Frightful Gaze',
        1,
        '2d562125163da6543318e01fbb921dcc9621a29017d6e5666823222c1053a7b9',
        [475, 476],
      ],
      [
        'fearless',
        'Fearless',
        3,
        'ce6432460ee679059a110de3dbfd452a2137b4a47dd325bd233fc0e5a4f22fa3',
        [477],
      ],
      [
        'spirited-mount',
        'Spirited Mount',
        5,
        'f6daa745c07d439b05d20ccb5226abcd06ec784fab31c17136cd1af14ee5c30d',
        [478],
      ],
      [
        'ghost-wind',
        'Ghost Wind',
        11,
        '5545cdb9ab911a872ebbcbfb1b7beb4a5b1d4f1dcd06de4cb06fabeb3fae04c4',
        [479],
      ],
    ],
  },
];
/** The nine candidates left out, which keep their state. */
const leftOutSelectors = [
  [ISC, 'Spellscar Drifter', 'spellscar-drifter'],
  [ISC, 'Wave Rider', 'wave-rider'],
  [ANAR, 'Huntmaster', 'huntmaster'],
  [KOTIS, 'Herald Squire', 'herald-squire'],
  [LOD, 'Drakerider', 'drakerider'],
  [UC, 'Emissary', 'emissary'],
  [UC, 'Gendarme', 'gendarme'],
  [UC, 'Honor Guard', 'honor-guard'],
  [UI, 'Daring General', 'daring-general'],
] as const;
const leftOut = leftOutSelectors.map(
  ([, , slug]) => `everythingpath/cavalier-${slug}`,
);

const rootKey = ({ slug }: Archetype) => `everythingpath/cavalier-${slug}`;
const featureKey = (archetype: Archetype, [slug]: FeatureRow) =>
  `${rootKey(archetype)}-${slug}`;
const locator = ({ file, name }: Archetype, [, pcgenName]: FeatureRow) =>
  `pcgen:${file}#${name} ~ ${pcgenName}`;
const batchRows = batch.flatMap((archetype) => [
  { key: rootKey(archetype), book: archetype.book, held: archetype.held },
  ...archetype.features.map((feature) => ({
    key: featureKey(archetype, feature),
    book: archetype.book,
    held: archetype.held,
  })),
]);
const batchKeys = new Set(batchRows.map(({ key }) => key));
/** The held archetypes' features, which have no record in the tree. */
const heldFeatures = batch.flatMap((archetype) =>
  archetype.held
    ? archetype.features.map((feature) => featureKey(archetype, feature))
    : [],
);
const omittedRoots = new Map(
  batch.flatMap((archetype) =>
    archetype.rootOmittedBehind
      ? [[rootKey(archetype), row(archetype.rootOmittedBehind)] as const]
      : [],
  ),
);

const ENTITIES: Record<string, string> = { mdash: '—', ndash: '–', amp: '&' };
/** A PRD feature's paragraphs as plain text: heading dropped, markup and entities read, spaces collapsed, joined by a space. */
async function prdText(page: string, prdLines: readonly number[]) {
  const text = (await readPinned('prd', page)).split('\n');
  return prdLines
    .map((line, index) => {
      let html = (text[line - 1] ?? '')
        .trim()
        .replace(/^<p[^>]*>/, '')
        .replace(/<\/p>$/, '');
      if (index === 0) html = html.replace(/^<b>.*?<\/b>\s*:?\s*/, '');
      return html
        .replace(/<[^>]+>/g, '')
        .replace(/&(\w+);/g, (match, name: string) => {
          const entity = ENTITIES[name];
          if (entity === undefined) throw new Error(`Unread entity ${match}`);
          return entity;
        })
        .replace(/\s+/g, ' ')
        .trim();
    })
    .join(' ');
}

const without = {
  ...reviewedCuration,
  structures: (reviewedCuration.structures ?? []).filter(
    ({ externalKey }) => !batchKeys.has(externalKey),
  ),
};
const withStructures = (structures: readonly StructureRecord[]) => ({
  ...without,
  structures: [...without.structures, ...structures],
});
const committed = (reviewedCuration.structures ?? [])
  .filter(({ externalKey }) => batchKeys.has(externalKey))
  .sort((a, b) => (a.externalKey < b.externalKey ? -1 : 1));
/**
 * The committed records, drafted in memory: each becomes a copy without its
 * reviewer, date and receipt, as the batch wrote it.
 */
const draftedInMemory = committed.map(
  (record): StructureRecord => ({
    externalKey: record.externalKey,
    sourceSha256: record.sourceSha256,
    fields: record.fields,
    resolves: record.resolves,
    rationale: record.rationale,
    status: 'drafted',
  }),
);
/**
 * The committed records checked in memory on a placeholder review, whatever
 * their committed state (the record step's part).
 */
const checkedInMemory = draftedInMemory.map(
  (record): StructureRecord => ({
    ...record,
    status: 'checked',
    reviewedBy: 'in-memory check (archetype-structures-667.test.ts)',
    reviewedOn: '2026-11-18',
    receipt: `t3-review-${'0'.repeat(64)}`,
  }),
);

const selected = new Set(
  [
    ...batch.map(({ file, name }) => [file, name] as const),
    ...leftOutSelectors.map(([file, name]) => [file, name] as const),
  ].map(([file, name]) => `${file}#Cavalier Archetype ~ ${name}`),
);
const selection = pcgenOwnerSelection.filter(
  (owner) =>
    owner.kind === 'archetype' && selected.has(`${owner.file}#${owner.key}`),
);
type Artifact = Awaited<ReturnType<typeof importCatalog>>;
const emit = (curation: unknown) =>
  importCatalog({
    systemPath: tree.systemPath,
    contentPath: tree.contentPath,
    remaps,
    curation,
    pcgen: { path: tree.pcgenPath, selection },
    wholeCorpus: false,
  });
/** Every emitted key's admission outcome. */
const outcomes = (artifact: Artifact) => {
  const gate = assessCatalogAdmission({ artifact, ...reviewedAdmission });
  const all = new Map<string, { kind: string; reason: string }>();
  for (const kind of [
    'admitted',
    'held',
    'dependentOmissions',
    'failures',
  ] as const)
    for (const { externalKey, reason } of gate[kind])
      if (externalKey) all.set(externalKey, { kind, reason });
  return all;
};
const entryOf = (artifact: Artifact, key: string) =>
  artifact.catalog.entries.find((item) => item.externalKey === key);
const ours = <T extends { externalKey: string }>(items: readonly T[]) =>
  items.filter(({ externalKey }) => batchKeys.has(externalKey));

const base = await emit(without);
const asCommitted = await emit(reviewedCuration);
const drafted = await emit(withStructures(draftedInMemory));
const checked = await emit(withStructures(checkedInMemory));
const baseOutcomes = outcomes(base);

/** The landed archetypes: Standard Bearer and Ghost Rider. */
const landed = batch.filter(
  (archetype): archetype is LandedArchetype => archetype.held === undefined,
);
/** The nine records the table gives, rationale aside; a held feature has none. */
const expected = (
  await Promise.all(
    landed.flatMap((archetype) =>
      archetype.features.map(async (feature) => ({
        externalKey: featureKey(archetype, feature),
        sourceSha256: feature[3],
        fields: { description: await prdText(archetype.page, feature[4]) },
        resolves: [{ kind: 'ownedFeature', id: locator(archetype, feature) }],
      })),
    ),
  )
).sort((a, b) => (a.externalKey < b.externalKey ? -1 : 1));

/** The batch's keys held for structure review: the held archetypes' features, which have no record. */
const heldOnStructure = [...heldFeatures].sort();
const landedKeys = expected.map(({ externalKey }) => externalKey);

/**
 * With the nine records checked: they settle their gates and apply, and 10 rows
 * are admitted under #227 on their declared books, Ghost Rider's root omitted
 * behind the held Master Tactician; Beast Rider's and the Musketeer's rows keep
 * their state; no other key changes.
 */
function expectNineLanded(artifact: Artifact) {
  const report = artifact.structure;
  if (!report) throw new Error('No structure report');
  expect({
    handReview: ours(report.handReview),
    unreviewedFeatures: ours(report.unreviewedFeatures)
      .map(({ externalKey }) => externalKey)
      .sort(),
    invalid: report.invalid,
    conflicts: ours(report.conflicts),
    stale: ours(report.stale),
    held: report.held.filter((key) => batchKeys.has(key)).sort(),
  }).toEqual({
    handReview: [],
    unreviewedFeatures: heldOnStructure,
    invalid: [],
    conflicts: [],
    stale: [],
    held: heldOnStructure,
  });
  expect(
    ours(report.applied)
      .map(({ externalKey }) => externalKey)
      .sort(),
  ).toEqual(landedKeys);
  const after = outcomes(artifact);
  let admitted = 0;
  for (const { key, book, held } of batchRows) {
    const behind = omittedRoots.get(key);
    if (held) expect(after.get(key), key).toEqual(baseOutcomes.get(key));
    else if (behind)
      expect(after.get(key), key).toEqual({
        kind: 'dependentOmissions',
        reason: `Dependent omission: ${behind}.`,
      });
    else {
      admitted += 1;
      expect(after.get(key), key).toEqual({
        kind: 'admitted',
        reason: `Admitted under #227: declared book ${book}.`,
      });
    }
  }
  expect(admitted).toBe(10);
  for (const behind of omittedRoots.values())
    expect(after.get(behind)?.kind, behind).toBe('held');
  for (const [key, outcome] of baseOutcomes)
    if (!batchKeys.has(key)) expect(after.get(key), key).toEqual(outcome);
  expect([...after.keys()].sort()).toEqual([...baseOutcomes.keys()].sort());
  for (const record of expected)
    expect(
      entryOf(artifact, record.externalKey),
      record.externalKey,
    ).toMatchObject({
      ...record.fields,
      detail: { kind: 'classFeature' },
      // No record gives a number on the sheet.
      modifiers: [],
    });
}

describe('the structure records of four mechanical Cavalier archetypes (archetype-cavalier-1, #716)', () => {
  // Status-dependent: it reads the records' committed state, the nine checked
  // on the record step's receipt and none of Beast Rider's or the Musketeer's.
  it('are committed with exactly the reviewed descriptions, items and source hashes: Standard Bearer’s four and Ghost Rider’s five checked by the record step; Beast Rider and the Musketeer have none, nor do the nine left out', () => {
    expect(batchRows).toHaveLength(18);
    expect(heldFeatures).toHaveLength(5);
    expect(expected).toHaveLength(9);
    expect(
      committed.map((record) => ({
        externalKey: record.externalKey,
        sourceSha256: record.sourceSha256,
        fields: record.fields,
        resolves: record.resolves,
        status: record.status === 'checked' ? record.receipt : record.status,
        noMechanics: record.noMechanics,
      })),
    ).toEqual(
      expected.map((record) => ({
        ...record,
        status: RECEIPT,
        noMechanics: undefined,
      })),
    );
    expect(
      (reviewedCuration.structures ?? []).filter(({ externalKey }) =>
        [...leftOut, ...batch.filter(({ held }) => held).map(rootKey)].some(
          (key) => externalKey.startsWith(key),
        ),
      ),
    ).toEqual([]);
  });

  // Status-dependent: it reads the committed receipts. The orchestrator
  // removed the five held records from this run's covers (fix r4), so a
  // rebuilt copy of one cannot reuse the old approval.
  it('the record step’s receipt covers exactly the nine landed records, and no receipt covers a held one', () => {
    const entry = receipts.find(({ runId }) => runId === RECEIPT);
    expect(entry?.covers.map(({ id, sources }) => ({ id, sources }))).toEqual(
      expected.map(({ externalKey, sourceSha256 }) => ({
        id: `structure ${externalKey} [description] sha256:${sourceSha256}`,
        sources: [{ subject: externalKey, sourceSha256 }],
      })),
    );
    const held = new Set(heldFeatures);
    expect(
      receipts.flatMap(({ runId, covers }) =>
        covers
          .filter(
            ({ id, sources }) =>
              sources.some(({ subject }) => held.has(subject)) ||
              heldFeatures.some((key) => id.includes(` ${key} `)),
          )
          .map(({ id }) => `${runId}: ${id}`),
      ),
    ).toEqual([]);
  });

  // Status-dependent: it reads the records' committed state.
  it('as committed, the nine checked records settle their gates and apply, and 10 rows are admitted under #227 on their declared books, Ghost Rider’s root omitted behind the held Master Tactician; Beast Rider’s and the Musketeer’s rows keep their state; no other key changes', () => {
    expectNineLanded(asCommitted);
  });

  // Reads the nine committed records, whatever their status, and drafts them in
  // memory, as the batch wrote them.
  it('drafted in memory, change no key: every feature stays held on structure and every root omitted behind its features', () => {
    expect(draftedInMemory).toHaveLength(9);
    expect(outcomes(drafted)).toEqual(baseOutcomes);
    expect(ours(drafted.structure?.applied ?? [])).toEqual([]);
    for (const archetype of batch) {
      for (const feature of archetype.features)
        expect(baseOutcomes.get(featureKey(archetype, feature))).toEqual({
          kind: 'held',
          reason: `Structure hand review (#716 plan §6): owned feature ${locator(archetype, feature)}.`,
        });
      expect(baseOutcomes.get(rootKey(archetype))?.kind, archetype.name).toBe(
        'dependentOmissions',
      );
    }
    for (const key of leftOut)
      expect(baseOutcomes.get(key)?.kind, key).not.toBe('admitted');
  });

  // Reads the nine committed records, whatever their status, and checks them in
  // memory.
  it('checked in memory, the nine settle every gate and apply, and admit the same 10 rows, Ghost Rider’s root omitted behind the held Master Tactician; Beast Rider’s and the Musketeer’s rows keep their state; no other key changes', () => {
    expect(checkedInMemory).toHaveLength(9);
    expectNineLanded(checked);
  });

  it('checked in memory, replace exactly the rows each archetype’s own text names, whole, and add its features at their levels', () => {
    for (const archetype of batch) {
      const detail = entryOf(checked, rootKey(archetype))?.detail;
      if (detail?.kind !== 'archetype') throw new Error(`No ${archetype.name}`);
      expect(
        {
          replaces: detail.replaces,
          featureChanges: detail.featureChanges,
          adds: detail.adds,
        },
        archetype.name,
      ).toEqual({
        replaces: archetype.replaces.map(([name, classLevel]) => ({
          externalKey: row(name),
          classLevel,
          scope: 'whole',
        })),
        featureChanges: archetype.replaces.map(([name]) => ({
          externalKey: row(name),
          scope: 'whole',
        })),
        adds: archetype.features.map((feature) => ({
          externalKey: featureKey(archetype, feature),
          classLevel: feature[2],
        })),
      });
    }
  });
});
