// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { prepare, releaseFixture } from '../tests/catalog-release-fixture';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  canonicalReleaseJson,
  parseReleaseJson,
} from '../src/lib/catalog/release-schema';
import { buildCharacterSheetSelectionsView } from '../src/components/character-sheet/character-sheet-selections-view-model';
import { candidateDefinition } from './lib/catalogCandidateDefinition';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');

// The plain-Modifiers mechanism family's public proof
// (`scripts/catalog/launch-mechanism-proofs.ts`): each proven (source target,
// formula shape) pair, as the importer emits it, reaches its saved-sheet
// total through a Catalog Release, the app's candidate conversion and public
// reads and writes. The bodies are a synthetic fixture shaped as imported
// feats, Racial Traits and traits: one race whose standard traits carry the
// racial pairs, feats with the untyped ones and traits with the trait ones.
// A second race, a trait and a feat carry a constant on every listed skill,
// one per proven bonus type (`listedSkills`).
const race = 'pf1/modifierProofRace';
const skillFocus = 'pf1/modifierProofSkillFocus';
const traits = {
  // `skill.per 2`, racial (Keen Senses).
  perception: 'pf1-content/modifierProofPerception',
  // `skill.int 2`, racial (Intimidating).
  intimidate: 'pf1-content/modifierProofIntimidate',
  // `skill.acr 2` and `skill.clm 2`, racial (Sure-Footed).
  footing: 'pf1-content/modifierProofFooting',
  // `allSavingThrows 1`, racial (Halfling Luck).
  luck: 'pf1-content/modifierProofLuck',
  // `bonusFeats 1`: an open bonus feat slot (Bonus Feat (Human)).
  bonusFeat: 'pf1-content/modifierProofBonusFeat',
  // `bonusFeats 1`: a bonus feat slot for listed feats only (Adaptability).
  listedFeat: 'pf1-content/modifierProofListedFeat',
  // `bonusSkillRanks @attributes.hd.total`: one rank per level (Skilled).
  ranks: 'pf1-content/modifierProofRanks',
} as const;
const feats = {
  // `will 2`, untyped (Iron Will).
  will: 'pf1/modifierProofWill',
  // `fort 2`, untyped (Great Fortitude).
  fortitude: 'pf1/modifierProofFortitude',
  // `ref 2`, untyped (Lightning Reflexes).
  reflex: 'pf1/modifierProofReflex',
  // `init 4`, untyped (Improved Initiative).
  initiative: 'pf1/modifierProofInitiative',
  // `ac 1`, dodge (Dodge).
  dodge: 'pf1/modifierProofDodge',
  // `skill.int @abilities.str.mod`, untyped (Intimidating Prowess, after its
  // reviewed replacement: no floor at 0).
  strength: 'pf1/modifierProofStrength',
} as const;
// Traits, each shaped as a published one and imported with its trait bonus
// type (PF1 traits' bonuses don't stack with each other).
const traitKeys = {
  // `init 2`, trait (Reactionary).
  reactionary: 'pf1-content/modifierProofReactionary',
  // `init 1` and `skill.esc 1`, trait (Rapscallion).
  rapscallion: 'pf1-content/modifierProofRapscallion',
  // `fort 1`, `ref 1` and `will 1`, trait (Resilient, Deft Dodger and
  // Indomitable Faith in one body).
  resolve: 'pf1-content/modifierProofResolve',
} as const;
// trait-cs: traits whose rule makes a skill a class skill, shaped as the
// importer maps them (`detail.classSkills`, or a checked choice record's
// `classSkillChoice`). None of the skills is a Cleric class skill.
const classSkillTraits = {
  // "Bluff is always a class skill for you" and +1 trait Bluff (Fast Talker).
  fastTalker: 'pf1-content/modifierProofFastTalker',
  // Intimidate twice: Bully and Brute (Half-Orc).
  bully: 'pf1-content/modifierProofBully',
  brute: 'pf1-content/modifierProofBrute',
  // "One of these skills (your choice)": +1 trait Knowledge (geography) and
  // Knowledge (nature) (Devotee of the Green).
  devotee: 'pf1-content/modifierProofDevotee',
} as const;

// Every skill a constant pair lists, each in the racial, trait and untyped
// bonus types (`launch-mechanism-proofs.ts`). Each skill's value is its own
// (`skillValue`), so a Modifier reaching another skill's total shows.
const listedSkills = [
  'acr',
  'apr',
  'blf',
  'clm',
  'dev',
  'dip',
  'dis',
  'esc',
  'han',
  'hea',
  'int',
  'kar',
  'kdu',
  'ken',
  'kge',
  'khi',
  'klo',
  'kna',
  'kno',
  'kpl',
  'kre',
  'per',
  'rid',
  'sen',
  'slt',
  'spl',
  'ste',
  'sur',
  'swm',
  'umd',
] as const;
type Skill = (typeof listedSkills)[number];
const skillValue = (skill: Skill) => listedSkills.indexOf(skill) + 1;
const skillRace = 'pf1/modifierProofSkillRace';
const everySkill = {
  // A Racial Trait with a racial bonus on every listed skill.
  racial: 'pf1-content/modifierProofSkillsRacial',
  // A trait with a trait bonus on every listed skill.
  trait: 'pf1-content/modifierProofSkillsTrait',
  // A feat with an untyped bonus on every listed skill.
  untyped: 'pf1/modifierProofSkillsUntyped',
} as const;
const onEverySkill = (bonusType: keyof typeof everySkill) =>
  listedSkills.map((skill) => ({
    target: `skill.${skill}`,
    bonusType,
    value: skillValue(skill),
  }));

type Body = {
  externalKey: string;
  name: string;
  detail: Record<string, unknown>;
  modifiers?: {
    target: string;
    bonusType: string;
    value: number | { formula: string };
  }[];
  grantsSlots?: { kind: 'feat'; count: number; feats?: string[] }[];
};
function body({
  externalKey,
  name,
  detail,
  modifiers = [],
  grantsSlots,
}: Body) {
  return {
    externalKey,
    upstreamKey: externalKey,
    pack:
      detail.kind === 'feat'
        ? 'feats'
        : detail.kind === 'trait'
          ? 'pf-traits'
          : 'races',
    name,
    detail,
    description: `${name}.`,
    sources: [{ book: 'PZO1110', pages: '1' }],
    modifiers,
    ...(grantsSlots ? { grantsSlots } : {}),
    unsupported: [],
  };
}
const racialTrait = (
  externalKey: string,
  name: string,
  change: Omit<Body, 'externalKey' | 'name' | 'detail'> & {
    bonusSkillRanksPerLevel?: number;
    raceKey?: string;
  },
) =>
  body({
    externalKey,
    name,
    detail: {
      kind: 'racialTrait',
      bonusSkillRanksPerLevel: change.bonusSkillRanksPerLevel ?? 0,
      raceKeys: [change.raceKey ?? race],
      standard: true,
      replaces: [],
    },
    modifiers: change.modifiers,
    grantsSlots: change.grantsSlots,
  });
const racial = (target: string, value: number) => ({
  target,
  bonusType: 'racial',
  value,
});
const feat = (
  externalKey: string,
  name: string,
  modifiers: Body['modifiers'] = [],
) =>
  body({
    externalKey,
    name,
    detail: { kind: 'feat', featTypes: ['General'], repeatable: 'no' },
    modifiers,
  });
const untyped = (target: string, value: number | { formula: string }) => ({
  target,
  bonusType: 'untyped',
  value,
});
const trait = (
  externalKey: string,
  name: string,
  modifiers: Body['modifiers'],
) =>
  body({
    externalKey,
    name,
    detail: { kind: 'trait', traitType: 'social' },
    modifiers,
  });
/** A trait whose detail carries its class skills, as the importer maps them. */
const classSkillTrait = (
  externalKey: string,
  name: string,
  {
    modifiers,
    ...classSkills
  }: Pick<Body, 'modifiers'> & {
    classSkills?: string[];
    classSkillChoice?: string[];
  },
) =>
  body({
    externalKey,
    name,
    detail: { kind: 'trait', traitType: 'social', ...classSkills },
    modifiers,
  });
const traitBonus = (target: string, value: number) => ({
  target,
  bonusType: 'trait',
  value,
});
const bodies = [
  body({
    externalKey: race,
    name: 'Modifier Proof Race',
    detail: {
      kind: 'race',
      racialHitDice: 0,
      creatureTypes: ['humanoid'],
      creatureSubtypes: [],
      racialTraits: Object.values(traits),
      size: 'medium',
    },
  }),
  racialTrait(traits.perception, 'Proof Senses', {
    modifiers: [racial('skill.per', 2)],
  }),
  racialTrait(traits.intimidate, 'Proof Menace', {
    modifiers: [racial('skill.int', 2)],
  }),
  racialTrait(traits.footing, 'Proof Footing', {
    modifiers: [racial('skill.acr', 2), racial('skill.clm', 2)],
  }),
  racialTrait(traits.luck, 'Proof Luck', { modifiers: [racial('saves', 1)] }),
  racialTrait(traits.bonusFeat, 'Proof Bonus Feat', {
    grantsSlots: [{ kind: 'feat', count: 1 }],
  }),
  racialTrait(traits.listedFeat, 'Proof Listed Feat', {
    grantsSlots: [{ kind: 'feat', count: 1, feats: [skillFocus] }],
  }),
  racialTrait(traits.ranks, 'Proof Ranks', { bonusSkillRanksPerLevel: 1 }),
  feat(feats.will, 'Proof Will', [untyped('save.will', 2)]),
  feat(feats.fortitude, 'Proof Fortitude', [untyped('save.fort', 2)]),
  feat(feats.reflex, 'Proof Reflex', [untyped('save.ref', 2)]),
  feat(feats.initiative, 'Proof Initiative', [untyped('init', 4)]),
  feat(feats.dodge, 'Proof Dodge', [
    { target: 'ac', bonusType: 'dodge', value: 1 },
  ]),
  feat(feats.strength, 'Proof Strength', [
    untyped('skill.int', { formula: '@ability.str.mod' }),
  ]),
  feat(skillFocus, 'Proof Skill Focus'),
  trait(traitKeys.reactionary, 'Proof Reactionary', [traitBonus('init', 2)]),
  trait(traitKeys.rapscallion, 'Proof Rapscallion', [
    traitBonus('init', 1),
    traitBonus('skill.esc', 1),
  ]),
  trait(traitKeys.resolve, 'Proof Resolve', [
    traitBonus('save.fort', 1),
    traitBonus('save.ref', 1),
    traitBonus('save.will', 1),
  ]),
  body({
    externalKey: skillRace,
    name: 'Modifier Proof Skill Race',
    detail: {
      kind: 'race',
      racialHitDice: 0,
      creatureTypes: ['humanoid'],
      creatureSubtypes: [],
      racialTraits: [everySkill.racial],
      size: 'medium',
    },
  }),
  racialTrait(everySkill.racial, 'Proof Racial Skills', {
    modifiers: onEverySkill('racial'),
    raceKey: skillRace,
  }),
  trait(everySkill.trait, 'Proof Trait Skills', onEverySkill('trait')),
  classSkillTrait(classSkillTraits.fastTalker, 'Proof Fast Talker', {
    modifiers: [traitBonus('skill.blf', 1)],
    classSkills: ['skill.blf'],
  }),
  classSkillTrait(classSkillTraits.bully, 'Proof Bully', {
    modifiers: [traitBonus('skill.int', 1)],
    classSkills: ['skill.int'],
  }),
  classSkillTrait(classSkillTraits.brute, 'Proof Brute', {
    modifiers: [traitBonus('skill.int', 1)],
    classSkills: ['skill.int'],
  }),
  classSkillTrait(classSkillTraits.devotee, 'Proof Devotee', {
    modifiers: [traitBonus('skill.kge', 1), traitBonus('skill.kna', 1)],
    classSkillChoice: ['skill.kge', 'skill.kna'],
  }),
  feat(everySkill.untyped, 'Proof Untyped Skills', onEverySkill('untyped')),
];

/**
 * The bodies through a prepared Catalog Release and the app's candidate
 * conversion (as `raceImport740.integration.test.ts` installs them), and a
 * Cleric 7 (no class bonus feats) with Strength 14 and every other score 10.
 */
async function fixture() {
  const { t, owner, outsider, scope } = await releaseFixture(modules);
  await t.run((ctx) =>
    ctx.db.insert('user', {
      tokenIdentifier: 'test|member',
      orgIds: [{ orgId: 'org', role: 'member' }],
    }),
  );
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const ids: Record<string, Id<'catalogEntry'>> = await t.run(async (ctx) => {
    const ids: Record<string, Id<'catalogEntry'>> = {};
    for (const { externalKey, name, detail } of bodies)
      ids[externalKey] = await ctx.db.insert('catalogEntry', {
        scope: 'global',
        name,
        ruleIdentity: externalKey,
        modifiers: [],
        sources: [],
        stacksWithItself: false,
        detail:
          detail.kind === 'race'
            ? { kind: 'race', racialHitDice: 0, racialTraits: [] }
            : detail.kind === 'feat'
              ? { kind: 'feat' }
              : detail.kind === 'trait'
                ? { kind: 'trait' }
                : { kind: 'racialTrait', raceEntryIds: [], replaces: [] },
      });
    return ids;
  });
  await prepare(
    t,
    bodies.map((entry) => ({
      kind: 'definition',
      key: entry.externalKey,
      payload: parseReleaseJson(JSON.parse(canonicalReleaseJson(entry))),
    })),
  );
  await t.run(async (ctx) => {
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
      .unique();
    if (!release) throw new Error('Missing release');
    for (const id of Object.values(ids)) {
      const stored = await ctx.db.get('catalogEntry', id);
      if (!stored) throw new Error('Missing stored identity');
      const { _id, _creationTime, ...definition } = await candidateDefinition(
        ctx,
        release,
        stored,
      );
      await ctx.db.replace('catalogEntry', _id, definition);
    }
  });
  const id = (key: string) => {
    const found = ids[key];
    if (!found) throw new Error(`Missing ${key}`);
    return found;
  };
  const read = async (viewer = owner) => {
    const sheet = withSheetCatalog(
      await viewer.query(api.characterSheet.read, scope),
    );
    if (!sheet) throw new Error('Missing saved sheet');
    return sheet;
  };
  const initial = await read();
  const level = initial.entries.find((entry) => entry.kind === 'classLevel');
  const cleric = initial.catalogEntries.find(
    (entry) => entry.detail.kind === 'class' && entry.name === 'Cleric',
  );
  if (!level || !cleric) throw new Error('Missing Cleric baseline');
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: cleric._id,
    operationId: 'cleric-1',
  });
  for (let index = 2; index <= 7; index += 1)
    await member.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      classEntryId: cleric._id,
      operationId: `cleric-${index}`,
    });
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 14,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'scores',
  });
  return { owner, member, outsider, scope, id, read };
}

type Sheet = Awaited<ReturnType<Awaited<ReturnType<typeof fixture>>['read']>>;

/** The totals the family's pairs reach, from one public read. */
function totals({ calculated }: Sheet) {
  const { breakdowns, derivedStatistics: statistics } = calculated;
  return {
    'skill.per': breakdowns['skill.per'].total,
    'skill.int': breakdowns['skill.int'].total,
    'skill.acr': breakdowns['skill.acr'].total,
    'skill.clm': breakdowns['skill.clm'].total,
    fortitude: statistics.fortitude.total,
    reflex: statistics.reflex.total,
    will: statistics.will.total,
    initiative: statistics.initiative.total,
    bonusFeats: calculated.selectionRules.budgets.bonusFeats,
    skillRanks: calculated.classLevels.map((row) => row.skillRankBudget),
  };
}

/** The applied contributions a definition makes to a breakdown. */
function applied(
  breakdown: { applied: readonly { source?: string; value: number }[] },
  key: string,
) {
  return breakdown.applied
    .filter((row) => row.source === key)
    .map((row) => row.value);
}

test('each plain Modifier pair reaches its saved-sheet total: skills, saves, initiative, bonus feats, bonus skill ranks and a Strength-modifier formula', async () => {
  const { owner, member, outsider, scope, id, read } = await fixture();
  const base = totals(await read());
  // A Cleric 7 with Strength 14: no class bonus feats, 2 ranks per level.
  expect(base).toMatchObject({
    bonusFeats: 0,
    skillRanks: [2, 2, 2, 2, 2, 2, 2],
  });

  // The race's standard traits: each racial pair adds once, the two slots
  // are bonus feats, and Skilled adds one rank at each level.
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: id(race),
    operationId: 'race',
  });
  const raced = await read();
  expect(totals(raced)).toEqual({
    ...base,
    'skill.per': base['skill.per'] + 2,
    'skill.int': base['skill.int'] + 2,
    'skill.acr': base['skill.acr'] + 2,
    'skill.clm': base['skill.clm'] + 2,
    fortitude: base.fortitude + 1,
    reflex: base.reflex + 1,
    will: base.will + 1,
    bonusFeats: 2,
    skillRanks: [3, 3, 3, 3, 3, 3, 3],
  });
  const { breakdowns, derivedStatistics } = raced.calculated;
  expect(applied(breakdowns['skill.per'], traits.perception)).toEqual([2]);
  expect(applied(breakdowns['skill.int'], traits.intimidate)).toEqual([2]);
  expect(applied(breakdowns['skill.acr'], traits.footing)).toEqual([2]);
  expect(applied(breakdowns['skill.clm'], traits.footing)).toEqual([2]);
  for (const save of ['fortitude', 'reflex', 'will'] as const)
    expect(applied(derivedStatistics[save], traits.luck)).toEqual([1]);

  // The open slot takes any feat; the listed slot takes only its feat.
  const slots = raced.calculated.selectionRules.slots.filter(
    (slot) => slot.kind === 'feat' && slot.grantedBy,
  );
  expect(slots.map((slot) => slot.label)).toEqual([
    'Proof Bonus Feat',
    'Proof Listed Feat',
  ]);
  const open = slots.find((slot) => !slot.feats?.length);
  const listed = slots.find((slot) => slot.feats?.length);
  if (!open || !listed) throw new Error('Missing bonus feat slots');
  expect(listed.feats).toEqual([id(skillFocus)]);
  expect([open.count, listed.count]).toEqual([1, 1]);

  // A Cleric 7 has four general feat slots; the open bonus slot holds the fifth.
  const choose = (slotId: string, position: number, key: string) =>
    member.mutation(api.characterSheet.fillSelectionSlot, {
      ...scope,
      slotId,
      position,
      catalogEntryId: id(key),
      operationId: `choose-${key}`,
    });
  const general = [feats.will, feats.fortitude, feats.reflex, feats.initiative];
  for (const [position, key] of general.entries())
    await choose('feat:general', position, key);
  await choose(open.id, 0, feats.strength);
  const listedId = await choose(listed.id, 0, skillFocus);
  const featured = await read();
  expect(totals(featured)).toEqual({
    ...totals(raced),
    'skill.int': base['skill.int'] + 2 + 2,
    fortitude: base.fortitude + 1 + 2,
    reflex: base.reflex + 1 + 2,
    will: base.will + 1 + 2,
    initiative: base.initiative + 4,
  });
  const statistics = featured.calculated.derivedStatistics;
  expect(applied(statistics.will, feats.will)).toEqual([2]);
  expect(applied(statistics.fortitude, feats.fortitude)).toEqual([2]);
  expect(applied(statistics.reflex, feats.reflex)).toEqual([2]);
  expect(applied(statistics.initiative, feats.initiative)).toEqual([4]);
  expect(
    applied(featured.calculated.breakdowns['skill.int'], feats.strength),
  ).toEqual([2]);
  const slotWarnings = (sheet: Sheet) =>
    sheet.calculated.warnings.filter(
      (warning) =>
        warning.check === 'featSlotType' || warning.check === 'featSlotBudget',
    );
  expect(slotWarnings(featured)).toEqual([]);
  // Another feat in the listed slot does not match it.
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: listedId,
    catalogEntryId: id(feats.will),
    operationId: 'unlisted',
  });
  expect(slotWarnings(await read())).toContainEqual(
    expect.objectContaining({ check: 'featSlotType' }),
  );
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: listedId,
    catalogEntryId: id(skillFocus),
    operationId: 'listed',
  });

  // The formula reads the current Strength modifier, a penalty included.
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 8 },
    operationId: 'weaker',
  });
  const weaker = await read();
  expect(
    applied(weaker.calculated.breakdowns['skill.int'], feats.strength),
  ).toEqual([-1]);
  expect(totals(weaker)['skill.int']).toBe(base['skill.int'] + 2 - 1);

  // Without the race, its traits' contributions go and the general feats'
  // stay.
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: null,
    operationId: 'no-race',
  });
  expect(totals(await read(member))).toMatchObject({
    'skill.per': base['skill.per'],
    'skill.acr': base['skill.acr'],
    fortitude: base.fortitude + 2,
    reflex: base.reflex + 2,
    will: base.will + 2,
    bonusFeats: 0,
    skillRanks: base.skillRanks,
  });
  await expect(outsider.query(api.characterSheet.read, scope)).rejects.toThrow(
    'You do not have access to this org',
  );
});

test('the dodge AC pair adds to AC, touch AC and CMD, never to flat-footed AC, and goes with the feat', async () => {
  const { member, outsider, scope, id, read } = await fixture();
  const armor = ({ calculated }: Sheet) => {
    const { ac, touchAc, flatFootedAc, cmd } = calculated.derivedStatistics;
    return {
      ac: ac.total,
      touchAc: touchAc.total,
      flatFootedAc: flatFootedAc.total,
      cmd: cmd.total,
    };
  };
  const base = armor(await read());
  const dodge = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: id(feats.dodge),
    operationId: 'dodge',
  });
  const dodging = await read();
  expect(armor(dodging)).toEqual({
    ac: base.ac + 1,
    touchAc: base.touchAc + 1,
    flatFootedAc: base.flatFootedAc,
    cmd: base.cmd + 1,
  });
  const { ac, flatFootedAc } = dodging.calculated.derivedStatistics;
  expect(applied(ac, feats.dodge)).toEqual([1]);
  expect(applied(flatFootedAc, feats.dodge)).toEqual([]);
  expect(ac.applied).toContainEqual(
    expect.objectContaining({ source: feats.dodge, bonusType: 'dodge' }),
  );
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: dodge,
    active: false,
    operationId: 'dodge-off',
  });
  expect(armor(await read())).toEqual(base);
  await expect(outsider.query(api.characterSheet.read, scope)).rejects.toThrow(
    'You do not have access to this org',
  );
});

/** Each listed skill's total, from one public read. */
function skillTotals({ calculated }: Sheet) {
  return Object.fromEntries(
    listedSkills.map((skill) => [
      skill,
      calculated.breakdowns[`skill.${skill}`].total,
    ]),
  );
}

test('every listed skill’s constant pair reaches that skill’s total, and only it, in each proven bonus type: racial from a Racial Trait, trait from a trait and untyped from a feat, the three stacking', async () => {
  const { owner, member, outsider, scope, id, read } = await fixture();
  const base = skillTotals(await read());
  const adding = (layers: number) =>
    Object.fromEntries(
      listedSkills.map((skill) => [
        skill,
        (base[skill] ?? 0) + layers * skillValue(skill),
      ]),
    );
  /** Each skill's applied contribution from one definition, with its type. */
  const contributions = (sheet: Sheet, key: string) =>
    Object.fromEntries(
      listedSkills.map((skill) => [
        skill,
        sheet.calculated.breakdowns[`skill.${skill}`].applied
          .filter((row) => row.source === key)
          .map((row) => [row.bonusType, row.value]),
      ]),
    );
  const each = (bonusType: string) =>
    Object.fromEntries(
      listedSkills.map((skill) => [skill, [[bonusType, skillValue(skill)]]]),
    );

  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: id(skillRace),
    operationId: 'skill-race',
  });
  const raced = await read();
  expect(skillTotals(raced)).toEqual(adding(1));
  expect(contributions(raced, everySkill.racial)).toEqual(each('racial'));

  const traitId = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 0,
    catalogEntryId: id(everySkill.trait),
    operationId: 'skill-trait',
  });
  const traited = await read();
  expect(skillTotals(traited)).toEqual(adding(2));
  expect(contributions(traited, everySkill.trait)).toEqual(each('trait'));

  await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: id(everySkill.untyped),
    operationId: 'skill-feat',
  });
  const all = await read(member);
  expect(skillTotals(all)).toEqual(adding(3));
  expect(contributions(all, everySkill.untyped)).toEqual(each('untyped'));
  expect(contributions(all, everySkill.racial)).toEqual(each('racial'));
  expect(contributions(all, everySkill.trait)).toEqual(each('trait'));

  // Switched off, the trait's contribution goes; without the race, its
  // trait's goes too.
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: traitId,
    active: false,
    operationId: 'skill-trait-off',
  });
  expect(skillTotals(await read())).toEqual(adding(2));
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: null,
    operationId: 'no-skill-race',
  });
  const featOnly = await read();
  expect(skillTotals(featOnly)).toEqual(adding(1));
  expect(contributions(featOnly, everySkill.racial)).toEqual(
    Object.fromEntries(listedSkills.map((skill) => [skill, []])),
  );
  await expect(outsider.query(api.characterSheet.read, scope)).rejects.toThrow(
    'You do not have access to this org',
  );
});

test('trait bonuses don’t stack with each other: on initiative the higher applies and the lower is suppressed, while trait bonuses on saves and initiative stack with racial and untyped ones', async () => {
  const { owner, member, outsider, scope, id, read } = await fixture();
  const values = ({ calculated }: Sheet) => {
    const { fortitude, reflex, will, initiative } =
      calculated.derivedStatistics;
    return {
      fortitude: fortitude.total,
      reflex: reflex.total,
      will: will.total,
      initiative: initiative.total,
      'skill.esc': calculated.breakdowns['skill.esc'].total,
    };
  };
  const base = values(await read());
  const choose = (position: number, key: string) =>
    member.mutation(api.characterSheet.fillSelectionSlot, {
      ...scope,
      slotId: 'trait:general',
      position,
      catalogEntryId: id(key),
      operationId: `trait-${key}`,
    });

  // The lower trait bonus first, then the higher: only the higher applies on
  // initiative; the lower trait's Escape Artist bonus still applies.
  await choose(0, traitKeys.rapscallion);
  expect(values(await read())).toEqual({
    ...base,
    initiative: base.initiative + 1,
    'skill.esc': base['skill.esc'] + 1,
  });
  const reactionaryId = await choose(1, traitKeys.reactionary);
  const both = await read();
  expect(values(both)).toEqual({
    ...base,
    initiative: base.initiative + 2,
    'skill.esc': base['skill.esc'] + 1,
  });
  const { initiative } = both.calculated.derivedStatistics;
  expect(applied(initiative, traitKeys.reactionary)).toEqual([2]);
  expect(applied(initiative, traitKeys.rapscallion)).toEqual([]);
  expect(
    initiative.suppressed.filter((row) => row.source === traitKeys.rapscallion),
  ).toEqual([
    expect.objectContaining({
      bonusType: 'trait',
      value: 1,
      reason: 'A higher bonus of this type applies.',
    }),
  ]);
  expect(
    applied(both.calculated.breakdowns['skill.esc'], traitKeys.rapscallion),
  ).toEqual([1]);

  // A trait bonus stacks with a racial one (the race's +1 on every save) and
  // untyped ones (+2 Will, +4 initiative from feats).
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: id(race),
    operationId: 'race',
  });
  await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: id(traitKeys.resolve),
    operationId: 'resolve',
  });
  for (const key of [feats.will, feats.initiative])
    await member.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: id(key),
      operationId: `feat-${key}`,
    });
  const stacked = await read(member);
  expect(values(stacked)).toEqual({
    fortitude: base.fortitude + 1 + 1,
    reflex: base.reflex + 1 + 1,
    will: base.will + 1 + 1 + 2,
    initiative: base.initiative + 2 + 4,
    'skill.esc': base['skill.esc'] + 1,
  });
  const statistics = stacked.calculated.derivedStatistics;
  for (const save of ['fortitude', 'reflex', 'will'] as const) {
    expect(applied(statistics[save], traitKeys.resolve), save).toEqual([1]);
    expect(applied(statistics[save], traits.luck), save).toEqual([1]);
  }
  expect(applied(statistics.will, feats.will)).toEqual([2]);
  expect(applied(statistics.initiative, feats.initiative)).toEqual([4]);

  // With the higher trait switched off, the lower one applies.
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: reactionaryId,
    active: false,
    operationId: 'reactionary-off',
  });
  const lower = await read();
  expect(values(lower).initiative).toBe(base.initiative + 1 + 4);
  expect(
    applied(
      lower.calculated.derivedStatistics.initiative,
      traitKeys.rapscallion,
    ),
  ).toEqual([1]);
  await expect(outsider.query(api.characterSheet.read, scope)).rejects.toThrow(
    'You do not have access to this org',
  );
});

test('a trait’s class skill reaches the saved sheet: a fixed one gives the +3 with a rank, a choice one only once its choice is saved, an inactive one nothing, and two on one skill the +3 once', async () => {
  const { owner, member, outsider, scope, id, read } = await fixture();
  const initial = await read();
  const [first, second] = initial.entries.filter(
    (entry) => entry.kind === 'classLevel',
  );
  if (!first || !second) throw new Error('Missing Cleric levels');
  const skill = (sheet: Sheet, key: string) => ({
    total: sheet.calculated.breakdowns[key as 'skill.blf'].total,
    classSkill:
      sheet.calculated.skills.find((row) => row.key === key)?.classSkill ??
      null,
    classBonus: sheet.calculated.breakdowns[key as 'skill.blf'].applied
      .filter((row) => row.entryName === 'Class skill')
      .map((row) => row.value),
  });
  const choose = (key: string) =>
    member.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: id(key),
      operationId: `class-skill-${key}`,
    });

  // Fast Talker at 0 ranks: a class skill, but only its +1 trait bonus.
  const fastTalkerId = await choose(classSkillTraits.fastTalker);
  expect(skill(await read(), 'skill.blf')).toEqual({
    total: 1,
    classSkill: true,
    classBonus: [],
  });
  // With 1 rank: 1 + 1 trait + 3 (Charisma 10).
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    skillRanks: { 'skill.blf': 1, 'skill.int': 1 },
    operationId: 'ranks-1',
  });
  const ranked = await read();
  expect(skill(ranked, 'skill.blf')).toEqual({
    total: 5,
    classSkill: true,
    classBonus: [3],
  });
  expect(
    applied(
      ranked.calculated.breakdowns['skill.blf'],
      classSkillTraits.fastTalker,
    ),
  ).toEqual([1]);
  // Intimidate with a rank and no trait is no Cleric class skill.
  expect(skill(ranked, 'skill.int')).toEqual({
    total: 1,
    classSkill: false,
    classBonus: [],
  });
  // Switched off, Fast Talker gives neither the class skill nor its +1.
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: fastTalkerId,
    active: false,
    operationId: 'fast-talker-off',
  });
  expect(skill(await read(), 'skill.blf')).toEqual({
    total: 1,
    classSkill: false,
    classBonus: [],
  });

  // Bully and Brute both make Intimidate a class skill: the +3 is once, and
  // their two +1 trait bonuses don't stack.
  await choose(classSkillTraits.bully);
  await choose(classSkillTraits.brute);
  expect(skill(await read(owner), 'skill.int')).toEqual({
    total: 5,
    classSkill: true,
    classBonus: [3],
  });

  // Devotee: no class skill and an incomplete choice until one is saved.
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: second._id,
    skillRanks: { 'skill.kge': 1, 'skill.kna': 1 },
    operationId: 'ranks-2',
  });
  const devoteeId = await choose(classSkillTraits.devotee);
  const row = (sheet: Sheet) =>
    buildCharacterSheetSelectionsView(sheet).rows.find(
      (candidate) => candidate.entryId === devoteeId,
    );
  const unset = await read();
  expect(row(unset)).toMatchObject({
    choice: null,
    choiceLabel: 'Class skill',
    choiceOptions: ['Knowledge (geography)', 'Knowledge (nature)'],
    choiceIncomplete: true,
  });
  for (const key of ['skill.kge', 'skill.kna'])
    expect(skill(unset, key), key).toEqual({
      total: 2,
      classSkill: false,
      classBonus: [],
    });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: devoteeId,
    choice: 'Knowledge (nature)',
    operationId: 'devotee-choice',
  });
  // The choice survives a reload and another member's read.
  for (const viewer of [member, owner]) {
    const chosen = await read(viewer);
    expect(row(chosen)).toMatchObject({
      choice: 'Knowledge (nature)',
      choiceIncomplete: false,
    });
    expect(skill(chosen, 'skill.kna')).toEqual({
      total: 5,
      classSkill: true,
      classBonus: [3],
    });
    expect(skill(chosen, 'skill.kge')).toEqual({
      total: 2,
      classSkill: false,
      classBonus: [],
    });
  }
  await expect(outsider.query(api.characterSheet.read, scope)).rejects.toThrow(
    'You do not have access to this org',
  );
});
