// @vitest-environment node
// archetype-alchemist-1 (#716; docs/catalog-import/archetype-structures-659.md):
// the structure records of two mechanical Alchemist archetypes (#659), the
// Ragechemist of Ultimate Combat and the Winged Marauder of the Monster Codex,
// written drafted. One table holds the batch: each archetype's PCGen file,
// book and reviewed replacements, the review items its root record settles
// (the Ragechemist only), and each owned feature's level, source hash and the
// pinned PRD paragraphs its description is. Every record is description only
// or, on the root, the mapper's `detail.replaces` re-affirmed; none binds a
// number. All six were checked by the record step on one captured review
// (`RECEIPT`). The nine other candidates are left out (the report says why)
// and keep their state. Every case runs on the pinned tree.
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
const MC = 'roleplaying_game/monster_codex/mc_abilities_class.lst';
const CAC = 'player_companion/cohorts_and_companions/cac_abilities_class.lst';
const DH = 'player_companion/dungeoneers_handbook/dh_abilities_class.lst';
const FF = 'player_companion/familiar_folio/ff_abilities_class.lst';
const HHB = 'player_companion/healers_handbook/hhb_abilities_class.lst';
const OA = 'roleplaying_game/occult_adventures/oa_abilities_class.lst';
const ACG = 'roleplaying_game/advanced_class_guide/acg_abilities_class.lst';
const ARG = 'roleplaying_game/advanced_race_guide/arg_abilities_class.lst';
const ucPage = 'pages/ultimateCombat/classArchetypes/alchemist.html';
const mcPage = 'pages/monsterCodex/goblins.html';
/** The record step's receipt: the captured review that checked all six records. */
const RECEIPT =
  't3-review-2b6976d45da76e15a25be9006681ab6f5d45743c6d0543e2df22eadad92ba301';

const ALCHEMIST = 'pf1/JcaqlAawhf14q1lq';
/** The Alchemist's rows the two archetypes replace (Foundry ids). */
const alchemist = {
  mutagen: 'zrTVb83VhkFnEv6G',
  poisonUse: 'A54sLfcyoR5HGNbP',
  swiftPoisoning: 'FXjdFZlT0xiDr034',
  poisonImmunity: 'tflIOhX6ukxtwXLx',
  persistentMutagen: 'TeQgG1uEaWsMXBXX',
} as const;
type AlchemistRow = keyof typeof alchemist;
const row = (name: AlchemistRow) => `pf1/${alchemist[name]}`;

/**
 * The Alchemist class and the rows above with every pinned Foundry record
 * they link (`Compendium.pf1.<pack>.…<id>`), transitively, as far as the
 * pinned store holds them.
 */
async function alchemistClosure() {
  const packs = pinnedPath('pf1', 'packs');
  const byId = new Map<string, string>();
  for (const pack of await readdir(packs))
    for (const file of await readdir(join(packs, pack)).catch(() => []))
      byId.set(file.split('.').at(-2) ?? '', `packs/${pack}/${file}`);
  const files = new Set<string>();
  const queue: string[] = [ALCHEMIST.slice(4), ...Object.values(alchemist)];
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
  'roleplaying_game/monster_codex/_monster_codex.pcc',
  MC,
  'player_companion/cohorts_and_companions/_cohorts_and_companions.pcc',
  CAC,
  'player_companion/dungeoneers_handbook/_dungeoneers_handbook.pcc',
  DH,
  'player_companion/familiar_folio/_familiar_folio.pcc',
  FF,
  'player_companion/healers_handbook/_healers_handbook.pcc',
  HHB,
  'roleplaying_game/occult_adventures/_occult_adventures.pcc',
  OA,
  'roleplaying_game/advanced_class_guide/_advanced_class_guide.pcc',
  ACG,
  'roleplaying_game/advanced_race_guide/advanced_race_guide.pcc',
  ARG,
];
const tree = await materializePinnedTree([
  ...new Set([...ownerEmissionFoundryFiles, ...(await alchemistClosure())]),
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
  /** The feature's name in its PCGen KEY (`<archetype> ~ <name>`). */
  pcgenName: string,
  classLevel: number,
  sourceSha256: string,
  /** The PRD paragraphs (pinned page lines) its description is. */
  lines: readonly number[],
];
type Archetype = {
  /** PCGen's name: the record is `Alchemist Archetype ~ <name>`, a feature `<name> ~ <feature>`. */
  name: string;
  slug: string;
  file: string;
  page: string;
  book: string;
  /** The rows the archetype's own text replaces, whole, in the mapper's order. */
  replaces: readonly (readonly [AlchemistRow, number])[];
  /** The class skills the archetype's own text adds and removes (the mapper's, on the root). */
  classSkills?: { added: readonly string[]; removed: readonly string[] };
  /** The root record, when the root has review items: its source hash and the items it settles. */
  root?: {
    sourceSha256: string;
    resolves: readonly { kind: string; id: string }[];
  };
  features: readonly Feature[];
};

/** The batch, as the boundary and report give it (archetype-structures-659.md). */
const batch: readonly Archetype[] = [
  {
    name: 'Ragechemist',
    slug: 'ragechemist',
    file: UC,
    page: ucPage,
    book: 'PZO1118',
    replaces: [
      ['poisonUse', 2],
      ['swiftPoisoning', 6],
      ['poisonImmunity', 10],
    ],
    root: {
      sourceSha256:
        '2c675f23873628ddfdba90baff3f46945e5aea6789ff7b71b47585ca85693fd3',
      resolves: [{ kind: 'conflict', id: 'defect:poison-resistance-gates' }],
    },
    features: [
      [
        'rage-mutagen',
        'Rage Mutagen',
        2,
        '7ff77101441aef65789b344be7f1ec3f1510c5e5325c8273fbdd125c5fa24fa4',
        [367],
      ],
      [
        'sturdy-rage',
        'Sturdy Rage',
        6,
        '428747b7bfeb2d1a4ded813fd6bbdeacd2cbf67d00bc0e40837972e14933a48e',
        [368],
      ],
      [
        'lumbering-rage',
        'Lumbering Rage',
        10,
        '04df5bb113bc4abc0e7c58d9537ced0789fc590461728a62f1289b85331d106b',
        [369],
      ],
      [
        'discoveries',
        'Discoveries',
        1,
        'd07414e964d52c5abd84da39b0ed6a748a189dc13e9c013c8c79b2ca7c8a3355',
        [370],
      ],
    ],
  },
  {
    name: 'Winged Marauder',
    slug: 'winged-marauder',
    file: MC,
    page: mcPage,
    book: 'PZO1130',
    replaces: [
      ['mutagen', 1],
      ['persistentMutagen', 14],
    ],
    classSkills: {
      added: ['skill.acr', 'skill.han', 'skill.rid'],
      removed: ['skill.dev', 'skill.slt', 'skill.umd'],
    },
    features: [
      [
        'flying-beast-tamer',
        'Flying Beast Tamer',
        1,
        'd983475392c80cdbbefac78f571c2c7ba13dd7ea2822248f162b90303807f180',
        [376],
      ],
    ],
  },
];
/** The nine candidates left out, which keep their state. */
const leftOutSelectors = [
  [CAC, 'Construct Rider', 'construct-rider'],
  [DH, 'Blazing Torchbearer', 'blazing-torchbearer'],
  [FF, 'Homunculist', 'homunculist'],
  [OA, 'Promethean Alchemist', 'promethean-alchemist'],
  [ACG, 'Inspired Chemist', 'inspired-chemist'],
  [ARG, 'Bogborn Alchemist', 'bogborn-alchemist'],
  [ARG, 'Deep Bomber', 'deep-bomber'],
  [HHB, 'Sacrament Alchemist', 'sacrament-alchemist'],
  [UC, 'Beastmorph', 'beastmorph'],
] as const;
const leftOut = leftOutSelectors.map(
  ([, , slug]) => `everythingpath/alchemist-${slug}`,
);

const rootKey = ({ slug }: Archetype) => `everythingpath/alchemist-${slug}`;
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
async function prdText(page: string, lines: readonly number[]) {
  const text = (await readPinned('prd', page)).split('\n');
  return lines
    .map((line, index) => {
      let html = (text[line - 1] ?? '')
        .trim()
        .replace(/^<p[^>]*>/, '')
        .replace(/<\/p>$/, '')
        .trim();
      if (index === 0)
        html = html.replace(/^<(b|strong)>.*?<\/\1>\s*:?\s*/, '');
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
  ].map(([file, name]) => `${file}#Alchemist Archetype ~ ${name}`),
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
const drafted = await emit(withStructures(draftedInMemory));
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

/** A checked record's fields as the entry carries them; no record gives a number on the sheet. */
function expectApplied({ externalKey, fields }: (typeof expected)[number]) {
  const entry = entryOf(asCommitted, externalKey);
  expect(entry?.modifiers, externalKey).toEqual([]);
  if ('description' in fields)
    expect(entry?.description, externalKey).toBe(fields.description);
  else
    expect(entry?.detail, externalKey).toMatchObject({
      replaces: fields['detail.replaces'],
    });
}

/** The imported entries as a release prepares them for the sheet: the class with its class skills, its rows and the archetypes. */
function sheetCatalog(artifact: Artifact): CharacterSheetCatalogEntry[] {
  const byKey = new Map(
    artifact.catalog.entries.map((entry) => [entry.externalKey, entry]),
  );
  return artifact.catalog.entries.flatMap(
    (entry): CharacterSheetCatalogEntry[] => {
      const { detail } = importedCatalogEntrySchema.parse(entry);
      const base = {
        _id: entry.externalKey,
        ruleIdentity: entry.externalKey,
        name: entry.name,
        modifiers: [],
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
              // The release carries the class skills (`candidateClassDetail`).
              classSkills: detail.classSkills,
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
        return [{ ...base, detail: { kind: 'classFeature' } }];
      if (detail.kind === 'archetype')
        return [
          {
            ...base,
            detail: preparedArchetypeDetail(detail, (key) => ({
              id: key,
              ruleIdentity: key,
            })),
          },
        ];
      return [];
    },
  );
}

/** The six skills the Winged Marauder's class skills swap, as a skill rank records them. */
const swapped = ['acr', 'han', 'rid', 'dev', 'slt', 'umd'] as const;
/**
 * An Alchemist 1 with Intelligence 14 (6 ranks) and every other score 10,
 * one rank in each swapped skill, a Winged Marauder or not: each skill's total.
 */
function alchemistSkills(artifact: Artifact, archetype?: string) {
  const entries: SheetEntry[] = [
    {
      _id: 'base-row',
      kind: 'base',
      active: true,
      catalogEntryId: 'base',
      state: { kind: 'base' },
    },
    {
      _id: 'level-1',
      kind: 'classLevel',
      active: true,
      state: {
        kind: 'classLevel',
        classEntryId: ALCHEMIST,
        position: 1,
        hpGained: 8,
        skillRanks: Object.fromEntries(swapped.map((skill) => [skill, 1])),
      },
    },
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
  ];
  const { breakdowns } = calculateCharacterSheet({
    characterKind: 'pc',
    entries,
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base' as const,
          value: ability === 'intelligence' ? 14 : 10,
        })),
      },
      ...sheetCatalog(artifact),
    ],
  });
  return Object.fromEntries(
    swapped.map((skill) => [skill, breakdowns[`skill.${skill}`].total]),
  );
}

describe('the structure records of two mechanical Alchemist archetypes (archetype-alchemist-1, #716)', () => {
  it('are committed with exactly the reviewed fields, items and source hashes, all six checked by the record step; the nine left out have none', () => {
    expect(batchRows).toHaveLength(7);
    expect(expected).toHaveLength(6);
    for (const record of expected)
      if ('description' in record.fields)
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

  it('re-affirm on the root record exactly the rows the mapper emits', () => {
    for (const archetype of batch.filter(({ root }) => root)) {
      const detail = entryOf(base, rootKey(archetype))?.detail;
      if (detail?.kind !== 'archetype') throw new Error(`No ${archetype.name}`);
      expect(detail.replaces, archetype.name).toEqual(replacesOf(archetype));
    }
  });

  it('drafted in memory, change no key: every feature and the Ragechemist root stay held on structure, the Winged Marauder root omitted', () => {
    expect(outcomes(drafted)).toEqual(baseOutcomes);
    expect(ours(drafted.structure?.applied ?? [])).toEqual([]);
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

  it('as committed (checked by the record step), settle every gate and apply, and admit all 7 rows under #227 on their declared books; no other key changes', () => {
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
    for (const record of expected) expectApplied(record);
  });

  it('as committed, replace exactly the rows and class skills each archetype’s own text names, whole, and add its features at their levels', () => {
    for (const archetype of batch) {
      const detail = entryOf(asCommitted, rootKey(archetype))?.detail;
      if (detail?.kind !== 'archetype') throw new Error(`No ${archetype.name}`);
      expect(
        {
          replaces: detail.replaces,
          featureChanges: detail.featureChanges,
          adds: detail.adds,
          classSkillsAdded: detail.classSkillsAdded,
          classSkillsRemoved: detail.classSkillsRemoved,
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
        classSkillsAdded: archetype.classSkills?.added,
        classSkillsRemoved: archetype.classSkills?.removed,
      });
    }
  });

  it('as committed, give a winged marauder the +3 class-skill bonus on a trained Acrobatics, Handle Animal and Ride, and take it from Disable Device, Sleight of Hand and Use Magic Device', () => {
    // One rank and ability modifiers 0: a total is 1, or 4 as a class skill.
    expect(alchemistSkills(asCommitted)).toEqual({
      acr: 1,
      han: 1,
      rid: 1,
      dev: 4,
      slt: 4,
      umd: 4,
    });
    expect(
      alchemistSkills(asCommitted, 'everythingpath/alchemist-winged-marauder'),
    ).toEqual({ acr: 4, han: 4, rid: 4, dev: 1, slt: 1, umd: 1 });
  });
});
