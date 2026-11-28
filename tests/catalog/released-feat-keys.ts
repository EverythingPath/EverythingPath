// pbl-released-feats-1 and -2 (PRD #251): the feat batch units' entries, as
// committed data, for the released feat tests (released-feats-330 and
// released-feats-339, each a unit and an integration file). For each batch:
//
// - `named`: each feat a resolver block or an integration test looks up by
//   name, with the key the batch preview gave that name;
// - `references`: every other key those feats' imported fields name (their
//   prerequisite feats, classes, class features and races, and the entries
//   their descriptions link), the keys the old tests named as literals, and
//   context keys: records no field names whose presence changes a
//   rule-bearing field of an imported entry, each with its reason; so that
//   each entry the released feat tests import comes out as the release (the
//   whole store imported) emits it;
// - `every` (only where a released case checks every entry of the preview,
//   as an old block did): the preview's keys in its order;
// - `situationLookup`: how the batch unit's helper chose a Modifier's local
//   Situation (`featBatch` in released-feat-sheet.ts), by target with
//   `localSituation`: `first`, the first Modifier on the target (feats-334 to
//   feats-336 and feats-341, and the batches whose units had no such
//   helper); `firstLocal`, the first one on the target whose Situation is
//   not a shared key (feats-337 to feats-340); by value with
//   `valueSituation`: `value`, the first Modifier of that value, whatever its
//   target (feats-342, feats-343); by position with `indexSituation`:
//   `index`, the Modifier at that index (feats-344 to feats-347).
//
// Nothing here reads a batch directory.

/** The batch unit's Situation lookup (`featBatch` in released-feat-sheet.ts). */
export type SituationLookup = 'first' | 'firstLocal' | 'value' | 'index';

export const featBatches = {
  'feats-330': {
    situationLookup: 'first',
    named: {
      'Arcane Armor Training': 'pf1/3v85ul6tGGBZbtBg',
      'Armor Proficiency, Heavy': 'pf1/3MqcLuZfUJB8xMby',
      Fleet: 'pf1/BkKYCzEGNTzZRiTz',
      'Greater Disarm': 'pf1/1AY9Xjbg109TsnVl',
      'Greater Reposition': 'pf1/HbfpROYGuhT2OLIQ',
      'Greater Spell Penetration': 'pf1/3HjwKckDBDDPcY2c',
      'Improved Disarm': 'pf1/711B9WNFgpdDKKf2',
      'Improved Reposition': 'pf1/CYHloH6aEnfgdxAV',
      'Lightning Reflexes': 'pf1/0bZf3SDkvVOe2ujH',
      'Magical Aptitude': 'pf1/CLSsMyNmdcNAOUKC',
      'Point-Blank Shot': 'pf1/8rsFtye3PwM6CKli',
      'Self-Sufficient': 'pf1/8VZQJOyAXbXghxd7',
      'Shield Focus': 'pf1/7mD4ZksvKFaorAfj',
      'Skill Focus': 'pf1/7zJTztNW7hdaqjKc',
      Toughness: 'pf1/8snLqsJN4LLL00Nq',
    },
    references: [
      'pf1/FszchlqR39lnNduC', // Armor Proficiency, Light
      'pf1/NFxHebU1XhEs5WJh', // Combat Expertise
      'pf1/WZj7zDvuelEoeXWX', // Shield Proficiency
      'pf1/nWFr8SNcjcMqsXSH', // Spell Penetration
      'pf1/qQCgBVieojhmMuHL', // Armor Proficiency, Medium
    ],
  },
  'feats-331': {
    situationLookup: 'first',
    named: {
      Alertness: 'pf1/Q1cY8r0Pvb66pMG0',
      'Arcane Strike': 'pf1/QvlxYVVsBDlykPKe',
      'Combat Expertise': 'pf1/NFxHebU1XhEs5WJh',
      'Critical Focus': 'pf1/JNlMhMhcDO8wkXiw',
      Deceitful: 'pf1/SUACufUXl12sUvnQ',
      'Deft Hands': 'pf1/SMyexRzOm5PfjT5I',
      Dodge: 'pf1/JreaiTHdyWFNj3Tb',
      'Greater Steal': 'pf1/XxZgIRc2UMLXHtZh',
      'Improved Initiative': 'pf1/Uuiu3p982omhMEPj',
      'Improved Steal': 'pf1/Kbuy0bkPlOYz5yaO',
      'Intimidating Prowess': 'pf1/O0jbkTJcIji9BNiF',
      Mobility: 'pf1/R7L4SlGRlnThqFrP',
      Persuasive: 'pf1/L10V7jTzmMYz62zz',
      'Two-Weapon Defense': 'pf1/YDqp3yrAsuXh103W',
    },
    references: [
      'pf1/Ee7JHADKEK37tTHs', // Two-Weapon Fighting
      'pf1/JUBqOpBA3agQwNvu', // Natural Spell
    ],
  },
  'feats-332': {
    situationLookup: 'first',
    named: {
      Acrobatic: 'pf1/jCxcObXJfdDrx4WS',
      'Agile Maneuvers': 'pf1/lxDJhpqwtR3J4UXx',
      'Animal Affinity': 'pf1/bqoIfsrF8BF1GC28',
      'Arcane Armor Mastery': 'pf1/aUYSiYrtVHkgfHD6',
      'Armor Proficiency, Medium': 'pf1/qQCgBVieojhmMuHL',
      Athletic: 'pf1/rMR6ahXEfYqASE7D',
      Cleave: 'pf1/Zeq6RWYv5otvg8q7',
      'Combat Casting': 'pf1/u7rGDZUL296QIuA0',
      'Combat Reflexes': 'pf1/h9nHYLxXvIXBTmup',
      'Deadly Stroke': 'pf1/en3iH9cxZtYQNd08',
      'Great Fortitude': 'pf1/fVRnBIHR4Jq6btvm',
      'Greater Grapple': 'pf1/hc7CRKHvhmKRzNKb',
      'Greater Overrun': 'pf1/tkWfEP1fD7CZt8Kw',
      'Greater Sunder': 'pf1/wJNggbGTZBx7BW9W',
      'Greater Trip': 'pf1/lNyMFFQaOxxTOW7M',
      'Improved Grapple': 'pf1/ZmQkRk93nbHxsQSt',
      'Improved Overrun': 'pf1/go4xOiSUP8R1QJ5N',
      'Improved Sunder': 'pf1/lpXdFoT6OqS5vi2X',
      'Improved Trip': 'pf1/gTrGPxzN054GfpkM',
      'Iron Will': 'pf1/iAbIGhm7T2OK9Brt',
      Run: 'pf1/bXeW4kLCErPBFpNB',
      'Spell Penetration': 'pf1/nWFr8SNcjcMqsXSH',
      Stealthy: 'pf1/f5FPqAYWlKj3zCIY',
    },
    references: [
      'pf1/2aTFNMs3pW6nUBlr', // Improved Unarmed Strike
      'pf1/3cq9YbgcMrAXC76j', // Dazzling Display
      'pf1/3v85ul6tGGBZbtBg', // Arcane Armor Training
      'pf1/FUW5mIXHNBBIQ1Sq', // Power Attack
      'pf1/FszchlqR39lnNduC', // Armor Proficiency, Light
      'pf1/IER2MzJrjSvxMlNS', // Greater Weapon Focus
      'pf1/NFxHebU1XhEs5WJh', // Combat Expertise
      'pf1/kn854Ovz0BDA2Dgz', // Shatter Defenses
      'pf1/n250dFlbykAIAg5Z', // Weapon Focus
    ],
  },
  'feats-333': {
    situationLookup: 'first',
    named: {
      'Greater Vital Strike': 'pf1/zKNk7a4XxXsygJ67',
      'Improvised Weapon Mastery': 'pf1/z5G64ZSUDNdgeICT',
      Lunge: 'pf1/xq2TFr7bsYBBHOi5',
      'Paired Opportunists': 'pf1/yW1RFRSh4Ma2uYc9',
      'Pinpoint Targeting': 'pf1/ztV5oURW9cFsLdXT',
      'Shield Master': 'pf1/yB4JlE2GC1MYlweS',
      'Signature Skill': 'pf1/zOxJqI5CG4VoycmQ',
      'Signature Skill (Craft)': 'pf1/zN9kRaSjKJ1qsfDE',
      'Signature Skill (Perception)': 'pf1/zD6KBnFbY1Nrok5h',
      'Simple Weapon Proficiency': 'pf1/y3GhqdsCdE9IyYQc',
      Spellbreaker: 'pf1/yE3hVOvBq9rx6TAw',
    },
    references: [
      'pf1/26k1Gi7t5BoqxhIj', // Vital Strike
      'pf1/53urYIbYYpQuoSLd', // Precise Shot
      'pf1/8rsFtye3PwM6CKli', // Point-Blank Shot
      'pf1/DorPGQ2mifJbMKH8', // Improved Vital Strike
      'pf1/Ee7JHADKEK37tTHs', // Two-Weapon Fighting
      'pf1/GEo7nDHxddLxi66j', // Shield Slam
      'pf1/QaMwiDFQdDwycTUO', // Disruptive
      'pf1/WLqBCT5DqmGAx8Wd', // Fighter
      'pf1/WZj7zDvuelEoeXWX', // Shield Proficiency
      'pf1/bZ1YdzkT8NtRIEJ4', // Catch Off-Guard
      'pf1/gGfXQq0IZrxdcZDx', // Throw Anything
      'pf1/h1vqUG9Kh3f7oKWK', // Improved Precise Shot
      'pf1/iyYyc3rKW0cBZ1cs', // Rogue's Edge (UC)
      'pf1/qYv70Ch9RQfi1LQQ', // Improved Shield Bash
    ],
  },
  'feats-334': {
    situationLookup: 'first',
    named: {
      Abeyance: 'pf1-content/0DDCq2L7ZsDwc2a3',
      'Additional Traits': 'pf1-content/1FEf5OW15eWcNoHd',
      'Desert Dweller': 'pf1-content/1iCzafnWv1zYsR09',
      'Elemental Focus': 'pf1-content/1frgqDSnQFiTq0MC',
      Explorer: 'pf1-content/0kGH7ah6DQYg1ukh',
      'Feline Grace': 'pf1-content/0a08FtW2Qvrfaz65',
      'Flame Heart': 'pf1-content/17O0R6YNDttLPIBh',
      Jumper: 'pf1-content/1W1kpoArNz49RZry',
      'Oath of the Unbound': 'pf1-content/0TeuA51dXqerRWim',
      'Storm-Lashed': 'pf1-content/0sNY1wvxcIYP00QQ',
      'Wary Smuggler': 'pf1-content/0lBSgxBA8bWoluzI',
    },
    references: [
      'pf1-content/eVRF6WuXUTN3T0K2', // Fire Tamer
      'pf1/VE4d35yiptv2eyxm', // Catfolk
      'pf1/bOv30pyHB1gFbSTj', // Goblin
    ],
  },
  'feats-335': {
    situationLookup: 'first',
    named: {
      'Conceal Aura': 'pf1-content/3clO9dR5TKOkg5SS',
      'Edge Runner': 'pf1-content/3c2V6NvFXmCxdMKW',
      Empath: 'pf1-content/2sU7JkwlS0oewqGP',
      'Grabbing Drag': 'pf1-content/3FyjDvt86BYCzy9e',
      'Improved Planar Infusion': 'pf1-content/250VIQPVJ9G2qM8J',
      'Just Out of Reach': 'pf1-content/3hYDtjwt9KEmq3c5',
      "Nature's Weapons": 'pf1-content/3rgP85ULTlxqr48j',
      'Out of the Sun': 'pf1-content/2NY9sZeKDp8n0gn1',
      'Pummeling Bully': 'pf1-content/1zkPYWfsc2a6xhJa',
      'Skill Focus (Stealth)': 'pf1-content/2JWwVMFeqHnFDFSv',
      'Steadfast Personality': 'pf1-content/2Bqp14c8zjdjSMFm',
      'Totemic Disciple': 'pf1-content/23vl8taZ6srdVZQL',
      'Totemic Master': 'pf1-content/20rB8UNFwhjTka52',
      'Unyielding Ferocity': 'pf1-content/1taW8qvQsEjvvVSv',
    },
    references: [
      'pf1-content/SfA1sbq09qa3S1GF', // Grabbing Style
      'pf1-content/cfMjSNPlWH9pwL55', // Pummeling Style
      'pf1-content/eQhruyN2Z7cfXCjL', // Planar Infusion
      'pf1-content/smJnIdniC0at6osM', // Totemic Initiate
      'pf1/2aTFNMs3pW6nUBlr', // Improved Unarmed Strike
      'pf1/CYHloH6aEnfgdxAV', // Improved Reposition
      'pf1/JreaiTHdyWFNj3Tb', // Dodge
      'pf1/R7L4SlGRlnThqFrP', // Mobility
      'pf1/W8dxwZ1CZiwLKsqr', // Monk
      'pf1/ZmQkRk93nbHxsQSt', // Improved Grapple
      'pf1/bZ1YdzkT8NtRIEJ4', // Catch Off-Guard
      'pf1/gTrGPxzN054GfpkM', // Improved Trip
      'pf1/iDlGMIezGuqqt8Us', // Brawler
      'pf1/rMR6ahXEfYqASE7D', // Athletic
    ],
  },
  'feats-336': {
    situationLookup: 'first',
    named: {
      'Aberration-Bane Caster': 'pf1-content/5QLaO0t2YZmtX7ST',
      'Advanced Defensive Combat Training': 'pf1-content/4EEcIsrbQrAR44ZN',
      'Casual Illusionist': 'pf1-content/5UMIEve3HUHJOFTE',
      'Combat Reflexes (Mythic)': 'pf1-content/4tm93dp4PHmFogbB',
      'Counter Reflexes': 'pf1-content/5Ingp2V3b5lNhMVv',
      'Deceitful (Mythic)': 'pf1-content/5AIjw1bOUkzRQOYI',
      'Elemental Channel (Mythic)': 'pf1-content/4nE9Y1QrQNNIEzrO',
      'Focused Phantom': 'pf1-content/53XLCF8J6axE3Aua',
      'Greater Uncivilized Tactics': 'pf1-content/4nQyV8fcKlXwHrMU',
      'Persuasive Bribery': 'pf1-content/5I8IqWgA3u58mdNS',
      'Raking Claws': 'pf1-content/5T0lsWOeAWshlhDr',
      'Reach Defense': 'pf1-content/4CyQ9388OBdSyRSA',
      'Saddle Shrieker': 'pf1-content/4GmlncOr1XUBbNCG',
      'Sea Legs': 'pf1-content/51jpPeUEXHMmhLt2',
      'Silent Kill': 'pf1-content/50d4HDBE77YUiJsr',
      "Sword's Shadow": 'pf1-content/5DN2CcbGHabhoqyt',
      "Warleader's Rage": 'pf1-content/4z0AT6yB21FoDSry',
    },
    references: [
      'pf1-content/EeBTvp6O7dgcBZ1p', // Uncivilized Tactics
      'pf1-content/S7OTt6BCTi8Lfi3G', // Anticipate Dodge
      'pf1-content/SRVhdjOa94P5alvP', // Improved Uncivilized Tactics
      'pf1/F9mKy0SmRo4bTdni', // Defensive Combat Training
      'pf1/FUW5mIXHNBBIQ1Sq', // Power Attack
      'pf1/Gy4jOckBEwMjByga', // Gillman
      'pf1/JOuAdPAOTat7d5v6', // Orc
      'pf1/JreaiTHdyWFNj3Tb', // Dodge
      'pf1/L10V7jTzmMYz62zz', // Persuasive
      'pf1/PsRZOF49ZKtorZbs', // Wyrwood
      'pf1/R7L4SlGRlnThqFrP', // Mobility
      'pf1/Rao7jnaGBzSbltiw', // Spiritual Interference
      'pf1/SMyexRzOm5PfjT5I', // Deft Hands
      'pf1/SUACufUXl12sUvnQ', // Deceitful
      'pf1/W8dxwZ1CZiwLKsqr', // Monk
      'pf1/bOv30pyHB1gFbSTj', // Goblin
      'pf1/dCAXgdA6Db1Z3ccz', // Half-Orc
      'pf1/efwHEwjvL9Z94MJI', // Gnome
      'pf1/f5rgOsdDlseGr4o5', // Elemental Channel
      'pf1/h9nHYLxXvIXBTmup', // Combat Reflexes
      'pf1/iDlGMIezGuqqt8Us', // Brawler
      'pf1/iYAQs7zjFbgcmect', // Spiritualist
    ],
  },
  'feats-337': {
    situationLookup: 'firstLocal',
    named: {
      'Champion of Destruction': 'pf1-content/6wE9ZpP8jLYFVklY',
      'Cockatrice Strike': 'pf1-content/6yivoRJHy6kQQJiC',
      'Deny the Reaper': 'pf1-content/6aAzfeJmedKbPI32',
      'Divine Expression': 'pf1-content/7RD7QkPB9mCVfNta',
      'Drunken Brawler': 'pf1-content/6WXYjEFwYg1vvic4',
      'Guarded Charge': 'pf1-content/7KWeCYlTveuC7cDB',
      'Linnorm Wrath': 'pf1-content/6nTc9JPQKOHwfSuS',
      'Marid Coldsnap': 'pf1-content/6U1yBxH0qeaKbswW',
      'Poised Bearing': 'pf1-content/7R0jl6uolQEiuLZ0',
      'Scarred Legion': 'pf1-content/5uVsdA6N00N3wBCe',
      'Shadow Dodge': 'pf1-content/632mceqeXgp9tesv',
      'Skill Focus (Lore)': 'pf1-content/6Unilb6yyaehF9fv',
      'Snake Sidewind': 'pf1-content/6HVdbIFcRuTq8o7p',
    },
    references: [
      'pf1-content/1NiYcDLPZqYUT0Jc', // Elemental Fist
      'pf1-content/2og5wHlKdftjSluF', // Marid Style
      'pf1-content/8OliKSsFDQ4SJzbB', // Linnorm Style
      'pf1-content/9vqye19n9rQN7DKt', // Linnorm Vengeance
      'pf1-content/FzsUZbC5NBUHzbkV', // Snake Style
      'pf1-content/KqYq0frwA9eGX4kT', // Marid Spirit
      'pf1/2aTFNMs3pW6nUBlr', // Improved Unarmed Strike
      'pf1/5JFfSqLMCpbRmERa', // Armor Training
      'pf1/5S0u8yFcP861wgd1', // Oracle
      'pf1/6GjOjO6r3R06fLwE', // Bard
      'pf1/7mD4ZksvKFaorAfj', // Shield Focus
      'pf1/SjFqQceVeVBzBwgn', // Cleric
      'pf1/W8dxwZ1CZiwLKsqr', // Monk
      'pf1/WLqBCT5DqmGAx8Wd', // Fighter
      'pf1/ehqx8txNRGMaNOPt', // Endurance
      'pf1/nhUawPP4jfED3CYV', // Gorgon's Fist
      'pf1/sOCyCmNxe2MBbEaI', // Medusa's Wrath
    ],
  },
  'feats-338': {
    situationLookup: 'firstLocal',
    named: {
      'Blood Frenzy Style': 'pf1-content/9Ag9jqvvt0aHeNQp',
      'Greater Beast Hunter': 'pf1-content/8d692lYaF5LANOp5',
      'Living Fortress': 'pf1-content/8OTcij4932nzIzRG',
      'Mindful Meditation': 'pf1-content/9H0MsZr5VztfEAbn',
      'Mobility (Mythic)': 'pf1-content/8c5lRyjVby1x3Uht',
      'Multiweapon Fighting': 'pf1-content/9KPpZm9saA3MAlfX',
      'Pure Faith': 'pf1-content/8ZH7NIEgfl2VWhiE',
      'Rubble Skirmisher': 'pf1-content/7sBsxsQ4gLdo6LtV',
      'Shrouded in Mystery': 'pf1-content/9FdasZwHD7j3DcQh',
      'Sisterhood Dedication': 'pf1-content/9DgQ03JpNPvPNVmh',
      'Skill Focus (Intimidate)': 'pf1-content/7mcNePI93Co2JbPF',
      'Snapping Turtle Shell': 'pf1-content/7lnI1o2zwwdcoJnT',
    },
    references: [
      'pf1-content/0T1qJaJqBRcShtQ7', // Orc Rampage
      'pf1-content/1LULpgVNjQWqUGUk', // Racial Heritage
      'pf1-content/1NiYcDLPZqYUT0Jc', // Elemental Fist
      'pf1-content/1Q8MEwLBfL0Wio3d', // Beast Hunter
      'pf1-content/2JWwVMFeqHnFDFSv', // Skill Focus (Stealth)
      'pf1-content/3sXWgtSieS07T7Tn', // Shielded Staff Style
      'pf1-content/9kzHExgVh5Dh3BAR', // Drunken Sing-Along
      'pf1-content/B58EUttFzN2TK7ls', // Snapping Turtle Clutch
      'pf1-content/CMZZYIe6hkKIQsxB', // Snapping Turtle Style
      'pf1-content/CwK258UrnfC3DYCV', // Siege Engineer
      'pf1-content/DFNAebu29dYDwiRH', // Perfect Style
      'pf1-content/FEKZXquPPDk2nv3R', // Cut from the Air
      'pf1-content/IkY9OtoaCpKEGVCv', // Brute Style
      'pf1-content/Kobg15t8PLRH2QSw', // Dispelling Blood
      'pf1-content/Lbo0n0mj1ELAxKVv', // Demoralizing Lash
      'pf1-content/PDRbZRKW3thdOIql', // Swift Refuge
      'pf1-content/PopIdrPioTyBwlQH', // Shield Wall
      'pf1-content/QEMM0xx0ZWIwHhoD', // Sisterhood Rampart
      'pf1-content/SSPSYd6W11iTNNwi', // Orc Fury Style
      'pf1-content/UGE5Ss1OVllGTnvk', // Brute Stomp
      'pf1-content/Zu2Gk9aejJSM5oPY', // Sisterhood Style
      'pf1-content/b9XUeZqIXLKk00yn', // Combat Meditation
      'pf1-content/e8YkUZicuswmniIe', // Bullying Blow
      'pf1-content/eRtIjceT7zNWoXD2', // Skyseeker Style
      'pf1-content/j2bq4CvpXtqkwWqL', // Bonded Mind
      'pf1-content/lGEPUZ3rLiw8OsKh', // Improved Beast Hunter
      'pf1-content/n9hti2aqK4IBTqZp', // Shaitan Style
      'pf1-content/oXr83ujeuqXySBy1', // Meditation Master
      'pf1-content/vrYRirtaE2eNm3nU', // Skyseeker Thrash
      'pf1-content/x2DOqdqO5I82TQtq', // Improved Blind-Fight
      'pf1-content/ysiVBfD42J1pcYyC', // Drow Nobility
      'pf1/0bZf3SDkvVOe2ujH', // Lightning Reflexes
      'pf1/19JcztRuEWbrOqQW', // Hobgoblin
      'pf1/2aTFNMs3pW6nUBlr', // Improved Unarmed Strike
      'pf1/2tq8HQ4ZQpiL3njr', // Frightening Appearance
      'pf1/5iXq1igb1Cq0qobT', // Woodland Stride
      'pf1/6BKIB9hjKwSJorAZ', // Fetchling
      'pf1/711B9WNFgpdDKKf2', // Improved Disarm
      'pf1/7mD4ZksvKFaorAfj', // Shield Focus
      'pf1/C5tWPm12qyz5ND9u', // Divine Health
      'pf1/E27lMw9YNOAjS009', // Bloodrager
      'pf1/Ee7JHADKEK37tTHs', // Two-Weapon Fighting
      'pf1/FUW5mIXHNBBIQ1Sq', // Power Attack
      'pf1/G2SqFdNKFxbujzbH', // Skald
      'pf1/GAoJIy6ycj3OovQT', // Kitsune
      'pf1/GsjouI6B8X7BA5wN', // Stunning Fist
      'pf1/HFab4vfATqdqnlSJ', // Blood Casting
      'pf1/JOuAdPAOTat7d5v6', // Orc
      'pf1/KQYCRLEdD4bGA5ak', // Evasion
      'pf1/L10V7jTzmMYz62zz', // Persuasive
      'pf1/LUOETW7Fm0oPKKWj', // Improved Dirty Trick
      'pf1/Mz8ZG6nqW3NKFZhK', // Step Up
      'pf1/NFxHebU1XhEs5WJh', // Combat Expertise
      'pf1/O0jbkTJcIji9BNiF', // Intimidating Prowess
      'pf1/R7L4SlGRlnThqFrP', // Mobility
      'pf1/SMyexRzOm5PfjT5I', // Deft Hands
      'pf1/V2zY7BltkpSXwejy', // Spell Focus
      'pf1/VMVAqGze4cs3naya', // Nimble Moves
      'pf1/Vaf5bV3wpk24pVt2', // Wayang
      'pf1/W8dxwZ1CZiwLKsqr', // Monk
      'pf1/WLqBCT5DqmGAx8Wd', // Fighter
      'pf1/Wkv124hVPATT35bm', // Aura
      'pf1/WnWRcte0jppClLpz', // Selective Channeling
      'pf1/Yder5QR51sDl5X0n', // Vishkanya
      'pf1/Yf5Wv9X09SUHYCqM', // Vigilante
      'pf1/ZVzH0qb1Tqety6fU', // Nagaji
      'pf1/ZmQkRk93nbHxsQSt', // Improved Grapple
      'pf1/aQ8RQYKVd2hqI4jh', // Samsaran
      'pf1/dCAXgdA6Db1Z3ccz', // Half-Orc
      'pf1/dn2KgHFQRbuoNRx0', // Improved Bull Rush
      'pf1/efwHEwjvL9Z94MJI', // Gnome
      'pf1/ehqx8txNRGMaNOPt', // Endurance
      'pf1/fVRnBIHR4Jq6btvm', // Great Fortitude
      'pf1/gTrGPxzN054GfpkM', // Improved Trip
      'pf1/go4xOiSUP8R1QJ5N', // Improved Overrun
      'pf1/h9nHYLxXvIXBTmup', // Combat Reflexes
      'pf1/hc7CRKHvhmKRzNKb', // Greater Grapple
      'pf1/iAbIGhm7T2OK9Brt', // Iron Will
      'pf1/iqJvhd7NbmybUl0y', // Undine
      'pf1/j6kgO6BAXKxKBV07', // Secret
      'pf1/n250dFlbykAIAg5Z', // Weapon Focus
      'pf1/nEltI9y37rKJTeWo', // Dwarf
      'pf1/nVjKDLZSRONzYm8f', // Tiefling
      'pf1/nWFr8SNcjcMqsXSH', // Spell Penetration
      'pf1/ohptcds1d5oG6Bjh', // Paladin
      'pf1/pmAO1Sni8xx71pLF', // Blind-Fight
      'pf1/r0oGCxDYVKC5NJF9', // Vicious Stomp
      'pf1/sPqP7QFldieWEADi', // Raging Song
      'pf1/tocde3sKG1O3GKgd', // Improved Feint
      'pf1/ubx4PIbRqmVT93Ds', // Gathlain
      'pf1/yAS41rHv0WzDmuRm', // Tengu
      'pf1/yLaDS5HGbwtgpkbP', // Drow
    ],
    every: [
      'pf1-content/7bCi7mC6Y31vC06S', // Fleeting Spell
      'pf1-content/7cSn25GzzMx5ixqx', // Green Faith Acolyte
      'pf1-content/7eTYCX2xwYPUqDZC', // Piercing Spell
      'pf1-content/7er84TQPDKSKPJIX', // Exceptional Aid
      'pf1-content/7fYuIg9Wa0kJhpR5', // Storm Breaker
      'pf1-content/7hzxx7OjiiCGxqeN', // Aural Insight
      'pf1-content/7i2uVUYd0h6qqKGP', // Owl Style
      'pf1-content/7juKTgNQrri6lVHZ', // Figment's Fluidity
      'pf1-content/7kXzR7h9UIjVVw2w', // Raging Concentration
      'pf1-content/7lVIDnHnrYYsYi9m', // Feint Defender
      'pf1-content/7lnI1o2zwwdcoJnT', // Snapping Turtle Shell
      'pf1-content/7m3FCJtk0QtLeU08', // Skyseeker Impact
      'pf1-content/7mcNePI93Co2JbPF', // Skill Focus (Intimidate)
      'pf1-content/7myQ3foxqbgbqpgU', // Shaitan Skin
      'pf1-content/7nTyaTRj7UYKFwdf', // Deep Breath
      'pf1-content/7os5oGMwIB7V3He0', // Lifebound
      'pf1-content/7pQ5ew0XWvQaT826', // Disarming Strike
      'pf1-content/7qWrIvngZEuYJsIi', // We are the Wall
      'pf1-content/7s5emlnRYQJu9t0y', // Primal Bloom
      'pf1-content/7sBsxsQ4gLdo6LtV', // Rubble Skirmisher
      'pf1-content/7u09cg6eiXLLuhbo', // Esoteric Enchantment
      'pf1-content/7uQl13dutfpV2QVS', // Flagbearer
      'pf1-content/7uUyZf0h8AzrX9uQ', // Fey Performance
      'pf1-content/7vPlu3V5epRurzlQ', // Inspired Alchemy
      'pf1-content/7wKFKyTQ97nci84x', // Saving Shield
      'pf1-content/7x1byHLp7haAp2Kw', // Empty Quiver Style
      'pf1-content/7xEMAu5OURbVbAzR', // Mystic Stride
      'pf1-content/7xn4GuXR7I9Ocaz8', // Nightmare Chains
      'pf1-content/7xq3GoMtw0AxfodD', // Read the Room
      'pf1-content/7yGCHvRnctkWk7hc', // Improved Shadowy Resistance
      'pf1-content/7zNdjxhVsyonOLfl', // Sacred Summons
      'pf1-content/80vvCMGUFQ1mnyPu', // Stunning Fist (Mythic)
      'pf1-content/81m93aPu01G6JN3u', // Racial Heritage (Mythic)
      'pf1-content/83IUg26MqrB9ZtpN', // Improved Day Job
      'pf1-content/86WJUgilNgbeQXBH', // Disengaging Feint
      'pf1-content/87XQiDFDidOPNcnE', // Apocalyptic Spell
      'pf1-content/89GcUu0pefcNfiYd', // Taskmaster
      'pf1-content/8A5sOTDf8TcYcit3', // Contingent Channeling
      'pf1-content/8H3JpY7wvILavyQR', // Perfect Center
      'pf1-content/8HeeXrqcRf9izsTi', // Shielded Staff Ambush
      'pf1-content/8HktdAvoTOMuLCqN', // Improved Drow Nobility
      'pf1-content/8IeU7xLBAeTGVhH1', // Threatening Illusion
      'pf1-content/8JdkzS1uOOlo4mbH', // Improved Fiendish Sorcery
      'pf1-content/8KUTke2PnCwhGWMs', // Command Animals
      'pf1-content/8L2spYZBXBoYPHXQ', // Fiendish Facade
      'pf1-content/8LWVbhO84S1C98O7', // Dimensional Agility
      'pf1-content/8OByNc9LgQW9rbdn', // Summon Good Monster
      'pf1-content/8OTcij4932nzIzRG', // Living Fortress
      'pf1-content/8OliKSsFDQ4SJzbB', // Linnorm Style
      'pf1-content/8RzIeYtbx0UtXUge', // Gnome Weapon Focus
      'pf1-content/8Tr1v14whKtCW6YS', // Precipice Strike
      'pf1-content/8VWrHUcibOZXgSJk', // Brute Assault
      'pf1-content/8Vk5Fih3kAgjcUkE', // Stouthearted
      'pf1-content/8W2d3R4FDNPzS4TS', // Pinning Rend
      'pf1-content/8WmgLeVMlIb0PduB', // Piercing Gambit
      'pf1-content/8ZH7NIEgfl2VWhiE', // Pure Faith
      'pf1-content/8ZvLLfdHLiSxT2gM', // Cartwheel Dodge
      'pf1-content/8c5lRyjVby1x3Uht', // Mobility (Mythic)
      'pf1-content/8cG6jw3PwAWSswjZ', // Vile Leadership
      'pf1-content/8d692lYaF5LANOp5', // Greater Beast Hunter
      'pf1-content/8dLShByVQsHTDRmp', // Swift Iron Style
      'pf1-content/8dXL9enEFbCXps0y', // Thrune Trusted Agent
      'pf1-content/8fqHXrzWbqx1KSXI', // Agent of Fear
      'pf1-content/8go7Y4Exf5kPKdel', // Fearsome Spell
      'pf1-content/8jHSTBlp9U8lVksX', // Flagellant
      'pf1-content/8klLISVAhZaORVGY', // Aspiring Noble
      'pf1-content/8l769WycvRuJP5BR', // Colleague
      'pf1-content/8lFkBBpwJsUc6RjK', // Hydroponic Adaptation
      'pf1-content/8lQDCIkC91IaL6bT', // Amplified Rage
      'pf1-content/8niIB9O6b9A7mpsA', // Fortitude of Giants
      'pf1-content/8nydywvlQQUOaO3X', // Unraveling Blood
      'pf1-content/8ozUaQzeHfznCz5W', // Triton Portal
      'pf1-content/8pL1KdStgKXCpZ1a', // Infernal Legist
      'pf1-content/8uIm6rln5uALhVjp', // Walking Sleight
      'pf1-content/8yCBpbIFdYDJQr5J', // Tidal Swiftness
      'pf1-content/8zr8UPy0B1JcdHp3', // Secret of Magical Discipline
      'pf1-content/94Z1f558q9ThnQZX', // Unblinking Flame Feint
      'pf1-content/94fmZNDHH0J8ivyr', // Al-Zabriti-Trained Horse
      'pf1-content/99nJ5bhobSjKY4z5', // Blackfire Summoning
      'pf1-content/9Ag9jqvvt0aHeNQp', // Blood Frenzy Style
      'pf1-content/9AkGzkQcltYub4CL', // Spellcut
      'pf1-content/9CHpFMg8zbvQpWrO', // Intimidating Prowess (Mythic)
      'pf1-content/9Ck7Q7cN4YHk5knc', // Reviving Channel
      'pf1-content/9CxdA7vteOVJvXv8', // Shapeshifter Foil
      'pf1-content/9DgQ03JpNPvPNVmh', // Sisterhood Dedication
      'pf1-content/9ETCsMI5tRlogbp2', // Undead Master
      'pf1-content/9EWasYXjy1UwLGp3', // Orc Snarl
      'pf1-content/9FdasZwHD7j3DcQh', // Shrouded in Mystery
      'pf1-content/9G86I5OcFsXKRK1I', // True Breed
      'pf1-content/9GTR0hH5PUgKJZFA', // Structural Strike
      'pf1-content/9H0MsZr5VztfEAbn', // Mindful Meditation
      'pf1-content/9H6UC6zca8qkcehU', // Dirty Grapple
      'pf1-content/9I5I367ZHaiq7NAG', // Merciless Rush
      'pf1-content/9J481bDyFVAnCYwk', // Swift Sprint
      'pf1-content/9KPpZm9saA3MAlfX', // Multiweapon Fighting
      'pf1-content/9NKsSplycGxpA3ZV', // Cannon Master
      'pf1-content/9P4CubZrJ73u9zpf', // Muddled Morals
      'pf1-content/9P9SlKlY48XwycfI', // Topple Foe
      'pf1-content/9VBxeJWRESTGtW0O', // Spell Drinker
      'pf1-content/9cnHk5PluNEk2lq3', // Corpse Companion
    ],
  },
  'feats-339': {
    situationLookup: 'firstLocal',
    named: {
      'Coordinated Maneuvers': 'pf1-content/9dRwUyYiX5zsX3ce',
      'Death or Glory': 'pf1-content/B3D3sXpydYZrgAuB',
      'Fire Music': 'pf1-content/A5G2JSutPtb3Zu6f',
      'Hunter of Dahak': 'pf1-content/9htxXjKcTrpnLV3K',
      'Inspiring Talent': 'pf1-content/AgKqp4SiaLWedmLp',
      'Raging Throw': 'pf1-content/Apa31k0RsrrszJxP',
      'Rugged Northerner': 'pf1-content/9jrqbK4v19adzhg6',
      'Skaveling Companion': 'pf1-content/B8d0MfBlPzpcgPwJ',
      'Skill Focus (Perception)': 'pf1-content/9yua5ZlomvDj1c7D',
      'Solo Maneuvers': 'pf1-content/B4dU0x55LFOQ1T4F',
      'Standing Tall': 'pf1-content/AxRcBm1ZhOgO4sRv',
      'Uncanny Ally': 'pf1-content/BFXEPIwPk7sAQlwd',
      Vengeance: 'pf1-content/9jrrXnyZpXqngbhW',
      'Wolf Trip': 'pf1-content/AxIIwCjMWjPooLOw',
    },
    references: [
      'pf1-content/1xPJLkwc0brIc0g4', // Fearless Curiosity
      'pf1-content/2JWwVMFeqHnFDFSv', // Skill Focus (Stealth)
      'pf1-content/3Tw2gRYuC909HYKu', // Nerve-Racking Negotiator
      'pf1-content/3YUjz00cIW0jgeOF', // Street Style
      'pf1-content/7i2uVUYd0h6qqKGP', // Owl Style
      'pf1-content/7mcNePI93Co2JbPF', // Skill Focus (Intimidate)
      'pf1-content/8OliKSsFDQ4SJzbB', // Linnorm Style
      'pf1-content/CMZZYIe6hkKIQsxB', // Snapping Turtle Style
      'pf1-content/DBqrVvDTZlxhEcI4', // Angelic Flesh
      'pf1-content/FIT8Ya1y6UV9xlHi', // Stock-Striker Style
      'pf1-content/GyO1NLDcRtdre6hd', // Angel Wings
      'pf1-content/IOPS4W1mVH76IgxX', // Greater Blind-Fight
      'pf1-content/MnvXDXnoMI18lO6Q', // Angelic Blood
      'pf1-content/POguLp8c7EdbOjhQ', // Dispel Focus
      'pf1-content/T72iv6EFch4QINIG', // Sabotaging Sunder
      'pf1-content/TfNHuLddN4Vm9VQa', // Blinded Competence
      'pf1-content/VpP8i9C2CsGN430M', // Final Embrace Horror
      'pf1-content/XsCuzUrK8UUa6DUN', // Blinded Blade Style
      'pf1-content/ft149JvGjJ7Cn3eP', // Hidden Presence
      'pf1-content/gVzjGq0jWZrlWm48', // Wolf Style
      'pf1-content/hB5R3di0387Zb2Uk', // Manipulative Presence
      'pf1-content/hv9hfAZJ1FVwjdeQ', // Divine Defiance
      'pf1-content/jIwfOsg6dGv2JJo3', // Kirin Strike
      'pf1-content/jcqOYxH8FNQCau12', // Allied Spellcaster
      'pf1-content/tK85SufzMoPuxy4B', // Kirin Style
      'pf1-content/x2DOqdqO5I82TQtq', // Improved Blind-Fight
      'pf1/26k1Gi7t5BoqxhIj', // Vital Strike
      'pf1/2aTFNMs3pW6nUBlr', // Improved Unarmed Strike
      'pf1/3cq9YbgcMrAXC76j', // Dazzling Display
      'pf1/5op6M5xchCJNsYRt', // Bloodrage
      'pf1/6BKIB9hjKwSJorAZ', // Fetchling
      'pf1/711B9WNFgpdDKKf2', // Improved Disarm
      'pf1/7WaQxnVaaoL4AGr8', // Uncanny Dodge
      'pf1/9FBT6uqlRgaw9gug', // Changeling
      'pf1/A54sLfcyoR5HGNbP', // Poison Use
      'pf1/B6wEQOUMv2ifm2Nj', // Acrobatic Steps
      'pf1/C7UgLJt7yRHnAqyG', // Poison Lore
      'pf1/CLSsMyNmdcNAOUKC', // Magical Aptitude
      'pf1/CjLNTqNGz4zU4zpp', // Command Undead
      'pf1/E27lMw9YNOAjS009', // Bloodrager
      'pf1/FHY3oIk5zSOFncJH', // Aasimar
      'pf1/FUW5mIXHNBBIQ1Sq', // Power Attack
      'pf1/GK6rAenFfgJNNJCX', // Arcanist
      'pf1/GsjouI6B8X7BA5wN', // Stunning Fist
      'pf1/HKRRq2tdZVEGlmHG', // Duskwalker
      'pf1/Hf31mrYb3uucNyLO', // Halfling
      'pf1/I34hZ82Wa8O0ibpX', // Spit Venom
      'pf1/IWcbDa0ITsDdiHjo', // Ki Throw
      'pf1/JSPFo2fBkNlrtVqi', // Bodyguard
      'pf1/JreaiTHdyWFNj3Tb', // Dodge
      'pf1/KPaC3H6EQGG4sXLT', // Awesome Blow
      'pf1/L10V7jTzmMYz62zz', // Persuasive
      'pf1/LUOETW7Fm0oPKKWj', // Improved Dirty Trick
      'pf1/NFxHebU1XhEs5WJh', // Combat Expertise
      'pf1/O0e0UCim27GPKFuW', // Diehard
      'pf1/Q1cY8r0Pvb66pMG0', // Alertness
      'pf1/QvlxYVVsBDlykPKe', // Arcane Strike
      'pf1/R7L4SlGRlnThqFrP', // Mobility
      'pf1/RC4D4WFT5kRKkdqp', // Witch
      'pf1/SUACufUXl12sUvnQ', // Deceitful
      'pf1/Uuiu3p982omhMEPj', // Improved Initiative
      'pf1/V2zY7BltkpSXwejy', // Spell Focus
      'pf1/VMVAqGze4cs3naya', // Nimble Moves
      'pf1/W8dxwZ1CZiwLKsqr', // Monk
      'pf1/XmALhWqXdN9yOmtd', // Favored Enemy
      'pf1/ZVzH0qb1Tqety6fU', // Nagaji
      'pf1/ZmQkRk93nbHxsQSt', // Improved Grapple
      'pf1/bHcqTC4Lf3aVl3VO', // Snatch Arrows
      'pf1/cCepRrfH5SalFfT4', // Half-Elf
      'pf1/dn2KgHFQRbuoNRx0', // Improved Bull Rush
      'pf1/e6IaBxKgMxy1yKlr', // Human
      'pf1/ehqx8txNRGMaNOPt', // Endurance
      'pf1/fVRnBIHR4Jq6btvm', // Great Fortitude
      'pf1/gTrGPxzN054GfpkM', // Improved Trip
      'pf1/gZxiUYLYsGqQYwGZ', // Ogre
      'pf1/h9nHYLxXvIXBTmup', // Combat Reflexes
      'pf1/iAbIGhm7T2OK9Brt', // Iron Will
      'pf1/iYAQs7zjFbgcmect', // Spiritualist
      'pf1/lpXdFoT6OqS5vi2X', // Improved Sunder
      'pf1/nVjKDLZSRONzYm8f', // Tiefling
      'pf1/ohptcds1d5oG6Bjh', // Paladin
      'pf1/pmAO1Sni8xx71pLF', // Blind-Fight
      'pf1/r8wPs0bB3WhOLxbX', // Track
      'pf1/ryQboCpsLfFBCzdL', // Phantom
      'pf1/s27zdYVFenYBVtfu', // Investigator
      'pf1/tHObxrPeyhimmz9V', // Channel Positive Energy
      'pf1/tlRu8SYjzA7WCHN7', // Scribe Scroll
      'pf1/vWiTqHC4Y3Xn1Pme', // Weapon Finesse
      'pf1/w3wjj6s3N69BsMc3', // Ranger
      // Context key: Uncanny Dodge is also a Rogue feature, so Uncanny Ally's
      // prerequisite names no owning class.
      'pf1/24b0LaabeAlUx5gN', // Rogue
    ],
    every: [
      'pf1-content/9dRwUyYiX5zsX3ce', // Coordinated Maneuvers
      'pf1-content/9e2yq5XuaKc1rLGh', // Versatile Summon Monster
      'pf1-content/9fKxqvJRHXjShhDp', // Overwhelming Phantom
      'pf1-content/9fw7tNnUaJXfssbk', // Retributive Kick
      'pf1-content/9hWv0960cmj5XGGr', // Snatch Arrows (Mythic)
      'pf1-content/9hqpLULoaEgyRzYo', // Authoritative Spell
      'pf1-content/9htxXjKcTrpnLV3K', // Hunter of Dahak
      'pf1-content/9ia6J9PPb4N0OpCf', // Raging Absorption
      'pf1-content/9ihJ2Gl0cFxdHDI1', // Mascot's Affection
      'pf1-content/9jlqDG2ARpIE6gB6', // Dragoncrafting
      'pf1-content/9jrqbK4v19adzhg6', // Rugged Northerner
      'pf1-content/9jrrXnyZpXqngbhW', // Vengeance
      'pf1-content/9kzHExgVh5Dh3BAR', // Drunken Sing-Along
      'pf1-content/9m8qZK7axA9BwEWL', // Cut Your Losses
      'pf1-content/9mAlheli90Dh6195', // Wicked Valor
      'pf1-content/9o4psZb9HIRNVCVh', // Kirin Path
      'pf1-content/9pD9UgFjpyGIagDA', // Ostentatious Weakness
      'pf1-content/9rsijkdfw6akga33', // Tapestry Traveler
      'pf1-content/9s8mHKEIkrCXP69Q', // Blinded Master
      'pf1-content/9sIFTGLhnNUBZyNg', // Veiled Contempt
      'pf1-content/9tMbXGTHg626HSp2', // Intrusive Presence
      'pf1-content/9ubHsYXOSfZpc6RS', // Rat Catcher
      'pf1-content/9v03YUcH6cF8YWnk', // Cypher Magic
      'pf1-content/9vqye19n9rQN7DKt', // Linnorm Vengeance
      'pf1-content/9x0337mM7naJTGCG', // Subtle Enchantments
      'pf1-content/9xGvJrdkXxcIzaOn', // Infectious Weapons
      'pf1-content/9xKTjLWPs3genBPY', // Intimidating Confidence
      'pf1-content/9xgc3SiDuOULDePH', // Familiar Link
      'pf1-content/9yua5ZlomvDj1c7D', // Skill Focus (Perception)
      'pf1-content/A0IxVIjBMBBzFCpn', // Performing Combatant
      'pf1-content/A3vecllj3fqq5eER', // Enhanced Coven
      'pf1-content/A4J42zZNpgKhgKI7', // Binding Throw
      'pf1-content/A5G2JSutPtb3Zu6f', // Fire Music
      'pf1-content/A5GuCqMZVH8H6hi4', // Daggermark Lore
      'pf1-content/A6lPbEJigQpUS4kV', // Monitor Obedience
      'pf1-content/AAKX1tJKJRjCZnT7', // Unstoppable Esotery
      'pf1-content/ABcDhcXLpa377PUt', // Bear's Balance
      'pf1-content/AC1Hle0YL1CwdMgu', // Storm of Blades
      'pf1-content/ACpJJIleQPkFhOcr', // Grasping Strike
      'pf1-content/ADUbhd44CFzAm1IR', // Versatile Jinx
      'pf1-content/AEgF9fHk9qUkt4cd', // Owl Swoop
      'pf1-content/AFr1uHe1ExWMoJL4', // Divine Denouncer
      'pf1-content/AGaFV9sNK32t5UZb', // Shapeshifter Style
      'pf1-content/AJhiWCuZ69ClhRxI', // Fiendish Obedience
      'pf1-content/AKnHCUqeqNa1Pf7S', // Lucky Healer
      'pf1-content/AL03Bv7fBRYWTj0M', // Stylized Spell
      'pf1-content/ALERwfU4DWTT4IFb', // Unraveler of Secrets
      'pf1-content/AMva6nB7FvGBqJfY', // Blooded Arcane Strike
      'pf1-content/AO98fNuempNBtdY0', // Greater Dispel Focus
      'pf1-content/AOTdQuzFtuo8TLCk', // Personal Chronicler
      'pf1-content/APN0XhRseCV7K2DJ', // Lion's Heart
      'pf1-content/AR9Kt2UwOzu6Xs1x', // Monstrous Disguise
      'pf1-content/ARmzuwIYLw563Jxz', // Metallic Wings
      'pf1-content/ATPrsTmSLLwTBVcZ', // Wind Leaper
      'pf1-content/AWSl3hjAtT3wWtWy', // Crushing Blow
      'pf1-content/AWbHuUTcceeZ5Wxr', // Brash Stride
      'pf1-content/AXr2k74CBg9sKnYd', // Viscous Venom
      'pf1-content/AYhu7d6QTq5rRLeA', // False Casting
      'pf1-content/AayU5wKBOAnKB9DG', // Final Embrace
      'pf1-content/AfEnGnWDCxCMtQu0', // Command Undead (Mythic)
      'pf1-content/AfRGMbZLpTE5dMVm', // Twilight Tattoo
      'pf1-content/AfkzMX0kW4cA8j5A', // Heroic Recovery
      'pf1-content/AgKqp4SiaLWedmLp', // Inspiring Talent
      'pf1-content/AhVDmtvZyFYrRKCB', // Greater Awesome Blow
      'pf1-content/AhjO45NKfHVxd1br', // Metamagical Synergy
      'pf1-content/AlVNljHAgoaQeOFQ', // Ogre Crush
      'pf1-content/AnM6jef6ukr6PKBW', // Terrain Celerity
      'pf1-content/AnnhZwmTfHpuzEzy', // Crypt Spell
      'pf1-content/Ao4RRnfTz492vvli', // Piranha Strike
      'pf1-content/AoQdmyazxZR6vFXP', // Street Sweep
      'pf1-content/Apa31k0RsrrszJxP', // Raging Throw
      'pf1-content/Ape1YrFyqyYq1ZMY', // Thousand Cuts
      'pf1-content/AqTsnqsGHdVlJzFa', // Protector of the People
      'pf1-content/AqXrIMzX6HnvLWnS', // Scarlet Rose Devotion
      'pf1-content/AqnY19qWobuQf3mx', // Final Embrace Master
      'pf1-content/AsI2LWTyi01HLLrY', // Thrill of the Hunt
      'pf1-content/AslD03spaoWrpAiM', // Go Unnoticed
      'pf1-content/AtikQ9nkFTCYQ6di', // Divine Deception
      'pf1-content/Av67GzsPJ0qjipZ1', // False Opening
      'pf1-content/AxIIwCjMWjPooLOw', // Wolf Trip
      'pf1-content/AxRcBm1ZhOgO4sRv', // Standing Tall
      'pf1-content/AyPASAXBqinzDiHd', // Stalker's Focus
      'pf1-content/AzGjqWHY26fz5v0I', // Shadow Walker
      'pf1-content/B0sMkd93YZw1PnD1', // Beast Speaker
      'pf1-content/B16M9eNce1OL8819', // Battle Planner
      'pf1-content/B2hfI6ktB2RSbBVY', // Spell Denial
      'pf1-content/B2oOXjH6NhfwTfgz', // Ghostslayer
      'pf1-content/B3D3sXpydYZrgAuB', // Death or Glory
      'pf1-content/B4Lc1O1XdZiXAs3X', // Wild Growth Channel
      'pf1-content/B4dU0x55LFOQ1T4F', // Solo Maneuvers
      'pf1-content/B4xettlCyD3lfYIR', // Stock-Striker Sweep
      'pf1-content/B58EUttFzN2TK7ls', // Snapping Turtle Clutch
      'pf1-content/B5x292BTpmI3exy7', // Joined Wings
      'pf1-content/B6SsXZXwX4m587OD', // Threatening Negotiator
      'pf1-content/B7uIjic56RrbxSDg', // Dirty Disarm
      'pf1-content/B8d0MfBlPzpcgPwJ', // Skaveling Companion
      'pf1-content/BCFuekJRltIzSfCi', // Heroic Interposition
      'pf1-content/BE53kpCr9pzw3GWf', // Expanded Preparation
      'pf1-content/BFXEPIwPk7sAQlwd', // Uncanny Ally
      'pf1-content/BFzft7mOf5SSgzyk', // Improved Sabotaging Sunder
    ],
  },
  'feats-340': {
    situationLookup: 'firstLocal',
    named: {
      'Alertness (Mythic)': 'pf1-content/Cj4YDc7f4udWdFHE',
      'Aspect of the Beast (Mythic)': 'pf1-content/CTawkqcZekDnv7sI',
      'Bear Hug': 'pf1-content/CAD36Yu0rrz8rFDi',
      'Dodge (Mythic)': 'pf1-content/CGwyzI63QGz9WPRn',
      'Horse Whisperer': 'pf1-content/D5tCQniPXdKEUI7J',
      Ironguts: 'pf1-content/CDOlZRjwaOs2Q2fe',
      'Skill Focus (Knowledge [Local])': 'pf1-content/CT5OvOkf7Z2KxPxa',
      'Snapping Turtle Style': 'pf1-content/CMZZYIe6hkKIQsxB',
    },
    references: [
      'pf1-content/1NiYcDLPZqYUT0Jc', // Elemental Fist
      'pf1-content/6arJOSFF6vUHDPdS', // Incredible Healer
      'pf1-content/8RzIeYtbx0UtXUge', // Gnome Weapon Focus
      'pf1-content/B0sMkd93YZw1PnD1', // Beast Speaker
      'pf1-content/DjQcdUFGrvolBeAE', // Illusive Gnome Surprise
      'pf1-content/ECyLUubv5HWmYv1U', // Eldritch Heritage
      'pf1-content/GtDonPy6v4QS9xca', // Untwisting Iron Strength
      'pf1-content/Jb7UHhvoipN3tPfE', // Balor Whip
      'pf1-content/KHxg5rhzeUTkFTc5', // Crashing Wave Buffet
      'pf1-content/MnvXDXnoMI18lO6Q', // Angelic Blood
      'pf1-content/Qw4JZkGkD1PiP0U1', // Lucid Dreamer
      'pf1-content/V9zVLrLpYiPeiEJS', // Stone Shroud
      'pf1-content/VwpZXgXnOAVV2LxO', // Crashing Wave Style
      'pf1-content/WONOffiRAPS2vErv', // Ascetic Style
      'pf1-content/ZFEJs5h1WKI9qsVO', // Dwarven Hatred Style
      'pf1-content/auoxkZdAB3hRkX7b', // Nameless One
      'pf1-content/b4NrtJVllcOQgmzF', // Attuned to the Wild
      'pf1-content/cAKU5yW6r3pBZ28g', // Hurtful
      'pf1-content/fx5MVO1TD33R4vwi', // Wyvern Fury Style
      'pf1-content/hpPZz5taf2jU7FC9', // Wyvern Sting
      'pf1-content/jt9sG14WScWd8puF', // Improved Balor Whip
      'pf1-content/nVcufYFBdNdCXE6T', // Dwarven Seething
      'pf1-content/osqUFAvJMKo2hwi6', // Vanguard Style
      'pf1-content/pUmoxJHnoITAStYq', // Whip Mastery
      'pf1-content/qJSildMF4Jkj93Fy', // Channel Force
      'pf1-content/r6Ytpa6jCtZovGHf', // Guardian of the Wild
      'pf1-content/ruBNJZPjwq1HbmPs', // Illusive Gnome Style
      'pf1-content/tHe1gBakQvcD75CV', // Sociable
      'pf1-content/vuqCqcFXIleTkBTm', // Beartrap Bite
      'pf1/0ahLHNR2864mih3n', // Psychic
      'pf1/1HfwfBOSWtdxFQ2s', // Improved Channel
      'pf1/26k1Gi7t5BoqxhIj', // Vital Strike
      'pf1/2aTFNMs3pW6nUBlr', // Improved Unarmed Strike
      'pf1/3cq9YbgcMrAXC76j', // Dazzling Display
      'pf1/711B9WNFgpdDKKf2', // Improved Disarm
      'pf1/7mD4ZksvKFaorAfj', // Shield Focus
      'pf1/8rsFtye3PwM6CKli', // Point-Blank Shot
      'pf1/8snLqsJN4LLL00Nq', // Toughness
      'pf1/AoWSbnuTSGIxmv61', // Sorcerer
      'pf1/BOUqxGDega0y1JOX', // Psychic Discipline
      'pf1/CYHloH6aEnfgdxAV', // Improved Reposition
      'pf1/EbVLpbO2masMTMBC', // Painful Stare
      'pf1/Ee7JHADKEK37tTHs', // Two-Weapon Fighting
      'pf1/F5mCXQR9VZfKfpTH', // Sorcerer Bloodline
      'pf1/FHY3oIk5zSOFncJH', // Aasimar
      'pf1/FUW5mIXHNBBIQ1Sq', // Power Attack
      'pf1/Fv3FbmXptuDRiL5y', // Inquisitor
      'pf1/JNlMhMhcDO8wkXiw', // Critical Focus
      'pf1/JOuAdPAOTat7d5v6', // Orc
      'pf1/JSPFo2fBkNlrtVqi', // Bodyguard
      'pf1/JreaiTHdyWFNj3Tb', // Dodge
      'pf1/L9DSWVtX0siTfaXL', // Second Judgment
      'pf1/LUOETW7Fm0oPKKWj', // Improved Dirty Trick
      'pf1/NFxHebU1XhEs5WJh', // Combat Expertise
      'pf1/NgIhxRI0axrf3fcO', // Elf
      'pf1/Q1cY8r0Pvb66pMG0', // Alertness
      'pf1/R7L4SlGRlnThqFrP', // Mobility
      'pf1/RNIkkvqaq2iVrahs', // Aura of Courage
      'pf1/SjFqQceVeVBzBwgn', // Cleric
      'pf1/TbOPtIL8Fv8obXtP', // Improved Critical
      'pf1/V2zY7BltkpSXwejy', // Spell Focus
      'pf1/W8dxwZ1CZiwLKsqr', // Monk
      'pf1/WKIVfdosc5SqYzmP', // Quick Draw
      'pf1/ZmQkRk93nbHxsQSt', // Improved Grapple
      'pf1/bZ1YdzkT8NtRIEJ4', // Catch Off-Guard
      'pf1/bqoIfsrF8BF1GC28', // Animal Affinity
      'pf1/cCepRrfH5SalFfT4', // Half-Elf
      'pf1/dCAXgdA6Db1Z3ccz', // Half-Orc
      'pf1/dPLj98GIzbwcoOjn', // Aspect of the Beast
      'pf1/e1zIVW9AcrmRrYvx', // Improved Drag
      'pf1/e6IaBxKgMxy1yKlr', // Human
      'pf1/efwHEwjvL9Z94MJI', // Gnome
      'pf1/fLU25FvuRWMCSxPP', // Mesmerist
      'pf1/fX9F2amW2BcYoHwb', // Svirfneblin
      'pf1/ftBTltVkin3Ko3NJ', // Channel Smite
      'pf1/go4xOiSUP8R1QJ5N', // Improved Overrun
      'pf1/h9nHYLxXvIXBTmup', // Combat Reflexes
      'pf1/n250dFlbykAIAg5Z', // Weapon Focus
      'pf1/nEltI9y37rKJTeWo', // Dwarf
      'pf1/nVjKDLZSRONzYm8f', // Tiefling
      'pf1/nWFr8SNcjcMqsXSH', // Spell Penetration
      'pf1/ohptcds1d5oG6Bjh', // Paladin
      'pf1/rAKaCt6BW3rVv2kN', // Ratfolk
      'pf1/tGDNVHHZnNFPPgiY', // Two-Weapon Rend
      'pf1/tocde3sKG1O3GKgd', // Improved Feint
      'pf1/vWiTqHC4Y3Xn1Pme', // Weapon Finesse
      'pf1/vh9TZBE6BRu9sCfE', // Kineticist
      'pf1/x9TM9MHoUl4cv9Ht', // Elemental Focus
    ],
    every: [
      'pf1-content/BGeX1TF0o5RVxDir', // Pile On
      'pf1-content/BHkjYkL8Xj50Sexo', // Untwisting Iron Skin
      'pf1-content/BIZVOXFVwsn7n55D', // Improved Infuse Weapon
      'pf1-content/BOEgQVvJQ7FryWty', // Cornugon Smash
      'pf1-content/BOeOzbrAMOe2MUNB', // Improved Overrun (Mythic)
      'pf1-content/BQz1tSIvJDc4GJKV', // Ascetic Form
      'pf1-content/BRLawnEmlo46shsl', // Favored Community
      'pf1-content/BRQdtFwqqLnoy6ru', // Entwining Stare
      'pf1-content/BS9f4Laz0OjoaT1i', // Shared Judgment
      'pf1-content/BTrciHHPtsTY01Hq', // Two-Weapon Feint
      'pf1-content/BUUjILPiuVhGxC6j', // Night Sky Hex
      'pf1-content/BV4UnirQEKaeDwue', // Vanguard Ward
      'pf1-content/BWBVdB9mTeHtNlLF', // Mobile Bulwark Style
      'pf1-content/BaRKymiXKhOtTxLs', // Improved Channel Force
      'pf1-content/BcLpUt7Sl9363KJf', // Eagle Eyes
      'pf1-content/BjE4MMDe2ZvtDnzT', // Sociable (Mythic)
      'pf1-content/BjdqKKujIzBu5fBH', // Steadfast Mind
      'pf1-content/BjlTYGbUO3q1Wklr', // Spell Penetration (Mythic)
      'pf1-content/Bk0jogQbMfATwadz', // One Eye Open
      'pf1-content/Blkn380DkM6kDDxy', // Fast Learner
      'pf1-content/BlxGSuOpeNvfIDF5', // Destructive Persuasion
      'pf1-content/Bnrm9M57KOEpvsfn', // Half-Drow Paragon
      'pf1-content/Bnxt2qLEtYLisUod', // Whip-Shot Deed
      'pf1-content/BpGhMFNIM3o97Uav', // Beast Speaker Mastery
      'pf1-content/BqRpzOMZ4mfamxzQ', // Stoic Pose
      'pf1-content/BrWYYYDVVs2qe1vg', // Kinetic Invocation
      'pf1-content/BsBPpTo3Hbt6fHAN', // Brisk Spell
      'pf1-content/BwLiYTpZQwFFvObu', // Pernicious Stab
      'pf1-content/BwiuB1mOf1VNIpOC', // Tribal Hunter
      'pf1-content/BxoecjSIwr9V9jNk', // Strangler (MC)
      'pf1-content/ByYctDNbuBGmNDz0', // Practiced Ritualist
      'pf1-content/C0Pu4Zc4TroBAyV6', // Crashing Wave Fist
      'pf1-content/C0idCYRnFI5RUWTO', // Two-Weapon Rend (Mythic)
      'pf1-content/C21z5LlIXxmH1CPq', // Arming Grab
      'pf1-content/C3LCmKrCBLoyOZMF', // Coordinated Shot
      'pf1-content/C3TCjC05vxEo6K58', // Spirit of the Wild
      'pf1-content/C3bjEVrgVbdcMaj6', // Pathologist
      'pf1-content/C41l28Z5S36vVVCa', // Helpless Prisoner
      'pf1-content/C44V7euMz1lVx74R', // Illusive Gnome Bewilderment
      'pf1-content/C4oIFrr6uzL2kxn8', // Disciplinary Devotee
      'pf1-content/C5CkfxU3RBKTkLGl', // Energy Mastery
      'pf1-content/C93Box1Oy2Fllwhe', // Body Shield
      'pf1-content/CAD36Yu0rrz8rFDi', // Bear Hug
      'pf1-content/CBwHFIEsveSjGtY8', // Masked Intent
      'pf1-content/CD55JhcikugqaKAI', // Wand Dancer
      'pf1-content/CD9hIjvcicJ1j1nr', // Hero's Display
      'pf1-content/CDOlZRjwaOs2Q2fe', // Ironguts
      'pf1-content/CGKJrAvv0HaDJfCD', // Djinni Style
      'pf1-content/CGwyzI63QGz9WPRn', // Dodge (Mythic)
      'pf1-content/CIRC8njU24dCQPWE', // Numbing Blow
      'pf1-content/CKDodmvuv791Zh6Q', // Dirty Critical Hit
      'pf1-content/CLfVSSqawbVY0aDV', // Sharptooth
      'pf1-content/CMZZYIe6hkKIQsxB', // Snapping Turtle Style
      'pf1-content/CO2Qmj0aj76zJsew', // Spell Specialization
      'pf1-content/CQzrS1YXLbNoCntn', // Stronghold
      'pf1-content/CSr9tqZiLFKPsKJc', // Practiced Dreamer
      'pf1-content/CT5OvOkf7Z2KxPxa', // Skill Focus (Knowledge [Local])
      'pf1-content/CTXRDCXQRyjH4CCL', // Raging Blood
      'pf1-content/CTawkqcZekDnv7sI', // Aspect of the Beast (Mythic)
      'pf1-content/CUUjEcHuPHFqyTBJ', // Sniper's Lantern
      'pf1-content/CVPIMGxnGD0yf6pF', // Disciple of the Sword
      'pf1-content/CWkeN6NFv3HPuk7h', // Wyvern Wing
      'pf1-content/CWvuu64Po8cNDbgi', // Echoing Spell
      'pf1-content/CZPFbXtRnYZi6yQk', // Combat Patrol
      'pf1-content/Ca5qvzJUvXnnCOyh', // Dragonbane Aura
      'pf1-content/CcXmEc6a5M5DXwjd', // Blinding Stare
      'pf1-content/CccEWDPLMwk1QTs6', // Channel Endurance
      'pf1-content/Cg5RKIvUqBZlHxCM', // Mauler's Endurance
      'pf1-content/Cj4YDc7f4udWdFHE', // Alertness (Mythic)
      'pf1-content/Cjsf4792e2Wnkyrt', // Aldori Artistry
      'pf1-content/Cl3OuWWhtgLXGLLP', // Dwarven Fury
      'pf1-content/CoRoosQQJPVmroSE', // Greater Balor Whip
      'pf1-content/CpHBCRWmPKrUbrlK', // Terrifying Strike
      'pf1-content/CpKByDFtE0S652yw', // Trailblazing Channel
      'pf1-content/Cq2efVlJR8iB9OJv', // Armor of the Pit
      'pf1-content/CtkbDwrB8GGzDjHd', // Resistance Mastery
      'pf1-content/CwK258UrnfC3DYCV', // Siege Engineer
      'pf1-content/CzTHH3xOiaK8CRHx', // Practical Kata
      'pf1-content/D0IBicOXQq7YaDgz', // Giantslaying Team
      'pf1-content/D2lF7vrMcPch2aKc', // Stone Cover
      'pf1-content/D5WWkbXdDf0IsQQH', // Fiendish Wings
      'pf1-content/D5tCQniPXdKEUI7J', // Horse Whisperer
      'pf1-content/D6VIpdG1hrAgRqqC', // Stupefying Strike
      'pf1-content/D6wi5fgLby6qeTWZ', // Quick Trapper
      'pf1-content/D6xseMao7cIwdP6A', // Surge of Success
      'pf1-content/D7Dk6wC8q2JXfrWs', // Alien Mindpaths
      'pf1-content/D7LJ2Yn2zmUXOIvd', // Augment Calling
      'pf1-content/D80k5NbcBYfhkZZY', // Quick Wild Shape
      'pf1-content/D8BTURsubroMwCuJ', // Large Target
      'pf1-content/D9Y4Je1p5e4bnpcu', // Twin Fang Style
      'pf1-content/D9b0DhtVS70YJybq', // Seize the Moment
      'pf1-content/DBqrVvDTZlxhEcI4', // Angelic Flesh
      'pf1-content/DC00eMdScK6EgkrQ', // Bestow Hope
      'pf1-content/DCdB71AMSrAFxqYU', // Champion of Tranquility
      'pf1-content/DDXe8xgAloUqFV23', // Incite Paranoia
      'pf1-content/DEVWkg29qOYtoQ7e', // Devastating Strike
      'pf1-content/DF7bGEfeRVLZi120', // Guided Hand
      'pf1-content/DFNAebu29dYDwiRH', // Perfect Style
      'pf1-content/DFXaCr8NK0NWGN8t', // Improved Share Spells
      'pf1-content/DG5JRJj98Ylwn9xJ', // Ensemble
    ],
  },
  'feats-341': {
    situationLookup: 'first',
    named: {
      'Acupuncture Specialist': 'pf1-content/DZhKrUYWAs0cLQFN',
      'Body Control': 'pf1-content/DQCAvp1U26OcgjL9',
      'Careful Speaker': 'pf1-content/ECe5539txRjdfWvZ',
      'Champion of Tyranny': 'pf1-content/DzszxnqtFFfEQD6r',
      'Crane Style': 'pf1-content/DX6vy7YmF0UQVqOG',
      'Focused Disbelief': 'pf1-content/DHHeHYVzaiFHbeVP',
      Forester: 'pf1-content/EoRP8ycnUfzyVsSM',
      'Spider Climber': 'pf1-content/F5LqNp68feBVZeTS',
      'Stealthy (Mythic)': 'pf1-content/EBPYhWjvNuAIfBb2',
    },
    references: [
      'pf1-content/hv9hfAZJ1FVwjdeQ', // Divine Defiance
      'pf1-content/oXr83ujeuqXySBy1', // Meditation Master
      'pf1/2aTFNMs3pW6nUBlr', // Improved Unarmed Strike
      'pf1/JreaiTHdyWFNj3Tb', // Dodge
      'pf1/W8dxwZ1CZiwLKsqr', // Monk
      'pf1/f5FPqAYWlKj3zCIY', // Stealthy
      'pf1/yLaDS5HGbwtgpkbP', // Drow
    ],
  },
  'feats-342': {
    situationLookup: 'value',
    named: {
      'Ability Mastery': 'pf1-content/FuXXGRlxX6r14mov',
      'Bag of Bones': 'pf1-content/GT15HcCVnR4eb4g5',
      Cartogramancer: 'pf1-content/FGM4u4RIPfEa3XSo',
      'Confusing Stare': 'pf1-content/FAf2o9ivDcmfijMe',
      'Crane Wing': 'pf1-content/FBX9S7rtQ70aaIgP',
      'Cunning Killer': 'pf1-content/FRUVWHEI4t4hX2w8',
      'Intense Blows': 'pf1-content/FkuLvwczla3jZ0eC',
      'Jackal Heritage': 'pf1-content/GT7XbeOhKUS8fDN0',
      'Redistributed Might': 'pf1-content/Gh5GBGDcnhy6BrLg',
      Shatterspell: 'pf1-content/FHwdn0OHWoBzXxqc',
      'Skill Focus (Disable Device)': 'pf1-content/GkcekdZwcwMwI6ss',
      'Skill Focus (Handle Animal)': 'pf1-content/G3yPmoVa0D7uIbEF',
      'Snake Style': 'pf1-content/FzsUZbC5NBUHzbkV',
      'Stock-Striker Style': 'pf1-content/FIT8Ya1y6UV9xlHi',
      'Strength in Defeat': 'pf1-content/GkXR16mJaUmUbjhJ',
      'Tree Hanger': 'pf1-content/GN6tgww9K0rumZV7',
    },
    references: [
      'pf1-content/DX6vy7YmF0UQVqOG', // Crane Style
      'pf1/2aTFNMs3pW6nUBlr', // Improved Unarmed Strike
      'pf1/5JFfSqLMCpbRmERa', // Armor Training
      'pf1/EbVLpbO2masMTMBC', // Painful Stare
      'pf1/FUW5mIXHNBBIQ1Sq', // Power Attack
      'pf1/JreaiTHdyWFNj3Tb', // Dodge
      'pf1/QaMwiDFQdDwycTUO', // Disruptive
      'pf1/W8dxwZ1CZiwLKsqr', // Monk
      'pf1/WLqBCT5DqmGAx8Wd', // Fighter
      'pf1/fLU25FvuRWMCSxPP', // Mesmerist
      'pf1/iAbIGhm7T2OK9Brt', // Iron Will
      'pf1/nEltI9y37rKJTeWo', // Dwarf
      'pf1/yE3hVOvBq9rx6TAw', // Spellbreaker
    ],
  },
  'feats-343': {
    situationLookup: 'value',
    named: {
      'Assured Destruction': 'pf1-content/HLUV2mnj0aU6uw36',
      'Dragonfly Style': 'pf1-content/HL1tf4QhVXVk969o',
      'Embrace of the Dark Fey': 'pf1-content/Gq7Cj0HnceRS2TC4',
      'Forward from Beneath': 'pf1-content/HyN4adClhplxBdzE',
      'Giant Vendetta': 'pf1-content/I13eNmCFoQM0KQCZ',
      Harrowed: 'pf1-content/HsxYHTHaZtIUUIGx',
      'Kobold Confidence': 'pf1-content/HqIJLMSAL7VC4o75',
      "Musketeer's Dodge": 'pf1-content/HaE2gBIFh1yyAvU9',
      'Pinpoint Jab': 'pf1-content/IK1KKlpQ3qyzSpgg',
      'Poppet Familiar': 'pf1-content/GnnKBqldWhsKJiYH',
      'Prone Shooter': 'pf1-content/Gpw6eYeSH9VjJPBI',
      "Serren's Masterstroke": 'pf1-content/IHPGcjdO9rs7xb99',
      'Skill Focus (Knowledge [Nobility])': 'pf1-content/IGlL6mwZTu6RScYr',
      'Steel Soul': 'pf1-content/HRXjxU8L1jFPME8P',
      'Truth-Seeker': 'pf1-content/HaxfKV91W9ST8XYY',
      'Wilding Stride': 'pf1-content/ILTFqkYq9DZWZJiJ',
    },
    references: [
      'pf1-content/1REFic8UHkIVM588', // Fox Style
      'pf1-content/4As0ANwsRVZzOVA9', // Exile's Path
      'pf1-content/4Oo9yz1m0BDU6LRs', // Advanced Gathlain Magic
      'pf1-content/4doLJJBmBfNM49c1', // Empowered Daemonic Pact
      'pf1-content/7mcNePI93Co2JbPF', // Skill Focus (Intimidate)
      'pf1-content/DFNAebu29dYDwiRH', // Perfect Style
      'pf1-content/MSC6sPVFpNiAEEYH', // Overwatch Tactician
      'pf1-content/MnvXDXnoMI18lO6Q', // Angelic Blood
      'pf1-content/NkhzNoWJx6Gvd68a', // Wilding
      'pf1-content/QmQVSgZBDBcECMRz', // Bull-Catcher Style
      'pf1-content/RHgM4cgHBEdnC8d4', // Armor Material Expertise
      'pf1-content/Rg9adc8c89hvD4kg', // Charging Stag Style
      'pf1-content/U3gaOcW8uCIi1tAV', // Orc Hewer
      'pf1-content/auoxkZdAB3hRkX7b', // Nameless One
      'pf1-content/bQ7B1IVdAB0K2rdW', // Seen and Unseen
      'pf1-content/nLjpqQWm5qN1p6be', // Goblin Cleaver
      'pf1-content/qMpKHkMEayJpJHkI', // Overwatch Style
      'pf1-content/qV4k0miQDubNShC4', // Stag Horns
      'pf1-content/r7c5Urdl5332rYzt', // Mother's Gift
      'pf1-content/rYNa23u7AepTsQh2', // Blood Drinker
      'pf1-content/uKSYgayNlrxgPtfU', // Psychovore Style
      'pf1-content/witYarhLcitwPfdM', // Cautious Fighter
      'pf1-content/x2DOqdqO5I82TQtq', // Improved Blind-Fight
      'pf1/2Od2zrFivfso93Iz', // Metakinesis
      'pf1/2aTFNMs3pW6nUBlr', // Improved Unarmed Strike
      'pf1/3v85ul6tGGBZbtBg', // Arcane Armor Training
      'pf1/53urYIbYYpQuoSLd', // Precise Shot
      'pf1/5JFfSqLMCpbRmERa', // Armor Training
      'pf1/5uUzVl0gLZ23vY96', // Occultist
      'pf1/8VZQJOyAXbXghxd7', // Self-Sufficient
      'pf1/8rsFtye3PwM6CKli', // Point-Blank Shot
      'pf1/9FBT6uqlRgaw9gug', // Changeling
      'pf1/EbVLpbO2masMTMBC', // Painful Stare
      'pf1/ElqchQT5WB625HPg', // Eschew Materials
      'pf1/FHY3oIk5zSOFncJH', // Aasimar
      'pf1/FUW5mIXHNBBIQ1Sq', // Power Attack
      'pf1/Fv3FbmXptuDRiL5y', // Inquisitor
      'pf1/GsjouI6B8X7BA5wN', // Stunning Fist
      'pf1/HKRRq2tdZVEGlmHG', // Duskwalker
      'pf1/Hf31mrYb3uucNyLO', // Halfling
      'pf1/JreaiTHdyWFNj3Tb', // Dodge
      'pf1/L10V7jTzmMYz62zz', // Persuasive
      'pf1/LMNzbqGSRAFQFE2Y', // Kobold
      'pf1/MpvhQz62qw68D2pd', // Bane
      'pf1/NABgOSBRECIREaha', // Rapid Shot
      'pf1/NFxHebU1XhEs5WJh', // Combat Expertise
      'pf1/NgIhxRI0axrf3fcO', // Elf
      'pf1/PkktjwppuVzoLn19', // Strike Back
      'pf1/QvlxYVVsBDlykPKe', // Arcane Strike
      'pf1/R7L4SlGRlnThqFrP', // Mobility
      'pf1/UcEIgufLJlIfhHmu', // Furious Focus
      'pf1/V2zY7BltkpSXwejy', // Spell Focus
      'pf1/W8dxwZ1CZiwLKsqr', // Monk
      'pf1/WKIVfdosc5SqYzmP', // Quick Draw
      'pf1/WLqBCT5DqmGAx8Wd', // Fighter
      'pf1/WhE4j0Jc82npdMCP', // Lay on Hands
      'pf1/Zeq6RWYv5otvg8q7', // Cleave
      'pf1/ZmQkRk93nbHxsQSt', // Improved Grapple
      'pf1/aUYSiYrtVHkgfHD6', // Arcane Armor Mastery
      'pf1/aabyB4FV9OH7hcYZ', // Touch of Corruption
      'pf1/cCepRrfH5SalFfT4', // Half-Elf
      'pf1/dMtxCqoMLtD9nEjU', // Domain (INQ)
      'pf1/e6IaBxKgMxy1yKlr', // Human
      'pf1/fLU25FvuRWMCSxPP', // Mesmerist
      'pf1/ftBTltVkin3Ko3NJ', // Channel Smite
      'pf1/gGfXQq0IZrxdcZDx', // Throw Anything
      'pf1/gTrGPxzN054GfpkM', // Improved Trip
      'pf1/gZxiUYLYsGqQYwGZ', // Ogre
      'pf1/iAbIGhm7T2OK9Brt', // Iron Will
      'pf1/iDlGMIezGuqqt8Us', // Brawler
      'pf1/jOUMbWoFZHQlAMpJ', // Gunslinger
      'pf1/n250dFlbykAIAg5Z', // Weapon Focus
      'pf1/nEltI9y37rKJTeWo', // Dwarf
      'pf1/ohptcds1d5oG6Bjh', // Paladin
      'pf1/puKk997wHX3kIRkR', // Dhampir
      'pf1/ubx4PIbRqmVT93Ds', // Gathlain
      'pf1/ugQyUpqPBDsqLyra', // Spring Attack
      'pf1/uynVENa0deVdmf53', // Antipaladin
      'pf1/vWiTqHC4Y3Xn1Pme', // Weapon Finesse
      'pf1/vh9TZBE6BRu9sCfE', // Kineticist
    ],
    every: [
      'pf1-content/GmGA9Nk1MCrxb6cP', // Gluttonous Gobbler
      'pf1-content/Gn5qyEQdgYOcvBAt', // Spirit's Gift
      'pf1-content/GnnKBqldWhsKJiYH', // Poppet Familiar
      'pf1-content/Gpw6eYeSH9VjJPBI', // Prone Shooter
      'pf1-content/Gq7Cj0HnceRS2TC4', // Embrace of the Dark Fey
      'pf1-content/GrEw8LzuwVTGQgdT', // Voice of Beasts
      'pf1-content/GrL8sRp2GJPLH3Z3', // Cornugon Stun
      'pf1-content/Gs7vIeMhFM0zRh4L', // Implement Focus
      'pf1-content/GskcZX9HD7MxpuyI', // Signifer Armor Training
      'pf1-content/Gsm9D3P5fsEBcU5K', // Ricochet Splash Weapon
      'pf1-content/Gt3t3vHjssRsc7R7', // Wretched Curator
      'pf1-content/GtDonPy6v4QS9xca', // Untwisting Iron Strength
      'pf1-content/Gu44ENk2SAla373Y', // Believer's Hands
      'pf1-content/Gux7KiSpRLj6nKxW', // Starry Grace
      'pf1-content/GvOD7INb4Qx1ElOY', // Implant Bomb
      'pf1-content/GwTN9DFRiJNlmRse', // Overachiever
      'pf1-content/Gx0O8R9eqE0khOYn', // Iron Will (Mythic)
      'pf1-content/GxLeshuVogswEZ5w', // Blood Salvage
      'pf1-content/GxTZldNEYKsm9lya', // Fortune Teller
      'pf1-content/GyO1NLDcRtdre6hd', // Angel Wings
      'pf1-content/H1xPVUkaEtWsoe1a', // Planar Heritage
      'pf1-content/H26YRKTZsuJdCQWp', // Venomous Spray
      'pf1-content/H2TItshJOMEMyuiF', // Elven Accuracy
      'pf1-content/H3DYK2PdJRO8U5En', // Focused Animal Expertise
      'pf1-content/H5QtyhLMWhoJ3pCW', // Merciful Bane
      'pf1-content/H87mFGETMg3AIKRN', // Greater Gathlain Magic
      'pf1-content/H9WiCQ2l7em8fwHY', // Metamagic Invocation
      'pf1-content/H9qlKshXQcdrBCii', // Rival
      'pf1-content/HArtJzyKKBCqlSxx', // Agent of Purity
      'pf1-content/HDO5E11kSUb7BgBc', // Coordinated Capture
      'pf1-content/HDc4mR6QpjEx2jqZ', // Flanking Foil
      'pf1-content/HEEmBRbAKY5ZakU7', // Arcane Strike (Mythic)
      'pf1-content/HEH8jRZHIxqC9HCo', // Spirit Symbiosis
      'pf1-content/HHQcDDhuWvytoPxl', // Fox Insight
      'pf1-content/HID4IHRgQ7zmAPLL', // Blundering Defense
      'pf1-content/HIc0QXd9a4jwKJBr', // Scarring Spell
      'pf1-content/HIvpuR89yEWVwCZI', // Huntmaster
      'pf1-content/HL1tf4QhVXVk969o', // Dragonfly Style
      'pf1-content/HLUV2mnj0aU6uw36', // Assured Destruction
      'pf1-content/HLgnGJpFpAdL3Jt1', // Civilized Ghoulishness
      'pf1-content/HNmNx17913lkWa2c', // Spontaneous Nature's Ally
      'pf1-content/HO5PRAGpoDLtcrBE', // Overwatch Vortex
      'pf1-content/HOF7ZbqNssZm0FUI', // Tool Optimizer
      'pf1-content/HQHA3EljmEoTwV20', // Channel Discord
      'pf1-content/HRXjxU8L1jFPME8P', // Steel Soul
      'pf1-content/HS7v7bLCsMcjiR9u', // Daring Exploit
      'pf1-content/HXLTCLCmHR9LLsGo', // Splintering Weapon
      'pf1-content/HXxAvuKSCWk37uqj', // Domain Strike
      'pf1-content/HZcLHUmCoWirryD0', // Varisian Tattoo
      'pf1-content/HaE2gBIFh1yyAvU9', // Musketeer's Dodge
      'pf1-content/HaKBk0Hwrq7FO13R', // Theurgy
      'pf1-content/HaxfKV91W9ST8XYY', // Truth-Seeker
      'pf1-content/Hb7ugClgJ6K4NZYZ', // Returning Throw
      'pf1-content/HcxNeZC2qkszKV1W', // Lonely Death
      'pf1-content/HdLIUDhskAwWcRBZ', // Cleaving Finish
      'pf1-content/Hf6l7WhzaogPO1R6', // Quillbreaker Defense
      'pf1-content/HhNOstkfZOzeIViW', // Inspirational Commander
      'pf1-content/HjHc4yz8fH4fm9RY', // Raging Regeneration
      'pf1-content/HjPc9WT7tHZfSOuL', // Bull-Catcher Toss
      'pf1-content/HkRHM6yr4d8VAoUH', // Chilling Amplification
      'pf1-content/Hl6Xce9vn2OBuqyn', // Neither Elf nor Human
      'pf1-content/HnnGgpUbJRuSylBR', // Giant Killer
      'pf1-content/Ho3qCFTSlVcQrUo7', // Psychovore Strike
      'pf1-content/HoiBm1ghGs8q9vjm', // Repositioning Strike
      'pf1-content/Hp5xJXA8YFkbAgSW', // Stylized Spontaneity
      'pf1-content/HqIJLMSAL7VC4o75', // Kobold Confidence
      'pf1-content/HsOTmgcKcGrGLyCL', // Unusual Heritage (Dhampir)
      'pf1-content/HsxYHTHaZtIUUIGx', // Harrowed
      'pf1-content/HtBEcem86sIuaoRP', // Masked by Fear
      'pf1-content/HteKuvnEnUuTBzAC', // Self-Sufficient (Mythic)
      'pf1-content/HvYZ9O5dhlfkFjDq', // Felling Smash
      'pf1-content/HwhGyqIWGyhSlPkf', // Armor Material Mastery
      'pf1-content/HxzHHtgoHjhp6UoM', // Furious Focus (Mythic)
      'pf1-content/HyN4adClhplxBdzE', // Forward from Beneath
      'pf1-content/HyXT115qVLe2TMP0', // Stag Submission
      'pf1-content/HzT5vGuTbYYpklFq', // Shatter Control
      'pf1-content/I13eNmCFoQM0KQCZ', // Giant Vendetta
      'pf1-content/I1qZqRMGLIGaWbtd', // Awakened Hag Heritage
      'pf1-content/I2RUg9KkpJrodkeH', // Halfling Slinger
      'pf1-content/I2XfbKBHjmI65Oxv', // Expanded Enhance Arrows
      'pf1-content/I2Xg9Gl1Buk4hfju', // Crusader's Fist
      'pf1-content/I45XeJHLhTsWYqff', // Believer's Boon
      'pf1-content/I4GNiN7rgHHPnLtt', // Cataract
      'pf1-content/I8h7trE9b71XMipO', // Gaze Reflection
      'pf1-content/IAXIKKJTaIP6oZyX', // Circling Mongoose
      'pf1-content/IAdJN3A0ThxR4l3h', // Innocent Blood
      'pf1-content/ICI9T0jc4437bxFH', // Death's Host
      'pf1-content/ICkxsUqZMesT3KRC', // Elemental Spell
      'pf1-content/IDesGyM2nNawIXdI', // Disrupting Fist
      'pf1-content/IF48Oa1PkJ0nT1Rn', // Elemental Claws
      'pf1-content/IFKizIz9ICqvFLR4', // Betrayer
      'pf1-content/IFkJusznqSCdgeeQ', // Herbal Components
      'pf1-content/IGlL6mwZTu6RScYr', // Skill Focus (Knowledge [Nobility])
      'pf1-content/IHFL3Jm9WRw2Wtuv', // Penetrating Stare
      'pf1-content/IHPGcjdO9rs7xb99', // Serren's Masterstroke
      'pf1-content/IIeQwijpoEPptZ8V', // Quick Preparation
      'pf1-content/IK1KKlpQ3qyzSpgg', // Pinpoint Jab
      'pf1-content/ILTFqkYq9DZWZJiJ', // Wilding Stride
      'pf1-content/IOPS4W1mVH76IgxX', // Greater Blind-Fight
      'pf1-content/IOaZqFcfv14sU86S', // Bloody Mess
    ],
  },
  'feats-344': {
    situationLookup: 'index',
    named: {
      'Balor Whip': 'pf1-content/Jb7UHhvoipN3tPfE',
      'Bolster Jinx': 'pf1-content/JWt3cKEiZFWnOXJ7',
      'Cranial Adjustment': 'pf1-content/J4w7nrpdzlYqLKOg',
      'Defended Movement': 'pf1-content/Ia2jzTn5oCsBMwg9',
      'Directed Disarm': 'pf1-content/J5edw8SYbo99nK2w',
      'Evolved Companion': 'pf1-content/JZ4zPeCBqqQ4XDKI',
      'Grand Master Performer': 'pf1-content/J68M3IjsbQepuhwR',
      'Hamatula Grasp': 'pf1-content/IlaWfFKEyUImZyqL',
      'Intoxicating Flattery': 'pf1-content/IYCPoKsmiPF9XYys',
      'Lighting the Way': 'pf1-content/IsOgnm716Swd9RfD',
      'Marcher-Lord of the Cerulean Abyss': 'pf1-content/K8umTp9x4cgy8sCF',
      'Motivating Display': 'pf1-content/Jsmgo2AkRUUc4sRW',
      'Opening Volley': 'pf1-content/IsGNUF8XmxwTkxmI',
      'Pass For Human': 'pf1-content/IrGx6qRzbpbk5fxu',
      'Phantom Fighter': 'pf1-content/JlYrQzyyHuCqKEge',
      'Rapid Grappler': 'pf1-content/K18vW6ltCmfg7600',
      'Robust Stench': 'pf1-content/IcDgu2teQslhNyvL',
      'Sprightly Armor': 'pf1-content/JFFVQrimZI6r59zX',
      'Tail Weapon': 'pf1-content/JlkWmvlKmED8lkuM',
      'Throw Anything (Mythic)': 'pf1-content/Iq0wnVM5su2GlQ2R',
      'Undead Master (Mythic)': 'pf1-content/JyX9gOfjmDCkd4SZ',
      'Volley Fire': 'pf1-content/JqqVqyIFvFmemS5B',
    },
    references: [
      'pf1-content/9ETCsMI5tRlogbp2', // Undead Master
      'pf1-content/L0mPcPjI0OLN85qF', // Master Performer
      'pf1-content/cyEu5hSYT23ccIYH', // Hamatula Strike
      'pf1-content/dIqbQQQEANSVPlsX', // Trepanation
      'pf1-content/pUmoxJHnoITAStYq', // Whip Mastery
      'pf1/0bZf3SDkvVOe2ujH', // Lightning Reflexes
      'pf1/1AY9Xjbg109TsnVl', // Greater Disarm
      'pf1/2aTFNMs3pW6nUBlr', // Improved Unarmed Strike
      'pf1/3cq9YbgcMrAXC76j', // Dazzling Display
      'pf1/5JFfSqLMCpbRmERa', // Armor Training
      'pf1/6GjOjO6r3R06fLwE', // Bard
      'pf1/6yGoL82RidBHmXPb', // Extra Performance
      'pf1/711B9WNFgpdDKKf2', // Improved Disarm
      'pf1/7mD4ZksvKFaorAfj', // Shield Focus
      'pf1/8rsFtye3PwM6CKli', // Point-Blank Shot
      'pf1/NFxHebU1XhEs5WJh', // Combat Expertise
      'pf1/SMyexRzOm5PfjT5I', // Deft Hands
      'pf1/SUACufUXl12sUvnQ', // Deceitful
      'pf1/W8dxwZ1CZiwLKsqr', // Monk
      'pf1/WLqBCT5DqmGAx8Wd', // Fighter
      'pf1/ZfCUTi1MiLgR4T7I', // Bardic Performance
      'pf1/ZmQkRk93nbHxsQSt', // Improved Grapple
      'pf1/bOv30pyHB1gFbSTj', // Goblin
      'pf1/fVRnBIHR4Jq6btvm', // Great Fortitude
      'pf1/gGfXQq0IZrxdcZDx', // Throw Anything
      'pf1/hc7CRKHvhmKRzNKb', // Greater Grapple
      'pf1/iAbIGhm7T2OK9Brt', // Iron Will
      'pf1/iYAQs7zjFbgcmect', // Spiritualist
      'pf1/n250dFlbykAIAg5Z', // Weapon Focus
      'pf1/ryQboCpsLfFBCzdL', // Phantom
    ],
  },
  'feats-345': {
    situationLookup: 'index',
    named: {
      'Ancestral Enmity': 'pf1-content/LhVTa2vwZo0srt1j',
      'Animal Disguise': 'pf1-content/Kvo3hHlVAM4bLHnb',
      'Archon Diversion': 'pf1-content/LkerCbsZyctv0Nzs',
      'Champion of Malevolence': 'pf1-content/KwsFcrv75slDLbB4',
      'Combat Distraction': 'pf1-content/LKUFrlptoTnxtL73',
      'Covering Defense': 'pf1-content/KoLq2qthsPX08zxt',
      'Crashing Wave Buffet': 'pf1-content/KHxg5rhzeUTkFTc5',
      'Disorienting Maneuver': 'pf1-content/KbuFvGYtjIRc7aVg',
      'Long-Nose Form': 'pf1-content/LT971vOhxSDloEne',
      'Low Profile': 'pf1-content/LAxHuhziL9AL4Vns',
      'Master Performer': 'pf1-content/L0mPcPjI0OLN85qF',
      'Merciless Beating': 'pf1-content/L5PnLgG0s0hXZ2uh',
      'Punishing Step': 'pf1-content/LuuFyWa6KYLfisCC',
      'Sinuous Vines': 'pf1-content/LV8CY7xOE6EjeANy',
      'Skill Focus (Knowledge [Dungeoneering])': 'pf1-content/LmV6WT0Dv5FZO4Qy',
      'Valiant Steed': 'pf1-content/LOY8eavCWhLpsn1N',
      'Wilding Senses': 'pf1-content/LrFNiVVtc9OOw6UV',
    },
    references: [
      'pf1-content/5JWZJ7jaLTpFXaDk', // Archon Style
      'pf1-content/NkhzNoWJx6Gvd68a', // Wilding
      'pf1-content/VwpZXgXnOAVV2LxO', // Crashing Wave Style
      'pf1-content/sy6IEh9YQ3278buR', // Gang Up
      'pf1/2aTFNMs3pW6nUBlr', // Improved Unarmed Strike
      'pf1/6GjOjO6r3R06fLwE', // Bard
      'pf1/6yGoL82RidBHmXPb', // Extra Performance
      'pf1/7mD4ZksvKFaorAfj', // Shield Focus
      'pf1/CYHloH6aEnfgdxAV', // Improved Reposition
      'pf1/JreaiTHdyWFNj3Tb', // Dodge
      'pf1/NFxHebU1XhEs5WJh', // Combat Expertise
      'pf1/W8dxwZ1CZiwLKsqr', // Monk
      'pf1/ZfCUTi1MiLgR4T7I', // Bardic Performance
      'pf1/ZmQkRk93nbHxsQSt', // Improved Grapple
      'pf1/bOv30pyHB1gFbSTj', // Goblin
      'pf1/e1zIVW9AcrmRrYvx', // Improved Drag
      'pf1/h9nHYLxXvIXBTmup', // Combat Reflexes
      'pf1/ubx4PIbRqmVT93Ds', // Gathlain
      'pf1/yAS41rHv0WzDmuRm', // Tengu
    ],
  },
  'feats-346': {
    situationLookup: 'index',
    named: {
      'Blood Feast': 'pf1-content/Mm5MfURoesYOr1yv',
      'Improved Awesome Blow': 'pf1-content/LwguZfORlrl8aMNq',
      'Jabbing Style': 'pf1-content/NR7MpUUAISoFdEFR',
      "Kraggodan's Stance": 'pf1-content/MctMMTXqA4uuhe3s',
      Moontouched: 'pf1-content/LxgI9xUum9O1u6Du',
      'Nation Builder': 'pf1-content/NUyt5BlKeCE3c6h6',
      'Necromantic Affinity': 'pf1-content/MrQB3TTx8kIDy44q',
      'Osyluth Guile': 'pf1-content/NSPndADZ7c1nUis8',
      'Pushing Assault': 'pf1-content/MpecI8kzg7WFzwwS',
      'Ready for Battle': 'pf1-content/NUL6k14Rux7rXijg',
      'Rending Claws': 'pf1-content/NS0DdgEs4bxZm9Gx',
      'Shadow Caster': 'pf1-content/LzwXNTbhlna6oVpw',
      'Skill Focus (Heal)': 'pf1-content/MMZxRlkELezwGDlL',
      'Traditional Weapons': 'pf1-content/NC4iEoh3TDyZ3kcC',
      'War Blessing': 'pf1-content/NChgeuIyrjlsnvkl',
      Wilding: 'pf1-content/NkhzNoWJx6Gvd68a',
    },
    references: [
      'pf1/2aTFNMs3pW6nUBlr', // Improved Unarmed Strike
      'pf1/EnMgClQRxY1GXg4e', // Awesome Blow
      'pf1/FUW5mIXHNBBIQ1Sq', // Power Attack
      'pf1/JreaiTHdyWFNj3Tb', // Dodge
      'pf1/KPaC3H6EQGG4sXLT', // Awesome Blow
      'pf1/iDlGMIezGuqqt8Us', // Brawler
      'pf1/yLaDS5HGbwtgpkbP', // Drow
    ],
  },
  'feats-347': {
    situationLookup: 'index',
    named: {
      'Broken Wing Gambit': 'pf1-content/NqjC6rRu8uq3grNc',
      'Channel Spirit': 'pf1-content/PVFEUPOLl2oeMGce',
      'Dazing Assault': 'pf1-content/OlN0hWOhnp1yUpZG',
      'Dimensional Maneuvers': 'pf1-content/PClONqb0pE1YhRCY',
      'Dispel Focus': 'pf1-content/POguLp8c7EdbOjhQ',
      'Diva Strike': 'pf1-content/OM8SSSmz8tUKGCbe',
      'Divine Fighting Technique': 'pf1-content/PY5WXFSQ5XWzRS2D',
      'Enemy Cult': 'pf1-content/PBcbPm60giGqosHs',
      'Free Spirit': 'pf1-content/PkhXaswcw6CYRgXF',
      'Group Deliver Touch Spells': 'pf1-content/PexJhc4O3vMx8RzI',
      'Hefty Brute': 'pf1-content/O6bLhILylLxX0EPX',
      'Kobold Sniper': 'pf1-content/O1hgQYFPMiL4VYfQ',
      'Lead by Example': 'pf1-content/NordwObUJrRSMjg3',
      Longshanks: 'pf1-content/PXCynjnviKtWEXtO',
      'Painful Cures': 'pf1-content/P9dYaVSTtlz7w11S',
      'Pinch Time': 'pf1-content/OAQzUbHLZ90HZn0e',
      'Shield Wall': 'pf1-content/PopIdrPioTyBwlQH',
      'Sincere Flattery': 'pf1-content/P8vgqqLwyNMdpR5e',
      'Tiger Style': 'pf1-content/PuAipWzlLA4GQNxU',
    },
    references: [
      'pf1-content/Dxryp6lWPr9i7FAP', // Diva Style
      'pf1-content/PceVCmNQ5dgCcbyq', // Group Shared Spells
      'pf1-content/tLSmc50xENIEyb1B', // Spirit Ridden
      'pf1/2aTFNMs3pW6nUBlr', // Improved Unarmed Strike
      'pf1/4i8qiF2QnGnPOyKC', // Wyvaran
      'pf1/6GjOjO6r3R06fLwE', // Bard
      'pf1/FUW5mIXHNBBIQ1Sq', // Power Attack
      'pf1/LMNzbqGSRAFQFE2Y', // Kobold
      'pf1/NFxHebU1XhEs5WJh', // Combat Expertise
      'pf1/W8dxwZ1CZiwLKsqr', // Monk
      'pf1/dCAXgdA6Db1Z3ccz', // Half-Orc
      'pf1/jMi3GBtvdG0WhH8L', // Shaman
      'pf1/ohVBtSayzMqWwHny', // Spirit
      'pf1/tocde3sKG1O3GKgd', // Improved Feint
    ],
  },
} as const satisfies Record<
  string,
  {
    situationLookup: SituationLookup;
    named: Readonly<Record<string, string>>;
    references: readonly string[];
    every?: readonly [string, ...string[]];
  }
>;

export type FeatBatch = keyof typeof featBatches;

/** Every key of the given batches: their named feats, references and lists. */
export function featBatchKeys(batches: readonly FeatBatch[]) {
  return [
    ...new Set(
      batches.flatMap((batch) => {
        const data: (typeof featBatches)[FeatBatch] = featBatches[batch];
        return [
          ...Object.values(data.named),
          ...data.references,
          ...('every' in data ? data.every : []),
        ];
      }),
    ),
  ];
}
