#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

generated_status="$(git status --porcelain=v1 --untracked-files=all -- convex/_generated)"

if [[ -n "$generated_status" ]]; then
  echo "Convex generated files differ from the committed versions:" >&2
  echo "$generated_status" >&2
  git diff HEAD -- convex/_generated >&2
  exit 1
fi

echo "Convex generated files match the committed versions."
