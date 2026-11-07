# Ironfang Invasion Militia Rules

This document reorganizes the militia subsystem into searchable sections and normalized headings.

## Scope

- Intended for the Ironfang Invasion Adventure Path.
- A militia never exceeds the highest-level PC.
- Bonus teams from rewards do not count against normal maximum teams.
- Siege of Stone and Prisoners of the Blight especially encourage proxy NPC officers.

## Militia Terminology

### Rank

- Starts at rank 1, can progress to rank 20 (subject to level cap).
- Affects checks, actions/week, max teams, and PC boons.
- Rank increases from training thresholds (see `militia-tables.md`).
- Rank never decreases, even if training later drops.

### Maximum Rank

- Militia rank cannot exceed the level of the most experienced PC.

### Organization Checks

- Loyalty: diplomacy/recovery/morale; used for Drill Militia.
- Secrecy: covert operations and stealthy tasks.
- Security: intimidation/resilience/battle/sickness recovery.
- Base bonuses come from rank and focus; officers modify them.

### Focus

- One check is chosen as focused at militia creation.
- Focused check advances faster than two secondary checks.

### Training

- Starts at 0.
- Main growth source: Drill Militia action.
- Upkeep attrition and events may raise/lower training.
- Training increases can cause rank gains; training losses do not lower rank.

### Reputation

- Tracked per settlement where militia operates.
- Reputation states: Hostile, Unfriendly, Indifferent, Friendly, Helpful.
- Secured settlement: enemy fortifications present.
- Reduce Danger can improve reputation in secured settlements.

### Treasury

- Starts at 10 gp.
- Used for actions, recruitment, upgrades, event costs.
- Officers can deposit/withdraw during Upkeep step 5. The application stages deposits and withdrawals without choosing an officer; see the application departure under [Step 5: Deposits and Withdrawals](#step-5-deposits-and-withdrawals).

### Minimum Treasury

- `rank x 10 gp`.
- If treasury falls below minimum during Upkeep, militia loses training.

### Notoriety

- Range 0 to 100.
- Drives weekly event chance.
- Can rise from risky actions and bad outcomes.
- At Notoriety 100, special Upkeep penalties apply.

### Militia Actions

- Actions/week based on rank, modified by Strategist/allies/events.
- Teams typically perform one action each per Activity phase.

### Event Chance

- Event phase uses percentile roll.
- Event occurs if roll is lower than event chance.
- Event chance is primarily Notoriety (min 10%, max 95%).
- After a week with no event, next week gains `+rank` chance.

### Active and Persistent Events

- Track active events until resolved.
- Persistent events continue until ended by mitigation or special spending.

### Officers and Teams Management

- Officer name and bonuses should be tracked explicitly.
- Team manager limits:
  - PC or officer NPC: up to Charisma modifier teams (minimum 1).
  - Non-officer: one team.
- Team actions add manager Charisma bonus to required organization checks.
- Application note (approved in [#112](https://github.com/AndreasUnunger/EverythingPath/issues/112#issuecomment-5836835106), Ruleset Version 8): an NPC counts as an officer exactly while holding at least one officer role in the roster the rules evaluate, including earlier officer changes that week; a stored character kind never decides it. Going over a lowered limit during the week needs a reasoned Rules Exception. Weeks confirmed under earlier Ruleset Versions keep their recorded limits and warnings.

### Maximum Teams

- Rank-based cap (see Table 6-1).
- Bonus teams do not count against cap.

## PC Boons by Rank

- Ranks 2, 7, 12, 17: Skilled (bonus skill rank per PC).
- Ranks 3, 6, 8, 11, 13, 16, 18: Gift (type/value by rank).
- Ranks 4, 9, 14, 19: Title + bonus feat package.
- Ranks 5, 10, 15, 20: XP story award split among PCs.
- Boons apply only to PCs, not NPC officers/cohorts.

### Title Feat Packages

- Director (rank 4): Alertness, Deceitful, Persuasive, or Stealthy.
- Captain (rank 9): Great Fortitude, Iron Will, or Lightning Reflexes.
- Commander (rank 14): Fleet, Improved Initiative, or Toughness.
- Champion (rank 19): any feat the PC qualifies for.

## Officers

Multiple officers can fill the same role, but their bonuses do not stack (except for the commandant, per the source rules).

### Ambassador

- Adds Constitution or Charisma modifier to militia Loyalty checks.

### Commandant

- On successful Drill Militia Loyalty check, training gained increases by commandant Hit Dice.
- Application departure (approved in [#112](https://github.com/AndreasUnunger/EverythingPath/issues/112#issuecomment-5836835106), Ruleset Version 8): a commandant's Hit Dice are the roster's explicit Hit Dice override, zero included, or else the character's level; Hit Dice are no longer required before the week. Weeks confirmed under earlier Ruleset Versions keep their recorded training.
- Prepared application change ([#205](https://github.com/AndreasUnunger/EverythingPath/issues/205), [#312](https://github.com/AndreasUnunger/EverythingPath/issues/312), reserved Ruleset Version 10): a commandant without an override uses Class Levels plus fixed racial Hit Dice from ordinary permanent Character Sheet facts. An explicit zero override still counts as zero. Frozen snapshots without racial facts use zero racial Hit Dice. This change is prepared only in isolated fixture campaigns; production retains legacy Character authority and active Ruleset Version 9 until the initial Character Sheet cutover activates version 10 and requires a fresh weekly review. Old records retain their frozen facts and versions.

### Marshal

- Adds Strength or Wisdom modifier to militia Security checks.

### Overseer

- Grants +1 bonus to both secondary checks.
- During the resolution of one chosen event, can add the appropriate modifier to its organization checks:
  - Charisma/Constitution to Loyalty, or
  - Strength/Wisdom to Security, or
  - Dexterity/Intelligence to Secrecy.

### Spymaster

- Adds Dexterity or Intelligence modifier to Secrecy checks.

### Strategist

- Grants +1 bonus militia action in Activity phase.
- Bonus action receives +2 on related organization checks.

## Teams

- Categories: Espionage, Intelligence, Military, Treasury.
- New teams are recruited at tier 1.
- Tier 1 upgrades to tier 2, then tier 3 branches.
- Upgraded teams retain previously granted actions.
- Recruited tier 1 team can act immediately if actions remain.
- Newly upgraded tier 2/3 team cannot act that same Activity phase.

### Team Conditions

#### Disabled

- Team cannot act during Activity phase.
- Recover at start of Upkeep by paying current minimum treasury value.
- GM can allow narrative recovery alternatives.

#### Missing

- Still counts against team cap.
- Cannot act during Activity phase.
- Start of Upkeep: DC 15 Security check to return at end of week.
- Natural 1 on that check: team is permanently lost.

## Team Trees

### Espionage

- Moles (T1): Recruitment Secrecy DC 15; action `Secure Cache`; size 3; upgrades to Propagandists.
- Propagandists (T2): Cost 250 gp; actions `Secure Cache`, `Spread Propaganda`; size 3; from Moles.
- Saboteurs (T3): Cost 1,000 gp; actions `Sabotage`, `Secure Cache`, `Spread Propaganda`; size 3; from Propagandists.
- Spies (T3): Cost 1,000 gp; actions `Covert Action`, `Secure Cache`, `Spread Propaganda`; size 3; from Propagandists.

### Intelligence

- Informants (T1): Recruitment Loyalty DC 10; action `Gather Information`; size 6; upgrades to Conspirators.
- Conspirators (T2): Cost 250 gp; actions `Activate Refuge`, `Gather Information`; size 6; from Informants.
- Scholars (T3): Cost 1,000 gp; actions `Activate Refuge`, `Gather Information`, `Knowledge Check`; size 6; from Conspirators.
- Spellcasters (T3): Cost 1,000 gp; actions `Activate Refuge`, `Gather Information`, `Restore Character`; size 6; from Conspirators.

### Military

- Defenders (T1): Recruitment Security DC 15; action `Reduce Danger`; size 6; upgrades to Infiltrators.
- Infiltrators (T2): Cost 250 gp; actions `Reduce Danger`, `Rescue Character`; size 6; from Defenders.
- Guardians (T3): Cost 1,000 gp; actions `Manipulate Events`, `Reduce Danger`, `Rescue Character`; size 6; from Infiltrators.
- Specialists (T3): Cost 1,000 gp; actions `Reduce Danger`, `Rescue Character`, `Strike Team`; size 6; from Infiltrators.

### Treasury

- Patrons (T1): Recruitment Loyalty DC 10; action `Earn Gold`; size 6; upgrades to Merchants.
- Merchants (T2): Cost 50 gp; actions `Broker Market`, `Earn Gold`; size 6; from Patrons.
- Black Marketeers (T3): Cost 200 gp; actions `Activate Black Market`, `Broker Market`, `Earn Gold`; size 6; from Merchants.
- Fixers (T3): Cost 200 gp; actions `Broker Market`, `Earn Gold`, `Special Order`; size 6; from Merchants.

## Weekly Sequence (Militias in Play)

Order is fixed each week:
1. Upkeep
2. Activity
3. Event

First week of militia use skips Upkeep.

## Upkeep Phase

### Step 1: Training Attrition

- Attempt DC 10 Loyalty.
- Success: training `-1d6`.
- Natural 20: training `+1d6` instead.
- Failure: training decreases by `2d4 + rank`.

### Step 2: Maximum-Notoriety Penalties

If Notoriety is 100:
- Training decreases by `1d20 + rank`.
- Attempt DC 15 Loyalty or reputation in nearest settlement drops one step (not below Unfriendly through this effect).

### Step 3: Treasury-Shortage Penalties

If treasury is below minimum:
- Training decreases by `2d4 + rank`.

### Step 4: Increase Rank

- Apply rank increases from current training.
- Can gain multiple ranks at once.
- Cannot exceed highest-level PC.
- Apply boons immediately.

### Step 5: Deposits and Withdrawals

- Any officer may deposit/withdraw gold from militia treasury.
- Application departure (approved in [#107](https://github.com/AndreasUnunger/EverythingPath/issues/107#issuecomment-5836751035), Ruleset Version 6): the application does not enforce the officer-only sentence above. Deposits and withdrawals are staged without choosing a character or officer. The source text is unchanged; weeks confirmed under earlier Ruleset Versions keep their recorded actors and officer rulings. A withdrawal beyond the available treasury still needs a reasoned Rules Exception.

## Activity Phase

- Militia takes actions up to current action cap (plus modifiers).
- Actions can be any order.
- Teams generally cannot act more than once in phase.

## Action: Activate Black Market

- Team: Black Marketeers.
- Cost: 50 gp.
- Check: DC 20 Secrecy.
- Success: black market active 1 week; availability roll threshold rises to 90%; sold magic items return 55% value; contraband/hard-to-sell items can be sold.
- Failure: Notoriety `+1d6`.

## Action: Activate Refuge

- Teams: Conspirators, Scholars, Spellcasters.
- Effect: in Hostile/Unfriendly settlement, treat reputation as one step better while active.
- Refuge lasts 1 week and can be renewed.

## Action: Broker Market

- Teams: Black Marketeers, Fixers, Merchants.
- Cost: 100 gp.
- Effect: temporary market source.
- Merchants act as small town availability.
- Black Marketeers/Fixers act as small city availability.
- Purchase paid on activation; items arrive at next Activity phase.

## Action: Change Officer Role

- No team required.
- One PC changes officer role.
- Allies/cohorts cannot change roles with this action.

## Action: Covert Action

- Team: Spies.
- Effect option 1: augment immediately following militia action:
  - add spies manager Charisma bonus to all d20 rolls for that action.
  - if action succeeds, Notoriety does not increase from that action.
- Effect option 2: place contact/cache in specific adventure site for 1 week.

## Action: Dismiss Team

- No team required.
- DC 10 Loyalty.
- Removes a team, freeing slot.
- Failure: Notoriety `+1d6`.

## Action: Drill Militia

- No team required.
- Once per Activity phase.
- Cost: minimum treasury value.
- Check: Loyalty vs `10 + rank`.
- Success: training `+2d6` plus Commandant bonuses.
- Natural 1: no auto-fail, but Notoriety `+1d6`.
- Not available if militia already at current maximum rank.

## Action: Earn Gold

- Teams: Black Marketeers, Fixers, Merchants, Patrons.
- Check: Loyalty.
- Gold gained: `check result x team tier` gp.
- Natural 1: still gain gold, but Notoriety `+1d6`.

## Action: Gather Information

- Teams: Conspirators, Informants, Scholars, Spellcasters.
- Check: DC 15 Secrecy with bonus `+2 x team tier`.
- Success yields rumor/location/person/settlement intelligence as GM allows.
- Natural 1: no auto-fail, but Notoriety `+1d6`.

## Action: Guarantee Event

- No team required.
- Cost: minimum treasury value.
- Also increase Notoriety by `+1d6`.
- Effect: event guaranteed this week; GM rolls twice and PCs choose event.
- Application departure (approved in [#108](https://github.com/AndreasUnunger/EverythingPath/issues/108#issuecomment-5837858373), Ruleset Version 7): a Roll Twice on either rolled event, chosen or not, is rerolled in its own die and never expands, even as the phase's first Roll Twice. The `Event: Roll Twice` text is unchanged; weeks confirmed under earlier Ruleset Versions keep their recorded expansion.

## Action: Knowledge Check

- Team: Scholars.
- Resolve requested knowledge by rolling Secrecy check + militia rank.
- Total is treated as achieved Knowledge DC.
- Can identify magic items and evaluate monsters/NPC abilities.

## Action: Lie Low

- No team required.
- Must be only action taken this Activity phase.
- Notoriety decreases by total number of teams.

## Action: Manipulate Events

- Team: Guardians.
- Guarantees an event this week.
- GM rolls twice on event table.
- Any player chooses which of the two rolled events occurs (review decision A13.chooser).
- Application departure (Ruleset Version 7): as for Guarantee Event, a Roll Twice on either rolled event is rerolled in its own die and never expands.

## Action: Recruit Team

- No team required.
- Requires free non-bonus team slot.
- Uses team-specific recruitment check and DC.
- Natural 1: no auto-fail, but Notoriety `+1d6`.

## Action: Reduce Danger

- Teams: Defenders, Guardians, Infiltrators, Specialists.
- Check: DC 15 Security.
- Success: temporary +1 reputation step for week in target town; militia members can walk openly in hostile/unfriendly settlements.
- Failure: Notoriety `+1d4`.

## Action: Rescue Character

- Teams: Guardians, Infiltrators, Specialists.
- Check: Security vs `10 + captured character level`.
- Success: captured PC/NPC recovered to militia operating location/refuge.
- Notoriety increases by rescued character level.
- Failure: character not rescued; Notoriety increases by half that amount.
- Some NPCs may require direct PC rescue at GM discretion.

## Action: Restore Character

- Team: Spellcasters.
- Party-scale options:
  - heal all ability damage, or
  - heal all hp damage, or
  - one 3rd-level-or-lower restorative effect.
- Single-target options by paid scroll-equivalent:
  - break enchantment: 1,125 gp
  - raise dead: 6,125 gp
  - restoration: 1,700 gp
  - stone to flesh: 1,650 gp
- Target remains/body must be present at militia location or activated refuge.

## Action: Sabotage

- Team: Saboteurs.
- Reactive during Event phase if saboteurs are available.
- Check DC to negate event: `15 + rank`.
- Notoriety increases by `+1d6` whether success or failure.

## Action: Secure Cache

- Teams: Moles, Propagandists, Saboteurs, Spies.
- Place or retrieve hidden supplies.
- Cache classes:
  - Minor: Moles+
  - Intermediate: Propagandists+
  - Major: Saboteurs/Spies only
- Secure location placement:
  - `+5` DC
  - requires tier 3 team (Saboteurs or Spies)
- Failure to place: cache not placed; returned next Activity phase.
- Retrieving unused caches uses same check framework.

## Action: Special

- No team required.
- GM-defined story/event resolution actions.

## Action: Special Order

- Team: Fixers.
- Place order for specific item at 5% discount.
- Cost paid upfront.
- Delivery time: `2d6` days.
- Expedited delivery: +900 gp for 1 day delivery.
- Alternative: arrange enchantment on existing magic item.
- Enchantment time: normal delivery time + 1 day per 1,000 gp enchantment cost.
- Limit: one item or enchantment per action.

## Action: Spread Propaganda

- Teams: Propagandists, Saboteurs, Spies.
- Cost: 100 gp.
- Check: DC 20 Loyalty.
- Success: improve settlement reputation by one step.
- DC increases by 5 in settlements occupied by enemy troops/major organizations (or may be impossible at GM discretion).
- Settlement can be influenced once per Activity phase.
- Application departure (user decision 2026-09-28, Ruleset Version 9): the application assumes the GM allows propaganda in every settlement, since players act with the GM's blessing. It asks no permission and needs no Rules Exception for an impossible settlement; a stored "impossible" answer is ignored. The occupation DC increase and the once-per-Activity limit are unchanged. Weeks confirmed under earlier Ruleset Versions keep their recorded rulings, warnings and outcomes.
- Ruleset Version 9 also changes two Event edge cases (user decision 2026-09-29). A Raid or Cache Discovered reads mitigation and its check only per person or per cache: an event-level mitigation or check roll kept from an earlier table result (Theft or Sickness) is ignored and listed as an unused input to clear, where earlier versions applied it to every person or cache. A replacement prepared for an event that cannot occur is no longer the reroll once its parent's die is corrected to a Roll Twice rerolled in its own die: the replacement stays unused and the Roll Twice asks for its own new die, where earlier versions used the replacement as that reroll. Weeks confirmed under earlier Ruleset Versions keep their recorded outcomes.

## Action: Strike Team

- Team: Specialists.
- Choose target location when action is taken.
- During following week, once at that location:
  - each PC gains +2 competence to attack, damage, and saves for rounds equal to half militia rank, rounded down with a minimum of one round.
- Alternate use: emergency casualty extraction.
  - Bleeding allies stabilize.
  - Dead allies gain immediate `gentle repose` (CL 12).
  - Bodies extracted to militia HQ.

## Action: Upgrade Team

- No team required.
- Spend listed upgrade cost.
- Any number of teams can be upgraded in a week if action slots and gold allow.
- Each specific team can be upgraded at most once per week.

## Event Phase

### Event Trigger

- Roll percentile against event chance.
- Operating settlement reputation modifies that percentile roll: Friendly `-5`, Unfriendly `+5` (Table 6-2). It never modifies the event table roll.
- Event chance = Notoriety plus modifiers.
- Minimum 10%, maximum 95%.
- After an uneventful week, add rank to event chance for next week.
- Uneventful does not include first militia week.

### Event Resolution Notes

- If event cannot occur, reroll.
- `Roll Twice` can cause dual event resolution.
- If duplicate event appears in double roll and has `Twice` clause, second application uses that clause.
- Resolve persistent events oldest first.

## Event: All Is Calm

- No event this week.
- Twice: next week skip event-chance roll and apply this outcome directly; this does not build the uneventful bonus chain.

## Event: Broke the Code

- Identify one magic item of any caster level.
- PCs gain +2 Knowledge (local) for week.
- Twice: bonus becomes +5.

## Event: Cache Discovered

- Lose one hidden/planned cache and contents.
- Mitigate: Secrecy check DC `10 + rank` to retrieve.
- Twice: all caches discovered.

## Event: Calm before the Storm

- No event now.
- Next week: roll event table and apply that event automatically (ignore Roll Twice result), then continue with normal Event phase roll.
- This week does not count as uneventful for rank bonus purposes.
- Twice: next week roll two automatic events (ignore all Roll Twice), then run Event phase normally.

## Event: Double Agent (Persistent-capable)

- Cannot use Secure Cache next Activity phase.
- Secrecy checks suffer -2 penalty.
- Twice: becomes persistent.

## Event: Festival

- Choose recently used town.
- PCs gain +2 morale to Bluff/Diplomacy/Intimidate there for week.
- Twice: bonus becomes +5.

## Event: Found Fire

- Each PC gets one non-poison alchemical item worth <=100 gp.
- Security checks gain +2 for upcoming week.
- Twice: choose one additional <=100 gp item.

## Event: Hidden Agenda

- Militia gains +2 on all Activity phase checks this week.
- Twice: bonus becomes +5.

## Event: High Morale

- End one current persistent event immediately.
- Loyalty checks gain +2 for upcoming week.
- Twice: end two persistent events and bonus becomes +5.

## Event: Invasion

- GM presents random combat encounter at CR `APL + 1`.

## Event: Low Morale (Persistent-capable)

- Loyalty checks suffer -2.
- Twice: becomes persistent.

## Event: Market Day

- One operated town (PC choice): all items/services gain extra 5% discount.
- Twice: applies to all operated marketplaces, including Broker Market marketplaces.

## Event: Missing in Action

- One random team that operated this week is unavailable next week.
- Twice: team returns end of following week, but disabled.

## Event: Night Ops

- PCs gain +2 circumstance bonus to Stealth after dark for week.
- Twice: bonus becomes +5.

## Event: Raid

- In random settlement with active refuge(s), all refuges deactivate.
- Hidden persons may be captured and can be recovered next week via Rescue Character (DC `5 + rank`).
- Mitigate: DC 20 Security per person to reduce capture chance by 50%.

## Event: Rivalry (Persistent-capable)

- Two random teams cannot act next Activity phase.
- Twice: persistent until officer succeeds at DC 20 Bluff, Diplomacy, or Intimidate.

## Event: Roll Twice

- Roll and resolve two events.
- Roll Twice can only take effect once per Event phase.
- Additional Roll Twice results in same phase are rerolled.

## Event: Sickness

- One random team becomes disabled.
- Twice: team is lost unless militia succeeds on DC 20 Loyalty.

## Event: Theft (Persistent-capable)

- Militia treasury is halved.
- Mitigate: DC 20 Loyalty reduces loss to 10% instead.
- Twice: becomes persistent and militia loses half of all incoming treasury gains until successful Reduce Danger action.

## Event: Turn Around

- All disabled teams recover.
- If none disabled, one team gains +2 on one check next Activity phase.

## Event: Turncoat

- Training decreases by `1d6 + rank`.
- Twice: one full team defects (GM choice) unless officer succeeds at Diplomacy DC `10 + rank`; even on success team is unavailable next Activity phase.

## Event: War Games

- Training increases by rank.

## Event: Week of Pain

- Next week: -1 penalty to all organization checks.
- Next Upkeep training loss is doubled.
- Twice: no additional effect.

## Event: Week of Serenity

- Next week: +5 bonus to all organization checks.
- Next Activity training gain is doubled.
- Twice: no additional effect.

## Persistent Events Rules

- Persistent events continue week-to-week.
- If mitigation exists, mitigation lasts only 1 week and must be repeated.
- Once every 4 weeks, PCs can end a persistent event by paying `2 x current minimum treasury value`.

## Caches

### Minor Cache

- Max 5 lb, max 900 gp.
- Requires DC 15 Secrecy.

### Intermediate Cache

- Max 10 lb, max 2,500 gp.
- Requires DC 20 Secrecy.

### Major Cache

- Max 20 lb (expandable via extradimensional storage), no value cap.
- Requires DC 30 Secrecy.
