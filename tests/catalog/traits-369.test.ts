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
} from '../fixtures/traits-369/data';
import { reviewedTraitSheet } from '../fixtures/traits-369/sheet';
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
  'Dunewalker (Osirion Faction)',
  "Indomitable (Liberty's Edge)",
  'Poison Connoisseur (Taldor)',
  'Meticulous Artisan (Lantern Lodge)',
  'Follower of the Stars (Desna)',
  "Captain's Blade (Liberty's Edge)",
  'Light in the Darkness',
  'Stigmatized',
  'Deep Faith',
  'Black Blood Heritage',
  "The Artisan (Tyrant's Grasp)",
  'Jistkan Scholar',
  'Shadow Diplomat (Shadow Lodge)',
  'Allies in the Deep',
  'Tar Taargadth Trained',
  'Fruits of Your Labor (Jaidi)',
  'Warthog (Boar)',
  'Obnoxious',
  'Cowardly',
  'Blood Potion Brewer (Belkzen)',
];

// Every trait whose bound content closure keeps Unchained action-cost
// metadata (owner ruling, 2026-10-17): 17 on the trait's own action, one of
// them (Trifler) also through its linked spell, and three only through a
// linked body (two charm spells, sotto voce and the Aldori dueling sword).
const unchainedOwn = [
  'pf1-content/6c1qf4GcCpbetUOl', // Poison Connoisseur
  'pf1-content/72rjIVdWGSftgxKV', // True Devotion
  'pf1-content/77ZYqAOfevrHBV7S', // Dogged
  'pf1-content/7DueGmmHybnt4yYV', // Purchased Loyalty
  'pf1-content/7HZG6BBmRhvY3gW7', // Black Blood Heritage
  'pf1-content/7JmmAQL3L7cVG5iL', // Trifler (also Prestidigitation)
  'pf1-content/7Jvq4i9OqBGJZRRZ', // The Artisan
  'pf1-content/7SjDQBjxPK5piL2I', // Gregarious
  'pf1-content/7eaVZeWsDO00mBhA', // Child of the Crusades
  'pf1-content/7iVlFobOd9mNWlLf', // Adrenaline Rush
  'pf1-content/7qHhApg7OMSlk3e7', // Battlefield Surgeon
  'pf1-content/826bo4RS4hXSl6x9', // Kobold Herbalist
  'pf1-content/8IInX99gsRtUTUQJ', // Fruits of Your Labor
  'pf1-content/8X8omzoUowxdyeul', // Fight for Liberty
  'pf1-content/8sGQFVHVuuliB0Nn', // Blood Potion Brewer
  'pf1-content/8vWRjidZGWn2NMQu', // Avowed Inspiration
  'pf1-content/9Jo59eF55s6UQFAn', // Slave Runner
];
const unchainedLinked = [
  'pf1-content/7JmmAQL3L7cVG5iL', // Trifler: Prestidigitation
  'pf1-content/7jkDJ6frlC3RMW28', // Mind Trapper: Charm Person, Charm Monster
  'pf1-content/82HPgUT4qNYRd3qa', // Tar-Baphon's Whisper: Sotto Voce
  'pf1-content/8fC6WBuS8cwu4AJM', // Dueling Cloak Adept: Aldori Dueling Sword
];

it('resolves the reviewed trait Modifiers, with trait bonuses that never stack', () => {
  // Silvertongued Eunuch and Shadow Diplomat: two traits' +1 trait bonuses on
  // Diplomacy don't stack.
  for (const name of [
    'Silvertongued Eunuch (Quain)',
    'Shadow Diplomat (Shadow Lodge)',
  ] as const)
    expect(total(reviewedTraitSheet(name), 'skill.dip'), name).toBe(1);
  expect(
    total(
      reviewedTraitSheet(
        'Silvertongued Eunuch (Quain)',
        'Shadow Diplomat (Shadow Lodge)',
      ),
      'skill.dip',
    ),
  ).toBe(1);
  // Betrayal of Trust: +2 on Bluff, and +4 to conceal or deny your infidelity;
  // the +4 replaces the +2 rather than adding to it.
  const betrayal = 'Betrayal of Trust';
  expect(resolveSheet(modifiers(betrayal))['skill.blf'].total).toBe(2);
  expect(
    resolveSheet(modifiers(betrayal), {
      situations: [
        situation(betrayal, indexOf(betrayal, 'skill.blf', 'infidelity')),
      ],
    })['skill.blf'].total,
  ).toBe(4);
  // Caretaker's +1 and Mwangi Herbal Tradition's long-term care +4 on Heal:
  // the trait bonuses don't stack, so the Situation gives +4, not +5.
  const herbal = 'Mwangi Herbal Tradition (Mwangi Expanse)';
  expect(
    resolveSheet([...modifiers('Caretaker'), ...modifiers(herbal)], {
      situations: [situation(herbal, 0)],
    })['skill.hea'].total,
  ).toBe(4);
  // Tight Bonds: +1 on Will with a partner near, +3 against a command to harm
  // the relationship; the +3 is the new total.
  const bonds = 'Tight Bonds';
  expect(
    resolveSheet(modifiers(bonds), {
      situations: [situation(bonds, 0), situation(bonds, 1)],
    })['save.will'].total,
  ).toBe(3);
  // Misbegotten: the raw dexSkills change maps nothing, so the reviewed
  // record supplies -2 on each Dexterity-based skill and nothing else.
  const misbegotten = resolveSheet(modifiers('Misbegotten'));
  expect(
    [
      'skill.acr',
      'skill.dev',
      'skill.esc',
      'skill.fly',
      'skill.rid',
      'skill.slt',
      'skill.ste',
    ].map((target) => misbegotten[target as 'skill.acr'].total),
  ).toEqual([-2, -2, -2, -2, -2, -2, -2]);
  expect([
    misbegotten['skill.blf'].total,
    misbegotten['skill.swm'].total,
  ]).toEqual([0, 0]);
  expect(entry('Misbegotten').unsupported).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        field: 'changes',
        value: expect.objectContaining({ target: 'dexSkills' }),
      }),
    ]),
  );
  // Magic Survivor: choosing Fortitude and Reflex gives +1 on each against
  // spells and -1 on every Will save.
  const survivor = 'Magic Survivor (Trox)';
  const chosen = resolveSheet(modifiers(survivor), {
    situations: [
      situation(survivor, indexOf(survivor, 'save.fort', 'chose Fortitude')),
      situation(survivor, indexOf(survivor, 'save.ref', 'chose Reflex')),
      situation(survivor, indexOf(survivor, 'save.will', 'Will is the save')),
    ],
  });
  expect([
    chosen['save.fort'].total,
    chosen['save.ref'].total,
    chosen['save.will'].total,
  ]).toEqual([1, 1, -1]);
  expect(resolveSheet(modifiers(survivor))['save.will'].total).toBe(0);
  // Shared Situations only where the body's condition matches exactly:
  // Indomitable's enchantment save bonus and Prankster's dirty trick bonus.
  expect(
    resolveSheet(modifiers("Indomitable (Liberty's Edge)"), {
      situations: ['enchantment'],
    })['save.will'].total,
  ).toBe(1);
  expect(
    resolveSheet(modifiers('Prankster (Gnome)'), {
      situations: ['dirtyTrick'],
    }).cmb.total,
  ).toBe(1);
  expect(
    modifiers('Mordant Heritage (the Steaming Sea)').find(
      (row) => row.target === 'saves',
    )?.condition?.situation,
  ).toEqual({ local: 'against enchantment effects' });
  // Corrected targets: ranged damage, melee damage and damage, not attack.
  expect(
    modifiers('Covered Sniper (Kasatha)').map((row) => row.target),
  ).toEqual(['damage.ranged']);
  expect(modifiers('Absalom Bouncer').map((row) => row.target)).toEqual([
    'damage.melee',
  ]);
  expect(modifiers('Tar Taargadth Trained').map((row) => row.target)).toEqual([
    'damage',
  ]);
  expect(
    modifiers('Monster Hunter (Rise of the Runelords)').map(
      (row) => row.target,
    ),
  ).toEqual(['attack', 'damage']);
  // Irrepressible adds the Charisma modifier's excess over Wisdom on Will
  // saves against charm and compulsion, and never lowers the save.
  const irrepressible = (wis: number, cha: number) => {
    const sheet = reviewedTraitSheet('Irrepressible');
    const base = sheet.catalogEntries[0]!;
    base.modifiers = (base.modifiers ?? []).map((row) =>
      row.target === abilityTargets.wisdom
        ? { ...row, value: wis }
        : row.target === abilityTargets.charisma
          ? { ...row, value: cha }
          : row,
    );
    const selected = modifiers('Irrepressible', 'trait-row-0');
    const will = (situations: { local: string; sheetEntryId: string }[]) =>
      calculateCharacterSheetProjections(sheet, { situations }).current
        .breakdowns['save.will'].total;
    // The Situation's contribution: the Will total with it minus without it.
    return (
      will(
        selected.map((row) => ({
          ...(row.condition?.situation as { local: string }),
          sheetEntryId: 'trait-row-0',
        })),
      ) - will([])
    );
  };
  // Wisdom 10 and Charisma 16: the excess of Charisma +3 over Wisdom +0.
  expect(irrepressible(10, 16)).toBe(3);
  // Wisdom 14 and Charisma 8: Charisma -1 is below Wisdom +2, so nothing.
  expect(irrepressible(14, 8)).toBe(0);
  // Imperial Soldier's targetless change maps nothing; each option is a
  // manual Situation, so nothing applies unconditionally.
  const soldier = resolveSheet(modifiers('Imperial Soldier (Molthune)'));
  expect([
    soldier['skill.hea'].total,
    soldier['skill.int'].total,
    soldier['skill.rid'].total,
  ]).toEqual([0, 0, 0]);
  // No reviewed armor, shield or natural armor bonus lands on ac.other (#734);
  // Dragonfoe's and Dueling Cloak Adept's AC bonuses are dodge bonuses.
  for (const row of preview.entries)
    for (const modifier of row.modifiers)
      if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
        expect(modifier.target, row.name).not.toBe('ac.other');
  for (const name of ['Dragonfoe (Giantslayer)', 'Dueling Cloak Adept'])
    expect(
      modifiers(name)
        .filter((row) => row.target === 'ac')
        .map((row) => row.bonusType),
      name,
    ).toEqual(['dodge']);
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
  expect(required).toBe(88);
  // Readable rules stay Notes where no statistic exists; the drafter's spell
  // DC targets for range, spell damage and summoning are dropped, and Black
  // Blood Heritage's immunity is not an AC Note.
  for (const name of [
    'Distance Aptitude',
    'Elemental Pupil (Qadira)',
    'Outsider Ties',
    'Light in the Darkness',
    'Deep Faith',
  ])
    expect(
      entry(name).situationalNotes?.filter((note) => note.target === 'spellDC'),
      name,
    ).toEqual([]);
  expect(
    entry('Black Blood Heritage').situationalNotes?.filter(
      (note) => note.target === 'ac',
    ),
  ).toEqual([]);
  expect(
    entry('Red Mantis Bleeding').situationalNotes?.find(
      (note) => note.target === 'damage',
    )?.text,
  ).toContain('1 point of bleed damage');
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
    "Indomitable (Liberty's Edge)",
    'Resilient',
    'Silvertongued Eunuch (Quain)',
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
      `traits-369-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `traits-369-notice-${book}-complete-chain`),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    heldTraits
      .filter((row) => row.traitType === 'drawback')
      .map((row) => row.name)
      .sort(),
  ).toEqual(['Cowardly', 'Misbegotten', 'Stigmatized']);
  for (const [name, book] of [
    ['Child of the Crusades (Wrath of the Righteous)', 'PZO1126'],
    ['Black Blood Heritage', 'PZO9204'],
    ['Adrenaline Rush (Gnome)', 'PZO1117'],
    ['True Devotion (Strange Aeons)', 'PZO1117'],
    ['Slave Runner', 'PZO1134'],
    ['Kobold Herbalist (Kobold)', 'PZO1123'],
    ['Durable Change (Skinwalker; Werebear-Kin)', 'PZO1133'],
    ['Dueling Cloak Adept', 'PZO1138'],
    ['Noble Born - Garress (Kingmaker)', 'PZO9000-6E'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Unchained action-cost metadata anywhere in the bound closure, the
  // trait's own actions included, requires the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedLinked])].sort();
  expect(unchained).toHaveLength(20);
  expect(
    heldTraits
      .filter((row) => row.requiredNotices.includes('PZO1131'))
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(unchained);
  for (const key of unchained) {
    const row = heldTraits.find((row) => row.externalKey === key)!;
    expect(row.noticeHoldIds, row.name).toContain(
      'traits-369-notice-PZO1131-complete-chain',
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
  // Other printings and same-name traits of other books are not required.
  for (const [name, book] of [
    ['Mordant Heritage (the Steaming Sea)', 'PZO9402'],
    ["Blood of Pharaohs (Mummy's Mask)", 'PZO9441'],
    ['Superstitious (Realm of the Mammoth Lords)', 'PZO9417'],
    ['Superstitious (Realm of the Mammoth Lords)', 'PZO9433'],
    ['Child of the Crusades (Wrath of the Righteous)', 'PZO9414'],
    ['Gregarious', 'PZO1121'],
  ] as const)
    expect(candidate(name).requiredNotices, name).not.toContain(book);
  // Obnoxious cites no source and has no PCGen row.
  expect(candidate('Obnoxious').citedSources).toEqual([]);
  expect(entry('Obnoxious').sources).toEqual([]);
  expect(candidate('Obnoxious').requiredNotices).toEqual([
    'PZO1115',
    'PZO1110',
  ]);
  expect(
    heldTraits
      .flatMap((row) => row.linkedContentReview.map((linked) => linked.name))
      .sort(),
  ).toEqual([
    'Aldori Dueling Sword',
    'Charm Monster',
    'Charm Person',
    'Endurance',
    'Noble Born - Lebeda (Kingmaker)',
    'Noble Born - Lodovka (Kingmaker)',
    'Noble Born - Medvyed (Kingmaker)',
    'Noble Born - Orlovsky (Kingmaker)',
    'Noble Born - Surtova (Kingmaker)',
    'Prestidigitation',
    'Scent Cloak',
    'Sotto Voce',
    'Tight Bonds',
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
  expect(kinds('Finish the Fight (Half-Orc, Orc-Raised)')).toEqual([
    'race',
    'unchecked',
  ]);
  for (const name of [
    'Mwangi Herbal Tradition (Mwangi Expanse)',
    'Trifler (Human; Varisian Wanderers, Varisian human)',
  ])
    expect(kinds(name), name).toEqual(['unchecked']);
  // Requirements set in the body instead of a Requirements line map nothing.
  for (const name of [
    'True Devotion (Strange Aeons)',
    'Allies in the Deep',
    'Tight Bonds',
  ])
    expect(entry(name).prerequisites, name).toBeUndefined();
  for (const [name, gap] of [
    ['True Devotion (Strange Aeons)', 'maps no prerequisite'],
    ['Allies in the Deep', 'maps no prerequisite'],
    ['Tight Bonds', 'maps no prerequisite'],
    ['Generous (Human; Taldan)', 'no ethnicity fact exists'],
    ['Warthog (Boar)', 'no companion fact exists'],
    ['Finish the Fight (Half-Orc, Orc-Raised)', 'no upbringing fact exists'],
  ] as const)
    expect(
      recordedPrerequisiteFacts({
        batch: 'traits-369',
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
    held: 99,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 1,
    recordLevel35Holds: 0,
  });
  expect(folders.map((row) => [row.name, row.rawKey])).toEqual([
    ['Region', '!folders!6b4Oq2nNMw3BxL6l'],
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
  // The Silvertongued Eunuch body equals its Dragon Empires Primer row.
  expect(
    candidate('Silvertongued Eunuch (Quain)').comparison?.literalRow,
  ).toContain(
    "DESC:You were brought up as part of Quain's strictly eunuch bureaucracy, trading your sexual potency for education and tact. You gain a +1 trait bonus on Knowledge (Nobility) and Diplomacy checks.",
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
    const eunuch = candidate('Silvertongued Eunuch (Quain)');
    expect(eunuch.requiredNotices).toEqual(['PZO9421', 'PZO1115', 'PZO1110']);
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === eunuch.externalKey
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(
      confirmed.admitted.some((row) => row.externalKey === eunuch.externalKey),
    ).toBe(false);
    expect(
      confirmed.held.find((row) => row.externalKey === eunuch.externalKey)
        ?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});
