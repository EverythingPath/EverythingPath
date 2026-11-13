// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { afterEach, expect, test, vi } from 'vitest';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import { appendResolutionRecord } from './lib/canonicalDraftStorage';
import { selectCharacterAuthority } from '../tests/character-authority';
import { initializationEdits } from '../tests/rules/initialization-edits';
import {
  activationArgs,
  prepare,
  reconcile,
} from '../tests/catalog-release-fixture';

const modules = import.meta.glob('./**/*.ts');
afterEach(() => vi.useRealTimers());

const stats = {
  level: 4,
  strength: 12,
  dexterity: 13,
  constitution: 14,
  intelligence: 15,
  wisdom: 16,
  charisma: 17,
};

/**
 * An ordinary deployment under sheet authority (#413): an ordinary campaign
 * with a militia, no fixture or demo marker, and a Character created through
 * the ledger, whose flat columns hold placeholders while its sheet holds the
 * submitted level and scores.
 */
async function ordinaryDeployment() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const member = t.withIdentity({ tokenIdentifier: 'test|player' });
  const seeded = await owner.run((ctx) => seedAcceptedCampaign(ctx));
  const campaignId = seeded.key.campaignId;
  await selectCharacterAuthority(t, 'sheet');
  const characterId = await owner.mutation(api.character.createCharacter, {
    organizationId: 'org',
    character: {
      campaignId,
      name: 'Vessa',
      description: '',
      kind: 'pc',
      ...stats,
    },
  });
  const militiaScope = { campaignId, militiaId: seeded.key.militiaId };
  const scope = { organizationId: 'org', characterId };
  const ledgerFacts = async (id: Id<'character'> = characterId) =>
    (
      await member.query(api.canonicalLedger.read, militiaScope)
    ).state.militiaSnapshot.characters.find((row) => row.characterId === id);
  const setupFacts = async (id: Id<'character'> = characterId) =>
    (
      await member.query(api.canonicalSetup.options, { campaignId })
    )?.characters.find((row) => row.characterId === id);
  return {
    t,
    owner,
    member,
    seeded,
    campaignId,
    characterId,
    scope,
    militiaScope,
    ledgerFacts,
    setupFacts,
  };
}

test('under sheet authority an ordinary Character created at level 4 publishes its sheet facts, also after a refresh that loads no sheet', async () => {
  const { t, member, characterId, scope, ledgerFacts, setupFacts } =
    await ordinaryDeployment();
  // The flat columns hold placeholders; the facts come from the sheet.
  expect(
    await t.run((ctx) => ctx.db.get('character', characterId)),
  ).toMatchObject({
    level: 1,
    strength: 10,
    charisma: 10,
    sheetMode: 'militiaOnly',
  });
  const expected = { characterId, ...stats, isActive: true };
  expect(await ledgerFacts()).toEqual(expected);
  expect(await setupFacts()).toMatchObject(expected);
  // A metadata edit and an archive round trip refresh the facts without
  // passing a loaded sheet.
  await member.mutation(api.character.updateCharacter, {
    ...scope,
    patch: { name: 'Vessa Vale', description: 'Notes only' },
  });
  expect(await ledgerFacts()).toEqual(expected);
  await member.mutation(api.character.archiveCharacter, {
    ...scope,
    isActive: false,
  });
  expect(await ledgerFacts()).toEqual({ ...expected, isActive: false });
  await member.mutation(api.character.archiveCharacter, {
    ...scope,
    isActive: true,
  });
  expect(await ledgerFacts()).toEqual(expected);
  expect(
    (await t.run((ctx) => ctx.db.get('character', characterId)))
      ?.sheetPermanentFacts,
  ).toMatchObject({ level: 4, strength: 12, charisma: 17 });
});

test('under sheet authority facts follow a level-up and a permanent ability change, and ignore temporary effects', async () => {
  const { owner, member, campaignId, scope, ledgerFacts, setupFacts } =
    await ordinaryDeployment();
  await member.mutation(api.character.updateCharacter, {
    ...scope,
    patch: { level: 5 },
  });
  expect(await ledgerFacts()).toMatchObject({ level: 5, strength: 12 });
  // CRB p. 555: ability drain is permanent until healed.
  await member.mutation(api.characterSheet.createAbilityChange, {
    ...scope,
    kind: 'abilityDrain',
    ability: 'strength',
    points: 3,
    operationId: 'drain',
  });
  expect(await ledgerFacts()).toMatchObject({ level: 5, strength: 9 });
  // Ability damage and a Spell Effect lasting a day or less are temporary.
  await member.mutation(api.characterSheet.createAbilityChange, {
    ...scope,
    kind: 'abilityDamage',
    ability: 'strength',
    points: 4,
    operationId: 'damage',
  });
  await member.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Short strength spell',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 1,
    },
    modifiers: [{ target: 'ability.str', bonusType: 'enhancement', value: 4 }],
    operationId: 'temporary-spell',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated.abilities
      .strength.score,
  ).toBe(13);
  await member.mutation(api.character.archiveCharacter, {
    ...scope,
    isActive: true,
  });
  expect(await ledgerFacts()).toMatchObject({ level: 5, strength: 9 });
  expect(await setupFacts()).toMatchObject({ level: 5, strength: 9 });

  // A Full sheet's level-up through the builder.
  const fullId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Built Character',
    kind: 'pc',
    operationId: 'full-create',
  });
  await owner.mutation(api.characterSheet.addClassLevel, {
    organizationId: 'org',
    characterId: fullId,
    operationId: 'level-2',
  });
  await owner.mutation(api.character.archiveCharacter, {
    organizationId: 'org',
    characterId: fullId,
    isActive: true,
  });
  expect(await ledgerFacts(fullId)).toMatchObject({ level: 2, strength: 10 });
  expect(await setupFacts(fullId)).toMatchObject({ level: 2, strength: 10 });
});

test('under sheet authority a frozen Resolution Record keeps its facts while the sheet changes', async () => {
  vi.useFakeTimers();
  const { t, owner, member, seeded, scope, militiaScope } =
    await ordinaryDeployment();
  const initial = await owner.query(api.canonicalLedger.read, militiaScope);
  await owner.mutation(api.canonicalLedger.save, {
    ...militiaScope,
    expectedRevision: initial.revision,
    reason: 'Enroll Vessa',
    snapshot: {
      ...initial.state.militiaSnapshot,
      roster: {
        ...initial.state.militiaSnapshot.roster,
        people: [
          ...initial.state.militiaSnapshot.roster.people,
          { characterId: scope.characterId, kind: 'pc', hitDice: 0 },
        ],
      },
    },
  });
  const edits = [
    ...initializationEdits('patrol', seeded.characterId),
    ...[5, 6].map((rank) => ({
      kind: 'acknowledge' as const,
      acknowledgement: {
        acknowledgementId: `vessa-boon:${rank}`,
        subjectId: `upkeep:boon:${rank}:${scope.characterId}`,
        outcome: 'Reward recorded',
      },
    })),
  ];
  for (const [baseRevision, edit] of edits.entries())
    await member.mutation(api.canonicalDraftPersistence.edit, {
      ...militiaScope,
      operation: {
        draftId: seeded.key.draftId,
        operationId: `review-edit-${baseRevision}`,
        baseRevision,
        edit,
      },
    });
  const reviewed = await owner.query(
    api.canonicalDraftPersistence.preview,
    seeded.key,
  );
  expect(reviewed.status).toBe('ready');
  const { record } = await owner.mutation(
    api.canonicalDraftPersistence.confirm,
    {
      ...seeded.key,
      operation: { operationId: 'confirmation', reviewed: reviewed.reviewed },
    },
  );
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  await owner.run((ctx) =>
    appendResolutionRecord(ctx, {
      ...militiaScope,
      record: {
        ...record,
        recordId: 'superseding-history',
        provenance: 'historical_correction',
        supersedesRecordId: record.recordId,
      },
    }),
  );
  const historyArgs = { campaignId: seeded.key.campaignId, week: 9 };
  const effective = await member.query(api.canonicalHistory.read, historyArgs);
  const superseded = await owner.query(api.canonicalHistory.read, {
    ...historyArgs,
    recordId: record.recordId,
  });
  expect(
    superseded?.record.sourceMilitiaSnapshot.characters.find(
      (row) => row.characterId === scope.characterId,
    ),
  ).toMatchObject(stats);
  await member.mutation(api.character.updateCharacter, {
    ...scope,
    patch: { level: 6, charisma: 20 },
  });
  await member.mutation(api.character.archiveCharacter, {
    ...scope,
    isActive: false,
  });
  expect(await owner.query(api.canonicalHistory.read, historyArgs)).toEqual(
    effective,
  );
  expect(
    await member.query(api.canonicalHistory.read, {
      ...historyArgs,
      recordId: record.recordId,
    }),
  ).toEqual(superseded);
  expect(superseded?.record).toEqual(record);
});

test('under sheet authority a private Character moved into a militia campaign publishes its sheet facts there', async () => {
  vi.useFakeTimers();
  const { t, owner, campaignId, ledgerFacts } = await ordinaryDeployment();
  const characterId = await owner.mutation(api.characterSheet.create, {
    name: 'Corin',
    kind: 'pc',
    operationId: 'create-corin',
  });
  for (const operationId of ['level-2', 'level-3'])
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      operationId,
    });
  await owner.mutation(api.characterSheet.editBaseScores, {
    characterId,
    scores: { wisdom: 14 },
    operationId: 'wisdom',
  });
  const command = { characterId, operationId: 'join' };
  let progress = await owner.mutation(api.characterMoves.start, {
    ...command,
    destinationCampaignId: campaignId,
  });
  for (let step = 0; step < 100 && progress.state === 'preparing'; step++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress.state).toBe('ready');
  expect(
    await owner.mutation(api.characterMoves.resume, command),
  ).toMatchObject({ state: 'completed' });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(await ledgerFacts(characterId)).toMatchObject({
    level: 3,
    wisdom: 14,
    strength: 10,
    isActive: true,
  });
});

test('under sheet authority a release activation refreshes an ordinary Character from its sheet', async () => {
  const { t, characterId, ledgerFacts } = await ordinaryDeployment();
  await prepare(t);
  const runId = await reconcile(t, characterId);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(runId),
  );
  expect(await ledgerFacts()).toEqual({
    characterId,
    ...stats,
    isActive: true,
  });
});

test('under sheet authority a Companion refreshed by its associated Character keeps its sheet facts', async () => {
  const { owner, campaignId, characterId, ledgerFacts } =
    await ordinaryDeployment();
  const associatedId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Ada',
    kind: 'pc',
    operationId: 'create-ada',
  });
  await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: associatedId,
    companionCharacterId: characterId,
    kind: 'cohort',
    sources: [{ key: 'bond', label: 'Companion bond', enabled: true }],
    operationId: 'link',
  });
  // A change to the associated Character refreshes its Companion's facts
  // without loading the Companion's sheet first.
  await owner.mutation(api.character.archiveCharacter, {
    organizationId: 'org',
    characterId: associatedId,
    isActive: false,
  });
  expect(await ledgerFacts()).toEqual({
    characterId,
    ...stats,
    isActive: true,
  });
});
