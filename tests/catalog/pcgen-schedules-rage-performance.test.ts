// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { representativeClassFeatureSchedules } from '../../convex/lib/representativeClassCatalog';
import { parseIdentityLedger } from '../../scripts/catalog/everythingpath-identities';
import ledger from '../../scripts/catalog/everythingpath-identities.json';
import {
  archetypeClassContext,
  mapArchetype,
  stackingConflicts,
  type ArchetypeMapping,
} from '../../scripts/catalog/pcgen/archetypes';
import {
  buildEffectiveView,
  type PcgenEffectiveRecord,
} from '../../scripts/catalog/pcgen/effective';
import {
  assignPcgenIdentities,
  pcgenBookFacts,
} from '../../scripts/catalog/pcgen/identities';
import { inventoryPcgen } from '../../scripts/catalog/pcgen/inventory';
import type { PcgenRecord } from '../../scripts/catalog/pcgen/lst';
import {
  allIncrementKeys,
  incrementEntries,
  scheduleRows,
} from '../../scripts/catalog/pcgen/schedules';
import { pcgen716RagePerformanceFiles } from '../fixtures/pcgen-716/rage-performance-files';
import {
  bindArchetypeMapper,
  brief,
  comparePrintedColumns,
  comparePrintedRows,
  listReplacements,
  pinnedLine,
  planArchetypeBatch,
  readArchetypeDetail,
  readPrdText,
  scheduleChecks,
  summarizeItems,
} from './pcgen-716-schedules';
import { readPcgenFixtureTree } from './pcgen-716-tree';
import { readPinned } from './pinned-sources';

// #716 P7c (research note 716-p7-rules §1, §3, §5, §6): the reviewed
// schedules of the Bard, Barbarian, Barbarian (Unchained), Skald and
// Bloodrager, checked against the pinned PCGen, Foundry and PRD files. Every
// scenario reads pinned files or builds its records in memory, never
// committed curation state.

const tree = await readPcgenFixtureTree(pcgen716RagePerformanceFiles);
const view = buildEffectiveView(tree);
const reservedKeys = allIncrementKeys();
const identities = assignPcgenIdentities({
  inventory: inventoryPcgen(tree),
  view,
  ledger: parseIdentityLedger(ledger, { reservedKeys }),
  books: pcgenBookFacts(await readPinned('pf1', 'module/registry/sources.mjs')),
  reservedKeys,
});

const classNames = [
  'Bard',
  'Barbarian',
  'Barbarian (Unchained)',
  'Skald',
  'Bloodrager',
] as const;
type ClassName = (typeof classNames)[number];

const { schedule, derive, compare, levelOf, countGrantKinds } = scheduleChecks({
  tree,
  view,
});

describe('the P7c schedules’ numbered variables (#716 P7c, note §5.1)', () => {
  it('gives every numbered variable its explicit level: by class level, by order or by value', () => {
    // CRB p.32: trap sense +1 at 3rd and every three levels; PCGen numbers
    // the nth point (cr_abilities_class.lst:441-446).
    expect(levelOf('Barbarian', 'TrapSense2')).toEqual(['trap-sense', 6]);
    expect(levelOf('Barbarian', 'DamageReduction3')).toEqual([
      'damage-reduction',
      13,
    ]);
    expect(levelOf('Barbarian', 'RagePower14')).toEqual(['rage-power', 14]);
    // Pathfinder Unchained p.9: danger sense on the shared trap sense names.
    expect(levelOf('Barbarian (Unchained)', 'TrapSense')).toEqual([
      'danger-sense',
      null,
    ]);
    expect(levelOf('Barbarian (Unchained)', 'TrapSense6')).toEqual([
      'danger-sense',
      18,
    ]);
    expect(levelOf('Barbarian (Unchained)', 'RagePower8')).toEqual([
      'rage-power',
      8,
    ]);
    // CRB p.37: inspire competence +2 at 3rd; PCGen counts the bonus,
    // (BardicPerformanceLVL+5)/4, so the first two points are both 3rd's.
    expect(levelOf('Bard', 'InspireCompetence1')).toEqual([
      'inspire-competence',
      3,
    ]);
    expect(levelOf('Bard', 'InspireCompetence2')).toEqual([
      'inspire-competence',
      3,
    ]);
    expect(levelOf('Bard', 'InspireCompetence6')).toEqual([
      'inspire-competence',
      19,
    ]);
    expect(levelOf('Bard', 'InspireCourage3')).toEqual(['inspire-courage', 11]);
    expect(levelOf('Bard', 'VersatilePerformance2')).toEqual([
      'versatile-performance',
      2,
    ]);
    // ACG p.50: a rage power at 3rd and every 3 levels, a versatile
    // performance at 2nd and every 5.
    expect(levelOf('Skald', 'RagePower9')).toEqual(['rage-power', 9]);
    expect(levelOf('Skald', 'VersatilePerformance12')).toEqual([
      'versatile-performance',
      12,
    ]);
    expect(levelOf('Skald', 'SpellKenning11')).toEqual(['spell-kenning', 11]);
    // ACG p.16: bloodline spells at 7th, 10th, 13th and 16th, numbered by
    // spell level in the bloodlines and by class level in the archetypes.
    expect(levelOf('Bloodrager', 'BloodlineSpell2')).toEqual([
      'bloodline-spell',
      10,
    ]);
    expect(levelOf('Bloodrager', 'BloodlineSpell13')).toEqual([
      'bloodline-spell',
      13,
    ]);
    expect(levelOf('Bloodrager', 'BloodlineFeat15')).toEqual([
      'bloodline-feat',
      15,
    ]);
    expect(levelOf('Bloodrager', 'BloodlinePower8')).toEqual(['bloodline', 8]);
    // Not table rows: the bard's armored casting is part of its spells.
    expect(levelOf('Bard', 'ArmoredCasting')).toEqual(['casting']);
    expect(levelOf('Bard', 'Alignment')).toEqual(['notOnTable']);
    expect(levelOf('Bloodrager', 'ArmorProficiency')).toEqual(['proficiency']);
    // Sea Reaver's TYPE (uc_abilities_class.lst:305).
    expect(levelOf('Barbarian', 'MediumArmorProficiency')).toEqual([
      'proficiency',
    ]);
    // Enlightened Bloodrager's TYPE.BloodragerBonusSpells
    // (arca_abilities_class.lst:13).
    expect(levelOf('Bloodrager', 'BonusSpells')).toEqual([
      'bloodline-spell',
      null,
    ]);
    // Mad Dog's BarbarianCFRagePower stands beside the rage powers it
    // replaces by level (anar_abilities_class.lst:7): no alias, for review.
    expect(schedule('Barbarian').typeAliases).not.toHaveProperty(
      'BarbarianCFRagePower',
    );
    expect(levelOf('Barbarian', 'CFRagePower')).toEqual(['unknown']);
    // Pathfinder Unchained numbers no versatile performance; the CRB bard's
    // later ones are formula-held.
    expect(levelOf('Bard', 'VersatilePerformance6')).toEqual(['unknown']);
  });
});

describe('each P7c schedule against the PRD’s class table (#716 P7c, owner decision 8)', () => {
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
    // Table: Bard, 1st level: "Bardic knowledge, bardic performance,
    // cantrips, countersong, distraction, fascinate, inspire courage +1".
    expect((await comparePrintedRows(schedule('Bard')))[0]?.table).toEqual([
      'bardic knowledge',
      'bardic performance',
      'cantrips',
      'countersong',
      'distraction',
      'fascinate',
      'inspire courage +1',
    ]);
  });

  it('cites the casting rows the Special column doesn’t print, and prints no value column', async () => {
    expect(
      Object.fromEntries(
        classNames.map((className) => {
          const { printedTable } = schedule(className);
          if (printedTable?.status !== 'reviewed')
            throw new Error(`${className} has no reviewed table.`);
          return [className, Object.keys(printedTable.unprinted)];
        }),
      ),
    ).toEqual({
      Bard: ['spells', 'exchange-spell'],
      Barbarian: [],
      'Barbarian (Unchained)': [],
      Skald: ['spells', 'exchange-spell'],
      Bloodrager: ['spells', 'exchange-spell'],
    });
    for (const className of classNames)
      expect(await comparePrintedColumns(schedule(className))).toEqual([]);
  });
});

describe('PCGen’s schedule against each table (#716 P7c, note §5.2–3)', () => {
  it('settles every difference between PCGen, Foundry and the table with a cited decision or defect', async () => {
    for (const className of classNames)
      expect(
        (await compare(className)).filter(({ settledBy }) => !settledBy),
        className,
      ).toEqual([]);
    // CRB p.35: the armored casting PCGen grants is part of the spells; the
    // performances are grants nested in bardic performance; four features
    // are granted again with no gate (cr_abilities_globalvar.lst:156-159).
    expect(brief(await compare('Bard'))).toEqual([
      ['nonRow', 'ArmoredCasting', 'nonRow:ArmoredCasting'],
      [
        'ungatedGrant',
        'versatile-performance',
        'decision:versatile-performance',
      ],
      ['ungatedGrant', 'well-versed', 'decision:well-versed'],
      ['ungatedGrant', 'lore-master', 'decision:lore-master'],
      ['ungatedGrant', 'jack-of-all-trades', 'decision:jack-of-all-trades'],
      ...[
        'distraction',
        'fascinate',
        'inspire-courage',
        'inspire-competence',
        'suggestion',
        'dirge-of-doom',
        'inspire-greatness',
        'soothing-performance',
        'frightening-tune',
        'inspire-heroics',
        'mass-suggestion',
        'deadly-performance',
      ].map((id) => ['nestedGrant', id, `decision:${id}`]),
      ['foundryOnly', 'spells', 'decision:spells'],
      ['undefinedPart', 'versatile-performance', 'versatile-performance-2'],
      ['formulaIncrement', 'lore-master', 'decision:lore-master'],
      ['foundryOnly', 'exchange-spell', 'decision:exchange-spell'],
    ]);
    // CRB p.34: Foundry links Tireless Rage at 16 against its own text.
    expect(brief(await compare('Barbarian'))).toEqual([
      ['foundryOnly', 'uncanny-dodge', 'decision:uncanny-dodge'],
      [
        'foundryOnly',
        'improved-uncanny-dodge',
        'decision:improved-uncanny-dodge',
      ],
      ['nonRow', 'pf1/aYdjgDZJCNvKpLQP', 'foundryNonRow:pf1/aYdjgDZJCNvKpLQP'],
    ]);
    expect(brief(await compare('Barbarian (Unchained)'))).toEqual([
      ['ungatedGrant', 'uncanny-dodge', 'decision:uncanny-dodge'],
      [
        'foundryOnly',
        'improved-uncanny-dodge',
        'decision:improved-uncanny-dodge',
      ],
    ]);
    expect(brief(await compare('Skald'))).toEqual([
      [
        'ungatedGrant',
        'Skald ~ Weapon and Armor Proficiency',
        'grantNonRow:Skald ~ Weapon and Armor Proficiency',
      ],
      ['formulaIncrement', 'inspired-rage', 'decision:inspired-rage'],
      ['foundryOnly', 'spells', 'decision:spells'],
      ['ungatedParts', 'spell-kenning', 'decision:spell-kenning'],
      ['foundryOnly', 'exchange-spell', 'decision:exchange-spell'],
      ['formulaIncrement', 'lore-master', 'decision:lore-master'],
      ['formulaIncrement', 'damage-reduction', 'decision:damage-reduction'],
    ]);
    // ACG p.16: the bloodline spells' flags are gated but never defined.
    // The bloodline powers' flags are gated through each bloodline's own
    // variables (acg_abilities_class.lst:565-566), so they raise no finding.
    expect(brief(await compare('Bloodrager'))).toEqual([
      [
        'ungatedGrant',
        'Bloodrager ~ Weapon and Armor Proficiency',
        'grantNonRow:Bloodrager ~ Weapon and Armor Proficiency',
      ],
      ['ungatedGrant', 'uncanny-dodge', 'decision:uncanny-dodge'],
      [
        'ungatedGrant',
        'improved-uncanny-dodge',
        'decision:improved-uncanny-dodge',
      ],
      ['foundryOnly', 'bloodline-feat', 'decision:bloodline-feat'],
      ['foundryOnly', 'bloodline-spell', 'decision:bloodline-spell'],
      ...[1, 2, 3, 4].map(() => [
        'undefinedPart',
        'bloodline-spell',
        'bloodline-spell-flags',
      ]),
      ['formulaIncrement', 'damage-reduction', 'decision:damage-reduction'],
      ['foundryOnly', 'exchange-spell', 'decision:exchange-spell'],
    ]);
  });

  it('places Tireless Rage at 17, as the table, PCGen and Foundry’s own text do (note §6)', async () => {
    const tirelessRage = schedule('Barbarian').features.find(
      ({ id }) => id === 'tireless-rage',
    );
    expect(tirelessRage?.levels).toEqual([17]);
    expect(
      await pinnedLine(
        'pf1',
        'packs/classes/barbarian.g3pq7xWWdUVYw6ai.yaml:76',
      ),
    ).toBe('      - level: 16');
    expect(
      await readPinned(
        'pf1',
        'packs/class-abilities/tireless-rage.aYdjgDZJCNvKpLQP.yaml',
      ),
    ).toContain('Starting at 17th level');
    expect(
      await readPrdText({
        page: 'coreRulebook/classes/barbarian.html',
        from: 422,
        to: 422,
      }),
    ).toContain('Starting at 17th level');
  });
});

describe('P7-0’s grant kinds in the P7c classes (#716 P7c, note §5.3)', () => {
  it('reads each class’s gated, ungated and nested grants', () => {
    // The bard's on its class record (cr_abilities_class.lst:206-214), its
    // duplicates (cr_abilities_globalvar.lst:156-159) and its twelve
    // performances nested in bardic performance (:505); the barbarians' on
    // their own records (:149-157; pu_abilities_class.lst:132-141); the
    // skald's and bloodrager's on their class blocks' level lines
    // (acg_classes.lst:281-299, :47-61).
    expect(
      Object.fromEntries(
        classNames.map((name) => [name, countGrantKinds(name)]),
      ),
    ).toEqual({
      Bard: [9, 4, 12],
      Barbarian: [9, 0, 0],
      'Barbarian (Unchained)': [9, 1, 0],
      Skald: [18, 1, 0],
      Bloodrager: [12, 3, 0],
    });
    expect(
      derive('Bard').nestedGrants.find(({ suffix }) => suffix === 'Suggestion'),
    ).toMatchObject({
      granted: 'Bardic Performance ~ Suggestion',
      owner: 'Bard ~ Bardic Performance',
      level: 6,
    });
  });

  it('makes each bard performance and skald raging song a subfeature of its parent', () => {
    const listSubfeatures = ({
      className,
      parent,
    }: {
      className: ClassName;
      parent: string;
    }) =>
      schedule(className)
        .features.filter(({ subfeatureOf }) => subfeatureOf === parent)
        .map(({ id }) => id);
    // CRB pp.35–38 (bard.html:417-432): countersong to deadly performance
    // under Bardic Performance.
    expect(
      listSubfeatures({ className: 'Bard', parent: 'bardic-performance' }),
    ).toEqual([
      'countersong',
      'distraction',
      'fascinate',
      'inspire-courage',
      'inspire-competence',
      'suggestion',
      'dirge-of-doom',
      'inspire-greatness',
      'soothing-performance',
      'frightening-tune',
      'inspire-heroics',
      'mass-suggestion',
      'deadly-performance',
    ]);
    // ACG pp.50–51 (skald.html:458-467): the raging songs.
    expect(
      listSubfeatures({ className: 'Skald', parent: 'raging-song' }),
    ).toEqual([
      'inspired-rage',
      'song-of-marching',
      'song-of-strength',
      'dirge-of-doom',
      'song-of-the-fallen',
    ]);
    // Every subfeature names a feature of its own schedule, gained no later.
    for (const className of classNames) {
      const { features } = schedule(className);
      for (const feature of features.filter(
        ({ subfeatureOf }) => subfeatureOf,
      )) {
        const parent = features.find(({ id }) => id === feature.subfeatureOf);
        expect(parent, feature.id).toBeDefined();
        expect(feature.levels[0]).toBeGreaterThanOrEqual(
          parent?.levels[0] ?? 0,
        );
      }
    }
  });

  it('keeps the Unchained barbarian to its own record and slug, with no shared gate', async () => {
    const className = 'Barbarian (Unchained)';
    expect(
      derive(className).acquisitions.filter(
        ({ granted }) => !granted.startsWith('Unchained Barbarian ~'),
      ),
    ).toEqual([]);
    expect(
      (await compare(className)).filter(({ kind }) => kind === 'sharedGate'),
    ).toEqual([]);
    expect(schedule(className).slug).toBe('unchained-barbarian');
    for (const { externalKey } of incrementEntries(schedule(className)))
      expect(externalKey).toMatch(/^everythingpath\/unchained-barbarian-/);
    // The shared flags' gates sit on the CRB records
    // (cr_abilities_class.lst:458), hence the reviewed defect.
    expect(derive(className).gatedParts.get('RagePower6')?.at).toBe(
      'roleplaying_game/core_rulebook/cr_abilities_class.lst:458',
    );
    expect(derive(className).defined.has('TrapSense3')).toBe(true);
  });
});

describe('formula rows, skill ranks and bridges (#716 P7c, note §5.4–5)', () => {
  it('holds each formula-held feature’s later rows in the schedule alone, and numbers every other repeating feature', async () => {
    const formulaHeld: Record<ClassName, string[]> = {
      // Note §3: lore master's uses; the later versatile performances are
      // formula too, but the 2nd-level one is numbered.
      Bard: ['lore-master'],
      Barbarian: [],
      'Barbarian (Unchained)': [],
      // Note §3: "Formula: DR 9 and later".
      Skald: ['inspired-rage', 'lore-master', 'damage-reduction'],
      // Note §3: "Formula: DR".
      Bloodrager: ['damage-reduction'],
    };
    for (const className of classNames) {
      const findings = await compare(className);
      expect(
        findings
          .filter(({ kind }) => kind === 'formulaIncrement')
          .map(({ feature, settledBy }) => [feature, settledBy]),
        className,
      ).toEqual(formulaHeld[className].map((id) => [id, `decision:${id}`]));
      const { gatedParts } = derive(className);
      const ungated = findings
        .filter(({ kind }) => kind === 'ungatedParts')
        .map(({ feature }) => feature);
      for (const feature of schedule(className).features)
        if (
          feature.levels.length > 1 &&
          !formulaHeld[className].includes(feature.id) &&
          !ungated.includes(feature.id)
        )
          expect(
            Object.keys(feature.parts).some((part) => gatedParts.has(part)),
            `${className} ${feature.id}`,
          ).toBe(true);
    }
  });

  it('gives each class the skill ranks per level of its table, as Foundry records them', async () => {
    // Bard 6, barbarians, skald and bloodrager 4 ranks + Int modifier.
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
    expect(ranks).toEqual([6, 4, 4, 4, 4]);
  });

  it('reads the TYPE bridges from the global variables, not by spelling', () => {
    // cr_abilities_globalvar.lst:243, :252; :108, :119.
    const bard = derive('Bard').typeBridges;
    expect(bard.get('BardDistraction')).toBe('BardDistraction');
    expect(bard.get('BardWeaponProficiencies')).toBe('Proficiencies');
    const barbarian = derive('Barbarian (Unchained)').typeBridges;
    expect(barbarian.get('BarbarianRagePower2')).toBe('RagePower2');
    expect(barbarian.get('BarbarianTrapSense1')).toBe('TrapSense1');
    // acg_abilities_globalvar.lst, the skald's.
    expect(derive('Skald').typeBridges.get('SkaldRagePowers')).toBe(
      'RagePowers',
    );
    expect(derive('Bloodrager').typeBridges.get('BloodragerBloodline')).toBe(
      'Bloodline',
    );
  });

  it('cites the Foundry lines that compute the repeating features’ increments', async () => {
    const readAcquisitionFormula = (className: ClassName, id: string) =>
      schedule(className).features.find((feature) => feature.id === id)
        ?.acquisitionFormula ?? '';
    for (const [className, id, text] of [
      ['Bard', 'lore-master', 'floor((@class.level + 1) / 6)'],
      ['Barbarian', 'trap-sense', 'floor(@class.level / 3)'],
      ['Barbarian (Unchained)', 'danger-sense', 'floor(@class.level / 3)'],
      ['Skald', 'spell-kenning', 'gte(@class.level, 11)'],
      ['Skald', 'lore-master', 'floor((@class.level - 1) / 6)'],
      ['Bloodrager', 'bloodline-feat', 'floor(@class.level / 3) - 1'],
    ] as const)
      expect(
        await pinnedLine('pf1', readAcquisitionFormula(className, id)),
        id,
      ).toContain(text);
    // Rage powers, damage reduction, inspire competence, versatile
    // performance and inspired rage compute nothing from the level, so a part
    // removal of one leaves the other rows their own.
    for (const [className, id, file] of [
      ['Barbarian', 'rage-power', 'rage-powers.HdzsFdoGauXFjU2S'],
      ['Barbarian', 'damage-reduction', 'damage-reduction.RENIeTVjWB7Mq6Mw'],
      ['Bard', 'inspire-courage', 'inspire-courage.h56K6HEBOItImPPL'],
      ['Bard', 'inspire-competence', 'inspire-competence.2M56kfIOws5yYtxq'],
      [
        'Bard',
        'versatile-performance',
        'versatile-performance.HAqAsb5H56C6cZm3',
      ],
      ['Skald', 'inspired-rage', 'inspired-rage.1HQUUhQhowqKfmCA'],
      ['Skald', 'damage-reduction', 'damage-reduction-ska.kMjMAG6Gjs7unAz5'],
    ] as const) {
      expect(readAcquisitionFormula(className, id), id).toBe('');
      expect(
        await readPinned('pf1', `packs/class-abilities/${file}.yaml`),
      ).not.toContain('@class.level');
    }
  });
});

describe('per-increment identities (#716 P7c, note §5.6–7)', () => {
  it('repeats no key in any P7c class’s featuresByLevel, and keys every later row by its slug', () => {
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
          incrementEntries(schedule(className)).length,
        ]),
      ),
    ).toEqual({
      // Inspire courage 3, versatile performance 4, inspire competence 4,
      // lore master 2.
      Bard: 13,
      // Rage powers 9, trap sense 5, damage reduction 4.
      Barbarian: 18,
      // Rage powers 9, danger sense 5, damage reduction 4.
      'Barbarian (Unchained)': 18,
      // Inspired rage 5, versatile performance 3, rage powers 5, spell
      // kenning 2, lore master 2, damage reduction 2.
      Skald: 19,
      // Bloodline powers 5, bloodline feats 4, bloodline spells 3, damage
      // reduction 4.
      Bloodrager: 16,
    });
  });

  it('names the later rows by their table labels', () => {
    const listIncrementNames = (className: ClassName) =>
      Object.fromEntries(
        incrementEntries(schedule(className)).map(({ externalKey, name }) => [
          externalKey.replace('everythingpath/', ''),
          name,
        ]),
      );
    // Table: Bard (bard.html:362-376).
    expect(listIncrementNames('Bard')).toMatchObject({
      'bard-inspire-courage-17': 'Inspire Courage +4',
      'bard-inspire-competence-7': 'Inspire Competence +3',
      'bard-inspire-competence-19': 'Inspire Competence +6',
      'bard-versatile-performance-14': 'Versatile Performance',
      'bard-lore-master-11': 'Lore Master 2/day',
    });
    // Table: Barbarian (barbarian.html:358-376).
    expect(listIncrementNames('Barbarian')).toMatchObject({
      'barbarian-rage-power-4': 'Rage Power',
      'barbarian-trap-sense-18': 'Trap Sense +6',
      'barbarian-damage-reduction-19': 'Damage Reduction 5/—',
    });
    // The Unchained Barbarian table (barbarian.html:374-391).
    expect(listIncrementNames('Barbarian (Unchained)')).toMatchObject({
      'unchained-barbarian-rage-power-20': 'Rage Power (UC)',
      'unchained-barbarian-danger-sense-6': 'Danger Sense +2 (UC)',
      'unchained-barbarian-damage-reduction-10': 'Damage Reduction 2/— (UC)',
    });
    // The Skald table (skald.html:382-398).
    expect(listIncrementNames('Skald')).toMatchObject({
      'skald-inspired-rage-8': 'Inspired Rage +3 (+4 Str/Con)',
      'skald-inspired-rage-20': 'Inspired Rage +6',
      'skald-spell-kenning-17': 'Spell Kenning 3/day',
      'skald-damage-reduction-14': 'DR 2/—',
    });
    // The Bloodrager table (bloodrager.html:379-395).
    expect(listIncrementNames('Bloodrager')).toMatchObject({
      'bloodrager-bloodline-4': 'Bloodline Power',
      'bloodrager-bloodline-feat-18': 'Bloodline Feat',
      'bloodrager-bloodline-spell-16': 'Bloodline Spell',
      'bloodrager-damage-reduction-19': 'Damage Reduction 5/—',
    });
  });

  it('gives both barbarians the rows their representative seeds give', () => {
    // convex/lib/representativeClassCatalog.ts:903-926: rage, fast movement,
    // the 2nd-level rage power, uncanny dodge and trap sense (danger sense)
    // +1, each a row of the reviewed schedule at its level.
    for (const [className, identity] of [
      ['Barbarian', 'barbarian'],
      ['Barbarian (Unchained)', 'unchained-barbarian'],
    ] as const) {
      const rows = scheduleRows(schedule(className)).map(
        ({ classLevel, feature }) => [classLevel, feature],
      );
      const seeds = (representativeClassFeatureSchedules[identity] ?? []).map(
        ({ classLevel, catalogEntryId }) => [
          classLevel,
          catalogEntryId.replace(`${identity}-`, '').replace(/-\d+$/, ''),
        ],
      );
      expect(seeds, className).toHaveLength(5);
      for (const seed of seeds) expect(rows, className).toContainEqual(seed);
    }
  });
});

// One published archetype per class through the mapper (note §5.8), each in a
// sub-batch of at most 100 keys (plan Appendix G).
const { mapPublishedArchetype } = bindArchetypeMapper({
  tree,
  view,
  identities,
});

/** Stacking conflicts between archetypes as `[feature, part]`. */
const listConflicts = (...mappings: ArchetypeMapping[]) =>
  stackingConflicts(mappings).conflicts.map(({ feature, part }) => [
    feature,
    part,
  ]);

/**
 * A bard archetype built in memory from its `FACT:<flag>|true` tokens alone,
 * on a published archetype's place in the tree, for a combination no
 * published archetype has.
 */
function mapFlaggedArchetype({
  name,
  flags,
}: {
  name: string;
  flags: readonly string[];
}) {
  const host = tree.archetypes.find(
    ({ locator }) => locator.key === 'Bard Archetype ~ Archaeologist',
  );
  if (!host) throw new Error('No Bard Archetype ~ Archaeologist to host it.');
  const record: PcgenRecord = {
    ...host,
    name,
    locator: { ...host.locator, key: `Bard Archetype ~ ${name}` },
    grants: [],
    mods: [],
  };
  const effective: PcgenEffectiveRecord = {
    record,
    copiedFrom: null,
    tokens: flags.map((flag) => ({
      token: `FACT:${flag}|true`,
      file: host.locator.file,
      line: host.locator.line,
    })),
    levelLines: [],
    grants: [],
    appliedMods: [],
    optionalOverlays: [],
  };
  const withRecord = {
    ...view,
    records: new Map([...view.records, [record, effective]]),
  };
  return mapArchetype({
    context: archetypeClassContext({
      tree,
      view: withRecord,
      schedule: schedule('Bard'),
    }),
    record,
    externalKey: `everythingpath/bard-${name.toLowerCase().replace(/\W+/g, '-')}`,
    featureKeyOf: ({ locator }) => {
      throw new Error(`${name} grants no feature, not ${locator.key}.`);
    },
  });
}

describe('the P7c archetypes through the mapper (#716 P7c, note §5.8)', () => {
  it('Bard: Archaeologist removes bardic performance and with it every performance', async () => {
    // Ultimate Combat p.32: "Archaeologists do not gain the bardic
    // performance ability or any of its performance types"
    // (ultimateCombat/classArchetypes/bard.html:352); clever explorer and
    // uncanny dodge replace versatile performance and well-versed (:354-355);
    // uc_abilities_class.lst:1880.
    expect(
      await readPrdText({
        page: 'ultimateCombat/classArchetypes/bard.html',
        from: 352,
        to: 355,
      }),
    ).toContain(
      'Archaeologists do not gain the bardic performance ability or any of its performance types.',
    );
    const mapping = mapPublishedArchetype({
      className: 'Bard',
      archetype: 'Bard Archetype ~ Archaeologist',
    });
    expect(listReplacements(mapping)).toEqual([
      [1, 'pf1/ZfCUTi1MiLgR4T7I', 'whole'],
      [2, 'pf1/HAqAsb5H56C6cZm3', 'whole'],
      [2, 'pf1/wew6ophJrcab24m6', 'whole'],
      // Countersong to deadly performance, the subfeatures.
      [1, 'pf1/RF8ioMkLc7LNnNT1', 'whole'],
      [1, 'pf1/Kq3GVZ1yMv3ERQCJ', 'whole'],
      [1, 'pf1/tWE66WvFjS1o0S4y', 'whole'],
      [1, 'pf1/h56K6HEBOItImPPL', 'whole'],
      [3, 'pf1/2M56kfIOws5yYtxq', 'whole'],
      [6, 'pf1/vtrruBLKeimBrupy', 'whole'],
      [8, 'pf1/pmWnRksUzrKvNOvy', 'whole'],
      [9, 'pf1/X7gqbGkXTox6Ojhy', 'whole'],
      [12, 'pf1/iGrgU1XzlweVO2tb', 'whole'],
      [14, 'pf1/qfjvZrIgJUjRXUUL', 'whole'],
      [15, 'pf1/LIFTbzT5WDcsDn0O', 'whole'],
      [18, 'pf1/FnfX1SMG9uzBghnB', 'whole'],
      [20, 'pf1/RSoy0ll1sNno6mJD', 'whole'],
    ]);
    // PCGen's ungated duplicate grants keep bardic performance in PCGen.
    expect(summarizeItems(mapping)).toEqual([
      ['conflict', 'defect:ungated-duplicate-grants'],
    ]);
    expect(planArchetypeBatch({ className: 'Bard', mapping })).toEqual([9]);
  });

  it('Bard: Shadow Puppeteer removes every inspire courage and inspire competence point, by value', () => {
    // Advanced Race Guide p.210; arg_abilities_class.lst:999, :1083:
    // InspireCompetence1 and 2 are both the 3rd-level +2.
    const mapping = mapPublishedArchetype({
      className: 'Bard',
      archetype: 'Bard Archetype ~ Shadow Puppeteer',
    });
    expect(listReplacements(mapping)).toEqual([
      [1, 'pf1/h56K6HEBOItImPPL', 'part'],
      [5, 'everythingpath/bard-inspire-courage-5', 'part'],
      [11, 'everythingpath/bard-inspire-courage-11', 'part'],
      [17, 'everythingpath/bard-inspire-courage-17', 'part'],
      [3, 'pf1/2M56kfIOws5yYtxq', 'part'],
      [7, 'everythingpath/bard-inspire-competence-7', 'part'],
      [11, 'everythingpath/bard-inspire-competence-11', 'part'],
      [15, 'everythingpath/bard-inspire-competence-15', 'part'],
      [19, 'everythingpath/bard-inspire-competence-19', 'part'],
    ]);
  });

  it('finds conflicts across bardic performance, and lets archetypes replacing different performances stack', () => {
    const mapBardArchetype = (name: string) =>
      mapPublishedArchetype({
        className: 'Bard',
        archetype: `Bard Archetype ~ ${name}`,
      });
    const archaeologist = mapBardArchetype('Archaeologist');
    const shadowPuppeteer = mapBardArchetype('Shadow Puppeteer');
    const prankster = mapBardArchetype('Prankster');
    // Archaeologist's removal of bardic performance reaches inspire courage
    // and competence, and Prankster's fascinate, suggestion and mass
    // suggestion (ARG p.26; arg_abilities_class.lst:1082).
    expect(listConflicts(archaeologist, shadowPuppeteer)).toEqual([
      ['pf1/h56K6HEBOItImPPL', null],
      ['pf1/2M56kfIOws5yYtxq', null],
    ]);
    expect(listConflicts(archaeologist, prankster)).toEqual([
      ['pf1/tWE66WvFjS1o0S4y', null],
      ['pf1/vtrruBLKeimBrupy', null],
      ['pf1/FnfX1SMG9uzBghnB', null],
    ]);
    // Different performances stack (FAQ June 2015, APT:44).
    expect(listConflicts(shadowPuppeteer, prankster)).toEqual([]);
  });

  it('keeps an alteration of bardic performance whole on a performance the archetype also removes a part of', () => {
    // An alteration naming the whole parent conflicts with any affected part
    // (docs/character-sheet/archetypes-and-prestige-classes.md:11), whatever
    // else the archetype replaces. No published bard archetype marks bardic
    // performance and removes a numbered performance part, so both are
    // built in memory: one alters bardic performance and removes the 5th-level
    // inspire courage, the other removes the 11th-level one.
    const altersAndRemoves = mapFlaggedArchetype({
      name: 'Altered Performer',
      flags: ['Bard_Archetype_BardicPerformance', 'Bard_CF_InspireCourage2'],
    });
    const removes = mapFlaggedArchetype({
      name: 'Eleventh-Level Courage',
      flags: ['Bard_CF_InspireCourage3'],
    });
    expect(listReplacements(altersAndRemoves)).toEqual([
      [5, 'everythingpath/bard-inspire-courage-5', 'part'],
    ]);
    expect(
      readArchetypeDetail(altersAndRemoves).featureChanges?.find(
        ({ externalKey }) => externalKey === 'pf1/h56K6HEBOItImPPL',
      ),
    ).toEqual({ externalKey: 'pf1/h56K6HEBOItImPPL', scope: 'whole' });
    expect(listConflicts(altersAndRemoves, removes)).toEqual([
      ['pf1/h56K6HEBOItImPPL', null],
    ]);
  });

  it('Barbarian: Hateful Rager removes the 2nd-, 8th-, 14th- and 20th-level rage powers and trap sense +3, by order', async () => {
    // Advanced Race Guide p.54: "This ability replaces the
    // barbarian's rage power gained at 2nd level. At 8th, 14th, and 20th
    // levels, in place of a rage power…", "replaces improved uncanny
    // dodge", "replaces trap sense +3" (advancedRaceGuide/coreRaces/
    // halfOrcs.html:440-442); arg_abilities_class.lst:1081.
    const text = await readPrdText({
      page: 'advancedRaceGuide/coreRaces/halfOrcs.html',
      from: 440,
      to: 442,
    });
    expect(text).toContain(
      "replaces the barbarian's rage power gained at 2nd level",
    );
    expect(text).toContain('This ability replaces improved uncanny dodge.');
    expect(text).toContain('This ability replaces trap sense +3.');
    const mapping = mapPublishedArchetype({
      className: 'Barbarian',
      archetype: 'Barbarian Archetype ~ Hateful Rager',
    });
    expect(listReplacements(mapping)).toEqual([
      [2, 'pf1/HdzsFdoGauXFjU2S', 'part'],
      [8, 'everythingpath/barbarian-rage-power-8', 'part'],
      [14, 'everythingpath/barbarian-rage-power-14', 'part'],
      [20, 'everythingpath/barbarian-rage-power-20', 'part'],
      [5, 'pf1/ZfnHhhTFQVo0Lj4P', 'whole'],
      [9, 'everythingpath/barbarian-trap-sense-9', 'part'],
    ]);
    // Foundry's trap sense counts every point from the barbarian level
    // (trap-sense.BoEkMviJrW0PKmhj.yaml:17).
    expect(summarizeItems(mapping)).toEqual([
      ['conflict', 'partialFormula:trap-sense'],
    ]);
    expect(planArchetypeBatch({ className: 'Barbarian', mapping })).toEqual([
      6,
    ]);
  });

  it('Barbarian (Unchained): Invulnerable Rager’s flags name the Unchained rows, its trap sense the danger sense', async () => {
    // APG p.79, an original barbarian archetype, which reaches the Unchained
    // barbarian at runtime (docs/character-sheet/unchained-classes.md:12):
    // "replaces uncanny dodge, improved uncanny dodge, and damage
    // reduction", "replaces trap sense" (advancedPlayersGuide/coreClasses/
    // barbarian.html:423-424); danger sense "can be replaced by any
    // archetype class feature that replaces trap sense" (Pathfinder
    // Unchained p.9, unchained/classes/barbarian.html:464).
    expect(
      await readPrdText({
        page: 'unchained/classes/barbarian.html',
        from: 464,
        to: 464,
      }),
    ).toContain(
      'can be replaced by any archetype class feature that replaces trap sense',
    );
    const mapping = mapPublishedArchetype({
      className: 'Barbarian (Unchained)',
      archetype: 'Barbarian Archetype ~ Invulnerable Rager',
    });
    expect(listReplacements(mapping)).toEqual([
      [2, 'pf1/7WaQxnVaaoL4AGr8', 'whole'],
      [5, 'pf1/ZfnHhhTFQVo0Lj4P', 'whole'],
      [7, 'pf1/RENIeTVjWB7Mq6Mw', 'whole'],
      [3, 'pf1/sTlu3zgAEDdJnER5', 'whole'],
    ]);
    // Its BarbarianCF<feature> TYPE tokens are reviewed aliases of its flags
    // (apg_abilities_class.lst:1546).
    expect(
      summarizeItems(mapping).filter(([, id]) => id?.startsWith('unknown:')),
    ).toEqual([]);
    expect(
      planArchetypeBatch({ className: 'Barbarian (Unchained)', mapping }),
    ).toEqual([3]);
  });

  it('Skald: Herald of the Horn removes spell kenning whole, its numbered flags held on the defect', () => {
    // ACG p.115; acg_abilities_class.lst:3682, :4674: the old-style
    // SkaldSpellKenning TYPE removes the whole feature beside the
    // SpellKenning5, 11 and 17 FACTs, which PCGen defines but gates nothing
    // on.
    const mapping = mapPublishedArchetype({
      className: 'Skald',
      archetype: 'Skald Archetype ~ Herald of the Horn',
    });
    expect(listReplacements(mapping)).toEqual([
      [7, 'pf1/ptw7bHU3Z7HNj2qz', 'whole'],
      [1, 'pf1/BS9WDbCy2Up3QHw9', 'whole'],
      [5, 'pf1/tlvQVJUUFUVQ92EH', 'whole'],
    ]);
    expect(summarizeItems(mapping)).toEqual([
      ['conflict', 'defect:spell-kenning-parts'],
    ]);
    expect(planArchetypeBatch({ className: 'Skald', mapping })).toEqual([5]);
  });

  it('Bloodrager: Blood Havoc removes the 4th-level bloodline power, which each bloodline gates on its flag', () => {
    // Magic Tactics Toolbox; magtt_abilities_class.lst:29 sets
    // Bloodrager_CF_BloodlinePower4, which each bloodline reads into the
    // variable gating its 4th-level power (acg_abilities_class.lst:565-566).
    const mapping = mapPublishedArchetype({
      className: 'Bloodrager',
      archetype: 'Bloodrager Archetype ~ Blood Havoc',
    });
    expect(listReplacements(mapping)).toEqual([
      [4, 'everythingpath/bloodrager-bloodline-4', 'part'],
    ]);
    // No defect holds it: the flag is gated.
    expect(summarizeItems(mapping)).toEqual([]);
    expect(planArchetypeBatch({ className: 'Bloodrager', mapping })).toEqual([
      2,
    ]);
  });

  it('Bloodrager: Bloodline Familiar’s 1st-level bloodline power is held, and the bloodline survives', () => {
    // Familiar Folio p.16; ff_abilities_class.lst:33 sets only
    // Bloodrager_CF_BloodlinePower1, which removes the 1st-level power and
    // keeps Standard Bloodline (acg_classes.lst:48). The schedule's 1st-level
    // row is the bloodline itself, Foundry's Bloodrager Bloodline holding
    // both, so no row removes the power alone.
    const mapping = mapPublishedArchetype({
      className: 'Bloodrager',
      archetype: 'Bloodrager Archetype ~ Bloodline Familiar',
    });
    const bloodline = 'pf1/Aq9rx7oWgv7A7kiV';
    const detail = readArchetypeDetail(mapping);
    expect(
      detail.replaces.filter(({ externalKey }) => externalKey === bloodline),
    ).toEqual([]);
    expect(
      (detail.featureChanges ?? []).filter(
        ({ externalKey }) => externalKey === bloodline,
      ),
    ).toEqual([]);
    // Its Bloodrager_Archetype_Spells marks the casting row touched.
    expect(summarizeItems(mapping)).toEqual([
      ['unmatchedReplacement', 'alters:spells'],
      ['uncheckedCasting', 'casting:spells'],
      ['unmatchedReplacement', 'sharedRow:BloodlinePower1'],
    ]);
  });

  it('Bloodrager: Greenrager removes blood sanctuary and the 6th- and 9th-level bloodline feats, held on the formula', () => {
    // ACG p.83; acg_abilities_class.lst:2710, :4619.
    const mapping = mapPublishedArchetype({
      className: 'Bloodrager',
      archetype: 'Bloodrager Archetype ~ Greenrager',
    });
    expect(listReplacements(mapping)).toEqual([
      [3, 'pf1/xvBGDYUbsE4Ozean', 'whole'],
      [6, 'pf1/xxD5AbgfJ5OuzVld', 'part'],
      [9, 'everythingpath/bloodrager-bloodline-feat-9', 'part'],
    ]);
    // Foundry's bloodline feat counts every feat from the bloodrager level
    // (bloodline-feat-blo.xxD5AbgfJ5OuzVld.yaml:13).
    expect(summarizeItems(mapping)).toEqual([
      ['conflict', 'partialFormula:bloodline-feat'],
      ['conflict', 'stackingGuard'],
    ]);
    expect(planArchetypeBatch({ className: 'Bloodrager', mapping })).toEqual([
      4,
    ]);
  });
});
