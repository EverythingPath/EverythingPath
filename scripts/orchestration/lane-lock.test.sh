#!/usr/bin/env bash
# The light landing lane's read lock (lane-lock.sh) and its window in triage-failures.sh: temporary
# repositories, stub pnpm; no real suite runs.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
root=$(mktemp -d "${TMPDIR:?}/lane-lock-test-XXXXXX") || exit 1
trap 'chmod -R u+rw "$root" 2>/dev/null; rm -rf "$root"' EXIT
fail=0
check() { if [[ $2 == "$3" ]]; then echo "ok    $1"; else echo "FAIL  $1: want '$3', got '$2'"; fail=1; fi; }
commit() { git -C "$1" add -A && git -C "$1" -c user.name=Test -c user.email=test@example.test commit -qm "$2"; }

r=$root/repo
mkdir -p "$r/docs/agents" "$r/.claude" "$r/src"
printf '# Agent Guidance\n' > "$r/AGENTS.md"
printf '# Notes\n' > "$r/docs/agents/notes.md"
printf '{}\n' > "$r/.claude/settings.json"
printf 'node_modules/\n' > "$r/.gitignore"
printf '# Fixture\n' > "$r/README.md"
printf 'export const a = 1;\n' > "$r/src/a.ts"
# A shell script and a node script that spawns cat: child processes no in-process guard sees.
printf '#!/usr/bin/env bash\ncat docs/agents/notes.md\n' > "$r/src/reader.sh"
printf "import { execFileSync } from 'node:child_process';\nprocess.stdout.write(execFileSync('cat', [['AGENTS', 'md'].join('.')], { encoding: 'utf8' }));\n" > "$r/src/reader.mjs"
git init -q -b main "$r" && commit "$r" base
# Files older than the index, as in triage's checkout, where pnpm install runs between checkout and lock.
find "$r" -path "$r/.git" -prune -o -type f -exec touch -d '-1 minute' {} +
modes() { (cd "$r" && stat -c '%a %n' AGENTS.md docs/agents/notes.md .claude/settings.json .gitignore README.md | paste -sd ' '); }
before=$(modes)
lock() { local name=$1; shift; (cd "$r" && bash "$here/lane-lock.sh" "$r" "$root/$name.json" "$@") > "$root/$name.out" 2>&1; }

lock cat cat AGENTS.md; status=$?
check "cat of a locked file fails and the modes come back" "$((status != 0)) $(grep -c -m1 'Permission denied' "$root/cat.out") $(modes)" "1 1 $before"
lock node node -e "process.stdout.write(require('node:fs').readFileSync(['AGENTS', 'md'].join('.'), 'utf8'))"; status=$?
check "a node child building the path at run time fails" "$((status != 0)) $(grep -c -m1 'EACCES' "$root/node.out")" "1 1"
lock spawned node src/reader.mjs; status=$?
check "a node script spawning cat fails" "$((status != 0)) $(grep -c -m1 'Permission denied' "$root/spawned.out")" "1 1"
lock shell bash src/reader.sh; status=$?
check "a shell script reading a locked doc fails" "$((status != 0)) $(grep -c -m1 'Permission denied' "$root/shell.out")" "1 1"
lock open bash -c 'cat README.md .gitignore src/a.ts > /dev/null && stat -c %a AGENTS.md docs/agents/notes.md .claude/settings.json | paste -sd " "'; status=$?
check "other files and .gitignore stay readable while the lane files are 000" "$status $(cat "$root/open.out") $(modes)" "0 0 0 0 $before"
check "the record names the locked files, the command and the restored modes" \
  "$(python3 -c 'import json,sys; v=json.load(open(sys.argv[1])); print(v["kind"], v["exitCode"], ",".join(v["files"]), v["command"][0], len(v["restoredModesSha256"]))' "$root/open.json")" \
  "lane-lock-v1 0 .claude/settings.json,AGENTS.md,docs/agents/notes.md bash 64"
lock git bash -c 'git config core.trustctime; git status --porcelain; echo "status $?"'; status=$?
check "git in the window compares stat data without hashing a locked file, by environment only" \
  "$status $(paste -sd ' ' "$root/git.out") $(git -C "$r" config --get core.trustctime || echo unset)" "0 false status 0 unset"
lock failed false; status=$?
check "a failing command keeps its status and the modes come back" "$status $(modes)" "1 $before"
lock again true; lock again true; status=$?
check "an existing record refuses before locking" "$status $(grep -c 'evidence must be' "$root/again.out") $(modes)" "64 1 $before"
lock removed rm docs/agents/notes.md; status=$?
check "a locked file the command removed is an unrestored mode (70)" "$status $(grep -c 'lane-lock: docs/agents/notes.md restored' "$root/removed.out")" "70 1"
git -C "$r" checkout -q -- docs/agents/notes.md; chmod 644 "$r/docs/agents/notes.md"
(cd "$r" && exec bash "$here/lane-lock.sh" "$r" - sleep 30) > "$root/term.out" 2>&1 &
pid=$!
for _ in $(seq 100); do [[ $(stat -c %a "$r/AGENTS.md") == 0 ]] && break; sleep 0.05; done
during=$(stat -c %a "$r/AGENTS.md")
kill -TERM "$pid"; wait "$pid"; status=$?
check "TERM during the window restores the modes" "$during $status $(modes)" "0 143 $before"

# Descendants: the whole locked process group is gone before the modes come back. A grandchild that
# ignores TERM logs AGENTS.md's mode every 50 ms; it may only ever see 0, and must be dead afterwards.
cat > "$root/grandchild.sh" <<'SCRIPT'
#!/usr/bin/env bash
trap '' TERM
echo $$ > "$2"
while :; do stat -c %a AGENTS.md >> "$1"; sleep 0.05; done
SCRIPT
printf '#!/usr/bin/env bash\nbash "%s" "$1" "$2" &\nsleep 0.3\n[[ $3 == exit ]] || wait\n' "$root/grandchild.sh" > "$root/parent.sh"
trap 'for f in "$root"/*.pid; do [[ -f $f ]] && kill -9 "$(cat "$f")" 2>/dev/null; done; chmod -R u+rw "$root" 2>/dev/null; rm -rf "$root"' EXIT
gone() { kill -0 "$(cat "$1")" 2>/dev/null && echo alive || echo gone; }
LANE_LOCK_GRACE=1 lock orphan bash "$root/parent.sh" "$root/orphan.modes" "$root/orphan.pid" exit; status=$?
sleep 0.3
check "a grandchild left running is killed before the modes come back" \
  "$status $(gone "$root/orphan.pid") $(sort -u "$root/orphan.modes" | paste -sd ' ') $(modes)" "0 gone 0 $before"
(cd "$r" && LANE_LOCK_GRACE=1 exec bash "$here/lane-lock.sh" "$r" - bash "$root/parent.sh" "$root/term2.modes" "$root/term2.pid" wait) > "$root/term2.out" 2>&1 &
pid=$!
for _ in $(seq 100); do [[ -s $root/term2.pid ]] && break; sleep 0.05; done
kill -TERM "$pid"; wait "$pid"; status=$?
sleep 0.3
check "TERM kills the whole group, a TERM-ignoring grandchild too, before the modes come back" \
  "$status $(gone "$root/term2.pid") $(sort -u "$root/term2.modes" | paste -sd ' ') $(modes)" "143 gone 0 $before"

# HUP and QUIT take the same path: the whole group is gone before the modes come back. A background
# job of this script starts with QUIT ignored, which bash cannot trap, so its default is restored.
for signal in HUP QUIT; do
  case $signal in HUP) want=129 ;; QUIT) want=131 ;; esac
  (cd "$r" && LANE_LOCK_GRACE=1 exec env --default-signal=QUIT bash "$here/lane-lock.sh" "$r" - bash "$root/parent.sh" "$root/$signal.modes" "$root/$signal.pid" wait) > "$root/$signal.out" 2>&1 &
  pid=$!
  for _ in $(seq 100); do [[ -s $root/$signal.pid ]] && break; sleep 0.05; done
  kill -"$signal" "$pid"
  for _ in $(seq 100); do kill -0 "$pid" 2>/dev/null || break; sleep 0.1; done
  if kill -0 "$pid" 2>/dev/null; then kill -TERM "$pid"; wait "$pid"; status="ignored-$signal"; else wait "$pid"; status=$?; fi
  sleep 0.3
  check "$signal kills the whole group before the modes come back" \
    "$status $(gone "$root/$signal.pid") $(sort -u "$root/$signal.modes" | paste -sd ' ') $(modes)" "$want gone 0 $before"
done

# The launch window: a signal between starting the command and recording its group must not restore
# while the command runs. A test-only DEBUG hook (BASH_ENV) holds the lock at `child=$!`; a HUP or
# TERM arrives there; the command keeps reading AGENTS.md and must never see its restored content.
printf '%s\n' 'trap '\''[[ $BASH_COMMAND == "child=\$!" ]] && { : > "$LANE_LOCK_TEST_WINDOW"; sleep 0.5; }'\'' DEBUG' > "$root/window-hook.sh"
printf '#!/usr/bin/env bash\nfor _ in $(seq 40); do sleep 0.05; cat AGENTS.md >> "$1" 2>/dev/null || echo denied >> "$1"; done\n' > "$root/reader-loop.sh"
for attempt in 1 2 3 4; do
  case $attempt in 1|3) signal=HUP want=129 ;; *) signal=TERM want=143 ;; esac
  rm -f "$root/window"
  (cd "$r" && BASH_ENV="$root/window-hook.sh" LANE_LOCK_TEST_WINDOW="$root/window" LANE_LOCK_GRACE=1 \
    exec bash "$here/lane-lock.sh" "$r" - bash "$root/reader-loop.sh" "$root/window-$attempt.log") > "$root/window-$attempt.out" 2>&1 &
  pid=$!
  for _ in $(seq 100); do [[ -e $root/window ]] && break; sleep 0.02; done
  kill -"$signal" "$pid"; wait "$pid"; status=$?
  sleep 2.5
  check "$signal inside the launch window (attempt $attempt) never lets the command read restored content" \
    "$status $(grep -c 'Agent Guidance' "$root/window-$attempt.log") $(modes)" "$want 0 $before"
done

# The active record (<record>.active): written before locking (files, modes, a lock id the command
# carries as LANE_LOCK_ID), given the group once it is known, removed after a clean restore. After a
# SIGKILL of the lock it remains, and operations.md's recovery (kill the group, restore the modes
# from the record) works.
cat > "$root/active-probe.sh" <<'SCRIPT'
#!/usr/bin/env bash
for _ in $(seq 100); do grep -q '"group": [0-9]' "$1" && break; sleep 0.02; done
cp "$1" "$2"; printf '%s %s\n' "$$" "$LANE_LOCK_ID" > "$3"
SCRIPT
lock active bash "$root/active-probe.sh" "$root/active.json.active" "$root/active.snapshot" "$root/active.self"; status=$?
check "the active record names the lock id the command carries, its group and the files; a clean restore removes it" \
  "$status $(python3 -c 'import json,sys; v=json.load(open(sys.argv[1])); pid, lock = open(sys.argv[2]).read().split(); print(v["kind"], v["group"] == int(pid), v["lockId"] == lock, ",".join(f["path"] for f in v["files"]))' "$root/active.snapshot" "$root/active.self") $([[ -e $root/active.json.active ]] && echo kept || echo removed)" \
  "0 lane-lock-active-v1 True True .claude/settings.json,AGENTS.md,docs/agents/notes.md removed"
record() { python3 -c 'import json,sys; v=json.load(open(sys.argv[1])); print(v["group"] or "-", v["lockId"])' "$root/killed.json.active" 2>/dev/null; }
(cd "$r" && exec bash "$here/lane-lock.sh" "$r" "$root/killed.json" sleep 30) > "$root/killed.out" 2>&1 &
pid=$!
group=- id=
for _ in $(seq 100); do read -r group id < <(record) && [[ $group != - ]] && break; sleep 0.05; done
echo "$group" > "$root/killed.pid"
kill -KILL "$pid"; wait "$pid" 2>/dev/null
locked=$(stat -c %a "$r/AGENTS.md")
marked=$(grep -lz "LANE_LOCK_ID=$id" /proc/[0-9]*/environ 2>/dev/null | wc -l)
kill -KILL -- "-$group" 2>/dev/null
for _ in $(seq 100); do kill -0 -- "-$group" 2>/dev/null || break; sleep 0.05; done
python3 -c 'import json,sys; [print(f["mode"], f["path"]) for f in json.load(open(sys.argv[1]))["files"]]' "$root/killed.json.active" |
  while read -r mode path; do chmod "$mode" "$r/$path"; done
check "after a SIGKILL of the lock, its record finds the group (by id and LANE_LOCK_ID) and restores the modes" \
  "$locked $((marked > 0)) $(kill -0 -- "-$group" 2>/dev/null && echo alive || echo gone) $(modes)" "0 1 gone $before"

# The window in triage-failures.sh: exactly the Vitest processes in its clean checkout.
t=$root/triage
mkdir -p "$t/bin" "$t/orch/logs"
git init -q -b feature/pf1-character-builder "$t/main"
printf '# Agent Guidance\n' > "$t/main/AGENTS.md"
mkdir -p "$t/main/docs/agents"; printf '# Notes\n' > "$t/main/docs/agents/notes.md"
echo sample > "$t/main/sample.test.ts"
commit "$t/main" base
cat > "$t/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
where=gate; [[ $PWD == "$MAIN" ]] && where=main
[[ -r AGENTS.md && -r docs/agents/notes.md ]] && seen=readable || seen=locked
echo "$1 $where $seen" >> "$EP_ORCH/pnpm.log"
[[ $1 != install ]] || exit 0
for arg in "$@"; do case $arg in --outputFile.json=*|--outputFile=*) out=${arg#*=} ;; esac; done
if [[ $1 == test ]]; then
  printf '{"success":false,"numFailedTests":1,"numFailedTestSuites":1,"testResults":[{"name":"%s/sample.test.ts","status":"failed","assertionResults":[{"fullName":"a works","status":"failed","duration":100}]}]}' "$PWD" > "$out"
  exit 1
fi
printf '{"testResults":[{"assertionResults":[{"fullName":"a works","status":"passed","duration":100}]}]}' > "$out"
STUB
chmod +x "$t/bin/pnpm"
MAIN="$t/main" EP_ORCH="$t/orch" PATH="$t/bin:$PATH" TRIAGE_EVIDENCE="$t/evidence" \
  bash "$here/triage-failures.sh" "$t/main" > "$t/out" 2>&1
check "install runs unlocked, the full suite and the checkout rerun locked, the head rerun in MAIN unlocked" \
  "$(paste -sd ',' "$t/orch/pnpm.log")" "install gate readable,test gate locked,vitest gate locked,vitest main readable"
check "each locked Vitest run leaves its record beside its report, and MAIN keeps its modes" \
  "$(cd "$t/evidence" && ls lane-lock-*.json | paste -sd ' ') $(stat -c %a "$t/main/AGENTS.md")" "lane-lock-b1.json lane-lock-full.json 644"
check "triage-failures.sh is the only caller of lane-lock.sh" \
  "$(grep -l 'lane-lock.sh' "$here"/*.sh | grep -v -e '/lane-lock.sh$' -e '/lane-lock.test.sh$' -e '/workflow.test.sh$' | xargs -n1 basename | paste -sd ' ')" "triage-failures.sh"
exit $fail
