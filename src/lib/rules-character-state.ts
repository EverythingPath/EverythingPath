import { z } from 'zod';
import { identitySchema, integerSchema } from './weekly-draft-facts';
import type { WeeklyDraft } from './weekly-draft-contract';

export const characterLocationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('headquarters') }),
  z.strictObject({ kind: z.literal('refuge'), settlementId: identitySchema }),
  z.strictObject({ kind: z.literal('elsewhere'), location: identitySchema }),
]);
export const trackedCharacterSchema = z.strictObject({
  characterId: identitySchema,
  status: z.enum(['available', 'hidden', 'captured', 'recovering', 'dead']),
  location: characterLocationSchema,
  directRescueRequired: z.boolean(),
  capture: z
    .strictObject({ source: z.enum(['ordinary', 'raid']), week: integerSchema })
    .nullable(),
  rescuedWeek: integerSchema.optional(),
  restoredWeek: integerSchema.optional(),
});
export type TrackedCharacter = z.infer<typeof trackedCharacterSchema>;
export const characterActionStateSchema = z
  .strictObject({ people: z.array(trackedCharacterSchema) })
  .superRefine((state, ctx) => {
    if (
      new Set(state.people.map((person) => person.characterId)).size !==
      state.people.length
    )
      ctx.addIssue({
        code: 'custom',
        path: ['people'],
        message: 'Duplicate character state',
      });
  });
export type CharacterActionState = z.infer<typeof characterActionStateSchema>;
type Acknowledgement = WeeklyDraft['acknowledgements'][number];
export type CharacterActionChange =
  | {
      kind: 'tracked_character';
      choiceId: string;
      before: TrackedCharacter;
      after: TrackedCharacter;
    }
  | {
      kind: 'rescue_result';
      choiceId: string;
      characterId: string;
      dc: number;
      total: number;
      succeeded: boolean;
      acknowledgement: Acknowledgement;
    }
  | {
      kind: 'restoration';
      choiceId: string;
      characterIds: string[];
      scope: 'party' | 'individual';
      effect: string;
      effectLevel: number | null;
      costCopper: number;
      acknowledgement: Acknowledgement;
    }
  | {
      kind: 'information';
      choiceId: string;
      subject: string;
      total: number;
      achievedDc: number | null;
      succeeded: boolean;
      acknowledgement: Acknowledgement;
    }
  | {
      kind: 'special_result';
      choiceId: string;
      instruction: string;
      costCopper: number;
      acknowledgement: Acknowledgement;
    }
  | {
      kind: 'strike_support';
      choiceId: string;
      location: string;
      availableWeek: number;
      expiresWeek: number;
      uses: 1;
      recipients: 'each_pc';
      bonusType: 'competence';
      attackBonus: 2;
      damageBonus: 2;
      saveBonus: 2;
      rounds: number;
      acknowledgement: Acknowledgement;
    }
  | {
      kind: 'strike_extraction';
      choiceId: string;
      location: string;
      availableWeek: number;
      expiresWeek: number;
      uses: 1;
      stabilizeBleeding: true;
      gentleReposeCasterLevel: 12;
      extractBodiesTo: 'headquarters';
      acknowledgement: Acknowledgement;
    };
