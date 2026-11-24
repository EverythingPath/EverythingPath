// @vitest-environment edge-runtime
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import type { FunctionArgs } from 'convex/server';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  closedAndBackfilled,
  frontendBuild,
} from '../tests/initial-migration-fixture';
import {
  deliver,
  finishBackgroundWork,
  outcome,
  readSheet,
  runDueWork,
  token,
  type Viewer,
} from '../tests/container-deletion';
import { acceptedCampaignSetup } from '../tests/rules/accepted-campaign';
import { initializationEdits } from '../tests/rules/initialization-edits';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { departureGraceMs } from './lib/lifecycleDriver';
import { organizationDepartureActor } from './lib/organizationDeparture';
import { syncOrganizationMemberships } from './organizationMembership';
import schema from './schema';

// #413 F7a: the lifecycle drivers run under sheet authority. An ordinary
// (non-fixture) organization after a real activation, publication and
// reopening: a member who leaves gets their Characters back, a deleted
// account's campaign Characters become ownerless, and an organization deleted
// outside the app returns its members' Characters. A closed gate still holds.

// The provider's signature verifier is the external boundary; the real HTTP
// route, action and mutations run beneath it without provider credentials.
vi.mock('svix', () => ({
  Webhook: class {
    verify(payload: string, headers: Record<string, string>) {
      if (headers['svix-signature'] !== 'valid')
        throw new Error('Invalid signature');
      return JSON.parse(payload);
    }
  },
}));

afterEach(() => vi.useRealTimers());

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
preloadCalledConvexModules({ modules, testFile: import.meta.url });
// Provider deliveries and the drivers they start reach these modules too.
beforeAll(async () => {
  for (const name of [
    'http',
    'clerk',
    'user',
    'organizationDepartures',
    'accountDeletions',
    'organizationDeletions',
    'characterMoves',
  ])
    await modules[`./${name}.ts`]?.();
}, 30_000);

const organizationId = 'party';

const strongHeart = {
  name: 'Strong heart',
  modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
  stacksWithItself: false,
  sources: [],
  detail: { kind: 'feat' },
} satisfies FunctionArgs<typeof api.catalogCopies.createOneOff>['definition'];

/**
 * A deployment after a real activate, publish, smoke and reopen: sheet
 * authority, the gate open at the reopened Write Epoch, Ruleset Version 10.
 * Its ordinary organization `party` holds the campaign Party with a militia.
 * Ana has Vessa with her Companion Bryn and a campaign homebrew feat; Bo has
 * Rook, the militia's officer; Cy has Cole in the campaign and Lone outside
 * it. Bo is the organization's admin. Every Character is made through the
 * public sheet create.
 */
async function partyDeployment() {
  const { t, receipt, args } = await closedAndBackfilled(modules);
  const run = { runId: receipt.runId, epoch: receipt.epoch };
  await t.mutation(internal.initialMigration.activate, args);
  await t.mutation(internal.initialMigration.publish, {
    ...run,
    activationId: args.activationId,
    page: 0,
  });
  await finishBackgroundWork(t);
  await t.mutation(internal.initialMigration.smoke, { ...run, smokeId: 's' });
  const { epoch: writeEpoch } = await t.mutation(
    internal.initialMigration.reopen,
    { ...run, observedFrontendBuild: frontendBuild },
  );
  const campaignId = await t.run(async (ctx) => {
    for (const [name, role] of [
      ['ana', 'member'],
      ['bo', 'admin'],
      ['cy', 'member'],
    ] as const) {
      const orgIds = [{ orgId: organizationId, role, webhookUpdatedAt: 1 }];
      const userId = await ctx.db.insert('user', {
        tokenIdentifier: token(name),
        name: `${name} player`,
        webhookUpdatedAt: 1,
        orgIds,
      });
      await syncOrganizationMemberships(ctx, userId, orgIds);
    }
    return ctx.db.insert('campaign', {
      name: 'Party',
      description: '',
      organizationId,
      ownerId: token('bo'),
    });
  });
  const ana = t.withIdentity({ tokenIdentifier: token('ana') });
  const bo = t.withIdentity({ tokenIdentifier: token('bo') });
  const cy = t.withIdentity({ tokenIdentifier: token('cy') });
  const create = (
    viewer: Viewer,
    name: string,
    {
      kind = 'pc',
      inCampaign = true,
    }: { kind?: 'pc' | 'npc'; inCampaign?: boolean } = {},
  ) =>
    viewer.mutation(api.characterSheet.create, {
      ...(inCampaign ? { campaignId, organizationId } : {}),
      name,
      kind,
      operationId: `create-${name}`,
      writeEpoch,
    });
  const vessaId = await create(ana, 'Vessa');
  const brynId = await create(ana, 'Bryn', { kind: 'npc' });
  await ana.mutation(api.companionRelationships.link, {
    associatedCharacterId: vessaId,
    companionCharacterId: brynId,
    kind: 'cohort',
    sources: [{ key: 'bond', label: 'Companion bond', enabled: true }],
    operationId: 'link',
    writeEpoch,
  });
  const featEntryId = await ana.mutation(api.catalogCopies.createOneOff, {
    characterId: vessaId,
    operationId: 'create-feat',
    definition: strongHeart,
    writeEpoch,
  });
  const featEntry = await t.run((ctx) =>
    ctx.db.get('characterSheetEntry', featEntryId),
  );
  if (!featEntry || !('catalogEntryId' in featEntry))
    throw new Error('Feat missing');
  const campaignFeatId = featEntry.catalogEntryId;
  await ana.mutation(api.catalogCopies.saveToCatalog, {
    characterId: vessaId,
    catalogEntryId: campaignFeatId,
    operationId: 'save-feat',
    writeEpoch,
  });
  const rookId = await create(bo, 'Rook');
  const coleId = await create(cy, 'Cole');
  const loneId = await create(cy, 'Lone', { inCampaign: false });

  // Bo sets up the militia with Rook as its officer and team manager.
  const setup = acceptedCampaignSetup(rookId);
  const options = await bo.query(api.canonicalSetup.options, { campaignId });
  const person = options?.characters.find(
    (entry) => entry.characterId === rookId,
  );
  if (!person) throw new Error('Missing reviewed militia Character');
  const { name: _name, ...facts } = person;
  setup.state.militiaSnapshot.characters = [facts];
  const militia = await bo.mutation(api.canonicalSetup.initialize, {
    campaignId,
    initializationId: 'party-militia',
    setup,
    writeEpoch,
  });
  return {
    t,
    run: { ...run, epoch: writeEpoch },
    writeEpoch,
    campaignId,
    militia,
    ana,
    bo,
    cy,
    vessaId,
    brynId,
    featEntryId,
    campaignFeatId,
    rookId,
    coleId,
    loneId,
  };
}
type Deployment = Awaited<ReturnType<typeof partyDeployment>>;

function removeMember(t: Deployment['t'], userId: string, updatedAt = 2) {
  return deliver(t, {
    type: 'organizationMembership.deleted',
    userId,
    orgId: organizationId,
    updatedAt,
  });
}

function readCharacter(t: Deployment['t'], characterId: Id<'character'>) {
  return t.run((ctx) => ctx.db.get('character', characterId));
}

/** The Character's sheet entries, as an invariant. */
function readEntries(t: Deployment['t'], characterId: Id<'character'>) {
  return t.run((ctx) =>
    ctx.db
      .query('characterSheetEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .take(256),
  );
}

function readDepartures(t: Deployment['t']) {
  return t.run((ctx) => ctx.db.query('organizationDeparture').take(10));
}

function readFailures(t: Deployment['t']) {
  return t.run((ctx) =>
    ctx.db.query('organizationDepartureCharacter').take(10),
  );
}

test('a departure under sheet authority returns the departed owner’s Companion group outside any campaign, Full, with campaign homebrew as Catalog Copies', async () => {
  const {
    t,
    ana,
    bo,
    campaignId,
    vessaId,
    brynId,
    featEntryId,
    campaignFeatId,
  } = await partyDeployment();

  await removeMember(t, 'ana');
  expect(await outcome(readSheet(ana, vessaId))).toBe('Character not found');
  await finishBackgroundWork(t);

  for (const characterId of [vessaId, brynId]) {
    const returned = await readSheet(ana, characterId);
    expect(returned?.campaign).toBeNull();
    expect(returned?.character.sheetMode).toBe('full');
    expect(returned?.updatedBy).toBe(organizationDepartureActor);
    expect(await outcome(readSheet(bo, characterId))).toBe(
      'Character not found',
    );
  }
  expect(await ana.query(api.character.listOwned, {})).toMatchObject([
    {
      kind: 'noCampaign',
      characters: expect.arrayContaining([
        expect.objectContaining({ _id: vessaId }),
        expect.objectContaining({ _id: brynId }),
      ]),
    },
  ]);
  expect(
    await ana.query(api.companionRelationships.list, { characterId: vessaId }),
  ).toMatchObject([{ status: 'active', endpoint: { characterId: brynId } }]);
  const vessa = withSheetCatalog(await readSheet(ana, vessaId));
  const feat = vessa?.entries.find((entry) => entry._id === featEntryId);
  if (!feat || !('catalogEntryId' in feat)) throw new Error('Feat missing');
  expect(feat.catalogEntryId).not.toBe(campaignFeatId);
  expect(
    vessa?.catalogEntries.find((entry) => entry._id === feat.catalogEntryId),
  ).toMatchObject({
    scope: 'character',
    characterId: vessaId,
    name: 'Strong heart',
    copiedFrom: campaignFeatId,
  });
  // The campaign keeps its own definition for the remaining members.
  expect(
    await t.run((ctx) => ctx.db.get('catalogEntry', campaignFeatId)),
  ).toMatchObject({ scope: 'campaign', campaignId });
  expect(await readDepartures(t)).toMatchObject([
    { state: 'completed', outcome: 'returned' },
  ]);
  expect((await readDepartures(t))[0]?.legacyRetained).toBeUndefined();
  expect(await readFailures(t)).toEqual([]);
});

test('a departing officer’s assignment is corrected by the system actor under Ruleset Version 10, and the finished week stays as it was', async () => {
  const { t, ana, bo, campaignId, militia, rookId, writeEpoch } =
    await partyDeployment();
  for (const [baseRevision, edit] of initializationEdits(
    'patrol',
    rookId,
  ).entries())
    await bo.mutation(api.canonicalDraftPersistence.edit, {
      campaignId,
      militiaId: militia.militiaId,
      operation: {
        draftId: militia.draftId,
        operationId: `edit-${baseRevision}`,
        baseRevision,
        edit,
      },
      writeEpoch,
    });
  const preview = await bo.query(
    api.canonicalDraftPersistence.preview,
    militia,
  );
  expect(preview).toMatchObject({
    status: 'ready',
    reviewed: { rulesetVersion: 10 },
  });
  await bo.mutation(api.canonicalDraftPersistence.confirm, {
    ...militia,
    operation: { operationId: 'confirm', reviewed: preview.reviewed },
    writeEpoch,
  });
  const historyArgs = { campaignId, week: 9 };
  const history = await ana.query(api.canonicalHistory.read, historyArgs);
  expect(history?.record.rulesetVersion).toBe(10);

  await removeMember(t, 'bo');
  await finishBackgroundWork(t);

  expect((await readSheet(bo, rookId))?.campaign).toBeNull();
  const ledger = { campaignId, militiaId: militia.militiaId };
  const { militiaSnapshot } = (
    await ana.query(api.canonicalLedger.read, ledger)
  ).state;
  expect(militiaSnapshot.roster.officers).toEqual([]);
  expect(militiaSnapshot.roster.people).toEqual([]);
  expect(
    militiaSnapshot.roster.teams.every(
      (team) => team.managerCharacterId === null,
    ),
  ).toBe(true);
  const corrections = await t.run((ctx) =>
    ctx.db
      .query('canonicalSourceCorrection')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', militia.militiaId))
      .take(10),
  );
  expect(corrections).toMatchObject([
    {
      actor: organizationDepartureActor,
      reason: 'Automatic Character departure: Rook',
    },
  ]);
  // The next week, which the correction reopened for review, stays on 10.
  const next = await ana.query(api.canonicalDraftPersistence.workspace, {
    campaignId,
  });
  if (!next) throw new Error('Missing next week');
  expect(
    (await ana.query(api.canonicalDraftPersistence.preview, next.key)).reviewed
      .rulesetVersion,
  ).toBe(10);
  expect(await ana.query(api.canonicalHistory.read, historyArgs)).toEqual(
    history,
  );
});

test('an account deletion under sheet authority makes the campaign Character ownerless with every row kept and deletes the private one', async () => {
  const { t, ana, campaignId, coleId, loneId } = await partyDeployment();
  const entries = await readEntries(t, coleId);

  await deliver(t, { type: 'user.deleted', userId: 'cy' });
  await finishBackgroundWork(t);

  const cole = await readSheet(ana, coleId);
  expect(cole?.campaign).toMatchObject({ campaignId });
  expect(cole?.owner).toBeNull();
  expect((await readCharacter(t, coleId))?.ownerId).toBeUndefined();
  expect(await readEntries(t, coleId)).toEqual(entries);
  expect(await readCharacter(t, loneId)).toBeNull();
  expect(await readEntries(t, loneId)).toEqual([]);
  const deletion = await t.run((ctx) =>
    ctx.db.query('accountDeletion').first(),
  );
  expect(deletion).toMatchObject({ state: 'completed' });
  expect(deletion?.legacyRetained).toBeUndefined();
});

test('an account deleted within the grace after a removal wins: the Companion group stays in the campaign, ownerless', async () => {
  const { t, bo, campaignId, vessaId, brynId } = await partyDeployment();
  await removeMember(t, 'ana');
  vi.advanceTimersByTime(departureGraceMs - 1000);
  await t.finishInProgressScheduledFunctions();
  await deliver(t, { type: 'user.deleted', userId: 'ana' });
  await finishBackgroundWork(t);

  for (const characterId of [vessaId, brynId]) {
    const sheet = await readSheet(bo, characterId);
    expect(sheet?.campaign).toMatchObject({ campaignId });
    expect(sheet?.owner).toBeNull();
    // Ownerless, not kept under the deleted account.
    expect((await readCharacter(t, characterId))?.ownerId).toBeUndefined();
  }
  expect(await readDepartures(t)).toMatchObject([
    { state: 'completed', outcome: 'accountDeleted' },
  ]);
});

test('an organization deleted outside the app returns every member’s Characters and keeps the campaign whole', async () => {
  const { t, ana, bo, cy, campaignId, vessaId, brynId, rookId, coleId } =
    await partyDeployment();

  await deliver(t, { type: 'organization.deleted', orgId: organizationId });
  await finishBackgroundWork(t);

  for (const [viewer, characterId] of [
    [ana, vessaId],
    [ana, brynId],
    [bo, rookId],
    [cy, coleId],
  ] as const) {
    const sheet = await readSheet(viewer, characterId);
    expect(sheet?.campaign).toBeNull();
    expect(sheet?.updatedBy).toBe(organizationDepartureActor);
  }
  expect(
    await t.run((ctx) => ctx.db.get('campaign', campaignId)),
  ).toMatchObject({ name: 'Party' });
  expect(
    await t.run((ctx) => ctx.db.query('organizationDeletion').first()),
  ).toMatchObject({ state: 'completed', legacyRetained: 1 });
});

test('a closed gate still holds a departure without counting a failure, and the membership backfill is refused until reopening', async () => {
  const { t, ana, bo, vessaId, run } = await partyDeployment();
  await removeMember(t, 'ana');
  const { epoch } = await t.mutation(
    internal.initialMigration.closeForRepair,
    run,
  );
  await expect(
    t.mutation(internal.organizationMembership.backfill, { cursor: null }),
  ).rejects.toThrow('MAINTENANCE');
  vi.advanceTimersByTime(departureGraceMs);
  for (let step = 0; step < 3; step++) await runDueWork(t);
  expect(await readDepartures(t)).toMatchObject([{ state: 'returning' }]);
  expect(await readFailures(t)).toEqual([]);
  expect((await readSheet(bo, vessaId))?.campaign).not.toBeNull();

  await t.mutation(internal.initialMigration.smoke, {
    ...run,
    epoch,
    smokeId: 'repair',
  });
  await t.mutation(internal.initialMigration.reopen, {
    ...run,
    epoch,
    observedFrontendBuild: frontendBuild,
  });
  await finishBackgroundWork(t);
  expect((await readSheet(ana, vessaId))?.campaign).toBeNull();
  expect(await readDepartures(t)).toMatchObject([
    { state: 'completed', outcome: 'returned' },
  ]);
});

test('no flat Character exists after a real activation, publication and reopening, so the drivers retain none', async () => {
  const { t, bo, campaignId, writeEpoch } = await partyDeployment();
  // Even the ledger's flat create makes a sheet under sheet authority.
  await bo.mutation(api.character.createCharacter, {
    organizationId,
    character: {
      campaignId,
      name: 'Scout',
      description: '',
      kind: 'npc',
      level: 2,
      strength: 12,
      dexterity: 14,
      constitution: 10,
      intelligence: 10,
      wisdom: 13,
      charisma: 8,
    },
    writeEpoch,
  });
  const characters = await t.run((ctx) => ctx.db.query('character').take(64));
  expect(characters.filter((character) => !character.sheetMode)).toEqual([]);

  await removeMember(t, 'bo');
  await finishBackgroundWork(t);
  const [departure] = await readDepartures(t);
  expect(departure).toMatchObject({ state: 'completed', outcome: 'returned' });
  expect(departure?.legacyRetained).toBeUndefined();
});

test('in-app campaign and organization deletion stay refused for an ordinary campaign under sheet authority', async () => {
  const { bo, campaignId, writeEpoch } = await partyDeployment();
  await expect(
    bo.mutation(api.campaignDeletions.request, {
      campaignId,
      organizationId,
      writeEpoch,
    }),
  ).rejects.toThrow("Deleting isn't available for this campaign yet.");
  await expect(
    bo.mutation(api.organizationDeletions.request, {
      organizationId,
      writeEpoch,
    }),
  ).rejects.toThrow("Deleting isn't available for this organization yet.");
});
