import { describe, expect, test } from 'vitest';
import type { Doc, Id } from '@convex/_generated/dataModel';
import { seedRepresentativeCatalog } from '@convex/lib/representativeSeeds';
import { representativeClassCatalog } from '@convex/lib/representativeClassCatalog';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheetProjections,
  defaultCreationSettings,
} from './character-sheet';
import { listCatalogReferences } from './catalog-copy-references';
import {
  catalogRuleLookupKey,
  listCatalogRuleLookups,
  selectCatalogRuleLookupRows,
} from './catalog-rule-lookups';

type Row = Doc<'catalogEntry'>;
type Entry = Doc<'characterSheetEntry'>;
const characterId = 'character-1' as Id<'character'>;

async function seedCatalog() {
  const rows = new Map<string, Row>();
  let next = 0;
  await seedRepresentativeCatalog(
    {
      async insert(definition) {
        next += 1;
        const _id = `seed-${next}` as Id<'catalogEntry'>;
        rows.set(_id, { ...definition, _id, _creationTime: next } as Row);
        return _id;
      },
      async replace(_id, definition) {
        const previous = rows.get(_id);
        if (!previous) throw new Error(`Missing ${_id}`);
        rows.set(_id, {
          ...definition,
          _id,
          _creationTime: previous._creationTime,
        } as Row);
      },
      async patch(_id, fields) {
        const previous = rows.get(_id);
        if (!previous) throw new Error(`Missing ${_id}`);
        rows.set(_id, { ...previous, ...fields } as Row);
      },
    },
    characterId,
  );
  return [...rows.values()];
}

const seeds = await seedCatalog();
const baseCatalog = {
  _id: 'base-catalog' as Id<'catalogEntry'>,
  _creationTime: 0,
  scope: 'character',
  characterId,
  name: 'Base scores',
  ruleIdentity: `base:${characterId}`,
  stacksWithItself: false,
  detail: { kind: 'base' },
  sources: [],
  modifiers: abilityKeys.map((ability) => ({
    target: abilityTargets[ability],
    bonusType: 'base',
    value: 14,
  })),
} as Row;

function seedId(ruleIdentity: string) {
  const row = seeds.find(
    (candidate) =>
      candidate.ruleIdentity === ruleIdentity &&
      candidate.detail.kind !== 'manual',
  );
  if (!row) throw new Error(`No seed for ${ruleIdentity}`);
  return row._id;
}

/** The Character's rows a prepared sheet read loads: referenced, then looked up. */
function loadSheetCatalog(entries: readonly Entry[], catalog: readonly Row[]) {
  const byId = new Map(catalog.map((row) => [row._id, row]));
  const browseOnly = catalog.filter((row) => row.browseOnly);
  function closure(ids: Iterable<string>) {
    const loaded = new Map<string, Row>();
    const pending = [...ids];
    while (pending.length) {
      const id = pending.pop()!;
      if (loaded.has(id)) continue;
      const row = byId.get(id as Id<'catalogEntry'>);
      if (!row) continue;
      loaded.set(id, row);
      pending.push(
        ...listCatalogReferences(row).map((reference) => reference.id),
      );
    }
    return [...loaded.values()];
  }
  let loaded = closure([
    ...catalog.filter((row) => !row.browseOnly).map((row) => row._id),
    ...entries.flatMap((entry) =>
      listCatalogReferences(entry).map((reference) => reference.id),
    ),
  ]);
  const resolved = new Set<string>();
  for (;;) {
    const lookups = listCatalogRuleLookups({
      entries,
      catalogEntries: loaded,
    }).filter((lookup) => !resolved.has(catalogRuleLookupKey(lookup)));
    if (!lookups.length) return loaded;
    const added = lookups.flatMap((lookup) => {
      resolved.add(catalogRuleLookupKey(lookup));
      return selectCatalogRuleLookupRows(lookup, browseOnly, loaded);
    });
    loaded = closure([...loaded, ...added].map((row) => row._id));
  }
}

let nextEntry = 0;
function entry<Kind extends Entry['kind']>(
  kind: Kind,
  fields: Omit<
    Extract<Entry, { kind: Kind }>,
    '_id' | '_creationTime' | 'characterId' | 'kind' | 'active'
  > & { active?: boolean },
) {
  nextEntry += 1;
  return {
    _id: `entry-${nextEntry}`,
    _creationTime: nextEntry,
    characterId,
    kind,
    active: true,
    ...fields,
  } as unknown as Entry;
}
const base = (state: Partial<Extract<Entry, { kind: 'base' }>['state']> = {}) =>
  entry('base', {
    catalogEntryId: baseCatalog._id,
    state: { kind: 'base', ...defaultCreationSettings, ...state },
  } as never);
function levels(...classes: (string | readonly [string, number])[]) {
  const result: Entry[] = [];
  for (const item of classes) {
    const [identity, count] = typeof item === 'string' ? [item, 1] : item;
    for (let index = 0; index < count; index++)
      result.push(
        entry('classLevel', {
          active: true,
          state: {
            kind: 'classLevel',
            classEntryId: seedId(identity),
            position: result.length + 1,
            hpGained: 5,
          },
        } as never),
      );
  }
  return result;
}
function selection(
  kind:
    | 'feat'
    | 'race'
    | 'racialTrait'
    | 'archetype'
    | 'classFeature'
    | 'trait'
    | 'item',
  ruleIdentity: string,
  state: Record<string, unknown> = {},
  fields: Record<string, unknown> = {},
) {
  return entry(kind, {
    catalogEntryId: seedId(ruleIdentity),
    state: { kind, ...state },
    ...fields,
  } as never);
}
function prompt(
  ruleIdentity: string,
  classIdentity: string,
  feature: string,
  list: string,
  state: Record<string, unknown> = {},
) {
  return selection('classFeature', ruleIdentity, state, {
    selectionSource: {
      kind: 'prompt',
      source: {
        kind: 'grant',
        grantKey: { source: classIdentity, classLevel: 1, entry: feature },
      },
      list,
      classLevel: 1,
    },
  });
}

function calculate(entries: readonly Entry[], catalogEntries: readonly Row[]) {
  const projections = calculateCharacterSheetProjections({
    characterKind: 'pc',
    sheetMode: 'full',
    entries,
    catalogEntries,
  });
  return JSON.parse(
    JSON.stringify({
      current: projections.current,
      permanent: projections.permanent,
    }),
  );
}

function expectParity(entries: readonly Entry[], extra: readonly Row[] = []) {
  const everything = [baseCatalog, ...extra, ...seeds];
  // Before browse-only seeds, a sheet loaded every seed it carried.
  const before = calculate(
    entries,
    everything.map(({ browseOnly: _browseOnly, ...row }) => row as Row),
  );
  const loaded = loadSheetCatalog(entries, everything);
  expect(loaded.length).toBeLessThan(everything.length);
  expect(calculate(entries, loaded)).toEqual(before);
  return loaded;
}

const classIdentities = representativeClassCatalog.map(
  (definition) => definition.ruleIdentity,
);

describe('a prepared sheet loading only referenced and looked-up seeds', () => {
  test('marks every representative seed browse-only', () => {
    expect(seeds.length).toBeGreaterThan(250);
    expect(seeds.every((row) => row.browseOnly === true)).toBe(true);
    expect(new Set(seeds.map((row) => row.scope))).toEqual(
      new Set(['character']),
    );
  });

  test.each(classIdentities)(
    'calculates %s levels 1 to 20 as if every seed were loaded',
    (identity) => {
      for (const count of [1, 5, 10, 20])
        expectParity([base(), ...levels([identity, count])]);
    },
  );

  test('calculates multiclass, unchained and prestige builds', () => {
    expectParity([base(), ...levels(['rogue', 3], ['unchained-rogue', 2])]);
    expectParity([
      base(),
      ...levels(['unchained-monk', 4], ['monk', 2], ['barbarian', 3]),
    ]);
    expectParity([
      base(),
      ...levels(['fighter', 6]),
      selection('feat', 'dodge'),
      selection('feat', 'mobility'),
      selection('feat', 'weapon-finesse'),
      ...levels(['duelist', 2]),
    ]);
    expectParity([
      base(),
      ...levels(['cleric', 3], ['wizard', 3], ['mystic-theurge', 3]),
    ]);
    expectParity([base(), ...levels(['rogue', 6], ['shadowdancer', 2])]);
  });

  test('calculates archetypes', () => {
    for (const [classIdentity, archetype] of [
      ['fighter', 'fighter-archer'],
      ['rogue', 'rogue-scout'],
    ] as const)
      for (const count of [1, 4, 9, 20])
        expectParity([
          base(),
          ...levels([classIdentity, count]),
          selection('archetype', archetype, {
            classEntryId: seedId(classIdentity),
          }),
        ]);
  });

  test('calculates races, alternate Racial Traits and half-elf and half-orc alternates', () => {
    for (const race of ['human', 'elf', 'dwarf', 'half-elf', 'half-orc'])
      expectParity([base(), ...levels('fighter'), selection('race', race)]);
    expectParity([
      base(),
      ...levels('fighter'),
      selection('race', 'half-elf'),
      selection('racialTrait', 'human-heart-of-streets'),
      selection('racialTrait', 'half-elf-ancestral-arms', {
        choice: 'longsword',
      }),
    ]);
    expectParity([
      base(),
      ...levels('fighter'),
      selection('race', 'half-orc'),
      selection('racialTrait', 'human-heart-of-streets'),
      selection('racialTrait', 'dwarf-craftsman'),
    ]);
    expectParity([
      base(),
      ...levels('rogue'),
      selection('race', 'elf'),
      selection('racialTrait', 'dwarf-craftsman'),
    ]);
  });

  test('calculates prerequisite feats, held or missing', () => {
    const feats = seeds
      .filter((row) => row.detail.kind === 'feat')
      .map((row) => row.ruleIdentity);
    expectParity([
      base(),
      ...levels(['fighter', 2]),
      ...feats.map((feat) =>
        selection(
          'feat',
          feat,
          feat === 'weapon-focus' ? { choice: 'longsword' } : {},
        ),
      ),
    ]);
    for (const feat of feats)
      expectParity([
        base(),
        ...levels('wizard'),
        selection('feat', feat, { choice: 'shortbow' }),
      ]);
  });

  test('calculates domains, schools, bloodlines and their Granted Spells', () => {
    expectParity([
      base(),
      ...levels(['cleric', 9]),
      prompt('domain-fire', 'cleric', 'cleric-domains', 'Domains'),
      prompt('domain-sun', 'cleric', 'cleric-domains', 'Domains'),
    ]);
    expectParity([
      base(),
      ...levels(['wizard', 7]),
      prompt(
        'school-evocation',
        'wizard',
        'wizard-arcane-school',
        'Arcane school',
        {
          oppositionSchools: ['enc', 'nec'],
        },
      ),
    ]);
    expectParity([
      base(),
      ...levels(['sorcerer', 11]),
      prompt(
        'bloodline-draconic',
        'sorcerer',
        'sorcerer-bloodline',
        'Bloodline',
      ),
    ]);
  });

  test('calculates weapons, natural attacks and attack feats', () => {
    const longsword = selection('item', 'longsword');
    const shortbow = selection('item', 'shortbow');
    const arrows = selection('item', 'arrows');
    const bite = selection('item', 'natural-bite');
    expectParity([
      base(),
      ...levels(['fighter', 8]),
      longsword,
      shortbow,
      arrows,
      bite,
      selection('feat', 'weapon-focus', { choice: 'longsword' }),
      selection('feat', 'point-blank-shot'),
      selection('feat', 'precise-shot'),
      selection('feat', 'power-attack'),
      selection('feat', 'two-weapon-fighting'),
      selection('feat', 'rapid-reload', { choice: 'light crossbow' }),
      entry('attackRoutine', {
        state: {
          kind: 'attackRoutine',
          name: 'Sword',
          weaponEntryId: longsword._id,
          hands: 'two',
          mode: 'melee',
          naturalAttackEntryIds: [bite._id],
        },
      } as never),
      entry('attackRoutine', {
        state: {
          kind: 'attackRoutine',
          name: 'Bow',
          weaponEntryId: shortbow._id,
          hands: 'two',
          mode: 'ranged',
          ammunitionEntryId: arrows._id,
        },
      } as never),
    ]);
  });

  test('calculates Spell Effects on items with their Spells’ default caster levels', () => {
    const longsword = selection('item', 'longsword');
    const bite = selection('item', 'natural-bite');
    const effect = (ruleIdentity: string, onItem?: { entry: string }) =>
      entry('spellEffect', {
        catalogEntryId: seedId(ruleIdentity),
        state: {
          kind: 'spellEffect',
          casterLevel: 8,
          ...(onItem ? { onItem } : {}),
        },
      } as never);
    const loaded = expectParity([
      base(),
      ...levels(['fighter', 6]),
      longsword,
      bite,
      effect('representative-spell-effect-greater-magic-weapon', {
        entry: longsword._id,
      }),
      effect('representative-spell-effect-keen-edge', { entry: longsword._id }),
      effect('representative-spell-effect-magic-fang', { entry: bite._id }),
      effect('representative-spell-effect-magic-vestment'),
      effect('representative-spell-effect-shield-of-faith'),
      entry('attackRoutine', {
        state: {
          kind: 'attackRoutine',
          name: 'Sword',
          weaponEntryId: longsword._id,
          hands: 'two',
          mode: 'melee',
          naturalAttackEntryIds: [bite._id],
        },
      } as never),
    ]);
    // A Spell Effect finds its Spell by rule identity for its default.
    expect(loaded.map((row) => row.ruleIdentity)).toEqual(
      expect.arrayContaining([
        'representative-spell-greater-magic-weapon',
        'representative-spell-keen-edge',
        'representative-spell-magic-fang',
        'representative-spell-magic-vestment',
        'representative-spell-shield-of-faith',
      ]),
    );
    expect(
      loaded.some(
        (row) => row.ruleIdentity === 'representative-spell-magic-weapon',
      ),
    ).toBe(false);
    const calculated = calculate(
      [base(), effect('representative-spell-effect-greater-magic-weapon')],
      loaded,
    ) as { current: { spellEffects: { defaultCasterLevel: number }[] } };
    expect(calculated.current.spellEffects[0]?.defaultCasterLevel).toBe(5);
  });

  test('resolves the races a Character counts as for alternate Racial Traits', () => {
    const custom = (
      ruleIdentity: string,
      detail: Row['detail'],
      extra: Partial<Row> = {},
    ) =>
      ({
        _id: `custom-${ruleIdentity}` as Id<'catalogEntry'>,
        _creationTime: 0,
        scope: 'character',
        characterId,
        name: ruleIdentity,
        ruleIdentity,
        stacksWithItself: false,
        sources: [],
        modifiers: [{ target: 'ability.str', bonusType: 'racial', value: 2 }],
        detail,
        ...extra,
      }) as Row;
    // Half-orc, which this trait counts as, allows orc alternates.
    const orcBlood = custom(
      'counts-as-half-orc',
      { kind: 'racialTrait', raceEntryIds: [seedId('human')], replaces: [] },
      { countsAsRaces: ['half-orc'] },
    );
    const orcTrait = custom('orc-alternate', {
      kind: 'racialTrait',
      raceEntryIds: ['orc' as Id<'catalogEntry'>],
      replaces: [],
    });
    const loaded = expectParity(
      [
        base(),
        ...levels('fighter'),
        selection('race', 'human'),
        entry('racialTrait', {
          catalogEntryId: orcBlood._id,
          state: { kind: 'racialTrait' },
        } as never),
        entry('racialTrait', {
          catalogEntryId: orcTrait._id,
          state: { kind: 'racialTrait' },
        } as never),
      ],
      [orcBlood, orcTrait],
    );
    expect(loaded.map((row) => row.ruleIdentity)).toContain('half-orc');
  });

  test('resolves class feature prerequisites that name a feature by rule identity', () => {
    const feature = (classFeature: string, extra = {}) =>
      ({
        _id: `custom-${classFeature}` as Id<'catalogEntry'>,
        _creationTime: 0,
        scope: 'character',
        characterId,
        name: `Needs ${classFeature}`,
        ruleIdentity: `custom-${classFeature}`,
        stacksWithItself: false,
        sources: [],
        modifiers: [],
        detail: { kind: 'feat' },
        prerequisites: [{ kind: 'classFeature', classFeature, ...extra }],
      }) as Row;
    for (const [classes, required] of [
      [['rogue', 3], 'rogue-evasion'],
      [['unchained-rogue', 3], 'rogue-evasion'],
      [['rogue', 3], 'unchained-rogue-evasion'],
      [['fighter', 3], 'rogue-evasion'],
    ] as const) {
      const custom = feature(required);
      expectParity(
        [
          base(),
          ...levels(classes),
          entry('feat', {
            catalogEntryId: custom._id,
            state: { kind: 'feat' },
          } as never),
        ],
        [custom],
      );
    }
  });
});
