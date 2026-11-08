# shellcheck shell=bash
# Sourced by cur-prep.sh and land-queue.sh after paths.sh. The curation prep's
# test plan, its shared-store count and its receipt (#759).
#
# prep_plan <base> [full]: in a batch worktree, the checks for HEAD against
# <base> (the feature head it was rebased onto), one per line:
#   mode light|full
#   reason <why prep runs the whole of tests/catalog>   (full only)
#   test <path>                                          (sorted, unique)
#   note <text>
# Light prep runs the batch tests the whole <base>..HEAD diff touches (every
# changed test file, and every test of each batch whose artifacts change,
# older batches included, integration tests too), the tests the diff reaches
# through imports (`pnpm -s test:affected`, scripts/affected-tests.ts), plus
# the fixed guards. A test:affected failure, or its exit 3 (a changed path it
# cannot trace), makes the plan full.
# Anything else in the diff (shared tooling, schema, validators, including the
# guards and any test file that exports helpers, other fixtures, an edited or
# removed shared-store file, a removed test) makes it full, as does a missing
# guard: when in doubt, full.
#
# Receipts: cur-prep.sh writes $orch/logs/cur-<n>-prep.receipt (key=value)
# when prep passes, and removes it when a prep starts. The key is taken before
# the checks run, and no receipt is written if HEAD, its tree, the base or the
# worktree's state changed meanwhile. land-queue.sh reuses it only when the
# commit, base, lockfile, prep scripts, check configuration, toolchain and the
# test environment (prep_env) are all unchanged (prep_reusable).
# A remote-suite prep (cur-prep.sh --remote-suite) runs every other check,
# records the plan and leaves the tests to the remote full suite on the exact
# tree. It writes its own file, cur-<n>-prep.remote.receipt (tests=remote),
# never cur-<n>-prep.receipt, which only a local prep writes (tests=local);
# every prep removes both when it starts. A landing under remote checks reads
# only the remote file (prep_reusable ... remote), any other only the local
# one, so the modes never meet in one decision; tests= is kept as a
# consistency check, so a receipt in the wrong file is refused. A local
# receipt also needs its Vitest log beside it, unchanged since the prep
# (testLogSha256), recording the receipt's issue, commit, tree, base and
# config and a passing run (prep_log_bound); checks hashes the tests mode
# with the check list and is compared even for a full plan.

# The shared data files every batch adds to; catalog:merge merges them.
prep_data_files=(
  scripts/catalog/reviewed-curation.json
  scripts/catalog/legal/held-notices.json
  src/lib/catalog/data/attribution-assessments.json
  src/lib/catalog/data/attribution-evidence.json
  src/lib/catalog/data/section15-registry.json
)
# The TypeScript tables every batch appends rows to; catalog:merge merges
# their rows too (scripts/catalog/table-merge.ts), so they are resolvable.
prep_table_files=(
  scripts/catalog/reviewed-change-replacements.ts
  tests/catalog/cross-batch-bindings.ts
)
# The conflicted paths a rebase may hand to catalog:merge, as an extended
# regular expression: the data files and the tables. Any other conflict is
# resolved by hand.
prep_merge_re=$(printf '^%s$|' "${prep_data_files[@]}" "${prep_table_files[@]}" | sed 's/\./\\./g; s/|$//')
# Light prep always runs these: the #756 cross-batch guard, the notice holds,
# the shared-store loader, the #749 ownership checks' self-tests and their
# sweep over every applicable inventory, and #757's review-receipt validator.
# They are shared validators, so a batch that changes one gets a full prep.
prep_guards=(
  tests/catalog/cross-batch-bindings.test.ts
  tests/catalog/notice-holds.test.ts
  tests/catalog/pinned-sources.test.ts
  tests/catalog/batch-ownership.test.ts
  tests/catalog/batch-ownership-sweep.test.ts
  tests/catalog/review-receipts.test.ts
)
# The environment settings that change how the tests run (CI sets the test
# timeout in vitest.config.ts; the rest choose Vitest's workers and pool, and
# the time zone): part of the receipt, compared in both modes.
prep_env_vars=(CI VITEST_MAX_WORKERS VITEST_MIN_WORKERS VITEST_POOL TZ)
# Bump when the checks cur-prep.sh runs change; it is part of the receipt,
# with the tests mode (local: vitest runs the plan; remote: it doesn't).
prep_checks='v2 check:artifacts --base; catalog:launch-inventory --check; catalog:conditions compare; catalog:format --check; catalog:notice-deps; test:affected; tests local=vitest remote=none'
prep_count_start='<!-- prep:shared-store-count -->'
prep_count_end='<!-- /prep:shared-store-count -->'

# prep_receipt_path <issue> [remote]: the local prep's receipt, or with remote
# the remote-suite prep's, cur-<n>-prep.remote.receipt. Each mode writes and
# reads only its own file.
prep_receipt_path() { printf '%s\n' "${PREP_RECEIPT_DIRECTORY:-$orch/logs}/cur-$1-prep${2:+.$2}.receipt"; }

# prep_batch_id <path>: the batch whose artifact <path> is, if any: its
# inventory scripts/catalog/legal/<id>.json (or <id>-evidence.json) exists at HEAD.
prep_batch_id() {
  local id
  case $1 in
    docs/catalog-import/*.md) id=${1#docs/catalog-import/}; id=${id%.md} ;;
    scripts/catalog/legal/*.json) id=${1#scripts/catalog/legal/}; id=${id%.json}; id=${id%-evidence} ;;
    tests/fixtures/*/*) id=${1#tests/fixtures/}; id=${id%%/*} ;;
    *) return 1 ;;
  esac
  [[ $id =~ ^[a-z]+(-[a-z]+)*-[0-9]+$ ]] || return 1
  git cat-file -e "HEAD:scripts/catalog/legal/$id.json" 2> /dev/null \
    || git cat-file -e "HEAD:scripts/catalog/legal/$id-evidence.json" 2> /dev/null || return 1
  printf '%s\n' "$id"
}

# prep_batch_tests <id>: every test file of batch <id> at HEAD, under tests/
# or convex/: <family>-<n>.test.ts, <family><n>.integration.test.ts,
# convex/catalog<Family><n>.integration.test.ts and the like.
prep_batch_tests() {
  local family=${1%-*} n=${1##*-}
  git ls-tree -r --name-only HEAD -- tests convex \
    | grep -iE "/(catalog)?(${family}|${family//-/})-?${n}\.([a-z]+\.)?test\.tsx?$" || true
}

# prep_classify <status> <path>: what one changed path means for the plan:
# "data", "store", "batch <id>", "test <path>" or "full <reason>".
prep_classify() {
  local status=$1 path=$2 id
  if [[ " ${prep_data_files[*]} " == *" $path "* ]]; then
    if [[ $status == D ]]; then echo "full $path removed"; else echo data; fi
  elif [[ $path == tests/fixtures/pinned/* ]]; then
    if [[ $status == A ]]; then echo store; else echo "full shared-store file $path changed ($status)"; fi
  elif id=$(prep_batch_id "$path"); then
    if [[ $status == D ]]; then echo "full $path removed"; else echo "batch $id"; fi
  elif [[ $path =~ \.test\.tsx?$ ]]; then
    if [[ $status == D ]]; then echo "full test $path removed"
    elif prep_shared_test "$path"; then echo "full shared validator $path changed"
    else echo "test $path"
    fi
  else
    echo "full $path"
  fi
}

# prep_shared_test <path>: a test file other tests depend on: a guard, the
# cross-batch guard's files, or one that exports helpers.
prep_shared_test() {
  [[ " ${prep_guards[*]} " == *" $1 "* || $1 == tests/catalog/cross-batch-bindings* ]] && return 0
  # grep reads the whole blob: with -q it would close the pipe on the first
  # export, and under pipefail git's SIGPIPE (141) would hide a shared test.
  git show "HEAD:$1" 2> /dev/null | grep -E '^export ' > /dev/null
}

# prep_plan_tests <id>...: "test <path>" for each batch's tests, or "full
# <reason>" for a batch with none.
prep_plan_tests() {
  local id own
  for id in $(printf '%s\n' "$@" | LC_ALL=C sort -u); do
    own=$(prep_batch_tests "$id")
    if [[ -n $own ]]; then sed 's/^/test /' <<< "$own"; else echo "full batch $id has no test file"; fi
  done
}

# prep_plan_guards: "test <guard>", or "full guard <guard> missing".
prep_plan_guards() {
  local g
  for g in "${prep_guards[@]}"; do
    if git cat-file -e "HEAD:$g" 2> /dev/null; then echo "test $g"; else echo "full guard $g missing"; fi
  done
}

# prep_plan_affected <base>: "test <path>" for each test the diff reaches
# through imports, nothing when HEAD has no scripts/affected-tests.ts, or
# "full test:affected exited <status>".
prep_plan_affected() {
  local out rc=0
  git cat-file -e HEAD:scripts/affected-tests.ts 2> /dev/null || return 0
  out=$(pnpm -s test:affected --base "$1" 2> /dev/null) || rc=$?
  if (( rc )); then echo "full test:affected exited $rc"; elif [[ -n $out ]]; then sed 's/^/test /' <<< "$out"; fi
}

prep_plan() {
  local base=$1 force=${2:-} status path ids=() lines
  lines=$(
    while IFS=$'\t' read -r status path; do
      prep_classify "$status" "$path"
    done < <(git diff --no-renames --name-status "$base" HEAD)
  )
  mapfile -t ids < <(sed -n 's/^batch //p' <<< "$lines")
  lines+=$'\n'$(prep_plan_tests "${ids[@]}")$'\n'$(prep_plan_affected "$base")$'\n'$(prep_plan_guards)
  prep_plan_print "$force" "$lines"
}

# prep_plan_print <force> <lines>: the plan from the classified lines.
prep_plan_print() {
  local reasons
  reasons=$(sed -n 's/^full //p' <<< "$2")
  if [[ -n $1 ]]; then printf 'mode full\nreason --full\n'
  elif [[ -n $reasons ]]; then
    echo "mode full"
    head -n 5 <<< "$reasons" | sed 's/^/reason /'
    (( $(wc -l <<< "$reasons") > 5 )) && echo "reason and $(( $(wc -l <<< "$reasons") - 5 )) more"
  else echo "mode light"
  fi
  grep '^test ' <<< "$2" | LC_ALL=C sort -u
}

# prep_shared_count <base>: the shared-store files HEAD adds against <base>,
# grouped by source: "102 (pf1 2, pf1-content 100)", or "0".
prep_shared_count() {
  local groups total
  groups=$(git diff --no-renames --diff-filter=A --name-only "$1" HEAD -- tests/fixtures/pinned \
    | awk -F/ 'NF > 4 { n[$4]++ } END { for (s in n) print s, n[s] }' | LC_ALL=C sort)
  total=$(awk '{ t += $2 } END { print t + 0 }' <<< "$groups")
  if (( total )); then echo "$total ($(awk '{ printf "%s%s %s", sep, $1, $2; sep = ", " }' <<< "$groups"))"
  else echo 0
  fi
}

# prep_write_count <issue> <base>: writes the shared-store count into the
# batch report's marker block (docs/catalog-import/<family>-<issue>.md) and
# amends HEAD when the line changes. Only a report with exactly one start
# marker followed by exactly one end marker is edited; without a report, or
# with a missing, duplicate or reversed marker, it prints the count and a
# warning and changes nothing. It never fails prep.
prep_write_count() {
  local n=$1 base=$2 count line report problem
  count=$(prep_shared_count "$base")
  echo "shared-store files added against ${base:0:12}: $count"
  report=$(git diff --name-only --diff-filter=AM "$base" HEAD -- docs/catalog-import | grep -E "^docs/catalog-import/[a-z]+(-[a-z]+)*-$n\.md$" || true)
  if [[ -z $report || $report == *$'\n'* ]]; then
    echo "warning: no single batch report for #$n in the diff; write the count above into it by hand" >&2
    return 0
  fi
  if problem=$(prep_marker_problem "$report"); then
    echo "warning: $report: $problem; the count above isn't in the report, which is unchanged" >&2
    return 0
  fi
  line="New shared-store files (\`tests/fixtures/pinned/\`), counted by prep after the rebase onto \`${base:0:8}\`: **${count%% *}**${count#"${count%% *}"}."
  awk -v start="$prep_count_start" -v end="$prep_count_end" -v line="$line" '
    $0 == start { print; print line; skip = 1; next }
    $0 == end { skip = 0 }
    !skip { print }' "$report" > "$report.prep-tmp" && mv "$report.prep-tmp" "$report" || return 1
  if [[ -n $(git status --porcelain -- "$report") ]]; then
    git add -- "$report" && git commit -q --amend --no-edit || return 1
    echo "wrote the count into $report (amended HEAD)"
  else
    echo "the count in $report is current"
  fi
}

# prep_marker_problem <report>: prints what is wrong with the report's count
# markers and succeeds, or fails when there is exactly one ordered pair.
prep_marker_problem() {
  local starts ends
  starts=$(grep -nxF "$prep_count_start" "$1" | cut -d: -f1)
  ends=$(grep -nxF "$prep_count_end" "$1" | cut -d: -f1)
  if [[ -z $starts || -z $ends ]]; then echo "no $prep_count_start marker block"
  elif [[ $starts == *$'\n'* || $ends == *$'\n'* ]]; then echo "more than one count marker pair"
  elif (( starts > ends )); then echo "the count markers are reversed"
  else return 1
  fi
}

# prep_scripts_hash: the prep scripts this checkout of scripts/orchestration runs.
prep_scripts_hash() {
  { (cd "$here" && cat cur-prep.sh prep-lib.sh paths.sh worktree-lib.sh)
    git hash-object -- scripts/check-artifacts.mjs scripts/artifact-budgets.json
  } | sha256sum | cut -c1-64
}

# prep_env: the test-affecting environment, "CI=true VITEST_MAX_WORKERS=1 ...",
# with "-" for an unset variable.
prep_env() {
  local v out=()
  for v in "${prep_env_vars[@]}"; do out+=("$v=${!v:--}"); done
  echo "${out[*]}"
}

# prep_identity <base>: what the checks ran on: HEAD, its tree, the feature
# head (frozen as <base> at the start) and the worktree's state.
prep_identity() {
  echo "$(git rev-parse HEAD) $(git rev-parse 'HEAD^{tree}') $(git rev-parse feature/pf1-character-builder) $1 $(git status --porcelain | sha256sum | cut -c1-16) $(git symbolic-ref --short -q HEAD) $(realpath "$(git rev-parse --show-toplevel)")"
}

# prep_toolchain: "node <version> pnpm <version>", "-" for one that doesn't run.
prep_toolchain() { echo "node $(node --version 2> /dev/null || echo -) pnpm $(pnpm --version 2> /dev/null || echo -)"; }

# prep_key <base> <plan> [local|remote]: the receipt's key for HEAD in this
# worktree; the tests mode (default local) is part of its config. Its fields
# are pinned by the pair queue's checked evidence (pair-stage.sh,
# pair-queue.mjs), so the toolchain and tests mode are prep_key_extra's.
prep_key() {
  local base=$1 plan=$2 tests=${3:-local}
  echo "branch=$(git symbolic-ref --short -q HEAD)"
  echo "worktree=$(realpath "$(git rev-parse --show-toplevel)")"
  echo "commit=$(git rev-parse HEAD)"
  echo "tree=$(git rev-parse 'HEAD^{tree}')"
  echo "base=$(git rev-parse "$base")"
  echo "integrationBase=$(git rev-parse feature/pf1-character-builder)"
  echo "lockfile=$(git rev-parse HEAD:pnpm-lock.yaml 2> /dev/null) $(git rev-parse HEAD:package.json 2> /dev/null)"
  echo "scripts=$(prep_scripts_hash)"
  echo "env=$(prep_env)"
  echo "mode=$(sed -n 's/^mode //p' <<< "$plan")"
  echo "config=$(printf '%s\ntests %s\n%s\n' "$prep_checks" "$tests" "$plan" | sha256sum | cut -c1-64)"
}

# prep_key_extra <local|remote>: the receipt's toolchain, tests mode and
# checks (the check list and tests mode, without the plan, so a full plan's
# receipt binds its tests mode too), which cur-prep.sh writes beside prep_key
# and prep_reusable compares with it.
prep_key_extra() {
  echo "toolchain=$(prep_toolchain)"
  echo "tests=$1"
  echo "checks=$(printf '%s\ntests %s\n' "$prep_checks" "$1" | sha256sum | cut -c1-64)"
}

# prep_write_receipt <issue> <local|remote> <key> [extra key=value lines]: the
# key was taken before the checks ran; the mode picks the receipt file.
prep_write_receipt() {
  local file; file=$(prep_receipt_path "$1" "${2#local}")
  { echo "issue=$1"; echo result=ok; printf '%s\n' "$3"; printf '%s\n' "${@:4}"; echo "finishedAt=$(date -u +%FT%TZ)"; } > "$file.tmp" \
    && mv -f "$file.tmp" "$file" && echo "prep receipt: $file"
}

# prep_log_header <issue> <commit> <tree> <base> <config>: the lines a local
# prep writes at the top of its Vitest log, before the argv line; the test
# output follows, and "# result=ok" closes a passing run's log.
prep_log_header() {
  printf '%s\n' '# cur-prep test log' "# issue=$1" "# commit=$2" "# tree=$3" "# base=$4" "# config=$5"
}

# prep_log_bound <issue> <receipt> <log>: prints why the log isn't the passing
# run of this receipt's commit, tree, base and plan and fails, or succeeds.
prep_log_bound() {
  local n=$1 file=$2 log=$3 i=1 k want
  [[ $(sed -n 1p "$log") == '# cur-prep test log' ]] || { echo "the prep's test log $log was written for another prep: no cur-prep header"; return 1; }
  for k in issue commit tree base config; do
    i=$(( i + 1 ))
    if [[ $k == issue ]]; then want=$n; else want=$(prep_field "$file" "$k"); fi
    [[ $(sed -n "${i}p" "$log") == "# $k=$want" ]] || { echo "the prep's test log $log was written for another $k"; return 1; }
  done
  [[ $(sed -n 7p "$log") == '# argv=pnpm test '?* ]] || { echo "the prep's test log $log was written for another prep: no argv line"; return 1; }
  [[ $(tail -n 1 "$log") == '# result=ok' ]] || { echo "the prep's test log $log doesn't record a passing run"; return 1; }
}

# Extract only a complete, unambiguous receipt key; never evaluate its contents.
prep_receipt_key() {
  local file=$1 k line
  for k in branch worktree commit tree base integrationBase lockfile scripts env mode config; do
    [[ $(grep -c "^$k=" "$file") == 1 ]] || { echo "missing or duplicate receipt field: $k" >&2; return 1; }
    line=$(prep_field "$file" "$k")
    [[ -n $line ]] || return 1
    printf '%s=%s\n' "$k" "$line"
  done
}

# prep_receipt_tests <file>: the receipt's tests mode, local or remote, once
# its toolchain, tests, checks, testLog and testLogSha256 fields are each
# present exactly once. Kept apart from prep_receipt_key, whose fields the
# pair queue's checked evidence pins.
prep_receipt_tests() {
  local file=$1 k tests
  for k in toolchain tests checks testLog testLogSha256; do
    [[ $(grep -c "^$k=" "$file") == 1 && -n $(prep_field "$file" "$k") ]] || { echo "missing or duplicate receipt field: $k" >&2; return 1; }
  done
  tests=$(prep_field "$file" tests)
  [[ $tests == local || $tests == remote ]] || { echo "receipt field tests is neither local nor remote: $tests" >&2; return 1; }
  echo "$tests"
}

# prep_receipt_evidence <issue> <file> <tests>: prints why the receipt's test
# evidence doesn't match its tests mode and fails, or succeeds. A local prep's
# receipt names its Vitest log, cur-<n>-prep-<stamp>-<unique>-vitest.log beside the
# receipt, a regular file whose sha256 it records and which records this
# receipt's issue, commit, tree, base and config and a passing run
# (prep_log_bound); a remote one names none (testLog=- and testLogSha256=-).
# A retained log of another commit, or of a failed run, doesn't certify it.
prep_receipt_evidence() {
  local n=$1 file=$2 tests=$3 log sum
  log=$(prep_field "$file" testLog); sum=$(prep_field "$file" testLogSha256)
  if [[ $tests == remote ]]; then
    [[ $log == - && $sum == - ]] || { echo "tests=remote names a test log; malformed prep receipt"; return 1; }
    return 0
  fi
  [[ $log != - && $sum =~ ^[0-9a-f]{64}$ ]] || { echo "tests=local without its test log evidence (testLog=$log)"; return 1; }
  [[ $(dirname "$log") == "$(dirname "$file")" && $(basename "$log") =~ ^cur-$n-prep-[0-9]{8}-[0-9]{6}-[A-Za-z0-9]{6}-vitest\.log$ ]] \
    || { echo "tests=local names a test log that isn't this prep's: $log"; return 1; }
  [[ -f $log && ! -L $log ]] || { echo "the prep's test log $log is missing"; return 1; }
  [[ $(sha256sum < "$log" | cut -c1-64) == "$sum" ]] || { echo "the prep's test log $log changed since the prep"; return 1; }
  prep_log_bound "$n" "$file" "$log"
}

# prep_receipt_usable <issue> <file> <local|remote>: succeeds when the
# receipt file of that mode can be used at all, or prints why not (none,
# malformed, another issue, a receipt of the other mode in this file, test
# evidence that doesn't match its mode) and fails.
prep_receipt_usable() {
  local n=$1 file=$2 mode=$3 tests
  if [[ ! -f $file || $(prep_field "$file" result) != ok ]]; then
    if [[ $mode == remote ]]; then echo "no remote-suite prep receipt"; else echo "no prep receipt"; fi
    return 1
  fi
  prep_receipt_key "$file" > /dev/null && tests=$(prep_receipt_tests "$file") || { echo "malformed prep receipt"; return 1; }
  [[ $(grep -c '^issue=' "$file") == 1 && $(prep_field "$file" issue) == "$n" && $(grep -c '^result=' "$file") == 1 ]] || { echo "wrong or malformed prep receipt issue/result"; return 1; }
  [[ $tests == "$mode" ]] || { echo "tests=$tests in the $mode prep receipt: a receipt in the wrong file"; return 1; }
  prep_receipt_evidence "$n" "$file" "$tests"
}

# prep_receipt_current <file> <worktree> <base> <tests>: prints the first
# field that changed since the prep and fails, or succeeds. The commit and
# base come first; config (the plan) is skipped for a full plan, which covers
# any plan, but checks (the tests mode) never is.
prep_receipt_current() {
  local file=$1 wt=$2 base=$3 tests=$4 key k want got
  key=$(cd "$wt" && echo "commit=$(git rev-parse HEAD)"; echo "base=$(git rev-parse "$base")")
  for k in commit base lockfile tree integrationBase branch worktree scripts env toolchain tests checks config; do
    [[ $k == lockfile ]] && { key=$(cd "$wt" && git merge-base --is-ancestor "$base" HEAD && prep_key "$base" "$(prep_plan "$base")" "$tests" && prep_key_extra "$tests") \
      || { echo "HEAD isn't on top of ${base:0:12}"; return 1; }; }
    [[ $k == config && $(prep_field "$file" mode) == full ]] && continue
    want=$(sed -n "s/^$k=//p" <<< "$key"); got=$(prep_field "$file" "$k")
    [[ $want == "$got" ]] || { echo "$k changed since the prep (${got:0:40} -> ${want:0:40})"; return 1; }
  done
}

# Compare an already checked key with a receipt, preserving its full context.
prep_receipt_matches() {
  local file=$1 key=$2 k want got
  prep_receipt_key "$file" > /dev/null || return 1
  while IFS='=' read -r k want; do
    got=$(prep_field "$file" "$k")
    [[ $want == "$got" ]] || { echo "$k changed since the prep (${got:0:40} -> ${want:0:40})"; return 1; }
  done <<< "$key"
}

# prep_field <file> <key>: the first value of <key>. sed quits on it rather
# than feeding head, which under pipefail fails a long run of matches with 141.
prep_field() { sed -n "/^$2=/{s///p;q;}" "$1"; }

# prep_reusable <issue> <worktree> <base> [remote]: prints why the receipt can
# or can't stand in for a new prep of the worktree's HEAD on <base>; 0 when it
# can. A full prep's receipt stands in for any plan, but never for another
# test environment or toolchain. Without remote it reads only the local
# prep's receipt, which needs its passing test log (prep_receipt_evidence);
# with remote (a landing under remote checks, whose remote full suite ran on
# the exact tree) only the remote-suite prep's. The modes never cross: a
# receipt of the other mode in a file is refused.
prep_reusable() {
  local n=$1 wt=$2 base=$3 mode=${4:-local} file why
  [[ -z ${4:-} || $4 == remote ]] || { echo "unknown prep reuse mode '$4'"; return 1; }
  file=$(prep_receipt_path "$n" "${4:-}")
  why=$(prep_receipt_usable "$n" "$file" "$mode") || { echo "$why"; return 1; }
  [[ -z $(git -C "$wt" status --porcelain) ]] || { echo "the worktree has uncommitted changes"; return 1; }
  prep_receipt_current "$file" "$wt" "$base" "$mode" || return 1
  echo "receipt $file: $(prep_field "$file" mode) prep ($([[ $mode == remote ]] && echo 'remote suite' || echo local)) of $(prep_field "$file" commit | cut -c1-12) on $(prep_field "$file" base | cut -c1-12) at $(prep_field "$file" finishedAt)"
}
