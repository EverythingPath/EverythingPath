// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  representativeClassCatalog,
  representativeClassCounterparts,
} from '../../convex/lib/representativeClassCatalog';
import { representativeArchetypeCatalog } from '../../convex/lib/representativeArchetypeCatalog';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import { mapEntry, upstreamRecord } from '../../scripts/catalog/map';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  catalogModifierTargets,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from '../../src/lib/character-sheet';
import { resolveCombinedForm } from '../../src/lib/character-sheet-combined-form';
import { resolveCompanionLinkedInput } from '../../src/lib/character-sheet-linked-inputs';
import {
  canonicalSkillKey,
  type SkillTarget,
} from '../../src/lib/character-sheet-skills';
import provenance from '../fixtures/race-facts-720/provenance.json';
import {
  alternateRow,
  raceSheet,
  sheetDefinition,
} from '../fixtures/racial-traits-719/sheet';

// Pinned Foundry PF1 v11.11 and pf1-content 11.4.0 records (see the fixture
// README): the races with natural armor, size, speed, spell resistance and the
// other #328 unmapped changes, their standard Racial Traits, and the three
// weapons the Drow Noble names. The seven Core Rulebook races come from the
// #719 fixture.
const fixtureRoot = resolve('tests/fixtures/race-facts-720');
const coreRoot = resolve('tests/fixtures/racial-traits-719');
const inputsOf = (root: string) => ({
  systemPath: join(root, 'pf1'),
  contentPath: join(root, 'pf1-content'),
  remaps: [],
  curation,
});
const race = {
  ogre: 'pf1/gZxiUYLYsGqQYwGZ',
  gnoll: 'pf1/ITHs6VCRdSQUsoen',
  lizardfolk: 'pf1/LU6Rgor1wTS5cCRN',
  merfolk: 'pf1/3lV30qfiQaWKB0sp',
  triton: 'pf1/DQGhOq3M3uxTFKYO',
  kobold: 'pf1/LMNzbqGSRAFQFE2Y',
  trox: 'pf1/qdFPM6gztJxvdiRf',
  grippli: 'pf1/MSLlV9YnompTd6xp',
  strix: 'pf1/MF8vCjLIGTmJl3Mo',
  gathlain: 'pf1/ubx4PIbRqmVT93Ds',
  wyvaran: 'pf1/4i8qiF2QnGnPOyKC',
  vanara: 'pf1/VkQBqlEG8GPmNnzI',
  drowNoble: 'pf1/jLZAApW8ymudcJpw',
  ghoran: 'pf1/2mWMyKiPWk6Y8cNx',
  primitiveHuman: 'pf1/m1Yvpz1t8S9x4PPr',
  oread: 'pf1/4qEXPDlfIj1cIvCe',
} as const;
const core = {
  human: 'pf1/e6IaBxKgMxy1yKlr',
  elf: 'pf1/NgIhxRI0axrf3fcO',
  dwarf: 'pf1/nEltI9y37rKJTeWo',
  gnome: 'pf1/efwHEwjvL9Z94MJI',
  halfElf: 'pf1/cCepRrfH5SalFfT4',
  halfOrc: 'pf1/dCAXgdA6Db1Z3ccz',
  halfling: 'pf1/Hf31mrYb3uucNyLO',
} as const;
const trait = (id: string) => `pf1-content/${id}`;
const t = {
  armorMerfolk: trait('8pL6ADeKtZt2FTum'),
  slowSpeedMerfolk: trait('hoHML8zQt0Qib7lN'),
  naturalArmorTriton: trait('HODSs5WDOVKrQJmT'),
  armorKobold: trait('2bzaqSpNN046f9ne'),
  naturalArmorGathlain: trait('Hl9pUifDtWTNl8Ce'),
  ghoranNaturalArmor: trait('DLslPcoXcnvQjIPH'),
  normalSpeedVanara: trait('XORCuKscv4fKV1EH'),
  spellResistanceDrowNoble: trait('JJCX1zB7PDtiyWry'),
  primitiveFeat: trait('9bVCgccjlCuW7YyP'),
  graniteSkin: trait('aD19XOFMcxvFTIYY'),
};

type Artifact = Awaited<ReturnType<typeof importCatalog>>;
let artifact: Artifact;
let coreArtifact: Artifact;
let definitions: CharacterSheetCatalogEntry[];
let coreDefinitions: CharacterSheetCatalogEntry[];
const sheetDefinitions = (from: Artifact) =>
  from.catalog.entries
    .filter((entry) => entry.detail.kind !== 'item')
    .map(sheetDefinition);
beforeAll(async () => {
  [artifact, coreArtifact] = await Promise.all([
    importCatalog(inputsOf(fixtureRoot)),
    importCatalog(inputsOf(coreRoot)),
  ]);
  definitions = sheetDefinitions(artifact);
  coreDefinitions = sheetDefinitions(coreArtifact);
});

function entry(key: string, from = artifact) {
  const found = from.catalog.entries.find((row) => row.externalKey === key);
  if (!found) throw new Error(`Missing fixture entry ${key}`);
  return found;
}
function calculate(raceKey: string, entries: SheetEntry[] = []) {
  const isCore = Object.values<string>(core).includes(raceKey);
  return calculateCharacterSheet(
    raceSheet({
      race: raceKey,
      definitions: [...(isCore ? coreDefinitions : definitions), longsword],
      entries,
    }),
  );
}
function skill(result: ReturnType<typeof calculate>, key: SkillTarget) {
  const found = result.skills.find((row) => row.key === key);
  if (!found) throw new Error(`Missing skill ${key}`);
  return { ranks: found.ranks, total: result.breakdowns[key].total };
}
/** The resolver's size contributions to a statistic. */
function sizeLines(applied: readonly { entryName: string; value: number }[]) {
  return applied
    .filter((row) => row.entryName === 'Size')
    .map((row) => row.value);
}
function unsupportedOf(key: string, field: string, from = artifact) {
  return entry(key, from).unsupported.filter((issue) => issue.field === field);
}

it('copies every fixture record byte for byte from the pinned checkouts', async () => {
  expect(provenance.pins.pf1.commit).toBe(
    '418761d2e16a6037c0156bb4a241f7cea5a2986d',
  );
  expect(provenance.pins['pf1-content'].commit).toBe(
    '02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d',
  );
  for (const source of provenance.rawSources) {
    const text = await readFile(join(fixtureRoot, source.repo, source.path));
    expect(createHash('sha256').update(text).digest('hex'), source.path).toBe(
      source.sha256,
    );
  }
});

describe('skill targets', () => {
  it('counts Elf Keen Senses on Perception: 2 at 0 ranks and Wisdom 10 (CRB p. 22)', () => {
    const elf = calculate(core.elf);
    expect(skill(elf, 'skill.per')).toMatchObject({ ranks: 0, total: 2 });
    expect(elf.abilities.wisdom.score).toBe(10);
  });

  it('counts the other Core Rulebook skill traits on their runtime skills', () => {
    // Halfling: Dex 12, Str 8; Sure-Footed +2 Acrobatics and Climb, Keen
    // Senses +2 Perception (CRB p. 26).
    const halfling = calculate(core.halfling);
    expect(skill(halfling, 'skill.acr').total).toBe(3);
    expect(skill(halfling, 'skill.clm').total).toBe(1);
    expect(skill(halfling, 'skill.per').total).toBe(2);
    // Gnome and Half-Elf Keen Senses (CRB pp. 23, 24); Half-Orc Intimidating
    // (CRB p. 25) before its ability choice is made.
    expect(skill(calculate(core.gnome), 'skill.per').total).toBe(2);
    expect(skill(calculate(core.halfElf), 'skill.per').total).toBe(2);
    expect(skill(calculate(core.halfOrc), 'skill.int').total).toBe(2);
    // Human and Dwarf have no unconditional skill Modifier: Perception is
    // Wisdom alone (Dwarf +2 Wisdom, CRB p. 21).
    expect(skill(calculate(core.human), 'skill.per').total).toBe(0);
    expect(skill(calculate(core.dwarf), 'skill.per').total).toBe(1);
  });

  it('imports only runtime Modifier targets and class skill keys', async () => {
    const catalog = await importCatalog({
      systemPath: resolve('tests/fixtures/catalog/pf1'),
      contentPath: resolve('tests/fixtures/catalog/pf1-content'),
      remaps: [],
    });
    const runtimeTargets = new Set<string>(catalogModifierTargets);
    for (const from of [artifact, coreArtifact, catalog])
      for (const row of [...from.catalog.entries, ...from.catalog.resources]) {
        for (const modifier of row.modifiers)
          expect(runtimeTargets.has(modifier.target), row.name).toBe(true);
        if ('classSkills' in row.detail)
          for (const key of row.detail.classSkills)
            expect(canonicalSkillKey(key), `${row.name}: ${key}`).toBe(key);
      }
  });

  it('gives an imported class its class skills and reports Artistry and Lore, which the sheet lacks', async () => {
    const fighterPath =
      'tests/fixtures/catalog/pf1/packs/classes/fighter.WLqBCT5DqmGAx8Wd.yaml';
    const fighter = mapEntry({
      source: {
        repo: 'pf1',
        pack: 'classes',
        path: fighterPath,
        record: upstreamRecord.parse(
          parse(await readFile(fighterPath, 'utf8')),
        ),
      },
      kind: 'class',
      resolveKey: () => undefined,
      lookup: new Map(),
      spellClassTags: new Set(),
    });
    // CRB p. 55: Climb, Craft, Handle Animal, Intimidate, Knowledge
    // (dungeoneering, engineering), Profession, Ride, Survival and Swim.
    expect(fighter.detail).toMatchObject({
      classSkills: [
        'skill.clm',
        'skill.crf',
        'skill.han',
        'skill.int',
        'skill.kdu',
        'skill.ken',
        'skill.pro',
        'skill.rid',
        'skill.sur',
        'skill.swm',
      ],
    });
    expect(
      fighter.unsupported.filter((issue) => issue.field === 'classSkills'),
    ).toEqual([
      {
        field: 'classSkills',
        reason:
          'The sheet has no Artistry or Lore skill; this class skill stays prose.',
        value: 'art',
      },
      {
        field: 'classSkills',
        reason:
          'The sheet has no Artistry or Lore skill; this class skill stays prose.',
        value: 'lor',
      },
    ]);
    const level: SheetEntry = {
      _id: 'level-1',
      kind: 'classLevel',
      active: true,
      state: {
        kind: 'classLevel',
        classEntryId: fighter.externalKey,
        position: 1,
        hpGained: 10,
        skillRanks: { 'skill.clm': 1 },
      },
    };
    const result = calculateCharacterSheet(
      raceSheet({
        race: core.human,
        definitions: [...coreDefinitions, sheetDefinition(fighter)],
        entries: [level],
      }),
    );
    // One rank and the +3 trained class skill bonus at Str 10.
    expect(skill(result, 'skill.clm')).toMatchObject({ ranks: 1, total: 4 });
  });
});

describe('natural armor', () => {
  it('maps every race and trait natural armor change as a natural armor bonus to AC', () => {
    const naturalArmor = (value: number) => [
      { target: 'ac.natural', bonusType: 'naturalArmor', value },
    ];
    const onAc = (key: string) =>
      entry(key).modifiers.filter((row) => row.target === 'ac.natural');
    // Bestiary p. 155 (Gnoll), ARG pp. 226 and 229 (Lizardfolk, Ogre).
    expect(onAc(race.gnoll)).toEqual(naturalArmor(2));
    expect(onAc(race.lizardfolk)).toEqual(naturalArmor(1));
    expect(onAc(race.ogre)).toEqual(naturalArmor(2));
    // Armor (Merfolk), ARG p. 194: Foundry type `base`.
    expect(onAc(t.armorMerfolk)).toEqual(naturalArmor(2));
    expect(onAc(race.merfolk)).toEqual([]);
    // Triton and Gathlain were `untyped`, Kobold `racial`.
    expect(onAc(t.naturalArmorTriton)).toEqual(naturalArmor(2));
    expect(onAc(t.naturalArmorGathlain)).toEqual(naturalArmor(1));
    expect(onAc(t.armorKobold)).toEqual(naturalArmor(1));
    // Ghoran's checked description output, re-homed by #719, counts once.
    expect(onAc(t.ghoranNaturalArmor)).toEqual(naturalArmor(2));
    for (const key of [race.gnoll, race.lizardfolk, race.ogre, race.merfolk])
      expect(unsupportedOf(key, 'changes')).not.toContainEqual(
        expect.objectContaining({
          value: expect.objectContaining({ target: 'nac' }),
        }),
      );
  });

  it('keeps Granite Skin (Oread) a racial bonus to natural armor', () => {
    // Granite Skin, ARG p. 144: "They gain a +1 racial bonus to natural
    // armor." It is the only race or trait natural armor the pinned text
    // types as racial.
    expect(entry(t.graniteSkin).modifiers).toEqual([
      { target: 'ac.natural', bonusType: 'racial', value: 1 },
    ]);
    expect(entry(t.graniteSkin).detail).toMatchObject({
      raceKeys: [race.oread],
    });
  });

  it("stacks Granite Skin's racial bonus with a fused eidolon's natural armor", () => {
    // Bonuses of different types stack (CRB p. 12), and natural armor stacks
    // with every other AC bonus except another natural armor bonus (CRB
    // p. 179), so the +1 racial bonus adds to the eidolon's natural armor.
    const standard = fusedOread();
    const granite = fusedOread(alternateRow(t.graniteSkin));
    expect(standard.calculated.breakdowns['ac.natural'].total).toBe(0);
    expect(granite.calculated.breakdowns['ac.natural'].total).toBe(1);
    // Summoner 4 (APG Table 2–9): 10 + eidolon natural armor 4 + eidolon
    // Dex 13 (+1) + Shielded Meld 2, and Granite Skin +1.
    expect(standard.form?.armorClass.total).toBe(17);
    expect(granite.form?.armorClass.total).toBe(18);
  });

  it('totals natural armor once on the sheet', () => {
    const natural = (key: string) =>
      calculate(key).breakdowns['ac.natural'].total;
    expect(natural(race.gnoll)).toBe(2);
    expect(natural(race.lizardfolk)).toBe(1);
    expect(natural(race.ogre)).toBe(2);
    expect(natural(race.merfolk)).toBe(2);
    expect(natural(race.triton)).toBe(2);
    expect(natural(race.kobold)).toBe(1);
    expect(natural(race.gathlain)).toBe(1);
    expect(natural(race.ghoran)).toBe(2);
    // Ogre: 10 + natural armor 2 − 1 Large size.
    expect(calculate(race.ogre).derivedStatistics.ac.total).toBe(11);
  });
});

describe('size', () => {
  it("maps each race's size, with Foundry's Medium default when the record has none", () => {
    const sizes = Object.fromEntries(
      Object.entries(race).map(([name, key]) => {
        const { detail } = entry(key);
        return [name, detail.kind === 'race' ? detail.size : undefined];
      }),
    );
    expect(sizes).toEqual({
      ogre: 'large',
      gnoll: 'medium',
      lizardfolk: 'medium',
      merfolk: 'medium',
      triton: 'medium',
      kobold: 'small',
      trox: 'large',
      grippli: 'small',
      strix: 'medium',
      gathlain: 'medium',
      wyvaran: 'medium',
      vanara: 'medium',
      drowNoble: 'medium',
      ghoran: 'medium',
      primitiveHuman: 'medium',
      oread: 'medium',
    });
    expect(entry(core.halfling, coreArtifact).detail).toMatchObject({
      size: 'small',
    });
    expect(entry(core.gnome, coreArtifact).detail).toMatchObject({
      size: 'small',
    });
    expect(entry(core.elf, coreArtifact).detail).toMatchObject({
      size: 'medium',
    });
  });

  // Halfling (CRB p. 26): "+1 size bonus to their AC, a +1 size bonus on
  // attack rolls, a –1 penalty to their CMB and CMD, and a +4 size bonus on
  // Stealth checks"; Fly: "Small +2, Large –2" (CRB p. 96). Ogre (ARG
  // p. 229): "−1 size penalty to their AC, −1 … attack rolls, +1 on combat
  // maneuver checks and to their CMD, and a −4 size penalty on Stealth".
  it.each([
    ['Halfling', core.halfling, 1],
    ['Gnome', core.gnome, 1],
    ['Ogre', race.ogre, -1],
    ['Trox', race.trox, -1],
  ])('applies the size modifiers of a %s once each', (_name, key, step) => {
    const result = calculate(key, [weaponRow, routineRow]);
    expect(sizeLines(result.derivedStatistics.ac.applied)).toEqual([step]);
    expect(sizeLines(result.derivedStatistics.cmb.applied)).toEqual([-step]);
    expect(sizeLines(result.derivedStatistics.cmd.applied)).toEqual([-step]);
    expect(
      sizeLines(result.attackRoutines[0]?.single[0]?.attackBonus.applied ?? []),
    ).toEqual([step]);
    expect(sizeLines(result.breakdowns['skill.ste'].applied)).toEqual([
      4 * step,
    ]);
    expect(sizeLines(result.breakdowns['skill.fly'].applied)).toEqual([
      2 * step,
    ]);
  });

  it('gives a Medium race no size modifier', () => {
    const result = calculate(race.gnoll);
    expect(sizeLines(result.derivedStatistics.ac.applied)).toEqual([]);
    expect(sizeLines(result.breakdowns['skill.ste'].applied)).toEqual([]);
    expect(sizeLines(result.breakdowns['skill.fly'].applied)).toEqual([]);
  });

  it('totals Small Stealth and Fly from Dexterity and size', () => {
    // Halfling Dex 12: Stealth +1 + 4, Fly +1 + 2.
    const halfling = calculate(core.halfling);
    expect(skill(halfling, 'skill.ste').total).toBe(5);
    expect(skill(halfling, 'skill.fly').total).toBe(3);
    // Ogre Dex 10: Stealth −4, Fly −2.
    const ogre = calculate(race.ogre);
    expect(skill(ogre, 'skill.ste').total).toBe(-4);
    expect(skill(ogre, 'skill.fly').total).toBe(-2);
  });
});

describe('speeds and spell resistance', () => {
  const noMovement = 'The sheet has no movement statistic';
  it('reports each race speed as unsupported, with what it would derive', () => {
    const speeds = (key: string) =>
      unsupportedOf(key, 'speeds').map(({ value, reason }) => ({
        value,
        reason,
      }));
    expect(speeds(race.lizardfolk)).toEqual([
      {
        value: { land: 30 },
        reason: `${noMovement}; the land speed stays prose.`,
      },
      {
        value: { swim: 30 },
        reason: `${noMovement}; the swim speed and its +8 racial bonus on Swim checks to perform a special action or avoid a hazard stay prose.`,
      },
    ]);
    expect(speeds(race.grippli)).toContainEqual({
      value: { climb: 20 },
      reason: `${noMovement}; the climb speed and its +8 racial bonus on Climb checks stay prose.`,
    });
    // Strix, ARG: "a fly speed of 60 feet (average maneuverability)"; the
    // record leaves the maneuverability empty, which Foundry reads as average.
    expect(speeds(race.strix)).toContainEqual({
      value: { fly: 60, flyManeuverability: 'average' },
      reason: `${noMovement}; the fly speed, its maneuverability modifier on Fly checks and Fly as a class skill stay prose.`,
    });
    expect(speeds(race.gathlain)).toContainEqual({
      value: { fly: 40, flyManeuverability: 'poor' },
      reason: `${noMovement}; the fly speed, its maneuverability modifier on Fly checks and Fly as a class skill stay prose.`,
    });
    expect(speeds(race.wyvaran)).toContainEqual({
      value: { fly: 30, flyManeuverability: 'clumsy' },
      reason: `${noMovement}; the fly speed, its maneuverability modifier on Fly checks and Fly as a class skill stay prose.`,
    });
    expect(speeds(race.trox)).toContainEqual({
      value: { burrow: 20 },
      reason: `${noMovement}; the burrow speed stays prose.`,
    });
    expect(speeds(race.merfolk).map(({ value }) => value)).toEqual([
      { land: 5 },
      { swim: 50 },
    ]);
  });

  it('derives no Climb, Swim or Fly bonus from a speed', () => {
    // Grippli (Str 8) climbs 20 ft.; Lizardfolk (Str 12) swims 30 ft.;
    // Gathlain (Dex 12) flies with poor maneuverability, Wyvaran (Dex 12)
    // with clumsy.
    expect(skill(calculate(race.grippli), 'skill.clm').total).toBe(-1);
    expect(skill(calculate(race.lizardfolk), 'skill.swm').total).toBe(1);
    expect(skill(calculate(race.gathlain), 'skill.fly').total).toBe(1);
    expect(skill(calculate(race.wyvaran), 'skill.fly').total).toBe(1);
  });

  it('reports trait speed changes, and never counts Vanara Normal Speed as a Climb bonus', () => {
    expect(unsupportedOf(t.slowSpeedMerfolk, 'changes')).toEqual([
      {
        field: 'changes',
        reason: `${noMovement}; this speed change stays prose.`,
        value: {
          target: 'landSpeed',
          formula: '5',
          type: 'base',
          operator: 'set',
        },
      },
      {
        field: 'changes',
        reason: `${noMovement}; this speed change stays prose.`,
        value: {
          target: 'swimSpeed',
          formula: '50',
          type: 'base',
          operator: 'set',
        },
      },
    ]);
    // Normal Speed (Vanara), ARG p. 206: "a base speed of 30 ft and a Climb
    // speed of 20 ft"; Foundry encodes the climb speed as `skill.clm set 20`.
    expect(unsupportedOf(t.normalSpeedVanara, 'changes')).toContainEqual({
      field: 'changes',
      reason:
        "Foundry's `set` operator replaces a value; it is not an additive Modifier and contributes nothing.",
      value: {
        target: 'skill.clm',
        formula: '20',
        type: 'untyped',
        operator: 'set',
      },
    });
    expect(entry(t.normalSpeedVanara).modifiers).toEqual([]);
    // Vanara: no Strength adjustment, so Climb stays 0.
    expect(skill(calculate(race.vanara), 'skill.clm').total).toBe(0);
  });

  it('reports spell resistance as unsupported', () => {
    // Drow Noble, Bestiary p. 115: "spell resistance (SR) equal to 11 plus
    // their total number of class levels".
    expect(unsupportedOf(t.spellResistanceDrowNoble, 'changes')).toEqual([
      {
        field: 'changes',
        reason:
          'The sheet has no spell resistance statistic; this spell resistance stays prose.',
        value: {
          target: 'spellResist',
          formula: '11 + @attributes.hd.total',
          type: 'untyped',
        },
      },
    ]);
  });
});

describe('the other #328 unmapped changes', () => {
  it("gives the Drow Noble's ownerless weapon proficiencies as base types", () => {
    // Bestiary p. 115: "proficient with the hand crossbow, rapier, and short
    // sword".
    expect(entry(race.drowNoble).proficiencies).toEqual([
      { baseType: 'Hand Crossbow' },
      { baseType: 'Rapier' },
      { baseType: 'Shortsword' },
    ]);
    expect(
      calculate(race.drowNoble)
        .racial.proficiencies.map((grant) =>
          'baseType' in grant ? grant.baseType : '',
        )
        .sort(),
    ).toEqual(['Hand Crossbow', 'Rapier', 'Shortsword']);
  });

  it('gives the Outsider creature type its structured weapon proficiency categories', async () => {
    // Bestiary p. 309: "proficient with all simple and martial weapons".
    const catalog = await importCatalog({
      systemPath: resolve('tests/fixtures/catalog/pf1'),
      contentPath: resolve('tests/fixtures/catalog/pf1-content'),
      remaps: [],
    });
    const outsider = catalog.catalog.resources.find(
      (row) => row.externalKey === 'pf1/cV7yHt8i5YCV0ZTd',
    );
    expect(outsider?.proficiencies).toEqual([
      { category: 'simple' },
      { category: 'martial' },
    ]);
  });

  it("reports a race's weapon familiarity when no Racial Trait plan resolves it", async () => {
    // Without the pf1-content pack there is no plan to own or resolve the
    // Drow Noble's named weapons (Bestiary p. 115), so each is reported.
    const path =
      'tests/fixtures/race-facts-720/pf1/packs/races/drow-noble.jLZAApW8ymudcJpw.yaml';
    const drowNoble = mapEntry({
      source: {
        repo: 'pf1',
        pack: 'races',
        path,
        record: upstreamRecord.parse(parse(await readFile(path, 'utf8'))),
      },
      kind: 'race',
      resolveKey: () => undefined,
      lookup: new Map(),
      spellClassTags: new Set(),
    });
    expect(drowNoble.proficiencies).toBeUndefined();
    expect(
      drowNoble.unsupported.filter((issue) => issue.field === 'weaponProf'),
    ).toEqual(
      ['Hand Crossbow', 'Rapier', 'Shortsword'].map((value) => ({
        field: 'weaponProf',
        reason:
          'No Racial Trait plan resolves this weapon familiarity to a pinned weapon base type; it stays prose.',
        value,
      })),
    );
  });

  it('reports Primitive Feat, whose only source is a blog post, as unsupported', () => {
    expect(entry(t.primitiveFeat).grantsSlots).toBeUndefined();
    expect(unsupportedOf(t.primitiveFeat, 'changes')).toEqual([
      {
        field: 'changes',
        reason:
          'No reviewed bonus feat rule: the source is a Paizo blog post, not a published product; it contributes nothing.',
        value: { target: 'bonusFeats', formula: '1', type: 'untyped' },
      },
    ]);
  });

  it("keeps Ghoran's conditional Escape Artist penalty out of its ordinary total", () => {
    // Delicious, Ultimate Wilderness p. 15: "–2 penalty on Escape Artist and
    // combat maneuver checks to escape a grapple against a creature that has
    // a bite attack with the grab ability".
    const ghoran = entry(race.ghoran);
    expect(
      ghoran.modifiers.filter((row) => row.target.startsWith('skill.')),
    ).toEqual([]);
    expect(unsupportedOf(race.ghoran, 'changes')).toEqual([
      {
        field: 'changes',
        reason:
          'Conditional in the source (Delicious, Ultimate Wilderness p. 15: only to escape a grapple against a creature with a bite attack and grab); the checked description note states it, so it contributes nothing.',
        value: { target: 'skill.esc', formula: '-2', type: 'untyped' },
      },
    ]);
    expect(ghoran.situationalNotes).toContainEqual(
      expect.objectContaining({ target: 'skill.esc' }),
    );
    // Dex 10 and no ranks.
    expect(skill(calculate(race.ghoran), 'skill.esc').total).toBe(0);
  });

  it('infers no Racial Hit Dice', () => {
    for (const from of [artifact, coreArtifact])
      for (const row of from.catalog.entries)
        if (row.detail.kind === 'race')
          expect(row.detail.racialHitDice, row.name).toBe(0);
  });
});

describe('import report', () => {
  it('loses no Modifier a race imported as one entry would count', () => {
    // Ghoran's natural armor is the checked description output on its trait;
    // the race's raw change is not counted beside it.
    for (const row of artifact.catalog.racialTraits?.races ?? [])
      expect(row.lostModifiers, row.name).toEqual([]);
    expect(
      artifact.catalog.racialTraits?.races.find(
        (row) => row.externalKey === race.ghoran,
      )?.addedModifiers,
    ).toEqual([]);
  });
});

describe('identities', () => {
  it('re-imports deterministically and keeps the checked #328 race records binding', async () => {
    expect(await importCatalog(inputsOf(fixtureRoot))).toEqual(artifact);
    const checked = curation.records.filter(
      (record) =>
        record.status === 'checked' &&
        Object.values<string>(race).includes(record.externalKey),
    );
    expect(checked.length).toBeGreaterThan(0);
    expect(artifact.curation.stale).toEqual([]);
    const applied = new Set(
      artifact.curation.applied.map(
        (record) => `${record.externalKey}:${record.textSha256}`,
      ),
    );
    for (const record of checked)
      expect(applied.has(`${record.externalKey}:${record.textSha256}`)).toBe(
        true,
      );
  });
});

/** The Core Rulebook longsword, to read the size modifier on an attack. */
const longsword: CharacterSheetCatalogEntry = {
  _id: 'longsword',
  name: 'Longsword',
  ruleIdentity: 'longsword',
  modifiers: [],
  detail: {
    kind: 'item',
    weapon: {
      baseType: 'longsword',
      proficiency: 'martial',
      handedness: 'oneHanded',
      attackType: 'melee',
      dice: '1d8',
      damageTypes: ['slashing'],
      threat: 19,
      mult: 2,
      strengthDamage: 'melee',
    },
  },
};
const weaponRow: SheetEntry = {
  _id: 'weapon-row',
  kind: 'item',
  active: true,
  catalogEntryId: 'longsword',
  state: { kind: 'item' },
};
const routineRow: SheetEntry = {
  _id: 'routine',
  kind: 'attackRoutine',
  active: true,
  state: {
    kind: 'attackRoutine',
    name: 'Longsword',
    weaponEntryId: 'weapon-row',
    hands: 'one',
    mode: 'melee',
  },
};

/**
 * A level 4 Oread Synthesist fused with its eidolon (Ultimate Magic pp. 80–81),
 * with the given extra rows, and the summoner's own sheet.
 */
function fusedOread(...extra: SheetEntry[]) {
  const summoner = raceSheet({
    race: race.oread,
    definitions: [
      ...definitions,
      ...representativeClassCatalog.map((definition) => ({
        ...definition,
        _id: definition.ruleIdentity,
        detail: {
          ...definition.detail,
          counterpartOf:
            representativeClassCounterparts[definition.ruleIdentity],
        },
      })),
      ...representativeArchetypeCatalog,
    ],
    entries: [
      ...extra,
      ...[1, 2, 3, 4].map(
        (position): SheetEntry => ({
          _id: `level-${position}`,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            position,
            classEntryId: 'summoner',
            hpGained: 8,
          },
        }),
      ),
      {
        _id: 'synthesist',
        kind: 'archetype',
        active: true,
        catalogEntryId: 'summoner-synthesist',
        state: { kind: 'archetype', classEntryId: 'summoner' },
      },
    ],
  });
  const calculated = calculateCharacterSheet(summoner);
  const eidolon = calculateCharacterSheet(fusedEidolon, {
    companionProgressionSources: [
      {
        sourceKey: 'fused-eidolon',
        ruleKind: 'synthesistEidolon',
        counting: true,
      },
    ],
    companionLinkedInputs: [
      resolveCompanionLinkedInput({
        input: { kind: 'classLevels', classRuleIdentity: 'summoner' },
        candidates: [
          { sourceKey: 'fused-eidolon', kind: 'available', value: 4 },
        ],
      }),
    ],
  });
  const form = resolveCombinedForm({
    summoner: { input: summoner, calculated },
    eidolon: { kind: 'calculated', calculated: eidolon },
    calculateFused: (options) => calculateCharacterSheet(summoner, options),
  });
  return { calculated, form };
}

/** The biped eidolon of the combined form tests. */
const bipedScores = {
  strength: 16,
  dexterity: 12,
  constitution: 13,
  intelligence: 7,
  wisdom: 10,
  charisma: 11,
};
const fusedEidolon: CharacterSheetInput = {
  characterKind: 'npc',
  entries: [
    {
      _id: 'eidolon-base',
      kind: 'base',
      active: true,
      catalogEntryId: 'eidolon-scores',
      state: { kind: 'base' },
    },
  ],
  catalogEntries: [
    {
      _id: 'eidolon-scores',
      ruleIdentity: 'base',
      modifiers: abilityKeys.map((ability) => ({
        target: abilityTargets[ability],
        bonusType: 'base',
        value: bipedScores[ability],
      })),
    },
  ],
  companionProgression: {
    kind: 'eidolon',
    baseForm: 'biped',
    size: 'medium',
    hpGained: 20,
    skillRanks: {},
    abilityIncreases: [],
    classSkills: [],
    armorBonusAsArmor: 0,
    evolutions: [],
    keep: false,
  },
};
