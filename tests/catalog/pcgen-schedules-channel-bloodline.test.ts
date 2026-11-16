// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  representativeClassCatalog,
  representativeClassFeatureSchedules,
} from '../../convex/lib/representativeClassCatalog';
import { representativeSpellcastingSchedules } from '../../convex/lib/representativeSpellcastingCatalog';
import { parseIdentityLedger } from '../../scripts/catalog/everythingpath-identities';
import ledger from '../../scripts/catalog/everythingpath-identities.json';
import { buildEffectiveView } from '../../scripts/catalog/pcgen/effective';
import {
  assignPcgenIdentities,
  pcgenBookFacts,
} from '../../scripts/catalog/pcgen/identities';
import { inventoryPcgen } from '../../scripts/catalog/pcgen/inventory';
import {
  allIncrementKeys,
  incrementEntries,
  scheduleRows,
} from '../../scripts/catalog/pcgen/schedules';
import { pcgen716JudgmentArcanaFiles } from '../fixtures/pcgen-716/judgment-arcana-files';
import {
  bindArchetypeMapper,
  brief,
  comparePrintedColumns,
  comparePrintedRows,
  listIncrementNames,
  listReplacements,
  pinnedLine,
  planArchetypeBatch,
  readInventoryClass,
  readPrdText,
  scheduleChecks,
  summarizeItems,
} from './pcgen-716-schedules';
import { readPcgenFixtureTree } from './pcgen-716-tree';
import { readPinned } from './pinned-sources';

// #771A (research note 771-p7f-refresh, the Cleric and Sorcerer of the P7f
// launch subset, 716-p7-rules §3): the reviewed schedules of the Cleric and
// Sorcerer, checked against the pinned PCGen, Foundry and PRD files. #772's
// PCGen inputs already hold the Core Rulebook's records, globals and class
// block and the mapped archetypes' books, so the slice adds none. Every
// scenario reads pinned files, never committed curation state.

const tree = await readPcgenFixtureTree(pcgen716JudgmentArcanaFiles);
const view = buildEffectiveView(tree);
const reservedKeys = allIncrementKeys();
const inventory = inventoryPcgen(tree);
const identities = assignPcgenIdentities({
  inventory,
  view,
  ledger: parseIdentityLedger(ledger, { reservedKeys }),
  books: pcgenBookFacts(await readPinned('pf1', 'module/registry/sources.mjs')),
  reservedKeys,
});

const classNames = ['Cleric', 'Sorcerer'] as const;
type ClassName = (typeof classNames)[number];

const { schedule, derive, compare, levelOf, countGrantKinds } = scheduleChecks({
  tree,
  view,
});

const coreRulebookAbilities =
  'roleplaying_game/core_rulebook/cr_abilities_class.lst';
const coreRulebookGlobals =
  'roleplaying_game/core_rulebook/cr_abilities_globalvar.lst';
const channelEnergyLevels = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

describe('the #771A schedules’ numbered variables (note Q1, Q3)', () => {
  it('gives every numbered variable its explicit level', () => {
    // CRB p.40: channel energy 1d6 plus 1d6 every two levels beyond 1st
    // (cleric.html:391). PCGen numbers the ten dice by order
    // (cr_abilities_globalvar.lst:272-281): ChannelEnergy3 is the third die,
    // at 5th, though Ecclesitheurge's text reads it by class level (defect
    // channel-energy-steps).
    expect(levelOf('Cleric', 'ChannelEnergy1')).toEqual(['channel-energy', 1]);
    expect(levelOf('Cleric', 'ChannelEnergy3')).toEqual(['channel-energy', 5]);
    expect(levelOf('Cleric', 'ChannelEnergy10')).toEqual([
      'channel-energy',
      19,
    ]);
    expect(levelOf('Cleric', 'ChannelEnergy11')).toEqual(['unknown']);
    expect(levelOf('Cleric', 'ChannelEnergy')).toEqual([
      'channel-energy',
      null,
    ]);
    // The domains and the spells are named by their flags, which remove
    // nothing in PCGen (defect cleric-unwired-flags).
    expect(levelOf('Cleric', 'Domains')).toEqual(['domains', null]);
    expect(levelOf('Cleric', 'Spellcasting')).toEqual(['spells', null]);
    expect(levelOf('Cleric', 'WeaponProficiencies')).toEqual(['proficiency']);
    expect(levelOf('Cleric', 'ArmorProficiency')).toEqual(['proficiency']);
    expect(levelOf('Cleric', 'SkillRanks')).toEqual(['unknown']);
    // CRB p.72: a bloodline power at 1st, 3rd, 9th, 15th and 20th
    // (sorcerer.html:359-378), each kept through the bloodline's own
    // variable, by class level (cr_abilities_class.lst:2334).
    expect(levelOf('Sorcerer', 'BloodlinePower3')).toEqual(['bloodline', 3]);
    expect(levelOf('Sorcerer', 'BloodlinePower9')).toEqual(['bloodline', 9]);
    expect(levelOf('Sorcerer', 'BloodlinePower20')).toEqual(['bloodline', 20]);
    expect(levelOf('Sorcerer', 'BloodlinePower1')).toEqual(['sharedRow']);
    expect(levelOf('Sorcerer', 'BloodlinePower5')).toEqual(['unknown']);
    expect(levelOf('Sorcerer', 'BloodlinePowers')).toEqual(['notOnTable']);
    expect(levelOf('Sorcerer', 'Bloodline')).toEqual(['bloodline', null]);
    // A bloodline spell at 3rd and every two levels after (sorcerer.html:416),
    // gated by spell level (cr_abilities_class.lst:2338): BloodlineSpell2 is
    // the 2nd-level spell, at 5th.
    expect(levelOf('Sorcerer', 'BloodlineSpell1')).toEqual([
      'bloodline-spell',
      3,
    ]);
    expect(levelOf('Sorcerer', 'BloodlineSpell2')).toEqual([
      'bloodline-spell',
      5,
    ]);
    expect(levelOf('Sorcerer', 'BloodlineSpell9')).toEqual([
      'bloodline-spell',
      19,
    ]);
    expect(levelOf('Sorcerer', 'BloodlineSpells')).toEqual([
      'bloodline-spell',
      null,
    ]);
    // A bloodline feat at 7th and every six levels after (sorcerer.html:417),
    // by class level, as the gates and the archetypes' undefined spelling
    // name them (defect bloodline-feat-flags).
    expect(levelOf('Sorcerer', 'BloodlineFeat13')).toEqual([
      'bloodline-feat',
      13,
    ]);
    expect(levelOf('Sorcerer', 'BloodlineBonusFeat7')).toEqual([
      'bloodline-feat',
      7,
    ]);
    expect(levelOf('Sorcerer', 'BloodlineBonusFeat19')).toEqual([
      'bloodline-feat',
      19,
    ]);
    expect(levelOf('Sorcerer', 'BloodlineFeat8')).toEqual(['unknown']);
    expect(levelOf('Sorcerer', 'BloodlineFeats')).toEqual([
      'bloodline-feat',
      null,
    ]);
    expect(levelOf('Sorcerer', 'WeaponProficiencies')).toEqual(['proficiency']);
  });

  it('reads the bloodline power, spell and feat gates as PCGen levels them', () => {
    const { gatedParts } = derive('Sorcerer');
    // cr_abilities_class.lst:1711-1713: removal gates on the feat
    // progression, which the Bloodline Tracker binds to the sorcerer level.
    expect(gatedParts.get('BloodlineFeat13')).toMatchObject({
      at: `${coreRulebookAbilities}:1712`,
      polarity: 'removal',
    });
    // Each bloodline keeps its spells while the flag is unset.
    expect(gatedParts.get('BloodlineSpell2')?.polarity).toBe('kept');
    // Each bloodline binds its powers to the flags (aberrant, :2334).
    expect(gatedParts.get('BloodlinePower9')?.polarity).toBe('kept');
    expect(gatedParts.get('BloodlinePower9')?.binding).toBeDefined();
    // Nothing gates the channel energy dice.
    for (let die = 1; die <= 10; die += 1)
      expect(derive('Cleric').gatedParts.has(`ChannelEnergy${die}`)).toBe(
        false,
      );
  });
});

describe('each #771A schedule against the PRD’s class table (owner decision 8)', () => {
  it('prints every row at its level, with its label, in the cited table row', async () => {
    for (const className of classNames) {
      const { printedTable } = schedule(className);
      if (printedTable?.status !== 'reviewed')
        throw new Error(`${className} has no reviewed table.`);
      const rows = await comparePrintedRows(schedule(className));
      expect(
        rows.map(({ level, line }) => [level, line]),
        className,
      ).toEqual(
        Array.from({ length: 20 }, (_, index) => [
          index + 1,
          printedTable.firstRow + index,
        ]),
      );
      for (const row of rows)
        expect(row.schedule, `${className} ${row.level}`).toEqual(row.table);
    }
    // Table: Cleric, 1st level: "Aura, channel energy 1d6, domains, orisons";
    // 19th: "Channel energy 10d6"; 20th prints nothing.
    const clericRows = await comparePrintedRows(schedule('Cleric'));
    expect(clericRows[0]?.table).toEqual([
      'aura',
      'channel energy 1d6',
      'domains',
      'orisons',
    ]);
    expect(clericRows[18]?.table).toEqual(['channel energy 10d6']);
    expect(clericRows[19]?.table).toEqual([]);
    // Table: Sorcerer, 1st level: "Bloodline power, cantrips, eschew
    // materials"; 7th: "Bloodline feat, bloodline spell".
    const sorcererRows = await comparePrintedRows(schedule('Sorcerer'));
    expect(sorcererRows[0]?.table).toEqual([
      'bloodline power',
      'cantrips',
      'eschew materials',
    ]);
    expect(sorcererRows[6]?.table).toEqual([
      'bloodline feat',
      'bloodline spell',
    ]);
    expect(sorcererRows[19]?.table).toEqual(['bloodline power']);
  });

  it('cites the casting the Special column doesn’t print as unprinted, and prints no value column', async () => {
    const readUnprinted = (className: ClassName) => {
      const { printedTable } = schedule(className);
      if (printedTable?.status !== 'reviewed')
        throw new Error(`${className} has no reviewed table.`);
      return Object.keys(printedTable.unprinted);
    };
    // CLR:396, :399, :385; orisons are printed at 1st (CLR:360).
    expect(readUnprinted('Cleric')).toEqual([
      'alignment-spells',
      'spells',
      'spontaneous-casting',
    ]);
    // SOR:410, :413; cantrips are printed at 1st (SOR:359).
    expect(readUnprinted('Sorcerer')).toEqual(['spells', 'exchange-spell']);
    // Channel energy's dice are printed in the Special column, the spells per
    // day in columns `classTableRows` can't name (prd-coverage.ts).
    for (const className of classNames)
      expect(await comparePrintedColumns(schedule(className))).toEqual([]);
  });
});

describe('PCGen’s schedule against each table (note Q7)', () => {
  it('settles every difference between PCGen, Foundry and the table with a cited decision or defect', async () => {
    for (const className of classNames)
      expect(
        (await compare(className)).filter(({ settledBy }) => !settledBy),
        className,
      ).toEqual([]);
    // CRB p.40: the aura and the domains are granted with no flag; channel
    // energy's ten dice are defined but gate nothing; PCGen grants no
    // alignment spells or spells row; bonus languages are class text.
    expect(brief(await compare('Cleric'))).toEqual([
      ['ungatedGrant', 'aura', 'decision:aura'],
      ['ungatedGrant', 'domains', 'decision:domains'],
      ['ungatedParts', 'channel-energy', 'decision:channel-energy'],
      ['foundryOnly', 'alignment-spells', 'decision:alignment-spells'],
      ['foundryOnly', 'spells', 'decision:spells'],
      ['nonRow', 'pf1/EvrFDqZDbbFS4Avb', 'foundryNonRow:pf1/EvrFDqZDbbFS4Avb'],
    ]);
    // CRB p.72: the weapon and armor proficiency grant is no table row;
    // PCGen grants no bloodline spell, exchange or bloodline feat row, and
    // gates the feats on three flags it never defines.
    expect(brief(await compare('Sorcerer'))).toEqual([
      ['nonRow', 'WeaponProficiencies', 'nonRow:WeaponProficiencies'],
      ['foundryOnly', 'bloodline-spell', 'decision:bloodline-spell'],
      ['foundryOnly', 'exchange-spell', 'decision:exchange-spell'],
      ['foundryOnly', 'bloodline-feat', 'decision:bloodline-feat'],
      ['undefinedPart', 'bloodline-feat', 'bloodline-feat-flags'],
      ['undefinedPart', 'bloodline-feat', 'bloodline-feat-flags'],
      ['undefinedPart', 'bloodline-feat', 'bloodline-feat-flags'],
    ]);
  });

  it('records the bloodline feat flags as gated and never defined, and the archetypes’ spelling as never read (defect bloodline-feat-flags)', async () => {
    expect(
      await pinnedLine('pcgen', `${coreRulebookAbilities}:1711`),
    ).toContain(
      'PREVARGTEQ:BloodlineFeatProgression,7|PREVAREQ:Sorcerer_CF_BloodlineFeat7,1',
    );
    const { defined, gatedParts } = derive('Sorcerer');
    for (const level of [7, 13, 19]) {
      expect(defined.has(`BloodlineFeat${level}`)).toBe(false);
      expect(defined.has(`BloodlineBonusFeat${level}`)).toBe(false);
      expect(gatedParts.has(`BloodlineBonusFeat${level}`)).toBe(false);
    }
    // BloodlineFeats is defined and bridged, and gates nothing
    // (cr_abilities_globalvar.lst:990, :1011).
    expect(defined.has('BloodlineFeats')).toBe(true);
    expect(
      schedule('Sorcerer').defects.find(
        ({ id }) => id === 'bloodline-feat-flags',
      )?.suffixes,
    ).toEqual([
      'BloodlineFeat7',
      'BloodlineFeat13',
      'BloodlineFeat19',
      'BloodlineBonusFeat7',
      'BloodlineBonusFeat13',
      'BloodlineBonusFeat19',
      'BloodlineFeats',
    ]);
  });

  it('records the cleric’s flags that remove nothing as defects, never as behaviour', async () => {
    // cr_abilities_class.lst:221: the domains are granted with no flag;
    // :216, the proficiency record, likewise. The flags are defined and
    // bridged (cr_abilities_globalvar.lst:263-271, :287-298).
    expect(await pinnedLine('pcgen', `${coreRulebookAbilities}:221`)).toBe(
      'CATEGORY=Class|Cleric.MOD\tABILITY:Cleric Class Feature|AUTOMATIC|Cleric ~ Domains|PREVARGTEQ:Cleric_CFP_Level,1',
    );
    const { defined } = derive('Cleric');
    const unwired = schedule('Cleric').defects.find(
      ({ id }) => id === 'cleric-unwired-flags',
    );
    expect(unwired?.suffixes).toEqual([
      'Domains',
      'Spellcasting',
      'SkillRanks',
      'Proficiencies',
      'ArmorProficiencies',
      'WeaponProficiencies',
      'ArmorProficiency',
      'WeaponProficiency',
    ]);
    for (const suffix of unwired?.suffixes ?? [])
      expect(defined.has(suffix), suffix).toBe(true);
    // The channel energy dice: defined, bridged and read by nothing.
    const steps = schedule('Cleric').defects.find(
      ({ id }) => id === 'channel-energy-steps',
    );
    expect(steps?.suffixes).toEqual(
      channelEnergyLevels.map((_, index) => `ChannelEnergy${index + 1}`),
    );
    expect(await pinnedLine('pcgen', `${coreRulebookGlobals}:274`)).toBe(
      'CATEGORY=Class|Cleric.MOD\tDEFINE:Cleric_CF_ChannelEnergy3|0',
    );
    for (const suffix of steps?.suffixes ?? [])
      expect(defined.has(suffix), suffix).toBe(true);
  });
});

describe('P7-0’s grant kinds in the #771A classes (note Q7)', () => {
  it('reads the cleric’s gated and ungated grants and the sorcerer’s gated grants', () => {
    // cr_abilities_class.lst:217-221 (the proficiency record at :216 is a
    // Special Ability, no class feature grant); :306-310.
    expect(
      Object.fromEntries(
        classNames.map((name) => [name, countGrantKinds(name)]),
      ),
    ).toEqual({ Cleric: [3, 2, 0], Sorcerer: [5, 0, 0] });
  });
});

describe('formula rows, skill ranks and bridges (note Q1, Q2, Q6)', () => {
  it('holds only channel energy’s later rows in the schedule alone, and numbers every other repeating feature', async () => {
    const formulaHeld: Record<ClassName, string[]> = {
      // The dice are listed as parts that gate nothing (ungatedParts).
      Cleric: ['channel-energy'],
      // Bloodline powers, spells and feats are numbered (note Q2).
      Sorcerer: [],
    };
    for (const className of classNames) {
      const findings = await compare(className);
      expect(
        findings
          .filter(({ kind }) => kind === 'formulaIncrement')
          .map(({ feature }) => feature),
        className,
      ).toEqual([]);
      expect(
        findings
          .filter(({ kind }) => kind === 'ungatedParts')
          .map(({ feature, settledBy }) => [feature, settledBy]),
        className,
      ).toEqual(formulaHeld[className].map((id) => [id, `decision:${id}`]));
      const { gatedParts } = derive(className);
      for (const feature of schedule(className).features)
        if (
          feature.levels.length > 1 &&
          !formulaHeld[className].includes(feature.id)
        )
          expect(
            Object.keys(feature.parts).some((part) => gatedParts.has(part)),
            `${className} ${feature.id}`,
          ).toBe(true);
    }
  });

  it('gives channel energy a row per die its table prints, its dice computed from the class level (CLR:360-378)', async () => {
    const channel = schedule('Cleric').features.find(
      ({ id }) => id === 'channel-energy',
    );
    expect(channel?.levels).toEqual(channelEnergyLevels);
    expect(channel?.increments).toBe('formula');
    expect(listIncrementNames(schedule('Cleric'))).toEqual(
      Object.fromEntries(
        channelEnergyLevels
          .slice(1)
          .map((level, index) => [
            `everythingpath/cleric-channel-energy-${level}`,
            `Channel Energy ${index + 2}d6`,
          ]),
      ),
    );
    // channel-energy.kXXz1lO4i7CibHJ9.yaml:19; PCGen's dice,
    // (ClericChannelEnergyLVL+1)/2 (cr_abilities_class.lst:574).
    expect(
      await pinnedLine('pf1', channel?.acquisitionFormula ?? ''),
    ).toContain('formula: (ceil(@class.level / 2))d6');
    expect(await pinnedLine('pcgen', `${coreRulebookAbilities}:574`)).toContain(
      'Cleric ~ Channel Positive Energy',
    );
  });

  it('gives each class the skill ranks per level of its table, as Foundry records them', async () => {
    // Cleric 2, sorcerer 2 ranks + Int modifier (CLR:354, SOR:353).
    const ranks = await Promise.all(
      classNames.map(async (className) => {
        const { skillRanksPerLevel, skillRanksAt, foundryFile } =
          schedule(className);
        expect(skillRanksAt.split(':')[0]).toBe(foundryFile);
        expect(await pinnedLine('pf1', skillRanksAt)).toBe(
          `  skillsPerLevel: ${skillRanksPerLevel}`,
        );
        return skillRanksPerLevel;
      }),
    );
    expect(ranks).toEqual([2, 2]);
  });

  it('reads the TYPE bridges from the global variables, not by spelling', () => {
    // cr_abilities_globalvar.lst:310: TYPE.ClericChannelEnergy sets the
    // whole channel energy; no bridge names a die.
    const bridges = derive('Cleric').typeBridges;
    expect(bridges.get('ClericChannelEnergy')).toBe('ChannelEnergy');
    expect(bridges.has('ClericChannelEnergy3')).toBe(false);
  });

  it('cites the Foundry lines that compute the repeating features’ increments', async () => {
    const readAcquisitionFormula = (id: string) =>
      schedule('Sorcerer').features.find((feature) => feature.id === id)
        ?.acquisitionFormula ?? '';
    // bloodline-feat-sor.W1KWAZxUNxfCv8rG.yaml:13.
    expect(
      await pinnedLine('pf1', readAcquisitionFormula('bloodline-feat')),
    ).toContain('formula: floor((@class.level - 1) / 6)');
    // The bloodline and its spells compute nothing from the level.
    expect(readAcquisitionFormula('bloodline')).toBe('');
    expect(readAcquisitionFormula('bloodline-spell')).toBe('');
  });
});

describe('per-increment identities (note Q1, item 7)', () => {
  it('repeats no key in either class’s featuresByLevel, and keys every later row by its slug', () => {
    for (const className of classNames) {
      const reviewed = schedule(className);
      const keys = scheduleRows(reviewed).map(({ externalKey }) => externalKey);
      expect(new Set(keys).size, className).toBe(keys.length);
      for (const entry of incrementEntries(reviewed)) {
        expect(entry.externalKey).toMatch(
          new RegExp(`^everythingpath/${reviewed.slug}-[a-z-]+-\\d+$`),
        );
        expect(entry.modifiers).toEqual([]);
      }
    }
    expect(
      Object.fromEntries(
        classNames.map((className) => [
          className,
          [
            schedule(className).features.length,
            incrementEntries(schedule(className)).length,
            scheduleRows(schedule(className)).length,
          ],
        ]),
      ),
    ).toEqual({
      // 7 features; channel energy 9.
      Cleric: [7, 9, 16],
      // 7 features; bloodline powers 4, bloodline spells 8, bloodline feats 2.
      Sorcerer: [7, 14, 21],
    });
  });

  it('names the later rows by their table labels', () => {
    expect(listIncrementNames(schedule('Sorcerer'))).toEqual({
      'everythingpath/sorcerer-bloodline-3': 'Bloodline Power',
      'everythingpath/sorcerer-bloodline-9': 'Bloodline Power',
      'everythingpath/sorcerer-bloodline-15': 'Bloodline Power',
      'everythingpath/sorcerer-bloodline-20': 'Bloodline Power',
      ...Object.fromEntries(
        [5, 7, 9, 11, 13, 15, 17, 19].map((level) => [
          `everythingpath/sorcerer-bloodline-spell-${level}`,
          'Bloodline Spell',
        ]),
      ),
      'everythingpath/sorcerer-bloodline-feat-13': 'Bloodline Feat',
      'everythingpath/sorcerer-bloodline-feat-19': 'Bloodline Feat',
    });
  });

  it('gives the level-1 domains and bloodline rows the representative seeds give', () => {
    // convex/lib/representativeSpellcastingCatalog.ts:453, :455, merged
    // into representativeClassFeatureSchedules: each class's only seeded
    // row. Domains are a casting row and stay in.
    for (const [className, identity, feature] of [
      ['Cleric', 'cleric', 'domains'],
      ['Sorcerer', 'sorcerer', 'bloodline'],
    ] as const) {
      const seeded = (representativeClassFeatureSchedules[identity] ?? []).map(
        ({ classLevel, catalogEntryId }) => [
          classLevel,
          catalogEntryId.replace(`${identity}-`, ''),
        ],
      );
      expect(seeded, className).toEqual([[1, feature]]);
      expect(representativeSpellcastingSchedules[identity]).toEqual(
        representativeClassFeatureSchedules[identity],
      );
      expect(
        scheduleRows(schedule(className))
          .filter((row) => row.classLevel === 1 && row.feature === feature)
          .map(({ classLevel, feature: id }) => [classLevel, id]),
        className,
      ).toEqual(seeded);
    }
  });

  it('agrees with the seeds’ ranks, class skills and proficiencies', async () => {
    const readSeed = (identity: string) => {
      const seed = representativeClassCatalog.find(
        ({ ruleIdentity }) => ruleIdentity === identity,
      );
      if (seed?.detail.kind !== 'class')
        throw new Error(`No ${identity} seed.`);
      return { ...seed, detail: seed.detail };
    };
    const readFoundrySkills = (text: string) =>
      [...text.matchAll(/^ {4}([a-z]{3}): true$/gm)]
        .map(([, id]) => `skill.${id}`)
        .filter((id) => id !== 'skill.art' && id !== 'skill.lor');
    for (const className of classNames) {
      const reviewed = schedule(className);
      const seed = readSeed(reviewed.slug);
      expect(seed.detail.featuresByLevel).toEqual([]);
      expect(seed.detail.skillRanksPerLevel).toBe(reviewed.skillRanksPerLevel);
    }
    // CLR:353 prints thirteen class skills, Craft among them; Foundry lists
    // twelve of them, no Craft, and the background skill Lore
    // (cleric.SjFqQceVeVBzBwgn.yaml:20-33).
    const cleric = readSeed('cleric');
    const clericFoundry = await readPinned(
      'pf1',
      schedule('Cleric').foundryFile,
    );
    expect(cleric.detail.classSkills).toHaveLength(13);
    expect(readFoundrySkills(clericFoundry)).toEqual(
      cleric.detail.classSkills.filter((id) => id !== 'skill.crf'),
    );
    // CLR:383: simple weapons, the deity's favored weapon, light and medium
    // armor and shields; Foundry's armorProf and weaponProf (:8-11, :96-98).
    expect(cleric.proficiencies).toEqual([
      { category: 'simple' },
      { category: 'light' },
      { category: 'medium' },
      { category: 'shield' },
      { choice: true },
    ]);
    expect(clericFoundry).toContain(
      'armorProf:\n    - lgt\n    - med\n    - shl\n',
    );
    expect(clericFoundry).toContain(
      'weaponProf:\n    - simple\n    - Favored Weapon\n',
    );
    // SOR:352: nine class skills; Foundry adds Artistry and Lore
    // (sorcerer.AoWSbnuTSGIxmv61.yaml:15-26). SOR:409: simple weapons, no
    // armor; the seed names no proficiencies.
    const sorcerer = readSeed('sorcerer');
    const sorcererFoundry = await readPinned(
      'pf1',
      schedule('Sorcerer').foundryFile,
    );
    expect(readFoundrySkills(sorcererFoundry)).toEqual(
      sorcerer.detail.classSkills,
    );
    expect(sorcerer.detail.classSkills).toHaveLength(9);
    expect(sorcerer.proficiencies).toBeUndefined();
    expect(sorcererFoundry).toContain('weaponProf:\n    - simple\n');
    expect(sorcererFoundry).not.toContain('armorProf');
  });
});

// One published archetype per class through the mapper (note Q5), each in a
// sub-batch of at most 100 keys (plan Appendix G), each mapped on the class
// the inventory gives it.
const { mapPublishedArchetype } = bindArchetypeMapper({
  tree,
  view,
  identities,
});
const mapInventoryArchetype = (archetype: string) =>
  mapPublishedArchetype({
    className: readInventoryClass({ inventory, archetype }),
    archetype,
  });

describe('the #771A archetypes through the mapper (note Q2, Q5)', () => {
  it('assigns every cleric and sorcerer archetype of the tree to its class', () => {
    for (const className of classNames) {
      const owned = inventory.owners.filter(({ record }) =>
        record.locator.key.startsWith(`${className} Archetype ~ `),
      );
      expect(owned.length, className).toBeGreaterThan(0);
      for (const { record, className: assigned } of owned)
        expect(assigned, record.locator.key).toBe(className);
    }
  });

  it('Cleric: Ecclesitheurge removes the third channel energy die by order, held on the dice defect and on channel energy’s formula', async () => {
    // ACG p.91: bonded holy symbol "replaces the increase to channel energy
    // gained at 3rd level", by class level the 2d6 row, while PCGen's
    // ChannelEnergy3 (acg_abilities_class.lst:4633, TYPE :3014) is the
    // third die by order, at 5th; domain mastery "alters the domains
    // ability", which no flag marks; the proficiency is replaced
    // (advancedClassGuide/classOptions/cleric.html:351, :356, :359).
    const page = await readPrdText({
      page: 'advancedClassGuide/classOptions/cleric.html',
      from: 351,
      to: 359,
    });
    expect(page).toContain(
      "This ability replaces the cleric's weapon and armor proficiency.",
    );
    expect(page).toContain('This ability alters the domains ability.');
    expect(page).toContain(
      'This ability replaces the increase to channel energy gained at 3rd level.',
    );
    const archetype = 'Cleric Archetype ~ Ecclesitheurge';
    expect(readInventoryClass({ inventory, archetype })).toBe('Cleric');
    const mapping = mapInventoryArchetype(archetype);
    expect(listReplacements(mapping)).toEqual([
      [5, 'everythingpath/cleric-channel-energy-5', 'part'],
    ]);
    expect(summarizeItems(mapping)).toEqual([
      ['conflict', 'partialFormula:channel-energy'],
      ['conflict', 'defect:channel-energy-steps'],
      ['conflict', 'defect:cleric-unwired-flags'],
      ['conflict', 'stackingGuard'],
    ]);
    // Its proficiency flags stay prose (plan §4).
    expect(
      mapping.subject.entry.unsupported.map(({ field }) => field),
    ).toContain('proficiencies');
    expect(planArchetypeBatch({ className: 'Cleric', mapping })).toEqual([5]);
  });

  it('Sorcerer: Eldritch Scrapper replaces the 9th- and 15th-level bloodline powers; the 1st-level power and the powers flag are held for review', async () => {
    // ACG p.110: martial flexibility "replaces the sorcerer's bloodline
    // powers gained 1st, 9th, and 15th levels"
    // (advancedClassGuide/classOptions/sorcerer.html:354). PCGen sets
    // BloodlinePowers beside BloodlinePower1, 9 and 15
    // (acg_abilities_class.lst:4685): BloodlinePowers gates only each
    // bloodline's descriptive Bloodline Powers record (aberrant,
    // cr_abilities_class.lst:2334, :2342), so it is no row, and the
    // 1st-level power shares the Bloodline row.
    const page = await readPrdText({
      page: 'advancedClassGuide/classOptions/sorcerer.html',
      from: 354,
      to: 354,
    });
    expect(page).toContain(
      "This ability replaces the sorcerer's bloodline powers gained 1st, 9th, and 15th levels.",
    );
    const archetype = 'Sorcerer Archetype ~ Eldritch Scrapper';
    expect(readInventoryClass({ inventory, archetype })).toBe('Sorcerer');
    const mapping = mapInventoryArchetype(archetype);
    expect(listReplacements(mapping)).toEqual([
      [9, 'everythingpath/sorcerer-bloodline-9', 'part'],
      [15, 'everythingpath/sorcerer-bloodline-15', 'part'],
    ]);
    // Its record's TYPEs (acg_abilities_class.lst:3800) name the powers
    // SorcererBloodlinePowerLvl1, 9 and 15, which no bridge resolves (PCGen
    // bridges only TYPE.SorcererWeaponProficiencies and EschewMaterials,
    // cr_abilities_globalvar.lst:1032-1033), and its category TYPE is
    // spelled "Sorcerer Archetype", which the mapper skips only unspaced:
    // each names no feature and stays for review. Its PREMULT guard names
    // the same TYPEs and its own Archetype_Bloodline marks.
    expect(summarizeItems(mapping)).toEqual([
      ['unmatchedReplacement', 'unknown: Archetype'],
      ['unmatchedReplacement', 'unknown:BloodlinePowerLvl1'],
      ['unmatchedReplacement', 'unknown:BloodlinePowerLvl9'],
      ['unmatchedReplacement', 'unknown:BloodlinePowerLvl15'],
      ['unmatchedReplacement', 'notOnTable:BloodlinePowers'],
      ['unmatchedReplacement', 'sharedRow:BloodlinePower1'],
      ['conflict', 'stackingGuard'],
      ['conflict', 'stackingGuard#2'],
    ]);
    expect(planArchetypeBatch({ className: 'Sorcerer', mapping })).toEqual([3]);
  });

  it('counts the casting rows of each class', () => {
    // The domains add domain spell slots (CLR:392-393), as the wizard's
    // arcane school adds a school slot; the bloodline spells add to the
    // spells known (SOR:416).
    expect(
      schedule('Cleric')
        .features.filter(({ casting }) => casting)
        .map(({ id }) => id),
    ).toEqual([
      'alignment-spells',
      'spells',
      'domains',
      'orisons',
      'spontaneous-casting',
    ]);
    expect(
      schedule('Sorcerer')
        .features.filter(({ casting }) => casting)
        .map(({ id }) => id),
    ).toEqual(['cantrips', 'spells', 'bloodline-spell', 'exchange-spell']);
  });
});
