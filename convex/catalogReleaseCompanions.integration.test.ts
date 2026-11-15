// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import {
  activationArgs,
  discover,
  impactAdapter,
  prepare,
  releaseFixture,
  type ReleaseTest,
} from '../tests/catalog-release-fixture';
import { elfAbilityBody, installElf } from '../tests/catalog-release-elf';
import {
  campaignFixture,
  createCharacter,
  deliver,
  finishBackgroundWork,
} from '../tests/container-deletion';
import { permanentMilitiaFacts } from '../tests/militia-companion-facts';
import { initializationEdits } from '../tests/rules/initialization-edits';
import {
  bipedEidolon,
  linkSummonerAndEidolon,
  preparedCampaign,
} from '../tests/summoner-eidolon';
import { runCatalogReleaseImpactCommand } from '../scripts/catalog/release-impact-command';
import { api, internal } from './_generated/api';
import schema from './schema';
import type { Id } from './_generated/dataModel';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import { representativeClassCatalog } from './lib/representativeClassCatalog';
import { retainedPriorCalculationIdentity } from '../src/lib/catalog/calculation-identities';

// PRD #251 decisions 15, 16 and 18 (#712): a Catalog Release calculates a
// linked Companion's Militia Character Facts with its associated Character's
// inputs from the same release, and only changed facts stale a review.
// The provider's signature verifier is the external boundary; the real HTTP
// route runs beneath it without provider credentials.
vi.mock('svix', () => ({
  Webhook: class {
    verify(payload: string, headers: Record<string, string>) {
      if (headers['svix-signature'] !== 'valid')
        throw new Error('Invalid signature');
      return JSON.parse(payload);
    }
  },
}));

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
preloadCalledConvexModules({ modules, testFile: import.meta.url });
// Provider deliveries reach these modules through the HTTP route.
beforeAll(async () => {
  for (const name of ['http', 'clerk', 'user'])
    await modules[`./${name}.ts`]?.();
}, 30_000);
afterEach(() => vi.useRealTimers());

type Client = Awaited<ReturnType<typeof releaseFixture>>['owner'];

/**
 * The elf's Ability Scores trait was admitted before its Modifiers were
 * curated; the release adds CRB p. 22's +2 Dex, +2 Int and −2 Con.
 */
async function installUncuratedElf(t: ReleaseTest) {
  const elf = await installElf(t);
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', elf.ability, { modifiers: [] }),
  );
  return elf;
}

const elfAbilityRelease = {
  kind: 'definition' as const,
  key: elfAbilityBody.externalKey,
  payload: elfAbilityBody,
};

/**
 * A 2nd-level wizard (CRB p. 77) and an unlinked classless cat. `link`
 * makes the cat the wizard's familiar (CRB p. 82) through the first wizard
 * level's arcane bond; the familiar's Intelligence follows the wizard's
 * class level (6 at 1st–2nd, 7 at 3rd–4th).
 */
async function wizardAndCat({
  t,
  owner,
  create,
  wizardId,
}: {
  t: ReleaseTest;
  owner: Client;
  create: (name: string) => Promise<Id<'character'>>;
  wizardId: Id<'character'>;
}) {
  const definition = representativeClassCatalog.find(
    (row) => row.ruleIdentity === 'wizard',
  );
  if (!definition) throw new Error('Representative Wizard unavailable');
  const wizardClassId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      ...definition,
      scope: 'character',
      characterId: wizardId,
    }),
  );
  const firstLevel = (
    await owner.query(api.characterSheet.read, { characterId: wizardId })
  )?.entries.find((row) => row.kind === 'classLevel');
  if (!firstLevel) throw new Error('Missing wizard level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId: wizardId,
    entryId: firstLevel._id,
    classEntryId: wizardClassId,
    hpGained: 6,
    operationId: 'wizard-one',
  });
  await owner.mutation(api.characterSheet.addClassLevel, {
    characterId: wizardId,
    classEntryId: wizardClassId,
    operationId: 'wizard-two',
  });
  const catId = await create('Cat');
  const creatureLevel = (
    await owner.query(api.characterSheet.read, { characterId: catId })
  )?.entries.find((row) => row.kind === 'classLevel');
  if (!creatureLevel) throw new Error('Missing companion level');
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    characterId: catId,
    entryId: creatureLevel._id,
    operationId: 'cat-creature-hd',
  });
  const link = () =>
    owner.mutation(api.companionRelationships.link, {
      associatedCharacterId: wizardId,
      companionCharacterId: catId,
      kind: 'familiar',
      sources: [
        {
          key: 'wizard',
          label: 'Arcane bond',
          enabled: true,
          sheetEntryId: firstLevel._id,
        },
      ],
      operationId: 'cat-familiar',
    });
  const chooseCat = (relationshipId: Id<'companionRelationship'>) =>
    owner.mutation(api.characterSheetFamiliars.selectBaseCreature, {
      characterId: catId,
      relationshipId,
      baseCreatureKey: 'cat',
      operationId: 'cat-creature',
    });
  return { catId, wizardClassId, link, chooseCat };
}

async function wizardWithCat(options: Parameters<typeof wizardAndCat>[0]) {
  const pair = await wizardAndCat(options);
  const relationshipId = await pair.link();
  await pair.chooseCat(relationshipId);
  return { ...pair, relationshipId };
}

/**
 * What a Character's own permanent sheet says the militia reads without
 * Companion Progression: its level, racial Hit Dice and six permanent
 * scores. A familiar's effective Hit Dice are never among them.
 */
function sheetFacts(sheet: Parameters<typeof permanentMilitiaFacts>[0]) {
  const { actualHitDice: _effective, ...facts } = permanentMilitiaFacts(sheet);
  const racialHitDice = sheet?.permanentCalculated.racialHitDice ?? 0;
  return { ...facts, ...(racialHitDice ? { racialHitDice } : {}) };
}

/** Prepares the accepted week until its preview is ready to confirm. */
async function reviewWeek(
  owner: Client,
  accepted: Awaited<ReturnType<typeof seedAcceptedCampaign>>,
  campaignId: Id<'campaign'>,
) {
  const draft = await owner.query(
    api.canonicalDraftPersistence.observe,
    accepted.key,
  );
  const edits = initializationEdits('patrol', accepted.characterId);
  for (const [index, edit] of edits.entries())
    await owner.mutation(api.canonicalDraftPersistence.edit, {
      campaignId,
      militiaId: accepted.key.militiaId,
      operation: {
        draftId: accepted.key.draftId,
        operationId: `review-${index}`,
        baseRevision: (draft?.revision ?? 0) + index,
        edit,
      },
    });
  const preview = await owner.query(
    api.canonicalDraftPersistence.preview,
    accepted.key,
  );
  expect(preview.status).toBe('ready');
  return preview.reviewed;
}

async function getWork(
  t: ReleaseTest,
  runId: Id<'catalogImpactRun'>,
  characterId: Id<'character'>,
) {
  const row = await t.run((ctx) =>
    ctx.db
      .query('catalogImpactWork')
      .withIndex('by_runId_and_characterId', (q) =>
        q.eq('runId', runId).eq('characterId', characterId),
      )
      .unique(),
  );
  if (!row) throw new Error('Missing candidate work');
  return row;
}

function readCampaignFacts(
  t: ReleaseTest,
  runId: Id<'catalogImpactRun'>,
  campaignId: Id<'campaign'>,
) {
  return t.run((ctx) =>
    ctx.db
      .query('catalogCampaignFacts')
      .withIndex('by_runId_and_campaignId', (q) =>
        q.eq('runId', runId).eq('campaignId', campaignId),
      )
      .unique(),
  );
}

/** Evaluates and completes each Character's dirty work once. */
async function reconcileAll(
  t: ReleaseTest,
  runId: Id<'catalogImpactRun'>,
  characterIds: Id<'character'>[],
) {
  const evaluations = new Map<
    Id<'character'>,
    Awaited<ReturnType<typeof evaluate>>
  >();
  for (const characterId of characterIds) {
    const evaluation = await evaluate(t, runId, characterId);
    expect(
      await t.mutation(internal.catalogReleaseImpact.complete, {
        runId,
        characterId,
        evaluation,
      }),
    ).toBe(true);
    evaluations.set(characterId, evaluation);
  }
  return evaluations;
}

function evaluate(
  t: ReleaseTest,
  runId: Id<'catalogImpactRun'>,
  characterId: Id<'character'>,
) {
  return t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId,
  });
}

test('a familiar reads its wizard at the same release boundary: only the wizard’s changed facts stale the review, and a resolver-only release keeps every generation', async () => {
  vi.useFakeTimers();
  const { t, owner, create, campaignId, scope } = await releaseFixture(modules);
  const accepted = await owner.run((ctx) =>
    seedAcceptedCampaign(ctx, campaignId),
  );
  const wizardId = scope.characterId;
  const elf = await installUncuratedElf(t);
  await owner.mutation(api.characterSheet.selectRace, {
    characterId: wizardId,
    catalogEntryId: elf.elf,
    operationId: 'wizard-elf',
  });
  const { catId } = await wizardWithCat({ t, owner, create, wizardId });
  const ledgerScope = { campaignId, militiaId: accepted.key.militiaId };
  const readLedgerFacts = async (characterId: Id<'character'>) =>
    (
      await owner.query(api.canonicalLedger.read, ledgerScope)
    ).state.militiaSnapshot.characters.find(
      (row) => row.characterId === characterId,
    );
  const catBefore = await readLedgerFacts(catId);
  expect(catBefore).toMatchObject({ level: 0, intelligence: 6 });
  const wizardBefore = await readLedgerFacts(wizardId);
  const reviewed = await reviewWeek(owner, accepted, campaignId);
  const draft = await owner.query(
    api.canonicalDraftPersistence.observe,
    accepted.key,
  );

  const base = await prepare(
    t,
    [elfAbilityRelease],
    1,
    null,
    retainedPriorCalculationIdentity,
  );
  const runId = await discover(t);
  const evaluations = await reconcileAll(t, runId, [wizardId, catId]);
  // The familiar is affected through its wizard and calculates with the
  // wizard's candidate inputs, so its facts stay equal.
  expect(evaluations.get(catId)?.result).toMatchObject({
    kind: 'ready',
    hasFactsChanged: false,
    reasons: expect.arrayContaining([
      'key:local/race-ability-scores/pf1/NgIhxRI0axrf3fcO',
    ]),
    facts: catBefore,
  });
  expect(evaluations.get(wizardId)?.result).toMatchObject({
    kind: 'ready',
    hasFactsChanged: true,
    facts: {
      dexterity: (wizardBefore?.dexterity ?? 0) + 2,
      intelligence: (wizardBefore?.intelligence ?? 0) + 2,
      constitution: (wizardBefore?.constitution ?? 0) - 2,
    },
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId }),
  ).toBe(true);
  // Until activation every reader keeps the complete old view.
  const readListedCharacter = async (characterId: Id<'character'>) =>
    (
      await owner.query(api.character.listCampaignCharacters, {
        campaignId,
        organizationId: 'org',
      })
    ).find((row) => row.character._id === characterId)?.character;
  expect(await readLedgerFacts(wizardId)).toEqual(wizardBefore);
  expect(await readListedCharacter(wizardId)).toMatchObject({
    dexterity: wizardBefore?.dexterity,
  });
  expect(
    sheetFacts(
      await owner.query(api.characterSheet.read, { characterId: wizardId }),
    ),
  ).toMatchObject({ dexterity: wizardBefore?.dexterity });
  await t.mutation(internal.catalogReleaseActivation.activate, {
    ...activationArgs(runId),
    calculationIdentity: retainedPriorCalculationIdentity,
  });

  // One boundary: the ledger and the ordinary sheet read agree.
  expect(await readLedgerFacts(catId)).toEqual(catBefore);
  expect(await readLedgerFacts(catId)).toMatchObject(
    sheetFacts(
      await owner.query(api.characterSheet.read, { characterId: catId }),
    ),
  );
  expect(await readLedgerFacts(wizardId)).toMatchObject(
    sheetFacts(
      await owner.query(api.characterSheet.read, { characterId: wizardId }),
    ),
  );
  expect(await readListedCharacter(wizardId)).toMatchObject({
    dexterity: (wizardBefore?.dexterity ?? 0) + 2,
  });
  expect(await getWork(t, runId, catId)).toMatchObject({ factGeneration: 0 });
  expect(await getWork(t, runId, wizardId)).toMatchObject({
    factGeneration: 1,
  });
  // The campaign's facts changed once, for the wizard alone.
  expect(await readCampaignFacts(t, runId, campaignId)).toMatchObject({
    generation: 1,
  });
  const stale = await owner.query(
    api.canonicalDraftPersistence.preview,
    accepted.key,
  );
  expect(stale.reviewed).not.toEqual(reviewed);
  await expect(
    owner.mutation(api.canonicalDraftPersistence.confirm, {
      ...accepted.key,
      operation: { operationId: 'stale-review', reviewed },
    }),
  ).rejects.toThrow();
  // The saved draft fields survive publication.
  expect(
    await owner.query(api.canonicalDraftPersistence.observe, accepted.key),
  ).toEqual(draft);

  // A resolver-only release recalculates everyone with the same release
  // bodies; equal facts keep their generations and the fresh review holds.
  const fresh = await owner.query(
    api.canonicalDraftPersistence.preview,
    accepted.key,
  );
  expect(fresh.status).toBe('ready');
  await prepare(t, [elfAbilityRelease], 2, {
    releaseNumber: 1,
    artifactFingerprint: base.manifest.artifactFingerprint,
  });
  const resolverRun = await discover(t, 2);
  for (const [characterId, evaluation] of await reconcileAll(t, resolverRun, [
    wizardId,
    catId,
  ]))
    expect(evaluation.result, characterId).toMatchObject({
      kind: 'ready',
      hasFactsChanged: false,
      reasons: ['calculation'],
    });
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, {
      runId: resolverRun,
    }),
  ).toBe(true);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(resolverRun, 2),
  );
  expect(await getWork(t, resolverRun, catId)).toMatchObject({
    factGeneration: 0,
  });
  expect(await getWork(t, resolverRun, wizardId)).toMatchObject({
    factGeneration: 1,
  });
  expect(await readCampaignFacts(t, resolverRun, campaignId)).toMatchObject({
    generation: 1,
  });
  expect(
    (await owner.query(api.canonicalDraftPersistence.preview, accepted.key))
      .reviewed,
  ).toEqual(fresh.reviewed);
  await owner.mutation(api.canonicalDraftPersistence.confirm, {
    ...accepted.key,
    operation: { operationId: 'fresh-review', reviewed: fresh.reviewed },
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}, 30_000);

test('links, partial familiar inputs, wizard edits and reassignment during reconciliation dirty the familiar, refuse obsolete workers and publish its latest facts', async () => {
  const { t, owner, outsider, create, campaignId, scope } =
    await releaseFixture(modules);
  const memberId = await t.run((ctx) =>
    ctx.db.insert('user', {
      tokenIdentifier: 'test|member',
      orgIds: [{ orgId: 'org', role: 'member' }],
    }),
  );
  const wizardId = scope.characterId;
  const elf = await installUncuratedElf(t);
  await owner.mutation(api.characterSheet.selectRace, {
    characterId: wizardId,
    catalogEntryId: elf.elf,
    operationId: 'wizard-elf',
  });
  const { catId, wizardClassId, link, chooseCat } = await wizardAndCat({
    t,
    owner,
    create,
    wizardId,
  });
  await prepare(t, [elfAbilityRelease]);
  const runId = await discover(t);
  // Before its link, the cat reads nothing the release changes.
  await reconcileAll(t, runId, [catId]);
  expect(await getWork(t, runId, catId)).toMatchObject({ state: 'unaffected' });

  // Newly linked after discovery, with the creature still unchosen: the
  // link dirties the cat and its candidate now follows the wizard.
  const relationshipId = await link();
  expect(await getWork(t, runId, catId)).toMatchObject({ state: 'dirty' });
  // Its Intelligence already reads the wizard; the creature's own Hit Dice
  // are absent until it is chosen.
  const partial = await evaluate(t, runId, catId);
  expect(partial.result).toMatchObject({
    kind: 'ready',
    reasons: expect.arrayContaining([
      'key:local/race-ability-scores/pf1/NgIhxRI0axrf3fcO',
    ]),
    facts: { level: 0, intelligence: 6 },
  });
  expect(partial.result).not.toHaveProperty('facts.racialHitDice');
  // Choosing the creature lands before that worker completes.
  await chooseCat(relationshipId);
  expect(
    await t.mutation(internal.catalogReleaseImpact.complete, {
      runId,
      characterId: catId,
      evaluation: partial,
    }),
  ).toBe(false);
  const chosen = await evaluate(t, runId, catId);
  expect(chosen.result).toMatchObject({
    kind: 'ready',
    hasFactsChanged: false,
    facts: { level: 0, racialHitDice: 1, intelligence: 6 },
  });

  // The wizard's third level is an active edit: it succeeds, dirties both
  // Characters and fences both earlier workers.
  const wizardEvaluation = await evaluate(t, runId, wizardId);
  await owner.mutation(api.characterSheet.addClassLevel, {
    characterId: wizardId,
    classEntryId: wizardClassId,
    operationId: 'wizard-three',
  });
  for (const [characterId, evaluation] of [
    [wizardId, wizardEvaluation],
    [catId, chosen],
  ] as const)
    expect(
      await t.mutation(internal.catalogReleaseImpact.complete, {
        runId,
        characterId,
        evaluation,
      }),
    ).toBe(false);
  // Reassigning the cat inside the campaign keeps the link and dirties it
  // again; its next worker reads the current owner.
  const beforeReassign = await evaluate(t, runId, catId);
  await owner.mutation(api.character.reassignOwner, {
    characterId: catId,
    campaignId,
    ownerUserId: memberId,
    operationId: 'cat-to-member',
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.complete, {
      runId,
      characterId: catId,
      evaluation: beforeReassign,
    }),
  ).toBe(false);
  const evaluations = await reconcileAll(t, runId, [wizardId, catId]);
  expect(evaluations.get(catId)?.result).toMatchObject({
    kind: 'ready',
    hasFactsChanged: false,
    facts: { intelligence: 7 },
  });
  expect(
    await t.query(internal.catalogReleaseImpact.status, { runId }),
  ).toMatchObject({ pendingCount: 0, failedCount: 0, isReady: true });
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId }),
  ).toBe(true);
  // Production keeps legacy authority: only fixture activation is allowed.
  await expect(
    t.mutation(internal.catalogReleaseActivation.activate, {
      ...activationArgs(runId),
      isFixtureOnly: false,
    }),
  ).rejects.toThrow();
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(runId),
  );
  for (const characterId of [wizardId, catId])
    await expect(
      outsider.query(api.characterSheet.read, { characterId }),
    ).rejects.toThrow();
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const cat = await member.query(api.characterSheet.read, {
    characterId: catId,
  });
  expect(cat?.character.sheetPermanentFacts).toMatchObject({
    ...sheetFacts(cat),
    intelligence: 7,
  });
  expect((await getWork(t, runId, catId)).facts).toMatchObject(sheetFacts(cat));
}, 30_000);

/** Evaluates and completes every dirty Character once. */
async function reconcileDirty(t: ReleaseTest, runId: Id<'catalogImpactRun'>) {
  const dirty = await t.query(internal.catalogReleaseImpact.inspectWork, {
    runId,
    state: 'dirty',
    paginationOpts: {
      cursor: null,
      numItems: 32,
      maximumRowsRead: 32,
      maximumBytesRead: 512000,
    },
  });
  return reconcileAll(
    t,
    runId,
    dirty.page.map((row) => row.characterId),
  );
}

test('an eidolon without counting sources keeps its unresolved facts through a resolver-only release until a restored source resolves them', async () => {
  const t = convexTest(schema, modules);
  const { owner, member, campaignId } = await preparedCampaign(
    t,
    'release-eidolon',
  );
  const accepted = await owner.run((ctx) =>
    seedAcceptedCampaign(ctx, campaignId),
  );
  const { eidolonId, relationshipId } = await linkSummonerAndEidolon({
    t,
    owner,
    member,
    campaignId,
  });
  await member.mutation(api.characterSheet.setCompanionProgression, {
    characterId: eidolonId,
    operationId: 'eidolon',
    progression: bipedEidolon,
  });
  for (const sourceKey of ['eidolon', 'bond'])
    await owner.mutation(api.companionRelationships.setSourceEnabled, {
      relationshipId,
      sourceKey,
      enabled: false,
      operationId: `lose-${sourceKey}`,
    });
  const ledgerScope = { campaignId, militiaId: accepted.key.militiaId };
  const readEidolonFacts = async () =>
    (
      await member.query(api.canonicalLedger.read, ledgerScope)
    ).state.militiaSnapshot.characters.find(
      (row) => row.characterId === eidolonId,
    );
  const unresolved = await readEidolonFacts();
  expect(unresolved).toMatchObject({
    level: 0,
    actualHitDice: null,
    unresolvedAbilities: ['strength', 'dexterity', 'constitution'],
  });
  const base = await prepare(t, [], 1, null, retainedPriorCalculationIdentity);
  const baseRun = await discover(t);
  await reconcileDirty(t, baseRun);
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId: baseRun }),
  ).toBe(true);
  await t.mutation(internal.catalogReleaseActivation.activate, {
    ...activationArgs(baseRun),
    calculationIdentity: retainedPriorCalculationIdentity,
  });
  expect(await getWork(t, baseRun, eidolonId)).toMatchObject({
    state: 'ready',
    hasFactsChanged: false,
    facts: unresolved,
  });

  await prepare(t, [], 2, {
    releaseNumber: 1,
    artifactFingerprint: base.manifest.artifactFingerprint,
  });
  // The real operator command reconciles the run. A player restores a source
  // after the eidolon's first worker evaluated it, so that completion is
  // refused and the command reconciles the restored facts instead.
  const adapter = impactAdapter(t);
  const evaluations: Awaited<ReturnType<typeof adapter.evaluate>>[] = [];
  const result = await runCatalogReleaseImpactCommand({
    releaseNumber: 2,
    adapter: {
      ...adapter,
      complete: async (args) => {
        if (args.characterId === eidolonId) {
          evaluations.push(args.evaluation);
          if (evaluations.length === 1)
            await owner.mutation(api.companionRelationships.setSourceEnabled, {
              relationshipId,
              sourceKey: 'bond',
              enabled: true,
              operationId: 'restore-bond',
            });
        }
        return adapter.complete(args);
      },
    },
  });
  expect(result).toMatchObject({ stopped: 'ready', staleCompletionCount: 1 });
  const runId = result.runId;
  // Never a stale total or zero: the dormant candidate kept the scores
  // unresolved, and the restored one resolves them.
  expect(evaluations.map(({ result }) => result)).toMatchObject([
    { kind: 'ready', hasFactsChanged: false, facts: unresolved },
    { kind: 'ready', hasFactsChanged: false },
  ]);
  expect(evaluations[1]?.result).not.toHaveProperty(
    'facts.unresolvedAbilities',
  );
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(runId, 2),
  );
  const resolved = await readEidolonFacts();
  expect(resolved).not.toHaveProperty('unresolvedAbilities');
  expect(resolved).toMatchObject(
    permanentMilitiaFacts(
      await member.query(api.characterSheet.read, { characterId: eidolonId }),
    ),
  );
}, 30_000);

test('a wizard and familiar moving together during reconciliation are reconciled in the destination, where the carried elf copy still follows the release', async () => {
  const { t, owner, create, campaignId, scope } = await releaseFixture(modules);
  const destinationId = await t.run(async (ctx) => {
    const user = await ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', 'test|owner'),
      )
      .unique();
    if (user)
      await ctx.db.patch('user', user._id, { characterSheetDemo: true });
    return ctx.db.insert('campaign', {
      name: 'Destination',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'activation',
        version: 1,
        workerKey: '0',
        caseKey: 'destination',
        campaignKey: 'destination',
      },
    });
  });
  const wizardId = scope.characterId;
  const elf = await installUncuratedElf(t);
  await owner.mutation(api.characterSheet.selectRace, {
    characterId: wizardId,
    catalogEntryId: elf.elf,
    operationId: 'wizard-elf',
  });
  // The table customizes the elf for its campaign; its racial traits stay
  // global references.
  const campaignElf = await owner.mutation(
    api.catalogCopies.customizeForCampaign,
    {
      characterId: wizardId,
      catalogEntryId: elf.elf,
      operationId: 'campaign-elf',
    },
  );
  const { catId } = await wizardWithCat({ t, owner, create, wizardId });
  await prepare(t, [elfAbilityRelease]);
  const runId = await discover(t);
  const evaluations = await reconcileAll(t, runId, [wizardId, catId]);
  expect(evaluations.get(wizardId)?.result).toMatchObject({
    hasFactsChanged: true,
  });
  expect(await readCampaignFacts(t, runId, campaignId)).toMatchObject({
    changedCount: 1,
    generation: 1,
  });
  const beforeMove = await evaluate(t, runId, catId);

  // Moving the wizard takes its active same-owner familiar along.
  const command = { characterId: wizardId, operationId: 'to-destination' };
  let move = await owner.mutation(api.characterMoves.start, {
    ...command,
    destinationCampaignId: destinationId,
  });
  for (let step = 0; step < 150 && move.state !== 'completed'; step++)
    move = await owner.mutation(api.characterMoves.resume, command);
  expect(move.state).toBe('completed');
  for (const characterId of [wizardId, catId])
    expect(await getWork(t, runId, characterId)).toMatchObject({
      state: 'dirty',
    });
  expect(
    await t.mutation(internal.catalogReleaseImpact.complete, {
      runId,
      characterId: catId,
      evaluation: beforeMove,
    }),
  ).toBe(false);

  // The arrival carries a Character copy of the campaign's elf copy, whose
  // racial traits still follow the global Ability Scores.
  const arrived = await owner.query(api.characterSheet.read, {
    characterId: wizardId,
  });
  const race = arrived?.entries.find((row) => row.kind === 'race');
  if (race?.kind !== 'race') throw new Error('Missing carried race');
  const carried = await t.run((ctx) =>
    ctx.db.get('catalogEntry', race.catalogEntryId),
  );
  expect(carried).toMatchObject({
    scope: 'character',
    characterId: wizardId,
    copiedFrom: campaignElf,
    detail: { racialTraits: expect.arrayContaining([elf.ability]) },
  });
  const moved = await reconcileDirty(t, runId);
  expect(moved.get(wizardId)?.result).toMatchObject({
    kind: 'ready',
    hasFactsChanged: true,
    reasons: expect.arrayContaining([
      'key:local/race-ability-scores/pf1/NgIhxRI0axrf3fcO',
    ]),
  });
  expect(moved.get(catId)?.result).toMatchObject({
    kind: 'ready',
    hasFactsChanged: false,
  });
  for (const characterId of [wizardId, catId])
    expect(await getWork(t, runId, characterId)).toMatchObject({
      factCampaignId: destinationId,
    });
  // The source campaign's facts no longer change; the destination's do.
  expect(await readCampaignFacts(t, runId, campaignId)).toMatchObject({
    changedCount: 0,
    generation: 0,
  });
  expect(await readCampaignFacts(t, runId, destinationId)).toMatchObject({
    changedCount: 1,
    generation: 1,
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId }),
  ).toBe(true);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(runId),
  );
  // The destination has no militia: its Character list reads the selected
  // facts, complete with the new release like the sheet itself.
  const rows = await owner.query(api.character.listCampaignCharacters, {
    campaignId: destinationId,
    organizationId: 'org',
  });
  for (const characterId of [wizardId, catId]) {
    const sheet = await owner.query(api.characterSheet.read, { characterId });
    expect(sheet?.character.campaignId).toBe(destinationId);
    expect((await getWork(t, runId, characterId)).facts).toMatchObject(
      sheetFacts(sheet),
    );
    expect(
      rows.find((row) => row.character._id === characterId)?.character,
    ).toMatchObject(sheetFacts(sheet));
  }
}, 30_000);

test('losing organization membership during reconciliation returns the wizard with its familiar and reconciles both outside the campaign', async () => {
  vi.useFakeTimers();
  const { t, owner, campaignId } = await campaignFixture(modules);
  const wizardId = await createCharacter(owner, campaignId, 'Vessa');
  const elf = await installUncuratedElf(t);
  await owner.mutation(api.characterSheet.selectRace, {
    characterId: wizardId,
    catalogEntryId: elf.elf,
    operationId: 'wizard-elf',
  });
  const { catId } = await wizardWithCat({
    t,
    owner,
    create: (name) => createCharacter(owner, campaignId, name),
    wizardId,
  });
  await prepare(t, [elfAbilityRelease]);
  const runId = await discover(t);
  await reconcileAll(t, runId, [wizardId, catId]);
  const beforeReturn = await evaluate(t, runId, wizardId);

  // The trusted return moves the whole same-owner group in one publication.
  await deliver(t, {
    type: 'organizationMembership.deleted',
    userId: 'owner',
    orgId: 'org',
    updatedAt: 2,
  });
  await finishBackgroundWork(t);
  for (const characterId of [wizardId, catId]) {
    expect(
      (await owner.query(api.characterSheet.read, { characterId }))?.campaign,
    ).toBeNull();
    expect(await getWork(t, runId, characterId)).toMatchObject({
      state: 'dirty',
    });
  }
  expect(
    await t.mutation(internal.catalogReleaseImpact.complete, {
      runId,
      characterId: wizardId,
      evaluation: beforeReturn,
    }),
  ).toBe(false);
  const returned = await reconcileDirty(t, runId);
  expect(returned.get(wizardId)?.result).toMatchObject({
    kind: 'ready',
    hasFactsChanged: true,
  });
  expect(returned.get(catId)?.result).toMatchObject({
    kind: 'ready',
    hasFactsChanged: false,
  });
  for (const characterId of [wizardId, catId])
    expect(await getWork(t, runId, characterId)).not.toHaveProperty(
      'factCampaignId',
    );
  expect(await readCampaignFacts(t, runId, campaignId)).toMatchObject({
    changedCount: 0,
    generation: 0,
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId }),
  ).toBe(true);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(runId),
  );
  const cat = await owner.query(api.characterSheet.read, {
    characterId: catId,
  });
  expect((await getWork(t, runId, catId)).facts).toMatchObject(sheetFacts(cat));
  expect(
    (await owner.query(api.characterSheet.read, { characterId: wizardId }))
      ?.permanentCalculated.abilities.dexterity.score,
  ).toBe(12);
}, 30_000);
