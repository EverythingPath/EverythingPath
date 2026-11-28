// @vitest-environment node
// maxima-promote-1 fix r3 to r6 (PRD #251; root, 2026-11-20; ORCH
// maxima-promote-1/boundary.md): the release-scope boundary of the per-day
// maxima. A per-day maximum may be promoted only if the number it shows is
// right for every character that can be built from the release scopes
// (campaign-mvp-v1 and the party scope): a release-scope row that changes the
// count while taken, worn or active is bound exactly by a record, or the
// maximum is held.
//
// Whether a row changes a count is a review of its rules text, recorded in
// the boundary file and in the reviewed list below. This guard is a pin on
// what can be built: it stores each release scope's row keys as they were
// when that review was made (rule-values-boundary-scopes.json) and fails when
// they change, so a changed scope is reviewed again before a maximum that
// depends on it is promoted or stays checked. Every per-day maximum output of
// a checked record needs its own entry in that list (fix r4), read from the
// records' status and outputs, never from a rationale. It is not a proof: it
// derives nothing from rules data and reads no PCGen or Foundry record.
//
// Fix r11 (the second promotion review, 2026-11-21): a release scope also
// holds favored-class rewards, which are no catalog entry and so no import
// key: campaign-mvp-v1's inventory gives each as an advancement contract
// (channel "racial favored class"), and a character takes one as a favored
// class bonus, which the sheet then recorded as a note ("alt") it did not
// count; since rotation-7 a Class Level saves a listed reward as a structured
// choice whose count a catalog formula reads only through an
// @favoredClassReward term (fix r16), which Bardic Performance's record has
// since reward-terms-1, checked on its promotion review.
// Each is a row this pin sees, like a catalog entry: the reviewed list
// (rule-values-boundary-rewards.json) gives, for every reward of each scope,
// its name and text as the scope gives them and the per-day keys it changes,
// and the pin fails when the scope's rewards differ from it and when a reward
// changes the key of a maximum with an entry but is not one of its rows.
//
// Fix r12 (round 11's reviews, 2026-11-22): the list pins, per reward,
// everything its contract carries that decides who may take it and what it
// does, not only its name and text: its eligibility (the native PCGen
// requirements), its accumulation (the other parameter values, the fraction
// among them), its PCGen line's hash (every tag of the line, STACK and MULT
// among them) and a digest of the rest of the contract, its owners aside;
// a contract is a reward of a scope only while that scope's closure holds it.
// A reward that changes a maximum's key is one of its rows only when listed
// for the reward's scope and bound by a record, and no listed row may be
// listed for no scope.
//
// Fix r13 (round 12's reviews, 2026-11-22; root): two rounds each found a
// field of a reward the pin did not read, so it no longer chooses fields: it
// holds, per reward, a digest of the reward's whole row as the scope file
// gives it (its inventory row and its advancement contract, every field, as
// canonical JSON), beside the reviewed judgement. Any change to any field
// fails until the entry is reviewed again.
//
// Fix r14 (round 13's reviews, 2026-11-22; root): that digest was taken over
// a map keyed by reward, which hid a repeated row; it became one digest per
// scope over its favored-class reward contracts and the rows that refer to
// them, as lists (`rewardsDigest`), with the reviewed reading per reward
// joined by reward ID after the digest is compared.
//
// Fix r15 (round 14's reviews, 2026-11-22; root): fix r14 read the files
// with a selector of its own over their raw JSON, a second reader that
// differed from the product's (a nested view, a key the schema trims). The
// pin is over what the product's scope reader yields, not the file's bytes
// (`yieldedRewards`): if the reader the import uses would yield a different
// set of favored-class rewards than the reviewed one, a reward's contract or
// row different in any field it yields, a reward added, removed, repeated or
// in another scope, the pin fails until the entry is reviewed again; no
// finding of that reader may name a reward. An edit to the file the reader
// yields identically changes nothing the product reads, and the pin does not
// claim to see it.
//
// domain-powers-1 fix r1 (both reviews, 2026-11-23; root): a row declared
// bound by a record does not show that its formula counts a reward. For each
// per-day maximum output of a committed record, every favored-class reward
// the reviewed list marks as changing its key must be read by the formula:
// it reads `@favoredClassReward.<id>` for the reward's reviewed id
// (reviewed-favored-class-rewards.json, matched by the PCGen line) as a
// variable node of the sheet's own parse of the whole formula (fix r2, r3:
// a formula `parseFormula` rejects reads no variable). A reward
// with no reviewed id cannot be read, so such a record passes only while it
// is held: drafted and in the held list (`heldRecords`, each with the rewards
// it is held for). The guard does not check the formula's arithmetic with
// the term (the fraction, the rounding): that is the promotion review's.
//
// reward-terms-1 (root, 2026-11-23): Bardic Performance's formula reads
// `@favoredClassReward.bardicPerformanceRound`, so it leaves the held list and
// its entry lists the Gnome's and Half-Elf's reward as a row bound by its
// record. Beside (g), two checks of a listed reward row (`rewardRowProblems`):
// every listed row that is a scope's reward must be of kind
// favoredClassReward (this runs for every row, before any id lookup); and a
// bound reward row whose own key resolves to a reviewed reward id (the lookup
// is by the row's key, not by the record it is bound by) must agree with that
// reward in class and races (its races and class are the combinations the
// review reads it as admitting). A bound row whose key resolves to no
// reviewed id is skipped by that comparison only. Which record a row is bound
// by is not checked (root: queued as reward-row-binding-guard).
//
// domain-power-reward-terms (root, 2026-11-25; ORCH
// domain-power-reward-terms-boundary.md): the four domain powers' formulas
// read `@favoredClassReward.clericDomainPowerUse` and, for Fire Bolt,
// `@favoredClassReward.druidDomainPowerUse` too, so (g) passes for them and
// they leave the held list (the record step checked them on their promotion
// review, phase 2); their entries list the two rewards as rows bound by
// their records. The guard is unchanged.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  listRuleValueReviews,
  type RuleValueRecord,
} from '../../scripts/catalog/curation';
import type { LaunchManifest } from '../../scripts/catalog/launch-inventory-schema';
import { launchInventoryRecordsBinding } from '../../scripts/catalog/launch-inventory-document';
import { partyBuildsPath } from '../../scripts/catalog/party/party-builds';
import {
  parsePartyExceptions,
  partyExceptionsPath,
} from '../../scripts/catalog/party/party-exceptions';
import {
  partyScopeIdentity,
  resolvePartyReleaseScope,
  type PartyReleaseScope,
} from '../../scripts/catalog/party/party-release-scope';
import {
  encodePartyScope,
  partyScopePath,
  serializePartyScope,
  type PartyScopeRow,
} from '../../scripts/catalog/party/party-scope';
import {
  readReleaseScope,
  resolveReleaseScope,
  type ReleaseScope,
} from '../../scripts/catalog/release-scope';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { canonicalReleaseJson } from '../../src/lib/catalog/release-schema';
import { reviewedFavoredClassRewards } from '../../src/lib/character-sheet-favored-class-rewards';
import {
  FormulaError,
  parseFormula,
} from '../../src/lib/character-sheet-formulas';
import type { RuleValueAmount } from '../../src/lib/character-sheet-feature-numbers';

const scopeNames = ['campaign-mvp-v1', 'campaign-party-v1'] as const;
type ScopeName = (typeof scopeNames)[number];
type ScopeKeys = Readonly<Record<ScopeName, readonly string[]>>;

const pinFile = 'tests/catalog/rule-values-boundary-scopes.json';

const rewardFile = 'tests/catalog/rule-values-boundary-rewards.json';

type RecordStatus = RuleValueRecord['status'];
/** A node of the sheet's formula parse. */
type FormulaNode = ReturnType<typeof parseFormula>;
/** A per-day maximum output: its key and its amount as the stored schema types it. */
type Maximum = { output: string; amount: RuleValueAmount };
/**
 * A rule-value record as the pin reads it: its ID as `--list` prints it
 * (the entry's key, its group and its description's hash; neither its status
 * nor its rationale), its status, and its per-day maximum outputs.
 */
type PinRecord = {
  id: string;
  status: RecordStatus;
  maxima: readonly Maximum[];
};

/**
 * A scope row that changes a maximum's count, as the review found it: its
 * kind, what it does, and either the record that gives that change exactly
 * (`boundBy`, the maximum's own record for its class and feature) or why the
 * number the sheet shows stays right with it (`situational`).
 */
type ListedRow = {
  row: string;
  name: string;
  kind: string;
  scopes: readonly ScopeName[];
  effect: string;
} & (
  | { boundBy: string; situational?: never }
  | { situational: string; boundBy?: never }
);
/**
 * One per-day maximum output's reviewed rows, keyed by its record's ID as
 * `--list` prints it, the output's key and its amount (fix r5), so two
 * outputs of one record are told apart by their amounts. The amount is typed
 * as the record stores it (fix r6): `{ rows: {} }`, `{ formula: '…' }` or a
 * fixed number, and matches only an output of the same kind and content.
 */
type Entry = Maximum & {
  record: string;
  name: string;
  rows: readonly ListedRow[];
};

/**
 * A held record (fix r1): its ID as `--list` prints it and the favored-class
 * rewards, by contract ID, it is held for.
 */
type HeldRecord = { record: string; rewards: readonly string[] };

type RewardContract = LaunchManifest['semanticContracts'][number];
/** A row a scope reader yields: campaign-mvp-v1's inventory row or a party scope row. */
type RewardRow = LaunchManifest['rows'][number] | PartyScopeRow;
/** A finding a scope reader gives for its scope. */
type ScopeFinding = { code: string; key: string; reason: string };
/**
 * A scope's favored-class rewards as its scope reader yields them (fix r15;
 * `yieldedRewards`): the reward contracts and the rows that refer to them,
 * each list in the order yielded, and the reader's findings for the scope.
 */
type ScopeRewardsRead = {
  contracts: readonly RewardContract[];
  rows: readonly RewardRow[];
  findings: readonly ScopeFinding[];
};
type ScopeRewards = Readonly<Record<ScopeName, ScopeRewardsRead>>;
/**
 * A reward as the review read it (ORCH `maxima-promote-1/boundary.md` gives
 * the reading), joined to the contract and row its scope reader yields by
 * `key`, the contract's `id`: its name, every race and class combination its PCGen
 * requirements admit among the release scopes' races and classes
 * (`eligible`, "Race Class", fix r12), and the per-day keys it changes for
 * every character who takes it (none if it changes no count a record keys;
 * `note` says why where that needs saying).
 */
type ReviewedReward = {
  key: string;
  name: string;
  eligible: readonly string[];
  changes: readonly string[];
  note?: string;
};
/**
 * A scope's reviewed rewards (fix r14): `digest`, the scope's rewards as its
 * reader yields them (`rewardsDigest`, fix r15) when the review read them, and the review's reading of
 * each reward.
 */
type ReviewedScopeRewards = {
  digest: string;
  rewards: readonly ReviewedReward[];
};
type ReviewedRewards = Readonly<Record<ScopeName, ReviewedScopeRewards>>;
/**
 * An Advanced Race Guide favored-class option the launch inventory keeps
 * only as comparison evidence (source accounting, family "ARG favored-class
 * comparison"): `remainder` with no key, so nothing in the scope offers it.
 */
type Comparison = {
  id: string;
  name: string;
  eligibility: string;
  keys: readonly string[];
};

/** How many times each key is in `keys`. */
function keyCounts(keys: readonly string[]) {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

/**
 * (a) Each scope whose keys differ from the pinned ones as lists, the same
 * keys the same number of times (order aside), with every key whose count
 * differs and its pinned and current count (fix r5), sorted into keys added,
 * removed and whose count changed. `campaign-mvp-v1`'s import keys cannot
 * repeat (release-scope.ts `collectImportKeys` returns them from a set), but
 * the party scope's schema (`partyScopeSchema` in party/party-scope.ts) does
 * not forbid a repeated row, so both are compared exactly: a repeated key is
 * not the scope the review read, whatever it would mean for a sheet.
 */
function scopeProblems(scopes: ScopeKeys, pinned: ScopeKeys) {
  return scopeNames.flatMap((scope) => {
    const now = keyCounts(scopes[scope]);
    const then = keyCounts(pinned[scope]);
    const differing = [...new Set([...now.keys(), ...then.keys()])]
      .sort()
      .map((key) => ({ key, then: then.get(key) ?? 0, now: now.get(key) ?? 0 }))
      .filter((count) => count.then !== count.now);
    if (!differing.length) return [];
    const list = (counts: typeof differing) =>
      counts
        .map((count) => `${count.key} (pinned ${count.then}, now ${count.now})`)
        .join(', ') || 'none';
    const repeats = differing.some((count) => count.now > 1)
      ? ' A key the scope gives more than once is not the scope that was reviewed: find why the scope repeats it.'
      : '';
    return [
      `${scope} differs from its pinned keys (${pinFile}), each key with its pinned and current count: added ${list(differing.filter((count) => count.then === 0))}; removed ${list(differing.filter((count) => count.now === 0))}; count changed ${list(differing.filter((count) => count.then && count.now))}.${repeats} Review each added row against every promoted per-day maximum (does it change a daily count unconditionally while taken, worn or active?), record the answer in the reviewed list or hold the maximum, then update the pin.`,
    ];
  });
}

/**
 * (b) and (d) for one listed row of a maximum whose record is `status`: the
 * row is listed for a scope (fix r12) and is in every scope it is listed for, and a record it is bound by exists
 * and, while the maximum is checked, is checked.
 */
function rowProblems(
  row: ListedRow,
  { name, status }: { name: string; status: RecordStatus },
  context: {
    scopes: ScopeKeys;
    rewardKeys: Readonly<Record<ScopeName, ReadonlySet<string>>>;
    byId: ReadonlyMap<string, PinRecord>;
    reviewedRewards: ReviewedRewards;
  },
) {
  const problems = [
    ...(row.scopes.length
      ? []
      : [
          `${row.row} (${row.name}), listed for ${name}, is listed for no scope: name the scopes it is in, or remove it.`,
        ]),
    ...row.scopes
      .filter(
        (scope) =>
          !context.scopes[scope].includes(row.row) &&
          !context.rewardKeys[scope].has(row.row),
      )
      .map(
        (scope) =>
          `${row.row} (${row.name}), listed for ${name}, is no longer in ${scope}: review ${name} again and remove or correct the row.`,
      ),
    ...rewardRowProblems(row, name, context),
  ];
  if (row.boundBy === undefined) return problems;
  const bound = context.byId.get(row.boundBy)?.status;
  return bound !== undefined && (status !== 'checked' || bound === 'checked')
    ? problems
    : [
        ...problems,
        `${row.row} (${row.name}) is bound by ${row.boundBy}, which is ${bound ?? 'no committed record'}, while ${name} is ${status}: check the record with the maximum, correct the binding, or hold the maximum.`,
      ];
}

/**
 * reward-terms-1, for one listed row: a favored-class reward of a scope the
 * row is listed for is listed as kind favoredClassReward; and a reward row
 * bound by a record, whose reviewed reward (the one of its PCGen line,
 * `readableRewardIds`) exists, has that reviewed reward count for exactly the
 * race and class combinations the review reads it as admitting (`eligible`):
 * the row agrees with its reviewed reward in class and races. The kind check
 * runs for every row, before the id lookup, which is by the row's own key; a
 * bound row whose key resolves to no reviewed id is skipped by the class and
 * race comparison only. Which record the row is bound by is not checked.
 * Whether a record's formula reads the rewards that change its key is (g)'s
 * (`rewardFormulaProblems`).
 */
function rewardRowProblems(
  row: ListedRow,
  name: string,
  {
    rewardKeys,
    reviewedRewards,
  }: {
    rewardKeys: Readonly<Record<ScopeName, ReadonlySet<string>>>;
    reviewedRewards: ReviewedRewards;
  },
) {
  const listed = `${row.row} (${row.name}), listed for ${name},`;
  if (row.kind !== 'favoredClassReward') {
    const scope = row.scopes.find((each) => rewardKeys[each].has(row.row));
    return scope === undefined
      ? []
      : [
          `${listed} is a favored-class reward of ${scope} listed as a row of kind ${row.kind}: list it as kind favoredClassReward.`,
        ];
  }
  const reviewedId = readableRewardIds.get(row.row);
  const reward = reviewedFavoredClassRewards.rewards.find(
    ({ id: each }) => each === reviewedId,
  );
  if (row.boundBy === undefined || !reward) return [];
  const { classes, races } = reviewedFavoredClassRewards;
  const className = classes[reward.class]?.name ?? reward.class;
  const countsFor = reward.races
    .map((race) => `${races[race]?.name ?? race} ${className}`)
    .sort();
  return row.scopes.flatMap((scope) => {
    const review = reviewedRewards[scope].rewards.find(
      ({ key }) => key === row.row,
    );
    const admitted = review && [...review.eligible].sort();
    return admitted && !isDeepStrictEqual(admitted, countsFor)
      ? [
          `${listed} is counted as ${reward.id}, which counts for ${countsFor.join(', ')}, while the review reads the reward as admitting ${admitted.join(', ')}: correct the reviewed favored-class reward list or the review.`,
        ]
      : [];
  });
}

/** An amount as a message names it: `fixed n`, `rows` (`rows × per`), or `formula …`. */
function amountText(amount: RuleValueAmount) {
  if (typeof amount === 'number') return `fixed ${amount}`;
  if ('formula' in amount) return `formula ${amount.formula}`;
  return amount.rows.per === undefined ? 'rows' : `rows × ${amount.rows.per}`;
}

/**
 * An amount's kind and content exactly as the stored schema types it (fix
 * r6), so the formula `rows` is not the rows and the formula `1` is not the
 * fixed number 1, though a message would name them alike without the kind.
 */
const typedAmount = (amount: RuleValueAmount) =>
  typeof amount === 'number'
    ? ['fixed', amount]
    : 'formula' in amount
      ? ['formula', amount.formula]
      : ['rows', amount.rows.per ?? null];

type Occurrence = Maximum & { record: string };
/** What the pin counts an occurrence by: its record, output key and typed amount. */
const occurrence = ({ record, output, amount }: Occurrence) =>
  JSON.stringify([record, output, typedAmount(amount)]);
const occurrenceText = ({ record, output, amount }: Occurrence) =>
  `${output} (${amountText(amount)}) of ${record}`;
const occurrencesOf = ({ id, maxima }: PinRecord) =>
  maxima.map((maximum) => ({ record: id, ...maximum }));

/** How many times each occurrence is in `occurrences`, with how a message names it. */
function occurrenceCounts(occurrences: readonly Occurrence[]) {
  const counts = new Map<string, { text: string; count: number }>();
  for (const each of occurrences) {
    const key = occurrence(each);
    const count = counts.get(key)?.count ?? 0;
    counts.set(key, { text: occurrenceText(each), count: count + 1 });
  }
  return counts;
}
const times = (count: number) => (count === 1 ? 'once' : `${count} times`);
const entryCount = (count: number) =>
  count === 0 ? 'no entry' : `${count} ${count === 1 ? 'entry' : 'entries'}`;

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

/**
 * (e) Fix r11, as fix r15 has it: each scope's favored-class rewards as its
 * scope reader yields them against the reviewed list. First the digest: the
 * yielded contracts and rows (`yieldedRewards`) against the one the review
 * read, so a reward whose contract or row is yielded different in any field,
 * one added, removed or repeated, or two yielded in another order fails; and
 * no finding of the reader names a reward. Then, the digest compared, the
 * join of the review's reading by reward ID: every reviewed reward has
 * exactly one contract and exactly one yielded row in its scope, its
 * reviewed name is its contract's, and its scope's closure holds it (fix
 * r12); every reward the scope yields is reviewed, once. Then a reviewed
 * reward that changes a key no committed per-day record gives or raises (a
 * misspelt key reads as none), and an ARG comparison entry that is no
 * longer a remainder without keys, so the scope may offer it.
 */
function rewardProblems({
  rewards,
  reviewedRewards,
  closures,
  comparisons,
  perDayKeys,
}: {
  rewards: ScopeRewards;
  reviewedRewards: ReviewedRewards;
  closures: Readonly<Record<ScopeName, ReadonlySet<string>>>;
  comparisons: readonly Comparison[];
  perDayKeys: ReadonlySet<string>;
}) {
  const scopeRewardProblems = scopeNames.flatMap((scope) => {
    const file = rewards[scope];
    const review = reviewedRewards[scope];
    const digest = rewardsDigest(file);
    const changed =
      digest === review.digest
        ? []
        : [
            `${scope}’s favored-class reward contracts and the rows that refer to them, as its scope reader yields them, differ from the ones reviewed (${rewardFile}): digest now ${digest}, reviewed ${review.digest}. Find each changed reward in the scope file, review who may take that reward, what it does and the per-day keys it changes again, correct its entry and record the new digest.`,
          ];
    const reviewedKeys = review.rewards.map(({ key }) => key);
    const contractIds = file.contracts.map(rewardIdOf);
    const rowIds = file.rows.map(rewardIdOf);
    const rewardKeys = new Set([...contractIds, ...rowIds, ...reviewedKeys]);
    const findings = file.findings
      .filter(
        ({ key }) => rewardKeys.has(key) || key.startsWith(rewardKeyPrefix),
      )
      .map(
        ({ code, key, reason }) =>
          `${scope}’s scope reader gives the finding ${code} on ${key}, a favored-class reward: ${reason} Correct the scope file, then review that reward again.`,
      );
    const repeated = [...keyCounts(reviewedKeys)]
      .filter(([, count]) => count > 1)
      .map(
        ([key, count]) =>
          `${key} is given ${count} times in ${scope}’s reviewed list (${rewardFile}): keep one.`,
      );
    const joined = review.rewards.flatMap(({ key, name, changes }) => {
      const contracts = file.contracts.filter(
        (contract) => rewardIdOf(contract) === key,
      );
      const rows = rowIds.filter((row) => row === key).length;
      const changing = changes.join(', ') || 'none';
      if (!contracts.length && !rows)
        return [
          `${key} (${name}) is in ${scope}’s reviewed list (${rewardFile}) but its scope reader yields no favored-class reward of that ID: review the maxima whose keys it changed (${changing}) and remove it.`,
        ];
      if (contracts.length !== 1 || rows !== 1)
        return [
          `${key} (${name}), in ${scope}’s reviewed list (${rewardFile}), has ${plural(contracts.length, 'contract')} and ${plural(rows, 'row')} as its scope reader yields them: a reviewed reward has exactly one of each. Find why the scope gives it so, review the maxima whose keys it changes (${changing}) again, then correct the file or the entry.`,
        ];
      const [contract] = contracts;
      const given = contract?.name;
      return [
        ...(given === name
          ? []
          : [
              `${key}’s reviewed name in ${rewardFile} is ${JSON.stringify(name)}, its contract’s ${JSON.stringify(given)}: correct the entry.`,
            ]),
        ...(closures[scope].has(key)
          ? []
          : [
              `${key} (${name}), in ${scope}’s reviewed list (${rewardFile}), is no longer in ${scope}’s closure, so the scope does not offer it: review the maxima whose keys it changed (${changing}) and remove it.`,
            ]),
      ];
    });
    const unreviewed = [...new Set([...contractIds, ...rowIds])]
      .filter((key) => !reviewedKeys.includes(key))
      .sort()
      .map((key) => {
        const contract = file.contracts.find(
          (each) => rewardIdOf(each) === key,
        );
        return `${key} (${contract?.name ?? 'no contract'}), a favored-class reward ${scope}’s scope reader yields, is not in its reviewed list (${rewardFile}): review its text against every per-day maximum (does it change a daily count for every character who takes it?), record the keys it changes, or none, then add it.`;
      });
    const unknownKeys = review.rewards.flatMap(({ key, name, changes }) =>
      changes
        .filter((output) => !perDayKeys.has(output))
        .map(
          (output) =>
            `${key} (${name}) is reviewed as changing ${output}, which no committed per-day record gives or raises: correct the key.`,
        ),
    );
    return [
      ...changed,
      ...findings,
      ...repeated,
      ...joined,
      ...unreviewed,
      ...unknownKeys,
    ];
  });
  return [
    ...scopeRewardProblems,
    ...comparisons
      .filter(
        ({ eligibility, keys }) => eligibility !== 'remainder' || keys.length,
      )
      .map(
        ({ id: comparison, name, eligibility, keys }) =>
          `${comparison} (${name}), an ARG favored-class comparison entry, is ${eligibility} with ${keys.length} keys: the scope may offer it, so review it as a favored-class reward.`,
      ),
  ];
}

/**
 * (f) Fix r11: a reviewed favored-class reward of a scope that changes the
 * key of a maximum with an entry is one of that entry's rows. Fix r12: listed
 * for that scope and bound by a record, never situational, since a reward
 * reviewed as changing a key changes it for every character who takes it.
 */
function entryRewardProblems(
  entries: readonly Entry[],
  reviewedRewards: ReviewedRewards,
) {
  return entries.flatMap(({ output, name, rows }) =>
    scopeNames.flatMap((scope) =>
      reviewedRewards[scope].rewards
        .filter(
          ({ key, changes }) =>
            changes.includes(output) &&
            !rows.some(
              (row) =>
                row.row === key &&
                row.scopes.includes(scope) &&
                row.boundBy !== undefined,
            ),
        )
        .map(
          ({ key, name: reward }) =>
            `${key} (${reward}), a favored-class reward of ${scope}, changes ${output}, ${name}’s count, for every character who takes it, and is not one of its rows listed for ${scope} and bound by a record: bind it by a record (a reward that changes a count is not situational), or hold the maximum and remove its entry.`,
        ),
    ),
  );
}

/**
 * The variables the sheet reads in `formula` (fix r3): every variable node of
 * the sheet's own parse (`parseFormula`, src/lib/character-sheet-formulas.ts),
 * each name whole as its tokenizer reads it, so `@favoredClassReward.rageRounds`
 * is not `@favoredClassReward.rageRound`; or, when the parser rejects the
 * formula, why, since the sheet then reads none of it.
 */
function formulaVariables(
  formula: string,
):
  | { parses: true; names: ReadonlySet<string> }
  | { parses: false; error: string } {
  let node: FormulaNode;
  try {
    node = parseFormula(formula);
  } catch (error) {
    if (error instanceof FormulaError)
      return { parses: false, error: error.message };
    throw error;
  }
  const names = new Set<string>();
  const visit = (current: FormulaNode): void => {
    switch (current.kind) {
      case 'integer':
        return;
      case 'variable':
        names.add(current.name);
        return;
      case 'unary':
        visit(current.operand);
        return;
      case 'binary':
        visit(current.left);
        visit(current.right);
        return;
      case 'function':
        current.arguments.forEach(visit);
        return;
      default: {
        // A node kind the parser gains fails the type check here.
        const unknown: never = current;
        throw new Error(`Unknown formula node ${JSON.stringify(unknown)}.`);
      }
    }
  };
  visit(node);
  return { parses: true, names };
}

/**
 * (g) Fix r1 (both reviews of domain-powers-1): what this guarantees, and no
 * more. For each per-day maximum output of a committed record, every
 * favored-class reward of a scope that the reviewed list marks as changing
 * its key must be read by the record's formula: the sheet's own parser
 * (`parseFormula`) parses the whole formula and the parse holds the variable
 * `@favoredClassReward.<id>` exactly (`formulaVariables`, fix r2 and r3; a
 * formula the parser rejects reads none), where `<id>` is the reviewed
 * reward whose PCGen line is the reward's (`src/lib/catalog/data/reviewed-favored-class-rewards.json`,
 * matched by its contract ID). A reward with no reviewed id cannot be read,
 * so a record for such a key passes only while it is held: drafted and in
 * the held list. A row declared bound by the record (`entryRewardProblems`)
 * does not stand in for the term. It does not check that the formula's
 * arithmetic with the term is right (the fraction, the rounding): that is the
 * promotion review's. The held list itself fails on a record that is no
 * committed record or is checked, and on a reward it is held for that the
 * reviewed list no longer marks as changing one of the record's maximum keys
 * (a marking removed), so the reading is reviewed before the record leaves it.
 */
function rewardFormulaProblems({
  records,
  held,
  reviewedRewards,
}: {
  records: readonly PinRecord[];
  held: readonly HeldRecord[];
  reviewedRewards: ReviewedRewards;
}) {
  const byId = new Map(records.map((record) => [record.id, record]));
  const heldIds = new Set(
    held
      .filter(({ record }) => byId.get(record)?.status === 'drafted')
      .map(({ record }) => record),
  );
  const marked = scopeNames.flatMap((scope) =>
    reviewedRewards[scope].rewards.map((reward) => ({ scope, ...reward })),
  );
  const unread = records
    .filter(({ id }) => !heldIds.has(id))
    .flatMap(({ id: record, maxima }) =>
      maxima.flatMap(({ output, amount }) => {
        const rewards = marked.filter(({ changes }) =>
          changes.includes(output),
        );
        if (!rewards.length) return [];
        // Fix r4: parsed once, before the reviewed ids are looked up, so a
        // formula the sheet rejects gets its one problem whatever ids exist.
        const read =
          typeof amount === 'object' && 'formula' in amount
            ? formulaVariables(amount.formula)
            : undefined;
        if (read && !read.parses)
          return [
            `${record}'s ${output} formula does not parse (${read.error}), so it reads no variable: correct it, or hold the record (drafted and in the held list).`,
          ];
        return rewards.flatMap(({ scope, key, name }) => {
          const reviewedId = readableRewardIds.get(key);
          if (reviewedId === undefined)
            return [
              `${record} gives ${output}, which ${key} (${name}), a favored-class reward of ${scope}, changes, and no reviewed favored-class reward id a formula can read is that reward's (src/lib/catalog/data/reviewed-favored-class-rewards.json), so the formula cannot count it: hold the record (drafted and in the held list) until one exists.`,
            ];
          const term = `@favoredClassReward.${reviewedId}`;
          return read?.names.has(term)
            ? []
            : [
                `${record}'s ${output} formula does not read ${term}, the count of ${key} (${name}), a favored-class reward of ${scope} that changes it: add the term, or hold the record (drafted and in the held list).`,
              ];
        });
      }),
    );
  const heldProblems = held.flatMap(({ record, rewards }) => {
    const found = byId.get(record);
    if (!found)
      return [
        `${record} is in the held list but is no committed rule-value record: review it under its current ID, or remove it.`,
      ];
    if (found.status !== 'drafted')
      return [
        `${record} is in the held list but is ${found.status}: a checked maximum is not held, so remove it from the list; its formula must then read each reward that changes its key.`,
      ];
    const outputs = found.maxima.map(({ output }) => output);
    return rewards
      .filter(
        (reward) =>
          !marked.some(
            ({ key, changes }) =>
              key === reward &&
              changes.some((change) => outputs.includes(change)),
          ),
      )
      .map(
        (reward) =>
          `${record} is held for ${reward}, which the reviewed list (${rewardFile}) does not mark as changing ${outputs.join(', ') || 'any per-day maximum of it'}: review that reward's reading again, then correct the list or the held entry.`,
      );
  });
  return [...unread, ...heldProblems];
}

/**
 * What fails the pin: (a) a scope's keys differ from the pinned ones as lists
 * (`scopeProblems`); (b) a listed row is no longer in a scope it is listed
 * for; (c) a record has two per-day maximum outputs of one key (fix r5: no
 * committed record has two maxima at all, and the sheet would show each, so
 * the shape is forbidden outright); the per-day maximum outputs of a checked
 * record and the entries for them differ as multisets, each output keyed by
 * the record's ID, its key and its amount; or an entry is repeated or names a
 * record or an output that no longer exists; (d) a row is bound by a record
 * that does not exist, or that is drafted while the maximum is checked. Which
 * maxima need an entry is read from the records' status and outputs alone: a
 * drafted record may have one per output (that is how a promotion review
 * reads it), and needs one once the record step checks it. (e) and (f),
 * the favored-class rewards: `rewardProblems` and `entryRewardProblems`;
 * (g) a reward's count not read by the formula of a record that is not held,
 * and the held list (`rewardFormulaProblems`, fix r1).
 */
function boundaryProblems({
  scopes,
  pinned,
  entries,
  records,
  rewards,
  reviewedRewards,
  closures,
  comparisons,
  perDayKeys,
  held,
}: {
  scopes: ScopeKeys;
  pinned: ScopeKeys;
  held: readonly HeldRecord[];
  entries: readonly Entry[];
  records: readonly PinRecord[];
  rewards: ScopeRewards;
  reviewedRewards: ReviewedRewards;
  closures: Readonly<Record<ScopeName, ReadonlySet<string>>>;
  comparisons: readonly Comparison[];
  perDayKeys: ReadonlySet<string>;
}): string[] {
  const byId = new Map(records.map((record) => [record.id, record]));
  const rewardKeys = {
    'campaign-mvp-v1': new Set(
      rewards['campaign-mvp-v1'].contracts.map(rewardIdOf),
    ),
    'campaign-party-v1': new Set(
      rewards['campaign-party-v1'].contracts.map(rewardIdOf),
    ),
  };
  const given = occurrenceCounts(records.flatMap(occurrencesOf));
  const checked = occurrenceCounts(
    records.filter(({ status }) => status === 'checked').flatMap(occurrencesOf),
  );
  const listed = occurrenceCounts(entries);
  const countIn = (counts: typeof given, key: string) =>
    counts.get(key)?.count ?? 0;
  return [
    ...scopeProblems(scopes, pinned),
    ...rewardProblems({
      rewards,
      reviewedRewards,
      closures,
      comparisons,
      perDayKeys,
    }),
    ...entryRewardProblems(entries, reviewedRewards),
    ...rewardFormulaProblems({ records, held, reviewedRewards }),
    ...records.flatMap(({ id, maxima }) =>
      [...keyCounts(maxima.map(({ output }) => output))]
        .filter(([, count]) => count > 1)
        .map(
          ([output, count]) =>
            `${id} has ${count} per-day maximum outputs keyed ${output}: a record gives at most one per-day maximum per key (no committed record has two), so remove one or give it its own key.`,
        ),
    ),
    ...[...checked]
      .filter(([key, { count }]) => countIn(listed, key) < count)
      .map(
        ([key, { text, count }]) =>
          `${text}: a checked per-day maximum, ${times(count)} in its record and ${entryCount(countIn(listed, key))} in the reviewed list. Review the release scopes’ rows against each output and give each its own entry, keyed by the record’s ID, the output’s key and its amount.`,
      ),
    ...[...listed]
      .filter(
        ([key, { count }]) => given.has(key) && count > countIn(given, key),
      )
      .map(
        ([key, { text, count }]) =>
          `${text}: ${entryCount(count)} in the reviewed list for ${times(countIn(given, key))} in its record. Keep one entry per output.`,
      ),
    ...entries.flatMap(({ record: id, output, amount, name, rows }) => {
      const record = byId.get(id);
      if (!record)
        return [
          `The entry for ${name} names ${id}, which is no committed rule-value record: review the maximum again under its record’s current ID, or remove the entry.`,
        ];
      if (!given.has(occurrence({ record: id, output, amount })))
        return [
          `The entry for ${name} names ${output} (${amountText(amount)}), which is no per-day maximum of ${id}: correct or remove the entry.`,
        ];
      return rows.flatMap((row) =>
        rowProblems(
          row,
          { name, status: record.status },
          { scopes, rewardKeys, byId, reviewedRewards },
        ),
      );
    }),
  ];
}

function recordId(record: RuleValueRecord) {
  const [review] = listRuleValueReviews([record]);
  if (!review) throw new Error(`No review ID for ${record.externalKey}.`);
  return review.id;
}

const pinRecords = (ruleValues: readonly RuleValueRecord[]): PinRecord[] =>
  ruleValues.map((record) => ({
    id: recordId(record),
    status: record.status,
    maxima: record.outputs.flatMap(({ ruleValue }) =>
      ruleValue.kind === 'dailyMaximum'
        ? [{ output: ruleValue.key, amount: ruleValue.amount }]
        : [],
    ),
  }));
const ruleValues = reviewedCuration.ruleValues ?? [];
const committedRecords = pinRecords(ruleValues);
/** Every key a committed per-day record gives a maximum of or raises. */
const committedPerDayKeys = new Set(
  ruleValues.flatMap(({ outputs }) =>
    outputs.flatMap(({ ruleValue }) =>
      ruleValue.kind === 'dailyMaximum' ||
      ruleValue.kind === 'dailyMaximumIncrease'
        ? [ruleValue.key]
        : [],
    ),
  ),
);

const favoredClassChannel = 'racial favored class';
/**
 * The key the launch inventory gives each favored-class reward, its
 * contract's `id` and its row's `key`. A row or contract under it is taken
 * as a reward's whatever its channel says, so a row the reader yields for a
 * reward ID no contract gives (one moved to the party scope, whose document
 * holds no contracts) is still seen.
 */
const rewardKeyPrefix = 'rule/core/favored-class/';
/**
 * The reviewed favored-class rewards a formula can read, each id by the
 * contract ID of its PCGen line (fix r1).
 */
const readableRewardIds: ReadonlyMap<string, string> = new Map(
  reviewedFavoredClassRewards.rewards.map(({ id: reward, source }) => [
    `${rewardKeyPrefix}${source.pcgen}`,
    reward,
  ]),
);
/** The contract ID of the Advanced Player's Guide reward on `line` of its PCGen list. */
const rewardKey = (line: number) =>
  `${rewardKeyPrefix}roleplaying_game/advanced_players_guide/apg_abilities_race.lst:${line}`;

/**
 * A scope's favored-class rewards as its scope reader yields them (fix r15,
 * root's decision): of what the reader yields, the contracts of the channel
 * "racial favored class" or with a reward ID, and the rows whose key is a
 * selected contract's ID or a reward ID, each list as yielded, in its order,
 * nothing deduplicated; and the reader's findings for the scope.
 */
function yieldedRewards({
  contracts,
  rows,
  findings,
}: {
  contracts: readonly RewardContract[];
  rows: readonly RewardRow[];
  findings: readonly ScopeFinding[];
}): ScopeRewardsRead {
  const selected = contracts.filter(
    ({ id: key, channel }) =>
      channel === favoredClassChannel || key.startsWith(rewardKeyPrefix),
  );
  const ids = new Set(selected.map(({ id: key }) => key));
  return {
    contracts: selected,
    rows: rows.filter(
      ({ key }) => ids.has(key) || key.startsWith(rewardKeyPrefix),
    ),
    findings,
  };
}
/** A stored element that is a row itself, not a reference to one, as a plain record. */
const inlineRow = (element: unknown) =>
  element !== null &&
  typeof element === 'object' &&
  'key' in element &&
  typeof element.key === 'string'
    ? Object.fromEntries(Object.entries(element))
    : undefined;
/** campaign-mvp-v1's rewards, from a scope `readReleaseScope` or `resolveReleaseScope` gives. */
const launchRewardsOf = ({ manifest, findings }: ReleaseScope) =>
  yieldedRewards({
    contracts: manifest.semanticContracts,
    rows: manifest.rows,
    findings,
  });
/**
 * The party scope's rewards, from the scope `resolvePartyReleaseScope` gives:
 * its document holds rows only (`partyScopeSchema`), so no contract.
 */
const partyRewardsOf = ({ scope, findings }: PartyReleaseScope) =>
  yieldedRewards({ contracts: [], rows: scope.rows, findings });

/**
 * The digest the pin compares (fix r14, over the reader's yield since fix
 * r15): the SHA-256 of a scope's two lists, contracts and rows, as
 * `yieldedRewards` selects them, through the shared canonical serializer
 * (`canonicalReleaseJson`: object keys sorted, array order and string bytes
 * untouched). Two rewards yielded in another order change it too, so a
 * reordered scope fails until it is reviewed again, the safe direction.
 */
const rewardsDigest = ({ contracts, rows }: ScopeRewardsRead) =>
  `sha256:${createHash('sha256').update(canonicalReleaseJson({ contracts, rows })).digest('hex')}`;

/** A selected contract's or row's reward ID: a contract's `id`, a row's `key`. */
const rewardIdOf = (element: RewardContract | RewardRow) =>
  'id' in element ? element.id : element.key;

/*
 * The scope readers the pin calls (fix r15): the ones the import and the
 * release resolver use. campaign-mvp-v1: `readReleaseScope` (release-scope.ts;
 * `openReleaseScope` in release-scopes.ts calls it for a build, and the
 * resolver `resolveReleaseScope` for a supplied copy, which the tests call
 * for an edited file, uncached). The party scope: `resolvePartyReleaseScope`
 * (party/party-release-scope.ts, which `openPartyScope` calls with the
 * committed builds and exceptions; it decodes with `decodePartyScope`).
 */
const launchScope = await readReleaseScope({ version: 'campaign-mvp-v1' });
const partyInputs = {
  buildsBytes: await readFile(partyBuildsPath, 'utf8'),
  exceptions: parsePartyExceptions(
    JSON.parse(await readFile(partyExceptionsPath, 'utf8')),
  ),
};
const committedPartyText = await readFile(partyScopePath, 'utf8');
const partyScope = resolvePartyReleaseScope({
  text: committedPartyText,
  ...partyInputs,
});

function committedScopes(): ScopeKeys {
  return {
    'campaign-mvp-v1': launchScope.importKeys,
    'campaign-party-v1': partyScope.scope.rows.map(({ key }) => key),
  };
}

const committedRewards: ScopeRewards = {
  'campaign-mvp-v1': launchRewardsOf(launchScope),
  'campaign-party-v1': partyRewardsOf(partyScope),
};
/**
 * Each scope's closure, which the join checks after the digest (fix r12: a
 * contract the closure lacks is no reward of the scope): the launch scope's
 * as its resolver gives it, the party scope's its rows' keys.
 */
const launchClosure = new Set(launchScope.closure);
/** The launch inventory's ARG favored-class comparison entries. */
const committedComparisons: Comparison[] = launchScope.manifest.sourceAccounting
  .filter(({ family }) => family === 'ARG favored-class comparison')
  .map(({ id: comparison, name, eligibility, keys }) => ({
    id: comparison,
    name,
    eligibility,
    keys,
  }));

const id = {
  bane: 'rule-value pf1/MpvhQz62qw68D2pd per-day sha256:51f16f4af08e09ae2b1a68dc4eca0c1a19aa5e2c82e7c2184d8db3ec806e05e2',
  discernLies:
    'rule-value pf1/S9lYCsz7oA7v3GzR per-day sha256:2871ff383e06262c28125dd97ff8681b8156ca490a72575e5fe63c01fed87492',
  judgment:
    'rule-value pf1/qI4IouTn4uvDPSXv per-day sha256:7f1987c4766b1afa5ad1b4dacf8f1a83ceb8b078c04b686f20aa4f78d98996e1',
  challenge:
    'rule-value pf1/WNi2SBF6Z2zhBMCl per-day sha256:9826539ae371c4b2ac2e1e10723502eeb9d823040fec11ed806af713cad5a6be',
  slayersAdvance:
    'rule-value pf1/yotHT522pQoKDhID per-day sha256:3ab9243872eb5c50c716a24ee96630e6cff41b0b2bbb18ce4c3803579679888a',
  summonMonster:
    'rule-value pf1/caNEmbCtoHA7NYtZ per-day sha256:ac2bd469cc289d9a4e0dbd7a167946ef716521ceb2a94832c864009684f4ed3a',
  bondSenses:
    'rule-value pf1/Aj7SwIo94HfcpR9R per-day sha256:cfa2b80b885487674ffe6fcfeb4d5a019c84ff39d923f422b5c3926c879273ea',
  makersCall:
    'rule-value pf1/Jw6BEoNMBxfSN4cu per-day sha256:321042c4d394103f55786a072f19e694705eb268d359365505931ba2224bbfa1',
  mergeForms:
    'rule-value pf1/CW99G919xJkrIWAu per-day sha256:35f050fbb45358d989b54f01b2da53cea83fe7183db34588e98774f87fbabb4d',
  bardicPerformance:
    'rule-value pf1/ZfCUTi1MiLgR4T7I per-day sha256:b05d04b283c5a7ce0fd8a77edd3da78882e9a8c4766ce457c7e81a700d788ae2',
  extraPerformance:
    'rule-value pf1/6yGoL82RidBHmXPb per-day sha256:fa73afffdaca6959238c4bcf143474d9eea734b948f7248c2b34aa01926541b4',
  arcanePool:
    'rule-value pf1/mpe3JHJMINddqLWr per-day sha256:444a97162ea55031babc41172a6616589a1e48bdeedd001c389cca5da5e6a6f3',
  extraArcanePool:
    'rule-value pf1/3lfNiysSNv1ahV4F per-day sha256:54e85a6f7896ad1787541049446cd11a96adc2c65bed78f3b57335735898f813',
  madDogRage:
    'rule-value everythingpath/barbarian-mad-dog-rage per-day sha256:c855a5268de38d772d6978430a930acab71ec7c0ebd90150e2392bf00c3d6108',
  quiveringPalm:
    'rule-value pf1/n4SWyKVcdmZK4t7d per-day sha256:e5bf597ab21436e33547713e0106afcb1bbb548f8bd006c6a01854faec687b0b',
  bomb: 'rule-value pf1/7gHiZBNHjwefbBLI per-day sha256:ea8216c922e117cf01425fe31bc4e9f4eb93ff6c87549db8a75353cbd372ae55',
  stunningFist:
    'rule-value pf1/2ausI8g6SsmbOpgF per-day sha256:1e4b90bb52567e509b1c817b8ebc4ec8cf3a9783268a3082ae53706ec3170b57',
  kiPoolUc:
    'rule-value pf1/7BfYNNkYjjBevun8 per-day sha256:88eec54f6442914e7ada902f3c7f5d39e7ca0b0ee13476808ca3b6bb9c3451dc',
  rage: 'rule-value pf1/WSqWT9ZIshtC5vlV per-day sha256:d669554c4ba24e588c4a5b1630116be75a10225ad66c84586745d0f52fde74f5',
  fireBolt:
    'rule-value pf1/V57hEfKt1MroRI91 per-day sha256:7cee84fa9aec0c57f6a2ba083190fb27f053f65ca8c95d399fd2c0ed1a97de75',
  rebukeDeath:
    'rule-value pf1/8iWGEKKdoKTHsDy5 per-day sha256:e20bba58dce06563caf5dc38a9cbd2613bfb7fc87b173bbb00a9594d59653d13',
  touchOfGlory:
    'rule-value pf1/0BFuaPpChxXneJwF per-day sha256:f6b215f7a44a36bfb23338056a7817422c4df1481aaa017b22328fa1ad5be439',
  restorativeTouch:
    'rule-value pf1/PDiHqRkoHr3AeTUv per-day sha256:d17d8a654df5b3f430c7fea941d5d267221c0ba9b6d4ba7bfa12689b45cd63e8',
} as const;

const mvp: readonly ScopeName[] = ['campaign-mvp-v1'];
const both: readonly ScopeName[] = scopeNames;
/** A class and its feature, both bound by the maximum's own record. */
const own = ({
  record,
  scopes,
  classRow: [classRow, className, classEffect],
  feature: [featureRow, featureName],
}: {
  record: string;
  scopes: readonly ScopeName[];
  classRow: readonly [string, string, string];
  feature: readonly [string, string];
}): ListedRow[] => [
  {
    row: classRow,
    name: className,
    kind: 'class',
    scopes,
    effect: classEffect,
    boundBy: record,
  },
  {
    row: featureRow,
    name: featureName,
    kind: 'classFeature',
    scopes,
    effect: 'The feature, whose record is the maximum.',
    boundBy: record,
  },
];
const inquisitor = (effect: string) =>
  ['pf1/Fv3FbmXptuDRiL5y', 'Inquisitor', effect] as const;
const summoner = (effect: string) =>
  ['pf1/BrnHPJ2EVSQSyNQ8', 'Summoner', effect] as const;

/**
 * The reviewed list's entries for the per-day maximum outputs of the checked
 * records (ORCH maxima-promote-1/boundary.md, fix r3): the nine, and the
 * Magus's pool, which maxima-promote-1 sent to its promotion review and the
 * record step checked on it; with Bardic Performance's (reward-terms-1,
 * checked on its promotion review) and the four domain powers'
 * (domain-power-reward-terms, checked on theirs, `domainPowers` below) they
 * are the reviewed list, `reviewed`.
 * Each gives the rows the guard pins for that record, and a pinned row is one
 * of the two cases of `ListedRow` above: bound by a record (`boundBy`, the
 * record that gives the row's change exactly) or situational (`situational`,
 * why the number the sheet shows stays right with the row). Neither kind may
 * be dropped without the boundary document. Favored-class reward eligibility
 * reaches the count through the sheet's race identities and favored classes,
 * which the boundary document describes. The nine checked
 * maxima were confirmed by the stats-d3 promotion review on these scopes,
 * whose membership has not changed since; their rows here are the class and feature that give the count and
 * the rows a reading of the scopes' text found to touch it.
 */
const checkedEntries: readonly Entry[] = [
  {
    record: id.bane,
    output: 'classFeat_bane',
    amount: { formula: '@classLevel.inquisitor' },
    name: 'Bane',
    rows: own({
      record: id.bane,
      scopes: mvp,
      classRow: inquisitor(
        'Grants Bane at 5th; the rounds a day are the inquisitor level, @classLevel.inquisitor (PRD advancedPlayersGuide/baseClasses/inquisitor.html:434).',
      ),
      feature: ['pf1/MpvhQz62qw68D2pd', 'Bane'],
    }),
  },
  {
    record: id.discernLies,
    output: 'classFeat_discernLies',
    amount: { formula: '@classLevel.inquisitor' },
    name: 'Discern Lies',
    rows: own({
      record: id.discernLies,
      scopes: mvp,
      classRow: inquisitor(
        'Grants Discern Lies at 5th; the rounds a day are the inquisitor level, @classLevel.inquisitor (inquisitor.html:435).',
      ),
      feature: ['pf1/S9lYCsz7oA7v3GzR', 'Discern Lies'],
    }),
  },
  {
    record: id.judgment,
    output: 'classFeat_judgment',
    amount: { rows: {} },
    name: 'Judgment',
    rows: own({
      record: id.judgment,
      scopes: mvp,
      classRow: inquisitor(
        'Grants Judgment at 1st; the uses a day are the record’s rows, one at each of inquisitor levels 1, 4, 7, 10, 13, 16 and 19, so 1 at 1st to 7 at 19th (“At 4th level and every three levels thereafter”, inquisitor.html:414).',
      ),
      feature: ['pf1/qI4IouTn4uvDPSXv', 'Judgment'],
    }),
  },
  {
    record: id.challenge,
    output: 'classFeat_challengeCav',
    amount: { rows: {} },
    name: 'Challenge (Cavalier)',
    rows: [
      ...own({
        record: id.challenge,
        scopes: mvp,
        classRow: [
          'pf1/u1ed3H9xtYQXTP5v',
          'Cavalier',
          'Grants Challenge at 1st; the uses a day are the record’s rows, one at each of cavalier levels 1, 4, 7, 10, 13, 16 and 19, so 1 at 1st to 7 at 19th (“one additional time per day for every three levels beyond 1st”, PRD advancedPlayersGuide/baseClasses/cavalier.html:380).',
        ],
        feature: ['pf1/WNi2SBF6Z2zhBMCl', 'Challenge (CAV)'],
      }),
      {
        row: 'pf1/783ZlVJfCgXAvAAl',
        name: 'Order of the Flame',
        kind: 'classFeature',
        scopes: mvp,
        effect:
          'A glorious challenge, issued after reducing a challenge’s target to 0 hit points or fewer, “does not count against the cavalier’s number of challenges per day”.',
        situational:
          'Only after a target falls; the challenges per day, the number shown, stay the table’s.',
      },
      {
        row: 'pf1/1tfoITY5GhSqbNgy',
        name: 'Knight’s Challenge',
        kind: 'classFeature',
        scopes: mvp,
        effect:
          'From 15th, a knight’s challenge “once per day”, which “functions like a normal challenge” with more bonuses (PRD advancedPlayersGuide/baseClasses/cavalier.html:454).',
        situational:
          'A use with its own limit of one a day, which the text does not add to the challenges per day: the number shown stays the table’s.',
      },
    ],
  },
  {
    record: id.slayersAdvance,
    output: 'classFeat_slayersAdvance',
    amount: { formula: '1 + min(1, floor(@classLevel.slayer / 17))' },
    name: 'Slayer’s Advance',
    rows: own({
      record: id.slayersAdvance,
      scopes: mvp,
      classRow: [
        'pf1/cOY76lMUkupH534m',
        'Slayer',
        'Grants Slayer’s Advance at 13th; one use a day, two from 17th, 1 + min(1, floor(@classLevel.slayer / 17)) (PRD advancedClassGuide/classes/slayer.html:445).',
      ],
      feature: ['pf1/yotHT522pQoKDhID', 'Slayer’s Advance'],
    }),
  },
  {
    record: id.summonMonster,
    output: 'classFeat_summonMonster',
    amount: { formula: 'max(0, 3 + @ability.cha.mod)' },
    name: 'Summon Monster I',
    rows: own({
      record: id.summonMonster,
      scopes: mvp,
      classRow: summoner(
        'Grants Summon Monster I at 1st; the uses a day are 3 + the Charisma modifier (PRD advancedPlayersGuide/baseClasses/summoner.html:418), which the record’s formula clamps at 0, max(0, 3 + @ability.cha.mod).',
      ),
      feature: ['pf1/caNEmbCtoHA7NYtZ', 'Summon Monster'],
    }),
  },
  {
    record: id.bondSenses,
    output: 'classFeat_bondSenses',
    amount: { formula: '@classLevel.summoner' },
    name: 'Bond Senses',
    rows: own({
      record: id.bondSenses,
      scopes: mvp,
      classRow: summoner(
        'Grants Bond Senses at 2nd; the rounds a day are the summoner level, @classLevel.summoner (summoner.html:419).',
      ),
      feature: ['pf1/Aj7SwIo94HfcpR9R', 'Bond Senses'],
    }),
  },
  {
    record: id.makersCall,
    output: 'classFeat_makersCall',
    amount: { formula: 'floor((@classLevel.summoner - 2) / 4)' },
    name: 'Maker’s Call',
    rows: own({
      record: id.makersCall,
      scopes: mvp,
      classRow: summoner(
        'Grants Maker’s Call at 6th; uses a day 1 at 6th, 2 at 10th, 3 at 14th and 4 at 18th, floor((@classLevel.summoner - 2) / 4) (summoner.html:421).',
      ),
      feature: ['pf1/Jw6BEoNMBxfSN4cu', 'Maker’s Call'],
    }),
  },
  {
    record: id.mergeForms,
    output: 'classFeat_mergeForms',
    amount: { formula: '@classLevel.summoner' },
    name: 'Merge Forms',
    rows: own({
      record: id.mergeForms,
      scopes: mvp,
      classRow: summoner(
        'Grants Merge Forms at 16th; the rounds a day are the summoner level, @classLevel.summoner (summoner.html:428).',
      ),
      feature: ['pf1/CW99G919xJkrIWAu', 'Merge Forms'],
    }),
  },
  {
    record: id.arcanePool,
    output: 'classFeat_arcanePool',
    amount: {
      formula: 'max(1, floor(@classLevel.magus / 2)) + @ability.int.mod',
    },
    name: 'Arcane Pool (Magus)',
    rows: [
      ...own({
        record: id.arcanePool,
        scopes: both,
        classRow: [
          'pf1/xZLcyrEKYZoJPS2k',
          'Magus',
          'Grants the arcane pool at 1st; the points are half the magus level rounded down, minimum 1, + the Intelligence modifier, max(1, floor(@classLevel.magus / 2)) + @ability.int.mod (PRD ultimateMagic/spellcasters/magus.html:395), with no clamp of the total: the sheet floors the total after increases at 0.',
        ],
        feature: ['pf1/mpe3JHJMINddqLWr', 'Arcane Pool'],
      }),
      {
        row: 'pf1/ruCZJqrb4ldsojzv',
        name: 'Throwing Magus',
        kind: 'classFeature',
        scopes: mvp,
        effect:
          'Regains a pool point when a thrown weapon enhanced from the pool hits, up to the Intelligence modifier a day.',
        situational:
          'Points restored after a hit; the pool’s size, the number shown, is unchanged.',
      },
    ],
  },
];

/**
 * Bardic Performance's rows (reward-terms-1; ORCH reward-terms-1-boundary.md):
 * its class, its feature, Extra Performance, the Perfect Golden Lute and
 * Song-Bound Curse as fix r1 to r3 reviewed them, which the review of the
 * scopes as they are now finds unchanged.
 */
const bardicPerformanceRows: readonly ListedRow[] = [
  ...own({
    record: id.bardicPerformance,
    scopes: both,
    classRow: [
      'pf1/6GjOjO6r3R06fLwE',
      'Bard',
      'Grants Bardic Performance at 1st; the rounds a day are 4 + the Charisma modifier + 2 for each bard level after 1st, 4 + @ability.cha.mod + 2 * (@classLevel.bard - 1) (PRD coreRulebook/classes/bard.html:411), with no clamp: the sheet floors the total after increases at 0.',
    ],
    feature: ['pf1/ZfCUTi1MiLgR4T7I', 'Bardic Performance'],
  }),
  {
    row: 'pf1/6yGoL82RidBHmXPb',
    name: 'Extra Performance',
    kind: 'feat',
    scopes: both,
    effect:
      '6 more rounds a day per copy, “multiple times. Its effects stack” (pf1 packs/feats/extra-performance.6yGoL82RidBHmXPb.yaml:16-19).',
    boundBy: id.extraPerformance,
  },
  {
    row: 'pf1-content/EwPVzd0GLhBgMo5w',
    name: 'Perfect Golden Lute',
    kind: 'item',
    scopes: mvp,
    effect:
      'A bard “can use bardic performance with the lute for an additional 6 rounds per day”.',
    situational:
      'Only while performing with the lute, an instrument the sheet does not hold per performance.',
  },
  {
    row: 'pf1/CfmIVQOp1oLvtBH2',
    name: 'Song-Bound Curse',
    kind: 'classFeature',
    scopes: mvp,
    effect:
      'Rounds of countersong equal to the oracle level, in addition to other bardic performance rounds.',
    situational:
      'They “can be used only for the countersong bardic performance”, not for the rounds shown.',
  },
];
/**
 * Bardic Performance's entry as the boundary reviewed it until fix r11,
 * without the favored-class reward the second promotion review found
 * (2026-11-21): the Gnome's and Half-Elf's Bardic Performance Round
 * (apg_abilities_race.lst:142, campaign-mvp-v1) adds a round a day each time
 * it is taken. It stays here as the probe that the pin refuses an entry
 * without it.
 */
const bardicPerformanceBeforeFixR11: Entry = {
  record: id.bardicPerformance,
  output: 'classFeat_bardicPerformance',
  amount: { formula: '4 + @ability.cha.mod + 2 * (@classLevel.bard - 1)' },
  name: 'Bardic Performance',
  rows: bardicPerformanceRows,
};
/**
 * Bardic Performance's entry (reward-terms-1): its record's formula reads
 * the reward's count, `@favoredClassReward.bardicPerformanceRound`, the
 * reviewed favored-class reward of that PCGen line, so the reward is one of
 * its rows, bound by the record. The record step checked it and Extra
 * Performance on their promotion review (reward-terms-1 phase 2).
 */
const bardicPerformance: Entry = {
  record: id.bardicPerformance,
  output: 'classFeat_bardicPerformance',
  amount: {
    formula:
      '4 + @ability.cha.mod + 2 * (@classLevel.bard - 1) + @favoredClassReward.bardicPerformanceRound',
  },
  name: 'Bardic Performance',
  rows: [
    ...bardicPerformanceRows,
    {
      row: rewardKey(142),
      name: 'Favored Class Bonus ~ Bardic Performance Round',
      kind: 'favoredClassReward',
      scopes: mvp,
      effect:
        '“Add 1 to the bard’s total number of bardic performance rounds per day.”, for a Gnome or Half-Elf Bard, each time it is taken (STACK:YES MULT:YES).',
      boundBy: id.bardicPerformance,
    },
  ],
};
/** The four domain powers' formula before domain-power-reward-terms (domain-powers-1's). */
const domainPowerFormulaBeforeTerms = '3 + @ability.wis.mod';
/**
 * A domain power's formula since domain-power-reward-terms: the half uses of
 * each reward that changes its key, the Cleric's and for Fire Bolt the
 * Druid's too, added, then rounded down.
 */
const domainPowerFormula = (druidDomain: boolean) =>
  druidDomain
    ? '3 + @ability.wis.mod + floor((@favoredClassReward.clericDomainPowerUse + @favoredClassReward.druidDomainPowerUse) / 2)'
    : '3 + @ability.wis.mod + floor(@favoredClassReward.clericDomainPowerUse / 2)';

/**
 * domain-powers-1 (ORCH domain-powers-1-boundary.md): the entries the four
 * domain powers' maxima would have, each its record's one output, `3 +
 * @ability.wis.mod` uses with no level term, and the catalog rows that give
 * it (the Cleric and the feature; the Inquisitor and Domain (INQ), the
 * inquisitor level as the cleric level, for all four: an Inquisitor may take
 * the Restoration Subdomain "if their deity allows it", PRD
 * advancedPlayersGuide/coreClasses/cleric.html:349, PCGen
 * apg_abilities_class.lst:458; for Fire Bolt the Druid and Nature Bond; the
 * Ecclesitheurge's Vow, situational). Two favored-class rewards of
 * campaign-mvp-v1 add half a use a day of one chosen such power per
 * selection (Cleric Domain Power Use, for a Cleric counted as a Dwarf or a
 * Halfling, all four; Druid Domain Power Use, for a Druid counted as a
 * Half-Elf, Fire Bolt), and no reviewed reward id a formula could read was
 * one of them, so no formula could count them:
 * the four were held, these entries were in no reviewed list, and they stay
 * here, on domain-powers-1's formula, as the probe that the pin refuses them.
 */
const domainPowersBeforeTerms: readonly Entry[] = (
  [
    {
      record: id.fireBolt,
      output: 'classFeat_fireBolt',
      name: 'Fire Bolt',
      feature: 'pf1/V57hEfKt1MroRI91',
      druidDomain: true,
      ecclesitheurgeVow: false,
    },
    {
      record: id.rebukeDeath,
      output: 'classFeat_rebukeDeath',
      name: 'Rebuke Death',
      feature: 'pf1/8iWGEKKdoKTHsDy5',
      druidDomain: false,
      ecclesitheurgeVow: false,
    },
    {
      record: id.touchOfGlory,
      output: 'classFeat_touchOfGlory',
      name: 'Touch of Glory',
      feature: 'pf1/0BFuaPpChxXneJwF',
      druidDomain: false,
      ecclesitheurgeVow: true,
    },
    {
      record: id.restorativeTouch,
      output: 'classFeat_restorativeTouch',
      name: 'Restorative Touch',
      feature: 'pf1/PDiHqRkoHr3AeTUv',
      druidDomain: false,
      ecclesitheurgeVow: true,
    },
  ] as const
).map(({ record, output, name, feature, druidDomain, ecclesitheurgeVow }) => ({
  record,
  output,
  amount: { formula: domainPowerFormulaBeforeTerms },
  name,
  rows: [
    ...own({
      record,
      scopes: both,
      classRow: [
        'pf1/SjFqQceVeVBzBwgn',
        'Cleric',
        'Gives a domain at 1st whose power is used 3 + the Wisdom modifier times a day, 3 + @ability.wis.mod, with no level term and no clamp (PRD coreRulebook/classes/cleric.html:474, 480, 492; advancedPlayersGuide/coreClasses/cleric.html:646): the sheet floors the total after increases at 0.',
      ],
      feature: [feature, name],
    }),
    {
      row: 'pf1/Fv3FbmXptuDRiL5y',
      name: 'Inquisitor',
      kind: 'class',
      scopes: mvp,
      effect:
        'Domain (INQ) at 1st: the same power (for Restorative Touch, the Restoration Subdomain where the deity allows it: PRD advancedPlayersGuide/coreClasses/cleric.html:349; PCGen apg_abilities_class.lst:458), the inquisitor level as the cleric level, which the count does not read.',
      boundBy: record,
    },
    {
      row: 'pf1/dMtxCqoMLtD9nEjU',
      name: 'Domain (INQ)',
      kind: 'classFeature',
      scopes: mvp,
      effect:
        'With cleric levels one domain “must be the same”; levels “stack for the purpose of determining domain powers” (PRD advancedPlayersGuide/baseClasses/inquisitor.html:412): one power, one row, the same count.',
      boundBy: record,
    },
    ...(druidDomain
      ? [
          {
            row: 'pf1/7eZQP0MzeO2svmVF',
            name: 'Druid',
            kind: 'class',
            scopes: mvp,
            effect:
              'Nature Bond at 1st: the Fire Domain among seven, the druid level as the cleric level, which the count does not read.',
            boundBy: record,
          },
          {
            row: 'pf1/wZ40bxNVn95BbLBV',
            name: 'Nature Bond',
            kind: 'classFeature',
            scopes: mvp,
            effect:
              'A cleric domain, Fire among Air, Animal, Earth, Fire, Plant, Water and Weather (PRD coreRulebook/classes/druid.html:395).',
            boundBy: record,
          },
        ]
      : []),
    ...(ecclesitheurgeVow
      ? [
          {
            row: 'everythingpath/cleric-ecclesitheurge-ecclesitheurges-vow',
            name: 'Ecclesitheurge’s Vow',
            kind: 'classFeature',
            scopes: ['campaign-party-v1'] as const,
            effect:
              'In armor or with a shield the ecclesitheurge is “unable … to use cleric domain powers” (PRD advancedClassGuide/classOptions/cleric.html:352).',
            situational:
              'Armor or a shield worn; the uses a day are unchanged.',
          },
        ]
      : []),
  ],
}));

/**
 * domain-power-reward-terms (ORCH domain-power-reward-terms-boundary.md):
 * each domain power's formula reads the count of every reward that changes
 * its key, the Cleric's (`clericDomainPowerUse`) and for Fire Bolt the
 * Druid's (`druidDomainPowerUse`) too, the halves added, then rounded down;
 * so the rewards are rows bound by the record, and the four left the held
 * list; the record step checked them on their promotion review (phase 2).
 */
const domainPowers: readonly Entry[] = domainPowersBeforeTerms.map((entry) => {
  const druidDomain = entry.output === 'classFeat_fireBolt';
  return {
    ...entry,
    amount: { formula: domainPowerFormula(druidDomain) },
    rows: [
      ...entry.rows,
      {
        row: rewardKey(150),
        name: 'Favored Class Bonus ~ Cleric Domain Power Use',
        kind: 'favoredClassReward',
        scopes: mvp,
        effect:
          '“The cleric adds 1/2 to the number of uses per day of that domain power.”, for a Cleric counted as a Dwarf or a Halfling, each time it is taken for this power (STACK:YES MULT:YES): half a use a selection, the halves rounded down.',
        boundBy: entry.record,
      },
      ...(druidDomain
        ? [
            {
              row: rewardKey(168),
              name: 'Favored Class Bonus ~ Druid Domain Power Use',
              kind: 'favoredClassReward',
              scopes: mvp,
              effect:
                '“The druid adds 1/2 to the number of uses per day of that domain power.”, for a Druid counted as a Half-Elf, each time it is taken for this power (STACK:YES MULT:YES): half a use a selection, added to the Cleric reward’s halves, then rounded down.',
              boundBy: entry.record,
            },
          ]
        : []),
    ],
  };
});
const reviewed: readonly Entry[] = [
  ...checkedEntries,
  bardicPerformance,
  ...domainPowers,
];

/**
 * The held list (fix r1): the per-day records the boundary holds because a
 * favored-class reward of a release scope changes their maximum's key and
 * their formula does not count it, each with those rewards. A record is held
 * while it is drafted and listed here; a record a reward changes that is not
 * held must read each such reward in its formula (`rewardFormulaProblems`).
 */
const heldRecords: readonly HeldRecord[] = [
  { record: id.bomb, rewards: [rewardKey(148)] },
  { record: id.stunningFist, rewards: [rewardKey(162)] },
  { record: id.kiPoolUc, rewards: [rewardKey(199)] },
  { record: id.rage, rewards: [rewardKey(213)] },
  { record: id.madDogRage, rewards: [rewardKey(213)] },
];

const pinned = JSON.parse(await readFile(pinFile, 'utf8')) as ScopeKeys;
const reviewedRewards = JSON.parse(
  await readFile(rewardFile, 'utf8'),
) as ReviewedRewards;
const scopes = committedScopes();
const committed = {
  scopes,
  pinned,
  entries: reviewed,
  records: committedRecords,
  rewards: committedRewards,
  reviewedRewards,
  closures: {
    'campaign-mvp-v1': launchClosure,
    'campaign-party-v1': new Set(scopes['campaign-party-v1']),
  },
  comparisons: committedComparisons,
  perDayKeys: committedPerDayKeys,
  held: heldRecords,
};

/** The fields of a check, for records checked in memory only. */
const inMemoryCheck = {
  reviewedBy: 'in-memory check (rule-values-boundary.test.ts)',
  reviewedOn: '2026-11-20',
  receipt: `t3-review-${'0'.repeat(64)}`,
};
const check = ({
  externalKey,
  descriptionSha256,
  outputs,
  rationale,
}: RuleValueRecord): RuleValueRecord => ({
  externalKey,
  descriptionSha256,
  outputs,
  rationale,
  status: 'checked',
  ...inMemoryCheck,
});
const draft = ({
  externalKey,
  descriptionSha256,
  outputs,
  rationale,
}: RuleValueRecord): RuleValueRecord => ({
  externalKey,
  descriptionSha256,
  outputs,
  rationale,
  status: 'drafted',
});
/** The committed records with each one `changes` names by its ID changed in memory. */
const changed = (
  changes: Readonly<
    Record<string, (record: RuleValueRecord) => RuleValueRecord>
  >,
) =>
  pinRecords(
    ruleValues.map((record) => changes[recordId(record)]?.(record) ?? record),
  );
/**
 * maxima-promote-1's records sent to its promotion review, which the record
 * step checked on it (phase 2): the Magus's pool and Extra Arcane Pool (fix
 * r11 held Bardic Performance and Extra Performance, checked on
 * reward-terms-1's review). Checking them again in memory changes nothing as
 * committed.
 */
const forPromotion: readonly string[] = [id.arcanePool, id.extraArcanePool];
const twoChecked = Object.fromEntries(forPromotion.map((key) => [key, check]));

describe('the per-day boundary: a pin on what the release scopes can build (maxima-promote-1 fix r3 to r6)', () => {
  it('pins each scope’s keys sorted, so a re-review reads its difference', () => {
    for (const scope of scopeNames) {
      expect(pinned[scope], scope).toEqual([...pinned[scope]].sort());
    }
  });

  it('agrees with the committed scopes, records and reviewed list', () => {
    expect(boundaryProblems(committed)).toEqual([]);
  });

  it('agrees with them with this slice’s two records checked, as the record step checked them, whose IDs do not move, and fails if a checked one then has no entry', () => {
    const records = changed(twoChecked);
    expect(records.map(({ id }) => id)).toEqual(
      committedRecords.map(({ id }) => id),
    );
    expect(
      records
        .filter(({ id }) => forPromotion.includes(id))
        .map(({ status }) => status),
    ).toEqual(forPromotion.map(() => 'checked'));
    expect(boundaryProblems({ ...committed, records })).toEqual([]);
    expect(
      boundaryProblems({
        ...committed,
        records,
        entries: reviewed.filter(({ record }) => record !== id.arcanePool),
      }),
    ).toEqual([
      `classFeat_arcanePool (formula max(1, floor(@classLevel.magus / 2)) + @ability.int.mod) of ${id.arcanePool}: a checked per-day maximum, once in its record and no entry in the reviewed list. Review the release scopes’ rows against each output and give each its own entry, keyed by the record’s ID, the output’s key and its amount.`,
    ]);
  });

  /**
   * The one problem `keys` in place of the party scope's give, with the
   * scope, each category and its keys and counts: the part each scope probe
   * asserts. The guidance after it is shared, and asserted once (fix r6).
   */
  const partyScopeChange = (keys: readonly string[]) => {
    const problems = boundaryProblems({
      ...committed,
      scopes: { ...scopes, 'campaign-party-v1': keys },
    });
    expect(problems).toHaveLength(1);
    return problems[0] ?? '';
  };
  const counts = (text: string) =>
    `campaign-party-v1 differs from its pinned keys (${pinFile}), each key with its pinned and current count: ${text}.`;
  const repeatNote =
    'A key the scope gives more than once is not the scope that was reviewed: find why the scope repeats it.';
  const added = 'pf1/AAAAAAAAAAAAAAAA';

  it('fails when a scope gains a key, naming the key, its counts and what to review', () => {
    expect(partyScopeChange([...scopes['campaign-party-v1'], added])).toBe(
      `${counts(`added ${added} (pinned 0, now 1); removed none; count changed none`)} Review each added row against every promoted per-day maximum (does it change a daily count unconditionally while taken, worn or active?), record the answer in the reviewed list or hold the maximum, then update the pin.`,
    );
  });

  it('fails when a scope gains a key twice, naming both counts and the repeat', () => {
    const problem = partyScopeChange([
      ...scopes['campaign-party-v1'],
      added,
      added,
    ]);
    const header = counts(
      `added ${added} (pinned 0, now 2); removed none; count changed none`,
    );
    expect(problem.slice(0, header.length)).toBe(header);
    expect(problem).toContain(` ${repeatNote} `);
  });

  it('fails when a scope repeats a key, naming the key, both counts and the repeat', () => {
    const repeated = scopes['campaign-party-v1'][0] ?? '';
    const problem = partyScopeChange([
      ...scopes['campaign-party-v1'],
      repeated,
    ]);
    const header = counts(
      `added none; removed none; count changed ${repeated} (pinned 1, now 2)`,
    );
    expect(problem.slice(0, header.length)).toBe(header);
    expect(problem).toContain(` ${repeatNote} `);
  });

  it('fails when a listed row leaves its scope, naming the row and its maximum', () => {
    const throwingMagus = 'pf1/ruCZJqrb4ldsojzv';
    const without = scopes['campaign-mvp-v1'].filter(
      (key) => key !== throwingMagus,
    );
    const problems = boundaryProblems({
      ...committed,
      scopes: { ...scopes, 'campaign-mvp-v1': without },
      pinned: { ...pinned, 'campaign-mvp-v1': without },
    });
    expect(problems).toEqual([
      `${throwingMagus} (Throwing Magus), listed for Arcane Pool (Magus), is no longer in campaign-mvp-v1: review Arcane Pool (Magus) again and remove or correct the row.`,
    ]);
  });

  it('needs an entry once a maximum is checked, whatever its rationale says, and none while it is drafted', () => {
    const markedForPromotion = (record: RuleValueRecord) => ({
      ...record,
      rationale: `For promotion (maxima-promote-2): ${record.rationale}`,
    });
    expect(
      boundaryProblems({
        ...committed,
        records: changed({ [id.madDogRage]: markedForPromotion }),
      }),
    ).toEqual([]);
    // Checked, and so out of the held list (fix r1), its formula must also
    // read Rage Round, the reward that changes its key.
    expect(
      boundaryProblems({
        ...committed,
        held: heldRecords.filter(({ record }) => record !== id.madDogRage),
        records: changed({
          [id.madDogRage]: (record) => check(markedForPromotion(record)),
        }),
      }),
    ).toEqual([
      `${id.madDogRage}'s classFeat_rage formula does not read @favoredClassReward.rageRound, the count of ${rewardKey(213)} (Favored Class Bonus ~ Rage Round), a favored-class reward of campaign-mvp-v1 that changes it: add the term, or hold the record (drafted and in the held list).`,
      `classFeat_rage (formula 4 + @ability.con.mod + 2 * (@classLevel.barbarian - 4)) of ${id.madDogRage}: a checked per-day maximum, once in its record and no entry in the reviewed list. Review the release scopes’ rows against each output and give each its own entry, keyed by the record’s ID, the output’s key and its amount.`,
    ]);
  });

  it('needs an entry for each per-day maximum output, so a second maximum on a reviewed record has its own', () => {
    const second: RuleValueRecord['outputs'][number] = {
      kind: 'ruleValue',
      ruleValue: {
        key: 'classFeat_arcanePoolSecond',
        kind: 'dailyMaximum',
        amount: { formula: '1' },
        unit: 'rounds',
      },
    };
    const problems = boundaryProblems({
      ...committed,
      records: changed({
        ...twoChecked,
        [id.arcanePool]: (record) =>
          check({ ...record, outputs: [...record.outputs, second] }),
      }),
    });
    expect(problems).toEqual([
      `classFeat_arcanePoolSecond (formula 1) of ${id.arcanePool}: a checked per-day maximum, once in its record and no entry in the reviewed list. Review the release scopes’ rows against each output and give each its own entry, keyed by the record’s ID, the output’s key and its amount.`,
    ]);
  });

  it('fails on a record with two per-day maximum outputs of one key, and each output needs its own entry', () => {
    // The reviewers' probes (round 4): a second Bane maximum worth 999 rounds,
    // and a second maximum of 1 under its record's key, here the Magus's pool
    // (fix r11: Bardic Performance, the reviewers' second probe, was held).
    const second = (
      key: string,
      amount: number,
    ): RuleValueRecord['outputs'][number] => ({
      kind: 'ruleValue',
      ruleValue: {
        key,
        kind: 'dailyMaximum',
        amount,
        unit: 'rounds',
      },
    });
    const withSecond =
      (output: RuleValueRecord['outputs'][number]) =>
      (record: RuleValueRecord) =>
        check({ ...record, outputs: [...record.outputs, output] });
    expect(
      boundaryProblems({
        ...committed,
        records: changed({
          [id.bane]: withSecond(second('classFeat_bane', 999)),
        }),
      }),
    ).toEqual([
      `${id.bane} has 2 per-day maximum outputs keyed classFeat_bane: a record gives at most one per-day maximum per key (no committed record has two), so remove one or give it its own key.`,
      `classFeat_bane (fixed 999) of ${id.bane}: a checked per-day maximum, once in its record and no entry in the reviewed list. Review the release scopes’ rows against each output and give each its own entry, keyed by the record’s ID, the output’s key and its amount.`,
    ]);
    expect(
      boundaryProblems({
        ...committed,
        records: changed({
          ...twoChecked,
          [id.arcanePool]: withSecond(second('classFeat_arcanePool', 1)),
        }),
      }),
    ).toEqual([
      `${id.arcanePool} has 2 per-day maximum outputs keyed classFeat_arcanePool: a record gives at most one per-day maximum per key (no committed record has two), so remove one or give it its own key.`,
      `classFeat_arcanePool (fixed 1) of ${id.arcanePool}: a checked per-day maximum, once in its record and no entry in the reviewed list. Review the release scopes’ rows against each output and give each its own entry, keyed by the record’s ID, the output’s key and its amount.`,
    ]);
    // The same output twice: one entry covers one of them.
    expect(
      boundaryProblems({
        ...committed,
        records: changed({
          [id.bane]: (record) =>
            check({
              ...record,
              outputs: [...record.outputs, ...record.outputs],
            }),
        }),
      }),
    ).toEqual([
      `${id.bane} has 2 per-day maximum outputs keyed classFeat_bane: a record gives at most one per-day maximum per key (no committed record has two), so remove one or give it its own key.`,
      `classFeat_bane (formula @classLevel.inquisitor) of ${id.bane}: a checked per-day maximum, 2 times in its record and 1 entry in the reviewed list. Review the release scopes’ rows against each output and give each its own entry, keyed by the record’s ID, the output’s key and its amount.`,
    ]);
  });

  it('fails when an entry is repeated or names a record or an output that no longer exists', () => {
    const [bane] = reviewed;
    if (!bane) throw new Error('No reviewed entry.');
    const stale = `${id.bane.slice(0, -1)}0`;
    const problems = boundaryProblems({
      ...committed,
      entries: [
        ...reviewed,
        bane,
        { ...bane, record: stale },
        { ...bane, output: 'classFeat_baneGreater' },
        { ...bane, amount: 999 },
      ],
    });
    expect(problems).toEqual([
      `classFeat_bane (formula @classLevel.inquisitor) of ${id.bane}: 2 entries in the reviewed list for once in its record. Keep one entry per output.`,
      `The entry for Bane names ${stale}, which is no committed rule-value record: review the maximum again under its record’s current ID, or remove the entry.`,
      `The entry for Bane names classFeat_baneGreater (formula @classLevel.inquisitor), which is no per-day maximum of ${id.bane}: correct or remove the entry.`,
      `The entry for Bane names classFeat_bane (fixed 999), which is no per-day maximum of ${id.bane}: correct or remove the entry.`,
    ]);
  });

  it('compares amounts as the stored schema types them, so a kind changed with its text kept fails (fix r6)', () => {
    /** The record checked in memory, its per-day maximum's amount set to `amount`. */
    const withAmount =
      (amount: RuleValueAmount) =>
      (record: RuleValueRecord): RuleValueRecord => {
        const set = (
          output: RuleValueRecord['outputs'][number],
        ): RuleValueRecord['outputs'][number] =>
          output.kind === 'ruleValue' &&
          output.ruleValue.kind === 'dailyMaximum'
            ? { ...output, ruleValue: { ...output.ruleValue, amount } }
            : output;
        const [first, ...rest] = record.outputs;
        return check({ ...record, outputs: [set(first), ...rest.map(set)] });
      };
    /** The committed list with the entry for `record` given `amount`, or added with no rows. */
    const entriesWith = (
      record: string,
      output: string,
      amount: RuleValueAmount,
    ): Entry[] =>
      reviewed.some((entry) => entry.record === record)
        ? reviewed.map((entry) =>
            entry.record === record ? { ...entry, amount } : entry,
          )
        : [...reviewed, { record, output, amount, name: output, rows: [] }];
    const probe = ({
      record,
      output,
      entry,
      recordAmount,
    }: {
      record: string;
      output: string;
      entry: RuleValueAmount;
      recordAmount: RuleValueAmount;
    }) =>
      boundaryProblems({
        ...committed,
        entries: entriesWith(record, output, entry),
        records: changed({ [record]: withAmount(recordAmount) }),
      });
    // Rows (Judgment, Challenge): the reviewer's probe, the record's rows
    // rewritten as the formula `rows`, which the sheet's parser rejects.
    expect(
      probe({
        record: id.judgment,
        output: 'classFeat_judgment',
        entry: { rows: {} },
        recordAmount: { formula: 'rows' },
      }),
    ).toEqual([
      `classFeat_judgment (formula rows) of ${id.judgment}: a checked per-day maximum, once in its record and no entry in the reviewed list. Review the release scopes’ rows against each output and give each its own entry, keyed by the record’s ID, the output’s key and its amount.`,
      `The entry for Judgment names classFeat_judgment (rows), which is no per-day maximum of ${id.judgment}: correct or remove the entry.`,
    ]);
    expect(
      probe({
        record: id.judgment,
        output: 'classFeat_judgment',
        entry: { rows: {} },
        recordAmount: { rows: {} },
      }),
    ).toEqual([]);
    // A formula (Bane's, set to one that reads as a number) whose record
    // becomes that fixed number.
    expect(
      probe({
        record: id.bane,
        output: 'classFeat_bane',
        entry: { formula: '1' },
        recordAmount: 1,
      }),
    ).toEqual([
      `classFeat_bane (fixed 1) of ${id.bane}: a checked per-day maximum, once in its record and no entry in the reviewed list. Review the release scopes’ rows against each output and give each its own entry, keyed by the record’s ID, the output’s key and its amount.`,
      `The entry for Bane names classFeat_bane (formula 1), which is no per-day maximum of ${id.bane}: correct or remove the entry.`,
    ]);
    expect(
      probe({
        record: id.bane,
        output: 'classFeat_bane',
        entry: { formula: '1' },
        recordAmount: { formula: '1' },
      }),
    ).toEqual([]);
    // A fixed number (Quivering Palm's 1, checked in memory with an entry of
    // its own) whose record becomes the formula `1`.
    expect(
      probe({
        record: id.quiveringPalm,
        output: 'classFeat_quiveringPalm',
        entry: 1,
        recordAmount: { formula: '1' },
      }),
    ).toEqual([
      `classFeat_quiveringPalm (formula 1) of ${id.quiveringPalm}: a checked per-day maximum, once in its record and no entry in the reviewed list. Review the release scopes’ rows against each output and give each its own entry, keyed by the record’s ID, the output’s key and its amount.`,
      `The entry for classFeat_quiveringPalm names classFeat_quiveringPalm (fixed 1), which is no per-day maximum of ${id.quiveringPalm}: correct or remove the entry.`,
    ]);
    expect(
      probe({
        record: id.quiveringPalm,
        output: 'classFeat_quiveringPalm',
        entry: 1,
        recordAmount: 1,
      }),
    ).toEqual([]);
  });

  it('fails when a row is bound by a record that is drafted while its maximum is checked', () => {
    // The record step checks the Magus's pool and not Extra Arcane Pool, here
    // listed as a row the pool is bound by (in no scope: the feat is in
    // neither, fix r1, so fix r12 also refuses a row listed for no scope).
    const bound: ListedRow = {
      row: 'pf1/3lfNiysSNv1ahV4F',
      name: 'Extra Arcane Pool',
      kind: 'feat',
      scopes: [],
      effect: '2 more points per copy.',
      boundBy: id.extraArcanePool,
    };
    const problems = boundaryProblems({
      ...committed,
      entries: reviewed.map((entry) =>
        entry.record === id.arcanePool
          ? { ...entry, rows: [...entry.rows, bound] }
          : entry,
      ),
      records: changed({
        [id.arcanePool]: check,
        [id.extraArcanePool]: draft,
      }),
    });
    expect(problems).toEqual([
      'pf1/3lfNiysSNv1ahV4F (Extra Arcane Pool), listed for Arcane Pool (Magus), is listed for no scope: name the scopes it is in, or remove it.',
      `pf1/3lfNiysSNv1ahV4F (Extra Arcane Pool) is bound by ${id.extraArcanePool}, which is drafted, while Arcane Pool (Magus) is checked: check the record with the maximum, correct the binding, or hold the maximum.`,
    ]);
  });
});

/** campaign-mvp-v1's file and its records as `JSON.parse` gives them, for the edits below. */
type StoredLaunchFile = {
  value: Record<string, unknown> & {
    semanticContracts: readonly unknown[];
    rows: readonly unknown[];
  };
};
const launchFile = JSON.parse(
  await readFile('scripts/catalog/scopes/campaign-mvp-v1.json', 'utf8'),
) as StoredLaunchFile;
const launchRecords = (
  JSON.parse(
    await readFile(
      'scripts/catalog/scopes/campaign-mvp-v1.records.json',
      'utf8',
    ),
  ) as { records: Readonly<Record<string, Record<string, unknown>>> }
).records;

describe('the per-day boundary’s favored-class rewards (maxima-promote-1 fix r11; as the scope reader yields them, fix r15)', () => {
  const bardicPerformanceRound = rewardKey(142);
  const rageRound = rewardKey(213);
  const kiReward = rewardKey(199);
  const clericDomainPowerUse = rewardKey(150);
  const druidDomainPowerUse = rewardKey(168);
  const domainPowerKeys = [
    'classFeat_fireBolt',
    'classFeat_rebukeDeath',
    'classFeat_restorativeTouch',
    'classFeat_touchOfGlory',
  ];
  const witchSpell = rewardKey(241);
  const launchRewards = committedRewards['campaign-mvp-v1'];
  const refusal = `${bardicPerformanceRound} (Favored Class Bonus ~ Bardic Performance Round), a favored-class reward of campaign-mvp-v1, changes classFeat_bardicPerformance, Bardic Performance’s count, for every character who takes it, and is not one of its rows listed for campaign-mvp-v1 and bound by a record: bind it by a record (a reward that changes a count is not situational), or hold the maximum and remove its entry.`;
  /** The problem for a scope whose rewards are now `rewards`. */
  const digestChanged = (scope: ScopeName, rewards: ScopeRewardsRead) =>
    `${scope}’s favored-class reward contracts and the rows that refer to them, as its scope reader yields them, differ from the ones reviewed (${rewardFile}): digest now ${rewardsDigest(rewards)}, reviewed ${reviewedRewards[scope].digest}. Find each changed reward in the scope file, review who may take that reward, what it does and the per-day keys it changes again, correct its entry and record the new digest.`;
  const removed = (key: string, name: string, changes: string) =>
    `${key} (${name}) is in campaign-mvp-v1’s reviewed list (${rewardFile}) but its scope reader yields no favored-class reward of that ID: review the maxima whose keys it changed (${changes}) and remove it.`;
  const unreviewed = (scope: ScopeName, key: string, name: string) =>
    `${key} (${name}), a favored-class reward ${scope}’s scope reader yields, is not in its reviewed list (${rewardFile}): review its text against every per-day maximum (does it change a daily count for every character who takes it?), record the keys it changes, or none, then add it.`;
  const counted = (contracts: number, rows: number) =>
    `${kiReward} (Favored Class Bonus ~ Ki), in campaign-mvp-v1’s reviewed list (${rewardFile}), has ${contracts} ${contracts === 1 ? 'contract' : 'contracts'} and ${rows} ${rows === 1 ? 'row' : 'rows'} as its scope reader yields them: a reviewed reward has exactly one of each. Find why the scope gives it so, review the maxima whose keys it changes (classFeat_kiPool, classFeat_kiPoolUc) again, then correct the file or the entry.`;

  type ListName = 'semanticContracts' | 'rows';
  /** campaign-mvp-v1's file with its list `name` changed by `change`. */
  const withList = (
    file: StoredLaunchFile,
    name: ListName,
    change: (elements: readonly unknown[]) => readonly unknown[],
  ): StoredLaunchFile => ({
    ...file,
    value: { ...file.value, [name]: change(file.value[name]) },
  });
  /**
   * The position of reward `key`'s element in list `name`: the reader yields
   * one element for each stored one, in order, so the yielded list gives it.
   */
  const positionOf = (name: ListName, key: string) => {
    const at = launchScope.manifest[name].findIndex(
      (element) => rewardIdOf(element) === key,
    );
    if (at < 0) throw new Error(`No ${name} element of ${key}.`);
    return at;
  };
  /** campaign-mvp-v1's file with reward `key`'s element of `name` replaced by `element`. */
  const replacing = (name: ListName, key: string, element: unknown) =>
    withList(launchFile, name, (elements) =>
      elements.map((each, at) =>
        at === positionOf(name, key) ? element : each,
      ),
    );
  /** Reward `key`'s contract as the reader yields it. */
  const yieldedContract = (key: string) => {
    const contract = launchScope.manifest.semanticContracts.find(
      ({ id: given }) => given === key,
    );
    if (!contract) throw new Error(`No contract ${key}.`);
    return contract;
  };
  /**
   * A stored element's record: the record its reference (or its view's)
   * names, or the element itself when it is stored inline, as a row only the
   * manifest holds is since the notice authority stopped sharing its rows
   * (pbl-notice-rows).
   */
  const storedRecord = (element: unknown) => {
    const inline = inlineRow(element);
    if (inline) return inline;
    const reference = (value: unknown) =>
      value !== null &&
      typeof value === 'object' &&
      '$r' in value &&
      typeof value.$r === 'string'
        ? value.$r
        : undefined;
    const view =
      element !== null && typeof element === 'object' && 'value' in element
        ? element.value
        : undefined;
    const key = reference(element) ?? reference(view);
    const record = key === undefined ? undefined : launchRecords[key];
    if (!record) throw new Error('No stored record.');
    return record;
  };
  /**
   * The problems once campaign-mvp-v1's file is `file`, as the import reads a
   * supplied copy (`resolveReleaseScope`, compared with the committed
   * identity), with its rewards, closure and import keys, and the party
   * scope's rewards `party`.
   */
  const problemsWith = (
    file: StoredLaunchFile,
    party = committedRewards['campaign-party-v1'],
  ) => {
    const scope = resolveReleaseScope({
      version: 'campaign-mvp-v1',
      document: {
        manifest: file,
        documentSha256: 'an edited copy',
        recordsSha256: launchInventoryRecordsBinding(file),
      },
      committedIdentity: launchScope.binding.launchScopeIdentity,
    });
    const rewards = launchRewardsOf(scope);
    return {
      rewards,
      problems: boundaryProblems({
        ...committed,
        scopes: { ...committed.scopes, 'campaign-mvp-v1': scope.importKeys },
        rewards: { 'campaign-mvp-v1': rewards, 'campaign-party-v1': party },
        closures: {
          ...committed.closures,
          'campaign-mvp-v1': new Set(scope.closure),
        },
      }),
    };
  };
  /** Each edited read resolves the whole launch scope (seconds). */
  const read = { timeout: 120_000 };

  it('reads 64 rewards from campaign-mvp-v1’s reader, each one contract and one row, with no finding, and none from the party scope’s; seven change a per-day key, of the reviewed maxima’s Bardic Performance’s (reward-terms-1) and the four domain powers’ (domain-power-reward-terms), none the Magus’s pool’s or the nine checked maxima’s', () => {
    expect(launchRewards.contracts).toHaveLength(64);
    expect(launchRewards.rows).toHaveLength(64);
    const contractIds = launchRewards.contracts.map(rewardIdOf);
    expect(launchRewards.rows.map(rewardIdOf).sort()).toEqual(
      [...contractIds].sort(),
    );
    expect(contractIds.every((key) => key.startsWith(rewardKeyPrefix))).toBe(
      true,
    );
    expect(launchScope.findings).toEqual([]);
    expect(committedRewards['campaign-party-v1']).toEqual({
      contracts: [],
      rows: [],
      findings: [],
    });
    expect(boundaryProblems(committed)).toEqual([]);
    const changing = scopeNames.flatMap((scope) =>
      reviewedRewards[scope].rewards
        .filter(({ changes }) => changes.length)
        .map(({ key, changes }) => [key, changes] as const),
    );
    expect(changing).toEqual([
      [bardicPerformanceRound, ['classFeat_bardicPerformance']],
      [rewardKey(148), ['classFeat_bomb']],
      [clericDomainPowerUse, domainPowerKeys],
      [rewardKey(162), ['classFeat_stunningFist']],
      [druidDomainPowerUse, ['classFeat_fireBolt']],
      [kiReward, ['classFeat_kiPool', 'classFeat_kiPoolUc']],
      [rageRound, ['classFeat_rage']],
    ]);
    const entryKeys = reviewed.map(({ output }) => output);
    expect(entryKeys).toContain('classFeat_arcanePool');
    // reward-terms-1: Bardic Performance's key, whose formula reads its
    // reward; domain-power-reward-terms: the four domain powers' keys,
    // whose formulas read the Cleric's reward and, for Fire Bolt, the
    // Druid's too.
    expect(
      changing.filter(([, changes]) =>
        changes.some((output) => entryKeys.includes(output)),
      ),
    ).toEqual([
      [bardicPerformanceRound, ['classFeat_bardicPerformance']],
      [clericDomainPowerUse, domainPowerKeys],
      [druidDomainPowerUse, ['classFeat_fireBolt']],
    ]);
    // The ARG's options are comparison evidence only: 137 remainders, no key.
    expect(committedComparisons).toHaveLength(137);
  });
  /** Bardic Performance's record with its formula before reward-terms-1, without the reward's term. */
  const withoutTerm = (record: RuleValueRecord): RuleValueRecord => {
    const without = (
      output: RuleValueRecord['outputs'][number],
    ): RuleValueRecord['outputs'][number] =>
      output.ruleValue.kind === 'dailyMaximum'
        ? {
            ...output,
            ruleValue: {
              ...output.ruleValue,
              amount: bardicPerformanceBeforeFixR11.amount,
            },
          }
        : output;
    const [first, ...rest] = record.outputs;
    return { ...record, outputs: [without(first), ...rest.map(without)] };
  };
  /** The held list with Bardic Performance held again for the reward, as before reward-terms-1. */
  const bardicPerformanceHeld = [
    ...heldRecords,
    { record: id.bardicPerformance, rewards: [bardicPerformanceRound] },
  ];
  const termUnread = `${id.bardicPerformance}'s classFeat_bardicPerformance formula does not read @favoredClassReward.bardicPerformanceRound, the count of ${bardicPerformanceRound} (Favored Class Bonus ~ Bardic Performance Round), a favored-class reward of campaign-mvp-v1 that changes it: add the term, or hold the record (drafted and in the held list).`;

  it('refuses Bardic Performance’s entry as reviewed before fix r11, on its record as it was and held: the Gnome’s and Half-Elf’s reward changes its count and is not one of its rows', () => {
    expect(
      boundaryProblems({
        ...committed,
        held: bardicPerformanceHeld,
        entries: [
          ...checkedEntries,
          bardicPerformanceBeforeFixR11,
          ...domainPowers,
        ],
        // Drafted, as it was before reward-terms-1's review checked it.
        records: changed({
          [id.bardicPerformance]: (record) => draft(withoutTerm(record)),
        }),
      }),
    ).toEqual([refusal]);
  });

  it('lets Bardic Performance out of the held list because its formula reads the reward (reward-terms-1); with the term removed (g) refuses it, checked or drafted, until it is drafted and held again', () => {
    expect(boundaryProblems(committed)).toEqual([]);
    expect(heldRecords.map(({ record }) => record)).not.toContain(
      id.bardicPerformance,
    );
    // Phase 2: the record step checked both; drafted again in memory, the same.
    expect(
      committed.records
        .filter(
          ({ id: record }) =>
            record === id.bardicPerformance || record === id.extraPerformance,
        )
        .map(({ status }) => status),
    ).toEqual(['checked', 'checked']);
    expect(
      boundaryProblems({
        ...committed,
        records: changed({
          [id.bardicPerformance]: draft,
          [id.extraPerformance]: draft,
        }),
      }),
    ).toEqual([]);
    const entries = [
      ...checkedEntries,
      { ...bardicPerformance, amount: bardicPerformanceBeforeFixR11.amount },
      ...domainPowers,
    ];
    expect(
      boundaryProblems({
        ...committed,
        entries,
        records: changed({ [id.bardicPerformance]: withoutTerm }),
      }),
    ).toEqual([termUnread]);
    const drafted = changed({
      [id.bardicPerformance]: (record) => draft(withoutTerm(record)),
    });
    expect(
      boundaryProblems({ ...committed, entries, records: drafted }),
    ).toEqual([termUnread]);
    expect(
      boundaryProblems({
        ...committed,
        entries,
        records: drafted,
        held: bardicPerformanceHeld,
      }),
    ).toEqual([]);
  });

  /** Bardic Performance's entry with its reward row changed by `change`. */
  const withRewardRow = (change: (row: ListedRow) => ListedRow) => [
    ...checkedEntries,
    {
      ...bardicPerformance,
      rows: bardicPerformance.rows.map((row) =>
        row.row === bardicPerformanceRound ? change(row) : row,
      ),
    },
    ...domainPowers,
  ];

  it('refuses a bound reward whose reviewed reward counts for other races or classes than the review reads it as admitting (reward-terms-1)', () => {
    const halfOrc = {
      ...reviewedRewards,
      'campaign-mvp-v1': {
        ...reviewedRewards['campaign-mvp-v1'],
        rewards: reviewedRewards['campaign-mvp-v1'].rewards.map((reward) =>
          reward.key === bardicPerformanceRound
            ? { ...reward, eligible: [...reward.eligible, 'Half-Orc Bard'] }
            : reward,
        ),
      },
    };
    expect(
      boundaryProblems({ ...committed, reviewedRewards: halfOrc }),
    ).toEqual([
      `${bardicPerformanceRound} (Favored Class Bonus ~ Bardic Performance Round), listed for Bardic Performance, is counted as bardicPerformanceRound, which counts for Gnome Bard, Half-Elf Bard, while the review reads the reward as admitting Gnome Bard, Half-Elf Bard, Half-Orc Bard: correct the reviewed favored-class reward list or the review.`,
    ]);
  });

  it('refuses a reward of a scope listed as a row of another kind (reward-terms-1)', () => {
    expect(
      boundaryProblems({
        ...committed,
        entries: withRewardRow((row) => ({ ...row, kind: 'feat' })),
      }),
    ).toEqual([
      `${bardicPerformanceRound} (Favored Class Bonus ~ Bardic Performance Round), listed for Bardic Performance, is a favored-class reward of campaign-mvp-v1 listed as a row of kind feat: list it as kind favoredClassReward.`,
    ]);
  });

  const domainPowerIds = domainPowers.map(({ record }) => record);
  /** A domain power's record on domain-powers-1's formula, without the rewards' terms. */
  const withoutTerms = (record: RuleValueRecord): RuleValueRecord => {
    const without = (
      output: RuleValueRecord['outputs'][number],
    ): RuleValueRecord['outputs'][number] =>
      output.ruleValue.kind === 'dailyMaximum'
        ? {
            ...output,
            ruleValue: {
              ...output.ruleValue,
              amount: { formula: domainPowerFormulaBeforeTerms },
            },
          }
        : output;
    const [first, ...rest] = record.outputs;
    return { ...record, outputs: [without(first), ...rest.map(without)] };
  };
  /** The four records as domain-powers-1 committed them: drafted, without the terms. */
  const beforeTerms = changed(
    Object.fromEntries(
      domainPowerIds.map((key) => [
        key,
        (record: RuleValueRecord) => draft(withoutTerms(record)),
      ]),
    ),
  );
  /** The held list as domain-powers-1 had it: the four held for their rewards. */
  const domainPowersHeld = [
    ...heldRecords,
    {
      record: id.fireBolt,
      rewards: [clericDomainPowerUse, druidDomainPowerUse],
    },
    { record: id.rebukeDeath, rewards: [clericDomainPowerUse] },
    { record: id.touchOfGlory, rewards: [clericDomainPowerUse] },
    { record: id.restorativeTouch, rewards: [clericDomainPowerUse] },
  ];
  const cleric = [
    clericDomainPowerUse,
    'Cleric Domain Power Use',
    'clericDomainPowerUse',
  ] as const;
  const druid = [
    druidDomainPowerUse,
    'Druid Domain Power Use',
    'druidDomainPowerUse',
  ] as const;
  /** (g)'s problem for a domain power's formula that does not read a reward. */
  const unread = (
    [record, output]: readonly [string, string],
    [reward, name, rewardId]: readonly [string, string, string],
  ) =>
    `${record}'s ${output} formula does not read @favoredClassReward.${rewardId}, the count of ${reward} (Favored Class Bonus ~ ${name}), a favored-class reward of campaign-mvp-v1 that changes it: add the term, or hold the record (drafted and in the held list).`;

  it('refuses the four domain powers’ entries as domain-powers-1 reviewed them (held, on its formula, without the rewards): the Cleric reward changes each count and the Druid reward Fire Bolt’s, and neither is one of their rows', () => {
    const domainRefusal = (
      [key, reward]: readonly [string, string, string],
      output: string,
      name: string,
    ) =>
      `${key} (Favored Class Bonus ~ ${reward}), a favored-class reward of campaign-mvp-v1, changes ${output}, ${name}’s count, for every character who takes it, and is not one of its rows listed for campaign-mvp-v1 and bound by a record: bind it by a record (a reward that changes a count is not situational), or hold the maximum and remove its entry.`;
    expect(
      boundaryProblems({
        ...committed,
        held: domainPowersHeld,
        records: beforeTerms,
        entries: [
          ...checkedEntries,
          bardicPerformance,
          ...domainPowersBeforeTerms,
        ],
      }),
    ).toEqual([
      domainRefusal(cleric, 'classFeat_fireBolt', 'Fire Bolt'),
      domainRefusal(druid, 'classFeat_fireBolt', 'Fire Bolt'),
      domainRefusal(cleric, 'classFeat_rebukeDeath', 'Rebuke Death'),
      domainRefusal(cleric, 'classFeat_touchOfGlory', 'Touch of Glory'),
      domainRefusal(cleric, 'classFeat_restorativeTouch', 'Restorative Touch'),
    ]);
  });

  it('lets the four domain powers out of the held list because each formula reads every reward that changes its key (domain-power-reward-terms); the rewards are rows bound by their records, and the record step checked the four (phase 2)', () => {
    expect(boundaryProblems(committed)).toEqual([]);
    const held = heldRecords.map(({ record }) => record);
    for (const record of domainPowerIds) expect(held).not.toContain(record);
    expect(
      committed.records
        .filter(({ id: record }) => domainPowerIds.includes(record))
        .map(({ id: record, status, maxima }) => [record, status, maxima])
        .sort(),
    ).toEqual(
      domainPowers
        .map(({ record, output, amount }) => [
          record,
          'checked',
          [{ output, amount }],
        ])
        .sort(),
    );
    // Drafted again in memory, as they were for their promotion review: the
    // same.
    expect(
      boundaryProblems({
        ...committed,
        records: changed(
          Object.fromEntries(domainPowerIds.map((key) => [key, draft])),
        ),
      }),
    ).toEqual([]);
  });

  it('refuses a binding the formula ignores (fix r1, the Spec review’s case; domain-power-reward-terms): the rewards listed as rows bound by the records, the four out of the held list or checked, (g) fails for each term removed', () => {
    /** The entries with the rewards bound, on domain-powers-1's formula. */
    const declared = domainPowers.map((entry) => ({
      ...entry,
      amount: { formula: domainPowerFormulaBeforeTerms },
    }));
    const entries = [...checkedEntries, bardicPerformance, ...declared];
    const expected = [
      unread([id.touchOfGlory, 'classFeat_touchOfGlory'], cleric),
      unread([id.rebukeDeath, 'classFeat_rebukeDeath'], cleric),
      unread([id.restorativeTouch, 'classFeat_restorativeTouch'], cleric),
      unread([id.fireBolt, 'classFeat_fireBolt'], cleric),
      unread([id.fireBolt, 'classFeat_fireBolt'], druid),
    ];
    // Held (drafted and in the held list), the declared rows pass: the
    // formula is not read while the maximum is not shown.
    expect(
      boundaryProblems({
        ...committed,
        held: domainPowersHeld,
        records: beforeTerms,
        entries,
      }),
    ).toEqual([]);
    // Out of the held list, drafted or (as committed) checked, the same rows
    // are refused: the formulas do not read the rewards.
    expect(
      boundaryProblems({ ...committed, records: beforeTerms, entries }),
    ).toEqual(expected);
    expect(
      boundaryProblems({
        ...committed,
        records: changed(
          Object.fromEntries(
            domainPowerIds.map((key) => [
              key,
              (record: RuleValueRecord) => check(withoutTerms(record)),
            ]),
          ),
        ),
        entries,
      }),
    ).toEqual(expected);
    // One term removed: Fire Bolt without the Druid reward's, Touch of
    // Glory without the Cleric reward's; each is refused for that term only.
    const onlyCleric =
      '3 + @ability.wis.mod + floor(@favoredClassReward.clericDomainPowerUse / 2)';
    const formulaOf =
      (formula: string) =>
      (record: RuleValueRecord): RuleValueRecord => {
        const [first, ...rest] = record.outputs;
        return {
          ...record,
          outputs: [
            {
              ...first,
              ruleValue: { ...first.ruleValue, amount: { formula } },
            },
            ...rest,
          ],
        };
      };
    expect(
      boundaryProblems({
        ...committed,
        records: changed({
          [id.fireBolt]: formulaOf(onlyCleric),
          [id.touchOfGlory]: formulaOf(domainPowerFormulaBeforeTerms),
        }),
        entries: [
          ...checkedEntries,
          bardicPerformance,
          ...domainPowers.map((entry) =>
            entry.record === id.fireBolt
              ? { ...entry, amount: { formula: onlyCleric } }
              : entry.record === id.touchOfGlory
                ? {
                    ...entry,
                    amount: { formula: domainPowerFormulaBeforeTerms },
                  }
                : entry,
          ),
        ],
      }),
    ).toEqual([
      unread([id.touchOfGlory, 'classFeat_touchOfGlory'], cleric),
      unread([id.fireBolt, 'classFeat_fireBolt'], druid),
    ]);
  });

  it('passes a record out of the held list whose formula reads each reward that changes its key (fix r1): Rage with @favoredClassReward.rageRound; the arithmetic with the term is the promotion review’s, not the guard’s', () => {
    /** The record with `variable` added to its maximum's formula. */
    const reads =
      (variable: string) =>
      (record: RuleValueRecord): RuleValueRecord => {
        const [first, ...rest] = record.outputs;
        return {
          ...record,
          outputs: [
            first.ruleValue.kind === 'dailyMaximum' &&
            typeof first.ruleValue.amount === 'object' &&
            'formula' in first.ruleValue.amount
              ? {
                  ...first,
                  ruleValue: {
                    ...first.ruleValue,
                    amount: {
                      formula: `${first.ruleValue.amount.formula} + ${variable}`,
                    },
                  },
                }
              : first,
            ...rest,
          ],
        };
      };
    const held = heldRecords.filter(({ record }) => record !== id.rage);
    expect(
      boundaryProblems({
        ...committed,
        held,
        records: changed({
          [id.rage]: reads('@favoredClassReward.rageRound'),
        }),
      }),
    ).toEqual([]);
    const unread = `${id.rage}'s classFeat_rage formula does not read @favoredClassReward.rageRound, the count of ${rewardKey(213)} (Favored Class Bonus ~ Rage Round), a favored-class reward of campaign-mvp-v1 that changes it: add the term, or hold the record (drafted and in the held list).`;
    expect(boundaryProblems({ ...committed, held })).toEqual([unread]);
    // Fix r2 (both reviews): the whole variable must be the reward's, as the
    // sheet's tokenizer reads it (`@` and a name of letters, digits, `_` and
    // `.`): a longer name or a shorter one is another variable, which the
    // sheet does not resolve.
    for (const variable of [
      '@favoredClassReward.rageRounds',
      '@favoredClassReward.rageRound.extra',
      '@favoredClassReward.rageRoun',
    ])
      expect(
        boundaryProblems({
          ...committed,
          held,
          records: changed({ [id.rage]: reads(variable) }),
        }),
        variable,
      ).toEqual([unread]);
    // Fix r3 (both reviews): a formula the sheet's parser rejects reads no
    // variable, whatever names it holds: a typographic minus before the
    // reward, a pasted division sign inside floor(...).
    const rageFormula =
      (rest: string) =>
      (record: RuleValueRecord): RuleValueRecord => {
        const [first, ...others] = record.outputs;
        return {
          ...record,
          outputs: [
            {
              ...first,
              ruleValue: {
                ...first.ruleValue,
                amount: {
                  formula: `4 + @ability.con.mod + 2 * (@classLevel.barbarian ${rest}`,
                },
              },
            },
            ...others,
          ],
        };
      };
    for (const rest of [
      '− 1) + @favoredClassReward.rageRound',
      '- 1) + floor(@favoredClassReward.rageRound ÷ 2)',
    ])
      expect(
        boundaryProblems({
          ...committed,
          held,
          records: changed({ [id.rage]: rageFormula(rest) }),
        }),
        rest,
      ).toEqual([
        `${id.rage}'s classFeat_rage formula does not parse (Use only integers, arithmetic, floor, ceil, min, max and supported variables.), so it reads no variable: correct it, or hold the record (drafted and in the held list).`,
      ]);
  });

  it('parses a non-held formula once, before the reviewed-id lookup (fix r4): Fire Bolt, out of the held list, with a typographic minus gets one problem, that it does not parse, not one missing-term problem per reward', () => {
    const typographicMinus = (record: RuleValueRecord): RuleValueRecord => {
      const [first, ...rest] = record.outputs;
      return {
        ...record,
        outputs: [
          {
            ...first,
            ruleValue: {
              ...first.ruleValue,
              amount: { formula: '3 + @ability.wis.mod − 1' },
            },
          },
          ...rest,
        ],
      };
    };
    expect(
      boundaryProblems({
        ...committed,
        records: changed({
          [id.fireBolt]: (record) => draft(typographicMinus(record)),
        }),
        // Drafted, as before its promotion: its entry, on the committed
        // formula, would name no maximum, so it is left out.
        entries: reviewed.filter(({ record }) => record !== id.fireBolt),
      }),
    ).toEqual([
      `${id.fireBolt}'s classFeat_fireBolt formula does not parse (Use only integers, arithmetic, floor, ceil, min, max and supported variables.), so it reads no variable: correct it, or hold the record (drafted and in the held list).`,
    ]);
  });

  it('fails when a reward’s marking is removed from the reviewed list (fix r1): the records held for it name it, so the reading is reviewed before they leave the held list', () => {
    // Rage Round, for which Rage and the Mad Dog's Rage are held (Fire
    // Bolt was the case until domain-power-reward-terms took it out of the
    // held list).
    const reviewedLaunch = reviewedRewards['campaign-mvp-v1'];
    const held = (record: string) =>
      `${record} is held for ${rageRound}, which the reviewed list (${rewardFile}) does not mark as changing classFeat_rage: review that reward's reading again, then correct the list or the held entry.`;
    expect(
      boundaryProblems({
        ...committed,
        reviewedRewards: {
          ...reviewedRewards,
          'campaign-mvp-v1': {
            ...reviewedLaunch,
            rewards: reviewedLaunch.rewards.map((each) =>
              each.key === rageRound ? { ...each, changes: [] } : each,
            ),
          },
        },
      }),
    ).toEqual([held(id.rage), held(id.madDogRage)]);
  });

  it.each([
    [
      'a second DESC giving another accumulation (round 12’s spec review)',
      () => {
        const contract = yieldedContract(rageRound);
        return replacing('semanticContracts', rageRound, {
          ...contract,
          parameters: contract.parameters.map((parameter, index) =>
            index === 0
              ? {
                  ...parameter,
                  values: [
                    ...parameter.values,
                    'DESC:Add 2 to the barbarian’s total number of rage rounds per day.',
                  ],
                }
              : parameter,
          ),
        });
      },
    ],
    [
      // Both requirements a Bloodrager must meet (round 12's spec review),
      // in both forms the contract gives them (round 13's): the native PCGen
      // requirements and the parsed prerequisites.
      'a field changed: the Rage Round also open to a Bloodrager, in its native requirements and its parsed prerequisites',
      () => {
        const contract = yieldedContract(rageRound);
        return replacing('semanticContracts', rageRound, {
          ...contract,
          nativeRequirements: [
            'PREABILITY:1,CATEGORY=Special Ability,Barbarian,Bloodrager',
            'PRECLASS:1,Barbarian=1,Bloodrager=1',
            'PREFACT:1,TEMPLATES,IsDwarf=true,IsHalfOrc=true',
          ],
          prerequisites: contract.prerequisites.map((prerequisite) =>
            prerequisite.kind === 'PREABILITY'
              ? {
                  ...prerequisite,
                  items: [...prerequisite.items, 'Bloodrager'],
                }
              : prerequisite.kind === 'PRECLASS'
                ? {
                    ...prerequisite,
                    items: [...prerequisite.items, 'Bloodrager=1'],
                  }
                : prerequisite,
          ),
        });
      },
    ],
  ] as const)(
    'fails on a reward’s contract yielded different, its name kept: %s',
    (...[, file]) => {
      const { rewards, problems } = problemsWith(file());
      expect(problems).toEqual([digestChanged('campaign-mvp-v1', rewards)]);
    },
    read.timeout,
  );

  it.each([
    [
      'plain, a copy of its stored element',
      () => {
        const at = positionOf('rows', kiReward);
        return withList(launchFile, 'rows', (rows) => [...rows, rows[at]]);
      },
      kiReward,
      'Favored Class Bonus ~ Ki',
      'classFeat_kiPool, classFeat_kiPoolUc',
    ],
    [
      // Round 14's spec review: the reader expands nested views.
      'as a nested view of its record',
      () =>
        withList(launchFile, 'rows', (rows) => [
          ...rows,
          {
            $inventoryView: 'row-core',
            value: { $inventoryView: 'contract', value: { $r: 'P3spFkxs2gQ' } },
          },
        ]),
      rageRound,
      'Favored Class Bonus ~ Rage Round',
      'classFeat_rage',
    ],
    [
      // Round 14's spec review: the row schema trims the key.
      'inline, with a trailing space on its key',
      () => {
        const record = storedRecord(
          launchFile.value.rows[positionOf('rows', witchSpell)],
        );
        expect(record.key).toBe(witchSpell);
        return withList(launchFile, 'rows', (rows) => [
          ...rows,
          { ...record, key: `${witchSpell} ` },
        ]);
      },
      witchSpell,
      'Favored Class Bonus ~ Witch Spell',
      'none',
    ],
  ] as const)(
    'fails on a reward’s row repeated %s, by the list’s length and the reader’s finding',
    (...[, file, key, name, changes]) => {
      const { rewards, problems } = problemsWith(file());
      expect(rewards.rows).toHaveLength(65);
      expect(rewards.rows.filter((row) => row.key === key)).toHaveLength(2);
      expect(problems).toEqual([
        digestChanged('campaign-mvp-v1', rewards),
        `campaign-mvp-v1’s scope reader gives the finding duplicate-key on ${key}, a favored-class reward: Duplicate manifest row key. Correct the scope file, then review that reward again.`,
        `${key} (${name}), in campaign-mvp-v1’s reviewed list (${rewardFile}), has 1 contract and 2 rows as its scope reader yields them: a reviewed reward has exactly one of each. Find why the scope gives it so, review the maxima whose keys it changes (${changes}) again, then correct the file or the entry.`,
      ]);
    },
    read.timeout,
  );

  it(
    'fails on a reward’s contract repeated, by the list’s length',
    () => {
      const at = positionOf('semanticContracts', kiReward);
      const { rewards, problems } = problemsWith(
        withList(launchFile, 'semanticContracts', (contracts) => [
          ...contracts,
          contracts[at],
        ]),
      );
      expect(rewards.contracts).toHaveLength(65);
      expect(problems).toEqual([
        digestChanged('campaign-mvp-v1', rewards),
        counted(2, 1),
      ]);
    },
    read.timeout,
  );

  it(
    'fails when a reward is added to campaign-mvp-v1, and when one leaves it for the party scope, naming each',
    () => {
      const [first] = reviewedRewards['campaign-mvp-v1'].rewards;
      if (!first) throw new Error('No rewards.');
      const added = rewardKey(999);
      const addedName = 'Favored Class Bonus ~ Arcane Pool';
      const contract = yieldedContract(first.key);
      const row = launchScope.manifest.rows[positionOf('rows', first.key)];
      // Rage Round's contract and row out of the launch file, a copy of the
      // first reward under a new ID and name in.
      const launchEdited = (
        [
          ['semanticContracts', { ...contract, id: added, name: addedName }],
          ['rows', { ...row, key: added, name: addedName }],
        ] as const
      ).reduce(
        (file, [name, copy]) =>
          withList(file, name, (elements) => [
            ...elements.filter((_, at) => at !== positionOf(name, rageRound)),
            copy,
          ]),
        launchFile,
      );
      // Rage Round's row in the party scope's document, written by its encoder.
      const partyText = serializePartyScope(
        encodePartyScope({
          ...partyScope.scope,
          rows: [
            ...partyScope.scope.rows,
            {
              key: rageRound,
              kind: 'rule',
              name: 'Favored Class Bonus ~ Rage Round',
              characters: partyScope.scope.characters,
            },
          ],
        }),
      );
      const party = partyRewardsOf(
        resolvePartyReleaseScope({
          text: partyText,
          committedIdentity: partyScopeIdentity(committedPartyText),
          ...partyInputs,
        }),
      );
      expect(party.rows.map(rewardIdOf)).toEqual([rageRound]);
      const launch = problemsWith(launchEdited, party);
      expect(launch.rewards.contracts.map(rewardIdOf)).not.toContain(rageRound);
      // The reader's own findings name both: Rage Round's ID is still an
      // edge's end, and the new row is reached from no root.
      expect(launch.problems).toEqual([
        digestChanged('campaign-mvp-v1', launch.rewards),
        `campaign-mvp-v1’s scope reader gives the finding dependency-missing on ${rageRound}, a favored-class reward: A required semantic dependency has no manifest row. Correct the scope file, then review that reward again.`,
        `campaign-mvp-v1’s scope reader gives the finding orphan on ${added}, a favored-class reward: Required row has no semantic path from a canonical root. Correct the scope file, then review that reward again.`,
        removed(
          rageRound,
          'Favored Class Bonus ~ Rage Round',
          'classFeat_rage',
        ),
        unreviewed('campaign-mvp-v1', added, addedName),
        digestChanged('campaign-party-v1', party),
        unreviewed('campaign-party-v1', rageRound, 'no contract'),
      ]);
    },
    read.timeout,
  );

  it.each([
    [
      // Round 14's standards review: a reference to the stored record
      // replaced by the record itself, its view kept.
      'Ki’s row’s reference replaced by the object it names',
      () => {
        const element = launchFile.value.rows[positionOf('rows', kiReward)];
        return replacing('rows', kiReward, {
          $inventoryView: 'row-core',
          value: storedRecord(element),
        });
      },
    ],
    [
      // Round 13's: the schema gives an absent scope as "required".
      'an explicit scope "required" deleted from the Bardic Performance Round’s contract, which the reader defaults',
      () => {
        const element =
          launchFile.value.semanticContracts[
            positionOf('semanticContracts', bardicPerformanceRound)
          ];
        const { scope, ...rest } = storedRecord(element);
        expect(scope).toBe('required');
        return replacing('semanticContracts', bardicPerformanceRound, {
          $inventoryView: 'contract',
          value: rest,
        });
      },
    ],
  ] as const)(
    'reads the same, so nothing to review: %s',
    (...[, file]) => {
      const { rewards, problems } = problemsWith(file());
      expect(rewardsDigest(rewards)).toBe(
        reviewedRewards['campaign-mvp-v1'].digest,
      );
      expect(problems).toEqual([]);
    },
    read.timeout,
  );

  it('fails when a reward leaves its scope’s closure, naming it', () => {
    const closure = new Set(
      [...launchClosure].filter((key) => key !== rageRound),
    );
    expect(
      boundaryProblems({
        ...committed,
        closures: { ...committed.closures, 'campaign-mvp-v1': closure },
      }),
    ).toEqual([
      `${rageRound} (Favored Class Bonus ~ Rage Round), in campaign-mvp-v1’s reviewed list (${rewardFile}), is no longer in campaign-mvp-v1’s closure, so the scope does not offer it: review the maxima whose keys it changed (classFeat_rage) and remove it.`,
    ]);
  });

  it('fails on a reward reviewed as changing a key no committed per-day record gives or raises, and on a reward reviewed twice', () => {
    const reviewedLaunch = reviewedRewards['campaign-mvp-v1'];
    const withReviewed = (
      rewards: readonly ReviewedReward[],
    ): ReviewedRewards => ({
      ...reviewedRewards,
      'campaign-mvp-v1': { ...reviewedLaunch, rewards },
    });
    expect(
      boundaryProblems({
        ...committed,
        reviewedRewards: withReviewed(
          reviewedLaunch.rewards.map((each) =>
            each.key === bardicPerformanceRound
              ? { ...each, changes: ['classFeat_bardicPerformnce'] }
              : each,
          ),
        ),
      }),
    ).toEqual([
      `${bardicPerformanceRound} (Favored Class Bonus ~ Bardic Performance Round) is reviewed as changing classFeat_bardicPerformnce, which no committed per-day record gives or raises: correct the key.`,
    ]);
    const [first] = reviewedLaunch.rewards;
    if (!first) throw new Error('No rewards.');
    expect(
      boundaryProblems({
        ...committed,
        reviewedRewards: withReviewed([...reviewedLaunch.rewards, first]),
      }),
    ).toEqual([
      `${first.key} is given 2 times in campaign-mvp-v1’s reviewed list (${rewardFile}): keep one.`,
    ]);
  });

  it('fails when an ARG comparison entry is no longer a remainder without keys', () => {
    const humanMagus = committedComparisons.find(
      ({ name }) => name === 'Human Magus',
    );
    if (!humanMagus) throw new Error('No Human Magus comparison entry.');
    expect(humanMagus).toMatchObject({ eligibility: 'remainder', keys: [] });
    expect(
      boundaryProblems({
        ...committed,
        comparisons: committedComparisons.map((each) =>
          each === humanMagus ? { ...each, eligibility: 'baseline' } : each,
        ),
      }),
    ).toEqual([
      `${humanMagus.id} (Human Magus), an ARG favored-class comparison entry, is baseline with 0 keys: the scope may offer it, so review it as a favored-class reward.`,
    ]);
  });

  it('takes a reward that changes a count as a maximum’s row only listed for its scope and bound by a record: for no scope, for the other scope or as situational it is refused', () => {
    const listed = (row: Partial<ListedRow>) =>
      boundaryProblems({
        ...committed,
        entries: withRewardRow(
          (reward) => ({ ...reward, ...row }) as ListedRow,
        ),
      });
    expect(listed({ scopes: [] })).toEqual([
      refusal,
      `${bardicPerformanceRound} (Favored Class Bonus ~ Bardic Performance Round), listed for Bardic Performance, is listed for no scope: name the scopes it is in, or remove it.`,
    ]);
    expect(listed({ scopes: ['campaign-party-v1'] })).toEqual([
      refusal,
      `${bardicPerformanceRound} (Favored Class Bonus ~ Bardic Performance Round), listed for Bardic Performance, is no longer in campaign-party-v1: review Bardic Performance again and remove or correct the row.`,
    ]);
    expect(
      listed({
        boundBy: undefined,
        situational: 'A probe: the formula does not read the reward.',
      }),
    ).toEqual([refusal]);
    // Listed for its scope and bound by the record that reads it, it is one
    // of the maximum's rows (reward-terms-1).
    expect(listed({})).toEqual([]);
  });
});
