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
} from '../fixtures/traits-371/data';
import { reviewedTraitSheet } from '../fixtures/traits-371/sheet';
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
  'Abyssal Eavesdropper (Sarkoris, Worldwound)',
  "The Word (Tyrant's Grasp)",
  'Cliff Strider (Arcadia native)',
  'Telekinetic Dependence (Vampire; Nosferatu)',
  'Hellknight Inquisitor',
  'Vengeful (AH)',
  'Dreadful Forethought (Ustalav)',
  'Senatorial Hopeful (War for the Crown)',
  'Balanced Education (Anuli)',
  'Librarian (Dark Archive)',
  'Master of Pentacles (Dark Archive)',
  'Balanced Offensive (The Concordance)',
  'Resourceful Alchemy (Thuvia)',
  'Godclaw Disciple (Lawful)',
];

// Every trait whose bound content closure keeps Unchained action-cost
// metadata (owner ruling, 2026-10-17): 17 on the trait's own action, one of
// them (Harrow Chosen) also through its linked Augury, and three only through
// linked bodies (brass knuckles, four spells, five domain powers).
const unchainedOwn = [
  'pf1-content/C12WB3TIg6teTZtL', // Fey Hex
  'pf1-content/CBi1q69ddEKv0Cps', // Skillful
  'pf1-content/CWhAo6YzP0e6d7Kk', // Inspiring Rush
  'pf1-content/CaAgahPQ875KkzY5', // Enemy of Delusion
  'pf1-content/Ch5hlZ7Z2CSBwnwj', // Blood Algorithm
  'pf1-content/Crtbm1TOp9QJSLLD', // Technic Tinkerer
  'pf1-content/DPK3zdJvDC0F7qEA', // Memory Mastery
  'pf1-content/DRZiHmSmvNwKM2p4', // Senatorial Hopeful
  'pf1-content/DV7X8XwG2LtJ9heH', // Harrow Chosen (also Augury)
  'pf1-content/DezcDkdnDs5jDN4b', // Balanced Education
  'pf1-content/DuosH4UCo6Qs2IWh', // Justiciar
  'pf1-content/DvDOCRNLk3zHSOht', // Librarian
  'pf1-content/DwYh8hWBn8USNV2R', // Master of Pentacles
  'pf1-content/E38Ya3UMxlDeZGbv', // Pristine Reputation
  'pf1-content/E7m7OGYpJeMyV1I7', // Mighty Protector
  'pf1-content/EX6pRWyQWJshvt3V', // Malleable Magic
  'pf1-content/Efpl0C8xrS59nCpS', // Cyphermage Backer
];
const unchainedLinked = [
  'pf1-content/BvOs10q0JnObynEk', // Dockside Brawler: Brass Knuckles
  'pf1-content/CYmeezRcKCJw8dzv', // Telekinetic Dependence: four spells
  'pf1-content/DV7X8XwG2LtJ9heH', // Harrow Chosen: Augury
  'pf1-content/E9L1u8r9usirhmOu', // Balanced Offensive: five domain powers
];

it('resolves the reviewed trait Modifiers, with trait bonuses that never stack', () => {
  // Rostlander and The Word: two traits' +1 trait bonuses on Fortitude.
  for (const name of [
    'Rostlander (Kingmaker)',
    "The Word (Tyrant's Grasp)",
  ] as const)
    expect(total(reviewedTraitSheet(name), 'save.fort'), name).toBe(1);
  expect(
    total(
      reviewedTraitSheet('Rostlander (Kingmaker)', "The Word (Tyrant's Grasp)"),
      'save.fort',
    ),
  ).toBe(1);
  // Freed Slave (Andoran) and Bastard: +1 trait bonuses on Will, likewise.
  expect(
    total(
      reviewedTraitSheet('Freed Slave (Andoran)', 'Bastard (Kingmaker)'),
      'save.will',
    ),
  ).toBe(1);
  // A bonus that rises in a Situation is its new total: Lillend's Harp +1 on
  // Perform (string) and +2 in a bardic performance; Resourceful Alchemy +2
  // on Craft (alchemy) and +3 for alchemical items; Friends in High Places +1
  // and +2 with officials.
  for (const [name, target, low, high] of [
    ["Lillend's Harp (Aasimar; Musetouched)", 'skill.prf', 1, 2],
    ['Resourceful Alchemy (Thuvia)', 'skill.crf', 2, 3],
    ['Friends in High Places', 'skill.dip', 1, 2],
    ['Friends in High Places', 'skill.int', 1, 2],
  ] as const) {
    const rows = modifiers(name).filter((row) => row.target === target);
    const labels = rows.map((row) => row.value);
    expect(labels.sort(), name).toEqual([low, high]);
    const all = modifiers(name)
      .map((row, index) => (row.target === target ? index : -1))
      .filter((index) => index >= 0)
      .map((index) => situation(name, index));
    expect(resolveSheet(modifiers(name))[target].total, name).toBe(0);
    expect(
      resolveSheet(modifiers(name), { situations: all })[target].total,
      name,
    ).toBe(high);
    const lowIndex = modifiers(name).findIndex(
      (row) => row.target === target && row.value === low,
    );
    expect(
      resolveSheet(modifiers(name), {
        situations: [situation(name, lowIndex)],
      })[target].total,
      name,
    ).toBe(low);
  }
  // Riftwarden Orphan: the raw concentration change maps nothing, so the
  // reviewed Modifier supplies the +2 trait bonus.
  expect(
    resolveSheet(modifiers('Riftwarden Orphan (Wrath of the Righteous)'))
      .concentration.total,
  ).toBe(2);
  expect(
    entry('Riftwarden Orphan (Wrath of the Righteous)').unsupported,
  ).toEqual(
    expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
  );
  // Shared Situations where the body's condition matches exactly.
  const boarded = resolveSheet(
    modifiers("Boarded in Mediogalti (Serpent's Skull)"),
    { situations: ['poison'] },
  );
  expect([
    boarded['save.fort'].total,
    boarded['save.ref'].total,
    boarded['save.will'].total,
  ]).toEqual([2, 2, 2]);
  expect(
    resolveSheet(modifiers('Destructive Blows (Rovagug)'), {
      situations: ['sunder'],
    }).cmb.total,
  ).toBe(2);
  expect(
    resolveSheet(modifiers('Loreseeker (Lissala)'), {
      situations: ['identifyMagicItems'],
    })['skill.spl'].total,
  ).toBe(2);
  const claw = "Tiger's Claw (Skinwalker; Weretiger-Kin)";
  expect(resolveSheet(modifiers(claw))['damage.melee'].total).toBe(0);
  expect(
    resolveSheet(modifiers(claw), { situations: ['charging'] })['damage.melee']
      .total,
  ).toBe(1);
  // Magic is Life adds a spell condition to death effects, so its Situation
  // stays local and the shared death Situation leaves it out.
  expect(
    resolveSheet(modifiers('Magic is Life (Nethys)'), {
      situations: ['death'],
    })['save.fort'].total,
  ).toBe(0);
  // Foundry files these notes on attack rolls; the reviewed bonuses are on
  // damage.
  for (const name of [
    'Dockside Brawler (Skull and Shackles)',
    'Mizu Ki Hikari Rebel (Chu Ye)',
    'Backstabber (Thamir Gixx)',
    'Dirty Fighter',
    'Ratfolk Avenger (Ratfolk)',
    'Vengeful (QC)',
    claw,
  ])
    expect(
      modifiers(name).map((row) => row.target),
      name,
    ).toEqual(['damage']);
  expect(
    modifiers('Regional Recluse - Turtleback Ferry (Varisia)').map((row) => [
      row.target,
      row.bonusType,
    ]),
  ).toEqual([
    ['skill.sur', 'trait'],
    ['damage', 'untyped'],
  ]);
  // Fury of the Red's melee note is a Will bonus; Shoreline Skirmisher's
  // bonus is on combat maneuver checks only, not CMD.
  expect(modifiers('Fury of the Red').map((row) => row.target)).toEqual([
    'save.will',
  ]);
  const shore = 'Shoreline Skirmisher (Skinwalker; Wereshark-Kin)';
  const sand = resolveSheet(modifiers(shore), {
    situations: [situation(shore, 0)],
  });
  expect([sand.cmb.total, sand.cmd.total]).toEqual([2, 0]);
  // Abyssal Eavesdropper: -2 while speaking Abyssal, or +2 trait once Abyssal
  // is gained again.
  const abyssal = 'Abyssal Eavesdropper (Sarkoris, Worldwound)';
  const speaking = indexOf(abyssal, 'skill.blf', 'while speaking Abyssal"');
  const regained = indexOf(abyssal, 'skill.blf', 'gained Abyssal');
  expect(
    resolveSheet(modifiers(abyssal), {
      situations: [situation(abyssal, speaking)],
    })['skill.blf'].total,
  ).toBe(-2);
  expect(
    resolveSheet(modifiers(abyssal), {
      situations: [situation(abyssal, regained)],
    })['skill.blf'].total,
  ).toBe(2);
  // The drawbacks' penalties wait for one Situation each.
  const loner = resolveSheet(modifiers('Loner'), {
    situations: [situation('Loner', 0)],
  });
  expect([loner['attack.melee'].total, loner['ac.other'].total]).toEqual([
    -1, -1,
  ]);
  expect(resolveSheet(modifiers('Loner'))['attack.melee'].total).toBe(0);
  const sheltered = modifiers('Sheltered');
  expect(
    new Set(sheltered.map((row) => JSON.stringify(row.condition?.situation)))
      .size,
  ).toBe(1);
  const hurt = resolveSheet(sheltered, {
    situations: [situation('Sheltered', 0)],
  });
  expect([
    hurt['attack.ranged'].total,
    hurt['save.will'].total,
    hurt['skill.per'].total,
  ]).toEqual([-2, -2, -2]);
  const bastard = resolveSheet(modifiers('Bastard (Kingmaker)'), {
    situations: [situation('Bastard (Kingmaker)', 1)],
  });
  expect([
    bastard['save.will'].total,
    bastard['skill.dip'].total,
    bastard['skill.umd'].total,
    bastard['skill.per'].total,
  ]).toEqual([1, -1, -1, 0]);
  // Robot Slayer's dodge bonus applies to AC against robots.
  const robots = 'Robot Slayer (Iron Gods)';
  expect(
    resolveSheet(modifiers(robots), {
      situations: [situation(robots, indexOf(robots, 'ac', 'robots'))],
    })['ac.other'].total,
  ).toBe(1);
  // Imported trait-typed changes whose body reads an untyped bonus keep the
  // imported type (a change replacement replaces only the formula).
  for (const name of [
    'Carnation Scales (Kobold)',
    'Senatorial Hopeful (War for the Crown)',
  ])
    expect(new Set(modifiers(name).map((row) => row.bonusType)), name).toEqual(
      new Set(['trait']),
    );
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
  expect(required).toBe(95);
  // Shoreline Skirmisher's CMD note is the one explicit covered/no-output
  // record.
  expect(
    heldTraits.flatMap((row) =>
      row.mechanicsReview.curationRecords
        .filter((record) => !record.outputs.length)
        .map((record) => `${row.name} ${record.target}`),
    ),
  ).toEqual(['Shoreline Skirmisher (Skinwalker; Wereshark-Kin) cmd']);
  // Readable rules stay Notes where no statistic exists; the drafter's
  // concentration and spell DC targets for stabilization, extracts and
  // durations are dropped.
  for (const name of [
    'Magic is Life (Nethys)',
    'Mana Wastes Medic (Mana Wastes; Alchemist)',
    'Master of Pentacles (Dark Archive)',
  ])
    expect(
      entry(name).situationalNotes?.filter(
        (note) => note.target === 'concentration' || note.target === 'spellDC',
      ),
      name,
    ).toEqual([]);
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
    'Dreadful Forethought (Ustalav)',
    'Freed Slave (Andoran)',
    'Loreseeker (Lissala)',
    'Rostlander (Kingmaker)',
    "Tiger's Claw (Skinwalker; Weretiger-Kin)",
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
      `traits-371-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `traits-371-notice-${book}-complete-chain`),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    heldTraits
      .filter((row) => row.traitType === 'drawback')
      .map((row) => row.name)
      .sort(),
  ).toEqual(['Headstrong', 'Loner', 'Power-Hungry', 'Sheltered']);
  for (const [name, book] of [
    ['Riftwarden Orphan (Wrath of the Righteous)', 'PZO1126'],
    ['Commercial Savvy (Katapesh)', 'PZO1114'],
    ['Malleable Magic', 'PZO1117'],
    ['Hellknight Inquisitor', 'PZO1117'],
    ['Fey Hex (Irrisen)', 'PZO1115'],
    ['Dockside Brawler (Skull and Shackles)', 'PZO1123'],
    ['Noble Savage (Ulfen Guard)', 'PZO9221'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Class features name the pinned class record's literal source line.
  for (const [name, path] of [
    ['Fey Hex (Irrisen)', 'witch.RC4D4WFT5kRKkdqp.yaml#L73'],
    ['Hellknight Inquisitor', 'inquisitor.Fv3FbmXptuDRiL5y.yaml#L115'],
    [
      'Mana Wastes Medic (Mana Wastes; Alchemist)',
      'alchemist.JcaqlAawhf14q1lq.yaml#L98',
    ],
    ['Malleable Magic', 'magus.xZLcyrEKYZoJPS2k.yaml#L104'],
  ] as const)
    expect(
      candidate(name).inheritedRuleNotices.some((notice) =>
        notice.location.endsWith(path),
      ),
      name,
    ).toBe(true);
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
  const bodies = new Map(
    [...preview.entries, ...preview.closure].map((row) => [
      row.externalKey,
      row,
    ]),
  );
  for (const key of unchained) {
    const row = heldTraits.find((row) => row.externalKey === key)!;
    expect(row.noticeHoldIds, row.name).toContain(
      'traits-371-notice-PZO1131-complete-chain',
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
  // Other printings, same-name traits of other books and bodies reached only
  // through a linked body are not required.
  for (const [name, book] of [
    ['Abyssal Eavesdropper (Sarkoris, Worldwound)', 'PZO9437'],
    ['Robot Slayer (Iron Gods)', 'PZO9448'],
    ["Undead Crusader (Mummy's Mask)", 'PZO9441'],
    ['Brute (Half-Orc)', 'PZO9413'],
    ['Brute (Half-Orc)', 'PZO9405'],
    ['Freed Slave (Andoran)', 'PZO9221'],
    ['Freed Slave (Bellflower Network, Halfling)', 'PZO9414'],
    ['Bastard (Kingmaker)', 'PZO1125'],
    ['Vengeful (AH)', 'PZO9433'],
    ['Carnation Scales (Kobold)', 'PZO1121'],
    ['Carnation Scales (Kobold)', 'PZO9280'],
  ] as const)
    expect(candidate(name).requiredNotices, name).not.toContain(book);
  // Noble Savage cites no source; its book comes from the PCGen row.
  expect(candidate('Noble Savage (Ulfen Guard)').citedSources).toEqual([]);
  expect(entry('Noble Savage (Ulfen Guard)').sources).toEqual([]);
  expect(
    heldTraits
      .flatMap((row) => row.linkedContentReview.map((linked) => linked.name))
      .sort(),
  ).toEqual([
    'Acid Dart',
    'Augury',
    'Brass Knuckles',
    'Day Raider',
    'Fire Bolt',
    'Fly',
    'Hex Nail',
    'Icicle',
    'Leadership',
    'Levitate',
    'Lightning Arc',
    'Mage Hand',
    'Regional Recluse - Arsmeril or Crying Leaf (Varisia)',
    'Regional Recluse - Ilsurian (Varisia)',
    'Regional Recluse - Sanos Forest or Whistledown (Varisia)',
    'Regional Recluse - Urglin (Varisia)',
    'Storm Burst',
    'Telekinesis',
  ]);
  // The closure adds Day Raider's two reached kobold racial traits.
  expect(preview.closure.map((row) => row.name).sort()).toEqual(
    expect.arrayContaining([
      'Darkvision (Kobold)',
      'Light Sensitivity (Kobold)',
    ]),
  );
  expect(preview.closure).toHaveLength(20);
  for (const name of noRow) {
    expect(candidate(name).comparison, name).toBeNull();
    if (name === 'Abyssal Eavesdropper (Sarkoris, Worldwound)') continue;
    expect(candidate(name).additionalComparisonLeads, name).toEqual([]);
    expect(candidate(name).inheritedRuleUnresolvedOrigins[0], name).toContain(
      'no PCGen row at the pin',
    );
  }
  expect(heldTraits.filter((row) => !row.comparison)).toHaveLength(
    noRow.length,
  );
  expect(
    candidate('Blood Algorithm (Android)').inheritedRuleUnresolvedOrigins,
  ).toEqual([expect.stringContaining('pain descriptor')]);
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
  expect(kinds('Freed Slave (Bellflower Network, Halfling)')).toEqual([
    'unchecked',
    'race',
  ]);
  expect(kinds('Bastard (Kingmaker)')).toEqual(['race']);
  // Preserve the complete unresolved regional or class qualification.
  for (const name of [
    'Mana Wastes Medic (Mana Wastes; Alchemist)',
    "Patron's Boon (Rahadoum)",
  ]) {
    expect(kinds(name), name).toEqual(['unchecked']);
    expect(
      recordedPrerequisiteFacts({
        batch: 'traits-371',
        candidate: candidate(name),
      }),
      name,
    ).toEqual(expect.arrayContaining([expect.stringContaining('#739')]));
  }
  for (const [name, gap] of [
    ['Freed Slave (Bellflower Network, Halfling)', 'no faction fact exists'],
    ['Harrow Chosen (Human; Varisian)', 'no ethnicity fact exists'],
    ['Godclaw Disciple (Lawful)', 'no alignment fact exists'],
    ["Lillend's Harp (Aasimar; Musetouched)", 'no heritage fact exists'],
  ] as const)
    expect(
      recordedPrerequisiteFacts({
        batch: 'traits-371',
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
  // The Faction folder is pack organization, excluded by the importer's
  // folder contract.
  expect(folders).toEqual([
    expect.objectContaining({
      externalKey: 'pf1-content/Deq32iqkuiMz2xsk',
      name: 'Faction',
      rawKey: '!folders!Deq32iqkuiMz2xsk',
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
  // The Rostlander body equals its Kingmaker Player's Guide row's benefit.
  expect(candidate('Rostlander (Kingmaker)').comparison?.literalRow).toContain(
    'BONUS:SAVE|Fortitude|1|TYPE=Trait',
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
      required: 95,
      checked: 95,
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
    // #738 keeps Sheltered's Shaken journal link as text: no trait fails.
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
    const rostlander = candidate('Rostlander (Kingmaker)');
    expect(rostlander.requiredNotices).toEqual([
      'PZO9000-6E',
      'PZO1115',
      'PZO1110',
    ]);
    // With its PCGen-confirmed books reviewed (2026-10-31), only the notice
    // holds the owner's clearance clears still hold it, so this runs uncleared.
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === rostlander.externalKey
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(
      confirmed.admitted.some(
        (row) => row.externalKey === rostlander.externalKey,
      ),
    ).toBe(false);
    expect(
      confirmed.held.find((row) => row.externalKey === rostlander.externalKey)
        ?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});
