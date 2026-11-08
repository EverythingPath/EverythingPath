// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  planImportBatches,
  type ImportOwner,
} from '../../scripts/catalog/import';
import { pcgenPin } from '../../scripts/catalog/inventory';
import { join } from 'node:path';
import { inventoryPcgen } from '../../scripts/catalog/pcgen/inventory';
import { readPcgenTree } from '../../scripts/catalog/pcgen/lst';
import { readPcgen716Tree } from './pcgen-716-tree';
import {
  pcgenCheckout,
  pcgenCheckoutIsAtPin,
  readPinned,
} from './pinned-sources';

const source = '#716 PRD/PCGen import';

// APG's twelve fighter archetypes (apg_abilities_class.lst:2102-2113) and the
// features their own lines grant, found by KEY in the same file. These are
// the inventory's direct rows for them (plan Appendix G; 716-inventory.py
// --rows): 8, 10, 6, 5, 7, 8, 8, 6, 6, 7, 8 and 7 features.
const apg = 'roleplaying_game/advanced_players_guide/apg_abilities_class.lst';
const apgLines = (
  await readPinned('pcgen', `${pcgenPin.directory}/${apg}`)
).split(/\r?\n/);
const tokens = (line: string) => line.split('\t').filter(Boolean);
const keyLines = new Map(
  apgLines.flatMap((line) => {
    const key = tokens(line).find((token) => token.startsWith('KEY:'));
    return key ? [[key.slice('KEY:'.length), line] as const] : [];
  }),
);
const apgFighters: ImportOwner[] = apgLines.slice(2101, 2113).map((line) => {
  const fields = tokens(line);
  const key = fields.find((token) => token.startsWith('KEY:'))?.slice(4) ?? '';
  const features = fields
    .filter((token) => token.startsWith('ABILITY:'))
    .map((token) => token.split('|')[2] ?? '');
  for (const feature of features)
    if (!keyLines.has(feature)) throw new Error(`No ${feature} in ${apg}.`);
  return {
    kind: 'archetype',
    name: key.split(' ~ ')[1] ?? '',
    baseClass:
      fields
        .find((token) => token.startsWith('ASPECT:Archetype Base Class|'))
        ?.split('|')[1] ?? '',
    locator: `pcgen:${apg}#${key}`,
    ownedFeatures: features.map((feature) => `pcgen:${apg}#${feature}`),
  };
});

// Ultimate Combat's three wizard archetypes all give up cantrips through one
// Core Rulebook record (inventory direct rows, uc_abilities_class.lst:1738-1740).
const uc = 'pcgen:roleplaying_game/ultimate_combat/uc_abilities_class.lst';
const noCantrips =
  'pcgen:roleplaying_game/core_rulebook/cr_abilities_class.lst#No Cantrips ~ Wizard';
const wizard = (name: string, features: string[]): ImportOwner => ({
  kind: 'archetype',
  name,
  baseClass: 'Wizard',
  locator: `${uc}#Wizard Archetype ~ ${name}`,
  ownedFeatures: [
    ...features.map((feature) => `${uc}#${name} ~ ${feature}`),
    noCantrips,
  ],
});
const ucWizards = [
  wizard('Spellslinger', [
    'Arcane Gun',
    'Gunsmith',
    'Mage Bullets',
    'School of the Gun',
  ]),
  wizard('Arcane Bomber', ['Bomb', 'School of the Bomb', 'Spellblast Bombs']),
  wizard('Siege Mage', [
    'Empower Siege Engine',
    'Siege Engine Bond',
    'Siege Engineer',
    'Siege School',
  ]),
];

// ISWG's and AG's Hellknight each grant their own pack's variants of the
// same ten keys, and both Core Rulebook's Aura of Law (inventory rows,
// iswg_classes.lst:23, ag_classes.lst:170).
const hellknight = (classes: string, abilities: string): ImportOwner => ({
  kind: 'prestige',
  name: 'Hellknight',
  locator: `pcgen:${classes}#Hellknight`,
  ownedFeatures: [
    'pcgen:roleplaying_game/core_rulebook/cr_abilities_class.lst#Aura of Law',
    ...[
      'Detect Chaos',
      'Smite Chaos',
      'Discern Lies',
      'Hellknight Armor',
      'Discipline',
      'Force of Will',
      'Lawbringer',
      'Infernal Armor',
      "Hell's Knight",
    ].map((feature) => `pcgen:${abilities}#${feature} ~ HK`),
  ],
});
const hellknights = [
  hellknight(
    'roleplaying_game/adventurers_guide/ag_classes.lst',
    'roleplaying_game/adventurers_guide/ag_abilities_class.lst',
  ),
  hellknight(
    'campaign_setting/inner_sea_world_guide/iswg_classes.lst',
    'campaign_setting/inner_sea_world_guide/iswg_abilities_class.lst',
  ),
];
const owners = [...apgFighters, ...ucWizards, ...hellknights];

const namesOf = (batch: { owners: string[] }) =>
  batch.owners.map((locator) => locator.split(' ~ ')[1] ?? locator);
const sizeOf = (batch: { owners: string[]; features: string[] }) =>
  batch.owners.length + batch.features.length;

describe('bounded import batches (#716 P2, plan §6)', () => {
  it('requires an archetype to name its base class', () => {
    const owner: ImportOwner = {
      kind: 'prestige',
      name: 'Hellknight',
      locator:
        'pcgen:campaign_setting/inner_sea_world_guide/iswg_classes.lst#Hellknight',
      ownedFeatures: [],
    };
    // @ts-expect-error An archetype without its base class can't be selected.
    const archetype: ImportOwner = { ...owner, kind: 'archetype' };
    expect(archetype.kind).toBe('archetype');
  });

  it('counts each archetype and every feature it owns directly toward the limit', () => {
    const plan = planImportBatches({
      selector: {
        source,
        kind: 'archetype',
        base_class: 'fighter',
        max_candidates: 100,
      },
      owners,
    });

    expect(apgFighters.map((owner) => owner.ownedFeatures.length)).toEqual([
      8, 10, 6, 5, 7, 8, 8, 6, 6, 7, 8, 7,
    ]);
    expect(plan.batches).toHaveLength(1);
    expect(plan.batches.map(sizeOf)).toEqual([98]);
    expect(namesOf(plan.batches[0] ?? { owners: [] })).toEqual([
      'Archer',
      'Crossbowman',
      'Free Hand Fighter',
      'Mobile Fighter',
      'Phalanx Soldier',
      'Polearm Master',
      'Roughrider',
      'Savage Warrior',
      'Shielded Fighter',
      'Two-Handed Fighter',
      'Two-Weapon Warrior',
      'Weapon Master',
    ]);
  });

  it('splits a selection over the limit into ordered sub-batches, never splitting an owner', () => {
    const plan = planImportBatches({
      selector: {
        source,
        kind: 'archetype',
        base_class: 'fighter',
        max_candidates: 30,
      },
      owners,
    });

    expect(plan.batches.map(namesOf)).toEqual([
      ['Archer', 'Crossbowman', 'Free Hand Fighter'],
      ['Mobile Fighter', 'Phalanx Soldier', 'Polearm Master'],
      ['Roughrider', 'Savage Warrior', 'Shielded Fighter'],
      ['Two-Handed Fighter', 'Two-Weapon Warrior', 'Weapon Master'],
    ]);
    expect(plan.batches.map(sizeOf)).toEqual([27, 23, 23, 25]);
  });

  it('counts a feature two owners share once in a sub-batch, and again in the next', () => {
    const whole = planImportBatches({
      selector: {
        source,
        kind: 'archetype',
        base_class: 'wizard',
        max_candidates: 100,
      },
      owners,
    });
    const split = planImportBatches({
      selector: {
        source,
        kind: 'archetype',
        base_class: 'wizard',
        max_candidates: 10,
      },
      owners,
    });

    expect(whole.batches.map(sizeOf)).toEqual([15]);
    expect(split.batches.map(namesOf)).toEqual([
      ['Arcane Bomber', 'Siege Mage'],
      ['Spellslinger'],
    ]);
    expect(split.batches.map(sizeOf)).toEqual([10, 6]);
    expect(
      split.batches.map((batch) => batch.features.includes(noCantrips)),
    ).toEqual([true, true]);
  });

  it('selects prestige classes by name initial and counts same-key variants by locator', () => {
    const plan = planImportBatches({
      selector: {
        source,
        kind: 'prestige',
        name_initial: 'H',
        max_candidates: 100,
      },
      owners,
    });

    expect(plan.batches).toHaveLength(1);
    const [batch] = plan.batches;
    // Two roots, Aura of Law once and both books' nine HK variants.
    expect(batch && sizeOf(batch)).toBe(21);
    expect(batch?.owners).toEqual([
      'pcgen:campaign_setting/inner_sea_world_guide/iswg_classes.lst#Hellknight',
      'pcgen:roleplaying_game/adventurers_guide/ag_classes.lst#Hellknight',
    ]);
    expect(
      batch?.features.filter((feature) => feature.endsWith('#Discipline ~ HK')),
    ).toHaveLength(2);
    expect(
      planImportBatches({
        selector: {
          source,
          kind: 'prestige',
          name_initial: 'A',
          max_candidates: 100,
        },
        owners,
      }).batches,
    ).toEqual([]);
  });

  it('refuses a selector over 100 keys, from another source, or an owner larger than the limit', () => {
    const plan = (selector: unknown) => () =>
      planImportBatches({ selector, owners });
    expect(
      plan({
        source,
        kind: 'archetype',
        base_class: 'fighter',
        max_candidates: 101,
      }),
    ).toThrow();
    expect(
      plan({
        source: 'Captured supplement',
        kind: 'archetype',
        base_class: 'fighter',
        max_candidates: 100,
      }),
    ).toThrow();
    expect(
      plan({
        source,
        kind: 'prestige',
        name_initial: 'h',
        max_candidates: 100,
      }),
    ).toThrow();
    // Crossbowman is one root and ten features: eleven keys.
    expect(
      plan({
        source,
        kind: 'archetype',
        base_class: 'fighter',
        max_candidates: 10,
      }),
    ).toThrow(/Crossbowman owns 10 features directly; with it that is 11 keys/);
  });
});

// #716 P4: a prestige class is a class definition, and `--candidates` takes
// at most three (scripts/catalog/import.ts, selectCandidates; curation.md).
// The P3 pinned inputs' prestige owners, with the features each owns
// directly, as the inventory finds them.
const inventory = inventoryPcgen(await readPcgen716Tree());
const prestigeOwners = inventory.owners.flatMap((owner): ImportOwner[] =>
  owner.kind === 'prestige'
    ? [
        {
          kind: 'prestige',
          name: owner.record.locator.key,
          locator: `pcgen:${owner.record.locator.file}#${owner.record.locator.key}`,
          ownedFeatures: inventory.rows.flatMap((row) =>
            row.owner === owner && row.depth === 1 && row.feature
              ? [`pcgen:${row.feature.locator.file}#${row.feature.locator.key}`]
              : [],
          ),
        },
      ]
    : [],
);
const prestigePlan = (name_initial: string) =>
  planImportBatches({
    selector: { source, kind: 'prestige', name_initial, max_candidates: 100 },
    owners: prestigeOwners,
  }).batches.map((batch) =>
    batch.owners.map((locator) => {
      const [path = '', key = ''] = locator.split('#');
      return `${key} (${path.split('/').at(-1)})`;
    }),
  );

describe('prestige sub-batches and the three-class-definition bound (#716 P4)', () => {
  it('packs at most three prestige records per sub-batch, under the key limit too', () => {
    // Six P records, 74 keys in all: one sub-batch by keys, two by classes.
    const p = prestigeOwners.filter(({ name }) => name.startsWith('P'));
    expect(
      p.length + new Set(p.flatMap(({ ownedFeatures }) => ownedFeatures)).size,
    ).toBeLessThanOrEqual(100);
    expect(prestigePlan('P')).toEqual([
      [
        'Pathfinder Chronicler (cr_classes.lst)',
        'Pathfinder Delver (sos_classes.lst)',
        'Pathfinder Delver (ag_classes.lst)',
      ],
      [
        'Pathfinder Savant (pfs_sos_classes.lst)',
        'Pathfinder Savant (sos_classes.lst)',
        'Pathfinder Savant (ag_classes.lst)',
      ],
    ]);
  });

  it('keeps a same-name variant group in one sub-batch where it fits', () => {
    // Arcane Trickster's Undead Slayer's Handbook and Core Rulebook records
    // stay together rather than splitting across sub-batches.
    expect(prestigePlan('A')).toEqual([
      ['Aldori Swordlord (ag_classes.lst)', 'Arcane Archer (cr_classes.lst)'],
      [
        'Arcane Trickster (ush_classes.lst)',
        'Arcane Trickster (cr_classes.lst)',
        'Argent Dramaturge (ag_classes.lst)',
      ],
      [
        'Asavir (ag_classes.lst)',
        'Aspis Agent (ag_classes.lst)',
        'Assassin (cr_classes.lst)',
      ],
    ]);
  });

  it('leaves archetype sub-batches unbounded by class definitions', () => {
    const plan = planImportBatches({
      selector: {
        source,
        kind: 'archetype',
        base_class: 'fighter',
        max_candidates: 100,
      },
      owners,
    });
    expect(plan.batches.map((batch) => batch.owners.length)).toEqual([12]);
  });
});

// #716 P5: the first slice's archetype owners, with the features each owns
// directly, as the inventory finds them (plan Appendix G).
function archetypeOwners(
  found: ReturnType<typeof inventoryPcgen>,
  classes: readonly string[],
) {
  return found.owners.flatMap((owner): ImportOwner[] =>
    owner.kind !== 'prestige' &&
    owner.className &&
    classes.includes(owner.className)
      ? [
          {
            kind: 'archetype',
            name: owner.record.locator.key.split(' ~ ')[1] ?? owner.record.name,
            baseClass: owner.className,
            locator: `pcgen:${owner.record.locator.file}#${owner.record.locator.key}`,
            ownedFeatures: found.rows.flatMap((row) =>
              row.owner === owner && row.depth === 1 && row.feature
                ? [
                    `pcgen:${row.feature.locator.file}#${row.feature.locator.key}`,
                  ]
                : [],
            ),
          },
        ]
      : [],
  );
}
const firstSlice = ['Fighter', 'Rogue', 'Ranger', 'Wizard'] as const;
const slicePlan = (
  owners: readonly ImportOwner[],
  className: string,
  max_candidates = 100,
) =>
  planImportBatches({
    selector: {
      source,
      kind: 'archetype',
      base_class: className,
      max_candidates,
    },
    owners,
  }).batches;

describe('first-slice archetype sub-batches (#716 P5)', () => {
  it('packs the pinned inputs’ ranger archetypes, Beast Master, Skirmisher and Dandy among them, under the limit', () => {
    const owners = archetypeOwners(inventory, firstSlice);
    const rangers = owners.filter(
      (owner) => owner.kind === 'archetype' && owner.baseClass === 'Ranger',
    );
    const names = rangers.map(({ name }) => name);
    expect(names).toEqual(
      expect.arrayContaining(['Beast Master', 'Skirmisher', 'Dandy']),
    );
    const batches = slicePlan(owners, 'ranger');
    expect(batches.flatMap(namesOf).sort()).toEqual([...names].sort());
    for (const batch of batches) expect(sizeOf(batch)).toBeLessThanOrEqual(100);
    // Beast Master is four features and itself; Dandy six and itself.
    const dandy = rangers.find(({ name }) => name === 'Dandy');
    expect(dandy?.ownedFeatures).toHaveLength(6);
    expect(
      rangers.find(({ name }) => name === 'Beast Master')?.ownedFeatures,
    ).toHaveLength(4);
  });
});

describe.skipIf(!pcgenCheckoutIsAtPin())(
  'optional audit: the first slice over the full local PCGen checkout (skips without it)',
  () => {
    it('packs Fighter, Rogue, Ranger and Wizard’s 1,168 records into at least 15 sub-batches of at most 100 keys', async () => {
      const full = inventoryPcgen(
        await readPcgenTree(join(pcgenCheckout, pcgenPin.directory)),
      );
      const owners = archetypeOwners(full, firstSlice);
      // Plan Appendix G: roots and directly owned features, by locator.
      const sizes = firstSlice.map((className) => {
        const own = owners.filter(
          (owner) =>
            owner.kind === 'archetype' && owner.baseClass === className,
        );
        const batches = slicePlan(owners, className);
        for (const batch of batches)
          expect(sizeOf(batch)).toBeLessThanOrEqual(100);
        expect(batches.flatMap(({ owners: picked }) => picked).sort()).toEqual(
          own.map(({ locator }) => locator).sort(),
        );
        return {
          className,
          roots: own.length,
          features: new Set(own.flatMap(({ ownedFeatures }) => ownedFeatures))
            .size,
          batches: batches.length,
        };
      });
      expect(
        sizes.map(({ className, roots, features }) => ({
          className,
          roots,
          features,
        })),
      ).toEqual([
        { className: 'Fighter', roots: 62, features: 347 },
        { className: 'Rogue', roots: 72, features: 255 },
        { className: 'Ranger', roots: 58, features: 246 },
        { className: 'Wizard', roots: 29, features: 99 },
      ]);
      expect(
        sizes.reduce((sum, { roots, features }) => sum + roots + features, 0),
      ).toBe(1_168);
      // At least the Appendix G minimum per class: 5, 4, 4 and 2.
      const minimums = { Fighter: 5, Rogue: 4, Ranger: 4, Wizard: 2 };
      for (const { className, batches } of sizes)
        expect(batches).toBeGreaterThanOrEqual(minimums[className]);
      expect(
        sizes.reduce((sum, { batches }) => sum + batches, 0),
      ).toBeGreaterThanOrEqual(15);
    }, 180_000);
  },
);
