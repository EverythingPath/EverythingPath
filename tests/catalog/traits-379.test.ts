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
  heldTraits,
  folders,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/traits-379/data';
import { reviewedTraitSheet } from '../fixtures/traits-379/sheet';
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

// Traits with no PCGen row at the pin, including alternate spellings.
// Calistrian Courtesan's only row is a commented-out Ultimate Campaign row.
const noRow = [
  'Calistrian Courtesan (Calistria)',
  'Planar Wayfarer (Onos)',
  'Ancestral Grounds (Dwarf)',
  "The Pessimist (Tyrant's Grasp)",
  'Dervish (Qadira Faction)',
  'Darkblight Survivor (Nirmathas)',
  'Mindspin Mountain Goat (Ram)',
  'Solitary',
  "Rousing Oratory (Liberty's Edge)",
  'Natural Flyer',
  'Greasy Palm (The Exchange)',
  'The Pack',
  'Bound by Honor',
  'Self-Aware (Vampire; Vetala)',
  'The Stranger',
  'Close Allies (Return of the Runelords)',
];

// Every trait whose bound content closure keeps Unchained action-cost
// metadata (owner ruling, 2026-10-17): 17 on the trait's own action, two of
// them also through a linked body, and five only through linked bodies.
const unchainedOwn = [
  'pf1-content/bGXNSqTBzVbuQZbT', // Planar Wayfarer
  'pf1-content/bI26bO3nMfLje7hX', // Clergy Member
  'pf1-content/bMSonz6Wriihmcvi', // The Pessimist
  'pf1-content/bQ4k8fBcnr8ydP9H', // Infernal Bastard
  'pf1-content/bdwVMgaZnGuODJNO', // Solitary
  'pf1-content/bmqio2OUbI5wr63c', // Rousing Oratory
  'pf1-content/ciAisDr86FPXIz2i', // Exposed to Awfulness
  'pf1-content/ciW6lEBZ9gfkKUBH', // Draconic Infusion
  'pf1-content/cj3t0fyL39rdgkWS', // Lion's Audacity
  'pf1-content/cnBGwJ0pE278ANr8', // Strength of the Barghest
  'pf1-content/cyYiNv3Aara9tS77', // Guardian Smite (also Smite Evil)
  'pf1-content/d6kFiRdhfhC6Mgl1', // Charlatan
  'pf1-content/dIHjvVwhXPe3kFBh', // Animal-Spirit Vitality
  'pf1-content/dNlTpDNryXUOA0Nt', // Erratic Malefactor
  'pf1-content/dRkateEyIRlkpGJv', // Veils upon Veils
  'pf1-content/dSwSnx2OIbbweYFH', // Bound by Honor
  'pf1-content/dkNv2dZffnho5ESv', // Close Allies (also Spirit Touched)
];
const unchainedLinked = [
  'pf1-content/b0yplGvlBFm0WQIi', // Planar Negotiator: the planar ally spells
  'pf1-content/bEisIsuGvVbyZHQt', // Mediator: calm emotions, sleep, suggestion
  'pf1-content/bG8yTSOQcTYmpnKA', // Daring Doomsayer: Club
  'pf1-content/bscHjs2pfzgetxYR', // Shadow Shaman: silent image, blur
  'pf1-content/cR4iDe0UQgvZ4Jsm', // Wind-Carried Voices: message
  'pf1-content/cyYiNv3Aara9tS77', // Guardian Smite: Smite Evil
  'pf1-content/dkNv2dZffnho5ESv', // Close Allies: Spirit Touched
];
const dexSkills = [
  'skill.acr',
  'skill.dev',
  'skill.esc',
  'skill.fly',
  'skill.rid',
  'skill.slt',
  'skill.ste',
];
const medvyed = 'pf1-content/c8eiTJJmkH6EyxnY';

it('resolves the reviewed trait Modifiers, with trait bonuses that never stack', () => {
  // Trait bonuses from different traits on one skill never stack; the higher
  // one counts.
  for (const name of [
    'Holy Schemer (Calistria)',
    'Self-Aware (Vampire; Vetala)',
  ] as const)
    expect(total(reviewedTraitSheet(name), 'skill.sen'), name).toBe(1);
  expect(
    total(
      reviewedTraitSheet(
        'Holy Schemer (Calistria)',
        'Self-Aware (Vampire; Vetala)',
      ),
      'skill.sen',
    ),
  ).toBe(1);
  expect(
    total(
      reviewedTraitSheet('Holy Schemer (Calistria)', 'Insular (Dwarf)'),
      'skill.sen',
    ),
  ).toBe(2);
  // Practiced Gambler's gambling bonus is the new total: +2, not +3.
  const gambler = 'Practiced Gambler (Human; Varisian)';
  for (const target of ['skill.blf', 'skill.slt'] as const) {
    expect(resolveSheet(modifiers(gambler))[target].total, target).toBe(1);
    expect(
      resolveSheet(modifiers(gambler), {
        situations: [situation(gambler, indexOf(gambler, target, 'gambling'))],
      })[target].total,
      target,
    ).toBe(2);
  }
  // Meticulous carries the Misbegotten body: an untyped -2 on every
  // Dexterity-based skill, which stacks with Rapscallion's +1 trait bonus.
  expect(modifiers('Meticulous').map((row) => row.target)).toEqual(dexSkills);
  for (const target of dexSkills)
    expect(total(reviewedTraitSheet('Meticulous'), target), target).toBe(-2);
  expect(
    total(reviewedTraitSheet('Meticulous', 'Rapscallion (Gnome)'), 'skill.esc'),
  ).toBe(-1);
  expect(total(reviewedTraitSheet('Rapscallion (Gnome)'), 'init')).toBe(1);
  // Imported changes with no sheet target contribute nothing; reviewed
  // Modifiers supply the rule.
  for (const [name, target, value, conditioned] of [
    ['Harvester', 'skill.pro', 1, true],
    ['Bitter Heart (Changeling)', 'attack.melee', 2, true],
    ['Meticulous', 'skill.ste', -2, false],
  ] as const) {
    expect(entry(name).unsupported, name).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
    );
    expect(resolveSheet(modifiers(name))[target].total, name).toBe(
      conditioned ? 0 : value,
    );
    if (conditioned)
      expect(
        resolveSheet(modifiers(name), { situations: [situation(name, 0)] })[
          target
        ].total,
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
  expect([morale['damage.melee'].total, morale['attack.melee'].total]).toEqual([
    1, 0,
  ]);
  const stabbing = resolveSheet(modifiers('Stabbing Spells'), {
    situations: [situation('Stabbing Spells', 0)],
  });
  expect([stabbing.casterLevel.total, stabbing['attack.melee'].total]).toEqual([
    2, 0,
  ]);
  // Dervish's dodge bonus lands on the other AC leaf under its Situation.
  const dervish = 'Dervish (Qadira Faction)';
  expect(
    resolveSheet(modifiers(dervish), { situations: [situation(dervish, 0)] })[
      'ac.other'
    ].total,
  ).toBe(1);
  // Zealot's Bearing: the bonus and the penalty exclude each other.
  const zealot = "Zealot's Bearing";
  const adherents = situation(
    zealot,
    indexOf(zealot, 'skill.dip', 'adherents'),
  );
  const others = situation(zealot, indexOf(zealot, 'skill.dip', 'not share'));
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
    expect(new Set(modifiers(name).map((row) => row.bonusType)), name).toEqual(
      new Set(['untyped']),
    );
  expect(modifiers(dervish).map((row) => row.bonusType)).toEqual(['dodge']);
  expect(modifiers('Ease of Faith')).toEqual([
    expect.objectContaining({
      target: 'skill.dip',
      bonusType: 'trait',
      value: 1,
    }),
  ]);
  expect(
    candidate('Ease of Faith').mechanicsReview.outstandingCalculations[0],
  ).toContain('stacking type stays a listed gap');
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
      [...new Set(notes.map((note) => note.target))].sort(),
      row.name,
    ).toEqual(
      [...new Set((contextNotes ?? []).map((note) => note.target))].sort(),
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
  }
  expect(required).toBe(106);
  // Stabbing Spells' ranged note repeats its melee note's caster level check
  // bonus; it is the explicit covered/no-output record.
  expect(
    heldTraits.flatMap((row) =>
      row.mechanicsReview.curationRecords
        .filter((record) => !record.outputs.length)
        .map((record) => `${row.name} ${record.target}`),
    ),
  ).toEqual(['Stabbing Spells rangedWeapon']);
  // Notes the drafter put on unrelated statistics are entry-level.
  for (const name of [
    'Genie Heir (Geniekin)',
    'Kraggodan Castaway (Ironfang Invasion)',
    'Cultist Lineage (Mediogalti Island)',
    'Water Shaping (Undine)',
    'Diligence (Any City)',
    'Draconic Infusion',
    'Strength of the Barghest (Hadregash)',
    'Animal-Spirit Vitality (Kyonin)',
  ])
    expect(
      entry(name)
        .situationalNotes?.filter((note) => note.target)
        .map((note) => note.target),
      name,
    ).toEqual([]);
  // Every trait records its calculation gaps, never as an attribution hold.
  for (const row of heldTraits) {
    expect(
      row.mechanicsReview.outstandingCalculations.length,
      row.name,
    ).toBeGreaterThan(0);
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
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
      `traits-379-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `traits-379-notice-${book}-complete-chain`),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    heldTraits
      .filter((row) => row.traitType === 'drawback')
      .map((row) => row.name)
      .sort(),
  ).toEqual(['Envy', 'Meticulous', 'Provincial', 'Unlearned']);
  // Inherited rules the bodies change or depend on.
  for (const [name, book] of [
    ['Infernal Bastard (Council of Thieves)', 'PZO9280'],
    ['Numerian Archaeologist (Iron Gods)', 'PZO9272'],
    ['Shadow Shaman (Nidal)', 'PZO1129'],
    ['Exposed to Awfulness (Wrath of the Righteous)', 'PZO1126'],
    ['Meticulous', 'PZO9433'],
    ['Daring Doomsayer (Second Darkness)', 'PZO1123'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Meticulous follows the Quests & Campaigns Misbegotten row its body
  // matches; the Ultimate Campaign Meticulous row is a rejected alternate.
  expect(candidate('Meticulous').comparison).toMatchObject({
    line: 68,
    book: 'PZO9433',
  });
  expect(candidate('Meticulous').comparison?.literalRow).toContain(
    'troublesome deformity',
  );
  expect(
    candidate('Meticulous').rejectedRootComparisonEvidence[0]?.literalRow,
  ).toContain('untrained');
  // Class features name the pinned class record's literal line.
  for (const [name, file] of [
    ['Shadow Shaman (Nidal)', 'shaman.jMi3GBtvdG0WhH8L.yaml#L85'],
    ['Guardian Smite (Trudd)', 'paladin.ohptcds1d5oG6Bjh.yaml#L101'],
  ] as const)
    expect(
      candidate(name).inheritedRuleNotices.some((notice) =>
        notice.location.endsWith(file),
      ),
      name,
    ).toBe(true);
  // Unchained action-cost metadata anywhere in the bound closure, the
  // trait's own actions included, requires the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedLinked])].sort();
  expect(unchained).toHaveLength(22);
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
      'traits-379-notice-PZO1131-complete-chain',
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
  // Same-name rows of other traits and unpinned printings are not required.
  for (const [name, book] of [
    ['Planar Negotiator (Aasimar)', 'PZO9437'],
    ['Child of the Crusades (Mendev)', 'PZO9437'],
    ['Insular (Dwarf)', 'PZO9280'],
    ['Numerian Archaeologist (Iron Gods)', 'PZO9448'],
    ['The Stranger', 'PZO9474'],
  ] as const)
    expect(candidate(name).requiredNotices, name).not.toContain(book);
  expect(
    heldTraits
      .flatMap((row) => row.linkedContentReview.map((linked) => linked.name))
      .sort(),
  ).toEqual([
    'Blur',
    'Calm Emotions',
    'Club',
    'Message',
    'Noble Born - Garress (Kingmaker)',
    'Noble Born - Lebeda (Kingmaker)',
    'Noble Born - Lodovka (Kingmaker)',
    'Noble Born - Orlovsky (Kingmaker)',
    'Noble Born - Surtova (Kingmaker)',
    'Planar Ally',
    'Planar Ally, Greater',
    'Planar Ally, Lesser',
    'Silent Image',
    'Sleep',
    'Smite Evil',
    'Spirit Touched (Return of the Runelords)',
    'Suggestion',
  ]);
  // The Smite Evil class ability cites no source; the paladin class record
  // supplies the book.
  expect(
    candidate('Guardian Smite (Trudd)').linkedContentReview[0]?.sources,
  ).toEqual([]);
  expect(preview.closure.map((row) => row.externalKey).sort()).toEqual(
    heldTraits
      .flatMap((row) =>
        row.linkedContentReview.map((linked) => linked.externalKey),
      )
      .sort(),
  );
  for (const name of noRow) {
    expect(candidate(name).comparison, name).toBeNull();
    expect(candidate(name).additionalComparisonLeads, name).toEqual([]);
    expect(candidate(name).inheritedRuleUnresolvedOrigins[0], name).toContain(
      'no PCGen row at the pin',
    );
  }
  expect(heldTraits.filter((row) => !row.comparison)).toHaveLength(
    noRow.length,
  );
  // Rules no permitted evidence sources stay named unresolved origins.
  expect(candidate('Grief-Filled').inheritedRuleUnresolvedOrigins).toEqual([
    expect.stringContaining('emotion descriptor'),
  ]);
  expect(candidate('Bound by Honor').inheritedRuleUnresolvedOrigins).toEqual([
    expect.stringContaining('no PCGen row at the pin'),
    expect.stringContaining('Honor Points'),
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
      batch: 'traits-379',
      candidate: candidate(name),
    });
  // Region lists split at commas or "or", "Half-Orc, Orc" requires both
  // races, an undine heritage maps no race and an alternative loses its
  // region (#739).
  for (const [name, mapped] of [
    ['Godless Resolve (Bachuan, Rahadoum, or Touvette; Bard)', ['unchecked']],
    ['Mindlessly Cruel (Half-Orc, Orc)', ['anyOf']],
    ['Outsea Native (River Kingdoms; Undine)', ['unchecked']],
    [
      'Cheap to Feed (Halfling; Osirion, Varisia)',
      ['race', 'unchecked', 'unchecked'],
    ],
    ['Charlatan (Gnome)', ['race', 'unchecked']],
    ['Animal-Spirit Vitality (Kyonin)', ['unchecked']],
  ] as const) {
    expect(kinds(name), name).toEqual(mapped);
    expect(facts(name), name).toEqual(
      expect.arrayContaining([expect.stringContaining('#739')]),
    );
  }
  // Master Messenger's "Requirement(s) Riddleport" has no heading the mapper
  // reads, so it maps no requirement at all.
  expect(entry('Master Messenger').prerequisites ?? []).toEqual([]);
  expect(facts('Master Messenger')).toEqual([expect.stringContaining('#739')]);
  for (const [name, gap] of [
    ['Dervish (Qadira Faction)', 'no faction fact exists'],
    ['Blade Bravado (Human; Taldan)', 'no heritage or ethnicity fact exists'],
    ["Mother's Teeth (Lamashtu; Goblin)", 'no deity fact exists'],
    ['Pretend Pirate (Andoran)', 'no region fact exists'],
    ['The Pack', 'no birth-date fact exists'],
    ['Mindspin Mountain Goat (Ram)', 'no mount or animal-kind fact exists'],
    ['Minor Wishcraft (Geniekin)', 'no race-group fact exists'],
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
  // The Mount folder is pack organization, excluded by the importer's folder
  // contract.
  expect(folders).toEqual([
    expect.objectContaining({
      externalKey: 'pf1-content/blGAJ1WAWJ1P9rmt',
      name: 'Mount',
      rawKey: '!folders!blGAJ1WAWJ1P9rmt',
    }),
  ]);
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
  // Rapscallion's body equals its Advanced Player's Guide row's benefit.
  expect(candidate('Rapscallion (Gnome)').comparison?.literalRow).toContain(
    'BONUS:COMBAT|INITIATIVE|1|TYPE=Trait',
  );
  // Noble Born - Medvyed sits in the content closures of the landed Noble
  // Born - Garress (#369) and Surtova (#370) assessments, which this batch
  // re-binds (#756): their fixtures keep the same Medvyed entry as ours.
  for (const batch of ['traits-369', 'traits-370']) {
    const fixture = JSON.parse(
      await readFile(`tests/fixtures/${batch}/preview.json`, 'utf8'),
    ) as { closure: { externalKey: string }[] };
    expect(
      fixture.closure.find((row) => row.externalKey === medvyed),
      batch,
    ).toEqual(preview.entries.find((row) => row.externalKey === medvyed));
  }
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
      required: 106,
      checked: 106,
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
    // Every link resolves in the full corpus, so no trait fails as a broken
    // reference; each is held on its own reasons.
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
    const temper = candidate('Prideful Temper (Tiefling)');
    expect(temper.requiredNotices).toEqual(['PZO9423', 'PZO1115', 'PZO1110']);
    // With its PCGen-confirmed books reviewed (2026-10-31), only the notice
    // holds the owner's clearance clears still hold it, so this runs uncleared.
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === temper.externalKey
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(
      confirmed.admitted.some((row) => row.externalKey === temper.externalKey),
    ).toBe(false);
    expect(
      confirmed.held.find((row) => row.externalKey === temper.externalKey)
        ?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});
