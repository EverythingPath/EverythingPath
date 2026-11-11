import type { Id } from '../../convex/_generated/dataModel';

export type CampaignScope = {
  campaignId: Id<'campaign'>;
  organizationId: string;
};
