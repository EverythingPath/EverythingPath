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
} from '../fixtures/traits-370/data';
import { reviewedTraitSheet } from '../fixtures/traits-370/sheet';
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
  'Azlanti Scholar (Ironbound Archipelago, non-elf )',
  'Outsider Enemy',
  'Surefooted Ascent (Hill or Mountain)',
  'Scion of Legend (Return of the Runelords)',
  'Criminally Connected',
  'I Know a Guy (Sczarni Faction)',
  'Cruel Child (Changeling)',
  'Clever Mount',
  'Necrotoxin Resistance (Geb)',
  'Quantium University Graduate (Nex)',
  'Planar Voyager (The Concordance)',
  'Witch-Tongued (Irrisen)',
  'Ogre Avoidance',
  'Free People (Realm of the Mammoth Lords; Kellid)',
  'Chosen of Iomedae',
  'Darklands Scholar',
  'Brave Words (Ninshaburian)',
];

// Every trait whose bound content closure keeps Unchained action-cost
// metadata (owner ruling, 2026-10-17): seven on the trait's own action, two of
// them also through a linked spell, and three only through a linked body (the
// read magic and light spells and the Orc Ferocity racial trait).
const unchainedOwn = [
  'pf1-content/9n8FedZqi5ZU7rTj', // Rousing Courage
  'pf1-content/A0KTO9LcUyUpu0km', // Pragmatic Polytheist (also Resistance)
  'pf1-content/A7IyTMzJRauORoEt', // Scion of Legend
  'pf1-content/AoNZ865mNElBQ9ZJ', // Shadowsight
  'pf1-content/B13vbJ4hWgVvmeGR', // Corpse Dodger (also Hide from Undead)
  'pf1-content/Bo9clsnCSMf3ecSt', // Brave Words
  'pf1-content/Bqk4IvGRhlKptQqj', // Wardbreaker
];
const unchainedLinked = [
  'pf1-content/A0KTO9LcUyUpu0km', // Pragmatic Polytheist: Resistance
  'pf1-content/AXH6AF5wX2YlLRLx', // Secret Scrolls: Read Magic
  'pf1-content/B13vbJ4hWgVvmeGR', // Corpse Dodger: Hide from Undead
  'pf1-content/BcegilU0RQWavLZh', // Chosen of Iomedae: Light
  'pf1-content/BiXxi3I21cIMNm0o', // Wild Ferocity: Orc Ferocity
];

it('resolves the reviewed trait Modifiers, with trait bonuses that never stack', () => {
  // Rapscallion and Giant Ambivalence: two traits' +1 trait bonuses on
  // initiative don't stack.
  for (const name of [
    'Rapscallion',
    'Giant Ambivalence (Temperate Highlands)',
  ] as const)
    expect(total(reviewedTraitSheet(name), 'init'), name).toBe(1);
  const both = reviewedTraitSheet(
    'Rapscallion',
    'Giant Ambivalence (Temperate Highlands)',
  );
  expect([
    total(both, 'init'),
    total(both, 'skill.esc'),
    total(both, 'skill.sen'),
  ]).toEqual([1, 1, 1]);
  // Proxy of Many: +2 to request a favor, +4 when you did the creature a
  // favor; the +4 is the new total, not +6.
  const proxy = 'Proxy of Many';
  expect(resolveSheet(modifiers(proxy))['skill.dip'].total).toBe(0);
  expect(
    resolveSheet(modifiers(proxy), {
      situations: [situation(proxy, 0), situation(proxy, 1)],
    })['skill.dip'].total,
  ).toBe(4);
  // Empty Mask: -1 on Will against compulsions, -2 against foes who know
  // your true identity; the penalties never add up.
  const mask = 'Empty Mask';
  expect(
    resolveSheet(modifiers(mask), {
      situations: [situation(mask, 0), situation(mask, 1)],
    })['save.will'].total,
  ).toBe(-2);
  expect(
    resolveSheet(modifiers(mask), { situations: [situation(mask, 0)] })[
      'save.will'
    ].total,
  ).toBe(-1);
  // Fey-Taken: -2 on all saves against disease, illusions and poison.
  const fey = 'Fey-Taken';
  const cursed = resolveSheet(modifiers(fey), {
    situations: [situation(fey, 0), situation(fey, 1)],
  });
  expect([
    cursed['save.fort'].total,
    cursed['save.ref'].total,
    cursed['save.will'].total,
  ]).toEqual([-2, -2, -2]);
  // Planar Savant adds the Charisma modifier's excess over Intelligence on
  // Knowledge (planes), and never lowers the check.
  const savant = (int: number, cha: number) => {
    const scores = (sheet: ReturnType<typeof reviewedTraitSheet>) => {
      const base = sheet.catalogEntries[0]!;
      base.modifiers = (base.modifiers ?? []).map((row) =>
        row.target === abilityTargets.intelligence
          ? { ...row, value: int }
          : row.target === abilityTargets.charisma
            ? { ...row, value: cha }
            : row,
      );
      return sheet;
    };
    return (
      total(scores(reviewedTraitSheet('Planar Savant')), 'skill.kpl') -
      total(scores(reviewedTraitSheet()), 'skill.kpl')
    );
  };
  // Intelligence 10 and Charisma 16: the excess of Charisma +3 over Int +0.
  expect(savant(10, 16)).toBe(3);
  // Intelligence 14 and Charisma 8: Charisma -1 is below Intelligence +2.
  expect(savant(14, 8)).toBe(0);
  // Shared Situations only where the body's condition matches exactly.
  for (const name of [
    'Fearless Defiance',
    'Chilled by Brutality (Tundra)',
  ] as const)
    expect(
      resolveSheet(modifiers(name), { situations: ['fear'] })['save.ref'].total,
      name,
    ).toBe(name === 'Fearless Defiance' ? 1 : 2);
  expect(
    resolveSheet(
      modifiers('Free People (Realm of the Mammoth Lords; Kellid)'),
      { situations: ['mindAffecting'] },
    )['save.will'].total,
  ).toBe(1);
  expect(
    resolveSheet(modifiers('Blood of Giants (Reign of Winter)'), {
      situations: ['sunder'],
    }).cmb.total,
  ).toBe(1);
  // Iron Liver's poison-and-drugs bonus is narrower than the shared poison
  // Situation, so it stays local.
  expect(
    resolveSheet(modifiers('Iron Liver'), { situations: ['poison'] })[
      'save.fort'
    ].total,
  ).toBe(0);
  // Corrected targets: damage, not attack rolls; all saves for heat.
  for (const name of [
    "Treerazer's Bane (Kyonin)",
    'Warsmith (Dwarf)',
    'Noble Born - Surtova (Kingmaker)',
  ])
    expect(
      modifiers(name).map((row) => row.target),
      name,
    ).toEqual(['damage']);
  expect(
    modifiers('Quain Martial Artist (Quain)').map((row) => row.target),
  ).toEqual(['damage.melee']);
  expect(
    modifiers('Desert Nomad (Thuvia)').map((row) => [row.target, row.value]),
  ).toEqual([
    ['saves', 1],
    ['saves', 4],
  ]);
  // Ruthless: the raw critConfirm change maps nothing, so the reviewed
  // Modifier supplies the confirmation bonus under a Situation.
  const ruthless = 'Ruthless (Dwarf)';
  expect(resolveSheet(modifiers(ruthless))['attack.melee'].total).toBe(0);
  expect(
    resolveSheet(modifiers(ruthless), {
      situations: [situation(ruthless, 0)],
    })['attack.melee'].total,
  ).toBe(1);
  expect(entry(ruthless).unsupported).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        field: 'changes',
        value: expect.objectContaining({ target: 'critConfirm' }),
      }),
    ]),
  );
  // Choice traits: a targetless change maps nothing, and each option is a
  // manual Situation, so nothing applies unconditionally.
  const scholar = 'Arcane Scholar';
  const unchosen = resolveSheet(modifiers(scholar));
  expect([unchosen['skill.kar'].total, unchosen['skill.spl'].total]).toEqual([
    0, 0,
  ]);
  const spellcraft = resolveSheet(modifiers(scholar), {
    situations: [
      situation(scholar, indexOf(scholar, 'skill.spl', 'chose Spellcraft')),
    ],
  });
  expect([
    spellcraft['skill.kar'].total,
    spellcraft['skill.spl'].total,
  ]).toEqual([0, 1]);
  const orlovsky = resolveSheet(modifiers('Noble Born - Orlovsky (Kingmaker)'));
  expect([
    orlovsky.cmd.total,
    orlovsky['skill.acr'].total,
    orlovsky['skill.dip'].total,
  ]).toEqual([1, 0, 0]);
  // Well Bred's imported Knowledge bonuses stay untyped (the listed gap), so
  // they add to Sevenarches Seeker's +1 trait bonus on Knowledge (history).
  expect(
    modifiers('Well Bred (Hermea)').map((row) => [
      row.target,
      row.bonusType,
      row.value,
    ]),
  ).toEqual([
    ['skill.khi', 'untyped', 1],
    ['skill.kre', 'untyped', 1],
    ['skill.sen', 'untyped', -1],
  ]);
  expect(
    total(
      reviewedTraitSheet(
        'Well Bred (Hermea)',
        'Sevenarches Seeker (Sevenarches)',
      ),
      'skill.khi',
    ),
  ).toBe(2);
  // No reviewed armor, shield or natural armor bonus lands on ac.other (#734);
  // Blighted Physiology's imported bonus is on ac.natural, and Lepidstadt
  // Scar's and Monster Survivor's AC bonuses are dodge bonuses.
  for (const row of preview.entries)
    for (const modifier of row.modifiers)
      if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
        expect(modifier.target, row.name).not.toBe('ac.other');
  expect(
    modifiers('Blighted Physiology (Numeria)').map((row) => [
      row.target,
      row.bonusType,
    ]),
  ).toEqual([['ac.natural', 'trait']]);
  for (const name of ['Lepidstadt Scar (Ustalav)', 'Monster Survivor'])
    expect(
      modifiers(name).map((row) => [row.target, row.bonusType]),
      name,
    ).toEqual([['ac', 'dodge']]);
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
  expect(required).toBe(92);
  // Readable rules stay Notes where no statistic exists: the drafter's spell
  // DC, concentration and AC targets are dropped for summoned creatures,
  // Constitution checks, damage reduction and an ally's AC.
  expect(
    entry('Demonbane Summoner (Worldwound)').situationalNotes?.filter(
      (note) => note.target === 'spellDC',
    ),
  ).toEqual([]);
  expect(
    entry('Healthy (Ruins of Azlant)').situationalNotes?.filter(
      (note) => note.target === 'concentration',
    ),
  ).toEqual([]);
  for (const name of [
    'Bellis Honey Harvester (Andoran; Bellis)',
    'Protective Faith (Torag)',
  ])
    expect(
      entry(name).situationalNotes?.filter(
        (note) => note.target === 'ac' || note.target === 'attack',
      ),
      name,
    ).toEqual([]);
  expect(
    entry('Bellis Honey Harvester (Andoran; Bellis)').situationalNotes?.some(
      (note) => !note.target && note.text.includes('DR 3/—'),
    ),
  ).toBe(true);
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
    'Forlorn (Elf)',
    'Free People (Realm of the Mammoth Lords; Kellid)',
    'Pearl Diver (Xidao)',
    'Planar Savant',
    'Rapscallion',
    'Surefooted Ascent (Hill or Mountain)',
    'Xa Hoi Soldier (Xa Hoi)',
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
      `traits-370-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `traits-370-notice-${book}-complete-chain`),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    heldTraits
      .filter((row) => row.traitType === 'drawback')
      .map((row) => row.name)
      .sort(),
  ).toEqual(['Empty Mask', 'Fey-Taken', 'Superstitious (QC)']);
  for (const [name, book] of [
    ['Cruel Child (Changeling)', 'PZO9280'],
    ['Shadow Stalker (Fetchling)', 'PZO9280'],
    ['Shadow Stalker (Fetchling)', 'PZO1116'],
    ['Shadow Stalker (Fetchling)', 'PZO1121'],
    ['Wild Ferocity (Half-Orc)', 'PZO9280'],
    ['Wild Ferocity (Half-Orc)', 'PZO1121'],
    ['Shadowsight (Nidal)', 'PZO1112'],
    ['Noble Born - Surtova (Kingmaker)', 'PZO9000-6E'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Focused Burn depends on the alchemist's bombs, an APG class feature.
  expect(
    candidate('Focused Burn').inheritedRuleNotices.find((notice) =>
      notice.rule.includes('bombs'),
    ),
  ).toMatchObject({ book: 'PZO1115' });
  // Unchained action-cost metadata anywhere in the bound closure, the
  // trait's own actions included, requires the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedLinked])].sort();
  expect(unchained).toHaveLength(10);
  expect(
    heldTraits
      .filter((row) => row.requiredNotices.includes('PZO1131'))
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(unchained);
  for (const key of unchained) {
    const row = heldTraits.find((row) => row.externalKey === key)!;
    expect(row.noticeHoldIds, row.name).toContain(
      'traits-370-notice-PZO1131-complete-chain',
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
    ['Forlorn (Elf)', 'PZO9402'],
    ['Rapscallion', 'PZO9405'],
    ['Superstitious (QC)', 'PZO9417'],
    ['Superstitious (QC)', 'PZO9414'],
    ['Helpful (Halfling)', 'PZO9431'],
    ['Pearl Diver (Xidao)', 'PZO9441'],
    ['Azlanti Scholar (Ironbound Archipelago, non-elf )', 'PZO9000-21E'],
    ['Healthy (Ruins of Azlant)', 'PZO1121'],
  ] as const)
    expect(candidate(name).requiredNotices, name).not.toContain(book);
  expect(
    heldTraits
      .flatMap((row) => row.linkedContentReview.map((linked) => linked.name))
      .sort(),
  ).toEqual([
    'Diehard',
    'Favored Enemy',
    'Favored Terrain',
    'Favored Terrain',
    'Hide from Undead',
    'Light',
    'Noble Born - Garress (Kingmaker)',
    'Noble Born - Lebeda (Kingmaker)',
    'Noble Born - Lodovka (Kingmaker)',
    'Noble Born - Medvyed (Kingmaker)',
    'Noble Born - Orlovsky (Kingmaker)',
    'Orc Ferocity',
    'Read Magic',
    'Resistance',
    'Shadow Blending',
  ]);
  for (const name of noRow) {
    expect(candidate(name).comparison, name).toBeNull();
    expect(candidate(name).additionalComparisonLeads, name).toEqual([]);
    expect(candidate(name).inheritedRuleUnresolvedOrigins[0], name).toContain(
      'no PCGen row at the pin',
    );
  }
  // Rapscallion has only rows of printings its pinned record doesn't cite.
  expect(candidate('Rapscallion').comparison).toBeNull();
  expect(
    candidate('Rapscallion').additionalComparisonLeads.map((row) => row.book),
  ).toEqual(['PZO1115', 'PZO9405']);
  expect(heldTraits.filter((row) => !row.comparison)).toHaveLength(
    noRow.length + 1,
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
  expect(kinds('Iron Control (Half-Orc; Human-Raised)')).toEqual([
    'race',
    'unchecked',
  ]);
  for (const name of [
    'Surefooted Ascent (Hill or Mountain)',
    'Sea-Souled (Coastline or Island)',
  ])
    expect(kinds(name), name).toEqual(['unchecked']);
  expect(kinds('Regal Presence (Iomedae)')).toEqual(['deity']);
  for (const [name, gap] of [
    ['Iron Control (Half-Orc; Human-Raised)', 'no upbringing fact exists'],
    [
      'Keleshite Princess (Qadiran Keleshite female)',
      'no ethnicity or gender fact exists',
    ],
    ['Clever Mount', 'no companion fact exists'],
    ['I Know a Guy (Sczarni Faction)', 'no faction fact exists'],
  ] as const)
    expect(
      recordedPrerequisiteFacts({
        batch: 'traits-370',
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
  // The Xa Hoi Soldier body equals its Dragon Empires Primer row.
  expect(candidate('Xa Hoi Soldier (Xa Hoi)').comparison?.literalRow).toContain(
    "DESC:You were a soldier in one of Xa Hoi's extensive armies, trained under the oversight of one of Pham Duc Quan's draconic brethren. You gain a +1 trait bonus on Reflex saves.",
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
    // #738 keeps Brave Words' three condition journal links as text, and every
    // other link resolves in the full-corpus closure: no trait fails.
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
    const soldier = candidate('Xa Hoi Soldier (Xa Hoi)');
    expect(soldier.requiredNotices).toEqual(['PZO9421', 'PZO1115', 'PZO1110']);
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === soldier.externalKey
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(
      confirmed.admitted.some((row) => row.externalKey === soldier.externalKey),
    ).toBe(false);
    expect(
      confirmed.held.find((row) => row.externalKey === soldier.externalKey)
        ?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});
