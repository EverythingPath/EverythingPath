# EverythingPath

## Todo

- [x] Deploy
- [x] CI
- [x] Database
- [x] Auth
- [x] Db schema
- [ ] Role based auth
- [x] queryCacheProvider
- [ ] Posthog
- [x] overview at the top with basic name, stats, date, location
- [ ] manual add team to militia
- [ ] militia stats input
- [ ] set up main "upkeep, action, event" game loop page
- [ ] upkeep phase
- [ ] action phase
- [ ] event phase
- [ ] keep track of in game date


initiate weekly rolls button unlocks the three tabs

upkeep phase 
input result of attrition roll in MVP, auto roll in future
add penalty for low treasury to attrition
increase rank ?
adjust treasury. number field, slider

action phase
shuffle out cards for each action with text in MVP, images later
show teams on the side  
when an action card is hovered the associated team glows
when an action card is dragged into an action slot the associated team moves to that slot as well
show disabled actions at the bottom as well
hovering a team makes the associated actions glow

## Week Board Rules Gap Closure (Prioritized)

- [ ] 1. Add authoritative week-apply engine in Convex and call it when advancing from `week_closed` to next week.
- [ ] 2. Enforce first-week lifecycle semantics so week 1 starts in Activity and skips Upkeep by default.
- [ ] 3. Add Event-phase reactive `Sabotage` flow (roll entry, negate check, notoriety impact).
- [ ] 4. Implement event edge semantics in backend resolution (`Roll Twice` limits/rerolls, duplicate `Twice`, impossible rerolls, persistent order).
- [ ] 5. Execute queued and persistent event effects across week boundaries.
- [x] 6. Complete Upkeep Step 2 branch (DC 15 Loyalty outcome + nearest-settlement reputation drop handling).
- [x] 7. Add team-capability and once-per-team action legality handling.
- [ ] 8. Implement explicit Guarantee/Manipulate “roll two, choose one” event flow.
- [x] 9. Add integration tests covering full-week advancement and edge cases.
codex resume 019c632d-870a-74a0-a12f-8c1004849ac5

## Settlement + Asset Ledger Plan

### Goal

- [ ] Add durable militia world-state records for the stateful actions and events that currently have only partial UI or backend support.
- [ ] Make these records visible during play, editable for mid-campaign onboarding, and resolved automatically by week commit logic.

### Recommended Data Model

- [ ] Extend `militiaSettlementState` with temporary market/refuge metadata needed for weekly play and event resolution.
- [ ] Add `militiaCache` table for hidden/planned/retrieved/lost caches.
- [ ] Add `militiaCharacterStatus` table for hidden/captured/recovered militia-linked characters and NPCs.
- [ ] Add `militiaOrder` table for `Broker Market` and `Special Order` deliveries.
- [ ] Add `militiaOperationNote` or similar lightweight freeform record only if a rules-backed structured table is not sufficient for a specific action.

### Week State Drafts

- [ ] Add activity draft payloads for settlement/asset-targeting actions:
  - `activate_refuge`
  - `broker_market`
  - `covert_action`
  - `rescue_character`
  - `restore_character`
  - `secure_cache`
  - `special_order`
  - `spread_propaganda`
  - `strike_team`
- [ ] Keep drafts keyed by `slotIndex` so they fit the existing staged-card workflow and summary page.
- [ ] Prefer one focused activity-payload structure over many parallel local states where possible.

### Backend Application Logic

- [ ] On week commit, convert staged action payloads into durable settlement/asset records.
- [ ] Apply event outcomes against those records:
  - `Cache Discovered`
  - `Raid`
  - `Market Day`
  - `Turn Around`
  - any event that references caches, refuges, hidden persons, or ordered goods
- [ ] Process delivery timing for pending orders when weeks advance.
- [ ] Process expiry for temporary refuge/market effects when weeks advance.

### UI Surfaces

- [ ] Add a settlement/assets panel that shows:
  - settlement reputation and temporary effects
  - active refuges
  - caches
  - hidden/captured persons
  - pending/delivered orders
- [ ] Expose action-specific controls directly on the staged cards for actions that create or target these records.
- [ ] Add GM/manual ledger controls for correction, onboarding, and out-of-band story updates.
- [ ] Surface these records in campaign info and week summary where they affect current play.

### Testing

- [ ] Add mutation harness coverage for creation, expiry, delivery, and event interaction of new settlement/asset records.
- [ ] Add UI tests for staged-card payload editing and sync behavior on the new action flows.
- [ ] Add multi-user tests for concurrent edits to settlement/asset draft fields.

### Suggested Delivery Order

- [ ] 1. Schema + query shape for settlements, caches, character status, and orders.
- [ ] 2. Read-only settlement/assets panel in the app shell.
- [ ] 3. Week-board payloads and UI for `Activate Refuge`, `Secure Cache`, and `Special Order`.
- [ ] 4. Commit-time application for those three actions.
- [ ] 5. Event handling for `Cache Discovered` and `Raid`.
- [ ] 6. Character capture/recovery flow for `Rescue Character` and hidden persons.
- [ ] 7. `Broker Market`, `Market Day`, and remaining temporary settlement effects.
