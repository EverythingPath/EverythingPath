import { api } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { acceptedCampaignSetup } from '../../tests/rules/accepted-campaign';
import { syncOrganizationMemberships } from '../organizationMembership';

export async function seedAcceptedCampaign(
  ctx: MutationCtx & { writeEpoch?: number },
  existingCampaignId?: Id<'campaign'>,
) {
  if (!existingCampaignId) {
    for (const role of ['gm', 'player']) {
      const orgIds = [
        {
          orgId: 'org',
          role: role === 'gm' ? ('admin' as const) : ('member' as const),
        },
      ];
      const userId = await ctx.db.insert('user', {
        tokenIdentifier: `test|${role}`,
        orgIds,
      });
      await syncOrganizationMemberships(ctx, userId, orgIds);
    }
  }
  const campaignId =
    existingCampaignId ??
    (await ctx.db.insert('campaign', {
      name: 'Campaign',
      ownerId: 'gm',
      organizationId: 'org',
      description: '',
    }));
  const characterId = await ctx.db.insert('character', {
    campaignId,
    name: 'Officer',
    ownerId: 'gm',
    kind: 'pc',
    isActive: true,
    level: 12,
    description: 'Retain notes',
    strength: 10,
    dexterity: 11,
    constitution: 12,
    intelligence: 13,
    wisdom: 14,
    charisma: 15,
  });
  const setup = acceptedCampaignSetup(characterId);
  const key: {
    campaignId: Id<'campaign'>;
    militiaId: Id<'militia'>;
    draftId: string;
  } = await ctx.runMutation(api.canonicalSetup.initialize, {
    campaignId,
    writeEpoch: ctx.writeEpoch,
    initializationId: `accepted:${campaignId}`,
    setup,
  });
  return { key, characterId, setup };
}
