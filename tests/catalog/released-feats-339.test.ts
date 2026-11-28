// @vitest-environment node
// pbl-released-feats-2 (PRD #251): the feat batch units' resolver blocks
// (feats-339 to feats-347), on entries imported from the pinned store. One
// import holds every key of the nine batches' key data (released-feat-keys.ts);
// each describe looks its feats up by name within its batch's named keys, and
// each check of "every entry" checks that batch's preview key list, as the
// batch units did over their preview. Each case asserts what the importer
// emits for the named entries and what the resolver or the sheet computes
// from them; the batch reviews' records are not read, so the units' checks of
// those records stay with the units.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import {
  builtIn,
  calculateCharacterSheetProjections,
  resolveSheet,
  type InputSourcedModifier,
} from '../../src/lib/character-sheet';
import {
  prerequisiteSheet,
  selectedFeat,
} from '../../src/lib/character-sheet-prerequisite-fixture';
import { pinnedRecordFile, pinnedStore } from './pinned-sources';
import { importReleasedEntries, type ReleasedEntry } from './released-entries';
import {
  featBatches,
  featBatchKeys,
  type FeatBatch,
} from './released-feat-keys';
import { featBatch } from './released-feat-sheet';
import { expectAutomaticSkillFocus } from './skill-focus-assertions';

const { entries } = await importReleasedEntries(
  featBatchKeys([
    'feats-339',
    'feats-340',
    'feats-341',
    'feats-342',
    'feats-343',
    'feats-344',
    'feats-345',
    'feats-346',
    'feats-347',
  ]),
);

const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');

/**
 * The Situations of every Modifier and Situational Note of the given entries
 * that are shared keys, each with its entry's name.
 */
function sharedSituations(rows: readonly ReleasedEntry[]) {
  return rows.flatMap((row) => {
    const parsed = importedCatalogEntrySchema.parse(row);
    return [
      ...parsed.modifiers.map((row) => row.condition?.situation),
      ...(parsed.situationalNotes ?? []).flatMap((row) => [
        row.situation,
        row.condition?.situation,
      ]),
    ].flatMap((situation) =>
      typeof situation === 'string' ? [{ name: parsed.name, situation }] : [],
    );
  });
}

/** A Modifier's Situation when it is local text, else undefined. */
function localOf(modifier: ReturnType<FeatModifiers>[number] | undefined) {
  const situation = modifier?.condition?.situation;
  return typeof situation === 'object' && 'local' in situation
    ? situation
    : undefined;
}

type FeatModifiers = ReturnType<typeof featBatch>['modifiers'];

/** Each entry of the batch preview's key list, as the import emits it. */
function everyEntry(batch: FeatBatch) {
  const data: (typeof featBatches)[FeatBatch] = featBatches[batch];
  if (!('every' in data)) throw new Error(`${batch} lists no preview keys`);
  return data.every.map((key) => {
    const row = entries.get(key);
    if (!row) throw new Error(`${key} was not imported`);
    return row;
  });
}

describe('the feats-339 keys', () => {
  const { entry, modifiers, localSituation, featSheet } = featBatch(
    entries,
    'feats-339',
  );

  it('uses registered shared Situations on every entry of the batch preview', () => {
    const registered = new Set(curation.situations.map((row) => row.key));
    const feats = everyEntry('feats-339');
    expect(feats).toHaveLength(100);
    for (const { name, situation } of sharedSituations(feats))
      expect(registered.has(situation), name).toBe(true);
  });

  // #724: the rank threshold is automatic, read from the skill's recorded ranks.
  it('gives Skill Focus (Perception) +3, or +6 at 10 ranks, without a Situation or a stacking same-Source copy', () => {
    const data = modifiers('Skill Focus (Perception)');
    expectAutomaticSkillFocus({ modifiers: data, target: 'skill.per' });
    // No ranks: its ability modifier and Skill Focus's +3.
    for (const projection of Object.values(
      calculateCharacterSheetProjections(
        featSheet('Skill Focus (Perception)', 'situation', { wisdom: 14 }),
      ),
    ))
      expect(projection.breakdowns['skill.per'].total).toBe(5);
  });

  it('restricts Solo Maneuvers CMB and CMD +1 to the sole-threatening circumstance', () => {
    const data = modifiers('Solo Maneuvers');
    for (const target of ['cmb', 'cmd'] as const) {
      const solo = localSituation('Solo Maneuvers', target);
      expect(solo.local).toMatch(/only.*threatening|sole.*threatening/i);
      expect(resolveSheet(data)[target].total).toBe(0);
      expect(resolveSheet(data, { situations: [solo] })[target].total).toBe(1);
      expect(resolveSheet(data, { situations: ['trip'] })[target].total).toBe(
        0,
      );
      expect(
        resolveSheet(data, {
          situations: [{ ...solo, sheetEntryId: 'other' }],
        })[target].total,
      ).toBe(0);
    }
  });

  it('keeps Wolf Trip +2 specific to a style-enabled attack-of-opportunity trip', () => {
    const data = modifiers('Wolf Trip');
    const trip = localSituation('Wolf Trip', 'cmb');
    expect(trip.local).toMatch(/Wolf Style/);
    expect(trip.local).toMatch(/trip/i);
    expect(trip.local).toMatch(/attack of opportunity/i);
    expect(resolveSheet(data).cmb.total).toBe(0);
    expect(resolveSheet(data, { situations: [trip] }).cmb.total).toBe(2);
    for (const situations of [['trip'], ['grapple'], ['trip', 'grapple']])
      expect(resolveSheet(data, { situations }).cmb.total).toBe(0);
  });

  it('does not grant Standing Tall timed or completed-story defenses for broad shared Situations', () => {
    const data = modifiers('Standing Tall');
    const mind = localOf(
      data.find((row) => /mind-affecting/i.test(localOf(row)?.local ?? '')),
    );
    const completed = localOf(
      data.find((row) => /poison/i.test(localOf(row)?.local ?? '')),
    );
    if (!mind || !completed)
      throw new Error('Missing Standing Tall gated circumstances');
    expect(mind.local).toMatch(/1.minute/i);
    expect(completed.local).toMatch(/1.minute/i);
    expect(completed.local).toMatch(/complet/i);
    const sheetEntryId = entry('Standing Tall').externalKey;
    for (const target of ['save.fort', 'save.ref', 'save.will'] as const) {
      expect(resolveSheet(data)[target].total).toBe(0);
      expect(
        resolveSheet(data, { situations: ['mindAffecting', 'poison'] })[target]
          .total,
      ).toBe(0);
      for (const situation of [mind, completed])
        expect(
          resolveSheet(data, {
            situations: [{ ...situation, sheetEntryId }],
          })[target].total,
        ).toBe(2);
      expect(
        resolveSheet(data, {
          situations: [
            { ...mind, sheetEntryId },
            { ...completed, sheetEntryId },
          ],
        })[target].total,
      ).toBe(2);
    }
    const notes =
      importedCatalogEntrySchema.parse(entry('Standing Tall'))
        .situationalNotes ?? [];
    expect(notes.some((note) => note.situation === 'mindAffecting')).toBe(true);
    expect(notes.some((note) => note.situation === 'poison')).toBe(true);
  });

  it('stacks Vengeance completed-story saves +1 with its chosen-foe +1 while copies remain one Source', () => {
    const data = modifiers('Vengeance');
    const situations = data.flatMap((row) => {
      const situation = row.condition?.situation;
      return typeof situation === 'object' && 'local' in situation
        ? [{ ...situation, sheetEntryId: entry('Vengeance').externalKey }]
        : [];
    });
    const foe = situations.find((situation) =>
      /chosen foe|chosen enemy/i.test(situation.local),
    );
    const completion = situations.find((situation) =>
      /complet/i.test(situation.local),
    );
    if (!foe || !completion) throw new Error('Missing Vengeance circumstances');
    for (const target of ['save.fort', 'save.ref', 'save.will'] as const) {
      expect(resolveSheet(data)[target].total).toBe(0);
      expect(resolveSheet(data, { situations: [foe] })[target].total).toBe(1);
      expect(
        resolveSheet(data, { situations: [completion] })[target].total,
      ).toBe(1);
      expect(
        resolveSheet(data, { situations: [foe, completion] })[target].total,
      ).toBe(2);
      const copy = data.map((row) => ({
        ...row,
        sheetEntryId: 'vengeance-copy',
        catalogEntryId: 'vengeance-copy',
      }));
      expect(
        resolveSheet([...data, ...copy], {
          situations: [
            foe,
            completion,
            { ...foe, sheetEntryId: 'vengeance-copy' },
            { ...completion, sheetEntryId: 'vengeance-copy' },
          ],
        })[target].total,
      ).toBe(2);
    }
    const stacking = data.filter((row) => row.stacksWithinEntry);
    expect(stacking).toHaveLength(1);
    expect(stacking[0]).toMatchObject({ target: 'saves', value: 1 });
  });

  it('keeps summoned creature and undead companion statistics off the feat owner, with their rules as Notes', () => {
    for (const name of ['Fire Music', 'Skaveling Companion']) {
      expect(
        modifiers(name).some(
          (row) =>
            row.target.startsWith('ability.') ||
            row.target.startsWith('ac.') ||
            row.target === 'saves',
        ),
        name,
      ).toBe(false);
      expect((entry(name).situationalNotes ?? []).length, name).toBeGreaterThan(
        0,
      );
    }
  });

  it.each([
    { constitution: 12, survivalRanks: 0, met: [false, false] },
    { constitution: 12, survivalRanks: 1, met: [false, true] },
    { constitution: 13, survivalRanks: 0, met: [true, false] },
    { constitution: 13, survivalRanks: 1, met: [true, true] },
  ])(
    "checks Rugged Northerner prerequisites at Constitution $constitution and $survivalRanks Survival ranks, and Uncanny Ally's with no owning class for Uncanny Dodge",
    ({ constitution, survivalRanks, met }) => {
      const feat = importedCatalogEntrySchema.parse(entry('Rugged Northerner'));
      expect(feat.prerequisiteText).toBe('Con 13, Survival 1 rank');
      // New coverage for a context dependency (fix r3), asserted by no old
      // block: Uncanny Dodge is also a Rogue feature, so with Rogue imported
      // (a context key) Uncanny Ally's prerequisite names no owning class, as
      // the release emits it.
      expect(entry('Uncanny Ally').prerequisites).toEqual([
        { kind: 'feat', feat: 'pf1/Q1cY8r0Pvb66pMG0' },
        {
          kind: 'classFeature',
          classFeature: 'pf1/7WaQxnVaaoL4AGr8',
          classFeatureName: 'Uncanny Dodge',
        },
      ]);
      const input = prerequisiteSheet(
        [selectedFeat('rugged')],
        [
          {
            _id: 'rugged',
            name: feat.name,
            ruleIdentity: feat.externalKey,
            modifiers: [],
            detail: { kind: 'feat' },
            prerequisites: feat.prerequisites,
          },
        ],
      );
      const projections = calculateCharacterSheetProjections({
        ...input,
        entries: input.entries.map((row) =>
          row.kind === 'classLevel'
            ? {
                ...row,
                state: { ...row.state, skillRanks: { sur: survivalRanks } },
              }
            : row,
        ),
        catalogEntries: input.catalogEntries.map((row) =>
          row._id === 'base'
            ? {
                ...row,
                modifiers: row.modifiers.map((modifier) =>
                  modifier.target === 'ability.con'
                    ? { ...modifier, value: constitution }
                    : modifier,
                ),
              }
            : row,
        ),
      });
      for (const projection of Object.values(projections))
        for (const view of ['current', 'recorded'] as const)
          expect(
            projection.prerequisites
              .filter(
                (check) => check.entryId === 'rugged' && check.view === view,
              )
              .map((check) => check.met),
          ).toEqual(met);
    },
  );

  it('imports no Inspiring Talent allied ancestral-arms proficiency and grants none to the feat owner', () => {
    const feat = importedCatalogEntrySchema.parse(entry('Inspiring Talent'));
    expect(feat.description).toContain('within 30 feet of an ally');
    expect(feat.description).toContain('weapon proficiency');
    expect(feat.description).toContain('ancestral arms racial trait');
    expect(feat.proficiencies ?? []).toEqual([]);
    const base = featSheet('Solo Maneuvers', 'situation', { wisdom: 14 });
    const projections = calculateCharacterSheetProjections({
      ...base,
      catalogEntries: base.catalogEntries.map((row) =>
        row._id === 'feat'
          ? {
              _id: row._id,
              name: feat.name,
              ruleIdentity: feat.externalKey,
              modifiers: [],
              detail: { kind: 'feat' },
              proficiencies: feat.proficiencies,
            }
          : row,
      ),
    });
    for (const projection of Object.values(projections))
      expect(projection.proficiencies.grants).toEqual([]);
  });

  it('replaces Coordinated Maneuvers adjacent-ally +2 with escape-grapple +4 instead of adding the alternatives', () => {
    const data = modifiers('Coordinated Maneuvers');
    const situations = data.flatMap((row) => {
      const situation = row.condition?.situation;
      return row.target === 'cmb' &&
        typeof situation === 'object' &&
        'local' in situation
        ? [
            {
              ...situation,
              sheetEntryId: entry('Coordinated Maneuvers').externalKey,
              value: row.value,
            },
          ]
        : [];
    });
    const ordinary = situations.find(
      (row) => row.value === 2 && !/stamina/i.test(row.local),
    );
    const escape = situations.find((row) => row.value === 4);
    if (!ordinary || !escape)
      throw new Error('Missing coordinated maneuver alternatives');
    for (const situation of [ordinary, escape]) {
      expect(situation.local).toMatch(/adjacent.*ally/i);
      expect(situation.local).toMatch(
        /same feat|also has.*feat|also has Coordinated Maneuvers/i,
      );
    }
    expect(escape.local).toMatch(/break.*grapple|escap.*grapple/i);
    expect(resolveSheet(data).cmb.total).toBe(0);
    expect(resolveSheet(data, { situations: [ordinary] }).cmb.total).toBe(2);
    expect(resolveSheet(data, { situations: [escape] }).cmb.total).toBe(4);
    expect(
      resolveSheet(data, { situations: [ordinary, escape] }).cmb.total,
    ).toBe(4);
    expect(resolveSheet(data, { situations: ['grapple'] }).cmb.total).toBe(0);
    const stamina = situations.find((row) => /1 stamina/i.test(row.local));
    if (!stamina) throw new Error('Missing paid stamina addition');
    expect(
      resolveSheet(data, { situations: [ordinary, stamina] }).cmb.total,
    ).toBe(4);
    expect(
      resolveSheet(data, { situations: [escape, stamina] }).cmb.total,
    ).toBe(6);
    expect(
      resolveSheet(data, { situations: [ordinary, escape, stamina] }).cmb.total,
    ).toBe(6);
  });

  it.each([
    { constitution: 8, bonus: 0 },
    { constitution: 10, bonus: 0 },
    { constitution: 12, bonus: 1 },
    { constitution: 18, bonus: 4 },
  ])(
    'uses Constitution bonus $bonus for Raging Throw at Constitution $constitution only for its paid raging bull rush',
    ({ constitution, bonus }) => {
      const data = modifiers('Raging Throw');
      const paid = localSituation('Raging Throw', 'cmb');
      expect(paid.local).toMatch(/rag/i);
      expect(paid.local).toMatch(/bull rush/i);
      expect(paid.local).toMatch(/spend|paid|additional round/i);
      const constitutionBase: InputSourcedModifier = {
        target: 'ability.con',
        bonusType: 'base',
        value: constitution,
        sheetEntryId: 'constitution-base',
        catalogEntryId: 'constitution-base',
        entryName: 'Base Constitution',
        source: 'constitution-base',
        builtIn: true,
      };
      expect(resolveSheet([...data, constitutionBase]).cmb.total).toBe(0);
      expect(
        resolveSheet([...data, constitutionBase], { situations: ['bullRush'] })
          .cmb.total,
      ).toBe(0);
      expect(
        resolveSheet([...data, constitutionBase], { situations: [paid] }).cmb
          .total,
      ).toBe(bonus);
    },
  );

  it.each([
    { bab: 6, bonus: 4 },
    { bab: 10, bonus: 4 },
    { bab: 11, bonus: 5 },
    { bab: 15, bonus: 5 },
    { bab: 16, bonus: 6 },
    { bab: 19, bonus: 6 },
    { bab: 20, bonus: 7 },
  ])(
    'scales Death or Glory attack and damage +$bonus at BAB $bab, keeping confirmation in a Note',
    ({ bab, bonus }) => {
      const data = modifiers('Death or Glory');
      const attack = localSituation('Death or Glory', 'attack.melee');
      const damage = localSituation('Death or Glory', 'damage.melee');
      expect(attack.local).toMatch(/Large/i);
      expect(attack.local).toMatch(/Death or Glory/i);
      const baseBab: InputSourcedModifier = {
        target: 'bab',
        bonusType: 'base',
        value: bab,
        sheetEntryId: 'bab-base',
        catalogEntryId: 'bab-base',
        entryName: 'Base attack bonus',
        source: 'bab-base',
        builtIn: true,
      };
      for (const target of ['attack.melee', 'damage.melee'] as const) {
        expect(resolveSheet([...data, baseBab])[target].total).toBe(0);
        expect(
          resolveSheet([...data, baseBab], { situations: [attack, damage] })[
            target
          ].total,
        ).toBe(bonus);
      }
      expect(
        resolveSheet([...data, baseBab], { situations: [attack, damage] })[
          'attack.ranged'
        ].total,
      ).toBe(0);
      expect(
        (entry('Death or Glory').situationalNotes ?? [])
          .map((row) => row.text)
          .join(' '),
      ).toMatch(/critical confirmation/i);
    },
  );

  it('adds Hunter of Dahak +2 to every inherited favored-enemy check and weapon roll only against metallic dragons', () => {
    const data = modifiers('Hunter of Dahak');
    expect(data.map((row) => row.target).sort()).toEqual(
      [
        'attack',
        'damage',
        'skill.blf',
        'skill.kar',
        'skill.kdu',
        'skill.ken',
        'skill.kge',
        'skill.khi',
        'skill.klo',
        'skill.kna',
        'skill.kno',
        'skill.kpl',
        'skill.kre',
        'skill.per',
        'skill.sen',
        'skill.sur',
      ].sort(),
    );
    const skill = localSituation('Hunter of Dahak', 'skill.per');
    const weapon = localSituation('Hunter of Dahak', 'attack');
    expect(skill.local).toMatch(/metallic dragons/i);
    expect(skill.local).toMatch(/favored enemy.*applies/i);
    expect(weapon.local).toMatch(/weapon/i);
    for (const target of [
      'skill.blf',
      'skill.kar',
      'skill.kdu',
      'skill.ken',
      'skill.kge',
      'skill.khi',
      'skill.klo',
      'skill.kna',
      'skill.kno',
      'skill.kpl',
      'skill.kre',
      'skill.per',
      'skill.sen',
      'skill.sur',
    ] as const) {
      expect(resolveSheet(data)[target].total).toBe(0);
      expect(resolveSheet(data, { situations: [skill] })[target].total).toBe(2);
    }
    for (const target of [
      'attack.melee',
      'attack.ranged',
      'damage.melee',
      'damage.ranged',
    ] as const) {
      expect(resolveSheet(data)[target].total).toBe(0);
      expect(resolveSheet(data, { situations: [skill] })[target].total).toBe(0);
      expect(resolveSheet(data, { situations: [weapon] })[target].total).toBe(
        2,
      );
    }
    expect(resolveSheet(data, { situations: [skill, weapon] }).cmb.total).toBe(
      0,
    );
    const ordinaryFavoredEnemy: InputSourcedModifier = {
      target: 'skill.per',
      bonusType: 'untyped',
      value: 2,
      sheetEntryId: 'favored-enemy-row',
      catalogEntryId: 'pf1/XmALhWqXdN9yOmtd',
      entryName: 'Favored Enemy source example',
      source: 'pf1/XmALhWqXdN9yOmtd',
      builtIn: false,
    };
    expect(
      resolveSheet([ordinaryFavoredEnemy, ...data], { situations: [skill] })[
        'skill.per'
      ].total,
    ).toBe(4);
  });

  // Carried from the batch unit's ticket-key proof (feats-339.test.ts:159),
  // which required every candidate's repeatability to stay unreviewed: here
  // for every feat of the batch preview, all of which this file imports.
  it('imports every feat of the batch preview with its repeatability unreviewed', () => {
    const feats = everyEntry('feats-339');
    expect(feats).toHaveLength(100);
    for (const row of feats)
      expect(
        row.detail.kind === 'feat' && row.detail.repeatable,
        row.name,
      ).toBe('unreviewed');
  });
});

describe('the feats-340 keys', () => {
  const { entry, modifiers, localSituation, featSheet } = featBatch(
    entries,
    'feats-340',
  );

  // #724: the rank threshold is automatic, read from the skill's recorded ranks.
  it('gives Skill Focus (Knowledge [Local]) +3, or +6 at 10 ranks, without a Situation or a stacking same-Source copy', () => {
    const data = modifiers('Skill Focus (Knowledge [Local])');
    expectAutomaticSkillFocus({ modifiers: data, target: 'skill.klo' });
  });

  it('limits Horse Whisperer +2 to handling and riding horses', () => {
    const data = modifiers('Horse Whisperer');
    for (const target of ['skill.han', 'skill.rid'] as const) {
      const horses = localSituation('Horse Whisperer', target);
      expect(horses.local).toMatch(/horses/i);
      expect(resolveSheet(data)[target].total).toBe(0);
      expect(resolveSheet(data, { situations: [horses] })[target].total).toBe(
        2,
      );
      expect(
        resolveSheet(data, { situations: ['charging'] })[target].total,
      ).toBe(0);
      expect(
        resolveSheet(data, {
          situations: [{ ...horses, sheetEntryId: 'other' }],
        })[target].total,
      ).toBe(0);
    }
  });

  it('adds Bear Hug damage +2 only against the grappled foe', () => {
    const data = modifiers('Bear Hug');
    const grapple = localSituation('Bear Hug', 'damage');
    expect(grapple.local).toMatch(/grappl/i);
    expect(resolveSheet(data)['damage.melee'].total).toBe(0);
    expect(
      resolveSheet(data, { situations: [grapple] })['damage.melee'].total,
    ).toBe(2);
    expect(
      resolveSheet(data, { situations: ['grappled'] })['damage.melee'].total,
    ).toBe(0);
    expect(
      resolveSheet(data, {
        situations: [{ ...grapple, sheetEntryId: 'other' }],
      })['damage.melee'].total,
    ).toBe(0);
  });

  it('keeps Ironguts saves restricted to nausea, sickening and ingested poison and foraging to self', () => {
    const data = modifiers('Ironguts');
    const save = localSituation('Ironguts', 'saves');
    const food = localSituation('Ironguts', 'skill.sur');
    expect(save.local).toMatch(/ingest/i);
    expect(save.local).toMatch(/nauseat|sicken/i);
    expect(food.local).toMatch(/yourself|self|alone|only/i);
    for (const target of ['save.fort', 'save.ref', 'save.will'] as const) {
      expect(resolveSheet(data)[target].total).toBe(0);
      expect(resolveSheet(data, { situations: [save] })[target].total).toBe(2);
      expect(
        resolveSheet(data, { situations: ['poison', 'disease'] })[target].total,
      ).toBe(0);
    }
    expect(resolveSheet(data)['skill.sur'].total).toBe(0);
    expect(resolveSheet(data, { situations: [food] })['skill.sur'].total).toBe(
      2,
    );
  });

  // The old test compared each total with the ordinary bonus plus 2: the
  // ordinary +2 and +4 and the totals 4 and 6 are literals here.
  it('adds the Mythic Alertness +2 increment to ordinary Alertness +2 or +4', () => {
    const data = modifiers('Alertness (Mythic)');
    for (const [ordinaryBonus, total] of [
      [2, 4],
      [4, 6],
    ] as const) {
      const ordinary: InputSourcedModifier[] = (
        ['skill.per', 'skill.sen'] as const
      ).map((target) => ({
        target,
        value: ordinaryBonus,
        bonusType: 'untyped',
        sheetEntryId: 'ordinary-alertness',
        catalogEntryId: 'pf1/Q1cY8r0Pvb66pMG0',
        source: 'pf1/Q1cY8r0Pvb66pMG0',
        entryName: 'Alertness',
        builtIn: false,
      }));
      const result = resolveSheet([...ordinary, ...data]);
      expect(result['skill.per'].total).toBe(total);
      expect(result['skill.sen'].total).toBe(total);
    }
  });

  it('agrees with the public sheet projection for reviewed Knowledge Local and isolated horse Situations', () => {
    // #724: no Situation; with no ranks and Intelligence 10, Skill Focus's +3.
    const focus = featSheet('Skill Focus (Knowledge [Local])', 'situation', {
      wisdom: 14,
    });
    expect(
      calculateCharacterSheetProjections(focus).current.breakdowns['skill.klo']
        .total,
    ).toBe(3);
    const horse = featSheet('Horse Whisperer', 'situation', { wisdom: 14 });
    const circumstance = localSituation('Horse Whisperer', 'skill.han');
    expect(
      calculateCharacterSheetProjections(horse).current.breakdowns['skill.han']
        .total,
    ).toBe(0);
    expect(
      calculateCharacterSheetProjections(horse, {
        situations: [{ local: circumstance.local, sheetEntryId: 'feat-row' }],
      }).current.breakdowns['skill.han'].total,
    ).toBe(2);
  });

  it('increases ordinary Dodge +1 to +2 and adds the +10 expenditure only against its selected attack', () => {
    const data = modifiers('Dodge (Mythic)');
    const attack = localSituation('Dodge (Mythic)', 'ac');
    expect(attack.local).toMatch(/one attack/i);
    expect(attack.local).toMatch(/mythic power/i);
    const ordinary: InputSourcedModifier = {
      target: 'ac',
      bonusType: 'dodge',
      value: 1,
      sheetEntryId: 'ordinary-dodge',
      catalogEntryId: 'pf1/JreaiTHdyWFNj3Tb',
      source: 'pf1/JreaiTHdyWFNj3Tb',
      entryName: 'Dodge',
      builtIn: false,
    };
    expect(resolveSheet([ordinary, ...data])['ac.other'].total).toBe(2);
    expect(
      resolveSheet([ordinary, ...data], { situations: [attack] })['ac.other']
        .total,
    ).toBe(12);
    expect(
      resolveSheet([ordinary, ...data], { situations: ['charging'] })[
        'ac.other'
      ].total,
    ).toBe(2);
    expect(
      resolveSheet([ordinary, ...data], {
        situations: [{ ...attack, sheetEntryId: 'other' }],
      })['ac.other'].total,
    ).toBe(2);
  });

  it('uses registered shared Situations on every entry of the batch preview and keeps narrower compound circumstances local', () => {
    const registered = new Set(curation.situations.map((row) => row.key));
    const feats = everyEntry('feats-340');
    expect(feats).toHaveLength(100);
    for (const { name, situation } of sharedSituations(feats))
      expect(registered.has(situation), name).toBe(true);
    expect(localSituation('Ironguts', 'saves').local).toMatch(
      /ingested poisons/i,
    );
    expect(localSituation('Horse Whisperer', 'skill.han').local).toMatch(
      /horses/i,
    );
  });

  it('uses Snapping Turtle Style shield +1 or stamina +2 without adding the alternatives', () => {
    const data = modifiers('Snapping Turtle Style');
    const scopes = data
      .filter((row) => row.target === 'ac.shield')
      .map((row) => {
        const situation = row.condition?.situation;
        if (typeof situation !== 'object' || !('local' in situation))
          throw new Error('Missing Snapping Turtle stance Situation');
        expect(situation.local).toMatch(/at least one hand free/i);
        return {
          ...situation,
          sheetEntryId: entry('Snapping Turtle Style').externalKey,
        };
      });
    expect(scopes).toHaveLength(2);
    const stamina = scopes.find((scope) => /stamina/i.test(scope.local));
    const ordinary = scopes.find((scope) => !/stamina/i.test(scope.local));
    if (!stamina || !ordinary) throw new Error('Missing shield alternatives');
    expect(resolveSheet(data)['ac.shield'].total).toBe(0);
    expect(
      resolveSheet(data, { situations: [ordinary] })['ac.shield'].total,
    ).toBe(1);
    expect(
      resolveSheet(data, { situations: [stamina] })['ac.shield'].total,
    ).toBe(2);
    expect(resolveSheet(data, { situations: scopes })['ac.shield'].total).toBe(
      2,
    );
    expect(
      resolveSheet(data, { situations: ['charging'] })['ac.shield'].total,
    ).toBe(0);
  });

  // The ordinary Aspect of the Beast record is read from the store by key
  // (pinnedRecordFile): the same bytes the batch's supporting copy holds.
  it('uses Mythic Leap +5 or +10 with ordinary Predator Leap and never adds a fabricated base bonus', async () => {
    const raw = await readFile(
      `${pinnedStore}/${await pinnedRecordFile('pf1/dPLj98GIzbwcoOjn')}`,
      'utf8',
    );
    expect(sha256(raw)).toBe(
      '2af33693525db20aa1def7be923644d1d2a44c2dc09f6e0238ad84be670c858b',
    );
    const description = sourceDescription(upstreamRecord.parse(parse(raw)));
    expect(description).toMatch(/Predator's.*Leap/);
    expect(description).toContain(
      'You can make a running jump without needing to run 10 feet before you jump.',
    );
    expect(description).not.toMatch(/\+4/);
    const data = modifiers('Aspect of the Beast (Mythic)');
    const leaps = data.filter((row) => row.target === 'skill.acr');
    expect(leaps.map((row) => row.value)).toEqual([5, 10]);
    const scopes = leaps.map((row) => {
      const situation = row.condition?.situation;
      if (typeof situation !== 'object' || !('local' in situation))
        throw new Error('Missing Mythic Leap Situation');
      return {
        ...situation,
        sheetEntryId: entry('Aspect of the Beast (Mythic)').externalKey,
      };
    });
    const [ordinary, predator] = scopes;
    if (!ordinary || !predator) throw new Error('Missing leap alternatives');
    expect(resolveSheet(data)['skill.acr'].total).toBe(0);
    expect(
      resolveSheet(data, { situations: [ordinary] })['skill.acr'].total,
    ).toBe(5);
    expect(
      resolveSheet(data, { situations: [predator] })['skill.acr'].total,
    ).toBe(10);
    expect(resolveSheet(data, { situations: scopes })['skill.acr'].total).toBe(
      10,
    );
  });

  // Carried from the batch unit's ticket-key proof (feats-340.test.ts:146),
  // which required every candidate's repeatability to stay unreviewed: here
  // for every feat of the batch preview, all of which this file imports.
  it('imports every feat of the batch preview with its repeatability unreviewed', () => {
    const feats = everyEntry('feats-340');
    expect(feats).toHaveLength(100);
    for (const row of feats)
      expect(
        row.detail.kind === 'feat' && row.detail.repeatable,
        row.name,
      ).toBe('unreviewed');
  });
});

describe('the feats-341 keys', () => {
  const { entry, modifiers, localSituation, featSheet } = featBatch(
    entries,
    'feats-341',
  );

  it('preserves supported prerequisite facts and leaves unsupported feature requirements readable', () => {
    expect(entry('Acupuncture Specialist').prerequisites).toContainEqual({
      kind: 'skillRanks',
      skillRanks: 'skill.hea',
      min: 5,
    });
    expect(entry('Body Control').prerequisites).toContainEqual({
      kind: 'ability',
      ability: 'wisdom',
      min: 11,
    });
    expect(entry('Careful Speaker').prerequisites).toContainEqual({
      kind: 'ability',
      ability: 'wisdom',
      min: 13,
    });
    expect(entry('Spider Climber').prerequisites).toContainEqual({
      kind: 'characterLevel',
      characterLevel: 3,
    });
    expect(entry('Forester').prerequisiteText).toMatch(
      /favored terrain.*forest/i,
    );
  });

  // The old test compared each total with the ordinary bonus plus 2: the
  // ordinary +2 and +4 and the totals 4 and 6 are literals here.
  it('adds only the Mythic Stealthy +2 increment to ordinary +2/+4 bonuses and suppresses same-Source copies', () => {
    const data = modifiers('Stealthy (Mythic)');
    for (const [ordinaryBonus, total] of [
      [2, 4],
      [4, 6],
    ] as const) {
      const ordinary: InputSourcedModifier[] = (
        ['skill.esc', 'skill.ste'] as const
      ).map((target) => ({
        target,
        value: ordinaryBonus,
        bonusType: 'untyped',
        sheetEntryId: 'ordinary-stealthy',
        catalogEntryId: 'pf1/f5FPqAYWlKj3zCIY',
        source: 'pf1/f5FPqAYWlKj3zCIY',
        entryName: 'Stealthy',
        builtIn: false,
      }));
      const copy = data.map((row) => ({
        ...row,
        sheetEntryId: 'copied-stealth',
        catalogEntryId: 'copied-stealth',
      }));
      for (const target of ['skill.esc', 'skill.ste'] as const) {
        expect(resolveSheet(data)[target].total).toBe(2);
        expect(resolveSheet([...ordinary, ...data])[target].total).toBe(total);
        expect(
          resolveSheet([...ordinary, ...data, ...copy])[target].total,
        ).toBe(total);
      }
    }
  });

  it('limits Crane Style +1 dodge AC to its style and defensive circumstance', () => {
    const data = modifiers('Crane Style');
    const defensive = localSituation('Crane Style', 'ac.other');
    expect(defensive.local).toMatch(/Crane Style/i);
    expect(defensive.local).toMatch(/fighting defensively.*total defense/i);
    expect(resolveSheet(data)['ac.other'].total).toBe(0);
    expect(
      resolveSheet(data, { situations: [defensive] })['ac.other'].total,
    ).toBe(1);
    expect(
      resolveSheet(data, { situations: ['fighting-defensively'] })['ac.other']
        .total,
    ).toBe(0);
    expect(
      resolveSheet(data, {
        situations: [{ ...defensive, sheetEntryId: 'other' }],
      })['ac.other'].total,
    ).toBe(0);
  });

  it('limits Spider Climber +4 saves to web effects', () => {
    const data = modifiers('Spider Climber');
    const webs = localSituation('Spider Climber', 'saves');
    expect(webs.local).toMatch(/web/i);
    for (const target of ['save.fort', 'save.ref', 'save.will'] as const) {
      expect(resolveSheet(data)[target].total).toBe(0);
      expect(resolveSheet(data, { situations: [webs] })[target].total).toBe(4);
      expect(resolveSheet(data, { situations: ['poison'] })[target].total).toBe(
        0,
      );
      expect(
        resolveSheet(data, {
          situations: [{ ...webs, sheetEntryId: 'other' }],
        })[target].total,
      ).toBe(0);
    }
  });

  it('adds Champion of Tyranny +2 against chaotic or good foes and +4 against chaotic good', () => {
    const data = modifiers('Champion of Tyranny');
    expect(resolveSheet(data)['damage.melee'].total).toBe(0);
    expect(
      resolveSheet(data, { situations: ['chaoticCreatures'] })['damage.melee']
        .total,
    ).toBe(2);
    expect(
      resolveSheet(data, { situations: ['goodCreatures'] })['damage.melee']
        .total,
    ).toBe(2);
    expect(
      resolveSheet(data, {
        situations: ['chaoticCreatures', 'goodCreatures'],
      })['damage.melee'].total,
    ).toBe(4);
    const copy = data.map((row) => ({
      ...row,
      sheetEntryId: 'copied-champion',
      catalogEntryId: 'copied-champion',
    }));
    expect(
      resolveSheet([...data, ...copy], {
        situations: ['chaoticCreatures', 'goodCreatures'],
      })['damage.melee'].total,
    ).toBe(4);
  });

  it('limits Body Control saves to meditation and the listed harms without overlapping bonuses', () => {
    const data = modifiers('Body Control');
    const situations = data.map((row) => row.condition?.situation);
    expect(situations.length).toBeGreaterThan(0);
    const local = situations.map((situation) => {
      if (typeof situation !== 'object' || !('local' in situation))
        throw new Error('Missing meditation-qualified Body Control Situation');
      expect(situation.local).toMatch(/meditat/i);
      return { ...situation, sheetEntryId: entry('Body Control').externalKey };
    });
    expect(resolveSheet(data)['save.fort'].total).toBe(0);
    for (const situation of local)
      expect(
        resolveSheet(data, { situations: [situation] })['save.fort'].total,
      ).toBe(1);
    expect(resolveSheet(data, { situations: local })['save.fort'].total).toBe(
      1,
    );
    expect(
      resolveSheet(data, { situations: ['poison', 'disease'] })['save.fort']
        .total,
    ).toBe(0);
    expect(
      resolveSheet(data, {
        situations: local.map((situation) => ({
          ...situation,
          sheetEntryId: 'other',
        })),
      })['save.fort'].total,
    ).toBe(0);
  });

  it('limits Forester +1 Reflex to adjacency to at least two trees', () => {
    const data = modifiers('Forester');
    const trees = localSituation('Forester', 'save.ref');
    expect(trees.local).toMatch(/two|2/i);
    expect(resolveSheet(data)['save.ref'].total).toBe(0);
    expect(resolveSheet(data, { situations: [trees] })['save.ref'].total).toBe(
      1,
    );
    expect(
      resolveSheet(data, { situations: ['cover'] })['save.ref'].total,
    ).toBe(0);
    expect(
      resolveSheet(data, {
        situations: [{ ...trees, sheetEntryId: 'other' }],
      })['save.ref'].total,
    ).toBe(0);
  });

  it('keeps the unsupported cover and spell-resistance calculations readable in the descriptions, with no Forester cover Modifier', () => {
    expect(entry('Forester').description).toMatch(/\+1 cover.*\+2 cover/i);
    expect(entry('Focused Disbelief').description).toMatch(
      /11 \+ your character level/i,
    );
    expect(
      modifiers('Forester').filter((row) => row.target === 'ac.other'),
    ).toEqual([]);
  });

  it('agrees with public sheet projections for the real reviewed bodies', () => {
    const stealth = calculateCharacterSheetProjections(
      featSheet('Stealthy (Mythic)', 'situation', { wisdom: 14 }),
    );
    expect(stealth.current.breakdowns['skill.esc'].total).toBe(2);
    expect(stealth.current.breakdowns['skill.ste'].total).toBe(2);
    const crane = featSheet('Crane Style', 'situation', { wisdom: 14 });
    const defensive = localSituation('Crane Style', 'ac.other');
    expect(
      calculateCharacterSheetProjections(crane).current.breakdowns['ac.other']
        .total,
    ).toBe(0);
    expect(
      calculateCharacterSheetProjections(crane, {
        situations: [{ ...defensive, sheetEntryId: 'feat-row' }],
      }).current.breakdowns['ac.other'].total,
    ).toBe(1);
  });
});

describe('the feats-342 keys', () => {
  const { entry, modifiers, valueSituation, featSheet } = featBatch(
    entries,
    'feats-342',
  );

  // #724: the rank threshold is automatic, read from the skill's recorded ranks.
  it.each([
    ['Skill Focus (Handle Animal)', 'skill.han'],
    ['Skill Focus (Disable Device)', 'skill.dev'],
  ] as const)(
    'gives %s +3, or +6 at 10 ranks, without a Situation or a stacking same-Source copy',
    (name, target) => {
      expectAutomaticSkillFocus({ modifiers: modifiers(name), target });
    },
  );

  it('uses shared trip and complete local hanging Situations for Tree Hanger CMD', () => {
    const data = modifiers('Tree Hanger');
    expect(resolveSheet(data).cmd.total).toBe(0);
    expect(resolveSheet(data, { situations: ['trip'] }).cmd.total).toBe(2);
    expect(
      resolveSheet(data, { situations: ['bullRush', 'drag', 'reposition'] }).cmd
        .total,
    ).toBe(0);
    for (const row of data.filter(
      (row) => typeof row.condition?.situation === 'object',
    )) {
      const local = row.condition?.situation;
      if (!local || typeof local !== 'object' || !('local' in local))
        throw new Error('Missing hanging Situation');
      expect(local.local).toMatch(/hanging by the tail/);
      expect(
        resolveSheet(data, {
          situations: [
            { ...local, sheetEntryId: entry('Tree Hanger').externalKey },
          ],
        }).cmd.total,
      ).toBe(2);
    }
  });

  it('pins Snake Style ordinary Sense Motive and Jackal Heritage mind-affecting saves', () => {
    expect(resolveSheet(modifiers('Snake Style'))['skill.sen'].total).toBe(2);
    const jackal = modifiers('Jackal Heritage');
    expect(resolveSheet(jackal)['skill.per'].total).toBe(2);
    expect(resolveSheet(jackal)['save.will'].total).toBe(0);
    for (const target of ['save.fort', 'save.ref', 'save.will'] as const)
      expect(
        resolveSheet(jackal, { situations: ['mindAffecting'] })[target].total,
      ).toBe(2);
  });

  // The old test compared each pistol-whip CMB total with its own Modifier's
  // value: the raw values, in the entry's order, and the totals are literals.
  it('limits Crane Wing to its full defense circumstance and Stock-Striker to its prone maneuver', () => {
    const crane = modifiers('Crane Wing');
    const defensive = valueSituation('Crane Wing', 4);
    expect(defensive.local).toMatch(/aware.*not flat-footed/);
    expect(defensive.local).toMatch(/beginning of your next turn/);
    expect(resolveSheet(crane)['ac.other'].total).toBe(0);
    expect(
      resolveSheet(crane, { situations: [defensive] })['ac.other'].total,
    ).toBe(4);
    expect(
      resolveSheet(crane, { situations: ['fighting-defensively'] })['ac.other']
        .total,
    ).toBe(0);
    const stock = modifiers('Stock-Striker Style');
    const pistolWhips = stock.filter((row) => row.target === 'cmb');
    expect(pistolWhips.map((row) => row.value)).toEqual([1, 2]);
    for (const [index, row] of pistolWhips.entries()) {
      const local = row.condition?.situation;
      if (typeof local !== 'object' || !('local' in local))
        throw new Error('Missing pistol-whip Situation');
      expect(local.local).toMatch(/knock the target prone/);
      expect(resolveSheet(stock).cmb.total).toBe(0);
      expect(
        resolveSheet(stock, {
          situations: [
            {
              ...local,
              sheetEntryId: entry('Stock-Striker Style').externalKey,
            },
          ],
        }).cmb.total,
      ).toBe([1, 2][index]);
    }
  });

  // The old test computed each expected total from the rule's schedule; the
  // schedules are literals here, by BAB 0 to 20 and by level 1 to 20.
  it('calculates the reviewed BAB and level schedules only in their complete Situations', () => {
    for (const [name, target, schedule] of [
      [
        'Cunning Killer',
        'damage.melee',
        [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4],
      ],
      [
        'Intense Blows',
        'cmd',
        [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6],
      ],
    ] as const) {
      const data = modifiers(name);
      const local = localOf(data[0]);
      if (!local) throw new Error('Missing complete Situation');
      for (let bab = 0; bab <= 20; bab++) {
        const baseline = builtIn({
          target: 'bab',
          id: 'bab',
          name: 'BAB',
          value: bab,
        });
        const rows = [...data, baseline];
        expect(resolveSheet(rows)[target].total).toBe(0);
        expect(
          resolveSheet(rows, {
            situations: [{ ...local, sheetEntryId: entry(name).externalKey }],
          })[target].total,
        ).toBe(schedule[bab]);
      }
    }
    const data = modifiers('Strength in Defeat');
    const local = localOf(data[0]);
    if (!local) throw new Error('Missing HP Situation');
    const schedule = [
      1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3,
    ];
    for (let level = 1; level <= 20; level++) {
      expect(resolveSheet(data, { level })['attack.melee'].total).toBe(0);
      expect(
        resolveSheet(data, {
          level,
          situations: [
            { ...local, sheetEntryId: entry('Strength in Defeat').externalKey },
          ],
        })['attack.melee'].total,
      ).toBe(schedule[level - 1]);
    }
  });

  it('imports no Bag of Bones Modifier for its contradictory grant and Ability Mastery its raw enhancement +2', () => {
    expect(entry('Bag of Bones').modifiers).toEqual([]);
    expect(entry('Ability Mastery').modifiers).toContainEqual(
      expect.objectContaining({
        target: 'ability.str',
        value: 2,
        bonusType: 'enhancement',
      }),
    );
  });

  it('preserves supported prerequisite thresholds', () => {
    expect(entry('Confusing Stare').prerequisites).toContainEqual({
      kind: 'classLevel',
      classLevel: 'pf1/fLU25FvuRWMCSxPP',
      min: 7,
    });
    expect(entry('Cartogramancer').prerequisites).toContainEqual({
      kind: 'skillRanks',
      skillRanks: 'skill.kge',
      min: 10,
    });
    expect(entry('Shatterspell').prerequisites).toContainEqual({
      kind: 'classLevel',
      classLevel: 'pf1/WLqBCT5DqmGAx8Wd',
      min: 10,
    });
    expect(entry('Redistributed Might').prerequisites).toContainEqual({
      kind: 'proficiency',
      proficiency: { baseType: 'Aldori dueling sword' },
    });
  });

  it('feeds real reviewed bodies through the public current/permanent sheet resolver', () => {
    const projections = calculateCharacterSheetProjections(
      featSheet('Skill Focus (Handle Animal)', 'situation', { wisdom: 14 }),
    );
    // #724: no ranks and Charisma 10, so Skill Focus's +3 applies at once.
    expect(projections.current.breakdowns['skill.han'].total).toBe(3);
    expect(projections.permanent.breakdowns['skill.han'].total).toBe(3);
    expect(projections.current.breakdowns['skill.han'].conditional).toEqual([]);
  });
});

describe('the feats-343 keys', () => {
  const { entry, modifiers, valueSituation, featSheet } = featBatch(
    entries,
    'feats-343',
  );

  it('gives Skill Focus (Knowledge [Nobility]) +3, or +6 at 10 ranks, without a Situation or a stacking same-Source copy', () => {
    const data = modifiers('Skill Focus (Knowledge [Nobility])');
    expectAutomaticSkillFocus({ modifiers: data, target: 'skill.kno' });
  });

  it('imports no Modifier for Steel Soul’s +4 replacement', () => {
    expect(entry('Steel Soul').modifiers).toEqual([]);
  });

  it('calculates Dragonfly Style Wisdom on Acrobatics through the public sheet boundary', () => {
    const input = featSheet('Dragonfly Style', 'situation', { wisdom: 14 });
    const result = calculateCharacterSheetProjections(input);
    expect(result.current.breakdowns['skill.acr'].total).toBe(2);
    expect(result.permanent.breakdowns['skill.acr'].total).toBe(2);
    expect(result.current.breakdowns['attack.melee'].total).toBe(0);
    const local = valueSituation('Dragonfly Style', 1);
    expect(
      resolveSheet(modifiers('Dragonfly Style'), { situations: [local] })[
        'attack.melee'
      ].total,
    ).toBe(1);
  });

  it('keeps rank and giant-type scopes manual while shared giant dodge AC remains exact', () => {
    for (const [name, target] of [
      ['Truth-Seeker', 'skill.khi'],
      ['Forward from Beneath', 'skill.dis'],
      ['Embrace of the Dark Fey', 'skill.int'],
    ] as const) {
      const rows = modifiers(name);
      expect(resolveSheet(rows)[target].total).toBe(0);
      expect(
        resolveSheet(rows, { situations: [valueSituation(name, 2)] })[target]
          .total,
      ).toBe(2);
      expect(
        resolveSheet(rows, { situations: [valueSituation(name, 4)] })[target]
          .total,
      ).toBe(4);
    }
    expect(
      resolveSheet(modifiers('Giant Vendetta'), { situations: ['giants'] })[
        'ac.other'
      ].total,
    ).toBe(1);
    expect(
      resolveSheet(modifiers('Giant Vendetta'), { situations: ['giants'] }).init
        .total,
    ).toBe(0);
    expect(
      resolveSheet(modifiers('Harrowed'), { situations: ['enchantment'] })[
        'save.will'
      ].total,
    ).toBe(1);
    expect(
      resolveSheet(modifiers('Harrowed'), { situations: ['fear'] })['save.will']
        .total,
    ).toBe(0);
  });

  it('keeps replacement end values and unmodeled dice out of additive modifiers', () => {
    for (const name of [
      'Prone Shooter',
      "Musketeer's Dodge",
      'Kobold Confidence',
      'Assured Destruction',
      'Wilding Stride',
      "Serren's Masterstroke",
      'Poppet Familiar',
    ])
      expect(entry(name).modifiers).toEqual([]);
    expect(entry('Prone Shooter').situationalNotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.stringContaining('reduced to -2'),
        }),
      ]),
    );
    expect(entry("Serren's Masterstroke").situationalNotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: expect.stringContaining('+4d6') }),
      ]),
    );
  });

  it('records supported prerequisite facts, and no reviewed repeatability on every entry of the batch preview', () => {
    expect(entry('Prone Shooter').prerequisites).toContainEqual({
      kind: 'bab',
      bab: 1,
    });
    expect(entry('Pinpoint Jab').prerequisites).toContainEqual({
      kind: 'bab',
      bab: 6,
    });
    const feats = everyEntry('feats-343');
    expect(feats).toHaveLength(100);
    for (const row of feats) {
      expect(row.detail.kind === 'feat' && row.detail.repeatable).toBe(
        'unreviewed',
      );
    }
  });
});

describe('the feats-344 keys', () => {
  const { entry, modifiers, indexSituation, featSheet } = featBatch(
    entries,
    'feats-344',
  );

  it('calculates exact scoped AC, disguise and attack values without same-Source duplication', () => {
    const name = 'Defended Movement',
      rows = modifiers(name),
      low = indexSituation(name),
      high = indexSituation(name, 1);
    expect(resolveSheet(rows)['ac.other'].total).toBe(0);
    expect(resolveSheet(rows, { situations: [low] })['ac.other'].total).toBe(2);
    expect(
      resolveSheet(rows, { situations: [low, high] })['ac.other'].total,
    ).toBe(4);
    expect(
      resolveSheet(
        [
          ...rows,
          ...rows.map((row) => ({
            ...row,
            sheetEntryId: 'copy',
            catalogEntryId: 'copy',
          })),
        ],
        { situations: [high, { ...high, sheetEntryId: 'copy' }] },
      )['ac.other'].total,
    ).toBe(4);
    expect(
      resolveSheet(rows, { situations: [{ ...low, sheetEntryId: 'other' }] })[
        'ac.other'
      ].total,
    ).toBe(0);
    expect(
      resolveSheet(modifiers('Pass For Human'), {
        situations: [indexSituation('Pass For Human')],
      })['skill.dis'].total,
    ).toBe(10);
    const thrown = resolveSheet(modifiers('Throw Anything (Mythic)'), {
      situations: [indexSituation('Throw Anything (Mythic)')],
    });
    expect(thrown['attack.ranged'].total).toBe(2);
    expect(thrown['attack.melee'].total).toBe(0);
    const volley = calculateCharacterSheetProjections(
      featSheet('Opening Volley', 'situation'),
    );
    expect(volley.current.breakdowns['attack.melee'].total).toBe(0);
    expect(volley.permanent.breakdowns['attack.melee'].total).toBe(0);
    expect(
      resolveSheet(modifiers('Opening Volley'), {
        situations: [indexSituation('Opening Volley')],
      })['attack.melee'].total,
    ).toBe(4);
    expect(
      resolveSheet(modifiers('Volley Fire'), {
        situations: [
          indexSituation('Volley Fire'),
          indexSituation('Volley Fire', 3),
        ],
      })['attack.ranged'].total,
    ).toBe(4);
  });

  it('keeps recipient effects, replacement penalties and unsupported grants off bearer totals', () => {
    for (const name of [
      'Intoxicating Flattery',
      'Robust Stench',
      'Lighting the Way',
      'Cranial Adjustment',
      'Grand Master Performer',
      'Bolster Jinx',
      'Motivating Display',
      'Marcher-Lord of the Cerulean Abyss',
      'Hamatula Grasp',
      'Rapid Grappler',
      'Sprightly Armor',
      'Evolved Companion',
      'Phantom Fighter',
      'Balor Whip',
    ])
      expect(entry(name).modifiers, name).toEqual([]);
    expect(
      resolveSheet(modifiers('Directed Disarm'), {
        situations: [
          indexSituation('Directed Disarm'),
          indexSituation('Directed Disarm', 1),
        ],
      })['attack.ranged'].total,
    ).toBe(-8);
    expect(
      resolveSheet(modifiers('Tail Weapon'), {
        situations: [indexSituation('Tail Weapon')],
      })['skill.acr'].total,
    ).toBe(2);
    expect(resolveSheet(modifiers('Tail Weapon')).cmd.total).toBe(0);
    expect(entry('Undead Master (Mythic)').situationalNotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: expect.stringContaining('tripled rather than doubled'),
        }),
      ]),
    );
  });
});

describe('the feats-345 keys', () => {
  const { entry, modifiers, indexSituation, featSheet } = featBatch(
    entries,
    'feats-345',
  );

  // #724: the rank threshold is automatic, read from the skill's recorded ranks.
  it('gives Skill Focus (Knowledge [Dungeoneering]) +3, or +6 at 10 ranks, without a Situation or a stacking same-Source copy', () => {
    const data = modifiers('Skill Focus (Knowledge [Dungeoneering])');
    expectAutomaticSkillFocus({ modifiers: data, target: 'skill.kdu' });
    // No ranks: Skill Focus's +3.
    for (const projection of Object.values(
      calculateCharacterSheetProjections(
        featSheet('Skill Focus (Knowledge [Dungeoneering])', 'situation'),
      ),
    ))
      expect(projection.breakdowns['skill.kdu'].total).toBe(3);
  });

  it('keeps shared grapple, fear and alignment Situations exact and non-stacking within one Source', () => {
    expect(resolveSheet(modifiers('Sinuous Vines')).cmb.total).toBe(0);
    expect(
      resolveSheet(modifiers('Sinuous Vines'), { situations: ['grapple'] }).cmb
        .total,
    ).toBe(2);
    expect(
      resolveSheet(modifiers('Sinuous Vines'), { situations: ['trip'] }).cmb
        .total,
    ).toBe(0);
    const steed = modifiers('Valiant Steed');
    const emotion = indexSituation('Valiant Steed', 1);
    expect(
      resolveSheet(steed, { situations: ['fear'] })['save.will'].total,
    ).toBe(4);
    expect(
      resolveSheet(steed, { situations: [emotion] })['save.will'].total,
    ).toBe(4);
    expect(
      resolveSheet(steed, { situations: ['fear', emotion] })['save.will'].total,
    ).toBe(4);
    expect(
      resolveSheet(steed, { situations: ['mindAffecting'] })['save.will'].total,
    ).toBe(0);
    expect(
      resolveSheet(modifiers('Champion of Malevolence'), {
        situations: ['goodCreatures'],
      })['damage.melee'].total,
    ).toBe(2);
    expect(
      resolveSheet(modifiers('Champion of Malevolence'), {
        situations: ['lawfulCreatures'],
      })['damage.melee'].total,
    ).toBe(0);
  });

  it('preserves distinct maneuver/target, replacement and recipient restrictions', () => {
    expect(
      resolveSheet(modifiers('Disorienting Maneuver'), {
        situations: [indexSituation('Disorienting Maneuver')],
      })['attack.melee'].total,
    ).toBe(2);
    expect(
      resolveSheet(modifiers('Disorienting Maneuver'), {
        situations: [indexSituation('Disorienting Maneuver', 1)],
      }).cmb.total,
    ).toBe(4);
    expect(
      resolveSheet(modifiers('Animal Disguise'), {
        situations: [indexSituation('Animal Disguise')],
      })['skill.dis'].total,
    ).toBe(2);
    expect(
      resolveSheet(modifiers('Low Profile'), {
        situations: [indexSituation('Low Profile')],
      })['ac.other'].total,
    ).toBe(1);
    expect(
      resolveSheet(modifiers('Ancestral Enmity'), {
        situations: [indexSituation('Ancestral Enmity')],
      })['attack.melee'].total,
    ).toBe(2);
    expect(
      resolveSheet(modifiers('Ancestral Enmity'), {
        situations: [indexSituation('Ancestral Enmity')],
      })['attack.ranged'].total,
    ).toBe(0);
    for (const name of [
      'Covering Defense',
      'Crashing Wave Buffet',
      'Master Performer',
      'Merciless Beating',
      'Combat Distraction',
      'Archon Diversion',
      'Long-Nose Form',
      'Punishing Step',
    ])
      expect(
        entry(name).modifiers.some(
          (row) =>
            row.target === 'cmd' ||
            row.target === 'ability.str' ||
            row.target === 'ac.other' ||
            row.value === -1 ||
            row.value === -2,
        ),
        name,
      ).toBe(false);
    expect(
      resolveSheet(modifiers('Wilding Senses'), {
        situations: [
          indexSituation('Wilding Senses'),
          indexSituation('Wilding Senses', 3),
        ],
      })['skill.per'].total,
    ).toBe(8);
  });
});

describe('the feats-346 keys', () => {
  const { entry, modifiers, indexSituation, featSheet } = featBatch(
    entries,
    'feats-346',
  );

  // #724: the rank threshold is automatic, read from the skill's recorded ranks.
  it('gives Skill Focus (Heal) +3, or +6 at 10 ranks, without a Situation or a stacking same-Source copy', () => {
    const data = modifiers('Skill Focus (Heal)');
    expectAutomaticSkillFocus({ modifiers: data, target: 'skill.hea' });
    // No ranks: Skill Focus's +3.
    for (const projection of Object.values(
      calculateCharacterSheetProjections(
        featSheet('Skill Focus (Heal)', 'situation'),
      ),
    ))
      expect(projection.breakdowns['skill.hea'].total).toBe(3);
  });

  it('resolves exact lunar saves, different maneuver scopes and armor-versus-shield changes', () => {
    const moon = modifiers('Moontouched');
    expect(resolveSheet(moon)['save.fort'].total).toBe(0);
    const lit = resolveSheet(moon, {
      situations: [indexSituation('Moontouched')],
    });
    expect([
      lit['save.fort'].total,
      lit['save.ref'].total,
      lit['save.will'].total,
    ]).toEqual([2, 2, -2]);
    const blow = modifiers('Improved Awesome Blow');
    expect(
      resolveSheet(blow, {
        situations: [indexSituation('Improved Awesome Blow')],
      }).cmb.total,
    ).toBe(2);
    expect(resolveSheet(blow, { situations: ['bullRush'] }).cmb.total).toBe(0);
    const stance = resolveSheet(modifiers("Kraggodan's Stance"), {
      situations: [indexSituation("Kraggodan's Stance")],
    });
    expect(stance['ac.armor'].total).toBe(1);
    expect(stance['ac.shield'].total).toBe(1);
    for (const { score, bonus } of [
      { score: 18, bonus: 4 },
      { score: 8, bonus: 0 },
    ]) {
      const sheet = featSheet('Osyluth Guile', 'situation', {
        charisma: score,
      });
      const selected = {
        ...indexSituation('Osyluth Guile'),
        sheetEntryId: 'feat-row',
      };
      expect(
        calculateCharacterSheetProjections(sheet).current.breakdowns['ac.other']
          .total,
      ).toBe(0);
      expect(
        calculateCharacterSheetProjections(sheet, { situations: [selected] })
          .current.breakdowns['ac.other'].total,
      ).toBe(bonus);
    }

    const negative = modifiers('Necromantic Affinity');
    expect(
      resolveSheet(negative, { situations: ['negativeEnergy'] })['save.will']
        .total,
    ).toBe(2);
    expect(
      resolveSheet(negative, {
        situations: [
          'negativeEnergy',
          indexSituation('Necromantic Affinity', 1),
        ],
      })['save.will'].total,
    ).toBe(2);
    expect(
      resolveSheet(negative, { situations: ['death'] })['save.will'].total,
    ).toBe(0);
  });

  it('keeps recipient, replacement, per-hit, caster-duration and Story completion rules out of ordinary totals', () => {
    for (const name of [
      'Ready for Battle',
      'Blood Feast',
      'Pushing Assault',
      'Shadow Caster',
      'Jabbing Style',
      'Rending Claws',
      'Wilding',
      'War Blessing',
    ])
      expect(entry(name).modifiers, name).toEqual([]);
    const nation = modifiers('Nation Builder');
    expect(resolveSheet(nation).init.total).toBe(0);
    const complete = resolveSheet(nation, {
      situations: [indexSituation('Nation Builder', 6)],
    });
    expect([
      complete.init.total,
      complete['attack.melee'].total,
      complete['save.will'].total,
    ]).toEqual([2, 2, 2]);
    expect(
      entry('Nation Builder').situationalNotes?.some((note) =>
        note.text.includes('Completion Benefit'),
      ),
    ).toBe(true);
    expect(
      resolveSheet(modifiers('Traditional Weapons'), {
        situations: [indexSituation('Traditional Weapons')],
      }).cmb.total,
    ).toBe(2);
  });
});

describe('the feats-347 keys', () => {
  const { entry, modifiers, indexSituation, featSheet } = featBatch(
    entries,
    'feats-347',
  );

  it('uses the shared mind-affecting Situation and keeps grapple-escape checks narrow', () => {
    const rows = modifiers('Free Spirit');
    expect(resolveSheet(rows)['save.will'].total).toBe(0);
    const affected = resolveSheet(rows, { situations: ['mindAffecting'] });
    expect([
      affected['save.fort'].total,
      affected['save.ref'].total,
      affected['save.will'].total,
    ]).toEqual([2, 2, 2]);
    expect(
      resolveSheet(rows, { situations: ['enchantment'] })['save.will'].total,
    ).toBe(0);
    expect(resolveSheet(rows, { situations: ['grapple'] }).cmb.total).toBe(0);
    const escape = indexSituation('Free Spirit', 3);
    const escaped = resolveSheet(rows, { situations: [escape] });
    expect([escaped.cmb.total, escaped['skill.esc'].total]).toEqual([2, 2]);
    expect(
      resolveSheet(rows, {
        situations: [{ ...escape, sheetEntryId: 'foreign' }],
      }).cmb.total,
    ).toBe(0);
    expect(
      resolveSheet(
        [
          ...rows,
          ...rows.map((row) => ({
            ...row,
            sheetEntryId: 'copy',
            catalogEntryId: 'copy',
          })),
        ],
        { situations: ['mindAffecting'] },
      )['save.will'].total,
    ).toBe(2);
  });

  it('resolves selected Story completion targets without combining doubled and ordinary branches', () => {
    const rows = modifiers('Enemy Cult');
    expect(resolveSheet(rows)['save.will'].total).toBe(0);
    const evil = resolveSheet(rows, {
      situations: [
        indexSituation('Enemy Cult'),
        indexSituation('Enemy Cult', 3),
      ],
    });
    expect([evil['save.will'].total, evil['ac.other'].total]).toEqual([2, 2]);
    const summoned = resolveSheet(rows, {
      situations: [
        indexSituation('Enemy Cult', 4),
        indexSituation('Enemy Cult', 7),
      ],
    });
    expect([summoned['save.will'].total, summoned['ac.other'].total]).toEqual([
      4, 4,
    ]);
    expect(
      resolveSheet(rows, { situations: ['evilCreatures'] })['save.will'].total,
    ).toBe(0);
    expect(
      calculateCharacterSheetProjections(featSheet('Enemy Cult', 'situation'))
        .current.breakdowns['save.will'].total,
    ).toBe(0);
  });

  it('adds Shield Wall to an existing shield bonus and scopes Style and Dervish maneuvers', () => {
    const wall = modifiers('Shield Wall');
    const base = {
      ...wall[0]!,
      bonusType: 'shield' as const,
      value: 5,
      condition: undefined,
      sheetEntryId: 'shield',
      catalogEntryId: 'shield',
      source: 'shield',
    };
    expect(resolveSheet([base, ...wall])['ac.shield'].total).toBe(5);
    expect(
      resolveSheet([base, ...wall], {
        situations: [indexSituation('Shield Wall')],
      })['ac.shield'].total,
    ).toBe(6);
    expect(
      resolveSheet([base, ...wall], {
        situations: [indexSituation('Shield Wall', 1)],
      })['ac.shield'].total,
    ).toBe(7);
    expect(
      resolveSheet([base, ...wall], {
        situations: [
          indexSituation('Shield Wall'),
          indexSituation('Shield Wall', 1),
        ],
      })['ac.shield'].total,
    ).toBe(7);
    const tiger = modifiers('Tiger Style');
    expect(
      resolveSheet(tiger, { situations: ['bullRush', 'overrun', 'trip'] }).cmd
        .total,
    ).toBe(0);
    expect(
      resolveSheet(tiger, { situations: [indexSituation('Tiger Style')] }).cmd
        .total,
    ).toBe(2);
    const dervish = modifiers('Dimensional Maneuvers');
    expect(
      resolveSheet(dervish, { situations: ['reposition'] }).cmb.total,
    ).toBe(0);
    expect(
      resolveSheet(dervish, {
        situations: [indexSituation('Dimensional Maneuvers', 2)],
      }).cmb.total,
    ).toBe(4);
  });

  it('retains the exact chosen penalties and keeps recipient/replacement rules out of ordinary totals', () => {
    const daze = resolveSheet(modifiers('Dazing Assault'), {
      situations: [indexSituation('Dazing Assault')],
    });
    expect([
      daze['attack.melee'].total,
      daze.cmb.total,
      daze['attack.ranged'].total,
    ]).toEqual([-5, -5, 0]);
    expect(
      resolveSheet(modifiers('Sincere Flattery'), {
        situations: [indexSituation('Sincere Flattery')],
      })['skill.crf'].total,
    ).toBe(4);
    expect(
      resolveSheet(modifiers('Sincere Flattery'), {
        situations: [indexSituation('Sincere Flattery', 1)],
      })['skill.crf'].total,
    ).toBe(8);
    for (const name of [
      'Lead by Example',
      'Broken Wing Gambit',
      'Kobold Sniper',
      'Diva Strike',
      'Hefty Brute',
      'Pinch Time',
      'Painful Cures',
      'Divine Fighting Technique',
      'Channel Spirit',
      'Longshanks',
      'Dispel Focus',
      'Group Deliver Touch Spells',
    ])
      expect(entry(name).modifiers, name).toEqual([]);
    expect(entry('Group Deliver Touch Spells').description).toContain(
      'share spells ability',
    );
    expect(entry('Divine Fighting Technique').description).toContain(
      'Zon-Kuthon',
    );
  });
});
