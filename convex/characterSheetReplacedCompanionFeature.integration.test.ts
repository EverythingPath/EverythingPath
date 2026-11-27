// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

type Member = ReturnType<ReturnType<typeof convexTest>['withIdentity']>;

// A companion sheet without the Class Level a new sheet starts with.
async function createClasslessCompanion(
  member: Member,
  campaignId: Id<'campaign'>,
) {
  const companionId = await member.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Companion',
    kind: 'npc',
    operationId: 'companion',
  });
  const unwanted = (
    await member.query(api.characterSheet.read, { characterId: companionId })
  )?.entries.find((entry) => entry.kind === 'classLevel');
  if (!unwanted) throw new Error('Missing companion level');
  await member.mutation(api.characterSheet.deleteClassLevel, {
    characterId: companionId,
    entryId: unwanted._id,
    operationId: 'classless',
  });
  return companionId;
}

// A Ranger 7 (and Druid levels when asked) whose class links hunter's bond at
// 4th level (CRB p. 66), with the Guide and the Horse Lord seeded but not
// selected, and a classless companion sheet. Their rows aren't admitted yet,
// so they are seeded under the keys an import gives them: the Foundry ranger,
// druid and hunter's bond, and the frozen #716 identities. The Guide's
// Terrain Bond replaces hunter's bond (APG p. 125; PRD advancedPlayersGuide/
// coreClasses/ranger.html:367); the Horse Lord's Mounted Bond replaces it with
// an animal companion at ranger level − 3 (APG p. 125; :374). The druid has
// no feature schedule here, so its nature bond is no Grant.
async function seedRangerSheet({ druidLevels }: { druidLevels: number }) {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (const tokenIdentifier of ['test|owner', 'test|member'])
      await ctx.db.insert('user', {
        tokenIdentifier,
        orgIds: [{ orgId: 'org', role: 'member' }],
        characterSheetDemo: true,
      });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const campaignId = await owner.mutation(api.campaign.createCampaign, {
    name: 'Ironfang',
    description: '',
    organizationId: 'org',
  });
  await t.run((ctx) =>
    ctx.db.patch('campaign', campaignId, {
      e2eFixture: {
        namespace: 'replaced-companion-feature',
        version: 1,
        workerKey: '0',
        caseKey: 'replaced-companion-feature',
        campaignKey: 'replaced-companion-feature',
      },
    }),
  );
  const characterId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Ranger',
    kind: 'pc',
    operationId: 'ranger',
  });
  const classDetail = (
    hitDie: number,
    bab: 'full' | 'threeQuarters',
    featuresByLevel: {
      classLevel: number;
      catalogEntryId: Id<'catalogEntry'>;
    }[],
  ) => ({
    kind: 'class' as const,
    classKind: 'base' as const,
    hitDie,
    bab,
    saves: { fort: 'good', ref: 'good', will: 'poor' } as const,
    skillRanksPerLevel: 6,
    classSkills: [],
    featuresByLevel,
    picksByLevel: [],
  });
  const ids = await t.run(async (ctx) => {
    const entry = ({
      name,
      ruleIdentity,
      pages,
      book = 'Pathfinder RPG Advanced Player’s Guide',
    }: {
      name: string;
      ruleIdentity: string;
      pages: string;
      book?: string;
    }) => ({
      characterId,
      scope: 'character' as const,
      name,
      ruleIdentity,
      sources: [{ book, pages }],
      modifiers: [],
      stacksWithItself: false,
    });
    const feature = (name: string, ruleIdentity: string, pages: string) =>
      ctx.db.insert('catalogEntry', {
        ...entry({ name, ruleIdentity, pages }),
        detail: { kind: 'classFeature' },
      });
    const huntersBond = await ctx.db.insert('catalogEntry', {
      ...entry({
        name: 'Hunter’s Bond',
        ruleIdentity: 'pf1/Bs5i98ja24ODe9WL',
        pages: '66',
        book: 'Pathfinder RPG Core Rulebook',
      }),
      detail: { kind: 'classFeature' },
    });
    const ranger = await ctx.db.insert('catalogEntry', {
      ...entry({
        name: 'Ranger',
        ruleIdentity: 'pf1/w3wjj6s3N69BsMc3',
        pages: '64–67',
        book: 'Pathfinder RPG Core Rulebook',
      }),
      detail: classDetail(10, 'full', [
        { classLevel: 4, catalogEntryId: huntersBond },
      ]),
    });
    const druid = await ctx.db.insert('catalogEntry', {
      ...entry({
        name: 'Druid',
        ruleIdentity: 'pf1/7eZQP0MzeO2svmVF',
        pages: '48–53',
        book: 'Pathfinder RPG Core Rulebook',
      }),
      detail: classDetail(8, 'threeQuarters', []),
    });
    const terrainBond = await feature(
      'Terrain Bond',
      'everythingpath/ranger-guide-terrain-bond',
      '125',
    );
    const mountedBond = await feature(
      'Mounted Bond',
      'everythingpath/ranger-horse-lord-mounted-bond',
      '125',
    );
    // The same bond under a key `companionGrantingFeatures` does not name, as
    // a newly imported Archetype's own bond would arrive.
    const unlistedBond = await feature(
      'Mounted Bond',
      'everythingpath/ranger-horse-lord-unlisted-mounted-bond',
      '125',
    );
    const archetype = ({
      added,
      ...named
    }: {
      name: string;
      ruleIdentity: string;
      pages: string;
      added: Id<'catalogEntry'>;
    }) =>
      ctx.db.insert('catalogEntry', {
        ...entry(named),
        detail: {
          kind: 'archetype',
          classEntryIds: [ranger],
          replaces: [
            { classLevel: 4, catalogEntryId: huntersBond, scope: 'whole' },
          ],
          adds: [{ classLevel: 4, catalogEntryId: added }],
        },
      });
    return {
      ranger,
      druid,
      guide: await archetype({
        name: 'Guide',
        ruleIdentity: 'everythingpath/ranger-guide',
        pages: '125',
        added: terrainBond,
      }),
      horseLord: await archetype({
        name: 'Horse Lord',
        ruleIdentity: 'everythingpath/ranger-horse-lord',
        pages: '125',
        added: mountedBond,
      }),
      unlistedHorseLord: await archetype({
        name: 'Horse Lord',
        ruleIdentity: 'everythingpath/ranger-horse-lord-unlisted',
        pages: '125',
        added: unlistedBond,
      }),
    };
  });
  const initial = (
    await owner.query(api.characterSheet.read, { characterId })
  )?.entries.find((entry) => entry.kind === 'classLevel');
  if (!initial) throw new Error('Missing initial level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: initial._id,
    classEntryId: ids.ranger,
    hpGained: 10,
    operationId: 'ranger-1',
  });
  for (let position = 2; position <= 7; position++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      classEntryId: ids.ranger,
      operationId: `ranger-${position}`,
    });
  for (let level = 1; level <= druidLevels; level++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      classEntryId: ids.druid,
      operationId: `druid-${level}`,
    });
  const levels = (
    await owner.query(api.characterSheet.read, { characterId })
  )?.entries.flatMap((entry) => (entry.kind === 'classLevel' ? [entry] : []));
  const firstRanger = levels?.find((entry) => entry.state.position === 1);
  const firstDruid = levels?.find(
    (entry) => entry.state.classEntryId === ids.druid,
  );
  if (!firstRanger) throw new Error('Missing first level');
  const select =
    (archetype: 'guide' | 'horseLord' | 'unlistedHorseLord') =>
    (selected: boolean) =>
      owner.mutation(api.characterSheet.setArchetypeSelected, {
        characterId,
        classEntryId: ids.ranger,
        catalogEntryId: ids[archetype],
        selected,
        operationId: `${archetype}-${selected}`,
      });
  const companionId = await createClasslessCompanion(member, campaignId);
  await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: companionId,
    kind: 'animalCompanion',
    sources: [
      {
        key: 'hunters-bond',
        label: 'Hunter’s bond',
        sheetEntryId: firstRanger._id,
        enabled: true,
      },
      ...(firstDruid
        ? [
            {
              key: 'nature-bond',
              label: 'Nature bond',
              sheetEntryId: firstDruid._id,
              enabled: true,
            },
          ]
        : []),
    ],
    operationId: 'link',
  });
  const setProgression = () =>
    member.mutation(api.characterSheet.setCompanionProgression, {
      characterId: companionId,
      operationId: 'progression',
      progression: {
        species: 'wolf',
        hpGained: 10,
        skillRanks: {},
        abilityIncreases: [],
        advancementChoice: 'species',
        keep: false,
      },
    });
  const progression = async () =>
    (await member.query(api.characterSheet.read, { characterId: companionId }))
      ?.calculated.companionProgression;
  // The ranger leaves the campaign: the companion's member can no longer
  // open it.
  const hideRanger = () =>
    t.run((ctx) =>
      ctx.db.patch('character', characterId, {
        campaignId: undefined,
        sheetDemo: true,
      }),
    );
  const readCompanion = () =>
    member.query(api.characterSheet.read, { characterId: companionId });
  const reads = await companionReads({
    t,
    owner,
    member,
    characterId,
    companionId,
  });
  const removeFirstDruidLevel = async () => {
    if (!firstDruid) throw new Error('Missing druid level');
    await owner.mutation(api.characterSheet.deleteClassLevel, {
      characterId,
      entryId: firstDruid._id,
      operationId: 'remove-druid-1',
    });
  };
  return {
    setProgression,
    ...reads,
    removeFirstDruidLevel,
    selectGuide: select('guide'),
    selectHorseLord: select('horseLord'),
    selectUnlistedHorseLord: select('unlistedHorseLord'),
    progression,
    hideRanger,
    readCompanion,
  };
}

// The relationship read, restoring it, the linked levels and a companion feat
// needing four ranger levels, read through the linked ranger levels (the
// companion has none of its own) while it records no companion progression,
// which reads class levels as its own.
async function companionReads({
  t,
  owner,
  member,
  characterId,
  companionId,
}: {
  t: ReturnType<typeof convexTest>;
  owner: Member;
  member: Member;
  characterId: Id<'character'>;
  companionId: Id<'character'>;
}) {
  const relationship = async () => {
    const [row] = await owner.query(api.companionRelationships.list, {
      characterId,
    });
    if (!row) throw new Error('Missing relationship');
    return row;
  };
  const featId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      characterId: companionId,
      scope: 'character',
      ruleIdentity: 'ranger-trained-companion-feat',
      name: 'Ranger-trained companion feat',
      detail: { kind: 'feat' },
      prerequisites: [{ classLevel: 'ranger', min: 4 }],
      sources: [],
      modifiers: [],
      stacksWithItself: false,
    }),
  );
  await member.mutation(api.characterSheet.selectEntry, {
    characterId: companionId,
    catalogEntryId: featId,
    operationId: 'ranger-feat',
  });
  const rangerPrerequisite = async () =>
    (
      await member.query(api.characterSheet.read, { characterId: companionId })
    )?.calculated.prerequisites.find(
      ({ clause, view }) =>
        view === 'current' &&
        'classLevel' in clause &&
        clause.classLevel === 'ranger',
    )?.met;
  const linkedLevels = async (classRuleIdentity: 'ranger' | 'druid') =>
    member.query(api.characterSheetLinkedInputs.read, {
      characterId: companionId,
      relationshipId: (await relationship()).relationshipId,
      input: { kind: 'classLevels', classRuleIdentity },
    });
  const restore = async () =>
    owner.mutation(api.companionRelationships.restore, {
      relationshipId: (await relationship()).relationshipId,
      operationId: 'restore',
    });
  return { relationship, rangerPrerequisite, linkedLevels, restore };
}

// The sheet above with the companion's progression recorded, unless asked.
async function seedRanger({
  druidLevels,
  withProgression = true,
}: {
  druidLevels: number;
  withProgression?: boolean;
}) {
  const seeded = await seedRangerSheet({ druidLevels });
  if (withProgression) await seeded.setProgression();
  return seeded;
}

// Ranger 7: hunter's bond gives effective druid level 7 − 3 = 4 (CRB p. 66),
// so 4 HD (CRB Table 3–8).
const huntersBond = {
  sourceKey: 'hunters-bond',
  ruleKind: 'rangerCompanion',
  classRuleIdentity: 'ranger',
  counting: true,
  classLevels: 7,
  effectiveLevel: 4,
};
const natureBond = {
  sourceKey: 'nature-bond',
  ruleKind: 'druidCompanion',
  classRuleIdentity: 'druid',
  counting: true,
  classLevels: 3,
  effectiveLevel: 3,
};
// The Guide's replaced hunter's bond: the source stays listed, not counting,
// and names what replaced it.
const replacedBond = {
  sourceKey: 'hunters-bond',
  ruleKind: 'rangerCompanion',
  counting: false,
  classLevels: null,
  effectiveLevel: null,
  featureReplaced: { archetypes: ['Guide'] },
};
const counting = (
  result: Awaited<
    ReturnType<Awaited<ReturnType<typeof seedRanger>>['progression']>
  >,
) => result?.contributions.filter((contribution) => contribution.counting);

test('a Ranger 7’s companion stops counting while the Guide replaces hunter’s bond, and counts again without it', async () => {
  const { selectGuide, progression } = await seedRanger({ druidLevels: 0 });
  expect(await progression()).toMatchObject({
    status: 'active',
    effectiveLevel: 4,
    hitDice: 4,
    contributions: [huntersBond],
  });
  await selectGuide(true);
  const replaced = await progression();
  expect(replaced).toMatchObject({
    status: 'dormant',
    effectiveLevel: null,
    hitDice: null,
    contributions: [replacedBond],
  });
  expect(counting(replaced)).toEqual([]);
  await selectGuide(false);
  const restored = await progression();
  expect(restored).toMatchObject({
    status: 'active',
    effectiveLevel: 4,
    hitDice: 4,
    contributions: [huntersBond],
  });
  expect(restored?.contributions[0]).not.toHaveProperty('featureReplaced');
});

// Losing an entitlement removes only that source's contribution: the druid
// levels keep theirs throughout.
test('a Ranger 7 / Druid 3 keeps the nature bond’s effective level 3 while the Guide replaces hunter’s bond', async () => {
  const { selectGuide, progression } = await seedRanger({ druidLevels: 3 });
  const both = await progression();
  expect(both).toMatchObject({ status: 'active', effectiveLevel: 7 });
  expect(counting(both)).toEqual([
    expect.objectContaining(huntersBond),
    expect.objectContaining(natureBond),
  ]);
  await selectGuide(true);
  const replaced = await progression();
  expect(replaced).toMatchObject({
    status: 'active',
    effectiveLevel: 3,
    hitDice: 3,
  });
  expect(counting(replaced)).toEqual([expect.objectContaining(natureBond)]);
  expect(replaced?.contributions).toContainEqual(
    expect.objectContaining(replacedBond),
  );
  await selectGuide(false);
  const restored = await progression();
  expect(restored).toMatchObject({ status: 'active', effectiveLevel: 7 });
  expect(counting(restored)).toEqual([
    expect.objectContaining(huntersBond),
    expect.objectContaining(natureBond),
  ]);
});

// The relationship read takes each source's standing from the graph's
// support of the associated sheet, the progression from the linked-input
// context's, both through readCompanionSourceStatus: on a current read with
// access to the ranger they give each switched-on source the same standing
// in each arm, so a divergence of their inputs fails here
// (companion-entitlement-replaced fix r2). A read without access and the
// permanent progression use other inputs and are not compared.
test('on a current read with access, the relationship read and the progression give each switched-on source the same standing', async () => {
  const { selectGuide, relationship, progression, removeFirstDruidLevel } =
    await seedRanger({ druidLevels: 3 });
  const standings = async () => {
    const fromGraph = (await relationship()).sources.map((source) => ({
      sourceKey: source.key,
      counting: source.available,
      ...(!source.available && source.notEntitled?.reason === 'replacedBy'
        ? { replacedBy: source.notEntitled.archetypes }
        : {}),
    }));
    const fromProgression = (await progression())?.contributions.map(
      (contribution) => ({
        sourceKey: contribution.sourceKey,
        counting: contribution.counting,
        ...(!contribution.counting && contribution.featureReplaced
          ? { replacedBy: contribution.featureReplaced.archetypes }
          : {}),
      }),
    );
    expect(fromProgression).toEqual(fromGraph);
    return fromGraph;
  };
  expect(await standings()).toEqual([
    { sourceKey: 'hunters-bond', counting: true },
    { sourceKey: 'nature-bond', counting: true },
  ]);
  await selectGuide(true);
  expect(await standings()).toEqual([
    { sourceKey: 'hunters-bond', counting: false, replacedBy: ['Guide'] },
    { sourceKey: 'nature-bond', counting: true },
  ]);
  await selectGuide(false);
  await removeFirstDruidLevel();
  expect(await standings()).toEqual([
    { sourceKey: 'hunters-bond', counting: true },
    { sourceKey: 'nature-bond', counting: false },
  ]);
});

// The Horse Lord's Mounted Bond replaces hunter's bond and is itself an animal
// companion at ranger level − 3, so the Class Level keeps its entitlement.
test('a Horse Lord Ranger 7’s Mounted Bond keeps the companion at effective level 4', async () => {
  const { selectHorseLord, progression } = await seedRanger({
    druidLevels: 0,
  });
  await selectHorseLord(true);
  const result = await progression();
  expect(result).toMatchObject({
    status: 'active',
    effectiveLevel: 4,
    hitDice: 4,
    contributions: [huntersBond],
  });
  expect(result?.contributions[0]).not.toHaveProperty('featureReplaced');
});

// Without access to the ranger, its sheet is not read: the source keeps
// counting with an unavailable ranger level, as any hidden associated
// Character's does, and the read names none of the ranger's Archetypes
// (PRD §15).
test('without access to the ranger, the source names no Archetype', async () => {
  const { selectGuide, hideRanger, readCompanion } = await seedRanger({
    druidLevels: 0,
  });
  await selectGuide(true);
  await hideRanger();
  const hidden = await readCompanion();
  expect(hidden?.calculated.companionProgression).toMatchObject({
    status: 'unresolved',
    contributions: [
      {
        sourceKey: 'rule:rangerCompanion',
        ruleKind: 'rangerCompanion',
        counting: true,
        effectiveLevel: null,
      },
    ],
  });
  const read = JSON.stringify([
    hidden?.calculated,
    hidden?.permanentCalculated,
    hidden?.companionCalculationInputs,
  ]);
  expect(read).not.toContain('"Guide"');
  expect(read).not.toContain('featureReplaced');
});

// A sole source the rules no longer entitle interrupts its relationship as a
// lost Grant does: the relationship read says why, it cannot be restored, and
// the Companion borrows no ranger levels. Removing the Guide restores all.
test('a Ranger 7’s only source, replaced by the Guide, interrupts the relationship until the Guide goes', async () => {
  const {
    selectGuide,
    relationship,
    rangerPrerequisite,
    linkedLevels,
    restore,
  } = await seedRanger({ druidLevels: 0, withProgression: false });
  expect(await relationship()).toMatchObject({
    status: 'active',
    interruption: null,
    sources: [{ key: 'hunters-bond', available: true }],
  });
  expect(await rangerPrerequisite()).toBe(true);
  expect(await linkedLevels('ranger')).toMatchObject({ value: 7 });
  await selectGuide(true);
  const interrupted = await relationship();
  expect(interrupted).toMatchObject({
    status: 'interrupted',
    interruption: 'support',
    sources: [
      {
        key: 'hunters-bond',
        available: false,
        notEntitled: { reason: 'replacedBy', archetypes: ['Guide'] },
      },
    ],
  });
  await expect(restore()).rejects.toThrow(
    'This relationship has no available supporting source',
  );
  expect(await rangerPrerequisite()).not.toBe(true);
  expect(await linkedLevels('ranger')).toMatchObject({
    status: 'unavailable',
    unavailableReason: 'interrupted',
    value: null,
  });
  await selectGuide(false);
  const restored = await relationship();
  expect(restored).toMatchObject({
    status: 'active',
    interruption: null,
    sources: [{ key: 'hunters-bond', available: true }],
  });
  expect(restored.sources[0]).not.toHaveProperty('notEntitled');
  expect(await rangerPrerequisite()).toBe(true);
  expect(await linkedLevels('ranger')).toMatchObject({ value: 7 });
});

// With a second entitled source the relationship stays active: only the
// ranger's contribution goes (Ranger 7: 7 − 3 = 4), the druid keeps its 3,
// and the restored total is 4 + 3 = 7.
test('a Ranger 7 / Druid 3 stays linked while the Guide replaces hunter’s bond, lending only the druid levels', async () => {
  const {
    selectGuide,
    relationship,
    rangerPrerequisite,
    linkedLevels,
    setProgression,
    progression,
  } = await seedRanger({ druidLevels: 3, withProgression: false });
  await selectGuide(true);
  expect(await relationship()).toMatchObject({
    status: 'active',
    interruption: null,
    sources: [
      {
        key: 'hunters-bond',
        available: false,
        notEntitled: { reason: 'replacedBy', archetypes: ['Guide'] },
      },
      { key: 'nature-bond', available: true },
    ],
  });
  expect(await rangerPrerequisite()).not.toBe(true);
  expect(await linkedLevels('ranger')).toMatchObject({ value: null });
  expect(await linkedLevels('druid')).toMatchObject({ value: 3 });
  await selectGuide(false);
  const restored = await relationship();
  expect(restored).toMatchObject({
    status: 'active',
    sources: [
      { key: 'hunters-bond', available: true },
      { key: 'nature-bond', available: true },
    ],
  });
  expect(restored.sources[0]).not.toHaveProperty('notEntitled');
  expect(await rangerPrerequisite()).toBe(true);
  expect(await linkedLevels('ranger')).toMatchObject({ value: 7 });
  await setProgression();
  const total = await progression();
  expect(total).toMatchObject({ status: 'active', effectiveLevel: 7 });
  expect(counting(total)).toEqual([
    expect.objectContaining({ ...huntersBond, effectiveLevel: 4 }),
    expect.objectContaining({ ...natureBond, effectiveLevel: 3 }),
  ]);
  await selectGuide(true);
  const replaced = await progression();
  expect(replaced).toMatchObject({ status: 'active', effectiveLevel: 3 });
  expect(counting(replaced)).toEqual([expect.objectContaining(natureBond)]);
});

// A replacement bond the list does not name is not read, so the Class Level
// loses its companion and says what replaced it: the sheet shows the loss
// instead of silently keeping a companion the rules took away
// (tests/catalog/companion-granting-features.test.ts classifies every
// Druid and Ranger Archetype so a new one is looked at).
test('a Horse Lord bond under a key the list does not name reads Replaced by Horse Lord', async () => {
  const { selectUnlistedHorseLord, progression } = await seedRanger({
    druidLevels: 0,
  });
  await selectUnlistedHorseLord(true);
  expect(await progression()).toMatchObject({
    status: 'dormant',
    contributions: [
      { ...replacedBond, featureReplaced: { archetypes: ['Horse Lord'] } },
    ],
  });
});
