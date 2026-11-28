# Catalog import fixtures

The 75 representative YAML data records were copied from these pinned local source checkouts:

- System `v11.11`, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`: `/tmp/ep-foundry/pf1-system-v11.11`. Original records are `packs/<pack>/<filename>`; the reduced manifest comes from `public/system.json`.
- Content `11.4.0`, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`: `/tmp/ep-foundry/pf1-content-11.4.0`. Original records are `src/<pack>/<filename>`; the reduced manifest comes from `module.json`. Its actual manifest ID is `pf-content`.

The manifests retain genuine `id`, `version`, and `packs` fields. Pack declarations are copied unchanged and filtered to the packs represented by these fixtures; content pack paths still describe the upstream built packs, while fixture records mirror the source `src/` layout. This fixture set copies data, never upstream runtime/configuration source or assets. It is representative and is not a complete distributable catalog or a claim of completed source-attribution review. Descriptions, source citations, formulas, links, and IDs retain upstream values. Actor records omit embedded item documents and runtime/token configuration as listed below; no descriptions are shortened.

The Haste spell is deliberately moved one directory deeper to exercise recursive discovery. The ARG Race Builder folder chain leads to the excluded Aberration racial trait. Abandoned is outside that chain and must remain admitted despite its `racePoints` field. Folder records, non-generic Amphibious, the two helper templates, and goods/services, third-party, and 3.5 records exercise exclusions. All 13 creature-type resources and 13 generic attacks are present, along with each of the six companion packs.

`admitted` in the fixture extraction reports means in scope for extraction. The separate attribution gate holds unreviewed candidates and preserves broken-reference failures. `tests/catalog/preview.test.ts` also creates a synthetic single-feat fixture with a current accepted assessment and reviewed notice, then changes each binding or review requirement to verify an individual hold and a successful CLI exit. Its synthetic evidence and notices are only test inputs. The committed fixture data carries no accepted assessment or source backfill.

## Record provenance

Remove the `nested/` segment from the Haste fixture path to obtain its original upstream path. All other paths mirror the source checkout exactly.

| Repository | Pack / fixture filename | ID | Name | Changes |
| --- | --- | --- | --- | --- |
| pf1 | races/human.e6IaBxKgMxy1yKlr.yaml | e6IaBxKgMxy1yKlr | Human | Unchanged |
| pf1 | classes/fighter.WLqBCT5DqmGAx8Wd.yaml | WLqBCT5DqmGAx8Wd | Fighter | Unchanged |
| pf1 | classes/wizard.0c4lYDywj6bQ0i8r.yaml | 0c4lYDywj6bQ0i8r | Wizard | Unchanged |
| pf1 | class-abilities/bravery.h0Brxw6khcjlEf1T.yaml | h0Brxw6khcjlEf1T | Bravery | Unchanged |
| pf1 | feats/power-attack.FUW5mIXHNBBIQ1Sq.yaml | FUW5mIXHNBBIQ1Sq | Power Attack | Unchanged |
| pf1 | buffs/accurate-stance.CjQ4VmDIRBb3k7Dg.yaml | CjQ4VmDIRBb3k7Dg | Accurate Stance | Unchanged |
| pf1 | buffs/chameleon-suit.0MmlqFG4XodHOIzn.yaml | 0MmlqFG4XodHOIzn | Chameleon Suit | Unchanged |
| pf1 | buffs/haste.NWImcWGTjCtw1Zf0.yaml | NWImcWGTjCtw1Zf0 | Haste | Unchanged |
| pf1 | items/abacus.dhloqorqrxaqghis.yaml | dhloqorqrxaqghis | Abacus | Unchanged |
| pf1 | armors-and-shields/agile-breastplate.q2HbIx7a7YpGJ3Kn.yaml | q2HbIx7a7YpGJ3Kn | Agile Breastplate | Unchanged |
| pf1 | weapons-and-ammo/dagger.fOSuWwRSZLTrROch.yaml | fOSuWwRSZLTrROch | Dagger | Unchanged |
| pf1 | companion-features/alertness.iYSmTvVIXZt2uMov.yaml | iYSmTvVIXZt2uMov | Alertness | Unchanged |
| pf1 | spells/nested/haste.s9amdo5398alb5p0.yaml | s9amdo5398alb5p0 | Haste | Unchanged |
| pf1 | racial-hd/aberration.WiROthmRgcwDncDM.yaml | WiROthmRgcwDncDM | Aberration | Unchanged |
| pf1 | racial-hd/animal.WJqmmfXscPVpcISH.yaml | WJqmmfXscPVpcISH | Animal | Unchanged |
| pf1 | racial-hd/construct.H8FbMUps5Z0gQdvV.yaml | H8FbMUps5Z0gQdvV | Construct | Unchanged |
| pf1 | racial-hd/dragon.X2WLdbFFedaah6VC.yaml | X2WLdbFFedaah6VC | Dragon | Unchanged |
| pf1 | racial-hd/fey.0jjH2XJVd6dzlaSm.yaml | 0jjH2XJVd6dzlaSm | Fey | Unchanged |
| pf1 | racial-hd/humanoid.S38eYYsK7pRhPbwg.yaml | S38eYYsK7pRhPbwg | Humanoid | Unchanged |
| pf1 | racial-hd/magical-beast.AjUleVwKSsSaDI4N.yaml | AjUleVwKSsSaDI4N | Magical Beast | Unchanged |
| pf1 | racial-hd/monstrous-humanoid.6Uh8PAjR3BE7dult.yaml | 6Uh8PAjR3BE7dult | Monstrous Humanoid | Unchanged |
| pf1 | racial-hd/ooze.D1vugd9jeyAQrLVX.yaml | D1vugd9jeyAQrLVX | Ooze | Unchanged |
| pf1 | racial-hd/outsider.cV7yHt8i5YCV0ZTd.yaml | cV7yHt8i5YCV0ZTd | Outsider | Unchanged |
| pf1 | racial-hd/plant.AbOSfjvKMqpNihdM.yaml | AbOSfjvKMqpNihdM | Plant | Unchanged |
| pf1 | racial-hd/undead.mp1Zmbx0OAzSW4oW.yaml | mp1Zmbx0OAzSW4oW | Undead | Unchanged |
| pf1 | racial-hd/vermin.g3gX00gTvJU478ju.yaml | g3gX00gTvJU478ju | Vermin | Unchanged |
| pf1 | monster-abilities/amphibious.3K2fqdRb27rEsoFF.yaml | 3K2fqdRb27rEsoFF | Amphibious | Unchanged |
| pf1 | monster-abilities/bite.szjeStouwI3F3WdP.yaml | szjeStouwI3F3WdP | Bite | Unchanged |
| pf1 | monster-abilities/claw.MZnbCVzqpvPsMvfT.yaml | MZnbCVzqpvPsMvfT | Claw | Unchanged |
| pf1 | monster-abilities/gore.3xwmfkQBA3R0Cozz.yaml | 3xwmfkQBA3R0Cozz | Gore | Unchanged |
| pf1 | monster-abilities/hoof.pX3qRL8U1wfBcH80.yaml | pX3qRL8U1wfBcH80 | Hoof | Unchanged |
| pf1 | monster-abilities/pincer.iMix2jm1eh8V6cCN.yaml | iMix2jm1eh8V6cCN | Pincer | Unchanged |
| pf1 | monster-abilities/slam.GrbQIXcmp5VXxYA7.yaml | GrbQIXcmp5VXxYA7 | Slam | Unchanged |
| pf1 | monster-abilities/sting.cuOCNj2vlx0Q1X3J.yaml | cuOCNj2vlx0Q1X3J | Sting | Unchanged |
| pf1 | monster-abilities/swarm-attack.qP52Vv8OelEql6Oq.yaml | qP52Vv8OelEql6Oq | Swarm Attack | Unchanged |
| pf1 | monster-abilities/tail-slap.ogIJ8XWiWFlJIF6S.yaml | ogIJ8XWiWFlJIF6S | Tail Slap | Unchanged |
| pf1 | monster-abilities/talon.PfmCJRQ9qOgwcUxb.yaml | PfmCJRQ9qOgwcUxb | Talon | Unchanged |
| pf1 | monster-abilities/tentacle.5gG3V7rB4Q7LoBFT.yaml | 5gG3V7rB4Q7LoBFT | Tentacle | Unchanged |
| pf1 | monster-abilities/unarmed-strike.1sU57tRb1My6XZMC.yaml | 1sU57tRb1My6XZMC | Unarmed Strike | Unchanged |
| pf1 | monster-abilities/wing.h9ogVoyFP7qMBJhg.yaml | h9ogVoyFP7qMBJhg | Wing | Unchanged |
| pf1-content | pf-special-qualities/Flaming_bcWTxWA8Yi0V3FGZ.yaml | bcWTxWA8Yi0V3FGZ | Flaming | Unchanged |
| pf1-content | pf-special-qualities/_Weapon_Enchant_Conditional_Modifiers_upTvrmZoeKq2LI0F.yaml | upTvrmZoeKq2LI0F | *Weapon Enchant Conditional Modifiers | Unchanged |
| pf1-content | pf-buffs/Acute_Senses_3cimRYgdw7AiOVci.yaml | 3cimRYgdw7AiOVci | Acute Senses | Unchanged |
| pf1-content | pf-buffs/_Common_Conditional_Modifiers_jTaeREVBdEeawArA.yaml | jTaeREVBdEeawArA | *Common Conditional Modifiers | Unchanged |
| pf1-content | pf-companions/Allosaurus_CZZ7FCQJBdv4sFpJ.yaml | CZZ7FCQJBdv4sFpJ | Allosaurus | Actor: removed embedded items, prototypeToken, _stats, and empty spellbook configuration |
| pf1-content | pf-familiars/Almiraj_ugi2jH8ZLVmDO785.yaml | ugi2jH8ZLVmDO785 | Almiraj | Actor: removed embedded items, prototypeToken, _stats, and empty spellbook configuration |
| pf1-content | pf-companion-features/Ability_Score_Increase_HYLK9yCcU73xaVNS.yaml | HYLK9yCcU73xaVNS | Ability Score Increase | Unchanged |
| pf1-content | pf-eidolon-forms/Aberrant_Baseform_UdfkktRJL6fLSGHG.yaml | UdfkktRJL6fLSGHG | Aberrant Baseform | Actor: removed embedded items, prototypeToken, _stats, and empty spellbook configuration |
| pf1-content | pf-eidolon-evolutions/Ability_Increase__2_EP__z7y6rAcnrO7TWKJm.yaml | z7y6rAcnrO7TWKJm | Ability Increase (2 EP) | Unchanged |
| pf1-content | pf-racial-traits/Abandoned_XpZ3k2gmqEF6xnuE.yaml | XpZ3k2gmqEF6xnuE | Abandoned | Unchanged |
| pf1-content | pf-racial-traits/Aberration_OGvHcwhmrl2F70Rh.yaml | OGvHcwhmrl2F70Rh | Aberration | Unchanged |
| pf1-content | pf-racial-traits/Alternate_QR0A1ZzY2Alo3j3S.yaml | QR0A1ZzY2Alo3j3S | Alternate | Unchanged |
| pf1-content | pf-racial-traits/Duskwalker_9rgAk3kusF0mIBqN.yaml | 9rgAk3kusF0mIBqN | Duskwalker | Unchanged |
| pf1-content | pf-racial-traits/Other_Races_Iwrwzoq5uWYKNHty.yaml | Iwrwzoq5uWYKNHty | Other Races | Unchanged |
| pf1-content | pf-racial-traits/Race_Builder_DrDUkvfcwfcx6AP9.yaml | DrDUkvfcwfcx6AP9 | Race Builder | Unchanged |
| pf1-content | pf-racial-traits/Racial_Qualities_dfwclEVJRJgllnC2.yaml | dfwclEVJRJgllnC2 | Racial Qualities | Unchanged |
| pf1-content | pf-racial-traits/Type_1OXMUAUKknfsmQAv.yaml | 1OXMUAUKknfsmQAv | Type | Unchanged |
| pf1-content | pf-class-abilities/Abjuration_KosolVhbo8dNvsSV.yaml | KosolVhbo8dNvsSV | Abjuration | Unchanged |
| pf1-content | pf-feats/Aberrant_Tumor_ilbaNfzWRIhpuE9v.yaml | ilbaNfzWRIhpuE9v | Aberrant Tumor | Unchanged |
| pf1-content | pf-traits/A_Shining_Beacon__Iomedae__01vYmsu0vnfOmlEN.yaml | 01vYmsu0vnfOmlEN | A Shining Beacon (Iomedae) | Unchanged |
| pf1-content | pf-items/Aboleth_Mucus_Extract_TwMyvQ5dOkhErlIs.yaml | TwMyvQ5dOkhErlIs | Aboleth Mucus Extract | Unchanged |
| pf1-content | pf-magic-items/Abrogalian_Corset_ZnRQu4xf1Wxed0As.yaml | ZnRQu4xf1Wxed0As | Abrogalian Corset | Unchanged |
| pf1-content | pf-wondrous/Abjurant_Salt_ykR34daCqsbGy79L.yaml | ykR34daCqsbGy79L | Abjurant Salt | Unchanged |
| pf1-content | pf-artifacts/Abyssal_Runestone_8FT2t3pn2gGKvuwq.yaml | 8FT2t3pn2gGKvuwq | Abyssal Runestone | Unchanged |
| pf1-content | pf-cursed-items/Amulet_of_Inescapable_Location_BTj1SPQ4zd2Wz7jc.yaml | BTj1SPQ4zd2Wz7jc | Amulet of Inescapable Location | Unchanged |
| pf1-content | pf-intelligent-items/Crusader_s_Scabbard_tFotZLGebr6X4KdA.yaml | tFotZLGebr6X4KdA | Crusader's Scabbard | Unchanged |
| pf1-content | pf-scaling-items/Cord_of_Unearthly_Grace_sS8shhXOUuWZuQVJ.yaml | sS8shhXOUuWZuQVJ | Cord of Unearthly Grace | Unchanged |
| pf1-content | pf-third-party/Agememnon_s_Sword___butcher__wkzuskzBs72ZGUIl.yaml | wkzuskzBs72ZGUIl | Agememnon's Sword, 'butcher' | Unchanged |
| pf1-content | pf-goods-services/Allosaurus_aoOZRrUQzeEnKlJj.yaml | aoOZRrUQzeEnKlJj | Allosaurus | Unchanged |
| pf1-content | pf-35-content/Acadamae_Graduate_pJq5RqLF1yfmC2NC.yaml | pJq5RqLF1yfmC2NC | Acadamae Graduate | Unchanged |
| pf1 | technology/biofilter.Iv8lkpAQXwsBqVwt.yaml | Iv8lkpAQXwsBqVwt | Biofilter | Unchanged |
| pf1 | roll-tables/arcane-malignancies.Vm8ccE6qchTx2Trn.yaml | Vm8ccE6qchTx2Trn | Arcane Malignancies | Unchanged |
| pf1-content | pf-eidolon-evolutions/Bite__Attack__YB38Da80HxcuK3wE.yaml | YB38Da80HxcuK3wE | Bite (Attack) | Unchanged |
| pf1 | spells/breeze.hw79kc0v9smvb6mj.yaml | hw79kc0v9smvb6mj | Breeze | Unchanged |
| pf1 | buffs/fighting-defensively.V8cRFtOQA6ltklEl.yaml | V8cRFtOQA6ltklEl | Fighting Defensively | Unchanged; generic buff without a spell/class/item subtype |

The expected import artifacts now include `curation.json`; these representative real upstream records remain missing required curation records until their content batches supply them. The separate [bounded curation fixtures](../curation/README.md) demonstrate the complete workflow and fixture-only review without implying corpus coverage.
