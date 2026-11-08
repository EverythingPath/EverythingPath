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
  abilityTargets,
  modifierTargets,
  resolveSheet,
  calculateCharacterSheetProjections,
} from '../../src/lib/character-sheet';
import {
  review,
  heldTraits,
  folders,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/traits-378/data';
import { reviewedTraitSheet } from '../fixtures/traits-378/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const PLACEHOLDER =
  'Review required: replace this placeholder with readable rules text or structured outputs.';
const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
function entry(name: string) {
  const row = preview.entries.find((row) => row.name === name);
  if (!row) throw new Error(`Missing ${name}`);
  if (row.detail.kind !== 'trait') throw new Error('Expected trait');
  return { ...row, detail: row.detail };
}
function candidate(name: string) {
  const row = heldTraits.find((row) => row.name === name);
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
// The Situation of one Modifier, selected on its sheet entry.
function situation(
  name: string,
  index: number,
  sheetEntryId = entry(name).externalKey,
) {
  const scope = modifiers(name)[index]?.condition?.situation;
  if (!scope) throw new Error(`Modifier ${index} of ${name} has no Situation`);
  if (typeof scope === 'string') return scope;
  if (!('local' in scope)) throw new Error('Expected a local Situation');
  return { local: scope.local, sheetEntryId };
}
function indexOf(name: string, target: string, label: string) {
  const index = modifiers(name).findIndex(
    (row) =>
      row.target === target &&
      JSON.stringify(row.condition?.situation ?? '').includes(label),
  );
  if (index < 0) throw new Error(`No ${target} Modifier "${label}" on ${name}`);
  return index;
}
const total = (sheet: ReturnType<typeof reviewedTraitSheet>, target: string) =>
  calculateCharacterSheetProjections(sheet).current.breakdowns[
    target as 'skill.per'
  ].total;

// The sheet with one or more reviewed traits and set ability scores, with
// Situations selected on the first trait's sheet entry.
function scored(
  name: Parameters<typeof reviewedTraitSheet>[0],
  scores: Partial<Record<keyof typeof abilityTargets, number>>,
  target: string,
  situations: number[] = [],
) {
  const sheet = reviewedTraitSheet(name);
  const base = sheet.catalogEntries[0]!;
  base.modifiers = (base.modifiers ?? []).map((row) => {
    const hit = Object.entries(scores).find(
      ([ability]) =>
        abilityTargets[ability as keyof typeof abilityTargets] === row.target,
    );
    return hit ? { ...row, value: hit[1] } : row;
  });
  return calculateCharacterSheetProjections(sheet, {
    situations: situations.map((index) =>
      situation(name, index, 'trait-row-0'),
    ),
  }).current.breakdowns[target as 'skill.per'].total;
}

// Traits with no PCGen row at the pin, including alternate spellings.
const noRow = [
  'Beachcomber (Coastal or River)',
  'Guerrilla Tactics',
  'Beneficent Touch (Silver Crusade)',
  'Pyromancer (Aasimar; Emberkin)',
  'Canon of Coin',
  "Devil's Mark (Dark Archive)",
  'Arcane Researcher',
  'The Lantern Bearer',
  'Internal Compass',
];

// Every trait whose bound content closure keeps Unchained action-cost
// metadata (owner ruling, 2026-10-17): 19 on the trait's own action, two of
// them also through a linked body, and two only through linked bodies.
const unchainedOwn = [
  'pf1-content/Y1T1vAuuUgCKneHS', // Zealous (Human; Garundi)
  'pf1-content/YH9NriEeQiHKTPri', // Beachcomber
  'pf1-content/YMJT6Hu1yAJCNYuc', // Shaper of Reality
  'pf1-content/Ya3C6gkoxRhJl75B', // Animal Rustler
  'pf1-content/YhZuLdovj12d0JoX', // Self-Sacrifice
  'pf1-content/Yyc3F8awZSrjjcBd', // Arcane Prodigy
  'pf1-content/Z8YfXbA0e9W2iODL', // Jinx Eater
  'pf1-content/ZMxoJ7kgoEB7H2vw', // Beneficent Touch
  'pf1-content/ZQwI6stKulwOuxw6', // Obsessed with Success
  'pf1-content/ZWotsybnKFA4uSXp', // Tempestuous Combatant
  'pf1-content/ZkBWc1XaWl2VpV0B', // Scourge of the Seas
  'pf1-content/ZkmQ9OBNeWLFHLNA', // Folgrit's Bounty
  'pf1-content/ZvPhiAj6xpVaMQZh', // Sensitive Mind
  'pf1-content/a5EwgqcBk4DEZohY', // Chaldira's Luck
  'pf1-content/aPm692dsgpp0h4JV', // Akitonian Ferocity
  'pf1-content/aYsgfeiqXDhDuE35', // Snap Ignition (also Tindertwig)
  'pf1-content/abTQ1IfB8nzTO0L2', // The Lantern Bearer (also Light)
  'pf1-content/aiCMy7zUX7enO10K', // Terrifying Lunge
  'pf1-content/astLabxcMDYe1OM6', // Chelish Sympathizer
];
const unchainedLinked = [
  'pf1-content/ZsMKaCYQGZjAHWXi', // Eye for the Wondrous: Detect Magic
  'pf1-content/aAOSnHXE8AcA2dyc', // Dispelled Battler: Antimagic Field, Dispel Magic
  'pf1-content/aYsgfeiqXDhDuE35', // Snap Ignition: Tindertwig
  'pf1-content/abTQ1IfB8nzTO0L2', // The Lantern Bearer: Light
];

it('resolves the reviewed trait Modifiers, with trait bonuses that never stack', () => {
  // Poverty-Stricken and Deep Marker: two traits' +1 trait bonuses on
  // Survival don't stack.
  for (const name of ['Poverty-Stricken', 'Deep Marker (Dwarf)'] as const)
    expect(total(reviewedTraitSheet(name), 'skill.sur'), name).toBe(1);
  expect(
    total(
      reviewedTraitSheet('Poverty-Stricken', 'Deep Marker (Dwarf)'),
      'skill.sur',
    ),
  ).toBe(1);
  // Ability-modifier formulas: Animal Rustler adds the Strength modifier on
  // one Handle Animal check, The Flexing Arm uses Strength in place of
  // Dexterity to escape bonds, Brevoy Bandit adds the chosen ability's
  // modifier on Profession.
  const rustler = 'Animal Rustler (Orc)';
  const handle = (strength: number) =>
    scored(rustler, { strength }, 'skill.han', [0]) -
    scored(rustler, { strength }, 'skill.han');
  expect(handle(16)).toBe(3);
  expect(handle(8)).toBe(-1);
  const arm = 'The Flexing Arm (Kurgess)';
  const bonds = indexOf(arm, 'skill.esc', 'bondage"');
  const strength = indexOf(arm, 'skill.esc', 'Strength instead');
  expect(
    scored(arm, { strength: 16, dexterity: 10 }, 'skill.esc', [bonds]) -
      scored(arm, { strength: 16, dexterity: 10 }, 'skill.esc'),
  ).toBe(1);
  expect(
    scored(arm, { strength: 16, dexterity: 10 }, 'skill.esc', [
      bonds,
      strength,
    ]) - scored(arm, { strength: 16, dexterity: 10 }, 'skill.esc'),
  ).toBe(4);
  const bandit = 'Brevoy Bandit (Mivon)';
  expect(modifiers(bandit)).toHaveLength(5);
  const charisma = indexOf(bandit, 'skill.pro', 'Charisma');
  expect(
    scored(bandit, { charisma: 14 }, 'skill.pro', [charisma]) -
      scored(bandit, { charisma: 14 }, 'skill.pro'),
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
    expect(resolveSheet(modifiers(name)).concentration.total, name).toBe(value);
  }
  expect(
    total(
      reviewedTraitSheet('Abendego Spellpiercer (the Sodden Lands)'),
      'concentration',
    ),
  ).toBe(2);
  // Targetless imported changes contribute nothing; reviewed Modifiers supply
  // the rule under their option's Situation.
  for (const [name, target, label, value] of [
    ['Tattooed Focus (Human; Varisian)', 'skill.pro', 'Profession', 2],
    ["Teacher's Pet (Carrion Crown)", 'skill.kre', 'Knowledge (religion)', 2],
    ['Shoanti Tribesman (Varisia)', 'skill.swm', 'Swim', 1],
    ['Love Lost (Curse of the Crimson Throne)', 'skill.int', 'All Alone', 1],
    ['Love Lost (Curse of the Crimson Throne)', 'skill.sur', 'Orphaned', 1],
    ['Business Venturer (Ratfolk)', 'skill.pro', 'merchant', 1],
    ['Brewmaster (Dwarf)', 'skill.pro', 'brewer', 1],
    ['Brewmaster (Dwarf)', 'skill.crf', 'alchemy', 1],
    ["Folgrit's Bounty (Folgrit)", 'skill.pro', 'cook', 1],
    ['Methodical Mind (Strange Aeons)', 'skill.kar', 'Knowledge (arcana)', 1],
  ] as const) {
    expect(entry(name).unsupported, name).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
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
        situations: [situation(health, indexOf(health, 'save.fort', label))],
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
      resolveSheet(modifiers(name), { situations: [base, more] })[target].total,
      name,
    ).toBe(2);
  }
  // Shared Situations where the body's condition matches exactly.
  const forests = resolveSheet(modifiers('Guerrilla Tactics'), {
    situations: ['forests'],
  });
  expect([forests.init.total, forests['skill.ste'].total]).toEqual([2, 2]);
  expect(resolveSheet(modifiers('Guerrilla Tactics')).init.total).toBe(0);
  for (const [name, shared, target, value] of [
    ['Deep Marker (Dwarf)', 'fear', 'save.ref', 1],
    ["Wati Native (Mummy's Mask)", 'fear', 'save.will', 2],
    ['Infernal Influence (Human)', 'poison', 'save.fort', 1],
    ['Infernal Influence (Human)', 'poison', 'save.ref', 0],
    ['Seer of Reality (Irori)', 'illusions', 'save.will', 2],
  ] as const)
    expect(
      resolveSheet(modifiers(name), { situations: [shared] })[target].total,
      `${name} ${target}`,
    ).toBe(value);
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
      resolveSheet(modifiers(name), { situations: [shared] })[target].total,
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
      situations: [situation(anatomist, indexOf(anatomist, 'skill.kar', ''))],
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
    expect(new Set(modifiers(name).map((row) => row.bonusType)), name).toEqual(
      new Set(['untyped']),
    );
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
  expect(
    candidate('Poverty-Stricken').mechanicsReview.outstandingCalculations.join(
      ' ',
    ),
  ).toContain('listed gap');
  // Expert Swimmer keeps the body's +1, not PCGen's encoded +2.
  expect(
    resolveSheet(modifiers('Expert Swimmer (River Kingdoms)'))['skill.swm']
      .total,
  ).toBe(1);
  // Trait bonuses to AC are on the other AC leaf, under their Situations.
  for (const name of ['Tough Skin (Tiefling; Beastbrood)', 'Fey Protection']) {
    const index = indexOf(name, 'ac', '');
    expect(
      resolveSheet(modifiers(name), {
        situations: [situation(name, index)],
      })['ac.other'].total,
      name,
    ).toBe(1);
  }
  // No reviewed armor, shield or natural armor bonus lands on ac.other (#734).
  for (const row of preview.entries)
    for (const modifier of row.modifiers)
      if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
        expect(modifier.target, row.name).not.toBe('ac.other');
});

it('checks every required note record and the separate description pass against the pinned bodies', () => {
  let required = 0;
  for (const row of heldTraits) {
    const [description, ...notes] = row.mechanicsReview.curationRecords;
    const contextNotes = row.sourceFields.contextNotes as
      | { target: string; text: string }[]
      | undefined;
    expect(
      new Set(notes.map((note) => `${note.target} ${note.textSha256}`)),
      row.name,
    ).toEqual(
      new Set(
        (contextNotes ?? []).map((note) => `${note.target} ${sha(note.text)}`),
      ),
    );
    required += notes.length;
    for (const record of row.mechanicsReview.curationRecords) {
      expect(record.status, row.name).toBe('checked');
      expect(record.diagnostics, row.name).toEqual([]);
      expect(JSON.stringify(record.outputs), row.name).not.toContain(
        PLACEHOLDER,
      );
      expect(
        record.outputs.length,
        `${row.name} ${record.target}`,
      ).toBeGreaterThan(0);
    }
    expect(description).toMatchObject({
      kind: 'description',
      text: row.mechanicsReview.descriptionText,
    });
    const parts = description!.outputs.flatMap((output) =>
      output.kind === 'note' ? [output.text] : [],
    );
    for (const part of parts) {
      expect(part.length, row.name).toBeLessThanOrEqual(4096);
      expect(part, row.name).not.toContain('@UUID');
      expect(part, row.name).not.toContain('[[');
    }
    const texts = (entry(row.name).situationalNotes ?? []).map(
      (note) => note.text,
    );
    for (const part of parts) expect(texts, row.name).toContain(part);
    for (const note of entry(row.name).situationalNotes ?? []) {
      expect(note.text, row.name).not.toContain('@UUID');
      expect(note.text, row.name).not.toContain('[[');
    }
  }
  expect(required).toBe(99);
  // Spell damage has no sheet target: the Foundry spell-effect notes become
  // entry-level Notes, not spell DC Modifiers.
  for (const name of [
    'Nexian Corpse Hunter (Nex)',
    'Pyromancer (Aasimar; Emberkin)',
  ]) {
    expect(modifiers(name), name).toEqual([]);
    expect(
      entry(name).situationalNotes?.filter(
        (note) => !note.target && note.text.includes('damage rolls'),
      ).length,
      name,
    ).toBeGreaterThanOrEqual(2);
  }
  // Every outstanding calculation is recorded, never as an attribution hold.
  for (const row of heldTraits)
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  expect(
    heldTraits.filter(
      (row) => !row.mechanicsReview.outstandingCalculations.length,
    ),
  ).toEqual([]);
  // No trait maps a proficiency; the two bodies that name one keep it as an
  // outstanding fact.
  for (const row of heldTraits)
    expect(entry(row.name).proficiencies ?? [], row.name).toEqual([]);
  expect(
    heldTraits
      .filter(
        (row) => row.mechanicsReview.proficiencyReview.outstandingFacts.length,
      )
      .map((row) => row.name),
  ).toEqual(['Caravan Drover (Half-Orc)', 'Heirloom Weapon']);
});

it('records the trait framework, inherited rules, linked bodies and enforced notice holds without inventing attribution', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  for (const row of heldTraits) {
    expect(row.requiredNotices, row.name).toContain('PZO1115');
    expect(row.requiredNotices.at(-1), row.name).toBe('PZO1110');
    const [framework, drawback] = row.inheritedRuleComparisonEvidence;
    expect(framework, row.name).toMatchObject({
      line: 18,
      book: 'PZO1115',
      appliesToRootBody: false,
    });
    expect(framework?.literalRow, row.name).toContain(
      'BONUS:SAVE|Reflex|1|TYPE=Trait',
    );
    if (row.traitType === 'drawback') {
      expect(row.requiredNotices, row.name).toContain('PZO1125');
      expect(drawback?.literalRow, row.name).toMatch(
        /^ABILITYCATEGORY:Drawbacks\t/,
      );
    }
    for (const cited of row.citedSources)
      expect(row.requiredNotices, row.name).toContain(cited.book);
    for (const linked of row.linkedContentReview)
      for (const book of linked.sources)
        expect(row.requiredNotices, row.name).toContain(book.id);
    expect(row.holdIds, row.name).toEqual([
      `traits-378-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `traits-378-notice-${book}-complete-chain`),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    heldTraits
      .filter((row) => row.traitType === 'drawback')
      .map((row) => row.name)
      .sort(),
  ).toEqual(['Condescending', 'Oppressive Expectations']);
  // Inherited rules from other books: witch (APG) and shaman (ACG) hexes,
  // gunslinger grit (UC) and swashbuckler panache (ACG), the inquisitor's
  // judgment (APG), forbid action (Ultimate Magic), haunts (GameMastery
  // Guide), psychometry (Occult Adventures), research rules and verbal duels
  // (Ultimate Intrigue), the linked tindertwig (Ultimate Equipment),
  // Magnimar's monument boons and the drow spell-like abilities.
  for (const [name, book] of [
    ['Jinx Eater (Tengu; Shackles)', 'PZO1115'],
    ['Jinx Eater (Tengu; Shackles)', 'PZO1129'],
    ['Scourge of the Seas (The Shackles)', 'PZO1118'],
    ['Scourge of the Seas (The Shackles)', 'PZO1129'],
    ['Zealous Striker', 'PZO1115'],
    ["Oathkeeper's Vow (Kols)", 'PZO1117'],
    ['Spiritual Attachment', 'PZO1114'],
    ['Sensitive Mind (Strange Aeons)', 'PZO1132'],
    ['Methodical Mind (Strange Aeons)', 'PZO1134'],
    ['Chelish Sympathizer', 'PZO1134'],
    ['Snap Ignition (Ifrit)', 'PZO1123'],
    ['Monument Scholar (Shattered Star)', 'PZO9248'],
    ['Arcane Prodigy (Drow)', 'PZO9280'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  for (const [name, path] of [
    ['Jinx Eater (Tengu; Shackles)', 'witch.RC4D4WFT5kRKkdqp.yaml#L73'],
    ['Jinx Eater (Tengu; Shackles)', 'shaman.jMi3GBtvdG0WhH8L.yaml#L85'],
    [
      'Scourge of the Seas (The Shackles)',
      'gunslinger.jOUMbWoFZHQlAMpJ.yaml#L113',
    ],
    [
      'Scourge of the Seas (The Shackles)',
      'swashbuckler.Q3rbWILULpQfpjjZ.yaml#L119',
    ],
    ['Zealous Striker', 'inquisitor.Fv3FbmXptuDRiL5y.yaml#L115'],
    ["Oathkeeper's Vow (Kols)", 'spells/forbid-action.mmdypasgl5us00wb.yaml'],
    ['Spiritual Attachment', 'acg_spells.lst#L112'],
    ['Sensitive Mind (Strange Aeons)', 'skills.x175kVqUfLGPt8tC.yaml#L162'],
    ['Monument Scholar (Shattered Star)', 'vbol_abilities.lst#L114'],
    ['Arcane Prodigy (Drow)', 'races/drow.yLaDS5HGbwtgpkbP.yaml'],
  ] as const)
    expect(
      candidate(name).inheritedRuleNotices.some((notice) =>
        notice.location.endsWith(path),
      ),
      `${name} ${path}`,
    ).toBe(true);
  // Unchained action-cost metadata anywhere in the bound closure, the
  // trait's own actions included, requires the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedLinked])].sort();
  expect(unchained).toHaveLength(21);
  expect(
    heldTraits
      .filter((row) => row.requiredNotices.includes('PZO1131'))
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(unchained);
  const bodies = new Map(
    [...preview.entries, ...preview.closure].map((row) => [
      row.externalKey,
      row,
    ]),
  );
  for (const key of unchained) {
    const row = heldTraits.find((row) => row.externalKey === key)!;
    expect(row.noticeHoldIds, row.name).toContain(
      'traits-378-notice-PZO1131-complete-chain',
    );
    const rules = row.inheritedRuleNotices
      .filter((notice) => notice.book === 'PZO1131')
      .map((notice) => notice.rule);
    if (unchainedOwn.includes(key))
      expect(rules, row.name).toEqual(
        expect.arrayContaining([expect.stringContaining("trait's own action")]),
      );
    if (unchainedLinked.includes(key)) {
      expect(rules, row.name).toEqual(
        expect.arrayContaining([expect.stringContaining('on the bound')]),
      );
      for (const linked of row.linkedContentReview)
        expect(bodies.has(linked.externalKey), linked.name).toBe(true);
    }
    // The metadata is literally in the trait's own record or a bound body.
    const own =
      (
        row.sourceFields.actions as
          | { activation?: { unchained?: unknown } }[]
          | undefined
      )?.some((action) => action.activation?.unchained) ?? false;
    expect(own, row.name).toBe(unchainedOwn.includes(key));
  }
  for (const row of heldTraits.filter(
    (row) => !unchained.includes(row.externalKey),
  ))
    expect(
      (
        row.sourceFields.actions as
          | { activation?: { unchained?: unknown } }[]
          | undefined
      )?.some((action) => action.activation?.unchained) ?? false,
      row.name,
    ).toBe(false);
  // Same-name traits of other books and printings the pinned body does not
  // cite are not required.
  for (const [name, book] of [
    ['Zealous (Human; Garundi)', 'PZO1125'],
    ['Love Lost (Curse of the Crimson Throne)', 'PZO9000-2S'],
    ["Wati Native (Mummy's Mask)", 'PZO9441'],
    ['Emissary (Varisia; Kaer Maga)', 'PZO1121'],
    ['The Lantern Bearer', 'PZO9474'],
    ['Spiritual Attachment', 'PZO1132'],
  ] as const)
    expect(candidate(name).requiredNotices, name).not.toContain(book);
  // Jinx Eater cites no source: its book comes from its Blood of the Beast
  // PCGen row.
  expect(candidate('Jinx Eater (Tengu; Shackles)').citedSources).toEqual([]);
  expect(candidate('Jinx Eater (Tengu; Shackles)').requiredNotices).toEqual([
    'PZO9473',
    'PZO1115',
    'PZO1129',
    'PZO1131',
    'PZO1110',
  ]);
  expect(
    heldTraits
      .flatMap((row) => row.linkedContentReview.map((linked) => linked.name))
      .sort(),
  ).toEqual([
    'Antimagic Field',
    'Detect Magic',
    'Dispel Magic',
    'Extend Spell',
    'Light',
    'Tindertwig',
  ]);
  expect(preview.closure.map((row) => row.externalKey).sort()).toEqual([
    'pf1/btXWioB3SKJv8YEG',
    'pf1/gmgwyjfpeuuc4t4o',
    'pf1/ip9onjfp6nf1vlv9',
    'pf1/niqxt53lhxrjfaty',
    'pf1/tdocjgyuereurcno',
    'pf1/uqh87jz757r2cb7r',
  ]);
  for (const name of noRow) {
    expect(candidate(name).comparison, name).toBeNull();
    expect(candidate(name).additionalComparisonLeads, name).toEqual([]);
    expect(candidate(name).inheritedRuleUnresolvedOrigins[0], name).toContain(
      'no PCGen row at the pin',
    );
  }
  // Love Lost has only the 2008 player's guide rows, a printing the pinned
  // record doesn't cite.
  const love = candidate('Love Lost (Curse of the Crimson Throne)');
  expect(love.comparison).toBeNull();
  expect(love.additionalComparisonLeads.map((row) => row.book)).toEqual([
    'PZO9000-2S',
    'PZO9000-2S',
  ]);
  expect(heldTraits.filter((row) => !row.comparison)).toHaveLength(
    noRow.length + 1,
  );
  for (const [name, origin] of [
    ['Jinx Eater (Tengu; Shackles)', 'curse descriptor'],
    ['Low Blow', 'pain descriptor'],
    ['Principled', 'emotion descriptor'],
  ] as const)
    expect(candidate(name).inheritedRuleUnresolvedOrigins, name).toEqual([
      expect.stringContaining(origin),
    ]);
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
        heldTraits.find((row) => row.externalKey === key)?.noticeHoldIds,
      ).toContain(requirement.holdId);
  }
});

it('records prerequisite mapper findings against the actual mapped atoms', () => {
  const kinds = (name: string) =>
    entry(name).prerequisites?.map((atom) =>
      'kind' in atom ? atom.kind : 'anyOf',
    );
  const facts = (name: string) =>
    recordedPrerequisiteFacts({
      batch: 'traits-378',
      candidate: candidate(name),
    });
  // Keep the unresolved alchemist-and-region qualification together.
  const surgeon = 'Skilled Surgeon (Qadira, Ustalav; Alchemist)';
  expect(kinds(surgeon)).toEqual(['unchecked']);
  expect(facts(surgeon)).toEqual([expect.stringContaining('#739')]);
  expect(kinds('Beachcomber (Coastal or River)')).toEqual(['unchecked']);
  expect(kinds('Self-Sacrifice (Shelyn; Halfling)')).toEqual([
    'unchecked',
    'race',
  ]);
  expect(kinds('Spell Intuition')).toBeUndefined();
  for (const [name, gap] of [
    ['Beneficent Touch (Silver Crusade)', 'no faction fact exists'],
    ['Zealous (Human; Garundi)', 'no heritage or ethnicity fact exists'],
    ["Oathkeeper's Vow (Kols)", 'no deity fact exists'],
    ['Nexian Corpse Hunter (Nex)', 'no region fact exists'],
    ['The Lantern Bearer', 'no birth-date fact exists'],
    ['Cunning Breed (Taldor Jennet)', 'no mount fact exists'],
  ] as const)
    expect(facts(name), name).toEqual(
      expect.arrayContaining([expect.stringContaining(gap)]),
    );
  for (const row of heldTraits)
    expect(row.mechanicsReview.prerequisiteReview.normalizedAtoms).toEqual(
      entry(row.name).prerequisites ?? [],
    );
});
it('pins all 100 keys, the complete bodies, checked bindings and literal PCGen evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toEqual({
    total: 100,
    admitted: 0,
    held: 100,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 0,
    recordLevel35Holds: 0,
  });
  // The batch has no folder record.
  expect(folders).toEqual([]);
  expect(preview.entries).toHaveLength(100);
  for (const row of review.candidates) {
    const bytes = await readPinned(row.source.repo, row.source.path);
    expect(sha(bytes), row.externalKey).toBe(row.source.sha256);
    const raw = upstreamRecord.parse(parse(bytes));
    expect(raw._id).toBe(row.externalKey.split('/')[1]);
    expect(raw.name).toBe(row.name);
    if (row.disposition === 'excluded') continue;
    expect(raw.system).toEqual(row.sourceFields);
    expect(row.sourceFields.tags ?? []).not.toContain('3.5');
    const description = sourceDescription(raw);
    expect(sha(description)).toBe(row.descriptionSha256);
    expect(description).toBe(row.mechanicsReview.descriptionText);
    for (const reviewed of row.mechanicsReview.curationRecords) {
      expect(reviewed).toMatchObject({
        status: 'checked',
        reviewedBy: 'Opus (AI curator) for the owner',
        reviewedOn: '2026-10-18',
      });
      expect(sha(reviewed.text)).toBe(reviewed.textSha256);
      expect(
        reviewedCuration.records.find(
          (current) =>
            current.externalKey === row.externalKey &&
            current.kind === reviewed.kind &&
            current.target === reviewed.target &&
            current.textSha256 === reviewed.textSha256,
        ),
      ).toEqual(reviewed);
    }
    expect(entry(row.name).sources).toEqual(row.citedSources);
    expect(entry(row.name).detail.traitType).toBe(row.traitType);
  }
  for (const row of heldTraits)
    for (const linked of row.linkedContentReview)
      expect(sha(await readPinned(linked.repo, linked.path)), linked.name).toBe(
        linked.sha256,
      );
  const files = new Map(
    review.comparisonSources.pcgenFiles.map((file) => [file.path, file.sha256]),
  );
  for (const [path, digest] of files) {
    const bytes = await readFile(`tests/fixtures/pinned/pcgen/${path}`);
    expect(sha(bytes), path).toBe(digest);
  }
  for (const row of heldTraits) {
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
  // Elven Reflexes's imported change equals its Advanced Player's Guide
  // row's bonus.
  expect(
    candidate('Elven Reflexes (Half-Elf)').comparison?.literalRow,
  ).toContain('BONUS:COMBAT|INITIATIVE|2|TYPE=Trait');
});

it('reextracts the reviewed mechanics from a clean shared fixture tree and keeps every trait held on its own holds', async () => {
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
      required: 99,
      checked: 99,
      missing: 0,
      descriptions: { candidates: 100, checked: 100 },
    });
    expect(
      artifact.catalog.entries.map((row) => row.externalKey).sort(),
    ).toEqual(heldTraits.map((row) => row.externalKey).sort());
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
    // The assessments are bound against the full-corpus content closure: the
    // committed entries and the linked bodies in their closures.
    const authoritative = {
      ...artifact,
      catalog: {
        ...artifact.catalog,
        entries: [
          ...preview.entries,
          ...preview.closure,
        ] as unknown as typeof artifact.catalog.entries,
      },
    };
    const ours = new Set(heldTraits.map((row) => row.externalKey));
    const gate = assessCatalogAdmission({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    expect(gate.admitted.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    // Every link resolves in the full-corpus closure, so no trait fails.
    expect(gate.failures.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    const held = gate.held.filter((row) => ours.has(row.externalKey));
    expect(held).toHaveLength(100);
    for (const row of held)
      expect(row.reason, row.name).toBe(candidate(row.name).rationale);
    for (const row of heldTraits) {
      const assessment = reviewedAdmission.assessments.find(
        (a) => a.externalKey === row.externalKey,
      );
      expect(assessment).toMatchObject({
        status: 'unresolved',
        ...bindSnapshotToCurrentNotices(row.currentBinding),
        requiredNotices: row.requiredNotices,
      });
      expect(
        buildAssessmentBinding({
          artifact: authoritative,
          entry: authoritative.catalog.entries.find(
            (candidate) => candidate.externalKey === row.externalKey,
          )!,
          requiredNotices: row.requiredNotices,
          evidenceIds: [row.evidenceId],
          ...reviewedAdmission,
        }),
      ).toEqual(bindSnapshotToCurrentNotices(row.currentBinding));
    }
    // Confirming a trait's whole content still holds it on its held notices:
    // every trait requires the held APG trait framework notice.
    const faith = candidate('Spell Intuition');
    expect(faith.requiredNotices).toEqual(['PZO9433', 'PZO1115', 'PZO1110']);
    // With its PCGen-confirmed books reviewed (2026-10-31), only the notice
    // holds the owner's clearance clears still hold it, so this runs uncleared.
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === faith.externalKey
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(
      confirmed.admitted.some((row) => row.externalKey === faith.externalKey),
    ).toBe(false);
    expect(
      confirmed.held.find((row) => row.externalKey === faith.externalKey)
        ?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});
