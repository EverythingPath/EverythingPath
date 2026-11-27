#!/usr/bin/env python3
"""Read-only mechanical-rebase proof for root (owner decision 2026-10-31, item 1).

Usage: rebase-proof.py [--regenerated | --patch-equal] [--head FULL_SHA] WT OLD_BASE ACCEPTED NEW_BASE

Runs `gate_core.rebase_proof`, the rule the gate re-verifies at every `authorization()`, from ACCEPTED on
OLD_BASE to HEAD on NEW_BASE. HEAD is the clean worktree's HEAD; `--head` names a commit instead and
reads Git objects only, without the clean-worktree check. Prints one JSON object: PASS (exit 0) with the
proof summary, HEAD's tree and the gate's `rebaseProof` field, or FAIL with the reason (exit 1). A result that cannot
be written (a closed pipe or stdout, a full disk) is not a proof refusal: it exits 74 (EX_IOERR), with no traceback.
`--regenerated` runs `gate_core.regen_proof` instead, for a rebase by code-rebase.sh whose only overlap was
regenerated artifacts; its `rebaseProof` carries `regen: {rule, paths, chain}`. `--patch-equal` runs
`gate_core.patch_equal_proof`, for a rebase by code-rebase.sh whose overlap outside the regenerated artifacts Git
merged cleanly, but for review-receipts.json when the receipts-union rule carried it; its `rebaseProof` carries
`patchEqual: {rule, paths}`, `receiptsUnion: {rule, paths}` too when that rule carried the file, and `regen` too when
the overlap also held regenerated artifacts.
Writes no files. The gate operator does not import this module.
"""
import argparse
import errno
import json
import os
import re
import sys
from gate_core import (PATCH_LABEL, git, git_holds, patch_equal_proof, proof_context, proof_refusal, rebase_proof, regen_proof,
                       require, require_objects)


def prove(wt, old_base, accepted, new_base, head=None, regenerated=False, patch_equal=False):
    for sha in (old_base, accepted, new_base) + ((head,) if head else ()):
        require(re.fullmatch('[0-9a-f]{40}', sha), 'Full Git SHA required: ' + sha)
    if head is None:
        with proof_context(step='reading the worktree'):
            require(git(wt, 'status', '--porcelain=v1', '--untracked-files=all') == '', 'WT must be a clean worktree (or pass --head)')
            head = git(wt, 'rev-parse', 'HEAD')
    with proof_context(step='checking the commits'):
        require_objects(wt, new_base, head)
        require(git_holds(wt, 'merge-base', '--is-ancestor', new_base, head), 'HEAD does not descend from NEW_BASE')
    summary = (patch_equal_proof if patch_equal else regen_proof if regenerated else rebase_proof)(wt, old_base, accepted, new_base, head)
    with proof_context(step='reading the trees'):
        field = dict(oldBase=old_base, accepted=accepted, acceptedTree=git(wt, 'rev-parse', accepted + '^{tree}'))
        field.update({key: summary[key] for key in ('patchEqual', 'receiptsUnion', 'regen') if key in summary})
        return dict(verdict='PASS', **summary, tree=git(wt, 'rev-parse', head + '^{tree}'), rebaseProof=field)


def main():
    parser = argparse.ArgumentParser(description='Prove HEAD on NEW_BASE is a mechanical rebase of ACCEPTED on OLD_BASE.')
    parser.add_argument('--head', help='full SHA to prove instead of the clean worktree HEAD')
    rule = parser.add_mutually_exclusive_group()
    rule.add_argument('--regenerated', action='store_true', help='prove a code-rebase.sh rebase that regenerated the overlap')
    rule.add_argument('--patch-equal', action='store_true', help='prove a code-rebase.sh rebase that replayed an overlap Git merged cleanly')
    for name in ('wt', 'old_base', 'accepted', 'new_base'):
        parser.add_argument(name)
    args = parser.parse_args()
    # The command's one catch: everything after parsing the arguments, printing the result included, runs inside it.
    try:
        result = prove(args.wt, args.old_base, args.accepted, args.new_base, args.head, args.regenerated, args.patch_equal)
        emit(json.dumps(result))
        return 0
    except OutputError:
        raise
    except Exception as error:
        label = PATCH_LABEL if args.patch_equal else 'Regenerated rebase proof' if args.regenerated else 'Rebase proof'
        emit(json.dumps(dict(verdict='FAIL', reason=str(proof_refusal(label, 'running the proof', error)))))
        return 1


class OutputError(OSError):
    """The result line could not be written."""


def emit(line):
    """LINE and a newline on stdout, flushed; any failure to write it is an OutputError."""
    try:
        if sys.stdout is None:
            raise OSError(errno.EBADF, 'stdout is closed')
        sys.stdout.write(line + '\n')
        sys.stdout.flush()
    except OSError as error:
        raise OutputError(error.errno, str(error)) from error


def run():
    """main's exit code, 74 when the result could not be written; stdout then goes to /dev/null, so the
    interpreter's own flush at exit cannot fail."""
    try:
        return main()
    except OutputError:
        try:
            os.dup2(os.open(os.devnull, os.O_WRONLY), 1)
        except OSError:
            pass
        return 74


if __name__ == '__main__':
    sys.exit(run())
