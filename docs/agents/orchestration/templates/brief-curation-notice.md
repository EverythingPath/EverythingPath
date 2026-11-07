# Curation: #<N> <TITLE>

Deliver reviewed notice records and their evidence.

- **Ticket:** run `gh issue view <N>`. It lists the exact notice-block keys to review and the acceptance criteria. Precedent: #264 (inherited notice blocks 1–15) landed as commit 19475802; read `git show 19475802 --stat` and its report `docs/catalog-import/inherited-notices-264.md`, and follow its conventions.

## Read first

- The PRD: `gh issue view 251`. Search for "notice", "Section 15", "Registry", "attribution", "hold" and "retained exception", and read its acceptance appendix comment.
- The decisions that define permitted evidence: `gh issue view 224`, `gh issue view 227`, `gh issue view 241`, including comments. Later decisions override earlier ones.
- The settled notice rules earlier batches converged on: `docs/catalog-import/curation.md#notice-guidance`. Follow them; what that section lists as unresolved stays held, and its reconciliation stays in #737.
- Repo docs: `docs/catalog-import/README.md`, `docs/catalog-import/curation.md`, `docs/catalog-import/releases.md`, and the legal and notice code and data under `scripts/catalog/legal` and `scripts/catalog/admission.ts`. Find how Registry records, aliases, holds and the legal page are modelled, and how landed work recorded reviewed notices (`git log --oneline -- scripts/catalog/legal`).

## What to do

1. Locate each of the 15 source blocks by its immutable hash. Tell wrapped fragments and headings apart from complete notices, and join fragments with documented provenance where required.
2. Review each block's verbatim inherited wording, date, aliases and source provenance against the permitted evidence from #224, #227 and #241. Never infer coverage merely from the seed.
3. Record reviewer, date and evidence in the repo's Registry format:
   - **Discrepancies:** resolve any that admitted content needs.
   - **Holds:** name any unresolved holds or retained exceptions, and keep the notice superset.
   - **Trailing whitespace:** normalize it. Store the notice text trimmed, so that `sha256(notice)` equals the key. Record the raw line's hash in the provenance.
4. Demonstrate legal-page generation and admission-gate behaviour with the reviewed records, using the repo's existing commands and tests. Add a focused test if the repo pattern calls for one.
5. Write a short batch report next to the #264 report (e.g. `docs/catalog-import/inherited-notices-<N>.md`). It should cover:
   - each key's disposition;
   - the evidence used;
   - holds;
   - commands run and their results.

## Checks to run

- `pnpm -s typecheck`
- `pnpm -s lint`
- `pnpm -s check:initial-migration-writers`
- `pnpm catalog:pin`
- the catalog admission and curation gate commands that apply, using the source paths above
- The impact plan’s relevant test files. Use specialized curation prep for the light/full catalog decision and affected older batches; retain full landing-queue validation. Reuse matching evidence as your brief's validation plan says.

## Final answer

- the disposition of each key;
- the evidence used;
- holds;
- files changed;
- the check results;
- the time spent on each phase;
- problems with the workflow or tooling worth fixing before scaling up.
