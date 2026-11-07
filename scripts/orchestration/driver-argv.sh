# shellcheck shell=bash
# The one command a bounded.sh kind driver unit may run (root, 2026-11-05). A driver unit takes
# no lock and reserves no memory, so it must run nothing but the script gate operator, whose heavy
# steps reserve and lock for themselves. $EP_ORCH/bounded-driver.sh (driver_preflight) verifies
# this file's bytes against its blob at the spec's BASE before sourcing it, from both
# $EP_ORCH/bounded.sh (before any state or MAIN library) and run-bounded-driver.sh (before the
# sampler loads admission.sh).
#
# driver_command <main> <orch> <args...>: for exactly `<spec>` or `--stop <spec>`, sets driver_cmd to
#   /usr/bin/env -i <session variables> /usr/bin/python3 -I -B <main>/scripts/orchestration/gate-run.py [--stop] <spec>
# and returns 0. It refuses with a reason on stderr and 64 for anything else:
# - an explicit override that names code or changes what loads (DRIVER_REFUSED_ENV, any exported
#   shell function); the ambient session variables GIT_* and LD_LIBRARY_PATH are unset instead
#   (driver_environment); a PATH other than the entry point's fixed DRIVER_PATH (bounded-driver.sh
#   sets it before anything runs; the caller's PATH is never consulted, so it is not validated);
# - any other argument shape (no argument, extra arguments, another script, an interpreter, pnpm,
#   node, a shell payload, an option other than a leading --stop);
# - a spec that is not an absolute path of plain characters ending in .json, not a regular file,
#   reached through a symlink anywhere in its path, outside <orch>, or without a full `base` SHA
#   that is a commit in <main>;
# - a scripts/orchestration whose entries are not exactly the BASE tree's, or whose bytes are not
#   BASE's blobs (git hash-object --no-filters, so index flags such as assume-unchanged or
#   skip-worktree change nothing; extra files, __pycache__ and symlinks refuse); this binds the
#   driver, every module it imports, this guard and the admission and outcome libraries;
# - a missing interpreter.
# Every git and Python call here runs under `env -i` with absolute tools, so no inherited variable
# or function reaches them; the driver gets the fixed PATH and the session variables below only.
DRIVER_PYTHON=/usr/bin/python3
DRIVER_GIT=/usr/bin/git
DRIVER_SCRIPT=scripts/orchestration/gate-run.py
# Bash itself reads BASH_ENV, ENV, SHELLOPTS, BASHOPTS and exported functions at startup, before any
# line runs: both entry points therefore run as `bash -p`, which ignores all of them, and BASH_ENV and
# ENV are still refused here so a non -p caller cannot pass them on.
DRIVER_REFUSED_ENV=(BOUNDED_ADMISSION_LIB BOUNDED_OUTCOME_LIB BOUNDED_SPAWN BOUNDED_CLASS BOUNDED_LOCKS
  BOUNDED_GATE_MEMORY_MAX ADMISSION_TABLE BASH_ENV ENV LD_PRELOAD LD_AUDIT
  PYTHONPATH PYTHONHOME PYTHONSTARTUP PYTHONUSERBASE NODE_OPTIONS NODE_PATH)
# The session variables the driver keeps (gate-run.py KEEP, and BOUNDED_ID for its own unit).
DRIVER_KEEP_ENV=(HOME USER LOGNAME SHELL TMPDIR XDG_RUNTIME_DIR DBUS_SESSION_BUS_ADDRESS BOUNDED_ID PATH)

driver_refuse() {
  echo "driver: $*" >&2
  return 64
}

driver_clean() {
  /usr/bin/env -i PATH=/usr/bin:/bin "$@"
}

# driver_environment <main> <orch>: refuses code-naming variables, exported functions and a PATH that
# is not the fixed DRIVER_PATH, with shell builtins only (no external command has run yet).
driver_environment() {
  local main=$1 orch=$2 name refused exported=()
  mapfile -t exported < <(compgen -e)
  for name in "${exported[@]}"; do
    # Ambient session variables that name code are neutralized, not refused: unset here before any
    # external command, and never passed on (every git, Python and the driver run under env -i).
    if [[ $name == GIT_* || $name == LD_LIBRARY_PATH ]]; then unset "$name"; continue; fi
    for refused in "${DRIVER_REFUSED_ENV[@]}"; do
      [[ $name != "$refused" ]] || { driver_refuse "$name names code or changes what a driver unit loads; unset it"; return; }
    done
  done
  [[ -z $(declare -Fx) ]] || { driver_refuse "exported shell functions can shadow the tools a driver unit runs"; return; }
  # PATH is fixed by the entry point, never validated: the caller's PATH is ignored.
  [[ -n ${DRIVER_PATH:-} && ${PATH:-} == "$DRIVER_PATH" ]] \
    || { driver_refuse "PATH is not the entry point's fixed DRIVER_PATH (bounded-driver.sh driver_fixed_path)"; return; }
}

# driver_base <main> <spec>: prints the spec's full `base` SHA when it is a commit in <main>.
driver_base() {
  local base
  base=$(driver_clean "$DRIVER_PYTHON" -I -S -c 'import json, sys; print(json.load(open(sys.argv[1]))["base"])' "$2" 2> /dev/null) \
    && [[ $base =~ ^[0-9a-f]{40}$ ]] && driver_clean "$DRIVER_GIT" -C "$1" cat-file -e "$base^{commit}" 2> /dev/null \
    || { driver_refuse "the spec has no full base SHA that is a commit in $1"; return; }
  echo "$base"
}

# driver_code <main> <base>: scripts/orchestration is exactly BASE's entries with BASE's bytes.
driver_code() {
  local main=$1 base=$2 expected actual paths hashes blobs
  expected=$(driver_clean "$DRIVER_GIT" -C "$main" ls-tree -r --full-tree "$base" -- scripts/orchestration 2> /dev/null) \
    && [[ -n $expected ]] || { driver_refuse "BASE has no scripts/orchestration"; return; }
  grep -qvE '^100(644|755) blob ' <<< "$expected" && { driver_refuse "BASE scripts/orchestration has a non-regular entry"; return; }
  paths=$(cut -f2 <<< "$expected")
  actual=$(cd "$main" && /usr/bin/find scripts/orchestration -mindepth 1 | LC_ALL=C sort)
  [[ $actual == "$(LC_ALL=C sort <<< "$paths")" ]] \
    || { driver_refuse "scripts/orchestration entries differ from BASE: $(diff <(LC_ALL=C sort <<< "$paths") <(echo "$actual") | grep '^[<>]' | head -3 | tr '\n' ' ')"; return; }
  while IFS= read -r path; do
    [[ -f $main/$path && ! -L $main/$path ]] || { driver_refuse "not a regular file: $path"; return; }
  done <<< "$paths"
  blobs=$(cut -d' ' -f3 <<< "$expected" | cut -f1)
  hashes=$(cd "$main" && driver_clean "$DRIVER_GIT" hash-object --no-filters --stdin-paths <<< "$paths" 2> /dev/null) \
    || { driver_refuse "git hash-object failed in $main"; return; }
  [[ $hashes == "$blobs" ]] || { driver_refuse "scripts/orchestration bytes are not BASE's blobs: $(paste <(echo "$paths") <(echo "$blobs") <(echo "$hashes") | awk '$2 != $3 {print $1}' | head -3 | tr '\n' ' ')"; return; }
}

driver_command() {
  local main=$1 orch=$2 stop=() spec driver base name keep=()
  shift 2
  driver_cmd=()
  driver_environment "$main" "$orch" || return  # before any external command runs; PATH is DRIVER_PATH
  [[ $(/usr/bin/realpath -e -- "$main" 2> /dev/null) == "$main" && $(/usr/bin/realpath -e -- "$orch" 2> /dev/null) == "$orch" ]] \
    || { driver_refuse "MAIN and ORCH must be canonical existing paths: $main $orch"; return; }
  if [[ ${1:-} == --stop ]]; then stop=(--stop); shift; fi
  (( $# == 1 )) || { driver_refuse "expected <spec.json> or --stop <spec.json>, got ${#} argument(s): $*"; return; }
  spec=$1
  [[ $spec =~ ^/[A-Za-z0-9._/-]+\.json$ && $spec != *..* ]] \
    || { driver_refuse "the spec must be an absolute .json path of plain characters: $spec"; return; }
  [[ -f $spec && ! -L $spec && $(/usr/bin/realpath -e -- "$spec" 2> /dev/null) == "$spec" ]] \
    || { driver_refuse "the spec must be a regular file reached without symlinks: $spec"; return; }
  [[ $spec == "$orch"/* ]] || { driver_refuse "the spec must live under $orch: $spec"; return; }
  base=$(driver_base "$main" "$spec") || return
  driver_code "$main" "$base" || return
  driver=$main/$DRIVER_SCRIPT
  [[ -f $driver && ! -L $driver ]] || { driver_refuse "the driver must be the regular file $driver"; return; }
  [[ -x $DRIVER_PYTHON ]] || { driver_refuse "no interpreter at $DRIVER_PYTHON"; return; }
  for name in "${DRIVER_KEEP_ENV[@]}"; do
    [[ -n ${!name+set} ]] && keep+=("$name=${!name}")
  done
  driver_cmd=(/usr/bin/env -i "${keep[@]}" "$DRIVER_PYTHON" -I -B "$driver" "${stop[@]}" "$spec")
}
