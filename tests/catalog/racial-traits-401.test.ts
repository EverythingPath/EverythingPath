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
  modifierTargets,
  resolveSheet,
  calculateCharacterSheetProjections,
} from '../../src/lib/character-sheet';
import {
  evaluateFormula,
  parseFormula,
} from '../../src/lib/character-sheet-formulas';
import {
  review,
  assessedTraits,
  admittedTraits,
  excludedRows,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/racial-traits-401/data';
import {
  racialTraitSheet,
  sheetDefinition,
} from '../fixtures/racial-traits-401/sheet';
import { raceAbilityTraitKey } from '../../scripts/catalog/racial-trait-rules';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const PLACEHOLDER =
  'Review required: replace this placeholder with readable rules text or structured outputs.';
const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
// Standard traits whose Modifiers are race outputs the full import relocates
// or re-homes onto them (#719); a bounded import without the race lacks them.
const RELOCATED_FROM_RACE: string[] = [];
// Records that fail admission on a reference gap in any preview: Dusksight
// (Half-Orc) links Low-Light Vision, a record of the excluded ARG Race Builder
// subtree (reported as its own gap, as #400's Deep Delver).
const UNRESOLVED_LINK_GAP = ['pf1-content/lNkG5OnOXSt64aEY'];
// Skill Training (Green Martian) is held on the source-matched Dynamite comics
// hold (known-notice-holds.json), as #388 Fearless and #399 Detect Thoughts.
const DYNAMITE = 'pf1-content/lvV61h2tNXC2KqQF';
const BLOG = 'Paizo Blog: The Gauntlet Will Be Ours!';
function entry(name: string) {
  const row = preview.entries.find(
    (row) => row.externalKey === name || row.name === name,
  );
  if (!row) throw new Error(`Missing ${name}`);
  if (row.detail.kind !== 'racialTrait') throw new Error('Expected trait');
  return { ...row, detail: row.detail };
}
function candidate(name: string) {
  const row = assessedTraits.find(
    (row) => row.externalKey === name || row.name === name,
  );
  if (!row) throw new Error(`Missing review of ${name}`);
  return row;
}
function modifiers(name: string) {
  const row = entry(name);
  return row.modifiers.map((raw) => ({
    ...outputSchema.options[0]
      .omit({ kind: true })
      .extend({ target: z.enum(modifierTargets) })
      .parse(raw),
    sheetEntryId: row.externalKey,
    catalogEntryId: row.externalKey,
    source: row.externalKey,
    entryName: row.name,
    builtIn: false,
  }));
}
// The Situation of one Modifier, selected on its own entry.
function situation(name: string, index: number) {
  const scope = modifiers(name)[index]?.condition?.situation;
  if (!scope) throw new Error(`Modifier ${index} of ${name} has no Situation`);
  if (typeof scope === 'string') return scope;
  if (!('local' in scope)) throw new Error('Expected a local Situation');
  return { local: scope.local, sheetEntryId: entry(name).externalKey };
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
// One resolved statistic of one entry's Modifiers, with Situations selected.
function resolved(name: string, target: string, selected: number[] = []) {
  return resolveSheet(modifiers(name), {
    situations: selected.map((index) => situation(name, index)),
  })[target as 'skill.per'].total;
}
const total = (sheet: ReturnType<typeof racialTraitSheet>, target: string) =>
  calculateCharacterSheetProjections(sheet).current.breakdowns[
    target as 'ability.str'
  ].total;

/** A test-only race: the pinned race identity granting the listed traits. */
function identityRace(
  sheet: ReturnType<typeof racialTraitSheet>,
  raceKey: string,
  traits: string[],
) {
  return {
    ...sheet,
    entries: [
      ...sheet.entries,
      {
        _id: 'race-row',
        kind: 'race' as const,
        active: true,
        catalogEntryId: raceKey,
        state: { kind: 'race' as const },
      },
    ],
    catalogEntries: [
      ...sheet.catalogEntries,
      {
        _id: raceKey,
        name: 'Race (identity only)',
        ruleIdentity: raceKey,
        modifiers: [],
        detail: { kind: 'race' as const, racialTraits: traits },
      },
      ...traits.map(sheetDefinition),
    ],
  };
}

// Every record whose bound content closure keeps Unchained action-cost
// metadata (owner ruling, 2026-10-17): on its own action, through a bound
// body (a replaced trait, a linked spell or a body reached through its race),
// or both.
const unchainedOwn = [
  'pf1-content/l2VaAn7tTKcac2xZ', // Urban Memories
  'pf1-content/ljJ0jMjxTVcfOiJ3', // Tangling Tentacles
  'pf1-content/lnahx05blmymRHUA', // Stalker
  'pf1-content/lqFhyqE7frSbHfEA', // Magical Linguist (Gnome)
  'pf1-content/m6anXBE7DQrCaNPS', // Change Shape (Skinwalker - Ragebred)
  'pf1-content/mIoJHEWhujpANeaM', // Luckbringer
  'pf1-content/mLxAldGcZ0UnEfd7', // Change Shape (Skinwalker)
  'pf1-content/myff7Z3hssdT7leV', // Blank Slate
  'pf1-content/n2lCTokOhbEJ35Nu', // Oppressive
  'pf1-content/n98kLjKTeMEM5rdx', // Spell-Like Ability (Tiefling - the Motherless)
  'pf1-content/nBNMonZzsoPLtAKL', // Change Shape (Kitsune)
  'pf1-content/noLFpNL6xVCMBkRp', // Heart of the Fields
  'pf1-content/o0ooSUUjwVjL79XE', // Fecund Earth
];
const unchainedBound = [
  'pf1-content/l2VaAn7tTKcac2xZ', // Urban Memories
  'pf1-content/lf3okrZiPzE3W4zj', // Crusading Magic
  'pf1-content/lhZkqVMbX0RfVTj0', // Jungle Stalker
  'pf1-content/lk84xweDXJrZvoq4', // Curosity
  'pf1-content/lqFhyqE7frSbHfEA', // Magical Linguist (Gnome)
  'pf1-content/lwZTXQ8zz2awYQh9', // Pain Tolerance
  'pf1-content/m6anXBE7DQrCaNPS', // Change Shape (Skinwalker - Ragebred)
  'pf1-content/mBfn8hCLwEsAxlnl', // Werebat-Kin (Bloodmarked)
  'pf1-content/mH8xEPH9wXFCmIgM', // Beastmaster
  'pf1-content/mNPzfPRAdgvumhww', // Wererat-Kin (Nightskulk)
  'pf1-content/n8T5HDk4GBP7dsjx', // Darklands Stalker
  'pf1-content/n98kLjKTeMEM5rdx', // Spell-Like Ability (Tiefling - the Motherless)
  'pf1-content/nBNMonZzsoPLtAKL', // Change Shape (Kitsune)
  'pf1-content/nPKsivL973H9L7y7', // Agathion-Blooded (Idyllkin)
  'pf1-content/nPnz19oJfnZKSFdI', // Lava Gnomes
  'pf1-content/nWMwiyydGWx5S05m', // Bestial
  'pf1-content/nmthVcIFBg9PNqhb', // Hatred (Half-Orc)
  'pf1-content/nopyUgzhxcD4G8uD', // Weretiger-Kin (Fanglord)
  'pf1-content/o0ooSUUjwVjL79XE', // Fecund Earth
  'pf1-content/o4qjsfHulsHFsLI1', // Projection
  'pf1-content/o8YypRycSCackHdm', // Plagueborn
  'pf1-content/o9IVTGXGOqHixS7z', // Brazen Flame
];

it('resolves the reviewed racial trait Modifiers through the public resolver', () => {
  // The four curated heritage lines replace their race's ability score trait:
  // the race's line goes dormant and the heritage line applies.
  for (const [name, race, lines] of [
    [
      'Werebat-Kin (Bloodmarked)',
      'pf1/apWl6JIJ8U8p0azq', // Skinwalker: +2 Wis, -2 Int
      [
        ['ability.int', 8, 12],
        ['ability.wis', 12, 8],
        ['ability.dex', 10, 10],
      ],
    ],
    [
      'Wererat-Kin (Nightskulk)',
      'pf1/apWl6JIJ8U8p0azq',
      [
        ['ability.int', 8, 12],
        ['ability.str', 10, 8],
        ['ability.wis', 12, 10],
      ],
    ],
    [
      'Weretiger-Kin (Fanglord)',
      'pf1/apWl6JIJ8U8p0azq',
      [
        ['ability.dex', 10, 12],
        ['ability.wis', 12, 8],
        ['ability.int', 8, 10],
      ],
    ],
    [
      'Agathion-Blooded (Idyllkin)',
      'pf1/FHY3oIk5zSOFncJH', // Aasimar: +2 Wis, +2 Cha
      [
        ['ability.con', 10, 12],
        ['ability.cha', 12, 12],
        ['ability.wis', 12, 10],
      ],
    ],
  ] as const) {
    const heritage = entry(name);
    expect(heritage.detail.raceKeys).toEqual([race]);
    const ability = raceAbilityTraitKey(race);
    expect(heritage.detail.replaces, name).toEqual([ability]);
    expect(heritage.detail.unresolvedReplacements ?? [], name).toEqual([]);
    const plain = identityRace(racialTraitSheet({}), race, [ability]);
    const taken = identityRace(
      racialTraitSheet({ traits: [heritage.externalKey] }),
      race,
      [ability],
    );
    for (const [target, before, after] of lines) {
      expect(total(plain, target), `${name} race ${target}`).toBe(before);
      expect(total(taken, target), `${name} ${target}`).toBe(after);
    }
  }
  expect(
    modifiers('Werebat-Kin (Bloodmarked)').map((row) => [
      row.target,
      row.bonusType,
      row.value,
    ]),
  ).toEqual([
    ['ability.int', 'racial', 2],
    ['ability.wis', 'racial', -2],
  ]);
  // Situational bonuses apply only when their Situation is selected.
  for (const [name, target, base, label, value] of [
    ['Darklands Guide (Half-Elf)', 'save.ref', 'saves', 'traps and hazards', 2],
    ['Thinblood Resistance', 'save.fort', 'save.fort', 'disease', 2],
    ['Skulker', 'attack.melee', 'attack', 'Dexterity bonus', 1],
    ['Child of the Sea', 'skill.pro', 'skill.pro', 'sea vessel', 4],
    ['Stalker', 'skill.per', 'skill.per', 'observed', 1],
    ['Stalker', 'skill.kre', 'skill.kre', 'observed', 1],
    ['Stalker', 'attack.melee', 'attack', 'observed', 1],
    ['Magical Linguist (Gnome)', 'save.will', 'saves', 'language-dependent', 2],
    ['Pain Tolerance', 'save.will', 'saves', 'pain descriptor', 2],
    ['Unflinching Valor (Frostkin)', 'cmd', 'cmd', 'grappled', 1],
    ['Elf-Scorned', 'ac.other', 'ac', 'elves', 2],
    ['Elf-Scorned', 'attack.ranged', 'attack', 'elves', 1],
    ['Hatred (Half-Orc)', 'attack.melee', 'attack', 'dwarf, elf and human', 1],
    ['Wyrmscourged', 'ac.other', 'ac', 'against dragons', 2],
    ['Wyrmscourged', 'attack.melee', 'attack', 'against dragons', 1],
    ['Wyrmscourged', 'save.ref', 'saves', 'abilities of dragons', 2],
    ['Wyrmscourged', 'skill.kar', 'skill.kar', 'identify dragons', 2],
    ['Plagueborn', 'save.fort', 'saves', 'ingested poisons', 2],
    ['Squalid', 'save.fort', 'saves', 'sickened', 2],
    ['Oppressive', 'skill.int', 'skill.int', 'Oppressive', 4],
    [
      'Alternate Skill Modifiers (Skinwalker - Bloodmarked)',
      'skill.per',
      'skill.per',
      'at night',
      2,
    ],
    [
      'Change Shape (Skinwalker)',
      'ability.str',
      'ability.str',
      'Strength choice',
      2,
    ],
    [
      'Change Shape (Skinwalker)',
      'ac.natural',
      'ac.natural',
      'natural armor',
      1,
    ],
    [
      'Change Shape (Skinwalker - Ragebred)',
      'ability.con',
      'ability.con',
      'bestial form',
      2,
    ],
  ] as const) {
    const index = indexOf(name, base, label);
    expect(resolved(name, target), `${name} ${target}`).toBe(0);
    expect(resolved(name, target, [index]), `${name} ${target}`).toBe(value);
  }
  // Shared Situations only where the body's condition matches exactly.
  for (const [name, shared, target, value] of [
    ['Thinblood Resistance', 'poison', 'save.fort', 2],
    ['Venomkissed', 'poison', 'save.ref', 2],
    ['Unflinching Valor (Frostkin)', 'fear', 'save.will', 2],
  ] as const) {
    const index = modifiers(name).findIndex(
      (row) => row.condition?.situation === shared,
    );
    expect(index, `${name} ${shared}`).toBeGreaterThanOrEqual(0);
    expect(resolved(name, target), name).toBe(0);
    expect(resolved(name, target, [index]), name).toBe(value);
  }
  expect(
    modifiers('Crusading Magic').find((row) => row.target === 'casterLevel')
      ?.condition,
  ).toEqual({ situation: 'spellResistance' });
  // The published types: Darklands Guide's, Stalker's and Wyrmscourged's
  // attack bonuses are untyped; Elf-Scorned's and Wyrmscourged's AC bonuses
  // are dodge.
  for (const [name, target, type] of [
    ['Darklands Guide (Half-Elf)', 'saves', 'untyped'],
    ['Darklands Guide (Half-Elf)', 'init', 'untyped'],
    ['Stalker', 'skill.per', 'untyped'],
    ['Stalker', 'damage', 'untyped'],
    ['Wyrmscourged', 'attack', 'untyped'],
    ['Wyrmscourged', 'ac', 'dodge'],
    ['Wyrmscourged', 'saves', 'dodge'],
    ['Elf-Scorned', 'ac', 'dodge'],
    ['Elf-Scorned', 'attack', 'racial'],
    ['Change Shape (Skinwalker)', 'ac.natural', 'naturalArmor'],
    ['Child of the Sea', 'skill.pro', 'racial'],
  ] as const)
    expect(
      modifiers(name).find((row) => row.target === target)?.bonusType,
      `${name} ${target}`,
    ).toBe(type);
  // Darklands Guide's initiative bonus applies always.
  expect(resolved('Darklands Guide (Half-Elf)', 'init')).toBe(2);
  // Heart of the Wilderness: the reviewed change replacement halves
  // Foundry's full Hit Dice to the published half character level (+3 at 7th
  // level).
  const [survival, ...rest] = modifiers('Heart of the Wilderness');
  expect(rest).toEqual([]);
  expect(survival).toMatchObject({
    target: 'skill.sur',
    bonusType: 'racial',
    value: { formula: 'floor(@hitDice / 2)' },
  });
  if (!survival || typeof survival.value === 'number')
    throw new Error('Expected formula');
  expect(
    evaluateFormula(parseFormula(survival.value.formula), (name) =>
      name === '@hitDice' ? 7 : 0,
    ),
  ).toBe(3);
  // Racial bonuses from distinct Sources stack (PRD; character-sheet.ts):
  // Jungle Stalker's and Plumekith's +2 racial Acrobatics give +4 together.
  const acrobatics = [
    ...modifiers('Jungle Stalker'),
    ...modifiers('Skilled (Aasimar - Plumekith)'),
  ].filter((row) => row.target === 'skill.acr');
  expect(resolveSheet(acrobatics, { situations: [] })['skill.acr'].total).toBe(
    4,
  );
  // Imported changes keep mapping; nothing is curated twice.
  for (const [name, target, value] of [
    ['Urban Memories', 'skill.klo', 2],
    ['Crusading Magic', 'skill.kpl', 2],
    ['Jungle Stalker', 'skill.acr', 2],
    ['Curosity', 'skill.dip', 2],
    ['Curosity', 'skill.lin', 2],
    ['Princely', 'skill.dip', 2],
    ['Princely', 'skill.int', 2],
    ['Shamanic Enhancement', 'skill.spl', 2],
    ['Bestial', 'skill.per', 2],
    ['Child of the Sea', 'skill.swm', 4],
    ['Alternate Skill Modifiers (Dhampir - Ru-Shi)', 'skill.acr', 2],
    ['Alternate Skill Modifiers (Dhampir - Ru-Shi)', 'skill.ken', 2],
    ['Alternate Skill Modifiers (Skinwalker - Bloodmarked)', 'skill.fly', 2],
    ['Skilled (Tiefling - Hellspawn)', 'skill.dip', 2],
    ['Skilled (Tiefling - Hellspawn)', 'skill.sen', 2],
    ['Skilled (Tiefling - Grimspawn)', 'skill.dev', 2],
    ['Skilled (Tiefling - Grimspawn)', 'skill.slt', 2],
    ['Skilled (Aasimar - Plumekith)', 'skill.fly', 2],
    ['Ability Modifiers (Changeling - Veil May)', 'ability.wis', 2],
    ['Ability Modifiers (Changeling - Veil May)', 'ability.int', -2],
  ] as const)
    expect(resolved(name, target), `${name} ${target}`).toBe(value);
  // Beastmaster's imported racial change is replaced by 0 (reviewed change
  // replacement); the description record supplies the untyped +2 of the
  // pinned (APG) body (fix round 1, as for Gift of Tongues).
  expect(
    modifiers('Beastmaster').map((row) => [
      row.target,
      row.bonusType,
      row.value,
    ]),
  ).toEqual([
    ['skill.han', 'racial', 0],
    ['skill.han', 'untyped', 2],
  ]);
  expect(resolved('Beastmaster', 'skill.han')).toBe(2);
  // Latent race overlaps: the Kitsune's and the Grindylow's checked #328
  // description records already carry these traits' bonuses; the traits add
  // none.
  for (const name of ['Change Shape (Kitsune)', 'Tangling Tentacles'])
    expect(entry(name).modifiers, name).toEqual([]);
  // Types, languages, senses, speeds, spell-like abilities, racial subtypes,
  // choices and rules the sheet cannot model stay without reviewed Modifiers.
  for (const name of [
    'Orc',
    'Darkvision (Orc)',
    'Languages (Orc)',
    'Darkvision (Shabti)',
    'Darkvision (Goblin)',
    'Darkvision (Strix)',
    'Darkvision (Oread)',
    'Languages (Vishkanya)',
    'Languages (Skinwalker)',
    'Low-Light Vision (Locathah)',
    'Low-Light Vision (Wyrwood)',
    'Normal Speed (Gathlain)',
    'Weapon Familiarity (Gnome)',
    'Weapon Familiarity (Vishkanya)',
    'Monstrous Humanoid (Cecaelia)',
    'Mostly Human (Ifrit)',
    'Skill Training',
    'Frightened by Magic',
    'Skilled (Aphorite)',
    'Planar Envoy',
    'Hag Racial Trait (Changeling - Dead Eyes)',
    'Dusksight (Half-Orc)',
    'Luckbringer',
    'Air Insight',
    'Blank Slate',
    'Brazen Flame',
    'Crossbow Training',
    'Darklands Stalker',
    'Fecund Earth',
    'Heart of the Fields',
    'Spell-Like Ability (Tiefling - the Motherless)',
    'Lava Gnomes',
    'Tower Elf',
  ])
    expect(entry(name).modifiers, name).toEqual([]);
  // No armor, shield or natural armor bonus sits on ac.other.
  for (const row of preview.entries)
    for (const modifier of row.modifiers)
      if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
        expect(modifier.target, row.name).not.toBe('ac.other');
});

it('checks every required note record and the separate description pass against the pinned bodies', () => {
  // Foundry notes whose rule the description record's Note states:
  // explicit covered/no-output records.
  const covered: [string, string][] = [['Change Shape (Kitsune)', 'skill.dis']];
  let required = 0;
  let coveredCount = 0;
  for (const row of assessedTraits) {
    const [description, ...notes] = row.mechanicsReview.curationRecords;
    required += notes.length;
    for (const record of row.mechanicsReview.curationRecords) {
      expect(record.status, row.name).toBe('checked');
      expect(record.diagnostics, row.name).toEqual([]);
      expect(JSON.stringify(record.outputs), row.name).not.toContain(
        PLACEHOLDER,
      );
      const key = `${row.name} ${record.target}`;
      if (
        covered.some(
          ([name, target]) => name === row.name && target === record.target,
        )
      ) {
        coveredCount += 1;
        expect(record.outputs, key).toEqual([]);
        expect(record.rationale, key).toContain('Explicit covered/no-output');
      } else expect(record.outputs.length, key).toBeGreaterThan(0);
    }
    expect(description).toMatchObject({
      kind: 'description',
      text: row.mechanicsReview.descriptionText,
    });
    const parts = description!.outputs.flatMap((output) =>
      output.kind === 'note' ? [output.text] : [],
    );
    expect(parts, row.name).toHaveLength(1);
    for (const part of parts) {
      expect(part.length, row.name).toBeLessThanOrEqual(4096);
      for (const markup of [
        '@UUID',
        '@Distance',
        '@Toggle',
        '@Condition',
        '[[',
      ])
        expect(part, row.name).not.toContain(markup);
    }
    const texts = (entry(row.externalKey).situationalNotes ?? []).map(
      (note) => note.text,
    );
    for (const part of parts) expect(texts, row.name).toContain(part);
  }
  expect(coveredCount).toBe(covered.length);
  expect(required).toBe(53);
  // Notes the Foundry data put on unrelated statistics are entry-level.
  for (const name of [
    'Air Insight',
    'Jungle Stalker',
    'Darklands Stalker',
    'Pain Tolerance',
    'Heart of the Wilderness',
  ])
    expect(
      entry(name)
        .situationalNotes?.filter((note) => note.target)
        .map((note) => note.target),
      name,
    ).toEqual([]);
  for (const [name, targets] of [
    ['Child of the Sea', ['skill.sur']],
    ['Wyrmscourged', ['skill.kar']],
    ['Dusksight (Half-Orc)', ['attack.ranged']],
    ['Crossbow Training', ['attack.ranged']],
    ['Planar Envoy', ['skill.lin']],
    ['Brazen Flame', ['damage.melee']],
    ['Hag Racial Trait (Changeling - Dead Eyes)', ['saves']],
    ['Jumper', ['skill.acr']],
    ['Blank Slate', ['skills']],
  ] as const)
    expect(
      entry(name)
        .situationalNotes?.filter((note) => note.target)
        .map((note) => note.target)
        .sort(),
      name,
    ).toEqual(targets);
  // The Notes read Foundry enrichers as text.
  expect(
    (entry('Change Shape (Skinwalker - Ragebred)').situationalNotes ?? [])
      .map((note) => note.text)
      .join(' '),
  ).toContain('+10-foot racial bonus to base speed');
  expect(
    (entry('Werebat-Kin (Bloodmarked)').situationalNotes ?? [])
      .map((note) => note.text)
      .join(' '),
  ).toContain('Scent to a range of 30 feet');
  // Every record lists its outstanding calculations, never as a hold.
  for (const row of assessedTraits) {
    expect(
      row.mechanicsReview.outstandingCalculations.length,
      row.name,
    ).toBeGreaterThan(0);
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  }
  // Beastmaster's type fix follows the pinned (APG) text.
  expect(
    candidate('Beastmaster').mechanicsReview.sourceDiscrepancies.join(' '),
  ).toContain('reviewed change replacement');
  for (const name of ['Heart of the Fields', 'Skilled (Aphorite)'])
    expect(
      candidate(name).mechanicsReview.outstandingCalculations.join(' '),
      name,
    ).toMatch(/outstanding/i);
  expect(
    candidate(
      'Heart of the Wilderness',
    ).mechanicsReview.outstandingCalculations.join(' '),
  ).toContain('reviewed-change-replacements.ts');
  // Only Weapon Familiarity (Vishkanya) maps weapon proficiencies.
  for (const row of assessedTraits) {
    const grants =
      row.name === 'Weapon Familiarity (Vishkanya)'
        ? ['Blowgun', 'Kukri', 'Shuriken']
        : [];
    expect(row.mechanicsReview.proficiencyReview.grants, row.name).toEqual(
      grants,
    );
    expect((entry(row.externalKey).proficiencies ?? []).length, row.name).toBe(
      grants.length,
    );
  }
});

it('records the race, alternate-trait, monster-ability and Unchained notice dependencies and enforces every hold', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  const holdId = (book: string) =>
    book === BLOG
      ? 'racial-traits-401-notice-primitive-human-blog-complete-chain'
      : `racial-traits-401-notice-${book}-complete-chain`;
  for (const row of assessedTraits) {
    expect(row.requiredNotices.at(-1), row.name).toBe('PZO1110');
    for (const cited of row.citedSources)
      expect(row.requiredNotices, row.name).toContain(cited.book);
    for (const linked of row.linkedContentReview)
      for (const book of linked.sources)
        expect(row.requiredNotices, row.name).toContain(book.id);
    // The race record's books (Race abilities).
    const races = row.inheritedRuleNotices.filter((notice) =>
      notice.location.includes('/packs/races/'),
    );
    expect(races.length, row.name).toBeGreaterThan(0);
    for (const notice of races)
      expect(row.requiredNotices, row.name).toContain(notice.book);
    // Every alternate records the APG exchange framework.
    const framework = row.inheritedRuleComparisonEvidence.find(
      (comparison) => comparison.line === 86,
    );
    if (row.racialTraitKind === 'alt') {
      expect(row.requiredNotices, row.name).toContain('PZO1115');
      expect(framework?.literalRow, row.name).toContain(
        'This racial trait replaces the intimidating racial trait',
      );
    } else expect(framework, row.name).toBeUndefined();
    if (row.disposition === 'admitted') {
      // #328 S4-B: the launch comparison supersedes the whole-content
      // hold, and the notice chains are reviewed (PZO1110), cleared
      // (PZO1121) or confirmed (PZO9280), so the row records no hold.
      expect(row.holdIds, row.name).toEqual([]);
      expect(row.noticeHoldIds, row.name).toEqual([]);
      continue;
    }
    expect(row.holdIds, row.name).toEqual([
      `racial-traits-401-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    assessedTraits.filter((row) => row.racialTraitKind === 'alt'),
  ).toHaveLength(38);
  // Universal monster rules the bodies grant or name take the earliest book
  // their pinned Universal Monster Rules journal page lists.
  for (const [name, book, page] of [
    ['Darkvision (Shabti)', 'PZO1127', 'Darkvision'],
    ['Darkvision (Orc)', 'PZO1127', 'Darkvision'],
    ['Change Shape (Skinwalker)', 'PZO1127', 'Darkvision'],
    ['Change Shape (Skinwalker)', 'PZO1112', 'Natural Attacks'],
    ['Low-Light Vision (Locathah)', 'PZO1112', 'Low-Light Vision'],
    ['Dusksight (Half-Orc)', 'PZO1112', 'Low-Light Vision'],
    ['Werebat-Kin (Bloodmarked)', 'PZO1112', 'Scent'],
    ['Change Shape (Skinwalker - Ragebred)', 'PZO1112', 'Scent'],
    ['Weretiger-Kin (Fanglord)', 'PZO1116', 'See in Darkness'],
    ['Pain Tolerance', 'PZO1112', 'Damage Reduction'],
    ['Hag Racial Trait (Changeling - Dead Eyes)', 'PZO1112', 'Gaze'],
  ] as const)
    expect(
      candidate(name).inheritedRuleNotices.some(
        (notice) =>
          notice.book === book &&
          notice.location.includes('universal-monster-rules-umr') &&
          notice.rule.length > 0,
      ) && candidate(name).requiredNotices.includes(book),
      `${name} ${page}`,
    ).toBe(true);
  // Rules the bodies cite, link or depend on: the UM pain and shadow
  // descriptor superscripts, the shaman spirit animal, the Bestiary
  // distraction citation, the linked traits', feats' and spells' books and the
  // blog source.
  for (const [name, book] of [
    ['Shadowplay (Half-Orc)', 'PZO1117'],
    ['Projection', 'PZO1117'],
    ['Shamanic Enhancement', 'PZO1129'],
    ['Wererat-Kin (Nightskulk)', 'PZO1112'],
    ['Thinblood Resistance', 'PZO9280'],
    ['Darklands Stalker', 'PZO9280'],
    ['Shadowplay (Half-Orc)', 'PZO9280'],
    ['Magical Linguist (Gnome)', 'PZO1121'],
    ['Frightened by Magic', BLOG],
  ] as const)
    expect(candidate(name).requiredNotices, `${name} ${book}`).toContain(book);
  expect(candidate('Frightened by Magic').requiredNotices).toEqual([
    BLOG,
    'PZO1110',
  ]);
  // Pain Tolerance's pain descriptor carries no Ultimate Magic citation: an
  // unresolved origin, not a PZO1117 dependency (#385 ruling).
  expect(candidate('Pain Tolerance').requiredNotices).not.toContain('PZO1117');
  expect(
    candidate('Pain Tolerance').inheritedRuleUnresolvedOrigins.join(' '),
  ).toContain('pain descriptor');
  // Unchained action-cost metadata anywhere in the bound closure requires
  // the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedBound])].sort();
  expect(unchained).toHaveLength(29);
  expect(
    assessedTraits
      .filter((row) => row.requiredNotices.includes('PZO1131'))
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(unchained);
  for (const row of assessedTraits) {
    const own =
      (
        row.sourceFields.actions as
          | { activation?: { unchained?: unknown } }[]
          | undefined
      )?.some((action) => action.activation?.unchained) ?? false;
    expect(own, row.name).toBe(unchainedOwn.includes(row.externalKey));
    const rules = row.inheritedRuleNotices
      .filter((notice) => notice.book === 'PZO1131')
      .map((notice) => notice.rule);
    expect(
      rules.some((rule) => rule.includes("racial trait's own action")),
      row.name,
    ).toBe(own);
    expect(
      rules.some((rule) => rule.includes('on the bound')),
      row.name,
    ).toBe(unchainedBound.includes(row.externalKey));
  }
  // Creature types and subtypes have no pinned rules record: named
  // unresolved origins.
  for (const name of [
    'Orc',
    'Monstrous Humanoid (Cecaelia)',
    'Mostly Human (Ifrit)',
    'Wyrmscourged',
    'Hatred (Half-Orc)',
    'Elf-Scorned',
  ])
    expect(
      candidate(name).inheritedRuleUnresolvedOrigins.join(' '),
      name,
    ).toContain('Creature type and subtype rules');
  // The blog source stays a named hold.
  expect(
    candidate('Frightened by Magic').inheritedRuleUnresolvedOrigins.join(' '),
  ).toContain(BLOG);
  // Rejected rows and PCGen leads don't add books: the half-orc's and the
  // hobgoblin's rows, the heritage parts' parent rows and the Legacy of the
  // First World sticky tendrils row.
  for (const [name, line] of [
    ['Darkvision (Orc)', 21],
    ['Languages (Orc)', 26],
    ['Darkvision (Goblin)', 18],
    ['Skilled (Tiefling - Hellspawn)', 20],
    ['Skilled (Tiefling - Grimspawn)', 20],
    ['Spell-Like Ability (Tiefling - the Motherless)', 21],
    ['Skilled (Aasimar - Plumekith)', 22],
  ] as const) {
    expect(
      candidate(name).rejectedRootComparisonEvidence.map((row) => row.line),
      name,
    ).toEqual([line]);
    for (const row of candidate(name).rejectedRootComparisonEvidence)
      expect(row.book, name).toBeNull();
  }
  expect(candidate('Normal Speed (Gathlain)').requiredNotices).not.toContain(
    'PZO9480',
  );
  expect(candidate('Tangling Tentacles').requiredNotices).not.toContain(
    'PZO1116',
  );
  for (const row of review.noticeRequirements) {
    if (row.book === 'PZO1110') {
      expect(row.holdId).toBeNull();
      continue;
    }
    expect(held.get(row.holdId ?? ''), row.book).toEqual([
      row.book,
      ...row.registryKeys.filter((key) => key !== row.book),
    ]);
    for (const key of row.candidates) {
      const trait = assessedTraits.find((trait) => trait.externalKey === key);
      // #328 S4-B: an admitted trait stays in its batch's notice row as
      // history, with no hold of its own.
      if (trait?.disposition === 'admitted')
        expect(trait.noticeHoldIds, trait.name).toEqual([]);
      else expect(trait?.noticeHoldIds).toContain(row.holdId);
    }
  }
});

it('records the importer reading of every race, replacement and unresolved name', () => {
  for (const row of assessedTraits) {
    const detail = entry(row.externalKey).detail;
    const reviewed = row.mechanicsReview.racialTraitReview;
    expect(reviewed.raceKeys, row.name).toEqual(detail.raceKeys);
    expect(reviewed.standard, row.name).toBe(detail.standard);
    expect(reviewed.replaces, row.name).toEqual(detail.replaces ?? []);
    expect(reviewed.unresolvedReplacements, row.name).toEqual(
      detail.unresolvedReplacements ?? [],
    );
    expect(reviewed.kind, row.name).toBe(row.racialTraitKind);
    expect(detail.standard, row.name).toBe(row.racialTraitKind === 'std');
  }
  const unresolved = Object.fromEntries(
    assessedTraits
      .filter(
        (row) => entry(row.externalKey).detail.unresolvedReplacements?.length,
      )
      .map((row) => [
        row.externalKey,
        entry(row.externalKey).detail.unresolvedReplacements,
      ]),
  );
  expect(unresolved).toEqual({
    'pf1-content/leUhvuim6HknT0fn': ['Languages', 'Subtype', 'Type'], // Mostly Human (Ifrit)
    'pf1-content/nPnz19oJfnZKSFdI': ['Base Statistics'], // Lava Gnomes
    'pf1-content/o0ooSUUjwVjL79XE': ['Past-Life Knowledge', 'Nature Magic'], // Fecund Earth
    'pf1-content/oB8Ff3b2HNB2eddC': ['Base Statistics'], // Tower Elf
  });
  // Wyrmscourged and Stalker replace three traits each; the curated heritage
  // lines resolve "Base Statistics" to the race's ability score trait, while
  // the racial subtypes keep it unresolved.
  expect(entry('Wyrmscourged').detail.replaces).toHaveLength(3);
  expect(entry('Stalker').detail.replaces).toHaveLength(3);
  for (const name of [
    'Werebat-Kin (Bloodmarked)',
    'Wererat-Kin (Nightskulk)',
    'Weretiger-Kin (Fanglord)',
    'Agathion-Blooded (Idyllkin)',
  ])
    expect(entry(name).detail.unresolvedReplacements ?? [], name).toEqual([]);
  for (const name of ['Lava Gnomes', 'Tower Elf'])
    expect(entry(name).detail.unresolvedReplacements, name).toEqual([
      'Base Statistics',
    ]);
  // The Subrace Standard parts replace their parent traits by name.
  for (const [name, parent] of [
    ['Skilled (Tiefling - Hellspawn)', 'pf1-content/AKuDJrwJUZULsJcS'],
    ['Skilled (Tiefling - Grimspawn)', 'pf1-content/AKuDJrwJUZULsJcS'],
    ['Change Shape (Skinwalker - Ragebred)', 'pf1-content/mLxAldGcZ0UnEfd7'],
  ] as const)
    expect(entry(name).detail.replaces, name).toEqual([parent]);
});

it('pins all 100 keys, the complete bodies, checked bindings and literal PCGen and PRD evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toEqual({
    total: 100,
    admitted: 1,
    held: 74,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 25,
    excludedFolders: 11,
    excludedRaceBuilder: 14,
    recordLevel35Holds: 0,
  });
  for (const row of excludedRows) {
    const raw = upstreamRecord.parse(
      parse(await readPinned(row.source.repo, row.source.path)),
    );
    if (row.kind === 'folder')
      expect(raw._key, row.name).toBe(`!folders!${raw._id}`);
    // The Race Builder subtree's Other folder is a folder record too.
    else {
      expect(row.folderPath[0], row.name).toBe('Race Builder');
      expect(raw._key, row.name).toBe(`!items!${raw._id}`);
    }
  }
  expect(preview.entries).toHaveLength(75);
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
        reviewedOn: '2026-10-21',
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
    expect(entry(row.externalKey).sources).toEqual(
      row.citedSources.filter((source) => source.book !== BLOG),
    );
  }
  for (const row of assessedTraits)
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
  for (const row of assessedTraits) {
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
      if (!comparison.publicationAnchor) {
        // Core Essentials support rows name no book.
        expect(comparison.path, row.name).toContain('/core_essentials/');
        continue;
      }
      const { path, line, text, sha256 } = comparison.publicationAnchor;
      expect(files.get(path)).toBe(sha256);
      const publication = await readFile(
        `tests/fixtures/pinned/pcgen/${path}`,
        'utf8',
      );
      expect(publication.split(/\r?\n/)[line - 1]?.split('\t')[0]).toBe(text);
    }
    // The PRD paragraph is literally on the pinned capture page.
    const prd = row.prdComparison;
    if (!prd) continue;
    const page = await readPinned('prd', prd.path);
    expect(sha(page), prd.path).toBe(prd.pageSha256);
    expect(page, row.name).toContain(prd.literalParagraph);
    expect(sha(prd.literalParagraph)).toBe(prd.paragraphSha256);
    expect(prd.textMatches, row.name).toBe(prd.wordDifferences.length === 0);
  }
  expect(assessedTraits.filter((row) => row.prdComparison)).toHaveLength(17);
  expect(
    assessedTraits
      .filter((row) => row.prdComparison && !row.prdComparison.textMatches)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Beastmaster',
    'Darklands Stalker',
    'Languages (Orc)',
    'Lava Gnomes',
    'Tower Elf',
  ]);
  // The curated heritages' PCGen Core Essentials ability rows are leads that
  // give the same line and add no book.
  for (const [name, line] of [
    ['Werebat-Kin (Bloodmarked)', 19],
    ['Wererat-Kin (Nightskulk)', 115],
    ['Weretiger-Kin (Fanglord)', 163],
    ['Agathion-Blooded (Idyllkin)', 24],
  ] as const) {
    const lead = candidate(name).additionalComparisonLeads.find(
      (row) => row.line === line,
    );
    expect(lead?.book, name).toBeNull();
    expect(lead?.literalRow, name).toContain('Ability Scores');
  }
});

it('reextracts the reviewed mechanics from a clean shared fixture tree and keeps every racial trait held on its own holds', async () => {
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
    expect(artifact.curation.missing).toEqual([]);
    expect(artifact.curation.stale).toEqual([]);
    expect(artifact.curation.summary).toMatchObject({
      required: 53,
      checked: 53,
      missing: 0,
      descriptions: { candidates: 75, checked: 75 },
    });
    expect(
      artifact.catalog.entries.map((row) => row.externalKey).sort(),
    ).toEqual(assessedTraits.map((row) => row.externalKey).sort());
    // A bounded import extracts no race, so the race changes the full import
    // relocates onto a standard trait are absent here.
    for (const row of artifact.catalog.entries) {
      const saved = entry(row.externalKey);
      // The clean tree holds Dusksight's linked Low-Light Vision record without
      // its Race Builder folders, so the link survives there; the full import
      // excludes the record and strips the link (the reported gap).
      const strip = (text: string) =>
        text.replace(/<a href="catalog:[^"]*">([^<]*)<\/a>/g, '$1');
      expect(
        {
          description: UNRESOLVED_LINK_GAP.includes(row.externalKey)
            ? strip(row.description)
            : row.description,
          sources: row.sources,
        },
        row.name,
      ).toEqual({ description: saved.description, sources: saved.sources });
      if (!RELOCATED_FROM_RACE.includes(row.externalKey)) {
        expect(row.modifiers, row.name).toEqual(saved.modifiers);
        expect(row.situationalNotes, row.name).toEqual(saved.situationalNotes);
      } else
        // The race's re-homed note text is absent too; the trait's own Notes
        // are the same.
        for (const note of row.situationalNotes ?? [])
          expect(saved.situationalNotes, row.name).toContainEqual(note);
    }
    // The assessments are bound against the full-corpus content closure: the
    // committed entries and the entries their closures reach.
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
    const ours = new Set(assessedTraits.map((row) => row.externalKey));
    const gate = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    // #328 S4-B confirms the batch's Half-Elf, Elf, Gnome and Halfling
    // standard traits. Without the owner's notice clearances (this gate) they
    // stay held on their notice chains; the committed gate admits them.
    const admittedKeys = new Set(admittedTraits.map((row) => row.externalKey));
    expect(gate.admitted.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    expect(
      assessCatalogAdmission({ artifact: authoritative, ...reviewedAdmission })
        .admitted.filter((row) => ours.has(row.externalKey))
        .map((row) => row.externalKey)
        .sort(),
    ).toEqual([...admittedKeys].sort());
    for (const row of gate.held.filter((row) =>
      admittedKeys.has(row.externalKey),
    ))
      expect(row.reason, row.name).toMatch(
        /Notice holds|Missing or unreviewed required notices/,
      );
    // Only the Race Builder link gap fails admission; every other record is held.
    expect(
      gate.failures
        .filter((row) => ours.has(row.externalKey))
        .map((row) => [row.externalKey, row.reason])
        .sort(),
    ).toEqual(
      UNRESOLVED_LINK_GAP.map((key) => [
        key,
        'Broken structure or reference: unresolved imported reference.',
      ]),
    );
    const held = gate.held.filter(
      (row) => ours.has(row.externalKey) && !admittedKeys.has(row.externalKey),
    );
    expect(held).toHaveLength(75 - UNRESOLVED_LINK_GAP.length - 1);
    // Skill Training is held on the source-matched Dynamite comics hold;
    // every other record on its own whole-content hold.
    for (const row of held)
      if (row.externalKey === DYNAMITE)
        expect(row.reason, row.name).toMatch(/^Known notice\/evidence hold/);
      else
        expect(row.reason, row.name).toBe(candidate(row.externalKey).rationale);
    for (const row of assessedTraits) {
      const assessment = reviewedAdmission.assessments.find(
        (a) => a.externalKey === row.externalKey,
      );
      expect(assessment).toMatchObject({
        status: row.assessmentStatus,
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
    // Confirming a CRB-cited standard trait's whole content still holds it on
    // its other books' held notices. (#328 S4-B admits Weapon Familiarity (Gnome), the
    // earlier control, so a still-held standard trait stands in.)
    const keen = candidate('Orc');
    expect(keen.disposition).toBe('held');
    expect(keen.requiredNotices).toEqual([
      'PZO9280',
      'PZO1112',
      'PZO1121',
      'PZO1110',
    ]);
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === keen.externalKey
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(
      confirmed.admitted.some((row) => row.externalKey === keen.externalKey),
    ).toBe(false);
    expect(
      confirmed.held.find((row) => row.externalKey === keen.externalKey)
        ?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});
