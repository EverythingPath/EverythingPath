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
} from '../fixtures/traits-376/data';
import { reviewedTraitSheet } from '../fixtures/traits-376/sheet';
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
  'Dirty Trickster',
  'Aballonian Resilience (Aballon)',
  'Sacred Orienteer (Elion)',
  'House of Green Mothers Pupil',
  'Weatherworn (Vampire; Moroi)',
  'Snake Handler (Osirion; Apep or Wadjet)',
  'Escaped Captive',
  'Faith Unshakable and Unassailable',
  'Stargazer (Lirgen)',
  'Anuli Engineer (Anuli)',
  'Exhibition Fighter (Lung Wa)',
  'Rising Star (War for the Crown)',
  'Calculated Risk (Vampire; Jiang-Shi)',
  'Scamper (Ratfolk)',
  'Self-Doubting',
  'Smuggler (The Exchange)',
];

// Every trait whose bound content closure keeps Unchained action-cost
// metadata (owner ruling, 2026-10-17): 16 on the trait's own action, two of
// them also through linked spells, and two only through linked spells.
const unchainedOwn = [
  'pf1-content/RoB9qxyKLyfgdXa5', // Strength of Body
  'pf1-content/S4bXKzlXQAIE1A5V', // Oregent Desperation
  'pf1-content/S9MZOvNWWwoZoksS', // Elemental Accident
  'pf1-content/SHyplBquu7Tui8aw', // Rage of Storms
  'pf1-content/SMGbgyjX3TBUyQlJ', // Scion of the Shory (also its four spells)
  'pf1-content/STSBqBIufv2tcivr', // Inspired
  'pf1-content/SZKvxA7z5d5buqZj', // Sacred Orienteer
  'pf1-content/SrTIed0khcWjOSH5', // Alchemical Intuition
  'pf1-content/T4bxATujMw2LatYg', // Erutaki Sky Reader
  'pf1-content/TlaYuOmIUAt6jIdo', // Self-Actualization
  'pf1-content/U4fOvrvkHJsja5Zk', // Enduring Heritage
  'pf1-content/U5xQHpnzCcIwCuyd', // Rising Star
  'pf1-content/U8uTLR8ETTKbs5pK', // Divine Deceiver (also Cure Light Wounds)
  'pf1-content/UC5YfBbGDNLOuwr6', // Calculated Risk
  'pf1-content/UbZb0kh5hb9qXl2j', // Self-Doubting
  'pf1-content/UgVIJWDKIBwZtyVu', // Isger Fixer
];
const unchainedLinked = [
  'pf1-content/SMGbgyjX3TBUyQlJ', // Scion of the Shory: its four spells
  'pf1-content/TICivn2DheA2sEJ5', // Weatherworn: Gust of Wind
  'pf1-content/U8uTLR8ETTKbs5pK', // Divine Deceiver: Cure Light Wounds
  'pf1-content/UBFxnCUihS4ixJU2', // Strict Judgment: Mark of Justice, Geas/Quest, Geas, Lesser
];

it('resolves the reviewed trait Modifiers, with trait bonuses that never stack', () => {
  // Indomitable Faith and Purity of Faith: two traits' +1 trait bonuses on
  // Will saves don't stack.
  for (const name of [
    'Indomitable Faith',
    'Purity of Faith (Iomedae)',
  ] as const)
    expect(total(reviewedTraitSheet(name), 'save.will'), name).toBe(1);
  expect(
    total(
      reviewedTraitSheet('Indomitable Faith', 'Purity of Faith (Iomedae)'),
      'save.will',
    ),
  ).toBe(1);
  // Purity of Faith's bonus against evil outsiders is one Situation; on Will
  // it doesn't add to the trait's own +1.
  const purity = 'Purity of Faith (Iomedae)';
  const evil = resolveSheet(modifiers(purity), {
    situations: [situation(purity, indexOf(purity, 'saves', 'evil subtype'))],
  });
  expect([
    evil['save.fort'].total,
    evil['save.ref'].total,
    evil['save.will'].total,
  ]).toEqual([1, 1, 1]);
  // A bonus that rises in a Situation is its new total.
  for (const [name, target, label, base, raised] of [
    ['Theoretical Magician', 'skill.spl', 'spellcaster', 2, 3],
    [
      'Sovyrian Intellectual (Elf, 1st-level)',
      'skill.dip',
      'elf subtype',
      1,
      3,
    ],
    ['Acolyte of Razmir (Razmiran)', 'skill.klo', 'Razmiri', 1, 2],
    ['Acolyte of Razmir (Razmiran)', 'skill.kre', 'Razmiri', 1, 2],
  ] as const) {
    expect(resolveSheet(modifiers(name))[target].total, name).toBe(base);
    expect(
      resolveSheet(modifiers(name), {
        situations: [situation(name, indexOf(name, target, label))],
      })[target].total,
      name,
    ).toBe(raised);
  }
  // Strength of Body uses the Strength modifier in place of the Constitution
  // modifier on one Fortitude save, never lowering it. (The classless
  // fixture's Fortitude save has no Constitution modifier of its own, so the
  // totals show the substitution alone.)
  const body = 'Strength of Body (Skinwalker; Wereboar-Kin)';
  expect(scored(body, { strength: 16, constitution: 10 }, 'save.fort')).toBe(0);
  expect(
    scored(body, { strength: 16, constitution: 10 }, 'save.fort', [0]),
  ).toBe(3);
  expect(
    scored(body, { strength: 8, constitution: 14 }, 'save.fort', [0]),
  ).toBe(0);
  // Alchemical Intuition adds the Charisma modifier (minimum 0) on one Craft
  // (alchemy) check.
  const intuition = 'Alchemical Intuition';
  expect(scored(intuition, { charisma: 14 }, 'skill.crf', [0])).toBe(2);
  expect(scored(intuition, { charisma: 6 }, 'skill.crf', [0])).toBe(0);
  expect(scored(intuition, { charisma: 14 }, 'skill.crf')).toBe(0);
  // Unmapped or targetless imported changes contribute nothing; reviewed
  // Modifiers supply the rule (Desperate Focus unconditionally, the others
  // under their Situation).
  expect(entry('Desperate Focus').unsupported).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        field: 'changes',
        value: expect.objectContaining({ target: 'concentration' }),
      }),
    ]),
  );
  expect(resolveSheet(modifiers('Desperate Focus')).concentration.total).toBe(
    2,
  );
  for (const [name, target, label, value] of [
    ['Voice of Velvet (Human; Vudrani)', 'skill.prf', 'oratory', 1],
    ['Ear for Music (Shelyn)', 'skill.prf', 'Perform category', 1],
    ['Regional Influence - Korvosa (Varisia)', 'skill.pro', 'Profession', 1],
    ['Regional Influence - Korvosa (Varisia)', 'skill.dip', 'Infernal', 1],
    ['Best Friend (Jade Regent)', 'skill.dip', 'Ameiko', 2],
    ['Best Friend (Jade Regent)', 'skill.blf', 'Sandru', 2],
    ['Rising Star (War for the Crown)', 'skill.crf', 'Craft', 1],
    ['Persecuted Expatriate (Tiefling)', 'skill.klo', 'asura', 1],
    ['Persecuted Expatriate (Tiefling)', 'skill.sen', 'rakshasa', 1],
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
    ['Persecuted Expatriate (Tiefling)', 10],
    ['Elemental Resilience (any elemental lord)', 4],
    ['Best Friend (Jade Regent)', 3],
  ] as const)
    expect(modifiers(name), name).toHaveLength(count);
  // Shared Situations where the body's condition matches exactly.
  const courage = resolveSheet(modifiers('Courageous'), {
    situations: ['fear'],
  });
  expect([
    courage['save.fort'].total,
    courage['save.ref'].total,
    courage['save.will'].total,
  ]).toEqual([2, 2, 2]);
  expect(
    resolveSheet(modifiers('Skeptic'), { situations: ['illusions'] })[
      'save.will'
    ].total,
  ).toBe(2);
  expect(
    resolveSheet(modifiers('Snake Handler (Osirion; Apep or Wadjet)'), {
      situations: ['poison'],
    })['save.fort'].total,
  ).toBe(2);
  expect(
    resolveSheet(modifiers('Adventurous Imbiber (Cayden Cailean)'), {
      situations: ['poison'],
    })['save.ref'].total,
  ).toBe(1);
  expect(
    resolveSheet(modifiers('Dirty Trickster'), { situations: ['dirtyTrick'] })
      .cmb.total,
  ).toBe(1);
  expect(
    resolveSheet(modifiers('Artifact Hunter (Giantslayer)'), {
      situations: ['identifyMagicItems'],
    })['skill.spl'].total,
  ).toBe(1);
  // Pillager's disarm and steal bonuses are trait bonuses of one entry.
  const pillager = modifiers('Pillager');
  expect(pillager.map((row) => row.condition?.situation)).toEqual([
    'disarm',
    'steal',
  ]);
  for (const situations of [['disarm'], ['steal'], ['disarm', 'steal']])
    expect(resolveSheet(pillager, { situations }).cmb.total).toBe(1);
  // Faith Unshakable's charm, compulsion and fear condition is one local
  // Situation, so the shared fear Situation leaves it out.
  expect(
    resolveSheet(modifiers('Faith Unshakable and Unassailable'), {
      situations: ['fear'],
    })['save.will'].total,
  ).toBe(0);
  // Foundry files these notes on attack rolls; the reviewed bonuses are on
  // damage (Exhibition Fighter: attack and damage).
  expect(
    modifiers('Superior Clutch (Tiefling; Hungerseed)').map(
      (row) => row.target,
    ),
  ).toEqual(['damage']);
  expect(
    modifiers('Exhibition Fighter (Lung Wa)').map((row) => row.target),
  ).toEqual(['attack', 'damage']);
  // Agent of the Sultana's attack bonus is only on confirmation rolls.
  expect(
    modifiers('Agent of the Sultana (Plane of Earth)')[
      indexOf('Agent of the Sultana (Plane of Earth)', 'attack', 'fire subtype')
    ]?.condition?.situation,
  ).toEqual({
    local: 'to confirm critical hits against creatures with the fire subtype',
  });
  // Ecumenical's Foundry notes swap the two conditions; the reviewed
  // Modifiers follow the body.
  expect(
    modifiers('Ecumenical').map((row) => [
      row.target,
      JSON.stringify(row.condition?.situation),
    ]),
  ).toEqual([
    ['skill.dip', expect.stringContaining('to influence worshipers')],
    ['skill.kre', expect.stringContaining('involving entities')],
  ]);
  // Untyped bonuses stay untyped; Erutaki Sky Reader's is a luck bonus and
  // Rising Star's daily bonus a circumstance bonus.
  for (const name of [
    'Snake Handler (Osirion; Apep or Wadjet)',
    'Anuli Engineer (Anuli)',
    'Smuggler (The Exchange)',
    'Scion of the Shory (Mwangi Expanse)',
    'Exhibition Fighter (Lung Wa)',
    'Persecuted Expatriate (Tiefling)',
    'Loyal Bond (Grundinnar)',
    'Gifted Adept',
    'Strict Judgment (Kols)',
    "Balancer's Banishing",
  ])
    expect(new Set(modifiers(name).map((row) => row.bonusType)), name).toEqual(
      new Set(['untyped']),
    );
  expect(
    modifiers('Erutaki Sky Reader (Crown of the World)').map((row) => [
      row.target,
      row.bonusType,
      row.value,
    ]),
  ).toEqual([['saves', 'luck', 2]]);
  expect(
    modifiers('Rising Star (War for the Crown)')
      .filter((row) => row.bonusType === 'circumstance')
      .map((row) => row.target),
  ).toEqual(['skill.blf', 'skill.dip', 'skill.int']);
  for (const [name, target] of [
    ['Strict Judgment (Kols)', 'spellDC'],
    ["Balancer's Banishing", 'spellDC'],
    ['Loyal Bond (Grundinnar)', 'casterLevel'],
  ] as const) {
    expect(resolveSheet(modifiers(name))[target].total, name).toBe(0);
    expect(
      resolveSheet(modifiers(name), { situations: [situation(name, 0)] })[
        target
      ].total,
      name,
    ).toBe(1);
  }
  // Veteran of Battle's imported initiative change stays untyped, a listed
  // typing gap (the body grants a trait bonus).
  expect(
    modifiers('Veteran of Battle (Gorum)').map((row) => [
      row.target,
      row.bonusType,
      row.value,
    ]),
  ).toEqual([['init', 'untyped', 1]]);
  expect(
    candidate('Veteran of Battle (Gorum)').mechanicsReview
      .outstandingCalculations[0],
  ).toContain('untyped bonus type');
  // The drawbacks' penalties wait for their Situations; Lovesick's two
  // penalties share one Situation.
  const lovesick = 'Lovesick';
  const calm = resolveSheet(modifiers(lovesick));
  expect([calm.init.total, calm['skill.per'].total]).toEqual([0, 0]);
  const away = resolveSheet(modifiers(lovesick), {
    situations: [situation(lovesick, 0)],
  });
  expect([away.init.total, away['skill.per'].total]).toEqual([-2, -2]);
  const doubting = 'Self-Doubting';
  expect(resolveSheet(modifiers(doubting))['save.will'].total).toBe(0);
  expect(
    resolveSheet(modifiers(doubting), {
      situations: [situation(doubting, indexOf(doubting, 'save.will', 'Will'))],
    })['save.will'].total,
  ).toBe(-2);
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
  expect(required).toBe(92);
  // Explicit covered/no-output records: each repeats a rule another record
  // of the entry carries as an entry-level Note.
  expect(
    heldTraits.flatMap((row) =>
      row.mechanicsReview.curationRecords
        .filter((record) => !record.outputs.length)
        .map((record) => `${row.name} ${record.target}`),
    ),
  ).toEqual([
    'Inspired skills',
    'Flounderer (Zogmugot) skill.swm',
    'Self-Actualization skills',
    'Nervous skills',
    'Dog-Sniff-Hate (Goblin) skill.sur',
  ]);
  // Soul Eater's Note follows the body's minimum of 1, not Foundry's cap.
  expect(
    entry('Soul Eater (Tiefling; Grimspawn)').situationalNotes?.[0]?.text,
  ).toContain('half your character level (minimum 1)');
  // Every outstanding calculation is recorded, never as an attribution hold.
  for (const row of heldTraits)
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  expect(
    heldTraits
      .filter((row) => !row.mechanicsReview.outstandingCalculations.length)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Bred for War (Human; Shoanti)',
    'Chivalrous (Taldor)',
    'Indomitable Faith',
    'Jungle Diplomat (Valashmai Jungle)',
  ]);
  // The proficiency grants stay outstanding: traits map no proficiency.
  for (const name of [
    'Varisian Tattoo (Human; Varisian)',
    'Regional Recluse - Ilsurian (Varisia)',
  ]) {
    expect(entry(name).proficiencies ?? [], name).toEqual([]);
    expect(
      candidate(name).mechanicsReview.proficiencyReview.outstandingFacts,
      name,
    ).toHaveLength(1);
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
      `traits-376-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `traits-376-notice-${book}-complete-chain`),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    heldTraits
      .filter((row) => row.traitType === 'drawback')
      .map((row) => row.name)
      .sort(),
  ).toEqual(['Lovesick', 'Nervous', 'Self-Doubting']);
  // Inherited rules from other books: ferocity and scent (Bestiary), the
  // Familiar Bond feat (Familiar Folio), the skinwalker change shape (Bestiary
  // 5), the APG steal and dirty trick maneuvers, and the Bleaching in the
  // trait's own book.
  for (const [name, book] of [
    ['Rage of Storms (Half-Orc, Orc)', 'PZO1112'],
    ['Dog-Sniff-Hate (Goblin)', 'PZO1112'],
    ['House of Green Mothers Pupil', 'PZO9454'],
    ['Rat Squeeze (Skinwalker; Wererat-Kin)', 'PZO1133'],
    ['Pillager', 'PZO1115'],
    ['Dirty Trickster', 'PZO1131'],
    ['Zealot (Gnome)', 'PZO9411'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  for (const [name, path] of [
    [
      'Rage of Storms (Half-Orc, Orc)',
      'universal-monster-rules-umr.nBnUY0koBzXqoEft.yaml#L1186',
    ],
    [
      'Dog-Sniff-Hate (Goblin)',
      'monster-abilities/scent.ePCw9eVAidI9uc5I.yaml',
    ],
    ['House of Green Mothers Pupil', 'familiar_folio/ff_feats.lst#L7'],
    ['Zealot (Gnome)', 'gnomes_of_golarion/gnog_abilities.lst#L11'],
    ['Pillager', 'apg_feats.lst#L118'],
  ] as const)
    expect(
      candidate(name).inheritedRuleNotices.some((notice) =>
        notice.location.endsWith(path),
      ),
      `${name} ${path}`,
    ).toBe(true);
  // Unchained action-cost metadata anywhere in the bound closure, the
  // trait's own actions included, requires the held PZO1131. Dirty Trickster
  // also requires it as a book of its linked Improved Dirty Trick feat.
  const unchained = [...new Set([...unchainedOwn, ...unchainedLinked])].sort();
  expect(unchained).toHaveLength(18);
  expect(
    heldTraits
      .filter((row) => row.requiredNotices.includes('PZO1131'))
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual([...unchained, 'pf1-content/S6R3LkkK8bwalHLD'].sort());
  expect(
    candidate('Dirty Trickster').inheritedRuleNotices.map((row) => row.book),
  ).not.toContain('PZO1131');
  const bodies = new Map(
    [...preview.entries, ...preview.closure].map((row) => [
      row.externalKey,
      row,
    ]),
  );
  for (const key of unchained) {
    const row = heldTraits.find((row) => row.externalKey === key)!;
    expect(row.noticeHoldIds, row.name).toContain(
      'traits-376-notice-PZO1131-complete-chain',
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
    ['Artifact Hunter (Giantslayer)', 'PZO9414'],
    ['Trickster (Vanara)', 'PZO9411'],
    ['Stargazer (Lirgen)', 'PZO9000-15E'],
    ['Stargazer (Lirgen)', 'PZO9417'],
    ['Stargazer (Lirgen)', 'PZO9448'],
    ['Secret-Keeper (Svirfneblin)', 'PZO9433'],
  ] as const)
    expect(candidate(name).requiredNotices, name).not.toContain(book);
  // Outcast cites no source; its book comes from its APG row.
  expect(candidate('Outcast (Half-Orc)').citedSources).toEqual([]);
  expect(candidate('Outcast (Half-Orc)').requiredNotices).toEqual([
    'PZO1115',
    'PZO1110',
  ]);
  expect(
    heldTraits
      .flatMap((row) => row.linkedContentReview.map((linked) => linked.name))
      .sort(),
  ).toEqual([
    'Cold-weather outfit',
    'Compass',
    'Cure Light Wounds',
    'Fly',
    'Geas/Quest',
    'Gust of Wind',
    'Improved Dirty Trick',
    'Levitate',
    'Mark of Justice',
    'Message',
    'Overland Flight',
    'Regional Recluse - Arsmeril or Crying Leaf (Varisia)',
    'Regional Recluse - Sanos Forest or Whistledown (Varisia)',
    'Regional Recluse - Turtleback Ferry (Varisia)',
    'Regional Recluse - Urglin (Varisia)',
  ]);
  // The closures also reach Combat Expertise (through Improved Dirty Trick)
  // and Geas, Lesser (through Geas/Quest).
  expect(preview.closure.map((row) => row.externalKey).sort()).toEqual([
    'pf1-content/BDByEeeSK08bn8gp',
    'pf1-content/EtUNYMr9ykH2XhZA',
    'pf1-content/QezjzIjvbfIxTLPD',
    'pf1-content/qDxSXompaz69Ceqj',
    'pf1/3jaumkutti1ytulq',
    'pf1/7d6sv5ecvi7kho3m',
    'pf1/LUOETW7Fm0oPKKWj',
    'pf1/NFxHebU1XhEs5WJh',
    'pf1/RfQvOISVKf3WU8Nl',
    'pf1/cnuin981hdq7ryit',
    'pf1/hhprblxrbmqvoine',
    'pf1/msaqovkgfxi6q8s8',
    'pf1/ofw6gnp6r7t2wcba',
    'pf1/pfv5zv744x9dwg38',
    'pf1/plou8h168bfn5hq6',
    'pf1/wqvy12w1xgk6l9b0',
    'pf1/xoc3vhg3btmfjauq',
  ]);
  for (const name of noRow) {
    expect(candidate(name).comparison, name).toBeNull();
    expect(candidate(name).additionalComparisonLeads, name).toEqual([]);
    expect(candidate(name).inheritedRuleUnresolvedOrigins[0], name).toContain(
      'no PCGen row at the pin',
    );
  }
  // Skeptic has only its APG row, a printing the pinned record doesn't cite.
  expect(candidate('Skeptic').comparison).toBeNull();
  expect(
    candidate('Skeptic').additionalComparisonLeads.map((row) => row.book),
  ).toEqual(['PZO1115']);
  expect(heldTraits.filter((row) => !row.comparison)).toHaveLength(
    noRow.length + 1,
  );
  for (const [name, origin] of [
    ['Broken Mind (Groetus)', 'madness effects'],
    ['Rage of Storms (Half-Orc, Orc)', 'itiLDlB5BHlUB8os'],
    ['Dog-Sniff-Hate (Goblin)', 'j0idsqgoSZLLNDH2'],
  ] as const)
    expect(candidate(name).inheritedRuleUnresolvedOrigins, name).toEqual([
      expect.stringContaining(origin),
    ]);
  expect(
    candidate('Sacred Orienteer (Elion)').inheritedRuleUnresolvedOrigins,
  ).toEqual([
    expect.stringContaining('no PCGen row at the pin'),
    expect.stringContaining('wayfinder'),
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
      batch: 'traits-376',
      candidate: candidate(name),
    });
  // Two races read as both required, an alternative that loses its region,
  // and a prose Requirements line read as four requirements (#739).
  for (const [name, mapped] of [
    ['Rage of Storms (Half-Orc, Orc)', ['anyOf']],
    ['Near-Death Experience (Belkzen)', ['unchecked']],
    [
      "Child of Kintargo (Hell's Rebels)",
      ['unchecked', 'unchecked', 'unchecked', 'unchecked', 'unchecked'],
    ],
  ] as const) {
    expect(kinds(name), name).toEqual(mapped);
    expect(facts(name), name).toEqual(
      expect.arrayContaining([expect.stringContaining('#739')]),
    );
  }
  // A requirement on the line after its label, without a colon, maps
  // nothing (#739).
  expect(kinds('Regional Recluse - Ilsurian (Varisia)')).toBeUndefined();
  expect(facts('Regional Recluse - Ilsurian (Varisia)')).toEqual([
    expect.stringContaining('#739'),
  ]);
  expect(kinds('Flounderer (Zogmugot)')).toEqual(['race', 'unchecked']);
  expect(kinds('Purity of Faith (Iomedae)')).toEqual(['deity']);
  for (const [name, gap] of [
    ['Unnatural Presence (Old Cults)', 'no faction fact exists'],
    [
      'Voice of Velvet (Human; Vudrani)',
      'no heritage or ethnicity fact exists',
    ],
    ['Illuminator (Sarenrae)', 'no deity fact exists'],
    ['Honeyed Tongue (Amanandar)', 'no region fact exists'],
    ['Bred for War (Human; Shoanti)', 'no height fact exists'],
    ['Water-Trained (Lastwall Jasper)', 'no mount fact exists'],
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
  // No folder record is in this batch.
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
  // Indomitable Faith's body equals its Ultimate Campaign row's benefit.
  expect(candidate('Indomitable Faith').comparison?.literalRow).toContain(
    'BONUS:SAVE|Will|1|TYPE=Trait',
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
      required: 92,
      checked: 92,
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
    // Rage of Storms links a record of the unassigned universal monster rules
    // pack and Dog-Sniff-Hate a scent record absent from the pinned pack; the
    // importer strips both links and the gate reports the entries before
    // their holds apply.
    expect(
      gate.failures
        .filter((row) => ours.has(row.externalKey))
        .sort((a, b) => a.externalKey.localeCompare(b.externalKey)),
    ).toEqual(
      ['pf1-content/SHyplBquu7Tui8aw', 'pf1-content/UfD2XgrPjPBDo0gF'].map(
        (externalKey) => ({
          externalKey,
          reason:
            'Broken structure or reference: unresolved imported reference.',
        }),
      ),
    );
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
    const faith = candidate('Indomitable Faith');
    expect(faith.requiredNotices).toEqual([
      'PZO1125',
      'PZO9401',
      'PZO1115',
      'PZO1110',
    ]);
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
