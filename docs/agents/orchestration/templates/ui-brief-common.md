# UI presentation brief (PRD #251)

You are the UI presentation agent for one ticket of PRD #251, the Pathfinder 1e character builder, in the EverythingPath repo (Next.js, Convex, Vitest, shadcn/ui, react-hook-form with zod). The ui role (`docs/agents/orchestration/roles/ui.md`) carries the safety rules and the report.

Read first: docs/standards.md, GLOSSARY.md (use its terms in copy), and docs/style.md if present (one component per file; naming rules). The approved prototypes are git tags. Use `git show prototype-approved/<name>:<path>` to read a file and `git ls-tree -r --name-only prototype-approved/<name>` to list them.

Match the existing character-sheet components in src/components/character-sheet/: blocks, chips, labels, touch targets (min-h-11 on phone), side-panel and bottom-sheet patterns, and shadcn primitives. Use the primitives rather than raw elements. Tablet landscape is the primary layout, then phone and desktop.

Tests are block-level component tests using the existing fixtures (character-sheet-blocks-test-fixture.tsx and `characterSheetNames` from `tests/convex-names.ts` for Convex function names; mock no `_generated/api` paths by hand), with role and label queries. Keep each test well under 1.5 s.

Run `pnpm -s typecheck`, `pnpm -s lint` and `pnpm test src/components/character-sheet`, plus any other affected paths. Use `pnpm test <path>`, not `pnpm test -- <path>`.
