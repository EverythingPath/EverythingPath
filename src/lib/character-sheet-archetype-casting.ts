import { z } from 'zod';
import type {
  CharacterSheetCatalogEntry,
  SheetWarning,
} from './character-sheet';
import {
  abilityKeys,
  abilityLabels,
  type Ability,
} from './character-sheet-abilities';
import {
  castingTableKeys,
  classCastingSchema,
  classFeatureSpellcastingSchema,
  extraSlotKinds,
  type Casting,
  type CastingTableKey,
  type ClassFeatureSpellcasting,
  type ExtraSlotKind,
} from './character-sheet-casting-tables';
import {
  capitalize,
  castingPropertyNames,
  castingTableLabels,
  describeExtraSlot,
  describeRecording,
  signedNumber,
  spellListName,
} from './character-sheet-casting-copy';

const spellReferenceSchema = z.object({ catalogEntryId: z.string() });

/**
 * An Archetype's structured casting changes (#238). An omitted property
 * inherits the base class; `presence: 'remove'` explicitly removes the whole
 * casting package and ignores the archetype's other properties. Lists, Granted
 * Spells and extra slots distinguish additions/removals from replacement.
 */
export const archetypeCastingChangeSchema = z.object({
  presence: z.enum(['add', 'remove']).optional(),
  spellKind: classCastingSchema.shape.spellKind.optional(),
  ability: z.enum(abilityKeys).optional(),
  table: z
    .object({ table: z.enum(castingTableKeys), cantrips: z.boolean() })
    .optional(),
  recording: classCastingSchema
    .pick({ type: true, record: true, bookType: true })
    .optional(),
  casterLevelOffset: z.number().int().optional(),
  spellList: z
    .object({
      /** Another class's list replaces the whole base list. */
      classTag: z.string().optional(),
      add: z
        .array(
          z.object({
            catalogEntryId: z.string(),
            spellLevel: z.number().int().min(0).max(9),
          }),
        )
        .optional(),
      remove: z.array(spellReferenceSchema).optional(),
    })
    .optional(),
  grantedSpells: z
    .object({
      /** Replaces every Granted Spell of the class's own features. */
      replace: z.boolean().optional(),
      add: classFeatureSpellcastingSchema.shape.grantedSpells,
      remove: z.array(spellReferenceSchema).optional(),
    })
    .optional(),
  extraSlots: z
    .object({
      replace: z.boolean().optional(),
      add: z.array(z.enum(extraSlotKinds)).optional(),
      remove: z.array(z.enum(extraSlotKinds)).optional(),
    })
    .optional(),
});
export type ArchetypeCastingChange = z.infer<
  typeof archetypeCastingChangeSchema
>;

export const castingPropertyKeys = [
  'presence',
  'spellKind',
  'ability',
  'table',
  'recording',
  'casterLevelOffset',
  'spellList',
  'grantedSpells',
  'extraSlots',
] as const;
export type CastingPropertyKey = (typeof castingPropertyKeys)[number];

const archetypeCastingSourceSchema = z.object({
  entryId: z.string(),
  name: z.string(),
});
export type ArchetypeCastingSource = z.infer<
  typeof archetypeCastingSourceSchema
>;

/**
 * One casting property an active Archetype changes. `key` is the property, or
 * `property:detail` for one Spell or extra slot kind. Candidates are listed
 * only when archetypes disagree.
 */
export const resolvedCastingPropertySchema = z.object({
  key: z.string(),
  property: z.enum(castingPropertyKeys),
  status: z.enum(['changed', 'automatic', 'chosen', 'unresolved']),
  sources: z.array(archetypeCastingSourceSchema),
  candidates: z.array(
    archetypeCastingSourceSchema.extend({ value: z.string() }),
  ),
  chosenEntryId: z.string().nullable(),
});
export type ResolvedCastingProperty = z.infer<
  typeof resolvedCastingPropertySchema
>;

export const resolvedArchetypeSpellListSchema = z.object({
  /** The class tag whose list applies; null while its replacement waits. */
  classTag: z.string().nullable(),
  /** That list's class name for copy, such as "Bard". */
  name: z.string().nullable(),
  added: z.array(
    z.object({
      catalogEntryId: z.string(),
      ruleIdentity: z.string(),
      spellLevel: z.number(),
    }),
  ),
  removed: z.array(z.string()),
  unresolved: z.array(z.string()),
});
export type ResolvedArchetypeSpellList = z.infer<
  typeof resolvedArchetypeSpellListSchema
>;

/** Effective casting facts a pending choice can leave null (#238). */
export const resolvedCastingFieldsSchema = classCastingSchema
  .pick({ classTag: true, bookType: true })
  .extend({
    type: classCastingSchema.shape.type.nullable(),
    spellKind: classCastingSchema.shape.spellKind.nullable(),
    record: classCastingSchema.shape.record.nullable(),
    ability: classCastingSchema.shape.ability.nullable(),
    cantrips: z.boolean().nullable(),
  });

/**
 * Every class whose casting active Archetypes change, including one whose
 * casting a chosen removal took away, so its choices stay reachable.
 */
export const archetypeCastingSummarySchema = z.object({
  classEntryId: z.string(),
  name: z.string(),
  presence: z.enum(['none', 'present', 'removed', 'unresolved']),
  properties: z.array(resolvedCastingPropertySchema),
});
export type ArchetypeCastingSummary = z.infer<
  typeof archetypeCastingSummarySchema
>;

/** An active, applicable Archetype of one class with its casting facts. */
export type ArchetypeCastingApplication = {
  entryId: string;
  name: string;
  ruleIdentity: string;
  casting: ArchetypeCastingChange;
  castingChoices: readonly string[];
};

type GrantedSpellsGrant = NonNullable<
  ClassFeatureSpellcasting['grantedSpells']
>;

export type EffectiveCasting = {
  presence: 'none' | 'present' | 'removed' | 'unresolved';
  classTag: string;
  type: Casting['type'] | null;
  record: Casting['record'] | null;
  bookType?: Casting['bookType'];
  spellKind: Casting['spellKind'] | null;
  /** Fixed when inherited or replaced once; null while competitors wait for modifiers. */
  ability: Ability | null;
  abilityCandidates: { ability: Ability; sources: ArchetypeCastingSource[] }[];
  cantrips: boolean | null;
  table: CastingTableKey | null;
  casterLevelOffset: number | null;
  spellList: ResolvedArchetypeSpellList;
  grantedSpells: {
    replace: boolean;
    added: { grant: GrantedSpellsGrant; source: ArchetypeCastingSource }[];
    removed: string[];
  };
  extraSlots: {
    replace: boolean;
    added: ExtraSlotKind[];
    removed: ExtraSlotKind[];
  };
  properties: ResolvedCastingProperty[];
  /** Property keys whose values are unresolved for the whole Spellcasting. */
  unresolved: CastingPropertyKey[];
  warnings: SheetWarning[];
};

type Offer<Value> = {
  application: ArchetypeCastingApplication;
  value: Value;
  label: string;
};

type Decision<Value> =
  | { status: 'none' }
  | {
      status: 'changed' | 'chosen';
      value: Value;
      property: ResolvedCastingProperty;
    }
  | { status: 'automatic'; property: ResolvedCastingProperty }
  | { status: 'unresolved'; property: ResolvedCastingProperty };

function source(application: ArchetypeCastingApplication) {
  return { entryId: application.entryId, name: application.name };
}

function byEntry<Value extends { entryId: string }>(left: Value, right: Value) {
  return left.entryId.localeCompare(right.entryId);
}

function uniqueSources(offers: readonly Offer<unknown>[]) {
  return [
    ...new Map(
      offers.map((offer) => [
        offer.application.entryId,
        source(offer.application),
      ]),
    ).values(),
  ].sort(byEntry);
}

/**
 * Compatible offers combine; conflicting ones need the player's saved choice,
 * except casting abilities, which are compared by modifier later. Selection
 * order never decides.
 */
function decide<Value>(
  key: string,
  property: CastingPropertyKey,
  offers: readonly Offer<Value>[],
  automatic = false,
): Decision<Value> {
  const groups = new Map<string, Offer<Value>[]>();
  for (const offer of offers) {
    const group = JSON.stringify(offer.value);
    groups.set(group, [...(groups.get(group) ?? []), offer]);
  }
  const base = { key, property, chosenEntryId: null };
  const [first] = offers;
  if (!first) return { status: 'none' };
  if (groups.size === 1) {
    return {
      status: 'changed',
      value: first.value,
      property: {
        ...base,
        status: 'changed',
        sources: uniqueSources(offers),
        candidates: [],
      },
    };
  }
  const candidates = offers
    .map((offer) => ({ ...source(offer.application), value: offer.label }))
    .sort(byEntry);
  if (automatic)
    return {
      status: 'automatic',
      property: { ...base, status: 'automatic', sources: [], candidates },
    };
  const chosen = offers.filter((offer) =>
    offer.application.castingChoices.includes(key),
  );
  const chosenGroups = new Set(
    chosen.map((offer) => JSON.stringify(offer.value)),
  );
  const [pick] = chosen;
  if (pick && chosenGroups.size === 1) {
    const applied = groups.get(JSON.stringify(pick.value)) ?? [pick];
    return {
      status: 'chosen',
      value: pick.value,
      property: {
        ...base,
        status: 'chosen',
        sources: uniqueSources(applied),
        candidates,
        chosenEntryId: pick.application.entryId,
      },
    };
  }
  return {
    status: 'unresolved',
    property: { ...base, status: 'unresolved', sources: [], candidates },
  };
}

function hasCastingChange(change: ArchetypeCastingChange) {
  return (
    change.presence === 'add' ||
    Object.keys(change).some((key) => key !== 'presence')
  );
}

type Catalog = readonly CharacterSheetCatalogEntry[];

function spellIdentity(catalog: Catalog, catalogEntryId: string) {
  const definition = catalog.find((row) => row._id === catalogEntryId);
  return {
    ruleIdentity: definition?.ruleIdentity ?? catalogEntryId,
    definition,
  };
}

function emptyList(
  classTag: string | null,
  catalog: Catalog,
): ResolvedArchetypeSpellList {
  return {
    classTag,
    name: classTag === null ? null : spellListName(classTag, catalog),
    added: [],
    removed: [],
    unresolved: [],
  };
}

function scalarOffers<Value>(
  applications: readonly ArchetypeCastingApplication[],
  read: (change: ArchetypeCastingChange) => Value | undefined,
  label: (value: Value) => string,
): Offer<Value>[] {
  return applications.flatMap((application) => {
    const value = read(application.casting);
    return value === undefined
      ? []
      : [{ application, value, label: label(value) }];
  });
}

type SpellOfferValue = { add: number | null } | { remove: true };

function spellOfferLabel(value: SpellOfferValue) {
  if ('remove' in value) return 'Removes the Spell';
  return value.add === null
    ? 'Adds the Spell'
    : `Adds the Spell at level ${value.add}`;
}

/** Per-Spell offers: adding at a level, or removing, keyed by rule identity. */
function spellOffers(
  catalog: Catalog,
  applications: readonly ArchetypeCastingApplication[],
  read: (change: ArchetypeCastingChange) => {
    add: readonly { catalogEntryId: string; spellLevel?: number }[];
    remove: readonly { catalogEntryId: string }[];
  },
) {
  const offers = new Map<string, Offer<SpellOfferValue>[]>();
  const ids = new Map<string, string>();
  for (const application of applications) {
    const { add, remove } = read(application.casting);
    const rows: { id: string; value: SpellOfferValue }[] = [
      ...add.map((row) => ({
        id: row.catalogEntryId,
        value: { add: row.spellLevel ?? null },
      })),
      ...remove.map((row) => ({
        id: row.catalogEntryId,
        value: { remove: true as const },
      })),
    ];
    for (const row of rows) {
      const { ruleIdentity } = spellIdentity(catalog, row.id);
      if (!ids.has(ruleIdentity)) ids.set(ruleIdentity, row.id);
      offers.set(ruleIdentity, [
        ...(offers.get(ruleIdentity) ?? []),
        { application, value: row.value, label: spellOfferLabel(row.value) },
      ]);
    }
  }
  return { offers, ids };
}

/** Collects resolved properties, unresolved keys and warnings for one class. */
function createRecorder(family: string, className: string) {
  const properties: ResolvedCastingProperty[] = [];
  const unresolved: CastingPropertyKey[] = [];
  const warnings: SheetWarning[] = [];
  const record: Recorder = (decision) => {
    if (decision.status === 'none') return undefined;
    properties.push(decision.property);
    warnings.push(...decisionWarnings(family, className, decision.property));
    if (decision.status === 'unresolved') {
      if (!decision.property.key.includes(':'))
        unresolved.push(decision.property.property);
      return null;
    }
    return decision.status === 'automatic' ? undefined : decision.value;
  };
  // An added casting package must supply every property it needs.
  const missing = (
    property: CastingPropertyKey,
    applications: readonly ArchetypeCastingApplication[],
  ) => {
    unresolved.push(property);
    warnings.push(missingWarning(family, className, property, applications));
  };
  return { properties, unresolved, warnings, record, missing };
}
type CastingRecorder = ReturnType<typeof createRecorder>;

function emptyCasting(
  presence: EffectiveCasting['presence'],
  classTag: string,
  recorder: CastingRecorder,
): EffectiveCasting {
  return {
    presence,
    classTag,
    type: null,
    record: null,
    spellKind: null,
    ability: null,
    abilityCandidates: [],
    cantrips: null,
    table: null,
    casterLevelOffset: null,
    spellList: emptyList(null, []),
    grantedSpells: { replace: false, added: [], removed: [] },
    extraSlots: { replace: false, added: [], removed: [] },
    properties: recorder.properties,
    unresolved: recorder.unresolved,
    warnings: recorder.warnings,
  };
}

/**
 * Removal conflicts with the whole casting package; without a removal only an
 * explicit addition changes presence. Returns the Archetypes whose other
 * casting changes are retained.
 */
function resolvePresence(
  applications: readonly ArchetypeCastingApplication[],
  recorder: CastingRecorder,
) {
  const relevant = applications.filter(
    (application) =>
      application.casting.presence === 'remove' ||
      hasCastingChange(application.casting),
  );
  const removing = relevant.some(
    (application) => application.casting.presence === 'remove',
  );
  const offers = relevant.flatMap((application) => {
    if (application.casting.presence === 'remove')
      return [{ application, value: 'remove', label: 'Removes spellcasting' }];
    if (removing)
      return [{ application, value: 'retain', label: 'Keeps spellcasting' }];
    return application.casting.presence === 'add'
      ? [{ application, value: 'add', label: 'Adds spellcasting' }]
      : [];
  });
  return {
    presence: recorder.record(decide('presence', 'presence', offers)),
    retained: relevant.filter(
      (application) => application.casting.presence !== 'remove',
    ),
  };
}

/** One scalar property: a combined or chosen change, else the base class. */
function resolveScalar<Value>({
  property,
  read,
  label,
  inherited,
  retained,
  recorder,
}: {
  property: CastingPropertyKey;
  read: (change: ArchetypeCastingChange) => Value | undefined;
  label: (value: Value) => string;
  inherited: Value | undefined;
  retained: readonly ArchetypeCastingApplication[];
  recorder: CastingRecorder;
}): Value | null {
  const value = recorder.record(
    decide(property, property, scalarOffers(retained, read, label)),
  );
  if (value === null) return null;
  if (value !== undefined) return value;
  if (inherited !== undefined) return inherited;
  recorder.missing(property, retained);
  return null;
}

function recordingOf(
  casting: Pick<Casting, 'type' | 'record' | 'bookType'>,
): Pick<Casting, 'type' | 'record' | 'bookType'> {
  return {
    type: casting.type,
    record: casting.record,
    ...(casting.bookType ? { bookType: casting.bookType } : {}),
  };
}

function resolveScalars(
  base: Casting | undefined,
  retained: readonly ArchetypeCastingApplication[],
  recorder: CastingRecorder,
) {
  const shared = { retained, recorder };
  return {
    spellKind: resolveScalar({
      ...shared,
      property: 'spellKind',
      read: (change) => change.spellKind,
      label: capitalize,
      inherited: base?.spellKind,
    }),
    table: resolveScalar({
      ...shared,
      property: 'table',
      read: (change) => change.table,
      label: (value) => castingTableLabels[value.table],
      inherited: base
        ? { table: base.table, cantrips: base.cantrips }
        : undefined,
    }),
    recording: resolveScalar({
      ...shared,
      property: 'recording',
      read: (change) => change.recording && recordingOf(change.recording),
      label: describeRecording,
      inherited: base ? recordingOf(base) : undefined,
    }),
    casterLevelOffset: resolveScalar({
      ...shared,
      property: 'casterLevelOffset',
      read: (change) => change.casterLevelOffset,
      label: (value) => `Caster level ${signedNumber(value)}`,
      inherited: base?.casterLevelOffset,
    }),
  };
}

/**
 * A sole replacement ability applies; competing ones wait for the
 * modifier comparison (`selectCastingAbility`). The base is not a competitor.
 */
function resolveAbility(
  base: Casting | undefined,
  retained: readonly ArchetypeCastingApplication[],
  recorder: CastingRecorder,
): Pick<EffectiveCasting, 'ability' | 'abilityCandidates'> {
  const offers = scalarOffers(
    retained,
    (change) => change.ability,
    (value) => abilityLabels[value],
  );
  const decision = decide('ability', 'ability', offers, true);
  recorder.record(decision);
  const abilityCandidates = [
    ...new Set(offers.map((offer) => offer.value)),
  ].map((ability) => ({
    ability,
    sources: uniqueSources(offers.filter((offer) => offer.value === ability)),
  }));
  if (decision.status === 'changed')
    return { ability: decision.value, abilityCandidates };
  if (decision.status !== 'none') return { ability: null, abilityCandidates };
  if (base) return { ability: base.ability, abilityCandidates };
  recorder.missing('ability', retained);
  return { ability: null, abilityCandidates };
}

function resolveSpellList(
  catalog: Catalog,
  base: Casting | undefined,
  retained: readonly ArchetypeCastingApplication[],
  recorder: CastingRecorder,
) {
  const classTag = resolveScalar({
    property: 'spellList',
    read: (change) => change.spellList?.classTag,
    label: (value) => `Uses the ${spellListName(value, catalog)} list`,
    inherited: base?.classTag,
    retained,
    recorder,
  });
  const spellList = emptyList(classTag, catalog);
  const { offers, ids } = spellOffers(catalog, retained, (change) => ({
    add: change.spellList?.add ?? [],
    remove: change.spellList?.remove ?? [],
  }));
  for (const [ruleIdentity, spellOffersFor] of [...offers].sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    const value = recorder.record(
      decide(`spellList:${ruleIdentity}`, 'spellList', spellOffersFor),
    );
    if (value === null) spellList.unresolved.push(ruleIdentity);
    else if (value && 'remove' in value) spellList.removed.push(ruleIdentity);
    else if (value && value.add !== null)
      spellList.added.push({
        catalogEntryId: ids.get(ruleIdentity) ?? ruleIdentity,
        ruleIdentity,
        spellLevel: value.add,
      });
  }
  return spellList;
}

/** A pending Granted Spell or slot kind leaves that list or total waiting. */
function markPendingDetails(recorder: CastingRecorder) {
  for (const property of ['grantedSpells', 'extraSlots'] as const)
    if (
      recorder.properties.some(
        (row) =>
          row.property === property &&
          row.key !== property &&
          row.status === 'unresolved',
      )
    )
      recorder.unresolved.push(property);
}

/**
 * One class's effective casting after its active Archetypes (#238). The base
 * class is the inherited default, never another competitor.
 */
export function resolveArchetypeCasting({
  family,
  className,
  base,
  applications,
  catalog,
}: {
  family: string;
  className: string;
  base: Casting | undefined;
  applications: readonly ArchetypeCastingApplication[];
  catalog: Catalog;
}): EffectiveCasting {
  const recorder = createRecorder(family, className);
  // An added package keeps the class's own identity; its list is `spellList`.
  const classTag = base?.classTag ?? family;
  const { presence, retained } = resolvePresence(applications, recorder);
  if (presence === 'remove') return emptyCasting('removed', classTag, recorder);
  if (presence === null) return emptyCasting('unresolved', classTag, recorder);
  const adds = retained.some(
    (application) => application.casting.presence === 'add',
  );
  if (!base && !adds)
    return emptyCasting('none', classTag, createRecorder(family, className));
  const { spellKind, table, recording, casterLevelOffset } = resolveScalars(
    base,
    retained,
    recorder,
  );
  const ability = resolveAbility(base, retained, recorder);
  const spellList = resolveSpellList(catalog, base, retained, recorder);
  const grantedSpells = resolveGrantedSpells(
    catalog,
    retained,
    recorder.record,
  );
  const extraSlots = resolveExtraSlots(retained, recorder.record);
  markPendingDetails(recorder);
  return {
    presence: 'present',
    classTag,
    type: recording?.type ?? null,
    record: recording?.record ?? null,
    ...(recording?.bookType ? { bookType: recording.bookType } : {}),
    spellKind,
    ...ability,
    cantrips: table?.cantrips ?? null,
    table: table?.table ?? null,
    casterLevelOffset,
    spellList,
    grantedSpells,
    extraSlots,
    properties: recorder.properties,
    unresolved: [...new Set(recorder.unresolved)],
    warnings: recorder.warnings,
  };
}

type Recorder = <Value>(decision: Decision<Value>) => Value | null | undefined;

function resolveGrantedSpells(
  catalog: Catalog,
  applications: readonly ArchetypeCastingApplication[],
  record: Recorder,
): EffectiveCasting['grantedSpells'] {
  const replacing = applications.filter(
    (application) => application.casting.grantedSpells?.replace,
  );
  const replacement = record(
    decide(
      'grantedSpells',
      'grantedSpells',
      replacing.map((application) => ({
        application,
        value: application.entryId,
        label: `Replaces them with ${application.name}’s`,
      })),
    ),
  );
  const replacingIds = new Set(replacing.map((row) => row.entryId));
  const contributors = applications.filter(
    (application) =>
      !replacingIds.has(application.entryId) ||
      application.entryId === replacement,
  );
  const result: EffectiveCasting['grantedSpells'] = {
    replace: replacement !== undefined && replacement !== null,
    added: [],
    removed: [],
  };
  if (replacement === null) return result;
  const offers = spellOffers(catalog, contributors, (change) => ({
    add: change.grantedSpells?.add?.spells ?? [],
    remove: change.grantedSpells?.remove ?? [],
  }));
  const blocked = new Set<string>();
  for (const [ruleIdentity, spellOffersFor] of offers.offers) {
    // Different levels of one Spell are separate grants; only add/remove conflict.
    const value = record(
      decide(
        `grantedSpells:${ruleIdentity}`,
        'grantedSpells',
        spellOffersFor.map((offer) => ({
          ...offer,
          value: 'remove' in offer.value ? 'remove' : 'add',
          label:
            'remove' in offer.value ? 'Removes the Spell' : 'Grants the Spell',
        })),
      ),
    );
    if (value === 'remove') result.removed.push(ruleIdentity);
    if (value === null) blocked.add(ruleIdentity);
  }
  for (const application of contributors) {
    const grant = application.casting.grantedSpells?.add;
    if (!grant) continue;
    const spells = grant.spells.filter(
      (row) =>
        !blocked.has(spellIdentity(catalog, row.catalogEntryId).ruleIdentity),
    );
    if (spells.length)
      result.added.push({
        grant: { ...grant, spells },
        source: source(application),
      });
  }
  // A Spell waiting for a choice is left out and its list marked unresolved.
  result.removed.push(...blocked);
  return result;
}

function resolveExtraSlots(
  applications: readonly ArchetypeCastingApplication[],
  record: Recorder,
): EffectiveCasting['extraSlots'] {
  const replacing = applications.filter(
    (application) => application.casting.extraSlots?.replace,
  );
  const replacement = record(
    decide(
      'extraSlots',
      'extraSlots',
      replacing.map((application) => {
        const kinds = [...(application.casting.extraSlots?.add ?? [])].sort();
        return {
          application,
          value: kinds,
          label: kinds.length
            ? `Only ${kinds.map(describeExtraSlot).join(', ')}`
            : 'No extra slots',
        };
      }),
    ),
  );
  const result: EffectiveCasting['extraSlots'] = {
    replace: Array.isArray(replacement),
    added: [...(Array.isArray(replacement) ? replacement : [])],
    removed: [],
  };
  if (replacement === null) return result;
  const others = applications.filter(
    (application) => !application.casting.extraSlots?.replace,
  );
  for (const kind of extraSlotKinds) {
    const value = record(
      decide(
        `extraSlots:${kind}`,
        'extraSlots',
        others.flatMap((application) => {
          const slots = application.casting.extraSlots;
          if (slots?.add?.includes(kind))
            return [
              {
                application,
                value: 'add',
                label: `Adds ${describeExtraSlot(kind)}`,
              },
            ];
          if (slots?.remove?.includes(kind))
            return [
              {
                application,
                value: 'remove',
                label: `Removes ${describeExtraSlot(kind)}`,
              },
            ];
          return [];
        }),
      ),
    );
    if (value === 'add' && !result.added.includes(kind))
      result.added.push(kind);
    // A pending slot kind is left out and the extra slots marked unresolved.
    if (value === 'remove' || value === null) result.removed.push(kind);
  }
  return result;
}

function conflictMessage(className: string, property: ResolvedCastingProperty) {
  const names = [...new Set(property.candidates.map((row) => row.name))];
  const [last, ...rest] = [...names].reverse();
  const listed = rest.length
    ? `${rest.reverse().join(', ')} and ${last}`
    : (last ?? 'Archetypes');
  return `${listed} change the ${castingPropertyNames[property.property]} of ${className} differently. All remain selected.`;
}

function decisionWarnings(
  family: string,
  className: string,
  property: ResolvedCastingProperty,
): SheetWarning[] {
  if (property.status === 'changed') return [];
  const [first] = property.candidates;
  const target = {
    kind: 'entry',
    entryId: first?.entryId ?? family,
  } as const;
  const facts = [
    family,
    property.key,
    [...property.candidates]
      .map((row) => [row.name, row.value])
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right)),
      ),
  ];
  const conflict: SheetWarning = {
    kind: 'rules',
    check: 'archetypeCastingConflict',
    target,
    subject: `${family}:casting:${property.key}`,
    fingerprint: JSON.stringify(facts),
    message: conflictMessage(className, property),
  };
  if (property.status !== 'unresolved') return [conflict];
  return [
    conflict,
    {
      kind: 'incomplete',
      check: 'archetypeCastingChoiceMissing',
      target,
      subject: `${family}:castingChoice:${property.key}`,
      fingerprint: JSON.stringify(facts),
      message: `Choose which archetype’s ${castingPropertyNames[property.property]} change applies to ${className}.`,
    },
  ];
}

function missingWarning(
  family: string,
  className: string,
  property: CastingPropertyKey,
  applications: readonly ArchetypeCastingApplication[],
): SheetWarning {
  const adding = applications.filter(
    (application) => application.casting.presence === 'add',
  );
  return {
    kind: 'unresolved',
    check: 'archetypeCastingUnresolved',
    target: {
      kind: 'entry',
      entryId: adding[0]?.entryId ?? applications[0]?.entryId ?? family,
    },
    subject: `${family}:castingMissing:${property}`,
    fingerprint: JSON.stringify([
      family,
      property,
      adding.map((row) => row.ruleIdentity).sort(),
    ]),
    message: `The spellcasting an archetype adds to ${className} has no ${castingPropertyNames[property]}.`,
  };
}

/**
 * Competing casting abilities (#238): the highest current modifier is selected, then
 * the alphabetically first ability name. The comparison reads only the
 * modifiers it is given; bonus spells still use the selected ability's permanent score.
 */
export function selectCastingAbility(
  casting: Pick<
    EffectiveCasting,
    'ability' | 'abilityCandidates' | 'properties'
  >,
  abilities: Record<Ability, { modifier: number }>,
): { ability: Ability | null; properties: ResolvedCastingProperty[] } {
  if (casting.ability || casting.abilityCandidates.length < 2)
    return { ability: casting.ability, properties: casting.properties };
  const [selected] = [...casting.abilityCandidates].sort(
    (left, right) =>
      abilities[right.ability].modifier - abilities[left.ability].modifier ||
      abilityLabels[left.ability].localeCompare(abilityLabels[right.ability]),
  );
  return {
    ability: selected?.ability ?? null,
    properties: casting.properties.map((property) =>
      property.key === 'ability'
        ? { ...property, sources: selected?.sources ?? [] }
        : property,
    ),
  };
}

/**
 * A Spell's level on an effective list: a number, undefined when it is not on
 * the list, or null while a pending choice decides it.
 */
export function effectiveSpellListLevel(
  list: ResolvedArchetypeSpellList,
  spell: { ruleIdentity: string; levels?: Readonly<Record<string, number>> },
): number | undefined | null {
  if (list.unresolved.includes(spell.ruleIdentity)) return null;
  const added = list.added.find(
    (row) => row.ruleIdentity === spell.ruleIdentity,
  );
  if (added) return added.spellLevel;
  if (list.removed.includes(spell.ruleIdentity)) return undefined;
  if (list.classTag === null) return null;
  return Object.hasOwn(spell.levels ?? {}, list.classTag)
    ? spell.levels?.[list.classTag]
    : undefined;
}
