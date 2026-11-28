// pbl-released-buffs (PRD #251): the admission gate's result for each buff
// the released buff tests name, on their released import
// (`releasedGateStates` in released-buff-sheet.ts), as committed data: per
// batch and name, the list the gate puts the buff on and the reason it gives.
// It carries the gate assertions of the batch units' re-extraction
// (buffs-547.test.ts:618, pf-buffs-548.test.ts:679, pf-buffs-549.test.ts:750),
// which ran the batch-test gate (the assessment path alone, with the batch
// review's holds) on each batch preview; the release's gate reads the notice
// register instead, so most results differ from those (the mapping lists
// each). Captured at 0a3d18d6 from the released import, where each equals
// the gate's result on a whole-store import of the same keys. Five named
// buffs are left out because they do not (the gate's result depends on
// racial-trait records the import does not hold): Change Shape (Skinwalker -
// Beast Talker, DEX), Luckbringer, Change Shape (Skinwalker - Beast Talker,
// CON), Joyous Companion and Smite Good (Tiefling).

import type { GateState } from './released-buff-sheet';

export const buffGateStates = {
  'buffs-547': {
    'Accurate Stance': [
      'admitted',
      'Admitted under #227: declared book PZO1131.',
    ],
    Aid: ['admitted', 'Admitted under #227: declared book PZO1110.'],
    Bane: [
      'held',
      'Held under #227: named holds kept: buffs-547-source-page-D2huasedfGMSetP7 (scripts/catalog/legal/buffs-547.json).',
    ],
    Barkskin: ['admitted', 'Admitted under #227: declared book PZO1110.'],
    Bless: ['admitted', 'Admitted under #227: declared book PZO1110.'],
    "Bull's Strength": [
      'admitted',
      'Admitted under #227: declared book PZO1110.',
    ],
    'Calm Stance': ['admitted', 'Admitted under #227: declared book PZO1131.'],
    'Dire Prophecy': [
      'admitted',
      'Admitted under #227: declared book PZO1117.',
    ],
    'Divine Favor': ['admitted', 'Admitted under #227: declared book PZO1110.'],
    'Fighting Defensively': [
      'admitted',
      'Admitted under #227: declared book PZO1110.',
    ],
    Fly: ['admitted', 'Admitted under #227: declared book PZO1110.'],
    'Guarded Stance': [
      'admitted',
      'Admitted under #227: declared book PZO1131.',
    ],
    'Hard Light Shield': [
      'dependentOmission',
      'Dependent omission: pf1/alQVMlHc89hMxK2M.',
    ],
    Haste: ['admitted', 'Admitted under #227: declared book PZO1110.'],
    'Heroism, Greater': [
      'dependentOmission',
      'Dependent omission: pf1/z0duc2v2n3ioynta.',
    ],
    'Inspire Courage': [
      'admitted',
      'Admitted under #227: declared book PZO1110.',
    ],
    'Knockdown Stance': [
      'admitted',
      'Admitted under #227: declared book PZO1131.',
    ],
    Magboots: [
      'dependentOmission',
      'Dependent omission: pf1/nK3XfCurRf9nRZiD.',
    ],
    'Mage Armor': ['admitted', 'Admitted under #227: declared book PZO1110.'],
    'Powerful Stance': [
      'admitted',
      'Admitted under #227: declared book PZO1131.',
    ],
    'Prayer (Negative)': [
      'admitted',
      'Admitted under #227: declared book PZO1110.',
    ],
    Rage: ['admitted', 'Admitted under #227: declared book PZO1110.'],
    'Rage (Unchained)': [
      'admitted',
      'Admitted under #227: declared book PZO1131.',
    ],
    'Reckless Stance': [
      'admitted',
      'Admitted under #227: declared book PZO1131.',
    ],
    Shield: ['admitted', 'Admitted under #227: declared book PZO1110.'],
    'Shield of Faith': [
      'admitted',
      'Admitted under #227: declared book PZO1110.',
    ],
    Slow: ['admitted', 'Admitted under #227: declared book PZO1110.'],
    'Strength Stance': [
      'admitted',
      'Admitted under #227: declared book PZO1131.',
    ],
    'Total Defense': [
      'admitted',
      'Admitted under #227: declared book PZO1110.',
    ],
    'Veemod (Black)': [
      'dependentOmission',
      'Dependent omission: pf1/0BtaS9u6bxDBaKhH, pf1/jhIfmOlvPbwZwCq1.',
    ],
    'Veemod (Brown)': [
      'dependentOmission',
      'Dependent omission: pf1/0BtaS9u6bxDBaKhH, pf1/jJfwLVduz8FtcgEg.',
    ],
    'Veemod (Green)': [
      'dependentOmission',
      'Dependent omission: pf1/0BtaS9u6bxDBaKhH, pf1/9dvLuZUA2Wy1TBht.',
    ],
    'Veemod (Powered Armor)': [
      'dependentOmission',
      'Dependent omission: pf1/eecEg8w7FECEclV5.',
    ],
    Ward: ['admitted', 'Admitted under #227: declared book PZO1115, PZO1129.'],
  },
  'pf-buffs-548': {
    'Acute Senses': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1117, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/ultimate_magic/um_spells.lst:10).',
    ],
    'Animal Focus (Bear)': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1129 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/advanced_class_guide/acg_abilities_class.lst:1215).',
    ],
    'Animal Focus (Falcon)': [
      'failure',
      'Broken structure or reference: unresolved imported reference.',
    ],
    'Animal Focus (Owl)': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1129 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/advanced_class_guide/acg_abilities_class.lst:1221).',
    ],
    'Aspect of the Bear': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1115, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/advanced_players_guide/apg_spells.lst:1852).',
    ],
    'Aspect of the Wolf': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1112, PZO1115, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/advanced_players_guide/apg_spells.lst:1855).',
    ],
    'Blessing of Courage and Life': [
      'held',
      'Held under #227: named holds kept: pf-buffs-548-emotion-attribution-93oIrx2wLSx0jMkM (scripts/catalog/legal/pf-buffs-548.json).',
    ],
    'Blessings of Luck and Resolve': [
      'failure',
      'Broken structure or reference: unresolved imported reference.',
    ],
    'Bullet Shield': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1118, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/ultimate_combat/uc_spells.lst:21).',
    ],
    'Burst of Glory': [
      'held',
      'Held under #227: scripted match PZO1110, PZO1131, PZO9202, PZO9267 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen campaign_setting/inner_sea_gods/isg_spells.lst:15) lacks reviewed notices: PZO9202.',
    ],
    'Change Shape (Skinwalker - Beast Talker, Natural Armor)': [
      'held',
      'Held under #227: declared book PZO9280 lacks reviewed notices: PZO9439.',
    ],
    'Cloak of Chaos': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/core_rulebook/cr_spells.lst:855).',
    ],
    'Crushing Despair': [
      'held',
      'Held under #227: named holds kept: pf-buffs-548-emotion-attribution-6k7GsF01oeTNRdHn (scripts/catalog/legal/pf-buffs-548.json).',
    ],
    "Darkvision 60'": ['held', 'missing Attribution Assessment'],
    'Debilitating Injury (Disoriented)': [
      'dependentOmission',
      'Dependent omission: pf1/nL9Ds9nflmID84vo.',
    ],
    'Dispel Chaos': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/core_rulebook/cr_spells.lst:174).',
    ],
    'Dispel Good': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/core_rulebook/cr_spells.lst:176).',
    ],
    'Divine Power': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/core_rulebook/cr_spells.lst:946).',
    ],
    'Evil Eye (AC)': [
      'admitted',
      'Admitted under #227: scripted match PZO1115 via roleplaying_game/advanced_players_guide/apg_abilities_class.lst:891; PZO1129 via roleplaying_game/advanced_class_guide/acg_abilities_class.lst:1430; PZO9468 via player_companion/magic_tactics_toolbox/magtt_abilities_class.lst:55; PZO1110, PZO1115, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/advanced_players_guide/apg_abilities_class.lst:891).',
    ],
    'Evil Eye (Saves)': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1115, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/advanced_players_guide/apg_abilities_class.lst:891).',
    ],
    'Great Cleave': [
      'dependentOmission',
      'Dependent omission: pf1/6HSMdwX1VS6nZ6Zf.',
    ],
    Guidance: [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/core_rulebook/cr_spells.lst:1037).',
    ],
    Halo: [
      'dependentOmission',
      'Dependent omission: pf1-content/2NXp8S2ZZ2Lh5LS3.',
    ],
    'Ill Omen': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1115, PZO1126, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/advanced_players_guide/apg_spells.lst:1987).',
    ],
    'Inspire Heroics': [
      'admitted',
      'Admitted under #227: scripted match PZO1110 via roleplaying_game/core_rulebook/cr_abilities_class.lst:531; PZO1110 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/core_rulebook/cr_abilities_class.lst:531).',
    ],
    Jump: [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/core_rulebook/cr_spells.lst:1100).',
    ],
    'Lay of the Land': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131, PZO9436 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen player_companion/faiths_and_philosophies/fap_spells.lst:15).',
    ],
    Lunge: [
      'admitted',
      'Admitted under #227: scripted match PZO1115 via roleplaying_game/advanced_players_guide/apg_abilities_class.lst:2802; PZO1117 via roleplaying_game/ultimate_magic/um_abilities_class.lst:1400; PZO1129 via roleplaying_game/advanced_class_guide/acg_abilities_class.lst:4266; PZO9268 via campaign_setting/inner_sea_combat/isc_abilities_class.lst:332; PZO1110 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/core_rulebook/cr_feats.lst:117).',
    ],
    'Mind Blank': [
      'dependentOmission',
      'Dependent omission: pf1/vl2mznu91c3efcam.',
    ],
    'Perfect Placement': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131, PZO9465 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen player_companion/arcane_anthology/arca_spells.lst:44).',
    ],
    'Protection From Good': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/core_rulebook/cr_spells.lst:1217).',
    ],
    'Protection From Law': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/core_rulebook/cr_spells.lst:1218).',
    ],
    Resistance: [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/core_rulebook/cr_spells.lst:1250).',
    ],
    'Sanctify Armor': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1115, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/advanced_players_guide/apg_spells.lst:2051).',
    ],
    'Shield of Law': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/core_rulebook/cr_spells.lst:1290).',
    ],
    'Squeezing (large)': ['held', 'missing Attribution Assessment'],
    'Stunning Barrier': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1129, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/advanced_class_guide/acg_spells.lst:119).',
    ],
    'Tap Inner Beauty': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131, PZO9267, PZO9416 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen campaign_setting/inner_sea_gods/isg_spells.lst:64).',
    ],
    'Threefold Aspect (Adult)': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1115, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/advanced_players_guide/apg_spells.lst:2087).',
    ],
    'Threefold Aspect (Young Adult)': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1115, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/advanced_players_guide/apg_spells.lst:2087).',
    ],
    'Unerring Weapon': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1118, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/ultimate_combat/uc_spells.lst:145).',
    ],
    'Veil of Positive Energy': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1115, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-548.json, PCGen roleplaying_game/advanced_players_guide/apg_spells.lst:2107).',
    ],
  },
  'pf-buffs-549': {
    Adoration: [
      'held',
      'Held under #227: named holds kept: pf-buffs-549-emotion-attribution-cCD0u4e8iVPQiEEB (scripts/catalog/legal/pf-buffs-549.json).',
    ],
    'Alter Self (Small)': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1112, PZO1127, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/core_rulebook/cr_spells.lst:782).',
    ],
    'Angelic Aspect (Lesser)': [
      'failure',
      'Broken structure or reference: unresolved imported reference.',
    ],
    'Animal Focus (Frog)': [
      'failure',
      'Broken structure or reference: unresolved imported reference.',
    ],
    'Animal Focus (Wolf)': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1112, PZO1129 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/advanced_class_guide/acg_abilities_class.lst:1225).',
    ],
    'Anticipate Peril': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1117, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/ultimate_magic/um_spells.lst:18).',
    ],
    'Banner, Greater': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1115, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/advanced_players_guide/apg_abilities_class.lst:205).',
    ],
    'Blessing of Fervor (Atk, AC, Ref)': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1115, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/advanced_players_guide/apg_spells.lst:1866).',
    ],
    'Certain Grip': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1118, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/ultimate_combat/uc_spells.lst:24).',
    ],
    'Change Shape (Skinwalker, Natural Armor)': [
      'held',
      'Held under #227: declared book PZO1133, PZO9280, PZO9439 lacks reviewed notices: PZO9439.',
    ],
    'Channel Vigor (Limbs)': [
      'held',
      'Held under #227: scripted match PZO1110, PZO1131, PZO9202, PZO9267 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen campaign_setting/inner_sea_gods/isg_spells.lst:18) lacks reviewed notices: PZO9202.',
    ],
    'Channel Vigor (Torso)': [
      'held',
      'Held under #227: scripted match PZO1110, PZO1131, PZO9202, PZO9267 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen campaign_setting/inner_sea_gods/isg_spells.lst:18) lacks reviewed notices: PZO9202.',
    ],
    Charging: ['held', 'missing Attribution Assessment'],
    Chastise: [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131, PZO9221 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen campaign_setting/faction_guide/pcfg_spells.lst:14).',
    ],
    'Combat Expertise': [
      'admitted',
      'Admitted under #227: scripted match PZO1110 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/core_rulebook/cr_feats.lst:33).',
    ],
    'Cover (Soft)': ['held', 'missing Attribution Assessment'],
    'Death Knell': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/core_rulebook/cr_spells.lst:903).',
    ],
    'Debilitating Injury (Bewildered)': [
      'dependentOmission',
      'Dependent omission: pf1/nL9Ds9nflmID84vo.',
    ],
    'Dispel Evil': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/core_rulebook/cr_spells.lst:936).',
    ],
    'Dispel Law': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/core_rulebook/cr_spells.lst:938).',
    ],
    'Evil Eye (Atk)': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1115, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/advanced_players_guide/apg_abilities_class.lst:891).',
    ],
    'Evil Eye (Skill)': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1115, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/advanced_players_guide/apg_abilities_class.lst:891).',
    ],
    Glibness: [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/core_rulebook/cr_spells.lst:1026).',
    ],
    'Good Hope': [
      'held',
      'Held under #227: named holds kept: pf-buffs-549-emotion-attribution-kkDzmQdg0RjnwSLj (scripts/catalog/legal/pf-buffs-549.json).',
    ],
    'Holy Aura': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/core_rulebook/cr_spells.lst:1063).',
    ],
    Identify: [
      'dependentOmission',
      'Dependent omission: pf1/llxrra87kbofmyhl.',
    ],
    Jitterbugs: [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1121, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/advanced_race_guide/arg_spells.lst:24).',
    ],
    'Magic Fang': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/core_rulebook/cr_spells.lst:1131).',
    ],
    'Magic Fang, Greater': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/core_rulebook/cr_spells.lst:1132).',
    ],
    'Magic Vestment': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/core_rulebook/cr_spells.lst:1137).',
    ],
    'Magic Weapon, Greater': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/core_rulebook/cr_spells.lst:1139).',
    ],
    'Pernicious Poison': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1117, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/ultimate_magic/um_spells.lst:156).',
    ],
    'Protection From Evil': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/core_rulebook/cr_spells.lst:1216).',
    ],
    'Remove Fear': [
      'held',
      'Held under #227: named holds kept: pf-buffs-549-emotion-attribution-lpBAgRhDew61Vmzo (scripts/catalog/legal/pf-buffs-549.json).',
    ],
    'Righteous Might': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/core_rulebook/cr_spells.lst:1257).',
    ],
    'Small Quarter Ally': [
      'dependentOmission',
      'Dependent omission: pf1-content/kqSFEBk1ycJ6PG8y, pf1-content/tOyZJ3QAQqZDdMxX.',
    ],
    'Smite Evil': [
      'admitted',
      'Admitted under #227: scripted match PZO1110 via roleplaying_game/core_rulebook/cr_abilities_class.lst:1357; PZO1115 via roleplaying_game/advanced_players_guide/apg_abilities_class.lst:2487; PZO1140 via roleplaying_game/ultimate_wilderness/uw_abilities_class.lst:880; PZO9474 via player_companion/paths_of_the_righteous/pathr_abilities_class.lst:185; PZO9478 via player_companion/monster_hunters_handbook/mhh_abilities_class.lst:105; PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/core_rulebook/cr_abilities_class.lst:1357).',
    ],
    'Threefold Aspect (Elderly)': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1115, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/advanced_players_guide/apg_spells.lst:2087).',
    ],
    'Touch of Good': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/core_rulebook/cr_abilities_class.lst:713).',
    ],
    "Tremorsense 30'": ['held', 'missing Attribution Assessment'],
    'Unbreakable Heart': [
      'held',
      'Held under #227: scripted match PZO1110, PZO1131, PZO9202, PZO9226 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen campaign_setting/inner_sea_world_guide/iswg_spells.lst:17) lacks reviewed notices: PZO9202.',
    ],
    'Unholy Aura': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/core_rulebook/cr_spells.lst:1395).',
    ],
    'Weapon of Awe': [
      'held',
      'Held under #227: named holds kept: pf-buffs-549-emotion-attribution-Pet3yM3SB2VfqgPy (scripts/catalog/legal/pf-buffs-549.json).',
    ],
    'Wrathful Mantle': [
      'admitted',
      'Admitted under #227: scripted match PZO1110, PZO1115, PZO1131 via stored assessment (scripts/catalog/legal/pf-buffs-549.json, PCGen roleplaying_game/advanced_players_guide/apg_spells.lst:2121).',
    ],
  },
} as const satisfies Record<
  string,
  Record<string, readonly [GateState, string]>
>;
