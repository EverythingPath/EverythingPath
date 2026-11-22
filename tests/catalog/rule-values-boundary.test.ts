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
// class bonus, which the sheet records as a note ("alt") it does not count.
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
// decoded values, and the decoder's defaults, trims and a map keyed by
// reward hid edits. The pin now reads each scope file with `JSON.parse`
// only (`scopeFileRewards`) and holds one digest per scope file over its
// favored-class reward contracts and the inventory rows that refer to them,
// every element whole, in file order (`rewardsDigest`); the reviewed reading
// per reward is joined to the file by reward ID after the digest is
// compared. The scope loader's duplicate-key finding is not read here.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  listRuleValueReviews,
  type RuleValueRecord,
} from '../../scripts/catalog/curation';
import { decodePartyScope } from '../../scripts/catalog/party/party-scope';
import { readReleaseScope } from '../../scripts/catalog/release-scope';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { canonicalReleaseJson } from '../../src/lib/catalog/release-schema';
import type { RuleValueAmount } from '../../src/lib/character-sheet-feature-numbers';

const scopeNames = ['campaign-mvp-v1', 'campaign-party-v1'] as const;
type ScopeName = (typeof scopeNames)[number];
type ScopeKeys = Readonly<Record<ScopeName, readonly string[]>>;

const pinFile = 'tests/catalog/rule-values-boundary-scopes.json';

const rewardFile = 'tests/catalog/rule-values-boundary-rewards.json';

type RecordStatus = RuleValueRecord['status'];
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
 * A release scope file's favored-class rewards as the file gives them (fix
 * r14; `scopeFileRewards`): its reward contracts and the inventory rows that
 * refer to them, each element whole, in file order.
 */
type FileRewards = {
  contracts: readonly unknown[];
  rows: readonly unknown[];
};
type ScopeRewards = Readonly<Record<ScopeName, FileRewards>>;
/**
 * A reward as the review read it (ORCH `maxima-promote-1/boundary.md` gives
 * the reading), joined to its scope file's contract and row by `key`, the
 * contract's `id`: its name, every race and class combination its PCGen
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
 * A scope's reviewed rewards (fix r14): `digest`, the scope file's rewards
 * (`rewardsDigest`) when the review read them, and the review's reading of
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
 * (e) Fix r11, as fix r14 has it: each scope file's favored-class rewards
 * against the reviewed list. First the digest: the file's selected contracts
 * and rows (`scopeFileRewards`) against the one the review read, so any edit
 * to a selected element, an element selected or no longer selected, or two
 * selected elements reordered fails. Then, the digest compared, the join of
 * the review's reading to the file by reward ID: every reviewed reward has
 * exactly one contract and exactly one inventory row in its scope file, its
 * reviewed name is its contract's, and its scope's closure holds it (fix
 * r12); every reward the file gives is reviewed, once. Then a reviewed
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
            `${scope}’s favored-class reward contracts and the inventory rows that refer to them, as its scope file gives them, differ from the ones reviewed (${rewardFile}): digest now ${digest}, reviewed ${review.digest}. Find each changed element in the scope file, review who may take that reward, what it does and the per-day keys it changes again, correct its entry and record the new digest.`,
          ];
    const contractIds = file.contracts.map(rewardIdOf);
    const rowIds = file.rows.map(rewardIdOf);
    const reviewedKeys = review.rewards.map(({ key }) => key);
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
          `${key} (${name}) is in ${scope}’s reviewed list (${rewardFile}) but its scope file gives no favored-class reward of that ID: review the maxima whose keys it changed (${changing}) and remove it.`,
        ];
      if (contracts.length !== 1 || rows !== 1)
        return [
          `${key} (${name}), in ${scope}’s reviewed list (${rewardFile}), has ${plural(contracts.length, 'contract')} and ${plural(rows, 'inventory row')} in its scope file: a reviewed reward has exactly one of each. Find why the file gives it so, review the maxima whose keys it changes (${changing}) again, then correct the file or the entry.`,
        ];
      const [contract] = contracts;
      const given = rewardNameOf(contract);
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
        return `${key} (${contract === undefined ? 'no contract' : rewardNameOf(contract)}), a favored-class reward in ${scope}’s scope file, is not in its reviewed list (${rewardFile}): review its text against every per-day maximum (does it change a daily count for every character who takes it?), record the keys it changes, or none, then add it.`;
      });
    const unknownKeys = review.rewards.flatMap(({ key, name, changes }) =>
      changes
        .filter((output) => !perDayKeys.has(output))
        .map(
          (output) =>
            `${key} (${name}) is reviewed as changing ${output}, which no committed per-day record gives or raises: correct the key.`,
        ),
    );
    return [...changed, ...repeated, ...joined, ...unreviewed, ...unknownKeys];
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
 * the favored-class rewards: `rewardProblems` and `entryRewardProblems`.
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
}: {
  scopes: ScopeKeys;
  pinned: ScopeKeys;
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
          { scopes, rewardKeys, byId },
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

const launchScope = await readReleaseScope({ version: 'campaign-mvp-v1' });

async function committedScopes(): Promise<ScopeKeys> {
  const party = decodePartyScope(
    JSON.parse(
      await readFile('scripts/catalog/scopes/campaign-party-v1.json', 'utf8'),
    ),
  );
  return {
    'campaign-mvp-v1': launchScope.importKeys,
    'campaign-party-v1': party.rows.map(({ key }) => key),
  };
}

/** A JSON object as `JSON.parse` gives one. */
type JsonObject = Readonly<Record<string, unknown>>;
const isJsonObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * A release scope file as `JSON.parse` gives it (fix r14): the file, and the
 * records its `value` refers to (the `records` of the file its `records`
 * names, campaign-mvp-v1's records file, or of the file itself, the party
 * scope's).
 */
type StoredScope = { file: unknown; records: unknown };

const favoredClassChannel = 'racial favored class';

/**
 * How `scopeFileRewards` reads a scope file's values with its records
 * (`records`, as `JSON.parse` gives them): `stored`, the record a reference
 * (an object whose one field is `$r`) stands for, any other value itself;
 * `inlined`, a value with each reference in it, at any depth, replaced so;
 * `field`, a field of an element's object (the element, or its `value` where
 * the element is an `$inventoryView`).
 */
function storedReader(records: unknown) {
  if (!isJsonObject(records))
    throw new Error('A scope file without a records object.');
  const isReference = (value: unknown): value is { $r: string } =>
    isJsonObject(value) &&
    Object.keys(value).length === 1 &&
    typeof value.$r === 'string';
  const stored = (value: unknown, depth = 0): unknown => {
    if (!isReference(value)) return value;
    if (depth > 256) throw new Error('Record references nest beyond 256.');
    if (!Object.hasOwn(records, value.$r))
      throw new Error(`A reference to ${value.$r}, which no record has.`);
    return stored(records[value.$r], depth + 1);
  };
  const inlined = (value: unknown, depth = 0): unknown => {
    if (depth > 256) throw new Error('Scope file values nest beyond 256.');
    const item = stored(value);
    if (Array.isArray(item))
      return item.map((each: unknown) => inlined(each, depth + 1));
    if (!isJsonObject(item)) return item;
    return Object.fromEntries(
      Object.entries(item).map(([name, each]) => [
        name,
        inlined(each, depth + 1),
      ]),
    );
  };
  const field = (element: unknown, name: string) => {
    const item = stored(element);
    const object =
      isJsonObject(item) && Object.hasOwn(item, '$inventoryView')
        ? stored(item.value)
        : item;
    return isJsonObject(object) ? stored(object[name]) : undefined;
  };
  return { stored, inlined, field };
}

/**
 * A scope file's favored-class rewards (fix r14, root's decision): read from
 * the file as `JSON.parse` gives it, with no schema, decoder, resolver or map
 * between the file and the digest. A scope file stores content its elements
 * share once, among its records, and gives it in their place as
 * `{"$r": key}`; the reader puts that record, as `JSON.parse` gives it, in
 * place of each such reference (an object whose one field is `$r`) and
 * changes nothing else, so a field's absence, a string's bytes and an
 * array's order are the file's. Which elements: a contract is an element of
 * the file's `value.semanticContracts` whose object (the element, or its
 * `value` where the element is an `$inventoryView`) has the `channel`
 * "racial favored class"; an inventory row is an element of `value.rows`
 * whose object has that `channel`, or an `id` or `key` that is a selected
 * contract's `id`. Both lists keep every selected element whole, in file
 * order, so a repeated element lengthens its list.
 */
function scopeFileRewards({ file, records }: StoredScope): FileRewards {
  if (!isJsonObject(file) || !isJsonObject(file.value))
    throw new Error('A scope file without a value object.');
  const body = file.value;
  const { stored, inlined, field } = storedReader(records);
  const list = (name: string): readonly unknown[] => {
    const value = stored(body[name]);
    if (value === undefined) return [];
    if (!Array.isArray(value))
      throw new Error(`The scope file's ${name} is no list.`);
    return value;
  };
  const contracts = list('semanticContracts').filter(
    (element) => field(element, 'channel') === favoredClassChannel,
  );
  const ids = new Set(contracts.map((element) => field(element, 'id')));
  const rows = list('rows').filter(
    (element) =>
      field(element, 'channel') === favoredClassChannel ||
      ids.has(field(element, 'id')) ||
      ids.has(field(element, 'key')),
  );
  return {
    contracts: contracts.map((element) => inlined(element)),
    rows: rows.map((element) => inlined(element)),
  };
}

/**
 * The digest the pin compares (fix r14): the SHA-256 of a scope file's two
 * lists, contracts and rows, as `scopeFileRewards` selects them, through the
 * shared canonical serializer (`canonicalReleaseJson`: object keys sorted,
 * array order and string bytes untouched). Two selected elements swapped
 * change it too, so a reordered file fails until it is reviewed again, the
 * safe direction.
 */
const rewardsDigest = (rewards: FileRewards) =>
  `sha256:${createHash('sha256').update(canonicalReleaseJson(rewards)).digest('hex')}`;

/** An element's object: its `value` if it is an `$inventoryView`, else itself. */
const selectedObject = (element: unknown): JsonObject => {
  const object =
    isJsonObject(element) && Object.hasOwn(element, '$inventoryView')
      ? element.value
      : element;
  return isJsonObject(object) ? object : {};
};
/** A selected element's reward ID: its object's `id`, or a row's `key`. */
const rewardIdOf = (element: unknown) => {
  const { id: given, key } = selectedObject(element);
  return String(given ?? key);
};
const rewardNameOf = (element: unknown) => String(selectedObject(element).name);

/** A scope file as `JSON.parse` gives it, with its records. */
async function storedScope(path: string): Promise<StoredScope> {
  const file: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (!isJsonObject(file)) throw new Error(`${path} is no JSON object.`);
  if (typeof file.records !== 'string') return { file, records: file.records };
  const recordsFile: unknown = JSON.parse(
    await readFile(join(dirname(path), file.records), 'utf8'),
  );
  return {
    file,
    records: isJsonObject(recordsFile) ? recordsFile.records : undefined,
  };
}

const storedScopes: Readonly<Record<ScopeName, StoredScope>> = {
  'campaign-mvp-v1': await storedScope(
    'scripts/catalog/scopes/campaign-mvp-v1.json',
  ),
  'campaign-party-v1': await storedScope(
    'scripts/catalog/scopes/campaign-party-v1.json',
  ),
};
const committedRewards: ScopeRewards = {
  'campaign-mvp-v1': scopeFileRewards(storedScopes['campaign-mvp-v1']),
  'campaign-party-v1': scopeFileRewards(storedScopes['campaign-party-v1']),
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
 * The reviewed list (ORCH maxima-promote-1/boundary.md, fix r3): for each
 * per-day maximum output of a checked record, and of the drafted one this
 * slice sends to its promotion review (the Magus's pool; fix r11 holds
 * Bardic Performance, `heldBardicPerformance`), every row of the pinned
 * scopes that changes its count. The nine checked maxima were confirmed by the
 * stats-d3 promotion review on these scopes, whose membership has not changed
 * since; their rows here are the class and feature that give the count and
 * the rows a reading of the scopes' text found to touch it.
 */
const reviewed: readonly Entry[] = [
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
 * Bardic Performance's entry as the boundary reviewed it until fix r11, its
 * class, its feature, Extra Performance, the Perfect Golden Lute and
 * Song-Bound Curse. The second promotion review (2026-11-21) found a row it
 * lacks: the Gnome's and Half-Elf's favored-class reward (apg_abilities_race
 * .lst:142, campaign-mvp-v1) adds a round a day each time it is taken, and the
 * sheet records a reward only as a note. No record gives it, so the maximum
 * and Extra Performance are held, and the entry is no longer in the reviewed
 * list: a held maximum needs none. It stays here as the probe that the pin
 * refuses it.
 */
const heldBardicPerformance: Entry = {
  record: id.bardicPerformance,
  output: 'classFeat_bardicPerformance',
  amount: { formula: '4 + @ability.cha.mod + 2 * (@classLevel.bard - 1)' },
  name: 'Bardic Performance',
  rows: [
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
  ],
};

const pinned = JSON.parse(await readFile(pinFile, 'utf8')) as ScopeKeys;
const reviewedRewards = JSON.parse(
  await readFile(rewardFile, 'utf8'),
) as ReviewedRewards;
const scopes = await committedScopes();
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
 * This slice's records for promotion, which the record step checks after
 * their promotion review: the Magus's pool and Extra Arcane Pool (fix r11
 * holds Bardic Performance and Extra Performance).
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

  it('agrees with them once the record step checks this slice’s two records for promotion, whose IDs do not move, and fails if a checked one then has no entry', () => {
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
    expect(
      boundaryProblems({
        ...committed,
        records: changed({
          [id.madDogRage]: (record) => check(markedForPromotion(record)),
        }),
      }),
    ).toEqual([
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
    // (fix r11: Bardic Performance, the reviewers' second probe, is held).
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

describe('the per-day boundary’s favored-class rewards (maxima-promote-1 fix r11; read from the scope files, fix r14)', () => {
  const reward = (line: number) =>
    `rule/core/favored-class/roleplaying_game/advanced_players_guide/apg_abilities_race.lst:${line}`;
  const bardicPerformanceRound = reward(142);
  const rageRound = reward(213);
  const kiReward = reward(199);
  const launch = storedScopes['campaign-mvp-v1'];
  const launchRewards = committedRewards['campaign-mvp-v1'];
  const refusal = `${bardicPerformanceRound} (Favored Class Bonus ~ Bardic Performance Round), a favored-class reward of campaign-mvp-v1, changes classFeat_bardicPerformance, Bardic Performance’s count, for every character who takes it, and is not one of its rows listed for campaign-mvp-v1 and bound by a record: bind it by a record (a reward that changes a count is not situational), or hold the maximum and remove its entry.`;
  /** The problem for a scope file whose rewards are now `rewards`. */
  const digestChanged = (scope: ScopeName, rewards: FileRewards) =>
    `${scope}’s favored-class reward contracts and the inventory rows that refer to them, as its scope file gives them, differ from the ones reviewed (${rewardFile}): digest now ${rewardsDigest(rewards)}, reviewed ${reviewedRewards[scope].digest}. Find each changed element in the scope file, review who may take that reward, what it does and the per-day keys it changes again, correct its entry and record the new digest.`;
  const removed = (key: string, name: string, changes: string) =>
    `${key} (${name}) is in campaign-mvp-v1’s reviewed list (${rewardFile}) but its scope file gives no favored-class reward of that ID: review the maxima whose keys it changed (${changes}) and remove it.`;
  const unreviewed = (scope: ScopeName, key: string, name: string) =>
    `${key} (${name}), a favored-class reward in ${scope}’s scope file, is not in its reviewed list (${rewardFile}): review its text against every per-day maximum (does it change a daily count for every character who takes it?), record the keys it changes, or none, then add it.`;

  /** A scope file's object and its body, as `JSON.parse` gives them. */
  const fileOf = ({ file }: StoredScope) => {
    if (!isJsonObject(file) || !isJsonObject(file.value))
      throw new Error('No scope file body.');
    return { file, body: file.value };
  };
  /** `scope`'s file with its body's list `name` changed by `change`. */
  const withList = (
    scope: StoredScope,
    name: 'semanticContracts' | 'rows',
    change: (elements: readonly unknown[]) => readonly unknown[],
  ): StoredScope => {
    const { file, body } = fileOf(scope);
    const elements = body[name] ?? [];
    if (!Array.isArray(elements)) throw new Error(`No list ${name}.`);
    return {
      ...scope,
      file: { ...file, value: { ...body, [name]: change(elements) } },
    };
  };
  const launchReader = storedReader(launch.records);
  const isReward = (key: string) => (element: unknown) =>
    (launchReader.field(element, 'id') ??
      launchReader.field(element, 'key')) === key;
  /**
   * A reward's contract as its scope file gives it, read for an edit: the
   * fields a probe changes, typed as the committed file gives them.
   */
  type StoredContract = JsonObject & {
    parameters: readonly { name: string; values: readonly string[] }[];
    sources: readonly JsonObject[];
    nativeRequirements: readonly string[];
    prerequisites: readonly (JsonObject & {
      kind: string;
      items: readonly string[];
    })[];
    implementationOwner: JsonObject & { issue: number };
  };
  /**
   * campaign-mvp-v1's file with reward `key`'s stored record changed by
   * `change`, in the raw JSON: each element of `lists` that gives the reward
   * (its contract and its row, a view of the same record) is written with
   * its references in place and its object changed, as the inventory's
   * writer may store a record, so only `change` differs from the file.
   */
  const withReward = (
    key: string,
    change: (contract: StoredContract) => JsonObject,
    lists: readonly ('semanticContracts' | 'rows')[] = [
      'semanticContracts',
      'rows',
    ],
  ) =>
    lists.reduce(
      (scope, name) =>
        withList(scope, name, (elements) =>
          elements.map((element) => {
            if (!isReward(key)(element)) return element;
            const whole = launchReader.inlined(element);
            if (!isJsonObject(whole)) throw new Error('No element object.');
            const view = Object.hasOwn(whole, '$inventoryView');
            const object = view ? whole.value : whole;
            if (!isJsonObject(object)) throw new Error('No element object.');
            // The probes change fields the committed file gives every reward.
            const changed = change(object as StoredContract);
            return view ? { ...whole, value: changed } : changed;
          }),
        ),
      launch,
    );
  /** The problems once campaign-mvp-v1's file is `stored`, with its rewards. */
  const problemsWith = (stored: StoredScope) => {
    const rewards = scopeFileRewards(stored);
    return {
      rewards,
      problems: boundaryProblems({
        ...committed,
        rewards: { ...committedRewards, 'campaign-mvp-v1': rewards },
      }),
    };
  };
  const mapValues = (
    contract: StoredContract,
    change: (value: string) => string,
    index?: number,
  ) => ({
    ...contract,
    parameters: contract.parameters.map((parameter, at) =>
      index === undefined || at === index
        ? { ...parameter, values: parameter.values.map(change) }
        : parameter,
    ),
  });

  it('reads 64 rewards from campaign-mvp-v1’s file, each one contract and one row, and none from the party scope’s; five change a per-day key, none the Magus’s pool’s or the nine checked maxima’s', () => {
    expect(launchRewards.contracts).toHaveLength(64);
    expect(launchRewards.rows).toHaveLength(64);
    // The raw selection agrees with the decoded inventory (which the digest
    // does not read): its advancement contracts of the channel, in order.
    const decoded = launchScope.manifest.semanticContracts
      .filter(
        ({ kind, channel }) =>
          kind === 'advancement' && channel === favoredClassChannel,
      )
      .map(({ id: key }) => key);
    expect(launchRewards.contracts.map(rewardIdOf)).toEqual(decoded);
    expect(launchRewards.rows.map(rewardIdOf).sort()).toEqual(
      [...decoded].sort(),
    );
    expect(committedRewards['campaign-party-v1']).toEqual({
      contracts: [],
      rows: [],
    });
    const changing = scopeNames.flatMap((scope) =>
      reviewedRewards[scope].rewards
        .filter(({ changes }) => changes.length)
        .map(({ key, changes }) => [key, changes] as const),
    );
    expect(changing).toEqual([
      [bardicPerformanceRound, ['classFeat_bardicPerformance']],
      [reward(148), ['classFeat_bomb']],
      [reward(162), ['classFeat_stunningFist']],
      [kiReward, ['classFeat_kiPool', 'classFeat_kiPoolUc']],
      [rageRound, ['classFeat_rage']],
    ]);
    const entryKeys = reviewed.map(({ output }) => output);
    expect(entryKeys).toContain('classFeat_arcanePool');
    expect(
      changing.filter(([, changes]) =>
        changes.some((output) => entryKeys.includes(output)),
      ),
    ).toEqual([]);
    // The ARG's options are comparison evidence only: 137 remainders, no key.
    expect(committedComparisons).toHaveLength(137);
  });

  it('refuses Bardic Performance’s entry as reviewed before fix r11: the Gnome’s and Half-Elf’s reward changes its count and is not one of its rows', () => {
    expect(
      boundaryProblems({
        ...committed,
        entries: [...reviewed, heldBardicPerformance],
      }),
    ).toEqual([refusal]);
  });

  it.each([
    [
      'an explicit scope "required" deleted from the Bardic Performance Round’s record (round 13’s standards review: the schema restores it)',
      () =>
        withReward(bardicPerformanceRound, ({ scope, ...rest }) => {
          expect(scope).toBe('required');
          return rest;
        }),
    ],
    [
      'an explicit minimumClassLevel null deleted from Ki’s record (round 13’s spec review: the schema restores it)',
      () =>
        withReward(kiReward, ({ minimumClassLevel, ...rest }) => {
          expect(minimumClassLevel).toBeNull();
          return rest;
        }),
    ],
    [
      'surrounding whitespace added to a parameter value of the Rage Round (round 13’s reviews: the schema trims it)',
      () =>
        withReward(rageRound, (contract) =>
          mapValues(contract, (value) =>
            value.startsWith('BONUS:') ? ` ${value} ` : value,
          ),
        ),
    ],
  ] as const)(
    'fails on an edit the scope file’s decoder hides: %s',
    (...[, stored]) => {
      const { rewards, problems } = problemsWith(stored());
      expect(problems).toEqual([digestChanged('campaign-mvp-v1', rewards)]);
    },
  );

  it('fails on a reward’s inventory row repeated with its contract kept once, and on its contract repeated, naming each count', () => {
    const repeat = (elements: readonly unknown[]) =>
      elements.flatMap((element) =>
        isReward(kiReward)(element) ? [element, element] : [element],
      );
    const rows = problemsWith(withList(launch, 'rows', repeat));
    expect(rows.rewards.rows).toHaveLength(65);
    expect(rows.problems).toEqual([
      digestChanged('campaign-mvp-v1', rows.rewards),
      `${kiReward} (Favored Class Bonus ~ Ki), in campaign-mvp-v1’s reviewed list (${rewardFile}), has 1 contract and 2 inventory rows in its scope file: a reviewed reward has exactly one of each. Find why the file gives it so, review the maxima whose keys it changes (classFeat_kiPool, classFeat_kiPoolUc) again, then correct the file or the entry.`,
    ]);
    const contracts = problemsWith(
      withList(launch, 'semanticContracts', repeat),
    );
    expect(contracts.rewards.contracts).toHaveLength(65);
    expect(contracts.problems).toEqual([
      digestChanged('campaign-mvp-v1', contracts.rewards),
      `${kiReward} (Favored Class Bonus ~ Ki), in campaign-mvp-v1’s reviewed list (${rewardFile}), has 2 contracts and 1 inventory row in its scope file: a reviewed reward has exactly one of each. Find why the file gives it so, review the maxima whose keys it changes (classFeat_kiPool, classFeat_kiPoolUc) again, then correct the file or the entry.`,
    ]);
  });

  it('fails when a scope file gains, loses or rewords a reward, naming it and what to review', () => {
    const [first, second] = reviewedRewards['campaign-mvp-v1'].rewards;
    if (!first || !second) throw new Error('No rewards.');
    const added = reward(999);
    const addedName = 'Favored Class Bonus ~ Arcane Pool';
    // The first reworded (its DESC), the second left out, a copy of the
    // first under a new ID and name added, contract and row.
    const reworded = withReward(first.key, (contract) =>
      mapValues(contract, (value) =>
        value.startsWith('DESC:') ? `${value} More.` : value,
      ),
    );
    const copy = (element: unknown) => {
      const whole = launchReader.inlined(element);
      if (!isJsonObject(whole) || !isJsonObject(whole.value))
        throw new Error('No view.');
      return {
        ...whole,
        value: { ...whole.value, id: added, name: addedName },
      };
    };
    const changedFile = (['semanticContracts', 'rows'] as const).reduce(
      (scope, name) =>
        withList(scope, name, (elements) => [
          ...elements.filter((element) => !isReward(second.key)(element)),
          ...elements.filter(isReward(first.key)).map(copy),
        ]),
      reworded,
    );
    const { rewards, problems } = problemsWith(changedFile);
    expect(problems).toEqual([
      digestChanged('campaign-mvp-v1', rewards),
      removed(second.key, second.name, 'none'),
      unreviewed('campaign-mvp-v1', added, addedName),
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

  it.each([
    [
      'its eligibility: the Gnome’s and Half-Elf’s Bard reward also open to an Elf',
      () =>
        withReward(bardicPerformanceRound, (contract) => ({
          ...contract,
          nativeRequirements: [
            'PREABILITY:1,CATEGORY=Special Ability,Bard',
            'PRECLASS:1,Bard=1',
            'PREFACT:1,TEMPLATES,IsElf=true,IsGnome=true,IsHalfElf=true',
          ],
        })),
    ],
    [
      // Both requirements a Bloodrager must meet (round 12's spec review),
      // in both forms the contract gives them (round 13's): the native PCGen
      // requirements and the parsed prerequisites.
      'its eligibility: the Rage Round also open to a Bloodrager, in its native requirements and its parsed prerequisites',
      () =>
        withReward(rageRound, (contract) => ({
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
        })),
    ],
    [
      'its accumulation: the Rage Round adding 2 per selection',
      () =>
        withReward(rageRound, (contract) =>
          mapValues(contract, (value) =>
            value === 'BONUS:VAR|RageDuration|1'
              ? 'BONUS:VAR|RageDuration|2'
              : value,
          ),
        ),
    ],
    [
      'its accumulation: Bombs at 1 a selection, not 1/2',
      () =>
        withReward(reward(148), (contract) => ({
          ...contract,
          parameters: contract.parameters.map((parameter) =>
            parameter.name === 'source fractions'
              ? { ...parameter, values: ['1'] }
              : parameter,
          ),
        })),
    ],
    [
      'a second DESC giving another accumulation (round 12’s spec review)',
      () =>
        withReward(rageRound, (contract) => ({
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
        })),
    ],
    [
      'its source line: a tag only the line carries (STACK, MULT) changed, so only its hash shows it',
      () =>
        withReward(bardicPerformanceRound, (contract) => ({
          ...contract,
          sources: contract.sources.map((source) => ({
            ...source,
            rawSha256: 'f'.repeat(64),
          })),
        })),
    ],
    [
      'a source repinned with its line’s bytes kept (round 12’s standards review)',
      () =>
        withReward(bardicPerformanceRound, (contract) => ({
          ...contract,
          sources: contract.sources.map((source) => ({
            ...source,
            pin: '0'.repeat(40),
          })),
        })),
    ],
    [
      'its source file’s hash',
      () =>
        withReward(kiReward, (contract) => ({
          ...contract,
          sources: contract.sources.map((source) => ({
            ...source,
            rawFileSha256: 'e'.repeat(64),
          })),
        })),
    ],
    [
      'Animal Companion Skill Rank’s parsed prerequisites no longer exclude a Human Druid',
      () =>
        withReward(reward(133), (contract) => ({
          ...contract,
          prerequisites: contract.prerequisites.map((prerequisite) => ({
            ...prerequisite,
            isNegated: false,
          })),
        })),
    ],
    [
      'the Bard reward’s disposition',
      () =>
        withReward(bardicPerformanceRound, (contract) => ({
          ...contract,
          disposition: 'recorded choice',
        })),
    ],
    [
      'its owners, in its contract only',
      () =>
        withReward(
          kiReward,
          (contract) => ({
            ...contract,
            implementationOwner: {
              ...contract.implementationOwner,
              issue: contract.implementationOwner.issue + 1,
            },
          }),
          ['semanticContracts'],
        ),
    ],
    [
      'its inventory row (the view it is stored as), beside an unchanged contract',
      () =>
        withList(launch, 'rows', (elements) =>
          elements.map((element) => {
            if (!isReward(kiReward)(element)) return element;
            if (!isJsonObject(element)) throw new Error('No row.');
            expect(element.$inventoryView).toBe('row-core');
            return { ...element, $inventoryView: 'row-advanced' };
          }),
        ),
    ],
  ] as const)(
    'fails on a change to a field of a reward in the scope file, its name kept: %s',
    (...[, stored]) => {
      const { rewards, problems } = problemsWith(stored());
      expect(problems).toEqual([digestChanged('campaign-mvp-v1', rewards)]);
    },
  );

  it('fails when a reward leaves its scope’s closure or moves to the other scope’s file, naming it in each', () => {
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
    // Its contract and row out of the launch file, into the party scope's.
    const moving = (name: 'semanticContracts' | 'rows') => {
      const { body } = fileOf(launch);
      const elements = body[name];
      if (!Array.isArray(elements)) throw new Error(`No ${name}.`);
      return elements
        .filter(isReward(rageRound))
        .map((element) => launchReader.inlined(element));
    };
    const left = (['semanticContracts', 'rows'] as const).reduce(
      (scope, name) =>
        withList(scope, name, (elements) =>
          elements.filter((element) => !isReward(rageRound)(element)),
        ),
      launch,
    );
    const arrived = (['semanticContracts', 'rows'] as const).reduce(
      (scope, name) =>
        withList(scope, name, (elements) => [...elements, ...moving(name)]),
      storedScopes['campaign-party-v1'],
    );
    const rewards = {
      'campaign-mvp-v1': scopeFileRewards(left),
      'campaign-party-v1': scopeFileRewards(arrived),
    };
    expect(rewards['campaign-mvp-v1'].contracts).toHaveLength(63);
    expect(rewards['campaign-party-v1'].rows).toHaveLength(1);
    expect(boundaryProblems({ ...committed, rewards })).toEqual([
      digestChanged('campaign-mvp-v1', rewards['campaign-mvp-v1']),
      removed(rageRound, 'Favored Class Bonus ~ Rage Round', 'classFeat_rage'),
      digestChanged('campaign-party-v1', rewards['campaign-party-v1']),
      unreviewed(
        'campaign-party-v1',
        rageRound,
        'Favored Class Bonus ~ Rage Round',
      ),
    ]);
  });

  it('takes a reward that changes a count as a maximum’s row only listed for its scope and bound by a record: for no scope, for the other scope or as situational it is refused', () => {
    const listed = (row: Partial<ListedRow>) =>
      boundaryProblems({
        ...committed,
        entries: [
          ...reviewed,
          {
            ...heldBardicPerformance,
            rows: [
              ...heldBardicPerformance.rows,
              {
                row: bardicPerformanceRound,
                name: 'Favored Class Bonus ~ Bardic Performance Round',
                kind: 'favoredClassReward',
                scopes: mvp,
                effect: 'Adds 1 round a day each time it is taken.',
                boundBy: id.bardicPerformance,
                ...row,
              } as ListedRow,
            ],
          },
        ],
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
        situational: 'A probe: the sheet records the reward as a note.',
      }),
    ).toEqual([refusal]);
    // Listed for its scope and bound (a probe only: Bardic Performance's own
    // record does not count the reward), it is one of the maximum's rows.
    expect(listed({})).toEqual([]);
  });
});
