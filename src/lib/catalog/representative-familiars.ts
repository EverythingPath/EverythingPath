import { z } from 'zod';
import type { AbilityScores, CreatureSize } from '../character-sheet';
import type { SkillTarget } from '../character-sheet-skills';

export const familiarBaseCreatureKeySchema = z.enum(['cat', 'raven', 'toad']);
export function findRepresentativeFamiliar(key?: unknown) {
  const parsed = familiarBaseCreatureKeySchema.safeParse(key);
  return parsed.success ? representativeFamiliars[parsed.data] : null;
}
export type FamiliarBaseCreatureKey = z.infer<
  typeof familiarBaseCreatureKeySchema
>;
export type RepresentativeFamiliar = {
  key: FamiliarBaseCreatureKey;
  name: string;
  representative: true;
  size: CreatureSize;
  abilityScores: AbilityScores;
  normalHitDice: number;
  baseAttackBonus: number;
  baseSaves: Record<'fort' | 'ref' | 'will', number>;
  skillRanks: Partial<Record<SkillTarget, number>>;
  classSkills: readonly SkillTarget[];
  racialSkillBonuses: Partial<Record<SkillTarget, number>>;
  skillFocus?: SkillTarget;
  dexterityClimb?: true;
  sources: readonly { book: string; pages: string; url: string }[];
};

// Representative familiar creatures only; not a complete Catalog Release.
// The CRB supplies familiar rules and the Bestiary supplies creature statistics.
const sources = [
  {
    book: 'Pathfinder RPG Core Rulebook',
    pages: '82–83',
    url: 'https://legacy.aonprd.com/coreRulebook/classes/wizard.html#familiars',
  },
  {
    book: 'Pathfinder RPG Bestiary',
    pages: '131–133',
    url: 'https://legacy.aonprd.com/bestiary/familiar.html',
  },
];
const classSkills: readonly SkillTarget[] = [
  'skill.acr',
  'skill.clm',
  'skill.fly',
  'skill.per',
  'skill.ste',
  'skill.swm',
];
export const representativeFamiliars: Record<
  FamiliarBaseCreatureKey,
  RepresentativeFamiliar
> = {
  cat: {
    key: 'cat',
    name: 'Cat',
    representative: true,
    size: 'tiny',
    abilityScores: {
      strength: 3,
      dexterity: 15,
      constitution: 8,
      intelligence: 2,
      wisdom: 12,
      charisma: 7,
    },
    normalHitDice: 1,
    baseAttackBonus: 0,
    baseSaves: { fort: 2, ref: 2, will: 0 },
    skillRanks: { 'skill.per': 1 },
    racialSkillBonuses: { 'skill.clm': 4, 'skill.ste': 4 },
    dexterityClimb: true,
    classSkills,
    sources,
  },
  raven: {
    key: 'raven',
    name: 'Raven',
    representative: true,
    size: 'tiny',
    abilityScores: {
      strength: 2,
      dexterity: 15,
      constitution: 8,
      intelligence: 2,
      wisdom: 15,
      charisma: 7,
    },
    normalHitDice: 1,
    baseAttackBonus: 0,
    baseSaves: { fort: 2, ref: 2, will: 0 },
    skillRanks: { 'skill.per': 1 },
    racialSkillBonuses: {},
    // The printed Perception +6 is rank 1, class skill +3 and Wisdom +2.
    // Preserve that printed total rather than adding its discrepant listed feat.
    classSkills,
    sources,
  },
  toad: {
    key: 'toad',
    name: 'Toad',
    representative: true,
    size: 'diminutive',
    abilityScores: {
      strength: 1,
      dexterity: 12,
      constitution: 6,
      intelligence: 1,
      wisdom: 15,
      charisma: 4,
    },
    normalHitDice: 1,
    baseAttackBonus: 0,
    baseSaves: { fort: 2, ref: 2, will: 0 },
    skillRanks: { 'skill.ste': 1 },
    racialSkillBonuses: { 'skill.ste': 4 },
    skillFocus: 'skill.per',
    classSkills,
    sources,
  },
};

// CRB Familiar table: each row covers the listed level and the next level.
export const representativeFamiliarProgression = [
  { level: 1, naturalArmor: 1, intelligence: 6 },
  { level: 3, naturalArmor: 2, intelligence: 7 },
  { level: 5, naturalArmor: 3, intelligence: 8 },
  { level: 7, naturalArmor: 4, intelligence: 9 },
  { level: 9, naturalArmor: 5, intelligence: 10 },
  { level: 11, naturalArmor: 6, intelligence: 11 },
  { level: 13, naturalArmor: 7, intelligence: 12 },
  { level: 15, naturalArmor: 8, intelligence: 13 },
  { level: 17, naturalArmor: 9, intelligence: 14 },
  { level: 19, naturalArmor: 10, intelligence: 15 },
];
