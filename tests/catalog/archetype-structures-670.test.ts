// @vitest-environment node
// archetype-fighter-1 (#716; docs/catalog-import/archetype-structures-670.md):
// the structure records of two mechanical Fighter archetypes (#670), the
// Mutation Warrior of the Advanced Class Guide and the Thunderstriker of
// Ultimate Combat. Six features are checked by the record step: four of the
// Thunderstriker's on review t3-review-af9e9ccc…, Mutagen and Buckler Defense
// on review t3-review-6fec4f2a…; three stay drafted and held: Mutagen
// Discovery (its second review wants a fuller rationale), Strapped Shield and
// Hardbuckler (each exposes a number the sheet computes that no record field
// carries). One table holds the batch:
// each archetype's PCGen file, book and reviewed replacements, and each owned
// feature's level, source hash, the pinned PRD paragraph its description is
// and, if drafted, why. Every record is description only; none binds a
// number, and neither root has a review item. The eight other candidates are
// left out (the report says why) and keep their state. Both roots wait on
// their drafted features; Weapon Training is held on PZO9493's owner-owed
// hold, so the Thunderstriker's root, which replaces two of its rows, stays a
// dependent omission even with every record checked. Both archetypes replace
// Armor Training's 3rd-level row, so the sheet's Armor Training goes with it.
// Every case runs on the pinned tree.
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
const UC = 'roleplaying_game/ultimate_combat/uc_abilities_class.lst';
const ACG = 'roleplaying_game/advanced_class_guide/acg_abilities_class.lst';
const ARG = 'roleplaying_game/advanced_race_guide/arg_abilities_class.lst';
const acgPage = 'pages/advancedClassGuide/classOptions/fighter.html';
const ucPage = 'pages/ultimateCombat/classArchetypes/fighter.html';

const FIGHTER = 'pf1/WLqBCT5DqmGAx8Wd';
/**
 * The Fighter's rows the two archetypes replace: a numbered part (the 3rd- or
 * 5th-level row is its feature's first part; a later one names its parent), or
 * Armor Mastery whole.
 */
const fighter = {
  armorTraining: { key: 'pf1/5JFfSqLMCpbRmERa' },
  armorTraining7: {
    key: 'everythingpath/fighter-armor-training-7',
    parent: 'pf1/5JFfSqLMCpbRmERa',
  },
  armorTraining11: {
    key: 'everythingpath/fighter-armor-training-11',
    parent: 'pf1/5JFfSqLMCpbRmERa',
  },
  armorTraining15: {
    key: 'everythingpath/fighter-armor-training-15',
    parent: 'pf1/5JFfSqLMCpbRmERa',
  },
  weaponTraining: { key: 'pf1/RzEzudurxQFirFoF' },
  weaponTraining13: {
    key: 'everythingpath/fighter-weapon-training-13',
    parent: 'pf1/RzEzudurxQFirFoF',
  },
  weaponTraining17: {
    key: 'everythingpath/fighter-weapon-training-17',
    parent: 'pf1/RzEzudurxQFirFoF',
  },
  armorMastery: { key: 'pf1/NwTe1Q2utlsmOAqK', whole: true },
} as const;
type FighterRow = keyof typeof fighter;
const row = (name: FighterRow) => fighter[name].key;

/**
 * The Fighter class and its Armor Training, Weapon Training and Armor Mastery
 * with every pinned Foundry record they link (`Compendium.pf1.<pack>.…<id>`),
 * transitively, as far as the pinned store holds them.
 */
async function fighterClosure() {
  const packs = pinnedPath('pf1', 'packs');
  const byId = new Map<string, string>();
  for (const pack of await readdir(packs))
    for (const file of await readdir(join(packs, pack)).catch(() => []))
      byId.set(file.split('.').at(-2) ?? '', `packs/${pack}/${file}`);
  const files = new Set<string>();
  const queue: string[] = [
    FIGHTER,
    row('armorTraining'),
    row('weaponTraining'),
    row('armorMastery'),
  ].map((key) => key.slice(4));
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
];
const tree = await materializePinnedTree([
  ...new Set([...ownerEmissionFoundryFiles, ...(await fighterClosure())]),
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
  /** The PRD paragraph (pinned page line) its description is. */
  line: number,
  /** Set when the record stays drafted: why it is not checked. */
  drafted?: string,
];
type Archetype = {
  /** PCGen's name: the record is `Fighter Archetype ~ <name>`, a feature `<name> ~ <feature>`. */
  name: string;
  slug: string;
  file: string;
  page: string;
  book: string;
  /** The rows the archetype's own text replaces, in the mapper's order. */
  replaces: readonly (readonly [FighterRow, number])[];
  features: readonly Feature[];
};

/** The batch, as the boundary and report give it (archetype-structures-670.md). */
const batch: readonly Archetype[] = [
  {
    name: 'Mutation Warrior',
    slug: 'mutation-warrior',
    file: ACG,
    page: acgPage,
    book: 'PZO1129',
    replaces: [
      ['armorTraining', 3],
      ['armorTraining7', 7],
      ['armorTraining11', 11],
      ['armorTraining15', 15],
      ['armorMastery', 19],
    ],
    features: [
      [
        'mutagen',
        'Mutagen',
        3,
        'fe512e1202e6d345c9e3385975cb94e31f7222e4b88af0871642482d58ebdaa8',
        361,
      ],
      [
        'mutagen-discovery',
        'Mutagen Discovery',
        7,
        'd797e314edf5fbe2e6d0c4a865608caf9f38682bd8e8da75aaa85d1b5fb1f6b2',
        362,
        'held: its second review wants the rationale to cover Nauseating Flesh’s engulfing and self-poison immunity and Vestigial Arm’s manually entered extra limb',
      ],
    ],
  },
  {
    name: 'Thunderstriker',
    slug: 'thunderstriker',
    file: UC,
    page: ucPage,
    book: 'PZO1118',
    replaces: [
      ['armorTraining', 3],
      ['armorTraining7', 7],
      ['armorTraining11', 11],
      ['armorTraining15', 15],
      ['armorMastery', 19],
      ['weaponTraining13', 13],
      ['weaponTraining17', 17],
    ],
    features: [
      [
        'strapped-shield',
        'Strapped Shield',
        3,
        '8aff2c82438cbb0934046c10742b61262e44e529a9b592da4e4b0b0e4ecb88ce',
        405,
        'held: removes the buckler’s −1 melee penalty in the two-handed case, which a checked Modifier applies under a Situation',
      ],
      [
        'hardbuckler',
        'Hardbuckler',
        7,
        '586247fa0597b506a3d23545da6618764a46b259c9ae7259f3ef078d59539884',
        406,
        'held: grants a light-shield bash with a buckler, which the attack model needs weapon detail for',
      ],
      [
        'knockback-smash',
        'Knockback Smash',
        11,
        '1b1b3ab6b93b91dd150a5a632f59e78e16a5254e174ba8d7d3806cfd07049fee',
        407,
      ],
      [
        'hammer-and-anvil',
        'Hammer And Anvil',
        13,
        '41b9bfa6553086a0073b37a5b3069e5a81b8a9d03971c7bc07de6f0ef955559b',
        408,
      ],
      [
        'buckler-defense',
        'Buckler Defense',
        15,
        'f20b9daa2241dc8bc0e06a098d6b95d155ee345439175e019ed2a59ace6cfa4f',
        409,
      ],
      [
        'balanced-bashing',
        'Balanced Bashing',
        17,
        'e278386cd8f8a717775c1824ba6df412c62bc77f54c77fd6d6fd837c32b99dfb',
        410,
      ],
      [
        'improved-buckler-defense',
        'Improved Buckler Defense',
        19,
        '0e5e6cf23b0cc7b1c58ce78d50591f67f331f2da7d40bf59b312785546829b7e',
        411,
      ],
    ],
  },
];
/** The eight candidates left out, which keep their state. */
const leftOutSelectors = [
  [APG, 'Phalanx Soldier', 'phalanx-soldier'],
  [APG, 'Roughrider', 'roughrider'],
  [APG, 'Savage Warrior', 'savage-warrior'],
  [APG, 'Two-Weapon Warrior', 'two-weapon-warrior'],
  [ARG, 'Cavern Sniper', 'cavern-sniper'],
  [UC, 'Cad', 'cad'],
  [UC, 'Gladiator', 'gladiator'],
  [UC, 'Tower Shield Specialist', 'tower-shield-specialist'],
] as const;
const leftOut = leftOutSelectors.map(
  ([, , slug]) => `everythingpath/fighter-${slug}`,
);

const rootKey = ({ slug }: Archetype) => `everythingpath/fighter-${slug}`;
const featureKey = (archetype: Archetype, [slug]: Feature) =>
  `${rootKey(archetype)}-${slug}`;
const locator = ({ file, name }: Archetype, [, pcgenName]: Feature) =>
  `pcgen:${file}#${name} ~ ${pcgenName}`;
const featureRows = batch.flatMap((archetype) =>
  archetype.features.map((feature) => ({
    key: featureKey(archetype, feature),
    book: archetype.book,
  })),
);
const batchKeys = new Set([
  ...batch.map(rootKey),
  ...featureRows.map(({ key }) => key),
]);
/** The three records that stay drafted and held. */
const draftedKeys = new Set(
  batch.flatMap((archetype) =>
    archetype.features
      .filter((feature) => feature[5] !== undefined)
      .map((feature) => featureKey(archetype, feature)),
  ),
);
/** The review that confirmed the four Thunderstriker features (the record step's receipt). */
const RECEIPT =
  't3-review-af9e9ccc0a2103b68e2b6182b482c9251e628f741d690e8440629dfd727b80bf';
/** The second review, which confirmed Mutagen and Buckler Defense (the record step's receipt). */
const RECEIPT_R2 =
  't3-review-6fec4f2a72ae81c8a2d08e5ae97e81c1a83672761ca7a07a14028838eed5b3a0';
const checkedOnR2 = new Set([
  'everythingpath/fighter-mutation-warrior-mutagen',
  'everythingpath/fighter-thunderstriker-buckler-defense',
]);

const ENTITIES: Record<string, string> = { mdash: '—', ndash: '–', amp: '&' };
/** A PRD feature's paragraph as plain text: heading dropped (`<b>` or `<strong>`), markup and entities read, spaces collapsed. */
async function prdText(page: string, line: number) {
  const html = ((await readPinned('prd', page)).split('\n')[line - 1] ?? '')
    .trim()
    .replace(/^<p[^>]*>/, '')
    .replace(/<\/p>$/, '')
    .replace(/^<(b|strong)>.*?<\/\1>\s*:?\s*/, '');
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&(\w+);/g, (match, name: string) => {
      const entity = ENTITIES[name];
      if (entity === undefined) throw new Error(`Unread entity ${match}`);
      return entity;
    })
    .replace(/\s+/g, ' ')
    .trim();
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
/** The committed records, all nine checked in memory. */
const checkedInMemory = committed.map(
  (record): StructureRecord => ({
    ...record,
    status: 'checked',
    reviewedBy: 'in-memory check (archetype-structures-670.test.ts)',
    reviewedOn: '2026-11-22',
    receipt: `t3-review-${'0'.repeat(64)}`,
  }),
);

const selected = new Set(
  [
    ...batch.map(({ file, name }) => [file, name] as const),
    ...leftOutSelectors.map(([file, name]) => [file, name] as const),
  ].map(([file, name]) => `${file}#Fighter Archetype ~ ${name}`),
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
    scope: 'whole' in fighter[name] ? 'whole' : 'part',
  }));
/** A part replacement names its row's feature and level; a whole one the feature. */
const featureChangesOf = ({ replaces }: Archetype) =>
  replaces.map(([name, classLevel]) => {
    const target = fighter[name];
    if ('whole' in target) return { externalKey: target.key, scope: 'whole' };
    const feature = 'parent' in target ? target.parent : target.key;
    return { externalKey: feature, scope: 'part', classLevel };
  });

const base = await emit(without);
const asCommitted = await emit(reviewedCuration);
const asDrafted = await emit(withStructures(draftedInMemory));
const checked = await emit(withStructures(checkedInMemory));
const baseOutcomes = outcomes(base);

/** The records the table gives, rationale aside. */
const expected = (
  await Promise.all(
    batch.flatMap((archetype) =>
      archetype.features.map(async (feature) => ({
        externalKey: featureKey(archetype, feature),
        sourceSha256: feature[3],
        fields: { description: await prdText(archetype.page, feature[4]) },
        resolves: [{ kind: 'ownedFeature', id: locator(archetype, feature) }],
      })),
    ),
  )
).sort((a, b) => (a.externalKey < b.externalKey ? -1 : 1));

/** The rows all nine checked admit: every feature, and the Mutation Warrior's root. */
const admittedRows = [
  ...featureRows,
  ...batch
    .filter(({ slug }) => slug !== 'thunderstriker')
    .map((archetype) => ({ key: rootKey(archetype), book: archetype.book })),
];

/**
 * The rows the committed records admit: the six checked features. Each root
 * adds a drafted feature, so both are omitted behind it, the Mutation
 * Warrior's behind Mutagen Discovery and the Thunderstriker's behind Strapped
 * Shield and Hardbuckler and behind Weapon Training and its parts at 13 and 17.
 */
const committedAdmittedRows = featureRows.filter(
  ({ key }) => !draftedKeys.has(key),
);
/** Each root the committed records leave out, with the rows it waits on. */
const committedOmittedRoots = {
  'everythingpath/fighter-mutation-warrior': [
    'everythingpath/fighter-mutation-warrior-mutagen-discovery',
  ],
  'everythingpath/fighter-thunderstriker': [
    'everythingpath/fighter-thunderstriker-hardbuckler',
    'everythingpath/fighter-thunderstriker-strapped-shield',
    row('weaponTraining13'),
    row('weaponTraining17'),
    row('weaponTraining'),
  ],
};
/** Each of the 11 rows' outcome as committed: admitted, held on structure (drafted) or omitted behind what it waits on. */
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

const BREASTPLATE = 'pf1/5TzaS38RPAx1oj9p'; // +6, max Dex 3, armor check penalty 4

/** The imported entries as a release prepares them for the sheet: rows, features and archetypes. */
function sheetCatalog(artifact: Artifact): CharacterSheetCatalogEntry[] {
  const byKey = new Map(
    artifact.catalog.entries.map((entry) => [entry.externalKey, entry]),
  );
  return artifact.catalog.entries.flatMap(
    (entry): CharacterSheetCatalogEntry[] => {
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

/** The imported breastplate (armors-and-shields-424 preview), without a bash. */
function breastplate(): CharacterSheetCatalogEntry {
  const item = armorPreview.entries.find(
    (entry) => entry.externalKey === BREASTPLATE,
  );
  if (item?.detail?.kind !== 'item' || !item.detail.armor)
    throw new Error('Missing the imported breastplate');
  const { weapon: _bash, ...detail } = item.detail;
  return {
    _id: BREASTPLATE,
    ruleIdentity: BREASTPLATE,
    name: item.name,
    modifiers: [],
    detail,
  } as CharacterSheetCatalogEntry;
}

/** A Fighter of this level in a breastplate, ability scores 10, with an archetype or none: the armor's max Dex and penalty. */
function fighterInBreastplate(level: number, archetype?: string) {
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
          classEntryId: FIGHTER,
          position: index + 1,
          hpGained: 10,
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
    {
      _id: 'worn-armor',
      kind: 'item',
      active: true,
      catalogEntryId: BREASTPLATE,
      state: { kind: 'item' },
    },
  ];
  const { equipment } = calculateCharacterSheet({
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
      ...sheetCatalog(checked),
      breastplate(),
    ],
  });
  return {
    maxDex: equipment.maxDexterityBonus,
    // A penalty of 0 is stored as −0, as for any armor without one.
    acp: equipment.armorCheckPenalty || 0,
  };
}

describe('the structure records of two mechanical Fighter archetypes (archetype-fighter-1, #716)', () => {
  // Status-dependent: six read checked under the record step's two receipts, the other three drafted.
  it('are committed with exactly the reviewed descriptions, items and source hashes, six checked under their receipts and three drafted; the eight left out have none', () => {
    expect(featureRows).toHaveLength(9);
    expect(expected).toHaveLength(9);
    expect([...draftedKeys].sort()).toEqual([
      'everythingpath/fighter-mutation-warrior-mutagen-discovery',
      'everythingpath/fighter-thunderstriker-hardbuckler',
      'everythingpath/fighter-thunderstriker-strapped-shield',
    ]);
    for (const record of expected)
      expect(record.fields.description, record.externalKey).toMatch(
        /^At \d+(?:st|nd|rd|th) level\b.+\.$/,
      );
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
      expected.map((record) => ({
        ...record,
        ...(draftedKeys.has(record.externalKey)
          ? { status: 'drafted', receipt: undefined }
          : {
              status: 'checked',
              receipt: checkedOnR2.has(record.externalKey)
                ? RECEIPT_R2
                : RECEIPT,
            }),
        noMechanics: undefined,
      })),
    );
    expect(committed.filter(({ status }) => status === 'checked')).toHaveLength(
      6,
    );
    expect(
      (reviewedCuration.structures ?? []).filter(({ externalKey }) =>
        leftOut.some((key) => externalKey.startsWith(key)),
      ),
    ).toEqual([]);
  });

  it('describe features whose roots have no review item and whose mapper rows are the texts’ own', () => {
    for (const archetype of batch) {
      const detail = entryOf(base, rootKey(archetype))?.detail;
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
        featureChanges: featureChangesOf(archetype),
        adds: archetype.features.map((feature) => ({
          externalKey: featureKey(archetype, feature),
          classLevel: feature[2],
        })),
      });
      expect(
        ours(base.structure?.handReview ?? []).filter(
          ({ externalKey }) => externalKey === rootKey(archetype),
        ),
        archetype.name,
      ).toEqual([]);
    }
  });

  // Status-dependent: reads the six checked and three drafted records as committed.
  it('as committed, apply the six and admit their 6 of the 11 rows under #227 on PZO1129 or PZO1118; the three drafted features stay held on structure, and both roots are omitted behind them, the Thunderstriker’s also behind Weapon Training; no other key changes', () => {
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
    expect(committedAdmittedRows).toHaveLength(6);
    // Every one of the 11 rows, exactly.
    expect(
      Object.fromEntries(
        [...batchKeys].sort().map((key) => [key, after.get(key)]),
      ),
    ).toEqual(committedBatchOutcomes());
    for (const [key, outcome] of baseOutcomes)
      if (!batchKeys.has(key)) expect(after.get(key), key).toEqual(outcome);
    expect([...after.keys()].sort()).toEqual([...baseOutcomes.keys()].sort());
    for (const { externalKey, fields } of expected)
      if (!draftedKeys.has(externalKey)) {
        const entry = entryOf(asCommitted, externalKey);
        expect(entry?.description, externalKey).toBe(fields.description);
        expect(entry?.modifiers, externalKey).toEqual([]);
      }
  });

  it('drafted in memory, change no key: every feature stays held on structure, both roots omitted behind them', () => {
    expect(outcomes(asDrafted)).toEqual(baseOutcomes);
    expect(ours(asDrafted.structure?.applied ?? [])).toEqual([]);
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

  it('checked in memory, settle every gate and apply, admit 10 of the 11 rows under #227 on their declared books, the Thunderstriker’s root omitted behind Weapon Training and its parts at 13 and 17; no other key changes', () => {
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
    for (const [key, outcome] of baseOutcomes)
      if (!batchKeys.has(key)) expect(after.get(key), key).toEqual(outcome);
    expect([...after.keys()].sort()).toEqual([...baseOutcomes.keys()].sort());
    for (const { externalKey, fields } of expected) {
      const entry = entryOf(checked, externalKey);
      expect(entry?.description, externalKey).toBe(fields.description);
      expect(entry?.modifiers, externalKey).toEqual([]);
    }
  });

  it('checked in memory, leave the Fighter’s rows as they are: Weapon Training held, so the Thunderstriker’s root waits on it', () => {
    const after = outcomes(checked);
    // Weapon Training and its parts are not admitted (held on PZO9493's
    // owner-owed hold), nor is the Fighter class behind them. The
    // Thunderstriker replaces two of those parts, so its root waits on them
    // and on their feature; the Mutation Warrior replaces only admitted rows.
    for (const key of [
      FIGHTER,
      row('weaponTraining'),
      row('weaponTraining13'),
      row('weaponTraining17'),
    ])
      expect(after.get(key)?.kind, key).not.toBe('admitted');
    for (const key of [
      row('armorTraining'),
      row('armorTraining7'),
      row('armorTraining11'),
      row('armorTraining15'),
      row('armorMastery'),
    ])
      expect(after.get(key)?.kind, key).toBe('admitted');
    expect(after.get('everythingpath/fighter-thunderstriker')).toEqual({
      kind: 'dependentOmissions',
      reason: `Dependent omission: ${row('weaponTraining13')}, ${row('weaponTraining17')}, ${row('weaponTraining')}.`,
    });
  });

  it('checked in memory, take Armor Training with its row: a Fighter 4 or 8 of either archetype has the breastplate’s own max Dex and penalty', () => {
    expect(fighterInBreastplate(4)).toEqual({ maxDex: 4, acp: -3 });
    expect(fighterInBreastplate(8)).toEqual({ maxDex: 5, acp: -2 });
    for (const archetype of batch)
      for (const level of [4, 8])
        expect(
          fighterInBreastplate(level, rootKey(archetype)),
          `${archetype.name} ${level}`,
        ).toEqual({ maxDex: 3, acp: -4 });
  });
});
