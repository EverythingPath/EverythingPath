#!/usr/bin/env bash
# usage: driver-argv.test.sh: checks driver-argv.sh, the only command a lock-free bounded.sh kind
# driver unit may run, on a scratch MAIN and ORCH: the two accepted shapes, then one pinned corpus of
# refused routes. Argument vectors (other scripts, interpreters, pnpm/node, shell payloads, extra or
# missing arguments, paths outside ORCH or MAIN, symlinks), code-naming variables, exported
# functions and a PATH other than the entry point's fixed DRIVER_PATH (each with a readable marker
# payload that would leave a file if it ran), and driver code that is not BASE's bytes (edits, edits
# hidden by assume-unchanged or skip-worktree, extra files, __pycache__, symlinks, untracked files).
# No unit and no driver runs. The entry points' own fixed PATH has its marker regressions in the
# ORCH candidate harness (fix-r3 report).
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/driver-argv.sh"
for name in "${DRIVER_REFUSED_ENV[@]}"; do unset "$name"; done
for name in $(compgen -e); do [[ $name == GIT_* || $name == LD_LIBRARY_PATH ]] && unset "$name"; done
# What an entry point's driver_fixed_path does (bounded-driver.sh); a system-only value keeps this test hermetic.
export DRIVER_PATH=/usr/bin:/bin PATH=/usr/bin:/bin
dir=$(realpath -e "$(mktemp -d "${TMPDIR:?}/driver-argv-test-XXXXXX")") || exit 1
trap 'rm -rf "$dir"' EXIT
main=$dir/main orch=$dir/orch marker=$dir/ran
mkdir -p "$main/scripts/orchestration" "$orch/run" "$dir/outside" "$dir/real" "$dir/.ep-tmp/bin" "$main/bin"
git -C "$main" init -q -b feature
git -C "$main" config user.name Fixture; git -C "$main" config user.email fixture@example.test
echo '# fixture driver' > "$main/scripts/orchestration/gate-run.py"
echo '# fixture module' > "$main/scripts/orchestration/gate_core.py"
cp "$here/driver-argv.sh" "$main/scripts/orchestration/driver-argv.sh"
echo 'bin/' > "$main/.gitignore"
git -C "$main" add . && git -C "$main" commit -qm base
base=$(git -C "$main" rev-parse HEAD)
spec=$orch/run/item-gate-spec-r1.json
printf '{"base": "%s"}\n' "$base" > "$spec"
cp "$spec" "$dir/outside/item-gate-spec-r1.json"; cp "$spec" "$dir/real/item-gate-spec-r1.json"
ln -s "$spec" "$orch/run/link-gate-spec-r1.json"
ln -s "$dir/real" "$orch/linked"
echo '{"title": "no base"}' > "$orch/run/nobase-gate-spec-r1.json"
printf '{"base": "%s"}\n' "$(printf '1%.0s' {1..40})" > "$orch/run/unknown-gate-spec-r1.json"
echo '{"base": ' > "$orch/run/broken-gate-spec-r1.json"
mkdir "$orch/run.json"
# A readable payload: sourced, executed or put first on PATH, it leaves the marker.
printf '#!/bin/sh\ntouch %s\n' "$marker" > "$dir/marker.sh"; chmod +x "$dir/marker.sh"
for tool in git python3 realpath find env sort; do cp "$dir/marker.sh" "$main/bin/$tool"; cp "$dir/marker.sh" "$dir/.ep-tmp/bin/$tool"; done
fail=0
check() { if [[ $2 == "$3" ]]; then echo "ok    $1"; else echo "FAIL  $1: want '$3', got '$2'"; fail=1; fi; }
tail_of() { local n=$1; shift; echo "${*: -$n}"; }
# accepts <name> <expected command tail> <args...>; refuses <name> <args...> (and the marker stays absent)
accepts() {
  driver_command "$main" "$orch" "${@:3}" 2> /dev/null
  check "$1" "$?:${driver_cmd[0]:-} ${driver_cmd[1]:-}:$(tail_of "$(wc -w <<< "$2")" "${driver_cmd[@]}")" "0:/usr/bin/env -i:$2"
}
refuses() {
  driver_command "$main" "$orch" "${@:2}" 2> /dev/null
  check "refuses $1" "$?:${driver_cmd[*]}:$([[ -e $marker ]] && echo ran)" "64::"
  rm -f "$marker"
}
driver=$main/scripts/orchestration/gate-run.py

accepts 'a spec runs the committed driver' "/usr/bin/python3 -I -B $driver $spec" "$spec"
accepts '--stop with a spec' "/usr/bin/python3 -I -B $driver --stop $spec" --stop "$spec"
export BOUNDED_WAIT=1
driver_command "$main" "$orch" "$spec" 2> /dev/null
unset BOUNDED_WAIT
check 'the driver keeps the session PATH and nothing else of the environment' \
  "$(printf '%s\n' "${driver_cmd[@]}" | grep -c '^PATH=')$(printf '%s\n' "${driver_cmd[@]}" | grep -c '^BOUNDED_WAIT=')" "10"

# The pinned corpus of refused argument vectors: every route into the unit's command.
corpus=(
  'no argument|'
  'only --stop|--stop'
  'an extra argument|SPEC extra'
  'a second spec|SPEC SPEC'
  '--stop with an extra argument|--stop SPEC extra'
  'a trailing --stop|SPEC --stop'
  'another option|--orch SPEC'
  'another script|/usr/bin/python3 -B '"$main"'/scripts/orchestration/gate-operator.py SPEC'
  'the driver path as the argument|'"$driver"
  'the old documented form|python3 -B '"$driver"' SPEC'
  'a driver outside MAIN|/usr/bin/python3 '"$dir"'/outside/gate-run.py SPEC'
  'the marker payload|'"$dir"'/marker.sh'
  'pnpm|pnpm test'
  'pnpm with a json-looking argument|pnpm SPEC'
  'node|node '"$main"'/x.js'
  'bash -c|bash -c '"$dir"'/marker.sh'
  'a relative spec|run/item-gate-spec-r1.json'
  'a non-json path|'"$orch"'/run/item'
  'a spec outside ORCH|'"$dir"'/outside/item-gate-spec-r1.json'
  'a missing spec|'"$orch"'/run/missing-gate-spec-r1.json'
  'a dot-dot spec|'"$orch"'/run/../run/item-gate-spec-r1.json'
  'a symlinked spec|'"$orch"'/run/link-gate-spec-r1.json'
  'a spec through a symlinked directory|'"$orch"'/linked/item-gate-spec-r1.json'
  'a directory|'"$orch"'/run.json'
  'a spec without base|'"$orch"'/run/nobase-gate-spec-r1.json'
  'a base that is not a commit|'"$orch"'/run/unknown-gate-spec-r1.json'
  'a malformed spec|'"$orch"'/run/broken-gate-spec-r1.json'
)
for row in "${corpus[@]}"; do
  name=${row%%|*}; read -r -a argv <<< "${row#*|}"
  argv=("${argv[@]//SPEC/$spec}")
  refuses "$name" "${argv[@]}"
done
# Shell payloads arrive as single arguments; none is ever split or evaluated.
for payload in "$spec; $dir/marker.sh" "\$($dir/marker.sh).json" "$spec && $dir/marker.sh" "\`$dir/marker.sh\`.json" "$orch/run/a b.json" "$orch/run/*.json"; do
  refuses "the shell payload <$payload>" "$payload"
done
# Every variable that names code or changes what loads, set to the readable marker payload, in a fresh
# `bash -p` as both entry points run (BASH_ENV, ENV, SHELLOPTS, BASHOPTS and exported functions are
# then ignored at startup; the guard still refuses the variables it lists).
refuses_env() {
  /usr/bin/env "$1" /bin/bash -p -c '. "$1"; driver_command "$2" "$3" "$4"' _ "$here/driver-argv.sh" "$main" "$orch" "$spec" 2> /dev/null
  check "refuses $1 (as $2)" "$?:$([[ -e $marker ]] && echo ran)" "${3:-64}:"
  rm -f "$marker"
}
for name in "${DRIVER_REFUSED_ENV[@]}"; do
  refuses_env "$name=$dir/marker.sh" 'a readable marker payload'
done
# Ambient session variables that name code are neutralized: accepted, never run, never passed on.
for name in GIT_DIR GIT_EXEC_PATH GIT_CONFIG_PARAMETERS GIT_CONFIG_GLOBAL GIT_SSH_COMMAND GIT_EDITOR LD_LIBRARY_PATH; do
  refuses_env "$name=$dir/marker.sh" 'neutralized, never run' 0
done
export GIT_EXEC_PATH=$dir LD_LIBRARY_PATH=$dir GIT_EDITOR=$dir/marker.sh
driver_command "$main" "$orch" "$spec" 2> /dev/null
check 'GIT_* and LD_LIBRARY_PATH are unset and not passed to the driver' \
  "$?:${GIT_EXEC_PATH-unset}:${LD_LIBRARY_PATH-unset}:${GIT_EDITOR-unset}:$(printf '%s\n' "${driver_cmd[@]}" | grep -c '^\(GIT_\|LD_\)')" "0:unset:unset:unset:0"
refuses_env "BASH_FUNC_git%%=() { $dir/marker.sh; }" 'an exported function, ignored by bash -p' 0
refuses_env "SHELLOPTS=xtrace" 'a startup option, ignored by bash -p' 0
git() { "$dir/marker.sh"; }; export -f git
refuses 'an exported shell function (a caller without -p)' "$spec"
unset -f git
# PATH is fixed by the entry point (bounded-driver.sh); the guard only refuses a PATH that is not
# that fixed value, so an entry point that forgot to fix it never runs a driver. The marker tools
# earlier on such a PATH never run: every external command here is absolute or under env -i.
for entry in "$main/bin" "$dir/.ep-tmp/bin" . ''; do
  saved=$PATH; PATH="$entry:$saved"
  refuses "a PATH that is not DRIVER_PATH ('$entry' first)" "$spec"
  PATH=$saved
done
saved=$DRIVER_PATH; unset DRIVER_PATH
refuses 'no DRIVER_PATH at all' "$spec"
export DRIVER_PATH=$saved
# The driver code: BASE's entries with BASE's bytes, whatever the index says.
restore() { git -C "$main" update-index -q --no-assume-unchanged --no-skip-worktree -- "$1"; git -C "$main" checkout -q -- "$1"; }
for file in gate-run.py gate_core.py driver-argv.sh; do
  echo "\"$dir/marker.sh\"" >> "$main/scripts/orchestration/$file"
  refuses "an edited $file" "$spec"
  for flag in --assume-unchanged --skip-worktree; do
    git -C "$main" update-index "$flag" -- "scripts/orchestration/$file"
    check "git status hides the edit under $flag" "$(git -C "$main" status --porcelain -- scripts/orchestration)" ""
    refuses "an edited $file hidden by $flag" "$spec"
    git -C "$main" update-index "--no-${flag#--}" -- "scripts/orchestration/$file"
  done
  restore "scripts/orchestration/$file"
done
cp "$dir/marker.sh" "$main/scripts/orchestration/sitecustomize.py"
refuses 'an untracked file beside the driver' "$spec"
rm "$main/scripts/orchestration/sitecustomize.py"
mkdir "$main/scripts/orchestration/__pycache__"; cp "$dir/marker.sh" "$main/scripts/orchestration/__pycache__/gate_core.cpython-314.pyc"
refuses 'a __pycache__ beside the driver' "$spec"
rm -r "$main/scripts/orchestration/__pycache__"
mv "$driver" "$dir/real/gate-run.py"; ln -s "$dir/real/gate-run.py" "$driver"
refuses 'a symlinked driver' "$spec"
rm "$driver"; mv "$dir/real/gate-run.py" "$driver"
rm "$driver"
refuses 'a missing driver' "$spec"
git -C "$main" checkout -q -- scripts/orchestration/gate-run.py
driver_command "$dir/main/../main" "$orch" "$spec" 2> /dev/null; check 'refuses a non-canonical MAIN' "$?" 64
accepts 'the restored committed driver runs again' "/usr/bin/python3 -I -B $driver $spec" "$spec"
exit $fail
