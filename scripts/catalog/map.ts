import type { z } from 'zod';
import { selectionImportRule } from './selection-import-rules.ts';
import { mapPrerequisites } from './prerequisites.ts';
import type { Prerequisite } from '../../src/lib/character-sheet-prerequisites.ts';
import knownNoticeHolds from './legal/known-notice-holds.json';
import { knownNoticeHoldReason } from './legal/notice-clearances.ts';
import {
  importedCatalogEntrySchema,
  type fieldProvenanceSchema,
} from '../../src/lib/catalog/imported-entry-schema.ts';
import {
  isRulesJournalLink,
  sourceDescription,
  sourceBody,
  uuidKey,
  toExternalKey,
  type SourceRecord,
  type LoadedRecord,
  type Unsupported,
} from './records.ts';
export { upstreamRecord, toExternalKey, type LoadedRecord } from './records.ts';
import {
  detailMappers,
  mapItemArmorBonus,
  type PreviewDetail,
} from './details.ts';
import {
  readObject,
  readArray,
  readText,
  runtimeSkillKey,
  sheetlessSkills,
} from './values.ts';
import {
  isReviewedRacialNaturalArmor,
  reviewedUnsupportedReason,
} from './racial-trait-rules.ts';
import { findReviewedReplacementFormula } from './reviewed-change-replacements.ts';
import {
  applyReviewedDescriptionCorrections,
  reviewedDescriptionCorrections,
  type ReviewedDescriptionCorrection,
} from './reviewed-description-corrections.ts';
import { sanitizeDescription } from './sanitize.ts';
import { mapFormula } from './formula.ts';
import { targetStage } from '../../src/lib/character-sheet.ts';
import {
  conditionalHelperIds,
  naturalAttackIds,
  packPolicy,
  type ImportKind,
} from './inventory.ts';
import type { CurationOutput } from './curation.ts';
import {
  abilityTraitChanges,
  mapRaceProficiencies,
  mapRacialTraitFacts,
  type RacialTraitFacts,
  type RacialTraitPlan,
} from './racial-traits.ts';
import type { ProficiencyGrant } from '../../src/lib/character-sheet-proficiencies.ts';

export type PreviewEntry = {
  externalKey: string;
  upstreamKey: string;
  pack: string;
  name: string;
  detail: PreviewDetail;
  description: string;
  prerequisites?: Prerequisite[];
  prerequisiteText?: string;
  grantsSlots?: {
    kind: 'feat' | 'trait';
    count: number;
    feats?: string[];
    /** S3: the feat types a reviewed schedule's bonus feat slot accepts. */
    featTypes?: string[];
  }[];
  countsAsRaces?: string[];
  proficiencies?: Exclude<ProficiencyGrant, { choice: true }>[];
  sources: { book: string; pages?: string }[];
  modifiers: (Omit<
    Extract<CurationOutput, { kind: 'modifier' }>,
    'kind' | 'target' | 'bonusType'
  > & { target: string; bonusType: string })[];
  situationalNotes?: Omit<Extract<CurationOutput, { kind: 'note' }>, 'kind'>[];
  sourceKey?: string;
  /** #721: the entry whose Attribution Assessment this entry takes. */
  attributionFrom?: string;
  unsupported: Unsupported[];
  /** #716: where each field of an `everythingpath/` entry comes from. */
  provenance?: Record<string, z.infer<typeof fieldProvenanceSchema>>;
};
const resourceKinds = new Set<PreviewEntry['detail']['kind']>([
  'creatureType',
  'companionFeature',
  'companion',
  'familiar',
  'eidolonForm',
  'eidolonEvolution',
]);
export function isResource(entry: PreviewEntry) {
  return resourceKinds.has(entry.detail.kind);
}

const buffKinds = new Map<string, ImportKind>([
  ['spell', 'spellEffect'],
  ['feat', 'classFeature'],
  ['item', 'item'],
]);

export function classify({
  source,
  raceBuilderFolders,
}: {
  source: LoadedRecord;
  raceBuilderFolders: Set<string>;
}):
  | { kind: 'admitted'; entryKind: ImportKind }
  | { kind: 'excluded' | 'unassigned'; reason: string } {
  const { repo, pack, record } = source;
  if (record._key.startsWith('!folders!'))
    return {
      kind: 'excluded',
      reason: 'Foundry folder metadata is not catalog content.',
    };
  const policy = packPolicy({ repo, pack });
  if (policy.kind !== 'map')
    return {
      kind: policy.kind === 'exclude' ? 'excluded' : 'unassigned',
      reason: policy.reason,
    };
  if (repo === 'pf1-content' && conditionalHelperIds.has(record._id))
    return {
      kind: 'excluded',
      reason: 'Named Foundry conditional-modifier helper/template (#228).',
    };
  if (
    repo === 'pf1-content' &&
    pack === 'pf-racial-traits' &&
    record.folder &&
    raceBuilderFolders.has(record.folder)
  )
    return {
      kind: 'excluded',
      reason:
        'Advanced Race Guide Race Builder subtree is explicitly excluded.',
    };
  if (policy.family === 'naturalAttacks')
    return naturalAttackIds.has(record._id)
      ? { kind: 'admitted', entryKind: 'item' }
      : {
          kind: 'excluded',
          reason:
            'Only the 12 generic natural attacks and unarmed strike are admitted from monster-abilities.',
        };
  if (policy.family === 'buff') {
    if (record.type !== 'buff')
      return {
        kind: 'unassigned',
        reason: 'Unexpected record type in a buff pack.',
      };
    const entryKind =
      buffKinds.get(readText({ value: record.system.subType })) ?? 'manual';
    return { kind: 'admitted', entryKind };
  }
  const expected: Record<string, string[]> = {
    race: ['race'],
    class: ['class'],
    classFeature: ['feat'],
    feat: ['feat'],
    trait: ['feat'],
    racialTrait: ['feat'],
    item: [
      'equipment',
      'weapon',
      'loot',
      'consumable',
      'container',
      'attack',
      'implant',
    ],
    itemAbility: ['feat'],
    spell: ['spell'],
    creatureType: ['class'],
    companionFeature: ['feat', 'class'],
    companion: ['npc', 'character'],
    familiar: ['npc', 'character'],
    eidolonForm: ['npc', 'character'],
    eidolonEvolution: ['feat', 'class', 'attack'],
  };
  if (!expected[policy.family]?.includes(record.type))
    return {
      kind: 'unassigned',
      reason: `Unexpected ${record.type} record in ${policy.family} inventory.`,
    };
  return { kind: 'admitted', entryKind: policy.family };
}

export function mapEntry({
  source,
  kind,
  resolveKey,
  lookup,
  spellClassTags,
  racial,
  descriptionCorrections = reviewedDescriptionCorrections,
}: {
  source: LoadedRecord;
  kind: ImportKind;
  resolveKey: (key: string) => string | undefined;
  lookup: Map<string, LoadedRecord>;
  spellClassTags: ReadonlySet<string>;
  racial?: RacialTraitPlan;
  descriptionCorrections?: readonly ReviewedDescriptionCorrection[];
}): PreviewEntry {
  const { record, pack } = source;
  const upstreamKey = toExternalKey(source);
  const externalKey = resolveKey(upstreamKey) ?? upstreamKey;
  const unsupported: Unsupported[] = [];
  const sanitize = createSanitizer({ resolveKey, lookup, unsupported });
  // Reviewed description corrections change only this entry's description;
  // every derived text keeps reading the raw record.
  const corrected = applyReviewedDescriptionCorrections({
    upstreamKey,
    body: sourceBody({ source }),
    rows: descriptionCorrections,
  });
  unsupported.push(...corrected.issues);
  const description = sanitize(corrected.body);
  const sources = mapSources({ record, unsupported });
  recordNoticeHolds({ record, upstreamKey, unsupported });
  const traitFacts =
    kind === 'racialTrait'
      ? mapRacialTraitFacts({ source, plan: racial, resolveKey })
      : undefined;
  const detail = detailMappers[kind]({
    record,
    upstreamKey,
    resolveKey,
    lookup,
    spellClassTags,
    unsupported,
    racial,
    traitFacts,
  });
  const context = { record, kind, unsupported, sanitize };
  recordUncuratedContent(context);
  // #719: a race change a standard trait also carries belongs to that trait;
  // a change a trait fact consumes is not also an unmapped Modifier.
  const skipped =
    kind === 'race'
      ? racial?.relocationOf(upstreamKey)?.ownedChanges
      : traitFacts?.consumed;
  const modifiers = [
    ...(traitFacts?.modifiers ?? []),
    ...mapModifiers({ ...context, skipped, upstreamKey }),
    ...(kind === 'item' ? mapItemArmorBonus(record.system) : []),
    ...(kind === 'racialTrait'
      ? relocatedRaceModifiers({ upstreamKey, racial })
      : []),
  ];
  unsupported.push(...(traitFacts?.unsupported ?? []));
  const proficiencies = proficienciesFor({
    source,
    kind,
    racial,
    traitFacts,
    unsupported,
  });
  if (kind === 'race') {
    reportRaceSpeeds({ record, unsupported });
    reportStaleAbilityTrait({ upstreamKey, racial, unsupported });
  }
  const selectionRule = selectionImportRule({ kind, record });
  const grantsSlots = selectionRule?.grantsSlots ?? traitFacts?.grantsSlots;
  const entry = {
    externalKey,
    upstreamKey,
    pack,
    name: record.name,
    detail,
    description,
    ...(kind === 'feat' || kind === 'trait' || kind === 'class'
      ? mapPrerequisites({ source, lookup, resolveKey })
      : {}),
    ...(grantsSlots ? { grantsSlots } : {}),
    ...(traitFacts?.countsAsRaces
      ? { countsAsRaces: traitFacts.countsAsRaces }
      : {}),
    ...(proficiencies?.length ? { proficiencies } : {}),
    sources,
    modifiers,
    unsupported,
  };
  importedCatalogEntrySchema.parse(entry);
  return entry;
}

/**
 * #721: a race's reviewed ability score trait. It carries the race record's own
 * fixed ability changes, mapped as the race's, and takes the race's citation
 * and notice holds; its upstream key is the race's.
 */
export function mapRaceAbilityTrait({
  source,
  racial,
  resolveKey,
  lookup,
}: {
  source: LoadedRecord;
  racial?: RacialTraitPlan;
  resolveKey: (key: string) => string | undefined;
  lookup: ReadonlyMap<string, LoadedRecord>;
}): PreviewEntry | undefined {
  const upstreamKey = toExternalKey(source);
  const trait = racial?.abilityTraitOf(upstreamKey);
  if (!trait) return undefined;
  const { record, pack } = source;
  const unsupported: Unsupported[] = [];
  const sources = mapSources({ record, unsupported });
  recordNoticeHolds({ record, upstreamKey, unsupported });
  const line = abilityLineHtml({
    description: sourceDescription(record),
    heading: trait.heading,
  });
  const sanitize = createSanitizer({ resolveKey, lookup, unsupported });
  const entry = {
    externalKey: trait.key,
    upstreamKey,
    // Its Attribution Assessment is the race's (admission.ts).
    attributionFrom: trait.raceKey,
    pack,
    name: trait.name,
    detail: {
      kind: 'racialTrait' as const,
      bonusSkillRanksPerLevel: 0,
      raceKeys: [trait.raceKey],
      standard: true,
      replaces: [],
    },
    // The race description's own ability line, or else the trait's name.
    description: line ? sanitize(line) : `<p>${escapeHtml(trait.name)}</p>`,
    sources,
    modifiers: mapChangesDiscardingUnsupported({
      record,
      kind: 'race',
      changes: abilityTraitChanges(trait),
      upstreamKey,
    }),
    unsupported,
  };
  importedCatalogEntrySchema.parse(entry);
  return entry;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * #721: the list item or paragraph of a race description whose leading bold
 * text is the ability line's heading, such as "Ability Score Modifiers", as a
 * paragraph.
 */
function abilityLineHtml({
  description,
  heading,
}: {
  description: string;
  heading: string;
}) {
  const plain = (html: string) =>
    html
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/:\s*$/, '')
      .trim();
  const body = [...description.matchAll(/<(li|p)>([\s\S]*?)<\/\1>/g)]
    .map(([, , item = '']) => item)
    .find((item) => {
      const strong = /^\s*<strong>([\s\S]*?)<\/strong>/.exec(item);
      return strong ? plain(strong[1] ?? '') === heading : false;
    });
  return body === undefined ? undefined : `<p>${body}</p>`;
}

/** #721: a reviewed ability score trait rule that no longer matches the race. */
function reportStaleAbilityTrait({
  upstreamKey,
  racial,
  unsupported,
}: {
  upstreamKey: string;
  racial?: RacialTraitPlan;
  unsupported: Unsupported[];
}) {
  const row = racial?.relocationOf(upstreamKey)?.abilityTraitRow;
  if (row?.status !== 'stale') return;
  unsupported.push({
    field: 'raceAbilityTrait',
    reason: `The reviewed ability score trait rule no longer matches this race record, so its ability changes stay on the race: ${row.reason ?? 'stale'}`,
    value: { trait: row.trait, evidence: row.evidence },
  });
}

/**
 * The Modifiers a record's given raw changes map to. Changes that do not map
 * are discarded, not reported.
 */
export function mapChangesDiscardingUnsupported({
  record,
  kind,
  changes,
  upstreamKey,
}: {
  record: SourceRecord;
  kind: ImportKind;
  changes: unknown[];
  upstreamKey?: string;
}) {
  return mapModifiers({
    record: { ...record, system: { ...record.system, changes } },
    kind,
    unsupported: [],
    upstreamKey,
  });
}

/**
 * #719: the race changes the plan moves onto this standard trait, because no
 * change of the trait on that target maps, mapped as the race's own.
 */
function relocatedRaceModifiers({
  upstreamKey,
  racial,
}: {
  upstreamKey: string;
  racial?: RacialTraitPlan;
}) {
  const moved = racial?.movedChangesOf(upstreamKey);
  return moved
    ? mapChangesDiscardingUnsupported({
        record: moved.race.record,
        kind: 'race',
        changes: moved.changes,
        upstreamKey: toExternalKey(moved.race),
      })
    : [];
}

type MappingContext = {
  record: SourceRecord;
  kind: ImportKind;
  unsupported: Unsupported[];
  sanitize: (value: string) => string;
};

function createSanitizer({
  resolveKey,
  lookup,
  unsupported,
}: {
  resolveKey: (key: string) => string | undefined;
  lookup: ReadonlyMap<string, LoadedRecord>;
  unsupported: Unsupported[];
}) {
  const sanitize = (value: string) =>
    sanitizeDescription({
      html: value,
      isTextReference: isRulesJournalLink,
      link: (uuid) => {
        const upstream = uuidKey(uuid);
        const key = upstream && resolveKey(upstream);
        const target = upstream && lookup.get(upstream);
        if (!key || !target) {
          unsupported.push({
            field: 'description.link',
            reason: 'Unresolved catalog link stripped.',
            value: uuid,
          });
          return undefined;
        }
        return { key, name: target.record.name };
      },
    });
  return sanitize;
}

function recordNoticeHolds({
  record,
  upstreamKey,
  unsupported,
}: Pick<MappingContext, 'record' | 'unsupported'> & { upstreamKey: string }) {
  const sources = readArray(record.system.sources).map(readObject);
  for (const hold of knownNoticeHolds) {
    if (
      hold.externalKeys?.includes(upstreamKey) ||
      sources.some(
        (source) =>
          hold.productCodes.includes(readText({ value: source.id })) ||
          hold.titles.includes(readText({ value: source.name })) ||
          hold.titles.includes(readText({ value: source.title })) ||
          hold.publishers?.some((publisher) =>
            readText({ value: source.publisher }).includes(publisher),
          ),
      )
    )
      unsupported.push({ field: 'attribution', reason: knownNoticeHoldReason });
  }
}

function mapSources({
  record: { system },
  unsupported,
}: Pick<MappingContext, 'record' | 'unsupported'>) {
  return readArray(system.sources).flatMap((value) => {
    const source = readObject(value);
    const book =
      readText({ value: source.id }) || readText({ value: source.name });
    const pages =
      typeof source.pages === 'string' || typeof source.pages === 'number'
        ? String(source.pages)
        : undefined;
    if (!source.id)
      unsupported.push({
        field: 'sources',
        reason:
          'Upstream custom source requires attribution review; no product code has been inferred.',
        value: {
          name: readText({ value: source.name }),
          date: readText({ value: source.date }),
          publisher: readText({ value: source.publisher }),
          url: /^https?:\/\//.test(readText({ value: source.url }))
            ? readText({ value: source.url })
            : '',
          pages,
        },
      });
    return book ? [{ book, ...(pages === undefined ? {} : { pages }) }] : [];
  });
}

function recordUncuratedContent({
  record,
  kind,
  unsupported,
  sanitize,
}: MappingContext) {
  const system = record.system;
  const contentFields = [
    'actions',
    'associations',
    'armorProf',
    'weaponProf',
    'links',
    'changes',
    'contextNotes',
    'classSkills',
    'hd',
    'bab',
    'savingThrows',
    'skillsPerLevel',
    'customHD',
    'customSkillFormula',
    'attributes',
    'traits',
    'skills',
    'speeds',
    'languages',
    'creatureTypes',
    'creatureSubtypes',
    'material',
    'uses',
    'weaponSubtype',
    'held',
    'properties',
  ];
  const forbidden = new Set([
    'script',
    'scripts',
    'scriptCalls',
    'command',
    'macro',
    'macros',
    'flags',
    '_stats',
    'img',
    'token',
    'prototypeToken',
    'spellbooks',
  ]);
  function retainContent({
    value,
    path = [],
    depth = 0,
  }: {
    value: unknown;
    path?: string[];
    depth?: number;
  }): unknown {
    if (depth > 20) return '[Nested content omitted]';
    if (typeof value === 'string') {
      const field = path.at(-1);
      const parent = path.at(-2);
      const isHtml =
        field === 'description' ||
        (parent === 'description' &&
          ['value', 'unidentified'].includes(field ?? '')) ||
        (parent === 'contextNotes' && field === 'text') ||
        (parent === 'conditionals' && field === 'name');
      return isHtml ? sanitize(value) : value;
    }
    if (
      value === null ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    )
      return value;
    if (Array.isArray(value))
      return value.map((item) =>
        retainContent({ value: item, path, depth: depth + 1 }),
      );
    return Object.fromEntries(
      Object.entries(readObject(value))
        .filter(([key]) => !forbidden.has(key))
        .map(([key, item]) => [
          key,
          retainContent({
            value: item,
            path: [...path, key],
            depth: depth + 1,
          }),
        ]),
    );
  }
  const uncuratedFields = contentFields.filter(
    (field) =>
      system[field] !== undefined &&
      !['changes', 'contextNotes'].includes(field),
  );
  if (uncuratedFields.length)
    unsupported.push({
      field: 'gameContent',
      reason:
        'Source game-content fields retained for feature curation; only explicitly mapped detail/modifiers have an interpretation.',
      value: Object.fromEntries(
        uncuratedFields.map((field) => [
          field,
          retainContent({ value: system[field], path: [field] }),
        ]),
      ),
    });
  if (resourceKinds.has(kind) && record.items?.length)
    unsupported.push({
      field: 'embeddedItems',
      reason:
        'Actor-owned embedded content retained for companion curation; these IDs are not global catalog identities.',
      value: record.items.map((item) => {
        const system = readObject(item.system);
        return {
          id: readText({ value: item._id }),
          name: readText({ value: item.name }),
          type: readText({ value: item.type }),
          description: sanitize(
            readText({ value: readObject(system.description).value }),
          ),
          content: Object.fromEntries(
            contentFields
              .filter((field) => system[field] !== undefined)
              .map((field) => [
                field,
                retainContent({ value: system[field], path: [field] }),
              ]),
          ),
        };
      }),
    });
}

const noMovement = 'The sheet has no movement statistic';
// What each movement mode would also give, per the PRD skill descriptions:
// Climb and Swim (CRB pp. 90, 108) and Fly (CRB p. 96).
const speedReasons: Record<string, string> = {
  land: `${noMovement}; the land speed stays prose.`,
  climb: `${noMovement}; the climb speed and its +8 racial bonus on Climb checks stay prose.`,
  swim: `${noMovement}; the swim speed and its +8 racial bonus on Swim checks to perform a special action or avoid a hazard stay prose.`,
  fly: `${noMovement}; the fly speed, its maneuverability modifier on Fly checks and Fly as a class skill stay prose.`,
  burrow: `${noMovement}; the burrow speed stays prose.`,
};

// Foundry's proficiency category keys (#306).
const proficiencyCategoryKeys: Record<
  string,
  Extract<ProficiencyGrant, { category: string }>['category']
> = {
  simple: 'simple',
  martial: 'martial',
  lgt: 'light',
  med: 'medium',
  hvy: 'heavy',
  shl: 'shield',
  twr: 'towerShield',
};

/**
 * #720: a creature type's structured proficiency categories (Outsider's
 * simple and martial weapons). Any other string stays prose and is reported.
 */
function mapCategoryProficiencies({
  record: { system },
  unsupported,
}: Pick<MappingContext, 'record' | 'unsupported'>) {
  return (['weaponProf', 'armorProf'] as const).flatMap((field) =>
    readArray(system[field]).flatMap((value) => {
      const category =
        typeof value === 'string' ? proficiencyCategoryKeys[value] : undefined;
      if (category) return [{ category }];
      unsupported.push({
        field,
        reason: 'Not a proficiency category key; it stays prose.',
        value,
      });
      return [];
    }),
  );
}

/**
 * A record's structured proficiencies: a Racial Trait's, a race's ownerless
 * weapon familiarity (#720) or a creature type's categories (#720).
 */
function proficienciesFor({
  source,
  kind,
  racial,
  traitFacts,
  unsupported,
}: {
  source: LoadedRecord;
  kind: ImportKind;
  racial?: RacialTraitPlan;
  traitFacts?: Pick<RacialTraitFacts, 'proficiencies'>;
  unsupported: Unsupported[];
}) {
  if (kind === 'racialTrait') return traitFacts?.proficiencies;
  if (kind === 'creatureType')
    return mapCategoryProficiencies({ record: source.record, unsupported });
  if (kind !== 'race') return undefined;
  const race = mapRaceProficiencies({ source, plan: racial });
  unsupported.push(...(race?.unsupported ?? []));
  return race?.proficiencies;
}

/** #720: every race speed is reported; the sheet has no movement fact. */
function reportRaceSpeeds({
  record: { system },
  unsupported,
}: Pick<MappingContext, 'record' | 'unsupported'>) {
  const speeds = readObject(system.speeds);
  // Foundry reads an empty maneuverability as average.
  const maneuverability =
    readText({ value: speeds.flyManeuverability }) || 'average';
  for (const [mode, reason] of Object.entries(speedReasons)) {
    const speed = speeds[mode];
    if (typeof speed !== 'number') continue;
    unsupported.push({
      field: 'speeds',
      reason,
      value: {
        [mode]: speed,
        ...(mode === 'fly' ? { flyManeuverability: maneuverability } : {}),
      },
    });
  }
}

const speedTargets = new Set([
  'landSpeed',
  'climbSpeed',
  'swimSpeed',
  'flySpeed',
  'burrowSpeed',
]);

/**
 * #720: why a raw change has no runtime target, when the reason is known. The
 * sheet has no movement, spell resistance, Artistry or Lore statistic.
 */
function unsupportedChangeReason({
  sourceTarget,
  isRacial,
  isReplacement,
  reviewed,
}: {
  sourceTarget: string;
  isRacial: boolean;
  isReplacement: boolean;
  reviewed?: string;
}) {
  if (reviewed) return reviewed;
  if (
    sourceTarget.startsWith('skill.') &&
    sheetlessSkills.has(sourceTarget.slice(6))
  )
    return 'The sheet has no Artistry or Lore skill; this change contributes nothing.';
  // Other kinds keep the general reason, so their reviewed content stays.
  if (!isRacial) return undefined;
  if (speedTargets.has(sourceTarget))
    return `${noMovement}; this speed change stays prose.`;
  if (sourceTarget === 'spellResist')
    return 'The sheet has no spell resistance statistic; this spell resistance stays prose.';
  if (isReplacement)
    return "Foundry's `set` operator replaces a value; it is not an additive Modifier and contributes nothing.";
  return undefined;
}

const bonusTypeAliases: Record<string, string> = {
  enh: 'enhancement',
  nat: 'naturalArmor',
  def: 'deflection',
  luck: 'luck',
};

/**
 * A raw change's bonus type. #720: race and Racial Trait natural armor is a
 * natural armor bonus to AC, whatever Foundry's type (`base`, `racial` or
 * `untyped`), unless the source states a racial bonus to natural armor.
 */
function changeBonusType({
  raw,
  isRacial,
  upstreamKey,
}: {
  raw: Record<string, unknown>;
  isRacial: boolean;
  upstreamKey?: string;
}) {
  const type = readText({ value: raw.type });
  if (
    isRacial &&
    raw.target === 'nac' &&
    !(upstreamKey && isReviewedRacialNaturalArmor(upstreamKey, raw))
  )
    return 'naturalArmor';
  return bonusTypeAliases[type] ?? type;
}

function mapModifiers({
  record: { system },
  kind,
  unsupported,
  skipped,
  upstreamKey,
}: Omit<MappingContext, 'sanitize'> & {
  skipped?: ReadonlySet<number>;
  upstreamKey?: string;
}) {
  const modifiers: PreviewEntry['modifiers'] = [];
  const targets: Record<string, string> = {
    str: 'ability.str',
    dex: 'ability.dex',
    con: 'ability.con',
    int: 'ability.int',
    wis: 'ability.wis',
    cha: 'ability.cha',
    ac: 'ac',
    aac: 'ac.armor',
    sac: 'ac.shield',
    nac: 'ac.natural',
    fort: 'save.fort',
    ref: 'save.ref',
    will: 'save.will',
    allSavingThrows: 'saves',
    skills: 'skills',
    attack: 'attack',
    mattack: 'attack.melee',
    rattack: 'attack.ranged',
    damage: 'damage',
    wdamage: 'damage',
    mwdamage: 'damage.melee',
    rwdamage: 'damage.ranged',
    bab: 'bab',
    cmb: 'cmb',
    cmd: 'cmd',
    init: 'init',
    mhp: 'hp',
    allChecks: '',
  };
  const bonusTypes = new Set([
    'alchemical',
    'armor',
    'circumstance',
    'competence',
    'deflection',
    'dodge',
    'enhancement',
    'inherent',
    'insight',
    'luck',
    'morale',
    'naturalArmor',
    'profane',
    'racial',
    'resistance',
    'sacred',
    'shield',
    'size',
    'trait',
    'untyped',
  ]);
  for (const [index, change] of readArray(system.changes).entries()) {
    if (skipped?.has(index)) continue;
    const raw = readObject(change);
    const sourceTarget = readText({ value: raw.target });
    const skill = sourceTarget.startsWith('skill.')
      ? runtimeSkillKey(sourceTarget.slice(6))
      : undefined;
    const target = skill ?? targets[sourceTarget];
    const isRacial = kind === 'race' || kind === 'racialTrait';
    const bonusType = changeBonusType({ raw, isRacial, upstreamKey });
    const value = mapFormula({
      // #726: a reviewed replacement stands in for a contradicted raw formula.
      input:
        (upstreamKey
          ? findReviewedReplacementFormula(upstreamKey, raw)
          : undefined) ?? readText({ value: raw.formula }),
      classTag: readText({ value: system.class }) || undefined,
      allowCasterLevel: kind === 'spellEffect' || target === 'casterLevel',
    });
    const stage = targetStage(target ?? '');
    const sameStage =
      typeof value === 'string' &&
      ((stage <= 2 && value.includes('@ability.')) ||
        (stage <= 3 && /@(?:bab|hitDice)\b/.test(value)) ||
        (stage <= 4 && value.includes('@casterLevel.')) ||
        (kind !== 'spellEffect' && stage < 4 && /@casterLevel\b/.test(value)));
    const reason = unsupportedChangeReason({
      sourceTarget,
      isRacial,
      // #719/#720: a race's or granted trait's `set` change replaces a value;
      // it is not an additive Modifier (Normal Speed (Vanara) sets a climb
      // speed as `skill.clm`).
      isReplacement: isRacial && raw.operator === 'set',
      reviewed: upstreamKey
        ? reviewedUnsupportedReason(upstreamKey, raw)
        : undefined,
    });
    if (
      !reason &&
      target &&
      bonusTypes.has(bonusType) &&
      value !== undefined &&
      !sameStage &&
      kind !== 'spell'
    )
      modifiers.push({
        target,
        bonusType,
        value: typeof value === 'number' ? value : { formula: value },
      });
    else
      unsupported.push({
        field: 'changes',
        reason:
          reason ??
          'Unmapped target, bonus type, formula or calculation-stage dependency; contributes nothing.',
        value: {
          target: sourceTarget,
          formula: readText({ value: raw.formula }),
          type: readText({ value: raw.type }),
          // #720: a race's or trait's `set` change is told apart.
          ...(isRacial && typeof raw.operator === 'string' && raw.operator
            ? { operator: raw.operator }
            : {}),
        },
      });
  }
  return modifiers;
}
