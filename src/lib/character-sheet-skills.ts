import {
  abilityLabels,
  builtIn,
  composeStatistics,
  type Ability,
  type LeafTarget,
  type ResolvedStatistic,
  type SourcedModifier,
} from './character-sheet';
import type { resolveEquipment } from './character-sheet-equipment';
import type { resolveAdvancement } from './character-sheet-advancement';

import {
  skillDefinitions,
  type SkillTarget,
} from './character-sheet-skill-definitions';
export {
  skillDefinitions,
  type SkillTarget,
} from './character-sheet-skill-definitions';

export type SkillRankBudget = {
  kind: 'ordinary' | 'animalCompanion' | 'eidolon';
  skillRanks: number | null;
  skillRankCap: number;
};
// Companion budgets follow their own progression rules; ordinary level budgets
// must not be reused for fixed or allocated companion budgets.

export function ordinarySkillRanksPerLevel({
  baseRanks,
  intelligence,
  racialRanks = 0,
  favoredClassRanks = 0,
}: {
  baseRanks: number;
  intelligence: number;
  racialRanks?: number;
  favoredClassRanks?: number;
}) {
  return (
    Math.max(1, baseRanks + intelligence) + racialRanks + favoredClassRanks
  );
}

export const skillKeyPrefix = 'skill.';

export function canonicalSkillKey(key: string): SkillTarget | undefined {
  return skillDefinitions.find(
    (skill) =>
      skill.key === key || skill.key.slice(skillKeyPrefix.length) === key,
  )?.key;
}

export function sumRanksBySkill(record: Readonly<Record<string, number>>) {
  const totals: Partial<Record<SkillTarget, number>> = {};
  for (const [key, ranks] of Object.entries(record)) {
    const skill = canonicalSkillKey(key);
    if (skill) totals[skill] = (totals[skill] ?? 0) + ranks;
  }
  return totals;
}

function rankContributions(advancement: ReturnType<typeof resolveAdvancement>) {
  return advancement.rows.map(({ entry }) => ({
    entryId: entry._id,
    position: entry.state.position,
    ranks: sumRanksBySkill(entry.state.skillRanks ?? {}),
  }));
}

export function recordedSkillRankFacts(
  advancement: ReturnType<typeof resolveAdvancement>,
) {
  if (
    advancement.companion &&
    advancement.companion.status !== 'active' &&
    !advancement.companion.state.keep
  )
    return null;
  const totals = sumRanksBySkill(
    Object.fromEntries(advancement.racialRecordedRanks),
  );
  for (const { ranks } of rankContributions(advancement))
    for (const [key, value] of Object.entries(ranks)) {
      const skill = canonicalSkillKey(key);
      if (skill) totals[skill] = (totals[skill] ?? 0) + (value ?? 0);
    }
  return totals;
}

function classSkills(advancement: ReturnType<typeof resolveAdvancement>) {
  return new Set(
    [
      ...advancement.racialClassSkills,
      ...advancement.rows.flatMap(({ detail }) => detail?.classSkills ?? []),
    ].flatMap((skill) => {
      const key = canonicalSkillKey(skill);
      return key ? [key] : [];
    }),
  );
}

function appliesArmorCheckPenalty(ability: Ability) {
  return ability === 'strength' || ability === 'dexterity';
}

function rankModifier(source: Parameters<typeof builtIn>[0]) {
  return source.value ? [builtIn({ ...source, isBase: true })] : [];
}

export type SkillCalculationRules = {
  baselineRanks?: Partial<Record<SkillTarget, number>>;
  classSkills?: readonly SkillTarget[];
  minimumRanks?: Partial<Record<SkillTarget, number | null>>;
  abilityOverrides?: Partial<Record<SkillTarget, Ability>>;
  modifiers?: (input: {
    skill: SkillTarget;
    ranks: number;
  }) => SourcedModifier[];
};

export function resolveSkills({
  advancement,
  abilities,
  breakdowns,
  equipment,
  rules = {},
}: {
  advancement: ReturnType<typeof resolveAdvancement>;
  abilities: Record<Ability, { modifier: number }>;
  breakdowns: Readonly<Record<LeafTarget, ResolvedStatistic>>;
  equipment: ReturnType<typeof resolveEquipment>;
  rules?: SkillCalculationRules;
}) {
  const rankedLevels = rankContributions(advancement);
  const racialRanks = sumRanksBySkill(
    Object.fromEntries(advancement.racialRecordedRanks),
  );
  const availableClassSkills = classSkills(advancement);
  for (const key of rules.classSkills ?? []) availableClassSkills.add(key);
  const skillBreakdowns: Partial<Record<SkillTarget, ResolvedStatistic>> = {};
  const skills = skillDefinitions.map(
    ({ key, name, ability: ordinaryAbility }) => {
      const ability = rules.abilityOverrides?.[key] ?? ordinaryAbility;
      const ordinaryRankModifiers: SourcedModifier[] = [
        ...(rules.baselineRanks && racialRanks[key] === undefined
          ? rankModifier({
              target: key,
              id: 'creature-ranks',
              name: 'Creature ranks',
              value: rules.baselineRanks[key] ?? 0,
            })
          : []),
        ...rankModifier({
          target: key,
          id: 'racial-ranks',
          name: 'Racial ranks',
          value: racialRanks[key] ?? 0,
        }),
        ...rankedLevels.flatMap((level) =>
          rankModifier({
            target: key,
            id: level.entryId,
            sheetEntryId: level.entryId,
            name: `Class Level ${level.position} ranks`,
            value: level.ranks[key] ?? 0,
          }),
        ),
      ];
      const ownRanks = ordinaryRankModifiers.reduce(
        (sum, modifier) => sum + modifier.value,
        0,
      );
      const recordedRanks =
        (racialRanks[key] ?? 0) +
        rankedLevels.reduce((sum, level) => sum + (level.ranks[key] ?? 0), 0);
      const minimumRanks = rules.minimumRanks?.[key];
      const rankModifiers =
        minimumRanks == null
          ? ordinaryRankModifiers
          : rankModifier({
              target: key,
              id: 'companion-ranks',
              name: 'Companion ranks',
              value: Math.max(ownRanks, minimumRanks),
            });
      const ranks = rankModifiers.reduce(
        (sum, modifier) => sum + modifier.value,
        0,
      );
      const classSkill = availableClassSkills.has(key);
      const skillArmor = appliesArmorCheckPenalty(ability)
        ? equipment.items
        : [];
      skillBreakdowns[key] = composeStatistics({
        stackBonuses: true,
        statistics: [breakdowns[key]],
        builtIns: [
          ...rankModifiers,
          ...(rules.modifiers?.({ skill: key, ranks }) ?? []),
          builtIn({
            target: key,
            id: `${key}:ability`,
            name: abilityLabels[ability],
            value: abilities[ability].modifier,
          }),
          ...(ranks > 0 && classSkill
            ? [
                builtIn({
                  target: key,
                  id: `${key}:class`,
                  name: 'Class skill',
                  value: 3,
                }),
              ]
            : []),
          // Its own Source, so it stacks with the item's own untyped penalties.
          ...skillArmor.map(({ entryId, name, armorCheckPenalty }) =>
            builtIn({
              target: key,
              id: `armor-check-penalty:${entryId}`,
              name: `${name} armor check penalty`,
              value: armorCheckPenalty,
            }),
          ),
        ],
        includes: () => true,
        name,
      });
      return {
        key,
        name,
        ability,
        ranks,
        recordedRanks,
        ownRanks,
        classSkill,
        armorCheckPenalty: skillArmor.reduce(
          (sum, item) => sum + item.armorCheckPenalty,
          0,
        ),
      };
    },
  );
  return { skills, breakdowns: skillBreakdowns, warnings: equipment.warnings };
}
