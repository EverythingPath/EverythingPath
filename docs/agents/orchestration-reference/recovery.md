# Owner-file overlap at landing

Reference for [runbook §10](../orchestration/runbook.md#10-land), reached when `land.sh` exits 2.

If `land.sh` exits 2 (logs/…-land.log), the branch overlaps the owner's uncommitted files. If the overlapping hunks are disjoint from the owner's edits, go around them, then put the owner's state back exactly:
1. Save `git diff <file>` as a patch in `$EP_ORCH/`.
2. Run `git checkout -- <file>`; for a staged rename, `git mv` it back.
3. Land the already-gated commit: `flock $EP_ORCH/land.lock $S/land.sh impl/<n> $WT`.
4. Re-apply the patch, or `git mv` forward again.
5. Confirm `git status` matches what it was before.

Otherwise ask the owner; their work is never stashed or reset.
