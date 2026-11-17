// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { representativeClassCatalog } from '../../convex/lib/representativeClassCatalog';
import type { PcgenTree } from '../../scripts/catalog/pcgen/lst';
import type { PreviewEntry } from '../../scripts/catalog/map';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import type { PrestigeReferences } from '../../scripts/catalog/pcgen/requirements';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from '../../src/lib/character-sheet';
import {
  mapPinnedPrestige,
  pinnedFoundryReferences,
  readPcgen716PrestigeTree,
} from './pcgen-716-prestige-tree';

// #716 P4 (plan §3, research note 716-p4 §3): entry order on imported
// prestige definitions. "You must be able to qualify for this level before
// any of the following adjustments are made" (CRB p. 30), and requirements
// are met "before gaining any benefits of that level" (CRB p. 374). The sheet
// checks a prestige class once, on its family's first level, in the current
// view and against the recorded prefix before that level, which counts
// advances earlier prestige levels assigned but not the entering level's.
let tree: PcgenTree;
let references: PrestigeReferences;
beforeAll(async () => {
  tree = await readPcgen716PrestigeTree();
  references = await pinnedFoundryReferences();
}, 60_000);

const cr = 'roleplaying_game/core_rulebook/cr_classes.lst';
type ClassLevel = Extract<SheetEntry, { kind: 'classLevel' }>;
type Advances = ClassLevel['state']['castingAdvances'];
type Level = {
  classEntryId: string;
  advances?: Advances;
  skillRanks?: Record<string, number>;
};

/** A Catalog definition the sheet reads, from an imported prestige entry that meets the release schema. */
function sheetDefinition(mapped: PreviewEntry): CharacterSheetCatalogEntry {
  const entry = importedCatalogEntrySchema.parse(mapped);
  const { detail } = entry;
  if (detail.kind !== 'class') throw new Error(`${entry.name} is no class`);
  return {
    _id: entry.externalKey,
    ruleIdentity: entry.externalKey,
    name: entry.name,
    modifiers: [],
    prerequisites: entry.prerequisites,
    prerequisiteText: entry.prerequisiteText,
    detail: {
      kind: 'class',
      classKind: detail.classKind,
      hitDie: detail.hitDie,
      bab: detail.bab,
      saves: detail.saves,
      skillRanksPerLevel: detail.skillRanksPerLevel,
      classSkills: detail.classSkills,
      ...(detail.castingAdvances
        ? { castingAdvances: detail.castingAdvances }
        : {}),
      featuresByLevel: [],
      picksByLevel: [],
    },
  };
}
const imported = (file: string, line: number, externalKey: string) =>
  sheetDefinition(
    mapPinnedPrestige({ tree, file, line, externalKey, references }).subject
      .entry,
  );

const featDefinition = (
  key: string,
  name: string,
): CharacterSheetCatalogEntry => ({
  _id: key,
  ruleIdentity: key,
  name,
  modifiers: [],
  detail: { kind: 'feat' },
});
const featEntry = (key: string, gainedAtClassLevel: string): SheetEntry => ({
  _id: `feat-${key}`,
  kind: 'feat',
  active: true,
  catalogEntryId: key,
  gainedAtClassLevel,
  state: { kind: 'feat', slot: 'general' },
});

/** Class Levels in order, ids `<class id>-<class level>`, on the representative base classes. */
function sheet(
  levels: readonly (string | Level)[],
  definitions: CharacterSheetCatalogEntry[],
  entries: SheetEntry[] = [],
): CharacterSheetInput {
  const counts = new Map<string, number>();
  return {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      ...levels.map((value, index): SheetEntry => {
        const level =
          typeof value === 'string' ? { classEntryId: value } : value;
        const count = (counts.get(level.classEntryId) ?? 0) + 1;
        counts.set(level.classEntryId, count);
        return {
          _id: `${level.classEntryId.replace('everythingpath/', '')}-${count}`,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            position: index + 1,
            classEntryId: level.classEntryId,
            hpGained: 5,
            ...(level.advances ? { castingAdvances: level.advances } : {}),
            ...(level.skillRanks ? { skillRanks: level.skillRanks } : {}),
          },
        };
      }),
      ...entries,
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value: 10,
        })),
      },
      ...representativeClassCatalog
        .filter(
          ({ detail }) => 'classKind' in detail && detail.classKind === 'base',
        )
        .map((definition) => ({ ...definition, _id: definition.ruleIdentity })),
      ...definitions,
    ],
  };
}
const repeat = (classEntryId: string, count: number) =>
  Array.from({ length: count }, () => classEntryId);
const checksOf = (
  input: CharacterSheetInput,
  entryId: string,
  pick: (clause: object) => boolean,
) =>
  calculateCharacterSheet(input)
    .prerequisites.filter(
      (check) => check.entryId === entryId && pick(check.clause),
    )
    .map(({ view, met }) => [view, met]);

describe('entry order on imported prestige definitions', () => {
  // cr_classes.lst:400: BAB +6. Fighter 5 has +5; the Duelist level's own
  // BAB makes +6 now, but not in the recorded prefix (plan §3).
  it('1. Duelist after Fighter 5: BAB is met now and unmet as recorded', () => {
    const duelist = imported(cr, 398, 'everythingpath/duelist');
    const feats = [
      ['pf1/JreaiTHdyWFNj3Tb', 'Dodge'],
      ['pf1/R7L4SlGRlnThqFrP', 'Mobility'],
      ['pf1/vWiTqHC4Y3Xn1Pme', 'Weapon Finesse'],
    ] as const;
    const input = sheet(
      [
        {
          classEntryId: 'fighter',
          skillRanks: { 'skill.acr': 1, 'skill.prf': 1 },
        },
        {
          classEntryId: 'fighter',
          skillRanks: { 'skill.acr': 1, 'skill.prf': 1 },
        },
        ...repeat('fighter', 3),
        duelist._id,
      ],
      [duelist, ...feats.map(([key, name]) => featDefinition(key, name))],
      feats.map(([key]) => featEntry(key, 'fighter-1')),
    );
    expect(checksOf(input, 'duelist-1', (clause) => 'bab' in clause)).toEqual([
      ['current', true],
      ['recorded', false],
    ]);
    // Three feats and two skills, met in both views.
    expect(
      checksOf(input, 'duelist-1', (clause) => !('bab' in clause)),
    ).toEqual(
      Array.from({ length: 5 }, () => [
        ['current', true],
        ['recorded', true],
      ]).flat(),
    );
  });

  // cr_classes.lst:450; CRB p. 387: 2nd-level arcane and divine spells.
  it('2. Mystic Theurge after Wizard 3 / Cleric 3 passes both views; its own advances don’t count', () => {
    const theurge = imported(cr, 448, 'everythingpath/mystic-theurge');
    const casting = (clause: object) => 'canCast' in clause;
    expect(
      checksOf(
        sheet(
          [...repeat('wizard', 3), ...repeat('cleric', 3), theurge._id],
          [theurge],
        ),
        'mystic-theurge-1',
        casting,
      ),
    ).toEqual([
      ['current', true],
      ['recorded', true],
      ['current', true],
      ['recorded', true],
    ]);
    // Cleric 2 casts only 1st-level spells; the entering level's divine
    // advance lifts it now, but the recorded prefix excludes it.
    expect(
      checksOf(
        sheet(
          [
            ...repeat('wizard', 3),
            ...repeat('cleric', 2),
            {
              classEntryId: theurge._id,
              advances: [
                { classEntryId: 'wizard' },
                { classEntryId: 'cleric' },
              ],
            },
          ],
          [theurge],
        ),
        'mystic-theurge-1',
        casting,
      ),
    ).toEqual([
      ['current', true],
      ['recorded', false],
      ['current', true],
      ['recorded', true],
    ]);
  });

  // cr_classes.lst:349-361 and :411: an Arcane Trickster level assigned to
  // wizard lifts Wizard 4 to 3rd-level spells before Eldritch Knight's entry.
  it('3. an earlier prestige level’s advance satisfies a later prestige class’s canCast', () => {
    const trickster = imported(cr, 345, 'everythingpath/arcane-trickster');
    const knight = imported(cr, 409, 'everythingpath/eldritch-knight');
    const casting = (clause: object) => 'canCast' in clause;
    const withAdvance = sheet(
      [
        ...repeat('wizard', 4),
        { classEntryId: trickster._id, advances: [{ classEntryId: 'wizard' }] },
        knight._id,
      ],
      [trickster, knight],
    );
    expect(checksOf(withAdvance, 'eldritch-knight-1', casting)).toEqual([
      ['current', true],
      ['recorded', true],
    ]);
    const without = sheet([...repeat('wizard', 4), knight._id], [knight]);
    expect(checksOf(without, 'eldritch-knight-1', casting)).toEqual([
      ['current', false],
      ['recorded', false],
    ]);
  });

  // cr_classes.lst:415-423: Eldritch Knight 2 advances an arcane class; a
  // sorcerer first taken after entry doesn't qualify (SPC:336-340).
  it('4. a class first taken between prestige levels is later for the advances', () => {
    const knight = imported(cr, 409, 'everythingpath/eldritch-knight');
    const result = calculateCharacterSheet(
      sheet(
        [
          ...repeat('wizard', 5),
          knight._id,
          'sorcerer',
          {
            classEntryId: knight._id,
            advances: [{ classEntryId: 'sorcerer' }],
          },
        ],
        [knight],
      ),
    );
    expect(
      result.castingAdvances.map(
        ({
          entryId,
          kind,
          targetClassEntryId,
          eligibleClassEntryIds,
          problem,
        }) => [
          entryId,
          kind,
          targetClassEntryId,
          eligibleClassEntryIds,
          problem,
        ],
      ),
    ).toEqual([
      ['eldritch-knight-2', 'arcane', 'sorcerer', ['wizard'], 'later'],
    ]);
  });

  // iswg_classes.lst:23-25 and ag_classes.lst:170-172 print the same
  // requirements. Until P6 decides their identity they are separate
  // definitions: each family checks entry on its own first level, and their
  // levels don't merge.
  it('5. two Hellknight variant definitions each check entry once and keep their own levels', () => {
    const iswg = imported(
      'campaign_setting/inner_sea_world_guide/iswg_classes.lst',
      23,
      'everythingpath/hellknight-iswg',
    );
    const ag = imported(
      'roleplaying_game/adventurers_guide/ag_classes.lst',
      170,
      'everythingpath/hellknight-ag',
    );
    expect(ag.prerequisites).toEqual(iswg.prerequisites);
    const input = sheet(
      [...repeat('fighter', 5), iswg._id, ag._id, iswg._id],
      [iswg, ag],
    );
    const result = calculateCharacterSheet(input);
    const checked = [
      ...new Set(result.prerequisites.map(({ entryId }) => entryId)),
    ].filter((entryId) => entryId.startsWith('hellknight'));
    expect(checked).toEqual(['hellknight-iswg-1', 'hellknight-ag-1']);
    // The unchecked devil-slaying clause stays unresolved, never failed.
    expect(
      result.prerequisites
        .filter(({ clause }) => 'unchecked' in clause)
        .map(({ entryId, view, met }) => [entryId, view, met]),
    ).toEqual([
      ['hellknight-iswg-1', 'current', null],
      ['hellknight-iswg-1', 'recorded', null],
      ['hellknight-ag-1', 'current', null],
      ['hellknight-ag-1', 'recorded', null],
    ]);
  });
});
