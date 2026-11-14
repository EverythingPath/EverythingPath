import { z } from 'zod';
import { abilityKeys } from './character-sheet-abilities';
import { manualProficiencySchema } from './character-sheet-proficiency-schema';

export const alignments = [
  'LG',
  'NG',
  'CG',
  'LN',
  'N',
  'CN',
  'LE',
  'NE',
  'CE',
] as const;
export const alignmentSchema = z.enum(alignments);
export type Alignment = z.infer<typeof alignmentSchema>;
export const alignmentNames: Record<Alignment, string> = {
  LG: 'Lawful good',
  NG: 'Neutral good',
  CG: 'Chaotic good',
  LN: 'Lawful neutral',
  N: 'Neutral',
  CN: 'Chaotic neutral',
  LE: 'Lawful evil',
  NE: 'Neutral evil',
  CE: 'Chaotic evil',
};
export const normalize = (value: string) => value.trim().toLowerCase();

const proficiencySchema = z.union([
  manualProficiencySchema,
  z.object({ choice: z.literal(true) }),
]);
function atomSchema<K extends string, S extends z.ZodRawShape>(
  kind: K,
  shape: S,
) {
  return z.object({ ...shape, kind: z.literal(kind).optional() });
}

// Older Catalog Entries omit kind. Both forms read without a stored-data migration.
export const prerequisiteAtomSchema = z.union([
  atomSchema('ability', { ability: z.enum(abilityKeys), min: z.number() }),
  atomSchema('bab', { bab: z.number() }),
  atomSchema('skillRanks', { skillRanks: z.string(), min: z.number() }),
  atomSchema('feat', { feat: z.string(), choice: z.string().optional() }),
  atomSchema('classFeature', {
    classFeature: z.string(),
    classFeatureName: z.string().optional(),
    classFeatureClass: z.string().optional(),
  }),
  atomSchema('racialTrait', { racialTrait: z.string() }),
  atomSchema('classLevel', { classLevel: z.string(), min: z.number() }),
  atomSchema('characterLevel', { characterLevel: z.number() }),
  atomSchema('race', { race: z.array(z.string()) }),
  atomSchema('alignment', { alignment: z.array(alignmentSchema) }),
  atomSchema('deity', { deity: z.string() }),
  atomSchema('proficiency', { proficiency: proficiencySchema }),
  atomSchema('casterLevel', { casterLevel: z.number() }),
  atomSchema('canCast', {
    canCast: z.object({
      spellLevel: z.number(),
      kind: z.enum(['arcane', 'divine', 'psychic']).optional(),
    }),
  }),
  atomSchema('castsSpell', { castsSpell: z.string() }),
  atomSchema('unchecked', { unchecked: z.string() }),
]);
export type PrerequisiteAtom = z.infer<typeof prerequisiteAtomSchema>;
export const prerequisiteSchema = z.union([
  prerequisiteAtomSchema,
  z.object({ anyOf: z.array(prerequisiteAtomSchema) }),
]);
export type Prerequisite = z.infer<typeof prerequisiteSchema>;

function assertNever(value: never): never {
  throw new Error(`Unsupported prerequisite: ${JSON.stringify(value)}`);
}

export function normalizePrerequisiteAtom(atom: PrerequisiteAtom) {
  if ('ability' in atom) return { ...atom, kind: 'ability' } as const;
  if ('bab' in atom) return { ...atom, kind: 'bab' } as const;
  if ('skillRanks' in atom) return { ...atom, kind: 'skillRanks' } as const;
  if ('feat' in atom) return { ...atom, kind: 'feat' } as const;
  if ('classFeature' in atom) return { ...atom, kind: 'classFeature' } as const;
  if ('racialTrait' in atom) return { ...atom, kind: 'racialTrait' } as const;
  if ('classLevel' in atom) return { ...atom, kind: 'classLevel' } as const;
  if ('characterLevel' in atom)
    return { ...atom, kind: 'characterLevel' } as const;
  if ('race' in atom) return { ...atom, kind: 'race' } as const;
  if ('alignment' in atom) return { ...atom, kind: 'alignment' } as const;
  if ('deity' in atom) return { ...atom, kind: 'deity' } as const;
  if ('proficiency' in atom) return { ...atom, kind: 'proficiency' } as const;
  if ('casterLevel' in atom) return { ...atom, kind: 'casterLevel' } as const;
  if ('canCast' in atom) return { ...atom, kind: 'canCast' } as const;
  if ('castsSpell' in atom) return { ...atom, kind: 'castsSpell' } as const;
  if ('unchecked' in atom) return { ...atom, kind: 'unchecked' } as const;
  return assertNever(atom);
}
export const normalizedPrerequisiteAtomSchema =
  prerequisiteAtomSchema.transform(normalizePrerequisiteAtom);
export type NormalizedPrerequisiteAtom = z.infer<
  typeof normalizedPrerequisiteAtomSchema
>;
