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
  recorded (PRD #251 D10). Its fixture, `tests/spell-class-list-proof.ts`, is
  bound by bytes beside the test. It takes every class with a reviewed
  casting (28) to the class level where it first casts its highest spell
  level, and the test browses, records and counts one Spell at each level
  that class casts, with that level's DC. Its scope is plain class-list membership on the
  proven (collection path, spell level) pairs: the scoped entry has class
  levels and no granted (domain, subdomain, bloodline or other non-class)
  levels; every class and level it lists is a proven pair, the path read from
  the app's reviewed casting for that class (`classListCollectionPath`). The
  pairs are levels 0 to 9 on the book, known, familiar and whole-list paths,
  and 1 to 6 on the formula path, since extracts have no level 0 and stop at
  6th. A class without a reviewed casting, an Alchemist or Investigator
  level 0 or 7 or more, or a level outside 0 to 9 disqualifies the row; and
  the row has no `unsupported` issue on `levels`, `grantedLevels` or
  `learnedAt`. A Spell with granted levels keeps the mechanism outstanding,
  since its granted-spell rules are unproven.

  **The coverage tie** (`tests/catalog/launch-spell-class-list.test.ts`)
  fails when the scope certifies a (path, level) pair, or a reviewed class at
  a level of its path that its table casts by 20th level, that the fixture
  doesn't exercise. Its negative cases widen the formula path, drop the Bard
  and drop the Witch's 9th level. The spell granted-levels family binds its
  fixture (`tests/spell-granted-levels-proof.ts`) the same way, and
  `tests/catalog/launch-granted-levels.test.ts` ties each route and level its
  scope names to one the fixture grants.

- **The plain-Modifiers family** is the second. The inventory names one
  mechanism per source change, `Modifier <target> <formula>`, so the family
  proves a feat's, trait's or Racial Trait's Modifier mechanisms all
  together or not at all. Its proof is
  `convex/characterSheetModifiers.integration.test.ts`: imported feat,
  trait, race and Racial Trait bodies pass through a Catalog Release and the
  app's candidate conversion, and public saved-sheet reads and writes show
  each output reaching its total. The proven (target, formula shape) pairs
  are:
  - a positive integer on `will`, `fort`, `ref` or `init` (untyped or
    trait);
  - a positive integer on `ac` (dodge, #780): it adds to AC, touch AC and
    CMD, never to flat-footed AC, and goes when the feat is switched off;
  - a positive integer on `allSavingThrows` (racial);
  - a positive integer on any of 30 skills (racial, trait or untyped;
    pairs-ext): `acr`, `apr`, `blf`, `clm`, `dev`, `dip`, `dis`, `esc`,
    `han`, `hea`, `int`, `kar`, `kdu`, `ken`, `kge`, `khi`, `klo`, `kna`,
    `kno`, `kpl`, `kre`, `per`, `rid`, `sen`, `slt`, `spl`, `ste`, `sur`,
    `swm` and `umd`. One test gives every listed skill a value of its own in
    each type, from a Racial Trait, a trait and a feat, so a Modifier that
    reaches another skill's total shows; the three types stack;
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

  Trait bonuses don't stack with each other (PF1): with two traits on
  initiative, the higher applies, the lower is suppressed, and the lower
  applies once the higher is switched off. A trait bonus on a save or
  initiative stacks with racial and untyped ones. A trait's class-skill
  clause ("X is always a class skill for you") is delivered, not only
  assessed: the importer maps it onto the trait's `detail.classSkills`, a
  choice trait's two options come from the reviewed choice list
  (`classSkillChoice`), and the sheet adds the class-skill +3 once
  (`convex/characterSheetModifiers.integration.test.ts`, the trait
  class-skill case). The detail field says nothing about the trait's
  changes, so it doesn't refuse the Modifier
  (`tests/catalog/launch-modifiers.test.ts`); the whole-content assessment
  checks it against the row's PCGen `CSKILL` or `CHOOSE`.
  `tests/catalog/launch-modifiers.test.ts` covers each refusal of an
  extended pair: a wrong target, a bonus type outside the pair's (competence,
  profane), a penalty, a hit-dice formula and a wrong value.

- **The class-feature level-grant family** (#775) proves "Feature/option
  grants and conditions" for a plain level grant: a class feature whose
  printed text makes no saved choice and grants nothing beyond its schedule
  increments. Its proof is
  `convex/characterSheetFeatureGrants.integration.test.ts`. Imported-shaped
  class, feature, increment and Archetype bodies pass through a Catalog
  Release and the app's candidate conversion. Public saved-sheet reads and
  writes then show the following:
  - the feature and its increments are Grants of the class that lists them,
    at exactly their class levels, and never through another class;
  - a Grant's state (off, notes, choice) survives reload and another member's
    read, survives dormancy when the level is lost, and returns with the same
    Grant Key;
  - an Archetype replacing the feature whole replaces its increments, and a
    part replacement replaces only that level;
  - a parent at 1st with an increment at every later level is a Grant at
    each class level to 20th, and a second class listing the parent grants
    it as its own;
  - an outsider is refused.

  Its bodies are `tests/feature-grants-proof.ts`, bound by bytes beside the
  test. A coverage tie (`tests/catalog/launch-feature-grants.test.ts`) fails
  when a listed row is granted, by its reviewed schedules, at a class level
  the bodies don't reach, when a row several classes list has no such body,
  or when whole or part replacement is missing.

  A second proof,
  `convex/characterSheetFeatureGrantsSituational.integration.test.ts`, covers
  parents with curated Situational Modifiers (#775 slice 1b). They are
  formulas on `@classLevel.<tag>`, and it runs them on released classes with
  their real tags and `featuresByLevel`:
  - each Modifier stays out of every total and line, is listed in
    `conditional` with its Situation, and applies only in it. Bravery adds
    +1 at Fighter 2, +2 at 6 and +5 at 18 against fear, and its increments
    add nothing of their own;
  - Trap Sense on a Rogue 3 / Barbarian 3 adds +2 on Reflex and dodge AC
    against traps. The dodge bonus reaches touch AC and CMD, never
    flat-footed AC. The two classes' Grants share one Source, so the bonus
    applies once;
  - Poison Resistance takes the higher of Alchemist and Investigator levels,
    not their sum, and stays at +6 from Alchemist 8 to 20;
  - Studied Target adds +1 at Slayer 1 and +2 at 5 against the studied
    target, on every skill it lists and on melee and ranged attack and
    damage lines;
  - the contribution is gone while the Grant is dormant (its Class Level
    deleted) or replaced by an Archetype;
  - an outsider is refused.

  A third proof, `convex/characterSheetClassLevelSlots.integration.test.ts`,
  covers class-level slot parents (#783 slice 3a), whose saved choice is the
  feat Selection in each row's bonus feat slot. It is the class-level slots
  family's proof as well (below).

  Every admitted parent's imported entry has the same empty detail, so no data
  rule tells a plain grant from a chosen option. The scope is therefore a
  reviewed list, `reviewedLevelGrants`, with each row's pinned source sentence
  beside it. A listed row counts only when all of the following hold
  (`featureGrantProven`):
  - its entry has an empty `classFeature` detail and no prerequisites or
    proficiencies;
  - its entry has no slots, unless its record reviews its schedule slot
    (`scheduleSlot`). Then its slots must be exactly the row's reviewed
    schedule slot (`pcgen/schedule-slots.ts`), and the class-level slots
    family must prove the row;
  - its entry has no Modifiers, unless its record reviews Situational ones
    (`situational`). Then the record binds the row's source bytes, and the
    entry's Modifiers must equal the reviewed ones exactly, in order: target,
    bonus type, formula and Situation. A record can't review an unconditional
    Modifier or a Routine Option, so any such Modifier refuses the row. A
    descriptive note is not a Modifier;
  - a required class's scoped entry lists it in `featuresByLevel` (the class
    need not be admitted);
  - every required increment whose `requirement` edge names it is admitted;
  - it has no outgoing `requirement` edge;
  - it has no `unsupported` issue on `changes` or any `curation` field. The
    one exception is a `scheduleSlot` row's raw `bonusFeats` change, which
    the class-level slots family takes when it proves the row; any other
    `changes` issue still refuses it.

  No unscoped registry entry proves a class feature. Without the list, these
  structural checks would also pass twelve unlisted rows, among them Rage
  Powers and Rogue Talents. `tests/catalog/launch-feature-grants.test.ts` pins
  that, and its committed-inventory control proves exactly the listed rows:
  slice 1's 12, slice 1b's four and slice 3a's two. The same file shows that
  a differing
  Situation output, a changed source, an unlisted parent with curated
  Modifiers or an unconditional Modifier refuses the row. The Situational
  proof checks that its features carry exactly the listed rows' reviewed
  outputs.
  Each listed row records the numbers its body promises (dice, bonuses, DR,
  pool sizes) in `bodyNumbersNotNamedAsMechanism`. The owner decided on
  2026-11-08 (#775 O1) that a row whose number no inventory mechanism names
  may count as met, so all 18 reviewed rows are listed. For most of them the
  number stays calculated work (`unmodelledNumber`). Bravery, Trap Sense and
  Poison Resistance compute theirs through their Situational Modifiers,
  Slayer's Advance promises none, and the two slot parents' count is their
  `bonusFeats` change, which the class-level slots family proves.

  These shapes stay outside the family:
  - chosen options (pool, tree or typed-value picks), which need a
    `picksByLevel` prompt on the parent;
  - conditional grants (Bloodline Spells, Channel Energy);
  - class-level formula rows other than the slot parents (below);
  - content-linked features (Flurry of Blows, Wild Shape, Bomb, Summon
    Monster, Judgment);
  - Slow Fall, which is both a grant and a ki power pick;
  - option members and eidolon evolutions.

  **The rank-scaled Modifiers family** (`rank-modifiers`, #777) proves the
  feat rank thresholds plain-Modifiers refuses. Foundry writes them as
  `ifelse(gte(@skills.<s>.rank,N),H,L)` (Skill Focus) or
  `L + if(gte(@skills.<s>.rank, N), H − L)` (the Core Rulebook skill-pair
  feats). The formula grammar has no `ifelse`, `if` or `gte`, so the importer
  keeps each as an `unsupported` `changes` issue with its generic reason
  ("Unmapped target, bonus type, formula or calculation-stage dependency;
  contributes nothing."). #724's reviewed output stands in for it: one
  untyped Modifier `L + (H − L) * min(1, floor(@skillRanks.<s> / N))` on the
  skill (see [Skill Focus rank formula](curation.md#skill-focus-rank-formula)).
  Its proof is `convex/characterSheetRankModifiers.integration.test.ts`. For
  each of 27 listed skills, a Skill-Focus-shaped feat gives +3 at 0 and 9
  recorded ranks and +6 at 10 and 20, and a skill-pair feat gives +2 or +4,
  each skill independently. Craft reads `skill.crf`'s ranks. Two copies of a
  feat don't stack, two different feats stack as untyped, and switching a
  feat off removes its contribution. The pairs are those 27 skills, each at
  the thresholds 3/6 and 2/4 at 10 ranks. A feat counts only when:
  - every Modifier mechanism is a listed skill's threshold, read from that
    skill (Craft from its first sub-skill, `subSkills.crf1`), at a proven
    threshold;
  - its entry carries exactly the reviewed output for each, with the raw
    change's bonus type, and nothing else;
  - its `changes` issues are exactly those raw changes, once each, with the
    generic reason and no `operator`, so the raw change adds nothing and the
    reviewed output adds the bonus once;
  - each `curation` issue is one of the family's 4 reviewed diagnostics, the
    Skill Focus repeatability notes on Knowledge (Dungeoneering), Ride,
    Stealth and Swim. Each is recorded with its key, field, exact reason and
    basis: it concerns choosing the feat again, not its Modifier.

  Slice 2 (feat wave FW1, #777 O1) gives the 10 Core Rulebook skill-pair
  feats (Acrobatic to Stealthy) their reviewed outputs, `2 + 2 * min(1,
floor(@skillRanks.<s> / 10))` on each skill (see [Skill-pair rank
  formula](curation.md#skill-pair-rank-formula-777-slice-2)). Self-Sufficient's
  raw changes read `.ranks`, so Foundry gives a flat +2; reviewed change
  replacements import the same formula instead (root decision R5(a)). The
  family accepts that third form: a change whose effective formula is already
  the reviewed Modifier's, carried by the entry once, with no `changes` issue.

  The test's fixture, `tests/rank-modifiers-proof.ts`, is bound by bytes
  beside it, and a coverage tie in `tests/catalog/launch-rank-modifiers.test.ts`
  fails when a pair certifies a skill, threshold or bonus type the fixture
  doesn't release. That file also covers each refusal. Its
  committed-inventory control proves exactly the 14 required Skill Focus rows
  (10 without the reviewed diagnostics) and the 10 skill-pair feats, and
  plain-Modifiers proves none of them. The family leaves out rows mixing a
  rank change with another Modifier, other rank shapes and targets (Total
  Defense, Fighting Defensively, Heightened Awareness) and Racial Traits.

- **The feat Source-prerequisites family** (#776,
  `scripts/catalog/launch-source-prerequisites.ts`) proves the inventory's
  `Source prerequisites` mechanism, one per source Prerequisites paragraph.
  Its proof is `convex/characterSheetSourcePrerequisites.integration.test.ts`:
  imported feat and class bodies pass through a Catalog Release, and public
  saved-sheet reads and writes show the following.
  - The released `prerequisites` and `prerequisiteText` arrive unchanged.
  - Ability, BAB, feat and skill-rank clauses are checked now and at the
    recorded level (`gainedAtClassLevel`, `choiceOrder`), each minimum
    inclusive. Each ability and skill a listed record names is checked
    against its own score or ranks: Strength, Dexterity, Intelligence and
    Wisdom; Ride, Intimidate and Spellcraft.
  - A caster-level clause (#780) reads the sheet's highest caster level: met
    at its threshold, unmet below it, unmet for a Character who casts
    nothing, checked at the recorded level too, and re-checked as the caster
    level changes (another level, a level moved to a class that casts
    nothing), an accepted warning reopening.
  - A feat clause needs only possession, and removing or switching off the
    named feat fails it.
  - Every check advises: an accepted warning survives an unrelated edit and
    another member's read, and reopens when its fact changes.

  **The list rule.** Only a row on the family's reviewed list counts. Each
  record binds the row's source bytes and the exact clauses the importer
  gives it, so a misparse that keeps plausible kinds (#739) drops the row
  until it is reviewed again. Its `basis` quotes the paragraph and the
  benefit sentence showing that the body adds no eligibility condition. A row
  then counts only when:
  - it is a feat with one Prerequisites paragraph;
  - its scoped feat entry's clauses equal the reviewed ones, each an ability,
    BAB, caster-level, skill-rank or feat atom, the feat with no chosen
    option (a caster-level clause left `unchecked`, or another threshold,
    refuses the row);
  - its `prerequisiteText` is the paragraph read as text;
  - every feat it names is gate-admitted;
  - it has no `prerequisites` issue (`gameContent` and `curation` say nothing
    about prerequisites).

  Any other registry entry naming `Source prerequisites`, scoped or not,
  proves nothing (`sourcePrerequisitesGate`). `tests/catalog/launch-source-prerequisites.test.ts`
  tests each refusal. The public test's fixture,
  `tests/source-prerequisites-proof.ts`, is bound by bytes beside it, and the
  same file's coverage tie fails when the scope's clause kinds, or an ability
  or skill a listed record names, aren't ones the fixture releases. Its committed control re-imports the listed rows and
  checks that exactly they are proven among the inventory's rows that carry
  the mechanism. The list holds 52 feats: the first 19 (#776); from #780,
  the seven item-creation feats (Brew Potion, Craft Magic Arms and Armor,
  Craft Staff, Craft Wand, Craft Wondrous Item, Forge Ring and Scribe Scroll,
  each one caster-level clause) and Dodge (Dex 13; its `Modifier ac 1` is the
  plain-Modifiers `ac` pair); and the 25 feats feat wave FW1 admits in
  #330–#332 (their batch reports list them, with the wave's held and excluded
  keys). Left out, with owners:
  - 5 feats whose clauses the importer leaves unchecked: Extra Ki, Alignment
    Channel, Improved Critical, Weapon Focus and Rapid Reload (#739);
  - the hand-written attack feats whose automation is keyed to the
    hand-written identity: Two-Weapon Fighting, Improved and Greater
    Two-Weapon Fighting, Power Attack, Vital Strike, Lunge and Medusa's
    Wrath (#719/#720), and those feat wave FW1 holds out on the same ground
    (Double Slice, Two-Weapon Rend, Precise Shot, Quick Draw, Rapid Shot,
    Manyshot, Improved Vital Strike, and Furious Focus, which changes Power
    Attack's penalty) until owner-q-prereq-bodies O1;
  - Combat Expertise: a core flurry uses the flurry base attack bonus for it
    (FAQ o72, #414, [attacks](../character-sheet/attacks.md)), and only for
    the hand-written `combat-expertise` identity, so the imported row misses
    that calculation (#719/#720);
  - Spell Mastery (Wizard isn't admitted, #767);
  - Greater Spell Focus (a same-school clause, #739);
  - race, class-feature, proficiency, class-level and `anyOf` clauses, and
    Racial Traits and class features that carry the mechanism.

  **Caster-level parsing (#780).** The importer reads "caster level Nth"
  (any capitalization, any ordinal) as a typed `casterLevel` clause, alone,
  in a list, or as one alternative of a class level ("caster level 7th or
  monk level 7th"). A caster level of one casting kind ("arcane caster level
  5th"), of a spell-like ability, or inside a segment kept whole ("Ability
  to…") stays `unchecked` (`tests/catalog/prerequisites-739.test.ts`). The
  change moved only those clauses, in 75 entries' `prerequisites`, and
  re-bound the 119 assessments whose content closure covers them, as
  [curation](curation.md#protected-and-governing-records) requires; each
  batch inventory's copy of a moved parse keeps its earlier value in
  `prerequisiteParse780`.

  No feat the sheet calculates by its hand-written rule identity (the Routine
  Options and the feats the attack lines read by identity) joins the list
  until #719/#720 binds the imported identity. The control's refusal test
  names that set and checks that none of its rows is listed or proven.

- **The Source-body family** (#778, `scripts/catalog/launch-source-body.ts`)
  proves the inventory's `Source body mechanics`, which a row gets only when
  it has no other mechanism: no source change, no Prerequisites paragraph and
  no class association. Its contract is the whole source body, so any
  Modifier the entry carries comes from curation. Its proof is
  `convex/characterSheetSourceBody.integration.test.ts`: imported Racial
  Trait, feat, trait, race, class and weapon bodies pass through a Catalog
  Release, and public saved-sheet reads and writes show the following.
  - Situational Modifiers on saves, AC (dodge), CMD, Appraise, Perception,
    Spellcraft, caster level, concentration, attack and ranged attack and
    damage enter no total and are listed in `conditional` with their
    Situation, on routine lines too. body-ext adds CMB, each save
    (`save.fort`, `save.ref`, `save.will`), ten skills (Bluff, Craft,
    Disable Device, Diplomacy, Escape Artist, Knowledge (planes),
    Profession, Sense Motive, Sleight of Hand, Survival) and spell DC.
    body-ext-2 adds damage, which reaches every routine line's damage, and
    melee damage, which reaches melee lines only, each with notes. The
    bonuses are racial, dodge, untyped, trait and, since body-ext-2,
    circumstance or competence.
  - A released Wizard's Spellcasting carries the casting targets on the
    statistics a caster uses: a spell DC Modifier reaches every real slot DC
    (10 + spell level + Intelligence modifier) only in its own Situation, and
    leaves it when its trait is inactive; caster level and concentration
    reach the Spellcasting's own, each only in its Situation. A competence
    concentration bonus reaches the Spellcasting's own concentration too,
    with its marked increments.
  - The read's own Situations, shared and local, apply them: a dodge bonus
    reaches AC, touch AC and CMD but not flat-footed AC; a CMB bonus never
    reaches CMD; a save target raises its own save only; one entry's
    Situations never stack with each other, while separate Racial Traits do;
    trait bonuses from two traits take the higher, and a trait bonus stacks
    with a racial one; circumstance bonuses from different sources stack,
    competence bonuses from different sources take the higher, and a
    competence Modifier marked `stacksWithinEntry` adds to its entry's own
    bonus; caster level rises only against spell resistance.
  - A trait chosen as a Selection delivers its outputs, and they leave the
    sheet when it is made inactive.
  - Untargeted notes reach the entry's notes, and a targeted note its
    statistic.
  - `countsAsRaces` meets a race prerequisite only while the trait is
    active, and `favoredClassCount: 2` allows two favored classes, with a
    favored class bonus counting on either.
  - body-ext-3: an alternate Racial Trait chosen with
    `setRacialTraitSelected` takes each standard trait its `replaces` names
    off the sheet (dormant, reason `replaced`, none of its Modifiers listed
    or applied), and its own Modifiers and note prove as above; deselected,
    the standard trait is back. The fix r1 cases do this for alternates
    replacing one, two and three traits: two chosen together take all five
    off, and deselecting one brings back only its own. The alternates are
    `tests/source-body-proof-alternates.ts`, a fixture the registry entry
    binds by bytes beside the proof.

  **The list rule.** No structural signal says that an entry's outputs cover
  its whole body: Low-Light Vision's entry carries only its description note,
  the metamagic feats nothing. So only a row on the reviewed list counts. Each
  record binds the row's source bytes and the exact mechanical outputs the
  importer gives it. Its `basis` quotes the body and maps every clause to an
  output, to a #228 situational note for a clause with no number (Elven
  Immunities' sleep immunity, Stonecunning's automatic check), or to the
  Unchained stamina line for Point-Blank Shot's Combat Trick. A record with
  an output of another kind is refused, and so is one with no outputs: each
  output field it reads (`modifiers`, `situationalNotes`, `countsAsRaces`,
  `detail.favoredClassCount`, `detail.replaces`) counts only when it holds a
  value, so a record
  whose every field is absent, `undefined`, `null`, an empty list or an empty
  object proves nothing (the committed control's no-output test, over every
  combination of those, `favoredClassCount` and `replaces` inside `detail`
  too, and every listed record). A row then counts only when:
  - it is a feat, Racial Trait or trait whose one mechanism is `Source body
mechanics`; the granting race need not be admitted;
  - its scoped entry, of the row's kind, has exactly the reviewed outputs,
    read by `bodyOutputs`: Modifiers, notes, race equivalence, proficiencies,
    slots, prerequisites and the detail's mechanical fields, and a field the
    projection doesn't know gives none;
  - every output is a Situational Modifier (a shared or local Situation and
    no other condition) on a proven target with a racial, dodge, untyped,
    trait, circumstance or competence bonus and a constant value, a
    situational note on no target or a proven one, `countsAsRaces`,
    `favoredClassCount` or `replaces`. A `replaces` record names the
    replaced standard traits' keys exactly as the entry's `detail.replaces`
    gives them, so a wrong, missing, extra or reordered key, or an entry
    carrying `replaces` its record leaves out, is refused. The alternate
    has one race, and each key it replaces is a standard Racial Trait of
    that race in the scoped build: a foreign race's trait, an alternate
    trait, a non-Racial-Trait or a key missing from the build is refused.
    It replaces at most the scope's `mostReplaced` (3) traits. A coverage
    tie in `tests/catalog/launch-source-body.test.ts` requires that every
    count up to `mostReplaced`, and the own-race shape, is one a fixture
    alternate exercises. An `unresolvedReplacements` has no proven kind;
  - it has no `unsupported` issue at all.

  Any other registry entry naming `Source body mechanics`, scoped or not,
  proves nothing (`sourceBodyGate`); the reviewed-list families' gates sit
  together in `provenMechanisms`. `tests/catalog/launch-source-body.test.ts`
  tests each refusal. Its committed control re-imports the listed rows and
  checks that exactly they are proven among the inventory's rows that carry
  the mechanism, and that listing Low-Light Vision would prove it, so the
  list is what refuses it. The first list holds 13 Racial Traits with
  Situational Modifiers, 3 feats (Combat Casting, Spell Penetration,
  Point-Blank Shot) and 3 racial facts (Elf Blood, Orc Blood,
  Multitalented). Left out, with owners:
  - the five Weapon Familiarity traits: "treat X weapons as martial" and the
    composite bows aren't curated (#740, #720); they then need a
    `proficiencies` output kind;
  - Improved Unarmed Strike, whose lines key the hand-written identity
    (#719/#720);
  - Spell Focus, whose school choice is unstructured (#331), and generic
    Skill Focus, which has no chosen skill (owner question);
  - the 17 bodies whose only promise has no sheet statistic: Low-Light
    Vision, Languages, six metamagic feats, Eschew Materials and Orc Ferocity
    (owner question);
  - Catch Off-Guard, Combat Reflexes and Throw Anything, which are
    [permitted prose](#permitted-prose-by-category);
  - a trait whose entry carries `prerequisites` (its "Requirements" line: a
    deity, region or race), since no proven output kind covers it;
  - creature-type rows, and held rows, which join by a list amendment in the
    wave that admits them (body-ext, body-ext-2 and body-ext-3 list none;
    the committed control's casting-target test pins the alternates it
    meets).

- **The gear family** (#782, `scripts/catalog/launch-gear.ts`) proves the
  inventory's `Gear and Item Abilities`, which every item and Item Ability
  row gets. Its contract is conditional: preserve what the source supplies.
  The family covers worn armor and shields without a bash. Its proof is
  `convex/characterSheetGear.integration.test.ts`: imported-shaped armor,
  shield and weapon bodies pass through a Catalog Release, and public
  saved-sheet reads and writes show the following.
  - The candidate conversion keeps each armor block exactly: slot, category,
    bonus, maximum Dex (`null` included), armor check penalty and spell
    failure.
  - A worn armor's bonus reaches `ac.armor` and a shield's `ac.shield`;
    Dexterity to AC stops at the lowest worn cap (AC, touch AC and
    flat-footed AC); the penalties add on Strength and Dexterity skills and
    not on others; spell failure is summed and shown.
  - `lightArmor`, `mediumArmor` and `heavyArmor` read light, medium and heavy
    proficiency and `other` shield proficiency (`setManualProficiency`); an
    item worn without it costs its penalty on every attack line.
  - Enhancement adds on the armor's own leaf, masterwork lowers the penalty,
    and two worn armors compete highest-only while both caps and penalties
    apply ([weapons and armor](../character-sheet/weapons-and-armor.md)).
  - A shield's local Situational attack penalties enter no total, are listed
    in `conditional` and apply on their own melee or ranged line only.
    Targeted notes reach attack and AC, and an untargeted note the entry.
  - An unequipped item contributes nothing and returns when re-equipped; a
    member reads what the owner reads, and an outsider is refused.

  Gear S2 adds worn items with no armor block (rings, amulets, belts,
  headbands, cloaks, tools, ioun stones) and the tower shield. Its proof is
  `convex/characterSheetGearModifiers.integration.test.ts`. Each public
  test releases its own fixture (`tests/gear-proof-armor.ts`,
  `tests/gear-proof-worn-items.ts`), bound by bytes beside the tests, and a
  coverage tie in `tests/catalog/launch-gear.test.ts` fails when the scope
  certifies a shape, category, Modifier (target, bonus type, condition and
  value class) or note target those fixtures don't release. The proof
  shows:
  - a worn deflection bonus on AC, touch AC, flat-footed AC and CMD; an
    enhancement to natural armor on AC and flat-footed AC only; an insight
    bonus on AC; an enhancement to each ability score on the score and on
    every statistic its modifier feeds; a competence bonus on its skill; two
    bonuses of one type from two items not stacking;
  - a zero-valued Modifier (a change a reviewed replacement zeroes) changing
    nothing, while the bonus a local Situation carries (CMB insight, Craft
    and Perform circumstance, Stealth competence) enters no total, is listed
    in `conditional` and applies on its own statistic in its Situation only;
  - notes on each ability score and on Perform;
  - the tower shield (`towerShield`): its shield bonus, its Dexterity cap on
    AC, its penalties and spell failure, its −2 on every attack line, and
    tower shield proficiency, which shield proficiency doesn't give. Without
    it, every attack line takes the penalty of 10 instead of the −2, since
    two Modifiers of one entry don't stack
    ([stacking](../character-sheet/stacking.md));
  - unequipped items giving nothing, by `editSheetEntry`'s `active`.

  **The list rule.** No structural signal says that an item's outputs cover
  its body: Elven Chain's block contradicts its own body. So only a row on
  the reviewed list counts. Each record binds the row's source bytes and the
  exact outputs the importer gives it, read by `gearOutputs`: the detail's
  `consumable` and armor block, and the entry's Modifiers and notes (price
  and weight hold no sheet number). Its `basis` quotes the body and the Core
  Rulebook statistics and maps every clause to an output or to a settled
  text rule. A gear S2 record also names the row's `Modifier …` mechanisms
  (`modifierMechanisms`), each mapped to its output in the basis; the family
  proves them with `Gear and Item Abilities`, all or none. A row then counts
  only when:
  - it is an item whose mechanisms are `Gear and Item Abilities` once and
    exactly its record's `Modifier …` mechanisms;
  - its scoped entry is an item with exactly the reviewed outputs; a
    `weapon`, `magic`, `baseItemKey` or `ammunition` detail, any other
    mechanical field and any field the projection doesn't know give none;
  - its block's slot is its shape's (`worn-armor` or `shield`), with a
    proven category, or it has no block (`worn-item`, which carries at least
    one Modifier or note);
  - each unconditional Modifier and each Modifier in a local Situation has
    a target, bonus type and value class (negative, zero or positive) its
    scope list proves (`modifiers`, `situationalModifiers`): an unconditional
    Craft, Perform or Stealth Modifier only at zero, the value a reviewed
    replacement leaves; every note targets attack, AC, an ability score or
    Perform, or nothing;
  - it has no `unsupported` issue at all.

  Any other registry entry naming `Gear and Item Abilities`, scoped or not,
  proves nothing (`gearGate`). `tests/catalog/launch-gear.test.ts` tests each
  refusal. Its committed control re-imports the listed rows and checks that
  exactly they are proven among the inventory's rows that carry the
  mechanism, and that listing Buckler, Leather Armor or the held Musical
  instrument, masterwork, would prove them, so the list is what refuses
  them; a listed Tower Shield stays refused by its issue. The list holds
  Chain Shirt; gear S2 lists none. Left out, with owners:
  - Buckler, reviewed (`reviewedBuckler`) and proven by the same public test:
    its "you lose the buckler's AC bonus until your next turn" stays a note
    on AC, and whether it may count so is owner question O3 on #782;
  - shields with a bash, and Tower Shield, whose Total cover action stays a
    `gameContent` issue; specific and magic armor (#761, #764), weapons and
    ammunition (#761) and Item Abilities (#764);
  - items whose raw change the importer leaves unmapped, a `changes` issue
    that refuses them (Cloak of Resistance's `resist` type, Amulet of Mighty
    Fists' natural attacks, Robe of the Archmagi's spell resistance, which
    has no sheet statistic);
  - rows whose block contradicts or omits a body number (Elven Chain, Wooden
    Armor, the Agile armors, Armored Coat, the empty-category shields):
    curation first (#424, #457–#460);
  - medium and heavy armor, whose speed has no sheet statistic, and gear
    with no sheet output (owner questions);
  - held and unassessed rows, which join by a list amendment in the wave
    that admits them.

- **The class-level slots family** (#783, feature-grants slice 3a,
  `scripts/catalog/launch-class-level-slots.ts`) proves a class feature's
  `Modifier bonusFeats <formula>`. Foundry's `bonusFeats` change on
  `@class.level` imports as nothing: the importer has no `bonusFeats` target,
  so it is a `changes` issue with the generic reason. The reviewed schedule
  slots already deliver its count. The acquisition row and each increment row
  of the parent carry one bonus feat slot of the printed feat types
  (`pcgen/schedule-slots.ts`, `withSlot` in `class-schedules.ts`), and the
  sheet counts an active Grant's slots. Its proof is
  `convex/characterSheetClassLevelSlots.integration.test.ts`. Imported-shaped
  classes in the shapes of the four parents (Fighter, Cavalier, Magus and
  Inquisitor) pass through a Catalog Release, and public saved-sheet reads and
  writes show the following:
  - at every class level the test reads, the bonus feat budget equals the
    parent's Foundry formula, with one slot per row of the printed types. It
    reads the two listed parents' shapes, Bonus Feat (CAV) and Bonus Feats
    (MAG), from 1st to 20th. It reads the Fighter shape only to 4th and the
    Inquisitor shape only to 9th, the last of their three synthetic rows,
    since those parents aren't listed. A class that doesn't list the parent
    grants none, and a Fighter 2 / other 2 has the Fighter's 2nd-level slots,
    not its 4th;
  - a feat selected into a slot survives reload and another member's read. A
    feat of another type warns and is kept (#313), and the Magus slot takes a
    Combat, an Item Creation and a Metamagic feat;
  - deleting a level makes its row's Grant dormant, and the Selection in its
    slot keeps its slot dependency. Regaining the level restores both;
  - an Archetype replacing the parent whole removes every slot, and a part
    replacement removes only that level's;
  - an outsider is refused.

  A listed row's mechanism counts only when all of the following hold
  (`provenClassLevelSlots`):
  - the row is on the list, bound to its source bytes, and its one Modifier
    mechanism is `Modifier bonusFeats <formula>`;
  - the formula reads only `@class.level` in the app's formula grammar;
  - at least one class's scoped entry lists the parent. For every such class,
    and every class level from the parent's acquisition there to 20, the
    formula equals the number of the parent's rows that class lists at or
    below that level. Each of those rows is the parent, listed once, or an
    admitted increment of it, listed once;
  - each row's entry carries exactly its reviewed schedule slot and no
    Modifier, so nothing adds to the count twice;
  - the parent's only `changes` issue is that raw change, once, untyped,
    with the generic reason and no other field;
  - it has no `curation` issue.

  Each listed row's level grant joins `reviewedLevelGrants` with
  `scheduleSlot` (above). `tests/catalog/launch-class-level-slots.test.ts`
  tests each refusal: a count off by one at any level, of the formula or of
  the rows; a second slot, a doubled row or a Modifier; an open or other-typed
  slot; a missing, doubled or re-reasoned raw issue; a mismatching listing
  class; an unreadable formula; changed source bytes; an unlisted parent; and
  the Wizard, Monk, Sorcerer and Bloodrager bonus feats, whose rows match
  their formulas but carry no reviewed slot. The proof's shapes,
  `tests/class-level-slots-proof.ts`, are bound by bytes beside it, and the
  same file's coverage tie fails when a listed parent's formula, printed
  feat types and schedule rows aren't a shape the proof reads at every class
  level from 1st to 20th, the levels the rule checks. Its committed control re-imports
  every admitted `bonusFeats` parent with its classes and increments. It
  checks that exactly the listed rows are proven, and that with every parent
  listed the rule passes exactly the four with reviewed slot rules. It also
  checks that dropping one increment's slot refuses its parent in both
  families. The list holds Bonus Feat (CAV) and Bonus Feats (MAG) (root
  decision R1). Left out, with owners:
  - Fighter Bonus Feats and Teamwork Feat, reviewed with the same rule
    (`classLevelSlotRows('count')`): their bodies set retraining limits the
    sheet doesn't enforce, and whether they count is owner question O1 on
    #783. Teamwork Feat's level grant would stay outstanding even then,
    because it names the teamwork feats it may take as requirement rules;
  - the Wizard and Monk bonus feats, which wait on #716's slot rules, and the
    bloodline feats, which wait on bloodline pool picks (feature-grants
    slice 2);
  - Unarmed Strike, which grants a feat rather than a slot.

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
changed source drops it. No importer field records these three categories, so
each case needs a review naming its row. The reviewed cases are the three
#237 text attack feats, each for its `Source body mechanics` (#779): Combat
Reflexes, among the feats that change no line's numbers, and Catch Off-Guard
and Throw Anything, among the feats changing improvised attacks
([attacks](../character-sheet/attacks.md)). No mystery, patron or spirit case
and no unparsed-prerequisite case is reviewed yet. Prose satisfies only the
mechanism condition:
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
