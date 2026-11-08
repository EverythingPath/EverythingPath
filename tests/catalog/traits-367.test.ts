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
} from '../fixtures/traits-367/data';
import { reviewedTraitSheet } from '../fixtures/traits-367/sheet';
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
  'Questing Hellknight (Lawful)',
  'The Rider',
  'Arcane Malignancies (Changeling)',
  'Comparative Religion (Silver Crusade)',
  'Disgraced Noble (War for the Crown)',
  'Scarred',
  "Thrune Loyal Agent (Hell's Vengeance)",
  'Insider Knowledge (Grand Lodge)',
  'Scholar of Balance (The Concordance)',
  'Haunted',
  'Observant Archer (Aquatic origin)',
  'Clockwork Surgeon (Aesocar)',
  'Swamp Recluse (Swamp)',
  'Fortified (Shadow Lodge)',
  'Keleshite Trader (Kelesh, Qadira)',
  "Besmara's Strength (Besmara)",
  'In Tune with Language (Vampire; Jiang-Shi)',
  'Swamp Skulker (River Kingdoms)',
  'Stubborn (Vampire; Vetala)',
];

it('resolves the reviewed trait Modifiers, with trait bonuses that never stack', () => {
  // Goblin Watcher: +1 trait on Perception and Appraise, +5 trait on Appraise
  // in the treasure-hoard Situation, which replaces the +1 rather than adding.
  const watcher = 'Goblin Watcher (Rise of the Runelords)';
  const hoard = indexOf(watcher, 'skill.apr', 'treasure hoard');
  const plain = resolveSheet(modifiers(watcher));
  expect([plain['skill.per'].total, plain['skill.apr'].total]).toEqual([1, 1]);
  expect(
    resolveSheet(modifiers(watcher), {
      situations: [situation(watcher, hoard)],
    })['skill.apr'].total,
  ).toBe(5);
  // Highlander: +1 Stealth, +2 in hilly or rocky areas (not +3). Foundry
  // files that note under Spellcraft; the reviewed Modifier is on Stealth.
  const highlander = 'Highlander (Hills or Mountains)';
  const hills = indexOf(highlander, 'skill.ste', 'hilly or rocky');
  expect(resolveSheet(modifiers(highlander))['skill.ste'].total).toBe(1);
  const inHills = resolveSheet(modifiers(highlander), {
    situations: [situation(highlander, hills)],
  });
  expect([inHills['skill.ste'].total, inHills['skill.spl'].total]).toEqual([
    2, 0,
  ]);
  // Two different traits' +1 trait bonuses on Sense Motive don't stack.
  for (const name of ['Honor-Driven (Human; Ulfen)', 'Bastard'] as const)
    expect(total(reviewedTraitSheet(name), 'skill.sen'), name).toBe(1);
  expect(
    total(
      reviewedTraitSheet('Honor-Driven (Human; Ulfen)', 'Bastard'),
      'skill.sen',
    ),
  ).toBe(1);
  // Honor-Driven's raw change has no target; its +1 is the reviewed Modifier.
  expect(entry('Honor-Driven (Human; Ulfen)').unsupported).toEqual(
    expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
  );
  // A drawback's untyped penalties apply unconditionally.
  const scarred = reviewedTraitSheet('Scarred');
  expect([total(scarred, 'skill.dis'), total(scarred, 'skill.blf')]).toEqual([
    -5, -2,
  ]);
  // Secret Shame's fear penalty exempts a character normally immune to fear,
  // so it is a local Situation carrying that exception, not the shared fear.
  const shame = modifiers('Secret Shame');
  expect(shame.map((row) => [row.target, row.value])).toEqual([['saves', -1]]);
  expect(shame[0]?.condition?.situation).toEqual({
    local: 'against fear effects, unless you would normally be immune to fear',
  });
  expect(resolveSheet(shame, { situations: ['fear'] })['save.will'].total).toBe(
    0,
  );
  expect(
    resolveSheet(shame, { situations: [situation('Secret Shame', 0)] })[
      'save.will'
    ].total,
  ).toBe(-1);
  // Vexed: the curse and shared fear Situations never count twice.
  const vexed = 'Vexed (Kobold)';
  expect(modifiers(vexed).map((row) => row.condition?.situation)).toEqual([
    { local: 'against curses' },
    'fear',
  ]);
  expect(resolveSheet(modifiers(vexed))['save.will'].total).toBe(0);
  expect(
    resolveSheet(modifiers(vexed), { situations: ['fear'] })['save.will'].total,
  ).toBe(1);
  expect(
    resolveSheet(modifiers(vexed), {
      situations: [situation(vexed, 0), situation(vexed, 1)],
    })['save.will'].total,
  ).toBe(1);
  // Boarded in the Shackles: one chosen save, a manual Situation per option.
  const shackles = "Boarded in the Shackles (Serpent's Skull)";
  const will = resolveSheet(modifiers(shackles), {
    situations: [situation(shackles, indexOf(shackles, 'save.will', 'Will'))],
  });
  expect([
    will['save.fort'].total,
    will['save.ref'].total,
    will['save.will'].total,
  ]).toEqual([0, 0, 1]);
  // Aldori Caution's additional dodge bonus stacks with another dodge bonus.
  const aldori = modifiers('Aldori Caution');
  expect(aldori.map((row) => [row.target, row.bonusType, row.value])).toEqual([
    ['ac', 'dodge', 1],
  ]);
  expect(
    resolveSheet(
      [
        ...aldori,
        {
          ...aldori[0]!,
          sheetEntryId: 'other',
          catalogEntryId: 'other',
          source: 'other',
          entryName: 'other',
          condition: undefined,
        },
      ],
      { situations: [situation('Aldori Caution', 0)] },
    )['ac.other'].total,
  ).toBe(2);
  // Disgraced Noble's morale bonus rises at 10th character level.
  expect(
    modifiers('Disgraced Noble (War for the Crown)')
      .filter((row) => row.bonusType === 'morale')
      .map((row) => [row.target, row.value]),
  ).toEqual([
    ['attack', { formula: '1 + min(1, floor(@level / 10))' }],
    ['damage', { formula: '1 + min(1, floor(@level / 10))' }],
  ]);
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
    // The readable Note is the whole body, split only where the sheet's
    // 4096-character limit requires.
    const parts = description!.outputs.flatMap((output) =>
      output.kind === 'note' ? [output.text] : [],
    );
    for (const part of parts)
      expect(part.length, row.name).toBeLessThanOrEqual(4096);
    const texts = (entry(row.name).situationalNotes ?? []).map(
      (note) => note.text,
    );
    for (const part of parts) expect(texts, row.name).toContain(part);
  }
  expect(required).toBe(86);
  expect(
    candidate(
      'Arcane Malignancies (Changeling)',
    ).mechanicsReview.curationRecords[0]?.outputs.filter(
      (output) => output.kind === 'note',
    ),
  ).toHaveLength(3);
  // Readable rules stay Notes where no statistic exists.
  expect(
    entry('Shadow Child (Council of Thieves)').situationalNotes?.find(
      (note) => note.target === 'attack',
    )?.text,
  ).toContain('20% miss chance');
  expect(
    entry("Thrune Loyal Agent (Hell's Vengeance)").situationalNotes?.some(
      (note) =>
        note.target === undefined && note.text.includes('fast healing 1'),
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
  ).toEqual(['Scarred', 'Wary (Aasimar)']);
});

it('records the trait framework, inherited rules, linked bodies and enforced notice holds without inventing attribution', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  for (const row of heldTraits) {
    // Every trait relies on the APG trait framework, and drawbacks on the
    // Ultimate Campaign drawback rules.
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
      `traits-367-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `traits-367-notice-${book}-complete-chain`),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    heldTraits
      .filter((row) => row.traitType === 'drawback')
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Arcane Malignancies (Changeling)',
    'Haunted',
    'Naive',
    'Scarred',
    'Secret Shame',
    'Spooked',
    'Xenophobic',
  ]);
  for (const [name, book] of [
    ['Touched by Divinity (Wrath of the Wrighteous)', 'PZO1126'],
    ["The Pathfinder's Exile (Council of Thieves)", 'PZO9211'],
    ["The Pathfinder's Exile (Council of Thieves)", 'PZO1138'],
    ["Thrune Loyal Agent (Hell's Vengeance)", 'PZO1112'],
    ['Blood of Dragons (Any)', 'PZO1112'],
    ['Sharkchild (Skinwalker; Wereshark-Kin)', 'PZO1133'],
    ['Nanite Revival (Android)', 'PZO1133'],
    ['Rivethun Adherent', 'PZO1114'],
    ['Fortified (Shadow Lodge)', 'PZO1123'],
    ['Loyalty across Lifetimes', 'PZO1125'],
    ['Artifact Hunter (Mwangi Expanse)', 'PZO9414'],
    ['Ghoulish Affinity (Darklands)', 'PZO9444'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Unchained action-cost metadata (activation.unchained) anywhere in a
  // trait's bound closure requires the held PZO1131 (#367 ruling): on the
  // trait's own action, or on a bound body (the linked Light, Arcane Mark and
  // Stabilize spells, and Nanite Surge through the linked Android race).
  const hasUnchainedCost = (value: unknown): boolean =>
    Array.isArray(value)
      ? value.some(hasUnchainedCost)
      : typeof value === 'object' && value !== null
        ? Object.entries(value).some(([key, field]) =>
            key === 'activation' &&
            typeof field === 'object' &&
            field !== null &&
            'unchained' in field
              ? true
              : hasUnchainedCost(field),
          )
        : false;
  const ownUnchained = [
    'pf1-content/07ELnQqU5YTwj3Cg', // Touched by Divinity (Wrath of the Wrighteous)
    'pf1-content/0LYRbBp6Q3cDfTa7', // Questing Hellknight (Lawful)
    'pf1-content/0laD2ApE7rKwWY7g', // The Rider
    'pf1-content/0zJall7I83NIugGB', // Disgraced Noble (War for the Crown)
    'pf1-content/139Y9uC7ChiaFGeC', // Tireless Logic
    'pf1-content/13P4bH4FFr6PLHy2', // Instant Friendship (Suli)
    'pf1-content/1MxfiqAvQ5dqIFvl', // Demon Smiter
    'pf1-content/1Nu5b9HwmE9bJ3xi', // Thrune Loyal Agent (Hell's Vengeance)
    'pf1-content/1VZdToDvZD9se47M', // Pitaxian Improvisation (Pitax)
    'pf1-content/1g2NDdgTpX934rah', // Thrill-Seeker (Desna)
    'pf1-content/1mbmoRuwMNs86gAg', // Nanite Revival (Android)
    'pf1-content/2LAsfqmM0jZfxc6V', // Screaming Leap (Realm of the Mammoth Lords)
    'pf1-content/2TLdx2yGIMkAp8NF', // Strength Foretold
    'pf1-content/2V8vm122Y4d4WzCZ', // Fortified (Shadow Lodge)
    'pf1-content/2ko9VD7LRIj1zf2G', // Besmara's Strength (Besmara)
    'pf1-content/2lmlHWe3HOgFLD8g', // Star Struck (Hell's Rebels)
    'pf1-content/2yj0MWXqnC1SD5aU', // Stabilizing Touch (Pharasma)
    'pf1-content/34uTvzyZtWpKEifd', // Wendifa Apprentice
  ];
  expect(
    preview.entries
      .filter(hasUnchainedCost)
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(ownUnchained);
  expect(
    preview.closure
      .filter(hasUnchainedCost)
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual([
    'pf1-content/wvUNwfSSzmWElgiM', // Nanite Surge
    'pf1/fipqx43u5blpjsvo', // Stabilize
    'pf1/ip9onjfp6nf1vlv9', // Light
    'pf1/n8k4pdmjjg8xuv7l', // Arcane Mark
  ]);
  const unchained = [
    ...ownUnchained,
    'pf1-content/0OSRgROEt0zwgASC', // The Pathfinder's Exile (Council of Thieves), linked Light only
  ].sort();
  expect(
    heldTraits
      .filter((row) => row.requiredNotices.includes('PZO1131'))
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(unchained);
  for (const key of unchained) {
    const row = heldTraits.find((row) => row.externalKey === key)!;
    expect(row.noticeHoldIds, key).toContain(
      'traits-367-notice-PZO1131-complete-chain',
    );
    expect(
      row.inheritedRuleNotices.some(
        (notice) =>
          notice.book === 'PZO1131' && notice.rule.includes('Unchained'),
      ),
      key,
    ).toBe(true);
  }
  // Earlier printings and same-name traits of other books are not required.
  for (const [name, book] of [
    ['Betrayed (Curse of the Crimson Throne)', 'PZO9000-2S'],
    ['Missing Child (Curse of the Crimson Throne)', 'PZO9000-2S'],
    ['Skymetal Smith (Iron Gods)', 'PZO9448'],
    ["Foreign Opportunist (Mummy's Mask)", 'PZO9441'],
    ['World Traveler (Human)', 'PZO9404'],
    ['Stubborn (Vampire; Vetala)', 'PZO1121'],
    ['Alchemical Prodigy (Qadira)', 'PZO9441'],
    ['Bastard', 'PZO9000-6E'],
    ['Secret-Keeper', 'PZO9280'],
  ] as const)
    expect(candidate(name).requiredNotices, name).not.toContain(book);
  // Two traits cite no source; their PCGen rows supply the publication.
  for (const name of [
    'Artifact Hunter (Mwangi Expanse)',
    'Ghoulish Affinity (Darklands)',
  ]) {
    expect(candidate(name).citedSources, name).toEqual([]);
    expect(entry(name).sources, name).toEqual([]);
  }
  // Seven bodies link other records; their pinned books are required.
  expect(
    heldTraits
      .flatMap((row) => row.linkedContentReview.map((linked) => linked.name))
      .sort(),
  ).toEqual([
    'Android',
    'Arcane Mark',
    'Diehard',
    'Eschew Materials',
    'Fortification (light)',
    'Light',
    'Stabilize',
    'Wayfinder',
  ]);
  for (const name of noRow) {
    expect(candidate(name).comparison, name).toBeNull();
    expect(candidate(name).additionalComparisonLeads, name).toEqual([]);
    expect(candidate(name).inheritedRuleUnresolvedOrigins[0], name).toContain(
      'no PCGen row at the pin',
    );
  }
  for (const name of [
    'Betrayed (Curse of the Crimson Throne)',
    'Missing Child (Curse of the Crimson Throne)',
  ]) {
    expect(candidate(name).comparison, name).toBeNull();
    expect(
      candidate(name).additionalComparisonLeads.map((row) => row.book),
      name,
    ).toContain('PZO9000-2S');
  }
  expect(heldTraits.filter((row) => !row.comparison)).toHaveLength(
    noRow.length + 2,
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
  expect(kinds('Tusked (Half-Orc, Orc)')).toEqual(['anyOf']);
  expect(kinds('Provider (Erastil; Halfling)')).toEqual(['unchecked', 'race']);
  expect(kinds('Keleshite Trader (Kelesh, Qadira)')).toEqual(['unchecked']);
  expect(kinds('A Shining Beacon (Iomedae)')).toEqual(['deity']);
  expect(entry('Scarred').prerequisites).toBeUndefined();
  for (const [name, gap] of [
    ['Tusked (Half-Orc, Orc)', 'not alternatives (#739)'],
    ['Blood of Dragons (Any)', 'restricts nothing'],
    ['Questing Hellknight (Lawful)', 'You must be of a lawful alignment'],
    ['Arcane Malignancies (Changeling)', 'maps no prerequisite atom'],
    ['Honor-Driven (Human; Ulfen)', 'no ethnicity fact exists'],
  ] as const)
    expect(
      recordedPrerequisiteFacts({
        batch: 'traits-367',
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
    ['Basic (Faith)', '!folders!13dReUJWCsEjXV2p'],
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
  // The Highlander body equals its Advanced Player's Guide row.
  expect(
    candidate('Highlander (Hills or Mountains)').comparison?.literalRow,
  ).toContain(
    "DESC:You were born and raised in rugged badlands or hills, and you've become something of an expert at evading the predators, monsters, and worse that haunt the highlands. You gain a +1 trait bonus on Stealth checks, and Stealth is always a class skill for you. This trait bonus increases to +2 in hilly or rocky areas.",
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
      required: 86,
      checked: 86,
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
        // The fixture entries are full-preview entries the shared schema parsed.
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
    const bastard = candidate('Bastard');
    expect(bastard.requiredNotices).toEqual(['PZO1125', 'PZO1115', 'PZO1110']);
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === bastard.externalKey
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(
      confirmed.admitted.some((row) => row.externalKey === bastard.externalKey),
    ).toBe(false);
    expect(
      confirmed.held.find((row) => row.externalKey === bastard.externalKey)
        ?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});
