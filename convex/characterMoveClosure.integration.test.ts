// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import type { FunctionArgs } from 'convex/server';
import { beforeAll, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';
import { listCatalogReferences } from '../src/lib/catalog-copy-references';
import { formatGrantKeyId } from '../src/lib/character-sheet-grants';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
preloadCalledConvexModules({ modules, testFile: import.meta.url });

type Definition = FunctionArgs<
  typeof api.catalogCopies.createOneOff
>['definition'];

// Players build every definition below in the app: one-offs saved to the
// campaign catalog, and seeded definitions edited before saving.
async function fixture() {
  const t = convexTest(schema, modules);
  const campaigns = await t.run(async (ctx) => {
    for (const name of ['owner', 'member'])
      await ctx.db.insert('user', {
        tokenIdentifier: `test|${name}`,
        orgIds: [{ orgId: 'org', role: 'member' }],
        characterSheetDemo: true,
      });
    const ids: Id<'campaign'>[] = [];
    for (const name of ['A', 'B'])
      ids.push(
        await ctx.db.insert('campaign', {
          name,
          description: '',
          organizationId: 'org',
          ownerId: 'test|owner',
          e2eFixture: {
            namespace: 'move-closure',
            version: 1,
            workerKey: '0',
            caseKey: name,
            campaignKey: name,
          },
        }),
      );
    return ids;
  });
  const [campaignA, campaignB] = campaigns;
  if (!campaignA || !campaignB) throw new Error('Campaigns missing');
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const create = (identity: typeof owner, name: string) =>
    identity.mutation(api.characterSheet.create, {
      campaignId: campaignA,
      organizationId: 'org',
      name,
      kind: 'pc',
      operationId: `create-${name}`,
    });
  const characterId = await create(owner, 'Vessa');
  const scope = { organizationId: 'org', campaignId: campaignA, characterId };
  // The member's own Character, where campaign homebrew is authored.
  let authoring: Promise<{ id: Id<'character'>; scope: typeof scope }> | null =
    null;
  const author = () =>
    (authoring ??= create(member, 'Orrin').then((id) => ({
      id,
      scope: { ...scope, characterId: id },
    })));
  const read = async (id: Id<'character'> = characterId) => {
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId: id }),
    );
    if (!sheet) throw new Error('Missing sheet');
    return sheet;
  };
  const seeded = async (ruleIdentity: string, id = characterId) => {
    const row = (await read(id)).catalogEntries.find(
      (entry) => entry.ruleIdentity === ruleIdentity,
    );
    if (!row) throw new Error(`Missing ${ruleIdentity}`);
    return row;
  };
  /** Save a definition the author created or edited to campaign A. */
  const share = async (
    catalogEntryId: Id<'catalogEntry'>,
    operationId: string,
  ) =>
    member.mutation(api.catalogCopies.saveToCatalog, {
      ...(await author()).scope,
      catalogEntryId,
      operationId,
    });
  /** Create a one-off on the author's sheet and save it to campaign A. */
  const shareOneOff = async (definition: Definition, operationId: string) => {
    const entryId = await member.mutation(api.catalogCopies.createOneOff, {
      ...(await author()).scope,
      definition,
      operationId,
    });
    // The one-off's own definition, read without loading the whole sheet.
    const entry = await t.run((ctx) =>
      ctx.db.get('characterSheetEntry', entryId),
    );
    if (!entry || !('catalogEntryId' in entry))
      throw new Error('Missing one-off');
    return share(entry.catalogEntryId, `${operationId}-share`);
  };
  const move = async (operationId: string, destination = campaignB) => {
    const command = { characterId, operationId };
    let progress = await owner.mutation(api.characterMoves.start, {
      ...command,
      destinationCampaignId: destination,
    });
    for (let i = 0; i < 50 && progress.state !== 'completed'; i++)
      progress = await owner.mutation(api.characterMoves.resume, command);
    expect(progress.state).toBe('completed');
    return progress;
  };
  return {
    t,
    owner,
    member,
    characterId,
    author,
    campaignA,
    campaignB,
    scope,
    read,
    seeded,
    share,
    shareOneOff,
    move,
  };
}

function routineFor(
  sheet: Awaited<ReturnType<Awaited<ReturnType<typeof fixture>>['read']>>,
  entryId: Id<'characterSheetEntry'>,
) {
  const attack = sheet.calculated.attackRoutines.find(
    (row) => row.weaponEntryId === entryId,
  )?.single[0];
  return (
    attack && {
      attackBonus: attack.attackBonus.total,
      damageDice: attack.damageDice,
      damageType: attack.damageType,
      criticalThreat: attack.criticalThreat.total,
      extraDamage: attack.extraDamage.map(({ dice, on, damageType }) => ({
        dice,
        on,
        damageType,
      })),
    }
  );
}

test('a campaign magic weapon carries its Base Item and Item Abilities, and attacks the same after arrival', async () => {
  const context = await fixture();
  const { owner, member, scope, read, seeded } = context;
  const { id: authorId, scope: authorScope } = await context.author();
  // A campaign Item Ability: the author's seeded flaming, reworked and shared.
  const flaming = await seeded('flaming', authorId);
  await member.mutation(api.catalogCopies.editDefinition, {
    ...authorScope,
    catalogEntryId: flaming._id,
    name: 'Emberbrand',
    detail: {
      kind: 'itemAbility',
      appliesTo: 'weapon',
      bonusEquivalent: 1,
      damageDice: [{ dice: '1d4', damageType: 'fire', on: 'hit' }],
    },
    operationId: 'emberbrand',
  });
  const ability = await context.share(flaming._id, 'share-emberbrand');
  const baseItem = await context.shareOneOff(
    {
      name: 'Star knife',
      modifiers: [],
      stacksWithItself: false,
      sources: [],
      detail: {
        kind: 'item',
        consumable: false,
        weapon: {
          baseType: 'starknife',
          proficiency: 'martial',
          handedness: 'light',
          attackType: 'melee',
          dice: '1d4',
          damageTypes: ['piercing'],
          threat: 20,
          mult: 3,
          strengthDamage: 'melee',
        },
      },
    },
    'star-knife',
  );
  const magicItem = await context.shareOneOff(
    {
      name: 'Emberbrand star knife',
      modifiers: [],
      stacksWithItself: false,
      sources: [],
      detail: {
        kind: 'item',
        consumable: false,
        baseItem,
        magic: { enhancement: 1, abilities: [{ catalogEntryId: ability }] },
      },
    },
    'emberbrand-knife',
  );
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: magicItem,
    operationId: 'take-knife',
  });
  const before = await read();
  expect(routineFor(before, entryId)).toMatchObject({
    damageDice: '1d4',
    extraDamage: [{ dice: '1d4', on: 'hit', damageType: 'fire' }],
  });
  await context.move('to-B');
  const after = await read();
  const copyOf = (id: Id<'catalogEntry'>) =>
    after.catalogEntries.find(
      (row) =>
        row.copiedFrom === id &&
        row.scope === 'character' &&
        row.characterId === context.characterId,
    );
  const [abilityCopy, baseCopy, itemCopy] = [ability, baseItem, magicItem].map(
    copyOf,
  );
  expect(itemCopy?.detail).toMatchObject({
    baseItem: baseCopy?._id,
    magic: { abilities: [{ catalogEntryId: abilityCopy?._id }] },
  });
  const entry = after.entries.find((row) => row._id === entryId);
  expect(entry).toMatchObject({
    catalogEntryId: itemCopy?._id,
    state: { abilities: [{ catalogEntryId: abilityCopy?._id }] },
  });
  expect(routineFor(after, entryId)).toEqual(routineFor(before, entryId));
});

const spell = (name: string, level: number, list = 'wizard'): Definition => ({
  name,
  modifiers: [],
  stacksWithItself: false,
  sources: [],
  detail: { kind: 'spell', levels: { [list]: level }, school: 'illusion' },
});

test('the whole campaign Wizard list arrives, including a Spell added to it during preparation', async () => {
  const context = await fixture();
  const { owner, characterId, campaignB, scope, read } = context;
  const wizard = await context.seeded('wizard');
  const [level] = (await read()).entries.filter(
    (row) => row.kind === 'classLevel',
  );
  if (!level) throw new Error('Missing Class Level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: wizard._id,
    operationId: 'wizard',
  });
  const recordedId = await context.shareOneOff(spell('Sigil of Ash', 1), 'ash');
  const unrecordedId = await context.shareOneOff(
    spell('Sigil of Brine', 2),
    'brine',
  );
  const entryId = await owner.mutation(api.characterSheetSpells.record, {
    characterId,
    castingClassId: wizard._id,
    catalogEntryId: recordedId,
    operationId: 'record-ash',
  });
  const command = { characterId, operationId: 'to-B' };
  let progress = await owner.mutation(api.characterMoves.start, {
    ...command,
    destinationCampaignId: campaignB,
  });
  for (let i = 0; i < 50 && progress.state === 'preparing'; i++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress).toMatchObject({ state: 'ready', generation: 0 });
  const lateId = await context.shareOneOff(
    spell('Sigil of Cinders', 3),
    'late',
  );
  for (let i = 0; i < 50 && progress.state !== 'completed'; i++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress).toMatchObject({ state: 'completed', generation: 1 });
  const after = await read();
  const copyOf = (id: Id<'catalogEntry'>) =>
    after.catalogEntries.find(
      (row) =>
        row.copiedFrom === id &&
        row.scope === 'character' &&
        row.characterId === characterId,
    )?._id;
  const browser = await owner.query(api.characterSheetSpells.browse, {
    characterId,
    castingClassId: wizard._id,
    search: 'Sigil',
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(
    browser.page
      .map((row) => [
        row.name,
        row.catalogEntryId,
        row.recorded,
        row.spellLevel,
      ])
      .sort(),
  ).toEqual([
    ['Sigil of Ash', copyOf(recordedId), true, 1],
    ['Sigil of Brine', copyOf(unrecordedId), false, 2],
    ['Sigil of Cinders', copyOf(lateId), false, 3],
  ]);
  expect(after.entries.find((row) => row._id === entryId)).toMatchObject({
    catalogEntryId: copyOf(recordedId),
    state: { castingClassId: wizard._id },
  });
  const info = await owner.query(api.characterSheetSpells.browserInfo, {
    characterId,
    castingClassId: wizard._id,
  });
  expect(info.levels).toEqual(expect.arrayContaining([1, 2, 3]));
});

/**
 * Publish the Character's seeded class, with every definition it references,
 * as the global catalog holds it: the same rows in global scope. Global
 * content arrives only through catalog releases, with no player writer, so
 * the seeded rows are promoted directly.
 */
async function publishSeededClass(
  { t, characterId }: Pick<Fixture, 't' | 'characterId'>,
  identity: string,
) {
  return t.run(async (ctx) => {
    const [seed] = await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_ruleIdentity', (q) =>
        q.eq('characterId', characterId).eq('ruleIdentity', identity),
      )
      .take(1);
    if (!seed) throw new Error(`Missing seeded ${identity}`);
    const pending: string[] = [seed._id];
    const published = new Set<string>();
    while (pending.length > 0) {
      const id = ctx.db.normalizeId('catalogEntry', pending.pop() ?? '');
      if (!id || published.has(id)) continue;
      published.add(id);
      const row = await ctx.db.get('catalogEntry', id);
      if (row?.characterId !== characterId) continue;
      await ctx.db.patch('catalogEntry', id, {
        scope: 'global',
        characterId: undefined,
        browseOnly: undefined,
      });
      pending.push(
        ...listCatalogReferences(row).map((reference) => reference.id),
      );
    }
    return seed._id;
  });
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
type Sheet = Awaited<ReturnType<Fixture['read']>>;
const bravery = {
  source: 'fighter',
  classLevel: 2,
  entry: 'fighter-bravery-2',
};

function classLevels(sheet: Sheet) {
  return sheet.entries
    .filter((entry) => entry.kind === 'classLevel')
    .sort((left, right) => left.state.position - right.state.position);
}
function braveryState(sheet: Sheet) {
  const row = sheet.calculated.resolvedEntries.find(
    (resolved) => resolved.entry._id === formatGrantKeyId(bravery),
  );
  return (
    row && {
      dormant: row.dormant,
      counting: row.counting,
      notes: 'notes' in row.entry ? row.entry.notes : undefined,
    }
  );
}

test('a class switch, Keep and acceptance made during preparation arrive together with the unused campaign version', async () => {
  const context = await fixture();
  const { owner, member, characterId, scope, read } = context;
  const fighter = await publishSeededClass(context, 'fighter');
  const [first] = classLevels(await read());
  if (!first) throw new Error('Missing Class Level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: fighter,
    hpGained: 10,
    operationId: 'level-1',
  });
  const second = await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: fighter,
    operationId: 'level-2',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: second,
    hpGained: 7,
    skillRanks: { 'skill.clm': 1 },
    operationId: 'level-2-state',
  });
  await member.mutation(api.characterSheet.editGrantState, {
    ...scope,
    grantKey: bravery,
    state: { notes: 'Never retreats' },
    operationId: 'bravery-notes',
  });
  // The campaign's Fighter, and this Character's own variant without Bravery.
  const campaignFighter = await owner.mutation(
    api.catalogCopies.customizeForCampaign,
    { ...scope, catalogEntryId: fighter, operationId: 'customize' },
  );
  const ownFighter = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId: first._id },
    operationId: 'detach',
  });
  const own = await context.t.run((ctx) =>
    ctx.db.get('catalogEntry', ownFighter),
  );
  if (own?.detail.kind !== 'class' || !('featuresByLevel' in own.detail))
    throw new Error('Missing own Fighter');
  await owner.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: ownFighter,
    detail: {
      ...own.detail,
      featuresByLevel: own.detail.featuresByLevel.filter(
        (feature) => feature.classLevel !== 2,
      ),
    },
    operationId: 'no-bravery',
  });
  await owner.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first._id,
    classEntryId: campaignFighter,
    operationId: 'campaign-version',
  });
  const active = await read();
  expect(braveryState(active)).toMatchObject({
    dormant: false,
    notes: 'Never retreats',
  });
  const command = { characterId, operationId: 'to-B' };
  let progress = await owner.mutation(api.characterMoves.start, {
    ...command,
    destinationCampaignId: context.campaignB,
  });
  for (let i = 0; i < 50 && progress.state === 'preparing'; i++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress.state).toBe('ready');
  // Meanwhile a second player switches to the own variant, keeps the
  // displaced Bravery and accepts that warning.
  await member.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: second,
    classEntryId: ownFighter,
    operationId: 'own-version',
  });
  await member.mutation(api.characterSheet.setDormantEntryKept, {
    ...scope,
    target: { grantKey: bravery },
    kept: true,
    operationId: 'keep-bravery',
  });
  const kept = (await read()).calculated.warnings.find(
    (row) => row.kind === 'rules' && row.check === 'keptDormant',
  );
  if (kept?.kind !== 'rules') throw new Error('Missing kept warning');
  await member.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: kept.check,
    subject: kept.subject,
    fingerprint: kept.fingerprint,
    operationId: 'accept-kept',
  });
  const dormant = await read();
  expect(braveryState(dormant)).toMatchObject({
    dormant: true,
    notes: 'Never retreats',
  });
  for (let i = 0; i < 50 && progress.state !== 'completed'; i++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress.state).toBe('completed');
  const arrived = await read();
  expect(arrived.campaign?.campaignId).toBe(context.campaignB);
  expect(classLevels(arrived)).toEqual(classLevels(dormant));
  expect(braveryState(arrived)).toEqual(braveryState(dormant));
  expect(arrived.acceptedWarnings).toEqual(dormant.acceptedWarnings);
  expect(
    arrived.calculated.warnings.find(
      (row) => row.kind === 'rules' && row.check === 'keptDormant',
    ),
  ).toEqual(kept);
  // The campaign version arrived as this Character's own, so switching to it
  // restores Bravery with its notes on the same rows.
  const carried = arrived.catalogEntries.find(
    (row) =>
      row.copiedFrom === campaignFighter && row.characterId === characterId,
  );
  expect(carried).toMatchObject({
    scope: 'character',
    ruleIdentity: 'fighter',
  });
  if (!carried) throw new Error('Missing carried Fighter');
  await owner.mutation(api.characterSheet.switchClassVersion, {
    organizationId: 'org',
    characterId,
    entryId: first._id,
    classEntryId: carried._id,
    operationId: 'carried-version',
  });
  const restored = await read();
  expect(braveryState(restored)).toEqual(braveryState(active));
  expect(classLevels(restored)).toEqual(
    classLevels(active).map((row) => ({
      ...row,
      state: { ...row.state, classEntryId: carried._id },
    })),
  );
});

test('mutually referencing campaign feats arrive as one cycle of copies with the same totals', async () => {
  const context = await fixture();
  const { owner, member, characterId, scope, read } = context;
  const { scope: authorScope } = await context.author();
  const feat = (name: string) => ({
    name,
    modifiers: [],
    stacksWithItself: false,
    sources: [],
    detail: { kind: 'feat' as const },
  });
  const guard = await context.shareOneOff(feat('Guarded stance'), 'guard');
  const partner = await context.shareOneOff(
    {
      ...feat('Shield partner'),
      modifiers: [
        {
          target: 'ac',
          bonusType: 'dodge',
          value: 1,
          condition: { whileActive: guard },
        },
      ],
    },
    'partner',
  );
  // Closing the cycle: each feat now counts while the other is active.
  await member.mutation(api.catalogCopies.editDefinition, {
    ...authorScope,
    catalogEntryId: guard,
    modifiers: [
      {
        target: 'ac',
        bonusType: 'untyped',
        value: 1,
        condition: { whileActive: partner },
      },
    ],
    operationId: 'close-cycle',
  });
  for (const catalogEntryId of [guard, partner])
    await owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId,
      operationId: `take-${catalogEntryId}`,
    });
  const before = await read();
  await context.move('to-B');
  const after = await read();
  const copyOf = (id: Id<'catalogEntry'>) =>
    after.catalogEntries.find(
      (row) => row.copiedFrom === id && row.characterId === characterId,
    );
  const [guardCopy, partnerCopy] = [copyOf(guard), copyOf(partner)];
  expect(guardCopy?.modifiers).toEqual([
    expect.objectContaining({ condition: { whileActive: partnerCopy?._id } }),
  ]);
  expect(partnerCopy?.modifiers).toEqual([
    expect.objectContaining({ condition: { whileActive: guardCopy?._id } }),
  ]);
  expect(after.calculated.derivedStatistics.ac.total).toBe(
    before.calculated.derivedStatistics.ac.total,
  );
  expect(before.calculated.derivedStatistics.ac.total).toBe(12);
});

test('a campaign class that gains a Spell list during preparation arrives with that whole list', async () => {
  const context = await fixture();
  const { owner, member, characterId, scope, read } = context;
  const wizard = await publishSeededClass(context, 'wizard');
  const [level] = classLevels(await read());
  if (!level) throw new Error('Missing Class Level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: wizard,
    operationId: 'wizard',
  });
  const campaignWizard = await owner.mutation(
    api.catalogCopies.customizeForCampaign,
    { ...scope, catalogEntryId: wizard, operationId: 'customize' },
  );
  // A campaign list no class casts from yet.
  const runeId = await context.shareOneOff(
    spell('Rune of Ash', 1, 'rune-list'),
    'rune',
  );
  const command = { characterId, operationId: 'to-B' };
  let progress = await owner.mutation(api.characterMoves.start, {
    ...command,
    destinationCampaignId: context.campaignB,
  });
  for (let i = 0; i < 50 && progress.state === 'preparing'; i++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress).toMatchObject({ state: 'ready', generation: 0 });
  // A second player points the campaign's Wizard at that list.
  const definition = await context.t.run((ctx) =>
    ctx.db.get('catalogEntry', campaignWizard),
  );
  if (definition?.detail.kind !== 'class' || !('casting' in definition.detail))
    throw new Error('Missing campaign Wizard');
  const { casting } = definition.detail;
  if (!casting) throw new Error('Missing Wizard casting');
  await member.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: campaignWizard,
    detail: {
      ...definition.detail,
      casting: { ...casting, classTag: 'rune-list' },
    },
    operationId: 'rune-list',
  });
  for (let i = 0; i < 50 && progress.state !== 'completed'; i++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress).toMatchObject({ state: 'completed', generation: 1 });
  const after = await read();
  const carriedWizard = after.catalogEntries.find(
    (row) =>
      row.copiedFrom === campaignWizard && row.characterId === characterId,
  );
  const carriedRune = after.catalogEntries.find(
    (row) => row.copiedFrom === runeId && row.characterId === characterId,
  );
  expect(carriedRune).toMatchObject({
    scope: 'character',
    name: 'Rune of Ash',
  });
  if (!carriedWizard) throw new Error('Missing carried Wizard');
  const browser = await owner.query(api.characterSheetSpells.browse, {
    characterId,
    castingClassId: carriedWizard._id,
    search: 'Rune',
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(browser.page.map((row) => [row.name, row.catalogEntryId])).toEqual([
    ['Rune of Ash', carriedRune?._id],
  ]);
});
