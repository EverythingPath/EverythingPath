# Ordered Activity projection (#68)

`projectActivity(draft, snapshot)` takes the canonical Weekly Draft and the
projected **post-Upkeep** snapshot (`projectUpkeep(...).outcome`). It folds slots
in order and returns a partial outcome, ordered baseline change plan, check
modifier explanations, retained slots, requirements, warnings, and team/check
usage for subsequent phase work. Carried Low Morale and Double Agent penalties
apply to Activity checks once, including when queued copies also exist. It never
writes state or applies Table
Adjustments. Missing inputs leave the projection unready.

The implemented actions are Change Officer Role, Dismiss Team, Drill Militia,
Recruit Team, Upgrade Team, Lie Low, and the five economy actions below. Other actions explicitly require
resolution; they cannot silently produce a ready, incomplete plan. The next
Activity extraction extends this same fold.

Each eligibility warning uses `choiceId:ruleId`; an exception matches the
choice identity and rule ID and requires a reason. Rule IDs currently include
`action-capacity`, `team-capacity`, `team-condition`, `team-action-limit`,
`team-upgrade-limit`, `upgrade-tree`, `treasury`, `maximum-rank`, `drill-limit`,
`lie-low-exclusivity`, `officer-pc`, `officer-role-limit`, and `recruit-tier`.
Exceptions permit choices without changing costs, dice arithmetic, or removing
required references. Higher-tier recruitment has no rules-defined check/DC:
its exception therefore also requires `recruitmentCheck`. Tier-1 recruitment
always uses its published check/DC, regardless of that field.

Recruitment allocates the stable domain team identity `recruit:<choiceId>`;
subsequent choices can reference it. Upgrades preserve that identity, manager,
condition, exemption, name, and notes. Strategist changes affect later slots;
the first slot beyond the rank allowance receives the Strategist bonus while
a Strategist is assigned. Removing the assignment retains occupied extra slots
and requires an exception before resolving them.

This canonical slice remains isolated from live legacy campaigns under the
accepted #55 cutover sequence. Legacy drafts lack raw dice, independent team
identities, and complete officer facts, so they cannot faithfully delegate the
whole ordered calculation. Existing live consumers switch together when the
canonical Workspace/persistence cutover lands. No legacy scenarios were deleted.

`rules-activity.test.ts` asserts named outcomes and ordered recomputation.
`activityProjection.integration.test.ts` compares the browser bundle with the
same projection of a persisted Convex draft for all six actions. The existing
isolated browser harness protects the currently supported application path;
it does not claim the future canonical Workspace UI is already connected.

Verification for this extraction (2026-09-11): typecheck and lint; 572 tests in
63 files; rules catalog validation with zero errors; and the mandatory browser
journeys on disposable preview `e2e-local-andreasununger-slot-0`. Standards and
spec review findings were addressed, including stale Strategist provenance and
Helpful settlement eligibility/one-use consumption. The catalog retains explicit
gaps for subsequent extraction and cutover work.

## Economy actions (#69)

The fold also resolves Activate Black Market, Broker Market, Earn Gold, Secure
Cache, and Special Order. `rules-economy.ts` uses the same checks, team use,
exception policy, and ordered treasury changes as the roster actions. The
shared `actionRestrictions` function exposes carried Double Agent and queued
Activity restrictions for option presentation and resolution. A reasoned
`action-blocked` exception permits the action while its Secrecy penalty remains.

Asset actions require an explicit `snapshot.economy`, validated by
`economyStateSchema`. It holds individual items (including value in copper,
weight, and custody), caches with item identities, markets with week duration,
and orders with distinct day or next-Activity timing. An absent economy snapshot
is missing input, never an assumed empty inventory. These richer facts remain
isolated until the canonical campaign-state mapping and approved cutover are
ready; the legacy ledgers do not contain enough information to reconstruct them.

Purchases include an item identity, name, weight, and list price. Owned items are
referenced by identity. Cache placement explicitly selects owned items and/or
purchases and records class, location, security, and extradimensional storage.
The projection derives weight, value, DC, price, delivery, and all asset changes.
Failed placement keeps equipment in transit until the next Activity; successful
retrieval returns the same items. Equipment that is sold, cached, ordered, or
away for enchantment cannot be reused by a later action. Reordering or removing
choices rebuilds these consequences from the source snapshot.

Item availability is an explicit table acknowledgement whose subject is
`availability:<itemId>`. Market profiles expose availability thresholds and
settlement sizes for that decision; the projection does not invent external
item-generation tables. An empty purchases array explicitly means no purchases.
Pricing shares the foundations' copper-rounding function and compounds local
reputation, applicable Market Day, and Special Order discounts before rounding
once. Activation fees and the expedited surcharge remain separate fixed costs.

Special Order receipts reference an acknowledgement whose subject is the order
identity. Receipt requires the exact delivery date to have arrived and releases
one item once. Enchantment preserves the original item identity and adds its
value upon receipt. Delivery durations and due days preserve fractional
per-1,000-gp enchantment time; ordinary delivery remains 2d6 days and expediting
uses one day plus enchantment time, with its 900 gp surcharge. A due date alone
does not grant an item. Broker and Black Market purchases instead arrive at the
next Activity, independently of Special Order receipts and expiring markets.

`rules-economy.test.ts` covers the named audit outcomes, missing inputs,
thresholds, copper/day precision, source edits, asset conservation, exceptions,
and schema-valid outcomes. The existing persisted-draft/browser-bundle parity
test now includes all five economy actions. Catalog gaps for later Event,
Persistent, complete Resolution, Workspace, and cutover work remain explicit.

Persistent Theft uses `projectTreasuryIncome` for both Upkeep deposits and
Activity earnings/sales. It retains half of each positive gain, rounded once to
copper, without discounting expenses or stacking multiple occurrences. The
Activity projection exposes `endedEventIds` and `end_persistent_event` changes
so successful Reduce Danger can end carried occurrences in action order;
subsequent income uses the remaining active occurrences.

## Settlement actions (#70)

Activate Refuge, Reduce Danger, and Spread Propaganda resolve at their slot
position against owned settlement identities. Later checks, purchases and phase
projections read the updated settlement state. Refuge changes effective
reputation for the current week, including renewals, without changing permanent
reputation. Reduce Danger records a separate `reduceDangerReputationShift` and
`reduceDangerUntilWeek`, preserving preexisting temporary context when its own
benefit expires. Both expose target-specific, current-week narrative benefits
without inventing hosted characters or executing encounters.

Reduce Danger requires known secured context; an unsecured town needs a reasoned
`settlement-secured` exception. Security 15 succeeds; failure requires a d4
Notoriety roll. Success emits an ordered `end_persistent_event` for each carried
Theft and adds its identity to `endedEventIds`. Earlier income retains its loss;
later income sees the ending. Persistent processing can consume these explicit
endings without changing the fixed week-start Persistent Phase eligibility.

Spread Propaganda uses the target settlement's known occupation for DC20/DC25,
pays the calculated 100 gp even on failure, and records each attempt against that
settlement. A second attempt needs `propaganda-limit`, even after failure.
Success raises permanent reputation once, capped at Helpful. Since Ruleset
Version 9 (#198, user decision 2026-09-28) the GM is assumed to allow
propaganda: there is no `propaganda-permission` decision and no
`propaganda-impossible` exception, and an older choice's stored `possible`
answer, even `false`, is ignored. What happened (acknowledgement subject
`propaganda:<choiceId>`), occupation, reputation, rolls and owned targets remain
required inputs. A stale `occupied` hint cannot override known context.
Organization checks do not receive reputation's separate social-check DC shift.

The settlement outcome suite covers action-owned expiry, thresholds, caps,
permissions, exceptions, source preservation, upstream price recomputation, and
ordered Theft/income interaction. All three fixtures participate in the existing
persisted Convex/browser-bundle parity test. Rescue/Raid consumption of refuge,
full persistent/successor resolution, and canonical Workspace integration remain
explicit later-extraction work; no live endpoints or legacy writes were changed.

Each successful Reduce Danger attempt adds one temporary step; distinct eligible
military teams may affect the same town. The written action has no once-per-town
limit or non-stacking clause (unlike Spread Propaganda). Its same-week shifts
expire together; the legacy maximum-one implementation is not an accepted rule.

## Character, information, and support actions (#71)

Rescue Character, Restore Character, Gather Information, Knowledge Check, Strike
Team, and Special now resolve in the same ordered fold. Checks expose computed
`gather-tier` and `knowledge-rank` provenance and ignore stale entered copies of
those modifiers. Gather Information records success against DC15, adds twice the
team tier, and applies natural-one Notoriety without automatic failure. Knowledge
Check records the achieved DC and requested subject. All six require a table
outcome acknowledgement with subject `<actionId>:<choiceId>`; this receipt remains
in the typed plan alongside the action-specific quantities and target facts.

Rescue and Restore require explicit `snapshot.characterActions` tracked-person
facts (validated by `characterActionStateSchema`) and campaign-owned roster and
character references. Unknown legacy conditions, capture timing, location and
GM direct-rescue restrictions are not guessed. Rescue requires a destination of
headquarters or an owned active refuge, updates capture/location metadata on
success and derives Notoriety from authoritative level (failure rounds down).
Raid capture uses DC5+rank on the following week, then returns to normal DC10+level.
Direct-rescue, condition, location and timing departures require separate Rules
Exceptions. A preceding refuge activation or successful rescue changes later
restoration eligibility; changing the earlier result recomputes those effects.

Restore retains party recipient identities or one explicit individual, body
presence, chosen effect and restorative spell level. It emits a restoration
receipt and tracked recovery changes, charging the exact copper scroll cost.
Free healing and non-resurrection scrolls preserve death; only Raise Dead changes
a dead tracked recipient to recovering. Full HP, ability and spell-condition
execution stays at the table and requires the retained acknowledgement. A stale
cost hint does not replace the prescribed baseline; result changes belong to the
later whole-week Table Adjustment application.

Strike Team emits a typed, once-only entitlement at the chosen location for the
following week, with that week's expiry. Combat support records each PC's +2
competence attack/damage/save bonuses and half-rank duration rounded down, with a minimum of one round. Extraction records bleeding stabilization, gentle repose CL12 for the dead
and body extraction to headquarters. This records the granted support and table
acknowledgement, without pretending future combat or extraction already occurred.
Special requires an instruction, an explicit copper cost (including zero) and a
recorded story result. Narrative acknowledgements do not silently change resource
balances; separate typed adjustments remain distinct from eligibility exceptions.

Named tests cover required-input matrices, all restoration prices and modes,
mode-specific recovery, death preservation, ordered rescue/restoration, missing
and foreign targets, natural rolls, tier/rank composition, repeated independent
outcomes, stale-choice removal, and both support modes. All six fixtures pass
through persisted-draft/browser-bundle parity. Live tracked-person mapping,
whole-week adjustment/Confirmation application, successor entitlement consumption,
and canonical Workspace UI remain later checkpoints; no live cutover is enabled.

## Event-shaping and reactive actions (#72)

Covert Action, Guarantee Event and Manipulate Events now emit explicit ordered
changes. Covert augmentation records the immediately following nonempty choice
identity and the Spies manager bonus at that position. The common d20 check path
adds it once. Each check records success against its own action's DC; the fold
suppresses positive Notoriety only for that successful occurrence. A successful
natural one needs no Notoriety die, while a failed check retains its increase.
Empty slots are not actions, and moving/replacing a target cannot transfer its
benefit to a later choice of the same action type. Contact and cache alternatives
record the chosen site, current-week availability/expiry and table receipt.

Guarantee Event pays the current minimum treasury and its own d6 Notoriety per
occurrence. Each guarantee preserves two independent percentile candidates,
selection, raw modifiers, and an acknowledgement with subject
`<actionId>:<choiceId>`. Guardians provide Manipulate Events without this cost;
any player chooses which candidate occurs. No chooser identity is recorded.
Missing or foreign required references remain requirements, not exceptions.

`projectEventShaping(draft, activity)` consumes these plan effects and the
post-Activity state, used teams and one-use check bonuses. The convenience entry
`projectActivityAndEventShaping(draft, postUpkeepSnapshot)` composes the two pure
projections. The shaping result includes selections, checks, reactive outcomes,
Notoriety, consumed bonuses, and occurrence-specific negations. It requires both
candidate rolls and one root choice, expands selected Roll Twice once per normal
Event phase, and requires independent replacement rolls for subsequent results.
The settlement table modifier is derived from post-Activity reputation.

Typed queued `all_is_calm` suppresses normal selection without refunding Activity
costs. Typed `automatic_events` (count one or two) explicitly authorizes roots by
source identity; those resolve before normal selection and reroll every Roll
Twice. An automatic occurrence without its source facts remains unready instead
of disappearing. Future event resolution will produce these queued inputs;
legacy prose is never guessed into them.

Sabotage belongs to its selected Event occurrence and retains its own choice ID,
team, raw d20/d6, explicit organization `check`, optional Overseer, and table
receipt (`sabotage:<eventId>:<choiceId>`). The corpus gives DC15+rank but does not
name the organization check, so the table selects it explicitly. The projection
uses ordinary rank/focus, officers, manager, eligible Overseer, queued/carried
penalties and consumable bonuses exactly once. Available Saboteurs must not have
worked or upgraded during Activity or an earlier reaction; disabled, missing and
queued unavailable conditions warn and need reasoned exceptions. Success negates
only that occurrence and both success and failure add the d6. Unselected branches
never consume a team, roll, or benefit.

Named outcome tests and an additional persisted Convex/browser-bundle parity
case cover all four actions. Full event consequences, duplicate event effects,
persistent/successor application and canonical Workspace presentation remain
later extraction work. `event.ready` means this shaping stage has its required
inputs; it does not certify complete whole-week resolution or enable cutover.
