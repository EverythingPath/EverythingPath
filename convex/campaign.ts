import { requireCatalogCampaignAdmission } from './lib/catalogFixturePolicy';
import { ConvexError, v } from 'convex/values';
import { query } from './_generated/server';
import { campaignMutation as mutation } from './lib/campaignRuntime';
import { campaignValidator } from './schema';
import { hasAccessToOrg } from './user';
import { readOrganizationDeletion } from './lib/organizationDeletion';

export const listNavigationContexts = query({
  args: { organizationId: v.optional(v.string()) },
  returns: v.array(
    v.object({
      campaignId: v.id('campaign'),
      hasMilitia: v.boolean(),
      week: v.optional(v.number()),
    }),
  ),
  async handler(ctx, args) {
    const organizationId = args.organizationId;
    if (!organizationId || !(await hasAccessToOrg(ctx, organizationId)))
      return [];
    const campaigns = await ctx.db
      .query('campaign')
      .withIndex('by_organization', (q) =>
        q.eq('organizationId', organizationId),
      )
      .take(4097);
    if (campaigns.length > 4096)
      throw new ConvexError('Too many campaigns to load');
    return await Promise.all(
      campaigns.map(async (campaign) => {
        const militia = await ctx.db
          .query('militia')
          .withIndex('by_campaign', (q) => q.eq('campaignId', campaign._id))
          .unique();
        const draft = militia
          ? await ctx.db
              .query('canonicalWeeklyDraft')
              .withIndex('by_campaignId_and_status', (q) =>
                q.eq('campaignId', campaign._id).eq('status', 'open'),
              )
              .unique()
          : null;
        return {
          campaignId: campaign._id,
          hasMilitia: militia !== null,
          ...(draft?.draft && draft.militiaId === militia?._id
            ? { week: draft.draft.week }
            : {}),
        };
      }),
    );
  },
});

export const getCampaigns = query({
  args: {
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.organizationId) {
      return { state: 'no_org_selected' as const };
    }
    const organizationId = args.organizationId;

    const hasAccess = await hasAccessToOrg(ctx, organizationId);

    if (!hasAccess) {
      return { state: 'no_access' as const };
    }

    const campaigns = await ctx.db
      .query('campaign')
      .withIndex('by_organization', (q) =>
        q.eq('organizationId', organizationId),
      )
      .collect();

    return { state: 'ready' as const, campaigns };
  },
});

export const createCampaign = mutation({
  args: {
    name: campaignValidator.fields.name,
    description: campaignValidator.fields.description,
    organizationId: campaignValidator.fields.organizationId,
  },
  returns: v.id('campaign'),
  // The caller selects the returned id; names are not unique, so it never
  // needs to find the new campaign by name. Callers that ignore the result
  // keep working.
  async handler(ctx, args) {
    const access = await hasAccessToOrg(ctx, args.organizationId);

    if (!access) {
      throw new ConvexError('You do not have access to this org');
    }

    const organizationDeletion = await readOrganizationDeletion(
      ctx,
      args.organizationId,
    );
    // A blocked deletion is paused, and the organization stays usable.
    if (
      organizationDeletion?.state === 'preparing' ||
      organizationDeletion?.state === 'ready'
    )
      throw new ConvexError('This organization is being deleted');
    await requireCatalogCampaignAdmission(ctx);
    return await ctx.db.insert('campaign', {
      name: args.name,
      ownerId: access.user.tokenIdentifier,
      organizationId: args.organizationId,
      description: args.description,
    });
  },
});

export const updateCampaignInGameDate = mutation({
  args: {
    campaignId: v.id('campaign'),
    organizationId: campaignValidator.fields.organizationId,
    inGameDate: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const access = await hasAccessToOrg(ctx, args.organizationId);

    if (!access) {
      throw new ConvexError('You do not have access to this org');
    }

    const campaign = await ctx.db.get('campaign', args.campaignId);
    if (campaign?.organizationId !== args.organizationId) {
      throw new ConvexError('No campaign exists for this organization');
    }

    await ctx.db.patch('campaign', args.campaignId, {
      inGameDate: args.inGameDate,
    });

    return await ctx.db.get('campaign', args.campaignId);
  },
});

// Independent of the in-game date: a header Save sends each changed field
// through its own mutation, so neither write can undo or overwrite the other.
// An empty string clears the description.
export const updateCampaignDescription = mutation({
  args: {
    campaignId: v.id('campaign'),
    organizationId: campaignValidator.fields.organizationId,
    description: campaignValidator.fields.description,
  },
  async handler(ctx, args) {
    const access = await hasAccessToOrg(ctx, args.organizationId);

    if (!access) {
      throw new ConvexError('You do not have access to this org');
    }

    const campaign = await ctx.db.get('campaign', args.campaignId);
    if (campaign?.organizationId !== args.organizationId) {
      throw new ConvexError('No campaign exists for this organization');
    }

    await ctx.db.patch('campaign', args.campaignId, {
      description: args.description,
    });

    return await ctx.db.get('campaign', args.campaignId);
  },
});
