import { z } from 'zod';
import {
  abilityKeys,
  abilityTargets,
  companionUnresolvedAbilities,
} from './character-sheet-abilities';
import { skillDefinitions } from './character-sheet-skill-definitions';

export const sheetUnresolvedTargetSchema = z.enum([
  'hitDice',
  'size',
  ...abilityKeys.map((ability) => abilityTargets[ability]),
  'featBudget',
  'ac.natural',
  'familiar.progression',
  'familiar.effectiveHitDice',
  'hp',
  'bab',
  'attack.melee',
  'attack.ranged',
  'cmb',
  'cmd',
  'save.fort',
  'save.ref',
  'save.will',
  ...skillDefinitions.map(({ key }) => key),
]);
export type SheetUnresolvedTarget = z.infer<typeof sheetUnresolvedTargetSchema>;

export const sheetStatisticTargetSchema = z.enum([
  ...sheetUnresolvedTargetSchema.options,
  'derived.ac',
  'derived.touchAc',
  'derived.flatFootedAc',
  'derived.fortitude',
  'derived.reflex',
  'derived.will',
  'derived.bab',
  'derived.cmb',
  'derived.cmd',
  'derived.flatFootedCmd',
  'attackRoutine.attackBonus',
]);
export type SheetStatisticTarget = z.infer<typeof sheetStatisticTargetSchema>;

const derivedDependencies = {
  'derived.ac': ['ac.natural', 'size', 'ability.dex'],
  'derived.touchAc': ['size', 'ability.dex'],
  'derived.flatFootedAc': ['ac.natural', 'size'],
  'derived.fortitude': ['save.fort', 'ability.con'],
  'derived.reflex': ['save.ref', 'ability.dex'],
  'derived.will': ['save.will', 'ability.wis'],
  'derived.bab': ['bab'],
  'derived.cmb': ['cmb', 'bab', 'size', 'ability.str'],
  'derived.cmd': ['cmd', 'bab', 'size', 'ability.str', 'ability.dex'],
  'derived.flatFootedCmd': ['cmd', 'bab', 'size', 'ability.str'],
  'attackRoutine.attackBonus': [
    'bab',
    'attack.melee',
    'attack.ranged',
    'size',
    'ability.str',
    'ability.dex',
  ],
} satisfies Partial<Record<SheetStatisticTarget, SheetUnresolvedTarget[]>>;

export function affectedStatisticTargets(
  targets: readonly SheetUnresolvedTarget[],
): SheetStatisticTarget[] {
  const unresolved = new Set(targets);
  const affected: SheetStatisticTarget[] = [...targets];
  for (const [target, dependencies] of Object.entries(derivedDependencies)) {
    if (dependencies.some((dependency) => unresolved.has(dependency)))
      affected.push(sheetStatisticTargetSchema.parse(target));
  }
  for (const skill of skillDefinitions)
    if (unresolved.has(abilityTargets[skill.ability])) affected.push(skill.key);
  return [...new Set(affected)];
}

export const companionProgressionUnresolvedTargets = [
  'hitDice',
  'featBudget',
  'bab',
  'hp',
  ...companionUnresolvedAbilities.map((ability) => abilityTargets[ability]),
  'ac.natural',
  'save.fort',
  'save.ref',
  'save.will',
] as const satisfies readonly SheetUnresolvedTarget[];
