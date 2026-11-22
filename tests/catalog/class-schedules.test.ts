// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { reviewedScheduleEntries } from '../../scripts/catalog/class-schedules';
import { parseLaunchInventoryDocument } from '../../scripts/catalog/launch-inventory-document';
import { launchManifestSchema } from '../../scripts/catalog/launch-inventory-schema';
import { mapEntry, type PreviewEntry } from '../../scripts/catalog/map';
import {
  reviewedScheduleSlots,
  scheduleSlotRules,
} from '../../scripts/catalog/pcgen/schedule-slots';
import type { ScheduleClassName } from '../../scripts/catalog/pcgen/schedule-model';
import {
  allIncrementKeys,
  incrementEntries,
  reviewedSchedule,
  scheduleRows,
  type ReviewedSchedule,
} from '../../scripts/catalog/pcgen/schedules';
import type { LoadedRecord } from '../../scripts/catalog/records';
import { readArray, readObject } from '../../scripts/catalog/values';
import { loadPinnedClass } from './pinned-classes';

/** Every reviewed schedule's class, so the type checker names a new one. */
const reviewedClassNames = Object.keys({
  Fighter: true,
  Rogue: true,
  Ranger: true,
  Wizard: true,
  Druid: true,
  Summoner: true,
  'Summoner (Unchained)': true,
  Hunter: true,
  Shifter: true,
  Monk: true,
  'Monk (Unchained)': true,
  Brawler: true,
  Ninja: true,
  'Rogue (Unchained)': true,
  Bard: true,
  Barbarian: true,
  'Barbarian (Unchained)': true,
  Skald: true,
  Bloodrager: true,
  Paladin: true,
  Antipaladin: true,
  Cavalier: true,
  Samurai: true,
  Alchemist: true,
  Investigator: true,
  Slayer: true,
  Vigilante: true,
  Inquisitor: true,
  Magus: true,
  Cleric: true,
  Sorcerer: true,
  Oracle: true,
  Witch: true,
} satisfies Record<ScheduleClassName, true>);

function schedule(className: string): ReviewedSchedule {
  const found = reviewedSchedule(className);
  if (!found) throw new Error(`No reviewed ${className} schedule.`);
  return found;
}

/**
 * The reviewed 420 launch checkpoints (#771/#772): each launch class's
 * scheduled keys by level, as the committed scope prints them.
 */
async function readCheckpoints() {
  const text = await readFile(
    new URL(
      '../../scripts/catalog/scopes/campaign-mvp-v1.checkpoints.json',
      import.meta.url,
    ),
    'utf8',
  );
  return launchManifestSchema.shape.checkpoints.parse(
    parseLaunchInventoryDocument(JSON.parse(text)),
  );
}

const everyKey = (key: string) => key;

const loadClass = loadPinnedClass;

/** The importer's entries for a pinned class: its mapped body, then any increments. */
async function importClass(
  file: string,
  {
    resolveKey = everyKey,
    edit = (source: LoadedRecord) => source,
  }: {
    resolveKey?: (key: string) => string | undefined;
    edit?: (source: LoadedRecord) => LoadedRecord;
  } = {},
) {
  const source = edit(await loadClass(file));
  const entry = mapEntry({
    source,
    kind: 'class',
    resolveKey,
    lookup: new Map(),
    spellClassTags: new Set(),
  });
  return reviewedScheduleEntries({ entry, record: source.record, resolveKey });
}

function classBody(entries: PreviewEntry[]) {
  const [body] = entries;
  if (body?.detail.kind !== 'class') throw new Error('No class body.');
  return { ...body, detail: body.detail };
}

const rowsOf = (entries: PreviewEntry[]) =>
  classBody(entries).detail.featuresByLevel.map(
    ({ classLevel, externalKey }) => `${String(classLevel)} ${externalKey}`,
  );
const associationRefusals = (entries: PreviewEntry[]) =>
  classBody(entries).unsupported.filter(
    ({ field }) => field === 'links.classAssociations',
  );

/** Foundry associations no table lists, kept at their Foundry levels. */
const keptNonRows: Record<string, string[]> = {
  Fighter: ['7 pf1/iqeyCQIIVnNt0p3h'], // Heavy Armor
  Cleric: ['1 pf1/EvrFDqZDbbFS4Avb'], // Bonus Languages
  Druid: ['1 pf1/HL53FUqkS4PZCMIK'], // Bonus Languages
};

const fighterFile = 'packs/classes/fighter.WLqBCT5DqmGAx8Wd.yaml';
const fighterKeys = {
  bonusFeats: 'pf1/CV8BsY3ciUb9TA1Y',
  bravery: 'pf1/h0Brxw6khcjlEf1T',
  armorTraining: 'pf1/5JFfSqLMCpbRmERa',
  weaponTraining: 'pf1/RzEzudurxQFirFoF',
  heavyArmor: 'pf1/iqeyCQIIVnNt0p3h',
  armorMastery: 'pf1/NwTe1Q2utlsmOAqK',
  weaponMastery: 'pf1/McXAM1BoPHZLO1n4',
};
const fighterIncrement = (feature: string, level: number) =>
  `everythingpath/fighter-${feature}-${level}`;

describe('reviewed class schedules: featuresByLevel', () => {
  it('gives each launch class the reviewed checkpoints’ rows, with the Foundry non-rows at their Foundry levels', async () => {
    const checkpoints = await readCheckpoints();
    const classNames = [...new Set(checkpoints.map((row) => row.className))];
    expect(classNames).toHaveLength(21);
    for (const className of classNames) {
      const entries = await importClass(schedule(className).foundryFile);
      const expected = [
        ...checkpoints
          .filter((row) => row.className === className)
          .flatMap(({ level, scheduledKeys }) =>
            scheduledKeys.map((key) => `${level} ${key}`),
          ),
        ...(keptNonRows[className] ?? []),
      ];
      const levelOf = (row: string) => Number(row.split(' ')[0]);
      expect(rowsOf(entries), className).toEqual(
        expected
          .map((row, index) => ({ row, index }))
          .sort(
            (left, right) =>
              levelOf(left.row) - levelOf(right.row) ||
              left.index - right.index,
          )
          .map(({ row }) => row),
      );
      expect(associationRefusals(entries), className).toEqual([]);
    }
  });

  it('gives the Fighter its 27 rows: Heavy Armor at 7, as Foundry links it, and Armor Mastery at 19', async () => {
    const k = fighterKeys;
    const bonus = (level: number) => fighterIncrement('bonus-feats', level);
    expect(rowsOf(await importClass(fighterFile))).toEqual([
      `1 ${k.bonusFeats}`,
      `2 ${bonus(2)}`,
      `2 ${k.bravery}`,
      `3 ${k.armorTraining}`,
      `4 ${bonus(4)}`,
      `5 ${k.weaponTraining}`,
      `6 ${bonus(6)}`,
      `6 ${fighterIncrement('bravery', 6)}`,
      `7 ${fighterIncrement('armor-training', 7)}`,
      `7 ${k.heavyArmor}`,
      `8 ${bonus(8)}`,
      `9 ${fighterIncrement('weapon-training', 9)}`,
      `10 ${bonus(10)}`,
      `10 ${fighterIncrement('bravery', 10)}`,
      `11 ${fighterIncrement('armor-training', 11)}`,
      `12 ${bonus(12)}`,
      `13 ${fighterIncrement('weapon-training', 13)}`,
      `14 ${bonus(14)}`,
      `14 ${fighterIncrement('bravery', 14)}`,
      `15 ${fighterIncrement('armor-training', 15)}`,
      `16 ${bonus(16)}`,
      `17 ${fighterIncrement('weapon-training', 17)}`,
      `18 ${bonus(18)}`,
      `18 ${fighterIncrement('bravery', 18)}`,
      `19 ${k.armorMastery}`,
      `20 ${bonus(20)}`,
      `20 ${k.weaponMastery}`,
    ]);
  });

  it('places Tireless Rage at 17, the table’s level, not at Foundry’s 16', async () => {
    const rows = rowsOf(
      await importClass(schedule('Barbarian').foundryFile),
    ).filter((row) => row.endsWith(' pf1/aYdjgDZJCNvKpLQP'));
    expect(rows).toEqual(['17 pf1/aYdjgDZJCNvKpLQP']);
  });

  it('refuses nothing in the 33 pinned reviewed classes, and gives Hunter its Orisons at 1', async () => {
    let increments = 0;
    for (const className of reviewedClassNames) {
      const entries = await importClass(schedule(className).foundryFile);
      expect(associationRefusals(entries), className).toEqual([]);
      increments += entries.length - 1;
    }
    expect(increments).toBe(521);
    const hunter = rowsOf(await importClass(schedule('Hunter').foundryFile));
    expect(hunter.filter((row) => row.startsWith('1 '))).toContain(
      `1 ${scheduleRows(schedule('Hunter')).find(({ feature }) => feature === 'orisons')?.externalKey}`,
    );
  });

  it('leaves a class without a reviewed schedule as Foundry links it, with no increments', async () => {
    const file = 'packs/classes/arcanist.GK6rAenFfgJNNJCX.yaml';
    const source = await loadClass(file);
    const entry = mapEntry({
      source,
      kind: 'class',
      resolveKey: everyKey,
      lookup: new Map(),
      spellClassTags: new Set(),
    });
    const before = JSON.stringify(entry);
    const entries = reviewedScheduleEntries({
      entry,
      record: source.record,
      resolveKey: everyKey,
    });
    expect(entries).toHaveLength(1);
    expect(JSON.stringify(entries[0])).toBe(before);
  });
});

describe('reviewed class schedules: explicit refusals', () => {
  /** The Fighter record with one more Foundry association. */
  const withAssociation =
    (level: number, id: string) =>
    (source: LoadedRecord): LoadedRecord => {
      const links = readObject(source.record.system.links);
      return {
        ...source,
        record: {
          ...source.record,
          system: {
            ...source.record.system,
            links: {
              ...links,
              classAssociations: [
                ...readArray(links.classAssociations),
                { level, uuid: `Compendium.pf1.class-abilities.Item.${id}` },
              ],
            },
          },
        },
      };
    };

  it('refuses a Foundry association the schedule does not explain, naming its key', async () => {
    // Arcane Bond (the Wizard's) linked to the Fighter at 3.
    const entries = await importClass(fighterFile, {
      edit: withAssociation(3, 'pW1PNlDcdGl7KuEa'),
    });
    expect(associationRefusals(entries)).toEqual([
      expect.objectContaining({
        field: 'links.classAssociations',
        value: expect.objectContaining({
          level: 3,
          externalKey: 'pf1/pW1PNlDcdGl7KuEa',
        }),
      }),
    ]);
    // The table's rows stay; the unexplained link is not one of them.
    expect(rowsOf(entries)).toHaveLength(27);
    expect(rowsOf(entries)).not.toContain('3 pf1/pW1PNlDcdGl7KuEa');
  });

  it('refuses a Foundry association at a level the schedule does not give it', async () => {
    // Bravery linked again at 6, where the table's row is an increment.
    const entries = await importClass(fighterFile, {
      edit: withAssociation(6, 'h0Brxw6khcjlEf1T'),
    });
    expect(associationRefusals(entries)).toEqual([
      expect.objectContaining({
        value: expect.objectContaining({
          level: 6,
          externalKey: fighterKeys.bravery,
        }),
      }),
    ]);
  });

  it('refuses a scheduled key that does not resolve, naming it, and emits none of its increments', async () => {
    const missing = new Set([fighterKeys.armorMastery, fighterKeys.bonusFeats]);
    const entries = await importClass(fighterFile, {
      resolveKey: (key) => (missing.has(key) ? undefined : key),
    });
    expect(associationRefusals(entries).map(({ value }) => value)).toEqual([
      expect.objectContaining({
        level: 1,
        externalKey: fighterKeys.bonusFeats,
      }),
      expect.objectContaining({
        level: 19,
        externalKey: fighterKeys.armorMastery,
      }),
    ]);
    const rows = rowsOf(entries);
    expect(rows.some((row) => row.includes('bonus-feats'))).toBe(false);
    expect(rows).not.toContain(`19 ${fighterKeys.armorMastery}`);
    expect(
      entries.filter(({ externalKey }) => externalKey.includes('bonus-feats')),
    ).toEqual([]);
    expect(entries.slice(1).map(({ externalKey }) => externalKey)).toEqual(
      incrementEntries(schedule('Fighter'))
        .map(({ externalKey }) => externalKey)
        .filter((key) => !key.includes('bonus-feats')),
    );
  });

  it('refuses a remapped scheduled key: the schedule names its upstream key', async () => {
    const entries = await importClass(fighterFile, {
      resolveKey: (key) =>
        key === fighterKeys.bravery ? 'pf1/remappedBravery' : key,
    });
    expect(associationRefusals(entries)).toEqual([
      expect.objectContaining({
        value: expect.objectContaining({
          level: 2,
          externalKey: fighterKeys.bravery,
        }),
      }),
    ]);
    expect(rowsOf(entries).some((row) => row.includes('bravery'))).toBe(false);
  });
});

describe('reviewed class schedules: increments', () => {
  it('emits the 315 launch increments, the reviewed checkpoints’ increment keys', async () => {
    const checkpoints = await readCheckpoints();
    const checkpointIncrements = new Set(
      checkpoints.flatMap(({ scheduledKeys }) =>
        scheduledKeys.filter((key) => key.startsWith('everythingpath/')),
      ),
    );
    const emitted: string[] = [];
    for (const className of new Set(checkpoints.map((row) => row.className)))
      for (const entry of (
        await importClass(schedule(className).foundryFile)
      ).slice(1))
        emitted.push(entry.externalKey);
    expect(emitted).toHaveLength(315);
    expect(new Set(emitted)).toEqual(checkpointIncrements);
    expect(emitted.sort()).toEqual(
      allIncrementKeys()
        .filter((key) => checkpointIncrements.has(key))
        .sort(),
    );
  });

  it('wraps each increment as the schedule authors it, taking its parent’s upstream key and attribution', async () => {
    for (const className of reviewedClassNames) {
      const reviewed = schedule(className);
      const increments = (await importClass(reviewed.foundryFile)).slice(1);
      expect(
        increments.map(
          // A slot is the only other addition (see the slot tests).
          ({ upstreamKey, attributionFrom, grantsSlots: _slot, ...entry }) => {
            if (entry.detail.kind !== 'classFeature')
              throw new Error(`${entry.externalKey} is no class feature.`);
            expect(upstreamKey, entry.externalKey).toBe(
              entry.detail.parentFeature,
            );
            expect(attributionFrom, entry.externalKey).toBe(
              entry.detail.parentFeature,
            );
            return { ...entry, upstreamKey: entry.externalKey };
          },
        ),
        className,
      ).toEqual(
        incrementEntries(reviewed).map(({ upstreamKey, ...entry }) => ({
          ...entry,
          upstreamKey,
        })),
      );
    }
  });

  it('leaves the schedules’ rows and increment entries byte-identical, so the launch inventory does not move', () => {
    // sha256 of every reviewed schedule's `scheduleRows` and
    // `incrementEntries` at 5d6313e4 (521 increments).
    const outputs = reviewedClassNames.map((className) => {
      const reviewed = schedule(className);
      return [className, scheduleRows(reviewed), incrementEntries(reviewed)];
    });
    expect(
      createHash('sha256').update(JSON.stringify(outputs)).digest('hex'),
    ).toBe('c117c9cade559aadc794dda58f27667f8366d1d87ba771303da598d0a130f059');
  });
});

describe('reviewed bonus feat slots', () => {
  const slot = (featTypes: string[]) => [{ kind: 'feat', count: 1, featTypes }];
  /** The slot-bearing rows of a class: its acquisition entry and its increments. */
  async function slotRows(className: string, acquisition: string) {
    const reviewed = schedule(className);
    const increments = (await importClass(reviewed.foundryFile)).slice(1);
    const feature = await mapFeature(acquisition);
    return [
      ...reviewedScheduleEntries({
        entry: feature,
        record: { _id: '', _key: '', name: '', type: '', system: {} },
        resolveKey: everyKey,
      }),
      ...increments,
    ].filter(({ grantsSlots }) => grantsSlots);
  }
  /** A minimal class feature body standing in for the acquisition record's. */
  async function mapFeature(externalKey: string): Promise<PreviewEntry> {
    return {
      externalKey,
      upstreamKey: externalKey,
      pack: 'class-abilities',
      name: 'Acquisition',
      detail: { kind: 'classFeature' },
      description: '',
      sources: [],
      modifiers: [],
      unsupported: [],
    };
  }

  it('gives the four reviewed bonus feat features one typed slot per row', async () => {
    const cases = [
      ['Fighter', 'pf1/CV8BsY3ciUb9TA1Y', ['Combat'], 11],
      ['Cavalier', 'pf1/vfu0FW2XYF7cBUQp', ['Combat'], 3],
      [
        'Magus',
        'pf1/gzBR0qkMdu0KkLV0',
        ['Combat', 'Item Creation', 'Metamagic'],
        3,
      ],
      ['Inquisitor', 'pf1/717fyDCcfLtD345B', ['Teamwork'], 6],
    ] as const;
    for (const [className, acquisition, featTypes, count] of cases) {
      const feature = schedule(className).features.find(
        ({ externalKey }) => externalKey === acquisition,
      );
      expect(feature?.levels, className).toHaveLength(count);
      const rows = await slotRows(className, acquisition);
      expect(
        rows.map(({ externalKey }) => externalKey),
        className,
      ).toEqual(
        (feature?.levels ?? []).map((level, index) =>
          index === 0
            ? acquisition
            : `everythingpath/${schedule(className).slug}-${feature?.id}-${level}`,
        ),
      );
      for (const row of rows)
        expect(row.grantsSlots, row.externalKey).toEqual(slot([...featTypes]));
    }
  });

  it('cites each rule to its PRD line and names exactly four', () => {
    expect(
      scheduleSlotRules.map(({ className, feature, featTypes, printed }) => [
        className,
        feature,
        featTypes,
        printed,
      ]),
    ).toEqual([
      [
        'Fighter',
        'bonus-feats',
        ['Combat'],
        'coreRulebook/classes/fighter.html:380',
      ],
      [
        'Cavalier',
        'bonus-feat',
        ['Combat'],
        'advancedPlayersGuide/baseClasses/cavalier.html:392',
      ],
      [
        'Magus',
        'bonus-feats',
        ['Combat', 'Item Creation', 'Metamagic'],
        'ultimateMagic/spellcasters/magus.html:424',
      ],
      [
        'Inquisitor',
        'teamwork-feat',
        ['Teamwork'],
        'advancedPlayersGuide/baseClasses/inquisitor.html:432',
      ],
    ]);
  });

  it('gives no other row a slot', async () => {
    const slotted = new Set(reviewedScheduleSlots().keys());
    expect(slotted.size).toBe(11 + 3 + 3 + 6);
    for (const className of reviewedClassNames)
      for (const entry of (
        await importClass(schedule(className).foundryFile)
      ).slice(1))
        expect(Boolean(entry.grantsSlots), entry.externalKey).toBe(
          slotted.has(entry.externalKey),
        );
    // A class feature outside the rules keeps its body.
    const [plain] = reviewedScheduleEntries({
      entry: await mapFeature(fighterKeys.bravery),
      record: { _id: '', _key: '', name: '', type: '', system: {} },
      resolveKey: everyKey,
    });
    expect(plain).toEqual(await mapFeature(fighterKeys.bravery));
  });

  it('refuses a rule naming an unknown class or feature', () => {
    const [fighter] = scheduleSlotRules;
    if (!fighter) throw new Error('No Fighter rule.');
    expect(() =>
      reviewedScheduleSlots([
        { ...fighter, className: 'Arcanist' as ScheduleClassName },
      ]),
    ).toThrow('Arcanist');
    expect(() =>
      reviewedScheduleSlots([{ ...fighter, feature: 'combat-style' }]),
    ).toThrow('combat-style');
  });

  it('puts each slot-bearing acquisition on exactly one reviewed schedule', () => {
    for (const rule of scheduleSlotRules) {
      const acquisition = schedule(rule.className).features.find(
        ({ id }) => id === rule.feature,
      )?.externalKey;
      expect(
        reviewedClassNames.filter((className) =>
          schedule(className).features.some(
            ({ externalKey }) => externalKey === acquisition,
          ),
        ),
        rule.className,
      ).toEqual([rule.className]);
    }
  });
});
