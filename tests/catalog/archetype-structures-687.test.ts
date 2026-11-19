// @vitest-environment node
// archetype-rogue-1 (#716; docs/catalog-import/archetype-structures-687.md):
// the structure records of seven mechanical Rogue archetypes (#687) of the
// Advanced Player's Guide, Occult Adventures and the Pathfinder Society Field
// Guide, written drafted; the record step checked all seventeen on a captured
// review. One table holds the batch: each archetype's PCGen file, book and
// reviewed replacements, and each owned feature's level, source hash, where
// its description comes from (a pinned PRD page's paragraphs, or PCGen's own
// DESC where the capture has no page) and the Modifiers a record binds (Rake's
// Smile only, fix r1). No root has a review item, so every record is a
// feature's. The eleven other candidates are left out (the report says why;
// Acrobat and Sniper since fix r1) and keep their state. Every case runs on
// the pinned tree.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import { importCatalog } from '../../scripts/catalog/import';
import { pcgenPin } from '../../scripts/catalog/inventory';
import { pcgenOwnerSelection } from '../../scripts/catalog/pcgen-owners';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import type { StructureRecord } from '../../scripts/catalog/structure-curation';
import { preparedArchetypeDetail } from '../../src/lib/catalog/imported-archetype';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from '../../src/lib/character-sheet';
import { preview as armorPreview } from '../fixtures/armors-and-shields-424/data';
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
const OA = 'roleplaying_game/occult_adventures/oa_abilities_class.lst';
const PFSFG =
  'campaign_setting/pathfinder_society_field_guide/pfsfg_abilities_class.lst';
const UI = 'roleplaying_game/ultimate_intrigue/ui_abilities_class.lst';
const TG = 'campaign_setting/technology_guide/tg_abilities_class.lst';
const ANAR = 'player_companion/animal_archive/anar_abilities_class.lst';
const apgPage = 'pages/advancedPlayersGuide/coreClasses/rogue.html';
const oaPage = 'pages/occultAdventures/archetypes/other.html';
/** The record step's receipt: the captured review that checked all seventeen records. */
const RECEIPT =
  't3-review-384299b8c0469c9a27696e1a51fba65e604a512253222f841a507e74a10aef65';

/** The Rogue's rows the seven archetypes replace (Foundry ids). */
const rogue = {
  trapfinding: 'pEODJDoTk7uhCZY7',
  rogueTalents: 'iBTrvPtn3jczInbn',
  trapSense: 'BoEkMviJrW0PKmhj',
  uncannyDodge: '7WaQxnVaaoL4AGr8',
  improvedUncannyDodge: 'ZfnHhhTFQVo0Lj4P',
} as const;
type RogueRow = keyof typeof rogue;
const row = (name: RogueRow) => `pf1/${rogue[name]}`;
/** A rogue talent's row at a class level: the feature at 2nd, its numbered increment after. */
const talentRow = (classLevel: number) =>
  classLevel === 2
    ? row('rogueTalents')
    : `everythingpath/rogue-rogue-talents-${classLevel}`;

/**
 * The Rogue class and the rows above with every pinned Foundry record they
 * link (`Compendium.pf1.<pack>.…<id>`), transitively. Without them the class
 * and those rows fail on unresolved references and the archetypes are omitted
 * behind them.
 */
async function rogueClosure() {
  const packs = pinnedPath('pf1', 'packs');
  const byId = new Map<string, string>();
  for (const pack of await readdir(packs))
    for (const file of await readdir(join(packs, pack)).catch(() => []))
      byId.set(file.split('.').at(-2) ?? '', `packs/${pack}/${file}`);
  const files = new Set<string>();
  const queue: string[] = ['24b0LaabeAlUx5gN', ...Object.values(rogue)];
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
  'roleplaying_game/occult_adventures/_occult_adventures.pcc',
  OA,
  'campaign_setting/pathfinder_society_field_guide/pathfinder_society_field_guide.pcc',
  PFSFG,
  'roleplaying_game/ultimate_intrigue/_ultimate_intrigue.pcc',
  UI,
  'campaign_setting/technology_guide/_technology_guide.pcc',
  TG,
  ANAR,
];
const tree = await materializePinnedTree([
  ...new Set([...ownerEmissionFoundryFiles, ...(await rogueClosure())]),
  ...[...new Set(pcgenFiles)].map(
    (path) => `pcgen/${pcgenPin.directory}/${path}`,
  ),
]);
afterAll(() => tree.dispose());

const remaps: unknown = JSON.parse(
  await readFile('scripts/catalog/reviewed-remaps.json', 'utf8'),
);

/** Where a feature's description comes from: its PRD paragraphs, or PCGen's own DESC (no page). */
type TextSource = { page: string; lines: readonly number[] } | 'pcgen';
type Feature = readonly [
  slug: string,
  /** The feature's name in its PCGen KEY (`<archetype> ~ <name>`). */
  pcgenName: string,
  classLevel: number,
  sourceSha256: string,
  text: TextSource,
  /** The Modifiers the record binds, when the feature gives a number the sheet computes. */
  modifiers?: readonly unknown[],
];
/** A replaced row: the whole feature, or one rogue talent by its class level. */
type Replacement = readonly [RogueRow, number] | readonly ['talent', number];
type Archetype = {
  /** PCGen's name: the record is `Rogue Archetype ~ <name>`, a feature `<name> ~ <feature>`. */
  name: string;
  slug: string;
  file: string;
  book: string;
  /** The rows the archetype's own text replaces, in the mapper's order. */
  replaces: readonly Replacement[];
  features: readonly Feature[];
};
const apg = (...lines: number[]) => ({ page: apgPage, lines });
const oa = (...lines: number[]) => ({ page: oaPage, lines });

/** The batch, as the boundary and report give it (archetype-structures-687.md). */
const batch: readonly Archetype[] = [
  {
    name: 'Cutpurse',
    slug: 'cutpurse',
    file: APG,
    book: 'PZO1115',
    replaces: [
      ['trapfinding', 1],
      ['trapSense', 3],
    ],
    features: [
      [
        'measure-the-mark',
        'Measure the Mark',
        1,
        '9c9623c8363861a8958dc6f346885c8de7076ce5126a1f58fec262dbe52a2a8b',
        apg(416),
      ],
      [
        'stab-and-grab',
        'Stab and Grab',
        3,
        'ced8b34fe99afae6e3c29b83cdfe95b6e65b811adf671983d021d13402db8335',
        apg(417),
      ],
    ],
  },
  {
    name: 'Investigator',
    slug: 'investigator',
    file: APG,
    book: 'PZO1115',
    replaces: [['trapfinding', 1]],
    features: [
      [
        'follow-up',
        'Follow Up',
        1,
        '320180f59a8e10b615f3d5a9ee8868aafe01dbf4c93b7ce41c739f7813c47013',
        apg(422),
      ],
    ],
  },
  {
    name: 'Rake',
    slug: 'rake',
    file: APG,
    book: 'PZO1115',
    replaces: [
      ['trapfinding', 1],
      ['trapSense', 3],
    ],
    features: [
      [
        'bravados-blade',
        "Bravado's Blade",
        1,
        'e377b7483b1eff4202b4a28fd1dbacc3af18cda9ac12af5f4448faa10c5660a0',
        apg(433),
      ],
      [
        'rakes-smile',
        "Rake's Smile",
        3,
        '1f99c7780fdf2590cc2d4928cfdca39ece839f51b282afd0dec96dcee4201247',
        apg(434),
        // "+1 morale bonus on Bluff and Diplomacy checks. This bonus increases
        // by +1 for every 3 levels beyond 3rd" (PRD :434; PCGen
        // BONUS:SKILL|Bluff,Diplomacy|(RogueLVL/3), apg_abilities_class.lst:2975).
        (['skill.blf', 'skill.dip'] as const).map((target) => ({
          target,
          bonusType: 'morale',
          value: { formula: 'floor(@classLevel.rogue / 3)' },
        })),
      ],
    ],
  },
  {
    name: 'Scout',
    slug: 'scout',
    file: APG,
    book: 'PZO1115',
    replaces: [
      ['uncannyDodge', 4],
      ['improvedUncannyDodge', 8],
    ],
    features: [
      [
        'scouts-charge',
        "Scout's Charge",
        4,
        '0b5e0e3c9f01da83ec25b479d4b8f4328b1002dc88e7af1716c8e0a5b854a19b',
        apg(439),
      ],
      [
        'skirmisher',
        'Skirmisher',
        8,
        '8987c1695690ffb82c5acfbb841f715de26b5ba959b3c12ec259a0e53922bcf1',
        apg(440),
      ],
    ],
  },
  {
    name: 'Thug',
    slug: 'thug',
    file: APG,
    book: 'PZO1115',
    replaces: [
      ['trapfinding', 1],
      ['trapSense', 3],
    ],
    features: [
      [
        'frightening',
        'Frightening',
        1,
        '4e5aeea1eb5d892891d09e2091a92baed126d9f945e9ead6dd420dce3b26b658',
        apg(463),
      ],
      [
        'brutal-beating',
        'Brutal Beating',
        3,
        '9caab37fe9b9b0bb1df6899bbbc2a3c3165bb57a91eefc583678302f748b9716',
        apg(464),
      ],
    ],
  },
  {
    name: 'False Medium',
    slug: 'false-medium',
    file: OA,
    book: 'PZO1132',
    replaces: [
      ['trapfinding', 1],
      ['talent', 2],
      ['trapSense', 3],
    ],
    features: [
      [
        'dim-the-lights',
        'Dim the Lights',
        1,
        '5493aa9e11a1b3ca3a6b78c09b747241a0285631209d5a1982540626a800e662',
        oa(576),
      ],
      [
        'false-sensitivity',
        'False Sensitivity',
        2,
        'bc4350569e0e8ef3431736da8c1396286d8e8cdbb750ab64514d04a499ccafa3',
        oa(577),
      ],
      [
        'haunting-presences',
        'Haunting Presences',
        3,
        '80ea70096194b213a5c65b8b75595dc69494fbcb16b4758517c7124981f3a349',
        oa(578, 579),
      ],
    ],
  },
  {
    name: 'Scroll Scoundrel',
    slug: 'scroll-scoundrel',
    file: PFSFG,
    book: 'PZO9235',
    replaces: [
      ['talent', 2],
      ['talent', 10],
      ['trapSense', 3],
      ['uncannyDodge', 4],
      ['improvedUncannyDodge', 8],
    ],
    features: [
      [
        'fast-talker',
        'Fast Talker',
        2,
        '7748b27bad20b273351ac86bcc5bd5d22fd1a923787e9a015fcb2ecbe84a6b97',
        'pcgen',
      ],
      [
        'adaptive-learning',
        'Adaptive Learning',
        3,
        '9d8654748937d978e7ebc717e2b0e705de105db0f7f2a82849a104f0d05fdd7b',
        'pcgen',
      ],
      [
        'pay-it-back',
        'Pay It Back',
        4,
        '7170468b51b3d972aadb1f4f720af16abd024b313843ca4e563acd305f3f8ba5',
        'pcgen',
      ],
      [
        'elusive-gambit',
        'Elusive Gambit',
        6,
        'd006a79fefccaba5e9593863e815d9b7350773d4468ba88262b498c7e821f214',
        'pcgen',
      ],
      [
        'spot-weakness',
        'Spot Weakness',
        10,
        'd5e47230672aa707c97b2b08656b1e0d69e603ce86c8a3514ae396c9fe4e6e70',
        'pcgen',
      ],
    ],
  },
];
/** The eleven candidates left out, which keep their state. */
const leftOutSelectors = [
  // Fix r1: Expert Acrobat's armor check penalty waiver and Accuracy's halved
  // range penalty change numbers the sheet computes, and no record field binds either.
  [APG, 'Acrobat', 'acrobat'],
  [APG, 'Sniper', 'sniper'],
  [APG, 'Burglar', 'burglar'],
  [APG, 'Trapsmith', 'trapsmith'],
  [APG, 'Poisoner', 'poisoner'],
  [OA, 'Escapologist', 'escapologist'],
  [UI, 'Guild Agent', 'guild-agent'],
  [UI, 'Heister', 'heister'],
  [UI, 'Master of Disguise', 'master-of-disguise'],
  [TG, 'Numerian Scavenger', 'numerian-scavenger'],
  [ANAR, 'Carnivalist', 'carnivalist'],
] as const;
/** Their keys, with the two features they share (Careful Disarm, Poison Use). */
const leftOut = [
  ...leftOutSelectors.map(([, , slug]) => `everythingpath/rogue-${slug}`),
  'everythingpath/rogue-careful-disarm',
  'everythingpath/rogue-poison-use',
];

const rootKey = ({ slug }: Archetype) => `everythingpath/rogue-${slug}`;
const featureKey = (archetype: Archetype, [slug]: Feature) =>
  `${rootKey(archetype)}-${slug}`;
const locator = ({ file, name }: Archetype, [, pcgenName]: Feature) =>
  `pcgen:${file}#${name} ~ ${pcgenName}`;
const batchRows = batch.flatMap((archetype) => [
  { key: rootKey(archetype), book: archetype.book },
  ...archetype.features.map((feature) => ({
    key: featureKey(archetype, feature),
    book: archetype.book,
  })),
]);
const batchKeys = new Set(batchRows.map(({ key }) => key));

const ENTITIES: Record<string, string> = { mdash: '—', ndash: '–', amp: '&' };
/** A PRD feature's paragraphs as plain text: heading dropped, markup and entities read, spaces collapsed, joined by a space. */
async function prdText({
  page,
  lines,
}: {
  page: string;
  lines: readonly number[];
}) {
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

const selected = new Set(
  [
    ...batch.map(({ file, name }) => [file, name] as const),
    ...leftOutSelectors.map(([file, name]) => [file, name] as const),
  ].map(([file, name]) => `${file}#Rogue Archetype ~ ${name}`),
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
const baseOutcomes = outcomes(base);

/** The records the table gives, rationale aside. */
const expected = (
  await Promise.all(
    batch.flatMap((archetype) =>
      archetype.features.map(async (feature) => {
        const key = featureKey(archetype, feature);
        const text = feature[4];
        return {
          externalKey: key,
          sourceSha256: feature[3],
          fields: {
            description:
              text === 'pcgen'
                ? entryOf(base, key)?.description
                : await prdText(text),
            ...(feature[5] && { modifiers: feature[5] }),
          },
          resolves: [{ kind: 'ownedFeature', id: locator(archetype, feature) }],
        };
      }),
    ),
  )
).sort((a, b) => (a.externalKey < b.externalKey ? -1 : 1));

const ROGUE = 'pf1/24b0LaabeAlUx5gN';
const CHAIN_SHIRT = 'pf1/iGu21zy6QtroUZ4O'; // light armor, armor check penalty 2

/** The imported entries as a release prepares them for the sheet: Modifiers, rows and archetypes. */
function sheetCatalog(artifact: Artifact): CharacterSheetCatalogEntry[] {
  const byKey = new Map(
    artifact.catalog.entries.map((entry) => [entry.externalKey, entry]),
  );
  return artifact.catalog.entries.flatMap(
    (entry): CharacterSheetCatalogEntry[] => {
      // The imported entry schema types the Modifiers and the details.
      const { detail, modifiers } = importedCatalogEntrySchema.parse(entry);
      const base = {
        _id: entry.externalKey,
        ruleIdentity: entry.externalKey,
        name: entry.name,
        // The imported schema keeps bonus types as strings; the sheet's are the closed list.
        modifiers: modifiers as CharacterSheetCatalogEntry['modifiers'],
      };
      if (detail.kind === 'class')
        return [
          {
            ...base,
            detail: {
              kind: 'class',
              classKind: detail.classKind,
              tag: detail.tag,
              hitDie: detail.hitDie,
              bab: detail.bab,
              saves: detail.saves,
              skillRanksPerLevel: detail.skillRanksPerLevel,
              featuresByLevel: detail.featuresByLevel
                .filter(({ externalKey }) => byKey.has(externalKey))
                .map(({ classLevel, externalKey }) => ({
                  classLevel,
                  catalogEntryId: externalKey,
                })),
              picksByLevel: [],
            },
          },
        ];
      if (detail.kind === 'classFeature')
        return [
          {
            ...base,
            detail: {
              kind: 'classFeature',
              ...(detail.parentFeature && {
                parentFeature: detail.parentFeature,
              }),
              ...(detail.part && { part: detail.part }),
            },
          },
        ];
      if (detail.kind === 'archetype')
        return [
          {
            ...base,
            detail: preparedArchetypeDetail(detail, (key) => {
              const target = byKey.get(key)?.detail;
              return {
                id: key,
                ruleIdentity: key,
                ...(target?.kind === 'classFeature'
                  ? { parentFeature: target.parentFeature, part: target.part }
                  : {}),
              };
            }),
          },
        ];
      return [];
    },
  );
}

/** An imported armor (armors-and-shields-424 preview). */
function armor(key: string): CharacterSheetCatalogEntry {
  const row = armorPreview.entries.find((entry) => entry.externalKey === key);
  if (row?.detail?.kind !== 'item' || !row.detail.armor)
    throw new Error(`Missing imported armor ${key}`);
  return {
    _id: key,
    ruleIdentity: key,
    name: row.name,
    modifiers: [],
    detail: row.detail,
  } as CharacterSheetCatalogEntry;
}

/** A Rogue of this level, ability scores 10, no ranks, with an archetype or none, in a chain shirt or unarmored. */
function rogueSheet(
  artifact: Artifact,
  {
    level,
    archetype,
    armored,
  }: { level: number; archetype?: string; armored: boolean },
) {
  const entries: SheetEntry[] = [
    {
      _id: 'base-row',
      kind: 'base',
      active: true,
      catalogEntryId: 'base',
      state: { kind: 'base' },
    },
    ...Array.from(
      { length: level },
      (_, index): SheetEntry => ({
        _id: `level-${index + 1}`,
        kind: 'classLevel',
        active: true,
        state: {
          kind: 'classLevel',
          classEntryId: ROGUE,
          position: index + 1,
          hpGained: 5,
        },
      }),
    ),
    ...(archetype
      ? [
          {
            _id: 'archetype-row',
            kind: 'archetype' as const,
            active: true,
            catalogEntryId: archetype,
            state: { kind: 'archetype' as const },
          },
        ]
      : []),
    ...(armored
      ? [
          {
            _id: 'worn-armor',
            kind: 'item' as const,
            active: true,
            catalogEntryId: CHAIN_SHIRT,
            state: { kind: 'item' as const },
          },
        ]
      : []),
  ];
  const input: CharacterSheetInput = {
    characterKind: 'pc',
    entries,
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base' as const,
          value: 10,
        })),
      },
      ...sheetCatalog(artifact),
      armor(CHAIN_SHIRT),
    ],
  };
  const { breakdowns } = calculateCharacterSheet(input);
  return {
    bluff: breakdowns['skill.blf'].total,
    diplomacy: breakdowns['skill.dip'].total,
    acrobatics: breakdowns['skill.acr'].total,
  };
}

describe('the structure records of seven mechanical Rogue archetypes (archetype-rogue-1, #716)', () => {
  it('are committed with exactly the reviewed descriptions, Modifiers, items and source hashes, all seventeen checked by the record step; the eleven left out have none', () => {
    expect(batchRows).toHaveLength(24);
    for (const record of expected)
      expect(record.fields.description, record.externalKey).toMatch(/\S/);
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
        leftOut.some((key) => externalKey.startsWith(key)),
      ),
    ).toEqual([]);
  });

  it('as committed (checked by the record step), settle every gate and apply, and admit all 24 rows under #227 on their declared books; no other key changes', () => {
    const report = asCommitted.structure;
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
    const after = outcomes(asCommitted);
    for (const { key, book } of batchRows)
      expect(after.get(key), key).toEqual({
        kind: 'admitted',
        reason: `Admitted under #227: declared book ${book}.`,
      });
    for (const [key, outcome] of baseOutcomes)
      if (!batchKeys.has(key)) expect(after.get(key), key).toEqual(outcome);
    expect([...after.keys()].sort()).toEqual([...baseOutcomes.keys()].sort());
    for (const record of expected)
      expect(
        entryOf(asCommitted, record.externalKey),
        record.externalKey,
      ).toMatchObject({
        detail: { kind: 'classFeature' },
        // Only Rake's Smile gives a number on the sheet.
        modifiers: [],
        ...record.fields,
      });
  });

  it('drafted in memory, change no key: every feature stays held on structure and every root omitted behind its features', () => {
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

  it('as committed, replace exactly the rows each archetype’s own text names, whole or the one rogue talent, and add its features at their levels', () => {
    for (const archetype of batch) {
      const detail = entryOf(asCommitted, rootKey(archetype))?.detail;
      if (detail?.kind !== 'archetype') throw new Error(`No ${archetype.name}`);
      expect(
        {
          replaces: detail.replaces,
          featureChanges: detail.featureChanges,
          adds: detail.adds,
        },
        archetype.name,
      ).toEqual({
        replaces: archetype.replaces.map(([name, classLevel]) =>
          name === 'talent'
            ? { externalKey: talentRow(classLevel), classLevel, scope: 'part' }
            : { externalKey: row(name), classLevel, scope: 'whole' },
        ),
        featureChanges: archetype.replaces.map(([name, classLevel]) =>
          name === 'talent'
            ? { externalKey: row('rogueTalents'), scope: 'part', classLevel }
            : { externalKey: row(name), scope: 'whole' },
        ),
        adds: archetype.features.map((feature) => ({
          externalKey: featureKey(archetype, feature),
          classLevel: feature[2],
        })),
      });
    }
  });
  it("as committed, give a rake Rake's Smile on the sheet: +1 morale on Bluff and Diplomacy at Rogue 4 and +2 at 8, none at 1, in light armor or none; drafted in memory, none", () => {
    const rake = 'everythingpath/rogue-rake';
    for (const armored of [false, true])
      for (const [level, smile] of [
        [1, 0],
        [4, 1],
        [8, 2],
      ] as const) {
        const at = `Rogue ${level}${armored ? ' in a chain shirt' : ''}`;
        // Ability scores 10 and no ranks: the totals are the bonuses alone.
        // The chain shirt's −2 reaches Acrobatics, never Bluff or Diplomacy.
        const acrobatics = armored ? -2 : 0;
        expect(
          rogueSheet(asCommitted, { level, archetype: rake, armored }),
          at,
        ).toEqual({ bluff: smile, diplomacy: smile, acrobatics });
        expect(
          rogueSheet(asCommitted, { level, armored }),
          `${at}, no archetype`,
        ).toEqual({ bluff: 0, diplomacy: 0, acrobatics });
        expect(
          rogueSheet(drafted, { level, archetype: rake, armored }),
          `${at}, drafted`,
        ).toEqual({ bluff: 0, diplomacy: 0, acrobatics });
      }
  });
});
