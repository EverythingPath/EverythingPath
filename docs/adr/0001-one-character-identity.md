# One Character identity for the militia and the character builder

The character builder extends the existing `character` table and its ids instead of introducing a separate `pfCharacter`, as `docs/pf-character-sheet-data-model.md` first proposed. Every Character has a Character Sheet, and the flat ability-score columns retire into the sheet's base-scores entry, so stats have one source of truth.

## Considered Options

- **Separate linked `pfCharacter`**: rejected because one person would have two records whose level and scores drift apart.
- **New table replacing `character`**: rejected because every `characterId` would need repointing, including the frozen militia snapshots inside immutable Resolution Records.

## Consequences

The militia keeps its own mirror of character values, now derived from the resolved Character Sheet. Confirmed weeks stay frozen through their snapshot copies.
