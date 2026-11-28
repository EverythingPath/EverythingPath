// pbl-released-spells-1 (PRD #251): the keys of the Spells the spell batch
// tests look up by name, as committed data, by batch and then by the name
// each batch test used; and the keys of the spellcasting classes a Spell's
// class levels name. The spell tests import these keys with
// importReleasedEntries; nothing here reads a batch directory.

/**
 * Per spell batch, the Spells its tests name, by name. A lookup checks that
 * the imported entry carries that name (`released-spell-sheet.ts`).
 */
export const spellBatches = {
  'spells-516': {
    "Bull's Strength": 'pf1/05i5rxwim12hwktu',
    'Protection from Spells': 'pf1/0kppkhsencd6tzvh',
    'Divine Power': 'pf1/0yvwyclhkf76veo1',
  },
  'spells-517': {
    'Divine Favor': 'pf1/21bxbzdaawjrnvyo',
    Blur: 'pf1/18kryvj2dfuymk9d',
    'Protection from Energy': 'pf1/1vh2ewwvzvxunoxk',
    Virtue: 'pf1/22x4iooz3c3vqof9',
    'Bouncy Body': 'pf1/1okm1u6ig4mws6ue',
    'Rite of Centered Mind': 'pf1/1p5efnjtbuf2qzb0',
    'Blessing of Courage and Life': 'pf1/272szq5d556toqgc',
    Penumbra: 'pf1/1glxo7x49axmlr9a',
    'Soothing Word': 'pf1/1zrd29ckubta8s8z',
    'Languid Venom': 'pf1/1rt2lg6tt2kms0z0',
  },
  'spells-518': {
    'Reduce Person': 'pf1/2y9e1l6zso9tdg0a',
    'Animal Growth': 'pf1/29cfi65seiajh5qv',
    'Shocking Grasp': 'pf1/33pe0bge7b7aq3io',
    Bane: 'pf1/3etxlex8u32g0hrx',
    'Thought Shield V': 'pf1/37ubwx82nqaog3ib',
    'Thought Shield IV': 'pf1/2p265l26tq5xh0f6',
    'Thought Worm III': 'pf1/3edtpx9oabq3oeeg',
    Drench: 'pf1/2cenpvloizn0by91',
    Command: 'pf1/2p6fzj5t03oivndd',
  },
  'spells-519': {
    'Magic Missile': 'pf1/49yc9dpr4kvgki2s',
    'False Life': 'pf1/3ze0kso9hxff5u2f',
    'Spider Climb': 'pf1/3mfmhx8avu7h3iom',
    'Spell Resistance': 'pf1/4k9bh8ny1il2oner',
    'Contagious Zeal': 'pf1/3wcvosazm31i8758',
    'Phantom Limb': 'pf1/48qaybvgr2faagte',
    'Titanic Anchoring': 'pf1/4gvcypqu5drxqkmd',
    'Hex Glyph, Greater': 'pf1/4fm4md4eux7sw6o0',
  },
  'spells-520': {
    'Keen Senses': 'pf1/54x9nw6ni4rpphcn',
    'Effortless Armor': 'pf1/5kaozniy9sjydygq',
    Heal: 'pf1/4re1j2w8wkvsvnsi',
    'Ego Whip IV': 'pf1/5n0xg47ruhamwkrq',
    Scoop: 'pf1/4nqhjbhtb3cdk4oq',
    'Interplanetary Teleport': 'pf1/4qriqew7d2ot7wr5',
    'Swallow Your Fear': 'pf1/4uzseabeqamqnmb6',
    'Litany of Duty': 'pf1/55jB63sBH4GLV5Mm',
    'Dazzling Blade, Mass': 'pf1/57knlirgsjn5qz93',
    "Badger's Ferocity": 'pf1/4rjud9uoofhbwhht',
  },
  'spells-521': {
    Blacklight: 'pf1/6s2Mrf0bRBHKArPe',
    'Fair is Foul': 'pf1/61pYmOmQJ2nMk2vL',
    Ascension: 'pf1/6hza06xvxah95k5u',
    'Speak with Plane': 'pf1/6rndjc976yelg14e',
    'Summon Ancestral Guardian': 'pf1/6l4stx2qxjq9pns7',
    'Symbol of Striking': 'pf1/68aup6droas2uyzj',
    'Thorn Javelin': 'pf1/6vx3lvbhp6h220wq',
    'Sure Casting': 'pf1/64awq5y3dtlhq9rr',
    Wrath: 'pf1/5zrqn8bj3jxm05pl',
    'Searching Shadows': 'pf1/6fgsmc5sln2a5bme',
    'Bloodstone Mirror': 'pf1/6cjfszctojrskwm0',
    'Magic Circle against Law': 'pf1/5z26gs6wrom5svdd',
    'Paragon Surge': 'pf1/5v3j49r4mdq9rbx6',
    'Tree Shape': 'pf1/6ho3wsspkqkhypt0',
    Fireball: 'pf1/6oq1wcryviik9ice',
    'Touch of Idiocy': 'pf1/648x72rflah0ggyz',
    'True Skill': 'pf1/6ci2v3ucadea8x9x',
    'Celestial Healing': 'pf1/6d6bgiakwmwiu7qv',
  },
  'spells-522': {
    "Fox's Cunning": 'pf1/743anqr1ahefv8zd',
    Fly: 'pf1/7d6sv5ecvi7kho3m',
    'Stunning Barrier': 'pf1/7vzu76eg8om0gpf0',
    'Remove Paralysis': 'pf1/7xdn59ffjaqchhrz',
    'Implant Urge': 'pf1/7461spd68dipa6m5',
    'Dream Voyage': 'pf1/759y8xzdg3unvt6s',
    'Overwhelming Poison': 'pf1/7dj9chib3qeyimdy',
    'Ooze Form III': 'pf1/7gfuexp9mi45zkut',
    'Fey Form III': 'pf1/7il67b57towi3o6w',
    'Thorn Body': 'pf1/818uuekrao87o57u',
    'Scouring Winds': 'pf1/7hakpmv7enojm4jg',
  },
  'spells-523': {
    'Bolt of Glory': 'pf1/81QcPhgRcHxjpScn',
    'Reveal True Shape': 'pf1/91IJiOMgUZ3edBV0',
    'Ego Whip V': 'pf1/8hskbv8e996jwmmj',
    'Hostile Levitation': 'pf1/8h84spdczbsi69gr',
    'Thought Worm IV': 'pf1/8myadlblry9uxrof',
    'Thought Shield II': 'pf1/8polm9nkg4jh3fpy',
    'Stone Fist': 'pf1/879sdozw7ca7ci9k',
    'Angelic Aspect': 'pf1/8jrtvmhydudy7fks',
    'Protection from Good, Communal': 'pf1/8kd54d2ho1fywj2u',
    'Suppress Charms and Compulsions': 'pf1/8237jjhtwfqje4n6',
    'Polar Ray': 'pf1/8jq1atxonnerix55',
    Rage: 'pf1/8u1xa5javcxc6szk',
  },
  'spells-524': {
    Transformation: 'pf1/9pbl3ktd5oqejl19',
    'Gird Ally': 'pf1/9vld5joaodkatmj3',
    'Natural Rhythm': 'pf1/9hnhezzzzrn985o7',
    'Wooden Wing Shield': 'pf1/HBdrFlsq2J8hfyDn',
    'Fey Boon': 'pf1/JYgzYISWlo5CQQg3',
    'Black Spot': 'pf1/9u7ebo95p6hmrb7p',
    'Fey Blight': 'pf1/H6qZ8QjVBWGyucTK',
  },
  'spells-525': {
    'Mighty Strength': 'pf1/ZzgreX1h0BOJAbDu',
    'Shock Shield': 'pf1/a6vrmpywwpg4dpwx',
    'Unliving Rage': 'pf1/aer23mbtykma1n1s',
    'Sense Vitals': 'pf1/aq0ch7ep4av2z214',
    "Owl's Wisdom": 'pf1/b9ggsagifzk4fwut',
    'Crown of Glory': 'pf1/av7YbbrWBVgNp2hP',
    Linebreaker: 'pf1/amrtqcyc53je6wbt',
    'Blade Lash': 'pf1/b3hyz4dnnkgw9nfu',
    'Tower of Iron Will V': 'pf1/ajtvhtntlkv3hpuk',
  },
  'spells-526': {
    'Boiling Blood': 'pf1/c9a27yvlb5mrow83',
    'Anchored Step': 'pf1/cdaib7n0z1tv1qpq',
    'Planned Assault': 'pf1/cXuzSqklJEBXhZqg',
    'Perceive Cues': 'pf1/brw5fsblcj8snqo2',
    'Mind Blank': 'pf1/blvetbc929cfx4m8',
    'Positive Pulse': 'pf1/bvvjjjidh2duqwta',
    'Anticipate Thoughts': 'pf1/bexxf2117rcr21g1',
  },
} as const satisfies Record<string, Record<string, string>>;

export type SpellBatch = keyof typeof spellBatches;

/**
 * The 28 spellcasting classes the batch trees carried, by class tag: the
 * importer resolves a Spell's class levels against the classes in the import
 * and reports a level whose tag no imported class has (`levels.<tag>` in
 * `unsupported`), so a test asserting class levels imports these with its
 * Spells.
 */
export const spellcastingClasses = {
  adept: 'pf1/5nxfoXZ5KpOFYpLm',
  alchemist: 'pf1/JcaqlAawhf14q1lq',
  antipaladin: 'pf1/uynVENa0deVdmf53',
  arcanist: 'pf1/GK6rAenFfgJNNJCX',
  bard: 'pf1/6GjOjO6r3R06fLwE',
  bloodrager: 'pf1/E27lMw9YNOAjS009',
  cleric: 'pf1/SjFqQceVeVBzBwgn',
  druid: 'pf1/7eZQP0MzeO2svmVF',
  hunter: 'pf1/Immo2BuSe5WGdRW9',
  inquisitor: 'pf1/Fv3FbmXptuDRiL5y',
  investigator: 'pf1/s27zdYVFenYBVtfu',
  magus: 'pf1/xZLcyrEKYZoJPS2k',
  medium: 'pf1/xtRbNEKYYq4cRiwI',
  mesmerist: 'pf1/fLU25FvuRWMCSxPP',
  occultist: 'pf1/5uUzVl0gLZ23vY96',
  oracle: 'pf1/5S0u8yFcP861wgd1',
  paladin: 'pf1/ohptcds1d5oG6Bjh',
  psychic: 'pf1/0ahLHNR2864mih3n',
  ranger: 'pf1/w3wjj6s3N69BsMc3',
  shaman: 'pf1/jMi3GBtvdG0WhH8L',
  skald: 'pf1/G2SqFdNKFxbujzbH',
  sorcerer: 'pf1/AoWSbnuTSGIxmv61',
  spiritualist: 'pf1/iYAQs7zjFbgcmect',
  summoner: 'pf1/BrnHPJ2EVSQSyNQ8',
  summonerUnchained: 'pf1/5iDrtRQMuIhLymUA',
  warpriest: 'pf1/KgxFsHNv0g1GbvmS',
  witch: 'pf1/RC4D4WFT5kRKkdqp',
  wizard: 'pf1/0c4lYDywj6bQ0i8r',
} as const;
