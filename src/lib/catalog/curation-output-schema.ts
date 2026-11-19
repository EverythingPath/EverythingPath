import { z } from 'zod';
import {
  armorAtMostLimits,
  catalogModifierTargets,
  personalBonusTypes,
  ruleValueSchema,
} from '../character-sheet.ts';

const situationSchema = z.union([
  z.string().min(1),
  z.strictObject({ local: z.string().min(1) }),
  z.strictObject({ option: z.string().min(1) }),
]);
const conditionSchema = z.strictObject({
  situation: situationSchema.optional(),
  whileActive: z.string().min(1).optional(),
  weapon: z
    .enum(['$self', '$choice', '$group', '$target', '$unarmedOrNatural'])
    .optional(),
  option: z.literal(true).optional(),
  castingClass: z.string().min(1).optional(),
  school: z.string().min(1).optional(),
  unarmored: z.literal(true).optional(),
  // rotation-4: lost while armor heavier than this is worn (Fast Movement);
  // rotation-5: `none`, lost in any body armor (the monk's Fast Movement).
  armorAtMost: z.enum(armorAtMostLimits).optional(),
});
export const abilitySchema = z.strictObject({
  bonusEquivalent: z.number().int().min(0).max(5).optional(),
  sourceKey: z.string().min(1).optional(),
  doublesThreat: z.literal(true).optional(),
  weaponDamageTypes: z
    .array(z.enum(['piercing', 'slashing', 'bludgeoning']))
    .min(1)
    .optional(),
  choice: z.literal('creatureType').optional(),
  // Bane-like: the weapon's enhancement is this much better against the
  // designated foe (#764).
  foeEnhancement: z.number().int().min(1).max(5).optional(),
  damageDice: z
    .array(
      z.strictObject({
        on: z.enum(['hit', 'crit']),
        dice: z.string().regex(/^[1-9]\d*d[1-9]\d*(?:[+-]\d+)?$/),
        damageType: z.string().min(1),
        situation: situationSchema.optional(),
      }),
    )
    .optional(),
});
export const outputSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('modifier'),
    target: z.enum(catalogModifierTargets),
    bonusType: z.enum(personalBonusTypes),
    value: z.union([
      z.number().finite(),
      z.strictObject({ formula: z.string().min(1) }),
    ]),
    condition: conditionSchema.optional(),
    stacksWithinEntry: z.literal(true).optional(),
  }),
  z.strictObject({
    kind: z.literal('note'),
    target: z.enum(catalogModifierTargets).optional(),
    situation: situationSchema.optional(),
    text: z.string().min(1),
    condition: conditionSchema.optional(),
  }),
  abilitySchema.extend({ kind: z.literal('itemAbility') }),
]);
/**
 * stats-d1: the curation output kind `ruleValue`, one rule value (GLOSSARY)
 * a rule-value record gives its entry. Only a rule-value record carries it
 * (`ruleValueRecordSchema`, `scripts/catalog/curation.ts`), never a note
 * record, whose drafted outputs apply.
 */
export const ruleValueOutputSchema = z.strictObject({
  kind: z.literal('ruleValue'),
  ruleValue: ruleValueSchema,
});
