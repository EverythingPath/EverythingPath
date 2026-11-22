import { pcgen716JudgmentArcanaFiles } from './judgment-arcana-files';

// The pinned inputs of the #716 owner emission test (E1; design
// archetype-emission §E): the PCGen files of #772's schedule tests, which
// already hold the Advanced Class Guide, Ultimate Magic, Legacy of Dragons and
// the Core Rulebook classes, plus Animal Archive's class abilities for the Mad
// Dog (anar_abilities_class.lst:7, :81-87), and the
// Foundry records the five owners' classes and replaced rows resolve to.
export const pcgenOwnerEmissionFiles = [
  ...new Set([
    ...pcgen716JudgmentArcanaFiles,
    'player_companion/animal_archive/_animal_archive.pcc',
    'player_companion/animal_archive/anar_abilities_class.lst',
  ]),
];

/** The Foundry classes and class abilities the owners name (`classKeys`, `replaces`). */
export const ownerEmissionFoundryFiles = [
  'pf1/packs/classes/barbarian.g3pq7xWWdUVYw6ai.yaml',
  'pf1/packs/class-abilities/rage.WSqWT9ZIshtC5vlV.yaml',
  'pf1/packs/class-abilities/uncanny-dodge.7WaQxnVaaoL4AGr8.yaml',
  'pf1/packs/class-abilities/improved-uncanny-dodge.ZfnHhhTFQVo0Lj4P.yaml',
  'pf1/packs/class-abilities/indomitable-will.Q3x319WbNkCssApD.yaml',
  'pf1/packs/class-abilities/rage-powers.HdzsFdoGauXFjU2S.yaml',
  'pf1/packs/classes/cleric.SjFqQceVeVBzBwgn.yaml',
  'pf1/packs/class-abilities/channel-energy.kXXz1lO4i7CibHJ9.yaml',
  'pf1/packs/classes/monk.W8dxwZ1CZiwLKsqr.yaml',
  'pf1/packs/class-abilities/still-mind.8VUae7CIgCidvSfg.yaml',
  'pf1/packs/class-abilities/maneuver-training.E7enBZN7FCsoyIof.yaml',
  'pf1/packs/class-abilities/quivering-palm.n4SWyKVcdmZK4t7d.yaml',
  'pf1/packs/class-abilities/bonus-feat-mnk.VjHjPja5QABBgRvR.yaml',
  'pf1/packs/classes/magus.xZLcyrEKYZoJPS2k.yaml',
  'pf1/packs/class-abilities/magus-arcana.HJ2vLLDYkihPxFkD.yaml',
  'pf1/packs/class-abilities/arcane-pool.mpe3JHJMINddqLWr.yaml',
  'pf1/packs/classes/wizard.0c4lYDywj6bQ0i8r.yaml',
  'pf1/packs/class-abilities/arcane-bond.pW1PNlDcdGl7KuEa.yaml',
  'pf1/packs/class-abilities/arcane-school.20JWTam2dn7jjZFV.yaml',
];

/**
 * The Wizard (CRB pp. 77-80) and every record its rows reach, which the gate
 * admits on their declared books (`release-scope-round-trip.ts`), so the
 * Exploiter Wizard can be admitted once it is settled.
 */
export const wizardClosureFiles = [
  'pf1/packs/classes/wizard.0c4lYDywj6bQ0i8r.yaml',
  'pf1/packs/class-abilities/arcane-school.20JWTam2dn7jjZFV.yaml',
  'pf1/packs/class-abilities/arcane-bond.pW1PNlDcdGl7KuEa.yaml',
  'pf1/packs/class-abilities/bonus-feats-wiz.2h3lI574tmVjOalQ.yaml',
  'pf1/packs/class-abilities/spellbooks-wiz.4wdsdOkgv4uEkS9K.yaml',
  'pf1/packs/class-abilities/scribe-scroll.BS9WDbCy2Up3QHw9.yaml',
  'pf1/packs/class-abilities/cantrips.IPy4aqFYbOppaqKC.yaml',
  'pf1/packs/class-abilities/wizard-spells.LrjNAKP05lZq2tZZ.yaml',
  'pf1/packs/spells/fireball.6oq1wcryviik9ice.yaml',
  'pf1/packs/spells/read-magic.j0bc0iii8zp1jiwr.yaml',
  'pf1/packs/feats/spell-mastery.KlE26ofz7uAkd0IJ.yaml',
  'pf1/packs/feats/scribe-scroll.tlRu8SYjzA7WCHN7.yaml',
  'pf1/packs/feats/craft-magic-arms-and-armor.4hNO4OAWYF5vXphH.yaml',
  'pf1/packs/items/spellbook.onurpjwtdogsedsg.yaml',
];
