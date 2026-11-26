#!/usr/bin/env bash
# usage: env-guard.test.sh — every guard that refuses a checkout holding env
# files refuses the whole pinned corpus below. The refused set: each entry at
# the top of the checkout (file, directory or symlink, dangling or not) whose
# name starts with .env, other than .env.example. The guards: cur-prep.sh
# and triage-failures.sh (a commit's clean checkout); both go through
# env_files in paths.sh.
# Each corpus entry is refused while `ls` pads its listing with over 1 MB of
# .env.example lines, and a real listing of 3,000 long .env names is refused:
# a guard that pipes the listing into grep -q under pipefail fails open there,
# since the producer's SIGPIPE (141) reads as "no env files".
# Also checks env_files and has_env_files directly: each corpus entry by name,
# the allowed names, and a directory that can't be listed (refused).
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "$here/prep-test-lib.sh"
d=$(mktemp -d "${TMPDIR:?}/env-guard-test-XXXXXX") || exit 1
trap 'chmod -R u+rwx "$d" 2>/dev/null; rm -rf "$d"' EXIT
(prep_fixture "$d") > /dev/null 2>&1 || { echo "FAIL  fixture"; exit 1; }
export MAIN=$d/main EP_ORCH=$d/orch
export GIT_AUTHOR_NAME=Test GIT_AUTHOR_EMAIL=test@example.test GIT_COMMITTER_NAME=Test GIT_COMMITTER_EMAIL=test@example.test
. "$here/paths.sh"
fail=0
check() { if "${@:2}"; then echo "ok    $1"; else echo "FAIL  $1"; fail=1; fi; }

corpus=(file:.env file:.env.local file:.env.development.local file:.env.production file:.env.test
  file:.env.example.local 'file:.env.example~' file:.envrc 'file:.env copy' $'file:.env\nsplit'
  dir:.env dir:.env.local link:.env link:.env.production.local)
allowed=(.env.example env example.env x.env.local .ENV .en)

cat > "$d/bin/gh" << 'STUB'
#!/usr/bin/env bash
echo "Issue $3"
STUB
# No guarded site starts a worker (agent_launch_guard.py); stubs keep any regression off a real model.
for stub in codex claude; do printf '#!/usr/bin/env bash\nexit 1\n' > "$d/bin/$stub"; done
chmod +x "$d/bin/"*
# An ls that prints the real listing, then 1.3 MB of .env.example lines.
mkdir "$d/lsbin"
printf '.env.example\n%.0s' {1..100000} > "$d/pad"
cat > "$d/lsbin/ls" << STUB
#!/usr/bin/env bash
$(command -v ls) "\$@" || exit
cat "$d/pad"
STUB
chmod +x "$d/lsbin/ls"
git -C "$MAIN" worktree add -q -b triage "$d/ep-triage" feature/pf1-character-builder

# add <dir> <kind:name>, remove <dir> <kind:name>: one corpus entry.
add() {
  local name=${2#*:}
  case ${2%%:*} in
    file) echo secret=1 > "$1/$name" ;;
    dir) mkdir "$1/$name" && echo secret=1 > "$1/$name/x" ;;
    link) ln -s /nonexistent/secret "$1/$name" ;;
  esac
}
remove() { rm -rf -- "${1:?}/${2#*:}"; }
# refuses <site>: runs the guard with the padding ls first on PATH; true when
# it exits 1 with its env refusal.
refuses() {
  local pattern status
  (
    export PATH=$d/lsbin:$d/bin:$PATH
    case $1 in
      cur-prep) bash "$here/cur-prep.sh" 901 "$EP_ORCH/briefs/cur-901-msg.txt" ;;
      triage) bash "$here/triage-failures.sh" "$d/ep-triage" ;;
    esac
  ) > "$d/out" 2>&1
  status=$?
  case $1 in
    cur-prep) pattern='env file present; refusing' ;;
    triage) pattern='refusing: [0-9a-f]\{40\} commits env files' ;;
  esac
  (( status == 1 )) && grep -q -- "$pattern" "$d/out"
}
# refuses_entry <site> <kind:name>: the entry in the worktree, or for triage
# committed at its HEAD.
refuses_entry() {
  local wt=$d/ep-cur-901 ok=0
  [[ $1 == triage ]] && wt=$d/ep-triage
  add "$wt" "$2"
  if [[ $1 == triage ]]; then
    git -C "$wt" add -f -A && git -C "$wt" commit -qm entry
    refuses triage || ok=1
    git -C "$wt" reset -q --hard HEAD^
  else
    refuses "$1" || ok=1
    remove "$wt" "$2"
  fi
  return "$ok"
}
long=$(printf 'x%.0s' {1..180})
pad_names() { local i; for ((i = 0; i < 3000; i++)); do echo secret=1 > "$1/.env.pad-$i-$long"; done; }
refuses_long_listing() {
  local wt=$d/ep-cur-901 ok=0
  [[ $1 == triage ]] && wt=$d/ep-triage
  pad_names "$wt"
  if [[ $1 == triage ]]; then
    git -C "$wt" add -f -A && git -C "$wt" commit -qm padding
    refuses triage || ok=1
    git -C "$wt" reset -q --hard HEAD^
  else
    refuses "$1" || ok=1
    rm -f "$wt"/.env.pad-*
  fi
  return "$ok"
}

# label <kind:name>: "kind name", a newline shown as \n.
label() { local name=${1#*:}; printf '%s %s' "${1%%:*}" "${name//$'\n'/\\n}"; }

for site in cur-prep triage; do
  for entry in "${corpus[@]}"; do
    check "$site refuses $(label "$entry") early in a listing over 1 MB" refuses_entry "$site" "$entry"
  done
  check "$site refuses 3,000 long .env names" refuses_long_listing "$site"
done

# env_files and has_env_files directly.
h=$d/direct; mkdir "$h"
for entry in "${corpus[@]}"; do
  add "$h" "$entry"
  check "env_files names $(label "$entry")" test "$(env_files "$h")" == "${entry#*:}"
  remove "$h" "$entry"
done
for name in "${allowed[@]}"; do echo x > "$h/$name"; done
check "env_files allows ${allowed[*]}" test -z "$(env_files "$h")"
check "has_env_files is false for the allowed names" test "$(has_env_files "$h"; echo $?)" == 1
check "has_env_files refuses a missing directory" has_env_files "$d/missing"
chmod 000 "$h"
check "has_env_files refuses a directory it can't list" has_env_files "$h"
chmod 755 "$h"
exit "$fail"
