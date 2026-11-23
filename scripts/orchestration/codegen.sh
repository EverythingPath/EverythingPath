#!/usr/bin/env bash
# usage: codegen.sh <worktree> — generate bindings against disposable local Convex.
# The Node runner owns signal handling and cleanup; no Cloud env file is loaded.
set -euo pipefail
wt=${1:?usage: codegen.sh <worktree>}
here=$(cd "$(dirname "$0")" && pwd)
. "$here/paths.sh"
cd "$wt"
mkdir -p "$repos/.ep-tmp"
export TMPDIR=$repos/.ep-tmp
exec node --import tsx scripts/local-convex/codegen.ts
