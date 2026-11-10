#!/usr/bin/env bash
# usage: wip-ci.test.sh — checks wip-ci.sh (speed-wip-ci W3) in a scratch worktree whose origin is a local bare
# repository, with a stub gh on PATH that answers `gh run list|view|download` from files and the bare origin and
# refuses every other command, so nothing here touches the network or GitHub. Covers the threat model's must-catch
# list (owner 2026-11-07): only refs/heads/wip/<task>-<stamp> is pushed, never forced and never a tag; .env* other
# than .env.example, e2e/.private, a file of 100 MB or more, a .github/ change against Wip-Base and a hidden index
# entry (in a large index too) are refused; the worktree's own index and refs stay untouched, during the run as well
# as after; a second run waits for the slot and gives up with 75, waiters queue in arrival order on a ticket each (an
# older live ticket keeps a free slot, a stopped first waiter is not passed, a dead ticket is skipped, a ticket is
# removed on 75, TERM, HUP and INT and on TERM right after it is published, and a KILL during its deletion leaves
# neither lock held, as does one while the results directory is prepared; structurally, a recorder on every PATH name
# finds no external command but a flock on its own descriptor holding the slot or a ticket), and an old-style holder
# of the bare slot flock still excludes; the deadline bounds blocked gh
# calls; the push and the deletion each have their own cap (a hung push exits 1, a hung deletion 3), apart from
# --timeout; a relative origin URL is resolved against the worktree; the run is cancelled on timeout, TERM, HUP and
# INT; the branch is deleted on green, red, timeout, TERM, HUP and INT, a failed deletion exits 3, and after KILL the
# branch stays for wip-sweep; the slot is free after every signal; the summary is capped.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
dir=$(mktemp -d "${TMPDIR:?TMPDIR}/wip-ci-test-XXXXXX") || exit 1
pids=()
cleanup() { local pid; for pid in "${pids[@]}"; do kill -KILL "$pid" 2> /dev/null; done; rm -rf "$dir"; }
trap cleanup EXIT
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=Fixture GIT_AUTHOR_EMAIL=fixture@example.test GIT_COMMITTER_NAME=Fixture GIT_COMMITTER_EMAIL=fixture@example.test
fail=0
check() { if [[ $2 == "$3" ]]; then echo "ok    $1"; else echo "FAIL  $1: want '$3', got '$2'"; fail=1; fi; }
[[ -r $here/wip-ci.sh ]] || { echo "FAIL  wip-ci.sh exists: no $here/wip-ci.sh"; exit 1; }

r=$dir/repo
origin=$dir/origin.git
g() { git -C "$r" "$@"; }
o() { git -C "$origin" "$@"; }
export MAIN=$r EP_ORCH=$dir/orch WIP_CI_POLL=1 WIP_CI_SLOT_WAIT=5
mkdir -p "$EP_ORCH" "$dir/bin" "$dir/gh" "$dir/tmp"
slot=$EP_ORCH/wip-ci/slot

# The scratch worktree: an integration branch (the default Wip-Base) and the worker's branch on it, with a tag and
# configuration that would push more than one ref if the wrapper let them apply.
git init -q --bare "$origin"
git init -q -b feature/pf1-character-builder "$r"
g remote add origin "$origin"
mkdir -p "$r/.github/workflows" "$r/tests/unit" "$r/e2e"
printf 'on: push\n' > "$r/.github/workflows/ci.yaml"
printf 'it("works", () => {});\n' > "$r/tests/unit/a.test.ts"
printf 'KEY=example\n' > "$r/.env.example"
printf 'base\n' > "$r/a.txt"
g add -A; g commit -qm base
base=$(g rev-parse HEAD)
g tag -a -m 'a tag' v-fixture
g checkout -qb t3/fixture-task
printf 'committed\n' > "$r/b.txt"; g add b.txt; g commit -qm 'worker commit'
g config push.followTags true
g config remote.origin.push '+refs/heads/*:refs/heads/*'
g config push.default matching
head=$(g rev-parse HEAD)

# Stub gh. `run list` reports one run (4242) for the pushed wip ref, at the commit origin holds, and records origin's
# refs and the worktree's refs as the run saw them; `run view` answers the next line of gh/views (the last line
# repeats; `hang` blocks for 30 s); `run download` copies gh/artifacts/<name>/ (it blocks while gh/hang-download
# exists); `run cancel` only logs. Anything else is refused, and every call is logged.
cat > "$dir/bin/gh" << STUB
#!/usr/bin/env bash
printf '%s\n' "\$*" >> "$dir/gh/log"
arg() { local want=\$1; shift; while [[ \$# -gt 0 ]]; do [[ \$1 == "\$want" ]] && { printf '%s' "\$2"; return; }; shift; done; }
case "\$1 \$2" in
  'run list')
    branch=\$(arg --branch "\$@")
    sha=\$(git -C "$origin" rev-parse -q --verify "refs/heads/\$branch") || { echo '[]'; exit 0; }
    git -C "$origin" for-each-ref --format='%(refname) %(objectname)' > "$dir/gh/refs-at-run"
    git -C "$r" for-each-ref --format='%(refname) %(objectname)' > "$dir/gh/local-refs-at-run"
    printf '[{"databaseId": 4242, "headSha": "%s", "url": "https://github.invalid/runs/4242"}]\n' "\$sha" ;;
  'run view')
    n=\$(cat "$dir/gh/views-read" 2> /dev/null || echo 0); n=\$((n + 1)); echo "\$n" > "$dir/gh/views-read"
    line=\$(sed -n "\${n}p" "$dir/gh/views"); [[ -n \$line ]] || line=\$(tail -n 1 "$dir/gh/views")
    read -r status conclusion <<< "\$line"
    [[ \$status != hang ]] || exec sleep 30
    printf '{"status": "%s", "conclusion": "%s", "url": "https://github.invalid/runs/4242"}\n' "\$status" "\$conclusion" ;;
  'run download')
    name=\$(arg --name "\$@"); out=\$(arg --dir "\$@")
    [[ ! -e "$dir/gh/hang-download" ]] || exec sleep 30
    [[ -d "$dir/gh/artifacts/\$name" ]] || { echo "no artifact \$name" >&2; exit 1; }
    mkdir -p "\$out" && cp -R "$dir/gh/artifacts/\$name/." "\$out/" ;;
  'run cancel') echo "cancel requested for \$3" ;;
  *) echo "stub gh: refused \$*" >&2; exit 2 ;;
esac
STUB
chmod +x "$dir/bin/gh"
# Pass-through rm, mkdir and mv. With $dir/hook/rm-pause (or mkdir-pause) present, an rm (or mkdir) whose arguments
# hold the text in that file (for rm, a queue ticket when it is empty) first records its pid in $dir/hook/paused and
# blocks (in a builtin read, so no child of its own) until killed; with $dir/hook/mv-term present, a rename into the
# queue sends TERM to the wrapper right after it renames, before the wrapper's next step.
mkdir -p "$dir/hook"; mkfifo "$dir/hook/never"
real_rm=$(command -v rm) real_mv=$(command -v mv) real_mkdir=$(command -v mkdir)
for cmd in rm mkdir; do
  real=real_$cmd
  cat > "$dir/bin/$cmd" << STUB
#!/usr/bin/env bash
if [[ -e "$dir/hook/$cmd-pause" ]]; then
  match=\$(< "$dir/hook/$cmd-pause"); match=\${match:-/wip-ci/queue/}
  if [[ "\$*" == *"\$match"* ]]; then echo \$\$ > "$dir/hook/paused"; read -rt 30 <> "$dir/hook/never"; fi
fi
exec "${!real}" "\$@"
STUB
done
cat > "$dir/bin/mv" << STUB
#!/usr/bin/env bash
if [[ -e "$dir/hook/mv-term" && "\$*" == *"/wip-ci/queue/"* ]]; then
  "$real_mv" "\$@"; status=\$?; kill -TERM "\$PPID"; exit "\$status"
fi
exec "$real_mv" "\$@"
STUB
chmod +x "$dir/bin/rm" "$dir/bin/mkdir" "$dir/bin/mv"
export PATH=$dir/bin:$PATH

# fresh <views> [summary outcome] [markdown lines]: resets the stub for one run.
fresh() {
  rm -rf "$dir/gh"/* "$dir/tmp"/*
  printf '%s\n' "$1" | tr ';' '\n' > "$dir/gh/views"
  if [[ -n ${2-} ]]; then
    mkdir -p "$dir/gh/artifacts/wip-summary-4242"
    printf '{"kind": "wip-ci-summary-v1", "outcome": "%s"}\n' "$2" > "$dir/gh/artifacts/wip-summary-4242/wip-summary.json"
    { echo "# WIP CI $2"; for ((i = 1; i <= ${3:-3}; i++)); do printf 'line %d %0100d\n' "$i" 0; done; } \
      > "$dir/gh/artifacts/wip-summary-4242/wip-summary.md"
  fi
}
# wip <args...>: wip-ci.sh in the scratch worktree; status, stdout and stderr land in $status, $dir/{out,err}.
wip() { (cd "$r" && TMPDIR=$dir/tmp bash "$here/wip-ci.sh" "$@") > "$dir/out" 2> "$dir/err"; status=$?; }
refs() { o for-each-ref --format='%(refname) %(objectname)' | paste -sd ' '; }
state() { { sha256sum < "$r/.git/index"; g for-each-ref --format='%(refname) %(objectname)'; g rev-parse HEAD; g stash list; } | sha256sum; }
gh_calls() { [[ -s $dir/gh/log ]] && cut -d' ' -f1-2 "$dir/gh/log" | sort -u | paste -sd ','; }
local_refs() { g for-each-ref --format='%(refname) %(objectname)'; }
cancelled() { grep -cx 'run cancel 4242' "$dir/gh/log" 2> /dev/null; }
slot_free() { flock -n "$slot" true && echo free || echo held; }

# Green: uncommitted, staged and untracked changes are all in the snapshot; the worktree's index and refs are not.
printf 'modified\n' > "$r/a.txt"
printf 'staged\n' > "$r/c.txt"; g add c.txt
printf 'untracked\n' > "$r/d.txt"
before=$(state) refs_before=$(local_refs)
fresh 'in_progress -;completed success' green
wip run --scope tests/unit
check "green run exits 0" "$status" 0
check "the worktree's index, refs, HEAD and stash are untouched" "$(state)" "$before"
# Not only restored: no ref of the worktree's repository (refs/remotes/origin/wip/* among them) moves while it runs.
check "the worktree's refs are unchanged while the run runs" "$(cat "$dir/gh/local-refs-at-run")" "$refs_before"
read -r ref sha < "$dir/gh/refs-at-run"
check "origin held only refs/heads/wip/<task>-<stamp> while the run ran" \
  "$(grep -cE '^refs/heads/wip/fixture-task-[0-9]{8}-[0-9]{6} [0-9a-f]{40}$' "$dir/gh/refs-at-run") $(wc -l < "$dir/gh/refs-at-run")" "1 1"
check "no tag reached origin despite push.followTags" "$(o tag | wc -l)" 0
check "the pushed commit is parentless" "$(g cat-file commit "$sha" | grep -c '^parent ')" 0
check "the snapshot holds the modified file" "$(g show "$sha:a.txt")" modified
check "the snapshot holds the staged file" "$(g show "$sha:c.txt")" staged
check "the snapshot holds the untracked file" "$(g show "$sha:d.txt")" untracked
check "the snapshot holds the committed file" "$(g show "$sha:b.txt")" committed
trailers=$(g cat-file commit "$sha" | sed '1,/^$/d' | git interpret-trailers --parse | paste -sd '|')
check "the trailers are Wip-Task, Wip-Base and Wip-Scope" "$trailers" "Wip-Task: fixture-task|Wip-Base: $base|Wip-Scope: tests/unit"
# W2's driver plans from a checkout of the pushed commit, so the trailer format is the one it parses.
git init -q "$dir/co"; git -C "$dir/co" fetch -q "$r" "$sha" && git -C "$dir/co" checkout -q --detach "$sha"
(cd "$dir/co" && python3 -B "$here/wip_ci.py" plan --out "$dir/plan") > /dev/null 2>&1
check "wip_ci.py plan accepts the pushed commit" "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["plan"]["scope"])' "$dir/plan/plan.json")" "['tests/unit']"
check "the run URL is printed" "$(grep -c '^wip-ci: run https://github.invalid/runs/4242$' "$dir/out")" 1
check "the summary is downloaded to TMPDIR/wip-ci/<run>/" "$(head -n 1 "$dir/tmp/wip-ci/4242/wip-summary.md")" "# WIP CI green"
check "and its markdown is printed" "$(grep -c '^line [0-9]' "$dir/out")" 3
check "the branch is deleted after a green run" "$(refs)" ""
check "the slot is free after a green run" "$(slot_free)" free
check "gh is used only to list, view and download runs" "$(gh_calls)" "run download,run list,run view"
git -C "$r" restore --staged c.txt; rm -f "$r/c.txt" "$r/d.txt"; g checkout -q a.txt

# --static adds static=yes to the scope; the default scope is suite.
fresh 'completed success' green
WIP_CI_SLOT_WAIT=3600 wip run --static
trailers=$(g cat-file commit "$(cut -d' ' -f2 "$dir/gh/refs-at-run")" | sed '1,/^$/d' | git interpret-trailers --parse | grep '^Wip-Scope')
check "--static with the default scope (and the longest slot wait, 3600 s) pushes Wip-Scope: suite static=yes" "$status $trailers" "0 Wip-Scope: suite static=yes"

# Red: a failed run, a red summary in a successful run, or no summary at all; the branch is deleted each time.
for case in 'completed failure:red' 'completed success:red' 'completed success:' 'completed cancelled:green'; do
  fresh "${case%%:*}" "${case#*:}"
  before=$(state)
  wip run --scope tests/unit
  check "run '${case%%:*}', summary '${case#*:}' exits 1 (red)" "$status" 1
  check "and deletes the branch (${case})" "$(refs)" ""
  check "and leaves the worktree's index and refs (${case})" "$(state) $(cat "$dir/gh/local-refs-at-run")" "$before $refs_before"
  check "and cancels nothing (${case})" "$(cancelled)" 0
done

# Timeout: the run never completes; exit 124, the run is cancelled and the branch is deleted.
fresh 'in_progress -' green
before=$(state)
wip run --scope tests/unit --timeout 3s
check "a run past --timeout exits 124" "$status" 124
check "and cancels the run (timeout)" "$(cancelled)" 1
check "and deletes the branch (timeout)" "$(refs)" ""
check "and frees the slot (timeout)" "$(slot_free)" free
check "and leaves the worktree's index and refs (timeout)" "$(state) $(cat "$dir/gh/local-refs-at-run")" "$before $refs_before"
# The deadline bounds every gh call: a blocked `run view`, and a blocked download of a completed run.
for blocked in view download; do
  if [[ $blocked == view ]]; then fresh 'hang -' green; else fresh 'completed success' green; touch "$dir/gh/hang-download"; fi
  started=$SECONDS
  wip run --scope tests/unit --timeout 2s
  check "a blocked run $blocked still exits 124 on time" "$status $(( SECONDS - started <= 6 ))" "124 1"
  check "and cancels the run (blocked $blocked)" "$(cancelled)" 1
  check "and deletes the branch (blocked $blocked)" "$(refs)" ""
  check "and frees the slot (blocked $blocked)" "$(slot_free)" free
done

# A failed deletion is not a success: origin refuses deletes, so a green run exits 3 and names the branch it left.
fresh 'completed success' green
o config receive.denyDeletes true
wip run --scope tests/unit
check "a branch origin will not delete exits 3" "$status $(grep -cE '^wip-ci: cleanup failed: wip/fixture-task-[0-9]{8}-[0-9]{6} is left for wip-sweep' "$dir/err")" "3 1"
check "and the branch is still there" "$(o for-each-ref refs/heads/wip | wc -l)" 1
check "and the slot is free (cleanup failed)" "$(slot_free)" free
o config --unset receive.denyDeletes
o for-each-ref --format='%(refname)' refs/heads/wip | xargs -r -n1 git -C "$origin" update-ref -d

# The push and the deletion each run under their own cap (WIP_CI_PUSH_CAP, 15 min by default), apart from the run's
# --timeout: origin's pre-receive hook sleeps the seconds in $dir/slow-push before an update, or in $dir/slow-delete
# before a deletion, standing in for a push of this tree that takes minutes, or one that hangs.
cat > "$origin/hooks/pre-receive" << HOOK
#!/usr/bin/env bash
while read -r old new ref; do
  if [[ \$new == 0000000000000000000000000000000000000000 ]]; then wait=$dir/slow-delete; else wait=$dir/slow-push; fi
  [[ ! -e \$wait ]] || sleep "\$(cat "\$wait")"
done
HOOK
chmod +x "$origin/hooks/pre-receive"
fresh 'completed success' green
echo 6 > "$dir/slow-push"
WIP_CI_PUSH_CAP=15 wip run --scope tests/unit --timeout 4s
check "a push slower than --timeout but within its cap still runs green" "$status" 0
fresh 'completed success' green
echo 30 > "$dir/slow-push"
started=$SECONDS
WIP_CI_PUSH_CAP=2 wip run --scope tests/unit
check "a push that hangs past its cap exits 1 and says so" \
  "$status $(grep -cE '^wip-ci: push of wip/fixture-task-[0-9]{8}-[0-9]{6} timed out after 2s' "$dir/err")" "1 1"
check "at its cap, not after the hung push" "$(( SECONDS - started <= 8 ))" 1
check "and leaves no branch (hung push)" "$(refs)" ""
check "and calls no gh (hung push)" "$(gh_calls)" ""
check "and frees the slot (hung push)" "$(slot_free)" free
rm "$dir/slow-push"
fresh 'completed success' green
echo 30 > "$dir/slow-delete"
started=$SECONDS
WIP_CI_PUSH_CAP=2 wip run --scope tests/unit
check "a deletion that hangs past its cap exits 3 and leaves the branch for wip-sweep" \
  "$status $(grep -cE '^wip-ci: deleting wip/fixture-task-[0-9]{8}-[0-9]{6} timed out after 2s' "$dir/err") $(grep -c 'is left for wip-sweep' "$dir/err")" "3 1 1"
check "at its cap, not after the hung deletion" "$(( SECONDS - started <= 8 ))" 1
check "and the branch is still there (hung deletion)" "$(o for-each-ref refs/heads/wip | wc -l)" 1
check "and frees the slot (hung deletion)" "$(slot_free)" free
rm "$dir/slow-delete" "$origin/hooks/pre-receive"
o for-each-ref --format='%(refname)' refs/heads/wip | xargs -r -n1 git -C "$origin" update-ref -d
for cap in 0 901 15m; do
  fresh 'completed success' green
  WIP_CI_PUSH_CAP=$cap wip run --scope tests/unit
  check "usage: WIP_CI_PUSH_CAP=$cap exits 64" "$status $(refs) $(gh_calls)" "64  "
done

# A relative origin URL is resolved against the worktree, as git resolves it there, before the push and the
# deletion run in the scratch repository: from the worktree's top and from a directory inside it.
g remote set-url origin ../origin.git
for from in "$r" "$r/tests/unit"; do
  fresh 'completed success' green
  (cd "$from" && TMPDIR=$dir/tmp bash "$here/wip-ci.sh" run --scope tests/unit) > "$dir/out" 2> "$dir/err"; status=$?
  check "a relative origin pushes and runs green (from ${from#"$r"}/)" "$status" 0
  check "its branch reached that origin (from ${from#"$r"}/)" \
    "$(grep -cE '^refs/heads/wip/fixture-task-[0-9]{8}-[0-9]{6} ' "$dir/gh/refs-at-run")" 1
  check "and is deleted there (from ${from#"$r"}/)" "$(refs)" ""
  sleep 1 # a new stamp for the next run
done
check "the worktree's origin URL is left as it was" "$(g remote get-url origin)" ../origin.git
g remote set-url origin "$origin"

# The output cap: a summary of 1000 lines prints at most 200 lines and 16 KB of it, and says where the rest is.
fresh 'completed success' green 1000
wip run --scope tests/unit
check "a long summary still exits 0" "$status" 0
check "at most 200 summary lines are printed" "$(( $(grep -c '^line [0-9]' "$dir/out") <= 200 ))" 1
check "at most 16 KB of the summary is printed" "$(( $(grep -E '^(# WIP CI|line [0-9])' "$dir/out" | wc -c) <= 16384 ))" 1
check "only whole lines are printed" "$(grep '^line ' "$dir/out" | grep -cvE '^line [0-9]+ 0{100}$')" 0
check "the cut is named with the full file's path" "$(grep -c "^wip-ci: summary cut .*$dir/tmp/wip-ci/4242/wip-summary.md" "$dir/out")" 1

# Never force, and cleanup deletes only its own commit: a ref already at origin under the same name (another
# commit) is left as it was, and the run is refused.
fresh 'completed success' green
o fetch -q "$r" t3/fixture-task && o update-ref refs/heads/wip/fixture-task-20260101-000000 "$head"
taken=$(refs)
check "the fixture holds another commit at the wip ref" "$taken" "refs/heads/wip/fixture-task-20260101-000000 $head"
WIP_CI_STAMP=20260101-000000 wip run --scope tests/unit
check "a push over an existing wip ref at another commit is refused" "$status $(grep -c 'push of wip/fixture-task-20260101-000000 failed' "$dir/err")" "1 1"
check "and that ref is left exactly as it was" "$(refs)" "$taken"
check "and no run is watched" "$(gh_calls)" ""
o update-ref -d refs/heads/wip/fixture-task-20260101-000000

# Refusals: each exits 1 before anything is pushed or gh is called, naming what it refused.
refused() {
  local name=$1 pattern=$2; shift 2
  local before; before=$(state)
  fresh 'completed success' green
  wip run "$@"
  check "refuses $name" "$status $(grep -cE "$pattern" "$dir/err")" "1 1"
  check "and pushes nothing ($name)" "$(refs)" ""
  check "and calls no gh ($name)" "$(gh_calls)" ""
  check "and leaves the index and refs ($name)" "$(state)" "$before"
}
for file in .env .env.local config/.env.production .envrc; do
  mkdir -p "$r/$(dirname "$file")"; printf 'SECRET=1\n' > "$r/$file"
  refused "an untracked $file" "^wip-ci: refused $file: an env file other than \.env\.example" --scope tests/unit
  rm -f "$r/$file"
done
mkdir -p "$r/config"; printf 'SECRET=1\n' > "$r/config/.env"; g add config/.env; g commit -qm 'commit an env file'
refused "a committed config/.env" '^wip-ci: refused config/\.env: an env file' --scope tests/unit
g reset -q --hard "$head"
mkdir -p "$r/e2e/.private"; printf 'state\n' > "$r/e2e/.private/auth.json"
refused "a file under e2e/.private" '^wip-ci: refused e2e/\.private/auth\.json: under e2e/\.private' --scope tests/unit
rm -rf "$r/e2e/.private"
truncate -s 100000000 "$r/big.bin"
refused "a file of 100 MB" '^wip-ci: big\.bin is 100000000 bytes, at or over' --scope tests/unit
rm -f "$r/big.bin"
printf 'on: [push, pull_request]\n' > "$r/.github/workflows/ci.yaml"
refused "an uncommitted .github change" '^wip-ci: refused: \.github/ differs from Wip-Base' --scope tests/unit
g checkout -q .github
printf 'x\n' > "$r/.github/new.yaml"; g add .github/new.yaml; g commit -qm 'a committed workflow'
refused "a committed .github change against Wip-Base" '^wip-ci: refused: \.github/ differs from Wip-Base' --scope tests/unit
fresh 'completed success' green
wip run --scope tests/unit --base "$(g rev-parse HEAD)"
check "the same tree runs against a Wip-Base that holds the change" "$status" 0
g reset -q --hard "$head"
g update-index --assume-unchanged a.txt
refused "an index that hides changes" '^wip-ci: refused: the index hides worktree changes' --scope tests/unit
g update-index --no-assume-unchanged a.txt
# The same under a large index (6,000 entries, a listing far beyond a pipe's buffer), with the hidden entry first and
# its file changed: the whole listing is checked, so no early match can cut the check short and pass it.
mkdir -p "$r/many"; for ((i = 0; i < 6000; i++)); do : > "$r/many/f$i"; done
g add many; g commit -qm 'a large index'
for flag in assume-unchanged skip-worktree; do
  g update-index "--$flag" a.txt; printf 'hidden change\n' > "$r/a.txt"
  refused "a large index with a $flag entry" '^wip-ci: refused: the index hides worktree changes' --scope tests/unit
  g update-index "--no-$flag" a.txt; g checkout -q a.txt
done
g reset -q --hard "$head"
GIT_CONFIG=$r/.git/config refused "a set GIT_CONFIG" '^wip-ci: GIT_CONFIG is set' --scope tests/unit

# Usage errors exit 64 before the slot, the snapshot or any push.
usage() {
  local name=$1; shift
  fresh 'completed success' green
  wip "$@"
  check "usage: $name exits 64" "$status $(refs) $(gh_calls)" "64  "
}
usage 'no subcommand'
usage 'an unknown subcommand' push
usage 'an unknown option' run --force
usage 'an extra argument' run refs/heads/main
usage 'a timeout over 60 min' run --timeout 61m
usage 'a zero timeout' run --timeout 0s
usage 'a malformed timeout' run --timeout 5h
usage 'a scope that is not a test directory' run --scope tests/nope
usage 'a scope with a newline' run --scope $'tests/unit\nWip-Base: '"$base"
usage 'a scope naming static itself' run --scope 'tests/unit static=yes'
usage 'a task outside [a-z0-9-]' run --task 'main:refs/heads/main'
usage 'a task with a slash' run --task ../main
usage 'a base that is not a commit' run --base nope
WIP_CI_SLOT_WAIT=3601 usage 'a slot wait over 3600 s' run
WIP_CI_SLOT_WAIT=1h usage 'a malformed slot wait' run
g checkout -q --detach HEAD
usage 'a detached HEAD without --task' run
g checkout -q t3/fixture-task

# The slot: one WIP run at a time, the flock on $EP_ORCH/wip-ci/slot as before debt-6b, so an old-style holder of the
# bare flock (a run of the previous wip-ci.sh) still excludes a run. While another process holds it, a run waits
# WIP_CI_SLOT_WAIT seconds, then exits 75 without pushing.
queue=$EP_ORCH/wip-ci/queue
tickets() { find "$queue" -maxdepth 1 -type f -regextype posix-extended -regex '.*/[0-9]{20}-[0-9]+' 2> /dev/null | wc -l; }
await_tickets() { local i; for ((i = 0; i < 100; i++)); do [[ $(tickets) == "$1" ]] && return 0; sleep 0.1; done; return 1; }
# queued <name> [args...]: wip-ci.sh run in the background, its output in $dir/<name>.{out,err}; $pid is its process.
queued() {
  local name=$1; shift
  (cd "$r" && TMPDIR=$dir/tmp exec env --default-signal=INT bash "$here/wip-ci.sh" run --scope tests/unit "$@") \
    > "$dir/$name.out" 2> "$dir/$name.err" {holder}>&- &
  pid=$!; pids+=("$pid")
}
mkdir -p "$(dirname "$slot")"
exec {holder}> "$slot"; flock -n "$holder"
fresh 'completed success' green
WIP_CI_SLOT_WAIT=1 wip run --scope tests/unit {holder}>&-
check "a run with the slot taken by a bare flock exits 75" "$status $(grep -c '^wip-ci: no WIP slot' "$dir/err")" "75 1"
check "and pushes nothing (no slot)" "$(refs) $(gh_calls)" " "
check "and says its queue position while it waits" "$(grep -c '^wip-ci: waiting for the WIP slot: position 1 of 1 ' "$dir/err")" 1
check "and removes its ticket on exit 75" "$(tickets)" 0

# FIFO: waiters are served in arrival order. The first holds the slot for a few polls once it gets it, so the second
# runs only after the first is done.
fresh 'in_progress -;in_progress -;in_progress -;completed success' green
WIP_CI_SLOT_WAIT=60 queued first --task first; first=$pid
await_tickets 1; check "the first waiter queues" "$?" 0
WIP_CI_SLOT_WAIT=60 queued second --task second; second=$pid
await_tickets 2; check "the second waiter queues behind it" "$?" 0
for ((i = 0; i < 100; i++)); do grep -q 'position 2 of 2' "$dir/second.err" && break; sleep 0.1; done
check "the second waiter says position 2 of 2" "$(grep -c '^wip-ci: waiting for the WIP slot: position 2 of 2 ' "$dir/second.err")" 1
# The first waiter is stopped (with its flock on the slot) while the slot is released: the second must still wait its
# turn, since the first's ticket is live, rather than take the slot the first cannot take yet.
tree_of() { local child; echo "$1"; for child in $(pgrep -P "$1"); do tree_of "$child"; done; }
stopped=$(tree_of "$first")
kill -STOP $stopped
# SIGSTOP lands asynchronously: release the slot only once every process of the first waiter is stopped (state T).
for ((i = 0; i < 100; i++)); do
  running=0; for p in $stopped; do [[ $(awk '/^State:/ {print $2}' "/proc/$p/status" 2> /dev/null) == T ]] || running=1; done
  ((running == 0)) && break; sleep 0.05
done
check "the first waiter is stopped" "$running" 0
exec {holder}>&-
sleep 3
check "the second waiter does not take the slot past the stopped first" \
  "$(slot_free) $(grep -c '^wip-ci: pushed' "$dir/second.out")" "free 0"
kill -CONT $stopped
{ wait "$first"; } 2> /dev/null; first_status=$?
{ wait "$second"; } 2> /dev/null; second_status=$?
check "both waiters run green once the slot is released" "$first_status $second_status" "0 0"
order=$(grep -oE '^run list --branch wip/(first|second)-' "$dir/gh/log" | uniq | sed -E 's/.*wip\/(first|second)-/\1/' | paste -sd ' ')
check "the first waiter is served first, the second after it" "$order" "first second"
check "and no ticket is left (FIFO)" "$(tickets)" 0

# An older live ticket keeps a free slot from a later run: it waits its turn and exits 75 when its wait runs out.
# Once that ticket's process is gone (its lock released, the file left, as after a KILL), the ticket is skipped.
mkdir -p "$queue"
exec {early}> "$queue/00000000000000000001-1"; flock -n "$early"
fresh 'completed success' green
WIP_CI_SLOT_WAIT=2 wip run --scope tests/unit {early}>&-
check "a free slot behind an older live ticket is not taken: exit 75" "$status $(refs) $(gh_calls)" "75  "
check "at position 2 of 2" "$(grep -c '^wip-ci: waiting for the WIP slot: position 2 of 2 ' "$dir/err")" 1
check "and only the older ticket is left" "$(tickets)" 1
exec {early}>&-
fresh 'completed success' green
WIP_CI_SLOT_WAIT=5 wip run --scope tests/unit
check "a dead ticket ahead is skipped: the run gets the slot and runs green" "$status" 0
check "and the dead ticket is removed" "$(tickets)" 0

# TERM, HUP or INT while queued exits at once and removes the ticket; KILL leaves the ticket file, which the next run
# skips as dead. Nothing is pushed in either case.
exec {holder}> "$slot"; flock -n "$holder"
for signal in TERM HUP INT KILL; do
  fresh 'completed success' green
  WIP_CI_SLOT_WAIT=60 queued "queued-$signal"
  await_tickets 1; check "a waiter is queued before $signal" "$?" 0
  sleep 0.3
  started=$SECONDS
  kill -"$signal" "$pid"; { wait "$pid"; } 2> /dev/null; status=$?
  want=$(case $signal in TERM) echo 143 ;; HUP) echo 129 ;; INT) echo 130 ;; KILL) echo 137 ;; esac)
  left=$([[ $signal == KILL ]] && echo 1 || echo 0)
  check "$signal while queued exits $want at once" "$status $(( SECONDS - started <= 3 ))" "$want 1"
  check "and leaves $left ticket file ($signal)" "$(tickets)" "$left"
  if [[ $signal == KILL ]]; then
    # No child (the head's minute-long flock on the slot) keeps the ticket's descriptor, so its lock is free at once.
    check "the ticket a KILL left is unlocked at once" \
      "$(flock -n "$(find "$queue" -maxdepth 1 -type f -name '[0-9]*' | head -n 1)" true && echo free || echo held)" free
  fi
  check "and pushes nothing ($signal while queued)" "$(refs) $(gh_calls)" " "
done
exec {holder}>&-
fresh 'completed success' green
WIP_CI_SLOT_WAIT=5 wip run --scope tests/unit
check "the ticket a KILL left is skipped: the next run runs green" "$status $(tickets)" "0 0"

# A KILL while a ticket is being deleted: the deleting child (a stub rm, paused) keeps neither lock, so once the wrapper
# is dead the slot and the ticket are both free, whether the run had just taken the slot or was exiting 75.
ticket_lock() { local file; file=$(find "$queue" -maxdepth 1 -type f -name '[0-9]*' | head -n 1); [[ -n $file ]] && flock -n "$file" true && echo free || echo held; }
await_paused() { local i; for ((i = 0; i < 100; i++)); do [[ -s $dir/hook/paused ]] && return 0; sleep 0.1; done; return 1; }
release_paused_command() { kill "$(cat "$dir/hook/paused")" 2> /dev/null; "$real_rm" -f "$dir/hook/rm-pause" "$dir/hook/mkdir-pause" "$dir/hook/paused"; }
for when in taken exit-75; do
  fresh 'completed success' green
  touch "$dir/hook/rm-pause"
  if [[ $when == exit-75 ]]; then exec {holder}> "$slot"; flock -n "$holder"; fi
  WIP_CI_SLOT_WAIT=1 queued "kill-in-rm-$when"
  await_paused; check "the ticket's deletion is paused ($when)" "$?" 0
  kill -KILL "$pid"; { wait "$pid"; } 2> /dev/null
  check "after a KILL during the ticket's deletion ($when), the ticket is unlocked" "$(ticket_lock)" free
  [[ $when != exit-75 ]] || exec {holder}>&-
  check "and the slot is free (KILL during the ticket's deletion, $when)" "$(slot_free)" free
  release_paused_command
  find "$queue" -maxdepth 1 -type f -exec "$real_rm" -f {} +
done

# TERM right after the ticket is renamed into the queue, before the wrapper's next step: cleanup still removes it.
fresh 'completed success' green
touch "$dir/hook/mv-term"
wip run --scope tests/unit
"$real_rm" -f "$dir/hook/mv-term"
check "TERM right after the ticket is published exits 143 and leaves no ticket" \
  "$status $(tickets) $(find "$queue" -maxdepth 1 -name '.new-*' | wc -l)" "143 0 0"
check "and pushes nothing (TERM at publication)" "$(refs) $(gh_calls)" " "

# A KILL while the results directory is prepared ($TMPDIR/wip-ci/<run>: its rm, then its mkdir), with the slot held:
# the paused child keeps no slot descriptor, so the slot is free once the wrapper is dead.
for cmd in rm mkdir; do
  fresh 'completed success' green
  printf '%s' "/tmp/wip-ci/4242" > "$dir/hook/$cmd-pause"
  queued "kill-in-results-$cmd"
  await_paused; check "the results directory's $cmd is paused" "$?" 0
  kill -KILL "$pid"; { wait "$pid"; } 2> /dev/null
  check "after a KILL during the results directory's $cmd, the slot is free" "$(slot_free)" free
  release_paused_command
done
o for-each-ref --format='%(refname)' refs/heads/wip | xargs -r -n1 git -C "$origin" update-ref -d # the KILLs' branches

# Structurally: no external command the wrapper starts, at any step, inherits the slot's or a ticket's descriptor,
# except the flock that locks that very descriptor, and no process between the wrapper and a command (a subshell that
# did not exec) holds one either. Every name on PATH links to one recorder, which notes the command, its arguments,
# its pid and its parent's, and the descriptors of each that are open on a file under $EP_ORCH/wip-ci/, then execs the
# real one. The wrapper's own pid is the one its bash wip-ci.sh record names, the one process allowed the locks (its
# own records, env and bash before it starts, have the test as their parent, which holds the test's locks).
# Runs: one that waits in the queue (behind a live and a dead ticket, then the slot) and runs green, one past its
# --timeout (cancelled), one that exits 75 and one TERMed while queued.
shim=$dir/shim fdlog=$dir/fdlog
mkdir -p "$shim"
cat > "$dir/recorder" << RECORDER
#!$(command -v bash)
name=\${0##*/}
# lock_fds <pid>: its descriptors open on a file under \$EP_ORCH/wip-ci/, space-separated.
lock_fds() {
  local fd target locks=
  for fd in /proc/\$1/fd/*; do
    target=\$("$(command -v readlink)" -- "\$fd" 2> /dev/null) || continue
    [[ \$target != "$EP_ORCH/wip-ci/"* ]] || locks+=" \${fd##*/}"
  done
  printf '%s' "\${locks# }"
}
args=\$*; args=\${args//[\$'\\t\\n']/ } # one line per command, whatever its arguments hold
printf '%s\t%s\t%s\t%s\t%s\t%s\n' "\$name" "\$args" "\$(lock_fds \$\$)" "\$\$" "\$PPID" "\$(lock_fds \$PPID)" >> "$fdlog"
IFS=: read -ra dirs <<< "$PATH"
for d in "\${dirs[@]}"; do [[ -f \$d/\$name && -x \$d/\$name ]] && exec "\$d/\$name" "\$@"; done
echo "recorder: \$name not found" >&2; exit 127
RECORDER
chmod +x "$dir/recorder"
python3 -B -I -c '
import os, sys
shim, recorder = sys.argv[1], sys.argv[2]
for d in os.environ["PATH"].split(":"):
    try: names = os.listdir(d)
    except OSError: continue
    for n in names:
        p = os.path.join(d, n)
        if not os.path.exists(os.path.join(shim, n)) and os.path.isfile(p) and os.access(p, os.X_OK):
            os.symlink(recorder, os.path.join(shim, n))
' "$shim" "$dir/recorder"
: > "$fdlog"
fresh 'in_progress -;completed success' green
exec {holder}> "$slot"; flock -n "$holder"
mkdir -p "$queue"; : > "$queue/00000000000000000001-1"
exec {early}> "$queue/00000000000000000002-1"; flock -n "$early"
PATH=$shim:$PATH WIP_CI_SLOT_WAIT=60 queued recorded-green {early}>&-
for ((i = 0; i < 100; i++)); do grep -q 'position 2 of 2' "$dir/recorded-green.err" 2> /dev/null && break; sleep 0.1; done
sleep 1.5; exec {early}>&-
sleep 1.5; exec {holder}>&-
{ wait "$pid"; } 2> /dev/null
check "the recorded queued run runs green" "$?" 0
fresh 'in_progress -' green
PATH=$shim:$PATH wip run --scope tests/unit --timeout 3s
check "the recorded run past --timeout exits 124 and cancels" "$status $(cancelled)" "124 1"
exec {holder}> "$slot"; flock -n "$holder"
fresh 'completed success' green
PATH=$shim:$PATH WIP_CI_SLOT_WAIT=1 wip run --scope tests/unit {holder}>&-
check "the recorded run behind the slot exits 75" "$status" 75
fresh 'completed success' green
PATH=$shim:$PATH WIP_CI_SLOT_WAIT=60 queued recorded-term
await_tickets 1; sleep 1.5; kill -TERM "$pid"; { wait "$pid"; } 2> /dev/null
check "the recorded run TERMed while queued exits 143" "$?" 143
exec {holder}>&-
# Each command the steps start was seen (so the recording covers them), and none but a flock on its own argument
# holds a lock file's descriptor.
for want in 'flock' 'mv' 'rm	-f .*/wip-ci/queue/' 'sleep' 'timeout' 'gh	run list' 'gh	run view' 'gh	run cancel' \
  'gh	run download' 'python3' 'rm	-rf .*/wip-ci/4242' 'mkdir	-p .*/wip-ci/4242' 'git'; do
  check "the recorder saw $want" "$(grep -cE "^$want" "$fdlog" | sed 's/^[1-9][0-9]*$/seen/')" seen
done
leaks=$(awk -F '\t' '
  NR == FNR { if ($1 == "bash" && $2 ~ /wip-ci\.sh run/) wrapper[$4] = 1; next }
  $3 != "" && !($1 == "flock" && (n = split($2, a, " ")) && $3 == a[n]) { print "holds: " $0 }
  $6 != "" && !($5 in wrapper) && !($4 in wrapper) { print "parent holds: " $0 }' "$fdlog" "$fdlog")
check "the recorder saw the wrappers" "$(awk -F '\t' '$1 == "bash" && $2 ~ /wip-ci\.sh run/' "$fdlog" | wc -l)" 4
check "no external command but a flock on its own descriptor, nor its parent but the wrapper, holds the slot or a ticket" "$leaks" ""
# And by form: every nofd call is `(nofd ...)`, so the command is a subshell's exec and never this shell's.
check "every nofd call site is a subshell of its own" \
  "$(grep -nE '(^|[^(a-z_])nofd ' "$here/wip-ci.sh" | grep -vE '^[0-9]+:[[:space:]]*#' )" ""
check "the slot is free after the queue tests" "$(slot_free)" free

# TERM or HUP while watching, in the poll's sleep or during a gh call that hangs: the run is cancelled, the branch is
# deleted, then the slot is released, at once. KILL runs no cleanup (root's disposition, 2026-11-07): the slot is
# released by the kernel at once, since no child (the 30 s poll's sleep, a hung gh) keeps the lock's descriptor, and
# the branch stays at origin under the wip/<task>-<stamp> name that W4's wip-sweep removes.
await_gh() { local i; for ((i = 0; i < 100; i++)); do grep -q "^$1" "$dir/gh/log" 2> /dev/null && return 0; sleep 0.1; done; return 1; }
left=0
for signal in TERM HUP TERM-in-gh KILL KILL-in-gh; do
  if [[ $signal == *-in-gh ]]; then fresh 'hang -' green; poll=1 call='run view'; else fresh 'in_progress -' green; poll=30 call='run list'; fi
  (cd "$r" && TMPDIR=$dir/tmp WIP_CI_POLL=$poll exec bash "$here/wip-ci.sh" run --scope tests/unit --timeout 10m) \
    > "$dir/out" 2> "$dir/err" &
  pid=$!; pids+=("$pid")
  await_gh "$call"; check "the run is watched before $signal" "$? $(slot_free)" "0 held"
  sleep 0.5
  started=$SECONDS
  kill -"${signal%-in-gh}" "$pid"; { wait "$pid"; } 2> /dev/null; status=$?
  if [[ $signal == KILL* ]]; then
    check "$signal exits 137" "$status" 137
    for ((i = 0; i < 30; i++)); do [[ $(slot_free) == free ]] && break; sleep 0.1; done
    left=$((left + 1))
    check "after $signal the branch stays for wip-sweep" \
      "$(o for-each-ref --format='%(refname)' refs/heads/wip | grep -cE '^refs/heads/wip/fixture-task-[0-9]{8}-[0-9]{6}$')" "$left"
  else
    want=$([[ $signal == HUP ]] && echo 129 || echo 143)
    check "$signal exits $want at once" "$status $(( SECONDS - started <= 3 ))" "$want 1"
    check "$signal cancels the run" "$(cancelled)" 1
    check "$signal deletes the branch" "$(refs)" ""
  fi
  check "the slot is free after $signal" "$(slot_free)" free
  sleep 1 # a new stamp for the next run
done
# INT, as a terminal's Ctrl-C sends it. A background job of a non-interactive shell starts with INT ignored, so the run
# above could never see it; env --default-signal=INT restores the default, as a foreground run has it (W3 r2's probe).
o for-each-ref --format='%(refname)' refs/heads/wip | xargs -r -n1 git -C "$origin" update-ref -d # KILL's leftovers
fresh 'in_progress -' green
(cd "$r" && TMPDIR=$dir/tmp WIP_CI_POLL=30 exec env --default-signal=INT bash "$here/wip-ci.sh" run --scope tests/unit --timeout 10m) \
  > "$dir/out" 2> "$dir/err" &
pid=$!; pids+=("$pid")
await_gh 'run list'; check "the run is watched before INT" "$? $(slot_free)" "0 held"
for ((i = 0; i < 100; i++)); do grep -q '^wip-ci: run ' "$dir/out" && break; sleep 0.1; done
check "INT's run is known before INT" "$(grep -c '^wip-ci: run ' "$dir/out")" 1
started=$SECONDS
kill -INT "$pid"; { wait "$pid"; } 2> /dev/null; status=$?
check "INT exits 130 at once" "$status $(( SECONDS - started <= 3 ))" "130 1"
check "INT cancels the run" "$(cancelled)" 1
check "INT deletes the branch" "$(refs)" ""
check "the slot is free after INT" "$(slot_free)" free
exit $fail
