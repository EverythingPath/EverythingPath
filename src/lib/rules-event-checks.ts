import { RULE_ROLL_SPECS } from './rules-roll-spec';
import type { RollSpec } from './raw-roll';
import { normalizeRawRoll } from './raw-roll';
import { projectRulesFoundations } from './rules-foundations';
import { activityCheckEffects } from './rules-activity';
import type { EventOutcomeProjection } from './rules-event-outcomes';
import type { WeeklyDraft } from './weekly-draft-contract';
import type { EventDispatch } from './rules-event-selection';
type Event = EventDispatch['event'];
type Raw = Event['tableRoll'];

export function eventDie(
  result: Pick<EventOutcomeProjection, 'requirements' | 'warnings'>,
  raw: Raw,
  id: string,
  spec: RollSpec,
) {
  const normalized = normalizeRawRoll(raw, spec);
  if (normalized.status !== 'complete') {
    result.requirements.push(`${id}:${spec.count}d${spec.sides}`);
    return null;
  }
  if (normalized.rangeWarning) result.warnings.push(`${id}:roll-range`);
  return normalized.diceTotal;
}
export function eventCheck(
  draft: WeeklyDraft,
  result: EventOutcomeProjection,
  event: Event,
  check: 'loyalty' | 'secrecy' | 'security',
  raw: Raw,
  id: string,
  phase: 'event' | 'persistent' = 'event',
) {
  draft = {
    ...draft,
    context: {
      ...draft.context,
      carriedEvents: result.persistentEvents,
      queuedEffects: result.queuedEffects,
    },
  };
  const die = eventDie(result, raw, id, RULE_ROLL_SPECS.check);
  const facts = projectRulesFoundations({
    ...result.outcome,
    week: draft.week,
    slots: draft.activity.slots,
    checks: [
      {
        checkId: id,
        eventId: event.eventId,
        phase,
        check,
        die: die ?? undefined,
        overseerCharacterId: event.overseerCharacterId,
        bonusIds: raw?.modifiers.flatMap((modifier) =>
          modifier.sourceId.startsWith('bonus:')
            ? [modifier.sourceId.slice(6)]
            : [],
        ),
      },
    ],
    operatingSettlementId: draft.activity.operatingSettlementId ?? null,
    queuedEffects: activityCheckEffects(draft),
    checkUsage: result.checkUsage,
    activity: result.teamUse,
  });
  result.requirements.push(
    ...facts.requirements.filter(
      (key) =>
        key.startsWith(id) ||
        key.startsWith('officer:') ||
        key === 'rank' ||
        key === 'focus',
    ),
  );
  result.warnings.push(...facts.warnings);
  // Safe cast: `projectChecks` maps each requested check to one projected
  // check, and this Event check is the only one requested above.
  const projected = facts.checks[0]!;
  const known = new Set([
    ...projected.modifiers.map((modifier) => modifier.source),
    ...result.outcome.characters.map((character) => character.characterId),
    ...draft.context.carriedEvents.map((event) => event.eventId),
    ...draft.context.queuedEffects.flatMap((effect) => [
      effect.effectId,
      effect.sourceId,
    ]),
    'rank-focus',
    'officers',
    'overseer-support',
    'helpful',
    'strategist',
  ]);
  for (const modifier of raw?.modifiers ?? []) {
    if (
      known.has(modifier.sourceId) ||
      /^(bonus|queued|officer|manager):/.test(modifier.sourceId)
    )
      continue;
    known.add(modifier.sourceId);
    projected.modifiers.push({
      source: modifier.sourceId,
      value: modifier.value,
    });
    projected.modifier += modifier.value;
    if (projected.total !== null) projected.total += modifier.value;
  }
  result.checks.push(projected);
  result.checkUsage = facts.checkUsage;
  for (const bonusId of result.checkUsage.bonusIds) {
    const bonus = result.outcome.bonuses.find(
      (bonus) => bonus.bonusId === bonusId,
    );
    if (bonus) bonus.consumedWeek = draft.week;
  }
  return die === null || facts.requirements.some((key) => key.startsWith(id))
    ? null
    : projected.total;
}

/**
 * The entered modifiers an Event officer check adds to its skill bonus
 * (Rivalry and Turncoat Twice): every source except a recorded copy of the
 * skill, its bonus or Charisma, each counted once at its latest value.
 */
export function eventOfficerCheckExtras(roll: Raw) {
  const extras = new Map<string, { value: number; reason: string }>();
  for (const modifier of roll?.modifiers ?? [])
    if (!['skill', 'skill-bonus', 'charisma'].includes(modifier.sourceId))
      extras.set(modifier.sourceId, {
        value: modifier.value,
        reason: modifier.reason,
      });
  return [...extras].map(([source, entry]) => ({ source, ...entry }));
}

export function eventMitigationAttempted(
  mitigation: Event['mitigation'],
  roll: Raw,
) {
  return (
    mitigation === 'attempted' ||
    (mitigation !== 'unattempted' && Boolean(roll))
  );
}
export function eventMitigationInput(
  event: Event,
  mode: EventDispatch['mode'] | null,
): 'unavailable' | 'unattempted' | 'attempted' {
  if (event.eventType === 'rivalry' && mode === 'twice')
    return event.officerCheck ? 'attempted' : 'unattempted';
  if (
    !['raid', 'cache_discovered', 'theft'].includes(event.eventType ?? '') ||
    (event.eventType === 'theft' && mode === 'twice')
  )
    return 'unavailable';
  // Raid and Cache Discovered record the choice per person or cache.
  const attempted =
    event.eventType === 'theft'
      ? eventMitigationAttempted(event.mitigation, event.rolls?.check)
      : (event.targetChecks ?? []).some((input) =>
          eventMitigationAttempted(input.mitigation, input.rolls?.check),
        );
  return attempted ? 'attempted' : 'unattempted';
}
