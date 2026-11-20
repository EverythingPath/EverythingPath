// @vitest-environment node
// maxima-promote-1 fix r3 and r4 (PRD #251; root, 2026-11-20; ORCH
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
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  listRuleValueReviews,
  type RuleValueRecord,
} from '../../scripts/catalog/curation';
import { decodePartyScope } from '../../scripts/catalog/party/party-scope';
import { readReleaseScope } from '../../scripts/catalog/release-scope';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';

const scopeNames = ['campaign-mvp-v1', 'campaign-party-v1'] as const;
type ScopeName = (typeof scopeNames)[number];
type ScopeKeys = Readonly<Record<ScopeName, readonly string[]>>;

const pinFile = 'tests/catalog/rule-values-boundary-scopes.json';

type RecordStatus = RuleValueRecord['status'];
/**
 * A rule-value record as the pin reads it: its ID as `--list` prints it
 * (the entry's key, its group and its description's hash; neither its status
 * nor its rationale), its status, and the keys of its per-day maximum outputs.
 */
type PinRecord = {
  id: string;
  status: RecordStatus;
  maxima: readonly string[];
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
 * `--list` prints it and the output's key.
 */
type Entry = {
  record: string;
  output: string;
  name: string;
  rows: readonly ListedRow[];
};

/** How many times each key is in `keys`. */
function keyCounts(keys: readonly string[]) {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

/**
 * (a) Each scope whose keys differ from the pinned ones as lists, the same
 * keys the same number of times (order aside), with the keys added, removed
 * and repeated. `campaign-mvp-v1`'s import keys cannot repeat (release-scope.ts
 * `collectImportKeys` returns them from a set), but the party scope's schema
 * (`partyScopeSchema` in party/party-scope.ts) does not forbid a repeated row,
 * so both are compared exactly: a repeated key is not the scope the review
 * read, whatever it would mean for a sheet.
 */
function scopeProblems(scopes: ScopeKeys, pinned: ScopeKeys) {
  return scopeNames.flatMap((scope) => {
    const now = keyCounts(scopes[scope]);
    const then = keyCounts(pinned[scope]);
    const keys = [...new Set([...now.keys(), ...then.keys()])].sort();
    const added = keys.filter((key) => !then.has(key));
    const removed = keys.filter((key) => !now.has(key));
    const repeated = keys.flatMap((key) => {
      const [count, pinnedCount] = [now.get(key), then.get(key)];
      return count && pinnedCount && count !== pinnedCount
        ? [`${key} (${count} times, pinned ${pinnedCount})`]
        : [];
    });
    if (!added.length && !removed.length && !repeated.length) return [];
    const repeats = repeated.length
      ? `; repeated ${repeated.join(', ')}. A repeated key is not the scope that was reviewed: find why the scope repeats it.`
      : '.';
    return [
      `${scope} differs from its pinned keys (${pinFile}): added ${added.join(', ') || 'none'}; removed ${removed.join(', ') || 'none'}${repeats} Review each added row against every promoted per-day maximum (does it change a daily count unconditionally while taken, worn or active?), record the answer in the reviewed list or hold the maximum, then update the pin.`,
    ];
  });
}

/**
 * (b) and (d) for one listed row of a maximum whose record is `status`: the
 * row is in every scope it is listed for, and a record it is bound by exists
 * and, while the maximum is checked, is checked.
 */
function rowProblems(
  row: ListedRow,
  { name, status }: { name: string; status: RecordStatus },
  context: { scopes: ScopeKeys; statusOf: ReadonlyMap<string, RecordStatus> },
) {
  const problems = row.scopes
    .filter((scope) => !context.scopes[scope].includes(row.row))
    .map(
      (scope) =>
        `${row.row} (${row.name}), listed for ${name}, is no longer in ${scope}: review ${name} again and remove or correct the row.`,
    );
  if (row.boundBy === undefined) return problems;
  const bound = context.statusOf.get(row.boundBy);
  return bound !== undefined && (status !== 'checked' || bound === 'checked')
    ? problems
    : [
        ...problems,
        `${row.row} (${row.name}) is bound by ${row.boundBy}, which is ${bound ?? 'no committed record'}, while ${name} is ${status}: check the record with the maximum, correct the binding, or hold the maximum.`,
      ];
}

const entryKey = ({ record, output }: { record: string; output: string }) =>
  `${output} of ${record}`;

/**
 * What fails the pin: (a) a scope's keys differ from the pinned ones as lists
 * (`scopeProblems`); (b) a listed row is no longer in a scope it is listed
 * for; (c) a per-day maximum output of a checked record has no entry of its
 * own, keyed by the record's ID and the output's key, or an entry is repeated
 * or names a record or an output that no longer exists; (d) a row is bound by
 * a record that does not exist, or that is drafted while the maximum is
 * checked. Which maxima need an entry is read from the records' status and
 * outputs alone: a drafted record may have one (that is how a promotion
 * review reads it), and needs one once the record step checks it.
 */
function boundaryProblems({
  scopes,
  pinned,
  entries,
  records,
}: {
  scopes: ScopeKeys;
  pinned: ScopeKeys;
  entries: readonly Entry[];
  records: readonly PinRecord[];
}): string[] {
  const byId = new Map(records.map((record) => [record.id, record]));
  const statusOf = new Map(records.map(({ id, status }) => [id, status]));
  const entryCounts = keyCounts(entries.map(entryKey));
  return [
    ...scopeProblems(scopes, pinned),
    ...records
      .filter(({ status }) => status === 'checked')
      .flatMap(({ id, maxima }) =>
        maxima
          .map((output) => entryKey({ record: id, output }))
          .filter((key) => !entryCounts.has(key))
          .map(
            (key) =>
              `${key} is a checked per-day maximum and has no entry in the reviewed list: review the release scopes’ rows against it and add an entry keyed by the record’s ID and the output’s key.`,
          ),
      ),
    ...[...entryCounts]
      .filter(([, count]) => count > 1)
      .map(
        ([key, count]) =>
          `The reviewed list has ${count} entries for ${key}: keep one.`,
      ),
    ...entries.flatMap(({ record: id, output, name, rows }) => {
      const record = byId.get(id);
      if (!record)
        return [
          `The entry for ${name} names ${id}, which is no committed rule-value record: review the maximum again under its record’s current ID, or remove the entry.`,
        ];
      if (!record.maxima.includes(output))
        return [
          `The entry for ${name} names ${output}, which is no per-day maximum of ${id}: correct or remove the entry.`,
        ];
      return rows.flatMap((row) =>
        rowProblems(row, { name, status: record.status }, { scopes, statusOf }),
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
      ruleValue.kind === 'dailyMaximum' ? [ruleValue.key] : [],
    ),
  }));
const ruleValues = reviewedCuration.ruleValues ?? [];
const committedRecords = pinRecords(ruleValues);

async function committedScopes(): Promise<ScopeKeys> {
  const launch = await readReleaseScope({ version: 'campaign-mvp-v1' });
  const party = decodePartyScope(
    JSON.parse(
      await readFile('scripts/catalog/scopes/campaign-party-v1.json', 'utf8'),
    ),
  );
  return {
    'campaign-mvp-v1': launch.importKeys,
    'campaign-party-v1': party.rows.map(({ key }) => key),
  };
}

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
 * per-day maximum output of a checked record, and of the two drafted ones
 * this slice sends to its promotion review, every row of the pinned scopes
 * that changes its count. The nine checked maxima were confirmed by the
 * stats-d3 promotion review on these scopes, whose membership has not changed
 * since; their rows here are the class and feature that give the count and
 * the rows a reading of the scopes' text found to touch it.
 */
const reviewed: readonly Entry[] = [
  {
    record: id.bane,
    output: 'classFeat_bane',
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
    record: id.bardicPerformance,
    output: 'classFeat_bardicPerformance',
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
  },
  {
    record: id.arcanePool,
    output: 'classFeat_arcanePool',
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

const pinned = JSON.parse(await readFile(pinFile, 'utf8')) as ScopeKeys;
const scopes = await committedScopes();
const committed = {
  scopes,
  pinned,
  entries: reviewed,
  records: committedRecords,
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
/** This slice's four records, which the record step checks after their promotion review. */
const forPromotion: readonly string[] = [
  id.bardicPerformance,
  id.extraPerformance,
  id.arcanePool,
  id.extraArcanePool,
];
const fourChecked = Object.fromEntries(forPromotion.map((key) => [key, check]));

describe('the per-day boundary: a pin on what the release scopes can build (maxima-promote-1 fix r3, r4)', () => {
  it('pins each scope’s keys sorted, so a re-review reads its difference', () => {
    for (const scope of scopeNames) {
      expect(pinned[scope], scope).toEqual([...pinned[scope]].sort());
    }
  });

  it('agrees with the committed scopes, records and reviewed list', () => {
    expect(boundaryProblems(committed)).toEqual([]);
  });

  it('agrees with them once the record step checks this slice’s four records, whose IDs do not move, and fails if a checked one then has no entry', () => {
    const records = changed(fourChecked);
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
      `classFeat_arcanePool of ${id.arcanePool} is a checked per-day maximum and has no entry in the reviewed list: review the release scopes’ rows against it and add an entry keyed by the record’s ID and the output’s key.`,
    ]);
  });

  it('fails when a scope gains a key, naming the key and what to review', () => {
    const added = 'pf1/AAAAAAAAAAAAAAAA';
    const problems = boundaryProblems({
      ...committed,
      scopes: {
        ...scopes,
        'campaign-party-v1': [...scopes['campaign-party-v1'], added],
      },
    });
    expect(problems).toEqual([
      `campaign-party-v1 differs from its pinned keys (${pinFile}): added ${added}; removed none. Review each added row against every promoted per-day maximum (does it change a daily count unconditionally while taken, worn or active?), record the answer in the reviewed list or hold the maximum, then update the pin.`,
    ]);
  });

  it('fails when a scope repeats a key, naming the key and both counts', () => {
    const repeated = scopes['campaign-party-v1'][0] ?? '';
    const problems = boundaryProblems({
      ...committed,
      scopes: {
        ...scopes,
        'campaign-party-v1': [...scopes['campaign-party-v1'], repeated],
      },
    });
    expect(problems).toEqual([
      `campaign-party-v1 differs from its pinned keys (${pinFile}): added none; removed none; repeated ${repeated} (2 times, pinned 1). A repeated key is not the scope that was reviewed: find why the scope repeats it. Review each added row against every promoted per-day maximum (does it change a daily count unconditionally while taken, worn or active?), record the answer in the reviewed list or hold the maximum, then update the pin.`,
    ]);
  });

  it('fails when a listed row leaves its scope, naming the row and its maximum', () => {
    const lute = 'pf1-content/EwPVzd0GLhBgMo5w';
    const without = scopes['campaign-mvp-v1'].filter((key) => key !== lute);
    const problems = boundaryProblems({
      ...committed,
      scopes: { ...scopes, 'campaign-mvp-v1': without },
      pinned: { ...pinned, 'campaign-mvp-v1': without },
    });
    expect(problems).toEqual([
      `${lute} (Perfect Golden Lute), listed for Bardic Performance, is no longer in campaign-mvp-v1: review Bardic Performance again and remove or correct the row.`,
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
      `classFeat_rage of ${id.madDogRage} is a checked per-day maximum and has no entry in the reviewed list: review the release scopes’ rows against it and add an entry keyed by the record’s ID and the output’s key.`,
    ]);
  });

  it('needs an entry for each per-day maximum output, so a second maximum on a reviewed record has its own', () => {
    const second: RuleValueRecord['outputs'][number] = {
      kind: 'ruleValue',
      ruleValue: {
        key: 'classFeat_bardicPerformanceSecond',
        kind: 'dailyMaximum',
        amount: { formula: '1' },
        unit: 'rounds',
      },
    };
    const problems = boundaryProblems({
      ...committed,
      records: changed({
        ...fourChecked,
        [id.bardicPerformance]: (record) =>
          check({ ...record, outputs: [...record.outputs, second] }),
      }),
    });
    expect(problems).toEqual([
      `classFeat_bardicPerformanceSecond of ${id.bardicPerformance} is a checked per-day maximum and has no entry in the reviewed list: review the release scopes’ rows against it and add an entry keyed by the record’s ID and the output’s key.`,
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
      ],
    });
    expect(problems).toEqual([
      `The reviewed list has 2 entries for classFeat_bane of ${id.bane}: keep one.`,
      `The entry for Bane names ${stale}, which is no committed rule-value record: review the maximum again under its record’s current ID, or remove the entry.`,
      `The entry for Bane names classFeat_baneGreater, which is no per-day maximum of ${id.bane}: correct or remove the entry.`,
    ]);
  });

  it('fails when a row is bound by a record that is drafted while its maximum is checked', () => {
    // The record step checks Bardic Performance and not Extra Performance.
    const problems = boundaryProblems({
      ...committed,
      records: changed({
        [id.bardicPerformance]: check,
        [id.extraPerformance]: draft,
      }),
    });
    expect(problems).toEqual([
      `pf1/6yGoL82RidBHmXPb (Extra Performance) is bound by ${id.extraPerformance}, which is drafted, while Bardic Performance is checked: check the record with the maximum, correct the binding, or hold the maximum.`,
    ]);
  });
});
