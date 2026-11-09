import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
import type { ActivityView } from './types';
import { activityLabel } from './activity-labels';
export function activityReferenceOptions(
  choice: StagedActionChoice,
  view: ActivityView,
) {
  const candidates =
    'candidates' in choice
      ? (choice.candidates ?? []).map((event, index) => ({
          value: event.eventId,
          label: `Candidate ${index + 1}: ${activityLabel(event.eventType ?? 'unselected_event')}`,
        }))
      : [];
  return {
    teamId: view.teams,
    targetTeamId: view.teams,
    settlementId: view.settlements,
    characterId: view.people,
    ownerCharacterId: view.people,
    overseerCharacterId: view.people,
    parentEventId: candidates,
    selectedEventId: candidates,
    followingChoiceId: view.slots.flatMap((slot) =>
      slot.choice && slot.choice.choiceId !== choice.choiceId
        ? [
            {
              value: slot.choice.choiceId,
              label: activityLabel(slot.choice.actionId),
            },
          ]
        : [],
    ),
    eventId: view.events,
    itemId: view.items,
    itemIds: view.items,
    sales: view.items,
    consumableIds: view.bonuses,
    cacheId: view.caches,
    automaticSources: view.automaticSources,
    modifierSources: view.modifierSources,
  };
}
export function actionReferenceOptions(
  choice: StagedActionChoice,
  view: ActivityView,
): Record<string, { value: string; label: string; description?: string }[]> {
  const options = activityReferenceOptions(choice, view);
  if (choice.actionId === 'special_order' && choice.mode !== 'enchantment')
    options.itemId = [
      {
        value: choice.itemId ?? crypto.randomUUID(),
        label: 'New ordered item',
      },
    ];
  if (choice.actionId === 'secure_cache' && choice.mode !== 'retrieve')
    options.cacheId = [
      { value: choice.cacheId ?? crypto.randomUUID(), label: 'New cache' },
    ];
  return options;
}
