// @vitest-environment node
// domain-powers-1 (PRD #251; GLOSSARY: Per-day maximum; owner 2026-11-17: the
// maximum only, no tally, no uses remaining, no reset): the per-day records of
// four 1st-level domain powers, each "a number of times per day equal to 3 +
// your Wisdom modifier", with no level term. domain-powers-1 held all four
// (ORCH domain-powers-1-boundary.md §2): two favored-class rewards of
// campaign-mvp-v1 add half a use a day of one chosen such power per
// selection. domain-power-reward-terms (ORCH
// domain-power-reward-terms-boundary.md): each formula now reads the count of
// every reward that changes its key (`@favoredClassReward.clericDomainPowerUse`,
// and for Fire Bolt `@favoredClassReward.druidDomainPowerUse` too), the halves
// added and rounded down; the record step checked the four on their
// promotion review (phase 2, `promotionRun`). As committed the sheet shows
// each power's uses on its own row, with the rewards; the cases checked in
// memory check the records as the record step did and give the same.
// Characters are numbers (party-builds.json); every case runs on the pinned
// tree.
import { copyFile, readFile } from 'node:fs/promises';
import { afterAll, describe, expect, it } from 'vitest';
import { hashText, type RuleValueRecord } from '../../scripts/catalog/curation';
import { importCatalog } from '../../scripts/catalog/import';
import { pcgenPin } from '../../scripts/catalog/inventory';
import { pcgenOwnerSelection } from '../../scripts/catalog/pcgen-owners';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import {
  calculateCharacterSheet,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type RuleValue,
  type SheetEntry,
} from '../../src/lib/character-sheet';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { abilityTargets } from '../../src/lib/character-sheet-abilities';
import {
  activeRaceIdentities,
  favoredClassRewardsFitting,
  levelClassIdentities,
  reviewedFavoredClassRewards,
  rewardRaceIdentities,
} from '../../src/lib/character-sheet-favored-class-rewards';
import {
  ownerEmissionFoundryFiles,
  pcgenOwnerEmissionFiles,
} from '../fixtures/pcgen-716/owner-emission-files';
import { materializePinnedTree } from './pinned-sources';
import {
  character,
  type Artifact,
  type CharacterOptions,
  type ClassLevels,
} from './rule-value-sheets';

const classes = {
  cleric: 'pf1/SjFqQceVeVBzBwgn',
  druid: 'pf1/7eZQP0MzeO2svmVF',
  inquisitor: 'pf1/Fv3FbmXptuDRiL5y',
  monk: 'pf1/W8dxwZ1CZiwLKsqr',
} as const;
const ecclesitheurge = 'everythingpath/cleric-ecclesitheurge';
const vow = 'everythingpath/cleric-ecclesitheurge-ecclesitheurges-vow';
const powers = {
  fireBolt: 'pf1/V57hEfKt1MroRI91',
  rebukeDeath: 'pf1/8iWGEKKdoKTHsDy5',
  touchOfGlory: 'pf1/0BFuaPpChxXneJwF',
  restorativeTouch: 'pf1/PDiHqRkoHr3AeTUv',
} as const;
const domains = {
  fire: 'pf1/KbcnBk7n4tctvnI9',
  healing: 'pf1/lqCm6Fy7JVezprqU',
  glory: 'pf1/RL0hOHIz4MnsVgv9',
  restoration: 'pf1/nKiYWIhQdZuRzkU7',
} as const;
/**
 * The half uses of the Cleric's reward on a power, rounded down
 * (domain-power-reward-terms boundary §2).
 */
const clericHalves =
  '3 + @ability.wis.mod + floor(@favoredClassReward.clericDomainPowerUse / 2)';
/** Fire Bolt's: the Cleric's and the Druid's halves added, then rounded down. */
const bothHalves =
  '3 + @ability.wis.mod + floor((@favoredClassReward.clericDomainPowerUse + @favoredClassReward.druidDomainPowerUse) / 2)';
/** The domain powers' records, as the boundary gives them (§1). */
const expected = [
  [powers.touchOfGlory, 'classFeat_touchOfGlory', clericHalves],
  [powers.rebukeDeath, 'classFeat_rebukeDeath', clericHalves],
  [powers.restorativeTouch, 'classFeat_restorativeTouch', clericHalves],
  [powers.fireBolt, 'classFeat_fireBolt', bothHalves],
] as const;
const maximum = (key: string, formula: string): RuleValue => ({
  kind: 'dailyMaximum',
  key,
  unit: 'uses',
  amount: { formula },
});
/** The captured review the record step checked the four on (phase 2). */
const promotionRun =
  't3-review-76b8733dffd0c1a52c6a40eafc3197417b5b05dd8179b392e1c714b9555f23ab';
/** How each record's rationale starts: sent to the promotion review, then why its number is right. */
const promotionLead =
  'For promotion (domain-power-reward-terms): its formula now counts the ';

const domainPowerKeys = new Set<string>(Object.values(powers));
const allRecords = reviewedCuration.ruleValues ?? [];
const committed = allRecords.filter(({ externalKey }) =>
  domainPowerKeys.has(externalKey),
);

const foundry = (path: string) => `pf1/packs/${path}.yaml`;
/** Dragon Soul (pf1-content/IsWc0OR9iZHYdi8V, campaign-mvp-v1), a Half-Elf alternate racial trait. */
const dragonSoul = 'pf1-content/IsWc0OR9iZHYdi8V';
const dragonSoulFile = 'src/pf-racial-traits/Dragon_Soul_IsWc0OR9iZHYdi8V.yaml';
/** Elf Blood, the Half-Elf's standard trait Dragon Soul replaces. */
const elfBlood = 'pf1-content/rzYk40R1rWSfay4a';
/** Multitalented, the Half-Elf's standard trait of two favored classes, and Adaptability. */
const multitalented = 'pf1-content/srOpqbXesXBuvTqe';
const adaptability = 'pf1-content/wZZzaSmiF8hTuRo7';
/** Water Child, a Half-Elf alternate that replaces Adaptability and Multitalented. */
const waterChild = 'pf1-content/zNCwRTjsrEqZDnqg';
const tree = await materializePinnedTree([
  ...new Set([
    ...ownerEmissionFoundryFiles,
    ...[
      'classes/druid.7eZQP0MzeO2svmVF',
      'classes/inquisitor.Fv3FbmXptuDRiL5y',
      'class-abilities/domains.zrUJt7YpAJkf2NC6',
      'class-abilities/domain-inq.dMtxCqoMLtD9nEjU',
      'class-abilities/nature-bond.wZ40bxNVn95BbLBV',
      'class-abilities/fire-domain.KbcnBk7n4tctvnI9',
      'class-abilities/healing-domain.lqCm6Fy7JVezprqU',
      'class-abilities/glory-domain.RL0hOHIz4MnsVgv9',
      'class-abilities/restoration-subdomain.nKiYWIhQdZuRzkU7',
      'class-abilities/fire-bolt.V57hEfKt1MroRI91',
      'class-abilities/rebuke-death.8iWGEKKdoKTHsDy5',
      'class-abilities/touch-of-glory.0BFuaPpChxXneJwF',
      'class-abilities/restorative-touch.PDiHqRkoHr3AeTUv',
      // domain-power-reward-terms: the races the rewards name and the
      // humanoid races Racial Heritage offers, so its import gives the race
      // equivalence (racial-heritage-counts-as).
      'races/dwarf.nEltI9y37rKJTeWo',
      'races/halfling.Hf31mrYb3uucNyLO',
      'races/half-elf.cCepRrfH5SalFfT4',
      'races/human.e6IaBxKgMxy1yKlr',
      'races/elf.NgIhxRI0axrf3fcO',
    ].map(foundry),
    // domain-power-reward-terms phase 1b: Dragon Soul, the Half-Elf's
    // alternate racial trait; phase 1c: Multitalented, its standard trait
    // with two favored classes, and Water Child, an alternate that replaces
    // it.
    `pf1-content/${dragonSoulFile}`,
    'pf1-content/src/pf-racial-traits/Multitalented_srOpqbXesXBuvTqe.yaml',
    'pf1-content/src/pf-racial-traits/Water_Child_zNCwRTjsrEqZDnqg.yaml',
    ...pcgenOwnerEmissionFiles.map(
      (path) => `pcgen/${pcgenPin.directory}/${path}`,
    ),
  ]),
]);
afterAll(() => tree.dispose());
/**
 * The Advanced Player's Guide's Racial Heritage (pf1-content/1LULpgVNjQWqUGUk,
 * campaign-mvp-v1), its pinned record as feats-334 copied it (the pinned
 * store does not hold it), as rule-values-d3.test.ts imports it.
 */
const racialHeritage = 'pf1-content/1LULpgVNjQWqUGUk';
const racialHeritageFile = 'src/pf-feats/Racial_Heritage_1LULpgVNjQWqUGUk.yaml';
await copyFile(
  `tests/fixtures/feats-334/pf1-content/${racialHeritageFile}`,
  `${tree.contentPath}/${racialHeritageFile}`,
);
const remaps: unknown = JSON.parse(
  await readFile('scripts/catalog/reviewed-remaps.json', 'utf8'),
);

/** The import with the committed records, the domain powers' replaced by `records`. */
const emit = (records: readonly RuleValueRecord[]) =>
  importCatalog({
    systemPath: tree.systemPath,
    contentPath: tree.contentPath,
    remaps,
    curation: {
      ...reviewedCuration,
      ruleValues: [
        ...allRecords.filter(
          ({ externalKey }) => !domainPowerKeys.has(externalKey),
        ),
        ...records,
      ],
    },
    pcgen: { path: tree.pcgenPath, selection: pcgenOwnerSelection },
    // A partial pinned tree, not the verified whole corpus.
    wholeCorpus: false,
  });
/** The records checked in memory under a placeholder receipt, `change` applied to each output. */
const checkedInMemory = (
  change: (ruleValue: RuleValue) => RuleValue = (ruleValue) => ruleValue,
) =>
  committed.map(
    ({
      externalKey,
      descriptionSha256,
      outputs: [first, ...rest],
      rationale,
    }): RuleValueRecord => ({
      externalKey,
      descriptionSha256,
      outputs: [
        { kind: 'ruleValue', ruleValue: change(first.ruleValue) },
        ...rest.map(({ ruleValue }) => ({
          kind: 'ruleValue' as const,
          ruleValue: change(ruleValue),
        })),
      ],
      rationale,
      status: 'checked',
      reviewedBy: 'in-memory check (rule-values-domain-powers.test.ts)',
      reviewedOn: '2026-11-23',
      receipt: `t3-review-${'0'.repeat(64)}`,
    }),
  );
const asCommitted = await emit(committed);
const checked = await emit(checkedInMemory());

type Options = CharacterOptions & {
  /** Class Feature rows the player recorded (a domain, a domain power), by catalog entry. */
  features?: readonly string[];
  /** Body armor worn: a chainmail item, active. */
  armor?: true;
};
/** Chainmail, medium body armor, as a sheet item (the shape of an imported armor item). */
const chainmail: CharacterSheetCatalogEntry = {
  _id: 'chainmail',
  name: 'Chainmail',
  ruleIdentity: 'pf1/chainmail',
  modifiers: [],
  detail: {
    kind: 'item',
    armor: {
      slot: 'armor',
      category: 'medium',
      bonus: 6,
      maxDex: 2,
      armorCheckPenalty: 5,
      asf: 30,
    },
  },
};
/** A Character with these levels and recorded Class Feature rows, Wisdom 10 unless given. */
function sheetInput(
  artifact: Artifact,
  levels: ClassLevels,
  { features = [], armor, ...options }: Options = {},
): CharacterSheetInput {
  const input = character(artifact, levels, options);
  return {
    ...input,
    catalogEntries: [...input.catalogEntries, ...(armor ? [chainmail] : [])],
    entries: [
      ...(armor
        ? [
            {
              _id: 'armor-row',
              kind: 'item',
              active: true,
              catalogEntryId: chainmail._id,
              state: { kind: 'item' },
            } satisfies SheetEntry,
          ]
        : []),
      ...input.entries,
      ...features.map(
        (catalogEntryId, index): SheetEntry => ({
          _id: `feature-${index}`,
          kind: 'classFeature',
          active: true,
          catalogEntryId,
          state: { kind: 'classFeature' },
        }),
      ),
    ],
  };
}
/** Each per-day maximum as "<catalog entry> <value> <unit>", with " (sum n)" while floored. */
function maxima(...args: Parameters<typeof sheetInput>) {
  const result = calculateCharacterSheet(sheetInput(...args));
  const catalogEntryIds = new Map(
    result.resolvedEntries.map(({ entry }) => [
      entry._id,
      'catalogEntryId' in entry ? entry.catalogEntryId : entry._id,
    ]),
  );
  return result.dailyMaxima
    .map(
      ({ entryId, value, unit, floor }) =>
        `${catalogEntryIds.get(entryId) ?? entryId} ${value} ${unit}${floor ? ` (sum ${floor.sum})` : ''}`,
    )
    .sort();
}

describe('the domain powers’ per-day records (domain-powers-1)', () => {
  it('are committed with the boundary’s values, one per entry, checked by the record step on their promotion review, each bound to its entry’s current description', () => {
    expect(
      committed.map(({ externalKey, outputs }) => [
        externalKey,
        outputs.map(({ kind, ruleValue }) => ({ kind, ruleValue })),
      ]),
    ).toEqual(
      expected.map(([externalKey, key, formula]) => [
        externalKey,
        [{ kind: 'ruleValue', ruleValue: maximum(key, formula) }],
      ]),
    );
    const descriptions = new Map(
      asCommitted.catalog.entries.map(({ externalKey, description }) => [
        externalKey,
        description,
      ]),
    );
    for (const record of committed) {
      expect(record).toMatchObject({
        status: 'checked',
        receipt: promotionRun,
      });
      expect(record.rationale.startsWith(promotionLead)).toBe(true);
      expect(record.descriptionSha256).toBe(
        hashText(descriptions.get(record.externalKey) ?? ''),
      );
    }
  });

  it('as committed each entry carries its maximum, as checking the four in memory gives, and a Cleric 8 with Wisdom 20 recording each of the four powers shows 8 uses of each (character 3 among them)', () => {
    const carrying = (artifact: Artifact) =>
      artifact.catalog.entries
        .filter(({ externalKey }) => domainPowerKeys.has(externalKey))
        .map(({ externalKey, ruleValues }) => [externalKey, ruleValues]);
    expect(carrying(asCommitted)).toEqual(carrying(checked));
    expect(carrying(asCommitted)).toHaveLength(4);
    expect(
      maxima(asCommitted, [[classes.cleric, 8]], {
        scores: { wisdom: 20 },
        features: [
          domains.fire,
          domains.healing,
          domains.glory,
          domains.restoration,
          ...Object.values(powers),
        ],
      }),
    ).toEqual(
      Object.values(powers)
        .map((power) => `${power} 8 uses`)
        .sort(),
    );
  });

  // reward-target listed the two rewards, targeted rewards a formula can
  // read; domain-power-reward-terms: each record's formula reads each one
  // whose targets hold its key (the first case above; the boundary guard's
  // check (g) reads them through the sheet's parser).
  it('the two rewards that raise these counts (PCGen apg_abilities_race.lst:150, :168) are listed targeted rewards whose targets are the keys the boundary list marks each as changing', async () => {
    const boundary = JSON.parse(
      await readFile('tests/catalog/rule-values-boundary-rewards.json', 'utf8'),
    ) as {
      'campaign-mvp-v1': { rewards: { key: string; changes: string[] }[] };
    };
    const listed = reviewedFavoredClassRewards.rewards.flatMap((reward) =>
      [
        'roleplaying_game/advanced_players_guide/apg_abilities_race.lst:150',
        'roleplaying_game/advanced_players_guide/apg_abilities_race.lst:168',
      ].includes(reward.source.pcgen)
        ? [
            [
              reward.id,
              'targets' in reward
                ? reward.targets.map(({ key }) => key).sort()
                : [],
              boundary['campaign-mvp-v1'].rewards
                .find(
                  ({ key }) =>
                    key === `rule/core/favored-class/${reward.source.pcgen}`,
                )
                ?.changes.slice()
                .sort(),
            ],
          ]
        : [],
    );
    expect(listed.map(([id]) => id)).toEqual([
      'clericDomainPowerUse',
      'druidDomainPowerUse',
    ]);
    for (const [, targets, changes] of listed) expect(targets).toEqual(changes);
    expect(listed[0]?.[1]).toHaveLength(4);
    expect(listed[1]?.[1]).toEqual(['classFeat_fireBolt']);
  });

  it('a domain grants no power: the imported domains carry no rule value and no grant, so each power is its own Class Feature row', () => {
    for (const key of Object.values(domains)) {
      const entry = checked.catalog.entries.find(
        ({ externalKey }) => externalKey === key,
      );
      expect(entry, key).toBeDefined();
      expect(entry).not.toHaveProperty('ruleValues');
      expect(entry).not.toHaveProperty('grants');
    }
    expect(
      maxima(checked, [[classes.cleric, 1]], { features: [domains.fire] }),
    ).toEqual([]);
  });
});

describe('checked in memory, each power on a Cleric 1 at Wisdom 1, 10, 20 and 30: 3 + the Wisdom modifier, floored at 0', () => {
  it.each(
    expected.flatMap(([power]) =>
      (
        [
          [1, '0 uses (sum -2)'],
          [10, '3 uses'],
          [20, '8 uses'],
          [30, '13 uses'],
        ] as const
      ).map(([wisdom, shown]) => [power, wisdom, shown] as const),
    ),
  )('%s at Wisdom %i shows %s', (power, wisdom, shown) => {
    expect(
      maxima(checked, [[classes.cleric, 1]], {
        scores: { wisdom },
        features: [power],
      }),
    ).toEqual([`${power} ${shown}`]);
  });
});

describe('checked in memory, through the sheet: each class that gives a domain, the levels, the shared domain (R1), the party', () => {
  it.each([
    [
      'a Cleric 1 with the Fire Domain',
      [[classes.cleric, 1]],
      domains.fire,
      powers.fireBolt,
    ],
    [
      'a Cleric 20 with the Fire Domain (no level term)',
      [[classes.cleric, 20]],
      domains.fire,
      powers.fireBolt,
    ],
    [
      'a Cleric 1 with the Healing Domain',
      [[classes.cleric, 1]],
      domains.healing,
      powers.rebukeDeath,
    ],
    [
      'a Cleric 1 with the Glory Domain',
      [[classes.cleric, 1]],
      domains.glory,
      powers.touchOfGlory,
    ],
    [
      'a Cleric 1 with the Restoration Subdomain',
      [[classes.cleric, 1]],
      domains.restoration,
      powers.restorativeTouch,
    ],
    [
      'an Inquisitor 1 with the Fire Domain',
      [[classes.inquisitor, 1]],
      domains.fire,
      powers.fireBolt,
    ],
    [
      'an Inquisitor 12 with the Glory Domain',
      [[classes.inquisitor, 12]],
      domains.glory,
      powers.touchOfGlory,
    ],
    [
      'an Inquisitor 1 with the Restoration Subdomain, where the deity allows it (PRD advancedPlayersGuide/coreClasses/cleric.html:349; PCGen apg_abilities_class.lst:458)',
      [[classes.inquisitor, 1]],
      domains.restoration,
      powers.restorativeTouch,
    ],
    [
      'a Druid 1 with the Fire Domain (Nature Bond)',
      [[classes.druid, 1]],
      domains.fire,
      powers.fireBolt,
    ],
  ] as const)(
    '%s and Wisdom 18 shows 7 uses on the power’s row',
    (...[, levels, domain, power]) => {
      expect(
        maxima(checked, levels, {
          scores: { wisdom: 18 },
          features: [domain, power],
        }),
      ).toEqual([`${power} 7 uses`]);
    },
  );

  it('a Cleric 1 / Inquisitor 1 sharing the Fire Domain records the power once and shows one maximum, the one pool of 7 (Wisdom 18)', () => {
    expect(
      maxima(
        checked,
        [
          [classes.cleric, 1],
          [classes.inquisitor, 1],
        ],
        {
          scores: { wisdom: 18 },
          features: [domains.fire, powers.fireBolt],
        },
      ),
    ).toEqual([`${powers.fireBolt} 7 uses`]);
  });

  it('recorded twice, the shared power shows two equal chips, each exact for its row; `joins` cannot make them one, since it adds the second (R1: 14 where the rules give one pool of 7)', () => {
    const shared = [
      [
        [classes.cleric, 1],
        [classes.inquisitor, 1],
      ],
      {
        scores: { wisdom: 18 },
        features: [domains.fire, powers.fireBolt, powers.fireBolt],
      },
    ] as const;
    expect(maxima(checked, ...shared)).toEqual([
      `${powers.fireBolt} 7 uses`,
      `${powers.fireBolt} 7 uses`,
    ]);
    const joining = emit(
      checkedInMemory((ruleValue) =>
        ruleValue.kind === 'dailyMaximum'
          ? { ...ruleValue, joins: true }
          : ruleValue,
      ),
    );
    return joining.then((artifact) =>
      expect(maxima(artifact, ...shared)).toEqual([
        `${powers.fireBolt} 14 uses`,
      ]),
    );
  });

  it('character 3 (Cleric 8, Fire and Healing, Wisdom 20) shows Fire Bolt 8 and Rebuke Death 8, as committed and checked in memory', () => {
    for (const artifact of [asCommitted, checked])
      expect(
        maxima(artifact, [[classes.cleric, 8]], {
          scores: { wisdom: 20 },
          features: [
            domains.fire,
            domains.healing,
            powers.fireBolt,
            powers.rebukeDeath,
          ],
        }),
      ).toEqual(
        [`${powers.rebukeDeath} 8 uses`, `${powers.fireBolt} 8 uses`].sort(),
      );
  });

  it('character 6 (Ecclesitheurge Cleric 5 / Monk 1, Glory and Restoration, Wisdom 19) shows Touch of Glory 7 and Restorative Touch 7; worn in armor, the vow counts and the count is unchanged, a plain Cleric 5’s: the vow’s limit is situational', () => {
    const levels = [
      [classes.cleric, 5],
      [classes.monk, 1],
    ] as const;
    const options = {
      scores: { wisdom: 19 },
      features: [
        domains.glory,
        domains.healing,
        domains.restoration,
        powers.touchOfGlory,
        powers.restorativeTouch,
      ],
    };
    const shown = [
      `${powers.touchOfGlory} 7 uses`,
      `${powers.restorativeTouch} 7 uses`,
    ].sort();
    const inArmor = {
      ...options,
      archetype: ecclesitheurge,
      armor: true as const,
    };
    expect(maxima(checked, levels, inArmor)).toEqual(shown);
    expect(
      maxima(checked, levels, { ...options, archetype: ecclesitheurge }),
    ).toEqual(shown);
    expect(maxima(checked, levels, options)).toEqual(shown);
    // The condition tested: the vow is on the sheet and counts, and the
    // armor is worn (its bonus raises the AC).
    const armored = calculateCharacterSheet(
      sheetInput(checked, levels, inArmor),
    );
    expect(
      armored.resolvedEntries
        .filter(
          ({ entry, counting }) =>
            counting &&
            'catalogEntryId' in entry &&
            entry.catalogEntryId === vow,
        )
        .map(({ entry }) =>
          'catalogEntryId' in entry ? entry.catalogEntryId : '',
        ),
    ).toEqual([vow]);
    const unarmored = calculateCharacterSheet(
      sheetInput(checked, levels, { ...options, archetype: ecclesitheurge }),
    );
    expect(armored.derivedStatistics.ac.total).toBeGreaterThan(
      unarmored.derivedStatistics.ac.total,
    );
  });

  it('an Inquisitor 5 with the Healing Domain and the Restoration Subdomain, Wisdom 19, shows Restorative Touch 7, as character 6’s Cleric does (the Inquisitor’s route)', () => {
    expect(
      maxima(checked, [[classes.inquisitor, 5]], {
        scores: { wisdom: 19 },
        features: [
          domains.healing,
          domains.restoration,
          powers.restorativeTouch,
        ],
      }),
    ).toEqual([`${powers.restorativeTouch} 7 uses`]);
  });
});

/**
 * domain-power-reward-terms: the two rewards through the sheet's calculation
 * (`calculateCharacterSheet`), with the imported definitions global, as the
 * import stores them (`sheetCatalog`), the four records checked in memory.
 * A Class Level saves the reward as reward-target's structured choice,
 * `{ choice: 'reward', reward, target }`, the target the power's per-day key.
 * The count is of the counting levels (the reward's class, a favored class,
 * a character the sheet counts as one of the reward's races) whose target is
 * the key; each power adds floor(n / 2) for n such levels, Fire Bolt the
 * Cleric's and the Druid's added first (boundary §1, §2). The races are
 * sheet entries of the pinned races' keys; each carries its Wisdom change
 * (the Dwarf's +2, pf1 packs/races/dwarf.nEltI9y37rKJTeWo.yaml:20-22; the
 * Halfling, the Half-Elf and the Human none, their +2 taken elsewhere), and
 * every `wisdom` below is the sheet's score.
 */
describe('checked in memory, through the sheet: the Cleric’s and the Druid’s favored-class rewards (domain-power-reward-terms)', () => {
  const races = {
    dwarf: { _id: 'pf1/nEltI9y37rKJTeWo', name: 'Dwarf', wisdom: 2 },
    halfling: { _id: 'pf1/Hf31mrYb3uucNyLO', name: 'Halfling', wisdom: 0 },
    halfElf: { _id: 'pf1/cCepRrfH5SalFfT4', name: 'Half-Elf', wisdom: 0 },
    human: { _id: 'pf1/e6IaBxKgMxy1yKlr', name: 'Human', wisdom: 0 },
  } as const;
  type Reward = 'clericDomainPowerUse' | 'druidDomainPowerUse';
  /** One Class Level's favored class bonus: the reward and the power's key it names. */
  type Pick = readonly [reward: Reward, target: string];
  const cleric = (target: string): Pick => ['clericDomainPowerUse', target];
  const druid = (target: string): Pick => ['druidDomainPowerUse', target];
  const keyOf = {
    [powers.fireBolt]: 'classFeat_fireBolt',
    [powers.rebukeDeath]: 'classFeat_rebukeDeath',
    [powers.touchOfGlory]: 'classFeat_touchOfGlory',
    [powers.restorativeTouch]: 'classFeat_restorativeTouch',
  } as const;
  /**
   * A Half-Elf racial trait as the sheet reads it: the imported definition
   * of `key`, its facts (Multitalented's `favoredClassCount`) as the import
   * gives them. The partial tree has no folder placement, so its import
   * gives a trait no race and an alternate no replacement; the whole import
   * places these under the Half-Elf and gives each alternate the standard
   * traits it replaces (`replaces`, read from the whole import in phase 1c:
   * Dragon Soul Elf Blood; Water Child Adaptability and Multitalented).
   */
  const halfElfTrait = (
    artifact: Artifact,
    key: string,
    replaces: readonly string[] = [],
  ): CharacterSheetCatalogEntry => {
    const trait = artifact.catalog.entries.find(
      ({ externalKey }) => externalKey === key,
    );
    const detail = trait && importedCatalogEntrySchema.parse(trait).detail;
    if (!trait || detail?.kind !== 'racialTrait')
      throw new Error(`${key} did not import as a racial trait`);
    return {
      scope: 'global',
      _id: key,
      ruleIdentity: key,
      name: trait.name,
      modifiers: [],
      detail: {
        kind: 'racialTrait',
        raceEntryIds: [races.halfElf._id],
        replaces,
        ...(detail.favoredClassCount && {
          favoredClassCount: detail.favoredClassCount,
        }),
      },
    };
  };
  /** An alternate racial trait the player selected: its row, `choice` saved. */
  type Alternate = {
    key: string;
    replaces: readonly string[];
    choice?: string;
  };
  const alternateRow = (
    { key, choice }: Alternate,
    index: number,
  ): SheetEntry => ({
    _id: `alternate-${index}`,
    kind: 'racialTrait',
    active: true,
    catalogEntryId: key,
    state: { kind: 'racialTrait', ...(choice !== undefined && { choice }) },
  });
  /** The imported Racial Heritage with `race` saved as its choice, or nothing. */
  const heritageRows = (race: string | undefined): SheetEntry[] =>
    race === undefined
      ? []
      : [
          {
            _id: 'heritage-row',
            kind: 'feat',
            active: true,
            catalogEntryId: racialHeritage,
            state: { kind: 'feat', choice: race },
          },
        ];
  /** A Class Level's or the base row's saved favored-class state. */
  const withFavored =
    (favored: readonly string[], picks: readonly (Pick | undefined)[]) =>
    (entry: SheetEntry): SheetEntry => {
      if (entry.kind === 'base')
        return {
          ...entry,
          state: { ...entry.state, favoredClassIds: [...favored] },
        };
      const pick =
        entry.kind === 'classLevel'
          ? picks[entry.state.position - 1]
          : undefined;
      return entry.kind === 'classLevel' && pick
        ? {
            ...entry,
            state: {
              ...entry.state,
              favoredClassBonus: {
                choice: 'reward' as const,
                reward: pick[0],
                target: pick[1],
              },
            },
          }
        : entry;
    };
  type Build = {
    race: keyof typeof races;
    levels: ClassLevels;
    wisdom?: number;
    features: readonly string[];
    picks?: readonly (Pick | undefined)[];
    favored?: readonly string[];
    heritage?: string;
    /** Dragon Soul's saved choice, the race it counts as (phase 1b). */
    dragonSoulAs?: string;
    /** Standard racial traits the race grants, by imported key (phase 1c). */
    standardTraits?: readonly string[];
    /** Alternate racial traits selected (phase 1c). */
    alternates?: readonly Alternate[];
  };
  /**
   * The sheet input of a Character of `race` and `levels` with `wisdom` on
   * the sheet and the recorded `features`, whose favored classes are
   * `favored` (the first class), whose Class Level at position i + 1 saves
   * `picks[i]` (none where it is undefined), with `heritage`, the imported
   * Racial Heritage with that race saved as its choice, with `dragonSoulAs`,
   * Dragon Soul with that choice saved, and with `standardTraits` and
   * `alternates`, those Half-Elf racial traits.
   */
  const inputOf = (
    artifact: Artifact,
    {
      race,
      levels,
      wisdom = 10,
      features,
      picks = [],
      favored = [levels[0]?.[0] ?? ''],
      heritage,
      dragonSoulAs,
      standardTraits = [],
      alternates = [],
    }: Build,
  ): CharacterSheetInput => {
    const { _id, name, wisdom: racial } = races[race];
    const selected: readonly Alternate[] = [
      ...alternates,
      ...(dragonSoulAs === undefined
        ? []
        : [{ key: dragonSoul, replaces: [elfBlood], choice: dragonSoulAs }]),
    ];
    const input = sheetInput(artifact, levels, {
      scores: { wisdom: wisdom - racial },
      features,
    });
    return {
      ...input,
      catalogEntries: [
        ...input.catalogEntries,
        ...standardTraits.map((key) => halfElfTrait(artifact, key)),
        ...selected.map(({ key, replaces }) =>
          halfElfTrait(artifact, key, replaces),
        ),
        {
          scope: 'global' as const,
          _id,
          ruleIdentity: _id,
          name,
          modifiers: racial
            ? [
                {
                  target: abilityTargets.wisdom,
                  bonusType: 'racial' as const,
                  value: racial,
                },
              ]
            : [],
          detail: { kind: 'race', racialTraits: [...standardTraits] },
        },
      ],
      entries: [
        ...input.entries,
        {
          _id: 'race-row',
          kind: 'race' as const,
          active: true,
          catalogEntryId: _id,
          state: { kind: 'race' as const },
        },
        ...selected.map(alternateRow),
        ...heritageRows(heritage),
      ].map(withFavored(favored, picks)),
    };
  };
  /**
   * The Character's per-day maxima as `maxima` gives them, how many levels
   * warn that their reward is not counted, and the rewards the first Class
   * Level's favored class bonus offers (as the classes view composes them,
   * `favoredClassRewardsFitting`).
   */
  const sheetOf = (artifact: Artifact, build: Build) => {
    const withRace = inputOf(artifact, build);
    const result = calculateCharacterSheet(withRace);
    const catalogEntryIds = new Map(
      result.resolvedEntries.map(({ entry }) => [
        entry._id,
        'catalogEntryId' in entry ? entry.catalogEntryId : entry._id,
      ]),
    );
    const levelClass = withRace.catalogEntries.find(
      (entry) => entry._id === build.levels[0]?.[0],
    );
    return {
      shown: result.dailyMaxima
        .map(
          ({ entryId, value, unit, floor }) =>
            `${catalogEntryIds.get(entryId) ?? entryId} ${value} ${unit}${floor ? ` (sum ${floor.sum})` : ''}`,
        )
        .sort(),
      notCounted: result.warnings.filter(
        ({ check }) => check === 'favoredClassRewardNotCounted',
      ).length,
      offered: favoredClassRewardsFitting({
        classIdentities: levelClassIdentities(
          levelClass,
          withRace.catalogEntries,
        ),
        raceIdentities: rewardRaceIdentities(
          activeRaceIdentities(withRace),
          result.racial.countsAsRaces,
        ),
      }).map(({ id }) => id),
    };
  };

  it.each(
    Object.values(powers).flatMap((power) =>
      (
        [
          [0, 3],
          [1, 3],
          [2, 4],
          [3, 4],
          [4, 5],
        ] as const
      ).map(([selections, uses]) => [power, selections, uses] as const),
    ),
  )(
    'a Dwarf Cleric 4, Wisdom 10, recording %s with the Cleric’s reward naming it at %i levels shows %i uses (half a use a selection, rounded down)',
    (power, selections, uses) => {
      expect(
        sheetOf(checked, {
          race: 'dwarf',
          levels: [[classes.cleric, 4]],
          features: [power],
          picks: Array.from({ length: selections }, () => cleric(keyOf[power])),
        }),
      ).toEqual({
        shown: [`${power} ${uses} uses`],
        notCounted: 0,
        offered: ['clericDomainPowerUse'],
      });
    },
  );

  it('as committed, as checked in memory: a Dwarf Cleric 2, Wisdom 10, with both levels for Fire Bolt shows 4 uses', () => {
    const build = {
      race: 'dwarf',
      levels: [[classes.cleric, 2]],
      features: [powers.fireBolt],
      picks: [cleric('classFeat_fireBolt'), cleric('classFeat_fireBolt')],
    } as const;
    expect(sheetOf(asCommitted, build)).toEqual({
      shown: [`${powers.fireBolt} 4 uses`],
      notCounted: 0,
      offered: ['clericDomainPowerUse'],
    });
    expect(sheetOf(asCommitted, build)).toEqual(sheetOf(checked, build));
  });

  it('a selection naming another power adds nothing to this one: a Dwarf Cleric 2 with Fire Bolt and Rebuke Death, both levels for Rebuke Death, shows Fire Bolt 3 and Rebuke Death 4; one level for each shows 3 and 3 (each power’s half rounds down apart)', () => {
    const build = {
      race: 'dwarf',
      levels: [[classes.cleric, 2]],
      features: [
        domains.fire,
        domains.healing,
        powers.fireBolt,
        powers.rebukeDeath,
      ],
    } as const;
    expect(
      sheetOf(checked, {
        ...build,
        picks: [
          cleric('classFeat_rebukeDeath'),
          cleric('classFeat_rebukeDeath'),
        ],
      }).shown,
    ).toEqual(
      [`${powers.rebukeDeath} 4 uses`, `${powers.fireBolt} 3 uses`].sort(),
    );
    expect(
      sheetOf(checked, {
        ...build,
        picks: [cleric('classFeat_fireBolt'), cleric('classFeat_rebukeDeath')],
      }).shown,
    ).toEqual(
      [`${powers.rebukeDeath} 3 uses`, `${powers.fireBolt} 3 uses`].sort(),
    );
  });

  it('a Halfling Cleric 2, Wisdom 18, with both levels for Touch of Glory shows 8; with Restorative Touch recorded in place of Rebuke Death, both levels for it, 8', () => {
    expect(
      sheetOf(checked, {
        race: 'halfling',
        levels: [[classes.cleric, 2]],
        wisdom: 18,
        features: [powers.touchOfGlory],
        picks: [
          cleric('classFeat_touchOfGlory'),
          cleric('classFeat_touchOfGlory'),
        ],
      }).shown,
    ).toEqual([`${powers.touchOfGlory} 8 uses`]);
    expect(
      sheetOf(checked, {
        race: 'halfling',
        levels: [[classes.cleric, 2]],
        wisdom: 18,
        features: [
          domains.healing,
          domains.restoration,
          powers.restorativeTouch,
        ],
        picks: [
          cleric('classFeat_restorativeTouch'),
          cleric('classFeat_restorativeTouch'),
        ],
      }).shown,
    ).toEqual([`${powers.restorativeTouch} 8 uses`]);
  });

  it.each([
    [1, 3],
    [2, 4],
    [3, 4],
  ] as const)(
    'a Half-Elf Druid 3, Wisdom 10, with the Fire Domain and Fire Bolt, the Druid’s reward on %i levels: %i uses',
    (selections, uses) => {
      expect(
        sheetOf(checked, {
          race: 'halfElf',
          levels: [[classes.druid, 3]],
          features: [domains.fire, powers.fireBolt],
          picks: Array.from({ length: selections }, () =>
            druid('classFeat_fireBolt'),
          ),
        }),
      ).toEqual({
        shown: [`${powers.fireBolt} ${uses} uses`],
        notCounted: 0,
        offered: ['druidDomainPowerUse'],
      });
    },
  );

  it('each reward counts only its own class’s levels: a Dwarf Druid’s and a Half-Elf Cleric’s levels that chose the other class’s reward add nothing and warn; a Half-Elf Cleric 1 / Druid 1 with Multitalented and Racial Heritage (Dwarf), both classes favored, adds the Cleric’s and the Druid’s halves to one Fire Bolt: 4', () => {
    expect(
      sheetOf(checked, {
        race: 'dwarf',
        levels: [[classes.druid, 2]],
        features: [domains.fire, powers.fireBolt],
        picks: [cleric('classFeat_fireBolt'), cleric('classFeat_fireBolt')],
      }),
    ).toEqual({
      shown: [`${powers.fireBolt} 3 uses`],
      notCounted: 2,
      offered: [],
    });
    expect(
      sheetOf(checked, {
        race: 'halfElf',
        levels: [[classes.cleric, 2]],
        features: [domains.fire, powers.fireBolt],
        picks: [druid('classFeat_fireBolt'), druid('classFeat_fireBolt')],
      }),
    ).toEqual({
      shown: [`${powers.fireBolt} 3 uses`],
      notCounted: 2,
      offered: [],
    });
    const both = {
      race: 'halfElf',
      levels: [
        [classes.cleric, 1],
        [classes.druid, 1],
      ],
      features: [domains.fire, powers.fireBolt],
      favored: [classes.cleric, classes.druid],
      heritage: races.dwarf._id,
      // Two favored classes need Multitalented (fix r1): a valid build.
      standardTraits: [multitalented],
    } as const;
    const picks = [cleric('classFeat_fireBolt'), druid('classFeat_fireBolt')];
    expect(sheetOf(checked, { ...both, picks })).toEqual({
      shown: [`${powers.fireBolt} 4 uses`],
      notCounted: 0,
      offered: ['clericDomainPowerUse'],
    });
    const result = calculateCharacterSheet(
      inputOf(checked, { ...both, picks }),
    );
    expect(result.racial.favoredClassCount).toBe(2);
    expect(
      result.warnings.filter(({ check }) => check === 'favoredClassCount'),
    ).toEqual([]);
    // Either half alone rounds down to nothing.
    expect(
      sheetOf(checked, { ...both, picks: [cleric('classFeat_fireBolt')] })
        .shown,
    ).toEqual([`${powers.fireBolt} 3 uses`]);
  });

  it('a Human Cleric 2 with Racial Heritage (Dwarf or Halfling) is offered the Cleric’s reward and shows Fire Bolt 4 with it at both levels; without the feat, or with Elf saved, it is not offered, and chosen anyway it is not counted (3, a warning on each level)', () => {
    const build = {
      race: 'human',
      levels: [[classes.cleric, 2]],
      features: [domains.fire, powers.fireBolt],
      picks: [cleric('classFeat_fireBolt'), cleric('classFeat_fireBolt')],
    } as const;
    for (const heritage of [races.dwarf._id, races.halfling._id])
      expect(sheetOf(checked, { ...build, heritage }), heritage).toEqual({
        shown: [`${powers.fireBolt} 4 uses`],
        notCounted: 0,
        offered: ['clericDomainPowerUse'],
      });
    for (const heritage of [undefined, 'pf1/NgIhxRI0axrf3fcO'])
      expect(
        sheetOf(checked, { ...build, ...(heritage && { heritage }) }),
        heritage,
      ).toEqual({
        shown: [`${powers.fireBolt} 3 uses`],
        notCounted: 2,
        offered: [],
      });
  });

  // Phase 1b (the promotion review's finding): Dragon Soul replaces Elf
  // Blood, and "half-elves with this trait choose to count as either elves
  // or humans for any effect regarding race", so with Human chosen the
  // Half-Elf meets Racial Heritage's prerequisite and may save Dwarf or
  // Halfling. The sheet reads Racial Heritage's saved race whatever else
  // the character counts as, so this passed when first run; it would catch
  // a count that required the feat's holder to count as Human through a
  // race fact (Dragon Soul's choice is not one, and here the Half-Elf has
  // no Elf Blood, the fact that gives it Human). All four powers share the
  // count's code path (one key each), so one power is enough.
  it.each([
    ['Dwarf', races.dwarf._id],
    ['Halfling', races.halfling._id],
  ] as const)(
    'a Half-Elf Cleric 3 with Dragon Soul (Human) and Racial Heritage (%s), Wisdom 10, two levels naming Touch of Glory: 4 uses; without Racial Heritage, 3, a warning on each level',
    (...[, heritage]) => {
      const build = {
        race: 'halfElf',
        levels: [[classes.cleric, 3]],
        features: [domains.glory, powers.touchOfGlory],
        picks: [
          cleric('classFeat_touchOfGlory'),
          cleric('classFeat_touchOfGlory'),
        ],
        dragonSoulAs: races.human._id,
      } as const;
      expect(sheetOf(checked, { ...build, heritage })).toEqual({
        shown: [`${powers.touchOfGlory} 4 uses`],
        notCounted: 0,
        offered: ['clericDomainPowerUse'],
      });
      expect(sheetOf(checked, build)).toEqual({
        shown: [`${powers.touchOfGlory} 3 uses`],
        notCounted: 2,
        offered: [],
      });
    },
  );

  // Phase 1c (root decision 2026-11-25, the favored-class mechanism): the
  // count reads the saved favored classes (`favoredClassIds`); how many a
  // character may have is the largest `favoredClassCount` of its counting
  // racial traits (Multitalented's 2, else 1), which only the
  // `favoredClassCount` warning reads. An alternate that replaces
  // Multitalented, such as Water Child, drops the limit to 1. Passed when
  // first run; it would catch a count that stopped following the saved
  // list, or a Multitalented that no longer gave two.
  it('a Half-Elf Druid 1 / Cleric 2 with Racial Heritage (Dwarf), Wisdom 10, two Cleric levels naming Touch of Glory: 4 with Multitalented and both classes favored; 3 with Water Child in its place and Druid the only favored class; Water Child with both saved is the warned over-limit state, and the reward still counts', () => {
    const build = {
      race: 'halfElf',
      levels: [
        [classes.druid, 1],
        [classes.cleric, 2],
      ],
      features: [domains.glory, powers.touchOfGlory],
      picks: [
        undefined,
        cleric('classFeat_touchOfGlory'),
        cleric('classFeat_touchOfGlory'),
      ],
      heritage: races.dwarf._id,
    } as const;
    const both = [classes.druid, classes.cleric];
    const multi = { ...build, standardTraits: [multitalented] };
    const water = {
      ...multi,
      alternates: [
        { key: waterChild, replaces: [adaptability, multitalented] },
      ],
    };
    /** The favored-class limit and its warning. */
    const limit = (input: Parameters<typeof inputOf>[1]) => {
      const result = calculateCharacterSheet(inputOf(checked, input));
      return [
        result.racial.favoredClassCount,
        result.warnings
          .filter(({ check }) => check === 'favoredClassCount')
          .map(({ message }) => message),
      ];
    };
    expect(sheetOf(checked, { ...multi, favored: both }).shown).toEqual([
      `${powers.touchOfGlory} 4 uses`,
    ]);
    expect(limit({ ...multi, favored: both })).toEqual([2, []]);
    // The count follows the saved list: Cleric not favored, nothing counts.
    expect(
      sheetOf(checked, { ...multi, favored: [classes.druid] }),
    ).toMatchObject({
      shown: [`${powers.touchOfGlory} 3 uses`],
      notCounted: 2,
    });
    expect(
      sheetOf(checked, { ...water, favored: [classes.druid] }),
    ).toMatchObject({
      shown: [`${powers.touchOfGlory} 3 uses`],
      notCounted: 2,
    });
    expect(limit({ ...water, favored: [classes.druid] })).toEqual([1, []]);
    // Over the limit (not a valid build; owner-q-warned-states-count): the
    // sheet warns and the saved Cleric still counts.
    expect(sheetOf(checked, { ...water, favored: both }).shown).toEqual([
      `${powers.touchOfGlory} 4 uses`,
    ]);
    expect(limit({ ...water, favored: both })).toEqual([
      1,
      ['Choose up to 1 favored class.'],
    ]);
  });

  it.each([
    [0, '0 uses (sum -2)'],
    [1, '0 uses (sum -2)'],
    [2, '0 uses (sum -1)'],
    [3, '0 uses (sum -1)'],
    [4, '0 uses'],
    [6, '1 uses'],
  ] as const)(
    'Wisdom 1, the floor: a Halfling Cleric 6 with the Cleric’s reward for Rebuke Death on %i levels shows %s',
    (selections, shown) => {
      expect(
        sheetOf(checked, {
          race: 'halfling',
          levels: [[classes.cleric, 6]],
          wisdom: 1,
          features: [powers.rebukeDeath],
          picks: Array.from({ length: selections }, () =>
            cleric('classFeat_rebukeDeath'),
          ),
        }).shown,
      ).toEqual([`${powers.rebukeDeath} ${shown}`]);
    },
  );
});
