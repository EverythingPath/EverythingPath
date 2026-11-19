// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { releaseFixture } from '../tests/catalog-release-fixture';
import { releaseGearItems } from '../tests/gear-proof-release';
import {
  acNote,
  armors,
  bodies,
  bowNote,
  items,
  local,
  quiltedNote,
  weapons,
} from '../tests/gear-proof-armor';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  calculateCharacterSheet,
  type ResolvedStatistic,
} from '../src/lib/character-sheet';
import type { RequestedSituation } from '../src/lib/character-sheet-situations';
import type { ManualProficiency } from '../src/lib/character-sheet-proficiency-schema';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';

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
  const ids = await releaseGearItems(t, bodies);
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
