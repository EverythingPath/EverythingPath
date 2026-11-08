# Generated artifacts

Store each fact once. Use references for repeated records and generate expanded reports and diagnostics on demand.

Before adding or expanding generated files:

1. Identify canonical inputs, consumers and the regeneration command.
2. Measure the complete artifact family, including shared dictionaries and reports.
3. Run `pnpm -s check:artifacts --base <task-base>` before requesting review.

Committed artifacts must be needed by a consumer, offline operation or independent verification. Reproducible diagnostic dumps belong in generated output, not Git.

Artifact budgets live in `scripts/artifact-budgets.json`. Count every matching file regardless of extension. Splitting files does not increase a family's budget. Minification does not establish that duplicated information has been removed.

A new budget or increase must explain what additional information is stored, why it must be committed, why existing records or generated views cannot supply it, and measured total bytes/lines before and after.

Budget changes require an explicit Standards review disposition. Generators and baseline-update commands must not increase budgets automatically.

Representation changes must preserve decoded information and observable outputs, retain independent validation expectations and regenerate deterministically. Compare against the previous representation, not expectations produced by the new encoder.

Implementation reports include artifact size changes. Reviewers assess storage design as well as correctness.

Current families in `scripts/artifact-budgets.json`:

- `campaign-mvp-inventory` (#768): the compact launch inventory and its independent validation authorities.
- `catalog-legal-evidence` (#744): the legal inventories under `scripts/catalog/legal/` and the attribution evidence file. The evidence stores each JSON value of 512 bytes or more once, as a hash-named blob, and decodes to the exact plain-map bytes it replaced ([curation.md](../catalog-import/curation.md#parallel-batches)). The inventories still copy evidence fields; that overlap is deferred to #744's D-05 cleanup after curation.

## Checker reference

`node scripts/check-artifacts.mjs --base <commit>` resolves a fixed task base and includes tracked worktree edits and nonignored new files. Without arguments it compares with `HEAD`. `--ci` checks the committed checkout tree, using `GITHUB_EVENT_PATH` and `GITHUB_EVENT_NAME`:

- `pull_request`: compare the event's base SHA with the checked-out head SHA, or its synthetic merge (first parent base, second parent event head). The complete checked merge tree is measured.
- `push`: compare the event's `before` SHA with its checked-out `after` SHA.
- New branch (`before` is all zeroes): compare with the merge base of the checkout and `refs/remotes/origin/<repository.default_branch>`. A newly created default branch, including an initial root commit, is compared with an empty tree. This counts its entire tree. Missing required commits or default-branch history fail; fetch full history.

All byte sizes are decimal. Limits are inclusive: totals equal to a limit pass. Budgeted families use complete current totals, including unchanged members. Unbudgeted paths use per-new-file bytes, cumulative positive per-path byte growth and added lines; deletions never offset additions. New-file identity and byte growth compare paths against the fixed base: recreating a base path as untracked does not make it a new path or reset its baseline bytes. Unchanged legacy files consume no growth allowance. Moving a file outside a family makes its new path unbudgeted.

Patterns are literal repository-relative paths, optionally ending in a single `*` matching every suffix, including subdirectories and extensions. Other glob syntax and overlapping patterns are rejected, even without matching files. Invalid UTF-8 Git paths fail rather than being skipped. All schema fields are required; unknown fields and invalid limits fail.

Text lines are LF separators plus a nonempty final unterminated line. A NUL byte anywhere marks a binary file: its bytes count and its text lines are reported as unavailable (zero toward line limits). For changed tracked text, added lines come from Git's diff with rename detection, external diff and text conversion disabled; replacements count as additions. Unavailable statistics stay distinct from zero. When Git reports binary statistics for current text (including a binary base or `-diff` attributes), every current text line counts conservatively, except identical content verified by streaming hashes. Ordinary text diffs retain their precise addition counts. Every nonignored untracked text file contributes all its lines, even when its path existed at the base and Git reports a tracked deletion. Symlinks count the link target's stored bytes and lines, never target contents. Symlink parents, changed or budgeted gitlinks, and special files fail without traversing them. Ignored untracked inputs are excluded through Git's file listing.

The report shows comparison identity, family totals before/after, unbudgeted growth, largest contributors, budget changes and violations. Budget changes are surfaced for human review; passing numeric checks does not establish review approval.

Run the dependency-free CLI fixtures with `pnpm -s test:artifacts`, with `TMPDIR` set to the run's external task directory ([orchestration hygiene](orchestration/decisions.md)). CI explicitly creates its fixture root under `RUNNER_TEMP`, outside the checkout. Local fixtures qualify comparison logic; they do not prove remote CI execution.
