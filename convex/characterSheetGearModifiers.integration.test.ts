// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { releaseFixture } from '../tests/catalog-release-fixture';
import { releaseGearItems } from '../tests/gear-proof-release';
import {
  abilityNotes,
  bodies,
  items,
  local,
  notes,
  outputs,
  towerArmor,
  weapons,
} from '../tests/gear-proof-worn-items';
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

// The gear family's public proof of item Modifiers (gear S2,
// `scripts/catalog/launch-gear.ts`): worn items, as the importer and the
// reviewed curation emit them, reach the saved sheet through a Catalog
// Release, the app's candidate conversion and public reads and writes. A
// worn item's unconditional Modifiers reach their totals: a deflection bonus
// AC, touch AC, flat-footed AC and CMD; an enhancement bonus to natural armor
// AC and flat-footed AC only; an enhancement bonus to each ability score its
// score and every statistic its modifier feeds; a competence bonus its skill;
// an untyped attack penalty every attack line; an insight bonus AC. Bonuses
// of one type from two items don't stack (the higher applies), and a
// zero-valued Modifier changes nothing. A worn item's local Situational
// Modifiers (CMB insight, Craft and Perform circumstance, Stealth competence)
// stay out of every total, are listed in `conditional` and apply on their own
// statistic only in their Situation. A tower shield (`towerShield`) gives its
// shield bonus, caps Dexterity, adds its penalties and spell failure, reads
// tower shield proficiency (shield proficiency is not enough) and takes its
// −2 on every attack line. Notes reach their statistic, or the entry. An
// unequipped item gives nothing; re-equipped it returns. The items are a
// synthetic fixture shaped as the imported rows they name.
//
// Gear S3: the curated stand-ins a reviewed record binds an import issue to.
// A worn cloak's resistance bonus reaches every saving throw, and two don't
// stack; a worn amulet's enhancement bonus reaches attack and damage with an
// unarmed strike and a natural weapon, and no other attack line. The raw
// change each stands in for, carried as the imported row carries it, adds
// nothing.
/**
 * The items through a prepared Catalog Release and the app's candidate
 * conversion, and a Character with Dexterity 16, every other score 10,
 * proficient with simple and martial weapons, shields and tower shields, and
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
      dexterity: 16,
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
  for (const category of [
    'simple',
    'martial',
    'shield',
    'towerShield',
  ] as const)
    await proficiency(category, 'added');
  const select = (key: string) =>
    member.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: id(key),
      operationId: `select-${key}`,
    });
  const equip = (
    entryId: Id<'characterSheetEntry'>,
    active: boolean,
    operationId: string,
  ) =>
    member.mutation(api.characterSheet.editSheetEntry, {
      ...scope,
      entryId,
      active,
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

/** The statistics the worn items reach. */
function totals(calculated: Calculated, fx: Fixture) {
  const { abilities, breakdowns, derivedStatistics: statistics } = calculated;
  return {
    str: abilities.strength.score,
    dex: abilities.dexterity.score,
    con: abilities.constitution.score,
    int: abilities.intelligence.score,
    wis: abilities.wisdom.score,
    cha: abilities.charisma.score,
    natural: breakdowns['ac.natural'].total,
    shield: breakdowns['ac.shield'].total,
    ac: statistics.ac.total,
    touchAc: statistics.touchAc.total,
    flatFootedAc: statistics.flatFootedAc.total,
    cmb: statistics.cmb.total,
    cmd: statistics.cmd.total,
    fortitude: statistics.fortitude.total,
    reflex: statistics.reflex.total,
    will: statistics.will.total,
    initiative: statistics.initiative.total,
    climb: breakdowns['skill.clm'].total,
    acrobatics: breakdowns['skill.acr'].total,
    perception: breakdowns['skill.per'].total,
    diplomacy: breakdowns['skill.dip'].total,
    spellcraft: breakdowns['skill.spl'].total,
    craft: breakdowns['skill.crf'].total,
    perform: breakdowns['skill.prf'].total,
    stealth: breakdowns['skill.ste'].total,
    sword: line(calculated, fx.sword).attackBonus.total,
    swordDamage: line(calculated, fx.sword).damageBonus.total,
    javelin: line(calculated, fx.javelin).attackBonus.total,
    spellFailure: calculated.equipment.spellFailure,
    maxDexterityBonus: calculated.equipment.maxDexterityBonus,
    nonproficiency: calculated.equipment.nonproficiencyAttackPenalty,
  };
}
type Totals = ReturnType<typeof totals>;
/** The totals with these changes from a baseline. */
function plus(
  base: Totals,
  change: Partial<Record<keyof Totals, number>>,
): Totals {
  const sum = { ...base };
  for (const key of Object.keys(change) as (keyof Totals)[]) {
    const current = sum[key];
    if (typeof current === 'number') sum[key] = current + (change[key] ?? 0);
  }
  return sum;
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
/** A source's untargeted notes on the entry. */
const entryNotesOf = (calculated: Calculated, key: string) =>
  calculated.entryNotes
    .filter(({ source }) => source === key)
    .map(({ text }) => text);

test('the candidate conversion keeps each imported item’s Modifiers and detail exactly', async () => {
  const { read, id, select } = await fixture();
  for (const key of Object.values(items)) await select(key);
  const sheet = await read();
  for (const [name, key] of Object.entries(items)) {
    const stored = sheet.catalogEntries.find((row) => row._id === id(key));
    const expected = outputs[name as keyof typeof items];
    expect(stored?.modifiers, name).toEqual(expected.modifiers);
    expect(stored?.detail, name).toMatchObject({
      kind: 'item',
      consumable: false,
    });
    expect(
      stored?.detail?.kind === 'item' ? stored.detail.armor : undefined,
      name,
    ).toEqual(name === 'tower' ? towerArmor : undefined);
  }
});

test('a worn ring’s deflection bonus reaches AC, touch AC, flat-footed AC and CMD, and two rings don’t stack', async () => {
  const fx = await fixture();
  const { read, select, equip } = fx;
  const bare = totals((await read()).calculated, fx);
  const ring = await select(items.ring);
  const deflected = plus(bare, { ac: 2, touchAc: 2, flatFootedAc: 2, cmd: 2 });
  expect(totals((await read()).calculated, fx)).toEqual(deflected);
  const lesser = await select(items.lesserRing);
  expect(totals((await read()).calculated, fx)).toEqual(deflected);
  await equip(ring, false, 'remove-ring');
  expect(totals((await read()).calculated, fx)).toEqual(
    plus(bare, { ac: 1, touchAc: 1, flatFootedAc: 1, cmd: 1 }),
  );
  await equip(lesser, false, 'remove-lesser-ring');
  expect(totals((await read()).calculated, fx)).toEqual(bare);
});

test('a worn amulet’s enhancement to natural armor reaches AC and flat-footed AC only, and two amulets don’t stack', async () => {
  const fx = await fixture();
  const { read, select, equip } = fx;
  const bare = totals((await read()).calculated, fx);
  const amulet = await select(items.amulet);
  const natural = plus(bare, { natural: 2, ac: 2, flatFootedAc: 2 });
  expect(totals((await read()).calculated, fx)).toEqual(natural);
  await select(items.lesserAmulet);
  expect(totals((await read()).calculated, fx)).toEqual(natural);
  await equip(amulet, false, 'remove-amulet');
  expect(totals((await read()).calculated, fx)).toEqual(
    plus(bare, { natural: 1, ac: 1, flatFootedAc: 1 }),
  );
});

test('a worn belt’s and headband’s ability enhancements raise each score and every statistic its modifier feeds, and two don’t stack', async () => {
  const fx = await fixture();
  const { read, select, equip } = fx;
  const bare = totals((await read()).calculated, fx);
  const belt = await select(items.belt);
  await select(items.headband);
  // Each score +4, so each modifier +2.
  const enhanced = plus(bare, {
    str: 4,
    dex: 4,
    con: 4,
    int: 4,
    wis: 4,
    cha: 4,
    // Strength: melee attack and damage, CMB, CMD and Climb.
    sword: 2,
    swordDamage: 2,
    cmb: 2,
    // Dexterity: AC, touch AC, CMD, Reflex, initiative, Acrobatics and the
    // ranged line (flat-footed AC loses Dexterity).
    ac: 2,
    touchAc: 2,
    cmd: 4,
    reflex: 2,
    initiative: 2,
    acrobatics: 2,
    javelin: 2,
    climb: 2,
    stealth: 2,
    // Constitution: Fortitude. Intelligence: Spellcraft and Craft. Wisdom:
    // Will and Perception. Charisma: Diplomacy and Perform.
    fortitude: 2,
    spellcraft: 2,
    craft: 2,
    will: 2,
    perception: 2,
    diplomacy: 2,
    perform: 2,
  });
  const enhancedSheet = (await read()).calculated;
  expect(totals(enhancedSheet, fx)).toEqual(enhanced);
  // Each targeted note reaches its ability score only, the untargeted one the
  // entry.
  const sourceOf = (target: string) =>
    target === 'ability.dex' || target === 'ability.con'
      ? items.belt
      : items.headband;
  for (const [target, text] of Object.entries(abilityNotes))
    for (const ability of Object.keys(abilityNotes))
      expect(
        notesOf(
          enhancedSheet.breakdowns[ability as keyof typeof abilityNotes],
          sourceOf(target),
        ).includes(text),
        `${target} on ${ability}`,
      ).toBe(ability === target);
  expect(entryNotesOf(enhancedSheet, items.belt)).toEqual([notes.belt]);
  expect(entryNotesOf(enhancedSheet, items.headband)).toEqual([]);
  // A second enhancement bonus to Strength, lower, adds nothing.
  const lesserBelt = await select(items.lesserBelt);
  expect(totals((await read()).calculated, fx)).toEqual(enhanced);
  // Without the belt the lesser belt's +2 Strength applies alone.
  await equip(belt, false, 'remove-belt');
  const { calculated } = await read();
  expect(totals(calculated, fx)).toMatchObject({
    str: bare.str + 2,
    dex: bare.dex,
    con: bare.con,
    sword: bare.sword + 1,
    int: bare.int + 4,
  });
  expect(
    notesOf(calculated.breakdowns['ability.str'], items.lesserBelt),
  ).toEqual([notes.lesserBelt]);
  await equip(lesserBelt, false, 'remove-lesser-belt');
  await equip(belt, true, 'wear-belt');
  const worn = (await read()).calculated;
  expect(entryNotesOf(worn, items.belt)).toEqual([notes.belt]);
  expect(notesOf(worn.breakdowns['ability.str'], items.lesserBelt)).toEqual([]);
});

test('a worn competence bonus reaches its skill only, and two don’t stack', async () => {
  const fx = await fixture();
  const { read, select, equip } = fx;
  const bare = totals((await read()).calculated, fx);
  const ring = await select(items.climbing);
  expect(totals((await read()).calculated, fx)).toEqual(
    plus(bare, { climb: 5 }),
  );
  await select(items.lesserClimbing);
  expect(totals((await read()).calculated, fx)).toEqual(
    plus(bare, { climb: 5 }),
  );
  await equip(ring, false, 'remove-climbing');
  expect(totals((await read()).calculated, fx)).toEqual(
    plus(bare, { climb: 2 }),
  );
});

test('a worn cloak’s resistance bonus reaches every saving throw once, two don’t stack, and unequipped it gives nothing', async () => {
  const fx = await fixture();
  const { read, id, select, equip } = fx;
  const bare = totals((await read()).calculated, fx);
  const cloak = await select(items.resistance);
  const sheet = await read();
  // The raw change it stands in for is carried as text only: the stand-in
  // applies once.
  expect(
    sheet.catalogEntries.find((row) => row._id === id(items.resistance))
      ?.modifiers,
  ).toEqual(outputs.resistance.modifiers);
  const resisted = plus(bare, { fortitude: 3, reflex: 3, will: 3 });
  expect(totals(sheet.calculated, fx)).toEqual(resisted);
  const lesser = await select(items.lesserResistance);
  expect(totals((await read()).calculated, fx)).toEqual(resisted);
  await equip(cloak, false, 'remove-cloak');
  expect(totals((await read()).calculated, fx)).toEqual(
    plus(bare, { fortitude: 1, reflex: 1, will: 1 }),
  );
  await equip(lesser, false, 'remove-lesser-cloak');
  expect(totals((await read()).calculated, fx)).toEqual(bare);
  await equip(cloak, true, 'wear-cloak');
  expect(totals((await read()).calculated, fx)).toEqual(resisted);
});

test('a worn amulet’s enhancement bonus reaches attack and damage with an unarmed strike and a natural weapon only, and unequipped it gives nothing', async () => {
  const fx = await fixture();
  const { member, scope, read, select, equip } = fx;
  const bite = await member.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Bite',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      weapon: {
        baseType: 'bite',
        proficiency: 'always',
        naturalAttack: { type: 'bite' },
      },
    },
    operationId: 'record-bite',
  });
  for (const weaponEntryId of ['unarmed', bite] as const)
    await member.mutation(api.characterSheet.createAttackRoutine, {
      ...scope,
      weaponEntryId,
      operationId: `routine-${weaponEntryId}`,
    });
  const routines = {
    unarmed: 'unarmed',
    bite,
    sword: fx.sword,
    javelin: fx.javelin,
  };
  /** Each routine's attack and damage bonus. */
  const lines = (calculated: Calculated) =>
    Object.fromEntries(
      Object.entries(routines).map(([label, weaponEntryId]) => {
        const found = line(calculated, weaponEntryId);
        return [label, [found.attackBonus.total, found.damageBonus.total]];
      }),
    );
  const bare = (await read()).calculated;
  const fists = await select(items.fists);
  const worn = (await read()).calculated;
  const before = lines(bare);
  const shift = (label: string) => {
    const [attack = 0, damage = 0] = before[label] ?? [];
    return [attack + 2, damage + 2];
  };
  expect(lines(worn)).toEqual({
    ...before,
    unarmed: shift('unarmed'),
    bite: shift('bite'),
  });
  // Nothing else on the sheet moves.
  expect(totals(worn, fx)).toEqual(totals(bare, fx));
  await equip(fists, false, 'remove-fists');
  expect(lines((await read()).calculated)).toEqual(before);
  await equip(fists, true, 'wear-fists');
  expect(lines((await read()).calculated)).toEqual(lines(worn));
});

test('a worn ioun stone’s insight bonus reaches AC, and its CMB bonus applies only in its local Situation', async () => {
  const fx = await fixture();
  const { read, select } = fx;
  const bare = totals((await read()).calculated, fx);
  await select(items.ioun);
  const sheet = await read();
  const { calculated } = sheet;
  const worn = plus(bare, { ac: 1, touchAc: 1, flatFootedAc: 1, cmd: 1 });
  expect(totals(calculated, fx)).toEqual(worn);
  expect(conditionalOf(calculated.derivedStatistics.cmb, items.ioun)).toEqual([
    { value: 1, bonusType: 'insight', situation: { local: local.ioun } },
  ]);
  const resonance = localSituation(
    calculated.derivedStatistics.cmb,
    items.ioun,
    local.ioun,
  );
  expect(totals(resolved(sheet, [resonance]), fx)).toEqual(
    plus(worn, { cmb: 1 }),
  );
  // A local Situation named alike on another entry matches nothing.
  expect(
    totals(
      resolved(sheet, [{ local: local.ioun, sheetEntryId: 'another-entry' }]),
      fx,
    ),
  ).toEqual(worn);
});

test('a worn tool’s, instrument’s and cloak’s zero Modifiers change nothing, and each bonus applies on its own skill only in its local Situation', async () => {
  const fx = await fixture();
  const { read, select } = fx;
  const bare = totals((await read()).calculated, fx);
  await select(items.tools);
  await select(items.instrument);
  await select(items.cloak);
  const sheet = await read();
  const { calculated } = sheet;
  expect(totals(calculated, fx)).toEqual(bare);
  const cases = [
    ['skill.crf', items.tools, local.tools, 'circumstance', 2, 'craft'],
    [
      'skill.prf',
      items.instrument,
      local.instrument,
      'circumstance',
      2,
      'perform',
    ],
    ['skill.ste', items.cloak, local.cloak, 'competence', 5, 'stealth'],
  ] as const;
  const situations = cases.map(
    ([target, key, situation, bonusType, value, total]) => {
      const statistic = calculated.breakdowns[target];
      expect(conditionalOf(statistic, key), key).toEqual([
        { value, bonusType, situation: { local: situation } },
      ]);
      const requested = localSituation(statistic, key, situation);
      expect(totals(resolved(sheet, [requested]), fx), key).toEqual(
        plus(bare, { [total]: value }),
      );
      return requested;
    },
  );
  expect(totals(resolved(sheet, situations), fx)).toEqual(
    plus(bare, { craft: 2, perform: 2, stealth: 5 }),
  );
  expect(notesOf(calculated.breakdowns['skill.prf'], items.instrument)).toEqual(
    [notes.instrument],
  );
});

test('a worn tower shield gives its shield bonus, caps Dexterity, adds its penalties and spell failure and takes −2 on every attack line', async () => {
  const fx = await fixture();
  const { read, select } = fx;
  const bare = totals((await read()).calculated, fx);
  await select(items.tower);
  const { calculated } = await read();
  // +4 shield; Dexterity +3 capped at +2 on AC (the cap is on AC, not on
  // CMD).
  expect(totals(calculated, fx)).toEqual({
    ...plus(bare, {
      shield: 4,
      ac: 3,
      touchAc: -1,
      flatFootedAc: 4,
      climb: -10,
      acrobatics: -10,
      stealth: -10,
      sword: -2,
      javelin: -2,
    }),
    spellFailure: 50,
    maxDexterityBonus: 2,
    nonproficiency: 0,
  });
  expect(notesOf(calculated.breakdowns['ac.other'], items.tower)).toEqual([
    notes.tower,
  ]);
});

test('the tower shield category reads tower shield proficiency: shield proficiency is not enough', async () => {
  const fx = await fixture();
  const { read, select, proficiency } = fx;
  await select(items.tower);
  const proficient = totals((await read()).calculated, fx);
  await proficiency('towerShield', 'removed');
  const without = (await read()).calculated;
  // The penalty of 10 on every attack line is the shield's own contribution,
  // so its −2 doesn't stack with it: within one entry, two Modifiers of one
  // type and target don't stack (docs/character-sheet/stacking.md).
  expect(totals(without, fx)).toEqual({
    ...plus(proficient, { sword: -8, javelin: -8 }),
    nonproficiency: -10,
  });
  await proficiency('towerShield', 'added');
  await proficiency('shield', 'removed');
  expect(totals((await read()).calculated, fx)).toEqual(proficient);
});

test('unequipped items contribute nothing, and re-equipped they return', async () => {
  const fx = await fixture();
  const { read, select, equip } = fx;
  const bare = (await read()).calculated;
  const keys = [
    items.ring,
    items.amulet,
    items.belt,
    items.headband,
    items.climbing,
    items.ioun,
    items.tools,
    items.instrument,
    items.cloak,
    items.tower,
  ];
  const entries = [];
  for (const key of keys) entries.push(await select(key));
  const worn = (await read()).calculated;
  for (const [index, entry] of entries.entries())
    await equip(entry, false, `remove-${index}`);
  const removed = (await read()).calculated;
  expect(totals(removed, fx)).toEqual(totals(bare, fx));
  for (const key of keys) {
    expect(conditionalOf(removed.derivedStatistics.cmb, key), key).toEqual([]);
    for (const target of ['skill.crf', 'skill.prf', 'skill.ste'] as const)
      expect(conditionalOf(removed.breakdowns[target], key), key).toEqual([]);
    expect(entryNotesOf(removed, key), key).toEqual([]);
    expect(notesOf(removed.breakdowns['skill.prf'], key), key).toEqual([]);
    expect(notesOf(removed.breakdowns['ac.other'], key), key).toEqual([]);
    for (const ability of Object.keys(abilityNotes))
      expect(
        notesOf(removed.breakdowns[ability as keyof typeof abilityNotes], key),
        key,
      ).toEqual([]);
  }
  for (const [index, entry] of entries.entries())
    await equip(entry, true, `wear-${index}`);
  const returned = (await read()).calculated;
  expect(totals(returned, fx)).toEqual(totals(worn, fx));
  expect(conditionalOf(returned.derivedStatistics.cmb, items.ioun)).toEqual(
    conditionalOf(worn.derivedStatistics.cmb, items.ioun),
  );
  expect(entryNotesOf(returned, items.belt)).toEqual([notes.belt]);
  expect(notesOf(returned.breakdowns['ac.other'], items.tower)).toEqual([
    notes.tower,
  ]);
});

test('a member’s reads equal the owner’s, and an outsider is refused', async () => {
  const fx = await fixture();
  const { read, select, member, outsider, scope } = fx;
  await select(items.ring);
  await select(items.belt);
  await select(items.tower);
  const owned = await read();
  const membered = await read(member);
  expect(membered.calculated).toEqual(owned.calculated);
  await expect(outsider.query(api.characterSheet.read, scope)).rejects.toThrow(
    'You do not have access to this org',
  );
});
