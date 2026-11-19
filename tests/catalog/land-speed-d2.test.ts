// @vitest-environment node
// stats-d2 (owner 2026-11-17, PRD #251; GLOSSARY: Land speed): land speed on
// real rows. A race gives its base speed as a `base` Modifier on `speed.land`
// (Foundry's `speeds.land`); a feature's, feat's, item's or Spell Effect's
// Foundry `landSpeed` change maps to `speed.land`, its `base` read as
// untyped; Fast Movement, Fleet and the monk's Fast Movement read
// `@armor.type` or `@class.level`, so reviewed change replacements stand in
// for them. Fast Movement's is checked (fix r1, on the round 1 Spec review)
// and Fleet's (fix r3, on the round 3 Spec review); the monk's is drafted and
// applies nothing until checked. A bonus
// that holds only in a situation no condition states stays out (fix r1).
// Characters are numbers (party-builds.json). Every record is the pinned one,
// from the shared store.
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { representativeClassCatalog } from '../../convex/lib/representativeClassCatalog';
import { launchMechanismProofs } from '../../scripts/catalog/launch-mechanism-proofs';
import { sourceBodyGate } from '../../scripts/catalog/launch-source-body';
import { mapEntry, type PreviewEntry } from '../../scripts/catalog/map';
import { upstreamRecord } from '../../scripts/catalog/records';
import {
  reviewedChangeReplacements,
  type ReviewedChangeReplacement,
} from '../../scripts/catalog/reviewed-change-replacements';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from '../../src/lib/character-sheet';
import { launchManifestCopies } from './launch-manifest';
import { readPinned, type StoreRepository } from './pinned-sources';

type Pinned = {
  repo: StoreRepository & ('pf1' | 'pf1-content');
  pack: string;
  file: string;
  kind: Parameters<typeof mapEntry>[0]['kind'];
};
const pf1 = (pack: string, file: string, kind: Pinned['kind']): Pinned => ({
  repo: 'pf1',
  pack,
  file,
  kind,
});
const records = {
  human: pf1('races', 'human.e6IaBxKgMxy1yKlr.yaml', 'race'),
  elf: pf1('races', 'elf.NgIhxRI0axrf3fcO.yaml', 'race'),
  dwarf: pf1('races', 'dwarf.nEltI9y37rKJTeWo.yaml', 'race'),
  gnome: pf1('races', 'gnome.efwHEwjvL9Z94MJI.yaml', 'race'),
  aasimar: pf1('races', 'aasimar.FHY3oIk5zSOFncJH.yaml', 'race'),
  orc: pf1('races', 'orc.JOuAdPAOTat7d5v6.yaml', 'race'),
  tiefling: pf1('races', 'tiefling.nVjKDLZSRONzYm8f.yaml', 'race'),
  slowAndSteady: {
    repo: 'pf1-content',
    pack: 'pf-racial-traits',
    file: 'Slow_and_Steady__Dwarf__JsvoElxHBPdle8s8.yaml',
    kind: 'racialTrait',
  },
  fastMovement: pf1(
    'class-abilities',
    'fast-movement.9EX00obqhGHcrOdp.yaml',
    'classFeature',
  ),
  monkFastMovement: pf1(
    'class-abilities',
    'fast-movement-mnk.CK5L0YJDENqBxLqv.yaml',
    'classFeature',
  ),
  fleet: pf1('feats', 'fleet.BkKYCzEGNTzZRiTz.yaml', 'feat'),
  armorTraining: pf1(
    'class-abilities',
    'armor-training.5JFfSqLMCpbRmERa.yaml',
    'classFeature',
  ),
  fullPlate: pf1(
    'armors-and-shields',
    'full-plate.h65qEp22nsyRoeRa.yaml',
    'item',
  ),
  chainmail: pf1(
    'armors-and-shields',
    'chainmail.unY9jt1B8a5bbnzO.yaml',
    'item',
  ),
  breastplate: pf1(
    'armors-and-shields',
    'breastplate.5TzaS38RPAx1oj9p.yaml',
    'item',
  ),
  agileBreastplate: pf1(
    'armors-and-shields',
    'agile-breastplate.q2HbIx7a7YpGJ3Kn.yaml',
    'item',
  ),
  chainShirt: pf1(
    'armors-and-shields',
    'chain-shirt.iGu21zy6QtroUZ4O.yaml',
    'item',
  ),
  longstrider: {
    repo: 'pf1-content',
    pack: 'pf-buffs',
    file: 'Longstrider_qmHamauveVs3q6F0.yaml',
    kind: 'spellEffect',
  },
  greaterLongstrider: {
    repo: 'pf1-content',
    pack: 'pf-buffs',
    file: 'Longstrider__Greater_aXNBwNX1qgp8GqzM.yaml',
    kind: 'spellEffect',
  },
  expeditiousRetreat: {
    repo: 'pf1-content',
    pack: 'pf-buffs',
    file: 'Expeditious_Retreat_2v2ifXv9SL5aOLv1.yaml',
    kind: 'spellEffect',
  },
  travelDomain: pf1(
    'class-abilities',
    'travel-domain.7a930CN37xb968mP.yaml',
    'classFeature',
  ),
  danceOfTheBlades: pf1(
    'class-abilities',
    'dance-of-the-blades.3MKN05JEqEYrNx7Q.yaml',
    'classFeature',
  ),
  travelAsOne: pf1(
    'class-abilities',
    'travel-as-one.ebivkqVXZECItLSF.yaml',
    'classFeature',
  ),
  cyberneticLeg: pf1(
    'technology',
    'cybernetic-leg.oWdvwcpord1iUbEf.yaml',
    'item',
  ),
} as const satisfies Record<string, Pinned>;
type Name = keyof typeof records;

const loaded = new Map(
  await Promise.all(
    (Object.entries(records) as [Name, Pinned][]).map(
      async ([name, { repo, pack, file }]) => {
        const path =
          repo === 'pf1' ? `packs/${pack}/${file}` : `src/${pack}/${file}`;
        const record = upstreamRecord.parse(
          parse(await readPinned(repo, path)),
        );
        return [name, { path, record }] as const;
      },
    ),
  ),
);

/** The importer's entry for a pinned record, with these replacement rows. */
function imported(
  name: Name,
  changeReplacements?: readonly ReviewedChangeReplacement[],
): PreviewEntry {
  const { repo, pack, kind } = records[name];
  const { path, record } = loaded.get(name)!;
  return mapEntry({
    source: { repo, pack, path, record },
    kind,
    resolveKey: (key) => key,
    lookup: new Map(),
    spellClassTags: new Set(),
    ...(changeReplacements ? { changeReplacements } : {}),
  });
}

const drafted = reviewedChangeReplacements.filter(
  (row) => row.status === 'drafted',
);
/** The committed rows with Fleet's row drafted again in memory, as it was until fix r3. */
const fleetDraftedInMemory: readonly ReviewedChangeReplacement[] =
  reviewedChangeReplacements.map((row) => {
    if (row.externalKey !== 'pf1/BkKYCzEGNTzZRiTz') return row;
    const { externalKey, change, formula, condition, stacksWithItself } = row;
    return {
      externalKey,
      change,
      formula,
      condition,
      stacksWithItself,
      evidence: row.evidence,
      status: 'drafted',
    };
  });
/** The committed rows with this slice's drafted rows checked in memory. */
const checkedInMemory: readonly ReviewedChangeReplacement[] =
  reviewedChangeReplacements.map((row) =>
    row.status === 'drafted'
      ? {
          ...row,
          status: 'checked',
          reviewedBy: 'in-memory check (test)',
          reviewedOn: '2026-11-17',
        }
      : row,
  );
const launchManifest = launchManifestCopies(
  JSON.parse(
    await readFile(
      new URL(
        '../../scripts/catalog/scopes/campaign-mvp-v1.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ),
)();
/** A row of the committed `campaign-mvp-v1` launch inventory, by its key. */
function launchRow(key: string) {
  const row = launchManifest.rows.find((candidate) => candidate.key === key);
  if (!row) throw new Error(`No committed launch row ${key}.`);
  return row;
}

const speedChanges = (entry: PreviewEntry) =>
  entry.unsupported.filter(
    (issue) =>
      issue.field === 'changes' &&
      (issue.value as { target?: string } | undefined)?.target === 'landSpeed',
  );

describe('the importer', () => {
  it.each([
    ['human', 30],
    ['elf', 30],
    ['dwarf', 20],
    ['gnome', 20],
    ['aasimar', 30],
    ['orc', 30],
    ['tiefling', 30],
  ] as const)(
    'gives the %s race its base land speed, %i ft., as a base Modifier',
    (name, feet) => {
      // PRD advancedRaceGuide coreRaces/humans.html:361, elves.html:366,
      // dwarves.html:362, gnomes.html:368; featuredRaces/aasimars.html:361,
      // orcs.html:362, tieflings.html:361.
      const entry = imported(name);
      expect(
        entry.modifiers.filter(({ target }) => target === 'speed.land'),
      ).toEqual([{ target: 'speed.land', bonusType: 'base', value: feet }]);
      expect(
        entry.unsupported.filter(({ field }) => field === 'speeds'),
      ).toEqual([]);
    },
  );

  it('maps a feature’s base land speed change as an untyped bonus', () => {
    // Travel Domain: "Increase your base speed by 10 feet." (Foundry body);
    // PCGen cr_abilities_class.lst:679 BONUS:MOVEADD|TYPE=Walk|10, untyped.
    expect(imported('travelDomain').modifiers).toContainEqual({
      target: 'speed.land',
      bonusType: 'untyped',
      value: 10,
    });
    expect(speedChanges(imported('travelDomain'))).toEqual([]);
  });

  it('maps a Spell Effect’s enhancement bonus to land speed', () => {
    expect(imported('longstrider').modifiers).toEqual([
      { target: 'speed.land', bonusType: 'enhancement', value: 10 },
    ]);
  });

  it('applies the checked Fast Movement row in the committed import: +10 untyped in at most medium armor', () => {
    // PRD coreRulebook/classes/barbarian.html:381; CONFIRMED by the stats-d2
    // round 1 Spec review.
    expect(
      reviewedChangeReplacements.find(
        (row) => row.externalKey === 'pf1/9EX00obqhGHcrOdp',
      ),
    ).toMatchObject({ status: 'checked', reviewedOn: '2026-11-18' });
    expect(imported('fastMovement').modifiers).toEqual([
      {
        target: 'speed.land',
        bonusType: 'untyped',
        value: 10,
        condition: { armorAtMost: 'medium' },
      },
    ]);
    expect(speedChanges(imported('fastMovement'))).toEqual([]);
  });

  it('writes the monk’s Fast Movement drafted, so the committed import applies it not; Fleet’s row is checked', () => {
    expect(
      drafted.map(({ externalKey, change, formula, condition }) => ({
        externalKey,
        change,
        formula,
        condition,
      })),
    ).toEqual([
      {
        externalKey: 'pf1/CK5L0YJDENqBxLqv',
        change: {
          target: 'landSpeed',
          formula: '10 * (floor(@class.level / 3))',
          type: 'enh',
        },
        formula:
          '10 * floor(max(@classLevel.monk, @classLevel.monkUnchained) / 3)',
        condition: { unarmored: true },
      },
    ]);
    const monk = imported('monkFastMovement');
    expect(
      monk.modifiers.filter(({ target }) => target === 'speed.land'),
    ).toEqual([]);
    expect(speedChanges(monk)).toHaveLength(1);
    // Fix r3: CONFIRMED pf1/BkKYCzEGNTzZRiTz on the round 3 Spec review.
    expect(
      reviewedChangeReplacements.find(
        ({ externalKey }) => externalKey === 'pf1/BkKYCzEGNTzZRiTz',
      ),
    ).toMatchObject({
      status: 'checked',
      reviewedBy: expect.stringMatching(/^gpt-6\.2-sol \(/),
      reviewedOn: '2026-11-18',
    });
    const fleet = imported('fleet');
    expect(fleet.modifiers).toEqual([
      {
        target: 'speed.land',
        bonusType: 'untyped',
        value: 5,
        condition: { armorAtMost: 'light' },
      },
    ]);
    expect(speedChanges(fleet)).toEqual([]);
    // Drafted again in memory, it applies nothing.
    const draftedFleet = imported('fleet', fleetDraftedInMemory);
    expect(
      draftedFleet.modifiers.filter(({ target }) => target === 'speed.land'),
    ).toEqual([]);
    expect(speedChanges(draftedFleet)).toHaveLength(1);
  });

  it('applies each replacement of this slice once checked: Fleet +5 in at most light armor, the monk’s enhancement by level while unarmored', () => {
    expect(imported('fleet', checkedInMemory).modifiers).toEqual([
      {
        target: 'speed.land',
        bonusType: 'untyped',
        value: 5,
        condition: { armorAtMost: 'light' },
      },
    ]);
    expect(imported('monkFastMovement', checkedInMemory).modifiers).toEqual([
      {
        target: 'speed.land',
        bonusType: 'enhancement',
        value: {
          formula:
            '10 * floor(max(@classLevel.monk, @classLevel.monkUnchained) / 3)',
        },
        condition: { unarmored: true },
      },
    ]);
    for (const name of ['fleet', 'monkFastMovement'] as const)
      expect(speedChanges(imported(name, checkedInMemory)), name).toEqual([]);
  });

  it('gives Fleet per-copy stacking only once its row is checked', () => {
    // Pinned body: "You can take this feat multiple times. The effects
    // stack."; PCGen cr_feats.lst:70 MULT:YES and STACK:YES.
    expect(
      imported('fleet', fleetDraftedInMemory).stacksWithItself,
    ).toBeUndefined();
    expect(imported('fleet').stacksWithItself).toBe(true);
    // No other row says so.
    for (const name of ['fastMovement', 'monkFastMovement'] as const)
      expect(imported(name, checkedInMemory).stacksWithItself, name).toBe(
        undefined,
      );
  });

  // fix r1: a bonus that holds only in a situation the grammar can't state
  // stays out of the ordinary total (PRD #251: "Situation-dependent
  // contributions stay out of ordinary totals"), with its reason shown.
  it('checking Fleet moves no source-body membership: Fleet is not a source-body row', () => {
    // Fix r2 (round 2 Spec carry): `bodyOutputs` gives no outputs for an
    // entry with `stacksWithItself`, but that drops only a row the family
    // lists. Fleet's committed launch row names its raw change as its one
    // mechanism, not `Source body mechanics`, and the family's reviewed list
    // doesn't name it, so each registry entry's source-body gate answers the
    // same for the drafted and the checked entry (the field stays
    // unclassified: a stacking mechanic no reviewed body proves).
    // The committed launch row (fix r3: read, not copied, so a change to
    // its mechanism reaches this test).
    const row = launchRow('pf1/BkKYCzEGNTzZRiTz');
    expect(row.mechanisms.map(({ name }) => name)).toEqual([
      'Modifier landSpeed if(and(lt(@armor.type, 2), lt(@attributes.encumbrance.level, 1)), 5)',
    ]);
    const draftedFleet = imported('fleet', fleetDraftedInMemory);
    const checkedFleet = imported('fleet');
    expect(draftedFleet.stacksWithItself).toBeUndefined();
    expect(checkedFleet.stacksWithItself).toBe(true);
    const gates = (entry: PreviewEntry) =>
      launchMechanismProofs.map((proof) =>
        sourceBodyGate(proof, { row, entry, entryOf: () => undefined }),
      );
    expect(gates(checkedFleet)).toEqual(gates(draftedFleet));
    const family = launchMechanismProofs.find(
      (proof) => proof.family === 'source-body',
    );
    expect(
      family &&
        sourceBodyGate(family, {
          row,
          entry: draftedFleet,
          entryOf: () => undefined,
        }),
    ).toBe(false);
  });

  it('withholds Dance of the Blades’ +10: it needs a metal weapon in hand', () => {
    // PRD ultimateMagic/spellcastingClassOptions/oracle.html:391 "You must be
    // wielding a metal weapon to use this ability."; PCGen
    // um_abilities_class.lst:482 BONUS:MOVEADD|TYPE.Walk|10|PREEQUIP:1,TYPE=Weapon.Metal.
    const entry = imported('danceOfTheBlades');
    expect(entry.modifiers).toEqual([]);
    expect(speedChanges(entry)).toEqual([
      expect.objectContaining({
        reason: expect.stringMatching(
          /^Conditional in the source: only while wielding a metal weapon/,
        ),
        value: { target: 'landSpeed', formula: '10', type: 'base' },
      }),
    ]);
  });

  it('withholds Travel as One’s −10: it stands for losing the Travel Domain’s increase', () => {
    // Pinned body: "This power replaces the base speed increase of the Travel
    // Domain."; PCGen da_abilities_class_ui.lst:27 gives it no speed change.
    const entry = imported('travelAsOne');
    expect(entry.modifiers).toEqual([]);
    expect(speedChanges(entry)).toEqual([
      expect.objectContaining({
        reason: expect.stringMatching(
          /^Conditional in the source: it replaces the Travel Domain's base speed increase/,
        ),
        value: { target: 'landSpeed', formula: '-10', type: 'base' },
      }),
    ]);
  });

  it('withholds the Cybernetic Leg’s +10: one item is one leg, and the bonus needs both', () => {
    // Pinned body: "If both legs are replaced, they increase the user's base
    // land speed by 10 feet" and "A single cybernetic leg costs half the
    // price"; the record's price is 4,250 gp, half of PCGen
    // tg_equip.lst:99 Cybernetic Legs (COST:8500), and its quantity of 2
    // doesn't import (fix r2).
    const entry = imported('cyberneticLeg');
    expect(
      entry.modifiers.filter(({ target }) => target === 'speed.land'),
    ).toEqual([]);
    expect(entry.detail).toMatchObject({ kind: 'item', price: 4250 });
    expect(speedChanges(entry)).toEqual([
      expect.objectContaining({
        reason: expect.stringMatching(
          /^Conditional in the source: only with both legs replaced/,
        ),
        value: { target: 'landSpeed', formula: '10', type: 'untyped' },
      }),
    ]);
  });

  it('keeps a racial trait’s speed change prose: the race gives the base', () => {
    // Slow and Steady (Dwarf) sets the base to 20 (`set`); the dwarf race's
    // own 20 ft. is the base, so counting the trait too would double it.
    const trait = imported('slowAndSteady');
    expect(trait.modifiers).toEqual([]);
    expect(speedChanges(trait)).toEqual([
      expect.objectContaining({
        reason:
          "The race's own base speed gives land speed; this racial trait's speed change stays prose.",
      }),
    ]);
  });
});

// ---- Sheets on the imported rows ----

const toCatalog = (
  entry: PreviewEntry,
  detail: CharacterSheetCatalogEntry['detail'],
): CharacterSheetCatalogEntry =>
  ({
    _id: entry.externalKey,
    ruleIdentity: entry.externalKey,
    name: entry.name,
    modifiers: entry.modifiers,
    ...(entry.stacksWithItself ? { stacksWithItself: true } : {}),
    detail,
  }) as CharacterSheetCatalogEntry;
const itemEntry = (name: Name) => {
  const entry = imported(name);
  return toCatalog(entry, entry.detail as CharacterSheetCatalogEntry['detail']);
};
const fighterKey = 'pf1/WLqBCT5DqmGAx8Wd';
const monkKey = 'pf1/W8dxwZ1CZiwLKsqr';
/** A released class: the seeded progression with the import's tag. */
const seededClass = ({
  seeded,
  key,
  featuresByLevel,
}: {
  seeded: 'fighter' | 'monk';
  key: string;
  featuresByLevel: { classLevel: number; catalogEntryId: string }[];
}): CharacterSheetCatalogEntry => {
  const definition = representativeClassCatalog.find(
    (row) => row.ruleIdentity === seeded,
  );
  if (definition?.detail.kind !== 'class')
    throw new Error(`No seeded ${seeded}`);
  return {
    ...definition,
    _id: key,
    ruleIdentity: key,
    detail: { ...definition.detail, tag: seeded, featuresByLevel },
  } as CharacterSheetCatalogEntry;
};

type Race =
  | 'human'
  | 'elf'
  | 'dwarf'
  | 'gnome'
  | 'aasimar'
  | 'orc'
  | 'tiefling';
type Feature =
  | 'fastMovement'
  | 'monkFastMovement'
  | 'fleet'
  | 'danceOfTheBlades'
  | 'travelAsOne'
  | 'travelDomain';
type Armor =
  | 'fullPlate'
  | 'chainmail'
  | 'breastplate'
  | 'agileBreastplate'
  | 'chainShirt';
type Effect = 'longstrider' | 'greaterLongstrider' | 'expeditiousRetreat';

function catalogFor(replacements?: readonly ReviewedChangeReplacement[]) {
  const slowAndSteady = imported('slowAndSteady');
  const dwarf = imported('dwarf');
  const races = (
    ['human', 'elf', 'dwarf', 'gnome', 'aasimar', 'orc', 'tiefling'] as const
  ).map((name) =>
    toCatalog(imported(name), {
      kind: 'race',
      // The dwarf's standard Slow and Steady (pf1-content Core Races/Dwarf).
      racialTraits: name === 'dwarf' ? [slowAndSteady.externalKey] : [],
    } as CharacterSheetCatalogEntry['detail']),
  );
  return [
    {
      _id: 'base',
      ruleIdentity: 'base',
      modifiers: abilityKeys.map((key) => ({
        target: abilityTargets[key],
        bonusType: 'base',
        value: 10,
      })),
    },
    ...races,
    toCatalog(slowAndSteady, {
      kind: 'racialTrait',
      raceEntryIds: [dwarf.externalKey],
      replaces: [],
    } as CharacterSheetCatalogEntry['detail']),
    ...(
      [
        'fastMovement',
        'monkFastMovement',
        'armorTraining',
        'danceOfTheBlades',
        'travelAsOne',
        'travelDomain',
      ] as const
    ).map((name) =>
      toCatalog(imported(name, replacements), {
        kind: 'classFeature',
      } as CharacterSheetCatalogEntry['detail']),
    ),
    toCatalog(imported('fleet', replacements), {
      kind: 'feat',
    } as CharacterSheetCatalogEntry['detail']),
    ...(
      [
        'fullPlate',
        'chainmail',
        'breastplate',
        'agileBreastplate',
        'chainShirt',
      ] as const
    ).map(itemEntry),
    ...(
      ['longstrider', 'greaterLongstrider', 'expeditiousRetreat'] as const
    ).map((name) =>
      toCatalog(imported(name), {
        kind: 'spellEffect',
      } as CharacterSheetCatalogEntry['detail']),
    ),
    seededClass({
      seeded: 'fighter',
      key: fighterKey,
      featuresByLevel: [
        {
          classLevel: 3,
          catalogEntryId: imported('armorTraining').externalKey,
        },
      ],
    }),
    seededClass({ seeded: 'monk', key: monkKey, featuresByLevel: [] }),
  ] as CharacterSheetCatalogEntry[];
}

function sheet({
  race,
  features = [],
  armor,
  effects = [],
  fighter = 0,
  monk = 0,
  replacements,
}: {
  race: Race;
  features?: Feature[];
  armor?: Armor;
  effects?: Effect[];
  fighter?: number;
  monk?: number;
  replacements?: readonly ReviewedChangeReplacement[];
}): CharacterSheetInput {
  const key = (name: Name) => imported(name).externalKey;
  const row = (name: Name, kind: SheetEntry['kind'], copy = 0): SheetEntry =>
    ({
      _id: `${name}-row${copy ? `-${copy + 1}` : ''}`,
      kind,
      active: true,
      catalogEntryId: key(name),
      state:
        kind === 'spellEffect'
          ? { kind, casterLevel: 5 }
          : ({ kind } as SheetEntry['state']),
    }) as SheetEntry;
  const levels = (classEntryId: string, count: number, from = 0) =>
    Array.from(
      { length: count },
      (_, index): SheetEntry => ({
        _id: `${classEntryId}-${index + 1}`,
        kind: 'classLevel',
        active: true,
        state: {
          kind: 'classLevel',
          classEntryId,
          position: from + index + 1,
          hpGained: 8,
        },
      }),
    );
  return {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      row(race, 'race'),
      ...levels(fighterKey, fighter),
      ...levels(monkKey, monk, fighter),
      ...features.map((name, index) =>
        row(
          name,
          name === 'fleet' ? 'feat' : 'classFeature',
          features.slice(0, index).filter((other) => other === name).length,
        ),
      ),
      ...(armor ? [row(armor, 'item')] : []),
      ...effects.map((name) => row(name, 'spellEffect')),
    ],
    catalogEntries: catalogFor(replacements),
  };
}
const speed = (input: CharacterSheetInput) =>
  calculateCharacterSheet(input).derivedStatistics.landSpeed;

describe('the party’s land speed by character number', () => {
  // Committed: the checked Fast Movement adds +10 before the armor reduction
  // (barbarian.html:381); the drafted rows apply nothing. Checked in memory,
  // no party number moves: nobody has Fleet, and the monk's Fast Movement is
  // +0 at Monk 1 (character 7).
  it.each([
    // 3: Aasimar Cleric 8 in Full Plate (heavy): 30 → 20.
    ['3', 20, 20, { race: 'aasimar', armor: 'fullPlate' }],
    // 4: Orc Barbarian 8 in Chainmail (medium): 30 + 10 → 30.
    [
      '4',
      30,
      30,
      { race: 'orc', features: ['fastMovement'], armor: 'chainmail' },
    ],
    // 5: Gnome Sorcerer, no armor: 20.
    ['5', 20, 20, { race: 'gnome' }],
    // 7: Tiefling Bloodrager 4 / Monk 1, Mage Armor is no armor item: 30 + 10.
    [
      '7',
      40,
      40,
      {
        race: 'tiefling',
        features: ['fastMovement', 'monkFastMovement'],
        monk: 1,
      },
    ],
    // 8: Human Magus 4 in a Chain Shirt (light): 30.
    ['8', 30, 30, { race: 'human', armor: 'chainShirt' }],
    // 9: Human Fighter 3 in a Breastplate (medium), Armor Training 1: 30.
    ['9', 30, 30, { race: 'human', fighter: 3, armor: 'breastplate' }],
    // 10: Human Bloodrager 4 in an Agile Breastplate (medium): 30 + 10 → 30.
    [
      '10',
      30,
      30,
      { race: 'human', features: ['fastMovement'], armor: 'agileBreastplate' },
    ],
    // 11: Elf Wizard 4, no armor: 30.
    ['11', 30, 30, { race: 'elf' }],
    // 13: Human Bard in a Chain Shirt (light): 30.
    ['13', 30, 30, { race: 'human', armor: 'chainShirt' }],
  ] as const)(
    'character %s moves %i ft. committed and %i ft. once the drafted replacements are checked',
    (...[, committed, checked, build]) => {
      const input = build as Parameters<typeof sheet>[0];
      expect(speed(sheet(input))?.total).toBe(committed);
      expect(
        speed(sheet({ ...input, replacements: checkedInMemory }))?.total,
      ).toBe(checked);
    },
  );
});

describe('situational speed stays out of the ordinary total', () => {
  it('a Human with Dance of the Blades and no weapon moves 30 ft., not 40', () => {
    expect(
      speed(sheet({ race: 'human', features: ['danceOfTheBlades'] }))?.total,
    ).toBe(30);
  });

  it('Travel as One takes nothing off a sheet without the Travel Domain', () => {
    expect(
      speed(sheet({ race: 'human', features: ['travelAsOne'] }))?.total,
    ).toBe(30);
    // Known limit: beside the Travel Domain its +10 stays (a replaced part
    // of a feature is not modelled).
    expect(
      speed(sheet({ race: 'human', features: ['travelAsOne', 'travelDomain'] }))
        ?.total,
    ).toBe(40);
  });
});

describe('the armor and stacking rules on the imported rows', () => {
  it('a dwarf in Full Plate keeps 20 ft.: Slow and Steady', () => {
    // PRD dwarves.html:362: "their speed is never modified by armor".
    const result = speed(sheet({ race: 'dwarf', armor: 'fullPlate' }));
    expect(result?.total).toBe(20);
    expect(result?.suppressed).toContainEqual(
      expect.objectContaining({
        reason: 'Slow and Steady (Dwarf): speed is never modified by armor.',
      }),
    );
    // A gnome, also 20 ft., has no such trait: 15 ft.
    expect(speed(sheet({ race: 'gnome', armor: 'fullPlate' }))?.total).toBe(15);
  });

  it('a monk’s Fast Movement is lost in armor, with the reason shown', () => {
    // PRD monk.html:405 and its table: +10 ft. at 3rd, +20 ft. at 6th.
    const monk = (armor?: Armor) =>
      speed(
        sheet({
          race: 'human',
          features: ['monkFastMovement'],
          monk: 6,
          armor,
          replacements: checkedInMemory,
        }),
      );
    expect(monk()?.total).toBe(50);
    const armored = monk('chainShirt');
    expect(armored?.total).toBe(30);
    expect(armored?.suppressed).toContainEqual(
      expect.objectContaining({
        entryName: 'Fast Movement (MNK)',
        value: 20,
        reason: 'Lost while wearing Chain Shirt.',
      }),
    );
  });

  it('Fast Movement is lost in heavy armor with the reason shown; Fleet in medium armor', () => {
    const heavy = speed(
      sheet({
        race: 'human',
        features: ['fastMovement'],
        armor: 'fullPlate',
        replacements: checkedInMemory,
      }),
    );
    expect(heavy?.total).toBe(20);
    expect(heavy?.suppressed).toContainEqual(
      expect.objectContaining({
        entryName: 'Fast Movement',
        reason: 'Lost while wearing Full Plate (heavy armor).',
      }),
    );
    // Fleet: +5 in a Chain Shirt (light), lost in Chainmail (medium).
    expect(
      speed(
        sheet({
          race: 'human',
          features: ['fleet'],
          armor: 'chainShirt',
          replacements: checkedInMemory,
        }),
      )?.total,
    ).toBe(35);
    expect(
      speed(
        sheet({
          race: 'human',
          features: ['fleet'],
          armor: 'chainmail',
          replacements: checkedInMemory,
        }),
      )?.total,
    ).toBe(20);
  });

  it('each copy of Fleet adds its +5: 40 ft. with two, 45 ft. with three; none in medium armor', () => {
    const fleet = (copies: number, armor?: Armor) =>
      speed(
        sheet({
          race: 'human',
          features: Array.from({ length: copies }, () => 'fleet' as const),
          armor,
        }),
      )?.total;
    expect(fleet(1)).toBe(35);
    expect(fleet(2)).toBe(40);
    expect(fleet(3)).toBe(45);
    expect(fleet(2, 'chainShirt')).toBe(40);
    expect(fleet(3, 'chainmail')).toBe(20);
    // Drafted again in memory, the row applies nothing, however many copies.
    expect(
      speed(
        sheet({
          race: 'human',
          features: ['fleet', 'fleet'],
          replacements: fleetDraftedInMemory,
        }),
      )?.total,
    ).toBe(30);
  });

  it('an enhancement bonus does not stack with another: expeditious retreat and longstrider give +30, not +40', () => {
    const result = speed(
      sheet({ race: 'human', effects: ['expeditiousRetreat', 'longstrider'] }),
    );
    expect(result?.total).toBe(60);
    expect(result?.suppressed).toContainEqual(
      expect.objectContaining({
        entryName: 'Longstrider',
        reason: 'A higher bonus of this type applies.',
      }),
    );
    // Untyped Fast Movement stacks with the enhancement bonus.
    expect(
      speed(
        sheet({
          race: 'human',
          features: ['fastMovement'],
          effects: ['greaterLongstrider'],
          replacements: checkedInMemory,
        }),
      )?.total,
    ).toBe(60);
  });
});
