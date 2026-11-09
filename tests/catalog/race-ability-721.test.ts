// @vitest-environment node
import { createHash } from 'node:crypto';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
import { buildAssessmentBinding } from '../../scripts/catalog/admission';
import {
  applyCuration,
  collectCurationInputs,
  collectDescriptionInputs,
  parseCuration,
} from '../../scripts/catalog/curation';
import { importCatalog } from '../../scripts/catalog/import';
import { mapEntry, upstreamRecord } from '../../scripts/catalog/map';
import {
  raceAbilityTraitKey,
  reviewedAbilityLineSubraces,
  reviewedRaceAbilityTraits,
  reviewedTraitNameAliases,
  reviewedUnresolvedAlternates,
} from '../../scripts/catalog/racial-trait-rules';
import type { LoadedRecord } from '../../scripts/catalog/records';
import {
  calculateCharacterSheet,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from '../../src/lib/character-sheet';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import provenance from '../fixtures/race-ability-721/provenance.json';
import {
  alternateRow,
  grantedTraitRow,
  raceSheet,
  sheetDefinition,
} from '../fixtures/racial-traits-719/sheet';
import { assessWithUnclearedHolds } from './uncleared-holds';

// Pinned Foundry PF1 v11.11 and pf1-content 11.4.0 records: every race record,
// and the trait folders of the races whose alternates the tests use. See the
// fixture README.
const fixtureRoot = resolve('tests/fixtures/race-ability-721');
const inputs = {
  systemPath: join(fixtureRoot, 'pf1'),
  contentPath: join(fixtureRoot, 'pf1-content'),
  remaps: [],
  curation,
};
const race = {
  elf: 'pf1/NgIhxRI0axrf3fcO',
  halfElf: 'pf1/cCepRrfH5SalFfT4',
  halfOrc: 'pf1/dCAXgdA6Db1Z3ccz',
  aasimar: 'pf1/FHY3oIk5zSOFncJH',
  changeling: 'pf1/9FBT6uqlRgaw9gug',
  gathlain: 'pf1/ubx4PIbRqmVT93Ds',
  goblin: 'pf1/bOv30pyHB1gFbSTj',
  kitsune: 'pf1/GAoJIy6ycj3OovQT',
  vineLeshy: 'pf1/KMpuFun7YDFyuO8z',
  lashuntaFemale: 'pf1/7aDvyO68K8hm58Qm',
  lashuntaMale: 'pf1/g9GYFtD8FOxtUGvJ',
  greenMartian: 'pf1/YxeSVRbG7lfQybfr',
  gnoll: 'pf1/ITHs6VCRdSQUsoen',
} as const;
const trait = (id: string) => `pf1-content/${id}`;
const t = {
  halfOrcAbility: trait('VHmuEYXmx81Q5EmC'),
  intimidating: trait('UawXK40Ix4vmfMkY'),
  orcBlood: trait('JWzMBJeAQYDav9gw'),
  orcFerocity: trait('OyIvyI3x7V5HIzZL'),
  halfElfAbility: trait('orOAYDkNl4pqYWA4'),
  adaptability: trait('wZZzaSmiF8hTuRo7'),
  elvenImmunitiesHalfElf: trait('oTQL4P3IdoJQAkOB'),
  keenSensesHalfElf: trait('1HOWCThotIz5ztx0'),
  multitalented: trait('srOpqbXesXBuvTqe'),
  changelingAbility: trait('PxjUu8YOjXmWdagL'),
  gathlainAbility: trait('7IMx5MBTrYTOhTnf'),
  gathlainSpeed: trait('lhDGN1bu2IsaabX4'),
  kitsuneAbility: trait('6yUgkL8nRaoWTl41'),
  vineLeshyAbility: trait('co5OzRBqAzXGbgii'),
  sexualDimorphism: trait('H8rQtfSQ6Ws9EicL'),
  // Published alternates.
  orcAtavism: trait('SJOcTJ2MQI3AoMeh'),
  kindredRaised: trait('PZivMg8Pl1LRnSQE'),
  witchborn: trait('zl9Eo1R5aLckDvaj'),
  treeBorn: trait('ZLN55d8hUbX0lqfm'),
  keenKitsune: trait('YQqgLh49YxGpID1c'),
  agileVineLeshy: trait('tQ76ZcUN6Sk1hYHY'),
  arcticElf: trait('S2NJixZYq3fBtPig'),
  oversizedGoblins: trait('xPtJg4WPKxVRmVdM'),
  angelBlooded: trait('TbnWNAk91q2wgqCP'),
};
const abilityTargets = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha']);
const rawChanges = z.array(
  z.object({
    target: z.string().optional(),
    formula: z.string(),
    type: z.string(),
  }),
);

type Artifact = Awaited<ReturnType<typeof importCatalog>>;
let artifact: Artifact;
let definitions: CharacterSheetCatalogEntry[];
/** Every pinned race record, by stable key. */
const raceRecords = new Map<string, LoadedRecord>();
beforeAll(async () => {
  artifact = await importCatalog(inputs);
  definitions = artifact.catalog.entries.map(definitionOf);
  const directory = join(inputs.systemPath, 'packs/races');
  for (const file of await readdir(directory)) {
    const record = upstreamRecord.parse(
      parse(await readFile(join(directory, file), 'utf8')),
    );
    raceRecords.set(`pf1/${record._id}`, {
      repo: 'pf1',
      pack: 'races',
      path: `packs/races/${file}`,
      record,
    });
  }
});

const vishkanya = 'pf1/Yder5QR51sDl5X0n';
/**
 * The resolver definition. The Vishkanya's reviewed poison save bonus is a
 * `@hitDice` formula, which the fixture adapter does not take; it is dropped
 * on both sides of every comparison.
 */
function definitionOf(raw: unknown) {
  const parsed = importedCatalogEntrySchema.parse(raw);
  return sheetDefinition(
    parsed.externalKey === vishkanya
      ? {
          ...parsed,
          modifiers: parsed.modifiers.filter(
            (modifier) => typeof modifier.value === 'number',
          ),
        }
      : parsed,
  );
}

function entry(key: string, from = artifact) {
  const found = from.catalog.entries.find((row) => row.externalKey === key);
  if (!found) throw new Error(`Missing fixture entry ${key}`);
  return found;
}
function report(from = artifact) {
  const found = from.catalog.racialTraits;
  if (!found) throw new Error('Missing Racial Trait report');
  return found;
}
function raceRow(key: string, from = artifact) {
  return report(from).races.find((row) => row.externalKey === key);
}
function racialTraitsOf(key: string, from = artifact) {
  const detail = entry(key, from).detail;
  return detail.kind === 'race' ? (detail.racialTraits ?? []) : [];
}
function sheet(raceKey: string, entries: SheetEntry[] = []) {
  return raceSheet({ race: raceKey, definitions, entries });
}
function calculate(input: CharacterSheetInput, situations: string[] = []) {
  return calculateCharacterSheet(input, { situations });
}
function scores(input: CharacterSheetInput) {
  const { abilities } = calculate(input);
  return Object.fromEntries(
    Object.entries(abilities).map(([ability, value]) => [ability, value.score]),
  );
}
/** A selected alternate whose ability choice names this ability. */
function chosenAlternate(catalogEntryId: string, choice: string): SheetEntry {
  return {
    _id: `alternate:${catalogEntryId}`,
    kind: 'racialTrait',
    active: true,
    catalogEntryId,
    state: { kind: 'racialTrait', choice },
  };
}
function counting(input: CharacterSheetInput, key: string) {
  return calculate(input).resolvedEntries.find(
    (row) =>
      row.entry.kind === 'racialTrait' && row.entry.catalogEntryId === key,
  )?.counting;
}
/** The race record's own fixed ability changes, as the race would map them. */
function abilityChangesOf(key: string) {
  const source = raceRecords.get(key);
  if (!source) throw new Error(`Missing race record ${key}`);
  return rawChanges
    .parse(source.record.system.changes)
    .filter((change) => abilityTargets.has(change.target ?? ''))
    .map((change) => ({
      target: `ability.${change.target ?? ''}`,
      bonusType: change.type,
      value: Number(change.formula),
    }));
}

/**
 * The race as #328 imported it: one entry carrying every mapped change and
 * every reviewed race note and description output, with no Racial Traits.
 */
function singleEntryRace(key: string) {
  const source = raceRecords.get(key);
  if (!source) throw new Error(`Missing race record ${key}`);
  const mapped = mapEntry({
    source,
    kind: 'race',
    resolveKey: (value) => value,
    lookup: new Map(),
    spellClassTags: new Set(),
  });
  applyCuration({
    inputs: [
      ...collectCurationInputs({ source, externalKey: key, kind: 'race' }),
      ...collectDescriptionInputs({
        source,
        externalKey: key,
        kind: 'race',
        explicitlyReviewed: true,
      }),
    ],
    seeds: [],
    data: parseCuration(curation),
    entries: [mapped],
  });
  return definitionOf({
    ...mapped,
    detail: { ...mapped.detail, racialTraits: [] },
  });
}

/** Every resolved statistic total, ordinary and in each Situation. */
function totals(input: CharacterSheetInput, situations: string[]) {
  return Object.fromEntries(
    ['', ...situations].map((situation) => {
      const result = calculate(input, situation ? [situation] : []);
      return [
        situation || 'ordinary',
        Object.fromEntries(
          Object.entries(result.breakdowns).flatMap(([target, statistic]) => {
            const conditional = [
              ...statistic.conditional,
              ...(statistic.excluded ?? []),
            ]
              .map((modifier) => `${modifier.bonusType}:${modifier.value}`)
              .sort();
            return statistic.total || conditional.length
              ? [[target, { total: statistic.total, conditional }]]
              : [];
          }),
        ),
      ];
    }),
  );
}

it('copies every fixture record byte for byte from the pinned checkouts', async () => {
  expect(provenance.pins.pf1.commit).toBe(
    '418761d2e16a6037c0156bb4a241f7cea5a2986d',
  );
  expect(provenance.pins['pf1-content'].commit).toBe(
    '02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d',
  );
  for (const source of provenance.rawSources) {
    const text = await readFile(join(fixtureRoot, source.repo, source.path));
    expect(createHash('sha256').update(text).digest('hex'), source.path).toBe(
      source.sha256,
    );
  }
});

describe('coverage', () => {
  // The races whose pinned standard traits already own their ability changes
  // (ep-orch/research/721.md §1). Human, Half-Elf, Half-Orc and Primitive
  // Human have no race ability change.
  const ownedByPinnedTrait = new Set<string>([
    race.changeling,
    race.gathlain,
    race.kitsune,
    race.vineLeshy,
  ]);

  it('reviews one ability score trait for exactly the pinned races whose fixed ability changes no pinned trait owns', () => {
    const expected = [...raceRecords.keys()]
      .filter(
        (key) =>
          abilityChangesOf(key).length > 0 && !ownedByPinnedTrait.has(key),
      )
      .sort();
    expect(expected).toHaveLength(72);
    expect(reviewedRaceAbilityTraits.map((rule) => rule.race).sort()).toEqual(
      expected,
    );
    expect(report().abilityTraits).toHaveLength(72);
    expect(
      report().abilityTraits.every((row) => row.status === 'applied'),
    ).toBe(true);
    expect(report().summary.abilityTraits).toEqual({
      applied: 72,
      stale: 0,
      unused: 0,
    });
  });

  it.each(reviewedRaceAbilityTraits.map((rule) => [rule.name, rule] as const))(
    'gives the %s exactly one trait carrying exactly its own ability changes',
    (_name, rule) => {
      const key = raceAbilityTraitKey(rule.race);
      const derived = racialTraitsOf(rule.race).filter((candidate) =>
        candidate.startsWith('local/'),
      );
      expect(derived).toEqual([key]);
      const changes = abilityChangesOf(rule.race);
      expect(changes.every((change) => change.bonusType === 'racial')).toBe(
        true,
      );
      expect(entry(key)).toMatchObject({
        name: `Ability Score Modifiers (${rule.name})`,
        upstreamKey: rule.race,
        modifiers: changes,
        detail: {
          kind: 'racialTrait',
          raceKeys: [rule.race],
          standard: true,
          replaces: [],
        },
        // The race record's own citation: the published text.
        sources: entry(rule.race).sources,
      });
      expect(
        entry(rule.race).modifiers.filter((modifier) =>
          modifier.target.startsWith('ability.'),
        ),
      ).toEqual([]);
      const row = raceRow(rule.race);
      expect(row?.ownerlessModifiers).not.toContainEqual(
        expect.objectContaining({ target: expect.stringMatching(/^ability/) }),
      );
      expect(row).toMatchObject({ lostModifiers: [], addedModifiers: [] });
      // Provenance: the race record, the published book and page, and PCGen.
      const [source] = entry(rule.race).sources;
      expect(
        report().abilityTraits.find(
          (candidate) => candidate.race === rule.race,
        ),
      ).toMatchObject({
        trait: key,
        status: 'applied',
        evidence: { book: source?.book, pages: source?.pages },
        pcgen: rule.pcgen,
      });
    },
  );

  it("describes each trait with its race description's own ability line", () => {
    // Elf, CRB p. 22.
    expect(entry(raceAbilityTraitKey(race.elf)).description).toBe(
      '<p><strong>Ability Score Modifiers</strong>: Elves are nimble, both in body and mind, but their form is frail. They gain +2 <em>Dexterity</em>, +2 <em>Intelligence</em>, and –2 <em>Constitution</em>.</p>',
    );
    for (const rule of reviewedRaceAbilityTraits)
      expect(
        entry(raceAbilityTraitKey(rule.race)).description,
        rule.race,
      ).toContain(`<p><strong>${rule.heading}</strong>`);
  });

  it('leaves the races whose pinned traits own their ability changes unchanged', () => {
    for (const key of [
      ...ownedByPinnedTrait,
      'pf1/e6IaBxKgMxy1yKlr', // Human
      race.halfElf,
      race.halfOrc,
      'pf1/m1Yvpz1t8S9x4PPr', // Primitive Human
    ]) {
      expect(
        racialTraitsOf(key).filter((candidate) =>
          candidate.startsWith('local/'),
        ),
        key,
      ).toEqual([]);
      expect(
        entry(key).modifiers.filter((modifier) =>
          modifier.target.startsWith('ability.'),
        ),
        key,
      ).toEqual([]);
    }
    // Kitsune and Vine Leshy: the race's racial versions on the pinned trait.
    expect(entry(t.kitsuneAbility).modifiers).toEqual(
      abilityChangesOf(race.kitsune),
    );
    expect(entry(t.vineLeshyAbility).modifiers).toEqual(
      abilityChangesOf(race.vineLeshy),
    );
  });

  it('moves every fixed ability change off the race, so the report keeps no ownerless ability Modifier', () => {
    const relocatedToNewTraits = report().races.flatMap((row) =>
      row.relocatedChanges.filter((change) =>
        change.traits.some((key) => key.startsWith('local/')),
      ),
    );
    expect(relocatedToNewTraits).toHaveLength(
      reviewedRaceAbilityTraits.reduce(
        (sum, rule) => sum + rule.consumes.length,
        0,
      ),
    );
    expect(relocatedToNewTraits).toHaveLength(218);
    expect(
      report().races.flatMap((row) =>
        row.ownerlessModifiers.filter((modifier) =>
          modifier.target.startsWith('ability.'),
        ),
      ),
    ).toEqual([]);
  });

  it('suppresses only the race description heading its new trait stands for', () => {
    expect(raceRow(race.elf)?.unmatchedTraitNames).not.toContain(
      'Ability Score Modifiers',
    );
    // Locathah's heading is "Ability Scores"; Strix's "Ability Score Racial
    // Traits".
    expect(raceRow('pf1/WxPc1Nw2V3ohdl2x')?.unmatchedTraitNames).not.toContain(
      'Ability Scores',
    );
    expect(raceRow('pf1/MF8vCjLIGTmJl3Mo')?.unmatchedTraitNames).not.toContain(
      'Ability Score Racial Traits',
    );
  });

  it('reports the Lashunta Dimorphism adjustments without merging the Sexual Dimorphism trait', () => {
    for (const key of [race.lashuntaFemale, race.lashuntaMale]) {
      expect(racialTraitsOf(key)).toEqual([raceAbilityTraitKey(key)]);
      expect(entry(raceAbilityTraitKey(key)).modifiers).toEqual(
        abilityChangesOf(key),
      );
      expect(
        report().abilityTraits.find((row) => row.race === key)?.note,
      ).toContain('Dimorphism');
    }
    // The Lashunta folder binds no race; its Sexual Dimorphism record keeps
    // no change and grants nothing.
    expect(entry(t.sexualDimorphism).modifiers).toEqual([]);
    expect(entry(t.sexualDimorphism).detail).toMatchObject({ raceKeys: [] });
  });
});

describe('totals', () => {
  it.each([...reviewedRaceAbilityTraits.map((rule) => rule.race)])(
    'keeps the %s totals of the single-entry race, in ordinary play and in every Situation',
    (raceKey) => {
      const before = singleEntryRace(raceKey);
      const situations = [
        ...new Set(
          [before, ...definitions].flatMap((definition) =>
            definition.modifiers.flatMap((modifier) =>
              typeof modifier.condition?.situation === 'string'
                ? [modifier.condition.situation]
                : [],
            ),
          ),
        ),
      ].sort();
      const original = raceSheet({
        race: raceKey,
        definitions: [
          before,
          ...definitions.filter((definition) => definition._id !== raceKey),
        ],
      });
      expect(totals(sheet(raceKey), situations)).toEqual(
        totals(original, situations),
      );
      expect(counting(sheet(raceKey), raceAbilityTraitKey(raceKey))).toBe(true);
    },
  );

  it('lowers the ownerless Modifier count by exactly the relocated ability changes', () => {
    const ownerless = report().summary.ownerlessModifiers;
    // Only non-ability changes no pinned trait owns are left: in this fixture,
    // the natural armor of the races without a trait folder of their own.
    expect(
      report().races.flatMap((row) =>
        row.ownerlessModifiers.map((modifier) => modifier.target),
      ),
    ).toHaveLength(ownerless);
    expect(report().summary.relocatedChanges).toBe(
      218 +
        report().races.reduce(
          (sum, row) =>
            sum +
            row.relocatedChanges.filter(
              (change) =>
                !change.traits.some((key) => key.startsWith('local/')),
            ).length,
          0,
        ),
    );
  });
});

describe('replacement', () => {
  it('resolves Orc Atavism to the half-orc ability score trait, which goes dormant', () => {
    expect(entry(t.orcAtavism).detail).toMatchObject({
      replaces: [
        t.halfOrcAbility,
        t.intimidating,
        t.orcBlood,
        t.orcFerocity,
      ].sort(),
    });
    expect(entry(t.orcAtavism).detail).not.toHaveProperty(
      'unresolvedReplacements',
    );
    const chosen = grantedTraitRow({
      race: race.halfOrc,
      trait: t.halfOrcAbility,
      choice: 'strength',
    });
    expect(scores(sheet(race.halfOrc, [chosen])).strength).toBe(12);
    // "They gain a +2 bonus to Strength and a -2 penalty to one mental
    // ability score of their choice" (ARG p. 212): reviewed rules map its
    // `base` Strength change as racial and its untargeted change as a choice.
    expect(entry(t.orcAtavism).modifiers).toEqual([
      { target: 'ability.str', bonusType: 'racial', value: 2 },
      { target: 'ability.$choice', bonusType: 'racial', value: -2 },
    ]);
    expect(
      entry(t.orcAtavism).unsupported.filter(
        (issue) => issue.field === 'changes',
      ),
    ).toEqual([]);
    const atavism = sheet(race.halfOrc, [
      chosen,
      chosenAlternate(t.orcAtavism, 'wisdom'),
    ]);
    expect(counting(atavism, t.halfOrcAbility)).toBe(false);
    expect(scores(atavism)).toMatchObject({ strength: 12, wisdom: 8 });
    // The same published replacement removes Orc Blood's equivalences,
    // independently of the retained humanoid subtypes on the base race.
    expect(
      calculateCharacterSheet(sheet(race.halfOrc)).racial.countsAsRaces,
    ).toEqual(
      [race.halfOrc, 'pf1/e6IaBxKgMxy1yKlr', 'pf1/JOuAdPAOTat7d5v6'].sort(),
    );
    expect(calculateCharacterSheet(atavism).racial.countsAsRaces).toEqual(
      [race.halfOrc, 'pf1/JOuAdPAOTat7d5v6'].sort(),
    );
  });

  it('resolves Kindred-Raised to the half-elf ability score trait, which goes dormant', () => {
    expect(entry(t.kindredRaised).detail).toMatchObject({
      replaces: [
        t.halfElfAbility,
        t.adaptability,
        t.elvenImmunitiesHalfElf,
        t.keenSensesHalfElf,
        t.multitalented,
      ].sort(),
    });
    const kindred = sheet(race.halfElf, [
      grantedTraitRow({
        race: race.halfElf,
        trait: t.halfElfAbility,
        choice: 'dexterity',
      }),
      chosenAlternate(t.kindredRaised, 'wisdom'),
    ]);
    expect(counting(kindred, t.halfElfAbility)).toBe(false);
    // "They gain a +2 bonus to Charisma and one other ability score of their
    // choice" (Inner Sea Races p. 212): the Charisma change maps, and a
    // reviewed rule makes the untargeted change the choice.
    expect(scores(kindred)).toMatchObject({
      dexterity: 10,
      wisdom: 12,
      charisma: 12,
    });
  });

  it('resolves Witchborn to the changeling ability score trait, so its own adjustments replace it', () => {
    expect(entry(t.witchborn).detail).toMatchObject({
      replaces: [t.changelingAbility],
    });
    expect(scores(sheet(race.changeling))).toMatchObject({
      wisdom: 12,
      charisma: 12,
      constitution: 8,
      intelligence: 10,
    });
    // "+2 bonus to Intelligence and Charisma instead of a +2 bonus to Wisdom
    // and Charisma" (Inner Sea Races p. 215).
    expect(
      scores(sheet(race.changeling, [alternateRow(t.witchborn)])),
    ).toMatchObject({
      wisdom: 10,
      charisma: 12,
      constitution: 8,
      intelligence: 12,
    });
  });

  it("resolves Tree-Born to the gathlain's ability score and speed traits", () => {
    expect(entry(t.treeBorn).detail).toMatchObject({
      replaces: [t.gathlainAbility, t.gathlainSpeed].sort(),
    });
    const treeBorn = sheet(race.gathlain, [alternateRow(t.treeBorn)]);
    expect(counting(treeBorn, t.gathlainAbility)).toBe(false);
    // "They have no Constitution penalty" (Ultimate Wilderness p. 10): the
    // gathlain's +2 Dexterity and +2 Charisma stay. A reviewed rule maps its
    // `base` Dexterity change as racial.
    expect(scores(treeBorn)).toMatchObject({
      dexterity: 12,
      constitution: 10,
      charisma: 12,
    });
  });

  it('resolves each alias through a reviewed rule keyed by the pinned trait', () => {
    expect(
      reviewedTraitNameAliases.map(({ trait: key, names }) => [key, names]),
    ).toEqual([
      [t.halfElfAbility, ['Ability Score Modifiers']],
      [t.halfOrcAbility, ['Ability Score Modifiers']],
      [t.changelingAbility, ['Ability Score Modifiers']],
      [t.gathlainAbility, ['Constitution Penalty']],
      [t.gathlainSpeed, ['Speed']],
    ]);
  });

  it('lets alternates whose own ability changes map replace an ability score trait: Keen Kitsune and Agile (Vine Leshy)', () => {
    // Keen Kitsune (Blood of the Beast p. 12): "+2 bonus to Dexterity and
    // Intelligence instead of Dexterity and Charisma". A reviewed rule maps
    // its untypedPerm changes as racial, as the kitsune's own are.
    expect(entry(t.keenKitsune).detail).toMatchObject({
      replaces: [t.kitsuneAbility],
    });
    const keen = sheet(race.kitsune, [alternateRow(t.keenKitsune)]);
    expect(counting(keen, t.kitsuneAbility)).toBe(false);
    expect(scores(keen)).toMatchObject({
      strength: 8,
      dexterity: 12,
      intelligence: 12,
      charisma: 10,
    });
    // Agile (Ultimate Wilderness p. 21): "Replace the leshy's +2 racial bonus
    // to Constitution with a +2 racial bonus to Dexterity."
    expect(entry(t.agileVineLeshy).detail).toMatchObject({
      replaces: [t.vineLeshyAbility],
    });
    expect(scores(sheet(race.vineLeshy))).toMatchObject({
      constitution: 12,
      wisdom: 12,
      intelligence: 8,
      dexterity: 10,
    });
    expect(
      scores(sheet(race.vineLeshy, [alternateRow(t.agileVineLeshy)])),
    ).toMatchObject({
      constitution: 10,
      wisdom: 12,
      intelligence: 8,
      dexterity: 12,
    });
  });

  it('leaves the elf ability score trait active under Arctic Elf, whose "Base Statistics" is a named combination of alternates', () => {
    expect(entry(t.arcticElf).detail).toMatchObject({
      replaces: [],
      unresolvedReplacements: ['Base Statistics'],
    });
    const arctic = sheet(race.elf, [alternateRow(t.arcticElf)]);
    expect(counting(arctic, raceAbilityTraitKey(race.elf))).toBe(true);
    expect(scores(arctic)).toMatchObject({
      dexterity: 12,
      intelligence: 12,
      constitution: 8,
    });
    expect(
      report().unresolvedAlternates.find(
        (row) => row.externalKey === t.arcticElf,
      ),
    ).not.toHaveProperty('reason');
  });

  it('maps the pinned Angel-Blooded ability line while retaining the complete heritage inventory', () => {
    expect(reviewedAbilityLineSubraces).toHaveLength(37);
    expect(entry(t.angelBlooded).detail).toMatchObject({
      replaces: [raceAbilityTraitKey(race.aasimar)],
    });
    expect(
      report().unresolvedAlternates.find(
        (row) => row.externalKey === t.angelBlooded,
      ),
    ).toBeUndefined();
    const angel = sheet(race.aasimar, [alternateRow(t.angelBlooded)]);
    expect(counting(angel, raceAbilityTraitKey(race.aasimar))).toBe(false);
    expect(scores(angel)).toMatchObject({
      strength: 12,
      wisdom: 10,
      charisma: 12,
    });
  });

  it('replaces Goblin base adjustments with the complete Oversized line and Medium size', () => {
    expect(reviewedUnresolvedAlternates).toEqual([]);
    expect(entry(t.oversizedGoblins).detail).toMatchObject({
      replaces: [raceAbilityTraitKey(race.goblin)],
      size: 'medium',
    });
    const oversized = sheet(race.goblin, [alternateRow(t.oversizedGoblins)]);
    expect(counting(oversized, raceAbilityTraitKey(race.goblin))).toBe(false);
    expect(scores(oversized)).toMatchObject({
      strength: 12,
      dexterity: 12,
      charisma: 8,
    });
  });

  // #740 covers both formerly missing conditions with the authentic #400
  // Devil-Spawn overlay in race-import-740.test.ts: curated ability Modifiers
  // enable a heritage's Base Statistics to replace its derived local trait.
  // Arctic Elf remains the source-backed unresolved negative control.
  // No authentic multi-race Base Statistics folder exists in the current pin.
});

describe('identity', () => {
  it('keys each new trait by its race identity, distinct from every pinned record identity', () => {
    const key = raceAbilityTraitKey(race.elf);
    expect(key).toBe('local/race-ability-scores/pf1/NgIhxRI0axrf3fcO');
    expect(key).not.toMatch(/^(pf1|pf1-content)\/[A-Za-z0-9]+$/);
    const pinned = new Set(
      provenance.rawSources.map(
        (source) =>
          `${source.repo}/${String(/([A-Za-z0-9]+)\.yaml$/.exec(source.path)?.[1])}`,
      ),
    );
    for (const rule of reviewedRaceAbilityTraits)
      expect(pinned.has(raceAbilityTraitKey(rule.race))).toBe(false);
  });

  it('re-imports deterministically', async () => {
    const again = await importCatalog(inputs);
    expect(JSON.stringify(again.catalog)).toBe(
      JSON.stringify(artifact.catalog),
    );
  });

  it('follows a reviewed race remap, so the retained race keeps its trait', async () => {
    const retained = 'pf1/retainedElf0721';
    const moved = await importCatalog({
      ...inputs,
      remaps: [
        {
          from: race.elf,
          to: retained,
          kind: 'race',
          reason:
            'Identity mechanics check: a reviewed move of the pinned race.',
          evidence: 'tests/catalog/race-ability-721.test.ts',
          reviewedBy: 'test',
          reviewedOn: '2026-10-08',
        },
      ],
    });
    expect(racialTraitsOf(retained, moved)).toContain(
      raceAbilityTraitKey(retained),
    );
    expect(entry(raceAbilityTraitKey(retained), moved)).toMatchObject({
      upstreamKey: race.elf,
      detail: { raceKeys: [retained] },
    });
    expect(entry('pf1-content/rzYk40R1rWSfay4a', moved).countsAsRaces).toEqual(
      [retained, 'pf1/e6IaBxKgMxy1yKlr'].sort(),
    );
  });

  it('keeps the reviewed race curation records binding', () => {
    expect(artifact.curation.stale).toEqual([]);
  });
});

describe('attribution', () => {
  it('takes notice holds from the race record', () => {
    // Green Martian cites the Dynamite Worldscape comic (DYN0032-E).
    const key = raceAbilityTraitKey(race.greenMartian);
    const holds = (externalKey: string) =>
      entry(externalKey).unsupported.filter(
        (issue) => issue.field === 'attribution',
      );
    expect(holds(race.greenMartian)).not.toEqual([]);
    expect(holds(key)).toEqual(holds(race.greenMartian));
  });

  it("takes its race's Attribution Assessment, so it is held for the race's reason", () => {
    const gate = assessWithUnclearedHolds({ artifact, ...reviewedAdmission });
    expect(gate.admitted).toEqual([]);
    const held = new Map(gate.held.map((row) => [row.externalKey, row]));
    // The Gnoll's #328 assessment is unresolved; its trait has none of its
    // own and is held with the Gnoll's row.
    const {
      externalKey: _race,
      name: _raceName,
      ...gnoll
    } = held.get(race.gnoll) ?? {};
    expect(gnoll).toMatchObject({
      reason: expect.stringMatching(
        /^race-328-whole-content-ITHs6VCRdSQUsoen: /,
      ),
      requiredNotices: ['PZO1112'],
      evidence: ['race-328-ITHs6VCRdSQUsoen', 'races-328-notice-review'],
    });
    expect(held.get(raceAbilityTraitKey(race.gnoll))).toEqual({
      externalKey: raceAbilityTraitKey(race.gnoll),
      name: 'Ability Score Modifiers (Gnoll)',
      ...gnoll,
    });
    // Green Martian's notice hold is the race's.
    expect(held.get(raceAbilityTraitKey(race.greenMartian))?.reason).toBe(
      'Known notice/evidence hold (#227/#241); unavailable for new release admission.',
    );
    for (const rule of reviewedRaceAbilityTraits)
      expect(
        held.get(raceAbilityTraitKey(rule.race))?.evidence,
        rule.race,
      ).not.toEqual([]);
    expect(
      gate.failures.filter((row) => row.externalKey.startsWith('local/')),
    ).toEqual([]);
  });

  it('refuses an attribution owner that is not the race granting the trait', () => {
    const traitKey = raceAbilityTraitKey(race.gnoll);
    const withOwner = (attributionFrom: string, externalKey = traitKey) => ({
      ...artifact,
      catalog: {
        ...artifact.catalog,
        entries: artifact.catalog.entries.map((row) =>
          row.externalKey === traitKey
            ? { ...row, externalKey, attributionFrom }
            : row,
        ),
      },
    });
    const reason =
      'Invalid attribution owner: not the race that grants this reviewed ability score trait.';
    for (const [label, candidate] of [
      // A Racial Trait record, not a race.
      ['non-race', withOwner(t.halfOrcAbility)],
      // Another race, which does not grant the Gnoll's trait.
      ['foreign race', withOwner(race.elf)],
      // A key outside the reviewed ability score trait identities.
      [
        'foreign key',
        withOwner(race.gnoll, 'local/other/pf1/ITHs6VCRdSQUsoen'),
      ],
    ] as const) {
      const gate = assessWithUnclearedHolds({
        artifact: candidate,
        ...reviewedAdmission,
      });
      const key =
        label === 'foreign key' ? 'local/other/pf1/ITHs6VCRdSQUsoen' : traitKey;
      expect(gate.failures, label).toContainEqual({ externalKey: key, reason });
      expect(
        [...gate.admitted, ...gate.held].some((row) => row.externalKey === key),
        label,
      ).toBe(false);
    }
  });

  it('is bound through its race: a confirmed race assessment reaches the trait unchanged', () => {
    // Identity mechanics check: the Gnoll's real assessment row, re-bound to
    // the current race content and marked confirmed. No assessment is written.
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === race.gnoll,
    );
    if (!assessment) throw new Error('Missing Gnoll assessment');
    const binding = buildAssessmentBinding({
      entry: entry(race.gnoll),
      artifact,
      ...reviewedAdmission,
      requiredNotices: assessment.requiredNotices,
      evidenceIds: Object.keys(assessment.evidenceFingerprints),
    });
    const gate = assessWithUnclearedHolds({
      artifact,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row === assessment
          ? { ...row, ...binding, status: 'confirmed' as const }
          : row,
      ),
    });
    const held = new Map(gate.held.map((row) => [row.externalKey, row]));
    // The trait passes the race's content binding and stops where the race
    // does: Bestiary's uncleared chain holds (its PRD record is reviewed).
    for (const key of [race.gnoll, raceAbilityTraitKey(race.gnoll)])
      expect(held.get(key)?.reason, key).toMatch(/^Notice holds: PZO1112 \(/);
  });
});

describe('changed pinned records', () => {
  // A copy of the fixture with two upstream edits, as a later pin could make.
  const work = resolve('.scratch/race-ability-721/test-work');
  let changed: Artifact;
  beforeAll(async () => {
    await mkdir(work, { recursive: true });
    const root = await mkdtemp(join(work, 'changed-'));
    await cp(fixtureRoot, root, { recursive: true });
    // The Goblin's +4 Dexterity becomes +2.
    const file = join(root, 'pf1/packs/races/goblin.bOv30pyHB1gFbSTj.yaml');
    const text = await readFile(file, 'utf8');
    const from = "formula: '4'\n      target: dex";
    expect(text).toContain(from);
    await writeFile(
      file,
      text.replace(from, "formula: '2'\n      target: dex"),
    );
    // Witchborn's −2 Constitution takes a type the importer cannot map.
    const witchborn = join(
      root,
      'pf1-content/src/pf-racial-traits/Witchborn_zl9Eo1R5aLckDvaj.yaml',
    );
    const witchbornText = await readFile(witchborn, 'utf8');
    const con = 'target: con\n      type: untyped';
    expect(witchbornText).toContain(con);
    await writeFile(
      witchborn,
      witchbornText.replace(con, 'target: con\n      type: untypedPerm'),
    );
    changed = await importCatalog({
      ...inputs,
      systemPath: join(root, 'pf1'),
      contentPath: join(root, 'pf1-content'),
    });
  });
  afterAll(async () => {
    await rm(work, { recursive: true, force: true });
  });

  it('leaves an alternate unresolved unless every one of its own ability changes maps', () => {
    // Its Intelligence and Charisma changes still map; its Constitution one
    // does not, so the changeling's trait must not go dormant.
    expect(entry(t.witchborn, changed).detail).toMatchObject({
      replaces: [],
      unresolvedReplacements: ['Ability Score Modifiers'],
    });
    expect(
      report(changed).unresolvedAlternates.find(
        (row) => row.externalKey === t.witchborn,
      ),
    ).toMatchObject({
      reason:
        'its own ability changes do not map to Modifiers; resolves once they are reviewed or curated as Modifiers',
    });
  });

  it('reports a rule whose race changes no longer match, and leaves the changes on the race', () => {
    expect(
      report(changed).abilityTraits.find((row) => row.race === race.goblin),
    ).toMatchObject({
      status: 'stale',
      reason: 'The race record no longer has the reviewed ability changes.',
    });
    expect(
      racialTraitsOf(race.goblin, changed).filter((key) =>
        key.startsWith('local/'),
      ),
    ).toEqual([]);
    expect(
      changed.catalog.entries.some(
        (row) => row.externalKey === raceAbilityTraitKey(race.goblin),
      ),
    ).toBe(false);
    expect(
      entry(race.goblin, changed).modifiers.filter((modifier) =>
        modifier.target.startsWith('ability.'),
      ),
    ).toHaveLength(3);
    expect(entry(race.goblin, changed).unsupported).toContainEqual(
      expect.objectContaining({ field: 'raceAbilityTrait' }),
    );
  });
});
