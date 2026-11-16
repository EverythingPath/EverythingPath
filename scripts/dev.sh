#!/usr/bin/env bash

set -u

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required. Install it, then run this command again." >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Dependencies are missing. Run 'pnpm install' first." >&2
  exit 1
fi

child_pids=()
stopping=false

stop_services() {
  if [[ "$stopping" == true ]]; then
    return
  fi

  stopping=true
  trap - INT TERM EXIT

  for pid in "${child_pids[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done

  for pid in "${child_pids[@]}"; do
    wait "$pid" 2>/dev/null || true
  done
}

handle_signal() {
  stop_services
  exit 130
}

trap handle_signal INT TERM
trap stop_services EXIT

echo "Starting Convex and Next.js..."
pnpm run dev:convex &
child_pids+=("$!")

pnpm run dev:web &
child_pids+=("$!")

exit_code=0
wait -n "${child_pids[@]}" || exit_code=$?

if [[ "$exit_code" -ne 0 ]]; then
  echo "A development service exited with status $exit_code; stopping the others." >&2
else
  echo "A development service stopped; stopping the others."
fi

exit "$exit_code"
