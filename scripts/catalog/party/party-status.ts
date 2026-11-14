import {
  comparePartyIds,
  partyCharacterGaps,
  partyCharacterKeys,
  type PartyBuilds,
  type PartyGroup,
} from './party-builds.ts';
import type { PartyScope } from './party-scope.ts';

/**
 * `catalog:party-scope --status`: the launch measure (owner, 2026-11-10).
 * Per character and in total, the scope's rows by the admission gate's
 * result, held rows by hold reason with what would clear them, the label of
 * admitted rows, and the classes and races dependent omission still drops.
 * Characters by number only.
 */
export type PartyGate = {
  admitted: readonly { externalKey: string }[];
  held: readonly { externalKey: string; reason: string }[];
  dependentOmissions: readonly { externalKey: string; reason: string }[];
  failures: readonly { externalKey: string; reason: string }[];
};
export type PartyStatusInput = {
  builds: PartyBuilds;
  scope: PartyScope;
  gate: PartyGate;
  /** The label each admitted row would carry in a release, by key. */
  labels: ReadonlyMap<string, 'verified' | 'unverified'>;
};
type State = 'admitted' | 'held' | 'omitted' | 'failed' | 'absent';
/**
 * One reason a row is held and what would clear it: the notice codes or hold
 * records it names, a record each such row needs, or (a reason this status
 * doesn't know) nothing.
 */
export type HoldReason =
  | { kind: 'named'; reason: string; clears: readonly [string, ...string[]] }
  | { kind: 'per-row'; reason: string; record: string }
  | { kind: 'unclassified'; reason: string };

const list = (text: string) =>
  text
    .split(/,\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
const named = (
  reason: string,
  items: readonly string[],
): HoldReason | undefined => {
  const [first, ...rest] = items;
  return first === undefined
    ? undefined
    : { kind: 'named', reason, clears: [first, ...rest] };
};

const rules: readonly ((text: string) => HoldReason | undefined)[] = [
  (text) => {
    const match = /named holds kept: (.+?) \(([^)]+)\)\./.exec(text);
    return match ? named('named hold', list(match[1] ?? '')) : undefined;
  },
  (text) => {
    const match =
      /lacks reviewed notices: ([^.]+)\./.exec(text) ??
      /Missing or unreviewed required notices: ([^.]+)\./.exec(text);
    return match
      ? named(
          'notice not reviewed',
          list(match[1] ?? '').map((code) => `notice ${code}`),
        )
      : undefined;
  },
  (text) => {
    const match = /Held under #227: notice holds ([^.]+)\./.exec(text);
    return match
      ? named('notice hold in force', list(match[1] ?? ''))
      : undefined;
  },
  (text) =>
    text.includes('scripted match held:')
      ? {
          kind: 'per-row',
          reason: '#227 scripted match held',
          record: 'a stored assessment or a reviewed #227 exception',
        }
      : undefined,
  (text) =>
    text.includes('scripted match is stale')
      ? named('#227 scripted match stale', [
          'pnpm catalog:attribution-227-matches --write',
        ])
      : undefined,
  (text) =>
    text.includes('gives no required notice')
      ? {
          kind: 'per-row',
          reason: 'no required notice',
          record: 'a stored assessment',
        }
      : undefined,
  (text) =>
    text.includes('Held under #227: reviewed exception:')
      ? {
          kind: 'per-row',
          reason: '#227 reviewed exception holds it',
          record: 'a change to its exception in legal/attribution-227.json',
        }
      : undefined,
  (text) =>
    text.startsWith('missing Attribution Assessment')
      ? {
          kind: 'per-row',
          reason: 'no attribution assessment',
          record: 'a stored assessment',
        }
      : undefined,
  (text) =>
    text.includes('Structure hand review (#716')
      ? {
          kind: 'per-row',
          reason: 'structure hand review (#716)',
          record: 'a structure curation record',
        }
      : undefined,
  // party-gates: what reconciliation would refuse (`reconciliation-holds.ts`).
  (text) => {
    if (!text.includes('Reconciliation refuses it: ')) return undefined;
    if (text.includes('resource discovery accepts no imported'))
      return named('resource discovery refuses imported resources', [
        '#763: discovery accepts companion resources',
      ]);
    if (text.includes('legacy weapon shape'))
      return {
        kind: 'per-row',
        reason: 'legacy weapon profile refused by the candidate adapter',
        record: 'a canonical weapon profile (a shield: slice shield-bash)',
      };
    if (text.includes('not supported by the prepared sheet resolver'))
      return {
        kind: 'per-row',
        reason: 'stored shape refused by the candidate adapter',
        record:
          'a curated stored shape (an item ability: its curation record, #764)',
      };
    return {
      kind: 'per-row',
      reason: 'refused by the candidate adapter',
      record: 'a release body the candidate adapter converts',
    };
  },
  (text) =>
    text.includes('Product Identity: ')
      ? {
          kind: 'per-row',
          reason: 'Product Identity',
          record: 'a reviewed Product Identity decision',
        }
      : undefined,
];

/**
 * The gate's hold text, classified. A review hold may join several reasons
 * (`admission.ts`), so a row can have more than one.
 */
export function holdReasons(text: string): HoldReason[] {
  const reasons = rules.flatMap((rule) => rule(text) ?? []);
  return reasons.length ? reasons : [{ kind: 'unclassified', reason: text }];
}

/** A hold reason and what clears it, as the status prints it. */
export const describeHold = (hold: HoldReason) =>
  hold.kind === 'named'
    ? `${hold.reason}: ${hold.clears.join(', ')}`
    : hold.kind === 'per-row'
      ? `${hold.reason}: needs ${hold.record}`
      : hold.reason;

/** Held rows by reason, most rows first, with what would clear each group. */
function groupHolds(held: readonly { name: string; reason: string }[]) {
  const groups = new Map<
    string,
    {
      rows: number;
      clears: Map<string, number>;
      record?: string;
      names: string[];
    }
  >();
  for (const { name, reason } of held)
    for (const hold of holdReasons(reason)) {
      const group = groups.get(hold.reason) ?? {
        rows: 0,
        clears: new Map<string, number>(),
        names: [],
      };
      group.rows += 1;
      group.names.push(name);
      if (hold.kind === 'named')
        for (const clear of hold.clears)
          group.clears.set(clear, (group.clears.get(clear) ?? 0) + 1);
      if (hold.kind === 'per-row') group.record = hold.record;
      groups.set(hold.reason, group);
    }
  return [...groups]
    .sort(([a, x], [b, y]) => y.rows - x.rows || a.localeCompare(b))
    .map(([reason, { rows, clears, record, names }]) => ({
      reason,
      rows,
      clearedBy: clears.size
        ? [...clears]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([clear, n]) => (n > 1 ? `${clear} (${n} rows)` : clear))
            .join(', ')
        : `${record ?? 'nothing this status knows'} for each: ${names.sort().join(', ')}`,
    }));
}

const groupOrder: readonly PartyGroup[] = [
  'race',
  'racialTraits',
  'classes',
  'archetypes',
  'bloodlinesAndDomains',
  'classFeatures',
  'feats',
  'traits',
  'spells',
  'equipment',
  'companion',
];

type Counts = {
  needed: number;
  admitted: number;
  verified: number;
  unverified: number;
  held: number;
  omitted: number;
  failed: number;
  /** Rows of the scope the gate reports nothing for. */
  absent: number;
  unmatched: number;
  /** Held rows by reason, with what clears them: named codes or records, or a record for each row. */
  heldBy: { reason: string; rows: number; clearedBy: string }[];
  failedBy: { reason: string; rows: string[] }[];
};

export function partyStatus({ builds, scope, gate, labels }: PartyStatusInput) {
  // A row the gate lists as anything but admitted is not admitted, wherever
  // else it is listed: a failure first, then a hold, then an omission.
  const state = new Map<string, { state: State; reason: string }>();
  for (const [rows, kind] of [
    [gate.failures, 'failed'],
    [gate.held, 'held'],
    [gate.dependentOmissions, 'omitted'],
  ] as const)
    for (const { externalKey, reason } of rows)
      if (!state.has(externalKey))
        state.set(externalKey, { state: kind, reason });
  for (const { externalKey } of gate.admitted)
    if (!state.has(externalKey))
      state.set(externalKey, { state: 'admitted', reason: '' });
  const rows = new Map(scope.rows.map((row) => [row.key, row]));
  const stateOf = (key: string) =>
    state.get(key) ?? { state: 'absent' as const, reason: '' };
  const outgoing = new Map<string, string[]>();
  for (const { from, to } of scope.edges)
    outgoing.set(from, [...(outgoing.get(from) ?? []), to]);
  /** The held or failed rows an omitted row is omitted on, through omitted rows. */
  const causes = (key: string) => {
    const found = new Set<string>();
    const seen = new Set([key]);
    const stack = [key];
    while (stack.length) {
      for (const next of outgoing.get(stack.pop() ?? '') ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        const { state } = stateOf(next);
        if (state === 'held' || state === 'failed') found.add(next);
        else if (state === 'omitted') stack.push(next);
      }
    }
    return [...found].sort(
      (a, b) => nameOf(a).localeCompare(nameOf(b)) || (a < b ? -1 : 1),
    );
  };
  const nameOf = (key: string) => rows.get(key)?.name ?? key;
  const describe = (key: string) => {
    const { state, reason } = stateOf(key);
    if (state === 'held')
      return `${nameOf(key)} is held (${holdReasons(reason).map(describeHold).join('; ')})`;
    if (state === 'failed') return `${nameOf(key)} fails (${reason})`;
    if (state === 'omitted')
      return `${nameOf(key)} is omitted on ${causes(key).map(nameOf).join(', ') || 'no held row in the scope'}`;
    if (state === 'absent') return `${nameOf(key)} has no gate result`;
    return `${nameOf(key)} is admitted`;
  };
  const count = (keys: readonly string[], gaps: number): Counts => {
    const counts: Counts = {
      needed: keys.length + gaps,
      admitted: 0,
      verified: 0,
      unverified: 0,
      held: 0,
      omitted: 0,
      failed: 0,
      absent: 0,
      unmatched: gaps,
      heldBy: [],
      failedBy: [],
    };
    const held: { name: string; reason: string }[] = [];
    const failedBy = new Map<string, string[]>();
    for (const key of keys) {
      const { state, reason } = stateOf(key);
      counts[state] += 1;
      if (state === 'admitted')
        counts[labels.get(key) === 'verified' ? 'verified' : 'unverified'] += 1;
      if (state === 'held') held.push({ name: nameOf(key), reason });
      if (state === 'failed')
        failedBy.set(reason, [...(failedBy.get(reason) ?? []), nameOf(key)]);
    }
    counts.heldBy = groupHolds(held);
    counts.failedBy = [...failedBy]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([reason, rows]) => ({ reason, rows: rows.sort() }));
    return counts;
  };
  const characters = [...builds.characters]
    .sort((a, b) => comparePartyIds(a.id, b.id))
    .map((character) => {
      const keys = scope.rows
        .filter(({ characters }) => characters.includes(character.id))
        .map(({ key }) => key);
      const gaps = partyCharacterGaps(character);
      const counts = count(keys, gaps.length);
      const stops = [
        ...partyCharacterKeys(character).map(([group, key]) => ({
          group,
          text: stateOf(key).state === 'admitted' ? undefined : describe(key),
        })),
        ...gaps.map(({ group, name, note }) => ({
          group,
          text:
            group === 'race'
              ? `race not written (${note})`
              : `${name} has no catalog entry (${note})`,
        })),
      ]
        .filter(
          (stop): stop is { group: PartyGroup; text: string } =>
            stop.text !== undefined,
        )
        .sort(
          (a, b) => groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group),
        );
      // A held or failed closure row always omits a root, so a root stops first.
      const closureStop = keys.find((key) => stateOf(key).state !== 'admitted');
      const first = stops[0]?.text ?? (closureStop && describe(closureStop));
      return {
        id: character.id,
        ...counts,
        ready: first === undefined,
        firstStop: first ?? null,
      };
    });
  const distinctGaps = new Set(
    builds.characters.flatMap((character) =>
      partyCharacterGaps(character).map(
        ({ group, name }) => `${group}\0${name}`,
      ),
    ),
  );
  const total = count(
    scope.rows.map(({ key }) => key),
    distinctGaps.size,
  );
  const omitted = scope.rows
    .filter(
      ({ key, kind }) =>
        (kind === 'class' || kind === 'race') &&
        stateOf(key).state !== 'admitted',
    )
    .map(({ key, kind, name, characters }) => ({
      key,
      kind,
      name,
      characters,
      state: stateOf(key).state,
      on:
        stateOf(key).state === 'omitted'
          ? causes(key).map((cause) => describe(cause))
          : [describe(key)],
    }));
  return { scopeVersion: scope.scopeVersion, total, characters, omitted };
}
export type PartyStatus = ReturnType<typeof partyStatus>;

function countLine(counts: Counts) {
  const parts = [
    `${counts.needed} needed`,
    `${counts.admitted} admitted (${counts.verified} verified, ${counts.unverified} unverified)`,
    `${counts.held} held`,
    `${counts.omitted} omitted`,
    `${counts.failed} failed`,
    `${counts.unmatched} unmatched`,
    ...(counts.absent ? [`${counts.absent} without a gate result`] : []),
  ];
  return parts.join(', ');
}

function detailLines(counts: Counts, indent: string) {
  return [
    ...counts.heldBy.map(
      ({ reason, rows, clearedBy }) =>
        `${indent}held, ${reason}: ${rows}; cleared by ${clearedBy}`,
    ),
    ...counts.failedBy.map(
      ({ reason, rows }) => `${indent}failed, ${reason}: ${rows.join(', ')}`,
    ),
  ];
}

export function partyStatusLines(status: PartyStatus) {
  return [
    `Total (each row once): ${countLine(status.total)}`,
    ...detailLines(status.total, '  '),
    status.omitted.length
      ? 'Classes and races not admitted:'
      : 'Classes and races not admitted: none',
    ...status.omitted.map(
      ({ kind, name, characters, state, on }) =>
        `  ${name} (${kind}; ${characters.join(', ')}): ${state}${state === 'omitted' ? ' on' : ''} ${on.join('; ')}`,
    ),
    'Characters:',
    ...status.characters.flatMap((character) => [
      `  ${character.id}: ${countLine(character)}`,
      ...detailLines(character, '    '),
    ]),
    'Ready (every row admitted):',
    ...status.characters.map(({ id, ready, firstStop }) =>
      ready ? `  ${id}: ready` : `  ${id}: not ready: ${firstStop}`,
    ),
  ];
}
