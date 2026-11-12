// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  deriveCompanionSourceRules,
  type CompanionSheet,
} from '../../convex/lib/companionRelationshipGraph';
import { representativeArchetypeCatalog } from '../../convex/lib/representativeArchetypeCatalog';
import {
  representativeAdditionalClassFeatures,
  representativeClassCatalog,
  representativeClassFeatureSchedules,
} from '../../convex/lib/representativeClassCatalog';
import { parseCuration } from '../../scripts/catalog/curation';
import {
  locatorKeyOf,
  parseIdentityLedger,
} from '../../scripts/catalog/everythingpath-identities';
import ledgerData from '../../scripts/catalog/everythingpath-identities.json';
import {
  archetypeClassContext,
  mapArchetype,
  type ArchetypeMapping,
} from '../../scripts/catalog/pcgen/archetypes';
import { buildEffectiveView } from '../../scripts/catalog/pcgen/effective';
import {
  assignPcgenIdentities,
  pcgenBookFacts,
} from '../../scripts/catalog/pcgen/identities';
import { inventoryPcgen } from '../../scripts/catalog/pcgen/inventory';
import type { PcgenRecord } from '../../scripts/catalog/pcgen/lst';
import {
  allIncrementKeys,
  foundryAssociations,
  incrementEntries,
  reviewedSchedule,
  scheduleRows,
  unscheduledClass,
  type ClassSchedule,
} from '../../scripts/catalog/pcgen/schedules';
import { applyStructureCuration } from '../../scripts/catalog/structure-curation';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from '../../src/lib/character-sheet';
import {
  findShieldedMeld,
  findSynthesist,
} from '../../src/lib/character-sheet-combined-form';
import {
  getCompanionAllocationRule,
  getCompanionReductionRule,
  reduceProgressionLevel,
} from '../../src/lib/character-sheet-companion-sources';
import { readCompanionLinkedInput } from '../../src/lib/character-sheet-linked-inputs';
import { ruleKeyMatches } from '../../src/lib/character-sheet-rule-keys';
import { resolveCharacterSheetArchetypes } from '../../src/lib/character-sheet-archetypes';
import { preparedArchetypeDetail } from '../../src/lib/catalog/imported-archetype';
import { pcgen716IdentityFiles } from '../fixtures/pcgen-716/identity-files';
import { readPcgenFixtureTree } from './pcgen-716-tree';
import { readPinned } from './pinned-sources';

// #716 "Rule-keyed identities" (#741; research note 716-p6 §5): each of the
// sixteen archetypes the rules key on imports through the identity ledger,
// passes the structure gate, and keeps its rule on the Foundry `pf1/` base
// class. Ranger has P5's reviewed schedule, Druid, Hunter and Summoner P7a's,
// Monk P7b's and Investigator P7e's: there the mapper maps what each replaces
// onto the reviewed rows and the checked structure record binds them. The
// other classes don't yet (P7),
// so a checked structure record, bound to the archetype's PCGen hash, settles
// what each replaces with the values its seed cites
// (docs/catalog-import/archetypes.md, convex/lib/representativeArchetypeCatalog.ts).

const tree = await readPcgenFixtureTree(pcgen716IdentityFiles);
const view = buildEffectiveView(tree);
const inventory = inventoryPcgen(tree);
const reservedKeys = allIncrementKeys();
const ledger = parseIdentityLedger(ledgerData, { reservedKeys });
const identities = assignPcgenIdentities({
  inventory,
  view,
  ledger,
  books: pcgenBookFacts(await readPinned('pf1', 'module/registry/sources.mjs')),
  reservedKeys,
});
// A checked record names its review receipt (#757); these cases don't check
// receipts, so they cite #716 P6's rules review.
const reviewer = {
  reviewedBy: 'reviewer',
  reviewedOn: '2026-10-18',
  receipt: 'reviewer-20261018-081620-1216172',
};

/** Foundry v11.11 classes: key, file, PCGen class skills, skill ranks. */
const foundryClasses = {
  Druid: ['pf1/7eZQP0MzeO2svmVF', 'druid.7eZQP0MzeO2svmVF', 'druid'],
  Hunter: ['pf1/Immo2BuSe5WGdRW9', 'hunter.Immo2BuSe5WGdRW9', 'hunter'],
  Summoner: ['pf1/BrnHPJ2EVSQSyNQ8', 'summoner.BrnHPJ2EVSQSyNQ8', 'summoner'],
  Monk: ['pf1/W8dxwZ1CZiwLKsqr', 'monk.W8dxwZ1CZiwLKsqr', 'monk'],
  Witch: ['pf1/RC4D4WFT5kRKkdqp', 'witch.RC4D4WFT5kRKkdqp', 'witch'],
  Magus: ['pf1/xZLcyrEKYZoJPS2k', 'magus.xZLcyrEKYZoJPS2k', 'magus'],
  Investigator: [
    'pf1/s27zdYVFenYBVtfu',
    'investigator.s27zdYVFenYBVtfu',
    'investigator',
  ],
  Ranger: ['pf1/w3wjj6s3N69BsMc3', 'ranger.w3wjj6s3N69BsMc3', 'ranger'],
} as const;
type ClassName = keyof typeof foundryClasses;

/** The class's reviewed rows (P5, P7), else the Foundry class's first-acquisition rows. */
async function classRows(className: ClassName) {
  const reviewed = reviewedSchedule(className);
  if (reviewed)
    return scheduleRows(reviewed).map(({ classLevel, externalKey }) => ({
      classLevel,
      catalogEntryId: externalKey,
    }));
  const file = `packs/classes/${foundryClasses[className][1]}.yaml`;
  return foundryAssociations(file, await readPinned('pf1', file)).map(
    ({ level, externalKey }) => ({
      classLevel: level,
      catalogEntryId: externalKey,
    }),
  );
}

async function scheduleOf(className: ClassName): Promise<ClassSchedule> {
  const reviewed = reviewedSchedule(className);
  if (reviewed) return reviewed;
  const [classKey, file] = foundryClasses[className];
  const foundryFile = `packs/classes/${file}.yaml`;
  const text = await readPinned('pf1', foundryFile);
  const ranks = /^\s+skillsPerLevel: (\d+)$/m.exec(text);
  return unscheduledClass({
    className,
    classKey,
    foundryFile,
    skillRanksPerLevel: Number(ranks?.[1]),
    skillRanksAt: `${foundryFile}:${text.slice(0, ranks?.index).split('\n').length}`,
    classSkillsRecord: `Class Skills ~ ${className}`,
  });
}

const keyOf = (keys: ReadonlyMap<string, string>, record: PcgenRecord) => {
  const key = keys.get(
    locatorKeyOf({ source: 'pcgen', locator: record.locator }),
  );
  if (!key) throw new Error(`No key for ${record.locator.key}.`);
  return key;
};

type Imported = {
  mapping: ArchetypeMapping;
  report: ReturnType<typeof applyStructureCuration>;
};

/**
 * Imports one archetype through the ledger: its key and its features' keys
 * from the assignment, the mapper on its class's schedule, and checked
 * structure records bound to its source hash. `fields` are the reviewed
 * values; every review item and owned feature is settled but the
 * `unsettled` items, which stay held.
 */
async function importArchetype({
  ruleKey,
  className,
  fields,
  rationale,
  boundTo,
  unsettled = [],
}: {
  ruleKey: string;
  className: ClassName;
  fields: (mapping: ArchetypeMapping) => Record<string, unknown>;
  rationale: string;
  /** Review items no reviewed value settles yet. */
  unsettled?: readonly string[];
  /** The hash the archetype's record was reviewed at, if not the current one. */
  boundTo?: string;
}): Promise<Imported> {
  const owner = inventory.owners.find(
    ({ record }) =>
      identities.owners.keys.get(
        locatorKeyOf({ source: 'pcgen', locator: record.locator }),
      ) === `everythingpath/${ruleKey}`,
  );
  if (!owner) throw new Error(`The ledger keys no ${ruleKey}.`);
  const mapping = mapArchetype({
    context: archetypeClassContext({
      tree,
      view,
      schedule: await scheduleOf(className),
    }),
    record: owner.record,
    externalKey: keyOf(identities.owners.keys, owner.record),
    featureKeyOf: (feature) => keyOf(identities.features.keys, feature),
  });
  const { subject } = mapping;
  const record = {
    externalKey: subject.entry.externalKey,
    sourceSha256: boundTo ?? subject.sourceSha256,
    fields: fields(mapping),
    resolves: mapping.items
      .filter(
        ({ externalKey, id }) =>
          externalKey === subject.entry.externalKey && !unsettled.includes(id),
      )
      .map(({ kind, id }) => ({ kind, id })),
    status: 'checked',
    rationale,
    ...reviewer,
  };
  const features = mapping.features.map((feature) => {
    const own = mapping.items.filter(
      ({ externalKey, sourceSha256 }) =>
        externalKey === feature.entry.externalKey &&
        sourceSha256 === feature.sourceSha256,
    );
    const ownedFeature = { kind: 'ownedFeature', id: feature.locator };
    return {
      externalKey: feature.entry.externalKey,
      sourceSha256: feature.sourceSha256,
      ...(own.length
        ? {
            fields: { description: feature.entry.description },
            resolves: [
              ownedFeature,
              ...own.map(({ kind, id }) => ({ kind, id })),
            ],
          }
        : { fields: {}, noMechanics: true, resolves: [ownedFeature] }),
      status: 'checked',
      rationale: 'Its rules stay prose on the sheet, as the seed’s do.',
      ...reviewer,
    };
  });
  const report = applyStructureCuration({
    subjects: [subject, ...mapping.features],
    items: mapping.items,
    ownedFeatures: mapping.ownedFeatures,
    data: parseCuration({ records: [], structures: [record, ...features] }),
    variantDecisions: ledger.variantDecisions,
  });
  return { mapping, report };
}

const seedOf = (ruleIdentity: string) => {
  const seed = [
    ...representativeArchetypeCatalog,
    ...representativeAdditionalClassFeatures,
  ].find((entry) => entry.ruleIdentity === ruleIdentity);
  if (!seed) throw new Error(`No seed ${ruleIdentity}.`);
  return seed;
};
const seedDetail = (ruleIdentity: string) => {
  const { detail } = seedOf(ruleIdentity);
  if (detail?.kind !== 'archetype')
    throw new Error(`${ruleIdentity} is no archetype.`);
  return detail;
};

/** A seed's featureChanges, its seed feature identities named by their Foundry features. */
function foundryFeatureChanges(
  ruleIdentity: string,
  foundryOf: Readonly<Record<string, string>>,
) {
  return (seedDetail(ruleIdentity).featureChanges ?? []).map((change) => {
    const externalKey = foundryOf[change.featureIdentity];
    if (!externalKey) throw new Error(`No Foundry ${change.featureIdentity}.`);
    return change.scope === 'whole'
      ? { externalKey, scope: 'whole' as const }
      : {
          externalKey,
          scope: 'part' as const,
          classLevel: Number(change.part),
        };
  });
}

// The Foundry features the seeds' feature identities are, by the Foundry
// classes' links (packs/classes/<class>.yaml) and feature names.
const foundryFeatures = {
  'ranger-spells': 'pf1/Xi5BENHWBu1hLHKl',
  'witch-hex': 'pf1/GBkIhC1Bpp2MAD4e',
  'witch-familiar': 'pf1/3d9Rgw40NV8ohRtf',
  'witch-spells': 'pf1/K0Ls0j080ptiPvTC',
  'magus-spells': 'pf1/Bd6X95yJfPz6zPkP',
  'investigator-alchemy': 'pf1/gotW1ETzGrrwVtk2',
};

const feature = (key: string): CharacterSheetCatalogEntry => ({
  _id: key,
  ruleIdentity: key,
  name: key,
  modifiers: [],
  detail: { kind: 'classFeature' },
});

/** The Foundry class under its `pf1/` key, with the seed's class rules. */
async function foundryClass(className: ClassName) {
  const [classKey, , seedIdentity] = foundryClasses[className];
  const seed = representativeClassCatalog.find(
    ({ ruleIdentity }) => ruleIdentity === seedIdentity,
  );
  if (seed?.detail?.kind !== 'class')
    throw new Error(`No ${seedIdentity} seed.`);
  const rows = await classRows(className);
  const reviewed = reviewedSchedule(className);
  const increments = reviewed
    ? incrementEntries(reviewed).map(
        ({ externalKey, detail }): CharacterSheetCatalogEntry => ({
          ...feature(externalKey),
          detail:
            detail.kind === 'classFeature'
              ? {
                  kind: 'classFeature',
                  parentFeature: detail.parentFeature,
                  part: detail.part,
                }
              : { kind: 'classFeature' },
        }),
      )
    : [];
  return {
    classKey,
    entries: [
      {
        ...seed,
        _id: classKey,
        ruleIdentity: classKey,
        detail: { ...seed.detail, featuresByLevel: rows },
      } as CharacterSheetCatalogEntry,
      ...[...new Set(rows.map(({ catalogEntryId }) => catalogEntryId))]
        .filter((key) => !increments.some(({ _id }) => _id === key))
        .map(feature),
      ...increments,
    ],
  };
}

/** The imported archetype as the release converter prepares it for the sheet. */
function prepared(
  { mapping }: Imported,
  catalog: readonly CharacterSheetCatalogEntry[],
): CharacterSheetCatalogEntry[] {
  const { entry } = mapping.subject;
  if (entry.detail.kind !== 'archetype') throw new Error('Not an archetype.');
  const features = mapping.features.map(({ entry: owned }) =>
    feature(owned.externalKey),
  );
  const known = new Map(
    [...catalog, ...features].map((definition) => [definition._id, definition]),
  );
  return [
    {
      _id: entry.externalKey,
      ruleIdentity: entry.externalKey,
      name: entry.name,
      modifiers: [],
      detail: preparedArchetypeDetail(entry.detail, (key) => {
        const target = known.get(key) ?? feature(key);
        return {
          id: key,
          ruleIdentity: target.ruleIdentity,
          ...(target.detail?.kind === 'classFeature'
            ? {
                parentFeature: target.detail.parentFeature,
                part: target.detail.part,
              }
            : {}),
        };
      }),
    },
    ...features,
  ];
}

/** Class levels of one class, its Archetype Selections and the catalog. */
function sheet({
  classKey,
  levels,
  archetypes,
  catalog,
  entries = [],
}: {
  classKey: string;
  levels: number;
  archetypes: readonly string[];
  catalog: readonly CharacterSheetCatalogEntry[];
  entries?: SheetEntry[];
}): CharacterSheetInput {
  return {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      ...Array.from(
        { length: levels },
        (_, index): SheetEntry => ({
          _id: `level-${index + 1}`,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            classEntryId: classKey,
            position: index + 1,
            hpGained: 6,
          },
        }),
      ),
      ...archetypes.map(
        (key): SheetEntry => ({
          _id: `${key}-row`,
          kind: 'archetype',
          active: true,
          catalogEntryId: key,
          state: { kind: 'archetype' },
        }),
      ),
      ...entries,
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base' as const,
          value: 14,
        })),
      },
      ...catalog,
    ],
  };
}
const companionSheet = (input: CharacterSheetInput) =>
  ({
    entries: input.entries,
    catalogEntries: input.catalogEntries,
    calculated: calculateCharacterSheet(input),
  }) as unknown as CompanionSheet;
const classLevels = (input: CharacterSheetInput, classRuleIdentity: string) =>
  readCompanionLinkedInput({
    input: { kind: 'classLevels', classRuleIdentity },
    sheet: input,
    companionKind: 'animalCompanion',
  });
const levelSource = {
  key: 'class',
  label: 'Class',
  enabled: true,
  sheetEntryId: 'level-1',
};

/**
 * The rows the mapper replaces on the class's reviewed schedule (P7a): the
 * checked record binds them, as Beast Master's does on P5's ranger.
 */
/** The archetype's mapped feature changes (P7e). */
const readArchetypeChanges = (mapping: ArchetypeMapping) =>
  mapping.subject.entry.detail.kind === 'archetype'
    ? mapping.subject.entry.detail.featureChanges
    : undefined;

/** Feature changes with each feature's scope and part listed once, in order. */
function mergeFeatureChanges(
  changes: readonly NonNullable<
    ReturnType<typeof readArchetypeChanges>
  >[number][],
) {
  return [
    ...new Map(
      changes.map((change) => [JSON.stringify(change), change]),
    ).values(),
  ];
}

const mappedReplaces = (mapping: ArchetypeMapping) => ({
  'detail.replaces':
    mapping.subject.entry.detail.kind === 'archetype'
      ? mapping.subject.entry.detail.replaces
      : [],
});

/**
 * The rows of a P7a class's features an archetype's text replaces, reviewed
 * against the PRD where PCGen only marks a feature touched or removes more
 * than the text: each feature whole, from its first row.
 */
function reviewedReplaces(className: ClassName, ids: readonly string[]) {
  const reviewed = reviewedSchedule(className);
  return ids.map((id) => {
    const found = reviewed?.features.find((feature) => feature.id === id);
    if (!found) throw new Error(`No ${className} ${id}.`);
    return {
      classLevel: found.levels[0] ?? 1,
      externalKey: found.externalKey,
      scope: 'whole' as const,
    };
  });
}

/** The class rows an imported archetype replaces on the sheet, `[level, key]`. */
function replacedRows(input: CharacterSheetInput) {
  return (
    resolveCharacterSheetArchetypes(input).classes[0]?.archetypes[0]
      ?.replacements ?? []
  ).map(({ classLevel, catalogEntryId }) => [classLevel, catalogEntryId]);
}

/** The rows an imported archetype adds on the sheet, `[level, key]`. */
function addedRows(input: CharacterSheetInput) {
  return (
    resolveCharacterSheetArchetypes(input).classes[0]?.archetypes[0]
      ?.additions ?? []
  ).map(({ classLevel, catalogEntryId }) => [classLevel, catalogEntryId]);
}

/**
 * The Foundry summoner's rows each reviewed summoner archetype replaces on
 * the sheet, from the Foundry class links (summoner.BrnHPJ2EVSQSyNQ8.yaml)
 * and P7a's summon monster rows.
 */
const eidolonRow = [1, 'pf1/YmWKyC6bPUqHf9iQ'];
const lifeLinkRow = [1, 'pf1/xYuyemfGIFp0a97P'];
const bondSensesRow = [2, 'pf1/Aj7SwIo94HfcpR9R'];
const shieldAllyRow = [4, 'pf1/AaZ3OdpKFsMC6dFg'];
const makersCallRow = [6, 'pf1/Jw6BEoNMBxfSN4cu'];
const transpositionRow = [8, 'pf1/NAso2tQYl5bBfL1O'];
const greaterShieldAllyRow = [12, 'pf1/81XUmdEI8Yr0UXeG'];
const lifeBondRow = [14, 'pf1/ZF6FlGlFJRaiO4OH'];
const mergeFormsRow = [16, 'pf1/CW99G919xJkrIWAu'];
const summonerReplacedRows: Record<string, unknown[]> = {
  'summoner-broodmaster': [
    eidolonRow,
    lifeLinkRow,
    bondSensesRow,
    shieldAllyRow,
    makersCallRow,
    transpositionRow,
    greaterShieldAllyRow,
    lifeBondRow,
    mergeFormsRow,
  ],
  'summoner-master-summoner': [
    eidolonRow,
    [1, 'pf1/caNEmbCtoHA7NYtZ'],
    ...[3, 5, 7, 9, 11, 13, 15, 17, 19].map((level) => [
      level,
      `everythingpath/summoner-summon-monster-${level}`,
    ]),
    shieldAllyRow,
    bondSensesRow,
  ],
  'summoner-synthesist': [
    eidolonRow,
    bondSensesRow,
    lifeBondRow,
    lifeLinkRow,
    shieldAllyRow,
    makersCallRow,
    transpositionRow,
    greaterShieldAllyRow,
    mergeFormsRow,
  ],
};

/**
 * UM p.78 (ultimateMagic/spellcastingClassOptions/summoner.html:466): the
 * Broodmaster's features "with the same name as the standard summoner class
 * have slightly different rules, but otherwise work as and replace" those
 * features. PCGen grants only its Merge Forms (um_abilities_class.lst:1814);
 * the other five, each restricted to one eidolon of the brood (:468-471,
 * :474), are the PRD's. A reviewed record replaces each standard feature and
 * adds its Broodmaster version at the same level; the sheet's catalog supplies
 * each with the PRD's name and text.
 */
const broodmasterPage = await readPinned(
  'prd',
  'pages/ultimateMagic/spellcastingClassOptions/summoner.html',
);
const broodmasterVersions = (
  [
    ['bond-senses', 'bond-senses'],
    ['shield-ally', 'shield-ally'],
    ['makers-call', "maker's-call"],
    ['transposition', 'transposition'],
    ['greater-shield-ally', 'greater-shield-ally'],
  ] as const
).map(([id, anchor]) => {
  const standard = reviewedSchedule('Summoner')?.features.find(
    (scheduled) => scheduled.id === id,
  );
  const paragraph = new RegExp(
    `<p id="${anchor}"><b>(.+?) \\((?:Su|Ex)\\)</b>: (.+?)</p>`,
  ).exec(broodmasterPage);
  if (!standard || !paragraph) throw new Error(`No Broodmaster ${id}.`);
  const [, name = '', description = ''] = paragraph;
  return {
    standard,
    classLevel: standard.levels[0] ?? 1,
    externalKey: `everythingpath/summoner-broodmaster-${id}`,
    name,
    description,
  };
});

/**
 * The rows each reviewed summoner archetype adds on the sheet: PCGen's
 * grants at their levels (um_abilities_class.lst:1814-1817), and the
 * Broodmaster's restricted versions.
 */
const summonerAddedRows: Record<string, unknown[]> = {
  'summoner-broodmaster': [
    [2, 'everythingpath/summoner-broodmaster-eidolon-brood'],
    [2, 'everythingpath/summoner-broodmaster-brood-link'],
    [8, 'everythingpath/summoner-broodmaster-larger-brood'],
    [14, 'everythingpath/summoner-broodmaster-brood-bond'],
    [16, 'everythingpath/summoner-broodmaster-merge-forms'],
    [2, 'everythingpath/summoner-broodmaster-bond-senses'],
    [4, 'everythingpath/summoner-broodmaster-shield-ally'],
    [6, 'everythingpath/summoner-broodmaster-makers-call'],
    [8, 'everythingpath/summoner-broodmaster-transposition'],
    [12, 'everythingpath/summoner-broodmaster-greater-shield-ally'],
  ],
  'summoner-master-summoner': [
    [1, 'everythingpath/summoner-master-summoner-lesser-eidolon'],
    [1, 'everythingpath/summoner-master-summoner-summoning-mastery'],
    [12, 'everythingpath/summoner-shield-ally'],
  ],
  'summoner-synthesist': [
    [1, 'everythingpath/summoner-synthesist-fused-eidolon'],
    [1, 'everythingpath/summoner-synthesist-fused-link'],
    [2, 'everythingpath/summoner-synthesist-evasion'],
    [4, 'everythingpath/summoner-synthesist-shielded-meld'],
    [6, 'everythingpath/summoner-synthesist-makers-jump'],
    [12, 'everythingpath/summoner-synthesist-greater-shielded-meld'],
    [16, 'everythingpath/summoner-synthesist-split-forms'],
  ],
};

/** A pinned Foundry record's `_id` and name (Foundry v11.11 packs). */
async function foundryRecord(file: string) {
  const text = await readPinned('pf1', file);
  return {
    key: `pf1/${/^_id: (\w+)$/m.exec(text)?.[1]}`,
    name: /^name: (.+)$/m.exec(text)?.[1],
  };
}

// #741: the Foundry records `character-sheet-rule-keys.ts` aliases are the
// pinned ones, and each monk links its own flurry at 1st level.
describe('the rule-key aliases are the pinned Foundry records', () => {
  it.each([
    ['ranger', 'packs/classes/ranger.w3wjj6s3N69BsMc3.yaml', 'Ranger'],
    ['druid', 'packs/classes/druid.7eZQP0MzeO2svmVF.yaml', 'Druid'],
    ['hunter', 'packs/classes/hunter.Immo2BuSe5WGdRW9.yaml', 'Hunter'],
    ['summoner', 'packs/classes/summoner.BrnHPJ2EVSQSyNQ8.yaml', 'Summoner'],
    ['monk', 'packs/classes/monk.W8dxwZ1CZiwLKsqr.yaml', 'Monk'],
    [
      'unchained-monk',
      'packs/classes/monk-unchained.5mQIOIw4hDhlREPo.yaml',
      'Monk (Unchained)',
    ],
    [
      'monk-flurry',
      'packs/class-abilities/flurry-of-blows.JKJoHy5NveXGaZqv.yaml',
      'Flurry of Blows',
    ],
    [
      'unchained-monk-flurry',
      'packs/class-abilities/flurry-of-blows-uc.TaBxJdJQp5SFDPyn.yaml',
      'Flurry of Blows (UC)',
    ],
  ])('%s is %s', async (ruleKey, file, name) => {
    const record = await foundryRecord(file);
    expect(record.name).toBe(name);
    expect(ruleKeyMatches(record.key, ruleKey)).toBe(true);
  });

  it('links each monk’s own flurry at 1st level', async () => {
    for (const [file, flurry] of [
      ['packs/classes/monk.W8dxwZ1CZiwLKsqr.yaml', 'pf1/JKJoHy5NveXGaZqv'],
      [
        'packs/classes/monk-unchained.5mQIOIw4hDhlREPo.yaml',
        'pf1/TaBxJdJQp5SFDPyn',
      ],
    ] as const)
      expect(
        foundryAssociations(file, await readPinned('pf1', file)).filter(
          ({ level }) => level === 1,
        ),
      ).toContainEqual(expect.objectContaining({ externalKey: flurry }));
  });
});

describe('companion rules on the Foundry classes (#410, #419–#421)', () => {
  it('Beast Master: everythingpath/ranger-beast-master divides ranger level − 3, the full level from 12th', async () => {
    // APG p.124. The reviewed Ranger schedule maps it (P5). Foundry's
    // combat style feat counts every bonus feat from the ranger level
    // (combat-style-feat.BO7BEFHDcf6qBaYV.yaml:14), so the 6th-level part it
    // replaces leaves that count too high: no reviewed value settles it yet,
    // and the archetype stays held on that conflict alone.
    const beastMaster = await importArchetype({
      ruleKey: 'ranger-beast-master',
      className: 'Ranger',
      fields: (mapping) => ({
        'detail.replaces':
          mapping.subject.entry.detail.kind === 'archetype'
            ? mapping.subject.entry.detail.replaces
            : [],
      }),
      rationale:
        'APG p.124: Animal Companion replaces hunter’s bond, Improved Empathic Link the 6th-level combat style feat, Strong Bond camouflage.',
      unsettled: ['partialFormula:combat-style-feat'],
    });
    expect(beastMaster.report.held).toEqual([
      'everythingpath/ranger-beast-master',
    ]);
    expect(
      beastMaster.report.handReview.map(({ kind, id, text }) => [
        kind,
        id,
        text.includes('combat-style-feat.BO7BEFHDcf6qBaYV.yaml:14'),
      ]),
    ).toEqual([['conflict', 'partialFormula:combat-style-feat', true]]);
    // Its companion rule applies to the identity all the same.
    const ranger = await foundryClass('Ranger');
    const catalog = [...ranger.entries];
    const archetype = prepared(beastMaster, catalog);
    for (const [levels, budget] of [
      [7, 4],
      [12, 12],
    ] as const) {
      const input = sheet({
        classKey: ranger.classKey,
        levels,
        archetypes: ['everythingpath/ranger-beast-master'],
        catalog: [...catalog, ...archetype],
      });
      expect(
        deriveCompanionSourceRules({
          kind: 'animalCompanion',
          source: { ...levelSource, sheetEntryId: 'level-1' } as never,
          sheet: companionSheet(input),
        }),
      ).toEqual({ ruleKind: 'beastMasterCompanion' });
      const ranks = classLevels(input, 'ranger');
      expect(ranks).toEqual({ kind: 'available', value: levels });
      expect(
        getCompanionAllocationRule('beastMasterCompanion').budget(levels),
      ).toBe(budget);
    }
  });

  it('druid-pack-lord on the Foundry Druid divides its class level', async () => {
    const imported = await importArchetype({
      ruleKey: 'druid-pack-lord',
      className: 'Druid',
      fields: mappedReplaces,
      rationale:
        'UM p.38: Pack Bond replaces nature bond; the 6th-level wild shape row goes as PCGen names it (DruidWildShape6).',
      // Foundry's wild shape counts every use from the druid level
      // (wild-shape.sJdBOE9lwz5XAkUi.yaml:82), so the removed 6th-level row
      // leaves the uses too high: no reviewed value settles it yet.
      unsettled: ['partialFormula:wild-shape'],
    });
    // P7a's reviewed schedule maps what it replaces; only the unsettled item
    // holds it, and its companion rule applies all the same.
    expect(imported.report.held).toEqual(['everythingpath/druid-pack-lord']);
    expect(imported.report.handReview.map(({ id }) => id)).toEqual([
      'partialFormula:wild-shape',
    ]);
    const druid = await foundryClass('Druid');
    const input = sheet({
      classKey: druid.classKey,
      levels: 6,
      archetypes: ['everythingpath/druid-pack-lord'],
      catalog: [...druid.entries, ...prepared(imported, druid.entries)],
    });
    expect(
      deriveCompanionSourceRules({
        kind: 'animalCompanion',
        source: levelSource as never,
        sheet: companionSheet(input),
      }),
    ).toEqual({ ruleKind: 'packLordCompanion' });
    expect(classLevels(input, 'druid')).toEqual({
      kind: 'available',
      value: 6,
    });
    expect(getCompanionAllocationRule('packLordCompanion').budget(6)).toBe(6);
  });

  it('hunter-packmaster on the Foundry Hunter divides its class level and keeps its teamwork feats, altered', async () => {
    // ACG p.96 (advancedClassGuide/classOptions/hunter.html:371-377): Pack
    // Bond replaces animal companion, Pack Focus animal focus, Second Pack
    // Focus second animal focus and Master of the Pack master hunter; its
    // Teamwork Feat "alters teamwork feat" (:375), where PCGen removes the
    // teamwork feats whole (FACT:Hunter_CF_TeamworkFeats|true,
    // acg_abilities_class.lst:4642).
    const imported = await importArchetype({
      ruleKey: 'hunter-packmaster',
      className: 'Hunter',
      fields: (mapping) => ({
        'detail.replaces': reviewedReplaces('Hunter', [
          'animal-companion',
          'animal-focus',
          'second-animal-focus',
          'master-hunter',
        ]),
        'detail.featureChanges':
          mapping.subject.entry.detail.kind === 'archetype'
            ? mapping.subject.entry.detail.featureChanges
            : [],
      }),
      rationale:
        'ACG p.96: Pack Bond, Pack Focus, Second Pack Focus and Master of the Pack replace animal companion, animal focus, second animal focus and master hunter; Teamwork Feat alters teamwork feat, which keeps its rows.',
    });
    expect(imported.report.passed).toBe(true);
    const { detail } = imported.mapping.subject.entry;
    if (detail.kind !== 'archetype') throw new Error('Not an archetype.');
    // The alteration stays a change of the whole feature, with no
    // replacement.
    expect(detail.featureChanges).toContainEqual({
      externalKey: 'pf1/Rh0LztkmetWVC6jk',
      scope: 'whole',
    });
    const hunter = await foundryClass('Hunter');
    const input = sheet({
      classKey: hunter.classKey,
      levels: 6,
      archetypes: ['everythingpath/hunter-packmaster'],
      catalog: [...hunter.entries, ...prepared(imported, hunter.entries)],
    });
    expect(replacedRows(input)).toEqual([
      [1, 'pf1/V7cGG7vKN0BY2Bhb'],
      [1, 'pf1/4r83TfLHXrRmXtIn'],
      [8, 'pf1/5BQFf6N973yHrGtk'],
      [20, 'pf1/uOQAy8ijKtqOj14V'],
    ]);
    expect(
      deriveCompanionSourceRules({
        kind: 'animalCompanion',
        source: levelSource as never,
        sheet: companionSheet(input),
      }),
    ).toEqual({ ruleKind: 'packmasterCompanion' });
    expect(classLevels(input, 'hunter')).toEqual({
      kind: 'available',
      value: 6,
    });
    expect(getCompanionAllocationRule('packmasterCompanion').budget(6)).toBe(6);
  });

  it('reads the Broodmaster’s restricted features from the PRD, each named as the summoner feature it replaces', () => {
    // UM p.78 (ultimateMagic/spellcastingClassOptions/summoner.html:468-471,
    // :474), at the summoner's levels (APG summoner.html:358).
    expect(
      broodmasterVersions.map(({ name, standard, classLevel }) => [
        name.replace("'", '’'),
        standard.name,
        classLevel,
      ]),
    ).toEqual([
      ['Bond Senses', 'Bond Senses', 2],
      ['Shield Ally', 'Shield Ally', 4],
      ['Maker’s Call', 'Maker’s Call', 6],
      ['Transposition', 'Transposition', 8],
      ['Greater Shield Ally', 'Greater Shield Ally', 12],
    ]);
    for (const { description } of broodmasterVersions)
      expect(description).toMatch(/eidolons? in (the|his) brood/);
  });

  it.each([
    [
      'summoner-broodmaster',
      'broodmasterEidolon',
      // UM p.78 (ultimateMagic/spellcastingClassOptions/summoner.html:465,
      // :467, :475, :476); its other same-named features replace the
      // standard ones too (:466), each by its restricted version
      // (`broodmasterVersions`).
      'UM p.78: Eidolon Brood replaces the eidolon, Brood Link life link, Brood Bond life bond; its Merge Forms, Bond Senses, Shield Ally, Maker’s Call, Transposition and Greater Shield Ally replace the standard features of those names.',
      [
        'eidolon',
        'life-link',
        'bond-senses',
        'shield-ally',
        'makers-call',
        'transposition',
        'greater-shield-ally',
        'life-bond',
        'merge-forms',
      ],
      broodmasterVersions,
    ],
    [
      'summoner-master-summoner',
      'masterSummonerEidolon',
      // UM p.80 (summoner.html:484-486). Summoning Mastery replaces "the
      // summoner's normal summon monster I ability", read as the ability, as
      // PCGen removes it (Summoner_CF_SummonMonster,
      // um_abilities_class.lst:2712); the text replaces no greater shield
      // ally, which PCGen removes too.
      'UM p.80: Lesser Eidolon replaces the eidolon, Summoning Mastery summon monster and shield ally, Augment Summoning bond senses.',
      ['eidolon', 'summon-monster', 'shield-ally', 'bond-senses'],
      [],
    ],
    [
      'summoner-synthesist',
      'synthesistEidolon',
      // UM pp.80–81 (summoner.html:491, :493-498).
      'UM pp.80–81: Fused Eidolon replaces the eidolon, bond senses and life bond; Fused Link life link; Shielded Meld shield ally; Maker’s Jump maker’s call and transposition; Greater Shielded Meld greater shield ally; Split Forms merge forms.',
      [
        'eidolon',
        'bond-senses',
        'life-bond',
        'life-link',
        'shield-ally',
        'makers-call',
        'transposition',
        'greater-shield-ally',
        'merge-forms',
      ],
      [],
    ],
  ] as const)(
    '%s on the Foundry summoner replaces the eidolon and reads it as %s',
    async (ruleKey, ruleKind, rationale, replaced, versions) => {
      const imported = await importArchetype({
        ruleKey,
        className: 'Summoner',
        fields: ({ subject: { entry } }) => ({
          'detail.replaces': reviewedReplaces('Summoner', replaced),
          // The restricted versions the PRD adds, after PCGen's grants.
          ...(versions.length > 0 && entry.detail.kind === 'archetype'
            ? {
                'detail.adds': [
                  ...entry.detail.adds,
                  ...versions.map(({ classLevel, externalKey }) => ({
                    classLevel,
                    externalKey,
                  })),
                ],
              }
            : {}),
        }),
        rationale,
      });
      expect(imported.report.passed).toBe(true);
      // PCGen only marks the eidolon touched (FACT:Summoner_Archetype_Eidolon,
      // um_abilities_class.lst:2710-2713); the text replaces it.
      expect(
        imported.mapping.items.some(({ id }) => id === 'alters:eidolon'),
      ).toBe(true);
      const summoner = await foundryClass('Summoner');
      const input = sheet({
        classKey: summoner.classKey,
        levels: 12,
        archetypes: [`everythingpath/${ruleKey}`],
        catalog: [
          ...summoner.entries,
          ...prepared(imported, summoner.entries),
          ...versions.map(
            ({
              externalKey,
              name,
              description,
            }): CharacterSheetCatalogEntry => ({
              ...feature(externalKey),
              name,
              description,
            }),
          ),
        ],
      });
      expect(replacedRows(input)).toEqual(summonerReplacedRows[ruleKey]);
      expect(addedRows(input)).toEqual(summonerAddedRows[ruleKey]);
      expect(
        deriveCompanionSourceRules({
          kind: 'eidolon',
          source: levelSource as never,
          sheet: companionSheet(input),
        }),
      ).toEqual({ ruleKind });
      expect(classLevels(input, 'summoner')).toEqual({
        kind: 'available',
        value: 12,
      });
    },
  );

  it('holds an archetype whose checked record was reviewed at another hash: the normal stale gate', async () => {
    const stale = await importArchetype({
      ruleKey: 'druid-pack-lord',
      className: 'Druid',
      fields: mappedReplaces,
      rationale: 'UM p.38: Pack Bond replaces nature bond.',
      boundTo: '0'.repeat(64),
    });
    expect(stale.report.passed).toBe(false);
    expect(stale.report.stale.map(({ externalKey }) => externalKey)).toEqual([
      'everythingpath/druid-pack-lord',
    ]);
    expect(stale.report.held).toEqual(['everythingpath/druid-pack-lord']);
  });

  it('Master Summoner halves the Foundry summoner level', () => {
    // "A master summoner's class level is halved (minimum 1)" (UM p.80).
    expect(
      reduceProgressionLevel(
        12,
        getCompanionReductionRule('masterSummonerEidolon').steps,
      ).effectiveLevel,
    ).toBe(6);
  });

  it('Synthesist: the Foundry summoner’s Combined Form, with both Shielded Meld keys', async () => {
    const synthesist = await importArchetype({
      ruleKey: 'summoner-synthesist',
      className: 'Summoner',
      fields: mappedReplaces,
      rationale: 'UM pp.80–81: the fused statistics alone are calculated.',
    });
    const summoner = await foundryClass('Summoner');
    const catalog = [
      ...summoner.entries,
      ...prepared(synthesist, summoner.entries),
    ];
    // Ultimate Magic p. 81: Shielded Meld (4th) +2, Greater (12th) +4.
    for (const [levels, meld] of [
      [4, { name: 'Shielded Meld', value: 2 }],
      [12, { name: 'Greater Shielded Meld', value: 4 }],
    ] as const) {
      const input = sheet({
        classKey: summoner.classKey,
        levels,
        archetypes: ['everythingpath/summoner-synthesist'],
        catalog,
      });
      const calculated = calculateCharacterSheet(input);
      expect(findSynthesist({ input, calculated })).toEqual({
        classRuleIdentity: 'pf1/BrnHPJ2EVSQSyNQ8',
        isUnchained: false,
        summonerLevel: levels,
      });
      expect(findShieldedMeld({ input, calculated })).toEqual(meld);
    }
  });
});

describe('Zen Archer on the Foundry monk (#414)', () => {
  it('everythingpath/monk-zen-archer leaves Foundry’s flurry Grant dormant, so a core flurry option warns', async () => {
    // APG p.115: Zen Archer ~ Flurry of Blows replaces the monk's
    // (FACT:Monk_CF_FlurryOfBlows|true, apg_abilities_class.lst:3688). P7b's
    // reviewed Monk schedule maps what it replaces, each a whole feature the
    // PRD says it replaces (advancedPlayersGuide/coreClasses/monk.html:421-430);
    // its Ki Pool adds to the monk's (:426), an alteration.
    const zenArcher = await importArchetype({
      ruleKey: 'monk-zen-archer',
      className: 'Monk',
      fields: (mapping) => {
        const { detail } = mapping.subject.entry;
        if (detail.kind !== 'archetype') throw new Error('Not an archetype.');
        return {
          ...mappedReplaces(mapping),
          // Its Ki Pool, granted at 4th, alters the monk's ki pool.
          'detail.adds': detail.adds,
          'detail.featureChanges': [
            ...(detail.featureChanges ?? []),
            { externalKey: 'pf1/2Og23i3rRXu5QQlg', scope: 'whole' },
          ],
        };
      },
      rationale:
        'APG p.115: the zen archer flurries only with a bow, and his flurry replaces the monk’s; his bonus feats, Perfect Strike, Way of the Bow, Zen Archery, Point Blank Master, Ki Arrows, Reflexive Shot, Trick Shot and Ki Focus Bow replace the bonus feats, stunning fist, evasion, maneuver training, still mind, purity of body, improved evasion, diamond body and tongue of the sun and moon; his Ki Pool, at 4th, adds to the monk’s ki pool: an alteration of it, no replacement. The rest stays prose, as the seed’s does.',
    });
    expect(zenArcher.report.passed).toBe(true);
    expect(
      mappedReplaces(zenArcher.mapping)['detail.replaces'].map(
        ({ classLevel, externalKey, scope }) => [
          classLevel,
          externalKey,
          scope,
        ],
      ),
    ).toEqual([
      [1, 'pf1/VjHjPja5QABBgRvR', 'whole'],
      [1, 'pf1/2ausI8g6SsmbOpgF', 'whole'],
      [2, 'pf1/KQYCRLEdD4bGA5ak', 'whole'],
      [3, 'pf1/E7enBZN7FCsoyIof', 'whole'],
      [3, 'pf1/8VUae7CIgCidvSfg', 'whole'],
      [5, 'pf1/82G7gl4C1AvtSHI4', 'whole'],
      [9, 'pf1/Cc2eFfhJYlClCGEH', 'whole'],
      [11, 'pf1/nRffrQSKTqjeBAO5', 'whole'],
      [17, 'pf1/NKzRm45051DUHkd5', 'whole'],
      [1, 'pf1/JKJoHy5NveXGaZqv', 'whole'],
    ]);
    expect(zenArcher.mapping.items.map(({ id }) => id)).toEqual([
      'alters:ki-pool',
    ]);
    // Each removal is a replacement the PRD's Zen Archer states.
    const zenArcherText = (
      await readPinned(
        'prd',
        'pages/advancedPlayersGuide/coreClasses/monk.html',
      )
    )
      .split('\n')
      .slice(420, 430)
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .toLowerCase();
    expect(zenArcherText).toContain(
      "these feats replace the monk's normal bonus feats",
    );
    for (const replaced of [
      'stunning fist',
      'evasion',
      'maneuver training',
      'still mind',
      'purity of body',
      'improved evasion',
      'diamond body',
      'tongue of the sun and moon',
    ])
      expect(zenArcherText).toContain(`this ability replaces ${replaced}.`);
    const monk = await foundryClass('Monk');
    // Foundry's flurry, its key and name from the pinned record, with the
    // seeded core flurry's rules.
    const pinnedFlurry = await foundryRecord(
      'packs/class-abilities/flurry-of-blows.JKJoHy5NveXGaZqv.yaml',
    );
    const flurry = {
      ...seedOf('monk-flurry'),
      _id: pinnedFlurry.key,
      ruleIdentity: pinnedFlurry.key,
      name: pinnedFlurry.name,
    } as CharacterSheetCatalogEntry;
    const catalog = [
      ...monk.entries.filter(({ _id }) => _id !== flurry._id),
      flurry,
    ];
    const routine: SheetEntry = {
      _id: 'routine',
      kind: 'attackRoutine',
      active: true,
      state: {
        kind: 'attackRoutine',
        name: 'Fists',
        weaponEntryId: 'unarmed',
        hands: 'one',
        mode: 'melee',
        options: [flurry._id],
      },
    };
    const run = (archetypes: readonly string[]) =>
      calculateCharacterSheet(
        sheet({
          classKey: monk.classKey,
          levels: 2,
          archetypes,
          catalog: [...catalog, ...prepared(zenArcher, catalog)],
          entries: [routine],
        }),
      ).attackRoutines.find(({ entryId }) => entryId === 'routine');
    // Without the archetype the Foundry flurry is the core flurry, its BAB
    // the monk level in place of the Foundry monk's own row (CRB p.57).
    const core = run([]);
    expect(core?.flurry).toMatchObject({ version: 'core', monkLevel: 2 });
    const monkRows = (core?.full ?? []).map(({ attackBonus }) =>
      attackBonus.applied
        .filter(
          ({ sheetEntryId }) =>
            sheetEntryId === 'builtin:class:pf1/W8dxwZ1CZiwLKsqr',
        )
        .map(({ value }) => value),
    );
    expect(monkRows).toEqual([[2], [2]]);
    const zen = run(['everythingpath/monk-zen-archer']);
    expect(zen?.flurry).toBeNull();
    expect(
      zen?.warnings.find(({ check }) => check === 'missingRoutineOption')
        ?.message,
    ).toBe(
      "Flurry of Blows is switched on in Fists, but the class feature doesn't count on this sheet. It has no effect until it does.",
    );
  });
});

// #422's specimens (docs/catalog-import/archetypes.md:138–164): each casting
// change and each published conflict pair resolves on the Foundry class as
// the seeded specimen does on the seeded class.
describe('#422 casting specimens on the Foundry classes', () => {
  const specimens = {
    'ranger-skirmisher': [
      'Ranger',
      'APG p.128: no spells or spellcasting ability.',
    ],
    'ranger-dandy': [
      'Ranger',
      'UI p.41: Charisma, the bard list, a medium’s table.',
    ],
    'witch-seducer': ['Witch', 'LotFW p.16: Charisma replaces Intelligence.'],
    'witch-ley-line-guardian': [
      'Witch',
      'OA p.125: a sorcerer’s table, spontaneous.',
    ],
    'witch-mountain-witch': [
      'Witch',
      'ACG p.132: alters hex, replaces the 2nd-level hex.',
    ],
    'magus-eldritch-scion': ['Magus', 'ACG p.104: Charisma, a bard’s table.'],
    'magus-mindblade': ['Magus', 'OA p.121: psychic spells, a bard’s table.'],
    'investigator-questioner': [
      'Investigator',
      'MagTT p.26: arcane spells from the bard list.',
    ],
    'investigator-psychic-detective': [
      'Investigator',
      'OA pp.119–120: psychic spells.',
    ],
  } as const;
  type Specimen = keyof typeof specimens;

  // Occult Adventures p.120: the Psychic Detective's own spell levels have
  // no field in the imported casting change, so its casting stays held on
  // `castingContract` (archetypes.ts) and no record binds it.
  const contractHeld: readonly Specimen[] = ['investigator-psychic-detective'];
  const castingOfSeed = (ruleKey: Specimen) =>
    contractHeld.includes(ruleKey) ? undefined : seedDetail(ruleKey).casting;
  // ACG p.104: the eldritch scion's spell combat, improved spell combat and
  // greater spell combat each "alters" the magus's
  // (advancedClassGuide/classOptions/magus.html:363, :365-366), granted as
  // same-named records (acg_abilities_class.lst:3380-3383): on #772's
  // reviewed Magus, each alteration with the records' levels.
  const reviewedAlterations: Partial<Record<Specimen, readonly string[]>> = {
    'magus-eldritch-scion': [
      'pf1/lj4yLDvoxGFHiwSk',
      'pf1/G1z392b58wRybqjL',
      'pf1/nWDMATASYzzAShr6',
    ],
  };
  async function importSpecimen(ruleKey: Specimen) {
    const [className, rationale] = specimens[ruleKey];
    return await importArchetype({
      ruleKey,
      className,
      fields: (mapping) => ({
        // On a reviewed schedule (P5's ranger, P7e's investigator) the
        // mapped rows; else none, as the seed's.
        'detail.replaces': reviewedSchedule(className)
          ? mappedReplaces(mapping)['detail.replaces']
          : [],
        // The seed's changes, and on a reviewed schedule every change the
        // mapper finds besides (Questioner's alterations of inspiration and
        // the investigator talents, magtt_abilities_class.lst:113, :116).
        'detail.featureChanges': mergeFeatureChanges([
          ...foundryFeatureChanges(ruleKey, foundryFeatures),
          ...(reviewedSchedule(className)
            ? (readArchetypeChanges(mapping) ?? [])
            : []),
          ...(reviewedAlterations[ruleKey] ?? []).map((externalKey) => ({
            externalKey,
            scope: 'whole' as const,
          })),
        ]),
        ...(reviewedAlterations[ruleKey] &&
        mapping.subject.entry.detail.kind === 'archetype'
          ? { 'detail.adds': mapping.subject.entry.detail.adds }
          : {}),
        ...(castingOfSeed(ruleKey)
          ? { 'detail.casting': castingOfSeed(ruleKey) }
          : {}),
      }),
      rationale,
      unsettled: contractHeld.includes(ruleKey) ? ['castingContract'] : [],
    });
  }

  it.each(
    (Object.keys(specimens) as Specimen[]).filter(
      (key) => !contractHeld.includes(key),
    ),
  )(
    '%s imports through the ledger and the gate with its seed’s casting change',
    async (ruleKey) => {
      const imported = await importSpecimen(ruleKey);
      expect(imported.report.passed).toBe(true);
      const { detail } = imported.mapping.subject.entry;
      expect(imported.mapping.subject.entry.externalKey).toBe(
        `everythingpath/${ruleKey}`,
      );
      expect(detail.kind === 'archetype' ? detail.casting : null).toEqual(
        seedDetail(ruleKey).casting,
      );
    },
  );

  it('holds everythingpath/investigator-psychic-detective on its casting until the import contract carries its own spell levels', async () => {
    const imported = await importSpecimen('investigator-psychic-detective');
    expect(imported.report.held).toEqual([
      'everythingpath/investigator-psychic-detective',
    ]);
    expect(
      imported.report.handReview.map(({ kind, id, fields }) => [
        kind,
        id,
        fields,
      ]),
    ).toEqual([
      // P7e's reviewed Investigator: its alchemy, a casting row, is touched,
      // and no record binding its casting can settle that yet.
      ['uncheckedCasting', 'casting:alchemy', ['detail.casting']],
      ['uncheckedCasting', 'castingContract', ['detail.casting.spellList.add']],
    ]);
    // The seed's eleven own spell levels (OA p.120) are what is waiting.
    expect(
      seedDetail('investigator-psychic-detective').casting?.spellList?.add,
    ).toHaveLength(11);
    const { detail } = imported.mapping.subject.entry;
    expect(detail.kind === 'archetype' ? detail.casting : null).toBeUndefined();
  });

  /** One class's casting and archetype results for some specimens. */
  async function castingOf(
    className: ClassName,
    keys: readonly Specimen[],
    imported: boolean,
  ) {
    const [, , seedIdentity] = foundryClasses[className];
    if (!imported) {
      const seed = representativeClassCatalog.find(
        ({ ruleIdentity }) => ruleIdentity === seedIdentity,
      );
      const catalog = [
        {
          ...seed,
          _id: seedIdentity,
          detail: {
            ...seed?.detail,
            featuresByLevel:
              representativeClassFeatureSchedules[seedIdentity] ?? [],
          },
        } as CharacterSheetCatalogEntry,
        ...representativeArchetypeCatalog,
        ...representativeAdditionalClassFeatures,
      ];
      return summarize(
        calculateCharacterSheet(
          sheet({
            classKey: seedIdentity,
            levels: 8,
            archetypes: keys,
            catalog,
          }),
        ),
        seedIdentity,
      );
    }
    const { calculated, classKey } = await calculateImportedSheet({
      className,
      keys,
    });
    return summarize(calculated, classKey);
  }
  /** The imported specimens on the Foundry class, through the sheet's calculation. */
  async function calculateImportedSheet({
    className,
    keys,
  }: {
    className: ClassName;
    keys: readonly Specimen[];
  }) {
    const base = await foundryClass(className);
    const archetypes = await Promise.all(keys.map(importSpecimen));
    const catalog = [
      ...base.entries,
      ...archetypes.flatMap((archetype) => prepared(archetype, base.entries)),
    ];
    return {
      classKey: base.classKey,
      calculated: calculateCharacterSheet(
        sheet({
          classKey: base.classKey,
          levels: 8,
          archetypes: keys.map((key) => `everythingpath/${key}`),
          catalog,
        }),
      ),
    };
  }
  function summarize(
    calculated: ReturnType<typeof calculateCharacterSheet>,
    classEntryId: string,
  ) {
    const spellcasting = calculated.spellcastings.find(
      (row) => row.classEntryId === classEntryId,
    );
    return {
      present: spellcasting !== undefined,
      // The effective casting: kind, ability, recording, list and the table's
      // progression of castable levels, spells per day and spells known.
      casting: spellcasting && {
        type: spellcasting.type,
        spellKind: spellcasting.spellKind,
        ability: spellcasting.ability,
        record: spellcasting.record,
        cantrips: spellcasting.cantrips,
        classTag: spellcasting.spellList.classTag,
        castableSpellLevels: spellcasting.castableSpellLevels,
        slots: spellcasting.slots.map(({ spellLevel, base, known }) => [
          spellLevel,
          base,
          known,
        ]),
        unresolved: spellcasting.unresolved,
      },
      properties: (spellcasting?.castingProperties ?? []).map(
        ({ key, status, sources, candidates }) => [
          key,
          status,
          sources.map(({ name }) => name),
          candidates.map(({ name, value }) => [name, value]),
        ],
      ),
      conflicts: calculated.archetypes.classes
        .flatMap(({ conflicts }) => conflicts)
        .map(({ part }) => (part === null ? 'whole' : 'part')),
      warnings: [
        ...new Set(
          calculated.warnings
            .map(({ check }) => check)
            .filter((check) => check.startsWith('archetype')),
        ),
      ].sort(),
    };
  }

  it('binds the investigator specimens’ replacements on P7e’s reviewed Investigator rows', async () => {
    // MagTT p.26: Questioner's spells replace alchemy, and PCGen removes
    // poison lore (magtt_abilities_class.lst:105). OA p.120: Psychic
    // Detective replaces alchemy, the 3rd-level talent, poison lore, poison
    // resistance, swift alchemy and poison immunity.
    const listReplacedRows = async (ruleKey: Specimen) =>
      mappedReplaces((await importSpecimen(ruleKey)).mapping)[
        'detail.replaces'
      ].map(({ classLevel, externalKey, scope }) => [
        classLevel,
        externalKey,
        scope,
      ]);
    expect(await listReplacedRows('investigator-questioner')).toEqual([
      [1, 'pf1/gotW1ETzGrrwVtk2', 'whole'],
      [2, 'pf1/C7UgLJt7yRHnAqyG', 'whole'],
    ]);
    expect(await listReplacedRows('investigator-psychic-detective')).toEqual([
      [3, 'pf1/AOnFqb1h3gXbFUup', 'part'],
      [2, 'pf1/C7UgLJt7yRHnAqyG', 'whole'],
      [2, 'pf1/2qcz39w9O2Qlms0Q', 'whole'],
      [4, 'pf1/kEVqxs23oyNDxbc1', 'whole'],
      [11, 'pf1/tflIOhX6ukxtwXLx', 'whole'],
      [1, 'pf1/gotW1ETzGrrwVtk2', 'whole'],
    ]);
  });

  it('on the Foundry Investigator, Questioner × Psychic Detective still conflict on alchemy, as the seeded pair does, and on poison lore and the talents', async () => {
    // Both replace alchemy (MagTT p.26; OA p.120): the published conflict
    // pair of the #422 specimens (note 716-p7-rules §4, item 4).
    const keys = [
      'investigator-questioner',
      'investigator-psychic-detective',
    ] as const;
    const seeded = await castingOf('Investigator', keys, false);
    expect(seeded.conflicts).toEqual(['whole']);
    expect(seeded.warnings).toContain('archetypeConflict');
    // Imported, both also replace poison lore (magtt_abilities_class.lst:105;
    // OA p.120), and Questioner's whole alteration of the investigator
    // talents (:116) conflicts with Psychic Detective's replacement of the
    // 3rd-level talent (PRD #251 decision 7: a whole-feature alteration
    // conflicts with any affected part).
    const { calculated } = await calculateImportedSheet({
      className: 'Investigator',
      keys,
    });
    expect(
      calculated.archetypes.classes
        .flatMap(({ conflicts }) => conflicts)
        .map(({ featureIdentity, part }) => [featureIdentity, part]),
    ).toEqual([
      ['pf1/gotW1ETzGrrwVtk2', null],
      ['pf1/AOnFqb1h3gXbFUup', null],
      ['pf1/C7UgLJt7yRHnAqyG', null],
    ]);
    expect(calculated.warnings.map(({ check }) => check)).toContain(
      'archetypeConflict',
    );
  });

  it('gives the Foundry witch the Seducer’s Charisma and the Ley Line Guardian’s sorcerer table', async () => {
    // LotFW p.16 (Otherworldly Allure) and OA p.125 (Ley Line Powered).
    const { casting } = await castingOf(
      'Witch',
      ['witch-seducer', 'witch-ley-line-guardian'],
      true,
    );
    expect(casting).toMatchObject({
      ability: 'charisma',
      type: 'spontaneous',
      record: 'known',
      classTag: 'witch',
    });
  });

  it.each([
    ['Witch', ['witch-seducer']],
    ['Investigator', ['investigator-questioner']],
    ['Ranger', ['ranger-skirmisher', 'ranger-dandy']],
    ['Witch', ['witch-mountain-witch', 'witch-seducer']],
  ] as const)(
    'on the Foundry %s, %j resolve as the seeded specimens do',
    async (className, keys) => {
      const seeded = await castingOf(className, keys, false);
      expect(seeded.present).toBe(true);
      expect(await castingOf(className, keys, true)).toEqual(seeded);
    },
  );

  it('on the Foundry Witch, Seducer and Ley Line Guardian resolve as the seeded specimens do, conflicting on the familiar and spells besides the hexes the seeds name', async () => {
    // #771B's reviewed Witch maps every feature their flags change
    // (pcgen-schedules-mystery-hex.test.ts): both remove the 1st- and
    // 8th-level hexes, and Seducer's archetype marks also touch the familiar
    // and spells (lotfw_abilities_class.lst:294), which Ley Line Guardian
    // replaces and alters (occultAdventures/archetypes/other.html:617, :619).
    // The Seducer seed names only its hexes
    // (docs/catalog-import/archetypes.md:154): a review item, not a seed
    // rewrite.
    const keys = ['witch-seducer', 'witch-ley-line-guardian'] as const;
    const seeded = await castingOf('Witch', keys, false);
    expect(seeded.present).toBe(true);
    expect(seeded.conflicts).toEqual(['part', 'part']);
    expect(await castingOf('Witch', keys, true)).toEqual({
      ...seeded,
      conflicts: ['whole', 'part', 'part', 'whole'],
    });
  });

  it('on the Foundry Magus, Eldritch Scion and Mindblade resolve as the seeded specimens do, conflicting on more features than the seeds name', async () => {
    // #772's reviewed Magus maps every feature their flags and text change
    // (pcgen-schedules-judgment-arcana.test.ts): besides the spells, both
    // replace arcane pool, spell recall and knowledge pool, and Mindblade
    // replaces the improved and greater spell combat Eldritch Scion alters.
    // The seeds name only the spells (docs/catalog-import/archetypes.md:145-146):
    // a review item, not a seed rewrite.
    const keys = ['magus-eldritch-scion', 'magus-mindblade'] as const;
    const seeded = await castingOf('Magus', keys, false);
    expect(seeded.present).toBe(true);
    expect(seeded.conflicts).toEqual(['whole']);
    expect(await castingOf('Magus', keys, true)).toEqual({
      ...seeded,
      conflicts: Array.from({ length: 6 }, () => 'whole'),
    });
  });
});
