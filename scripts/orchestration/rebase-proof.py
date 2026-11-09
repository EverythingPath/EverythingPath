#!/usr/bin/env python3
"""Read-only mechanical-rebase proof for root (owner decision 2026-10-31, item 1).

Usage: rebase-proof.py [--head FULL_SHA] WT OLD_BASE ACCEPTED NEW_BASE

Runs `gate_core.rebase_proof`, the rule the gate re-verifies at every `authorization()`, from ACCEPTED on
OLD_BASE to HEAD on NEW_BASE. HEAD is the clean worktree's HEAD; `--head` names a commit instead and
reads Git objects only, without the clean-worktree check. Prints one JSON object: PASS (exit 0) with the
proof summary, HEAD's tree and the gate's `rebaseProof` field, or FAIL with the reason (exit 1).
Writes no files. The gate operator does not import this module.
"""
import argparse
import json
import re
import subprocess
import sys
from gate_core import git, git_holds, rebase_proof, require_objects
from workflow_evidence import require


def prove(wt, old_base, accepted, new_base, head=None):
    for sha in (old_base, accepted, new_base) + ((head,) if head else ()):
        require(re.fullmatch('[0-9a-f]{40}', sha), 'Full Git SHA required: ' + sha)
    if head is None:
        require(git(wt, 'status', '--porcelain=v1', '--untracked-files=all') == '', 'WT must be a clean worktree (or pass --head)')
        head = git(wt, 'rev-parse', 'HEAD')
    require_objects(wt, new_base, head)
    require(git_holds(wt, 'merge-base', '--is-ancestor', new_base, head), 'HEAD does not descend from NEW_BASE')
    summary = rebase_proof(wt, old_base, accepted, new_base, head)
    return dict(verdict='PASS', **summary, tree=git(wt, 'rev-parse', head + '^{tree}'),
                rebaseProof=dict(oldBase=old_base, accepted=accepted, acceptedTree=git(wt, 'rev-parse', accepted + '^{tree}')))


def main():
    parser = argparse.ArgumentParser(description='Prove HEAD on NEW_BASE is a mechanical rebase of ACCEPTED on OLD_BASE.')
    parser.add_argument('--head', help='full SHA to prove instead of the clean worktree HEAD')
    for name in ('wt', 'old_base', 'accepted', 'new_base'):
        parser.add_argument(name)
    args = parser.parse_args()
    try:
        result = prove(args.wt, args.old_base, args.accepted, args.new_base, args.head)
    except (RuntimeError, subprocess.CalledProcessError, OSError) as error:
        print(json.dumps(dict(verdict='FAIL', reason=str(error))))
        return 1
    print(json.dumps(result))
    return 0


if __name__ == '__main__':
    sys.exit(main())
