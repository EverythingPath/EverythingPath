# Spell batch #518 runtime fixtures

The 100 Spell YAML files are byte-identical snapshots of the ticket’s exact pinned Foundry roots. The 28 class files provide class-tag context, not additional reviewed candidates. [Provenance](provenance.json) records every raw file hash. Reduced manifests describe only fixture packs; the empty content source directory contains no extra content.

[Preview](preview.json) is parser output with the checked description overlay. Every shipping Attribution Assessment remains unresolved. These fixtures establish no legal admission, Catalog Release or deployment.

[The public resolver cases](../../catalog/spells-518.test.ts) preserve real class levels, size-adjustment text, Shocking Grasp’s damage cap and metal-target bonus, Bane’s shared fear Situation and Thought Shield V’s shared mind-affecting Situation. Recording a Spell applies no running effect.

[The isolated saved-sheet cases](../../../convex/catalogSpells518.integration.test.ts) exercise Oracle’s known collection and Wizard’s Spellbook, member editing, outsider rejection, campaign scope, removal and client/server preview parity. Oracle context is parsed from pinned source and combined only in memory with the existing reviewed casting table. Installing the Spell fixtures is confined to each `convex-test` Character catalog.

A separately player-created Bane Spell Effect uses CRB p.246’s literal −1 attack penalty and fear-only −1 save penalty. It is temporary: current melee attack drops by 1, Will drops by 1 only when the fear Situation is requested, and permanent values do not change. Switching it off restores the baseline. This proves the existing public effect writer and resolver; it is not an imported, admitted or newly curated Spell Effect, and does not complete the batch’s outstanding effect work.
