// The Source-body family's public word fixture
// (`convex/characterSheetSourceBody.integration.test.ts` releases it): one
// body per word the family's scope certifies, each with one output (a
// discriminated `output`, so a case with none or two doesn't typecheck). A word is
// a Situational Modifier's Situation kind (shared or local), target, bonus
// type and value class, a situational note's target (or none) and
// Situation kind (none, shared or local), or a requirement clause's kind
// (trait-reqs-b: a trait's "Requirements" line, a race or a deity); the
// case's kind (feat, Racial Trait or trait) is its carrier, and a
// requirement's carrier is always a trait. The public test asserts every
// case alike, from its data: the Modifier's contribution listed on exactly
// the statistics its target reaches, the totals unchanged outside its
// Situation and raised by its value inside it; the note on exactly its
// statistics, or on the entry; the requirement refusing its trait while
// unmet and accepting it once met.
// The family's registry entry binds this module by bytes beside the proof
// (`scripts/catalog/launch-source-body.ts`), and the catalog test's coverage
// tie (`tests/catalog/launch-source-body.test.ts`) checks that every word
// the scope certifies is one a case here releases. Each case is shaped as a
// real row that uses its word, named beside it; every Situation is the
// case's own, so it applies that case's body alone.

/** The race whose standard traits are the Racial Trait cases. */
export const wordRace = 'pf1/sourceBodyWordRace';
/** The race a race requirement names: released, never the sheet's at first. */
export const requiredRace = 'pf1/sourceBodyWordRequiredRace';

type Situation = string | { local: string };
export type WordModifier = {
  target: string;
  bonusType: string;
  value: number;
  condition: { situation: Situation };
};
export type WordNote = { text: string; target?: string; situation?: Situation };
/**
 * A requirement clause as the importer emits it for a trait's "Requirements"
 * line: one atom, its kind recorded; a race clause names at least one race.
 */
export type WordRequirement =
  | { race: [string, ...string[]]; kind: 'race' }
  | { deity: string; kind: 'deity' };
/** A body output a case's carrier may hold. */
type BodyOutput =
  | { kind: 'modifier'; modifier: WordModifier }
  | { kind: 'note'; note: WordNote };
/** A requirement output, held only by a trait. */
type RequirementOutput = { kind: 'requirement'; requirement: WordRequirement };
/**
 * A case's one output: a Situational Modifier, a situational note or a
 * requirement clause.
 */
export type WordOutput = BodyOutput | RequirementOutput;
type Carrier = { key: string; name: string };
export type WordCase =
  | (Carrier & {
      /** The carrier. */
      kind: 'feat' | 'racialTrait' | 'trait';
      output: BodyOutput;
    })
  | (Carrier & { kind: 'trait'; output: RequirementOutput });

/**
 * A case's body outputs, as the importer emits them: its one Modifier, its
 * one note or its one requirement clause, a one-item list. The public proof
 * releases them, and the catalog test's word tie reads its words from them.
 */
export function wordOutputs({
  output,
}: Pick<WordCase, 'output'>):
  | { modifiers: [WordModifier] }
  | { situationalNotes: [WordNote] }
  | { prerequisites: [WordRequirement] } {
  switch (output.kind) {
    case 'modifier':
      return { modifiers: [output.modifier] };
    case 'note':
      return { situationalNotes: [output.note] };
    case 'requirement':
      return { prerequisites: [output.requirement] };
  }
}

const keyOf = (kind: WordCase['kind'], id: string) =>
  `${kind === 'feat' ? 'pf1' : 'pf1-content'}/sourceBodyWord${id}`;
/** A case whose one output is a Situational Modifier. */
const modifier = (
  [id, kind]: [string, WordCase['kind']],
  [target, bonusType, value]: [string, string, number],
  situation: Situation,
): WordCase => ({
  key: keyOf(kind, id),
  name: `Word ${id}`,
  kind,
  output: {
    kind: 'modifier',
    modifier: { target, bonusType, value, condition: { situation } },
  },
});
/** A case whose one output is a situational note. */
const note = (
  [id, kind]: [string, WordCase['kind']],
  text: string,
  { target, situation }: { target?: string; situation?: Situation } = {},
): WordCase => ({
  key: keyOf(kind, id),
  name: `Word ${id}`,
  kind,
  output: {
    kind: 'note',
    note: {
      text,
      ...(target ? { target } : {}),
      ...(situation ? { situation } : {}),
    },
  },
});
const local = (name: string) => ({ local: name });
/** A trait case whose one output is a requirement clause. */
const requirement = (id: string, clause: WordRequirement): WordCase => ({
  key: keyOf('trait', id),
  name: `Word ${id}`,
  kind: 'trait',
  output: { kind: 'requirement', requirement: clause },
});

/** The cases, one per certified word. */
export const wordCases: readonly WordCase[] = [
  // Shared Situations.
  // Defensive Training (Dwarf): `ac` +4 dodge against giants.
  modifier(['SharedAcDodge', 'racialTrait'], ['ac', 'dodge', 4], 'giants'),
  // Point-Blank Shot: `attack.ranged` and `damage.ranged` +1 untyped within
  // 30 feet, one word each.
  modifier(
    ['SharedRangedAttackUntyped', 'feat'],
    ['attack.ranged', 'untyped', 1],
    'within30ft',
  ),
  modifier(
    ['SharedRangedDamageUntyped', 'feat'],
    ['damage.ranged', 'untyped', 1],
    'within30ftDamage',
  ),
  // Elven Magic (Elf): `casterLevel` +2 racial against spell resistance.
  modifier(
    ['SharedCasterLevelRacial', 'racialTrait'],
    ['casterLevel', 'racial', 2],
    'spellResistance',
  ),
  // Spell Penetration: `casterLevel` +2 untyped against spell resistance.
  modifier(
    ['SharedCasterLevelUntyped', 'feat'],
    ['casterLevel', 'untyped', 2],
    'spellPenetration',
  ),
  // Gatecrasher: `cmb` +2 untyped to sunder.
  modifier(
    ['SharedCmbUntyped', 'racialTrait'],
    ['cmb', 'untyped', 2],
    'sunder',
  ),
  // Stability (Dwarf): `cmd` +4 racial against a trip on the ground.
  modifier(
    ['SharedCmdRacial', 'racialTrait'],
    ['cmd', 'racial', 4],
    'tripGround',
  ),
  // Elven Immunities: `saves` +2 racial against enchantment.
  modifier(
    ['SharedSavesRacial', 'racialTrait'],
    ['saves', 'racial', 2],
    'enchantment',
  ),
  // Courageous: `saves` +2 trait against fear.
  modifier(['SharedSavesTrait', 'trait'], ['saves', 'trait', 2], 'fear'),
  // Elven Magic (Elf): `skill.spl` +2 racial to identify magic items.
  modifier(
    ['SharedSpellcraftRacial', 'racialTrait'],
    ['skill.spl', 'racial', 2],
    'identifyMagicItems',
  ),
  // Loreseeker: `skill.spl` +2 trait to identify magic items.
  modifier(
    ['SharedSpellcraftTrait', 'trait'],
    ['skill.spl', 'trait', 2],
    'identifyMagicItemsTrait',
  ),
  // Local Situations.
  // Deep Warrior: `ac` +2 dodge against aberrations.
  modifier(
    ['LocalAcDodge', 'racialTrait'],
    ['ac', 'dodge', 2],
    local('against monsters of the aberration type'),
  ),
  // Paired Opportunists: `attack` +4 circumstance.
  modifier(
    ['LocalAttackCircumstance', 'feat'],
    ['attack', 'circumstance', 4],
    local(
      'attacks of opportunity against a creature both you and an adjacent ally with Paired Opportunists threaten',
    ),
  ),
  // Hatred (Dwarf): `attack` +1 racial against orcs.
  modifier(
    ['LocalAttackRacial', 'racialTrait'],
    ['attack', 'racial', 1],
    local('vs. humanoids of the orc subtype'),
  ),
  // Fencer: `attack` +1 trait on attacks of opportunity.
  modifier(
    ['LocalAttackTrait', 'trait'],
    ['attack', 'trait', 1],
    local(
      'on attacks of opportunity made with daggers, swords and similar bladed weapons',
    ),
  ),
  // Hatred (Gnome): `attack` +1 untyped against reptilian humanoids.
  modifier(
    ['LocalAttackUntyped', 'racialTrait'],
    ['attack', 'untyped', 1],
    local('vs. humanoids of the reptilian subtype'),
  ),
  // Spiritual Support: `casterLevel` +1 racial for healing spells on allies.
  modifier(
    ['LocalCasterLevelRacial', 'racialTrait'],
    ['casterLevel', 'racial', 1],
    local('when casting conjuration (healing) spells upon allies'),
  ),
  // Gifted Adept: `casterLevel` +1 untyped with the chosen spell.
  modifier(
    ['LocalCasterLevelUntyped', 'trait'],
    ['casterLevel', 'untyped', 1],
    local('when casting the spell you chose'),
  ),
  // Coordinated Maneuvers: `cmb` +2 competence beside an ally with the feat.
  modifier(
    ['LocalCmbCompetence', 'feat'],
    ['cmb', 'competence', 2],
    local('while adjacent to an ally who also has Coordinated Maneuvers'),
  ),
  // Deep Warrior: `cmb` +2 racial to grapple aberrations.
  modifier(
    ['LocalCmbRacial', 'racialTrait'],
    ['cmb', 'racial', 2],
    local(
      'on combat maneuver checks to grapple aberrations or to continue a grapple with one',
    ),
  ),
  // Relentless: `cmb` +2 untyped to bull rush on the ground.
  modifier(
    ['LocalCmbUntyped', 'racialTrait'],
    ['cmb', 'untyped', 2],
    local(
      'to bull rush an opponent while both you and it are standing on the ground',
    ),
  ),
  // Coordinated Defense: `cmd` +2 competence beside an ally with the feat.
  modifier(
    ['LocalCmdCompetence', 'feat'],
    ['cmd', 'competence', 2],
    local('while adjacent to an ally who also has Coordinated Defense'),
  ),
  // Shielded Caster: `concentration` +4 competence beside an ally with it.
  modifier(
    ['LocalConcentrationCompetence', 'feat'],
    ['concentration', 'competence', 4],
    local('Shielded Caster: adjacent to an ally who also has this feat'),
  ),
  // Arcane Focus: `concentration` +2 racial casting arcane spells
  // defensively.
  modifier(
    ['LocalConcentrationRacial', 'racialTrait'],
    ['concentration', 'racial', 2],
    local('to cast arcane spells defensively'),
  ),
  // Combat Casting: `concentration` +4 untyped casting defensively.
  modifier(
    ['LocalConcentrationUntyped', 'feat'],
    ['concentration', 'untyped', 4],
    local('casting defensively or while grappled'),
  ),
  // Dirty Fighter: `damage` +1 trait when flanking.
  modifier(
    ['LocalDamageTrait', 'trait'],
    ['damage', 'trait', 1],
    local('when you hit a foe you are flanking'),
  ),
  // Divine Warrior: `damage.melee` +1 trait with the chosen weapon.
  modifier(
    ['LocalMeleeDamageTrait', 'trait'],
    ['damage.melee', 'trait', 1],
    local(
      'with the one melee weapon you chose, for the duration of a divine spell you cast that affects it',
    ),
  ),
  // Desert Runner: `save.fort` +4 racial against a forced march.
  modifier(
    ['LocalFortitudeRacial', 'racialTrait'],
    ['save.fort', 'racial', 4],
    local(
      'to avoid fatigue, exhaustion, or ill effects from running, forced marches, starvation, thirst, or hot or cold environments',
    ),
  ),
  // Underfoot: `save.ref` +1 untyped against trample.
  modifier(
    ['LocalReflexUntyped', 'racialTrait'],
    ['save.ref', 'untyped', 1],
    local('to avoid trample attacks'),
  ),
  // Stubborn: `save.will` +2 racial against charms and compulsions.
  modifier(
    ['LocalWillRacial', 'racialTrait'],
    ['save.will', 'racial', 2],
    local(
      'vs. spells and spell-like abilities of the enchantment (charm) and enchantment (compulsion) schools',
    ),
  ),
  // Asmodean Demon Hunter: `save.will` +2 trait against demons' minds.
  modifier(
    ['LocalWillTrait', 'trait'],
    ['save.will', 'trait', 2],
    local('against mind-affecting spells and effects from demons'),
  ),
  // Plagueborn: `saves` +2 racial against disease.
  modifier(
    ['LocalSavesRacial', 'racialTrait'],
    ['saves', 'racial', 2],
    local('against disease'),
  ),
  // History of Heresy: `saves` +1 trait against divine spells.
  modifier(
    ['LocalSavesTrait', 'trait'],
    ['saves', 'trait', 1],
    local(
      'against divine spells, while you have no levels in a class that grants divine spellcasting',
    ),
  ),
  // Greed (Dwarf): `skill.apr` +2 racial on precious goods.
  modifier(
    ['LocalAppraiseRacial', 'racialTrait'],
    ['skill.apr', 'racial', 2],
    local(
      'to determine the price of nonmagical goods containing precious metals or gemstones',
    ),
  ),
  // Charming: `skill.blf` +1 trait on an attracted character.
  modifier(
    ['LocalBluffTrait', 'trait'],
    ['skill.blf', 'trait', 1],
    local('on a character that is (or could be) sexually attracted to you'),
  ),
  // Craftsman: `skill.crf` +2 racial on metal or stone.
  modifier(
    ['LocalCraftRacial', 'racialTrait'],
    ['skill.crf', 'racial', 2],
    local('to create objects from metal or stone'),
  ),
  // Vagabond Child: `skill.dev` +1 trait.
  modifier(
    ['LocalDisableTrait', 'trait'],
    ['skill.dev', 'trait', 1],
    local('if you chose Disable Device'),
  ),
  // Patient Optimist: `skill.dip` +2 trait on an unfriendly creature.
  modifier(
    ['LocalDiplomacyTrait', 'trait'],
    ['skill.dip', 'trait', 2],
    local('to influence a hostile or unfriendly creature'),
  ),
  // Vagabond Child: `skill.esc` +1 trait.
  modifier(
    ['LocalEscapeTrait', 'trait'],
    ['skill.esc', 'trait', 1],
    local('if you chose Escape Artist'),
  ),
  // Asmodean Demon Hunter: `skill.kpl` +3 trait about demons.
  modifier(
    ['LocalPlanesTrait', 'trait'],
    ['skill.kpl', 'trait', 3],
    local('on Knowledge (planes) checks about demons'),
  ),
  // Goldsniffer: `skill.per` +2 trait to notice metals and jewels.
  modifier(
    ['LocalPerceptionTrait', 'trait'],
    ['skill.per', 'trait', 2],
    local('to notice unusual metal or jewels'),
  ),
  // Stonecunning (Dwarf): `skill.per` +2 untyped on unusual stonework.
  modifier(
    ['LocalPerceptionUntyped', 'racialTrait'],
    ['skill.per', 'untyped', 2],
    local('to notice unusual stonework'),
  ),
  // Craftsman: `skill.pro` +2 racial on metal or stone.
  modifier(
    ['LocalProfessionRacial', 'racialTrait'],
    ['skill.pro', 'racial', 2],
    local('on Profession checks to create objects from metal or stone'),
  ),
  // Canter: `skill.sen` +5 trait to intercept a secret message.
  modifier(
    ['LocalSenseMotiveTrait', 'trait'],
    ['skill.sen', 'trait', 5],
    local('to intercept a secret message'),
  ),
  // Vagabond Child: `skill.slt` +1 trait.
  modifier(
    ['LocalSleightTrait', 'trait'],
    ['skill.slt', 'trait', 1],
    local('if you chose Sleight of Hand'),
  ),
  // Starchild: `skill.sur` +4 trait to avoid becoming lost.
  modifier(
    ['LocalSurvivalTrait', 'trait'],
    ['skill.sur', 'trait', 4],
    local('to avoid becoming lost'),
  ),
  // Charming: `spellDC` +1 trait on language-dependent spells.
  modifier(
    ['LocalSpellDcTrait', 'trait'],
    ['spellDC', 'trait', 1],
    local(
      'on language-dependent spells you cast on a character that is (or could be) sexually attracted to you',
    ),
  ),
  // Elemental Focus: `spellDC` +1 untyped with the chosen energy.
  modifier(
    ['LocalSpellDcUntyped', 'feat'],
    ['spellDC', 'untyped', 1],
    local('on spells that deal damage of the energy type you chose'),
  ),
  // Notes.
  // Defensive Training's description note: untargeted, in no Situation.
  note(
    ['NoteUntargeted', 'racialTrait'],
    'Proof word dwarves get a +4 dodge bonus to AC against giants.',
  ),
  // Sky Sentinel: a note on `ac`.
  note(
    ['NoteAc', 'racialTrait'],
    'Enemies on higher ground gain no attack roll bonus against you.',
    { target: 'ac' },
  ),
  // Blind-Fight: a note on `ac` in a local Situation.
  note(
    ['NoteAcLocal', 'feat'],
    'An invisible attacker gets no attack bonus against you in melee.',
    { target: 'ac', situation: local('against invisible attackers in melee') },
  ),
  // Low Blow: a note on `attack`.
  note(
    ['NoteAttack', 'racialTrait'],
    'Gain a +1 bonus on critical confirmation rolls against a prone foe.',
    { target: 'attack' },
  ),
  // Blind-Fight: a note on `attack` in a local Situation.
  note(
    ['NoteAttackLocal', 'feat'],
    'Reroll your miss chance percentile roll one time.',
    {
      target: 'attack',
      situation: local('when you miss because of concealment'),
    },
  ),
  // Warslinger: a note on `attack.ranged`.
  note(
    ['NoteRangedAttack', 'racialTrait'],
    'Reload a sling as a free action.',
    {
      target: 'attack.ranged',
    },
  ),
  // Wary of fear: a note on `saves` in a shared Situation.
  note(
    ['NoteSavesShared', 'racialTrait'],
    'Reroll one failed save against fear each day.',
    { target: 'saves', situation: 'wordFear' },
  ),
  // Stubborn: a note on `save.will`.
  note(
    ['NoteWill', 'racialTrait'],
    'If you fail such a save, you receive another save 1 round later to prematurely end the effect.',
    { target: 'save.will' },
  ),
  // Sociable: a note on `skill.dip`.
  note(
    ['NoteDiplomacy', 'racialTrait'],
    'Attempt a second Diplomacy check against a creature you made hostile.',
    { target: 'skill.dip' },
  ),
  // Starchild: a note on `skill.sur`.
  note(
    ['NoteSurvival', 'trait'],
    'You can automatically determine where true north is.',
    { target: 'skill.sur' },
  ),
  // Brute: a note on `damage`.
  note(
    ['NoteDamage', 'trait'],
    'Whenever you score a critical threat, you add an amount of damage equal to your weapon’s critical modifier.',
    { target: 'damage' },
  ),
  // Flame of the Dawnflower: a note on `damage.melee`.
  note(
    ['NoteMeleeDamage', 'trait'],
    'Whenever you score a critical hit with a scimitar, you deal an additional 2 points of fire damage.',
    { target: 'damage.melee' },
  ),
  // Requirements (trait-reqs-b).
  // Undead Slayer (Dhampir), Failed Apprentice (Half-Elf): a race.
  requirement('RequirementRace', { race: [requiredRace], kind: 'race' }),
  // Divine Warrior (Iomedae): a deity.
  requirement('RequirementDeity', {
    deity: 'Source Body Word Deity',
    kind: 'deity',
  }),
];
