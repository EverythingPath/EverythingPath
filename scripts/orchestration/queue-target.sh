#!/usr/bin/env bash
# Callable normalization/core validation with NUL-delimited data, never shell code.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
. "$here/worktree-lib.sh"
queue_target "${1:?item}" "${2:?integration ref}" >&2
printf '%s\0' "$kind" "$num" "$br" "$wt" "$name" "$msg" "$supplied_wt"
