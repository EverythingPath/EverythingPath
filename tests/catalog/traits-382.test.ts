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
} from '../fixtures/traits-382/data';
import { reviewedTraitSheet } from '../fixtures/traits-382/sheet';
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

// Traits with no PCGen trait row at the pin, including alternate spellings.
const noRow = [
  'Vindictive (Taldor Faction)',
  'Horse Lord (Qadira Faction)',
  'Taldan Patriot (War for the Crown)',
  'Fashionable (Sovereign Court)',
  "Inheritor's Immunity (Iomedae)",
  'Switched at Birth (Changeling)',
  'Proud Progenitor (Vampire; Moroi)',
  'Tanglebriar Guerrilla (Kyonin)',
  'Medic (Shadow Lodge)',
  'Observant (Grand Lodge)',
  'Emberkin Imposter (Qadira)',
  "The Optimist (Tyrant's Grasp)",
  'Intrigued by Thassilon (Return of the Runelords)',
  'Malevolent Temptations',
  'Time Lost (Return of the Runelords)',
];

// Every trait whose bound content closure keeps Unchained action-cost
// metadata (owner ruling, 2026-10-17): 15 on the trait's own action and 3
// through linked bodies, 1 of them both ways.
const unchainedOwn = [
  'pf1-content/kZlIOR6x4TSRNXiW', // Ironfang Survivor
  'pf1-content/kca82LWvOp13IjBw', // Vindictive
  'pf1-content/kwMY3ETsAYTa76Vl', // Taldan Patriot
  'pf1-content/l5iahvN8dYp95diP', // Inheritor's Immunity
  'pf1-content/lTXSdWyJC0z3kZOR', // Switched at Birth
  'pf1-content/lx1wNobg9n5H60hq', // Magic in the Blood
  'pf1-content/m2Xp3XdnqoDTpBwh', // Tanglebriar Guerrilla
  'pf1-content/m98Bia22g5gQfB5p', // Inspiring
  'pf1-content/mODg4FJiKxg9ex9F', // Blessed Orphan
  'pf1-content/mQDAnoVV5pgPU1Iv', // Volatile Conduit
  'pf1-content/mUMuv0KGpbkOVwX9', // The Optimist
  'pf1-content/mc7uywkdlRNvXtIJ', // Beacon of Faith
  'pf1-content/mnfRMz3VQWwx4uqL', // Intrigued by Thassilon
  'pf1-content/mrAUNv6BR2qz3b2e', // Time Lost
  'pf1-content/mzI4otLsH60v0WlR', // Besmara's Blessing
];
const unchainedLinked = [
  'pf1-content/kZetuYytV3DrTpNP', // Adherent of Ancient Osirion: two weapons
  'pf1-content/lx1wNobg9n5H60hq', // Magic in the Blood: six spells and Detect Evil
  'pf1-content/m0vy0tN9Bqxv1HEy', // Shoanti Tattoo: two weapons
];

const saves = (resolved: ReturnType<typeof resolveSheet>) => [
  resolved['save.fort'].total,
  resolved['save.ref'].total,
  resolved['save.will'].total,
];

it('resolves the reviewed trait Modifiers, with trait bonuses that never stack', () => {
  // Trait bonuses from different traits on one statistic never stack.
  const chance = 'Chance Savior (Carrion Crown)';
  const lost = 'Time Lost (Return of the Runelords)';
  const firebrand = 'Westcrown Firebrand (Council of Thieves)';
  expect(total(reviewedTraitSheet(chance), 'init')).toBe(2);
  expect(total(reviewedTraitSheet(chance, lost), 'init')).toBe(2);
  expect(total(reviewedTraitSheet(firebrand), 'init')).toBe(1);
  expect(total(reviewedTraitSheet(chance, firebrand), 'init')).toBe(2);
  expect(total(reviewedTraitSheet('Deft Dodger'), 'save.ref')).toBe(1);
  expect(total(reviewedTraitSheet('Life of Toil'), 'save.fort')).toBe(1);
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
      expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
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
    total(reviewedTraitSheet('Intense Artist (Shelyn)'), 'skill.prf'),
  ).toBe(1);
  expect(
    total(reviewedTraitSheet('Demented Inventor (Half-Orc, Orc)'), 'skill.crf'),
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
          situation(andoletta, indexOf(andoletta, 'saves', 'immune to fear')),
        ],
      }),
    ),
  ).toEqual([4, 4, 4]);
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
    ['Demon-Proof Mind (Sarkoris, Worldwound)', 'mindAffecting', 'save.will'],
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
  for (const row of preview.entries)
    for (const modifier of row.modifiers)
      if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
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
      situations: [situation(golden, indexOf(golden, 'skill.blf', 'kobolds'))],
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
      situations: [situation(family, indexOf(family, 'skill.dis', 'not a'))],
    })['skill.dis'].total,
  ).toBe(-2);
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
});

it('checks every required note record and the separate description pass against the pinned bodies', () => {
  let required = 0;
  for (const row of heldTraits) {
    const [description, ...notes] = row.mechanicsReview.curationRecords;
    const contextNotes = row.sourceFields.contextNotes as
      | { target: string; text: string }[]
      | undefined;
    expect(notes.map((note) => note.target).sort(), row.name).toEqual(
      (contextNotes ?? []).map((note) => note.target).sort(),
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
  expect(required).toBe(83);
  // Valknar Alumnus' Perform note repeats its performance combat note; it is
  // the explicit covered/no-output record.
  expect(
    heldTraits.flatMap((row) =>
      row.mechanicsReview.curationRecords
        .filter((record) => !record.outputs.length)
        .map((record) => `${row.name} ${record.target}`),
    ),
  ).toEqual(['Valknar Alumnus (Tymon) skill.prf']);
  // Notes on statistics the sheet can't target are entry-level.
  for (const name of [
    'Valknar Alumnus (Tymon)',
    'Flame-Touched',
    'Faithful Feedback (any religion)',
    'Sacred Smasher (Rovagug)',
    'Prayer Breaker (Tiefling; Faultspawn)',
  ])
    expect(
      entry(name)
        .situationalNotes?.filter((note) => note.target)
        .map((note) => note.target),
      name,
    ).toEqual([]);
  // Readable Notes on the statistic they describe.
  for (const [name, targets] of [
    [
      'Ironfang Survivor (Ironfang Invasion)',
      ['skill.int', 'skill.sen', 'skill.ste'],
    ],
    ["Inheritor's Immunity (Iomedae)", ['saves']],
    ['Pustular (Goblin)', ['saves']],
    ['Switched at Birth (Changeling)', ['save.fort']],
    ['Beacon of Faith', ['casterLevel']],
    ['Armored Rider', ['skill.rid']],
    ['Dependent', ['skill.dip']],
    ['Precision Hearing (Skinwalker; Werebat-Kin)', ['skill.per']],
    ['Providential Passenger (Halfling)', ['skill.dip']],
    ['Slippery Step (Undine)', ['attack']],
  ] as const)
    expect(
      entry(name)
        .situationalNotes?.filter((note) => note.target)
        .map((note) => note.target),
      name,
    ).toEqual(targets);
  // Every outstanding calculation is recorded, never as an attribution hold.
  for (const row of heldTraits) {
    expect(
      row.mechanicsReview.outstandingCalculations.length,
      row.name,
    ).toBeGreaterThan(0);
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  }
  // Weapon proficiency grants are facts left readable.
  for (const [name, fact] of [
    ['Arodenite Sword Training', 'Proficiency with the longsword'],
    ['Shoanti Tattoo (Human; Shoanti)', 'earth breakers, klars and Shoanti'],
    [
      'Adherent of Ancient Osirion (Osirion; Catfolk)',
      'tekko-kagi as a martial weapon',
    ],
  ] as const)
    expect(
      candidate(name).mechanicsReview.proficiencyReview.outstandingFacts,
      name,
    ).toEqual([expect.stringContaining(fact)]);
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
      `traits-382-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `traits-382-notice-${book}-complete-chain`),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    heldTraits
      .filter((row) => row.traitType === 'drawback')
      .map((row) => row.name),
  ).toEqual(['Forgetful', 'Warded Against Nature', 'Dependent']);
  // Rootless records take their book from the PCGen comparison.
  for (const [name, book] of [
    ['Black Eagle Recruit (Lambreth)', 'PZO9448'],
    ['Animal Whisperer (Ironfang Invasion)', 'PZO9000-20E'],
    ['Thirst for Knowledge (Nethys)', 'PZO9267'],
    ['Blessed Orphan (Folgrit)', 'PZO9267'],
  ] as const) {
    expect(candidate(name).citedSources, name).toEqual([]);
    expect(candidate(name).comparison?.book, name).toBe(book);
    expect(candidate(name).requiredNotices, name).toContain(book);
  }
  // Inherited rules the bodies change or depend on, and linked bodies' books.
  for (const [name, book] of [
    ['Valknar Alumnus (Tymon)', 'PZO1118'],
    ['Eoxian Experiment (Eox)', 'PZO1117'],
    ['Tanglebriar Guerrilla (Kyonin)', 'PZO1117'],
    ['Beacon of Faith', 'PZO1117'],
    ['Centaur Vengeance (Iobaria)', 'PZO1112'],
    ["Mummy-Cursed (Mummy's Mask)", 'PZO1112'],
    ['Adherent of Ancient Osirion (Osirion; Catfolk)', 'PZO1121'],
    ['Adherent of Ancient Osirion (Osirion; Catfolk)', 'PZO1123'],
    ['Shoanti Tattoo (Human; Shoanti)', 'PZO1123'],
    ['Pathfinder Recruit (Ruins of Azlant)', 'PZO9211'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Frightful presence names the Universal Monster Rules journal's page.
  expect(
    candidate('Centaur Vengeance (Iobaria)').inheritedRuleNotices.some(
      (notice) =>
        notice.location.endsWith(
          'universal-monster-rules-umr.nBnUY0koBzXqoEft.yaml#L1292',
        ),
    ),
  ).toBe(true);
  // Unchained action-cost metadata anywhere in the bound closure, the
  // trait's own actions included, requires the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedLinked])].sort();
  expect(unchained).toHaveLength(17);
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
      'traits-382-notice-PZO1131-complete-chain',
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
  // Detect Evil, two links from Magic in the Blood, is bound (its Unchained
  // metadata counts) but not a direct linked body.
  expect(
    candidate('Magic in the Blood (Changeling)')
      .inheritedRuleNotices.filter((notice) => notice.book === 'PZO1131')
      .map((notice) => notice.rule),
  ).toEqual(
    expect.arrayContaining([expect.stringContaining('bound Detect Evil')]),
  );
  // Same-name rows of other traits and unpinned printings are not required.
  for (const [name, book] of [
    ["Mummy-Cursed (Mummy's Mask)", 'PZO9441'],
    ['Scholar of Ruins (Human)', 'PZO9405'],
    ['Trickster (Gnome)', 'PZO9280'],
    ['Horse Lord (Qadira Faction)', 'PZO9417'],
  ] as const)
    expect(candidate(name).requiredNotices, name).not.toContain(book);
  const linkedNames = heldTraits.flatMap((row) =>
    row.linkedContentReview.map((linked) => linked.name),
  );
  expect(linkedNames).toHaveLength(11);
  expect(new Set(linkedNames).size).toBe(11);
  // The closure holds the linked bodies and Detect Evil, linked from Detect
  // Good.
  expect(preview.closure.map((row) => row.externalKey).sort()).toEqual(
    [
      ...new Set([
        ...heldTraits.flatMap((row) =>
          row.linkedContentReview.map((linked) => linked.externalKey),
        ),
        'pf1/tr7m97npkbgm4wp7',
      ]),
    ].sort(),
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
  // Named unresolved origins.
  for (const [name, origin] of [
    ["Andoletta's Consolation (Andoletta)", 'emotion descriptor'],
    ["Mummy-Cursed (Mummy's Mask)", 'curse descriptor'],
    ['Shoanti Tattoo (Human; Shoanti)', 'absent from the pinned pack'],
  ] as const)
    expect(candidate(name).inheritedRuleUnresolvedOrigins, name).toEqual([
      expect.stringContaining(origin),
    ]);
  expect(
    candidate('Taldan Patriot (War for the Crown)')
      .inheritedRuleUnresolvedOrigins,
  ).toEqual([
    expect.stringContaining('no PCGen row at the pin'),
    expect.stringContaining('social combat'),
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
      batch: 'traits-382',
      candidate: candidate(name),
    });
  // The original conjunction finding is retained; the race choices are now
  // alternatives. Armored Rider's unsupported heading remains an open finding.
  expect(kinds('Demented Inventor (Half-Orc, Orc)')).toEqual(['anyOf']);
  expect(entry('Armored Rider').prerequisites ?? []).toEqual([]);
  for (const name of ['Demented Inventor (Half-Orc, Orc)', 'Armored Rider'])
    expect(facts(name), name).toEqual(
      expect.arrayContaining([expect.stringContaining('#739')]),
    );
  expect(kinds('Demon-Proof Mind (Sarkoris, Worldwound)')).toEqual([
    'unchecked',
  ]);
  expect(kinds('Bellflower Tiller (Bellflower Network, Cheliax)')).toEqual([
    'unchecked',
    'unchecked',
  ]);
  expect(kinds("Inheritor's Immunity (Iomedae)")).toEqual(['deity']);
  expect(facts("Inheritor's Immunity (Iomedae)")).toEqual([]);
  for (const [name, gap] of [
    ['Vindictive (Taldor Faction)', 'no faction fact exists'],
    ['Glint-Tongued (Human; Ulfen)', 'no heritage or ethnicity fact exists'],
    ["Andoletta's Consolation (Andoletta)", 'no deity fact exists'],
    ['Black Eagle Recruit (Lambreth)', 'no region fact exists'],
    ['Faithful Feedback (any religion)', 'no faith or deity fact exists'],
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
  // The Drawbacks folder is excluded by the importer's folder contract.
  expect(folders.map((row) => [row.externalKey, row.name, row.rawKey])).toEqual(
    [
      [
        'pf1-content/n1kBJ9yG8vwL71rY',
        'Drawbacks',
        '!folders!n1kBJ9yG8vwL71rY',
      ],
    ],
  );
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
  // Demonic Persuasion's Faiths of Corruption row encodes +1 where its text
  // and the pinned body read +2.
  expect(
    candidate('Demonic Persuasion (Demon Lords)').comparison?.literalRow,
  ).toContain('BONUS:SITUATION|Diplomacy=Demons|1');
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
      required: 83,
      checked: 83,
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
    // Shoanti Tattoo links a Klar weapon absent from the pinned pack; the
    // importer strips the link and the gate reports the entry before its
    // holds apply.
    expect(gate.failures.filter((row) => ours.has(row.externalKey))).toEqual([
      {
        externalKey: 'pf1-content/m0vy0tN9Bqxv1HEy',
        reason: 'Broken structure or reference: unresolved imported reference.',
      },
    ]);
    const held = gate.held.filter((row) => ours.has(row.externalKey));
    expect(held).toHaveLength(98);
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
    const orphan = candidate('Chance Savior (Carrion Crown)');
    expect(orphan.requiredNotices).toEqual([
      'PZO9000-8E',
      'PZO1115',
      'PZO1110',
    ]);
    // With its PCGen-confirmed books reviewed (2026-10-31), only the notice
    // holds the owner's clearance clears still hold it, so this runs uncleared.
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === orphan.externalKey
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(
      confirmed.admitted.some((row) => row.externalKey === orphan.externalKey),
    ).toBe(false);
    expect(
      confirmed.held.find((row) => row.externalKey === orphan.externalKey)
        ?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});

it('corrects only Magical Lineage choice recording as a draft, preserving the reviewed #739 inventory and holds', async () => {
  const raw = JSON.parse(
    await readFile(
      new URL('../../scripts/catalog/legal/traits-382.json', import.meta.url),
      'utf8',
    ),
  );
  const lineage = raw.candidates.find(
    (row: { externalKey: string }) =>
      row.externalKey === 'pf1-content/kDx6ZGhbIteoi7lG',
  );
  expect(raw.candidates).toHaveLength(100);
  expect(lineage.mechanicsReview.outstandingCalculations).toEqual([
    'Treating the chosen spell as 1 level lower for its metamagic-adjusted level is not modeled; it stays readable and is applied manually under the #767/#769 owner exception.',
  ]);
  expect(lineage.mechanicsReview.choiceRecordingReview).toEqual({
    status: 'drafted',
    ticket: 769,
    statement:
      'The sheet records one chosen spell in existing trait state.choice and displays it with the published benefit. An unset or cleared spell is visibly incomplete. No Spell ID is required. Metamagic arithmetic remains manual; base spell levels, DCs and slots are unchanged. This corrects only the stale cannot-record-choice finding; all source, whole-body and notice holds remain.',
  });
  // Independent reviewed #739 tree (cdec54eb): every other decoded field,
  // including its parser diagnostics/bindings, all 100 original keys and holds.
  // The paired-input reconciliation proof checks this projection against A
  // before adding only the two reviewed #769 fields; no #739 field is omitted.
  // Only these #761 dependency bindings changed. Restore their independently
  // pinned prior values for the original #739 whole-inventory assertion.
  for (const [key, before, after] of [
    [
      'pf1-content/kZetuYytV3DrTpNP',
      'bf99e1bacaf62d61de60e1b8fb7ad47b7039e086e149bb1bb1088f73ce625a15',
      'd6b1cea2e926d83a33b43e54ea26658dc415c46dfe5819841e6d1fe9d9997b10',
    ],
    [
      'pf1-content/m0vy0tN9Bqxv1HEy',
      'a06f263a35ee644369cf038260b1512008ed8847f5796ea76ec1a7db69856510',
      'bc698014a9bd365e4097a6653d4e6d2e97bb8845689cb676836284a6cecfd0ef',
    ],
  ]) {
    const row = raw.candidates.find(
      (row: { externalKey: string }) => row.externalKey === key,
    );
    expect(row.currentBinding.contentFingerprint).toBe(after);
    row.currentBinding.contentFingerprint = before;
  }
  delete lineage.mechanicsReview.outstandingCalculations;
  delete lineage.mechanicsReview.choiceRecordingReview;
  expect(sha(JSON.stringify(raw))).toBe(
    '5db148aef37faa3f70c99193d4312765037c5ede11532335053a2b3f35a2061d',
  );
});
