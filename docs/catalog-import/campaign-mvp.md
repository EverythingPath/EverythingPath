# Campaign MVP inventory contract

`campaign-mvp-v1` freezes the owner-approved 21 class variants through levels 1–20,
eight races, Exploiter Wizard and Magical Lineage. Original Monk and original
Summoner remain roots. The inventory does not select a Catalog Release, clear
notices, qualify a party, or authorize cutover. Its requirements are frozen; a
[verification projection](#verification-projection) reads one current build and
never admits content.

The committed [manifest](../../scripts/catalog/scopes/campaign-mvp-v1.json) and
[overview](campaign-mvp-inventory.md) are read through
`parseLaunchInventory` and `inspectLaunchInventory`. Core/shared C01–C32 and advanced
A1–X1 now have source contracts and ownership, alongside the companion partitions.
The public inspector computes inventory completeness separately from launch
qualification and the pending party supplement. Counts alone do not prove closure;
missing source contracts, outputs, conditions or owners still fail inspection.
Runtime implementation, admission, notices, fresh reviews and launch proof remain
outstanding. **#768 is not complete while inventory errors remain.**

## Verification projection

The inventory's observations stay frozen. Its builder never verifies a content
row, and a changed row would change `launchScopeIdentity`. Instead,
`verifyLaunchRows` (`scripts/catalog/launch-verification.ts`) reads one current
build. `inspectLaunchInventory(manifest, { verification })` then lets each
observation that build verifies override the frozen one. Holds and the
mechanism rules stay, and so does the refusal of any recorded prose but
Magical Lineage's. `release-scope.ts` projects its own scoped
build through the same function. `mvp:status` applies the committed projection,
[`campaign-mvp-v1.verification.json`](../../scripts/catalog/scopes/campaign-mvp-v1.verification.json),
produced by `pnpm -s catalog:launch-inventory --verify --write`; `--verify --check`
rebuilds it and compares bytes.

Only current, real evidence verifies:

- **Catalog rows**: `admission` needs the gate's `admitted` result from the
  full preview. A schedule increment also needs its parent's. `structure` also
  needs the scoped build to emit an entry that passes the release entry schema
  and the adapter's pure prepare, with every resource the row names verified.
  `contentEvidence` also needs no inventory hold. `noticeEvidence` also needs
  every `notice/` row the row names to be verified with no hold.
- **Resource rows**: the scoped build emits the resource from bytes equal to
  the row's bound source. `companion-progression-rules` has no release output,
  so it stays unverified.
- **Notice rows** keep their own readiness. **`rule/` and audit rows** have no
  gate result and stay unverified until a mechanism proof and fresh contract
  bindings exist.
- **Mechanisms**: an outstanding mechanism counts only when an entry of the
  mechanism proof registry (`scripts/catalog/launch-mechanism-proofs.ts`)
  proves it, or when it is [permitted prose by category](#permitted-prose-by-category).
  The entry must be current: it names at least one test, every test
  file exists with its recorded bytes, and its calculation identity is the
  current one. An entry without tests proves nothing, and the registry refuses
  it. The row must be admitted, have no `unsupported` issue the entry names,
  and, when the entry has a scope, have a scoped entry that records it.
  Permitted prose is never proven.
- **The spell class-list family** is the registry's first. Its proof is
  `convex/characterSheetSpellClassList.integration.test.ts`: Spells on five
  class lists, level 0 included, are browsed for each casting class at that
  class's list level, with that level's DC, through public saved-sheet reads
  and writes. Each is recorded in its spellbook, known, familiar or formula
  collection, or, for a whole-list caster, browsed read-only and never
  recorded (PRD #251 D10). Its scope is plain class-list membership on the
  proven (collection path, spell level) pairs: the scoped entry has class
  levels and no granted (domain, subdomain, bloodline or other non-class)
  levels; every class and level it lists is a proven pair, the path read from
  the app's reviewed casting for that class (`classListCollectionPath`). The
  pairs are levels 1 to 9 on every path, which share one browsing and
  recording path with a per-level DC, and level 0 on every path but formula,
  since extracts have no level 0. A class without a reviewed casting, an
  Alchemist or Investigator level 0, or a level outside 0 to 9 disqualifies
  the row; and
  the row has no `unsupported` issue on `levels`, `grantedLevels` or
  `learnedAt`. A Spell with granted levels keeps the mechanism outstanding,
  since its granted-spell rules are unproven.
- **The plain-Modifiers family** is the second. The inventory names one
  mechanism per source change, `Modifier <target> <formula>`, so the family
  proves a feat's or Racial Trait's Modifier mechanisms all together or not
  at all. Its proof is `convex/characterSheetModifiers.integration.test.ts`:
  imported feat, race and Racial Trait bodies pass through a Catalog Release
  and the app's candidate conversion, and public saved-sheet reads and
  writes show each output reaching its total. The proven (target, formula
  shape) pairs are:
  - a positive integer on `will`, `fort`, `ref` or `init` (untyped);
  - a positive integer on `allSavingThrows`, `skill.per`, `skill.int`,
    `skill.acr` or `skill.clm` (racial);
  - `@abilities.str.mod` on `skill.int` (untyped, a penalty included);
  - a positive integer on `bonusFeats` (feat slots, open or listing their
    only feats);
  - `@attributes.hd.total` on `bonusSkillRanks` (one rank per level).

  A change's formula is its one reviewed replacement where it has one (#726;
  Intimidating Prowess drops Foundry's floor at 0). A row counts only when
  every Modifier it carries is a proven pair, and its scoped entry, of the
  row's own kind, carries exactly the outputs those pairs import as, each
  once. The outputs are unconditional Modifiers of the pair's target, value
  and bonus type, feat slots without feat types, and bonus skill ranks. Any
  other Modifier, slot or rank on the entry disqualifies the row, as does an
  unproven target, shape or bonus type, or an `unsupported` issue on
  `changes` (a change that contributes nothing), any `curation` field, or a
  `racialTraitRule` that no longer matches. Descriptive notes are not
  Modifiers.

Held, failed, retained, omitted or unassessed results never count, and neither
does a legal `disposition` without a gate result. The projection's header binds
the scope identity, the calculation identity, the registry, the bytes of every
file the build can read and the package resolution it ran on. The files are
the builder's own runtime closure (`launch-verification-inputs.ts`, traced as
`test:affected` traces modules: every module it loads, every file a loaded
module names by a literal path, and type-only imports), with the importer's
dependency graph, the resources' sources and the registry's test files added.
The packages are the importer's parser dependencies, as releases bind them,
and every package the closure imports, each with its installed version and
`pnpm-lock.yaml` entries. When any of these changes, or a projected row names a
mechanism no current registry entry proves or prose no current reviewed case
records, `mvp:status` prints "Verification stale" with the reason and counts 0
rows from the projection.

## Permitted prose by category

The owner's decision of 2026-11-03 ("Yes, by category") makes the PRD's named
prose categories `permitted prose`. Each is identified from recorded evidence
only, never from a name, tag or description (`launch-prose-categories.ts`).
Three categories make an outstanding mechanism prose, and the projection may
name only these:

- **Identified mystery, patron and spirit cases** (Decision 10, #218/#233): a
  reviewed prose case.
- **Unparsed prerequisite clauses** (Decision 12): a reviewed prose case,
  while the scoped entry still records every clause of the row's one
  Prerequisites paragraph as unparsed. The parser's unparsed clause alone is no
  evidence. It also leaves clauses of kinds the PRD parses, such as "Caster
  level 5th" or a weapon proficiency, unparsed, and prose must not hide a
  missing modeled calculation.
- **The #229/#237 attack feats left as text**: a reviewed prose case.

**Archetype proficiency changes** (Decision 7) are issue-only: the archetype
mapper's `proficiencies` issue with its recorded prose reason names no
mechanism, so it only stops that issue from disqualifying a proof. It never
makes a mechanism prose, and a projection naming it is malformed.

A reviewed case (`launchProseCases`) names the row, the mechanism and the
source bytes it was reviewed against, with the decision that names it. A
changed source drops it. No case is reviewed yet, because no importer field
records these three categories. Prose satisfies only the mechanism condition:
admission, structure, content evidence and notices still apply, and holds stay.
The frozen inventory still records only [Magical Lineage](#magical-lineage)'s
metamagic as prose; the inspector refuses any other recorded prose disposition.

## Public boundary and deterministic identity

```ts
const manifest = parseLaunchInventory(JSON.parse(bytes));
const report = inspectLaunchInventory(manifest, { bindings: observedBindings });
const fingerprint = launchScopeIdentity(manifest);
```

Encoding `campaign-inventory-records-v3` shares ordinary JSON records across all
seven inventory artifacts in `campaign-mvp-v1.records.json`. Each artifact binds
the dictionary's SHA-256 and retains its own projection. `$record` indexes address
immutable dictionary entries; `$inventoryEdge` shares an edge's contract separately
from its endpoints. `$inventoryView` reproduces schema-normalized audit contracts,
accounting, checkpoints and audit rows, or projects graph vertices and edges.
Audit row generation uses the same pure function as the source builder. The encoder
only substitutes a view when its entire expanded value matches, including array
order; other records remain explicit. Unique source text, conditions and values
remain inspectable JSON. No source facts are inferred from counts.

`parseLaunchInventoryDocument` expands an audit or authority artifact;
`parseLaunchInventory` additionally validates the complete manifest. Plain expanded
manifests and v1/v2 table documents remain supported. Missing, malformed, changed
or cyclic references fail parsing. Decoded projections do not share mutable objects
with the dictionary or an independent authority. Resource, checkpoint and notice
expectations still come from separately committed authority projections, never a
submitted manifest. Removing submitted rows, edges and coverage cannot remove
those expectations.

The three historical audit-file byte commitments in notice authority inputs retain
their exact meaning: their original ASCII-escaped, indented JSON is reconstructed
from decoded records before hashing. Other source commitments remain literal file
hashes. Compaction preserves decoded values and the scope identity they define. The
[generated overview](campaign-mvp-inventory.md) carries the current regenerated
identity; source-fact and dependency-edge changes produce a new fingerprint.

### Reading and reproduction

`pnpm -s catalog:launch-inventory` validates and prints the concise status.
`pnpm -s catalog:launch-inventory --check` reproduces from the documented pinned
sources, verifies independent checkpoint and notice authorities, and checks all
eight compact artifacts and the overview without writing. `--write` regenerates
that same compact representation after source verification. Generation is
deterministic and needs no orchestration directory, old checkout, dump or service.

Complete outputs are available on demand; redirect them outside the checkout:

```sh
pnpm -s catalog:launch-inventory --expanded > "$TMPDIR/campaign-mvp-expanded.json"
pnpm -s catalog:launch-inventory --diagnostics > "$TMPDIR/campaign-mvp-diagnostics.json"
pnpm -s catalog:launch-inventory --report > "$TMPDIR/campaign-mvp-report.md"
```

The diagnostic JSON retains every finding, owner and incoming path. The full
Markdown renderer remains available unchanged. As before compaction, rendering
the stored canonical manifest can choose a different first witness and failure
ordering than rendering the source builder's insertion order; both retain the
complete witnesses in diagnostics. The committed report is now the overview;
routine checks do not rewrite expanded reports. Generated JSON uses one array
record per line rather than a general-purpose formatter.

Every row carries its inventory identity, catalog identity when allocated, kind,
required/optional disposition, source repository/pin/locator/raw and effective
hashes, original inventory owner, implementation owner, public-test owner,
mechanisms, evidence/admission/structure/notice observations, holds and research.
Every semantic edge preserves its reason, condition and evidence. The reporter
deduplicates record bodies while retaining a witness for every incoming edge from
each reachable root. Traversal terminates on cycles. Journal citations and
references to nonbaseline playable classes/races do not create new launch roots.
Explicit prerequisite paragraphs retain their full minima/alternatives and label
their catalog references as prerequisite edges, including Great Cleave → Cleave →
Power Attack. Core unlinked prerequisites and source-only selectors now have
source-bound semantic contracts, including the advanced families' conditional choices.

`launchScopeIdentity` hashes the canonical expanded generic contract. Object and
set ordering is deterministic. No observation timestamp or absolute workstation
path participates. Party inputs have a separate contract and do not change the
generic fingerprint. Changing roots, content, requirements, ownership or evidence
changes that fingerprint. #770 must bind it together with the actual resolved
release inputs/output, then enforce the existing admission and compatibility
gates. This fingerprint is not a calculator identity.

Static inspection validates root identities, source pins, frozen root hashes,
pool commitments, batches, ownership, graph accounting, printed checkpoints,
coverage and unallocated identities. Supplying independently observed bindings
also verifies per-row source freshness. The read-only `--check` author command
rebuilds from the pinned sources and requires byte equality. A hash stored next to
data is not independent evidence that the data is current.

The authority freezes every pool membership. `purpose` distinguishes exact
eligibility from retained source inventories and observed metadata. The four
companion partitions and core/shared and advanced pools have independent source contracts.
A caller cannot make a reduced
pool valid by recalculating its own checksum, or claim completeness by deleting
research warnings from the manifest. Completing those audits requires an explicit
source-backed revision of the authority and a newly reviewed fingerprint.

The [notice authority](../../scripts/catalog/scopes/campaign-mvp-v1.notices.json)
separately freezes notice identities, original provenance and all three owners,
incoming dependency reasons/conditions/evidence, coverage references and the
mechanical graph needed to recover root paths. It is reproduced from a fresh
pinned-input build and bound to the complete legal inventories and governing
audit inputs. Public inspection never derives required notices from the submitted
notice rows, edges or coverage: deleting all three still fails completeness with
the independently known owner and root path. Altered source bindings cannot be
approved by supplying matching observations. Changed generic source bindings or
mechanical scope invalidate the notice authority. Citation-only links do not
satisfy notice dependencies; conditional paths retain their source conditions,
and optional retained notices do not become universally required. Original
notice source selection, whole-body obligations and all legal/admission holds
remain unchanged. Neither reproducing authority nor passing inventory inspection
approves notice sufficiency.

## Core/shared semantic contracts

The [core audit](../../scripts/catalog/scopes/campaign-mvp-v1.core.json) binds all
32 finding dispositions into `semanticContracts`, `sourceAccounting`, coverage and
the existing row/edge/report boundary. It includes the 138 distinct missing APG
feat identities, Phantasm, all 99 domain/subdomain, 20 bloodline and 29 school
contracts, seven caster lists, racial/local/trait/favored-class choices and exact
equipment definitions. The original broad class and race inventories remain
individually accounted. Their retention does not make later options eligible or
require their admission when no independent required path reaches them.

Source-owned requirement identities, selector values and playable catalog keys are
different variants. The APG Underfoot feat uses existing `pf1-content/f3r6wtifa8bXlcJG`
and original owner #356, separately from the Halfling trait and BotB feat. Both
Aura source locators retain distinct Inquisitor/Cleric contexts and target existing
`pf1/7ZiUSYUV1zRqgkrf`, native **Aura of Repitition**, original owner #609. Their
level-8 Toil replacement, retained Artificer's Touch, powers-only Inquisitor access
and shared daily budget remain source-bound. No identity was allocated, source
name corrected or universal Aura save DC invented. Native
equipment aliases and parameter variants resolve to existing source bodies;
excluded goods and services retain individual policy dispositions. Promoting an
excluded output into a required path fails inspection until its policy conflict
is resolved. This does not allocate an item per native row.

Contracts retain recursive PCGen prerequisite trees, counts, negation, positional
operands, parameter matching, selection channels and isolated waivers. Spell access
distinguishes lists, additional known spells, books, domain casting and temporary
borrowing. Inquisitor domain powers do not grant spells; Exploiter first-level loans
do not import complete school/bloodline progressions. Replacements retain parent
slots and every specified replaced power. Numeric and saved-choice behavior stays
owned downstream work, requiring actual stored-candidate and public-sheet proof.

The builder verifies literal pinned bodies before output. PCGen comparison evidence
has file/line hashes and a null effective hash; compiled Exploiter/MOD-4704 bindings
remain unchanged. The frozen companion audit file is retained byte for byte; its
whole-file PCGen observations are projected into that same uncompiled comparison
representation. No curation binding, review receipt or source/notice hold is refreshed.
Printed/native spell levels, Natural Weapon names, Archery's extra Crossbow Mastery
and Undeath Sense remain explicit source holds. Five Hero Point spells retain their
optional subsystem gate, and the two Malediction identities remain distinct.

Inventory incorporation does not implement runtime calculations, qualify the
pending party supplement or grant whole-issue acceptance.

## Advanced source contracts

The [advanced artifact](../../scripts/catalog/scopes/campaign-mvp-v1.advanced.json)
binds all 477 printed choices, 1,090 spell-list memberships, 239 conditional bonus
spell grants, 16 cure/inflict grants, 799 governing paragraphs, 335 table rows and
434 semantic relationships. Original source inventories and independent incoming
paths remain separate from exact eligibility. Native reprint metadata cannot drop
a printed baseline choice. Oracle's fourteen missing choices, Bloodrager's 200-entry
list, Greater Brand, Philosopher's Stone and Arcane Weapon's Distance all retain
their original owners and source/body/notice obligations.

Qinggong has 78 source-bound selector identities under the existing Qinggong Power,
each distinct from its existing primitive target. Numeric minima, ki costs,
activation, duration, target restrictions and channel-only feat waivers survive.
Power Attack is a temporary feat effect; Deny Death/Ki Stand cost zero and allow
immediate activation. Diamond Body, Diamond Soul and Perfect Self have nullable,
source-unspecified costs; zero is a different value. Spell powers use Monk caster
level and Wisdom concentration/DC rules. This typed inventory contract does not
implement activation or adopt the Qinggong archetype/vows.

Slayer's restricted nested talents, feats, deeds and style tiers remain source-bound.
Seven shared CRB/APG styles are distinguished from the separately sourced ACG
Thrown Weapon extension and its eight tier members. The extension's eligibility
discrepancy against the printed Slayer selector remains held. Exploiter has exactly 24 ordinary exploits, with five
Blade Adept-only options and greater/White Mage alternatives retained as remainders.
Limited school/bloodline loans, spell blending, Greater Spell Access, reservoir
formulas and receiving-class integration retain their specific downstream owners.

Water/Wisdom patrons, Vermin Shape, native wording/formula differences and duplicate
Shattering Punch identities retain explicit discrepancies before reliance. Witch
familiar replacement retains the saved Witch-owned spell collection under the
established app decision, including ordinary learned and favored-class bonus spells. W3, the class-side interface, the replacement paragraph and the core favored-class grant bind that decision to `docs/character-sheet/companions.md` and #251 §15. Printed replacement starting allowances remain explicitly nonoperative comparison evidence; they never reset, split or reduce the saved collection.
All shared familiar, mount, bond and original-eidolon incoming contracts survive.

## Sources, coverage and original ownership

The [authority file](../../scripts/catalog/scopes/campaign-mvp-v1.authority.json)
preserves the 30 keyed seed roots, all 14 original three-key class partitions,
original source-batch inventories and the 23 acceptance-appendix cases. Batch
source bodies and their hashes come from the frozen issue snapshots, not a new
issue discovery or invented batch. Required, optional and remainder keys partition
each original batch. The original 100-candidate/three-class limits remain intact.
The #702 source-owner selector inventory is preserved separately, with Exploiter
required and other Wizard archetypes retained as remainder.

The builder reads the pinned Foundry `418761d2`, pf1-content `02f4ab0d`, PCGen
`25523dbc` and verified `prd-2026-10-20` capture. It does not fetch, modify the
sources, or change the historical `prd-2026-10-18` Section 15 evidence identity.
All 420 checkpoints carry the printed table's Special column, available named
columns, and every indexed source cell (including grouped casting columns),
separately from reviewed schedule rows, and every class schedule is reviewed.
Landed P7a–e, #772 (Inquisitor/Magus) and #771 (Cleric/Sorcerer,
Oracle/Witch) schedules remain authoritative, including Tireless Rage at 17.

Class-associated inventories, named printed definitions, baseline spell lists,
racial folders, baseline feats/gear/Item Abilities and companion/eidolon source
packs have explicit pool commitments. These are research inputs. Tagged
associations, whole-pack inventories and name matches do not establish that every
source-only option, prerequisite, conditional grant and governing body is in its
final semantic partition. The independent audit artifacts bind those partitions;
the inventory is an input to #770, never an approved release set.

The [companion source audit](../../scripts/catalog/scopes/campaign-mvp-v1.companions.json)
accounts for all 538 original keys across the four companion partitions. It binds
each inclusion or remainder decision to pinned native bodies and governing
PRD/PCGen locators and hashes. The authority binds the audit independently of
editable manifest flags or pool checksums. `--write` and `--check` reread every
audited body; the public inspector rejects omitted semantic edges, mechanics,
owners, source bindings, discrepancies and remainders.

Animal choices retain the 17 CRB stat profiles, the separate native Velociraptor
alias and Ranger's conditional dire rat. Named mount restrictions and effective
levels remain class-specific. Familiars distinguish 16 native normal CRB/APG
candidates, 12 conditional CRB Improved Familiar candidates and the source-only
APG young-octopus recipe. APG Fox's young-dog recipe remains distinct from the
later native Fox statistics. The original eidolon has six forms (including Small
variants), 49 paid evolutions, 16 progression resources and 11 natural-attack
resources. The explicitly Unchained pool, later forms and later evolutions remain
outside this original-Summoner pool. All 22 companion features are retained; six
creature types have companion dependencies. Other types stay in the original
remainder and may still be required through a separately evidenced generic path.
The later Druid-domain Dwarf Caiman grant remains optional because it is outside
the printed Druid domain choices. Its exact species, advancement and notice edges
remain available when selected. Witch Verdant Familiar retains its independent
incoming path. Neither expands normal CRB/APG choices. Familiar advancement and flexible
species selection are separate resources, so a fixed-species grant does not
silently open every species choice.

Source-only rows preserve unlinked selectors, stat aliases, master-level benefits,
template choices, homunculus construction, mephit varieties and other creature
abilities with implementation and public-test ownership. These rows are not
invented selectable catalog identities. The raw Small/form/Unchained, Fox,
Scorpion and Tremorsense discrepancies remain explicit holds. #763 owns lost
creature-stat inputs; #733/#707 own promised companion mechanics and public proof;
#731 retains size modifiers and #736/#737 retain source/notice clearance. Later
Extra Evolution remains #733 work when selected; this inventory does not expand
the CRB/APG feat baseline to every later feat.

The companion contracts from `768-advanced-audit/cross-worker-contracts.json`
are integrated as source evidence. Companion coverage rows preserve the actual
downstream owners: Cavalier #763/#707; Oracle and Witch #771/#763/#707; Magus
#772/#763/#707; Exploiter familiar alternatives #771/#716/#763/#707; original
Summoner's class interface #733/#716/#707; Ki Mount #589/#707. Oracle does not
inherit Cavalier's Share Spells or replacement exceptions. Witch spell storage
stays on the master under the existing collection-preservation decision.
Exploiter Familiar and Bloodline Development do not stack. Original Summoner
class-side alignment/languages, distance/HP, shared slots, Shield Ally, Aspect,
Greater Aspect and Twin Eidolon remain independent required implementation.
Ki Mount grants benefits to an existing mount and never grants a species or
progression. Runtime class/option/spell implementation remains downstream work;
source enumeration is not review or admission.

The nine core companion/Leadership incoming contracts are also retained, with
their original class/feature paths and downstream owners. Serpentine Sorcerer's
Serpentfriend grants a fixed Viper at Sorcerer 3 with effective Wizard level
Sorcerer−2 and reptilian-only Speak with Animals. Druid's ordinary companion
branch uses full level; its Animal-domain branch and Ranger use level−3.
Paladin's mount and Arcane familiar stacking remain separate source contracts.
Nobility at 8 has an actual Leadership bonus-feat dependency and a conditional
+2 score mechanic under #771/#733/#707. Leadership internals and the broader
cohort implementation remain separately owned follow-up. The reconciled shared
domain and limited Exploiter interfaces preserve their receiving conditions;
the parent still owns fresh exact-candidate reviews, full gates and acceptance.

The Item Abilities pool also enumerates every original scoped CRB/APG PCGen
equipment property, including enhancement amounts, equipment eligibility and
energy/resistance tiers. Original definitions bind later reprint candidates for
properties such as Flaming, Keen, Speed and Bashing; filtering only the current
candidate's source-book metadata would omit these core choices. Energy/tier and
armor aliases are explicit. This comparison does not clear the later reprint's
body or notice obligations, and #764 still owns actual calculation/import proof.

The coverage rows map all 19 #251 sections, all 23 appendix cases, and #731–#737
to owners and mechanisms. Existing implementation/test files are reuse evidence,
not fresh campaign qualification. Full #251/#716/#328/#382 and original class and
feature batch remainders remain open. #310's original release implementation is
preserved; #770 owns its additional scope selector. #732 operating bounds remain
unmeasured. Nonbaseline cohorts, Synthesist/brood and later subtype work remain
the broader PRD scope unless an actual required dependency reaches them.

## Exploiter and racial requirements

The owner and its two direct features are frozen through the existing owner-first
ledger assignment/proposal workflow. Only those three unambiguous identities are
added. The effective owner hash includes PCGen ACG `:4704`, alongside the owner at
`:4052` and feature bodies at `:4057–4058`.

Exploiter replaces bond at 1 and school with exploit picks at 1/5/9/13/17. It retains
Wizard casting and uses Wizard level for exploit effects/DCs. The ordinary ACG
exploit inventory is source-keyed, including the published `(ARC)` aliases for
Familiar, Quick Study and Spell Resistance. The greater-exploit definitions remain
an enumerated remainder: the archetype does not grant the separate Greater
Exploits feature. #771's source output is the reviewed record in
`scripts/catalog/pcgen/archetype-additions.ts`: the reservoir's maximum and daily
points, the exploit picks at 1/5/9/13/17, the exploit DC, the 24-member pool with
its 22 named exclusions, and PCGen's formula/DC discrepancies as review items it
never adopts. The mapper's two additions stay single rows at 1. Temporary pool
tracking remains outside MVP. Admission, the arcane school casting review, the
sheet's pick slots and values and the public saved-sheet proof remain #702's; no
Arcanist class progression is imported as a replacement.

Tiefling's Darkness edge states its once-per-day spell-like ability and caster
level condition. Fiendish Sorcery retains its Sorcerer/Abyssal-or-Infernal
condition and promised effective Charisma adjustment. Trait relocation/local
generated identities and contribution deduplication remain #740 work, extended
to Tiefling. PZO9280 is retained as a required notice, alongside actual governing
and transitive notice obligations, including Unchained action metadata.

## Magical Lineage

The trait requires one saved spell and a visible benefit, with unset choice
feedback and preservation through edits/shared sessions/publication. #769 owns
that public UI proof and the stale choice-recording assessment correction. Manual
metamagic arithmetic is the only prose the inventory records: the player
applies the one-level adjustment, without changing base spell level, DCs or
slots. It stays alongside the [prose categories](#permitted-prose-by-category)
(owner decision 2026-11-03), which only the verification projection
identifies.
All existing whole-body, PZO1125/PZO1115/PZO9401, governing CRB and actual transitive
notice holds remain. The inventory never clears #382's held curation.

## Pending party supplement

The pending contract requests the actual party's current and next levels,
classes, bloodlines, exploits/talents/other choices, spells, feats, gear and
companions. It contains no invented Character or sample build. A recorded
supplement needs a current/next pair for every Character, structurally consistent
class levels, source-keyed choices and public saved-sheet/two-session
qualification. `inspectPartySupplement` never infers that evidence from generic
coverage. Pending party data does not block generic inventory or infrastructure;
remaining generic research does block a claim of generic completeness.

## Preservation and author commands

The nine inherited rationale decisions for Windstep Master, Storm Caller,
Invested Regent, Brazen Disciple, Black Asp, Sage Counselor, Consigliere, Phantom
Thief and Leshy Caller remain unchanged. They are optional archetypes outside the
fixed roots. A required path reaching one must report its exact keys, owner and
before-reliance source-backed rationale correction/fresh authentic review. The
old checked status, historical receipt, exact legacy allowlist and #766 disposable
fixture approval authorize no renewed admission. No fixture receipt is reused.

Run heavy commands serially with the shared `EP_ORCH/capped.sh`, one Vitest worker
and unchanged 400%/memory/heap/timeout limits. Keep TMPDIR outside checkouts.

```sh
"$EP_ORCH/capped.sh" pnpm exec tsx scripts/catalog-launch-inventory.ts --write
"$EP_ORCH/capped.sh" pnpm exec tsx scripts/catalog-launch-inventory.ts --check
"$EP_ORCH/capped.sh" pnpm -s test tests/catalog/launch-inventory.test.ts
```

`--write` writes only this inventory/report. A successful write/check means
reproduction, not completeness. Running without a mode reports status and exits
nonzero while generic inventory is incomplete. The parent owns fresh Astra High
reviews, explicit real-root record-review verification, the full checked landing
gate and landing. No source promotion, importer repair, Cloud operation, push or
PR belongs to this inventory command.

Required governing resources have an independent nine-resource inventory with exact whole-file bindings, ownership and incoming paths from all 31 roots. Removing a resource and every incident edge still fails inspection. Resource references in affected coverage rows are checked separately; raw citations remain citations.

All 420 checkpoints are independently bound by `campaign-mvp-v1.checkpoints.json`, reproduced directly from the pinned PRD tables and applicable reviewed schedules. Inspection checks the complete printed and grouped column values, source binding and hash domains, class/level, schedule status, exact applicable keys and their required rows, plus the receiving class's printed source. Caller-supplied observed bindings cannot authorize a changed checkpoint. `catalog:launch-inventory --check` reproduces this authority before rebuilding the inventory. Tireless Rage remains reviewed at 17; no class schedule remains outstanding.
