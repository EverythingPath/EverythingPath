import type { CanonicalResolutionEffects } from '~/lib/canonical-weekly-resolution';
import type { ReviewPhase } from './review-facts';
import {
  count,
  describeValue,
  gp,
  signed,
  signedGp,
  words,
  type ReviewNames,
} from './review-text';

// Pure descriptions of ordered phase-plan entries. Shared by the live Summary
// and frozen Resolution Records: both hold the same plan shapes, so both read
// the same subjects, effects and check details in actual execution order.

export type PlanChange =
  | CanonicalResolutionEffects['upkeep'][number]
  | CanonicalResolutionEffects['activity'][number]
  | CanonicalResolutionEffects['event'][number]
  | CanonicalResolutionEffects['persistent'][number];
export type PlanAcknowledgement = {
  acknowledgementId: string;
  subjectId: string;
  outcome: string;
};
export type DescribedChange = {
  /** Stable grouping key of the consequence this change belongs to. */
  subject: string;
  /** Default title for that consequence when no richer skeleton names it. */
  title: string;
  /** Chip text; null when the change is purely explanatory. */
  effect: string | null;
  /** Check detail or other explanation line. */
  detail: string | null;
  /** The detail states a resolved check, so a bare check total is redundant. */
  resolvesCheck: boolean;
  acknowledgement: PlanAcknowledgement | null;
};
type Described = Omit<DescribedChange, 'acknowledgement' | 'resolvesCheck'>;
const checkKinds = new Set([
  'rescue_result',
  'information',
  'event_capture',
  'event_officer_check',
  'persistent_mitigation',
  'persistent_officer_check',
]);

const statusLabels: Record<string, string> = {
  active: 'Active',
  disabled: 'Disabled',
  missing: 'Missing',
};
export function statusLabel(status: string) {
  return statusLabels[status] ?? words(status);
}
const stepTitles: Record<string, string> = {
  attrition: 'Training attrition',
  notoriety: 'Notoriety',
  shortage: 'Treasury shortage',
};
// A numeric change of zero is not a consequence; its line stays explanatory.
function delta(label: string, value: number, money = false) {
  return value === 0
    ? null
    : `${label} ${money ? signedGp(value) : signed(value)}`;
}
function outcome(succeeded: boolean | null) {
  return succeeded === null
    ? 'awaiting roll'
    : succeeded
      ? 'succeeded'
      : 'failed';
}
function check(label: string, total: number, dc: number, succeeded: boolean) {
  return `${label} ${total} vs DC ${dc} · ${outcome(succeeded)}`;
}
function acknowledgementOf(change: object): PlanAcknowledgement | null {
  // Safe cast: a recorded change is an object; a missing acknowledgement reads
  // undefined.
  const value = (change as { acknowledgement?: unknown }).acknowledgement;
  if (!value || typeof value !== 'object') return null;
  // Safe cast: a non-null object whose fields are type-checked below.
  const ack = value as Partial<PlanAcknowledgement>;
  // Safe cast: the cast branch only runs once every PlanAcknowledgement field
  // is type-checked.
  return typeof ack.acknowledgementId === 'string' &&
    typeof ack.subjectId === 'string' &&
    typeof ack.outcome === 'string'
    ? (ack as PlanAcknowledgement)
    : null;
}

export function choiceSubject(choiceId: string) {
  return `choice:${choiceId}`;
}
export function eventSubject(eventId: string) {
  return `event:${eventId}`;
}
export function teamSubject(teamId: string) {
  return `team:${teamId}`;
}
export function transferSubject(transferId: string) {
  return `transfer:${transferId}`;
}

function described(
  subject: string,
  title: string,
  effect: string | null,
  detail: string | null = null,
): Described {
  return { subject, title, effect, detail };
}

type UpkeepChange = CanonicalResolutionEffects['upkeep'][number];
type ActivityChange = CanonicalResolutionEffects['activity'][number];

/** Recovery pays for a team; theft skims a deposit; otherwise a transfer. */
function describeUpkeepTreasury(
  change: Extract<UpkeepChange, { kind: 'treasury' }>,
  names: ReviewNames,
): Described {
  const amount = change.after - change.before;
  if (change.sourceId.startsWith('recovery:')) {
    const teamId = change.sourceId.slice('recovery:'.length);
    return described(
      teamSubject(teamId),
      names.team(teamId),
      delta('Treasury', amount, true),
    );
  }
  if (change.sourceId.startsWith('theft:')) {
    const [, eventId = '', transferId = ''] = change.sourceId.split(':');
    return described(
      transferSubject(transferId),
      'Treasury transfer',
      `${names.event(eventId)} ${signedGp(amount)}`,
    );
  }
  return described(
    transferSubject(change.sourceId),
    amount >= 0 ? 'Treasury deposit' : 'Treasury withdrawal',
    delta('Treasury', amount, true),
  );
}

function describeUpkeep(change: UpkeepChange, names: ReviewNames): Described {
  switch (change.kind) {
    case 'training':
      return described(
        `upkeep:${change.step}`,
        stepTitles[change.step] ?? words(change.step),
        delta('Training', change.after - change.before),
      );
    case 'settlement_reputation':
      return described(
        'upkeep:notoriety',
        'Notoriety',
        `${names.settlement(change.settlementId)} ${words(change.before)} → ${words(change.after)}`,
      );
    case 'treasury':
      return describeUpkeepTreasury(change, names);
    case 'team_status':
      return described(
        teamSubject(change.teamId),
        names.team(change.teamId),
        `${change.timing === 'start' ? 'Recovered' : 'Returns'} · ${statusLabel(change.status)}`,
      );
    case 'remove_team':
      return described(
        teamSubject(change.teamId),
        names.team(change.teamId),
        'Lost',
      );
    case 'rank':
      return described(
        'upkeep:rank',
        'Rank',
        `Rank ${change.before} → ${change.after}`,
      );
    case 'boon':
      return described(
        change.subjectId,
        `Rank ${change.reward.rank} boon · ${names.character(change.characterId)}`,
        null,
      );
    case 'consume_bonus':
      return described('upkeep:bonuses', 'Check bonuses used', 'Bonus used');
    default:
      return generic(change, 'upkeep', names);
  }
}

/** Who gained and who left an officer role, by role and character. */
function officerChangeText(
  before: readonly { role: string; characterId: string }[],
  after: readonly { role: string; characterId: string }[],
  names: ReviewNames,
) {
  const key = (entry: { role: string; characterId: string }) =>
    `${entry.role}:${entry.characterId}`;
  const had = new Set(before.map(key));
  const has = new Set(after.map(key));
  const lines = [
    ...after
      .filter((entry) => !had.has(key(entry)))
      .map(
        (entry) =>
          `${names.character(entry.characterId)} becomes ${words(entry.role)}`,
      ),
    ...before
      .filter((entry) => !has.has(key(entry)))
      .map(
        (entry) =>
          `${names.character(entry.characterId)} leaves ${words(entry.role)}`,
      ),
  ];
  return lines.join(' · ') || 'Officers unchanged';
}

/** The reputation change, else the names of the other changed fields. */
function settlementChangeText(
  change: Extract<ActivityChange, { kind: 'settlement' }>,
) {
  const { before, after } = change;
  // Safe cast: after is a typed settlement snapshot, so its keys are its own
  // fields.
  const fields = (Object.keys(after) as (keyof typeof after)[]).filter(
    (key) =>
      key !== 'settlementId' &&
      key !== 'name' &&
      JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
  const changed = fields.includes('reputation')
    ? `${words(before.reputation ?? 'unknown')} → ${words(after.reputation ?? 'unknown')}`
    : fields.map((field) => words(field)).join(', ') || 'unchanged';
  return `${after.name} ${changed}`;
}

type Line = { effect: string | null; detail: string | null };
const effectLine = (effect: string | null): Line => ({ effect, detail: null });
const detailLine = (detail: string): Line => ({ effect: null, detail });

/** Militia values, roster and officers changed by an action. */
function militiaActionLine(
  change: ActivityChange,
  names: ReviewNames,
): Line | null {
  switch (change.kind) {
    case 'training':
      return effectLine(delta('Training', change.after - change.before));
    case 'notoriety':
      return effectLine(delta('Notoriety', change.after - change.before));
    case 'treasuryCopper':
      return effectLine(delta('Treasury', change.after - change.before, true));
    case 'recruit_team':
      return effectLine(`Recruits ${change.team.name}`);
    case 'upgrade_team':
      return effectLine(
        `${names.team(change.teamId)} ${words(change.before)} → ${words(change.after)}`,
      );
    case 'remove_team':
      return effectLine(`${names.team(change.teamId)} leaves`);
    case 'end_persistent_event':
      return effectLine(`Ends ${names.event(change.eventId)}`);
    case 'officers':
      return effectLine(officerChangeText(change.before, change.after, names));
    default:
      return null;
  }
}

/** People and settlements affected by an action. */
function peopleActionLine(
  change: ActivityChange,
  names: ReviewNames,
): Line | null {
  switch (change.kind) {
    case 'settlement':
      return effectLine(settlementChangeText(change));
    case 'settlement_benefit':
      return effectLine(
        `${names.settlement(change.settlementId)} ${words(change.benefit)} until week ${change.expiresWeek}`,
      );
    case 'propaganda_attempt':
      return detailLine(
        `Propaganda in ${names.settlement(change.settlementId)}`,
      );
    case 'rescue_result':
      return detailLine(
        `Rescue ${names.character(change.characterId)} · ${check('Check', change.total, change.dc, change.succeeded)}`,
      );
    case 'information':
      return detailLine(
        `Information on ${change.subject} · total ${change.total}${change.achievedDc === null ? '' : ` reaches DC ${change.achievedDc}`} · ${outcome(change.succeeded)}`,
      );
    case 'restoration':
      return effectLine(
        `${words(change.effect)} for ${change.characterIds.map((id) => names.character(id)).join(', ') || 'the party'}`,
      );
    case 'tracked_character':
      return effectLine(
        `${names.character(change.after.characterId)} ${words(change.before.status)} → ${words(change.after.status)}`,
      );
    default:
      return null;
  }
}

/** Assets, markets, covert work and event guarantees from an action. */
function assetActionLine(
  change: ActivityChange,
  names: ReviewNames,
): Line | null {
  switch (change.kind) {
    case 'item':
      return effectLine(
        `${change.after.name} ${change.before ? 'updated' : 'acquired'}`,
      );
    case 'cache':
      return effectLine(
        `Cache at ${change.after.location} ${change.before ? words(change.after.status) : 'established'}`,
      );
    case 'order':
      return effectLine(`Order placed · ${names.item(change.order.itemId)}`);
    case 'market':
      return effectLine(
        `${words(change.market.source)} in ${names.settlement(change.market.settlementId)}`,
      );
    case 'covert_augmentation':
      return effectLine(`Supports another action ${signed(change.bonus)}`);
    case 'covert_site':
      return effectLine(
        `${words(change.mode)} at ${change.location} · weeks ${change.availableWeek}–${change.expiresWeek}`,
      );
    case 'event_guarantee':
      return effectLine(
        change.selectedEventId
          ? `Guarantees ${names.event(change.selectedEventId)}`
          : 'Guarantees an event',
      );
    default:
      return null;
  }
}

/** Activity changes that belong to no single action. */
function describeUnownedActivity(change: ActivityChange): Described | null {
  switch (change.kind) {
    case 'expire_market':
      return described(
        `market:${change.marketId}`,
        'Market closes',
        'Market closes',
      );
    case 'receive_order':
      return described(
        `order:${change.orderId}`,
        'Special order delivered',
        `Received on day ${change.receipt.receivedDay}`,
      );
    case 'consume_bonus':
      return described('activity:bonuses', 'Check bonuses used', 'Bonus used');
    default:
      return null;
  }
}

function describeActivity(
  change: ActivityChange,
  names: ReviewNames,
): Described {
  const unowned = describeUnownedActivity(change);
  if (unowned) return unowned;
  const subject =
    'choiceId' in change && typeof change.choiceId === 'string'
      ? choiceSubject(change.choiceId)
      : null;
  const line =
    militiaActionLine(change, names) ??
    peopleActionLine(change, names) ??
    assetActionLine(change, names);
  if (!line) {
    const fallback = generic(change, 'activity', names);
    return { ...fallback, subject: subject ?? fallback.subject };
  }
  return described(
    subject ?? `activity:${change.kind}`,
    'Action',
    line.effect,
    line.detail,
  );
}

type EventChange = CanonicalResolutionEffects['event'][number];
type PersistentChange = CanonicalResolutionEffects['persistent'][number];

/** What an event did to militia values, teams, people, items and places. */
function eventStateLine(change: EventChange, names: ReviewNames): Line | null {
  switch (change.kind) {
    case 'event_training':
      return effectLine(delta('Training', change.after - change.before));
    case 'event_treasury':
      return effectLine(delta('Treasury', change.after - change.before, true));
    case 'event_team_status':
      return effectLine(
        `${names.team(change.teamId)} ${statusLabel(change.before)} → ${statusLabel(change.after)}`,
      );
    case 'event_team_recovery':
      return effectLine(`${names.team(change.teamId)} Disabled → Active`);
    case 'event_team_loss':
      return effectLine(`${names.team(change.teamId)} lost`);
    case 'event_person':
      return effectLine(
        `${names.character(change.after.characterId)} ${words(change.before.status)} → ${words(change.after.status)}`,
      );
    case 'event_item':
      return effectLine(`${change.item.name} gained`);
    case 'event_identification':
      return effectLine(`${names.item(change.itemId)} identified`);
    case 'event_item_location':
      return effectLine(`${names.item(change.itemId)} ${words(change.after)}`);
    case 'event_cache':
      return effectLine(
        `Cache at ${change.after.location} ${words(change.before.status)} → ${words(change.after.status)}`,
      );
    case 'event_refuge':
      return effectLine(`${names.settlement(change.settlementId)} refuge ends`);
    default:
      return null;
  }
}

/** Checks, lasting effects and narrative records of an event. */
function eventRecordLine(change: EventChange, names: ReviewNames): Line | null {
  switch (change.kind) {
    case 'event_persistent':
      return effectLine('Becomes persistent');
    case 'event_end':
      return effectLine(`Ends ${names.event(change.endedEventId)}`);
    case 'event_activity_bonus':
      return effectLine(`Next Activity ${signed(change.value)}`);
    case 'event_check_bonus':
      return effectLine(
        `${words(change.bonus.check)} ${signed(change.bonus.value)} bonus`,
      );
    case 'event_queue':
      return effectLine(
        `Queued for week ${change.effect.startsWeek}: ${describeValue(change.effect.effect, names)}`,
      );
    case 'event_skill_benefit':
    case 'event_market_benefit':
      return effectLine(describeValue(change.benefit, names));
    case 'event_capture':
      return {
        effect: change.captured
          ? `${names.character(change.characterId)} captured`
          : null,
        detail: `Capture of ${names.character(change.characterId)} · ${change.chance}% chance${change.roll === null ? '' : ` · roll ${change.roll}`} · ${change.captured ? 'captured' : 'escaped'}`,
      };
    case 'event_encounter':
      return detailLine(
        `Encounter CR ${change.challengeRating} for average party level ${change.averagePartyLevel}`,
      );
    case 'event_officer_check':
      return detailLine(
        `${names.character(change.characterId)} · ${check(words(change.skill), change.total, change.dc, change.succeeded)}`,
      );
    case 'event_acknowledgement':
      return effectLine(null);
    default:
      return null;
  }
}

function describeEvent(change: EventChange, names: ReviewNames): Described {
  const subject = eventSubject(change.eventId);
  const title = names.event(change.eventId);
  const line = eventStateLine(change, names) ?? eventRecordLine(change, names);
  if (!line) return { ...generic(change, 'event', names), subject, title };
  return described(subject, title, line.effect, line.detail);
}

const endedReasons: Record<string, string> = {
  buyoff: 'Bought off',
  officer: 'Ended by an officer',
};

function persistentLine(change: PersistentChange): Line | null {
  switch (change.kind) {
    case 'persistent_retained':
      return effectLine('Carries on');
    case 'persistent_ended':
      return {
        effect: 'Ends',
        detail: endedReasons[change.reason] ?? 'Ended as recorded',
      };
    case 'persistent_buyoff':
      return {
        effect: delta('Treasury', change.after - change.before, true),
        detail: `Buyoff costs ${gp(change.costCopper)}`,
      };
    case 'persistent_mitigation':
      return {
        effect: change.succeeded ? 'Mitigated this week' : null,
        detail: check('Mitigation', change.total, change.dc, change.succeeded),
      };
    default:
      return null;
  }
}

function describePersistent(
  change: PersistentChange,
  names: ReviewNames,
): Described {
  if (change.kind === 'upkeep_team_return')
    return described(
      teamSubject(change.teamId),
      names.team(change.teamId),
      `Returns · ${statusLabel(change.status)}`,
    );
  const subject = eventSubject(change.eventId);
  const title = names.event(change.eventId);
  const line =
    change.kind === 'persistent_officer_check'
      ? detailLine(
          `${names.character(change.characterId)} · ${check(words(change.skill), change.total, change.dc, change.succeeded)}`,
        )
      : persistentLine(change);
  if (!line) return { ...generic(change, 'persistent', names), subject, title };
  return described(subject, title, line.effect, line.detail);
}

// Unknown or older entries stay readable through the general fact text.
function generic(
  change: object,
  phase: ReviewPhase,
  names: ReviewNames,
): Described {
  // Safe cast: a recorded change is an object; kind is type-checked before use.
  const kind = (change as { kind?: unknown }).kind;
  // Safe cast: only removes an optional field; the rest is described
  // generically.
  const { acknowledgement: _ignored, ...rest } = change as {
    acknowledgement?: unknown;
  };
  return described(
    `${phase}:other`,
    `Other ${words(phase)} changes`,
    typeof kind === 'string' ? words(kind) : 'Recorded change',
    describeValue(rest, names),
  );
}

// Each phase plan holds its own change shapes; the phase selects the reader.
const describers: Record<
  ReviewPhase,
  (change: PlanChange, names: ReviewNames) => Described
> = {
  // Safe cast: the describers table is keyed by phase, so this one only gets
  // upkeep changes.
  upkeep: (change, names) => describeUpkeep(change as UpkeepChange, names),
  activity: (change, names) =>
    // Safe cast: the describers table is keyed by phase, so this one only gets
    // activity changes.
    describeActivity(change as ActivityChange, names),
  // Safe cast: the describers table is keyed by phase, so this one only gets
  // event changes.
  event: (change, names) => describeEvent(change as EventChange, names),
  persistent: (change, names) =>
    // Safe cast: the describers table is keyed by phase, so this one only gets
    // persistent changes.
    describePersistent(change as PersistentChange, names),
};

export function describeChange(
  phase: ReviewPhase,
  change: PlanChange,
  names: ReviewNames,
): DescribedChange {
  return {
    ...describers[phase](change, names),
    resolvesCheck: checkKinds.has(change.kind),
    acknowledgement: acknowledgementOf(change),
  };
}

/**
 * A frozen record may hold an entry of an older shape that the readers above
 * do not understand; it stays readable through the general fact text rather
 * than breaking the whole record.
 */
export function describeRecordedChange(
  phase: ReviewPhase,
  change: PlanChange,
  names: ReviewNames,
): DescribedChange {
  try {
    return describeChange(phase, change, names);
  } catch {
    return {
      ...generic(change, phase, names),
      resolvesCheck: false,
      acknowledgement: acknowledgementOf(change),
    };
  }
}

export type SabotageFact = CanonicalResolutionEffects['sabotage'][number];
export function sabotageSubject(
  item: Pick<SabotageFact, 'eventId' | 'choiceId'>,
) {
  return `sabotage:${item.eventId}:${item.choiceId}`;
}
/** Reactive Sabotage is described under the occurrence it reacts to. */
export function describeSabotage(item: SabotageFact) {
  return {
    subject: sabotageSubject(item),
    detail:
      item.total === null || item.succeeded === null
        ? `Sabotage check against DC ${item.dc} · awaiting roll`
        : check('Sabotage', item.total, item.dc, item.succeeded),
    effects: [
      ...(item.succeeded ? ['Event negated'] : []),
      ...(item.notoriety ? [`Notoriety ${signed(item.notoriety)}`] : []),
    ],
    acknowledgement: item.acknowledgement,
  };
}

type PlanTally = {
  training: number;
  treasury: number;
  notoriety: number;
  rank: { before: number | null; after: number | null };
  teamsBack: Set<string>;
  teamsDown: Map<string, string>;
  teamsLost: Set<string>;
  recruited: number;
  ended: number;
  persistent: number;
  settlements: Set<string>;
};

/** Adds one plan entry's contribution to the phase's running totals. */
function tallyChange(tally: PlanTally, change: PlanChange) {
  switch (change.kind) {
    case 'training':
    case 'event_training':
      tally.training += change.after - change.before;
      return;
    case 'treasury':
    case 'treasuryCopper':
    case 'event_treasury':
    case 'persistent_buyoff':
      tally.treasury += change.after - change.before;
      return;
    case 'notoriety':
      tally.notoriety += change.after - change.before;
      return;
    case 'rank':
      tally.rank.before ??= change.before;
      tally.rank.after = change.after;
      return;
    case 'team_status':
    case 'upkeep_team_return':
    case 'event_team_recovery':
      tally.teamsBack.add(change.teamId);
      return;
    case 'event_team_status':
      if (change.after === 'active') tally.teamsBack.add(change.teamId);
      else tally.teamsDown.set(change.teamId, change.after);
      return;
    case 'remove_team':
    case 'event_team_loss':
      tally.teamsLost.add(change.teamId);
      return;
    case 'recruit_team':
      tally.recruited += 1;
      return;
    case 'persistent_ended':
    case 'event_end':
    case 'end_persistent_event':
      tally.ended += 1;
      return;
    case 'event_persistent':
      tally.persistent += 1;
      return;
    case 'settlement_reputation':
      tally.settlements.add(change.settlementId);
      return;
    case 'settlement':
      if (change.before.reputation !== change.after.reputation)
        tally.settlements.add(change.after.settlementId);
  }
}

function tallyChips(tally: PlanTally) {
  const down = [...tally.teamsDown.values()];
  const teams = (value: number, suffix: string) =>
    value ? [`${count(value, 'team', 'teams')} ${suffix}`] : [];
  const { rank } = tally;
  return [
    ...(rank.before !== null && rank.before !== rank.after
      ? [`Rank ${rank.before} → ${rank.after}`]
      : []),
    ...(tally.training ? [`Training ${signed(tally.training)}`] : []),
    ...(tally.treasury ? [`Treasury ${signedGp(tally.treasury)}`] : []),
    ...(tally.notoriety ? [`Notoriety ${signed(tally.notoriety)}`] : []),
    ...teams(tally.teamsBack.size, 'back'),
    ...teams(down.filter((status) => status === 'disabled').length, 'disabled'),
    ...teams(down.filter((status) => status === 'missing').length, 'missing'),
    ...teams(tally.teamsLost.size, 'lost'),
    ...teams(tally.recruited, 'recruited'),
    ...(tally.settlements.size
      ? [
          `${count(tally.settlements.size, 'settlement', 'settlements')} changed`,
        ]
      : []),
    ...(tally.persistent
      ? [count(tally.persistent, 'event carries on', 'events carry on')]
      : []),
    ...(tally.ended ? [count(tally.ended, 'event ends', 'events end')] : []),
  ];
}

/**
 * Net phase changes for the section header, from the phase's own plan only
 * (Sabotage's Notoriety is a requested change unless the applied one is given).
 * Table Adjustments are never included: they apply after the Rules Baseline.
 */
export function phaseChips(
  phase: ReviewPhase,
  plan: readonly PlanChange[],
  sabotage: readonly SabotageFact[] = [],
  /** The phase's applied Notoriety change, when known, after its 0–100 limits. */
  appliedNotoriety: number | null = null,
) {
  const tally: PlanTally = {
    training: 0,
    treasury: 0,
    notoriety: 0,
    rank: { before: null, after: null },
    teamsBack: new Set(),
    teamsDown: new Map(),
    teamsLost: new Set(),
    recruited: 0,
    ended: 0,
    persistent: 0,
    settlements: new Set(),
  };
  for (const change of plan) tallyChange(tally, change);
  if (phase === 'event')
    for (const item of sabotage) tally.notoriety += item.notoriety ?? 0;
  if (appliedNotoriety !== null) tally.notoriety = appliedNotoriety;
  return tallyChips(tally);
}

export type TableAdjustment =
  CanonicalResolutionEffects['adjudication']['tableAdjustments'][number];
const adjustmentKinds: Record<string, string> = {
  militia_value: 'Militia value',
  team_status: 'Team condition',
  settlement_reputation: 'Settlement reputation',
  event_end: 'End persistent event',
};
const militiaFields: Record<string, string> = {
  training: 'Training',
  treasuryCopper: 'Treasury',
  notoriety: 'Notoriety',
  rank: 'Rank',
};
/** An ordered Table Adjustment's kind and effect chip. */
export function describeAdjustment(
  adjustment: TableAdjustment,
  names: ReviewNames,
) {
  const kind = adjustmentKinds[adjustment.kind] ?? words(adjustment.kind);
  switch (adjustment.kind) {
    case 'militia_value': {
      const field = militiaFields[adjustment.field] ?? words(adjustment.field);
      const money = adjustment.field === 'treasuryCopper';
      return {
        kind,
        effect:
          adjustment.operation === 'set'
            ? `${field} set to ${money ? gp(adjustment.value) : adjustment.value}`
            : `${field} ${money ? signedGp(adjustment.value) : signed(adjustment.value)}`,
      };
    }
    case 'team_status':
      return {
        kind,
        effect: `${names.team(adjustment.teamId)} → ${statusLabel(adjustment.status)}`,
      };
    case 'settlement_reputation':
      return {
        kind,
        effect: `${names.settlement(adjustment.settlementId)} → ${words(adjustment.reputation)}`,
      };
    case 'event_end':
      return { kind, effect: `Ends ${names.event(adjustment.eventId)}` };
    default:
      return { kind, effect: describeValue(adjustment, names) };
  }
}
