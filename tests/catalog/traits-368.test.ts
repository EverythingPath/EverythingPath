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
} from '../fixtures/traits-368/data';
import { reviewedTraitSheet } from '../fixtures/traits-368/sheet';
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
const noRow = [
  'Radiant Healer',
  'Sharp Eyes (Tundra)',
  'Venom Resistance',
  "The Snoop (Tyrant's Grasp)",
  'Acclimatize Alignment',
  'Curator of Mystic Secrets',
  'Artist of Battle in All Forms',
  'Lucky Hound (Riding dog)',
  'The Daughter',
  'Aid Allies (Shadow Lodge)',
  'Impatient',
  'Clockwork Engineer',
  'Spirit Touched (Return of the Runelords)',
  "Brigh's Insight (Brigh)",
  'Planar Escapee',
];

// Every trait whose bound content closure keeps Unchained action-cost
// metadata (owner ruling, 2026-10-17): 21 on the trait's own action, one of
// them (Transmuter of Korada) also through its six linked spells, and three
// only through a linked body (Light, the whip and speak with animals).
const unchainedOwn = [
  'pf1-content/3D3H4PR2ONlGWJqh', // Amiable Blunder
  'pf1-content/3DbKvx4fXaViSw3I', // Denial of Fate
  'pf1-content/3KfxPuCng3T76xSj', // Numerian Fluid Indulger
  'pf1-content/3PdHIZjMCngKWogv', // Venom Resistance
  'pf1-content/3bnWn3no2AKMTcyn', // The Snoop
  'pf1-content/3c2pm8JMzgRRjvem', // Living Bulwark
  'pf1-content/3mQcqTbupi5Qjsqk', // Empyreal Focus
  'pf1-content/3ryjl46Ui9o1uqvR', // Curator of Mystic Secrets
  'pf1-content/3wlB6o57m3XQX5fu', // Transmuter of Korada (also its spells)
  'pf1-content/4j533NmMcg6WEbYx', // Jadwiga Medicine
  'pf1-content/4lfTLUDjiOP2pNd9', // Barroom Talespinner
  'pf1-content/4oSRfzqpZZthFqVF', // Restless Hunger
  'pf1-content/4zLvShDcyER9hjHs', // Lessons of Chaldira
  'pf1-content/55VbucpexWzN4fls', // Varki Landspeaker
  'pf1-content/59Pe0EdxVa9qot3r', // Burst of Speed
  'pf1-content/5CVbmveEXRxCxw4Q', // Irritable Diplomat
  'pf1-content/5DOrFbMiBaDPVaHB', // Linked Surge
  'pf1-content/5Kbr9asW5CjJ70xF', // Omen
  'pf1-content/5d6YUNTd47cocJLF', // Spirit Touched
  'pf1-content/5mWlOYYjQpvJcPNW', // Planar Escapee
  'pf1-content/5xuHp8QVV7DphtMC', // Numerologist
];
const unchainedLinked = [
  'pf1-content/3Gz9gxDh3lJMnaK2', // Radiant Healer: Light
  'pf1-content/3wlB6o57m3XQX5fu', // Transmuter of Korada: six spells
  'pf1-content/3zZRrKW780Cgb3zo', // Whip Specialist: Whip
  'pf1-content/4B0jXfMRS2hDRzwU', // Beastkin: Speak with Animals
];

it('resolves the reviewed trait Modifiers, with trait bonuses that never stack', () => {
  // Excitable and Wary of Danger: two traits' +2 trait bonuses on initiative.
  for (const name of [
    'Excitable (Gnome)',
    'Wary of Danger (Human; Kellid)',
  ] as const)
    expect(total(reviewedTraitSheet(name), 'init'), name).toBe(2);
  expect(
    total(
      reviewedTraitSheet('Excitable (Gnome)', 'Wary of Danger (Human; Kellid)'),
      'init',
    ),
  ).toBe(2);
  // Arcane Temper: the raw concentration change maps nothing, so the
  // reviewed Modifier supplies +1 trait on concentration beside the imported
  // +1 on initiative.
  const temper = resolveSheet(modifiers('Arcane Temper'));
  expect([temper.init.total, temper.concentration.total]).toEqual([1, 1]);
  expect(entry('Arcane Temper').unsupported).toEqual(
    expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
  );
  // Varki Landspeaker: +1 in cold terrain and +5 on the spirit query; the +5
  // replaces the +1 rather than adding to it.
  const varki = 'Varki Landspeaker (Human; Varki)';
  const cold = indexOf(varki, 'skill.sur', 'arctic or cold terrain');
  const spirits = indexOf(varki, 'skill.sur', 'find shelter');
  expect(resolveSheet(modifiers(varki))['skill.sur'].total).toBe(0);
  expect(
    resolveSheet(modifiers(varki), { situations: [situation(varki, cold)] })[
      'skill.sur'
    ].total,
  ).toBe(1);
  expect(
    resolveSheet(modifiers(varki), {
      situations: [situation(varki, cold), situation(varki, spirits)],
    })['skill.sur'].total,
  ).toBe(5);
  // Hardly a Fool's illusion save bonus uses the shared illusions Situation.
  const fool = resolveSheet(modifiers('Hardly a Fool'), {
    situations: ['illusions'],
  });
  expect([fool['skill.sen'].total, fool['save.will'].total]).toEqual([1, 1]);
  // Draconic Lineage takes the shared fear Situation; Buried Anxiety's fear
  // bonus carries an exception, so the shared fear Situation leaves it out.
  expect(
    resolveSheet(modifiers('Draconic Lineage'), { situations: ['fear'] })[
      'save.will'
    ].total,
  ).toBe(1);
  const anxiety = 'Buried Anxiety (Tiefling; Spitespawn)';
  expect(modifiers(anxiety)[0]?.condition?.situation).toEqual({
    local:
      'against fear effects, except when you can see, hear, smell, or taste the chosen phenomenon that unnerves you',
  });
  expect(
    resolveSheet(modifiers(anxiety), { situations: ['fear'] })['save.will']
      .total,
  ).toBe(0);
  expect(
    resolveSheet(modifiers(anxiety), { situations: [situation(anxiety, 0)] })[
      'save.will'
    ].total,
  ).toBe(2);
  // Two shared-poison trait bonuses on Fortitude do not stack.
  expect(
    resolveSheet(
      [
        ...modifiers('Poisonous Upbringing (Drow)'),
        ...modifiers('Venom Resistance'),
      ],
      { situations: ['poison'] },
    )['save.fort'].total,
  ).toBe(2);
  // Flotsam: the published untyped +2 is on Reflex only.
  const flotsam = resolveSheet(modifiers('Flotsam (The Shackles)'), {
    situations: [situation('Flotsam (The Shackles)', 0)],
  });
  expect([
    flotsam['save.ref'].total,
    flotsam['save.fort'].total,
    flotsam['save.will'].total,
  ]).toEqual([2, 0, 0]);
  // Whip Specialist and Scion of Goblinblood: Foundry files the notes on
  // attack; the reviewed bonuses are on damage.
  for (const name of [
    'Whip Specialist (Okeno)',
    'Scion of Goblinblood (Goblin; Isger)',
    'Clockwork Engineer',
  ])
    expect(
      modifiers(name).map((row) => row.target),
      name,
    ).toEqual(['damage']);
  // Student of Philosophy adds the Intelligence modifier's excess over
  // Charisma on persuasion and lies, and never lowers the check.
  const student = (int: number, cha: number) => {
    const sheet = reviewedTraitSheet('Student of Philosophy');
    const base = sheet.catalogEntries[0]!;
    base.modifiers = (base.modifiers ?? []).map((row) =>
      row.target === abilityTargets.intelligence
        ? { ...row, value: int }
        : row.target === abilityTargets.charisma
          ? { ...row, value: cha }
          : row,
    );
    const selected = modifiers('Student of Philosophy', 'trait-row-0');
    return calculateCharacterSheetProjections(sheet, {
      situations: selected.map((row) => ({
        ...(row.condition?.situation as { local: string }),
        sheetEntryId: 'trait-row-0',
      })),
    }).current.breakdowns;
  };
  // Intelligence 16 and Charisma 10: Charisma +0 and the excess +3.
  const clever = student(16, 10);
  expect([clever['skill.dip'].total, clever['skill.blf'].total]).toEqual([
    3, 3,
  ]);
  // Intelligence 8 and Charisma 14: Charisma +2 and no substitution.
  const charming = student(8, 14);
  expect([charming['skill.dip'].total, charming['skill.blf'].total]).toEqual([
    2, 2,
  ]);
  // Impatient: one local Situation carries the -1 penalties on attacks,
  // saves and skills.
  const impatient = modifiers('Impatient');
  expect(
    new Set(impatient.map((row) => JSON.stringify(row.condition?.situation)))
      .size,
  ).toBe(1);
  const last = resolveSheet(impatient, {
    situations: [situation('Impatient', 0)],
  });
  expect([
    last['attack.melee'].total,
    last['save.ref'].total,
    last['skill.per'].total,
  ]).toEqual([-1, -1, -1]);
  expect(resolveSheet(impatient)['attack.melee'].total).toBe(0);
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
    }
    const texts = (entry(row.name).situationalNotes ?? []).map(
      (note) => note.text,
    );
    for (const part of parts) expect(texts, row.name).toContain(part);
  }
  expect(required).toBe(87);
  // Repeated targets keep their own outputs: Varki Landspeaker's two
  // Survival notes and King in Waiting's two save notes.
  const kingNotes = candidate(
    'King in Waiting',
  ).mechanicsReview.curationRecords.filter((row) => row.kind === 'note');
  expect(
    kingNotes
      .flatMap((row) => row.outputs)
      .map((output) => (output.kind === 'modifier' ? output.value : null))
      .sort(),
  ).toEqual([1, 3]);
  // Readable rules stay Notes where no statistic exists; the drafter's
  // concentration and spell DC targets for Constitution checks and casting
  // options are dropped.
  for (const name of [
    'Denial of Fate (Urgathoa)',
    'Radiant Healer',
    'Linked Surge',
    'Tainted Spirit',
  ])
    expect(
      entry(name).situationalNotes?.filter(
        (note) => note.target === 'concentration' || note.target === 'spellDC',
      ),
      name,
    ).toEqual([]);
  expect(
    entry('Ever Wary (Tiefling)').situationalNotes?.find(
      (note) => note.target === 'ac',
    )?.text,
  ).toContain('half your Dexterity bonus');
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
    'Arcane Temper',
    'Excitable (Gnome)',
    'Wary of Danger (Human; Kellid)',
  ]);
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
      `traits-368-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `traits-368-notice-${book}-complete-chain`),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    heldTraits
      .filter((row) => row.traitType === 'drawback')
      .map((row) => row.name)
      .sort(),
  ).toEqual(['Impatient', 'Tainted Spirit']);
  for (const [name, book] of [
    ['Stolen Fury (Wrath of the Righteous)', 'PZO1126'],
    ['Numerian Fluid Indulger (Palace of Fallen Stars)', 'PZO9270'],
    ['Monster Stalker', 'PZO1112'],
    ['Draconic Lineage', 'PZO1129'],
    ['Born in the Light (Dhampir)', 'PZO9280'],
    ['Whip Specialist (Okeno)', 'PZO1123'],
    ['Linked Surge', 'PZO1115'],
    ['Jadwiga Medicine (Irrisen)', 'PZO1115'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Unchained action-cost metadata anywhere in the bound closure, the
  // trait's own actions included, requires the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedLinked])].sort();
  expect(unchained).toHaveLength(24);
  expect(
    heldTraits
      .filter((row) => row.requiredNotices.includes('PZO1131'))
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(unchained);
  for (const key of unchained) {
    const row = heldTraits.find((row) => row.externalKey === key)!;
    expect(row.noticeHoldIds, row.name).toContain(
      'traits-368-notice-PZO1131-complete-chain',
    );
    const rules = row.inheritedRuleNotices
      .filter((notice) => notice.book === 'PZO1131')
      .map((notice) => notice.rule);
    if (unchainedOwn.includes(key))
      expect(rules, row.name).toEqual(
        expect.arrayContaining([expect.stringContaining("trait's own action")]),
      );
    if (unchainedLinked.includes(key))
      expect(rules, row.name).toEqual(
        expect.arrayContaining([expect.stringContaining('on the bound')]),
      );
    // The metadata is literally in the trait's own record or a linked body.
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
  // Earlier printings and same-name traits of other books are not required.
  for (const [name, book] of [
    ['Desert Child (Desert)', 'PZO9404'],
    ['Superstitious (Human; Kellid)', 'PZO9414'],
    ['Superstitious (Human; Kellid)', 'PZO9433'],
    ['Brute (Orc)', 'PZO9405'],
    ['Dungeon Dweller (Subterranean Dungeon)', 'PZO1121'],
  ] as const)
    expect(candidate(name).requiredNotices, name).not.toContain(book);
  // Venom Resistance cites no source and has no PCGen row.
  expect(candidate('Venom Resistance').citedSources).toEqual([]);
  expect(entry('Venom Resistance').sources).toEqual([]);
  expect(
    heldTraits
      .flatMap((row) => row.linkedContentReview.map((linked) => linked.name))
      .sort(),
  ).toEqual([
    "Bear's Endurance",
    "Bull's Strength",
    "Cat's Grace",
    "Eagle's Splendor",
    'Endurance',
    "Fox's Cunning",
    'Light',
    "Owl's Wisdom",
    'Speak with Animals',
    'Whip',
  ]);
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
  expect(kinds('Brute (Orc)')).toEqual(['anyOf']);
  expect(kinds('Restless Hunger (Venkelvore; Goblin)')).toEqual([
    'unchecked',
    'race',
  ]);
  expect(kinds('Crusader Road Acolyte (Thornkeep, Echo Wood)')).toEqual([
    'unchecked',
  ]);
  // Requirements set on a separate line from their label map nothing.
  for (const name of ['Signaler (Molthune)', 'Law Enforcer'])
    expect(entry(name).prerequisites, name).toBeUndefined();
  for (const [name, gap] of [
    ['Brute (Orc)', 'not alternatives (#739)'],
    ['Signaler (Molthune)', '#739'],
    ['Law Enforcer', '#739'],
    ['Masterful Demeanor (Human; Chelaxian)', 'no ethnicity fact exists'],
    ['Lucky Hound (Riding dog)', 'no companion fact exists'],
    ['Havoc of the Society (Sorcerer, Pathfinder Society)', 'maps no atom'],
  ] as const)
    expect(
      recordedPrerequisiteFacts({
        batch: 'traits-368',
        candidate: candidate(name),
      }),
      name,
    ).toEqual(expect.arrayContaining([expect.stringContaining(gap)]));
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
        reviewedOn: '2026-10-17',
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
  // The Excitable body equals its Gnomes of Golarion row.
  expect(candidate('Excitable (Gnome)').comparison?.literalRow).toContain(
    'DESC:You demand that everything must happen right now, no matter what, and are too impatient to wait for everyone else to catch up.',
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
      required: 87,
      checked: 87,
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
    // Alchemical Breath links a pf-items record absent from the pinned pack,
    // which the gate reports as a broken reference (an importer gap), before
    // its holds apply.
    expect(gate.failures.filter((row) => ours.has(row.externalKey))).toEqual([
      {
        externalKey: 'pf1-content/3LE7Nzq0MM9x2y1T',
        reason: 'Broken structure or reference: unresolved imported reference.',
      },
    ]);
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
    const excitable = candidate('Excitable (Gnome)');
    expect(excitable.requiredNotices).toEqual([
      'PZO9411',
      'PZO1115',
      'PZO1110',
    ]);
    // With its PCGen-confirmed books reviewed (2026-10-31), only the notice
    // holds the owner's clearance clears still hold it, so this runs uncleared.
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === excitable.externalKey
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(
      confirmed.admitted.some(
        (row) => row.externalKey === excitable.externalKey,
      ),
    ).toBe(false);
    expect(
      confirmed.held.find((row) => row.externalKey === excitable.externalKey)
        ?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});
