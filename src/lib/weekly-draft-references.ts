import { declaredChoiceEntities } from './weekly-draft-identities';
import {
  actionChoiceEvents,
  type StagedActionChoice,
  type eventTargetSchema,
  type eventTreeSchema,
  type persistentDecisionSchema,
} from './weekly-draft-facts';
import type { z } from 'zod';
import type { WeeklyDraft } from './weekly-draft-contract';
import type { UpkeepSnapshot } from './rules-upkeep';

type Target = z.infer<typeof eventTargetSchema>;
export type ReferenceKind = Target['kind'] | 'bonus';
/**
 * One staged or carried reference to an identity the source lacks. `path`
 * names the referring entity as `<owner>:<id>:…` (see
 * `draftReferenceRequirements`); `kind` and `id` are the missing identity.
 */
export type DraftReferenceIssue = {
  kind: ReferenceKind;
  id: string;
  path: string;
};
type ReferenceCheck = (
  kind: ReferenceKind,
  value: string | undefined,
  path: string,
) => void;

function actionReferences(choice: StagedActionChoice, check: ReferenceCheck) {
  const id = choice.choiceId;
  check('team', choice.teamId, `${id}:team`);
  if ('targetTeamId' in choice)
    check('team', choice.targetTeamId, `${id}:target-team`);
  if ('characterId' in choice)
    check('character', choice.characterId, `${id}:character`);
  if ('settlementId' in choice)
    check('settlement', choice.settlementId, `${id}:settlement`);
  if (
    choice.actionId === 'rescue_character' &&
    choice.destination?.kind === 'refuge'
  )
    check('settlement', choice.destination.settlementId, `${id}:refuge`);
  if (choice.actionId === 'secure_cache') {
    if (choice.mode === 'retrieve')
      check('cache', choice.cacheId, `${id}:cache`);
    for (const itemId of choice.itemIds ?? [])
      check('item', itemId, `${id}:item:${itemId}`);
  }
  if (choice.actionId === 'special_order' && choice.mode === 'enchantment')
    check('item', choice.itemId, `${id}:item`);
  if ('sales' in choice)
    for (const itemId of choice.sales ?? [])
      check('item', itemId, `${id}:sale:${itemId}`);
  for (const bonusId of choice.consumableIds ?? [])
    check('bonus', bonusId, `${id}:consumable:${bonusId}`);
}
function targetIdentity(target: Target) {
  switch (target.kind) {
    case 'team':
      return target.teamId;
    case 'character':
      return target.characterId;
    case 'settlement':
      return target.settlementId;
    case 'item':
      return target.itemId;
    case 'cache':
      return target.cacheId;
    case 'event':
      return target.eventId;
  }
}
type OfficerReferences = {
  officerCheck?: { characterId: string };
  overseerCharacterId?: string;
};
function officerReferences(
  value: OfficerReferences,
  check: ReferenceCheck,
  path: string,
) {
  check('character', value.officerCheck?.characterId, `${path}:officer`);
  check('character', value.overseerCharacterId, `${path}:overseer`);
}
function decisionReferences(
  decision: z.infer<typeof persistentDecisionSchema> | undefined,
  check: ReferenceCheck,
) {
  if (decision?.kind === 'mitigate')
    officerReferences(decision, check, `decision:${decision.eventId}`);
}
type EventReferences = Omit<
  Partial<z.infer<typeof eventTreeSchema>[number]>,
  'mitigation' | 'targets'
> & {
  eventId: string;
  targets?: readonly Target[];
};
function eventReferences(events: EventReferences[], check: ReferenceCheck) {
  for (const event of events) {
    const path = `event:${event.eventId}`;
    for (const target of event.targets ?? [])
      check(target.kind, targetIdentity(target), `${path}:${target.kind}`);
    officerReferences(event, check, path);
    decisionReferences(event.persistentDecision, check);
    for (const target of event.targetChecks ?? []) {
      check(
        target.target.kind,
        targetIdentity(target.target),
        `${path}:target-check`,
      );
    }
    if (event.sabotage)
      check('team', event.sabotage.teamId, `${path}:sabotage`);
    for (const reward of event.rewards ?? [])
      check('character', reward.characterId, `${path}:reward`);
  }
}
function contextReferences(draft: WeeklyDraft, check: ReferenceCheck) {
  for (const settlementId of draft.context.operatedSettlementIds ?? [])
    check(
      'settlement',
      settlementId,
      `context:operated-settlement:${settlementId}`,
    );
  for (const order of draft.context.orders) {
    check('item', order.itemId, `order:${order.orderId}:item`);
    check(
      'settlement',
      order.settlementId,
      `order:${order.orderId}:settlement`,
    );
  }
  for (const effect of draft.context.queuedEffects)
    if ('teamId' in effect.effect)
      check('team', effect.effect.teamId, `queue:${effect.effectId}:team`);
}
function preparationReferences(draft: WeeklyDraft, check: ReferenceCheck) {
  check(
    'settlement',
    draft.activity.operatingSettlementId,
    'activity:operating-settlement',
  );
  check(
    'settlement',
    draft.upkeep.nearestSettlementId,
    'upkeep:nearest-settlement',
  );
  for (const bonusId of draft.activity.consumableIds)
    check('bonus', bonusId, `activity:consumable:${bonusId}`);
  for (const decision of draft.upkeep.teamDecisions)
    check('team', decision.teamId, `team:${decision.teamId}`);
  // A character on an older staged transfer is historical metadata, not a
  // reference: an archived or removed character never blocks the week.
}

export function draftReferenceRequirements(
  draft: WeeklyDraft,
  before: UpkeepSnapshot,
  after: UpkeepSnapshot,
) {
  return draftReferenceIssues(draft, before, after).map(
    (issue) => `${issue.path}:reference`,
  );
}

// Every reference of the draft (staged choices, event trees, decisions,
// Table Adjustments and carried context) to an identity missing from the
// source, with that identity. Entities created by staged actions and those
// in `after` count as present.
export function draftReferenceIssues(
  draft: WeeklyDraft,
  before: UpkeepSnapshot,
  after: UpkeepSnapshot,
): DraftReferenceIssue[] {
  const issues: DraftReferenceIssue[] = [];
  const choices = draft.activity.slots.flatMap((slot) =>
    slot.choice ? [slot.choice] : [],
  );
  const events = [
    ...draft.context.carriedEvents,
    ...draft.event.occurrences,
    ...choices.flatMap(actionChoiceEvents),
  ];
  const references: Record<ReferenceKind, Set<string>> = {
    team: new Set(before.roster.teams.map((x) => x.teamId)),
    character: new Set(before.characters.map((x) => x.characterId)),
    settlement: new Set(before.settlements.map((x) => x.settlementId)),
    item: new Set((before.economy?.items ?? []).map((x) => x.itemId)),
    cache: new Set((before.economy?.caches ?? []).map((x) => x.cacheId)),
    event: new Set(events.map((x) => x.eventId)),
    bonus: new Set(before.bonuses.map((x) => x.bonusId)),
  };
  const check: ReferenceCheck = (kind, value, path) => {
    if (value !== undefined && !references[kind].has(value))
      issues.push({ kind, id: value, path });
  };
  contextReferences(draft, check);
  preparationReferences(draft, check);
  for (const choice of choices) {
    actionReferences(choice, check);
    const created = declaredChoiceEntities(choice);
    for (const kind of ['team', 'item', 'cache'] as const)
      for (const id of created[kind]) references[kind].add(id);
  }
  // Preserve intermediate identities even when later actions remove them, and
  // include any additional entities emitted by resolved phase effects.
  for (const team of after.roster.teams) references.team.add(team.teamId);
  for (const item of after.economy?.items ?? [])
    references.item.add(item.itemId);
  for (const cache of after.economy?.caches ?? [])
    references.cache.add(cache.cacheId);
  eventReferences(events, check);
  for (const decision of draft.persistent.decisions)
    decisionReferences(decision, check);
  for (const adjustment of draft.tableAdjustments) {
    if (adjustment.kind === 'team_status')
      check(
        'team',
        adjustment.teamId,
        `adjustment:${adjustment.adjustmentId}:team`,
      );
    if (adjustment.kind === 'settlement_reputation')
      check(
        'settlement',
        adjustment.settlementId,
        `adjustment:${adjustment.adjustmentId}:settlement`,
      );
    if (adjustment.kind === 'event_end')
      check(
        'event',
        adjustment.eventId,
        `adjustment:${adjustment.adjustmentId}:event`,
      );
  }
  return issues;
}
