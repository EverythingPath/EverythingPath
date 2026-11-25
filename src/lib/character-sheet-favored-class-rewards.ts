/**
 * rotation-7 (PRD #251; ORCH research favored-class-rewards.md, option A):
 * the favored-class rewards the sheet counts. A Class Level's favored class
 * bonus may be one of these instead of the hit point, the skill rank or a
 * note, stored by the reward's id (`{ choice: 'reward', reward }`). The list
 * is reviewed closure data: each reward names the class and races it belongs
 * to, the fraction one selection gives and its source line.
 *
 * reward-target (ORCH research reward-power-choice.md, design D1): a
 * targeted reward also lists the per-day maxima it may add to, by their
 * output keys, and each selection stores the one it adds to
 * (`{ choice: 'reward', reward, target }`); `@favoredClassReward.<id>` then
 * counts, in a rule value of key K, only the selections whose target is K.
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
/**
 * A per-day maximum a targeted reward may add to: its output key, as a rule
 * value names it (`classFeat_fireBolt`), and the power's name in plain words.
 */
const targetSchema = z
  .object({
    key: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/),
    name: z.string().min(1).max(80),
  })
  .strict();
const rewardShape = {
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
};
/**
 * A reward adds to one fixed number (untargeted), or to the one of its
 * listed per-day maxima each selection names (targeted).
 */
const rewardSchema = z.union([
  z.object(rewardShape).strict(),
  z
    .object({ ...rewardShape, targets: z.array(targetSchema).nonempty() })
    .strict(),
]);
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
      const keys =
        'targets' in reward ? reward.targets.map(({ key }) => key) : [];
      if (new Set(keys).size !== keys.length)
        context.addIssue({
          code: 'custom',
          path: ['rewards', index, 'targets'],
          message: `Reward ${reward.id} lists a target twice.`,
        });
    }
  });

export type FavoredClassRewardList = z.infer<typeof listSchema>;
export type FavoredClassReward = FavoredClassRewardList['rewards'][number];
export type TargetedFavoredClassReward = Extract<
  FavoredClassReward,
  { targets: unknown }
>;

/** Whether a reward's selections each name the per-day maximum they add to. */
export function isTargetedReward(
  reward: FavoredClassReward,
): reward is TargetedFavoredClassReward {
  return 'targets' in reward;
}

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

/**
 * The listed targets a level may choose for a targeted reward: its reviewed
 * targets whose key is among the sheet's per-day maximum keys (`keys`, the
 * sheet's `favoredClassRewardTargets`), in list order. Those keys are what
 * the sheet has, whatever reward; this filter is what makes one a choice.
 */
export function favoredClassRewardTargetsOnSheet(
  reward: TargetedFavoredClassReward,
  keys: ReadonlySet<string>,
) {
  return reward.targets.filter((target) => keys.has(target.key));
}

/**
 * A reward as the form names a choice of it: a targeted one with the power
 * it adds to ("+1/2 use per day of a 1st-level domain power: Fire Bolt").
 */
export function favoredClassRewardChoiceName(
  reward: FavoredClassReward,
  target: string | undefined,
) {
  const name = isTargetedReward(reward)
    ? reward.targets.find(({ key }) => key === target)?.name
    : undefined;
  return name === undefined ? reward.name : `${reward.name}: ${name}`;
}

/** Why a chosen reward is not counted at a level. */
export type FavoredClassRewardReason =
  | 'unlisted'
  | 'class'
  | 'favored'
  | 'race'
  /** A targeted reward saved without a target. */
  | 'targetMissing'
  /** A target the reward does not list. */
  | 'targetUnlisted'
  /** A listed target no counting entry gives a per-day maximum for. */
  | 'targetLost';

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

/** Why a targeted reward's saved target does not count. */
export type FavoredClassTargetReason = Extract<
  FavoredClassRewardReason,
  'targetMissing' | 'targetUnlisted' | 'targetLost'
>;

/**
 * Why a targeted reward's saved target does not count on a sheet whose
 * per-day maxima have these keys, if it does not: no target, one the reward
 * does not list, or a listed one the sheet lacks, in that order. The count,
 * its warning and the form's mark of a saved choice all read it (fix r2).
 */
export function targetReason(
  reward: TargetedFavoredClassReward,
  target: string | undefined,
  keys: ReadonlySet<string>,
): FavoredClassTargetReason | undefined {
  if (target === undefined) return 'targetMissing';
  if (!reward.targets.some(({ key }) => key === target))
    return 'targetUnlisted';
  return keys.has(target) ? undefined : 'targetLost';
}

/**
 * A saved reward's target: a targeted reward's key, or null when it names
 * none; undefined for an untargeted or unlisted reward, which has none.
 */
function savedTarget(
  reward: FavoredClassReward | undefined,
  bonus: { target?: string },
) {
  if (!reward || !isTargetedReward(reward)) return undefined;
  return bonus.target ?? null;
}

function selectionReasons({
  reward,
  bonus,
  facts,
  keys,
}: {
  reward: FavoredClassReward | undefined;
  bonus: { target?: string };
  facts: RewardFacts;
  keys: ReadonlySet<string>;
}): readonly FavoredClassRewardReason[] {
  if (!reward) return ['unlisted'];
  const reason = isTargetedReward(reward)
    ? targetReason(reward, bonus.target, keys)
    : undefined;
  return [...uncountedReasons(reward, facts), ...(reason ? [reason] : [])];
}

/**
 * Counting selections of a targeted reward, per target key: a Map, so a key
 * no selection names (`constructor` included) reads nothing (fix r1).
 */
function tally(levels: readonly { target?: string | null }[]) {
  const byTarget = new Map<string, number>();
  for (const { target } of levels)
    if (target) byTarget.set(target, (byTarget.get(target) ?? 0) + 1);
  return byTarget;
}

/**
 * How many counting selections each listed reward has: an untargeted
 * reward's in all, a targeted reward's per target key.
 */
export type FavoredClassRewardCounts = Readonly<
  Record<
    string,
    | { kind: 'untargeted'; count: number }
    | { kind: 'targeted'; byTarget: ReadonlyMap<string, number> }
  >
>;

/**
 * What `@favoredClassReward.<id>` reads in a rule value of this key: an
 * untargeted reward's count whatever the key; a targeted reward's count of
 * selections whose target is the key, so 0 in a rule value of any other key
 * or of none.
 */
export function favoredClassRewardCount(
  counts: FavoredClassRewardCounts | undefined,
  reward: FavoredClassReward,
  key: string | undefined,
) {
  const counted = counts?.[reward.id];
  if (!counted) return 0;
  if (counted.kind === 'untargeted') return counted.count;
  return key === undefined ? 0 : (counted.byTarget.get(key) ?? 0);
}

/**
 * Each Class Level that chose a reward, and whether it counts: the reward is
 * listed, the level's class is the reward's class and a favored class, and
 * the character counts as one of the reward's races (`rewardRaceIdentities`);
 * a targeted reward's selection also names one of its listed targets whose
 * key is in `keys`. Fix r3: `keys` are the keys of the per-day maxima the
 * sheet's daily-maxima resolution yields (`dailyMaximumKeys`, decided before
 * any formula is evaluated, so never by this count), whatever their reward.
 * `counts` gives, per listed reward, how many levels chose it and count: a
 * whole number of selections, per target for a targeted reward.
 * `targetKeys` are `keys`, which the sheet reports as
 * `favoredClassRewardTargets`; a caller offers them only narrowed to a
 * fitting reward's reviewed targets.
 */
export function resolveFavoredClassRewards({
  input,
  rows,
  keys,
}: {
  input: CharacterSheetInput;
  rows: readonly ClassLevelRow[];
  keys: ReadonlySet<string>;
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
    return [
      {
        entry: row.entry,
        rewardId: bonus.reward,
        reward,
        target: savedTarget(reward, bonus),
        reasons: selectionReasons({ reward, bonus, facts, keys }),
        facts,
      },
    ];
  });
  const counts: FavoredClassRewardCounts = Object.fromEntries(
    reviewedFavoredClassRewards.rewards.map((reward) => {
      const counted = levels.filter(
        (level) => level.rewardId === reward.id && level.reasons.length === 0,
      );
      return [
        reward.id,
        isTargetedReward(reward)
          ? { kind: 'targeted' as const, byTarget: tally(counted) }
          : { kind: 'untargeted' as const, count: counted.length },
      ];
    }),
  );
  return { counts, levels, targetKeys: keys };
}

/** "this level's class isn't Bard and isn't one of your favored classes" */
function reasonPhrases(
  reward: FavoredClassReward,
  reasons: readonly FavoredClassRewardReason[],
  target: string | null | undefined,
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
  return [...phrases, ...targetPhrases(reward, reasons, target)];
}

/** "there's no Fire Bolt on your sheet" */
function targetPhrases(
  reward: FavoredClassReward,
  reasons: readonly FavoredClassRewardReason[],
  target: string | null | undefined,
) {
  const name = isTargetedReward(reward)
    ? reward.targets.find(({ key }) => key === target)?.name
    : undefined;
  return reasons.flatMap((reason) => {
    if (reason === 'targetMissing') return ['no power is chosen for it'];
    if (reason === 'targetUnlisted')
      return ['it can’t add to the power chosen for it'];
    if (reason === 'targetLost')
      return [`there’s no ${name ?? 'such power'} on your sheet`];
    return [];
  });
}

/**
 * A rules warning on each level whose chosen reward is not counted, naming
 * the level and why; it never counts silently. Its fingerprint holds the
 * facts that decide it (fix r1, docs/character-sheet/rules-checks.md
 * "Accepted Warnings"): the reward, the reasons, the level's class, whether
 * it is favored and the races the character counts as, and a targeted
 * reward's target, so an accepted one reopens when one of them changes.
 */
export function favoredClassRewardWarnings(
  resolved: ReturnType<typeof resolveFavoredClassRewards>,
): SheetWarning[] {
  return resolved.levels.flatMap(
    ({ entry, rewardId, reward, target, reasons, facts }) => {
      if (reasons.length === 0) return [];
      const level = `Level ${entry.state.position}`;
      const message = reward
        ? `${level}: ${reward.name} isn’t counted: ${listAll(reasonPhrases(reward, reasons, target))}.`
        : `${level}: this favored class reward isn’t counted: the sheet no longer lists it.`;
      const decidingFacts = [
        reasons,
        facts.classIdentities,
        facts.favored,
        facts.races,
      ];
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
            !reward
              ? [rewardId, reasons]
              : target === undefined
                ? [rewardId, ...decidingFacts]
                : [rewardId, target, ...decidingFacts],
          ),
        },
      ];
    },
  );
}
