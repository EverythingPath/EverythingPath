import type { CampaignScope } from '~/lib/campaign-scope';

export type CharacterScope<CharacterId extends string = string> =
  Partial<CampaignScope> & {
    characterId: CharacterId;
  };

/** Use the same identity for data retained across incomplete query responses. */
export function characterScopeKey(
  scope: CharacterScope,
  context: readonly unknown[] = [],
) {
  return JSON.stringify([
    scope.characterId,
    scope.campaignId ?? null,
    scope.organizationId ?? null,
    ...context,
  ]);
}
