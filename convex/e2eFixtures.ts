import { humanDualTalentCatalog } from '../e2e/fixtures/human-dual-talent';
import { magicalLineage } from '../e2e/fixtures/magical-lineage';
import {
  gatedInternalMutation,
  generalInternalMutation,
  readWriteGate,
} from './lib/writeGate';
import { syncOrganizationMemberships } from './organizationMembership';
import { readOrganizationDeparture } from './lib/organizationDeparture';
import {
  deleteAccount as deleteUserAccount,
  getUserByTokenIdentifier,
  removeOrganizationMembership,
} from './user';
import { readAccountDeletion } from './lib/accountDeletion';
import { writeCatalogDefinition } from './lib/catalogCopies';
import { createWeeklyDraft } from '../src/lib/weekly-draft';
import { weeklyDraftDataSchema } from '../src/lib/weekly-draft-contract';
import { militiaSnapshotSchema } from '../src/lib/canonical-weekly-source';
import { v, type Infer } from 'convex/values';
import {
  deleteCharacterSheet,
  initializeCharacterSheet,
  pruneWarningAcceptancesAndRecordChange,
} from './lib/characterSheet';
import { representativeFamiliars } from '../src/lib/catalog/representative-familiars';
import { buildSelectionEntry } from '../src/lib/character-sheet-selection';
import { releaseQualification } from '../e2e/fixtures/release';
import { getCompanionSupportingEntryKeys } from './lib/companionRelationshipGraph';
import {
  createReadBudget,
  readCharacterSheetDataWithBudget,
} from './lib/characterSheetData';
import type { Id } from './_generated/dataModel';
import {
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import { sanitizeAndCap } from '../e2e/support/redaction';
import {
  guardFixtureScope,
  isCanonicalCase,
  roleKeys,
  type CaseKey,
  type FixtureScope,
  type WorkerCohort,
} from '../e2e/fixtures/catalog';

const caseKey = v.union(
  v.literal('smoke'),
  v.literal('isolation'),
  v.literal('existingMilitia'),
  v.literal('characterLedger'),
  v.literal('characterSheet'),
  v.literal('characterAttacks'),
  v.literal('privateCharacter'),
  v.literal('characterNavigation'),
  v.literal('membershipLoss'),
  v.literal('accountDeletion'),
  v.literal('characterMove'),
  v.literal('sheetSelections'),
  v.literal('sheetClasses'),
  v.literal('animalCompanion'),
  v.literal('legalNotices'),
  v.literal('completeWeek'),
  v.literal('realtimeActionSlot'),
  v.literal('canonicalPersistence'),
  v.literal('workspaceUpkeep'),
  v.literal('workspaceNotoriety'),
  v.literal('workspaceRecovery'),
  v.literal('workspacePersistent'),
  v.literal('workspaceConfirmation'),
  v.literal('workspaceUpkeepLayout'),
  v.literal('workspaceEventReview'),
  v.literal('workspaceActivity'),
  v.literal('workspaceSettlementTouch'),
  v.literal('workspaceDrillRolls'),
  v.literal('workspaceRecoveryActivity'),
  v.literal('campaignHome'),
  v.literal('campaignSections'),
  v.literal('weekLinks'),
  v.literal('catalogRelease'),
);
const scopeArgs = {
  namespace: v.string(),
  version: v.number(),
  workerKey: v.string(),
  caseKey,
  session: v.string(),
  token: v.string(),
};
// The campaign the harness's reset returned for this case (#754). A cohort
// capability authorizes every case of its cohort, so an operation that names
// a campaign another case still owns is refused instead of acting on the
// requested case.
const caseTargetArgs = { expectedCampaignId: v.optional(v.id('campaign')) };

// The journeys whose seeded Characters live in a campaign without a militia.
const militialessSheetCases: readonly CaseKey[] = [
  'characterAttacks',
  'characterNavigation',
  'membershipLoss',
  'accountDeletion',
  'characterMove',
  'sheetSelections',
  'sheetClasses',
  'animalCompanion',
  'catalogRelease',
];
function isMilitialessCase(caseKey: CaseKey) {
  return militialessSheetCases.includes(caseKey);
}

function isSheetCase(caseKey: CaseKey) {
  return caseKey === 'characterSheet' || isMilitialessCase(caseKey);
}

// The harness always passes the cases its running test owns in this cohort.
export const isolationArgs = { isolatedWith: v.optional(v.array(caseKey)) };

function authorize(scope: FixtureScope) {
  // Installed Convex 1.34 has no generated `env` API; keep the supported runtime
  // interface until the project upgrades to the version in its AI guidelines.
  return guardFixtureScope(process.env, scope);
}

async function assertCaseTarget(
  ctx: QueryCtx | MutationCtx,
  scope: FixtureScope,
  expectedCampaignId: Id<'campaign'> | undefined,
) {
  if (!expectedCampaignId) return;
  const expected = await ctx.db.get('campaign', expectedCampaignId);
  const owner = expected?.e2eFixture;
  if (
    expected &&
    (owner?.namespace !== scope.namespace ||
      owner.version !== scope.version ||
      owner.workerKey !== scope.workerKey ||
      owner.caseKey !== scope.caseKey)
  )
    throw new Error('E2E fixture case mismatch');
}

function bounded<T>(documents: T[], limit = 100) {
  if (documents.length > limit)
    throw new Error(
      'E2E fixture graph exceeds cleanup limit; recreate the preview',
    );
  return documents;
}

async function campaigns(ctx: QueryCtx | MutationCtx, scope: FixtureScope) {
  const rows = bounded(
    await ctx.db
      .query('campaign')
      .withIndex('by_e2eFixture_namespace_and_workerKey_and_caseKey', (q) =>
        q
          .eq('e2eFixture.namespace', scope.namespace)
          .eq('e2eFixture.workerKey', scope.workerKey)
          .eq('e2eFixture.caseKey', scope.caseKey),
      )
      .take(2),
    1,
  );
  for (const row of rows)
    if (row.e2eFixture?.version !== scope.version)
      throw new Error('E2E fixture version mismatch');
  return rows;
}

// Isolation canary: while a test runs, its cohort's member organization holds
// only that test's owned and comparison campaigns, and the outsider
// organization holds none. Another test sharing the cohort, a failed cleanup or
// an application-created campaign would change what the journeys see listed.
async function assertCohortIsolated(
  ctx: MutationCtx,
  scope: FixtureScope,
  worker: WorkerCohort,
  isolatedWith: CaseKey[],
) {
  if (!isolatedWith.includes(scope.caseKey))
    throw new Error('E2E isolation canary must include the reset case');
  const member = bounded(
    await ctx.db
      .query('campaign')
      .withIndex('by_organization', (q) =>
        q.eq('organizationId', worker.organizationId),
      )
      .take(101),
  );
  const outsider = await ctx.db
    .query('campaign')
    .withIndex('by_organization', (q) =>
      q.eq('organizationId', worker.outsiderOrganizationId),
    )
    .take(1);
  const isolatedKeys: readonly string[] = isolatedWith;
  const foreign = member.filter(
    ({ e2eFixture }) =>
      e2eFixture?.namespace !== scope.namespace ||
      e2eFixture.version !== scope.version ||
      e2eFixture.workerKey !== scope.workerKey ||
      !isolatedKeys.includes(e2eFixture.caseKey),
  );
  if (foreign.length > 0 || outsider.length > 0)
    throw new Error(
      `E2E isolation canary: ${foreign.length} foreign member and ${outsider.length} outsider campaigns in ${scope.workerKey}`,
    );
}

// Private, navigation, membership-loss and move journeys put Characters
// outside a campaign: their reset grants the cohort's users private sheets,
// and their cleanup deletes the private sheets they created, got back or took
// out of the campaign, and withdraws the grant.
async function listSheetDemoUsers(
  ctx: QueryCtx | MutationCtx,
  scope: FixtureScope,
) {
  if (
    ![
      'privateCharacter',
      'characterNavigation',
      'membershipLoss',
      'characterMove',
    ].includes(scope.caseKey)
  )
    return [];
  const identities = bounded(
    await ctx.db
      .query('e2eFixtureIdentity')
      .withIndex('by_namespace_and_workerKey', (q) =>
        q.eq('namespace', scope.namespace).eq('workerKey', scope.workerKey),
      )
      .take(4),
    3,
  );
  const users = await Promise.all(
    identities.map((identity) => ctx.db.get('user', identity.userId)),
  );
  return users.filter((user) => user !== null);
}

async function removeFixtureRelationships(
  ctx: MutationCtx,
  characterId: Id<'character'>,
) {
  const groups = await Promise.all([
    ctx.db
      .query('companionRelationship')
      .withIndex('by_associatedCharacterId', (q) =>
        q.eq('associatedCharacterId', characterId),
      )
      .take(101),
    ctx.db
      .query('companionRelationship')
      .withIndex('by_companionCharacterId', (q) =>
        q.eq('companionCharacterId', characterId),
      )
      .take(101),
  ]);
  const relationships = new Map(
    groups.flatMap((rows) =>
      bounded(rows).map((row) => [row._id, row] as const),
    ),
  );
  for (const row of relationships.values())
    await ctx.db.delete('companionRelationship', row._id);
}

/** The membership-loss journey's player rejoins, with no departure left. */
async function restorePlayerMembership(ctx: MutationCtx, scope: FixtureScope) {
  if (scope.caseKey !== 'membershipLoss') return;
  const { config, worker } = authorize(scope);
  const user = await getUserByTokenIdentifier(
    ctx,
    `https://${config.clerkHost}|${worker.player.userId}`,
  );
  if (!user) return;
  const departure = await readOrganizationDeparture(
    ctx,
    user._id,
    worker.organizationId,
  );
  if (departure) {
    const failures = bounded(
      await ctx.db
        .query('organizationDepartureCharacter')
        .withIndex('by_departureId_and_characterId', (q) =>
          q.eq('departureId', departure._id),
        )
        .take(101),
    );
    for (const failure of failures)
      await ctx.db.delete('organizationDepartureCharacter', failure._id);
    await ctx.db.delete('organizationDeparture', departure._id);
  }
  if (user.orgIds.some((org) => org.orgId === worker.organizationId)) return;
  const orgIds = [
    ...user.orgIds,
    { orgId: worker.organizationId, role: 'member' as const },
  ];
  await ctx.db.patch('user', user._id, { orgIds });
  await syncOrganizationMemberships(ctx, user._id, orgIds);
}

/**
 * The account-deletion journey's departing member (#708): an account in the
 * cohort's member organization that owns the journey's Character. It has no
 * provider user and no session, so deleting it changes no cohort user, Clerk
 * membership or anything another journey uses.
 */
function buildDepartingAccountToken(scope: FixtureScope) {
  const { config, worker } = authorize(scope);
  return `https://${config.clerkHost}|e2e-departing-account-${worker.key}`;
}

/** Remove the departing account and its deletion, so the next reset starts afresh. */
async function removeDepartingAccount({
  ctx,
  scope,
}: {
  ctx: MutationCtx;
  scope: FixtureScope;
}) {
  if (scope.caseKey !== 'accountDeletion') return;
  const tokenIdentifier = buildDepartingAccountToken(scope);
  const user = await getUserByTokenIdentifier(ctx, tokenIdentifier);
  if (user) {
    await syncOrganizationMemberships(ctx, user._id, []);
    await ctx.db.delete('user', user._id);
  }
  const deletion = await readAccountDeletion(ctx, tokenIdentifier);
  if (!deletion) return;
  // A drive step still scheduled finds no deletion and does nothing.
  const failures = bounded(
    await ctx.db
      .query('accountDeletionCharacter')
      .withIndex('by_deletionId_and_characterId', (q) =>
        q.eq('deletionId', deletion._id),
      )
      .take(101),
  );
  for (const failure of failures)
    await ctx.db.delete('accountDeletionCharacter', failure._id);
  await ctx.db.delete('accountDeletion', deletion._id);
}

async function removeGraph(ctx: MutationCtx, scope: FixtureScope) {
  await restorePlayerMembership(ctx, scope);
  await removeDepartingAccount({ ctx, scope });
  for (const user of await listSheetDemoUsers(ctx, scope)) {
    const owned = bounded(
      await ctx.db
        .query('character')
        .withIndex('by_ownerId_and_campaignId', (q) =>
          q.eq('ownerId', user.tokenIdentifier),
        )
        .take(101),
    );
    for (const character of owned) {
      if (!character.campaignId && character.sheetDemo) {
        await removeFixtureRelationships(ctx, character._id);
        await deleteCharacterSheet(ctx, character._id);
      }
    }
    await ctx.db.patch('user', user._id, { characterSheetDemo: undefined });
  }

  for (const campaign of await campaigns(ctx, scope)) {
    const militias = bounded(
      await ctx.db
        .query('militia')
        .withIndex('by_campaign', (q) => q.eq('campaignId', campaign._id))
        .take(101),
    );
    for (const militia of militias) {
      const tables = [
        'canonicalDraftTarget',
        'canonicalWeeklyDraft',
        'canonicalDraftOperation',
        'canonicalDraftSourceReview',
        'canonicalResolutionRecord',
        'canonicalMilitiaState',
        'canonicalSourceCorrection',
        'canonicalCampaignInitialization',
      ] as const;
      for (const table of tables) {
        const rows = bounded(
          await ctx.db
            .query(table)
            .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
            .take(101),
        );
        for (const row of rows) await ctx.db.delete(table, row._id);
      }
      await ctx.db.delete('militia', militia._id);
    }
    const characters = bounded(
      await ctx.db
        .query('character')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign._id))
        .take(101),
    );
    for (const character of characters) {
      await removeFixtureRelationships(ctx, character._id);
      if (character.sheetMode) {
        await deleteCharacterSheet(ctx, character._id);
        continue;
      }
      for (const table of [
        'characterSheetEntry',
        'catalogEntry',
        'acceptedWarning',
        'characterLinkedInput',
      ] as const) {
        const rows = bounded(
          await ctx.db
            .query(table)
            .withIndex('by_characterId', (q) =>
              q.eq('characterId', character._id),
            )
            .take(101),
        );
        for (const row of rows) await ctx.db.delete(table, row._id);
      }
      const spells = bounded(
        await ctx.db
          .query('characterSpell')
          .withIndex('characterId', (q) => q.eq('characterId', character._id))
          .take(101),
      );
      for (const spell of spells)
        await ctx.db.delete('characterSpell', spell._id);
      await ctx.db.delete('character', character._id);
    }
    const campaignCatalogEntries = bounded(
      await ctx.db
        .query('catalogEntry')
        .withIndex('by_campaignId_and_scope', (q) =>
          q.eq('campaignId', campaign._id).eq('scope', 'campaign'),
        )
        .take(101),
    );
    for (const entry of campaignCatalogEntries)
      await writeCatalogDefinition(ctx, null, entry._id);
    const spellMembership = await ctx.db
      .query('campaignSpellMembership')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign._id))
      .unique();
    if (spellMembership)
      await ctx.db.delete('campaignSpellMembership', spellMembership._id);
    await ctx.db.delete('campaign', campaign._id);
  }
}

export const seedIdentityProjection = generalInternalMutation({
  args: scopeArgs,
  returns: v.null(),
  handler: async (ctx, scope) => {
    const { config, worker } = authorize(scope);
    for (const role of roleKeys) {
      const tokenIdentifier = `https://${config.clerkHost}|${worker[role].userId}`;
      const existing = await ctx.db
        .query('user')
        .withIndex('by_tokenIdentifier', (q) =>
          q.eq('tokenIdentifier', tokenIdentifier),
        )
        .unique();
      const owned = existing
        ? await ctx.db
            .query('e2eFixtureIdentity')
            .withIndex('by_userId', (q) => q.eq('userId', existing._id))
            .unique()
        : null;
      if (
        existing &&
        (owned?.namespace !== scope.namespace ||
          owned.workerKey !== scope.workerKey)
      ) {
        throw new Error('E2E identity is not owned by this worker');
      }
      const user = {
        tokenIdentifier,
        name: `E2E ${role}`,
        image: '',
        orgIds: [
          {
            orgId:
              role === 'outsider'
                ? worker.outsiderOrganizationId
                : worker.organizationId,
            role: role === 'gm' ? ('admin' as const) : ('member' as const),
          },
        ],
      };
      if (existing) {
        await ctx.db.replace('user', existing._id, user);
        await syncOrganizationMemberships(ctx, existing._id, user.orgIds);
      } else {
        const userId = await ctx.db.insert('user', user);
        await syncOrganizationMemberships(ctx, userId, user.orgIds);
        await ctx.db.insert('e2eFixtureIdentity', {
          namespace: scope.namespace,
          workerKey: scope.workerKey,
          userId,
        });
      }
    }
    return null;
  },
});

async function seedFamiliarDemo(
  ctx: MutationCtx,
  {
    characterId,
    campaignId,
    ownerId,
    now,
  }: {
    characterId: Id<'character'>;
    campaignId: Id<'campaign'>;
    ownerId: string;
    now: number;
  },
) {
  const masterCharacter = await ctx.db.get('character', characterId);
  if (!masterCharacter)
    throw new Error('Prepared familiar demo master is missing');
  const companionReadBudget = createReadBudget(undefined);
  const master = await readCharacterSheetDataWithBudget(
    ctx,
    masterCharacter,
    [],
    {},
    companionReadBudget,
  );
  // Seeded classes are browse-only, so the sheet read does not load them.
  const wizard = (
    await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_ruleIdentity', (q) =>
        q.eq('characterId', characterId).eq('ruleIdentity', 'wizard'),
      )
      .take(8)
  ).find((entry) => entry.detail.kind === 'class');
  const level = master?.entries.find((entry) => entry.kind === 'classLevel');
  if (!wizard || level?.state.kind !== 'classLevel')
    throw new Error('Prepared familiar demo needs the Wizard class');
  await ctx.db.patch('characterSheetEntry', level._id, {
    state: { ...level.state, classEntryId: wizard._id, hpGained: 6 },
  });
  const creature = representativeFamiliars.cat;
  const familiarId = await ctx.db.insert('character', {
    campaignId,
    ownerId,
    name: 'E2E familiar-cat',
    description: 'Synthetic familiar demonstration',
    kind: 'npc',
    isActive: true,
    level: 0,
    ...creature.abilityScores,
    familiarBaseCreatureKey: creature.key,
  });
  await initializeCharacterSheet(ctx, {
    characterId: familiarId,
    operationId: 'fixture:familiar',
    updatedBy: ownerId,
    level: 0,
    scores: creature.abilityScores,
  });
  await ctx.db.insert('companionRelationship', {
    associatedCharacterId: characterId,
    companionCharacterId: familiarId,
    kind: 'familiar',
    sources: [
      {
        key: 'fixture:wizard',
        label: 'Wizard Familiar',
        enabled: true,
        sheetEntryId: level._id,
        ruleKind: 'wizardFamiliar',
      },
    ],
    status: 'active',
    manuallyInterrupted: false,
    activatedAt: now,
    lastOperationId: 'fixture:familiar',
  });
  for (const id of [characterId, familiarId]) {
    const character = await ctx.db.get('character', id);
    if (!character)
      throw new Error('Prepared familiar demo Character is missing');
    const sheet = await readCharacterSheetDataWithBudget(
      ctx,
      character,
      [],
      {},
      companionReadBudget,
    );
    if (!sheet) throw new Error('Prepared familiar demo sheet is missing');
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet: {
        ...sheet,
        companionReadBudget,
        actor: ownerId,
        campaign: null,
        initialSupportingEntryKeys: getCompanionSupportingEntryKeys(sheet),
      },
      operationId: 'fixture:familiar',
    });
  }
}

async function seedDepartingAccount({
  ctx,
  scope,
  worker,
}: {
  ctx: MutationCtx;
  scope: FixtureScope;
  worker: WorkerCohort;
}) {
  const tokenIdentifier = buildDepartingAccountToken(scope);
  const orgIds = [{ orgId: worker.organizationId, role: 'member' as const }];
  const userId = await ctx.db.insert('user', {
    tokenIdentifier,
    name: 'E2E departing member',
    image: '',
    orgIds,
  });
  await syncOrganizationMemberships(ctx, userId, orgIds);
  return tokenIdentifier;
}

/**
 * The admitted feat's global Catalog Entry, created once per preview. The
 * qualification release (#753) supplies its body, so this stand-in carries
 * only its stable identity and kind, as #413's initial import will allocate
 * them; until activation a Selection of it adds nothing. Cleanup keeps it:
 * the selected release's identity coverage depends on it.
 */
async function installReleaseFeatIdentity(ctx: MutationCtx) {
  const { externalKey, name } = releaseQualification.feat;
  const existing = await ctx.db
    .query('catalogEntry')
    .withIndex('by_scope_and_ruleIdentity', (q) =>
      q.eq('scope', 'global').eq('ruleIdentity', externalKey),
    )
    .unique();
  if (existing) return existing._id;
  return await ctx.db.insert('catalogEntry', {
    scope: 'global',
    name,
    ruleIdentity: externalKey,
    sources: [],
    modifiers: [],
    stacksWithItself: false,
    detail: { kind: 'feat' },
  });
}

/**
 * The release case's second Character, which already holds the admitted
 * feat, so reconciliation finds a Character the release changes and
 * calculates its facts. The journey's own Character (the case's first)
 * takes the feat through the picker instead.
 */
async function seedReleaseReconciledCharacter(
  ctx: MutationCtx,
  { campaignId, ownerId }: { campaignId: Id<'campaign'>; ownerId: string },
) {
  const featId = await installReleaseFeatIdentity(ctx);
  const characterId = await ctx.db.insert('character', {
    campaignId,
    ownerId,
    name: releaseQualification.reconciledCharacter,
    description: 'Synthetic Character holding the admitted release feat',
    kind: 'pc',
    isActive: true,
    level: 1,
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  });
  await initializeCharacterSheet(ctx, {
    characterId,
    operationId: 'fixture:release-character',
    updatedBy: ownerId,
  });
  await ctx.db.insert('characterSheetEntry', {
    characterId,
    ...buildSelectionEntry({ kind: 'feat', catalogEntryId: featId }),
  });
  const character = await ctx.db.get('character', characterId);
  if (!character) throw new Error('Release Character is missing');
  const readBudget = createReadBudget(undefined);
  const sheet = await readCharacterSheetDataWithBudget(
    ctx,
    character,
    [],
    {},
    readBudget,
  );
  if (!sheet) throw new Error('Release Character sheet is missing');
  await pruneWarningAcceptancesAndRecordChange(ctx, {
    sheet: {
      ...sheet,
      companionReadBudget: readBudget,
      actor: ownerId,
      campaign: null,
      initialSupportingEntryKeys: getCompanionSupportingEntryKeys(sheet),
    },
    operationId: 'fixture:release-feat',
  });
}

// Called only by the capability-guarded sheetSelections reset, immediately
// after its fresh prepared sheet. Reuse the four Human IDs so other prepared
// references remain valid; no global catalog or real curation record changes.
async function seedHumanDualTalent({
  ctx,
  characterId,
}: {
  ctx: MutationCtx;
  characterId: Id<'character'>;
}) {
  const existingKeys: Record<string, string> = {
    'pf1/e6IaBxKgMxy1yKlr': 'human',
    'pf1-content/BFszTUJLlDS1ZDB8': 'human-ability',
    'pf1-content/LwDcZanOEHqVaYoh': 'human-skilled',
    'pf1-content/uAJ9hLZYdH2JX7J8': 'human-bonus-feat',
  };
  const ids = new Map<string, Id<'catalogEntry'>>();
  for (const fixture of humanDualTalentCatalog) {
    const existingKey = existingKeys[fixture._id];
    if (existingKey) {
      const candidates = await ctx.db
        .query('catalogEntry')
        .withIndex('by_scope_and_ruleIdentity', (q) =>
          q.eq('scope', 'character').eq('ruleIdentity', existingKey),
        )
        .take(100);
      const existing = candidates.find(
        (entry) => entry.characterId === characterId,
      );
      if (!existing) throw new Error('Missing prepared Human fixture');
      ids.set(fixture._id, existing._id);
    } else {
      ids.set(
        fixture._id,
        await ctx.db.insert('catalogEntry', {
          scope: 'character',
          characterId,
          name: fixture.name ?? fixture._id,
          ruleIdentity: fixture.ruleIdentity,
          stacksWithItself: false,
          sources: fixture.sources,
          modifiers: [],
          detail: { kind: 'racialTrait', raceEntryIds: [], replaces: [] },
        }),
      );
    }
  }
  function getFixtureId(key: string) {
    const id = ids.get(key);
    if (!id) throw new Error('Incomplete Human fixture graph');
    return id;
  }
  for (const fixture of humanDualTalentCatalog) {
    const detail = fixture.detail;
    if (detail?.kind !== 'race' && detail?.kind !== 'racialTrait')
      throw new Error('Unexpected Human fixture definition');
    await ctx.db.replace('catalogEntry', getFixtureId(fixture._id), {
      scope: 'character',
      characterId,
      name: fixture.name ?? fixture._id,
      ruleIdentity: fixture.ruleIdentity,
      stacksWithItself: false,
      sources: fixture.sources,
      modifiers: [...fixture.modifiers],
      ...(fixture.situationalNotes
        ? { situationalNotes: [...fixture.situationalNotes] }
        : {}),
      ...(fixture.grantsSlots ? { grantsSlots: [...fixture.grantsSlots] } : {}),
      detail:
        detail.kind === 'race'
          ? {
              kind: 'race',
              racialHitDice: detail.racialHitDice ?? 0,
              size: detail.size,
              creatureTypes: [...(detail.creatureTypes ?? [])],
              creatureSubtypes: [...(detail.creatureSubtypes ?? [])],
              racialTraits: detail.racialTraits.map(getFixtureId),
            }
          : {
              kind: 'racialTrait',
              raceEntryIds: detail.raceEntryIds.map(getFixtureId),
              replaces: detail.replaces.map(getFixtureId),
              ...(detail.abilityChoiceCount
                ? { abilityChoiceCount: detail.abilityChoiceCount }
                : {}),
              ...(detail.bonusSkillRanksPerLevel !== undefined
                ? { bonusSkillRanksPerLevel: detail.bonusSkillRanksPerLevel }
                : {}),
            },
    });
  }
}

export const resetCase = gatedInternalMutation({
  args: {
    ...scopeArgs,
    ...isolationArgs,
    now: v.number(),
    familiarDemo: v.optional(v.boolean()),
  },
  returns: v.object({ campaignId: v.id('campaign'), campaignKey: v.string() }),
  handler: async (ctx, args) => {
    const { config, worker, domain } = authorize(args);
    if (args.familiarDemo && !isSheetCase(args.caseKey))
      throw new Error('Familiar demonstration requires a prepared sheet case');
    if (!Number.isSafeInteger(args.now) || args.now < 0)
      throw new Error('Fixture time must be a nonnegative integer');
    await removeGraph(ctx, args);
    for (const user of await listSheetDemoUsers(ctx, args))
      await ctx.db.patch('user', user._id, { characterSheetDemo: true });
    const campaignId = await ctx.db.insert('campaign', {
      name: `E2E ${domain.campaign}`,
      ownerId: `https://${config.clerkHost}|${worker.gm.userId}`,
      organizationId: worker.organizationId,
      description: 'Disposable synthetic campaign',
      inGameDate: '4717-01-01',
      e2eFixture: {
        namespace: args.namespace,
        version: args.version,
        workerKey: args.workerKey,
        caseKey: args.caseKey,
        campaignKey: domain.campaign,
      },
    });
    // A leak throws, which also rolls this reset back.
    if (args.isolatedWith)
      await assertCohortIsolated(ctx, args, worker, args.isolatedWith);
    // The onboarding journey must create its militia and officers through the
    // UI; the legal journey needs only a campaign to start from.
    if (args.caseKey === 'existingMilitia' || args.caseKey === 'legalNotices')
      return { campaignId, campaignKey: domain.campaign };
    // The membership-loss journey's player owns the Character it loses, and
    // the account-deletion journey's departing member the one it leaves.
    const ownerId =
      args.caseKey === 'accountDeletion'
        ? await seedDepartingAccount({ ctx, scope: args, worker })
        : `https://${config.clerkHost}|${(args.caseKey === 'membershipLoss' ? worker.player : worker.gm).userId}`;
    const characterId =
      args.caseKey === 'characterLedger'
        ? undefined
        : await ctx.db.insert('character', {
            campaignId,
            ownerId,
            name: `E2E ${domain.character}`,
            description: 'Synthetic officer',
            // The record owns the kind its roster mirror follows. Canonical
            // journeys and the sheet fixture play this Character as a PC;
            // the other journeys seed an NPC roster.
            kind:
              isCanonicalCase(args.caseKey) || isSheetCase(args.caseKey)
                ? 'pc'
                : 'npc',
            isActive: true,
            level: 1,
            strength: 10,
            dexterity: 10,
            constitution: 10,
            intelligence: 10,
            wisdom: 10,
            charisma: 10,
          });
    if (isSheetCase(args.caseKey) && characterId)
      await initializeCharacterSheet(ctx, {
        characterId,
        operationId: 'fixture:character-sheet',
        updatedBy: ownerId,
      });
    // #769 isolated legal fixture: Character-scoped, reset/cleaned with this
    // case only. The real trait and its source/notice holds are not admitted.
    if (args.caseKey === 'sheetSelections' && characterId) {
      await ctx.db.insert('catalogEntry', {
        ...magicalLineage,
        scope: 'character',
        characterId,
      });
      await seedHumanDualTalent({ ctx, characterId });
    }
    if (args.familiarDemo && characterId)
      await seedFamiliarDemo(ctx, {
        characterId,
        campaignId,
        now: args.now,
        ownerId: `https://${config.clerkHost}|${worker.gm.userId}`,
      });
    if (args.caseKey === 'catalogRelease')
      await seedReleaseReconciledCharacter(ctx, { campaignId, ownerId });
    if (isMilitialessCase(args.caseKey))
      return { campaignId, campaignKey: domain.campaign };
    const militiaId = await ctx.db.insert('militia', {
      name: `E2E ${domain.militia}`,
      campaignId,
    });
    if (!isCanonicalCase(args.caseKey)) {
      const character = characterId
        ? await ctx.db.get('character', characterId)
        : null;
      const snapshot = militiaSnapshotSchema.parse({
        rank: 1,
        training: 0,
        treasuryCopper: 10000,
        notoriety: 0,
        focus: 'Loyalty',
        characters: character
          ? [
              {
                characterId: character._id,
                isActive: true,
                level: character.level,
                strength: character.strength,
                dexterity: character.dexterity,
                constitution: character.constitution,
                intelligence: character.intelligence,
                wisdom: character.wisdom,
                charisma: character.charisma,
              },
            ]
          : [],
        roster: {
          people: character
            ? [
                {
                  characterId: character._id,
                  kind: character.kind,
                  hitDice: 1,
                },
              ]
            : [],
          teams: [],
          officers: [],
        },
        settlements: [],
        bonuses: [],
      });
      const draft = weeklyDraftDataSchema.parse(
        createWeeklyDraft({
          draftId: `fixture:${campaignId}`,
          week: 1,
          slotIds: ['left', 'right', 'extra'],
          context: {
            firstMilitiaWeek: true,
            startDay: 0,
            uneventfulCarry: false,
            carriedEvents: [],
            queuedEffects: [],
            orders: [],
            lastBuyoffWeek: null,
          },
        }),
      );
      await ctx.db.insert('canonicalMilitiaState', {
        campaignId,
        militiaId,
        revision: 0,
        snapshot,
      });
      await ctx.db.insert('canonicalWeeklyDraft', {
        campaignId,
        militiaId,
        draftId: draft.draftId,
        draft,
        initialDraft: draft,
        status: 'open',
        revision: 0,
      });
    }
    return { campaignId, campaignKey: domain.campaign };
  },
});

// A release-qualification run's work for one seeded Character (#753).
const releaseWorkValidator = v.object({
  character: v.string(),
  state: v.union(v.string(), v.null()),
  reasons: v.array(v.string()),
  hasFactsChanged: v.union(v.boolean(), v.null()),
});

export const inspectCase = internalQuery({
  args: {
    ...scopeArgs,
    // The release case reports this reconciliation run's work per Character.
    releaseRunId: v.optional(v.id('catalogImpactRun')),
    ...caseTargetArgs,
  },
  returns: v.object({
    campaignKey: v.string(),
    campaignCount: v.number(),
    identityCount: v.number(),
    militia: v.union(
      v.null(),
      v.object({
        treasury: v.number(),
        training: v.number(),
        week: v.number(),
        phase: v.string(),
        stagedActions: v.array(v.union(v.string(), v.null())),
      }),
    ),
    characters: v.array(v.string()),
    characterIds: v.optional(v.array(v.id('character'))),
    releaseWork: v.optional(v.array(releaseWorkValidator)),
  }),
  handler: async (ctx, { releaseRunId, expectedCampaignId, ...scope }) => {
    const { domain } = authorize(scope);
    await assertCaseTarget(ctx, scope, expectedCampaignId);
    if (releaseRunId && scope.caseKey !== 'catalogRelease')
      throw new Error('Only the release case reports reconciliation work');
    const rows = await campaigns(ctx, scope);
    const campaign = rows[0];
    let militia: {
      treasury: number;
      training: number;
      week: number;
      phase: string;
      stagedActions: (string | null)[];
    } | null = null;
    let characters: string[] = [];
    let characterIds: Id<'character'>[] = [];
    const releaseWork: Infer<typeof releaseWorkValidator>[] = [];
    if (campaign) {
      const current = await ctx.db
        .query('militia')
        .withIndex('by_campaign', (q) => q.eq('campaignId', campaign._id))
        .unique();
      if (current) {
        const state = await ctx.db
          .query('canonicalMilitiaState')
          .withIndex('by_militiaId', (q) => q.eq('militiaId', current._id))
          .unique();
        const week = await ctx.db
          .query('canonicalWeeklyDraft')
          .withIndex('by_campaignId_and_status', (q) =>
            q.eq('campaignId', campaign._id).eq('status', 'open'),
          )
          .unique();
        if (state && week?.draft)
          militia = {
            treasury: state.snapshot.treasuryCopper / 100,
            training: state.snapshot.training,
            week: week.draft.week,
            phase: 'upkeep',
            stagedActions: week.draft.activity.slots.map(
              (slot) => slot.choice?.actionId ?? null,
            ),
          };
      }
      const records = bounded(
        await ctx.db
          .query('character')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign._id))
          .take(101),
      );
      characters = records.map((row) => row.name).sort();
      characterIds = records.map((row) => row._id);
      if (releaseRunId)
        for (const record of records) {
          const work = await ctx.db
            .query('catalogImpactWork')
            .withIndex('by_runId_and_characterId', (q) =>
              q.eq('runId', releaseRunId).eq('characterId', record._id),
            )
            .unique();
          releaseWork.push({
            character: record.name,
            state: work?.state ?? null,
            reasons: work?.reasons ?? [],
            hasFactsChanged: work?.hasFactsChanged ?? null,
          });
        }
    }
    const identities = bounded(
      await ctx.db
        .query('e2eFixtureIdentity')
        .withIndex('by_namespace_and_workerKey', (q) =>
          q.eq('namespace', scope.namespace).eq('workerKey', scope.workerKey),
        )
        .take(4),
      3,
    );
    return {
      campaignKey: domain.campaign,
      campaignCount: rows.length,
      identityCount: identities.length,
      militia,
      characters,
      ...(isSheetCase(scope.caseKey) && {
        characterIds,
      }),
      ...(releaseRunId && { releaseWork }),
    };
  },
});

const moveDiagnosticsValidator = v.object({
  // The state the trusted return's driver checks before each step
  // (`readStepGate` in lib/lifecycleDriver.ts).
  writeGate: v.object({
    present: v.boolean(),
    closed: v.boolean(),
    authority: v.union(v.literal('legacy'), v.literal('sheet')),
    epoch: v.number(),
  }),
  characters: v.array(
    v.object({
      name: v.string(),
      inCampaign: v.boolean(),
      move: v.union(
        v.null(),
        v.object({
          state: v.string(),
          phase: v.string(),
          prepared: v.number(),
          total: v.number(),
          generation: v.number(),
          cancelReason: v.optional(v.string()),
          origin: v.union(
            v.literal('owner'),
            v.literal('organizationDeparture'),
            v.literal('campaignDeletion'),
          ),
          groupSize: v.number(),
          isGroupMember: v.boolean(),
        }),
      ),
    }),
  ),
  departure: v.union(
    v.null(),
    v.object({
      state: v.string(),
      outcome: v.optional(v.string()),
      round: v.number(),
      failures: v.array(
        v.object({
          characterName: v.string(),
          failures: v.number(),
          setAside: v.boolean(),
          lastFailure: v.string(),
        }),
      ),
      // The driver run waiting to start, which is the next retry after a
      // failed step, and how the latest finished run ended.
      nextDrive: v.union(v.null(), v.number()),
      lastDrive: v.union(
        v.null(),
        v.object({ state: v.string(), error: v.optional(v.string()) }),
      ),
    }),
  ),
});

/** The latest move of each of the case's Characters, wherever they are now. */
async function readCaseMoves(ctx: QueryCtx, scope: FixtureScope) {
  const [campaign] = await campaigns(ctx, scope);
  const inCampaign = campaign
    ? bounded(
        await ctx.db
          .query('character')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign._id))
          .take(101),
      )
    : [];
  const outside = [];
  for (const user of await listSheetDemoUsers(ctx, scope))
    outside.push(
      ...bounded(
        await ctx.db
          .query('character')
          .withIndex('by_ownerId_and_campaignId', (q) =>
            q.eq('ownerId', user.tokenIdentifier).eq('campaignId', undefined),
          )
          .take(101),
      ).filter((character) => character.sheetDemo),
    );
  return await Promise.all(
    [...inCampaign, ...outside].map(async (character) => {
      const move = await ctx.db
        .query('characterMove')
        .withIndex('by_characterId', (q) => q.eq('characterId', character._id))
        .order('desc')
        .first();
      return {
        character,
        name: character.name,
        inCampaign: character.campaignId !== undefined,
        move: move && {
          state: move.state,
          phase: move.scanPhase,
          prepared: move.prepared,
          total: move.total,
          generation: move.generation,
          ...(move.cancelReason ? { cancelReason: move.cancelReason } : {}),
          origin: move.departureId
            ? ('organizationDeparture' as const)
            : move.campaignDeletionId
              ? ('campaignDeletion' as const)
              : ('owner' as const),
          groupSize: move.groupCharacterIds?.length ?? 1,
          isGroupMember: move.groupRootId !== undefined,
        },
      };
    }),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// A failure's text is at most 500 characters; a scheduler error has no
// documented bound.
const failureTextBytes = 4 * 1024;

/** The membership-loss player's departure, its failed steps and its driver runs. */
async function readCaseDeparture(
  ctx: QueryCtx,
  scope: FixtureScope,
  names: Map<Id<'character'>, string>,
) {
  if (scope.caseKey !== 'membershipLoss') return null;
  const { config, worker } = authorize(scope);
  const user = await getUserByTokenIdentifier(
    ctx,
    `https://${config.clerkHost}|${worker.player.userId}`,
  );
  const departure =
    user &&
    (await readOrganizationDeparture(ctx, user._id, worker.organizationId));
  if (!departure) return null;
  const failures = bounded(
    await ctx.db
      .query('organizationDepartureCharacter')
      .withIndex('by_departureId_and_characterId', (q) =>
        q.eq('departureId', departure._id),
      )
      .take(101),
  );
  // The shared preview schedules other cohorts' work too; this departure's
  // runs are among the latest.
  const runs = (
    await ctx.db.system.query('_scheduled_functions').order('desc').take(256)
  ).filter((job) => {
    const args: unknown = job.args[0];
    return (
      /^organizationDepartures(?:\.js)?:drive$/.test(job.name) &&
      isRecord(args) &&
      args.departureId === departure._id &&
      args.round === departure.round
    );
  });
  const next = runs
    .filter(({ state }) => state.kind === 'pending')
    .map(({ scheduledTime }) => scheduledTime)
    .sort((a, b) => a - b)[0];
  const last = runs.find(
    ({ state }) => state.kind !== 'pending' && state.kind !== 'inProgress',
  );
  return {
    state: departure.state,
    ...(departure.outcome ? { outcome: departure.outcome } : {}),
    round: departure.round,
    // Failure text is sanitized before it is bounded, so no cut credential
    // escapes the redaction; the harness sanitizes it again.
    failures: failures.map((row) => ({
      characterName: names.get(row.characterId) ?? 'another Character',
      failures: row.failures,
      setAside: row.setAside,
      lastFailure: sanitizeAndCap(row.lastFailure, failureTextBytes),
    })),
    nextDrive: next ?? null,
    lastDrive: last
      ? {
          state: last.state.kind,
          ...(last.state.kind === 'failed'
            ? { error: sanitizeAndCap(last.state.error, failureTextBytes) }
            : {}),
        }
      : null,
  };
}

/**
 * What the server holds for a failed move or membership-loss journey: each
 * Character's latest move, the departure's failed steps and driver runs, and
 * the Write Gate. The harness records it, sanitized, with the failure.
 */
export const inspectMoves = internalQuery({
  args: { ...scopeArgs, ...caseTargetArgs },
  returns: moveDiagnosticsValidator,
  handler: async (ctx, { expectedCampaignId, ...scope }) => {
    authorize(scope);
    await assertCaseTarget(ctx, scope, expectedCampaignId);
    if (scope.caseKey !== 'characterMove' && scope.caseKey !== 'membershipLoss')
      throw new Error('Only the move journeys inspect moves');
    const control = await readWriteGate(ctx);
    const characters = await readCaseMoves(ctx, scope);
    return {
      writeGate: {
        present: control !== null,
        closed: control?.closed ?? false,
        authority: control?.authority ?? 'legacy',
        epoch: control?.epoch ?? 0,
      },
      characters: characters.map(({ character: _character, ...row }) => row),
      departure: await readCaseDeparture(
        ctx,
        scope,
        new Map(
          characters.map(({ character }) => [character._id, character.name]),
        ),
      ),
    };
  },
});

/**
 * The membership-loss journey's player leaves the cohort organization (#706),
 * through the same removal as the signed provider event. Reset and cleanup
 * restore the membership.
 */
export const loseMembership = generalInternalMutation({
  args: { ...scopeArgs, ...caseTargetArgs, now: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { now, expectedCampaignId, ...scope } = args;
    const { config, worker } = authorize(scope);
    await assertCaseTarget(ctx, scope, expectedCampaignId);
    if (scope.caseKey !== 'membershipLoss')
      throw new Error('Only the membership-loss journey removes a membership');
    if (!Number.isSafeInteger(now) || now < 0)
      throw new Error('Fixture time must be a nonnegative integer');
    if ((await campaigns(ctx, scope)).length !== 1)
      throw new Error('Reset the membership-loss case first');
    await removeOrganizationMembership(ctx, {
      tokenIdentifier: `https://${config.clerkHost}|${worker.player.userId}`,
      orgId: worker.organizationId,
      webhookUpdatedAt: now,
      // The journey waits about a minute for the return, not the grace that
      // lets a provider account deletion take precedence (#708).
      graceMs: 0,
    });
    return null;
  },
});

/**
 * The account-deletion journey's departing member deletes their account
 * (#708), through the same deletion as the signed provider event. Only that
 * fixture account goes; reset and cleanup remove it and its deletion.
 */
export const deleteAccount = generalInternalMutation({
  args: { ...scopeArgs, ...caseTargetArgs },
  returns: v.null(),
  handler: async (ctx, { expectedCampaignId, ...scope }) => {
    authorize(scope);
    await assertCaseTarget(ctx, scope, expectedCampaignId);
    if (scope.caseKey !== 'accountDeletion')
      throw new Error('Only the account-deletion journey deletes an account');
    if ((await campaigns(ctx, scope)).length !== 1)
      throw new Error('Reset the account-deletion case first');
    await deleteUserAccount(ctx, buildDepartingAccountToken(scope));
    return null;
  },
});

export const cleanupCase = gatedInternalMutation({
  args: { ...scopeArgs, ...caseTargetArgs },
  returns: v.null(),
  handler: async (ctx, { expectedCampaignId, ...scope }) => {
    authorize(scope);
    await assertCaseTarget(ctx, scope, expectedCampaignId);
    await removeGraph(ctx, scope);
    return null;
  },
});
