## Superseding review decisions — 2026-09-23

The user's review of #88 supersedes conflicting historical expectations below:

- F02.ap-caps: remove current Adventure Path/volume tracking and volume-based rank limits.
- F04.shrink: preserve choices in unavailable slots, but block Confirmation until moved, cleared, or allowance restored. Rules Exceptions cannot bypass action capacity.
- F04.context: extra actions from story rewards are deferred to [backlog #98](https://github.com/AndreasUnunger/EverythingPath/issues/98).
- F05.order: recruitment and dismissal in the same committed week work in either order when the resulting roster fits team capacity.

Part of #33.

## Question

Which mismatches found by **Audit Weekly Draft behavior against the full militia rules corpus**, if any, are intentional product exceptions rather than bugs?

The written militia rules are the default. For every proposed exception, decide the observable behavior, reason, Phase View or Resolution Preview effect, and required test. Treat every mismatch not explicitly accepted here as a bug to correct during the refactor.


## Resolution

Accepted by the driving developer in the live Wayfinder discussion: “Sounds good” for policies 1–3, then “Go with recs” for interpretations 4–9 below. This is a planning decision, not an implementation report.

The evidence inventory is [Audit Weekly Draft behavior against the full militia rules corpus](https://github.com/AndreasUnunger/EverythingPath/issues/54). Its 95 entries remain the coverage inventory; this resolution supplies the exception policy and interpretations for that inventory.

### Baseline and intentional product behavior

No demonstrated legacy calculation bug is accepted merely to preserve current behavior. Every mismatch not explicitly covered by an accepted decision remains a bug to correct during the refactor. Missing models and tests remain required work; manual handling is not permission to silently omit an outcome. Previously accepted Workspace and lifecycle decisions remain in force.

| Decision | Accepted observable behavior and reason | Phase View / Resolution Preview effect | Required tests |
|---|---|---|---|
| 1. Correct baseline defects | Follow the written rules unless an explicit accepted interpretation below applies. In particular, rank 1 grants one baseline action; failed Dismiss Team still removes the team and adds rolled Notoriety. Existing tests asserting incorrect behavior must be replaced. | Show corrected action allowances and projected roster/results. | Rank boundaries and Strategist; failed dismissal removes the target and applies Notoriety; corrected outcomes for every mismatch in the audit. |
| 2. Computation and table adjudication | Calculate deterministic defaults from the rules. Players provide dice rolls and narrative adjudication. Narrative outcomes require explicit acknowledgement/recording; do not pretend that displaying instructions executes an outcome. Full character-builder and tactical-combat execution remain outside scope. This preserves table authority without hiding missing calculations. | Show the calculated baseline, missing rolls/acknowledgements, and explicit Table Adjustments separately. Include reward, boon, encounter, and support reminders with the prescribed quantities/conditions. | Raw-roll and modifier branches, including natural rolls; missing-input readiness; baseline versus adjusted result; narrative acknowledgement retained in the confirmed source/history; no double application of computed and entered outcomes. |
| 3. Rules Exceptions | Any player may retain an out-of-rules choice through a shared Rules Exception with a required reason. It permits the choice; it does not rewrite the calculated result. Missing required inputs and malformed data still block Confirmation. This supports table-valid exceptions while keeping departures visible. | Explain the eligibility warning and recorded exception. Apply typed Table Adjustments after the baseline when the result itself is changed. | Over-allowance choice with/without a reason; exception visible to another player; malformed references/data and required missing inputs remain blocked; exception does not itself alter arithmetic; confirmed source retains the exception. |

### Accepted source interpretations and timing policy

These are explicit project decisions where the audit identified ambiguity or a representation shortcut. They are not claims that every detail is unambiguously prescribed by the source.

| Decision / inventory | Accepted observable behavior and reason | Phase View / Resolution Preview effect | Required tests |
|---|---|---|---|
| 4. Uneventful carry — E05 | After an eligible uneventful week, add the current rank once to the following week's event **chance**, not to the percentile roll. Do not accumulate rank across consecutive quiet weeks. The verbatim Event Phase wording supports chance and does not explicitly prescribe accumulation. Preserve first-militia-week exclusion and the event-specific exclusions; automatic events count when deciding whether the week was uneventful. | Show one rank modifier and the resulting bounded 10–95% chance. | Consecutive quiet weeks do not accumulate; changing rank uses current rank; chance-versus-roll; 10/95 boundaries; first-use metadata; All Is Calm and Calm before the Storm/automatic-event exclusions. |
| 5. Duplicates without Twice — E04 and affected events | Resolve both occurrences separately when a duplicate has no Twice clause. Where a Twice clause exists, use it; explicit “no additional effect” still suppresses the additional effect. A duplicate is not automatically discarded. | Show both applicable outcomes/required inputs in order. Additional Roll Twice results require replacement rolls rather than disappearing. | Two no-clause occurrences, a replacement/enhancement Twice clause, explicit no-additional-effect clauses, repeated Roll Twice rerolls, independent targets/rolls and order-sensitive results. |
| 6. Persistent Double Agent — EV05 | Block Secure Cache every affected Activity phase until the persistent event ends; apply one −2 Secrecy penalty, not queued −2 plus persistent −2. This follows the general persistence rule that effects continue week after week. A nonpersistent occurrence blocks only the next Activity phase. | Explain ongoing eligibility and the single penalty; never silently discard a staged cache action. Rules Exception policy still applies. | Base next-week duration; first and later persistent weeks; no −4 double count; ending/buyoff removes future restriction and penalty; warning/exception path. |
| 7. Buyoff cadence — P03 | First buyoff is available immediately. Thereafter use one four-week cooldown shared across the militia's persistent events: buyoff in week 2 allows the next in week 6. Charge twice the current minimum treasury. This treats “once every 4 weeks” as a cooldown rather than a mandatory initial wait. | Show eligibility, next eligible week, cost, and staged end in the preview. Retain the accepted whole-week Confirmation lifecycle rather than immediate authoritative writes. | First use before week 4; weeks 2/5/6; different target events share cooldown; current-rank cost; two-player competing edits and Confirmation; insufficient funds use the agreed warning/exception policy. |
| 8. Special Order timing — A21 | Preserve actual delivery duration in days, including one-day expedited delivery, and record receipt explicitly. Do not silently round every order to a later week. Exact due-day information preserves the value of expediting. This policy does not change Broker Market's separate next-Activity timing rule. | Show due-day information and receipt status, with deterministic price/time defaults and entered dice. Receipt remains subject to the accepted draft/Confirmation lifecycle. | Ordinary 2d6 boundaries, one-day expedite and its surcharge, enchantment time, orders crossing week boundaries, explicit receipt recording and no duplicate receipt; Broker Market retains its distinct timing. |
| 9. Fractions — F09/A16/A23/EV19 and related numeric cases | Round whole-count results down. Strike Team support has a minimum of one round (A23.rank-one review decision, 2026-09-23). Preserve money to copper precision; odd-level rescue Notoriety and split XP round down. This establishes consistent defaults where the audit found unspecified rounding or an invented minimum. | Show the rounded baseline and any explicit adjustment; preserve monetary precision. | Odd/even half-rank and half-level values, rank-1 minimum of one round, non-divisible XP awards, fractional treasury/price calculations at copper precision, and explicit adjustment paths. |

### Handoff

The shared Rules Projection owns these baseline calculations and interpretations; Phase Views present them. The Weekly Draft retains the necessary rolls, choices, acknowledgements, Rules Exceptions, and Table Adjustments so the Resolution Preview and Confirmation use the same source. Preserve the established exact-revision Confirmation and immutable Resolution Record contracts.

Use the audit inventory to expand compound entries into executable rule/case coverage under [What test architecture should protect the Weekly Draft refactor?](https://github.com/AndreasUnunger/EverythingPath/issues/53). In particular, replace legacy expectations for cumulative carry, suppressed no-clause duplicates, failed dismissal, and invented minimum rounds. Do not treat existing test success as proof of rules completeness.

The remaining migration-sequence decision must account for day-based orders, persistent-event targets/cadence, independent occurrences and rolls, complete calculated defaults, and recorded table decisions. Detailed exception/receipt presentation stays with implementation; no new planning ticket is needed for the accepted policies.

No application code, campaign data, deployment, or rules corpus changed. Existing local edits to AGENTS.md and CONTEXT.md were left intact. No tests were run because this session resolved planning policy only.
