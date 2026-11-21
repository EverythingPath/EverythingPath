// archetype-paladin-1 (#716; docs/catalog-import/archetype-structures-684.md):
// the structure records of two mechanical Paladin archetypes (#684), written
// drafted: Divine Defender of the Advanced Player's Guide and Holy Tactician
// of Ultimate Combat; the record step checked all nine on a captured review.
// One table holds the batch: each archetype's PCGen file,
// book and reviewed replacements, and each owned feature's levels, source
// hash, the text its record binds (the PRD paragraphs) and the feat slot it
// gives. No root has a review item; Holy Tactician's root record binds
// detail.adds so Tactical Acumen's bonus feats are slots the sheet counts
// (fix r1). The nine other candidates, Oath against Chaos and Divine Hunter
// among them since fix r1, are left out (the report says why) and keep their
// state. Every case runs on the pinned tree.
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
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import type {
  CharacterSheetCatalogEntry,
  CharacterSheetInput,
} from '../../src/lib/character-sheet';
import { resolveCharacterSheetSelectionRules } from '../../src/lib/character-sheet-selection-rules';
import {
  ownerEmissionFoundryFiles,
  pcgenOwnerEmissionFiles,
} from '../fixtures/pcgen-716/owner-emission-files';
import {
  materializePinnedTree,
  pinnedPath,
  readPinned,
} from './pinned-sources';

const ISC = 'campaign_setting/inner_sea_combat/isc_abilities_class.lst';
const APG = 'roleplaying_game/advanced_players_guide/apg_abilities_class.lst';
const UC = 'roleplaying_game/ultimate_combat/uc_abilities_class.lst';
const UM = 'roleplaying_game/ultimate_magic/um_abilities_class.lst';
const KOTIS =
  'player_companion/knights_of_the_inner_sea/kotis_abilities_class.lst';
const HA = 'roleplaying_game/horror_adventures/ha_abilities_class.lst';
const apgPage = 'pages/advancedPlayersGuide/coreClasses/paladin.html';
const ucPage = 'pages/ultimateCombat/classArchetypes/paladin.html';
/** The record step's receipt: the captured review that checked all nine records. */
const RECEIPT =
  't3-review-d752c96b6febaf800c1a94be65ddb766b91ba8f7e1a9fe3d1ca0145485b3dc43';

/** The Paladin's rows the archetypes replace (Foundry ids). */
const paladin = {
  detectEvil: '2YqtYAfLcV7KWkpJ',
  smiteEvil: '2TsDfK0SKC8IGVx4',
  auraOfCourage: 'RNIkkvqaq2iVrahs',
  divineHealth: 'C5tWPm12qyz5ND9u',
  mercy: 'Er8h3fZ2edJEviTv',
  channelPositiveEnergy: 'tHObxrPeyhimmz9V',
  divineBond: 'z4NJaCcj9VZpBv7d',
  auraOfResolve: 'jiBCmy0kP1Uwaz0D',
  auraOfJustice: 'wHfy3OJmTimVgXuO',
  auraOfFaith: 'cUv3fmnuhtQjgQM5',
  holyChampion: 'BPRtCoYTMDwsITXJ',
} as const;
type PaladinRow = keyof typeof paladin;
const row = (name: PaladinRow) => `pf1/${paladin[name]}`;
/** A part's own row: the schedule's increment entry of that level. */
const partRows: Partial<Record<PaladinRow, string>> = {
  mercy: 'everythingpath/paladin-mercy',
};

/**
 * The Paladin class and the rows above with every pinned Foundry record they
 * link (`Compendium.pf1.<pack>.…<id>`), transitively. Without them the class
 * and those rows fail on unresolved references and the archetypes are omitted
 * behind them.
 */
async function paladinClosure() {
  const packs = pinnedPath('pf1', 'packs');
  const byId = new Map<string, string>();
  for (const pack of await readdir(packs))
    for (const file of await readdir(join(packs, pack)).catch(() => []))
      byId.set(file.split('.').at(-2) ?? '', `packs/${pack}/${file}`);
  const files = new Set<string>();
  const queue: string[] = ['ohptcds1d5oG6Bjh', ...Object.values(paladin)];
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
  'campaign_setting/inner_sea_combat/_inner_sea_combat.pcc',
  ISC,
  'roleplaying_game/advanced_players_guide/advanced_players_guide.pcc',
  APG,
  'roleplaying_game/ultimate_combat/_ultimate_combat.pcc',
  UC,
  'roleplaying_game/ultimate_magic/_ultimate_magic.pcc',
  UM,
  'player_companion/knights_of_the_inner_sea/_knights_of_the_inner_sea.pcc',
  KOTIS,
  'roleplaying_game/horror_adventures/_horror_adventures.pcc',
  HA,
];
const tree = await materializePinnedTree([
  ...new Set([...ownerEmissionFoundryFiles, ...(await paladinClosure())]),
  ...[...new Set(pcgenFiles)].map(
    (path) => `pcgen/${pcgenPin.directory}/${path}`,
  ),
]);
afterAll(() => tree.dispose());

const remaps: unknown = JSON.parse(
  await readFile('scripts/catalog/reviewed-remaps.json', 'utf8'),
);

/** What a feature's record binds as its description: the feature's paragraphs on the archetype's PRD page. */
type Text = { prd: readonly number[] };
type Feature = readonly [
  slug: string,
  /** The feature's name in its PCGen KEY (`<archetype> ~ <name>`). */
  pcgenName: string,
  /** The levels the archetype adds it at: the first is PCGen's PRECLASS; more need a root record. */
  classLevels: readonly number[],
  sourceSha256: string,
  text: Text,
  /** The feat types of the one feat slot each of its rows gives (`grantsSlots`). */
  slotFeatTypes?: readonly string[],
];
/** A replaced row and its level; `part` for one increment of the row. */
type Replacement = readonly [PaladinRow, number, 'part'?];
type Archetype = {
  /** PCGen's name: the record is `Paladin Archetype ~ <name>`, a feature `<name> ~ <feature>`. */
  name: string;
  slug: string;
  file: string;
  book: string;
  page: string;
  /** The root record's source hash, where one binds `detail.adds`. */
  rootSha256?: string;
  /** The rows the archetype's own text replaces, in the mapper's order. */
  replaces: readonly Replacement[];
  /** The owned features, in the mapper's order of additions. */
  features: readonly Feature[];
};
const prd = (...prdLines: number[]): Text => ({ prd: prdLines });

/** The batch, as the boundary and report give it (archetype-structures-684.md). */
const batch: readonly Archetype[] = [
  {
    name: 'Divine Defender',
    slug: 'divine-defender',
    file: APG,
    book: 'PZO1115',
    page: apgPage,
    replaces: [
      ['mercy', 3],
      ['divineBond', 5],
    ],
    features: [
      [
        'shared-defense',
        'Shared Defense',
        [3],
        'e29d84f68caededee153978be66efc9124a5552321ef8dc90759eab5f303e1b3',
        prd(351),
      ],
      [
        'divine-bond',
        'Divine Bond',
        [5],
        'b59915b7e8103782930622a18e37ae5ebd194a1999f4e6ca8779ede66ea9de92',
        prd(352, 353),
      ],
    ],
  },
  {
    name: 'Holy Tactician',
    slug: 'holy-tactician',
    file: UC,
    book: 'PZO1118',
    page: ucPage,
    // Fix r1: binds detail.adds, Tactical Acumen at its five levels.
    rootSha256:
      '84f470e2b24ba8013cbbb400f635462e5fc1360a46662a0e088e9df3395cd1fb',
    replaces: [
      ['smiteEvil', 1],
      ['divineHealth', 3],
      ['divineBond', 5],
      ['holyChampion', 20],
      ['auraOfJustice', 11],
      ['auraOfResolve', 8],
      ['auraOfCourage', 3],
    ],
    features: [
      [
        'weals-champion',
        "Weal's Champion",
        [1],
        'fcf52974f14454c9a29d2b3cb6deb40ea717e87ce18650f479d1373118ec0db7',
        prd(380, 381, 382),
      ],
      [
        'tactical-acumen',
        'Tactical Acumen',
        // PRD :383: at 3rd, "an additional bonus feat for every four levels
        // attained after 3rd, to a maximum of five bonus feats at 19th level".
        [3, 7, 11, 15, 19],
        '073da7b9a98737905c48bb76b1f3cd86dee6e659f7ad66c0a1047063ddde1b74',
        prd(383),
        ['Teamwork'],
      ],
      [
        'battlefield-presence',
        'Battlefield Presence',
        [3],
        '1fc58b5a5f592d442ace05e0517c2f2d0bbfe6c59472a8db4e87c54ce9f79cc5',
        prd(384),
      ],
      [
        'guide-the-battle',
        'Guide The Battle',
        [8],
        '8c748a4da92f95586915713e6c41d247e23ff056edcbad5ce69dc860af923474',
        prd(385),
      ],
      [
        'weals-wrath',
        "Weal's Wrath",
        [11],
        '89a6f69e27cf12f128dfe31ccbdb9c5c68ab059c7e9094079ab4b625dd1596c7',
        prd(386),
      ],
      [
        'masterful-presence',
        'Masterful Presence',
        [20],
        '41617d3fea11bf8bc2dfc5fd9b70788ebf4fad7cb94146cdec2bf2b8f52e359c',
        prd(387),
      ],
    ],
  },
];
/** The nine candidates left out, which keep their state. */
const leftOutSelectors = [
  // Fix r1: Oath Spells adds four spells to the paladin's list, which the
  // imported casting change can't carry; Precise Shot grants a feat and
  // removes heavy armor proficiency, which no record field can bind.
  [ISC, 'Oath against Chaos', 'oath-against-chaos'],
  [UC, 'Divine Hunter', 'divine-hunter'],
  [ISC, 'Oath against Grotesquery', 'oath-against-grotesquery'],
  [KOTIS, 'Combat Healer Squire', 'combat-healer-squire'],
  [HA, 'Soul Sentinel', 'soul-sentinel'],
  [UC, 'Empyreal Knight', 'empyreal-knight'],
  [UC, 'Holy Gun', 'holy-gun'],
  [UM, 'Oath of Charity', 'oath-of-charity'],
  [UM, 'Oath of Vengeance', 'oath-of-vengeance'],
] as const;
const leftOut = leftOutSelectors.map(
  ([, , slug]) => `everythingpath/paladin-${slug}`,
);

const rootKey = ({ slug }: Archetype) => `everythingpath/paladin-${slug}`;
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

const selected = new Set(
  [
    ...batch.map(({ file, name }) => [file, name] as const),
    ...leftOutSelectors.map(([file, name]) => [file, name] as const),
  ].map(([file, name]) => `${file}#Paladin Archetype ~ ${name}`),
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

/** The additions a root gives: each feature at each of its levels, in the mapper's order. */
const addsOf = (archetype: Archetype) =>
  archetype.features.flatMap((feature) =>
    feature[2].map((classLevel) => ({
      externalKey: featureKey(archetype, feature),
      classLevel,
    })),
  );
/** A feature's slots as its record binds them: one feat slot of its types. */
const slotsOf = (feature: Feature) =>
  feature[5]
    ? [{ kind: 'feat', count: 1, featTypes: [...feature[5]] }]
    : undefined;

/** The records the table gives, rationale aside. */
const expected = [
  ...batch.flatMap((archetype) =>
    archetype.rootSha256
      ? [
          {
            externalKey: rootKey(archetype),
            sourceSha256: archetype.rootSha256,
            fields: { 'detail.adds': addsOf(archetype) } as Record<
              string,
              unknown
            >,
            resolves: [] as { kind: string; id: string }[],
          },
        ]
      : [],
  ),
  ...(await Promise.all(
    batch.flatMap((archetype) =>
      archetype.features.map(async (feature) => {
        const grantsSlots = slotsOf(feature);
        return {
          externalKey: featureKey(archetype, feature),
          sourceSha256: feature[3],
          fields: {
            description: await prdText(archetype.page, feature[4].prd),
            ...(grantsSlots ? { grantsSlots } : {}),
          } as Record<string, unknown>,
          resolves: [{ kind: 'ownedFeature', id: locator(archetype, feature) }],
        };
      }),
    ),
  )),
].sort((a, b) => (a.externalKey < b.externalKey ? -1 : 1));
const featureRecords = new Set(
  batch.flatMap((archetype) =>
    archetype.features.map((feature) => featureKey(archetype, feature)),
  ),
);

/** A level of Paladin with one archetype, on the sheet: the Paladin's feature rows and the archetype as the release converter prepares them. */
function paladinSheet(
  artifact: Artifact,
  archetype: Archetype,
  level: number,
): CharacterSheetInput {
  const paladinKey = 'pf1/ohptcds1d5oG6Bjh';
  const classDetail = entryOf(artifact, paladinKey)?.detail;
  const root = entryOf(artifact, rootKey(archetype));
  if (classDetail?.kind !== 'class' || root?.detail.kind !== 'archetype')
    throw new Error(`No Paladin or ${archetype.name}`);
  const feature = (key: string): CharacterSheetCatalogEntry => {
    const entry = entryOf(artifact, key);
    const detail = entry?.detail;
    return {
      _id: key,
      ruleIdentity: key,
      name: entry?.name ?? key,
      modifiers: [],
      detail:
        detail?.kind === 'classFeature'
          ? {
              kind: 'classFeature',
              parentFeature: detail.parentFeature,
              part: detail.part,
            }
          : { kind: 'classFeature' },
      ...(entry?.grantsSlots ? { grantsSlots: entry.grantsSlots } : {}),
    };
  };
  const catalog = new Map(
    [
      ...classDetail.featuresByLevel.map(({ externalKey }) => externalKey),
      ...root.detail.adds.map(({ externalKey }) => externalKey),
    ].map((key) => [key, feature(key)]),
  );
  const prepared: CharacterSheetCatalogEntry = {
    _id: root.externalKey,
    ruleIdentity: root.externalKey,
    name: root.name,
    modifiers: [],
    detail: preparedArchetypeDetail(root.detail, (key) => {
      const target = catalog.get(key);
      return {
        id: key,
        ruleIdentity: key,
        ...(target?.detail?.kind === 'classFeature'
          ? {
              parentFeature: target.detail.parentFeature,
              part: target.detail.part,
            }
          : {}),
      };
    }),
  };
  return {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        active: true,
        kind: 'base',
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      ...Array.from({ length: level }, (_, index) => ({
        _id: `level-${index + 1}`,
        kind: 'classLevel' as const,
        active: true as const,
        state: {
          kind: 'classLevel' as const,
          classEntryId: paladinKey,
          position: index + 1,
          hpGained: 10,
        },
      })),
      {
        _id: 'selection',
        kind: 'archetype',
        catalogEntryId: prepared._id,
        active: true,
        state: { kind: 'archetype' },
      },
    ],
    catalogEntries: [
      { _id: 'base', ruleIdentity: 'base', modifiers: [] },
      {
        _id: paladinKey,
        ruleIdentity: paladinKey,
        name: 'Paladin',
        modifiers: [],
        detail: {
          kind: 'class',
          classKind: 'base',
          tag: 'paladin',
          hitDie: 10,
          bab: 'full',
          saves: { fort: 'good', ref: 'poor', will: 'good' },
          skillRanksPerLevel: 2,
          featuresByLevel: classDetail.featuresByLevel.map(
            ({ classLevel, externalKey }) => ({
              classLevel: Number(classLevel),
              catalogEntryId: externalKey,
            }),
          ),
        },
      },
      ...catalog.values(),
      prepared,
    ],
  };
}
/** The bonus feat slots a sheet gives, as their feat types. */
const bonusFeatSlots = (input: CharacterSheetInput) =>
  resolveCharacterSheetSelectionRules(input)
    .slots.filter((slot) => slot.kind === 'feat' && slot.grantedBy)
    .flatMap((slot) => Array(slot.count).fill(slot.featTypes ?? []));

describe('the structure records of two mechanical Paladin archetypes (archetype-paladin-1, #716)', () => {
  it('are committed with exactly the reviewed descriptions, slots, additions, items and source hashes, all nine checked by the record step; the nine left out have none', () => {
    expect(batchRows).toHaveLength(10);
    expect(expected).toHaveLength(9);
    expect(
      committed.map((record) => ({
        externalKey: record.externalKey,
        sourceSha256: record.sourceSha256,
        fields: record.fields,
        noMechanics: record.noMechanics,
        resolves: record.resolves,
        status: record.status === 'checked' ? record.receipt : record.status,
      })),
    ).toEqual(
      expected.map((record) => ({
        ...record,
        noMechanics: undefined,
        // Status-dependent: the record step checked them on this receipt.
        status: RECEIPT,
      })),
    );
    expect(
      (reviewedCuration.structures ?? []).filter(({ externalKey }) =>
        leftOut.some((key) => externalKey.startsWith(key)),
      ),
    ).toEqual([]);
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
      expect(['held', 'dependentOmissions'], key).toContain(
        baseOutcomes.get(key)?.kind,
      );
  });

  // Status-dependent: as committed, the record step has checked all nine.
  it('as committed (checked by the record step), settle every gate and apply, and admit all 10 rows under #227 on their declared books; no other key changes', () => {
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
    for (const record of expected.filter(({ externalKey }) =>
      featureRecords.has(externalKey),
    ))
      expect(
        entryOf(asCommitted, record.externalKey),
        record.externalKey,
      ).toMatchObject({
        ...record.fields,
        detail: { kind: 'classFeature' },
        // No record gives a Modifier.
        modifiers: [],
      });
  });

  // Status-dependent: the checked records apply.
  it('as committed, replace exactly the rows each archetype’s own text names and add its features at their levels', () => {
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
        replaces: archetype.replaces.map(([name, classLevel, part]) => ({
          externalKey: part ? `${partRows[name]}-${classLevel}` : row(name),
          classLevel,
          scope: part ?? 'whole',
        })),
        featureChanges: archetype.replaces.map(([name, classLevel, part]) =>
          part
            ? { externalKey: row(name), scope: part, classLevel }
            : { externalKey: row(name), scope: 'whole' },
        ),
        adds: addsOf(archetype),
      });
    }
  });

  // Status-dependent: the checked records apply.
  it('as committed, give a Paladin of each archetype one feat slot of the feature’s types per row reached and no other bonus feat slot (Tactical Acumen: one Teamwork slot at 3rd, two at 7th … five at 19th)', () => {
    for (const archetype of batch)
      for (let level = 1; level <= 20; level += 1)
        expect(
          bonusFeatSlots(paladinSheet(asCommitted, archetype, level)),
          `${archetype.name} ${level}`,
        ).toEqual(
          archetype.features.flatMap((feature) =>
            feature[5]
              ? feature[2]
                  .filter((classLevel) => classLevel <= level)
                  .map(() => feature[5])
              : [],
          ),
        );
    const holyTactician = batch.find(({ slug }) => slug === 'holy-tactician');
    if (!holyTactician) throw new Error('No Holy Tactician');
    expect(
      [2, 3, 6, 7, 10, 11, 14, 15, 18, 19, 20].map(
        (level) =>
          bonusFeatSlots(paladinSheet(asCommitted, holyTactician, level))
            .length,
      ),
    ).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    // Drafted in memory, the records give no slot.
    expect(bonusFeatSlots(paladinSheet(drafted, holyTactician, 20))).toEqual(
      [],
    );
  });
});
