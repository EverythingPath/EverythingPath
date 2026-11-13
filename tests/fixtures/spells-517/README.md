# Spells #517 fixtures

The 100 raw Spell files are the exact issue #517 inventory at Foundry pf1
commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`. `provenance.json` records
their source paths and SHA-256 hashes. The 28 class files provide source-backed
class-tag lookup context; they are not reviewed candidates or admitted
dependencies. The reduced manifests declare only the fixture packs.

`oracle-context.json` is the public importer's metadata output for that existing
Oracle context file (`pf1/5S0u8yFcP861wgd1`, Advanced Player's Guide pp. 42–54).
The Convex fixture combines it with the existing reviewed Oracle casting table
to exercise Divine Favor and Virtue on their real class list. It installs no
Oracle Grants and does not establish class admission or feature coverage.

`preview.json` is the public importer's reviewed, bounded Spell output. It is
not an admitted Catalog Release. Every shipping Attribution Assessment remains
unresolved; the legal inventory records the individual content and notice
holds. The source files were compared byte-for-byte with the pinned checkout
when recovering the interrupted run.

`sheet.ts` builds resolver inputs from the imported definitions, including their
actual Modifiers. The Convex tests install these definitions only into isolated
test Characters, then exercise public browse, record, read and remove writers.
The separately player-authored running Divine Favor effect uses the published
minimum +1 luck bonus (Core Rulebook p. 273); it is not an imported Spell Effect.

The admission test constructs confirmed permission only in memory to exercise
the fixture path. It neither writes a confirmed assessment nor establishes
shipping coverage, and it still enforces the Advanced Player's Guide notice
hold for Wrathful Mantle. An APG product-code alias is added only to the
in-memory test Registry so the gate can reach the hold after its notice-binding
check; the shipping Registry remains unchanged.
