# Pinned source store

One shared copy of every pinned upstream file that curation tests read, so new batches don't copy sources into `tests/fixtures/<family>-<N>/`. Tests stay reproducible from a clean checkout: the pinned checkouts under `~/repos/everythingpath/sources/` are not needed.

## Layout and pins

Each file sits at `<repo>/<original upstream path>`, byte-identical to the file at the pin in `scripts/catalog/inventory.ts` (`pins`, `pcgenPin`):

| Repo             | Pin                                                                 | Manifest             | Packs under              |
| ---------------- | ------------------------------------------------------------------- | -------------------- | ------------------------ |
| `pf1`            | v11.11, `418761d2e16a6037c0156bb4a241f7cea5a2986d`                  | `public/system.json` | `packs/`                 |
| `pf1-content`    | 11.4.0, `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`                  | `module.json`        | `src/`                   |
| `pcgen`          | `25523dbcf10e86c280fc0f447167ea43d67419d3` (`pcgenPin`)             | none                 | `data/pathfinder/paizo/` |
| `prd`            | the PRD capture `prd-2026-10-20` (`prdPin`)                         | `manifest.json`      | `pages/`, `checklist/`   |
| `prd-supplement` | the PRD supplement `prd-supplement-2026-10-31` (`prdSupplementPin`) | `manifest.json`      | `pages/`                 |

Both manifests are the full upstream files. `pcgen` holds PCGen files at their original paths (`pcgen/data/pathfinder/...`): curation batches' comparison files (checked against the sha256 values in the batch's legal JSON, `comparisonSources`), #716's import fixtures the 89 `OGL.txt` files of #716's books and the 43 of the books outside them whose file carries their own Section 15 line (`scripts/catalog/pcgen-notice-books.json`, with their `.pcc` files), whose Section 15 blocks ship whole (`scripts/catalog/legal/section15-match.ts`). Its checkout is `~/repos/everythingpath/.ep-cache/pcgen-25523dbc`.

`prd` holds the #716 PRD capture's manifest and the excerpts tests need (the PRD's root and Open Game License pages and the facts-only `pf1e-archetypes` checklists), at their paths in the capture, `~/repos/everythingpath/sources/prd-2026-10-20/` (the 2026-10-18 capture's files byte-identical, plus the base-class pages). `tests/catalog/prd-pin.test.ts` checks them against `prdPin` (`verifyPrdCapture`), and the whole capture when it is present. Add a page by copying it from the capture; the manifest already records its hash.

`prd-supplement` holds the PRD supplement whole (owner decision of 2026-10-31): its manifest and the Advanced Race Guide's age, height and weight page (`pages/advancedRaceGuide/ageHeightWeight.html`, role `ageTables`), fetched once from Wayback by the capture's rules and pinned on its own (`scripts/catalog/prd-supplement.ts`), as race age-table evidence only. It leaves the `prd` capture and `prdPin` as they are. `tests/catalog/prd-supplement.test.ts` checks it.

Besides the packs, `pf1` holds three reference files outside them: `module/registry/sources.mjs`, Foundry's book list, which the PCGen book crosswalk (`scripts/catalog/pcgen-books.json`) is checked against; and `module/chat/text-enrichers.mjs` and `module/utils/lib.mjs`, the text enrichers and inline-roll pattern that the reviewed description corrections' copied grammar (`constructGrammar`) is checked against.

## Rules

- **Append-only.** Add the files a batch needs and the store lacks. Never edit, move or delete a file here: other batches' tests read it.
- **Byte-identical.** Copy from the pinned commit, for example `git -C ~/repos/everythingpath/sources/pf1-content cat-file blob 02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d:src/pf-feats/<file>.yaml > tests/fixtures/pinned/pf1-content/src/pf-feats/<file>.yaml`. No cut-down or synthetic files, and no `.gitkeep`.
- A new pin needs a new store; don't overwrite files with another version.

## Loading

`tests/catalog/pinned-sources.ts`:

- `pinnedPath(repo, path)` and `readPinned(repo, path)` resolve or read one file by its upstream path; `repo` is `pf1`, `pf1-content`, `pcgen` or `prd` (a path in the capture, such as `pages/openGameLicense.html`).
- `materializePinnedTree(files, { sha256 })` takes the batch's `<repo>/<path>` list (for example `pf1/packs/feats/alertness.Q1cY8r0Pvb66pMG0.yaml`) and builds a fresh pair of checkouts under the OS temp directory: both full manifests, every declared pack folder (so `coverageComplete` holds) and the listed files. Pass its `systemPath` and `contentPath` to `importCatalog`, and call `dispose()` afterwards. Listed `pcgen/data/pathfinder/paizo/…` files go to a PCGen checkout whose data folder is `pcgenPath`, for `readPcgenTree`; list each pack's `.pcc` too (a `_pfs/` or `support/` folder's own `.pcc` makes it a separate pack). The optional `sha256` map checks the listed files against the digests in the batch's legal inventory (`candidates[].source.sha256`).

Keep each batch's file list in its own `tests/fixtures/<family>-<N>/data.ts` or legal JSON. The importer fingerprints every file it sees, so always import a per-batch tree, never the whole store.

`tests/catalog/pinned-sources.test.ts` checks the loader and, when the pinned checkouts (PCGen's included) are present at their pins, that every file here equals its upstream blob.
