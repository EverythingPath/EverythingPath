# shellcheck shell=bash
# Sourced by triage-failures.sh (and triage.test.sh): reading vitest JSON reports.

# failures <report>: "file<TAB>fullName" per failed test; fullName is empty for a file that failed outside any test.
failures() {
  if command -v jq >/dev/null; then
    jq -r '.testResults[] | . as $f | ([.assertionResults[] | select(.status == "failed")] as $a
      | if ($a | length) > 0 then $a[] | "\($f.name)\t\(.fullName)"
        elif $f.status == "failed" then "\($f.name)\t" else empty end)' "$1"
  else
    node -e 'for (const f of JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).testResults) {
      const a = f.assertionResults.filter((t) => t.status === "failed");
      if (a.length) for (const t of a) console.log(`${f.name}\t${t.fullName}`);
      else if (f.status === "failed") console.log(`${f.name}\t`);
    }' "$1"
  fi
}

# result <report> <fullName>: "status<TAB>duration" of that test, or nothing if it did not run.
result() {
  [[ -s $1 ]] || return 0
  if command -v jq >/dev/null; then
    jq -r --arg n "$2" 'first(.testResults[].assertionResults[]
      | select(.fullName == $n and (.status == "passed" or .status == "failed"))) | "\(.status)\t\((.duration // 0) * 10 | round / 10)"' "$1"
  else
    node -e 'const t = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).testResults.flatMap((f) => f.assertionResults)
      .find((t) => t.fullName === process.argv[2] && ["passed", "failed"].includes(t.status));
    if (t) console.log(`${t.status}\t${Math.round((t.duration ?? 0) * 10) / 10}`);' "$1" "$2"
  fi
}

# report_says_failed <report>: true when the report's own totals say the run failed.
report_says_failed() {
  node -e 'const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    process.exit(r.success === false || r.numFailedTests > 0 || r.numFailedTestSuites > 0 ? 0 : 1);' "$1"
}

# failed_tests <report> <suite status>: prints failures() for a report the gate can
# trust, else explains why on stderr and returns 1. It fails closed: a missing,
# empty or unparsable report, or a failed suite (or report) that lists no failure.
failed_tests() {
  local report=$1 status=$2 out
  [[ -s $report ]] || { echo "no JSON report produced" >&2; return 1; }
  out=$(failures "$report" 2>/dev/null) || { echo "the JSON report could not be parsed" >&2; return 1; }
  if [[ -z $out ]]; then
    (( status == 0 )) || { echo "the suite exited $status but its report lists no failure" >&2; return 1; }
    ! report_says_failed "$report" 2>/dev/null || { echo "the report says the run failed but lists no failure" >&2; return 1; }
    return 0
  fi
  printf '%s\n' "$out"
}
