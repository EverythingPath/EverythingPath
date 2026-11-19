#!/usr/bin/env bash
# usage: privacy-stop.sh <base> <head> [<tree>]                 the range check; prints only to stderr
#        privacy-stop.sh published <base> <head> <commit> <ref>  the push paths' check; prints only to stderr
#        privacy-stop.sh fingerprint                            the name list's word count and fingerprint, for an allowlist entry
# The privacy stop both push paths run once the parentless commit to be pushed is built and before anything is pushed
# (`published`: gate-push.sh over BASE..REVIEWED, wip-ci.sh over Wip-Base..HEAD). A push publishes one commit object,
# one tree and one ref name, and each part is read by one rule:
#   - the commit object: every line of its raw object but the tree line (a keyword and a hex id): its headers, author
#     and committer names and emails, any extra header such as gpgsig or encoding, and the whole message, which carries
#     the gate label or the WIP task; a parentless commit has no parent line;
#   - the tree, against <base>'s tree, entry by entry (every entry new or changed, renames off, so a renamed file is a
#     new one; an entry unchanged against <base> is <base>'s and not read):
#       its full path, every entry's (path rule: the text rule's whole word, where any character but a letter, digit
#       or `_` separates, with `_` a separator too, as file names use it: `a/Word-b.md` and `a_Word.png` hold the
#       word; `aWordb` does not, as `Wordy` in text does not, so a short name inside a longer word never refuses);
#       a text blob's added lines (text rule), a symlink's target among them (its blob, one line) and a gitlink's
#       recorded commit (a "Subproject commit <hex id>" line); .gitmodules is a text blob;
#       a blob the diff calls binary (a NUL byte, an attribute), whole, as bytes (binary rule: grep -a, the same match;
#       not only the bytes its old blob lacks, so pre-existing bytes can refuse, a false alarm root reviews);
#       its file modes, which are octal digits and carry no text;
#   - the ref name it is pushed as;
# and, beside what is published, the commit messages of <base>..<head>, the history it was made from.
# Every word of each quoted name in the party sheets' transcription, $EP_ORCH/research/party-sheets/transcription.md
# (read here at run time; it never enters the repository), is matched case-insensitively as a whole word, bytes read
# as they are, against those (the range check: the tree <tree>, default <head>, against <base>, and the messages of
# <base>..<head>). A match in a path, in binary content or in the commit's author or committer line is named as such:
# the committer is the pushing machine's git identity, so a word of it refuses every push until root reviews it and
# allowlists its index. The words are those of `Name "..."` and `named "..."`, split at spaces, `?` dropped, sorted
# bytewise and deduplicated; a word is named only by its index in that list ("word #4: 2 matching lines"), never by
# its text, and no matching line, path or byte is printed.
# Bytes, whatever their encoding: the script runs in the C locale, so no tool between an object and the match (git's
# output into scratch files, grep, sed, tr, read) decodes a byte, and every grep reading them takes -a, since even the
# C locale calls a NUL binary and prints its notice instead of the line; so an invalid UTF-8 byte (a Latin-1 file) or a
# NUL (a file .gitattributes marks `diff`) in a file Git calls text hides no line. No object passes through a command
# substitution or a variable, so no NUL is dropped. The match alone runs in C.UTF-8: a letter is any UTF-8 letter
# (`Wordé` does not hold `Word`), a byte that is no valid UTF-8 (a NUL, a Latin-1 byte) separates as a space does; a
# list word with a non-ASCII letter matches its UTF-8 spelling in any case, never a legacy encoding's other bytes.
# A match refuses (exit 1) unless privacy-stop.allow, the reviewed allowlist beside this script, has a line
# "#<index> <fingerprint> <reason>" whose fingerprint is the current list's (`privacy-stop.sh fingerprint`: the first
# 16 hex digits of the sha256 of the sorted list, one word per line). An index alone is not stable: a name added to the
# sheets, or another sort order, moves every word after it, so an entry reviewed against another list is stale, is
# named as such and allows nothing. The fingerprint is of the whole list, so it confirms no single word.
# Skipped with one line, exit 0, on a GitHub runner (GITHUB_ACTIONS=true) and when the transcription is absent; a
# transcription that yields no word refuses. EP_PRIVACY_STOP_OVERRIDE=1 (root only) passes a refused check and says
# it was used. Exit 64 is a usage error. Tests: privacy-stop.test.sh (gate-push.test.sh and wip-ci.test.sh: no push
# after a refusal of either check).
set -euo pipefail
export LC_ALL=C
here=$(cd "$(dirname "$0")" && pwd)
say() { echo "privacy stop: $*" >&2; }
usage() {
  [[ $# -eq 0 ]] || say "$*"
  echo "usage: privacy-stop.sh <base> <head> [<tree>] | published <base> <head> <commit> <ref> | fingerprint" >&2
  exit 64
}
refuse() { say "$*"; exit 1; }

# load_words: sets words (the sorted list), count and fingerprint; without the list it skips (exit 0).
load_words() {
  local names=$orch/research/party-sheets/transcription.md quoted status
  if [[ ! -e $names ]]; then say "skipped: no name list at $names"; exit 0; fi
  # The rule of the orchestrator's name-check.sh, with the sort fixed (bytewise) so an index means one word.
  quoted=$(grep -aoE '(Name|named) "[^"]+"' "$names") && status=0 || status=$?
  [[ $status -le 1 ]] || refuse "cannot read the name list at $names"
  words=$(sed -E 's/^(Name|named) "//; s/"$//; s/\?//g' <<< "$quoted" | tr ' ' '\n' | { grep -av '^$' || true; } | LC_ALL=C sort -u)
  [[ -n $words ]] || refuse "the name list at $names yields no word, so nothing can be checked; nothing is pushed"
  count=$(wc -l <<< "$words")
  fingerprint=$(sha256sum <<< "$words" | cut -c1-16)
}

# require <type> <rev>...: each rev names an object of that type (commit or tree).
require() {
  local type=$1 rev
  for rev in "${@:2}"; do
    git rev-parse -q --verify "$rev^{$type}" > /dev/null || refuse "$(printf %q "$rev") names no $type; nothing is pushed"
  done
}

# read_allowlist: sets allowed, the indices reviewed against this list's fingerprint, and names the stale entries.
read_allowlist() {
  local allow=$here/privacy-stop.allow line n=0 stale=()
  allowed=()
  [[ -e $allow ]] || return 0
  while IFS= read -r line || [[ -n $line ]]; do
    n=$((n + 1))
    [[ $line =~ ^(#( .*)?)?$ ]] && continue
    [[ $line =~ ^#([1-9][0-9]*)\ ([0-9a-f]{16})\ [^\ ] ]] \
      || refuse "privacy-stop.allow line $n is not '#<index> <16-hex fingerprint> <reason>'; nothing is pushed"
    if [[ ${BASH_REMATCH[2]} == "$fingerprint" ]]; then allowed+=("${BASH_REMATCH[1]}"); else stale+=("#${BASH_REMATCH[1]}"); fi
  done < "$allow"
  [[ ${#stale[@]} -eq 0 ]] \
    || say "allowlist entries ${stale[*]} were reviewed against another name list (stale); re-review them against \`privacy-stop.sh fingerprint\`"
}

# tree_text <base> <tree>: what <tree> publishes against <base>'s tree, entry by entry (every entry new or changed,
# renames off, so a renamed file is a new one): into $text the lines its text blobs add (a symlink's target and a
# gitlink's "Subproject commit <id>" are such lines, .gitmodules is a text file); into $paths each entry's full path,
# one per line, `_` read as a separator as `/`, `.` and `-` are; into $binary every blob the diff calls binary, whole
# (its bytes, a NUL or an attribute's `binary` whatever made it so, never decoded). File headers stay out of $text:
# the paths are in $paths. A failed read refuses.
tree_text() {
  local line
  git --no-replace-objects diff --no-color --no-ext-diff --no-textconv --no-renames --output-indicator-new='>' "$1" "$2" \
    > "$text" || refuse "git diff failed; nothing is pushed"
  # Every added line starts with '>' and no header line does (--output-indicator-new; renames and copies are off); -a
  # keeps a line holding a NUL or an invalid UTF-8 byte, which a diff Git calls text can hold.
  { grep -a '^>' "$text" || [[ $? == 1 ]]; } > "$text.added" && mv "$text.added" "$text" \
    || { rm -f "$text.added"; refuse "reading the diff failed; nothing is pushed"; }
  git --no-replace-objects diff-tree -r -z --no-renames --name-only --diff-filter=d "$1" "$2" > "$paths" \
    && tr '\0_' '\n ' < "$paths" > "$paths.lines" && mv "$paths.lines" "$paths" \
    || { rm -f "$paths.lines"; refuse "reading the tree's paths failed; nothing is pushed"; }
  # --numstat -z prints "-<TAB>-<TAB><path><NUL>" for a blob the diff calls binary.
  git --no-replace-objects diff --numstat -z --no-ext-diff --no-textconv --no-renames --diff-filter=d "$1" "$2" \
    > "$binary.stats" || refuse "reading the tree's binary files failed; nothing is pushed"
  while IFS= read -r -d '' line; do
    [[ $line == -$'\t'-$'\t'* ]] || continue
    { git --no-replace-objects cat-file blob "$2:${line#-$'\t'-$'\t'}" && echo; } >> "$binary" \
      || refuse "reading a binary file of the tree failed; nothing is pushed"
  done < "$binary.stats"
  rm -f "$binary.stats"
}

# range_text <base> <head> <tree>: tree_text <base> <tree>, then into $text the commit messages of <base>..<head>.
range_text() {
  tree_text "$1" "$3"
  git --no-replace-objects log --format=%B "$1..$2" >> "$text" || refuse "git log failed; nothing is pushed"
}

# published_text <commit> <ref>: appends to $text every line of the raw object about to be pushed but its tree line
# (a keyword and a hex id): its headers, author and committer (names and emails) and any extra one such as gpgsig or
# encoding included, and its whole message; then the ref name it is pushed as. Its author and committer lines also go
# to $identity, so a match there can be named as one.
published_text() {
  git --no-replace-objects cat-file commit "$1" > "$identity" || refuse "git cat-file failed; nothing is pushed"
  sed '1{/^tree /d}' "$identity" >> "$text" || refuse "reading the published commit failed; nothing is pushed"
  sed -n '/^$/q; /^author /p; /^committer /p' "$identity" > "$identity.fields" && mv "$identity.fields" "$identity" \
    || { rm -f "$identity.fields"; refuse "reading the published commit failed; nothing is pushed"; }
  printf '%s\n' "$2" >> "$text"
}

# count <word> <file>: the lines of <file> holding <word> case-insensitively as a whole word, read as bytes (grep -a),
# in C.UTF-8 so a UTF-8 letter is a letter and any other byte that is no letter or digit separates.
count() { LC_ALL=C.UTF-8 grep -aciwF -- "$1" "$2" || true; }

# report <what>: each word's count of matching lines in $text, $paths and $binary, a word named only by its index, a
# match in a path, in binary content or in the author or committer field named as one; passes or refuses.
report() {
  local word c p b k i=0 hits=0 passed=() matches
  while IFS= read -r word; do
    i=$((i + 1))
    c=$(count "$word" "$text") p=$(count "$word" "$paths") b=$(count "$word" "$binary")
    c=$((c + p + b))
    [[ $c -gt 0 ]] || continue
    if [[ " ${allowed[*]} " == *" $i "* ]]; then passed+=("#$i, $c lines"); continue; fi
    hits=$((hits + 1))
    say "word #$i: $c matching lines"
    # The committer is the pushing machine's git identity: a word of it would refuse every push until root reviews it.
    [[ $p == 0 ]] || say "word #$i: $p of those lines in a path the tree adds or changes"
    [[ $b == 0 ]] || say "word #$i: $b of those lines in binary content the tree adds or changes"
    k=$(count "$word" "$identity")
    [[ $k == 0 ]] || say "word #$i: $k of those lines in the published commit's author or committer field; root can allowlist #$i after review (privacy-stop.allow)"
  done <<< "$words"
  [[ $hits -eq 1 ]] && matches="1 word matches" || matches="$hits words match"
  if [[ $hits -gt 0 ]]; then
    if [[ ${EP_PRIVACY_STOP_OVERRIDE:-} == 1 ]]; then say "overridden by EP_PRIVACY_STOP_OVERRIDE=1 (root only): $matches outside the allowlist"; exit 0; fi
    refuse "refused: $matches outside the allowlist; nothing is pushed (privacy-stop.sh: review the range, or root's EP_PRIVACY_STOP_OVERRIDE=1)"
  fi
  [[ -z ${EP_PRIVACY_STOP_OVERRIDE:-} ]] || say "EP_PRIVACY_STOP_OVERRIDE=1 is set (root only) but not needed"
  if [[ ${#passed[@]} -gt 0 ]]; then
    say "$count words checked over $1: no match outside the allowlist (allowlisted: $(IFS=';'; echo "${passed[*]}" | sed 's/;/; /g'))"
  else
    say "$count words checked over $1: no match"
  fi
}

case ${1-} in
  fingerprint) [[ $# -eq 1 ]] || usage ;;
  published) [[ $# -eq 5 && -n $5 ]] || usage ;;
  *) [[ $# -eq 2 || $# -eq 3 ]] || usage ;;
esac
[[ -z ${EP_PRIVACY_STOP_OVERRIDE:-} || $EP_PRIVACY_STOP_OVERRIDE == 1 ]] || usage "EP_PRIVACY_STOP_OVERRIDE is 1 or unset"
if [[ ${GITHUB_ACTIONS:-} == true ]]; then say "skipped on a GitHub runner"; exit 0; fi
. "$here/paths.sh"
load_words
if [[ $1 == fingerprint ]]; then echo "$count words; list fingerprint $fingerprint"; exit 0; fi
if [[ $1 == published ]]; then require commit "$2" "$3" "$4"; else require commit "$1" "$2"; require tree "${3:-$2}"; fi
read_allowlist
# The text checked, in a scratch file (a gate diff can add tens of MB).
scratch_dir=${TMPDIR:-$repos/.ep-tmp}
mkdir -p "$scratch_dir" && text=$(mktemp "$scratch_dir/privacy-stop-XXXXXX") || refuse "cannot make a scratch file in $scratch_dir; nothing is pushed"
identity=$text.identity paths=$text.paths binary=$text.binary
trap 'rm -f "$text" "$identity" "$paths" "$binary" "$binary.stats"' EXIT
: > "$identity" && : > "$binary" || refuse "cannot make a scratch file in $scratch_dir; nothing is pushed"
if [[ $1 == published ]]; then
  range_text "$2" "$3" "$4"
  published_text "$4" "$5"
  report "$(git rev-parse --short=12 "$2")..$(git rev-parse --short=12 "$3") and the published commit $(git rev-parse --short=12 "$4") (its object and ref name)"
else
  range_text "$1" "$2" "${3:-$2}"
  report "$(git rev-parse --short=12 "$1")..$(git rev-parse --short=12 "$2")"
fi
