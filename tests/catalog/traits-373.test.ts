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
} from '../fixtures/traits-373/data';
import { reviewedTraitSheet } from '../fixtures/traits-373/sheet';
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
  'Callous',
  'Rapid Drain (Vampire; Nosferatu)',
  'The Newlyweds',
  'Volatile Fuse',
  'Unorthodox Strategy (Silver Crusade)',
  'Cavern Survivor (Nar-Voth)',
  'Insatiable',
  'Alkenstar Engineer',
  'Contemptuous',
  'Creative Reality (Ganzi)',
  "The Reclaimer (Tyrant's Grasp)",
  'Devout Visionary',
  'Preternatural Awareness',
  "The Outsider (Tyrant's Grasp)",
  'Abject Belief',
];

// Every trait whose bound content closure keeps Unchained action-cost
// metadata (owner ruling, 2026-10-17): 11 on the trait's own action and 5
// through a linked body, Winter's Soul both ways.
const unchainedOwn = [
  'pf1-content/IlvDg6IUWFRUPvTw', // Cheat Death
  'pf1-content/IstR2czenXYHYQgm', // St. Clydwell's Ward
  'pf1-content/JSipk2rTNCT0nPNM', // Unseen but Not Undone
  'pf1-content/JlK99yMeZoCHXg2I', // Slithering Stride
  'pf1-content/K7N6hhUR8DfdLUTP', // Winter's Soul (also Ray of Frost)
  'pf1-content/KRwH7QDMRRM6ezEp', // Frost Spitter
  'pf1-content/KbUs4n95TQD782w4', // Transitional
  'pf1-content/KtNx7EHNi8lcrKLz', // Inner Beauty
  'pf1-content/Kv6pIahyHoJmOxDL', // Alluring
  'pf1-content/KyhoAvpzqEYZSa9P', // Unbreakable Survivor
  'pf1-content/LAmQgc59TBtZP1g1', // Devout Visionary
];
const unchainedLinked = [
  'pf1-content/ItmWYBOAQpP0IYdd', // Lightning Blessed: Bottled lightning
  'pf1-content/JalH63VxUIp3urjY', // Envoy of Healing: Channel Energy, Fervor, Lay on Hands
  'pf1-content/JmBTIrmBVO4MQUy3', // Ooze Defense: Alkali Flask
  'pf1-content/K7N6hhUR8DfdLUTP', // Winter's Soul: Ray of Frost
  'pf1-content/Ks4sYAlnpuUIZVv4', // Icy Mementos: Liquid Ice and the spells it links
];

it('resolves the reviewed trait Modifiers, with trait bonuses that never stack', () => {
  // Three traits' +1 trait bonuses on Knowledge (nobility) never stack.
  for (const name of [
    'Traditionalist (Divine Anthology)',
    'Crusader Tactician (Lastwall)',
    'Contemptuous',
  ] as const)
    expect(total(reviewedTraitSheet(name), 'skill.kno'), name).toBe(1);
  expect(
    total(
      reviewedTraitSheet(
        'Traditionalist (Divine Anthology)',
        'Crusader Tactician (Lastwall)',
        'Contemptuous',
      ),
      'skill.kno',
    ),
  ).toBe(1);
  // A bonus that rises in a Situation is its new total: Creative Reality's
  // +1 on Bluff becomes +5, not +6, beside Sharp Wits' +1.
  const creative = 'Creative Reality (Ganzi)';
  expect(resolveSheet(modifiers(creative))['skill.blf'].total).toBe(1);
  expect(
    resolveSheet(
      [...modifiers(creative), ...modifiers('Sharp Wits (Human; Vudrani)')],
      {
        situations: [
          situation(creative, indexOf(creative, 'skill.blf', 'falsehood')),
        ],
      },
    )['skill.blf'].total,
  ).toBe(5);
  // Sharp Wits' unmapped concentration change is supplied by its reviewed
  // Modifier.
  expect(entry('Sharp Wits (Human; Vudrani)').unsupported).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        field: 'changes',
        value: expect.objectContaining({ target: 'concentration' }),
      }),
    ]),
  );
  const wits = calculateCharacterSheetProjections(
    reviewedTraitSheet('Sharp Wits (Human; Vudrani)'),
  ).current.breakdowns;
  expect([wits['skill.blf'].total, wits.concentration.total]).toEqual([1, 1]);
  // Practiced Disruptor's +1 needs a rank in Knowledge (arcana), and stays +1
  // with more ranks (the ranks themselves are not Modifiers).
  const disruptor = modifiers('Practiced Disruptor');
  for (const [ranks, value] of [
    [0, 0],
    [1, 1],
    [4, 1],
  ] as const)
    expect(
      resolveSheet(disruptor, { skillRanks: { 'skill.kar': ranks } })[
        'skill.kar'
      ].total,
      `${ranks} ranks`,
    ).toBe(value);
  // Transitional's weather bonus is 3 + 1/2 your character level.
  const transitional = 'Transitional (Triaxian)';
  const weather = situation(
    transitional,
    indexOf(transitional, 'skill.sur', 'weather'),
  );
  for (const [level, value] of [
    [1, 3],
    [6, 6],
    [11, 8],
  ] as const)
    expect(
      resolveSheet(modifiers(transitional), { level, situations: [weather] })[
        'skill.sur'
      ].total,
      `level ${level}`,
    ).toBe(value);
  // Targetless or unsupported imported changes contribute nothing; reviewed
  // Modifiers supply the rule under its Situation.
  for (const [name, target, value] of [
    ['Color Thief (Goblin)', 'skill.ste', 2],
    ['Clan Artisan (Xa Hoi)', 'skill.crf', 2],
    ['Brastlewark Businessman (Gnome)', 'skill.crf', 2],
    ['Hero Worship (Jade Regent)', 'concentration', 2],
  ] as const) {
    expect(entry(name).unsupported, name).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
    );
    const index = modifiers(name).findIndex((row) => row.target === target);
    expect(resolveSheet(modifiers(name))[target].total, name).toBe(0);
    expect(
      resolveSheet(modifiers(name), { situations: [situation(name, index)] })[
        target
      ].total,
      name,
    ).toBe(value);
  }
  // Hero Worship's untyped +1 against attacks of opportunity lands on the
  // other AC leaf.
  const hero = 'Hero Worship (Jade Regent)';
  expect(
    resolveSheet(modifiers(hero), {
      situations: [situation(hero, indexOf(hero, 'ac', 'Shalelu'))],
    })['ac.other'].total,
  ).toBe(1);
  // Choices are one Situation per option.
  for (const [name, count] of [
    ['Dragon Armor', 5],
    ['Propitiation (any dwarven deity)', 6],
    ['Inner Beauty (Shelyn)', 4],
    ['Hero Worship (Jade Regent)', 3],
  ] as const)
    expect(modifiers(name), name).toHaveLength(count);
  // Shared Situations only where the body's condition matches exactly.
  expect(
    resolveSheet(modifiers('Abject Belief'), { situations: ['fear'] })[
      'save.will'
    ].total,
  ).toBe(2);
  for (const [name, key] of [
    ['Perpetual Companion', 'fear'],
    ['Vile Kiss (Tiefling; The Motherless)', 'dirtyTrick'],
    ['Burnished Skin (Aasimar; Emberkin)', 'illusions'],
    ['Hagfish Hopeful (Rise of the Runelords)', 'poison'],
  ] as const) {
    const resolved = resolveSheet(modifiers(name), { situations: [key] });
    expect(
      [
        resolved['save.fort'].total,
        resolved['save.ref'].total,
        resolved['save.will'].total,
        resolved.cmb.total,
      ],
      name,
    ).toEqual([0, 0, 0, 0]);
  }
  // Foundry files these notes on attack rolls; the reviewed bonuses are on
  // damage too, or only.
  for (const [name, targets] of [
    ['Flair for Destruction (Tiefling; Pitborn)', ['damage']],
    ['Lastwall Defender', ['attack', 'damage']],
    ["The Reclaimer (Tyrant's Grasp)", ['skill.per', 'attack', 'damage']],
  ] as const)
    expect(
      modifiers(name).map((row) => row.target),
      name,
    ).toEqual(targets);
  // Armed Grit's bonus is on all saves against fear, not only Will.
  expect(modifiers('Armed Grit').map((row) => row.target)).toEqual(['saves']);
  // Untyped bonuses and penalties stay untyped; the map's bonus is competence.
  for (const name of ['The Newlyweds', 'Guilty Fraud', 'Sleepy'])
    expect(new Set(modifiers(name).map((row) => row.bonusType)), name).toEqual(
      new Set(['untyped']),
    );
  expect(
    modifiers('Outlander - Lore Seeker (Any Campaign)').map((row) => [
      row.target,
      row.bonusType,
    ]),
  ).toEqual([
    ['skill.kar', 'trait'],
    ['casterLevel', 'untyped'],
    ['spellDC', 'untyped'],
  ]);
  expect(
    modifiers("Boarded in Cheliax (Serpent's Skull)").map(
      (row) => row.bonusType,
    ),
  ).toEqual(['competence']);
  // Guilty Fraud's -4 Bluff penalty waits for its Situation.
  const fraud = 'Guilty Fraud';
  expect(resolveSheet(modifiers(fraud))['skill.blf'].total).toBe(0);
  expect(
    resolveSheet(modifiers(fraud), { situations: [situation(fraud, 0)] })[
      'skill.blf'
    ].total,
  ).toBe(-4);
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
  expect(required).toBe(79);
  // Born under the Cradle's skills note is the one explicit covered/no-output
  // record: the body grants the bonus on attack rolls only.
  expect(
    heldTraits.flatMap((row) =>
      row.mechanicsReview.curationRecords
        .filter((record) => !record.outputs.length)
        .map((record) => `${row.name} ${record.target}`),
    ),
  ).toEqual(['Born under the Cradle skills']);
  // Notes the drafter put on unrelated statistics are entry-level.
  for (const name of [
    'Rapid Drain (Vampire; Nosferatu)',
    'Insatiable',
    'Unseen but Not Undone',
  ])
    expect(
      entry(name)
        .situationalNotes?.filter((note) => note.target)
        .map((note) => note.target),
      name,
    ).toEqual([]);
  // Every outstanding calculation is recorded, never as an attribution hold.
  for (const row of heldTraits)
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  expect(
    heldTraits
      .filter((row) => !row.mechanicsReview.outstandingCalculations.length)
      .map((row) => row.name),
  ).toEqual(['Sharp Wits (Human; Vudrani)']);
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
      `traits-373-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `traits-373-notice-${book}-complete-chain`),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    heldTraits
      .filter((row) => row.traitType === 'drawback')
      .map((row) => row.name)
      .sort(),
  ).toEqual(['Guilty Fraud', 'Insatiable', 'Sleepy']);
  // Inherited rules the bodies change or depend on.
  for (const [name, book] of [
    ['Mischievous Smite (Chaldira Zuzaristan)', 'PZO1115'],
    ['Rapid Drain (Vampire; Nosferatu)', 'PZO1112'],
    ['Holy Tattoo (Varisia)', 'PZO1112'],
    ['Holy Tattoo (Varisia)', 'PZO1123'],
    ['Volatile Fuse', 'PZO1118'],
    ['Alkenstar Engineer', 'PZO1118'],
    ['Envoy of Healing (Sarenrae)', 'PZO1129'],
    ['Nine-Tailed Scion (Kitsune)', 'PZO1121'],
    ['Nine-Tailed Scion (Kitsune)', 'PZO9280'],
    ['Perpetual Companion', 'PZO1115'],
    ['Urban Acolyte', 'PZO1115'],
    ['Lightning Blessed (Kobold)', 'PZO1123'],
    ['Ooze Defense (Kobold)', 'PZO9210'],
    ['Icy Mementos (Kobold)', 'PZO9410'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Class features name the pinned class record's literal line.
  for (const [name, path] of [
    ['Envoy of Healing (Sarenrae)', 'warpriest.KgxFsHNv0g1GbvmS.yaml#L95'],
    ['Envoy of Healing (Sarenrae)', 'paladin.ohptcds1d5oG6Bjh.yaml#L101'],
    ['Perpetual Companion', 'summoner.BrnHPJ2EVSQSyNQ8.yaml#L97'],
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
      'traits-373-notice-PZO1131-complete-chain',
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
  // Same-name rows of other traits, unpinned printings and names a body only
  // uses as a trigger are not required.
  for (const [name, book] of [
    ['Traditionalist (Divine Anthology)', 'PZO9436'],
    ['Sprint (Gnome)', 'PZO1133'],
    ['Sprint (Gnome)', 'PZO1140'],
    ['Brastlewark Businessman (Gnome)', 'PZO9411'],
    ['Armed Grit', 'PZO1118'],
    ['Preternatural Awareness', 'PZO1114'],
  ] as const)
    expect(candidate(name).requiredNotices, name).not.toContain(book);
  expect(
    heldTraits
      .flatMap((row) => row.linkedContentReview.map((linked) => linked.name))
      .sort(),
  ).toEqual([
    'Alkali Flask',
    'Bottled lightning',
    'Channel Energy',
    'Fervor',
    'Lay on Hands',
    'Liquid Ice',
    'Ray of Frost',
  ]);
  // Fervor and Lay on Hands cite no source; their class records supply the
  // books.
  for (const name of ['Fervor', 'Lay on Hands'])
    expect(
      candidate('Envoy of Healing (Sarenrae)').linkedContentReview.find(
        (linked) => linked.name === name,
      )?.sources,
      name,
    ).toEqual([]);
  // Outlander - Lore Seeker links the other two versions only in its inert
  // instructions, so it binds no linked body.
  expect(
    candidate('Outlander - Lore Seeker (Any Campaign)').linkedContentReview,
  ).toEqual([]);
  // Icy Mementos reaches the spells Liquid Ice links; they are bound, but
  // only the directly linked body's books are required.
  expect(preview.closure.map((row) => row.externalKey).sort()).toEqual([
    'pf1-content/wLfyb5GkHZ3eOBNc',
    'pf1/1vh2ewwvzvxunoxk',
    'pf1/Rzexvt4z8taA8dCu',
    'pf1/WhE4j0Jc82npdMCP',
    'pf1/jplmkdpgjrlouwzu',
    'pf1/kXXz1lO4i7CibHJ9',
    'pf1/mbhdwlzmycxkuobo',
    'pf1/n879x6fw79jiofew',
    'pf1/pkm8um5t1cxsn6jh',
    'pf1/tkjnm3lw7ni82tag',
    'pf1/vdmsaodgnbo8wjfx',
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
  expect(
    candidate("Pathfinder's Focus").inheritedRuleUnresolvedOrigins,
  ).toEqual([expect.stringContaining('wayfinder')]);
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
      batch: 'traits-373',
      candidate: candidate(name),
    });
  // One requirement split at its commas and "or"; either region read as
  // both; a class name and a misspelled race left unchecked; requirement
  // headings the importer does not read map nothing (#739).
  for (const [name, mapped] of [
    ['Watching Taldor (Qadira)', ['unchecked']],
    [
      'Clumsy Slave (Cheliax, Katapesh; Halfling)',
      ['unchecked', 'unchecked', 'race'],
    ],
    [
      'Exalted of the Society (Cleric, Pathfinder Society)',
      ['unchecked', 'unchecked'],
    ],
    ['Blessing of Darkness (Tiefling)', ['unchecked']],
    ['Berserker of the Society (Barbarian, Pathfinder Society)', undefined],
    ['Suck in Your Gut (Darklands)', undefined],
    ['Brastlewark Businessman (Gnome)', undefined],
  ] as const) {
    expect(kinds(name), name).toEqual(mapped);
    expect(facts(name), name).toEqual(
      expect.arrayContaining([expect.stringContaining('#739')]),
    );
  }
  for (const [name, gap] of [
    ['Unorthodox Strategy (Silver Crusade)', 'no faction fact exists'],
    ['Nearly Blinded (Human; Tian)', 'no heritage or ethnicity fact exists'],
    ['Cheat Death (Besmara)', 'no deity fact exists'],
    ['Cynic (Mendev)', 'no region fact exists'],
    ['Fleet of Foot (Chiardmar)', 'no mount fact exists'],
    ['The Newlyweds', 'no birth-date fact exists'],
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
  // The Equipment folder is pack organization, excluded by the importer's
  // folder contract.
  expect(folders).toEqual([
    expect.objectContaining({
      externalKey: 'pf1-content/JADO8YDnM5A87OCO',
      name: 'Equipment',
      rawKey: '!folders!JADO8YDnM5A87OCO',
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
  // Cynic's body equals its Inner Sea Primer row's benefit.
  expect(candidate('Cynic (Mendev)').comparison?.literalRow).toContain(
    'BONUS:SKILL|Sense Motive|1|TYPE=Trait',
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
    const cynic = candidate('Cynic (Mendev)');
    expect(cynic.requiredNotices).toEqual(['PZO9414', 'PZO1115', 'PZO1110']);
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === cynic.externalKey
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(
      confirmed.admitted.some((row) => row.externalKey === cynic.externalKey),
    ).toBe(false);
    expect(
      confirmed.held.find((row) => row.externalKey === cynic.externalKey)
        ?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});
