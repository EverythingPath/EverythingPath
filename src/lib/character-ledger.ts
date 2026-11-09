import { campaignPath, characterSheetPath } from './campaign-routes';
import type { CampaignScope } from './campaign-scope';
import type { AbilityScores } from './character-sheet';

export const characterMetadataKeys = [
  'name',
  'description',
  'kind',
  'isActive',
] as const;

export function characterLedgerDetails(
  record: AbilityScores & {
    _id: string;
    campaignId?: string;
    level: number;
    sheetMode?: 'militiaOnly' | 'full';
  },
  scope?: CampaignScope,
) {
  return {
    level: record.level,
    scores: {
      strength: record.strength,
      dexterity: record.dexterity,
      constitution: record.constitution,
      intelligence: record.intelligence,
      wisdom: record.wisdom,
      charisma: record.charisma,
    },
    statisticsReadOnly: record.sheetMode === 'full',
    canBuildOut: record.sheetMode === 'militiaOnly',
    sheetHref: record.sheetMode
      ? characterSheetPath(
          record._id,
          scope
            ? {
                href: campaignPath(scope.campaignId, 'officers'),
                organization: {
                  kind: 'organization',
                  id: scope.organizationId,
                },
              }
            : undefined,
        )
      : null,
  };
}
