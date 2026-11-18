# Bounded note-curation fixtures

These synthetic items exercise the #303 operator/import seam without executing the upstream corpus. The manifests use the pinned versions for fixture compatibility; `inputVerification.status` remains `unverified`.

| Fixture     | Category                                                        |
| ----------- | --------------------------------------------------------------- |
| Numeric     | Simple numeric racial save note; fixture-only checked example.  |
| Compound    | One CMD bonus split between bull rush and trip while on ground. |
| Formula     | Fighter-level formula in the shared closed grammar.             |
| Immunity    | Situational Note without a number.                              |
| EmptyTarget | Entry-level Note for unmodeled critical confirmation.           |
| Action      | Stable action/conditional IDs and a weapon `$self` Modifier.    |
| Covered     | Explicit checked covered/no-output example with a rationale.    |
| Prose       | Separate description-pass CMD candidate; outside the note gate. |
| Flaming     | Hit dice seeded from the excluded helper, plus ability price.   |
| Keen        | Threat doubling and piercing/slashing weapon restriction.       |
| Shadow      | While-active skill Modifier and flat-price +0 equivalent.       |

The two excluded helper YAML files are copied unchanged from the representative pinned pf1-content fixtures. Their originals are covered by that fixture set's attribution documentation. The bounded ability/feat records are authored synthetic test data and do not claim source-book content review.

`expected/draft/` holds the first ten parser drafts and report; `expected/descriptions/` adds the one prose record. `expected/reviewed-records.json` changes Numeric and Covered to checked using synthetic reviewer metadata, and Covered to explicit no-output. `expected/resume/` proves zero new or replaced records against that file. `expected/missing/` contains the five reports written before the missing-record nonzero exit; `expected/covered/` contains the five covered preview reports. All eleven entries retain independent attribution holds. `expected/pipeline.json` is the byte-for-byte pure import artifact, asserted by the public pipeline tests.

The initial drafts contain six Modifiers, three Notes and five Item Ability outputs, with no diagnostics. The prose pass adds one Modifier; the reviewed/resumed set contains seven Modifiers, two Notes and five Item Ability outputs. Flaming, Keen and Shadow have complete structured mechanics and no duplicate description Notes. The covered required gate has 10 records: 8 drafted and 2 checked. The separate prose pass has 1 drafted candidate and no checked records; its counts live under `summary.descriptions`. These counts reflect the regenerated operator commands and public import artifacts, not upstream content review.

Run the exact commands in [the operator runbook](../../../docs/catalog-import/curation.md); replace its upstream input paths with `tests/fixtures/curation/pf1` and `tests/fixtures/curation/pf1-content`, and add `--allow-unverified-checkouts`. [observed.json](observed.json) records the completed fixture command outcomes.
