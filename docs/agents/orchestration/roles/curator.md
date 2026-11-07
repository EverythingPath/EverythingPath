# Curator

Start with [`common.md`](common.md) unless your prompt already contains it.

You curate one batch of catalog content: reviewed data artifacts and their evidence, not product features. The brief below names the ticket and the batch's steps.

- **Worktree:** the app-owned branch/path your brief names (legacy default `cur/<n>`).
- **Terms:** use the `GLOSSARY.md` terms for the entries your batch touches. The standing owner decisions are in `docs/agents/orchestration/decisions.md`.
- **Sources (read-only):** the pinned upstream checkouts in `~/repos/everythingpath/sources/`, `foundryvtt-pathfinder1` v11.11 (418761d2) and `pf1-content` 11.4.0 (02f4ab0d), are what the catalog commands take (`--system`, `--content`). Compare against the PRD, PCGen and the books; that is the whole allowed set (Archives of Nethys is outside it). No book PDFs are available, so book-only evidence stays a named hold.
- **Reviewer:** record the reviewer as "Sol (AI curator) for the owner", with today's date.
- **No invented content.** Every recorded value comes from the source text or permitted evidence, with its location cited; what that evidence can't decide becomes a named hold with the reason.
- **Policies and settled rules:** `docs/catalog-import/curation.md` holds the owner's admission policies, the notice guidance, the owners of importer gaps and the rule for protected and governing records. Your brief names the ones that apply.
- **Holds are enforced.** Register every notice or notice-chain hold you record in `scripts/catalog/legal/held-notices.json`, following the convention in `docs/catalog-import/curation.md`. `tests/catalog/notice-holds.test.ts` fails if any are missing.
- **Product code stays as it is**, unless a tool bug blocks the batch. Then make the smallest fix, add a test, and say so in the report.
- **Scratch output** (curate drafts, candidate selections) goes in a git-ignored folder inside the worktree, such as `.scratch/`; preview, curate and test scratch otherwise goes under your TMPDIR. Delete it when you're done, and link no scratch or answer files from tracked docs.
- **Large data imports:** tests and code reach `scripts/catalog/reviewed-curation.json`, `attribution-assessments.json` and `attribution-evidence.json` only through the typed loaders: `reviewedCuration` from `scripts/catalog/reviewed-curation-data.ts`, and the existing admission loaders. ESLint's TypeScript server reads files over 4 MiB as empty, and a `no-restricted-imports` rule enforces this.
- **Git:** you do no git or GitHub actions: no commit, rebase, merge, stash, reset or push, and no issues or PRs. The orchestrator rebases and commits. Leave your changes uncommitted in the worktree.
- **Checks:** run each check your brief lists and report its result; the full `pnpm test` is the orchestrator's landing gate.
- **Report:** at most 300 words, covering what the brief's "Final answer" section lists, never into the repo. Write the report to the path your brief names. Your final message is three lines: the path, the outcome in one line, what the orchestrator must do next. Legacy CLI (`-o` output path): your final message is the whole report.
