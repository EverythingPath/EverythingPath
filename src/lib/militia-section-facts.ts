import type { CanonicalWeekState } from './canonical-weekly-source';
import { getEffectiveHitDice } from './canonical-roster';
import { formatCharacterKind } from './character-kind';
import type { MilitiaEntryKey } from './militia-correction-sections';
import { BOARD_ROLES, heldRoles, ROLE_LABELS } from './officer-board';

// Read-only presentation of the accepted militia facts, one Militia page
// entry at a time. Values are displayed only; nothing here derives a rule.

type Snapshot = CanonicalWeekState['militiaSnapshot'];
type Context = CanonicalWeekState['context'];

export type FactRow = { label: string; value: string };
export type FactEntry = { key: string; title: string; rows: FactRow[] };
export type FactGroup = {
  key: string;
  /** Absent for the section's only group. */
  title?: string;
  rows: FactRow[];
  entries: FactEntry[];
  /** Shown when the group has neither rows nor entries. */
  empty: string;
};
export type EntryFacts = {
  groups: FactGroup[];
  /** Entries in the section, when it is a list; null for single values. */
  count: number | null;
  /** One line for the wider desktop index. */
  preview: string;
};

/** Character names by identity; unknown characters read as "Unnamed character". */
export type CharacterNames = ReadonlyMap<string, string>;

const words = (value: string) => {
  const text = value.replaceAll('_', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};
const yesNo = (value: boolean | null | undefined, unknown = 'Not recorded') =>
  value === true ? 'Yes' : value === false ? 'No' : unknown;
const gp = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat('en-US');
const money = (copper: number) =>
  `${gp.format(copper / 100)} gp (${whole.format(copper)} cp)`;
const signed = (value: number) => (value > 0 ? `+${value}` : String(value));
const weeks = (start: number, end: number) =>
  start === end ? `Week ${start}` : `Weeks ${start}–${end}`;
const list = (names: string[], none = 'None') =>
  names.length ? names.join(', ') : none;
const optional = (label: string, value: string | null | undefined) =>
  value === null || value === undefined ? [] : [{ label, value }];

function namer(snapshot: Snapshot, characters: CharacterNames) {
  const find = <T>(
    items: readonly T[] | undefined,
    match: (item: T) => boolean,
    name: (item: T) => string,
    missing: string,
  ) => {
    const item = items?.find(match);
    return item ? name(item) : missing;
  };
  return {
    character: (id: string) => characters.get(id) ?? 'Unnamed character',
    team: (id: string) =>
      find(
        snapshot.roster.teams,
        (team) => team.teamId === id,
        (team) => team.name,
        'Missing team',
      ),
    settlement: (id: string) =>
      find(
        snapshot.settlements,
        (town) => town.settlementId === id,
        (town) => town.name,
        'Missing settlement',
      ),
    item: (id: string) =>
      find(
        snapshot.economy?.items,
        (item) => item.itemId === id,
        (item) => item.name,
        'Missing item',
      ),
    cache: (id: string) =>
      find(
        snapshot.economy?.caches,
        (cache) => cache.cacheId === id,
        (cache) => `Cache at ${cache.location}`,
        'Missing cache',
      ),
  };
}
type Names = ReturnType<typeof namer>;

const group = (
  key: string,
  empty: string,
  content: Partial<Pick<FactGroup, 'title' | 'rows' | 'entries'>>,
): FactGroup => ({ key, rows: [], entries: [], empty, ...content });
const listFacts = (
  key: string,
  empty: string,
  entries: FactEntry[],
): EntryFacts => ({
  groups: [group(key, empty, { entries })],
  count: entries.length,
  preview: list(
    entries.map((entry) => entry.title),
    empty,
  ),
});

function values(snapshot: Snapshot): EntryFacts {
  return {
    groups: [
      group('values', '', {
        rows: [
          { label: 'Focus', value: snapshot.focus ?? 'Not set' },
          { label: 'Rank', value: String(snapshot.rank) },
          { label: 'Training', value: String(snapshot.training) },
          { label: 'Treasury', value: money(snapshot.treasuryCopper) },
          { label: 'Notoriety', value: String(snapshot.notoriety) },
        ],
      }),
    ],
    count: null,
    preview: `Focus ${snapshot.focus ?? 'not set'} · Rank ${snapshot.rank} · Training ${snapshot.training}`,
  };
}

function teams(snapshot: Snapshot, names: Names): EntryFacts {
  return listFacts(
    'teams',
    'No teams',
    snapshot.roster.teams.map((team) => ({
      key: team.teamId,
      title: team.name,
      rows: [
        { label: 'Team type', value: words(team.teamType) },
        { label: 'Condition', value: words(team.status) },
        {
          label: 'Manager',
          value: team.managerCharacterId
            ? names.character(team.managerCharacterId)
            : 'None',
        },
        {
          label: 'Reward cap',
          value: team.rewardCapExempt ? 'Exempt' : 'Counts toward the cap',
        },
        ...optional('Notes', team.notes || null),
      ],
    })),
  );
}

function settlements(snapshot: Snapshot): EntryFacts {
  return listFacts(
    'settlements',
    'No settlements',
    snapshot.settlements.map((town) => ({
      key: town.settlementId,
      title: town.name,
      rows: [
        { label: 'Reputation', value: town.reputation ?? 'Not recorded' },
        { label: 'Secured', value: yesNo(town.secured) },
        { label: 'Occupied', value: yesNo(town.occupied) },
        ...optional(
          'Temporary reputation shift',
          town.temporaryReputationShift === null
            ? null
            : signed(town.temporaryReputationShift),
        ),
        ...optional(
          'Reduce Danger',
          town.reduceDangerReputationShift === undefined
            ? null
            : `${signed(town.reduceDangerReputationShift)} until week ${town.reduceDangerUntilWeek}`,
        ),
        ...optional(
          'Refuge activated week',
          town.refugeActivatedWeek === null
            ? null
            : String(town.refugeActivatedWeek),
        ),
        ...optional(
          'Refuge ends week',
          town.refugeActiveUntilWeek === null
            ? null
            : String(town.refugeActiveUntilWeek),
        ),
      ],
    })),
  );
}

function conditions(snapshot: Snapshot, names: Names): EntryFacts {
  return listFacts(
    'characterConditions',
    'No recorded character conditions',
    (snapshot.characterActions?.people ?? []).map((person) => ({
      key: person.characterId,
      title: names.character(person.characterId),
      rows: [
        { label: 'Condition', value: words(person.status) },
        {
          label: 'Location',
          value:
            person.location.kind === 'headquarters'
              ? 'Headquarters'
              : person.location.kind === 'refuge'
                ? `Refuge in ${names.settlement(person.location.settlementId)}`
                : `Elsewhere: ${person.location.location}`,
        },
        { label: 'PCs must rescue', value: yesNo(person.directRescueRequired) },
        ...optional(
          'Captured',
          person.capture
            ? `${person.capture.source === 'raid' ? 'In a raid' : 'Ordinary capture'}, week ${person.capture.week}`
            : null,
        ),
        ...optional('Rescued week', person.rescuedWeek?.toString()),
        ...optional('Restored week', person.restoredWeek?.toString()),
      ],
    })),
  );
}

type Economy = NonNullable<Snapshot['economy']>;
function items(economy: Economy | undefined, names: Names): EntryFacts {
  return listFacts(
    'items',
    'No items',
    (economy?.items ?? []).map((item) => ({
      key: item.itemId,
      title: item.name,
      rows: [
        { label: 'Value', value: money(item.valueCopper) },
        {
          label: 'Owner',
          value: item.ownerCharacterId
            ? names.character(item.ownerCharacterId)
            : 'Militia',
        },
        { label: 'Identified', value: yesNo(item.identified) },
        { label: 'Weight', value: `${item.weight} lb` },
        { label: 'Location', value: words(item.location) },
      ],
    })),
  );
}

function caches(economy: Economy | undefined, names: Names): EntryFacts {
  return listFacts(
    'caches',
    'No caches',
    (economy?.caches ?? []).map((cache) => ({
      key: cache.cacheId,
      title: cache.location,
      rows: [
        { label: 'Class', value: words(cache.cacheClass) },
        { label: 'Status', value: words(cache.status) },
        { label: 'Secure', value: yesNo(cache.secure) },
        { label: 'Extradimensional', value: yesNo(cache.extradimensional) },
        { label: 'Contents', value: list(cache.itemIds.map(names.item)) },
        ...optional(
          'Returns in Activity week',
          cache.returnActivityWeek?.toString(),
        ),
      ],
    })),
  );
}

function orders(economy: Economy | undefined, names: Names): EntryFacts {
  return listFacts(
    'orders',
    'No orders',
    (economy?.orders ?? []).map((order) => ({
      key: order.orderId,
      title: names.item(order.itemId),
      rows: [
        { label: 'Settlement', value: names.settlement(order.settlementId) },
        { label: 'Source', value: words(order.source) },
        { label: 'Kind', value: words(order.mode) },
        {
          label: 'Ordered',
          value: `Week ${order.orderedWeek}, day ${order.orderedDay}`,
        },
        {
          label: 'Due',
          value:
            order.dueDay !== null
              ? `Day ${order.dueDay}`
              : order.dueActivityWeek !== null
                ? `Activity week ${order.dueActivityWeek}`
                : 'Not recorded',
        },
        { label: 'Price', value: money(order.priceCopper) },
        ...optional('Delivery days', order.deliveryDays?.toString()),
        ...optional(
          'Enchantment value',
          order.mode === 'enchantment'
            ? money(order.enchantmentValueCopper)
            : null,
        ),
        {
          label: 'Receipt',
          value: order.receipt
            ? `Received day ${order.receipt.receivedDay}`
            : 'Not received',
        },
      ],
    })),
  );
}

function marketplaces(economy: Economy | undefined, names: Names): EntryFacts {
  return listFacts(
    'marketplaces',
    'No marketplaces',
    (economy?.markets ?? []).map((market) => ({
      key: market.marketId,
      title: `${words(market.source)} · ${names.settlement(market.settlementId)}`,
      rows: [
        {
          label: 'Available',
          value: weeks(market.availableWeek, market.expiresWeek),
        },
        ...optional(
          'Availability',
          market.availability ? words(market.availability) : null,
        ),
        ...optional(
          'Availability percent',
          market.availabilityPercent === null
            ? null
            : `${market.availabilityPercent}%`,
        ),
        ...optional(
          'Sale percent',
          market.salePercent === null ? null : `${market.salePercent}%`,
        ),
        { label: 'Contraband', value: yesNo(market.contraband) },
      ],
    })),
  );
}

function benefits(snapshot: Snapshot, names: Names): EntryFacts {
  const skills = (snapshot.eventBenefits?.skills ?? []).map((benefit) => ({
    key: benefit.benefitId,
    title: `${signed(benefit.value)} ${benefit.bonusType === 'untyped' ? '' : `${benefit.bonusType} `}bonus on ${list(benefit.skills.map(words))}`,
    rows: [
      {
        label: 'Characters',
        value: list(benefit.characterIds.map(names.character), 'Everyone'),
      },
      {
        label: 'Settlement',
        value: benefit.settlementId
          ? names.settlement(benefit.settlementId)
          : 'Any',
      },
      { label: 'After dark only', value: yesNo(benefit.afterDark) },
      { label: 'Active', value: weeks(benefit.startsWeek, benefit.endsWeek) },
    ],
  }));
  const markets = (snapshot.eventBenefits?.markets ?? []).map((benefit) => ({
    key: benefit.benefitId,
    title: `Market Day · ${benefit.discountPercent}% discount`,
    rows: [
      {
        label: 'Settlements',
        value: list(benefit.settlementIds.map(names.settlement)),
      },
      { label: 'Active', value: weeks(benefit.startsWeek, benefit.endsWeek) },
    ],
  }));
  return {
    groups: [
      group('skillBenefits', 'No skill benefits', {
        title: 'Skill benefits',
        entries: skills,
      }),
      group('marketDayBenefits', 'No Market Day benefits', {
        title: 'Market Day benefits',
        entries: markets,
      }),
    ],
    count: skills.length + markets.length,
    preview: list(
      [...skills, ...markets].map((entry) => entry.title),
      'No carried benefits',
    ),
  };
}

type Queued = Context['queuedEffects'][number]['effect'];
function queuedEffect(effect: Queued, names: Names): string {
  switch (effect.kind) {
    case 'check_modifier':
      return `${words(effect.check)} checks ${signed(effect.value)}${effect.phase ? ` in ${words(effect.phase)}` : ''}`;
    case 'upkeep_loss_multiplier':
      return `Upkeep losses ×${effect.value}`;
    case 'activity_training_multiplier':
      return `Activity training ×${effect.value}`;
    case 'event_chance':
      return `Event chance ${signed(effect.value)}%`;
    case 'all_is_calm':
      return 'All is calm';
    case 'automatic_events':
      return `${effect.count} automatic ${effect.count === 1 ? 'event' : 'events'}`;
    case 'block_action':
      return `${words(effect.actionId)} unavailable`;
    case 'team_unavailable':
      return `${names.team(effect.teamId)} unavailable${effect.phase ? ` in ${words(effect.phase)}` : ''}`;
    case 'team_return':
      return `${names.team(effect.teamId)} returns ${effect.status}`;
    case 'narrative':
      return effect.instruction;
  }
}

type Target = Context['carriedEvents'][number]['targets'][number];
function targetName(
  target: Target,
  names: Names,
  eventName: (id: string) => string,
): string {
  switch (target.kind) {
    case 'team':
      return names.team(target.teamId);
    case 'settlement':
      return names.settlement(target.settlementId);
    case 'character':
      return names.character(target.characterId);
    case 'item':
      return names.item(target.itemId);
    case 'cache':
      return names.cache(target.cacheId);
    case 'event':
      return eventName(target.eventId);
  }
}

function weekCarried(state: CanonicalWeekState, names: Names): EntryFacts {
  const { context, week, militiaSnapshot: snapshot } = state;
  const events = [...context.carriedEvents].sort(
    (a, b) =>
      a.startedWeek - b.startedWeek ||
      a.order - b.order ||
      a.eventId.localeCompare(b.eventId),
  );
  const eventNames = new Map(
    events.map((event, index) => [
      event.eventId,
      `${words(event.eventType)} · Event ${index + 1}`,
    ]),
  );
  const eventName = (id: string) => eventNames.get(id) ?? 'Ended event';
  const persistent = events.map((event) => {
    const age = week - event.startedWeek;
    return {
      key: event.eventId,
      title: eventName(event.eventId),
      rows: [
        { label: 'Started', value: `Week ${event.startedWeek}` },
        { label: 'Age', value: `${age} ${age === 1 ? 'week' : 'weeks'}` },
        { label: 'Processing order', value: String(event.order + 1) },
        {
          label: 'Targets',
          value: list(
            event.targets.map((target) => targetName(target, names, eventName)),
            'The militia',
          ),
        },
        ...optional(
          'Mitigation',
          event.mitigation
            ? `Week ${event.mitigation.week}, ${event.mitigation.retainedIncomePercent}% of income retained`
            : null,
        ),
      ],
    };
  });
  const queued = context.queuedEffects.map((queue) => ({
    key: queue.effectId,
    title: queuedEffect(queue.effect, names),
    rows: [
      { label: 'Active', value: weeks(queue.startsWeek, queue.endsWeek) },
      ...optional(
        'From',
        queue.eventType ? words(queue.eventType) : queue.sourceId || null,
      ),
    ],
  }));
  const bonuses = snapshot.bonuses.map((bonus) => ({
    key: bonus.bonusId,
    title: `${signed(bonus.value)} ${bonus.check === 'any' ? 'any check' : bonus.check === 'event_chance' ? 'event chance' : `${words(bonus.check)} check`}`,
    rows: [
      { label: 'Source', value: bonus.source },
      ...optional('Team', bonus.teamId ? names.team(bonus.teamId) : null),
      ...optional('Phase', bonus.phase ? words(bonus.phase) : null),
      ...optional('Available from', bonus.availableWeek?.toString()),
      {
        label: 'Used',
        value:
          bonus.consumedWeek === null
            ? 'Not yet'
            : `Week ${bonus.consumedWeek}`,
      },
    ],
  }));
  return {
    groups: [
      group('week', '', {
        title: 'This week',
        rows: [
          { label: 'Current week', value: String(week) },
          { label: 'Week start day', value: String(context.startDay) },
          {
            label: 'First militia week (skips Upkeep)',
            value: yesNo(context.firstMilitiaWeek),
          },
          {
            label: 'Previous week was uneventful',
            value: yesNo(context.uneventfulCarry),
          },
          {
            label: 'Last persistent buyoff',
            value:
              context.lastBuyoffWeek === null
                ? 'None'
                : `Week ${context.lastBuyoffWeek}`,
          },
        ],
      }),
      group('persistentEvents', 'No carried persistent events', {
        title: 'Persistent events',
        entries: persistent,
      }),
      group('queuedEffects', 'No queued effects', {
        title: 'Queued effects',
        entries: queued,
      }),
      group('bonuses', 'No one-use bonuses', {
        title: 'One-use bonuses',
        entries: bonuses,
      }),
    ],
    count: persistent.length + queued.length + bonuses.length,
    preview: `Week ${week}`,
  };
}

/**
 * The facts Correct officers changes, for each side of its conflict: every
 * role's holders.
 */
export function officerFacts(
  snapshot: Snapshot,
  characters: CharacterNames,
): EntryFacts {
  const names = namer(snapshot, characters);
  return {
    groups: [
      group('officers', '', {
        rows: BOARD_ROLES.map((role) => ({
          label: ROLE_LABELS[role],
          value: list(
            snapshot.roster.officers
              .filter((officer) => officer.role === role)
              .map((officer) => names.character(officer.characterId)),
            'Vacant',
          ),
        })),
      }),
    ],
    count: null,
    preview: '',
  };
}

/**
 * The facts Correct roster changes, for each side of its conflict: each
 * roster person's Hit Dice, roles and managed teams.
 */
export function rosterFacts(
  snapshot: Snapshot,
  characters: CharacterNames,
  rulesetVersion?: number,
): EntryFacts {
  const names = namer(snapshot, characters);
  const entries = snapshot.roster.people.map((person) => {
    const character = snapshot.characters.find(
      (entry) => entry.characterId === person.characterId,
    );
    const roles = heldRoles(snapshot.roster.officers, person.characterId).map(
      (role) => ROLE_LABELS[role],
    );
    const teams = snapshot.roster.teams
      .filter((team) => team.managerCharacterId === person.characterId)
      .map((team) => team.name);
    const effectiveHitDice = character
      ? getEffectiveHitDice(person, character, rulesetVersion)
      : null;
    const hitDice = character
      ? effectiveHitDice === null
        ? 'Unresolved'
        : String(effectiveHitDice)
      : 'Not recorded';
    return {
      key: person.characterId,
      title: names.character(person.characterId),
      rows: [
        { label: 'Kind', value: formatCharacterKind(person.kind) },
        {
          label: 'Hit Dice',
          value: person.hitDice === null ? hitDice : `${hitDice} (override)`,
        },
        { label: 'Officer roles', value: list(roles) },
        { label: 'Manages', value: list(teams) },
      ],
    };
  });
  return listFacts('roster', 'No people on the roster', entries);
}

// The readable facts, count and preview line for one Militia page entry.
export function militiaEntryFacts(
  key: MilitiaEntryKey,
  state: CanonicalWeekState,
  characters: CharacterNames,
): EntryFacts {
  const snapshot = state.militiaSnapshot;
  const names = namer(snapshot, characters);
  switch (key) {
    case 'values':
      return values(snapshot);
    case 'teams':
      return teams(snapshot, names);
    case 'settlements':
      return settlements(snapshot);
    case 'characterConditions':
      return conditions(snapshot, names);
    case 'items':
      return items(snapshot.economy, names);
    case 'caches':
      return caches(snapshot.economy, names);
    case 'orders':
      return orders(snapshot.economy, names);
    case 'marketplaces':
      return marketplaces(snapshot.economy, names);
    case 'carriedBenefits':
      return benefits(snapshot, names);
    case 'weekCarried':
      return weekCarried(state, names);
  }
}
