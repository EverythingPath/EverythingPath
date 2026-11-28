// pbl-released-feats-1 (PRD #251): the feat batch units' entries, as committed
// data, for the released feat tests (released-feats-330.test.ts and
// released-feats-330.integration.test.ts). For each batch:
//
// - `named`: each feat a resolver block or an integration test looks up by
//   name, with the key the batch preview gave that name;
// - `references`: every other key those feats' imported fields name (their
//   prerequisite feats, classes, class features and races, and the entries
//   their descriptions link), and the keys the old tests named as literals,
//   so the import resolves each reference as the batch tree did;
// - `every` (only where an old block checked every entry of the preview):
//   the preview's keys in its order;
// - `situationLookup`: how the batch unit's `localSituation` helper chose a
//   Modifier's local Situation (`featBatch` in released-feat-sheet.ts):
//   `first`, the first Modifier on the target (feats-334 to feats-336, and
//   the batches whose units had no such helper); `firstLocal`, the first one
//   on the target whose Situation is not a shared key (feats-337 and
//   feats-338).
//
// Nothing here reads a batch directory.

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
} as const satisfies Record<
  string,
  {
    situationLookup: 'first' | 'firstLocal';
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
