import type {
  CharacterSheetCatalogEntry,
  CharacterSheetClassDetail,
  CharacterSheetInput,
  SheetEntry,
  SheetWarning,
} from './character-sheet';
import {
  isSpellSchool,
  type CastingAdvanceKind,
  type ClassFeatureSpellcasting,
  type ExtraSlotKind,
  type SpellcastingOptionKind,
  type SpellSchool,
  type SpellSchoolKey,
} from './character-sheet-casting-tables';
import {
  characterSheetClassFamily,
  normalizeCharacterSheetChoiceName,
  parseGrantKeyId,
} from './character-sheet-grants';
import {
  effectiveSpellListLevel,
  type EffectiveCasting,
} from './character-sheet-archetype-casting';

/** Each class family's effective casting after its Archetypes (#422). */
type EffectiveCastings = ReadonlyMap<
  string,
  Pick<EffectiveCasting, 'presence' | 'spellKind'>
>;

type ClassLevel = Extract<SheetEntry, { kind: 'classLevel' }>;
type ClassFeatureEntry = Extract<SheetEntry, { kind: 'classFeature' }>;
type ClassDefinition = CharacterSheetCatalogEntry & {
  detail: CharacterSheetClassDetail;
};

export type CastingAdvanceProblem = 'missing' | 'noCasting' | 'later' | 'kind';

type WarningCheck = SheetWarning['check'];
/** A specialist's opposition-school checks, shown where the schools are chosen. */
export const oppositionSchoolChecks = [
  'oppositionSchoolsMissing',
  'oppositionSchools',
] as const satisfies readonly WarningCheck[];
/** The class-feature checks of a Spellcasting: open choices and opposition schools. */
export const spellcastingFeatureChecks = [
  'spellcastingChoiceMissing',
  ...oppositionSchoolChecks,
] as const satisfies readonly WarningCheck[];

/** One "+1 level of existing spellcasting class" on a Prestige Class Level. */
export type ResolvedCastingAdvance = {
  entryId: string;
  index: number;
  prestigeClassEntryId: string;
  prestigeName: string;
  prestigeClassLevel: number;
  kind: CastingAdvanceKind;
  eligibleClassEntryIds: string[];
  targetClassEntryId: string | null;
  prefilled: boolean;
  problem: CastingAdvanceProblem | null;
  /** The class family the advance counts for, when that class casts. */
  targetFamily: string | null;
};

/** A class feature granting a Spell: a Spell two domains share has both. */
export type GrantedSpellSource = { entryId: string; name: string };

export type ResolvedGrantedSpell = {
  catalogEntryId: string;
  ruleIdentity: string;
  name: string;
  school?: SpellSchool;
  description?: string;
  spellLevel: number;
  style: 'slot' | 'schedule';
  sources: GrantedSpellSource[];
  optionKind: SpellcastingOptionKind | null;
  domainSlotOnly: boolean;
};

export type ResolvedSpellcastingChoice = {
  sourceEntryId: string;
  sourceName: string;
  list: string;
  classLevel: number;
  count: number;
  optionKind: SpellcastingOptionKind;
  selected: { entryId: string; catalogEntryId: string; name: string }[];
};

export type ResolvedSpellcastingSchool = {
  entryId: string;
  catalogEntryId: string;
  name: string;
  school: SpellSchoolKey;
  oppositionSchools: SpellSchoolKey[];
  oppositionSchoolCount: number;
};

export type ResolvedExtraSlot = { kind: ExtraSlotKind; label: string };

const schoolNames: Record<SpellSchoolKey, string> = {
  abj: 'abjuration',
  con: 'conjuration',
  div: 'divination',
  enc: 'enchantment',
  evo: 'evocation',
  ill: 'illusion',
  nec: 'necromancy',
  trs: 'transmutation',
};
const optionNouns: Record<
  SpellcastingOptionKind,
  { article: string; singular: string; plural: string }
> = {
  domain: { article: 'a', singular: 'domain', plural: 'domains' },
  subdomain: { article: 'a', singular: 'subdomain', plural: 'subdomains' },
  school: {
    article: 'an',
    singular: 'arcane school',
    plural: 'arcane schools',
  },
  bloodline: { article: 'a', singular: 'bloodline', plural: 'bloodlines' },
};

function isClassDefinition(
  definition: CharacterSheetCatalogEntry | undefined,
): definition is ClassDefinition {
  return definition?.detail?.kind === 'class' && 'bab' in definition.detail;
}

function classDefinitionFor(
  input: CharacterSheetInput,
  id: string | null | undefined,
): ClassDefinition | undefined {
  const definition = id
    ? input.catalogEntries.find((entry) => entry._id === id)
    : undefined;
  return isClassDefinition(definition) ? definition : undefined;
}

function sortedClassLevels(input: CharacterSheetInput) {
  return input.entries
    .filter(
      (entry): entry is ClassLevel =>
        entry.kind === 'classLevel' && entry.active,
    )
    .sort((left, right) => left.state.position - right.state.position);
}

/**
 * Whether an advance of this kind fits a class's effective casting. A pending
 * Archetype choice leaves the answer unresolved rather than failed (#238).
 */
function advanceMatches(
  kind: CastingAdvanceKind,
  casting: Pick<EffectiveCasting, 'presence' | 'spellKind'> | undefined,
): boolean | 'unresolved' {
  if (!casting || casting.presence === 'none' || casting.presence === 'removed')
    return false;
  if (casting.presence === 'unresolved') return 'unresolved';
  if (kind === 'any') return true;
  return casting.spellKind === null ? 'unresolved' : casting.spellKind === kind;
}

function effectiveFor(
  input: CharacterSheetInput,
  castings: EffectiveCastings | undefined,
  definition: ClassDefinition,
): Pick<EffectiveCasting, 'presence' | 'spellKind'> | undefined {
  const family = characterSheetClassFamily(definition, input.catalogEntries);
  const effective = castings?.get(family);
  if (effective) return effective;
  const casting = definition.detail.casting;
  return casting
    ? { presence: 'present', spellKind: casting.spellKind }
    : undefined;
}

/** When each class family first appears, in Class Level order. */
type ClassHistory = {
  firstPositions: Map<string, number>;
  firstDefinitions: Map<string, ClassDefinition>;
};

/** Where a Prestige Class Level's advances stand among the Character's classes. */
type AdvancingLevel = {
  level: ClassLevel;
  definition: ClassDefinition;
  family: string;
  classLevel: number;
  /** The position of the Prestige Class's first level. */
  entryPosition: number;
};

function takenBeforeEntry(
  history: ClassHistory,
  family: string | null,
  advancing: AdvancingLevel,
) {
  return (
    family !== null &&
    family !== advancing.family &&
    (history.firstPositions.get(family) ?? Infinity) < advancing.entryPosition
  );
}

function eligibleTargets(
  history: ClassHistory,
  advancing: AdvancingLevel,
  kind: CastingAdvanceKind,
  castingFor: (definition: ClassDefinition) => ReturnType<typeof effectiveFor>,
) {
  const matches = [...history.firstDefinitions.entries()].flatMap(
    ([family, candidate]) =>
      takenBeforeEntry(history, family, advancing)
        ? [
            {
              id: candidate._id,
              match: advanceMatches(kind, castingFor(candidate)),
            },
          ]
        : [],
  );
  return {
    eligible: matches.flatMap((row) => (row.match === true ? [row.id] : [])),
    pending: matches.some((row) => row.match === 'unresolved'),
  };
}

/** Why a recorded target does not qualify, or null when it does. */
function advanceProblem(
  history: ClassHistory,
  advancing: AdvancingLevel,
  kind: CastingAdvanceKind,
  target: ClassDefinition | undefined,
  targetFamily: string | null,
  casting: ReturnType<typeof effectiveFor>,
): CastingAdvanceProblem | null {
  if (!target) return 'missing';
  if (!casting || casting.presence === 'none' || casting.presence === 'removed')
    return 'noCasting';
  if (!takenBeforeEntry(history, targetFamily, advancing)) return 'later';
  if (advanceMatches(kind, casting) === false) return 'kind';
  return null;
}

function resolveLevelAdvances(
  input: CharacterSheetInput,
  history: ClassHistory,
  advancing: AdvancingLevel,
  castings: EffectiveCastings | undefined,
): ResolvedCastingAdvance[] {
  const { level, definition, family, classLevel } = advancing;
  const castingFor = (candidate: ClassDefinition) =>
    effectiveFor(input, castings, candidate);
  const kinds =
    definition.detail.castingAdvances?.find(
      (row) => row.classLevel === classLevel,
    )?.kinds ?? [];
  return kinds.map((kind, index) => {
    const { eligible, pending } = eligibleTargets(
      history,
      advancing,
      kind,
      castingFor,
    );
    // A null element is an advance not recorded yet beside a recorded one.
    const recorded = level.state.castingAdvances?.[index] ?? null;
    // A class whose casting waits for a choice might also qualify.
    const prefill =
      eligible.length === 1 && !pending ? (eligible[0] ?? null) : null;
    const targetClassEntryId = recorded ? recorded.classEntryId : prefill;
    const target = classDefinitionFor(input, targetClassEntryId);
    const targetFamily = target
      ? characterSheetClassFamily(target, input.catalogEntries)
      : null;
    const targetCasting = target ? castingFor(target) : undefined;
    return {
      entryId: level._id,
      index,
      prestigeClassEntryId: definition._id,
      prestigeName: definition.name ?? 'Prestige class',
      prestigeClassLevel: classLevel,
      kind,
      eligibleClassEntryIds: eligible,
      targetClassEntryId,
      prefilled: recorded === null && targetClassEntryId !== null,
      problem:
        targetClassEntryId === null
          ? null
          : advanceProblem(
              history,
              advancing,
              kind,
              target,
              targetFamily,
              targetCasting,
            ),
      targetFamily:
        targetCasting &&
        targetCasting.presence !== 'none' &&
        targetCasting.presence !== 'removed' &&
        targetFamily !== family
          ? targetFamily
          : null,
    };
  });
}

/**
 * Mystic Theurge (CRB pp. 387–388): each advance goes to a casting class of
 * its kind that the Character belonged to before the Prestige Class's first
 * level. A choice is pre-filled only when exactly one class qualifies; a
 * recorded choice, including an explicit empty one, is preserved even when it
 * no longer does.
 */
export function resolveCastingAdvances(
  input: CharacterSheetInput,
  castings?: EffectiveCastings,
) {
  const history: ClassHistory = {
    firstPositions: new Map(),
    firstDefinitions: new Map(),
  };
  const counts = new Map<string, number>();
  const advances: ResolvedCastingAdvance[] = [];
  for (const level of sortedClassLevels(input)) {
    const definition = classDefinitionFor(input, level.state.classEntryId);
    if (!definition) continue;
    const family = characterSheetClassFamily(definition, input.catalogEntries);
    if (!history.firstPositions.has(family)) {
      history.firstPositions.set(family, level.state.position);
      history.firstDefinitions.set(family, definition);
    }
    const classLevel = (counts.get(family) ?? 0) + 1;
    counts.set(family, classLevel);
    advances.push(
      ...resolveLevelAdvances(
        input,
        history,
        {
          level,
          definition,
          family,
          classLevel,
          entryPosition:
            history.firstPositions.get(family) ?? level.state.position,
        },
        castings,
      ),
    );
  }
  return { advances, warnings: castingAdvanceWarnings(input, advances) };
}

function kindLabel(kind: CastingAdvanceKind) {
  return kind === 'any' ? 'spellcasting' : `${kind} spellcasting`;
}

function castingAdvanceWarnings(
  input: CharacterSheetInput,
  advances: readonly ResolvedCastingAdvance[],
): SheetWarning[] {
  return advances.flatMap((advance): SheetWarning[] => {
    const prestige = input.catalogEntries.find(
      (entry) => entry._id === advance.prestigeClassEntryId,
    );
    const subject = `${advance.entryId}:castingAdvances:${advance.index}`;
    const target = {
      kind: 'classLevel',
      entryId: advance.entryId,
      field: 'castingAdvances',
    } as const;
    const position = [
      prestige?.ruleIdentity ?? advance.prestigeClassEntryId,
      advance.prestigeClassLevel,
      advance.index,
      advance.kind,
    ];
    if (advance.targetClassEntryId === null)
      return [
        {
          kind: 'incomplete',
          check: 'castingAdvanceMissing',
          target,
          subject,
          fingerprint: JSON.stringify(position),
          message: `Choose the ${kindLabel(advance.kind)} class this ${advance.prestigeName} level advances.`,
        },
      ];
    if (!advance.problem) return [];
    const targetDefinition = input.catalogEntries.find(
      (entry) => entry._id === advance.targetClassEntryId,
    );
    const name = targetDefinition?.name ?? 'The chosen class';
    const message = {
      missing: `The class this ${advance.prestigeName} level advances is unavailable.`,
      noCasting: `${name} has no spellcasting for ${advance.prestigeName} to advance.`,
      later: `${name} was not taken before ${advance.prestigeName}, so its advance does not qualify.`,
      kind: `${advance.prestigeName} advances an ${kindLabel(advance.kind)} class; ${name} does not cast ${advance.kind} spells.`,
    }[advance.problem];
    return [
      {
        kind: 'rules',
        check: 'castingAdvanceTarget',
        target,
        subject,
        fingerprint: JSON.stringify([
          ...position,
          targetDefinition?.ruleIdentity ?? advance.targetClassEntryId,
          advance.problem,
        ]),
        message,
      },
    ];
  });
}

type SpellcastingFeature = {
  entry: ClassFeatureEntry;
  definition: CharacterSheetCatalogEntry;
  facts: ClassFeatureSpellcasting;
  family: string | undefined;
};

/** The prompt or Grant source a class feature's Selection names, if any. */
function selectionOwner(entry: SheetEntry): string | undefined {
  const selection =
    'selectionSource' in entry ? entry.selectionSource : undefined;
  if (!selection) return undefined;
  if (selection.kind === 'classPrompt') return selection.source;
  const reference =
    selection.kind === 'prompt' ? selection.source : selection.grantedBy;
  return reference.kind === 'grant'
    ? reference.grantKey.source
    : reference.entryId;
}

/** The family of the class whose Class Level a feature was gained at. */
function gainedAtFamily(input: CharacterSheetInput, entry: SheetEntry) {
  const level =
    'gainedAtClassLevel' in entry && entry.gainedAtClassLevel
      ? input.entries.find((row) => row._id === entry.gainedAtClassLevel)
      : undefined;
  const definition =
    level?.kind === 'classLevel'
      ? classDefinitionFor(input, level.state.classEntryId)
      : undefined;
  return definition
    ? characterSheetClassFamily(definition, input.catalogEntries)
    : undefined;
}

/**
 * A class feature belongs to the Spellcasting of the class granting it, or of
 * the class whose prompt or level a Selection names (data model, "Recorded
 * Spells").
 */
function featureFamily(
  input: CharacterSheetInput,
  entry: SheetEntry,
  families: ReadonlySet<string>,
  seen = new Set<string>(),
): string | undefined {
  if (seen.has(entry._id)) return undefined;
  seen.add(entry._id);
  const fromSource = (source: string): string | undefined => {
    if (families.has(source)) return source;
    const parsed = parseGrantKeyId(source);
    if (parsed) return fromSource(parsed.source);
    const parent = input.entries.find((row) => row._id === source);
    return parent ? featureFamily(input, parent, families, seen) : undefined;
  };
  if ('grantKey' in entry && entry.grantKey)
    return fromSource(entry.grantKey.source);
  const owner = selectionOwner(entry);
  return owner ? fromSource(owner) : gainedAtFamily(input, entry);
}

function collectSpellcastingFeatures(
  input: CharacterSheetInput,
  families: ReadonlySet<string>,
): SpellcastingFeature[] {
  return input.entries.flatMap((entry): SpellcastingFeature[] => {
    if (entry.kind !== 'classFeature' || !entry.active) return [];
    const definition = input.catalogEntries.find(
      (row) => row._id === entry.catalogEntryId,
    );
    if (
      definition?.detail?.kind !== 'classFeature' ||
      !definition.detail.spellcasting
    )
      return [];
    return [
      {
        entry,
        definition,
        facts: definition.detail.spellcasting,
        family: featureFamily(input, entry, families),
      },
    ];
  });
}

function referencesFeature(entry: SheetEntry, feature: SheetEntry) {
  const selection =
    'selectionSource' in entry ? entry.selectionSource : undefined;
  if (selection?.kind !== 'prompt') return false;
  const reference = selection.source;
  return reference.kind === 'entry'
    ? reference.entryId === feature._id
    : 'grantKey' in feature &&
        feature.grantKey !== undefined &&
        JSON.stringify([
          reference.grantKey.source,
          reference.grantKey.classLevel ?? null,
          reference.grantKey.entry,
        ]) ===
          JSON.stringify([
            feature.grantKey.source,
            feature.grantKey.classLevel ?? null,
            feature.grantKey.entry,
          ]);
}

function extraSlotLabel(kind: ExtraSlotKind, school?: SpellSchoolKey) {
  if (kind === 'school')
    return school ? `+1 school (${schoolNames[school]})` : '+1 school';
  return `+1 ${kind}`;
}

export type SpellcastingFeatureFacts = {
  extraSlots: ResolvedExtraSlot[];
  grantedSpells: ResolvedGrantedSpell[];
  school: ResolvedSpellcastingSchool | null;
  choices: ResolvedSpellcastingChoice[];
};

type CastingGrant = {
  source: GrantedSpellSource;
  grant: NonNullable<ClassFeatureSpellcasting['grantedSpells']>;
  optionKind: SpellcastingOptionKind | null;
};

/** The class features' grants, then Archetype additions, replacement and removals. */
function castingGrants(
  features: readonly SpellcastingFeature[],
  effective: EffectiveCasting | undefined,
): CastingGrant[] {
  const own = effective?.grantedSpells.replace
    ? []
    : features.flatMap(({ entry, definition, facts }) =>
        facts.grantedSpells
          ? [
              {
                source: {
                  entryId: entry._id,
                  name: definition.name ?? 'Class feature',
                },
                grant: facts.grantedSpells,
                optionKind: facts.optionKind ?? null,
              },
            ]
          : [],
      );
  return [
    ...own,
    ...(effective?.grantedSpells.added ?? []).map(({ grant, source }) => ({
      source,
      grant,
      optionKind: null,
    })),
  ];
}

/** Granted Spells, extra slots, school and choices of every Spellcasting. */
export function resolveSpellcastingFeatures(
  input: CharacterSheetInput,
  spellcastings: readonly {
    family: string;
    classTag: string;
    classLevel: number;
    castableSpellLevels: readonly number[];
    effective?: EffectiveCasting;
  }[],
) {
  const families = new Set(spellcastings.map((casting) => casting.family));
  const features = collectSpellcastingFeatures(input, families);
  const only = spellcastings.length === 1 ? spellcastings[0] : undefined;
  const ownerOf = (feature: SpellcastingFeature) =>
    feature.family ?? (only ? only.family : undefined);
  const slotGrantFamilies = new Set<string>();
  const byFamily = new Map<string, SpellcastingFeatureFacts>(
    spellcastings.map((casting) => {
      const owned = features.filter(
        (feature) => ownerOf(feature) === casting.family,
      );
      const granting = owned.filter(
        (feature) => !isWithheld(feature, features),
      );
      const grants = castingGrants(granting, casting.effective);
      if (grants.some(({ grant }) => grant.style === 'slot'))
        slotGrantFamilies.add(casting.family);
      return [
        casting.family,
        {
          extraSlots: extraSlotsFor(granting, casting.effective),
          grantedSpells: grantedSpellsFor(input, grants, casting),
          school: schoolFor(owned),
          choices: choicesFor(input, owned),
        },
      ];
    }),
  );
  return {
    byFamily,
    slotGrantFamilies,
    warnings: [
      ...features.flatMap(oppositionWarnings),
      ...[...byFamily.values()].flatMap(({ choices }) =>
        choices.flatMap(choiceWarnings),
      ),
    ],
  };
}

/**
 * An option chosen through the prompt of a feature whose own text grants its
 * options' powers only (`optionGrantsSpells: false`, the Inquisitor's Domain)
 * gives no Granted Spells or extra slot (D10). Any other option, a domain
 * gained elsewhere included, grants them.
 */
function isWithheld(
  feature: SpellcastingFeature,
  features: readonly SpellcastingFeature[],
) {
  return features.some(
    ({ entry, facts }) =>
      facts.optionGrantsSpells === false &&
      referencesFeature(feature.entry, entry),
  );
}

function extraSlotsFor(
  features: readonly SpellcastingFeature[],
  effective: EffectiveCasting | undefined,
) {
  const slots = new Map<ExtraSlotKind, ResolvedExtraSlot>();
  const changes = effective?.extraSlots;
  if (!changes?.replace)
    for (const { facts } of features) {
      if (!facts.extraSlot || slots.has(facts.extraSlot)) continue;
      slots.set(facts.extraSlot, {
        kind: facts.extraSlot,
        label: extraSlotLabel(facts.extraSlot, facts.school),
      });
    }
  for (const kind of changes?.added ?? [])
    if (!slots.has(kind))
      slots.set(kind, { kind, label: extraSlotLabel(kind) });
  for (const kind of changes?.removed ?? []) slots.delete(kind);
  return [...slots.values()];
}

function grantAvailable(
  grant: NonNullable<ClassFeatureSpellcasting['grantedSpells']>,
  spellLevel: number,
  casting: { classLevel: number; castableSpellLevels: readonly number[] },
) {
  if (grant.style === 'slot')
    return casting.castableSpellLevels.includes(spellLevel);
  return (
    grant.schedule?.some(
      (step) =>
        step.spellLevel === spellLevel && step.classLevel <= casting.classLevel,
    ) ?? false
  );
}

function grantedSpellsFor(
  input: CharacterSheetInput,
  grants: readonly CastingGrant[],
  casting: {
    classTag: string;
    classLevel: number;
    castableSpellLevels: readonly number[];
    effective?: EffectiveCasting;
  },
) {
  const spells = new Map<string, ResolvedGrantedSpell>();
  const removed = new Set(casting.effective?.grantedSpells.removed ?? []);
  for (const { source, grant, optionKind } of grants) {
    for (const row of grant.spells) {
      if (!grantAvailable(grant, row.spellLevel, casting)) continue;
      const spell = input.catalogEntries.find(
        (candidate) => candidate._id === row.catalogEntryId,
      );
      if (spell?.detail?.kind !== 'spell' || removed.has(spell.ruleIdentity))
        continue;
      const key = JSON.stringify([spell.ruleIdentity, row.spellLevel]);
      const granted = spells.get(key);
      if (granted) {
        granted.sources.push(source);
        continue;
      }
      const school = spell.detail.school;
      const listLevel = casting.effective
        ? effectiveSpellListLevel(casting.effective.spellList, {
            ruleIdentity: spell.ruleIdentity,
            levels: spell.detail.levels,
          })
        : spell.detail.levels?.[casting.classTag];
      spells.set(key, {
        catalogEntryId: spell._id,
        ruleIdentity: spell.ruleIdentity,
        name: spell.name ?? 'Spell',
        ...(isSpellSchool(school) ? { school } : {}),
        ...(spell.detail.description
          ? { description: spell.detail.description }
          : {}),
        spellLevel: row.spellLevel,
        style: grant.style,
        sources: [source],
        optionKind,
        // CRB p. 38: a domain Spell off the class list fills only the domain
        // slot; a list still waiting for a choice tags nothing.
        domainSlotOnly:
          (optionKind === 'domain' || optionKind === 'subdomain') &&
          listLevel === undefined,
      });
    }
  }
  return [...spells.values()].sort(
    (left, right) =>
      left.spellLevel - right.spellLevel || left.name.localeCompare(right.name),
  );
}

function schoolFor(
  features: readonly SpellcastingFeature[],
): ResolvedSpellcastingSchool | null {
  const feature = features.find(({ facts }) => facts.school);
  if (!feature?.facts.school) return null;
  return {
    entryId: feature.entry._id,
    catalogEntryId: feature.definition._id,
    name: feature.definition.name ?? 'Arcane school',
    school: feature.facts.school,
    oppositionSchools: [...(feature.entry.state.oppositionSchools ?? [])],
    oppositionSchoolCount: feature.facts.oppositionSchoolCount ?? 0,
  };
}

function choicesFor(
  input: CharacterSheetInput,
  features: readonly SpellcastingFeature[],
): ResolvedSpellcastingChoice[] {
  return features.flatMap(({ entry, definition, facts }) => {
    const optionKind = facts.chooses;
    if (!optionKind || definition.detail?.kind !== 'classFeature') return [];
    return (definition.detail.picksByLevel ?? []).map((prompt) => ({
      sourceEntryId: entry._id,
      sourceName: definition.name ?? 'Class feature',
      list: prompt.list,
      classLevel: prompt.classLevel,
      count: prompt.count,
      optionKind,
      selected: input.entries.flatMap((selected) => {
        if (
          selected.kind !== 'classFeature' ||
          !referencesFeature(selected, entry) ||
          selected.selectionSource?.kind !== 'prompt' ||
          normalizeCharacterSheetChoiceName(selected.selectionSource.list) !==
            normalizeCharacterSheetChoiceName(prompt.list)
        )
          return [];
        const chosen = input.catalogEntries.find(
          (row) => row._id === selected.catalogEntryId,
        );
        return [
          {
            entryId: selected._id,
            catalogEntryId: selected.catalogEntryId,
            name: chosen?.name ?? 'Class feature',
          },
        ];
      }),
    }));
  });
}

/** "Choose 2 domains.", "Choose 1 more domain." or "Choose an arcane school." */
function describeMissingChoice(
  choice: ResolvedSpellcastingChoice,
  remaining: number,
) {
  const { article, singular, plural } = optionNouns[choice.optionKind];
  if (remaining > 1) return `Choose ${remaining} ${plural}.`;
  if (choice.selected.length > 0) return `Choose 1 more ${singular}.`;
  return `Choose ${article} ${singular}.`;
}

function choiceWarnings(choice: ResolvedSpellcastingChoice): SheetWarning[] {
  const remaining = choice.count - choice.selected.length;
  if (remaining <= 0) return [];
  return [
    {
      kind: 'incomplete',
      check: 'spellcastingChoiceMissing',
      target: { kind: 'entry', entryId: choice.sourceEntryId },
      subject: `${choice.sourceEntryId}:${normalizeCharacterSheetChoiceName(choice.list)}`,
      fingerprint: JSON.stringify([choice.list, choice.count, remaining]),
      message: describeMissingChoice(choice, remaining),
    },
  ];
}

/** CRB p. 77: a specialist names two opposition schools, never its own. */
function oppositionWarnings({
  entry,
  definition,
  facts,
}: SpellcastingFeature): SheetWarning[] {
  const required = facts.oppositionSchoolCount ?? 0;
  if (!facts.school || required === 0) return [];
  const chosen = [...new Set(entry.state.oppositionSchools ?? [])].sort();
  const name = definition.name ?? 'This arcane school';
  const subject = `${entry._id}:oppositionSchools`;
  const target = { kind: 'entry', entryId: entry._id } as const;
  if (chosen.length < required)
    return [
      {
        kind: 'incomplete',
        check: 'oppositionSchoolsMissing',
        target,
        subject,
        fingerprint: JSON.stringify([definition.ruleIdentity, chosen]),
        message: `Choose ${required === 2 ? 'two' : required} opposition schools for ${name}.`,
      },
    ];
  const ownSchool = chosen.includes(facts.school);
  if (!ownSchool && chosen.length === required) return [];
  return [
    {
      kind: 'rules',
      check: 'oppositionSchools',
      target,
      subject,
      fingerprint: JSON.stringify([
        definition.ruleIdentity,
        facts.school,
        chosen,
      ]),
      message: ownSchool
        ? `${name} cannot be one of its own opposition schools.`
        : `${name} has ${chosen.length} opposition schools; a specialist chooses ${required}.`,
    },
  ];
}

export function isOppositionSchoolSpell(
  school: ResolvedSpellcastingSchool | null,
  spellSchool: string | undefined,
) {
  return Boolean(
    school &&
    spellSchool &&
    school.oppositionSchools.some((opposition) => opposition === spellSchool),
  );
}
