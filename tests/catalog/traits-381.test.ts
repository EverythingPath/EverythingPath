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
} from '../fixtures/traits-381/data';
import { reviewedTraitSheet } from '../fixtures/traits-381/sheet';
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
  'Child of Oppara (War for the Crown)',
  'Natural Negotiator (The Concordance)',
  'Entomophobe',
  'Celestial Community (Aasimar)',
  'Soul Drinker (Dark Archive)',
  'Palm Potion (Razmiran)',
  'Fugitive',
  'Loyalty (Grand Lodge)',
  'Traveler of a Hundred Lands',
  'Gold Finger (The Exchange)',
  'Storyteller (Lantern Lodge)',
];

// Every trait whose bound content closure keeps Unchained action-cost
// metadata (owner ruling, 2026-10-17): 16 on the trait's own action and 5
// through linked bodies, 2 of them both ways.
const unchainedOwn = [
  'pf1-content/h3W4fjkrvdYDhtkv', // Accustomed to Trickery
  'pf1-content/hDjklTDBp5WApRvs', // Agent of Chance
  'pf1-content/hEGGJ7aXifksH1i4', // Alabaster Odalisque
  'pf1-content/hFAEnJmPJ21hw4oh', // Untapped Potential
  'pf1-content/hHqyigaIRpRaULYj', // Bureaucrat's Favored
  'pf1-content/hm37Z49q7baMWX8Q', // Wolf Cub
  'pf1-content/htyTEYqM7b2P0Sau', // Dealmaker
  'pf1-content/hwsfmrZyhROj6jqA', // Balanced Determination
  'pf1-content/i9PO2At7ghuhnw4j', // Tactician
  'pf1-content/iKEcRBRRL3dSzDLx', // Celestial Community
  'pf1-content/iLTHscV6zrWaUs8I', // Bralani's Step
  'pf1-content/iQWziyNts4M0a4jJ', // Soul Drinker
  'pf1-content/iSF7ffJGMi6AoV3T', // Draconic Echo
  'pf1-content/io9TgjprRYuLUhie', // Genie-Caller
  'pf1-content/iuAj0u3TZ6uiZ1Fg', // Shoanti Spirit-singer
  'pf1-content/jWD1MoLUyUpDAEAC', // Reassuring Advice
  'pf1-content/jqacyAyLyepa2AYZ', // Storyteller
];
const unchainedLinked = [
  'pf1-content/hAbIKZX6nx6fKcxm', // Umbral Unmasking: three spells
  'pf1-content/hFAEnJmPJ21hw4oh', // Untapped Potential: two spells
  'pf1-content/hsLqFO1eJbnKf3hv', // Expert Explorer: Machete
  'pf1-content/iKEcRBRRL3dSzDLx', // Celestial Community: Cure Light Wounds
  'pf1-content/iSF7ffJGMi6AoV3T', // Draconic Echo: Ghost Sound
];

// A base sheet with the given ability scores, for the Intelligence formula.
function withScores(
  sheet: ReturnType<typeof reviewedTraitSheet>,
  scores: Partial<Record<'int', number>>,
) {
  const [base, ...rest] = sheet.catalogEntries;
  return {
    ...sheet,
    catalogEntries: [
      {
        ...base!,
        modifiers: base!.modifiers.map((modifier) =>
          modifier.target === abilityTargets.intelligence &&
          scores.int !== undefined
            ? { ...modifier, value: scores.int }
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
  // Trait bonuses from different traits on one statistic never stack.
  const bloody = 'Bloody-Minded';
  const tough = "Local Tough (Hell's Vengeance)";
  const twitchy = 'Twitchy (Strange Aeons)';
  expect(total(reviewedTraitSheet(bloody), 'skill.int')).toBe(1);
  expect(total(reviewedTraitSheet(bloody, tough), 'skill.int')).toBe(1);
  expect(total(reviewedTraitSheet(bloody), 'init')).toBe(1);
  expect(total(reviewedTraitSheet(bloody, twitchy), 'init')).toBe(2);
  expect(total(reviewedTraitSheet(twitchy), 'save.ref')).toBe(1);
  // Azlanti Scholar's record has no changes; the reviewed Modifiers supply
  // its three unconditional +1 trait bonuses.
  for (const target of ['skill.khi', 'skill.klo', 'skill.umd'])
    expect(
      total(reviewedTraitSheet('Azlanti Scholar (Ruins of Azlant)'), target),
      target,
    ).toBe(1);
  // Soul-Searcher's Strength: the reviewed change replacement sets Foundry's
  // Fortitude +1 to 0, and the chosen save takes the +1 (#381).
  const soul = "Soul-Searcher's Strength (Rivethun)";
  expect(entry(soul).modifiers[0]).toEqual({
    target: 'save.fort',
    bonusType: 'trait',
    value: 0,
  });
  expect(saves(resolveSheet(modifiers(soul)))).toEqual([0, 0, 0]);
  for (const [label, totals] of [
    ['Fortitude', [1, 0, 0]],
    ['Reflex', [0, 1, 0]],
    ['Will', [0, 0, 1]],
  ] as const) {
    const target = {
      Fortitude: 'save.fort',
      Reflex: 'save.ref',
      Will: 'save.will',
    }[label];
    expect(
      saves(
        resolveSheet(modifiers(soul), {
          situations: [
            situation(soul, indexOf(soul, target, `chose ${label}`)),
          ],
        }),
      ),
      label,
    ).toEqual(totals);
  }
  expect(total(reviewedTraitSheet(soul), 'save.fort')).toBe(0);
  // Targetless or unmapped imported changes contribute nothing; reviewed
  // Modifiers supply the rule, under its Situation where it has one.
  for (const [name, target, value, conditional] of [
    ['Oenopion Alchemist (Nex)', 'skill.crf', 1, false],
    ['Savant (Kitharodian Academy)', 'skill.prf', 2, false],
    ['Regional Influence - Riddleport (Varisia)', 'skill.pro', 1, true],
    ['Expert Explorer (Ruins of Azlant)', 'skill.kna', 1, true],
    ['Alabaster Odalisque (Jalmeray)', 'skill.umd', 1, true],
    ['Style Sage', 'skill.khi', 1, true],
  ] as const) {
    expect(entry(name).unsupported, name).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
    );
    const index = modifiers(name).findIndex(
      (row) => row.target === target && row.value === value,
    );
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
  expect(
    resolveSheet(modifiers('Regional Influence - Riddleport (Varisia)'))[
      'skill.swm'
    ].total,
  ).toBe(1);
  expect(
    resolveSheet(modifiers('Expert Explorer (Ruins of Azlant)'))['skill.sur']
      .total,
  ).toBe(1);
  // Haunting Regret: the unmapped concentration change becomes a reviewed
  // -2; the mind-affecting penalty uses the shared Situation.
  const regret = 'Haunting Regret';
  expect(entry(regret).unsupported).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        field: 'changes',
        value: expect.objectContaining({ target: 'concentration' }),
      }),
    ]),
  );
  expect(resolveSheet(modifiers(regret)).concentration.total).toBe(-2);
  expect(saves(resolveSheet(modifiers(regret)))).toEqual([0, 0, 0]);
  expect(
    saves(resolveSheet(modifiers(regret), { situations: ['mindAffecting'] })),
  ).toEqual([-2, -2, -2]);
  // Two penalties from the same body never add: the swarm penalty on
  // Fortitude is the same -2.
  expect(
    saves(
      resolveSheet(modifiers(regret), {
        situations: [
          'mindAffecting',
          situation(regret, indexOf(regret, 'save.fort', 'swarms')),
        ],
      }),
    ),
  ).toEqual([-2, -2, -2]);
  // Choices are one Situation per option.
  for (const [name, count] of [
    ['Expert Explorer (Ruins of Azlant)', 11],
    ['Alabaster Odalisque (Jalmeray)', 7],
    ['Style Sage', 3],
    ["Soul-Searcher's Strength (Rivethun)", 4],
    ['Storyteller (Lantern Lodge)', 10],
    ['Family Ties', 12],
  ] as const)
    expect(modifiers(name), name).toHaveLength(count);
  // Storyteller adds the Intelligence modifier plus 3 (minimum +1) on one
  // Knowledge check per scenario.
  const story = 'Storyteller (Lantern Lodge)';
  const scope = modifiers(story)[0]?.condition?.situation;
  if (!scope || typeof scope === 'string' || !('local' in scope))
    throw new Error('Expected a local Situation');
  for (const [int, value] of [
    [16, 6],
    [10, 3],
    [4, 1],
  ] as const) {
    const sheet = withScores(reviewedTraitSheet(story), { int });
    const totals = calculateCharacterSheetProjections(sheet, {
      situations: [{ local: scope.local, sheetEntryId: 'trait-row-0' }],
    }).current.breakdowns;
    expect(
      totals['skill.khi'].total - Math.floor((int - 10) / 2),
      `${int}`,
    ).toBe(value);
    expect(total(sheet, 'skill.khi') - Math.floor((int - 10) / 2)).toBe(0);
  }
  // Improvised Defense's +1 shield bonus goes to the shield leaf, never
  // ac.other (#734).
  const defense = 'Improvised Defense';
  const wielding = resolveSheet(modifiers(defense), {
    situations: [situation(defense, 0)],
  });
  expect(wielding['ac.shield'].total).toBe(1);
  expect(wielding['ac.other'].total).toBe(0);
  expect(resolveSheet(modifiers(defense))['ac.shield'].total).toBe(0);
  // Burned's two save penalties are one Situation, so they never add.
  const burned = 'Burned';
  expect(modifiers(burned).map((row) => row.target)).toEqual([
    'saves',
    'attack',
    'skills',
  ]);
  const near = resolveSheet(modifiers(burned), {
    situations: [
      situation(burned, 0),
      situation(burned, indexOf(burned, 'attack', 'adjacent')),
    ],
  });
  expect(saves(near)).toEqual([-1, -1, -1]);
  expect(near['attack.melee'].total).toBe(-1);
  expect(near['skill.acr'].total).toBe(-1);
  // A bonus that rises in a Situation is its new total: Orphaned by Giants'
  // +1 against giants is +2 to confirm a critical hit, not +3.
  const orphan = 'Orphaned by Giants (Giantslayer)';
  expect(
    resolveSheet(modifiers(orphan), { situations: ['giants'] })['attack.melee']
      .total,
  ).toBe(1);
  expect(
    resolveSheet(modifiers(orphan), {
      situations: [
        'giants',
        situation(orphan, indexOf(orphan, 'attack', 'confirm')),
      ],
    })['attack.melee'].total,
  ).toBe(2);
  // Shared Situations only where the body's condition matches exactly.
  for (const [name, key, target, value] of [
    ['Devilfish Diver (Ilizmagorti)', 'poison', 'save.fort', 2],
    ['Eagle Knight Recruit (Ruins of Azlant)', 'mindAffecting', 'save.will', 1],
    ['Too Many Secrets', 'illusions', 'save.ref', -2],
    ['Dragon-Hunted', 'fear', 'save.will', 1],
  ] as const)
    expect(
      resolveSheet(modifiers(name), { situations: [key] })[target].total,
      name,
    ).toBe(value);
  for (const [name, key, target] of [
    ['Dragon-Hunted', 'fear', 'save.fort'],
    ['Final Embrace (Dhampir)', 'grapple', 'cmb'],
    ['Chain Master (Tiefling; Shackleborn)', 'trip', 'cmb'],
    ['Loyalty (Grand Lodge)', 'enchantment', 'save.will'],
    ["Strength's Fanfare (Kurgess)", 'grapple', 'cmb'],
  ] as const)
    expect(
      resolveSheet(modifiers(name), { situations: [key] })[target].total,
      `${name} ${key}`,
    ).toBe(0);
  // Too Many Secrets' imported -2 on Bluff always applies.
  expect(total(reviewedTraitSheet('Too Many Secrets'), 'skill.blf')).toBe(-2);
  // Foundry files these notes on other statistics; the reviewed Modifiers
  // land where the body puts them.
  for (const [name, targets] of [
    ["Local Tough (Hell's Vengeance)", ['skill.int', 'damage']],
    ['Undead Slayer (Dhampir)', ['attack', 'damage']],
    ['Big Game Hunter (Realm of the Mammoth Lords)', ['damage']],
    ['Big Mouth (Half-Orc, Orc)', ['skill.blf', 'skill.int', 'skill.prf']],
    ["Strength's Fanfare (Kurgess)", ['skill.clm', 'skill.swm', 'cmb', 'cmd']],
    ['Honeyed Words (Grundinnar)', ['skill.dip', 'spellDC']],
  ] as const)
    expect(
      modifiers(name).map((row) => row.target),
      name,
    ).toEqual(targets);
  // Records with neither a change nor a note get description Modifiers.
  for (const [name, target, value] of [
    ['Firebug', 'attack', 1],
    ['Surprise Weapon', 'attack', 2],
    ['Unstuck (Uringen)', 'casterLevel', 2],
    ['Genie-Caller (Qadira)', 'casterLevel', 2],
    ['Tactician', 'attack', 2],
  ] as const) {
    const index = indexOf(name, target, '');
    expect(modifiers(name)[index]?.value, name).toBe(value);
    expect(
      resolveSheet(modifiers(name), { situations: [situation(name, index)] })[
        target === 'attack' ? 'attack.melee' : target
      ].total,
      name,
    ).toBe(value);
  }
  // Untyped bonuses and penalties stay untyped, as published.
  for (const name of [
    'Entomophobe',
    'Burned',
    'Haunting Regret',
    'Family Ties',
    'Unstuck (Uringen)',
    'Genie-Caller (Qadira)',
  ])
    expect(new Set(modifiers(name).map((row) => row.bonusType)), name).toEqual(
      new Set(['untyped']),
    );
  expect(modifiers('Improvised Defense')[0]?.bonusType).toBe('shield');
  // Family Ties' penalties wait for their Situation, and select together.
  const ties = 'Family Ties';
  expect(resolveSheet(modifiers(ties))['skill.dip'].total).toBe(0);
  const refused = resolveSheet(modifiers(ties), {
    situations: [situation(ties, 0)],
  });
  for (const target of ['skill.dip', 'skill.sen', 'skill.per', 'skill.umd'])
    expect(refused[target as 'skill.dip'].total, target).toBe(-2);
  expect(refused['skill.acr'].total).toBe(0);
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
  expect(required).toBe(87);
  // Family Ties' Wisdom ability-check note repeats its Charisma one; it is
  // the explicit covered/no-output record.
  expect(
    heldTraits.flatMap((row) =>
      row.mechanicsReview.curationRecords
        .filter((record) => !record.outputs.length)
        .map((record) => `${row.name} ${record.target}`),
    ),
  ).toEqual(['Family Ties wisChecks']);
  // Notes the drafter put on unrelated statistics are entry-level.
  for (const name of [
    'Horrifying Mind',
    'Roving Range',
    'Northern Ancestry (Reign of Winter)',
    'Diseased Heart (Ghlaunder)',
    "Apprentice Devilbinder (Hell's Vengeance)",
    'Battlefield Disciple',
    'Family Ties',
  ])
    expect(
      entry(name)
        .situationalNotes?.filter((note) => note.target)
        .map((note) => note.target),
      name,
    ).toEqual([]);
  // Retargeted readable Notes.
  for (const [name, target] of [
    ['Accustomed to Trickery (Darkmoon Wood)', 'saves'],
    ['Pride of the Diamond Empire (Human; Keleshite)', 'save.will'],
    ['Aquatic Survivalist (Plane of Water)', 'skill.ste'],
  ] as const)
    expect(
      entry(name)
        .situationalNotes?.filter((note) => note.target)
        .map((note) => note.target),
      name,
    ).toEqual([target]);
  // Every outstanding calculation is recorded, never as an attribution hold.
  for (const row of heldTraits) {
    expect(
      row.mechanicsReview.outstandingCalculations.length,
      row.name,
    ).toBeGreaterThan(0);
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  }
  // Expert Explorer's machete is a proficiency fact left readable.
  expect(
    candidate('Expert Explorer (Ruins of Azlant)').mechanicsReview
      .proficiencyReview.outstandingFacts,
  ).toEqual([expect.stringContaining('machete as a simple weapon')]);
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
      `traits-381-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `traits-381-notice-${book}-complete-chain`),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    heldTraits
      .filter((row) => row.traitType === 'drawback')
      .map((row) => row.name),
  ).toEqual([
    'Umbral Unmasking',
    'Hedonistic',
    'Entomophobe',
    'Haunting Regret',
    'Betrayed (SH)',
    'Burned',
    'Too Many Secrets',
    'Family Ties',
  ]);
  // Rootless records take their book from the PCGen comparison.
  for (const [name, book] of [
    ['Accustomed to Trickery (Darkmoon Wood)', 'PZO9480'],
    ["Apprentice Devilbinder (Hell's Vengeance)", 'PZO9000-18E'],
    ['Tactician', 'PZO1125'],
    ['Witty Repartee (Kitharodian Academy)', 'PZO9221'],
  ] as const) {
    expect(candidate(name).citedSources, name).toEqual([]);
    expect(candidate(name).comparison?.book, name).toBe(book);
    expect(candidate(name).requiredNotices, name).toContain(book);
  }
  // Inherited rules the bodies change or depend on.
  for (const [name, book] of [
    ['Prolong Magic (Tiefling)', 'PZO9280'],
    ['Celestial Community (Aasimar)', 'PZO9280'],
    ['Wolf Cub (Zarongel)', 'PZO1112'],
    ['Child of Oppara (War for the Crown)', 'PZO9226'],
    ['Untapped Potential', 'PZO1132'],
    ['Expert Explorer (Ruins of Azlant)', 'PZO9455'],
    ['Shoanti Spirit-singer (Human; Bekyar or Shoanti)', 'PZO1129'],
    ['Traveler of a Hundred Lands', 'PZO9496'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Class features name the pinned class record's literal line.
  for (const [name, suffix] of [
    [
      'Shoanti Spirit-singer (Human; Bekyar or Shoanti)',
      'skald.G2SqFdNKFxbujzbH.yaml#L76',
    ],
    ['Firebug', 'alchemist.JcaqlAawhf14q1lq.yaml#L65'],
  ] as const)
    expect(
      candidate(name).inheritedRuleNotices.some((notice) =>
        notice.location.endsWith(suffix),
      ),
      name,
    ).toBe(true);
  // Unchained action-cost metadata anywhere in the bound closure, the
  // trait's own actions included, requires the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedLinked])].sort();
  expect(unchained).toHaveLength(19);
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
      'traits-381-notice-PZO1131-complete-chain',
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
    ['Firebug', 'PZO9432'],
    ['Freedom Fighter (Shokuro)', 'PZO9404'],
    ['Freedom Fighter (Shokuro)', 'PZO9422'],
    ['Family Ties', 'PZO1002-PGE'],
    ['Betrayed (SH)', 'PZO9000-2S'],
    ["Sphinx Riddler (Mummy's Mask)", 'PZO9441'],
    ["Trap Finder (Mummy's Mask)", 'PZO9441'],
  ] as const)
    expect(candidate(name).requiredNotices, name).not.toContain(book);
  const linkedNames = heldTraits.flatMap((row) =>
    row.linkedContentReview.map((linked) => linked.name),
  );
  expect(linkedNames).toHaveLength(10);
  expect(new Set(linkedNames).size).toBe(10);
  // The closure holds exactly the linked bodies.
  expect(preview.closure.map((row) => row.externalKey).sort()).toEqual(
    [
      ...new Set(
        heldTraits.flatMap((row) =>
          row.linkedContentReview.map((linked) => linked.externalKey),
        ),
      ),
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
  // Aquatic Survivalist's universal monster rule links stay a named origin.
  expect(
    candidate('Aquatic Survivalist (Plane of Water)')
      .inheritedRuleUnresolvedOrigins,
  ).toEqual([expect.stringContaining('pf-universal-monster-rules')]);
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
      batch: 'traits-381',
      candidate: candidate(name),
    });
  // "Half-Orc, Orc" maps two race atoms that must both hold (#739), and
  // Child of Oppara's prose Requirements line maps four unchecked atoms.
  for (const [name, mapped] of [
    ['Big Mouth (Half-Orc, Orc)', ['anyOf']],
    [
      'Child of Oppara (War for the Crown)',
      ['unchecked', 'unchecked', 'unchecked', 'unchecked', 'unchecked'],
    ],
  ] as const) {
    expect(kinds(name), name).toEqual(mapped);
    expect(facts(name), name).toEqual(
      expect.arrayContaining([expect.stringContaining('#739')]),
    );
  }
  expect(kinds('Shoanti Spirit-singer (Human; Bekyar or Shoanti)')).toEqual([
    'unchecked',
  ]);
  expect(kinds('Wolf Cub (Zarongel)')).toEqual(['race', 'unchecked']);
  for (const [name, gap] of [
    ['Loyalty (Grand Lodge)', 'no faction fact exists'],
    [
      'Glib Barrister (Human; Chelaxian)',
      'no heritage or ethnicity fact exists',
    ],
    ['Wolf Cub (Zarongel)', 'no deity fact exists'],
    ['Unstuck (Uringen)', 'no region fact exists'],
    [
      "Soul-Searcher's Strength (Rivethun)",
      'no faith or tradition fact exists',
    ],
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
  // The Exemplar folder is excluded by the importer's folder contract.
  expect(folders.map((row) => [row.externalKey, row.name, row.rawKey])).toEqual(
    [['pf1-content/iq0X3rMvulGIjzrd', 'Exemplar', '!folders!iq0X3rMvulGIjzrd']],
  );
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
  // Soul-Searcher's Strength's row encodes the choice as an ability pool.
  expect(
    candidate("Soul-Searcher's Strength (Rivethun)").comparison?.literalRow,
  ).toContain("BONUS:ABILITYPOOL|Soul-Searcher's Save Bonus|1");
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
    // Aquatic Survivalist links three records in the unassigned
    // pf-universal-monster-rules pack; the importer strips the links and the
    // gate reports the entry before its holds apply.
    expect(gate.failures.filter((row) => ours.has(row.externalKey))).toEqual([
      {
        externalKey: 'pf1-content/jQXbeY1eQ9HURqsQ',
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
    const orphan = candidate('Bloody-Minded');
    expect(orphan.requiredNotices).toEqual(['PZO9450', 'PZO1115', 'PZO1110']);
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
