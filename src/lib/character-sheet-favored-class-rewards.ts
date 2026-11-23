/**
 * rotation-7 (PRD #251; ORCH research favored-class-rewards.md, option A):
 * the favored-class rewards the sheet counts. A Class Level's favored class
 * bonus may be one of these instead of the hit point, the skill rank or a
 * note, stored by the reward's id (`{ choice: 'reward', reward }`). The list
 * is reviewed closure data: each reward names the class and races it belongs
 * to, the fraction one selection gives and its source line.
 */
import { z } from 'zod';
import data from './catalog/data/reviewed-favored-class-rewards.json';
import type {
  CharacterSheetCatalogEntry,
  CharacterSheetClassDetail,
  CharacterSheetInput,
  SheetEntry,
  SheetWarning,
} from './character-sheet';
import { characterSheetClassFamily } from './character-sheet-archetype-helpers';
import { listAll, listAny } from './character-sheet-lists';
import { resolveCharacterSheetRacialFacts } from './character-sheet-racial';
import { ruleKeyMatches } from './character-sheet-rule-keys';

const ruleKeySchema = z.string().regex(/^[a-z][a-z0-9-]*$/);
const groupSchema = z
  .object({
    name: z.string().min(1),
    /** The imported Foundry records that are this class or race. */
    foundry: z.array(z.string().regex(/^pf1\/[A-Za-z0-9]{16}$/)),
  })
  .strict();
const rewardSchema = z
  .object({
    /** The id a Class Level stores and a formula reads. */
    id: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
    /** What the player picks, in plain words. */
    name: z.string().min(1).max(80),
    class: ruleKeySchema,
    races: z.array(ruleKeySchema).nonempty(),
    /** What one selection gives; a formula applies it, flooring the sum. */
    fraction: z
      .object({
        numerator: z.literal(1),
        denominator: z.number().int().min(1).max(6),
      })
      .strict(),
    source: z
      .object({ book: z.literal('APG'), pcgen: z.string().min(1) })
      .strict(),
  })
  .strict();
const listSchema = z
  .object({
    classes: z.record(ruleKeySchema, groupSchema),
    races: z.record(ruleKeySchema, groupSchema),
    rewards: z.array(rewardSchema),
  })
  .strict()
  .superRefine((list, context) => {
    const ids = new Set<string>();
    for (const [index, reward] of list.rewards.entries()) {
      if (ids.has(reward.id))
        context.addIssue({
          code: 'custom',
          path: ['rewards', index, 'id'],
          message: `Reward ${reward.id} is listed twice.`,
        });
      ids.add(reward.id);
      if (!Object.hasOwn(list.classes, reward.class))
        context.addIssue({
          code: 'custom',
          path: ['rewards', index, 'class'],
          message: `Class ${reward.class} is not listed.`,
        });
      for (const race of reward.races)
        if (!Object.hasOwn(list.races, race))
          context.addIssue({
            code: 'custom',
            path: ['rewards', index, 'races'],
            message: `Race ${race} is not listed.`,
          });
    }
  });

export type FavoredClassRewardList = z.infer<typeof listSchema>;
export type FavoredClassReward = FavoredClassRewardList['rewards'][number];

/** Parses a reward list as the committed one is parsed. */
export function parseFavoredClassRewardList(value: unknown) {
  return listSchema.parse(value);
}

export const reviewedFavoredClassRewards = parseFavoredClassRewardList(data);

/** The listed reward with this id, if the list holds it. */
export function favoredClassReward(id: string) {
  return reviewedFavoredClassRewards.rewards.find((reward) => reward.id === id);
}

/** Whether a rule identity is the listed class or race of this key. */
function isListedIdentity(
  identity: string | null | undefined,
  key: string,
  group: FavoredClassRewardList['classes'][string] | undefined,
) {
  if (identity === null || identity === undefined) return false;
  return (
    ruleKeyMatches(identity, key) ||
    (group?.foundry.includes(identity) ?? false)
  );
}

function isRewardClass(
  reward: FavoredClassReward,
  identities: readonly string[],
) {
  return identities.some((identity) =>
    isListedIdentity(
      identity,
      reward.class,
      reviewedFavoredClassRewards.classes[reward.class],
    ),
  );
}

/**
 * A level's class as a reward names it: its own identity and its family's,
 * since an Unchained Class's levels count as the original's for its
 * favored class options (docs/character-sheet/unchained-classes.md).
 */
export function levelClassIdentities(
  catalog: CharacterSheetCatalogEntry | null | undefined,
  catalogEntries: readonly CharacterSheetCatalogEntry[],
) {
  if (!catalog) return [];
  return [
    ...new Set([
      catalog.ruleIdentity,
      characterSheetClassFamily(catalog, catalogEntries),
    ]),
  ];
}

function isRewardRace(
  reward: FavoredClassReward,
  identities: readonly string[],
) {
  return reward.races.some((race) =>
    identities.some((identity) =>
      isListedIdentity(identity, race, reviewedFavoredClassRewards.races[race]),
    ),
  );
}

/** The rule identities of the character's active races. */
export function activeRaceIdentities({
  entries,
  catalogEntries,
}: {
  entries: readonly (
    | { active: boolean; kind: string }
    | { active: boolean; kind: string; catalogEntryId: string }
  )[];
  catalogEntries: readonly Pick<
    CharacterSheetCatalogEntry,
    '_id' | 'ruleIdentity'
  >[];
}) {
  return entries.flatMap((entry) => {
    if (!entry.active || entry.kind !== 'race' || !('catalogEntryId' in entry))
      return [];
    const definition = catalogEntries.find(
      (item) => item._id === entry.catalogEntryId,
    );
    return definition ? [definition.ruleIdentity] : [];
  });
}

/**
 * Fix r1: the races a reward's races are matched against: each active race's
 * identity and every race the character counts as, the sheet's
 * `resolveCharacterSheetRacialFacts(...).countsAsRaces` (the stored
 * `countsAsRaces` of its counting entries, so a Half-Elf's Elf Blood counts
 * it as a Human and an Elf, a Half-Orc's Orc Blood as a Human and an Orc).
 */
export function rewardRaceIdentities(
  activeRaces: readonly string[],
  countsAsRaces: readonly string[],
) {
  return [...new Set([...activeRaces, ...countsAsRaces])].sort();
}

/**
 * The listed rewards of this class (its `levelClassIdentities`) for one of
 * these races (`rewardRaceIdentities`), in list order.
 */
export function favoredClassRewardsFitting({
  classIdentities,
  raceIdentities,
}: {
  classIdentities: readonly string[];
  raceIdentities: readonly string[];
}) {
  return reviewedFavoredClassRewards.rewards.filter(
    (reward) =>
      isRewardClass(reward, classIdentities) &&
      isRewardRace(reward, raceIdentities),
  );
}

/** The class families of the favored classes, as the sheet compares them. */
export function favoredClassFamilies(
  favoredClassIds: readonly string[],
  catalogEntries: readonly CharacterSheetCatalogEntry[],
) {
  return favoredClassIds
    .flatMap((id) => {
      const catalog = catalogEntries.find((entry) => entry._id === id);
      if (!catalog || catalog.detail?.kind !== 'class') return [];
      return [characterSheetClassFamily(catalog, catalogEntries)];
    })
    .sort();
}

/** Whether a level's class is a favored class: never a Prestige Class. */
export function isFavoredClassLevel(
  {
    catalog,
    detail,
  }: {
    catalog: CharacterSheetCatalogEntry | null;
    detail: Pick<CharacterSheetClassDetail, 'classKind'> | null;
  },
  families: readonly string[],
  catalogEntries: readonly CharacterSheetCatalogEntry[],
) {
  return (
    catalog !== null &&
    detail?.classKind !== 'prestige' &&
    families.includes(characterSheetClassFamily(catalog, catalogEntries))
  );
}

/** Why a chosen reward is not counted at a level. */
export type FavoredClassRewardReason =
  | 'unlisted'
  | 'class'
  | 'favored'
  | 'race';

type ClassLevelRow = {
  entry: Extract<SheetEntry, { kind: 'classLevel' }>;
  catalog: CharacterSheetCatalogEntry | null;
  detail: Pick<CharacterSheetClassDetail, 'classKind'> | null;
};

/**
 * The facts a level's reward is counted by: the level's class (as
 * `levelClassIdentities` names it), whether it is a favored class, and the
 * races the character counts as (`rewardRaceIdentities`).
 */
type RewardFacts = {
  classIdentities: string[];
  favored: boolean;
  races: readonly string[];
};

function uncountedReasons(reward: FavoredClassReward, facts: RewardFacts) {
  const reasons: FavoredClassRewardReason[] = [];
  if (!isRewardClass(reward, facts.classIdentities)) reasons.push('class');
  if (!facts.favored) reasons.push('favored');
  if (!isRewardRace(reward, facts.races)) reasons.push('race');
  return reasons;
}

/**
 * Each Class Level that chose a reward, and whether it counts: the reward is
 * listed, the level's class is the reward's class and a favored class, and
 * the character counts as one of the reward's races (`rewardRaceIdentities`).
 * `counts` gives, per listed reward, how many levels chose it and count: a
 * whole number of selections.
 */
export function resolveFavoredClassRewards({
  input,
  rows,
}: {
  input: CharacterSheetInput;
  rows: readonly ClassLevelRow[];
}) {
  const base = input.entries.find((entry) => entry.kind === 'base');
  const families = favoredClassFamilies(
    base?.state.kind === 'base' ? (base.state.favoredClassIds ?? []) : [],
    input.catalogEntries,
  );
  const races = rewardRaceIdentities(
    activeRaceIdentities(input),
    resolveCharacterSheetRacialFacts(input).countsAsRaces,
  );
  const counts: Record<string, number> = Object.fromEntries(
    reviewedFavoredClassRewards.rewards.map((reward) => [reward.id, 0]),
  );
  const levels = rows.flatMap((row) => {
    const bonus = row.entry.state.favoredClassBonus;
    if (bonus?.choice !== 'reward') return [];
    const reward = favoredClassReward(bonus.reward);
    const facts: RewardFacts = {
      classIdentities: levelClassIdentities(
        row.catalog,
        input.catalogEntries,
      ).sort(),
      favored: isFavoredClassLevel(row, families, input.catalogEntries),
      races,
    };
    const reasons = reward
      ? uncountedReasons(reward, facts)
      : (['unlisted'] as const);
    if (reward && reasons.length === 0)
      counts[reward.id] = (counts[reward.id] ?? 0) + 1;
    return [
      { entry: row.entry, rewardId: bonus.reward, reward, reasons, facts },
    ];
  });
  return { counts, levels };
}

/** "this level's class isn't Bard and isn't one of your favored classes" */
function reasonPhrases(
  reward: FavoredClassReward,
  reasons: readonly FavoredClassRewardReason[],
) {
  const { classes, races } = reviewedFavoredClassRewards;
  const className = classes[reward.class]?.name ?? reward.class;
  const phrases: string[] = [];
  const notFavored = 'isn’t one of your favored classes';
  if (reasons.includes('class'))
    phrases.push(
      reasons.includes('favored')
        ? `this level’s class isn’t ${className} and ${notFavored}`
        : `this level’s class isn’t ${className}`,
    );
  else if (reasons.includes('favored'))
    phrases.push(`this level’s class ${notFavored}`);
  if (reasons.includes('race'))
    phrases.push(
      `your race isn’t ${listAny(reward.races.map((race) => races[race]?.name ?? race))}`,
    );
  return phrases;
}

/**
 * A rules warning on each level whose chosen reward is not counted, naming
 * the level and why; it never counts silently. Its fingerprint holds the
 * facts that decide it (fix r1, docs/character-sheet/rules-checks.md
 * "Accepted Warnings"): the reward, the reasons, the level's class, whether
 * it is favored and the races the character counts as, so an accepted one
 * reopens when one of them changes.
 */
export function favoredClassRewardWarnings(
  resolved: ReturnType<typeof resolveFavoredClassRewards>,
): SheetWarning[] {
  return resolved.levels.flatMap(
    ({ entry, rewardId, reward, reasons, facts }) => {
      if (reasons.length === 0) return [];
      const level = `Level ${entry.state.position}`;
      const message = reward
        ? `${level}: ${reward.name} isn’t counted: ${listAll(reasonPhrases(reward, reasons))}.`
        : `${level}: this favored class reward isn’t counted: the sheet no longer lists it.`;
      return [
        {
          kind: 'rules',
          check: 'favoredClassRewardNotCounted',
          subject: entry._id,
          target: {
            kind: 'classLevel',
            entryId: entry._id,
            field: 'favoredClassBonus',
          },
          message,
          fingerprint: JSON.stringify(
            reward
              ? [
                  rewardId,
                  reasons,
                  facts.classIdentities,
                  facts.favored,
                  facts.races,
                ]
              : [rewardId, reasons],
          ),
        },
      ];
    },
  );
}
