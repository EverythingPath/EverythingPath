import { z } from 'zod';

// Representative prepared-sheet cohort rules, not a curated Catalog Release.
// Cohort Equivalence is a cohort's level for the Leadership feat. It stays
// distinct from the creature's actual Hit Dice, its Class Levels and its
// Challenge Rating; this admits no Monsters as PCs subsystem.

export type CohortCitation = { book: string; pages?: string; url: string };

/** CRB p. 129, Leadership, checked against the legacy PRD feat text. */
export const leadershipCitation = {
  book: 'Pathfinder RPG Core Rulebook',
  pages: '129',
  url: 'https://legacy.aonprd.com/coreRulebook/feats.html#leadership',
} satisfies CohortCitation;

/**
 * CRB p. 129, Table: Leadership, the Cohort Level column, as the scores at
 * which the cohort level rises by one: 2 gives 1st, 3 gives 2nd, and so on
 * to 24, which gives 17th. Scores of 1 or lower attract no cohort (0).
 */
const cohortLevelThresholds = [
  2, 3, 4, 6, 7, 9, 10, 12, 13, 14, 16, 17, 19, 20, 21, 23, 24,
] as const;
export function leadershipCohortLevel(score: number) {
  return cohortLevelThresholds.filter((threshold) => threshold <= score).length;
}

// CRB p. 129: "Your reputation (from the point of view of the cohort or
// follower you are trying to attract) raises or lowers your Leadership
// score", and other modifiers apply "when you try to attract a cohort", so
// the companion modifier records the leader's companions at recruitment.
export const leadershipReputationKeySchema = z.enum([
  'greatRenown',
  'fairnessAndGenerosity',
  'specialPower',
  'failure',
  'aloofness',
  'cruelty',
]);
/** One entry per reputation key, checked against the schema's list. */
export const leadershipReputationModifiers = {
  greatRenown: { label: 'Great renown', value: 2 },
  fairnessAndGenerosity: { label: 'Fairness and generosity', value: 1 },
  specialPower: { label: 'Special power', value: 1 },
  failure: { label: 'Failure', value: -1 },
  aloofness: { label: 'Aloofness', value: -1 },
  cruelty: { label: 'Cruelty', value: -2 },
} satisfies Record<LeadershipReputationKey, { label: string; value: number }>;
export type LeadershipReputationKey = z.infer<
  typeof leadershipReputationKeySchema
>;
export const leadershipCohortModifiers = {
  hasCompanion: {
    label: 'Has a familiar, special mount, or animal companion at recruitment',
    value: -2,
  },
  differentAlignment: {
    label: 'Recruits a cohort of a different alignment',
    value: -1,
  },
  /** Cumulative per cohort killed. */
  cohortDeaths: { label: 'Caused the death of a cohort', value: -2 },
} as const;

/** Bestiary Monster Cohorts, as printed on the legacy PRD. */
const monsterCohortsUrl =
  'https://legacy.aonprd.com/bestiary/monsterCohorts.html';
// The legacy PRD prints no page for these tables and no primary source for
// their pages was reachable, so the citations name the book only.
export const monsterCohortCitations = {
  bestiary: { book: 'Pathfinder RPG Bestiary', url: monsterCohortsUrl },
  bestiary2: { book: 'Pathfinder RPG Bestiary 2', url: monsterCohortsUrl },
} as const satisfies Record<string, CohortCitation>;
type MonsterCohort = {
  name: string;
  /** The published effective cohort level. */
  level: number;
  book: keyof typeof monsterCohortCitations;
};
/**
 * The complete Bestiary and Bestiary 2 Monster Cohorts tables, except the
 * young dragon, whose published level is its Challenge Rating + 8: the
 * sheet records no Challenge Rating, so a dragon uses an entered
 * equivalence. Later Bestiaries' tables are not curated.
 */
export const monsterCohortKeySchema = z.enum([
  'babau',
  'bralani',
  'drider',
  'erinyes',
  'ettin',
  'ghoul',
  'giantEagle',
  'griffon',
  'hellHound',
  'houndArchon',
  'manticore',
  'pegasus',
  'pixie',
  'satyr',
  'skeletalChampion',
  'stoneGiant',
  'unicorn',
  'worg',
  'wyvern',
  'aranea',
  'avoral',
  'axiomite',
  'azer',
  'blinkDog',
  'dragonHorse',
  'howler',
  'leonal',
  'leucrotta',
  'redcap',
]);
export type MonsterCohortKey = z.infer<typeof monsterCohortKeySchema>;
export const monsterCohorts: Record<MonsterCohortKey, MonsterCohort> = {
  babau: { name: 'Babau (demon)', level: 11, book: 'bestiary' },
  bralani: { name: 'Bralani (azata)', level: 11, book: 'bestiary' },
  drider: { name: 'Drider', level: 11, book: 'bestiary' },
  erinyes: { name: 'Erinyes (devil)', level: 16, book: 'bestiary' },
  ettin: { name: 'Ettin', level: 15, book: 'bestiary' },
  ghoul: { name: 'Ghoul', level: 5, book: 'bestiary' },
  giantEagle: { name: 'Giant eagle', level: 6, book: 'bestiary' },
  griffon: { name: 'Griffon', level: 8, book: 'bestiary' },
  hellHound: { name: 'Hell hound', level: 7, book: 'bestiary' },
  houndArchon: { name: 'Hound archon', level: 7, book: 'bestiary' },
  manticore: { name: 'Manticore', level: 9, book: 'bestiary' },
  pegasus: { name: 'Pegasus', level: 6, book: 'bestiary' },
  pixie: { name: 'Pixie', level: 8, book: 'bestiary' },
  satyr: { name: 'Satyr', level: 7, book: 'bestiary' },
  skeletalChampion: { name: 'Skeletal champion', level: 6, book: 'bestiary' },
  stoneGiant: { name: 'Stone giant', level: 18, book: 'bestiary' },
  unicorn: { name: 'Unicorn', level: 8, book: 'bestiary' },
  worg: { name: 'Worg', level: 5, book: 'bestiary' },
  wyvern: { name: 'Wyvern', level: 10, book: 'bestiary' },
  aranea: { name: 'Aranea', level: 8, book: 'bestiary2' },
  avoral: { name: 'Avoral', level: 15, book: 'bestiary2' },
  axiomite: { name: 'Axiomite', level: 14, book: 'bestiary2' },
  azer: { name: 'Azer', level: 5, book: 'bestiary2' },
  blinkDog: { name: 'Blink dog', level: 4, book: 'bestiary2' },
  dragonHorse: { name: 'Dragon horse', level: 16, book: 'bestiary2' },
  howler: { name: 'Howler', level: 7, book: 'bestiary2' },
  leonal: { name: 'Leonal', level: 17, book: 'bestiary2' },
  leucrotta: { name: 'Leucrotta', level: 9, book: 'bestiary2' },
  redcap: { name: 'Redcap', level: 10, book: 'bestiary2' },
};
