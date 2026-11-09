// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { prepare, releaseFixture } from '../tests/catalog-release-fixture';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  canonicalReleaseJson,
  parseReleaseJson,
} from '../src/lib/catalog/release-schema';
import {
  calculateCharacterSheet,
  type ResolvedStatistic,
} from '../src/lib/character-sheet';
import type { RequestedSituation } from '../src/lib/character-sheet-situations';
import type { ManualProficiency } from '../src/lib/character-sheet-proficiency-schema';
import { candidateDefinition } from './lib/catalogCandidateDefinition';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';

const modules = import.meta.glob('./**/*.ts');

// The gear family's public proof (`scripts/catalog/launch-gear.ts`): worn
// armor and a shield without a bash, as the importer emits them, reach the
// saved sheet through a Catalog Release, the app's candidate conversion and
// public reads and writes. The conversion keeps each armor block; a worn
// armor's bonus reaches `ac.armor` and a shield's `ac.shield`, Dexterity to
// AC is capped at the lowest worn cap, the armor check penalties add on
// Strength and Dexterity skills, and arcane spell failure is summed and shown
// (`docs/character-sheet/weapons-and-armor.md`); the imported categories read
// light, medium, heavy and shield proficiency, and an item worn without it
// takes its penalty on every attack line; enhancement adds on the armor's own
// leaf, masterwork lowers the penalty, and two worn armors compete
// highest-only while both caps and penalties apply; a shield's Situational
// attack penalties stay out of every total, are listed in `conditional` with
// their local Situations and apply on their own line only; targeted notes
// reach their statistic and an untargeted one the entry; and an unequipped
// item contributes nothing. The items are a synthetic fixture shaped as the
// imported rows they name: Chain Shirt, Buckler, a leather-shaped light armor
// with a lower cap, a Quilted-Cloth-shaped light armor with an untargeted
// note, a medium and a heavy armor, a melee weapon and a ranged weapon other
// than a bow or crossbow.
const items = {
  // Chain Shirt: light, +4 armor, max Dex 4, penalty 2, 20%.
  shirt: 'pf1/gearProofShirt',
  // Buckler: `other`, +1 shield, no max Dex, penalty 1, 5%, two local attack
  // penalties and two targeted notes.
  buckler: 'pf1/gearProofBuckler',
  // A leather-shaped light armor: +2 armor, max Dex 3, penalty 1, 10%.
  leather: 'pf1/gearProofLeather',
  // A Quilted-Cloth-shaped light armor with an untargeted note.
  quilted: 'pf1/gearProofQuilted',
  // A medium and a heavy armor (the optional category cases).
  medium: 'pf1/gearProofMedium',
  heavy: 'pf1/gearProofHeavy',
} as const;
const weapons = {
  melee: 'pf1/gearProofSword',
  ranged: 'pf1/gearProofJavelin',
} as const;

const local = {
  melee:
    'while your buckler arm wields a melee weapon (an off-hand weapon, or helping to wield a two-handed weapon)',
  ranged:
    'while your buckler arm wields a ranged weapon other than a bow or crossbow',
};
const bowNote =
  'You can use a bow or crossbow without penalty while carrying it.';
const acNote =
  'In any case, if you use a weapon in your off hand, you lose the buckler’s AC bonus until your next turn. You can cast a spell with somatic components using your shield arm, but you lose the buckler’s AC bonus until your next turn. You can’t make a shield bash with a buckler.';
const quiltedNote =
  'Proof quilted cloth grants DR 3/— against nonlethal damage.';

type Armor = {
  slot: 'armor' | 'shield';
  category: string;
  bonus: number;
  maxDex: number | null;
  armorCheckPenalty: number;
  asf: number;
};
type Modifier = {
  target: string;
  bonusType: string;
  value: number;
  condition: { situation: { local: string } };
};
type Note = { text: string; target?: string };
type Body = {
  externalKey: string;
  name: string;
  pack: string;
  detail: Record<string, unknown>;
  modifiers?: Modifier[];
  situationalNotes?: Note[];
};
const body = ({ externalKey, modifiers = [], ...rest }: Body) => ({
  externalKey,
  upstreamKey: externalKey,
  description: `${rest.name}.`,
  sources: [{ book: 'PZO1110', pages: '150, 151' }],
  modifiers,
  unsupported: [],
  ...rest,
});
const armorBody = (
  externalKey: string,
  name: string,
  {
    armor,
    ...change
  }: { armor: Armor } & Pick<Body, 'modifiers' | 'situationalNotes'>,
) =>
  body({
    externalKey,
    name,
    pack: 'armors-and-shields',
    detail: { kind: 'item', consumable: false, price: 5, weight: 5, armor },
    ...change,
  });
const weapon = (
  externalKey: string,
  name: string,
  profile: Record<string, unknown>,
) =>
  body({
    externalKey,
    name,
    pack: 'weapons-and-ammo',
    detail: {
      kind: 'item',
      consumable: false,
      price: 15,
      weight: 3,
      weapon: {
        threat: 20,
        mult: 2,
        finesse: false,
        monk: false,
        ...profile,
      },
    },
  });

const armors: Record<keyof typeof items, Armor> = {
  shirt: {
    slot: 'armor',
    category: 'lightArmor',
    bonus: 4,
    maxDex: 4,
    armorCheckPenalty: 2,
    asf: 20,
  },
  buckler: {
    slot: 'shield',
    category: 'other',
    bonus: 1,
    maxDex: null,
    armorCheckPenalty: 1,
    asf: 5,
  },
  leather: {
    slot: 'armor',
    category: 'lightArmor',
    bonus: 2,
    maxDex: 3,
    armorCheckPenalty: 1,
    asf: 10,
  },
  quilted: {
    slot: 'armor',
    category: 'lightArmor',
    bonus: 1,
    maxDex: 8,
    armorCheckPenalty: 0,
    asf: 10,
  },
  medium: {
    slot: 'armor',
    category: 'mediumArmor',
    bonus: 5,
    maxDex: 3,
    armorCheckPenalty: 4,
    asf: 25,
  },
  heavy: {
    slot: 'armor',
    category: 'heavyArmor',
    bonus: 7,
    maxDex: 1,
    armorCheckPenalty: 6,
    asf: 35,
  },
};
const bucklerModifiers: Modifier[] = [
  {
    target: 'attack.melee',
    bonusType: 'untyped',
    value: -1,
    condition: { situation: { local: local.melee } },
  },
  {
    target: 'attack.ranged',
    bonusType: 'untyped',
    value: -1,
    condition: { situation: { local: local.ranged } },
  },
];

const bodies = [
  armorBody(items.shirt, 'Proof Chain Shirt', { armor: armors.shirt }),
  armorBody(items.buckler, 'Proof Buckler', {
    armor: armors.buckler,
    modifiers: bucklerModifiers,
    situationalNotes: [
      { target: 'attack', text: bowNote },
      { target: 'ac', text: acNote },
    ],
  }),
  armorBody(items.leather, 'Proof Leather', { armor: armors.leather }),
  armorBody(items.quilted, 'Proof Quilted Cloth', {
    armor: armors.quilted,
    situationalNotes: [{ text: quiltedNote }],
  }),
  armorBody(items.medium, 'Proof Medium Armor', { armor: armors.medium }),
  armorBody(items.heavy, 'Proof Heavy Armor', { armor: armors.heavy }),
  weapon(weapons.melee, 'Proof Sword', {
    baseType: 'Longsword',
    proficiency: 'martial',
    groups: ['bladesHeavy'],
    handedness: 'oneHanded',
    attackType: 'melee',
    dice: '1d8',
    damageTypes: ['slashing'],
    thrown: false,
    strengthDamage: 'melee',
  }),
  weapon(weapons.ranged, 'Proof Javelin', {
    baseType: 'Javelin',
    proficiency: 'simple',
    groups: ['spears', 'thrown'],
    handedness: 'oneHanded',
    attackType: 'ranged',
    dice: '1d6',
    damageTypes: ['piercing'],
    thrown: true,
    rangeIncrement: 30,
    strengthDamage: 'thrown',
  }),
];

/** Inserts the stored identity an item starts from, before the release. */
function insertIdentity(
  ctx: MutationCtx,
  { externalKey, name }: (typeof bodies)[number],
) {
  return ctx.db.insert('catalogEntry', {
    scope: 'global',
    name,
    ruleIdentity: externalKey,
    modifiers: [],
    sources: [],
    stacksWithItself: false,
    detail: { kind: 'item', consumable: false },
  });
}

/**
 * The items through a prepared Catalog Release and the app's candidate
 * conversion, and a Character with Dexterity 20, every other score 10,
 * proficient with simple and martial weapons, light armor and shields, and
 * carrying both weapons.
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
    for (const entry of bodies)
      ids[entry.externalKey] = await insertIdentity(ctx, entry);
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
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 10,
      dexterity: 20,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'scores',
  });
  const proficiency = (
    category: Extract<ManualProficiency, { category: string }>['category'],
    disposition: 'added' | 'removed',
  ) =>
    member.mutation(api.characterSheet.setManualProficiency, {
      ...scope,
      proficiency: { category },
      disposition,
      operationId: `proficiency-${category}-${disposition}`,
    });
  for (const category of ['simple', 'martial', 'light', 'shield'] as const)
    await proficiency(category, 'added');
  const select = (key: string) =>
    member.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: id(key),
      operationId: `select-${key}`,
    });
  const equip = (
    entryId: Id<'characterSheetEntry'>,
    change: { active?: boolean; masterwork?: boolean; enhancement?: number },
    operationId: string,
  ) =>
    member.mutation(api.characterSheet.editEquipment, {
      ...scope,
      entryId,
      ...change,
      operationId,
    });
  const sword = await select(weapons.melee);
  const javelin = await select(weapons.ranged);
  return {
    owner,
    member,
    outsider,
    scope,
    id,
    read,
    select,
    equip,
    proficiency,
    sword,
    javelin,
  };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;
type Sheet = Awaited<ReturnType<Fixture['read']>>;
type Statistic = Pick<ResolvedStatistic, 'total' | 'conditional'>;
type Calculated = ReturnType<typeof calculateCharacterSheet>;

/** The sheet as if these Situations held, from one read's own data. */
function resolved(sheet: Sheet, situations: readonly RequestedSituation[]) {
  return calculateCharacterSheet(
    { ...sheet, characterKind: sheet.character.kind },
    { situations: [...situations] },
  );
}

/** One weapon's first single-attack line. */
function line(calculated: Calculated, weaponEntryId: string) {
  const found = calculated.attackRoutines.find(
    (routine) => routine.weaponEntryId === weaponEntryId,
  )?.single[0];
  if (!found) throw new Error(`Missing a routine for ${weaponEntryId}`);
  return found;
}

/** The defenses, penalties and spell failure the worn items reach. */
function defense(calculated: Calculated) {
  const { breakdowns, derivedStatistics: statistics, equipment } = calculated;
  return {
    armor: breakdowns['ac.armor'].total,
    shield: breakdowns['ac.shield'].total,
    ac: statistics.ac.total,
    touchAc: statistics.touchAc.total,
    flatFootedAc: statistics.flatFootedAc.total,
    climb: breakdowns['skill.clm'].total,
    acrobatics: breakdowns['skill.acr'].total,
    perception: breakdowns['skill.per'].total,
    armorCheckPenalty: equipment.armorCheckPenalty,
    spellFailure: equipment.spellFailure,
    maxDexterityBonus: equipment.maxDexterityBonus,
    nonproficiency: equipment.nonproficiencyAttackPenalty,
  };
}

/** Both weapons' first attack totals. */
function attacks(calculated: Calculated, fixtureLines: Fixture) {
  return {
    sword: line(calculated, fixtureLines.sword).attackBonus.total,
    javelin: line(calculated, fixtureLines.javelin).attackBonus.total,
  };
}

/** A source's conditional contributions to a statistic, with their Situations. */
function conditionalOf(statistic: Statistic, key: string) {
  return statistic.conditional
    .filter((row) => row.source === key)
    .map(({ value, bonusType, condition }) => ({
      value,
      bonusType,
      situation: condition?.situation,
    }));
}

/** The requested Situation a source's local Situation is, on this read. */
function localSituation(
  statistic: Statistic,
  key: string,
  name: string,
): RequestedSituation {
  const row = statistic.conditional.find(
    ({ source, condition }) =>
      source === key &&
      typeof condition?.situation === 'object' &&
      'local' in condition.situation &&
      condition.situation.local === name,
  );
  if (!row) throw new Error(`Missing the local Situation ${name}`);
  return { local: name, sheetEntryId: row.sheetEntryId };
}

/** A source's notes on a statistic. */
function notesOf(
  statistic: { notes?: readonly { source: string; text: string }[] },
  key: string,
) {
  return (statistic.notes ?? [])
    .filter(({ source }) => source === key)
    .map(({ text }) => text);
}

test('the candidate conversion keeps each imported armor block exactly', async () => {
  const { read, id, select } = await fixture();
  // The read lists the Catalog Entries the sheet holds.
  for (const key of Object.values(items)) await select(key);
  const sheet = await read();
  for (const [name, key] of Object.entries(items)) {
    const stored = sheet.catalogEntries.find((row) => row._id === id(key));
    expect(stored?.detail, name).toMatchObject({
      kind: 'item',
      consumable: false,
      armor: armors[name as keyof typeof items],
    });
    expect(
      stored?.detail?.kind === 'item' ? stored.detail.armor : undefined,
      name,
    ).toEqual(armors[name as keyof typeof items]);
  }
});

test('a worn chain shirt and buckler reach AC, cap Dexterity, add their penalties on Strength and Dexterity skills and show their spell failure', async () => {
  const { read, select } = await fixture();
  const unarmored = defense((await read()).calculated);
  expect(unarmored).toMatchObject({
    armor: 0,
    shield: 0,
    ac: 15,
    touchAc: 15,
    flatFootedAc: 10,
    armorCheckPenalty: 0,
    spellFailure: 0,
    maxDexterityBonus: null,
  });
  await select(items.shirt);
  await select(items.buckler);
  expect(defense((await read()).calculated)).toEqual({
    armor: 4,
    shield: 1,
    ac: 19,
    touchAc: 14,
    flatFootedAc: 15,
    climb: unarmored.climb - 3,
    acrobatics: unarmored.acrobatics - 3,
    perception: unarmored.perception,
    armorCheckPenalty: -3,
    spellFailure: 25,
    maxDexterityBonus: 4,
    nonproficiency: 0,
  });
});

test('the imported categories read light and shield proficiency: each removed costs its penalty on every attack line', async () => {
  const fx = await fixture();
  const { read, select, proficiency } = fx;
  await select(items.shirt);
  await select(items.buckler);
  const proficient = attacks((await read()).calculated, fx);
  expect(defense((await read()).calculated).nonproficiency).toBe(0);
  await proficiency('light', 'removed');
  const noLight = await read();
  expect(defense(noLight.calculated).nonproficiency).toBe(-2);
  expect(attacks(noLight.calculated, fx)).toEqual({
    sword: proficient.sword - 2,
    javelin: proficient.javelin - 2,
  });
  await proficiency('shield', 'removed');
  const neither = await read();
  expect(defense(neither.calculated).nonproficiency).toBe(-3);
  expect(attacks(neither.calculated, fx)).toEqual({
    sword: proficient.sword - 3,
    javelin: proficient.javelin - 3,
  });
  await proficiency('light', 'added');
  await proficiency('shield', 'added');
  expect(attacks((await read()).calculated, fx)).toEqual(proficient);
});

test('the medium and heavy armor categories read medium and heavy proficiency', async () => {
  const fx = await fixture();
  const { read, select, equip, proficiency } = fx;
  const base = attacks((await read()).calculated, fx);
  const medium = await select(items.medium);
  expect(defense((await read()).calculated).nonproficiency).toBe(-4);
  expect(attacks((await read()).calculated, fx)).toEqual({
    sword: base.sword - 4,
    javelin: base.javelin - 4,
  });
  await proficiency('medium', 'added');
  expect(attacks((await read()).calculated, fx)).toEqual(base);
  await equip(medium, { active: false }, 'remove-medium');
  await select(items.heavy);
  expect(defense((await read()).calculated).nonproficiency).toBe(-6);
  await proficiency('heavy', 'added');
  expect(defense((await read()).calculated).nonproficiency).toBe(0);
  expect(attacks((await read()).calculated, fx)).toEqual(base);
});

test('enhancement adds on the armor leaf, masterwork lowers the penalty, and a second worn armor competes highest-only while its cap and penalty apply', async () => {
  const { read, select, equip } = await fixture();
  const shirt = await select(items.shirt);
  const buckler = await select(items.buckler);
  await equip(shirt, { enhancement: 1 }, 'enhance-shirt');
  const enhanced = defense((await read()).calculated);
  expect(enhanced).toMatchObject({ armor: 5, shield: 1, ac: 20 });
  await equip(shirt, { enhancement: 0 }, 'plain-shirt');
  await equip(buckler, { masterwork: true }, 'masterwork-buckler');
  expect(defense((await read()).calculated)).toMatchObject({
    armor: 4,
    shield: 1,
    armorCheckPenalty: -2,
  });
  await equip(buckler, { masterwork: false }, 'plain-buckler');
  await select(items.leather);
  const both = (await read()).calculated;
  // The chain shirt's +4 over the leather's +2; the leather's lower cap of
  // +3 and both penalties apply.
  expect(defense(both)).toMatchObject({
    armor: 4,
    shield: 1,
    ac: 18,
    touchAc: 13,
    flatFootedAc: 15,
    armorCheckPenalty: -4,
    spellFailure: 35,
    maxDexterityBonus: 3,
  });
});

test('the buckler’s attack penalties stay out of every total, are listed with their local Situations and apply on their own line only', async () => {
  const fx = await fixture();
  const { read, select } = fx;
  const unarmored = attacks((await read()).calculated, fx);
  await select(items.shirt);
  await select(items.buckler);
  const sheet = await read();
  const { calculated } = sheet;
  expect(attacks(calculated, fx)).toEqual(unarmored);
  const melee = [
    { value: -1, bonusType: 'untyped', situation: { local: local.melee } },
  ];
  const ranged = [
    { value: -1, bonusType: 'untyped', situation: { local: local.ranged } },
  ];
  expect(
    conditionalOf(calculated.breakdowns['attack.melee'], items.buckler),
  ).toEqual(melee);
  expect(
    conditionalOf(calculated.breakdowns['attack.ranged'], items.buckler),
  ).toEqual(ranged);
  expect(
    conditionalOf(line(calculated, fx.sword).attackBonus, items.buckler),
  ).toEqual(melee);
  expect(
    conditionalOf(line(calculated, fx.javelin).attackBonus, items.buckler),
  ).toEqual(ranged);
  const meleeSituation = localSituation(
    calculated.breakdowns['attack.melee'],
    items.buckler,
    local.melee,
  );
  const rangedSituation = localSituation(
    calculated.breakdowns['attack.ranged'],
    items.buckler,
    local.ranged,
  );
  expect(attacks(resolved(sheet, [meleeSituation]), fx)).toEqual({
    ...unarmored,
    sword: unarmored.sword - 1,
  });
  expect(attacks(resolved(sheet, [rangedSituation]), fx)).toEqual({
    ...unarmored,
    javelin: unarmored.javelin - 1,
  });
  expect(
    attacks(resolved(sheet, [meleeSituation, rangedSituation]), fx),
  ).toEqual({ sword: unarmored.sword - 1, javelin: unarmored.javelin - 1 });
  // A local Situation named alike on another entry matches nothing.
  expect(
    attacks(
      resolved(sheet, [{ local: local.melee, sheetEntryId: 'another-entry' }]),
      fx,
    ),
  ).toEqual(unarmored);
  // AC and the other defenses ignore the attack Situations.
  expect(defense(resolved(sheet, [meleeSituation, rangedSituation]))).toEqual(
    defense(calculated),
  );
});

test('targeted notes reach attack and AC and an untargeted one the entry, changing no number', async () => {
  const { read, select } = await fixture();
  await select(items.shirt);
  await select(items.buckler);
  const { calculated } = await read();
  for (const target of ['attack.melee', 'attack.ranged'] as const)
    expect(
      notesOf(calculated.breakdowns[target], items.buckler),
      target,
    ).toEqual([bowNote]);
  expect(notesOf(calculated.breakdowns['ac.other'], items.buckler)).toEqual([
    acNote,
  ]);
  expect(
    calculated.entryNotes.some(({ source }) => source === items.buckler),
  ).toBe(false);
  const before = defense(calculated);
  await select(items.quilted);
  const quilted = (await read()).calculated;
  expect(
    quilted.entryNotes
      .filter(({ source }) => source === items.quilted)
      .map(({ text }) => text),
  ).toEqual([quiltedNote]);
  // Its +1 is below the chain shirt's +4 and its cap above it.
  expect(defense(quilted)).toEqual({ ...before, spellFailure: 35 });
});

test('unequipped items contribute nothing, and re-equipped they return', async () => {
  const fx = await fixture();
  const { read, select, equip } = fx;
  const bare = (await read()).calculated;
  const shirt = await select(items.shirt);
  const buckler = await select(items.buckler);
  const worn = (await read()).calculated;
  await equip(shirt, { active: false }, 'remove-shirt');
  await equip(buckler, { active: false }, 'remove-buckler');
  const removed = (await read()).calculated;
  expect(defense(removed)).toEqual(defense(bare));
  expect(attacks(removed, fx)).toEqual(attacks(bare, fx));
  expect(
    conditionalOf(removed.breakdowns['attack.melee'], items.buckler),
  ).toEqual([]);
  expect(
    conditionalOf(removed.breakdowns['attack.ranged'], items.buckler),
  ).toEqual([]);
  expect(notesOf(removed.breakdowns['attack.melee'], items.buckler)).toEqual(
    [],
  );
  expect(notesOf(removed.breakdowns['ac.other'], items.buckler)).toEqual([]);
  await equip(shirt, { active: true }, 'wear-shirt');
  await equip(buckler, { active: true }, 'wear-buckler');
  const returned = (await read()).calculated;
  expect(defense(returned)).toEqual(defense(worn));
  expect(
    conditionalOf(returned.breakdowns['attack.melee'], items.buckler),
  ).toEqual(conditionalOf(worn.breakdowns['attack.melee'], items.buckler));
  expect(notesOf(returned.breakdowns['ac.other'], items.buckler)).toEqual([
    acNote,
  ]);
});

test('a member’s reads equal the owner’s, and an outsider is refused', async () => {
  const { read, select, member, outsider, scope } = await fixture();
  await select(items.shirt);
  await select(items.buckler);
  const owned = await read();
  const membered = await read(member);
  expect(membered.calculated).toEqual(owned.calculated);
  expect(defense(membered.calculated)).toMatchObject({ armor: 4, shield: 1 });
  await expect(outsider.query(api.characterSheet.read, scope)).rejects.toThrow(
    'You do not have access to this org',
  );
});
