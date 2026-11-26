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
const select2 = { kind: 'coverage', slice: 'archetype-select-2' } as const;
const select3 = { kind: 'coverage', slice: 'archetype-select-3' } as const;
/** archetype-select-2's owners by class. */
const select2Owners = {
  Cavalier: 26,
  Ranger: 48,
  Rogue: 59,
  Alchemist: 42,
  Paladin: 45,
  Fighter: 46,
  Barbarian: 34,
  Monk: 5,
};
/** archetype-select-3's owners by class. */
const select3Owners = {
  Bloodrager: 17,
  Druid: 58,
  Inquisitor: 26,
  Bard: 52,
  Magus: 19,
  Slayer: 17,
  Witch: 28,
  Summoner: 17,
  Wizard: 23,
  'Monk (Unchained)': 3,
  Cleric: 23,
  Oracle: 20,
  Sorcerer: 14,
  Investigator: 22,
  Skald: 13,
  Antipaladin: 9,
  Hunter: 14,
  Shifter: 8,
  Brawler: 13,
  Samurai: 2,
  Ninja: 1,
  'Summoner (Unchained)': 2,
  Vigilante: 14,
};
const select2End = 41 + Object.values(select2Owners).reduce((a, b) => a + b);
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
    const coverageOwners = reviewedOwnerSelection.slice(6, 41);
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
    // The one archetype it kept of the six clear ones that change class
    // skills; archetype-select-2 selects the other five.
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

  it('selects each class archetype-select-2 covers after them', () => {
    const counts: Record<string, number> = {};
    for (const entry of reviewedOwnerSelection.slice(41, select2End)) {
      expect(entry.reason).toEqual(select2);
      if (entry.kind === 'archetype')
        counts[entry.className] = (counts[entry.className] ?? 0) + 1;
    }
    expect(counts).toEqual(select2Owners);
    expect(
      reviewedOwnerSelection
        .slice(41, select2End)
        .filter(({ key }) => key.startsWith('Monk Archetype ~ '))
        .map(({ key }) => key),
    ).toEqual([
      'Monk Archetype ~ Terra-Cotta Monk',
      'Monk Archetype ~ Wanderer',
      'Monk Archetype ~ Karmic Monk',
      'Monk Archetype ~ Sensei',
      'Monk Archetype ~ Sage Counselor',
    ]);
  });

  it('selects each class archetype-select-3 covers after them', () => {
    const counts: Record<string, number> = {};
    for (const entry of reviewedOwnerSelection.slice(select2End)) {
      expect(entry.reason).toEqual(select3);
      if (entry.kind === 'archetype')
        counts[entry.className] = (counts[entry.className] ?? 0) + 1;
    }
    expect(counts).toEqual(select3Owners);
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

  it('names every problem of a selection at once', () => {
    // archetype-select-2 (review follow-up): a wrong class no longer hides
    // the other owners' problems.
    const refusal = (run: () => unknown) => {
      try {
        run();
      } catch (error) {
        return (error as Error).message;
      }
      throw new Error('The selection was not refused.');
    };
    const message = refusal(
      emit([
        { ...scaledFist, className: 'Wizard' },
        harrowWarden,
        elementalMonk,
        monk(lod, 'No Such Archetype'),
      ]),
    );
    expect(message).toContain(
      `Monk Archetype ~ Scaled Fist (${lod}) is a Monk archetype, not a Wizard one.`,
    );
    expect(message).toContain(
      'Monk Archetype ~ Harrow Warden (player_companion/harrow_handbook/hh_abilities_class.lst) is flagged Product Identity on everythingpath/monk-harrow-warden.',
    );
    expect(message).toContain(
      'Monk Archetype ~ Elemental Monk (player_companion/disciples_doctrine/dd_abilities_class.lst) is on PZO9488, whose notice is not reviewed.',
    );
    expect(message).toContain(
      `Selected owner Monk Archetype ~ No Such Archetype (${lod}) is not in the PCGen tree.`,
    );
  });
});

// Over the whole pinned checkout, when it is present (a host audit): what
// the committed selection emits with no structure record applied, so a
// record batch never moves it, as archetype-select-monk, archetype-select-2
// and archetype-select-3 measured it. archetype-mapper-2's text
// disagreements (altersText, textReplaces) add 112 items, holding 20
// archetypes on their own items that were unheld before (244); its owned
// Internal records with spell levels add 13 rows (3,983 before) and 13
// casting-contract items, which hold 7 more (224 after the text items),
// and 13 owned features to review (3,351 before). Its unemittedGrant items
// (fix r0), each a granted record the import neither emits nor reads, add
// 159 unmatchedReplacement items (754 before) and hold 3 more archetypes
// on their own items (217 unheld before). Fix r1 drops the text items that
// don't disagree (a comparison with no feature of the class, a replaces
// list read past its verb, an alteration of the parts a sentence keeps):
// 913 unmatchedReplacement and 173 uncheckedCasting before, 214 unheld
// (217 after it); its sentence items for a replacement it can't attribute
// to one feature, and its reading of a part removal's alteration as of the
// kept rows, leave 216 (897 unmatchedReplacement before). Fix r3 reads
// the Gingerbread Witch's "alters familiar" as the Witch's Familiar its
// flags mark touched, dropping its sentence item (899 before); she stays
// held on her other items. archetype-race-eligibility holds Mooncursed's
// creature-type race requirement as an uncheckedRequirement (she was held
// already), the one race token among the selection it can't type.
const audit = {
  archetypes: 755,
  rows: 3996,
  unheld: 216,
  items: {
    conflict: 401,
    uncheckedCasting: 171,
    uncheckedRequirement: 1,
    unmatchedReplacement: 898,
  },
  features: 3364,
};
type Emission = ReturnType<typeof emitPcgenOwners>;
let emissions: ReturnType<typeof emitWhole> | undefined;
/** The whole checkout's emissions, once for the audit's tests. */
const wholeEmissions = () => (emissions ??= emitWhole());
const emitWhole = async () => {
  const whole = await readPcgenTree(`${pcgenCheckout}/${pcgenPin.directory}`);
  const committed = parseCuration(curation);
  const party = emitPcgenOwners({
    tree: whole,
    data: committed,
    selection: partySelection,
  });
  const partyKeys = new Set(
    party.entries.map(({ externalKey }) => externalKey),
  );
  return {
    party,
    partyKeys,
    isAdded: ({ externalKey }: { externalKey: string }) =>
      !partyKeys.has(externalKey),
    // `data` is the committed curation without its structure records.
    bare: emitPcgenOwners({ tree: whole, data }),
    all: emitPcgenOwners({ tree: whole, data: committed }),
    checkedRecordKeys: new Set(
      (committed.structures ?? [])
        .filter(({ status }) => status === 'checked')
        .map(({ externalKey }) => externalKey),
    ),
  };
};
const heldOn = ({ reviewHolds }: Emission) => {
  const holds = new Map(
    reviewHolds.map(({ externalKey, reason }) => [externalKey, reason]),
  );
  return (key: string) =>
    holds.get(key)?.startsWith('Structure hand review') ?? false;
};
const keyed = (refs: readonly object[]) =>
  refs.map((ref) => JSON.stringify(ref));
describe.skipIf(!pcgenCheckoutIsAtPin())(
  'optional audit: the reviewed selection over the full local PCGen checkout (skips without it)',
  () => {
    it('emits the coverage archetypes, with no structure record applied, each row held on structure review or omitted behind a held feature, and the party owners as they emit alone', async () => {
      const { party, partyKeys, isAdded, bare, all } = await wholeEmissions();
      expect(
        all.entries.filter(({ externalKey }) => partyKeys.has(externalKey)),
      ).toEqual(party.entries);
      expect(
        all.reviewHolds.filter(({ externalKey }) => partyKeys.has(externalKey)),
      ).toEqual(party.reviewHolds);
      const added = bare.entries.filter(isAdded);
      // archetype-select-monk: 35 archetypes, 239 rows; then archetype-select-2.
      expect(added).toHaveLength(audit.rows);
      expect(
        added.filter(({ detail }) => detail.kind === 'archetype'),
      ).toHaveLength(audit.archetypes);
      const isHeld = heldOn(bare);
      // An archetype that raises no item of its own passes the gate, but
      // admission omits it while a feature it adds is held.
      const unheld = added.filter(({ externalKey }) => !isHeld(externalKey));
      expect(unheld).toHaveLength(audit.unheld);
      expect(
        unheld.filter(
          ({ detail }) =>
            detail.kind !== 'archetype' ||
            !detail.adds.length ||
            !detail.adds.every(({ externalKey }) => isHeld(externalKey)),
        ),
      ).toEqual([]);
      const kinds: Record<string, number> = {};
      for (const { kind } of bare.structure.handReview.filter(isAdded))
        kinds[kind] = (kinds[kind] ?? 0) + 1;
      expect(kinds).toEqual(audit.items);
      expect(bare.structure.unreviewedFeatures.filter(isAdded)).toHaveLength(
        audit.features,
      );
    }, 120_000);

    it('lets only the committed checked structure records release a coverage row: every other row stays as it emits bare', async () => {
      const { isAdded, bare, all, checkedRecordKeys } = await wholeEmissions();
      const applied = new Set(
        all.structure.applied.map(({ externalKey }) => externalKey),
      );
      // The same rows; a row's content moves only under a record applied to it.
      expect(all.entries.map(({ externalKey }) => externalKey)).toEqual(
        bare.entries.map(({ externalKey }) => externalKey),
      );
      expect(
        all.entries.filter(
          (entry, at) =>
            !applied.has(entry.externalKey) &&
            JSON.stringify(entry) !== JSON.stringify(bare.entries[at]),
        ),
      ).toEqual([]);
      // A record only settles: nothing is held that was not held bare.
      const bareItems = new Set(keyed(bare.structure.handReview));
      expect(
        keyed(all.structure.handReview).filter((item) => !bareItems.has(item)),
      ).toEqual([]);
      const bareFeatures = new Set(keyed(bare.structure.unreviewedFeatures));
      expect(
        keyed(all.structure.unreviewedFeatures).filter(
          (feature) => !bareFeatures.has(feature),
        ),
      ).toEqual([]);
      const heldBare = heldOn(bare);
      const isHeld = heldOn(all);
      const added = all.entries.filter(isAdded);
      expect(
        added.filter(
          ({ externalKey }) => isHeld(externalKey) && !heldBare(externalKey),
        ),
      ).toEqual([]);
      // A row held bare passes only on a checked record that names it, and a
      // row bare omitted behind its features passes only when each is held
      // or so released.
      const released = new Set(
        added
          .map(({ externalKey }) => externalKey)
          .filter((key) => heldBare(key) && !isHeld(key)),
      );
      expect(
        [...released].filter((key) => !checkedRecordKeys.has(key)),
      ).toEqual([]);
      expect(
        added.filter(
          ({ externalKey, detail }) =>
            !isHeld(externalKey) &&
            !released.has(externalKey) &&
            (detail.kind !== 'archetype' ||
              !detail.adds.length ||
              !detail.adds.every(
                (add) =>
                  isHeld(add.externalKey) || released.has(add.externalKey),
              )),
        ),
      ).toEqual([]);
    }, 120_000);

    it('passes archetype-monk-1’s 44 rows on the structure gate but Flowing Monk’s drafted Bonus Feat', async () => {
      const { isAdded, all } = await wholeEmissions();
      const added = all.entries.filter(isAdded);
      const isHeld = heldOn(all);
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
    }, 120_000);
  },
);
