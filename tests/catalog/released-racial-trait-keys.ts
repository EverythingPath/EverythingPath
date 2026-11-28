// pbl-released-racial-traits (PRD #251): the keys the racial-trait batch
// units and integration tests read, as committed data, so released-racial-
// traits.test.ts and its integration test import them from the pinned store
// and read no batch directory:
//
// - `racialTraitBatches`, the keys of the nineteen batch previews'
//   entries (racial-traits-387 to racial-traits-405), in preview order, with
//   each entry's name: a check of "every entry" of a batch checks its list,
//   and a name is looked up within it, as the batch units did over their
//   preview;
// - `racialTraitContext`, the other keys those entries' assertions depend
//   on: each preview's closure (the races, traits, feats, spells and classes
//   its entries belong to, replace or link) and every race, replaced trait and
//   standard trait an entry or closure row names, plus the weapons whose
//   base types the batches' weapon familiarity traits grant (fix r2: the
//   proficiency checks of the batch reviews);
//   the importer places a trait under its race and resolves its replacements
//   and its race's relocated outputs against them;
// - `racialTraits719`, the records of the racial-traits-719 fixture tree
//   (its races, their standard traits, ten alternates, Skill Focus and eleven
//   weapons), each with its name; their folder records come with them.
//
// Nothing here reads a batch directory.

export const racialTraitBatches = {
  'racial-traits-387': [
    'pf1-content/03lDLNTSNRDEgNrh', // Languages (Aquatic Elf)
    'pf1-content/0732ZhCzO00426kM', // Deep Tradition
    'pf1-content/09c76EsW9zGXAEZ0', // Alternate Spell-Like Ability (Dhampir - Ancient-Born)
    'pf1-content/0CISUAPF2V91vvoo', // Rimesoul (Frost Undine)
    'pf1-content/0HcXO1YYEXC3TDlc', // Energy Resistance (Suli)
    'pf1-content/0JIgdy0PM9C4PxKC', // Native Outsider (Aphorite)
    'pf1-content/0N742nfnJEnmb3e8', // Fey Nature
    'pf1-content/0XgGpXLyrJnfXKTy', // Low-Light Vision (Naiad)
    'pf1-content/0bLTBltwiwx7EmGy', // Negative Energy Affinity
    'pf1-content/0batsU6Vpae72HiU', // Tentacle Attacks
    'pf1-content/0iD20IfHg4DJTX3X', // Final Change
    'pf1-content/0iFqZXfHNt2vAJ8h', // Div-Spawn (Spitespawn)
    'pf1-content/0iTSWckzDB9oMu4Q', // Dreamer
    'pf1-content/0kgOCeTSzC3Zg5v6', // Light from the Darkness
    'pf1-content/0lwUQ9hM3gWjZzki', // Darkvision (Fetchling)
    'pf1-content/0mr3QMbLIx0WHoBV', // Unfettered
    'pf1-content/0padhC2cSPeYhbuU', // Smite Good
    'pf1-content/0xPskB6ehhq5g5f6', // Minesight (Dwarf)
    'pf1-content/0zCDh21K2n1mqfJO', // Dusksight (Dwarf)
    'pf1-content/0zwAyNsw272Wm9Xg', // Alternate Skill Modifiers (Skinwalker - Fanglord)
    'pf1-content/10fI7Q5jTGYhav06', // Low-Light Vision (Kitsune)
    'pf1-content/14Yg8GAjRW3tW486', // Curiosity
    'pf1-content/17nj8pGeCnDOhExG', // Blended View (Half-Elf)
    'pf1-content/1AmHSWuqAMrEBChf', // Irrepressible
    'pf1-content/1AsRiSma7Ig8qAgf', // Living Machine
    'pf1-content/1HOWCThotIz5ztx0', // Keen Senses (Half-Elf)
    'pf1-content/1JlE7WfSvWMead3S', // Deepsight
    'pf1-content/1MzKaqJwwWClm9vd', // Hard Head, Big Teeth
    'pf1-content/1UHvZuP40K00NYLU', // Frightening
    'pf1-content/1a6WuPBFKqhIk4DC', // Sea-Born (Brine May)
    'pf1-content/1bZoIL5ZYzbjTHnQ', // Alternate Spell-Like Ability (Dhampir - Svetocher)
    'pf1-content/1kZ5mKCyb6CjEjFT', // Ekujae Elves
    'pf1-content/1npK4cEPv3XOSIT2', // Camouflage
    'pf1-content/1s61apBo9a9REri8', // Drow Heritage
    'pf1-content/1tOycM1c53b1tOsL', // Fey
    'pf1-content/1vPof37VgEYpfIxo', // Scavenger
    'pf1-content/1zFEagiB7rG5o0ks', // Conservative Diplomacy
    'pf1-content/1zv4iK55HmIBhNmF', // Amphibious (Locathah)
    'pf1-content/20MZKzAdXq7r91VL', // Darklands Guide
    'pf1-content/20tBxcHiLRujQYvC', // Crystalline Form
    'pf1-content/23HcNMKrQH3EnOQS', // Seducer
    'pf1-content/27NShcUlmj6wDaAW', // Shadowhunter (Halfling)
    'pf1-content/2AJOaBUtrLSKx6n4', // Intoxicating Aroma
    'pf1-content/2Apl0Nfjo4HelVN1', // Blood Frenzy
    'pf1-content/2CcPWXsRKYa0Za5s', // Tengu
    'pf1-content/2D0gZsqUawS3Rd0O', // Light Blindness (Drow)
    'pf1-content/2Do0WTfTNBwfKgjU', // Change Shape (Skinwalker - Scaleheart)
    'pf1-content/2F4IRW8AAicQ3VYc', // Greed (Dwarf)
    'pf1-content/2HJVv18LjvN5cW1c', // Skilled (Aasimar - Angelkin)
    'pf1-content/2HKpQJWvyFGjOd87', // Dhampir
    'pf1-content/2NXp8S2ZZ2Lh5LS3', // Halo
    'pf1-content/2P6GMxnBmxrFmNTM', // Reptilian Ancestry
    'pf1-content/2SMtlRt0fDdsm0xZ', // Fast Swimmer (Locathah)
    'pf1-content/2Sfr16Du1PcB739m', // Ooze Breath
    'pf1-content/2UbTDmZJKKlBmOxn', // Low-Light Vision (Fetchling)
    'pf1-content/2aTXOPJqZ8DpLi36', // Fey Thoughts (Dwarf)
    'pf1-content/2bzaqSpNN046f9ne', // Armor (Kobold)
    'pf1-content/2jJkIYgBDpnVusfr', // Utilitarian Magic
    'pf1-content/2ltiVrbIQHhbrSGQ', // Dragon Sight
    'pf1-content/2m3sETitdW1uwabS', // Own Two Feet
    'pf1-content/2mlJ9zKk5DkyT0Mm', // Spell-Like Ability (Oread - Ironsoul)
    'pf1-content/2ppVDApnWAEYnzHO', // Jininese Elves
    'pf1-content/2pxpHYnC1lhwLDso', // Forest Walker (Orang-Pendak)
    'pf1-content/2t6pdfDHRiX6UbEQ', // Submerged
    'pf1-content/2uXjoDFad7NaBCOG', // Spell-Like Ability (Undine - Rimesoul)
    'pf1-content/2y6Om4T1c7V7Stll', // Magical Absorption
    'pf1-content/2zJmqweobLpf54yh', // Native Outsider (Undine)
    'pf1-content/2zJzdyvZ61GVbC0H', // Scent (Catfolk)
    'pf1-content/2zhilqoeGrOO3yeI', // Lab Rat
    'pf1-content/355MFgN4senDv0w7', // Like the Wind
    'pf1-content/3640BjAlEPrnmAlP', // Sense Aberration
  ],
  'racial-traits-388': [
    'pf1-content/38bfb1KFwr3za7kA', // Thunderous Resilience
    'pf1-content/3BX3LlcsJ91SHSaW', // Fearless (Green Martian)
    'pf1-content/3HbUyHrEVeDiTH1d', // Languages (Half-Elf)
    'pf1-content/3J3lWu2Lm9aJSNXg', // Reptilian (Nagaji)
    'pf1-content/3PzAYj5qRX4uJs3O', // Share Knowledge
    'pf1-content/3RZF7jBAcKGjU8Lc', // Spell-Like Ability (Shabti)
    'pf1-content/3XixtpyBV5vwGgKd', // Sociable
    'pf1-content/3cpvYmnO0BSmgGwh', // Aquatic Elves
    'pf1-content/3e5TxgPBqVgYqWmQ', // Eye for Opportunity
    'pf1-content/3gVV8juxNQF8nTYx', // Sensual
    'pf1-content/3haIOIRYDeFc1YZH', // Archon-Blooded (Lawbringers)
    'pf1-content/3hnHDHLFtNDxJYCp', // Low-Light Vision (Vanara)
    'pf1-content/3o1rw23ElDPjD5FE', // Adoptive Parentage (Skill Focus)
    'pf1-content/3sFVS1F5eFcCUABV', // Pharaonic Will
    'pf1-content/3tCsYXDaPFsm02UA', // Sure Step (Half-Elf)
    'pf1-content/3vfffr4tidJuzisG', // Nimble Faller
    'pf1-content/3z3EDcQxrBgW8hIu', // Xenophobic
    'pf1-content/45xNKgDQ3SvKpW58', // Craven
    'pf1-content/48atSTzun3LaxtWe', // Acquisitive
    'pf1-content/4EnFrSO7n6EO5fxO', // Delicious
    'pf1-content/4G4E4KbCE45gMnhL', // Siege Survivor
    'pf1-content/4LypGODo155PBk96', // Plantspeech
    'pf1-content/4MyvbEuO6QOS28bR', // Ability Modifiers (Changeling - Waker May)
    'pf1-content/4UEQHzt67Dp4FIhc', // Normal Speed (Goblin)
    'pf1-content/4UPvvBKe9UXgCLj2', // Unnatural
    'pf1-content/4XBCUrlQKhc9tVi0', // Low-Light Vision (Orang-Pendak)
    'pf1-content/4YSG4vJPoip8XFRd', // Greed (Wyvaran)
    'pf1-content/4ZedJI3dIy2S7RCU', // Exotic Weapon Training
    'pf1-content/4eZSNsHGXAwZm4dk', // Experimental Body: Scorched
    'pf1-content/4hngB1Dheo1oKAK2', // Carrion Sense
    'pf1-content/4krEstETNnsuTsCl', // Languages (Vanara)
    'pf1-content/4m3vBWg6qo6oNpAf', // Shade Magic
    'pf1-content/4oBIdiWGwsIqgHJW', // Deep Jungle
    'pf1-content/4qveM7bUNizrOvka', // Divided Attention
    'pf1-content/4rlpda5ZIGArGsiY', // Slave Born
    'pf1-content/4sqgRGhlx1KPagLI', // Tongue of the Sea
    'pf1-content/4tT7hExEjO6bLoDC', // Nereid Fascination (Undine)
    'pf1-content/4tq1PgGZzIsYSVkH', // Experimental Body: Enchanted
    'pf1-content/4yq4e33DdCjnLDFT', // Stalwart Watcher
    'pf1-content/539xDsN3QbslLsz8', // Darkvision (Undine)
    'pf1-content/59KDrhHa6MuC4Rev', // Arena-Bred
    'pf1-content/5D8qTCeINYsd7lFp', // Frightener
    'pf1-content/5FoiVQ9OY4UMIE1I', // Languages (Android)
    'pf1-content/5GahxXf5d4aAosVh', // Shadowhunter (Half-Elf)
    'pf1-content/5JT4Frvc6yDSM99X', // Stability (Duergar)
    'pf1-content/5VyX82W0Q16bkypr', // Kasatha
    'pf1-content/5YDsKDGSzLMoH1dv', // Variant Tiefling Abilities
    'pf1-content/5a4cHF6UEIcKge9j', // Fey Magic (Gnome - HotW)
    'pf1-content/5aAT2BdFhvV4ukc2', // Death Throes
    'pf1-content/5lsAtsSAJ25y69ST', // Vampiric Empathy
    'pf1-content/5sk6uZ73lZRbwWWZ', // Taskmaster
    'pf1-content/65qkbJnrIWRphU3Q', // Climber
    'pf1-content/6922em9qimkrOqPG', // Ancestral Arms
    'pf1-content/6AA4khYton1MWeXO', // Alternate Spell-Like Ability (Skinwalker - Fanglord)
    'pf1-content/6BfXi2cAz6NupBHm', // Giant Ancestry
    'pf1-content/6DFp3gbxSJ3e8Slt', // Cave Crawler
    'pf1-content/6F7yKc2ohf4Qw3lo', // Boundary Walker
    'pf1-content/6JCG0ei0s0ossrtx', // Stonecunning (Dwarf)
    'pf1-content/6KO6a0MXHwYeUpLn', // Market Dweller
    'pf1-content/6NCgYBE5gSmI5O6K', // Human-Raised (Half-Elf)
    'pf1-content/6WC8EhYUUZEhNT8t', // Forest Walker (Half-Orc)
    'pf1-content/6bm6Fe3jqhiVoURA', // Darkvision (Ganzi)
    'pf1-content/6d96mOZtn3WCCN1A', // Surface Survivalist
    'pf1-content/6eYkzFOhZc6mL1Sc', // Alternate Spell-Like Ability (Skinwalker - Aerieborn)
    'pf1-content/6jqXMlYzrcoMyHde', // Light Sensitivity (Kobold)
    'pf1-content/6oTxfx1zD9qb1TbI', // Amphibious (Adaro)
    'pf1-content/6yUgkL8nRaoWTl41', // Ability Score Modifiers (Kitsune)
    'pf1-content/748xpeIEFeiucTjV', // Fiendish Sorcery
    'pf1-content/75LOlnGJh2e6OAZc', // Alternate Spell-Like Ability (Skinwalker - Coldborn)
    'pf1-content/79Bq0RavQyZx0IPA', // Cannibalistic Vitality
    'pf1-content/7B9RkslHip58EzP8', // Ocean's Daughter
  ],
  'racial-traits-389': [
    'pf1-content/7FYX5JLKL7oYGulN', // Speed (Being of Ib)
    'pf1-content/7IMx5MBTrYTOhTnf', // Ability Score Modifiers (Gathlain)
    'pf1-content/7JHnhD96PeWEnf7U', // Feral
    'pf1-content/7JWZErgiHFTPrman', // Scarred
    'pf1-content/7KMw9IErP1W9vQsO', // Spell-Like Ability (Dhampir)
    'pf1-content/7LMPWVsKB0u2krDQ', // Serpent Affinity
    'pf1-content/7LSKyC0eM1uQgBvm', // Deep Warrior
    'pf1-content/7TQQjCCfgoP7GexZ', // Mixed Heritage
    'pf1-content/7VH3Akj7yTzcw8Qx', // Soaring Agility
    'pf1-content/7cHKd5w3VKNTyFLW', // Repair Magic
    'pf1-content/7cNjfrDIdpHxu8YJ', // Shaman's Apprentice
    'pf1-content/7fL4TAWC0d05MIyv', // Past-Life Knowledge (Ghoran)
    'pf1-content/7g3F8YEFDlNPiGkA', // Adoptive Parentage (Weapon Focus)
    'pf1-content/7lquuXyjHJKCYDOU', // Ability Modifiers (Changeling - Sorrow May)
    'pf1-content/7tA7QryetJUIsI9M', // Emissary
    'pf1-content/7uXh24sfHB4VJBhL', // Round Ears
    'pf1-content/7ungQuC9iDjjX2vP', // Silent Hunter
    'pf1-content/7yKmMTrVOrcDObZj', // Flight (Wyvaran)
    'pf1-content/7yZpbgZLUjYFlFNr', // Past Life Knowledge (Shabti)
    'pf1-content/84BWLCPhOyIzE3Xv', // Creator's Legacy
    'pf1-content/86Fah2rrPRam2WF0', // Dragon-Scaled
    'pf1-content/86ckozGTUZvWb8dW', // Secretive
    'pf1-content/87aXXEDJDUH8e0XD', // Water Dependent
    'pf1-content/88rQ9iJdzI8Cmr18', // Light against Darkness
    'pf1-content/89B2pdN07oWOrnwN', // Languages (Reborn Samsaran)
    'pf1-content/89ENmvsXsZYGFVBm', // Viscous Blood
    'pf1-content/8Fcp5fwVESw51Dgm', // Stoic
    'pf1-content/8OaWgmorew8NgJ3d', // Shiftless
    'pf1-content/8S3LbLY78NiCmXT8', // Lashvine
    'pf1-content/8S5F3TatyTW9rRSB', // Alternate Spell-Like Ability (Skinwalker - Ragebred)
    'pf1-content/8S7WdHboDUYzMC0s', // Darkvision (Duskwalker)
    'pf1-content/8SYQX3mBlIw2yMrU', // Shards of the Past
    'pf1-content/8dxrQ9BRuv0eR6P1', // Ability Modifiers (Changeling - Virga May)
    'pf1-content/8faRAII4NRHmr6IC', // Languages (Naiad)
    'pf1-content/8gIlEIGMp5PaAUpL', // Tenacious
    'pf1-content/8iH64U7HbUz0gQo9', // Low-Light Vision (Vine Leshy)
    'pf1-content/8lSKScxOqbUF5X1H', // Drow-Descended
    'pf1-content/8llDUy987n44CJS2', // Vigilant Gaze
    'pf1-content/8nAoswunyxzzvQEB', // Fey Thoughts (Elf)
    'pf1-content/8nBdNng8y9E3AC5o', // Take to the Water
    'pf1-content/8nCDInPZ48zvuu1D', // Poison Minion (wayang)
    'pf1-content/8pL6ADeKtZt2FTum', // Armor (Merfolk)
    'pf1-content/8q9es0syBXGYhZSS', // Vishkanya
    'pf1-content/8tPc9LAjl0PpW5CZ', // Low-Light Vision (Deep One Hybrid)
    'pf1-content/8vByVIUdiF70ApWv', // Stoneseer (Svirfneblin)
    'pf1-content/8vJZseDShMzcl6Oz', // Hag Magic (ISR)
    'pf1-content/901VteaGCjg0FTKQ', // Object of Desire
    'pf1-content/93KXq6n1wiX0ifEy', // Spell-Like Ability (Tiefling - Shackleborn)
    'pf1-content/94u0I9hX8LLAzvmk', // Fey Fortitude
    'pf1-content/99pNNIwi4JrK0nDc', // Languages (Gathlain)
    'pf1-content/9CFWFY7SgYQcanu3', // Nomadic
    'pf1-content/9N7VsvYAiSscXsrO', // Human-Raised (Elf)
    'pf1-content/9bVCgccjlCuW7YyP', // Primitive Feat
    'pf1-content/9gJfWz14zoOymrv3', // Languages (Deep One Hybrid)
    'pf1-content/9iLQf70RGSRIPYMK', // Sound Mimicry
    'pf1-content/9j5vSsuKVhLdukD1', // Speed (Naiad)
    'pf1-content/9k7IPymCwkmHyI9O', // Kitsune
    'pf1-content/9krrIkXBMYXxnEaE', // Ancestral Grudge
    'pf1-content/9lCx7sugVXLoYbIW', // Energy Resistance (Undine)
    'pf1-content/9pH6zwWU6Dx2iFOf', // Darkvision (Grippli)
    'pf1-content/9qNVpJF05oCI1Yys', // Scent
    'pf1-content/9yQcbZtiXfYObTnT', // Normal Speed (Strix)
    'pf1-content/A25WUoiogbprnnzS', // Shadowhunter (Elf)
    'pf1-content/A7bikGavod3dmWDl', // Feral
    'pf1-content/AB09rH3NmgxxXdPf', // Darkvision (Trox)
    'pf1-content/ACFSI8aOJAYr89QM', // Darkvision (Dwarf)
    'pf1-content/ACSn93JmJ1nTtpeY', // Acid Breath
    'pf1-content/AEFbxJZ9Hr6LIT9l', // Knack with Poison
    'pf1-content/AFcmD01ppFbl5l9P', // Drow-Trained
    'pf1-content/AKuDJrwJUZULsJcS', // Skilled (Tiefling)
  ],
  'racial-traits-390': [
    'pf1-content/ALR9GkMbRKfG24xw', // Sure Step (Drow)
    'pf1-content/AO5nhhUfI1b4M37H', // Hardy
    'pf1-content/AQYBioB3D1EbhppG', // Magma Affinity (Ifrit - Lavasoul)
    'pf1-content/AgBhMGlaftYkCH0A', // Alternate Skill Modifiers (Skinwalker - Witchwolf)
    'pf1-content/AhKzUgvUAMysEDxU', // Darkvision (Ifrit)
    'pf1-content/AisJptj1zLCA5blH', // Water Affinity
    'pf1-content/ApO0RGr2Gzhmn8O3', // Darkvision (Kobold)
    'pf1-content/AqWhtrTEaKeJ9qZ6', // Unstoppable Magic
    'pf1-content/ArtoWaI22YDsrDHx', // Languages (Strix)
    'pf1-content/AvTDArpprTBmK1bc', // Jester
    'pf1-content/AvVAnxyxjjnvja9E', // Lasting Grudge
    'pf1-content/Awm5U8aA0n8RoC5o', // Sacred Tattoo
    'pf1-content/Ax9nTBosPUTxsSm8', // Energy Strike (Fire)
    'pf1-content/AzCeQSKFPUO7wO2u', // Light Sensitivity (Kuru)
    'pf1-content/B2D1fGqevyFO0un4', // Dwarf Traits
    'pf1-content/B3cuHM7Ab4p8kLmH', // Languages (Undine)
    'pf1-content/B6U6IMKIbklylZ0z', // Transitional Lore
    'pf1-content/B93R81ATGIvP1b5g', // Driven Worker
    'pf1-content/BD8FBL0PfVe5qfrt', // Pyrophile
    'pf1-content/BDdZagTVnNqGFBxs', // Hag Racial Trait (Changeling - Veil May)
    'pf1-content/BE3QYzPCTLBEaGzv', // Forlorn Elves
    'pf1-content/BFUKz38eVbL0HHi0', // Magic Resistant
    'pf1-content/BFszTUJLlDS1ZDB8', // +2 to One Ability Score (Human)
    'pf1-content/BHKMNxCT3v9uYQYs', // Daysighted
    'pf1-content/BMIxDLXqziDnuMSa', // Keen Senses (Drow)
    'pf1-content/BNpMu00YoQaJyRUt', // Night-Born (Moon May)
    'pf1-content/BO8RYKHYIldtwfI1', // Dirty Trickster
    'pf1-content/BRLeKQsuAdgeFbYa', // Toxic Skin
    'pf1-content/BUkCaVZZwAmcggRQ', // Languages (Triton)
    'pf1-content/BZvAxBgK3Qcj0J99', // Whispering Wind
    'pf1-content/BgNdXPtHRUJOuPwF', // Oni-Spawn (Hungerseed)
    'pf1-content/BmioT34QBFUeczwK', // Swamp Stride
    'pf1-content/BoKaaVK4wgIJW1i9', // Spell-Like Ability (Tiefling)
    'pf1-content/BoM8mOnp4b2S8Wza', // Chain Fighter
    'pf1-content/BsjoXUFny0rPD6xc', // Evasive Maneuvers
    'pf1-content/Bt1g2sR2N1REW8nH', // Fertile Soil
    'pf1-content/BvVgHyKfrWZxpi5x', // Industrious Urbanite
    'pf1-content/C1PaDJ7bjwWd2U4C', // Ability Modifiers (Changeling - Brine May)
    'pf1-content/C2pF36QqsyrsmkFi', // Starchild
    'pf1-content/C3Q7w4YJ7ALgd1am', // Nature Affinity
    'pf1-content/C6ShN5EYe8WUtbY1', // Shadow Foe
    'pf1-content/C7DoZtwBMutYgHTP', // Surface Infiltrator
    'pf1-content/CE7P9xyXwMPR0YbH', // Darkvision (Merfolk)
    'pf1-content/CEzqJtWkanQxWqcP', // Fey Thoughts (Half-Elf)
    'pf1-content/CHswbETjpZZan3xy', // Reflexive Improvisation
    'pf1-content/CIIghsU8K1M5XpKj', // Speak with Sharks (Adaro)
    'pf1-content/CKxKRzXRJPG1TCu0', // Hatred (Svirfneblin)
    'pf1-content/CLqyc1IF6YnKONfI', // Speak with Avians
    'pf1-content/CPOfbE09H9pI8Nhy', // Darkvision (Wayang)
    'pf1-content/CPsAbeWBokaEiZly', // Secret Strider
    'pf1-content/CRk79ejVlfpyi1nB', // Swim Speed (Cecaelia)
    'pf1-content/CTGG4ZOaOIvJj09S', // Dimdweller (Half-Orc)
    'pf1-content/CbGMxMkn1Zm56fqP', // Rodent Empathy
    'pf1-content/CbUIsaZa8o27Yfs8', // Mouthless
    'pf1-content/CbUmX1PZrxABz6ob', // Rock Stepper
    'pf1-content/CcJc9pWgmHCgTmGO', // Fiendish Resistance
    'pf1-content/Cf2TEicv6MHEE698', // Keen Scent (Adaro)
    'pf1-content/CmBe4LyfyjQ24hCA', // Jet (Cecaelia)
    'pf1-content/CmhdInCVqMiadv3T', // Claws (Changeling)
    'pf1-content/Cnfo5E1FQnEHb2r2', // Change Shape (Rougarou)
    'pf1-content/CxulnBwaWUQ8WlpW', // Low-Light Vision (Wyvaran)
    'pf1-content/D7JILr96IKHWN4vQ', // Halfling Jinx
    'pf1-content/D8AVfhkKN6J30OJx', // Darkvision (Munavri)
    'pf1-content/D8D7iC2Mp8Z5RHvt', // Outrider
    'pf1-content/DB36Ptkf1JFl5H37', // Shadow Dodger
    'pf1-content/DEowtAtiVIQOh2dj', // Dual Minded
    'pf1-content/DFWkrIYLx6L7Vs6W', // Smokesoul (Fume Sylph)
    'pf1-content/DI4TtsaRywLKUWbE', // Darkvision (Cecaelia)
    'pf1-content/DJJBP96MRHv0t2Ii', // Shoulder to Shoulder
    'pf1-content/DLslPcoXcnvQjIPH', // +2 Natural Armor
    'pf1-content/DbVNH3xkNdzeYdwL', // Monstrous Humanoid (Trox)
    'pf1-content/DhiYQkB9XHcThkS8', // Tremorsense
    'pf1-content/DiAFreCRKMIg0Ggl', // Grabbing Appendages
    'pf1-content/DlGjetJ3goyzTtno', // Swamp Leshy
  ],
  'racial-traits-391': [
    'pf1-content/DnOCuttDe4ish4w7', // Languages (Locathah)
    'pf1-content/DsH7y38wfWDPCINE', // Heart of the Sun
    'pf1-content/DuDqaejBaS9O9bSn', // Institutional Memory
    'pf1-content/DuFNFt2YIoJ9KYif', // Sticky Tendrils
    'pf1-content/DxVHodTFIi9AwMvr', // In the Shadows
    'pf1-content/DygcxOxDwuPpJmm6', // Behind the Veil (Gnome)
    'pf1-content/DyrdgHiQStt2znkE', // Languages (Kitsune)
    'pf1-content/E0JttnfFJ8Zz2pN9', // Monstrous Humanoid (Sahuagin)
    'pf1-content/E1pwA6cwxeoiLZHG', // Low-Light Vision (Vishkanya)
    'pf1-content/E8oONe3xMLCowfoc', // Insidious Telepathy
    'pf1-content/EEHp8xTA5wbN1b0x', // Natural Climber (Grippli)
    'pf1-content/EEjvlHbyXB1yYEgU', // Shadow Speaker
    'pf1-content/EFBMrsOLT7KAGFGg', // Natural Armor (Adaro)
    'pf1-content/EFIBFtuPXO0SE4U8', // Aquatic (Locathah)
    'pf1-content/EGuKja9c59lImGX4', // Low-Light Vision (Triton)
    'pf1-content/EKWfbMe0RnUmFJ6e', // Gliding Wings (Kobold)
    'pf1-content/EO0iWRFTSMCzHAXq', // Yamaraj's Baliff
    'pf1-content/EPHSQElGyQgaeplx', // Shadowplay (Gnome)
    'pf1-content/EQELT4ORTRAZs06D', // Drow Magic
    'pf1-content/ETapFH3D6SF1WwVn', // Spell-Like Ability (Tiefling - Beastbrood)
    'pf1-content/EUcZujQ4IkzBmgry', // Heart of the Streets
    'pf1-content/EbnxHOByXWYcmqYe', // Defensive Training (Svirfneblin)
    'pf1-content/Emdj8uxVBAqovMK3', // Fosterling
    'pf1-content/Eodq2jHbtqwdKI0v', // Blightborn
    'pf1-content/EpMVtxBLnkAejMM4', // Senses (Rougarou)
    'pf1-content/EwrAFmarDQhmHDpK', // Strongtail
    'pf1-content/F22dd0H1yM74ocb4', // Garrulous
    'pf1-content/F2j2piaRH1DBhohG', // Weather Savvy
    'pf1-content/F6e0vnGCV8OO2tyz', // Deft Swords
    'pf1-content/FD2SILZXcIMjauvr', // Hatred (Gnome)
    'pf1-content/FEu0wt9x3Vzny6ur', // Comprehensive Education
    'pf1-content/FFlAmgYJfOULGv0Z', // Darkvision (Drow)
    'pf1-content/FJHJNZFjwC1tvKnM', // Slimehunter
    'pf1-content/FKD0hz8VRsVIsfcb', // Languages (Grindylow)
    'pf1-content/FKDbnASBn1Lhdspf', // Superior Darkvision
    'pf1-content/FKiLZeX0mgKgr8bH', // Amphibious (Cecaelia)
    'pf1-content/FNERRlnZL8mWZLLL', // Alternate Spell-Like Ability (Skinwalker - Bloodmarked)
    'pf1-content/FOZo7WYLv1nrMiUm', // Wildfire Heart
    'pf1-content/FTP7h1bfD3Zkmf2N', // Daylight Adaptation
    'pf1-content/FVArwvrXwcHJtdNz', // Skilled (Tiefling - Faultspawn)
    'pf1-content/FVyCe9ASrrxnXeyx', // Alternate Spell-Like Ability (Skinwalker - Nightskulk)
    'pf1-content/FWRhefdBhdDvKS1N', // Languages (Svirfneblin)
    'pf1-content/FZ6FgKC8g50F07A4', // Slow (Yaddithian)
    'pf1-content/Fjtdhz01XBO393UX', // Native Outsider (Ganzi)
    'pf1-content/FkNwNCexIJKOgtY2', // Immortal Spark
    'pf1-content/FmU1AoSsE69xIeLH', // Sea Longing
    'pf1-content/Foqsm1jgAOgvnWCV', // Prehensile Tail (Kobold)
    'pf1-content/Fp6j8NnotqIeb4M9', // Weapon Familiarity (Grippli)
    'pf1-content/FyjBYbqlBore4xy6', // Darkvision (Grindylow)
    'pf1-content/FzTVEjj30jIOfvMw', // Sensitive Breath
    'pf1-content/Fzzd5GnZy7J7wU8j', // Ice Affinity (Undine - Rimesoul)
    'pf1-content/G3dZnTfFV6wwUr3F', // Scent (Ratfolk)
    'pf1-content/G8wXEXBfUKfRxuVV', // Hag Racial Trait (Changeling - Crawling Skin)
    'pf1-content/GBfKld1Iw8C2wtli', // Heart of the Mountains
    'pf1-content/GL7VJG5KSRQDF4GS', // Blood Enmity
    'pf1-content/GMSMVTSLsR4Trj5Q', // Amphibious (Gillman)
    'pf1-content/GMpkUiwCUgKZCObs', // Native Outsider (Shabti)
    'pf1-content/GS07eqHZBCT979tA', // Weapon Familiarity (Elf)
    'pf1-content/GSkWHI5OKIScXKx3', // Fey Wisdom
    'pf1-content/GXxza7xp8jSXG1kM', // Fey Magic (Gnome - HftF)
    'pf1-content/GdNaHGhrfNIfChvl', // Poison Use (Vishkanya)
    'pf1-content/GfHikcU2W5jAIyT8', // Poison Minion (Elf)
    'pf1-content/GfQrx1OHTdOIVAWb', // Weapon Familiarity (Dwarf)
    'pf1-content/GgPKX9hJt82hYYxg', // Natural Armor (Locathah)
    'pf1-content/GjiRIP6omZLo0j4y', // Samsaran Magic
    'pf1-content/GkuTWhbg0qcsr11b', // Glide
    'pf1-content/GlLRGgDP90v3uQFm', // Claws (Yaddithian)
    'pf1-content/GnO1Z83Jk3OBOvYt', // Spell-Like Abilities (Gathlain)
    'pf1-content/GvDRYlMwK8yy6Wlj', // Cautious Brawler
    'pf1-content/GyJ1zrZi3yP17xN6', // Spell-Like Ability (Munavri)
    'pf1-content/H0DVYfdF81BZBzGL', // Surreptitious
    'pf1-content/H1YJQ8kSvDqfq09q', // Water Bond
    'pf1-content/H1bYc9y68ZKt1auL', // Dragon Magic
    'pf1-content/H47fjaQE7ayPOVqt', // Native Outsider (Ifrit)
    'pf1-content/H59daebatbCBLoKq', // Change Shape (Reptoid)
  ],
  'racial-traits-392': [
    'pf1-content/H8rQtfSQ6Ws9EicL', // Sexual Dimorphism
    'pf1-content/HC3Bca5jWDNu0lWb', // Glider
    'pf1-content/HEOPhaWDWb6tyTnS', // Ability Modifiers (Changeling - Snow May)
    'pf1-content/HFKHorjMw2dERwBo', // Craftsman
    'pf1-content/HKY25NxPZPmmCyLp', // Languages (Shabti)
    'pf1-content/HLRPBh2KsFeAZ80f', // Lightbringer
    'pf1-content/HODSs5WDOVKrQJmT', // Natural Armor (Triton)
    'pf1-content/HSEQTjNZ9ZPnhZUZ', // Beast Talker
    'pf1-content/HVI7FNwj2ng10qtj', // Halfling Luck
    'pf1-content/HVrPKFO3jjYdMj6E', // Slow and Steady (Duergar)
    'pf1-content/HapMiOpR6SZycm6F', // Intrepid Settler
    'pf1-content/HdO6Xf8qZgaYWFNa', // Scaled Skin
    'pf1-content/HgsRDdx0DWvccvNd', // Burning Assurance (Sandkin)
    'pf1-content/Hi2xxPj8RqlQ5NYn', // Tripping Tentacles
    'pf1-content/Hl9pUifDtWTNl8Ce', // Natural Armor (Gathlain)
    'pf1-content/HlQZHVl2g1ALQvcU', // Construct
    'pf1-content/HomUlBQh0EYivpPx', // Imposter-Wary
    'pf1-content/Hp26XuRpA7QNUOZO', // Ironsoul (Metal Oread)
    'pf1-content/Hr7VZkVINGbLYfpo', // Celestial Resistance
    'pf1-content/HuTHL7T1EdrjNmVr', // Dayguard
    'pf1-content/HzKBmWjSHjYSNsU9', // Relentless
    'pf1-content/I0yTReZxAfE5biVp', // Mountain Half-Orcs (Cragkin)
    'pf1-content/I1G2vlwgLPPKgAkC', // Wary
    'pf1-content/I6yOviSAKlkZqshg', // Bullying
    'pf1-content/I8Zy5iy8HpAxBZQb', // Low-Light Vision (Half-Elf)
    'pf1-content/IFQQ7tPmJJM0ADpU', // Fey Magic (Half-Orc)
    'pf1-content/IFsGVU8XTl62vLHu', // Wing-Clipped
    'pf1-content/IJGd1TSyqGZb8BkZ', // Ingratiating
    'pf1-content/IJRr9hW0I3JvpP43', // Fangs
    'pf1-content/IMMiUPW6WLWA1Ur0', // Telepathic Senses
    'pf1-content/IMoj6UWbaCG3nGLM', // Skilled (Tiefling - Beastbrood)
    'pf1-content/IQ5vHUbNbGqVaVV5', // Defensive Training (Gnome)
    'pf1-content/IQMSioY3z5n7YnvD', // Hydrated Vitality
    'pf1-content/IQphttqw1U0aVd3j', // Hag Racial Trait (Changeling - Sea Lungs)
    'pf1-content/ISDM23EtuZrM7FYC', // Natural Weapon (Rougarou)
    'pf1-content/If5pzCueoAcW1gH8', // Psychic Sensitivity
    'pf1-content/Igl9Y5Dsn0JUc2p2', // Skilled (Half-Orc)
    'pf1-content/IhuFP2bF95CxfXim', // Limber
    'pf1-content/IihEWtYnIufBuARs', // Ward against Corruption
    'pf1-content/IqAHfnk4nZFtNoiO', // Student of the City
    'pf1-content/IrGbEnYCmrcDJRtd', // Psychic Attunement
    'pf1-content/Is0b85FOWlGlamTK', // Exalted Resistance
    'pf1-content/IsWc0OR9iZHYdi8V', // Dragon Soul
    'pf1-content/IuApwtNYMYMTabOZ', // Languages (Elf)
    'pf1-content/IyVxBas4dlfht6tU', // Spirit of the Waters
    'pf1-content/J1Dwg9toMkISFKjK', // Weapon Familiarity (Goblin)
    'pf1-content/J4yZRm0uY0156HhY', // Industrious
    'pf1-content/J65XMmSdfKBUu43b', // Seasinger
    'pf1-content/JAbeHqFork30yKAt', // Elf-Raised
    'pf1-content/JB9m2sNBMDG3cV7t', // Ratfolk
    'pf1-content/JJCX1zB7PDtiyWry', // Spell Resistance (Drow Noble)
    'pf1-content/JLGJMVewolF9XNVW', // Rakshasa-Spawn (Beastbrood)
    'pf1-content/JQ5GKhU4fgbLDkpF', // Alternate Skill Modifiers (Skinwalker - Nightskulk)
    'pf1-content/JRAuStEQiJCdtUwp', // Spell-Like Abilities (Fetchling - Plane Shift)
    'pf1-content/JWzMBJeAQYDav9gw', // Orc Blood
    'pf1-content/JYBBbQdb096At3uS', // Body Thorns
    'pf1-content/JdUecbyHLbK4aqT3', // Amphibious
    'pf1-content/JdmRjdRfq9S16pmP', // Change Shape (Skinwalker - Seascarred)
    'pf1-content/JhEI4m5iFNvOgm9H', // Lightning Affinity (Sylph - Stormsoul)
    'pf1-content/JkYEEoXqg586RnrU', // Normal Speed (Undine)
    'pf1-content/JlymGAKiie1gmqI2', // Weapon Familiarity (Orc)
    'pf1-content/Jnw41wF4ln2vH7d8', // Svirfneblin Magic (Svirfneblin)
    'pf1-content/JpCDy27IK3xb1DeK', // Skilled (Tiefling - Pitborn)
    'pf1-content/JsvoElxHBPdle8s8', // Slow and Steady (Dwarf)
    'pf1-content/JtJKg8vV58UJ6m1m', // Hatred (Dwarf)
    'pf1-content/JtvsIm1JAxjAL2YL', // Alternate Weakness (Dhampir - Ancient-Born)
    'pf1-content/JurU0JeI27uBxqLH', // Tribalistic
    'pf1-content/K0OwTmAv3gNkTc8B', // Change Shape (Skinwalker - Bloodmarked)
    'pf1-content/K2EflQoRjUsrIMyR', // Sneaky (Hobgoblin)
    'pf1-content/K7YBN0QKQeWCJZ9K', // Breeze-Kissed (Sylph)
    'pf1-content/K8MPTqH6wXv1qsGS', // Poison Minion (Human)
    'pf1-content/KCaTgWITt5MUDVQT', // Desert Delver
    'pf1-content/KEXruHT9nIp41wT1', // Peri-Blooded (Emberkin)
    'pf1-content/KEijNXH9Jnwa1Ggb', // Dragon Scholar
    'pf1-content/KFfarHpxjH2YZRa3', // Shadowplay
  ],
  'racial-traits-393': [
    'pf1-content/KRvHN3FECPuGS3AM', // Warslinger
    'pf1-content/KW6G6g9qFZLryJxQ', // Mwangi Dwarves
    'pf1-content/KXcFJRaHS35vdjSn', // Ability Modifiers (Changeling - Moon May)
    'pf1-content/KhGAH8JFwRVIEt2j', // Darkvision (Vine Leshy)
    'pf1-content/Knp7L2HErvfmxF5k', // Dusksight (Gnome)
    'pf1-content/KokxNNPmyhxyC2tO', // Deep Dweller
    'pf1-content/KqmKgeDMWBIS2qNP', // Festive
    'pf1-content/KtxhspNWZ4l2W6IR', // Air Affinity
    'pf1-content/KyDZk9dCBMAHnW4L', // Sea Legs
    'pf1-content/L2ucOsiHPXq7FKKF', // Cold-Blooded
    'pf1-content/L4yOFpviuO9WvCyT', // Keen Senses (Gnome)
    'pf1-content/L6hDTTsdEWKBj4gE', // Suspicious
    'pf1-content/LGR5l1wSNOiTc4xq', // Draconic Consular
    'pf1-content/LJMqyMRGo5QrUASa', // Weapon Familiarity (Drow)
    'pf1-content/LPQ68hAXI4lYQTYx', // Natural Armor (Sahuagin)
    'pf1-content/LTXZC6b60cP69ZeD', // Magehunter
    'pf1-content/LUlO5qY8jJdj6gtz', // Fell Magic (Gnome)
    'pf1-content/LVFFlvan4N1BQTEg', // Ability Modifiers (Changeling - Hearth May)
    'pf1-content/LVToSTaVYtVk7Sa3', // Spell-Like Ability (Aasimar)
    'pf1-content/LYHxu819kk0ZQjEs', // Amphibious (Merfolk)
    'pf1-content/LYX6NwyRtyurYLEa', // Leshy
    'pf1-content/LZ8WLQwF8ObuuJpJ', // Multi-Armed (Green Martian)
    'pf1-content/LcNmShAWgSJlqeMG', // Lesser Spell-Like Abilities
    'pf1-content/LcZE7cPw87DMzJYl', // Obsessive
    'pf1-content/LdbfPqPoza3xBUde', // Alternate Weakness (Dhampir - Ru-Shi)
    'pf1-content/LgS28VNVT3n6hCKH', // Flexible Half-Breed
    'pf1-content/LiMQiDGYaqLMHPQM', // Riverfolk
    'pf1-content/Lu5fwnybIjW7E4KB', // Voice in the Darkness (Elf)
    'pf1-content/Lv5ztInkUx9RmQDk', // Deep Shadow Explorer
    'pf1-content/LwDcZanOEHqVaYoh', // Skilled (Human)
    'pf1-content/LzFbBJDJsOh7wy8t', // Dreamthief-Born (Waker May)
    'pf1-content/LzVmMiyx87KxfDai', // Stoic Negotiator
    'pf1-content/M8L159eLa2EZlLWg', // Change Shape (Skinwalker - Coldborn)
    'pf1-content/MA2VzVJZ9Xvso5qb', // Swim Speed (Triton)
    'pf1-content/MFJmheGs8O0Q7Q1u', // Poison Use (Adaro)
    'pf1-content/MHNxeoT3fFxa3kL2', // Change Shape (Skinwalker - Aerieborn)
    'pf1-content/MNr30PKDqT4GLw8q', // Mist Child
    'pf1-content/MNzGZ2cMsU7bh6RN', // Behind the Veil (Halfling)
    'pf1-content/MQnZG0JAiMqtO91T', // Frostmelding
    'pf1-content/Mb0hz0BAj51wOmUr', // Wereboar-Kin (Ragebred)
    'pf1-content/MboeefX07pfct1hx', // Darkvision (Gnome)
    'pf1-content/McXN9Ox4pWf7xQ8E', // Natural Weapon (Tengu)
    'pf1-content/Mcn12mWoyj1AY6j1', // Triton Magic
    'pf1-content/MhFMYfP5kHTZOunS', // Amphibious (Grindylow)
    'pf1-content/MhxehLhTo8dKx5Wn', // Seasoned
    'pf1-content/MiPbhGqPRX7H4C7a', // Gnome Magic (Gnome)
    'pf1-content/MjM2hFpV8MHQTEwC', // Creepy
    'pf1-content/MqJQbPsttOKcQidO', // Dusksight (Halfling)
    'pf1-content/MtFsqvoTAnmxR7Du', // Jininese Weapon Mastery
    'pf1-content/MvSLvnvs1jpqtzKq', // Trusted Mediator
    'pf1-content/MzrlHdX4eG9oXoB5', // Alternate Skill Modifiers (Skinwalker - Coldborn)
    'pf1-content/N0trYSSeG9hrMCPR', // Knowledgeable
    'pf1-content/N4jPEdoaDwu4EJ4v', // Senses (Dhampir)
    'pf1-content/NApPIjNkVNBxzQS3', // Gatecrasher
    'pf1-content/NBbiF9fQTgRfNaFb', // Hag Magic (AoE)
    'pf1-content/NBmeuhkyRCjD3kV4', // Asura-Spawn (Faultspawn)
    'pf1-content/NC1bwUXvNsP7XkKe', // Heart of the Slums
    'pf1-content/NINkLcayOe5Zk7vQ', // Outsider
    'pf1-content/NNo2plkEqcGzHrDO', // Memories of the Forgotten
    'pf1-content/NQsZRny6Ed9oGDDP', // Shadow Inheritor
    'pf1-content/NRRo5ExVy4cqWWUR', // Silver Tongued
    'pf1-content/NWKhtsaVcMZHOhJU', // Languages (Ganzi)
    'pf1-content/NXo6ienQYsNzSdIr', // Low Blow
    'pf1-content/NZKgmlXsLylQzlvf', // Slave Hunter
    'pf1-content/NZqjZG4BTjWh0ZaQ', // Underfoot Dodger
    'pf1-content/NbYp94wEAcVHg28i', // Fey Magic (Human)
    'pf1-content/NdT5ee0UBJbBGxOc', // Languages (Aphorite)
    'pf1-content/NhfWDtVQtBcpKMBP', // Eternal Hope
    'pf1-content/Nhhd0xS2XSQ2luEe', // Cosmic Mind
    'pf1-content/Ni5twdUyps9MQyOX', // Jiang-Shi Born (Ru-Shi)
    'pf1-content/NlrWvpPCsJMVC7Qp', // Spell Resistance (Drow)
    'pf1-content/Nrfb2H4Ll6lnjzUt', // Vampire Hunter
    'pf1-content/NuCT6chK7Td1ef47', // Claw Attack
    'pf1-content/NuYBojmRnuwgyASW', // Treacherous Earth (Oread)
  ],
  'racial-traits-394': [
    'pf1-content/Nwir9OMkjPZ9fSDk', // Resist Level Drain (Dhampir)
    'pf1-content/O0p9WY2bZpciuXs4', // Secretive Survivor
    'pf1-content/O4c045wJE5lLweg3', // Eternal Grudge
    'pf1-content/O6yQCQgndhuYUxgN', // Memories Beyond Death
    'pf1-content/O79h8E0bytNQ3Wte', // Integrated
    'pf1-content/OAfZWupd9yLtJyVt', // Weapon Familiarity (Green Martian)
    'pf1-content/OFY1lCZv7lTqBqxl', // Keen Senses (Vishkanya)
    'pf1-content/OKOj8Njd7R51xoXM', // Skilled (Tiefling - Hungerseed)
    'pf1-content/OQLnOZYLv8WzxMbW', // Low-Light Vision (Kuru)
    'pf1-content/OSKe4wubLjYQOswq', // Dragonmaw
    'pf1-content/OYQqWgVtw30JL2qT', // Spell-Like Abilities (Fetchling - Disguise Self)
    'pf1-content/OayRgLPHanjzhdK0', // Spell-Like Ability (Tiefling - Hellspawn)
    'pf1-content/OcHofX7dmPTO2FJc', // Wright
    'pf1-content/OhtzsoHplJO2iqs7', // Spiresworn Elves
    'pf1-content/Ol8AbEHSbXnbj9eC', // Blasphemous Covenant
    'pf1-content/OqqOmbw84qSUfekh', // Polyglot
    'pf1-content/OrBsTYxtz2gkCF62', // Change Size
    'pf1-content/OskWDhOKD8ogUXFd', // Languages (Orang-Pendak)
    'pf1-content/OtTp6bzpLQ0gsia8', // Tree Stranger
    'pf1-content/OvKzLDHijIYHCO4A', // Fortunate
    'pf1-content/OvR36pLkOfFeJVQZ', // Poison Minion (Half-Elf)
    'pf1-content/Owfw2qBYmmKJsSYD', // Martial Recollection
    'pf1-content/OyIvyI3x7V5HIzZL', // Orc Ferocity
    'pf1-content/P1EvUId4dIEa4CCY', // Languages (Suli)
    'pf1-content/P32v41a5IFStjrX2', // Experimental Body: Blessed
    'pf1-content/P4eBE9KoLo0nWAZ9', // Aquatic (Merfolk)
    'pf1-content/PEz0pdv3ODLB5O8A', // Hypnotic Gaze
    'pf1-content/PHryxw5cbuUqi07S', // Winter-Born (Snow May)
    'pf1-content/PIMcPx0ChSCDRhb4', // Blindsense (Sahuagin)
    'pf1-content/PIxuFy35QRAS2jCE', // Sophisticate
    'pf1-content/PKI1mYZltP1nWgBs', // Mountain Clan
    'pf1-content/POCUxFT4m0DJf9s9', // Fleet of Foot
    'pf1-content/POpOQ92KDbEjUHMM', // Exiled Dwarf
    'pf1-content/PR2n7WHSkifyQAeA', // Over-Sized Ears
    'pf1-content/PYk8BVSrlIwDWzG1', // Slow Speed (Adaro)
    'pf1-content/PZivMg8Pl1LRnSQE', // Kindred-Raised
    'pf1-content/PdrOz09Jw9MiyqED', // Languages (Wyrwood)
    'pf1-content/Pe7olUqkJIbDGl4q', // Slow Speed (Gnome)
    'pf1-content/PlHMiodexQ4Ph2sd', // Military Tradition
    'pf1-content/PoeOzomLE0yQZG39', // Dreamspeaker
    'pf1-content/PpI7Dg0KK2Bwxqr5', // Spell Resistance (Munavri)
    'pf1-content/PpXi216y1kJgHY1C', // Frenzy
    'pf1-content/PpiI4GuDb2S5SPo6', // Spell-Like Ability (Aasimar - Idyllkin)
    'pf1-content/PrbroPUHndaGtsXZ', // Languages (Tiefling)
    'pf1-content/PtZLDuOW5e0OoVsx', // Gear Gnomes
    'pf1-content/PxiY2qb6ecVEaAVB', // Languages (Lashunta)
    'pf1-content/PxjUu8YOjXmWdagL', // Ability Modifiers (Changeling)
    'pf1-content/Q3bLl6S1s1r2Pgz9', // Spell-Like Ability (Sylph)
    'pf1-content/Q4FtkHZulWkKEk7v', // Aquatic Ancestry
    'pf1-content/Q901lu7ObAb1hJJ3', // Song'o Halflings
    'pf1-content/Q9DPJigrJ8kDDemn', // Fey Magic (Halfling)
    'pf1-content/Q9pyiVLTHEk6i0fR', // Languages (Merfolk)
    'pf1-content/QHrUf44V832k8pMm', // Manipulative
    'pf1-content/QK5CNiDmMqT3cdFB', // Unlucky Halfling
    'pf1-content/QKKgx5XFGKCFrwXg', // Wanderlust
    'pf1-content/QLhGfJhpG2KXm17L', // Vigilance
    'pf1-content/QRux4GYZsfcsvYP2', // Darkvision (Hobgoblin)
    'pf1-content/QdzlzrqWtgfjE4Fs', // Ancient Enmity
    'pf1-content/QgiMP50bjeNmLvbI', // Hag Racial Trait (Changeling - Green Widow)
    'pf1-content/Qgkfifudu74ghm0o', // Change Shape (Skinwalker - Witchwolf)
    'pf1-content/QhJ7FgCkYyiR6ZpR', // Languages (Samsaran)
    'pf1-content/QjhAMEEff8AzuwPa', // Amorphous
    'pf1-content/QkJI00xDaBcowq2i', // Deep Kin
    'pf1-content/QoUMSih2Xyc3GRR7', // Green-Born (Callow May)
    'pf1-content/QtSU2kSLH55e6DDI', // Water Sense (Undine)
    'pf1-content/QuCU7zACopBCx8Ob', // Skilled (Kitsune)
    'pf1-content/Qx1JqPVW0quaOGfY', // Natural Armor (Changeling)
    'pf1-content/R0qRSOcfexnzVYYs', // Ghost Hunter
  ],
  'racial-traits-395': [
    'pf1-content/R7UDXRs0E5klyzCY', // Garuda-Blooded (Plumekith)
    'pf1-content/RFh1QM9BhhoOEzaH', // Darkvision (Sylph)
    'pf1-content/RFndBrivFazRYZLp', // See in Darkness
    'pf1-content/RI0jgkyo4Dhyk5zs', // Hag Racial Trait (Changeling - Virga May)
    'pf1-content/RKCOV7Roq9MdxLZ5', // Faerie Dragon Magic
    'pf1-content/RKMn7UZjPlPPU4Nv', // Perfect
    'pf1-content/RScQcZuZDW9bGV8c', // Elemental Assault
    'pf1-content/RX8XCS2CoFhYwiBG', // Cold-Honed
    'pf1-content/RXEGl40emjun7g7s', // Slow Speed (Triton)
    'pf1-content/RXUzMQm7nOijW9zk', // Champion of Dark Powers
    'pf1-content/RYyMubzEGeBaS6Q5', // Elf
    'pf1-content/Ral2Kd4diC6McjqC', // Joyous Companion
    'pf1-content/RbJrsAMEPJMnBNnR', // Flight (Syrinx)
    'pf1-content/RciaNbMBeBVfJMjZ', // Energy Strike (Acid)
    'pf1-content/RfPJoszfAEHlG3wH', // Caretaker
    'pf1-content/RhI2edtj26rk0mWy', // Native Outsider (Suli)
    'pf1-content/RioelvLpNPwWWF7b', // Immortal
    'pf1-content/Rj3X80eJLvjX0SpQ', // Blood-Born (Veil May)
    'pf1-content/RjUGliORGeNs7Vsq', // Languages (Kasatha)
    'pf1-content/RleWFHpXOUaneeqN', // Alternate Spell-Like Ability (Skinwalker - Seascarred)
    'pf1-content/RpWzdpSJZcaBAvhn', // Spell-Like Ability (Sylph - Smokesoul)
    'pf1-content/RsQ6g0STYFLSSpm5', // Languages (Gillman)
    'pf1-content/Rx1ayk8e3zpDoslL', // Forge-Hardened
    'pf1-content/RyZzO5ouGh5GzvjZ', // Spell-Like Ability (Ifrit)
    'pf1-content/RypMqnONgwnba8aC', // Defensive Training (Grippli)
    'pf1-content/S0kzNQEZQOJswP6b', // Languages (Wyvaran)
    'pf1-content/S2NJixZYq3fBtPig', // Arctic Elf
    'pf1-content/S2fAbQom6ogn4gh9', // Wereraptor-Kin (Aerieborn)
    'pf1-content/S54OGr1E0tI6V4jQ', // Imperious Human
    'pf1-content/SCPbTbMBMkwN2Uba', // Hag Racial Trait (Changeling - Hulking Changeling)
    'pf1-content/SFD4dGofogr1c1S9', // Nosferatu-Born (Ancient-Born)
    'pf1-content/SJOcTJ2MQI3AoMeh', // Orc Atavism
    'pf1-content/SL536HxlnXKaBne1', // Piety
    'pf1-content/SL6K0vushMwPUDxn', // Gifted Linguist
    'pf1-content/SLZIXlmsbFFwnRo4', // Shadowhunter (Dwarf)
    'pf1-content/SNbWlc13JTMMG3qd', // Pass without Trace
    'pf1-content/SQZL2A9E62X4Xn7i', // Duplicitous
    'pf1-content/SRBfqkzIldwETAHB', // Dual Talent
    'pf1-content/SSksShaDho0IcKCO', // Natural Weapons (Kitsune)
    'pf1-content/SWGQSYy6SVgjeVyj', // Efreeti Magic
    'pf1-content/SX8UhZozeKaNJ7mS', // Reptilian (Kobold)
    'pf1-content/ScSKrCuWBDqz3zQe', // Languages (Being of Ib)
    'pf1-content/SfGzMso5dZ7Bg6uA', // Skilled (Goblin)
    'pf1-content/ShvaEnYXmYs0vV6h', // Desert Dwarves
    'pf1-content/SiZwOvv9Vz2OluRK', // Skilled (Aasimar)
    'pf1-content/SjQ9aL7VVjUC2uxa', // Natural Armor (Deep One Hybrid)
    'pf1-content/SlDu4fhDm9imymQ9', // Natural Magic
    'pf1-content/SnhFeGgq8qpGMVDh', // Celestial Crusader
    'pf1-content/Son5Vq5HQepEZIzC', // Hag Racial Trait (Changeling - Snow May)
    'pf1-content/SpAdy1qMBxoxTQLN', // Mostly Human (Suli)
    'pf1-content/SqRzbbqegU7NiqI0', // Magical Taskmaster
    'pf1-content/Sqo8OXSw1NiFWFKB', // Dusksight (Half-Elf)
    'pf1-content/SquudHtPDYuuxjEy', // Darkvision (Wyrwood)
    'pf1-content/Sr021S4goMyRlaoQ', // Low-Light Vision (Gathlain)
    'pf1-content/StOjhD9mqHZqSELy', // Desert Runner
    'pf1-content/SyXfxr53mzenpNu5', // Urbanite
    'pf1-content/SzpFPEuTtwLdI1jd', // Catfolk
    'pf1-content/T4PaZ33R29gTAFaT', // Stability (Dwarf)
    'pf1-content/T7dJVz4m8zpUQERB', // Mountaineer
    'pf1-content/T88sJDx0MPvvjKtb', // Nimbus of Vitality
    'pf1-content/TCis4lfk8t4e82nQ', // Darkvision (Sahuagin)
    'pf1-content/TJSvxFkclNU1GlEL', // Languages (Sylph)
    'pf1-content/TJfxEOgpWyjJcZJJ', // Spell-Like Ability (Ifrit - Sunsoul)
    'pf1-content/TMYYCMogKs454s9n', // Lifebound
    'pf1-content/TNbX1iRPplCIvhdO', // Spell-Like Ability (Tiefling - Pitborn)
    'pf1-content/TOl6oVYoCVFP8YbS', // Metal Affinity (Oread - Ironsoul)
    'pf1-content/TQFXEnSgr6JENkxU', // Languages (Cecaelia)
    'pf1-content/TQUVpXNu7bAbTEAy', // Bond to the Land
    'pf1-content/TQxW5qAgBZQbiyTH', // Healthy
    'pf1-content/TRCZ20ubvIc5MASZ', // Outsear Sahuagin
    'pf1-content/TSEP7Z6CFb3Clbjh', // Lost Promise
    'pf1-content/Tb0QQbLa6WuRfUzG', // Aquatic Mastery
    'pf1-content/TbnWNAk91q2wgqCP', // Angel-Blooded (Angelkin)
    'pf1-content/TeyAhqhhsw6pQAUV', // Voiceless
    'pf1-content/ThceEvBPQBpGFGS0', // Mordant Envoy
    'pf1-content/TkLZDtMlHbg0Ljlt', // Prehensile Tail (Tiefling)
    'pf1-content/To9CTavwqfCUqpuZ', // Ash-Born (Hearth May)
    'pf1-content/TqBOLc2wmCF0ikFl', // Trailblazer
    'pf1-content/TqLGCRRZcEjDtZvM', // Cheek Pouches
    'pf1-content/TwqzAm7tIeUpqdPI', // Risky Troublemaker
    'pf1-content/U0rMPYJhgW4Fg6WL', // Bandy-Legged
    'pf1-content/U1WKFunClHJkc7vF', // Swordtrained
  ],
  'racial-traits-396': [
    'pf1-content/U8dkiXDmSDOETLxv', // Azata-Blooded (Musetouched)
    'pf1-content/UBaGcNVcXL59Bfoq', // Cat's Luck
    'pf1-content/UMT2CcRjz9uXlsvb', // Kyton-Spawn (Shackleborn)
    'pf1-content/URpcaP1vfemHJyal', // Pyromaniac
    'pf1-content/UYSb1Adt09Nn6xut', // Slow Speed (Oread)
    'pf1-content/UawXK40Ix4vmfMkY', // Intimidating
    'pf1-content/UbqcWIBRROTWK8l0', // Pride
    'pf1-content/Ucd87mayBCsB4mpW', // Poison Minion (Half-Orc)
    'pf1-content/Ud0HV2vZPaqEryKB', // Hag Racial Trait (Changeling - Slag May)
    'pf1-content/Uu1wTwtXGLuFWugv', // Energy Strike (Cold)
    'pf1-content/UvWpHqJHIyUkValD', // Paraheen Dwarves
    'pf1-content/UzMmqEyE5E3VDox0', // Woodcraft
    'pf1-content/V0x3N3HwwNLa2KSm', // Slow Speed (Locathah)
    'pf1-content/V1sxwRKkE3x6qoMX', // Spell-Like Ability (Ifrit - Lavasoul)
    'pf1-content/V20dpuTbpcjyZ61Z', // Alert for Betrayal
    'pf1-content/V4zztgoZn2hLGEld', // Alternate Skill Modifiers (Skinwalker - Aerieborn)
    'pf1-content/V5V8tGIQ5JWnd9mq', // Skilled (Aasimar - Idyllkin)
    'pf1-content/V7nc5iy8a624CWna', // Languages (Catfolk)
    'pf1-content/VEGU8AW6YZR5TyFR', // Darkvision (Ratfolk)
    'pf1-content/VHmuEYXmx81Q5EmC', // +2 to One Ability Score (Half-Orc)
    'pf1-content/VIBm0jH0Xerz1xxp', // Day Raider
    'pf1-content/VIu4idSpcjqKbD1s', // Surface Sprinter
    'pf1-content/VKKENsPZuC210Ock', // Alternate Spell-Like Ability (Skinwalker - Witchwolf)
    'pf1-content/VKPGN4SPNATBrToA', // Darkvision (Tiefling)
    'pf1-content/VKSewOw07cYNG8qy', // Darkvision (Wyvaran)
    'pf1-content/VLpXXZb8shozC2Hu', // Speak with Sharks (Sahuagin)
    'pf1-content/VM3b9p3WKEHB45ne', // Light Blindness (Sahuagin)
    'pf1-content/VMdfkHxhfKgt1aOq', // Fire Insight
    'pf1-content/VQJKPH7YtgzXQj4J', // Inured
    'pf1-content/VRVtIxsv59vhHm5y', // Hag Racial Trait (Changeling - Frostlaced Flesh)
    'pf1-content/VavtvA1snnAQD7lX', // Dragon Slayer
    'pf1-content/VdfQ0vUsErAKGQob', // Powerful Bite
    'pf1-content/VeT8BWM5gpiTLijD', // Self-Made Fate
    'pf1-content/VfIksZzCRMtktSu6', // Darkvision (Aasimar)
    'pf1-content/Vg06NWO6pnA0wAut', // Languages (Adaro)
    'pf1-content/VmHT9b6yPqZD8typ', // Evader (Gloomkin)
    'pf1-content/VqKrfxVGYTHWF2ZK', // Languages (Oread)
    'pf1-content/VySd3q4uEVwTS4i2', // Adoptive Parentage (Weapon Familiarity)
    'pf1-content/W0HmuUGc9ihN3Sfp', // Shadowplay
    'pf1-content/W199gG02chF53jD4', // Mute-Born (Sorrow May)
    'pf1-content/W1eARNOkwX3dAEns', // Throwback
    'pf1-content/W84vzbaWfDxNW2hr', // Bleachlings
    'pf1-content/W8kHLAzmTHKAUWWU', // Special Qualities
    'pf1-content/W9nFsXa8qFiY5VXd', // Burrow (Trox)
    'pf1-content/WCxIMzfaq7mV3b2o', // Inspiration
    'pf1-content/WDeyEgmjJDg4h1TC', // Practicality
    'pf1-content/WE57FyExdDq2mjnV', // Sunsoul (Solar Ifrit)
    'pf1-content/WF6xe4rsv4mnhPIz', // Tree Dialect
    'pf1-content/WJO1PMH4T8qWg9wK', // Experimental Body: Fey-Touched
    'pf1-content/WLj6hpVMQwt2vRRP', // Deep Magic
    'pf1-content/WOF6A7695wxFO2ie', // Keen Senses (Elf)
    'pf1-content/WSIKTn6GrP0LMTHn', // Low-Light Vision (Suli)
    'pf1-content/WTmVd9Sq3RNMG60F', // Vivacious
    'pf1-content/Wbsmn2PqBb1r519r', // Voice in the Darkness (Half-Elf)
    'pf1-content/WdLlWlzLdW3iuwEv', // Defensive Training (Kasatha)
    'pf1-content/WeWIm2pWosb2oHQU', // Languages (Ghoran)
    'pf1-content/WfRb4ifVrYFjSJNV', // Hypnotic
    'pf1-content/WfhMYITrAYcmBj7a', // Aphorite Resistances
    'pf1-content/Wi9RMrZnkVkKMKNF', // First World Gnomes
    'pf1-content/WiWFGkrXvw6qHwTc', // Languages (Duergar)
    'pf1-content/WjDK7bfCeawKboHW', // Undead Resistance
    'pf1-content/WqujuS6n7hjE1jKW', // Monstrous Humanoid (Adaro)
    'pf1-content/WvOUUxWA9WOyYUGc', // Stone in the Blood
    'pf1-content/WyTkLcKys4Jy29Q2', // Jungle Affinity
    'pf1-content/X33mXkgyuZ1XxCUY', // Languages (Monkey Goblin)
    'pf1-content/X3R13oOAjWS0XJys', // Spell-Like Abilities (Drow Noble)
    'pf1-content/X3ixmmB9S07XqKNX', // Low-Light Vision (Elf)
    'pf1-content/X3vM1Jyty2T7MMTq', // Tough
    'pf1-content/X7Zw9GPsNULV907F', // Prehensile Tail (Vanara)
    'pf1-content/XD4XuIeMdE9bWevW', // Wayfarer
    'pf1-content/XKf2zezBFglZk9zk', // Poison Minion (Gnome)
    'pf1-content/XNPNBWO2uRTlFiRM', // Low-Light Vision (Merfolk)
    'pf1-content/XOISvyFa8ZziUEak', // Psychic Defense
    'pf1-content/XORCuKscv4fKV1EH', // Normal Speed (Vanara)
    'pf1-content/XPYjs1zYjY2E02gz', // Spell-Like Abilities (Drow)
    'pf1-content/XQySDLBHVVeaaRzo', // Resistant
    'pf1-content/XSk0ArPbEAnqz9Fm', // Darklands Half-Orcs (Gloomkin)
  ],
  'racial-traits-397': [
    'pf1-content/XVm7uHb6cw0AiUOh', // Voice in the Darkness (Dwarf)
    'pf1-content/XVo4DApULZaETYcz', // Keen Senses (Halfling)
    'pf1-content/XWa9YUpaCR5IIqUp', // Keeper of Secrets
    'pf1-content/XXB7Lnp9pMBlS5Or', // Mountain-Born
    'pf1-content/XZ3s0IdjhSq3q7ty', // Duergar Immunities
    'pf1-content/XdFu6LxD4n4AqxwW', // Low-Light Vision (Triaxian)
    'pf1-content/XhtOzYgJSTJCxIU9', // Emotionless
    'pf1-content/XimaceQ6IAlJuIDD', // Skilled (Aasimar - Musetouched)
    'pf1-content/XixpDZG7W0XELNni', // Shadow Magic (Wayang)
    'pf1-content/XlXhCGpR8I2KUNA5', // Aberration
    'pf1-content/XpZ3k2gmqEF6xnuE', // Abandoned
    'pf1-content/Xq02Qwpj4FBfGGJn', // Surfacer Antagonist
    'pf1-content/Xx0q0xnySBBY3OUr', // Giant Hunter
    'pf1-content/Y1iG4W1jyaklHBvd', // Shadow Magic (Fetchling)
    'pf1-content/YAHItKOPu2o8Mrsd', // Spiritual Support
    'pf1-content/YGtcHB3bvToAoHdx', // Languages (Astomoi)
    'pf1-content/YHwpeek5IHtcZNDF', // Illusion Resistance
    'pf1-content/YIkZ9egduASu6nLh', // Savage Elf
    'pf1-content/YKpeR15lHx8u2iZc', // Fire Affinity
    'pf1-content/YLr7f3djG85wvbAT', // Kitsune Magic
    'pf1-content/YMocjN3SlwHoQgW1', // Languages (Halfling)
    'pf1-content/YQqgLh49YxGpID1c', // Keen Kitsune
    'pf1-content/YSxpFFK2fBXMUzvg', // Overwhelming Magic
    'pf1-content/YVLqOvoVgCUaKNZc', // Bonus Feat (Triaxian)
    'pf1-content/YXENRUGtna36lnM6', // Ferocity (Green Martian)
    'pf1-content/YZ1WIRlAYAAfvbBR', // Creepy Doll
    'pf1-content/Yf2qON3uChdJ12SK', // Shadow Sorcery
    'pf1-content/Yfywu8kU3UraGzlN', // Drow Immunities
    'pf1-content/Yjq7MRAd5xn6GdPo', // Blended View (Gnome)
    'pf1-content/YlKYsD3BivO85L7h', // Fey Thoughts (Gnome)
    'pf1-content/Ym8MKzritdKsuKGX', // Mountain Dwarf
    'pf1-content/Yo8LrR6TY4Hq0T6A', // Arcane Focus
    'pf1-content/YoZiTsd9x0KSCOi7', // Repairing Nanites
    'pf1-content/YrJvLipI70b73JIP', // Hag Racial Trait (Changeling - Moon May)
    'pf1-content/YsUd35wRZBO17r05', // Ekujae Half-Elves (Wildborn)
    'pf1-content/Yw9TH7PWecvfDLfo', // Senses (Svirfneblin)
    'pf1-content/Z1Ocephff1ZmBels', // Type
    'pf1-content/Z4bfgptrjWdN7Ugb', // Neglected Heritage
    'pf1-content/Z7uj8OS11fVPBEnf', // Slow Speed (Grindylow)
    'pf1-content/ZDYzHXisxHABCWza', // Stoic Defender
    'pf1-content/ZEVsEIPpOyHmpmEe', // Spell-Like Ability (Skinwalker)
    'pf1-content/ZFVNOsJgL22XRdCf', // Keen Senses (Triaxian)
    'pf1-content/ZJVdNI7JLIsgnQYz', // Lashunta Magic
    'pf1-content/ZLFxIufcHBwiIZrl', // Werebear-Kin (Coldborn)
    'pf1-content/ZLN55d8hUbX0lqfm', // Tree-Born
    'pf1-content/ZP4KHOyP79pyrBpj', // Warded Skin (Rainkin)
    'pf1-content/ZR7KbJlVZV68puBM', // Mental Potency
    'pf1-content/ZTMNDc8mw9C76y6N', // Spell-Like Ability (Sylph - Stormsoul)
    'pf1-content/ZUlAuMYGeCq9IacX', // Slag Child
    'pf1-content/ZW41vB78wXvRWWfs', // Variant Aasimar Abilities
    'pf1-content/ZaTEe0kZxKJuYYjT', // Languages (Gnome)
    'pf1-content/ZbgLHBTJ3bRT1EOL', // Low-Light Vision (Human)
    'pf1-content/ZgLH2eQ5rU5fIacW', // Multidisciplined
    'pf1-content/ZhYhsUrSYFcjmhFP', // World Walker
    'pf1-content/ZnBQOspblXzYNloj', // Barrow Warden
    'pf1-content/Zty4nj3QFPOC0hYX', // Breath Weapon (Dwarf)
    'pf1-content/a1AfZ5mrHLJQp6gs', // Dragon
    'pf1-content/a1otKF9eFw6gSfvB', // Gemsoul (Crystal Oread)
    'pf1-content/a6QMB7qmZaaw9Gqs', // Fey-Quickened
    'pf1-content/a7nraRpo1VzmXYAj', // Prehensile Tail (Monkey Goblin)
    'pf1-content/a95VioTuysgFg9EZ', // Adaptable Luck
    'pf1-content/aCf51qt2IfxdhWix', // Shadow Agent
    'pf1-content/aD19XOFMcxvFTIYY', // Granite Skin
    'pf1-content/aHQ7gYW240ZT65u9', // Languages (Sahuagin)
    'pf1-content/aJGZNcrbFJhbzUaz', // Light Dependent
    'pf1-content/aLTD5kME13aY9UWk', // Scion of Shadows
    'pf1-content/aMGMC5XWT62jCouw', // Inspire Imitation
    'pf1-content/aMyZawGDkcx9ueCa', // Nimble (Strix)
    'pf1-content/aR6GbtT8EtOqN1XR', // Snowcaster Elves
    'pf1-content/aVWHlRt22VE801jt', // Darkvision (Yaddithian)
    'pf1-content/aZ0NT0LR405tLHHB', // Occult Scion
    'pf1-content/adLgjvqxTWpAWxFJ', // Plant
    'pf1-content/afX2SurqCJrV7f4B', // Solar Affinity (Ifrit - Sunsoul)
    'pf1-content/agV4JlEfsL4HLNZo', // Truespeaker
    'pf1-content/agovSwSID6zOPIDN', // Sense Thoughts
    'pf1-content/aqfQQbZuntXaiXS0', // Heavenborn
    'pf1-content/auhlm92jQNA1fE1k', // Sky Citadel Dwarves
    'pf1-content/axfKJGcBpA7GCcAC', // Dusksight (Elf)
    'pf1-content/b4nkYIUM9HzTUL76', // Whispers from Shadow
    'pf1-content/b6I8HENTNj6Gyyg1', // Spell-Like Ability (Aasimar - Emberkin)
    'pf1-content/b7b9LL5pcA63eOv1', // Spell-Like Ability (Oread)
    'pf1-content/b8mD388daeaoKidm', // Natural Bounty
  ],
  'racial-traits-398': [
    'pf1-content/bb16lRiGSh8MGZu2', // Draconic Heritage
    'pf1-content/bCC7aq3JM7gjMcCA', // Illustrious Urbanite
    'pf1-content/bcJGI384LPRwuj2a', // Eternal Smith
    'pf1-content/bg2D5FkiZk5q8Zi6', // Darkvision (Aphorite)
    'pf1-content/bGb3Y5JukIgU1Kdt', // Ink Cloud
    'pf1-content/biy9S2be3p758hMW', // Spell-Like Ability (Aasimar - Plumekith)
    'pf1-content/bnsF4bxf7kQBIIyM', // Agile (Kitsune)
    'pf1-content/bPFXgUQ13FgngRh5', // Clever Cat
    'pf1-content/bPkht5w4AKauP8Ip', // Animal-Minded
    'pf1-content/bPXRe93Nx2bL4PL7', // Smog Sight
    'pf1-content/bQz5WGBgK1x813HO', // Alternate Spell-Like Ability (Skinwalker - Scaleheart)
    'pf1-content/bRO90tmeaH1tFi2g', // Elven Magic (Elf)
    'pf1-content/bsDeGqpk9ZF84qoS', // Vestigal Wings
    'pf1-content/btAWWOZmbI05bcPK', // Unexpected Ally
    'pf1-content/bTQhfYlU0IgTdMMX', // Shadow Blending
    'pf1-content/bTtU2YtIbpt4TyD1', // Alternate Skill Modifiers (Dhampir - Svetocher)
    'pf1-content/bUnlzKQfFNF97MqX', // Mystic
    'pf1-content/bv8MLtZM6d93MjzM', // Languages (Trox)
    'pf1-content/bVANrX9uIcmvZN1c', // Honey Whisperer
    'pf1-content/bVVtVOY7So7gOXv8', // Telepathy
    'pf1-content/bWTblS61a4GQlsgx', // War-Leader
    'pf1-content/c1wfLAxHIjIc1tQG', // Aquatic (Aquatic Elf)
    'pf1-content/c6qcpCl83hFN26vn', // Superior Shapeshifter
    'pf1-content/calSa82WwxgUFwXr', // Werewolf-Kin (Witchwolf)
    'pf1-content/cblSp9CRry0z790A', // Human Shadow
    'pf1-content/cBTigYnTlwamuHfa', // Languages (Goblin)
    'pf1-content/cEh0t6PAmegJIQCU', // Energy Strike (Electricity)
    'pf1-content/cFglH9W82vHtpzMu', // Sovyrian-Born
    'pf1-content/cFr4ZtTY4M2iTTWa', // Nocturnal (Strix)
    'pf1-content/cHfF0MzvRePtnPBS', // Dwarf
    'pf1-content/chkZrH30moyKCPNU', // Languages (Hobgoblin)
    'pf1-content/cIGRUby3T6UOP0an', // Maelstrom Resistance
    'pf1-content/cL7K05jKkXxOmOt5', // Retreat Magic
    'pf1-content/cML095CltG7ZpUSM', // Skilled (Tiefling - Shackleborn)
    'pf1-content/cnMT4bfxktgJnrm1', // Blood Courage
    'pf1-content/co5OzRBqAzXGbgii', // Ability Scores (Vine Leshy)
    'pf1-content/cOod8wThcNc0expZ', // Weapon Familiarity (Halfling)
    'pf1-content/cRbTJE910TfKzJAt', // Pariah
    'pf1-content/crZ8xD4Vlvu0pk4U', // Ageless Patience
    'pf1-content/cSe1S79oR6gJI9bF', // Defensive Abilities
    'pf1-content/cUYl6WPG3gIKBkIe', // Wyrmcrowned
    'pf1-content/cxbs6wjdHVmjndXR', // Attentive
    'pf1-content/czaE6LoPE63urloL', // Seed
    'pf1-content/d0h0dzcrBnA3b3Ts', // Disgusting
    'pf1-content/d18rPNYXrSLzCr3v', // Slow Speed (Vine Leshy)
    'pf1-content/d5kvhHSZv8jIHqXe', // Natural Weapon (Kuru)
    'pf1-content/d6YoCC2UVK8jUmf8', // Pit Boss
    'pf1-content/dagWgGQYv20usVZW', // Spell-Like Ability (Tiefling - Grimspawn)
    'pf1-content/dEtxdn5mLY5M3i45', // Alternate Spell-Like Ability (Dhampir - Ru-Shi)
    'pf1-content/deYG2mmqNjWZ4rR5', // Umbral Escort
    'pf1-content/dFhNrCde0uxjohHy', // Darkvision (Changeling)
    'pf1-content/dfqSRTRN0zf2BRS0', // Oread Gem Magic
    'pf1-content/dhSAd9l3M8b0SGAP', // Blunt Head
    'pf1-content/dIpPYpwxxkHXRAmv', // Desert Runner
    'pf1-content/diZs3RkrvBKSq8sk', // Heart of the Sea
    'pf1-content/dk1o8LLPRw7etojM', // Native Outsider (Aasimar)
    'pf1-content/dlBhceRWyWTbpBN8', // Fire in the Blood
    'pf1-content/dMbfvLa1o308rPFe', // Stable Tentacles
    'pf1-content/dMLf5DVvmyw2MLmm', // Fey Magic (Elf)
    'pf1-content/dQpQkqUUdP5QbbYn', // Avenging
    'pf1-content/dtbQtYC7PMjK4Zs5', // Cliffside Charger (Cragkin)
    'pf1-content/dVlYSwjbyeBDBnG2', // Resist Level Drain (Shabti)
    'pf1-content/dWFPhuI7Vt2QDf0C', // One of the Multitude
    'pf1-content/dX7u0gwFMcTexeSJ', // Alternate Weakness (Dhampir - Ajibachana)
    'pf1-content/dXEb2y6woAp0MpCO', // Crystalline Dust
    'pf1-content/dzrY5AIr5JyfIhPU', // Goblinoid (Goblin)
    'pf1-content/e0CYM9n4bzMQSSt8', // Languages (Ratfolk)
    'pf1-content/e14A3nZwy20ElCS9', // Blended View (Elf)
    'pf1-content/e6cqGeDS6lFEFfzJ', // Ferrous Growth
    'pf1-content/e6oHfv1pVnQf20f5', // Languages (Yaddithian)
    'pf1-content/e8okungPKsrvj6VC', // Treasure Sense
    'pf1-content/eEo4SD2HVKDVOPpz', // Alternate Skill Modifiers (Dhampir - Ajibachana)
    'pf1-content/eI3UbG7beFWfikl0', // Spell-Like Ability (Aphorite)
    'pf1-content/eIbeWPnBDu7zLYjF', // Spell-Like Ability (Aasimar - Lawbringers)
    'pf1-content/eIkJlRpLALMQNc4J', // Cosmopolitan
    'pf1-content/eJIBuryG68v4PJLk', // Light Sensitivity (Dhampir)
    'pf1-content/eKKCUEHE5IvE6x9L', // Poison Minion (Drow)
  ],
  'racial-traits-399': [
    'pf1-content/eLnDyBKNO6J5VbOI', // Hag Racial Trait (Changeling - Sorrow May)
    'pf1-content/eNIYJNbM6UL7OdyE', // Languages (Human)
    'pf1-content/eNSivYdOXqQpPe52', // Spell-Like Ability (Tiefling - Spitespawn)
    'pf1-content/eNeKXqhZNnBDrGxb', // Slow Speed (Monkey Goblin)
    'pf1-content/eXhsF4CcvaCrLqLj', // Natural Hunter
    'pf1-content/eYZTYsiT5ssa2jrK', // Junk Tinker
    'pf1-content/eZ0c2h7CXvrIHclo', // Fiendish Sprinter
    'pf1-content/eew9hWENxwAiLP8S', // Stubborn
    'pf1-content/efCmFm0xhnvVzxQz', // Languages (Wayang)
    'pf1-content/em8BoW2q3oUV9CHk', // Detect Thoughts
    'pf1-content/emWoMvZJYkXOz6ot', // Light Sensitivity (Orc)
    'pf1-content/emgcgmgSjpuv1GHa', // Demon-Spawn (Pitborn)
    'pf1-content/eomWW6BaxOUSLd6M', // Powerful Presence
    'pf1-content/eqdCFnuUmo68fMPd', // Shadowhunter (Gnome)
    'pf1-content/erHe11Qn4judzeI1', // Mostly Human (Undine)
    'pf1-content/eselzEcuEzC858lz', // Nocturnal (Syrinx)
    'pf1-content/euX1ucchOBHkK62k', // Titled
    'pf1-content/ewhFVskXwNn3uVnI', // Toxic
    'pf1-content/f14x9PM3WRGXOJrF', // Constructed
    'pf1-content/f2KIBwlRL87kTqh5', // Enchantment Resistance
    'pf1-content/f6rFJHkiEHN54rA8', // Architectural Ingenuity
    'pf1-content/f91ILsrKfkpL9uUG', // Moroi-Born (Svetocher)
    'pf1-content/f9g94BzVWjntaNQg', // Warden of Nature
    'pf1-content/fIZiHRwjPPqelrGs', // Terrain Chameleon
    'pf1-content/fJekoMzjSbktf0X4', // Acute Darkvision
    'pf1-content/fLfQPOGCnNhp6Q5A', // Spell-Like Ability (Tiefling - Foulspawn)
    'pf1-content/fRLqG0NKrKPmpHUr', // Dimdweller (Dwarf)
    'pf1-content/fUAqkTyumLnQrGch', // Poison Use (Drow)
    'pf1-content/fVRCBv9JtvU8M6x2', // Expanded Oddities
    'pf1-content/fZAb027L9Kbww3js', // Shadowhunter (Human)
    'pf1-content/fbORYANXcG7HfMbQ', // Unassuming Foliage
    'pf1-content/fc7iZPElgVhpy8L5', // Languages (Nagaji)
    'pf1-content/fiOhIvq1Gb79iJPJ', // Languages (Triaxian)
    'pf1-content/fngyJ7hLuNGW6Sde', // +2 to Strength, Dexterity, or Constitution
    'pf1-content/fpNtaVGE6wGeLGyH', // Languages (Reptoid)
    'pf1-content/fscyXaZvorGwGprq', // Mist Affinity (Undine - Mistsoul)
    'pf1-content/fw9JHTLPAg54MLfp', // Strong Limbs
    'pf1-content/fx2Ntw6KnYVn11Y5', // Hatred (Strix)
    'pf1-content/fyRBxVBVyy1gQgfV', // Swarming
    'pf1-content/fzbXyGr9NouJx3Qx', // Verdant Burst
    'pf1-content/g2iIRBrSeUhIkDvu', // Pass for Human
    'pf1-content/g6M0a4JgcPgjdjJT', // Fey Resilience
    'pf1-content/g968gtWvnVkLGBgC', // Weapon Familiarity (Half-Elf)
    'pf1-content/g9H3WgBwfJUfaU4m', // Heart of the Snows
    'pf1-content/gDO7etqF3QCXKyWZ', // Spell-Like Ability (Tiefling - Hungerseed)
    'pf1-content/gEJBYigk4fJKGkyM', // Sneaky (Grindylow)
    'pf1-content/gG1JcCZ4lN9hbCqJ', // Skilled (Aasimar - Lawbringers)
    'pf1-content/gGkyhubX0tZ3GwR7', // Hag Racial Trait (Changeling - Into the Wind)
    'pf1-content/gJJpUgd5CtLjLoAV', // City Scavenger
    'pf1-content/gKeid1JVhnRJtzWB', // Jungle Half-Orcs (Rainkin)
    'pf1-content/gNnNJoQSb0I7JKbt', // Ability Modifiers (Changeling - Slag May)
    'pf1-content/gW9EZhxSnPytPicG', // Defensive Training (Drow)
    'pf1-content/gWFEMCLFVStyyHr8', // Languages (Vine Leshy)
    'pf1-content/gY6SZbdAcTrR3Caq', // Wanderer
    'pf1-content/gaF64cLXf9NDJgNi', // Nosophobia
    'pf1-content/gaZHEiMtyEO1MLC8', // Darkvision (Being of Ib)
    'pf1-content/gc6Sxv7hJp2KpVrr', // Languages (Drow)
    'pf1-content/gh1taO4CBM237eMu', // Scales
    'pf1-content/gilTw1Wm9B200MH0', // Normal Speed (Hobgoblin)
    'pf1-content/gpZx2FQSEHME0jzh', // Sprinter (Catfolk)
    'pf1-content/gpu9xXTwvbJOLA61', // Goblinoid (Hobgoblin)
    'pf1-content/gt3Mx0lNuCQxOMdo', // Deep Gillman
    'pf1-content/gt6rBTzdG0Cub2lr', // Dimdweller (Elf)
    'pf1-content/gwRHgXExczYgcJOA', // Skilled (Svirfneblin)
    'pf1-content/gxI2toeA7yXzTIxV', // Fey Magic (Dwarf)
    'pf1-content/gxxWYxmCBUIWCPqU', // Vestigial Wings
    'pf1-content/gyvG87iDUG02oQmR', // Dread Gnomes
    'pf1-content/h1qCMaAFkj6JDjtM', // Deathless Spirit
    'pf1-content/h1rqC3aTXHfUTOQl', // Gutter Rat
    'pf1-content/hAY8Dqng9SA6sRpC', // Subtle Manipulator
    'pf1-content/hFdanJW6aJ2iUnhB', // Languages (Kuru)
  ],
  'racial-traits-400': [
    'pf1-content/hH5x4vPsUUKeymVc', // Inquisitive
    'pf1-content/hHiUojDYrzRoCwR3', // Multi-Armed (Kasatha)
    'pf1-content/hJ17KnzPNXh1xWm2', // Intense Curiosity
    'pf1-content/hP6ZbMYnXdVA42E8', // Natural Weapons
    'pf1-content/hTQmrexaurb1Vu4A', // Wild Forest Kobold
    'pf1-content/hV2bbHMgni1OCXAg', // Spell-Like Ability (Undine)
    'pf1-content/hV6fDydXis2GUFj5', // Poison Minion (Dwarf)
    'pf1-content/hYaZXrQBzKotSxMa', // Ganzi Oddity
    'pf1-content/hb38MOrQMrpPM9td', // Low-Light Vision (Strix)
    'pf1-content/hcKbGDPqcGPbsBty', // Languages (Tengu)
    'pf1-content/hcagqE7fLh67ZCKZ', // Gift of Tongues
    'pf1-content/hoHML8zQt0Qib7lN', // Slow Speed (Merfolk)
    'pf1-content/hpHlEjDVM9x8Fuim', // Rock Climber
    'pf1-content/hsso3bR3LTyek5hG', // Deep Delver
    'pf1-content/htWm9bSBUYHvx4SY', // Voice in the Darkness (Half-Orc)
    'pf1-content/huJk8pF1KRKfeWzL', // Saltbeard
    'pf1-content/hvgsnryqs9MglaYI', // Flighty
    'pf1-content/hxoLQ9KV97O3emnL', // Fleet-Footed
    'pf1-content/hyluAyDdUizmqorj', // Shattered Soul
    'pf1-content/i13oyCR6gkLrhRSg', // Healthy
    'pf1-content/i3JDTzYghUAVE4a2', // Envoy
    'pf1-content/iB5aNUyJPWjxx3tx', // Languages (Half-Orc)
    'pf1-content/iBCPIWFExt679Zhh', // Defensive Training (Dwarf)
    'pf1-content/iCIuOvoanh1wZRcl', // Fey Thoughts (Half-Orc)
    'pf1-content/iEAy4KMqEtQnvLHZ', // Heroic
    'pf1-content/iES8aXKMApVmwZad', // Crystal Affinity (Oread - Gemsoul)
    'pf1-content/iGw64UpXvwydi1MU', // Explorer
    'pf1-content/iHI1zDebmLg28ZWW', // Master Tinker
    'pf1-content/iMdXJ73UwSIDDJdk', // Skilled (Tiefling - the Motherless)
    'pf1-content/iPSjQFQo6BRxvAf8', // Cat's Claws
    'pf1-content/iSHRZjOWa5TnYKXe', // Underfoot
    'pf1-content/iWZjiKTQnGS5XnB0', // Qlippoth-Spawn (the Motherless)
    'pf1-content/iWgQndIpAyjXO7pM', // Powerful Smell
    'pf1-content/iejEnNBqCFQ097Eh', // Spell Smasher
    'pf1-content/ikQ2BoHJlx4zYGvB', // Low-Light Vision (Gnome)
    'pf1-content/itT8LM4GOcBNUyoO', // Amphibious (Aquatic Elf)
    'pf1-content/iuOrMqm53EkJ4AOt', // Skilled (Duskwalker)
    'pf1-content/iulHWSMNp9TABDDU', // Spell-Like Abilities (Fetchling - Shadow Walk)
    'pf1-content/iuq7CaxD48jDZqT4', // Alternate Skill Modifiers (Skinwalker - Seascarred)
    'pf1-content/ivJAVUkb5H0Z20U7', // Energy Resistance (Ifrit)
    'pf1-content/iwAOQlZrKjN1SZLQ', // Hag Racial Trait (Changeling - Waker May)
    'pf1-content/iy6e5v8YWE9upybn', // Writhing Eye
    'pf1-content/izCRmMUEyikdfpiq', // Devil-Spawn (Hellspawn)
    'pf1-content/izn5zeobE6jDrIJm', // Languages (Primitive Human)
    'pf1-content/j4ecIXaeic0jtQYV', // Native Outsider (Fetchling)
    'pf1-content/j5XYOnvRkSTqKa7N', // Stonecunning (Svirfneblin)
    'pf1-content/jAQXQDgwCX0eKxZ2', // Lavasoul (Magma Ifrit)
    'pf1-content/jSa9JxGJVC80WWZE', // Beast Bond
    'pf1-content/jTl1H5er8dV64VIV', // Natural Climber (Monkey Goblin)
    'pf1-content/jXo1JOAbSAm1iC5M', // Storm-Born (Virga May)
    'pf1-content/jZdTNIQsmvstAb3Z', // Incorruptible
    'pf1-content/jdBudIogNAOvFZ7v', // Languages (Fetchling)
    'pf1-content/jh4scMUHyvCGmKas', // Deep Sea Dweller
    'pf1-content/jjAMygLe3WIGpHux', // Swim Speed (Adaro)
    'pf1-content/jr8N7NEkdkaKPfX4', // Cleanliness
    'pf1-content/jsIag110h3yFKi0q', // Mountaineer
    'pf1-content/jy1bBBwNolQTthr2', // Spell Resistance (Svirfneblin)
    'pf1-content/jyXw1Kew5Nmh4TyG', // Earth Insight
    'pf1-content/k3BZrtmbJvxCHeHt', // Sky Sentinel
    'pf1-content/k47gKmQAEGPPWXYZ', // Languages (Ifrit)
    'pf1-content/k4mksTEehz2fxN9e', // Exceptional Senses
    'pf1-content/kAiZRNeT0r1ZAyz9', // Isolated
    'pf1-content/kBrZffJ7gjRmNQUn', // Desert Stride
    'pf1-content/kCnWl2gK9Q56djWG', // Spell-Like Ability (Oread - Gemsoul)
    'pf1-content/kD8isApIfN4y1ty0', // Moonkissed
    'pf1-content/kERQ8l5cEhEQb5Zr', // Slow Speed (Ratfolk)
    'pf1-content/kLPypNzy62fMbj3d', // Stormsoul (Lightning Sylph)
    'pf1-content/kMDRTmyXkCtap8r2', // Darkvision (Syrinx)
    'pf1-content/kNLt3RoRdXIdVbDa', // Seasoned Spirit
    'pf1-content/kSLjzmV15G3J7RRM', // Poison Resistance
    'pf1-content/kTgoCIh9jQgqDxMM', // Soul Seer
    'pf1-content/kZzjvGGwu9wRBgUV', // Languages (Grippli)
    'pf1-content/kajw0iqeXtEm2sgI', // Toothy
    'pf1-content/khLVUk3rOIJkhzJg', // Gnome Subtype
    'pf1-content/knLKGEKSn337diqs', // Heir to Undying Nobility
    'pf1-content/kqGqKpckxLlm6vJE', // Long-Lived
    'pf1-content/kqSFEBk1ycJ6PG8y', // Small Quarter Ally
    'pf1-content/kraQWc5UXT8nyVER', // Shadowy Resistance
  ],
  'racial-traits-401': [
    'pf1-content/l2VaAn7tTKcac2xZ', // Urban Memories
    'pf1-content/l3nc7GFcj5yKPNlS', // Darklands Guide (Half-Elf)
    'pf1-content/l7CqdrmNxsmEsBBG', // Orc
    'pf1-content/lBS1mSrNfigoro8L', // Thinblood Resistance
    'pf1-content/lNkG5OnOXSt64aEY', // Dusksight (Half-Orc)
    'pf1-content/lTBjKajyJWEfK2nA', // Skulker
    'pf1-content/lUqi7xK2vxQvAnTX', // Child of the Sea
    'pf1-content/lcgrEdEWJvVEU4Ii', // Darkvision (Shabti)
    'pf1-content/leUhvuim6HknT0fn', // Mostly Human (Ifrit)
    'pf1-content/lea9JOFyO8bGiD0v', // Alternate Skill Modifiers (Dhampir - Ru-Shi)
    'pf1-content/lf3okrZiPzE3W4zj', // Crusading Magic
    'pf1-content/lg9gbMhma1yFcUxR', // Languages (Vishkanya)
    'pf1-content/lhDGN1bu2IsaabX4', // Normal Speed (Gathlain)
    'pf1-content/lhZkqVMbX0RfVTj0', // Jungle Stalker
    'pf1-content/ljJ0jMjxTVcfOiJ3', // Tangling Tentacles
    'pf1-content/lk84xweDXJrZvoq4', // Curosity
    'pf1-content/lmjkMFGLqqAjHE0g', // Squalid
    'pf1-content/lnahx05blmymRHUA', // Stalker
    'pf1-content/lqFhyqE7frSbHfEA', // Magical Linguist (Gnome)
    'pf1-content/lrZtYK3baHZY6JnK', // Skilled (Tiefling - Hellspawn)
    'pf1-content/lvV61h2tNXC2KqQF', // Skill Training
    'pf1-content/lwZTXQ8zz2awYQh9', // Pain Tolerance
    'pf1-content/m3HLD2cA05cDMdNf', // Frightened by Magic
    'pf1-content/m6anXBE7DQrCaNPS', // Change Shape (Skinwalker - Ragebred)
    'pf1-content/mBfn8hCLwEsAxlnl', // Werebat-Kin (Bloodmarked)
    'pf1-content/mCQvy9sQgS937eTg', // Languages (Skinwalker)
    'pf1-content/mDDre98oyYIFLJy5', // Alternate Skill Modifiers (Skinwalker - Bloodmarked)
    'pf1-content/mEpFXnHR6usjAvNK', // Low-Light Vision (Locathah)
    'pf1-content/mH8xEPH9wXFCmIgM', // Beastmaster
    'pf1-content/mIoJHEWhujpANeaM', // Luckbringer
    'pf1-content/mLxAldGcZ0UnEfd7', // Change Shape (Skinwalker)
    'pf1-content/mNPzfPRAdgvumhww', // Wererat-Kin (Nightskulk)
    'pf1-content/mNlVIIoVtpgvuqT8', // Shamanic Enhancement
    'pf1-content/mPD0yR9P3IGAC6nJ', // Weapon Familiarity (Gnome)
    'pf1-content/mQB3T4teSUz4sMGf', // Air Insight
    'pf1-content/mXtf2wP2c6ZHGIsL', // Monstrous Humanoid (Cecaelia)
    'pf1-content/mYFFsgYWIM1U53xJ', // Princely
    'pf1-content/mZlhtYzG64k6EMHp', // Jumper
    'pf1-content/meOrv0z16wHP4nEE', // Shadowplay (Half-Orc)
    'pf1-content/mwZTMvi4yCHeh5FC', // Weapon Familiarity (Vishkanya)
    'pf1-content/myff7Z3hssdT7leV', // Blank Slate
    'pf1-content/n2lCTokOhbEJ35Nu', // Oppressive
    'pf1-content/n4wxE73ZItt77fLt', // Darkvision (Orc)
    'pf1-content/n8T5HDk4GBP7dsjx', // Darklands Stalker
    'pf1-content/n98kLjKTeMEM5rdx', // Spell-Like Ability (Tiefling - the Motherless)
    'pf1-content/nBNMonZzsoPLtAKL', // Change Shape (Kitsune)
    'pf1-content/nHtjEPEMGTSLs6AG', // Skilled (Aphorite)
    'pf1-content/nIONejbfENvh4nQC', // Planar Envoy
    'pf1-content/nIhtofd7nMqG4cKF', // Hag Racial Trait (Changeling - Dead Eyes)
    'pf1-content/nJm4z2g5Xxv3TprR', // Unflinching Valor (Frostkin)
    'pf1-content/nLkZUFT3i2sZ0wkL', // Darkvision (Goblin)
    'pf1-content/nM1ZZgnbE390Enat', // Skilled (Aasimar - Plumekith)
    'pf1-content/nMk4AVoYM8UxiJqg', // Low-Light Vision (Wyrwood)
    'pf1-content/nOZ9tdmFZ4sWgXv0', // Elf-Scorned
    'pf1-content/nPKsivL973H9L7y7', // Agathion-Blooded (Idyllkin)
    'pf1-content/nPnz19oJfnZKSFdI', // Lava Gnomes
    'pf1-content/nQ9j793ikC9orJQA', // Languages (Orc)
    'pf1-content/nWMwiyydGWx5S05m', // Bestial
    'pf1-content/naQ5kacMK4kyrhfW', // Heart of the Wilderness
    'pf1-content/nfHng6a21r2pANDD', // Ability Modifiers (Changeling - Veil May)
    'pf1-content/nkri33C3iqcYSE7k', // Crossbow Training
    'pf1-content/nmthVcIFBg9PNqhb', // Hatred (Half-Orc)
    'pf1-content/nnyOoCfyIRKs3xcQ', // Wyrmscourged
    'pf1-content/noLFpNL6xVCMBkRp', // Heart of the Fields
    'pf1-content/nopyUgzhxcD4G8uD', // Weretiger-Kin (Fanglord)
    'pf1-content/nr88lEu9l12sMZqO', // Jumper
    'pf1-content/nsTVmSX9Xm4O1zqo', // Darkvision (Strix)
    'pf1-content/ntICYwpS9NmCaXKI', // Skilled (Tiefling - Grimspawn)
    'pf1-content/o0ooSUUjwVjL79XE', // Fecund Earth
    'pf1-content/o4Uk5x9MPYEVfz9P', // Darkvision (Oread)
    'pf1-content/o4qjsfHulsHFsLI1', // Projection
    'pf1-content/o8YypRycSCackHdm', // Plagueborn
    'pf1-content/o9IVTGXGOqHixS7z', // Brazen Flame
    'pf1-content/oB8Ff3b2HNB2eddC', // Tower Elf
    'pf1-content/oBIBlHuA3E69EEuN', // Venomkissed
  ],
  'racial-traits-402': [
    'pf1-content/rBKJCVwy3X2VjFdU', // Languages (Dwarf)
    'pf1-content/oTQL4P3IdoJQAkOB', // Elven Immunities (Half-Elf)
    'pf1-content/orOAYDkNl4pqYWA4', // +2 to One Ability Score (Half-Elf)
    'pf1-content/qoCLqjadKmJEN9R7', // Fearless (Halfling)
  ],
  'racial-traits-403': [
    'pf1-content/uAJ9hLZYdH2JX7J8', // Bonus Feat (Human)
    'pf1-content/sFlDW97gf1FHn217', // Weapon Familiarity (Half-Orc)
    'pf1-content/rzYk40R1rWSfay4a', // Elf Blood
    'pf1-content/srOpqbXesXBuvTqe', // Multitalented
    'pf1-content/sSs0BK09PLxjbkAa', // Sure-Footed
  ],
  'racial-traits-404': [
    'pf1-content/xeEmYqR3IUXoby9x', // Darkvision (Half-Orc)
    'pf1-content/wZZzaSmiF8hTuRo7', // Adaptability
    'pf1-content/xwr9DBDmvGMYHcut', // Slow Speed (Halfling)
  ],
  'racial-traits-405': [
    'pf1-content/yQvZ03xcsuM8b595', // Elven Immunities (Elf)
  ],
} as const satisfies Record<string, readonly [string, ...string[]]>;

export type RacialTraitBatch = keyof typeof racialTraitBatches;

export const racialTraitContext = [
  'pf1-content/93oIrx2wLSx0jMkM', // Blessing of Courage and Life (spellEffect)
  'pf1-content/ECyLUubv5HWmYv1U', // Eldritch Heritage (feat)
  'pf1-content/RjT3gEYZJmHsPhJI', // Holy (itemAbility)
  'pf1-content/nRHD11ZwDWlRyT8c', // Rage (Spell) (spellEffect)
  'pf1-content/oKbTIUKJkGwFDHXu', // Ferocity (Orc) (racialTrait)
  'pf1-content/oMfDPZDS57LKJpHL', // Snowcaster Half-Elves (Snowborn) (racialTrait)
  'pf1-content/oWCKjPIJnglPEuiJ', // Blood of Heroes (feat)
  'pf1-content/oqWnE9gSckkN51Wh', // Drow-Blooded (racialTrait)
  'pf1-content/ot7iCPI3vUSIND6i', // Lurker (racialTrait)
  'pf1-content/oxqTcYDzelcG5WBb', // Native Outsider (Sylph) (racialTrait)
  'pf1-content/pbItjcPIPXPP15oc', // Energy Resistance (Oread) (racialTrait)
  'pf1-content/ppDQinRAFQqmyS81', // Energy Resistance (Sylph) (racialTrait)
  'pf1-content/qQU7DJtUNw9DkO14', // Academician (racialTrait)
  'pf1-content/qVuEXf9CgkYlYK3l', // Hag Racial Trait (Changeling) (racialTrait)
  'pf1-content/qquaaM62KEX4ulIi', // Maw or Claw (racialTrait)
  'pf1-content/qwLfvwfihx1Sv2xU', // Serpent's Sense (racialTrait)
  'pf1-content/rKC9OPc6Pw1mtI3B', // Tinker (racialTrait)
  'pf1-content/rUbLCmT5F5bgTsks', // Light and Dark (racialTrait)
  'pf1-content/rd6xPFT4I6qEU1zu', // Languages (Aasimar) (racialTrait)
  'pf1-content/rmiLxAFaM1Sztn7w', // Cavewight (racialTrait)
  'pf1-content/rsU7QPNvow2sI750', // Languages (Dhampir) (racialTrait)
  'pf1-content/s07V8lcVJX3IkC6l', // Danger Detection (racialTrait)
  'pf1-content/s3cdpvXKYSHaZqEX', // Fox Shape (feat)
  'pf1-content/sOmwse1zXEEj1Wps', // Bleachling Magic (racialTrait)
  'pf1-content/sOuYeZ0ADFtn4Inc', // Winter Half-Orcs (Frostkin) (racialTrait)
  'pf1-content/sfFAqD9W9iHvSe0D', // Shadow Resistance (racialTrait)
  'pf1-content/siHk5xCzWJ6Cilke', // Darkvision (Elf) (racialTrait)
  'pf1-content/tC0JCXIRZK9tEoMm', // City-Raised (racialTrait)
  'pf1-content/tH7MbuXoGn02OE40', // Low-Light Vision (Catfolk) (racialTrait)
  'pf1-content/tOyZJ3QAQqZDdMxX', // Segadan Halflings (racialTrait)
  'pf1-content/tpgeBPfszgAyIAPy', // Elven Immunities (Aquatic Elf) (racialTrait)
  'pf1-content/u06YS9FvVU8JEH36', // Low-Light Vision (Skinwalker) (racialTrait)
  'pf1-content/uKDDzUhvDC031NAz', // Psychic Virtuoso (feat)
  'pf1-content/uOJ734EX9ZjbcI88', // Elven Magic (Aquatic Elf) (racialTrait)
  'pf1-content/uPsATrKLQzHg2cae', // Tentacle Sense (racialTrait)
  'pf1-content/uSED8jnh3FejGkiw', // Devoted Companion (racialTrait)
  'pf1-content/uZG1DnleOjnYTP0g', // Slapping Tail (Wyvaran) (racialTrait)
  'pf1-content/ugVzv2fQAGFUy6Si', // Natural Swimmer (racialTrait)
  'pf1-content/ulA1l56n9dBEn3vI', // Native Outsider (Oread) (racialTrait)
  'pf1-content/uwA8OvPokBHtm16k', // Light Sensitivity (Duergar) (racialTrait)
  'pf1-content/v6db0gftaAJKUfvK', // Arcane Training (racialTrait)
  'pf1-content/vGtt49PJQtdsOIC3', // Evasive Nomad (racialTrait)
  'pf1-content/vVFEtjoaJD7Azzil', // Sneaky (Tengu) (racialTrait)
  'pf1-content/vWzcwEyFLqVMfkrs', // Low-Light Vision (Aquatic Elf) (racialTrait)
  'pf1-content/wKrvj7ZRXdTLUyHG', // Skilled (Fetchling) (racialTrait)
  'pf1-content/wQnT357k2EwEAT49', // Mordant Spire Half-Elves (Spireborn) (racialTrait)
  'pf1-content/wUzya0Ps91Bo8xDG', // Eye for Talent (racialTrait)
  'pf1-content/waU7oallvY1411DX', // Nimble (Vanara) (racialTrait)
  'pf1-content/wjJMLojRWBvteEod', // Sahuagin Song (racialTrait)
  'pf1-content/wvUNwfSSzmWElgiM', // Nanite Surge (racialTrait)
  'pf1-content/x2zsfToayeBdnrvD', // Long-Limbed (racialTrait)
  'pf1-content/xfVICBMFK0eGdT83', // Iron Citizen (racialTrait)
  'pf1-content/xjUswZbTpNJTr2gy', // Spell-Like Abilities (Duergar - Enlarge Person) (racialTrait)
  'pf1-content/y9fELjoo3IShhDhL', // Earth Affinity (racialTrait)
  'pf1-content/yDpihlrYhH16CQtN', // Elemental Resistance (racialTrait)
  'pf1-content/yQFgtsFjg71gdHoO', // Focused Study (racialTrait)
  'pf1-content/yUhK1WYx2tDgdCvZ', // Native Outsider (Tiefling) (racialTrait)
  'pf1-content/z6SfY6xmgwI8vJTB', // Half-Drow (Darkborn) (racialTrait)
  'pf1-content/zN4wIRd7yB2Uzh5K', // Desert Half-Orcs (Sandkin) (racialTrait)
  'pf1-content/zdZOEI9cIHrsvQVx', // Crafty (racialTrait)
  'pf1-content/zh18VTq0JmGu7jP0', // Aquatic Half-Elves (Shoreborn) (racialTrait)
  'pf1-content/zk8K3esiyhPnAE5q', // Change Shape (Vine Leshy) (racialTrait)
  'pf1/05NnBuNnkMsaNoXf', // Punching Dagger (item)
  'pf1/05i5rxwim12hwktu', // Bull's Strength (spell)
  'pf1/05rD6YP5sVSrKY28', // Shortsword (item)
  'pf1/09juighnblqlqwro', // Unerring Weapon (spell)
  'pf1/0K8W2ltmbiO71iXY', // Lightning Subdomain (classFeature)
  'pf1/0bZf3SDkvVOe2ujH', // Lightning Reflexes (feat)
  'pf1/0d756xyqhinsstas', // Pyrotechnics (spell)
  'pf1/0hknfnoaljc75fj3', // Fire Seeds (spell)
  'pf1/0jwi6xovzukorxok', // Summon Nature's Ally I (spell)
  'pf1/0onqjy8gfgop1xsi', // Ventriloquism (spell)
  'pf1/11ClnanF4PdEPd9g', // Rapid Reload (feat)
  'pf1/18kryvj2dfuymk9d', // Blur (spell)
  'pf1/19JcztRuEWbrOqQW', // Hobgoblin (race)
  'pf1/1TiILWBLdzYpnPky', // Claw Blades (item)
  'pf1/1b6irvf27vdt5c1l', // Produce Flame (spell)
  'pf1/1hjxxr3k62rcpb5c', // Deathwatch (spell)
  'pf1/1mkigzpu5hohovgw', // Wind Walk (spell)
  'pf1/1vh2ewwvzvxunoxk', // Protection from Energy (spell)
  'pf1/1zmn8vqy3s5l9kiv', // Summon Monster III (spell)
  'pf1/21bxbzdaawjrnvyo', // Divine Favor (spell)
  'pf1/24zg8a05hqum3e6j', // Mending (spell)
  'pf1/272szq5d556toqgc', // Blessing of Courage and Life (spell)
  'pf1/27o3msobhyghmfid', // Minor Image (spell)
  'pf1/2aTFNMs3pW6nUBlr', // Improved Unarmed Strike (feat)
  'pf1/2mWMyKiPWk6Y8cNx', // Ghoran (race)
  'pf1/2mw29eyL5mzZgKqR', // Trident (item)
  'pf1/2nn2tshkn4p7k25l', // Entangle (spell)
  'pf1/2y9e1l6zso9tdg0a', // Reduce Person (spell)
  'pf1/2zyr6klf97jyr5ng', // Pass without Trace (spell)
  'pf1/33pe0bge7b7aq3io', // Shocking Grasp (spell)
  'pf1/361rc74674l3zt9a', // Flesh to Stone (spell)
  'pf1/3b1x69kfhnsa2d54', // Heat Metal (spell)
  'pf1/3lV30qfiQaWKB0sp', // Merfolk (race)
  'pf1/3mfmhx8avu7h3iom', // Spider Climb (spell)
  'pf1/3ntxp3zun1j9mf0m', // Hypnotism (spell)
  'pf1/3owNW4QoIZK6Pwm5', // Psychic Sensitivity (feat)
  'pf1/3qpvx0evlgk4bfda', // Sun Metal (spell)
  'pf1/42M7kFLkyccrj1uf', // Shuriken (item)
  'pf1/4KrSL8mgSPLF7f9c', // Wind Blast (classFeature)
  'pf1/4i8qiF2QnGnPOyKC', // Wyvaran (race)
  'pf1/4nFjnETINUoBFWKX', // Two-Bladed Sword (item)
  'pf1/4osvw3l6mq9unkec', // Hungry Pit (spell)
  'pf1/4qEXPDlfIj1cIvCe', // Oread (race)
  'pf1/4ya1fs9tyvsqnwqx', // Status (spell)
  'pf1/55yke7az6gco0tyn', // Spiked Pit (spell)
  'pf1/5cdmojmydhwowzy1', // Teleport, Greater (spell)
  'pf1/5eg2f7nek9cjmv0n', // Memory Lapse (spell)
  'pf1/68m9du7zw2di7ew6', // Feather Fall (spell)
  'pf1/6BKIB9hjKwSJorAZ', // Fetchling (race)
  'pf1/6ho3wsspkqkhypt0', // Tree Shape (spell)
  'pf1/6oevs2mE3QqqQEAK', // Net (item)
  'pf1/6oq1wcryviik9ice', // Fireball (spell)
  'pf1/6vfauefzzmwl4az7', // Chain Lightning (spell)
  'pf1/711B9WNFgpdDKKf2', // Improved Disarm (feat)
  'pf1/71g6nmvy8qnodwyz', // Protection from Good (spell)
  'pf1/77gXSucrxfrE9yWk', // Empower Spell (feat)
  'pf1/7bJjKqNRrvpXJ4L3', // Augment Summoning (feat)
  'pf1/7fvsn0gbv6ynlp63', // Slipstream (spell)
  'pf1/7m5us8d4a9lwh1ap', // Water Breathing (spell)
  'pf1/7mqv5v3G0yN4tsi4', // Scorpion Whip (item)
  'pf1/7x2z0i8rcx7s81fk', // Daylight (spell)
  'pf1/7yf67b7y4byj96w7', // Control Water (spell)
  'pf1/7zISE7ODvC5Myv1p', // Elemental Movement (Air) (classFeature)
  'pf1/7zJTztNW7hdaqjKc', // Skill Focus (feat)
  'pf1/8MI2BpO4ewblrCvp', // Age Resistance, Lesser (spellEffect)
  'pf1/8jq1atxonnerix55', // Polar Ray (spell)
  'pf1/8nrt26t37v7koqr8', // Misdirection (spell)
  'pf1/8snLqsJN4LLL00Nq', // Toughness (feat)
  'pf1/8u1xa5javcxc6szk', // Rage (spell)
  'pf1/8uwmrygxgih1fb57', // Animate Dead (spell)
  'pf1/8w67l6dzzsi6oz5f', // Create Pit (spell)
  'pf1/92hth51cs9oi0nfe', // Wall of Fire (spell)
  'pf1/9FBT6uqlRgaw9gug', // Changeling (race)
  'pf1/9Fe6mDt0oP52m6Jl', // Android (race)
  'pf1/9L6D7WcLuGX58Wc6', // Rivers Subdomain (classFeature)
  'pf1/9fdte3s6lnanf9rg', // Summon Nature's Ally II (spell)
  'pf1/9pbl3ktd5oqejl19', // Transformation (spell)
  'pf1/9tww9fc9049h6iqc', // Cause Fear (spell)
  'pf1/A54sLfcyoR5HGNbP', // Poison Use (classFeature)
  'pf1/ACEQfonKVqh0fwkK', // Deflect Arrows (feat)
  'pf1/An77ZbKHexO7P0UC', // Acid Resistance (classFeature)
  'pf1/AoWSbnuTSGIxmv61', // Sorcerer (class)
  'pf1/Ata6ajiY9wuAnBLB', // Shortbow (item)
  'pf1/BcY8IkVwo2hXC6ND', // Light Flail (item)
  'pf1/BgTqaNqyS3tnLGAg', // Hand Crossbow (item)
  'pf1/BkKYCzEGNTzZRiTz', // Fleet (feat)
  'pf1/CUFJ4SDh7TKSrjx0', // Blowgun (item)
  'pf1/CnjrUVKnjFlIF67g', // Elemental Movement (Water) (classFeature)
  'pf1/DQGhOq3M3uxTFKYO', // Triton (race)
  'pf1/DuAcRnjBmOADOvj2', // Added Summonings (classFeature)
  'pf1/E6bHjOMkRatMQwbR', // Aquatic Elf (race)
  'pf1/ElqchQT5WB625HPg', // Eschew Materials (feat)
  'pf1/EvrFDqZDbbFS4Avb', // Bonus Languages (CLE) (classFeature)
  'pf1/F5mCXQR9VZfKfpTH', // Sorcerer Bloodline (classFeature)
  'pf1/FHY3oIk5zSOFncJH', // Aasimar (race)
  'pf1/FUW5mIXHNBBIQ1Sq', // Power Attack (feat)
  'pf1/GAoJIy6ycj3OovQT', // Kitsune (race)
  'pf1/GYsnN9R8iakvAopY', // Hellfire (classFeature)
  'pf1/Gtz5E4r6tg6spifD', // Suli (race)
  'pf1/Gy4jOckBEwMjByga', // Gillman (race)
  'pf1/H6tsZqHiaTOcFSOn', // Shabti (race)
  'pf1/HKRRq2tdZVEGlmHG', // Duskwalker (race)
  'pf1/Hf31mrYb3uucNyLO', // Halfling (race)
  'pf1/IPy4aqFYbOppaqKC', // Cantrips (classFeature)
  'pf1/IXqYkTnaEgHG2ui3', // Earth Domain (classFeature)
  'pf1/IfotwHH89d60H3pR', // Heavy Flail (item)
  'pf1/JOuAdPAOTat7d5v6', // Orc (race)
  'pf1/Jjo1BND4tvEJnO1I', // Wind Subdomain (classFeature)
  'pf1/JreaiTHdyWFNj3Tb', // Dodge (feat)
  'pf1/JxLvkHxDYY98HcAH', // Astomoi (race)
  'pf1/K7R4SXNKvzq5xmQK', // Cold Resistance (classFeature)
  'pf1/K8t4QuJhu4yXPgGJ', // Abyssal Claws (classFeature)
  'pf1/KMpuFun7YDFyuO8z', // Vine Leshy (race)
  'pf1/KXnHUgJXQvUAwJSP', // Flotsam Subdomain (classFeature)
  'pf1/KbcnBk7n4tctvnI9', // Fire Domain (classFeature)
  'pf1/KtgSPHGqIRTwhwZM', // Bastard Sword (item)
  'pf1/L10V7jTzmMYz62zz', // Persuasive (feat)
  'pf1/L5jrgNDA43dMH1wm', // Acid Dart (classFeature)
  'pf1/LA6TC5679iOXDNwq', // Rapier (item)
  'pf1/LAtTC2NPuqjTLEkn', // Adaro (race)
  'pf1/LDI7nsgF5UL75dLv', // Flowing Subdomain (classFeature)
  'pf1/LMNzbqGSRAFQFE2Y', // Kobold (race)
  'pf1/LQ7U0315C6CusmsU', // Reborn Samsaran (race)
  'pf1/Lt4ZP5GCinGvTfnF', // Grindylow (race)
  'pf1/LwwjHf6ORZKi0tTa', // Radiation Subdomain (classFeature)
  'pf1/MF8vCjLIGTmJl3Mo', // Strix (race)
  'pf1/MSLlV9YnompTd6xp', // Grippli (race)
  'pf1/Mb6NAx0BJsoKbvt6', // Kuru (race)
  'pf1/N37FFAdWjVV6EolR', // Shortspear (item)
  'pf1/NFxHebU1XhEs5WJh', // Combat Expertise (feat)
  'pf1/NgIhxRI0axrf3fcO', // Elf (race)
  'pf1/NhEPoXIZWOOunSH7', // Cecaelia (race)
  'pf1/OPTlPwKg2NyQAjhe', // Whip (item)
  'pf1/PqJih70EG2A1XNGf', // Longbow (item)
  'pf1/PsRZOF49ZKtorZbs', // Wyrwood (race)
  'pf1/Q0rRzB0zUWSPM3JC', // Demon Resistances (classFeature)
  'pf1/QKrRHanuWwD4pu8Q', // Ganzi (race)
  'pf1/R3a1OV18RwDJftvq', // Leadership (feat)
  'pf1/RQo6mf1F6pXp0IzL', // Elemental Movement (Fire) (classFeature)
  'pf1/RaFl9SpbAlXqhsDk', // Orisons (classFeature)
  'pf1/SUACufUXl12sUvnQ', // Deceitful (feat)
  'pf1/SjFqQceVeVBzBwgn', // Cleric (class)
  'pf1/SjYkpvZqfgvh0EAd', // Scimitar (item)
  'pf1/TPHe88Yhy4SsDpKo', // Ifrit (race)
  'pf1/TbZmYyDUxRn9baWy', // Sahuagin (race)
  'pf1/TpfcHDjKatQL3XBl', // Naiad (race)
  'pf1/U2YBSx1s8cT8iDq1', // Favored Terrain (classFeature)
  'pf1/Uuiu3p982omhMEPj', // Improved Initiative (feat)
  'pf1/Uw42p33QKEUhlSMi', // Kukri (item)
  'pf1/V2zY7BltkpSXwejy', // Spell Focus (feat)
  'pf1/V57hEfKt1MroRI91', // Fire Bolt (classFeature)
  'pf1/VE4d35yiptv2eyxm', // Catfolk (race)
  'pf1/VFejQ7mOCxSp26xk', // Fire Resistance (classFeature)
  'pf1/VMVAqGze4cs3naya', // Nimble Moves (feat)
  'pf1/VYbsatEW3DFCLWtD', // Kasatha (race)
  'pf1/Vaf5bV3wpk24pVt2', // Wayang (race)
  'pf1/VkQBqlEG8GPmNnzI', // Vanara (race)
  'pf1/W1KWAZxUNxfCv8rG', // Bloodline Feat (SOR) (classFeature)
  'pf1/W4PGylYL7ghRfy5G', // Cleric Spells (classFeature)
  'pf1/WKeBSFyzkZeAl3B9', // Fighting Fan (item)
  'pf1/Wkv124hVPATT35bm', // Aura (classFeature)
  'pf1/Wx22UaMqWgCrYi7r', // Greataxe (item)
  'pf1/WxPc1Nw2V3ohdl2x', // Locathah (race)
  'pf1/WzN6fEHiT8OTpwUR', // Caligni (race)
  'pf1/XUMkVRv3gMsysVbh', // Corrupting Touch (classFeature)
  'pf1/YCCdi4OEC4WuzelM', // Reptoid (race)
  'pf1/Yder5QR51sDl5X0n', // Vishkanya (race)
  'pf1/YibSkrURB0yHprQK', // Abyssal Bloodline (classFeature)
  'pf1/Yr8dfM2d8JEWoYkr', // Wild Empathy (classFeature)
  'pf1/YvEe9B32X53ZCuWs', // Thundercloud (classFeature)
  'pf1/YxeSVRbG7lfQybfr', // Green Martian (race)
  'pf1/Z76GkfAvnzba4XDd', // Deep One Hybrid (race)
  'pf1/ZVzH0qb1Tqety6fU', // Nagaji (race)
  'pf1/ZYWZL5BWLfZyMif9', // Being of Ib (race)
  'pf1/Zcatqkdn6BuGYdsM', // Elemental Movement (classFeature)
  'pf1/Zeq6RWYv5otvg8q7', // Cleave (feat)
  'pf1/ZnRc2qF1ZfpajxEe', // Rougarou (race)
  'pf1/a5gcbpwfhu4hh5ic', // Earthquake (spell)
  'pf1/a6isom7wx0nmhwfp', // Prestidigitation (spell)
  'pf1/aCyDEyMB5PKJAuTi', // Monkey Goblin (race)
  'pf1/aQ8RQYKVd2hqI4jh', // Samsaran (race)
  'pf1/aZ4tLZL0LIZAHnQ1', // Armor Spikes (item)
  'pf1/aa0w7tk852iqn3ni', // Detect Undead (spell)
  'pf1/apWl6JIJ8U8p0azq', // Skinwalker (race)
  'pf1/asX1tCPLkhm2UiwQ', // Strength of the Abyss (classFeature)
  'pf1/awNlvqmRM1TZRVR9', // Longspear (item)
  'pf1/awia42zci8nufpfl', // Nondetection (spell)
  'pf1/b8lt1275mz4ez4d8', // Major Creation (spell)
  'pf1/b8vp8fgt1o6pq1qc', // Continual Flame (spell)
  'pf1/bOv30pyHB1gFbSTj', // Goblin (race)
  'pf1/bXeW4kLCErPBFpNB', // Run (feat)
  'pf1/bf2lu50t56iswz18', // Feather Step (spell)
  'pf1/bfIz1vVKGX9p8MHT', // Tonfa (item)
  'pf1/bl71og1gklwncmt7', // Faerie Fire (spell)
  'pf1/blvetbc929cfx4m8', // Mind Blank (spell)
  'pf1/btXWioB3SKJv8YEG', // Extend Spell (feat)
  'pf1/btoow6tyv39443gh', // Shadow Walk (spell)
  'pf1/byn5q46du0ck592a', // Speak with Dead (spell)
  'pf1/c0hvjnqzry149ugs', // Curse Water (spell)
  'pf1/c3vws58yy0pk47gs', // Planar Ally, Lesser (spell)
  'pf1/c5anior2ysy6s2xy', // Raise Dead (spell)
  'pf1/cCepRrfH5SalFfT4', // Half-Elf (race)
  'pf1/cJ0PUlm41aroXQa8', // Caves Subdomain (classFeature)
  'pf1/cJV7OBm9KiF2WWiu', // Sling (item)
  'pf1/ccklt2ehmeacsojx', // Spear of Purity (spell)
  'pf1/ct9fhh8uawn8e4md', // Speak with Animals (spell)
  'pf1/d1wxnax51cecplm4', // Augury (spell)
  'pf1/dCAXgdA6Db1Z3ccz', // Half-Orc (race)
  'pf1/dkv9v4verb82fmpx', // Meld into Stone (spell)
  'pf1/dn2KgHFQRbuoNRx0', // Improved Bull Rush (feat)
  'pf1/dopWa3n4mgTGpTYi', // Exchange Spell (High) (classFeature)
  'pf1/dqj6m4atpnp7dd9k', // Flame Blade (spell)
  'pf1/duTYxfPMR1dCmpd8', // Infernal Resistances (classFeature)
  'pf1/e4v1uv8hexeu9sxj', // Air Walk (spell)
  'pf1/e6IaBxKgMxy1yKlr', // Human (race)
  'pf1/e8zen5nzixnt7bde', // Horrid Wilting (spell)
  'pf1/eV9USBGHA1rYd5P7', // Duergar (race)
  'pf1/ech2cibcsmsms9s7', // Dust of Twilight (spell)
  'pf1/efwHEwjvL9Z94MJI', // Gnome (race)
  'pf1/eg67vvykmv9c6j7h', // Flare (spell)
  'pf1/ehqx8txNRGMaNOPt', // Endurance (feat)
  'pf1/exdHrqciehozr5SD', // Chaotic, Evil, Good, and Lawful Spells (classFeature)
  'pf1/fOSuWwRSZLTrROch', // Dagger (item)
  'pf1/fVRnBIHR4Jq6btvm', // Great Fortitude (feat)
  'pf1/fX9F2amW2BcYoHwb', // Svirfneblin (race)
  'pf1/fbzut7nb7lvr83e4', // Urban Grace (spell)
  'pf1/fipqx43u5blpjsvo', // Stabilize (spell)
  'pf1/flMrvQOBVwXagqow', // Air Domain (classFeature)
  'pf1/flrn1xmm2wfrxbkf', // Unholy Aura (spell)
  'pf1/fnxgq54y02f6ri82', // Wall of Iron (spell)
  'pf1/fsDZNtCRYiKuPETc', // Cloud Subdomain (classFeature)
  'pf1/fv9mgob508qv99zz', // Magic Stone (spell)
  'pf1/fxz69pwpqt9b6uss', // Restoration, Lesser (spell)
  'pf1/g0q8c0ni0rvipjpn', // Solid Fog (spell)
  'pf1/g1evszmk8wfgnsv5', // Stone Shape (spell)
  'pf1/g2msiy3asviz0b1n', // Object Reading (spell)
  'pf1/g2obld7y0lpyztes', // Water Walk (spell)
  'pf1/g33euis7yi9pwddy', // Fog Cloud (spell)
  'pf1/g52zx1t1giteg5h1', // Statue (spell)
  'pf1/g9SoLRJqSd2uvkG3', // Elemental Resistance (classFeature)
  'pf1/g9koefk7x9szoheo', // Control Winds (spell)
  'pf1/gfvnfa5k1tnpvg8v', // Planar Ally (spell)
  'pf1/gq7np9mwtfd500zg', // Blight (spell)
  'pf1/h4hrop7rq2c9phyi', // Blurred Movement (spell)
  'pf1/h4nlrm44ubsyzuhz', // Fluid Form (spell)
  'pf1/hBjfCZYv4qwZr101', // Elemental Bloodline (classFeature)
  'pf1/hFHJ4B9hwrGll8o4', // Metal Subdomain (classFeature)
  'pf1/hd32fuc6e7j4isbn', // Elemental Body III (spell)
  'pf1/hfyycpn0wdimx1n9', // Spike Stones (spell)
  'pf1/hk3xhc08blqzniv0', // Daze (spell)
  'pf1/hlom4mgjkdy2dd5u', // Weapon of Awe (spell)
  'pf1/i8yzlekyl29dm3zz', // Soften Earth and Stone (spell)
  'pf1/i9greyz3c0ap32vi', // Whirlwind (spell)
  'pf1/iAbIGhm7T2OK9Brt', // Iron Will (feat)
  'pf1/ibk7jrc5rwubpia6', // Aid (spell)
  'pf1/ifcnx1yyw6e7ousm', // Dream (spell)
  'pf1/igwRYyXsVoDgIPSi', // Dogslicer (item)
  'pf1/ik9u3eel5vfwrtb5', // Grease (spell)
  'pf1/ip9onjfp6nf1vlv9', // Light (spell)
  'pf1/iq0as5470o8q9y39', // Incendiary Cloud (spell)
  'pf1/iqJvhd7NbmybUl0y', // Undine (race)
  'pf1/j0bc0iii8zp1jiwr', // Read Magic (spell)
  'pf1/j91n23p4tfjixp3s', // Summon Monster VIII (spell)
  'pf1/j9qpy0d585f8lpm4', // Web (spell)
  'pf1/jLZAApW8ymudcJpw', // Drow Noble (race)
  'pf1/jcs7ba5depdyitey', // Comprehend Languages (spell)
  'pf1/jhh6z3NZlImHjZ8H', // Munavri (race)
  'pf1/jhyb2ana8jrk2lut', // Unseen Servant (spell)
  'pf1/jnlr9cuepka1l26e', // Enlarge Person (spell)
  'pf1/jsvjsax2eabrlx8g', // Minor Creation (spell)
  'pf1/k0k8gvqyy3rd5gke', // Death Knell (spell)
  'pf1/k3zn13pbr5tr9zac', // Dismissal (spell)
  'pf1/k4whhwm1dsz2upkm', // Goodberry (spell)
  'pf1/k9iu3d82hlo7coct', // Animate Objects (spell)
  'pf1/kXXz1lO4i7CibHJ9', // Channel Energy (classFeature)
  'pf1/kgynwswfuj9oo0es', // Detect Poison (spell)
  'pf1/knyako6zopc1chrv', // Stoneskin (spell)
  'pf1/kouqz0pm1xl8xilm', // Alter Self (spell)
  'pf1/kq916lznxo0ig68v', // Silent Image (spell)
  'pf1/kx2ZfV2wjlAZgQ6E', // Spontaneous Casting (CLE) (classFeature)
  'pf1/kyo0kwhw2jhuztju', // Summon Monster I (spell)
  'pf1/l83djt5019ujasjh', // Wall of Stone (spell)
  'pf1/ldijs33l5ycavo2g', // Psychic Reading (spell)
  'pf1/li8zwqjorsww6o82', // Age Resistance (spell)
  'pf1/lndeaqm2j2nvgm6p', // Burning Hands (spell)
  'pf1/lpXdFoT6OqS5vi2X', // Improved Sunder (feat)
  'pf1/ltda70etgwje43x6', // Tsunami (spell)
  'pf1/lun2gymejsmkjg4g', // Winds of Vengeance (spell)
  'pf1/lvzq2mwkqmozolpl', // Freedom of Movement (spell)
  'pf1/m1Yvpz1t8S9x4PPr', // Primitive Human (race)
  'pf1/m1rmcpcaixcpz9ib', // Tongues (spell)
  'pf1/m5cdZ1RG7c1mkhqF', // Orang-Pendak (race)
  'pf1/m84969gni5iu4bdt', // Lightning Bolt (spell)
  'pf1/md6ltvqh9paadsm4', // Protection from Chaos (spell)
  'pf1/menqakfoa1ftvi3f', // Shield Other (spell)
  'pf1/mi52crelhwuy6bmp', // Summon Monster IX (spell)
  'pf1/mkrjbrp57yfdqrx0', // Iron Body (spell)
  'pf1/moftgchcn1d0p2t0', // Detect Secret Doors (spell)
  'pf1/mqdoexj35atgqafn', // Gaseous Form (spell)
  'pf1/msaqovkgfxi6q8s8', // Message (spell)
  'pf1/mtDcvNtXAwM66T9v', // Water Domain (classFeature)
  'pf1/mtxqp85izkb20djq', // Ghost Sound (spell)
  'pf1/n390v9tbwxya1tz4', // Bleed (spell)
  'pf1/n4e35m6qu9nmkhgm', // Storm of Vengeance (spell)
  'pf1/n8k4pdmjjg8xuv7l', // Arcane Mark (spell)
  'pf1/nEltI9y37rKJTeWo', // Dwarf (race)
  'pf1/nRASOVnnyC6FJRMV', // Demonic Might (classFeature)
  'pf1/nVjKDLZSRONzYm8f', // Tiefling (race)
  'pf1/nWFr8SNcjcMqsXSH', // Spell Penetration (feat)
  'pf1/nfm6i9z9r3n2fku7', // Fire Shield (spell)
  'pf1/nokru6mxk9p3r513', // See Invisibility (spell)
  'pf1/ns8jbp0ilbvbvuif', // Cat's Grace (spell)
  'pf1/o0EifCkU3QUraDF3', // On Dark Wings (classFeature)
  'pf1/o8rxNsQ7P7Yjlvvu', // Lightning Arc (classFeature)
  'pf1/ocbjt6z7amc3yn8w', // Remove Disease (spell)
  'pf1/ohy0ty2dawfaaqwd', // Hydraulic Push (spell)
  'pf1/oj36nfak6jc2s5ky', // Disguise Self (spell)
  'pf1/ol05jfb606v0lzj9', // Freezing Sphere (spell)
  'pf1/ol9newf4vrcx0kpf', // Power Word Stun (spell)
  'pf1/op40qjf9oohlx5nu', // Heroes' Feast (spell)
  'pf1/oyUApQSVsAqzyjdz', // Greatsword (item)
  'pf1/p2kosvizylhy8vfa', // Commune (spell)
  'pf1/p8lm7khq3ynyif21', // Mage Hand (spell)
  'pf1/p9yDKj9mQz1bBiJp', // Petrification Subdomain (classFeature)
  'pf1/pawbnw1nm4f0b98e', // Elemental Body I (spell)
  'pf1/pbX1xj9Z0ZhUfKvZ', // Sylph (race)
  'pf1/pfy97qyneoa391ek', // Elemental Swarm (spell)
  'pf1/pg7dbmuuaksxhp3v', // Charm Animal (spell)
  'pf1/pkm8um5t1cxsn6jh', // Cone of Cold (spell)
  'pf1/plou8h168bfn5hq6', // Levitate (spell)
  'pf1/pmAO1Sni8xx71pLF', // Blind-Fight (feat)
  'pf1/ptqu8gtrujxsvwy1', // Teleport (spell)
  'pf1/puKk997wHX3kIRkR', // Dhampir (race)
  'pf1/q070n0zoq3zojpas', // Dominate Person (spell)
  'pf1/q3hwveEbUcLrNz73', // Elemental Movement (Earth) (classFeature)
  'pf1/q3st18udsalnyz5v', // Plane Shift (spell)
  'pf1/q4ixxjb4v281g2xv', // Scorching Ray (spell)
  'pf1/q63jn0kbrrb6t3ea', // Shatter (spell)
  'pf1/qcjskol4ac3eemhy', // Color Spray (spell)
  'pf1/qdFPM6gztJxvdiRf', // Trox (race)
  'pf1/qf4bqjgeff1q4hjt', // Planar Binding (spell)
  'pf1/qlQxKPARGGdOgNWm', // Bloodline Spells (SOR) (classFeature)
  'pf1/qooag8g9dxck4lik', // Inflict Light Wounds (spell)
  'pf1/qvpzcjm5lmtn389j', // Erase (spell)
  'pf1/r1hLFYVGSEoSc50J', // Elemental Body (classFeature)
  'pf1/rAKaCt6BW3rVv2kN', // Ratfolk (race)
  'pf1/rAXKZrrdKNJdXbWC', // Elemental Blast (classFeature)
  'pf1/rRgDV4GMJf7BosAE', // Lightning Rod (classFeature)
  'pf1/rrsefzpm3nhztvld', // Speak with Plants (spell)
  'pf1/rsDtJY6xEH7v7uLU', // Horsechopper (item)
  'pf1/ructcpEg6rejcpYQ', // Icicle (classFeature)
  'pf1/ryBQiQNP6ZrkwZCy', // Syrinx (race)
  'pf1/s0LFk8Jk5CsgOj7V', // Spear (item)
  'pf1/sMHXS804w3UdTVKH', // Triaxian (race)
  'pf1/sXIQ3MFLInN9SF7m', // Yaddithian (race)
  'pf1/skgjjub1hng29nwo', // Protection from Evil (spell)
  'pf1/smbkd2yobhshbpqf', // Charm Monster (spell)
  'pf1/snj78r5rw96btfjn', // Create Water (spell)
  'pf1/snspotd2cno49ed5', // Zone of Truth (spell)
  'pf1/sq5lzym6a8mmfl7l', // Defoliate (spell)
  'pf1/t1uhggjfimtabp4v', // Ice Storm (spell)
  'pf1/t1w2zq5fx7mislq8', // Touch of Fatigue (spell)
  'pf1/tPYmbs5ChEojyPSe', // Ice Subdomain (classFeature)
  'pf1/tap9LNVtXblKh0sv', // Electricity Resistance (classFeature)
  'pf1/thh46ghi51lrl3cl', // Resurrection (spell)
  'pf1/tjdfluulncmqacc3', // Beast Shape I (spell)
  'pf1/tjog6bufg5b08lvq', // Charm Person (spell)
  'pf1/to1cdmyh5rtfyg2s', // Chill Touch (spell)
  'pf1/tr7m97npkbgm4wp7', // Detect Evil (spell)
  'pf1/tsndfcfijmgxs37p', // Darkness (spell)
  'pf1/tuh5vc2bojaws3ig', // Obscuring Mist (spell)
  'pf1/tvhm9lzgnjlcucsn', // Plant Growth (spell)
  'pf1/uFSLnLZkYJycxB6b', // Oceans Subdomain (classFeature)
  'pf1/ubx4PIbRqmVT93Ds', // Gathlain (race)
  'pf1/ug7ycubjoxgp7ppc', // Open/Close (spell)
  'pf1/uqh87jz757r2cb7r', // Detect Magic (spell)
  'pf1/usdv1eqvibmxun6x', // Bear's Endurance (spell)
  'pf1/v42t5kpxc8mvd615', // Elemental Body IV (spell)
  'pf1/v8Ee5Iagp62xsUQZ', // Falchion (item)
  'pf1/v8czhud6wpmc9esu', // Whispering Wind (spell)
  'pf1/vVkKDPniD09W5JgO', // Eschew Materials (classFeature)
  'pf1/vWiTqHC4Y3Xn1Pme', // Weapon Finesse (feat)
  'pf1/vr35zocojcg7gei8', // Cloak of Shade (spell)
  'pf1/vxmp5prgw5fj4h6f', // Hallow (spell)
  'pf1/w8v617tw8wjlcl53', // Age Resistance, Lesser (spell)
  'pf1/wa7p5zwwl1p0rt92', // Doom (spell)
  'pf1/wgm8mm1za909pwch', // Stone Tell (spell)
  'pf1/wjdhmfdgwrevax3w', // Ill Omen (spell)
  'pf1/wltdd4jmqepdy0qj', // Burning Sands (spell)
  'pf1/wvpa1pt2gyh75g3x', // Calcific Touch (spell)
  'pf1/wzNzs5M71JUjktPz', // Power of the Pit (classFeature)
  'pf1/x23pz2agjub1eh89', // Make Whole (spell)
  'pf1/xhd6734dulevnwef', // Wind Wall (spell)
  'pf1/xhzme0v6tjq95fg6', // Meteor Swarm (spell)
  'pf1/xi1uouy7qlpfaqlr', // Purify Food and Drink (spell)
  'pf1/xllxylvvqr82o2d5', // Detect Thoughts (spell)
  'pf1/xwudq0udiudu4v8g', // Compassionate Ally (spell)
  'pf1/y4b1zmhmsa0gvf06', // Planar Binding, Lesser (spell)
  'pf1/yAS41rHv0WzDmuRm', // Tengu (race)
  'pf1/yHDVCenLfvduBVM7', // Infernal Bloodline (classFeature)
  'pf1/yLaDS5HGbwtgpkbP', // Drow (race)
  'pf1/yaL9DS7Eu5OmsxnV', // Sorcerer Spells (classFeature)
  'pf1/yldjnorgbx4jsldz', // Elemental Body II (spell)
  'pf1/zWRlna42PMJVX6un', // Longsword (item)
  'pf1/zcFwzE3jAqNKY9Xn', // Elemental Ray (classFeature)
  'pf1/zlWiqUqxCajrZRe3', // Aphorite (race)
  'pf1/zpav8ywcqwkcuojw', // Consecrate (spell)
  'pf1/zqj5qzyl46af27v0', // Suggestion (spell)
  'pf1/zrUJt7YpAJkf2NC6', // Domains (classFeature)
  'pf1/zymaptg3vmnvfvxl', // Dancing Lights (spell)
] as const;

export const racialTraits719 = [
  'pf1-content/0batsU6Vpae72HiU', // Tentacle Attacks (racialTrait)
  'pf1-content/10fI7Q5jTGYhav06', // Low-Light Vision (Kitsune) (racialTrait)
  'pf1-content/1HOWCThotIz5ztx0', // Keen Senses (Half-Elf) (racialTrait)
  'pf1-content/2D0gZsqUawS3Rd0O', // Light Blindness (Drow) (racialTrait)
  'pf1-content/2F4IRW8AAicQ3VYc', // Greed (Dwarf) (racialTrait)
  'pf1-content/3HbUyHrEVeDiTH1d', // Languages (Half-Elf) (racialTrait)
  'pf1-content/3J3lWu2Lm9aJSNXg', // Reptilian (Nagaji) (racialTrait)
  'pf1-content/45xNKgDQ3SvKpW58', // Craven (racialTrait)
  'pf1-content/4EnFrSO7n6EO5fxO', // Delicious (racialTrait)
  'pf1-content/6JCG0ei0s0ossrtx', // Stonecunning (Dwarf) (racialTrait)
  'pf1-content/6yUgkL8nRaoWTl41', // Ability Score Modifiers (Kitsune) (racialTrait)
  'pf1-content/7fL4TAWC0d05MIyv', // Past-Life Knowledge (Ghoran) (racialTrait)
  'pf1-content/9k7IPymCwkmHyI9O', // Kitsune (racialTrait)
  'pf1-content/ACFSI8aOJAYr89QM', // Darkvision (Dwarf) (racialTrait)
  'pf1-content/AO5nhhUfI1b4M37H', // Hardy (racialTrait)
  'pf1-content/BFszTUJLlDS1ZDB8', // +2 to One Ability Score (Human) (racialTrait)
  'pf1-content/BMIxDLXqziDnuMSa', // Keen Senses (Drow) (racialTrait)
  'pf1-content/CKxKRzXRJPG1TCu0', // Hatred (Svirfneblin) (racialTrait)
  'pf1-content/CPOfbE09H9pI8Nhy', // Darkvision (Wayang) (racialTrait)
  'pf1-content/CRk79ejVlfpyi1nB', // Swim Speed (Cecaelia) (racialTrait)
  'pf1-content/CmBe4LyfyjQ24hCA', // Jet (Cecaelia) (racialTrait)
  'pf1-content/CmhdInCVqMiadv3T', // Claws (Changeling) (racialTrait)
  'pf1-content/DEowtAtiVIQOh2dj', // Dual Minded (racialTrait)
  'pf1-content/DI4TtsaRywLKUWbE', // Darkvision (Cecaelia) (racialTrait)
  'pf1-content/DLslPcoXcnvQjIPH', // +2 Natural Armor (racialTrait)
  'pf1-content/DyrdgHiQStt2znkE', // Languages (Kitsune) (racialTrait)
  'pf1-content/EbnxHOByXWYcmqYe', // Defensive Training (Svirfneblin) (racialTrait)
  'pf1-content/FD2SILZXcIMjauvr', // Hatred (Gnome) (racialTrait)
  'pf1-content/FFlAmgYJfOULGv0Z', // Darkvision (Drow) (racialTrait)
  'pf1-content/FKD0hz8VRsVIsfcb', // Languages (Grindylow) (racialTrait)
  'pf1-content/FKiLZeX0mgKgr8bH', // Amphibious (Cecaelia) (racialTrait)
  'pf1-content/FWRhefdBhdDvKS1N', // Languages (Svirfneblin) (racialTrait)
  'pf1-content/FyjBYbqlBore4xy6', // Darkvision (Grindylow) (racialTrait)
  'pf1-content/G8wXEXBfUKfRxuVV', // Hag Racial Trait (Changeling - Crawling Skin) (racialTrait)
  'pf1-content/GS07eqHZBCT979tA', // Weapon Familiarity (Elf) (racialTrait)
  'pf1-content/GfQrx1OHTdOIVAWb', // Weapon Familiarity (Dwarf) (racialTrait)
  'pf1-content/H59daebatbCBLoKq', // Change Shape (Reptoid) (racialTrait)
  'pf1-content/HVI7FNwj2ng10qtj', // Halfling Luck (racialTrait)
  'pf1-content/I8Zy5iy8HpAxBZQb', // Low-Light Vision (Half-Elf) (racialTrait)
  'pf1-content/IQ5vHUbNbGqVaVV5', // Defensive Training (Gnome) (racialTrait)
  'pf1-content/IQphttqw1U0aVd3j', // Hag Racial Trait (Changeling - Sea Lungs) (racialTrait)
  'pf1-content/IuApwtNYMYMTabOZ', // Languages (Elf) (racialTrait)
  'pf1-content/JWzMBJeAQYDav9gw', // Orc Blood (racialTrait)
  'pf1-content/JlymGAKiie1gmqI2', // Weapon Familiarity (Orc) (racialTrait)
  'pf1-content/Jnw41wF4ln2vH7d8', // Svirfneblin Magic (Svirfneblin) (racialTrait)
  'pf1-content/JsvoElxHBPdle8s8', // Slow and Steady (Dwarf) (racialTrait)
  'pf1-content/JtJKg8vV58UJ6m1m', // Hatred (Dwarf) (racialTrait)
  'pf1-content/L2ucOsiHPXq7FKKF', // Cold-Blooded (racialTrait)
  'pf1-content/L4yOFpviuO9WvCyT', // Keen Senses (Gnome) (racialTrait)
  'pf1-content/LJMqyMRGo5QrUASa', // Weapon Familiarity (Drow) (racialTrait)
  'pf1-content/LcZE7cPw87DMzJYl', // Obsessive (racialTrait)
  'pf1-content/LwDcZanOEHqVaYoh', // Skilled (Human) (racialTrait)
  'pf1-content/MhFMYfP5kHTZOunS', // Amphibious (Grindylow) (racialTrait)
  'pf1-content/MiPbhGqPRX7H4C7a', // Gnome Magic (Gnome) (racialTrait)
  'pf1-content/NlrWvpPCsJMVC7Qp', // Spell Resistance (Drow) (racialTrait)
  'pf1-content/OvKzLDHijIYHCO4A', // Fortunate (racialTrait)
  'pf1-content/OyIvyI3x7V5HIzZL', // Orc Ferocity (racialTrait)
  'pf1-content/Pe7olUqkJIbDGl4q', // Slow Speed (Gnome) (racialTrait)
  'pf1-content/PxjUu8YOjXmWdagL', // Ability Modifiers (Changeling) (racialTrait)
  'pf1-content/QgiMP50bjeNmLvbI', // Hag Racial Trait (Changeling - Green Widow) (racialTrait)
  'pf1-content/Qx1JqPVW0quaOGfY', // Natural Armor (Changeling) (racialTrait)
  'pf1-content/RYyMubzEGeBaS6Q5', // Elf (racialTrait)
  'pf1-content/S2NJixZYq3fBtPig', // Arctic Elf (racialTrait)
  'pf1-content/SCPbTbMBMkwN2Uba', // Hag Racial Trait (Changeling - Hulking Changeling) (racialTrait)
  'pf1-content/SRBfqkzIldwETAHB', // Dual Talent (racialTrait)
  'pf1-content/SSksShaDho0IcKCO', // Natural Weapons (Kitsune) (racialTrait)
  'pf1-content/SlDu4fhDm9imymQ9', // Natural Magic (racialTrait)
  'pf1-content/SyXfxr53mzenpNu5', // Urbanite (racialTrait)
  'pf1-content/T4PaZ33R29gTAFaT', // Stability (Dwarf) (racialTrait)
  'pf1-content/TQFXEnSgr6JENkxU', // Languages (Cecaelia) (racialTrait)
  'pf1-content/URpcaP1vfemHJyal', // Pyromaniac (racialTrait)
  'pf1-content/UawXK40Ix4vmfMkY', // Intimidating (racialTrait)
  'pf1-content/VHmuEYXmx81Q5EmC', // +2 to One Ability Score (Half-Orc) (racialTrait)
  'pf1-content/VRVtIxsv59vhHm5y', // Hag Racial Trait (Changeling - Frostlaced Flesh) (racialTrait)
  'pf1-content/WOF6A7695wxFO2ie', // Keen Senses (Elf) (racialTrait)
  'pf1-content/WeWIm2pWosb2oHQU', // Languages (Ghoran) (racialTrait)
  'pf1-content/X3ixmmB9S07XqKNX', // Low-Light Vision (Elf) (racialTrait)
  'pf1-content/XPYjs1zYjY2E02gz', // Spell-Like Abilities (Drow) (racialTrait)
  'pf1-content/XQySDLBHVVeaaRzo', // Resistant (racialTrait)
  'pf1-content/XVo4DApULZaETYcz', // Keen Senses (Halfling) (racialTrait)
  'pf1-content/XixpDZG7W0XELNni', // Shadow Magic (Wayang) (racialTrait)
  'pf1-content/XlXhCGpR8I2KUNA5', // Aberration (racialTrait)
  'pf1-content/YHwpeek5IHtcZNDF', // Illusion Resistance (racialTrait)
  'pf1-content/YLr7f3djG85wvbAT', // Kitsune Magic (racialTrait)
  'pf1-content/YMocjN3SlwHoQgW1', // Languages (Halfling) (racialTrait)
  'pf1-content/Yfywu8kU3UraGzlN', // Drow Immunities (racialTrait)
  'pf1-content/Yw9TH7PWecvfDLfo', // Senses (Svirfneblin) (racialTrait)
  'pf1-content/Z7uj8OS11fVPBEnf', // Slow Speed (Grindylow) (racialTrait)
  'pf1-content/ZR7KbJlVZV68puBM', // Mental Potency (racialTrait)
  'pf1-content/ZaTEe0kZxKJuYYjT', // Languages (Gnome) (racialTrait)
  'pf1-content/aJGZNcrbFJhbzUaz', // Light Dependent (racialTrait)
  'pf1-content/adLgjvqxTWpAWxFJ', // Plant (racialTrait)
  'pf1-content/bGb3Y5JukIgU1Kdt', // Ink Cloud (racialTrait)
  'pf1-content/bRO90tmeaH1tFi2g', // Elven Magic (Elf) (racialTrait)
  'pf1-content/bnsF4bxf7kQBIIyM', // Agile (Kitsune) (racialTrait)
  'pf1-content/cOod8wThcNc0expZ', // Weapon Familiarity (Halfling) (racialTrait)
  'pf1-content/czaE6LoPE63urloL', // Seed (racialTrait)
  'pf1-content/dFhNrCde0uxjohHy', // Darkvision (Changeling) (racialTrait)
  'pf1-content/dMbfvLa1o308rPFe', // Stable Tentacles (racialTrait)
  'pf1-content/eNIYJNbM6UL7OdyE', // Languages (Human) (racialTrait)
  'pf1-content/eew9hWENxwAiLP8S', // Stubborn (racialTrait)
  'pf1-content/efCmFm0xhnvVzxQz', // Languages (Wayang) (racialTrait)
  'pf1-content/emWoMvZJYkXOz6ot', // Light Sensitivity (Orc) (racialTrait)
  'pf1-content/fUAqkTyumLnQrGch', // Poison Use (Drow) (racialTrait)
  'pf1-content/fc7iZPElgVhpy8L5', // Languages (Nagaji) (racialTrait)
  'pf1-content/fpNtaVGE6wGeLGyH', // Languages (Reptoid) (racialTrait)
  'pf1-content/gEJBYigk4fJKGkyM', // Sneaky (Grindylow) (racialTrait)
  'pf1-content/gGkyhubX0tZ3GwR7', // Hag Racial Trait (Changeling - Into the Wind) (racialTrait)
  'pf1-content/gc6Sxv7hJp2KpVrr', // Languages (Drow) (racialTrait)
  'pf1-content/gh1taO4CBM237eMu', // Scales (racialTrait)
  'pf1-content/gwRHgXExczYgcJOA', // Skilled (Svirfneblin) (racialTrait)
  'pf1-content/hP6ZbMYnXdVA42E8', // Natural Weapons (racialTrait)
  'pf1-content/iB5aNUyJPWjxx3tx', // Languages (Half-Orc) (racialTrait)
  'pf1-content/iBCPIWFExt679Zhh', // Defensive Training (Dwarf) (racialTrait)
  'pf1-content/ikQ2BoHJlx4zYGvB', // Low-Light Vision (Gnome) (racialTrait)
  'pf1-content/j5XYOnvRkSTqKa7N', // Stonecunning (Svirfneblin) (racialTrait)
  'pf1-content/jy1bBBwNolQTthr2', // Spell Resistance (Svirfneblin) (racialTrait)
  'pf1-content/khLVUk3rOIJkhzJg', // Gnome Subtype (racialTrait)
  'pf1-content/l7CqdrmNxsmEsBBG', // Orc (racialTrait)
  'pf1-content/ljJ0jMjxTVcfOiJ3', // Tangling Tentacles (racialTrait)
  'pf1-content/mPD0yR9P3IGAC6nJ', // Weapon Familiarity (Gnome) (racialTrait)
  'pf1-content/mXtf2wP2c6ZHGIsL', // Monstrous Humanoid (Cecaelia) (racialTrait)
  'pf1-content/n4wxE73ZItt77fLt', // Darkvision (Orc) (racialTrait)
  'pf1-content/nBNMonZzsoPLtAKL', // Change Shape (Kitsune) (racialTrait)
  'pf1-content/nIhtofd7nMqG4cKF', // Hag Racial Trait (Changeling - Dead Eyes) (racialTrait)
  'pf1-content/nQ9j793ikC9orJQA', // Languages (Orc) (racialTrait)
  'pf1-content/oKbTIUKJkGwFDHXu', // Ferocity (Orc) (racialTrait)
  'pf1-content/oPMDD3hVTe4LHHla', // Slow Speed (Svirfneblin) (racialTrait)
  'pf1-content/oTQL4P3IdoJQAkOB', // Elven Immunities (Half-Elf) (racialTrait)
  'pf1-content/orOAYDkNl4pqYWA4', // +2 to One Ability Score (Half-Elf) (racialTrait)
  'pf1-content/ot7iCPI3vUSIND6i', // Lurker (racialTrait)
  'pf1-content/qVuEXf9CgkYlYK3l', // Hag Racial Trait (Changeling) (racialTrait)
  'pf1-content/qoCLqjadKmJEN9R7', // Fearless (Halfling) (racialTrait)
  'pf1-content/qwE6ohwtNtWh1kMe', // Swim Speed (Grindylow) (racialTrait)
  'pf1-content/qwLfvwfihx1Sv2xU', // Serpent's Sense (racialTrait)
  'pf1-content/rBKJCVwy3X2VjFdU', // Languages (Dwarf) (racialTrait)
  'pf1-content/rUbLCmT5F5bgTsks', // Light and Dark (racialTrait)
  'pf1-content/rzYk40R1rWSfay4a', // Elf Blood (racialTrait)
  'pf1-content/sFlDW97gf1FHn217', // Weapon Familiarity (Half-Orc) (racialTrait)
  'pf1-content/sSs0BK09PLxjbkAa', // Sure-Footed (racialTrait)
  'pf1-content/sfFAqD9W9iHvSe0D', // Shadow Resistance (racialTrait)
  'pf1-content/srOpqbXesXBuvTqe', // Multitalented (racialTrait)
  'pf1-content/tC0JCXIRZK9tEoMm', // City-Raised (racialTrait)
  'pf1-content/ttCN9QWoKGpAXX4H', // Natural Armor (Grindylow) (racialTrait)
  'pf1-content/u2jBgNMxRpF04Pdq', // Wayang (racialTrait)
  'pf1-content/uAJ9hLZYdH2JX7J8', // Bonus Feat (Human) (racialTrait)
  'pf1-content/uPsATrKLQzHg2cae', // Tentacle Sense (racialTrait)
  'pf1-content/uXWtABSsuB1zn67j', // Smeller (racialTrait)
  'pf1-content/ucoKrHKE2uFXqzl4', // Low-Light Vision (Nagaji) (racialTrait)
  'pf1-content/v5Uff6XAqbnWbk4j', // Natural Armor (Cecaelia) (racialTrait)
  'pf1-content/v6db0gftaAJKUfvK', // Arcane Training (racialTrait)
  'pf1-content/wF5C5CBFSvhAHk9w', // Bite (Grindylow) (racialTrait)
  'pf1-content/wZZzaSmiF8hTuRo7', // Adaptability (racialTrait)
  'pf1-content/wbGd6tR7zA0BsvF8', // Slow Speed (Wayang) (racialTrait)
  'pf1-content/xeEmYqR3IUXoby9x', // Darkvision (Half-Orc) (racialTrait)
  'pf1-content/xoItsNqchG4wE6OG', // Armored Scales (racialTrait)
  'pf1-content/xwr9DBDmvGMYHcut', // Slow Speed (Halfling) (racialTrait)
  'pf1-content/yDX9hhdWlln3ojit', // Low-Light Vision (racialTrait)
  'pf1-content/yQvZ03xcsuM8b595', // Elven Immunities (Elf) (racialTrait)
  'pf1-content/ywwqYzv0scy1H0Ag', // Languages (Changeling) (racialTrait)
  'pf1-content/zBc9X6IUT3JrNFS8', // Jet (Grindylow) (racialTrait)
  'pf1/2mWMyKiPWk6Y8cNx', // Ghoran (races)
  'pf1/7aDvyO68K8hm58Qm', // Lashunta (Female) (races)
  'pf1/7zJTztNW7hdaqjKc', // Skill Focus (feats)
  'pf1/9FBT6uqlRgaw9gug', // Changeling (races)
  'pf1/Ata6ajiY9wuAnBLB', // Shortbow (weapons-and-ammo)
  'pf1/GAoJIy6ycj3OovQT', // Kitsune (races)
  'pf1/Hf31mrYb3uucNyLO', // Halfling (races)
  'pf1/JIljkqPWhmvAPYbI', // Battle Axe (weapons-and-ammo)
  'pf1/JOuAdPAOTat7d5v6', // Orc (races)
  'pf1/LA6TC5679iOXDNwq', // Rapier (weapons-and-ammo)
  'pf1/Lt4ZP5GCinGvTfnF', // Grindylow (races)
  'pf1/NgIhxRI0axrf3fcO', // Elf (races)
  'pf1/NhEPoXIZWOOunSH7', // Cecaelia (races)
  'pf1/OPTlPwKg2NyQAjhe', // Whip (weapons-and-ammo)
  'pf1/PqJih70EG2A1XNGf', // Longbow (weapons-and-ammo)
  'pf1/Vaf5bV3wpk24pVt2', // Wayang (races)
  'pf1/Vh5O2NapyCHRzosU', // Heavy Pick (weapons-and-ammo)
  'pf1/Wx22UaMqWgCrYi7r', // Greataxe (weapons-and-ammo)
  'pf1/YCCdi4OEC4WuzelM', // Reptoid (races)
  'pf1/ZVzH0qb1Tqety6fU', // Nagaji (races)
  'pf1/cCepRrfH5SalFfT4', // Half-Elf (races)
  'pf1/cJV7OBm9KiF2WWiu', // Sling (weapons-and-ammo)
  'pf1/dCAXgdA6Db1Z3ccz', // Half-Orc (races)
  'pf1/e6IaBxKgMxy1yKlr', // Human (races)
  'pf1/efwHEwjvL9Z94MJI', // Gnome (races)
  'pf1/fX9F2amW2BcYoHwb', // Svirfneblin (races)
  'pf1/nEltI9y37rKJTeWo', // Dwarf (races)
  'pf1/pCFqtR5WrJmeZnDF', // Warhammer (weapons-and-ammo)
  'pf1/v8Ee5Iagp62xsUQZ', // Falchion (weapons-and-ammo)
  'pf1/yLaDS5HGbwtgpkbP', // Drow (races)
  'pf1/zWRlna42PMJVX6un', // Longsword (weapons-and-ammo)
] as const;
