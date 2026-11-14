## Principles

1. **General stat totals are never stored.** They are derived from Modifiers every time by a pure resolver. The sheet UI and the server's Militia Character Facts calculation share that resolver. The existing militia projection and the prepared Character's permanent ledger facts are the limited persistence exceptions described below.
2. **Everything on the sheet is a Character Sheet Entry.** This covers gear, spells, features, base scores, Class Levels and ability damage. Grants are worked out from their sources, like Granted Spells, and stored only to hold their state (see "Grants and dormant entries").
3. **Modifiers live on Catalog Entries.** A one-off item, a manual adjustment and the base scores are Catalog Entries scoped to one Character. The exceptions are Class Levels, ability damage and ability drain, which hold only Character state, and an item's armor bonus, enhancement, masterwork and material, from its detail and state (see "Weapons and armor"). The resolver turns these into built-in Modifiers.
4. **Rule facts belong on the Catalog Entry, state on the Character Sheet Entry.** Kind-specific shape is a discriminated union keyed by `kind` on both.
5. **Everything stays editable at any time,** including choices the rules say can't change later. Such rules, like every rules check, become advisory warnings and never block (AGENTS.md "Validation Philosophy").
6. **No caches** and no "active effects" table. Pools (current HP, spell slots, daily uses) are not entries, and play-time status tracking is out of scope.
