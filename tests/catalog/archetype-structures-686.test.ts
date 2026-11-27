// @vitest-environment node
// archetype-ranger-1 (#716; docs/catalog-import/archetype-structures-686.md):
// the structure records of four mechanical Ranger archetypes (#686) of the
// Advanced Player's Guide and Ultimate Combat. Twelve are checked by the record
// step on review t3-review-51dd0f93…, and the two Terrain Bonds on review
// t3-review-5801a4c1… once the companion calculation stopped counting a
// Ranger Class Level whose Hunter's Bond an Archetype replaces
// (companion-entitlement-replaced, terrain-bond-repromote); Spirit Bond stays
// drafted (root's decision, 2026-11-22): its extra Ranger castings are not in
// the spells per day. One table holds the batch: each
// archetype's PCGen file, book and reviewed replacements, the review items its
// root record settles (Guide and Warden only), and each owned feature's level,
// source hash, the pinned PRD paragraphs its description is and, when it stays
// drafted, why. Every record is description only or, on a root, the mapper's
// `detail.replaces` re-affirmed; none binds a number. The eight other
// candidates are left out (the report says why) and keep their state. An
// archetype's root depends on the features it adds and the rows it replaces,
// so the Spirit Ranger's root waits on its drafted Spirit Bond, and the
// Warden's on Combat Style Feat, which is omitted behind a combat style held
// on PZO9488's notice. Every case runs
// on the pinned tree.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import { importCatalog } from '../../scripts/catalog/import';
import { pcgenPin } from '../../scripts/catalog/inventory';
import { pcgenOwnerSelection } from '../../scripts/catalog/pcgen-owners';
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

const APG = 'roleplaying_game/advanced_players_guide/apg_abilities_class.lst';
const UC = 'roleplaying_game/ultimate_combat/uc_abilities_class.lst';
const ACG = 'roleplaying_game/advanced_class_guide/acg_abilities_class.lst';
const ARG = 'roleplaying_game/advanced_race_guide/arg_abilities_class.lst';
const LOD = 'player_companion/legacy_of_dragons/lod_abilities_class.lst';
const DH = 'player_companion/dungeoneers_handbook/dh_abilities_class.lst';
const RTT = 'player_companion/ranged_tactics_toolbox/rtt_abilities_class.lst';
const DEP = 'player_companion/dragon_empires_primer/dep_abilities_class.lst';
const apgPage = 'pages/advancedPlayersGuide/coreClasses/ranger.html';
const ucPage = 'pages/ultimateCombat/classArchetypes/ranger.html';

const RANGER = 'pf1/w3wjj6s3N69BsMc3';
/** The Ranger's rows the four archetypes replace (Foundry ids). */
const ranger = {
  favoredEnemy: 'XmALhWqXdN9yOmtd',
  combatStyleFeat: 'BO7BEFHDcf6qBaYV',
  favoredTerrain: 'U2YBSx1s8cT8iDq1',
  huntersBond: 'Bs5i98ja24ODe9WL',
  evasion: 'KQYCRLEdD4bGA5ak',
  quarry: '5NS7Ec3WhKIkhygg',
  camouflage: 'E90iE6Ynyq1cgGXA',
  improvedEvasion: 'Cc2eFfhJYlClCGEH',
  improvedQuarry: 'oRac7XDHBN0JzuyY',
  masterHunter: 'GAHaeOGTBeR6LJ3K',
} as const;
type RangerRow = keyof typeof ranger;
const row = (name: RangerRow) => `pf1/${ranger[name]}`;

/**
 * The Ranger class and the rows above with every pinned Foundry record they
 * link (`Compendium.pf1.<pack>.…<id>`), transitively, as far as the pinned
 * store holds them.
 */
async function rangerClosure() {
  const packs = pinnedPath('pf1', 'packs');
  const byId = new Map<string, string>();
  for (const pack of await readdir(packs))
    for (const file of await readdir(join(packs, pack)).catch(() => []))
      byId.set(file.split('.').at(-2) ?? '', `packs/${pack}/${file}`);
  const files = new Set<string>();
  const queue: string[] = [RANGER.slice(4), ...Object.values(ranger)];
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
  'roleplaying_game/advanced_players_guide/advanced_players_guide.pcc',
  APG,
  'roleplaying_game/ultimate_combat/_ultimate_combat.pcc',
  UC,
  'roleplaying_game/advanced_class_guide/_advanced_class_guide.pcc',
  ACG,
  'roleplaying_game/advanced_race_guide/advanced_race_guide.pcc',
  ARG,
  'player_companion/legacy_of_dragons/_legacy_of_dragons.pcc',
  LOD,
  'player_companion/dungeoneers_handbook/_dungeoneers_handbook.pcc',
  DH,
  'player_companion/ranged_tactics_toolbox/_ranged_tactics_toolbox.pcc',
  RTT,
  'player_companion/dragon_empires_primer/_dragon_empires_primer.pcc',
  DEP,
];
const tree = await materializePinnedTree([
  ...new Set([...ownerEmissionFoundryFiles, ...(await rangerClosure())]),
  ...[...new Set(pcgenFiles)].map(
    (path) => `pcgen/${pcgenPin.directory}/${path}`,
  ),
]);
afterAll(() => tree.dispose());

const remaps: unknown = JSON.parse(
  await readFile('scripts/catalog/reviewed-remaps.json', 'utf8'),
);

type Feature = readonly [
  slug: string,
  /** The feature's name in its PCGen KEY (`<archetype> ~ <name>`), spelling as PCGen has it. */
  pcgenName: string,
  classLevel: number,
  sourceSha256: string,
  /** The PRD paragraphs (pinned page lines) its description is. */
  lines: readonly number[],
  /** Set when the record stays drafted: why the review did not confirm it. */
  drafted?: string,
];
type Archetype = {
  /** PCGen's name: the record is `Ranger Archetype ~ <name>`, a feature `<name> ~ <feature>`. */
  name: string;
  slug: string;
  file: string;
  page: string;
  book: string;
  /** The rows the archetype's own text replaces, whole, in the mapper's order. */
  replaces: readonly (readonly [RangerRow, number])[];
  /** The root record, when the root has review items: its source hash and the items it settles. */
  root?: {
    sourceSha256: string;
    resolves: readonly { kind: string; id: string }[];
  };
  features: readonly Feature[];
};
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

/** The review that confirmed the first twelve (the record step's receipt). */
const RECEIPT =
  't3-review-51dd0f934d113dafdaaa68853081daa725b60c9c27ba0c27640ce2f87bab3237';
/** The review that confirmed the two Terrain Bonds (terrain-bond-repromote). */
const TERRAIN_BOND_RECEIPT =
  't3-review-5801a4c1f2954549bb637f3b4a10332f60527a9fb723ced04d2045f81e6c3140';
const terrainBondKeys = new Set([
  'everythingpath/ranger-guide-terrain-bond',
  'everythingpath/ranger-warden-terrain-bond',
]);
const receiptOf = (key: string) =>
  terrainBondKeys.has(key) ? TERRAIN_BOND_RECEIPT : RECEIPT;

/** The batch, as the boundary and report give it (archetype-structures-686.md). */
const batch: readonly Archetype[] = [
  {
    name: 'Guide',
    slug: 'guide',
    file: APG,
    page: apgPage,
    book: 'PZO1115',
    replaces: [
      ['favoredEnemy', 1],
      ['huntersBond', 4],
      ['evasion', 9],
      ['quarry', 11],
      ['improvedQuarry', 19],
      ['improvedEvasion', 16],
    ],
    root: {
      sourceSha256:
        'af0808567523d6510bed59a2659f6549010a3cc6b6b995cb5404accf878f628e',
      resolves: [
        { kind: 'conflict', id: 'defect:evasion-gate' },
        { kind: 'conflict', id: 'defect:quarry-gate' },
      ],
    },
    features: [
      [
        'rangers-focus',
        "Ranger's Focus",
        1,
        'd7223d456f63759ffb42a82f72300f94efeda7504823d5ff02a519947bf16682',
        [365, 366],
      ],
      [
        'terrain-bond',
        'Terrain Bond',
        4,
        '1a90d1de5673cc5cadbe2eb8972f99cc966ca3151e29274f4b077b1aca51bfae',
        [367],
      ],
      [
        'rangers-luck',
        "Ranger's Luck",
        9,
        '88ae4cf3cb52b581a0e38b13571b509d0a9ce6f018b9b3bb1a5723b13a24f9ab',
        [368],
      ],
      [
        'inspired-moment',
        'Inspired Moment',
        11,
        '9d33741b51060e1b9595d5019a4c1e52ba3e230f116c2eac020cbfca91b5a939',
        [369],
      ],
      [
        'improved-rangers-luck',
        "Improved Ranger's Luck",
        16,
        '863f7fa902bd25881fc6caf822d34bfa29ffa681e5a81a3433a780274d01d41e',
        [370],
      ],
    ],
  },
  {
    name: 'Infiltrator',
    slug: 'infiltrator',
    file: APG,
    page: apgPage,
    book: 'PZO1115',
    replaces: [['favoredTerrain', 3]],
    features: [
      [
        'adaptation',
        'Adaptation',
        3,
        '7e9063091da47430dd02a112b90c5e938a4afdd400e7a72f0b5d136001f3e145',
        // Its two paragraphs and the adaptation list ("see below").
        range(379, 403),
      ],
    ],
  },
  {
    name: 'Spirit Ranger',
    slug: 'spirit-ranger',
    file: APG,
    page: apgPage,
    book: 'PZO1115',
    replaces: [
      ['huntersBond', 4],
      ['camouflage', 12],
    ],
    features: [
      [
        'spirit-bond',
        'Spirit Bond',
        4,
        '83d2a4b5be0e606941738375aad1e01b96781cc7fbe34935685198b7d057c8e5',
        [456],
        'Its extra Ranger castings are not in the spells per day.',
      ],
      [
        'wisdom-of-the-spirits',
        'Wisdom of the Spirits',
        12,
        '326bd8bd4813148b76400998ff6fc00b7410833a7f756e4560a10cb554f22d42',
        [457],
      ],
    ],
  },
  {
    name: 'Warden',
    slug: 'warden',
    file: UC,
    page: ucPage,
    book: 'PZO1118',
    replaces: [
      ['favoredEnemy', 1],
      ['combatStyleFeat', 2],
      ['huntersBond', 4],
      ['masterHunter', 20],
    ],
    root: {
      sourceSha256:
        'd9b00474fa411cd24e1b82a368b38b926ed25901d101f53f23f91a67251b2cc6',
      resolves: [{ kind: 'conflict', id: 'stackingGuard' }],
    },
    features: [
      [
        'master-of-terrain',
        'Master of TeRrain',
        1,
        '8122c88c4b684805a0dd5819d8d77a8ef286e3a82a421bb5de8ac64b38b08146',
        [382],
      ],
      [
        'live-in-comfort',
        'Live in ComfOrt',
        2,
        '987148e75fdfc4991393b128b0c48f36ed365db5d24c0506af7b381981f71248',
        [383],
      ],
      [
        'terrain-bond',
        'Terrain Bond',
        4,
        '0e349b3c42b741bdee04d7bd25c86c3248f6417f6ed7733acf254bf9d371e5c7',
        [384],
      ],
      [
        'able-explorer',
        'Able ExploreR',
        5,
        '19740e0f6eeafea5ecb434ca6d58dc7b3e2911852240b7b9d1eceb873c6fa1bf',
        [385],
      ],
      [
        'wilderness-whispers',
        'Wilderness Whispers',
        20,
        '52e3963b89320abb311bbeca4db9e5ca1286dc00bf387bcf7d779ef571658180',
        [386],
      ],
    ],
  },
];
/** The eight candidates left out, which keep their state. */
const leftOutSelectors = [
  [ACG, 'Divine Tracker', 'divine-tracker'],
  [LOD, 'Drake Warden', 'drake-warden'],
  [DH, 'Dungeon Rover', 'dungeon-rover'],
  [ARG, 'Dusk Stalker', 'dusk-stalker'],
  [RTT, 'Toxophilite', 'toxophilite'],
  [UC, 'Trophy Hunter', 'trophy-hunter'],
  [UC, 'Wild Stalker', 'wild-stalker'],
  [DEP, 'Yokai Hunter', 'yokai-hunter'],
] as const;
const leftOut = leftOutSelectors.map(
  ([, , slug]) => `everythingpath/ranger-${slug}`,
);

const rootKey = ({ slug }: Archetype) => `everythingpath/ranger-${slug}`;
const featureKey = (archetype: Archetype, [slug]: Feature) =>
  `${rootKey(archetype)}-${slug}`;
const locator = ({ file, name }: Archetype, [, pcgenName]: Feature) =>
  `pcgen:${file}#${name} ~ ${pcgenName}`;
const featureRows = batch.flatMap((archetype) =>
  archetype.features.map((feature) => ({
    key: featureKey(archetype, feature),
    book: archetype.book,
    drafted: feature[5] !== undefined,
  })),
);
/** The one record that stays drafted (Spirit Bond). */
const draftedKeys = new Set(
  featureRows.filter(({ drafted }) => drafted).map(({ key }) => key),
);
const batchKeys = new Set([
  ...batch.map(rootKey),
  ...featureRows.map(({ key }) => key),
]);

const ENTITIES: Record<string, string> = { mdash: '—', ndash: '–', amp: '&' };
/** A PRD feature's paragraphs as plain text: heading dropped, markup and entities read, spaces collapsed, joined by a space. */
async function prdText(page: string, lines: readonly number[]) {
  const text = (await readPinned('prd', page)).split('\n');
  return lines
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
/** The committed records, all fifteen checked in memory (Spirit Bond's too). */
const checkedInMemory = committed.map(
  (record): StructureRecord => ({
    ...record,
    status: 'checked',
    reviewedBy: 'in-memory check (archetype-structures-686.test.ts)',
    reviewedOn: '2026-11-22',
    receipt: `t3-review-${'0'.repeat(64)}`,
  }),
);

const selected = new Set(
  [
    ...batch.map(({ file, name }) => [file, name] as const),
    ...leftOutSelectors.map(([file, name]) => [file, name] as const),
  ].map(([file, name]) => `${file}#Ranger Archetype ~ ${name}`),
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
const replacesOf = ({ replaces }: Archetype) =>
  replaces.map(([name, classLevel]) => ({
    externalKey: row(name),
    classLevel,
    scope: 'whole',
  }));

const base = await emit(without);
const asCommitted = await emit(reviewedCuration);
const asDrafted = await emit(withStructures(draftedInMemory));
const checked = await emit(withStructures(checkedInMemory));
const baseOutcomes = outcomes(base);

/** The records the table gives, rationale aside. */
const expected = [
  ...batch.flatMap((archetype) =>
    archetype.root
      ? [
          {
            externalKey: rootKey(archetype),
            sourceSha256: archetype.root.sourceSha256,
            fields: { 'detail.replaces': replacesOf(archetype) },
            resolves: archetype.root.resolves,
          },
        ]
      : [],
  ),
  ...(await Promise.all(
    batch.flatMap((archetype) =>
      archetype.features.map(async (feature) => ({
        externalKey: featureKey(archetype, feature),
        sourceSha256: feature[3],
        fields: { description: await prdText(archetype.page, feature[4]) },
        resolves: [{ kind: 'ownedFeature', id: locator(archetype, feature) }],
      })),
    ),
  )),
].sort((a, b) => (a.externalKey < b.externalKey ? -1 : 1));

/** The rows all fifteen checked admit: every feature, and every root but the Warden's. */
const admittedRows = [
  ...featureRows,
  ...batch
    .filter(({ slug }) => slug !== 'warden')
    .map((archetype) => ({ key: rootKey(archetype), book: archetype.book })),
];
/**
 * The rows the committed records admit: every feature but Spirit Bond, and
 * each root that adds no drafted feature and replaces only admitted rows (the
 * Guide's and the Infiltrator's).
 */
const committedAdmittedRows = [
  ...featureRows.filter(({ drafted }) => !drafted),
  ...batch
    .filter(
      (archetype) =>
        archetype.slug !== 'warden' &&
        archetype.features.every((feature) => feature[5] === undefined),
    )
    .map((archetype) => ({ key: rootKey(archetype), book: archetype.book })),
];
/** Each root the committed records leave out, with the rows it waits on. */
const committedOmittedRoots = {
  'everythingpath/ranger-spirit-ranger': [
    'everythingpath/ranger-spirit-ranger-spirit-bond',
  ],
  'everythingpath/ranger-warden': [row('combatStyleFeat')],
};

/** Each of the 17 rows' outcome as committed: admitted, held on structure (drafted) or omitted behind what it waits on. */
function committedBatchOutcomes() {
  const outcome: Record<string, { kind: string; reason: string }> = {};
  for (const { key, book } of committedAdmittedRows)
    outcome[key] = {
      kind: 'admitted',
      reason: `Admitted under #227: declared book ${book}.`,
    };
  for (const archetype of batch)
    for (const feature of archetype.features)
      if (feature[5] !== undefined)
        outcome[featureKey(archetype, feature)] = {
          kind: 'held',
          reason: `Structure hand review (#716 plan §6): owned feature ${locator(archetype, feature)}.`,
        };
  for (const [key, waits] of Object.entries(committedOmittedRoots))
    outcome[key] = {
      kind: 'dependentOmissions',
      reason: `Dependent omission: ${waits.join(', ')}.`,
    };
  return Object.fromEntries(Object.entries(outcome).sort());
}

/** A checked record's fields as the entry carries them; no record gives a number on the sheet. */
function expectApplied(
  artifact: Artifact,
  { externalKey, fields }: (typeof expected)[number],
) {
  const entry = entryOf(artifact, externalKey);
  expect(entry?.modifiers, externalKey).toEqual([]);
  if ('description' in fields)
    expect(entry?.description, externalKey).toBe(fields.description);
  else
    expect(entry?.detail, externalKey).toMatchObject({
      replaces: fields['detail.replaces'],
    });
}

describe('the structure records of four mechanical Ranger archetypes (archetype-ranger-1, #716)', () => {
  // Status-dependent: fourteen read checked under their record step's receipts, the held Spirit Bond drafted.
  it('are committed with exactly the reviewed fields, items and source hashes, fourteen checked under their receipts and Spirit Bond drafted; the eight left out have none', () => {
    expect(featureRows).toHaveLength(13);
    expect(expected).toHaveLength(15);
    expect([...draftedKeys].sort()).toEqual([
      'everythingpath/ranger-spirit-ranger-spirit-bond',
    ]);
    for (const record of expected)
      if ('description' in record.fields)
        expect(record.fields.description, record.externalKey).toMatch(/\S/);
    expect(
      committed.map((record) => ({
        externalKey: record.externalKey,
        sourceSha256: record.sourceSha256,
        fields: record.fields,
        resolves: record.resolves,
        status: record.status,
        receipt: record.status === 'checked' ? record.receipt : undefined,
        noMechanics: record.noMechanics,
      })),
    ).toEqual(
      expected.map((record) =>
        draftedKeys.has(record.externalKey)
          ? {
              ...record,
              status: 'drafted',
              receipt: undefined,
              noMechanics: undefined,
            }
          : {
              ...record,
              status: 'checked',
              receipt: receiptOf(record.externalKey),
              noMechanics: undefined,
            },
      ),
    );
    expect(committed.filter(({ status }) => status === 'checked')).toHaveLength(
      14,
    );
    expect(
      (reviewedCuration.structures ?? []).filter(({ externalKey }) =>
        leftOut.some((key) => externalKey.startsWith(key)),
      ),
    ).toEqual([]);
  });

  it('re-affirm on each root record exactly the rows the mapper emits', () => {
    for (const archetype of batch.filter(({ root }) => root)) {
      const detail = entryOf(base, rootKey(archetype))?.detail;
      if (detail?.kind !== 'archetype') throw new Error(`No ${archetype.name}`);
      expect(detail.replaces, archetype.name).toEqual(replacesOf(archetype));
    }
  });

  // Status-dependent: reads the fourteen checked records and the drafted Spirit Bond as committed.
  it('as committed, apply the fourteen and admit 14 of the 17 rows under #227 on their declared books; Spirit Bond stays held on structure, the Spirit Ranger root is omitted behind it and the Warden root behind Combat Style Feat; no other key changes', () => {
    const report = asCommitted.structure;
    if (!report) throw new Error('No structure report');
    expect(
      ours(report.applied)
        .map(({ externalKey }) => externalKey)
        .sort(),
    ).toEqual(
      expected
        .map(({ externalKey }) => externalKey)
        .filter((key) => !draftedKeys.has(key)),
    );
    expect(report.held.filter((key) => batchKeys.has(key)).sort()).toEqual(
      [...draftedKeys].sort(),
    );
    const after = outcomes(asCommitted);
    expect(committedAdmittedRows).toHaveLength(14);
    // Every one of the 17 rows, exactly.
    expect(
      Object.fromEntries(
        [...batchKeys].sort().map((key) => [key, after.get(key)]),
      ),
    ).toEqual(committedBatchOutcomes());
    for (const [key, outcome] of baseOutcomes)
      if (!batchKeys.has(key)) expect(after.get(key), key).toEqual(outcome);
    expect([...after.keys()].sort()).toEqual([...baseOutcomes.keys()].sort());
    for (const record of expected)
      if (!draftedKeys.has(record.externalKey))
        expectApplied(asCommitted, record);
  });

  it('drafted in memory, change no key: every feature and the Guide and Warden roots stay held on structure, the other roots omitted', () => {
    expect(outcomes(asDrafted)).toEqual(baseOutcomes);
    expect(ours(asDrafted.structure?.applied ?? [])).toEqual([]);
    for (const archetype of batch) {
      for (const feature of archetype.features)
        expect(baseOutcomes.get(featureKey(archetype, feature))).toEqual({
          kind: 'held',
          reason: `Structure hand review (#716 plan §6): owned feature ${locator(archetype, feature)}.`,
        });
      const root = baseOutcomes.get(rootKey(archetype));
      if (archetype.root)
        expect(root, archetype.name).toEqual({
          kind: 'held',
          reason: `Structure hand review (#716 plan §6): ${archetype.root.resolves.map(({ kind, id }) => `${kind} ${id}`).join('; ')}.`,
        });
      else expect(root?.kind, archetype.name).toBe('dependentOmissions');
    }
    for (const key of leftOut)
      expect(baseOutcomes.get(key)?.kind, key).not.toBe('admitted');
  });

  it('checked in memory, settle every gate and apply, admit 16 of the 17 rows under #227 on their declared books, the Warden’s root omitted behind Combat Style Feat; no other key changes', () => {
    const report = checked.structure;
    if (!report) throw new Error('No structure report');
    expect({
      handReview: ours(report.handReview),
      unreviewedFeatures: ours(report.unreviewedFeatures),
      invalid: report.invalid,
      conflicts: ours(report.conflicts),
      stale: ours(report.stale),
      held: report.held.filter((key) => batchKeys.has(key)),
    }).toEqual({
      handReview: [],
      unreviewedFeatures: [],
      invalid: [],
      conflicts: [],
      stale: [],
      held: [],
    });
    expect(
      ours(report.applied)
        .map(({ externalKey }) => externalKey)
        .sort(),
    ).toEqual(expected.map(({ externalKey }) => externalKey));
    const after = outcomes(checked);
    for (const { key, book } of admittedRows)
      expect(after.get(key), key).toEqual({
        kind: 'admitted',
        reason: `Admitted under #227: declared book ${book}.`,
      });
    // Combat Style Feat is not admitted (in the full corpus it is omitted
    // behind a combat style held on PZO9488's notice; this pinned tree lacks
    // some of the records it links), nor is the Ranger class behind it. The
    // Warden replaces the row, so its root waits on it; the other roots
    // replace only admitted rows.
    for (const key of [RANGER, row('combatStyleFeat')])
      expect(after.get(key)?.kind, key).not.toBe('admitted');
    expect(after.get('everythingpath/ranger-warden')).toEqual({
      kind: 'dependentOmissions',
      reason: `Dependent omission: ${row('combatStyleFeat')}.`,
    });
    for (const [key, outcome] of baseOutcomes)
      if (!batchKeys.has(key)) expect(after.get(key), key).toEqual(outcome);
    expect([...after.keys()].sort()).toEqual([...baseOutcomes.keys()].sort());
    for (const record of expected) expectApplied(checked, record);
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
        replaces: replacesOf(archetype),
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
