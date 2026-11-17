// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseCuration } from '../../scripts/catalog/curation';
import {
  emitPcgenOwners,
  pcgenOwnerSelection,
  type PcgenOwnerSelector,
} from '../../scripts/catalog/pcgen-owners';
import {
  reviewedOwnerSelection,
  type SelectedOwner,
} from '../../scripts/catalog/pcgen/owner-selection';
import { pcgenOwnerEmissionFiles } from '../fixtures/pcgen-716/owner-emission-files';
import { pcgenPin } from '../../scripts/catalog/inventory';
import { readPcgenTree } from '../../scripts/catalog/pcgen/lst';
import { readPcgenFixtureTree } from './pcgen-716-tree';
import { pcgenCheckout, pcgenCheckoutIsAtPin } from './pinned-sources';

// archetype-select-monk: the importer's PCGen owners are reviewed data, one
// entry per owner with the reason it is selected, and every selection must
// pass a rule decided from the pinned records, never by an entry's say-so.

const tree = await readPcgenFixtureTree([
  ...new Set([
    ...pcgenOwnerEmissionFiles,
    'player_companion/disciples_doctrine/_disciples_doctrine.pcc',
    'player_companion/disciples_doctrine/dd_abilities_class.lst',
    'player_companion/harrow_handbook/_harrow_handbook.pcc',
    'player_companion/harrow_handbook/hh_abilities_class.lst',
    'player_companion/occult_origins/_occult_origins.pcc',
    'player_companion/occult_origins/oo_abilities_class.lst',
    // rotation-3: Beast Master and Dandy, a frozen pair of Ranger archetypes
    // that both change the class skills.
    'roleplaying_game/advanced_players_guide/advanced_players_guide.pcc',
    'roleplaying_game/advanced_players_guide/apg_abilities_class.lst',
    'roleplaying_game/ultimate_intrigue/_ultimate_intrigue.pcc',
    'roleplaying_game/ultimate_intrigue/ui_abilities_class.lst',
  ]),
]);
const curation = JSON.parse(
  await readFile('scripts/catalog/reviewed-curation.json', 'utf8'),
) as Record<string, unknown>;
const data = parseCuration({ ...curation, structures: [] });

type ArchetypeSelector = Extract<PcgenOwnerSelector, { kind: 'archetype' }>;
const monk = (file: string, name: string): ArchetypeSelector => ({
  kind: 'archetype',
  className: 'Monk',
  file,
  key: `Monk Archetype ~ ${name}`,
});
const lod = 'player_companion/legacy_of_dragons/lod_abilities_class.lst';
const acg = 'roleplaying_game/advanced_class_guide/acg_abilities_class.lst';
const scaledFist = monk(lod, 'Scaled Fist');
const harrowWarden = monk(
  'player_companion/harrow_handbook/hh_abilities_class.lst',
  'Harrow Warden',
);
const elementalMonk = monk(
  'player_companion/disciples_doctrine/dd_abilities_class.lst',
  'Elemental Monk',
);
const serpentFire = monk(
  'player_companion/occult_origins/oo_abilities_class.lst',
  'Serpent-Fire Adept',
);
const ranger = (file: string, name: string): ArchetypeSelector => ({
  kind: 'archetype',
  className: 'Ranger',
  file,
  key: `Ranger Archetype ~ ${name}`,
});
const beastMaster = ranger(
  'roleplaying_game/advanced_players_guide/apg_abilities_class.lst',
  'Beast Master',
);
const dandy = ranger(
  'roleplaying_game/ultimate_intrigue/ui_abilities_class.lst',
  'Dandy',
);
const ecclesitheurge: PcgenOwnerSelector = {
  kind: 'archetype',
  className: 'Cleric',
  file: acg,
  key: 'Cleric Archetype ~ Ecclesitheurge',
};
const emit =
  (
    selection: readonly PcgenOwnerSelector[],
    reviewed?: readonly SelectedOwner[],
  ) =>
  () =>
    emitPcgenOwners({
      tree,
      data,
      selection,
      ...(reviewed && { reviewed }),
    });
/** The committed selection with these owners' reasons replaced. */
const reviewedAs = (
  reason: SelectedOwner['reason'],
  ...selectors: PcgenOwnerSelector[]
): SelectedOwner[] => [
  ...reviewedOwnerSelection.filter(
    ({ file, key }) =>
      !selectors.some((one) => one.file === file && one.key === key),
  ),
  ...selectors.map((selector) => ({ ...selector, reason })),
];
const coverage = { kind: 'coverage', slice: 'archetype-select-monk' } as const;
const partySelection = reviewedOwnerSelection
  .filter(({ reason }) => reason.kind === 'party')
  .map(({ reason: _reason, ...selector }) => selector);

describe('the reviewed owner selection (archetype-select-monk)', () => {
  it("keeps the party's six owners first, as they were selected", () => {
    expect(pcgenOwnerSelection.slice(0, 6)).toEqual([
      {
        kind: 'archetype',
        className: 'Wizard',
        file: acg,
        key: 'Wizard Archetype ~ Exploiter Wizard',
      },
      ecclesitheurge,
      {
        kind: 'archetype',
        className: 'Magus',
        file: 'roleplaying_game/ultimate_magic/um_abilities_class.lst',
        key: 'Magus Archetype ~ Bladebound',
      },
      {
        kind: 'archetype',
        className: 'Barbarian',
        file: 'player_companion/animal_archive/anar_abilities_class.lst',
        key: 'Barbarian Archetype ~ Mad Dog',
      },
      scaledFist,
      {
        kind: 'prestige',
        file: 'roleplaying_game/core_rulebook/cr_classes.lst',
        key: 'Dragon Disciple',
      },
    ]);
    expect(
      reviewedOwnerSelection.slice(0, 6).map(({ reason }) => reason.kind),
    ).toEqual(Array(6).fill('party'));
  });

  it('selects 35 Monk archetypes for archetype-select-monk after the party', () => {
    const coverageOwners = reviewedOwnerSelection.slice(6);
    expect(coverageOwners).toHaveLength(35);
    expect(
      coverageOwners.every(
        (entry) =>
          entry.kind === 'archetype' &&
          entry.className === 'Monk' &&
          entry.reason.kind === 'coverage' &&
          entry.reason.slice === 'archetype-select-monk',
      ),
    ).toBe(true);
    // The one archetype kept of the six clear ones that change class skills.
    expect(
      coverageOwners.filter(({ key }) =>
        [
          'Monk Archetype ~ Serpent-Fire Adept',
          'Monk Archetype ~ Terra-Cotta Monk',
          'Monk Archetype ~ Wanderer',
          'Monk Archetype ~ Karmic Monk',
          'Monk Archetype ~ Sensei',
          'Monk Archetype ~ Sage Counselor',
        ].includes(key),
      ),
    ).toEqual([{ ...serpentFire, reason: coverage }]);
  });

  it('is each reviewed entry without its reason, every owner once', () => {
    expect(pcgenOwnerSelection).toEqual(
      reviewedOwnerSelection.map(
        ({ reason: _reason, ...selector }) => selector,
      ),
    );
    const locators = pcgenOwnerSelection.map(
      ({ file, key }) => `${file}#${key}`,
    );
    expect(new Set(locators).size).toBe(locators.length);
  });
});

describe('the selection rule (archetype-select-monk)', () => {
  it('refuses a coverage owner flagged Product Identity on itself', () => {
    expect(emit([harrowWarden])).toThrow(
      'Monk Archetype ~ Harrow Warden (player_companion/harrow_handbook/hh_abilities_class.lst) is flagged Product Identity on everythingpath/monk-harrow-warden.',
    );
    expect(emit([scaledFist], reviewedAs(coverage, scaledFist))).toThrow(
      `Monk Archetype ~ Scaled Fist (${lod}) is flagged Product Identity on everythingpath/monk-scaled-fist.`,
    );
  });

  it('refuses a coverage owner one of whose features is flagged Product Identity', () => {
    expect(
      emit([ecclesitheurge], reviewedAs(coverage, ecclesitheurge)),
    ).toThrow(
      `Cleric Archetype ~ Ecclesitheurge (${acg}) is flagged Product Identity on everythingpath/cleric-ecclesitheurge-domain-mastery.`,
    );
  });

  it('lets a party owner keep its Product Identity flags, which hold it on attribution', () => {
    expect(emit([scaledFist, ecclesitheurge])).not.toThrow();
  });

  it('refuses a party owner no party build names', () => {
    expect(
      emit([harrowWarden], reviewedAs({ kind: 'party' }, harrowWarden)),
    ).toThrow(
      'Monk Archetype ~ Harrow Warden (player_companion/harrow_handbook/hh_abilities_class.lst) is selected for the party, but no party build names it.',
    );
  });

  it('refuses an owner on a book whose notice is not reviewed', () => {
    // Disciple's Doctrine (PZO9488): its Section 15 confirmation is a mismatch.
    expect(emit([elementalMonk])).toThrow(
      'Monk Archetype ~ Elemental Monk (player_companion/disciples_doctrine/dd_abilities_class.lst) is on PZO9488, whose notice is not reviewed.',
    );
  });

  it('selects two archetypes of one class that both change the class skills, each held only on its own items', () => {
    // rotation-3: the sheet warns the Character who takes both (APG p.72),
    // so the pair is selectable and neither is held for the other.
    const reviewed = reviewedAs(coverage, beastMaster, dandy);
    const pair = emit([beastMaster, dandy], reviewed)();
    const itemsOf = (
      emission: ReturnType<ReturnType<typeof emit>>,
      key: string,
    ) =>
      emission.structure.handReview
        .filter(({ externalKey }) => externalKey === key)
        .map(({ kind, id }) => `${kind} ${id}`);
    for (const [key, selector] of [
      ['everythingpath/ranger-beast-master', beastMaster],
      ['everythingpath/ranger-dandy', dandy],
    ] as const) {
      expect(
        pair.entries.find(({ externalKey }) => externalKey === key)?.detail,
      ).toMatchObject({ kind: 'archetype', changesClassSkills: true });
      const own = itemsOf(emit([selector], reviewed)(), key);
      expect(own.length).toBeGreaterThan(0);
      expect(itemsOf(pair, key)).toEqual(own);
      expect(own.filter((item) => item.includes('classSkills:'))).toEqual([]);
    }
  });

  it('refuses a coverage owner that gives the structure gate nothing to review', () => {
    // Ultimate Magic's Vow Monk record owns no feature and raises no item.
    expect(
      emit([
        monk(
          'roleplaying_game/ultimate_magic/um_abilities_class.lst',
          'Vow Monk',
        ),
      ]),
    ).toThrow(
      'Monk Archetype ~ Vow Monk (roleplaying_game/ultimate_magic/um_abilities_class.lst) gives the structure gate nothing to review, so it would be admitted unreviewed.',
    );
  });

  it('refuses an archetype selected under another class', () => {
    expect(emit([{ ...scaledFist, className: 'Wizard' }])).toThrow(
      `Monk Archetype ~ Scaled Fist (${lod}) is a Monk archetype, not a Wizard one.`,
    );
  });
});

// Over the whole pinned checkout, when it is present (a host audit): the
// committed selection emits as archetype-select-monk measured it, less what
// archetype-monk-1's checked structure records settle.
describe.skipIf(!pcgenCheckoutIsAtPin())(
  'optional audit: the reviewed selection over the full local PCGen checkout (skips without it)',
  () => {
    it('emits the 35 Monk archetypes as 239 rows: archetype-monk-1’s 44 rows pass the structure gate but Flowing Monk’s drafted Bonus Feat, every other row is held on structure review or omitted behind a held feature, and the party owners emit as they do alone', async () => {
      const whole = await readPcgenTree(
        `${pcgenCheckout}/${pcgenPin.directory}`,
      );
      const committed = parseCuration(curation);
      const all = emitPcgenOwners({ tree: whole, data: committed });
      const party = emitPcgenOwners({
        tree: whole,
        data: committed,
        selection: partySelection,
      });
      const partyKeys = new Set(
        party.entries.map(({ externalKey }) => externalKey),
      );
      expect(
        all.entries.filter(({ externalKey }) => partyKeys.has(externalKey)),
      ).toEqual(party.entries);
      expect(
        all.reviewHolds.filter(({ externalKey }) => partyKeys.has(externalKey)),
      ).toEqual(party.reviewHolds);
      const added = all.entries.filter(
        ({ externalKey }) => !partyKeys.has(externalKey),
      );
      expect(added).toHaveLength(239);
      expect(
        added.filter(({ detail }) => detail.kind === 'archetype'),
      ).toHaveLength(35);
      const holds = new Map(
        all.reviewHolds.map(({ externalKey, reason }) => [externalKey, reason]),
      );
      const isHeld = (key: string) =>
        holds.get(key)?.startsWith('Structure hand review') ?? false;
      // archetype-monk-1 (archetype-structures-679.md): the record step
      // checked 36 of its 37 records; Flowing Monk's Bonus Feat stays drafted,
      // so it alone of the batch's 44 rows is held.
      const reviewed = new Set(
        [
          'flowing-monk',
          'hungry-ghost-monk',
          'monk-of-the-four-winds',
          'monk-of-the-healing-hand',
          'monk-of-the-lotus',
          'monk-of-the-sacred-mountain',
          'monk-of-the-seven-forms',
          'weapon-adept',
        ].map((slug) => `everythingpath/monk-${slug}`),
      );
      const batchKeys = new Set(
        added.flatMap(({ externalKey, detail }) =>
          reviewed.has(externalKey) && detail.kind === 'archetype'
            ? [externalKey, ...detail.adds.map((add) => add.externalKey)]
            : [],
        ),
      );
      expect(batchKeys.size).toBe(44);
      expect([...batchKeys].filter(isHeld)).toEqual([
        'everythingpath/monk-flowing-monk-bonus-feat',
      ]);
      // An archetype that raises no item of its own passes the gate, but
      // admission omits it while a feature it adds is held.
      const unheld = added.filter(
        ({ externalKey }) =>
          !batchKeys.has(externalKey) && !isHeld(externalKey),
      );
      expect(unheld).toHaveLength(8);
      expect(
        unheld.filter(
          ({ detail }) =>
            detail.kind !== 'archetype' ||
            !detail.adds.length ||
            !detail.adds.every(({ externalKey }) => isHeld(externalKey)),
        ),
      ).toEqual([]);
      const isAdded = ({ externalKey }: { externalKey: string }) =>
        !partyKeys.has(externalKey);
      const kinds: Record<string, number> = {};
      for (const { kind } of all.structure.handReview.filter(isAdded))
        kinds[kind] = (kinds[kind] ?? 0) + 1;
      expect(kinds).toEqual({ conflict: 8, unmatchedReplacement: 23 });
      expect(all.structure.unreviewedFeatures.filter(isAdded)).toHaveLength(
        169,
      );
    }, 60_000);
  },
);
