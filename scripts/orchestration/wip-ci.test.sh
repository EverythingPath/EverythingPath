#!/usr/bin/env bash
# usage: wip-ci.test.sh — checks wip-ci.sh (speed-wip-ci W3) in a scratch worktree whose origin is a local bare
# repository, with a stub gh on PATH that answers `gh run list|view|download` from files and the bare origin and
# refuses every other command, so nothing here touches the network or GitHub. Covers the threat model's must-catch
# list (owner 2026-11-07): only refs/heads/wip/<task>-<stamp> is pushed, never forced and never a tag; .env* other
# than .env.example, e2e/.private, a file of 100 MB or more, a .github/ change against Wip-Base and a hidden index
# entry (in a large index too) are refused; the worktree's own index and refs stay untouched, during the run as well
# as after; a second run waits for the slot and gives up with 75; the deadline bounds blocked gh calls; the run is
# cancelled on timeout, TERM and HUP; the branch is deleted on green, red, timeout, TERM and HUP, a failed deletion
# exits 3, and after KILL the branch stays for wip-sweep; the slot is free after every signal; the summary is capped.
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
wip run --static
trailers=$(g cat-file commit "$(cut -d' ' -f2 "$dir/gh/refs-at-run")" | sed '1,/^$/d' | git interpret-trailers --parse | grep '^Wip-Scope')
check "--static with the default scope pushes Wip-Scope: suite static=yes" "$status $trailers" "0 Wip-Scope: suite static=yes"

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
g checkout -q --detach HEAD
usage 'a detached HEAD without --task' run
g checkout -q t3/fixture-task

# The slot: one WIP run at a time. While another process holds it, a run waits WIP_CI_SLOT_WAIT seconds, then
# exits 75 without pushing.
mkdir -p "$(dirname "$slot")"
exec {holder}> "$slot"; flock -n "$holder"
fresh 'completed success' green
WIP_CI_SLOT_WAIT=1 wip run --scope tests/unit {holder}>&-
check "a run with the slot taken exits 75" "$status $(grep -c '^wip-ci: no WIP slot' "$dir/err")" "75 1"
check "and pushes nothing (no slot)" "$(refs) $(gh_calls)" " "
exec {holder}>&-

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
exit $fail
