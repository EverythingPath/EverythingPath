# Campaign initialization preparation (#65)

`convex/lib/campaignInitialization.ts` exposes unregistered preflight and
initializer functions for isolated transaction tests and the later paused-cutover
runner. The only registered caller is the capability-guarded, disposable preview rehearsal
in `canonicalPersistenceFixtures`. There is no live migration or activation switch.

1. Read `preflightCampaignInitialization` as an organization member. It returns the
   authoritative source, recoverable week-start values, preparation records,
   missing/preservation issues, and an exact reviewed-source token.
2. Complete the existing isolated roster and campaign-context preparation seams
   from #63/#64. Preserve legacy character IDs, `legacy-team:<document ID>` team
   IDs, settlement keys, and event/order/cache document IDs. Known legacy facts
   are checked against preparation. Unknown Hit Dice, event targets/order,
   day-based delivery and receipt facts require explicit preparation; character
   level and discarded choices are never used to fill them. Week-start carried
   events are recovered from their start/end weeks: current-week creations are
   excluded, and events ended during this week remain in the fixed context.
   A resolved event with no end week blocks preflight until preparation supplies
   that historical fact; recorded legacy dates remain authoritative.
3. Repeat preflight until ready. Queues retain stable source keys
   `legacy-queue:<week document ID>:<index>`. Check modifiers and action blocks
   must preserve their arithmetic. Unsupported automatic variants block preflight until the canonical effect
   model can represent them faithfully; serializing them as narrative is not
   accepted. Original carry amounts and all original documents remain intact.
4. Pass the exact token and a freshly allocated, stable `initializationId` to
   `initializeCampaign` inside a single isolated mutation transaction. It opens
   an empty revision-zero draft at the existing week with fixed context and
   writes a receipt atomically. The initializer never saves prepared facts,
   changes balances, consumes queues, advances weeks, or invokes rules. It also
   writes the preserved canonical source snapshot in the same transaction so
   ordinary Workspace reads, edits, and Confirmation can use the initialized draft.
5. Retry with the same ID and token after a lost response. The receipt returns
   the original draft ID, including after subsequent edits, without resetting
   anything. Different source/identity attempts fail. Existing canonical drafts
   or history without a matching receipt are rejected rather than adopted.

The original militia, characters, assets, conditions, events, week/phase context,
unfinished choices and history remain untouched for recovery rehearsal. Only
canonical history is initially empty; legacy history is not copied into it.
All legacy asset metadata, including marketplaces and tracked-person status,
remains authoritative in its original tables and is included in source review.

Preparation now also requires explicit `resolutionAssets`: complete economy,
character-action and event-benefit collections, including empty ones. This resolves
facts such as item weights/locations and cache inventory without guessing.
Preflight validates known prepared values against that snapshot and checks all
canonical references. Legacy marketplaces/tracked people, enchantment orders,
and current-week event transitions still need faithful mappings; preflight rejects
them rather than dropping their current state. Recovered week-start event facts
remain visible for review even when activation is blocked.

Preparation is bounded to 256 documents per source collection and a 750 KB
receipt. Oversized sources report a preflight issue and cannot initialize;
prepare a paginated cutover plan for those campaigns.
Missing/closed current-week records and cancelled orders also fail preflight
rather than guessing an open week or a receipt. See the [paused rehearsal runbook](paused-cutover-runbook.md) for #89 evidence
and recovery. Production activation remains #90; explicit old-tab rejection is
out of scope under the accepted P11.legacy review decision.

Evidence: `convex/campaignInitialization.integration.test.ts` exercises real
isolated Convex transactions through the preparation/initialization/storage
interfaces. The rules catalog links the preservation and no-execution outcomes.
