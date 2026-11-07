import { resolveCompanionProgression } from './character-sheet-companion-progression';
import {
  resolveCharacterSheetArchetypes,
  type ResolvedCharacterSheetArchetypes,
} from './character-sheet-archetypes';
import { characterSheetClassFamily } from './character-sheet-grants';
import { classProgressionEntryId } from './character-sheet-class-levels';
import {
  abilityTargets,
  type CharacterSheetCatalogEntry,
  type CharacterSheetClassDetail,
  type CharacterSheetInput,
  type ModifierTarget,
  type SheetEntry,
  type SheetWarning,
  type SourcedModifier,
  type InputSourcedModifier,
  type ResolveOptions,
} from './character-sheet';
import {
  eidolonSkillRanksPerHitDie,
  eidolonTableSkillRanksPerHitDie,
} from './character-sheet-companion-components';
import {
  sumRanksBySkill,
  ordinarySkillRanksPerLevel,
  type SkillRankBudget,
} from './character-sheet-skills';

type Progression = Pick<CharacterSheetClassDetail, 'bab' | 'saves'> &
  Partial<Pick<CharacterSheetClassDetail, 'classKind'>>;

function contribution({
  target,
  value,
  entryId,
  name,
  source = entryId,
}: {
  target: ModifierTarget;
  value: number;
  entryId: string;
  name: string;
  source?: string;
}): SourcedModifier {
  return {
    target,
    value,
    sheetEntryId: entryId,
    entryName: name,
    source,
    bonusType: 'untyped',
    builtIn: true,
  };
}

function progressionModifiers({
  progression,
  count,
  entryId,
  name,
}: {
  progression: Progression;
  count: number;
  entryId: string;
  name: string;
}): SourcedModifier[] {
  const babRates = { full: 1, threeQuarters: 0.75, half: 0.5 };
  const babRate = babRates[progression.bab];
  return [
    contribution({
      target: 'bab',
      value: Math.floor(count * babRate),
      entryId,
      name,
    }),
    ...(['fort', 'ref', 'will'] as const).map((save) => {
      const goodSave = progression.saves[save] === 'good';
      let value: number;
      if (progression.classKind === 'prestige')
        value = Math.floor((count + 1) / (goodSave ? 2 : 3));
      else if (goodSave) value = 2 + Math.floor(count / 2);
      else value = Math.floor(count / 3);
      return contribution({ target: `save.${save}`, value, entryId, name });
    }),
  ];
}

function resolveClassRows({
  entries,
  catalogEntries,
  archetypes,
}: Pick<CharacterSheetInput, 'entries' | 'catalogEntries'> & {
  archetypes: ResolvedCharacterSheetArchetypes;
}) {
  const levels = entries
    .filter((entry) => entry.kind === 'classLevel')
    .sort((a, b) => a.state.position - b.state.position);
  const classes = new Map<
    string,
    {
      catalog: CharacterSheetCatalogEntry;
      detail: CharacterSheetClassDetail;
      count: number;
    }
  >();
  const rows = levels.map((entry) => {
    if (entry.state.classEntryId === null)
      return { entry, classLevel: null, catalog: null, detail: null };
    const catalog = catalogEntries.find(
      (item) => item._id === entry.state.classEntryId,
    );
    if (
      !catalog ||
      catalog.detail?.kind !== 'class' ||
      !('bab' in catalog.detail)
    )
      return {
        entry: { ...entry, state: { ...entry.state, classEntryId: null } },
        classLevel: null,
        catalog: null,
        detail: null,
      };
    const effects = archetypes.classes.find(
      (row) => row.classEntryId === catalog._id,
    );
    const effectiveDetail = effects
      ? {
          ...catalog.detail,
          classSkills: effects.classSkills,
          skillRanksPerLevel:
            effects.skillRanksPerLevel ?? catalog.detail.skillRanksPerLevel,
        }
      : catalog.detail;
    const source = classes.get(catalog.ruleIdentity);
    const classLevel = (source?.count ?? 0) + 1;
    if (source) source.count = classLevel;
    else
      classes.set(catalog.ruleIdentity, {
        catalog,
        detail: effectiveDetail,
        count: classLevel,
      });
    return {
      entry,
      classLevel,
      catalog,
      detail: effectiveDetail,
      skillRankBudgetUnresolved: effects?.skillRanksPerLevel === null,
    };
  });
  return { levels: rows.map((row) => row.entry), rows, classes };
}

function classModifiersFor(
  classes: ReturnType<typeof resolveClassRows>['classes'],
) {
  return [...classes.values()].flatMap(({ catalog, detail, count }) => [
    ...progressionModifiers({
      progression: detail,
      count,
      entryId: classProgressionEntryId(catalog.ruleIdentity),
      name: `${catalog.name ?? 'Class'} ${count}`,
    }),
    ...catalog.modifiers.flatMap(
      (modifier, modifierIndex): InputSourcedModifier[] =>
        modifier.target === 'ability.$choice'
          ? []
          : [
              {
                modifierIndex,
                ...modifier,
                target: modifier.target,
                sheetEntryId: `class:${catalog.ruleIdentity}`,
                entryName: catalog.name ?? 'Class',
                source: catalog.sourceKey ?? catalog.ruleIdentity,
                builtIn: false,
                stacksWithItself: catalog.stacksWithItself,
              },
            ],
    ),
  ]);
}

function resolveRacialProgression(
  racial: CharacterSheetInput['racialHitDice'],
) {
  const racialHitDice = racial?.count ?? 0;
  const missingRacialHp = racialHitDice > 0 && racial?.hpGained == null;
  const racialModifiers =
    racial && racialHitDice > 0
      ? [
          ...(racial.progression
            ? progressionModifiers({
                progression: racial.progression,
                count: racialHitDice,
                entryId: 'builtin:racial',
                name: `Racial Hit Dice ${racialHitDice}`,
              })
            : []),
          ...(racial.hpGained === null
            ? []
            : [
                contribution({
                  target: 'hp',
                  value: racial.hpGained,
                  entryId: 'builtin:racial-hp',
                  name: 'Racial hit points',
                }),
              ]),
        ]
      : [];
  return {
    racialHitDice,
    missingRacialHp,
    modifiers: racialModifiers,
    missingRacialProgression: racialHitDice > 0 && !racial?.progression,
    racialSkillRanksPerHitDie: racial?.progression?.skillRanksPerHitDie ?? 0,
  };
}

function abilityIncreaseModifiersFor(
  levels: readonly Extract<SheetEntry, { kind: 'classLevel' }>[],
) {
  return levels.flatMap((entry) =>
    entry.state.abilityIncrease
      ? [
          contribution({
            target: abilityTargets[entry.state.abilityIncrease],
            value: 1,
            entryId: entry._id,
            name: `Class Level ${entry.state.position} ability increase`,
            source: `ability-increase:${entry._id}`,
          }),
        ]
      : [],
  );
}

function hpModifiersFor(
  levels: readonly Extract<SheetEntry, { kind: 'classLevel' }>[],
) {
  return levels.flatMap((entry) => [
    ...(entry.state.hpGained === null
      ? []
      : [
          contribution({
            target: 'hp',
            value: entry.state.hpGained,
            entryId: entry._id,
            name: `Class Level ${entry.state.position}`,
            source: `hp:${entry._id}`,
          }),
        ]),
    ...(entry.state.favoredClassBonus?.choice === 'hp'
      ? [
          contribution({
            target: 'hp',
            value: 1,
            entryId: `favored-hp:${entry._id}`,
            name: `Class Level ${entry.state.position} favored class`,
          }),
        ]
      : []),
  ]);
}

function classLevelCountsFor(
  rows: ReturnType<typeof resolveClassRows>['rows'],
  catalogEntries: readonly CharacterSheetCatalogEntry[],
) {
  const classLevels = new Map<string, number>();
  for (const { catalog } of rows) {
    if (!catalog) continue;
    const identities = new Set([
      catalog.ruleIdentity,
      characterSheetClassFamily(catalog, catalogEntries),
    ]);
    for (const identity of identities)
      classLevels.set(identity, (classLevels.get(identity) ?? 0) + 1);
  }
  return Object.fromEntries(classLevels);
}

export function resolveAdvancement(
  input: CharacterSheetInput,
  {
    archetypes = resolveCharacterSheetArchetypes(input),
    companionProgressionSources,
    companionLinkedInputs,
  }: Pick<
    ResolveOptions,
    'companionProgressionSources' | 'companionLinkedInputs'
  > & {
    archetypes?: ResolvedCharacterSheetArchetypes;
  } = {},
) {
  const { levels, rows, classes } = resolveClassRows({ ...input, archetypes });
  const racial = resolveRacialProgression(input.racialHitDice);
  const companion = resolveCompanionProgression({
    state: input.companionProgression,
    sources: companionProgressionSources,
    linkedInputs: companionLinkedInputs,
    entries: input.entries,
    catalogEntries: input.catalogEntries,
  });
  const replacesBaseline = companion && companion.status !== 'dormant';
  const countsCompanionChoices =
    companion !== null &&
    (companion.status !== 'dormant' || companion.state.keep);
  const classModifiers = classModifiersFor(classes);
  const hitDiceUnresolved = companion
    ? companion.status !== 'active'
    : Boolean(companionProgressionSources?.length);
  const baselineModifiers = replacesBaseline
    ? companion.modifiers
    : racial.modifiers;
  function baseStatistics({ includeRacial }: { includeRacial: boolean }) {
    const unresolved =
      rows.some((row) => row.classLevel === null) ||
      (includeRacial &&
        (hitDiceUnresolved ||
          (!replacesBaseline && racial.missingRacialProgression)));
    const modifiers = includeRacial
      ? [...classModifiers, ...baselineModifiers]
      : classModifiers;
    function total(target: ModifierTarget) {
      if (unresolved) return null;
      return modifiers
        .filter((modifier) => modifier.builtIn && modifier.target === target)
        .reduce(
          (sum, modifier) =>
            sum + (typeof modifier.value === 'number' ? modifier.value : 0),
          0,
        );
    }
    return {
      bab: total('bab'),
      saves: {
        fort: total('save.fort'),
        ref: total('save.ref'),
        will: total('save.will'),
      },
    };
  }
  return {
    ownProgression: {
      classBases: baseStatistics({ includeRacial: false }),
      totalBases: baseStatistics({ includeRacial: true }),
    },
    levels,
    rows,
    classLevelCounts: classLevelCountsFor(rows, input.catalogEntries),
    racialHitDice: racial.racialHitDice,
    hitDice:
      (replacesBaseline ? (companion.hitDice ?? 0) : racial.racialHitDice) +
      levels.length,
    hitDiceUnresolved,
    companion,
    baselineHitDice: replacesBaseline
      ? (companion.hitDice ?? 0)
      : racial.racialHitDice,
    missingRacialHp: replacesBaseline
      ? companion.state.hpGained === null
      : racial.missingRacialHp,
    missingRacialProgression: replacesBaseline
      ? false
      : racial.missingRacialProgression,
    racialRecordedRanks: countsCompanionChoices
      ? Object.entries(companion.state.skillRanks)
      : racial.racialHitDice > 0
        ? input.entries
            .filter((entry) => entry.kind === 'race')
            .flatMap((entry) =>
              Object.entries(entry.state.racialSkillRanks ?? {}),
            )
        : [],
    racialSkillRanksPerHitDie: racial.racialSkillRanksPerHitDie,
    racialClassSkills: countsCompanionChoices
      ? companion.classSkills
      : racial.racialHitDice > 0
        ? (input.racialHitDice?.progression?.classSkills ?? [])
        : [],
    modifiers: [
      ...classModifiers,
      ...baselineModifiers,
      ...(!replacesBaseline && companion?.state.keep
        ? companion.modifiers
        : []),
      ...abilityIncreaseModifiersFor(levels),
      ...hpModifiersFor(levels),
    ],
  };
}

const milestones = new Set([4, 8, 12, 16, 20]);

function hasCompleteAbilityIncreases(
  advancement: ReturnType<typeof resolveAdvancement>,
) {
  return [0, advancement.racialHitDice].some((offset) =>
    advancement.levels.every(
      (entry) =>
        !milestones.has(entry.state.position + offset) ||
        Boolean(entry.state.abilityIncrease),
    ),
  );
}

export function generalFeatBudget(hitDice: number) {
  return Math.ceil(hitDice / 2);
}

/**
 * A companion table's explicit budgets take precedence over the ordinary
 * per-HD formulas for the companion's own Hit Dice (#249): a Broodmaster
 * eidolon's divided feats and ranks are not reconstructed from its HD.
 */
function explicitCompanionBudgets(
  advancement: Pick<ReturnType<typeof resolveAdvancement>, 'companion'>,
) {
  const { companion } = advancement;
  return companion?.kind === 'eidolon' && companion.status === 'active'
    ? companion.explicitBudgets
    : null;
}

/** General feats: the ordinary HD formula, or the companion's explicit feats. */
export function advancementGeneralFeats(
  advancement: Pick<
    ReturnType<typeof resolveAdvancement>,
    'companion' | 'hitDice' | 'baselineHitDice'
  >,
) {
  const explicit = explicitCompanionBudgets(advancement)?.generalFeats;
  if (explicit === undefined) return generalFeatBudget(advancement.hitDice);
  // Class Levels on the same creature still add feats by total HD.
  return (
    explicit +
    generalFeatBudget(advancement.hitDice) -
    generalFeatBudget(advancement.baselineHitDice)
  );
}

/**
 * APG Table 2–9 Skills: 6 + Int modifier per HD. A brood eidolon's allocated
 * ranks are the column at the base forms' Int; "Eidolons with Intelligence
 * scores above the base value modify these totals as normal", so its own Int
 * adjusts them per allocated HD.
 */
function eidolonSkillRanks({
  hitDice,
  intelligence,
  allocated,
}: {
  hitDice: number;
  intelligence: number;
  allocated: number | undefined;
}) {
  const perHitDie = eidolonSkillRanksPerHitDie(intelligence);
  if (allocated === undefined) return hitDice * perHitDie;
  return Math.max(
    0,
    allocated + hitDice * (perHitDie - eidolonTableSkillRanksPerHitDie),
  );
}

export function advancementBudgets({
  advancement,
  intelligence,
  bonusSkillRanksPerLevel = 0,
}: {
  advancement: ReturnType<typeof resolveAdvancement>;
  intelligence: number;
  bonusSkillRanksPerLevel?: number;
}) {
  const cumulativeRanks = new Map<string, number>();
  function addRanks(ranks: Record<string, number>) {
    for (const [skill, ranksGained] of Object.entries(sumRanksBySkill(ranks)))
      cumulativeRanks.set(
        skill,
        (cumulativeRanks.get(skill) ?? 0) + ranksGained,
      );
  }

  const racialSkillRanks = advancement.missingRacialProgression
    ? null
    : advancement.companion && advancement.companion.status !== 'dormant'
      ? advancement.companion.hitDice === null
        ? null
        : advancement.companion.kind === 'eidolon'
          ? eidolonSkillRanks({
              hitDice: advancement.companion.hitDice,
              intelligence,
              allocated: explicitCompanionBudgets(advancement)?.skillRanks,
            })
          : advancement.companion.hitDice * (1 + Math.max(0, intelligence))
      : advancement.racialHitDice *
        ordinarySkillRanksPerLevel({
          baseRanks: advancement.racialSkillRanksPerHitDie,
          intelligence,
        });
  addRanks(Object.fromEntries(advancement.racialRecordedRanks));
  const classLevels = advancement.rows.map(
    ({ entry, detail, classLevel, skillRankBudgetUnresolved }) => {
      addRanks(entry.state.skillRanks ?? {});
      const hitDice = advancement.baselineHitDice + entry.state.position;
      const skillRankCap = advancement.baselineHitDice + entry.state.position;
      const cumulativeSkillRanks = [...cumulativeRanks].map(
        ([skill, ranks]) => ({
          skill,
          ranks,
        }),
      );
      const skillRankBudget =
        detail && !skillRankBudgetUnresolved
          ? ordinarySkillRanksPerLevel({
              baseRanks: detail.skillRanksPerLevel,
              intelligence,
              racialRanks: bonusSkillRanksPerLevel,
              favoredClassRanks:
                entry.state.favoredClassBonus?.choice === 'skill' ? 1 : 0,
            })
          : null;
      const skillRanksSpent = Object.values(
        sumRanksBySkill(entry.state.skillRanks ?? {}),
      ).reduce((sum, ranks) => sum + ranks, 0);
      return {
        entryId: entry._id,
        position: entry.state.position,
        classEntryId: entry.state.classEntryId,
        classLevel,
        hitDice,
        abilityIncreaseDue:
          milestones.has(entry.state.position) || milestones.has(hitDice),
        skillRankBudget,
        skillRanksSpent,
        skillRanksRemaining:
          skillRankBudget === null ? null : skillRankBudget - skillRanksSpent,
        skillRankCap,
        cumulativeSkillRanks,
        exceededSkillRankCaps: cumulativeSkillRanks.filter(
          ({ ranks }) => ranks > skillRankCap,
        ),
      };
    },
  );
  const budgets = {
    kind: !advancement.companion
      ? ('ordinary' as const)
      : advancement.companion.kind === 'eidolon'
        ? ('eidolon' as const)
        : ('animalCompanion' as const),
    intelligenceModifier: intelligence,
    generalFeats: advancementGeneralFeats(advancement),
    racialSkillRanks,
    skillRanks: classLevels.reduce<number | null>(
      (sum, level) =>
        sum === null || level.skillRankBudget === null
          ? null
          : sum + level.skillRankBudget,
      racialSkillRanks,
    ),
    skillRankCap: advancement.hitDice,
  };
  return { classLevels, budgets: budgets satisfies SkillRankBudget };
}

function levelRankBudgetWarning(
  level: ReturnType<typeof advancementBudgets>['classLevels'][number],
): SheetWarning | undefined {
  const target = {
    kind: 'classLevel' as const,
    entryId: level.entryId,
    field: 'skillRanks' as const,
  };
  const subject = level.entryId;
  if (level.skillRankBudget === null)
    return {
      kind: 'unresolved',
      check: 'skillRankBudgetUnresolved',
      target,
      subject,
      message: 'Choose a class to calculate this level’s skill rank budget.',
      fingerprint: JSON.stringify([level.classEntryId, null]),
    };
  const fingerprint = JSON.stringify([
    level.skillRankBudget,
    level.skillRanksSpent,
  ]);
  if (level.skillRanksRemaining !== null && level.skillRanksRemaining < 0)
    return {
      kind: 'rules',
      check: 'skillRankBudget',
      target,
      subject,
      fingerprint,
      message: `Recorded ranks exceed this level’s ${level.skillRankBudget}-rank budget.`,
    };
  if (level.skillRanksRemaining !== null && level.skillRanksRemaining > 0)
    return {
      kind: 'incomplete',
      check: 'skillRanksUnspent',
      target,
      subject,
      fingerprint,
      message: `${level.skillRanksRemaining} skill ${level.skillRanksRemaining === 1 ? 'rank remains' : 'ranks remain'} to allocate.`,
    };
}

export function advancementWarnings({
  characterKind,
  advancement,
  classLevels,
  favoredClassIds,
  favoredClassCount,
  catalogEntries,
}: {
  characterKind: CharacterSheetInput['characterKind'];
  advancement: ReturnType<typeof resolveAdvancement>;
  classLevels: ReturnType<typeof advancementBudgets>['classLevels'];
  favoredClassIds: readonly string[];
  favoredClassCount: number;
  catalogEntries: readonly CharacterSheetCatalogEntry[];
}): SheetWarning[] {
  const warnings: SheetWarning[] = [];
  const hasCompleteMilestoneReading = hasCompleteAbilityIncreases(advancement);
  const versions = new Map<string, Set<string>>();
  for (const { catalog, detail } of advancement.rows) {
    if (!catalog || !detail) continue;
    const identity = characterSheetClassFamily(catalog, catalogEntries);
    const group = versions.get(identity) ?? new Set<string>();
    group.add(catalog.ruleIdentity);
    versions.set(identity, group);
  }
  for (const [identity, group] of versions) {
    if (group.size < 2) continue;
    warnings.push({
      kind: 'rules',
      check: 'classVersions',
      subject: `class:${identity}`,
      target: { kind: 'classLevels' },
      message:
        'Original and Unchained versions of the same class are both present.',
      fingerprint: JSON.stringify([...group].sort()),
    });
  }
  for (const id of favoredClassIds) {
    const catalog = catalogEntries.find((entry) => entry._id === id);
    if (
      catalog?.detail?.kind === 'class' &&
      'classKind' in catalog.detail &&
      catalog.detail.classKind === 'prestige'
    )
      warnings.push({
        kind: 'rules',
        check: 'favoredClassPrestige',
        // The durable identity, so a Catalog Copy switch keeps acceptance.
        subject: `class:${catalog.ruleIdentity}`,
        target: { kind: 'favoredClasses' },
        message: `${catalog.name ?? 'A prestige class'} cannot normally be a favored class.`,
        fingerprint: JSON.stringify([catalog.ruleIdentity, 'prestige']),
      });
  }
  const favorites = favoredClassIds
    .flatMap((id) => {
      const catalog = catalogEntries.find((entry) => entry._id === id);
      if (!catalog || catalog.detail?.kind !== 'class') return [];
      return [characterSheetClassFamily(catalog, catalogEntries)];
    })
    .sort();
  const favoredIdentities = [...new Set(favorites)];
  if (favoredIdentities.length > favoredClassCount)
    warnings.push({
      kind: 'rules',
      check: 'favoredClassCount',
      subject: 'sheet',
      target: { kind: 'favoredClasses' },
      message: `Choose up to ${favoredClassCount} favored ${favoredClassCount === 1 ? 'class' : 'classes'}.`,
      fingerprint: JSON.stringify([favoredClassCount, favoredIdentities]),
    });
  for (const row of advancement.rows) {
    const { entry, catalog, detail } = row;
    const metadata = classLevels.find((level) => level.entryId === entry._id);
    if (!metadata) continue;
    function warn({
      check,
      field,
      message,
      facts,
      kind = 'rules',
    }: {
      check: SheetWarning['check'];
      field: Extract<SheetWarning['target'], { kind: 'classLevel' }>['field'];
      message: string;
      facts: unknown;
      kind?: SheetWarning['kind'];
    }) {
      warnings.push({
        kind,
        check,
        subject: entry._id,
        target: { kind: 'classLevel', entryId: entry._id, field },
        message,
        fingerprint: JSON.stringify(facts),
      });
    }
    if (
      characterKind === 'pc' &&
      advancement.racialHitDice === 0 &&
      advancement.rows[0] === row &&
      detail &&
      entry.state.hpGained !== null &&
      entry.state.hpGained !== detail.hitDie
    )
      warn({
        check: 'firstLevelHpNotMaximum',
        field: 'hpGained',
        message: `A PC's first Class Level normally gains ${detail.hitDie} hit points.`,
        facts: [
          'pc',
          0,
          entry.state.position,
          detail.hitDie,
          entry.state.hpGained,
        ],
      });
    if (
      detail &&
      entry.state.hpGained !== null &&
      entry.state.hpGained > detail.hitDie
    )
      warn({
        check: 'hpGainedAboveMaximum',
        field: 'hpGained',
        message: `Hit points gained exceed the d${detail.hitDie} maximum.`,
        facts: [detail.hitDie, entry.state.hpGained],
      });
    if (
      !hasCompleteMilestoneReading &&
      !entry.state.abilityIncrease &&
      metadata.abilityIncreaseDue
    )
      warn({
        kind: 'incomplete',
        check: 'abilityIncreaseMissing',
        field: 'abilityIncrease',
        message: 'Choose an ability increase.',
        facts: [entry.state.position, metadata.hitDice, null],
      });
    if (entry.state.abilityIncrease && !metadata.abilityIncreaseDue)
      warn({
        check: 'abilityIncreaseMilestone',
        field: 'abilityIncrease',
        message: 'This level is outside the ability-increase milestones.',
        facts: [
          entry.state.position,
          metadata.hitDice,
          entry.state.abilityIncrease,
        ],
      });
    const classIdentity = catalog
      ? characterSheetClassFamily(catalog, catalogEntries)
      : undefined;
    const favored =
      detail?.classKind !== 'prestige' &&
      classIdentity !== undefined &&
      favorites.includes(classIdentity);
    if (favored && !entry.state.favoredClassBonus)
      warn({
        kind: 'incomplete',
        check: 'favoredClassBonusMissing',
        field: 'favoredClassBonus',
        message: 'Choose a favored class bonus.',
        facts: [classIdentity, true, null],
      });
    if (!favored && entry.state.favoredClassBonus)
      warn({
        check: 'favoredClassBonusNotFavored',
        field: 'favoredClassBonus',
        message: 'This level is outside your favored classes.',
        facts: [
          classIdentity ?? null,
          detail?.classKind ?? null,
          favored,
          entry.state.favoredClassBonus.choice,
        ],
      });
    if (metadata.exceededSkillRankCaps.length)
      warn({
        check: 'skillRankCap',
        field: 'skillRanks',
        message: `Recorded ranks exceed the ${metadata.skillRankCap}-rank limit at this level.`,
        facts: [
          entry.state.position,
          metadata.skillRankCap,
          [...metadata.exceededSkillRankCaps].sort((a, b) =>
            a.skill.localeCompare(b.skill),
          ),
        ],
      });
    const budgetWarning = levelRankBudgetWarning(metadata);
    if (budgetWarning) warnings.push(budgetWarning);
  }
  return warnings;
}
