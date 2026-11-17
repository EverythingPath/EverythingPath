#!/usr/bin/env bash
# usage: push-scan.test.sh — the repo-wide static push scan (speed-wip-ci design §1, W3): no tracked file runs a
# `git push` outside the one push path. Threat model: accidents by cooperative agents (owner 2026-11-07), so the
# scan catches the ordinary forms of a push command: a shell line (`git push`, `git -C <dir> push` with the dir bare
# or quoted, spaces included, `git -c k=v push`, in a substitution, a continuation or a Makefile recipe) and an argv
# list, on one line or several (`['git', '-C', root, 'push']` in Python, `'git', ['-C', dir, 'push']` in
# JavaScript); a push built in a string, behind an alias or a variable is out of scope. Lines that are only a comment (# or //)
# and Markdown files are prose. The allowlist is explicit: the push path itself (gate-push.sh, wip-ci.sh and
# push-lib.sh), the git-guardrails hook that names `git push` to block it, and this file, whose fixtures below are
# the scan's RED and GREEN cases. Fixtures run in a scratch repository; then the scan runs over this checkout.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
root=$(git -C "$here" rev-parse --show-toplevel) || exit 1
dir=$(mktemp -d "${TMPDIR:?TMPDIR}/push-scan-test-XXXXXX") || exit 1
trap 'rm -rf "$dir"' EXIT
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
fail=0
check() { if [[ $2 == "$3" ]]; then echo "ok    $1"; else echo "FAIL  $1: want '$3', got '$2'"; fail=1; fi; }

allowed=(
  scripts/orchestration/gate-push.sh
  scripts/orchestration/wip-ci.sh
  scripts/orchestration/push-lib.sh
  .agents/skills/git-guardrails-claude-code/scripts/block-dangerous-git.sh
  scripts/orchestration/push-scan.test.sh
)
# The matcher reads each tracked text file that names push, whole, so a form may span lines. Comment-only lines are
# blanked first (offsets kept, so line numbers stay true). Two forms:
# - shell: git, any options (-C <dir> or -c <key=value>, each a bare or quoted word, quotes holding spaces;
#   --flag[=value]), then the push subcommand, with a backslash-newline continuation counted as a space;
# - argv: a 'git' string, then any string, name, attribute or simple call elements, then a 'push' string, across
#   lines, as in Python's ['git', '-C', root, 'push'] or JavaScript's ('git', ['-C', dir, 'push']).
matcher=$(cat << 'PY'
import re, sys
from pathlib import Path

WORD = r'''(?:"[^"\n]*"|'[^'\n]*'|[^\s"';&|()]+)'''
OPTION = r'(?:-[Cc](?:[ \t]|\\\n)+%s|--?[A-Za-z0-9][A-Za-z0-9-]*(?:=%s)?)' % (WORD, WORD)
GAP = r'(?:[ \t]|\\\n)+'
SHELL = re.compile(r'(?:^|(?<=[^\w.-]))git(?:%s%s)*%spush(?![\w-])' % (GAP, OPTION, GAP), re.M)
STRING = r'''(?:[rbfu]{0,2}"[^"\n]*"|[rbfu]{0,2}'[^'\n]*'|`[^`\n]*`)'''
ELEMENT = r'(?:%s|[A-Za-z_][\w.]*(?:\([^()\n]*\))?)' % STRING
ARGV = re.compile(r'''["'`]git["'`]\s*,\s*(?:\[\s*)?(?:%s\s*,\s*)*?["'`]push["'`]''' % ELEMENT)
COMMENT = re.compile(r'^[ \t]*(?:#|//).*$', re.M)

root = Path(sys.argv[1])
for name in sys.stdin.buffer.read().split(b'\0'):
    if not name:
        continue
    path = name.decode('utf-8', 'surrogateescape')
    text = (root / path).read_bytes().decode('utf-8', 'replace')
    blanked = COMMENT.sub(lambda m: ' ' * len(m.group()), text)
    lines = text.split('\n')
    for pattern in (SHELL, ARGV):
        for match in pattern.finditer(blanked):
            line = text.count('\n', 0, match.start()) + 1
            print('%s:%d:%s' % (path, line, lines[line - 1]))
PY
)

# Candidates: tracked text files holding push and a git word followed by a space, a backslash at the line's end or a
# quote, which both forms need (a fixed-string search first: the catalog's JSON is most of the tracked bytes).
candidate='(^|[^[:alnum:]_.-])git([[:space:]]|\\$|["'"'"'`])'

# scan <checkout>: each tracked push outside the allowlist, as path:line:text (the line where it starts).
scan() {
  local spec=(. ':(exclude)*.md') path
  for path in "${allowed[@]}"; do spec+=(":(exclude,literal)$path"); done
  git -C "$1" grep -lzIF -e push -- "${spec[@]}" | (cd "$1" && xargs -0 -r grep -lZE -e "$candidate" --) \
    | python3 -B -I -c "$matcher" "$1"
}

# Fixtures: a scratch repository whose tracked files hold each form.
f=$dir/fixture
git init -q "$f"
put() { mkdir -p "$f/$(dirname "$1")"; printf '%s\n' "$2" > "$f/$1"; }
# RED: each must be found.
red=(
  run.sh 'git push origin main'
  dir.sh 'git -C "$wt" push --force origin HEAD'
  config.sh 'out=$(git -c push.default=current push)'
  chained.sh 'git fetch && git push --tags'
  tool.py "subprocess.run(['git', 'push', 'origin', 'main'])"
  tool.mjs 'execFileSync("git", ["push", "--tags"])'
  Makefile $'publish:\n\tgit push'
  notes.txt 'then git push it'
  scripts/orchestration/gate-push.test.sh 'git push "$origin" x'
  other/push-lib.sh 'git push "$url"'
  # r1 (both reviews): a -C path with spaces, a continuation, the -C argv call and a multiline argv list.
  spaces.sh 'git -C "a path with spaces" push origin main'
  single.sh "git -C '/a path/x' -c core.x=1 push"
  continued.sh $'git -C "$wt" \\\n  push origin main'
  argv-c.py "subprocess.run(['git', '-C', root, 'push', 'origin', 'main'])"
  argv-call.py "subprocess.check_call(['git', '-C', str(root), 'push'])"
  argv-c.mjs "execFileSync('git', ['-C', dir, 'push', 'origin'])"
  multiline.py $'subprocess.run(\n    [\n        "git",\n        "-C",\n        root,\n        "push",\n        "origin",\n    ],\n    check=True,\n)'
)
# GREEN: none may be found.
green=(
  README.md 'Run git push origin main.'
  docs/guide.md '`git -C x push`'
  comment.sh '  # git push origin main'
  comment.ts '  // git push origin main'
  words.sh 'gh push; git-push-helper; github push; digit push; git pushd; git status && echo push'
  argv-other.py $'subprocess.run(["git", "fetch"])\nsubprocess.run(["git", "status"])\nlog("push")'
  argv-words.py "names = ['git', 'gitpush', 'pushd', 'git-push']"
  scripts/orchestration/gate-push.sh 'git push "$url" x'
  scripts/orchestration/wip-ci.sh 'git push "$url" x'
  scripts/orchestration/push-lib.sh 'git push "$url" x'
  .agents/skills/git-guardrails-claude-code/scripts/block-dangerous-git.sh '"git push"'
  scripts/orchestration/push-scan.test.sh 'git push fixture'
)
for ((i = 0; i < ${#red[@]}; i += 2)); do put "${red[i]}" "${red[i + 1]}"; done
for ((i = 0; i < ${#green[@]}; i += 2)); do put "${green[i]}" "${green[i + 1]}"; done
put untracked.sh 'git push origin main'
git -C "$f" add -A -- . ':!untracked.sh'
found=$(scan "$f" | cut -d: -f1 | sort -u | paste -sd ' ')
want=$(for ((i = 0; i < ${#red[@]}; i += 2)); do echo "${red[i]}"; done | sort -u | paste -sd ' ')
check "the scan finds every RED fixture and no GREEN one" "$found" "$want"
check "an untracked file is not scanned" "$(scan "$f" | grep -c '^untracked.sh:')" 0

# This checkout: no tracked push outside the allowlist.
found=$(scan "$root")
[[ -z $found ]] || printf '%s\n' "$found" | sed 's/^/      /'
check "no tracked file outside the allowlist runs git push" "$(printf '%s' "$found" | grep -c .)" 0
exit $fail
