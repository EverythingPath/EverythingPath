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
} from '../fixtures/traits-372/data';
import { reviewedTraitSheet } from '../fixtures/traits-372/sheet';
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
  'Charming Smile, Cunning Soul',
  'Footsteps of Aganhei (Crown of the World)',
  'Reverent Wielder (Scarab Sages)',
  "Freedom Fighter (Liberty's Edge)",
  'Excellent Penmanship',
  'Mechanical Expertise (Alkenstar)',
  'Mind Over Matter (Lantern Lodge)',
  'Sodden Child (Sodden Lands)',
  'Cynical',
  'Pact Servant',
  'Ancient Historian (Scarab Sages)',
  'Upstanding (The Exchange)',
  'A Sure Thing (Silver Crusade)',
  'Coven Casting',
  'Undergrowth Specialist',
  'Teaching Mistake (Grand Lodge)',
  'Charau-Ka Slayer (Mwangi Expanse)',
];

// Every trait whose bound content closure keeps Unchained action-cost
// metadata (owner ruling, 2026-10-17): 13 on the trait's own action, one of
// them (Superstitious Ward) also through its linked Disrupt Undead.
const unchainedOwn = [
  'pf1-content/Fb6CmqKkpWQ6q2fu', // Kalistocratic Prophecy
  'pf1-content/FbKbQqa4psU4LF1c', // Destined Pioneer
  'pf1-content/FoNMdhue2TKpAmdu', // Wrecking Wrath
  'pf1-content/GiGEJPMbZ5UQvgT3', // Eyes of the Sun
  'pf1-content/H37GNsiXtvYuVCPd', // Elemental Apprentice
  'pf1-content/HL6FH76UoieVqP1H', // A Sure Thing
  'pf1-content/HNXWTcO5is6TLjTV', // Kin Bond
  'pf1-content/HUDkxceysyTrxIEH', // Teaching Mistake
  'pf1-content/HXZdgvtdmiV1F84b', // Good Slip
  'pf1-content/HkdSMUrQiad3D1R5', // Meticulous Concoction
  'pf1-content/Hrn8A50dVWscbm2g', // Mock Gladiator
  'pf1-content/I4x05JPbZJssJMuq', // Superstitious Ward (also Disrupt Undead)
  'pf1-content/I8y9JHIViNQUwjFO', // Mystery Initiate
];
const unchainedLinked = [
  'pf1-content/I4x05JPbZJssJMuq', // Superstitious Ward: Disrupt Undead
];

it('resolves the reviewed trait Modifiers, with trait bonuses that never stack', () => {
  // Hermean Paragon and Outlander - Exile: two traits' +2 trait bonuses on
  // initiative; Gruff Watcher's +1 beside them changes nothing.
  for (const name of [
    'Hermean Paragon (the Steaming Sea)',
    'Outlander - Exile (Any Campaign)',
  ] as const)
    expect(total(reviewedTraitSheet(name), 'init'), name).toBe(2);
  expect(
    total(
      reviewedTraitSheet(
        'Hermean Paragon (the Steaming Sea)',
        'Outlander - Exile (Any Campaign)',
        'Gruff Watcher (Human; Ulfen)',
      ),
      'init',
    ),
  ).toBe(2);
  // A bonus that rises in a Situation is its new total: Vigilant Battler's
  // +1 on Sense Motive becomes +2 against a feint, not +3.
  const vigilant = 'Vigilant Battler';
  expect(resolveSheet(modifiers(vigilant))['skill.sen'].total).toBe(1);
  expect(
    resolveSheet(modifiers(vigilant), {
      situations: [
        situation(vigilant, indexOf(vigilant, 'skill.sen', 'feint')),
      ],
    })['skill.sen'].total,
  ).toBe(2);
  // Feline Instinct's +3 waits for its surprise-round Situation.
  const feline = 'Feline Instinct (Skinwalker; Weretiger-Kin)';
  expect(total(reviewedTraitSheet(feline), 'init')).toBe(0);
  expect(
    resolveSheet(modifiers(feline), { situations: [situation(feline, 0)] }).init
      .total,
  ).toBe(3);
  // Bruising Intellect adds the Intelligence modifier's excess over Charisma
  // on Intimidate and never lowers the check.
  const bruising = (int: number, cha: number) => {
    const sheet = reviewedTraitSheet('Bruising Intellect');
    const base = sheet.catalogEntries[0]!;
    base.modifiers = (base.modifiers ?? []).map((row) =>
      row.target === abilityTargets.intelligence
        ? { ...row, value: int }
        : row.target === abilityTargets.charisma
          ? { ...row, value: cha }
          : row,
    );
    return calculateCharacterSheetProjections(sheet).current.breakdowns[
      'skill.int'
    ].total;
  };
  expect(bruising(16, 10)).toBe(3);
  expect(bruising(8, 14)).toBe(2);
  // Unmapped or targetless imported changes contribute nothing; reviewed
  // Modifiers supply the rule under its Situation.
  // Defender of the Society's +1 trait bonus on AC lands on the other leaf,
  // as a trait bonus, not on an armor leaf.
  for (const [name, target, leaf, value] of [
    ['Magical Knack', 'casterLevel', 'casterLevel', 2],
    [
      'Defender of the Society (Fighter, Pathfinder Society)',
      'ac',
      'ac.other',
      1,
    ],
    ['Trench Navigator (Xidao)', 'skill.pro', 'skill.pro', 1],
    ['Mechanical Expertise (Alkenstar)', 'skill.dev', 'skill.dev', 1],
    ['Exchange Agent (Shattered Star)', 'skill.lin', 'skill.lin', 1],
  ] as const) {
    expect(entry(name).unsupported, name).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
    );
    const index = modifiers(name).findIndex((row) => row.target === target);
    expect(resolveSheet(modifiers(name))[leaf].total, name).toBe(0);
    expect(
      resolveSheet(modifiers(name), { situations: [situation(name, index)] })[
        leaf
      ].total,
      name,
    ).toBe(value);
  }
  // Choices are one Situation per option.
  for (const [name, count] of [
    ['Mechanical Expertise (Alkenstar)', 3],
    ['Exchange Agent (Shattered Star)', 4],
    ['Ancestral Weapon (Numeria)', 2],
    ['Triaxian Tradition (Triaxus)', 3],
  ] as const)
    expect(modifiers(name), name).toHaveLength(count);
  // Shared Situations where the body's condition matches exactly.
  expect(
    resolveSheet(modifiers('Contagious Mettle'), { situations: ['fear'] })[
      'save.will'
    ].total,
  ).toBe(1);
  const heart = resolveSheet(modifiers('Strong Heart (Gorum)'), {
    situations: ['fear'],
  });
  expect([
    heart['save.fort'].total,
    heart['save.ref'].total,
    heart['save.will'].total,
  ]).toEqual([1, 1, 1]);
  expect(
    resolveSheet(modifiers('Cynical'), { situations: ['illusions'] })[
      'save.will'
    ].total,
  ).toBe(1);
  expect(
    resolveSheet(modifiers("Angradd's Valor (Angradd)"), {
      situations: ['charging'],
    })['attack.melee'].total,
  ).toBe(1);
  // Dedicated Defender adds an adjacency condition to overcoming spell
  // resistance, so the shared Situation leaves it out.
  expect(
    resolveSheet(modifiers('Dedicated Defender'), {
      situations: ['spellResistance'],
    }).casterLevel.total,
  ).toBe(0);
  // Foundry files these notes on attack rolls; the reviewed bonuses are on
  // damage.
  for (const [name, target] of [
    ['Master of the Sudden Strike (Human; Tian)', 'damage'],
    ['Zest for Battle (Dwarf)', 'damage'],
    ['Shadow Stabber (Tiefling)', 'damage.melee'],
  ] as const)
    expect(
      modifiers(name).map((row) => row.target),
      name,
    ).toEqual([target]);
  expect(
    modifiers('Peg Leg (Skull and Shackles)').map((row) => row.target),
  ).toEqual(['save.fort', 'damage']);
  // Untyped bonuses stay untyped.
  for (const name of [
    'Excellent Penmanship',
    'A Sure Thing (Silver Crusade)',
    'Giant Investigator (Coast)',
  ])
    expect(new Set(modifiers(name).map((row) => row.bonusType)), name).toEqual(
      new Set(['untyped']),
    );
  expect(
    modifiers('Social Slaver (Cheliax)').map((row) => [
      row.target,
      row.bonusType,
    ]),
  ).toEqual([
    ['skill.int', 'trait'],
    ['spellDC', 'untyped'],
  ]);
  // Righteous Indignation's -1 Will penalty waits for its Situation.
  const indignation = 'Righteous Indignation';
  expect(resolveSheet(modifiers(indignation))['save.will'].total).toBe(0);
  expect(
    resolveSheet(modifiers(indignation), {
      situations: [situation(indignation, 0)],
    })['save.will'].total,
  ).toBe(-1);
  // Mountain Guide's Knowledge (geography) bonus waits for the same
  // mountainous-areas Situation as Survival: a reviewed change replacement
  // sets the unconditional imported change to 0 (owner decision, #372 fix
  // round 1). Mutabi-qi Explorer's repeated "checks" keeps its Knowledge
  // (geography) bonus unrestricted.
  const mountain = 'Mountain Guide (Five Kings Mountains)';
  const away = resolveSheet(modifiers(mountain));
  expect([away['skill.kge'].total, away['skill.sur'].total]).toEqual([0, 0]);
  const mountains = situation(
    mountain,
    indexOf(mountain, 'skill.kge', 'mountainous areas'),
  );
  expect(mountains).toEqual(
    situation(mountain, indexOf(mountain, 'skill.sur', 'mountainous areas')),
  );
  const climbing = resolveSheet(modifiers(mountain), {
    situations: [mountains],
  });
  expect([climbing['skill.kge'].total, climbing['skill.sur'].total]).toEqual([
    1, 1,
  ]);
  expect(
    resolveSheet(modifiers('Mutabi-qi Explorer (Shanguang)'))['skill.kge']
      .total,
  ).toBe(1);
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
  expect(required).toBe(112);
  // Azlanti Inheritor's skills note is the one explicit covered/no-output
  // record: its attack record carries the aid another rule.
  expect(
    heldTraits.flatMap((row) =>
      row.mechanicsReview.curationRecords
        .filter((record) => !record.outputs.length)
        .map((record) => `${row.name} ${record.target}`),
    ),
  ).toEqual(['Azlanti Inheritor (Gillman) skills']);
  // Shoanti Steed's inline roll reads as its expression.
  expect(
    entry('Shoanti Steed (Human; Shoanti)').situationalNotes?.some((note) =>
      note.text.includes('arrives within 1d6 minutes'),
    ),
  ).toBe(true);
  // The drafter's spell DC placeholders on Extended Toil are dropped.
  expect(
    entry('Extended Toil (Droskar)').situationalNotes?.filter(
      (note) => note.target === 'spellDC',
    ),
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
    'Gruff Watcher (Human; Ulfen)',
    'Hermean Paragon (the Steaming Sea)',
    'Mana Wastes Survivalist (Mana Wastes)',
    'Mind Over Matter (Lantern Lodge)',
    'Outlander - Exile (Any Campaign)',
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
      `traits-372-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `traits-372-notice-${book}-complete-chain`),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    heldTraits
      .filter((row) => row.traitType === 'drawback')
      .map((row) => row.name)
      .sort(),
  ).toEqual(['Avarice', 'Magical Klutz', 'Righteous Indignation']);
  for (const [name, book] of [
    ['Kalistocratic Prophecy', 'PZO1125'],
    ['Peg Leg (Skull and Shackles)', 'PZO9422'],
    ['Shoanti Steed (Human; Shoanti)', 'PZO1123'],
    ['Superstitious Ward (Ustalav)', 'PZO1110'],
    ['Charming Smile, Cunning Soul', 'PZO1115'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Class features name the pinned class record's literal line.
  for (const [name, path] of [
    ['Meticulous Concoction', 'alchemist.JcaqlAawhf14q1lq.yaml#L65'],
    ['Meticulous Concoction', 'alchemist.JcaqlAawhf14q1lq.yaml#L63'],
    ['Alchemical Prodigy (Thuvia)', 'alchemist.JcaqlAawhf14q1lq.yaml#L63'],
    ['Dedicated Defender', 'summoner.BrnHPJ2EVSQSyNQ8.yaml#L97'],
    ['Pact Servant', 'inquisitor.Fv3FbmXptuDRiL5y.yaml#L115'],
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
  expect(unchained).toHaveLength(13);
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
      'traits-372-notice-PZO1131-complete-chain',
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
  // Same-name traits of other books and rows the pinned body does not cite
  // are not required.
  for (const [name, book] of [
    ["Freedom Fighter (Liberty's Edge)", 'PZO9404'],
    ["Freedom Fighter (Liberty's Edge)", 'PZO9421'],
    ["Freedom Fighter (Liberty's Edge)", 'PZO9422'],
    ['Azlanti Inheritor (Gillman)', 'PZO9417'],
    ['Alchemical Prodigy (Thuvia)', 'PZO9406'],
    ['Exchange Agent (Shattered Star)', 'PZO9226'],
  ] as const)
    expect(candidate(name).requiredNotices, name).not.toContain(book);
  // Footsteps of Aganhei cites no source and has no PCGen row.
  expect(
    candidate('Footsteps of Aganhei (Crown of the World)').citedSources,
  ).toEqual([]);
  expect(
    heldTraits
      .flatMap((row) => row.linkedContentReview.map((linked) => linked.name))
      .sort(),
  ).toEqual([
    'Disrupt Undead',
    'Favored Terrain',
    'Outlander - Lore Seeker (Any Campaign)',
    'Outlander - Missionary (Any Campaign)',
    'Saddle (riding)',
  ]);
  expect(preview.closure.map((row) => row.externalKey).sort()).toEqual([
    'pf1-content/0mlO02qRdJH6656V',
    'pf1-content/KVrNf7eTgJbtA8gl',
    'pf1/U2YBSx1s8cT8iDq1',
    'pf1/dn6yBOrH8vUpXahk',
    'pf1/oyu8efso7sio8arn',
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
  for (const [name, origin] of [
    ['Righteous Indignation', 'emotion descriptor'],
    ['Triaxian Tradition (Triaxus)', 'disease descriptor'],
    ["Natural Born Leader (Hell's Rebels)", 'rebellion rules'],
    ['Shoanti Steed (Human; Shoanti)', 'NFafBpbIMEXHQyt0'],
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
      batch: 'traits-372',
      candidate: candidate(name),
    });
  // "or" alternatives read as all required, or split so they lose their
  // referent; two races read as both required; a requirement on the line
  // after its label maps nothing (#739).
  for (const [name, mapped] of [
    ['Greenskin Stalker (Isger, River Kingdoms, Varisia)', ['unchecked']],
    ['Debt to a Witch (Irrisen)', ['unchecked']],
    ['Amazingly Ugly (Half-Orc, Orc)', ['anyOf']],
    ['Snowstride (Darklands)', ['unchecked', 'unchecked']],
    ['Azlanti Inheritor (Gillman)', undefined],
  ] as const) {
    expect(kinds(name), name).toEqual(mapped);
    expect(facts(name), name).toEqual(
      expect.arrayContaining([expect.stringContaining('#739')]),
    );
  }
  expect(kinds('Monkey Goblin (Goblin; Mediogalti)')).toEqual([
    'race',
    'unchecked',
  ]);
  for (const [name, gap] of [
    ['Reverent Wielder (Scarab Sages)', 'no faction fact exists'],
    ['Gruff Watcher (Human; Ulfen)', 'no heritage or ethnicity fact exists'],
    ["Angradd's Valor (Angradd)", 'no deity fact exists'],
    ['Lastwall Cavalry Rider (Lastwall)', 'no region fact exists'],
    ['Contagious Mettle', 'no code-of-conduct fact exists'],
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
  // The Basic (Social) folder is pack organization, excluded by the
  // importer's folder contract.
  expect(folders).toEqual([
    expect.objectContaining({
      externalKey: 'pf1-content/FeKDEoyX2eafWdJl',
      name: 'Basic (Social)',
      rawKey: '!folders!FeKDEoyX2eafWdJl',
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
  // The Hermean Paragon body equals its Inner Sea Primer row's benefit.
  expect(
    candidate('Hermean Paragon (the Steaming Sea)').comparison?.literalRow,
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
      required: 112,
      checked: 112,
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
    // Shoanti Steed links a horse record absent from the pinned pack; the
    // importer strips the link and the gate reports the entry before its
    // holds apply.
    expect(gate.failures.filter((row) => ours.has(row.externalKey))).toEqual([
      {
        externalKey: 'pf1-content/HgA24k6KAT0Xkb5u',
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
    const hermean = candidate('Hermean Paragon (the Steaming Sea)');
    expect(hermean.requiredNotices).toEqual(['PZO9414', 'PZO1115', 'PZO1110']);
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === hermean.externalKey
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(
      confirmed.admitted.some((row) => row.externalKey === hermean.externalKey),
    ).toBe(false);
    expect(
      confirmed.held.find((row) => row.externalKey === hermean.externalKey)
        ?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});
