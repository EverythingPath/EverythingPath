// pbl-released-buffs (PRD #251): the rule-bearing fields the buff batch
// units' re-extraction compared with each batch preview (buffs-547.test.ts:618,
// pf-buffs-548.test.ts:679, pf-buffs-549.test.ts:750: every re-extracted
// entry's detail, Modifiers, Situational Notes and sources equal to its
// preview row), as committed data for the buffs the released buff tests
// name: per batch and name, the preview row's `detail` and `modifiers` whole
// and its Situational Notes without their text (`notes`, absent where the
// row had none). Book sources and Note text are left to the catalog digest
// (the released-kind tests carry rule-bearing fields only). Copied from the batch
// previews at 0a3d18d6; nothing here reads a batch directory.

export const buffRules = {
  'buffs-547': {
    'Accurate Stance': {
      detail: { kind: 'classFeature' },
      modifiers: [
        {
          target: 'attack.melee',
          bonusType: 'competence',
          value: { formula: '1 + floor(@classLevel.barbarianUnchained / 4)' },
        },
      ],
      notes: [{ target: 'attack.ranged' }],
    },
    Aid: {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/ibk7jrc5rwubpia6',
      },
      modifiers: [
        { target: 'attack', bonusType: 'morale', value: 1 },
        {
          target: 'saves',
          bonusType: 'morale',
          value: 1,
          condition: { situation: 'fear' },
        },
      ],
      notes: [{ target: 'hp' }],
    },
    Bane: {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/3etxlex8u32g0hrx',
      },
      modifiers: [
        { target: 'attack', bonusType: 'untyped', value: -1 },
        {
          target: 'saves',
          bonusType: 'untyped',
          value: -1,
          condition: { situation: 'fear' },
        },
      ],
    },
    Barkskin: {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 3,
        lastsOverOneDay: false,
        spellKey: 'pf1/la7kuehewu85ybnt',
      },
      modifiers: [
        {
          target: 'ac.natural',
          bonusType: 'enhancement',
          value: {
            formula: 'min(5, 2 + max(0, floor((@casterLevel - 3) / 3)))',
          },
        },
      ],
    },
    Bless: {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/wa0zb2pncesmm9lz',
      },
      modifiers: [
        { target: 'attack', bonusType: 'morale', value: 1 },
        {
          target: 'saves',
          bonusType: 'morale',
          value: 1,
          condition: { situation: 'fear' },
        },
      ],
    },
    "Bull's Strength": {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 3,
        lastsOverOneDay: false,
        spellKey: 'pf1/05i5rxwim12hwktu',
      },
      modifiers: [
        { target: 'ability.str', bonusType: 'enhancement', value: 4 },
      ],
    },
    'Calm Stance': {
      detail: { kind: 'classFeature' },
      modifiers: [
        { target: 'ac', bonusType: 'untyped', value: 2 },
        {
          target: 'attack.melee',
          bonusType: 'untyped',
          value: {
            formula:
              '0 - 2 - max(0, floor((@classLevel.barbarianUnchained - 2) / 9))',
          },
        },
        {
          target: 'damage.melee',
          bonusType: 'untyped',
          value: {
            formula:
              '0 - 2 - max(0, floor((@classLevel.barbarianUnchained - 2) / 9))',
          },
        },
        {
          target: 'save.will',
          bonusType: 'untyped',
          value: {
            formula:
              '0 - 2 - max(0, floor((@classLevel.barbarianUnchained - 2) / 9))',
          },
        },
        { target: 'ac', bonusType: 'untyped', value: 2 },
      ],
      notes: [{ target: 'skills' }, {}, {}],
    },
    'Dire Prophecy': {
      detail: { kind: 'classFeature' },
      modifiers: [
        { target: 'ac', bonusType: 'untyped', value: -4 },
        { target: 'skills', bonusType: 'untyped', value: -4 },
        { target: 'attack', bonusType: 'untyped', value: -4 },
        { target: 'saves', bonusType: 'untyped', value: -4 },
      ],
      notes: [{}],
    },
    'Divine Favor': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/21bxbzdaawjrnvyo',
      },
      modifiers: [
        {
          target: 'attack',
          bonusType: 'luck',
          value: { formula: 'min(3, max(1, floor(@casterLevel / 3)))' },
        },
        {
          target: 'damage',
          bonusType: 'luck',
          value: { formula: 'min(3, max(1, floor(@casterLevel / 3)))' },
        },
      ],
    },
    'Fighting Defensively': {
      detail: { kind: 'manual' },
      modifiers: [
        { target: 'attack', bonusType: 'untyped', value: -4 },
        {
          target: 'ac',
          bonusType: 'dodge',
          value: { formula: '2 + min(1, floor(@skillRanks.acr / 3))' },
        },
      ],
    },
    Fly: {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 5,
        lastsOverOneDay: false,
        spellKey: 'pf1/7d6sv5ecvi7kho3m',
      },
      modifiers: [
        {
          target: 'skill.fly',
          bonusType: 'untyped',
          value: { formula: '4 + floor(@casterLevel / 2)' },
        },
      ],
      notes: [{}],
    },
    'Guarded Stance': {
      detail: { kind: 'classFeature' },
      modifiers: [
        {
          target: 'ac',
          bonusType: 'dodge',
          value: { formula: '1 + floor(@classLevel.barbarianUnchained / 4)' },
        },
      ],
    },
    'Hard Light Shield': {
      detail: { kind: 'item', consumable: false, price: 0, weight: 0 },
      modifiers: [{ target: 'ac.shield', bonusType: 'shield', value: 2 }],
      notes: [{ target: 'ac' }],
    },
    Haste: {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 5,
        lastsOverOneDay: false,
        spellKey: 'pf1/s9amdo5398alb5p0',
      },
      modifiers: [
        { target: 'attack', bonusType: 'untyped', value: 1 },
        { target: 'ac', bonusType: 'dodge', value: 1 },
        { target: 'save.ref', bonusType: 'dodge', value: 1 },
      ],
      notes: [{}, {}],
    },
    'Heroism, Greater': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 11,
        lastsOverOneDay: false,
        spellKey: 'pf1/z0duc2v2n3ioynta',
      },
      modifiers: [
        { target: 'attack', bonusType: 'morale', value: 4 },
        { target: 'saves', bonusType: 'morale', value: 4 },
        { target: 'skills', bonusType: 'morale', value: 4 },
      ],
      notes: [{ target: 'saves' }, { target: 'hp' }],
    },
    'Inspire Courage': {
      detail: { kind: 'classFeature' },
      modifiers: [
        {
          target: 'attack',
          bonusType: 'competence',
          value: 1,
          condition: {
            situation: { local: 'inspire courage +1 (bard level 1-4)' },
          },
        },
        {
          target: 'damage',
          bonusType: 'competence',
          value: 1,
          condition: {
            situation: { local: 'inspire courage +1 (bard level 1-4)' },
          },
        },
        {
          target: 'saves',
          bonusType: 'morale',
          value: 1,
          condition: {
            situation: {
              local:
                'inspire courage +1 (bard level 1-4), vs. charm and fear effects',
            },
          },
        },
        {
          target: 'attack',
          bonusType: 'competence',
          value: 2,
          condition: {
            situation: { local: 'inspire courage +2 (bard level 5-10)' },
          },
        },
        {
          target: 'damage',
          bonusType: 'competence',
          value: 2,
          condition: {
            situation: { local: 'inspire courage +2 (bard level 5-10)' },
          },
        },
        {
          target: 'saves',
          bonusType: 'morale',
          value: 2,
          condition: {
            situation: {
              local:
                'inspire courage +2 (bard level 5-10), vs. charm and fear effects',
            },
          },
        },
        {
          target: 'attack',
          bonusType: 'competence',
          value: 3,
          condition: {
            situation: { local: 'inspire courage +3 (bard level 11-16)' },
          },
        },
        {
          target: 'damage',
          bonusType: 'competence',
          value: 3,
          condition: {
            situation: { local: 'inspire courage +3 (bard level 11-16)' },
          },
        },
        {
          target: 'saves',
          bonusType: 'morale',
          value: 3,
          condition: {
            situation: {
              local:
                'inspire courage +3 (bard level 11-16), vs. charm and fear effects',
            },
          },
        },
        {
          target: 'attack',
          bonusType: 'competence',
          value: 4,
          condition: {
            situation: { local: 'inspire courage +4 (bard level 17-20)' },
          },
        },
        {
          target: 'damage',
          bonusType: 'competence',
          value: 4,
          condition: {
            situation: { local: 'inspire courage +4 (bard level 17-20)' },
          },
        },
        {
          target: 'saves',
          bonusType: 'morale',
          value: 4,
          condition: {
            situation: {
              local:
                'inspire courage +4 (bard level 17-20), vs. charm and fear effects',
            },
          },
        },
      ],
    },
    'Knockdown Stance': {
      detail: { kind: 'classFeature' },
      modifiers: [],
      notes: [{ target: 'attack' }],
    },
    Magboots: {
      detail: { kind: 'item', consumable: false, price: 0, weight: 0 },
      modifiers: [
        {
          target: 'skill.clm',
          bonusType: 'circumstance',
          value: 10,
          condition: { situation: { local: 'while climbing metal surfaces' } },
        },
      ],
    },
    'Mage Armor': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/ucc0a31d1y86oleh',
      },
      modifiers: [{ target: 'ac.armor', bonusType: 'armor', value: 4 }],
      notes: [{ target: 'ac' }],
    },
    'Powerful Stance': {
      detail: { kind: 'classFeature' },
      modifiers: [
        {
          target: 'damage.melee',
          bonusType: 'untyped',
          value: { formula: '1 + floor(@classLevel.barbarianUnchained / 4)' },
        },
      ],
      notes: [{ target: 'damage.ranged' }],
    },
    'Prayer (Negative)': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 5,
        lastsOverOneDay: false,
        spellKey: 'pf1/hu8179fdqfkl0bqj',
      },
      modifiers: [
        { target: 'attack', bonusType: 'untyped', value: -1 },
        { target: 'damage', bonusType: 'untyped', value: -1 },
        { target: 'saves', bonusType: 'untyped', value: -1 },
        { target: 'skills', bonusType: 'untyped', value: -1 },
      ],
    },
    Rage: {
      detail: { kind: 'classFeature' },
      modifiers: [
        { target: 'ac', bonusType: 'untyped', value: -2 },
        {
          target: 'ability.str',
          bonusType: 'morale',
          value: {
            formula: '4 + 2 * max(0, floor((@classLevel.barbarian - 2) / 9))',
          },
        },
        {
          target: 'ability.con',
          bonusType: 'morale',
          value: {
            formula: '4 + 2 * max(0, floor((@classLevel.barbarian - 2) / 9))',
          },
        },
        {
          target: 'save.will',
          bonusType: 'morale',
          value: {
            formula: '2 + max(0, floor((@classLevel.barbarian - 2) / 9))',
          },
        },
      ],
      notes: [{ target: 'skills' }, {}],
    },
    'Rage (Unchained)': {
      detail: { kind: 'classFeature' },
      modifiers: [
        { target: 'ac', bonusType: 'untyped', value: -2 },
        {
          target: 'attack.melee',
          bonusType: 'untyped',
          value: {
            formula:
              '2 + max(0, floor((@classLevel.barbarianUnchained - 2) / 9))',
          },
        },
        {
          target: 'damage.melee',
          bonusType: 'untyped',
          value: {
            formula:
              '2 + max(0, floor((@classLevel.barbarianUnchained - 2) / 9))',
          },
        },
        {
          target: 'save.will',
          bonusType: 'untyped',
          value: {
            formula:
              '2 + max(0, floor((@classLevel.barbarianUnchained - 2) / 9))',
          },
        },
      ],
      notes: [
        { target: 'skills' },
        {},
        { target: 'damage.ranged' },
        { target: 'hp' },
      ],
    },
    'Reckless Stance': {
      detail: { kind: 'classFeature' },
      modifiers: [
        {
          target: 'attack',
          bonusType: 'untyped',
          value: { formula: '1 + floor(@classLevel.barbarianUnchained / 4)' },
        },
        {
          target: 'ac',
          bonusType: 'untyped',
          value: {
            formula: '0 - (1 + floor(@classLevel.barbarianUnchained / 4))',
          },
        },
      ],
    },
    Shield: {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/sz7j540uypmqqvti',
      },
      modifiers: [{ target: 'ac.shield', bonusType: 'shield', value: 4 }],
      notes: [{}, { target: 'ac' }],
    },
    'Shield of Faith': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/y2uhoqr4itdbw5g4',
      },
      modifiers: [
        {
          target: 'ac',
          bonusType: 'deflection',
          value: { formula: '2 + min(3, floor(@casterLevel / 6))' },
        },
      ],
    },
    Slow: {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 5,
        lastsOverOneDay: false,
        spellKey: 'pf1/jcr72piqo6g549e1',
      },
      modifiers: [
        { target: 'ac', bonusType: 'untyped', value: -1 },
        { target: 'attack', bonusType: 'untyped', value: -1 },
        { target: 'save.ref', bonusType: 'untyped', value: -1 },
      ],
      notes: [{}, {}],
    },
    'Strength Stance': {
      detail: { kind: 'classFeature' },
      modifiers: [
        {
          target: 'cmb',
          bonusType: 'competence',
          value: { formula: '1 + floor(@classLevel.barbarianUnchained / 4)' },
        },
        {
          target: 'cmd',
          bonusType: 'competence',
          value: { formula: '1 + floor(@classLevel.barbarianUnchained / 4)' },
        },
      ],
      notes: [{}],
    },
    'Total Defense': {
      detail: { kind: 'manual' },
      modifiers: [
        {
          target: 'ac',
          bonusType: 'dodge',
          value: { formula: '4 + 2 * min(1, floor(@skillRanks.acr / 3))' },
        },
      ],
      notes: [{}],
    },
    'Veemod (Black)': {
      detail: { kind: 'item', consumable: false, price: 0, weight: 0 },
      modifiers: [{ target: 'skill.per', bonusType: 'competence', value: 2 }],
    },
    'Veemod (Brown)': {
      detail: { kind: 'item', consumable: false, price: 0, weight: 0 },
      modifiers: [
        {
          target: 'saves',
          bonusType: 'circumstance',
          value: 1,
          condition: {
            situation: {
              local:
                'vs. bright light effects that cause dazzling or blindness',
            },
          },
        },
      ],
    },
    'Veemod (Green)': {
      detail: { kind: 'item', consumable: false, price: 0, weight: 0 },
      modifiers: [{ target: 'skill.per', bonusType: 'competence', value: 10 }],
    },
    'Veemod (Powered Armor)': {
      detail: { kind: 'item', consumable: false, price: 0, weight: 0 },
      modifiers: [{ target: 'skill.per', bonusType: 'competence', value: 10 }],
      notes: [{}, {}],
    },
    Ward: {
      detail: { kind: 'classFeature' },
      modifiers: [
        {
          target: 'ac',
          bonusType: 'deflection',
          value: 2,
          condition: { situation: { local: 'ward +2 (witch level 1-7)' } },
        },
        {
          target: 'saves',
          bonusType: 'resistance',
          value: 2,
          condition: { situation: { local: 'ward +2 (witch level 1-7)' } },
        },
        {
          target: 'ac',
          bonusType: 'deflection',
          value: 3,
          condition: { situation: { local: 'ward +3 (witch level 8-15)' } },
        },
        {
          target: 'saves',
          bonusType: 'resistance',
          value: 3,
          condition: { situation: { local: 'ward +3 (witch level 8-15)' } },
        },
        {
          target: 'ac',
          bonusType: 'deflection',
          value: 4,
          condition: { situation: { local: 'ward +4 (witch level 16-20)' } },
        },
        {
          target: 'saves',
          bonusType: 'resistance',
          value: 4,
          condition: { situation: { local: 'ward +4 (witch level 16-20)' } },
        },
      ],
      notes: [{}],
    },
  },
  'pf-buffs-548': {
    'Acute Senses': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 3,
        lastsOverOneDay: false,
        spellKey: 'pf1/f9adpo6szijchpva',
      },
      modifiers: [
        {
          target: 'skill.per',
          bonusType: 'enhancement',
          value: { formula: 'min(30, 10 + 10 * floor(@casterLevel / 8))' },
        },
      ],
    },
    'Animal Focus (Bear)': {
      detail: { kind: 'classFeature' },
      modifiers: [
        {
          target: 'ability.con',
          bonusType: 'enhancement',
          value: 2,
          condition: {
            situation: { local: 'animal focus (hunter level 1-7)' },
          },
        },
        {
          target: 'ability.con',
          bonusType: 'enhancement',
          value: 4,
          condition: {
            situation: { local: 'animal focus (hunter level 8-14)' },
          },
        },
        {
          target: 'ability.con',
          bonusType: 'enhancement',
          value: 6,
          condition: {
            situation: { local: 'animal focus (hunter level 15-20)' },
          },
        },
      ],
    },
    'Animal Focus (Falcon)': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 7,
        lastsOverOneDay: false,
      },
      modifiers: [
        {
          target: 'skill.per',
          bonusType: 'competence',
          value: 4,
          condition: {
            situation: { local: 'animal focus (hunter level 1-7)' },
          },
        },
        {
          target: 'skill.per',
          bonusType: 'competence',
          value: 6,
          condition: {
            situation: { local: 'animal focus (hunter level 8-14)' },
          },
        },
        {
          target: 'skill.per',
          bonusType: 'competence',
          value: 8,
          condition: {
            situation: { local: 'animal focus (hunter level 15-20)' },
          },
        },
      ],
    },
    'Animal Focus (Owl)': {
      detail: { kind: 'classFeature' },
      modifiers: [
        {
          target: 'skill.ste',
          bonusType: 'competence',
          value: 4,
          condition: {
            situation: { local: 'animal focus (hunter level 1-7)' },
          },
        },
        {
          target: 'skill.ste',
          bonusType: 'competence',
          value: 6,
          condition: {
            situation: { local: 'animal focus (hunter level 8-14)' },
          },
        },
        {
          target: 'skill.ste',
          bonusType: 'competence',
          value: 8,
          condition: {
            situation: { local: 'animal focus (hunter level 15-20)' },
          },
        },
      ],
    },
    'Aspect of the Bear': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 3,
        lastsOverOneDay: false,
        spellKey: 'pf1/ufo5z8s3u6ff45t0',
      },
      modifiers: [
        { target: 'ac.natural', bonusType: 'enhancement', value: 2 },
        { target: 'cmb', bonusType: 'enhancement', value: 2 },
      ],
      notes: [{ target: 'cmb' }],
    },
    'Aspect of the Wolf': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 9,
        lastsOverOneDay: false,
        spellKey: 'pf1/knjoprwzcm3jygwk',
      },
      modifiers: [
        { target: 'ability.str', bonusType: 'enhancement', value: 4 },
        { target: 'ability.dex', bonusType: 'enhancement', value: 4 },
        {
          target: 'cmb',
          bonusType: 'enhancement',
          value: 2,
          condition: { situation: 'trip' },
        },
      ],
      notes: [{}, { target: 'cmb' }],
    },
    'Blessing of Courage and Life': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 3,
        lastsOverOneDay: false,
        spellKey: 'pf1/272szq5d556toqgc',
      },
      modifiers: [
        {
          target: 'saves',
          bonusType: 'morale',
          value: 2,
          condition: { situation: 'fear' },
        },
        {
          target: 'saves',
          bonusType: 'morale',
          value: 2,
          condition: { situation: 'death' },
        },
      ],
      notes: [{}],
    },
    'Blessings of Luck and Resolve': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 3,
        lastsOverOneDay: false,
      },
      modifiers: [
        {
          target: 'saves',
          bonusType: 'morale',
          value: 2,
          condition: { situation: 'fear' },
        },
      ],
      notes: [{ target: 'saves' }],
    },
    'Bullet Shield': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 3,
        lastsOverOneDay: false,
        spellKey: 'pf1/vhfj5bkt9hmgvh9p',
      },
      modifiers: [
        {
          target: 'ac',
          bonusType: 'deflection',
          value: { formula: 'min(8, 4 + floor(@casterLevel / 5))' },
          condition: {
            situation: { local: 'against firearm and ranged attacks' },
          },
        },
      ],
    },
    'Burst of Glory': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/8wspht4k8tiugz6u',
      },
      modifiers: [
        { target: 'attack', bonusType: 'sacred', value: 1 },
        {
          target: 'saves',
          bonusType: 'sacred',
          value: 1,
          condition: { situation: 'fear' },
        },
      ],
      notes: [{ target: 'hp' }],
    },
    'Change Shape (Skinwalker - Beast Talker, DEX)': {
      detail: { kind: 'classFeature' },
      modifiers: [{ target: 'ability.dex', bonusType: 'racial', value: 2 }],
    },
    'Change Shape (Skinwalker - Beast Talker, Natural Armor)': {
      detail: { kind: 'classFeature' },
      modifiers: [
        { target: 'ac.natural', bonusType: 'naturalArmor', value: 1 },
      ],
    },
    'Cloak of Chaos': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 15,
        lastsOverOneDay: false,
        spellKey: 'pf1/o0s3eo85npgigh3w',
      },
      modifiers: [
        { target: 'ac', bonusType: 'deflection', value: 4 },
        {
          target: 'saves',
          bonusType: 'morale',
          value: 2,
          condition: {
            situation: {
              local:
                'on the new saving throw against mental control (enchantment [charm] or [compulsion])',
            },
          },
        },
        { target: 'saves', bonusType: 'resistance', value: 4 },
      ],
      notes: [{}, { target: 'ac' }],
    },
    'Crushing Despair': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 7,
        lastsOverOneDay: false,
        spellKey: 'pf1/zt7cje76dck9hwp9',
      },
      modifiers: [
        { target: 'attack', bonusType: 'untyped', value: -2 },
        { target: 'saves', bonusType: 'untyped', value: -2 },
        { target: 'skills', bonusType: 'untyped', value: -2 },
        { target: 'damage', bonusType: 'untyped', value: -2 },
      ],
      notes: [{}],
    },
    "Darkvision 60'": {
      detail: { kind: 'manual' },
      modifiers: [],
      notes: [{}],
    },
    'Debilitating Injury (Disoriented)': {
      detail: { kind: 'classFeature' },
      modifiers: [
        { target: 'attack', bonusType: 'untyped', value: -2 },
        {
          target: 'attack',
          bonusType: 'untyped',
          value: -2,
          condition: {
            situation: {
              local: 'on attack rolls against the rogue (rogue level 4-9)',
            },
          },
          stacksWithinEntry: true,
        },
        {
          target: 'attack',
          bonusType: 'untyped',
          value: -4,
          condition: {
            situation: {
              local: 'on attack rolls against the rogue (rogue level 10-15)',
            },
          },
          stacksWithinEntry: true,
        },
        {
          target: 'attack',
          bonusType: 'untyped',
          value: -6,
          condition: {
            situation: {
              local: 'on attack rolls against the rogue (rogue level 16-20)',
            },
          },
          stacksWithinEntry: true,
        },
      ],
    },
    'Dispel Chaos': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 9,
        lastsOverOneDay: false,
        spellKey: 'pf1/3lgy3s4h4087ojht',
      },
      modifiers: [
        {
          target: 'ac',
          bonusType: 'deflection',
          value: 4,
          condition: { situation: 'chaoticCreatures' },
        },
      ],
      notes: [{}],
    },
    'Dispel Good': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 9,
        lastsOverOneDay: false,
        spellKey: 'pf1/xgv1e2ayf1e0br9j',
      },
      modifiers: [
        {
          target: 'ac',
          bonusType: 'deflection',
          value: 4,
          condition: { situation: 'goodCreatures' },
        },
      ],
      notes: [{}],
    },
    'Divine Power': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 7,
        lastsOverOneDay: false,
        spellKey: 'pf1/0yvwyclhkf76veo1',
      },
      modifiers: [
        {
          target: 'attack',
          bonusType: 'luck',
          value: { formula: 'min(6, floor(@casterLevel / 3))' },
        },
        {
          target: 'damage',
          bonusType: 'luck',
          value: { formula: 'min(6, floor(@casterLevel / 3))' },
        },
        {
          target: 'skill.clm',
          bonusType: 'luck',
          value: { formula: 'min(6, floor(@casterLevel / 3))' },
        },
        {
          target: 'skill.swm',
          bonusType: 'luck',
          value: { formula: 'min(6, floor(@casterLevel / 3))' },
        },
      ],
      notes: [{}, { target: 'hp' }],
    },
    'Evil Eye (AC)': {
      detail: { kind: 'classFeature' },
      modifiers: [
        {
          target: 'ac',
          bonusType: 'untyped',
          value: -2,
          condition: { situation: { local: 'evil eye (witch level 1-7)' } },
        },
        {
          target: 'ac',
          bonusType: 'untyped',
          value: -4,
          condition: { situation: { local: 'evil eye (witch level 8-20)' } },
        },
      ],
    },
    'Evil Eye (Saves)': {
      detail: { kind: 'classFeature' },
      modifiers: [
        {
          target: 'saves',
          bonusType: 'untyped',
          value: -2,
          condition: { situation: { local: 'evil eye (witch level 1-7)' } },
        },
        {
          target: 'saves',
          bonusType: 'untyped',
          value: -4,
          condition: { situation: { local: 'evil eye (witch level 8-20)' } },
        },
      ],
    },
    'Great Cleave': {
      detail: { kind: 'manual' },
      modifiers: [{ target: 'ac', bonusType: 'untyped', value: -2 }],
    },
    Guidance: {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/o8ds5jtvf0hf92dw',
      },
      modifiers: [
        {
          target: 'attack',
          bonusType: 'competence',
          value: 1,
          condition: {
            situation: { local: 'on the one roll you choose for guidance' },
          },
        },
        {
          target: 'saves',
          bonusType: 'competence',
          value: 1,
          condition: {
            situation: { local: 'on the one roll you choose for guidance' },
          },
        },
        {
          target: 'skills',
          bonusType: 'competence',
          value: 1,
          condition: {
            situation: { local: 'on the one roll you choose for guidance' },
          },
        },
      ],
      notes: [{}],
    },
    Halo: {
      detail: { kind: 'classFeature' },
      modifiers: [
        {
          target: 'saves',
          bonusType: 'circumstance',
          value: 2,
          condition: {
            situation: { local: 'against becoming blinded or dazzled' },
          },
        },
        {
          target: 'skill.int',
          bonusType: 'circumstance',
          value: 2,
          condition: { situation: { local: 'against evil creatures' } },
        },
      ],
      notes: [{}],
    },
    'Ill Omen': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/wjdhmfdgwrevax3w',
      },
      modifiers: [],
      notes: [{}],
    },
    'Inspire Heroics': {
      detail: { kind: 'classFeature' },
      modifiers: [
        { target: 'saves', bonusType: 'morale', value: 4 },
        { target: 'ac', bonusType: 'dodge', value: 4 },
      ],
    },
    Jump: {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/ns2zo6qgd9co02uf',
      },
      modifiers: [
        {
          target: 'skill.acr',
          bonusType: 'enhancement',
          value: { formula: 'min(30, 10 * floor((@casterLevel + 3) / 4))' },
          condition: {
            situation: { local: 'to attempt high jumps or long jumps' },
          },
        },
      ],
    },
    'Lay of the Land': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 3,
        lastsOverOneDay: false,
        spellKey: 'pf1/3wdb34u6m64ctji7',
      },
      modifiers: [
        {
          target: 'skill.sur',
          bonusType: 'insight',
          value: { formula: 'min(5, @casterLevel)' },
          condition: {
            situation: { local: 'to avoid getting lost in the affected area' },
          },
        },
        {
          target: 'skill.kge',
          bonusType: 'insight',
          value: { formula: 'min(5, @casterLevel)' },
          condition: { situation: { local: 'in the affected area' } },
        },
      ],
      notes: [{ target: 'skill.kge' }],
    },
    Luckbringer: {
      detail: { kind: 'classFeature' },
      modifiers: [{ target: 'save.will', bonusType: 'luck', value: 1 }],
    },
    Lunge: {
      detail: { kind: 'classFeature' },
      modifiers: [{ target: 'ac', bonusType: 'untyped', value: -2 }],
    },
    'Mind Blank': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 15,
        lastsOverOneDay: false,
        spellKey: 'pf1/blvetbc929cfx4m8',
      },
      modifiers: [
        {
          target: 'saves',
          bonusType: 'resistance',
          value: 8,
          condition: { situation: 'mindAffecting' },
        },
      ],
      notes: [{}],
    },
    'Perfect Placement': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 3,
        lastsOverOneDay: false,
        spellKey: 'pf1/ncijcs7iaf9apm69',
      },
      modifiers: [
        { target: 'ac', bonusType: 'insight', value: 1 },
        { target: 'save.ref', bonusType: 'insight', value: 1 },
        {
          target: 'ac',
          bonusType: 'insight',
          value: 3,
          condition: { situation: { local: 'against attacks of opportunity' } },
        },
      ],
    },
    'Protection From Good': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/71g6nmvy8qnodwyz',
      },
      modifiers: [
        {
          target: 'ac',
          bonusType: 'deflection',
          value: 2,
          condition: { situation: 'goodCreatures' },
        },
        {
          target: 'saves',
          bonusType: 'resistance',
          value: 2,
          condition: { situation: 'goodCreatures' },
        },
        {
          target: 'saves',
          bonusType: 'morale',
          value: 2,
          condition: {
            situation: {
              local:
                'on the new saving throw against mental control (enchantment [charm] or [compulsion])',
            },
          },
        },
      ],
      notes: [{ target: 'ac' }],
    },
    'Protection From Law': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/ekhygw5fzfe52n35',
      },
      modifiers: [
        {
          target: 'ac',
          bonusType: 'deflection',
          value: 2,
          condition: { situation: 'lawfulCreatures' },
        },
        {
          target: 'saves',
          bonusType: 'resistance',
          value: 2,
          condition: { situation: 'lawfulCreatures' },
        },
        {
          target: 'saves',
          bonusType: 'morale',
          value: 2,
          condition: {
            situation: {
              local:
                'on the new saving throw against mental control (enchantment [charm] or [compulsion])',
            },
          },
        },
      ],
      notes: [{ target: 'ac' }],
    },
    Resistance: {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/g8j278xcu2s1zlwy',
      },
      modifiers: [{ target: 'saves', bonusType: 'resistance', value: 1 }],
    },
    'Sanctify Armor': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 10,
        lastsOverOneDay: false,
        spellKey: 'pf1/mjddoap3a58b2bux',
      },
      modifiers: [
        {
          target: 'ac.armor',
          bonusType: 'enhancement',
          value: { formula: 'min(5, floor(@casterLevel / 4))' },
        },
      ],
      notes: [{ target: 'ac' }],
    },
    'Shield of Law': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 15,
        lastsOverOneDay: false,
        spellKey: 'pf1/lzj5umxjvogvpg6b',
      },
      modifiers: [
        { target: 'ac', bonusType: 'deflection', value: 4 },
        {
          target: 'saves',
          bonusType: 'morale',
          value: 2,
          condition: {
            situation: {
              local:
                'on the new saving throw against mental control (enchantment [charm] or [compulsion])',
            },
          },
        },
        { target: 'saves', bonusType: 'resistance', value: 4 },
      ],
      notes: [{}, { target: 'ac' }],
    },
    'Squeezing (large)': {
      detail: { kind: 'manual' },
      modifiers: [
        { target: 'attack', bonusType: 'untyped', value: -4 },
        { target: 'ac', bonusType: 'untyped', value: -4 },
      ],
      notes: [{}, {}],
    },
    'Stunning Barrier': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/7vzu76eg8om0gpf0',
      },
      modifiers: [
        { target: 'ac', bonusType: 'deflection', value: 1 },
        { target: 'saves', bonusType: 'resistance', value: 1 },
      ],
      notes: [{ target: 'ac' }],
    },
    'Tap Inner Beauty': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/t1wkaw7wfvboswcb',
      },
      modifiers: [
        { target: 'skill.blf', bonusType: 'insight', value: 2 },
        { target: 'skill.dip', bonusType: 'insight', value: 2 },
        { target: 'skill.dis', bonusType: 'insight', value: 2 },
        { target: 'skill.han', bonusType: 'insight', value: 2 },
        { target: 'skill.int', bonusType: 'insight', value: 2 },
        { target: 'skill.prf', bonusType: 'insight', value: 2 },
        { target: 'skill.umd', bonusType: 'insight', value: 2 },
      ],
      notes: [{}],
    },
    'Threefold Aspect (Adult)': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/w2yf0ksu14e91uae',
      },
      modifiers: [
        { target: 'ability.int', bonusType: 'enhancement', value: 2 },
        { target: 'ability.wis', bonusType: 'enhancement', value: 2 },
        { target: 'ability.dex', bonusType: 'untyped', value: -2 },
      ],
    },
    'Threefold Aspect (Young Adult)': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/w2yf0ksu14e91uae',
      },
      modifiers: [
        { target: 'ability.dex', bonusType: 'enhancement', value: 2 },
        { target: 'ability.con', bonusType: 'enhancement', value: 2 },
        { target: 'ability.wis', bonusType: 'untyped', value: -2 },
      ],
    },
    'Unerring Weapon': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/09juighnblqlqwro',
      },
      modifiers: [
        {
          target: 'attack',
          bonusType: 'untyped',
          value: { formula: 'min(7, 2 + floor(@casterLevel / 4))' },
          condition: {
            situation: {
              local:
                'on attack rolls to confirm critical hits with the affected weapon',
            },
          },
        },
      ],
    },
    'Veil of Positive Energy': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/xpmhu8rj7gbjns84',
      },
      modifiers: [
        { target: 'ac', bonusType: 'sacred', value: 0 },
        { target: 'saves', bonusType: 'sacred', value: 0 },
        {
          target: 'ac',
          bonusType: 'sacred',
          value: 2,
          condition: {
            situation: {
              local: 'against attacks or effects created by undead creatures',
            },
          },
        },
        {
          target: 'saves',
          bonusType: 'sacred',
          value: 2,
          condition: {
            situation: {
              local: 'against attacks or effects created by undead creatures',
            },
          },
        },
      ],
      notes: [{}],
    },
  },
  'pf-buffs-549': {
    Adoration: {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/h2i514vklrry38fj',
      },
      modifiers: [
        {
          target: 'skill.dip',
          bonusType: 'morale',
          value: 2,
          condition: {
            situation: {
              local:
                'on Diplomacy checks to influence creatures, while out of combat',
            },
          },
        },
      ],
      notes: [{}],
    },
    'Alter Self (Small)': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 3,
        lastsOverOneDay: false,
        spellKey: 'pf1/kouqz0pm1xl8xilm',
      },
      modifiers: [{ target: 'ability.dex', bonusType: 'size', value: 2 }],
      notes: [{}],
    },
    'Angelic Aspect (Lesser)': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 3,
        lastsOverOneDay: false,
      },
      modifiers: [
        {
          target: 'ac',
          bonusType: 'deflection',
          value: 2,
          condition: { situation: { local: 'against evil creatures' } },
        },
        {
          target: 'saves',
          bonusType: 'resistance',
          value: 2,
          condition: { situation: { local: 'against evil creatures' } },
        },
        {
          target: 'saves',
          bonusType: 'morale',
          value: 2,
          condition: {
            situation: {
              local:
                'on the new saving throw against mental control (enchantment [charm] or [compulsion])',
            },
          },
        },
      ],
      notes: [{ target: 'ac' }, {}],
    },
    'Animal Focus (Frog)': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 7,
        lastsOverOneDay: false,
      },
      modifiers: [
        {
          target: 'skill.swm',
          bonusType: 'competence',
          value: 4,
          condition: {
            situation: { local: 'animal focus (hunter level 1-7)' },
          },
        },
        {
          target: 'skill.swm',
          bonusType: 'competence',
          value: 6,
          condition: {
            situation: { local: 'animal focus (hunter level 8-14)' },
          },
        },
        {
          target: 'skill.swm',
          bonusType: 'competence',
          value: 8,
          condition: {
            situation: { local: 'animal focus (hunter level 15-20)' },
          },
        },
      ],
      notes: [{ target: 'skill.acr' }],
    },
    'Animal Focus (Wolf)': {
      detail: { kind: 'manual' },
      modifiers: [],
      notes: [{}],
    },
    'Anticipate Peril': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/ja1p1uuf8fp6fiox',
      },
      modifiers: [
        {
          target: 'init',
          bonusType: 'insight',
          value: { formula: 'min(5, @casterLevel)' },
        },
      ],
      notes: [{ target: 'init' }],
    },
    'Banner, Greater': {
      detail: { kind: 'classFeature' },
      modifiers: [
        {
          target: 'saves',
          bonusType: 'morale',
          value: 2,
          condition: {
            situation: {
              local: 'against charm and compulsion spells and effects',
            },
          },
        },
      ],
      notes: [{}],
    },
    'Blessing of Fervor (Atk, AC, Ref)': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 7,
        lastsOverOneDay: false,
        spellKey: 'pf1/scyklgov72pvw884',
      },
      modifiers: [
        { target: 'attack', bonusType: 'untyped', value: 2 },
        { target: 'ac', bonusType: 'dodge', value: 2 },
        { target: 'save.ref', bonusType: 'dodge', value: 2 },
      ],
      notes: [{}],
    },
    'Certain Grip': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 3,
        lastsOverOneDay: false,
        spellKey: 'pf1/lmnwhrqgxf9cm9jq',
      },
      modifiers: [
        { target: 'skill.clm', bonusType: 'competence', value: 4 },
        {
          target: 'skill.acr',
          bonusType: 'competence',
          value: 4,
          condition: {
            situation: { local: 'on Acrobatics checks to balance' },
          },
        },
        {
          target: 'cmd',
          bonusType: 'competence',
          value: 4,
          condition: { situation: 'bullRush' },
        },
        {
          target: 'cmd',
          bonusType: 'competence',
          value: 4,
          condition: { situation: 'drag' },
        },
        {
          target: 'cmd',
          bonusType: 'competence',
          value: 4,
          condition: { situation: 'reposition' },
        },
        {
          target: 'cmd',
          bonusType: 'competence',
          value: 4,
          condition: { situation: 'trip' },
        },
      ],
      notes: [{ target: 'cmd' }],
    },
    'Change Shape (Skinwalker - Beast Talker, CON)': {
      detail: { kind: 'classFeature' },
      modifiers: [{ target: 'ability.con', bonusType: 'racial', value: 2 }],
    },
    'Change Shape (Skinwalker, Natural Armor)': {
      detail: { kind: 'classFeature' },
      modifiers: [
        { target: 'ac.natural', bonusType: 'naturalArmor', value: 1 },
      ],
    },
    'Channel Vigor (Limbs)': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 5,
        lastsOverOneDay: false,
        spellKey: 'pf1/tj3xdnlwtgk5ecln',
      },
      modifiers: [
        { target: 'attack', bonusType: 'untyped', value: 1 },
        { target: 'ac', bonusType: 'dodge', value: 1 },
        { target: 'save.ref', bonusType: 'dodge', value: 1 },
      ],
      notes: [{}, {}],
    },
    'Channel Vigor (Torso)': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 5,
        lastsOverOneDay: false,
        spellKey: 'pf1/tj3xdnlwtgk5ecln',
      },
      modifiers: [
        { target: 'save.fort', bonusType: 'competence', value: 6 },
        { target: 'concentration', bonusType: 'competence', value: 6 },
      ],
      notes: [{}],
    },
    Charging: {
      detail: { kind: 'manual' },
      modifiers: [
        { target: 'attack.melee', bonusType: 'circumstance', value: 2 },
        { target: 'ac', bonusType: 'circumstance', value: -2 },
        {
          target: 'cmb',
          bonusType: 'circumstance',
          value: 2,
          condition: { situation: 'bullRush' },
        },
      ],
      notes: [{}],
    },
    Chastise: {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/j2ngami2cehgw3bt',
      },
      modifiers: [
        {
          target: 'skill.blf',
          bonusType: 'untyped',
          value: 5,
          condition: {
            situation: {
              local:
                "to convince a listener they will get in trouble with their superiors or the law if they don't do what you ask",
            },
          },
        },
        {
          target: 'skill.dip',
          bonusType: 'untyped',
          value: 5,
          condition: {
            situation: {
              local:
                "to convince a listener they will get in trouble with their superiors or the law if they don't do what you ask",
            },
          },
        },
        {
          target: 'skill.int',
          bonusType: 'untyped',
          value: 5,
          condition: {
            situation: {
              local:
                "to convince a listener they will get in trouble with their superiors or the law if they don't do what you ask",
            },
          },
        },
      ],
    },
    'Combat Expertise': {
      detail: { kind: 'manual' },
      modifiers: [
        {
          target: 'attack.melee',
          bonusType: 'untyped',
          value: { formula: '-(1 + (floor(@bab / 4)))' },
        },
        {
          target: 'ac',
          bonusType: 'dodge',
          value: { formula: '(1 + (floor(@bab / 4)))' },
        },
        {
          target: 'cmb',
          bonusType: 'untyped',
          value: { formula: '-(1 + (floor(@bab / 4)))' },
        },
      ],
    },
    'Cover (Soft)': {
      detail: { kind: 'manual' },
      modifiers: [
        {
          target: 'ac',
          bonusType: 'untyped',
          value: 4,
          condition: { situation: { local: 'against ranged attacks' } },
        },
      ],
      notes: [{ target: 'attack' }, {}],
    },
    'Death Knell': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/k0k8gvqyy3rd5gke',
      },
      modifiers: [
        { target: 'ability.str', bonusType: 'enhancement', value: 2 },
        { target: 'casterLevel', bonusType: 'untyped', value: 1 },
      ],
      notes: [{ target: 'hp' }, { target: 'casterLevel' }],
    },
    'Debilitating Injury (Bewildered)': {
      detail: { kind: 'classFeature' },
      modifiers: [
        { target: 'ac', bonusType: 'untyped', value: -2 },
        {
          target: 'ac',
          bonusType: 'untyped',
          value: -2,
          condition: {
            situation: {
              local: 'against attacks by the rogue (rogue level 4-9)',
            },
          },
          stacksWithinEntry: true,
        },
        {
          target: 'ac',
          bonusType: 'untyped',
          value: -4,
          condition: {
            situation: {
              local: 'against attacks by the rogue (rogue level 10-15)',
            },
          },
          stacksWithinEntry: true,
        },
        {
          target: 'ac',
          bonusType: 'untyped',
          value: -6,
          condition: {
            situation: {
              local: 'against attacks by the rogue (rogue level 16-20)',
            },
          },
          stacksWithinEntry: true,
        },
      ],
    },
    'Dispel Evil': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 9,
        lastsOverOneDay: false,
        spellKey: 'pf1/sg3eq6xpsum65fgm',
      },
      modifiers: [
        {
          target: 'ac',
          bonusType: 'deflection',
          value: 4,
          condition: { situation: { local: 'against evil creatures' } },
        },
      ],
      notes: [{}],
    },
    'Dispel Law': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/fhuoxhjgf9otqvzh',
      },
      modifiers: [
        {
          target: 'ac',
          bonusType: 'deflection',
          value: 4,
          condition: { situation: 'lawfulCreatures' },
        },
      ],
      notes: [{}],
    },
    'Evil Eye (Atk)': {
      detail: { kind: 'classFeature' },
      modifiers: [
        {
          target: 'attack',
          bonusType: 'untyped',
          value: -2,
          condition: { situation: { local: 'evil eye (witch level 1-7)' } },
        },
        {
          target: 'attack',
          bonusType: 'untyped',
          value: -4,
          condition: { situation: { local: 'evil eye (witch level 8-20)' } },
        },
      ],
    },
    'Evil Eye (Skill)': {
      detail: { kind: 'classFeature' },
      modifiers: [
        {
          target: 'skills',
          bonusType: 'untyped',
          value: -2,
          condition: { situation: { local: 'evil eye (witch level 1-7)' } },
        },
        {
          target: 'skills',
          bonusType: 'untyped',
          value: -4,
          condition: { situation: { local: 'evil eye (witch level 8-20)' } },
        },
      ],
    },
    Glibness: {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 7,
        lastsOverOneDay: false,
        spellKey: 'pf1/7c8nufdm0pj4bgep',
      },
      modifiers: [
        {
          target: 'skill.blf',
          bonusType: 'untyped',
          value: 20,
          condition: {
            situation: {
              local: 'to convince another of the truth of your words',
            },
          },
        },
      ],
      notes: [{}],
    },
    'Good Hope': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 7,
        lastsOverOneDay: false,
        spellKey: 'pf1/rgd5v3llwoptwcdb',
      },
      modifiers: [
        { target: 'saves', bonusType: 'morale', value: 2 },
        { target: 'attack', bonusType: 'morale', value: 2 },
        { target: 'skills', bonusType: 'morale', value: 2 },
        { target: 'damage', bonusType: 'morale', value: 2 },
      ],
      notes: [{}],
    },
    'Holy Aura': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 15,
        lastsOverOneDay: false,
        spellKey: 'pf1/n0vm6or4nwaylpfa',
      },
      modifiers: [
        { target: 'ac', bonusType: 'deflection', value: 4 },
        {
          target: 'saves',
          bonusType: 'morale',
          value: 2,
          condition: {
            situation: {
              local:
                'on the new saving throw against mental control (enchantment [charm] or [compulsion])',
            },
          },
        },
        { target: 'saves', bonusType: 'resistance', value: 4 },
      ],
      notes: [{}, { target: 'ac' }],
    },
    Identify: {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/llxrra87kbofmyhl',
      },
      modifiers: [
        {
          target: 'skill.spl',
          bonusType: 'enhancement',
          value: 10,
          condition: {
            situation: {
              local:
                'to identify the properties and command words of magic items in your possession',
            },
          },
        },
      ],
      notes: [{ target: 'skill.spl' }],
    },
    Jitterbugs: {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 3,
        lastsOverOneDay: false,
        spellKey: 'pf1/axe8kelwutjkwh80',
      },
      modifiers: [
        { target: 'skill.acr', bonusType: 'untyped', value: -4 },
        { target: 'skill.dev', bonusType: 'untyped', value: -4 },
        { target: 'skill.esc', bonusType: 'untyped', value: -4 },
        { target: 'skill.fly', bonusType: 'untyped', value: -4 },
        { target: 'skill.rid', bonusType: 'untyped', value: -4 },
        { target: 'skill.slt', bonusType: 'untyped', value: -4 },
        { target: 'skill.ste', bonusType: 'untyped', value: -4 },
      ],
      notes: [{}, { target: 'ac' }, {}],
    },
    'Joyous Companion': {
      detail: { kind: 'classFeature' },
      modifiers: [
        {
          target: 'saves',
          bonusType: 'morale',
          value: 1,
          condition: { situation: 'fear' },
        },
      ],
    },
    'Magic Fang': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/cfzk3vkv1c7ncaug',
      },
      modifiers: [
        { target: 'attack.melee', bonusType: 'enhancement', value: 0 },
        { target: 'damage', bonusType: 'enhancement', value: 0 },
        {
          target: 'attack.melee',
          bonusType: 'enhancement',
          value: 1,
          condition: {
            situation: {
              local:
                'with the natural weapon or unarmed strike magic fang affects',
            },
          },
        },
        {
          target: 'damage.melee',
          bonusType: 'enhancement',
          value: 1,
          condition: {
            situation: {
              local:
                'with the natural weapon or unarmed strike magic fang affects',
            },
          },
        },
      ],
      notes: [{ target: 'damage.melee' }],
    },
    'Magic Fang, Greater': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 5,
        lastsOverOneDay: false,
        spellKey: 'pf1/bgtmki0xl4xl4y91',
      },
      modifiers: [
        {
          target: 'attack.melee',
          bonusType: 'enhancement',
          value: { formula: 'min(5, floor(@casterLevel / 4))' },
          condition: {
            situation: {
              local:
                'with the one natural weapon or unarmed strike greater magic fang affects',
            },
          },
        },
        {
          target: 'damage.melee',
          bonusType: 'enhancement',
          value: { formula: 'min(5, floor(@casterLevel / 4))' },
          condition: {
            situation: {
              local:
                'with the one natural weapon or unarmed strike greater magic fang affects',
            },
          },
        },
        {
          target: 'attack.melee',
          bonusType: 'enhancement',
          value: 1,
          condition: {
            situation: {
              local:
                "with any natural weapon (greater magic fang's +1 on all natural weapons)",
            },
          },
        },
        {
          target: 'damage.melee',
          bonusType: 'enhancement',
          value: 1,
          condition: {
            situation: {
              local:
                "with any natural weapon (greater magic fang's +1 on all natural weapons)",
            },
          },
        },
      ],
      notes: [{ target: 'attack.melee' }],
    },
    'Magic Vestment': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 5,
        lastsOverOneDay: false,
        spellKey: 'pf1/73han2zqxg59u18g',
      },
      modifiers: [
        {
          target: 'ac.armor',
          bonusType: 'enhancement',
          value: { formula: 'min(5, floor(@casterLevel / 4))' },
          condition: {
            situation: {
              local: 'magic vestment cast on your armor or clothing',
            },
          },
        },
        {
          target: 'ac.shield',
          bonusType: 'enhancement',
          value: { formula: 'min(5, floor(@casterLevel / 4))' },
          condition: {
            situation: { local: 'magic vestment cast on your shield' },
          },
        },
      ],
    },
    'Magic Weapon, Greater': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 5,
        lastsOverOneDay: false,
        spellKey: 'pf1/zq7xi7l5vgpqu7rt',
      },
      modifiers: [
        {
          target: 'attack',
          bonusType: 'enhancement',
          value: { formula: 'min(5, floor(@casterLevel / 4))' },
          condition: {
            situation: {
              local: 'with the weapon greater magic weapon affects',
            },
          },
        },
        {
          target: 'damage',
          bonusType: 'enhancement',
          value: { formula: 'min(5, floor(@casterLevel / 4))' },
          condition: {
            situation: {
              local: 'with the weapon greater magic weapon affects',
            },
          },
        },
      ],
      notes: [{ target: 'attack' }, { target: 'attack' }],
    },
    'Pernicious Poison': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 3,
        lastsOverOneDay: false,
        spellKey: 'pf1/6gbb0vdil1e8mhou',
      },
      modifiers: [
        {
          target: 'saves',
          bonusType: 'untyped',
          value: -4,
          condition: { situation: 'poison' },
        },
      ],
      notes: [{}],
    },
    'Protection From Evil': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/skgjjub1hng29nwo',
      },
      modifiers: [
        {
          target: 'ac',
          bonusType: 'deflection',
          value: 2,
          condition: { situation: { local: 'against evil creatures' } },
        },
        {
          target: 'saves',
          bonusType: 'resistance',
          value: 2,
          condition: { situation: { local: 'against evil creatures' } },
        },
        {
          target: 'saves',
          bonusType: 'morale',
          value: 2,
          condition: {
            situation: {
              local:
                'on the new saving throw against mental control (enchantment [charm] or [compulsion])',
            },
          },
        },
      ],
      notes: [{ target: 'ac' }],
    },
    'Remove Fear': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/eu4u4mr1naoiqohz',
      },
      modifiers: [
        {
          target: 'saves',
          bonusType: 'morale',
          value: 4,
          condition: { situation: 'fear' },
        },
      ],
      notes: [{}],
    },
    'Righteous Might': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 9,
        lastsOverOneDay: false,
        spellKey: 'pf1/6ax0ythzw8n4bta8',
      },
      modifiers: [
        { target: 'ability.str', bonusType: 'size', value: 4 },
        { target: 'ability.con', bonusType: 'size', value: 4 },
        { target: 'ability.dex', bonusType: 'size', value: -2 },
        { target: 'ac.natural', bonusType: 'enhancement', value: 2 },
      ],
      notes: [{ target: 'ac' }, {}],
    },
    'Small Quarter Ally': {
      detail: { kind: 'classFeature' },
      modifiers: [
        {
          target: 'saves',
          bonusType: 'luck',
          value: 1,
          condition: { situation: 'fear' },
        },
      ],
    },
    'Smite Evil': {
      detail: { kind: 'classFeature' },
      modifiers: [
        {
          target: 'ac',
          bonusType: 'deflection',
          value: { formula: 'max(0, @ability.cha.mod)' },
          condition: {
            situation: {
              local: 'against attacks by the target of your smite evil',
            },
          },
        },
        {
          target: 'attack',
          bonusType: 'untyped',
          value: { formula: 'max(0, @ability.cha.mod)' },
          condition: {
            situation: { local: 'against the target of your smite evil' },
          },
        },
        {
          target: 'damage',
          bonusType: 'untyped',
          value: { formula: '@classLevel.paladin' },
          condition: {
            situation: { local: 'against the target of your smite evil' },
          },
        },
      ],
      notes: [{ target: 'damage' }, { target: 'attack' }],
    },
    'Smite Good (Tiefling)': {
      detail: { kind: 'classFeature' },
      modifiers: [
        {
          target: 'attack',
          bonusType: 'untyped',
          value: { formula: 'max(0, @ability.cha.mod)' },
          condition: {
            situation: { local: 'against the target of your smite good' },
          },
        },
        {
          target: 'damage',
          bonusType: 'untyped',
          value: { formula: '@hitDice' },
          condition: {
            situation: { local: 'against the target of your smite good' },
          },
        },
      ],
      notes: [{ target: 'attack' }],
    },
    'Threefold Aspect (Elderly)': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/w2yf0ksu14e91uae',
      },
      modifiers: [
        { target: 'ability.int', bonusType: 'enhancement', value: 4 },
        { target: 'ability.wis', bonusType: 'enhancement', value: 4 },
        { target: 'ability.str', bonusType: 'untyped', value: -2 },
        { target: 'ability.dex', bonusType: 'untyped', value: -2 },
      ],
    },
    'Touch of Good': {
      detail: { kind: 'manual' },
      modifiers: [
        {
          target: 'attack',
          bonusType: 'sacred',
          value: 1,
          condition: {
            situation: { local: 'touch of good (cleric level 1-3)' },
          },
        },
        {
          target: 'attack',
          bonusType: 'sacred',
          value: 2,
          condition: {
            situation: { local: 'touch of good (cleric level 4-5)' },
          },
        },
        {
          target: 'attack',
          bonusType: 'sacred',
          value: 3,
          condition: {
            situation: { local: 'touch of good (cleric level 6-7)' },
          },
        },
        {
          target: 'attack',
          bonusType: 'sacred',
          value: 4,
          condition: {
            situation: { local: 'touch of good (cleric level 8-9)' },
          },
        },
        {
          target: 'attack',
          bonusType: 'sacred',
          value: 5,
          condition: {
            situation: { local: 'touch of good (cleric level 10-11)' },
          },
        },
        {
          target: 'attack',
          bonusType: 'sacred',
          value: 6,
          condition: {
            situation: { local: 'touch of good (cleric level 12-13)' },
          },
        },
        {
          target: 'attack',
          bonusType: 'sacred',
          value: 7,
          condition: {
            situation: { local: 'touch of good (cleric level 14-15)' },
          },
        },
        {
          target: 'attack',
          bonusType: 'sacred',
          value: 8,
          condition: {
            situation: { local: 'touch of good (cleric level 16-17)' },
          },
        },
        {
          target: 'attack',
          bonusType: 'sacred',
          value: 9,
          condition: {
            situation: { local: 'touch of good (cleric level 18-19)' },
          },
        },
        {
          target: 'attack',
          bonusType: 'sacred',
          value: 10,
          condition: {
            situation: { local: 'touch of good (cleric level 20)' },
          },
        },
        {
          target: 'skills',
          bonusType: 'sacred',
          value: 1,
          condition: {
            situation: { local: 'touch of good (cleric level 1-3)' },
          },
        },
        {
          target: 'skills',
          bonusType: 'sacred',
          value: 2,
          condition: {
            situation: { local: 'touch of good (cleric level 4-5)' },
          },
        },
        {
          target: 'skills',
          bonusType: 'sacred',
          value: 3,
          condition: {
            situation: { local: 'touch of good (cleric level 6-7)' },
          },
        },
        {
          target: 'skills',
          bonusType: 'sacred',
          value: 4,
          condition: {
            situation: { local: 'touch of good (cleric level 8-9)' },
          },
        },
        {
          target: 'skills',
          bonusType: 'sacred',
          value: 5,
          condition: {
            situation: { local: 'touch of good (cleric level 10-11)' },
          },
        },
        {
          target: 'skills',
          bonusType: 'sacred',
          value: 6,
          condition: {
            situation: { local: 'touch of good (cleric level 12-13)' },
          },
        },
        {
          target: 'skills',
          bonusType: 'sacred',
          value: 7,
          condition: {
            situation: { local: 'touch of good (cleric level 14-15)' },
          },
        },
        {
          target: 'skills',
          bonusType: 'sacred',
          value: 8,
          condition: {
            situation: { local: 'touch of good (cleric level 16-17)' },
          },
        },
        {
          target: 'skills',
          bonusType: 'sacred',
          value: 9,
          condition: {
            situation: { local: 'touch of good (cleric level 18-19)' },
          },
        },
        {
          target: 'skills',
          bonusType: 'sacred',
          value: 10,
          condition: {
            situation: { local: 'touch of good (cleric level 20)' },
          },
        },
        {
          target: 'saves',
          bonusType: 'sacred',
          value: 1,
          condition: {
            situation: { local: 'touch of good (cleric level 1-3)' },
          },
        },
        {
          target: 'saves',
          bonusType: 'sacred',
          value: 2,
          condition: {
            situation: { local: 'touch of good (cleric level 4-5)' },
          },
        },
        {
          target: 'saves',
          bonusType: 'sacred',
          value: 3,
          condition: {
            situation: { local: 'touch of good (cleric level 6-7)' },
          },
        },
        {
          target: 'saves',
          bonusType: 'sacred',
          value: 4,
          condition: {
            situation: { local: 'touch of good (cleric level 8-9)' },
          },
        },
        {
          target: 'saves',
          bonusType: 'sacred',
          value: 5,
          condition: {
            situation: { local: 'touch of good (cleric level 10-11)' },
          },
        },
        {
          target: 'saves',
          bonusType: 'sacred',
          value: 6,
          condition: {
            situation: { local: 'touch of good (cleric level 12-13)' },
          },
        },
        {
          target: 'saves',
          bonusType: 'sacred',
          value: 7,
          condition: {
            situation: { local: 'touch of good (cleric level 14-15)' },
          },
        },
        {
          target: 'saves',
          bonusType: 'sacred',
          value: 8,
          condition: {
            situation: { local: 'touch of good (cleric level 16-17)' },
          },
        },
        {
          target: 'saves',
          bonusType: 'sacred',
          value: 9,
          condition: {
            situation: { local: 'touch of good (cleric level 18-19)' },
          },
        },
        {
          target: 'saves',
          bonusType: 'sacred',
          value: 10,
          condition: {
            situation: { local: 'touch of good (cleric level 20)' },
          },
        },
      ],
      notes: [{}],
    },
    "Tremorsense 30'": {
      detail: { kind: 'manual' },
      modifiers: [],
      notes: [{}],
    },
    'Unbreakable Heart': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 1,
        lastsOverOneDay: false,
        spellKey: 'pf1/eimp8bzk9oabtqpj',
      },
      modifiers: [
        {
          target: 'saves',
          bonusType: 'morale',
          value: 4,
          condition: {
            situation: {
              local:
                'against mind-affecting effects that rely on negative emotions or would force you to harm an ally',
            },
          },
        },
      ],
    },
    'Unholy Aura': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 15,
        lastsOverOneDay: false,
        spellKey: 'pf1/flrn1xmm2wfrxbkf',
      },
      modifiers: [
        { target: 'ac', bonusType: 'deflection', value: 4 },
        {
          target: 'saves',
          bonusType: 'morale',
          value: 2,
          condition: {
            situation: {
              local:
                'on the new saving throw against mental control (enchantment [charm] or [compulsion])',
            },
          },
        },
        { target: 'saves', bonusType: 'resistance', value: 4 },
      ],
      notes: [{}, { target: 'ac' }],
    },
    'Weapon of Awe': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 3,
        lastsOverOneDay: false,
        spellKey: 'pf1/hlom4mgjkdy2dd5u',
      },
      modifiers: [
        {
          target: 'damage',
          bonusType: 'sacred',
          value: 2,
          condition: {
            situation: { local: 'with the weapon weapon of awe affects' },
          },
        },
      ],
      notes: [{ target: 'attack' }],
    },
    'Wrathful Mantle': {
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 5,
        lastsOverOneDay: false,
        spellKey: 'pf1/1gz3zdpxu7uic5ky',
      },
      modifiers: [
        {
          target: 'saves',
          bonusType: 'resistance',
          value: { formula: 'min(5, floor(@casterLevel / 4))' },
        },
      ],
      notes: [{}],
    },
  },
} as const;
