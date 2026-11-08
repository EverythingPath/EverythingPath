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
} from '../fixtures/traits-386/data';
import { reviewedTraitSheet } from '../fixtures/traits-386/sheet';
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
  'Secrets of the Sphinx (Scarab Sages)',
  'Bad Reputation (Sczarni Faction)',
  'Crisis of Faith',
  'Divine Denier',
  'Blessed of the Norns (Lands of the Linnorm Kings)',
  'Darklands Trader',
  'Fiendish Presence (Cheliax Faction)',
];

// Every trait whose bound content closure keeps Unchained action-cost
// metadata (owner ruling, 2026-10-17): 21 on the trait's own action and 5
// through linked bodies, 2 of them both ways.
const unchainedOwn = [
  'pf1-content/wWmeeJMTjCwgbp0B', // Sustaining Performance
  'pf1-content/wbPR6KmhVPml7OJ5', // Secrets of the Sphinx
  'pf1-content/wqJhrlibYmtY5fvo', // Voice of Monsters
  'pf1-content/xKKh6c2KMLhkPX4e', // Absolute Loyalty
  'pf1-content/y2x5ZuKbQuNYJIMV', // Vindictive Strike
  'pf1-content/y6UGwVK6llm3uYIn', // Lycanthropic Bloodlust
  'pf1-content/yGx5a0dtknJSUHcR', // Effortless Aid
  'pf1-content/yNolSfwBLZPpMwzr', // Divine Denier
  'pf1-content/yTs8hwDbLnHb3PJO', // Sacred Touch
  'pf1-content/ydSLUMoyHwUQ9Bny', // Besmara's Name
  'pf1-content/yekAM1x8BJhtF4ab', // Wealthy Dabbler
  'pf1-content/yqPzsXc9aiegGP1A', // Bountiful Herb-Lore
  'pf1-content/z3BxZsDcfbYDlhhD', // Prehensile Whip
  'pf1-content/z9eBlicOvN7v17CA', // Elemental Endowment
  'pf1-content/zKHimORUUqumkEPa', // Touched by the Sky
  'pf1-content/zQJasAs7YOSvBOux', // Lamasaran Performer
  'pf1-content/zUYEK6EJ4M8dof6P', // Unstable Mutagen
  'pf1-content/zYEHC6GeWLNIl1Nr', // Dismantle Order
  'pf1-content/ziMNMNB1Za0tXUpO', // Black Powder Bravado
  'pf1-content/znVNJkn5hkmGtzca', // Chance Encounter
  'pf1-content/zvimna0Hb2kltmqo', // Natural Ritualist
];
const unchainedLinked = [
  'pf1-content/wqJhrlibYmtY5fvo', // Voice of Monsters: speak with animals
  'pf1-content/xKKh6c2KMLhkPX4e', // Absolute Loyalty: atonement
  'pf1-content/xkXUmZmeT51KURIO', // Carpenden Lobber: the alchemical weapons and their spells
  'pf1-content/xzdpXbursnlx3j7Y', // Crisis of Faith: atonement
  'pf1-content/xznSSYabFOsqmMx8', // Lucid Dreamer: nightmare
];
// Bodies two links away: the tanglefoot bag and thunderstone link spells.
const reached = [
  'pf1/53dyu81yaw4y0nz4', // Glyph of Warding
  'pf1/j9qpy0d585f8lpm4', // Web
  'pf1/jcr72piqo6g549e1', // Slow
  'pf1/nee6cxpoekp3aklq', // Alarm
  'pf1/wralcmyi4tdcai24', // Black Tentacles
];

const saves = (resolved: ReturnType<typeof resolveSheet>) => [
  resolved['save.fort'].total,
  resolved['save.ref'].total,
  resolved['save.will'].total,
];

it('resolves the reviewed trait Modifiers, with trait bonuses that never stack', () => {
  // Trait bonuses from different traits on one statistic never stack.
  const shenmen = 'Shenmen Prospector (Shenmen)';
  const crafter = 'Magic Crafter';
  expect(total(reviewedTraitSheet(shenmen), 'skill.apr')).toBe(1);
  expect(total(reviewedTraitSheet(crafter), 'skill.apr')).toBe(1);
  expect(total(reviewedTraitSheet(shenmen, crafter), 'skill.apr')).toBe(1);
  expect(total(reviewedTraitSheet(shenmen, crafter), 'skill.kdu')).toBe(1);
  const hongal = 'Hongal Bloodrider (Hongal)';
  const cliff = 'Cliff-Master (Varisia; Goblin)';
  expect(total(reviewedTraitSheet(hongal, cliff), 'skill.rid')).toBe(1);
  expect(total(reviewedTraitSheet(hongal, cliff), 'skill.clm')).toBe(1);
  // Magic Crafter's Craft bonus is untyped and situational.
  expect(resolveSheet(modifiers(crafter))['skill.crf'].total).toBe(0);
  expect(
    resolveSheet(modifiers(crafter), {
      situations: [
        situation(crafter, indexOf(crafter, 'skill.crf', 'magic items')),
      ],
    })['skill.crf'].total,
  ).toBe(1);
  // Glory of Old uses three shared Situations; same-type bonuses in one entry
  // never add up.
  const glory = 'Glory of Old (Five Kings Mountains)';
  expect(saves(resolveSheet(modifiers(glory)))).toEqual([0, 0, 0]);
  expect(
    saves(resolveSheet(modifiers(glory), { situations: ['spells'] })),
  ).toEqual([1, 1, 1]);
  expect(
    saves(
      resolveSheet(modifiers(glory), {
        situations: ['spells', 'spellLike', 'poison'],
      }),
    ),
  ).toEqual([1, 1, 1]);
  // Shared Situations exactly where the body's condition matches.
  for (const [name, key] of [
    ['Crisis of Faith', 'illusions'],
    ["Pattern Seeker (Hell's Rebels)", 'illusions'],
    ['Void Child (Diaspora)', 'fear'],
  ] as const)
    expect(
      saves(resolveSheet(modifiers(name), { situations: [key] })),
      name,
    ).toEqual([1, 1, 1]);
  // A bonus that rises in a Situation is its new total.
  const voidChild = 'Void Child (Diaspora)';
  const far = situation(voidChild, indexOf(voidChild, 'saves', '30 feet'));
  expect(
    saves(resolveSheet(modifiers(voidChild), { situations: ['fear', far] })),
  ).toEqual([2, 2, 2]);
  const customer = 'Best Customer (Jade Regent)';
  const heal = (labels: string[]) =>
    resolveSheet(modifiers(customer), {
      situations: labels.map((label) =>
        situation(customer, indexOf(customer, 'skill.hea', label)),
      ),
    })['skill.hea'].total;
  expect(heal([])).toBe(0);
  expect(heal(['on hand'])).toBe(2);
  expect(heal(['on hand', 'drinking buddy'])).toBe(4);
  expect(total(reviewedTraitSheet(customer), 'skill.hea')).toBe(0);
  const eye = 'Mutant Eye';
  const motive = (labels: string[]) =>
    resolveSheet(modifiers(eye), {
      situations: labels.map((label) =>
        situation(eye, indexOf(eye, 'skill.sen', label)),
      ),
    })['skill.sen'].total;
  expect(motive(['uncovered and open'])).toBe(2);
  expect(motive(['uncovered and open', 'mind-affecting'])).toBe(4);
  expect(
    resolveSheet(modifiers(eye), {
      situations: [situation(eye, indexOf(eye, 'skill.blf', 'humanoids'))],
    })['skill.blf'].total,
  ).toBe(-1);
  // Different bonus types stack: Rugged Dragon Hunter's trait +2 and untyped
  // +1 on Survival, Spirit Talker's racial +1 with Adrift's trait +1.
  const hunter = 'Rugged Dragon Hunter';
  expect(
    resolveSheet(modifiers(hunter), {
      situations: [
        situation(hunter, indexOf(hunter, 'skill.sur', 'track dragons')),
        situation(hunter, indexOf(hunter, 'skill.sur', 'favored terrain')),
      ],
    })['skill.sur'].total,
  ).toBe(3);
  expect(
    resolveSheet(modifiers(hunter), {
      situations: [
        situation(hunter, indexOf(hunter, 'skill.per', 'favored terrain')),
      ],
    })['skill.per'].total,
  ).toBe(1);
  const talker = 'Spirit Talker (Mwangi shamanistic faith)';
  expect(
    modifiers(talker).map((row) => [row.target, row.bonusType, row.value]),
  ).toEqual([
    ['save.will', 'racial', 1],
    ['save.will', 'untyped', -1],
  ]);
  const adrift = 'Adrift (Aasimar)';
  expect(
    saves(
      resolveSheet([...modifiers(talker), ...modifiers(adrift)], {
        situations: [
          situation(talker, 0),
          situation(adrift, indexOf(adrift, 'saves', 'charm')),
        ],
      }),
    ),
  ).toEqual([1, 1, 2]);
  // Adrift's bonus is on all saves; Child of Two Peoples' only on Will.
  const child = 'Child of Two Peoples (Half-Elf, Half-Orc, Human)';
  expect(
    saves(
      resolveSheet(modifiers(child), {
        situations: [situation(child, 0)],
      }),
    ),
  ).toEqual([0, 0, 2]);
  // Lonely: the imported Sense Motive penalty always applies; the Perception
  // and save penalties are Situations.
  const lonely = 'Lonely';
  expect(total(reviewedTraitSheet(lonely), 'skill.sen')).toBe(-2);
  expect(total(reviewedTraitSheet(lonely), 'skill.per')).toBe(0);
  expect(
    resolveSheet(modifiers(lonely), {
      situations: [situation(lonely, indexOf(lonely, 'saves', 'charm'))],
    })['save.will'].total,
  ).toBe(-2);
  // Unmapped or targetless imported changes get reviewed Modifiers.
  for (const [name, target, value, conditional] of [
    ['Focused Mind', 'concentration', 2, false],
    ['Eager Performer (Rise of the Runelords)', 'skill.prf', 1, false],
    ['Gold Goblin Regular (Riddleport)', 'skill.pro', 1, false],
    ['Anatomist', 'attack.melee', 1, true],
    ['Trade Talk (Half-Elf, Human-Raised)', 'skill.crf', 1, true],
    ['Foster Child (Jade Regent)', 'skill.kre', 2, true],
  ] as const) {
    const index = modifiers(name).findIndex(
      (row) =>
        target.startsWith(row.target) &&
        row.value === value &&
        (name !== 'Foster Child (Jade Regent)' ||
          JSON.stringify(row.condition).includes('religion')),
    );
    expect(index, name).toBeGreaterThanOrEqual(0);
    expect(entry(name).unsupported, name).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
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
  // Choices are one Situation per option.
  for (const [name, count] of [
    ['Trade Talk (Half-Elf, Human-Raised)', 4],
    ['Foster Child (Jade Regent)', 11],
    ['Secrets of the Sphinx (Scarab Sages)', 10],
  ] as const)
    expect(modifiers(name), name).toHaveLength(count);
  expect(
    modifiers('Foster Child (Jade Regent)')
      .filter((row) => row.target.startsWith('skill.k'))
      .every((row) => row.bonusType === 'untyped'),
  ).toBe(true);
  // Local Ties: reviewed change replacements zero the imported +1 on both
  // skills; the chosen skill gets +1, or +3 with the Technologist feat.
  const ties = 'Local Ties (Iron Gods)';
  expect(
    modifiers(ties)
      .slice(0, 2)
      .map((row) => [row.target, row.value, row.condition]),
  ).toEqual([
    ['skill.dev', 0, undefined],
    ['skill.ken', 0, undefined],
  ]);
  expect(total(reviewedTraitSheet(ties), 'skill.dev')).toBe(0);
  expect(total(reviewedTraitSheet(ties), 'skill.ken')).toBe(0);
  const chose = (label: string, target: 'skill.dev' | 'skill.ken') =>
    resolveSheet(modifiers(ties), {
      situations: [situation(ties, indexOf(ties, target, label))],
    })[target].total;
  expect(chose('if you chose Disable Device', 'skill.dev')).toBe(1);
  expect(chose('Disable Device and possess', 'skill.dev')).toBe(3);
  expect(chose('if you chose Knowledge (engineering)', 'skill.ken')).toBe(1);
  // Targets the Foundry notes got wrong are reviewed onto the right leaf.
  const lobber = 'Carpenden Lobber (Andoran; Carpenden)';
  const thrown = resolveSheet(modifiers(lobber), {
    situations: [situation(lobber, 0)],
  });
  expect([thrown['attack.ranged'].total, thrown['attack.melee'].total]).toEqual(
    [2, 0],
  );
  for (const [name, label, value] of [
    ['River Rat (Marsh or River)', 'dagger', 1],
    ['Oregent Vandal (Andoran; Oregent)', 'hardness', 2],
    ["Death's Deputy (Tiefling; Grimspawn)", 'negative hit points', 2],
  ] as const)
    expect(
      resolveSheet(modifiers(name), {
        situations: [situation(name, indexOf(name, 'damage', label))],
      })['damage.melee'].total,
      name,
    ).toBe(value);
  expect(total(reviewedTraitSheet('Adrift (Aasimar)'), 'save.will')).toBe(0);
  const temple = 'Tianjing Temple Guard (Tianjing)';
  const opportunity = resolveSheet(modifiers(temple), {
    situations: [situation(temple, 0)],
  });
  expect([
    opportunity['attack.melee'].total,
    opportunity['attack.ranged'].total,
  ]).toEqual([1, 0]);
  // Trait AC bonuses resolve to the ac.other leaf, never armor or shield.
  for (const name of [
    'Aerial Harrier (Strix)',
    'Blessed of the Norns (Lands of the Linnorm Kings)',
  ]) {
    const index = indexOf(name, 'ac', '');
    expect(modifiers(name)[index]?.bonusType, name).toBe('trait');
    const resolved = resolveSheet(modifiers(name), {
      situations: [situation(name, index)],
    });
    expect(resolved['ac.other'].total, name).toBe(1);
    expect(resolved['ac.armor'].total, name).toBe(0);
  }
  // Caster level, spell DC and CMD Situations.
  for (const [name, target, label, value] of [
    ['Student of Faith (Rise of the Runelords)', 'casterLevel', 'cure', 1],
    ['Castrovel Gatekeeper (Lashunta)', 'casterLevel', 'teleportation', 1],
    ["Pattern Seeker (Hell's Rebels)", 'spellDC', 'pattern', 1],
    ['Log Roller (Forest)', 'cmd', 'trip', 1],
    ["Hellknight Aspirant (Hell's Vengeance)", 'cmd', 'sunder or disarm', 1],
  ] as const) {
    expect(resolveSheet(modifiers(name))[target].total, name).toBe(0);
    expect(
      resolveSheet(modifiers(name), {
        situations: [situation(name, indexOf(name, target, label))],
      })[target].total,
      name,
    ).toBe(value);
  }
  // Treasure Mapper's untyped +2 on Survival and Profession (sailor).
  const mapper = 'Treasure Mapper (Ilizmagorti)';
  for (const target of ['skill.sur', 'skill.pro'] as const)
    expect(
      resolveSheet(modifiers(mapper), {
        situations: [situation(mapper, indexOf(mapper, target, 'navigate'))],
      })[target].total,
    ).toBe(2);
  // Same-text local Situations on one entry select together.
  const ritualist = 'Natural Ritualist';
  const ritual = resolveSheet(modifiers(ritualist), {
    situations: [situation(ritualist, 0)],
  });
  expect([ritual['skill.kna'].total, ritual['skill.sur'].total]).toEqual([
    2, 2,
  ]);
  const sphinx = 'Secrets of the Sphinx (Scarab Sages)';
  const knowledge = resolveSheet(modifiers(sphinx), {
    situations: [situation(sphinx, 0)],
  });
  expect(knowledge['skill.kar'].total).toBe(2);
  expect(knowledge['skill.kre'].total).toBe(2);
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
  expect(required).toBe(99);
  // Repeated notes another record already carries are the explicit
  // covered/no-output records.
  expect(
    heldTraits.flatMap((row) =>
      row.mechanicsReview.curationRecords
        .filter((record) => !record.outputs.length)
        .map((record) => `${row.name} ${record.target}`),
    ),
  ).toEqual([
    'Sustaining Performance (The Shackles; bard) skill.prf',
    'Effortless Aid (Human; Garundi) skills',
    ...['skill.blf', 'skill.dis', 'skill.slt', 'skill.ste'].map(
      (target) => `Chance Encounter (Wrath of the Righteous) ${target}`,
    ),
  ]);
  // Notes the drafter put on statistics the rule doesn't change are
  // entry-level.
  for (const name of [
    'Blessed Touch',
    'Effortless Aid (Human; Garundi)',
    'Divine Denier',
    'Bountiful Herb-Lore (Cassomir)',
    'Elemental Endowment (Osirion)',
    'Cross-Knowledge',
    "Faith's Hunter",
    'Chance Encounter (Wrath of the Righteous)',
    'Local Ties (Iron Gods)',
  ])
    expect(
      entry(name)
        .situationalNotes?.filter((note) => note.target)
        .map((note) => note.target),
      name,
    ).toEqual([]);
  // Retargeted or kept readable Notes.
  for (const [name, targets] of [
    ['Sustaining Performance (The Shackles; bard)', ['skill.hea']],
    ['Celestial Tracker (Aasimar; Angelkin)', ['skill.sur']],
    ['Wary Eye', ['init']],
    ['Faith Healer (Aasimar)', ['skill.hea']],
    ['Gesture Expertise', ['skill.lin']],
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
  // No body in this batch gets a structured proficiency grant; Hellknight
  // Aspirant's weapon training stays an outstanding fact.
  for (const row of heldTraits)
    expect(row.mechanicsReview.proficiencyReview.grants, row.name).toEqual([]);
  expect(
    heldTraits
      .filter(
        (row) => row.mechanicsReview.proficiencyReview.outstandingFacts.length,
      )
      .map((row) => row.name),
  ).toEqual(["Hellknight Aspirant (Hell's Vengeance)"]);
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
      `traits-386-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `traits-386-notice-${book}-complete-chain`),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    heldTraits
      .filter((row) => row.traitType === 'drawback')
      .map((row) => row.name),
  ).toEqual(['Lonely']);
  // A rootless record takes its book from the PCGen comparison.
  const bravado = candidate('Black Powder Bravado');
  expect(bravado.citedSources).toEqual([]);
  expect(bravado.comparison?.book).toBe('PZO1125');
  expect(bravado.requiredNotices).toEqual([
    'PZO1125',
    'PZO1115',
    'PZO1118',
    'PZO1131',
    'PZO1110',
  ]);
  // Inherited rules the bodies change, restate or depend on.
  for (const [name, books] of [
    ['Martial Performer', ['PZO1118']],
    ['Black Powder Bravado', ['PZO1118']],
    ['Local Ties (Iron Gods)', ['PZO9000-15E', 'PZO9272']],
    ['Chance Encounter (Wrath of the Righteous)', ['PZO1126']],
    ['Unstable Mutagen', ['PZO1115']],
    ['Cross-Knowledge', ['PZO1115']],
    [
      'Carpenden Lobber (Andoran; Carpenden)',
      ['PZO9445', 'PZO1123', 'PZO9410'],
    ],
    ['Natural-Born Leader (UC)', ['PZO1110']],
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
    ['Unstable Mutagen', 'alchemist.JcaqlAawhf14q1lq.yaml#L69'],
    ['Cross-Knowledge', 'alchemist.JcaqlAawhf14q1lq.yaml#L98'],
    ['Black Powder Bravado', 'gunslinger.jOUMbWoFZHQlAMpJ.yaml#L113'],
  ] as const)
    expect(
      candidate(name).inheritedRuleNotices.some((notice) =>
        notice.location.endsWith(suffix),
      ),
      name,
    ).toBe(true);
  // Unresolved root origins stay named, never guessed.
  for (const name of noRow)
    expect(
      candidate(name).inheritedRuleUnresolvedOrigins.join(' '),
      name,
    ).toContain('root origin remains held');
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
  const bodies = new Map(
    [...preview.entries, ...preview.closure].map((row) => [
      row.externalKey,
      row,
    ]),
  );
  for (const key of unchained) {
    const row = heldTraits.find((row) => row.externalKey === key)!;
    expect(row.noticeHoldIds, row.name).toContain(
      'traits-386-notice-PZO1131-complete-chain',
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
  // Unpinned printings are not required.
  expect(candidate('Local Ties (Iron Gods)').requiredNotices).not.toContain(
    'PZO9448',
  );
  expect(
    heldTraits
      .flatMap((row) => row.linkedContentReview.map((linked) => linked.name))
      .sort(),
  ).toEqual([
    'Atonement',
    'Atonement',
    'Favored Enemy',
    'Favored Terrain',
    'Leadership',
    'Nightmare',
    'Speak with Animals',
    'Tanglefoot Bag',
    'Thunderstone',
  ]);
  // The closure holds exactly the linked bodies and the bodies they link.
  expect(preview.closure.map((row) => row.externalKey).sort()).toEqual(
    [
      ...new Set([
        ...heldTraits.flatMap((row) =>
          row.linkedContentReview.map((linked) => linked.externalKey),
        ),
        ...reached,
      ]),
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
      batch: 'traits-386',
      candidate: candidate(name),
    });
  expect(kinds('Child of Two Peoples (Half-Elf, Half-Orc, Human)')).toEqual([
    'anyOf',
  ]);
  expect(kinds('Trade Talk (Half-Elf, Human-Raised)')).toEqual([
    'race',
    'unchecked',
  ]);
  expect(kinds('River Rat (Marsh or River)')).toEqual(['unchecked']);
  expect(kinds('Voice of Monsters (Lamashtu)')).toBeUndefined();
  for (const [name, gap] of [
    ['Secrets of the Sphinx (Scarab Sages)', 'no faction fact exists'],
    [
      'Celestial Tracker (Aasimar; Angelkin)',
      'no heritage or ethnicity fact exists',
    ],
    ['Vindictive Strike (Gyronna)', 'no deity fact exists'],
    ['Dusk Dancer (Halfling; Nidal)', 'no region fact exists'],
    ['Lost Role Model (Famous Dungeon)', 'no settlement fact exists'],
    ['Dismantle Order', 'no knightly code fact exists'],
    ['Educated Druggist (Alchemist)', '(#739)'],
    ['Child of Two Peoples (Half-Elf, Half-Orc, Human)', '(#739)'],
    ['Lucid Dreamer (Varisian Wanderers, Wonderseekers)', '(#739)'],
    ['Voice of Monsters (Lamashtu)', '(#739)'],
    ['Castrovel Gatekeeper (Lashunta)', '(#739)'],
  ] as const)
    expect(facts(name), name).toEqual(
      expect.arrayContaining([expect.stringContaining(gap)]),
    );
  for (const row of heldTraits)
    expect(row.mechanicsReview.prerequisiteReview.normalizedAtoms).toEqual(
      entry(row.name).prerequisites ?? [],
    );
});

it('pins all 93 keys, the complete bodies, checked bindings and literal PCGen evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(93);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    93,
  );
  expect(review.counts).toEqual({
    total: 93,
    admitted: 0,
    held: 93,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 0,
    recordLevel35Holds: 0,
  });
  // No folder record is in this batch.
  expect(folders).toEqual([]);
  expect(preview.entries).toHaveLength(93);
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
        reviewedOn: '2026-10-19',
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
  // Faith Healer's row is only bonus code (its description is a .MOD row);
  // Child of Two Peoples is split by race; Local Ties encodes the choice.
  expect(candidate('Faith Healer (Aasimar)').comparison?.literalRow).toContain(
    'BONUS:SKILL|Heal|1|TYPE=Trait',
  );
  expect(
    candidate('Child of Two Peoples (Half-Elf, Half-Orc, Human)')
      .additionalComparisonLeads[0]?.literalRow,
  ).toContain('Child of Two Peoples (Half-human)');
  expect(candidate('Local Ties (Iron Gods)').comparison?.literalRow).toContain(
    'Choose Disable Device or Knowledge (engineering)',
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
      required: 99,
      checked: 99,
      missing: 0,
      descriptions: { candidates: 93, checked: 93 },
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
    // Every link resolves in the full-corpus closure, so no entry fails
    // before its holds apply.
    expect(gate.failures.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    const held = gate.held.filter((row) => ours.has(row.externalKey));
    expect(held).toHaveLength(93);
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
    const orphan = candidate('Hongal Bloodrider (Hongal)');
    expect(orphan.requiredNotices).toEqual(['PZO9421', 'PZO1115', 'PZO1110']);
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
