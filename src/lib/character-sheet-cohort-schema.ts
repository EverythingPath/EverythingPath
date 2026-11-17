import { z } from 'zod';
import { companionLinkedInputResolutionSchema } from './character-sheet-linked-inputs';
import { leadershipModifiersSchema } from './character-sheet-cohort';
import { monsterCohortKeySchema } from './catalog/representative-cohorts';

// Validators for the cohort calculation's inputs and results, kept apart
// from the calculation so it imports the linked-input module by type only.
export const cohortSourceSchema = z.object({
  sourceKey: z.string(),
  counting: z.boolean(),
  leadershipModifiers: leadershipModifiersSchema.optional(),
});
export type CohortSource = z.infer<typeof cohortSourceSchema>;
const cohortLinkedInputsSchema = z.array(companionLinkedInputResolutionSchema);
/**
 * The authorized leader inputs and supporting sources of a cohort link.
 * Without access to the leader the sources carry none of its Leadership
 * modifiers (PRD §15), so the score stays unresolved; the two variants keep
 * undisclosed modifiers from travelling with recorded ones.
 */
export const cohortCalculationInputSchema = z.union([
  z.object({
    sources: z.array(cohortSourceSchema),
    linkedInputs: cohortLinkedInputsSchema,
    areModifiersUndisclosed: z.literal(false).optional(),
  }),
  z.object({
    sources: z.array(
      cohortSourceSchema.omit({ leadershipModifiers: true }).strict(),
    ),
    linkedInputs: cohortLinkedInputsSchema,
    areModifiersUndisclosed: z.literal(true),
  }),
]);
export type CohortCalculationInput = z.infer<
  typeof cohortCalculationInputSchema
>;

const citationSchema = z.object({
  book: z.string(),
  pages: z.string().optional(),
  url: z.string(),
});
const leaderInputSchema = z.object({
  value: z.number().nullable(),
  resolution: companionLinkedInputResolutionSchema.shape.resolution,
  fallbackState: companionLinkedInputResolutionSchema.shape.fallbackState,
});
const leadershipModifierRowSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number(),
});
export const leadershipResultSchema = z.object({
  modifiers: z.array(leadershipModifierRowSchema),
  modifierTotal: z.number().nullable(),
  /** Level + Charisma modifier + modifiers; null while any is unresolved. */
  score: z.number().nullable(),
  /**
   * The table's cohort level for the score, the level it would attract
   * now; 0 attracts no cohort. Consulted only when attracting a cohort.
   */
  scoreLevel: z.number().nullable(),
  /** Two levels below the leader's character level; it always applies. */
  leaderLevelLimit: z.number().nullable(),
  /** The highest level a cohort could be attracted at now: the lower. */
  maximumLevel: z.number().nullable(),
});
export type LeadershipResult = z.infer<typeof leadershipResultSchema>;
export const cohortResolutionSchema = z.object({
  /**
   * `active` with counting support, `dormant` when the cohort relationship
   * has none, `unlinked` for a recorded equivalence with no cohort link.
   */
  status: z.enum(['active', 'dormant', 'unlinked']),
  equivalence: z.object({
    basis: z.enum(['classLevels', 'published', 'entered']),
    creatureKey: monsterCohortKeySchema.nullable(),
    creature: z.string().nullable(),
    /** The published or entered cohort level before Class Levels. */
    creatureLevel: z.number().nullable(),
    classLevels: z.number(),
    value: z.number().nullable(),
    missing: z.boolean(),
    citation: citationSchema.nullable(),
  }),
  leadership: leadershipResultSchema
    .extend({
      characterLevel: leaderInputSchema,
      charismaModifier: leaderInputSchema,
      /** Counting sources record different modifiers: no source wins. */
      conflict: z.boolean(),
      /**
       * The leader's modifiers need access to the leader: no rows, and the
       * score and table level stay unresolved.
       */
      areModifiersUndisclosed: z.boolean(),
    })
    .nullable(),
  /**
   * The equivalence is not two or more levels below the leader; its Class
   * Levels are kept. The table limit applies only at recruitment.
   */
  overLevel: z.boolean(),
  sources: z.array(citationSchema),
});
export type CohortResolution = z.infer<typeof cohortResolutionSchema>;
