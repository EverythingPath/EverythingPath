// @vitest-environment node
// pbl-released-spells-1 (PRD #251): the spell batch units' resolver blocks
// (spells-516 to spells-526), on entries imported from the pinned store. One
// import holds every Spell the blocks name (released-spell-keys.ts and the
// descriptor tables below) and the 28 spellcasting classes their class
// levels name; each describe looks its Spells up by the name its batch test
// used. Each case asserts what the import emits for those Spells and what
// the sheet computes from them, with literal expected values; the batch
// reviews' records are not read.
import { describe, expect, it } from 'vitest';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
import { calculateCharacterSheetProjections } from '../../src/lib/character-sheet';
import { importReleasedEntries } from './released-entries';
import {
  spellBatches,
  spellcastingClasses,
  type SpellBatch,
} from './released-spell-keys';
import {
  importedSpell,
  spellBatch,
  withoutSpell,
} from './released-spell-sheet';

/**
 * The Spells of spells-522 whose review recorded descriptors, with them
 * (#738 imports them as published).
 */
const descriptors522 = [
  ['Pox of Rumors', 'pf1/6yu1ubq7tvb5xpbi', ['curse', 'mindAffecting']],
  ['Delay Pain', 'pf1/6zv90r375b5ha994', ['emotion']],
  ['Protection from Good', 'pf1/71g6nmvy8qnodwyz', ['evil']],
  ['Memorize Page', 'pf1/722g8ssc6f2rm3r8', ['mindAffecting']],
  ['Reinvigorating Wind', 'pf1/7253kbjniaqgrtim', ['air', 'mindAffecting']],
  ['Masochistic Shadow', 'pf1/72f7xfijqxxm1mtm', ['evil', 'shadow']],
  ['Implant Urge', 'pf1/7461spd68dipa6m5', ['mindAffecting']],
  ['Dream Voyage', 'pf1/759y8xzdg3unvt6s', ['mindAffecting']],
  ['Poisoned Egg', 'pf1/75subr59gf28mk9b', ['poison']],
  ['Phantasmal Asphyxiation', 'pf1/76nj2u36i3fr8fpo', ['mindAffecting']],
  ['Hold Person', 'pf1/78kwl5t99j9e8tzh', ['mindAffecting']],
  ['Incendiary Runes', 'pf1/7abbj3fik0g8v6ff', ['fire']],
  ['Energy Siege Shot, Greater', 'pf1/7cpk3iq9pirbzd4m', ['variable']],
  ['Rotting Alliance', 'pf1/7d2ro0rt9o57aakm', ['curse', 'disease']],
  ['Hypnotism, Greater', 'pf1/7d4hy2wjuonwjbv0', ['mindAffecting']],
  ['Overwhelming Poison', 'pf1/7dj9chib3qeyimdy', ['poison']],
  ['Dictum', 'pf1/7e22urxux6i2mua5', ['lawful', 'sonic']],
  ['Advanced Scurvy', 'pf1/7f9tbbxfod3to7yu', ['disease', 'evil']],
  ['Slipstream', 'pf1/7fvsn0gbv6ynlp63', ['water']],
  [
    'Unprepared Combatant',
    'pf1/7g4aczondf7igvyd',
    ['emotion', 'mindAffecting'],
  ],
  ['Scouring Winds', 'pf1/7hakpmv7enojm4jg', ['air', 'earth']],
  ['Summon Elemental Steed', 'pf1/7j5nps3g5afiamvi', ['see text']],
  ['Soulreaver', 'pf1/7ki94ao8u17wnryo', ['death']],
  ['Blast Barrier', 'pf1/7kil93h63jpy949z', ['sonic']],
  ['Plague Storm', 'pf1/7l7wofgz2iafjsdr', ['disease', 'evil']],
  ['Bleed for your Master', 'pf1/7mm9xz5uiifjkx1p', ['mindAffecting']],
  ['Mantle of Calm', 'pf1/7no45vnykqt1azc8', ['emotion', 'mindAffecting']],
  ['Painful Revelation', 'pf1/7oelmxa5kdo63erj', ['mindAffecting', 'pain']],
  ['Martial Marionette', 'pf1/7orkrpa9zag8fuil', ['mindAffecting']],
  ['Unnatural Lust', 'pf1/7p0oh9opqbf7j5du', ['emotion', 'mindAffecting']],
  ['Unholy Ice Weapon', 'pf1/7qo2cisa17kxkppx', ['cold', 'evil', 'water']],
  ['Holy Ice', 'pf1/7re5tyxfpphormys', ['cold', 'good', 'water']],
  ['Debilitating Portent', 'pf1/7ro7qm94j4d7bwfd', ['mindAffecting']],
  ['Node of Blasting', 'pf1/7s7njmjixqkytskw', ['mindAffecting']],
  ['Summon Ceustodaemon', 'pf1/7sq6kr3edd8rmy0f', ['evil']],
  ['Finger of Death', 'pf1/7toeli7vcq5a7tv1', ['death']],
  ['Sympathy', 'pf1/7wcosqq4v4x0bvep', ['emotion', 'mindAffecting']],
  ['Daylight', 'pf1/7x2z0i8rcx7s81fk', ['light']],
  ['Control Water', 'pf1/7yf67b7y4byj96w7', ['water']],
] as const;

/** The Spells of spells-524 whose pinned record publishes descriptors. */
const descriptors524 = [
  ['Deafening Song Bolt', 'pf1/9f0jokh1rcmw36tj', ['sonic']],
  ['Vitriolic Mist', 'pf1/9ha7fyq951iijvt8', ['acid']],
  ['Air Walk, Communal', 'pf1/9imc15es7vbtqdqz', ['air']],
  ['Miasmal Dread', 'pf1/9jcelzrc91kpr5ew', ['fear', 'mindAffecting']],
  ['Tomb Legion', 'pf1/9jjocotdsznwkz97', ['evil']],
  ['Pick Your Poison', 'pf1/9oosw4hf9kxh9b9s', ['mindAffecting']],
  ['Oppressive Boredom', 'pf1/9ozs6mdxa4ltwtuw', ['emotion', 'mindAffecting']],
  ['Heckle', 'pf1/9pu7hu8jhwwgxbcj', ['emotion', 'mindAffecting']],
  ['Charm Fey', 'pf1/9qikkia1ww55aeh8', ['mindAffecting']],
  ['Sacrifice', 'pf1/9ri40ee00k8brat1', ['mindAffecting']],
  ['Fickle Winds', 'pf1/9s5oseou738k2qif', ['air']],
  ["Jatembe's Ire", 'pf1/9tvqcy1hqdmawdo2', ['good']],
  ['Cause Fear', 'pf1/9tww9fc9049h6iqc', ['emotion', 'fear', 'mindAffecting']],
  ['Shadow Projection', 'pf1/9u4mn2uxm862cpbb', ['evil']],
  ['Fire Storm', 'pf1/9wl8ijy6argdvz5f', ['fire']],
  ['Spindrift Spritz, Mass', 'pf1/BcZC63EPa8AuJBdq', ['water']],
  ['Litany of Order', 'pf1/DPKSnxvgdYVIsGpN', ['lawful', 'languageDependent']],
  ['Symbol of Storms', 'pf1/DuaTNlfR9hzv5euv', ['air', 'electricity']],
  ['Revealing Light', 'pf1/GeNvBJJptxIqFXZK', ['light']],
  ['Fey Blight', 'pf1/H6qZ8QjVBWGyucTK', ['curse', 'ruse']],
  ['Unhallowed Blows', 'pf1/HK5dl4ECkzd6LDLY', ['evil']],
  ['Toxic Blood', 'pf1/IHFIFyvEVyfS68C2', ['poison']],
  ['Carrying Wind', 'pf1/JmX68u3q4lCxuB0l', ['air']],
  ['Unhallowed Blows, Greater', 'pf1/JsrZMMiknX9ZVhuA', ['evil']],
  ['Litany of Admonition', 'pf1/LrY6Qc1hzRO2ZG8x', ['languageDependent']],
  ['Summon Barghest II', 'pf1/M6rx2faMBFZFzuY9', ['evil']],
  ['Shared Training', 'pf1/M6z9LD9YgCPjVVX3', ['mindAffecting']],
  ['Spindrift Spritz', 'pf1/NnbDuJ1RbfbuiiY0', ['water']],
  ['Veil of Ash', 'pf1/O8h91bExN8WP93WW', ['fire']],
  ["Hag's Seasoning", 'pf1/OIWY4Cdh0u8HvgLb', ['curse']],
  ['Waterproof', 'pf1/Q1SwHEAnMZpQDN3W', ['water']],
  ['Admonishing Ray', 'pf1/QUXJYqzIFAzvXQ3e', ['force']],
  ['Blast of Wind', 'pf1/SJqQO3f3l2PXrVaH', ['air']],
  ['Teratoid Caress', 'pf1/SkM63G8HnKo8Fj6l', ['chaotic', 'curse', 'evil']],
  ['Seismic Fissure', 'pf1/SqXUsoE5MvrI4nZI', ['earth']],
  ['Water Shield', 'pf1/TN5FLPMkVY59iHY2', ['acid', 'water']],
  ['Rising Water', 'pf1/UBp9cManySiQEhQD', ['water']],
  ['Untold Wonder', 'pf1/UkSdEOtHdzeuRiUu', ['mindAffecting']],
  ['Summon Barghest I', 'pf1/ViSMOM9zfKVQLvCQ', ['evil']],
  ['Bolts of Bedevilment', 'pf1/Z2Jpbju6A5ASxiE2', ['mindAffecting']],
] as const;

const { entries } = await importReleasedEntries([
  ...Object.values(spellBatches).flatMap((batch) => Object.values(batch)),
  ...descriptors522.map(([, key]) => key),
  ...descriptors524.map(([, key]) => key),
  ...Object.values(spellcastingClasses),
]);

/** A Spell by its literal key, which must carry the name the batch test used. */
function spellNamed(key: string, name: string) {
  const entry = importedSpell(entries, key);
  expect(entry.name).toBe(name);
  return entry;
}

/**
 * The Spells `spellBatches` lists for a batch (its describe's lookups), each
 * imported under its name as a Spell. The no-Modifier and source-key
 * invariant of the batch units' preview blocks is asserted for every Spell
 * this file imports, below.
 */
function itImportsBatchSpellsByName(batch: SpellBatch) {
  it(`imports every Spell spellBatches lists for ${batch} under its name, as a Spell`, () => {
    for (const [name, key] of Object.entries(spellBatches[batch])) {
      const row = entries.get(key);
      expect(row?.name, key).toBe(name);
      expect(row?.detail.kind, name).toBe('spell');
    }
  });
}

/** The current and permanent projections of a sheet. */
function projections(
  ...args: Parameters<typeof calculateCharacterSheetProjections>
) {
  const result = calculateCharacterSheetProjections(...args);
  return [result.current, result.permanent] as const;
}

/** The recorded Spell row of a projection, as the batch tests matched it. */
const recordedRow = (level: number) =>
  expect.objectContaining({
    entryId: 'spell-row',
    spellLevel: level,
    explicitLevel: level,
  });

// The batch units' preview blocks required every Spell their import emitted
// to have no Modifiers, and spells-516 to 521 and 523 no source key; here
// both hold for every Spell this file's one import emits, the batch lists'
// and the descriptor tables' alike, and their number is a literal so the
// loop cannot run over fewer.
describe('every Spell this file imports', () => {
  it('imports 178 Spells, none with Modifiers or a source key', () => {
    const spells = [...entries.values()].filter(
      (row) => row.detail.kind === 'spell',
    );
    expect(spells).toHaveLength(178);
    for (const row of spells) {
      expect(row.modifiers, row.name).toEqual([]);
      expect(row.sourceKey, row.name).toBeUndefined();
    }
  });
});

describe('the spells-516 Spells', () => {
  const { spell, sheet } = spellBatch(entries, 'spells-516');
  itImportsBatchSpellsByName('spells-516');
  it('pins Bull’s Strength’s class and grant levels separately from the +4 running effect described in its prose', () => {
    const bull = spell("Bull's Strength");
    expect(bull.externalKey).toBe('pf1/05i5rxwim12hwktu');
    expect(bull.sources).toEqual([{ book: 'PZO1110', pages: '251' }]);
    expect(bull.detail.levels).toMatchObject({
      wizard: 2,
      cleric: 2,
      druid: 2,
      paladin: 2,
      alchemist: 2,
      summonerUnchained: 2,
    });
    expect(bull.detail.grantedLevels).toEqual({
      bloodline: { Abyssal: 2, Orc: 2 },
      domain: { Strength: 2 },
      subDomain: { Rage: 2 },
    });
    expect(bull.detail.school).toBe('trs');
    expect(bull.description).toContain('+4 enhancement bonus');
    expect(bull.modifiers).toEqual([]);
    for (const projection of projections(sheet("Bull's Strength", 'wizard'))) {
      expect(projection.abilities.strength.score).toBe(10);
      expect(projection.breakdowns['attack.melee'].total).toBe(0);
      expect(
        projection.spellCollections.spellsWithoutSpellcasting,
      ).toContainEqual(recordedRow(2));
    }
  });

  it('keeps Protection from Spells’ +8 and Divine Power’s capped scaling as effect prose rather than unconditional bonuses', () => {
    const protection = spell('Protection from Spells');
    expect(protection.detail).toMatchObject({
      school: 'abj',
      levels: { wizard: 8, summoner: 6 },
      grantedLevels: { domain: { Magic: 8 } },
    });
    expect(protection.sources).toEqual([{ book: 'PZO1110', pages: '328' }]);
    expect(protection.modifiers).toEqual([]);
    expect(protection.situationalNotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: 'saves',
          situation: 'spells',
          text: expect.stringContaining('+8'),
        }),
        expect.objectContaining({
          target: 'saves',
          situation: 'spellLike',
          text: expect.stringContaining('+8'),
        }),
      ]),
    );
    for (const projection of projections(
      sheet('Protection from Spells', 'wizard'),
      { situations: ['spells', 'spellLike'] },
    )) {
      expect(projection.derivedStatistics.fortitude.total).toBe(0);
      expect(projection.derivedStatistics.reflex.total).toBe(0);
      expect(projection.derivedStatistics.will.total).toBe(0);
    }
    const divine = spell('Divine Power');
    expect(divine.detail.levels).toMatchObject({
      cleric: 4,
      oracle: 4,
      warpriest: 4,
    });
    expect(divine.description).toContain('every three caster levels');
    expect(divine.description).toContain('maximum +6');
    expect(divine.modifiers).toEqual([]);
  });
});

describe('the spells-517 Spells', () => {
  const { spell, sheet } = spellBatch(entries, 'spells-517');
  itImportsBatchSpellsByName('spells-517');
  it('pins Divine Favor’s capped luck, Blur’s miss chance, Protection from Energy’s absorption and Virtue’s temporary HP as effect prose', () => {
    const divine = spell('Divine Favor');
    expect(divine.externalKey).toBe('pf1/21bxbzdaawjrnvyo');
    expect(divine.sources).toEqual([{ book: 'PZO1110', pages: '273' }]);
    expect(divine.detail).toMatchObject({
      school: 'evo',
      levels: { cleric: 1, inquisitor: 1, oracle: 1, paladin: 1, warpriest: 1 },
      grantedLevels: { domain: { Nobility: 1 }, subDomain: { Archon: 1 } },
    });
    expect(divine.description).toContain('+1 luck');
    expect(divine.description).toContain('every three caster levels');
    expect(divine.description).toContain('maximum +3');
    expect(divine.description).toContain("doesn't apply to spell damage");
    const blur = spell('Blur');
    expect(blur.externalKey).toBe('pf1/18kryvj2dfuymk9d');
    expect(blur.sources).toEqual([{ book: 'PZO1110', pages: '251' }]);
    expect(blur.detail).toMatchObject({
      school: 'ill',
      subschools: ['glamer'],
      levels: { wizard: 2, bard: 2, summonerUnchained: 2 },
      grantedLevels: { bloodline: { Destined: 2, Protean: 2 } },
    });
    expect(blur.description).toContain('20% miss chance');
    const protection = spell('Protection from Energy');
    expect(protection.externalKey).toBe('pf1/1vh2ewwvzvxunoxk');
    expect(protection.sources).toEqual([{ book: 'PZO1110', pages: '327' }]);
    expect(protection.detail).toMatchObject({
      school: 'abj',
      levels: { wizard: 3, cleric: 3, ranger: 2, hunter: 2 },
      grantedLevels: { domain: { Luck: 3, Protection: 3 } },
    });
    expect(protection.description).toContain('12 points per caster level');
    expect(protection.description).toContain(
      'maximum of 120 points at 10th level',
    );
    expect(protection.description).toContain('does not stack with');
    const virtue = spell('Virtue');
    expect(virtue.externalKey).toBe('pf1/22x4iooz3c3vqof9');
    expect(virtue.sources).toEqual([{ book: 'PZO1110', pages: '365' }]);
    expect(virtue.detail).toMatchObject({
      school: 'trs',
      levels: { cleric: 0, druid: 0, paladin: 1 },
    });
    expect(virtue.description).toContain('1 temporary hit point');
  });

  it('keeps shared grapple, mind-affecting, fear and death Situations on reference Notes without applying running bonuses', () => {
    const bouncy = spell('Bouncy Body');
    for (const target of ['cmb', 'cmd'])
      expect(bouncy.situationalNotes).toContainEqual(
        expect.objectContaining({
          target,
          situation: 'grapple',
          text: expect.stringContaining('+2 circumstance'),
        }),
      );
    const rite = spell('Rite of Centered Mind');
    expect(rite.situationalNotes).toContainEqual(
      expect.objectContaining({
        target: 'saves',
        situation: 'mindAffecting',
        text: expect.stringContaining('+1 resistance'),
      }),
    );
    expect(rite.situationalNotes).toContainEqual(
      expect.objectContaining({
        target: 'saves',
        situation: 'fear',
        text: expect.stringContaining('+2 resistance'),
      }),
    );
    const blessing = spell('Blessing of Courage and Life');
    for (const situation of ['fear', 'death'])
      expect(blessing.situationalNotes).toContainEqual(
        expect.objectContaining({
          target: 'saves',
          situation,
          text: expect.stringContaining('+2 morale'),
        }),
      );
    for (const projection of projections(
      sheet('Blessing of Courage and Life', 'cleric'),
      { situations: ['fear', 'death'] },
    )) {
      expect(projection.derivedStatistics.fortitude.total).toBe(0);
      expect(projection.derivedStatistics.reflex.total).toBe(0);
      expect(projection.derivedStatistics.will.total).toBe(0);
    }
  });

  it('preserves custom and malformed source citations without inventing publication aliases', () => {
    for (const [name, book, pages] of [
      ['Penumbra', 'Paizo Blog - Ultimate Cantrips', ''],
      ['Soothing Word', 'GameMastery Condition Cards', ''],
      ['Languid Venom', 'Languid Venom', '218'],
    ] as const)
      expect(spell(name).sources, name).toEqual([{ book, pages }]);
  });

  it.each([
    ['Divine Favor', 'cleric', 1],
    ['Blur', 'wizard', 2],
    ['Protection from Energy', 'ranger', 2],
    ['Virtue', 'cleric', 0],
  ] as const)(
    'recording %s on the %s list at level %i applies no running effect',
    (name, classTag, level) => {
      expect(spell(name).modifiers).toEqual([]);
      for (const projection of projections(sheet(name, classTag))) {
        expect(projection.abilities.strength.score).toBe(10);
        expect(projection.breakdowns['attack.melee'].total).toBe(0);
        expect(projection.breakdowns['damage.melee'].total).toBe(0);
        expect(projection.derivedStatistics.fortitude.total).toBe(0);
        expect(projection.spellEffects).toEqual([]);
        expect(
          projection.spellCollections.spellsWithoutSpellcasting,
        ).toContainEqual(recordedRow(level));
      }
    },
  );
});

describe('the spells-518 Spells', () => {
  const { spell, sheet } = spellBatch(entries, 'spells-518');
  itImportsBatchSpellsByName('spells-518');
  it('keeps Reduce Person’s and Animal Growth’s size adjustments and Shocking Grasp’s capped damage in prose, with their levels and no Modifiers', () => {
    const reduce = spell('Reduce Person');
    expect(reduce.externalKey).toBe('pf1/2y9e1l6zso9tdg0a');
    expect(reduce.sources).toEqual([{ book: 'PZO1110', pages: '330' }]);
    expect(reduce.detail.levels).toMatchObject({
      wizard: 1,
      alchemist: 1,
      psychic: 1,
    });
    expect(reduce.description).toContain('+2 size bonus to Dexterity');
    expect(reduce.description).toContain('-2 size penalty to Strength');
    expect(reduce.description).toContain('minimum of 1');
    expect(reduce.description).toContain('+1 bonus on attack rolls and AC');
    const growth = spell('Animal Growth');
    expect(growth.detail.levels).toMatchObject({
      wizard: 5,
      druid: 5,
      hunter: 4,
    });
    expect(growth.detail.grantedLevels).toEqual({ domain: { Scalykind: 5 } });
    expect(growth.description).toContain('+8 size bonus to Strength');
    expect(growth.description).toContain('+4 size bonus to Constitution');
    expect(growth.description).toContain('natural armor bonus increases by 2');
    const shock = spell('Shocking Grasp');
    expect(shock.sources).toEqual([{ book: 'PZO1110', pages: '343' }]);
    expect(shock.detail).toMatchObject({
      school: 'evo',
      // #738 imports the descriptors the pinned record publishes.
      descriptors: ['electricity'],
      levels: { wizard: 1, magus: 1 },
      grantedLevels: { bloodline: { Djinni: 1, Stormborn: 1 } },
    });
    expect(shock.description).toContain('maximum 5d6');
    expect(shock.description).toContain('+3 bonus on attack rolls');
    expect(shock.description).toContain('wearing metal armor');
    expect(shock.modifiers).toEqual([]);
  });

  it('uses shared fear and mind-affecting Situations on reference Notes while preserving linked definitions', () => {
    const bane = spell('Bane');
    expect(bane.detail).toMatchObject({
      school: 'enc',
      descriptors: ['fear', 'mindAffecting'],
      levels: { cleric: 1, oracle: 1 },
      grantedLevels: { subDomain: { Curse: 1 } },
    });
    expect(bane.situationalNotes).toContainEqual(
      expect.objectContaining({
        target: 'saves',
        situation: 'fear',
        text: expect.stringContaining('−1'),
      }),
    );
    const shield = spell('Thought Shield V');
    expect(shield.detail.levels).toEqual({ psychic: 6 });
    // Its link to Thought Shield IV keeps the key only while that Spell is
    // imported with it, as the batch tree carried it.
    expect(spell('Thought Shield IV').externalKey).toBe('pf1/2p265l26tq5xh0f6');
    expect(shield.description).toContain('2p265l26tq5xh0f6');
    expect(shield.situationalNotes).toContainEqual(
      expect.objectContaining({ situation: 'mindAffecting' }),
    );
    for (const projection of projections(sheet('Bane', 'oracle'), {
      situations: ['fear'],
    })) {
      expect(projection.breakdowns['attack.melee'].total).toBe(0);
      expect(projection.derivedStatistics.will.total).toBe(0);
      expect(projection.spellEffects).toEqual([]);
    }
  });

  it('keeps Thought Worm III’s failed-save all-caster penalty separate from its successful-save caster-only scope', () => {
    const worm = spell('Thought Worm III');
    expect(worm.detail.levels).toEqual({ psychic: 4 });
    expect(worm.description).toContain('thought worm II');
    expect(worm.description).toContain('-2 penalty');
    expect(worm.situationalNotes).toContainEqual(
      expect.objectContaining({
        target: 'save.will',
        situation: 'mindAffecting',
        text: expect.stringContaining('−4 Will against all mind-affecting'),
      }),
    );
    expect(worm.situationalNotes).toContainEqual(
      expect.objectContaining({
        target: 'save.will',
        situation: {
          local:
            "vs. this Thought Worm caster's mind-affecting spells and effects",
        },
        text: expect.stringContaining(
          '−2 Will applies only against this caster',
        ),
      }),
    );
    const result = calculateCharacterSheetProjections(
      sheet('Thought Worm III', 'psychic'),
      { situations: ['mindAffecting'] },
    );
    expect(result.current.derivedStatistics.will.total).toBe(0);
    expect(result.permanent.derivedStatistics.will.total).toBe(0);
  });

  it('preserves Drench’s custom blog identity and URL without inventing a publication-code alias', () => {
    const drench = spell('Drench');
    expect(drench.sources).toEqual([
      { book: 'Paizo Blog - Ultimate Cantrips', pages: '' },
    ]);
    expect(drench.unsupported).toContainEqual(
      expect.objectContaining({
        field: 'sources',
        value: expect.objectContaining({
          name: 'Paizo Blog - Ultimate Cantrips',
          date: '2011-05-24',
          url: 'https://paizo.com/community/blog/v5748dyo5lc7e&page=2?Ultimate-Cantrips',
          pages: '',
        }),
      }),
    );
  });

  it.each([
    ['Bane', 'oracle', 1],
    ['Command', 'oracle', 1],
    ['Reduce Person', 'wizard', 1],
    ['Shocking Grasp', 'wizard', 1],
    ['Animal Growth', 'hunter', 4],
  ] as const)(
    'recording %s on the %s list keeps its class level %i without applying a running effect',
    (name, classTag, level) => {
      for (const projection of projections(sheet(name, classTag))) {
        expect(projection.abilities.strength.score).toBe(10);
        expect(projection.abilities.dexterity.score).toBe(10);
        expect(projection.abilities.constitution.score).toBe(10);
        expect(projection.breakdowns['attack.melee'].total).toBe(0);
        expect(projection.spellEffects).toEqual([]);
        expect(
          projection.spellCollections.spellsWithoutSpellcasting,
        ).toContainEqual(recordedRow(level));
      }
    },
  );
});

describe('the spells-519 Spells', () => {
  const { spell, sheet } = spellBatch(entries, 'spells-519');
  itImportsBatchSpellsByName('spells-519');
  it('pins Magic Missile, False Life, Spider Climb and Spell Resistance to source numbers without activating running effects', () => {
    const missile = spell('Magic Missile');
    expect(missile.externalKey).toBe('pf1/49yc9dpr4kvgki2s');
    expect(missile.sources).toEqual([{ book: 'PZO1110', pages: '309' }]);
    expect(missile.detail).toMatchObject({
      school: 'evo',
      levels: { wizard: 1 },
    });
    expect(missile.description).toContain('1d4+1');
    expect(missile.description).toContain(
      'maximum of five missiles at 9th level',
    );
    const falseLife = spell('False Life');
    expect(falseLife.description).toContain(
      '1d10 + 1 per caster level (maximum +10)',
    );
    expect(falseLife.modifiers).toEqual([]);
    expect(spell('Spider Climb').description).toContain(
      'climb speed of 20 feet and a +8 racial bonus',
    );
    expect(spell('Spell Resistance').description).toContain(
      '12 + your caster level',
    );
    for (const [name, classTag, level] of [
      ['Magic Missile', 'wizard', 1],
      ['False Life', 'wizard', 2],
      ['Spider Climb', 'wizard', 2],
      ['Spell Resistance', 'cleric', 5],
    ] as const)
      for (const projection of projections(sheet(name, classTag))) {
        expect(projection.abilities.strength.score).toBe(10);
        expect(projection.breakdowns['attack.melee'].total).toBe(0);
        expect(projection.breakdowns['damage.melee'].total).toBe(0);
        expect(projection.spellEffects).toEqual([]);
        expect(
          projection.spellCollections.spellsWithoutSpellcasting,
        ).toContainEqual(recordedRow(level));
      }
  });

  it('preserves shared Situations without applying any reference Note as a Modifier', () => {
    expect(spell('Contagious Zeal').situationalNotes).toContainEqual(
      expect.objectContaining({
        target: 'saves',
        situation: 'fear',
        text: expect.stringContaining('+4 morale'),
      }),
    );
    for (const situation of ['overrun', 'trip'])
      expect(spell('Phantom Limb').situationalNotes).toContainEqual(
        expect.objectContaining({
          target: 'cmd',
          situation,
          text: expect.stringContaining('+4 CMD'),
        }),
      );
    for (const situation of [
      'bullRush',
      'grapple',
      'overrun',
      'reposition',
      'trip',
    ])
      expect(spell('Titanic Anchoring').situationalNotes).toContainEqual(
        expect.objectContaining({
          target: 'cmd',
          situation,
          text: expect.stringContaining('+10 CMD'),
        }),
      );
    const result = calculateCharacterSheetProjections(
      sheet('Contagious Zeal', 'cleric'),
      { situations: ['fear'] },
    );
    expect(result.current.derivedStatistics.will.total).toBe(0);
    expect(result.permanent.derivedStatistics.will.total).toBe(0);
  });

  it('retains Greater Hex Glyph’s DC 16 Spellcraft rule and keeps its rules JournalEntryPage link as text (#738)', () => {
    const hex = spell('Hex Glyph, Greater');
    expect(hex.externalKey).toBe('pf1/4fm4md4eux7sw6o0');
    expect(hex.sources).toEqual([{ book: 'PZO1129', pages: '184' }]);
    expect(hex.description).toContain('DC 16');
    expect(hex.description).toContain('Spellcraft');
    expect(hex.unsupported).not.toContainEqual(
      expect.objectContaining({
        value:
          'Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.VRD7jxiIAxKPt6EF',
      }),
    );
  });
});

describe('the spells-520 Spells', () => {
  const { spell, sheet } = spellBatch(entries, 'spells-520');
  itImportsBatchSpellsByName('spells-520');
  it('keeps Keen Senses’ and Effortless Armor’s class levels and rules in prose, and Effortless Armor imports no Modifiers', () => {
    const senses = spell('Keen Senses');
    expect(senses.externalKey).toBe('pf1/54x9nw6ni4rpphcn');
    expect(senses.sources).toEqual([{ book: 'PZO1115', pages: '230' }]);
    expect(senses.detail.levels).toMatchObject({
      alchemist: 1,
      druid: 1,
      hunter: 1,
      ranger: 1,
    });
    expect(senses.description).toContain('+2 competence bonus on Perception');
    expect(senses.description).toContain('low-light vision');
    const armor = spell('Effortless Armor');
    expect(armor.externalKey).toBe('pf1/5kaozniy9sjydygq');
    expect(armor.sources).toEqual([{ book: 'PZO1118', pages: '228' }]);
    expect(armor.detail.levels).toMatchObject({
      cleric: 2,
      oracle: 2,
      paladin: 2,
    });
    expect(armor.description).toContain('no longer reduces your speed');
    expect(armor.description).toContain(
      '1 + 1 per five caster levels (maximum 5)',
    );
    expect(armor.modifiers).toEqual([]);
  });

  it('keeps Heal’s class and domain levels, healing cap and exclusions in its imported entry', () => {
    const heal = spell('Heal');
    expect(heal.sources).toEqual([{ book: 'PZO1110', pages: '294' }]);
    expect(heal.detail.levels).toMatchObject({
      oracle: 6,
      cleric: 6,
      druid: 7,
      adept: 5,
    });
    expect(heal.detail.grantedLevels).toEqual({ domain: { Healing: 6 } });
    expect(heal.description).toContain('maximum of 150 points at 15th level');
    expect(heal.description).toContain('does not remove negative levels');
    expect(heal.description).toContain('permanently drained ability score');
  });

  it('keeps Ego Whip IV’s psychic level, the text of its ego whip I link, its numeric penalty and descriptors', () => {
    const whip = spell('Ego Whip IV');
    expect(whip.detail.levels).toEqual({ psychic: 6 });
    expect(whip.description).toContain('ego whip I');
    expect(whip.description).toContain('-8 penalty');
    expect(whip.description).toContain('staggered for 1d8 rounds');
    // #738 imports the descriptors the review recorded as lost.
    expect(whip.detail.descriptors).toEqual(['emotion', 'mindAffecting']);
  });

  it('keeps Scoop’s custom blog citation and Interplanetary Teleport’s three source identities', () => {
    const scoop = spell('Scoop');
    expect(scoop.sources).toEqual([
      { book: 'Paizo Blog - Ultimate Cantrips', pages: '' },
    ]);
    expect(scoop.detail.levels).toMatchObject({
      wizard: 0,
      sorcerer: 0,
      arcanist: 0,
    });
    expect(scoop.description).toContain('up to 1 pint');
    expect(scoop.description).toContain('up to 5 pounds');
    expect(scoop.description).toContain('rare cantrips');
    expect(scoop.unsupported).toContainEqual(
      expect.objectContaining({
        field: 'sources',
        value: expect.objectContaining({
          name: 'Paizo Blog - Ultimate Cantrips',
          date: '2011-05-24',
          pages: '',
          url: 'https://paizo.com/community/blog/v5748dyo5lc7e&page=2?Ultimate-Cantrips',
        }),
      }),
    );
    const teleport = spell('Interplanetary Teleport');
    expect(teleport.sources).toEqual([
      { book: 'PZO1117', pages: '225' },
      { book: 'PZO9014', pages: '54' },
      { book: 'PZO9226', pages: '295' },
    ]);
    expect(teleport.detail.levels).toMatchObject({ oracle: 9, wizard: 9 });
    expect(teleport.detail.grantedLevels).toEqual({ domain: { Void: 9 } });
  });

  it('uses the shared fear, enchantment and disarm Situations on reference Notes without activating Spell Effects', () => {
    expect(spell('Swallow Your Fear').situationalNotes).toContainEqual(
      expect.objectContaining({
        situation: 'fear',
        text: expect.stringContaining(
          'only while the subject suffers a fear effect',
        ),
      }),
    );
    const duty = spell('Litany of Duty');
    expect(duty.sources).toEqual([{ book: 'PZO9488', pages: '13' }]);
    expect(duty.situationalNotes).toContainEqual(
      expect.objectContaining({
        target: 'saves',
        situation: 'enchantment',
        text: expect.stringContaining(
          '+2 against enchantment effects for 1 round',
        ),
      }),
    );
    expect(spell('Dazzling Blade, Mass').situationalNotes).toContainEqual(
      expect.objectContaining({
        target: 'cmb',
        situation: 'disarm',
        text: expect.stringContaining('maximum +5'),
      }),
    );
    for (const [name, classTag] of [
      ['Swallow Your Fear', 'oracle'],
      ['Litany of Duty', 'paladin'],
      ['Dazzling Blade, Mass', 'wizard'],
    ] as const)
      for (const projection of projections(sheet(name, classTag), {
        situations: ['fear', 'enchantment', 'disarm'],
      })) {
        expect(projection.abilities.strength.score).toBe(10);
        expect(projection.abilities.constitution.score).toBe(10);
        expect(projection.derivedStatistics.will.total).toBe(0);
        expect(projection.breakdowns['attack.melee'].total).toBe(0);
        expect(projection.spellEffects).toEqual([]);
      }
  });

  it.each([
    ['Keen Senses', 'hunter', 1],
    ['Effortless Armor', 'oracle', 2],
    ['Heal', 'oracle', 6],
    ['Ego Whip IV', 'psychic', 6],
    ['Scoop', 'wizard', 0],
    ["Badger's Ferocity", 'wizard', 2],
  ] as const)(
    'the public resolver retains %s on the %s list at level %i without running effects',
    (name, classTag, level) => {
      for (const projection of projections(sheet(name, classTag))) {
        expect(projection.abilities.strength.score).toBe(10);
        expect(projection.abilities.dexterity.score).toBe(10);
        expect(projection.abilities.constitution.score).toBe(10);
        expect(projection.breakdowns['attack.melee'].total).toBe(0);
        expect(projection.derivedStatistics.will.total).toBe(0);
        expect(projection.spellEffects).toEqual([]);
        expect(
          projection.spellCollections.spellsWithoutSpellcasting,
        ).toContainEqual(recordedRow(level));
      }
    },
  );
});

describe('the spells-521 Spells', () => {
  const { spell, sheet } = spellBatch(entries, 'spells-521');
  itImportsBatchSpellsByName('spells-521');
  it('imports Blacklight, held for its record-level 3.5 tag, without Modifiers', () => {
    expect(spell('Blacklight').modifiers).toEqual([]);
  });

  it('imports Fair is Foul without Modifiers, and recording it on the oracle list runs no Spell Effect', () => {
    expect(spell('Fair is Foul').modifiers).toEqual([]);
    const result = calculateCharacterSheetProjections(
      sheet('Fair is Foul', 'oracle'),
    );
    expect(result.current.spellEffects).toEqual([]);
  });

  it.each([
    'Ascension',
    'Speak with Plane',
    'Summon Ancestral Guardian',
    'Symbol of Striking',
  ])(
    '%s keeps its external procedure on Situational Notes, with no Modifiers',
    (name) => {
      expect(spell(name).situationalNotes?.length).toBeGreaterThan(0);
      expect(spell(name).modifiers).toEqual([]);
    },
  );

  it('keeps Thorn Javelin’s temporary weapon proficiency out of the sheet when the Spell is recorded', () => {
    const thorn = spell('Thorn Javelin');
    expect(thorn.description).toContain('you are proficient in its use');
    expect(thorn.description).toContain('sickened for 1 round');
    expect(thorn.modifiers).toEqual([]);
    const result = calculateCharacterSheetProjections(
      sheet('Thorn Javelin', 'druid'),
    );
    expect(result.current.proficiencies).toEqual(
      result.permanent.proficiencies,
    );
    expect(result.current.proficiencies.grants).toEqual([]);
    expect(result.current.proficiencies.added).toEqual([]);
    expect(result.current.spellEffects).toEqual([]);
  });

  it.each([
    ['Sure Casting', 'spellResistance', 'caster level'],
    ['Wrath', 'spellResistance', 'designated enemy'],
    ['Searching Shadows', 'disarm', 'disarm'],
    ['Searching Shadows', 'steal', 'steal'],
    ['Bloodstone Mirror', 'mindAffecting', 'mind-affecting'],
    ['Magic Circle against Law', 'lawfulCreatures', 'lawful'],
  ] as const)(
    '%s reuses shared %s on readable reference Notes',
    (name, situation, wording) => {
      expect(curation.situations.some((row) => row.key === situation)).toBe(
        true,
      );
      expect(spell(name).situationalNotes).toContainEqual(
        expect.objectContaining({
          situation,
          text: expect.stringContaining(wording),
        }),
      );
      expect(spell(name).modifiers).toEqual([]);
    },
  );

  it('keeps Paragon Surge’s and Tree Shape’s ability changes in prose, with their levels and no Modifiers', () => {
    const surge = spell('Paragon Surge');
    expect(surge.externalKey).toBe('pf1/5v3j49r4mdq9rbx6');
    expect(surge.detail.levels).toMatchObject({
      oracle: 3,
      wizard: 3,
      magus: 4,
    });
    expect(surge.description).toContain(
      '+2 enhancement bonus to Dexterity and Intelligence',
    );
    expect(surge.description).toContain('any one feat');
    expect(surge.modifiers).toEqual([]);
    const tree = spell('Tree Shape');
    expect(tree.externalKey).toBe('pf1/6ho3wsspkqkhypt0');
    expect(tree.sources).toEqual([{ book: 'PZO1110', pages: '362' }]);
    expect(tree.detail.levels).toMatchObject({ druid: 2, ranger: 3 });
    expect(tree.description).toContain('+10 natural armor bonus');
    expect(tree.description).toContain('effective Dexterity score of 0');
    expect(tree.modifiers).toEqual([]);
  });

  it('pins Fireball’s levels and capped damage and Touch of Idiocy’s penalties without treating them as Spell Modifiers', () => {
    const fireball = spell('Fireball');
    expect(fireball.externalKey).toBe('pf1/6oq1wcryviik9ice');
    expect(fireball.sources).toEqual([{ book: 'PZO1110', pages: '283' }]);
    expect(fireball.detail.levels).toMatchObject({
      wizard: 3,
      magus: 3,
      bloodrager: 3,
    });
    expect(fireball.detail.grantedLevels).toMatchObject({
      domain: { Fire: 3 },
      bloodline: { Efreeti: 3 },
    });
    expect(fireball.description).toContain('maximum 10d6');
    const idiocy = spell('Touch of Idiocy');
    expect(idiocy.description).toContain('1d6 penalty');
    expect(idiocy.description).toContain(
      "can't reduce any of these scores below 1",
    );
    expect(fireball.modifiers).toEqual([]);
    expect(idiocy.modifiers).toEqual([]);
  });

  it.each([
    ['Paragon Surge', 'oracle', 3],
    ['Tree Shape', 'druid', 2],
    ['True Skill', 'wizard', 1],
    ['Fireball', 'wizard', 3],
    ['Touch of Idiocy', 'wizard', 2],
    ['Wrath', 'inquisitor', 1],
  ] as const)(
    'the public resolver records %s on its %s list at level %i without inventing its running effect',
    (name, classTag, level) => {
      for (const projection of projections(sheet(name, classTag))) {
        expect(projection.abilities.strength.score).toBe(10);
        expect(projection.abilities.dexterity.score).toBe(10);
        expect(projection.abilities.intelligence.score).toBe(10);
        expect(projection.breakdowns['attack.melee'].total).toBe(0);
        expect(projection.derivedStatistics.will.total).toBe(0);
        expect(projection.spellEffects).toEqual([]);
        expect(
          projection.spellCollections.spellsWithoutSpellcasting,
        ).toContainEqual(recordedRow(level));
      }
    },
  );
});

/**
 * The resolver's row for a recorded Spell, by its literal key and school; it
 * passes the recorded entry's description through, compared with the entry
 * it was fed, as the batch tests compared it.
 */
function resolvedSpellRow(row: {
  key: string;
  name: string;
  school: string;
  description: string;
  level: number;
}) {
  return expect.objectContaining({
    entryId: 'spell-row',
    catalogEntryId: row.key,
    ruleIdentity: row.key,
    name: row.name,
    school: row.school,
    description: row.description,
    classEntryId: null,
    spellLevel: row.level,
    explicitLevel: row.level,
  });
}

describe('the spells-522 Spells', () => {
  const { spell, sheet } = spellBatch(entries, 'spells-522');
  itImportsBatchSpellsByName('spells-522');
  it.each([
    {
      name: "Fox's Cunning",
      key: 'pf1/743anqr1ahefv8zd',
      school: 'trs',
      classTag: 'wizard',
      level: 2,
      book: 'PZO1110',
      pages: '286',
      wording: '+4 enhancement bonus to Intelligence',
    },
    {
      name: 'Fly',
      key: 'pf1/7d6sv5ecvi7kho3m',
      school: 'trs',
      classTag: 'wizard',
      level: 3,
      book: 'PZO1110',
      pages: '284',
      wording: 'bonus on Fly skill checks equal to 1/2 your caster level',
    },
    {
      name: 'Stunning Barrier',
      key: 'pf1/7vzu76eg8om0gpf0',
      school: 'abj',
      classTag: 'oracle',
      level: 1,
      book: 'PZO1129',
      pages: '194',
      wording: '+1 deflection bonus to AC',
    },
    {
      name: 'Remove Paralysis',
      key: 'pf1/7xdn59ffjaqchhrz',
      school: 'con',
      classTag: 'oracle',
      level: 2,
      book: 'PZO1110',
      pages: '332',
      wording: '+4 resistance bonus',
    },
  ] as const)(
    '$name ($key, $school) keeps its $classTag level $level and its numbers without inventing its running Effect',
    ({ name, key, school, classTag, level, book, pages, wording }) => {
      const entry = spell(name);
      expect(entry.externalKey).toBe(key);
      expect(entry.detail.school).toBe(school);
      expect(entry.detail.levels[classTag]).toBe(level);
      expect(entry.sources).toContainEqual({ book, pages });
      expect(entry.description).toContain(wording);
      expect(entry.modifiers).toEqual([]);
      for (const projection of projections(sheet(name, classTag))) {
        expect(projection.abilities.intelligence.score).toBe(10);
        expect(projection.spellEffects).toEqual([]);
        expect(
          projection.spellCollections.spellsWithoutSpellcasting,
        ).toContainEqual(
          resolvedSpellRow({
            key,
            name,
            school,
            description: entry.description,
            level,
          }),
        );
      }
    },
  );

  it.each([
    ['Implant Urge', 'mindAffecting', /goal/i],
    ['Dream Voyage', 'fear', /vehicle/i],
    ['Overwhelming Poison', 'poison', /single poison dose.*save DC/i],
    ['Ooze Form III', 'mindAffecting', /\+8/i],
    ['Fey Form III', 'poison', /\+8/i],
    ['Thorn Body', 'grapple', /2d6/i],
  ] as const)(
    '%s reuses shared %s while retaining its narrower rule',
    (name, situation, wording) => {
      expect(curation.situations.some((row) => row.key === situation)).toBe(
        true,
      );
      const notes = spell(name).situationalNotes?.filter(
        (note) => note.situation === situation,
      );
      expect(notes?.length).toBeGreaterThan(0);
      expect(notes?.map((note) => note.text).join(' ')).toMatch(wording);
    },
  );

  it('keeps Scouring Winds’ wizard level and wind table reference, and recording it runs no Spell Effect', () => {
    const winds = spell('Scouring Winds');
    expect(winds.detail.levels.wizard).toBe(7);
    expect(winds.description).toContain('Table 13-10: Wind Effects');
    expect(winds.modifiers).toEqual([]);
    for (const projection of projections(sheet('Scouring Winds', 'wizard')))
      expect(projection.spellEffects).toEqual([]);
  });

  it('lists the 39 Spells of spells-522 whose review recorded descriptors', () => {
    expect(descriptors522).toHaveLength(39);
  });

  it.each(descriptors522)(
    '%s (%s) imports the descriptors its review recorded, %j (#738)',
    (name, key, expected) => {
      const entry = spellNamed(key, name);
      expect(entry.detail.descriptors).toEqual(expected);
    },
  );
});

describe('the spells-523 Spells', () => {
  const { spell, sheet } = spellBatch(entries, 'spells-523');
  itImportsBatchSpellsByName('spells-523');
  it('imports Bolt of Glory and Reveal True Shape, held for their 3.5 tags, without Modifiers, and Ego Whip V with no source', () => {
    for (const name of ['Bolt of Glory', 'Reveal True Shape'])
      expect(spell(name).modifiers, name).toEqual([]);
    expect(spell('Ego Whip V').sources).toEqual([]);
  });

  it.each([
    ['Hostile Levitation', 'bullRush', '-4'],
    ['Hostile Levitation', 'drag', '-4'],
    ['Hostile Levitation', 'reposition', '-4'],
    ['Thought Worm IV', 'mindAffecting', '-6'],
    ['Thought Shield II', 'mindAffecting', '+6'],
  ] as const)(
    '%s reuses shared %s on scope-preserving Notes',
    (name, situation, value) => {
      expect(curation.situations.some((row) => row.key === situation)).toBe(
        true,
      );
      expect(spell(name).situationalNotes).toContainEqual(
        expect.objectContaining({
          situation,
          text: expect.stringContaining(value),
        }),
      );
      expect(spell(name).modifiers).toEqual([]);
    },
  );

  it('keeps Thought Worm IV’s −6, Stone Fist’s damage dice, Protection from Good, Communal’s intervals and Angelic Aspect’s class levels', () => {
    expect(spell('Thought Worm IV').description).toContain('-6');
    expect(spell('Stone Fist').description).toContain('1d6');
    expect(spell('Stone Fist').description).toContain('1d4 if you are Small');
    expect(spell('Angelic Aspect').detail.levels).toMatchObject({
      oracle: 5,
      paladin: 3,
      wizard: 5,
    });
    expect(spell('Protection from Good, Communal').description).toContain(
      '1-minute intervals',
    );
  });

  it.each([
    ['Suppress Charms and Compulsions', 'oracle', 2],
    ['Angelic Aspect', 'oracle', 5],
    ['Hostile Levitation', 'wizard', 3],
    ['Polar Ray', 'wizard', 8],
    ['Stone Fist', 'wizard', 1],
  ] as const)(
    'the public resolver records %s on the %s list at level %i without inventing a running effect',
    (name, classTag, level) => {
      for (const projection of projections(sheet(name, classTag))) {
        expect(projection.abilities.strength.score).toBe(10);
        expect(projection.abilities.dexterity.score).toBe(10);
        expect(projection.abilities.intelligence.score).toBe(10);
        expect(projection.breakdowns['attack.melee'].total).toBe(0);
        expect(projection.derivedStatistics.will.total).toBe(0);
        expect(projection.spellEffects).toEqual([]);
        expect(
          projection.spellCollections.spellsWithoutSpellcasting,
        ).toContainEqual(recordedRow(level));
      }
    },
  );
});

/**
 * The batch tests compared a sheet with a recorded Spell with the same sheet
 * without it, and so do these cases; beside that, the baseline's ability
 * scores and save totals are literals (ability scores of 10, no class).
 */
function expectSpellMovesNothing(
  input: Parameters<typeof calculateCharacterSheetProjections>[0],
  options: Parameters<typeof calculateCharacterSheetProjections>[1] = {},
) {
  const baseline = calculateCharacterSheetProjections(
    withoutSpell(input),
    options,
  );
  const actual = calculateCharacterSheetProjections(input, options);
  for (const key of ['current', 'permanent'] as const) {
    for (const projection of [baseline[key], actual[key]]) {
      expect(
        Object.values(projection.abilities).map((row) => row.score),
      ).toEqual([10, 10, 10, 10, 10, 10]);
      expect([
        projection.derivedStatistics.fortitude.total,
        projection.derivedStatistics.reflex.total,
        projection.derivedStatistics.will.total,
      ]).toEqual([0, 0, 0]);
    }
    expect(actual[key].abilities).toEqual(baseline[key].abilities);
    expect(actual[key].derivedStatistics).toEqual(
      baseline[key].derivedStatistics,
    );
    expect(actual[key].proficiencies).toEqual(baseline[key].proficiencies);
    expect(actual[key].spellEffects).toEqual([]);
  }
  return actual;
}

describe('the spells-524 Spells', () => {
  const { spell, sheet } = spellBatch(entries, 'spells-524');
  itImportsBatchSpellsByName('spells-524');
  it.each([
    {
      name: 'Transformation',
      key: 'pf1/9pbl3ktd5oqejl19',
      school: 'trs',
      classTag: 'wizard',
      level: 6,
      book: 'PZO1110',
      pages: '360-361',
      wording: '+4 enhancement bonus to Strength, Dexterity, and Constitution',
    },
    {
      name: 'Gird Ally',
      key: 'pf1/9vld5joaodkatmj3',
      school: 'abj',
      classTag: 'wizard',
      level: 2,
      book: 'PZO9458',
      pages: '22',
      wording: 'maximum +4 deflection bonus at 18th level',
    },
    {
      name: 'Natural Rhythm',
      key: 'pf1/9hnhezzzzrn985o7',
      school: 'trs',
      classTag: 'druid',
      level: 2,
      book: 'PZO1115',
      pages: '233',
      wording: 'maximum +5 bonus',
    },
    {
      name: 'Wooden Wing Shield',
      key: 'pf1/HBdrFlsq2J8hfyDn',
      school: 'trs',
      classTag: 'magus',
      level: 5,
      book: 'PZO1140',
      pages: '14',
      wording: '+4 shield bonus to AC',
    },
  ] as const)(
    '$name ($key, $school) keeps its $classTag level $level and its numbers without granting its running Spell Effect',
    ({ name, key, school, classTag, level, book, pages, wording }) => {
      const entry = spell(name);
      expect(entry.externalKey).toBe(key);
      expect(entry.detail.school).toBe(school);
      expect(entry.detail.levels[classTag]).toBe(level);
      expect(entry.sources).toContainEqual({ book, pages });
      expect(entry.description).toContain(wording);
      expect(entry.modifiers).toEqual([]);
      const actual = expectSpellMovesNothing(sheet(name, classTag));
      for (const projection of [actual.current, actual.permanent]) {
        expect(
          projection.spellCollections.spellsWithoutSpellcasting,
        ).toContainEqual(
          resolvedSpellRow({
            key,
            name,
            school,
            description: entry.description,
            level,
          }),
        );
      }
    },
  );

  it('keeps Fey Boon’s Norn bonuses and Leprechaun limited SLAs readable without invented luck', () => {
    const boon = spell('Fey Boon');
    expect(boon.description).toContain(
      '+2 insight bonus to AC and on saving throws',
    );
    expect(boon.description).toContain('This boon has a duration of 9 months.');
    expect(boon.description).toContain('spell-like abilities three times each');
    for (const name of [
      'Dancing Lights',
      'Disguise Self',
      'Ghost Sound',
      'Major Image',
      'Ventriloquism',
    ])
      expect(boon.description).toContain(name);
    expect(boon.description).toContain(
      'Their caster level is equal to your Hit Dice.',
    );
    expect(boon.description).toContain(
      'expended all the spell-like abilities or after 1 week, whichever is sooner',
    );
    const record = curation.records.find(
      (row) =>
        row.externalKey === boon.externalKey && row.kind === 'description',
    );
    const readable = [
      boon.description,
      ...(record?.outputs.flatMap((output) =>
        output.kind === 'note' ? [output.text] : [],
      ) ?? []),
    ].join(' ');
    expect(readable).not.toMatch(/\+2 luck|once per hour|hourly/i);
    expect(boon.modifiers).toEqual([]);
  });

  it.each([
    [
      'Black Spot',
      'death',
      /-4 penalty on saving throws against death effects/,
    ],
    ['Fey Blight', 'spells', /-5 penalty on saving throws against spells/],
    [
      'Fey Boon',
      'forests',
      /\+10-foot bonus to your land speed while in forest terrain/,
    ],
  ] as const)(
    '%s reuses the shared %s Situation while retaining the narrower rule',
    (name, situation, wording) => {
      expect(curation.situations.some((row) => row.key === situation)).toBe(
        true,
      );
      const notes = spell(name).situationalNotes?.filter(
        (note) => note.situation === situation,
      );
      expect(notes?.length).toBeGreaterThan(0);
      expect(notes?.map((note) => note.text).join(' ')).toMatch(wording);
    },
  );

  it('lists the 40 Spells of spells-524 whose pinned record publishes descriptors', () => {
    expect(descriptors524).toHaveLength(40);
  });

  it.each(descriptors524)(
    '%s (%s) imports the descriptors its pinned record publishes, %j (#738)',
    (name, key, expected) => {
      expect(spellNamed(key, name).detail.descriptors).toEqual(expected);
    },
  );
});

describe('the spells-525 Spells', () => {
  const { spell, sheet } = spellBatch(entries, 'spells-525');
  itImportsBatchSpellsByName('spells-525');
  it.each([
    {
      name: 'Mighty Strength',
      classTag: 'cleric',
      level: 4,
      book: 'PZO9408',
      pages: '22',
      phrase: '+8 enhancement bonus to Strength',
    },
    {
      name: 'Shock Shield',
      classTag: 'wizard',
      level: 1,
      book: 'PZO1118',
      pages: '243',
      phrase: '+2',
    },
    {
      name: 'Unliving Rage',
      classTag: 'wizard',
      level: 3,
      book: 'PZO1129',
      pages: '198',
      phrase: '+2 profane bonus to Strength and Charisma',
    },
    {
      name: 'Sense Vitals',
      classTag: 'wizard',
      level: 2,
      book: 'PZO9459',
      pages: '31',
      phrase: 'maximum of +5d6 at 15th level',
    },
    {
      name: "Owl's Wisdom",
      classTag: 'wizard',
      level: 2,
      book: 'PZO1110',
      pages: '318',
      phrase: '+4 enhancement bonus to Wisdom',
    },
  ] as const)(
    '$name keeps its $classTag level $level and its numbers without granting a running effect',
    ({ name, classTag, level, book, pages, phrase }) => {
      const entry = spell(name);
      expect(entry.detail.levels[classTag]).toBe(level);
      expect(entry.sources).toContainEqual({ book, pages });
      expect(entry.description.replace(/<[^>]+>/g, '')).toContain(phrase);
      expect(entry.modifiers).toEqual([]);
      const actual = expectSpellMovesNothing(sheet(name, classTag));
      for (const projection of [actual.current, actual.permanent])
        expect(
          projection.spellCollections.spellsWithoutSpellcasting,
        ).toContainEqual(
          expect.objectContaining({
            name,
            spellLevel: level,
            ruleIdentity: spellBatches['spells-525'][name],
          }),
        );
    },
  );

  it('imports Crown of Glory, held for its 3.5 tag, under its name', () => {
    expect(spell('Crown of Glory').externalKey).toBe('pf1/av7YbbrWBVgNp2hP');
  });

  it('uses shared Situations for Linebreaker, Blade Lash and Tower of Iron Will without applying them unconditionally', () => {
    for (const [name, situation] of [
      ['Linebreaker', 'charging'],
      ['Linebreaker', 'bullRush'],
      ['Linebreaker', 'overrun'],
      ['Blade Lash', 'trip'],
      ['Tower of Iron Will V', 'mindAffecting'],
    ] as const) {
      const entry = spell(name);
      expect(
        entry.situationalNotes?.some((row) => row.situation === situation),
        `${name} ${situation}`,
      ).toBe(true);
      expect(entry.modifiers).toEqual([]);
    }
    const linebreaker = spell('Linebreaker');
    expect(linebreaker.description).toBe(
      '<p>You gain a +20 foot bonus to your base speed when charging and a +2 bonus on combat maneuver checks made to bull rush or overrun.</p>',
    );
    expect(linebreaker.situationalNotes).toEqual([
      {
        text: 'Gain +20 feet to base speed when charging. Gain +2 on combat maneuver checks made to bull rush or overrun.',
      },
      {
        situation: 'bullRush',
        text: '+2 on bull rush combat maneuver checks while Linebreaker runs.',
      },
      {
        situation: 'overrun',
        text: '+2 on overrun combat maneuver checks while Linebreaker runs.',
      },
      {
        situation: 'charging',
        text: 'While Linebreaker runs, gain +20 feet to base speed when charging.',
      },
    ]);
    expect(
      curation.situations.find((item) => item.key === 'charging'),
    ).toMatchObject({
      label: 'when charging',
      aliases: ['when charging', 'while charging'],
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-08',
    });
    for (const situations of [
      [],
      ['charging'],
      ['bullRush'],
      ['overrun'],
    ] as const)
      expectSpellMovesNothing(sheet('Linebreaker', 'ranger'), { situations });
  });
});

describe('the spells-526 Spells', () => {
  const { spell, sheet } = spellBatch(entries, 'spells-526');
  itImportsBatchSpellsByName('spells-526');
  it('shows readable Note spacing and both literal Planned Assault readings', () => {
    const note = (name: string) => spell(name).situationalNotes?.[0]?.text;
    expect(note('Boiling Blood')).toBe(
      'Failed Fort causes 1 fire damage/round if blood present; orc-subtype target instead gains +2 morale Strength and no fire damage.',
    );
    expect(note('Anchored Step')).toContain('speed -10 feet minimum 5');
    expect(note('Planned Assault')).toContain('After 1 minute');
    expect(note('Planned Assault')).toContain('+4 at CL 10, +6 at CL 15');
    expect(note('Planned Assault')).toContain('for 1 hour');
    expect(note('Planned Assault')).toContain('all actions rather than checks');
    const assault = spell('Planned Assault');
    expect(assault.description).toContain(
      'they receive a +2 sacred bonus to AC, saving throws, and checks for the first round.',
    );
    expect(assault.description).toContain(
      'they gain a +2 morale bonus to AC, saving throws, and all actions for the first round.',
    );
  });

  it.each([
    {
      name: 'Perceive Cues',
      classTag: 'alchemist',
      level: 2,
      book: 'PZO1115',
      pages: '235',
      phrase: '+5 competence bonus',
    },
    {
      name: 'Mind Blank',
      classTag: 'wizard',
      level: 8,
      book: 'PZO1110',
      pages: '313',
      phrase: '+8 resistance bonus',
    },
    {
      name: 'Anchored Step',
      classTag: 'wizard',
      level: 3,
      book: 'PZO1129',
      pages: '173',
      phrase: 'minimum of 5 feet',
    },
    {
      name: 'Boiling Blood',
      classTag: 'wizard',
      level: 2,
      book: 'PZO1117',
      pages: '209',
      phrase: '+2 morale bonus to Strength',
    },
  ] as const)(
    '$name keeps its literal rules and its $classTag level $level through the public resolver',
    ({ name, classTag, level, book, pages, phrase }) => {
      const entry = spell(name);
      expect(entry.detail.levels[classTag]).toBe(level);
      expect(entry.sources).toContainEqual({ book, pages });
      expect(entry.description.replace(/<[^>]+>/g, '')).toContain(phrase);
      const actual = expectSpellMovesNothing(sheet(name, classTag));
      for (const projection of [actual.current, actual.permanent])
        expect(
          projection.spellCollections.spellsWithoutSpellcasting,
        ).toContainEqual(
          expect.objectContaining({
            name,
            spellLevel: level,
            ruleIdentity: spellBatches['spells-526'][name],
          }),
        );
    },
  );

  it('uses shared Situations and keeps Anchored Step’s ground gate rather than an unconditional CMD bonus', () => {
    const step = spell('Anchored Step');
    for (const key of ['bullRushGround', 'tripGround', 'overrun', 'reposition'])
      expect(
        step.situationalNotes?.some(
          (row) =>
            row.situation === key && row.text.includes('touching ground'),
        ),
        key,
      ).toBe(true);
    expect(step.modifiers).toEqual([]);
    expect(
      spell('Positive Pulse').situationalNotes?.map((row) => row.situation),
    ).toEqual([
      undefined,
      'death',
      'negativeEnergy',
      { local: 'vs. energy drain' },
      { local: 'vs. haunts' },
    ]);
  });
});
