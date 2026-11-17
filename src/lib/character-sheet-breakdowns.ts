import type { AttackStatistic } from './character-sheet-attacks';
import { z } from 'zod';
import {
  bonusTypes,
  leafTargets,
  modifierConditionSchema,
  modifierTargets,
  sourcedSituationalNoteSchema,
  type LeafTarget,
  type ResolvedStatistic,
  type calculateCharacterSheet,
} from './character-sheet';

const sourcedModifierSchema = z.object({
  modifierIndex: z.number().int().min(0).optional(),
  catalogEntryId: z.string().optional(),
  target: z.enum(modifierTargets),
  bonusType: z.enum(bonusTypes),
  value: z.number(),
  condition: modifierConditionSchema.optional(),
  stacksWithinEntry: z.literal(true).optional(),
  sheetEntryId: z.string(),
  entryName: z.string(),
  source: z.string(),
  builtIn: z.boolean(),
  stacksWithItself: z.boolean().optional(),
});
const breakdownsSchema = z.record(
  z.enum(leafTargets),
  z.object({
    total: z.number(),
    applied: z.array(sourcedModifierSchema),
    suppressed: z.array(
      sourcedModifierSchema.extend({
        reason: z.string(),
        suppressedBy: z.string(),
      }),
    ),
    conditional: z.array(sourcedModifierSchema),
    excluded: z.array(sourcedModifierSchema).optional(),
    notes: z.array(sourcedSituationalNoteSchema).optional(),
  }),
);

export function parseCharacterSheetBreakdowns(
  breakdowns: unknown,
): Record<LeafTarget, ResolvedStatistic> {
  return breakdownsSchema.parse(breakdowns);
}

type CalculatedStatistics = Pick<
  ReturnType<typeof calculateCharacterSheet>,
  'breakdowns' | 'derivedStatistics' | 'spellcastings' | 'attackRoutines'
>;
type CastingStatistic =
  | { kind: 'casterLevel' | 'concentration' }
  | { kind: 'dc'; spellLevel: number; school?: string };

export type CharacterSheetBreakdownTarget =
  | LeafTarget
  | {
      kind: 'attackRoutine';
      entryId: string;
      sequence: 'single' | 'full';
      attackIndex: number;
      statistic: AttackStatistic;
    }
  | { kind: 'twoWeaponRend'; entryId: string }
  /** The base attack bonus a routine's flurry of blows attacks use (#414). */
  | { kind: 'flurryBaseAttack'; entryId: string }
  | {
      kind: 'derived';
      statistic: keyof CalculatedStatistics['derivedStatistics'];
    }
  | { kind: 'spellcasting'; classEntryId: string; statistic: CastingStatistic };

export function spellcastingBreakdownTarget(
  classEntryId: string,
  statistic: CastingStatistic,
): CharacterSheetBreakdownTarget {
  return { kind: 'spellcasting', classEntryId, statistic };
}

/** Resolve the same class-local number for an ordinary sheet or Situation preview. */
export function findCharacterSheetStatistic(
  calculated: CalculatedStatistics,
  target: CharacterSheetBreakdownTarget,
): ResolvedStatistic | null {
  if (typeof target === 'string') return calculated.breakdowns[target] ?? null;
  if (target.kind === 'derived')
    return calculated.derivedStatistics[target.statistic] ?? null;
  if (target.kind === 'attackRoutine') {
    const routine = calculated.attackRoutines.find(
      (entry) => entry.entryId === target.entryId,
    );
    return (
      routine?.[target.sequence][target.attackIndex]?.[target.statistic] ?? null
    );
  }
  if (target.kind === 'twoWeaponRend')
    return (
      calculated.attackRoutines.find(
        (entry) => entry.entryId === target.entryId,
      )?.twoWeaponRend?.damageBonus ?? null
    );
  if (target.kind === 'flurryBaseAttack')
    return (
      calculated.attackRoutines.find(
        (entry) => entry.entryId === target.entryId,
      )?.flurry?.baseAttackBonus ?? null
    );
  const casting = calculated.spellcastings.find(
    (candidate) => candidate.classEntryId === target.classEntryId,
  );
  if (!casting) return null;
  const statistic = target.statistic;
  if (statistic.kind !== 'dc')
    return casting.unresolved.includes(statistic.kind)
      ? null
      : casting[statistic.kind];
  const slot = casting.slots.find(
    (candidate) => candidate.spellLevel === statistic.spellLevel,
  );
  if (!slot) return null;
  const school = slot.schoolDCs.find(
    (candidate) => candidate.school === statistic.school,
  );
  if (school) return school.unresolved ? null : school.breakdown;
  return slot.dcUnresolved ? null : slot.dc;
}
