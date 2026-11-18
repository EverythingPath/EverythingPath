# Ironfang Militia Rules (AI Search Pack)

This folder stores the **Ironfang Invasion militia subsystem** in AI-friendly, searchable form.

## Files

- `docs/ai/ironfang-militia/militia-rules.md`
  - Full rules text reorganized by topic and phase.
- `docs/ai/ironfang-militia/militia-tables.md`
  - Structured versions of Table 6-1 (advancement), Table 6-2 (reputation), and Table 6-3 (events).
- `docs/ai/ironfang-militia/militia-verbatim.md`
  - Verbatim text as provided by the user source block.
- `docs/ai/ironfang-militia/search-tags.md`
  - Keyword index for fast retrieval by tools/agents.

## Suggested Search Patterns

- Find a specific action:
  - `rg -n "^## Action:|Drill Militia|Reduce Danger|Restore Character" docs/ai/ironfang-militia`
- Find officer rules:
  - `rg -n "^## Officers|Ambassador|Commandant|Strategist" docs/ai/ironfang-militia`
- Find rank/training breakpoints:
  - `rg -n "Table 6-1|Minimum Training|rank [0-9]+" docs/ai/ironfang-militia`
- Find event outcomes/mitigation:
  - `rg -n "Table 6-3|Mitigate|persistent" docs/ai/ironfang-militia`
- Find cache constraints:
  - `rg -n "Minor Cache|Intermediate Cache|Major Cache|Secrecy DC" docs/ai/ironfang-militia`
- Find exact original wording:
  - `rg -n "exact phrase here" docs/ai/ironfang-militia/militia-verbatim.md`

## Retrieval Notes

- Prefer `militia-tables.md` for numeric lookups and thresholds.
- Prefer `militia-rules.md` for procedures, step order, and edge cases.
- Prefer `militia-verbatim.md` when exact wording fidelity matters.
- Use `search-tags.md` for synonym matching (example: `MIA` -> `Missing in Action`).
