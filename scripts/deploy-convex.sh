#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [[ "${1:-}" == "--" ]]; then
  shift
fi

convex deploy \
  "$@" \
  --cmd "pnpm build:web" \
  --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL

pnpm check:convex-generated
