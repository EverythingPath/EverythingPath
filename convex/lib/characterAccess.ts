import { characterNotFound } from '../../src/lib/character-not-found';
import { readSelectedCanonicalMilitiaState } from './selectedCanonicalMilitiaState';
import {
  readSelectedCatalogBoundary,
  readSelectedCharacterFacts,
} from './catalogReleaseBoundary';
import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import { getUserByTokenIdentifier, hasAccessToOrg } from '../user';
import type { CampaignScope } from '../../src/lib/campaign-scope';
import {
  maxPreparedCharacters,
  readCharacterSheetData,
} from './characterSheetData';

export async function requireCharacterCampaignAccess(
  ctx: ReadCtx,
  {
    campaignId,
    organizationId,
  }: Pick<CampaignScope, 'campaignId'> &
    Partial<Pick<CampaignScope, 'organizationId'>>,
) {
  const campaign = await ctx.db.get('campaign', campaignId);
  const resolvedOrganizationId = organizationId ?? campaign?.organizationId;
  if (!resolvedOrganizationId)
    throw new ConvexError('No campaign exists for this organization');
  const access = await hasAccessToOrg(ctx, resolvedOrganizationId);
  if (!access) throw new ConvexError('You do not have access to this org');
  if (campaign?.organizationId !== resolvedOrganizationId)
    throw new ConvexError('No campaign exists for this organization');
  return { campaign, access };
}

export async function listAccessibleCharacters(
  ctx: ReadCtx,
  args: Partial<CampaignScope> & { includeInactive?: boolean },
) {
  const { campaignId, organizationId } = args;
  if (!campaignId || !organizationId) return [];
  const access = await hasAccessToOrg(ctx, organizationId);
  if (!access) return [];
  const campaign = await ctx.db.get('campaign', campaignId);
  if (campaign?.organizationId !== organizationId) return [];

  const characters = await ctx.db
    .query('character')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
    .take(4097);
  if (characters.length > 4096)
    throw new ConvexError('Too many Characters to load');
  const visible = args.includeInactive
    ? characters
    : characters.filter((character) => character.isActive);
  if (
    visible.filter((character) => character.sheetMode && campaign.e2eFixture)
      .length > maxPreparedCharacters
  )
    throw new ConvexError('This campaign exceeds the prepared Character limit');
  const militia = await ctx.db
    .query('militia')
    .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
    .unique();
  const source = militia
    ? await readSelectedCanonicalMilitiaState(ctx, militia._id)
    : null;
  const publishedFacts = new Map(
    source?.snapshot.characters.map((facts) => [facts.characterId, facts]) ??
      [],
  );
  // Prepared sheets read the selected release; facts outside the militia
  // projection follow that same boundary.
  const boundary =
    campaign.e2eFixture && visible.some((character) => character.sheetMode)
      ? await readSelectedCatalogBoundary(ctx)
      : undefined;
  return await Promise.all(
    visible.map(
      async (
        character,
      ): Promise<
        Doc<'character'> & {
          ownershipAvailable: boolean;
          racialHitDice?: number;
          classLevels?: {
            entryId: Id<'characterSheetEntry'>;
            position: number;
            name: string;
            classEntryId: Id<'catalogEntry'> | null;
          }[];
        }
      > => {
        const sheet =
          character.sheetMode && campaign.e2eFixture
            ? await readCharacterSheetData(ctx, character)
            : null;
        if (!sheet) {
          const { sheetMode: _sheetMode, ...legacy } = character;
          return {
            ...legacy,
            ownershipAvailable: Boolean(campaign.e2eFixture),
          };
        }
        const selected =
          publishedFacts.get(character._id) ??
          (await readSelectedCharacterFacts(ctx, character._id, boundary))
            ?.facts;
        const facts = selected
          ? Object.fromEntries(
              Object.entries(selected).filter(
                ([key]) => key !== 'characterId' && key !== 'isActive',
              ),
            )
          : (character.sheetPermanentFacts ?? {});
        return {
          ...character,
          ...facts,
          isActive: character.isActive,
          ownershipAvailable: Boolean(campaign.e2eFixture),
          classLevels: sheet.entries
            .filter((entry) => entry.kind === 'classLevel')
            .map((entry) => ({
              entryId: entry._id,
              position: entry.state.position,
              classEntryId: entry.state.classEntryId,
              name:
                entry.state.classEntryId === null
                  ? 'Unspecified Class Level'
                  : (sheet.catalogEntries.find(
                      (definition) =>
                        definition._id === entry.state.classEntryId,
                    )?.name ?? 'Unspecified Class Level'),
            })),
        };
      },
    ),
  );
}

export type CharacterScope = Partial<CampaignScope> & {
  characterId: Id<'character'>;
};

export async function requireScopedCampaignCharacterAccess(
  ctx: ReadCtx,
  args: CharacterScope & Pick<CampaignScope, 'campaignId'>,
) {
  const character = await ctx.db.get('character', args.characterId);
  if (character?.campaignId !== args.campaignId)
    throw new ConvexError(characterNotFound);
  const { campaign, access } = await requireCharacterCampaignAccess(ctx, args);
  return { character, campaign, user: access.user };
}

export async function requireCharacterAccess(
  ctx: ReadCtx,
  args: CharacterScope,
) {
  const character = await ctx.db.get('character', args.characterId);
  if (!character) throw new ConvexError(characterNotFound);
  if (!character.campaignId) {
    const identity = await ctx.auth.getUserIdentity();
    if (
      !identity ||
      character.ownerId !== identity.tokenIdentifier ||
      args.campaignId !== undefined ||
      args.organizationId !== undefined
    )
      throw new ConvexError(characterNotFound);
    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user) throw new ConvexError(characterNotFound);
    return { character, campaign: null, user };
  }
  if (args.campaignId && args.campaignId !== character.campaignId)
    throw new ConvexError(characterNotFound);
  const campaign = await ctx.db.get('campaign', character.campaignId);
  if (!campaign) throw new ConvexError(characterNotFound);
  const isScoped =
    args.organizationId !== undefined || args.campaignId !== undefined;
  const organizationId = args.organizationId ?? campaign.organizationId;
  const access = await hasAccessToOrg(ctx, organizationId);
  if (!access)
    throw new ConvexError(
      isScoped ? 'You do not have access to this org' : characterNotFound,
    );
  if (campaign.organizationId !== organizationId)
    throw new ConvexError('No campaign exists for this organization');
  return { character, campaign, user: access.user };
}

// Legacy ledger writers remain campaign-scoped until cutover.
export async function requireCampaignCharacterAccess(
  ctx: ReadCtx,
  args: CharacterScope,
) {
  const { character } = await requireCharacterAccess(ctx, args);
  if (!character.campaignId) throw new ConvexError(characterNotFound);
  return character;
}

// Movement must call this again in its publication transaction, after any
// preparation. A prior client check never supplies departure authority.
export async function requireCharacterDepartureAccess(
  ctx: ReadCtx,
  args: CharacterScope,
) {
  const access = await requireCharacterAccess(ctx, args);
  if (!access.campaign) throw new ConvexError('Character is not in a campaign');
  if (access.character.ownerId !== access.user.tokenIdentifier)
    throw new ConvexError(
      'Only the current owner can leave or move a Character',
    );
  return access;
}
