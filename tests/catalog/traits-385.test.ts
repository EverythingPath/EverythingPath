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
} from '../fixtures/traits-385/data';
import { reviewedTraitSheet } from '../fixtures/traits-385/sheet';
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

// A sheet with the given ability scores on its base entry.
function scored(
  name: Parameters<typeof reviewedTraitSheet>[0],
  scores: Partial<Record<keyof typeof abilityTargets, number>>,
  target: string,
  situations: number[] = [],
) {
  const sheet = reviewedTraitSheet(name);
  const base = sheet.catalogEntries[0]!;
  base.modifiers = (base.modifiers ?? []).map((row) => {
    const hit = Object.entries(scores).find(
      ([ability]) =>
        abilityTargets[ability as keyof typeof abilityTargets] === row.target,
    );
    return hit ? { ...row, value: hit[1] } : row;
  });
  return calculateCharacterSheetProjections(sheet, {
    situations: situations.map((index) =>
      situation(name, index, 'trait-row-0'),
    ),
  }).current.breakdowns[target as 'skill.per'].total;
}

// Traits with no PCGen trait row at the pin, including alternate spellings.
const noRow = [
  'Shared Ancestors (Myr)',
  'Rejected Emperor',
  "Spellcaster's Anathema (Dwarf)",
  'Performance Artist (Taldor Faction)',
  'Star Reader (Sodden Lands)',
];

// Every trait whose bound content closure keeps Unchained action-cost
// metadata (owner ruling, 2026-10-17): 12 on the trait's own action and 1
// through a linked body.
const unchainedOwn = [
  'pf1-content/tL954MZqLT9104WR', // Oregent Timing
  'pf1-content/tdU3HzCZBz3Bx48D', // Numerological Gift
  'pf1-content/uSgzV5jZUwTKCY7s', // Brimstone Seer
  'pf1-content/unMsCo1sskiz9Tuv', // Split-Second Defense
  'pf1-content/vN3YJFsMD6ugNLuy', // Dtang Ma Bloodline
  'pf1-content/vS8ETig2gmH8N0sq', // Weathered Patience
  'pf1-content/vSu5qB6TTcJiGeOS', // Suicidal
  'pf1-content/vSxbq1ezwpv5moGg', // Light-Bringer
  'pf1-content/vSyjO3K00IinuElv', // Heedful Readiness
  'pf1-content/vZM5tf9Nbe7LA3Ev', // Resolve of the Rejected
  'pf1-content/w2opOBvUxIqNJ3iP', // Ichimeiyo Champion
  'pf1-content/wHybueAMNUOpZbJe', // Formerly Mind-Swapped
];
const unchainedLinked = [
  'pf1-content/u9yVXpe9U8Ysxaiv', // Fixer of Odds: the dagger's attack
];

const saves = (resolved: ReturnType<typeof resolveSheet>) => [
  resolved['save.fort'].total,
  resolved['save.ref'].total,
  resolved['save.will'].total,
];

it('resolves the reviewed trait Modifiers, with trait bonuses that never stack', () => {
  // Trait bonuses from different traits on one statistic never stack.
  const smuggler = 'Undermarket Smuggler (Goka)';
  const advocate = 'Minkai Advocate (Minkai)';
  expect(total(reviewedTraitSheet(smuggler), 'skill.blf')).toBe(1);
  expect(total(reviewedTraitSheet(advocate), 'skill.blf')).toBe(1);
  expect(total(reviewedTraitSheet(smuggler, advocate), 'skill.blf')).toBe(1);
  expect(total(reviewedTraitSheet(smuggler, advocate), 'skill.slt')).toBe(1);
  // Brimstone Seer's unmapped -1 on Charisma-based checks is a reviewed
  // untyped penalty on every Charisma-based skill; it adds to a trait bonus.
  const seer = 'Brimstone Seer (Orc)';
  expect(entry(seer).unsupported).toEqual(
    expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
  );
  for (const target of [
    'skill.blf',
    'skill.dip',
    'skill.dis',
    'skill.han',
    'skill.int',
    'skill.prf',
    'skill.umd',
  ] as const)
    expect(resolveSheet(modifiers(seer))[target].total, target).toBe(-1);
  expect(total(reviewedTraitSheet(seer), 'skill.dip')).toBe(-1);
  expect(
    total(reviewedTraitSheet(seer, "Tempter's Tongue (Tiefling)"), 'skill.dip'),
  ).toBe(0);
  // Records with no change, or a targetless one, get reviewed Modifiers:
  // unconditional where the sheet has one skill for the choice, a Situation
  // per option otherwise.
  for (const [name, target, value, conditional] of [
    ['Fixer of Odds (Second Darkness)', 'skill.pro', 1, false],
    ['Performance Artist (Taldor Faction)', 'skill.prf', 1, false],
    ['Conscientious Miner (Jinin)', 'skill.pro', 1, false],
    ['Antiquities Smuggler (Osirion)', 'skill.blf', 1, true],
    ['Bandit (River Kingdoms)', 'skill.ste', 1, true],
    ['Athletic (Ruins of Azlant)', 'skill.clm', 1, true],
    ["Lingshen's Finest (Lingshen)", 'attack.melee', 1, true],
    ['Nidalese Shadowcaster (Nidal)', 'casterLevel', 1, true],
  ] as const) {
    const index = modifiers(name).findIndex(
      (row) => target.startsWith(row.target) && row.value === value,
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
    'Fixer of Odds (Second Darkness)',
    'Performance Artist (Taldor Faction)',
    'Conscientious Miner (Jinin)',
    'Antiquities Smuggler (Osirion)',
    'Bandit (River Kingdoms)',
    'Athletic (Ruins of Azlant)',
    "Lingshen's Finest (Lingshen)",
    'Efficient Packer (Gnome)',
  ])
    expect(entry(name).unsupported, name).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
    );
  expect(
    total(reviewedTraitSheet('Fixer of Odds (Second Darkness)'), 'skill.pro'),
  ).toBe(1);
  // Choices are one Situation per option.
  for (const [name, count] of [
    ['Antiquities Smuggler (Osirion)', 3],
    ['Bandit (River Kingdoms)', 3],
    ['Athletic (Ruins of Azlant)', 3],
    ['Affinity for the Elements (any Elemental Lord)', 4],
    ['Cunning Liar (Any City)', 2],
  ] as const)
    expect(modifiers(name), name).toHaveLength(count);
  // Cunning Liar uses the Intelligence or Wisdom modifier in place of the
  // Charisma modifier on Bluff, even when it is lower.
  const liar = 'Cunning Liar (Any City)';
  const swap = (
    ability: 'Intelligence' | 'Wisdom',
    scores: Partial<Record<keyof typeof abilityTargets, number>>,
  ) =>
    scored(liar, scores, 'skill.blf', [indexOf(liar, 'skill.blf', ability)]) -
    scored(liar, scores, 'skill.blf');
  expect(swap('Intelligence', { intelligence: 16, charisma: 10 })).toBe(3);
  expect(swap('Wisdom', { wisdom: 8, charisma: 14 })).toBe(-3);
  // Heedful Readiness adds the Wisdom modifier to one initiative check.
  const heedful = 'Heedful Readiness';
  expect(scored(heedful, { wisdom: 14 }, 'init')).toBe(0);
  expect(scored(heedful, { wisdom: 14 }, 'init', [0])).toBe(2);
  // A bonus that rises in a Situation is its new total.
  const loner = 'Loner of the Rocks (Oread)';
  expect(total(reviewedTraitSheet(loner), 'skill.sur')).toBe(1);
  expect(total(reviewedTraitSheet(loner), 'skill.hea')).toBe(1);
  expect(
    resolveSheet(modifiers(loner), {
      situations: [situation(loner, indexOf(loner, 'skill.sur', 'mountain'))],
    })['skill.sur'].total,
  ).toBe(2);
  const stargazer = 'Stargazer (Iron Gods)';
  const geography = (labels: string[]) =>
    resolveSheet(modifiers(stargazer), {
      situations: labels.map((label) =>
        situation(stargazer, indexOf(stargazer, 'skill.kge', label)),
      ),
    })['skill.kge'].total;
  expect(geography([])).toBe(1);
  expect(geography(['alien monsters'])).toBe(2);
  expect(geography(['alien monsters', 'Technologist'])).toBe(3);
  const aliens = resolveSheet(modifiers(stargazer), {
    situations: [
      situation(stargazer, indexOf(stargazer, 'skill.kar', 'alien monsters')),
    ],
  });
  for (const target of ['skill.kar', 'skill.kre', 'skill.kpl'] as const)
    expect(aliens[target].total, target).toBe(2);
  const reader = 'Star Reader (Sodden Lands)';
  const starlight = indexOf(reader, 'casterLevel', 'starlight');
  const demon = indexOf(reader, 'casterLevel', 'demon');
  expect(
    [[], [starlight], [demon], [starlight, demon]].map(
      (indexes) =>
        resolveSheet(modifiers(reader), {
          situations: indexes.map((index) => situation(reader, index)),
        }).casterLevel.total,
    ),
  ).toEqual([0, 1, 2, 2]);
  // Attached's penalties of one entry do not add on a Will save against fear.
  const attached = 'Attached';
  const will = indexOf(attached, 'save.will', 'attachment');
  const fear = indexOf(attached, 'saves', 'fear');
  expect(saves(resolveSheet(modifiers(attached)))).toEqual([0, 0, 0]);
  expect(
    saves(
      resolveSheet(modifiers(attached), {
        situations: [situation(attached, will)],
      }),
    ),
  ).toEqual([0, 0, -1]);
  expect(
    saves(
      resolveSheet(modifiers(attached), {
        situations: [situation(attached, fear)],
      }),
    ),
  ).toEqual([-2, -2, -2]);
  expect(
    saves(
      resolveSheet(modifiers(attached), {
        situations: [situation(attached, will), situation(attached, fear)],
      }),
    ),
  ).toEqual([-2, -2, -2]);
  // Untyped and other published bonus types keep their type.
  for (const [name, typed] of [
    ['Foxclaw Scout (Ironfang Invasion)', ['attack trait', 'save.will morale']],
    [
      'Vialesk Historian (Plane of Water)',
      ['skill.kpl trait', 'casterLevel untyped'],
    ],
    ['Nidalese Shadowcaster (Nidal)', ['casterLevel untyped']],
    ['Heedful Readiness', ['init untyped']],
    ['Attached', ['save.will untyped', 'saves untyped']],
    [
      'Star Reader (Sodden Lands)',
      ['casterLevel untyped', 'casterLevel untyped'],
    ],
    [
      'Affinity for the Elements (any Elemental Lord)',
      [
        'spellDC untyped',
        'spellDC untyped',
        'spellDC untyped',
        'spellDC untyped',
      ],
    ],
  ] as const)
    expect(
      modifiers(name).map((row) => `${row.target} ${row.bonusType}`),
      name,
    ).toEqual(typed);
  // Shared Situations where the body's condition matches exactly.
  for (const [name, key] of [
    ['Clearheaded (Dwarf)', 'illusions'],
    ['Spirit Lodge Dreamer (Human; Erutaki)', 'illusions'],
    ['Unhinged Mentality (Lamashtu)', 'fear'],
    ['Jungle Native (Mwangi Expanse; Grippli)', 'poison'],
  ] as const)
    expect(
      modifiers(name).filter((row) => row.condition?.situation === key),
      name,
    ).toHaveLength(1);
  expect(
    saves(
      resolveSheet(modifiers('Spirit Lodge Dreamer (Human; Erutaki)'), {
        situations: ['illusions'],
      }),
    ),
  ).toEqual([1, 1, 1]);
  // Unhinged Mentality's fear and confusion bonuses are one trait bonus.
  const unhinged = 'Unhinged Mentality (Lamashtu)';
  expect(
    saves(
      resolveSheet(modifiers(unhinged), {
        situations: [
          'fear',
          situation(unhinged, indexOf(unhinged, 'saves', 'confusion')),
        ],
      }),
    ),
  ).toEqual([2, 2, 2]);
  // Exemptions and narrower conditions keep the Situation local.
  for (const [name, label] of [
    ['Attached', 'against fear effects, while'],
    ['Stoic Dignity (Oread)', 'not already suffering from'],
    ['Fortified Drinker (Cayden Cailean)', 'alcoholic beverage'],
    ['Authoritarian', 'liege or leader'],
    ['Blooded (Mindspin Mountains)', 'giants, goblins and orcs'],
  ] as const)
    expect(
      modifiers(name).some((row) =>
        JSON.stringify(row.condition?.situation ?? '').includes(label),
      ),
      name,
    ).toBe(true);
  // Damage bonuses are on damage, not attack rolls.
  for (const name of [
    'Opportune Slayer (Lamashtu)',
    'Blooded (Mindspin Mountains)',
    'Mivoni Duelist (Mivon)',
  ]) {
    expect(
      modifiers(name).map((row) => row.target),
      name,
    ).toEqual(['damage']);
    expect(
      resolveSheet(modifiers(name), { situations: [situation(name, 0)] })[
        'damage.melee'
      ].total,
      name,
    ).toBe(name.startsWith('Opportune') ? 2 : 1);
  }
  // Anticipate Evil's +1 applies to every Dexterity-based skill under one
  // Situation.
  const evil = 'Anticipate Evil (Tiefling)';
  const fiends = resolveSheet(modifiers(evil), {
    situations: [situation(evil, 0)],
  });
  for (const target of [
    'skill.acr',
    'skill.dev',
    'skill.esc',
    'skill.fly',
    'skill.rid',
    'skill.slt',
    'skill.ste',
  ] as const)
    expect(fiends[target].total, target).toBe(1);
  // Kuthite Caster's bonus is on concentration checks.
  const kuthite = 'Kuthite Caster (Zon-Kuthon)';
  expect(
    resolveSheet(modifiers(kuthite), { situations: [situation(kuthite, 0)] })
      .concentration.total,
  ).toBe(4);
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
  expect(required).toBe(134);
  // Repeated notes another record already carries are the explicit
  // covered/no-output records.
  const knowledge = [
    'skill.kdu',
    'skill.ken',
    'skill.kge',
    'skill.khi',
    'skill.klo',
    'skill.kna',
    'skill.kno',
    'skill.kpl',
    'skill.kre',
  ];
  expect(
    heldTraits.flatMap((row) =>
      row.mechanicsReview.curationRecords
        .filter((record) => !record.outputs.length)
        .map((record) => `${row.name} ${record.target}`),
    ),
  ).toEqual([
    ...['skill.kar', ...knowledge].map(
      (target) => `Brimstone Seer (Orc) ${target}`,
    ),
    'Rejected Emperor skill.kpl',
    'Rejected Emperor skill.kre',
    'Stealthy Escape skill.slt',
    'Athletic (Ruins of Azlant) skill.clm',
    'Athletic (Ruins of Azlant) skill.swm',
    ...knowledge.map(
      (target) => `Formerly Mind-Swapped (Strange Aeons) ${target}`,
    ),
    'Obscure Traditions (Elf; Snowcaster) skill.sur',
  ]);
  // Notes the drafter put on unrelated statistics are entry-level.
  for (const name of [
    'Tenacious Shifting',
    'Fixer of Odds (Second Darkness)',
    'Brimstone Seer (Orc)',
    'Athletic (Ruins of Azlant)',
    'Formerly Mind-Swapped (Strange Aeons)',
    'Obscure Traditions (Elf; Snowcaster)',
    "Tempter's Tongue (Tiefling)",
  ])
    expect(
      entry(name)
        .situationalNotes?.filter((note) => note.target)
        .map((note) => note.target),
      name,
    ).toEqual([]);
  // Retargeted or kept readable Notes.
  for (const [name, targets] of [
    ['Rejected Emperor', ['skill.kno']],
    ['Fleshwarp Exposure (Drow)', []],
    ['Giant-Blooded (Giantslayer)', ['attack', 'cmd']],
    ['Stealthy Escape', ['skill.esc']],
    ['Just Like New', ['attack.ranged']],
    ['Anticipate Evil (Tiefling)', ['init']],
    ['Ichimeiyo Champion', ['save.will']],
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
  // No body in this batch grants a weapon or armor proficiency.
  for (const row of heldTraits)
    expect(row.mechanicsReview.proficiencyReview.grants, row.name).toEqual([]);
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
      `traits-385-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `traits-385-notice-${book}-complete-chain`),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    heldTraits
      .filter((row) => row.traitType === 'drawback')
      .map((row) => row.name),
  ).toEqual(['Attached', 'Paranoid']);
  // A rootless record takes its book from the PCGen comparison.
  const gift = candidate('Numerological Gift (Dhampir; Ru-Shi)');
  expect(gift.citedSources).toEqual([]);
  expect(gift.comparison?.book).toBe('PZO9427');
  expect(gift.requiredNotices).toEqual([
    'PZO9427',
    'PZO1115',
    'PZO1131',
    'PZO1110',
  ]);
  // Inherited rules the bodies change, restate or depend on.
  for (const [name, books] of [
    ['Giant-Blooded (Giantslayer)', ['PZO1112']],
    ['Jacket Training', ['PZO1115']],
    ['Kuthite Caster (Zon-Kuthon)', ['PZO1117']],
    ['Nidalese Shadowcaster (Nidal)', ['PZO1117']],
    ['Dtang Ma Bloodline (Dtang Ma)', ['PZO1115', 'PZO1117']],
    ['Stargazer (Iron Gods)', ['PZO9000-15E', 'PZO9272']],
    ['Just Like New', ['PZO1118']],
    ['Resolve of the Rejected', ['PZO1118']],
    ['Enduring Mutagen', ['PZO1115']],
    ['Fixer of Odds (Second Darkness)', ['PZO1123']],
  ] as const)
    for (const book of books)
      expect(
        candidate(name).inheritedRuleNotices.some(
          (notice) => notice.book === book,
        ) ||
          candidate(name).linkedContentReview.some((linked) =>
            linked.sources.some((source) => source.id === book),
          ),
        `${name} ${book}`,
      ).toBe(true);
  // Class features name the pinned class record's literal line.
  for (const [name, suffix] of [
    ['Enduring Mutagen', 'alchemist.JcaqlAawhf14q1lq.yaml#L69'],
    ['Resolve of the Rejected', 'gunslinger.jOUMbWoFZHQlAMpJ.yaml#L113'],
  ] as const)
    expect(
      candidate(name).inheritedRuleNotices.some((notice) =>
        notice.location.endsWith(suffix),
      ),
      name,
    ).toBe(true);
  // The pain and shadow descriptors take their book from other pinned bodies
  // that cite Ultimate Magic 138.
  for (const [name, file] of [
    ['Kuthite Caster (Zon-Kuthon)', 'Eoxian_Experiment__Eox__kQtwLZMo0YX9w1sP'],
    [
      'Kuthite Caster (Zon-Kuthon)',
      'Shadow_Dissident__Nidal__pAvqhoobSeoW25on',
    ],
    [
      'Nidalese Shadowcaster (Nidal)',
      'Shadow_Dissident__Nidal__pAvqhoobSeoW25on',
    ],
  ] as const)
    expect(
      candidate(name).inheritedRuleNotices.some(
        (notice) => notice.book === 'PZO1117' && notice.location.includes(file),
      ),
      `${name} ${file}`,
    ).toBe(true);
  // Unresolved origins stay named, never guessed.
  for (const [name, text] of [
    ['Jungle Native (Mwangi Expanse; Grippli)', 'disease descriptor'],
    ['Fixer of Odds (Second Darkness)', 'pf-goods-services'],
  ] as const)
    expect(
      candidate(name).inheritedRuleUnresolvedOrigins.join(' '),
      name,
    ).toContain(text);
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
      'traits-385-notice-PZO1131-complete-chain',
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
    ['Inciter (Hobgoblin)', 'PZO9423'],
    ['Stargazer (Iron Gods)', 'PZO9417'],
    ['Stargazer (Iron Gods)', 'PZO9448'],
  ] as const)
    expect(candidate(name).requiredNotices, name).not.toContain(book);
  expect(
    heldTraits
      .flatMap((row) => row.linkedContentReview.map((linked) => linked.name))
      .sort(),
  ).toEqual(['Armored Coat', 'Combat Expertise', 'Dagger', 'Doubt']);
  // The closure holds exactly the linked bodies.
  expect(preview.closure.map((row) => row.externalKey).sort()).toEqual(
    heldTraits
      .flatMap((row) =>
        row.linkedContentReview.map((linked) => linked.externalKey),
      )
      .sort(),
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
      batch: 'traits-385',
      candidate: candidate(name),
    });
  expect(kinds('Sensing Imperfection (Irori; Halfling)')).toEqual([
    'unchecked',
    'race',
  ]);
  expect(kinds('Pomp and Pageantry (Halfling; Taldor)')).toEqual([
    'race',
    'unchecked',
  ]);
  expect(kinds('Strength of the Land (Dwarf)')).toBeUndefined();
  for (const [name, gap] of [
    ['Performance Artist (Taldor Faction)', 'no faction fact exists'],
    ['Thoroughbred (Human; Keleshite)', 'no heritage or ethnicity fact exists'],
    ['Kuthite Caster (Zon-Kuthon)', 'no deity fact exists'],
    ['Linebreaker (Belkzen)', 'no region fact exists'],
    [
      'Oregent Timing (Andoran; Oregent)',
      'no settlement or region fact exists',
    ],
    ['Jungle Native (Mwangi Expanse; Grippli)', 'no race or region fact'],
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
  // The folder is excluded by the importer's folder contract.
  expect(folders.map((row) => [row.externalKey, row.name, row.rawKey])).toEqual(
    [['pf1-content/uFWvsCAH0jX3fq16', 'Cosmic', '!folders!uFWvsCAH0jX3fq16']],
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
  // Cunning Liar's row only raises the check; Toxophilite's description is in
  // a .MOD row; the Dtang Ma bloodlines are the APG and UM rows.
  expect(candidate('Cunning Liar (Any City)').comparison?.literalRow).toContain(
    'BONUS:SKILL|Bluff|(max(INT,WIS))-CHA',
  );
  expect(
    candidate('Toxophilite (Aasimar; Plumekith)').additionalComparisonLeads[0]
      ?.literalRow,
  ).toContain('critical hits with bows');
  expect(
    candidate('Dtang Ma Bloodline (Dtang Ma)')
      .inheritedRuleComparisonEvidence.slice(1)
      .map((row) => `${row.book} ${row.literalRow.split('\t')[0]}`),
  ).toEqual([
    'PZO1115 Starsoul Bloodline',
    'PZO1115 Stormborn Bloodline',
    'PZO1117 Maestro Bloodline',
  ]);
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
      required: 134,
      checked: 134,
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
    // Fixer of Odds links a die in the excluded goods-and-services pack; the
    // importer strips the link and the gate reports the entry before its holds
    // apply.
    expect(gate.failures.filter((row) => ours.has(row.externalKey))).toEqual([
      {
        externalKey: 'pf1-content/u9yVXpe9U8Ysxaiv',
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
    const orphan = candidate('Merchant of Katheer (Qadira)');
    expect(orphan.requiredNotices).toEqual(['PZO9406', 'PZO1115', 'PZO1110']);
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
