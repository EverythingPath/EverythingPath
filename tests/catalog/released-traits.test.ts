// @vitest-environment node
// pbl-released-traits (PRD #251): the trait batch units' resolver blocks
// (traits-367 to traits-386), on entries imported from the pinned store. One
// import holds every key of the twenty batch key lists
// (released-trait-keys.ts); each describe looks its traits up by name within
// its batch's list, and a check of "every entry" checks that list's keys, as
// the batch units did over their preview. Each case asserts only what the
// resolver or the sheet computes from the imported entries; the batch
// reviews' records are not read.
import { describe, expect, it } from 'vitest';
import {
  abilityTargets,
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  resolveSheet,
  type CharacterSheetInput,
} from '../../src/lib/character-sheet';
import { importReleasedEntries } from './released-entries';
import { traitBatches } from './released-trait-keys';
import { traitBatch } from './released-trait-sheet';

const { entries } = await importReleasedEntries(
  Object.values(traitBatches).flat(),
);

describe('the traits-367 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    traitSheet,
    total,
  } = traitBatch(entries, 'traits-367');
  it("resolves the named traits' curated Modifiers, and two traits' trait bonuses on one statistic do not stack", () => {
    // Goblin Watcher: +1 trait on Perception and Appraise, +5 trait on Appraise
    // in the treasure-hoard Situation, which replaces the +1 rather than adding.
    const watcher = 'Goblin Watcher (Rise of the Runelords)';
    const hoard = indexOf(watcher, 'skill.apr', 'treasure hoard');
    const plain = resolveSheet(modifiers(watcher));
    expect([plain['skill.per'].total, plain['skill.apr'].total]).toEqual([
      1, 1,
    ]);
    expect(
      resolveSheet(modifiers(watcher), {
        situations: [situation(watcher, hoard)],
      })['skill.apr'].total,
    ).toBe(5);
    // Highlander: +1 Stealth, +2 in hilly or rocky areas (not +3). Foundry
    // files that note under Spellcraft; the reviewed Modifier is on Stealth.
    const highlander = 'Highlander (Hills or Mountains)';
    const hills = indexOf(highlander, 'skill.ste', 'hilly or rocky');
    expect(resolveSheet(modifiers(highlander))['skill.ste'].total).toBe(1);
    const inHills = resolveSheet(modifiers(highlander), {
      situations: [situation(highlander, hills)],
    });
    expect([inHills['skill.ste'].total, inHills['skill.spl'].total]).toEqual([
      2, 0,
    ]);
    // Two different traits' +1 trait bonuses on Sense Motive don't stack.
    for (const name of ['Honor-Driven (Human; Ulfen)', 'Bastard'] as const)
      expect(total(traitSheet(name), 'skill.sen'), name).toBe(1);
    expect(
      total(traitSheet('Honor-Driven (Human; Ulfen)', 'Bastard'), 'skill.sen'),
    ).toBe(1);
    // Honor-Driven's raw change has no target; its +1 is the reviewed Modifier.
    expect(entry('Honor-Driven (Human; Ulfen)').unsupported).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
    );
    // A drawback's untyped penalties apply unconditionally.
    const scarred = traitSheet('Scarred');
    expect([total(scarred, 'skill.dis'), total(scarred, 'skill.blf')]).toEqual([
      -5, -2,
    ]);
    // Secret Shame's fear penalty exempts a character normally immune to fear,
    // so it is a local Situation carrying that exception, not the shared fear.
    const shame = modifiers('Secret Shame');
    expect(shame.map((row) => [row.target, row.value])).toEqual([
      ['saves', -1],
    ]);
    expect(shame[0]?.condition?.situation).toEqual({
      local:
        'against fear effects, unless you would normally be immune to fear',
    });
    expect(
      resolveSheet(shame, { situations: ['fear'] })['save.will'].total,
    ).toBe(0);
    expect(
      resolveSheet(shame, { situations: [situation('Secret Shame', 0)] })[
        'save.will'
      ].total,
    ).toBe(-1);
    // Vexed: the curse and shared fear Situations never count twice.
    const vexed = 'Vexed (Kobold)';
    expect(modifiers(vexed).map((row) => row.condition?.situation)).toEqual([
      { local: 'against curses' },
      'fear',
    ]);
    expect(resolveSheet(modifiers(vexed))['save.will'].total).toBe(0);
    expect(
      resolveSheet(modifiers(vexed), { situations: ['fear'] })['save.will']
        .total,
    ).toBe(1);
    expect(
      resolveSheet(modifiers(vexed), {
        situations: [situation(vexed, 0), situation(vexed, 1)],
      })['save.will'].total,
    ).toBe(1);
    // Boarded in the Shackles: one chosen save, a manual Situation per option.
    const shackles = "Boarded in the Shackles (Serpent's Skull)";
    const will = resolveSheet(modifiers(shackles), {
      situations: [situation(shackles, indexOf(shackles, 'save.will', 'Will'))],
    });
    expect([
      will['save.fort'].total,
      will['save.ref'].total,
      will['save.will'].total,
    ]).toEqual([0, 0, 1]);
    // Aldori Caution's additional dodge bonus stacks with another dodge bonus.
    const aldori = modifiers('Aldori Caution');
    expect(aldori.map((row) => [row.target, row.bonusType, row.value])).toEqual(
      [['ac', 'dodge', 1]],
    );
    expect(
      resolveSheet(
        [
          ...aldori,
          {
            ...aldori[0]!,
            sheetEntryId: 'other',
            catalogEntryId: 'other',
            source: 'other',
            entryName: 'other',
            condition: undefined,
          },
        ],
        { situations: [situation('Aldori Caution', 0)] },
      )['ac.other'].total,
    ).toBe(2);
    // Disgraced Noble's morale bonus rises at 10th character level.
    expect(
      modifiers('Disgraced Noble (War for the Crown)')
        .filter((row) => row.bonusType === 'morale')
        .map((row) => [row.target, row.value]),
    ).toEqual([
      ['attack', { formula: '1 + min(1, floor(@level / 10))' }],
      ['damage', { formula: '1 + min(1, floor(@level / 10))' }],
    ]);
    // No reviewed armor, shield or natural armor bonus lands on ac.other (#734).
    for (const row of batchEntries)
      for (const modifier of row.modifiers)
        if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
          expect(modifier.target, row.name).not.toBe('ac.other');
  });
});

describe('the traits-368 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    traitSheet,
    total,
  } = traitBatch(entries, 'traits-368');
  it("resolves the named traits' curated Modifiers, and two traits' trait bonuses on one statistic do not stack", () => {
    // Excitable and Wary of Danger: two traits' +2 trait bonuses on initiative.
    for (const name of [
      'Excitable (Gnome)',
      'Wary of Danger (Human; Kellid)',
    ] as const)
      expect(total(traitSheet(name), 'init'), name).toBe(2);
    expect(
      total(
        traitSheet('Excitable (Gnome)', 'Wary of Danger (Human; Kellid)'),
        'init',
      ),
    ).toBe(2);
    // Arcane Temper: the raw concentration change maps nothing, so the
    // reviewed Modifier supplies +1 trait on concentration beside the imported
    // +1 on initiative.
    const temper = resolveSheet(modifiers('Arcane Temper'));
    expect([temper.init.total, temper.concentration.total]).toEqual([1, 1]);
    expect(entry('Arcane Temper').unsupported).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
    );
    // Varki Landspeaker: +1 in cold terrain and +5 on the spirit query; the +5
    // replaces the +1 rather than adding to it.
    const varki = 'Varki Landspeaker (Human; Varki)';
    const cold = indexOf(varki, 'skill.sur', 'arctic or cold terrain');
    const spirits = indexOf(varki, 'skill.sur', 'find shelter');
    expect(resolveSheet(modifiers(varki))['skill.sur'].total).toBe(0);
    expect(
      resolveSheet(modifiers(varki), { situations: [situation(varki, cold)] })[
        'skill.sur'
      ].total,
    ).toBe(1);
    expect(
      resolveSheet(modifiers(varki), {
        situations: [situation(varki, cold), situation(varki, spirits)],
      })['skill.sur'].total,
    ).toBe(5);
    // Hardly a Fool's illusion save bonus uses the shared illusions Situation.
    const fool = resolveSheet(modifiers('Hardly a Fool'), {
      situations: ['illusions'],
    });
    expect([fool['skill.sen'].total, fool['save.will'].total]).toEqual([1, 1]);
    // Draconic Lineage takes the shared fear Situation; Buried Anxiety's fear
    // bonus carries an exception, so the shared fear Situation leaves it out.
    expect(
      resolveSheet(modifiers('Draconic Lineage'), { situations: ['fear'] })[
        'save.will'
      ].total,
    ).toBe(1);
    const anxiety = 'Buried Anxiety (Tiefling; Spitespawn)';
    expect(modifiers(anxiety)[0]?.condition?.situation).toEqual({
      local:
        'against fear effects, except when you can see, hear, smell, or taste the chosen phenomenon that unnerves you',
    });
    expect(
      resolveSheet(modifiers(anxiety), { situations: ['fear'] })['save.will']
        .total,
    ).toBe(0);
    expect(
      resolveSheet(modifiers(anxiety), { situations: [situation(anxiety, 0)] })[
        'save.will'
      ].total,
    ).toBe(2);
    // Two shared-poison trait bonuses on Fortitude do not stack.
    expect(
      resolveSheet(
        [
          ...modifiers('Poisonous Upbringing (Drow)'),
          ...modifiers('Venom Resistance'),
        ],
        { situations: ['poison'] },
      )['save.fort'].total,
    ).toBe(2);
    // Flotsam: the published untyped +2 is on Reflex only.
    const flotsam = resolveSheet(modifiers('Flotsam (The Shackles)'), {
      situations: [situation('Flotsam (The Shackles)', 0)],
    });
    expect([
      flotsam['save.ref'].total,
      flotsam['save.fort'].total,
      flotsam['save.will'].total,
    ]).toEqual([2, 0, 0]);
    // Whip Specialist and Scion of Goblinblood: Foundry files the notes on
    // attack; the reviewed bonuses are on damage.
    for (const name of [
      'Whip Specialist (Okeno)',
      'Scion of Goblinblood (Goblin; Isger)',
      'Clockwork Engineer',
    ])
      expect(
        modifiers(name).map((row) => row.target),
        name,
      ).toEqual(['damage']);
    // Student of Philosophy adds the Intelligence modifier's excess over
    // Charisma on persuasion and lies, and never lowers the check.
    const student = (int: number, cha: number) => {
      const sheet = traitSheet('Student of Philosophy');
      const base = sheet.catalogEntries[0]!;
      base.modifiers = (base.modifiers ?? []).map((row) =>
        row.target === abilityTargets.intelligence
          ? { ...row, value: int }
          : row.target === abilityTargets.charisma
            ? { ...row, value: cha }
            : row,
      );
      const selected = modifiers('Student of Philosophy', 'trait-row-0');
      return calculateCharacterSheetProjections(sheet, {
        situations: selected.map((row) => ({
          ...(row.condition?.situation as { local: string }),
          sheetEntryId: 'trait-row-0',
        })),
      }).current.breakdowns;
    };
    // Intelligence 16 and Charisma 10: Charisma +0 and the excess +3.
    const clever = student(16, 10);
    expect([clever['skill.dip'].total, clever['skill.blf'].total]).toEqual([
      3, 3,
    ]);
    // Intelligence 8 and Charisma 14: Charisma +2 and no substitution.
    const charming = student(8, 14);
    expect([charming['skill.dip'].total, charming['skill.blf'].total]).toEqual([
      2, 2,
    ]);
    // Impatient: one local Situation carries the -1 penalties on attacks,
    // saves and skills.
    const impatient = modifiers('Impatient');
    expect(
      new Set(impatient.map((row) => JSON.stringify(row.condition?.situation)))
        .size,
    ).toBe(1);
    const last = resolveSheet(impatient, {
      situations: [situation('Impatient', 0)],
    });
    expect([
      last['attack.melee'].total,
      last['save.ref'].total,
      last['skill.per'].total,
    ]).toEqual([-1, -1, -1]);
    expect(resolveSheet(impatient)['attack.melee'].total).toBe(0);
    // No reviewed armor, shield or natural armor bonus lands on ac.other (#734).
    for (const row of batchEntries)
      for (const modifier of row.modifiers)
        if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
          expect(modifier.target, row.name).not.toBe('ac.other');
  });
});

describe('the traits-369 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    traitSheet,
    total,
  } = traitBatch(entries, 'traits-369');
  it("resolves the named traits' curated Modifiers, and two traits' trait bonuses on one statistic do not stack", () => {
    // Silvertongued Eunuch and Shadow Diplomat: two traits' +1 trait bonuses on
    // Diplomacy don't stack.
    for (const name of [
      'Silvertongued Eunuch (Quain)',
      'Shadow Diplomat (Shadow Lodge)',
    ] as const)
      expect(total(traitSheet(name), 'skill.dip'), name).toBe(1);
    expect(
      total(
        traitSheet(
          'Silvertongued Eunuch (Quain)',
          'Shadow Diplomat (Shadow Lodge)',
        ),
        'skill.dip',
      ),
    ).toBe(1);
    // Betrayal of Trust: +2 on Bluff, and +4 to conceal or deny your infidelity;
    // the +4 replaces the +2 rather than adding to it.
    const betrayal = 'Betrayal of Trust';
    expect(resolveSheet(modifiers(betrayal))['skill.blf'].total).toBe(2);
    expect(
      resolveSheet(modifiers(betrayal), {
        situations: [
          situation(betrayal, indexOf(betrayal, 'skill.blf', 'infidelity')),
        ],
      })['skill.blf'].total,
    ).toBe(4);
    // Caretaker's +1 and Mwangi Herbal Tradition's long-term care +4 on Heal:
    // the trait bonuses don't stack, so the Situation gives +4, not +5.
    const herbal = 'Mwangi Herbal Tradition (Mwangi Expanse)';
    expect(
      resolveSheet([...modifiers('Caretaker'), ...modifiers(herbal)], {
        situations: [situation(herbal, 0)],
      })['skill.hea'].total,
    ).toBe(4);
    // Tight Bonds: +1 on Will with a partner near, +3 against a command to harm
    // the relationship; the +3 is the new total.
    const bonds = 'Tight Bonds';
    expect(
      resolveSheet(modifiers(bonds), {
        situations: [situation(bonds, 0), situation(bonds, 1)],
      })['save.will'].total,
    ).toBe(3);
    // Misbegotten: the raw dexSkills change maps nothing, so the reviewed
    // record supplies -2 on each Dexterity-based skill and nothing else.
    const misbegotten = resolveSheet(modifiers('Misbegotten'));
    expect(
      [
        'skill.acr',
        'skill.dev',
        'skill.esc',
        'skill.fly',
        'skill.rid',
        'skill.slt',
        'skill.ste',
      ].map((target) => misbegotten[target as 'skill.acr'].total),
    ).toEqual([-2, -2, -2, -2, -2, -2, -2]);
    expect([
      misbegotten['skill.blf'].total,
      misbegotten['skill.swm'].total,
    ]).toEqual([0, 0]);
    expect(entry('Misbegotten').unsupported).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'changes',
          value: expect.objectContaining({ target: 'dexSkills' }),
        }),
      ]),
    );
    // Magic Survivor: choosing Fortitude and Reflex gives +1 on each against
    // spells and -1 on every Will save.
    const survivor = 'Magic Survivor (Trox)';
    const chosen = resolveSheet(modifiers(survivor), {
      situations: [
        situation(survivor, indexOf(survivor, 'save.fort', 'chose Fortitude')),
        situation(survivor, indexOf(survivor, 'save.ref', 'chose Reflex')),
        situation(survivor, indexOf(survivor, 'save.will', 'Will is the save')),
      ],
    });
    expect([
      chosen['save.fort'].total,
      chosen['save.ref'].total,
      chosen['save.will'].total,
    ]).toEqual([1, 1, -1]);
    expect(resolveSheet(modifiers(survivor))['save.will'].total).toBe(0);
    // Shared Situations only where the body's condition matches exactly:
    // Indomitable's enchantment save bonus and Prankster's dirty trick bonus.
    expect(
      resolveSheet(modifiers("Indomitable (Liberty's Edge)"), {
        situations: ['enchantment'],
      })['save.will'].total,
    ).toBe(1);
    expect(
      resolveSheet(modifiers('Prankster (Gnome)'), {
        situations: ['dirtyTrick'],
      }).cmb.total,
    ).toBe(1);
    expect(
      modifiers('Mordant Heritage (the Steaming Sea)').find(
        (row) => row.target === 'saves',
      )?.condition?.situation,
    ).toEqual({ local: 'against enchantment effects' });
    // Corrected targets: ranged damage, melee damage and damage, not attack.
    expect(
      modifiers('Covered Sniper (Kasatha)').map((row) => row.target),
    ).toEqual(['damage.ranged']);
    expect(modifiers('Absalom Bouncer').map((row) => row.target)).toEqual([
      'damage.melee',
    ]);
    expect(modifiers('Tar Taargadth Trained').map((row) => row.target)).toEqual(
      ['damage'],
    );
    expect(
      modifiers('Monster Hunter (Rise of the Runelords)').map(
        (row) => row.target,
      ),
    ).toEqual(['attack', 'damage']);
    // Irrepressible adds the Charisma modifier's excess over Wisdom on Will
    // saves against charm and compulsion, and never lowers the save.
    const irrepressible = (wis: number, cha: number) => {
      const sheet = traitSheet('Irrepressible');
      const base = sheet.catalogEntries[0]!;
      base.modifiers = (base.modifiers ?? []).map((row) =>
        row.target === abilityTargets.wisdom
          ? { ...row, value: wis }
          : row.target === abilityTargets.charisma
            ? { ...row, value: cha }
            : row,
      );
      const selected = modifiers('Irrepressible', 'trait-row-0');
      const will = (situations: { local: string; sheetEntryId: string }[]) =>
        calculateCharacterSheetProjections(sheet, { situations }).current
          .breakdowns['save.will'].total;
      // The Situation's contribution: the Will total with it minus without it.
      return (
        will(
          selected.map((row) => ({
            ...(row.condition?.situation as { local: string }),
            sheetEntryId: 'trait-row-0',
          })),
        ) - will([])
      );
    };
    // Wisdom 10 and Charisma 16: the excess of Charisma +3 over Wisdom +0.
    expect(irrepressible(10, 16)).toBe(3);
    // Wisdom 14 and Charisma 8: Charisma -1 is below Wisdom +2, so nothing.
    expect(irrepressible(14, 8)).toBe(0);
    // Imperial Soldier's targetless change maps nothing; each option is a
    // manual Situation, so nothing applies unconditionally.
    const soldier = resolveSheet(modifiers('Imperial Soldier (Molthune)'));
    expect([
      soldier['skill.hea'].total,
      soldier['skill.int'].total,
      soldier['skill.rid'].total,
    ]).toEqual([0, 0, 0]);
    // No reviewed armor, shield or natural armor bonus lands on ac.other (#734);
    // Dragonfoe's and Dueling Cloak Adept's AC bonuses are dodge bonuses.
    for (const row of batchEntries)
      for (const modifier of row.modifiers)
        if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
          expect(modifier.target, row.name).not.toBe('ac.other');
    for (const name of ['Dragonfoe (Giantslayer)', 'Dueling Cloak Adept'])
      expect(
        modifiers(name)
          .filter((row) => row.target === 'ac')
          .map((row) => row.bonusType),
        name,
      ).toEqual(['dodge']);
  });
});

describe('the traits-370 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    traitSheet,
    total,
  } = traitBatch(entries, 'traits-370');
  it("resolves the named traits' curated Modifiers, and two traits' trait bonuses on one statistic do not stack", () => {
    // Rapscallion and Giant Ambivalence: two traits' +1 trait bonuses on
    // initiative don't stack.
    for (const name of [
      'Rapscallion',
      'Giant Ambivalence (Temperate Highlands)',
    ] as const)
      expect(total(traitSheet(name), 'init'), name).toBe(1);
    const both = traitSheet(
      'Rapscallion',
      'Giant Ambivalence (Temperate Highlands)',
    );
    expect([
      total(both, 'init'),
      total(both, 'skill.esc'),
      total(both, 'skill.sen'),
    ]).toEqual([1, 1, 1]);
    // Proxy of Many: +2 to request a favor, +4 when you did the creature a
    // favor; the +4 is the new total, not +6.
    const proxy = 'Proxy of Many';
    expect(resolveSheet(modifiers(proxy))['skill.dip'].total).toBe(0);
    expect(
      resolveSheet(modifiers(proxy), {
        situations: [situation(proxy, 0), situation(proxy, 1)],
      })['skill.dip'].total,
    ).toBe(4);
    // Empty Mask: -1 on Will against compulsions, -2 against foes who know
    // your true identity; the penalties never add up.
    const mask = 'Empty Mask';
    expect(
      resolveSheet(modifiers(mask), {
        situations: [situation(mask, 0), situation(mask, 1)],
      })['save.will'].total,
    ).toBe(-2);
    expect(
      resolveSheet(modifiers(mask), { situations: [situation(mask, 0)] })[
        'save.will'
      ].total,
    ).toBe(-1);
    // Fey-Taken: -2 on all saves against disease, illusions and poison.
    const fey = 'Fey-Taken';
    const cursed = resolveSheet(modifiers(fey), {
      situations: [situation(fey, 0), situation(fey, 1)],
    });
    expect([
      cursed['save.fort'].total,
      cursed['save.ref'].total,
      cursed['save.will'].total,
    ]).toEqual([-2, -2, -2]);
    // Planar Savant adds the Charisma modifier's excess over Intelligence on
    // Knowledge (planes), and never lowers the check.
    const savant = (int: number, cha: number) => {
      const scores = (sheet: ReturnType<typeof traitSheet>) => {
        const base = sheet.catalogEntries[0]!;
        base.modifiers = (base.modifiers ?? []).map((row) =>
          row.target === abilityTargets.intelligence
            ? { ...row, value: int }
            : row.target === abilityTargets.charisma
              ? { ...row, value: cha }
              : row,
        );
        return sheet;
      };
      return (
        total(scores(traitSheet('Planar Savant')), 'skill.kpl') -
        total(scores(traitSheet()), 'skill.kpl')
      );
    };
    // Intelligence 10 and Charisma 16: the excess of Charisma +3 over Int +0.
    expect(savant(10, 16)).toBe(3);
    // Intelligence 14 and Charisma 8: Charisma -1 is below Intelligence +2.
    expect(savant(14, 8)).toBe(0);
    // Shared Situations only where the body's condition matches exactly.
    for (const name of [
      'Fearless Defiance',
      'Chilled by Brutality (Tundra)',
    ] as const)
      expect(
        resolveSheet(modifiers(name), { situations: ['fear'] })['save.ref']
          .total,
        name,
      ).toBe(name === 'Fearless Defiance' ? 1 : 2);
    expect(
      resolveSheet(
        modifiers('Free People (Realm of the Mammoth Lords; Kellid)'),
        { situations: ['mindAffecting'] },
      )['save.will'].total,
    ).toBe(1);
    expect(
      resolveSheet(modifiers('Blood of Giants (Reign of Winter)'), {
        situations: ['sunder'],
      }).cmb.total,
    ).toBe(1);
    // Iron Liver's poison-and-drugs bonus is narrower than the shared poison
    // Situation, so it stays local.
    expect(
      resolveSheet(modifiers('Iron Liver'), { situations: ['poison'] })[
        'save.fort'
      ].total,
    ).toBe(0);
    // Corrected targets: damage, not attack rolls; all saves for heat.
    for (const name of [
      "Treerazer's Bane (Kyonin)",
      'Warsmith (Dwarf)',
      'Noble Born - Surtova (Kingmaker)',
    ])
      expect(
        modifiers(name).map((row) => row.target),
        name,
      ).toEqual(['damage']);
    expect(
      modifiers('Quain Martial Artist (Quain)').map((row) => row.target),
    ).toEqual(['damage.melee']);
    expect(
      modifiers('Desert Nomad (Thuvia)').map((row) => [row.target, row.value]),
    ).toEqual([
      ['saves', 1],
      ['saves', 4],
    ]);
    // Ruthless: the raw critConfirm change maps nothing, so the reviewed
    // Modifier supplies the confirmation bonus under a Situation.
    const ruthless = 'Ruthless (Dwarf)';
    expect(resolveSheet(modifiers(ruthless))['attack.melee'].total).toBe(0);
    expect(
      resolveSheet(modifiers(ruthless), {
        situations: [situation(ruthless, 0)],
      })['attack.melee'].total,
    ).toBe(1);
    expect(entry(ruthless).unsupported).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'changes',
          value: expect.objectContaining({ target: 'critConfirm' }),
        }),
      ]),
    );
    // Choice traits: a targetless change maps nothing, and each option is a
    // manual Situation, so nothing applies unconditionally.
    const scholar = 'Arcane Scholar';
    const unchosen = resolveSheet(modifiers(scholar));
    expect([unchosen['skill.kar'].total, unchosen['skill.spl'].total]).toEqual([
      0, 0,
    ]);
    const spellcraft = resolveSheet(modifiers(scholar), {
      situations: [
        situation(scholar, indexOf(scholar, 'skill.spl', 'chose Spellcraft')),
      ],
    });
    expect([
      spellcraft['skill.kar'].total,
      spellcraft['skill.spl'].total,
    ]).toEqual([0, 1]);
    const orlovsky = resolveSheet(
      modifiers('Noble Born - Orlovsky (Kingmaker)'),
    );
    expect([
      orlovsky.cmd.total,
      orlovsky['skill.acr'].total,
      orlovsky['skill.dip'].total,
    ]).toEqual([1, 0, 0]);
    // Well Bred's imported Knowledge bonuses stay untyped (the listed gap), so
    // they add to Sevenarches Seeker's +1 trait bonus on Knowledge (history).
    expect(
      modifiers('Well Bred (Hermea)').map((row) => [
        row.target,
        row.bonusType,
        row.value,
      ]),
    ).toEqual([
      ['skill.khi', 'untyped', 1],
      ['skill.kre', 'untyped', 1],
      ['skill.sen', 'untyped', -1],
    ]);
    expect(
      total(
        traitSheet('Well Bred (Hermea)', 'Sevenarches Seeker (Sevenarches)'),
        'skill.khi',
      ),
    ).toBe(2);
    // No reviewed armor, shield or natural armor bonus lands on ac.other (#734);
    // Blighted Physiology's imported bonus is on ac.natural, and Lepidstadt
    // Scar's and Monster Survivor's AC bonuses are dodge bonuses.
    for (const row of batchEntries)
      for (const modifier of row.modifiers)
        if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
          expect(modifier.target, row.name).not.toBe('ac.other');
    expect(
      modifiers('Blighted Physiology (Numeria)').map((row) => [
        row.target,
        row.bonusType,
      ]),
    ).toEqual([['ac.natural', 'trait']]);
    for (const name of ['Lepidstadt Scar (Ustalav)', 'Monster Survivor'])
      expect(
        modifiers(name).map((row) => [row.target, row.bonusType]),
        name,
      ).toEqual([['ac', 'dodge']]);
  });
});

describe('the traits-371 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    traitSheet,
    total,
  } = traitBatch(entries, 'traits-371');
  it("resolves the named traits' curated Modifiers, and two traits' trait bonuses on one statistic do not stack", () => {
    // Rostlander and The Word: two traits' +1 trait bonuses on Fortitude.
    for (const name of [
      'Rostlander (Kingmaker)',
      "The Word (Tyrant's Grasp)",
    ] as const)
      expect(total(traitSheet(name), 'save.fort'), name).toBe(1);
    expect(
      total(
        traitSheet('Rostlander (Kingmaker)', "The Word (Tyrant's Grasp)"),
        'save.fort',
      ),
    ).toBe(1);
    // Freed Slave (Andoran) and Bastard: +1 trait bonuses on Will, likewise.
    expect(
      total(
        traitSheet('Freed Slave (Andoran)', 'Bastard (Kingmaker)'),
        'save.will',
      ),
    ).toBe(1);
    // A bonus that rises in a Situation is its new total: Lillend's Harp +1 on
    // Perform (string) and +2 in a bardic performance; Resourceful Alchemy +2
    // on Craft (alchemy) and +3 for alchemical items; Friends in High Places +1
    // and +2 with officials.
    for (const [name, target, low, high] of [
      ["Lillend's Harp (Aasimar; Musetouched)", 'skill.prf', 1, 2],
      ['Resourceful Alchemy (Thuvia)', 'skill.crf', 2, 3],
      ['Friends in High Places', 'skill.dip', 1, 2],
      ['Friends in High Places', 'skill.int', 1, 2],
    ] as const) {
      const rows = modifiers(name).filter((row) => row.target === target);
      const labels = rows.map((row) => row.value);
      expect(labels.sort(), name).toEqual([low, high]);
      const all = modifiers(name)
        .map((row, index) => (row.target === target ? index : -1))
        .filter((index) => index >= 0)
        .map((index) => situation(name, index));
      expect(resolveSheet(modifiers(name))[target].total, name).toBe(0);
      expect(
        resolveSheet(modifiers(name), { situations: all })[target].total,
        name,
      ).toBe(high);
      const lowIndex = modifiers(name).findIndex(
        (row) => row.target === target && row.value === low,
      );
      expect(
        resolveSheet(modifiers(name), {
          situations: [situation(name, lowIndex)],
        })[target].total,
        name,
      ).toBe(low);
    }
    // Riftwarden Orphan: the raw concentration change maps nothing, so the
    // reviewed Modifier supplies the +2 trait bonus.
    expect(
      resolveSheet(modifiers('Riftwarden Orphan (Wrath of the Righteous)'))
        .concentration.total,
    ).toBe(2);
    expect(
      entry('Riftwarden Orphan (Wrath of the Righteous)').unsupported,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
    );
    // Shared Situations where the body's condition matches exactly.
    const boarded = resolveSheet(
      modifiers("Boarded in Mediogalti (Serpent's Skull)"),
      { situations: ['poison'] },
    );
    expect([
      boarded['save.fort'].total,
      boarded['save.ref'].total,
      boarded['save.will'].total,
    ]).toEqual([2, 2, 2]);
    expect(
      resolveSheet(modifiers('Destructive Blows (Rovagug)'), {
        situations: ['sunder'],
      }).cmb.total,
    ).toBe(2);
    expect(
      resolveSheet(modifiers('Loreseeker (Lissala)'), {
        situations: ['identifyMagicItems'],
      })['skill.spl'].total,
    ).toBe(2);
    const claw = "Tiger's Claw (Skinwalker; Weretiger-Kin)";
    expect(resolveSheet(modifiers(claw))['damage.melee'].total).toBe(0);
    expect(
      resolveSheet(modifiers(claw), { situations: ['charging'] })[
        'damage.melee'
      ].total,
    ).toBe(1);
    // Magic is Life adds a spell condition to death effects, so its Situation
    // stays local and the shared death Situation leaves it out.
    expect(
      resolveSheet(modifiers('Magic is Life (Nethys)'), {
        situations: ['death'],
      })['save.fort'].total,
    ).toBe(0);
    // Foundry files these notes on attack rolls; the reviewed bonuses are on
    // damage.
    for (const name of [
      'Dockside Brawler (Skull and Shackles)',
      'Mizu Ki Hikari Rebel (Chu Ye)',
      'Backstabber (Thamir Gixx)',
      'Dirty Fighter',
      'Ratfolk Avenger (Ratfolk)',
      'Vengeful (QC)',
      claw,
    ])
      expect(
        modifiers(name).map((row) => row.target),
        name,
      ).toEqual(['damage']);
    expect(
      modifiers('Regional Recluse - Turtleback Ferry (Varisia)').map((row) => [
        row.target,
        row.bonusType,
      ]),
    ).toEqual([
      ['skill.sur', 'trait'],
      ['damage', 'untyped'],
    ]);
    // Fury of the Red's melee note is a Will bonus; Shoreline Skirmisher's
    // bonus is on combat maneuver checks only, not CMD.
    expect(modifiers('Fury of the Red').map((row) => row.target)).toEqual([
      'save.will',
    ]);
    const shore = 'Shoreline Skirmisher (Skinwalker; Wereshark-Kin)';
    const sand = resolveSheet(modifiers(shore), {
      situations: [situation(shore, 0)],
    });
    expect([sand.cmb.total, sand.cmd.total]).toEqual([2, 0]);
    // Abyssal Eavesdropper: -2 while speaking Abyssal, or +2 trait once Abyssal
    // is gained again.
    const abyssal = 'Abyssal Eavesdropper (Sarkoris, Worldwound)';
    const speaking = indexOf(abyssal, 'skill.blf', 'while speaking Abyssal"');
    const regained = indexOf(abyssal, 'skill.blf', 'gained Abyssal');
    expect(
      resolveSheet(modifiers(abyssal), {
        situations: [situation(abyssal, speaking)],
      })['skill.blf'].total,
    ).toBe(-2);
    expect(
      resolveSheet(modifiers(abyssal), {
        situations: [situation(abyssal, regained)],
      })['skill.blf'].total,
    ).toBe(2);
    // The drawbacks' penalties wait for one Situation each.
    const loner = resolveSheet(modifiers('Loner'), {
      situations: [situation('Loner', 0)],
    });
    expect([loner['attack.melee'].total, loner['ac.other'].total]).toEqual([
      -1, -1,
    ]);
    expect(resolveSheet(modifiers('Loner'))['attack.melee'].total).toBe(0);
    const sheltered = modifiers('Sheltered');
    expect(
      new Set(sheltered.map((row) => JSON.stringify(row.condition?.situation)))
        .size,
    ).toBe(1);
    const hurt = resolveSheet(sheltered, {
      situations: [situation('Sheltered', 0)],
    });
    expect([
      hurt['attack.ranged'].total,
      hurt['save.will'].total,
      hurt['skill.per'].total,
    ]).toEqual([-2, -2, -2]);
    const bastard = resolveSheet(modifiers('Bastard (Kingmaker)'), {
      situations: [situation('Bastard (Kingmaker)', 1)],
    });
    expect([
      bastard['save.will'].total,
      bastard['skill.dip'].total,
      bastard['skill.umd'].total,
      bastard['skill.per'].total,
    ]).toEqual([1, -1, -1, 0]);
    // Robot Slayer's dodge bonus applies to AC against robots.
    const robots = 'Robot Slayer (Iron Gods)';
    expect(
      resolveSheet(modifiers(robots), {
        situations: [situation(robots, indexOf(robots, 'ac', 'robots'))],
      })['ac.other'].total,
    ).toBe(1);
    // Imported trait-typed changes whose body reads an untyped bonus keep the
    // imported type (a change replacement replaces only the formula).
    for (const name of [
      'Carnation Scales (Kobold)',
      'Senatorial Hopeful (War for the Crown)',
    ])
      expect(
        new Set(modifiers(name).map((row) => row.bonusType)),
        name,
      ).toEqual(new Set(['trait']));
    // No reviewed armor, shield or natural armor bonus lands on ac.other (#734).
    for (const row of batchEntries)
      for (const modifier of row.modifiers)
        if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
          expect(modifier.target, row.name).not.toBe('ac.other');
  });
});

describe('the traits-372 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    traitSheet,
    total,
  } = traitBatch(entries, 'traits-372');
  it("resolves the named traits' curated Modifiers, and two traits' trait bonuses on one statistic do not stack", () => {
    // Hermean Paragon and Outlander - Exile: two traits' +2 trait bonuses on
    // initiative; Gruff Watcher's +1 beside them changes nothing.
    for (const name of [
      'Hermean Paragon (the Steaming Sea)',
      'Outlander - Exile (Any Campaign)',
    ] as const)
      expect(total(traitSheet(name), 'init'), name).toBe(2);
    expect(
      total(
        traitSheet(
          'Hermean Paragon (the Steaming Sea)',
          'Outlander - Exile (Any Campaign)',
          'Gruff Watcher (Human; Ulfen)',
        ),
        'init',
      ),
    ).toBe(2);
    // A bonus that rises in a Situation is its new total: Vigilant Battler's
    // +1 on Sense Motive becomes +2 against a feint, not +3.
    const vigilant = 'Vigilant Battler';
    expect(resolveSheet(modifiers(vigilant))['skill.sen'].total).toBe(1);
    expect(
      resolveSheet(modifiers(vigilant), {
        situations: [
          situation(vigilant, indexOf(vigilant, 'skill.sen', 'feint')),
        ],
      })['skill.sen'].total,
    ).toBe(2);
    // Feline Instinct's +3 waits for its surprise-round Situation.
    const feline = 'Feline Instinct (Skinwalker; Weretiger-Kin)';
    expect(total(traitSheet(feline), 'init')).toBe(0);
    expect(
      resolveSheet(modifiers(feline), { situations: [situation(feline, 0)] })
        .init.total,
    ).toBe(3);
    // Bruising Intellect adds the Intelligence modifier's excess over Charisma
    // on Intimidate and never lowers the check.
    const bruising = (int: number, cha: number) => {
      const sheet = traitSheet('Bruising Intellect');
      const base = sheet.catalogEntries[0]!;
      base.modifiers = (base.modifiers ?? []).map((row) =>
        row.target === abilityTargets.intelligence
          ? { ...row, value: int }
          : row.target === abilityTargets.charisma
            ? { ...row, value: cha }
            : row,
      );
      return calculateCharacterSheetProjections(sheet).current.breakdowns[
        'skill.int'
      ].total;
    };
    expect(bruising(16, 10)).toBe(3);
    expect(bruising(8, 14)).toBe(2);
    // Unmapped or targetless imported changes contribute nothing; reviewed
    // Modifiers supply the rule under its Situation.
    // Defender of the Society's +1 trait bonus on AC lands on the other leaf,
    // as a trait bonus, not on an armor leaf.
    for (const [name, target, leaf, value] of [
      ['Magical Knack', 'casterLevel', 'casterLevel', 2],
      [
        'Defender of the Society (Fighter, Pathfinder Society)',
        'ac',
        'ac.other',
        1,
      ],
      ['Trench Navigator (Xidao)', 'skill.pro', 'skill.pro', 1],
      ['Mechanical Expertise (Alkenstar)', 'skill.dev', 'skill.dev', 1],
      ['Exchange Agent (Shattered Star)', 'skill.lin', 'skill.lin', 1],
    ] as const) {
      expect(entry(name).unsupported, name).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
      );
      const index = modifiers(name).findIndex((row) => row.target === target);
      expect(resolveSheet(modifiers(name))[leaf].total, name).toBe(0);
      expect(
        resolveSheet(modifiers(name), { situations: [situation(name, index)] })[
          leaf
        ].total,
        name,
      ).toBe(value);
    }
    // Choices are one Situation per option.
    for (const [name, count] of [
      ['Mechanical Expertise (Alkenstar)', 3],
      ['Exchange Agent (Shattered Star)', 4],
      ['Ancestral Weapon (Numeria)', 2],
      ['Triaxian Tradition (Triaxus)', 3],
    ] as const)
      expect(modifiers(name), name).toHaveLength(count);
    // Shared Situations where the body's condition matches exactly.
    expect(
      resolveSheet(modifiers('Contagious Mettle'), { situations: ['fear'] })[
        'save.will'
      ].total,
    ).toBe(1);
    const heart = resolveSheet(modifiers('Strong Heart (Gorum)'), {
      situations: ['fear'],
    });
    expect([
      heart['save.fort'].total,
      heart['save.ref'].total,
      heart['save.will'].total,
    ]).toEqual([1, 1, 1]);
    expect(
      resolveSheet(modifiers('Cynical'), { situations: ['illusions'] })[
        'save.will'
      ].total,
    ).toBe(1);
    expect(
      resolveSheet(modifiers("Angradd's Valor (Angradd)"), {
        situations: ['charging'],
      })['attack.melee'].total,
    ).toBe(1);
    // Dedicated Defender adds an adjacency condition to overcoming spell
    // resistance, so the shared Situation leaves it out.
    expect(
      resolveSheet(modifiers('Dedicated Defender'), {
        situations: ['spellResistance'],
      }).casterLevel.total,
    ).toBe(0);
    // Foundry files these notes on attack rolls; the reviewed bonuses are on
    // damage.
    for (const [name, target] of [
      ['Master of the Sudden Strike (Human; Tian)', 'damage'],
      ['Zest for Battle (Dwarf)', 'damage'],
      ['Shadow Stabber (Tiefling)', 'damage.melee'],
    ] as const)
      expect(
        modifiers(name).map((row) => row.target),
        name,
      ).toEqual([target]);
    expect(
      modifiers('Peg Leg (Skull and Shackles)').map((row) => row.target),
    ).toEqual(['save.fort', 'damage']);
    // Untyped bonuses stay untyped.
    for (const name of [
      'Excellent Penmanship',
      'A Sure Thing (Silver Crusade)',
      'Giant Investigator (Coast)',
    ])
      expect(
        new Set(modifiers(name).map((row) => row.bonusType)),
        name,
      ).toEqual(new Set(['untyped']));
    expect(
      modifiers('Social Slaver (Cheliax)').map((row) => [
        row.target,
        row.bonusType,
      ]),
    ).toEqual([
      ['skill.int', 'trait'],
      ['spellDC', 'untyped'],
    ]);
    // Righteous Indignation's -1 Will penalty waits for its Situation.
    const indignation = 'Righteous Indignation';
    expect(resolveSheet(modifiers(indignation))['save.will'].total).toBe(0);
    expect(
      resolveSheet(modifiers(indignation), {
        situations: [situation(indignation, 0)],
      })['save.will'].total,
    ).toBe(-1);
    // Mountain Guide's Knowledge (geography) bonus waits for the same
    // mountainous-areas Situation as Survival: a reviewed change replacement
    // sets the unconditional imported change to 0 (owner decision, #372 fix
    // round 1). Mutabi-qi Explorer's repeated "checks" keeps its Knowledge
    // (geography) bonus unrestricted.
    const mountain = 'Mountain Guide (Five Kings Mountains)';
    const away = resolveSheet(modifiers(mountain));
    expect([away['skill.kge'].total, away['skill.sur'].total]).toEqual([0, 0]);
    const mountains = situation(
      mountain,
      indexOf(mountain, 'skill.kge', 'mountainous areas'),
    );
    // Survival's Modifier carries the same Situation, on the trait's own entry.
    expect(mountains).toEqual({
      local: 'when in mountainous areas',
      sheetEntryId: 'pf1-content/GMtjhKObcxyyMzjC',
    });
    expect(
      situation(mountain, indexOf(mountain, 'skill.sur', 'mountainous areas')),
    ).toEqual({
      local: 'when in mountainous areas',
      sheetEntryId: 'pf1-content/GMtjhKObcxyyMzjC',
    });
    const climbing = resolveSheet(modifiers(mountain), {
      situations: [mountains],
    });
    expect([climbing['skill.kge'].total, climbing['skill.sur'].total]).toEqual([
      1, 1,
    ]);
    expect(
      resolveSheet(modifiers('Mutabi-qi Explorer (Shanguang)'))['skill.kge']
        .total,
    ).toBe(1);
    // No reviewed armor, shield or natural armor bonus lands on ac.other (#734).
    for (const row of batchEntries)
      for (const modifier of row.modifiers)
        if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
          expect(modifier.target, row.name).not.toBe('ac.other');
  });
});

describe('the traits-373 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    traitSheet,
    total,
  } = traitBatch(entries, 'traits-373');
  it("resolves the named traits' curated Modifiers, and two traits' trait bonuses on one statistic do not stack", () => {
    // The case runs its checks in order, in runs of a few, so that each
    // function stays within the lint's complexity limit.
    for (const checks of [
      () => {
        // Three traits' +1 trait bonuses on Knowledge (nobility) never stack.
        for (const name of [
          'Traditionalist (Divine Anthology)',
          'Crusader Tactician (Lastwall)',
          'Contemptuous',
        ] as const)
          expect(total(traitSheet(name), 'skill.kno'), name).toBe(1);
        expect(
          total(
            traitSheet(
              'Traditionalist (Divine Anthology)',
              'Crusader Tactician (Lastwall)',
              'Contemptuous',
            ),
            'skill.kno',
          ),
        ).toBe(1);
        // A bonus that rises in a Situation is its new total: Creative Reality's
        // +1 on Bluff becomes +5, not +6, beside Sharp Wits' +1.
        const creative = 'Creative Reality (Ganzi)';
        expect(resolveSheet(modifiers(creative))['skill.blf'].total).toBe(1);
        expect(
          resolveSheet(
            [
              ...modifiers(creative),
              ...modifiers('Sharp Wits (Human; Vudrani)'),
            ],
            {
              situations: [
                situation(
                  creative,
                  indexOf(creative, 'skill.blf', 'falsehood'),
                ),
              ],
            },
          )['skill.blf'].total,
        ).toBe(5);
        // Sharp Wits' unmapped concentration change is supplied by its reviewed
        // Modifier.
        expect(entry('Sharp Wits (Human; Vudrani)').unsupported).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'changes',
              value: expect.objectContaining({ target: 'concentration' }),
            }),
          ]),
        );
        const wits = calculateCharacterSheetProjections(
          traitSheet('Sharp Wits (Human; Vudrani)'),
        ).current.breakdowns;
        expect([wits['skill.blf'].total, wits.concentration.total]).toEqual([
          1, 1,
        ]);
        // Practiced Disruptor's +1 needs a rank in Knowledge (arcana), and stays +1
        // with more ranks (the ranks themselves are not Modifiers).
        const disruptor = modifiers('Practiced Disruptor');
        for (const [ranks, value] of [
          [0, 0],
          [1, 1],
          [4, 1],
        ] as const)
          expect(
            resolveSheet(disruptor, { skillRanks: { 'skill.kar': ranks } })[
              'skill.kar'
            ].total,
            `${ranks} ranks`,
          ).toBe(value);
        // Transitional's weather bonus is 3 + 1/2 your character level.
        const transitional = 'Transitional (Triaxian)';
        const weather = situation(
          transitional,
          indexOf(transitional, 'skill.sur', 'weather'),
        );
        for (const [level, value] of [
          [1, 3],
          [6, 6],
          [11, 8],
        ] as const)
          expect(
            resolveSheet(modifiers(transitional), {
              level,
              situations: [weather],
            })['skill.sur'].total,
            `level ${level}`,
          ).toBe(value);
        // Targetless or unsupported imported changes contribute nothing; reviewed
        // Modifiers supply the rule under its Situation.
        for (const [name, target, value] of [
          ['Color Thief (Goblin)', 'skill.ste', 2],
          ['Clan Artisan (Xa Hoi)', 'skill.crf', 2],
          ['Brastlewark Businessman (Gnome)', 'skill.crf', 2],
          ['Hero Worship (Jade Regent)', 'concentration', 2],
        ] as const) {
          expect(entry(name).unsupported, name).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'changes' }),
            ]),
          );
          const index = modifiers(name).findIndex(
            (row) => row.target === target,
          );
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(0);
          expect(
            resolveSheet(modifiers(name), {
              situations: [situation(name, index)],
            })[target].total,
            name,
          ).toBe(value);
        }
        // Hero Worship's untyped +1 against attacks of opportunity lands on the
        // other AC leaf.
        const hero = 'Hero Worship (Jade Regent)';
        expect(
          resolveSheet(modifiers(hero), {
            situations: [situation(hero, indexOf(hero, 'ac', 'Shalelu'))],
          })['ac.other'].total,
        ).toBe(1);
        // Choices are one Situation per option.
        for (const [name, count] of [
          ['Dragon Armor', 5],
          ['Propitiation (any dwarven deity)', 6],
          ['Inner Beauty (Shelyn)', 4],
          ['Hero Worship (Jade Regent)', 3],
        ] as const)
          expect(modifiers(name), name).toHaveLength(count);
        // Shared Situations only where the body's condition matches exactly.
        expect(
          resolveSheet(modifiers('Abject Belief'), { situations: ['fear'] })[
            'save.will'
          ].total,
        ).toBe(2);
        for (const [name, key] of [
          ['Perpetual Companion', 'fear'],
          ['Vile Kiss (Tiefling; The Motherless)', 'dirtyTrick'],
          ['Burnished Skin (Aasimar; Emberkin)', 'illusions'],
          ['Hagfish Hopeful (Rise of the Runelords)', 'poison'],
        ] as const) {
          const resolved = resolveSheet(modifiers(name), { situations: [key] });
          expect(
            [
              resolved['save.fort'].total,
              resolved['save.ref'].total,
              resolved['save.will'].total,
              resolved.cmb.total,
            ],
            name,
          ).toEqual([0, 0, 0, 0]);
        }
        // Foundry files these notes on attack rolls; the reviewed bonuses are on
        // damage too, or only.
        for (const [name, targets] of [
          ['Flair for Destruction (Tiefling; Pitborn)', ['damage']],
          ['Lastwall Defender', ['attack', 'damage']],
          ["The Reclaimer (Tyrant's Grasp)", ['skill.per', 'attack', 'damage']],
        ] as const)
          expect(
            modifiers(name).map((row) => row.target),
            name,
          ).toEqual(targets);
        // Armed Grit's bonus is on all saves against fear, not only Will.
        expect(modifiers('Armed Grit').map((row) => row.target)).toEqual([
          'saves',
        ]);
      },
      () => {
        // Untyped bonuses and penalties stay untyped; the map's bonus is competence.
        for (const name of ['The Newlyweds', 'Guilty Fraud', 'Sleepy'])
          expect(
            new Set(modifiers(name).map((row) => row.bonusType)),
            name,
          ).toEqual(new Set(['untyped']));
        expect(
          modifiers('Outlander - Lore Seeker (Any Campaign)').map((row) => [
            row.target,
            row.bonusType,
          ]),
        ).toEqual([
          ['skill.kar', 'trait'],
          ['casterLevel', 'untyped'],
          ['spellDC', 'untyped'],
        ]);
        expect(
          modifiers("Boarded in Cheliax (Serpent's Skull)").map(
            (row) => row.bonusType,
          ),
        ).toEqual(['competence']);
        // Guilty Fraud's -4 Bluff penalty waits for its Situation.
        const fraud = 'Guilty Fraud';
        expect(resolveSheet(modifiers(fraud))['skill.blf'].total).toBe(0);
        expect(
          resolveSheet(modifiers(fraud), { situations: [situation(fraud, 0)] })[
            'skill.blf'
          ].total,
        ).toBe(-4);
        // No reviewed armor, shield or natural armor bonus lands on ac.other (#734).
        for (const row of batchEntries)
          for (const modifier of row.modifiers)
            if (
              ['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType)
            )
              expect(modifier.target, row.name).not.toBe('ac.other');
      },
    ])
      checks();
  });
});

describe('the traits-374 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    traitSheet,
    total,
  } = traitBatch(entries, 'traits-374');
  // A base sheet with the given ability scores, for the ability swaps.
  function withScores(
    sheet: ReturnType<typeof traitSheet>,
    scores: Partial<Record<'int' | 'wis' | 'cha', number>>,
  ) {
    const [base, ...rest] = sheet.catalogEntries;
    return {
      ...sheet,
      catalogEntries: [
        {
          ...base!,
          modifiers: base!.modifiers.map((modifier) => {
            const ability = Object.entries(scores).find(
              ([key]) =>
                modifier.target ===
                abilityTargets[
                  (
                    {
                      int: 'intelligence',
                      wis: 'wisdom',
                      cha: 'charisma',
                    } as const
                  )[key as 'int' | 'wis' | 'cha']
                ],
            );
            return ability ? { ...modifier, value: ability[1] } : modifier;
          }),
        },
        ...rest,
      ],
    };
  }

  it("resolves the named traits' curated Modifiers, and two traits' trait bonuses on one statistic do not stack", () => {
    // The case runs its checks in order, in runs of a few, so that each
    // function stays within the lint's complexity limit.
    for (const checks of [
      () => {
        // Trait bonuses from different traits on one skill never stack.
        expect(total(traitSheet('Devotee of the Green'), 'skill.kge')).toBe(1);
        expect(
          total(
            traitSheet('Devotee of the Green', "Nomadic (Human; Bas'o)"),
            'skill.kge',
          ),
        ).toBe(1);
        expect(
          total(traitSheet('Devotee of the Green', 'Savage'), 'skill.kna'),
        ).toBe(1);
        // A bonus that rises in a Situation is its new total: Vexing Defender's +1
        // on Acrobatics becomes +4, Imposing Scion's +1 on Intimidate becomes +2,
        // and Darkest Before Dawn's daily +4 replaces its +2.
        for (const [name, target, label, base, raised] of [
          ['Vexing Defender (Giantslayer)', 'skill.acr', 'larger enemy', 1, 4],
          ['Imposing Scion', 'skill.int', 'bloodline', 1, 2],
        ] as const) {
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(base);
          expect(
            resolveSheet(modifiers(name), {
              situations: [situation(name, indexOf(name, target, label))],
            })[target].total,
            name,
          ).toBe(raised);
        }
        const dawn = 'Darkest Before Dawn';
        expect(
          resolveSheet(modifiers(dawn), {
            situations: [situation(dawn, 0), situation(dawn, 1)],
          })['save.will'].total,
        ).toBe(4);
        // Targetless imported changes contribute nothing; reviewed Modifiers supply
        // the rule under its Situation.
        for (const [name, target, value] of [
          ['Brastlewark Businessman (Gnome)', 'skill.crf', 2],
          ['Varisian Wanderer (Varisia)', 'skill.slt', 1],
          ['Conspiracy Hunter (Council of Thieves)', 'skill.ste', 1],
          ['Secret Knowledge (Norgorber)', 'skill.kre', 2],
          ["Urban Sleuth (Hell's Rebels)", 'skill.kpl', 1],
          ['Knowledgeable Caster', 'skill.kar', 1],
        ] as const) {
          expect(entry(name).unsupported, name).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'changes' }),
            ]),
          );
          const index = modifiers(name).findIndex(
            (row) => row.target === target,
          );
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(0);
          expect(
            resolveSheet(modifiers(name), {
              situations: [situation(name, index)],
            })[target].total,
            name,
          ).toBe(value);
        }
        // Choices are one Situation per option.
        for (const [name, count] of [
          ["Urban Sleuth (Hell's Rebels)", 4],
          ['Varisian Wanderer (Varisia)', 3],
          ['Conspiracy Hunter (Council of Thieves)', 6],
          ['Secret Knowledge (Norgorber)', 10],
          ['Knowledgeable Caster', 11],
          ['Against the Technic League (Iron Gods)', 2],
        ] as const)
          expect(modifiers(name), name).toHaveLength(count);
        // Empathic Diplomat uses Wisdom instead of Charisma on Diplomacy; Precise
        // Treatment's imported swap uses Intelligence instead of Wisdom on Heal.
        const diplomat = calculateCharacterSheetProjections(
          withScores(traitSheet('Empathic Diplomat (Qadira, Osirion)'), {
            wis: 14,
            cha: 8,
          }),
        ).current.breakdowns;
        expect(diplomat['skill.dip'].total).toBe(2);
        const treatment = calculateCharacterSheetProjections(
          withScores(traitSheet('Precise Treatment'), { int: 14, wis: 8 }),
        ).current.breakdowns;
        expect(treatment['skill.hea'].total).toBe(3);
        // Shared Situations only where the body's condition matches exactly.
        for (const [name, key, target, value] of [
          ["Gifted Satirist (Hell's Rebels)", 'fear', 'save.will', 2],
          ['Sound of Mind (Zi Ha)', 'mindAffecting', 'save.fort', 2],
          ["Magic's Might (Yuelral)", 'spellResistance', 'casterLevel', 1],
          ['Dwarf-Trained (Giantslayer)', 'giants', 'ac.other', 2],
        ] as const)
          expect(
            resolveSheet(modifiers(name), { situations: [key] })[target].total,
            name,
          ).toBe(value);
      },
      () => {
        for (const [name, key] of [
          ['Weed Resistance (Kyonin)', 'poison'],
          ['Iron Lungs (Darklands)', 'poison'],
          ['Darkest Before Dawn', 'fear'],
          ['Insular (Elf)', 'fear'],
          ["Lamia's Bane", 'enchantment'],
          ['Savage Breaker (Varisia; Korvosa)', 'sunder'],
          ['Splash Attack', 'dirtyTrick'],
        ] as const) {
          const resolved = resolveSheet(modifiers(name), { situations: [key] });
          expect(
            [
              resolved['save.fort'].total,
              resolved['save.ref'].total,
              resolved['save.will'].total,
              resolved.cmb.total,
            ],
            name,
          ).toEqual([0, 0, 0, 0]);
        }
        // Foundry files these notes on other statistics; the reviewed Modifiers
        // land where the body puts them.
        for (const [name, targets] of [
          ['Andoren Freedom Fighter (Andoran)', ['attack', 'damage']],
          ['Ozem-Inspired', ['attack', 'damage']],
          ['Shiv (Sczarni Faction)', ['damage']],
          ['Against the Technic League (Iron Gods)', ['damage', 'spellDC']],
          ['Starlit Hexer (any Outer God)', ['spellDC']],
          ['Reckless Luck (Chaldira Zuzaristan)', ['ac']],
        ] as const)
          expect(
            modifiers(name).map((row) => row.target),
            name,
          ).toEqual(targets);
        expect(modifiers('Chelish Guerrilla (Cheliax)')[0]?.target).toBe(
          'damage',
        );
        // Shiv's +1 is on all damage, so a thrown one-handed piercing weapon (a
        // javelin) in a surprise round gets it, and only under its Situation.
        const shiv = 'Shiv (Sczarni Faction)';
        const thrown: CharacterSheetInput = {
          characterKind: 'pc',
          entries: [
            {
              _id: 'base-row',
              kind: 'base',
              active: true,
              catalogEntryId: 'base',
              state: {
                kind: 'base',
                proficiencies: { added: [{ category: 'simple' }], removed: [] },
              },
            },
            {
              _id: 'javelin-row',
              kind: 'item',
              active: true,
              catalogEntryId: 'javelin',
              state: { kind: 'item' },
            },
            {
              _id: 'routine',
              kind: 'attackRoutine',
              active: true,
              state: {
                kind: 'attackRoutine',
                name: 'Javelin',
                weaponEntryId: 'javelin-row',
                hands: 'one',
                mode: 'thrown',
              },
            },
            {
              _id: 'shiv-row',
              kind: 'trait',
              active: true,
              catalogEntryId: 'shiv',
              state: { kind: 'trait' },
            },
          ],
          catalogEntries: [
            {
              _id: 'base',
              ruleIdentity: 'base',
              modifiers: Object.values(abilityTargets).map((target) => ({
                target,
                bonusType: 'base' as const,
                value: 10,
              })),
            },
            {
              _id: 'javelin',
              name: 'Javelin',
              ruleIdentity: 'javelin',
              modifiers: [],
              detail: {
                kind: 'item',
                weapon: {
                  baseType: 'javelin',
                  proficiency: 'simple',
                  handedness: 'oneHanded',
                  attackType: 'ranged',
                  thrown: true,
                  thrownRangeIncrement: 30,
                  dice: '1d6',
                  damageTypes: ['piercing'],
                  threat: 20,
                  mult: 2,
                  strengthDamage: 'thrown',
                },
              },
            },
            {
              _id: 'shiv',
              ruleIdentity: entry(shiv).externalKey,
              modifiers: modifiers(shiv).map(
                ({ target, bonusType, value, condition }) => ({
                  target,
                  bonusType,
                  value,
                  condition,
                }),
              ),
            },
          ],
        };
        const surprise = situation(shiv, 0, 'shiv-row');
        const routine = (situations: (typeof surprise)[]) =>
          calculateCharacterSheet(thrown, { situations }).attackRoutines[0];
        expect(routine([])?.single[0]?.damageBonus.total).toBe(0);
        expect(routine([surprise])?.single[0]?.damageBonus.total).toBe(1);
      },
      () => {
        // Untyped bonuses and penalties stay untyped, as published; Huldra's Luck
        // is a luck bonus and Dwarf-Trained's AC bonus a dodge bonus.
        for (const name of [
          'Sneaky Swimmer (Kobold)',
          'Proud Tribesman (Human; Mwangi)',
          'Diabolist Raised (Council of Thieves)',
          'Mark of Slavery',
          'Inspired by Greatness (Carrion Crown)',
        ])
          expect(
            new Set(modifiers(name).map((row) => row.bonusType)),
            name,
          ).toEqual(new Set(['untyped']));
        expect(
          new Set(
            modifiers("Huldra's Luck (Lands of the Linnorm Kings)").map(
              (row) => row.bonusType,
            ),
          ),
        ).toEqual(new Set(['luck']));
        expect(
          modifiers('Dwarf-Trained (Giantslayer)').map((row) => row.bonusType),
        ).toEqual(['dodge', 'trait']);
        // Mark of Slavery's -2 penalties wait for their Situation.
        const mark = 'Mark of Slavery';
        expect(resolveSheet(modifiers(mark))['skill.blf'].total).toBe(0);
        expect(
          resolveSheet(modifiers(mark), {
            situations: [situation(mark, indexOf(mark, 'skills', 'retrying'))],
          })['skill.blf'].total,
        ).toBe(-2);
        // No reviewed armor, shield or natural armor bonus lands on ac.other (#734).
        for (const row of batchEntries)
          for (const modifier of row.modifiers)
            if (
              ['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType)
            )
              expect(modifier.target, row.name).not.toBe('ac.other');
      },
    ])
      checks();
  });
});

describe('the traits-375 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    traitSheet,
    total,
  } = traitBatch(entries, 'traits-375');
  // A base sheet with the given ability scores, for the Intelligence formula.
  function withScores(
    sheet: ReturnType<typeof traitSheet>,
    scores: Partial<Record<'int', number>>,
  ) {
    const [base, ...rest] = sheet.catalogEntries;
    return {
      ...sheet,
      catalogEntries: [
        {
          ...base!,
          modifiers: base!.modifiers.map((modifier) =>
            modifier.target === abilityTargets.intelligence &&
            scores.int !== undefined
              ? { ...modifier, value: scores.int }
              : modifier,
          ),
        },
        ...rest,
      ],
    };
  }

  it("resolves the named traits' curated Modifiers, and two traits' trait bonuses on one statistic do not stack", () => {
    // The case runs its checks in order, in runs of a few, so that each
    // function stays within the lint's complexity limit.
    for (const checks of [
      () => {
        // Trait bonuses from different traits on one skill never stack.
        expect(
          total(traitSheet('Talented Organizer (Milani)'), 'skill.sen'),
        ).toBe(1);
        expect(
          total(
            traitSheet('Talented Organizer (Milani)', "Outcast's Intuition"),
            'skill.sen',
          ),
        ).toBe(1);
        expect(
          total(
            traitSheet('Market Rat (Human; Keleshite)', 'For the Money'),
            'skill.apr',
          ),
        ).toBe(1);
        // A bonus that rises in a Situation is its new total: Desperate Resolve's
        // +1 on concentration becomes +4, Armun Kelisk Scholar's +1 on Knowledge
        // (planes) becomes +3 and For the Money's +2 becomes +4.
        for (const [name, target, label, base, raised] of [
          ['Desperate Resolve', 'concentration', 'grappled', 1, 4],
          [
            'Armun Kelisk Scholar (Plane of Air)',
            'skill.kpl',
            'air subtype',
            1,
            3,
          ],
        ] as const) {
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(base);
          expect(
            resolveSheet(modifiers(name), {
              situations: [situation(name, indexOf(name, target, label))],
            })[target].total,
            name,
          ).toBe(raised);
        }
        const money = 'For the Money';
        expect(
          resolveSheet(modifiers(money), {
            situations: [
              situation(money, indexOf(money, 'skills', 'haggle prices or')),
              situation(
                money,
                indexOf(money, 'skills', 'position of military'),
              ),
            ],
          })['skill.dip'].total,
        ).toBe(4);
        // Targetless or unmapped imported changes contribute nothing; reviewed
        // Modifiers supply the rule, under its Situation where it has one.
        for (const [name, target, value] of [
          ['Younger Sibling (Jade Regent)', 'save.will', 1],
          ['Unwelcome Business', 'skill.dis', 1],
          ['Regional Influence - Magnimar (Varisia)', 'skill.pro', 1],
          ['Criminal', 'skill.dev', 1],
          ['Proper Training (Grand Lodge)', 'skill.khi', 1],
          ['Athletic Champion (War for the Crown)', 'skill.swm', 1],
          ['Armun Kelisk Scholar (Plane of Air)', 'skill.kna', 1],
        ] as const) {
          expect(entry(name).unsupported, name).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'changes' }),
            ]),
          );
          const index = modifiers(name).findIndex(
            (row) => row.target === target && row.value === value,
          );
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(0);
          expect(
            resolveSheet(modifiers(name), {
              situations: [situation(name, index)],
            })[target].total,
            name,
          ).toBe(value);
        }
        for (const [name, value] of [
          ['Unbreakable Hate (Half-Orc, Orc)', 2],
          ['Desperate Resolve', 1],
        ] as const) {
          expect(entry(name).unsupported, name).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                field: 'changes',
                value: expect.objectContaining({ target: 'concentration' }),
              }),
            ]),
          );
          expect(resolveSheet(modifiers(name)).concentration.total, name).toBe(
            value,
          );
        }
        // Choices are one Situation per option.
        for (const [name, count] of [
          ['Armun Kelisk Scholar (Plane of Air)', 20],
          ['Younger Sibling (Jade Regent)', 4],
          ['Unwelcome Business', 2],
          ['Criminal', 3],
          ['Proper Training (Grand Lodge)', 2],
          ['Athletic Champion (War for the Crown)', 6],
          ['Imperfect Recall', 10],
          ['Warrior Poet (Lands of the Linnorm Kings)', 11],
          ["Ex-Iomedaean (Hell's Vengeance)", 3],
        ] as const)
          expect(modifiers(name), name).toHaveLength(count);
        // Tactile Telekinesis adds the Intelligence modifier on Climb and Swim.
        const tactile = withScores(
          traitSheet('Tactile Telekinesis (Lashunta)'),
          {
            int: 16,
          },
        );
        const scope = modifiers('Tactile Telekinesis (Lashunta)')[0]?.condition
          ?.situation;
        if (!scope || typeof scope === 'string' || !('local' in scope))
          throw new Error('Expected a local Situation');
        const tactileTotals = calculateCharacterSheetProjections(tactile, {
          situations: [{ local: scope.local, sheetEntryId: 'trait-row-0' }],
        }).current.breakdowns;
        expect(tactileTotals['skill.clm'].total).toBe(3);
        expect(tactileTotals['skill.swm'].total).toBe(3);
        expect(total(tactile, 'skill.clm')).toBe(0);
      },
      () => {
        // Freedom Fighter's +2 becomes a -2 penalty with slavers.
        const fighter = 'Freedom Fighter (Andoran)';
        expect(resolveSheet(modifiers(fighter))['skill.dip'].total).toBe(2);
        expect(
          resolveSheet(modifiers(fighter), {
            situations: [
              situation(fighter, indexOf(fighter, 'skill.dip', 'slave')),
            ],
          })['skill.dip'].total,
        ).toBe(-2);
        // Shared Situations only where the body's condition matches exactly.
        for (const [name, key, target, value] of [
          ['Giant Slayer (Rise of the Runelords)', 'giants', 'damage.melee', 1],
          ['Student of Giantkind (Giantslayer)', 'giants', 'skill.dip', 1],
          ['Serpentine Squeeze (Ydersius)', 'grapple', 'cmb', 1],
        ] as const)
          expect(
            resolveSheet(modifiers(name), { situations: [key] })[target].total,
            name,
          ).toBe(value);
        for (const [name, key, target] of [
          ['Serpentine Squeeze (Ydersius)', 'grapple', 'cmd'],
          ['Neutralizing Gut (Tiefling)', 'poison', 'save.fort'],
          ['Enemy of the Undead (Geb)', 'spells', 'save.will'],
          ['Enemy of the Undead (Geb)', 'spellLike', 'save.will'],
          ['Unbalanced Insight', 'fear', 'save.will'],
          ['Enduring Stoicism (Strange Aeons)', 'fear', 'save.will'],
          ['Eldritch Auditor', 'identifyMagicItems', 'skill.spl'],
          ['Student of Giantkind (Giantslayer)', 'giants', 'skill.klo'],
        ] as const)
          expect(
            resolveSheet(modifiers(name), { situations: [key] })[target].total,
            `${name} ${key}`,
          ).toBe(0);
        // Foundry files these notes on other statistics; the reviewed Modifiers
        // land where the body puts them.
        for (const [name, targets] of [
          ['Blade of the Society (Rogue, Pathfinder Society)', ['damage']],
          ['Undead Slayer (Pharasma)', ['damage']],
          ['Second Tongue (Old Cults)', ['casterLevel']],
          ['Lost Nobility', ['attack', 'damage']],
          ["Ex-Iomedaean (Hell's Vengeance)", ['attack', 'damage', 'spellDC']],
        ] as const)
          expect(
            modifiers(name).map((row) => row.target),
            name,
          ).toEqual(targets);
        expect(modifiers('Eldritch Delver').map((row) => row.target)).toEqual([
          'skill.kdu',
          'skill.khi',
          'casterLevel',
        ]);
        // Untyped bonuses and penalties stay untyped, as published.
        for (const name of [
          'Pride',
          'Imperfect Recall',
          'Second Tongue (Old Cults)',
          'Celestial Contact (Aasimar)',
        ])
          expect(
            new Set(modifiers(name).map((row) => row.bonusType)),
            name,
          ).toEqual(new Set(['untyped']));
        expect(
          modifiers('Twisted Transformations (any Great Old One)').map(
            (row) => row.bonusType,
          ),
        ).toEqual(['untyped', 'trait', 'untyped']);
        // Pride's -2 penalties wait for their Situation.
        expect(resolveSheet(modifiers('Pride'))['skill.sen'].total).toBe(0);
        expect(
          resolveSheet(modifiers('Pride'), {
            situations: [
              situation('Pride', indexOf('Pride', 'skill.sen', 'apolog')),
            ],
          })['skill.sen'].total,
        ).toBe(-2);
        // No reviewed armor, shield or natural armor bonus lands on ac.other (#734).
        for (const row of batchEntries)
          for (const modifier of row.modifiers)
            if (
              ['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType)
            )
              expect(modifier.target, row.name).not.toBe('ac.other');
      },
    ])
      checks();
  });
});

describe('the traits-376 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    traitSheet,
    total,
  } = traitBatch(entries, 'traits-376');
  // A sheet with the trait and set ability scores; the function it returns
  // gives the sheet's total on a target, with the Situations of the trait's
  // Modifiers at those indexes selected on its sheet entry.
  function scored(
    name: Parameters<typeof traitSheet>[0],
    scores: Partial<Record<keyof typeof abilityTargets, number>>,
  ) {
    return (target: string, situations: number[] = []) => {
      const sheet = traitSheet(name);
      const base = sheet.catalogEntries[0]!;
      base.modifiers = (base.modifiers ?? []).map((row) => {
        const hit = Object.entries(scores).find(
          ([ability]) =>
            abilityTargets[ability as keyof typeof abilityTargets] ===
            row.target,
        );
        return hit ? { ...row, value: hit[1] } : row;
      });
      return calculateCharacterSheetProjections(sheet, {
        situations: situations.map((index) =>
          situation(name, index, 'trait-row-0'),
        ),
      }).current.breakdowns[target as 'skill.per'].total;
    };
  }

  it("resolves the named traits' curated Modifiers, and two traits' trait bonuses on one statistic do not stack", () => {
    // The case runs its checks in order, in runs of a few, so that each
    // function stays within the lint's complexity limit.
    for (const checks of [
      () => {
        // Indomitable Faith and Purity of Faith: two traits' +1 trait bonuses on
        // Will saves don't stack.
        for (const name of [
          'Indomitable Faith',
          'Purity of Faith (Iomedae)',
        ] as const)
          expect(total(traitSheet(name), 'save.will'), name).toBe(1);
        expect(
          total(
            traitSheet('Indomitable Faith', 'Purity of Faith (Iomedae)'),
            'save.will',
          ),
        ).toBe(1);
        // Purity of Faith's bonus against evil outsiders is one Situation; on Will
        // it doesn't add to the trait's own +1.
        const purity = 'Purity of Faith (Iomedae)';
        const evil = resolveSheet(modifiers(purity), {
          situations: [
            situation(purity, indexOf(purity, 'saves', 'evil subtype')),
          ],
        });
        expect([
          evil['save.fort'].total,
          evil['save.ref'].total,
          evil['save.will'].total,
        ]).toEqual([1, 1, 1]);
        // A bonus that rises in a Situation is its new total.
        for (const [name, target, label, base, raised] of [
          ['Theoretical Magician', 'skill.spl', 'spellcaster', 2, 3],
          [
            'Sovyrian Intellectual (Elf, 1st-level)',
            'skill.dip',
            'elf subtype',
            1,
            3,
          ],
          ['Acolyte of Razmir (Razmiran)', 'skill.klo', 'Razmiri', 1, 2],
          ['Acolyte of Razmir (Razmiran)', 'skill.kre', 'Razmiri', 1, 2],
        ] as const) {
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(base);
          expect(
            resolveSheet(modifiers(name), {
              situations: [situation(name, indexOf(name, target, label))],
            })[target].total,
            name,
          ).toBe(raised);
        }
        // Strength of Body uses the Strength modifier in place of the Constitution
        // modifier on one Fortitude save, never lowering it. (The classless
        // fixture's Fortitude save has no Constitution modifier of its own, so the
        // totals show the substitution alone.)
        const body = 'Strength of Body (Skinwalker; Wereboar-Kin)';
        expect(
          scored(body, { strength: 16, constitution: 10 })('save.fort'),
        ).toBe(0);
        expect(
          scored(body, { strength: 16, constitution: 10 })('save.fort', [0]),
        ).toBe(3);
        expect(
          scored(body, { strength: 8, constitution: 14 })('save.fort', [0]),
        ).toBe(0);
        // Alchemical Intuition adds the Charisma modifier (minimum 0) on one Craft
        // (alchemy) check.
        const intuition = 'Alchemical Intuition';
        expect(scored(intuition, { charisma: 14 })('skill.crf', [0])).toBe(2);
        expect(scored(intuition, { charisma: 6 })('skill.crf', [0])).toBe(0);
        expect(scored(intuition, { charisma: 14 })('skill.crf')).toBe(0);
        // Unmapped or targetless imported changes contribute nothing; reviewed
        // Modifiers supply the rule (Desperate Focus unconditionally, the others
        // under their Situation).
        expect(entry('Desperate Focus').unsupported).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'changes',
              value: expect.objectContaining({ target: 'concentration' }),
            }),
          ]),
        );
        expect(
          resolveSheet(modifiers('Desperate Focus')).concentration.total,
        ).toBe(2);
        for (const [name, target, label, value] of [
          ['Voice of Velvet (Human; Vudrani)', 'skill.prf', 'oratory', 1],
          ['Ear for Music (Shelyn)', 'skill.prf', 'Perform category', 1],
          [
            'Regional Influence - Korvosa (Varisia)',
            'skill.pro',
            'Profession',
            1,
          ],
          [
            'Regional Influence - Korvosa (Varisia)',
            'skill.dip',
            'Infernal',
            1,
          ],
          ['Best Friend (Jade Regent)', 'skill.dip', 'Ameiko', 2],
          ['Best Friend (Jade Regent)', 'skill.blf', 'Sandru', 2],
          ['Rising Star (War for the Crown)', 'skill.crf', 'Craft', 1],
          ['Persecuted Expatriate (Tiefling)', 'skill.klo', 'asura', 1],
          ['Persecuted Expatriate (Tiefling)', 'skill.sen', 'rakshasa', 1],
        ] as const) {
          expect(entry(name).unsupported, name).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'changes' }),
            ]),
          );
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(0);
          expect(
            resolveSheet(modifiers(name), {
              situations: [situation(name, indexOf(name, target, label))],
            })[target].total,
            name,
          ).toBe(value);
        }
        // Choices are one Situation per option.
        for (const [name, count] of [
          ['Persecuted Expatriate (Tiefling)', 10],
          ['Elemental Resilience (any elemental lord)', 4],
          ['Best Friend (Jade Regent)', 3],
        ] as const)
          expect(modifiers(name), name).toHaveLength(count);
        // Shared Situations where the body's condition matches exactly.
        const courage = resolveSheet(modifiers('Courageous'), {
          situations: ['fear'],
        });
        expect([
          courage['save.fort'].total,
          courage['save.ref'].total,
          courage['save.will'].total,
        ]).toEqual([2, 2, 2]);
        expect(
          resolveSheet(modifiers('Skeptic'), { situations: ['illusions'] })[
            'save.will'
          ].total,
        ).toBe(2);
        expect(
          resolveSheet(modifiers('Snake Handler (Osirion; Apep or Wadjet)'), {
            situations: ['poison'],
          })['save.fort'].total,
        ).toBe(2);
        expect(
          resolveSheet(modifiers('Adventurous Imbiber (Cayden Cailean)'), {
            situations: ['poison'],
          })['save.ref'].total,
        ).toBe(1);
        expect(
          resolveSheet(modifiers('Dirty Trickster'), {
            situations: ['dirtyTrick'],
          }).cmb.total,
        ).toBe(1);
        expect(
          resolveSheet(modifiers('Artifact Hunter (Giantslayer)'), {
            situations: ['identifyMagicItems'],
          })['skill.spl'].total,
        ).toBe(1);
        // Pillager's disarm and steal bonuses are trait bonuses of one entry.
        const pillager = modifiers('Pillager');
        expect(pillager.map((row) => row.condition?.situation)).toEqual([
          'disarm',
          'steal',
        ]);
        for (const situations of [['disarm'], ['steal'], ['disarm', 'steal']])
          expect(resolveSheet(pillager, { situations }).cmb.total).toBe(1);
        // Faith Unshakable's charm, compulsion and fear condition is one local
        // Situation, so the shared fear Situation leaves it out.
        expect(
          resolveSheet(modifiers('Faith Unshakable and Unassailable'), {
            situations: ['fear'],
          })['save.will'].total,
        ).toBe(0);
        // Foundry files these notes on attack rolls; the reviewed bonuses are on
        // damage (Exhibition Fighter: attack and damage).
        expect(
          modifiers('Superior Clutch (Tiefling; Hungerseed)').map(
            (row) => row.target,
          ),
        ).toEqual(['damage']);
        expect(
          modifiers('Exhibition Fighter (Lung Wa)').map((row) => row.target),
        ).toEqual(['attack', 'damage']);
      },
      () => {
        // Agent of the Sultana's attack bonus is only on confirmation rolls.
        expect(
          modifiers('Agent of the Sultana (Plane of Earth)')[
            indexOf(
              'Agent of the Sultana (Plane of Earth)',
              'attack',
              'fire subtype',
            )
          ]?.condition?.situation,
        ).toEqual({
          local:
            'to confirm critical hits against creatures with the fire subtype',
        });
        // Ecumenical's Foundry notes swap the two conditions; the reviewed
        // Modifiers follow the body.
        expect(
          modifiers('Ecumenical').map((row) => [
            row.target,
            JSON.stringify(row.condition?.situation),
          ]),
        ).toEqual([
          ['skill.dip', expect.stringContaining('to influence worshipers')],
          ['skill.kre', expect.stringContaining('involving entities')],
        ]);
        // Untyped bonuses stay untyped; Erutaki Sky Reader's is a luck bonus and
        // Rising Star's daily bonus a circumstance bonus.
        for (const name of [
          'Snake Handler (Osirion; Apep or Wadjet)',
          'Anuli Engineer (Anuli)',
          'Smuggler (The Exchange)',
          'Scion of the Shory (Mwangi Expanse)',
          'Exhibition Fighter (Lung Wa)',
          'Persecuted Expatriate (Tiefling)',
          'Loyal Bond (Grundinnar)',
          'Gifted Adept',
          'Strict Judgment (Kols)',
          "Balancer's Banishing",
        ])
          expect(
            new Set(modifiers(name).map((row) => row.bonusType)),
            name,
          ).toEqual(new Set(['untyped']));
        expect(
          modifiers('Erutaki Sky Reader (Crown of the World)').map((row) => [
            row.target,
            row.bonusType,
            row.value,
          ]),
        ).toEqual([['saves', 'luck', 2]]);
        expect(
          modifiers('Rising Star (War for the Crown)')
            .filter((row) => row.bonusType === 'circumstance')
            .map((row) => row.target),
        ).toEqual(['skill.blf', 'skill.dip', 'skill.int']);
        for (const [name, target] of [
          ['Strict Judgment (Kols)', 'spellDC'],
          ["Balancer's Banishing", 'spellDC'],
          ['Loyal Bond (Grundinnar)', 'casterLevel'],
        ] as const) {
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(0);
          expect(
            resolveSheet(modifiers(name), { situations: [situation(name, 0)] })[
              target
            ].total,
            name,
          ).toBe(1);
        }
        // Veteran of Battle's imported initiative change stays untyped, a listed
        // typing gap (the body grants a trait bonus).
        expect(
          modifiers('Veteran of Battle (Gorum)').map((row) => [
            row.target,
            row.bonusType,
            row.value,
          ]),
        ).toEqual([['init', 'untyped', 1]]);
        // The batch review's outstanding-calculation note on this gap is a review
        // record, not something the resolver computes, and is not checked here.
        // The drawbacks' penalties wait for their Situations; Lovesick's two
        // penalties share one Situation.
        const lovesick = 'Lovesick';
        const calm = resolveSheet(modifiers(lovesick));
        expect([calm.init.total, calm['skill.per'].total]).toEqual([0, 0]);
        const away = resolveSheet(modifiers(lovesick), {
          situations: [situation(lovesick, 0)],
        });
        expect([away.init.total, away['skill.per'].total]).toEqual([-2, -2]);
        const doubting = 'Self-Doubting';
        expect(resolveSheet(modifiers(doubting))['save.will'].total).toBe(0);
        expect(
          resolveSheet(modifiers(doubting), {
            situations: [
              situation(doubting, indexOf(doubting, 'save.will', 'Will')),
            ],
          })['save.will'].total,
        ).toBe(-2);
      },
      () => {
        // No reviewed armor, shield or natural armor bonus lands on ac.other (#734).
        for (const row of batchEntries)
          for (const modifier of row.modifiers)
            if (
              ['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType)
            )
              expect(modifier.target, row.name).not.toBe('ac.other');
      },
    ])
      checks();
  });
});

describe('the traits-377 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    traitSheet,
    total,
  } = traitBatch(entries, 'traits-377');
  // A sheet with the trait and set ability scores; the function it returns
  // gives the sheet's total on a target, with the Situations of the trait's
  // Modifiers at those indexes selected on its sheet entry.
  function scored(
    name: Parameters<typeof traitSheet>[0],
    scores: Partial<Record<keyof typeof abilityTargets, number>>,
  ) {
    return (target: string, situations: number[] = []) => {
      const sheet = traitSheet(name);
      const base = sheet.catalogEntries[0]!;
      base.modifiers = (base.modifiers ?? []).map((row) => {
        const hit = Object.entries(scores).find(
          ([ability]) =>
            abilityTargets[ability as keyof typeof abilityTargets] ===
            row.target,
        );
        return hit ? { ...row, value: hit[1] } : row;
      });
      return calculateCharacterSheetProjections(sheet, {
        situations: situations.map((index) =>
          situation(name, index, 'trait-row-0'),
        ),
      }).current.breakdowns[target as 'skill.per'].total;
    };
  }

  it("resolves the named traits' curated Modifiers, and two traits' trait bonuses on one statistic do not stack", () => {
    // The case runs its checks in order, in runs of a few, so that each
    // function stays within the lint's complexity limit.
    for (const checks of [
      () => {
        // Sky Quester and Azlanti Inheritor: two traits' +1 trait bonuses on
        // Knowledge (history) don't stack.
        for (const name of [
          'Sky Quester (Dwarf)',
          'Azlanti Inheritor (Human; Azlanti)',
        ] as const)
          expect(total(traitSheet(name), 'skill.khi'), name).toBe(1);
        expect(
          total(
            traitSheet(
              'Sky Quester (Dwarf)',
              'Azlanti Inheritor (Human; Azlanti)',
            ),
            'skill.khi',
          ),
        ).toBe(1);
        // A bonus that rises in a Situation is its new total.
        const negotiator = 'Planar Negotiator (The Abyss)';
        for (const target of ['skill.dip', 'skill.sen'] as const) {
          const step = situation(
            negotiator,
            indexOf(negotiator, target, 'your alignment"'),
          );
          const deity = situation(
            negotiator,
            indexOf(negotiator, target, 'same deity'),
          );
          expect(resolveSheet(modifiers(negotiator))[target].total).toBe(0);
          expect(
            resolveSheet(modifiers(negotiator), { situations: [step] })[target]
              .total,
          ).toBe(1);
          expect(
            resolveSheet(modifiers(negotiator), { situations: [step, deity] })[
              target
            ].total,
          ).toBe(2);
        }
        // Clever Wordplay uses the Intelligence modifier in place of the Charisma
        // modifier on the chosen skill, even when it is lower.
        const wordplay = 'Clever Wordplay';
        const bluff = indexOf(wordplay, 'skill.blf', 'Bluff');
        const swap = (scores: { intelligence: number; charisma: number }) =>
          scored(wordplay, scores)('skill.blf', [bluff]) -
          scored(wordplay, scores)('skill.blf');
        expect(swap({ intelligence: 16, charisma: 10 })).toBe(3);
        expect(swap({ intelligence: 8, charisma: 14 })).toBe(-3);
        expect(modifiers(wordplay)).toHaveLength(7);
        // Blessing of the Feast's natural armor bonus goes to its own AC leaf.
        const feast = 'Blessing of the Feast (Zura)';
        const fed = resolveSheet(modifiers(feast), {
          situations: [situation(feast, 0)],
        });
        expect([fed['ac.natural'].total, fed['ac.other'].total]).toEqual([
          1, 0,
        ]);
        expect(resolveSheet(modifiers(feast))['ac.natural'].total).toBe(0);
        // Targetless imported changes contribute nothing; reviewed Modifiers supply
        // the rule (Hwan Artist and The Thrush on the one Perform skill, the others
        // under their option's Situation).
        for (const name of ['Hwan Artist (Hwanggot)', 'The Thrush']) {
          expect(entry(name).unsupported, name).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'changes' }),
            ]),
          );
          expect(resolveSheet(modifiers(name))['skill.prf'].total, name).toBe(
            1,
          );
        }
        for (const [name, target, label, value] of [
          ['Framed (Curse of the Crimson Throne)', 'skill.spl', 'Dropout', 1],
          [
            'Framed (Curse of the Crimson Throne)',
            'skill.blf',
            'Family Honor',
            1,
          ],
          [
            'Unhappy Childhood (Curse of the Crimson Throne)',
            'concentration',
            'Religious',
            2,
          ],
          [
            'Unhappy Childhood (Curse of the Crimson Throne)',
            'save.ref',
            'Tortured',
            1,
          ],
          [
            'Half-Forgotten Secrets (Dhampir; Ajibachana)',
            'skill.kpl',
            'Knowledge (planes)',
            1,
          ],
          ['Knowing the Enemy', 'skill.kre', 'Knowledge (religion)', 1],
        ] as const) {
          expect(entry(name).unsupported, name).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'changes' }),
            ]),
          );
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(0);
          expect(
            resolveSheet(modifiers(name), {
              situations: [situation(name, indexOf(name, target, label))],
            })[target].total,
            name,
          ).toBe(value);
        }
        // Choices are one Situation per option.
        for (const [name, count] of [
          ['Framed (Curse of the Crimson Throne)', 2],
          ['Half-Forgotten Secrets (Dhampir; Ajibachana)', 10],
          ['Knowing the Enemy', 10],
          ['Collector (Gnome)', 5],
        ] as const)
          expect(modifiers(name), name).toHaveLength(count);
        // Bodies with no change or note: the reviewed Modifiers supply the bonus.
        const reformer = resolveSheet(
          modifiers('Young Reformer (War for the Crown)'),
        );
        expect([
          reformer['skill.dev'].total,
          reformer['skill.klo'].total,
        ]).toEqual([1, 1]);
        for (const [name, target, value] of [
          ['Bloodthirsty', 'damage.melee', 1],
          ['Slave Taker (Okeno)', 'damage.ranged', 1],
          ['Dockside Avenger (Curse of the Crimson Throne)', 'hp', 3],
        ] as const) {
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(0);
          expect(
            resolveSheet(modifiers(name), { situations: [situation(name, 0)] })[
              target
            ].total,
            name,
          ).toBe(value);
        }
        // Shared Situations where the body's condition matches exactly.
        for (const name of [
          'Sky Spirit Worshiper (Shanguang)',
          "The Lawbringer (Tyrant's Grasp)",
        ]) {
          const fear = resolveSheet(modifiers(name), { situations: ['fear'] });
          expect(
            [
              fear['save.fort'].total,
              fear['save.ref'].total,
              fear['save.will'].total,
            ],
            name,
          ).toEqual([2, 2, 2]);
        }
        expect(
          resolveSheet(modifiers('The Follower'), { situations: ['death'] })[
            'save.fort'
          ].total,
        ).toBe(2);
        // Repulsive's overrun and reposition bonuses are trait bonuses of one entry.
        const repulsive = modifiers('Repulsive (Tiefling; Foulspawn)');
        expect(repulsive.map((row) => row.condition?.situation)).toEqual([
          'overrun',
          'reposition',
        ]);
        for (const situations of [
          ['overrun'],
          ['reposition'],
          ['overrun', 'reposition'],
        ])
          expect(resolveSheet(repulsive, { situations }).cmb.total).toBe(1);
      },
      () => {
        // Conditions narrower or wider than a shared Situation stay local.
        for (const [name, shared, target] of [
          ['Disillusioned', 'fear', 'save.will'],
          ['Scourge of the Darkness', 'fear', 'save.will'],
          ['Deadly Rush (Tiefling; Pitborn)', 'charging', 'attack.melee'],
        ] as const)
          expect(
            resolveSheet(modifiers(name), { situations: [shared] })[target]
              .total,
            name,
          ).toBe(0);
        // Foundry files these notes on attack rolls; the reviewed bonuses are on
        // damage (Punish Insurrection and Zealous: attack and damage; Sword Scion:
        // attack and combat maneuvers).
        for (const [name, targets] of [
          ['Fierce Flanker (Wyvaran)', ['damage']],
          ['Subject of Study (Carrion Crown)', ['damage']],
          ['Obari Veteran', ['skill.pro', 'damage.melee', 'damage.ranged']],
          ['Punish Insurrection', ['attack', 'damage']],
          ['Zealous (Drawback)', ['attack', 'damage']],
          ['Sword Scion (Kingmaker)', ['attack', 'cmb']],
        ] as const)
          expect(
            modifiers(name)
              .map((row) => row.target)
              .sort(),
            name,
          ).toEqual([...targets].sort());
        // Same-text local Situations on one entry select together: Zealous's
        // attack penalty and damage bonus, and Vain's penalty on every
        // Charisma-based skill.
        const zealous = 'Zealous (Drawback)';
        const crusade = resolveSheet(modifiers(zealous), {
          situations: [situation(zealous, 0)],
        });
        expect([
          crusade['attack.melee'].total,
          crusade['damage.melee'].total,
        ]).toEqual([-5, 2]);
        const vain = 'Vain';
        expect(resolveSheet(modifiers(vain))['skill.blf'].total).toBe(0);
        const spurned = resolveSheet(modifiers(vain), {
          situations: [situation(vain, 0)],
        });
        for (const target of [
          'skill.blf',
          'skill.dip',
          'skill.dis',
          'skill.han',
          'skill.int',
          'skill.prf',
          'skill.umd',
        ] as const)
          expect(spurned[target].total, target).toBe(-2);
        // Foul Brand (Hand)'s imported penalties apply as published.
        const brand = resolveSheet(modifiers('Foul Brand (Hand)'));
        expect([
          brand['skill.dev'].total,
          brand['skill.dis'].total,
          brand['skill.slt'].total,
          brand['skill.blf'].total,
        ]).toEqual([-1, -1, -1, 0]);
        // Untyped bonuses stay untyped, as published.
        for (const name of [
          'Eastern Mysteries (Qadira Faction)',
          'Enduring Spellcraft (Human; Azlanti)',
          'Dark Magic Affinity (Tiefling)',
          'Unhappy Childhood (Curse of the Crimson Throne)',
          'Slave Taker (Okeno)',
          'Subject of Study (Carrion Crown)',
          'The Follower',
          'The Thrush',
          'Clever Wordplay',
        ])
          expect(
            new Set(modifiers(name).map((row) => row.bonusType)),
            name,
          ).toEqual(new Set(['untyped']));
        for (const [name, target, value] of [
          ['Eastern Mysteries (Qadira Faction)', 'spellDC', 2],
          ['Enduring Spellcraft (Human; Azlanti)', 'casterLevel', 1],
          ['Dark Magic Affinity (Tiefling)', 'casterLevel', 1],
        ] as const) {
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(0);
          expect(
            resolveSheet(modifiers(name), { situations: [situation(name, 0)] })[
              target
            ].total,
            name,
          ).toBe(value);
        }
        // Mathematical Prodigy's imported changes keep the trait bonus type where
        // the pinned body reads "a +1 bonus", a listed typing gap.
        expect(
          modifiers('Mathematical Prodigy').map((row) => [
            row.target,
            row.bonusType,
            row.value,
          ]),
        ).toEqual([
          ['skill.kar', 'trait', 1],
          ['skill.ken', 'trait', 1],
        ]);
        // The batch review's outstanding-calculation note on this gap is a review
        // record, not something the resolver computes, and is not checked here.
        // Monastic's and Battlefield Caster's trait bonuses to AC are on the other
        // AC leaf, under their Situations.
        for (const name of [
          'Monastic',
          'Battlefield Caster (Angradd, Gorum, Torag, Trudd)',
        ]) {
          const index = indexOf(name, 'ac', '');
          expect(
            resolveSheet(modifiers(name), {
              situations: [situation(name, index)],
            })['ac.other'].total,
            name,
          ).toBe(1);
        }
      },
      () => {
        // No reviewed armor, shield or natural armor bonus lands on ac.other (#734).
        for (const row of batchEntries)
          for (const modifier of row.modifiers)
            if (
              ['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType)
            )
              expect(modifier.target, row.name).not.toBe('ac.other');
      },
    ])
      checks();
  });
});

describe('the traits-378 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    traitSheet,
    total,
  } = traitBatch(entries, 'traits-378');
  // A sheet with the trait and set ability scores; the function it returns
  // gives the sheet's total on a target, with the Situations of the trait's
  // Modifiers at those indexes selected on its sheet entry.
  function scored(
    name: Parameters<typeof traitSheet>[0],
    scores: Partial<Record<keyof typeof abilityTargets, number>>,
  ) {
    return (target: string, situations: number[] = []) => {
      const sheet = traitSheet(name);
      const base = sheet.catalogEntries[0]!;
      base.modifiers = (base.modifiers ?? []).map((row) => {
        const hit = Object.entries(scores).find(
          ([ability]) =>
            abilityTargets[ability as keyof typeof abilityTargets] ===
            row.target,
        );
        return hit ? { ...row, value: hit[1] } : row;
      });
      return calculateCharacterSheetProjections(sheet, {
        situations: situations.map((index) =>
          situation(name, index, 'trait-row-0'),
        ),
      }).current.breakdowns[target as 'skill.per'].total;
    };
  }

  it("resolves the named traits' curated Modifiers, and two traits' trait bonuses on one statistic do not stack", () => {
    // The case runs its checks in order, in runs of a few, so that each
    // function stays within the lint's complexity limit.
    for (const checks of [
      () => {
        // Poverty-Stricken and Deep Marker: two traits' +1 trait bonuses on
        // Survival don't stack.
        for (const name of ['Poverty-Stricken', 'Deep Marker (Dwarf)'] as const)
          expect(total(traitSheet(name), 'skill.sur'), name).toBe(1);
        expect(
          total(
            traitSheet('Poverty-Stricken', 'Deep Marker (Dwarf)'),
            'skill.sur',
          ),
        ).toBe(1);
        // Ability-modifier formulas: Animal Rustler adds the Strength modifier on
        // one Handle Animal check, The Flexing Arm uses Strength in place of
        // Dexterity to escape bonds, Brevoy Bandit adds the chosen ability's
        // modifier on Profession.
        const rustler = 'Animal Rustler (Orc)';
        const handle = (strength: number) =>
          scored(rustler, { strength })('skill.han', [0]) -
          scored(rustler, { strength })('skill.han');
        expect(handle(16)).toBe(3);
        expect(handle(8)).toBe(-1);
        const arm = 'The Flexing Arm (Kurgess)';
        const bonds = indexOf(arm, 'skill.esc', 'bondage"');
        const strength = indexOf(arm, 'skill.esc', 'Strength instead');
        expect(
          scored(arm, { strength: 16, dexterity: 10 })('skill.esc', [bonds]) -
            scored(arm, { strength: 16, dexterity: 10 })('skill.esc'),
        ).toBe(1);
        expect(
          scored(arm, { strength: 16, dexterity: 10 })('skill.esc', [
            bonds,
            strength,
          ]) - scored(arm, { strength: 16, dexterity: 10 })('skill.esc'),
        ).toBe(4);
        const bandit = 'Brevoy Bandit (Mivon)';
        expect(modifiers(bandit)).toHaveLength(5);
        const charisma = indexOf(bandit, 'skill.pro', 'Charisma');
        expect(
          scored(bandit, { charisma: 14 })('skill.pro', [charisma]) -
            scored(bandit, { charisma: 14 })('skill.pro'),
        ).toBe(2);
        // The imported concentration changes don't map; reviewed Modifiers supply
        // them.
        for (const [name, value] of [
          ['Abendego Spellpiercer (the Sodden Lands)', 2],
          ['Prismati Player (Andoran)', 1],
          ['Methodical Mind (Strange Aeons)', 1],
        ] as const) {
          expect(entry(name).unsupported, name).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                field: 'changes',
                value: expect.objectContaining({ target: 'concentration' }),
              }),
            ]),
          );
          expect(resolveSheet(modifiers(name)).concentration.total, name).toBe(
            value,
          );
        }
        expect(
          total(
            traitSheet('Abendego Spellpiercer (the Sodden Lands)'),
            'concentration',
          ),
        ).toBe(2);
        // Targetless imported changes contribute nothing; reviewed Modifiers supply
        // the rule under their option's Situation.
        for (const [name, target, label, value] of [
          ['Tattooed Focus (Human; Varisian)', 'skill.pro', 'Profession', 2],
          [
            "Teacher's Pet (Carrion Crown)",
            'skill.kre',
            'Knowledge (religion)',
            2,
          ],
          ['Shoanti Tribesman (Varisia)', 'skill.swm', 'Swim', 1],
          [
            'Love Lost (Curse of the Crimson Throne)',
            'skill.int',
            'All Alone',
            1,
          ],
          [
            'Love Lost (Curse of the Crimson Throne)',
            'skill.sur',
            'Orphaned',
            1,
          ],
          ['Business Venturer (Ratfolk)', 'skill.pro', 'merchant', 1],
          ['Brewmaster (Dwarf)', 'skill.pro', 'brewer', 1],
          ['Brewmaster (Dwarf)', 'skill.crf', 'alchemy', 1],
          ["Folgrit's Bounty (Folgrit)", 'skill.pro', 'cook', 1],
          [
            'Methodical Mind (Strange Aeons)',
            'skill.kar',
            'Knowledge (arcana)',
            1,
          ],
        ] as const) {
          expect(entry(name).unsupported, name).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'changes' }),
            ]),
          );
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(0);
          expect(
            resolveSheet(modifiers(name), {
              situations: [situation(name, indexOf(name, target, label))],
            })[target].total,
            name,
          ).toBe(value);
        }
        // Choices are one Situation per option.
        for (const [name, count] of [
          ['Tattooed Focus (Human; Varisian)', 3],
          ["Teacher's Pet (Carrion Crown)", 10],
          ['Shoanti Tribesman (Varisia)', 3],
          ['Love Lost (Curse of the Crimson Throne)', 2],
          ['Methodical Mind (Strange Aeons)', 11],
          ['Heirloom Weapon', 2],
        ] as const)
          expect(modifiers(name), name).toHaveLength(count);
        // Zealous: the once-per-day +2 applies to attacks, saves and skills under
        // one label; the penalty afterwards to AC and saves under another.
        const zealous = 'Zealous (Human; Garundi)';
        const boost = resolveSheet(modifiers(zealous), {
          situations: [
            situation(zealous, indexOf(zealous, 'attack', 'once per day')),
          ],
        });
        expect([
          boost['attack.melee'].total,
          boost['save.will'].total,
          boost['skill.acr'].total,
          boost['ac.other'].total,
        ]).toEqual([2, 2, 2, 0]);
        const after = resolveSheet(modifiers(zealous), {
          situations: [situation(zealous, indexOf(zealous, 'ac', 'next turn'))],
        });
        expect([
          after['ac.other'].total,
          after['save.fort'].total,
          after['attack.melee'].total,
        ]).toEqual([-2, -2, 0]);
        // Selective Health: the disease bonus and the penalty against diseases
        // from undead or evil outsiders are separate Situations.
        const health = 'Selective Health (Aasimar)';
        for (const [label, value] of [
          ['not inflicted', 2],
          ['against a disease inflicted', -2],
        ] as const)
          expect(
            resolveSheet(modifiers(health), {
              situations: [
                situation(health, indexOf(health, 'save.fort', label)),
              ],
            })['save.fort'].total,
            label,
          ).toBe(value);
        // A bonus that rises in a Situation is its new total.
        for (const [name, target, low, high] of [
          [
            'Monument Scholar (Shattered Star)',
            'skill.khi',
            'in Varisia"',
            'Magnimar',
          ],
          ['Canon of Coin', 'save.will', 'character level"', 'discard'],
        ] as const) {
          const base = situation(name, indexOf(name, target, low));
          const more = situation(name, indexOf(name, target, high));
          expect(
            resolveSheet(modifiers(name), { situations: [base] })[target].total,
            name,
          ).toBe(1);
          expect(
            resolveSheet(modifiers(name), { situations: [base, more] })[target]
              .total,
            name,
          ).toBe(2);
        }
        // Shared Situations where the body's condition matches exactly.
        const forests = resolveSheet(modifiers('Guerrilla Tactics'), {
          situations: ['forests'],
        });
        expect([forests.init.total, forests['skill.ste'].total]).toEqual([
          2, 2,
        ]);
        expect(resolveSheet(modifiers('Guerrilla Tactics')).init.total).toBe(0);
        for (const [name, shared, target, value] of [
          ['Deep Marker (Dwarf)', 'fear', 'save.ref', 1],
          ["Wati Native (Mummy's Mask)", 'fear', 'save.will', 2],
          ['Infernal Influence (Human)', 'poison', 'save.fort', 1],
          ['Infernal Influence (Human)', 'poison', 'save.ref', 0],
          ['Seer of Reality (Irori)', 'illusions', 'save.will', 2],
        ] as const)
          expect(
            resolveSheet(modifiers(name), { situations: [shared] })[target]
              .total,
            `${name} ${target}`,
          ).toBe(value);
      },
      () => {
        // Conditions narrower or wider than a shared Situation stay local.
        for (const [name, shared, target] of [
          ['Whitethrone Gourmand (Irrisen)', 'poison', 'save.fort'],
          ['Insistent Benefactor', 'spellResistance', 'casterLevel'],
          ['Emissary (Varisia; Kaer Maga)', 'giants', 'skill.dip'],
          ['Disdainful Defender', 'spells', 'save.will'],
          ['Principled', 'mindAffecting', 'save.will'],
          ['Competitive', 'within30ft', 'skill.acr'],
        ] as const)
          expect(
            resolveSheet(modifiers(name), { situations: [shared] })[target]
              .total,
            name,
          ).toBe(0);
        // Foundry files these notes on attack rolls; the reviewed bonuses are on
        // damage (Strength of Submission and Dispelled Battler: attack and damage).
        for (const [name, targets] of [
          ['Drake Anatomist', ['damage', 'skill.kar']],
          ['Slayer of the Deep (Tian Xia Darklands)', ['damage']],
          ['Zealous Striker', ['damage']],
          ['Favored Prey (Ketephys)', ['damage.ranged']],
          ['Axe to Grind', ['damage.melee', 'damage.ranged']],
          ['Strength of Submission', ['attack', 'damage']],
          ['Dispelled Battler', ['attack', 'damage']],
        ] as const)
          expect(
            modifiers(name)
              .map((row) => row.target)
              .sort(),
            name,
          ).toEqual([...targets].sort());
        // Drake Anatomist's Knowledge (arcana) bonus follows the body (+2), not the
        // Foundry note's +1.
        const anatomist = 'Drake Anatomist';
        expect(
          resolveSheet(modifiers(anatomist), {
            situations: [
              situation(anatomist, indexOf(anatomist, 'skill.kar', '')),
            ],
          })['skill.kar'].total,
        ).toBe(2);
        // Same-text local Situations on one entry select together: Spiritual
        // Attachment's four social skills, Founders' Heritage's Charisma skills.
        const spirit = 'Spiritual Attachment';
        const possessed = resolveSheet(modifiers(spirit), {
          situations: [situation(spirit, indexOf(spirit, 'skill.blf', ''))],
        });
        expect(
          ['skill.blf', 'skill.dip', 'skill.int', 'skill.sen', 'skill.per'].map(
            (target) => possessed[target as 'skill.per'].total,
          ),
        ).toEqual([2, 2, 2, 2, 0]);
        const founders = "Founders' Heritage";
        const absalom = resolveSheet(modifiers(founders), {
          situations: [situation(founders, 0)],
        });
        for (const target of [
          'skill.blf',
          'skill.dip',
          'skill.dis',
          'skill.han',
          'skill.int',
          'skill.prf',
          'skill.umd',
        ] as const)
          expect(absalom[target].total, target).toBe(1);
        // Untyped bonuses and penalties stay untyped, as published.
        for (const name of [
          'Swamp Survivor (Ustalav)',
          'Giant Dodger (Desert)',
          'Chelish Sympathizer',
          'Low Blow',
          'Shaper of Reality (any Eldest)',
          'Animal Rustler (Orc)',
          'Brevoy Bandit (Mivon)',
          'Condescending',
          'Oppressive Expectations',
        ])
          expect(
            new Set(modifiers(name).map((row) => row.bonusType)),
            name,
          ).toEqual(new Set(['untyped']));
        for (const [name, target, value] of [
          ['Shaper of Reality (any Eldest)', 'casterLevel', 1],
          ['Low Blow', 'casterLevel', 1],
          ['Insistent Benefactor', 'spellDC', 2],
          ['Charming', 'spellDC', 1],
        ] as const) {
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(0);
          expect(
            resolveSheet(modifiers(name), {
              situations: [situation(name, indexOf(name, target, ''))],
            })[target].total,
            name,
          ).toBe(value);
        }
        // Keeper of the Veil's bonuses are competence bonuses, as published.
        expect(
          modifiers('Keeper of the Veil (Qadira)').map((row) => [
            row.target,
            row.bonusType,
            row.value,
          ]),
        ).toEqual([
          ['skill.blf', 'competence', 1],
          ['skill.dis', 'competence', 1],
        ]);
        // Poverty-Stricken's imported change keeps the trait bonus type where the
        // pinned body reads "a +1 bonus", a listed typing gap.
        expect(
          modifiers('Poverty-Stricken').map((row) => [
            row.target,
            row.bonusType,
            row.value,
          ]),
        ).toEqual([['skill.sur', 'trait', 1]]);
        // The batch review's outstanding-calculation note on this gap is a review
        // record, not something the resolver computes, and is not checked here.
        // Expert Swimmer keeps the body's +1, not PCGen's encoded +2.
        expect(
          resolveSheet(modifiers('Expert Swimmer (River Kingdoms)'))[
            'skill.swm'
          ].total,
        ).toBe(1);
        // Trait bonuses to AC are on the other AC leaf, under their Situations.
        for (const name of [
          'Tough Skin (Tiefling; Beastbrood)',
          'Fey Protection',
        ]) {
          const index = indexOf(name, 'ac', '');
          expect(
            resolveSheet(modifiers(name), {
              situations: [situation(name, index)],
            })['ac.other'].total,
            name,
          ).toBe(1);
        }
      },
      () => {
        // No reviewed armor, shield or natural armor bonus lands on ac.other (#734).
        for (const row of batchEntries)
          for (const modifier of row.modifiers)
            if (
              ['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType)
            )
              expect(modifier.target, row.name).not.toBe('ac.other');
      },
    ])
      checks();
  });
});

describe('the traits-379 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    traitSheet,
    total,
  } = traitBatch(entries, 'traits-379');
  const dexSkills = [
    'skill.acr',
    'skill.dev',
    'skill.esc',
    'skill.fly',
    'skill.rid',
    'skill.slt',
    'skill.ste',
  ];

  it("resolves the named traits' curated Modifiers, and two traits' trait bonuses on one statistic do not stack", () => {
    // The case runs its checks in order, in runs of a few, so that each
    // function stays within the lint's complexity limit.
    for (const checks of [
      () => {
        // Trait bonuses from different traits on one skill never stack; the higher
        // one counts.
        for (const name of [
          'Holy Schemer (Calistria)',
          'Self-Aware (Vampire; Vetala)',
        ] as const)
          expect(total(traitSheet(name), 'skill.sen'), name).toBe(1);
        expect(
          total(
            traitSheet(
              'Holy Schemer (Calistria)',
              'Self-Aware (Vampire; Vetala)',
            ),
            'skill.sen',
          ),
        ).toBe(1);
        expect(
          total(
            traitSheet('Holy Schemer (Calistria)', 'Insular (Dwarf)'),
            'skill.sen',
          ),
        ).toBe(2);
        // Practiced Gambler's gambling bonus is the new total: +2, not +3.
        const gambler = 'Practiced Gambler (Human; Varisian)';
        for (const target of ['skill.blf', 'skill.slt'] as const) {
          expect(resolveSheet(modifiers(gambler))[target].total, target).toBe(
            1,
          );
          expect(
            resolveSheet(modifiers(gambler), {
              situations: [
                situation(gambler, indexOf(gambler, target, 'gambling')),
              ],
            })[target].total,
            target,
          ).toBe(2);
        }
        // Meticulous carries the Misbegotten body: an untyped -2 on every
        // Dexterity-based skill, which stacks with Rapscallion's +1 trait bonus.
        expect(modifiers('Meticulous').map((row) => row.target)).toEqual(
          dexSkills,
        );
        for (const target of dexSkills)
          expect(total(traitSheet('Meticulous'), target), target).toBe(-2);
        expect(
          total(traitSheet('Meticulous', 'Rapscallion (Gnome)'), 'skill.esc'),
        ).toBe(-1);
        expect(total(traitSheet('Rapscallion (Gnome)'), 'init')).toBe(1);
        // Imported changes with no sheet target contribute nothing; reviewed
        // Modifiers supply the rule.
        for (const [name, target, value, conditioned] of [
          ['Harvester', 'skill.pro', 1, true],
          ['Bitter Heart (Changeling)', 'attack.melee', 2, true],
          ['Meticulous', 'skill.ste', -2, false],
        ] as const) {
          expect(entry(name).unsupported, name).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'changes' }),
            ]),
          );
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(
            conditioned ? 0 : value,
          );
          if (conditioned)
            expect(
              resolveSheet(modifiers(name), {
                situations: [situation(name, 0)],
              })[target].total,
              name,
            ).toBe(value);
        }
        expect(entry('Sargavan Guard (Sargava)').modifiers).toEqual([]);
        // Choices and per-skill rules are one Situation per skill.
        for (const [name, count] of [
          ['Genie Heir (Geniekin)', 7],
          ['Outsea Native (River Kingdoms; Undine)', 10],
          ['Unlearned', 10],
          ['Strength of the Barghest (Hadregash)', 2],
        ] as const)
          expect(modifiers(name), name).toHaveLength(count);
        // Shared Situations only where the body's condition matches exactly; the
        // fear bonuses follow the stacking rules (trait bonuses don't stack, the
        // untyped one does).
        const child = 'Child of the Crusades (Mendev)';
        const offspring = 'Offspring of the Ascension (Osirion)';
        const unafraid = 'Unafraid (Ustalav)';
        for (const [names, target, value] of [
          [[child], 'save.fort', 2],
          [[offspring], 'save.will', 1],
          [[unafraid], 'save.ref', 2],
          [[child, offspring], 'save.will', 2],
          [[child, unafraid], 'save.will', 4],
        ] as const) {
          const rows = names.flatMap((name) => modifiers(name));
          expect(resolveSheet(rows)[target].total, names.join()).toBe(0);
          expect(
            resolveSheet(rows, { situations: ['fear'] })[target].total,
            names.join(),
          ).toBe(value);
        }
      },
      () => {
        for (const [name, key] of [
          ['Discerning Beliefs (Zi Ha)', 'illusions'],
          ['Darkblight Survivor (Nirmathas)', 'poison'],
          ['Wedded Bliss (Bolka)', 'enchantment'],
          ['Inoculated (Urgathoa)', 'poison'],
          ['Stabbing Spells', 'spellResistance'],
        ] as const) {
          const resolved = resolveSheet(modifiers(name), { situations: [key] });
          expect(
            [
              resolved['save.fort'].total,
              resolved['save.ref'].total,
              resolved['save.will'].total,
              resolved.casterLevel.total,
            ],
            name,
          ).toEqual([0, 0, 0, 0]);
        }
        // Foundry files these notes on other statistics; the reviewed Modifiers
        // land where the body puts them.
        for (const [name, targets] of [
          ['Mindlessly Cruel (Half-Orc, Orc)', ['damage']],
          ['Stabbing Spells', ['casterLevel']],
          ["Swordlord's Page (Brevoy)", ['attack']],
          ['Elemental Caller (Suli)', ['casterLevel']],
          ['Veils upon Veils (Sivanah)', ['casterLevel']],
          ['Mediator', ['skill.dip', 'spellDC']],
          ['Dervish (Qadira Faction)', ['ac']],
        ] as const)
          expect(
            modifiers(name).map((row) => row.target),
            name,
          ).toEqual(targets);
        const cruel = 'Mindlessly Cruel (Half-Orc, Orc)';
        const morale = resolveSheet(modifiers(cruel), {
          situations: [situation(cruel, 0)],
        });
        expect([
          morale['damage.melee'].total,
          morale['attack.melee'].total,
        ]).toEqual([1, 0]);
        const stabbing = resolveSheet(modifiers('Stabbing Spells'), {
          situations: [situation('Stabbing Spells', 0)],
        });
        expect([
          stabbing.casterLevel.total,
          stabbing['attack.melee'].total,
        ]).toEqual([2, 0]);
        // Dervish's dodge bonus lands on the other AC leaf under its Situation.
        const dervish = 'Dervish (Qadira Faction)';
        expect(
          resolveSheet(modifiers(dervish), {
            situations: [situation(dervish, 0)],
          })['ac.other'].total,
        ).toBe(1);
        // Zealot's Bearing: the bonus and the penalty exclude each other.
        const zealot = "Zealot's Bearing";
        const adherents = situation(
          zealot,
          indexOf(zealot, 'skill.dip', 'adherents'),
        );
        const others = situation(
          zealot,
          indexOf(zealot, 'skill.dip', 'not share'),
        );
        expect(JSON.stringify(others)).not.toContain(
          'when dealing with adherents of your faith',
        );
        for (const [situations, value] of [
          [[adherents], 2],
          [[others], -1],
        ] as const) {
          const resolved = resolveSheet(modifiers(zealot), {
            situations: [...situations],
          });
          expect(resolved['skill.dip'].total).toBe(value);
          expect(resolved['skill.int'].total).toBe(value);
        }
        // Untyped bonuses and penalties stay untyped, as published; Dervish's is a
        // dodge bonus. Ease of Faith's imported change keeps its trait type although
        // the body reads "a +1 bonus" (a listed gap).
        for (const name of [
          'Pretend Pirate (Andoran)',
          'Provincial',
          'Meticulous',
          'Infernal Bastard (Council of Thieves)',
          'Unafraid (Ustalav)',
          "Zealot's Bearing",
          "Swordlord's Page (Brevoy)",
          'Elemental Caller (Suli)',
          'Veils upon Veils (Sivanah)',
          'Less Effort',
          'Unlearned',
        ])
          expect(
            new Set(modifiers(name).map((row) => row.bonusType)),
            name,
          ).toEqual(new Set(['untyped']));
        expect(modifiers(dervish).map((row) => row.bonusType)).toEqual([
          'dodge',
        ]);
        expect(modifiers('Ease of Faith')).toEqual([
          expect.objectContaining({
            target: 'skill.dip',
            bonusType: 'trait',
            value: 1,
          }),
        ]);
        // The batch review's outstanding-calculation note on this gap is a review
        // record, not something the resolver computes, and is not checked here.
        // No reviewed armor, shield or natural armor bonus lands on ac.other (#734).
        for (const row of batchEntries)
          for (const modifier of row.modifiers)
            if (
              ['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType)
            )
              expect(modifier.target, row.name).not.toBe('ac.other');
      },
    ])
      checks();
  });
});

describe('the traits-380 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    traitSheet,
    total,
  } = traitBatch(entries, 'traits-380');
  // A base sheet with the given ability scores, for the formula Modifier.
  function withScores(
    sheet: ReturnType<typeof traitSheet>,
    scores: Partial<Record<'wis', number>>,
  ) {
    const [base, ...rest] = sheet.catalogEntries;
    return {
      ...sheet,
      catalogEntries: [
        {
          ...base!,
          modifiers: base!.modifiers.map((modifier) =>
            modifier.target === abilityTargets.wisdom &&
            scores.wis !== undefined
              ? { ...modifier, value: scores.wis }
              : modifier,
          ),
        },
        ...rest,
      ],
    };
  }

  const saves = (resolved: ReturnType<typeof resolveSheet>) => [
    resolved['save.fort'].total,
    resolved['save.ref'].total,
    resolved['save.will'].total,
  ];

  it("resolves the named traits' curated Modifiers, and two traits' trait bonuses on one statistic do not stack", () => {
    // The case runs its checks in order, in runs of a few, so that each
    // function stays within the lint's complexity limit.
    for (const checks of [
      () => {
        // Trait bonuses from different traits on one skill never stack.
        const devotee = "Devotee of the Old Gods (Mummy's Mask)";
        const traditionalist = 'Traditionalist (Faiths and Philosophies)';
        expect(total(traitSheet(devotee), 'skill.khi')).toBe(1);
        expect(total(traitSheet(devotee, traditionalist), 'skill.khi')).toBe(1);
        expect(total(traitSheet(devotee, traditionalist), 'skill.klo')).toBe(1);
        expect(
          total(traitSheet(devotee, 'Spirit Guide (Pharasma)'), 'skill.kre'),
        ).toBe(2);
        // A bonus that rises in a Situation is its new total: Faithful Arodenite's
        // +1 on Diplomacy becomes +3 with a follower of Aroden or Iomedae.
        const arodenite = 'Faithful Arodenite (Aroden)';
        expect(resolveSheet(modifiers(arodenite))['skill.dip'].total).toBe(1);
        expect(
          resolveSheet(modifiers(arodenite), {
            situations: [
              situation(arodenite, indexOf(arodenite, 'skill.dip', 'Iomedae')),
            ],
          })['skill.dip'].total,
        ).toBe(3);
        // Targetless imported changes contribute nothing; reviewed Modifiers supply
        // the rule: Perform (sing) and Profession (sailor) on the sheet's one
        // Perform and Profession skill, Rescued's Acrobatics under its Situation.
        for (const [name, target, value] of [
          ['Operatic (Human; Chelaxian)', 'skill.prf', 1],
          ['Belem Pirate (Minata)', 'skill.pro', 1],
          ['Ship Aptitude (The Shackles)', 'skill.pro', 1],
          ['Abendego Pilot (Eye of Abendego; Sylph)', 'skill.pro', 2],
        ] as const) {
          expect(entry(name).unsupported, name).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'changes' }),
            ]),
          );
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(value);
        }
        const rescued = 'Rescued (Jade Regent)';
        expect(resolveSheet(modifiers(rescued))['skill.acr'].total).toBe(0);
        expect(
          resolveSheet(modifiers(rescued), {
            situations: [
              situation(rescued, indexOf(rescued, 'skill.acr', 'Shalelu')),
            ],
          })['skill.acr'].total,
        ).toBe(1);
        // Choices are one Situation per option.
        for (const [name, count] of [
          ['Blight-Burned (Ironfang Invasion)', 2],
          ["Ex-Asmodean (Hell's Rebels)", 3],
          ["Binder's Blood", 7],
          ['Legalistic Liberation (Halfling; Molthune, Osirion)', 10],
          ['Information Overload', 10],
        ] as const)
          expect(modifiers(name), name).toHaveLength(count);
        const asmodean = "Ex-Asmodean (Hell's Rebels)";
        const weapon = resolveSheet(modifiers(asmodean), {
          situations: [
            situation(
              asmodean,
              indexOf(asmodean, 'damage', 'attack and damage'),
            ),
          ],
        });
        expect([
          weapon['damage.melee'].total,
          weapon['damage.ranged'].total,
        ]).toEqual([1, 1]);
        // Searing Beacon's precision damage is the Wisdom modifier, on melee damage
        // under its Situation: +2 with Wisdom 14.
        const beacon = 'Searing Beacon (Iomedae; Ozem)';
        const wise = withScores(traitSheet(beacon), { wis: 14 });
        expect(
          calculateCharacterSheetProjections(wise).current.breakdowns[
            'damage.melee'
          ].total,
        ).toBe(0);
        expect(
          calculateCharacterSheetProjections(wise, {
            situations: [situation(beacon, 0, 'trait-row-0')],
          }).current.breakdowns['damage.melee'].total,
        ).toBe(2);
        // Shared Situations only where the body's condition matches exactly.
        for (const [name, key, target, value] of [
          ['Inured to Death', 'death', 'save.will', 2],
          ['Jungle Resilience (Nagajor)', 'poison', 'save.fort', 2],
          ['Stoic Optimism (Desna)', 'fear', 'save.will', 2],
          ['Shadow Dealer (Ustalav)', 'fear', 'save.ref', 1],
          ['Making Good on Promises (Carrion Crown)', 'fear', 'save.fort', 2],
          ['Nature Worshiper', 'death', 'save.will', 1],
          ['Nature Worshiper', 'negativeEnergy', 'save.will', 1],
          ['Scheming Survivor (Drow)', 'poison', 'save.ref', 1],
          ['Big Boned (Tiefling; Hungerseed)', 'overrun', 'cmb', 1],
          ['Hot Headed (Ifrit)', 'charging', 'damage.melee', 1],
        ] as const)
          expect(
            resolveSheet(modifiers(name), { situations: [key] })[target].total,
            `${name} ${key}`,
          ).toBe(value);
        // Nature Worshiper's two Situations never add up.
        expect(
          resolveSheet(modifiers('Nature Worshiper'), {
            situations: ['death', 'negativeEnergy'],
          })['save.will'].total,
        ).toBe(1);
        for (const [name, key] of [
          ['Blight-Burned (Ironfang Invasion)', 'poison'],
          ['Smoke Resistant (Kobold)', 'poison'],
          ['Fey-Wise (Sevenarches)', 'spellLike'],
          ['Foe of the Strange (Strange Aeons)', 'spellLike'],
          ['Curse Queller (Osirion)', 'spells'],
          ['Free Spirit', 'spells'],
          ['Big Boned (Tiefling; Hungerseed)', 'trip'],
        ] as const) {
          const resolved = resolveSheet(modifiers(name), { situations: [key] });
          expect(
            [...saves(resolved), resolved.cmb.total, resolved.cmd.total],
            name,
          ).toEqual([0, 0, 0, 0, 0]);
        }
        // Foundry files these notes on other statistics; the reviewed Modifiers
        // land where the body puts them.
        for (const [name, targets] of [
          ['Shield Bearer (Human; Ulfen)', ['damage.melee']],
          ['Searing Beacon (Iomedae; Ozem)', ['damage.melee']],
          ['Hot Headed (Ifrit)', ['damage']],
          ['Cross-Disciplined', ['casterLevel']],
          ["Ex-Asmodean (Hell's Rebels)", ['attack', 'damage', 'spellDC']],
          ['Rude Songs (Goblin)', ['skill.prf']],
          ['Goblin Bravery (Goblin)', ['attack.melee']],
          ['Tarnished Halls Runner', ['ac', 'attack']],
          ['Influential (Sovereign Court)', ['skill.dip', 'spellDC']],
          ['Savanna Hunter', ['attack']],
        ] as const)
          expect(
            modifiers(name).map((row) => row.target),
            name,
          ).toEqual(targets);
        // Untyped bonuses and penalties stay untyped, as published; Tarnished Halls
        // Runner's AC bonus is a dodge bonus.
        for (const name of [
          'Aeromantic Affinity',
          'Shield Bearer (Human; Ulfen)',
          'Cross-Disciplined',
          'Oblivious',
          'Foul Brand (Face)',
          'Overprotective',
          'Rabble Rebel (Galt; Halfling)',
          'Information Overload',
          'Legalistic Liberation (Halfling; Molthune, Osirion)',
          'Influential (Sovereign Court)',
          'Searing Beacon (Iomedae; Ozem)',
          'Infamous',
          'Carrying Voice (Sylph)',
        ])
          expect(
            new Set(modifiers(name).map((row) => row.bonusType)),
            name,
          ).toEqual(new Set(['untyped']));
        expect(
          modifiers('Tarnished Halls Runner').map((row) => row.bonusType),
        ).toEqual(['dodge', 'trait']);
        expect(
          modifiers('Passionate Inertia').map((row) => [
            row.bonusType,
            row.value,
          ]),
        ).toEqual([
          ['trait', 2],
          ['untyped', -1],
        ]);
        // Drawback penalties: Oblivious's -2 on Sense Motive always applies and on
        // sight-based Perception under its Situation; Overprotective's and
        // Infamous's wait for theirs.
        const oblivious = 'Oblivious';
        expect(resolveSheet(modifiers(oblivious))['skill.sen'].total).toBe(-2);
        expect(resolveSheet(modifiers(oblivious))['skill.per'].total).toBe(0);
        expect(
          resolveSheet(modifiers(oblivious), {
            situations: [
              situation(oblivious, indexOf(oblivious, 'skill.per', 'sight')),
            ],
          })['skill.per'].total,
        ).toBe(-2);
      },
      () => {
        for (const [name, target, label, value] of [
          ['Overprotective', 'skill.acr', 'unconscious', -2],
          ['Infamous', 'skill.dip', 'law-abiding', -4],
        ] as const) {
          const index = indexOf(
            name,
            target === 'skill.acr' ? 'skills' : target,
            label,
          );
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(0);
          expect(
            resolveSheet(modifiers(name), {
              situations: [situation(name, index)],
            })[target].total,
            name,
          ).toBe(value);
        }
        // No reviewed armor, shield or natural armor bonus lands on ac.other (#734).
        for (const row of batchEntries)
          for (const modifier of row.modifiers)
            if (
              ['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType)
            )
              expect(modifier.target, row.name).not.toBe('ac.other');
      },
    ])
      checks();
  });
});

describe('the traits-381 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    traitSheet,
    total,
  } = traitBatch(entries, 'traits-381');
  // A base sheet with the given ability scores, for the Intelligence formula.
  function withScores(
    sheet: ReturnType<typeof traitSheet>,
    scores: Partial<Record<'int', number>>,
  ) {
    const [base, ...rest] = sheet.catalogEntries;
    return {
      ...sheet,
      catalogEntries: [
        {
          ...base!,
          modifiers: base!.modifiers.map((modifier) =>
            modifier.target === abilityTargets.intelligence &&
            scores.int !== undefined
              ? { ...modifier, value: scores.int }
              : modifier,
          ),
        },
        ...rest,
      ],
    };
  }

  const saves = (resolved: ReturnType<typeof resolveSheet>) => [
    resolved['save.fort'].total,
    resolved['save.ref'].total,
    resolved['save.will'].total,
  ];

  it("resolves the named traits' curated Modifiers, and two traits' trait bonuses on one statistic do not stack", () => {
    // The case runs its checks in order, in runs of a few, so that each
    // function stays within the lint's complexity limit.
    for (const checks of [
      () => {
        // Trait bonuses from different traits on one statistic never stack.
        const bloody = 'Bloody-Minded';
        const tough = "Local Tough (Hell's Vengeance)";
        const twitchy = 'Twitchy (Strange Aeons)';
        expect(total(traitSheet(bloody), 'skill.int')).toBe(1);
        expect(total(traitSheet(bloody, tough), 'skill.int')).toBe(1);
        expect(total(traitSheet(bloody), 'init')).toBe(1);
        expect(total(traitSheet(bloody, twitchy), 'init')).toBe(2);
        expect(total(traitSheet(twitchy), 'save.ref')).toBe(1);
        // Azlanti Scholar's record has no changes; the reviewed Modifiers supply
        // its three unconditional +1 trait bonuses.
        for (const target of ['skill.khi', 'skill.klo', 'skill.umd'])
          expect(
            total(traitSheet('Azlanti Scholar (Ruins of Azlant)'), target),
            target,
          ).toBe(1);
        // Soul-Searcher's Strength: the reviewed change replacement sets Foundry's
        // Fortitude +1 to 0, and the chosen save takes the +1 (#381).
        const soul = "Soul-Searcher's Strength (Rivethun)";
        expect(entry(soul).modifiers[0]).toEqual({
          target: 'save.fort',
          bonusType: 'trait',
          value: 0,
        });
        expect(saves(resolveSheet(modifiers(soul)))).toEqual([0, 0, 0]);
        for (const [label, totals] of [
          ['Fortitude', [1, 0, 0]],
          ['Reflex', [0, 1, 0]],
          ['Will', [0, 0, 1]],
        ] as const) {
          const target = {
            Fortitude: 'save.fort',
            Reflex: 'save.ref',
            Will: 'save.will',
          }[label];
          expect(
            saves(
              resolveSheet(modifiers(soul), {
                situations: [
                  situation(soul, indexOf(soul, target, `chose ${label}`)),
                ],
              }),
            ),
            label,
          ).toEqual(totals);
        }
        expect(total(traitSheet(soul), 'save.fort')).toBe(0);
      },
      () => {
        // Targetless or unmapped imported changes contribute nothing; reviewed
        // Modifiers supply the rule, under its Situation where it has one.
        for (const [name, target, value, conditional] of [
          ['Oenopion Alchemist (Nex)', 'skill.crf', 1, false],
          ['Savant (Kitharodian Academy)', 'skill.prf', 2, false],
          ['Regional Influence - Riddleport (Varisia)', 'skill.pro', 1, true],
          ['Expert Explorer (Ruins of Azlant)', 'skill.kna', 1, true],
          ['Alabaster Odalisque (Jalmeray)', 'skill.umd', 1, true],
          ['Style Sage', 'skill.khi', 1, true],
        ] as const) {
          expect(entry(name).unsupported, name).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'changes' }),
            ]),
          );
          const index = modifiers(name).findIndex(
            (row) => row.target === target && row.value === value,
          );
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(
            conditional ? 0 : value,
          );
          expect(
            resolveSheet(modifiers(name), {
              situations: conditional ? [situation(name, index)] : [],
            })[target].total,
            name,
          ).toBe(value);
        }
        expect(
          resolveSheet(modifiers('Regional Influence - Riddleport (Varisia)'))[
            'skill.swm'
          ].total,
        ).toBe(1);
        expect(
          resolveSheet(modifiers('Expert Explorer (Ruins of Azlant)'))[
            'skill.sur'
          ].total,
        ).toBe(1);
        // Haunting Regret: the unmapped concentration change becomes a reviewed
        // -2; the mind-affecting penalty uses the shared Situation.
        const regret = 'Haunting Regret';
        expect(entry(regret).unsupported).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'changes',
              value: expect.objectContaining({ target: 'concentration' }),
            }),
          ]),
        );
        expect(resolveSheet(modifiers(regret)).concentration.total).toBe(-2);
        expect(saves(resolveSheet(modifiers(regret)))).toEqual([0, 0, 0]);
        expect(
          saves(
            resolveSheet(modifiers(regret), { situations: ['mindAffecting'] }),
          ),
        ).toEqual([-2, -2, -2]);
        // Two penalties from the same body never add: the swarm penalty on
        // Fortitude is the same -2.
        expect(
          saves(
            resolveSheet(modifiers(regret), {
              situations: [
                'mindAffecting',
                situation(regret, indexOf(regret, 'save.fort', 'swarms')),
              ],
            }),
          ),
        ).toEqual([-2, -2, -2]);
      },
      () => {
        // Choices are one Situation per option.
        for (const [name, count] of [
          ['Expert Explorer (Ruins of Azlant)', 11],
          ['Alabaster Odalisque (Jalmeray)', 7],
          ['Style Sage', 3],
          ["Soul-Searcher's Strength (Rivethun)", 4],
          ['Storyteller (Lantern Lodge)', 10],
          ['Family Ties', 12],
        ] as const)
          expect(modifiers(name), name).toHaveLength(count);
        // Storyteller adds the Intelligence modifier plus 3 (minimum +1) on one
        // Knowledge check per scenario.
        const story = 'Storyteller (Lantern Lodge)';
        const scope = modifiers(story)[0]?.condition?.situation;
        if (!scope || typeof scope === 'string' || !('local' in scope))
          throw new Error('Expected a local Situation');
        for (const [int, value] of [
          [16, 6],
          [10, 3],
          [4, 1],
        ] as const) {
          const sheet = withScores(traitSheet(story), { int });
          const totals = calculateCharacterSheetProjections(sheet, {
            situations: [{ local: scope.local, sheetEntryId: 'trait-row-0' }],
          }).current.breakdowns;
          expect(
            totals['skill.khi'].total - Math.floor((int - 10) / 2),
            `${int}`,
          ).toBe(value);
          expect(total(sheet, 'skill.khi') - Math.floor((int - 10) / 2)).toBe(
            0,
          );
        }
      },
      () => {
        // Improvised Defense's +1 shield bonus goes to the shield leaf, never
        // ac.other (#734).
        const defense = 'Improvised Defense';
        const wielding = resolveSheet(modifiers(defense), {
          situations: [situation(defense, 0)],
        });
        expect(wielding['ac.shield'].total).toBe(1);
        expect(wielding['ac.other'].total).toBe(0);
        expect(resolveSheet(modifiers(defense))['ac.shield'].total).toBe(0);
        // Burned's two save penalties are one Situation, so they never add.
        const burned = 'Burned';
        expect(modifiers(burned).map((row) => row.target)).toEqual([
          'saves',
          'attack',
          'skills',
        ]);
        const near = resolveSheet(modifiers(burned), {
          situations: [
            situation(burned, 0),
            situation(burned, indexOf(burned, 'attack', 'adjacent')),
          ],
        });
        expect(saves(near)).toEqual([-1, -1, -1]);
        expect(near['attack.melee'].total).toBe(-1);
        expect(near['skill.acr'].total).toBe(-1);
        // A bonus that rises in a Situation is its new total: Orphaned by Giants'
        // +1 against giants is +2 to confirm a critical hit, not +3.
        const orphan = 'Orphaned by Giants (Giantslayer)';
        expect(
          resolveSheet(modifiers(orphan), { situations: ['giants'] })[
            'attack.melee'
          ].total,
        ).toBe(1);
        expect(
          resolveSheet(modifiers(orphan), {
            situations: [
              'giants',
              situation(orphan, indexOf(orphan, 'attack', 'confirm')),
            ],
          })['attack.melee'].total,
        ).toBe(2);
        // Shared Situations only where the body's condition matches exactly.
        for (const [name, key, target, value] of [
          ['Devilfish Diver (Ilizmagorti)', 'poison', 'save.fort', 2],
          [
            'Eagle Knight Recruit (Ruins of Azlant)',
            'mindAffecting',
            'save.will',
            1,
          ],
          ['Too Many Secrets', 'illusions', 'save.ref', -2],
          ['Dragon-Hunted', 'fear', 'save.will', 1],
        ] as const)
          expect(
            resolveSheet(modifiers(name), { situations: [key] })[target].total,
            name,
          ).toBe(value);
        for (const [name, key, target] of [
          ['Dragon-Hunted', 'fear', 'save.fort'],
          ['Final Embrace (Dhampir)', 'grapple', 'cmb'],
          ['Chain Master (Tiefling; Shackleborn)', 'trip', 'cmb'],
          ['Loyalty (Grand Lodge)', 'enchantment', 'save.will'],
          ["Strength's Fanfare (Kurgess)", 'grapple', 'cmb'],
        ] as const)
          expect(
            resolveSheet(modifiers(name), { situations: [key] })[target].total,
            `${name} ${key}`,
          ).toBe(0);
        // Too Many Secrets' imported -2 on Bluff always applies.
        expect(total(traitSheet('Too Many Secrets'), 'skill.blf')).toBe(-2);
        // Foundry files these notes on other statistics; the reviewed Modifiers
        // land where the body puts them.
        for (const [name, targets] of [
          ["Local Tough (Hell's Vengeance)", ['skill.int', 'damage']],
          ['Undead Slayer (Dhampir)', ['attack', 'damage']],
          ['Big Game Hunter (Realm of the Mammoth Lords)', ['damage']],
          [
            'Big Mouth (Half-Orc, Orc)',
            ['skill.blf', 'skill.int', 'skill.prf'],
          ],
          [
            "Strength's Fanfare (Kurgess)",
            ['skill.clm', 'skill.swm', 'cmb', 'cmd'],
          ],
          ['Honeyed Words (Grundinnar)', ['skill.dip', 'spellDC']],
        ] as const)
          expect(
            modifiers(name).map((row) => row.target),
            name,
          ).toEqual(targets);
      },
      () => {
        // Records with neither a change nor a note get description Modifiers.
        for (const [name, target, value] of [
          ['Firebug', 'attack', 1],
          ['Surprise Weapon', 'attack', 2],
          ['Unstuck (Uringen)', 'casterLevel', 2],
          ['Genie-Caller (Qadira)', 'casterLevel', 2],
          ['Tactician', 'attack', 2],
        ] as const) {
          const index = indexOf(name, target, '');
          expect(modifiers(name)[index]?.value, name).toBe(value);
          expect(
            resolveSheet(modifiers(name), {
              situations: [situation(name, index)],
            })[target === 'attack' ? 'attack.melee' : target].total,
            name,
          ).toBe(value);
        }
        // Untyped bonuses and penalties stay untyped, as published.
        for (const name of [
          'Entomophobe',
          'Burned',
          'Haunting Regret',
          'Family Ties',
          'Unstuck (Uringen)',
          'Genie-Caller (Qadira)',
        ])
          expect(
            new Set(modifiers(name).map((row) => row.bonusType)),
            name,
          ).toEqual(new Set(['untyped']));
      },
      () => {
        expect(modifiers('Improvised Defense')[0]?.bonusType).toBe('shield');
        // Family Ties' penalties wait for their Situation, and select together.
        const ties = 'Family Ties';
        expect(resolveSheet(modifiers(ties))['skill.dip'].total).toBe(0);
        const refused = resolveSheet(modifiers(ties), {
          situations: [situation(ties, 0)],
        });
        for (const target of [
          'skill.dip',
          'skill.sen',
          'skill.per',
          'skill.umd',
        ])
          expect(refused[target as 'skill.dip'].total, target).toBe(-2);
        expect(refused['skill.acr'].total).toBe(0);
      },
      () => {
        // No reviewed armor, shield or natural armor bonus lands on ac.other (#734).
        for (const row of batchEntries)
          for (const modifier of row.modifiers)
            if (
              ['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType)
            )
              expect(modifier.target, row.name).not.toBe('ac.other');
      },
    ])
      checks();
  });
});

describe('the traits-382 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    traitSheet,
    total,
  } = traitBatch(entries, 'traits-382');
  const saves = (resolved: ReturnType<typeof resolveSheet>) => [
    resolved['save.fort'].total,
    resolved['save.ref'].total,
    resolved['save.will'].total,
  ];

  it("resolves the named traits' curated Modifiers, and two traits' trait bonuses on one statistic do not stack", () => {
    // The case runs its checks in order, in runs of a few, so that each
    // function stays within the lint's complexity limit.
    for (const checks of [
      () => {
        // Trait bonuses from different traits on one statistic never stack.
        const chance = 'Chance Savior (Carrion Crown)';
        const lost = 'Time Lost (Return of the Runelords)';
        const firebrand = 'Westcrown Firebrand (Council of Thieves)';
        expect(total(traitSheet(chance), 'init')).toBe(2);
        expect(total(traitSheet(chance, lost), 'init')).toBe(2);
        expect(total(traitSheet(firebrand), 'init')).toBe(1);
        expect(total(traitSheet(chance, firebrand), 'init')).toBe(2);
        expect(total(traitSheet('Deft Dodger'), 'save.ref')).toBe(1);
        expect(total(traitSheet('Life of Toil'), 'save.fort')).toBe(1);
        // Targetless imported changes contribute nothing; reviewed Modifiers supply
        // the rule, under a Situation per option where the body offers a choice.
        for (const [name, target, value, conditional] of [
          ['Demented Inventor (Half-Orc, Orc)', 'skill.crf', 2, false],
          ['Eye of the Father (Torag)', 'skill.crf', 1, false],
          ['Intense Artist (Shelyn)', 'skill.prf', 1, false],
          ["Besmara's Blessing (Skull and Shackles)", 'skill.pro', 1, false],
          ['Trap Savvy (Darklands)', 'skill.crf', 1, false],
          ['Simple Disciple', 'skill.pro', 1, true],
          ['Resourceful (Ruins of Azlant)', 'skill.crf', 1, true],
          ["Jenivere Crew (Serpent's Skull)", 'skill.swm', 1, true],
          ['Observant (Grand Lodge)', 'skill.sen', 1, true],
        ] as const) {
          expect(entry(name).unsupported, name).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'changes' }),
            ]),
          );
          const index = modifiers(name).findIndex(
            (row) => row.target === target && row.value === value,
          );
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(
            conditional ? 0 : value,
          );
          expect(
            resolveSheet(modifiers(name), {
              situations: conditional ? [situation(name, index)] : [],
            })[target].total,
            name,
          ).toBe(value);
        }
        expect(total(traitSheet('Intense Artist (Shelyn)'), 'skill.prf')).toBe(
          1,
        );
        expect(
          total(traitSheet('Demented Inventor (Half-Orc, Orc)'), 'skill.crf'),
        ).toBe(2);
        // Choices are one Situation per option.
        for (const [name, count] of [
          ['Simple Disciple', 2],
          ['Resourceful (Ruins of Azlant)', 2],
          ["Jenivere Crew (Serpent's Skull)", 6],
          ['Observant (Grand Lodge)', 2],
          ['Glint-Tongued (Human; Ulfen)', 8],
        ] as const)
          expect(modifiers(name), name).toHaveLength(count);
        // Glint-Tongued's +1 on Charisma-based checks to impress Ulfen selects
        // together on every Charisma skill; its imported +2 on Intimidate stays.
        const glint = 'Glint-Tongued (Human; Ulfen)';
        const ulfen = resolveSheet(modifiers(glint), {
          situations: [situation(glint, indexOf(glint, 'skill.dip', 'Ulfen'))],
        });
        for (const target of ['skill.blf', 'skill.dip', 'skill.umd'] as const)
          expect(ulfen[target].total, target).toBe(1);
        expect(ulfen['skill.int'].total).toBe(2);
        // A bonus that rises in a Situation is its new total.
        for (const [name, target, base, label, risen] of [
          ['Winged Aloofness (Syrinx)', 'skill.fly', 2, 'altitude', 4],
          ['Animal Whisperer (Ironfang Invasion)', 'skill.han', 1, 'push', 5],
        ] as const) {
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(base);
          expect(
            resolveSheet(modifiers(name), {
              situations: [situation(name, indexOf(name, target, label))],
            })[target].total,
            name,
          ).toBe(risen);
        }
        const eagle = 'Black Eagle Recruit (Lambreth)';
        expect(saves(resolveSheet(modifiers(eagle)))).toEqual([0, 0, 0]);
        expect(
          saves(resolveSheet(modifiers(eagle), { situations: ['fear'] })),
        ).toEqual([1, 1, 1]);
        expect(
          saves(
            resolveSheet(modifiers(eagle), {
              situations: [
                'fear',
                situation(eagle, indexOf(eagle, 'saves', 'evil outsider')),
              ],
            }),
          ),
        ).toEqual([3, 3, 3]);
        const andoletta = "Andoletta's Consolation (Andoletta)";
        expect(
          saves(
            resolveSheet(modifiers(andoletta), {
              situations: [
                situation(andoletta, indexOf(andoletta, 'saves', 'emotion')),
                situation(
                  andoletta,
                  indexOf(andoletta, 'saves', 'immune to fear'),
                ),
              ],
            }),
          ),
        ).toEqual([4, 4, 4]);
      },
      () => {
        // Shared Situations only where the body's condition matches exactly.
        for (const [name, key, target, value] of [
          ['Intrepid Delver (Jinin)', 'fear', 'save.will', 2],
          ['Reincarnated', 'death', 'save.fort', 2],
          ["The Optimist (Tyrant's Grasp)", 'mindAffecting', 'save.will', 1],
          ['Shoanti Tattoo (Human; Shoanti)', 'fear', 'save.ref', 1],
          ["Andoletta's Consolation (Andoletta)", 'fear', 'save.will', 2],
        ] as const)
          expect(
            resolveSheet(modifiers(name), { situations: [key] })[target].total,
            name,
          ).toBe(value);
        for (const [name, key, target] of [
          [
            'Demon-Proof Mind (Sarkoris, Worldwound)',
            'mindAffecting',
            'save.will',
          ],
          ['Malevolent Temptations', 'illusions', 'save.will'],
          ['Centaur Vengeance (Iobaria)', 'fear', 'save.will'],
          ['Eoxian Experiment (Eox)', 'spellLike', 'save.fort'],
          ['Hidden Faith', 'spells', 'save.will'],
        ] as const)
          expect(
            resolveSheet(modifiers(name), { situations: [key] })[target].total,
            `${name} ${key}`,
          ).toBe(0);
        // Foundry files these notes on other statistics; the reviewed Modifiers
        // land where the body puts them.
        for (const [name, targets] of [
          ['Hellknight Initiate', ['damage']],
          ['Vindictive (Taldor Faction)', ['damage']],
          ['Proud Progenitor (Vampire; Moroi)', ['damage']],
          ['Briar Bandit (Forest)', ['damage', 'skill.ste']],
          ['Trickster (Gnome)', ['casterLevel']],
          ['Vile Domain', ['casterLevel']],
          ['Medic (Shadow Lodge)', ['skill.hea', 'casterLevel']],
          ['Valknar Alumnus (Tymon)', ['cmb']],
        ] as const)
          expect(
            modifiers(name).map((row) => row.target),
            name,
          ).toEqual(targets);
        // Ironfang Survivor's +2 dodge bonus to AC against goblinoids and Trap
        // Savvy's untyped +1 against traps land on ac.other; no armor, shield or
        // natural armor bonus does (#734).
        const ironfang = 'Ironfang Survivor (Ironfang Invasion)';
        expect(modifiers(ironfang)[0]).toMatchObject({
          target: 'ac',
          bonusType: 'dodge',
          value: 2,
        });
        const goblinoids = resolveSheet(modifiers(ironfang), {
          situations: [situation(ironfang, 0)],
        });
        expect(goblinoids['ac.other'].total).toBe(2);
        expect(resolveSheet(modifiers(ironfang))['ac.other'].total).toBe(0);
        const traps = 'Trap Savvy (Darklands)';
        const trapped = resolveSheet(modifiers(traps), {
          situations: [
            situation(traps, indexOf(traps, 'ac', 'traps')),
            situation(traps, indexOf(traps, 'saves', 'traps')),
          ],
        });
        expect(trapped['ac.other'].total).toBe(1);
        expect(saves(trapped)).toEqual([1, 1, 1]);
        for (const row of batchEntries)
          for (const modifier of row.modifiers)
            if (
              ['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType)
            )
              expect(modifier.target, row.name).not.toBe('ac.other');
        // Untyped bonuses and penalties stay untyped, as published.
        for (const [name, target] of [
          ['Golden Scales (Kobold)', 'skill.blf'],
          ['Golden Scales (Kobold)', 'skill.dip'],
          ['Family Resemblance', 'skill.dis'],
          ['Centaur Vengeance (Iobaria)', 'saves'],
          ['Draconic Vigil (Lastwall)', 'init'],
          ['Frontier-Forged (Any Frontier)', 'skill.sur'],
          ['Medic (Shadow Lodge)', 'casterLevel'],
          ['Trap Savvy (Darklands)', 'ac'],
          ['Trap Savvy (Darklands)', 'saves'],
        ] as const)
          expect(
            new Set(
              modifiers(name)
                .filter((row) => row.target === target)
                .map((row) => row.bonusType),
            ),
            `${name} ${target}`,
          ).toEqual(new Set(['untyped']));
        // Golden Scales: -1 with kobolds, +2 with non-reptilian humanoids.
        const golden = 'Golden Scales (Kobold)';
        expect(
          resolveSheet(modifiers(golden), {
            situations: [
              situation(golden, indexOf(golden, 'skill.blf', 'kobolds')),
            ],
          })['skill.blf'].total,
        ).toBe(-1);
        expect(
          resolveSheet(modifiers(golden), {
            situations: [
              situation(golden, indexOf(golden, 'skill.dip', 'non-reptilian')),
            ],
          })['skill.dip'].total,
        ).toBe(2);
        // Family Resemblance's Disguise bonus and penalty wait for their own
        // Situations.
        const family = 'Family Resemblance';
        expect(resolveSheet(modifiers(family))['skill.dis'].total).toBe(0);
        expect(
          resolveSheet(modifiers(family), {
            situations: [
              situation(family, indexOf(family, 'skill.dis', 'not a')),
            ],
          })['skill.dis'].total,
        ).toBe(-2);
      },
      () => {
        // Taldan Patriot and River Trader keep the imported trait-typed +1 (the
        // untyped body is a listed stacking gap).
        for (const name of [
          'Taldan Patriot (War for the Crown)',
          'River Trader (Human; Mwangi)',
        ])
          expect(
            modifiers(name).map((row) => [row.bonusType, row.value]),
            name,
          ).toEqual([
            ['trait', 1],
            ['trait', 1],
          ]);
      },
    ])
      checks();
  });
});

describe('the traits-383 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    traitSheet,
    total,
  } = traitBatch(entries, 'traits-383');
  const saves = (resolved: ReturnType<typeof resolveSheet>) => [
    resolved['save.fort'].total,
    resolved['save.ref'].total,
    resolved['save.will'].total,
  ];

  it("resolves the named traits' curated Modifiers, and two traits' trait bonuses on one statistic do not stack", () => {
    // The case runs its checks in order, in runs of a few, so that each
    // function stays within the lint's complexity limit.
    for (const checks of [
      () => {
        // Trait bonuses from different traits on one statistic never stack.
        const instigator = 'Instigator of Rebellion (Minkai)';
        const friend = 'Friend in Every Town';
        expect(total(traitSheet(instigator), 'skill.dip')).toBe(1);
        expect(total(traitSheet(instigator, friend), 'skill.dip')).toBe(1);
        expect(total(traitSheet(instigator, friend), 'skill.int')).toBe(1);
        expect(total(traitSheet(instigator, friend), 'skill.klo')).toBe(1);
        expect(
          total(traitSheet('Guardian of the Forge (Torag)'), 'skill.ken'),
        ).toBe(1);
        // Vainglory's imported penalties apply; its illusion DC penalty waits.
        const vainglory = 'Vainglory';
        for (const target of ['skill.blf', 'skill.dis', 'skill.ste'])
          expect(total(traitSheet(vainglory), target), target).toBe(-1);
        expect(resolveSheet(modifiers(vainglory)).spellDC.total).toBe(0);
        expect(
          resolveSheet(modifiers(vainglory), {
            situations: [
              situation(vainglory, indexOf(vainglory, 'spellDC', 'illusions')),
            ],
          }).spellDC.total,
        ).toBe(-1);
        // Targetless imported changes contribute nothing; reviewed Modifiers supply
        // the rule, under a Situation per option where the body offers a choice.
        for (const [name, target, value, conditional] of [
          ['Trouper (Sczarni Faction)', 'skill.prf', 1, false],
          ["Ship's Surgeon (Skull and Shackles)", 'skill.crf', 1, false],
          ['Artistic Dilettante (Human; Taldan)', 'skill.crf', 1, false],
          ['Fiend Blood (Any)', 'skill.kpl', 1, true],
          ['Tongue of Many Towns (Human; Garundi)', 'skill.lin', 1, true],
          ['Militia Veteran (Any Town or Village)', 'skill.pro', 1, true],
          ['Drug Addict (Curse of the Crimson Throne)', 'save.fort', 1, true],
        ] as const) {
          expect(entry(name).unsupported, name).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'changes' }),
            ]),
          );
          const index = modifiers(name).findIndex(
            (row) => row.target === target && row.value === value,
          );
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(
            conditional ? 0 : value,
          );
          expect(
            resolveSheet(modifiers(name), {
              situations: conditional ? [situation(name, index)] : [],
            })[target].total,
            name,
          ).toBe(value);
        }
        expect(
          total(traitSheet('Trouper (Sczarni Faction)'), 'skill.prf'),
        ).toBe(1);
        expect(
          total(traitSheet('Artistic Dilettante (Human; Taldan)'), 'skill.crf'),
        ).toBe(1);
        // Choices are one Situation per option.
        for (const [name, count] of [
          ['Fiend Blood (Any)', 3],
          ['Tongue of Many Towns (Human; Garundi)', 3],
          ['Militia Veteran (Any Town or Village)', 3],
          ['Drug Addict (Curse of the Crimson Throne)', 2],
          ['Walking Ward (Qadira)', 4],
        ] as const)
          expect(modifiers(name), name).toHaveLength(count);
        // Drug Addict's Personal Addiction bonus is untyped, as published.
        expect(
          modifiers('Drug Addict (Curse of the Crimson Throne)').map((row) => [
            row.target,
            row.bonusType,
          ]),
        ).toEqual([
          ['skill.klo', 'trait'],
          ['save.fort', 'untyped'],
        ]);
        // Unmapped imported changes get reviewed Modifiers: Tireless's 1 hit point
        // (untypedPerm) and Occult Bargain's -1 on concentration.
        const tireless = 'Tireless (The Exchange)';
        expect(modifiers(tireless)).toEqual([
          expect.objectContaining({
            target: 'hp',
            bonusType: 'untyped',
            value: 1,
          }),
        ]);
        expect(resolveSheet(modifiers(tireless)).hp.total).toBe(1);
        expect(
          resolveSheet(modifiers('Occult Bargain')).concentration.total,
        ).toBe(-1);
        for (const name of [tireless, 'Occult Bargain'])
          expect(entry(name).unsupported, name).toEqual([
            expect.objectContaining({ field: 'changes' }),
          ]);
      },
      () => {
        // A bonus that rises in a Situation is its new total.
        for (const [name, target, base, label, risen] of [
          [
            'Open-Minded Explorer (Averaka)',
            'skill.dip',
            1,
            'racial or ethnic',
            2,
          ],
          ['Honest', 'skill.dip', 1, 'friendly or helpful', 2],
        ] as const) {
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(base);
          expect(
            resolveSheet(modifiers(name), {
              situations: [situation(name, indexOf(name, target, label))],
            })[target].total,
            name,
          ).toBe(risen);
        }
        // Good Influence's two +1 bonuses don't add within the entry; their stacked
        // +2 is its own Situation.
        const influence = 'Good Influence (Aasimar; Lawbringers)';
        const nongood = situation(
          influence,
          indexOf(influence, 'skill.dip', 'nongood creature'),
        );
        const nonlawful = situation(
          influence,
          indexOf(influence, 'skill.dip', 'nonlawful creature'),
        );
        const both = situation(
          influence,
          indexOf(influence, 'skill.dip', 'both bonuses stack'),
        );
        expect(
          resolveSheet(modifiers(influence), { situations: [nongood] })[
            'skill.dip'
          ].total,
        ).toBe(1);
        expect(
          resolveSheet(modifiers(influence), {
            situations: [nongood, nonlawful],
          })['skill.dip'].total,
        ).toBe(1);
        expect(
          resolveSheet(modifiers(influence), { situations: [both] })[
            'skill.dip'
          ].total,
        ).toBe(2);
        // Driven By Guilt's daily swift action reads the Charisma modifier (no
        // penalty) on attacks and the character level on damage.
        const guilt = 'Driven By Guilt (Strange Aeons)';
        expect(
          modifiers(guilt).map((row) => [row.target, row.bonusType, row.value]),
        ).toEqual([
          ['attack', 'untyped', { formula: 'max(0, @ability.cha.mod)' }],
          ['damage', 'untyped', { formula: '@level' }],
          ['saves', 'trait', 1],
        ]);
        const evil = situation(
          guilt,
          indexOf(guilt, 'attack', 'evil creatures'),
        );
        expect(
          resolveSheet(modifiers(guilt), { level: 5 })['damage.melee'].total,
        ).toBe(0);
        expect(
          resolveSheet(modifiers(guilt), { level: 5, situations: [evil] })[
            'damage.melee'
          ].total,
        ).toBe(5);
        expect(
          saves(
            resolveSheet(modifiers(guilt), {
              situations: [
                situation(guilt, indexOf(guilt, 'saves', 'evil creatures')),
              ],
            }),
          ),
        ).toEqual([1, 1, 1]);
        // Shared Situations only where the body's condition matches exactly.
        for (const [name, key, target, value] of [
          ["Resurrected (Mummy's Mask)", 'death', 'save.fort', 2],
          ['Secret Revolutionary (Cheliax)', 'mindAffecting', 'save.will', 1],
          ['Runaway Slave (Osirion, Thuvia, Darklands)', 'fear', 'save.ref', 1],
          ['Unflappable (Sovereign Court)', 'fear', 'save.will', 1],
        ] as const)
          expect(
            resolveSheet(modifiers(name), { situations: [key] })[target].total,
            name,
          ).toBe(value);
        for (const [name, key, target] of [
          ['Tribal (Half-Orc, Orc)', 'fear', 'save.will'],
          ['Secret Revolutionary (Cheliax)', 'poison', 'save.fort'],
          [
            'Triaxian Dragonslayer (Triaxian)',
            'spellResistance',
            'casterLevel',
          ],
          [
            'Regional Recluse - Sanos Forest or Whistledown (Varisia)',
            'forests',
            'skill.ste',
          ],
        ] as const)
          expect(
            resolveSheet(modifiers(name), { situations: [key] })[target].total,
            `${name} ${key}`,
          ).toBe(0);
        // Foundry files these notes on other statistics; the reviewed Modifiers
        // land where the body puts them.
        for (const [name, targets] of [
          ['Bellis Log Roller (Andoran; Bellis)', ['skill.acr', 'cmd']],
          ['Canopy Shooter (Grippli)', ['damage.ranged']],
          ['Divine Warrior (Iomedae)', ['damage.melee']],
          ['Tunnel Fighter (Dwarf)', ['damage', 'init']],
          ['Ash Bane (Wastelands)', ['save.fort', 'attack.melee']],
          ['Monk Weapon Skill', ['damage']],
        ] as const)
          expect(
            modifiers(name)
              .map((row) => row.target)
              .sort(),
            name,
          ).toEqual([...targets].sort());
        for (const row of batchEntries)
          for (const modifier of row.modifiers)
            if (
              ['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType)
            )
              expect(modifier.target, row.name).not.toBe('ac.other');
      },
      () => {
        // Untyped bonuses and penalties stay untyped, as published.
        for (const [name, target] of [
          ['Walking Ward (Qadira)', 'saves'],
          ['Water Lurker (Wayang)', 'skill.ste'],
          ['Sentimental', 'skill.per'],
          ['Sentimental', 'save.ref'],
          ['Failed Aspirant', 'cmb'],
          ['Shadow-Scarred', 'saves'],
          ['Explorer (Gnome)', 'skill.sur'],
          ['Overwhelming Beauty', 'spellDC'],
        ] as const)
          expect(
            new Set(
              modifiers(name)
                .filter((row) => row.target === target)
                .map((row) => row.bonusType),
            ),
            `${name} ${target}`,
          ).toEqual(new Set(['untyped']));
        // Official Ties: +2 with authorities, -2 with criminals, never together.
        const ties = 'Official Ties';
        expect(resolveSheet(modifiers(ties))['skill.dip'].total).toBe(0);
        expect(
          resolveSheet(modifiers(ties), {
            situations: [
              situation(ties, indexOf(ties, 'skill.dip', 'authority aware')),
            ],
          })['skill.dip'].total,
        ).toBe(2);
        expect(
          resolveSheet(modifiers(ties), {
            situations: [
              situation(ties, indexOf(ties, 'skill.dip', 'criminals')),
            ],
          })['skill.dip'].total,
        ).toBe(-2);
        // Assimilated Native's Intimidate bonus and Diplomacy penalty share one
        // Situation.
        const native = 'Assimilated Native (Human; Mwangi)';
        const mwangi = resolveSheet(modifiers(native), {
          situations: [
            situation(native, indexOf(native, 'skill.int', 'Mwangi')),
          ],
        });
        expect([mwangi['skill.int'].total, mwangi['skill.dip'].total]).toEqual([
          2, -2,
        ]);
        // Favored Son/Daughter and Whistleblower keep the imported change as it is
        // typed (listed stacking gaps).
        expect(
          modifiers('Favored Son/Daughter (Any Campaign)').map((row) => [
            row.target,
            row.bonusType,
            row.value,
          ]),
        ).toEqual([['skill.klo', 'profane', 1]]);
        expect(
          modifiers("Whistleblower (Liberty's Edge)").map((row) => [
            row.target,
            row.bonusType,
            row.value,
          ]),
        ).toEqual([['skill.sen', 'trait', 1]]);
      },
    ])
      checks();
  });
});

describe('the traits-384 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    traitSheet,
    total,
  } = traitBatch(entries, 'traits-384');
  const saves = (resolved: ReturnType<typeof resolveSheet>) => [
    resolved['save.fort'].total,
    resolved['save.ref'].total,
    resolved['save.will'].total,
  ];

  it("resolves the named traits' curated Modifiers, and two traits' trait bonuses on one statistic do not stack", () => {
    // The case runs its checks in order, in runs of a few, so that each
    // function stays within the lint's complexity limit.
    for (const checks of [
      () => {
        // Trait bonuses from different traits on one statistic never stack.
        const hotspur = 'Absalom Hotspur (Absalom)';
        const reactionary = 'Reactionary';
        expect(total(traitSheet(hotspur), 'init')).toBe(1);
        expect(total(traitSheet(reactionary), 'init')).toBe(2);
        expect(total(traitSheet(hotspur, reactionary), 'init')).toBe(2);
        expect(total(traitSheet(hotspur, reactionary), 'skill.klo')).toBe(1);
        // Anxious's imported -2 on Diplomacy always applies.
        expect(total(traitSheet('Anxious'), 'skill.dip')).toBe(-2);
        // Records with no change, or a targetless one, get reviewed Modifiers:
        // unconditional where the sheet has one skill for the choice, a Situation
        // per option otherwise.
        for (const [name, target, value, conditional] of [
          ["Merchant's Child (Katapesh)", 'skill.apr', 1, false],
          ['Indentured Blacksmith (Kaoling)', 'skill.crf', 1, false],
          ['Goblin Pirate (Goblin; The Shackles)', 'skill.pro', 1, false],
          ["Buccaneer's Blood (Skull and Shackles)", 'skill.pro', 1, false],
          ['Savanna Child (Plains)', 'skill.kna', 1, true],
          ["Audrahni's Ally (Return of the Runelords)", 'save.will', 1, true],
          ['Deathtouched (Any)', 'save.fort', 1, true],
        ] as const) {
          const index = modifiers(name).findIndex(
            (row) => row.target === target && row.value === value,
          );
          expect(index, name).toBeGreaterThanOrEqual(0);
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(
            conditional ? 0 : value,
          );
          expect(
            resolveSheet(modifiers(name), {
              situations: conditional ? [situation(name, index)] : [],
            })[target].total,
            name,
          ).toBe(value);
        }
        for (const name of [
          'Savanna Child (Plains)',
          'Indentured Blacksmith (Kaoling)',
          'Goblin Pirate (Goblin; The Shackles)',
          "Audrahni's Ally (Return of the Runelords)",
          'Deathtouched (Any)',
        ])
          expect(entry(name).unsupported, name).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'changes' }),
            ]),
          );
        expect(
          total(traitSheet("Merchant's Child (Katapesh)"), 'skill.apr'),
        ).toBe(1);
        expect(total(traitSheet('Savanna Child (Plains)'), 'skill.han')).toBe(
          0,
        );
        // Choices are one Situation per option.
        for (const [name, count] of [
          ['Savanna Child (Plains)', 3],
          ["Audrahni's Ally (Return of the Runelords)", 3],
          ['Deathtouched (Any)', 2],
        ] as const)
          expect(modifiers(name), name).toHaveLength(count);
        const audrahni = "Audrahni's Ally (Return of the Runelords)";
        expect(
          saves(
            resolveSheet(modifiers(audrahni), {
              situations: [
                situation(
                  audrahni,
                  indexOf(audrahni, 'save.ref', 'Where did you grow up'),
                ),
              ],
            }),
          ),
        ).toEqual([0, 1, 0]);
        // Deathtouched's mind-affecting choice covers every save.
        const deathtouched = 'Deathtouched (Any)';
        expect(
          saves(
            resolveSheet(modifiers(deathtouched), {
              situations: [
                situation(
                  deathtouched,
                  indexOf(deathtouched, 'saves', 'mind-affecting'),
                ),
              ],
            }),
          ),
        ).toEqual([2, 2, 2]);
        // A bonus that rises in a Situation is its new total.
        const heretic = "Heretic's Caution";
        expect(resolveSheet(modifiers(heretic))['skill.blf'].total).toBe(1);
        expect(
          resolveSheet(modifiers(heretic), {
            situations: [
              situation(
                heretic,
                indexOf(heretic, 'skill.blf', 'religious authorities'),
              ),
            ],
          })['skill.blf'].total,
        ).toBe(3);
        // Orc Impaler's +3 against orcs is the new total of its +2 on a charge.
        const impaler = 'Orc Impaler (Lastwall; Knight of Ozem)';
        const confirm = (indexes: number[]) =>
          resolveSheet(modifiers(impaler), {
            situations: indexes.map((index) => situation(impaler, index)),
          })['attack.melee'].total;
        expect(confirm([])).toBe(0);
        expect(confirm([indexOf(impaler, 'attack', 'charge')])).toBe(2);
        expect(confirm([0, 1])).toBe(3);
        // Untyped and other published bonus types keep their type.
        for (const [name, typed] of [
          [
            'Ruin Raider (Shattered Star)',
            ['skill.apr trait', 'skill.per untyped'],
          ],
          ['The Star Gazer', ['init untyped', 'ac luck']],
          ['Grim Optimism', ['saves morale']],
          ['Innocent (Aasimar)', ['skill.blf untyped']],
          ["Angradd's Flame (Angradd)", ['damage untyped']],
          ['Force for Good (Silver Crusade)', ['casterLevel untyped']],
          ['Evasive Sting', ['ac dodge']],
          ['Advantageous Distraction (Goblin)', ['ac dodge']],
          ['Cruelty', ['attack untyped']],
          [
            "Fed-Up Citizen (Hell's Rebels)",
            ['skill.dis untyped', 'saves trait'],
          ],
        ] as const)
          expect(
            modifiers(name).map((row) => `${row.target} ${row.bonusType}`),
            name,
          ).toEqual(typed);
        // Noble Born - Lodovka's imported Swim change stays untyped (a listed gap).
        expect(modifiers('Noble Born - Lodovka (Kingmaker)')).toEqual([
          expect.objectContaining({
            target: 'skill.swm',
            bonusType: 'untyped',
            value: 1,
          }),
        ]);
      },
      () => {
        // Shared Situations where the body's condition matches exactly.
        for (const [name, key] of [
          ['Greater Purpose', 'death'],
          ['Good-Natured (Cayden Cailean)', 'fear'],
          ["Fed-Up Citizen (Hell's Rebels)", 'mindAffecting'],
          ['Fangwood Insurgent (Nirmathas)', 'forests'],
        ] as const)
          expect(
            modifiers(name).filter((row) => row.condition?.situation === key),
            name,
          ).toHaveLength(1);
        expect(
          saves(
            resolveSheet(modifiers('Good-Natured (Cayden Cailean)'), {
              situations: ['fear'],
            }),
          ),
        ).toEqual([2, 2, 2]);
        expect(
          resolveSheet(modifiers('Fangwood Insurgent (Nirmathas)'), {
            situations: ['forests'],
          }).init.total,
        ).toBe(1);
        // Black Powder Fortune's fear bonus also needs a firearm: a local Situation.
        expect(
          modifiers('Black Powder Fortune').map(
            (row) => row.condition?.situation,
          ),
        ).toEqual([
          {
            local:
              'against curse, fear, and emotion effects, while you wield a firearm',
          },
        ]);
        // Siege Defender's bonus is on melee damage, not attack rolls.
        const siege = 'Siege Defender';
        expect(modifiers(siege).map((row) => row.target)).toEqual([
          'damage.melee',
        ]);
        expect(
          resolveSheet(modifiers(siege), { situations: [situation(siege, 0)] })[
            'damage.melee'
          ].total,
        ).toBe(1);
        // Pack Savvy's +3 applies to every Charisma-based skill under one Situation.
        const pack = 'Pack Savvy';
        const gnolls = resolveSheet(modifiers(pack), {
          situations: [situation(pack, 0)],
        });
        for (const target of [
          'skill.blf',
          'skill.dip',
          'skill.dis',
          'skill.han',
          'skill.int',
          'skill.prf',
          'skill.umd',
        ] as const)
          expect(gnolls[target].total, target).toBe(3);
        // The Star Gazer's surprise-round penalty is a Situation.
        const gazer = 'The Star Gazer';
        expect(resolveSheet(modifiers(gazer)).init.total).toBe(0);
        expect(
          resolveSheet(modifiers(gazer), {
            situations: [situation(gazer, indexOf(gazer, 'init', 'surprise'))],
          }).init.total,
        ).toBe(-2);
        // No reviewed armor, shield or natural armor bonus lands on ac.other (#734).
        for (const row of batchEntries)
          for (const modifier of row.modifiers)
            if (
              ['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType)
            )
              expect(modifier.target, row.name).not.toBe('ac.other');
      },
    ])
      checks();
  });
});

describe('the traits-385 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    traitSheet,
    total,
  } = traitBatch(entries, 'traits-385');
  // A sheet with the trait and set ability scores; the function it returns
  // gives the sheet's total on a target, with the Situations of the trait's
  // Modifiers at those indexes selected on its sheet entry.
  function scored(
    name: Parameters<typeof traitSheet>[0],
    scores: Partial<Record<keyof typeof abilityTargets, number>>,
  ) {
    return (target: string, situations: number[] = []) => {
      const sheet = traitSheet(name);
      const base = sheet.catalogEntries[0]!;
      base.modifiers = (base.modifiers ?? []).map((row) => {
        const hit = Object.entries(scores).find(
          ([ability]) =>
            abilityTargets[ability as keyof typeof abilityTargets] ===
            row.target,
        );
        return hit ? { ...row, value: hit[1] } : row;
      });
      return calculateCharacterSheetProjections(sheet, {
        situations: situations.map((index) =>
          situation(name, index, 'trait-row-0'),
        ),
      }).current.breakdowns[target as 'skill.per'].total;
    };
  }

  const saves = (resolved: ReturnType<typeof resolveSheet>) => [
    resolved['save.fort'].total,
    resolved['save.ref'].total,
    resolved['save.will'].total,
  ];

  it("resolves the named traits' curated Modifiers, and two traits' trait bonuses on one statistic do not stack", () => {
    // The case runs its checks in order, in runs of a few, so that each
    // function stays within the lint's complexity limit.
    for (const checks of [
      () => {
        // Trait bonuses from different traits on one statistic never stack.
        const smuggler = 'Undermarket Smuggler (Goka)';
        const advocate = 'Minkai Advocate (Minkai)';
        expect(total(traitSheet(smuggler), 'skill.blf')).toBe(1);
        expect(total(traitSheet(advocate), 'skill.blf')).toBe(1);
        expect(total(traitSheet(smuggler, advocate), 'skill.blf')).toBe(1);
        expect(total(traitSheet(smuggler, advocate), 'skill.slt')).toBe(1);
        // Brimstone Seer's unmapped -1 on Charisma-based checks is a reviewed
        // untyped penalty on every Charisma-based skill; it adds to a trait bonus.
        const seer = 'Brimstone Seer (Orc)';
        expect(entry(seer).unsupported).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ field: 'changes' }),
          ]),
        );
        for (const target of [
          'skill.blf',
          'skill.dip',
          'skill.dis',
          'skill.han',
          'skill.int',
          'skill.prf',
          'skill.umd',
        ] as const)
          expect(resolveSheet(modifiers(seer))[target].total, target).toBe(-1);
        expect(total(traitSheet(seer), 'skill.dip')).toBe(-1);
        expect(
          total(traitSheet(seer, "Tempter's Tongue (Tiefling)"), 'skill.dip'),
        ).toBe(0);
        // Records with no change, or a targetless one, get reviewed Modifiers:
        // unconditional where the sheet has one skill for the choice, a Situation
        // per option otherwise.
        for (const [name, target, value, conditional] of [
          ['Fixer of Odds (Second Darkness)', 'skill.pro', 1, false],
          ['Performance Artist (Taldor Faction)', 'skill.prf', 1, false],
          ['Conscientious Miner (Jinin)', 'skill.pro', 1, false],
          ['Antiquities Smuggler (Osirion)', 'skill.blf', 1, true],
          ['Bandit (River Kingdoms)', 'skill.ste', 1, true],
          ['Athletic (Ruins of Azlant)', 'skill.clm', 1, true],
          ["Lingshen's Finest (Lingshen)", 'attack.melee', 1, true],
          ['Nidalese Shadowcaster (Nidal)', 'casterLevel', 1, true],
        ] as const) {
          const index = modifiers(name).findIndex(
            (row) => target.startsWith(row.target) && row.value === value,
          );
          expect(index, name).toBeGreaterThanOrEqual(0);
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(
            conditional ? 0 : value,
          );
          expect(
            resolveSheet(modifiers(name), {
              situations: conditional ? [situation(name, index)] : [],
            })[target].total,
            name,
          ).toBe(value);
        }
        for (const name of [
          'Fixer of Odds (Second Darkness)',
          'Performance Artist (Taldor Faction)',
          'Conscientious Miner (Jinin)',
          'Antiquities Smuggler (Osirion)',
          'Bandit (River Kingdoms)',
          'Athletic (Ruins of Azlant)',
          "Lingshen's Finest (Lingshen)",
          'Efficient Packer (Gnome)',
        ])
          expect(entry(name).unsupported, name).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'changes' }),
            ]),
          );
        expect(
          total(traitSheet('Fixer of Odds (Second Darkness)'), 'skill.pro'),
        ).toBe(1);
        // Choices are one Situation per option.
        for (const [name, count] of [
          ['Antiquities Smuggler (Osirion)', 3],
          ['Bandit (River Kingdoms)', 3],
          ['Athletic (Ruins of Azlant)', 3],
          ['Affinity for the Elements (any Elemental Lord)', 4],
          ['Cunning Liar (Any City)', 2],
        ] as const)
          expect(modifiers(name), name).toHaveLength(count);
        // Cunning Liar uses the Intelligence or Wisdom modifier in place of the
        // Charisma modifier on Bluff, even when it is lower.
        const liar = 'Cunning Liar (Any City)';
        const swap = (
          ability: 'Intelligence' | 'Wisdom',
          scores: Partial<Record<keyof typeof abilityTargets, number>>,
        ) =>
          scored(liar, scores)('skill.blf', [
            indexOf(liar, 'skill.blf', ability),
          ]) - scored(liar, scores)('skill.blf');
        expect(swap('Intelligence', { intelligence: 16, charisma: 10 })).toBe(
          3,
        );
        expect(swap('Wisdom', { wisdom: 8, charisma: 14 })).toBe(-3);
        // Heedful Readiness adds the Wisdom modifier to one initiative check.
        const heedful = 'Heedful Readiness';
        expect(scored(heedful, { wisdom: 14 })('init')).toBe(0);
        expect(scored(heedful, { wisdom: 14 })('init', [0])).toBe(2);
        // A bonus that rises in a Situation is its new total.
        const loner = 'Loner of the Rocks (Oread)';
        expect(total(traitSheet(loner), 'skill.sur')).toBe(1);
        expect(total(traitSheet(loner), 'skill.hea')).toBe(1);
        expect(
          resolveSheet(modifiers(loner), {
            situations: [
              situation(loner, indexOf(loner, 'skill.sur', 'mountain')),
            ],
          })['skill.sur'].total,
        ).toBe(2);
        const stargazer = 'Stargazer (Iron Gods)';
        const geography = (labels: string[]) =>
          resolveSheet(modifiers(stargazer), {
            situations: labels.map((label) =>
              situation(stargazer, indexOf(stargazer, 'skill.kge', label)),
            ),
          })['skill.kge'].total;
        expect(geography([])).toBe(1);
        expect(geography(['alien monsters'])).toBe(2);
        expect(geography(['alien monsters', 'Technologist'])).toBe(3);
        const aliens = resolveSheet(modifiers(stargazer), {
          situations: [
            situation(
              stargazer,
              indexOf(stargazer, 'skill.kar', 'alien monsters'),
            ),
          ],
        });
        for (const target of ['skill.kar', 'skill.kre', 'skill.kpl'] as const)
          expect(aliens[target].total, target).toBe(2);
      },
      () => {
        const reader = 'Star Reader (Sodden Lands)';
        const starlight = indexOf(reader, 'casterLevel', 'starlight');
        const demon = indexOf(reader, 'casterLevel', 'demon');
        expect(
          [[], [starlight], [demon], [starlight, demon]].map(
            (indexes) =>
              resolveSheet(modifiers(reader), {
                situations: indexes.map((index) => situation(reader, index)),
              }).casterLevel.total,
          ),
        ).toEqual([0, 1, 2, 2]);
        // Attached's penalties of one entry do not add on a Will save against fear.
        const attached = 'Attached';
        const will = indexOf(attached, 'save.will', 'attachment');
        const fear = indexOf(attached, 'saves', 'fear');
        expect(saves(resolveSheet(modifiers(attached)))).toEqual([0, 0, 0]);
        expect(
          saves(
            resolveSheet(modifiers(attached), {
              situations: [situation(attached, will)],
            }),
          ),
        ).toEqual([0, 0, -1]);
        expect(
          saves(
            resolveSheet(modifiers(attached), {
              situations: [situation(attached, fear)],
            }),
          ),
        ).toEqual([-2, -2, -2]);
        expect(
          saves(
            resolveSheet(modifiers(attached), {
              situations: [
                situation(attached, will),
                situation(attached, fear),
              ],
            }),
          ),
        ).toEqual([-2, -2, -2]);
        // Untyped and other published bonus types keep their type.
        for (const [name, typed] of [
          [
            'Foxclaw Scout (Ironfang Invasion)',
            ['attack trait', 'save.will morale'],
          ],
          [
            'Vialesk Historian (Plane of Water)',
            ['skill.kpl trait', 'casterLevel untyped'],
          ],
          ['Nidalese Shadowcaster (Nidal)', ['casterLevel untyped']],
          ['Heedful Readiness', ['init untyped']],
          ['Attached', ['save.will untyped', 'saves untyped']],
          [
            'Star Reader (Sodden Lands)',
            ['casterLevel untyped', 'casterLevel untyped'],
          ],
          [
            'Affinity for the Elements (any Elemental Lord)',
            [
              'spellDC untyped',
              'spellDC untyped',
              'spellDC untyped',
              'spellDC untyped',
            ],
          ],
        ] as const)
          expect(
            modifiers(name).map((row) => `${row.target} ${row.bonusType}`),
            name,
          ).toEqual(typed);
        // Shared Situations where the body's condition matches exactly.
        for (const [name, key] of [
          ['Clearheaded (Dwarf)', 'illusions'],
          ['Spirit Lodge Dreamer (Human; Erutaki)', 'illusions'],
          ['Unhinged Mentality (Lamashtu)', 'fear'],
          ['Jungle Native (Mwangi Expanse; Grippli)', 'poison'],
        ] as const)
          expect(
            modifiers(name).filter((row) => row.condition?.situation === key),
            name,
          ).toHaveLength(1);
        expect(
          saves(
            resolveSheet(modifiers('Spirit Lodge Dreamer (Human; Erutaki)'), {
              situations: ['illusions'],
            }),
          ),
        ).toEqual([1, 1, 1]);
        // Unhinged Mentality's fear and confusion bonuses are one trait bonus.
        const unhinged = 'Unhinged Mentality (Lamashtu)';
        expect(
          saves(
            resolveSheet(modifiers(unhinged), {
              situations: [
                'fear',
                situation(unhinged, indexOf(unhinged, 'saves', 'confusion')),
              ],
            }),
          ),
        ).toEqual([2, 2, 2]);
        // Exemptions and narrower conditions keep the Situation local.
        for (const [name, label] of [
          ['Attached', 'against fear effects, while'],
          ['Stoic Dignity (Oread)', 'not already suffering from'],
          ['Fortified Drinker (Cayden Cailean)', 'alcoholic beverage'],
          ['Authoritarian', 'liege or leader'],
          ['Blooded (Mindspin Mountains)', 'giants, goblins and orcs'],
        ] as const)
          expect(
            modifiers(name).some((row) =>
              JSON.stringify(row.condition?.situation ?? '').includes(label),
            ),
            name,
          ).toBe(true);
      },
      () => {
        // Damage bonuses are on damage, not attack rolls.
        for (const name of [
          'Opportune Slayer (Lamashtu)',
          'Blooded (Mindspin Mountains)',
          'Mivoni Duelist (Mivon)',
        ]) {
          expect(
            modifiers(name).map((row) => row.target),
            name,
          ).toEqual(['damage']);
          expect(
            resolveSheet(modifiers(name), { situations: [situation(name, 0)] })[
              'damage.melee'
            ].total,
            name,
          ).toBe(name.startsWith('Opportune') ? 2 : 1);
        }
        // Anticipate Evil's +1 applies to every Dexterity-based skill under one
        // Situation.
        const evil = 'Anticipate Evil (Tiefling)';
        const fiends = resolveSheet(modifiers(evil), {
          situations: [situation(evil, 0)],
        });
        for (const target of [
          'skill.acr',
          'skill.dev',
          'skill.esc',
          'skill.fly',
          'skill.rid',
          'skill.slt',
          'skill.ste',
        ] as const)
          expect(fiends[target].total, target).toBe(1);
        // Kuthite Caster's bonus is on concentration checks.
        const kuthite = 'Kuthite Caster (Zon-Kuthon)';
        expect(
          resolveSheet(modifiers(kuthite), {
            situations: [situation(kuthite, 0)],
          }).concentration.total,
        ).toBe(4);
        // No reviewed armor, shield or natural armor bonus lands on ac.other (#734).
        for (const row of batchEntries)
          for (const modifier of row.modifiers)
            if (
              ['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType)
            )
              expect(modifier.target, row.name).not.toBe('ac.other');
      },
    ])
      checks();
  });
});

describe('the traits-386 keys', () => {
  const { entry, modifiers, situation, indexOf, traitSheet, total } =
    traitBatch(entries, 'traits-386');
  const saves = (resolved: ReturnType<typeof resolveSheet>) => [
    resolved['save.fort'].total,
    resolved['save.ref'].total,
    resolved['save.will'].total,
  ];

  it("resolves the named traits' curated Modifiers, and two traits' trait bonuses on one statistic do not stack", () => {
    // The case runs its checks in order, in runs of a few, so that each
    // function stays within the lint's complexity limit.
    for (const checks of [
      () => {
        // Trait bonuses from different traits on one statistic never stack.
        const shenmen = 'Shenmen Prospector (Shenmen)';
        const crafter = 'Magic Crafter';
        expect(total(traitSheet(shenmen), 'skill.apr')).toBe(1);
        expect(total(traitSheet(crafter), 'skill.apr')).toBe(1);
        expect(total(traitSheet(shenmen, crafter), 'skill.apr')).toBe(1);
        expect(total(traitSheet(shenmen, crafter), 'skill.kdu')).toBe(1);
        const hongal = 'Hongal Bloodrider (Hongal)';
        const cliff = 'Cliff-Master (Varisia; Goblin)';
        expect(total(traitSheet(hongal, cliff), 'skill.rid')).toBe(1);
        expect(total(traitSheet(hongal, cliff), 'skill.clm')).toBe(1);
        // Magic Crafter's Craft bonus is untyped and situational.
        expect(resolveSheet(modifiers(crafter))['skill.crf'].total).toBe(0);
        expect(
          resolveSheet(modifiers(crafter), {
            situations: [
              situation(crafter, indexOf(crafter, 'skill.crf', 'magic items')),
            ],
          })['skill.crf'].total,
        ).toBe(1);
        // Glory of Old uses three shared Situations; same-type bonuses in one entry
        // never add up.
        const glory = 'Glory of Old (Five Kings Mountains)';
        expect(saves(resolveSheet(modifiers(glory)))).toEqual([0, 0, 0]);
        expect(
          saves(resolveSheet(modifiers(glory), { situations: ['spells'] })),
        ).toEqual([1, 1, 1]);
        expect(
          saves(
            resolveSheet(modifiers(glory), {
              situations: ['spells', 'spellLike', 'poison'],
            }),
          ),
        ).toEqual([1, 1, 1]);
        // Shared Situations exactly where the body's condition matches.
        for (const [name, key] of [
          ['Crisis of Faith', 'illusions'],
          ["Pattern Seeker (Hell's Rebels)", 'illusions'],
          ['Void Child (Diaspora)', 'fear'],
        ] as const)
          expect(
            saves(resolveSheet(modifiers(name), { situations: [key] })),
            name,
          ).toEqual([1, 1, 1]);
        // A bonus that rises in a Situation is its new total.
        const voidChild = 'Void Child (Diaspora)';
        const far = situation(
          voidChild,
          indexOf(voidChild, 'saves', '30 feet'),
        );
        expect(
          saves(
            resolveSheet(modifiers(voidChild), { situations: ['fear', far] }),
          ),
        ).toEqual([2, 2, 2]);
        const customer = 'Best Customer (Jade Regent)';
        const heal = (labels: string[]) =>
          resolveSheet(modifiers(customer), {
            situations: labels.map((label) =>
              situation(customer, indexOf(customer, 'skill.hea', label)),
            ),
          })['skill.hea'].total;
        expect(heal([])).toBe(0);
        expect(heal(['on hand'])).toBe(2);
        expect(heal(['on hand', 'drinking buddy'])).toBe(4);
        expect(total(traitSheet(customer), 'skill.hea')).toBe(0);
        const eye = 'Mutant Eye';
        const motive = (labels: string[]) =>
          resolveSheet(modifiers(eye), {
            situations: labels.map((label) =>
              situation(eye, indexOf(eye, 'skill.sen', label)),
            ),
          })['skill.sen'].total;
        expect(motive(['uncovered and open'])).toBe(2);
        expect(motive(['uncovered and open', 'mind-affecting'])).toBe(4);
        expect(
          resolveSheet(modifiers(eye), {
            situations: [
              situation(eye, indexOf(eye, 'skill.blf', 'humanoids')),
            ],
          })['skill.blf'].total,
        ).toBe(-1);
        // Different bonus types stack: Rugged Dragon Hunter's trait +2 and untyped
        // +1 on Survival, Spirit Talker's racial +1 with Adrift's trait +1.
        const hunter = 'Rugged Dragon Hunter';
        expect(
          resolveSheet(modifiers(hunter), {
            situations: [
              situation(hunter, indexOf(hunter, 'skill.sur', 'track dragons')),
              situation(
                hunter,
                indexOf(hunter, 'skill.sur', 'favored terrain'),
              ),
            ],
          })['skill.sur'].total,
        ).toBe(3);
        expect(
          resolveSheet(modifiers(hunter), {
            situations: [
              situation(
                hunter,
                indexOf(hunter, 'skill.per', 'favored terrain'),
              ),
            ],
          })['skill.per'].total,
        ).toBe(1);
        const talker = 'Spirit Talker (Mwangi shamanistic faith)';
        expect(
          modifiers(talker).map((row) => [
            row.target,
            row.bonusType,
            row.value,
          ]),
        ).toEqual([
          ['save.will', 'racial', 1],
          ['save.will', 'untyped', -1],
        ]);
        const adrift = 'Adrift (Aasimar)';
        expect(
          saves(
            resolveSheet([...modifiers(talker), ...modifiers(adrift)], {
              situations: [
                situation(talker, 0),
                situation(adrift, indexOf(adrift, 'saves', 'charm')),
              ],
            }),
          ),
        ).toEqual([1, 1, 2]);
        // Adrift's bonus is on all saves; Child of Two Peoples' only on Will.
        const child = 'Child of Two Peoples (Half-Elf, Half-Orc, Human)';
        expect(
          saves(
            resolveSheet(modifiers(child), {
              situations: [situation(child, 0)],
            }),
          ),
        ).toEqual([0, 0, 2]);
        // Lonely: the imported Sense Motive penalty always applies; the Perception
        // and save penalties are Situations.
        const lonely = 'Lonely';
        expect(total(traitSheet(lonely), 'skill.sen')).toBe(-2);
        expect(total(traitSheet(lonely), 'skill.per')).toBe(0);
        expect(
          resolveSheet(modifiers(lonely), {
            situations: [situation(lonely, indexOf(lonely, 'saves', 'charm'))],
          })['save.will'].total,
        ).toBe(-2);
        // Unmapped or targetless imported changes get reviewed Modifiers.
        for (const [name, target, value, conditional] of [
          ['Focused Mind', 'concentration', 2, false],
          ['Eager Performer (Rise of the Runelords)', 'skill.prf', 1, false],
          ['Gold Goblin Regular (Riddleport)', 'skill.pro', 1, false],
          ['Anatomist', 'attack.melee', 1, true],
          ['Trade Talk (Half-Elf, Human-Raised)', 'skill.crf', 1, true],
          ['Foster Child (Jade Regent)', 'skill.kre', 2, true],
        ] as const) {
          const index = modifiers(name).findIndex(
            (row) =>
              target.startsWith(row.target) &&
              row.value === value &&
              (name !== 'Foster Child (Jade Regent)' ||
                JSON.stringify(row.condition).includes('religion')),
          );
          expect(index, name).toBeGreaterThanOrEqual(0);
          expect(entry(name).unsupported, name).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'changes' }),
            ]),
          );
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(
            conditional ? 0 : value,
          );
          expect(
            resolveSheet(modifiers(name), {
              situations: conditional ? [situation(name, index)] : [],
            })[target].total,
            name,
          ).toBe(value);
        }
      },
      () => {
        // Choices are one Situation per option.
        for (const [name, count] of [
          ['Trade Talk (Half-Elf, Human-Raised)', 4],
          ['Foster Child (Jade Regent)', 11],
          ['Secrets of the Sphinx (Scarab Sages)', 10],
        ] as const)
          expect(modifiers(name), name).toHaveLength(count);
        expect(
          modifiers('Foster Child (Jade Regent)')
            .filter((row) => row.target.startsWith('skill.k'))
            .every((row) => row.bonusType === 'untyped'),
        ).toBe(true);
        // Local Ties: reviewed change replacements zero the imported +1 on both
        // skills; the chosen skill gets +1, or +3 with the Technologist feat.
        const ties = 'Local Ties (Iron Gods)';
        expect(
          modifiers(ties)
            .slice(0, 2)
            .map((row) => [row.target, row.value, row.condition]),
        ).toEqual([
          ['skill.dev', 0, undefined],
          ['skill.ken', 0, undefined],
        ]);
        expect(total(traitSheet(ties), 'skill.dev')).toBe(0);
        expect(total(traitSheet(ties), 'skill.ken')).toBe(0);
        const chose = (label: string, target: 'skill.dev' | 'skill.ken') =>
          resolveSheet(modifiers(ties), {
            situations: [situation(ties, indexOf(ties, target, label))],
          })[target].total;
        expect(chose('if you chose Disable Device', 'skill.dev')).toBe(1);
        expect(chose('Disable Device and possess', 'skill.dev')).toBe(3);
        expect(chose('if you chose Knowledge (engineering)', 'skill.ken')).toBe(
          1,
        );
        // Targets the Foundry notes got wrong are reviewed onto the right leaf.
        const lobber = 'Carpenden Lobber (Andoran; Carpenden)';
        const thrown = resolveSheet(modifiers(lobber), {
          situations: [situation(lobber, 0)],
        });
        expect([
          thrown['attack.ranged'].total,
          thrown['attack.melee'].total,
        ]).toEqual([2, 0]);
        for (const [name, label, value] of [
          ['River Rat (Marsh or River)', 'dagger', 1],
          ['Oregent Vandal (Andoran; Oregent)', 'hardness', 2],
          ["Death's Deputy (Tiefling; Grimspawn)", 'negative hit points', 2],
        ] as const)
          expect(
            resolveSheet(modifiers(name), {
              situations: [situation(name, indexOf(name, 'damage', label))],
            })['damage.melee'].total,
            name,
          ).toBe(value);
        expect(total(traitSheet('Adrift (Aasimar)'), 'save.will')).toBe(0);
        const temple = 'Tianjing Temple Guard (Tianjing)';
        const opportunity = resolveSheet(modifiers(temple), {
          situations: [situation(temple, 0)],
        });
        expect([
          opportunity['attack.melee'].total,
          opportunity['attack.ranged'].total,
        ]).toEqual([1, 0]);
        // Trait AC bonuses resolve to the ac.other leaf, never armor or shield.
        for (const name of [
          'Aerial Harrier (Strix)',
          'Blessed of the Norns (Lands of the Linnorm Kings)',
        ]) {
          const index = indexOf(name, 'ac', '');
          expect(modifiers(name)[index]?.bonusType, name).toBe('trait');
          const resolved = resolveSheet(modifiers(name), {
            situations: [situation(name, index)],
          });
          expect(resolved['ac.other'].total, name).toBe(1);
          expect(resolved['ac.armor'].total, name).toBe(0);
        }
        // Caster level, spell DC and CMD Situations.
        for (const [name, target, label, value] of [
          [
            'Student of Faith (Rise of the Runelords)',
            'casterLevel',
            'cure',
            1,
          ],
          [
            'Castrovel Gatekeeper (Lashunta)',
            'casterLevel',
            'teleportation',
            1,
          ],
          ["Pattern Seeker (Hell's Rebels)", 'spellDC', 'pattern', 1],
          ['Log Roller (Forest)', 'cmd', 'trip', 1],
          [
            "Hellknight Aspirant (Hell's Vengeance)",
            'cmd',
            'sunder or disarm',
            1,
          ],
        ] as const) {
          expect(resolveSheet(modifiers(name))[target].total, name).toBe(0);
          expect(
            resolveSheet(modifiers(name), {
              situations: [situation(name, indexOf(name, target, label))],
            })[target].total,
            name,
          ).toBe(value);
        }
        // Treasure Mapper's untyped +2 on Survival and Profession (sailor).
        const mapper = 'Treasure Mapper (Ilizmagorti)';
        for (const target of ['skill.sur', 'skill.pro'] as const)
          expect(
            resolveSheet(modifiers(mapper), {
              situations: [
                situation(mapper, indexOf(mapper, target, 'navigate')),
              ],
            })[target].total,
          ).toBe(2);
        // Same-text local Situations on one entry select together.
        const ritualist = 'Natural Ritualist';
        const ritual = resolveSheet(modifiers(ritualist), {
          situations: [situation(ritualist, 0)],
        });
        expect([ritual['skill.kna'].total, ritual['skill.sur'].total]).toEqual([
          2, 2,
        ]);
        const sphinx = 'Secrets of the Sphinx (Scarab Sages)';
        const knowledge = resolveSheet(modifiers(sphinx), {
          situations: [situation(sphinx, 0)],
        });
        expect(knowledge['skill.kar'].total).toBe(2);
        expect(knowledge['skill.kre'].total).toBe(2);
      },
    ])
      checks();
  });
});
