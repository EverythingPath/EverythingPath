// @vitest-environment node
import { recordedPrerequisiteFacts } from './prerequisite-audit-739';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
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
} from '../fixtures/traits-384/data';
import { reviewedTraitSheet } from '../fixtures/traits-384/sheet';
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
  'Mechanical Aptitude',
  "Angradd's Flame (Angradd)",
  'Empyreal Pantheon',
  'Explorer (Andoran Faction)',
  'Windspeaker (Desert)',
  'Childhood Crush (Jade Regent)',
  "Hunter's Eye (Andoran Faction)",
  'Force for Good (Silver Crusade)',
  'Bitter',
  'Pack Savvy',
  'Technological Brewmaster (Numeria)',
  'Attuned to the Ancestors (Scarab Sages)',
  "Audrahni's Ally (Return of the Runelords)",
  'Desert Shadow (Qadira Faction)',
  'The Mother',
  'Poisoned Blade Resistance (River Kingdoms)',
  'Arcane Archivist (Dark Archive)',
  'Sophisticated Citizen (Absalom)',
  'Meridian Strike (Lantern Lodge)',
  'Accidental Clone (Return of the Runelords)',
  'The Star Gazer',
];

// Every trait whose bound content closure keeps Unchained action-cost
// metadata (owner ruling, 2026-10-17): 15 on the trait's own action and 4
// through linked bodies, 1 of them both ways.
const unchainedOwn = [
  'pf1-content/qHulLMFoibYb4MOW', // Mechanical Aptitude
  'pf1-content/qSelUT1I8XijIAVx', // Foul Belch
  'pf1-content/qwcJ9druR1lIM0t4', // Broken, Not Beaten
  'pf1-content/rEOnn4Gz04sN6a6T', // Childhood Crush
  'pf1-content/rJUg5FvT7ghf9RsK', // Disciplined Body
  'pf1-content/rRY68kbcEj5tqVqe', // Blood Resonance
  'pf1-content/rl9WFgFkv0KceiSd', // Advantageous Distraction
  'pf1-content/rv6YgZ0UkR4N1Gwl', // Attuned to the Ancestors
  'pf1-content/rw9a3EK6h62WVIo5', // Audrahni's Ally
  'pf1-content/s6xOYA9quzGoUThQ', // Arcane Revitalization
  'pf1-content/sOr4h4De6aaiDw8z', // Set Mind
  'pf1-content/t1bX3tDIuB34M2NL', // Meridian Strike
  'pf1-content/t2KYxMzNxZBmzu2L', // Accidental Clone
  'pf1-content/t79M5Jk8Gk5LGEzb', // Grim Optimism
  'pf1-content/tJKiz80YYgojxJOS', // Fangwood Insurgent
];
const unchainedLinked = [
  'pf1-content/rGa9Dxdh3qDCE6JK', // Hunter's Eye: longbow and shortbow
  'pf1-content/rw9a3EK6h62WVIo5', // Audrahni's Ally: three spells (and Cure Light Wounds two links away)
  'pf1-content/sdBzU71pPH68dwWg', // Scholar of the Analects: read magic
  'pf1-content/t9BjJ7foMQK7nmv8', // Lantern Spirit: continual flame
];

const saves = (resolved: ReturnType<typeof resolveSheet>) => [
  resolved['save.fort'].total,
  resolved['save.ref'].total,
  resolved['save.will'].total,
];

it('resolves the reviewed trait Modifiers, with trait bonuses that never stack', () => {
  // Trait bonuses from different traits on one statistic never stack.
  const hotspur = 'Absalom Hotspur (Absalom)';
  const reactionary = 'Reactionary';
  expect(total(reviewedTraitSheet(hotspur), 'init')).toBe(1);
  expect(total(reviewedTraitSheet(reactionary), 'init')).toBe(2);
  expect(total(reviewedTraitSheet(hotspur, reactionary), 'init')).toBe(2);
  expect(total(reviewedTraitSheet(hotspur, reactionary), 'skill.klo')).toBe(1);
  // Anxious's imported -2 on Diplomacy always applies.
  expect(total(reviewedTraitSheet('Anxious'), 'skill.dip')).toBe(-2);
  // Records with no change, or a targetless one, get reviewed Modifiers:
  // unconditional where the sheet has one skill for the choice, a Situation
  // per option otherwise.
  for (const [name, target, value, conditional] of [
    ["Merchant's Child (Katapesh)", 'skill.apr', 1, false],
    ['Indentured Blacksmith (Kaoling)', 'skill.crf', 1, false],
    ['Goblin Pirate (Goblin; The Shackles)', 'skill.pro', 1, false],
    ["Buccaneer's Blood (Skull and Shackles)", 'skill.pro', 1, false],
    ['Savanna Child (Plains)', 'skill.kna', 1, true],
    ["Audrahni's Ally (Return of the Runelords)", 'save.will', 1, true],
    ['Deathtouched (Any)', 'save.fort', 1, true],
  ] as const) {
    const index = modifiers(name).findIndex(
      (row) => row.target === target && row.value === value,
    );
    expect(index, name).toBeGreaterThanOrEqual(0);
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
  for (const name of [
    'Savanna Child (Plains)',
    'Indentured Blacksmith (Kaoling)',
    'Goblin Pirate (Goblin; The Shackles)',
    "Audrahni's Ally (Return of the Runelords)",
    'Deathtouched (Any)',
  ])
    expect(entry(name).unsupported, name).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
    );
  expect(
    total(reviewedTraitSheet("Merchant's Child (Katapesh)"), 'skill.apr'),
  ).toBe(1);
  expect(total(reviewedTraitSheet('Savanna Child (Plains)'), 'skill.han')).toBe(
    0,
  );
  // Choices are one Situation per option.
  for (const [name, count] of [
    ['Savanna Child (Plains)', 3],
    ["Audrahni's Ally (Return of the Runelords)", 3],
    ['Deathtouched (Any)', 2],
  ] as const)
    expect(modifiers(name), name).toHaveLength(count);
  const audrahni = "Audrahni's Ally (Return of the Runelords)";
  expect(
    saves(
      resolveSheet(modifiers(audrahni), {
        situations: [
          situation(
            audrahni,
            indexOf(audrahni, 'save.ref', 'Where did you grow up'),
          ),
        ],
      }),
    ),
  ).toEqual([0, 1, 0]);
  // Deathtouched's mind-affecting choice covers every save.
  const deathtouched = 'Deathtouched (Any)';
  expect(
    saves(
      resolveSheet(modifiers(deathtouched), {
        situations: [
          situation(
            deathtouched,
            indexOf(deathtouched, 'saves', 'mind-affecting'),
          ),
        ],
      }),
    ),
  ).toEqual([2, 2, 2]);
  // A bonus that rises in a Situation is its new total.
  const heretic = "Heretic's Caution";
  expect(resolveSheet(modifiers(heretic))['skill.blf'].total).toBe(1);
  expect(
    resolveSheet(modifiers(heretic), {
      situations: [
        situation(
          heretic,
          indexOf(heretic, 'skill.blf', 'religious authorities'),
        ),
      ],
    })['skill.blf'].total,
  ).toBe(3);
  // Orc Impaler's +3 against orcs is the new total of its +2 on a charge.
  const impaler = 'Orc Impaler (Lastwall; Knight of Ozem)';
  const confirm = (indexes: number[]) =>
    resolveSheet(modifiers(impaler), {
      situations: indexes.map((index) => situation(impaler, index)),
    })['attack.melee'].total;
  expect(confirm([])).toBe(0);
  expect(confirm([indexOf(impaler, 'attack', 'charge')])).toBe(2);
  expect(confirm([0, 1])).toBe(3);
  // Untyped and other published bonus types keep their type.
  for (const [name, typed] of [
    ['Ruin Raider (Shattered Star)', ['skill.apr trait', 'skill.per untyped']],
    ['The Star Gazer', ['init untyped', 'ac luck']],
    ['Grim Optimism', ['saves morale']],
    ['Innocent (Aasimar)', ['skill.blf untyped']],
    ["Angradd's Flame (Angradd)", ['damage untyped']],
    ['Force for Good (Silver Crusade)', ['casterLevel untyped']],
    ['Evasive Sting', ['ac dodge']],
    ['Advantageous Distraction (Goblin)', ['ac dodge']],
    ['Cruelty', ['attack untyped']],
    ["Fed-Up Citizen (Hell's Rebels)", ['skill.dis untyped', 'saves trait']],
  ] as const)
    expect(
      modifiers(name).map((row) => `${row.target} ${row.bonusType}`),
      name,
    ).toEqual(typed);
  // Noble Born - Lodovka's imported Swim change stays untyped (a listed gap).
  expect(modifiers('Noble Born - Lodovka (Kingmaker)')).toEqual([
    expect.objectContaining({
      target: 'skill.swm',
      bonusType: 'untyped',
      value: 1,
    }),
  ]);
  // Shared Situations where the body's condition matches exactly.
  for (const [name, key] of [
    ['Greater Purpose', 'death'],
    ['Good-Natured (Cayden Cailean)', 'fear'],
    ["Fed-Up Citizen (Hell's Rebels)", 'mindAffecting'],
    ['Fangwood Insurgent (Nirmathas)', 'forests'],
  ] as const)
    expect(
      modifiers(name).filter((row) => row.condition?.situation === key),
      name,
    ).toHaveLength(1);
  expect(
    saves(
      resolveSheet(modifiers('Good-Natured (Cayden Cailean)'), {
        situations: ['fear'],
      }),
    ),
  ).toEqual([2, 2, 2]);
  expect(
    resolveSheet(modifiers('Fangwood Insurgent (Nirmathas)'), {
      situations: ['forests'],
    }).init.total,
  ).toBe(1);
  // Black Powder Fortune's fear bonus also needs a firearm: a local Situation.
  expect(
    modifiers('Black Powder Fortune').map((row) => row.condition?.situation),
  ).toEqual([
    {
      local:
        'against curse, fear, and emotion effects, while you wield a firearm',
    },
  ]);
  // Siege Defender's bonus is on melee damage, not attack rolls.
  const siege = 'Siege Defender';
  expect(modifiers(siege).map((row) => row.target)).toEqual(['damage.melee']);
  expect(
    resolveSheet(modifiers(siege), { situations: [situation(siege, 0)] })[
      'damage.melee'
    ].total,
  ).toBe(1);
  // Pack Savvy's +3 applies to every Charisma-based skill under one Situation.
  const pack = 'Pack Savvy';
  const gnolls = resolveSheet(modifiers(pack), {
    situations: [situation(pack, 0)],
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
    expect(gnolls[target].total, target).toBe(3);
  // The Star Gazer's surprise-round penalty is a Situation.
  const gazer = 'The Star Gazer';
  expect(resolveSheet(modifiers(gazer)).init.total).toBe(0);
  expect(
    resolveSheet(modifiers(gazer), {
      situations: [situation(gazer, indexOf(gazer, 'init', 'surprise'))],
    }).init.total,
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
  expect(required).toBe(88);
  // Repeated notes another record already carries are the explicit
  // covered/no-output records.
  expect(
    heldTraits.flatMap((row) =>
      row.mechanicsReview.curationRecords
        .filter((record) => !record.outputs.length)
        .map((record) => `${row.name} ${record.target}`),
    ),
  ).toEqual([
    'Pearl Diver (Half-Elf) skill.swm',
    'Disciplined Body (Human; Vudrani) dexChecks',
    'Disciplined Body (Human; Vudrani) dexSkills',
    'Disciplined Body (Human; Vudrani) strSkills',
    'Persuasive Insight wisChecks',
  ]);
  // Well-Provisioned Adventurer's long body is split on line boundaries.
  const provisioned = candidate('Well-Provisioned Adventurer').mechanicsReview
    .curationRecords[0]!.outputs;
  expect(provisioned.length).toBeGreaterThan(1);
  // Notes the drafter put on unrelated statistics are entry-level.
  for (const name of [
    'Mechanical Aptitude',
    'Air-Touched',
    'Storm-Touched',
    'Broken, Not Beaten',
    'Pearl Diver (Half-Elf)',
    'Plague Survivor (Human)',
    'Greater Purpose',
  ])
    expect(
      entry(name)
        .situationalNotes?.filter((note) => note.target)
        .map((note) => note.target),
      name,
    ).toEqual([]);
  // Retargeted readable Notes.
  for (const [name, targets] of [
    ['Meridian Strike (Lantern Lodge)', ['damage']],
    ['Set Mind (Ruins of Azlant)', ['saves']],
    ['Accidental Clone (Return of the Runelords)', ['saves']],
    ['Disciplined Body (Human; Vudrani)', ['cmb', 'save.ref']],
    ['Persuasive Insight', ['skill.dip']],
  ] as const)
    expect(
      entry(name)
        .situationalNotes?.filter((note) => note.target)
        .map((note) => note.target)
        .sort(),
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
  // Hunter's Eye's bow proficiency is a proficiency fact left readable.
  expect(
    candidate("Hunter's Eye (Andoran Faction)").mechanicsReview
      .proficiencyReview.outstandingFacts,
  ).toEqual([expect.stringContaining('longbow or shortbow')]);
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
      `traits-384-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `traits-384-notice-${book}-complete-chain`),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    heldTraits
      .filter((row) => row.traitType === 'drawback')
      .map((row) => row.name),
  ).toEqual(['Bitter', 'Cruelty', 'Anxious']);
  // Rootless records take their book from the PCGen comparison; Childhood
  // Crush has neither a source nor a row, so its root origin stays held.
  expect(candidate('Black Powder Fortune').citedSources).toEqual([]);
  expect(candidate('Black Powder Fortune').comparison?.book).toBe('PZO1125');
  expect(candidate('Black Powder Fortune').requiredNotices).toContain(
    'PZO1125',
  );
  const crush = candidate('Childhood Crush (Jade Regent)');
  expect(crush.citedSources).toEqual([]);
  expect(crush.requiredNotices).toEqual(['PZO1115', 'PZO1131', 'PZO1110']);
  expect(crush.inheritedRuleUnresolvedOrigins[0]).toContain(
    'no PCGen row at the pin',
  );
  // Inherited rules the bodies change, restate or depend on.
  for (const [name, book] of [
    ['Well-Provisioned Adventurer', 'PZO9492'],
    ["Buccaneer's Blood (Skull and Shackles)", 'PZO9055'],
    ['Blood Resonance', 'PZO1112'],
    ['Persuasive Insight', 'PZO1134'],
    ['Arcane Revitalization', 'PZO1117'],
    ['Lantern Spirit (Aasimar; Lawbringers)', 'PZO9280'],
    ["Hunter's Eye (Andoran Faction)", 'PZO9452'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Class features name the pinned class record's literal line.
  for (const [name, suffix] of [
    ['Arcane Revitalization', 'magus.xZLcyrEKYZoJPS2k.yaml#L104'],
    ['Twinned Presence', 'summoner.BrnHPJ2EVSQSyNQ8.yaml#L97'],
  ] as const)
    expect(
      candidate(name).inheritedRuleNotices.some((notice) =>
        notice.location.endsWith(suffix),
      ),
      name,
    ).toBe(true);
  // Unresolved origins stay named, never guessed.
  for (const [name, text] of [
    ['Black Powder Fortune', 'curse descriptor'],
    ['Black Powder Fortune', 'emotion descriptor'],
    ['Defy Madness (Old Cults)', 'madness effects'],
    ['Grim Optimism', 'pain descriptor'],
    ['Well-Provisioned Adventurer', 'several books'],
  ] as const)
    expect(
      candidate(name).inheritedRuleUnresolvedOrigins.join(' '),
      name,
    ).toContain(text);
  // Unchained action-cost metadata anywhere in the bound closure, the
  // trait's own actions included, requires the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedLinked])].sort();
  expect(unchained).toHaveLength(18);
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
      'traits-384-notice-PZO1131-complete-chain',
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
    ['Explorer (Andoran Faction)', 'PZO9411'],
    ['Pearl Diver (Half-Elf)', 'PZO9421'],
    ['Cosmopolitan (Goka)', 'PZO9414'],
    ['Wary (Daggermark)', 'PZO9424'],
    ['The Mother', 'PZO9474'],
  ] as const)
    expect(candidate(name).requiredNotices, name).not.toContain(book);
  const linkedNames = heldTraits.flatMap((row) =>
    row.linkedContentReview.map((linked) => linked.name),
  );
  expect(linkedNames).toHaveLength(13);
  expect(new Set(linkedNames).size).toBe(13);
  // The closure holds the linked bodies and two bodies two links away:
  // Cure Light Wounds (through Cure Moderate Wounds) and the Combat Expertise
  // feat (through its buff).
  expect(preview.closure.map((row) => row.externalKey).sort()).toEqual(
    [
      ...new Set([
        ...heldTraits.flatMap((row) =>
          row.linkedContentReview.map((linked) => linked.externalKey),
        ),
        'pf1/xoc3vhg3btmfjauq',
        'pf1/NFxHebU1XhEs5WJh',
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
      batch: 'traits-384',
      candidate: candidate(name),
    });
  // The original conjunction finding is retained beside the repaired choices.
  expect(kinds('Dirty Fighter (Half-Orc, Orc)')).toEqual(['anyOf']);
  expect(facts('Dirty Fighter (Half-Orc, Orc)')).toEqual(
    expect.arrayContaining([expect.stringContaining('#739')]),
  );
  // Accidental Clone's Requirements sentence is split into two unchecked atoms.
  expect(kinds('Accidental Clone (Return of the Runelords)')).toEqual([
    'unchecked',
    'unchecked',
    'unchecked',
  ]);
  expect(kinds('Tundra Child (Tundra, Cold Regions)')).toEqual(['unchecked']);
  expect(kinds('Goblin Pirate (Goblin; The Shackles)')).toEqual([
    'race',
    'unchecked',
  ]);
  for (const [name, gap] of [
    ['Explorer (Andoran Faction)', 'no faction fact exists'],
    [
      'Disciplined Body (Human; Vudrani)',
      'no heritage or ethnicity fact exists',
    ],
    ['Scaly Ally (Apsu)', 'no deity fact exists'],
    ['Absalom Hotspur (Absalom)', 'no region fact exists'],
    ['The Mother', 'no birth-date fact exists'],
    ['Black as Night (Fell Pony)', 'no mount fact exists'],
    ['Accidental Clone (Return of the Runelords)', 'no ethnicity fact exists'],
  ] as const)
    expect(facts(name), name).toEqual(
      expect.arrayContaining([expect.stringContaining(gap)]),
    );
  for (const row of heldTraits)
    expect(row.mechanicsReview.prerequisiteReview.normalizedAtoms).toEqual(
      entry(row.name).prerequisites ?? [],
    );
});

it('re-binds the landed assessments whose content closures cover Noble Born - Lodovka', () => {
  // Their fixtures' copies of Lodovka are this batch's curated entry.
  const lodovka = preview.entries.find(
    (row) => row.externalKey === 'pf1-content/stEGVAsBCoaY5Ifk',
  );
  expect(lodovka).toBeDefined();
  for (const batch of ['369', '370', '379'] as const) {
    const fixture = JSON.parse(
      readFileSync(`tests/fixtures/traits-${batch}/preview.json`, 'utf8'),
    ) as { closure: { externalKey: string }[] };
    expect(
      fixture.closure.find((row) => row.externalKey === lodovka!.externalKey),
      batch,
    ).toEqual(lodovka);
  }
  // Lodovka links all five other versions of the trait.
  expect(
    candidate('Noble Born - Lodovka (Kingmaker)')
      .linkedContentReview.map((linked) => linked.name)
      .sort(),
  ).toEqual([
    'Noble Born - Garress (Kingmaker)',
    'Noble Born - Lebeda (Kingmaker)',
    'Noble Born - Medvyed (Kingmaker)',
    'Noble Born - Orlovsky (Kingmaker)',
    'Noble Born - Surtova (Kingmaker)',
  ]);
});

it('pins all 100 keys, the complete bodies, checked bindings and literal PCGen evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toEqual({
    total: 100,
    admitted: 0,
    held: 98,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 2,
    recordLevel35Holds: 0,
  });
  // The two folders are excluded by the importer's folder contract.
  expect(folders.map((row) => [row.externalKey, row.name, row.rawKey])).toEqual(
    [
      [
        'pf1-content/qFbWInuNDuv3JE0T',
        'Basic (Magic)',
        '!folders!qFbWInuNDuv3JE0T',
      ],
      [
        'pf1-content/rasdJf3aELQxqSwG',
        'Basic (Combat)',
        '!folders!rasdJf3aELQxqSwG',
      ],
    ],
  );
  expect(preview.entries).toHaveLength(98);
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
  // Deathtouched's row encodes the choice as an ability pool, and Savanna
  // Child's as a skill choice.
  expect(candidate('Deathtouched (Any)').comparison?.literalRow).toContain(
    'BONUS:ABILITYPOOL|Deathtouched Choice|1',
  );
  expect(candidate('Savanna Child (Plains)').comparison?.literalRow).toContain(
    'CHOOSE:NUMCHOICES=1|SKILL|Handle Animal|Knowledge (Nature)|Ride',
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
      required: 88,
      checked: 88,
      missing: 0,
      descriptions: { candidates: 98, checked: 98 },
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
    // Every link resolves in the full corpus: no gate failure.
    expect(gate.failures.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
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
    const orphan = candidate('Absalom Hotspur (Absalom)');
    expect(orphan.requiredNotices).toEqual(['PZO9414', 'PZO1115', 'PZO1110']);
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
