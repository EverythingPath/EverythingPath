// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import { beforeAll, afterEach, beforeEach, expect, test, vi } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
preloadCalledConvexModules({ modules, testFile: import.meta.url });
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function fixture() {
  const t = convexTest(schema, modules);
  const { campaignId, destinationCampaignId } = await t.run(async (ctx) => {
    await ctx.db.insert('user', {
      tokenIdentifier: 'owner',
      orgIds: [{ orgId: 'org', role: 'member' }],
    });
    const campaign = {
      description: '',
      organizationId: 'org',
      ownerId: 'owner',
      e2eFixture: {
        namespace: 'move-warnings',
        version: 1,
        workerKey: '0',
        caseKey: 'warnings',
        campaignKey: 'warnings',
      },
    };
    return {
      campaignId: await ctx.db.insert('campaign', { ...campaign, name: 'A' }),
      destinationCampaignId: await ctx.db.insert('campaign', {
        ...campaign,
        name: 'B',
      }),
    };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'owner' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Vessa',
    kind: 'pc',
    operationId: 'create',
  });
  // Setup looks up ids directly; each public sheet read is a full calculation.
  const { sorcerer, classLevel } = await t.run(async (ctx) => ({
    sorcerer: await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_ruleIdentity', (q) =>
        q.eq('characterId', characterId).eq('ruleIdentity', 'sorcerer'),
      )
      .unique(),
    classLevel: await ctx.db
      .query('characterSheetEntry')
      .withIndex('by_characterId_and_kind_and_active', (q) =>
        q
          .eq('characterId', characterId)
          .eq('kind', 'classLevel')
          .eq('active', true),
      )
      .first(),
  }));
  if (
    !sorcerer ||
    !classLevel ||
    sorcerer.detail.kind !== 'class' ||
    !('casting' in sorcerer.detail) ||
    !sorcerer.detail.casting
  )
    throw new Error('Missing prepared Sorcerer');
  const casting = sorcerer.detail.casting;
  const detail = sorcerer.detail;
  const classId = await t.run(async (ctx) => {
    const id = await ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId,
      name: 'Homebrew Sorcerer',
      ruleIdentity: 'homebrew-sorcerer',
      stacksWithItself: false,
      modifiers: [],
      sources: [],
      detail,
    });
    await ctx.db.patch('catalogEntry', id, {
      detail: {
        ...detail,
        casting: { ...casting, classTag: id },
      },
    });
    return id;
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: classLevel._id,
    classEntryId: classId,
    operationId: 'choose-homebrew',
  });
  const castingFeatId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId,
      name: 'Focused caster',
      ruleIdentity: 'focused-caster',
      stacksWithItself: false,
      modifiers: [
        {
          target: 'casterLevel',
          bonusType: 'untyped',
          value: 2,
          condition: { castingClass: classId },
        },
      ],
      sources: [],
      detail: { kind: 'feat' },
    }),
  );
  await owner.mutation(api.characterSheet.selectEntry, {
    characterId,
    catalogEntryId: castingFeatId,
    operationId: 'choose-casting-feat',
  });
  for (const name of [
    'Shield',
    'Magic Missile',
    'Extra Spell',
    'Off-list Spell',
  ]) {
    const catalogEntryId = await t.run((ctx) =>
      ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId,
        name,
        ruleIdentity: `homebrew-${name}`,
        stacksWithItself: false,
        modifiers: [],
        sources: [],
        detail: {
          kind: 'spell',
          levels: name === 'Off-list Spell' ? { cleric: 1 } : { [classId]: 1 },
        },
      }),
    );
    await owner.mutation(api.characterSheetSpells.record, {
      characterId,
      castingClassId: classId,
      catalogEntryId,
      level: 1,
      operationId: `record-${name}`,
    });
  }
  return { t, owner, characterId, classId, destinationCampaignId };
}

test('a campaign move preserves accepted off-list and known-count warnings for an ID-keyed class list', async () => {
  const { owner, characterId, classId, destinationCampaignId } =
    await fixture();
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const warnings = before?.calculated.warnings.filter((warning) =>
    ['spellOffList', 'spellCount'].includes(warning.check),
  );
  expect(warnings?.map((warning) => warning.check)).toEqual([
    'spellOffList',
    'spellCount',
  ]);
  for (const warning of warnings ?? [])
    await owner.mutation(api.characterSheet.acceptWarning, {
      characterId,
      operationId: `accept-${warning.check}`,
      check: warning.check,
      subject: warning.subject,
      fingerprint: warning.fingerprint,
    });
  const accepted = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  expect(accepted?.acceptedWarnings).toHaveLength(2);
  expect(accepted?.calculated.spellcastings[0]?.casterLevel?.total).toBe(3);
  expect(
    accepted?.calculated.spellCollections.collections[0]?.levels,
  ).toContainEqual({ spellLevel: 1, count: 4, allowance: 2 });
  const command = { characterId, operationId: 'move-warnings' };
  let progress = await owner.mutation(api.characterMoves.start, {
    ...command,
    destinationCampaignId,
  });
  for (let step = 0; step < 100 && progress.state === 'preparing'; step++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress.state).toBe('ready');
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    ),
  ).toEqual(accepted);
  progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress.state).toBe('completed');
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  expect(after?.campaign?.campaignId).toBe(destinationCampaignId);
  expect(after?.acceptedWarnings).toEqual(accepted?.acceptedWarnings);
  expect(
    after?.calculated.warnings
      .filter((warning) =>
        ['spellOffList', 'spellCount'].includes(warning.check),
      )
      .map(({ check, subject, fingerprint }) => ({
        check,
        subject,
        fingerprint,
      })),
  ).toEqual(
    warnings?.map(({ check, subject, fingerprint }) => ({
      check,
      subject,
      fingerprint,
    })),
  );
  const copiedClass = after?.catalogEntries.find(
    (entry) => entry.copiedFrom === classId,
  );
  expect(copiedClass).toMatchObject({
    scope: 'character',
    characterId,
    ruleIdentity: 'homebrew-sorcerer',
  });
  expect(after?.calculated.spellcastings[0]?.classTag).toBe(copiedClass?._id);
  expect(after?.calculated.spellCollections.collections[0]?.levels).toEqual(
    accepted?.calculated.spellCollections.collections[0]?.levels,
  );
  expect(after?.calculated.spellcastings[0]?.casterLevel?.total).toBe(
    accepted?.calculated.spellcastings[0]?.casterLevel?.total,
  );
  expect(after?.calculated.spellcastings[0]?.concentration?.total).toBe(
    accepted?.calculated.spellcastings[0]?.concentration?.total,
  );
  expect(
    after?.calculated.spellcastings[0]?.slots.map((slot) => [
      slot.spellLevel,
      slot.total,
      slot.known,
      slot.dc.total,
    ]),
  ).toEqual(
    accepted?.calculated.spellcastings[0]?.slots.map((slot) => [
      slot.spellLevel,
      slot.total,
      slot.known,
      slot.dc.total,
    ]),
  );
  if (
    copiedClass?.detail.kind !== 'class' ||
    !('casting' in copiedClass.detail) ||
    !copiedClass.detail.casting
  )
    throw new Error('Missing carried casting class');
  const extraSpell =
    after?.calculated.spellCollections.collections[0]?.spells.find(
      (spell) => spell.name === 'Extra Spell',
    );
  if (!extraSpell) throw new Error('Missing extra known Spell');
  const extraEntry = after?.entries.find(
    (entry) => entry._id === extraSpell.entryId,
  );
  if (!extraEntry) throw new Error('Missing extra Spell entry');
  await owner.mutation(api.characterSheetSpells.remove, {
    characterId,
    entryId: extraEntry._id,
    operationId: 'remove-extra-spell',
  });
  const fewerSpells = withSheetCatalog(
    await owner.query(api.characterSheet.read, {
      characterId,
    }),
  );
  expect(fewerSpells?.acceptedWarnings.map((warning) => warning.check)).toEqual(
    ['spellOffList'],
  );
  const countWarning = fewerSpells?.calculated.warnings.find(
    (warning) => warning.check === 'spellCount',
  );
  expect(countWarning?.fingerprint).not.toBe(
    warnings?.find((warning) => warning.check === 'spellCount')?.fingerprint,
  );
  expect(
    fewerSpells?.calculated.spellCollections.collections[0]?.levels,
  ).toContainEqual({ spellLevel: 1, count: 3, allowance: 2 });
  if (!countWarning) throw new Error('Missing changed count warning');
  await owner.mutation(api.characterSheet.acceptWarning, {
    characterId,
    operationId: 'accept-new-count',
    check: countWarning.check,
    subject: countWarning.subject,
    fingerprint: countWarning.fingerprint,
  });
  await owner.mutation(api.catalogCopies.editDefinition, {
    characterId,
    catalogEntryId: copiedClass._id,
    operationId: 'change-spell-list',
    detail: {
      ...copiedClass.detail,
      casting: { ...copiedClass.detail.casting, classTag: 'different-list' },
    },
  });
  const changed = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  expect(changed?.acceptedWarnings).toEqual([]);
  for (const warning of warnings ?? [])
    expect(
      changed?.calculated.warnings.find(
        (current) =>
          current.check === warning.check &&
          current.subject === warning.subject,
      )?.fingerprint,
    ).not.toBe(warning.fingerprint);
});

test('public Spell list membership edits prune changed warnings and restart move discovery', async () => {
  const { owner, characterId, classId, destinationCampaignId } =
    await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const offList = initial?.calculated.warnings.find(
    (warning) => warning.check === 'spellOffList',
  );
  const spell = initial?.catalogEntries.find(
    (row) => row.name === 'Off-list Spell',
  );
  if (!offList || !spell) throw new Error('Missing warning fixture');
  await owner.mutation(api.characterSheet.acceptWarning, {
    characterId,
    check: offList.check,
    subject: offList.subject,
    fingerprint: offList.fingerprint,
    operationId: 'accept-changing-warning',
  });
  const command = { characterId, operationId: 'warning-pruning-preparation' };
  let ready = await owner.mutation(api.characterMoves.start, {
    ...command,
    destinationCampaignId,
  });
  for (let i = 0; i < 100 && ready.state !== 'ready'; i++)
    ready = await owner.mutation(api.characterMoves.resume, command);
  expect(ready.state).toBe('ready');
  await owner.mutation(api.catalogCopies.editDefinition, {
    characterId,
    catalogEntryId: spell._id,
    detail: { kind: 'spell', levels: { [classId]: 1 } },
    operationId: 'put-spell-on-list',
  });
  const edited = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  expect(
    edited?.acceptedWarnings.some(
      (warning) => warning.check === 'spellOffList',
    ),
  ).toBe(false);
  expect(
    edited?.calculated.warnings.some(
      (warning) => warning.check === 'spellOffList',
    ),
  ).toBe(false);
  let progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress).toMatchObject({
    generation: ready.generation + 1,
    state: 'preparing',
  });
  for (let i = 0; i < 100 && progress.state !== 'completed'; i++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress.state).toBe('completed');
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  expect(
    after?.acceptedWarnings.some((warning) => warning.check === 'spellOffList'),
  ).toBe(false);
  expect(
    after?.calculated.warnings.some(
      (warning) => warning.check === 'spellOffList',
    ),
  ).toBe(false);
});
