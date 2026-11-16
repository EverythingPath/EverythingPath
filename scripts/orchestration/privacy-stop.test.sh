#!/usr/bin/env bash
# usage: privacy-stop.test.sh — checks privacy-stop.sh, the name check both push paths run, in a scratch repository
# against a fake name list of invented words (never a real one): every word of each quoted name matches
# case-insensitively as a whole word in the added lines of <base>..<tree> (as bytes, whatever their encoding), the paths of its new or changed entries
# (a directory, a file name, a gitlink), its binary blobs (as bytes) and the commit messages of <base>..<head>;
# removed and unchanged lines do not; a match refuses (exit 1) unless the reviewed allowlist names its index under the
# current list's fingerprint; a stale entry refuses; output names a word only by its index with a count of lines;
# an absent list and a GitHub runner skip with one line; an empty list refuses; the override passes and says so.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
dir=$(mktemp -d "${TMPDIR:?TMPDIR}/privacy-stop-test-XXXXXX") || exit 1
trap 'rm -rf "$dir"' EXIT
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=Fixture GIT_AUTHOR_EMAIL=fixture@example.test GIT_COMMITTER_NAME=Fixture GIT_COMMITTER_EMAIL=fixture@example.test
# A worker's shell: a UTF-8 locale, where grep calls invalid UTF-8 binary.
export LC_ALL=C.UTF-8
unset GITHUB_ACTIONS EP_PRIVACY_STOP_OVERRIDE
fail=0
check() { if [[ $2 == "$3" ]]; then echo "ok    $1"; else echo "FAIL  $1: want '$3', got '$2'"; fail=1; fi; }

# The script and paths.sh copied beside an allowlist of the test's own; the real allowlist stays out of it.
bin=$dir/bin
mkdir -p "$bin" "$dir/tmp"
cp "$here/privacy-stop.sh" "$here/paths.sh" "$bin/"
: > "$bin/privacy-stop.allow"
r=$dir/repo
g() { git -C "$r" "$@"; }
git init -q -b main "$r"
export MAIN=$r EP_ORCH=$dir/orch
names=$EP_ORCH/research/party-sheets/transcription.md
mkdir -p "${names%/*}"
# Invented words. Sorted bytewise: #1 Bexil, #2 Quillon, #3 Varrow, #4 Zorrin; list fingerprint aaed03fd6f829050.
words='Bexil Quillon Varrow Zorrin'
printf '# Sheets\n\n- Name "Quillon Varrow"\n- a raven named "Bexil"\n- Name "Zorrin?"\n- Class "Wizard"\n' > "$names"
printf 'base line\nan old Bexil line\nkept Zorrin line\n' > "$r/a.txt"; g add a.txt; g commit -qm base
base=$(g rev-parse HEAD)

# stop <args...>: privacy-stop.sh in the repository; exit status in $status, stdout and stderr in $dir/{out,err}.
stop() { (cd "$r" && TMPDIR=$dir/tmp bash "$bin/privacy-stop.sh" "$@") > "$dir/out" 2> "$dir/err"; status=$?; }
# leaked: how many lines of the last run's output hold an invented word.
leaked() { cat "$dir/out" "$dir/err" | grep -ciwE "${words// /|}"; }
# commit <message> <line...>: a commit on main whose only change appends the lines to b.txt.
commit() { local m=$1; shift; printf '%s\n' "$@" >> "$r/b.txt"; g add b.txt; g commit -qm "$m"; }

commit 'clean change' 'nothing to see' 'Quillonaire is not a word of the list'
stop "$base" HEAD
check "a change without a listed word passes, part of a word never matching" "$status $(cat "$dir/out")" "0 "
check "it says how many words it checked, and over which range" "$(cat "$dir/err")" \
  "privacy stop: 4 words checked over ${base:0:12}..$(g rev-parse --short=12 HEAD): no match"
printf 'base line\nkept Zorrin line\n' > "$r/a.txt"; g commit -qam 'drop a line'
stop "$base" HEAD
check "a removed or unchanged line holding a word does not count" "$status" 0

commit 'add a line' 'a QUILLON line' 'and quillon again'
stop "$base" HEAD
check "an added line with a listed word, in any case, refuses" "$status" 1
check "the refusal names the word by its index and counts its lines" "$(grep -c '^privacy stop: word #2: 2 matching lines$' "$dir/err")" 1
check "and says nothing was pushed" "$(grep -c '^privacy stop: refused: 1 word matches outside the allowlist; nothing is pushed' "$dir/err")" 1
check "no output line holds a listed word" "$(leaked)" 0
check "nothing on stdout" "$(cat "$dir/out")" ""

g reset -q --hard HEAD~1
commit 'Varrow in the subject' 'harmless'
stop "$base" HEAD
check "a commit message with a listed word refuses" "$status $(grep -c '^privacy stop: word #3: 1 matching lines$' "$dir/err") $(leaked)" "1 1 0"
g reset -q --hard HEAD~1

# A tree argument: the added lines are those of <tree>, the messages those of <base>..<head> (wip-ci.sh's snapshot).
printf 'zorrin, uncommitted\n' > "$r/c.txt"
tree=$(GIT_INDEX_FILE=$dir/index bash -c 'git -C "$1" read-tree HEAD && git -C "$1" add -A && git -C "$1" write-tree' _ "$r")
rm "$r/c.txt"
stop "$base" HEAD "$tree"
check "a listed word in the tree's added lines refuses although HEAD lacks it" "$status $(grep -c '^privacy stop: word #4: 1 matching lines$' "$dir/err") $(leaked)" "1 1 0"
stop "$base" HEAD
check "without the tree the same commits pass" "$status" 0

# The allowlist: an index and the fingerprint of the list it was reviewed against, never a word.
commit 'add a line' 'a quillon line'
stop fingerprint
check "fingerprint prints the word count and the list's fingerprint, no word" "$status $(cat "$dir/out") $(leaked)" \
  "0 4 words; list fingerprint aaed03fd6f829050 0"
printf '# reviewed allowlist\n#2 aaed03fd6f829050 a common word in the rules text\n' > "$bin/privacy-stop.allow"
stop "$base" HEAD
check "an allowlisted index passes and is named" "$status $(cat "$dir/err")" \
  "0 privacy stop: 4 words checked over ${base:0:12}..$(g rev-parse --short=12 HEAD): no match outside the allowlist (allowlisted: #2, 1 lines)"
printf -- '- Name "Osk"\n' >> "$names"
stop "$base" HEAD
check "once the list changes the entry is stale and the match refuses" "$status $(grep -c '^privacy stop: word #3: 1 matching lines$' "$dir/err") $(leaked)" "1 1 0"
check "and the stale entry is named by its index" \
  "$(grep -c '^privacy stop: allowlist entries #2 were reviewed against another name list (stale); re-review them against `privacy-stop.sh fingerprint`$' "$dir/err")" 1
printf '#2 aaed03fd6f829050 old\n#3 10d3ef46e1aef985 re-reviewed\n' > "$bin/privacy-stop.allow"
stop "$base" HEAD
check "an entry under the new fingerprint passes again" "$status" 0
printf '#3 nothex\n' > "$bin/privacy-stop.allow"
stop "$base" HEAD
check "a malformed allowlist line refuses" "$status $(grep -c 'privacy-stop.allow line 1 is not' "$dir/err")" "1 1"
: > "$bin/privacy-stop.allow"

# The override: root only; it passes and says it was used.
EP_PRIVACY_STOP_OVERRIDE=1 stop "$base" HEAD
check "the override passes a refused range" "$status" 0
check "and says it was used, still naming only indices" \
  "$(grep -c '^privacy stop: word #3: 1 matching lines$' "$dir/err") $(grep -c '^privacy stop: overridden by EP_PRIVACY_STOP_OVERRIDE=1 (root only): 1 word matches outside the allowlist$' "$dir/err") $(leaked)" "1 1 0"
EP_PRIVACY_STOP_OVERRIDE=yes stop "$base" HEAD
check "any other override value is a usage error" "$status" 64

# Skips: one plain line, exit 0, whatever the range holds.
GITHUB_ACTIONS=true stop "$base" HEAD
check "on a GitHub runner it skips with one line" "$status $(cat "$dir/err")" "0 privacy stop: skipped on a GitHub runner"
mv "$names" "$dir/names.md"
stop "$base" HEAD
check "without the name list it skips with one line" "$status $(cat "$dir/err")" "0 privacy stop: skipped: no name list at $names"
printf '# Sheets\n\nNo quoted names.\n' > "$names"
stop "$base" HEAD
check "a name list that yields no word refuses" "$status $(grep -c 'yields no word' "$dir/err")" "1 1"
mv "$dir/names.md" "$names"

# The push paths' check (published): the lines the built commit's tree adds against <base>, the messages of
# <base>..<head>, and the built commit's own message and the ref name, which carry a gate label or a WIP task. The list
# holds five words here: #1 Bexil, #2 Osk, #3 Quillon, #4 Varrow, #5 Zorrin.
clean=$(g rev-parse HEAD~1)
published=$(printf 'gate: r1\n\nclean body\n' | g commit-tree "$clean^{tree}")
stop published "$base" "$clean" "$published" refs/heads/gate/r1
check "a clean range, published commit and ref pass, saying what was checked" "$status $(cat "$dir/out")$(cat "$dir/err")" \
  "0 privacy stop: 5 words checked over ${base:0:12}..${clean:0:12} and the published commit ${published:0:12} (its object and ref name): no match"
stop published "$base" "$clean" "$(printf 'gate: zorrin-r1\n\nbody\n' | g commit-tree "$clean^{tree}")" refs/heads/gate/r1
check "a listed word in the published commit's message alone refuses" "$status $(grep -c '^privacy stop: word #5: 1 matching lines$' "$dir/err") $(leaked)" "1 1 0"
stop published "$base" "$clean" "$published" refs/heads/wip/varrow-
check "a listed word in the ref name alone refuses" "$status $(grep -c '^privacy stop: word #4: 1 matching lines$' "$dir/err") $(leaked)" "1 1 0"
stop published "$base" "$clean" "$(printf 'wip: r1\n' | g commit-tree "$tree")" refs/heads/wip/r1-
check "the added lines are the published commit's tree's, not <head>'s" "$status $(grep -c '^privacy stop: word #5: 1 matching lines$' "$dir/err") $(leaked)" "1 1 0"
# The published commit's object is checked whole, tree line aside: its author and committer (names and emails, public
# with the commit) and any extra header, not only its message. A match in an identity field says so, by index only.
identity() { grep -c "^privacy stop: word #$1: 1 of those lines in the published commit's author or committer field; root can allowlist #$1 after review (privacy-stop.allow)$" "$dir/err"; }
built() { printf 'gate: r1\n' | env "$@" git -C "$r" commit-tree "$clean^{tree}"; }
stop published "$base" "$clean" "$(built GIT_AUTHOR_NAME='Ann Zorrin')" refs/heads/gate/r1
check "a listed word in the author name alone refuses, saying it is an identity field" \
  "$status $(grep -c '^privacy stop: word #5: 1 matching lines$' "$dir/err") $(identity 5) $(leaked)" "1 1 1 0"
stop published "$base" "$clean" "$(built GIT_COMMITTER_NAME=Quillon)" refs/heads/gate/r1
check "a listed word in the committer name alone refuses, saying it is an identity field" \
  "$status $(grep -c '^privacy stop: word #3: 1 matching lines$' "$dir/err") $(identity 3) $(leaked)" "1 1 1 0"
stop published "$base" "$clean" "$(built GIT_AUTHOR_EMAIL=varrow@example.test)" refs/heads/gate/r1
check "a listed word in an email's local part alone refuses, saying it is an identity field" \
  "$status $(grep -c '^privacy stop: word #4: 1 matching lines$' "$dir/err") $(identity 4) $(leaked)" "1 1 1 0"
extra=$(g cat-file commit "$published" | sed '/^committer /a encoding bexil' | g hash-object -t commit -w --stdin)
stop published "$base" "$clean" "$extra" refs/heads/gate/r1
check "a listed word in an extra header alone refuses" "$status $(grep -c '^privacy stop: word #1: 1 matching lines$' "$dir/err") $(identity 1) $(leaked)" "1 1 0 0"
printf '#5 %s an identity reviewed by root\n' "$(stop fingerprint; cut -d' ' -f5 "$dir/out")" > "$bin/privacy-stop.allow"
stop published "$base" "$clean" "$(built GIT_AUTHOR_NAME=Zorrin)" refs/heads/gate/r1
check "an identity field's word passes once root allowlists its index" "$status" 0
: > "$bin/privacy-stop.allow"
printf -- '- Name "Tree"\n' >> "$names"
stop published "$base" "$clean" "$published" refs/heads/gate/r1
check "the object's tree line is not checked (its keyword and a hex id hold no name)" "$status" 0
sed -i '$d' "$names"
# The published tree against the base tree, entry by entry: every new or changed entry's full path, its content as
# bytes whatever Git's diff calls it (a binary blob whole, matched with grep -a), a symlink's target (its blob, a text
# line) and a gitlink's path. A match in a path or in binary content is named by its class, by index only.
# grown <kind> <path> <content>: a published commit whose tree is $clean's plus one entry: a file (content a printf
# format), a symlink (content its target) or a gitlink (content a commit id).
grown() {
  local mode=100644 blob
  case $1 in
    file) blob=$(printf "$3" | g hash-object -w --stdin) ;;
    link) mode=120000 blob=$(printf %s "$3" | g hash-object -w --stdin) ;;
    gitlink) mode=160000 blob=$3 ;;
  esac
  GIT_INDEX_FILE=$dir/index g read-tree "$clean^{tree}"
  GIT_INDEX_FILE=$dir/index g update-index --add --cacheinfo "$mode,$blob,$2"
  printf 'gate: r1\n' | g commit-tree "$(GIT_INDEX_FILE=$dir/index g write-tree)"
}
class() { grep -c "^privacy stop: word #$1: 1 of those lines in $2 the tree adds or changes$" "$dir/err"; }
stop published "$base" "$clean" "$(grown file art/zorrin-sketches/a.txt 'plain\n')" refs/heads/gate/r1
check "a listed word only in a new file's directory name refuses, saying it is a path" \
  "$status $(grep -c '^privacy stop: word #5: 1 matching lines$' "$dir/err") $(class 5 'a path') $(leaked)" "1 1 1 0"
stop published "$base" "$clean" "$(grown file art/Old_Varrow.md '')" refs/heads/gate/r1
check "a listed word only in an empty new file's name, between an underscore and a dot, refuses as a path" \
  "$status $(grep -c '^privacy stop: word #4: 1 matching lines$' "$dir/err") $(class 4 'a path') $(leaked)" "1 1 1 0"
stop published "$base" "$clean" "$(grown file 'notes/aBexilb-Quillonaire.md' 'clean\n')" refs/heads/gate/r1
check "a listed word inside a longer run of letters or digits in a path does not match" "$status" 0
stop published "$base" "$clean" "$(grown file img/portrait.bin 'PNG\0\001\377 bexil \376\n')" refs/heads/gate/r1
check "a listed word only inside a binary blob (a NUL byte in it) refuses, saying it is binary content" \
  "$status $(grep -c '^privacy stop: word #1: 1 matching lines$' "$dir/err") $(class 1 'binary content') $(leaked)" "1 1 1 0"
stop published "$base" "$clean" "$(grown link docs/latest '../Osk/notes')" refs/heads/gate/r1
check "a listed word only in a symlink's target refuses (its target is a line the tree adds)" \
  "$status $(grep -c '^privacy stop: word #2: 1 matching lines$' "$dir/err") $(class 2 'a path') $(class 2 'binary content') $(leaked)" "1 1 0 0 0"
stop published "$base" "$clean" "$(grown gitlink vendor/quillon "$clean")" refs/heads/gate/r1
check "a listed word only in a gitlink's path refuses as a path" \
  "$status $(grep -c '^privacy stop: word #3: 1 matching lines$' "$dir/err") $(class 3 'a path') $(leaked)" "1 1 1 0"
stop published "$base" "$clean" "$(grown file img/clean.bin 'PNG\0\001\377 nothing here \376\n')" refs/heads/gate/r1
check "a clean binary file passes" "$status" 0
stop published "$base" "$clean" "$(grown file notes/new_file-2.md 'clean\n')" refs/heads/gate/r1
check "a clean new path passes" "$status" 0
# A text blob's added lines are read as bytes, whatever their encoding: Git calls each file below text, while grep in
# a UTF-8 locale calls the diff binary (an invalid UTF-8 byte; a NUL in a file .gitattributes marks `diff`; a Latin-1
# line). A listed word there refuses as text (a Latin-1 byte beside it separates, as any non-letter does); a clean
# file of each kind passes. text_kind: Git's numstat line for the last published commit (a dash when it calls it binary).
text_kind() { g diff --numstat --no-renames "$clean" "$1" | cut -f1 | tr -d '0-9'; }
printf '*.dat diff\n' > "$r/.gitattributes"
for case in 'notes/menu.txt|the quillon caf\351 menu\n|the plain caf\351 menu\n|3|an invalid UTF-8 byte on the line of the word' \
  'data/table.dat|row\0one\nthe quillon\0draft\n|row\0one\nthe plain\0draft\n|3|a NUL, marked diff' \
  'notes/letter.txt|Stra\337e \253Varrow\273\n|Stra\337e \253Plain\273\n|4|a Latin-1 byte on each side of the word'; do
  IFS='|' read -r path listed plain n what <<< "$case"
  made=$(grown file "$path" "$listed")
  stop published "$base" "$clean" "$made" refs/heads/gate/r1
  check "a listed word in a text file with $what refuses as text" \
    "$(text_kind "$made") $status $(grep -c "^privacy stop: word #$n: 1 matching lines$" "$dir/err") $(grep -c 'of those lines in' "$dir/err") $(leaked)" " 1 1 0 0"
  made=$(grown file "$path" "$plain")
  stop published "$base" "$clean" "$made" refs/heads/gate/r1
  check "a clean text file with $what passes" "$(text_kind "$made") $status" " 0"
done
rm "$r/.gitattributes"
stop published "$base" "$clean" "$(grown file notes/accent.txt 'the Quillon\303\253 and \303\251Varrow draft\n')" refs/heads/gate/r1
check "a UTF-8 letter beside a listed word joins it, as an ASCII letter does (the match reads UTF-8 letters)" "$status" 0
stop "$base" "$(grown file art/zorrin.png 'PNG\0 varrow\n')"
check "the range check reads the tree the same way" "$status $(class 5 'a path') $(class 4 'binary content')" "1 1 1"
stop published "$base" "$clean" "$published"
check "published without a ref is a usage error" "$status" 64

stop "$base"
check "a missing head is a usage error" "$status" 64
stop 0000000000000000000000000000000000000000 HEAD
check "a base that is not a commit refuses" "$status" 1

check "no scratch file is left behind, refused runs included" "$(ls -A "$dir/tmp" | wc -l)" 0

# The repository's own allowlist holds indices and fingerprints only, never a word.
check "the reviewed allowlist's entries are '#<n> <16 hex> <reason>' lines" \
  "$(grep -vE '^(#( |$)|$)' "$here/privacy-stop.allow" | grep -cvE '^#[1-9][0-9]* [0-9a-f]{16} [^ ].*$')" 0
check "and no index appears twice under one fingerprint" \
  "$(grep -oE '^#[1-9][0-9]* [0-9a-f]{16} ' "$here/privacy-stop.allow" | sort | uniq -d | wc -l)" 0
exit $fail
