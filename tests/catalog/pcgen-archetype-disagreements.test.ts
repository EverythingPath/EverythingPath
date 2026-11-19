// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseIdentityLedger } from '../../scripts/catalog/everythingpath-identities';
import ledger from '../../scripts/catalog/everythingpath-identities.json';
import {
  type AltersAttribution,
  type ArchetypeMapping,
  type ReplacesReading,
  spellLevelGrantsOf,
} from '../../scripts/catalog/pcgen/archetypes';
import { buildEffectiveView } from '../../scripts/catalog/pcgen/effective';
import {
  assignPcgenIdentities,
  pcgenBookFacts,
} from '../../scripts/catalog/pcgen/identities';
import { inventoryPcgen } from '../../scripts/catalog/pcgen/inventory';
import {
  allIncrementKeys,
  reviewedSchedule,
} from '../../scripts/catalog/pcgen/schedules';
import { pcgen716IdentityFiles } from '../fixtures/pcgen-716/identity-files';
import { bindArchetypeMapper, readInventoryClass } from './pcgen-716-schedules';
import { readPcgenFixtureTree } from './pcgen-716-tree';
import { readPinned } from './pinned-sources';

// archetype-mapper-2 (PRD #251): the mapper says when its output disagrees
// with the archetype's own text, as structure-gate items a root record
// resolves, so a curator sees the item instead of finding the disagreement
// by reading (research archetype-mapper-alters §3, kinds A and B).

const tree = await readPcgenFixtureTree(pcgen716IdentityFiles);
const view = buildEffectiveView(tree);
const reservedKeys = allIncrementKeys();
const inventory = inventoryPcgen(tree);
const identities = assignPcgenIdentities({
  inventory,
  view,
  ledger: parseIdentityLedger(ledger, { reservedKeys }),
  books: pcgenBookFacts(await readPinned('pf1', 'module/registry/sources.mjs')),
  reservedKeys,
});
const { mapPublishedArchetype } = bindArchetypeMapper({
  tree,
  view,
  identities,
});
// The Unchained Monk's reviewed schedule is named "Monk (Unchained)".
const map = (archetype: string) =>
  mapPublishedArchetype({
    className: readInventoryClass({ inventory, archetype }).replace(
      /^Unchained (.+)$/,
      '$1 (Unchained)',
    ),
    archetype,
  });
const itemsOf = (mapping: ArchetypeMapping, prefix: string) =>
  mapping.items
    .filter(({ id }) => id.startsWith(prefix))
    .map(({ kind, id }) => [kind, id]);

describe('a removed feature the archetype’s text says it alters (altersText)', () => {
  it('raises altersText:rage for the Savage Technologist, whose own Rage “alters rage”', () => {
    // tg_abilities_class.lst:11 removes rage whole (TYPE BarbarianRage);
    // :44, Savage Technologist ~ Rage: "This ability alters rage."
    const mapping = map('Barbarian Archetype ~ Savage Technologist');
    expect(itemsOf(mapping, 'altersText')).toEqual([
      ['unmatchedReplacement', 'altersText:rage'],
    ]);
    const [item] = mapping.items.filter(({ id }) => id === 'altersText:rage');
    expect(item?.text).toContain('This ability alters rage.');
    expect(item?.text).toContain('Savage Technologist ~ Rage');
    expect(item?.fields).toEqual(['detail.replaces']);
  });

  it('attributes only the features a sentence alters, not those it goes on to replace', () => {
    // ui_abilities_class.lst:587, Gray Paladin ~ Weakened Grace: "This
    // ability alters smite evil, aura of courage, aura of resolve, and aura
    // of righteousness, and it replaces aura of good and divine grace."
    const ids = itemsOf(
      map('Paladin Archetype ~ Gray Paladin'),
      'altersText',
    ).map(([, id]) => id);
    expect(ids).toContain('altersText:smite-evil');
    expect(ids).not.toContain('altersText:aura-of-good');
    expect(ids).not.toContain('altersText:divine-grace');
  });

  it('raises altersText:bonus-feats for the Armiger, whose numbered flags remove every Bonus Feat row', () => {
    // ag_abilities_class.lst: Fighter_CF_BonusFeat1 … BonusFeat20, all
    // eleven rows, and no whole flag; :845, Armiger ~ Bonus Feats: "This
    // alters the fighter's bonus feats." No base row survives to carry it.
    const mapping = map('Fighter Archetype ~ Armiger');
    expect(itemsOf(mapping, 'altersText')).toEqual([
      ['unmatchedReplacement', 'altersText:bonus-feats'],
    ]);
    const [item] = mapping.items.filter(
      ({ id }) => id === 'altersText:bonus-feats',
    );
    expect(item?.text).toContain("This alters the fighter's bonus feats.");
  });

  it('raises altersText:weapon-training for the Tribal Fighter, whose numbered flags remove all four Weapon Training rows', () => {
    // uw_abilities_class.lst: Fighter_CF_WeaponTraining1 … 4; :590, Tribal
    // Fighter ~ Tribal Weapon Training: "This alters weapon training."
    expect(
      itemsOf(map('Fighter Archetype ~ Tribal Fighter'), 'altersText'),
    ).toEqual([['unmatchedReplacement', 'altersText:weapon-training']]);
  });

  it('raises an item naming a sentence it can attribute to no feature, never nothing', () => {
    // A Karmic Monk's Alignment: "This alters the monk's alignment
    // requirement." The monk's schedule has no alignment row. (Its 16th-level
    // feature "replaces slow fall 80 feet, and alters slow fall at 19th
    // level": the alteration is of the slow fall it keeps, and raises none.)
    expect(itemsOf(map('Monk Archetype ~ Karmic Monk'), 'altersText')).toEqual([
      ['unmatchedReplacement', 'altersText:sentence:Karmic Monk ~ Alignment#2'],
    ]);
  });

  it('reads proficiencies as prose: “alters the monk’s weapon and armor proficiencies” raises nothing', () => {
    // uc_abilities_class.lst, Sohei ~ Weapon and Armor Proficiency; plan §4.
    expect(itemsOf(map('Monk Archetype ~ Sohei'), 'altersText')).toEqual([]);
  });
});

describe('what an alters sentence is attributed to (AltersAttribution)', () => {
  it('is one of: features, a non-row part, or nothing it can attribute', () => {
    const rage = reviewedSchedule('Barbarian')?.features[0];
    if (!rage) throw new Error('No Barbarian schedule.');
    const legal: AltersAttribution[] = [
      { kind: 'features', features: [rage] },
      { kind: 'nonRow', subject: 'casting' },
      { kind: 'unattributed' },
    ];
    const both: AltersAttribution = {
      kind: 'features',
      features: [rage],
      // @ts-expect-error Features and a non-row part are never both the subject.
      subject: 'casting',
    };
    // @ts-expect-error A feature attribution names at least one feature.
    const none: AltersAttribution = { kind: 'features', features: [] };
    // @ts-expect-error A non-row attribution names its part.
    const bare: AltersAttribution = { kind: 'nonRow' };
    expect([...legal, both, none, bare]).toHaveLength(6);
  });
});

describe('what a sentence’s replaces clause says (ReplacesReading)', () => {
  it('is no list, a list left to a choice, or a list naming what it replaces: never a choice or a back-reference without its list', () => {
    const list = { start: 14, end: 19 };
    const legal: ReplacesReading[] = [
      { kind: 'none' },
      { kind: 'choice', list, replaced: new Set() },
      {
        kind: 'named',
        list,
        replaced: new Set(['rage']),
        referredTo: undefined,
      },
      {
        kind: 'named',
        list,
        replaced: new Set(),
        referredTo: { features: new Set(['quarry']), named: true },
      },
    ];
    // @ts-expect-error A choice is read from the list it leaves to a choice.
    const choice: ReplacesReading = { kind: 'choice', replaced: new Set() };
    const named: ReplacesReading = {
      kind: 'none',
      // @ts-expect-error A back-reference is read from a replaces list.
      referredTo: { features: new Set(['quarry']), named: true },
    };
    // @ts-expect-error A list's features are read from that list.
    const bare: ReplacesReading = { kind: 'named', replaced: new Set() };
    expect([...legal, choice, named, bare]).toHaveLength(7);
  });
});

describe('a feature the archetype’s text replaces and its flags keep (textReplaces)', () => {
  it('raises textReplaces for each feature the Tetori’s Inescapable Grasp replaces but no flag removes', () => {
    // uc_abilities_class.lst:1402: "This ability replaces abundant step,
    // improved evasion, timeless body, and tongue of sun and moon."; the
    // archetype's .MOD line (:1921) removes bonus feats, flurry of blows,
    // slow fall, high jump, empty body and diamond soul only.
    const mapping = map('Monk Archetype ~ Tetori');
    // In schedule order: improved evasion at 9, abundant step at 12.
    expect(itemsOf(mapping, 'textReplaces')).toEqual([
      ['unmatchedReplacement', 'textReplaces:improved-evasion'],
      ['unmatchedReplacement', 'textReplaces:abundant-step'],
      ['unmatchedReplacement', 'textReplaces:timeless-body'],
      ['unmatchedReplacement', 'textReplaces:tongue-of-the-sun-and-moon'],
    ]);
    const item = mapping.items.find(
      ({ id }) => id === 'textReplaces:improved-evasion',
    );
    expect(item?.text).toContain('Tetori ~ Inescapable Grasp');
    expect(item?.fields).toEqual(['detail.replaces', 'detail.featureChanges']);
    // Evasion, inside "improved evasion", is not named.
    expect(itemsOf(mapping, 'textReplaces:evasion')).toEqual([]);
  });
});

describe('a replacement the text makes that the detector can’t attribute to one feature (textReplaces:sentence)', () => {
  it('raises it for the Black Asp’s exchange of whichever monk ability the player gives up', () => {
    // ui_abilities_class.lst:536, Black Asp ~ Forbidden Powers: "If he
    // chooses to do so, he replaces the monk class ability the black asp
    // gives up for the chosen forbidden ki power." The flags (:531) remove
    // all eleven rows whole; the text exchanges only those the player picks.
    const mapping = map('Monk Archetype ~ Black Asp');
    expect(itemsOf(mapping, 'textReplaces')).toEqual([
      [
        'unmatchedReplacement',
        'textReplaces:sentence:Black Asp ~ Forbidden Powers#2',
      ],
    ]);
    const [item] = mapping.items.filter(({ id }) =>
      id.startsWith('textReplaces:sentence:'),
    );
    expect(item?.text).toContain(
      'he replaces the monk class ability the black asp gives up for the chosen forbidden ki power.',
    );
    expect(item?.text).toContain('(ui_abilities_class.lst:536)');
    expect(item?.fields).toEqual(['detail.replaces', 'detail.featureChanges']);
  });

  it('raises it for the Unchained Black Asp’s optional exchange', () => {
    // support/ui_abilities_class_pu.lst:19: "If he chooses to do so, he
    // replaces the tongue of the sun and moon for the chosen forbidden ki
    // power."
    expect(
      itemsOf(map('Unchained Monk Archetype ~ Black Asp'), 'textReplaces'),
    ).toEqual([
      [
        'unmatchedReplacement',
        'textReplaces:sentence:Black Asp ~ Unchained Forbidden Powers#2',
      ],
    ]);
  });

  it('raises it for each of the Hidden Priest’s replacements of one of two domain powers, her choice', () => {
    // ism_abilities_class.lst:191-192: "This ability replaces one of the
    // cleric's two 1st-level domain powers (her choice)." and "… two
    // 8th-level domain powers (his choice)."; the mapper removes Domains
    // whole (TYPE ClericDomains, :185).
    expect(
      itemsOf(map('Cleric Archetype ~ Hidden Priest'), 'textReplaces'),
    ).toEqual([
      [
        'unmatchedReplacement',
        'textReplaces:sentence:Hidden Priest ~ False Arcanist#4',
      ],
      [
        'unmatchedReplacement',
        'textReplaces:sentence:Hidden Priest ~ Unseen Devotion#3',
      ],
    ]);
  });
});

describe('what a replaces sentence names, read before it raises a sentence item', () => {
  it('reads “replaces that ability” as what the sentence named before it: Tanglebriar Demonslayer’s quarry', () => {
    // isc_abilities_class.lst, Tanglebriar Demonslayer ~ Fiendish Quarry:
    // "This ability is otherwise identical to quarry and replaces that
    // ability." The flags remove only endurance (3).
    expect(
      itemsOf(
        map('Ranger Archetype ~ Tanglebriar Demonslayer'),
        'textReplaces',
      ),
    ).toEqual([
      ['unmatchedReplacement', 'textReplaces:quarry'],
      ['unmatchedReplacement', 'textReplaces:improved-quarry'],
    ]);
  });

  it.each([
    // uc_abilities_class.lst, Warden ~ Able Explorer: "replaces the ranger's
    // second, third, and fourth favored enemies" (a final y read as ies).
    'Ranger Archetype ~ Warden',
    // oa_abilities_class.lst, Phrenologist: "This ability replaces
    // jack-of-all-trades." (a hyphenated name).
    'Bard Archetype ~ Phrenologist',
    // uc_abilities_class.lst, Dragoon ~ Skilled Rider: "This ability
    // replaces the 1st-level fighter bonus combat feat." (Bonus Feat, its
    // words a word apart, which the flags remove).
    'Fighter Archetype ~ Dragoon',
    // arg_abilities_class.lst, Ancient Lorekeeper ~ Class Skills: "This
    // replaces the bonus skills the ancient lorekeeper gains from her
    // mystery." (class skills, which the archetype records changing).
    'Oracle Archetype ~ Ancient Lorekeeper',
    // apg_abilities_class.lst, Urban Druid: "This ability replaces the
    // ability to spontaneously cast summon nature's ally spells." (casting,
    // whose Spontaneous Casting row the flags already touch).
    'Druid Archetype ~ Urban Druid',
    // uc_abilities_class.lst, Dervish Dancer ~ Leaf on the Wind: "This
    // ability replaces frightening performance." No row is named so; the
    // feature comes at 14th, where the flags remove Frightening Tune.
    'Bard Archetype ~ Dervish Dancer',
    // dep_abilities_class.lst:28, Samurai Sword Saint ~ Brutal Slash: "This
    // ability replaces mounted charge." No samurai row is named so; the
    // record's own TYPE tag SamuraiMountedArcher names Mounted Archer, which
    // the flags remove (:16).
    'Samurai Archetype ~ Sword Saint',
  ])(
    'raises no sentence item where the sentence names what the flags change: %s',
    (archetype) => {
      expect(
        map(archetype).items.filter(({ id }) =>
          /^textReplaces:(?:sentence|casting|classSkills)/.test(id),
        ),
      ).toEqual([]);
    },
  );
});

describe('archetypes whose text agrees with the mapper gain no item', () => {
  it.each([
    // "replaces evasion", "replaces improved evasion", "replaces tongue of
    // the sun and the moon": each a feature the flags remove.
    'Monk Archetype ~ Monk of the Sacred Mountain',
    // "replaces the rage powers gained at 2nd, 6th, …" names Rage Powers,
    // not Rage; every replaced feature is removed.
    'Barbarian Archetype ~ Mad Dog',
    // "This ability alters the normal domain ability." names Domains, which
    // the archetype keeps (no replacement to confirm), and "replaces the
    // increase to channel energy gained at 3rd level" a part it removes.
    'Cleric Archetype ~ Ecclesitheurge',
  ])('%s', (archetype) => {
    const mapping = map(archetype);
    expect(itemsOf(mapping, 'altersText')).toEqual([]);
    expect(itemsOf(mapping, 'textReplaces')).toEqual([]);
  });
});

describe('sentences that do not disagree with the mapper raise no item (round 1’s false positives)', () => {
  const textItems = (archetype: string) =>
    itemsOf(map(archetype), 'altersText').concat(
      itemsOf(map(archetype), 'textReplaces'),
    );

  it('ends a replaces list at the next verb: Blood Conduit replaces fast movement and alters bloodline feats', () => {
    // acg_abilities_class.lst:2725, Blood Conduit ~ Contact Specialist:
    // "This ability replaces fast movement and alters bloodline feats." The
    // archetype keeps its bloodline feats; only fast movement is replaced.
    expect(textItems('Bloodrager Archetype ~ Blood Conduit')).toEqual([]);
  });

  it.each([
    // magtt_abilities_class.lst:40, Bloodline Mutation ~ Blood Intensity:
    // "This otherwise functions as -and does not stack with- the
    // Intensified Spell (UM) feat." A feat, no casting change.
    'Sorcerer Archetype ~ Blood Intensity',
    'Bloodrager Archetype ~ Blood Intensity',
    // magtt_abilities_class.lst:76, Drovier ~ Communal Aspect: "This
    // otherwise functions like the spell greater animal aspect (UC), …"
    'Druid Archetype ~ Drovier',
    // acg_abilities_class.lst:4026, Hex Channeler ~ Channel Energy: "This
    // otherwise functions as a cleric using channel energy, …"
    'Witch Archetype ~ Hex Channeler',
    // acg_abilities_class.lst:3524, Holy Guide ~ Favored Terrain: "This
    // otherwise functions like the ranger ability of the same name."
    'Paladin Archetype ~ Holy Guide',
  ])(
    'reads a “works like” comparison to no feature of the class as describing a new ability: %s',
    (archetype) => {
      expect(textItems(archetype)).toEqual([]);
    },
  );

  it('keeps Empyreal Knight’s Divine Bond and drops Celestial Heart’s comparison to a spell', () => {
    // uc_abilities_class.lst:1465: "…otherwise functions as the paladin
    // ability of the same name." (Divine Bond, removed whole: a real
    // disagreement); :1463, Celestial Heart: "It otherwise functions as a
    // magic circle against evil." (a spell: a new ability).
    expect(textItems('Paladin Archetype ~ Empyreal Knight')).toEqual([
      ['unmatchedReplacement', 'altersText:divine-bond'],
    ]);
  });

  it('reads a feature named after an option’s own name as that option, not the feature: “the greater mutagen discovery”', () => {
    // arg_abilities_class.lst:220, Bramble Brewer ~ Dendrite Mutagen: "This
    // otherwise works like the greater mutagen discovery and replaces that
    // ability." A discovery the alchemist may select, not the Discovery row.
    expect(
      itemsOf(
        map('Alchemist Archetype ~ Bramble Brewer'),
        'altersText:discovery',
      ),
    ).toEqual([]);
  });

  it('reads an alteration of a feature the same sentence partly replaces as one of the parts it keeps', () => {
    // ui_abilities_class.lst, Sentinel: "This ability replaces the combat
    // style feat gained at 6th level and alters combat style feats." The
    // flags remove the 6th-level part; the others are kept, as the text says.
    expect(
      itemsOf(
        map('Ranger Archetype ~ Sentinel'),
        'altersText:combat-style-feat',
      ),
    ).toEqual([]);
  });

  it('reads “functions as normal for a monk of her level” as the holder’s feature, not an unnamed one', () => {
    // isc_abilities_class.lst, Hamatulatsu Master ~ Ki Pool and ~ Stunning
    // Fist: "This ability otherwise functions as normal for a monk of her
    // level." The flags only mark ki pool and stunning fist touched.
    expect(
      itemsOf(map('Monk Archetype ~ Hamatulatsu Master'), 'altersText'),
    ).toEqual([]);
  });

  it('raises a sentence item for a comparison with the class’s own feature it can’t name', () => {
    // arg_abilities_class.lst, Wave Warden ~ Aquatic Prowess Feat: "This
    // ability otherwise functions like and replaces the standard ranger's
    // combat style bonus feats, …"; the schedule's row is Combat Style Feat.
    expect(
      itemsOf(map('Ranger Archetype ~ Wave Warden'), 'altersText'),
    ).toEqual([
      [
        'unmatchedReplacement',
        'altersText:sentence:Wave Warden ~ Aquatic Prowess Feat#6',
      ],
    ]);
  });

  it('reads an alteration of a feature the flags only partly remove as one of the rows they keep', () => {
    // acg_abilities_class.lst, Mountain Witch: "…can select hexes from the
    // shaman's stone spirit … This ability alters hex." The flags remove the
    // 2nd-level hex only; the other hex rows carry the alteration. Its
    // patron spells, which the text replaces in part and the flags keep,
    // still raise their item.
    const mapping = map('Witch Archetype ~ Mountain Witch');
    expect(itemsOf(mapping, 'altersText')).toEqual([]);
    expect(itemsOf(mapping, 'textReplaces')).toEqual([
      ['unmatchedReplacement', 'textReplaces:patron-spells'],
    ]);
  });

  it('reads a feature named for the class by its noun alone: Gingerbread Witch’s “alters familiar” is the Witch’s Familiar the flags mark touched', () => {
    // ha_abilities_class.lst:270, Gingerbread Witch ~ Gingerbread Familiar:
    // "This ability alters familiar."; the archetype's FACT:
    // Witch_Archetype_Familiar (:266) marks Witch's Familiar touched, whose
    // alters: item already says so.
    const mapping = map('Witch Archetype ~ Gingerbread Witch');
    expect(itemsOf(mapping, 'altersText')).toEqual([]);
    expect(itemsOf(mapping, 'alters:')).toEqual([
      ['unmatchedReplacement', 'alters:witchs-familiar'],
    ]);
  });

  it('gives a name without the class’s possessive no such reading: Speaker of the Palatine Eye’s “alters spells” stays casting, not the Bard Spells row', () => {
    // heog_abilities_class.lst:25, Speaker of the Palatine Eye ~ Spells:
    // "This alters spells."; the flags touch no casting row.
    expect(
      itemsOf(
        map('Bard Archetype ~ Speaker of the Palatine Eye'),
        'altersText',
      ),
    ).toEqual([['uncheckedCasting', 'altersText:casting']]);
  });

  it('ends a replaces list at “for”: the Unchained Black Asp’s chosen ki power is not what it replaces', () => {
    // support/ui_abilities_class_pu.lst:19: "If he chooses to do so, he
    // replaces the tongue of the sun and moon for the chosen forbidden ki
    // power."
    expect(
      itemsOf(
        map('Unchained Monk Archetype ~ Black Asp'),
        'textReplaces:ki-powers',
      ),
    ).toEqual([]);
  });

  it('reads “spell” in “bonus school spell slots” as part of another name, not the Spells row', () => {
    // Sword Binder: "This ability replaces arcane school and bonus school
    // spell slots."
    expect(
      itemsOf(map('Wizard Archetype ~ Sword Binder'), 'textReplaces:spells'),
    ).toEqual([]);
  });
});

describe('an archetype’s description as its DESC tokens read (descOf)', () => {
  const featureText = (archetype: string, name: string) =>
    map(archetype).features.find(({ entry }) => entry.name === name)?.entry
      .description;

  it('reads %% as a literal %: Jungle Rager’s miss chance is 5%', () => {
    // isc_abilities_class.lst:134: "…attacks against her by 5%%."
    const text = featureText(
      'Barbarian Archetype ~ Jungle Rager',
      'Home Ground Advantage',
    );
    expect(text).toContain('for attacks against her by 5%. This ability');
    expect(text).not.toContain('%%');
  });

  it('reads %% as a literal %: a Herald Squire’s overland journeys increase by 20%', () => {
    // kotis_abilities_class.lst:13: "…can travel each day increases by 20%%."
    expect(
      featureText('Cavalier Archetype ~ Herald Squire', 'Fleet of Foot'),
    ).toContain('can travel each day increases by 20%. This ability');
  });

  it('keeps a real token: Draconic Fury’s %1 rounds stays a token', () => {
    // lod_abilities_class.lst:281: "…damage for %1 rounds.|MonkLVL/2"
    expect(
      featureText('Monk Archetype ~ Scaled Fist', 'Draconic Fury'),
    ).toContain('damage for %1 rounds.');
  });

  it('drops an exact repeat of a DESC body: the Bloodrider’s .MOD line repeats its DESC', () => {
    // acg_abilities_class.lst:2709's DESC, repeated by its .MOD line (:4618).
    const record = tree.archetypes.find(
      ({ locator }) => locator.key === 'Bloodrager Archetype ~ Bloodrider',
    );
    const body = record?.tokens
      .find((token) => token.startsWith('DESC:'))
      ?.slice('DESC:'.length)
      .trim();
    expect(body).toBeTruthy();
    expect(
      map('Bloodrager Archetype ~ Bloodrider').subject.entry.description,
    ).toBe(body);
  });
});

describe('an Internal grant with spell levels, emitted as an owned feature (the oath spells)', () => {
  const oathSpells =
    'pcgen:roleplaying_game/ultimate_magic/um_abilities_class.lst#Oath of Vengeance ~ Oath Spells';

  it('emits Oath of Vengeance’s Oath Spells as a feature it owns, with no description invented', () => {
    // um_abilities_class.lst:1529 grants ABILITY:Internal|AUTOMATIC|Oath of
    // Vengeance ~ Oath Spells; its record (:1599) holds four SPELLLEVEL
    // tokens and no DESC.
    const mapping = map('Paladin Archetype ~ Oath of Vengeance');
    const feature = mapping.features.find(
      ({ locator }) => locator === oathSpells,
    );
    expect(feature?.entry).toMatchObject({
      name: 'Oath of Vengeance ~ Oath Spells',
      detail: { kind: 'classFeature' },
      description: '',
    });
    expect(mapping.ownedFeatures.map(({ locator }) => locator)).toContain(
      oathSpells,
    );
    const detail = mapping.subject.entry.detail;
    expect(detail.kind === 'archetype' ? detail.adds : []).toContainEqual({
      classLevel: 1,
      externalKey: feature?.entry.externalKey,
    });
  });

  it('holds the archetype on a casting-contract item naming its spell levels', () => {
    const mapping = map('Paladin Archetype ~ Oath of Vengeance');
    expect(itemsOf(mapping, 'castingContract')).toEqual([
      ['uncheckedCasting', 'castingContract:Oath of Vengeance ~ Oath Spells'],
    ]);
    const item = mapping.items.find(({ id }) =>
      id.startsWith('castingContract'),
    );
    expect(item?.fields).toEqual(['detail.casting.spellList.add']);
    for (const level of [
      'Paladin=1|Wrath',
      'Paladin=2|Confess',
      'Paladin=3|Blessing of Fervor',
      "Paladin=4|Order's Wrath",
    ])
      expect(item?.text).toContain(level);
    expect(item?.text).toContain('um_abilities_class.lst:1599');
  });
});

describe('spell-level grants: emission and the identity assignment resolve them alike', () => {
  it.each([
    'Paladin Archetype ~ Oath of Vengeance',
    'Paladin Archetype ~ Oath of Charity',
    'Antipaladin Archetype ~ Tyrant',
  ])('%s owns exactly the records spellLevelGrantsOf finds', (archetype) => {
    const record = tree.archetypes.find(
      ({ locator }) => locator.key === archetype,
    );
    const effective = record && view.records.get(record);
    if (!effective) throw new Error(`No ${archetype}.`);
    const found = spellLevelGrantsOf(effective, view).map(
      ({ record: grant }) => `pcgen:${grant.locator.file}#${grant.locator.key}`,
    );
    expect(found).not.toEqual([]);
    const mapping = map(archetype);
    const owned = new Set(mapping.ownedFeatures.map(({ locator }) => locator));
    for (const locator of found) expect(owned).toContain(locator);
    // One casting-contract item per spell-level record the mapper emits.
    expect(itemsOf(mapping, 'castingContract')).toHaveLength(found.length);
  });
});

describe('the Tyrant’s class skills record, which also holds spell levels', () => {
  it('is owned but no addition: its class skills are read, its spell levels held on a casting-contract item', () => {
    // ui_abilities_class.lst:212, Tyrant ~ Class Skills: CATEGORY Internal,
    // CSKILL:Bluff|…|Stealth and SPELLLEVEL:CLASS|Antipaladin=1|Protection
    // from Chaos|…|Antipaladin=4|Dispel Chaos. A class skills record is no
    // row on the sheet; the class skills come from its CSKILL list.
    const mapping = map('Antipaladin Archetype ~ Tyrant');
    const classSkills = mapping.ownedFeatures.find(({ locator }) =>
      locator.endsWith('#Tyrant ~ Class Skills'),
    );
    expect(classSkills).toBeDefined();
    const detail = mapping.subject.entry.detail;
    if (detail.kind !== 'archetype') throw new Error('Not an archetype.');
    expect(detail.adds.map(({ externalKey }) => externalKey)).not.toContain(
      classSkills?.externalKey,
    );
    // New against the antipaladin's own list: Diplomacy.
    expect(detail.classSkillsAdded).toEqual(['skill.dip']);
    expect(itemsOf(mapping, 'castingContract')).toEqual([
      ['uncheckedCasting', 'castingContract:Tyrant ~ Class Skills'],
    ]);
  });
});

describe('a grant the import neither emits nor reads (unemittedGrant)', () => {
  const unemitted = (archetype: string) =>
    map(archetype).items.filter(({ id }) => id.startsWith('unemittedGrant:'));

  it('raises it for the Scaled Fist’s energy type, an ability pool, naming the key and the token', () => {
    // lod_abilities_class.lst:280: "Scaled Fist Energy", KEY, CATEGORY:Internal
    // and BONUS:ABILITYPOOL|Scaled Fist Associated Element|1, the choice
    // Draconic Fury's and Draconic Breath's conditioned DESC fragments read.
    const [item, ...rest] = unemitted('Monk Archetype ~ Scaled Fist');
    expect(rest).toEqual([]);
    expect(item).toMatchObject({
      kind: 'unmatchedReplacement',
      id: 'unemittedGrant:Scaled Fist ~ Energy Type',
      // The name, KEY and CATEGORY tokens are inert and not named.
      text: 'The archetype grants Internal|Scaled Fist ~ Energy Type (lod_abilities_class.lst:280), which the import neither emits nor reads: BONUS:ABILITYPOOL|Scaled Fist Associated Element|1.',
    });
  });

  it('raises one per Words of Power word grant, naming its pools and spells known', () => {
    // um_abilities_wordsofpower.lst:44-63, WOP Bard 1 to 20.
    const items = unemitted('Bard Archetype ~ Words of Power');
    expect(items.map(({ id }) => id)).toEqual(
      Array.from({ length: 20 }, (_, i) => `unemittedGrant:WOP Bard ${i + 1}`),
    );
    expect(items[3]?.text).toBe(
      'The archetype grants Internal|WOP Bard 4 (um_abilities_wordsofpower.lst:47), which the import neither emits nor reads: BONUS:ABILITYPOOL|2nd-Level Bard Word|2 BONUS:SPELLKNOWN|CLASS=Bard;LEVEL=2|-2.',
    );
  });

  it('raises it for an oracle’s bonus spells (SPELLKNOWN)', () => {
    const [item] = unemitted('Oracle Archetype ~ Keleshite Prophet');
    expect(item?.id).toBe('unemittedGrant:Keleshite Prophet ~ Bonus Spells');
    expect(item?.text).toContain('(isi_abilities_class.lst:208)');
    expect(item?.text).toContain(
      'SPELLKNOWN:CLASS|Oracle=3|Clairaudience/Clairvoyance|PRECLASS:1,Oracle=6',
    );
  });

  it('raises it for a granted feat', () => {
    expect(unemitted('Bard Archetype ~ Studious Librarian')).toMatchObject([
      {
        id: 'unemittedGrant:Studious Librarian ~ Scribe Scroll',
        text: 'The archetype grants Internal|Studious Librarian ~ Scribe Scroll (isi_abilities_class.lst:34), which the import neither emits nor reads: ABILITY:FEAT|AUTOMATIC|Scribe Scroll.',
      },
    ]);
  });

  it('raises it for an Internal proficiency grant', () => {
    expect(unemitted('Druid Archetype ~ Survivor')).toMatchObject([
      {
        id: 'unemittedGrant:Survivor ~ Weapon Proficiencies',
        text: 'The archetype grants Internal|Survivor ~ Weapon Proficiencies (cob_abilities_class.lst:47), which the import neither emits nor reads: AUTO:WEAPONPROF|Longbow|Shortbow.',
      },
    ]);
  });

  it('raises nothing for a grant the import reads: a class skill list (CSKILL) or skill ranks (BONUS:SKILLPOINTS)', () => {
    // isi_abilities_class.lst:106, Royal Accuser ~ Class Skills: TYPE and
    // CSKILL; ui_abilities_class.lst:994, Cabalist ~ Skill Ranks per Level:
    // TYPE and BONUS:SKILLPOINTS|NUMBER|-2.
    const accuser = map('Inquisitor Archetype ~ Royal Accuser');
    const cabalist = map('Vigilante Archetype ~ Cabalist');
    // Both grants are read: the class skills change and the skill ranks.
    expect(accuser.subject.entry.detail).toMatchObject({
      changesClassSkills: true,
    });
    expect(cabalist.subject.entry.detail).toMatchObject({
      skillRanksPerLevel: 4,
    });
    for (const { items } of [accuser, cabalist])
      expect(
        items.filter(({ id }) => id.startsWith('unemittedGrant:')),
      ).toEqual([]);
  });

  it('raises nothing for a grant it emits: Oath of Vengeance’s Oath Spells is an owned feature', () => {
    expect(unemitted('Paladin Archetype ~ Oath of Vengeance')).toEqual([]);
  });
});
