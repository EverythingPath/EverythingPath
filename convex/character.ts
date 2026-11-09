import { readSelectedCanonicalMilitiaState } from './lib/selectedCanonicalMilitiaState';
import { ConvexError, v, type Infer } from 'convex/values';
import {
  paginationOptsValidator,
  paginationResultValidator,
} from 'convex/server';
import { query } from './_generated/server';
import { legacyCharacterMutation as mutation } from './lib/campaignRuntime';
import { updateCanonicalCharacter } from './lib/canonicalCharacters';
import schema, {
  campaignValidator,
  catalogImpactFactsValidator,
  characterValidator,
} from './schema';
import { getUserByTokenIdentifier, hasAccessToOrg } from './user';
import {
  listAccessibleCharacters,
  requireCampaignCharacterAccess,
  requireCharacterCampaignAccess,
  requireScopedCampaignCharacterAccess,
} from './lib/characterAccess';
import {
  initializeCharacterSheet,
  pruneWarningAcceptancesAndRecordChange,
  loadCharacterSheet,
  loadCharacterSheetFromAccess,
  requireFixtureCampaign,
  updateCharacterArchive,
} from './lib/characterSheet';
import { reconcileCompanionRelationships } from './lib/companionRelationships';
import { normalizeCharacterKind } from '../src/lib/character-kind';
import { editMilitiaOnlySheet } from './lib/characterMilitiaOnlySheet';
import { characterMetadataKeys } from '../src/lib/character-ledger';
import { requireWholeCharacterStatistics } from './lib/militiaCharacterFacts';
import {
  characterOwnerValidator,
  projectOwner,
  readCampaignCharacterOwners,
  readCharacterOwners,
} from './lib/characterOwnership';

export const listOwnerCandidates = query({
  args: {
    campaignId: v.id('campaign'),
    organizationId: v.optional(campaignValidator.fields.organizationId),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(characterOwnerValidator),
  async handler(ctx, args) {
    const { campaign, access } = await requireCharacterCampaignAccess(ctx, {
      campaignId: args.campaignId,
      organizationId: args.organizationId,
    });
    requireFixtureCampaign(
      campaign,
      "Owner assignment isn't available for this campaign yet.",
    );
    if (
      !Number.isSafeInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    )
      throw new ConvexError('Choose a member page size from 1 to 100');
    const page = await ctx.db
      .query('organizationMembership')
      .withIndex('by_organizationId_and_userId', (q) =>
        q.eq('organizationId', campaign.organizationId),
      )
      .paginate({
        ...args.paginationOpts,
        maximumRowsRead: Math.min(
          args.paginationOpts.maximumRowsRead ?? 100,
          100,
        ),
      });
    const candidates = await Promise.all(
      page.page.map(async (membership) => {
        const user = await ctx.db.get('user', membership.userId);
        return user?.orgIds.some((org) => org.orgId === campaign.organizationId)
          ? projectOwner(user, access.user.tokenIdentifier)
          : null;
      }),
    );
    return {
      ...page,
      page: candidates.filter((candidate) => candidate !== null),
    };
  },
});

export const reassignOwner = mutation({
  args: {
    characterId: v.id('character'),
    campaignId: v.id('campaign'),
    organizationId: v.optional(campaignValidator.fields.organizationId),
    ownerUserId: v.id('user'),
    operationId: v.string(),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const access = await requireScopedCampaignCharacterAccess(ctx, args);
    const { character, campaign } = access;
    requireFixtureCampaign(
      campaign,
      "Owner assignment isn't available for this campaign yet.",
    );
    const recipient = await ctx.db.get('user', args.ownerUserId);
    if (!recipient?.orgIds.some((org) => org.orgId === campaign.organizationId))
      throw new ConvexError('Choose a current campaign member');
    const sheet = character.sheetMode
      ? await loadCharacterSheetFromAccess(ctx, access, { isWritable: true })
      : null;
    await ctx.db.patch('character', character._id, {
      ownerId: recipient.tokenIdentifier,
      ownerLastOperationId: args.operationId,
    });
    if (sheet) {
      sheet.character = {
        ...sheet.character,
        ownerId: recipient.tokenIdentifier,
        ownerLastOperationId: args.operationId,
      };
      await pruneWarningAcceptancesAndRecordChange(ctx, {
        sheet,
        operationId: args.operationId,
      });
    } else
      await reconcileCompanionRelationships(ctx, {
        characterId: character._id,
        operationId: args.operationId,
      });
    return null;
  },
});

// Sheet Characters carry their Militia Character Facts over the stored
// fields, so the list shape follows the schema's facts validator.
const {
  characterId: _characterId,
  isActive: _isActive,
  ...militiaCharacterFactFields
} = catalogImpactFactsValidator.fields;
const militiaCharacterValidator = schema.doc('character').extend({
  ...militiaCharacterFactFields,
  ownershipAvailable: v.boolean(),
  classLevels: v.optional(
    v.array(
      v.object({
        entryId: v.id('characterSheetEntry'),
        position: v.number(),
        name: v.string(),
        classEntryId: v.union(v.id('catalogEntry'), v.null()),
      }),
    ),
  ),
});

const ownedGroupValidator = v.union(
  v.object({
    kind: v.literal('noCampaign'),
    characters: v.array(schema.doc('character')),
  }),
  v.object({
    kind: v.literal('campaign'),
    campaignId: v.id('campaign'),
    campaignName: v.string(),
    organizationId: v.string(),
    characters: v.array(schema.doc('character')),
  }),
);

export const listOwned = query({
  args: {},
  returns: v.array(ownedGroupValidator),
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user) return [];
    const owned = await ctx.db
      .query('character')
      .withIndex('by_ownerId_and_campaignId', (q) =>
        q.eq('ownerId', identity.tokenIdentifier),
      )
      .take(4097);
    if (owned.length > 4096)
      throw new ConvexError('Too many Characters to load');
    const privateGroup: Infer<typeof ownedGroupValidator> = {
      kind: 'noCampaign',
      characters: [],
    };
    const campaignGroups = new Map<
      string,
      Extract<Infer<typeof ownedGroupValidator>, { kind: 'campaign' }>
    >();
    for (const character of owned) {
      if (!character.campaignId) {
        privateGroup.characters.push(character);
        continue;
      }
      const existing = campaignGroups.get(character.campaignId);
      if (existing) {
        existing.characters.push(character);
        continue;
      }
      const campaign = await ctx.db.get('campaign', character.campaignId);
      if (!campaign || !(await hasAccessToOrg(ctx, campaign.organizationId)))
        continue;
      campaignGroups.set(campaign._id, {
        kind: 'campaign',
        campaignId: campaign._id,
        campaignName: campaign.name,
        organizationId: campaign.organizationId,
        characters: [character],
      });
    }
    const groups = [...campaignGroups.values()].sort(
      (a, b) =>
        a.campaignName.localeCompare(b.campaignName) ||
        a.organizationId.localeCompare(b.organizationId) ||
        a.campaignId.localeCompare(b.campaignId),
    );
    return [privateGroup, ...groups];
  },
});

export const listCampaignCharacters = query({
  args: { campaignId: v.id('campaign'), organizationId: v.string() },
  returns: v.array(
    v.object({
      character: militiaCharacterValidator,
      ownerName: v.union(v.string(), v.null()),
      owner: v.union(characterOwnerValidator, v.null()),
      // #706: the owner's account survives without this organization's
      // membership, so the Character is returning to them.
      ownerDeparted: v.boolean(),
      isOnRoster: v.boolean(),
    }),
  ),
  async handler(ctx, args) {
    const characters = await listAccessibleCharacters(ctx, {
      ...args,
      includeInactive: true,
    });
    if (characters.length === 0) return [];
    const owners = await readCampaignCharacterOwners(
      ctx,
      characters,
      args.organizationId,
    );
    const militia = await ctx.db
      .query('militia')
      .withIndex('by_campaign', (q) => q.eq('campaignId', args.campaignId))
      .unique();
    const source = militia
      ? await readSelectedCanonicalMilitiaState(ctx, militia._id)
      : null;
    const roster = new Set(
      source?.campaignId === args.campaignId
        ? source.snapshot.roster.people.map((person) => person.characterId)
        : [],
    );
    return characters.map((character) => {
      const owner = character.ownerId ? owners.get(character.ownerId) : null;
      return {
        character,
        owner: owner?.owner ?? null,
        ownerName: owner?.owner?.name ?? null,
        ownerDeparted: owner?.departed ?? false,
        isOnRoster: roster.has(character._id),
      };
    });
  },
});

export const listByCampaign = query({
  args: {
    campaignId: v.optional(v.id('campaign')),
    organizationId: v.optional(campaignValidator.fields.organizationId),
    includeInactive: v.optional(v.boolean()),
  },
  returns: v.array(
    militiaCharacterValidator.extend({
      owner: v.union(characterOwnerValidator, v.null()),
    }),
  ),
  async handler(ctx, args) {
    const characters = await listAccessibleCharacters(ctx, args);
    const owners = await readCharacterOwners(ctx, characters);
    return characters.map((character) => ({
      ...character,
      owner: character.ownerId ? (owners.get(character.ownerId) ?? null) : null,
    }));
  },
});

// B3: a browser still on a bundle from before #180 may submit officer_npc.
// The record stores PC or NPC. Narrow this with B3.
const submittedCharacterKindValidator = v.union(
  v.literal('pc'),
  v.literal('officer_npc'),
  v.literal('npc'),
);

export const createCharacter = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    character: v.object({
      campaignId: v.id('campaign'),
      name: characterValidator.fields.name,
      description: characterValidator.fields.description,
      kind: submittedCharacterKindValidator,
      level: characterValidator.fields.level,
      strength: characterValidator.fields.strength,
      dexterity: characterValidator.fields.dexterity,
      constitution: characterValidator.fields.constitution,
      wisdom: characterValidator.fields.wisdom,
      charisma: characterValidator.fields.charisma,
      intelligence: characterValidator.fields.intelligence,
    }),
  },
  async handler(ctx, args) {
    if (!args.character.name.trim()) {
      throw new ConvexError('Character name cannot be empty');
    }

    const { campaign, access } = await requireCharacterCampaignAccess(ctx, {
      campaignId: args.character.campaignId,
      organizationId: args.organizationId,
    });

    requireWholeCharacterStatistics(args.character);
    const characterId = await ctx.db.insert('character', {
      ...args.character,
      kind: normalizeCharacterKind(args.character.kind),
      ownerId: access.user.tokenIdentifier,
      isActive: true,
    });
    const militia =
      campaign.e2eFixture &&
      (await ctx.db
        .query('militia')
        .withIndex('by_campaign', (q) => q.eq('campaignId', campaign._id))
        .unique());
    if (militia) {
      await initializeCharacterSheet(ctx, {
        characterId,
        operationId: `ledger:create:${characterId}`,
        updatedBy: access.user.tokenIdentifier,
        sheetMode: 'militiaOnly',
        level: args.character.level,
        scores: args.character,
      });
    }
    await updateCanonicalCharacter(ctx, characterId);
    return characterId;
  },
});

export const updateCharacter = mutation({
  args: {
    operationId: v.optional(v.string()),
    organizationId: campaignValidator.fields.organizationId,
    characterId: v.id('character'),
    confirmedRemovedLevelIds: v.optional(v.array(v.id('characterSheetEntry'))),
    expectedSheetRevision: v.optional(v.number()),
    patch: v.object({
      name: v.optional(characterValidator.fields.name),
      description: v.optional(characterValidator.fields.description),
      kind: v.optional(submittedCharacterKindValidator),
      level: v.optional(characterValidator.fields.level),
      strength: v.optional(characterValidator.fields.strength),
      dexterity: v.optional(characterValidator.fields.dexterity),
      constitution: v.optional(characterValidator.fields.constitution),
      wisdom: v.optional(characterValidator.fields.wisdom),
      charisma: v.optional(characterValidator.fields.charisma),
      intelligence: v.optional(characterValidator.fields.intelligence),
      isActive: v.optional(v.boolean()),
    }),
  },
  returns: v.null(),
  async handler(ctx, args) {
    if (args.patch.name !== undefined && !args.patch.name.trim()) {
      throw new ConvexError('Character name cannot be empty');
    }

    const character = await requireCampaignCharacterAccess(ctx, {
      characterId: args.characterId,
      organizationId: args.organizationId,
    });

    // A submitted kind is stored as PC or NPC; an unrelated edit leaves the
    // stored kind alone. Either way the roster mirror follows in this write.
    const prepared = await editMilitiaOnlySheet(ctx, args, character);
    if (!prepared) requireWholeCharacterStatistics(args.patch);
    const { kind, ...submittedPatch } = args.patch;
    const patch = prepared
      ? Object.fromEntries(
          Object.entries(submittedPatch).filter(([key]) =>
            characterMetadataKeys.some((metadataKey) => metadataKey === key),
          ),
        )
      : submittedPatch;
    await ctx.db.patch('character', args.characterId, {
      ...patch,
      ...(kind && { kind: normalizeCharacterKind(kind) }),
    });
    const changesSheetKind =
      character.sheetMode &&
      kind !== undefined &&
      normalizeCharacterKind(kind) !== character.kind;
    const sheet =
      prepared?.sheet ??
      (changesSheetKind ? await loadCharacterSheet(ctx, args) : null);
    if (sheet && (prepared?.changed || changesSheetKind)) {
      sheet.character = {
        ...sheet.character,
        ...patch,
        ...(kind && { kind: normalizeCharacterKind(kind) }),
      };
      await pruneWarningAcceptancesAndRecordChange(ctx, {
        sheet,
        operationId:
          args.operationId ??
          `ledger:edit:${character._id}:${sheet.revision + 1}`,
      });
    } else {
      await updateCanonicalCharacter(ctx, args.characterId);
      if (args.patch.isActive !== undefined)
        await reconcileCompanionRelationships(ctx, {
          characterId: args.characterId,
          operationId: args.operationId,
        });
    }
    return null;
  },
});

export const archiveCharacter = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    characterId: v.id('character'),
    isActive: v.boolean(),
  },
  async handler(ctx, args) {
    await requireCampaignCharacterAccess(ctx, {
      characterId: args.characterId,
      organizationId: args.organizationId,
    });

    await updateCharacterArchive(ctx, args);
  },
});

export const deleteCharacter = mutation({
  args: {
    organizationId: campaignValidator.fields.organizationId,
    characterId: v.id('character'),
  },
  async handler(ctx, args) {
    const character = await requireCampaignCharacterAccess(ctx, {
      characterId: args.characterId,
      organizationId: args.organizationId,
    });
    if (character.isActive)
      throw new ConvexError('Only archived characters can be hard deleted');

    throw new ConvexError(
      'Keep archived characters to preserve militia history.',
    );
  },
});
