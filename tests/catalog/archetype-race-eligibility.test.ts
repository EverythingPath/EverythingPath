// @vitest-environment node
// archetype-race-eligibility (#716, PRD #251; ORCH research
// archetype-race-eligibility.md): an imported archetype carries its PCGen race
// restriction as a top-level `race` clause in its `prerequisites`, or an
// `uncheckedRequirement` hold (the prestige classes' route), never neither.
// The guard enumerates the pinned store's archetype records and finds a race
// token among a record's own fields as the importer splits them
// (`lineTokens`): a `PRERACE` or a `TEMPLATES` `PREFACT`, alone or inside
// another form. It maps every such record whose class has a reviewed schedule
// (the importer maps no other) and checks the emitted entry: a clause for
// exactly the races its race tokens name, or a hold. The reviewed race map is
// checked against the pinned PCGen and Foundry files. The store holds every
// file of PCGen's Paizo subtree (`data/pathfinder/paizo`) with a tokened
// record; that subtree at the pin has the same 79 (checked by hand for this
// slice; the pin's third-party data is outside it). Of the 79, 72 are mapped
// (70 with a race clause, 2 held) and 7, on classes without a schedule, are
// not emitted; the owner selection emits 68 of the 72 (67 clauses and
// Mooncursed's hold in a full `--pcgen` preview).
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { pcgenPin } from '../../scripts/catalog/inventory';
import { emitPcgenOwners } from '../../scripts/catalog/pcgen-owners';
import {
  archetypeRaceRequirements,
  reviewedArchetypeRaces,
} from '../../scripts/catalog/pcgen/archetype-races';
import {
  archetypeClassContext,
  mapArchetype,
} from '../../scripts/catalog/pcgen/archetypes';
import { buildEffectiveView } from '../../scripts/catalog/pcgen/effective';
import { inventoryPcgen } from '../../scripts/catalog/pcgen/inventory';
import {
  readPcgenTree,
  type PcgenRecord,
} from '../../scripts/catalog/pcgen/lst';
import { reviewedSchedule } from '../../scripts/catalog/pcgen/schedules';
import { lineTokens } from '../../scripts/catalog/pcgen/tokens';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { pinnedStore, readPinned } from './pinned-sources';

const tree = await readPcgenTree(`${pinnedStore}/pcgen/${pcgenPin.directory}`);
const view = buildEffectiveView(tree);
const inventory = inventoryPcgen(tree);
/** A field that is, or holds, a race token. */
const isRaceField = (field: string) =>
  /PRERACE:|PREFACT:\d+,TEMPLATES,/.test(field);
/** A field that is a race token itself, not a form holding one. */
const isRaceToken = (field: string) =>
  /^(?:PRERACE:|PREFACT:\d+,TEMPLATES,)/.test(field);
const raceFieldsOf = (record: PcgenRecord) =>
  lineTokens(record.text).filter(isRaceField);
const tokened = tree.archetypes.filter((record) => raceFieldsOf(record).length);
const allRaceKeys = new Set(reviewedArchetypeRaces.map(({ race }) => race.key));

/** The race keys a race token names, through the map; undefined where it has none. */
function namedRaceKeys(field: string) {
  const [tag = '', ...items] = field.split(',');
  const token = tag.startsWith('PRERACE:') ? 'PRERACE' : 'PREFACT';
  // PREFACT's first item is its source, TEMPLATES.
  const names =
    token === 'PRERACE'
      ? items
      : items.slice(1).map((fact) => fact.split('=')[0]);
  return names.map(
    (name) =>
      reviewedArchetypeRaces.find(
        ({ pcgen }) => pcgen.token === token && pcgen.name === name,
      )?.race.key,
  );
}

/** `Unchained Monk` is PCGen's base class of the `Monk (Unchained)` schedule. */
const scheduleOf = (record: PcgenRecord) => {
  const className =
    inventory.owners.find((owner) => owner.record === record)?.className ?? '';
  return reviewedSchedule(
    className.replace(/^Unchained (.+)$/, '$1 (Unchained)'),
  );
};
const slug = (key: string) => key.toLowerCase().replace(/[^a-z0-9]+/g, '-');
/** The entry and items the mapper emits for a record, as the import maps it. */
function emitted(record: PcgenRecord, importedRaceKeys = allRaceKeys) {
  const schedule = scheduleOf(record);
  if (!schedule) throw new Error(`${record.locator.key} has no schedule.`);
  const mapping = mapArchetype({
    context: archetypeClassContext({ tree, view, schedule }),
    record,
    externalKey: `everythingpath/${slug(record.locator.key)}`,
    featureKeyOf: (feature) => `everythingpath/${slug(feature.locator.key)}`,
    importedRaceKeys,
  });
  return {
    prerequisites: mapping.subject.entry.prerequisites ?? [],
    holds: mapping.items.filter(
      ({ kind, externalKey }) =>
        kind === 'uncheckedRequirement' &&
        externalKey === mapping.subject.entry.externalKey,
    ),
  };
}
const mappable = tokened.filter((record) => scheduleOf(record));

describe('the race restriction of every tokened pinned archetype record', () => {
  it('finds the 79 records of the Paizo subtree, in the seven files that hold them', () => {
    expect(tokened).toHaveLength(79);
    expect(
      [...new Set(tokened.map(({ locator }) => locator.file))].sort(),
    ).toEqual([
      'campaign_setting/inner_sea_combat/isc_abilities_class.lst',
      'player_companion/blood_of_the_beast/botb_abilities_class.lst',
      'roleplaying_game/advanced_race_guide/arg_abilities_class.lst',
      'roleplaying_game/horror_adventures/ha_abilities_class.lst',
      'roleplaying_game/ultimate_wilderness/support/uw_abilities_class_oa.lst',
      'roleplaying_game/ultimate_wilderness/uw_abilities_class.lst',
      'roleplaying_game/ultimate_wilderness/uw_abilities_companion.lst',
    ]);
  });

  it('maps every one whose class has a reviewed schedule; the importer maps no other', () => {
    expect(
      tokened
        .filter((record) => !scheduleOf(record))
        .map(({ locator }) => locator.key),
    ).toEqual([
      'Gunslinger Archetype ~ Experimental Gunsmith',
      'Gunslinger Archetype ~ Buccaneer',
      'Gunslinger Archetype ~ Bushwhacker',
      'Gunslinger Archetype ~ Gulch Gunner',
      'Familiar Archetype ~ Animal Exemplar',
      'Kineticist Archetype ~ Leshykineticist',
      'Mesmerist Archetype ~ Aromaphile',
    ]);
    expect(mappable).toHaveLength(72);
  });

  it.each(mappable.map((record) => ({ key: record.locator.key, record })))(
    'emits $key with a top-level race clause for exactly the races it names, or a hold',
    ({ record }) => {
      const { prerequisites, holds } = emitted(record);
      if (holds.length) return;
      const fields = raceFieldsOf(record);
      // Without a hold, every race token stands alone and every clause is a
      // top-level race clause, not an `anyOf` or a nested form.
      expect(fields.every(isRaceToken)).toBe(true);
      expect(prerequisites.every((clause) => 'race' in clause)).toBe(true);
      expect(
        prerequisites.flatMap((clause) =>
          'race' in clause ? clause.race : [],
        ),
      ).toEqual(fields.flatMap(namedRaceKeys));
      expect(prerequisites.length).toBeGreaterThan(0);
    },
  );

  it('emits 70 race clauses and holds 2: a subtype and a combined form', () => {
    const outcomes = mappable.map((record) => {
      const { holds } = emitted(record);
      return holds.length
        ? [record.locator.key, holds.map(({ id, text }) => [id, text])]
        : 'race clause';
    });
    expect(
      outcomes.filter((outcome) => outcome === 'race clause'),
    ).toHaveLength(70);
    expect(outcomes.filter((outcome) => outcome !== 'race clause')).toEqual([
      [
        'Sorcerer Archetype ~ Nine-Tailed Heir',
        [
          [
            'PRERACE:1,Kitsune,RACESUBTYPE=Kitsune',
            'PRERACE:1,Kitsune,RACESUBTYPE=Kitsune stays unchecked (PRERACE type): “race: one of Kitsune, RACESUBTYPE=Kitsune”.',
          ],
        ],
      ],
      [
        'Barbarian Archetype ~ Mooncursed',
        [
          [
            'PREMULT:1,[PRERACE:1,RACETYPE=Humanoid,RACETYPE=Monstrous Humanoid],[PREFACT:1,TEMPLATES,IsHumanoid=True]',
            'PREMULT:1,[PRERACE:1,RACETYPE=Humanoid,RACETYPE=Monstrous Humanoid],[PREFACT:1,TEMPLATES,IsHumanoid=True] stays unchecked (race token in a combined form): “(race: one of type Humanoid, type Monstrous Humanoid) or (PCGen fact IsHumanoid=True)”.',
          ],
        ],
      ],
    ]);
  });

  it('holds a race the import does not emit, a race the map lacks, another count, a negation, another fact value and a combined form', () => {
    const exarch = tokened.find(
      ({ locator }) => locator.key === 'Inquisitor Archetype ~ Exarch',
    );
    if (!exarch) throw new Error('No Exarch');
    const notEmitted = emitted(exarch, new Set());
    expect(notEmitted.prerequisites).toEqual([
      { kind: 'unchecked', unchecked: 'PCGen fact IsDwarf=true' },
    ]);
    expect(notEmitted.holds.map(({ id }) => id)).toEqual([
      'PREFACT:1,TEMPLATES,IsDwarf=true',
    ]);
    const rules = (token: string) =>
      archetypeRaceRequirements({
        tokens: [{ token, file: 'synthetic.lst', line: 1 }],
      }).requirements.flatMap(({ clauses }) => clauses.map(({ rule }) => rule));
    expect(rules('PRERACE:1,Android')).toEqual([
      'unchecked: PRERACE unresolved reference',
    ]);
    expect(rules('PREFACT:1,TEMPLATES,IsAndroid=true')).toEqual([
      'unchecked: PREFACT unresolved reference',
    ]);
    expect(rules('PREFACT:2,TEMPLATES,IsDwarf=true,IsElf=true')).toEqual([
      'unchecked: PREFACT count',
    ]);
    expect(rules('PRERACE:2,Vine Leshy,Ghoran')).toEqual([
      'unchecked: PRERACE count',
    ]);
    expect(rules('!PREFACT:1,TEMPLATES,IsDwarf=true')).toEqual([
      'unchecked: negation',
    ]);
    expect(rules('PREFACT:1,TEMPLATES,IsDwarf=false')).toEqual([
      'unchecked: PREFACT fact value',
    ]);
    // A race beside an alignment, or two races, in a PREMULT: the builder
    // would make an `anyOf` of them, which is not the archetype's shape.
    expect(
      rules('PREMULT:1,[PREFACT:1,TEMPLATES,IsDwarf=true],[PREALIGN:LG]'),
    ).toEqual(['unchecked: race token in a combined form']);
    expect(
      rules('PREMULT:1,[PRERACE:1,Ghoran],[PRERACE:1,Vine Leshy]'),
    ).toEqual(['unchecked: race token in a combined form']);
    // One of two races is the clause's `race` list, as PRERACE reads it.
    expect(
      archetypeRaceRequirements({
        tokens: [
          {
            token: 'PREFACT:1,TEMPLATES,IsDwarf=true,IsDuergar=true',
            file: 'synthetic.lst',
            line: 1,
          },
        ],
      }).requirements[0]?.clauses,
    ).toEqual([
      {
        rule: 'PREFACT TEMPLATES → race',
        prerequisite: {
          kind: 'race',
          race: ['pf1/nEltI9y37rKJTeWo', 'pf1/eV9USBGHA1rYd5P7'],
        },
      },
    ]);
    // A fact that names no race is not a race requirement.
    expect(
      rules('PREFACT:1,ABILITIES,Monk_Archetype_StunningFist=true'),
    ).toEqual([]);
  });
});

const foundryRaceSchema = z.object({
  _id: z.string(),
  name: z.string(),
  type: z.literal('race'),
});

describe('the reviewed race map', () => {
  it.each(reviewedArchetypeRaces)(
    '$pcgen.token $pcgen.name is the line that defines it and the Foundry race it names',
    async ({ pcgen, race }) => {
      const line = (
        await readPinned('pcgen', `${pcgenPin.directory}/${pcgen.file}`)
      ).split(/\r\n|\r|\n/)[pcgen.line - 1];
      if (pcgen.token === 'PREFACT') {
        expect(line).toMatch(
          new RegExp(`^FACTDEF:TEMPLATE\\|${pcgen.name}\\t`),
        );
        expect(line).toContain(`\tDISPLAYNAME:${race.name}\t`);
      } else {
        expect(line?.split('\t')[0]).toBe(pcgen.name);
        expect(race.name).toBe(pcgen.name);
      }
      const foundry = foundryRaceSchema.parse(
        parse(await readPinned('pf1', race.file)),
      );
      expect(`pf1/${foundry._id}`).toBe(race.key);
      expect(foundry.name).toBe(race.name);
    },
  );

  it('names every race a tokened record names by PRERACE or template fact, and no other', () => {
    const named = new Set(
      tokened.flatMap((record) =>
        raceFieldsOf(record).filter(isRaceToken).flatMap(namedRaceKeys),
      ),
    );
    expect([...named].sort()).toEqual([...allRaceKeys, undefined].sort());
  });
});

describe('the importer emits the requirement on the archetype entry', () => {
  const ironskin = {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/advanced_race_guide/arg_abilities_class.lst',
    key: 'Monk Archetype ~ Ironskin Monk',
  } as const;
  const mooncursed = {
    kind: 'archetype',
    className: 'Barbarian',
    file: 'roleplaying_game/horror_adventures/ha_abilities_class.lst',
    key: 'Barbarian Archetype ~ Mooncursed',
  } as const;
  const emit = (importedRaceKeys?: ReadonlySet<string>) =>
    emitPcgenOwners({
      tree,
      data: reviewedCuration,
      selection: [ironskin, mooncursed],
      ...(importedRaceKeys && { importedRaceKeys }),
    });
  const entryOf = (emission: ReturnType<typeof emit>, key: string) =>
    emission.entries.find(({ externalKey }) => externalKey === key);
  const structureHold = (emission: ReturnType<typeof emit>, key: string) =>
    emission.reviewHolds.find(
      ({ externalKey, reason }) =>
        externalKey === key && reason.startsWith('Structure hand review'),
    )?.reason ?? '';

  it('a typed race clause with its provenance, and a held one with its item', () => {
    const emission = emit(allRaceKeys);
    const monk = entryOf(emission, 'everythingpath/monk-ironskin-monk');
    expect(monk?.prerequisites).toEqual([
      { kind: 'race', race: ['pf1/19JcztRuEWbrOqQW'] },
    ]);
    expect(monk?.provenance?.prerequisites).toEqual({
      source: 'pcgen',
      locator: {
        file: ironskin.file,
        line: expect.any(Number),
        key: ironskin.key,
      },
    });
    expect(
      structureHold(emission, 'everythingpath/monk-ironskin-monk'),
    ).not.toContain('uncheckedRequirement');
    const barbarian = entryOf(emission, 'everythingpath/barbarian-mooncursed');
    expect(barbarian?.prerequisites).toEqual([
      {
        kind: 'unchecked',
        unchecked:
          '(race: one of type Humanoid, type Monstrous Humanoid) or (PCGen fact IsHumanoid=True)',
      },
    ]);
    expect(
      structureHold(emission, 'everythingpath/barbarian-mooncursed'),
    ).toContain(
      'uncheckedRequirement PREMULT:1,[PRERACE:1,RACETYPE=Humanoid,RACETYPE=Monstrous Humanoid],[PREFACT:1,TEMPLATES,IsHumanoid=True]',
    );
  });

  it('holds the clause when the import does not emit the race', () => {
    const emission = emit(new Set(['pf1/e6IaBxKgMxy1yKlr']));
    expect(
      entryOf(emission, 'everythingpath/monk-ironskin-monk')?.prerequisites,
    ).toEqual([
      { kind: 'unchecked', unchecked: 'PCGen fact IsHobgoblin=true' },
    ]);
    expect(
      structureHold(emission, 'everythingpath/monk-ironskin-monk'),
    ).toContain('uncheckedRequirement PREFACT:1,TEMPLATES,IsHobgoblin=true');
  });
});
