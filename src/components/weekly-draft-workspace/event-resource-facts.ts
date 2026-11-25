import { eventMitigationAttempted } from '~/lib/rules-event-checks';
import { operatedSettlementIds } from '~/lib/rules-event-context';
import {
  eventRewardRecipients,
  HIDDEN_AGENDA_SOURCE,
  isPermittedAlchemicalReward,
} from '~/lib/rules-event-outcomes';
import { cacheSecrecyDc, isDiscoverableCache } from '~/lib/rules-threat-events';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import { checkNames, eventCheckFacts } from './event-check-facts';
import {
  codes,
  eventRank as rank,
  whatHappened,
  type EventPanelContext,
  type EventPanelItem,
} from './event-panel-context';
import {
  carriedNames,
  outcomeLines,
  retainedFields,
  type EventFieldUse,
} from './event-outcome-facts';
import {
  cacheName,
  firstOccurrence,
  targetChoice,
} from './event-target-choice';
import { formatGold, plural } from './week-frame/reference-copy';
import type {
  EventActivityRecalculation,
  EventCacheTarget,
  EventPanel,
  EventResourceFamily,
  EventReward,
  EventRewardFacts,
  EventTargetCard,
} from './types';

type Item = EventPanelItem;
type Occurrence = Item['occurrence'];
type Reward = NonNullable<Occurrence['rewards']>[number];
type Economy = NonNullable<UpkeepSnapshot['economy']>;
type Cache = Economy['caches'][number];
type EconomyItem = Economy['items'][number];
type ResourcePanel = Extract<EventPanel, { family: 'resource' }>;
type First = ReturnType<typeof firstOccurrence>;

const RESOURCE_FAMILIES: readonly EventResourceFamily[] = [
  'broke_the_code',
  'cache_discovered',
  'festival',
  'market_day',
  'found_fire',
  'hidden_agenda',
];

export function isResourceFamily(
  type: string | null,
): type is EventResourceFamily {
  const families: readonly (string | null)[] = RESOURCE_FAMILIES;
  return families.includes(type);
}

const acknowledgementHints: Record<EventResourceFamily, string> = {
  broke_the_code: 'What the PCs learned, and which item they identified.',
  cache_discovered: 'The table’s outcome, in a sentence.',
  festival: 'The table’s outcome, in a sentence.',
  market_day: 'The table’s outcome, in a sentence.',
  found_fire: 'What the box held, and who took what.',
  hidden_agenda: 'The table’s outcome, in a sentence.',
};

// How a Twice relates to its first occurrence, which carries the combined
// effect the engine records for these events. The amounts are the engine's,
// read from the first's outcome lines, never restated here.
const twiceWords: Record<
  EventResourceFamily,
  { twice: string; first: string }
> = {
  broke_the_code: {
    twice: 'the Knowledge (local) bonus increases, listed there',
    first: 'the Knowledge (local) bonus increases, listed here',
  },
  cache_discovered: {
    twice: 'every cache still hidden or planned is discovered here',
    first: 'every other cache still hidden or planned is discovered there',
  },
  festival: {
    twice: 'the morale bonus increases in the same town, listed there',
    first: 'the morale bonus increases, listed here',
  },
  market_day: {
    twice: 'the discount reaches every operated town, listed there',
    first: 'the discount reaches every operated town, listed here',
  },
  found_fire: {
    twice: 'each PC chooses one more item here',
    first: 'each PC chooses one more item there',
  },
  hidden_agenda: {
    twice: 'the Activity bonus increases, listed there',
    first: 'the Activity bonus increases, listed here',
  },
};

// Where each occurrence sits in the week's resolution order.
function resolutionOrder(item: Item, context: EventPanelContext) {
  const dispatch = context.projection?.dispatch ?? [];
  const position = (eventId: string) => {
    const index = dispatch.findIndex(
      (entry) => entry.event.eventId === eventId,
    );
    return index < 0 ? Number.POSITIVE_INFINITY : index;
  };
  const own = position(item.occurrence.eventId);
  return {
    dispatch,
    // Plan entries of events resolved before this one.
    earlier: (context.projection?.plan ?? []).filter(
      (change) => position(change.eventId) < own,
    ),
  };
}

function twinNotes(
  item: Item,
  eventType: EventResourceFamily,
  context: EventPanelContext,
  first: First,
) {
  const id = item.occurrence.eventId;
  if (first && item.mode === 'twice')
    return [`Twice with ${first.label}: ${twiceWords[eventType].twice}.`];
  const twins = resolutionOrder(item, context).dispatch.filter(
    (entry) =>
      entry.firstEventId === id &&
      entry.event.eventId !== id &&
      entry.mode === 'twice',
  );
  if (!twins.length) return [];
  const labels = twins
    .map((entry) => context.eventLabel(entry.event.eventId))
    .join(', ');
  return [`Twice in ${labels}: ${twiceWords[eventType].first}.`];
}

// The militia's economy when this event resolves: after Activity, with the
// items and caches earlier events this week changed.
function economyAt(item: Item, context: EventPanelContext) {
  const economy = context.activity?.outcome.economy ?? null;
  const items: EconomyItem[] = structuredClone(economy?.items ?? []);
  const caches: Cache[] = structuredClone(economy?.caches ?? []);
  for (const change of resolutionOrder(item, context).earlier) {
    if (change.kind === 'event_item') items.push(change.item);
    if (change.kind === 'event_cache') {
      const index = caches.findIndex(
        (cache) => cache.cacheId === change.after.cacheId,
      );
      if (index >= 0) caches[index] = change.after;
    }
  }
  return { items, caches };
}

const cacheStatusWords: Record<Cache['status'], string> = {
  hidden: 'Hidden',
  returning: 'Planned for retrieval',
  retrieved: 'Retrieved',
  lost: 'Lost',
};

/** What Found Fire allows, in the words every reward message uses. */
export const PERMITTED_REWARD =
  'a non-poison alchemical item worth 100 gp or less';
const DUPLICATE_REWARD =
  'This reward matches an item the militia already has. Remove it and add it again.';

// "A cache no longer recorded": a missing cache reference stays visible.
const MISSING_CACHE = {
  label: 'A cache no longer recorded',
  reason:
    'This cache is no longer recorded. Restore it in Militia corrections, clear it or choose another.',
};
const MISSING_ITEM = {
  label: 'An item no longer recorded',
  reason:
    'This item is no longer recorded. Restore it in Militia corrections, clear it or choose another.',
};

/**
 * Broke the Code, Cache Discovered, Festival, Market Day, Found Fire and
 * Hidden Agenda, in base, Twice and repeated modes. Inputs are the ones the
 * engine reads for this mode; outcome lines come from the engine's own
 * changes, with a Twice's combined benefit listed under its first.
 */
export function resourcePanel(
  item: Item,
  eventType: EventResourceFamily,
  context: EventPanelContext,
): ResourcePanel {
  const id = item.occurrence.eventId;
  const first = firstOccurrence(item, context);
  const carriedName = carriedNames(context);
  const parts = familyParts(item, eventType, context);
  const requiresAccount =
    codes(item).has('acknowledgement') ||
    item.changes.some((change) => change.kind === 'event_acknowledgement') ||
    context.draft.acknowledgements.some(
      (entry) => entry.subjectId === `event:${id}`,
    );
  return {
    family: 'resource',
    eventType,
    item: null,
    settlement: null,
    towns: null,
    cache: null,
    caches: [],
    retainedCacheChecks: [],
    rewards: null,
    activity: null,
    ...parts.inputs,
    notes: [...twinNotes(item, eventType, context, first), ...parts.notes],
    whatHappened: requiresAccount
      ? whatHappened(item, context, acknowledgementHints[eventType])
      : null,
    outcomes: outcomeLines(item.changes, context, carriedName),
    partial: item.requirements.some((code) => code.startsWith(`${id}:`)),
    retained: retainedFields(item.occurrence, parts.uses, context, carriedName),
    keep: { targets: [...parts.uses.targets], rolls: [...parts.uses.rolls] },
  };
}

type Parts = {
  inputs: Partial<ResourcePanel>;
  notes: string[];
  uses: EventFieldUse;
};

const NOTHING: EventFieldUse = { targets: [], rolls: [], fields: [] };

function familyParts(
  item: Item,
  eventType: EventResourceFamily,
  context: EventPanelContext,
): Parts {
  switch (eventType) {
    case 'broke_the_code':
      return brokeTheCodeParts(item, context);
    case 'cache_discovered':
      return cacheParts(item, context);
    case 'festival':
    case 'market_day':
      return settlementParts(item, eventType, context);
    case 'found_fire':
      return {
        inputs: { rewards: rewardFacts(item, context) },
        notes: [],
        uses: { targets: [], rolls: [], fields: ['rewards'] },
      };
    case 'hidden_agenda':
      return hiddenAgendaParts(item, context);
  }
}

// Broke the Code: the base occurrence identifies one item; its Twice only
// raises the Knowledge (local) bonus.
function brokeTheCodeParts(item: Item, context: EventPanelContext): Parts {
  if (item.mode === 'twice') return { inputs: {}, notes: [], uses: NOTHING };
  const { has } = codes(item);
  const { items } = economyAt(item, context);
  const owner = (characterId: string | undefined) =>
    characterId ? context.personName(characterId) : null;
  const recorded =
    item.occurrence.targets?.flatMap((target) =>
      target.kind === 'item' ? [target.itemId] : [],
    ) ?? [];
  const offered = items.filter(
    (entry) =>
      !['sold', 'lost'].includes(entry.location) ||
      recorded.includes(entry.itemId),
  );
  // Unidentified items first: those are the ones worth identifying.
  offered.sort(
    (a, b) => Number(Boolean(a.identified)) - Number(Boolean(b.identified)),
  );
  const choice = targetChoice({
    label: 'Item the PCs identify',
    hint: 'One magic item of any caster level.',
    required: has('item'),
    recorded,
    choices: offered.map((entry) => ({
      value: entry.itemId,
      label: entry.name,
      description: [
        entry.identified ? 'Already identified' : 'Unidentified',
        owner(entry.ownerCharacterId)
          ? `held by ${owner(entry.ownerCharacterId)}`
          : itemLocationWords[entry.location],
        formatGold(entry.valueCopper),
      ].join(' · '),
    })),
    name: (itemId) =>
      items.find((entry) => entry.itemId === itemId)?.name ?? null,
    missing: MISSING_ITEM,
  });
  return {
    inputs: { item: choice },
    notes: [],
    uses: { targets: ['item'], rolls: [], fields: [] },
  };
}

const itemLocationWords: Record<EconomyItem['location'], string> = {
  held: 'held',
  cache: 'in a cache',
  order: 'on order',
  returning: 'on its way back',
  enchanting: 'being enchanted',
  sold: 'sold',
  lost: 'lost',
};

// Cache Discovered: the base occurrence discovers one chosen cache; its
// Twice every cache still hidden or planned. Each has its own mitigation.
function cacheParts(item: Item, context: EventPanelContext): Parts {
  const { has } = codes(item);
  const occurrence = item.occurrence;
  const twice = item.mode === 'twice';
  const { items, caches } = economyAt(item, context);
  const eligible = caches.filter(isDiscoverableCache);
  const recorded =
    occurrence.targets?.flatMap((target) =>
      target.kind === 'cache' ? [target.cacheId] : [],
    ) ?? [];
  const itemName = (itemId: string) =>
    items.find((entry) => entry.itemId === itemId)?.name ?? null;
  const card = (cache: Cache): EventTargetCard => ({
    value: cache.cacheId,
    label: cacheName(cache),
    description: cacheDescription(cache, itemName),
  });
  const choice = twice
    ? null
    : targetChoice({
        label: 'Cache that is discovered',
        hint: 'One cache the militia has hidden or planned to retrieve.',
        required: has('cache'),
        recorded,
        choices: eligible.map(card),
        name: (cacheId) => {
          const cache = caches.find((entry) => entry.cacheId === cacheId);
          return cache ? cacheName(cache) : null;
        },
        missing: MISSING_CACHE,
      });
  // A recorded cache already retrieved or lost cannot be discovered.
  if (choice)
    choice.retained = choice.retained.map((entry) =>
      caches.some(
        (cache) => cache.cacheId === entry.value && !isDiscoverableCache(cache),
      )
        ? {
            ...entry,
            reason:
              'Already retrieved or lost, so it cannot be discovered. Clear it or choose another cache.',
          }
        : entry,
    );
  const found = twice
    ? eligible
    : eligible.filter((cache) => cache.cacheId === choice?.selected);
  const inputs = occurrence.targetChecks ?? [];
  const dc = cacheSecrecyDc(rank(context));
  const targets: EventCacheTarget[] = found.map((cache) => {
    const input = inputs.find(
      (entry) =>
        entry.target.kind === 'cache' && entry.target.cacheId === cache.cacheId,
    );
    const checkRoll = input?.rolls?.check;
    const attempted = eventMitigationAttempted(input?.mitigation, checkRoll);
    const checkId = `${occurrence.eventId}:${cache.cacheId}:mitigation`;
    const name = cacheName(cache);
    return {
      cacheId: cache.cacheId,
      name,
      description: cacheDescription(cache, itemName),
      missingItems: cache.itemIds.filter((itemId) => !itemName(itemId)),
      mitigation: attempted ? 'attempted' : 'unattempted',
      explicit: input?.mitigation !== undefined,
      check: eventCheckFacts({
        checkId,
        check: 'secrecy',
        dc,
        target: name,
        mandatory: false,
        projected: context.projection?.checks.find(
          (entry) => entry.checkId === checkId,
        ),
        requirements: item.requirements,
        recorded: checkRoll,
        modifierLabel: context.modifierLabel,
        result: {
          success: 'The PCs retrieve the cache and its contents.',
          failure: 'The cache and its contents are lost.',
        },
      }),
      checkRoll,
    };
  });
  const retainedCacheChecks = inputs.flatMap((entry, index) => {
    const target = entry.target;
    if (
      target.kind === 'cache' &&
      found.some((cache) => cache.cacheId === target.cacheId)
    )
      return [];
    const cache =
      target.kind === 'cache'
        ? caches.find((entry) => entry.cacheId === target.cacheId)
        : undefined;
    return [
      {
        index,
        value: target.kind === 'cache' ? target.cacheId : `entry:${index}`,
        label: cache
          ? cacheName(cache)
          : target.kind === 'cache'
            ? MISSING_CACHE.label
            : 'A check that names no cache',
        reason:
          twice || choice?.selected
            ? 'This event does not discover it. Remove this recorded check.'
            : 'Kept until a cache is chosen.',
      },
    ];
  });
  return {
    inputs: {
      cache: choice,
      caches: targets,
      retainedCacheChecks,
    },
    notes:
      twice && !eligible.length
        ? ['No additional effect: no cache is left hidden or planned.']
        : [],
    uses: {
      targets: twice ? [] : ['cache'],
      rolls: [],
      fields: ['targetChecks', 'overseerCharacterId'],
    },
  };
}

function cacheDescription(
  cache: Cache,
  itemName: (itemId: string) => string | null,
) {
  const contents = cache.itemIds.map(
    (itemId) => itemName(itemId) ?? 'an item no longer recorded',
  );
  return [
    cacheStatusWords[cache.status],
    contents.length ? contents.join(', ') : 'Empty',
  ].join(' · ');
}

// "Action Slot 2 · Recruit Team"
const slotLabel = (slot: EventPanelContext['activitySlots'][number]) =>
  `Action Slot ${slot.number}${slot.actionName ? ` · ${slot.actionName}` : ''}`;

// Where a town's operation this week or earlier comes from, for its card.
// Whether it counts is the engine's `operatedSettlementIds`; these are only
// the reasons shown beside it.
function townSources(
  context: EventPanelContext,
  settlementId: string,
): string[] {
  const draft = context.draft;
  const slots = context.activitySlots;
  const used = new Set(context.activity?.teamUse.usedTeamIds ?? []);
  const week = draft.week;
  return [
    ...(draft.activity.operatingSettlementId === settlementId
      ? ['Operating from this week']
      : []),
    ...slots.flatMap((slot) => {
      const choice = slot.choice;
      return choice &&
        'settlementId' in choice &&
        choice.settlementId === settlementId &&
        choice.teamId &&
        used.has(choice.teamId)
        ? [slotLabel(slot)]
        : [];
    }),
    ...((context.activity?.outcome.economy?.markets ?? []).some(
      (market) =>
        market.settlementId === settlementId &&
        market.availableWeek <= week &&
        market.expiresWeek >= week,
    )
      ? ['Marketplace open this week']
      : []),
    ...((draft.context.operatedSettlementIds ?? []).includes(settlementId)
      ? ['Operated recently']
      : []),
  ];
}

// Festival and Market Day: one operated town each; Festival's Twice keeps
// its first's town, and Market Day's Twice reaches every operated town.
function settlementParts(
  item: Item,
  eventType: 'festival' | 'market_day',
  context: EventPanelContext,
): Parts {
  const { has } = codes(item);
  const towns = context.activity?.outcome.settlements ?? [];
  const operated = new Set(
    context.activity
      ? operatedSettlementIds(context.draft, context.activity)
      : [],
  );
  const card = (settlementId: string, name: string): EventTargetCard => {
    const sources = townSources(context, settlementId);
    return {
      value: settlementId,
      label: name,
      description: operated.has(settlementId)
        ? sources.join(' · ') || 'Operated'
        : 'Not operated recently · needs a Rules Exception',
    };
  };
  const twice = item.mode === 'twice';
  if (twice) {
    if (eventType === 'market_day')
      return {
        inputs: {
          towns: towns
            .filter((town) => operated.has(town.settlementId))
            .map((town) => card(town.settlementId, town.name)),
        },
        notes: [],
        uses: NOTHING,
      };
    // Festival Twice reads its first's town; a town recorded here is
    // unused, and a different one is an error the engine names.
    return { inputs: {}, notes: [], uses: NOTHING };
  }
  const recorded =
    item.occurrence.targets?.flatMap((target) =>
      target.kind === 'settlement' ? [target.settlementId] : [],
    ) ?? [];
  const choices = [...towns]
    .sort(
      (a, b) =>
        Number(operated.has(b.settlementId)) -
        Number(operated.has(a.settlementId)),
    )
    .map((town) => card(town.settlementId, town.name));
  const settlement = targetChoice({
    label:
      eventType === 'festival'
        ? 'Town that celebrates'
        : 'Town with the Market Day',
    hint:
      eventType === 'festival'
        ? 'A town the militia recently operated out of.'
        : 'A town a militia team operated in (PCs’ choice).',
    required: has('settlement'),
    recorded,
    choices,
    name: context.settlementName,
    missing: {
      label: 'A settlement no longer in this campaign',
      reason:
        'This settlement is no longer in the campaign. Clear it or choose another.',
    },
  });
  return {
    inputs: { settlement },
    notes: [],
    uses: { targets: ['settlement'], rolls: [], fields: [] },
  };
}

// Found Fire's rewards, grouped by the PC who receives them.
function rewardFacts(item: Item, context: EventPanelContext): EventRewardFacts {
  const { has } = codes(item);
  const state = context.activity?.outcome ?? context.projection?.outcome;
  const pcs = state ? eventRewardRecipients(state) : [];
  // A blank recorded name reads as unnamed too.
  const named = (characterId: string, fallback: string) => {
    const recorded = context.personName(characterId)?.trim() ?? '';
    return recorded === '' ? fallback : recorded;
  };
  const name = (characterId: string) => named(characterId, 'Unnamed character');
  const rewards = item.occurrence.rewards ?? [];
  const facts = (reward: Reward): EventReward => {
    const recorded = context.draft.rulesExceptions.find(
      (entry) =>
        entry.subjectId === reward.itemId &&
        entry.ruleId === 'alchemical-reward',
    );
    const permitted = isPermittedAlchemicalReward(reward);
    const isPc = pcs.includes(reward.characterId);
    return {
      ...reward,
      recipient: isPc
        ? name(reward.characterId)
        : `${named(reward.characterId, 'A character')} (not an active PC)`,
      description: [
        formatGold(reward.valueCopper),
        `${reward.weight} lb`,
        reward.alchemical ? 'alchemical' : 'not alchemical',
        ...(reward.poison ? ['poison'] : []),
      ].join(' · '),
      permitted,
      exception:
        recorded ??
        (permitted
          ? null
          : {
              exceptionId: `event:${reward.itemId}:alchemical-reward`,
              subjectId: reward.itemId,
              ruleId: 'alchemical-reward',
              reason: '',
            }),
      exceptionRequired: has(`reward:${reward.itemId}:exception`),
      issues: [
        ...(isPc
          ? []
          : [
              'Only an active PC receives a reward. Give it to a PC or remove it.',
            ]),
        ...(has(`reward:${reward.itemId}:duplicate`) ? [DUPLICATE_REWARD] : []),
      ],
    };
  };
  return {
    recipients: pcs.map((characterId) => {
      const own = rewards.filter(
        (reward) => reward.characterId === characterId,
      );
      return {
        characterId,
        name: name(characterId),
        required: has(`reward:${characterId}`),
        issue:
          own.length > 1
            ? `Only one reward counts for each PC here. Remove ${plural(own.length - 1, 'reward')}.`
            : null,
        rewards: own.map(facts),
      };
    }),
    others: rewards
      .filter((reward) => !pcs.includes(reward.characterId))
      .map(facts),
    choices: pcs.map((characterId) => ({
      value: characterId,
      label: name(characterId),
    })),
  };
}

// Hidden Agenda: the Activity checks its bonus recalculates, and what
// Activity still needs for them.
function hiddenAgendaParts(item: Item, context: EventPanelContext): Parts {
  if (item.mode === 'twice') return { inputs: {}, notes: [], uses: NOTHING };
  const change = item.changes.find(
    (entry) => entry.kind === 'event_activity_bonus',
  );
  const bonus = change?.kind === 'event_activity_bonus' ? change.value : null;
  if (bonus === null) return { inputs: {}, notes: [], uses: NOTHING };
  const source = `queued:${HIDDEN_AGENDA_SOURCE}`;
  const results = context.activity?.actionResults ?? [];
  const checks = context.activitySlots.flatMap((slot) => {
    const check = slot.check;
    const applied = check?.breakdown.find((entry) => entry.source === source);
    if (!check || !applied || !slot.choice) return [];
    const choiceId = slot.choice.choiceId;
    // The engine's result, or the check row's own comparison while the
    // action still waits for other inputs.
    const succeeded =
      results.find((entry) => entry.choiceId === choiceId)?.succeeded ??
      (check.total !== null && check.dc !== null
        ? check.total >= check.dc
        : null);
    const name = check.organizationCheck
      ? `${checkNames[check.organizationCheck]} check`
      : 'Check';
    const team = slot.team?.name ? ` · ${slot.team.name}` : '';
    const against = check.dc === null ? '' : ` vs DC ${check.dc}`;
    const result =
      check.total === null
        ? `${name}${against}: the total follows once its roll is in (includes Hidden Agenda +${applied.value}).`
        : `${name} ${check.total}${against} (includes Hidden Agenda +${applied.value})${succeeded === null ? '' : `: ${succeeded ? 'success' : 'failure'}`}.`;
    return [
      {
        slotId: slot.slotId,
        label: `${slotLabel(slot)}${team}`,
        result,
        decided:
          check.total !== null &&
          check.dc !== null &&
          check.total >= check.dc &&
          check.total - applied.value < check.dc,
        issues: slot.issues
          .filter((issue) => slot.requirements.includes(issue.code))
          .map((issue) => issue.message),
      },
    ];
  });
  const activity: EventActivityRecalculation = {
    bonus,
    checks,
    pending: !(context.activity?.ready ?? false),
    cycle: (context.projection?.requirements ?? []).includes(
      'event:hidden-agenda-cycle',
    ),
  };
  return {
    inputs: { activity },
    notes: checks.length
      ? []
      : ['No Activity check this week, so nothing is recalculated.'],
    uses: NOTHING,
  };
}

/**
 * Event-identified wording for a code of one of these events; null leaves
 * it to the general wording. `tail` is the code after `<eventId>:`.
 */
export function resourcePanelMessage(
  panel: ResourcePanel,
  tail: string,
  warning: boolean,
): string | null {
  switch (tail) {
    case 'item':
      return 'choose the item the PCs identify.';
    case 'cache':
      return 'choose the cache that is discovered.';
    case 'mitigation-target':
      return 'a recorded Secrecy check names a cache this event does not discover. Remove it.';
    case 'settlement':
      if (panel.eventType === 'market_day' && panel.towns)
        return 'no town counts as operated this week, so the discount reaches none. Record where the militia operated in Activity.';
      if (panel.eventType === 'festival' && !panel.settlement)
        return 'the town is chosen with the first Festival. Choose it there.';
      return `choose the ${panel.settlement?.label.toLowerCase() ?? 'town'}.`;
    case 'same-settlement':
      return 'a different town is recorded here than with the first Festival. Clear it.';
    case 'event-settlement':
      return 'the town is not one the militia operated from recently.';
    case 'event-settlement:exception':
      return warning
        ? 'the town is not one the militia operated from recently.'
        : 'the town is not one the militia operated from recently. Record a reasoned Rules Exception or choose another town.';
    case 'alchemical-reward':
      return `a reward is not ${PERMITTED_REWARD}.`;
  }
  const rewards = panel.rewards;
  const reward = /^reward:(.+?)(?::(recipient|exception|duplicate))?$/.exec(
    tail,
  );
  if (reward && rewards) {
    const [, subject, kind] = reward;
    const all = [
      ...rewards.recipients.flatMap((entry) => entry.rewards),
      ...rewards.others,
    ];
    const named = all.find((entry) => entry.itemId === subject)?.name;
    if (kind === 'exception')
      return `${named ?? 'a reward'} is not ${PERMITTED_REWARD}. Record a reasoned Rules Exception beside it or change it.`;
    if (kind === 'duplicate')
      return `${named ?? 'a reward'}: ${DUPLICATE_REWARD.toLowerCase()}`;
    if (kind === 'recipient')
      return 'a reward goes to someone who is not an active PC. Give it to a PC or remove it.';
    const recipient = rewards.recipients.find(
      (entry) => entry.characterId === subject,
    );
    const name = recipient?.name ?? 'each PC';
    return recipient && recipient.rewards.length > 1
      ? `keep one reward for ${name}.`
      : `record the reward for ${name}.`;
  }
  const cache = /^(.+):mitigation:(roll|\d+d\d+)$/.exec(tail);
  if (cache) {
    const target = panel.caches.find((entry) => entry.cacheId === cache[1]);
    return `enter the Secrecy check for the ${target?.name.replace(/^./, (letter) => letter.toLowerCase()) ?? 'cache'} (d20).`;
  }
  const contents = /^cache:(.+?):item(?:s|:.+)$/.exec(tail);
  if (contents) {
    const target = panel.caches.find((entry) => entry.cacheId === contents[1]);
    return `${target?.name ?? 'The cache'} holds an item no longer recorded. Restore it in Militia corrections before the cache resolves.`;
  }
  return null;
}
