# #299 Class Level presentation contract

This contract describes the shipped Class Level presentation and its persistence, calculations, controller hooks and form validation. Presentation was implemented by the UI agent; controller fixes retain that presentation. Match `prototype-approved/character-builder:src/components/character-builder-prototype/CONTRACT.md`, `variant-b/levels-table.tsx`, `variant-b/living-sheet.tsx` and `variant-b/shared.tsx`. Use the approved one-living-sheet layout, shadcn/ui controls, ruled headings, compact labels and inline blue missing-choice markers. Tablet landscape 1180×820 is primary; desktop 1440×900 and phone 390×844 must remain usable. Keep small screens scrollable without overlapping inputs, feedback or warnings.

## Existing files to extend

- `src/components/character-sheet/class-levels.tsx`: selected next class, append-and-scroll Level up, insertion controls, zero-level state, global save/remote notices.
- `src/components/character-sheet/class-level-row.tsx`: in-place class picker, plain HP, favored-class bonus, alternative note and ability increase; row movement/deletion; row-local warnings and save/remote notices.
- `src/components/character-sheet/character-sheet-view.tsx`: wire the controller, favored-class entitlement controls and Defenses/Offense statistics; show externally linked unplaced selections without retargeting them.
- `src/components/character-sheet/sheet-summary.tsx` and existing `stat-breakdown.tsx`: reuse approved number/breakdown interactions for appropriate summary and statistic figures.
- Add focused presentation helpers only where useful; keep rules and state out of these components.

## Provided interfaces

`useCharacterSheet(scope)` remains the sheet controller. Scope is the existing private/campaign route contract. `sheet` is undefined while loading, null when unavailable, otherwise ready. The view includes ordered `levels` (stable `_id` and `state`), `classChoices` (authorized character-scoped class catalog docs), `favoredClassIds`, `unplacedSelections`, `calculated` and accepted `warnings`. Existing `character`, `campaign`, `adjustments` and warning-controller interfaces remain available. The calculated row's `classEntryId` is null when Unspecified, including unavailable or legacy name-only definitions. Raw stored rows retain their references; the form normalizes an unavailable class to its empty editing baseline and writes a replacement only when the player chooses one. Class detail supplies `hitDie`, BAB/save progressions and representative source attribution. Do not display database IDs, revision or shared-state implementation details.

`controller.levels` provides:

- `add(classEntryId?: Id<'catalogEntry'> | null): Promise<void>` — append chosen class; omission/null makes an Unspecified Class Level. No HP defaults. Existing `appendedEntryId` supplies the originating device's scroll target after success; wait until that row renders, scroll/focus with existing reduced-motion behavior, then `acknowledgeAppend()`. Remote level-up never sets this target. The control copy is `Level N as [class] · Level up`; selected next class is local until the action saves.
- `insert(position: number): Promise<void>` — insert an Unspecified row at the one-based recorded position, preserving all existing rows and carrying their choices. It uses the same scroll target/acknowledgment mechanism. Class can be chosen in place after insertion.
- `move(entryId, position): Promise<void>` and `remove(entryId): Promise<void>` — existing stable-row editing. Any level may be removed, including the last. Later positions close up; externally linked choices remain unplaced. Preserve stable React keys; never key by position.
- `status` and `hasRemoteChange`/`dismissRemoteChange()` — section-local structural-action feedback. No duplicate action while saving.

For editable forms use the raw rejecting `controller.saveClassLevel(entryId, changes)` writer. It returns `Promise<null>`; wrap as `save: async changes => { await controller.saveClassLevel(row._id, changes); }`. `ClassLevelChanges` is exported by the controller and has optional `classEntryId`, `hpGained`, `favoredClassBonus`, `abilityIncrease`, `skillRanks`. Omitted fields preserve another player's latest edit; null clears nullable choices. Use `saveHitPoints(entryId,hp)` and existing `useClassLevelForm` for the plain HP field. No roll, average, max, automatic fill or wizard.

`useClassLevelChoicesForm({ classEntryId, classChoices, favoredClassBonus, abilityIncrease, save })` is exported from `use-sheet-forms.ts`. Mount/key one instance per stable row ID. It provides `{form,status,hasRemoteChange,save,dismissRemoteChange}` matching existing forms. RHF fields are `classEntryId` (empty means Unspecified), `favoredClassBonus` (`''|'hp'|'skill'|'alt'`), `favoredClassNote` (text, shown for alt), `abilityIncrease` (`''|'strength'|'dexterity'|'constitution'|'intelligence'|'wisdom'|'charisma'`). The form maps only changed fields to the documented row data. Rejected saves retain drafts; pristine fields follow remote edits, dirty fields retain drafts, and own echoes stay quiet. Use `noValidate`, the existing styled field errors and save feedback; do not use browser validation popups. Class-reference failure copy is `Choose an available class`. An Other bonus requires a nonempty note; its field error is `Describe the alternative favored class bonus`.

`saveFavoredClasses(ids: Id<'catalogEntry'>[])` is the raw rejecting entitlement writer. Temporary persistence is `base.state.favoredClassIds` until race selection exists; it has no implicit first-class default. The UI may choose from `sheet.classChoices` with the same form/error handling conventions. Class/ability/favored departures remain editable and produce advisory warnings. All class references remain server-authorized; disabling a control is not authorization.

## Calculation and warning data

`sheet.calculated.classLevels` supplies each `entryId`, `position`, `classEntryId`, `classLevel` (null for Unspecified), `hitDice`, `abilityIncreaseDue`, `skillRankBudget`, `skillRankCap`, cumulative ranks and exceeded rank caps. Use that metadata for class-level labels, ability missing markers and rank hints, without duplicating milestone rules. Ability choices remain editable on every row even when not due; unexpected timing warns. Class Levels are editable through 20 and beyond with advisory departures.

`sheet.calculated.derivedStatistics` supplies complete `bab`, `fortitude`, `reflex`, `will`, `initiative`, `cmb`, `ac`, `touchAc`, `flatFootedAc`, `cmd`, `flatFootedCmd` breakdown objects. Display totals with existing signed-number conventions; reuse number buttons/popovers. Each breakdown lists applied/suppressed/conditional sources and suppression reasons. Base class values are per-class floors, not fractional multiclass sums. `calculated.hp` stays null while any necessary HP input is missing. Preserve existing unresolved HP explanation.

`calculated.budgets` contains general feat count, racial/class skill-rank totals and HD rank cap; do not present these as completed skill/feat editors. Class features and full catalog breadth are later work. Representative choices are Fighter, Wizard, Rogue, Cleric, Sorcerer, Alchemist and Witch; newly initialized isolated demo/fixture sheets seed these schedules. Their source citations are Core Rulebook pp. 56, 80, 68, 40 and 70–73 respectively, and Advanced Player’s Guide pp. 26–27 and 65–67 for Alchemist and Witch. Older prepared sheets require isolated fixture recreation/reseed. Production remains on legacy authority.

Warnings include existing class/HP/point-buy rules plus `hpGainedAboveMaximum`, `firstLevelHpNotMaximum`, `favoredClassCount`, `favoredClassPrestige`, `abilityIncreaseMissing`, `abilityIncreaseMilestone`, `favoredClassBonusMissing`, `favoredClassBonusNotFavored`, `skillRankCap` and `classVersions`. Racial-HD skill calculations remain pure resolver inputs; this slice has no racial editor or persistence writer. Route by warning `target`, especially `{kind:'classLevel',entryId,field}`. Missing fields use the approved inline marker and field message; accepted rules warnings keep their acceptance controls. Acceptance reopens when relevant facts change and survives unrelated HP edits. Do not create a global missing-choice checklist. Copy for bonus choices: `+1 hp`, `+1 skill rank`, `Other…`; alternative note label `Alternative favored class bonus`. Ability option labels `+1 Strength`, etc. All choices may be cleared.

## States and accessibility

Retain existing loading skeleton, inaccessible/error handling, maintenance gate and owner/campaign context. Empty levels show the existing PC advisory warning and allow Level 1 to be added; unavailable class catalog leaves Unspecified usable. Display saving/saved/refused/unknown-result messages beside the action or field that caused them. Dirty drafts stay visible on failure. Mark another player's row edit beside that row and structural changes beside Class Levels, with dismiss controls. Do not erase unsaved local input when a row moves.

Prefer card-style class choices with hover lift, touch/keyboard selection and reduced-motion support. A compact accessible chooser is acceptable within the existing row footprint. Every field has a unique label containing current recorded level (for example `Class at level 2`, `Hit points gained at level 2`, `Favored class bonus at level 2`, `Ability increase at level 2`). Describe the hit die as a hint once. Number breakdown triggers have labels naming the statistic; popover/dialog focus returns to the trigger. Move/insert/delete controls must work from keyboard with current-position accessible names. Keep saving/remote notices perceivable through the existing live feedback patterns; touch targets remain usable on phone.

## Behavioral presentation tests to add

Test through role/label queries in existing character-sheet component tests:

1. Choose a class, record plain HP, favored bonus/alternative note and ability increase on a row; edits save in place without a wizard or HP fill.
2. Level up with a chosen next class; the empty-HP appended row appears and the originating device scrolls/focuses it once. A remote append renders without scrolling the other device.
3. Insert, move and change a class; row IDs/dirty drafts and row choices follow the same row. Delete a middle row; positions close, linked selections appear unplaced and never move to a successor. Delete the final row; Level 1 remains available.
4. Refuse a form save: localized failure, unchanged authoritative sheet and preserved draft; retry succeeds. Another player's pristine changes refresh and dirty drafts stay, with row-local remote acknowledgement.
5. Missing milestones/favored choices are marked inline; advisory departures save. Accepting a warning survives unrelated HP, and moving onto a milestone reopens/removes the applicable warning.
6. BAB/saves/Initiative/CMB/AC/CMD totals open accessible source breakdowns. Keyboard and touch interactions work at all three approved widths, with reduced motion respected.

## Maintenance reason and field errors

- The Class Levels block states the maintenance reason once, beside Level up, inside a `MaintenanceReasonScope`. Reasons rendered inside the scope stay quiet; each disabled save, warning action and deletion answer in the block is described by the one reason (`aria-describedby`). A rules warning outside a scope keeps its own reason, also in its action's description.
- An Other favored-class bonus with an empty or blank note shows the RHF `favoredClassNote` error with the styled `FormMessage` (`Describe the alternative favored class bonus`) at the note field, from Enter, from leaving the field and from Save choices; the draft is kept and nothing is written until a note is supplied.
- Warnings aimed at `{kind:'favoredClasses'}` (`favoredClassCount`, `favoredClassPrestige`) render under the favored-class cards; `hpGainedAboveMaximum` and `firstLevelHpNotMaximum` render at the row's HP field. A level whose class definition is gone reads Unspecified with its missing-class marker.
- Ability damage and drain rows are named with their points (`Strength damage, 3 points`).
