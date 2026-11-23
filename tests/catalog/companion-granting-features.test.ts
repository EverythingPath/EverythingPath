// @vitest-environment node
// companion-entitlement-replaced (fix r1, r2): a Druid or Ranger Class Level
// entitles an animal companion through nature bond (CRB p. 51) or hunter's
// bond (CRB p. 66), or through an Archetype's own version of it that still
// grants the companion (`companionGrantingFeatures`). A replacement the list
// does not name makes the Class Level lose its companion, so every Druid and
// Ranger Archetype the identity ledger keys is classified here, and the
// classification is compared with the replacement records the importer
// emits from the pinned PCGen files with the reviewed curation applied: a
// new Archetype, a bond replacement added to a classified one, or one that
// changes which row it replaces fails until it is classified, so it forces a
// look instead of silently losing a companion. The Cavalier, Hunter and
// Paladin Archetypes that replace a companion-granting feature are not
// listed: the rule reads no class but the Druid and the Ranger.
import { describe, expect, it } from 'vitest';
import { companionGrantingFeatures } from '../../convex/lib/companionRelationshipGraph';
import ledger from '../../scripts/catalog/everythingpath-identities.json';
import type { PreviewEntry } from '../../scripts/catalog/map';
import {
  emitPcgenOwners,
  pcgenOwnerSelection,
} from '../../scripts/catalog/pcgen-owners';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { ruleKeyMatches } from '../../src/lib/character-sheet-rule-keys';
import { pcgen716IdentityFiles } from '../fixtures/pcgen-716/identity-files';
import { readPcgenFixtureTree } from './pcgen-716-tree';

const classified = {
  /** Replaces the bond with its own version that grants the companion again. */
  grantsAgain: {
    'druid-ape-shaman': 'druid-ape-shaman-nature-bond',
    'druid-bat-shaman': 'druid-bat-shaman-nature-bond',
    'druid-boar-shaman': 'druid-boar-shaman-nature-bond',
    'druid-cave-druid': 'druid-cave-druid-nature-bond',
    'druid-dinosaur-druid': 'druid-dinosaur-druid-dinosaur-bond',
    'ranger-horse-lord': 'ranger-horse-lord-mounted-bond',
  },
  /** Replaces the bond with its own companion rule kind, read by its rule. */
  ownRuleKind: ['druid-pack-lord', 'ranger-beast-master'],
  /** Replaces the bond and grants no animal companion: entitles none. */
  replaced: [
    'druid-blight-druid',
    'druid-death-druid',
    'druid-draconic-druid',
    'druid-feral-shifter',
    'druid-swarm-monger',
    'druid-treesinger',
    'druid-urban-druid',
    'druid-urushiol',
    'ranger-code-runner',
    'ranger-divine-tracker',
    'ranger-drake-warden',
    'ranger-dusk-stalker',
    'ranger-flamewarden',
    'ranger-freebooter',
    'ranger-guide',
    'ranger-guildbreaker',
    'ranger-poison-darter',
    'ranger-sentinel',
    'ranger-spirit-ranger',
    'ranger-stormwalker',
    'ranger-toxic-herbalist',
    'ranger-trophy-hunter',
    'ranger-warden',
    'ranger-wild-shadow',
    'ranger-wild-stalker',
    'ranger-wilderness-explorer',
    'ranger-witchguard',
  ],
  /** Does not replace the bond (it may alter it), so it keeps counting. */
  notReplaced: [
    'druid-aerie-protector',
    'druid-ancient-guardian',
    'druid-aquatic-druid',
    'druid-arctic-druid',
    'druid-bear-shaman',
    'druid-desert-druid',
    'druid-devolutionist',
    'druid-dragon-shaman',
    'druid-eagle-shaman',
    'druid-feral-child',
    'druid-feyspeaker',
    'druid-goliath-druid',
    'druid-green-scourge',
    'druid-jungle-druid',
    'druid-kraken-caller',
    'druid-life-channeler',
    'druid-lion-shaman',
    'druid-menhir-savant',
    'druid-mooncaller',
    'druid-mountain-druid',
    'druid-naga-aspirant',
    'druid-nature-fang',
    'druid-nature-priest',
    'druid-plains-druid',
    'druid-reincarnated-druid',
    'druid-restorer',
    'druid-river-druid-uw',
    'druid-road-keeper',
    'druid-rot-warden',
    'druid-saurian-shaman',
    'druid-season-sage',
    'druid-serpent-shaman',
    'druid-shark-shaman',
    'druid-skinshaper',
    'druid-sky-druid',
    'druid-storm-druid',
    'druid-supernaturalist',
    'druid-survivor',
    'druid-swamp-druid',
    'druid-undine-adept',
    'druid-wild-whisperer',
    'druid-wolf-shaman',
    'druid-words-of-power',
    'druid-world-walker',
    'ranger-battle-scout',
    'ranger-corpse-hunter',
    'ranger-dandy',
    'ranger-deep-walker',
    'ranger-dragon-hunter',
    'ranger-dungeon-rover',
    'ranger-falconer',
    'ranger-groom',
    'ranger-hooded-champion',
    'ranger-infiltrator',
    'ranger-lantern-lighter',
    'ranger-sable-company-marine',
    'ranger-shapeshifter',
    'ranger-skirmisher',
    'ranger-summit-sentinel',
    'ranger-tanglebriar-demonslayer',
    'ranger-tidal-hunter',
    'ranger-toxophilite',
    'ranger-transporter',
    'ranger-trapper',
    'ranger-urban-ranger',
    'ranger-wave-warden',
    'ranger-wild-hunter',
    'ranger-wild-soul',
    'ranger-wilderness-medic',
    'ranger-words-of-power',
    'ranger-yokai-hunter',
  ],
  /** Keyed by the ledger but not in the import at that base. */
  notImported: [
    'druid-leshy-warden',
    'druid-leshy-warden-uw',
    'druid-river-druid',
    'druid-tempest-druid',
    'druid-tempest-druid-ag',
  ],
} as const;

const ledgerArchetypes = ledger.identities
  .filter(
    ({ kind, externalKey }) =>
      kind === 'archetype' &&
      /^everythingpath\/(druid|ranger)-/.test(externalKey),
  )
  .map(({ externalKey }) => externalKey.replace('everythingpath/', ''));

/**
 * The row each replacing Archetype of the table replaces: nature bond at
 * the Druid's 1st level (CRB p. 51), hunter's bond at the Ranger's 4th
 * (CRB p. 66), whole.
 */
const bondRows = {
  druid: { feature: 'druid-nature-bond', classLevel: 1, scope: 'whole' },
  ranger: { feature: 'ranger-hunters-bond', classLevel: 4, scope: 'whole' },
} as const;
type BondReplacement = {
  archetype: string;
  feature: string;
  classLevel: number;
  scope: string;
};
const bondRowOf = (archetype: string): BondReplacement => ({
  archetype,
  ...bondRows[archetype.startsWith('druid-') ? 'druid' : 'ranger'],
});
/** The replacements the table classifies, each of its class's bond row. */
const classifiedReplacements = [
  ...Object.keys(classified.grantsAgain),
  ...classified.ownRuleKind,
  ...classified.replaced,
].map(bondRowOf);

/**
 * The replacement records the importer reads: each selected Druid and Ranger
 * Archetype emitted from the pinned PCGen files by `emitPcgenOwners`, the
 * `--pcgen` import's own step, with the reviewed curation applied, so a
 * checked structure record's `detail.replaces` stands in for the mapper's.
 */
const emitted = emitPcgenOwners({
  tree: await readPcgenFixtureTree(pcgen716IdentityFiles),
  data: reviewedCuration,
  selection: pcgenOwnerSelection.filter(
    (owner) =>
      owner.kind === 'archetype' &&
      (owner.className === 'Druid' || owner.className === 'Ranger'),
  ),
}).entries;
const grantingFeatures: readonly string[] = Object.values(
  companionGrantingFeatures,
).flat();
/** Each emitted Archetype's replacements that name a companion-granting feature. */
function bondReplacementsOf(
  entries: readonly PreviewEntry[],
): BondReplacement[] {
  return entries.flatMap(({ externalKey, detail }) =>
    detail.kind === 'archetype'
      ? detail.replaces.flatMap(({ externalKey: row, classLevel, scope }) => {
          const feature = grantingFeatures.find((key) =>
            ruleKeyMatches(row, key),
          );
          return feature
            ? [
                {
                  archetype: externalKey.replace('everythingpath/', ''),
                  feature,
                  classLevel,
                  scope,
                },
              ]
            : [];
        })
      : [],
  );
}
const describeReplacement = (replacement: BondReplacement) =>
  `${replacement.archetype} replaces ${replacement.feature} ${replacement.classLevel} ${replacement.scope}`;
/**
 * The replacements the records and the table disagree on: one the records
 * hold that the table does not classify, as a bond replacement added to an
 * Archetype listed as not replacing it, and one the table classifies that
 * the records no longer hold, as a replacement moved to another feature.
 */
function unclassifiedReplacements(entries: readonly PreviewEntry[]) {
  const records = new Set(bondReplacementsOf(entries).map(describeReplacement));
  const table = new Set(classifiedReplacements.map(describeReplacement));
  return {
    notClassified: [...records].filter((row) => !table.has(row)).sort(),
    notInRecords: [...table].filter((row) => !records.has(row)).sort(),
  };
}
/** The emitted entries with one Archetype's `detail.replaces` as a checked structure record would set it. */
function correctReplaces(
  archetype: string,
  replaces: (
    current: Extract<PreviewEntry['detail'], { kind: 'archetype' }>['replaces'],
  ) => Extract<PreviewEntry['detail'], { kind: 'archetype' }>['replaces'],
) {
  return emitted.map((entry) =>
    entry.externalKey === `everythingpath/${archetype}` &&
    entry.detail.kind === 'archetype'
      ? {
          ...entry,
          detail: {
            ...entry.detail,
            replaces: replaces(entry.detail.replaces),
          },
        }
      : entry,
  );
}

describe('the Druid and Ranger Archetypes against the companion-granting features', () => {
  it('classifies every Druid and Ranger Archetype the identity ledger keys, once', () => {
    const keys = [
      ...Object.keys(classified.grantsAgain),
      ...classified.ownRuleKind,
      ...classified.replaced,
      ...classified.notReplaced,
      ...classified.notImported,
    ];
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual([...ledgerArchetypes].sort());
  });

  it('lists exactly the Archetype bonds that grant the companion again, each a ledger feature', () => {
    const listed = Object.values(companionGrantingFeatures)
      .flat()
      .filter(
        (feature) =>
          feature !== 'druid-nature-bond' && feature !== 'ranger-hunters-bond',
      );
    expect([...listed].sort()).toEqual(
      Object.values(classified.grantsAgain).sort(),
    );
    const features = new Set(
      ledger.identities
        .filter(({ kind }) => kind === 'archetypeFeature')
        .map(({ externalKey }) => externalKey),
    );
    for (const feature of listed)
      expect(features.has(`everythingpath/${feature}`)).toBe(true);
  });

  it('classifies exactly the replacements of a companion-granting feature the importer emits', () => {
    const emittedKeys = emitted
      .filter(({ detail }) => detail.kind === 'archetype')
      .map(({ externalKey }) => externalKey.replace('everythingpath/', ''));
    expect(emittedKeys.sort()).toEqual(
      ledgerArchetypes
        .filter(
          (key) => !(classified.notImported as readonly string[]).includes(key),
        )
        .sort(),
    );
    expect(unclassifiedReplacements(emitted)).toEqual({
      notClassified: [],
      notInRecords: [],
    });
    // Each listed bond is the replacing Archetype's own feature at the row it replaces.
    for (const [archetype, feature] of Object.entries(classified.grantsAgain)) {
      const entry = emitted.find(
        ({ externalKey }) => externalKey === `everythingpath/${archetype}`,
      );
      if (entry?.detail.kind !== 'archetype')
        throw new Error(`${archetype} is not emitted.`);
      const { classLevel } = bondRowOf(archetype);
      expect(entry.detail.adds).toContainEqual({
        classLevel,
        externalKey: `everythingpath/${feature}`,
      });
    }
  });

  it('fails on a corrected replacement under a key the table already classifies', () => {
    // A curation correction gives the Bear Shaman, listed as not replacing
    // nature bond, a whole replacement of it.
    expect(
      unclassifiedReplacements(
        correctReplaces('druid-bear-shaman', (replaces) => [
          ...replaces,
          {
            classLevel: 1,
            externalKey: 'pf1/wZ40bxNVn95BbLBV',
            scope: 'whole',
          },
        ]),
      ),
    ).toEqual({
      notClassified: ['druid-bear-shaman replaces druid-nature-bond 1 whole'],
      notInRecords: [],
    });
    // One moves the Guide's replacement off hunter's bond.
    expect(
      unclassifiedReplacements(
        correctReplaces('ranger-guide', (replaces) =>
          replaces.filter(
            ({ externalKey }) => externalKey !== 'pf1/Bs5i98ja24ODe9WL',
          ),
        ),
      ),
    ).toEqual({
      notClassified: [],
      notInRecords: ['ranger-guide replaces ranger-hunters-bond 4 whole'],
    });
  });
});
