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
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
import {
  draftCatalogCurationWithReport,
  importCatalog,
} from '../../scripts/catalog/import';
import {
  applyCuration,
  collectCurationInputs,
  collectDescriptionInputs,
  parseCuration,
} from '../../scripts/catalog/curation';
import { mapEntry, upstreamRecord } from '../../scripts/catalog/map';
import { raceAbilityTraitKey } from '../../scripts/catalog/racial-trait-rules';
import type { LoadedRecord } from '../../scripts/catalog/records';
import {
  calculateCharacterSheet,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from '../../src/lib/character-sheet';
import { satisfiesRacialPrerequisite } from '../../src/lib/character-sheet-racial';
import provenance from '../fixtures/racial-traits-719/provenance.json';
import {
  alternateRow,
  grantedTraitRow,
  raceSheet,
  sheetDefinition,
} from '../fixtures/racial-traits-719/sheet';

// Pinned Foundry PF1 v11.11 and pf1-content 11.4.0 records: the seven Core
// Rulebook races and the Orc (Advanced Race Guide p. 139, per PCGen), their
// standard Racial Traits and ten published alternates; the races whose reviewed
// description outputs move onto a trait, Drow's shared note and Lashunta
// (Female). See the fixture README.
const fixtureRoot = resolve('tests/fixtures/racial-traits-719');
const inputs = {
  systemPath: join(fixtureRoot, 'pf1'),
  contentPath: join(fixtureRoot, 'pf1-content'),
  remaps: [],
  curation,
};
const race = {
  human: 'pf1/e6IaBxKgMxy1yKlr',
  elf: 'pf1/NgIhxRI0axrf3fcO',
  dwarf: 'pf1/nEltI9y37rKJTeWo',
  gnome: 'pf1/efwHEwjvL9Z94MJI',
  halfElf: 'pf1/cCepRrfH5SalFfT4',
  halfOrc: 'pf1/dCAXgdA6Db1Z3ccz',
  halfling: 'pf1/Hf31mrYb3uucNyLO',
  orc: 'pf1/JOuAdPAOTat7d5v6',
} as const;
// Pinned races whose reviewed #328 outputs move onto a standard trait.
const otherRace = {
  kitsune: 'pf1/GAoJIy6ycj3OovQT',
  svirfneblin: 'pf1/fX9F2amW2BcYoHwb',
  wayang: 'pf1/Vaf5bV3wpk24pVt2',
  ghoran: 'pf1/2mWMyKiPWk6Y8cNx',
  changeling: 'pf1/9FBT6uqlRgaw9gug',
  grindylow: 'pf1/Lt4ZP5GCinGvTfnF',
  cecaelia: 'pf1/NhEPoXIZWOOunSH7',
  nagaji: 'pf1/ZVzH0qb1Tqety6fU',
  reptoid: 'pf1/YCCdi4OEC4WuzelM',
  drow: 'pf1/yLaDS5HGbwtgpkbP',
} as const;
const lashuntaFemale = 'pf1/7aDvyO68K8hm58Qm';
const trait = (id: string) => `pf1-content/${id}`;
const t = {
  humanAbility: trait('BFszTUJLlDS1ZDB8'),
  bonusFeat: trait('uAJ9hLZYdH2JX7J8'),
  skilled: trait('LwDcZanOEHqVaYoh'),
  halfElfAbility: trait('orOAYDkNl4pqYWA4'),
  halfOrcAbility: trait('VHmuEYXmx81Q5EmC'),
  adaptability: trait('wZZzaSmiF8hTuRo7'),
  multitalented: trait('srOpqbXesXBuvTqe'),
  elfBlood: trait('rzYk40R1rWSfay4a'),
  orcBlood: trait('JWzMBJeAQYDav9gw'),
  keenSensesElf: trait('WOF6A7695wxFO2ie'),
  hardy: trait('AO5nhhUfI1b4M37H'),
  gnomeMagic: trait('MiPbhGqPRX7H4C7a'),
  fearless: trait('qoCLqjadKmJEN9R7'),
  halflingLuck: trait('HVI7FNwj2ng10qtj'),
  halfOrcFamiliarity: trait('sFlDW97gf1FHn217'),
  dualTalent: trait('SRBfqkzIldwETAHB'),
  urbanite: trait('SyXfxr53mzenpNu5'),
  stubborn: trait('eew9hWENxwAiLP8S'),
  pyromaniac: trait('URpcaP1vfemHJyal'),
  arcaneTraining: trait('v6db0gftaAJKUfvK'),
  dualMinded: trait('DEowtAtiVIQOh2dj'),
  cityRaised: trait('tC0JCXIRZK9tEoMm'),
  craven: trait('45xNKgDQ3SvKpW58'),
  smeller: trait('uXWtABSsuB1zn67j'),
  arcticElf: trait('S2NJixZYq3fBtPig'),
  shadowMagic: trait('XixpDZG7W0XELNni'),
  drowImmunities: trait('Yfywu8kU3UraGzlN'),
  drowPoisonUse: trait('fUAqkTyumLnQrGch'),
};
const skillFocus = 'pf1/7zJTztNW7hdaqjKc';
// #388 checked Stonecunning (Dwarf)'s own skill.per note record with the
// Dwarf race note's outputs, so a full import reports that race record stale.
const supersededRecords = [
  ['pf1-content/gwRHgXExczYgcJOA', 'skill.ste'],
  ['pf1/nEltI9y37rKJTeWo', 'skill.per'],
];
const staleKeys = (records: { externalKey: string; target?: string }[]) =>
  records.map((record) => [record.externalKey, record.target]);
/**
 * Dual Talent, which the player resolved to the three human traits it names
 * Manual replacement selections remain supported alongside mapped defaults.
 */
const dualTalent: SheetEntry = {
  _id: `alternate:${t.dualTalent}`,
  kind: 'racialTrait',
  active: true,
  catalogEntryId: t.dualTalent,
  state: {
    kind: 'racialTrait',
    replaces: [t.humanAbility, t.skilled, t.bonusFeat],
  },
};

type Artifact = Awaited<ReturnType<typeof importCatalog>>;
let artifact: Artifact;
let definitions: CharacterSheetCatalogEntry[];
beforeAll(async () => {
  artifact = await importCatalog(inputs);
  definitions = artifact.catalog.entries
    .filter((entry) => entry.detail.kind !== 'item')
    .map(sheetDefinition);
});

function entry(key: string) {
  const found = artifact.catalog.entries.find((row) => row.externalKey === key);
  if (!found) throw new Error(`Missing fixture entry ${key}`);
  return found;
}
function sheet(raceKey: string, entries: SheetEntry[] = []) {
  return raceSheet({ race: raceKey, definitions, entries });
}
function calculate(input: CharacterSheetInput, situations: string[] = []) {
  return calculateCharacterSheet(input, { situations });
}
function counting(input: CharacterSheetInput, key: string) {
  return calculate(input).resolvedEntries.find(
    (row) =>
      row.entry.kind === 'racialTrait' && row.entry.catalogEntryId === key,
  );
}

/**
 * The race as #328 imported it: one entry carrying every mapped change and
 * every reviewed race note and description output, with no Racial Traits.
 */
async function singleEntryRace(key: string) {
  const id = key.slice(4);
  const file = (await readdir(join(inputs.systemPath, 'packs/races'))).find(
    (name) => name.endsWith(`.${id}.yaml`),
  );
  if (!file) throw new Error(`Missing race fixture ${key}`);
  const source: LoadedRecord = {
    repo: 'pf1',
    pack: 'races',
    path: `packs/races/${file}`,
    record: upstreamRecord.parse(
      parse(
        await readFile(join(inputs.systemPath, 'packs/races', file), 'utf8'),
      ),
    ),
  };
  const mapped = mapEntry({
    source,
    kind: 'race',
    resolveKey: (value) => value,
    lookup: new Map(),
    spellClassTags: new Set(),
  });
  const data = parseCuration(curation);
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
    data,
    entries: [mapped],
  });
  return sheetDefinition({
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
function situationsOf(definition: CharacterSheetCatalogEntry) {
  return definition.modifiers.flatMap((modifier) =>
    typeof modifier.condition?.situation === 'string'
      ? [modifier.condition.situation]
      : [],
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

describe('standard Racial Trait Grants', () => {
  // The pinned `<Race>/Standard` folders, by record ID (ep-orch/research/719.md §1).
  const standard = {
    [race.human]: [
      'BFszTUJLlDS1ZDB8',
      'eNIYJNbM6UL7OdyE',
      'LwDcZanOEHqVaYoh',
      'uAJ9hLZYdH2JX7J8',
    ],
    [race.elf]: [
      'bRO90tmeaH1tFi2g',
      'GS07eqHZBCT979tA',
      'IuApwtNYMYMTabOZ',
      'WOF6A7695wxFO2ie',
      'X3ixmmB9S07XqKNX',
      'yQvZ03xcsuM8b595',
    ],
    [race.dwarf]: [
      '2F4IRW8AAicQ3VYc',
      '6JCG0ei0s0ossrtx',
      'ACFSI8aOJAYr89QM',
      'AO5nhhUfI1b4M37H',
      'GfQrx1OHTdOIVAWb',
      'iBCPIWFExt679Zhh',
      'JsvoElxHBPdle8s8',
      'JtJKg8vV58UJ6m1m',
      'rBKJCVwy3X2VjFdU',
      'T4PaZ33R29gTAFaT',
    ],
    [race.gnome]: [
      'FD2SILZXcIMjauvr',
      'ikQ2BoHJlx4zYGvB',
      'IQ5vHUbNbGqVaVV5',
      'L4yOFpviuO9WvCyT',
      'LcZE7cPw87DMzJYl',
      'MiPbhGqPRX7H4C7a',
      'mPD0yR9P3IGAC6nJ',
      'Pe7olUqkJIbDGl4q',
      'YHwpeek5IHtcZNDF',
      'ZaTEe0kZxKJuYYjT',
    ],
    [race.halfElf]: [
      '1HOWCThotIz5ztx0',
      '3HbUyHrEVeDiTH1d',
      'I8Zy5iy8HpAxBZQb',
      'orOAYDkNl4pqYWA4',
      'oTQL4P3IdoJQAkOB',
      'rzYk40R1rWSfay4a',
      'srOpqbXesXBuvTqe',
      'wZZzaSmiF8hTuRo7',
    ],
    [race.halfOrc]: [
      'iB5aNUyJPWjxx3tx',
      'JWzMBJeAQYDav9gw',
      'OyIvyI3x7V5HIzZL',
      'sFlDW97gf1FHn217',
      'UawXK40Ix4vmfMkY',
      'VHmuEYXmx81Q5EmC',
      'xeEmYqR3IUXoby9x',
    ],
    [race.halfling]: [
      'cOod8wThcNc0expZ',
      'HVI7FNwj2ng10qtj',
      'qoCLqjadKmJEN9R7',
      'sSs0BK09PLxjbkAa',
      'XVo4DApULZaETYcz',
      'xwr9DBDmvGMYHcut',
      'YMocjN3SlwHoQgW1',
    ],
    [race.orc]: [
      'emWoMvZJYkXOz6ot',
      'JlymGAKiie1gmqI2',
      'l7CqdrmNxsmEsBBG',
      'n4wxE73ZItt77fLt',
      'nQ9j793ikC9orJQA',
      'oKbTIUKJkGwFDHXu',
    ],
  };

  // The races here whose fixed ability changes no pinned trait owns
  // (ep-orch/research/721.md §1).
  const withAbilityTrait = new Set<string>([
    race.elf,
    race.dwarf,
    race.gnome,
    race.halfling,
    race.orc,
  ]);
  it.each(Object.entries(standard))(
    'links %s to exactly its Standard-folder trait records, which count through the resolver',
    (raceKey, ids) => {
      const detail = entry(raceKey).detail;
      expect(detail.kind).toBe('race');
      const keys = detail.kind === 'race' ? (detail.racialTraits ?? []) : [];
      // #721: plus the race's reviewed ability score trait, where it has one.
      expect([...keys].sort()).toEqual(
        [
          ...ids.map(trait),
          ...(withAbilityTrait.has(raceKey)
            ? [raceAbilityTraitKey(raceKey)]
            : []),
        ].sort(),
      );
      for (const key of keys)
        expect(entry(key).detail).toMatchObject({
          kind: 'racialTrait',
          raceKeys: [raceKey],
          standard: true,
          replaces: [],
        });
      const result = calculate(sheet(raceKey));
      expect(
        result.resolvedEntries
          .filter((row) => row.entry.kind === 'racialTrait' && row.counting)
          .map((row) =>
            row.entry.kind === 'racialTrait' ? row.entry.catalogEntryId : '',
          )
          .sort(),
      ).toEqual([...keys].sort());
    },
  );

  it('reports trait names with no pinned record, and moves fixed ability Modifiers onto the reviewed ability score trait', () => {
    const report = artifact.catalog.racialTraits;
    const row = (key: string) =>
      report?.races.find((candidate) => candidate.externalKey === key);
    // Elf has no ability score trait record: #721's reviewed trait carries its
    // fixed changes.
    expect(row(race.elf)).toMatchObject({
      unmatchedTraitNames: ['Type', 'Size', 'Base Speed'],
      ownerlessModifiers: [],
      unlinkedStandardTraits: [],
      overlaps: [],
    });
    expect(entry(raceAbilityTraitKey(race.elf)).modifiers).toEqual([
      { target: 'ability.dex', bonusType: 'racial', value: 2 },
      { target: 'ability.int', bonusType: 'racial', value: 2 },
      { target: 'ability.con', bonusType: 'racial', value: -2 },
    ]);
    // Human's ability score trait is the reviewed +2 choice.
    expect(row(race.human)).toMatchObject({
      unmatchedTraitNames: ['Type', 'Size', 'Base Speed'],
      ownerlessModifiers: [],
    });
    expect(row(race.orc)?.ownerlessModifiers).toEqual([]);
    expect(entry(raceAbilityTraitKey(race.orc)).modifiers).toHaveLength(4);
    // Skilled owns the complete Stealth benefit. Stonework Perception is a
    // separate simultaneous fact, still reported against the ordinary bonus.
    expect(row(otherRace.svirfneblin)?.overlaps).toEqual([
      { target: 'skill.per', trait: trait('gwRHgXExczYgcJOA') },
    ]);
    expect(report?.summary).toMatchObject({
      races: 19,
      // #721: Lashunta (Female) now grants its reviewed ability score trait.
      racesWithTraits: 19,
      // 151 pinned standard traits and 14 reviewed ability score traits.
      linkedTraits: 165,
      unlinkedStandardTraits: 0,
      overlaps: 1,
      // #388: Stonecunning (Dwarf)'s own checked note record supersedes the
      // Dwarf race's skill.per note record.
      staleNotes: 1,
      alternates: 10,
      alternatesFullyResolved: 9,
      descriptionRehomes: { applied: 11, stale: 0, unused: 0 },
      abilityTraits: { applied: 14, stale: 0, unused: 58 },
    });
  });

  it('gives a race without a trait folder of its own name a reason', () => {
    expect(
      artifact.catalog.racialTraits?.races.find(
        (row) => row.externalKey === lashuntaFemale,
      ),
    ).toMatchObject({
      // #721: its only Racial Trait is its reviewed ability score trait.
      racialTraits: [raceAbilityTraitKey(lashuntaFemale)],
      unlinkedReason:
        'No race folder is named "Lashunta (Female)"; the "Lashunta" folder binds only a race of exactly that name.',
    });
    expect(
      artifact.catalog.racialTraits?.races.filter((row) => row.unlinkedReason),
    ).toHaveLength(1);
  });
});

describe('relocated Modifiers', () => {
  it('keeps the Human ability trait when a changed Dual Talent record no longer supplies both choices', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dual-source-drift-'));
    try {
      await cp(fixtureRoot, root, { recursive: true });
      const path = join(
        root,
        'pf1-content/src/pf-racial-traits/Dual_Talent_SRBfqkzIldwETAHB.yaml',
      );
      const raw = parse(await readFile(path, 'utf8'));
      raw.system.changes.pop();
      await writeFile(path, JSON.stringify(raw));
      const changed = await importCatalog({
        ...inputs,
        systemPath: join(root, 'pf1'),
        contentPath: join(root, 'pf1-content'),
      });
      expect(
        changed.catalog.entries.find(
          (entry) => entry.externalKey === t.dualTalent,
        )?.detail,
      ).toMatchObject({
        replaces: [],
        unresolvedReplacements: [
          '+2 to One Ability Score',
          'Bonus Feat',
          'Skilled',
        ],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it('Dual Talent grants two different +2 choices and replaces the ordinary Human choice, Bonus Feat and Skilled', () => {
    const alternate = alternateRow(t.dualTalent);
    const input = sheet(race.human, [
      grantedTraitRow({
        race: race.human,
        trait: t.humanAbility,
        choice: 'constitution',
      }),
      {
        ...alternate,
        state: {
          kind: 'racialTrait',
          choice: 'strength',
          secondChoice: 'dexterity',
        },
      },
    ]);
    const result = calculate(input);
    expect(result.abilities.strength.score).toBe(12);
    expect(result.abilities.dexterity.score).toBe(12);
    expect(result.abilities.constitution.score).toBe(10);
    expect(result.racial.bonusSkillRanksPerLevel).toBe(0);
    for (const key of [t.humanAbility, t.bonusFeat, t.skilled])
      expect(
        result.resolvedEntries.find(
          (row) =>
            row.entry.kind === 'racialTrait' &&
            row.entry.catalogEntryId === key,
        )?.counting,
      ).toBe(false);
    const duplicate = calculate(
      sheet(race.human, [
        {
          ...alternate,
          state: {
            kind: 'racialTrait',
            choice: 'strength',
            secondChoice: 'strength',
          },
        },
      ]),
    );
    expect(duplicate.abilities.strength.score).toBe(12);
    expect(
      duplicate.warnings.some(
        (warning) => warning.check === 'racialAbilityScoreDistinct',
      ),
    ).toBe(true);
    expect(
      calculate(
        sheet(race.human, [
          grantedTraitRow({
            race: race.human,
            trait: t.humanAbility,
            choice: 'constitution',
          }),
        ]),
      ).abilities.constitution.score,
    ).toBe(12);
  });
  it('Skilled owns the complete Svirfneblin Stealth benefit, including its actual local underground Situation', () => {
    const skilled = trait('gwRHgXExczYgcJOA');
    const input = sheet(otherRace.svirfneblin);
    const ordinary = calculateCharacterSheet(input);
    const underground = ordinary.breakdowns['skill.ste'].conditional.find(
      (modifier) =>
        typeof modifier.condition?.situation === 'object' &&
        'local' in modifier.condition.situation &&
        modifier.condition.situation.local === 'underground',
    );
    if (
      !underground ||
      typeof underground.condition?.situation !== 'object' ||
      !('local' in underground.condition.situation)
    )
      throw new Error('Missing actual underground Situation');
    const situations = [
      {
        ...underground.condition.situation,
        sheetEntryId: underground.sheetEntryId,
      },
    ];
    // Dex 12, Small +4 Stealth, Skilled +2 (improves to +4 underground).
    expect(ordinary.breakdowns['skill.ste'].total).toBe(7);
    expect(
      calculateCharacterSheet(input, { situations }).breakdowns['skill.ste']
        .total,
    ).toBe(9);
    const granted = ordinary.resolvedEntries.find(
      (row) =>
        row.entry.kind === 'racialTrait' &&
        row.entry.catalogEntryId === skilled,
    );
    if (granted?.entry.kind !== 'racialTrait')
      throw new Error('Missing Skilled Grant');
    expect(underground.sheetEntryId).toBe(granted.entry._id);
    const inactive = {
      ...input,
      entries: [...input.entries, { ...granted.entry, active: false }],
    };
    expect(
      calculateCharacterSheet(inactive, { situations }).breakdowns['skill.ste']
        .total,
    ).toBe(5);
    const replacement = alternateRow('table-replacement');
    const replaced = {
      ...input,
      entries: [...input.entries, replacement],
      catalogEntries: [
        ...input.catalogEntries,
        {
          _id: 'table-replacement',
          ruleIdentity: 'table-replacement',
          modifiers: [],
          detail: {
            kind: 'racialTrait' as const,
            raceEntryIds: [otherRace.svirfneblin],
            replaces: [skilled],
          },
        },
      ],
    };
    expect(
      calculateCharacterSheet(replaced, { situations }).breakdowns['skill.ste']
        .total,
    ).toBe(5);
    // The distinct stonework Perception fact stays on the race.
    expect(
      calculateCharacterSheet(replaced).breakdowns['skill.per'].conditional,
    ).toEqual(expect.arrayContaining([expect.objectContaining({ value: 2 })]));
    expect(
      calculateCharacterSheet(input, { situations }).breakdowns['skill.ste']
        .total,
    ).toBe(9);
  });
  it.each(Object.entries({ ...race, ...otherRace }))(
    'keeps the %s totals of the single-entry race, in ordinary play and in every Situation',
    async (_name, raceKey) => {
      const before = await singleEntryRace(raceKey);
      const after = sheet(raceKey);
      const situations = [
        ...new Set(
          [before, ...definitions].flatMap((definition) =>
            situationsOf(definition),
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
      expect(totals(after, situations)).toEqual(totals(original, situations));
      // Nothing that moved stays on the race as well.
      const moved = entry(raceKey).modifiers;
      expect(moved.length).toBeLessThanOrEqual(before.modifiers.length);
    },
  );

  it('keeps Fearless stacking with Halfling Luck after they become two traits', () => {
    const halfling = sheet(race.halfling);
    expect(calculate(halfling).breakdowns['save.will'].total).toBe(1);
    expect(calculate(halfling, ['fear']).breakdowns['save.will'].total).toBe(3);
    // Craven (ARG p. 62) replaces both: neither bonus remains, and Craven's
    // own -2 against fear effects (checked in #388) applies instead.
    const craven = sheet(race.halfling, [alternateRow(t.craven)]);
    expect(calculate(craven).breakdowns['save.will'].total).toBe(0);
    expect(calculate(craven, ['fear']).breakdowns['save.will'].total).toBe(-2);
    expect(calculate(craven).breakdowns.init.total).toBe(1);
  });

  it('counts the Gnome illusion DC once, on Gnome Magic, so Pyromaniac removes it', () => {
    const contributions = (input: CharacterSheetInput) => {
      const statistic = calculate(input).breakdowns.spellDC;
      return [
        ...statistic.applied,
        ...statistic.conditional,
        ...(statistic.excluded ?? []),
      ].map((modifier) => ({
        entry: modifier.catalogEntryId,
        value: modifier.value,
        school: modifier.condition?.school,
      }));
    };
    expect(contributions(sheet(race.gnome))).toEqual([
      { entry: t.gnomeMagic, value: 1, school: 'illusion' },
    ]);
    expect(
      entry(race.gnome).modifiers.some((row) => row.target === 'spellDC'),
    ).toBe(false);
    // The trait's own raw `dc.school.ill` change is covered, not unmapped.
    expect(
      entry(t.gnomeMagic).unsupported.filter(
        (issue) => issue.field === 'changes',
      ),
    ).toEqual([]);
    // Pyromaniac (ARG p. 33) replaces Gnome Magic and Illusion Resistance.
    expect(
      contributions(sheet(race.gnome, [alternateRow(t.pyromaniac)])),
    ).toEqual([]);
  });

  // Each reviewed description re-home: the race, its trait record and the raw
  // target of the trait change or note the moved output supersedes.
  it.each<[string, string, string, 'spellDC' | 'ac.natural', string]>([
    [
      'Kitsune Magic',
      otherRace.kitsune,
      'YLr7f3djG85wvbAT',
      'spellDC',
      'dc.school.enc',
    ],
    [
      'Svirfneblin Magic',
      otherRace.svirfneblin,
      'Jnw41wF4ln2vH7d8',
      'spellDC',
      'dc.school.ill',
    ],
    [
      'Shadow Magic (Wayang)',
      otherRace.wayang,
      'XixpDZG7W0XELNni',
      'spellDC',
      'dc.school.ill',
    ],
    [
      'Ghoran natural armor',
      otherRace.ghoran,
      'DLslPcoXcnvQjIPH',
      'ac.natural',
      'nac',
    ],
    [
      'Changeling natural armor',
      otherRace.changeling,
      'Qx1JqPVW0quaOGfY',
      'ac.natural',
      'nac',
    ],
    [
      'Grindylow natural armor',
      otherRace.grindylow,
      'ttCN9QWoKGpAXX4H',
      'ac.natural',
      'nac',
    ],
    [
      'Cecaelia natural armor',
      otherRace.cecaelia,
      'v5Uff6XAqbnWbk4j',
      'ac.natural',
      'nac',
    ],
    [
      'Nagaji Armored Scales',
      otherRace.nagaji,
      'xoItsNqchG4wE6OG',
      'ac.natural',
      'nac',
    ],
    [
      'Reptoid Scales',
      otherRace.reptoid,
      'gh1taO4CBM237eMu',
      'ac.natural',
      'nac',
    ],
  ])(
    'moves the reviewed %s output onto its trait and counts it once',
    (_name, raceKey, id, target, superseded) => {
      const statistic = calculate(sheet(raceKey)).breakdowns[target];
      expect(
        [
          ...statistic.applied,
          ...statistic.conditional,
          ...(statistic.excluded ?? []),
        ].map((modifier) => modifier.catalogEntryId),
      ).toEqual([trait(id)]);
      expect(
        entry(raceKey).modifiers.some((row) => row.target === target),
      ).toBe(false);
      // The superseded raw change or note is neither mapped nor required.
      expect(
        entry(trait(id)).unsupported.filter(
          (issue) =>
            typeof issue.value === 'object' &&
            issue.value !== null &&
            'target' in issue.value &&
            issue.value.target === superseded,
        ),
      ).toEqual([]);
      expect(
        artifact.curation.missing.filter(
          (input) => input.externalKey === trait(id),
        ),
      ).not.toContainEqual(expect.objectContaining({ target: superseded }));
    },
  );

  it("moves Kitsune's mapped ability changes onto its ability trait, whose own untypedPerm versions do not map", () => {
    const abilities = trait('6yUgkL8nRaoWTl41');
    expect(entry(abilities).modifiers).toEqual([
      { target: 'ability.dex', bonusType: 'racial', value: 2 },
      { target: 'ability.cha', bonusType: 'racial', value: 2 },
      { target: 'ability.str', bonusType: 'racial', value: -2 },
    ]);
    expect(
      entry(otherRace.kitsune).modifiers.filter((modifier) =>
        modifier.target.startsWith('ability.'),
      ),
    ).toEqual([]);
  });

  it('re-homes a race note several traits share onto the trait whose note states its numbers', () => {
    // Drow Immunities notes +2 against enchantments; Poison Use (Drow) notes no
    // number.
    const saves = (key: string) =>
      entry(key).modifiers.filter((modifier) => modifier.target === 'saves');
    expect(saves(t.drowImmunities)).not.toEqual([]);
    expect(saves(t.drowPoisonUse)).toEqual([]);
    expect(saves(otherRace.drow)).toEqual([]);
    expect(
      artifact.catalog.racialTraits?.races.find(
        (row) => row.externalKey === otherRace.drow,
      ),
    ).toMatchObject({
      rehomedNotes: [{ target: 'allSavingThrows', trait: t.drowImmunities }],
      staleNotes: [],
    });
  });

  it('reports a re-homed output whose trait is outside the extraction', async () => {
    const bounded = await importCatalog({
      ...inputs,
      candidateKeys: [race.dwarf],
    });
    const dwarf = bounded.catalog.entries.find(
      (row) => row.externalKey === race.dwarf,
    );
    // Every output of the Dwarf's reviewed notes, which all re-home.
    const sorted = (values: unknown[] = []) =>
      values.map((value) => JSON.stringify(value)).sort();
    expect(
      sorted(
        dwarf?.unsupported.flatMap((issue) =>
          issue.field === 'curation.home' ? [issue.value] : [],
        ),
      ),
    ).toEqual(
      sorted(
        parseCuration(curation).records.flatMap((record) =>
          record.externalKey === race.dwarf &&
          record.kind === 'note' &&
          // #388: superseded by Stonecunning (Dwarf)'s own checked record.
          record.target !== 'skill.per'
            ? record.outputs
            : [],
        ),
      ),
    );
    expect(dwarf?.modifiers.some((row) => row.target === 'saves')).toBe(false);
  });

  it('moves reviewed race notes onto the trait whose note covers the same statistic', () => {
    const dwarf = sheet(race.dwarf);
    const situations = ['poison', 'spells', 'spellLike'];
    expect(calculate(dwarf, situations).breakdowns['save.will'].total).toBe(2);
    expect(
      entry(t.hardy).modifiers.filter(
        (modifier) => modifier.target === 'saves',
      ),
    ).toHaveLength(3);
    // Stubborn (ARG p. 12) replaces Hardy; its bonuses go with it.
    const stubborn = sheet(race.dwarf, [alternateRow(t.stubborn)]);
    expect(calculate(stubborn, situations).breakdowns['save.will'].total).toBe(
      0,
    );
    expect(counting(stubborn, t.hardy)).toMatchObject({ counting: false });
  });
});

describe('#304 trait choices', () => {
  it('makes each +2 to one ability score a choice that contributes only once chosen', () => {
    for (const [raceKey, choiceTrait] of [
      [race.human, t.humanAbility],
      [race.halfElf, t.halfElfAbility],
      [race.halfOrc, t.halfOrcAbility],
    ] as const) {
      expect(entry(choiceTrait).modifiers).toEqual([
        { target: 'ability.$choice', bonusType: 'racial', value: 2 },
      ]);
      const unchosen = calculate(sheet(raceKey));
      expect(unchosen.abilities.strength.score).toBe(10);
      expect(unchosen.warnings).toContainEqual(
        expect.objectContaining({ check: 'racialAbilityScoreChoice' }),
      );
      const chosen = calculate(
        sheet(raceKey, [
          grantedTraitRow({
            race: raceKey,
            trait: choiceTrait,
            choice: 'strength',
          }),
        ]),
      );
      expect(chosen.abilities.strength.score).toBe(12);
      expect(chosen.abilities.dexterity.score).toBe(10);
    }
    // ARG p. 72 replaces the ordinary choice, Bonus Feat and Skilled.
    expect(entry(t.dualTalent).detail).toMatchObject({
      abilityChoiceCount: 2,
      replaces: [t.humanAbility, t.skilled, t.bonusFeat].sort(),
    });
    expect(
      artifact.catalog.racialTraits?.unresolvedAlternates.find(
        (row) => row.externalKey === t.dualTalent,
      ),
    ).toBeUndefined();
    const unchosen = calculate(
      sheet(race.human, [
        grantedTraitRow({
          race: race.human,
          trait: t.humanAbility,
          choice: 'strength',
        }),
        alternateRow(t.dualTalent),
      ]),
    );
    expect(unchosen.abilities.strength.score).toBe(10);
    expect(
      unchosen.warnings.some(
        (warning) => warning.check === 'racialAbilityScoreChoice',
      ),
    ).toBe(true);
  });

  it('gives Bonus Feat a feat slot that Dual Talent removes', () => {
    const slots = (input: CharacterSheetInput) =>
      calculate(input).selectionRules.slots.filter((slot) =>
        slot.id.includes(t.bonusFeat),
      );
    expect(slots(sheet(race.human))).toMatchObject([
      { kind: 'feat', count: 1 },
    ]);
    expect(slots(sheet(race.human, [dualTalent]))).toEqual([]);
  });

  it('gives Skilled one skill rank per level from its change, which Dual Talent removes', async () => {
    expect(entry(t.skilled).detail).toMatchObject({
      bonusSkillRanksPerLevel: 1,
    });
    // The pinned CRB fighter (2 + Int ranks per level) from the catalog fixture.
    const fighterPath =
      'tests/fixtures/catalog/pf1/packs/classes/fighter.WLqBCT5DqmGAx8Wd.yaml';
    const fighter = sheetDefinition(
      mapEntry({
        source: {
          repo: 'pf1',
          pack: 'classes',
          path: fighterPath,
          record: upstreamRecord.parse(
            parse(await readFile(fighterPath, 'utf8')),
          ),
        },
        kind: 'class',
        resolveKey: () => undefined,
        lookup: new Map(),
        spellClassTags: new Set(),
      }),
    );
    const level: SheetEntry = {
      _id: 'level-1',
      kind: 'classLevel',
      active: true,
      state: {
        kind: 'classLevel',
        classEntryId: fighter._id,
        position: 1,
        hpGained: 10,
      },
    };
    const budget = (extra: SheetEntry[]) =>
      calculateCharacterSheet(
        raceSheet({
          race: race.human,
          definitions: [...definitions, fighter],
          entries: [level, ...extra],
        }),
      ).classLevels[0]?.skillRankBudget;
    expect(budget([])).toBe(3);
    expect(budget([dualTalent])).toBe(2);
  });

  it('gives Adaptability a Skill Focus slot from the race record link, which Dual Minded replaces', () => {
    expect(entry(t.adaptability).grantsSlots).toEqual([
      { kind: 'feat', count: 1, feats: [skillFocus] },
    ]);
    const adaptability = (input: CharacterSheetInput) =>
      calculate(input).selectionRules.slots.filter((slot) =>
        slot.id.includes(t.adaptability),
      );
    expect(adaptability(sheet(race.halfElf))).toMatchObject([
      { kind: 'feat', count: 1, feats: [skillFocus] },
    ]);
    // Dual Minded (ARG p. 42) replaces Adaptability with +2 on Will saves.
    const dualMinded = sheet(race.halfElf, [alternateRow(t.dualMinded)]);
    expect(adaptability(dualMinded)).toEqual([]);
    expect(calculate(dualMinded).breakdowns['save.will'].total).toBe(2);
  });

  it('gives Multitalented two favored classes, which Arcane Training returns to one', () => {
    expect(calculate(sheet(race.halfElf)).racial.favoredClassCount).toBe(2);
    expect(
      calculate(sheet(race.halfElf, [alternateRow(t.arcaneTraining)])).racial
        .favoredClassCount,
    ).toBe(1);
  });
});

describe('race equivalence and weapon familiarity', () => {
  it('lets Elf Blood and Orc Blood count the race as their published races', () => {
    const halfElf = calculate(sheet(race.halfElf)).racial;
    expect(halfElf.countsAsRaces).toEqual(
      [race.elf, race.halfElf, race.human].sort(),
    );
    expect(satisfiesRacialPrerequisite(halfElf, { race: [race.elf] })).toBe(
      true,
    );
    const halfOrc = calculate(sheet(race.halfOrc)).racial;
    expect(halfOrc.countsAsRaces).toEqual(
      [race.halfOrc, race.human, race.orc].sort(),
    );
    expect(satisfiesRacialPrerequisite(halfOrc, { race: [race.elf] })).toBe(
      false,
    );
    // Only those two reviewed traits structure race equivalence.
    expect(
      artifact.catalog.entries
        .filter((row) => row.countsAsRaces)
        .map((row) => row.externalKey)
        .sort(),
    ).toEqual([t.elfBlood, t.orcBlood].sort());
  });

  it('structures named weapon familiarity on the trait, so City-Raised and Smeller replace it', () => {
    const proficiencies = (input: CharacterSheetInput) =>
      calculate(input)
        .racial.proficiencies.map((grant) =>
          'baseType' in grant ? grant.baseType : '',
        )
        .sort();
    expect(proficiencies(sheet(race.elf))).toEqual([
      'Longbow',
      'Longsword',
      'Rapier',
      'Shortbow',
    ]);
    // "Battleaxe" on the trait is the pinned "Battle Axe" base type.
    expect(proficiencies(sheet(race.dwarf))).toEqual([
      'Battle Axe',
      'Heavy Pick',
      'Warhammer',
    ]);
    expect(proficiencies(sheet(race.halfling))).toEqual(['Sling']);
    expect(proficiencies(sheet(race.halfOrc))).toEqual([
      'Falchion',
      'Greataxe',
    ]);
    // City-Raised (ARG p. 52) replaces the half-orc familiarity.
    expect(
      proficiencies(sheet(race.halfOrc, [alternateRow(t.cityRaised)])),
    ).toEqual(['Longsword', 'Whip']);
    // Smeller (ARG p. 139) replaces the orc's Ferocity and Weapon Familiarity.
    expect(proficiencies(sheet(race.orc))).toEqual(['Falchion', 'Greataxe']);
    expect(proficiencies(sheet(race.orc, [alternateRow(t.smeller)]))).toEqual(
      [],
    );
    // Gnome Weapon Familiarity names no weapon: it stays prose.
    expect(entry(trait('mPD0yR9P3IGAC6nJ')).proficiencies).toBeUndefined();
  });
});

describe('alternate replacement', () => {
  it('leaves an alternate whose replaced trait has no pinned record for the player, without removing race Modifiers', () => {
    // Arctic Elf (ARG p. 23) replaces "Base Statistics", pf1-content's label
    // for a racial subtype: a named combination of alternates that keeps the
    // elf's ability scores, so the elf's ability score trait stays (#721).
    expect(entry(t.arcticElf).detail).toMatchObject({
      raceKeys: [race.elf],
      standard: false,
      replaces: [],
      unresolvedReplacements: ['Base Statistics'],
    });
    expect(artifact.catalog.racialTraits?.unresolvedAlternates).toEqual([
      expect.objectContaining({
        externalKey: t.arcticElf,
        unmatched: ['Base Statistics'],
        missingHeader: false,
      }),
    ]);
    const result = calculate(sheet(race.elf, [alternateRow(t.arcticElf)]));
    expect(
      counting(
        sheet(race.elf, [alternateRow(t.arcticElf)]),
        raceAbilityTraitKey(race.elf),
      ),
    ).toMatchObject({ counting: true });
    expect(result.abilities.dexterity.score).toBe(12);
    expect(result.abilities.constitution.score).toBe(8);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ check: 'racialReplacementUnresolved' }),
    );
  });

  it('drops only Keen Senses when Urbanite replaces it', () => {
    const elf = sheet(race.elf);
    const urbanite = sheet(race.elf, [alternateRow(t.urbanite)]);
    expect(entry(t.urbanite).detail).toMatchObject({
      raceKeys: [race.elf],
      standard: false,
      replaces: [t.keenSensesElf],
    });
    const ordinary = new Map(
      Object.entries(calculate(elf).breakdowns).map(([target, value]) => [
        target,
        value.total,
      ]),
    );
    const changed = Object.entries(calculate(urbanite).breakdowns).flatMap(
      ([target, value]) =>
        value.total === ordinary.get(target)
          ? []
          : [[target, (ordinary.get(target) ?? 0) - value.total]],
    );
    expect(changed).toEqual([['skill.per', 2]]);
  });
});

describe('re-import identities and reviewed bindings', () => {
  const remap = {
    kind: 'racialTrait',
    reason: 'Identity mechanics check: a reviewed move of the pinned trait.',
    evidence: 'tests/catalog/racial-traits-719.test.ts',
    reviewedBy: 'test',
    reviewedOn: '2026-10-08',
  };

  it('re-imports deterministically', async () => {
    const again = await importCatalog(inputs);
    expect(JSON.stringify(again.catalog)).toBe(
      JSON.stringify(artifact.catalog),
    );
  });

  it('keeps retained trait identities through a reviewed remap: Grants, replacements and re-homed notes follow', async () => {
    const retained = 'pf1-content/retainedHardy0719';
    const moved = await importCatalog({
      ...inputs,
      remaps: [{ ...remap, from: t.hardy, to: retained }],
    });
    const dwarf = moved.catalog.entries.find(
      (row) => row.externalKey === race.dwarf,
    );
    expect(dwarf?.detail).toMatchObject({ kind: 'race' });
    const traits =
      dwarf?.detail.kind === 'race' ? (dwarf.detail.racialTraits ?? []) : [];
    expect(traits).toContain(retained);
    expect(traits).not.toContain(t.hardy);
    expect(
      moved.catalog.entries.find((row) => row.externalKey === t.stubborn)
        ?.detail,
    ).toMatchObject({ replaces: [retained] });
    // The reviewed Dwarf note still binds to the race and lands on Hardy. The
    // only stale record is the Dwarf's skill.per note, which Stonecunning
    // (Dwarf)'s own checked record supersedes (#388).
    expect(staleKeys(moved.curation.stale)).toEqual(supersededRecords);
    expect(
      moved.catalog.entries
        .find((row) => row.externalKey === retained)
        ?.modifiers.filter((modifier) => modifier.target === 'saves'),
    ).toHaveLength(3);
  });

  it('keeps the checked race notes binding through a full drafter run, which drafts no trait note they cover', async () => {
    const { draft, report } = await draftCatalogCurationWithReport(inputs);
    expect(staleKeys(report.stale)).toEqual(supersededRecords);
    expect(
      draft.added.filter(
        (record) =>
          record.externalKey === t.hardy && record.target === 'allSavingThrows',
      ),
    ).toEqual([]);
    const drafted = await importCatalog({ ...inputs, curation: draft });
    expect(staleKeys(drafted.curation.stale)).toEqual(supersededRecords);
    expect(
      drafted.catalog.entries
        .find((row) => row.externalKey === t.hardy)
        ?.modifiers.filter((modifier) => modifier.target === 'saves'),
    ).toHaveLength(3);
  });

  it('keeps a trait note required when it states other numbers than the race note that re-homes onto it', async () => {
    // Stonecunning (Dwarf) notes +2 and 10 ft; the Dwarf's checked race note
    // states only +2. #388 checked Stonecunning's own note record, so the case
    // is rebuilt here without it.
    const stonecunning = trait('6JCG0ei0s0ossrtx');
    const data = parseCuration(curation);
    const rebuilt = await importCatalog({
      ...inputs,
      curation: {
        ...data,
        records: data.records.filter(
          (record) =>
            !(record.externalKey === stonecunning && record.kind === 'note'),
        ),
      },
    });
    const row = rebuilt.catalog.racialTraits?.races.find(
      (candidate) => candidate.externalKey === race.dwarf,
    );
    expect(row?.rehomedNotes).toContainEqual({
      target: 'skill.per',
      trait: stonecunning,
    });
    expect(row?.uncoveredTraitNotes).toEqual([
      expect.objectContaining({ trait: stonecunning, target: 'skill.per' }),
    ]);
    expect(
      row?.coveredTraitNotes.some((note) => note.trait === stonecunning),
    ).toBe(false);
    expect(rebuilt.curation.missing).toContainEqual(
      expect.objectContaining({
        externalKey: stonecunning,
        kind: 'note',
        target: 'skill.per',
      }),
    );
    // With the trait's own checked record (the race note's outputs) the note
    // is covered, the race record is superseded and the bonus counts once.
    expect(artifact.curation.missing).not.toContainEqual(
      expect.objectContaining({ externalKey: stonecunning, kind: 'note' }),
    );
    expect(
      entry(stonecunning).modifiers.filter(
        (modifier) => modifier.target === 'skill.per',
      ),
    ).toHaveLength(1);
    expect(
      entry(race.dwarf).modifiers.some(
        (modifier) => modifier.target === 'skill.per',
      ),
    ).toBe(false);
  });

  it('lets only a checked race record stand in for its trait notes', async () => {
    const data = parseCuration(curation);
    const drafted = await importCatalog({
      ...inputs,
      curation: {
        ...data,
        records: data.records.map((record) =>
          record.externalKey === race.dwarf &&
          record.kind === 'note' &&
          record.target === 'allSavingThrows'
            ? { ...record, status: 'drafted' as const }
            : record,
        ),
      },
    });
    // Hardy's own note is required again; the draft does not cover it.
    expect(drafted.curation.missing).toContainEqual(
      expect.objectContaining({
        externalKey: t.hardy,
        kind: 'note',
        target: 'allSavingThrows',
      }),
    );
    expect(
      drafted.catalog.racialTraits?.races
        .find((row) => row.externalKey === race.dwarf)
        ?.coveredTraitNotes.filter((note) => note.trait === t.hardy),
    ).toEqual([]);
    // The checked record covers it.
    expect(artifact.curation.missing).not.toContainEqual(
      expect.objectContaining({ externalKey: t.hardy, kind: 'note' }),
    );
  });

  it('retires a re-homed race note once its trait has its own checked record, so it counts once', async () => {
    const text =
      '+[[2]] Racial bonus vs. poison, spells, and spell-like abilities.';
    const own = {
      externalKey: t.hardy,
      kind: 'note',
      target: 'allSavingThrows',
      text,
      textSha256: createHash('sha256').update(text).digest('hex'),
      status: 'checked',
      outputs: ['poison', 'spells', 'spellLike'].map((situation) => ({
        kind: 'modifier',
        target: 'saves',
        bonusType: 'racial',
        value: 2,
        condition: { situation },
      })),
      rationale: 'Mechanics check: Hardy (CRB p. 21) curated on its trait.',
      diagnostics: [],
      reviewedBy: 'test',
      reviewedOn: '2026-10-08',
      seedBindings: [],
    };
    const data = parseCuration(curation);
    const superseded = await importCatalog({
      ...inputs,
      curation: { ...data, records: [...data.records, own] },
    });
    expect(
      superseded.curation.stale.map((record) => [
        record.externalKey,
        record.target,
      ]),
    ).toEqual([[race.dwarf, 'allSavingThrows'], ...supersededRecords].sort());
    expect(
      superseded.catalog.racialTraits?.races.find(
        (row) => row.externalKey === race.dwarf,
      )?.staleNotes,
    ).toEqual([
      {
        target: 'allSavingThrows',
        reason: `Superseded by ${t.hardy}'s own checked allSavingThrows note record.`,
      },
      // #388: Stonecunning (Dwarf)'s checked record.
      {
        target: 'skill.per',
        reason: `Superseded by ${trait('6JCG0ei0s0ossrtx')}'s own checked skill.per note record.`,
      },
    ]);
    expect(
      superseded.catalog.entries
        .find((row) => row.externalKey === t.hardy)
        ?.modifiers.filter((modifier) => modifier.target === 'saves'),
    ).toHaveLength(3);
    // An unchecked trait record does not supersede the checked race record:
    // the race record still applies and the draft is reported stale.
    const drafted = await importCatalog({
      ...inputs,
      curation: {
        ...data,
        records: [...data.records, { ...own, status: 'drafted' }],
      },
    });
    expect(
      drafted.curation.stale.map((record) => [
        record.externalKey,
        record.target,
      ]),
    ).toEqual([...supersededRecords, [t.hardy, 'allSavingThrows']]);
    expect(
      drafted.catalog.entries
        .find((row) => row.externalKey === t.hardy)
        ?.modifiers.filter((modifier) => modifier.target === 'saves'),
    ).toHaveLength(3);
  });
});

describe('changed pinned records', () => {
  // A copy of the fixture with three upstream edits, as a later pin could make.
  const work = resolve('.scratch/racial-traits-719/test-work');
  let root = '';
  let changed: Artifact;
  beforeAll(async () => {
    await mkdir(work, { recursive: true });
    root = await mkdtemp(join(work, 'changed-'));
    await cp(fixtureRoot, root, { recursive: true });
    const edit = async (path: string, from: string, to: string) => {
      const file = join(root, path);
      const text = await readFile(file, 'utf8');
      expect(text).toContain(from);
      await writeFile(file, text.replace(from, to));
    };
    const traits = 'pf1-content/src/pf-racial-traits';
    // Keen Senses (Elf) carries its change in a type the importer cannot map.
    await edit(
      `${traits}/Keen_Senses__Elf__WOF6A7695wxFO2ie.yaml`,
      'type: racial',
      'type: untypedPerm',
    );
    // Bonus Feat (Human) no longer carries the reviewed change.
    await edit(
      `${traits}/Bonus_Feat__Human__uAJ9hLZYdH2JX7J8.yaml`,
      "formula: '1'",
      "formula: '2'",
    );
    // Two Halfling traits carry Perception, and neither version maps.
    await edit(
      `${traits}/Keen_Senses__Halfling__XVo4DApULZaETYcz.yaml`,
      'type: racial',
      'type: untypedPerm',
    );
    await edit(
      `${traits}/Sure_Footed_sSs0BK09PLxjbkAa.yaml`,
      'target: skill.acr\n      type: racial',
      'target: skill.per\n      type: untypedPerm',
    );
    // The Gnome description changes after review.
    await edit(
      'pf1/packs/races/gnome.efwHEwjvL9Z94MJI.yaml',
      '<strong>Gnome Magic</strong>',
      '<strong>Gnome Magic.</strong>',
    );
    // Kitsune Magic's school DC change and Shadow Magic (Wayang)'s school DC
    // note no longer match their reviewed description re-homes.
    await edit(
      `${traits}/Kitsune_Magic_YLr7f3djG85wvbAT.yaml`,
      'target: dc.school.enc\n      type: untyped',
      'target: dc.school.enc\n      type: untypedPerm',
    );
    await edit(
      `${traits}/Shadow_Magic__Wayang__XixpDZG7W0XELNni.yaml`,
      '+[[1]] to the DC of spells',
      '+[[1]] to the save DC of spells',
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
  const changedEntry = (key: string) =>
    changed.catalog.entries.find((row) => row.externalKey === key);

  it("moves the race's counted change onto the trait when the trait's own version does not map", () => {
    expect(changedEntry(t.keenSensesElf)?.modifiers).toEqual([
      { target: 'skill.per', bonusType: 'racial', value: 2 },
    ]);
    expect(
      changedEntry(race.elf)?.modifiers.some(
        (modifier) => modifier.target === 'skill.per',
      ),
    ).toBe(false);
    expect(
      changed.catalog.racialTraits?.races.find(
        (row) => row.externalKey === race.elf,
      ),
    ).toMatchObject({ lostModifiers: [], addedModifiers: [] });
  });

  it('keeps a race change on the race when several traits carry it and none of their versions maps', () => {
    expect(
      changedEntry(race.halfling)?.modifiers.filter(
        (modifier) => modifier.target === 'skill.per',
      ),
    ).toEqual([{ target: 'skill.per', bonusType: 'racial', value: 2 }]);
    const row = changed.catalog.racialTraits?.races.find(
      (candidate) => candidate.externalKey === race.halfling,
    );
    expect(row).toMatchObject({ lostModifiers: [], addedModifiers: [] });
    expect(row?.ownerlessModifiers).toContainEqual({
      target: 'skill.per',
      bonusType: 'racial',
      value: 2,
    });
  });

  it('reports a reviewed trait rule whose record changed and imports without it', () => {
    expect(changedEntry(t.bonusFeat)?.grantsSlots).toBeUndefined();
    expect(changedEntry(t.bonusFeat)?.unsupported).toContainEqual(
      expect.objectContaining({ field: 'racialTraitRule' }),
    );
  });

  it('reports a description re-home stale when the race description changes', () => {
    expect(changed.catalog.racialTraits?.descriptionRehomes).toContainEqual(
      expect.objectContaining({
        race: race.gnome,
        status: 'stale',
        reason: 'The race description changed since review.',
      }),
    );
    expect(
      changedEntry(t.gnomeMagic)?.modifiers.some(
        (modifier) => modifier.target === 'spellDC',
      ),
    ).toBe(false);
    expect(changedEntry(t.gnomeMagic)?.unsupported).toContainEqual(
      expect.objectContaining({
        field: 'changes',
        value: { target: 'dc.school.ill', formula: '1', type: 'untyped' },
      }),
    );
  });

  it("reports a race's reviewed school DC as a latent overlap with its trait's raw DC change or note", () => {
    const row = (key: string) =>
      changed.catalog.racialTraits?.races.find(
        (row) => row.externalKey === key,
      );
    for (const [raceKey, traitKey, reason] of [
      [
        otherRace.kitsune,
        trait('YLr7f3djG85wvbAT'),
        'The trait no longer carries the superseded change.',
      ],
      [
        otherRace.wayang,
        t.shadowMagic,
        'The trait no longer carries the superseded note.',
      ],
    ] as const) {
      expect(changed.catalog.racialTraits?.descriptionRehomes).toContainEqual(
        expect.objectContaining({ race: raceKey, status: 'stale', reason }),
      );
      // The race keeps its reviewed output; the trait's raw DC still covers it.
      expect(
        changedEntry(raceKey)?.modifiers.some(
          (modifier) => modifier.target === 'spellDC',
        ),
      ).toBe(true);
      expect(row(raceKey)?.latentOverlaps).toContainEqual({
        target: 'spellDC',
        trait: traitKey,
      });
    }
  });
});

it('does not apply the Svirfneblin Craft (alchemy) bonus to every Craft check', () => {
  // Both pinned descriptions explicitly restrict the +2 to Craft (alchemy).
  // The sheet currently has only the generic Craft target, so this stays
  // readable and unsupported rather than granting an unconditional +2.
  const result = calculate(sheet(otherRace.svirfneblin));
  expect(result.breakdowns['skill.crf'].total).toBe(0);
  expect(entry(otherRace.svirfneblin).unsupported).toContainEqual(
    expect.objectContaining({
      field: 'changes',
      reason: expect.stringContaining('Craft (alchemy)'),
    }),
  );
});
