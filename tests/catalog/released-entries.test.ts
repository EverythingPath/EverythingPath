// @vitest-environment node
// pbl-seed-helper (PRD #251): importReleasedEntries on a fixed sample, one
// entry of each kind the app-behaviour tests seed from batch directories. Each
// equals the entry its batch's committed preview.json holds today; that read
// of the named previews goes away with the batch snapshots. No batch preview
// holds a PCGen-emitted archetype, so the Ecclesitheurge is compared with the
// entry the rule-value tests' PCGen import emits (rule-value-sheets.ts).
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { importReleasedEntries } from './released-entries';
import { archetypes, ruleValueImports } from './rule-value-sheets';

/** The sample: kind, key, name and the batch whose preview holds it. */
const sample = [
  ['feat', 'pf1/0bZf3SDkvVOe2ujH', 'Lightning Reflexes', 'feats-330'],
  ['spell', 'pf1/05i5rxwim12hwktu', 'Bull’s Strength', 'spells-516'],
  ['trait', 'pf1-content/3smnwWvvtkwHOFd1', 'Hardly a Fool', 'traits-368'],
  ['weapon', 'pf1/zWRlna42PMJVX6un', 'Longsword', 'weapons-and-ammo-429'],
  ['armour', 'pf1/gsE0PAOmCwivue5A', 'Buckler', 'armors-and-shields-424'],
  ['item', 'pf1/6kZGQ2chmr3jpS1t', 'Entertainer’s outfit', 'items-430'],
  ['buff', 'pf1/ClOy4KHJFDdt0ALh', 'Bull’s Strength (buff)', 'buffs-547'],
  [
    'class feature',
    'pf1/5JFfSqLMCpbRmERa',
    'Armor Training',
    'class-abilities-608',
  ],
  ['race', 'pf1/nEltI9y37rKJTeWo', 'Dwarf', 'races-328'],
] as const;

/**
 * The records the sample's entries read beside their own, named as a test
 * names them: the 20 classes whose lists hold Bull's Strength (its spell
 * levels).
 */
const context = [
  '5nxfoXZ5KpOFYpLm', // Adept
  'JcaqlAawhf14q1lq', // Alchemist
  'uynVENa0deVdmf53', // Antipaladin
  'GK6rAenFfgJNNJCX', // Arcanist
  'E27lMw9YNOAjS009', // Bloodrager
  'SjFqQceVeVBzBwgn', // Cleric
  '7eZQP0MzeO2svmVF', // Druid
  'Immo2BuSe5WGdRW9', // Hunter
  's27zdYVFenYBVtfu', // Investigator
  'xZLcyrEKYZoJPS2k', // Magus
  'xtRbNEKYYq4cRiwI', // Medium
  '5S0u8yFcP861wgd1', // Oracle
  'ohptcds1d5oG6Bjh', // Paladin
  '0ahLHNR2864mih3n', // Psychic
  'jMi3GBtvdG0WhH8L', // Shaman
  'AoWSbnuTSGIxmv61', // Sorcerer
  'BrnHPJ2EVSQSyNQ8', // Summoner
  '5iDrtRQMuIhLymUA', // Summoner (Unchained)
  'KgxFsHNv0g1GbvmS', // Warpriest
  '0c4lYDywj6bQ0i8r', // Wizard
].map((id) => `pf1/${id}`);

/**
 * Deep Tradition (Heroes from the Fringe p. 6), a Dwarf racial trait, imported
 * with the Dwarf and the two racial traits it replaces, which its preview
 * names; the Dwarf's own preview (races-328) was imported without its racial
 * traits, so it is checked from the import above.
 */
const deepTradition = 'pf1-content/0732ZhCzO00426kM';
const deepTraditionContext = [
  'pf1/nEltI9y37rKJTeWo',
  'pf1-content/JtJKg8vV58UJ6m1m',
  'pf1-content/iBCPIWFExt679Zhh',
];

/** The entry a batch's committed preview holds for a key. */
async function previewEntry(batch: string, key: string) {
  const preview = JSON.parse(
    await readFile(`tests/fixtures/${batch}/preview.json`, 'utf8'),
  ) as { entries: { externalKey: string }[] };
  return preview.entries.find(({ externalKey }) => externalKey === key);
}

/** An entry as JSON holds it, for comparison with a parsed preview. */
const parsed = (entry: unknown): unknown => JSON.parse(JSON.stringify(entry));

const released = await importReleasedEntries([
  ...sample.map(([, key]) => key),
  ...context,
]);

describe('importReleasedEntries on the sample', () => {
  it.each(sample)(
    'imports the %s %s (%s) as the %s preview holds it',
    async (...[, key, , batch]) => {
      const expected = await previewEntry(batch, key);
      expect(expected).toBeDefined();
      expect(parsed(released.entries.get(key))).toEqual(expected);
    },
  );

  it('imports the racial trait Deep Tradition, with its race and the traits it replaces, as the racial-traits-387 preview holds it', async () => {
    const { entries } = await importReleasedEntries([
      deepTradition,
      ...deepTraditionContext,
    ]);
    expect(parsed(entries.get(deepTradition))).toEqual(
      await previewEntry('racial-traits-387', deepTradition),
    );
  });

  it('imports the Dwarf’s ability score trait with it, as the races-328 preview holds it', async () => {
    const key = 'local/race-ability-scores/pf1/nEltI9y37rKJTeWo';
    expect(parsed(released.entries.get(key))).toEqual(
      await previewEntry('races-328', key),
    );
  });

  it('imports the Ecclesitheurge, a PCGen owner, as the rule-value tests’ PCGen import emits it', async () => {
    const [{ entries }, { without }] = await Promise.all([
      importReleasedEntries([archetypes.ecclesitheurge]),
      ruleValueImports([], 'released-entries.test.ts'),
    ]);
    const expected = without.catalog.entries.find(
      ({ externalKey }) => externalKey === archetypes.ecclesitheurge,
    );
    expect(expected?.detail.kind).toBe('archetype');
    expect(parsed(entries.get(archetypes.ecclesitheurge))).toEqual(
      parsed(expected),
    );
    // Five PCGen tree imports, about 6 s here.
  }, 30_000);
});

describe('importReleasedEntries refuses', () => {
  const lightningReflexes = 'pf1/0bZf3SDkvVOe2ujH';

  it('an empty key list', async () => {
    await expect(importReleasedEntries([])).rejects.toThrow(
      'Name at least one entry key.',
    );
  });

  it('a key the store does not hold, naming it', async () => {
    await expect(
      importReleasedEntries([lightningReflexes, 'pf1/0000000000000000']),
    ).rejects.toThrow(
      'The pinned store holds no record for pf1/0000000000000000.',
    );
  });

  it('a key the importer does not emit, naming it', async () => {
    // Celestial (Bestiary p. 294), a monster template: the importer leaves
    // the monster-templates pack unassigned.
    await expect(
      importReleasedEntries([lightningReflexes, 'pf1/8kHcvgFNoGObDhQ8']),
    ).rejects.toThrow(
      "The import of the pinned store's records emits no entry for pf1/8kHcvgFNoGObDhQ8.",
    );
  });
});
