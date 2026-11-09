// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { buildCatalogRelease } from '../scripts/catalog/release';
import resourcesData from '../src/lib/catalog/data/resources.json';
import { buildLegalPageData } from '../src/lib/catalog/legal-page-data';
import { legalResourcesSchema } from '../src/lib/catalog/legal-types';
import { convexTest } from 'convex-test';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import { TransactionMetricsTracker } from 'convex-test/dist/transactionMetrics.js';
import { api, internal } from './_generated/api';
import schema from './schema';
import { writeCatalogDefinition } from './lib/catalogCopies';
import { catalogRuntimeCompatibility } from '../src/lib/catalog/runtime-compatibility';
import type { Id } from './_generated/dataModel';
import { parse } from 'convex-helpers/validators';
import { catalogReleaseRowValidator } from '../src/lib/catalog/release-validators';

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
preloadCalledConvexModules({ modules, testFile: import.meta.url });
const instances: ReturnType<typeof convexTest>[] = [];
afterEach(async () => {
  for (const instance of instances)
    await instance.finishAllScheduledFunctions(vi.runAllTimers);
  instances.length = 0;
  vi.useRealTimers();
});

// Lowered convex-test budgets let small catalogs reach the same move guards.
// Each budget sits on the heaviest transaction of a plain move of the
// prepared Character, measured once so it follows the seeded catalogs, and
// leaves no room to also scan the given unrelated rows in that transaction.
// Discovery reads 32 Spells per resume, keeping each scan page within the
// same lowered budget.
let baselineMoveReads = 0;
function readBudget(unscannedRows: number) {
  if (!(baselineMoveReads > 0))
    throw new Error('Baseline move reads are unmeasured');
  return { documentsRead: baselineMoveReads + unscannedRows - 1 };
}
const largeCatalogRows = 768;
const maxMoveResumes = 24;

beforeAll(async () => {
  const { move } = await fixture();
  const reads = vi.spyOn(TransactionMetricsTracker.prototype, 'trackRead');
  try {
    await move('baseline');
    const perTransaction = new Map<unknown, number>();
    for (const tracker of reads.mock.contexts)
      perTransaction.set(tracker, (perTransaction.get(tracker) ?? 0) + 1);
    baselineMoveReads = Math.max(...perTransaction.values());
  } finally {
    reads.mockRestore();
  }
});

test.each(['global', 'campaign'] as const)(
  'a move publishes within the read budget with thousands of %s Spells',
  async (scope) => {
    const { t, owner, characterId, campaigns } = await fixture(
      readBudget(largeCatalogRows),
    );
    for (let offset = 0; offset < 3072; offset += 512)
      await t.run(async (ctx) => {
        for (let i = offset; i < offset + 512; i++)
          await ctx.db.insert('catalogEntry', {
            scope,
            campaignId: scope === 'campaign' ? campaigns[1] : undefined,
            name: `Global Spell ${i}`,
            ruleIdentity: `global-spell-${i}`,
            sources: [],
            modifiers: [],
            stacksWithItself: false,
            detail: { kind: 'spell', levels: { 'other-list': 1 } },
          });
      });
    const command = { characterId, operationId: 'thousands-of-global-spells' };
    let progress = await owner.mutation(api.characterMoves.start, {
      ...command,
      destinationCampaignId: campaigns[1],
    });
    for (let i = 0; i < 120 && progress.state !== 'ready'; i++)
      progress = await owner.mutation(api.characterMoves.resume, command);
    expect(progress.state).toBe('ready');
    expect(
      (await owner.mutation(api.characterMoves.resume, command)).state,
    ).toBe('completed');
    expect(
      withSheetCatalog(
        await owner.query(api.characterSheet.read, { characterId }),
      )?.character.campaignId,
    ).toBe(campaigns[1]);
  },
  20_000,
);
async function fixture(
  transactionLimits:
    | { documentsRead?: number; documentsWritten?: number }
    | false = false,
) {
  vi.useFakeTimers();
  const t = convexTest({ schema, modules, transactionLimits });
  instances.push(t);
  const campaigns = await t.run(async (ctx) => {
    await ctx.db.insert('user', {
      tokenIdentifier: 'owner',
      orgIds: [{ orgId: 'org', role: 'member' }],
      characterSheetDemo: true,
    });
    const ids: Id<'campaign'>[] = [];
    for (const name of ['Source', 'Destination'])
      ids.push(
        await ctx.db.insert('campaign', {
          name,
          description: '',
          organizationId: 'org',
          ownerId: 'owner',
          e2eFixture: {
            namespace: 'move-spells',
            version: 1,
            workerKey: '0',
            caseKey: name,
            campaignKey: name,
          },
        }),
      );
    return ids;
  });
  const owner = t.withIdentity({ tokenIdentifier: 'owner' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    campaignId: campaigns[0],
    organizationId: 'org',
    name: 'Vessa',
    kind: 'pc',
    operationId: 'create',
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const wizard = sheet?.catalogEntries.find((row) => row.name === 'Wizard');
  const level = sheet?.entries.find((row) => row.kind === 'classLevel');
  if (!wizard || !level || !campaigns[0] || !campaigns[1])
    throw new Error('Missing fixture');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: level._id,
    classEntryId: wizard._id,
    operationId: 'wizard',
  });
  async function spell(
    campaignId: Id<'campaign'>,
    name: string,
    ruleIdentity = name,
    tag = 'wizard',
  ) {
    return t.run((ctx) =>
      writeCatalogDefinition(ctx, {
        scope: 'campaign',
        campaignId,
        name,
        ruleIdentity,
        sources: [],
        modifiers: [],
        stacksWithItself: false,
        detail: { kind: 'spell', levels: { [tag]: 3 }, school: 'illusion' },
      }),
    );
  }
  async function move(
    operationId: string,
    destinationCampaignId = campaigns[1],
  ) {
    let result = await owner.mutation(api.characterMoves.start, {
      characterId,
      operationId,
      destinationCampaignId,
    });
    for (
      let count = 0;
      count < maxMoveResumes && result.state !== 'completed';
      count++
    )
      result = await owner.mutation(api.characterMoves.resume, {
        characterId,
        operationId,
      });
    expect(result.state).toBe('completed');
  }
  return { t, owner, characterId, campaigns, wizard, spell, move };
}

test('movement publishes carried unrecorded lists and destination spells with accurate browse counts', async () => {
  const { owner, characterId, campaigns, wizard, spell, move } =
    await fixture();
  if (!campaigns[0] || !campaigns[1]) throw new Error('Missing campaigns');
  const sourceId = await spell(campaigns[0], 'Source Sigil');
  const destinationId = await spell(campaigns[1], 'Destination Sigil');
  await spell(campaigns[1], 'Unrelated Sigil', 'unrelated', 'other-list');
  await move('to-destination');
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const carried = sheet?.catalogEntries.find(
    (row) => row.copiedFrom === sourceId,
  );
  expect(carried).toMatchObject({ scope: 'character', characterId });
  const browser = await owner.query(api.characterSheetSpells.browse, {
    characterId,
    castingClassId: wizard._id,
    search: 'Sigil',
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(
    browser.page
      .map((row) => [row.name, row.catalogEntryId, row.recorded])
      .sort(),
  ).toEqual([
    ['Destination Sigil', destinationId, false],
    ['Source Sigil', carried?._id, false],
  ]);
  expect(browser.isDone).toBe(true);
});

test('a carried recorded Spell wins over a divergent destination copy without changing its saved row or class link', async () => {
  const { owner, characterId, campaigns, wizard, spell, move } =
    await fixture();
  if (!campaigns[0] || !campaigns[1]) throw new Error('Missing campaigns');
  const sourceId = await spell(campaigns[0], 'Carried Sigil', 'same-spell');
  await spell(campaigns[1], 'Divergent Sigil', 'same-spell');
  const entryId = await owner.mutation(api.characterSheetSpells.record, {
    characterId,
    catalogEntryId: sourceId,
    castingClassId: wizard._id,
    operationId: 'record',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  await move('to-destination');
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const previous = before?.entries.find((row) => row._id === entryId);
  const recorded = after?.entries.find((row) => row._id === entryId);
  expect(recorded?.state).toEqual(previous?.state);
  expect(recorded?._id).toBe(entryId);
  const browser = await owner.query(api.characterSheetSpells.browse, {
    characterId,
    castingClassId: wizard._id,
    search: 'Sigil',
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(browser.page).toMatchObject([
    { name: 'Carried Sigil', recorded: true, spellLevel: 3 },
  ]);
  expect(browser.page).toHaveLength(1);
  await move('return', campaigns[0]);
  const returned = await owner.query(api.characterSheetSpells.browse, {
    characterId,
    castingClassId: wizard._id,
    search: 'Sigil',
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(returned.page).toEqual(browser.page);
});

test('spell expansion beyond the transaction budget leaves the old campaign and browse state authoritative', async () => {
  // Publication reserves 1,024 writes plus three per new Spell: 96 Spells need
  // 1,312, beyond the 1,280-write budget.
  const { t, owner, characterId, campaigns, wizard } = await fixture({
    documentsWritten: 1280,
  });
  if (!campaigns[1]) throw new Error('Missing destination');
  const destinationCampaignId = campaigns[1];
  await t.run(async (ctx) => {
    for (let count = 0; count < 96; count++)
      await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: destinationCampaignId,
        name: `Bound Sigil ${count}`,
        ruleIdentity: `bound-${count}`,
        sources: [],
        modifiers: [],
        stacksWithItself: false,
        detail: { kind: 'spell', levels: { wizard: 1 }, school: 'illusion' },
      });
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const operationId = 'too-many-spells';
  let progress = await owner.mutation(api.characterMoves.start, {
    characterId,
    destinationCampaignId,
    operationId,
  });
  for (let count = 0; count < 100 && progress.state !== 'ready'; count++)
    progress = await owner.mutation(api.characterMoves.resume, {
      characterId,
      operationId,
    });
  expect(progress.state).toBe('ready');
  await expect(
    owner.mutation(api.characterMoves.resume, { characterId, operationId }),
  ).rejects.toThrow('spell expansion exceeds atomic publication limits');
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    ),
  ).toEqual(before);
  const browser = await owner.query(api.characterSheetSpells.browse, {
    characterId,
    castingClassId: wizard._id,
    search: 'Bound Sigil',
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(browser.page).toEqual([]);
});

test('a destination with more than 128 matching spells and more unrelated definitions than a Spell scan can read remains movable', async () => {
  // 160 Spells raise publication reads beyond the large-catalog budget.
  const unrelatedDefinitions = 1536;
  const { t, owner, characterId, campaigns, wizard, move } = await fixture(
    readBudget(unrelatedDefinitions),
  );
  if (!campaigns[1]) throw new Error('Missing destination');
  const campaignId = campaigns[1];
  await t.run(async (ctx) => {
    for (let count = 0; count < 160 + unrelatedDefinitions; count++)
      if (count < 160)
        await ctx.db.insert('catalogEntry', {
          scope: 'campaign',
          campaignId,
          name: `Destination ${count}`,
          ruleIdentity: `destination-${count}`,
          sources: [],
          modifiers: [],
          stacksWithItself: false,
          detail: {
            kind: 'spell',
            levels: { wizard: 3 },
            school: 'move-school',
          },
        });
      else
        await ctx.db.insert('catalogEntry', {
          scope: 'campaign',
          campaignId,
          name: `Destination ${count}`,
          ruleIdentity: `destination-${count}`,
          sources: [],
          modifiers: [],
          stacksWithItself: false,
          detail: { kind: 'manual' },
        });
  });
  await move('large-destination');
  const browser = await owner.query(api.characterSheetSpells.browse, {
    characterId,
    castingClassId: wizard._id,
    school: 'move-school',
    paginationOpts: { cursor: null, numItems: 100 },
  });
  const nextPage = await owner.query(api.characterSheetSpells.browse, {
    characterId,
    castingClassId: wizard._id,
    school: 'move-school',
    paginationOpts: { cursor: browser.continueCursor, numItems: 100 },
  });
  expect([...browser.page, ...nextPage.page]).toHaveLength(160);
  expect(nextPage.isDone).toBe(true);
  const metadata = await owner.query(api.characterSheetSpells.browserInfo, {
    characterId,
    castingClassId: wizard._id,
  });
  expect(metadata.schools).toContain('move-school');
  const summary = await t.run((ctx) =>
    ctx.db
      .query('spellCatalogSummary')
      .withIndex('by_characterId_and_castingClassId_and_kind_and_value', (q) =>
        q
          .eq('characterId', characterId)
          .eq('castingClassId', wizard._id)
          .eq('kind', 'school')
          .eq('value', 'move-school'),
      )
      .unique(),
  );
  expect(summary).toMatchObject({
    count: 160,
    availableCount: 160,
    unrecordedCount: 160,
  });
});

test('unused Character customizations carry future referenced options and resources transitively', async () => {
  const { t, owner, characterId, campaigns, move } = await fixture();
  if (!campaigns[0]) throw new Error('Missing source');
  const campaignId = campaigns[0];
  const ids = await t.run(async (ctx) => {
    const customization = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      browseOnly: true,
      name: 'Unused custom future feature',
      ruleIdentity: 'unused-feature',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: {
        kind: 'classFeature',
        picksByLevel: [{ classLevel: 20, list: 'future-options', count: 1 }],
      },
    });
    const option = await ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId,

      name: 'Unselected future option',
      ruleIdentity: 'future-option',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: {
        kind: 'classFeature',
      },
    });
    const resource = await ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId,

      name: 'Option resource',
      ruleIdentity: 'option-resource',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'manual' },
    });
    await ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId,

      name: 'Unrelated option',
      ruleIdentity: 'unrelated-option',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'manual' },
    });
    await ctx.db.patch('catalogEntry', customization, {
      grants: [{ catalogEntryId: option }],
    });
    await ctx.db.patch('catalogEntry', option, {
      grants: [{ catalogEntryId: resource }],
    });
    return { customization, option, resource };
  });
  await move('future-options');
  const definitions = await owner.query(api.catalogCopies.list, {
    characterId,
  });
  expect(
    await t.run((ctx) => ctx.db.get('catalogEntry', ids.customization)),
  ).toMatchObject({
    characterId,
    scope: 'character',
    browseOnly: true,
    name: 'Unused custom future feature',
  });
  expect(
    definitions
      .filter(
        (row) =>
          row.copiedFrom === ids.option || row.copiedFrom === ids.resource,
      )
      .map((row) => row.name)
      .sort(),
  ).toEqual(['Option resource', 'Unselected future option']);
  expect(definitions.some((row) => row.name === 'Unrelated option')).toBe(
    false,
  );
});

test('ID-keyed casting conditions keep concentration modifiers through copying', async () => {
  const { t, owner, characterId, campaigns, wizard, move } = await fixture();
  if (!campaigns[0]) throw new Error('Missing source');
  const campaignId = campaigns[0];
  const sourceId = await t.run(async (ctx) => {
    const original = await ctx.db.get('catalogEntry', wizard._id);
    if (
      original?.detail.kind !== 'class' ||
      !('casting' in original.detail) ||
      !original.detail.casting
    )
      throw new Error('Missing casting');
    const { _id, _creationTime, characterId: _character, ...body } = original;
    const id = await ctx.db.insert('catalogEntry', {
      ...body,
      scope: 'campaign',
      campaignId,
      name: 'ID Wizard',
    });
    await ctx.db.patch('catalogEntry', id, {
      detail: {
        ...original.detail,
        casting: { ...original.detail.casting, classTag: id },
      },
      modifiers: [
        {
          target: 'concentration',
          bonusType: 'untyped',
          value: 2,
          condition: { castingClass: id },
        },
      ],
    });
    return id;
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const level = sheet?.entries.find((row) => row.kind === 'classLevel');
  if (!level) throw new Error('Missing level');
  // The level is a wizard already: another copy of its class is an explicit
  // switch (#583); the row picker would keep the class's definition.
  await owner.mutation(api.characterSheet.switchClassVersion, {
    characterId,
    entryId: level._id,
    classEntryId: sourceId,
    operationId: 'id-wizard',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const concentration = before?.calculated.spellcastings.find(
    (row) => row.classEntryId === sourceId,
  )?.concentration;
  expect(concentration?.total).toBe(3);
  await move('id-casting');
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const carried = after?.catalogEntries.find(
    (row) => row.copiedFrom === sourceId,
  );
  expect(
    after?.calculated.spellcastings.find(
      (row) => row.classEntryId === carried?._id,
    )?.concentration?.total,
  ).toBe(3);
});

test('casting and prompt consumers with the same list key stay in their source campaign', async () => {
  const { t, owner, characterId, campaigns, wizard, spell, move } =
    await fixture();
  const campaignId = campaigns[0];
  if (!campaignId) throw new Error('Missing source');
  const castingDetail = wizard.detail;
  if (castingDetail.kind !== 'class' || !('featuresByLevel' in castingDetail))
    throw new Error('Missing casting class fixture');
  const ids = await t.run(async (ctx) => {
    const child = await ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId,
      name: 'Unrelated progression',
      ruleIdentity: 'unrelated-progression',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'classFeature' },
    });
    const caster = await ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId,
      name: 'Unrelated caster',
      ruleIdentity: 'unrelated-caster',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: {
        ...castingDetail,
        featuresByLevel: [{ classLevel: 20, catalogEntryId: child }],
      },
    });
    const modifier = await ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId,
      name: 'Unrelated concentration modifier',
      ruleIdentity: 'unrelated-casting-modifier',
      sources: [],
      modifiers: [
        {
          target: 'concentration',
          bonusType: 'untyped',
          value: 2,
          condition: { castingClass: 'wizard' },
        },
      ],
      stacksWithItself: false,
      detail: { kind: 'feat' },
    });
    const prompt = await ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId,
      name: 'Unrelated prompt consumer',
      ruleIdentity: 'unrelated-prompt',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: {
        kind: 'classFeature',
        picksByLevel: [{ classLevel: 20, list: 'wizard', count: 1 }],
      },
    });
    return [child, caster, modifier, prompt];
  });
  const member = await spell(campaignId, 'Actual list member');
  await move('provider-aware-membership');
  const definitions = await owner.query(api.catalogCopies.list, {
    characterId,
  });
  expect(definitions.some((row) => row.copiedFrom === member)).toBe(true);
  expect(
    definitions.filter((row) => row.copiedFrom && ids.includes(row.copiedFrom)),
  ).toEqual([]);
});

test('source and global catalogs with more unrelated non-Spell definitions than a Spell scan can read still permit a keyed move', async () => {
  const unrelatedDefinitions = 1024;
  const { t, owner, characterId, campaigns, spell, move } = await fixture(
    readBudget(unrelatedDefinitions),
  );
  const sourceCampaignId = campaigns[0];
  if (!sourceCampaignId) throw new Error('Missing source');
  const member = await spell(sourceCampaignId, 'Retained spell');
  const command = { characterId, operationId: 'large-unrelated-source' };
  let progress = await owner.mutation(api.characterMoves.start, {
    ...command,
    destinationCampaignId: campaigns[1],
  });
  for (let i = 0; i < 100 && progress.state !== 'ready'; i++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress.state).toBe('ready');
  await t.run(async (ctx) => {
    for (const scope of ['campaign', 'global'] as const)
      for (let i = 0; i < unrelatedDefinitions; i++)
        await ctx.db.insert('catalogEntry', {
          scope,
          campaignId: scope === 'campaign' ? sourceCampaignId : undefined,
          name: `Unrelated ${scope} ${i}`,
          ruleIdentity: `unrelated-${scope}-${i}`,
          sources: [],
          modifiers: [],
          stacksWithItself: false,
          detail: { kind: 'manual' },
        });
  });
  expect((await owner.mutation(api.characterMoves.resume, command)).state).toBe(
    'completed',
  );
  expect(
    (await owner.query(api.catalogCopies.list, { characterId })).some(
      (row) => row.copiedFrom === member,
    ),
  ).toBe(true);
  await move('large-unrelated-return', sourceCampaignId);
  await move('large-unrelated-new-discovery');
});

test('public numeric Spell edits and reordered list keys retain staging and current browser fields', async () => {
  const { t, owner, characterId, campaigns, wizard, spell } = await fixture();
  const campaignId = campaigns[0];
  if (!campaignId) throw new Error('Missing source');
  const catalogEntryId = await spell(campaignId, 'Original spell');
  await t.run(async (ctx) => {
    const definition = await ctx.db.get('catalogEntry', catalogEntryId);
    if (!definition) throw new Error('Missing Spell');
    const { _id, _creationTime, ...body } = definition;
    await writeCatalogDefinition(
      ctx,
      {
        ...body,
        detail: { kind: 'spell', levels: { wizard: 3, cleric: 4 } },
      },
      catalogEntryId,
    );
  });
  await owner.mutation(api.characterSheetSpells.record, {
    characterId,
    castingClassId: wizard._id,
    catalogEntryId,
    level: 3,
    operationId: 'record-edited-spell',
  });
  const command = { characterId, operationId: 'public-spell-edit' };
  let ready = await owner.mutation(api.characterMoves.start, {
    ...command,
    destinationCampaignId: campaigns[1],
  });
  for (let i = 0; i < 100 && ready.state !== 'ready'; i++)
    ready = await owner.mutation(api.characterMoves.resume, command);
  expect(ready.state).toBe('ready');
  await owner.mutation(api.catalogCopies.editDefinition, {
    characterId,
    catalogEntryId,
    name: 'Edited spell',
    detail: {
      kind: 'spell',
      levels: { cleric: 4, wizard: 2 },
      school: 'evocation',
    },
    operationId: 'edit-spell-fields',
  });
  expect(
    await owner.mutation(api.characterMoves.resume, command),
  ).toMatchObject({
    generation: ready.generation,
    prepared: ready.prepared,
    state: 'ready',
  });
  expect((await owner.mutation(api.characterMoves.resume, command)).state).toBe(
    'completed',
  );
  const browser = await owner.query(api.characterSheetSpells.browse, {
    characterId,
    castingClassId: wizard._id,
    search: 'Edited spell',
    paginationOpts: { cursor: null, numItems: 10 },
  });
  expect(browser.page).toMatchObject([
    {
      name: 'Edited spell',
      school: 'evocation',
      spellLevel: 2,
      recorded: true,
    },
  ]);
});

test.each([0, 1])(
  'a campaign %i Spell created after readiness restarts discovery before publication',
  async (campaignIndex) => {
    const { t, owner, characterId, campaigns, wizard } = await fixture(
      readBudget(largeCatalogRows),
    );
    const campaignId = campaigns[campaignIndex];
    if (!campaignId) throw new Error('Missing campaign');
    const command = { characterId, operationId: 'membership-changed' };
    let progress = await owner.mutation(api.characterMoves.start, {
      ...command,
      destinationCampaignId: campaigns[1],
    });
    for (let i = 0; i < 100 && progress.state !== 'ready'; i++)
      progress = await owner.mutation(api.characterMoves.resume, command);
    expect(progress.state).toBe('ready');
    const generation = progress.generation;
    await t.run((ctx) =>
      writeCatalogDefinition(ctx, {
        scope: 'campaign',
        campaignId,
        name: 'New list member',
        ruleIdentity: 'new-list-member',
        sources: [],
        modifiers: [],
        stacksWithItself: false,
        detail: { kind: 'spell', levels: { wizard: 3 } },
      }),
    );
    progress = await owner.mutation(api.characterMoves.resume, command);
    expect(progress.generation).toBe(generation + 1);
    expect(progress.state).not.toBe('completed');
    expect(
      withSheetCatalog(
        await owner.query(api.characterSheet.read, { characterId }),
      )?.character.campaignId,
    ).toBe(campaigns[0]);
    for (let i = 0; i < 100 && progress.state !== 'completed'; i++)
      progress = await owner.mutation(api.characterMoves.resume, command);
    expect(progress.state).toBe('completed');
    const browser = await owner.query(api.characterSheetSpells.browse, {
      characterId,
      castingClassId: wizard._id,
      search: 'New list member',
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(browser.page.map((row) => row.name)).toEqual(['New list member']);
  },
);

test.each(
  [0, 1].flatMap((campaignIndex) =>
    ['preparing', 'ready'].map((state) => ({ campaignIndex, state })),
  ),
)(
  'deleting a campaign $campaignIndex Spell while $state restarts from current members',
  async ({ campaignIndex, state }) => {
    const { t, owner, characterId, campaigns, wizard, spell } = await fixture(
      readBudget(largeCatalogRows),
    );
    const campaignId = campaigns[campaignIndex];
    if (!campaignId) throw new Error('Missing campaign');
    const ids: Id<'catalogEntry'>[] = [];
    for (let i = 0; i < 33; i++)
      ids.push(await spell(campaignId, `Paged Spell ${i}`));
    const removedId = ids[0];
    if (!removedId) throw new Error('Missing Spell');
    const command = { characterId, operationId: 'deleted-during-discovery' };
    let first = await owner.mutation(api.characterMoves.start, {
      ...command,
      destinationCampaignId: campaigns[1],
    });
    expect(first.state).toBe('preparing');
    if (state === 'ready')
      for (let i = 0; i < 100 && first.state !== 'ready'; i++)
        first = await owner.mutation(api.characterMoves.resume, command);
    expect(first.state).toBe(state);
    await t.run((ctx) => writeCatalogDefinition(ctx, null, removedId));
    let progress = await owner.mutation(api.characterMoves.resume, command);
    expect(progress.generation).toBe(first.generation + 1);
    for (let i = 0; i < 100 && progress.state !== 'completed'; i++)
      progress = await owner.mutation(api.characterMoves.resume, command);
    expect(progress.state).toBe('completed');
    const browser = await owner.query(api.characterSheetSpells.browse, {
      characterId,
      castingClassId: wizard._id,
      paginationOpts: { cursor: null, numItems: 100 },
    });
    expect(
      browser.page.filter((row) => row.name.startsWith('Paged Spell ')),
    ).toHaveLength(32);
    expect(browser.page.map((row) => row.name)).not.toContain('Paged Spell 0');
  },
);

test('a public Spell list-key edit restarts discovery', async () => {
  const { owner, characterId, campaigns, wizard, spell } = await fixture(
    readBudget(largeCatalogRows),
  );
  const campaignId = campaigns[0];
  if (!campaignId) throw new Error('Missing source');
  const catalogEntryId = await spell(campaignId, 'List-key Spell');
  await owner.mutation(api.characterSheetSpells.record, {
    characterId,
    castingClassId: wizard._id,
    catalogEntryId,
    operationId: 'record-list-key-spell',
  });
  const command = { characterId, operationId: 'changed-list-key' };
  let ready = await owner.mutation(api.characterMoves.start, {
    ...command,
    destinationCampaignId: campaigns[1],
  });
  for (let i = 0; i < 100 && ready.state !== 'ready'; i++)
    ready = await owner.mutation(api.characterMoves.resume, command);
  expect(ready.state).toBe('ready');
  await owner.mutation(api.catalogCopies.editDefinition, {
    characterId,
    catalogEntryId,
    detail: { kind: 'spell', levels: { wizard: 3, cleric: 2 } },
    operationId: 'add-list-key',
  });
  const restarted = await owner.mutation(api.characterMoves.resume, command);
  expect(restarted.generation).toBe(ready.generation + 1);
  expect(restarted.state).not.toBe('completed');
});

test.each([0, 1])(
  'publication reads only required definitions from a large campaign %i Spell catalog',
  async (campaignIndex) => {
    const { t, owner, characterId, campaigns } = await fixture(
      readBudget(largeCatalogRows),
    );
    const campaignId = campaigns[campaignIndex];
    if (!campaignId) throw new Error('Missing campaign');
    await t.run(async (ctx) => {
      for (let i = 0; i < largeCatalogRows; i++)
        await ctx.db.insert('catalogEntry', {
          scope: 'campaign',
          campaignId,
          name: `Unrelated campaign Spell ${i}`,
          ruleIdentity: `unrelated-campaign-spell-${i}`,
          sources: [],
          modifiers: [],
          stacksWithItself: false,
          detail: { kind: 'spell', levels: { 'other-list': 1 } },
        });
    });
    const command = {
      characterId,
      operationId: 'large-campaign-spell-catalog',
    };
    let progress = await owner.mutation(api.characterMoves.start, {
      ...command,
      destinationCampaignId: campaigns[1],
    });
    for (let i = 0; i < 100 && progress.state !== 'ready'; i++)
      progress = await owner.mutation(api.characterMoves.resume, command);
    expect(progress.state).toBe('ready');
    expect(
      (await owner.mutation(api.characterMoves.resume, command)).state,
    ).toBe('completed');
    expect(
      withSheetCatalog(
        await owner.query(api.characterSheet.read, { characterId }),
      )?.character.campaignId,
    ).toBe(campaigns[1]);
  },
);

test('a release changed during global discovery restarts before publishing newly matching global Spells', async () => {
  const { t, owner, characterId, campaigns, wizard } = await fixture(
    readBudget(largeCatalogRows),
  );
  const spellId = await t.run(async (ctx) => {
    const ids: Id<'catalogEntry'>[] = [];
    for (let i = 0; i < 33; i++)
      ids.push(
        await ctx.db.insert('catalogEntry', {
          scope: 'global',
          name: `Live global Spell ${i}`,
          ruleIdentity: `live-global-spell-${i}`,
          sources: [],
          modifiers: [],
          stacksWithItself: false,
          detail: { kind: 'spell', levels: { 'other-list': 1 } },
        }),
      );
    return ids[0];
  });
  if (!spellId) throw new Error('Missing global Spell');
  const command = {
    characterId,
    operationId: 'global-release-during-discovery',
  };
  const first = await owner.mutation(api.characterMoves.start, {
    ...command,
    destinationCampaignId: campaigns[1],
  });
  expect(first.state).toBe('preparing');
  const notices = buildLegalPageData({
    registry: {},
    resources: legalResourcesSchema.parse(resourcesData),
    requiredNotices: [],
    permanentNoticeSuperset: [],
  }).permanentNoticeSuperset;
  const artifact = await buildCatalogRelease({
    releaseNumber: 1,
    compatibility: catalogRuntimeCompatibility,
    inputs: {
      upstream: {},
      remaps: {},
      curation: {},
      localData: {},
      parsers: {},
      sanitizers: {},
      ruleResources: {},
      legal: {},
      attribution: {},
    },
    rows: [
      ...['content', 'resources', 'holds', 'retirement', 'curation'].map(
        (key) => ({
          kind: 'report' as const,
          key,
          payload: { gatePassed: true, coverageComplete: true, passed: true },
        }),
      ),
      ...[
        'requiredNotices',
        'permanentNoticeSuperset',
        'registry',
        'resources',
      ].map((key) => ({
        kind: 'legal' as const,
        key,
        payload:
          key === 'resources'
            ? resourcesData
            : key === 'registry'
              ? {}
              : key === 'permanentNoticeSuperset'
                ? notices
                : [],
      })),
    ],
  });
  await t.mutation(internal.catalogRelease.begin, {
    manifest: artifact.manifest,
  });
  for (const [batchIndex, rows] of artifact.batches.entries())
    await t.mutation(internal.catalogRelease.writeBatch, {
      releaseNumber: 1,
      batchIndex,
      rows: rows.map((row) => parse(catalogReleaseRowValidator, row)),
    });
  await t.mutation(internal.catalogRelease.finalize, { releaseNumber: 1 });
  await t.run(async (ctx) => {
    await ctx.db.patch('catalogEntry', spellId, {
      detail: { kind: 'spell', levels: { wizard: 3 } },
    });
    await ctx.db.insert('catalogReleaseControl', {
      key: 'global',
      releaseNumber: 1,
      schemaIdentity: catalogRuntimeCompatibility.schema,
      calculationIdentity: catalogRuntimeCompatibility.calculation,
    });
  });
  let progress = first;
  for (let i = 0; i < 100 && progress.state !== 'completed'; i++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress.state).toBe('completed');
  expect(progress.generation).toBe(first.generation + 1);
  const browser = await owner.query(api.characterSheetSpells.browse, {
    characterId,
    castingClassId: wizard._id,
    paginationOpts: { cursor: null, numItems: 100 },
  });
  expect(browser.page).toContainEqual(
    expect.objectContaining({
      catalogEntryId: spellId,
      name: 'Live global Spell 0',
    }),
  );
});

test('an unstamped retained move checkpoint resumes by discovering current membership again', async () => {
  const { t, owner, characterId, campaigns } = await fixture();
  const command = { characterId, operationId: 'retained-checkpoint' };
  const first = await owner.mutation(api.characterMoves.start, {
    ...command,
    destinationCampaignId: campaigns[1],
  });
  await t.run(async (ctx) => {
    const move = await ctx.db
      .query('characterMove')
      .withIndex('by_characterId_and_operationId', (q) =>
        q.eq('characterId', characterId).eq('operationId', command.operationId),
      )
      .unique();
    if (!move) throw new Error('Missing move');
    await ctx.db.patch('characterMove', move._id, {
      sourceSpellMembershipStamp: undefined,
      destinationSpellMembershipStamp: undefined,
    });
  });
  let progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress.generation).toBe(first.generation + 1);
  for (let i = 0; i < 100 && progress.state !== 'completed'; i++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress.state).toBe('completed');
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    )?.character.campaignId,
  ).toBe(campaigns[1]);
});

test('a campaign Spell without levels remains valid and an empty level map retains move preparation', async () => {
  const { t, owner, characterId, campaigns } = await fixture();
  const campaignId = campaigns[0];
  if (!campaignId) throw new Error('Missing campaign');
  const definition = {
    scope: 'campaign' as const,
    campaignId,
    name: 'Spell without a list',
    ruleIdentity: 'spell-without-a-list',
    sources: [],
    modifiers: [],
    stacksWithItself: false,
    detail: { kind: 'spell' as const },
  };
  const catalogEntryId = await t.run((ctx) =>
    writeCatalogDefinition(ctx, definition),
  );
  expect(
    (await owner.query(api.catalogCopies.list, { characterId })).some(
      (row) => row._id === catalogEntryId,
    ),
  ).toBe(true);
  const command = { characterId, operationId: 'empty-spell-membership' };
  let ready = await owner.mutation(api.characterMoves.start, {
    ...command,
    destinationCampaignId: campaigns[1],
  });
  for (let i = 0; i < 100 && ready.state !== 'ready'; i++)
    ready = await owner.mutation(api.characterMoves.resume, command);
  expect(ready.state).toBe('ready');
  await t.run((ctx) =>
    writeCatalogDefinition(
      ctx,
      { ...definition, detail: { kind: 'spell', levels: {} } },
      catalogEntryId,
    ),
  );
  expect(
    await owner.mutation(api.characterMoves.resume, command),
  ).toMatchObject({
    generation: ready.generation,
    state: 'completed',
  });
});
