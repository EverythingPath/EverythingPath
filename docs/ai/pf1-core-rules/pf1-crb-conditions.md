# PF1 Core Rulebook Conditions (research for ticket #311)

Paraphrased Open Game License / Pathfinder Reference Document (PRD) content. Not verbatim; numbers and rule structure are preserved, prose is reworded.

- Primary source: the Core Rulebook "Conditions" appendix as mirrored on Archives of Nethys legacy PRD, `https://legacy.aonprd.com/coreRulebook/glossary.html` (section "Conditions"; anchor `#conditions`).
  - NOTE: the URL named in the ticket, `https://legacy.aonprd.com/coreRulebook/conditions.html`, returns HTTP 404. The conditions appendix lives on the CRB glossary page (the "Appendix: Glossary / Conditions" page).
- Supporting sections of the same page, used only where a condition cross-references them (cited per section below): "Fear", "Energy Drain and Negative Levels", "Ability Score Damage, Penalty, and Drain", "Invisibility".
- The d20pfsrd cross-check (`https://www.d20pfsrd.com/gamemastering/conditions/`) was not needed: the primary text was unambiguous for every condition.
- Retrieved 2026-10-03.
- Scope: Core Rulebook only. Conditions introduced in later books (APG, Ultimate books, Bestiary) are not included.

General rule printed at the top of the appendix: if more than one condition affects a character, apply them all; if the effects cannot combine, apply the most severe one.

## 1. Enumerated list (34 conditions)

Bleed, Blinded, Broken, Confused, Cowering, Dazed, Dazzled, Dead, Deafened, Disabled, Dying, Energy Drained, Entangled, Exhausted, Fascinated, Fatigued, Flat-Footed, Frightened, Grappled, Helpless, Incorporeal, Invisible, Nauseated, Panicked, Paralyzed, Petrified, Pinned, Prone, Shaken, Sickened, Stable, Staggered, Stunned, Unconscious.

This matches the 34 names suggested in the ticket exactly; the page lists them alphabetically (Prone appears before Shaken, Stable before Staggered). No additional conditions exist in the CRB appendix. "Fear" (shaken/frightened/panicked) and "Negative levels"/"ability damage" are separate glossary sections, not conditions, but they interact (see section 4).

Conventions used below:
- "Numeric" = a value the character sheet can compute (modifier, score change, speed, AC component). "Nonnumeric" = actions, movement, rules text a sheet can only display as a note/flag.
- The CRB conditions text gives no bonus type for any value below, so all penalties are treated as untyped (stacking with other penalties, per `pf1-rules.md` "Bonus Types and Stacking"); the lone bonus ("+2 bonus on attack rolls" for invisible; "+2 circumstance" for CMD while grappled; "+4" vs prone/helpless) are noted per condition.
- A "-N penalty to Strength/Dexterity" is an ability SCORE penalty. Per the "Ability Score Damage, Penalty, and Drain" section, it behaves like ability damage: every 2 points of penalty is -1 on the skills/statistics based on that ability, and a score penalty cannot reduce the score below 1 (it cannot cause unconsciousness or death). So -4 Dex = Dex score reduced by 4, then recompute the modifier (roughly -2 on Dex-based statistics, but exact result depends on the starting score's parity). A sheet should model this as an effective-score reduction.
- Ability affected statistics (same glossary section): Str penalty affects Str-based skill checks, melee attack rolls, weapon damage rolls (when Str-based), CMB (Small or larger) and CMD. Dex penalty affects Dex-based skill checks, ranged attack rolls, initiative, Reflex saves, AC, CMB (Tiny or smaller) and CMD.

## 2. Per-condition entries

### Bleed
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Bleed)
- Summary: A bleeding creature takes the listed damage at the start of each of its turns. Stopped by a DC 15 Heal check or any spell that cures hit point damage (even if the bleed is ability damage). Some bleeds deal ability damage or ability drain instead of hit points. Bleed effects do not stack unless they deal different kinds of damage; for the same kind, take the worse (ability drain is worse than ability damage).
- Numeric: none on stats. Parameterised damage per turn (amount comes from the source effect): hit points, or ability damage/drain on a named ability. Stop DC 15 (Heal).
- Nonnumeric: recurring start-of-turn damage; ends by Heal check or healing magic.
- Interactions: same-kind bleeds do not stack (take worst); different kinds (hp vs Str damage) stack.
- Not sheet-modelable as a static number: it is a per-turn damage event with a parameter and a removal trigger. A sheet can only record "bleeding N hp/turn" as a tracked effect.

### Blinded
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Blinded)
- Summary: The creature cannot see. Vision-reliant checks and activities fail automatically. All opponents have total concealment against it. To move faster than half speed it must pass a DC 10 Acrobatics check or fall prone. Long-term blindness lets characters adapt and overcome some drawbacks (unspecified).
- Numeric:
  - -2 penalty to Armor Class (AC, touch AC, flat-footed AC all take it by default as an AC penalty).
  - Loses Dexterity bonus to AC (if any). Affects AC and touch AC (flat-footed AC already lacks it).
  - -4 penalty on most Strength- and Dexterity-based skill checks (CRB says "most"; the exceptions are not enumerated).
  - -4 penalty on opposed Perception checks.
  - 50% miss chance for opponents (total concealment), a defensive modifier on opponents' attacks, not a sheet statistic.
- Nonnumeric: sight-based checks/activities (reading, sight Perception) automatically fail; DC 10 Acrobatics to exceed half speed (else prone); adaptation over time is unspecified.
- Interactions: loses Dex bonus to AC, as flat-footed, stunned, cowering and pinned do; the Dex-bonus loss is not cumulative (you can only lose it once).
- Ambiguity: "most Strength- and Dexterity-based skill checks" has no exact list; "opposed Perception" is not defined in the appendix.

### Broken
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Broken)
- Summary: An ITEM condition. Items damaged beyond half their hit points are broken and work less well. Broken items are worth 75% of normal value. Magic items can be repaired only by mending or make whole from a caster of at least the item's caster level; the condition ends when the item is restored to half hit points or more. Mundane items can be repaired similarly or with Craft (typically DC 20 and 1 hour per point of damage; cost one-tenth of item cost).
- Numeric (depends on item type):
  - Weapon: -2 penalty on attack rolls and damage rolls with it; crits only on a natural 20 (the weapon's crit range is reduced to 20) and crit multiplier is only x2.
  - Armor or shield: the AC bonus it grants is halved (round down); armor check penalty is doubled.
  - Tool needed for a skill: -2 penalty on checks made with it.
  - Wand or staff: uses twice as many charges.
  - Other items: no effect on use.
  - All broken items: value 75%.
- Nonnumeric: repair rules.
- Interactions: applies to equipment, not to the character; a sheet would need a per-item "broken" flag that feeds attack/damage/crit range/AC bonus/armor check penalty.
- Note: halving armor AC bonus presumably includes the armor's enhancement bonus (the text says "the bonus it grants to AC", not specifying base vs enhancement). Flag as ambiguous.

### Confused
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Confused)
- Summary: The creature cannot act normally and cannot tell ally from foe (all creatures are treated as enemies). Allies casting a beneficial touch spell on it must succeed on a melee touch attack. If attacked, it attacks whoever last attacked it until that creature is dead or out of sight. At the start of each confused creature's turn roll d%: 01-25 act normally; 26-50 do nothing but babble; 51-75 deal 1d8 + Str modifier damage to self with an item in hand; 76-100 attack the nearest creature (a familiar counts as part of the subject). If the indicated action cannot be carried out the creature babbles. Attackers get no special advantage. A confused creature that is attacked automatically attacks its attackers on its next turn (if still confused). It does not make attacks of opportunity against anything it is not already devoted to attacking.
- Numeric: none on stats. Self-damage 1d8 + Str modifier (event). Percentile behaviour table.
- Nonnumeric: random action per turn, no ally/enemy discrimination, AoO restriction.
- Not sheet-modelable as a number: purely behavioural; track as a flag.

### Cowering
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Cowering)
- Summary: Frozen in fear, can take no actions.
- Numeric: -2 penalty to AC; loses Dexterity bonus to AC (if any).
- Nonnumeric: no actions.
- Interactions: panicked creatures that are cornered cower (see Panicked).

### Dazed
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Dazed)
- Summary: Unable to act normally; can take no actions but suffers no AC penalty. Typically lasts 1 round.
- Numeric: none (explicitly no AC penalty).
- Nonnumeric: no actions; typical duration 1 round.

### Dazzled
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Dazzled)
- Summary: Eyes overstimulated; cannot see well.
- Numeric: -1 penalty on attack rolls; -1 penalty on sight-based Perception checks.
- Nonnumeric: none.

### Dead
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Dead)
- Summary: Reached when hit points drop to a negative amount equal to the Constitution score, Con falls to 0, or the creature is killed outright by a spell/effect. The soul leaves the body. Dead characters cannot be healed normally or magically but can be restored to life by magic. The body decays unless preserved; resurrection restores the body to full health or to its condition at death (depending on the spell/device).
- Numeric: threshold only: dead when hp <= -(Con score), or Con = 0. (See also Energy Drained: dies when negative levels >= Hit Dice; Unconscious: ability damage >= score; Con damage >= Con score = death.)
- Nonnumeric: cannot benefit from normal or magical healing; raisable by magic.
- Sheet-modelable: a derived "is dead" state from hp and Con; otherwise status flag.

### Deafened
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Deafened)
- Summary: Cannot hear. Sound-based Perception checks automatically fail. 20% chance of spell failure on spells with verbal components. Long-term deafness lets characters adapt to some drawbacks.
- Numeric: -4 penalty on initiative checks; -4 penalty on opposed Perception checks; 20% spell failure chance when casting spells with verbal components.
- Nonnumeric: sound-based Perception automatically fails.
- Ambiguity: the 20% failure applies only to verbal-component spells; a sheet must carry component info per spell to apply it.

### Disabled
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Disabled)
- Summary: A character at exactly 0 hp, or with negative hp who is stable and conscious, is disabled. May take a single move action or a standard action each round (not both, no full-round actions) but can take swift, immediate and free actions. Moves at half speed. Move actions are safe; a standard action (or any action the GM deems strenuous, including some free actions such as casting a quickened spell) deals 1 damage after it is completed, unless the action increased hp; the character is then at negative hp and dying. A disabled character with negative hp recovers hp naturally if helped. Otherwise, each day after 8 hours rest, a DC 10 Con check (penalty equal to the negative hp total) starts natural recovery; failure loses 1 hp (but not unconsciousness). Once passed, healing continues and the risk is over.
- Numeric: speed halved; action economy limit; 1 damage per strenuous act; DC 10 Con check daily (penalty = negative hp total).
- Nonnumeric: one move OR one standard action per round, no full-round actions, free/swift/immediate allowed.
- Interactions: entry condition hp = 0 (or negative + stable + conscious); going negative makes the character dying. Stable-then-conscious route: see Stable.

### Dying
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Dying)
- Summary: Unconscious and near death; a creature with negative hp that has not stabilized is dying. It can take no actions. On its next turn after dropping to negative hp (but not dead), and each later turn, it makes a DC 10 Con check to become stable with a penalty equal to its negative hp total; a natural 20 is an automatic success; a stable character need not roll. On a failed check it loses 1 hp. If negative hp equals its Con score it dies.
- Numeric: DC 10 Con check each turn with penalty = |negative hp|; lose 1 hp on failure; dies at hp <= -(Con score).
- Nonnumeric: unconscious, no actions.
- Interactions: Dying -> Stable (success) or Dead (hp reaches -Con); Stable -> Disabled via hourly Con check.

### Energy Drained
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Energy Drained) and "Energy Drain and Negative Levels" section (same page)
- Summary (condition): the character gains one or more negative levels, which may become permanent. If negative levels >= Hit Dice, the character dies.
- Numeric (from the Negative Levels section, since the condition cross-refers to it): per negative level, a cumulative -1 penalty on all ability checks, attack rolls, combat maneuver checks, CMD, saving throws and skill checks; reduces current and total hit points by 5 per negative level; counts as one level lower for level-dependent variables (spellcasting etc.). Spellcasters lose no prepared spells or slots. Death if negative levels >= total Hit Dice.
- Nonnumeric: temporary negative levels allow a new save each day (same DC as the effect) to remove one; permanent level drain (from raise dead etc.) allows no save and is removed by restoration. Creatures with permanent negative levels equal to HD need a restoration to be raised.
- Sheet touches: attacks, CMB, CMD, all saves, all skills, ability checks, max/current hp (-5/level), effective level for caster-level-like stats. This is the only core condition with a per-instance count; "stack" = count of negative levels (the -1 per level is cumulative).

### Entangled
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Entangled)
- Summary: Ensnared. Movement is impeded but not prevented unless the bonds are anchored to an immobile object or opposing force. Speed halved; cannot run or charge. A spell cast while entangled needs a concentration check (DC 15 + spell level) or the spell is lost.
- Numeric: speed x1/2; -2 penalty on all attack rolls; -4 penalty to Dexterity (score penalty, see conventions); concentration DC 15 + spell level.
- Nonnumeric: cannot run or charge.
- Interactions: Dex penalty reduces AC, Reflex, initiative, Dex skills, ranged attacks. Similar to but distinct from Grappled (no stacking rule is stated between the two; see ambiguities).

### Exhausted
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Exhausted)
- Summary: Moves at half speed, cannot run or charge, -6 to Strength and Dexterity. After 1 hour of complete rest it becomes fatigued. A fatigued character becomes exhausted by doing something that would normally cause fatigue.
- Numeric: speed x1/2; -6 penalty to Strength; -6 penalty to Dexterity.
- Nonnumeric: cannot run or charge.
- Interactions: replaces fatigued (do not add fatigued's -2 on top); recovers to fatigued after 1 hour rest, then to normal after 8 hours rest as fatigued.

### Fascinated
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Fascinated)
- Summary: Entranced by a supernatural or spell effect. Stands or sits quietly, taking no actions except paying attention to the effect, for its duration. Any potential threat (e.g. a hostile creature approaching) grants a new saving throw. An obvious threat (drawing a weapon, casting a spell, aiming a ranged weapon at it) automatically breaks the effect. An ally can shake it free as a standard action.
- Numeric: -4 penalty on skill checks made as reactions (such as Perception).
- Nonnumeric: no actions other than paying attention; new save on potential threat; auto-break on obvious threat; ally can end it as a standard action.

### Fatigued
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Fatigued)
- Summary: Can neither run nor charge; -2 to Strength and Dexterity. Doing anything that would normally cause fatigue makes the character exhausted. After 8 hours of complete rest, fatigue ends.
- Numeric: -2 penalty to Strength; -2 penalty to Dexterity.
- Nonnumeric: cannot run or charge.
- Interactions: escalates to Exhausted; Exhausted supersedes it (do not stack -2 and -6).

### Flat-Footed
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Flat-Footed)
- Summary: A character who has not yet acted during a combat is flat-footed: unable to react normally. Loses the Dexterity bonus to AC (if any) and cannot make attacks of opportunity.
- Numeric: loses Dex bonus to AC (AC and CMD interplay: this condition text mentions AC only; the CRB combat rules also drop Dex bonus to CMD when flat-footed, outside this appendix).
- Nonnumeric: no attacks of opportunity; ends once the character has acted.
- Derived statistic: "flat-footed AC" is a standard sheet figure (AC without Dex bonus, and without dodge bonuses per the Armor Class rules).

### Frightened
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Frightened; Fear section)
- Summary: Flees from the source of its fear as best it can; if it cannot flee, it may fight. It can use special abilities, including spells, to flee and must do so if that is the only way to escape. Frightened is like shaken, except the creature must flee if possible; panicked is more extreme. (Fear section: frightened characters are also shaken; they may choose their path; once out of sight/hearing of the source they act freely, but can be forced to flee again if the source re-appears; unable-to-flee characters fight but remain shaken.)
- Numeric: -2 penalty on all attack rolls, saving throws, skill checks and ability checks.
- Nonnumeric: must flee the source of fear if possible.
- Interactions: includes the shaken penalty (does not add another -2). Escalates to panicked.

### Grappled
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Grappled)
- Summary: Restrained by a creature, trap or effect. Cannot move; no action that requires two hands. Spell or spell-like ability use requires a concentration check (DC 10 + grappler's CMB + spell level) or the spell is lost. No attacks of opportunity. Cannot use Stealth to hide from the grappling creature, even with hide in plain sight. If it becomes invisible it gains a +2 circumstance bonus on CMD against being grappled and no other benefit.
- Numeric: -4 penalty to Dexterity (score penalty); -2 penalty on all attack rolls and combat maneuver checks (except checks made to grapple or escape a grapple); concentration DC 10 + grappler's CMB + spell level; +2 circumstance bonus to CMD against being grappled if it becomes invisible.
- Nonnumeric: cannot move; no two-handed actions; no AoOs; cannot Stealth against grappler.
- Interactions: Pinned is a more severe version; the two do not stack.

### Helpless
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Helpless)
- Summary: Paralyzed, held, bound, sleeping, unconscious or otherwise completely at an opponent's mercy. Treated as having Dexterity 0 (-5 modifier). Melee attacks against it gain +4 (as against a prone target); ranged attacks get no special bonus. Rogues can sneak attack it. As a full-round action an enemy can deliver a coup de grace with a melee weapon (or bow/crossbow if adjacent): automatic hit and automatic critical (rogue also adds sneak attack); the defender must pass a Fortitude save (DC 10 + damage dealt) or die. Coup de grace provokes attacks of opportunity. Creatures immune to critical hits take no critical damage and need not save.
- Numeric: effective Dex 0 (Dex modifier -5) used for AC, Reflex etc.; +4 bonus to attackers' melee attack rolls; coup de grace Fort DC = 10 + damage.
- Nonnumeric: coup de grace rules, sneak attack eligibility.
- Ambiguity: "treated as Dex 0" differs from "lose Dex bonus": it can reduce AC below the flat-footed level (a -5 Dex modifier applies, even if the character had no bonus). Whether that -5 also hits Reflex and initiative is implied but not stated in the appendix.

### Incorporeal
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Incorporeal)
- Summary: No physical body. Immune to all nonmagical attack forms. Takes half damage (50%) from magic weapons, spells, spell-like effects and supernatural effects. Takes full damage from other incorporeal creatures and effects, and from all force effects.
- Numeric: 50% damage multiplier from the listed sources (defensive modifier, not a sheet statistic).
- Nonnumeric: nonmagical immunity; full damage from incorporeal and force.
- Not sheet-modelable as a character number: a creature/monster trait, relevant to damage resolution only.

### Invisible
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Invisible; Invisibility section)
- Summary: Visually undetectable. Gains a +2 bonus on attack rolls against sighted opponents and ignores its opponents' Dexterity bonuses to AC (if any). Invisibility section: it can still be heard, smelled or felt; vision-based detection (including darkvision) fails; immune to sneak attack extra damage and ranger favored-enemy extra damage but not immune to critical hits; notice DC 20 Perception within 30 ft; pinpointing is +20 DC; total concealment (50% miss chance) even after pinpointing.
- Numeric: +2 bonus on attack rolls vs sighted opponents (type not stated, treat as untyped); target's Dex bonus to AC ignored by the invisible attacker (opponents' AC against it is calculated without Dex bonus); total concealment (50% miss chance) for attackers; Perception DC modifiers (see source table).
- Nonnumeric: detection rules; immunity to sneak attack and favored-enemy bonuses.

### Nauseated
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Nauseated)
- Summary: Stomach distress. Cannot attack, cast spells, concentrate on spells, or do anything requiring attention. The only action allowed is a single move action per turn.
- Numeric: none.
- Nonnumeric: attacks, spellcasting, concentration and attention-requiring actions are forbidden; one move action per turn only.

### Panicked
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Panicked; Fear section)
- Summary: Must drop whatever it is holding and flee at top speed from the source of fear and from any other dangers, along a random path. Cannot take any other actions. If cornered it cowers and does not attack, typically using the total defense action. May use special abilities, including spells, to flee (and must if that is the only way). The Fear section adds: panicked characters are also shaken; once out of sight/hearing of danger they can act as they want.
- Numeric: -2 penalty on all saving throws, skill checks and ability checks. The appendix entry lists NO attack-roll penalty (compare shaken/frightened); the Fear section's "also shaken" wording would add attack rolls (see ambiguities).
- Nonnumeric: drop held items; flee along a random path; no other actions; cowers when cornered.
- Interactions: shaken < frightened < panicked; escalates from both; cornered panicked creatures are effectively cowering (-2 AC, no Dex bonus) per Cowering.

### Paralyzed
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Paralyzed)
- Summary: Frozen in place, unable to move or act. Effective Dexterity and Strength scores of 0; helpless; can take purely mental actions. A flying winged creature falls; a swimmer cannot swim and may drown. Others can move through its square (counts as 2 squares each).
- Numeric: Str 0 and Dex 0 (modifiers -5 each); plus everything under Helpless (+4 to melee attacks against it, etc.).
- Nonnumeric: no physical actions, mental actions only; falls if flying; movement through its square costs double.
- Sheet touches: Str-based statistics (melee attack, damage, CMB, CMD), Dex-based statistics (AC, Reflex, initiative, ranged attack, CMD), and the helpless modifiers.

### Petrified
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Petrified)
- Summary: Turned to stone and considered unconscious. If the stone body cracks or breaks but the broken pieces are rejoined when returned to flesh, the character is unharmed; an incomplete body returns incomplete with possible permanent hp loss and/or debilitation.
- Numeric: none directly (treated as unconscious, which is helpless).
- Nonnumeric: unconscious; damage to the statue carries over on restoration.
- Not sheet-modelable as numbers: statue damage consequences are open-ended GM adjudication.

### Pinned
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Pinned)
- Summary: Tightly bound; can take few actions. Cannot move and is denied its Dexterity bonus (to AC). Takes an additional -4 penalty to AC. Can always try to free itself (combat maneuver or Escape Artist). Can take verbal and mental actions but cannot cast spells with somatic or material components. Spell or spell-like ability use needs a concentration check (DC 10 + grappler's CMB + spell level). Pinned is a more severe version of grappled; their effects do not stack.
- Numeric: denied Dex bonus to AC; -4 penalty to AC; concentration DC 10 + grappler's CMB + spell level.
- Nonnumeric: no movement; only verbal and mental actions; spells limited to those without somatic/material components; may attempt to escape.
- Interactions: replaces grappled (no stacking), so do not also apply grappled's -4 Dex, -2 attack, etc. (ambiguity: the pinned entry itself lists none of grappled's numbers, and "do not stack" is read as pinned superseding grappled).

### Prone
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Prone)
- Summary: Lying on the ground. A prone attacker takes -4 on melee attack rolls and cannot use a ranged weapon (except a crossbow). A prone defender gains +4 AC against ranged attacks but takes -4 AC against melee attacks. Standing up is a move-equivalent action that provokes an attack of opportunity.
- Numeric: -4 penalty on melee attack rolls; +4 bonus to AC vs ranged attacks; -4 penalty to AC vs melee attacks (these are situational, not applied to the base AC figure).
- Nonnumeric: cannot use ranged weapons except crossbows; standing takes a move-equivalent action and provokes an AoO.
- Interactions: helpless targets get melee attackers the same +4 as a prone target; fall results from failed Acrobatics when blinded.
- Note: the CRB entry gives no bonus type for the AC bonus; treat as untyped (the bonus-type table in the pack does not classify it).

### Shaken
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Shaken; Fear section)
- Summary: Less severe fear state than frightened or panicked.
- Numeric: -2 penalty on attack rolls, saving throws, skill checks and ability checks.
- Nonnumeric: none.
- Interactions: shaken + shaken -> frightened; shaken + frightened -> panicked (see section 4).

### Sickened
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Sickened)
- Summary: The character feels ill.
- Numeric: -2 penalty on all attack rolls, weapon damage rolls, saving throws, skill checks and ability checks.
- Nonnumeric: none.
- Interactions: not a fear condition; no escalation. Its -2 overlaps shaken/frightened on attacks, saves, skills and ability checks (stacking is unaddressed, see ambiguities); sickened additionally covers weapon damage rolls.

### Stable
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Stable)
- Summary: A formerly dying character that has stopped losing hp each round but still has negative hp is stable: no longer dying, but unconscious. If stabilized by another's aid (Heal check or magical healing), it no longer loses hp, and each hour it can make a DC 10 Con check (penalty = negative hp total) to become conscious and disabled (hp still negative). If it stabilized on its own without help, it still risks losing hp: each hour it makes a Con check to become stable "as if aided", and each failure costs 1 hp.
- Numeric: hourly DC 10 Con check with penalty = |negative hp|; failure (self-stabilized only) = -1 hp.
- Nonnumeric: unconscious.
- Interactions: Dying -> Stable -> Disabled.

### Staggered
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Staggered)
- Summary: May take a single move action or standard action each round (not both, no full-round actions); can still take free, swift and immediate actions. A creature whose nonlethal damage exactly equals its current hit points becomes staggered.
- Numeric: trigger condition nonlethal damage == current hp (derived from nonlethal damage and hp).
- Nonnumeric: action limit as above.
- Interactions: nonlethal damage > current hp -> unconscious.

### Stunned
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Stunned)
- Summary: Drops everything held, can't take actions.
- Numeric: -2 penalty to AC; loses Dex bonus to AC (if any).
- Nonnumeric: drops held items; no actions.

### Unconscious
- Source: https://legacy.aonprd.com/coreRulebook/glossary.html (Conditions: Unconscious)
- Summary: Knocked out and helpless. Caused by negative hit points (but not more than the creature's Con score) or nonlethal damage in excess of current hp.
- Numeric: trigger thresholds (hp < 0 and > -Con; nonlethal > current hp); implies all Helpless numbers (effective Dex 0, +4 to melee attacks against it). Ability damage >= ability score also causes unconsciousness (Con damage >= Con score kills instead), per the ability damage section.
- Nonnumeric: no actions; helpless.

## 3. Numeric effects grouped by sheet statistic

Penalties are untyped unless stated; "Dex bonus lost" means the character's Dex modifier is not added to AC when positive.

| Statistic | Conditions and values |
|---|---|
| Attack rolls | Dazzled -1; Entangled -2; Frightened -2; Grappled -2 (and combat maneuver checks except grapple/escape); Shaken -2; Sickened -2; Prone -4 (melee only); Invisible +2 (vs sighted); Broken weapon -2; Energy Drained -1 per negative level |
| Weapon damage rolls | Sickened -2; Broken weapon -2 |
| Armor Class | Blinded -2; Cowering -2; Stunned -2; Pinned -4; Prone +4 vs ranged / -4 vs melee |
| Lose Dex bonus to AC | Blinded; Cowering; Flat-Footed; Pinned (denied); Stunned; opponents of an Invisible attacker |
| Effective Dex / Str | Fatigued Str -2 Dex -2; Exhausted Str -6 Dex -6; Entangled Dex -4; Grappled Dex -4; Helpless Dex 0; Paralyzed Str 0 Dex 0 |
| Saving throws | Frightened -2; Panicked -2; Shaken -2; Sickened -2; Energy Drained -1 per level (plus Dex-based Reflex via the Dex penalties above) |
| Skill checks | Frightened -2; Panicked -2; Shaken -2; Sickened -2; Fascinated -4 (reactions); Blinded -4 (most Str/Dex-based); Energy Drained -1 per level; Broken tool -2 |
| Ability checks | Frightened -2; Panicked -2; Shaken -2; Sickened -2; Energy Drained -1 per level |
| Perception | Blinded -4 (opposed); Deafened -4 (opposed); Dazzled -1 (sight-based); Fascinated -4 (as reaction) |
| Initiative | Deafened -4 (plus Dex penalties from other conditions) |
| Speed | Disabled x1/2; Entangled x1/2; Exhausted x1/2 |
| CMB / CMD | Energy Drained -1 per level (both); Grappled +2 circumstance to CMD vs being grappled if invisible; Str/Dex penalties change CMB/CMD indirectly |
| Hit points | Energy Drained -5 per negative level (current and total) |
| Spell failure / casting | Deafened 20% failure on verbal spells; Entangled concentration DC 15 + spell level; Grappled/Pinned concentration DC 10 + grappler's CMB + spell level |
| Armor / shield (Broken) | AC bonus halved (round down); armor check penalty doubled |

## 4. Interactions and escalations

- Fatigue chain: Fatigued (-2 Str/Dex, no run/charge) -> Exhausted (-6 Str/Dex, half speed, no run/charge) if the character again does something that would cause fatigue. Exhausted replaces fatigued. Exhausted -> fatigued after 1 hour complete rest; fatigued -> normal after 8 hours complete rest.
- Fear chain (Fear section): shaken + shaken -> frightened; shaken + frightened -> panicked; frightened + shaken or frightened -> panicked. Fear effects are cumulative in this escalating sense: you do NOT add penalties; you move up the ladder. Frightened and panicked characters are also shaken (the -2 does not repeat). Panicked cornered -> cowers.
- Grapple chain: Grappled -> Pinned (more severe; effects do not stack).
- Hit point chain: 0 hp -> Disabled; negative hp -> Dying (unconscious, no actions); Dying -> Stable (DC 10 Con) or Dead (hp <= -Con); Stable -> conscious + Disabled (hourly DC 10 Con check). Nonlethal damage == hp -> Staggered; nonlethal > hp -> Unconscious.
- Negative levels: negative levels >= Hit Dice -> Dead. Ability damage >= score -> unconscious (Con: dead).
- Helpless is a umbrella: paralyzed, held, bound, sleeping, unconscious (and petrified, which counts as unconscious) are helpless.
- Dex-bonus loss: blinded, cowering, flat-footed, pinned, stunned each make the character lose the Dex bonus to AC; this only needs to be applied once.
- General appendix rule: all applicable conditions apply; if effects cannot combine, apply the most severe.

## 5. Items that cannot be modelled as a sheet number

- Behavioural/action restrictions: Confused (random behaviour table), Cowering, Dazed, Dying, Fascinated, Frightened, Nauseated, Panicked, Paralyzed, Pinned, Staggered, Stunned, Disabled, Grappled, Entangled (no run/charge), Prone (ranged weapon limits), Fatigued/Exhausted (no run/charge).
- Event-based or per-turn effects: Bleed (damage each turn), Dying and Stable (Con checks), Disabled (damage on strenuous action).
- Opponent-facing effects (not the creature's own statistics): Blinded (total concealment for opponents), Invisible (miss chance, ignoring opponents' Dex bonus), Helpless (+4 melee to attackers, coup de grace), Prone (AC bonus/penalty by attack type), Incorporeal (damage scaling and immunities).
- Item condition: Broken applies to equipment, not to the character.
- Open-ended: Petrified statue damage; Dead resurrection details; Blinded/Deafened adaptation over time.

## 6. Summary table

| Condition | Numeric modifiers | Nonnumeric notes | Escalates to |
|---|---|---|---|
| Bleed | N hp (or ability dmg/drain) at start of each turn | Stops with DC 15 Heal or healing spell; same-kind bleeds do not stack | Dying/Dead via hp loss |
| Blinded | -2 AC; lose Dex bonus to AC; -4 most Str/Dex skills; -4 opposed Perception | Sight-based checks auto-fail; opponents have total concealment; DC 10 Acrobatics above half speed or fall prone | Prone (on failed Acrobatics) |
| Broken | Weapon -2 attack/damage, crit only on 20 and x2; armor/shield AC bonus halved, ACP doubled; tool -2; wand/staff double charges; value 75% | Item condition; repair via mending/make whole or Craft DC 20 | None |
| Confused | None (1d8 + Str mod self-damage on 51-75) | Random behaviour per turn; all creatures treated as enemies; limited AoOs | None |
| Cowering | -2 AC; lose Dex bonus | No actions | None |
| Dazed | None | No actions; typically 1 round | None |
| Dazzled | -1 attack; -1 sight-based Perception | None | None |
| Dead | hp <= -Con or Con 0 | No healing; raisable by magic | None |
| Deafened | -4 initiative; -4 opposed Perception; 20% spell failure (verbal) | Sound Perception auto-fails | None |
| Disabled | Speed x1/2; 1 damage per strenuous act; DC 10 Con daily | One move or standard action; no full-round | Dying (if damage drops hp below 0) |
| Dying | DC 10 Con check each turn (penalty = negative hp); -1 hp on failure | Unconscious; no actions | Stable or Dead |
| Energy Drained | -1 per negative level on attacks, CMB, CMD, saves, skills, ability checks; -5 hp per level; effective level -1 per level | Daily save to remove temporary levels; death at levels >= HD | Dead |
| Entangled | Speed x1/2; -2 attack; -4 Dex; concentration DC 15 + spell level | No run/charge | None stated |
| Exhausted | Speed x1/2; -6 Str; -6 Dex | No run/charge; 1 hr rest -> fatigued | Fatigued (rest) |
| Fascinated | -4 on reaction skill checks (e.g. Perception) | No actions except paying attention; new save on threats; auto-broken by obvious threat | None |
| Fatigued | -2 Str; -2 Dex | No run/charge; 8 hr rest ends | Exhausted |
| Flat-Footed | Lose Dex bonus to AC | No AoOs; ends after first action | None |
| Frightened | -2 attack, saves, skills, ability checks | Must flee if possible; fights if cornered (still shaken) | Panicked |
| Grappled | -4 Dex; -2 attack and combat maneuvers (except grapple/escape); concentration DC 10 + grappler CMB + spell level; +2 CMD vs grapple if invisible | Cannot move; no two-handed actions; no AoOs; cannot Stealth against grappler | Pinned |
| Helpless | Dex 0 (-5 mod); +4 to melee attacks against it | Coup de grace (Fort DC 10 + damage or die); sneak attack allowed | None |
| Incorporeal | 50% damage from magical sources (full from force/incorporeal) | Immune to nonmagical attacks | None |
| Invisible | +2 attack vs sighted; ignores opponents' Dex bonus to AC | Total concealment; immune to sneak attack/favored enemy extra damage | None |
| Nauseated | None | Only a single move action per turn; no attacks/spells/concentration | None |
| Panicked | -2 saves, skills, ability checks | Drop held items; flee randomly at top speed; cowers if cornered | Cowering when cornered |
| Paralyzed | Str 0, Dex 0; helpless numbers | Mental actions only; flyers fall; movement through square costs 2 | None |
| Petrified | None (counts as unconscious) | Stone; statue damage carries over | None |
| Pinned | Denied Dex bonus to AC; -4 AC; concentration DC 10 + grappler CMB + spell level | No movement; verbal/mental actions only; no somatic/material spells | None (supersedes grappled) |
| Prone | -4 melee attack; +4 AC vs ranged; -4 AC vs melee | No ranged weapons except crossbow; standing is a move-equivalent action that provokes AoO | None |
| Shaken | -2 attack, saves, skills, ability checks | None | Frightened/Panicked (on repeat fear) |
| Sickened | -2 attack, weapon damage, saves, skills, ability checks | None | None |
| Stable | DC 10 Con hourly (penalty = negative hp); -1 hp on failure if self-stabilized | Unconscious | Disabled (conscious) |
| Staggered | Trigger: nonlethal damage == current hp | One move or standard action; no full-round | Unconscious (nonlethal > hp) |
| Stunned | -2 AC; lose Dex bonus | Drops held items; no actions | None |
| Unconscious | Helpless numbers; thresholds hp < 0 and > -Con or nonlethal > hp | No actions; helpless | Dying/Dead via hp |

## 7. Ambiguities and gaps

1. The ticket URL `.../coreRulebook/conditions.html` is a 404; the conditions are under `glossary.html`. Use that URL as the citation.
2. No bonus types are printed for any condition value. Penalties are untyped; the +2 (invisible) and +4 (prone/helpless) bonuses have no stated type. Only the +2 grappled/invisible CMD bonus is typed (circumstance).
3. Stacking between different conditions with the same penalty (shaken + sickened, sickened + frightened, entangled + grappled Dex -4 each) is not stated explicitly beyond the general rule "apply them all; if they cannot combine, apply the most severe". The pack's penalty-stacking resolution (untyped penalties stack) implies sickened + shaken = -4; fear conditions among themselves are the exception (they escalate). Entangled + grappled would stack Dex -8 under that reading; the CRB does not say otherwise.
4. Panicked: the appendix lists -2 on saves, skills and ability checks but not on attack rolls, while the Fear section says panicked characters are "also shaken" (which includes -2 attack). A sheet should either include -2 attack (via Fear section) or omit it (appendix text). The appendix text is the closest reading of the condition itself; flag for a decision.
5. Frightened: the appendix says -2 on attacks, saves, skills and ability checks (same as shaken) so "also shaken" adds nothing numerically.
6. Blinded "most Strength- and Dexterity-based skill checks": exceptions are not enumerated. Dexterity-based Reflex saves and initiative are not listed.
7. Flat-footed/Cowering/Stunned/Blinded: "Dex bonus to AC" only; whether it also removes dodge bonuses is not in this appendix (AC rules elsewhere). CMD loss of Dex bonus is not in the appendix either.
8. Helpless/Paralyzed: Dex 0 gives a -5 Dex modifier (a penalty, not just a lost bonus). Paralyzed also sets Str 0 (-5). These reduce Reflex, initiative, melee attack/damage and CMB/CMD in principle; the appendix does not list every derived statistic.
9. Broken armor: "the bonus it grants to AC is halved" does not say whether the enchantment bonus is included.
10. Staggered and Unconscious thresholds depend on tracking nonlethal damage separately from hit points.
11. Fatigued/Exhausted "doing anything that would normally cause fatigue" is not defined in the appendix (examples exist in class abilities such as barbarian rage ending).
12. Incorporeal and Broken are not character-state numbers in the usual sense (a monster trait and an item state).
