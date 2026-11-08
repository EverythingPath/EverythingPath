// @vitest-environment node
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { pcgenPin } from '../../scripts/catalog/inventory';
import {
  ownerEvidence,
  totalsEvidence,
} from '../../scripts/catalog/pcgen/evidence';
import {
  inventoryPcgen,
  type PcgenInventory,
} from '../../scripts/catalog/pcgen/inventory';
import { readPcgenTree, type PcgenTree } from '../../scripts/catalog/pcgen/lst';
import {
  formatPrerequisite,
  isPrerequisiteToken,
  parsePrerequisite,
} from '../../scripts/catalog/pcgen/pre';
import { pcgenBooks } from '../../scripts/catalog/pcgen-books';
import { upstreamSourceSchema } from '../../src/lib/catalog/imported-entry-schema';
import evidence from '../fixtures/pcgen-716/inventory-evidence.json';
import { readPcgen716Tree } from './pcgen-716-tree';
import { pcgenCheckout, pcgenCheckoutIsAtPin } from './pinned-sources';

/**
 * #716 P3: the full inventory against the plan's appendices (`716-plan.md`).
 * `inventory-evidence.json` records the whole pinned tree's totals and the
 * rows of the owners P3, P4 and P5 rely on. The required tests read the
 * pinned inputs (`pcgen716Files`); the audit at the end regenerates the
 * evidence from a full PCGen checkout and skips without one.
 *
 * Two totals correct the plan's original script (plan §1, reconciliation):
 * - Helpers: its 94 "helper" lines included 48 ABILITYCATEGORY definitions
 *   whose parent is `CATEGORY:Archetype` (for example
 *   `ABILITYCATEGORY:Familiar Archetype`); 46 helper records remain.
 * - Case: PCGen keys ignore case, but the script's folded index kept one
 *   key's variants where two spellings exist. River Druid's Read the Currents
 *   and Master of Many Styles' Perfect Style are now each owned per variant:
 *   rows 6,083 / 7,111, records 5,917 / 6,447, cross-book rows 108 / 831,
 *   multi-variant keys 246 and shared records 254.
 */
const evidenceOwners = evidence.owners.map(({ owner }) => owner);
let tree: PcgenTree;
let inventory: PcgenInventory;
beforeAll(async () => {
  tree = await readPcgen716Tree();
  inventory = inventoryPcgen(tree);
}, 60_000);

describe('the PCGen inventory evidence', () => {
  it('is for the pinned PCGen data', () => {
    expect(evidence.pcgen).toEqual({
      commit: pcgenPin.commit,
      directory: pcgenPin.directory,
    });
  });

  it('matches the rows the reader finds in the pinned inputs', () => {
    expect(ownerEvidence(inventory, evidenceOwners)).toEqual(evidence.owners);
    expect(evidence.owners.every(({ kind }) => kind !== null)).toBe(true);
  });

  it('records the corrected Appendix A and D totals', () => {
    expect(evidence.totals.archetypeLines).toEqual({
      canonical: 1157,
      'familiar/companion': 45,
      helper: 46,
      noncanonical: 6,
      option: 4,
      'option (_pfs)': 2,
    });
    expect(evidence.totals.prestigeLines).toEqual({
      records: 98,
      names: 89,
      pfs: 1,
    });
    expect(evidence.totals.variantGroups).toEqual({
      reprint: 22,
      unchained: 12,
      'separate-keys': 3,
      'same-book-duplicate': 3,
      prestige: 9,
    });
  });

  it('records the corrected Appendix F totals', () => {
    const row = ({
      owners,
      withFeatures,
      rows,
      records,
      namePI,
      descPI,
    }: {
      owners: number;
      withFeatures: number;
      rows: [direct: number, all: number];
      records: [direct: number, all: number];
      namePI: [direct: number, all: number];
      descPI: [direct: number, all: number];
    }) => ({
      owners,
      ownersWithFeatures: withFeatures,
      rows: { direct: rows[0], all: rows[1] },
      records: { direct: records[0], all: records[1] },
      namePI: { direct: namePI[0], all: namePI[1] },
      descPI: { direct: descPI[0], all: descPI[1] },
    });
    const none: [number, number] = [0, 0];
    expect(evidence.totals.productIdentity).toEqual({
      archetypeLines: { namePI: 60, descPI: 181 },
      prestigeLines: { namePI: 24, descPI: 0 },
    });
    expect(evidence.totals.owned).toEqual({
      canonical: row({
        owners: 1157,
        withFeatures: 1126,
        rows: [4971, 5811],
        records: [4842, 5297],
        namePI: [26, 26],
        descPI: [176, 178],
      }),
      noncanonical: row({
        owners: 6,
        withFeatures: 6,
        rows: [31, 32],
        records: [31, 32],
        namePI: none,
        descPI: none,
      }),
      'familiar/companion': row({
        owners: 45,
        withFeatures: 44,
        rows: [187, 211],
        records: [183, 203],
        namePI: none,
        descPI: none,
      }),
      option: row({
        owners: 6,
        withFeatures: 0,
        rows: none,
        records: none,
        namePI: none,
        descPI: none,
      }),
      prestige: row({
        owners: 99,
        withFeatures: 98,
        rows: [894, 1057],
        records: [861, 983],
        namePI: [24, 24],
        descPI: [155, 156],
      }),
      helper: row({
        owners: 46,
        withFeatures: 0,
        rows: none,
        records: none,
        namePI: none,
        descPI: none,
      }),
      allExceptHelper: row({
        owners: 1313,
        withFeatures: 1274,
        rows: [6083, 7111],
        records: [5917, 6447],
        namePI: [50, 50],
        descPI: [331, 334],
      }),
    });
  });

  it('records the corrected Appendix G resolution totals', () => {
    const { totals } = evidence;
    expect(totals.resolution).toEqual({
      direct: {
        'same-pack': 5498,
        'same-pack, variants kept': 461,
        'other-pack': 124,
      },
      all: {
        'same-pack': 5755,
        'same-pack, variants kept': 506,
        'other-pack': 848,
        unresolved: 2,
      },
    });
    expect({
      selectorGrants: totals.selectorGrants,
      multiVariantKeys: totals.multiVariantKeys,
      crossBookRows: totals.crossBookRows,
      copyRows: totals.copyRows,
      sharedRecords: totals.sharedRecords,
      directRecordsWithoutDesc: totals.directRecordsWithoutDesc,
    }).toEqual({
      selectorGrants: 8,
      multiVariantKeys: 246,
      crossBookRows: { direct: 108, all: 831 },
      copyRows: 0,
      sharedRecords: 254,
      directRecordsWithoutDesc: 96,
    });
    expect(totals.unresolved).toEqual([
      {
        key: 'Druid ~ Wildshape',
        owner:
          'player_companion/people_of_the_stars/pots_abilities_class.lst:8',
      },
      {
        key: 'Druid ~ Wildshape',
        owner:
          'player_companion/people_of_the_stars/pots_abilities_race.lst:118',
      },
    ]);
  });
});

describe('the PCGen inventory of the pinned inputs', () => {
  it('lists the noncanonical keys and options (Appendix B)', () => {
    expect(
      inventory.owners
        .filter(({ kind }) => kind === 'noncanonical' || kind === 'option')
        .map(({ kind, className, record }) => [
          kind,
          record.locator.key,
          className,
          record.book,
          `${record.locator.file}:${record.locator.line}`,
        ]),
    ).toEqual([
      [
        'noncanonical',
        'Unchained Summoner ~ Devil Impostor',
        null,
        'Agents of Evil',
        'player_companion/agents_of_evil/support/aoe_abilities_class_pu.lst:7',
      ],
      [
        'noncanonical',
        'Cold Iron Warden',
        null,
        "Demon Hunter's Handbook",
        'player_companion/demon_hunters_handbook/dhh_abilities.lst:10',
      ],
      [
        'option',
        'Monk Archetype ~ Alternate Alignment',
        'Monk',
        "Disciple's Doctrine",
        'player_companion/disciples_doctrine/dd_abilities_class.lst:10',
      ],
      [
        'noncanonical',
        'Bloodrager Archetype - Urban Bloodrager',
        null,
        'Heroes of the Streets',
        'player_companion/heroes_of_the_street/hots_abilities_class.lst:28',
      ],
      [
        'noncanonical',
        'Hunter Archetype - Urban Hunter',
        null,
        'Heroes of the Streets',
        'player_companion/heroes_of_the_street/hots_abilities_class.lst:83',
      ],
      [
        'option',
        'Antipaladin Archetype ~ Alternate Alignment',
        'Antipaladin',
        "Advanced Player's Guide",
        'roleplaying_game/advanced_players_guide/apg_abilities_class.lst:993',
      ],
      [
        'noncanonical',
        'Fell Rider ~ Cavalier Archetype',
        'Cavalier',
        'Advanced Race Guide',
        'roleplaying_game/advanced_race_guide/arg_abilities_class.lst:568',
      ],
      [
        'noncanonical',
        'Wishcrafter ~ Sorcerer Archetype',
        'Sorcerer',
        'Advanced Race Guide',
        'roleplaying_game/advanced_race_guide/arg_abilities_class.lst:610',
      ],
      [
        'option',
        'Wizard / Remove Scribe Scroll',
        null,
        'Core Rulebook',
        'roleplaying_game/core_rulebook/cr_abilities_class.lst:2745',
      ],
      [
        'option',
        'Remove Alchemist Brew Potion',
        null,
        'Core Rulebook',
        'roleplaying_game/core_rulebook/_pfs/pfs_cr_abilities.lst:5',
      ],
      [
        'option',
        'Remove Cavalier Expert Trainer',
        null,
        'Core Rulebook',
        'roleplaying_game/core_rulebook/_pfs/pfs_cr_abilities.lst:6',
      ],
      [
        'option',
        'Paladin Archetype ~ Alternate Alignment',
        'Paladin',
        'Ultimate Intrigue',
        'roleplaying_game/ultimate_intrigue/ui_abilities_class.lst:583',
      ],
    ]);
  });

  it('gives every owner a crosswalked book and a schema-valid locator', () => {
    const books = new Set(pcgenBooks.books.map(({ book }) => book));
    for (const { kind, record } of inventory.owners) {
      upstreamSourceSchema.parse({ source: 'pcgen', locator: record.locator });
      if (kind !== 'helper' && kind !== 'option' && !record.isPfs)
        expect(books.has(record.book), record.book).toBe(true);
    }
    for (const { feature } of inventory.rows)
      if (feature)
        upstreamSourceSchema.parse({
          source: 'pcgen',
          locator: feature.locator,
        });
  });

  it('parses every prerequisite of every owner and feature record back to its token', () => {
    const lines: { tokens: readonly string[] }[] = [
      ...inventory.owners.flatMap((owner): { tokens: string[] }[] =>
        owner.kind === 'prestige' ? owner.record.classLines : [owner.record],
      ),
      ...[...tree.features.values()].flat(),
    ];
    let parsed = 0;
    for (const { tokens } of lines)
      for (const token of tokens.slice(1))
        if (isPrerequisiteToken(token)) {
          expect(formatPrerequisite(parsePrerequisite(token))).toBe(token);
          parsed += 1;
        }
    expect(parsed).toBeGreaterThan(1_000);
  });
});

const isPcgenCheckoutAtPin = pcgenCheckoutIsAtPin();
describe.skipIf(!isPcgenCheckoutAtPin)(
  'optional audit: the evidence against the full local PCGen checkout (skips without it)',
  () => {
    let fullInventory: PcgenInventory;
    beforeAll(async () => {
      fullInventory = inventoryPcgen(
        await readPcgenTree(join(pcgenCheckout, pcgenPin.directory)),
      );
    }, 120_000);

    it('regenerates the committed totals and owner rows', () => {
      expect(totalsEvidence(fullInventory)).toEqual(evidence.totals);
      expect(ownerEvidence(fullInventory, evidenceOwners)).toEqual(
        evidence.owners,
      );
    });

    it('names a crosswalked book for every owner of the 92 books', () => {
      const owned = new Set(
        fullInventory.owners
          .filter(
            ({ kind, record }) =>
              kind !== 'helper' && kind !== 'option' && !record.isPfs,
          )
          .map(({ record }) => record.book),
      );
      const books = new Set(pcgenBooks.books.map(({ book }) => book));
      expect([...owned].filter((book) => !books.has(book))).toEqual([]);
      expect(owned.size).toBe(92);
    });
  },
);
