# Militia board: product description

The product description of the Ironfang militia operations board, moved verbatim from `AGENTS.md`. The engineering standards that used to sit inside it (Roll Input Copy, Validation Philosophy, UI Implementation Preference, Engineering Guardrails) are in [`../standards.md`](../standards.md).

## Product Goal

The application is a multiplayer Pathfinder militia operations board for Ironfang campaign play. It must turn the militia subsystem into a fast, table-usable workflow and keep shared state synchronized through Convex in real time.

## Core Tabletop UX

- The default play model is `multi-device at one table`, where all players can interact from their own device.
- The primary layout target is `tablet landscape`; desktop and phone views should remain usable as secondary layouts.
- The UX should minimize turn friction, surface the current decision clearly, and keep militia status legible at a glance.

## Real-Time Collaboration Contract (Convex Sync)

- Militia state updates must sync to all connected players in real time through Convex.
- Collaboration is fully shared: any player can make allowed changes.
- Action slots are shared: any player may edit any slot until the week is confirmed, and the latest change wins.
- Clients should show immediate visual acknowledgement when changes fail to save or arrive from other players; saving is acknowledged where it happens.

## Card Selection Interaction Model

- Any player choice between options (such as teams or actions) should be presented as playing-card style choices.
- Cards should support hover lift, subtle animation, drag affordance, and slot highlighting.
- Choices placed in slots are visible to all players in real time.
- Invalid drops must return cards to origin with clear feedback.

## Militia Flow Alignment

- The application flow must follow the militia weekly sequence:
  1. Upkeep
  2. Activity
  3. Event
- Action cards and slot availability must be constrained by militia rules and current state.
- Rank, training, treasury, notoriety, reputation, events, and team constraints should be rules-driven using:
  - `docs/ai/ironfang-militia/militia-rules.md`
  - `docs/ai/ironfang-militia/militia-tables.md`

## Moderation and Authority

- All users with access to the organization have the same editing and correction permissions for its militia data.
- At this stage there are no separate GM controls or GM-only permissions.
- Everything is done with the GM's blessing; the users are cooperating. The app treats every action as GM-approved: it never asks whether the GM allows an action and never gates a choice behind a GM-permission answer or a Rules Exception for GM discretion.
- Where the corpus says something is "at GM discretion" or "may be impossible", the app treats it as allowed and records the departure from the corpus under a Ruleset Version, as the Spread Propaganda note for Ruleset Version 9 in `militia-rules.md` does.
- Enforce organization membership and campaign-scoped references for every read and write.

## Character Ledger and Officer Assignments

- The application must include a ledger for tracking characters tied to the militia.
- The MVP ledger should support creating and editing basic character records with at least:
  - name
  - level
  - core stats/ability scores
  - short notes
- The ledger must support assigning characters to militia officer roles and show current assignments clearly.
- Officer assignment data should be campaign-scoped, synced in real time through Convex, and visible to all players.
- Reassignment must be straightforward during play (unassign, replace, or move between roles) without losing character records.
- This ledger is the foundation for a future full character builder; current implementation should keep the model simple and extensible.

## Rules Completeness Constraints

- Do not re-encode rule text in this file; enforce behavior by referencing `militia-rules.md` and `militia-tables.md`.
- Weekly state must track enough metadata to run rules correctly across weeks:
  - first-week-upkeep skip
  - uneventful-week bonus carry
  - queued next-week effects
  - persistent events with age/order
- Officer assignments must apply officer mechanics from rules, including non-stacking behavior (except commandant where applicable), strategist action bonus behavior, and manager Charisma effects/limits.
- Team state must support at least `active`, `disabled`, and `missing`, including their rule-based recovery/loss handling.
- Action validation must enforce rule constraints such as:
  - per-phase/per-team action limits
  - `Lie Low` exclusivity
  - `Drill Militia` once-per-Activity
  - upgrade/recruit availability and team-cap constraints
  - event-phase reactive actions (for example `Sabotage`)
- Event resolution must include edge semantics from rules: min/max event chance bounds, `Roll Twice` handling, `Twice` duplicate behavior, and persistent-event mitigation/buyoff cadence.

## Existing Campaign Onboarding (Mid-Campaign Start)

- The system must support creating a militia at an in-progress state, not only at rank 1 / week 1.
- Users must be able to initialize militia data from current table state in one setup flow, including at least:
  - rank, training, treasury, focus, notoriety
  - current reputation by settlement
  - active teams and team conditions (`active` / `disabled` / `missing`)
  - current officer assignments
  - active/persistent events and queued next-week effects
  - current week/phase context
- Initialization should validate rule consistency (for example rank/training thresholds, team caps, and phase legality) and show clear errors before saving.
- This onboarding path is a first-class workflow for MVP, not a fallback or admin-only feature.
- After initialization, gameplay must proceed using the same weekly rules flow as normal play, without special-case behavior.

## Non-Goals For MVP

- Do not build a full tactical combat simulator.
- Do not replace GM adjudication or full rulebook interpretation.
- Focus on synchronized militia tracking, option selection, and weekly phase execution.

## Militia rules corpus

The Ironfang militia rules are stored in:

- `docs/ai/ironfang-militia/militia-rules.md`
- `docs/ai/ironfang-militia/militia-tables.md`
- `docs/ai/ironfang-militia/militia-verbatim.md`
- `docs/ai/ironfang-militia/search-tags.md`
- `docs/ai/ironfang-militia/README.md`

### How To Search

Use `rg` first, then open only matching files/sections.

- Find exact action logic:
  - `rg -n "^## Action:|Drill Militia|Reduce Danger|Restore Character" docs/ai/ironfang-militia`
- Find weekly procedure order:
  - `rg -n "Upkeep Phase|Activity Phase|Event Phase|Step 1|Step 2|Step 3|Step 4|Step 5" docs/ai/ironfang-militia`
- Find event behavior and mitigation:
  - `rg -n "^## Event:|Mitigate|persistent|Twice:" docs/ai/ironfang-militia`
- Find numeric thresholds quickly:
  - `rg -n "Table 6-1|Table 6-2|Table 6-3|DC|Minimum Training|Max Actions|Max Teams" docs/ai/ironfang-militia/militia-tables.md`
- Find team trees/upgrades:
  - `rg -n "Team Trees|Upgrades To|Upgrades From|tier" docs/ai/ironfang-militia/militia-rules.md`
- Find exact quoted source wording:
  - `rg -n "exact phrase here" docs/ai/ironfang-militia/militia-verbatim.md`

### Retrieval Preference

1. Use `militia-tables.md` for hard numbers and thresholds.
2. Use `militia-rules.md` for process/order, action semantics, and edge cases.
3. Use `militia-verbatim.md` when exact wording is required.
4. Use `search-tags.md` when query terms are vague or abbreviated.
