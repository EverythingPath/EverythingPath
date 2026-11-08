// @vitest-environment node
import { recordedPrerequisiteFacts } from './prerequisite-audit-739';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import {
  upstreamRecord,
  sourceDescription,
} from '../../scripts/catalog/records';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
} from '../../scripts/catalog/admission';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import {
  modifierTargets,
  resolveSheet,
  calculateCharacterSheetProjections,
} from '../../src/lib/character-sheet';
import {
  review,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/feats-365/data';
import { reviewedFeatSheet } from '../fixtures/feats-365/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { expectAutomaticSkillFocus } from './skill-focus-assertions';
import { assessWithUnclearedHolds } from './uncleared-holds';

const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
function entry(name: string) {
  const row = preview.entries.find((row) => row.name === name);
  if (!row) throw new Error(`Missing ${name}`);
  if (row.detail.kind !== 'feat') throw new Error('Expected feat');
  return { ...row, detail: row.detail };
}
function candidate(name: string) {
  const row = review.candidates.find((row) => row.name === name);
  if (!row) throw new Error(`Missing review of ${name}`);
  return row;
}
function modifiers(name: string, sheetEntryId = entry(name).externalKey) {
  const row = entry(name);
  return row.modifiers.map((raw) => ({
    ...outputSchema.options[0]
      .omit({ kind: true })
      .extend({ target: z.enum(modifierTargets) })
      .parse(raw),
    sheetEntryId,
    catalogEntryId: row.externalKey,
    source: row.externalKey,
    entryName: row.name,
    builtIn: false,
  }));
}
function situation(
  name: string,
  index = 0,
  sheetEntryId = entry(name).externalKey,
) {
  const scope = modifiers(name)[index]?.condition?.situation;
  if (typeof scope !== 'object' || !('local' in scope))
    throw new Error('Expected local Situation');
  return { ...scope, sheetEntryId };
}
// An unrelated entry's bonus of the given type, for stacking checks.
function other(
  row: ReturnType<typeof modifiers>[number],
  value: number,
  source = 'other-entry',
) {
  return {
    ...row,
    sheetEntryId: source,
    catalogEntryId: source,
    source,
    entryName: source,
    value,
    condition: undefined,
  };
}
// The isolated sheet with one ability score changed from its base 10.
function withAbility(
  sheet: ReturnType<typeof reviewedFeatSheet>,
  target: string,
  value: number,
) {
  return {
    ...sheet,
    catalogEntries: sheet.catalogEntries.map((row) =>
      row._id === 'base'
        ? {
            ...row,
            modifiers: row.modifiers.map((modifier) =>
              modifier.target === target ? { ...modifier, value } : modifier,
            ),
          }
        : row,
    ),
  };
}
// Resolve one local Situation for every Modifier of an entry.
function all(name: string, sheetEntryId = entry(name).externalKey) {
  return modifiers(name).map((_, index) =>
    situation(name, index, sheetEntryId),
  );
}

const skillFocus = 'Skill Focus (Acrobatics)';
const noRow = [
  'Swift Crystalline Dust',
  'Controlled Patterns',
  'Esoteric Illusion',
  'Channel Deific Essence',
  'Lantern Style',
  'Spell Bluff (Teamwork)',
  'Fiendish Heritage',
  'Dog-Sniff-Hate',
  'Innate Arcana',
  'Changeling Familiar',
  'Spell Chain',
  'Breach',
  'Lengthy Potion',
  'Runic Charge',
  "Dryad's Apprentice",
  'Gilded Weapons',
  "Giant's Smash",
];

// #724: the rank threshold is automatic, read from the skill's recorded ranks.
it('resolves the admitted Skill Focus (Acrobatics) from its own skill ranks, without stacking copies', () => {
  const rows = modifiers(skillFocus);
  expectAutomaticSkillFocus({ modifiers: rows, target: 'skill.acr' });
  expect(candidate(skillFocus)).toMatchObject({
    disposition: 'admitted',
    assessmentStatus: 'confirmed',
    requiredNotices: ['PZO1110'],
    holdIds: [],
    noticeHoldIds: [],
    noticeRequirementsComplete: true,
  });
  expect(candidate(skillFocus).comparison).toMatchObject({
    book: 'PZO1110',
    line: 156,
    completeDirectComparison: true,
    evidenceRole: 'complete-root-comparison',
  });
  expect(candidate(skillFocus).comparison?.literalRow).toContain(
    'BENEFIT:You get a +3 bonus on all checks involving the chosen skill. If you have 10 or more ranks in that skill, this bonus increases to +6.',
  );
  expect(candidate(skillFocus).comparison?.literalRow).toMatch(
    /STACK:NO\tMULT:YES\tCHOOSE:SKILL\|TYPE=Base/,
  );
  const [anchor] = candidate(skillFocus).inheritedRuleComparisonEvidence;
  expect(anchor).toMatchObject({ line: 7, book: 'PZO1110' });
  expect(anchor?.literalRow.split('\t')[0]).toBe('Acrobatics');
  expect(anchor?.literalRow).toMatch(/\tTYPE:[\w.]+\.Base\t/);
  const [record] = candidate(skillFocus).mechanicsReview.curationRecords;
  expect(record?.diagnostics).toEqual([]);
  expect(entry(skillFocus).unsupported).toEqual(
    expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
  );
  // No ranks and the skill's ability at 10: Skill Focus's +3 alone.
  expect(
    calculateCharacterSheetProjections(reviewedFeatSheet(skillFocus)).current
      .breakdowns['skill.acr'].total,
  ).toBe(3);
});

it('keeps exclusive tiers and options to the strongest bonus and typed bonuses to their stacking rules', () => {
  // Garen's Discipline applies only to the chosen save type; its base attack
  // bonus tiers are exclusive within each save.
  const garen = modifiers("Garen's Discipline");
  expect(garen.map((row) => [row.target, row.bonusType, row.value])).toEqual(
    ['save.fort', 'save.ref', 'save.will'].flatMap((target) =>
      [2, 3, 4].map((value) => [target, 'untyped', value]),
    ),
  );
  expect(situation("Garen's Discipline", 4).local).toBe(
    "Reflex saves chosen with Garen's Discipline (once per round, after using Combat Expertise, fighting defensively or total defense), with base attack bonus +11 to +15",
  );
  expect(resolveSheet(garen)['save.ref'].total).toBe(0);
  const reflex = resolveSheet(garen, {
    situations: [situation("Garen's Discipline", 4)],
  });
  expect([
    reflex['save.fort'].total,
    reflex['save.ref'].total,
    reflex['save.will'].total,
  ]).toEqual([0, 3, 0]);
  const will = resolveSheet(garen, {
    situations: [6, 7, 8].map((index) =>
      situation("Garen's Discipline", index),
    ),
  });
  expect([
    will['save.fort'].total,
    will['save.ref'].total,
    will['save.will'].total,
  ]).toEqual([0, 0, 4]);
  // Orc Weapon Expertise's Defender shield bonuses are exclusive and do not
  // stack with another shield bonus.
  const orc = modifiers('Orc Weapon Expertise');
  expect(orc.map((row) => [row.target, row.bonusType, row.value])).toEqual([
    ['damage', 'untyped', 1],
    ['ac.shield', 'shield', 1],
    ['ac.shield', 'shield', 2],
    ['cmb', 'untyped', 2],
  ]);
  const defender = [
    situation('Orc Weapon Expertise', 1),
    situation('Orc Weapon Expertise', 2),
  ];
  expect(resolveSheet(orc, { situations: defender })['ac.shield'].total).toBe(
    2,
  );
  expect(
    resolveSheet([...orc, other(orc[1]!, 3)], { situations: defender })[
      'ac.shield'
    ].total,
  ).toBe(3);
  const bully = resolveSheet(orc, {
    situations: [situation('Orc Weapon Expertise')],
  });
  expect([
    bully['damage.melee'].total,
    bully['damage.ranged'].total,
    bully.cmb.total,
    bully['ac.shield'].total,
  ]).toEqual([1, 1, 0, 0]);
  // Dodge bonuses from different sources stack.
  const cautious = modifiers('Cautious Fighter');
  expect(resolveSheet(cautious)['ac.other'].total).toBe(0);
  expect(
    resolveSheet([...cautious, other(cautious[0]!, 2)], {
      situations: all('Cautious Fighter'),
    })['ac.other'].total,
  ).toBe(4);
  // Morale bonuses do not stack with another morale bonus.
  const desperate = modifiers('Desperate Battler');
  const alone = resolveSheet(desperate, {
    situations: all('Desperate Battler'),
  });
  expect([
    alone['attack.melee'].total,
    alone['damage.melee'].total,
    alone['attack.ranged'].total,
  ]).toEqual([1, 1, 0]);
  expect(
    resolveSheet([...desperate, other(desperate[0]!, 2)], {
      situations: all('Desperate Battler'),
    })['attack.melee'].total,
  ).toBe(2);
  const canines = resolveSheet(modifiers('Dog-Sniff-Hate'), {
    situations: all('Dog-Sniff-Hate'),
  });
  expect([
    canines['attack.melee'].total,
    canines['attack.ranged'].total,
    canines['damage.melee'].total,
  ]).toEqual([1, 1, 2]);
  const fey = resolveSheet(modifiers('Fey-Guarded'), {
    situations: all('Fey-Guarded'),
  });
  expect([
    fey['save.fort'].total,
    fey['save.ref'].total,
    fey['save.will'].total,
  ]).toEqual([2, 2, 2]);
  // No Name's Bluff bonus is unconditional; its grit Disguise bonus is not.
  const noName = modifiers('No Name');
  expect(resolveSheet(noName)['skill.blf'].total).toBe(2);
  expect(resolveSheet(noName)['skill.dis'].total).toBe(0);
  expect(
    resolveSheet(noName, { situations: [situation('No Name', 1)] })['skill.dis']
      .total,
  ).toBe(10);
  // Magical Aptitude (Mythic) increases the base feat's untyped bonus.
  const aptitude = resolveSheet(modifiers('Magical Aptitude (Mythic)'));
  expect([aptitude['skill.spl'].total, aptitude['skill.umd'].total]).toEqual([
    2, 2,
  ]);
  for (const [name, target, value] of [
    ['Bat Shape', 'skill.dis', 10],
    ['Shocking Amplification', 'attack.ranged', -1],
    ['Shocking Amplification', 'spellDC', -1],
    ['Bloody Assault', 'attack.melee', -5],
    ['Bloody Assault', 'cmb', -5],
    ['Great Hatred', 'attack.melee', 1],
    ['Sweeping Disarm', 'cmb', -5],
    ['Footslasher', 'attack.melee', -2],
    ['Hardy Liver', 'save.fort', 2],
    ['Know Weakness', 'damage.ranged', 1],
    ['Runic Charge', 'casterLevel', 2],
    ["Dryad's Apprentice", 'skill.crf', 4],
    ['Burn! Burn! Burn!', 'save.ref', 4],
    ['Elemental Focus (Mythic)', 'spellDC', 1],
    ['Shark Tear', 'attack.melee', 1],
    ['Gloom Strike', 'attack.ranged', 1],
    ['Tengu Raven Form', 'ac.natural', 4],
  ] as const) {
    const rows = modifiers(name);
    expect(resolveSheet(rows)[target].total, name).toBe(0);
    expect(
      resolveSheet(rows, { situations: all(name) })[target].total,
      name,
    ).toBe(value);
  }
  // Only No Name's Bluff and the mythic Magical Aptitude increases change an
  // unconditional holder total.
  for (const name of [
    'No Name',
    'Magical Aptitude (Mythic)',
    "Garen's Discipline",
    'Desperate Battler',
    'Cautious Fighter',
  ] as const)
    expect(
      Object.entries(
        calculateCharacterSheetProjections(reviewedFeatSheet(name)).current
          .breakdowns,
      )
        .filter(([, row]) => row.total !== 0 && row.total !== 10)
        .map(([target, row]) => [target, row.total]),
      name,
    ).toEqual(
      name === 'No Name'
        ? [['skill.blf', 2]]
        : name === 'Magical Aptitude (Mythic)'
          ? [
              ['skill.spl', 2],
              ['skill.umd', 2],
            ]
          : [],
    );
});

it("adds Fury's Fall's Dexterity bonus to CMB only on trips and applies Tengu Raven Form's ability changes only in raven form", () => {
  const [trip] = entry("Fury's Fall").modifiers;
  expect(trip).toMatchObject({
    target: 'cmb',
    value: { formula: 'max(0, @ability.dex.mod)' },
    condition: { situation: 'trip' },
  });
  const nimble = withAbility(
    reviewedFeatSheet("Fury's Fall"),
    'ability.dex',
    16,
  );
  expect(
    calculateCharacterSheetProjections(nimble).current.breakdowns.cmb.total,
  ).toBe(0);
  expect(
    calculateCharacterSheetProjections(nimble, { situations: ['trip'] }).current
      .breakdowns.cmb.total,
  ).toBe(3);
  // A Dexterity penalty is not a bonus: the formula floors at 0.
  const clumsy = withAbility(
    reviewedFeatSheet("Fury's Fall"),
    'ability.dex',
    8,
  );
  expect(
    calculateCharacterSheetProjections(clumsy, { situations: ['trip'] }).current
      .breakdowns.cmb.total,
  ).toBe(0);
  const raven = reviewedFeatSheet('Tengu Raven Form');
  const human = calculateCharacterSheetProjections(raven).current.breakdowns;
  expect([
    human['ability.str'].total,
    human['ability.dex'].total,
    human['ac.natural'].total,
  ]).toEqual([10, 10, 0]);
  const form = calculateCharacterSheetProjections(raven, {
    situations: all('Tengu Raven Form', 'feat-row'),
  }).current.breakdowns;
  expect([
    form['ability.str'].total,
    form['ability.dex'].total,
    form['ac.natural'].total,
  ]).toEqual([14, 8, 4]);
});

it('keeps resource, mythic-power, recipient, replacement and scaling bodies off holder totals', () => {
  for (const name of [
    'Extended Animal Focus',
    'Startoss Comet',
    'Intuitive Spell',
    'Martial Mastery',
    'Natural Ruler',
    'Gnawer',
    'Improved Rending Fury',
    'Rapid Shot (Mythic)',
    'Shaping Focus',
    'Greater Wild Empathy',
    'Welcome Pain',
    'Accursed',
    'Merciless Precision',
    'Shield Focus (Mythic)',
    'Channel Deific Essence',
    'Nimble Striker',
    'Improved Low Blow',
    'Expanded Arcana',
    'Dragon Ferocity',
    'Goblin Gunslinger',
    'Drow Nobility',
  ]) {
    expect(modifiers(name), name).toEqual([]);
    expect(entry(name).situationalNotes?.[0]?.text, name).toBeTruthy();
    expect(
      candidate(name).mechanicsReview.outstandingCalculations.length,
      name,
    ).toBeGreaterThan(0);
  }
  for (const row of review.candidates)
    expect(
      row.mechanicsReview.outstandingCalculations.length,
      row.name,
    ).toBeGreaterThan(0);
  // #724: each Skill Focus has one automatic Modifier instead of two.
  expect(preview.entries.flatMap((row) => row.modifiers)).toHaveLength(46);
  expect(
    preview.entries.filter((row) => row.modifiers.length > 0),
  ).toHaveLength(25);
  expect(
    preview.entries.flatMap((row) =>
      row.modifiers.filter((modifier) => modifier.target === 'hp'),
    ),
  ).toEqual([]);
});

it('records inherited-rule notices, alternate versions and enforced notice holds without inventing attribution', () => {
  const tricks = [
    ['Cautious Fighter', 'PZO1131'],
    ['Martial Mastery', 'PZO1131'],
    ['Improved Rending Fury', 'PZO1131'],
    ['Improved Blind-Fight', 'PZO1131'],
    ['Bloody Assault', 'PZO1131'],
    ['Moonlight Stalker Master', 'PZO1131'],
    ['Ray Shield', 'PZO1131'],
    ['Nimble Striker', 'PZO1131'],
    ['Tiger Pounce', 'PZO1131'],
    ['Great Hatred', 'PZO1131'],
    ['Improved Low Blow', 'PZO1131'],
    ['Swift Aid', 'PZO1131'],
    ['Orc Weapon Expertise', 'PZO1131'],
    ['Desperate Battler', 'PZO9463'],
    ['Gloom Strike', 'PZO1131'],
    ['Goblin Gunslinger', 'PZO1131'],
    ['Dragon Ferocity', 'PZO1131'],
    ['Greater Whip Mastery', 'PZO1131'],
  ] as const;
  for (const [name, book] of tricks) {
    expect(candidate(name).requiredNotices, name).toContain('PZO1131');
    expect(candidate(name).requiredNotices, name).toContain(book);
    expect(entry(name).description, name).toContain('Combat Trick');
    const trick = candidate(name).inheritedRuleComparisonEvidence.find((row) =>
      row.literalRow.includes('KEY:Combat Trick ~ '),
    );
    expect(trick, name).toMatchObject({
      evidenceRole: 'inherited-rule-comparison',
      appliesToRootBody: false,
      book,
    });
    expect(trick?.literalRow, name).toContain(`KEY:Combat Trick ~ ${name}\t`);
  }
  // Every stamina body is a trick, except Welcome Pain, whose flavor line
  // says "great stamina" and names no stamina pool.
  expect(
    review.candidates
      .filter((row) =>
        JSON.stringify(row.sourceFields.description).includes('stamina'),
      )
      .map((row) => row.name)
      .sort(),
  ).toEqual([...tricks.map(([name]) => name), 'Welcome Pain'].sort());
  expect(candidate('Welcome Pain').requiredNotices).not.toContain('PZO1131');
  expect(entry('Welcome Pain').description).toContain(
    'grants you great stamina',
  );
  expect(candidate('Desperate Battler').requiredNotices).toEqual([
    'PZO9226',
    'PZO1131',
    'PZO9463',
    'PZO1110',
  ]);
  for (const [name, base] of [
    ['Rapid Shot (Mythic)', null],
    ['Shield Focus (Mythic)', null],
    ['Magical Aptitude (Mythic)', null],
    ['Elemental Focus (Mythic)', 'PZO1115'],
  ] as const) {
    expect(candidate(name).requiredNotices, name).toContain('PZO1126');
    expect(candidate(name).comparison?.literalRow, name).toContain(
      'KEY:Mythic Feat Output ~ ',
    );
    const rows = candidate(name).inheritedRuleComparisonEvidence;
    expect(
      rows.map((row) => row.book),
      name,
    ).toEqual(base ? [base] : []);
    if (base) {
      expect(candidate(name).requiredNotices, name).toContain(base);
      expect(rows[0]?.literalRow.split('\t')[0], name).toBe(
        name.replace(' (Mythic)', ''),
      );
    }
  }
  for (const [name, book] of [
    ['Extended Animal Focus', 'PZO1129'],
    ['Linnorm Hunter Retreat', 'PZO1115'],
    ['Linnorm Hunter Retreat', 'PZO1118'],
    ['Aldori Style Conquest', 'PZO1118'],
    ['Swipe and Stash', 'PZO1115'],
    ['Natural Ruler', 'PZO1125'],
    ['Gnawer', 'PZO1121'],
    ['Improved Rending Fury', 'PZO1112'],
    ['Splash Volley', 'PZO1115'],
    ['Controlled Patterns', 'PZO1112'],
    ['Greater Wild Empathy', 'PZO1112'],
    ['Escape Route', 'PZO1115'],
    ['Lantern Style', 'PZO1118'],
    ['Nimble Striker', 'PZO1115'],
    ['Tiger Pounce', 'PZO1118'],
    ['Thoughtful Discernment', 'PZO1115'],
    ['Fey-Guarded', 'PZO1112'],
    ['Spell Bluff (Teamwork)', 'PZO1115'],
    ['Phantom Fortification', 'PZO1132'],
    ['Abundant Revelations', 'PZO1115'],
    ['Verdant Spell', 'PZO1112'],
    ['Ready for Pain', 'PZO1132'],
    ['Dog-Sniff-Hate', 'PZO1112'],
    ['Grand Duchy Familiarity', 'PZO1118'],
    ['Extended Stare', 'PZO1132'],
    ['Sensory Control', 'PZO1112'],
    ['Sensory Control', 'PZO1115'],
    ['Lightning Draw', 'PZO1129'],
    ['Changeling Familiar', 'PZO1112'],
    ['Spell Chain', 'PZO1115'],
    ['Kitsune Style', 'PZO1118'],
    ['Kitsune Style', 'PZO1115'],
    ['Spring-Heeled Sprint', 'PZO1118'],
    ['Expanded Arcana', 'PZO1115'],
    ['Soulblade', 'PZO1114'],
    ['Angelbane Strike', 'PZO1115'],
    ['Burn! Burn! Burn!', 'PZO1115'],
    ['Elven Battle Torrent', 'PZO1118'],
    ['Shark Tear', 'PZO1118'],
    ['Shark Tear', 'PZO1112'],
    ['Goblin Gunslinger', 'PZO1118'],
    ['Gilded Weapons', 'PZO1112'],
    ['Dragon Ferocity', 'PZO1118'],
    ['Dragon Ferocity', 'PZO1115'],
    ["Giant's Smash", 'PZO1112'],
    ['Prophetic Visionary', 'PZO1115'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Pinned pf1 spell and race records name the books of the rules these
  // bodies use.
  for (const [name, path, book] of [
    [
      'Channel Deific Essence',
      'packs/spells/invoke-deity.9ct47k3n3zubtr9p.yaml',
      'PZO1141',
    ],
    [
      'Swift Crystalline Dust',
      'packs/races/aphorite.zlWiqUqxCajrZRe3.yaml',
      'PZO1141',
    ],
    ['Gilded Weapons', 'packs/races/aphorite.zlWiqUqxCajrZRe3.yaml', 'PZO1141'],
    ['Bat Shape', 'packs/races/skinwalker.apWl6JIJ8U8p0azq.yaml', 'PZO1133'],
    [
      'Fiendish Heritage',
      'packs/races/tiefling.nVjKDLZSRONzYm8f.yaml',
      'PZO9280',
    ],
    ['Drow Nobility', 'packs/races/drow.yLaDS5HGbwtgpkbP.yaml', 'PZO9280'],
  ] as const) {
    expect(
      candidate(name).inheritedRuleNotices.find((row) =>
        row.location.endsWith(path),
      )?.book,
      name,
    ).toBe(book);
    expect(candidate(name).requiredNotices, name).toContain(book);
  }
  // Bestiary 2 race rows anchor the monsters these rowless bodies extend.
  for (const [name, race] of [
    ['Innate Arcana', 'Serpentfolk'],
    ['Breach', 'Bunyip'],
  ] as const) {
    const [anchor] = candidate(name).inheritedRuleComparisonEvidence;
    expect(anchor, name).toMatchObject({
      book: 'PZO1116',
      appliesToRootBody: false,
      publicationAnchor: expect.objectContaining({
        text: 'SOURCELONG:Bestiary 2',
      }),
    });
    expect(anchor?.literalRow.split('\t')[0], name).toBe(race);
    expect(candidate(name).requiredNotices, name).toEqual([
      'PZO1116',
      'PZO1110',
    ]);
  }
  // The earlier Extended Animal Focus version is rejected; the hunter's
  // animal focus still requires its own book through the inherited rule.
  expect(candidate('Extended Animal Focus').comparison?.book).toBe('PZO1140');
  expect(
    candidate('Extended Animal Focus').rejectedRootComparisonEvidence.map(
      (row) => row.book,
    ),
  ).toEqual(['PZO1129']);
  expect(
    candidate('Extended Animal Focus').rejectedRootComparisonEvidence[0]
      ?.literalRow,
  ).toContain('Your ability to emulate an animal lingers longer.');
  // Earlier printings that support the body are leads, not requirements.
  for (const [name, root, lead] of [
    ['Verdant Spell', 'PZO1140', 'PZO9456'],
    ['Burn! Burn! Burn!', 'PZO1121', 'PZO9419'],
  ] as const) {
    expect(candidate(name).comparison?.book, name).toBe(root);
    expect(
      candidate(name).additionalComparisonLeads.map((row) => row.book),
      name,
    ).toEqual([lead]);
    expect(candidate(name).requiredNotices, name).not.toContain(lead);
  }
  expect(
    candidate('Brilliant Spell Preperation').comparison?.literalRow,
  ).toMatch(/^Brilliant Spell Preparation\t/);
  expect(candidate('Battle Cry (Bard)').comparison?.literalRow).toMatch(
    /^Battle Cry\t.*TYPE:General\t.*Bardic Performance/,
  );
  // Same-name rows of different feats or traits are named, not evidence.
  for (const [name, row] of [
    ['Battle Cry (Bard)', 'acg_feats.lst:19'],
    ['Spell Bluff (Teamwork)', 'um_feats.lst:115'],
    ['Dog-Sniff-Hate', 'goog_abilities_race.lst:36'],
  ] as const)
    expect(
      candidate(name).mechanicsReview.sourceDiscrepancies.join(' '),
      name,
    ).toContain(row);
  expect(
    candidate('Fiendish Heritage').mechanicsReview.sourceDiscrepancies[0],
  ).toContain('not rule text');
  for (const name of noRow) {
    expect(candidate(name).comparison, name).toBeNull();
    expect(candidate(name).inheritedRuleUnresolvedOrigins[0], name).toContain(
      'no PCGen row at the pin',
    );
  }
  expect(review.candidates.filter((row) => !row.comparison)).toHaveLength(
    noRow.length,
  );
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  for (const requirement of review.noticeRequirements) {
    if (requirement.book === 'PZO1110') {
      expect(requirement.holdId).toBeNull();
      continue;
    }
    expect(held.get(requirement.holdId ?? ''), requirement.book).toEqual([
      requirement.book,
      ...requirement.registryKeys.filter((key) => key !== requirement.book),
    ]);
    for (const key of requirement.candidates)
      expect(
        review.candidates.find((row) => row.externalKey === key)?.noticeHoldIds,
      ).toContain(requirement.holdId);
  }
  for (const row of review.candidates) {
    expect(row.requiredNotices.at(-1), row.name).toBe('PZO1110');
    expect(row.holdIds, row.name).toEqual(
      row.name === skillFocus
        ? []
        : [`feats-365-whole-content-${row.externalKey.split('/')[1]}`],
    );
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `feats-365-notice-${book}-complete-chain`),
    );
  }
});

it('retains recorded parser findings and checks current bounded or advisory clauses', () => {
  const kinds = (name: string) =>
    entry(name).prerequisites?.map((atom) =>
      'kind' in atom ? atom.kind : 'anyOf',
    );
  expect(kinds('Lantern Style')).toEqual(['feat', 'alignment', 'unchecked']);
  expect(kinds('Fey-Guarded')).toEqual(['anyOf']);
  expect(kinds('Elemental Focus (Mythic)')).toEqual(['feat']);
  expect(kinds('Linnorm Hunter Retreat')).toEqual([
    'ability',
    'ability',
    'feat',
    'feat',
    'bab',
    'unchecked',
  ]);
  for (const [name, gap] of [
    ['Lantern Style', 'unrelated class ability named Good'],
    ['Fey-Guarded', 'unrelated class ability named Knowledge'],
    ['Elemental Focus (Mythic)', 'kineticist Elemental Focus class feature'],
    ['Aldori Style Conquest', 'pinned Alertness feat exists'],
    ["Garen's Discipline", 'pinned Alertness feat exists'],
    ['Startoss Comet', 'pinned Weapon Focus feat exists'],
    ['No Name', 'pinned Amateur Gunslinger feat exists'],
    ['Dragon Ferocity', 'pinned Stunning Fist feat exists'],
    ['Lengthy Potion', 'pinned Brew Potion feat exists'],
    ['Linnorm Hunter Retreat', 'split at "or"'],
    ['Moonlight Stalker Master', 'split at "or"'],
    ['Accursed', 'split at "or"'],
    ['Innate Arcana', '"serpentfolk" stays unchecked'],
  ] as const)
    expect(
      recordedPrerequisiteFacts({
        batch: 'feats-365',
        candidate: candidate(name),
      }),
      name,
    ).toEqual(expect.arrayContaining([expect.stringContaining(gap)]));
  const repeatable = [
    'Natural Ruler',
    'Greater Wild Empathy',
    'Brilliant Spell Preperation',
    'Abundant Revelations',
    'Weapon Adept',
    'Extended Stare',
    'Orc Weapon Expertise',
    'Expanded Arcana',
    skillFocus,
  ];
  expect(
    review.candidates
      .filter((row) =>
        row.mechanicsReview.prerequisiteReview.repeatability.includes(
          'Special allowing multiple selections',
        ),
      )
      .map((row) => row.name)
      .sort(),
  ).toEqual(repeatable.sort());
});

it('pins all 100 complete bodies, checked bindings and literal PCGen evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toMatchObject({
    admitted: 1,
    held: 99,
    dependentlyOmitted: 0,
    excluded: 0,
    recordLevel35Holds: 0,
  });
  expect(preview.entries).toHaveLength(100);
  for (const row of review.candidates) {
    const bytes = await readPinned(row.source.repo, row.source.path);
    expect(sha(bytes), row.externalKey).toBe(row.source.sha256);
    const raw = upstreamRecord.parse(parse(bytes));
    expect(raw._id).toBe(row.externalKey.split('/')[1]);
    expect(raw.name).toBe(row.name);
    expect(raw.system).toEqual(row.sourceFields);
    expect(row.sourceFields.tags).not.toContain('3.5');
    const description = sourceDescription(raw);
    expect(sha(description)).toBe(row.descriptionSha256);
    expect(description).toBe(row.mechanicsReview.descriptionText);
    const [record, ...rest] = row.mechanicsReview.curationRecords;
    const isSkillFocus = row.name === skillFocus;
    expect(rest).toHaveLength(0);
    expect(record).toMatchObject({
      kind: 'description',
      target: 'description',
      text: description,
      textSha256: sha(description),
      status: 'checked',
      diagnostics: [],
      // #724 re-reviewed the Skill Focus records' rank Modifiers on 2026-10-14.
      reviewedBy: 'Opus (AI curator) for the owner',
      reviewedOn: isSkillFocus ? '2026-10-14' : '2026-10-13',
    });
    for (const reviewed of row.mechanicsReview.curationRecords)
      expect(
        reviewedCuration.records.find(
          (current) =>
            current.externalKey === row.externalKey &&
            current.kind === reviewed.kind &&
            current.target === reviewed.target &&
            current.textSha256 === reviewed.textSha256,
        ),
      ).toEqual(reviewed);
    expect(entry(row.name).sources).toEqual([]);
    expect(row.mechanicsReview.prerequisiteReview.normalizedAtoms).toEqual(
      entry(row.name).prerequisites ?? [],
    );
  }
  const files = new Map(
    review.comparisonSources.pcgenFiles.map((file) => [file.path, file.sha256]),
  );
  for (const [path, digest] of files) {
    const bytes = await readFile(`tests/fixtures/pinned/pcgen/${path}`);
    expect(sha(bytes), path).toBe(digest);
  }
  for (const row of review.candidates) {
    for (const comparison of [
      row.comparison,
      ...row.additionalComparisonLeads,
      ...row.rejectedRootComparisonEvidence,
      ...row.inheritedRuleComparisonEvidence,
    ]) {
      if (!comparison) continue;
      expect(files.get(comparison.path)).toBe(comparison.comparisonFileSha256);
      const lines = (
        await readFile(`tests/fixtures/pinned/pcgen/${comparison.path}`, 'utf8')
      ).split(/\r?\n/);
      expect(lines[comparison.line - 1]).toBe(comparison.literalRow);
      expect(sha(comparison.literalRow)).toBe(comparison.comparisonLineSha256);
      const { path, line, text, sha256 } = comparison.publicationAnchor;
      expect(files.get(path)).toBe(sha256);
      const publication = await readFile(
        `tests/fixtures/pinned/pcgen/${path}`,
        'utf8',
      );
      expect(publication.split(/\r?\n/)[line - 1]?.split('\t')[0]).toBe(text);
    }
  }
  // The Shocking Amplification body equals its Magic Tactics Toolbox benefit.
  expect(candidate('Shocking Amplification').comparison?.literalRow).toContain(
    'BENEFIT:Whenever you cast a spell with the electricity descriptor that targets one or more creatures, you can take a -1 penalty on attack rolls made with the spell and reduce the spell',
  );
});

it('reextracts source-bound mechanics from a clean shared fixture tree and enforces current content and notice holds', async () => {
  const tree = await materializePinnedTree(pinnedFiles, {
    sha256: pinnedSha256,
  });
  try {
    const artifact = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
      candidateKeys: review.candidates.map((row) => row.externalKey),
    });
    expect(artifact.curation.passed).toBe(true);
    expect(artifact.curation.missing).toEqual([]);
    expect(artifact.curation.stale).toEqual([]);
    expect(artifact.curation.summary).toMatchObject({
      required: 0,
      checked: 0,
      descriptions: { candidates: 100, checked: 100 },
    });
    for (const row of artifact.catalog.entries) {
      const saved = entry(row.name);
      expect({
        description: row.description,
        modifiers: row.modifiers,
        situationalNotes: row.situationalNotes,
        sources: row.sources,
      }).toEqual({
        description: saved.description,
        modifiers: saved.modifiers,
        situationalNotes: saved.situationalNotes,
        sources: saved.sources,
      });
    }
    // The reduced tree cannot reproduce every whole-corpus prerequisite
    // identity; gate the full-source snapshot after reproducing its mechanics.
    const authoritative = {
      ...artifact,
      catalog: {
        ...artifact.catalog,
        entries: preview.entries.map((row) => {
          if (row.detail.kind !== 'feat') throw new Error('Expected feat');
          return { ...row, detail: row.detail };
        }),
      },
    };
    const gate = assessCatalogAdmission({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    expect(gate.admitted.map((row) => row.name)).toEqual([skillFocus]);
    expect(gate.held).toHaveLength(99);
    expect(gate.dependentOmissions).toEqual([]);
    expect(gate.failures).toEqual([]);
    for (const row of gate.held)
      expect(row.reason, row.name).toMatch(/^feats-365-whole-content-/);
    for (const row of review.candidates) {
      const assessment = reviewedAdmission.assessments.find(
        (a) => a.externalKey === row.externalKey,
      );
      expect(assessment).toMatchObject({
        status: row.assessmentStatus,
        ...bindSnapshotToCurrentNotices(row.currentBinding),
        requiredNotices: row.requiredNotices,
      });
      expect(
        buildAssessmentBinding({
          artifact: authoritative,
          entry: entry(row.name),
          requiredNotices: row.requiredNotices,
          evidenceIds: [row.evidenceId],
          ...reviewedAdmission,
        }),
      ).toEqual(bindSnapshotToCurrentNotices(row.currentBinding));
    }
    const confirm = (...names: string[]) => {
      const keys = names.map((name) => candidate(name).externalKey);
      return assessWithUnclearedHolds({
        artifact: authoritative,
        ...reviewedAdmission,
        assessments: reviewedAdmission.assessments.map((row) =>
          keys.includes(row.externalKey)
            ? { ...row, status: 'confirmed' as const }
            : row,
        ),
      });
    };
    // A changed admitted body invalidates its binding and is no longer admitted.
    const focus = entry(skillFocus);
    const edited = assessCatalogAdmission({
      artifact: {
        ...authoritative,
        catalog: {
          ...authoritative.catalog,
          entries: authoritative.catalog.entries.map((row) =>
            row.externalKey === focus.externalKey
              ? { ...row, modifiers: row.modifiers.slice(1) }
              : row,
          ),
        },
      },
      ...reviewedAdmission,
    });
    expect(edited.admitted).toEqual([]);
    // Confirming a held body still holds it on its held notices.
    const cautious = confirm('Cautious Fighter');
    expect(cautious.admitted.map((row) => row.name)).toEqual([skillFocus]);
    expect(
      cautious.held.find((row) => row.name === 'Cautious Fighter')?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
    // A no-row body that needs only the reviewed CRB notice is kept out only
    // by its unresolved whole-content assessment; the admitted body stays.
    expect(candidate('Runic Charge').requiredNotices).toEqual(['PZO1110']);
    expect(
      confirm('Runic Charge')
        .admitted.map((row) => row.name)
        .sort(),
    ).toEqual(['Runic Charge', skillFocus].sort());
  } finally {
    await tree.dispose();
  }
});
