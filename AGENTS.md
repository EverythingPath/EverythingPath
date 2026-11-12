# Agent guidance

- Work is tracked in GitHub Issues through `gh` (repository from the `origin` remote; sub-issues and native dependencies for Wayfinder maps): `docs/agents/issue-tracker.md`. Triage labels: `docs/agents/triage-labels.md`. Wayfinder sessions, which often share docs and maps: `docs/agents/wayfinder.md`.
- Orchestrated runs (implementation, reviews, fix rounds, gates): start with `/orchestrate-spec`; it reads `docs/agents/orchestration.md`.
- Terms: `GLOSSARY.md`; use its words in code and copy. Domain docs use the single-context layout: `docs/agents/domain.md`.
- Standards every change is reviewed against: `docs/standards.md`.
- Product: the militia board, `docs/product/militia-board.md`; the PF1 character builder (PRD #251), `docs/pf-character-sheet-data-model.md`; behaviour later tickets keep, `docs/product/settled-behaviour.md`.
- Militia rules work: the corpus and how to search it are in `docs/product/militia-board.md#militia-rules-corpus`.
- Adding or expanding generated datasets, snapshots, manifests or reports: `docs/agents/generated-artifacts.md` first.
- Before finishing a feature change: `pnpm -s typecheck`, `pnpm -s lint` and the relevant tests.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
