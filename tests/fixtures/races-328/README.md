# Race batch #328 isolated evidence

These six byte-for-byte race records come from Foundry PF1 v11.11 at
`418761d2e16a6037c0156bb4a241f7cea5a2986d`. `provenance.json` records their
paths and hashes. The two manifests are deliberately minimal fixture manifests;
they do not claim to be complete upstream checkouts.

`preview.json` records these six entries after the ordinary parser and reviewed
curation overlay run. Extraction is not admission. All six definitions are
held, and this fixture supplies no accepted Attribution Assessment. The batch's
actual assessments remain in `src/lib/catalog/data/attribution-assessments.json`.

`sheet.ts` adapts only the three races without a trait folder to an isolated
sheet fixture. It preserves the extracted Modifiers and zero racial Hit Dice.
Since #721 each race grants only its reviewed ability score trait, which
carries the race's fixed ability changes; `preview.json` lists the six traits.
It does not repair natural attacks or other outstanding mechanics. Their
ability-score results from six base scores of 10 are:

| Race       | Str | Dex | Con | Int | Wis | Cha |
| ---------- | --- | --- | --- | --- | --- | --- |
| Gnoll      | 12  | 10  | 12  | 10  | 10  | 10  |
| Lizardfolk | 12  | 10  | 12  | 10  | 10  | 10  |
| Ogre       | 14  | 10  | 12  | 8   | 10  | 8   |

The Node tests check exact raw hashes, repeatable extraction, source-bound
curation and assessment bindings, and these public resolver results. Dwarf
exercises conditional note coverage and invalidation without claiming completed
trait ownership. The Convex test inserts a character-scoped Gnoll definition
and its ability score trait only into an in-memory test database. It selects and reads the saved race
through public APIs and compares the application's local catalog preview. A
separate custom fixed-HD edit proves the recorded HP/ranks contract; that edit
is a fixture customization, not imported Gnoll rules.

Gillman demonstrates the separately conditioned +2 enchantment save bonus and
−2 penalty against aboleths. Halfling demonstrates that Fearless stacks with
Halfling Luck, while Dwarf's overlapping poison/spell conditions contribute
Hardy only once. These corrected numeric records remain on the imported race
pending trait ownership work; passing these checks does not establish complete
racial automation.

Halfling's description also links a weapon outside this six-record fixture.
The subset's content fingerprint must differ from its full imported content
closure. Dwarf and Halfling retain unresolved-reference gate failures; the
fixture never turns those failures into an accepted assessment.

Run with `pnpm test tests/catalog/races-328.test.ts convex/races328.integration.test.ts`.
No production data, release activation or browser demonstration is involved.
