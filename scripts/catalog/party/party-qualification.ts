import type { GateClass } from '../launch-verification.ts';
import {
  comparePartyIds,
  partyCharacterGaps,
  type PartyBuilds,
  type PartyGroup,
} from './party-builds.ts';
import { exceptionSubject, type PartyException } from './party-exceptions.ts';
import type { PartyScope } from './party-scope.ts';
import { describeHold, holdReasons } from './party-status.ts';

/**
 * The party scope's qualification (party-scope research E; owner,
 * 2026-11-10 §2): every scope row is admitted by the gates as they are, comes
 * out of the build as an entry and has reviewed notices, or is a recorded
 * exception (`party-exceptions.json`); so is every name the builds leave
 * unmatched, and every character's race. Mechanisms, curation records and
 * the verified/unverified label never fail a row. A held, failed, omitted or
 * missing row fails, with the gate's reason and what would clear it.
 */

/** What the gate and the import gave the scope's rows. */
export type PartyGateView = {
  /** The gate's class for each key it assessed (`classifyGate`). */
  classes: ReadonlyMap<string, { gate: GateClass; reason: string }>;
  /** An admitted row's required notices without a reviewed notice, by key. */
  missingNotices: ReadonlyMap<string, readonly string[]>;
  /** Keys the import produced, entries and resources. */
  imported: ReadonlySet<string>;
  /** Applied remaps: a row's release key when it was renamed. */
  remapped: ReadonlyMap<string, string>;
};
/**
 * How far the build got: built; refused after its gates were assessed; or
 * refused before any gate, when its inputs could not be read.
 */
export type PartyBuildState =
  | { stage: 'built'; gate: PartyGateView }
  | { stage: 'refused'; reason: string; gate: PartyGateView }
  | { stage: 'inputs-refused'; reason: string };

export type PartyScopeFinding = { code: string; key: string; reason: string };

type Characters = readonly [string, ...string[]];
export type PartyFailure =
  | 'held'
  | 'failed'
  | 'dependent-omitted'
  | 'retained'
  | 'no-candidate'
  | 'unreviewed-notice'
  | 'unreleased'
  | 'unmatched'
  | 'race-open';
type RowFailure = Exclude<PartyFailure, 'unmatched' | 'race-open'>;
type Row = {
  subject: 'row';
  key: string;
  name: string;
  characters: Characters;
};
type Gap = {
  subject: 'gap';
  group: PartyGroup;
  name: string;
  characters: Characters;
};
export type PartyRowOutcome =
  | (Row & { outcome: 'included'; releaseKey?: string })
  | ((Row | Gap) & { outcome: 'excepted'; exception: string })
  | (Row & {
      outcome: 'failed';
      cause: RowFailure;
      reason: string;
      /** What would clear it, from the gate's hold reason. */
      owner?: string;
      releaseKey?: string;
    })
  | (Gap & {
      outcome: 'failed';
      cause: Extract<PartyFailure, 'unmatched' | 'race-open'>;
      reason: string;
    });
type Failed = Extract<PartyRowOutcome, { outcome: 'failed' }>;

export function qualifyPartyScope({
  scope,
  builds,
  exceptions,
  build,
  findings: scopeFindings = [],
}: {
  scope: PartyScope;
  builds: PartyBuilds;
  exceptions: readonly PartyException[];
  build: PartyBuildState;
  findings?: readonly PartyScopeFinding[];
}) {
  const byKey = new Map<string, PartyException>();
  const byName = new Map<string, PartyException>();
  for (const exception of exceptions)
    if (exception.subject.kind === 'key')
      byKey.set(exception.subject.key, exception);
    else if (exception.subject.kind === 'unmatched')
      byName.set(exception.subject.name, exception);
  const gaps = partyGaps(builds);
  const rows: PartyRowOutcome[] = [
    ...scope.rows.map((row) =>
      exceptRow(
        classifyRow({ subject: 'row', ...pick(row) }, build),
        byKey.get(row.key),
      ),
    ),
    ...gaps.map(({ note, ...gap }): PartyRowOutcome => {
      const exception = gap.group === 'race' ? undefined : byName.get(gap.name);
      if (exception)
        return { ...gap, outcome: 'excepted', exception: exception.reason };
      return gap.group === 'race'
        ? {
            ...gap,
            outcome: 'failed',
            cause: 'race-open',
            reason: 'The builds write no race for this character.',
          }
        : { ...gap, outcome: 'failed', cause: 'unmatched', reason: note };
    }),
  ];
  const findings = [
    ...scopeFindings,
    ...staleExceptions({ exceptions, scope, gaps, build }),
  ];
  const counts = countOutcomes(rows);
  const status =
    findings.length === 0 && counts.failed === 0
      ? ('QUALIFIED' as const)
      : ('FAILED' as const);
  return {
    qualification: {
      status,
      findings,
      counts,
      exceptions: exceptions.map(
        ({ subject, reason, decidedBy, decidedOn }) => ({
          subject: exceptionSubject(subject),
          reason,
          decidedBy,
          decidedOn,
        }),
      ),
      characters: characterOutcomes(builds, rows, build.stage === 'built'),
    },
    rows,
  };
}

const pick = ({ key, name, characters }: PartyScope['rows'][number]) => ({
  key,
  name,
  characters,
});

/** The builds' unmatched names and open races, each once with the characters that need it. */
function partyGaps(builds: PartyBuilds) {
  const gaps = new Map<
    string,
    { group: PartyGroup; name: string; note: string; characters: string[] }
  >();
  for (const character of builds.characters)
    for (const { group, name, note } of partyCharacterGaps(character)) {
      const id = `${group}\0${name}`;
      const gap = gaps.get(id) ?? { group, name, note, characters: [] };
      gap.characters.push(character.id);
      gaps.set(id, gap);
    }
  return [...gaps.values()]
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map(({ group, name, note, characters }) => {
      const [first = '', ...rest] = characters.sort(comparePartyIds);
      return {
        subject: 'gap' as const,
        group,
        name,
        note,
        characters: [first, ...rest] as const,
      };
    });
}

/** A failing row with a recorded exception passes as excepted; an admitted one stays included. */
function exceptRow(
  outcome: PartyRowOutcome,
  exception: PartyException | undefined,
): PartyRowOutcome {
  if (!exception || outcome.outcome !== 'failed' || outcome.subject !== 'row')
    return outcome;
  const { key, name, characters } = outcome;
  return {
    subject: 'row',
    key,
    name,
    characters,
    outcome: 'excepted',
    exception: exception.reason,
  };
}

/** A failing scope row: its cause, the gate's reason and, when known, what clears it. */
const failRow = (
  row: Row,
  failure: {
    cause: RowFailure;
    reason: string;
    owner?: string;
    releaseKey?: string;
  },
): PartyRowOutcome => ({ ...row, outcome: 'failed', ...failure });

/** A row's release key, when an applied remap renamed it. */
const renamedKey = (row: Row, releaseKey: string) =>
  releaseKey === row.key ? {} : { releaseKey };

/** A scope row's outcome: the gate's class for its release key, in this build. */
function classifyRow(row: Row, build: PartyBuildState): PartyRowOutcome {
  if (build.stage === 'inputs-refused')
    return failRow(row, {
      cause: 'unreleased',
      reason: headline(build.reason),
    });
  const releaseKey = build.gate.remapped.get(row.key) ?? row.key;
  const assessed = build.gate.classes.get(releaseKey);
  if (!assessed)
    return failRow(row, {
      cause: 'no-candidate',
      reason: build.gate.imported.has(releaseKey)
        ? 'The gate did not assess this candidate.'
        : 'The release inputs produce no candidate for this row.',
      ...renamedKey(row, releaseKey),
    });
  if (assessed.gate === 'admitted') return admittedRow(row, build, releaseKey);
  // Held, failed, retained or omitted: the gate's class is the cause.
  return failRow(row, {
    cause: assessed.gate,
    reason: assessed.reason,
    ...(assessed.gate === 'held' ? ownerOf(assessed.reason) : {}),
    ...renamedKey(row, releaseKey),
  });
}

/** An admitted row passes only under reviewed notices and in a built release. */
function admittedRow(
  row: Row,
  build: Exclude<PartyBuildState, { stage: 'inputs-refused' }>,
  releaseKey: string,
): PartyRowOutcome {
  const renamed = renamedKey(row, releaseKey);
  const missing = build.gate.missingNotices.get(releaseKey) ?? [];
  if (missing.length)
    return failRow(row, {
      cause: 'unreviewed-notice',
      reason: `Admitted without reviewed notices: ${missing.join(', ')}.`,
      ...renamed,
    });
  if (build.stage === 'refused')
    return failRow(row, {
      cause: 'unreleased',
      reason: headline(build.reason),
      ...renamed,
    });
  return { ...row, outcome: 'included', ...renamed };
}

/** What would clear a hold, when the status knows its reason. */
function ownerOf(reason: string) {
  const known = holdReasons(reason).filter(
    (hold) => hold.kind !== 'unclassified',
  );
  return known.length ? { owner: known.map(describeHold).join('; ') } : {};
}

/** A refusal's headline: the gate's failure detail rides in each row's own reason. */
function headline(reason: string) {
  return reason.split(': ', 1)[0] ?? reason;
}

/**
 * An exception that no longer covers anything: its row is admitted or gone
 * from the scope, or no character's builds leave its name unmatched.
 */
function staleExceptions({
  exceptions,
  scope,
  gaps,
  build,
}: {
  exceptions: readonly PartyException[];
  scope: PartyScope;
  gaps: readonly { group: PartyGroup; name: string }[];
  build: PartyBuildState;
}): PartyScopeFinding[] {
  const keys = new Set(scope.rows.map(({ key }) => key));
  const names = new Set(
    gaps.filter(({ group }) => group !== 'race').map(({ name }) => name),
  );
  const findings: PartyScopeFinding[] = [];
  const stale = (exception: PartyException, reason: string) =>
    findings.push({
      code: 'exception-stale',
      key: exceptionSubject(exception.subject),
      reason,
    });
  for (const exception of exceptions) {
    const { subject } = exception;
    if (subject.kind === 'key') {
      const gate =
        build.stage === 'inputs-refused'
          ? undefined
          : build.gate.classes.get(
              build.gate.remapped.get(subject.key) ?? subject.key,
            )?.gate;
      if (!keys.has(subject.key))
        stale(exception, `${subject.key} is no row of ${scope.scopeVersion}.`);
      else if (gate === 'admitted')
        stale(
          exception,
          `The gate admits ${subject.key}; remove its exception.`,
        );
    } else if (subject.kind === 'unmatched' && !names.has(subject.name))
      stale(
        exception,
        `No character's builds leave ${subject.name} unmatched; remove its exception.`,
      );
  }
  return findings;
}

function countOutcomes(rows: readonly PartyRowOutcome[]) {
  const failedByCause: Record<PartyFailure, number> = {
    held: 0,
    failed: 0,
    'dependent-omitted': 0,
    retained: 0,
    'no-candidate': 0,
    'unreviewed-notice': 0,
    unreleased: 0,
    unmatched: 0,
    'race-open': 0,
  };
  const counts = {
    rows: 0,
    gaps: 0,
    included: 0,
    excepted: 0,
    failed: 0,
    failedByCause,
  };
  for (const row of rows) {
    counts[row.subject === 'row' ? 'rows' : 'gaps']++;
    counts[row.outcome]++;
    if (row.outcome === 'failed') failedByCause[row.cause]++;
  }
  return counts;
}

/**
 * Per character: the rows that fail it and why, rows that fail only because
 * no release was built counted apart, and whether the release serves it.
 */
function characterOutcomes(
  builds: PartyBuilds,
  rows: readonly PartyRowOutcome[],
  isBuilt: boolean,
) {
  return [...builds.characters]
    .map(({ id }) => id)
    .sort(comparePartyIds)
    .map((id) => {
      const failed = rows.filter(
        (row): row is Failed =>
          row.outcome === 'failed' && row.characters.includes(id),
      );
      const failing = failed
        .filter(({ cause }) => cause !== 'unreleased')
        .map((row) => ({
          ...(row.subject === 'row' ? { key: row.key } : {}),
          name: row.name,
          cause: row.cause,
        }));
      const unreleased = failed.length - failing.length;
      return {
        id,
        served: isBuilt && failed.length === 0,
        failing,
        unreleased,
      };
    });
}
