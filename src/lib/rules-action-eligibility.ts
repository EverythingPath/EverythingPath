import type { WeeklyDraft } from './weekly-draft-contract';
import type { StagedActionChoice } from './weekly-draft-facts';

// Both option presentation and resolution use these restrictions. Ending a
// carried event later in the week does not rewrite the affected Activity.
export function actionRestrictions(
  draft: WeeklyDraft,
  choice: StagedActionChoice,
): string[] {
  const queued = draft.context.queuedEffects.some(
    (effect) =>
      effect.startsWeek <= draft.week &&
      draft.week <= effect.endsWeek &&
      effect.effect.kind === 'block_action' &&
      effect.effect.actionId === choice.actionId,
  );
  const doubleAgent =
    choice.actionId === 'secure_cache' &&
    draft.context.carriedEvents.some(
      (event) => event.eventType === 'double_agent',
    );
  return queued || doubleAgent ? ['action-blocked'] : [];
}
