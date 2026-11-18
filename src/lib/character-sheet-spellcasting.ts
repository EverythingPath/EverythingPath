import type {
  Ability,
  CharacterSheetInput,
  CharacterSheetCatalogEntry,
  InputSourcedModifier,
  LeafTarget,
  ResolveOptions,
  ResolvedStatistic,
  SheetWarning,
} from './character-sheet';
import {
  findCastingTableRow,
  castingTableIncludesZeroLevel,
  MAX_LEVEL,
  type CastingTableRow,
  type Casting,
  type ReviewedCastingTables,
} from './character-sheet-casting-tables';
import { calculateBonusSpells } from './character-sheet-permanent-statistics';
import { characterSheetClassFamily } from './character-sheet-grants';
import {
  resolveCharacterSheetArchetypes,
  type ResolvedCharacterSheetArchetypes,
} from './character-sheet-archetypes';
import {
  resolveArchetypeCasting,
  selectCastingAbility,
  type ArchetypeCastingSummary,
  type CastingPropertyKey,
  type EffectiveCasting,
  type ResolvedArchetypeSpellList,
  type ResolvedCastingProperty,
} from './character-sheet-archetype-casting';
import {
  resolveCastingAdvances,
  resolveSpellcastingFeatures,
  type ResolvedCastingAdvance,
  type SpellcastingFeatureFacts,
} from './character-sheet-spellcasting-features';

type Abilities = Record<Ability, { score: number; modifier: number }>;
/**
 * One effective Spellcasting (#307, #415, #422). Casting properties an
 * Archetype conflict leaves unresolved are null; `unresolved` names them and
 * every dependent value.
 */
export type ResolvedSpellcasting = Pick<Casting, 'classTag' | 'bookType'> & {
  type: Casting['type'] | null;
  spellKind: Casting['spellKind'] | null;
  record: Casting['record'] | null;
  ability: Casting['ability'] | null;
  cantrips: boolean | null;
  classEntryId: string;
  name: string;
  /** The class's own Class Levels; advances add only to casting and caster level. */
  classLevels: number;
  advances: { classEntryId: string; name: string; count: number }[];
  /** Advances recorded before the class itself casts (S9). */
  pendingAdvances: number;
  castingLevel: number;
  tableLevel: number;
  casterLevel: ResolvedStatistic | null;
  concentration: ResolvedStatistic | null;
  castableSpellLevels: number[];
  slots: {
    spellLevel: number;
    base: number | null;
    bonus: number;
    extra: number;
    total: number | null;
    known: number | null;
    prepared: number | null;
    dc: ResolvedStatistic;
    dcUnresolved: boolean;
    schoolDCs: {
      school: string;
      breakdown: ResolvedStatistic;
      unresolved: boolean;
    }[];
  }[];
  unresolved: string[];
  /** The effective list: its class tag plus Archetype additions and removals. */
  spellList: ResolvedArchetypeSpellList;
  /** Casting properties active Archetypes change, with their sources. */
  castingProperties: ResolvedCastingProperty[];
} & SpellcastingFeatureFacts;

type ResolveCastingTarget = (
  target: LeafTarget,
  modifiers: readonly InputSourcedModifier[],
  options: ResolveOptions,
) => { statistic: ResolvedStatistic; warnings: readonly SheetWarning[] };

type CastingBase = {
  classEntryId: string;
  family: string;
  classLevels: number;
  advances: ResolvedSpellcasting['advances'];
  pendingAdvances: number;
  castingLevel: number;
  effective: EffectiveCasting;
  row: CastingTableRow | undefined;
  castableSpellLevels: number[];
  casterLevel: ResolvedStatistic | null;
  name: string;
  casterLevelUnresolved: boolean;
};

function baseContribution({
  target,
  classId,
  name,
  value,
}: {
  target: LeafTarget;
  classId: string;
  name: string;
  value: number;
}): InputSourcedModifier {
  const id = `builtin:casting:${classId}:${target}:${name}`;
  return {
    target,
    bonusType: 'untyped',
    value,
    sheetEntryId: id,
    entryName: name,
    source: id,
    builtIn: true,
  };
}

/** Each class family's effective casting after its active Archetypes (#422). */
function effectiveCastings(
  input: CharacterSheetInput,
  classes: readonly { catalog: CharacterSheetCatalogEntry; family: string }[],
  archetypes: ResolvedCharacterSheetArchetypes,
) {
  return new Map(
    classes.map(({ catalog, family }) => {
      const base =
        catalog.detail?.kind === 'class' && 'casting' in catalog.detail
          ? catalog.detail.casting
          : undefined;
      const applications = [
        ...new Map(
          archetypes.classes
            .filter((result) => result.classIdentity === family)
            .flatMap((result) => result.archetypes)
            .filter(
              (archetype) =>
                archetype.active && archetype.applicable && archetype.casting,
            )
            .map((archetype) => [
              archetype.entryId,
              {
                entryId: archetype.entryId,
                name: archetype.name,
                ruleIdentity: archetype.ruleIdentity,
                casting: archetype.casting ?? {},
                castingChoices: archetype.castingChoices,
              },
            ]),
        ).values(),
      ];
      return [
        family,
        resolveArchetypeCasting({
          family,
          className: catalog.name ?? family,
          base,
          applications,
          catalog: input.catalogEntries,
        }),
      ] as const;
    }),
  );
}

function tallyCastingClasses(
  input: CharacterSheetInput,
  archetypes: ResolvedCharacterSheetArchetypes,
) {
  const classes = new Map<
    string,
    { catalog: CharacterSheetCatalogEntry; family: string; classLevels: number }
  >();
  const spellcastingUnresolved: string[] = [];
  for (const entry of input.entries) {
    if (!entry.active || entry.kind !== 'classLevel') continue;
    const catalog = input.catalogEntries.find(
      (item) => item._id === entry.state.classEntryId,
    );
    if (catalog?.detail?.kind !== 'class' || !('bab' in catalog.detail)) {
      spellcastingUnresolved.push(`class:${entry._id}`);
      continue;
    }
    const family = characterSheetClassFamily(catalog, input.catalogEntries);
    const current = classes.get(family);
    if (current) current.classLevels++;
    else classes.set(family, { catalog, family, classLevels: 1 });
  }
  const effective = effectiveCastings(input, [...classes.values()], archetypes);
  const castingAdvances = resolveCastingAdvances(input, effective);
  return {
    classes: [...classes.values()].map((entry) => ({
      ...entry,
      effective: effective.get(entry.family),
      advances: castingAdvances.advances.filter(
        (advance) => advance.targetFamily === entry.family,
      ),
    })),
    spellcastingUnresolved,
    castingAdvances,
  };
}

export function castableLevels(
  casting: Pick<Casting, 'cantrips' | 'table'>,
  row: CastingTableRow | undefined,
  castingTables: ReviewedCastingTables | undefined,
) {
  return Array.from({ length: 10 }, (_, level) => level).filter(
    (level) =>
      (level > 0 ||
        casting.cantrips ||
        castingTableIncludesZeroLevel(casting.table, castingTables)) &&
      ([
        row?.spellsPerDay[level],
        row?.spellsKnown?.[level],
        row?.preparedPerDay?.[level],
      ].some((value) => value !== undefined && value !== null) ||
        row?.castableSpellLevels?.includes(level)),
  );
}

function advanceSources(advances: readonly ResolvedCastingAdvance[]) {
  const sources = new Map<
    string,
    { classEntryId: string; name: string; count: number }
  >();
  for (const advance of advances) {
    const source = sources.get(advance.prestigeClassEntryId);
    if (source) source.count++;
    else
      sources.set(advance.prestigeClassEntryId, {
        classEntryId: advance.prestigeClassEntryId,
        name: advance.prestigeName,
        count: 1,
      });
  }
  return [...sources.values()];
}

function resolveCastingBase({
  catalog,
  family,
  classLevels,
  advances,
  effective,
  modifiers,
  options,
  resolve,
  castingTables,
}: {
  catalog: CharacterSheetCatalogEntry;
  family: string;
  classLevels: number;
  advances: readonly ResolvedCastingAdvance[];
  effective: EffectiveCasting | undefined;
  modifiers: readonly InputSourcedModifier[];
  options: ResolveOptions;
  resolve: ResolveCastingTarget;
  castingTables?: ReviewedCastingTables;
}): CastingBase[] {
  if (
    !effective ||
    effective.presence === 'none' ||
    effective.presence === 'removed'
  )
    return [];
  const classEntryId = catalog._id;
  const { table, cantrips, casterLevelOffset, classTag } = effective;
  // An unresolved table leaves castable levels, and so advances, undecided.
  const tableCasting =
    table !== null && cantrips !== null ? { table, cantrips } : null;
  // S9: an advance to a class that cannot cast yet counts once it does.
  const ownLevels = tableCasting
    ? castableLevels(
        tableCasting,
        findCastingTableRow(tableCasting.table, classLevels, castingTables),
        castingTables,
      )
    : [];
  const applied = ownLevels.length ? advances : [];
  const castingLevel = classLevels + applied.length;
  const row = tableCasting
    ? findCastingTableRow(tableCasting.table, castingLevel, castingTables)
    : undefined;
  const castableSpellLevels = tableCasting
    ? castableLevels(tableCasting, row, castingTables)
    : [];
  const sources = advanceSources(applied);
  const casterLevel =
    castableSpellLevels.length && casterLevelOffset !== null
      ? resolve(
          'casterLevel',
          [
            ...modifiers,
            baseContribution({
              target: 'casterLevel',
              classId: classEntryId,
              name: 'Class levels',
              value: classLevels,
            }),
            ...sources.map((source) =>
              baseContribution({
                target: 'casterLevel',
                classId: classEntryId,
                name: source.name,
                value: source.count,
              }),
            ),
            baseContribution({
              target: 'casterLevel',
              classId: classEntryId,
              name: 'Caster level offset',
              value: casterLevelOffset,
            }),
          ],
          {
            ...options,
            castingClass: classTag,
            preModifierCasterLevel: castingLevel + casterLevelOffset,
          },
        )
      : null;
  return [
    {
      classEntryId,
      family,
      classLevels,
      advances: sources,
      pendingAdvances: advances.length - applied.length,
      castingLevel,
      effective,
      row,
      castableSpellLevels,
      casterLevel: casterLevel?.statistic ?? null,
      casterLevelUnresolved:
        (casterLevel?.warnings.length ?? 0) > 0 ||
        tableCasting === null ||
        casterLevelOffset === null,
      name: catalog.name ?? classTag,
    },
  ];
}

function castingUnresolved({
  casterLevel,
  concentration,
  spellDC,
}: {
  casterLevel: boolean;
  concentration: boolean;
  spellDC: boolean;
}) {
  return (['casterLevel', 'spellDC', 'concentration'] as const).filter(
    (target) =>
      ({
        casterLevel,
        concentration: casterLevel || concentration,
        spellDC,
      })[target],
  );
}

function resolveSlotDC({
  spellLevel,
  classEntryId,
  abilityModifier,
  modifiers,
  options,
  schools,
  resolve,
}: {
  spellLevel: number;
  classEntryId: string;
  abilityModifier: number;
  modifiers: readonly InputSourcedModifier[];
  options: ResolveOptions;
  schools: readonly string[];
  resolve: ResolveCastingTarget;
}) {
  const dcModifiers = [
    ...modifiers,
    baseContribution({
      target: 'spellDC',
      classId: classEntryId,
      name: 'Spell level',
      value: 10 + spellLevel,
    }),
    baseContribution({
      target: 'spellDC',
      classId: classEntryId,
      name: 'Casting ability modifier',
      value: abilityModifier,
    }),
  ];
  const resolvedDC = resolve('spellDC', dcModifiers, options);
  const dc = resolvedDC.statistic;
  const schoolResults = schools.map((school) => ({
    school,
    ...resolve('spellDC', dcModifiers, { ...options, school }),
  }));
  const schoolDCs = schoolResults
    .map(({ school, statistic, warnings }) => ({
      school,
      breakdown: statistic,
      unresolved: warnings.length > 0,
    }))
    .filter(
      ({ school, breakdown, unresolved }) =>
        unresolved ||
        breakdown.total !== dc.total ||
        (breakdown.notes?.length ?? 0) > 0 ||
        [
          ...breakdown.applied,
          ...breakdown.suppressed,
          ...breakdown.conditional,
        ].some(
          (modifier) =>
            modifier.condition?.school === school &&
            (!modifier.condition.castingClass ||
              modifier.condition.castingClass === options.castingClass),
        ),
    );
  return {
    dc,
    dcUnresolved: resolvedDC.warnings.length > 0,
    schoolDCs,
    unresolved:
      resolvedDC.warnings.length > 0 ||
      schoolResults.some((result) => result.warnings.length > 0),
  };
}

/** The sheet supplies its staged stacking resolver; casting owns class-local rules. */
export function calculateSpellcastings({
  input,
  modifiers,
  options,
  abilities,
  permanentAbilities = abilities,
  resolve,
  archetypes = resolveCharacterSheetArchetypes(input),
}: {
  input: CharacterSheetInput;
  modifiers: readonly InputSourcedModifier[];
  options: ResolveOptions;
  abilities: Abilities;
  permanentAbilities?: Abilities;
  resolve: ResolveCastingTarget;
  archetypes?: ResolvedCharacterSheetArchetypes;
}) {
  const { classes, spellcastingUnresolved, castingAdvances } =
    tallyCastingClasses(input, archetypes);
  const bases = classes.flatMap((entry) =>
    resolveCastingBase({
      ...entry,
      modifiers,
      options,
      resolve,
      castingTables: input.resources?.castingTables,
    }),
  );
  const unresolvedCasterLevels = bases
    .filter((base) => base.casterLevelUnresolved)
    .map((base) => base.effective.classTag);
  const casterLevels = Object.fromEntries(
    bases
      .filter(
        (base) => !unresolvedCasterLevels.includes(base.effective.classTag),
      )
      .map((base) => [base.effective.classTag, base.casterLevel?.total ?? 0]),
  );
  const arcaneBases = bases.filter(
    (base) => base.effective.spellKind === 'arcane',
  );
  // A Spellcasting whose kind waits for a choice may be arcane.
  const arcaneCasterLevelUnresolved =
    arcaneBases.some((base) =>
      unresolvedCasterLevels.includes(base.effective.classTag),
    ) || bases.some((base) => base.effective.spellKind === null);
  const arcaneCasterLevel = arcaneCasterLevelUnresolved
    ? undefined
    : Math.max(0, ...arcaneBases.map((base) => base.casterLevel?.total ?? 0));
  const schools = [
    ...new Set([
      ...modifiers
        .filter((modifier) => modifier.target === 'spellDC')
        .flatMap((modifier) =>
          modifier.condition?.school && modifier.condition.school !== '$choice'
            ? [modifier.condition.school]
            : [],
        ),
      ...(options.situationalNotes ?? []).flatMap((note) =>
        note.target === 'spellDC' &&
        note.condition?.school &&
        note.condition.school !== '$choice'
          ? [note.condition.school]
          : [],
      ),
    ]),
  ];
  const features = resolveSpellcastingFeatures(
    input,
    bases.map((base) => ({
      family: base.family,
      classTag: base.effective.classTag,
      classLevel: base.classLevels,
      castableSpellLevels: base.castableSpellLevels,
      effective: base.effective,
    })),
  );
  const spellcastings: ResolvedSpellcasting[] = bases.map(
    ({
      classEntryId,
      family,
      classLevels,
      advances,
      pendingAdvances,
      castingLevel,
      effective,
      row,
      castableSpellLevels,
      casterLevel,
      name,
    }) => {
      const { classTag, casterLevelOffset } = effective;
      const featureFacts = features.byFamily.get(family) ?? {
        extraSlots: [],
        grantedSpells: [],
        school: null,
        choices: [],
      };
      const selected = selectCastingAbility(effective, abilities);
      const { ability } = selected;
      const extraUnresolved = effective.unresolved.includes('extraSlots');
      // One extra slot per kind: several domains give one, a domain and a school two.
      const extra = featureFacts.extraSlots.length;
      const scoped = {
        ...options,
        casterLevels: { ...casterLevels, ...options.casterLevels },
        arcaneCasterLevel: options.arcaneCasterLevel ?? arcaneCasterLevel,
        unresolvedCasterLevels: [
          ...(options.unresolvedCasterLevels ?? []),
          ...unresolvedCasterLevels,
        ],
        arcaneCasterLevelUnresolved:
          (options.arcaneCasterLevelUnresolved ?? false) ||
          arcaneCasterLevelUnresolved,
        castingClass: classTag,
        preModifierCasterLevel:
          casterLevelOffset === null
            ? undefined
            : castingLevel + casterLevelOffset,
      };
      const abilityModifier = ability ? abilities[ability].modifier : null;
      // Bonus spells use the selected ability's permanent score (#238).
      const bonusSpells: readonly number[] = ability
        ? calculateBonusSpells(
            {
              current: { abilities },
              permanent: { abilities: permanentAbilities },
            },
            { baseAbility: ability, spellsPerDay: row?.spellsPerDay ?? [] },
          ).bonusSpells
        : [];
      const casterLevelUnresolved = unresolvedCasterLevels.includes(classTag);
      const classSchools = schools.filter((school) =>
        [...modifiers, ...(options.situationalNotes ?? [])].some(
          (modifier) =>
            modifier.target === 'spellDC' &&
            modifier.condition?.school === school &&
            (!modifier.condition.castingClass ||
              modifier.condition.castingClass === classTag),
        ),
      );
      const concentration =
        casterLevel && !casterLevelUnresolved && abilityModifier !== null
          ? resolve(
              'concentration',
              [
                ...modifiers,
                baseContribution({
                  target: 'concentration',
                  classId: classEntryId,
                  name: 'Caster level',
                  value: casterLevel.total,
                }),
                baseContribution({
                  target: 'concentration',
                  classId: classEntryId,
                  name: 'Casting ability modifier',
                  value: abilityModifier,
                }),
              ],
              scoped,
            )
          : null;
      const slotResults = castableSpellLevels.map((spellLevel) => {
        const base = row?.spellsPerDay[spellLevel] ?? null;
        const bonus = bonusSpells[spellLevel] ?? 0;
        // CRB pp. 38 and 77: the extra slot starts at 1st level.
        const extraSlots = spellLevel > 0 ? extra : 0;
        const { unresolved, ...dc } = resolveSlotDC({
          spellLevel,
          classEntryId,
          abilityModifier: abilityModifier ?? 0,
          modifiers,
          options: scoped,
          schools: classSchools,
          resolve,
        });
        const total =
          base === null ||
          ability === null ||
          (extraUnresolved && spellLevel > 0)
            ? null
            : base + bonus + extraSlots;
        return {
          unresolved: unresolved || abilityModifier === null,
          slot: {
            spellLevel,
            base,
            bonus,
            extra: extraSlots,
            total,
            known: row?.spellsKnown?.[spellLevel] ?? null,
            prepared: row?.preparedPerDay?.[spellLevel] ?? null,
            ...dc,
            dcUnresolved: dc.dcUnresolved || abilityModifier === null,
          },
        };
      });
      const tableUnresolved = effective.table === null;
      const unresolved = [
        ...new Set<string>([
          ...effective.unresolved,
          ...castingUnresolved({
            casterLevel: casterLevelUnresolved,
            concentration:
              (concentration?.warnings.length ?? 0) > 0 ||
              abilityModifier === null,
            spellDC:
              tableUnresolved ||
              slotResults.some((result) => result.unresolved),
          }),
          ...(tableUnresolved && features.slotGrantFamilies.has(family)
            ? (['grantedSpells'] satisfies CastingPropertyKey[])
            : []),
        ]),
      ];
      return {
        classEntryId,
        classTag,
        name,
        type: effective.type,
        spellKind: effective.spellKind,
        record: effective.record,
        ...(effective.bookType ? { bookType: effective.bookType } : {}),
        ability,
        cantrips: effective.cantrips,
        classLevels,
        advances,
        pendingAdvances,
        castingLevel,
        tableLevel: Math.min(MAX_LEVEL, castingLevel),
        casterLevel,
        concentration: concentration?.statistic ?? null,
        castableSpellLevels,
        slots: slotResults.map((result) => result.slot),
        unresolved,
        spellList: effective.spellList,
        castingProperties: selected.properties,
        ...featureFacts,
      };
    },
  );
  return {
    spellcastings,
    castingAdvances: castingAdvances.advances,
    castingWarnings: [
      ...castingAdvances.warnings,
      ...features.warnings,
      ...classes.flatMap((entry) => entry.effective?.warnings ?? []),
    ],
    archetypeCastings: classes.flatMap(
      ({ catalog, family, effective }): ArchetypeCastingSummary[] => {
        if (!effective?.properties.length) return [];
        const resolved = spellcastings.find(
          (casting) => casting.classEntryId === catalog._id,
        );
        return [
          {
            classEntryId: catalog._id,
            name: catalog.name ?? family,
            presence: effective.presence,
            properties: resolved?.castingProperties ?? effective.properties,
          },
        ];
      },
    ),
    casterLevels,
    arcaneCasterLevel,
    unresolvedCasterLevels,
    arcaneCasterLevelUnresolved,
    spellcastingUnresolved,
  };
}

export type CastingPrerequisite =
  | { kind: 'casterLevel'; casterLevel: number }
  | {
      kind: 'canCast';
      canCast: { spellLevel: number; kind?: 'arcane' | 'divine' | 'psychic' };
    }
  | { kind: 'castsSpell'; castsSpell: string }
  | { kind: 'anyOf'; anyOf: CastingPrerequisite[] };
export type CastingPrerequisiteResult = 'met' | 'unmet' | 'unresolved';
export type CastingPrerequisiteInputs = {
  spellcastings: readonly ResolvedSpellcasting[];
  spellcastingUnresolved?: readonly string[];
  spells?: readonly {
    ruleIdentity: string;
    classEntryId: string;
    spellLevel: number;
    source: 'recorded' | 'granted' | 'classList';
  }[];
};

/** Castable levels wait for a pending removal or casting-table choice. */
function castableLevelsPending(
  casting: Pick<ResolvedSpellcasting, 'unresolved'>,
) {
  return (
    casting.unresolved.includes('presence') ||
    casting.unresolved.includes('table')
  );
}

/** Missing modeled inputs stay unresolved; a supported alternative can still qualify. */
export function evaluateCastingPrerequisite(
  clause: CastingPrerequisite,
  inputs: CastingPrerequisiteInputs,
): CastingPrerequisiteResult {
  const unavailable = (inputs.spellcastingUnresolved?.length ?? 0) > 0;
  switch (clause.kind) {
    case 'anyOf': {
      const results = clause.anyOf.map((alternative) =>
        evaluateCastingPrerequisite(alternative, inputs),
      );
      return results.includes('met')
        ? 'met'
        : results.includes('unresolved')
          ? 'unresolved'
          : 'unmet';
    }
    case 'casterLevel': {
      const supported = inputs.spellcastings.filter(
        (casting) => !casting.unresolved.includes('casterLevel'),
      );
      if (
        supported.some(
          (casting) =>
            casting.casterLevel &&
            casting.casterLevel.total >= clause.casterLevel,
        )
      )
        return 'met';
      return unavailable || supported.length < inputs.spellcastings.length
        ? 'unresolved'
        : 'unmet';
    }
    case 'canCast': {
      const { kind, spellLevel } = clause.canCast;
      if (
        inputs.spellcastings.some(
          (casting) =>
            (!kind || casting.spellKind === kind) &&
            casting.castableSpellLevels.includes(spellLevel),
        )
      )
        return 'met';
      // A pending Archetype choice is not a failed prerequisite (#238).
      const pending = inputs.spellcastings.some(
        (casting) =>
          castableLevelsPending(casting) ||
          (kind !== undefined &&
            casting.spellKind === null &&
            casting.castableSpellLevels.includes(spellLevel)),
      );
      return unavailable || pending ? 'unresolved' : 'unmet';
    }
    case 'castsSpell':
      if (!inputs.spells) return 'unresolved';
      if (
        inputs.spells.some(
          (spell) =>
            spell.ruleIdentity === clause.castsSpell &&
            inputs.spellcastings.some(
              (casting) =>
                casting.classEntryId === spell.classEntryId &&
                casting.castableSpellLevels.includes(spell.spellLevel) &&
                (spell.source !== 'classList' || casting.record === 'none'),
            ),
        )
      )
        return 'met';
      return unavailable ||
        inputs.spellcastings.some(
          (casting) =>
            castableLevelsPending(casting) ||
            casting.spellList.classTag === null ||
            casting.spellList.unresolved.includes(clause.castsSpell),
        )
        ? 'unresolved'
        : 'unmet';
    default: {
      const exhaustive: never = clause;
      return exhaustive;
    }
  }
}
