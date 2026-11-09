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
} from '../fixtures/traits-377/data';
import { reviewedTraitSheet } from '../fixtures/traits-377/sheet';
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
  'Liquid Healing (Rahadoum)',
  'Eastern Mysteries (Qadira Faction)',
  'Wasteland Vargrant',
  'Resourceful Scavenger (Numeria)',
  'Mummy-Touched (Osirion Faction)',
  "The Lawbringer (Tyrant's Grasp)",
  'Obari Veteran',
  'Young Reformer (War for the Crown)',
  'The Thrush',
  'Monastic',
  'Paraheen Weaponsmith (Qadira)',
  'Scourge of the Darkness',
  'Fruit Merchant (Jungle)',
  'Irreverent',
  'Spirit of the Law',
  'The Follower',
];

// Every trait whose bound content closure keeps Unchained action-cost
// metadata (owner ruling, 2026-10-17): 12 on the trait's own action, two of
// them also through a linked body, and three only through linked bodies.
const unchainedOwn = [
  'pf1-content/UlJUjIenSGO7nGta', // Pugnacious
  'pf1-content/VBx5ocBnlSPixNvg', // Eastern Mysteries
  'pf1-content/VDpNXsmkuT19FjmH', // Folgrit's Mercy (also Lay on Hands)
  'pf1-content/VYSvb2cEPyOAcbq8', // Blessing of the Feast
  'pf1-content/VfPHaAn2aJNjgCig', // Born under the Dreamer
  'pf1-content/VqMEW2pnlwaoQ5nB', // Shared Curse
  'pf1-content/WDw7fDPGSV0qszMD', // The Lawbringer
  'pf1-content/WONZK0eXLOt0M6aP', // Totemist (also Guidance)
  'pf1-content/WcpFffrOiCJaH59Z', // Young Reformer
  'pf1-content/Ws8NnpodhmiUG6K8', // Monastic
  'pf1-content/XCYnJnoPSBW6uwFv', // Creative Manipulator
  'pf1-content/Xzpzb4RB61RsPAOU', // Amoral Mercenary
];
const unchainedLinked = [
  'pf1-content/VDpNXsmkuT19FjmH', // Folgrit's Mercy: Lay on Hands
  'pf1-content/Vw1ZVONnNwzQeNDN', // Sword Scion: longsword, Aldori dueling sword
  'pf1-content/WAe75aKMcvYjCuAK', // Wasteland Hunter: its four thrown weapons
  'pf1-content/WBE6APi1AkvIX3OL', // Marid's Fury: Hydraulic Push
  'pf1-content/WONZK0eXLOt0M6aP', // Totemist: Guidance
];

it('resolves the reviewed trait Modifiers, with trait bonuses that never stack', () => {
  // Sky Quester and Azlanti Inheritor: two traits' +1 trait bonuses on
  // Knowledge (history) don't stack.
  for (const name of [
    'Sky Quester (Dwarf)',
    'Azlanti Inheritor (Human; Azlanti)',
  ] as const)
    expect(total(reviewedTraitSheet(name), 'skill.khi'), name).toBe(1);
  expect(
    total(
      reviewedTraitSheet(
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
      resolveSheet(modifiers(negotiator), { situations: [step] })[target].total,
    ).toBe(1);
    expect(
      resolveSheet(modifiers(negotiator), { situations: [step, deity] })[target]
        .total,
    ).toBe(2);
  }
  // Clever Wordplay uses the Intelligence modifier in place of the Charisma
  // modifier on the chosen skill, even when it is lower.
  const wordplay = 'Clever Wordplay';
  const bluff = indexOf(wordplay, 'skill.blf', 'Bluff');
  const swap = (scores: { intelligence: number; charisma: number }) =>
    scored(wordplay, scores, 'skill.blf', [bluff]) -
    scored(wordplay, scores, 'skill.blf');
  expect(swap({ intelligence: 16, charisma: 10 })).toBe(3);
  expect(swap({ intelligence: 8, charisma: 14 })).toBe(-3);
  expect(modifiers(wordplay)).toHaveLength(7);
  // Blessing of the Feast's natural armor bonus goes to its own AC leaf.
  const feast = 'Blessing of the Feast (Zura)';
  const fed = resolveSheet(modifiers(feast), {
    situations: [situation(feast, 0)],
  });
  expect([fed['ac.natural'].total, fed['ac.other'].total]).toEqual([1, 0]);
  expect(resolveSheet(modifiers(feast))['ac.natural'].total).toBe(0);
  // Targetless imported changes contribute nothing; reviewed Modifiers supply
  // the rule (Hwan Artist and The Thrush on the one Perform skill, the others
  // under their option's Situation).
  for (const name of ['Hwan Artist (Hwanggot)', 'The Thrush']) {
    expect(entry(name).unsupported, name).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
    );
    expect(resolveSheet(modifiers(name))['skill.prf'].total, name).toBe(1);
  }
  for (const [name, target, label, value] of [
    ['Framed (Curse of the Crimson Throne)', 'skill.spl', 'Dropout', 1],
    ['Framed (Curse of the Crimson Throne)', 'skill.blf', 'Family Honor', 1],
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
  expect([reformer['skill.dev'].total, reformer['skill.klo'].total]).toEqual([
    1, 1,
  ]);
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
  // Conditions narrower or wider than a shared Situation stay local.
  for (const [name, shared, target] of [
    ['Disillusioned', 'fear', 'save.will'],
    ['Scourge of the Darkness', 'fear', 'save.will'],
    ['Deadly Rush (Tiefling; Pitborn)', 'charging', 'attack.melee'],
  ] as const)
    expect(
      resolveSheet(modifiers(name), { situations: [shared] })[target].total,
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
    expect(new Set(modifiers(name).map((row) => row.bonusType)), name).toEqual(
      new Set(['untyped']),
    );
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
  expect(
    candidate(
      'Mathematical Prodigy',
    ).mechanicsReview.outstandingCalculations.join(' '),
  ).toContain('listed gap');
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
      if (!record.outputs.length)
        expect(record.rationale, row.name).toContain(
          'Explicit covered/no-output',
        );
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
  expect(required).toBe(79);
  // Explicit covered/no-output records: each repeats a rule another record
  // of the entry carries.
  expect(
    heldTraits.flatMap((row) =>
      row.mechanicsReview.curationRecords
        .filter((record) => !record.outputs.length)
        .map((record) => `${row.name} ${record.target}`),
    ),
  ).toEqual([
    'Strong Swimmer (Gozreh) skill.swm',
    'Dark Magic Affinity (Tiefling) spellEffect',
    'Scorned by Magic sr',
  ]);
  // Dockside Avenger's Note gives the death threshold the Foundry formula
  // computes, and Greater Link's follows its pinned Benefits text.
  expect(
    entry(
      'Dockside Avenger (Curse of the Crimson Throne)',
    ).situationalNotes?.map((note) => note.text),
  ).toEqual(
    expect.arrayContaining([
      expect.stringContaining('equal to your Constitution score + 3'),
    ]),
  );
  expect(
    candidate('Greater Link').mechanicsReview.sourceDiscrepancies[0],
  ).toContain('life link');
  // Every outstanding calculation is recorded, never as an attribution hold.
  for (const row of heldTraits)
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  expect(
    heldTraits.filter(
      (row) => !row.mechanicsReview.outstandingCalculations.length,
    ),
  ).toEqual([]);
  // No trait in this batch grants a weapon or armor proficiency.
  for (const row of heldTraits) {
    expect(entry(row.name).proficiencies ?? [], row.name).toEqual([]);
    expect(
      row.mechanicsReview.proficiencyReview.outstandingFacts,
      row.name,
    ).toEqual([]);
  }
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
      `traits-377-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `traits-377-notice-${book}-complete-chain`),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    heldTraits
      .filter((row) => row.traitType === 'drawback')
      .map((row) => row.name)
      .sort(),
  ).toEqual(['Foul Brand (Hand)', 'Vain', 'Zealous (Drawback)']);
  // Inherited rules from other books: the APG reposition and steal
  // maneuvers, eidolons, lay on hands, the climber racial trait, true names
  // (Ultimate Magic), the undine and lashunta racial abilities, the
  // skinwalker change shape, the Noble Scion feat (Inner Sea World Guide),
  // the hunter's animal focus and low-light vision, and the linked Aldori
  // dueling sword and javelin.
  for (const [name, book] of [
    ['Repulsive (Tiefling; Foulspawn)', 'PZO1115'],
    ['Holdout', 'PZO1115'],
    ['Desperate Speed', 'PZO1115'],
    ['Canopy Prowler (Catfolk)', 'PZO1121'],
    ['True Name Caller (The Abyss)', 'PZO1117'],
    ["Marid's Fury (Undine)", 'PZO9280'],
    ['Skilled Telepath (Lashunta)', 'PZO9280'],
    ['Shared Curse (Skinwalker; Werewolf-Kin)', 'PZO1133'],
    ["Chelish Noble (Hell's Vengeance)", 'PZO9226'],
    ['Aspect of the Quah', 'PZO1129'],
    ['Aspect of the Quah', 'PZO1112'],
    ['Sword Scion (Kingmaker)', 'PZO1138'],
    ['Wasteland Hunter (Human; Kellid)', 'PZO9452'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  for (const [name, path] of [
    ['Repulsive (Tiefling; Foulspawn)', 'apg_feats.lst#L114'],
    ['Holdout', 'apg_feats.lst#L118'],
    ['Desperate Speed', 'summoner.BrnHPJ2EVSQSyNQ8.yaml#L97'],
    ["Folgrit's Mercy (Folgrit)", 'paladin.ohptcds1d5oG6Bjh.yaml#L101'],
    ["Marid's Fury (Undine)", 'races/undine.iqJvhd7NbmybUl0y.yaml'],
    [
      'Skilled Telepath (Lashunta)',
      'races/lashunta-male.g9GYFtD8FOxtUGvJ.yaml',
    ],
    ["Chelish Noble (Hell's Vengeance)", 'iswg_feats.lst#L32'],
    ['Aspect of the Quah', 'hunter.Immo2BuSe5WGdRW9.yaml#L107'],
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
  expect(unchained).toHaveLength(15);
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
      'traits-377-notice-PZO1131-complete-chain',
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
    ['Planar Negotiator (The Abyss)', 'PZO9424'],
    ['Zealous (Drawback)', 'PZO9280'],
    ['Azlanti Inheritor (Human; Azlanti)', 'PZO9442'],
    ['The Thrush', 'PZO9474'],
    ['Framed (Curse of the Crimson Throne)', 'PZO9000-2S'],
    ['Unhappy Childhood (Curse of the Crimson Throne)', 'PZO9000-2S'],
  ] as const)
    expect(candidate(name).requiredNotices, name).not.toContain(book);
  // Obari Veteran cites no source and has no PCGen row: only the trait
  // framework and the core rules are identified.
  expect(candidate('Obari Veteran').citedSources).toEqual([]);
  expect(candidate('Obari Veteran').requiredNotices).toEqual([
    'PZO1115',
    'PZO1110',
  ]);
  expect(
    heldTraits
      .flatMap((row) => row.linkedContentReview.map((linked) => linked.name))
      .sort(),
  ).toEqual([
    'Aldori Dueling Sword',
    'Climber',
    'Club',
    'Guidance',
    'Hydraulic Push',
    'Javelin',
    'Lay on Hands',
    'Longsword',
    'Mounted Combat',
    'Shortspear',
    'Spear',
  ]);
  // The closures also reach Sprinter (Catfolk), through Climber.
  expect(preview.closure.map((row) => row.externalKey).sort()).toEqual([
    'pf1-content/gpZx2FQSEHME0jzh',
    'pf1-content/qBIFC8W3VkEuxpls',
    'pf1/0spsP9ylE3goD3jc',
    'pf1/KmbhZ4Z674Yk9yIh',
    'pf1/N37FFAdWjVV6EolR',
    'pf1/WhE4j0Jc82npdMCP',
    'pf1/ioPvNyyv6L4hv0aW',
    'pf1/o8ds5jtvf0hf92dw',
    'pf1/ohy0ty2dawfaaqwd',
    'pf1/s0LFk8Jk5CsgOj7V',
    'pf1/vu3N4zCRDTUJ5FW4',
    'pf1/zWRlna42PMJVX6un',
  ]);
  for (const name of noRow) {
    expect(candidate(name).comparison, name).toBeNull();
    expect(candidate(name).additionalComparisonLeads, name).toEqual([]);
    expect(candidate(name).inheritedRuleUnresolvedOrigins[0], name).toContain(
      'no PCGen row at the pin',
    );
  }
  // Framed and Unhappy Childhood have only the 2008 player's guide rows, a
  // printing the pinned record doesn't cite.
  for (const name of [
    'Framed (Curse of the Crimson Throne)',
    'Unhappy Childhood (Curse of the Crimson Throne)',
  ]) {
    expect(candidate(name).comparison, name).toBeNull();
    expect(
      candidate(name).additionalComparisonLeads.map((row) => row.book),
      name,
    ).toEqual(['PZO9000-2S', 'PZO9000-2S']);
  }
  expect(heldTraits.filter((row) => !row.comparison)).toHaveLength(
    noRow.length + 2,
  );
  for (const [name, origin] of [
    ['Born Damned (Tiefling)', 'curse descriptor'],
    ['Disillusioned', 'emotion descriptor'],
  ] as const)
    expect(candidate(name).inheritedRuleUnresolvedOrigins, name).toEqual([
      expect.stringContaining(origin),
    ]);
  expect(
    candidate('Mummy-Touched (Osirion Faction)').inheritedRuleUnresolvedOrigins,
  ).toEqual([
    expect.stringContaining('no PCGen row at the pin'),
    expect.stringContaining('curse descriptor'),
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
      batch: 'traits-377',
      candidate: candidate(name),
    });
  // Two races read as both required, four deities read as all required, a
  // prose Requirements line read as requirements, an unresolved class and
  // race name (#739).
  for (const [name, mapped] of [
    ['Deadeye (Half-Orc, Orc)', ['anyOf']],
    ['Battlefield Caster (Angradd, Gorum, Torag, Trudd)', ['unchecked']],
    ["Chelish Noble (Hell's Vengeance)", ['unchecked', 'unchecked']],
    [
      'Honored Fist of the Society (Monk, Pathfinder Society)',
      ['unchecked', 'unchecked'],
    ],
    ['Skilled Telepath (Lashunta)', ['unchecked']],
    ['Rider of Paresh (Qadira)', ['unchecked']],
  ] as const) {
    expect(kinds(name), name).toEqual(mapped);
    expect(facts(name), name).toEqual(
      expect.arrayContaining([expect.stringContaining('#739')]),
    );
  }
  // A requirement on the line after its label, without a colon, maps
  // nothing (#739).
  expect(kinds('Azlanti Inheritor (Human; Azlanti)')).toBeUndefined();
  expect(facts('Azlanti Inheritor (Human; Azlanti)')).toEqual([
    expect.stringContaining('#739'),
  ]);
  expect(kinds('Sky Quester (Dwarf)')).toEqual(['race']);
  expect(kinds("Amoral Mercenary (Hell's Vengeance)")).toEqual(['alignment']);
  for (const [name, gap] of [
    ['Eastern Mysteries (Qadira Faction)', 'no faction fact exists'],
    ['Repulsive (Tiefling; Foulspawn)', 'no heritage or ethnicity fact exists'],
    ['Iron Grip (Gorum)', 'no deity fact exists'],
    ['Fangwood Diplomat (Nirmathas)', 'no region fact exists'],
    ['The Thrush', 'no birth-date fact exists'],
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
    held: 99,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 1,
    recordLevel35Holds: 0,
  });
  // Family is a Foundry folder record, excluded under the importer contract.
  expect(folders.map((row) => [row.externalKey, row.name, row.rawKey])).toEqual(
    [['pf1-content/VYAE9lKSB1c1VMNw', 'Family', '!folders!VYAE9lKSB1c1VMNw']],
  );
  expect(folders[0]?.contractReason).toContain('!folders!');
  expect(preview.entries).toHaveLength(99);
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
  // Sky Quester's imported changes equal its Inner Sea Races row's bonus.
  expect(candidate('Sky Quester (Dwarf)').comparison?.literalRow).toContain(
    'BONUS:SKILL|Knowledge (Geography),Knowledge (History)|1|TYPE=Trait',
  );
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
      required: 79,
      checked: 79,
      missing: 0,
      descriptions: { candidates: 99, checked: 99 },
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
    expect(held).toHaveLength(99);
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
    const faith = candidate('Sky Quester (Dwarf)');
    expect(faith.requiredNotices).toEqual(['PZO9280', 'PZO1115', 'PZO1110']);
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
