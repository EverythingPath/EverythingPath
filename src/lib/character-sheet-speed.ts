import type {
  ResolvedStatistic,
  SourcedModifier,
  SuppressedModifier,
} from './character-sheet';

/** The heaviest armor (not a shield) the Character wears. */
export type WornArmor = {
  sheetEntryId: string;
  name: string;
  category: 'light' | 'medium' | 'heavy';
};

/**
 * What lifts the armor reduction: Armor Training's movement part, or a trait
 * whose speed "is never modified by armor or encumbrance" (the dwarf's Slow
 * and Steady, PRD advancedRaceGuide/coreRaces/dwarves.html:362).
 */
export type ArmorSpeedExemption = { sheetEntryId: string; name: string };

/**
 * The reduced speed in medium or heavy armor: 20 ft. becomes 15 ft., 30 ft.
 * becomes 20 ft., 40 ft. becomes 30 ft., a third rounded down to 5 ft. steps
 * (CRB Table 6–6; the PRD capture's gnoll in +1 scale mail, base 30 ft., has
 * Speed 20 ft., monsterCodex/gnolls.html:558; Foundry
 * `ActorPF.getReducedMovementSpeed`).
 */
export function reducedSpeed(speed: number) {
  return speed - 5 * Math.floor(speed / 15);
}

/**
 * Armor Training (PRD coreRulebook/classes/fighter.html:384): "a fighter can
 * also move at his normal speed while wearing medium armor. At 7th level, a
 * fighter can move at his normal speed while wearing heavy armor": tier 1
 * (3rd level) for medium armor, tier 2 (7th level) for heavy armor.
 */
export function armorTrainingKeepsSpeed(
  category: WornArmor['category'],
  armorTrainingTier: number,
) {
  if (category === 'medium') return armorTrainingTier >= 1;
  if (category === 'heavy') return armorTrainingTier >= 2;
  return true;
}

/**
 * Land speed (owner 2026-11-17): the `speed.land` statistic, its race's
 * `base` speed and its typed bonuses, reduced while medium or heavy armor is
 * worn, after the bonuses (CRB barbarian.html:381: "Apply this bonus before
 * modifying the barbarian's speed because of any load carried or armor
 * worn"). Null without a `base` speed: no race gives one, so the sheet shows
 * none. Load and encumbrance are not tracked; the reduction is armor's only.
 */
export function deriveLandSpeed({
  statistic,
  wornArmor,
  armorTrainingTier,
  exemption,
}: {
  statistic: ResolvedStatistic;
  wornArmor?: WornArmor;
  armorTrainingTier: number;
  exemption?: ArmorSpeedExemption;
}): ResolvedStatistic | null {
  if (!statistic.applied.some((modifier) => modifier.bonusType === 'base'))
    return null;
  if (
    !wornArmor ||
    wornArmor.category === 'light' ||
    statistic.total <= 0 ||
    reducedSpeed(statistic.total) === statistic.total
  )
    return statistic;
  const reduction: SourcedModifier = {
    target: 'speed.land',
    bonusType: 'untyped',
    value: reducedSpeed(statistic.total) - statistic.total,
    sheetEntryId: wornArmor.sheetEntryId,
    entryName: `${wornArmor.name} (${wornArmor.category} armor)`,
    source: wornArmor.sheetEntryId,
    builtIn: true,
  };
  const lifted: SuppressedModifier | undefined = exemption
    ? {
        ...reduction,
        suppressedBy: exemption.sheetEntryId,
        reason: `${exemption.name}: speed is never modified by armor.`,
        reasonNamesSuppressor: true,
      }
    : armorTrainingKeepsSpeed(wornArmor.category, armorTrainingTier)
      ? {
          ...reduction,
          suppressedBy: 'builtin:armor-training',
          reason: `Armor Training ${armorTrainingTier}: moves at normal speed in ${wornArmor.category} armor.`,
          reasonNamesSuppressor: true,
        }
      : undefined;
  if (lifted)
    return { ...statistic, suppressed: [...statistic.suppressed, lifted] };
  return {
    ...statistic,
    total: statistic.total + reduction.value,
    applied: [...statistic.applied, reduction],
  };
}
