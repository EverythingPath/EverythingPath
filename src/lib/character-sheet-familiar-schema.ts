import { creatureSizes } from './character-sheet-creature-sizes';
import {
  familiarUnresolvedTargetSchema,
  familiarStatisticTargetSchema,
} from './character-sheet-familiar-targets';
import { z } from 'zod';
import { familiarBaseCreatureKeySchema } from './catalog/representative-familiars';
import {
  companionLinkedInputResolutionSchema,
  companionLinkedInputSchema,
} from './character-sheet-linked-inputs';

const saves = z.object({ fort: z.number(), ref: z.number(), will: z.number() });
export const familiarFactsSchema = z.object({
  isBaseCreatureUnavailable: z.boolean(),
  affectedStatisticTargets: z.array(familiarStatisticTargetSchema),
  baseCreature: z
    .object({
      key: familiarBaseCreatureKeySchema,
      name: z.string(),
      representative: z.literal(true),
      size: z.enum(creatureSizes),
      abilityScores: z.object({
        strength: z.number(),
        dexterity: z.number(),
        constitution: z.number(),
        intelligence: z.number(),
        wisdom: z.number(),
        charisma: z.number(),
      }),
      normalHitDice: z.number(),
      baseAttackBonus: z.number(),
      baseSaves: saves,
      skillRanks: z.record(z.string(), z.number()),
      classSkills: z.array(z.string()),
      racialSkillBonuses: z.record(z.string(), z.number()),
      skillFocus: z.string().optional(),
      dexterityClimb: z.literal(true).optional(),
      sources: z.array(
        z.object({ book: z.string(), pages: z.string(), url: z.string() }),
      ),
    })
    .nullable(),
  progression: z
    .object({
      level: z.number(),
      naturalArmor: z.number(),
      intelligence: z.number(),
      spellResistance: z.number().nullable(),
      specialAbilities: z.array(z.string()),
    })
    .nullable(),
  actualHitDice: z.number().nullable(),
  effectiveHitDice: z.number().nullable(),
  maximumHp: z.number().nullable(),
  baseAttackBonus: z.number().nullable(),
  baseSaves: z.object({
    fort: z.number().nullable(),
    ref: z.number().nullable(),
    will: z.number().nullable(),
  }),
  skillRanks: z.record(z.string(), z.number().nullable()),
  unresolvedInputs: z.array(companionLinkedInputSchema),
  unresolvedTargets: z.array(familiarUnresolvedTargetSchema),
  linkedInputs: z.array(companionLinkedInputResolutionSchema),
});
