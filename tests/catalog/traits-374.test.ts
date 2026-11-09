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
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  type CharacterSheetInput,
} from '../../src/lib/character-sheet';
import {
  review,
  heldTraits,
  folders,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/traits-374/data';
import { reviewedTraitSheet } from '../fixtures/traits-374/sheet';
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
  'Born Free',
  'Tomb Raider (Scarab Sages)',
  'Weed Resistance (Kyonin)',
  'Starlit Hexer (any Outer God)',
  'Elven Bitterness (Kyonin)',
  'Shiv (Sczarni Faction)',
  'Keeper of the Secret Shame (Elf)',
  'Keleshite Trade Camel (Camel)',
  'Demonblight Reistance',
  'Beastspeaker (The Concordance)',
  "Lamia's Bane",
  'Weapon Style (Lantern Lodge )',
  'Helpless',
  'Ancestral Armor',
  'Empathic Diplomat (Qadira, Osirion)',
  'Dormant Defense',
];

// Every trait whose bound content closure keeps Unchained action-cost
// metadata (owner ruling, 2026-10-17): 11 on the trait's own action and 1
// through a linked body.
const unchainedOwn = [
  'pf1-content/LrK0lPy2YCpx5kEZ', // Urban Sleuth
  'pf1-content/M14DmA6SOWvTh4cF', // Relentless Duty
  'pf1-content/M1d5yYd1zYyZxq3S', // Born Free
  'pf1-content/MkzY8En0kZ571Gap', // Naturally Gifted
  'pf1-content/MxkqstpbDjpGdEUy', // Huldra's Luck
  'pf1-content/MzM9poZYASmOUXCR', // Priest-Blessed
  'pf1-content/N5lbmXxsxgCfuOww', // My Word Is My Bond
  'pf1-content/NNFNemqFb21Bi0xt', // Ritualistic
  'pf1-content/OEl2Lao1hGrgkiJ1', // Knowledgeable Caster
  'pf1-content/ObdGrKmyQAmx0RgQ', // Earthsense
  'pf1-content/Ocn34lcCVWOEZI75', // Darkest Before Dawn
];
const unchainedLinked = [
  'pf1-content/N8tNoADKzuE2r66c', // Thrill Seeker: Firework (star candle)
];

// A base sheet with the given ability scores, for the ability swaps.
function withScores(
  sheet: ReturnType<typeof reviewedTraitSheet>,
  scores: Partial<Record<'int' | 'wis' | 'cha', number>>,
) {
  const [base, ...rest] = sheet.catalogEntries;
  return {
    ...sheet,
    catalogEntries: [
      {
        ...base!,
        modifiers: base!.modifiers.map((modifier) => {
          const ability = Object.entries(scores).find(
            ([key]) =>
              modifier.target ===
              abilityTargets[
                (
                  {
                    int: 'intelligence',
                    wis: 'wisdom',
                    cha: 'charisma',
                  } as const
                )[key as 'int' | 'wis' | 'cha']
              ],
          );
          return ability ? { ...modifier, value: ability[1] } : modifier;
        }),
      },
      ...rest,
    ],
  };
}

it('resolves the reviewed trait Modifiers, with trait bonuses that never stack', () => {
  // Trait bonuses from different traits on one skill never stack.
  expect(total(reviewedTraitSheet('Devotee of the Green'), 'skill.kge')).toBe(
    1,
  );
  expect(
    total(
      reviewedTraitSheet('Devotee of the Green', "Nomadic (Human; Bas'o)"),
      'skill.kge',
    ),
  ).toBe(1);
  expect(
    total(reviewedTraitSheet('Devotee of the Green', 'Savage'), 'skill.kna'),
  ).toBe(1);
  // A bonus that rises in a Situation is its new total: Vexing Defender's +1
  // on Acrobatics becomes +4, Imposing Scion's +1 on Intimidate becomes +2,
  // and Darkest Before Dawn's daily +4 replaces its +2.
  for (const [name, target, label, base, raised] of [
    ['Vexing Defender (Giantslayer)', 'skill.acr', 'larger enemy', 1, 4],
    ['Imposing Scion', 'skill.int', 'bloodline', 1, 2],
  ] as const) {
    expect(resolveSheet(modifiers(name))[target].total, name).toBe(base);
    expect(
      resolveSheet(modifiers(name), {
        situations: [situation(name, indexOf(name, target, label))],
      })[target].total,
      name,
    ).toBe(raised);
  }
  const dawn = 'Darkest Before Dawn';
  expect(
    resolveSheet(modifiers(dawn), {
      situations: [situation(dawn, 0), situation(dawn, 1)],
    })['save.will'].total,
  ).toBe(4);
  // Targetless imported changes contribute nothing; reviewed Modifiers supply
  // the rule under its Situation.
  for (const [name, target, value] of [
    ['Brastlewark Businessman (Gnome)', 'skill.crf', 2],
    ['Varisian Wanderer (Varisia)', 'skill.slt', 1],
    ['Conspiracy Hunter (Council of Thieves)', 'skill.ste', 1],
    ['Secret Knowledge (Norgorber)', 'skill.kre', 2],
    ["Urban Sleuth (Hell's Rebels)", 'skill.kpl', 1],
    ['Knowledgeable Caster', 'skill.kar', 1],
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
  // Choices are one Situation per option.
  for (const [name, count] of [
    ["Urban Sleuth (Hell's Rebels)", 4],
    ['Varisian Wanderer (Varisia)', 3],
    ['Conspiracy Hunter (Council of Thieves)', 6],
    ['Secret Knowledge (Norgorber)', 10],
    ['Knowledgeable Caster', 11],
    ['Against the Technic League (Iron Gods)', 2],
  ] as const)
    expect(modifiers(name), name).toHaveLength(count);
  // Empathic Diplomat uses Wisdom instead of Charisma on Diplomacy; Precise
  // Treatment's imported swap uses Intelligence instead of Wisdom on Heal.
  const diplomat = calculateCharacterSheetProjections(
    withScores(reviewedTraitSheet('Empathic Diplomat (Qadira, Osirion)'), {
      wis: 14,
      cha: 8,
    }),
  ).current.breakdowns;
  expect(diplomat['skill.dip'].total).toBe(2);
  const treatment = calculateCharacterSheetProjections(
    withScores(reviewedTraitSheet('Precise Treatment'), { int: 14, wis: 8 }),
  ).current.breakdowns;
  expect(treatment['skill.hea'].total).toBe(3);
  // Shared Situations only where the body's condition matches exactly.
  for (const [name, key, target, value] of [
    ["Gifted Satirist (Hell's Rebels)", 'fear', 'save.will', 2],
    ['Sound of Mind (Zi Ha)', 'mindAffecting', 'save.fort', 2],
    ["Magic's Might (Yuelral)", 'spellResistance', 'casterLevel', 1],
    ['Dwarf-Trained (Giantslayer)', 'giants', 'ac.other', 2],
  ] as const)
    expect(
      resolveSheet(modifiers(name), { situations: [key] })[target].total,
      name,
    ).toBe(value);
  for (const [name, key] of [
    ['Weed Resistance (Kyonin)', 'poison'],
    ['Iron Lungs (Darklands)', 'poison'],
    ['Darkest Before Dawn', 'fear'],
    ['Insular (Elf)', 'fear'],
    ["Lamia's Bane", 'enchantment'],
    ['Savage Breaker (Varisia; Korvosa)', 'sunder'],
    ['Splash Attack', 'dirtyTrick'],
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
  // Foundry files these notes on other statistics; the reviewed Modifiers
  // land where the body puts them.
  for (const [name, targets] of [
    ['Andoren Freedom Fighter (Andoran)', ['attack', 'damage']],
    ['Ozem-Inspired', ['attack', 'damage']],
    ['Shiv (Sczarni Faction)', ['damage']],
    ['Against the Technic League (Iron Gods)', ['damage', 'spellDC']],
    ['Starlit Hexer (any Outer God)', ['spellDC']],
    ['Reckless Luck (Chaldira Zuzaristan)', ['ac']],
  ] as const)
    expect(
      modifiers(name).map((row) => row.target),
      name,
    ).toEqual(targets);
  expect(modifiers('Chelish Guerrilla (Cheliax)')[0]?.target).toBe('damage');
  // Shiv's +1 is on all damage, so a thrown one-handed piercing weapon (a
  // javelin) in a surprise round gets it, and only under its Situation.
  const shiv = 'Shiv (Sczarni Faction)';
  const thrown: CharacterSheetInput = {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: {
          kind: 'base',
          proficiencies: { added: [{ category: 'simple' }], removed: [] },
        },
      },
      {
        _id: 'javelin-row',
        kind: 'item',
        active: true,
        catalogEntryId: 'javelin',
        state: { kind: 'item' },
      },
      {
        _id: 'routine',
        kind: 'attackRoutine',
        active: true,
        state: {
          kind: 'attackRoutine',
          name: 'Javelin',
          weaponEntryId: 'javelin-row',
          hands: 'one',
          mode: 'thrown',
        },
      },
      {
        _id: 'shiv-row',
        kind: 'trait',
        active: true,
        catalogEntryId: 'shiv',
        state: { kind: 'trait' },
      },
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: Object.values(abilityTargets).map((target) => ({
          target,
          bonusType: 'base' as const,
          value: 10,
        })),
      },
      {
        _id: 'javelin',
        name: 'Javelin',
        ruleIdentity: 'javelin',
        modifiers: [],
        detail: {
          kind: 'item',
          weapon: {
            baseType: 'javelin',
            proficiency: 'simple',
            handedness: 'oneHanded',
            attackType: 'ranged',
            thrown: true,
            thrownRangeIncrement: 30,
            dice: '1d6',
            damageTypes: ['piercing'],
            threat: 20,
            mult: 2,
            strengthDamage: 'thrown',
          },
        },
      },
      {
        _id: 'shiv',
        ruleIdentity: entry(shiv).externalKey,
        modifiers: modifiers(shiv).map(
          ({ target, bonusType, value, condition }) => ({
            target,
            bonusType,
            value,
            condition,
          }),
        ),
      },
    ],
  };
  const surprise = situation(shiv, 0, 'shiv-row');
  const routine = (situations: (typeof surprise)[]) =>
    calculateCharacterSheet(thrown, { situations }).attackRoutines[0];
  expect(routine([])?.single[0]?.damageBonus.total).toBe(0);
  expect(routine([surprise])?.single[0]?.damageBonus.total).toBe(1);
  // Untyped bonuses and penalties stay untyped, as published; Huldra's Luck
  // is a luck bonus and Dwarf-Trained's AC bonus a dodge bonus.
  for (const name of [
    'Sneaky Swimmer (Kobold)',
    'Proud Tribesman (Human; Mwangi)',
    'Diabolist Raised (Council of Thieves)',
    'Mark of Slavery',
    'Inspired by Greatness (Carrion Crown)',
  ])
    expect(new Set(modifiers(name).map((row) => row.bonusType)), name).toEqual(
      new Set(['untyped']),
    );
  expect(
    new Set(
      modifiers("Huldra's Luck (Lands of the Linnorm Kings)").map(
        (row) => row.bonusType,
      ),
    ),
  ).toEqual(new Set(['luck']));
  expect(
    modifiers('Dwarf-Trained (Giantslayer)').map((row) => row.bonusType),
  ).toEqual(['dodge', 'trait']);
  // Mark of Slavery's -2 penalties wait for their Situation.
  const mark = 'Mark of Slavery';
  expect(resolveSheet(modifiers(mark))['skill.blf'].total).toBe(0);
  expect(
    resolveSheet(modifiers(mark), {
      situations: [situation(mark, indexOf(mark, 'skills', 'retrying'))],
    })['skill.blf'].total,
  ).toBe(-2);
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
    // Urban Sleuth keeps one roll-twice note twice; one record covers both.
    expect(
      [...new Set(notes.map((note) => note.target))].sort(),
      row.name,
    ).toEqual(
      [...new Set((contextNotes ?? []).map((note) => note.target))].sort(),
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
  expect(required).toBe(119);
  // Reckless Luck's attack and initiative notes repeat its AC bonus; they are
  // the explicit covered/no-output records.
  expect(
    heldTraits.flatMap((row) =>
      row.mechanicsReview.curationRecords
        .filter((record) => !record.outputs.length)
        .map((record) => `${row.name} ${record.target}`),
    ),
  ).toEqual([
    'Reckless Luck (Chaldira Zuzaristan) attack',
    'Reckless Luck (Chaldira Zuzaristan) init',
  ]);
  // Notes the drafter put on unrelated statistics are entry-level.
  for (const name of [
    'Sneaky Swimmer (Kobold)',
    'Iron Lungs (Darklands)',
    'Thrill Seeker (Rise of the Runelords)',
    'Water-Touched',
    'Beastspeaker (The Concordance)',
    'Priest-Blessed',
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
      .map((row) => row.name)
      .sort(),
  ).toEqual(['Empathic Diplomat (Qadira, Osirion)', 'Isgeri Orphan (Isger)']);
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
      `traits-374-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `traits-374-notice-${book}-complete-chain`),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    heldTraits
      .filter((row) => row.traitType === 'drawback')
      .map((row) => row.name)
      .sort(),
  ).toEqual(['Helpless', 'Mark of Slavery']);
  // Inherited rules the bodies change or depend on.
  for (const [name, book] of [
    ['Savage Breaker (Varisia; Korvosa)', 'PZO1118'],
    ['Ritualistic (Strange Aeons)', 'PZO1132'],
    ['Earthsense (Oread)', 'PZO1112'],
    ['Among Humans (Kitsune)', 'PZO9280'],
    ['Thrill Seeker (Rise of the Runelords)', 'PZO1123'],
    ['Thrill Seeker (Rise of the Runelords)', 'PZO9410'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Class features name the pinned class record's literal line.
  expect(
    candidate('Merabian Mentorship (Thuvia; Suli)').inheritedRuleNotices.some(
      (notice) =>
        notice.location.endsWith('alchemist.JcaqlAawhf14q1lq.yaml#L98'),
    ),
  ).toBe(true);
  // Unchained action-cost metadata anywhere in the bound closure, the
  // trait's own actions included, requires the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedLinked])].sort();
  expect(unchained).toHaveLength(12);
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
      'traits-374-notice-PZO1131-complete-chain',
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
    ['Insular (Elf)', 'PZO9428'],
    ['Freedom Fighter (Halfling)', 'PZO9421'],
    ['Freedom Fighter (Halfling)', 'PZO9422'],
    ["Inquisitive Archaeologist (Mummy's Mask)", 'PZO9441'],
    ['Brastlewark Businessman (Gnome)', 'PZO9407'],
    ['Against the Technic League (Iron Gods)', 'PZO9448'],
  ] as const)
    expect(candidate(name).requiredNotices, name).not.toContain(book);
  expect(
    heldTraits
      .flatMap((row) => row.linkedContentReview.map((linked) => linked.name))
      .sort(),
  ).toEqual(['Firework (star candle)', "Tremorsense 30'"]);
  // The tremorsense buff cites no source; the universal monster rule
  // supplies the book.
  expect(
    candidate('Earthsense (Oread)').linkedContentReview[0]?.sources,
  ).toEqual([]);
  expect(preview.closure.map((row) => row.externalKey).sort()).toEqual([
    'pf1-content/WVs1d1l2G45GRlQc',
    'pf1-content/iOndtehj1BpQmXjN',
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
  // Descriptors no permitted evidence sources stay named unresolved origins.
  expect(
    candidate('Starlit Hexer (any Outer God)').inheritedRuleUnresolvedOrigins,
  ).toEqual([
    expect.stringContaining('no PCGen row at the pin'),
    expect.stringContaining('curse descriptor'),
  ]);
  expect(
    candidate('Darkest Before Dawn').inheritedRuleUnresolvedOrigins,
  ).toEqual([
    expect.stringContaining('emotion descriptor'),
    expect.stringContaining('pain descriptor'),
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
      batch: 'traits-374',
      candidate: candidate(name),
    });
  // The exclusion remains unresolved as a whole. The original regional and
  // ancestry findings remain recorded beside the current parser output.
  for (const [name, mapped] of [
    ['Dwarf-Trained (Giantslayer)', ['unchecked']],
    ['Iron Lungs (Darklands)', ['unchecked', 'unchecked']],
    ['Stream Nomad (Darklands)', ['unchecked', 'unchecked']],
    ['Merabian Mentorship (Thuvia; Suli)', ['unchecked']],
    ["Adventurous Explorer (Halfling; Song'o)", ['unchecked']],
  ] as const) {
    expect(kinds(name), name).toEqual(mapped);
    expect(facts(name), name).toEqual(
      expect.arrayContaining([expect.stringContaining('#739')]),
    );
  }
  expect(entry('Dwarf-Trained (Giantslayer)').prerequisites).toEqual([
    {
      kind: 'unchecked',
      unchecked: 'Cannot be a dwarf or gnome',
    },
  ]);
  for (const [name, gap] of [
    ['Tomb Raider (Scarab Sages)', 'no faction fact exists'],
    ['Slaver (Human; Ombo)', 'no heritage or ethnicity fact exists'],
    ['Relentless Duty (Kols)', 'no deity fact exists'],
    ['Isgeri Orphan (Isger)', 'no region fact exists'],
    ['Keleshite Trade Camel (Camel)', 'no mount or animal-kind fact exists'],
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
    held: 98,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 2,
    recordLevel35Holds: 0,
  });
  // The Religion and Race folders are pack organization, excluded by the
  // importer's folder contract.
  expect(folders).toEqual([
    expect.objectContaining({
      externalKey: 'pf1-content/MB4DGP9uns7VLmaa',
      name: 'Religion',
      rawKey: '!folders!MB4DGP9uns7VLmaa',
    }),
    expect.objectContaining({
      externalKey: 'pf1-content/OJcM9ZeR3TB33I5m',
      name: 'Race',
      rawKey: '!folders!OJcM9ZeR3TB33I5m',
    }),
  ]);
  expect(preview.entries).toHaveLength(98);
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
  // Isgeri Orphan's body equals its Inner Sea Primer row's benefit.
  expect(candidate('Isgeri Orphan (Isger)').comparison?.literalRow).toContain(
    'BONUS:SAVE|Fortitude|TYPE=Trait',
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
      required: 119,
      checked: 119,
      missing: 0,
      descriptions: { candidates: 98, checked: 98 },
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
    const orphan = candidate('Isgeri Orphan (Isger)');
    expect(orphan.requiredNotices).toEqual(['PZO9414', 'PZO1115', 'PZO1110']);
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
