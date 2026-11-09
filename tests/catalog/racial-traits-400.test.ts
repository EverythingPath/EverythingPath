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
  review,
  assessedTraits,
  admittedTraits,
  excludedRows,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/racial-traits-400/data';
import {
  racialTraitSheet,
  sheetDefinition,
} from '../fixtures/racial-traits-400/sheet';
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
const RELOCATED_FROM_RACE = [
  'pf1-content/iBCPIWFExt679Zhh', // Defensive Training (Dwarf) (Dwarf race note)
  'pf1-content/kSLjzmV15G3J7RRM', // Poison Resistance (Vishkanya race note)
  'pf1-content/iuOrMqm53EkJ4AOt', // Skilled (Duskwalker) (Duskwalker race changes)
  'pf1-content/k4mksTEehz2fxN9e', // Exceptional Senses (Android race change)
];
// Records that fail admission on a reference gap in any preview: Deep Delver
// links Stonesinger, a record of the excluded ARG Race Builder subtree
// (reported as its own gap). Amphibious (Aquatic Elf)'s link to the pinned
// Universal Monster Rules journal page stays as text (#738).
const UNRESOLVED_LINK_GAP = ['pf1-content/hsso3bR3LTyek5hG'];
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
  'pf1-content/hV2bbHMgni1OCXAg', // Spell-Like Ability (Undine)
  'pf1-content/hV6fDydXis2GUFj5', // Poison Minion (Dwarf)
  'pf1-content/i3JDTzYghUAVE4a2', // Envoy
  'pf1-content/iWgQndIpAyjXO7pM', // Powerful Smell
  'pf1-content/iulHWSMNp9TABDDU', // Spell-Like Abilities (Fetchling - Shadow Walk)
  'pf1-content/iy6e5v8YWE9upybn', // Writhing Eye
  'pf1-content/jZdTNIQsmvstAb3Z', // Incorruptible
  'pf1-content/kCnWl2gK9Q56djWG', // Spell-Like Ability (Oread - Gemsoul)
  'pf1-content/kNLt3RoRdXIdVbDa', // Seasoned Spirit
  'pf1-content/kTgoCIh9jQgqDxMM', // Soul Seer
  'pf1-content/knLKGEKSn337diqs', // Heir to Undying Nobility
];
const unchainedBound = [
  'pf1-content/hJ17KnzPNXh1xWm2', // Intense Curiosity
  'pf1-content/hV2bbHMgni1OCXAg', // Spell-Like Ability (Undine)
  'pf1-content/hyluAyDdUizmqorj', // Shattered Soul
  'pf1-content/i3JDTzYghUAVE4a2', // Envoy
  'pf1-content/iWZjiKTQnGS5XnB0', // Qlippoth-Spawn (the Motherless)
  'pf1-content/iulHWSMNp9TABDDU', // Spell-Like Abilities (Fetchling - Shadow Walk)
  'pf1-content/izCRmMUEyikdfpiq', // Devil-Spawn (Hellspawn)
  'pf1-content/jAQXQDgwCX0eKxZ2', // Lavasoul (Magma Ifrit)
  'pf1-content/jZdTNIQsmvstAb3Z', // Incorruptible
  'pf1-content/kCnWl2gK9Q56djWG', // Spell-Like Ability (Oread - Gemsoul)
  'pf1-content/kLPypNzy62fMbj3d', // Stormsoul (Lightning Sylph)
  'pf1-content/kNLt3RoRdXIdVbDa', // Seasoned Spirit
  'pf1-content/kTgoCIh9jQgqDxMM', // Soul Seer
  'pf1-content/kajw0iqeXtEm2sgI', // Toothy
  'pf1-content/knLKGEKSn337diqs', // Heir to Undying Nobility
  'pf1-content/kqSFEBk1ycJ6PG8y', // Small Quarter Ally
];

it('resolves the reviewed racial trait Modifiers through the public resolver', () => {
  // The four curated heritage lines replace their race's ability score trait:
  // the race's line goes dormant and the heritage line applies.
  for (const [name, race, lines] of [
    [
      'Qlippoth-Spawn (the Motherless)',
      'pf1/nVjKDLZSRONzYm8f', // Tiefling: +2 Dex, +2 Int, -2 Cha
      [
        ['ability.str', 10, 12],
        ['ability.dex', 12, 10],
        ['ability.int', 12, 8],
        ['ability.wis', 10, 12],
        ['ability.cha', 8, 10],
      ],
    ],
    [
      'Devil-Spawn (Hellspawn)',
      'pf1/nVjKDLZSRONzYm8f',
      [
        ['ability.con', 10, 12],
        ['ability.dex', 12, 10],
        ['ability.int', 12, 10],
        ['ability.wis', 10, 12],
        ['ability.cha', 8, 8],
      ],
    ],
    [
      'Lavasoul (Magma Ifrit)',
      'pf1/TPHe88Yhy4SsDpKo', // Ifrit: +2 Dex, +2 Cha, -2 Wis
      [
        ['ability.dex', 12, 8],
        ['ability.con', 10, 12],
        ['ability.int', 10, 12],
        ['ability.wis', 8, 10],
        ['ability.cha', 12, 10],
      ],
    ],
    [
      'Stormsoul (Lightning Sylph)',
      'pf1/pbX1xj9Z0ZhUfKvZ', // Sylph: +2 Dex, +2 Int, -2 Con
      [
        ['ability.dex', 12, 12],
        ['ability.con', 8, 10],
        ['ability.int', 12, 10],
        ['ability.wis', 10, 8],
        ['ability.cha', 10, 12],
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
    modifiers('Qlippoth-Spawn (the Motherless)').map((row) => [
      row.target,
      row.bonusType,
      row.value,
    ]),
  ).toEqual([
    ['ability.str', 'racial', 2],
    ['ability.wis', 'racial', 2],
    ['ability.int', 'racial', -2],
  ]);
  // Situational bonuses apply only when their Situation is selected.
  for (const [name, target, base, label, value] of [
    ['Saltbeard', 'ac.other', 'ac', 'aquatic or water', 2],
    ['Saltbeard', 'attack.melee', 'attack', 'aquatic or water', 1],
    ['Saltbeard', 'skill.pro', 'skill.pro', 'sailor', 2],
    ['Saltbeard', 'skill.sur', 'skill.sur', 'at sea', 2],
    ['Sky Sentinel', 'ac.other', 'ac', 'flying', 2],
    ['Sky Sentinel', 'attack.ranged', 'attack', 'flying', 1],
    ['Sky Sentinel', 'skill.per', 'skill.per', 'flying', 2],
    ['Spell Smasher', 'attack.melee', 'attack', 'casting', 1],
    ['Underfoot', 'ac.other', 'ac', 'larger', 1],
    ['Underfoot', 'save.ref', 'save.ref', 'trample', 1],
    ['Intense Curiosity', 'skill.per', 'skill.per', 'taking 20', 4],
    ['Intense Curiosity', 'skill.sur', 'skill.sur', 'taking 20', 4],
    [
      'Voice in the Darkness (Half-Orc)',
      'skill.int',
      'skill.int',
      'dim light',
      2,
    ],
    [
      'Voice in the Darkness (Half-Orc)',
      'skill.ste',
      'skill.ste',
      'dim light',
      2,
    ],
    ['Flighty', 'save.will', 'saves', 'patterns', 2],
    ['Healthy', 'save.fort', 'save.fort', 'disease', 4],
    ['Cleanliness', 'save.fort', 'saves', 'disease', 2],
  ] as const) {
    const index = indexOf(name, base, label);
    expect(resolved(name, target), `${name} ${target}`).toBe(0);
    expect(resolved(name, target, [index]), `${name} ${target}`).toBe(value);
  }
  // Shared Situations only where the body's condition matches exactly.
  for (const [name, shared, target, value] of [
    ['Healthy', 'poison', 'save.fort', 4],
    [
      'Hag Racial Trait (Changeling - Waker May)',
      'mindAffecting',
      'save.will',
      2,
    ],
    ['Small Quarter Ally', 'fear', 'save.ref', 1],
  ] as const) {
    const index = modifiers(name).findIndex(
      (row) => row.condition?.situation === shared,
    );
    expect(index, `${name} ${shared}`).toBeGreaterThanOrEqual(0);
    expect(resolved(name, target), name).toBe(0);
    expect(resolved(name, target, [index]), name).toBe(value);
  }
  // The published types: Healthy's, Cleanliness's, Saltbeard's skill,
  // Sky Sentinel's Perception and Underfoot's Reflex bonuses are untyped.
  for (const [name, target, type] of [
    ['Healthy', 'save.fort', 'untyped'],
    ['Cleanliness', 'saves', 'untyped'],
    ['Saltbeard', 'skill.pro', 'untyped'],
    ['Saltbeard', 'attack', 'racial'],
    ['Saltbeard', 'ac', 'dodge'],
    ['Sky Sentinel', 'skill.per', 'untyped'],
    ['Sky Sentinel', 'ac', 'dodge'],
    ['Underfoot', 'save.ref', 'untyped'],
    ['Underfoot', 'ac', 'dodge'],
    ['Small Quarter Ally', 'saves', 'luck'],
    ['Spell Smasher', 'attack', 'racial'],
  ] as const)
    expect(
      modifiers(name).find((row) => row.target === target)?.bonusType,
      `${name} ${target}`,
    ).toBe(type);
  // Wild Forest Kobold's raw Stealth change is replaced by 0 (reviewed change
  // replacement); the description record supplies the published +2 racial
  // Perception, and the imported Survival change stays.
  expect(
    modifiers('Wild Forest Kobold').map((row) => [
      row.target,
      row.bonusType,
      row.value,
    ]),
  ).toEqual([
    ['skill.ste', 'racial', 0],
    ['skill.sur', 'racial', 2],
    ['skill.per', 'racial', 2],
  ]);
  for (const [target, value] of [
    ['skill.ste', 0],
    ['skill.per', 2],
    ['skill.sur', 2],
  ] as const)
    expect(resolved('Wild Forest Kobold', target), target).toBe(value);
  // Racial bonuses from distinct Sources stack (PRD; character-sheet.ts):
  // Isolated's and Seascarred's +2 racial Perception give +4 together.
  const perception = [
    ...modifiers('Isolated'),
    ...modifiers('Alternate Skill Modifiers (Skinwalker - Seascarred)'),
  ].filter((row) => row.target === 'skill.per');
  expect(resolveSheet(perception, { situations: [] })['skill.per'].total).toBe(
    4,
  );
  // Imported and relocated changes keep mapping; nothing is curated twice.
  for (const [name, target, value] of [
    ['Inquisitive', 'skill.dev', 2],
    ['Inquisitive', 'skill.esc', 2],
    ['Gift of Tongues', 'skill.blf', 1],
    ['Gift of Tongues', 'skill.dip', 1],
    ['Rock Climber', 'skill.acr', 1],
    ['Rock Climber', 'skill.clm', 1],
    ['Fleet-Footed', 'init', 2],
    ['Explorer', 'skill.clm', 2],
    ['Master Tinker', 'skill.dev', 1],
    ['Master Tinker', 'skill.ken', 1],
    ['Beast Bond', 'skill.han', 2],
    ['Beast Bond', 'skill.rid', 2],
    ['Moonkissed', 'save.fort', 1],
    ['Isolated', 'skill.kdu', 2],
    ['Alternate Skill Modifiers (Skinwalker - Seascarred)', 'skill.swm', 2],
    ['Skilled (Tiefling - the Motherless)', 'skill.esc', 2],
    ['Skilled (Tiefling - the Motherless)', 'skill.sur', 2],
    ['Skilled (Duskwalker)', 'skill.kre', 2],
    ['Skilled (Duskwalker)', 'skill.hea', 2],
    ['Exceptional Senses', 'skill.per', 2],
    ['Powerful Smell', 'skill.ste', -4],
  ] as const)
    expect(resolved(name, target), `${name} ${target}`).toBe(value);
  // Gift of Tongues' and Master Tinker's imported racial changes are replaced
  // by 0 (reviewed change replacements); the description records supply the
  // published untyped +1 (fix round 1, as for Seasinger).
  for (const [name, targets] of [
    ['Gift of Tongues', ['skill.blf', 'skill.dip']],
    ['Master Tinker', ['skill.dev', 'skill.ken']],
  ] as const)
    expect(
      modifiers(name).map((row) => [row.target, row.bonusType, row.value]),
      name,
    ).toEqual([
      ...targets.map((target) => [target, 'racial', 0]),
      ...targets.map((target) => [target, 'untyped', 1]),
    ]);
  // Mountaineer replaces Lifebound, but the Samsaran race's checked #328
  // description record keeps Lifebound's bonuses on the race (outstanding,
  // listed for review): +2 where the published rules give 0.
  // The race isn't in the trait's content closure (races grant traits, not
  // the reverse), so the race's checked description record is read from the
  // overlay itself.
  const SAMSARAN = 'pf1/aQ8RQYKVd2hqI4jh';
  const samsaran = reviewedCuration.records.find(
    (row) =>
      row.externalKey === SAMSARAN &&
      row.kind === 'description' &&
      row.status === 'checked',
  );
  if (!samsaran) throw new Error('Missing the Samsaran race record');
  expect(entry('Mountaineer').detail.replaces).toEqual([
    'pf1-content/TMYYCMogKs454s9n',
  ]);
  const race = samsaran.outputs.flatMap((raw) =>
    raw.kind === 'modifier'
      ? [
          {
            ...outputSchema.options[0]
              .omit({ kind: true })
              .extend({ target: z.enum(modifierTargets) })
              .parse(
                Object.fromEntries(
                  Object.entries(raw).filter(([key]) => key !== 'kind'),
                ),
              ),
            sheetEntryId: SAMSARAN,
            catalogEntryId: SAMSARAN,
            source: SAMSARAN,
            entryName: 'Samsaran',
            builtIn: false,
          },
        ]
      : [],
  );
  expect(race).toHaveLength(3);
  for (const [target, scope] of [
    ['save.will', 'death'],
    ['save.ref', 'negativeEnergy'],
    [
      'save.fort',
      { local: 'to remove negative levels', sheetEntryId: SAMSARAN },
    ],
  ] as const)
    expect(
      resolveSheet(race, { situations: [scope] })[target].total,
      JSON.stringify(scope),
    ).toBe(2);
  // Standard traits of #719 races and covered race notes, types, languages,
  // senses, speeds, spell-like abilities, natural attacks, racial subtypes and
  // rules the sheet cannot model stay without reviewed Modifiers.
  // Defensive Training (Dwarf) and Poison Resistance carry only their races'
  // re-homed #328 note outputs; the trait records add none.
  expect(entry('Defensive Training (Dwarf)').modifiers).toEqual([
    {
      target: 'ac',
      bonusType: 'dodge',
      value: 4,
      condition: { situation: 'giants' },
    },
  ]);
  expect(entry('Poison Resistance').modifiers).toEqual([
    {
      target: 'saves',
      bonusType: 'racial',
      value: { formula: '@hitDice' },
      condition: { situation: 'poison' },
    },
  ]);
  for (const name of [
    'Languages (Half-Orc)',
    'Low-Light Vision (Gnome)',
    'Natural Weapons',
    'Stonecunning (Svirfneblin)',
    'Spell Resistance (Svirfneblin)',
    'Gnome Subtype',
    'Languages (Tengu)',
    'Languages (Fetchling)',
    'Languages (Ifrit)',
    'Languages (Grippli)',
    'Languages (Primitive Human)',
    'Native Outsider (Fetchling)',
    'Slow Speed (Merfolk)',
    'Slow Speed (Ratfolk)',
    'Swim Speed (Adaro)',
    'Natural Climber (Monkey Goblin)',
    'Darkvision (Syrinx)',
    'Low-Light Vision (Strix)',
    'Amphibious (Aquatic Elf)',
    'Deep Sea Dweller',
    'Energy Resistance (Ifrit)',
    'Shadowy Resistance',
    'Spell-Like Ability (Undine)',
    'Spell-Like Abilities (Fetchling - Shadow Walk)',
    'Spell-Like Ability (Oread - Gemsoul)',
    'Envoy',
    'Incorruptible',
    'Soul Seer',
    'Heir to Undying Nobility',
    'Seasoned Spirit',
    "Cat's Claws",
    'Toothy',
    'Multi-Armed (Kasatha)',
    'Desert Stride',
    'Ganzi Oddity',
    'Shattered Soul',
    'Long-Lived',
    'Heroic',
    'Fey Thoughts (Half-Orc)',
    'Poison Minion (Dwarf)',
    'Mountaineer',
    'Earth Insight',
    'Writhing Eye',
    'Crystal Affinity (Oread - Gemsoul)',
    'Deep Delver',
    'Storm-Born (Virga May)',
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
  const covered: [string, string][] = [['Poison Minion (Dwarf)', 'ac']];
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
  expect(required).toBe(32);
  // The Dwarf's and the Vishkanya's checked #328 note records cover the
  // Foundry notes of Defensive Training (Dwarf) and Poison Resistance: no
  // required note record exists for them.
  for (const name of ['Defensive Training (Dwarf)', 'Poison Resistance'])
    expect(candidate(name).mechanicsReview.curationRecords, name).toHaveLength(
      1,
    );
  // Notes the Foundry data put on unrelated statistics are entry-level.
  for (const name of [
    'Energy Resistance (Ifrit)',
    'Shadowy Resistance',
    'Deep Sea Dweller',
    'Shattered Soul',
    'Earth Insight',
    'Desert Stride',
  ])
    expect(
      entry(name)
        .situationalNotes?.filter((note) => note.target)
        .map((note) => note.target),
      name,
    ).toEqual([]);
  for (const [name, targets] of [
    ['Mountaineer', ['save.fort', 'skill.acr', 'skill.clm']],
    ['Saltbeard', ['skill.apr']],
    ['Sky Sentinel', ['ac']],
    ['Gift of Tongues', ['skill.lin']],
    ['Master Tinker', ['attack']],
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
    (entry('Powerful Smell').situationalNotes ?? [])
      .map((note) => note.text)
      .join(' '),
  ).toContain('15-foot aura');
  expect(
    (entry('Small Quarter Ally').situationalNotes ?? [])
      .map((note) => note.text)
      .join(' '),
  ).toContain('within 60 feet');
  // Every record lists its outstanding calculations, never as a hold.
  for (const row of assessedTraits) {
    expect(
      row.mechanicsReview.outstandingCalculations.length,
      row.name,
    ).toBeGreaterThan(0);
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  }
  // Discrepancies the batch records rather than fixes.
  for (const name of ["Cat's Claws", 'Wild Forest Kobold'])
    expect(
      candidate(name).mechanicsReview.sourceDiscrepancies.join(' '),
      name,
    ).toMatch(/listed for review/i);
  for (const name of ['Explorer', 'Mountaineer'])
    expect(
      candidate(name).mechanicsReview.outstandingCalculations.join(' '),
      name,
    ).toMatch(/outstanding/i);
  expect(
    candidate('Mountaineer').mechanicsReview.outstandingCalculations.join(' '),
  ).toContain('give 0 for each');
  for (const name of ['Gift of Tongues', 'Master Tinker'])
    expect(
      candidate(name).mechanicsReview.sourceDiscrepancies.join(' '),
      name,
    ).toContain('reviewed change replacements');
  // Only Cat's Claws maps a weapon proficiency: its imported Claw Blades
  // grant, which the body does not state (listed for review).
  for (const row of assessedTraits) {
    const grants = row.name === "Cat's Claws" ? ['Claw Blades'] : [];
    expect(row.mechanicsReview.proficiencyReview.grants, row.name).toEqual(
      grants,
    );
    expect(
      (entry(row.externalKey).proficiencies ?? []).map(
        (proficiency) => (proficiency as { baseType?: string }).baseType,
      ),
      row.name,
    ).toEqual(grants);
  }
});

it('records the race, alternate-trait, monster-ability and Unchained notice dependencies and enforces every hold', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  const holdId = (book: string) =>
    book === BLOG
      ? 'racial-traits-400-notice-primitive-human-blog-complete-chain'
      : `racial-traits-400-notice-${book}-complete-chain`;
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
      // #328 S4-A: the launch comparison supersedes the whole-content
      // hold, and the notice chains are reviewed (PZO1110), cleared
      // (PZO1121) or confirmed (PZO9280), so the row records no hold.
      expect(row.holdIds, row.name).toEqual([]);
      expect(row.noticeHoldIds, row.name).toEqual([]);
      continue;
    }
    expect(row.holdIds, row.name).toEqual([
      `racial-traits-400-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    assessedTraits.filter((row) => row.racialTraitKind === 'alt'),
  ).toHaveLength(36);
  // Universal monster rules the bodies grant or name take the earliest book
  // their pinned Universal Monster Rules journal page lists.
  for (const [name, book, page] of [
    ['Deep Sea Dweller', 'PZO1127', 'Darkvision'],
    ['Deep Sea Dweller', 'PZO1112', 'Resistance'],
    ['Exceptional Senses', 'PZO1127', 'Darkvision'],
    ['Exceptional Senses', 'PZO1112', 'Low-Light Vision'],
    ['Darkvision (Syrinx)', 'PZO1127', 'Darkvision'],
    ['Low-Light Vision (Strix)', 'PZO1112', 'Low-Light Vision'],
    ['Low-Light Vision (Gnome)', 'PZO1112', 'Low-Light Vision'],
    ['Energy Resistance (Ifrit)', 'PZO1112', 'Resistance'],
    ['Shadowy Resistance', 'PZO1112', 'Resistance'],
    ['Spell Resistance (Svirfneblin)', 'PZO1112', 'Spell Resistance'],
    ['Amphibious (Aquatic Elf)', 'PZO1112', 'Amphibious'],
    ['Natural Weapons', 'PZO1112', 'Natural Attacks'],
    ["Cat's Claws", 'PZO1112', 'Natural Attacks'],
    ['Toothy', 'PZO1112', 'Natural Attacks'],
    ['Poison Minion (Dwarf)', 'PZO1112', 'Poison'],
    ['Powerful Smell', 'PZO1112', 'Stench'],
    ['Underfoot', 'PZO1112', 'Trample'],
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
  // Rules the bodies cite, link or depend on: the APG hero point system and
  // Blood of Heroes (a linked feat with no recorded source), the APG corruption
  // resistance spell, the APG and UM bloodlines and subdomains of the
  // elemental heritages, the linked spells' and traits' books and the blog
  // source.
  for (const [name, book] of [
    ['Heroic', 'PZO1115'],
    ['Incorruptible', 'PZO1115'],
    ['Lavasoul (Magma Ifrit)', 'PZO1117'],
    ['Lavasoul (Magma Ifrit)', 'PZO1115'],
    ['Lavasoul (Magma Ifrit)', 'PZO1138'],
    ['Stormsoul (Lightning Sylph)', 'PZO1115'],
    ['Crystal Affinity (Oread - Gemsoul)', 'PZO1115'],
    ['Spell-Like Ability (Undine)', 'PZO1115'],
    ['Deep Delver', 'PZO1115'],
    ['Moonkissed', 'PZO9491'],
    ['Small Quarter Ally', 'PZO9491'],
    ['Alternate Skill Modifiers (Skinwalker - Seascarred)', 'PZO1133'],
    ['Hag Racial Trait (Changeling - Waker May)', 'PZO1127'],
    ['Languages (Primitive Human)', BLOG],
  ] as const)
    expect(candidate(name).requiredNotices, `${name} ${book}`).toContain(book);
  expect(candidate('Languages (Primitive Human)').requiredNotices).toEqual([
    BLOG,
    'PZO1110',
  ]);
  expect(
    candidate('Heroic').linkedContentReview.map((row) => [
      row.name,
      row.sources,
    ]),
  ).toEqual([['Blood of Heroes', []]]);
  expect(
    candidate('Heroic').inheritedRuleComparisonEvidence.map((row) => [
      row.path,
      row.line,
      row.book,
    ]),
  ).toContainEqual([
    'data/pathfinder/paizo/roleplaying_game/advanced_players_guide/apg_feats.lst',
    273,
    'PZO1115',
  ]);
  // Unchained action-cost metadata anywhere in the bound closure requires
  // the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedBound])].sort();
  expect(unchained).toHaveLength(19);
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
  for (const name of ['Native Outsider (Fetchling)', 'Gnome Subtype'])
    expect(
      candidate(name).inheritedRuleUnresolvedOrigins.join(' '),
      name,
    ).toContain('Creature type and subtype rules');
  // #328 S4-A: Defensive Training (Dwarf) only names the giant subtype as its
  // bonus's target, as the Core Rulebook's own text does, so its origin note
  // is resolved rather than held.
  const defensive = candidate('Defensive Training (Dwarf)');
  expect(defensive.inheritedRuleUnresolvedOrigins).toEqual([]);
  expect(defensive.resolvedOrigins?.map((row) => row.origin)).toEqual([
    expect.stringContaining('Creature type and subtype rules'),
  ]);
  expect(defensive.resolvedOrigins?.[0]?.resolution).toContain(
    'names the giant subtype only as the target',
  );
  // The blog source stays a named hold.
  expect(
    candidate(
      'Languages (Primitive Human)',
    ).inheritedRuleUnresolvedOrigins.join(' '),
  ).toContain(BLOG);
  // Rejected rows and PCGen leads don't add books: the Tian Xia language
  // rows are rejected, and the heritage parts' parent rows too. (Languages
  // (Tengu) cites Dragon Empires Primer and Gazetteer itself, so PZO9421 and
  // PZO9240 are required on its own account, not the rejected rows'.)
  for (const row of candidate('Languages (Tengu)')
    .rejectedRootComparisonEvidence)
    expect(row.book).toBeNull();
  expect(
    candidate('Languages (Tengu)').rejectedRootComparisonEvidence.map(
      (row) => row.line,
    ),
  ).toEqual([132, 130]);
  for (const [name, line] of [
    ['Skilled (Tiefling - the Motherless)', 20],
    ['Spell-Like Ability (Oread - Gemsoul)', 19],
    ['Hag Racial Trait (Changeling - Waker May)', 19],
  ] as const)
    expect(
      candidate(name).rejectedRootComparisonEvidence.map((row) => row.line),
      name,
    ).toEqual([line]);
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
      // #328 S4-A: an admitted trait stays in its batch's notice row as
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
    'pf1-content/hsso3bR3LTyek5hG': ['Base Statistics'], // Deep Delver
    'pf1-content/iES8aXKMApVmwZad': ['Crystal Affinity (Oread - Gemsoul)'], // Crystal Affinity (Oread - Gemsoul)
    'pf1-content/jXo1JOAbSAm1iC5M': ['Base Statistics'], // Storm-Born (Virga May)
  });
  // Sky Sentinel and Saltbeard replace three dwarf traits; Seasoned Spirit
  // replaces three vine leshy traits; the curated heritage lines resolve
  // "Base Statistics" to the race's ability score trait, while Deep Delver and
  // Storm-Born (Virga May) keep it unresolved.
  expect(entry('Sky Sentinel').detail.replaces).toHaveLength(3);
  expect(entry('Saltbeard').detail.replaces).toHaveLength(3);
  expect(entry('Seasoned Spirit').detail.replaces).toHaveLength(3);
  expect(entry('Isolated').detail.replaces).toHaveLength(2);
  for (const name of [
    'Qlippoth-Spawn (the Motherless)',
    'Devil-Spawn (Hellspawn)',
    'Lavasoul (Magma Ifrit)',
    'Stormsoul (Lightning Sylph)',
  ])
    expect(entry(name).detail.unresolvedReplacements ?? [], name).toEqual([]);
  for (const name of ['Deep Delver', 'Storm-Born (Virga May)'])
    expect(entry(name).detail.unresolvedReplacements, name).toEqual([
      'Base Statistics',
    ]);
  // The Motherless's Skilled replaces the tiefling's Skilled by name.
  expect(entry('Skilled (Tiefling - the Motherless)').detail.replaces).toEqual([
    'pf1-content/AKuDJrwJUZULsJcS',
  ]);
});

it('pins all 100 keys, the complete bodies, checked bindings and literal PCGen and PRD evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toEqual({
    total: 100,
    admitted: 3,
    held: 75,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 22,
    excludedFolders: 10,
    excludedRaceBuilder: 12,
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
  expect(preview.entries).toHaveLength(78);
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
  expect(assessedTraits.filter((row) => row.prdComparison)).toHaveLength(29);
  expect(
    assessedTraits
      .filter((row) => row.prdComparison && !row.prdComparison.textMatches)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Defensive Training (Dwarf)',
    'Envoy',
    'Gift of Tongues',
    'Languages (Fetchling)',
    'Languages (Half-Orc)',
    'Languages (Ifrit)',
    'Spell-Like Abilities (Fetchling - Shadow Walk)',
    'Spell-Like Ability (Undine)',
    'Toothy',
    'Underfoot',
  ]);
  // The curated tiefling heritages' PCGen Core Essentials ability rows are
  // leads that give the same line and add no book.
  for (const [name, line] of [
    ['Qlippoth-Spawn (the Motherless)', 110],
    ['Devil-Spawn (Hellspawn)', 70],
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
      required: 32,
      checked: 32,
      missing: 0,
      descriptions: { candidates: 78, checked: 78 },
    });
    expect(
      artifact.catalog.entries.map((row) => row.externalKey).sort(),
    ).toEqual(assessedTraits.map((row) => row.externalKey).sort());
    // A bounded import extracts no race, so the race changes the full import
    // relocates onto a standard trait are absent here.
    for (const row of artifact.catalog.entries) {
      const saved = entry(row.externalKey);
      expect(
        { description: row.description, sources: row.sources },
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
    const gate = assessCatalogAdmission({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    // #328 S4-A admits the batch's Human, Dwarf and Half-Orc standard
    // traits; every other record stays held.
    expect(
      gate.admitted
        .filter((row) => ours.has(row.externalKey))
        .map((row) => row.externalKey)
        .sort(),
    ).toEqual(admittedTraits.map((row) => row.externalKey).sort());
    // Only the journal-link gap fails admission; every other record is held.
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
    const held = gate.held.filter((row) => ours.has(row.externalKey));
    expect(held).toHaveLength(78 - UNRESOLVED_LINK_GAP.length - 3);
    // Every record is held on its own whole-content hold.
    for (const row of held)
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
    // its other books' held notices.
    const keen = candidate('Languages (Half-Orc)');
    expect(keen.requiredNotices).toEqual(['PZO9280', 'PZO1121', 'PZO1110']);
    // With its PCGen-confirmed books reviewed (2026-10-31), only the notice
    // holds the owner's clearance clears still hold it, so this runs uncleared.
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
