// @vitest-environment node
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
} from '../fixtures/traits-380/data';
import { reviewedTraitSheet } from '../fixtures/traits-380/sheet';
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
  'Aeromantic Affinity',
  'Goblin Bravery (Goblin)',
  'The Wagon',
  'Shadow Dealer (Ustalav)',
  'Nature Worshiper',
  'Watchdog (Shadow Lodge)',
  'Mwangi Linguist (Mwangi Expanse)',
  'Voices in your Head',
  'Influential (Sovereign Court)',
];

// Every trait whose bound content closure keeps Unchained action-cost
// metadata (owner ruling, 2026-10-17): 14 on the trait's own action, 2 of
// them also through a linked spell.
const unchainedOwn = [
  'pf1-content/dueDOJkOhYFcogvT', // Black Powder Interjection
  'pf1-content/dz9Q4WIojiKZ8SlB', // Shield Bearer
  'pf1-content/eAoxuOWvbUEHjwIt', // Frightening Speed
  'pf1-content/eS1p6Z6mQ2mrBXhp', // The Wagon
  'pf1-content/ewuI903wBrG8LTOi', // Guiding Spirit
  'pf1-content/f2itNakmLMbnepG9', // Calculated Bribe
  'pf1-content/f8VfDLvpbmSaHcQt', // Blessed
  'pf1-content/fFya5X0I461TK91T', // Called
  'pf1-content/fQmyV5nnyRqd8eTM', // Masked
  'pf1-content/fg4mXME2v6OsxSqZ', // Voices in your Head
  'pf1-content/fz0awPuq3xKgdEdJ', // Marked by Unknown Forces
  'pf1-content/gAI8ok9cqkOvmKCr', // Oathbound
  'pf1-content/gD0Dr8vukuLyYWPc', // Influential
  'pf1-content/gIbd4Ofq0axz4YHN', // Obsequious Morsel
];
const unchainedLinked = [
  'pf1-content/fz0awPuq3xKgdEdJ', // Marked by Unknown Forces: Light
  'pf1-content/gIbd4Ofq0axz4YHN', // Obsequious Morsel: Sanctuary
];
// The two traits whose rules journal links #738 keeps as text.
const journalLinked = [
  'pf1-content/eEVQkUofjHC1jjMX', // Chillblight Emissary: Sickened journal page
  'pf1-content/ggGeZU7iH0vmOunL', // Abendego Pilot: Winds rules journal
];

// A base sheet with the given ability scores, for the formula Modifier.
function withScores(
  sheet: ReturnType<typeof reviewedTraitSheet>,
  scores: Partial<Record<'wis', number>>,
) {
  const [base, ...rest] = sheet.catalogEntries;
  return {
    ...sheet,
    catalogEntries: [
      {
        ...base!,
        modifiers: base!.modifiers.map((modifier) =>
          modifier.target === abilityTargets.wisdom && scores.wis !== undefined
            ? { ...modifier, value: scores.wis }
            : modifier,
        ),
      },
      ...rest,
    ],
  };
}
const saves = (resolved: ReturnType<typeof resolveSheet>) => [
  resolved['save.fort'].total,
  resolved['save.ref'].total,
  resolved['save.will'].total,
];

it('resolves the reviewed trait Modifiers, with trait bonuses that never stack', () => {
  // Trait bonuses from different traits on one skill never stack.
  const devotee = "Devotee of the Old Gods (Mummy's Mask)";
  const traditionalist = 'Traditionalist (Faiths and Philosophies)';
  expect(total(reviewedTraitSheet(devotee), 'skill.khi')).toBe(1);
  expect(total(reviewedTraitSheet(devotee, traditionalist), 'skill.khi')).toBe(
    1,
  );
  expect(total(reviewedTraitSheet(devotee, traditionalist), 'skill.klo')).toBe(
    1,
  );
  expect(
    total(reviewedTraitSheet(devotee, 'Spirit Guide (Pharasma)'), 'skill.kre'),
  ).toBe(2);
  // A bonus that rises in a Situation is its new total: Faithful Arodenite's
  // +1 on Diplomacy becomes +3 with a follower of Aroden or Iomedae.
  const arodenite = 'Faithful Arodenite (Aroden)';
  expect(resolveSheet(modifiers(arodenite))['skill.dip'].total).toBe(1);
  expect(
    resolveSheet(modifiers(arodenite), {
      situations: [
        situation(arodenite, indexOf(arodenite, 'skill.dip', 'Iomedae')),
      ],
    })['skill.dip'].total,
  ).toBe(3);
  // Targetless imported changes contribute nothing; reviewed Modifiers supply
  // the rule: Perform (sing) and Profession (sailor) on the sheet's one
  // Perform and Profession skill, Rescued's Acrobatics under its Situation.
  for (const [name, target, value] of [
    ['Operatic (Human; Chelaxian)', 'skill.prf', 1],
    ['Belem Pirate (Minata)', 'skill.pro', 1],
    ['Ship Aptitude (The Shackles)', 'skill.pro', 1],
    ['Abendego Pilot (Eye of Abendego; Sylph)', 'skill.pro', 2],
  ] as const) {
    expect(entry(name).unsupported, name).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
    );
    expect(resolveSheet(modifiers(name))[target].total, name).toBe(value);
  }
  const rescued = 'Rescued (Jade Regent)';
  expect(resolveSheet(modifiers(rescued))['skill.acr'].total).toBe(0);
  expect(
    resolveSheet(modifiers(rescued), {
      situations: [
        situation(rescued, indexOf(rescued, 'skill.acr', 'Shalelu')),
      ],
    })['skill.acr'].total,
  ).toBe(1);
  // Choices are one Situation per option.
  for (const [name, count] of [
    ['Blight-Burned (Ironfang Invasion)', 2],
    ["Ex-Asmodean (Hell's Rebels)", 3],
    ["Binder's Blood", 7],
    ['Legalistic Liberation (Halfling; Molthune, Osirion)', 10],
    ['Information Overload', 10],
  ] as const)
    expect(modifiers(name), name).toHaveLength(count);
  const asmodean = "Ex-Asmodean (Hell's Rebels)";
  const weapon = resolveSheet(modifiers(asmodean), {
    situations: [
      situation(asmodean, indexOf(asmodean, 'damage', 'attack and damage')),
    ],
  });
  expect([weapon['damage.melee'].total, weapon['damage.ranged'].total]).toEqual(
    [1, 1],
  );
  // Searing Beacon's precision damage is the Wisdom modifier, on melee damage
  // under its Situation: +2 with Wisdom 14.
  const beacon = 'Searing Beacon (Iomedae; Ozem)';
  const wise = withScores(reviewedTraitSheet(beacon), { wis: 14 });
  expect(
    calculateCharacterSheetProjections(wise).current.breakdowns['damage.melee']
      .total,
  ).toBe(0);
  expect(
    calculateCharacterSheetProjections(wise, {
      situations: [situation(beacon, 0, 'trait-row-0')],
    }).current.breakdowns['damage.melee'].total,
  ).toBe(2);
  // Shared Situations only where the body's condition matches exactly.
  for (const [name, key, target, value] of [
    ['Inured to Death', 'death', 'save.will', 2],
    ['Jungle Resilience (Nagajor)', 'poison', 'save.fort', 2],
    ['Stoic Optimism (Desna)', 'fear', 'save.will', 2],
    ['Shadow Dealer (Ustalav)', 'fear', 'save.ref', 1],
    ['Making Good on Promises (Carrion Crown)', 'fear', 'save.fort', 2],
    ['Nature Worshiper', 'death', 'save.will', 1],
    ['Nature Worshiper', 'negativeEnergy', 'save.will', 1],
    ['Scheming Survivor (Drow)', 'poison', 'save.ref', 1],
    ['Big Boned (Tiefling; Hungerseed)', 'overrun', 'cmb', 1],
    ['Hot Headed (Ifrit)', 'charging', 'damage.melee', 1],
  ] as const)
    expect(
      resolveSheet(modifiers(name), { situations: [key] })[target].total,
      `${name} ${key}`,
    ).toBe(value);
  // Nature Worshiper's two Situations never add up.
  expect(
    resolveSheet(modifiers('Nature Worshiper'), {
      situations: ['death', 'negativeEnergy'],
    })['save.will'].total,
  ).toBe(1);
  for (const [name, key] of [
    ['Blight-Burned (Ironfang Invasion)', 'poison'],
    ['Smoke Resistant (Kobold)', 'poison'],
    ['Fey-Wise (Sevenarches)', 'spellLike'],
    ['Foe of the Strange (Strange Aeons)', 'spellLike'],
    ['Curse Queller (Osirion)', 'spells'],
    ['Free Spirit', 'spells'],
    ['Big Boned (Tiefling; Hungerseed)', 'trip'],
  ] as const) {
    const resolved = resolveSheet(modifiers(name), { situations: [key] });
    expect(
      [...saves(resolved), resolved.cmb.total, resolved.cmd.total],
      name,
    ).toEqual([0, 0, 0, 0, 0]);
  }
  // Foundry files these notes on other statistics; the reviewed Modifiers
  // land where the body puts them.
  for (const [name, targets] of [
    ['Shield Bearer (Human; Ulfen)', ['damage.melee']],
    ['Searing Beacon (Iomedae; Ozem)', ['damage.melee']],
    ['Hot Headed (Ifrit)', ['damage']],
    ['Cross-Disciplined', ['casterLevel']],
    ["Ex-Asmodean (Hell's Rebels)", ['attack', 'damage', 'spellDC']],
    ['Rude Songs (Goblin)', ['skill.prf']],
    ['Goblin Bravery (Goblin)', ['attack.melee']],
    ['Tarnished Halls Runner', ['ac', 'attack']],
    ['Influential (Sovereign Court)', ['skill.dip', 'spellDC']],
    ['Savanna Hunter', ['attack']],
  ] as const)
    expect(
      modifiers(name).map((row) => row.target),
      name,
    ).toEqual(targets);
  // Untyped bonuses and penalties stay untyped, as published; Tarnished Halls
  // Runner's AC bonus is a dodge bonus.
  for (const name of [
    'Aeromantic Affinity',
    'Shield Bearer (Human; Ulfen)',
    'Cross-Disciplined',
    'Oblivious',
    'Foul Brand (Face)',
    'Overprotective',
    'Rabble Rebel (Galt; Halfling)',
    'Information Overload',
    'Legalistic Liberation (Halfling; Molthune, Osirion)',
    'Influential (Sovereign Court)',
    'Searing Beacon (Iomedae; Ozem)',
    'Infamous',
    'Carrying Voice (Sylph)',
  ])
    expect(new Set(modifiers(name).map((row) => row.bonusType)), name).toEqual(
      new Set(['untyped']),
    );
  expect(
    modifiers('Tarnished Halls Runner').map((row) => row.bonusType),
  ).toEqual(['dodge', 'trait']);
  expect(
    modifiers('Passionate Inertia').map((row) => [row.bonusType, row.value]),
  ).toEqual([
    ['trait', 2],
    ['untyped', -1],
  ]);
  // Drawback penalties: Oblivious's -2 on Sense Motive always applies and on
  // sight-based Perception under its Situation; Overprotective's and
  // Infamous's wait for theirs.
  const oblivious = 'Oblivious';
  expect(resolveSheet(modifiers(oblivious))['skill.sen'].total).toBe(-2);
  expect(resolveSheet(modifiers(oblivious))['skill.per'].total).toBe(0);
  expect(
    resolveSheet(modifiers(oblivious), {
      situations: [
        situation(oblivious, indexOf(oblivious, 'skill.per', 'sight')),
      ],
    })['skill.per'].total,
  ).toBe(-2);
  for (const [name, target, label, value] of [
    ['Overprotective', 'skill.acr', 'unconscious', -2],
    ['Infamous', 'skill.dip', 'law-abiding', -4],
  ] as const) {
    const index = indexOf(
      name,
      target === 'skill.acr' ? 'skills' : target,
      label,
    );
    expect(resolveSheet(modifiers(name))[target].total, name).toBe(0);
    expect(
      resolveSheet(modifiers(name), { situations: [situation(name, index)] })[
        target
      ].total,
      name,
    ).toBe(value);
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
  expect(required).toBe(127);
  // Repeated notes on other targets are covered by the record that carries
  // the rule once; they are the explicit covered/no-output records.
  expect(
    heldTraits.flatMap((row) =>
      row.mechanicsReview.curationRecords
        .filter((record) => !record.outputs.length)
        .map((record) => `${row.name} ${record.target}`),
    ),
  ).toEqual([
    'Guiding Spirit allSavingThrows',
    'Guiding Spirit cl',
    'Guiding Spirit concentration',
    'Guiding Spirit effect',
    'Guiding Spirit init',
    'Guiding Spirit skills',
    'Longlung (Monkey Goblin) skill.swm',
    'Doubt skills',
    'Solidarity (City of Brass) skill.esc',
  ]);
  // Notes the drafter put on unrelated statistics are entry-level.
  for (const name of [
    'Shield Bearer (Human; Ulfen)',
    'Smoke Resistant (Kobold)',
    'Frightening Speed (Achaekek)',
    'Chillblight Emissary (Irrisen)',
    'Guiding Spirit',
    'Resilient Caster',
    'Solidarity (City of Brass)',
    "Binder's Blood",
    'Savanna Hunter',
  ])
    expect(
      entry(name)
        .situationalNotes?.filter((note) => note.target)
        .map((note) => note.target),
      name,
    ).toEqual([]);
  // Information Overload keeps its false-recall Note on every Knowledge skill.
  expect(
    entry('Information Overload')
      .situationalNotes?.filter((note) => note.target)
      .map((note) => note.target),
  ).toHaveLength(10);
  // Calculated Bribe's "level times; 10" is a reroll cost, not a +10 bonus.
  expect(modifiers('Calculated Bribe')).toEqual([]);
  // Every outstanding calculation is recorded, never as an attribution hold.
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
      `traits-380-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `traits-380-notice-${book}-complete-chain`),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    heldTraits
      .filter((row) => row.traitType === 'drawback')
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Doubt',
    'Foul Brand (Face)',
    'Infamous',
    'Information Overload',
    'Oblivious',
    'Overprotective',
  ]);
  // Inherited rules the bodies change or depend on.
  for (const [name, book] of [
    ['Black Powder Interjection', 'PZO1118'],
    ['Cross-Disciplined', 'PZO1117'],
    ['Unblemished Barrel', 'PZO1118'],
    ['Cellular Match (Android)', 'PZO1133'],
    ['Lichblood (Hold of Belkzen)', 'PZO1129'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Class features name the pinned class record's literal line.
  for (const [name, file] of [
    ['Black Powder Interjection', 'gunslinger.jOUMbWoFZHQlAMpJ.yaml#L113'],
    ['Cross-Disciplined', 'magus.xZLcyrEKYZoJPS2k.yaml#L104'],
    ['Lichblood (Hold of Belkzen)', 'bloodrager.E27lMw9YNOAjS009.yaml#L97'],
  ] as const)
    expect(
      candidate(name).inheritedRuleNotices.some((notice) =>
        notice.location.endsWith(file),
      ),
      name,
    ).toBe(true);
  // The two records with no pinned source take their book from PCGen.
  for (const [name, book] of [
    ['Black Powder Interjection', 'PZO1125'],
    ['Blackjacket Weapon Flair', 'PZO9463'],
  ] as const) {
    expect(candidate(name).citedSources, name).toEqual([]);
    expect(candidate(name).comparison?.book, name).toBe(book);
    expect(candidate(name).requiredNotices[0], name).toBe(book);
  }
  // Unchained action-cost metadata anywhere in the bound closure, the
  // trait's own actions included, requires the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedLinked])].sort();
  expect(unchained).toHaveLength(14);
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
      'traits-380-notice-PZO1131-complete-chain',
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
  // Same-name rows of other traits, unpinned printings and books a body only
  // names as a condition are not required.
  for (const [name, book] of [
    ["Devotee of the Old Gods (Mummy's Mask)", 'PZO9441'],
    ['Traditionalist (Faiths and Philosophies)', 'PZO9472'],
    ['The Wagon', 'PZO9474'],
    ['Tarnished Halls Runner', 'PZO1118'],
    ['Tarnished Halls Runner', 'PZO9272'],
    ['Divine the Mystery (Human; Kellid)', 'PZO1127'],
  ] as const)
    expect(candidate(name).requiredNotices, name).not.toContain(book);
  expect(
    heldTraits
      .flatMap((row) => row.linkedContentReview.map((linked) => linked.name))
      .sort(),
  ).toEqual(['Light', 'Sanctuary']);
  expect(preview.closure.map((row) => row.externalKey).sort()).toEqual([
    'pf1/ip9onjfp6nf1vlv9',
    'pf1/yk5bgi6j9kbtigof',
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
  // Unresolved links and descriptors no permitted evidence sources stay
  // named unresolved origins.
  for (const [name, text] of [
    ['Chillblight Emissary (Irrisen)', 'Sickened condition journal page'],
    ['Abendego Pilot (Eye of Abendego; Sylph)', 'Winds rules journal'],
    ['Curse Queller (Osirion)', 'curse descriptor'],
  ] as const)
    expect(candidate(name).inheritedRuleUnresolvedOrigins, name).toEqual([
      expect.stringContaining(text),
    ]);
  for (const key of journalLinked)
    expect(bodies.get(key)?.unsupported, key).not.toContainEqual(
      expect.objectContaining({ field: 'description.link' }),
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
    candidate(name).mechanicsReview.prerequisiteReview.outstandingFacts;
  // "Halfling; Molthune, Osirion" maps both regions as required (#739).
  const legalistic = 'Legalistic Liberation (Halfling; Molthune, Osirion)';
  expect(kinds(legalistic)).toEqual(['race', 'unchecked', 'unchecked']);
  expect(facts(legalistic)).toEqual(
    expect.arrayContaining([expect.stringContaining('#739')]),
  );
  // Iomedae maps a deity atom; the order membership stays unchecked.
  expect(entry('Searing Beacon (Iomedae; Ozem)').prerequisites).toEqual([
    { kind: 'deity', deity: 'Iomedae' },
    { kind: 'unchecked', unchecked: 'Knight of Ozem' },
  ]);
  for (const [name, gap] of [
    ['Watchdog (Shadow Lodge)', 'no faction fact exists'],
    ['Shield Bearer (Human; Ulfen)', 'no heritage or ethnicity fact exists'],
    ['Spirit Guide (Pharasma)', 'no deity fact exists'],
    ['Fey-Wise (Sevenarches)', 'no region fact exists'],
    ['The Wagon', 'no birth-date fact exists'],
    ['Calculated Bribe', 'no knightly code fact exists'],
    ['Searing Beacon (Iomedae; Ozem)', 'no order membership fact exists'],
    ['Lichblood (Hold of Belkzen)', 'no class feature fact exists'],
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
  // Spirit Guide's body equals its Inner Sea Gods row's benefit.
  expect(candidate('Spirit Guide (Pharasma)').comparison?.literalRow).toContain(
    'BONUS:SKILL|Knowledge (religion)|2|TYPE=Trait',
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
      required: 127,
      checked: 127,
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
    // #738 keeps Chillblight Emissary's Sickened journal link and Abendego
    // Pilot's Winds journal link as text: every trait is held on its own
    // reasons.
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
    const orphan = candidate('Narrow Escape (The Shackles)');
    expect(orphan.requiredNotices).toEqual(['PZO9422', 'PZO1115', 'PZO1110']);
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
