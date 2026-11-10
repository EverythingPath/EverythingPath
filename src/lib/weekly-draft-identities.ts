import type { StagedActionChoice } from './weekly-draft-facts';

export const recruitedTeamId = (choiceId: string) => `recruit:${choiceId}`;

// These are identities declared by creation choices, not claims that the rules
// have resolved successfully. Partial preparation can refer to earlier choices;
// readiness still checks whether each creation and subsequent use succeeds.
export function declaredChoiceEntities(choice: StagedActionChoice) {
  const result: { team: string[]; item: string[]; cache: string[] } = {
    team: [],
    item: [],
    cache: [],
  };
  if (choice.actionId === 'recruit_team')
    result.team.push(recruitedTeamId(choice.choiceId));
  if ('purchases' in choice)
    for (const purchase of choice.purchases ?? [])
      result.item.push(purchase.itemId);
  if (
    choice.actionId === 'special_order' &&
    choice.mode !== 'enchantment' &&
    choice.itemId
  )
    result.item.push(choice.itemId);
  if (
    choice.actionId === 'secure_cache' &&
    choice.mode === 'place' &&
    choice.cacheId
  )
    result.cache.push(choice.cacheId);
  return result;
}
