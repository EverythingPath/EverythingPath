// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import {
  inventoryPcgen,
  type PcgenInventory,
} from '../../scripts/catalog/pcgen/inventory';
import { recordsByKey, type PcgenTree } from '../../scripts/catalog/pcgen/lst';
import { tagValue, tagValues } from '../../scripts/catalog/pcgen/tokens';
import { pcgenBooks } from '../../scripts/catalog/pcgen-books';
import { upstreamSourceSchema } from '../../src/lib/catalog/imported-entry-schema';
import { readPcgen716Tree } from './pcgen-716-tree';

// #716 P3 (plan §9): the PCGen LST reader's raw source inventory and
// owned-feature rows on the plan's fixtures, read from pinned PCGen files.
// Expected rows match the inventory script's `--rows` output for these
// owners on the full tree.
let tree: PcgenTree;
let inventory: PcgenInventory;
beforeAll(async () => {
  tree = await readPcgen716Tree();
  inventory = inventoryPcgen(tree);
}, 60_000);

const ownerAt = (file: string, line: number) => {
  const owner = inventory.owners.find(
    ({ record }) =>
      record.locator.file === file && record.locator.line === line,
  );
  if (!owner) throw new Error(`No owner at ${file}:${line}`);
  return owner;
};
/** An owner's rows as `[feature key, feature file:line, binding, depth]`. */
const rowsOf = (file: string, line: number) =>
  inventory.rows
    .filter(
      ({ owner }) =>
        owner.record.locator.file === file &&
        owner.record.locator.line === line,
    )
    .map((row) => [
      row.key,
      row.feature
        ? `${row.feature.locator.file}:${row.feature.locator.line}`
        : null,
      row.binding,
      row.depth,
    ]);

const apgAbilities =
  'roleplaying_game/advanced_players_guide/apg_abilities_class.lst';
const crAbilities = 'roleplaying_game/core_rulebook/cr_abilities_class.lst';
const iswgAbilities =
  'campaign_setting/inner_sea_world_guide/iswg_abilities_class.lst';
const agAbilities = 'roleplaying_game/adventurers_guide/ag_abilities_class.lst';

describe('Archer (apg_abilities_class.lst:2102)', () => {
  it('is a canonical Fighter archetype with its locator, book and page', () => {
    const { kind, className, record } = ownerAt(apgAbilities, 2102);
    expect({ kind, className }).toEqual({
      kind: 'canonical',
      className: 'Fighter',
    });
    expect(record.locator).toEqual({
      file: apgAbilities,
      line: 2102,
      key: 'Fighter Archetype ~ Archer',
    });
    expect(record).toMatchObject({
      name: 'Archer',
      pack: 'roleplaying_game/advanced_players_guide',
      book: "Advanced Player's Guide",
      // The pack's `.pcc` SOURCESHORT, beside its SOURCELONG (P6).
      bookShort: 'APG',
      page: 'p.104',
      isPfs: false,
      isNamePI: false,
      isDescPI: false,
    });
    expect(
      upstreamSourceSchema.parse({ source: 'pcgen', locator: record.locator }),
    ).toBeTruthy();
  });

  it('keeps the replaced parts, the stacking exclusion and the leveled grants', () => {
    const { record } = ownerAt(apgAbilities, 2102);
    expect(tagValue(record.tokens, 'TYPE')).toBe(
      'Archetype.FighterArchetype.FighterBravery.FighterArmorTraining_ALL.FighterWeaponTraining_ALL.FighterArmorMastery',
    );
    const exclusion = record.tokens.find((token) =>
      token.startsWith('PREMULT:'),
    )!;
    expect(exclusion).toContain(
      '[!PREABILITY:1,CATEGORY=Archetype,TYPE.FighterBravery,',
    );
    expect(record.grants[0]).toEqual({
      category: 'Fighter Class Feature',
      nature: 'AUTOMATIC',
      keys: ['Fighter Archer ~ Hawkeye'],
      prerequisites: [
        { kind: 'PRECLASS', isNegated: false, count: 1, items: ['Fighter=2'] },
      ],
      file: apgAbilities,
      line: 2102,
    });
    expect(
      record.grants.map((grant) => [
        grant.keys[0],
        grant.prerequisites[0]!.items[0],
      ]),
    ).toEqual([
      ['Fighter Archer ~ Hawkeye', 'Fighter=2'],
      ['Fighter Archer ~ Trick Shot', 'Fighter=3'],
      ['Fighter Archer ~ Expert Archer', 'Fighter=5'],
      ['Fighter Archer ~ Safe Shot', 'Fighter=9'],
      ['Fighter Archer ~ Evasive Archer', 'Fighter=13'],
      ['Fighter Archer ~ Volley', 'Fighter=17'],
      ['Fighter Archer ~ Ranged Defense', 'Fighter=19'],
      ['Fighter Archer ~ Weapon Mastery', 'Fighter=1'],
    ]);
  });

  it('owns its eight features in its own pack; Hawkeye replaces bravery', () => {
    expect(rowsOf(apgAbilities, 2102)).toEqual(
      [
        'Hawkeye',
        'Trick Shot',
        'Expert Archer',
        'Safe Shot',
        'Evasive Archer',
        'Volley',
        'Ranged Defense',
        'Weapon Mastery',
      ].map((name, index) => [
        `Fighter Archer ~ ${name}`,
        `${apgAbilities}:${2118 + index}`,
        'same-pack',
        1,
      ]),
    );
    const [hawkeye] = recordsByKey(tree.features, 'Fighter Archer ~ Hawkeye');
    expect(tagValue(hawkeye!.tokens, 'TYPE')).toMatch(/\.FighterBravery$/);
    expect(tagValue(hawkeye!.tokens, 'DESC')).toMatch(
      /This ability replaces bravery\.$/,
    );
  });
});

describe('Herbalist (uw_abilities_class.lst:120)', () => {
  const file = 'roleplaying_game/ultimate_wilderness/uw_abilities_class.lst';

  it('keeps the FACT removals and exclusions of the newer convention', () => {
    const { kind, className, record } = ownerAt(file, 120);
    expect({ kind, className, book: record.book }).toEqual({
      kind: 'canonical',
      className: 'Alchemist',
      book: 'Ultimate Wilderness',
    });
    const facts = tagValues(record.tokens, 'FACT');
    expect(facts).toContain('Alchemist_CF_Bomb|true');
    expect(facts).toContain('Alchemist_Archetype_Bomb|true');
    expect(facts).toHaveLength(11);
  });

  it('owns its three features', () => {
    expect(rowsOf(file, 120)).toEqual([
      ['Herbalist ~ Herbalism', `${file}:125`, 'same-pack', 1],
      ['Herbalist ~ Natural Magic', `${file}:126`, 'same-pack', 1],
      ['Herbalist ~ Seedpods', `${file}:127`, 'same-pack', 1],
    ]);
  });
});

describe('noncanonical keys', () => {
  it('reads Fell Rider (arg_abilities_class.lst:568) with its class from ASPECT', () => {
    const file = 'roleplaying_game/advanced_race_guide/arg_abilities_class.lst';
    const { kind, className, record } = ownerAt(file, 568);
    expect({ kind, className, key: record.locator.key }).toEqual({
      kind: 'noncanonical',
      className: 'Cavalier',
      key: 'Fell Rider ~ Cavalier Archetype',
    });
    expect(rowsOf(file, 568)).toEqual(
      [
        'Brute Steed',
        'Rampage',
        'Dread Rider',
        'Fell Presence',
        'Deadly Rampage',
        'Terror',
        'Unstoppable Rampage',
      ].map((name, index) => [
        `Fell Rider ~ ${name}`,
        `${file}:${570 + index}`,
        'same-pack',
        1,
      ]),
    );
  });

  it('reads Devil Impostor (aoe_abilities_class_pu.lst:7) in a support pack, its class left to review', () => {
    const file =
      'player_companion/agents_of_evil/support/aoe_abilities_class_pu.lst';
    const { kind, className, record } = ownerAt(file, 7);
    expect({ kind, className }).toEqual({
      kind: 'noncanonical',
      className: null,
    });
    expect(record).toMatchObject({
      locator: { key: 'Unchained Summoner ~ Devil Impostor' },
      pack: 'player_companion/agents_of_evil',
      book: 'Agents of Evil',
      page: 'p.17',
      isNamePI: false,
      isDescPI: true,
    });
    // Its Internal grant (Devil Impostor ~ Skills) is not a feature.
    expect(rowsOf(file, 7)).toEqual(
      [
        'Bond Alignment',
        'Deceptive Eidolon',
        'Fiendish Summons',
        "Devil's Flesh",
        "Devil's Tongue",
        'Fiendish Appearance',
      ].map((name, index) => [
        `Devil Impostor ~ ${name}`,
        `${file}:${10 + index}`,
        'same-pack',
        1,
      ]),
    );
  });
});

describe('prestige classes', () => {
  const crClasses = 'roleplaying_game/core_rulebook/cr_classes.lst';

  it('reads the Duelist block: class lines, requirements and its level line', () => {
    const duelist = tree.prestigeClasses.find(
      ({ locator }) => locator.file === crClasses && locator.key === 'Duelist',
    )!;
    expect(duelist.locator.line).toBe(398);
    expect(duelist.page).toBe('p.382');
    expect(duelist.classLines.map(({ line }) => line)).toEqual([398, 400, 402]);
    expect(duelist.levelLines.map(({ level, line }) => [level, line])).toEqual([
      [1, 404],
    ]);
    expect(duelist.prerequisites).toEqual([
      {
        kind: 'PREABILITY',
        isNegated: false,
        count: 3,
        items: ['CATEGORY=FEAT', 'Dodge', 'Mobility', 'Weapon Finesse'],
      },
      {
        kind: 'PRESKILL',
        isNegated: false,
        count: 2,
        items: ['Acrobatics=2', 'TYPE.Perform=2'],
      },
      { kind: 'PRETOTALAB', isNegated: false, count: 6, items: [] },
    ]);
  });

  it('owns Duelist features through its CATEGORY:Class record and that record’s .MOD lines', () => {
    const [record] = recordsByKey(tree.classRecords, 'Duelist');
    expect(record!.locator).toEqual({
      file: crAbilities,
      line: 114,
      key: 'Duelist',
    });
    expect(record!.mods.map(({ line, binding }) => [line, binding])).toEqual(
      Array.from({ length: 10 }, (_, index) => [362 + index, 'same-pack']),
    );
    const direct = (name: string, line: number) => [
      `Duelist ~ ${name}`,
      `${crAbilities}:${line}`,
      'same-pack',
      1,
    ];
    expect(rowsOf(crClasses, 398)).toEqual([
      direct('Weapon and Armor Proficiency', 2986),
      direct('Canny Defense', 2987),
      direct('Precise Strike', 2991),
      direct('Improved Reaction', 2988),
      direct('Parry', 2998),
      direct('Enhanced Mobility', 2989),
      direct('Combat Reflexes', 3001),
      direct('Grace', 2990),
      direct('Riposte', 2999),
      direct('Acrobatic Charge', 2996),
      direct('Elaborate Defense', 2997),
      direct('Deflect Arrows', 3003),
      direct('No Retreat', 3000),
      direct('Crippling Critical', 3002),
      // Nested grants of Duelist ~ Precise Strike, reviewed with their owner.
      ['Precise Strike ~ 1H', `${crAbilities}:2994`, 'same-pack', 2],
      ['Precise Strike ~ Light', `${crAbilities}:2993`, 'same-pack', 2],
    ]);
    expect(
      inventory.rows.find((row) => row.key === 'Precise Strike ~ Light')?.via,
    ).toBe('Duelist ~ Precise Strike');
  });

  it('parses the Master Chymist all-of requirement (apg_classes.lst:426) and owns its features', () => {
    const file = 'roleplaying_game/advanced_players_guide/apg_classes.lst';
    const chymist = ownerAt(file, 424);
    if (chymist.kind !== 'prestige')
      throw new Error('Master Chymist is a prestige class');
    const [premult] = chymist.record.prerequisites;
    expect(premult).toMatchObject({ kind: 'PREMULT', count: 2 });
    expect(premult!.items).toEqual([
      {
        kind: 'PREABILITY',
        isNegated: false,
        count: 1,
        items: ['CATEGORY=Special Ability', 'Alchemist ~ Mutagen'],
      },
      {
        kind: 'PREABILITY',
        isNegated: false,
        count: 1,
        items: [
          'CATEGORY=Special Ability',
          'Discovery ~ Feral Mutagen',
          'Discovery ~ Infuse Mutagen',
        ],
      },
    ]);
    expect(rowsOf(file, 424)).toEqual(
      [
        ['Weapon and Armor Proficiency', 1361],
        ['Bomb-Thrower', 1363],
        ['Mutagenic Form', 1364],
        ['Mutate', 1365],
        ['Advanced Mutagen', 1366],
        ['Brutality', 1367],
      ].map(([name, line]) => [
        `Master Chymist ~ ${name}`,
        `${apgAbilities}:${line}`,
        'same-pack',
        1,
      ]),
    );
  });
});

describe('Hellknight in two books (iswg_classes.lst:23, ag_classes.lst:170)', () => {
  const iswg = 'campaign_setting/inner_sea_world_guide/iswg_classes.lst';
  const ag = 'roleplaying_game/adventurers_guide/ag_classes.lst';

  it('keeps both prestige records with their own books and PI flags', () => {
    expect(
      [ownerAt(iswg, 23), ownerAt(ag, 170)].map(({ record }) => [
        record.book,
        record.page,
        record.isNamePI,
      ]),
    ).toEqual([
      ['Inner Sea World Guide', 'p.278', true],
      ["Adventurer's Guide", 'p.278', true],
    ]);
  });

  it('keeps same-key features apart: each Hellknight binds to its own book’s Discipline ~ HK', () => {
    const variants = recordsByKey(tree.features, 'Discipline ~ HK');
    expect(
      variants.map(({ locator }) => `${locator.file}:${locator.line}`),
    ).toEqual([`${iswgAbilities}:75`, `${agAbilities}:204`]);
    // The _pfs folder has its own .pcc, so its .MOD comes from a pack with no
    // variant of the key and binds to both, each keeping its own record.
    expect(
      variants.map(({ mods }) =>
        mods.map(({ file, line, binding }) => [`${file}:${line}`, binding]),
      ),
    ).toEqual([
      [
        [
          'campaign_setting/inner_sea_world_guide/_pfs/pfs_iswg_abilities_class.lst:55',
          'other-pack',
        ],
      ],
      [
        [
          'campaign_setting/inner_sea_world_guide/_pfs/pfs_iswg_abilities_class.lst:55',
          'other-pack',
        ],
      ],
    ]);
    const discipline = (file: string, line: number) =>
      rowsOf(file, line).filter(([key]) => key === 'Discipline ~ HK');
    expect(discipline(iswg, 23)).toEqual([
      ['Discipline ~ HK', `${iswgAbilities}:75`, 'same-pack', 1],
    ]);
    expect(discipline(ag, 170)).toEqual([
      ['Discipline ~ HK', `${agAbilities}:204`, 'same-pack', 1],
    ]);
  });

  it('owns the Core Rulebook’s Aura of Law from another pack and keeps feature PI flags', () => {
    for (const [file, line] of [
      [iswg, 23],
      [ag, 170],
    ] as const) {
      const rows = rowsOf(file, line);
      expect(rows).toHaveLength(12);
      expect(rows[0]).toEqual([
        'Aura of Law',
        `${crAbilities}:2877`,
        'other-pack',
        1,
      ]);
      expect(rows.at(-1)).toEqual([
        'Immunity to Fire',
        'roleplaying_game/core_essentials/ce_abilities_race.lst:1392',
        'other-pack',
        2,
      ]);
    }
    const armor = inventory.rows.filter(
      (row) => row.key === 'Hellknight Armor ~ HK',
    );
    expect(
      armor.map(({ feature }) => [
        feature!.locator.line,
        feature!.isNamePI,
        feature!.isDescPI,
      ]),
    ).toEqual([
      [58, true, true],
      [196, true, true],
    ]);
  });
});

describe('the reader on the fixture tree', () => {
  it('names every owner’s book as the crosswalk does', () => {
    const books = new Set(pcgenBooks.books.map(({ book }) => book));
    for (const { kind, record } of inventory.owners)
      if (kind !== 'helper' && !record.isPfs)
        expect(books.has(record.book), record.book).toBe(true);
  });
});

describe('keys ignore case, as in PCGen', () => {
  // The inventory script's folded index kept one spelling's variants and
  // dropped the other's; the reader keeps every variant.
  it('binds each River Druid to its own book’s Read the Currents', () => {
    const potr =
      'player_companion/people_of_the_river/potr_abilities_class.lst';
    const uw = 'roleplaying_game/ultimate_wilderness/uw_abilities_class.lst';
    expect(
      recordsByKey(tree.features, 'river druid ~ read the currents').map(
        ({ locator }) => locator,
      ),
    ).toEqual([
      { file: potr, line: 53, key: 'River Druid ~ Read The Currents' },
      { file: uw, line: 541, key: 'River Druid ~ Read the Currents' },
    ]);
    const readTheCurrents = (file: string, line: number) =>
      rowsOf(file, line).filter(([key]) =>
        String(key).toLowerCase().includes('read the currents'),
      );
    expect(readTheCurrents(potr, 50)).toEqual([
      ['River Druid ~ Read The Currents', `${potr}:53`, 'same-pack', 1],
    ]);
    expect(readTheCurrents(uw, 497)).toEqual([
      ['River Druid ~ Read the Currents', `${uw}:541`, 'same-pack', 1],
    ]);
  });

  it('owns both Ultimate Combat spellings of Master of Many Styles’ Perfect Style', () => {
    const uc = 'roleplaying_game/ultimate_combat/uc_abilities_class.lst';
    expect(
      rowsOf(uc, 928).filter(
        ([key]) => key === 'Master Of Many Styles ~ Perfect Style',
      ),
    ).toEqual([
      ['Master Of Many Styles ~ Perfect Style', `${uc}:1096`, 'same-pack', 1],
      [
        'Master Of Many Styles ~ Perfect Style',
        'roleplaying_game/ultimate_combat/support/uc_abilities_class_ag.lst:80',
        'same-pack',
        1,
      ],
    ]);
  });
});
