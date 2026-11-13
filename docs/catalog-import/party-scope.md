# Party scope (`campaign-party-v1`)

Launch content is measured on the party's characters, not on the 16,745-row
launch inventory (owner decision, 2026-11-10). The party's builds are a
committed input; the party scope and its status are generated from them.
Nothing here changes admission, a release build, an activation or the sheet:
no release reads the party scope yet.

## The builds

[`scripts/catalog/party/party-builds.json`](../../scripts/catalog/party/party-builds.json)
is hand-kept from the owner's paper sheets of 2026-11-12, as the party-scope
research matched them to the catalog. Each character is a number (1 to 13; `4c`
is character 4's animal companion), never a player or character name. A
character has its race, its classes and levels now and at the next level, and
its catalog keys grouped by kind: `racialTraits`, `classes`, `archetypes`,
`bloodlinesAndDomains`, `classFeatures` (with hexes, rage powers and other
chosen options), `feats`, `traits`, `spells`, `equipment` and `companion`.

- An entry is `matched` (a catalog key and its name) or `unmatched` (a name
  and the research's note), so a row nobody could match is still counted.
- A fact the sheet doesn't settle is stated, never guessed: a race is `open`
  when the sheet writes none; levels are `written`, `inferred` (with the
  evidence) or `open` with every build the sheet allows; a next level is
  `open` when the sheet doesn't say which class takes it.
- Languages, deities, materials and spell consumables are not catalog rows and
  are left out.

`parsePartyBuilds` (`party-builds.ts`) refuses a name where a number belongs,
an unknown field, a key under two groups or named twice by one character, a
level in a class the character doesn't name, a next level that isn't one
more, and a companion of no character (`tests/catalog/party-builds.test.ts`).

To add something a player takes: add its key under the character and group,
then run `pnpm -s catalog:party-scope --write`. Only that character's
closure changes.

## The scope

`pnpm -s catalog:party-scope --write` imports the full catalog at the pinned
checkouts, with the chosen PCGen owners (`--pcgen`, `pcgen-owners.ts`), and
writes [`scripts/catalog/scopes/campaign-party-v1.json`](../../scripts/catalog/scopes/campaign-party-v1.json):

- **roots**: each builds key with its group and the characters naming it;
- **rows**: every entry the roots reach over the admission gate's reference
  edges (`collectReferences`, the edges dependent omission follows, description
  links included), each with its catalog kind, name and the characters that
  need it;
- **edges**: `reference` or `description` (reached only by a description
  link);
- **binding**: the builds file's SHA-256, the upstream commits and the
  SHA-256 of the closure's rows and edges.

It has no `rule/` rows and no checkpoints. The generator refuses a builds key
the catalog doesn't carry or whose catalog kind its group doesn't allow
(`tests/catalog/party-scope.test.ts`), and the committed builds keep each key
under its group's kind (`party-builds.test.ts`).

The file is stored as `campaign-party-records-v4`: the launch inventory's v4
stable-key rule in one self-contained file. Each row is a record under its
content key (the first 64 bits of SHA-256 over its JSON, base64url), `rows`
lists the references in key order, and every list and record is one line, so a
changed row changes only its own lines. A record that doesn't hash to its key,
a missing reference or an unused record is refused on reading.

`--check` regenerates the scope and fails, naming why, when the builds file,
the catalog's closure or the scope file itself differs; two runs give
identical bytes (`party-scope.test.ts`). The file is outside the
`campaign-mvp-inventory` budget family, under the new-file cap.

## The status

```sh
pnpm -s catalog:preview --system PATH --content PATH --pcgen PATH --out "$TMPDIR/preview"
pnpm -s catalog:party-scope --status --preview "$TMPDIR/preview" [--json]
```

The status reads a preview's `catalog.json` and `admission.json`, the gate's
own result for every row, and runs no import, so it takes seconds once a
preview exists. It refuses a preview whose closure isn't the committed
scope's, or committed builds the scope isn't of. Labels come from the
committed verification projection, as a release labels its definitions
(`labelDefinitions`); a stale projection labels every row unverified.

Per character and in total it prints rows needed (the scope rows the
character reaches, its unmatched entries and its open race), admitted with
their labels (verified, unverified), held by hold reason with the notice code
or record that clears each, omitted, failed and unmatched; then each class and
race not admitted and what it is omitted on; then one line per character:
ready when every row it needs is admitted, otherwise the first thing that
stops it, in group order (race first). A row the gate lists as failed, held or
omitted is never counted admitted (`tests/catalog/party-status.test.ts`).
`pnpm -s mvp:status` prints in its first line that this status is the launch
measure.
