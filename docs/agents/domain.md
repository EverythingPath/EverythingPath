# Domain Docs

How the engineering skills consume this repository's domain documentation while exploring the codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repository root.
- **`docs/adr/`** for ADRs that touch the area being changed.

If either location does not exist, proceed silently. Do not propose creating it preemptively; use `/domain-modeling` when terminology or architectural decisions actually need to be recorded.

## File structure

This is a single-context repository:

```text
/
├── GLOSSARY.md
├── docs/adr/
└── src/
```

## Use the glossary's vocabulary

When output names a domain concept in an issue title, proposal, hypothesis, or test, use the term defined in `GLOSSARY.md`. Do not drift to synonyms the glossary explicitly avoids.

If a required concept is absent, reconsider whether the term belongs to the project or note a genuine gap for `/domain-modeling`.

## Flag ADR conflicts

If proposed work contradicts an existing ADR, surface the conflict explicitly rather than silently overriding the decision.
