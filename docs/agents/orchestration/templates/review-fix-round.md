## Fix round <R>

- Original acceptance: <ACCEPTANCE>.
- Prior accepted commit and tree: <PRIOR_ACCEPTED_COMMIT/TREE>; prior reports: <REPORTS>.
- Numbered findings, dispositions and responses: <FINDINGS>. Unresolved objections: <OBJECTIONS>.
- Delta `<DELTA_BASE>..<COMMIT>` and its affected dependencies: <DEPENDENCIES>.
- Contract (tooling and guard work): the acceptance table in <FIX_BRIEF> (or none), the contract for this round, as `brief.py review --contract` names it; a blocking finding names the row it breaks, and a case the table does not decide is marked contract gap.

Start with `git -C <WT> diff <DELTA_BASE>..<COMMIT>`. This round is delta-only: review the delta and its closure, whether each prior finding is fixed, and regressions, verifying preservation of accepted requirements; widen with evidence. A new finding in unchanged code blocks only if it is a blocker or hard violation; otherwise it is a follow-up. Unchanged accepted work stays usable, and unrelated style judgements do not restart acceptance. Name the actual task/run/model/options and a distinct report for this round.

Single-axis fix round (code; the other axis LANDed at E): name the full-SHA delta `<E>..<COMMIT>` literally, and state whether the delta stays within your findings and whether it touches behaviour the other axis judged.
