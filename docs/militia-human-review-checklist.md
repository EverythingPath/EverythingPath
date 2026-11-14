# Militia rules review — one-document checklist

Prepared for issue #88 on 2026-09-19, from implementation `bd057df`. **Human review: complete — AndreasUnunger, 2026-09-23.** Existing review marks are preserved. This is the document to read and reply to; the rule text, numeric tables, accepted policies, expected behavior, and open decisions are included here.

## Recorded scope decisions

2026-09-23 — You removed `F02.ap-caps` from scope: no current Adventure Path or volume is tracked, and no volume-based rank limit is calculated, displayed, or enforced. Rank 20 and the highest-PC-level limit remain. The removed item needs no further review.

2026-09-23 — **F04.context is deferred** to [backlog issue #98](https://github.com/AndreasUnunger/EverythingPath/issues/98): handling extra actions granted by story rewards. It does not block this review and needs no further reply. Rank and Strategist allowance checks remain in scope.

2026-09-23 — **F05.order:** You specified that recruitment and dismissal committed in the same week must work in either order when the resulting roster fits team capacity. This supersedes the earlier slot-by-slot capacity expectation.

2026-09-23 — **O02.*:** You specified automatic use of the highest applicable officer bonus, with no manual ability or bonus selection. Multiple holders do not stack their bonuses.

2026-09-23 — **O04:** The supplied Overseer rule permits support for organization checks throughout one event’s resolution, not only one check. The +1 bonus to both secondary checks remains.

2026-09-23 — **O05.slot:** The Strategist’s +2 must be visibly labelled on its bonus action slot.

2026-09-23 — **U01.first-use:** You confirmed that the first-week Upkeep skip applies only to a newly founded militia’s first-ever week. A militia set up to resume a later week must run Upkeep, even when first starting in the app.

2026-09-23 — **A13.chooser:** You specified that any player can choose the guaranteed event result. The app does not need to track who chose it.

2026-09-23 — **P10.gm:** All users with organization access can edit everything. No separate GM controls or correction permissions apply at this stage; this supersedes historical GM-only policy below.

2026-09-23 — **P11.legacy:** No requests from the old version will arrive after the upgrade. Explicit legacy-request rejection and forced reload handling are out of scope. The paused cutover and recovery before reopening still need rehearsal; this supersedes conflicting historical cutover wording below.

## How to reply

Read a group’s included rule reference, then judge each numbered expectation: does it express the right behavior, including the named edge case? You are reviewing rules and intended behavior, not certifying code or rerunning tests. For implementation gaps, approval means the requirement is correct; it does not mean the missing work has been completed.

Reply here using `ID: OK`, `ID: CHANGE — correction`, or `ID: UNSURE — question`. For any explicit choices, use `ID: CHOICE A` or `ID: CHOICE B — details`. Send one group at a time if convenient.

```text
F01.fresh: OK
F01.import: CHANGE — [describe the behavior you want]
F01.rank-cap: UNSURE — [your question]
COMPLETE.F01: OK
```

If you have read every check in a group, you may say `A07.*: OK`. This covers its listed behavior checks; reply separately to `COMPLETE.A07` to confirm nothing is missing. Unmentioned checks remain pending. These are reply examples, not recorded approvals.

Each `COMPLETE.…` check asks whether the group omits any rule or important scenario. Report a missing behavior against that ID even when every existing check looks correct. Existing IDs are retained so your replies can be mapped directly to the coverage inventory.

Two terms used throughout: a **Rules Exception** permits an unusual choice with a recorded reason, without changing the calculated arithmetic. A **Table Adjustment** changes the result after the full rules baseline, with a recorded reason. **Confirmation** commits the complete reviewed week.

## Start here: accepted interpretation policy

The following previously accepted policies govern ambiguous wording and superseded behavior. They are reference material, not new approvals requested from you. The historical snapshots are reproduced so no other document is needed. The dated scope decisions above supersede conflicting historical wording below. In particular, Rules Exceptions cannot permit actions in unavailable slots. Flag any conflict you discover against the affected check.

Part of #33.

**Question**

Which mismatches found by **Audit Weekly Draft behavior against the full militia rules corpus**, if any, are intentional product exceptions rather than bugs?

The written militia rules are the default. For every proposed exception, decide the observable behavior, reason, Phase View or Resolution Preview effect, and required test. Treat every mismatch not explicitly accepted here as a bug to correct during the refactor.


**Resolution**

Accepted by the driving developer in the live Wayfinder discussion: “Sounds good” for policies 1–3, then “Go with recs” for interpretations 4–9 below. This is a planning decision, not an implementation report.

The evidence inventory is [Audit Weekly Draft behavior against the full militia rules corpus](https://github.com/AndreasUnunger/EverythingPath/issues/54). Its 95 entries remain the coverage inventory; this resolution supplies the exception policy and interpretations for that inventory.

**Baseline and intentional product behavior**

No demonstrated legacy calculation bug is accepted merely to preserve current behavior. Every mismatch not explicitly covered by an accepted decision remains a bug to correct during the refactor. Missing models and tests remain required work; manual handling is not permission to silently omit an outcome. Previously accepted Workspace and lifecycle decisions remain in force.

| Decision | Accepted observable behavior and reason | Phase View / Resolution Preview effect | Required tests |
|---|---|---|---|
| 1. Correct baseline defects | Follow the written rules unless an explicit accepted interpretation below applies. In particular, rank 1 grants one baseline action; failed Dismiss Team still removes the team and adds rolled Notoriety. Existing tests asserting incorrect behavior must be replaced. | Show corrected action allowances and projected roster/results. | Rank boundaries and Strategist; failed dismissal removes the target and applies Notoriety; corrected outcomes for every mismatch in the audit. |
| 2. Computation and table adjudication | Calculate deterministic defaults from the rules. Players provide dice rolls and narrative adjudication. Narrative outcomes require explicit acknowledgement/recording; do not pretend that displaying instructions executes an outcome. Full character-builder and tactical-combat execution remain outside scope. This preserves table authority without hiding missing calculations. | Show the calculated baseline, missing rolls/acknowledgements, and explicit Table Adjustments separately. Include reward, boon, encounter, and support reminders with the prescribed quantities/conditions. | Raw-roll and modifier branches, including natural rolls; missing-input readiness; baseline versus adjusted result; narrative acknowledgement retained in the confirmed source/history; no double application of computed and entered outcomes. |
| 3. Rules Exceptions | Any player may retain an out-of-rules choice through a shared Rules Exception with a required reason, except that unavailable action slots cannot be bypassed. It permits the choice; it does not rewrite the calculated result. Missing required inputs and malformed data still block Confirmation. This supports table-valid exceptions while keeping departures visible. | Explain the eligibility warning and recorded exception. Apply typed Table Adjustments after the baseline when the result itself is changed. | Unavailable action slots block Confirmation even with a reason; other rule departures with/without a reason; exception visible to another player; malformed references/data and required missing inputs remain blocked; exception does not itself alter arithmetic; confirmed source retains the exception. |

**Accepted source interpretations and timing policy**

These are explicit project decisions where the audit identified ambiguity or a representation shortcut. They are not claims that every detail is unambiguously prescribed by the source.

| Decision / inventory | Accepted observable behavior and reason | Phase View / Resolution Preview effect | Required tests |
|---|---|---|---|
| 4. Uneventful carry — E05 | After an eligible uneventful week, add the current rank once to the following week's event **chance**, not to the percentile roll. Do not accumulate rank across consecutive quiet weeks. The verbatim Event Phase wording supports chance and does not explicitly prescribe accumulation. Preserve first-militia-week exclusion and the event-specific exclusions; automatic events count when deciding whether the week was uneventful. | Show one rank modifier and the resulting bounded 10–95% chance. | Consecutive quiet weeks do not accumulate; changing rank uses current rank; chance-versus-roll; 10/95 boundaries; first-use metadata; All Is Calm and Calm before the Storm/automatic-event exclusions. |
| 5. Duplicates without Twice — E04 and affected events | Resolve both occurrences separately when a duplicate has no Twice clause. Where a Twice clause exists, use it; explicit “no additional effect” still suppresses the additional effect. A duplicate is not automatically discarded. | Show both applicable outcomes/required inputs in order. Additional Roll Twice results require replacement rolls rather than disappearing. | Two no-clause occurrences, a replacement/enhancement Twice clause, explicit no-additional-effect clauses, repeated Roll Twice rerolls, independent targets/rolls and order-sensitive results. |
| 6. Persistent Double Agent — EV05 | Block Secure Cache every affected Activity phase until the persistent event ends; apply one −2 Secrecy penalty, not queued −2 plus persistent −2. This follows the general persistence rule that effects continue week after week. A nonpersistent occurrence blocks only the next Activity phase. | Explain ongoing eligibility and the single penalty; never silently discard a staged cache action. Rules Exception policy still applies. | Base next-week duration; first and later persistent weeks; no −4 double count; ending/buyoff removes future restriction and penalty; warning/exception path. |
| 7. Buyoff cadence — P03 | First buyoff is available immediately. Thereafter use one four-week cooldown shared across the militia's persistent events: buyoff in week 2 allows the next in week 6. Charge twice the current minimum treasury. This treats “once every 4 weeks” as a cooldown rather than a mandatory initial wait. | Show eligibility, next eligible week, cost, and staged end in the preview. Retain the accepted whole-week Confirmation lifecycle rather than immediate authoritative writes. | First use before week 4; weeks 2/5/6; different target events share cooldown; current-rank cost; two-player competing edits and Confirmation; insufficient funds use the agreed warning/exception policy. |
| 8. Special Order timing — A21 | Preserve actual delivery duration in days, including one-day expedited delivery, and record receipt explicitly. Do not silently round every order to a later week. Exact due-day information preserves the value of expediting. This policy does not change Broker Market's separate next-Activity timing rule. | Show due-day information and receipt status, with deterministic price/time defaults and entered dice. Receipt remains subject to the accepted draft/Confirmation lifecycle. | Ordinary 2d6 boundaries, one-day expedite and its surcharge, enchantment time, orders crossing week boundaries, explicit receipt recording and no duplicate receipt; Broker Market retains its distinct timing. |
| 9. Fractions — F09/A16/A23/EV19 and related numeric cases | Round whole-count results down, except Strike Team support has a minimum of one round (A23.rank-one review decision, 2026-09-23). Preserve money to copper precision; odd-level rescue Notoriety and split XP round down. | Show the rounded baseline and any explicit adjustment; preserve monetary precision. | Odd/even half-rank and half-level values, rank-1 minimum of one round, non-divisible XP awards, fractional treasury/price calculations at copper precision, and explicit adjustment paths. |

**Handoff**

The shared Rules Projection owns these baseline calculations and interpretations; Phase Views present them. The Weekly Draft retains the necessary rolls, choices, acknowledgements, Rules Exceptions, and Table Adjustments so the Resolution Preview and Confirmation use the same source. Preserve the established exact-revision Confirmation and immutable Resolution Record contracts.

Use the audit inventory to expand compound entries into executable rule/case coverage under [What test architecture should protect the Weekly Draft refactor?](https://github.com/AndreasUnunger/EverythingPath/issues/53). In particular, replace legacy expectations for cumulative carry, suppressed no-clause duplicates, failed dismissal, and rank-one Strike Team support (now explicitly at least one round). Do not treat existing test success as proof of rules completeness.

The remaining migration-sequence decision must account for day-based orders, persistent-event targets/cadence, independent occurrences and rolls, complete calculated defaults, and recorded table decisions. Detailed exception/receipt presentation stays with implementation; no new planning ticket is needed for the accepted policies.

No application code, campaign data, deployment, or rules corpus changed. Existing local edits to AGENTS.md and CONTEXT.md were left intact. No tests were run because this session resolved planning policy only.

## Review groups

Use Find for a group or individual ID. Foundations `F01–F09`; officers/managers `O01–O06`; Upkeep `U01–U06`; teams `T01–T08`; actions `A01–A24`; event selection `E01–E07`; event outcomes `EV01–EV24`; persistence/workflow `P01–P11`; verification `GATE`.

### F01 — Creation and starting state

**Included rule reference**

Reference R021 (rules):

**Rank**

- Starts at rank 1, can progress to rank 20 (subject to level cap).
- Affects checks, actions/week, max teams, and PC boons.
- Rank increases from training thresholds (see `militia-tables.md`).
- Rank never decreases, even if training later drops.

Reference R039 (rules):

**Focus**

- One check is chosen as focused at militia creation.
- Focused check advances faster than two secondary checks.

Reference R044 (rules):

**Training**

- Starts at 0.
- Main growth source: Drill Militia action.
- Upkeep attrition and events may raise/lower training.
- Training increases can cause rank gains; training losses do not lower rank.

Reference R058 (rules):

**Treasury**

- Starts at 10 gp.
- Used for actions, recruitment, upgrades, event costs.
- Officers can deposit/withdraw during Upkeep step 5.

Reference T016 (numeric tables):

**Table 6-1: Militia Advancement**

| Rank | Minimum Training | Focused Check | Secondary Checks | Max Actions | Max Teams | PC Boon |
|---|---:|---:|---:|---:|---:|---|
| 1 | — | +2 | +0 | 1 | 2 | — |
| 2 | 10 | +3 | +0 | 2 | 2 | Skilled |
| 3 | 15 | +3 | +1 | 2 | 3 | Gift (potion) |
| 4 | 20 | +4 | +1 | 2 | 3 | Title (Director) |
| 5 | 30 | +4 | +1 | 2 | 4 | 1,200 XP |
| 6 | 40 | +5 | +2 | 2 | 4 | Gift (750 gp) |
| 7 | 55 | +5 | +2 | 3 | 4 | Skilled |
| 8 | 75 | +6 | +2 | 3 | 5 | Gift (armor or wand) |
| 9 | 105 | +6 | +3 | 3 | 5 | Title (Captain) |
| 10 | 160 | +7 | +3 | 3 | 5 | 3,200 XP |
| 11 | 235 | +7 | +3 | 4 | 6 | Gift (3,000 gp) |
| 12 | 330 | +8 | +4 | 4 | 6 | Skilled |
| 13 | 475 | +8 | +4 | 4 | 6 | Gift (wand or weapon) |
| 14 | 665 | +9 | +4 | 4 | 6 | Title (Commander) |
| 15 | 855 | +9 | +5 | 5 | 7 | 6,400 XP |
| 16 | 1,350 | +10 | +5 | 5 | 7 | Gift (8,000 gp) |
| 17 | 1,900 | +10 | +5 | 5 | 7 | Skilled |
| 18 | 2,700 | +11 | +6 | 5 | 7 | Gift (magic item) |
| 19 | 3,850 | +11 | +6 | 6 | 7 | Title (Champion) |
| 20 | 5,350 | +12 | +6 | 6 | 8 | 25,600 XP |

Notes:
- Rank never decreases.
- If training drops below a rank threshold, militia keeps current rank.
- Maximum rank is capped by highest-level PC.

**Individual checks — reply with these IDs**

- [x] **F01.fresh** — New militia shows rank 1, training 0, treasury 10 gp and chosen focus.

- [x] **F01.import** — Explicit mid-campaign state and focus survive initialization.

- [x] **F01.rank-cap** — Rank cannot normally exceed 20 or highest PC level; departures are visible.

- [x] **COMPLETE.F01** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### F02 — Rank and advancement

**Included rule reference**

Reference R005 (rules):

**Scope**

- Intended for the Ironfang Invasion Adventure Path.
- A militia never exceeds the highest-level PC.
- Bonus teams from rewards do not count against normal maximum teams.
- Siege of Stone and Prisoners of the Blight especially encourage proxy NPC officers.

Reference R021 (rules):

**Rank**

- Starts at rank 1, can progress to rank 20 (subject to level cap).
- Affects checks, actions/week, max teams, and PC boons.
- Rank increases from training thresholds (see `militia-tables.md`).
- Rank never decreases, even if training later drops.

Reference R028 (rules):

**Maximum Rank**

- Militia rank cannot exceed the level of the most experienced PC.

Reference T003 (numeric tables):

**Rank and Reward Teams**

A militia can never exceed the level of the highest-level PC.

Bonus teams gained as rewards do not count against max teams.

Reference T016 (numeric tables):

**Table 6-1: Militia Advancement**

| Rank | Minimum Training | Focused Check | Secondary Checks | Max Actions | Max Teams | PC Boon |
|---|---:|---:|---:|---:|---:|---|
| 1 | — | +2 | +0 | 1 | 2 | — |
| 2 | 10 | +3 | +0 | 2 | 2 | Skilled |
| 3 | 15 | +3 | +1 | 2 | 3 | Gift (potion) |
| 4 | 20 | +4 | +1 | 2 | 3 | Title (Director) |
| 5 | 30 | +4 | +1 | 2 | 4 | 1,200 XP |
| 6 | 40 | +5 | +2 | 2 | 4 | Gift (750 gp) |
| 7 | 55 | +5 | +2 | 3 | 4 | Skilled |
| 8 | 75 | +6 | +2 | 3 | 5 | Gift (armor or wand) |
| 9 | 105 | +6 | +3 | 3 | 5 | Title (Captain) |
| 10 | 160 | +7 | +3 | 3 | 5 | 3,200 XP |
| 11 | 235 | +7 | +3 | 4 | 6 | Gift (3,000 gp) |
| 12 | 330 | +8 | +4 | 4 | 6 | Skilled |
| 13 | 475 | +8 | +4 | 4 | 6 | Gift (wand or weapon) |
| 14 | 665 | +9 | +4 | 4 | 6 | Title (Commander) |
| 15 | 855 | +9 | +5 | 5 | 7 | 6,400 XP |
| 16 | 1,350 | +10 | +5 | 5 | 7 | Gift (8,000 gp) |
| 17 | 1,900 | +10 | +5 | 5 | 7 | Skilled |
| 18 | 2,700 | +11 | +6 | 5 | 7 | Gift (magic item) |
| 19 | 3,850 | +11 | +6 | 6 | 7 | Title (Champion) |
| 20 | 5,350 | +12 | +6 | 6 | 8 | 25,600 XP |

Notes:
- Rank never decreases.
- If training drops below a rank threshold, militia keeps current rank.
- Maximum rank is capped by highest-level PC.

**Individual checks — reply with these IDs**

- [x] **F02.thresholds** — Each training threshold is evaluated below, at and above its boundary.

- [x] **F02.retention** — Training loss never reduces existing rank.

- [x] **F02.pc-cap** — Multiple rank gains stop at highest PC level; missing PC facts require input.

- [x] **F02.rank-1-threshold** — Rank 1 minimum training is —; compare below/exact/above while retaining existing rank and applying PC cap.

- [x] **F02.rank-2-threshold** — Rank 2 minimum training is 10; compare below/exact/above while retaining existing rank and applying PC cap.

- [x] **F02.rank-3-threshold** — Rank 3 minimum training is 15; compare below/exact/above while retaining existing rank and applying PC cap.

- [x] **F02.rank-4-threshold** — Rank 4 minimum training is 20; compare below/exact/above while retaining existing rank and applying PC cap.

- [x] **F02.rank-5-threshold** — Rank 5 minimum training is 30; compare below/exact/above while retaining existing rank and applying PC cap.

- [x] **F02.rank-6-threshold** — Rank 6 minimum training is 40; compare below/exact/above while retaining existing rank and applying PC cap.

- [x] **F02.rank-7-threshold** — Rank 7 minimum training is 55; compare below/exact/above while retaining existing rank and applying PC cap.

- [x] **F02.rank-8-threshold** — Rank 8 minimum training is 75; compare below/exact/above while retaining existing rank and applying PC cap.

- [x] **F02.rank-9-threshold** — Rank 9 minimum training is 105; compare below/exact/above while retaining existing rank and applying PC cap.

- [x] **F02.rank-10-threshold** — Rank 10 minimum training is 160; compare below/exact/above while retaining existing rank and applying PC cap.

- [x] **F02.rank-11-threshold** — Rank 11 minimum training is 235; compare below/exact/above while retaining existing rank and applying PC cap.

- [x] **F02.rank-12-threshold** — Rank 12 minimum training is 330; compare below/exact/above while retaining existing rank and applying PC cap.

- [x] **F02.rank-13-threshold** — Rank 13 minimum training is 475; compare below/exact/above while retaining existing rank and applying PC cap.

- [x] **F02.rank-14-threshold** — Rank 14 minimum training is 665; compare below/exact/above while retaining existing rank and applying PC cap.

- [x] **F02.rank-15-threshold** — Rank 15 minimum training is 855; compare below/exact/above while retaining existing rank and applying PC cap.

- [x] **F02.rank-16-threshold** — Rank 16 minimum training is 1,350; compare below/exact/above while retaining existing rank and applying PC cap.

- [x] **F02.rank-17-threshold** — Rank 17 minimum training is 1,900; compare below/exact/above while retaining existing rank and applying PC cap.

- [x] **F02.rank-18-threshold** — Rank 18 minimum training is 2,700; compare below/exact/above while retaining existing rank and applying PC cap.

- [x] **F02.rank-19-threshold** — Rank 19 minimum training is 3,850; compare below/exact/above while retaining existing rank and applying PC cap.

- [x] **F02.rank-20-threshold** — Rank 20 minimum training is 5,350; compare below/exact/above while retaining existing rank and applying PC cap.

- [x] **COMPLETE.F02** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### F03 — Focus and organization checks

**Included rule reference**

Reference R032 (rules):

**Organization Checks**

- Loyalty: diplomacy/recovery/morale; used for Drill Militia.
- Secrecy: covert operations and stealthy tasks.
- Security: intimidation/resilience/battle/sickness recovery.
- Base bonuses come from rank and focus; officers modify them.

Reference R039 (rules):

**Focus**

- One check is chosen as focused at militia creation.
- Focused check advances faster than two secondary checks.

Reference T016 (numeric tables):

**Table 6-1: Militia Advancement**

| Rank | Minimum Training | Focused Check | Secondary Checks | Max Actions | Max Teams | PC Boon |
|---|---:|---:|---:|---:|---:|---|
| 1 | — | +2 | +0 | 1 | 2 | — |
| 2 | 10 | +3 | +0 | 2 | 2 | Skilled |
| 3 | 15 | +3 | +1 | 2 | 3 | Gift (potion) |
| 4 | 20 | +4 | +1 | 2 | 3 | Title (Director) |
| 5 | 30 | +4 | +1 | 2 | 4 | 1,200 XP |
| 6 | 40 | +5 | +2 | 2 | 4 | Gift (750 gp) |
| 7 | 55 | +5 | +2 | 3 | 4 | Skilled |
| 8 | 75 | +6 | +2 | 3 | 5 | Gift (armor or wand) |
| 9 | 105 | +6 | +3 | 3 | 5 | Title (Captain) |
| 10 | 160 | +7 | +3 | 3 | 5 | 3,200 XP |
| 11 | 235 | +7 | +3 | 4 | 6 | Gift (3,000 gp) |
| 12 | 330 | +8 | +4 | 4 | 6 | Skilled |
| 13 | 475 | +8 | +4 | 4 | 6 | Gift (wand or weapon) |
| 14 | 665 | +9 | +4 | 4 | 6 | Title (Commander) |
| 15 | 855 | +9 | +5 | 5 | 7 | 6,400 XP |
| 16 | 1,350 | +10 | +5 | 5 | 7 | Gift (8,000 gp) |
| 17 | 1,900 | +10 | +5 | 5 | 7 | Skilled |
| 18 | 2,700 | +11 | +6 | 5 | 7 | Gift (magic item) |
| 19 | 3,850 | +11 | +6 | 6 | 7 | Title (Champion) |
| 20 | 5,350 | +12 | +6 | 6 | 8 | 25,600 XP |

Notes:
- Rank never decreases.
- If training drops below a rank threshold, militia keeps current rank.
- Maximum rank is capped by highest-level PC.

**Individual checks — reply with these IDs**

- [x] **F03.rank-focus** — All 20 ranks and three focuses use Table 6-1 focused and secondary bonuses.

- [x] **F03.missing-focus** — Missing focus requires selection; invalid focus is rejected.

- [x] **F03.composition** — Negative, officer and contextual modifiers apply exactly once with explanations.

- [x] **F03.rank-1-focus** — Rank 1: each of Loyalty/Secrecy/Security focuses gets +2; other checks get +0.

- [x] **F03.rank-2-focus** — Rank 2: each of Loyalty/Secrecy/Security focuses gets +3; other checks get +0.

- [x] **F03.rank-3-focus** — Rank 3: each of Loyalty/Secrecy/Security focuses gets +3; other checks get +1.

- [x] **F03.rank-4-focus** — Rank 4: each of Loyalty/Secrecy/Security focuses gets +4; other checks get +1.

- [x] **F03.rank-5-focus** — Rank 5: each of Loyalty/Secrecy/Security focuses gets +4; other checks get +1.

- [x] **F03.rank-6-focus** — Rank 6: each of Loyalty/Secrecy/Security focuses gets +5; other checks get +2.

- [x] **F03.rank-7-focus** — Rank 7: each of Loyalty/Secrecy/Security focuses gets +5; other checks get +2.

- [x] **F03.rank-8-focus** — Rank 8: each of Loyalty/Secrecy/Security focuses gets +6; other checks get +2.

- [x] **F03.rank-9-focus** — Rank 9: each of Loyalty/Secrecy/Security focuses gets +6; other checks get +3.

- [x] **F03.rank-10-focus** — Rank 10: each of Loyalty/Secrecy/Security focuses gets +7; other checks get +3.

- [x] **F03.rank-11-focus** — Rank 11: each of Loyalty/Secrecy/Security focuses gets +7; other checks get +3.

- [x] **F03.rank-12-focus** — Rank 12: each of Loyalty/Secrecy/Security focuses gets +8; other checks get +4.

- [x] **F03.rank-13-focus** — Rank 13: each of Loyalty/Secrecy/Security focuses gets +8; other checks get +4.

- [x] **F03.rank-14-focus** — Rank 14: each of Loyalty/Secrecy/Security focuses gets +9; other checks get +4.

- [x] **F03.rank-15-focus** — Rank 15: each of Loyalty/Secrecy/Security focuses gets +9; other checks get +5.

- [x] **F03.rank-16-focus** — Rank 16: each of Loyalty/Secrecy/Security focuses gets +10; other checks get +5.

- [x] **F03.rank-17-focus** — Rank 17: each of Loyalty/Secrecy/Security focuses gets +10; other checks get +5.

- [x] **F03.rank-18-focus** — Rank 18: each of Loyalty/Secrecy/Security focuses gets +11; other checks get +6.

- [x] **F03.rank-19-focus** — Rank 19: each of Loyalty/Secrecy/Security focuses gets +11; other checks get +6.

- [x] **F03.rank-20-focus** — Rank 20: each of Loyalty/Secrecy/Security focuses gets +12; other checks get +6.

- [x] **COMPLETE.F03** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### F04 — Action allowance

**Included rule reference**

Reference T016 (numeric tables):

**Table 6-1: Militia Advancement**

| Rank | Minimum Training | Focused Check | Secondary Checks | Max Actions | Max Teams | PC Boon |
|---|---:|---:|---:|---:|---:|---|
| 1 | — | +2 | +0 | 1 | 2 | — |
| 2 | 10 | +3 | +0 | 2 | 2 | Skilled |
| 3 | 15 | +3 | +1 | 2 | 3 | Gift (potion) |
| 4 | 20 | +4 | +1 | 2 | 3 | Title (Director) |
| 5 | 30 | +4 | +1 | 2 | 4 | 1,200 XP |
| 6 | 40 | +5 | +2 | 2 | 4 | Gift (750 gp) |
| 7 | 55 | +5 | +2 | 3 | 4 | Skilled |
| 8 | 75 | +6 | +2 | 3 | 5 | Gift (armor or wand) |
| 9 | 105 | +6 | +3 | 3 | 5 | Title (Captain) |
| 10 | 160 | +7 | +3 | 3 | 5 | 3,200 XP |
| 11 | 235 | +7 | +3 | 4 | 6 | Gift (3,000 gp) |
| 12 | 330 | +8 | +4 | 4 | 6 | Skilled |
| 13 | 475 | +8 | +4 | 4 | 6 | Gift (wand or weapon) |
| 14 | 665 | +9 | +4 | 4 | 6 | Title (Commander) |
| 15 | 855 | +9 | +5 | 5 | 7 | 6,400 XP |
| 16 | 1,350 | +10 | +5 | 5 | 7 | Gift (8,000 gp) |
| 17 | 1,900 | +10 | +5 | 5 | 7 | Skilled |
| 18 | 2,700 | +11 | +6 | 5 | 7 | Gift (magic item) |
| 19 | 3,850 | +11 | +6 | 6 | 7 | Title (Champion) |
| 20 | 5,350 | +12 | +6 | 6 | 8 | 25,600 XP |

Notes:
- Rank never decreases.
- If training drops below a rank threshold, militia keeps current rank.
- Maximum rank is capped by highest-level PC.

Reference R076 (rules):

**Militia Actions**

- Actions/week based on rank, modified by Strategist/allies/events.
- Teams typically perform one action each per Activity phase.

**Individual checks — reply with these IDs**

- [x] **F04.allowance** — Rank 1 grants one action; remaining rank boundaries follow Table 6-1.

- [x] **F04.strategist** — Strategist adds one action once even with multiple holders.

- [x] **F04.shrink** — Allowance shrink preserves occupied choices but blocks Confirmation until choices in unavailable slots are moved or cleared, or allowance is restored. A Rules Exception cannot bypass this.

**F04.context — Deferred:** Extra actions from story rewards will be handled in [backlog issue #98](https://github.com/AndreasUnunger/EverythingPath/issues/98). No reply needed for this review.

- [x] **F04.rank-1-actions** — Rank 1 baseline allowance is 1 actions.

- [x] **F04.rank-2-actions** — Rank 2 baseline allowance is 2 actions.

- [x] **F04.rank-3-actions** — Rank 3 baseline allowance is 2 actions.

- [x] **F04.rank-4-actions** — Rank 4 baseline allowance is 2 actions.

- [x] **F04.rank-5-actions** — Rank 5 baseline allowance is 2 actions.

- [x] **F04.rank-6-actions** — Rank 6 baseline allowance is 2 actions.

- [x] **F04.rank-7-actions** — Rank 7 baseline allowance is 3 actions.

- [x] **F04.rank-8-actions** — Rank 8 baseline allowance is 3 actions.

- [x] **F04.rank-9-actions** — Rank 9 baseline allowance is 3 actions.

- [x] **F04.rank-10-actions** — Rank 10 baseline allowance is 3 actions.

- [x] **F04.rank-11-actions** — Rank 11 baseline allowance is 4 actions.

- [x] **F04.rank-12-actions** — Rank 12 baseline allowance is 4 actions.

- [x] **F04.rank-13-actions** — Rank 13 baseline allowance is 4 actions.

- [x] **F04.rank-14-actions** — Rank 14 baseline allowance is 4 actions.

- [x] **F04.rank-15-actions** — Rank 15 baseline allowance is 5 actions.

- [x] **F04.rank-16-actions** — Rank 16 baseline allowance is 5 actions.

- [x] **F04.rank-17-actions** — Rank 17 baseline allowance is 5 actions.

- [x] **F04.rank-18-actions** — Rank 18 baseline allowance is 5 actions.

- [x] **F04.rank-19-actions** — Rank 19 baseline allowance is 6 actions.

- [x] **F04.rank-20-actions** — Rank 20 baseline allowance is 6 actions.

- [x] **COMPLETE.F04** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### F05 — Team capacity

**Included rule reference**

Reference R101 (rules):

**Maximum Teams**

- Rank-based cap (see Table 6-1).
- Bonus teams do not count against cap.

Reference R171 (rules):

**Missing**

- Still counts against team cap.
- Cannot act during Activity phase.
- Start of Upkeep: DC 15 Security check to return at end of week.
- Natural 1 on that check: team is permanently lost.

Reference T003 (numeric tables):

**Rank and Reward Teams**

A militia can never exceed the level of the highest-level PC.

Bonus teams gained as rewards do not count against max teams.

Reference T016 (numeric tables):

**Table 6-1: Militia Advancement**

| Rank | Minimum Training | Focused Check | Secondary Checks | Max Actions | Max Teams | PC Boon |
|---|---:|---:|---:|---:|---:|---|
| 1 | — | +2 | +0 | 1 | 2 | — |
| 2 | 10 | +3 | +0 | 2 | 2 | Skilled |
| 3 | 15 | +3 | +1 | 2 | 3 | Gift (potion) |
| 4 | 20 | +4 | +1 | 2 | 3 | Title (Director) |
| 5 | 30 | +4 | +1 | 2 | 4 | 1,200 XP |
| 6 | 40 | +5 | +2 | 2 | 4 | Gift (750 gp) |
| 7 | 55 | +5 | +2 | 3 | 4 | Skilled |
| 8 | 75 | +6 | +2 | 3 | 5 | Gift (armor or wand) |
| 9 | 105 | +6 | +3 | 3 | 5 | Title (Captain) |
| 10 | 160 | +7 | +3 | 3 | 5 | 3,200 XP |
| 11 | 235 | +7 | +3 | 4 | 6 | Gift (3,000 gp) |
| 12 | 330 | +8 | +4 | 4 | 6 | Skilled |
| 13 | 475 | +8 | +4 | 4 | 6 | Gift (wand or weapon) |
| 14 | 665 | +9 | +4 | 4 | 6 | Title (Commander) |
| 15 | 855 | +9 | +5 | 5 | 7 | 6,400 XP |
| 16 | 1,350 | +10 | +5 | 5 | 7 | Gift (8,000 gp) |
| 17 | 1,900 | +10 | +5 | 5 | 7 | Skilled |
| 18 | 2,700 | +11 | +6 | 5 | 7 | Gift (magic item) |
| 19 | 3,850 | +11 | +6 | 6 | 7 | Title (Champion) |
| 20 | 5,350 | +12 | +6 | 6 | 8 | 25,600 XP |

Notes:
- Rank never decreases.
- If training drops below a rank threshold, militia keeps current rank.
- Maximum rank is capped by highest-level PC.

**Individual checks — reply with these IDs**

- [x] **F05.caps** — All Table 6-1 team caps count active, disabled and missing teams.

- [x] **F05.rewards** — Reward teams do not consume capacity.

- [x] **F05.identity** — Repeated team types retain separate identities and consume separate capacity.

- [x] **F05.order** — Recruitment and dismissal in the same week work in either order when the resulting roster fits team capacity.

- [x] **F05.rank-1-teams** — Rank 1 cap is 2 non-reward teams.

- [x] **F05.rank-2-teams** — Rank 2 cap is 2 non-reward teams.

- [x] **F05.rank-3-teams** — Rank 3 cap is 3 non-reward teams.

- [x] **F05.rank-4-teams** — Rank 4 cap is 3 non-reward teams.

- [x] **F05.rank-5-teams** — Rank 5 cap is 4 non-reward teams.

- [x] **F05.rank-6-teams** — Rank 6 cap is 4 non-reward teams.

- [x] **F05.rank-7-teams** — Rank 7 cap is 4 non-reward teams.

- [x] **F05.rank-8-teams** — Rank 8 cap is 5 non-reward teams.

- [x] **F05.rank-9-teams** — Rank 9 cap is 5 non-reward teams.

- [x] **F05.rank-10-teams** — Rank 10 cap is 5 non-reward teams.

- [x] **F05.rank-11-teams** — Rank 11 cap is 6 non-reward teams.

- [x] **F05.rank-12-teams** — Rank 12 cap is 6 non-reward teams.

- [x] **F05.rank-13-teams** — Rank 13 cap is 6 non-reward teams.

- [x] **F05.rank-14-teams** — Rank 14 cap is 6 non-reward teams.

- [x] **F05.rank-15-teams** — Rank 15 cap is 7 non-reward teams.

- [x] **F05.rank-16-teams** — Rank 16 cap is 7 non-reward teams.

- [x] **F05.rank-17-teams** — Rank 17 cap is 7 non-reward teams.

- [x] **F05.rank-18-teams** — Rank 18 cap is 7 non-reward teams.

- [x] **F05.rank-19-teams** — Rank 19 cap is 7 non-reward teams.

- [x] **F05.rank-20-teams** — Rank 20 cap is 8 non-reward teams.

- [x] **COMPLETE.F05** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### F06 — Resource bounds and precision

**Included rule reference**

Reference R044 (rules):

**Training**

- Starts at 0.
- Main growth source: Drill Militia action.
- Upkeep attrition and events may raise/lower training.
- Training increases can cause rank gains; training losses do not lower rank.

Reference R058 (rules):

**Treasury**

- Starts at 10 gp.
- Used for actions, recruitment, upgrades, event costs.
- Officers can deposit/withdraw during Upkeep step 5.

Reference R064 (rules):

**Minimum Treasury**

- `rank x 10 gp`.
- If treasury falls below minimum during Upkeep, militia loses training.

Reference R069 (rules):

**Notoriety**

- Range 0 to 100.
- Drives weekly event chance.
- Can rise from risky actions and bad outcomes.
- At Notoriety 100, special Upkeep penalties apply.

**Individual checks — reply with these IDs**

- [x] **F06.notoriety** — Calculated Notoriety is bounded 0–100 through additive effects.

- [x] **F06.money** — Minimum treasury is rank times 10 gp; spending and gains retain copper precision.

- [x] **F06.override** — Explicit adjustments appear after the bounded baseline.

- [x] **F06.removed-action** — Deselected actions contribute no stale resource totals.

- [x] **COMPLETE.F06** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### F07 — Settlement reputation

**Included rule reference**

Reference R051 (rules):

**Reputation**

- Tracked per settlement where militia operates.
- Reputation states: Hostile, Unfriendly, Indifferent, Friendly, Helpful.
- Secured settlement: enemy fortifications present.
- Reduce Danger can improve reputation in secured settlements.

Reference T046 (numeric tables):

**Table 6-2: Reputation**

| Reputation | Effects |
|---|---|
| Hostile | Public sightings are reported in `1d4` days; items cost `+5%`; Bluff/Diplomacy/Intimidate DCs `+5`. |
| Unfriendly | Bluff/Diplomacy/Intimidate DCs `+2`; if operating from settlement, add `+5` to the event chance roll (the percentile roll against event chance). |
| Indifferent | No modifier. |
| Friendly | Bluff/Diplomacy/Intimidate DCs `-2`; if operating from settlement, subtract `5` from the event chance roll (the percentile roll against event chance). |
| Helpful | Items cost `-5%`; during Activity while operating here, add `+2` to one Loyalty/Secrecy/Security check. |

**Individual checks — reply with these IDs**

- [x] **F07.hostile** — Hostile shows 1d4-day sightings, +5% prices and +5 social DC.

- [x] **F07.unfriendly** — Unfriendly shows +2 social DC and +5 operating-settlement event result.

- [x] **F07.indifferent** — Indifferent adds no modifier.

- [x] **F07.friendly** — Friendly shows -2 social DC and -5 operating-settlement event result.

- [x] **F07.helpful** — Helpful grants -5% prices and +2 to exactly one eligible Activity check.

- [x] **F07.effective** — Refuge and Reduce Danger shifts affect the selected settlement; Market Day price effects compose.

- [x] **COMPLETE.F07** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### F08 — Rank rewards

**Included rule reference**

Reference T016 (numeric tables):

**Table 6-1: Militia Advancement**

| Rank | Minimum Training | Focused Check | Secondary Checks | Max Actions | Max Teams | PC Boon |
|---|---:|---:|---:|---:|---:|---|
| 1 | — | +2 | +0 | 1 | 2 | — |
| 2 | 10 | +3 | +0 | 2 | 2 | Skilled |
| 3 | 15 | +3 | +1 | 2 | 3 | Gift (potion) |
| 4 | 20 | +4 | +1 | 2 | 3 | Title (Director) |
| 5 | 30 | +4 | +1 | 2 | 4 | 1,200 XP |
| 6 | 40 | +5 | +2 | 2 | 4 | Gift (750 gp) |
| 7 | 55 | +5 | +2 | 3 | 4 | Skilled |
| 8 | 75 | +6 | +2 | 3 | 5 | Gift (armor or wand) |
| 9 | 105 | +6 | +3 | 3 | 5 | Title (Captain) |
| 10 | 160 | +7 | +3 | 3 | 5 | 3,200 XP |
| 11 | 235 | +7 | +3 | 4 | 6 | Gift (3,000 gp) |
| 12 | 330 | +8 | +4 | 4 | 6 | Skilled |
| 13 | 475 | +8 | +4 | 4 | 6 | Gift (wand or weapon) |
| 14 | 665 | +9 | +4 | 4 | 6 | Title (Commander) |
| 15 | 855 | +9 | +5 | 5 | 7 | 6,400 XP |
| 16 | 1,350 | +10 | +5 | 5 | 7 | Gift (8,000 gp) |
| 17 | 1,900 | +10 | +5 | 5 | 7 | Skilled |
| 18 | 2,700 | +11 | +6 | 5 | 7 | Gift (magic item) |
| 19 | 3,850 | +11 | +6 | 6 | 7 | Title (Champion) |
| 20 | 5,350 | +12 | +6 | 6 | 8 | 25,600 XP |

Notes:
- Rank never decreases.
- If training drops below a rank threshold, militia keeps current rank.
- Maximum rank is capped by highest-level PC.

Reference R106 (rules):

**PC Boons by Rank**

- Ranks 2, 7, 12, 17: Skilled (bonus skill rank per PC).
- Ranks 3, 6, 8, 11, 13, 16, 18: Gift (type/value by rank).
- Ranks 4, 9, 14, 19: Title + bonus feat package.
- Ranks 5, 10, 15, 20: XP story award split among PCs.
- Boons apply only to PCs, not NPC officers/cohorts.

**Individual checks — reply with these IDs**

- [x] **F08.skilled** — Ranks 2/7/12/17 award one skill rank to each PC.

- [x] **F08.gifts** — Ranks 3/6/8/11/13/16/18 record the prescribed gift acknowledgement.

- [x] **F08.titles** — Ranks 4/9/14/19 record a title and eligible feat choice.

- [x] **F08.xp** — Ranks 5/10/15/20 split the story XP among PCs.

- [x] **F08.recipients** — Multiple crossed milestones award once to PCs, excluding NPC officers and cohorts.

- [x] **COMPLETE.F08** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### F09 — Boons, qualification, and rounding

**Included rule reference**

Reference T016 (numeric tables):

**Table 6-1: Militia Advancement**

| Rank | Minimum Training | Focused Check | Secondary Checks | Max Actions | Max Teams | PC Boon |
|---|---:|---:|---:|---:|---:|---|
| 1 | — | +2 | +0 | 1 | 2 | — |
| 2 | 10 | +3 | +0 | 2 | 2 | Skilled |
| 3 | 15 | +3 | +1 | 2 | 3 | Gift (potion) |
| 4 | 20 | +4 | +1 | 2 | 3 | Title (Director) |
| 5 | 30 | +4 | +1 | 2 | 4 | 1,200 XP |
| 6 | 40 | +5 | +2 | 2 | 4 | Gift (750 gp) |
| 7 | 55 | +5 | +2 | 3 | 4 | Skilled |
| 8 | 75 | +6 | +2 | 3 | 5 | Gift (armor or wand) |
| 9 | 105 | +6 | +3 | 3 | 5 | Title (Captain) |
| 10 | 160 | +7 | +3 | 3 | 5 | 3,200 XP |
| 11 | 235 | +7 | +3 | 4 | 6 | Gift (3,000 gp) |
| 12 | 330 | +8 | +4 | 4 | 6 | Skilled |
| 13 | 475 | +8 | +4 | 4 | 6 | Gift (wand or weapon) |
| 14 | 665 | +9 | +4 | 4 | 6 | Title (Commander) |
| 15 | 855 | +9 | +5 | 5 | 7 | 6,400 XP |
| 16 | 1,350 | +10 | +5 | 5 | 7 | Gift (8,000 gp) |
| 17 | 1,900 | +10 | +5 | 5 | 7 | Skilled |
| 18 | 2,700 | +11 | +6 | 5 | 7 | Gift (magic item) |
| 19 | 3,850 | +11 | +6 | 6 | 7 | Title (Champion) |
| 20 | 5,350 | +12 | +6 | 6 | 8 | 25,600 XP |

Notes:
- Rank never decreases.
- If training drops below a rank threshold, militia keeps current rank.
- Maximum rank is capped by highest-level PC.

Reference R114 (rules):

**Title Feat Packages**

- Director (rank 4): Alertness, Deceitful, Persuasive, or Stealthy.
- Captain (rank 9): Great Fortitude, Iron Will, or Lightning Reflexes.
- Commander (rank 14): Fleet, Improved Initiative, or Toughness.
- Champion (rank 19): any feat the PC qualifies for.

**Individual checks — reply with these IDs**

- [x] **F09.context-money** — Preparation preserves integer copper values, including zero, separately from unknown money.

- [x] **F09.packages** — Gift choices and title feats match the exact packages in the cited source.

- [x] **F09.xp-rounding** — 1200/3200/6400/25600 XP split among PCs rounds down.

- [x] **F09.qualification** — Champion feat requires qualification or an explicit Rules Exception.

- [x] **F09.acknowledgement** — Chosen rewards and narrative acknowledgement persist in confirmed history.

- [x] **COMPLETE.F09** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### O01 — Multiple holders per role; bonuses do not stack except Commandant.

**Included rule reference**

Reference R121 (rules):

**Officers**

Multiple officers can fill the same role, but their bonuses do not stack (except for the commandant, per the source rules).

**Individual checks — reply with these IDs**

- [x] **O01.roster-holders** — Roster preparation retains multiple holders and character identities during removal or reassignment; legacy holders map to singleton assignments.

- [x] **O01.nonstack** — Multiple holders select one applicable role bonus rather than summing.

- [x] **O01.commandants** — Commandant Hit Dice stack.

- [x] **O01.ordered-role** — Ordered assignment and removal recompute later checks.

- [x] **COMPLETE.O01** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### O02 — Ambassador, Marshal, and Spymaster: automatic check bonuses

**Included rule reference**

Reference R125 (rules):

**Ambassador**

- Adds Constitution or Charisma modifier to militia Loyalty checks.

Reference R133 (rules):

**Marshal**

- Adds Strength or Wisdom modifier to militia Security checks.

Reference R145 (rules):

**Spymaster**

- Adds Dexterity or Intelligence modifier to Secrecy checks.

**Individual checks — reply with these IDs**

- [x] **O02.ambassador** — Ambassador automatically uses the higher Constitution or Charisma modifier for Loyalty, and the highest applicable bonus across assigned Ambassadors; no manual selection.

- [x] **O02.marshal** — Marshal automatically uses the higher Strength or Wisdom modifier for Security, and the highest applicable bonus across assigned Marshals; no manual selection.

- [x] **O02.spymaster** — Spymaster automatically uses the higher Dexterity or Intelligence modifier for Secrecy, and the highest applicable bonus across assigned Spymasters; no manual selection.

- [x] **O02.identity** — Missing character records require correction and archived holders are flagged. The highest applicable modifier is used automatically, including ties and all-negative modifiers (for example, −1 beats −2).

- [x] **COMPLETE.O02** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### O03 — Commandant adds Hit Dice only on successful Drill; Commandants stack.

**Included rule reference**

Reference R129 (rules):

**Commandant**

- On successful Drill Militia Loyalty check, training gained increases by commandant Hit Dice.

**Individual checks — reply with these IDs**

- [x] **O03.roster-hit-dice** — Roster preparation retains explicit Commandant Hit Dice separately from level and reports unknown legacy Hit Dice for preflight resolution.

- [x] **O03.success** — Successful Drill adds all Commandant Hit Dice, including NPC HD differing from level.

- [x] **O03.failure** — Failed Drill adds no Commandant training.

- [x] **O03.natural-one** — Natural 1 can still succeed and add Commandants while adding rolled Notoriety.

- [x] **COMPLETE.O03** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### O04 — Overseer +1 to both secondary checks; organization checks throughout one chosen event may receive the appropriate best ability modifier.

**Included rule reference**

Reference R137 (rules):

**Overseer**

- Grants +1 bonus to both secondary checks.
- During the resolution of one chosen event, can add the appropriate modifier to its organization checks:
  - Charisma/Constitution to Loyalty, or
  - Strength/Wisdom to Security, or
  - Dexterity/Intelligence to Secrecy.

**Individual checks — reply with these IDs**

- [x] **O04.secondary** — Overseer adds +1 to both secondary checks, not focused checks.

- [x] **O04.event** — Organization checks during one selected event’s resolution receive the Overseer’s appropriate best ability modifier; support is not consumed by the first check.

- [x] **O04.one-use** — Support can apply to multiple checks within the same event occurrence, but cannot also apply to a different event occurrence that week.

- [x] **O04.absent** — No Overseer contributes no bonus; included modifiers are not added twice.

- [x] **COMPLETE.O04** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### O05 — Strategist grants one action with +2 on that action's related checks; same-role bonuses do not stack.

**Included rule reference**

Reference R149 (rules):

**Strategist**

- Grants +1 bonus militia action in Activity phase.
- Bonus action receives +2 on related organization checks.

**Individual checks — reply with these IDs**

- [x] **O05.slot** — The designated bonus action slot visibly shows “Strategist +2”, including when empty; only its action receives +2 to all related organization checks.

- [x] **O05.holders** — Multiple Strategists grant one action and one designated bonus.

- [x] **O05.ordered** — Assigning, removing and reassigning Strategist recomputes later allowance without deleting choices.

- [x] **COMPLETE.O05** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### O06 — Team managers

**Included rule reference**

Reference R093 (rules):

**Officers and Teams Management**

- Officer name and bonuses should be tracked explicitly.
- Team manager limits:
  - PC or officer NPC: up to Charisma modifier teams (minimum 1).
  - Non-officer: one team.
- Team actions add manager Charisma bonus to required organization checks.

**Individual checks — reply with these IDs**

- [x] **O06.roster-manager-warnings** — Roster preparation validates campaign-scoped manager references and warns about manager limits without rejecting structurally valid rosters.

- [x] **O06.capacity** — PC or officer NPC manages max(1, Charisma modifier) teams; other NPC manages one.

- [x] **O06.checks** — Each team check uses its own manager Charisma bonus exactly once.

- [x] **O06.changes** — The current manager applies to that team throughout the draft; changing the manager recomputes all of that team’s checks in the draft.

  **Decision recorded — CHOICE A (2026-09-23).** The current manager applies throughout the draft, and changing that assignment recomputes the whole draft. No between-action manager-change timeline is required.

- [x] **O06.references** — Missing or archived manager identities are surfaced rather than fabricated.

- [x] **COMPLETE.O06** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### U01 — Upkeep → Activity → Event; first militia week skips Upkeep.

**Included rule reference**

Reference R208 (rules):

**Weekly Sequence (Militias in Play)**

Order is fixed each week:
1. Upkeep
2. Activity
3. Event

First week of militia use skips Upkeep.

**Individual checks — reply with these IDs**

- [x] **U01.context-first-use** — Editing the proposed week records whether the militia is newly founded or resuming play, without executing Upkeep or changing committed state. Previous-week carryover applies only when a previous militia week exists.

- [x] **U01.sequence** — Upkeep precedes Activity, which precedes Event.

- [x] **U01.first-use** — Only a newly founded militia’s first-ever week skips Upkeep. A militia set up to resume a later week runs Upkeep, even on its first week using the app.

- [x] **U01.import** — Setup for an existing militia resuming a later week records that its first-ever week has already passed; using the app for the first time does not grant an Upkeep skip.

- [x] **U01.recompute** — Earlier phase edits recompute downstream eligibility and outcomes.

- [x] **COMPLETE.U01** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### U02 — Upkeep step 1: Loyalty DC10; success lose 1d6, nat20 gain 1d6, failure lose 2d4+rank.

**Included rule reference**

Reference R219 (rules):

**Step 1: Training Attrition**

- Attempt DC 10 Loyalty.
- Success: training `-1d6`.
- Natural 20: training `+1d6` instead.
- Failure: training decreases by `2d4 + rank`.

**Individual checks — reply with these IDs**

- [x] **U02.success** — Loyalty total 10 or higher loses rolled 1d6 training.

- [x] **U02.failure** — Loyalty total 9 or lower loses rolled 2d4 plus rank.

- [x] **U02.natural-twenty** — Natural 20 gains rolled 1d6 training instead of losing training.

- [x] **U02.modifiers** — Officer and queued modifiers compose once; Week of Pain doubles losses, not natural-20 gain.

- [x] **U02.readiness** — Missing required check or loss/gain dice prevents complete readiness.

- [x] **COMPLETE.U02** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### U03 — At Notoriety100 lose 1d20+rank and fail Loyalty DC15 → nearest settlement one step down, floor Unfriendly.

**Included rule reference**

Reference R226 (rules):

**Step 2: Maximum-Notoriety Penalties**

If Notoriety is 100:
- Training decreases by `1d20 + rank`.
- Attempt DC 15 Loyalty or reputation in nearest settlement drops one step (not below Unfriendly through this effect).

**Individual checks — reply with these IDs**

- [x] **U03.threshold** — Notoriety 99 has no maximum penalty; 100 loses 1d20 plus rank.

- [x] **U03.reputation** — Failed Loyalty DC15 reduces nearest settlement one step with Unfriendly floor.

- [x] **U03.inputs** — Missing applicable die, check or settlement blocks Confirmation.

- [x] **U03.recompute** — Projected Notoriety and queued Loyalty modifiers control applicability and clear stale penalties.

- [x] **COMPLETE.U03** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### U04 — Step 3 below rank×10 treasury loses 2d4+rank; step 4 rank increases after losses, possibly multiple ranks, capped at highest PC; boons immediate.

**Included rule reference**

Reference R232 (rules):

**Step 3: Treasury-Shortage Penalties**

If treasury is below minimum:
- Training decreases by `2d4 + rank`.

Reference R237 (rules):

**Step 4: Increase Rank**

- Apply rank increases from current training.
- Can gain multiple ranks at once.
- Cannot exceed highest-level PC.
- Apply boons immediately.

**Individual checks — reply with these IDs**

- [x] **U04.shortage** — Treasury below rank times 10 after recovery payments loses rolled 2d4 plus rank.

- [x] **U04.boundary** — Exactly minimum treasury avoids shortage; later deposits do not erase it.

- [x] **U04.rank** — Rank increases use post-loss training, cross multiple thresholds and stop at PC cap.

- [x] **U04.boons** — Each newly crossed boon is calculated immediately once.

- [x] **COMPLETE.U04** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### U05 — Step 5 any officer may deposit/withdraw after prior steps.

**Included rule reference**

Reference R244 (rules):

**Step 5: Deposits and Withdrawals**

- Any officer may deposit/withdraw gold from militia treasury.

**Individual checks — reply with these IDs**

- [x] **U05.order** — Deposits and withdrawals are staged after preceding Upkeep steps.

- [x] **U05.preview** — Preview includes all deposits and withdrawals before Event Theft.

- [x] **U05.authority** — Allowed players can stage transfers; Confirmation applies them once under races.

- [x] **COMPLETE.U05** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### U06 — Event: Theft (Persistent-capable)

**Included rule reference**

Reference R208 (rules):

**Weekly Sequence (Militias in Play)**

Order is fixed each week:
1. Upkeep
2. Activity
3. Event

First week of militia use skips Upkeep.

Reference R248 (rules):

**Activity Phase**

- Militia takes actions up to current action cap (plus modifiers).
- Actions can be any order.
- Teams generally cannot act more than once in phase.

Reference R567 (rules):

**Event: Theft (Persistent-capable)**

- Militia treasury is halved.
- Mitigate: DC 20 Loyalty reduces loss to 10% instead.
- Twice: becomes persistent and militia loses half of all incoming treasury gains until successful Reduce Danger action.

**Individual checks — reply with these IDs**

- [x] **U06.cost-theft** — Activity costs precede Event Theft so theft uses remaining treasury.

- [x] **U06.deposit-theft** — Deposits precede Event Theft and use persistent incoming-gain policy.

- [x] **U06.action-order** — Reordering two dependent actions changes the later result and availability.

- [x] **U06.failure** — Failed preceding operations recompute later capacity and costs without stale gains.

- [x] **COMPLETE.U06** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### T01 — Espionage: Moles

**Included rule reference**

Reference T001 (numeric tables):

**Ironfang Militia Structured Tables**

Reference R180 (rules):

**Espionage**

- Moles (T1): Recruitment Secrecy DC 15; action `Secure Cache`; size 3; upgrades to Propagandists.
- Propagandists (T2): Cost 250 gp; actions `Secure Cache`, `Spread Propaganda`; size 3; from Moles.
- Saboteurs (T3): Cost 1,000 gp; actions `Sabotage`, `Secure Cache`, `Spread Propaganda`; size 3; from Propagandists.
- Spies (T3): Cost 1,000 gp; actions `Covert Action`, `Secure Cache`, `Spread Propaganda`; size 3; from Propagandists.

**Individual checks — reply with these IDs**

- [x] **T01.recruit** — Moles are tier 1, size 3, Secrecy DC15.

- [x] **T01.upgrade** — Propagandists cost 250 gp; Saboteurs and Spies each cost 1000 gp.

- [x] **T01.inherit** — Both branches inherit all earlier actions; cross-tree and skipped-tier upgrades warn.

- [x] **COMPLETE.T01** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### T02 — Intelligence: Informants

**Included rule reference**

Reference T001 (numeric tables):

**Ironfang Militia Structured Tables**

Reference R187 (rules):

**Intelligence**

- Informants (T1): Recruitment Loyalty DC 10; action `Gather Information`; size 6; upgrades to Conspirators.
- Conspirators (T2): Cost 250 gp; actions `Activate Refuge`, `Gather Information`; size 6; from Informants.
- Scholars (T3): Cost 1,000 gp; actions `Activate Refuge`, `Gather Information`, `Knowledge Check`; size 6; from Conspirators.
- Spellcasters (T3): Cost 1,000 gp; actions `Activate Refuge`, `Gather Information`, `Restore Character`; size 6; from Conspirators.

**Individual checks — reply with these IDs**

- [x] **T02.recruit** — Informants are tier 1, size 6, Loyalty DC10.

- [x] **T02.upgrade** — Conspirators cost 250 gp; Scholars and Spellcasters each cost 1000 gp.

- [x] **T02.inherit** — Both branches inherit all earlier actions; invalid edges warn.

- [x] **COMPLETE.T02** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### T03 — Military: Defenders

**Included rule reference**

Reference T001 (numeric tables):

**Ironfang Militia Structured Tables**

Reference R194 (rules):

**Military**

- Defenders (T1): Recruitment Security DC 15; action `Reduce Danger`; size 6; upgrades to Infiltrators.
- Infiltrators (T2): Cost 250 gp; actions `Reduce Danger`, `Rescue Character`; size 6; from Defenders.
- Guardians (T3): Cost 1,000 gp; actions `Manipulate Events`, `Reduce Danger`, `Rescue Character`; size 6; from Infiltrators.
- Specialists (T3): Cost 1,000 gp; actions `Reduce Danger`, `Rescue Character`, `Strike Team`; size 6; from Infiltrators.

**Individual checks — reply with these IDs**

- [x] **T03.recruit** — Defenders are tier 1, size 6, Security DC15.

- [x] **T03.upgrade** — Infiltrators cost 250 gp; Guardians and Specialists each display and charge 1000 gp.

- [x] **T03.inherit** — Both military branches inherit all earlier actions.

- [x] **COMPLETE.T03** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### T04 — Treasury: Patrons

**Included rule reference**

Reference T001 (numeric tables):

**Ironfang Militia Structured Tables**

Reference R201 (rules):

**Treasury**

- Patrons (T1): Recruitment Loyalty DC 10; action `Earn Gold`; size 6; upgrades to Merchants.
- Merchants (T2): Cost 50 gp; actions `Broker Market`, `Earn Gold`; size 6; from Patrons.
- Black Marketeers (T3): Cost 200 gp; actions `Activate Black Market`, `Broker Market`, `Earn Gold`; size 6; from Merchants.
- Fixers (T3): Cost 200 gp; actions `Broker Market`, `Earn Gold`, `Special Order`; size 6; from Merchants.

**Individual checks — reply with these IDs**

- [x] **T04.recruit** — Patrons are tier 1, size 6, Loyalty DC10.

- [x] **T04.upgrade** — Merchants cost 50 gp; Black Marketeers and Fixers each cost 200 gp.

- [x] **T04.inherit** — Both treasury branches inherit all earlier actions.

- [x] **COMPLETE.T04** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### T05 — Action: Upgrade Team

**Included rule reference**

Reference R154 (rules):

**Teams**

- Categories: Espionage, Intelligence, Military, Treasury.
- New teams are recruited at tier 1.
- Tier 1 upgrades to tier 2, then tier 3 branches.
- Upgraded teams retain previously granted actions.
- Recruited tier 1 team can act immediately if actions remain.
- Newly upgraded tier 2/3 team cannot act that same Activity phase.

Reference R443 (rules):

**Action: Upgrade Team**

- No team required.
- Spend listed upgrade cost.
- Any number of teams can be upgraded in a week if action slots and gold allow.
- Each specific team can be upgraded at most once per week.

**Individual checks — reply with these IDs**

- [x] **T05.recruit-act** — Successful new tier-1 recruits can act immediately when slots remain.

- [x] **T05.failed-recruit** — Failed recruitment creates no team to act.

- [x] **T05.upgrade-act** — An upgraded team cannot act that Activity; ordered prior actions remain accounted for.

- [x] **T05.repeat-upgrade** — Each team upgrades at most once per week; different teams can upgrade independently.

- [x] **COMPLETE.T05** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### T06 — Each team generally one action/Activity; cap and action capability; Lie Low exclusive; Drill once.

**Included rule reference**

Reference R248 (rules):

**Activity Phase**

- Militia takes actions up to current action cap (plus modifiers).
- Actions can be any order.
- Teams generally cannot act more than once in phase.

**Individual checks — reply with these IDs**

- [x] **T06.roster-identities** — Roster preparation preserves individual identities for repeated types and reward exemptions; cap warnings do not remove teams.

- [x] **T06.team-use** — One team normally takes one Activity action; two teams can select the same repeatable action.

- [x] **T06.capability** — Team capability, condition and slot allowance produce specific eligibility warnings.

- [x] **T06.lie-low** — Lie Low excludes other Activity actions.

- [x] **T06.drill** — Drill appears at most once per Activity.

- [x] **T06.exception** — A shared reasoned Rules Exception permits an unusual choice without changing arithmetic.

- [x] **COMPLETE.T06** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### T07 — Disabled cannot act; start-Upkeep recovery costs current minimum; narrative alternatives allowed.

**Included rule reference**

Reference R165 (rules):

**Disabled**

- Team cannot act during Activity phase.
- Recover at start of Upkeep by paying current minimum treasury value.
- GM can allow narrative recovery alternatives.

**Individual checks — reply with these IDs**

- [x] **T07.roster-conditions** — Roster preparation retains independent disabled and missing conditions for individual teams of the same type.

- [x] **T07.disabled** — Disabled teams cannot act until recovery.

- [x] **T07.payment** — Each selected disabled team recovers at start-Upkeep for current minimum treasury.

- [x] **T07.narrative** — Narrative recovery records adjudication and enables same-week action.

- [x] **T07.funds** — Insufficient recovery funds produce an advisory warning and exception path.

- [x] **COMPLETE.T07** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### T08 — Missing cannot act, still counts; DC15 Security at start-Upkeep returns end-week; nat1 permanently lost.

**Included rule reference**

Reference R171 (rules):

**Missing**

- Still counts against team cap.
- Cannot act during Activity phase.
- Start of Upkeep: DC 15 Security check to return at end of week.
- Natural 1 on that check: team is permanently lost.

**Individual checks — reply with these IDs**

- [x] **T08.return** — Security DC15 returns a missing team at end-week, unavailable during Activity.

- [x] **T08.failure** — Total 14 fails recovery; natural 1 permanently loses the team even with a high modifier.

- [x] **T08.capacity** — Missing teams still count toward capacity.

- [x] **T08.ordering** — Scheduled return, Sickness and Turn Around use explicit ordered condition outcomes.

- [x] **COMPLETE.T08** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A01 — Action: Activate Black Market

**Included rule reference**

Reference R254 (rules):

**Action: Activate Black Market**

- Team: Black Marketeers.
- Cost: 50 gp.
- Check: DC 20 Secrecy.
- Success: black market active 1 week; availability roll threshold rises to 90%; sold magic items return 55% value; contraband/hard-to-sell items can be sold.
- Failure: Notoriety `+1d6`.

**Individual checks — reply with these IDs**

- [x] **A01.success** — Black Marketeers pay 50 gp and Secrecy DC20 opens a one-week market with 90% availability and 55% sale profile.

- [x] **A01.failure** — Total 19 fails, still charges 50 gp and adds 1d6 Notoriety.

- [x] **A01.lifecycle** — Separate markets retain independent targets and expire after one week.

- [x] **A01.inputs** — Missing check or failure die prevents complete readiness.

- [x] **COMPLETE.A01** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A02 — Action: Activate Refuge

**Included rule reference**

Reference R262 (rules):

**Action: Activate Refuge**

- Teams: Conspirators, Scholars, Spellcasters.
- Effect: in Hostile/Unfriendly settlement, treat reputation as one step better while active.
- Refuge lasts 1 week and can be renewed.

**Individual checks — reply with these IDs**

- [x] **A02.reputation** — Conspirators, Scholars or Spellcasters make Hostile or Unfriendly refuge reputation one step better.

- [x] **A02.duration** — Refuge activation or renewal lasts one week.

- [x] **A02.interactions** — Active refuge is available to same-week rescue and scoped Raid outcomes.

- [x] **COMPLETE.A02** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A03 — Action: Broker Market

**Included rule reference**

Reference R268 (rules):

**Action: Broker Market**

- Teams: Black Marketeers, Fixers, Merchants.
- Cost: 100 gp.
- Effect: temporary market source.
- Merchants act as small town availability.
- Black Marketeers/Fixers act as small city availability.
- Purchase paid on activation; items arrive at next Activity phase.

**Individual checks — reply with these IDs**

- [x] **A03.profiles** — Merchants broker small-town markets; Black Marketeers and Fixers broker small-city markets.

- [x] **A03.payment** — Activation costs 100 gp plus all purchases paid upfront.

- [x] **A03.delivery** — Each order arrives next Activity, independently of Special Order day timing.

- [x] **A03.expiry** — Market duration and delivered item availability follow the source without duplicate receipt.

- [x] **COMPLETE.A03** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A04 — Action: Change Officer Role

**Included rule reference**

Reference R277 (rules):

**Action: Change Officer Role**

- No team required.
- One PC changes officer role.
- Allies/cohorts cannot change roles with this action.

**Individual checks — reply with these IDs**

- [x] **A04.pc** — One no-team action changes one PC role; ally or cohort departure needs Rules Exception.

- [x] **A04.move** — Move or unassign preserves character records.

- [x] **A04.order** — Role changes affect later checks and consume their own actions.

- [x] **COMPLETE.A04** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A05 — Action: Covert Action

**Included rule reference**

Reference R283 (rules):

**Action: Covert Action**

- Team: Spies.
- Effect option 1: augment immediately following militia action:
  - add spies manager Charisma bonus to all d20 rolls for that action.
  - if action succeeds, Notoriety does not increase from that action.
- Effect option 2: place contact/cache in specific adventure site for 1 week.

**Individual checks — reply with these IDs**

- [x] **A05.next** — Spies give manager Charisma to all d20 rolls of the immediately following action only.

- [x] **A05.success** — Successful target action produces no action Notoriety, including natural-1 success.

- [x] **A05.failure** — Failed target action keeps its Notoriety; unrelated same-type actions gain no benefit.

- [x] **A05.contact** — Alternative contact or cache at a chosen site lasts one week.

- [x] **A05.raid** — Contact rescue and Raid override compose identically in browser and server.

- [x] **COMPLETE.A05** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A06 — Action: Dismiss Team

**Included rule reference**

Reference R291 (rules):

**Action: Dismiss Team**

- No team required.
- DC 10 Loyalty.
- Removes a team, freeing slot.
- Failure: Notoriety `+1d6`.

**Individual checks — reply with these IDs**

- [x] **A06.success** — Loyalty DC10 removes the chosen team.

- [x] **A06.failure** — Loyalty total 9 still removes the team and adds rolled 1d6 Notoriety.

- [x] **A06.capacity** — Removal frees capacity for recruitment in the same week regardless of slot order; repeated dismissal cannot remove the same team twice.

- [x] **COMPLETE.A06** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A07 — Action: Drill Militia

**Included rule reference**

Reference R298 (rules):

**Action: Drill Militia**

- No team required.
- Once per Activity phase.
- Cost: minimum treasury value.
- Check: Loyalty vs `10 + rank`.
- Success: training `+2d6` plus Commandant bonuses.
- Natural 1: no auto-fail, but Notoriety `+1d6`.
- Not available if militia already at current maximum rank.

**Individual checks — reply with these IDs**

- [x] **A07.cost** — One no-team Drill costs rank times 10 gp even on failure.

- [x] **A07.success** — Loyalty DC10 plus rank gains rolled 2d6 plus summed Commandant Hit Dice.

- [x] **A07.natural-one** — Natural 1 can succeed but also adds rolled 1d6 Notoriety.

- [x] **A07.maximum** — At maximum rank Drill is unavailable by baseline with a reasoned exception path.

- [x] **A07.removed** — Removing or failing Drill removes its gain; no staged Drill means no Drill training.

- [x] **COMPLETE.A07** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A08 — Action: Earn Gold

**Included rule reference**

Reference R308 (rules):

**Action: Earn Gold**

- Teams: Black Marketeers, Fixers, Merchants, Patrons.
- Check: Loyalty.
- Gold gained: `check result x team tier` gp.
- Natural 1: still gain gold, but Notoriety `+1d6`.

**Individual checks — reply with these IDs**

- [x] **A08.tiers** — Treasury teams earn Loyalty total times their tier for tiers 1/2/3.

- [x] **A08.natural-one** — Natural 1 still earns gold and adds rolled 1d6 Notoriety.

- [x] **A08.composition** — Queued and manager bonuses affect earned gold exactly once per team.

- [x] **A08.removed** — Clearing an action removes its earnings; invalid or exceptional negative outcomes remain explicit.

- [x] **COMPLETE.A08** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A09 — Action: Gather Information

**Included rule reference**

Reference R315 (rules):

**Action: Gather Information**

- Teams: Conspirators, Informants, Scholars, Spellcasters.
- Check: DC 15 Secrecy with bonus `+2 x team tier`.
- Success yields rumor/location/person/settlement intelligence as GM allows.
- Natural 1: no auto-fail, but Notoriety `+1d6`.

**Individual checks — reply with these IDs**

- [x] **A09.tiers** — Intelligence teams add twice their tier to Secrecy against DC15.

- [x] **A09.natural-one** — Natural 1 is not automatic failure and adds 1d6 Notoriety.

- [x] **A09.acknowledgement** — Successful intelligence requires recorded GM outcome acknowledgement.

- [x] **A09.repeat** — Separate teams retain independent checks and outcomes.

- [x] **COMPLETE.A09** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A10 — Action: Guarantee Event

**Included rule reference**

Reference R322 (rules):

**Action: Guarantee Event**

- No team required.
- Cost: minimum treasury value.
- Also increase Notoriety by `+1d6`.
- Effect: event guaranteed this week; GM rolls twice and PCs choose event.

**Individual checks — reply with these IDs**

- [x] **A10.cost** — No-team Guarantee Event costs rank times 10 gp and adds 1d6 Notoriety per action.

- [x] **A10.choice** — Both event rolls and explicit chosen result are required.

- [x] **A10.roll-twice** — Chosen Roll Twice expands to two valid final events.

- [x] **A10.precedence** — Forced All Is Calm and Sabotage use explicit event precedence rather than stale inputs.

- [x] **COMPLETE.A10** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A11 — Action: Knowledge Check

**Included rule reference**

Reference R329 (rules):

**Action: Knowledge Check**

- Team: Scholars.
- Resolve requested knowledge by rolling Secrecy check + militia rank.
- Total is treated as achieved Knowledge DC.
- Can identify magic items and evaluate monsters/NPC abilities.

**Individual checks — reply with these IDs**

- [x] **A11.dc** — Scholars add rank to modified Secrecy total to determine achieved Knowledge DC.

- [x] **A11.record** — Identification or evaluation outcome and acknowledgement remain in confirmed source.

- [x] **COMPLETE.A11** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A12 — Action: Lie Low

**Included rule reference**

Reference R336 (rules):

**Action: Lie Low**

- No team required.
- Must be only action taken this Activity phase.
- Notoriety decreases by total number of teams.

**Individual checks — reply with these IDs**

- [x] **A12.exclusive** — No-team Lie Low is normally the only Activity action.

- [x] **A12.count** — Notoriety reduction counts active, disabled, missing and bonus teams.

- [x] **A12.floor** — Zero teams reduces nothing; reduction below zero stops at baseline zero.

- [x] **A12.exception** — Additional actions require a reasoned Rules Exception without rewriting the reduction.

- [x] **COMPLETE.A12** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A13 — Action: Manipulate Events

**Included rule reference**

Reference R342 (rules):

**Action: Manipulate Events**

- Team: Guardians.
- Guarantees an event this week.
- GM rolls twice on event table.
- Any player can choose which of the two rolled events occurs.

**Individual checks — reply with these IDs**

- [x] **A13.team** — Available Guardians guarantee an event with two rolls and one chosen result.

- [x] **A13.chooser** — Any player can choose which of the two guaranteed event results occurs; the choice needs no chooser identity.

- [x] **A13.composition** — Guarantee Event and selected Roll Twice do not accidentally duplicate or discard results.

- [x] **COMPLETE.A13** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A14 — Action: Recruit Team

**Included rule reference**

Reference R349 (rules):

**Action: Recruit Team**

- No team required.
- Requires free non-bonus team slot.
- Uses team-specific recruitment check and DC.
- Natural 1: no auto-fail, but Notoriety `+1d6`.

Reference R154 (rules):

**Teams**

- Categories: Espionage, Intelligence, Military, Treasury.
- New teams are recruited at tier 1.
- Tier 1 upgrades to tier 2, then tier 3 branches.
- Upgraded teams retain previously granted actions.
- Recruited tier 1 team can act immediately if actions remain.
- Newly upgraded tier 2/3 team cannot act that same Activity phase.

**Individual checks — reply with these IDs**

- [x] **A14.checks** — Tier-1 recruitment uses each of the four tree-specific checks and DCs.

- [x] **A14.capacity** — Recruitment checks non-reward team capacity after the week’s Activity actions, accounting for dismissal in either order even on dismissal failure.

- [x] **A14.natural-one** — Natural 1 can succeed but adds 1d6 Notoriety.

- [x] **A14.identity** — Successful repeated types create independent teams that may act immediately.

- [x] **COMPLETE.A14** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A15 — Action: Reduce Danger

**Included rule reference**

Reference R356 (rules):

**Action: Reduce Danger**

- Teams: Defenders, Guardians, Infiltrators, Specialists.
- Check: DC 15 Security.
- Success: temporary +1 reputation step for week in target town; militia members can walk openly in hostile/unfriendly settlements.
- Failure: Notoriety `+1d4`.

**Individual checks — reply with these IDs**

- [x] **A15.success** — Military team Security DC15 gives temporary +1 settlement reputation and open movement reminder.

- [x] **A15.failure** — Total 14 adds 1d4 Notoriety without a reputation gain.

- [x] **A15.duration** — Temporary shift expires after one week and respects secured-town context.

- [x] **A15.theft** — Successful Reduce Danger permanently ends applicable persistent Theft.

- [x] **COMPLETE.A15** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A16 — Action: Rescue Character

**Included rule reference**

Reference R363 (rules):

**Action: Rescue Character**

- Teams: Guardians, Infiltrators, Specialists.
- Check: Security vs `10 + captured character level`.
- Success: captured PC/NPC recovered to militia operating location/refuge.
- Notoriety increases by rescued character level.
- Failure: character not rescued; Notoriety increases by half that amount.
- Some NPCs may require direct PC rescue at GM discretion.

**Individual checks — reply with these IDs**

- [x] **A16.success** — Upgraded military team Security DC10 plus level rescues to a valid location/refuge and adds level Notoriety.

- [x] **A16.failure** — Failed rescue adds floor(level divided by 2) Notoriety.

- [x] **A16.targets** — Missing or invalid target and inactive destination block completion; direct rescue records GM adjudication.

- [x] **A16.modifiers** — Raid DC override and Covert Action suppression apply once.

- [x] **COMPLETE.A16** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A17 — Action: Restore Character

**Included rule reference**

Reference R372 (rules):

**Action: Restore Character**

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

**Individual checks — reply with these IDs**

- [x] **A17.party** — Spellcasters provide the prescribed free party restoration modes.

- [x] **A17.single** — Single-target restoration modes cost 1125, 6125, 1700 or 1650 gp as specified.

- [x] **A17.presence** — Required body must be at HQ or active refuge; captured or invalid targets need correction.

- [x] **A17.multiple** — Multiple restorations sum their distinct costs and retain custom adjudication reasons.

- [x] **COMPLETE.A17** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A18 — Action: Sabotage

**Included rule reference**

Reference R386 (rules):

**Action: Sabotage**

- Team: Saboteurs.
- Reactive during Event phase if saboteurs are available.
- Check DC to negate event: `15 + rank`.
- Notoriety increases by `+1d6` whether success or failure.

**Individual checks — reply with these IDs**

- [x] **A18.availability** — Available Saboteurs can react during Event; disabled or otherwise used teams show eligibility warning.

- [x] **A18.success** — Check DC15 plus rank negates only the selected event and still adds rolled 1d6 Notoriety.

- [x] **A18.failure** — Failed Sabotage still adds 1d6 Notoriety.

- [x] **A18.composition** — Manager, queue and Overseer modifiers apply exactly once; missing dice block readiness.

- [x] **COMPLETE.A18** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A19 — Action: Secure Cache

**Included rule reference**

Reference R393 (rules):

**Action: Secure Cache**

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

Reference R605 (rules):

**Caches**

Reference T091 (numeric tables):

**Cache Thresholds**

| Cache Type | Max Weight | Max Value | Secrecy DC |
|---|---:|---:|---:|
| Minor | 5 lb | 900 gp | 15 |
| Intermediate | 10 lb | 2,500 gp | 20 |
| Major | 20 lb (or more with extradimensional storage) | No value cap | 30 |

Secure location penalty:
- Caching inside secure locations adds `+5` DC and requires tier 3 team (Saboteurs or Spies).

Reference R607 (rules):

**Minor Cache**

- Max 5 lb, max 900 gp.
- Requires DC 15 Secrecy.

Reference R612 (rules):

**Intermediate Cache**

- Max 10 lb, max 2,500 gp.
- Requires DC 20 Secrecy.

Reference R617 (rules):

**Major Cache**

- Max 20 lb (expandable via extradimensional storage), no value cap.
- Requires DC 30 Secrecy.

**Individual checks — reply with these IDs**

- [x] **A19.minor** — Minor cache limits are 5 lb and 900 gp at DC15.

- [x] **A19.intermediate** — Intermediate cache limits are 10 lb and 2500 gp at DC20.

- [x] **A19.major** — Major cache has 20 lb limit or extradimensional storage, no value cap, DC30.

- [x] **A19.secure** — Secure location adds 5 DC and requires tier-3 Saboteurs or Spies.

- [x] **A19.failure** — Failed placement returns the cache next Activity.

- [x] **A19.retrieve** — Placement and retrieval have distinct targets and apply modifiers once; unused retrieval has no effect.

- [x] **COMPLETE.A19** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A20 — Action: Special

**Included rule reference**

Reference R407 (rules):

**Action: Special**

- No team required.
- GM-defined story/event resolution actions.

**Individual checks — reply with these IDs**

- [x] **A20.description** — No-team Special action records GM-defined description and outcome acknowledgement.

- [x] **A20.adjustments** — Zero or nonzero cost/results are explicit; outcome adjustments and eligibility exceptions remain distinct.

- [x] **COMPLETE.A20** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A21 — Action: Special Order

**Included rule reference**

Reference R412 (rules):

**Action: Special Order**

- Team: Fixers.
- Place order for specific item at 5% discount.
- Cost paid upfront.
- Delivery time: `2d6` days.
- Expedited delivery: +900 gp for 1 day delivery.
- Alternative: arrange enchantment on existing magic item.
- Enchantment time: normal delivery time + 1 day per 1,000 gp enchantment cost.
- Limit: one item or enchantment per action.

**Individual checks — reply with these IDs**

- [x] **A21.context-orders** — Preparation retains copper precision, due-day, enchantment duration and explicit receipt separately from next-Activity marketplace timing.

- [x] **A21.price** — Fixers order one item or enchantment with 5% discount paid upfront at Confirmation.

- [x] **A21.ordinary** — Ordinary delivery uses entered 2d6 days including 2 and 12 boundaries.

- [x] **A21.expedite** — Expediting adds 900 gp for one-day delivery.

- [x] **A21.enchantment** — Enchantment adds source-prescribed time per 1000 gp without losing due-day information.

- [x] **A21.receipt** — Orders crossing weeks retain exact due day and explicit receipt applied once.

- [x] **COMPLETE.A21** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A22 — Action: Spread Propaganda

**Included rule reference**

Reference R423 (rules):

**Action: Spread Propaganda**

- Teams: Propagandists, Saboteurs, Spies.
- Cost: 100 gp.
- Check: DC 20 Loyalty.
- Success: improve settlement reputation by one step.
- DC increases by 5 in settlements occupied by enemy troops/major organizations (or may be impossible at GM discretion).
- Settlement can be influenced once per Activity phase.

**Individual checks — reply with these IDs**

- [x] **A22.check** — Espionage tier-2/3 pays 100 gp and rolls Loyalty DC20 or DC25 under occupation.

- [x] **A22.attempt** — Each settlement allows one attempt per Activity even on failure; two settlements are independent.

- [x] **A22.success** — Success improves permanent reputation by one step up to Helpful.

- [x] **A22.adjudication** — GM-disallowed or impossible targets show exception path; malformed references still block.

- [x] **COMPLETE.A22** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A23 — Action: Strike Team

**Included rule reference**

Reference R432 (rules):

**Action: Strike Team**

- Team: Specialists.
- Choose target location when action is taken.
- During following week, once at that location:
  - each PC gains +2 competence to attack, damage, and saves for rounds equal to half militia rank, rounded down with a minimum of one round.
- Alternate use: emergency casualty extraction.
  - Bleeding allies stabilize.
  - Dead allies gain immediate `gentle repose` (CL 12).
  - Bodies extracted to militia HQ.

**Individual checks — reply with these IDs**

- [x] **A23.combat** — Specialists provide +2 competence attack, damage and saves at the chosen location next week for half the militia rank rounded down, with a minimum of one round.

- [x] **A23.rank-one** — Strike Team support lasts at least one round, including at rank 1. Higher durations equal half the militia rank, rounded down.

- [x] **A23.extraction** — Alternative records stabilization, gentle repose CL12 and body extraction.

- [x] **A23.duration** — Support lasts following week, requires location and once-use acknowledgement.

- [x] **COMPLETE.A23** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### A24 — Action: Upgrade Team

**Included rule reference**

Reference R443 (rules):

**Action: Upgrade Team**

- No team required.
- Spend listed upgrade cost.
- Any number of teams can be upgraded in a week if action slots and gold allow.
- Each specific team can be upgraded at most once per week.

**Individual checks — reply with these IDs**

- [x] **A24.edges** — No-team Upgrade uses the selected valid tree edge and listed cost.

- [x] **A24.per-team** — Multiple distinct teams may upgrade but one team cannot upgrade twice per week.

- [x] **A24.preserve** — Upgrade preserves manager and inherited capabilities while preventing same-Activity action.

- [x] **A24.warning** — Insufficient funds or illegal edge needs explicit exception; malformed target blocks.

- [x] **COMPLETE.A24** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### E01 — Percentile trigger: event if roll < chance; base Notoriety, bounds10–95; operating settlement affects event-table result.

**Included rule reference**

Reference R081 (rules):

**Event Chance**

- Event phase uses percentile roll.
- Event occurs if roll is lower than event chance.
- Event chance is primarily Notoriety (min 10%, max 95%).
- After a week with no event, next week gains `+rank` chance.

Reference R452 (rules):

**Event Trigger**

- Roll percentile against event chance.
- Event chance = Notoriety plus modifiers.
- Minimum 10%, maximum 95%.
- After an uneventful week, add rank to event chance for next week.
- Uneventful does not include first militia week.

Reference T056 (numeric tables):

**Table 6-3: Militia Events (d%)**

| d% | Result |
|---|---|
| 1-4 | Week of Serenity |
| 5-12 | War Games |
| 13-16 | Night Ops |
| 17-20 | Broke the Code |
| 21-24 | Found Fire |
| 25-28 | High Morale |
| 29-32 | Turn Around |
| 33-36 | Festival |
| 37-40 | Market Day |
| 41-44 | Hidden Agenda |
| 45-48 | All Is Calm |
| 49-52 | Roll Twice |
| 53-56 | Calm before the Storm |
| 57-60 | Turncoat |
| 61-64 | Cache Discovered |
| 65-68 | Rivalry |
| 69-72 | Missing in Action |
| 73-76 | Theft |
| 77-80 | Raid |
| 81-84 | Invasion |
| 85-88 | Low Morale |
| 89-96 | Sickness |
| 97-99 | Double Agent |
| 100 | Week of Pain |

Event chance rules:
- Base chance: militia Notoriety.
- Minimum chance: 10%.
- Maximum chance: 95%.
- After an uneventful week, add militia rank to next event-chance roll.

**Individual checks — reply with these IDs**

- [x] **E01.bounds** — Event chance clamps to 10–95 after current Notoriety and carry modifiers.

- [x] **E01.trigger** — Roll below chance triggers; equal or above does not.

- [x] **E01.settlement** — Operating settlement modifies table result by plus or minus 5 separately from chance.

- [x] **E01.recompute** — Activity Notoriety and guarantees recompute chance and required inputs after upstream edits.

- [x] **COMPLETE.E01** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### E02 — Every Table6-3 interval: Serenity1–4, War Games5–12, Night Ops13–16, Broke Code17–20, Found Fire21–24, High Morale25–28, Turn Around29–32, Festival33–36, Market Day37–40, Hidden Agenda41–44, All Calm45–48, Roll Twice49–52, Calm Storm53–56, Turncoat57–60, Cache61–64, Rivalry65–68, Missing69–72, Theft73–76, Raid77–80, Invasion81–84, Low Morale85–88, Sickness89–96, Double Agent97–99, Pain100.

**Included rule reference**

Reference T056 (numeric tables):

**Table 6-3: Militia Events (d%)**

| d% | Result |
|---|---|
| 1-4 | Week of Serenity |
| 5-12 | War Games |
| 13-16 | Night Ops |
| 17-20 | Broke the Code |
| 21-24 | Found Fire |
| 25-28 | High Morale |
| 29-32 | Turn Around |
| 33-36 | Festival |
| 37-40 | Market Day |
| 41-44 | Hidden Agenda |
| 45-48 | All Is Calm |
| 49-52 | Roll Twice |
| 53-56 | Calm before the Storm |
| 57-60 | Turncoat |
| 61-64 | Cache Discovered |
| 65-68 | Rivalry |
| 69-72 | Missing in Action |
| 73-76 | Theft |
| 77-80 | Raid |
| 81-84 | Invasion |
| 85-88 | Low Morale |
| 89-96 | Sickness |
| 97-99 | Double Agent |
| 100 | Week of Pain |

Event chance rules:
- Base chance: militia Notoriety.
- Minimum chance: 10%.
- Maximum chance: 95%.
- After an uneventful week, add militia rank to next event-chance roll.

**Individual checks — reply with these IDs**

- [x] **E02.intervals** — Every Table 6-3 lower and upper endpoint maps to its specified event.

- [x] **E02.integrity** — Missing, nonfinite, fractional or out-of-range percentile input is surfaced as invalid input or explicit rules departure as appropriate.

- [x] **E02.parity** — Browser and Convex entry paths produce identical event mapping.

- [x] **E02.interval-1-4** — both endpoints of 1-4 resolve to Week of Serenity.

- [x] **E02.interval-5-12** — both endpoints of 5-12 resolve to War Games.

- [x] **E02.interval-13-16** — both endpoints of 13-16 resolve to Night Ops.

- [x] **E02.interval-17-20** — both endpoints of 17-20 resolve to Broke the Code.

- [x] **E02.interval-21-24** — both endpoints of 21-24 resolve to Found Fire.

- [x] **E02.interval-25-28** — both endpoints of 25-28 resolve to High Morale.

- [x] **E02.interval-29-32** — both endpoints of 29-32 resolve to Turn Around.

- [x] **E02.interval-33-36** — both endpoints of 33-36 resolve to Festival.

- [x] **E02.interval-37-40** — both endpoints of 37-40 resolve to Market Day.

- [x] **E02.interval-41-44** — both endpoints of 41-44 resolve to Hidden Agenda.

- [x] **E02.interval-45-48** — both endpoints of 45-48 resolve to All Is Calm.

- [x] **E02.interval-49-52** — both endpoints of 49-52 resolve to Roll Twice.

- [x] **E02.interval-53-56** — both endpoints of 53-56 resolve to Calm before the Storm.

- [x] **E02.interval-57-60** — both endpoints of 57-60 resolve to Turncoat.

- [x] **E02.interval-61-64** — both endpoints of 61-64 resolve to Cache Discovered.

- [x] **E02.interval-65-68** — both endpoints of 65-68 resolve to Rivalry.

- [x] **E02.interval-69-72** — both endpoints of 69-72 resolve to Missing in Action.

- [x] **E02.interval-73-76** — both endpoints of 73-76 resolve to Theft.

- [x] **E02.interval-77-80** — both endpoints of 77-80 resolve to Raid.

- [x] **E02.interval-81-84** — both endpoints of 81-84 resolve to Invasion.

- [x] **E02.interval-85-88** — both endpoints of 85-88 resolve to Low Morale.

- [x] **E02.interval-89-96** — both endpoints of 89-96 resolve to Sickness.

- [x] **E02.interval-97-99** — both endpoints of 97-99 resolve to Double Agent.

- [x] **E02.interval-100** — both endpoints of 100 resolve to Week of Pain.

- [x] **COMPLETE.E02** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### E03 — If an event cannot occur, reroll.

**Included rule reference**

Reference R460 (rules):

**Event Resolution Notes**

- Settlement modifiers from where militia operates apply.
- If event cannot occur, reroll.
- `Roll Twice` can cause dual event resolution.
- If duplicate event appears in double roll and has `Twice` clause, second application uses that clause.
- Resolve persistent events oldest first.

**Individual checks — reply with these IDs**

- [x] **E03.eligibility** — Events with no eligible roster, cache, refuge or town require replacement rolls.

- [x] **E03.targets** — Inaccessible targets cannot silently stand in for eligible targets.

- [x] **E03.nested** — Replacement rolls remain required after nested Roll Twice until valid outcomes exist.

- [x] **COMPLETE.E03** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### E04 — Event: Roll Twice

**Included rule reference**

Reference R556 (rules):

**Event: Roll Twice**

- Roll and resolve two events.
- Roll Twice can only take effect once per Event phase.
- Additional Roll Twice results in same phase are rerolled.

**Individual checks — reply with these IDs**

- [x] **E04.two** — Roll Twice resolves two independent final occurrences.

- [x] **E04.reroll** — Further Roll Twice results require replacement rolls rather than disappearing.

- [x] **E04.no-clause** — Duplicate without Twice applies both base occurrences independently.

- [x] **E04.clause** — Explicit Twice replacement or enhancement controls duplicate effect; no-additional-effect suppresses the extra effect.

- [x] **E04.independent** — Guarantee and automatic events retain separate target and roll identities in order.

- [x] **COMPLETE.E04** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### E05 — Event: All Is Calm

**Included rule reference**

Reference R081 (rules):

**Event Chance**

- Event phase uses percentile roll.
- Event occurs if roll is lower than event chance.
- Event chance is primarily Notoriety (min 10%, max 95%).
- After a week with no event, next week gains `+rank` chance.

Reference R452 (rules):

**Event Trigger**

- Roll percentile against event chance.
- Event chance = Notoriety plus modifiers.
- Minimum 10%, maximum 95%.
- After an uneventful week, add rank to event chance for next week.
- Uneventful does not include first militia week.

Reference R468 (rules):

**Event: All Is Calm**

- No event this week.
- Twice: next week skip event-chance roll and apply this outcome directly; this does not build the uneventful bonus chain.

Reference R485 (rules):

**Event: Calm before the Storm**

- No event now.
- Next week: roll event table and apply that event automatically (ignore Roll Twice result), then continue with normal Event phase roll.
- This week does not count as uneventful for rank bonus purposes.
- Twice: next week roll two automatic events (ignore all Roll Twice), then run Event phase normally.

Reference T056 (numeric tables):

**Table 6-3: Militia Events (d%)**

| d% | Result |
|---|---|
| 1-4 | Week of Serenity |
| 5-12 | War Games |
| 13-16 | Night Ops |
| 17-20 | Broke the Code |
| 21-24 | Found Fire |
| 25-28 | High Morale |
| 29-32 | Turn Around |
| 33-36 | Festival |
| 37-40 | Market Day |
| 41-44 | Hidden Agenda |
| 45-48 | All Is Calm |
| 49-52 | Roll Twice |
| 53-56 | Calm before the Storm |
| 57-60 | Turncoat |
| 61-64 | Cache Discovered |
| 65-68 | Rivalry |
| 69-72 | Missing in Action |
| 73-76 | Theft |
| 77-80 | Raid |
| 81-84 | Invasion |
| 85-88 | Low Morale |
| 89-96 | Sickness |
| 97-99 | Double Agent |
| 100 | Week of Pain |

Event chance rules:
- Base chance: militia Notoriety.
- Minimum chance: 10%.
- Maximum chance: 95%.
- After an uneventful week, add militia rank to next event-chance roll.

**Individual checks — reply with these IDs**

- [x] **E05.context-carry** — Preparation retains uneventful carry, one-use bonuses and queued durations without executing effects.

- [x] **E05.carry** — Eligible quiet week adds current rank once to next eligible week's bounded event chance, not percentile result.

- [x] **E05.consecutive** — Consecutive quiet weeks do not accumulate prior rank bonuses.

- [x] **E05.rank-change** — Changing rank uses current rank rather than stored old-rank sum.

- [x] **E05.exclusions** — First militia week, forced All Is Calm, Calm before the Storm and automatic events obey uneventful exclusions.

- [x] **COMPLETE.E05** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### E06 — Queued effects apply only due week; preserve future effects, expire used effects.

**Included rule reference**

Reference R088 (rules):

**Active and Persistent Events**

- Track active events until resolved.
- Persistent events continue until ended by mitigation or special spending.

Reference R450 (rules):

**Event Phase**

**Individual checks — reply with these IDs**

- [x] **E06.due** — Only due-week queued effects apply; future effects remain and consumed effects expire.

- [x] **E06.automatic** — Multiple automatic events and normal event keep separate rolls and source order.

- [x] **E06.preserve** — Cutover preserves source, age and due context without running effects.

  **Still pending:** Actual deployment cutover preservation/recovery rehearsal remains pending; context preparation tests do not execute a cutover. You only need to review the intended requirement here; its implementation/rehearsal remains agent work.

- [x] **E06.retry** — Retries do not apply queued effects twice.

- [x] **COMPLETE.E06** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### E07 — Organization modifiers apply to relevant checks, once and in correct phase; team one-check bonuses consumed once.

**Included rule reference**

Reference R137 (rules):

**Overseer**

- Grants +1 bonus to both secondary checks.
- During the resolution of one chosen event, can add the appropriate modifier to its organization checks:
  - Charisma/Constitution to Loyalty, or
  - Strength/Wisdom to Security, or
  - Dexterity/Intelligence to Secrecy.

Reference R149 (rules):

**Strategist**

- Grants +1 bonus militia action in Activity phase.
- Bonus action receives +2 on related organization checks.

**Individual checks — reply with these IDs**

- [x] **E07.phase** — Each queued modifier applies only to its prescribed phase and check type.

- [x] **E07.once** — Officer, manager and queue modifiers compose once with positive and negative values.

- [x] **E07.one-check** — Team one-check bonus is consumed by one eligible check.

- [x] **E07.stale** — Disabled or deselected secondary inputs cannot contribute hidden modifiers.

- [x] **COMPLETE.E07** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV01 — Event: All Is Calm

**Included rule reference**

Reference R468 (rules):

**Event: All Is Calm**

- No event this week.
- Twice: next week skip event-chance roll and apply this outcome directly; this does not build the uneventful bonus chain.

**Individual checks — reply with these IDs**

- [x] **EV01.base** — All Is Calm produces no event.

- [x] **EV01.twice** — Twice forces the same result next week without chance roll or uneventful carry chain.

- [x] **EV01.precedence** — Automatic Calm before the Storm events remain independently accounted for; stale trigger and Sabotage inputs do not execute.

- [x] **COMPLETE.EV01** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV02 — Event: Broke the Code

**Included rule reference**

Reference R473 (rules):

**Event: Broke the Code**

- Identify one magic item of any caster level.
- PCs gain +2 Knowledge (local) for week.
- Twice: bonus becomes +5.

**Individual checks — reply with these IDs**

- [x] **EV02.base** — Identify one item of any caster level and give +2 Knowledge local for one week.

- [x] **EV02.twice** — Twice replaces bonus with +5 rather than adding duplicate notes.

- [x] **EV02.acknowledgement** — Item identification requires retained acknowledgement and expires at prescribed time.

- [x] **COMPLETE.EV02** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV03 — Event: Cache Discovered

**Included rule reference**

Reference R479 (rules):

**Event: Cache Discovered**

- Lose one hidden/planned cache and contents.
- Mitigate: Secrecy check DC `10 + rank` to retrieve.
- Twice: all caches discovered.

**Individual checks — reply with these IDs**

- [x] **EV03.base** — Lose one selected hidden or planned cache unless Secrecy DC10 plus rank retrieves it.

- [x] **EV03.twice** — Twice threatens all applicable caches with explicit mitigation scope.

- [x] **EV03.empty** — No eligible caches requires reroll.

- [x] **EV03.multiple** — Two or more caches retain distinct loss and recovery outcomes and modifier-aware checks.

- [x] **COMPLETE.EV03** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV04 — Event: Calm before the Storm

**Included rule reference**

Reference R485 (rules):

**Event: Calm before the Storm**

- No event now.
- Next week: roll event table and apply that event automatically (ignore Roll Twice result), then continue with normal Event phase roll.
- This week does not count as uneventful for rank bonus purposes.
- Twice: next week roll two automatic events (ignore all Roll Twice), then run Event phase normally.

**Individual checks — reply with these IDs**

- [x] **EV04.base** — No event now; next week one automatic table event precedes normal Event processing.

- [x] **EV04.twice** — Twice queues two automatic events, not three.

- [x] **EV04.reroll** — Automatic Roll Twice results require replacement without suppressing independent normal rolls.

- [x] **EV04.order** — Order-sensitive outcomes use independent rolls and do not create uneventful carry.

- [x] **COMPLETE.EV04** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV05 — Event: Double Agent (Persistent-capable)

**Included rule reference**

Reference R492 (rules):

**Event: Double Agent (Persistent-capable)**

- Cannot use Secure Cache next Activity phase.
- Secrecy checks suffer -2 penalty.
- Twice: becomes persistent.

**Individual checks — reply with these IDs**

- [x] **EV05.base** — Nonpersistent Double Agent blocks only next Activity Secure Cache and applies one -2 Secrecy penalty.

- [x] **EV05.persistent** — Twice keeps the restriction and single -2 penalty across all affected weeks.

- [x] **EV05.end** — Ending or buyoff removes future restriction and penalty.

- [x] **EV05.exception** — Staged cache action remains visible with warning and reasoned exception path.

- [x] **COMPLETE.EV05** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV06 — Event: Festival

**Included rule reference**

Reference R498 (rules):

**Event: Festival**

- Choose recently used town.
- PCs gain +2 morale to Bluff/Diplomacy/Intimidate there for week.
- Twice: bonus becomes +5.

**Individual checks — reply with these IDs**

- [x] **EV06.base** — Chosen recently used town grants +2 morale Bluff, Diplomacy and Intimidate for a week.

- [x] **EV06.twice** — Twice replaces bonus with +5.

- [x] **EV06.record** — Town selection, duration and acknowledgement are recorded.

- [x] **COMPLETE.EV06** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV07 — Event: Found Fire

**Included rule reference**

Reference R504 (rules):

**Event: Found Fire**

- Each PC gets one non-poison alchemical item worth <=100 gp.
- Security checks gain +2 for upcoming week.
- Twice: choose one additional <=100 gp item.

**Individual checks — reply with these IDs**

- [x] **EV07.base** — Each PC receives one nonpoison alchemical item worth at most 100 gp and next-week Security +2.

- [x] **EV07.twice** — Twice gives two items per PC total but Security remains +2.

- [x] **EV07.record** — PC eligibility, item limits and acknowledgement persist; duration expires.

- [x] **COMPLETE.EV07** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV08 — Event: Hidden Agenda

**Included rule reference**

Reference R510 (rules):

**Event: Hidden Agenda**

- Militia gains +2 on all Activity phase checks this week.
- Twice: bonus becomes +5.

**Individual checks — reply with these IDs**

- [x] **EV08.base** — All current Activity checks receive +2.

- [x] **EV08.twice** — Twice replaces with +5 rather than adding +7.

- [x] **EV08.recompute** — All Activity actions recalculate their checks and resulting outcomes when Hidden Agenda is added, changed, or removed, with browser/server agreement. Its bonus applies to every Activity check, not only Drill Militia and Earn Gold.

- [x] **COMPLETE.EV08** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV09 — Event: High Morale

**Included rule reference**

Reference R515 (rules):

**Event: High Morale**

- End one current persistent event immediately.
- Loyalty checks gain +2 for upcoming week.
- Twice: end two persistent events and bonus becomes +5.

**Individual checks — reply with these IDs**

- [x] **EV09.base** — End one persistent event immediately and give upcoming Loyalty +2.

- [x] **EV09.twice** — Actual duplicate pair ends two total and gives +5, not three and +7.

- [x] **EV09.targets** — Zero to three active events, age ties and new same-week persistence retain explicit selected endings.

- [x] **EV09.recompute** — Ended event modifiers are removed from dependent checks.

- [x] **COMPLETE.EV09** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV10 — Event: Invasion

**Included rule reference**

Reference R521 (rules):

**Event: Invasion**

- GM presents random combat encounter at CR `APL + 1`.

**Individual checks — reply with these IDs**

- [x] **EV10.encounter** — Show and record GM random encounter at APL plus 1 CR.

- [x] **EV10.acknowledgement** — Required encounter acknowledgement is retained.

- [x] **EV10.duplicate** — No Twice clause means two independent encounters.

- [x] **COMPLETE.EV10** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV11 — Event: Low Morale (Persistent-capable)

**Included rule reference**

Reference R525 (rules):

**Event: Low Morale (Persistent-capable)**

- Loyalty checks suffer -2.
- Twice: becomes persistent.

**Individual checks — reply with these IDs**

- [x] **EV11.base** — Loyalty -2 applies for the prescribed week.

- [x] **EV11.twice** — Twice makes one persistent -2 effect, not doubled penalties.

- [x] **EV11.duration** — First and later weeks affect relevant Loyalty checks until ending.

- [x] **COMPLETE.EV11** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV12 — Event: Market Day

**Included rule reference**

Reference R530 (rules):

**Event: Market Day**

- One operated town (PC choice): all items/services gain extra 5% discount.
- Twice: applies to all operated marketplaces, including Broker Market marketplaces.

**Individual checks — reply with these IDs**

- [x] **EV12.base** — Chosen operated town gives extra 5% discount on all items and services.

- [x] **EV12.twice** — Twice covers all operated marketplaces including Broker Market.

- [x] **EV12.composition** — Reputation discounts compose and town services are not limited to tracked market rows.

- [x] **EV12.inputs** — Market Day can be rolled and retained even when no town or settlement exists yet. A valid settlement must be chosen before the event can resolve; its discount expires at the prescribed time.

- [x] **COMPLETE.EV12** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV13 — Event: Missing in Action

**Included rule reference**

Reference R535 (rules):

**Event: Missing in Action**

- One random team that operated this week is unavailable next week.
- Twice: team returns end of following week, but disabled.

**Individual checks — reply with these IDs**

- [x] **EV13.base** — Random team that operated this week is unavailable next week.

- [x] **EV13.twice** — Twice returns it at end of following week disabled, with no early DC15 recovery.

- [x] **EV13.empty** — No operated eligible team requires reroll.

- [x] **EV13.timeline** — Disabled recovery cost is considered next Upkeep, using fresh team condition state.

- [x] **COMPLETE.EV13** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV14 — Event: Night Ops

**Included rule reference**

Reference R540 (rules):

**Event: Night Ops**

- PCs gain +2 circumstance bonus to Stealth after dark for week.
- Twice: bonus becomes +5.

**Individual checks — reply with these IDs**

- [x] **EV14.base** — One-week +2 circumstance Stealth applies after dark.

- [x] **EV14.twice** — Twice gives effective +5 rather than +7.

- [x] **EV14.record** — Darkness condition, bonus type, expiry and acknowledgement remain explicit.

- [x] **COMPLETE.EV14** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV15 — Event: Raid

**Included rule reference**

Reference R545 (rules):

**Event: Raid**

- In random settlement with active refuge(s), all refuges deactivate.
- Hidden persons may be captured and can be recovered next week via Rescue Character (DC `5 + rank`).
- Mitigate: DC 20 Security per person to reduce capture chance by 50%.

**Individual checks — reply with these IDs**

- [x] **EV15.settlement** — Random selected settlement loses all its refuges; other settlements remain unaffected.

- [x] **EV15.capture** — Each hidden person has separate capture chance and Security DC20 halves that chance.

- [x] **EV15.empty** — No refuge requires reroll.

- [x] **EV15.rescue** — Captured persons retain next-week rescue DC5 plus rank and valid access context.

- [x] **COMPLETE.EV15** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV16 — Event: Rivalry (Persistent-capable)

**Included rule reference**

Reference R551 (rules):

**Event: Rivalry (Persistent-capable)**

- Two random teams cannot act next Activity phase.
- Twice: persistent until officer succeeds at DC 20 Bluff, Diplomacy, or Intimidate.

**Individual checks — reply with these IDs**

- [x] **EV16.targets** — Two distinct randomly selected teams cannot act next Activity; selected identities persist.

- [x] **EV16.twice** — Twice persists across weeks until officer Bluff, Diplomacy or Intimidate reaches DC20.

- [x] **EV16.boundary** — Each of the three skills fails at 19 and ends at 20.

- [x] **EV16.empty** — Insufficient eligible teams requires reroll; ending releases both targets.

- [x] **COMPLETE.EV16** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV17 — Event: Roll Twice

**Included rule reference**

Reference R556 (rules):

**Event: Roll Twice**

- Roll and resolve two events.
- Roll Twice can only take effect once per Event phase.
- Additional Roll Twice results in same phase are rerolled.

**Individual checks — reply with these IDs**

- [x] **EV17.expansion** — Roll Twice produces two valid outcomes with each event's own Twice policy.

- [x] **EV17.reroll** — Repeated Roll Twice outcomes are rerolled.

- [x] **EV17.namespace** — Normal and automatic events retain independent occurrence identities.

- [x] **COMPLETE.EV17** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV18 — Event: Sickness

**Included rule reference**

Reference R562 (rules):

**Event: Sickness**

- One random team becomes disabled.
- Twice: team is lost unless militia succeeds on DC 20 Loyalty.

**Individual checks — reply with these IDs**

- [x] **EV18.base** — Random eligible team becomes disabled.

- [x] **EV18.twice** — Twice loses it unless modified Loyalty reaches DC20.

- [x] **EV18.readiness** — Missing mitigation input prevents an attempted mitigation from becoming an irreversible implicit failure.

- [x] **EV18.ordering** — Empty roster rerolls; preceding events update eligibility before selection.

- [x] **COMPLETE.EV18** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV19 — Event: Theft (Persistent-capable)

**Included rule reference**

Reference R567 (rules):

**Event: Theft (Persistent-capable)**

- Militia treasury is halved.
- Mitigate: DC 20 Loyalty reduces loss to 10% instead.
- Twice: becomes persistent and militia loses half of all incoming treasury gains until successful Reduce Danger action.

**Individual checks — reply with these IDs**

- [x] **EV19.activity-income** — Activity earnings and sales retain half their copper-rounded gain under carried Theft; expenses remain full and end IDs restore later income.

- [x] **EV19.base** — Theft takes half of treasury after prior costs, rounded to copper precision.

- [x] **EV19.mitigation** — Loyalty DC20 reduces current loss to 10%; mitigation lasts only one week.

- [x] **EV19.persistent** — Twice halves incoming gains until successful Reduce Danger ends it.

- [x] **EV19.order** — Ordinary Theft causes a one-time treasury loss when the event resolves. Only persistent Theft from the Twice result reduces subsequent incoming money; gains before it ends are reduced, and gains after it ends are received in full.

- [x] **COMPLETE.EV19** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV20 — Event: Turn Around

**Included rule reference**

Reference R573 (rules):

**Event: Turn Around**

- All disabled teams recover.
- If none disabled, one team gains +2 on one check next Activity phase.

**Individual checks — reply with these IDs**

- [x] **EV20.disabled** — All disabled teams recover.

- [x] **EV20.none** — If none disabled, select one team for +2 on exactly one next-Activity check.

- [x] **EV20.empty** — No team follows event eligibility reroll policy.

- [x] **EV20.order** — Successive events and expiring returns use current projected state; unused bonus expires.

- [x] **COMPLETE.EV20** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV21 — Event: Turncoat

**Included rule reference**

Reference R578 (rules):

**Event: Turncoat**

- Training decreases by `1d6 + rank`.
- Twice: one full team defects (GM choice) unless officer succeeds at Diplomacy DC `10 + rank`; even on success team is unavailable next Activity phase.

**Individual checks — reply with these IDs**

- [x] **EV21.base** — Training loses rolled 1d6 plus current rank.

- [x] **EV21.twice** — GM-chosen team defects unless Diplomacy reaches DC10 plus rank.

- [x] **EV21.success** — Successful prevention still leaves team unavailable next Activity.

- [x] **EV21.inputs** — Missing die, team or attempted check prevents readiness and modifiers apply once.

- [x] **COMPLETE.EV21** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV22 — Event: War Games

**Included rule reference**

Reference R583 (rules):

**Event: War Games**

- Training increases by rank.

**Individual checks — reply with these IDs**

- [x] **EV22.base** — Training increases by current post-Upkeep rank.

- [x] **EV22.duplicate** — No Twice clause means duplicate grants rank twice.

- [x] **EV22.timing** — Event training gain does not retroactively run Upkeep rank advancement.

- [x] **COMPLETE.EV22** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV23 — Event: Week of Pain

**Included rule reference**

Reference R587 (rules):

**Event: Week of Pain**

- Next week: -1 penalty to all organization checks.
- Next Upkeep training loss is doubled.
- Twice: no additional effect.

**Individual checks — reply with these IDs**

- [x] **EV23.checks** — Next week all organization checks take -1 across all phases.

- [x] **EV23.losses** — Next Upkeep doubles all training losses but not natural-20 gains.

- [x] **EV23.twice** — Duplicate adds no extra effect.

- [x] **EV23.expiry** — Effects expire after next week and retain correct composition with Serenity.

- [x] **COMPLETE.EV23** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### EV24 — Event: Week of Serenity

**Included rule reference**

Reference R593 (rules):

**Event: Week of Serenity**

- Next week: +5 bonus to all organization checks.
- Next Activity training gain is doubled.
- Twice: no additional effect.

**Individual checks — reply with these IDs**

- [x] **EV24.checks** — Next week all organization checks receive +5.

- [x] **EV24.gains** — Next Activity training gain includes Commandants once and then doubles.

- [x] **EV24.twice** — Duplicate adds no extra effect.

- [x] **EV24.expiry** — Effects last only next week and compose with Week of Pain without hidden duplication.

- [x] **COMPLETE.EV24** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### P01 — Persistent events continue, oldest first; age/order preserved.

**Included rule reference**

Reference R088 (rules):

**Active and Persistent Events**

- Track active events until resolved.
- Persistent events continue until ended by mitigation or special spending.

Reference R460 (rules):

**Event Resolution Notes**

- Settlement modifiers from where militia operates apply.
- If event cannot occur, reroll.
- `Roll Twice` can cause dual event resolution.
- If duplicate event appears in double roll and has `Twice` clause, second application uses that clause.
- Resolve persistent events oldest first.

Reference R599 (rules):

**Persistent Events Rules**

- Persistent events continue week-to-week.
- If mitigation exists, mitigation lasts only 1 week and must be repeated.
- Once every 4 weeks, PCs can end a persistent event by paying `2 x current minimum treasury value`.

**Individual checks — reply with these IDs**

- [x] **P01.oldest** — Persistent instances process oldest first with stable order for age ties.

- [x] **P01.identity** — Multiple instances of the same type retain separate targets and ages.

- [x] **P01.eligibility** — New same-week persistence does not change fixed carried-event phase eligibility.

- [x] **COMPLETE.P01** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### P02 — Event: Rivalry (Persistent-capable)

**Included rule reference**

Reference R599 (rules):

**Persistent Events Rules**

- Persistent events continue week-to-week.
- If mitigation exists, mitigation lasts only 1 week and must be repeated.
- Once every 4 weeks, PCs can end a persistent event by paying `2 x current minimum treasury value`.

Reference R551 (rules):

**Event: Rivalry (Persistent-capable)**

- Two random teams cannot act next Activity phase.
- Twice: persistent until officer succeeds at DC 20 Bluff, Diplomacy, or Intimidate.

Reference R567 (rules):

**Event: Theft (Persistent-capable)**

- Militia treasury is halved.
- Mitigate: DC 20 Loyalty reduces loss to 10% instead.
- Twice: becomes persistent and militia loses half of all incoming treasury gains until successful Reduce Danger action.

**Individual checks — reply with these IDs**

- [x] **P02.weekly** — Each persistent instance can attempt mitigation each week; last week's mitigation does not carry.

- [x] **P02.optional** — Unattempted optional mitigation differs from attempted incomplete mitigation.

- [x] **P02.end** — Rivalry skill success and Theft Reduce Danger permanently end their target rather than temporary mitigation.

- [x] **COMPLETE.P02** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### P03 — Once per4weeks pay2×current minimum to end persistent event.

**Included rule reference**

Reference R599 (rules):

**Persistent Events Rules**

- Persistent events continue week-to-week.
- If mitigation exists, mitigation lasts only 1 week and must be repeated.
- Once every 4 weeks, PCs can end a persistent event by paying `2 x current minimum treasury value`.

**Individual checks — reply with these IDs**

- [x] **P03.context-persistent** — Preparation retains same-type event instances with separate targets, age/order, mitigation, ending and militia-wide last buyoff week.

- [x] **P03.first** — First buyoff is immediately available even before week 4.

- [x] **P03.cooldown** — Buyoff in week 2 blocks week 5 and permits week 6 across all persistent event targets.

- [x] **P03.cost** — Cost is twice current minimum treasury and insufficient funds use warning/exception policy.

- [x] **P03.stage** — Buyoff remains staged until exact Confirmation and competing player edits cannot double-spend.

- [x] **COMPLETE.P03** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### P04 — Persistent Phase Eligibility fixed from events carried into week; viewing/navigation local.

**Included rule reference**

Reference R208 (rules):

**Weekly Sequence (Militias in Play)**

Order is fixed each week:
1. Upkeep
2. Activity
3. Event

First week of militia use skips Upkeep.

**Individual checks — reply with these IDs**

- [x] **P04.summary-confirmation** — Summary exposes complete baseline and final outcomes with ordered reasoned adjudication; rejected saves and Confirmation require explicit fresh review before another attempt.

- [x] **P04.persistent-preparation** — Carried event instances retain fixed navigation eligibility, named targets and age/order while mitigation, officer ending, reasoned ending and buyoff remain shared staged decisions; buyoffs share the projected cooldown.

- [x] **P04.event-preparation** — Event occurrences expose independent branches, typed raw inputs, explicit clears, reactive decisions and owner-bound narrative outcomes through Workspace; disjoint occurrence edits coexist and stale edits recover visibly.

- [x] **P04.activity-cards** — Activity exposes complete shared choices, retains extra slots and supports accessible placement and nested typed details with precise copper input.

- [x] **P04.states** — Only ready Workspace states expose semantic operations; unavailable/loading/failed recover when a valid source becomes available.

- [x] **P04.upkeep-input** — Upkeep raw input preserves zero versus clear, rejects invalid text without mutation, and displays deterministic bonuses and field-level required/format errors.

- [x] **P04.upkeep-card-placement** — Pointer placement highlights a selection target and stages one choice; invalid or cancelled drops return the card without changing selection, and tap/keyboard activation remain available.

- [x] **P04.upkeep-recovery-adjustment** — Recovery cards default to the deterministic cost; a reasoned override atomically stages the team decision and an ordered treasury adjustment after the unchanged baseline, with stale target conflicts leaving both unchanged.

- [x] **P04.upkeep-warning-context** — Upkeep warnings identify the affected team, officer, roll, or transfer and explain the advisory departure without rendering internal identifiers.

- [x] **P04.snapshot** — Persistent Phase Eligibility comes from unresolved events carried into week.

- [x] **P04.stable** — Ending or creating persistence midweek does not alter eligibility.

- [x] **P04.navigation** — Phase navigation is local and immediate while shared edits are pending.

- [x] **COMPLETE.P04** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### P05 — Readiness derived from all required inputs; partial preview while incomplete; Confirmation rejects incomplete source.

**Included rule reference**

Reference R208 (rules):

**Weekly Sequence (Militias in Play)**

Order is fixed each week:
1. Upkeep
2. Activity
3. Event

First week of militia use skips Upkeep.

**Individual checks — reply with these IDs**

- [x] **P05.matrix** — Every required roll, target, choice and acknowledgement controls readiness.

- [x] **P05.zero** — Explicit zero differs from missing input; malformed values block Confirmation.

- [x] **P05.optional** — Optional mitigation unattempted is valid; attempted incomplete mitigation is not.

- [x] **P05.partial** — Incomplete source still produces a partial preview.

- [x] **P05.upstream** — Changed upstream choices invalidate dependent input relevance consistently in browser and server.

- [x] **COMPLETE.P05** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### P06 — Baseline preview and authoritative change plan include every committed effect; Table Adjustments applied after full baseline.

**Included rule reference**

Reference R208 (rules):

**Weekly Sequence (Militias in Play)**

Order is fixed each week:
1. Upkeep
2. Activity
3. Event

First week of militia use skips Upkeep.

**Individual checks — reply with these IDs**

- [x] **P06.full-plan** — Preview and committed state diff agree for every action and event, all ledgers, queues and identities.

- [x] **P06.baseline** — Complete Rules Baseline precedes ordered typed Table Adjustments.

- [x] **P06.no-hidden** — Confirmation applies the reviewed plan with no hidden writes or double-applied resource totals.

- [x] **COMPLETE.P06** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### P07 — Shared typed Table Adjustment after baseline, required reason; structural validity; intentional choice Rules Exception distinct from outcome adjustment.

**Included rule reference**

Reference R208 (rules):

**Weekly Sequence (Militias in Play)**

Order is fixed each week:
1. Upkeep
2. Activity
3. Event

First week of militia use skips Upkeep.

**Individual checks — reply with these IDs**

- [x] **P07.reason** — Shared Table Adjustments and Rules Exceptions require reasons retained in history.

- [x] **P07.distinction** — Rules Exception permits a choice without changing arithmetic; adjustment changes a result.

- [x] **P07.integrity** — Malformed references, missing entities and nonfinite numbers remain blocked.

- [x] **P07.order** — Ordered conflicting adjustments recompute after baseline changes and target specific event instances.

- [x] **COMPLETE.P07** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### P08 — Confirmation atomic for exact **reviewed** Weekly Draft Revision, reject stale; close draft and create single successor, immutable complete source/history.

**Included rule reference**

Reference R208 (rules):

**Weekly Sequence (Militias in Play)**

Order is fixed each week:
1. Upkeep
2. Activity
3. Event

First week of militia use skips Upkeep.

**Individual checks — reply with these IDs**

- [x] **P08.reviewed** — Confirmation requires the exact reviewed draft revision and relevant external source state.

- [x] **P08.barrier** — Confirmation waits for earlier local edits, pauses new edits and does not substitute a newer unreviewed revision.

- [x] **P08.atomic** — Failure applies nothing; simultaneous Confirmations produce one record and one successor.

- [x] **P08.history** — Full source and ruleset persist immutably; delayed writes to closed identity are rejected.

- [x] **COMPLETE.P08** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### P09 — Shared semantic edits preserve disjoint changes, reject same-target conflicts; immediate feedback; no claim/per-slot confirmation under accepted Action Slot decision.

**Included rule reference**

Reference R208 (rules):

**Weekly Sequence (Militias in Play)**

Order is fixed each week:
1. Upkeep
2. Activity
3. Event

First week of militia use skips Upkeep.

**Individual checks — reply with these IDs**

- [x] **P09.disjoint** — Disjoint stale semantic edits coexist while same-target stale edits fail visibly.

- [x] **P09.aggregate** — Move and swap are atomic multi-slot edits; obsolete detail edits cannot update a replacement choice.

- [x] **P09.retry** — Accepted semantic edit increments revision once; retries are idempotent after dropped responses.

- [x] **P09.delivery** — Acknowledgements follow submission order and responses are monotonic.

- [x] **P09.shared** — Players edit unlocked slots with immediate feedback and recovery; no per-slot confirmation.

- [x] **COMPLETE.P09** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### P10 — Access scoped to campaign/org, all players may stage/confirm; All organization members have the same editing controls. AGENTS and accepted shared-collaboration decisions.

**Included rule reference**

Reference R208 (rules):

**Weekly Sequence (Militias in Play)**

Order is fixed each week:
1. Upkeep
2. Activity
3. Event

First week of militia use skips Upkeep.

**Individual checks — reply with these IDs**

- [x] **P10.scope** — Actual unauthenticated or unauthorized campaign writes are rejected for edit, confirm, adjust, buyoff, rank and treasury.

- [x] **P10.references** — Cross-campaign child references are rejected.

- [x] **P10.players** — All authorized players may stage and confirm.

- [x] **P10.gm** — All users with access to the organization can edit all militia data and use the same controls; there are no separate GM permissions at this stage.

- [x] **COMPLETE.P10** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### P11 — Historical view reads immutable effective records; paused cutover preserves authoritative state/carry but resets unfinished choices/history.

**Included rule reference**

Reference R208 (rules):

**Weekly Sequence (Militias in Play)**

Order is fixed each week:
1. Upkeep
2. Activity
3. Event

First week of militia use skips Upkeep.

**Individual checks — reply with these IDs**

- [x] **P11.context-setup** — Isolated ledger/setup accepts advisory incomplete facts, rejects malformed numbers and validates campaign-owned references.

- [x] **P11.setup-lifecycle** — New and existing militia setup create one ordinary draft without resolving the week, preserve reference integrity and local navigation, and retain advisory deviations.

- [x] **P11.immutable** — Historical views read complete immutable records rather than live state.

- [x] **P11.effective** — Newest nonsuperseded record is effective; older records remain an audit trail.

- [x] **P11.cutover** — Paused restartable initialization preserves campaign state, week and carry but resets unfinished choices and history.

  **Still pending:** Initialization preservation and restart tests pass. Paused deployment and recovery rehearsal remain pending in #89; production cutover is #90. You only need to review the intended requirement here; its implementation/rehearsal remains agent work.

- [x] **P11.no-execution** — Initialization creates one empty draft without Upkeep, queue execution or advancement.

- [x] **P11.legacy** — No old-version requests are expected after upgrade, so explicit rejection is not required. Recovery before reopening restores compatible state without losing newly accepted work.

  **Still pending:** Recovery before reopening must be implemented and rehearsed in #89 before #90 production cutover. Explicit old-version request rejection and forced reload handling are out of scope. The supported legacy path remains enabled during #88. You only need to review the intended requirement here; its implementation/rehearsal remains agent work.

- [x] **COMPLETE.P11** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

### GATE — Automated verification requirements

**Included product reference:** the behavior checks below express the accepted weekly workflow. Full accepted specification, verification contract, and implementation sequence are reproduced in the reference section at the end of this document.

**Individual checks — reply with these IDs**

- [x] **GATE.projection-parity** — Identical canonical fixtures through browser and Convex entry paths produce the same Phase Views and Resolution Preview.

- [x] **GATE.adapter-contract** — Shared persistence contract scenarios pass against in-memory and actual isolated Convex persistence.

- [x] **GATE.two-player** — Two authenticated browser contexts agree on edits and Confirmation, retain independent navigation and show conflict recovery.

- [x] **COMPLETE.GATE** — The included rules and the checks in this group contain no omitted rule, important edge case, or conflicting interpretation. If something is missing, describe it in your reply.

## Source section classifications — checked against the PDF

Reviewed by Codex on 2026-09-23 at your request, using printed pages **48–59** (PDF pages **50–61**) of *Pathfinder Campaign Setting: Lands of Conflict*. The supplied attachment path was unavailable; the local copy has the same filename and exact size (12,813,042 bytes). Its SHA-256 is `63feb5f2ce74ce5017bda3436b4f18418f28f9e2719492fc8c334b9ed5d48b49`.

These five entries are organizational sections in the normalized rules document. Their classifications are complete; no further reply is needed for these SOURCE IDs. This records an agent source check, separate from your full human corpus sign-off recorded below. Your explicit product decisions elsewhere in this checklist still apply.

- [x] **SOURCE.R001 — Editorial introduction.** The title “Ironfang Invasion Militia Rules” and its sentence about searchable organization describe this repository document. The PDF instead begins “Building a Militia” on printed p. 48. This wrapper adds no separate rule. Campaign setup/scope are represented by F01/F02/F05 and the recorded scope decisions.

- [x] **SOURCE.R019 — Terminology grouping.** The normalized heading has no body before “Rank.” The PDF’s terminology spans printed pp. 48–51. Its actual rules are covered by the individual definitions and their checks: foundations F01–F07, manager rules O06, team/action access T01–T06, weekly order U01, and event/carry handling E01/E05/E06/P01. Tracking the militia weekly is already part of the workflow. No additional behavior is hidden in the parent heading.

- [x] **SOURCE.R163 — Team-condition grouping.** The Team Conditions box on printed p. 53 introduces disabled and missing teams. Its detailed rules are represented by T07/T08 and their child sources R165/R171; F05 covers team capacity. Those checks cover inability to act, recovery cost/timing, the return check, end-of-week return, and permanent loss on a natural 1. The parent heading adds no separate behavior.

- [x] **SOURCE.R178 — Team-tree grouping.** “Team Trees” groups the four branches shown on printed pp. 52–54. T01–T04 cover the individual branches; T05/T06 and the recruitment/upgrade action checks cover costs, inherited actions, and timing restrictions. This normalized parent heading adds no separate behavior.

- [x] **SOURCE.R217 — Upkeep grouping with rules represented elsewhere.** Printed p. 54’s introduction is not purely decorative: it states the first-ever-week skip and the fixed order of the five steps. U01 covers the skip/weekly sequence, U02–U04 cover attrition and penalties, U04/U05 cover advancement before transfers, and A07 covers Drill Militia. These requirements are already represented; the empty normalized parent heading needs no additional behavior case.

## Full accepted product and verification reference

These snapshots are included for the product/workflow checks above. They are historical specifications: the recorded scope decisions and corrected checks above supersede conflicting requirements here, including old-version request handling, GM-only controls, unavailable action slots, and Strike Team duration. Statements about implementation status at the time of the decision are not current verification results. Links are provenance only; the source text needed for this review is included here.

### Accepted product and workflow specification (#57)

**Problem Statement**

Players need to prepare an Ironfang militia week together, understand the consequences of their choices, and confirm exactly the week they reviewed. Today, Weekly Draft orchestration, browser input, shared edits, rules calculations, and persistence are spread across a large board controller, phase builders, and backend write paths. This makes changes difficult to reason about and allows lost edits, incomplete previews, and inconsistent rules outcomes.

The completed architecture map [#33](https://github.com/AndreasUnunger/EverythingPath/issues/33) establishes the replacement architecture. This specification turns its accepted decisions into an implementation contract. The map's planning work is complete; implementation and eventual cutover are separate work described here.

**Solution**

Give the board one Weekly Draft Workspace interface that presents the current Phase View and accepts semantic edits and whole-week Confirmation. Players can jointly edit complete Staged Action Choices, navigate independently, see immediate feedback and rules-derived previews, and review explicit table decisions before committing the week atomically.

Use one typed Weekly Draft contract and one shared pure Rules Projection across the browser and Convex. Preserve useful existing presentation and observable behavior, correct unaccepted baseline defects, and retain accepted product interpretations explicitly. Replace live storage through the approved paused cutover while preserving authoritative campaign state and week context.

**User Stories**

1. As a player, I want the board to clearly show loading, unavailable, failed, and ready states, so that I understand whether I can work on my militia week.
2. As a player, I want to view Upkeep, Activity, Event, and Summary independently of other players, so that each person can inspect the information they need.
3. As a player, I want phase navigation to remain immediate while my edits are pending, so that preparation does not stall.
4. As a player, I want to see shared choices and accepted changes on every device, so that the table works from the same Weekly Draft.
5. As a player, I want immediate feedback for an edit and a clear recovery message if it fails, so that I know whether my work was retained.
6. As a player, I want edits to different targets to coexist and conflicting edits to fail visibly, so that another player's newer choice is not silently overwritten.
7. As a player, I want all players to edit an Action Slot until Weekly Confirmation, so that collaboration does not require slot ownership or individual confirmations.
8. As a player, I want each Staged Action Choice to keep its team, rolls, targets, costs, and details together, so that moving it does not change its meaning.
9. As a player, I want to stage, replace, clear, move, and swap complete choices with cards, so that arranging Activity is quick at the table.
10. As a player, I want incomplete choices to remain visible while I fill them in, so that I can prepare the week incrementally.
11. As a player, I want occupied slots to remain visible when the action allowance shrinks, so that no staged work disappears.
12. As a player, I want to resolve an over-allowance choice by moving or clearing it, or recording a reasoned Rules Exception, so that the table can adjudicate intentional departures.
13. As a player, I want invalid numeric entry to leave my existing input intact and clearing to remove the value explicitly, so that zero and missing input remain distinct.
14. As a player, I want calculated rules defaults and modifier explanations, so that I supply dice and table decisions without re-entering deterministic arithmetic.
15. As a player, I want warnings to explain rule mismatches and structural errors to identify invalid data, so that I understand what needs correction.
16. As a player, I want a shared Rules Exception with a required reason to permit an unusual choice, so that intentional exceptions remain visible in later sessions.
17. As a player, I want a Table Adjustment with a required reason to change a calculated result after the Rules Baseline, so that adjudication is distinguishable from normal calculation.
18. As a player, I want readiness to identify every required roll, target, selection, and acknowledgement, so that an incomplete week cannot be accidentally confirmed.
19. As a player, I want the Resolution Preview to include every resulting militia, roster, officer, settlement, asset, event, and future-week change, so that Confirmation contains no hidden outcomes.
20. As a player, I want earlier-phase edits to recompute later outcomes, so that action eligibility and Event consequences reflect the week we are actually preparing.
21. As a player, I want first-use Upkeep behavior and ordered losses, rank increases, and treasury changes to follow the rules, so that mid-campaign week numbering does not change the result.
22. As a player, I want officer, manager, team-condition, settlement, and one-use modifiers applied exactly once, so that bonuses and restrictions remain trustworthy.
23. As a player, I want separate teams of the same type and multiple officer holders to retain their identities, so that rules refer to the intended people and teams.
24. As a player, I want every action and event to support its required targets, rolls, calculated outcomes, and recorded narrative decisions, so that manual adjudication does not silently omit an effect.
25. As a player, I want Roll Twice, duplicate events, automatic events, and replacement rolls handled independently and in order, so that all applicable outcomes are resolved.
26. As a player, I want carried persistent events processed with stable age, order, and targets, so that recurring effects remain consistent across weeks.
27. As a player, I want Persistent Phase availability fixed by the events carried into the week, so that resolving or creating an event does not unexpectedly change navigation.
28. As a player, I want to stage persistent mitigation, ending, and buyoff decisions with their costs and timing, so that they are included in the reviewed week.
29. As a player, I want order delivery shown in days and receipt recorded explicitly, so that expedited delivery has its intended value and cannot be received twice.
30. As a player, I want Confirmation to wait for my earlier edits and reject a changed reviewed source, so that I never commit an unseen result.
31. As a player, I want competing Confirmations to produce one committed week and one successor draft, so that a week cannot advance twice.
32. As a player, I want delayed edits from a finished week to fail, so that they cannot alter the next week.
33. As a player, I want a warning before leaving with pending edits, so that I can avoid losing work that has not been accepted.
34. As a player, I want finished weeks displayed from immutable Resolution Records, so that today's militia state cannot change what history shows.
35. As a player, I want a new or mid-campaign militia to enter the same draft lifecycle, so that setup does not create a separate gameplay path.
36. As a GM, I want correction controls restricted to the GM while normal preparation and Confirmation remain shared, so that table authority is preserved.
37. As a maintainer, I want behavior accessible through a small Workspace interface and shared rules implementation, so that a rules or draft change has locality.
38. As a maintainer, I want tests to assert observable outcomes through module interfaces, so that refactoring private implementation does not require rewriting unrelated tests.
39. As a maintainer, I want every testable rules behavior linked to executable coverage, so that a passing suite cannot conceal an omitted action or event.
40. As a campaign operator, I want a rehearsed, restartable cutover that preserves current state and intentionally resets unfinished choices and old history, so that migration has a verifiable result.
41. As a campaign operator, I want legacy writes rejected and old tabs required to reload, so that queued requests cannot corrupt the new draft model.
42. As a campaign operator, I want a verified backup and recovery procedure before reopening editing, so that a failed cutover can be reversed without losing newly accepted player work.

**Implementation Decisions**

**Authority and decision precedence**

The accepted resolutions linked from #33 are normative, including all three parts of the 95-entry audit in #54. Later explicit resolutions take precedence over earlier tentative wording:

- #36 supersedes the old product-description requirement for first-claim locking, timeouts, release transitions, and per-slot confirmation. Slots are empty or staged and jointly editable until Weekly Confirmation. This conflict with older repository guidance must remain explicit during implementation.
- #56 and #55 supersede #34's description of treasury transactions, rank-up, and persistent buyoff as immediate adjacent operations. Their weekly effects must be staged, previewed, and committed through Confirmation. Historical navigation remains a separate read-only operation.
- #56 permits an over-capacity choice through a reasoned Rules Exception; #36's unready-until-move-or-clear wording does not remove that later exception path.
- Written militia rules are the baseline except for named accepted interpretations. Existing tests and current behavior do not authorize preserving a demonstrated defect.

**Module ownership and seams**

| Module or adapter | Interface and ownership |
| --- | --- |
| Weekly Draft Workspace | One external feature seam, exposed through `useWeeklyDraftWorkspace`. Discriminated `unavailable`, `loading`, `failed`, and `ready` states; only ready exposes the current discriminated Phase View and `edit`, `viewPhase`, and `confirm` operation families. Owns orchestration, local Phase View selection, projection composition, and translation of semantic operations. |
| Weekly Draft contract | Shared canonical validators, inferred types, defaults, and semantic edit validation. Convex storage and argument validators derive from this contract. |
| Action Slot | Internal pure module owning complete action-discriminated choices and atomic choice operations. Does not introduce a second UI seam. |
| Weekly Draft Rules Projection | Shared pure projection from a Weekly Draft Revision and militia snapshot to phase facts, eligibility, readiness, warnings, action requirements, resolved events, and Resolution Preview. Owns all pre-Confirmation militia calculation. |
| Weekly Draft Persistence | Internal seam with production Convex and deterministic in-memory adapters. Owns ordering, acknowledgements, target-aware concurrency, retries, draft identity isolation, and the Confirmation barrier. |
| Weekly Resolution | Existing adjacent deterministic module, extended only where its interface must consume canonical source and produce the complete change plan. Confirmation applies that plan atomically. |
| Browser interaction and input adapters | Own editable text, pointer/hover/drag state, DOM references, animation, formatting, and conversion to semantic edits. |
| Board shell and phase presentation | Thin composition and rendering. Phase Views contain facts and affordances; presentation owns copy, styling, grouping, card order, and static explanations. History navigation composes beside Workspace. |

Depth comes from hiding orchestration and persistence behind the small Workspace interface. Its deletion would redistribute that complexity to the board and phase callers. Avoid pass-through modules that recreate the current field-by-field controller interface. UI and Workspace behavior tests must not depend on raw synchronized drafts, query composition, setters, flushing, retries, DOM references, or private projection structures.

**Canonical Weekly Draft and input contract**

- Store one typed revisioned envelope with stable Weekly Draft identity, revision, week number, immutable week-start context, and domain inputs grouped by Upkeep, Activity, Event, and Table Adjustments. Include the typed persistent-event decisions needed by projection without creating a competing draft representation.
- Fixed context includes Persistent Phase Eligibility, determined once from unresolved events carried into the week. Current-week event creation or resolution does not change it. Retain first-use context independently of the displayed week number.
- Canonical values are typed or explicitly absent. Phase selection, readiness, warnings, Resolution Preview, browser text, transport state, and Convex document identifiers are not canonical editable domain inputs.
- Semantic edits are discriminated domain operations, including explicit clears. Do not accept generic partial objects, string paths, form events, or raw text at the Workspace seam.
- Numeric roll/count entry accepts only blank or ASCII digits. Reject invalid typing/paste without changing the field; reject signs, decimal points, exponent notation, and whitespace. Blank emits a clear; accepted digits become a structurally valid non-negative integer. Rules ranges are advisory. Monetary entry uses explicit units that preserve copper precision. Signed Table Adjustments use their own typed validation.
- Browser forms use React Hook Form and Zod with styled field-level errors that distinguish required input from invalid format. Error expansion must not misalign adjacent controls. Canonical domain validators remain the single shared shape; browser schemas validate entry, not a separately maintained persistence model.
- Retain raw dice and modifier provenance, stable action-choice and event-occurrence identities, independent event trees and replacement rolls, per-instance persistent targets and mitigation, narrative acknowledgements, Rules Exceptions, Table Adjustments, operating settlement and consumable bonuses, and order due-day/receipt facts.

**Action Slots and collaboration**

- Activity owns an ordered collection of slots with stable identities independent of display position. A slot owns zero or one complete action-discriminated Staged Action Choice, including assigned team and every action-dependent input. Partial choices are valid draft state.
- Replacing an action removes incompatible prior details. A detail edit verifies that the same staged choice still occupies the target; replacing it with another choice of the same action type must not make an obsolete detail edit safe.
- Deck-to-empty stages; deck-to-occupied replaces; slot-to-empty moves; slot-to-occupied swaps; slot-to-outside clears. Each operation moves or changes complete choices atomically.
- Retain occupied extra slots when capacity shrinks. Warn and require correction or a reasoned Rules Exception before Confirmation. Never truncate staged choices to fit capacity.
- Structural invariants belong to Action Slot. Cross-slot rules such as team use, Lie Low exclusivity, Drill uniqueness, and capacity belong to Rules Projection.
- There are no claims, claimant identities, ownership locks, timeouts, release lifecycle, or persisted per-slot confirmed states. Card interactions stage work; the whole week has the explicit Confirmation action.

**Persistence and Confirmation contract**

- Show semantic edits immediately as pending. `edit` resolves as accepted only after storage; otherwise it resolves failed, discards the failed edit, restores the latest server value, and presents the standard save-failed feedback. Do not expose a separate conflict result.
- Each operation carries a stable draft identity, client operation identity, and base revision. A stale edit can be accepted only when none of its targets changed since that base. Any changed target rejects the entire edit.
- A normal field is one target. Choice replacement, clear, move, and swap target every affected slot. Detail edits target the detail and verify unchanged choice identity. Validate referenced entities and campaign ownership server-side.
- Process each Workspace's submissions in order; later edits cannot finish before earlier edits. Every accepted semantic edit creates exactly one revision. Batching must have the same visible result as ordered individual processing.
- Retry temporary transport failures internally with the same operation identity. Deduplicate accepted retries. Do not automatically retry server rejections. Older responses must never replace newer visible revisions.
- Keep pending edits only for the open page and warn on page exit. Phase navigation neither waits for, cancels, nor flushes edits.
- Confirmation waits for earlier local edits, pauses new local edits, and uses exactly the accepted source the player reviewed. Never substitute the newest or just-flushed revision silently. Relevant militia-snapshot changes outside the draft must also invalidate the reviewed source.
- A pending browser forecast cannot confirm. After acceptance, the matching Convex preview replaces it. Both previews are forecasts; the transactional Weekly Resolution is authoritative.
- Confirmation returns accepted or failed. A stale source, incomplete required input, invalid reference, or failed write rejects the entire transaction. On failure, keep the draft open, load current state, and require review and another explicit attempt.
- Success atomically applies the complete change plan, records the full confirmed source and outcome, closes the old identity, and creates exactly one empty successor with fresh identity and fixed week context. Delayed edits tied to the old draft fail; simultaneous Confirmations cannot advance twice.

**Rules Baseline, exceptions, and complete outcomes**

Compute rules in weekly order: Upkeep, ordered Activity choices, Event, and applicable persistent/successor processing. Read carried persistent facts wherever earlier calculations need them. Local Phase View navigation does not change resolution order.

The complete Rules Baseline precedes ordered typed Table Adjustments. Any player can record a Rules Exception with a required reason to permit a rule-disallowed choice; it does not change arithmetic. Missing required inputs and malformed data still block Confirmation. Distinguish optional mitigation not attempted from an attempted but incomplete mitigation.

Cover all 24 actions, 24 event-table outcomes, four team trees, advancement/reputation/cache tables, officer and manager mechanics, team conditions and recovery/loss, boons, first-use behavior, queued effects, persistent events, and compound interactions. Deterministic values are computed automatically. Dice and narrative adjudication are supplied and recorded; showing explanatory text alone does not execute an outcome. Record reward, boon, encounter, and support acknowledgement with the prescribed quantities and conditions without building tactical or character-builder execution.

The preview and authoritative plan include every militia, team, officer, settlement, cache, marketplace, order, tracked-person, event, queue, and acknowledgement effect. Transaction write loops validate authority and apply the plan; they must not derive additional hidden outcomes. No stale input may grant a benefit for an action no longer staged.

Apply all nine policies accepted in #56:

1. Correct every unaccepted baseline defect. Rank 1 has one baseline action; failed Dismiss Team still removes its target and applies rolled Notoriety. Manual outcomes and missing models remain required work.
2. Calculate deterministic defaults, compose modifiers exactly once, retain raw dice and natural-roll provenance, and record explicit narrative adjudication.
3. Keep reasoned shared Rules Exceptions distinct from reasoned Table Adjustments, retaining both in confirmed source/history.
4. An eligible uneventful week supplies one current-rank modifier to the following week's event chance, not its percentile roll; do not accumulate bonuses across quiet weeks. Preserve first-use and event-specific exclusions, account for automatic events, and bound chance to 10–95%.
5. Resolve duplicate events without a Twice clause independently. Apply actual Twice replacement/enhancement clauses and explicit no-additional-effect clauses. Repeated Roll Twice requires replacement rolls rather than disappearing results.
6. Persistent Double Agent blocks Secure Cache during each affected Activity until ending and applies one −2 Secrecy penalty. Do not add a second queued penalty. A nonpersistent occurrence affects the next Activity only; intentional exceptions remain possible.
7. First persistent buyoff is available immediately. Later buyoffs share one militia-wide four-week cooldown: a week-2 buyoff permits the next in week 6. Cost is twice current minimum treasury; preview the staged cost/end and apply warning/exception policy to insufficient funds.
8. Preserve Special Order duration in days, including one-day expedited delivery and its surcharge, enchantment timing, and explicit receipt with no duplicate receipt. Broker Market retains its separate next-Activity timing.
9. Floor whole counts without invented minima and preserve money to copper precision. Rank-1 Strike Team supplies zero baseline support rounds; odd-level rescue Notoriety and split XP round down.

The audit's full inventory remains required, not just its headline defects. Mandatory examples include first-week skip independent of week number; post-loss multi-rank progression; ordered costs before Theft; no gain without its action; complete readiness; exact-once modifiers; High Morale, Found Fire, and Calm before the Storm duplicates; recurring Rivalry targets and ending; and all queued-effect duration, check, and loss branches.

**Campaign models and history lifecycle**

- Give individual teams stable identities, allowing repeated team types and reward-team cap exemptions. Support multiple officer holders, non-stacking rules except Commandants, distinct Commandant Hit Dice, manager limits, ordered officer changes, and occurrence-specific Strategist bonuses.
- Preserve settlement context, per-event targets and stable age/order, temporary mitigation versus permanent ending, buyoff bookkeeping, one-use bonuses, carry, and precise delivery/receipt state. Extend affected ledger and onboarding interfaces with their required facts.
- New and mid-campaign setup create the same canonical draft lifecycle. Rule deviations in structurally valid existing state remain advisory.
- Exactly one open Weekly Draft exists per militia. A closed draft survives as the complete source of its immutable Resolution Record, not another editable historical draft.
- Store source, Ruleset Version, baseline/final change plans, warnings, Rules Exceptions, Table Adjustments, and final outcome. Increment Ruleset Version when resolution behavior changes, not for presentation or implementation-only changes.
- Historical Week Views read effective immutable records and their recorded source/context, never today's militia snapshot or legacy rollback snapshots. Select the newest unsuperseded record; retain older records as audit history and never merge them.
- Reserve supersession links and the separate History Rewrite seam for future Historical Reconstruction and Historical Correction. Those operations must not reopen a Weekly Draft. The established future contract is one shared rewrite per campaign, ordered recalculation stopping at the first conflict, and atomic publication only after the complete rewrite is valid and explicitly confirmed. Building that editor is outside this implementation.
- Preserve campaign/organization access controls, shared player preparation and Confirmation, and the GM-only correction authority seam. Keep GM controls hidden from non-GM players and enforce authority in the backend.

**Ordered extraction and migration checkpoints**

Follow the accepted sequence in #55. Each extraction keeps the supported application usable, preserves established coverage, and adds outcome coverage for the moved behavior. Move each calculation once. When legacy inputs represent the facts faithfully, browser and server consumers switch to the shared calculation together. When necessary facts are absent, build and test the canonical path in isolation until cutover; do not fabricate raw rolls, collapse occurrences, or discard reasons to fit legacy storage.

1. **Establish verification.** Verify generated Convex artifacts and restore/read the generated AI guidelines before backend implementation. Establish a passing typecheck, lint, and collected-test baseline. Create the machine-readable rules catalog from all 95 audit entries, expanding compound cases and recording gaps. Establish isolated Convex test persistence, transport controls, authenticated browser contexts, and CI gates before extraction depends on them. Missing, skipped, todo, or failed tests do not count as passing coverage.
2. **Introduce canonical contract and Action Slot.** Implement validators, defaults, immutable context, semantic edits, stable identities, partial choices, explicit absence, atomic complete-choice operations, and the additional raw-roll/event/adjudication facts. Prove structural validation, zero versus missing, stale-detail removal, whole-choice movement, and retained extra slots. No live storage changes at this stage.
3. **Prepare additive storage and campaign prerequisites.** Add canonical draft and immutable-record storage beside legacy storage, including deduplication, conflict metadata, and one-open-draft enforcement. Prepare richer teams, officers, events, settlement context, money, and delivery models and their ledger/setup support. Prepare restartable mapping while preserving the usable old release; keep new endpoints unavailable to live campaigns. Existing teams receive stable identities and existing officer holders become singleton collections. Unrecoverable Hit Dice, event targets/order, delivery context, and week-start facts require explicit preflight resolution. Mapping must not guess them or recalculate live balances.
4. **Extract Rules Projection.** Move foundations first, then Upkeep, Activity, Event, and persistent/successor behavior. After each slice require corrected named outcomes, important edge cases, dependent-phase recomputation, and browser/Convex parity. Temporary old exported helpers may translate shapes and delegate only. Do not activate a corrected capacity calculation through a legacy save path that truncates occupied slots.
5. **Complete preview and change plan.** Extend Weekly Resolution only as required. Stage treasury/rank/buyoff effects; account for every authoritative effect; distinguish incomplete required input from unattempted optional mitigation; invalidate previews for all outcome-affecting source changes. Require full preview-to-committed-state-diff equality and retained adjudication source.
6. **Implement Persistence adapters and lifecycle.** Build both adapters against the same contract, including target-aware stale edits, deduplication, ordering, monotonic observations, draft isolation, exact Confirmation, immutable records, and successor creation. Verify production persistence on an isolated deployment and transactional access/race/rollback cases with Convex integration tests. Wrapping the existing last-write-wins save endpoint is insufficient.
7. **Replace Workspace orchestration and phase builders.** Move controller, mutation orchestration, and synchronization responsibilities behind Workspace. Convert Upkeep, Activity, Event, Persistent, and Summary in that order. A temporary canonical-Phase-View-to-existing-props adapter may preserve presentation; remove it when its caller migrates. Keep input/browser mechanics in adapters and leave a thin board shell. Replace coupled tests only after their meaningful behaviors pass at the new interface or an accepted decision supersedes them. Exercise the canonical path in isolation before cutover.
8. **Pass completeness and rehearsal gates.** Require human-reviewed complete corpus coverage, passing mapped tests, current source fingerprints, no unexplained gaps, and projection parity. Rehearse the entire write pause, verified backup, restartable preservation/reset, reader/writer switch, legacy rejection, reload, and pre-reopen recovery on isolated data. Verify one fresh draft, empty choices/new history, retained state/context/carry, and no initialization-triggered Upkeep, queued effects, or week advancement.
9. **Perform paused cutover and retire legacy.** At the later operational cutover, reject all affected campaign writes server-side, including legacy save/confirm/rollback and adjacent writes; take and verify a restorable backup while paused; initialize and verify canonical state; switch readers/writers together; require reload; reopen only after acceptance. Keep old endpoints rejected afterward. Retire temporary adapters, duplicate calculations, old controllers/builders, legacy rows, and obsolete schema fields after acceptance; retain the backup through the verification window.

Map every audit entry to these checkpoints and expanded executable cases. Foundations/officers/teams span stages 2–4; Upkeep/actions span 4–5; Event cases span 4–5; persistence/product contracts span 2–9. Full coverage is a cutover prerequisite, not an assertion made while the initial catalog still contains known gaps.

**Preservation, reset, and recovery contract**

Preserve authoritative current militia values, current week number, characters, officer assignments, teams/conditions, settlement reputation, assets, active/persistent events, first-use metadata, uneventful carry, queued effects, persistent age/order, and buyoff bookkeeping. Retain recoverable week-start context even when it currently lives in legacy week storage.

The approved migration intentionally resets unfinished current-week choices and excludes legacy Resolution Records and embedded rollback history from the new active model. Start history with the first new Confirmation. Retain original storage temporarily for rollback. Initialize exactly one empty draft per militia at an initial revision with fresh stable identities, initial conflict metadata, and empty operation deduplication. Restarting initialization must not duplicate entities, drafts, or carry.

Initialization must not execute Upkeep or Weekly Resolution, apply queues, advance the week, reverse already-applied changes, or retrospectively correct existing balances. Resolve missing required context during preflight before reopening. Verify preserved values/references against backup; exercise editing and Confirmation only in isolated rehearsal, not by advancing a production campaign as a test.

Before reopening, a failed cutover recovers with the compatible old release and retained data or verified backup while writes remain paused. Reopening ends automatic rollback: newly accepted work must be preserved or its loss separately agreed. No online migration, dual writes, unfinished-choice converter, legacy-history reconstruction, or reverse converter is required.

**Testing Decisions**

Good tests assert externally observable behavior through the highest useful module interface. Prefer the Workspace seam for integrated edit/readiness/Phase View behavior, the existing Weekly Resolution interface for outcome/change-plan assertions, and the real Persistence seam where two adapters actually vary. Private setters, effect schedules, merge-object shapes, batching calls, and hook wiring are not contracts.

- **Rules Projection and Weekly Resolution:** Cover named rules outcomes and compound edge cases through the pure interfaces. Check full baseline, adjusted result, required inputs, and complete committed state differences. Reuse meaningful week-advancement, progression, officer/manager, and Weekly Resolution test scenarios after reviewing their expectations against the accepted rules policies.
- **Rules catalog:** Maintain one machine-readable test artifact with stable rule IDs, source references/fingerprints, expected Phase View or Resolution Preview behavior, important cases, and stable named test IDs; generate a readable report. Validate against collected results. Fail for missing mappings, stale sources, missing/failed/skipped/todo referenced tests, or browser/Convex divergence. Source links and fingerprints prove traceability; human review of the full corpus establishes completeness. All 95 audit entries are starting inventory, not a ceiling.
- **Workspace:** Assert readiness states, semantic edit outcomes, local Phase Views, immediate pending feedback, recovery to accepted state, explicit clearing, navigation during pending work, page-exit warning, and reviewed-source Confirmation. Assert fixed Persistent Phase Eligibility when events end or appear midweek.
- **Shared Persistence contracts:** Define scenarios once and run against both adapter factories. The Convex adapter must exercise actual isolated Convex persistence; mocked successful mutation returns are insufficient. Control transport timing without replacing transaction behavior. Cover disjoint stale edits; same-target failure; atomic multi-slot moves/swaps; obsolete detail edits after replacement; one revision per accepted edit; dropped responses and idempotent retry; ordered acknowledgement; monotonic delivery; and closed-draft rejection.
- **Transactional integration:** Retain and adapt the existing Convex history integration foundation. Cover actual authorization, cross-campaign references, GM-only correction authority, mapping, stale source rejection including external militia changes, edit/Confirmation races, simultaneous Confirmations, all-or-nothing failure, immutable records, effective history selection, and exactly one successor. Keep the full rules permutation suite in pure tests.
- **UI:** Preserve formatting and card interaction tests, explicit clear/zero behavior, styled validation, feedback, and browser mechanics. Use existing design-system controls and accessible production interactions. Rule calculations move out of presentation tests with the calculations themselves.
- **Replace coupled tests:** Rewrite controller/mutation/synchronization tests around Workspace and Persistence outcomes. Incrementally replace the hand-built mutation database harness with pure outcome tests or transactional integration; mocked authorization and a hand-built database do not prove access control or rollback. Delete a scenario only when its replacement passes or a linked accepted decision changes the expected behavior. Legacy rollback mechanics are not requirements to retain.
- **Two-player browser gate:** Require separate authenticated browser contexts against isolated Convex persistence before extraction merges. Prove shared edits, independent Phase Views, same-target failure and visible recovery as the new contract lands, Confirmation races, and delayed edits after advancement. Assert eventual agreement, one history outcome, and one successor through domain-state observations rather than arbitrary sleeps or internal calls. Add runner setup, test identities, deployment cleanup, and CI wiring before relying on this gate.
- **Rehearsal:** Assert the full preservation/reset/restart/rejection/reload/recovery contract, including no rule execution during initialization. Production campaigns are not test fixtures.

Every feature extraction runs `pnpm -s typecheck`, `pnpm -s lint`, relevant tests, and the required browser gate for the supported path. Establish new contract scenarios as their implementations land. Full reviewed rules coverage, real adapter verification, multiplayer evidence, and successful cutover rehearsal are mandatory before reopening the migrated application.

**Out of Scope**

- Performing implementation, deployment, or production migration merely by publishing this specification.
- Visual redesign of the week board; retain the tablet-landscape, multi-device card workflow and usable desktop/phone layouts.
- New militia rules or modifications to the campaign rules corpus.
- A full character builder, tactical combat simulator, or automatic execution of GM narrative adjudication.
- Reworking Weekly Resolution internals beyond the interface and completeness needed by this architecture.
- Detailed History Rewrite editing/conflict-resolution UX or reopening old Weekly Drafts. Required record/lifecycle seams remain in scope.
- Prescribing detailed exception and receipt presentation beyond the required shared data, semantic operations, feedback, and outcomes.
- Claim ownership, per-slot confirmation, offline/reload-safe pending edits, dual authority, online migration, and preservation/conversion of discarded unfinished choices or legacy history.

**Further Notes**

This specification is the implementation handoff from the closed planning map, not evidence that its acceptance criteria already pass. Local inspection still finds the existing controller/phase-builder architecture and adjacent Weekly Resolution module. Generated Convex runtime/type artifacts exist, but the generated AI guidelines are absent in this checkout; verification setup must address that before backend implementation. No application tests were run during this synthesis.

Use the repository's domain glossary and militia rules/tables throughout implementation. No relevant ADR directory was present during inspection. Existing local edits to agent guidance and the domain glossary are outside this publishing task.

Related work: reuse the E2E infrastructure strategy and implementation tickets indexed by [#39](https://github.com/AndreasUnunger/EverythingPath/issues/39), especially #22–#25, instead of creating a competing harness. The current realtime journey #29 contains older Confirmed Action Choice/deferred-claim language; update that journey's expectations to #36/#38 when this architecture lands. Persistent Rivalry [#31](https://github.com/AndreasUnunger/EverythingPath/issues/31) overlaps mandatory persistent-event behavior here; preserve its regression while integrating the shared projection and per-instance targets. These links do not assert that related work is implemented or close those issues.

Normative decision sources:

- [#34 — Workspace seam](https://github.com/AndreasUnunger/EverythingPath/issues/34), [#35 — canonical representation](https://github.com/AndreasUnunger/EverythingPath/issues/35), and [#36 — Action Slot aggregate](https://github.com/AndreasUnunger/EverythingPath/issues/36).
- [#37 — Rules Projection](https://github.com/AndreasUnunger/EverythingPath/issues/37) and [#38 — Persistence consistency](https://github.com/AndreasUnunger/EverythingPath/issues/38).
- [#51 — draft/history lifecycle](https://github.com/AndreasUnunger/EverythingPath/issues/51), [#52 — paused cutover](https://github.com/AndreasUnunger/EverythingPath/issues/52), and [#53 — test architecture](https://github.com/AndreasUnunger/EverythingPath/issues/53#issuecomment-5574149639).
- [#54 — foundations, Upkeep, and teams audit](https://github.com/AndreasUnunger/EverythingPath/issues/54#issuecomment-5574293220), [all actions](https://github.com/AndreasUnunger/EverythingPath/issues/54#issuecomment-5574294663), and [events, persistence, and product contracts](https://github.com/AndreasUnunger/EverythingPath/issues/54#issuecomment-5574295825).
- [#56 — accepted exception policies](https://github.com/AndreasUnunger/EverythingPath/issues/56#issuecomment-5580025789) and [#55 — accepted migration sequence](https://github.com/AndreasUnunger/EverythingPath/issues/55#issuecomment-5580172144).

### Accepted verification contract (#53)

Part of [Untangle the Weekly Draft board architecture](https://github.com/AndreasUnunger/EverythingPath/issues/33).

**Question**

What test architecture should protect the Weekly Draft refactor while old modules are replaced?

[Which module owns rules-derived phase projections?](https://github.com/AndreasUnunger/EverythingPath/issues/37) already requires full militia-rules coverage, a CI-enforced rules coverage catalog, Phase View outcome tests, Resolution Preview and Weekly Resolution tests, focused Convex adapter tests, and presentation-only UI tests. Treat those requirements as fixed.

Decide the catalog's code location and check format; the shared contract suite for the production Convex and in-memory persistence adapters; which current controller, hook, mutation-harness, and integration tests should be removed or retained; and the migration compatibility and multi-player end-to-end cases that must survive every extraction step.


**Resolution**

The user confirmed the recommendations in both discussion rounds. Protect the refactor with tests through the agreed module interfaces, a machine-readable rules coverage catalog, and a required two-player browser suite.

**Rules coverage catalog and CI**

Put the canonical catalog at `tests/rules/coverage-catalog.ts` and generate a readable report from it. Each entry carries a stable rule ID, a source reference into `militia-rules.md` or `militia-tables.md`, the expected Phase View or Resolution Preview behavior, important edge cases, and stable IDs of named behavior tests.

CI checks the catalog against collected test results: referenced tests must exist and pass; skipped, todo, missing, or failed tests never establish coverage. Check source fingerprints so a changed rules section requires catalog review. Fail for missing rule mappings, stale source references, or browser/Convex projection differences. A fingerprint or test link establishes traceability, not semantic completeness: review against the full corpus establishes that every testable rule and its important cases have been identified.

During extraction, track known coverage gaps explicitly and require each step to preserve established coverage and cover the behavior it moves. Do not conceal gaps with skipped tests or claim an incomplete catalog is complete. Full reviewed rules coverage is a cutover prerequisite, as required by [Which module owns rules-derived phase projections?](https://github.com/AndreasUnunger/EverythingPath/issues/37). The existing audit and product-exception decisions determine the rule inventory and any authorized departures; this ticket does not resolve those decisions.

**Test surfaces and shared adapter contract**

- Shared pure Rules Projection tests exercise rule outcomes and edge cases. Run representative domain fixtures through browser and Convex entry paths to detect mapping or projection divergence.
- Weekly Draft Workspace tests exercise semantic edits, Phase Views, readiness, pending/accepted/failed outcomes, and Confirmation through the external interface. They do not assert hook wiring or internal object-merging algorithms.
- Weekly Resolution tests retain Resolution Preview and authoritative change-plan assertions.
- Focused Convex integration tests cover document/domain mapping, authorization, accepted revisions, atomic writes, and the draft/history lifecycle rather than duplicating the full rule suite.
- UI tests cover formatting, explicit clearing, interaction, feedback, and presentation. Rule calculations belong in projection tests.

Define the persistence contract scenarios once and run them against factories for both the deterministic in-memory adapter and the production Convex adapter. The production adapter must exercise actual Convex persistence; mocking a successful mutation return is insufficient. Use an isolated test deployment for deployed adapter verification. Control delays, failures, retries, and delivery order through the test harness at the transport seam, without replacing server transaction behavior. Keep `convex-test` for focused transactional integration.

The common scenarios include disjoint stale edits accepted, same-target edits rejected, atomic multi-slot edits, action-detail edits rejected after action replacement, one revision per accepted semantic edit, idempotent retries, submission-order acknowledgement, monotonic responses, and rejection of delayed edits for closed drafts. Workspace scenarios additionally protect immediate local Phase View navigation while edits are pending, page-exit warnings, failure feedback, Confirmation waiting for earlier edits and pausing new local edits, exact reviewed-revision rejection, and edit-versus-Confirmation and simultaneous-Confirmation races. Browser mechanics are exercised through the Workspace/browser surface with each persistence adapter where applicable.

**Existing tests: retain behavior, replace implementation coupling**

- Retain and expand `src/lib/week-advancement.test.ts` and relevant Weekly Resolution outcome tests. Assess their expected outcomes against the written rules and recorded product exceptions rather than preserving an existing defect.
- Retain and expand `convex/weekBoard.history.integration.test.ts` as a transactional integration foundation. Preserve meaningful authorization, preview/outcome, stale Confirmation, concurrent Confirmation, immutable-history, and atomic-failure cases. Adapt fixtures and assertions to the new lifecycle; legacy rollback mechanics are not a requirement to preserve.
- Replace `src/lib/week-board-mutation-harness.test.ts` incrementally. Its hand-built database and mocked authorization do not prove transaction rollback or access control. Move rule cases to pure module-interface tests and persistence cases to adapter contracts or Convex integration.
- Rewrite `use-week-board-controller.test.tsx`, `use-week-board-mutations.test.tsx`, and `week-board-controller-sync.test.ts` around Workspace and persistence outcomes. Preserve local navigation, explicit clears, pending-edit protection, ordering, acknowledgement, and draft isolation. Exact autosave calls, batching schedules, flush methods, and helper object shapes are internal details; preserve only their effects required by the accepted contract.
- Keep presentation and interaction tests at the UI surface. Move calculation assertions to the Rules Projection when those calculations move.

Delete an old test only once its meaningful scenario passes at its replacement interface, or a linked decision explicitly supersedes the old behavior. This avoids both lost coverage and a permanent duplicate suite around retired modules.

**Required two-player browser gate**

Before merging extraction changes, require a small two-player browser suite against an isolated Convex deployment. Use separate authenticated browser contexts and verify shared edits, independent Phase Views, conflicting edits and visible recovery, Confirmation races, and delayed edits after week advancement. Assert eventual agreement and the resulting single successor draft/history outcome, not arbitrary sleeps or internal calls.

Detailed failure permutations remain in the controlled contract suite. The browser suite proves real subscription delivery and user interaction. Runner setup, isolated deployment setup/cleanup, test identities, and CI wiring are required implementation prerequisites: the inspected repository currently has Vitest and `convex-test`, but no browser runner or `.github` workflow directory.

**Extraction and cutover gates**

Every extraction preserves the established behavioral and multiplayer gates and adds coverage for its moved behavior. The extraction-order decision must place the required test infrastructure before steps that rely on it.

Cutover rehearsal must verify the preservation and reset contract from [How can the Weekly Draft contract migrate live campaign data safely?](https://github.com/AndreasUnunger/EverythingPath/issues/52): preserved authoritative campaign state and week context/carry metadata; exactly one fresh draft; empty unfinished choices and new history; restartable initialization without duplicate drafts or effects; no unintended Upkeep, queued-effect application, or week advancement; server-side rejection of legacy writes; and recovery to the old implementation/data before editing reopens. Exercise new edits and Confirmation in isolation, not against production campaign state as a test.

No old-client compatibility conversion or history reconstruction suite is required by the paused-cutover decision. After reopening, restoring an old backup is not automatic rollback.

**Scope**

This records a planning decision only. No test infrastructure, application code, deployment, or production data was changed. The remaining audit, product-exception, and extraction-order questions already have tickets; no new fog or decision ticket was exposed.

### Accepted implementation and cutover sequence (#55)

Part of #33.

**Question**

What exact migration order safely replaces the current Weekly Draft controller, storage shape, duplicated rules, and phase builders with the decided Weekly Draft Workspace, canonical Weekly Draft Revision, Action Slot aggregate, Weekly Draft Persistence adapters, and Weekly Draft Rules Projection?

Name each extraction step, temporary adapter, compatibility point, data migration or backfill, and test checkpoint. Keep the app usable and the test suite green after every step. Avoid running old and new rule implementations as competing sources of truth. Include the full militia-rules coverage gate and every bug or product exception decided earlier in this map.

Planning only: do not implement the refactor in this ticket.


**Resolution: Weekly Draft migration sequence**

Planning only. The driving developer accepted correcting rules alongside each extraction, with representation-dependent behavior activated only once its storage and inputs are ready. The driving developer also confirmed the complete nine-step sequence in the live Wayfinder discussion (“Yes”). This is the accepted planning resolution.

**Fixed decisions and activation discipline**

Use the Workspace, canonical Revision, Action Slot, Persistence, Rules Projection, lifecycle, paused-cutover, test-architecture, audit, and exception decisions indexed in [Untangle the Weekly Draft board architecture](https://github.com/AndreasUnunger/EverythingPath/issues/33). This sequence does not reopen them.

Move each calculation once. Where the old input shape represents the required facts unambiguously, both old browser and server consumers delegate to the extracted implementation in the same change, and corrected outcome tests replace wrong expectations. Where required facts are absent, implement and test the canonical path without activating it for live campaigns until cutover. Do not synthesize raw dice from entered totals, collapse independent occurrences, or discard reasons to fit legacy storage.

The old application remains usable while the canonical path is assembled in isolation. For an activated rule there is one implementation; old and new projections must never compete to produce a live result. The retained old release/data is a rollback artifact, not a second runtime authority. No dual writes, old-client compatibility converter, unfinished-choice conversion, or history reconstruction is required.

**Ordered extraction and checkpoints**

**1. Establish executable verification before extraction**

Restore the generated Convex files, including the required `convex/_generated/ai/guidelines.md`, and read those guidelines before backend implementation. Establish a passing typecheck, lint, and collected-test baseline; the audit's missing-import suite failures and pending tests are not passing coverage.

Create `tests/rules/coverage-catalog.ts` from all 95 audit entries, expanding compound entries into individual rule/case mappings. Record source references/fingerprints, expected behavior, test IDs, and explicit remaining gaps. Wire collected-result validation and a readable report. Establish isolated Convex deployment setup/cleanup, test identities, transport controls, and two authenticated browser contexts before extraction merges rely on them.

Checkpoint: the existing supported behavior runs; every subsequent extraction passes `pnpm -s typecheck`, `pnpm -s lint`, relevant tests, and the required two-player suite for the supported path. New contract scenarios become mandatory as their implementations land. Known coverage gaps remain visible; no skipped/todo/missing test establishes coverage, and no global full-coverage claim is made early.

**2. Introduce the canonical contract and pure Action Slot module**

Define shared validators, inferred types, defaults, immutable week context, explicit absence, and domain-specific `WeeklyDraftEdit` variants. Add stable draft, slot, action-choice, event-occurrence, and referenced-entity identity where needed. Activity is an ordered collection of slots owning complete action-discriminated choices, including assigned team, details, rolls, and costs.

Implement stage/replace, detail edit, clear, move, and swap as pure semantic operations. Retain occupied slots when capacity shrinks; projection supplies the warning/exception/readiness result. There are no claims, ownership locks, timeouts, or per-slot confirmations. The later Rules Exception decision permits an otherwise out-of-rules extra choice when its required reason is recorded.

Add canonical facts needed by the audit: raw rolls and modifier provenance; independent event trees and replacement rolls; per-instance persistent targets, mitigation and ending; narrative acknowledgements; Rules Exceptions and typed Table Adjustments; due-day and receipt data; operating settlement and one-use bonuses. Keep temporary input text outside the contract. Use the agreed digits-or-blank grammar for count/roll entry, explicit clears, and explicit units for monetary inputs so copper precision survives; signed Table Adjustments retain their own validation.

Checkpoint: structural validation, partial choices, explicit zero versus missing, action replacement clearing stale details, complete-choice atomic movement, stable identity, and retained over-capacity choices pass through the pure interface. No live storage changes yet.

**3. Prepare additive storage and campaign-state prerequisites**

Add dedicated canonical draft and immutable Resolution Record storage beside legacy storage, with schema deriving from shared validators. Prepare draft identity/revision, operation deduplication, target-conflict metadata, one-open-draft enforcement, complete source records, and effective-record selection. New endpoints remain inaccessible to live campaigns until activation.

Prepare richer campaign state needed for rules: independent team identities and reward exemptions; multiple officer holders and distinct Commandant Hit Dice; retained settlement context; persistent-event identity, age/order, targets and buyoff bookkeeping; carry and consumable effects; exact order timing and receipt status. Update affected ledger/onboarding interfaces alongside their model support. New campaign creation and mid-campaign setup must eventually initialize the same canonical lifecycle.

Prepare restartable cutover mapping, rather than mutating active campaigns now. Existing individual teams receive stable identities; existing officer holders become singleton collections. Preserve established values and references. Missing Hit Dice, event targets/order, delivery context, or week-start facts require explicit preflight resolution where they cannot be recovered; do not guess them from discarded choices. Do not retrospectively recalculate live balances or execute rules during initialization. Additive schema support must keep the old release usable until cutover.

Checkpoint: mapping fixtures preserve authoritative state and references, support repeated team types/multiple officers, and round-trip monetary precision. Initializer reruns do not duplicate entities, carry, or drafts. Model-dependent behavior is still inactive for live campaigns.

**4. Extract Rules Projection in dependency order**

Use one shared pure `projectWeeklyDraft({ revision, militiaSnapshot })` interface, with focused internal implementations. Extract in this order:

1. Foundations: rank/table lookups, team definitions, identity-aware capacity, focus/check composition, officer and manager mechanics, settlement modifiers, money and whole-count rounding.
2. Upkeep: fixed first-use context; ordered attrition, Notoriety and treasury checks; post-loss multi-rank advancement and boon acknowledgements; staged treasury operations.
3. Activity: process whole choices in slot order against the projected roster/resources/officers; eligibility, all action outcomes and requirements, once-per-team/Drill and Lie Low constraints, Strategist's designated choice, recovery/recruitment/upgrade, assets and narrative records.
4. Event: bounded chance, carry, settlement result modifiers, Sabotage, independent occurrences, automatic events, nested Roll Twice replacements, duplicates/Twice clauses, and every event's outcomes and required inputs.
5. Persistent and successor effects: oldest-first stable processing, per-instance weekly mitigation/end/buyoff, queued effects and expiry, next-week context, and precise order delivery/receipt.

Read carried-event facts during earlier steps whenever they affect checks or availability; the sequence of code extraction does not change the rules' runtime order. Replace duplicated browser/Convex action requirements, event derivation, and calculation helpers as each slice activates. Existing exported helpers may temporarily delegate to the new pure implementation with shape translation only.

Checkpoint after each slice: corrected named outcomes and important edge cases pass; browser and Convex entry fixtures agree; dependent later-phase results recompute correctly. Do not activate an isolated numeric fix if it triggers legacy destructive behavior—for example rank-1 capacity cannot ship through a save path that silently slices away occupied slots.

**5. Complete the Resolution Preview and authoritative change plan**

Extend the existing Weekly Resolution interface only as needed to consume the canonical source and shared calculations. Include every militia, roster, officer, settlement, cache, order, person, event, queue, and acknowledgement effect in the preview/change plan. Move hidden calculation logic out of confirmation write loops; transaction code applies the plan and validates authority rather than independently deriving outcomes.

Compute the complete Rules Baseline first, then ordered typed Table Adjustments. Rules Exceptions permit choices without modifying arithmetic. Required missing inputs and malformed references still block Confirmation. Optional mitigation not attempted differs from an attempted incomplete mitigation. All outcome-affecting source changes must invalidate the reviewed preview, including relevant campaign edits outside the draft.

Treasury deposits/withdrawals, rank effects, and persistent buyoff participate in staged weekly outcomes under the later audit/exception/lifecycle decisions; the earlier seam ticket's adjacent-operation wording must not preserve immediate writes that bypass reviewed Confirmation. Historical navigation stays a separate read-only operation. Preserve the authority seam and GM-only correction controls without implementing the deferred History Rewrite editor.

Checkpoint: full preview-to-committed-state-diff equality; no hidden effects or double-applied totals; required-input matrices; explicit departures retained in confirmed source; incomplete drafts cannot confirm.

**6. Implement both Persistence adapters and the new lifecycle**

Implement the deterministic in-memory adapter and production Convex adapter against the same contract. Require stable draft/operation identity and base revision; target-aware stale-edit acceptance/rejection; atomic multi-slot edits; detail edits checked against the same staged choice; one revision per accepted semantic edit; idempotent retries; ordered acknowledgements and monotonic responses. Do not wrap the legacy save endpoint and claim it provides these guarantees.

Confirmation is an exact-reviewed-revision barrier. It waits for earlier local edits, pauses new local edits, rejects a changed reviewed source, and atomically applies the complete plan, records the full source/ruleset/outcome, closes the old identity and creates one empty successor with fixed context. Delayed edits cannot reach the successor. History reads effective immutable records, never today's militia snapshot or legacy rollback snapshots.

Checkpoint: run shared contract scenarios against both adapters, with the production adapter exercising actual isolated Convex persistence. Retain focused `convex-test` authorization, cross-campaign reference, race, atomic-failure, immutable-history and lifecycle cases. Test edits racing edits/Confirmation, two Confirmations, dropped responses and retries, remote source changes, and stale closed-draft requests.

**7. Replace controller orchestration and phase builders through Workspace**

Introduce `useWeeklyDraftWorkspace` with unavailable/loading/failed/ready states, discriminated Phase Views, and `edit`, `viewPhase`, `confirm`. Replace `use-week-board-controller.ts`, `use-week-board-mutations.ts`, and `week-board-controller-sync.ts` responsibilities behind it. Keep local Phase View navigation immediate during pending edits, standard failure recovery, pending acknowledgement and page-exit warnings.

Convert phase sections in Upkeep, Activity, Event, Persistent and Summary order, consuming projection facts without rule calculations. A temporary canonical-Phase-View-to-existing-props adapter may preserve presentation while each section changes. Remove that adapter as soon as its caller migrates. Keep text parsing and pointer/drag/DOM mechanics in browser adapters; drops emit complete semantic edits. `WeekBoard` becomes a thin shell, and `build-view-models.ts` no longer provides a parallel orchestration interface.

Checkpoint: Workspace outcome tests, formatting/clear/drag/feedback UI tests, and real two-player agreement with independent navigation. Replace old tests only after their meaningful scenarios pass at the replacement interface or a linked decision supersedes their expected behavior. Retain useful Weekly Resolution and history integration cases; retire the hand-built database harness incrementally. Exercise the new path in isolation until cutover.

**8. Pass completeness and paused-cutover rehearsal gates**

Require human-reviewed coverage of the complete rules and tables corpus, with all mapped test IDs present and passing, fingerprints current, no unexplained gaps, and browser/Convex parity. The audit inventory is the starting point, not the completeness ceiling. All 24 actions, 24 event-table outcomes, four team trees, tables, officers, managers, sequence, persistence and product contracts must be covered, including important compound cases.

Rehearse server-side write pause, verified restorable backup, restartable preservation/reset, reader/writer switching, legacy-request rejection, reload and pre-reopen rollback on isolated data. Verify all campaign state/current week/context/carry retained, exactly one fresh empty draft per militia, empty new history, and no Upkeep, queued-effect execution or week advancement caused by initialization. Test new editing/Confirmation in isolation, never by advancing a production campaign as a test.

**9. Perform the agreed paused cutover, then retire legacy code**

At implementation time: reject all affected campaign writes server-side, including legacy save/confirm/rollback and adjacent writes; take and verify backup while paused; initialize preserved state and canonical drafts; verify invariants and rejected old requests; switch readers/writers together; require reload; reopen only after verification. Old endpoints remain rejected after reopening.

Before reopening, recover using the compatible old release and retained old data or backup while writes remain closed. Reopening ends automatic rollback: newly accepted work must be preserved or its loss separately agreed. After acceptance, remove temporary adapters, old controllers/builders/calculations, legacy rows and obsolete schema fields; retain the backup through the agreed verification window. Do not keep dual authority for convenience.

**Mandatory bug and exception accounting**

Every one of the audit's 95 entries must map to an extraction checkpoint and its expanded executable cases. Foundations/officers/teams map to steps 2–4; U01–U06 and A01–A24 to steps 4–5; E and EV entries to steps 4–5; P01–P11 to steps 2–9. The audit's explicit defect group—F01/F04, U01/U04/U06, T03/T05/T06, A06/A07/A19/A22, E03/E04/E06/E07, EV03/EV04/EV05/EV07/EV09/EV11/EV15/EV16/EV19/EV23—is mandatory but not exhaustive. Manual outcomes and missing models are also required work.

Apply all nine accepted exception-policy decisions: correct unaccepted defects; calculate defaults and record dice/narrative acknowledgement; require reasoned shared Rules Exceptions separately from Table Adjustments; use one current-rank bonus to next eligible week's bounded event chance without accumulation; resolve no-Twice duplicates independently and apply actual Twice clauses; keep persistent Double Agent's cache restriction and single −2 penalty until ending; allow immediate first buyoff then a militia-wide four-week cooldown at twice current minimum treasury; retain day-based Special Order timing and explicit receipt while Broker Market keeps next-Activity timing; floor whole counts without invented minima and preserve money to copper precision.

Explicit regression examples include rank-1 one-action baseline, failed dismissal still removing its target and adding Notoriety, first-week skip independent of displayed week, post-loss rank progression, ordered costs before Theft, no action gain without its action, complete readiness, exact-once modifiers, duplicate High Morale/Found Fire/Calm before the Storm behavior, and all queued-effect duration/check/loss branches. Product exceptions for shared unlocked slots, stable over-capacity choices, local navigation, fixed persistent eligibility, exact Confirmation and immutable history remain in force.

**Completion boundary**

This ticket produces the migration plan only. Implementation, deployment and production changes are separate work. Detailed History Rewrite and exception/receipt presentation remain outside the map's destination; required data, semantic operations and outcome coverage are included. No new domain terms or ADR are needed. Existing local AGENTS.md and CONTEXT.md edits remain untouched.

- [x] **COMPLETE.CORPUS** — After reading the included rules, tables, and accepted product policies, I found no additional rule or important scenario missing from this checklist. List any omissions here.

## Finish the review

Only answer the final check after reviewing the complete document. Partial replies are welcome and do not count as full sign-off. A correction or unresolved question keeps the relevant check pending until addressed.

- [x] **REVIEW.SIGNOFF** — The complete semantic review is finished, all requested corrections/decisions are recorded, and I approve the reviewed rules coverage. Include reviewer name and review date. If unfinished or changes are needed, say that instead. This does not approve deployment or production cutover.

```text
Reviewer: AndreasUnunger
Review date: 2026-09-23
Reviewed groups: All checklist groups
Corrections / decisions: Recorded in this checklist and the review conversation
COMPLETE.CORPUS: OK
REVIEW.SIGNOFF: APPROVED
```

Review record: the reviewer checked every behavior/completeness item, COMPLETE.CORPUS, and REVIEW.SIGNOFF, then confirmed “done” in the review conversation on 2026-09-23. Codex performed the five SOURCE classifications at the reviewer’s request. This approval covers the reviewed semantics and recorded corrections; production deployment and cutover are not approved by this record.

## Evidence and review scope

Human review is complete: AndreasUnunger approved the full corpus and all 487 active behavior checks on 2026-09-23. The checked review above includes the recorded corrections. F02.ap-caps was removed by instruction; story-reward extra actions (F04.context) are deferred to [#98](https://github.com/AndreasUnunger/EverythingPath/issues/98).

Final verification on 2026-09-23:

- **1,003 tests across 106 files pass**, with no skipped or pending results.
- **Typecheck, lint, and all three build-boundary tests pass.**
- **All nine isolated browser results pass** on their first attempts in the final run, including both authenticated players, persistence races, exact Confirmation, and immutable history.
- **486 of 487 cases have passing mapped evidence.** Three explicit operational gaps remain: E06.preserve, P11.cutover, and P11.legacy. Some cases have passing tests but still lack their deployment rehearsal.
- All mapped test identifiers and source fingerprints are current. The strict gate's only error is **“Completeness gate: 3 remaining gaps.”**

Those three gaps are agent implementation/rehearsal work in [#89](https://github.com/AndreasUnunger/EverythingPath/issues/89), not further questions for this human review. They cover carry preservation, paused restartable cutover, and recovery before reopening. Explicit old-version request rejection and forced reload handling are out of scope. Production cutover is separate (#90); no production changes were made.

The deeper Spec review found no remaining concrete defect after correcting existing-militia setup's Upkeep behavior. The Standards review found no documented violations; its naming cleanup is now fixed. The helper and view-model field use event-choice names, and the unused teams parameter is removed. This naming-only follow-up passes typecheck, lint, and all 1,003 tests across 106 files. The browser setup test and Hidden Agenda test identifiers were also corrected, then verified afresh.

The browser and strict acceptance records below describe commit `1d5329b`, before the naming-only follow-up. They have not been rerun for that follow-up; its separate checks are recorded above.

Baseline implementation fingerprint: `273197fe4744b457f192465225d1eb0120f16520e8de99e90f4d569294085e6d`.

Final browser record: `e2e-artifacts/e2e-local-andreasununger-slot-0/everythingpath-e2e-YbAt68/report.json`. Automated acceptance record: `coverage/acceptance.json`; the generated coverage report is also retained in `docs/weekly-draft-acceptance-review.md`.
