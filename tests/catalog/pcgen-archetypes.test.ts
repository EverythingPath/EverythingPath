// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { representativeArchetypeCatalog } from '../../convex/lib/representativeArchetypeCatalog';
import { representativeClassCatalog } from '../../convex/lib/representativeClassCatalog';
import { parseCuration } from '../../scripts/catalog/curation';
import {
  locatorKeyOf,
  parseIdentityLedger,
} from '../../scripts/catalog/everythingpath-identities';
import ledger from '../../scripts/catalog/everythingpath-identities.json';
import { pcgenPin } from '../../scripts/catalog/inventory';
import {
  archetypeClassContext,
  mapArchetype,
  stackingConflicts,
  type ArchetypeMapping,
} from '../../scripts/catalog/pcgen/archetypes';
import { buildEffectiveView } from '../../scripts/catalog/pcgen/effective';
import {
  assignPcgenIdentities,
  pcgenBookFacts,
} from '../../scripts/catalog/pcgen/identities';
import { inventoryPcgen } from '../../scripts/catalog/pcgen/inventory';
import { archetypeProficiencyProseReason } from '../../scripts/catalog/launch-prose-categories';
import type { PcgenRecord } from '../../scripts/catalog/pcgen/lst';
import {
  allIncrementKeys,
  foundryAssociations,
  incrementEntries,
  reviewedSchedule,
  scheduleRows,
} from '../../scripts/catalog/pcgen/schedules';
import {
  applyStructureCuration,
  hashStructureSource,
} from '../../scripts/catalog/structure-curation';
import type {
  CharacterSheetCatalogEntry,
  CharacterSheetInput,
} from '../../src/lib/character-sheet';
import { resolveCharacterSheetArchetypes } from '../../src/lib/character-sheet-archetypes';
import { preparedArchetypeDetail } from '../../src/lib/catalog/imported-archetype';
import {
  acrobatDetail,
  foundryRogue,
  foundryUnchainedRogue,
} from '../../src/components/character-sheet/acrobat-test-fixture';
import { pcgen716ArchetypeFiles } from '../fixtures/pcgen-716/archetype-files';
import { readPcgenFixtureTree } from './pcgen-716-tree';
import { readPinned } from './pinned-sources';

const tree = await readPcgenFixtureTree(pcgen716ArchetypeFiles);
const view = buildEffectiveView(tree);
const inventory = inventoryPcgen(tree);
const identities = assignPcgenIdentities({
  inventory,
  view,
  ledger: parseIdentityLedger(ledger, { reservedKeys: allIncrementKeys() }),
  books: pcgenBookFacts(await readPinned('pf1', 'module/registry/sources.mjs')),
  reservedKeys: allIncrementKeys(),
});

const apg = 'roleplaying_game/advanced_players_guide/apg_abilities_class.lst';
const ui = 'roleplaying_game/ultimate_intrigue/ui_abilities_class.lst';
const pfsfg =
  'campaign_setting/pathfinder_society_field_guide/pfsfg_abilities_class.lst';
const keys = {
  fighter: 'pf1/WLqBCT5DqmGAx8Wd',
  rogue: 'pf1/24b0LaabeAlUx5gN',
  ranger: 'pf1/w3wjj6s3N69BsMc3',
  bravery: 'pf1/h0Brxw6khcjlEf1T',
  armorTraining: 'pf1/5JFfSqLMCpbRmERa',
  weaponTraining: 'pf1/RzEzudurxQFirFoF',
  armorMastery: 'pf1/NwTe1Q2utlsmOAqK',
  uncannyDodge: 'pf1/7WaQxnVaaoL4AGr8',
  improvedUncannyDodge: 'pf1/ZfnHhhTFQVo0Lj4P',
  favoredEnemy: 'pf1/XmALhWqXdN9yOmtd',
  wildEmpathy: 'pf1/Yr8dfM2d8JEWoYkr',
  combatStyle: 'pf1/BO7BEFHDcf6qBaYV',
  favoredTerrain: 'pf1/U2YBSx1s8cT8iDq1',
  huntersBond: 'pf1/Bs5i98ja24ODe9WL',
  spells: 'pf1/Xi5BENHWBu1hLHKl',
  woodlandStride: 'pf1/5iXq1igb1Cq0qobT',
  camouflage: 'pf1/E90iE6Ynyq1cgGXA',
};

function map(className: string, name: string): ArchetypeMapping {
  const record = tree.archetypes.find(
    ({ locator }) => locator.key === `${className} Archetype ~ ${name}`,
  );
  const schedule = reviewedSchedule(className);
  if (!record || !schedule) throw new Error(`No ${className} ${name}.`);
  // Plan §5 keys through P6's identity assignment over the fixture tree: the
  // ledger's where it holds the record, else derived from the KEY, a feature
  // several owners grant keyed once under its first owner.
  const keyOf = (keys: ReadonlyMap<string, string>, found: PcgenRecord) => {
    const key = keys.get(
      locatorKeyOf({ source: 'pcgen', locator: found.locator }),
    );
    if (!key) throw new Error(`No key for ${found.locator.key}.`);
    return key;
  };
  const ownerKey = keyOf(identities.owners.keys, record);
  const featureKeyOf = (feature: PcgenRecord) =>
    keyOf(identities.features.keys, feature);
  return mapArchetype({
    context: archetypeClassContext({ tree, view, schedule }),
    record,
    externalKey: ownerKey,
    featureKeyOf,
  });
}
const archer = map('Fighter', 'Archer');
const scout = map('Rogue', 'Scout');
const beastMaster = map('Ranger', 'Beast Master');
const skirmisher = map('Ranger', 'Skirmisher');
const dandy = map('Ranger', 'Dandy');
const loreWarden = map('Fighter', 'Lore Warden');

const detailOf = ({ subject }: ArchetypeMapping) => subject.entry.detail;
const itemsOf = ({ items }: ArchetypeMapping) =>
  items.map(({ externalKey, kind, id }) => [externalKey, kind, id]);
const ownedOf = ({ ownedFeatures }: ArchetypeMapping) =>
  ownedFeatures.map(({ locator }) => locator).sort();
const inventoryRowsOf = (key: string) =>
  inventory.rows
    .filter(
      (row) =>
        row.owner.record.locator.key === key && row.depth === 1 && row.feature,
    )
    .map(
      ({ feature }) => `pcgen:${feature?.locator.file}#${feature?.locator.key}`,
    )
    .sort();

async function pinnedLines(file: string) {
  return (await readPinned('pcgen', `${pcgenPin.directory}/${file}`)).split(
    /\r?\n/,
  );
}
const apgLines = await pinnedLines(apg);
const part = (file: string, lines: string[], line: number, key: string) => ({
  source: { source: 'pcgen' as const, locator: { file, line, key } },
  text: lines[line - 1] ?? '',
});

describe('the PCGen archetype mapper (#716 P5, plan §4)', () => {
  it('maps Archer: whole removals by variable name, its additions at their PRECLASS levels', () => {
    // APG p.104; apg_abilities_class.lst:2102 (TYPE …FighterBravery
    // .FighterArmorTraining_ALL.FighterWeaponTraining_ALL.FighterArmorMastery)
    // and its .MOD line :3667 (FACT:Fighter_CF_Bravery|true and the rest).
    expect(detailOf(archer)).toEqual({
      kind: 'archetype',
      classKeys: [keys.fighter],
      replaces: [
        { classLevel: 2, externalKey: keys.bravery, scope: 'whole' },
        { classLevel: 3, externalKey: keys.armorTraining, scope: 'whole' },
        { classLevel: 5, externalKey: keys.weaponTraining, scope: 'whole' },
        { classLevel: 19, externalKey: keys.armorMastery, scope: 'whole' },
      ],
      adds: [
        [2, 'hawkeye'],
        [3, 'trick-shot'],
        [5, 'expert-archer'],
        [9, 'safe-shot'],
        [13, 'evasive-archer'],
        [17, 'volley'],
        [19, 'ranged-defense'],
        // PCGen grants it at Fighter 1 (:2102); the book's level-20 choice
        // is the review item below.
        [1, 'weapon-mastery'],
      ].map(([classLevel, feature]) => ({
        classLevel,
        externalKey: `everythingpath/fighter-archer-${feature}`,
      })),
      featureChanges: [
        keys.bravery,
        keys.armorTraining,
        keys.weaponTraining,
        keys.armorMastery,
      ].map((externalKey) => ({ externalKey, scope: 'whole' })),
    });
    // Weapon Mastery restricts the fighter's level-20 choice to a bow
    // (:2125, "An archer must choose a type of bow."; Foundry
    // weapon-mastery.McXAM1BoPHZLO1n4.yaml:14, "At 20th level"). The
    // archetype is held until its addition level and alteration are settled.
    expect(itemsOf(archer)).toEqual([
      [
        'everythingpath/fighter-archer',
        'unmatchedReplacement',
        'alters:weapon-mastery',
      ],
    ]);
    expect(archer.items[0]?.fields).toEqual([
      'detail.adds',
      'detail.featureChanges',
    ]);
    expect(archer.items[0]?.text).toContain(
      'An archer must choose a type of bow.',
    );
    expect(archer.items[0]?.text).toContain('gained at 20');
    // P2's binding: the archetype line and its one .MOD line.
    expect(archer.subject.sourceSha256).toBe(
      hashStructureSource([
        part(apg, apgLines, 2102, 'Fighter Archetype ~ Archer'),
        part(apg, apgLines, 3667, 'Fighter Archetype ~ Archer'),
      ]),
    );
    expect(ownedOf(archer)).toEqual(
      inventoryRowsOf('Fighter Archetype ~ Archer'),
    );
    expect(ownedOf(archer)).toHaveLength(8);
  });

  it('settles Archer only when a checked record binds Weapon Mastery’s level and alteration', () => {
    // A fresh mapping: a checked record replaces the entry's bound fields.
    const archer = map('Fighter', 'Archer');
    // A checked record names its review receipt (#757); these cases don't check
    // receipts, so they cite #716 P6's rules review.
    const reviewer = {
      reviewedBy: 'reviewer',
      reviewedOn: '2026-10-18',
      receipt: 'reviewer-20261018-081620-1216172',
    };
    const [weaponMastery] = archer.items;
    if (!weaponMastery) throw new Error('No Weapon Mastery item.');
    const detail = detailOf(archer);
    if (detail.kind !== 'archetype') throw new Error('Not an archetype.');
    const dispositions = archer.features.map(
      ({ entry, sourceSha256, locator }) => ({
        externalKey: entry.externalKey,
        sourceSha256,
        fields: {},
        noMechanics: true,
        resolves: [{ kind: 'ownedFeature', id: locator }],
        status: 'checked',
        rationale: 'APG p.104: prose only on the sheet.',
        ...reviewer,
      }),
    );
    const archetypeRecord = (fields: Record<string, unknown>) => ({
      externalKey: archer.subject.entry.externalKey,
      sourceSha256: archer.subject.sourceSha256,
      fields,
      resolves: [{ kind: 'unmatchedReplacement', id: weaponMastery.id }],
      status: 'checked',
      rationale:
        'APG p.104: Weapon Mastery must name a bow; it alters the fighter’s level-20 Weapon Mastery.',
      ...reviewer,
    });
    const gate = (records: unknown[]) =>
      applyStructureCuration({
        subjects: [archer.subject, ...archer.features],
        items: archer.items,
        ownedFeatures: archer.ownedFeatures,
        data: parseCuration({ records: [], structures: records }),
        variantDecisions: parseIdentityLedger({
          pcgenCommit: pcgenPin.commit,
          identities: [],
          variantDecisions: [],
          locatorRemaps: [],
          heldSources: [],
          retirements: [],
        }).variantDecisions,
      });
    expect(gate([]).held).toEqual(
      [
        archer.subject.entry.externalKey,
        ...archer.ownedFeatures.map(({ externalKey }) => externalKey),
      ].sort(),
    );
    // A situational note alone leaves the item in hand review.
    const noted = gate([
      ...dispositions,
      archetypeRecord({
        situationalNotes: [{ text: 'An archer must choose a type of bow.' }],
      }),
    ]);
    expect(noted.passed).toBe(false);
    expect(noted.handReview.map(({ id }) => id)).toEqual([weaponMastery.id]);
    // Binding the addition at 20 and the alteration of Weapon Mastery settles it.
    const masteryKey = 'everythingpath/fighter-archer-weapon-mastery';
    const settled = gate([
      ...dispositions,
      archetypeRecord({
        'detail.adds': detail.adds.map((row) =>
          row.externalKey === masteryKey ? { ...row, classLevel: 20 } : row,
        ),
        'detail.featureChanges': [
          ...(detail.featureChanges ?? []),
          { externalKey: 'pf1/McXAM1BoPHZLO1n4', scope: 'whole' },
        ],
      }),
    ]);
    expect(settled.passed).toBe(true);
    expect(settled.summary).toMatchObject({
      reviewItems: 1,
      handReview: 0,
      ownedFeatures: 8,
      unreviewedFeatures: 0,
      noMechanics: 8,
    });
    expect(archer.subject.entry.detail).toMatchObject({
      adds: expect.arrayContaining([
        { classLevel: 20, externalKey: masteryKey },
      ]),
    });
  });

  it('maps Scout: uncanny dodge and improved uncanny dodge replaced whole, nothing to review', () => {
    // APG p.134; apg_abilities_class.lst:2947, :3709.
    expect(detailOf(scout)).toEqual({
      kind: 'archetype',
      classKeys: [keys.rogue],
      replaces: [
        { classLevel: 4, externalKey: keys.uncannyDodge, scope: 'whole' },
        {
          classLevel: 8,
          externalKey: keys.improvedUncannyDodge,
          scope: 'whole',
        },
      ],
      adds: [
        {
          classLevel: 4,
          externalKey: 'everythingpath/rogue-scout-scouts-charge',
        },
        { classLevel: 8, externalKey: 'everythingpath/rogue-scout-skirmisher' },
      ],
      featureChanges: [
        { externalKey: keys.uncannyDodge, scope: 'whole' },
        { externalKey: keys.improvedUncannyDodge, scope: 'whole' },
      ],
    });
    expect(itemsOf(scout)).toEqual([]);
    expect(ownedOf(scout)).toEqual(inventoryRowsOf('Rogue Archetype ~ Scout'));
  });

  it('maps Beast Master: the 6th-level combat style feat as a part and its class skills', () => {
    // APG p.124; apg_abilities_class.lst:2664 (TYPE …RangerCombatStyleFeat_Six),
    // :3695 (FACT:Ranger_CF_CombatStyleFeat6|true), and its class skills
    // (:2678) against the ranger's (cr_abilities_class.lst:2837).
    const seed = representativeArchetypeCatalog.find(
      ({ ruleIdentity }) => ruleIdentity === 'ranger-beast-master',
    )?.detail;
    expect(detailOf(beastMaster)).toMatchObject({
      replaces: [
        { classLevel: 4, externalKey: keys.huntersBond, scope: 'whole' },
        // P6: the part names its row's increment entry.
        {
          classLevel: 6,
          externalKey: 'everythingpath/ranger-combat-style-feat-6',
          scope: 'part',
        },
        { classLevel: 12, externalKey: keys.camouflage, scope: 'whole' },
      ],
      adds: [
        [4, 'animal-companion'],
        [6, 'improved-empathic-link'],
        [12, 'strong-bond'],
      ].map(([classLevel, feature]) => ({
        classLevel,
        externalKey: `everythingpath/ranger-beast-master-${feature}`,
      })),
      featureChanges: [
        { externalKey: keys.huntersBond, scope: 'whole' },
        { externalKey: keys.combatStyle, scope: 'part', classLevel: 6 },
        { externalKey: keys.camouflage, scope: 'whole' },
      ],
      classSkillsAdded: ['skill.acr', 'skill.esc'],
      classSkillsRemoved: ['skill.kdu', 'skill.kge', 'skill.pro', 'skill.spl'],
    });
    expect(seed).toMatchObject({
      classSkillsAdded: ['skill.acr', 'skill.esc'],
      classSkillsRemoved: ['skill.kdu', 'skill.kge', 'skill.pro', 'skill.spl'],
    });
    // Foundry's combat style feat counts every bonus feat from the ranger
    // level (combat-style-feat.BO7BEFHDcf6qBaYV.yaml:14), so removing only
    // the 6th-level one is held for review (P6).
    expect(itemsOf(beastMaster)).toEqual([
      [
        'everythingpath/ranger-beast-master',
        'conflict',
        'partialFormula:combat-style-feat',
      ],
    ]);
    expect(beastMaster.items[0]?.text).toContain(
      'combat-style-feat.BO7BEFHDcf6qBaYV.yaml:14',
    );
    expect(ownedOf(beastMaster)).toEqual(
      inventoryRowsOf('Ranger Archetype ~ Beast Master'),
    );
  });

  it('maps Skirmisher: spells replaced on the Foundry-only row and held as a casting change', () => {
    // APG p.128; apg_abilities_class.lst:2669 (TYPE …RangerSpells), :3700.
    expect(detailOf(skirmisher)).toMatchObject({
      replaces: [{ classLevel: 4, externalKey: keys.spells, scope: 'whole' }],
      adds: [
        {
          classLevel: 1,
          externalKey: 'everythingpath/ranger-no-spellcasting-ranger',
        },
        {
          classLevel: 5,
          externalKey: 'everythingpath/ranger-skirmisher-hunters-tricks',
        },
      ],
    });
    expect(itemsOf(skirmisher)).toEqual([
      [
        'everythingpath/ranger-skirmisher',
        'uncheckedCasting',
        'casting:spells',
      ],
    ]);
    expect(skirmisher.items[0]?.fields).toEqual(['detail.casting']);
    expect(ownedOf(skirmisher)).toEqual(
      inventoryRowsOf('Ranger Archetype ~ Skirmisher'),
    );
  });

  it('maps Dandy: removals and alterations apart, its class skills, and its review items', () => {
    // Ultimate Intrigue p.41; ui_abilities_class.lst:636 sets its FACTs on
    // the archetype line and no TYPE token.
    expect(detailOf(dandy)).toMatchObject({
      replaces: [
        { classLevel: 1, externalKey: keys.favoredEnemy, scope: 'whole' },
        { classLevel: 1, externalKey: keys.wildEmpathy, scope: 'whole' },
        { classLevel: 3, externalKey: keys.favoredTerrain, scope: 'whole' },
        { classLevel: 7, externalKey: keys.woodlandStride, scope: 'whole' },
      ],
      featureChanges: [
        keys.favoredEnemy,
        keys.wildEmpathy,
        keys.favoredTerrain,
        keys.huntersBond,
        keys.spells,
        keys.woodlandStride,
      ].map((externalKey) => ({ externalKey, scope: 'whole' })),
      // :648 against cr_abilities_class.lst:2837.
      classSkillsAdded: [
        'skill.blf',
        'skill.dip',
        'skill.klo',
        'skill.kno',
        'skill.sen',
      ],
      classSkillsRemoved: [
        'skill.han',
        'skill.kdu',
        'skill.kge',
        'skill.kna',
        'skill.sur',
      ],
    });
    expect(itemsOf(dandy)).toEqual([
      [
        'everythingpath/ranger-dandy',
        'unmatchedReplacement',
        'alters:hunters-bond',
      ],
      ['everythingpath/ranger-dandy', 'unmatchedReplacement', 'alters:spells'],
      ['everythingpath/ranger-dandy', 'uncheckedCasting', 'casting:spells'],
      [
        'everythingpath/ranger-dandy',
        'unmatchedReplacement',
        'option:AnimalCompanion',
      ],
      // :651 grants Favored Terrain ~ Cold; its text says urban.
      [
        'everythingpath/ranger-dandy-favored-terrain',
        'conflict',
        'favoredTerrain',
      ],
    ]);
    // Six Special Abilities; Dandy ~ Class Skills is CATEGORY:Internal.
    expect(ownedOf(dandy)).toEqual(inventoryRowsOf('Ranger Archetype ~ Dandy'));
    expect(ownedOf(dandy)).toHaveLength(6);
    expect(ui).toBe(dandy.subject.entry.upstreamKey.split(/[:#]/)[1]);
  });

  it('holds Lore Warden’s whole bravery removal against its “replaces bravery 1” text', () => {
    // Pathfinder Society Field Guide p.31: Expertise "replaces bravery 1"
    // (pfsfg_abilities_class.lst:259); PCGen sets FACT:Fighter_CF_Bravery|true
    // (:253), a whole removal, and removes armor training 1–4 by part.
    expect(detailOf(loreWarden)).toMatchObject({
      replaces: [
        { classLevel: 2, externalKey: keys.bravery, scope: 'whole' },
        ...[3, 7, 11, 15].map((classLevel) => ({
          classLevel,
          externalKey:
            classLevel === 3
              ? keys.armorTraining
              : `everythingpath/fighter-armor-training-${classLevel}`,
          scope: 'part',
        })),
        { classLevel: 19, externalKey: keys.armorMastery, scope: 'whole' },
      ],
    });
    expect(itemsOf(loreWarden)).toEqual([
      ['everythingpath/fighter-lore-warden', 'conflict', 'partialText:bravery'],
    ]);
    expect(loreWarden.items[0]?.text).toContain('replaces bravery 1');
    expect(loreWarden.items[0]?.text).toContain(pfsfg.split('/').at(-1));
    // Proficiency changes stay prose, with the recorded reason the launch
    // projection identifies PRD #251 Decision 7's prose by.
    expect(
      loreWarden.subject.entry.unsupported
        .filter(({ field }) => field === 'proficiencies')
        .map(({ reason }) => reason),
    ).toEqual(Array(4).fill(archetypeProficiencyProseReason));
    expect(
      loreWarden.subject.entry.unsupported
        .filter(({ field }) => field === 'proficiencies')
        .map(({ value }) => value),
    ).toEqual([
      'FACT:Fighter_CF_MediumArmorProficiency|true',
      'FACT:Fighter_CF_HeavyArmorProficiency|true',
      'FACT:Fighter_CF_ShieldProficiency|true',
      'FACT:Fighter_CF_TowerShieldProficiency|true',
    ]);
  });
});

// #716 P6: increment entries carry no modifiers, so a part removal of a
// feature whose acquisition record computes every increment from the class
// level leaves the value to that one row.
describe('partial removals of a formula-held feature (#716 P6)', () => {
  it('holds Mobile Fighter’s armor training 3 and 4 removal for review', () => {
    // APG p.105: apg_abilities_class.lst:2105 (TYPE …FighterArmorTraining3
    // .FighterArmorTraining4) and :3670 (FACT:Fighter_CF_ArmorTraining3|true,
    // …4|true); Foundry's armor training computes its bonus from the fighter
    // level (armor-training.5JFfSqLMCpbRmERa.yaml:16, :20).
    const mobileFighter = map('Fighter', 'Mobile Fighter');
    const detail = detailOf(mobileFighter);
    if (detail.kind !== 'archetype') throw new Error('Not an archetype.');
    expect(
      detail.replaces.filter(({ classLevel }) => [11, 15].includes(classLevel)),
    ).toEqual([
      {
        classLevel: 11,
        externalKey: 'everythingpath/fighter-armor-training-11',
        scope: 'part',
      },
      {
        classLevel: 15,
        externalKey: 'everythingpath/fighter-armor-training-15',
        scope: 'part',
      },
    ]);
    const held = mobileFighter.items.filter(({ id }) =>
      id.startsWith('partialFormula:'),
    );
    expect(held.map(({ kind, id, fields }) => [kind, id, fields])).toEqual([
      ['conflict', 'partialFormula:armor-training', ['detail.replaces']],
    ]);
    expect(held[0]?.text).toContain('at 11, 15 of 3, 7, 11, 15');
    expect(held[0]?.text).toContain('armor-training.5JFfSqLMCpbRmERa.yaml:16');
  });

  it('holds nothing when every row of the feature is removed (Lore Warden)', () => {
    expect(
      loreWarden.items.filter(({ id }) => id.startsWith('partialFormula:')),
    ).toEqual([]);
  });
});

describe('archetype skill changes (#716 P5, #305)', () => {
  // Advanced Race Guide pp.55 and 189: arg_abilities_class.lst:276-277
  // (Skulking Slayer) and :845-846 (Eldritch Raider). The rogue has 8 ranks
  // per level (CRB p.67; Foundry rogue.24b0LaabeAlUx5gN.yaml:92), so
  // BONUS:SKILLPOINTS|NUMBER|-2 gives the printed "6 + Int modifier".
  const skulkingSlayer = map('Rogue', 'Skulking Slayer');
  const eldritchRaider = map('Rogue', 'Eldritch Raider');

  it('maps CCSKILL removals and the skill rank budget', () => {
    expect(detailOf(skulkingSlayer)).toMatchObject({
      classSkillsRemoved: ['skill.dev', 'skill.lin', 'skill.slt'],
      skillRanksPerLevel: 6,
    });
    expect(detailOf(skulkingSlayer)).not.toHaveProperty('classSkillsAdded');
    expect(detailOf(eldritchRaider)).toMatchObject({
      classSkillsAdded: ['skill.kar', 'skill.khi', 'skill.spl'],
      classSkillsRemoved: ['skill.dis', 'skill.prf', 'skill.slt'],
      skillRanksPerLevel: 6,
    });
    // The skill list and the budget are owned features, not additions.
    for (const mapping of [skulkingSlayer, eldritchRaider]) {
      const detail = detailOf(mapping);
      const adds = detail.kind === 'archetype' ? detail.adds : [];
      expect(
        adds.filter(({ externalKey }) =>
          /class-skills|skill-ranks-per-level/.test(externalKey),
        ),
      ).toEqual([]);
      expect(
        ownedOf(mapping).filter((locator) =>
          /~ (Class Skills|Skill Ranks per Level)$/.test(locator),
        ),
      ).toHaveLength(2);
    }
  });

  it('holds two rogue archetypes that both change class skills for review', () => {
    const { items } = stackingConflicts([
      scout,
      skulkingSlayer,
      eldritchRaider,
    ]);
    expect(items.map(({ externalKey, id }) => [externalKey, id])).toEqual([
      [
        'everythingpath/rogue-skulking-slayer',
        'classSkills:everythingpath/rogue-eldritch-raider',
      ],
      [
        'everythingpath/rogue-eldritch-raider',
        'classSkills:everythingpath/rogue-skulking-slayer',
      ],
    ]);
  });
});

describe('PCGen defects on archetypes (#716 P5)', () => {
  it('maps Guide’s evasion and quarry flags by name and holds the shared gates for review', () => {
    // APG p.126; apg_abilities_class.lst:3696 removes evasion, improved
    // evasion, quarry and improved quarry, which PCGen gates on two variables
    // (cr_abilities_class.lst:296-301).
    const guide = map('Ranger', 'Guide');
    expect(detailOf(guide)).toMatchObject({
      replaces: expect.arrayContaining([
        { classLevel: 9, externalKey: 'pf1/KQYCRLEdD4bGA5ak', scope: 'whole' },
        { classLevel: 11, externalKey: 'pf1/5NS7Ec3WhKIkhygg', scope: 'whole' },
        { classLevel: 16, externalKey: 'pf1/Cc2eFfhJYlClCGEH', scope: 'whole' },
        { classLevel: 19, externalKey: 'pf1/oRac7XDHBN0JzuyY', scope: 'whole' },
      ]),
    });
    expect(
      itemsOf(guide).filter(
        ([, kind, id]) =>
          kind === 'conflict' && String(id).startsWith('defect:'),
      ),
    ).toEqual([
      ['everythingpath/ranger-guide', 'conflict', 'defect:evasion-gate'],
      ['everythingpath/ranger-guide', 'conflict', 'defect:quarry-gate'],
    ]);
  });
});

describe('archetype stacking (#716 P5; APG p.72, FAQ June 2015)', () => {
  it('finds conflicts at the replaced-feature identity, and holds the class-skill clash for review', () => {
    const { conflicts, items } = stackingConflicts([
      archer,
      loreWarden,
      beastMaster,
      skirmisher,
      dandy,
      scout,
    ]);
    expect(
      conflicts.map(({ archetypes, feature, part }) => [
        ...archetypes,
        feature,
        part,
      ]),
    ).toEqual([
      [
        'everythingpath/fighter-archer',
        'everythingpath/fighter-lore-warden',
        keys.bravery,
        null,
      ],
      [
        'everythingpath/fighter-archer',
        'everythingpath/fighter-lore-warden',
        keys.armorTraining,
        null,
      ],
      [
        'everythingpath/fighter-archer',
        'everythingpath/fighter-lore-warden',
        keys.armorMastery,
        null,
      ],
      [
        'everythingpath/ranger-beast-master',
        'everythingpath/ranger-dandy',
        keys.huntersBond,
        null,
      ],
      [
        'everythingpath/ranger-skirmisher',
        'everythingpath/ranger-dandy',
        keys.spells,
        null,
      ],
    ]);
    // A3: #305 has no identity for class-skill changes.
    expect(
      items.map(({ externalKey, kind, id }) => [externalKey, kind, id]),
    ).toEqual([
      [
        'everythingpath/ranger-beast-master',
        'conflict',
        'classSkills:everythingpath/ranger-dandy',
      ],
      [
        'everythingpath/ranger-dandy',
        'conflict',
        'classSkills:everythingpath/ranger-beast-master',
      ],
    ]);
  });
});

// The mapper's entries on the sheet's #305 resolver: the reviewed Fighter
// schedule, its Foundry feature keys as rule identities, and the archetypes
// prepared as the release converter prepares them.
function fighterSheet(archetypes: ArchetypeMapping[]): CharacterSheetInput {
  const fighter = representativeClassCatalog.find(
    ({ ruleIdentity }) => ruleIdentity === 'fighter',
  );
  if (fighter?.detail?.kind !== 'class') throw new Error('No fighter seed.');
  const schedule = reviewedSchedule('Fighter');
  if (!schedule) throw new Error('No Fighter schedule.');
  const rows = scheduleRows(schedule);
  // P6: each later row is its increment entry, with its parent and part.
  const increments = new Map(
    incrementEntries(schedule).map((entry) => [entry.externalKey, entry]),
  );
  const feature = (key: string): CharacterSheetCatalogEntry => {
    const detail = increments.get(key)?.detail;
    return {
      _id: key,
      ruleIdentity: key,
      name: key,
      modifiers: [],
      detail:
        detail?.kind === 'classFeature'
          ? {
              kind: 'classFeature',
              parentFeature: detail.parentFeature,
              part: detail.part,
            }
          : { kind: 'classFeature' },
    };
  };
  const featureKeys = [
    ...new Set([
      ...rows.map(({ externalKey }) => externalKey),
      ...archetypes.flatMap(({ features }) =>
        features.map(({ entry }) => entry.externalKey),
      ),
    ]),
  ];
  const catalog = new Map<string, CharacterSheetCatalogEntry>([
    [
      keys.fighter,
      {
        ...fighter,
        _id: keys.fighter,
        ruleIdentity: keys.fighter,
        detail: {
          ...fighter.detail,
          featuresByLevel: rows.map(({ classLevel, externalKey }) => ({
            classLevel,
            catalogEntryId: externalKey,
          })),
        },
      },
    ],
    ...featureKeys.map((key) => [key, feature(key)] as const),
  ]);
  const prepared = archetypes.map(({ subject: { entry } }) => {
    if (entry.detail.kind !== 'archetype') throw new Error('Not an archetype.');
    return {
      _id: entry.externalKey,
      ruleIdentity: entry.externalKey,
      name: entry.name,
      modifiers: [],
      detail: preparedArchetypeDetail(entry.detail, (key) => {
        const target = catalog.get(key);
        if (!target) throw new Error(`No ${key}.`);
        return {
          id: key,
          ruleIdentity: key,
          ...(target.detail?.kind === 'classFeature'
            ? {
                parentFeature: target.detail.parentFeature,
                part: target.detail.part,
              }
            : {}),
        };
      }),
    } satisfies CharacterSheetCatalogEntry;
  });
  return {
    characterKind: 'pc',
    entries: [
      ...Array.from({ length: 20 }, (_, index) => ({
        _id: `level-${index + 1}`,
        kind: 'classLevel' as const,
        active: true as const,
        state: {
          kind: 'classLevel' as const,
          classEntryId: keys.fighter,
          position: index + 1,
          hpGained: 10,
        },
      })),
      ...prepared.map(({ _id }) => ({
        _id: `selection-${_id}`,
        kind: 'archetype' as const,
        catalogEntryId: _id,
        active: true,
        state: { kind: 'archetype' as const },
      })),
    ],
    catalogEntries: [...catalog.values(), ...prepared],
  };
}

describe('the mapped Archer on the sheet (#305)', () => {
  it('replaces the fourteen rows its removal flags name; the bow mastery waits for review', () => {
    const result = resolveCharacterSheetArchetypes(fighterSheet([archer]));
    const replaced = result.classes[0]?.archetypes[0]?.replacements ?? [];
    expect(
      replaced
        .map(({ classLevel, catalogEntryId }) => [classLevel, catalogEntryId])
        .sort((a, b) => Number(a[0]) - Number(b[0])),
    ).toEqual([
      // P6: each increment row is its own entry under the Foundry feature.
      [2, keys.bravery],
      [3, keys.armorTraining],
      [5, keys.weaponTraining],
      [6, 'everythingpath/fighter-bravery-6'],
      [7, 'everythingpath/fighter-armor-training-7'],
      [9, 'everythingpath/fighter-weapon-training-9'],
      [10, 'everythingpath/fighter-bravery-10'],
      [11, 'everythingpath/fighter-armor-training-11'],
      [13, 'everythingpath/fighter-weapon-training-13'],
      [14, 'everythingpath/fighter-bravery-14'],
      [15, 'everythingpath/fighter-armor-training-15'],
      [17, 'everythingpath/fighter-weapon-training-17'],
      [18, 'everythingpath/fighter-bravery-18'],
      [19, keys.armorMastery],
    ]);
    // Every replaced row exists on the reviewed schedule. The seed Archer
    // also replaces Weapon Mastery 20 for the bow mastery; here that is the
    // checked record's decision.
    expect(
      result.warnings.filter(
        ({ check }) => check === 'archetypeReplacementUnmatched',
      ),
    ).toEqual([]);
  });

  it('warns that Archer and Lore Warden alter bravery, armor training and armor mastery', () => {
    const result = resolveCharacterSheetArchetypes(
      fighterSheet([archer, loreWarden]),
    );
    expect(
      result.conflicts.map(({ featureIdentity, part }) => [
        featureIdentity,
        part,
      ]),
    ).toEqual([
      [keys.bravery, null],
      [keys.armorTraining, null],
      [keys.armorMastery, null],
    ]);
  });
});

// #583's restored component test (class-rules-control.test.tsx) runs APG
// Acrobat on Foundry's Rogue (Unchained); its fixture must be what this
// mapper and the pinned Foundry class give.
describe('the #583 Acrobat fixture (#716 P6)', () => {
  it('is APG Acrobat as the mapper prepares it, with P6’s derived feature keys', () => {
    // APG p.132; apg_abilities_class.lst:2941 and its .MOD :3703.
    const acrobat = map('Rogue', 'Acrobat');
    const detail = detailOf(acrobat);
    if (detail.kind !== 'archetype') throw new Error('Not an archetype.');
    expect(acrobat.subject.entry.externalKey).toBe(
      'everythingpath/rogue-acrobat',
    );
    expect(
      preparedArchetypeDetail(detail, (key) => ({
        id: key,
        ruleIdentity: key,
      })),
    ).toEqual(acrobatDetail);
    expect(acrobat.items).toEqual([]);
  });

  it('meets Foundry’s Rogue (Unchained) on P7b’s reviewed schedule, whose first rows are the pinned class’s links', async () => {
    const file = 'packs/classes/rogue-unchained.5tsZI6zk29yX1ckA.yaml';
    const unchainedRogue = reviewedSchedule('Rogue (Unchained)');
    if (!unchainedRogue) throw new Error('No Rogue (Unchained) schedule.');
    expect(unchainedRogue.classKey).toBe(foundryUnchainedRogue);
    const listFirstRows = (rows: { level: number; externalKey: string }[]) =>
      rows.map(({ level, externalKey }) => `${level} ${externalKey}`).sort();
    expect(
      listFirstRows(
        unchainedRogue.features.map(({ levels: [level = 1], externalKey }) => ({
          level,
          externalKey,
        })),
      ),
    ).toEqual(
      listFirstRows(foundryAssociations(file, await readPinned('pf1', file))),
    );
    // Its 3rd-level row is danger sense, not trap sense (Pathfinder
    // Unchained pp.13, 22).
    const dangerSense = await readPinned(
      'pf1',
      'packs/class-abilities/danger-sense.sTlu3zgAEDdJnER5.yaml',
    );
    expect(dangerSense).toMatch(/^_id: sTlu3zgAEDdJnER5$/m);
    expect(dangerSense).toMatch(/^name: Danger Sense$/m);
    expect(
      scheduleRows(unchainedRogue).filter(({ classLevel }) => classLevel === 3),
    ).toContainEqual({
      classLevel: 3,
      externalKey: 'pf1/sTlu3zgAEDdJnER5',
      feature: 'danger-sense',
    });
    expect(
      unchainedRogue.features.some(
        ({ externalKey }) => externalKey === 'pf1/BoEkMviJrW0PKmhj',
      ),
    ).toBe(false);
    expect(foundryRogue).toBe(keys.rogue);
  });
});

// #716 P10a, owner decision 3 (plan §7 "Product Identity"): a record PCGen
// flags NAMEISPI or DESCISPI is held, whatever review it gets.
describe('Product Identity holds (#716 P10a)', () => {
  it('holds Dark Lurker, whose description PCGen marks as Product Identity (hots_abilities_class.lst:144)', () => {
    const darkLurker = map('Rogue', 'Dark Lurker');
    expect(darkLurker.subject.entry.unsupported).toEqual([
      {
        field: 'attribution',
        reason:
          'Product Identity: DESCISPI (player_companion/heroes_of_the_street/hots_abilities_class.lst:144)',
      },
    ]);
  });

  it('adds no hold to a record without either flag', () => {
    expect(archer.subject.entry.unsupported).toEqual([]);
  });
});
