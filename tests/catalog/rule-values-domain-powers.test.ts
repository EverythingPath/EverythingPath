// @vitest-environment node
// domain-powers-1 (PRD #251; GLOSSARY: Per-day maximum; owner 2026-11-17: the
// maximum only, no tally, no uses remaining, no reset): the per-day records of
// four 1st-level domain powers, each "a number of times per day equal to 3 +
// your Wisdom modifier", with no level term. All four are drafted and held by
// the release-scope boundary (ORCH domain-powers-1-boundary.md §2): two
// favored-class rewards of campaign-mvp-v1 add half a use a day of one chosen
// such power per selection, and no reviewed reward id a formula can read is
// one of them. As committed they give nothing; checked in memory, the sheet
// shows each power's uses on its own row. Characters are numbers
// (party-builds.json); every case runs on the pinned tree.
import { readFile } from 'node:fs/promises';
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
import { reviewedFavoredClassRewards } from '../../src/lib/character-sheet-favored-class-rewards';
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
/** The domain powers' records, as the boundary gives them (§1). */
const expected = [
  [powers.touchOfGlory, 'classFeat_touchOfGlory'],
  [powers.rebukeDeath, 'classFeat_rebukeDeath'],
  [powers.restorativeTouch, 'classFeat_restorativeTouch'],
  [powers.fireBolt, 'classFeat_fireBolt'],
] as const;
const wisdomUses = { formula: '3 + @ability.wis.mod' };
const maximum = (key: string): RuleValue => ({
  kind: 'dailyMaximum',
  key,
  unit: 'uses',
  amount: wisdomUses,
});
/** How each record's rationale starts: the hold, then its reason. */
const heldLead =
  'Held, not for promotion (domain-powers-1): a favored-class reward of a release scope raises the count and no record gives it: ';

const domainPowerKeys = new Set<string>(Object.values(powers));
const allRecords = reviewedCuration.ruleValues ?? [];
const committed = allRecords.filter(({ externalKey }) =>
  domainPowerKeys.has(externalKey),
);

const foundry = (path: string) => `pf1/packs/${path}.yaml`;
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
    ].map(foundry),
    ...pcgenOwnerEmissionFiles.map(
      (path) => `pcgen/${pcgenPin.directory}/${path}`,
    ),
  ]),
]);
afterAll(() => tree.dispose());
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
  it('are committed with the boundary’s values, one per entry, drafted and held, each bound to its entry’s current description', () => {
    expect(
      committed.map(({ externalKey, outputs }) => [
        externalKey,
        outputs.map(({ kind, ruleValue }) => ({ kind, ruleValue })),
      ]),
    ).toEqual(
      expected.map(([externalKey, key]) => [
        externalKey,
        [{ kind: 'ruleValue', ruleValue: maximum(key) }],
      ]),
    );
    const descriptions = new Map(
      asCommitted.catalog.entries.map(({ externalKey, description }) => [
        externalKey,
        description,
      ]),
    );
    for (const record of committed) {
      expect(record.status).toBe('drafted');
      expect(record).not.toHaveProperty('receipt');
      expect(record.rationale.startsWith(heldLead)).toBe(true);
      expect(record.descriptionSha256).toBe(
        hashText(descriptions.get(record.externalKey) ?? ''),
      );
    }
  });

  it('as committed give nothing: no entry carries a rule value, and a Cleric 8 with Wisdom 20 recording each of the four powers shows no per-day maximum (character 3 among them)', () => {
    const carrying = asCommitted.catalog.entries
      .filter(({ externalKey }) => domainPowerKeys.has(externalKey))
      .filter(({ ruleValues }) => ruleValues);
    expect(carrying).toEqual([]);
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
    ).toEqual([]);
  });

  it('are held because no reviewed favored-class reward is a domain power’s: a formula can read none of the two that raise these counts (PCGen apg_abilities_race.lst:150, :168)', () => {
    expect(
      reviewedFavoredClassRewards.rewards.filter(({ source }) =>
        [
          'roleplaying_game/advanced_players_guide/apg_abilities_race.lst:150',
          'roleplaying_game/advanced_players_guide/apg_abilities_race.lst:168',
        ].includes(source.pcgen),
      ),
    ).toEqual([]);
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

  it('character 3 (Cleric 8, Fire and Healing, Wisdom 20) shows Fire Bolt 8 and Rebuke Death 8', () => {
    expect(
      maxima(checked, [[classes.cleric, 8]], {
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
