import { ConvexError } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import { readWriteGate } from './writeGate';
import { readCampaignDeletion } from './campaignDeletion';

export function isCatalogFixtureCampaign(
  campaign: Pick<Doc<'campaign'>, 'e2eFixture'> | null | undefined,
) {
  return Boolean(campaign?.e2eFixture);
}

/** A global fixture selection must never affect ordinary or private data. */
export async function requireCatalogFixtureIsolation(ctx: ReadCtx) {
  const ordinaryCampaign = await ctx.db
    .query('campaign')
    .withIndex('by_e2eFixture_namespace_and_workerKey_and_caseKey', (q) =>
      q.eq('e2eFixture.namespace', undefined),
    )
    .first();
  const privateCharacter = await ctx.db
    .query('character')
    .withIndex('by_campaignId_and_catalogFixtureCampaignId', (q) =>
      q.eq('campaignId', undefined).eq('catalogFixtureCampaignId', undefined),
    )
    .first();
  if (ordinaryCampaign || privateCharacter)
    throw new ConvexError(
      'Catalog activation on legacy authority requires an isolated fixture deployment without ordinary campaigns or private Characters',
    );
}

export async function requireCatalogActivationAuthority(
  ctx: ReadCtx,
  isFixtureOnly: boolean,
) {
  const gate = await readWriteGate(ctx);
  if (gate?.authority === 'sheet') return;
  if (!isFixtureOnly)
    throw new ConvexError(
      'Catalog activation requires fixture-only mode while migration authority is legacy',
    );
  await requireCatalogFixtureIsolation(ctx);
}

async function hasLegacyFixtureSelection(ctx: ReadCtx) {
  const control = await ctx.db
    .query('catalogReleaseControl')
    .withIndex('by_key', (q) => q.eq('key', 'global'))
    .unique();
  return (
    control?.isFixtureOnly && (await readWriteGate(ctx))?.authority !== 'sheet'
  );
}

export async function requireCatalogCharacterAdmission(
  ctx: ReadCtx,
  args: {
    campaignId?: Doc<'campaign'>['_id'];
    catalogFixtureCampaignId?: Doc<'campaign'>['_id'];
  },
) {
  if (!(await hasLegacyFixtureSelection(ctx))) return;
  const id = args.campaignId ?? args.catalogFixtureCampaignId;
  const campaign = id ? await ctx.db.get('campaign', id) : null;
  // A returned Character keeps naming its fixture campaign after that
  // campaign's deletion, whose record keeps the fixture (#710).
  const deleted = id && !campaign ? await readCampaignDeletion(ctx, id) : null;
  if (!isCatalogFixtureCampaign(campaign ?? deleted))
    throw new ConvexError(
      'This deployment has an active fixture Catalog Release; create Characters in an isolated fixture campaign',
    );
}

export async function requireCatalogCampaignAdmission(ctx: ReadCtx) {
  if (await hasLegacyFixtureSelection(ctx))
    throw new ConvexError(
      'This deployment has an active fixture Catalog Release; ordinary campaigns require a separate deployment',
    );
}
