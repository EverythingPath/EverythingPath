// #726: reviewed replacements for upstream changes whose formula the published
// rule contradicts. The Curation Overlay only appends outputs, so it cannot
// replace a raw change. Each row names one pinned record and its exact raw
// change, and the formula it imports as instead; target and bonus type stay the
// record's own. A record whose change no longer matches imports its raw change
// unchanged. A row is written `drafted` (stats-d2) and applies nothing until
// the curation review checks it: root then records the reviewer and date.

import {
  matchesRawChange,
  type ReviewedRawChange,
} from './racial-trait-rules.ts';

/** A row's review state: only a checked row, with its reviewer, applies. */
type ReplacementReview =
  | { status: 'drafted' }
  | { status: 'checked'; reviewedBy: string; reviewedOn: string };

export type ReviewedChangeReplacement = {
  externalKey: string;
  change: ReviewedRawChange & { target: string };
  /** The replacement, in Foundry's formula syntax like the raw change. */
  formula: string;
  /**
   * A condition the imported Modifier carries: `unarmored` (rotation-1) drops
   * it while an armor or shield item is active or while the Character is
   * helpless or immobilized, as the sheet reads them; `armorAtMost`
   * (rotation-4) drops it while heavier body armor is worn.
   */
  condition?: { unarmored: true } | { armorAtMost: 'medium' | 'light' };
  /**
   * The source says the entry's effects stack when it is taken more than
   * once (stats-d2 fix r1, Fleet): while the row applies, the imported entry
   * stacks with itself, so each copy's Modifiers count (`stacksWithItself`).
   */
  stacksWithItself?: true;
  evidence: string;
} & ReplacementReview;

const reviewedChangeReplacements: readonly ReviewedChangeReplacement[] = [
  {
    // Intimidating Prowess: Foundry clamps the Strength modifier at 0.
    externalKey: 'pf1/O0jbkTJcIji9BNiF',
    change: {
      target: 'skill.int',
      formula: 'max(0, @abilities.str.mod)',
      type: 'untyped',
    },
    formula: '@abilities.str.mod',
    evidence:
      'CRB p. 128: "Add your Strength modifier to Intimidate skill checks in addition to your Charisma modifier." PCGen cr_feats.lst:112 (BONUS:SKILL|Intimidate|STR) has no floor either, so a Strength penalty applies (owner decision 2026-10-13).',
    status: 'checked',
    reviewedBy: 'Opus (AI coder) for the owner',
    reviewedOn: '2026-10-14',
  },
  {
    // Mountain Guide (Five Kings Mountains): Foundry grants the Knowledge
    // (geography) bonus everywhere; the reviewed description record supplies
    // it under the mountainous-areas Situation instead.
    externalKey: 'pf1-content/GMtjhKObcxyyMzjC',
    change: { target: 'skill.kge', formula: '1', type: 'trait' },
    formula: '0',
    evidence:
      'Inner Sea Primer p. 7 (pinned pf1-content src/pf-traits/Mountain_Guide__Five_Kings_Mountains__GMtjhKObcxyyMzjC.yaml): "You gain a +1 trait bonus on Knowledge (geography) and Survival checks when in mountainous areas", which qualifies both skills; PCGen isp_abilities.lst:89 applies it unconditionally (owner decision, #372 fix round 1, 2026-10-17: condition both).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-17',
  },
  {
    // Soul-Searcher's Strength (Rivethun): Foundry grants the +1 on Fortitude
    // as if Fortitude were always the chosen save; the reviewed description
    // record supplies the +1 on each save under its own choice Situation.
    externalKey: 'pf1-content/k1yuWxuzWIn03iHu',
    change: { target: 'fort', formula: '1', type: 'trait' },
    formula: '0',
    evidence:
      'Healer\'s Handbook p. 26 (pinned pf1-content src/pf-traits/Soul_Searcher_s_Strength__Rivethun__k1yuWxuzWIn03iHu.yaml): "Choose one saving throw. You gain a +1 trait bonus on saving throws of the chosen kind." PCGen hhb_abilities.lst:37 encodes the choice as an ability pool (BONUS:ABILITYPOOL|Soul-Searcher\'s Save Bonus|1), not a fixed Fortitude bonus (#381).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-18',
  },
  {
    // Local Ties (Iron Gods): Foundry grants the +1 on both Disable Device and
    // Knowledge (engineering); the body has you choose one. The reviewed
    // description record supplies the +1 on each skill under its own choice
    // Situation (with the +3 Technologist Situations).
    externalKey: 'pf1-content/yyndu1qwOHp2g5y2',
    change: { target: 'skill.dev', formula: '1', type: 'trait' },
    formula: '0',
    evidence:
      'Iron Gods Player\'s Guide p. 8 (pinned pf1-content src/pf-traits/Local_Ties__Iron_Gods__yyndu1qwOHp2g5y2.yaml): "Choose Disable Device or Knowledge (engineering). You gain a +1 trait bonus on checks with this skill". PCGen ig_abilities.lst:6 and potr_abilities.lst:40 encode the choice (CHOOSE:SKILL|Disable Device|Knowledge (Engineering), BONUS:SKILL|%LIST|1), not both skills (#386).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-19',
  },
  {
    // Local Ties (Iron Gods): the Knowledge (engineering) half of the same
    // overstated pair.
    externalKey: 'pf1-content/yyndu1qwOHp2g5y2',
    change: { target: 'skill.ken', formula: '1', type: 'trait' },
    formula: '0',
    evidence:
      'Iron Gods Player\'s Guide p. 8 (pinned pf1-content src/pf-traits/Local_Ties__Iron_Gods__yyndu1qwOHp2g5y2.yaml): "Choose Disable Device or Knowledge (engineering). You gain a +1 trait bonus on checks with this skill". PCGen ig_abilities.lst:6 and potr_abilities.lst:40 encode the choice (CHOOSE:SKILL|Disable Device|Knowledge (Engineering), BONUS:SKILL|%LIST|1), not both skills (#386).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-19',
  },
  {
    // Dragon Magic (Elf): Foundry grants a +2 racial bonus on Perception that
    // the body does not state; the trait replaces elven magic, not keen senses.
    externalKey: 'pf1-content/H1bYc9y68ZKt1auL',
    change: { target: 'skill.per', formula: '2', type: 'racial' },
    formula: '0',
    evidence:
      'Legacy of Dragons p. 10 (pinned pf1-content src/pf-racial-traits/Dragon_Magic_H1bYc9y68ZKt1auL.yaml): elves with this trait who take a draconic bloodline "treat their Charisma scores as 2 points higher when determining the DC and uses per day of all bloodline abilities and bloodline spells" and add draconic-descriptor spells to their class spell lists, and the record\'s header names Elven Magic as the replaced trait. The body grants no Perception bonus, and PCGen lod_abilities_race.lst:18 has none either (#391).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-19',
  },
  {
    // Seasinger (Merfolk): Foundry grants an untyped +2 on every Perform
    // skill; the reviewed description record supplies the published +2 racial
    // bonus on Perform (sing) checks under its own Situation instead.
    externalKey: 'pf1-content/J65XMmSdfKBUu43b',
    change: { target: 'skill.prf', formula: '2', type: 'untyped' },
    formula: '0',
    evidence:
      'Advanced Race Guide p. 194 (pinned pf1-content src/pf-racial-traits/Seasinger_J65XMmSdfKBUu43b.yaml): "A seasinger gains a +2 racial bonus on Perform (sing) checks", which limits the bonus to singing and types it racial; PCGen arg_abilities_race.lst:961 has BONUS:SKILL|Perform (Sing)|2|TYPE=Racial (#392).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-19',
  },
  {
    // Aquatic Ancestry (Human): Foundry grants the racial Swim bonus equal to
    // the full Hit Dice; the body gives half the character level.
    externalKey: 'pf1-content/Q4FtkHZulWkKEk7v',
    change: {
      target: 'skill.swm',
      formula: '@attributes.hd.total',
      type: 'racial',
    },
    formula: 'floor(@attributes.hd.total / 2)',
    evidence:
      'Horror Adventures p. 41 (pinned pf1-content src/pf-racial-traits/Aquatic_Ancestry_Q4FtkHZulWkKEk7v.yaml): "They gain a racial bonus equal to half their character level on Swim checks"; PCGen ha_abilities_race.lst:101 has BONUS:SKILL|Swim|floor(TL/2)|TYPE=Racial (#394).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-20',
  },
  {
    // Veemod (Black): Foundry grants +10 on Perception, the green veemod's
    // value; the body and PCGen give the black veemod +2.
    externalKey: 'pf1/G4KDVMpA5nH0r9sF',
    change: { target: 'skill.per', formula: '10', type: 'competence' },
    formula: '2',
    evidence:
      'Technology Guide p. 53 (pinned pf1 packs/buffs/veemod-black.G4KDVMpA5nH0r9sF.yaml): the body grants "+2 competence bonus on Perception checks"; PCGen tg_equip.lst:263 gives the black veemod "Magnification +2" (the white is +5 and the green +10) (#547).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-20',
  },
  {
    // Veemod (Powered Armor): Foundry grants +5 on Perception; the body and
    // PCGen give the powered armor's veemods +10.
    externalKey: 'pf1/WRwcMIspQq9acUQW',
    change: { target: 'skill.per', formula: '5', type: 'competence' },
    formula: '10',
    evidence:
      'Technology Guide p. 61 (pinned pf1 packs/buffs/veemod-powered-armor.WRwcMIspQq9acUQW.yaml): the body grants "+10 competence bonus on Perception checks"; PCGen tg_equip.lst:280 (Powered Armor) says its custom veemods "grant a +10 bonus on Perception checks" (#547).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-20',
  },
  {
    // Veil of Positive Energy: Foundry grants the +2 sacred bonus to AC
    // against everything; the reviewed description record supplies it only
    // against undead creatures.
    externalKey: 'pf1-content/IfR6nJz0I3Z2NrDm',
    change: { target: 'ac', formula: '2', type: 'sacred' },
    formula: '0',
    evidence:
      'Advanced Player\'s Guide p. 254 (pinned pf1 packs/spells/veil-of-positive-energy.xpmhu8rj7gbjns84.yaml, governing the pinned pf1-content src/pf-buffs/Veil_of_Positive_Energy_IfR6nJz0I3Z2NrDm.yaml): "you gain a +2 sacred bonus to AC and a+2 sacred bonus on saves. Both of these bonuses apply only against attacks or effects created by undead creatures"; PCGen apg_spells.lst:2107 has the same text and :260 "+2 AC, +2 on saves vs. undead". The buff body ties both bonuses to undead creatures too. The reviewed description record supplies them under that Situation (#548).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-20',
  },
  {
    // Veil of Positive Energy: the same for its +2 sacred bonus on saves.
    externalKey: 'pf1-content/IfR6nJz0I3Z2NrDm',
    change: { target: 'allSavingThrows', formula: '2', type: 'sacred' },
    formula: '0',
    evidence:
      'Advanced Player\'s Guide p. 254 (pinned pf1 packs/spells/veil-of-positive-energy.xpmhu8rj7gbjns84.yaml, governing the pinned pf1-content src/pf-buffs/Veil_of_Positive_Energy_IfR6nJz0I3Z2NrDm.yaml): "you gain a +2 sacred bonus to AC and a+2 sacred bonus on saves. Both of these bonuses apply only against attacks or effects created by undead creatures"; PCGen apg_spells.lst:2107 has the same text and :260 "+2 AC, +2 on saves vs. undead". The buff body ties both bonuses to undead creatures too. The reviewed description record supplies them under that Situation (#548).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-20',
  },
  {
    // Artisan's Tools, masterwork: Foundry grants the +2 circumstance bonus on
    // every Craft check; the reviewed description record supplies it on Craft
    // checks made with the tools.
    externalKey: 'pf1/5WTK5HUkSZVClehk',
    change: { target: 'skill.crf', formula: '2', type: 'circumstance' },
    formula: '0',
    evidence:
      'Core Rulebook p. 161 (pinned pf1 packs/items/artisan-s-tools-masterwork.5WTK5HUkSZVClehk.yaml): "masterwork artisan\'s tools are the perfect tools for the job, so you get a +2 circumstance bonus on Craft checks made with them", which qualifies the bonus. The reviewed description record supplies the +2 under a "Craft checks made with these tools" Situation (#430).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-21',
  },
  {
    // Musical instrument, masterwork: Foundry grants the +2 circumstance
    // bonus on every Perform check; the reviewed description record supplies
    // it on Perform checks made to perform with the instrument.
    externalKey: 'pf1/74nJBzdY4yvMZcBe',
    change: { target: 'skill.prf', formula: '2', type: 'circumstance' },
    formula: '0',
    evidence:
      'Core Rulebook p. 161 (pinned pf1 packs/items/musical-instrument-masterwork.74nJBzdY4yvMZcBe.yaml): "This high-quality instrument grants a +2 circumstance bonus on Perform checks made to perform with the instrument", which qualifies the bonus; the same body ties instruments to the Perform skills "associated with a musical instrument (keyboard, percussion, string, or wind)". The reviewed description record supplies the +2 under a "Perform checks made to perform with the instrument" Situation (#430).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-21',
  },
  {
    // Wild Forest Kobold (Kobold): Foundry puts one of the two +2 racial
    // bonuses on Stealth; the body and PCGen give it on Perception, which the
    // reviewed description record supplies instead.
    externalKey: 'pf1-content/hTQmrexaurb1Vu4A',
    change: { target: 'skill.ste', formula: '2', type: 'racial' },
    formula: '0',
    evidence:
      'Kobolds of Golarion p. 7 (pinned pf1-content src/pf-racial-traits/Wild_Forest_Kobold_hTQmrexaurb1Vu4A.yaml): "You gain a +2 racial bonus on Perception and Survival checks." Stealth appears only as a class skill ("Stealth and Survival are always class skills for you"). PCGen kog_abilities_race.lst:35 has BONUS:SKILL|Perception,Survival|2|TYPE=Racial (#400).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-21',
  },
  {
    // Gift of Tongues (Gnome): Foundry types the +1 on Bluff racial; the body
    // gives an untyped bonus, which the reviewed description record supplies.
    externalKey: 'pf1-content/hcagqE7fLh67ZCKZ',
    change: { target: 'skill.blf', formula: '1', type: 'racial' },
    formula: '0',
    evidence:
      'Advanced Player\'s Guide p. 15 and Advanced Race Guide p. 32 (pinned pf1-content src/pf-racial-traits/Gift_of_Tongues_hcagqE7fLh67ZCKZ.yaml): "Gnomes with this racial trait gain a +1 bonus on Bluff and Diplomacy checks", an untyped bonus; PCGen apg_abilities_race.lst:47 and arg_abilities_race.lst:127 have BONUS:SKILL|Bluff,Diplomacy|1 with no type. The reviewed description record supplies the untyped +1 instead (#400 fix round 1).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-21',
  },
  {
    // Gift of Tongues (Gnome): the Diplomacy half of the same pair.
    externalKey: 'pf1-content/hcagqE7fLh67ZCKZ',
    change: { target: 'skill.dip', formula: '1', type: 'racial' },
    formula: '0',
    evidence:
      'Advanced Player\'s Guide p. 15 and Advanced Race Guide p. 32 (pinned pf1-content src/pf-racial-traits/Gift_of_Tongues_hcagqE7fLh67ZCKZ.yaml): "Gnomes with this racial trait gain a +1 bonus on Bluff and Diplomacy checks", an untyped bonus; PCGen apg_abilities_race.lst:47 and arg_abilities_race.lst:127 have BONUS:SKILL|Bluff,Diplomacy|1 with no type. The reviewed description record supplies the untyped +1 instead (#400 fix round 1).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-21',
  },
  {
    // Master Tinker (Gnome): Foundry types the +1 on Disable Device racial;
    // the body gives an untyped bonus, which the reviewed description record
    // supplies.
    externalKey: 'pf1-content/iHI1zDebmLg28ZWW',
    change: { target: 'skill.dev', formula: '1', type: 'racial' },
    formula: '0',
    evidence:
      'Advanced Player\'s Guide p. 15 and Advanced Race Guide p. 32 (pinned pf1-content src/pf-racial-traits/Master_Tinker_iHI1zDebmLg28ZWW.yaml): "Gnomes with this racial trait gain a +1 bonus on Disable Device and Knowledge (engineering) checks", an untyped bonus; PCGen apg_abilities_race.lst:49 and arg_abilities_race.lst:130 have BONUS:SKILL|Disable Device,Knowledge (Engineering)|1 with no type. The reviewed description record supplies the untyped +1 instead (#400 fix round 1).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-21',
  },
  {
    // Master Tinker (Gnome): the Knowledge (engineering) half of the same pair.
    externalKey: 'pf1-content/iHI1zDebmLg28ZWW',
    change: { target: 'skill.ken', formula: '1', type: 'racial' },
    formula: '0',
    evidence:
      'Advanced Player\'s Guide p. 15 and Advanced Race Guide p. 32 (pinned pf1-content src/pf-racial-traits/Master_Tinker_iHI1zDebmLg28ZWW.yaml): "Gnomes with this racial trait gain a +1 bonus on Disable Device and Knowledge (engineering) checks", an untyped bonus; PCGen apg_abilities_race.lst:49 and arg_abilities_race.lst:130 have BONUS:SKILL|Disable Device,Knowledge (Engineering)|1 with no type. The reviewed description record supplies the untyped +1 instead (#400 fix round 1).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-21',
  },
  {
    // Cloak of Elvenkind: Foundry grants the +5 competence bonus on every
    // Stealth check; the reviewed description record supplies it while the
    // hood is drawn up.
    externalKey: 'pf1/HSF0j88RR9JeTaJi',
    change: { target: 'skill.ste', formula: '5', type: 'competence' },
    formula: '0',
    evidence:
      'Core Rulebook p. 507 (pinned pf1 packs/items/cloak-of-elvenkind.HSF0j88RR9JeTaJi.yaml): "When this plain gray cloak is worn with the hood drawn up around the head, the wearer gains a +5 competence bonus on Stealth checks", which qualifies the bonus; PCGen cr_equip_magic_items.lst:107 has the same DESC (BONUS:SKILL|Stealth|5 unconditional). The reviewed description record supplies the +5 under a "worn with the hood drawn up" Situation (#431).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-21',
  },
  {
    // Robe of the Archmagi (Black): Foundry grants an untyped +5 on armor AC
    // to every wearer; the reviewed description record supplies the +5 armor
    // bonus for an arcane spellcaster.
    externalKey: 'pf1/CSM3wLxqmR8qMpyT',
    change: { target: 'aac', formula: '5', type: 'untyped' },
    formula: '0',
    evidence:
      'Core Rulebook p. 527 (pinned pf1 packs/items/robe-of-the-archmagi-black.CSM3wLxqmR8qMpyT.yaml): "Only an arcane spellcaster can fully realize this potent magic item\'s powers once the robe is donned. These powers are as follows. +5 armor bonus to AC", which makes the bonus an armor bonus for an arcane spellcaster; Foundry\'s change is an untyped bonus for every wearer, which would stack with worn armor. PCGen cr_equip_magic_items.lst:308 gates the powers on an arcane spellcaster (PREMULT SPELLCASTER.Arcane). The reviewed description record supplies the +5 armor bonus under a "worn by an arcane spellcaster" Situation (#431).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-21',
  },
  {
    // Robe of the Archmagi (White): Foundry grants an untyped +5 on armor AC
    // to every wearer; the reviewed description record supplies the +5 armor
    // bonus for an arcane spellcaster.
    externalKey: 'pf1/Dt0WMY6EU7M3g6mo',
    change: { target: 'aac', formula: '5', type: 'untyped' },
    formula: '0',
    evidence:
      'Core Rulebook p. 527 (pinned pf1 packs/items/robe-of-the-archmagi-white.Dt0WMY6EU7M3g6mo.yaml): "Only an arcane spellcaster can fully realize this potent magic item\'s powers once the robe is donned. These powers are as follows. +5 armor bonus to AC", which makes the bonus an armor bonus for an arcane spellcaster; Foundry\'s change is an untyped bonus for every wearer, which would stack with worn armor. PCGen cr_equip_magic_items.lst:306 gates the powers on an arcane spellcaster (PREMULT SPELLCASTER.Arcane). The reviewed description record supplies the +5 armor bonus under a "worn by an arcane spellcaster" Situation (#431).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-21',
  },
  {
    // Softpaw boots: Foundry grants the +1 circumstance bonus on Stealth to
    // any wearer; the reviewed description record supplies it to a catfolk.
    externalKey: 'pf1/Ex7CexjHoS3hrgnV',
    change: { target: 'skill.ste', formula: '1', type: 'circumstance' },
    formula: '0',
    evidence:
      'Advanced Race Guide p. 93 (pinned pf1 packs/items/softpaw-boots.Ex7CexjHoS3hrgnV.yaml): "While wearing softpaw boots, a catfolk gains a +1 circumstance bonus on Stealth checks", which limits the bonus to a catfolk wearer; PCGen arg_equip_general.lst:67 has the same SPROP and types the boots Racial.Catfolk. The reviewed description record supplies the +1 under a "while a catfolk wears softpaw boots" Situation (#431).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-21',
  },
  {
    // Ventriloquist's Dummy: Foundry grants the +2 circumstance bonus on every
    // Perform check; the reviewed description record supplies it on Perform
    // (comedy) checks when the dummy is part of a routine.
    externalKey: 'pf1/GgSzAvYJmdk5JGL6',
    change: { target: 'skill.prf', formula: '2', type: 'circumstance' },
    formula: '0',
    evidence:
      'Occult Adventures p. 251 (pinned pf1 packs/items/ventriloquist-s-dummy.GgSzAvYJmdk5JGL6.yaml): "When used as part of a routine, a ventriloquist\'s dummy adds a +2 circumstance bonus on Perform (comedy) checks", which qualifies the bonus; PCGen oa_equip.lst:37 has the same SPROP. The reviewed description record supplies the +2 under a "Perform (comedy) checks when the dummy is used as part of a routine" Situation (#431).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-21',
  },
  {
    // Magic Fang: Foundry grants the +1 enhancement bonus on every melee
    // attack; the reviewed description record supplies it only with the
    // natural weapon or unarmed strike the spell affects.
    externalKey: 'pf1-content/hLyR3HQklOuoI86H',
    change: { target: 'mattack', formula: '1', type: 'enh' },
    formula: '0',
    evidence:
      'Core Rulebook p. 308 (pinned pf1 packs/spells/magic-fang.cfzk3vkv1c7ncaug.yaml, governing the pinned pf1-content src/pf-buffs/Magic_Fang_hLyR3HQklOuoI86H.yaml): "Magic fang gives one natural weapon or unarmed strike of the subject a +1 enhancement bonus on attack and damage rolls"; PCGen cr_spells.lst:1131 has the same text and :717 applies it to a natural weapon only. The buff body says the same. The reviewed description record supplies the bonus under that Situation (#549).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-21',
  },
  {
    // Magic Fang: the same for its +1 enhancement bonus on damage rolls.
    externalKey: 'pf1-content/hLyR3HQklOuoI86H',
    change: { target: 'wdamage', formula: '1', type: 'enh' },
    formula: '0',
    evidence:
      'Core Rulebook p. 308 (pinned pf1 packs/spells/magic-fang.cfzk3vkv1c7ncaug.yaml, governing the pinned pf1-content src/pf-buffs/Magic_Fang_hLyR3HQklOuoI86H.yaml): "Magic fang gives one natural weapon or unarmed strike of the subject a +1 enhancement bonus on attack and damage rolls"; PCGen cr_spells.lst:1131 has the same text and :717 applies it to a natural weapon only. The buff body says the same. The reviewed description record supplies the bonus under that Situation (#549).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-21',
  },
  {
    // Heart of the Wilderness (Human): Foundry grants the racial Survival bonus
    // equal to the full Hit Dice; the body gives half the character level.
    externalKey: 'pf1-content/naQ5kacMK4kyrhfW',
    change: {
      target: 'skill.sur',
      formula: '@attributes.hd.total',
      type: 'racial',
    },
    formula: 'floor(@attributes.hd.total / 2)',
    evidence:
      'Advanced Race Guide p. 72 (pinned pf1-content src/pf-racial-traits/Heart_of_the_Wilderness_naQ5kacMK4kyrhfW.yaml): "They gain a racial bonus equal to half their character level on Survival checks"; PCGen arg_abilities_race.lst:268 has BONUS:SKILL|Survival|TL/2|TYPE=Racial and apg_abilities_race.lst:113 BONUS:SKILL|Survival|TL/2 (#401).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-21',
  },
  {
    // Beastmaster (Half-Orc): Foundry types the +2 on Handle Animal racial;
    // the pinned body (the APG printing) gives an untyped bonus, which the
    // reviewed description record supplies.
    externalKey: 'pf1-content/mH8xEPH9wXFCmIgM',
    change: { target: 'skill.han', formula: '2', type: 'racial' },
    formula: '0',
    evidence:
      'Advanced Player\'s Guide p. 19 (pinned pf1-content src/pf-racial-traits/Beastmaster_mH8xEPH9wXFCmIgM.yaml): "A half-orc with this trait treats whip and net as martial weapons and gains a +2 bonus on Handle Animal checks", an untyped bonus; PCGen apg_abilities_race.lst:78 has BONUS:SKILL|Handle Animal|2 with no type. The later ARG printing (arg_abilities_race.lst:194) reads "+2 racial bonus", but the batch follows the version the pinned text matches. The reviewed description record supplies the untyped +2 instead (#401 fix round 1).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-10-21',
  },
  {
    // Self-Sufficient: Foundry reads `@skills.hea.ranks`, a path that does
    // not exist, so it gives a flat +2 on Heal; the rule gives +4 at 10
    // ranks. The replacement is #777's canonical rank formula, which the
    // rank-modifiers family proves (root decision R5(a), feat wave FW1).
    externalKey: 'pf1/8VZQJOyAXbXghxd7',
    change: {
      target: 'skill.hea',
      formula: '2 + if(gte(@skills.hea.ranks, 10), 2)',
      type: 'untyped',
    },
    formula: '2 + 2 * min(1, floor(@skillRanks.hea / 10))',
    evidence:
      'CRB p. 133 (pinned pf1 packs/feats/self-sufficient.8VZQJOyAXbXghxd7.yaml): "You get a +2 bonus on all Heal checks and Survival checks. If you have 10 or more ranks in one of these skills, the bonus increases to +4 for that skill." PCGen cr_feats.lst:145 has BONUS:SKILL|Heal|if(skillinfo("TOTALRANK","Heal")>=10,4,2). Foundry\'s `.ranks` (not `.rank`) never reaches 10, so the raw change contradicts the rule; the owner decided the skill-pair feats apply +2/+4 automatically from recorded ranks (#777 O1, 2026-11-08).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-11-09',
  },
  {
    // Self-Sufficient: the Survival half of the same `.ranks` pair.
    externalKey: 'pf1/8VZQJOyAXbXghxd7',
    change: {
      target: 'skill.sur',
      formula: '2 + if(gte(@skills.sur.ranks, 10), 2)',
      type: 'untyped',
    },
    formula: '2 + 2 * min(1, floor(@skillRanks.sur / 10))',
    evidence:
      'CRB p. 133, as for Heal; PCGen cr_feats.lst:145 has BONUS:SKILL|Survival|if(skillinfo("TOTALRANK","Survival")>=10,4,2) (#777 O1, root decision R5(a)).',
    status: 'checked',
    reviewedBy: 'Opus (AI curator) for the owner',
    reviewedOn: '2026-11-09',
  },
  {
    // AC Bonus (MNK): Foundry gates the bonus on armor, shield and load with
    // `if`/`lt`, outside the grammar, so the change imported as unsupported.
    // The replacement keeps the number; its `unarmored` condition drops it
    // with an armor or shield item or while helpless or immobilized
    // (rotation-1), and the reviewed description record's Note says to switch
    // the row off under a medium or heavy load (#607, S1). The body has
    // no `system.class`, so `@class.level` cannot map: the formula names both
    // granting classes' tags. The import gives Monk (Unchained) its own tag
    // and no counterpart relationship, so its levels count under
    // `monkUnchained` only; the higher of the two, not their sum, stays right
    // if a relationship is ever supplied (fix round 1).
    externalKey: 'pf1/4zVndIJ8NMWWzl1T',
    change: {
      target: 'ac',
      formula:
        'if(and(and(lt(@shield.type, 1), lt(@armor.type, 1)), lt(@attributes.encumbrance.level, 1)), 1) * (@abilities.wis.mod + floor(@class.level / 4))',
      type: 'untyped',
    },
    formula:
      'max(0, @abilities.wis.mod) + floor(max(@classLevel.monk, @classLevel.monkUnchained) / 4)',
    condition: { unarmored: true },
    evidence:
      'CRB p. 57 (PRD coreRulebook/classes/monk.html:383-384; Pathfinder Unchained p. 14, unchained/classes/monk.html:406-407): "When unarmored and unencumbered, the monk adds his Wisdom bonus (if any) to his AC and his CMD. In addition, a monk gains a +1 bonus to AC and CMD at 4th level. This bonus increases by 1 for every four monk levels thereafter, up to a maximum of +5 at 20th level." A Wisdom penalty gives no bonus. PCGen cr_abilities_class.lst:1090 (Monk AC Tracker) has BONUS:VAR|MonkACStatBonus|max(WIS,0) and BONUS:VAR|MonkACBonus|min((MonkACLVL)/4,5), on AC and CMD. The Foundry armor and shield test (@armor.type, @shield.type, items only) and "immobilized or helpless" (monk.html:384) are the `unarmored` condition: lost while an armor or shield item is active, or while Helpless, Paralyzed, Unconscious, Petrified or Pinned (root default 2026-11-15; condition drafted in rotation-1 for curation review). Load is not tracked; the Note says to switch the row off then (#607, S1).',
    status: 'checked',
    reviewedBy: 'Sol (AI review) for the owner',
    reviewedOn: '2026-11-15',
  },
  {
    // AC Bonus (MNK): the same bonus on CMD.
    externalKey: 'pf1/4zVndIJ8NMWWzl1T',
    change: {
      target: 'cmd',
      formula:
        'if(and(and(lt(@shield.type, 1), lt(@armor.type, 1)), lt(@attributes.encumbrance.level, 1)), 1) * (@abilities.wis.mod + floor(@class.level / 4))',
      type: 'untyped',
    },
    formula:
      'max(0, @abilities.wis.mod) + floor(max(@classLevel.monk, @classLevel.monkUnchained) / 4)',
    condition: { unarmored: true },
    evidence:
      'CRB p. 57 (PRD coreRulebook/classes/monk.html:383-384; Pathfinder Unchained p. 14, unchained/classes/monk.html:406-407): "When unarmored and unencumbered, the monk adds his Wisdom bonus (if any) to his AC and his CMD. In addition, a monk gains a +1 bonus to AC and CMD at 4th level. This bonus increases by 1 for every four monk levels thereafter, up to a maximum of +5 at 20th level." A Wisdom penalty gives no bonus. PCGen cr_abilities_class.lst:1090 (Monk AC Tracker) has BONUS:VAR|MonkACStatBonus|max(WIS,0) and BONUS:VAR|MonkACBonus|min((MonkACLVL)/4,5), on AC and CMD. The Foundry armor and shield test (@armor.type, @shield.type, items only) and "immobilized or helpless" (monk.html:384) are the `unarmored` condition: lost while an armor or shield item is active, or while Helpless, Paralyzed, Unconscious, Petrified or Pinned (root default 2026-11-15; condition drafted in rotation-1 for curation review). Load is not tracked; the Note says to switch the row off then (#607, S1).',
    status: 'checked',
    reviewedBy: 'Sol (AI review) for the owner',
    reviewedOn: '2026-11-15',
  },
  {
    // Fast Movement (Barbarian, Barbarian (Unchained), Bloodrager): Foundry
    // gates the +10 on `@armor.type` and load with `if`/`lte`, outside the
    // grammar. The replacement keeps the number; `armorAtMost: 'medium'` drops
    // it in heavy armor (stats-d2). The `base` type imports as untyped.
    // Checked on the stats-d2 round 1 Spec review (CONFIRMED).
    externalKey: 'pf1/9EX00obqhGHcrOdp',
    change: {
      target: 'landSpeed',
      formula:
        'if(and(lte(@armor.type, 2), lt(@attributes.encumbrance.level, 2)), 10)',
      type: 'base',
    },
    formula: '10',
    condition: { armorAtMost: 'medium' },
    evidence:
      'CRB p. 31 (PRD coreRulebook/classes/barbarian.html:381): "A barbarian\'s land speed is faster than the norm for her race by +10 feet. This benefit applies only when she is wearing no armor, light armor, or medium armor, and not carrying a heavy load. Apply this bonus before modifying the barbarian\'s speed because of any load carried or armor worn. This bonus stacks with any other bonuses to the barbarian\'s land speed." The same for the Unchained Barbarian (unchained/classes/barbarian.html:399) and the Bloodrager (advancedClassGuide/classes/bloodrager.html:451). PCGen cr_abilities_class.lst:420 has BONUS:MOVEADD|TYPE=Walk|10|PREVARLT:ENCUMBERANCE,2,var("COUNT[EQTYPE.ARMOR.EQUIPPED.IS.HEAVY]"),1, untyped. Load is not tracked (owner 2026-11-17: a Note).',
    status: 'checked',
    reviewedBy: 'gpt-6.1-sol (codex; AI review) for the owner',
    reviewedOn: '2026-11-18',
  },
  {
    // Fleet (feat): +5 while light or no armor is worn; Foundry gates it on
    // `@armor.type` and load. `armorAtMost: 'light'` drops it in medium or
    // heavy armor (stats-d2). The `base` type imports as untyped. Each copy
    // adds (fix r1: `stacksWithItself`). Checked with its per-copy stacking
    // on the stats-d2 round 3 Spec review (CONFIRMED pf1/BkKYCzEGNTzZRiTz),
    // which the round 3 Standards review confirmed too.
    externalKey: 'pf1/BkKYCzEGNTzZRiTz',
    change: {
      target: 'landSpeed',
      formula:
        'if(and(lt(@armor.type, 2), lt(@attributes.encumbrance.level, 1)), 5)',
      type: 'base',
    },
    formula: '5',
    condition: { armorAtMost: 'light' },
    stacksWithItself: true,
    evidence:
      'CRB p. 124. The PRD capture has no Core Rulebook feats page. The pinned Foundry body: "While you are wearing light or no armor, your base speed increases by 5 feet. You lose the benefits of this feat if you carry a medium or heavy load." and "You can take this feat multiple times. The effects stack." PCGen cr_feats.lst:70 has STACK:YES, MULT:YES and BONUS:MOVEADD|TYPE.Walk|5|PREVARLT:ENCUMBERANCE,1,var("COUNT[EQTYPE.ARMOR.EQUIPPED.IS.MEDIUM]"),1,var("COUNT[EQTYPE.ARMOR.EQUIPPED.IS.HEAVY]"),1, untyped. Load is not tracked (owner 2026-11-17: a Note).',
    status: 'checked',
    reviewedBy: 'gpt-6.2-sol (codex; AI review) for the owner',
    reviewedOn: '2026-11-18',
  },
  {
    // Fast Movement (MNK): the body has no `system.class`, so `@class.level`
    // cannot map; the formula names both granting classes' tags and takes
    // the higher, as AC Bonus (MNK) does (#607). No closed condition is
    // "armor only": `unarmored` also drops it with a shield or while
    // helpless or immobilized, which the rule doesn't say. It stays drafted
    // until a condition that reads armor only exists (root decision, stats-d2
    // fix r1: a calculation rotation).
    externalKey: 'pf1/CK5L0YJDENqBxLqv',
    change: {
      target: 'landSpeed',
      formula: '10 * (floor(@class.level / 3))',
      type: 'enh',
    },
    formula: '10 * floor(max(@classLevel.monk, @classLevel.monkUnchained) / 3)',
    condition: { unarmored: true },
    evidence:
      'CRB p. 57 (PRD coreRulebook/classes/monk.html:405): "At 3rd level, a monk gains an enhancement bonus to his land speed, as shown on Table: Monk. A monk in armor or carrying a medium or heavy load loses this extra speed." The table gives +10 ft. at 3rd level and +10 ft. more every three levels, +60 ft. at 18th; Pathfinder Unchained p. 13 (unchained/classes/monk.html:439 and its table) the same. PCGen cr_abilities_class.lst:1098 has BONUS:VAR|MonkFastMovementBonus|10*floor(MonkFastMovementLVL/3) as an Enhancement MOVEADD, lost with equipped armor. `unarmored` stands for "in armor"; it also drops the bonus with a shield or while Helpless, Paralyzed, Unconscious, Petrified or Pinned. Load is not tracked (owner 2026-11-17: a Note).',
    status: 'drafted',
  },
];

/** Every row, drafted and checked. */
export { reviewedChangeReplacements };

/**
 * The checked replacement for a record's raw change, if any: a drafted row
 * applies nothing.
 */
export function findReviewedReplacement(
  externalKey: string,
  change: Record<string, unknown>,
  rows: readonly ReviewedChangeReplacement[] = reviewedChangeReplacements,
) {
  return rows.find(
    (row) =>
      row.status === 'checked' &&
      row.externalKey === externalKey &&
      matchesRawChange(change, row.change),
  );
}

/**
 * Whether a checked row that applies to one of the record's raw changes says
 * the entry stacks with itself (stats-d2 fix r1).
 */
export function reviewedStacksWithItself(
  externalKey: string,
  changes: readonly Record<string, unknown>[],
  rows: readonly ReviewedChangeReplacement[] = reviewedChangeReplacements,
) {
  return changes.some(
    (change) =>
      findReviewedReplacement(externalKey, change, rows)?.stacksWithItself,
  );
}

/** The reviewed formula that replaces a record's raw change, if any. */
export function findReviewedReplacementFormula(
  externalKey: string,
  change: Record<string, unknown>,
) {
  return findReviewedReplacement(externalKey, change)?.formula;
}

/**
 * The distinct checked formulas for a record's raw changes of this target
 * and formula, whatever their bonus type: the launch inventory names a change
 * by target and formula only (`launch-inventory-build.ts`).
 */
export function reviewedReplacementFormulas(
  externalKey: string,
  change: { target: string; formula: string },
) {
  return [
    ...new Set(
      reviewedChangeReplacements
        .filter(
          (row) =>
            row.status === 'checked' &&
            row.externalKey === externalKey &&
            row.change.target === change.target &&
            row.change.formula === change.formula,
        )
        .map(({ formula }) => formula),
    ),
  ];
}
