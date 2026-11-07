# push-lib.sh — sourced, never run: the one push path, shared by gate-push.sh (gate mode) and the
# later wip-ci.sh (wip mode; speed-wip-ci design §1). It builds a tree-only commit and pushes it
# to the one checked origin URL as refs/heads/<mode>/<name> and nothing else: no other ref, no
# tag, no force, never over a ref at another commit. Tests: push-guard.test.sh (every ref outside
# the mode's prefix and every move of an existing ref refused) and gate-push.test.sh.
#
#   push_lib_init <name> <mode>        message prefix; mode gate or wip sets the one ref prefix
#   push_require_no_git_config         refuses a set GIT_CONFIG (call it before reading anything)
#   push_origin_url                    checks origin's one push URL and sets push_url
#   push_check_file_sizes <tree>       refuses any file of 100 MB or more, naming each
#   push_tree_commit <tree> <date>     prints a parentless commit of <tree>, message on stdin
#   push_ref <commit> <ref>            pushes <commit> to push_url as <ref>, refs/heads/<mode>/<name>
#
# Each refusal prints "<name>: <reason>" on stderr and exits 1, pushing nothing.
# Every object read runs as git --no-replace-objects: a refs/replace/* entry would show another
# object in place of the one pushed (git-replace(1)), and the push sends the real objects.
push_lib_name=push-lib
push_lib_mode=
push_url=
push_fail() { echo "$push_lib_name: $*" >&2; exit 1; }

push_lib_init() {
  push_lib_name=$1
  [[ $# -eq 2 && ( $2 == gate || $2 == wip ) ]] || push_fail "mode must be gate or wip, not '${2-}'"
  push_lib_mode=$2
}

# The checks below must read the configuration the push applies. GIT_CONFIG makes `git config`
# read that one file, without include.path, and no other git command honours it (git-config(1),
# ENVIRONMENT), so with it set, whatever its value, the script refuses before any read. The other
# variables that change what git reads, GIT_CONFIG_GLOBAL, GIT_CONFIG_SYSTEM, GIT_CONFIG_NOSYSTEM,
# GIT_CONFIG_COUNT/KEY_<n>/VALUE_<n>, GIT_CONFIG_PARAMETERS, and HOME and XDG_CONFIG_HOME for the
# global files, apply to `git config` and `git push` alike, so they stay.
push_require_no_git_config() {
  [[ -z ${GIT_CONFIG+set} ]] \
    || push_fail "GIT_CONFIG is set; only git config reads it, not git push, so the push URL checked could differ from the one pushed"
}

# config_values <git config args...>: the values as NUL records, then the exit status as the last.
# (A process substitution inherits set -e, so the status is caught, not left to end it.)
config_values() { local status=0; git config --null "$@" || status=$?; printf '%s\0' "$status"; }

# One destination: with several, one could accept the push while another refuses it. Git pushes
# to every remote.origin.pushurl, else every remote.origin.url; values are read NUL-separated
# (a value may hold a newline), and the push names the one URL, so configuration read later can
# add none. A config read that fails is refused, never taken as "no value".
push_origin_url() {
  push_require_no_git_config
  local urls rewrites record status url
  mapfile -d '' -t urls < <(config_values --get-all remote.origin.pushurl)
  status=${urls[-1]}; unset 'urls[-1]'
  if [[ $status == 1 ]]; then
    mapfile -d '' -t urls < <(config_values --get-all remote.origin.url)
    status=${urls[-1]}; unset 'urls[-1]'
    [[ $status != 1 ]] || push_fail "no origin remote (no remote.origin.pushurl or remote.origin.url)"
  fi
  [[ $status == 0 ]] || push_fail "git config failed reading origin's URLs"
  [[ ${#urls[@]} -eq 1 ]] || push_fail "origin has ${#urls[@]} push URLs; a $push_lib_mode push needs exactly one"
  url=${urls[0]}
  # Refused: empty, an option-like leading '-', or any C0 control (newline and CR among them), DEL
  # or C1 control (UTF-8 C2 80..9F).
  [[ -n $url && $url != -* && $(printf '%s' "$url" | LC_ALL=C tr -d '\000-\037\177') == "$url" ]] \
    && ! LC_ALL=C grep -q $'\xc2[\x80-\x9f]' <<< "$url" \
    || push_fail "origin's push URL is empty, starts with '-' or contains a control character"
  # Git rewrites a URL, an explicit one too, that starts with a url.<base>.insteadOf or
  # pushInsteadOf value (remote.c alias_url: the longest such prefix). Any that applies is
  # refused, so git applies none. A record is "key\nvalue"; the text after its last newline is the
  # value or, if the value holds a newline (so it cannot prefix the URL), a part of it: a false
  # match only refuses more. A record with no newline is a rewrite with no value.
  mapfile -d '' -t rewrites < <(config_values --get-regexp '^url\..*\.(push)?insteadof$')
  status=${rewrites[-1]}; unset 'rewrites[-1]'
  [[ $status == 0 || $status == 1 ]] || push_fail "git config failed reading url.<base>.insteadOf rewrites"
  for record in "${rewrites[@]}"; do
    [[ $record == *$'\n'* ]] || push_fail "a url.<base>.insteadOf or pushInsteadOf rewrite has no value"
    [[ $url != "${record##*$'\n'}"* ]] || push_fail "a url.<base>.insteadOf or pushInsteadOf rewrite applies to origin's push URL"
  done
  # git push <url> first reads a remote named <url> (remote.<url>.*), whose push URLs would replace
  # the one checked; get-url exits 2 only when no such remote is configured.
  git remote get-url -- "$url" > /dev/null 2>&1 && status=0 || status=$?
  [[ $status == 2 ]] || push_fail "a remote is named by origin's push URL, so a push to it would use that remote's URLs"
  push_url=$url
}

# GitHub refuses a file of 100,000,000 bytes or more.
push_check_file_sizes() {
  local large line
  large=$(git --no-replace-objects ls-tree -r -l -z "$1" | awk -v RS='\0' -v limit=100000000 '
    { split($0, part, "\t"); split(part[1], meta, " ") }
    meta[2] == "blob" && meta[4] + 0 >= limit { printf "%s is %s bytes\n", part[2], meta[4] }')
  [[ -z $large ]] || { while IFS= read -r line; do echo "$push_lib_name: $line, at or over GitHub's 100 MB file limit" >&2; done <<< "$large"; exit 1; }
}

# Author and committer dates are <date>, so the same tree, date and message give the same commit.
push_tree_commit() { GIT_AUTHOR_DATE=$2 GIT_COMMITTER_DATE=$2 git --no-replace-objects commit-tree "$1"; }

# The refspec is built here, <commit>:<ref> with no '+', and the push names the checked URL, so
# remote.origin.push, push.default and push.followTags do not apply. <ref> is exactly
# refs/heads/<mode>/<name> with <name> in [a-z0-9-]+, and <commit> a full SHA of a parentless
# commit: a parentless commit fast-forwards no existing ref, so origin refuses any update of a ref
# at another commit, whoever wrote it, and the same push again is a no-op.
push_ref() {
  [[ $# -eq 2 ]] || push_fail "push_ref takes <commit> <ref>"
  local commit=$1 ref=$2 name header shown
  [[ -n $push_url ]] || push_fail "no checked origin URL; call push_origin_url first"
  # A refused value is shown shell-quoted (printf %q), so a newline in it cannot forge a message line.
  printf -v shown %q "$commit"
  [[ $commit =~ ^[0-9a-f]{40}$ ]] || push_fail "refused commit $shown: not a full SHA"
  # The raw object's header (up to the first blank line) names every parent; a failed read refuses.
  [[ $(git --no-replace-objects cat-file -t "$commit" 2> /dev/null) == commit ]] \
    && header=$(git --no-replace-objects cat-file commit "$commit") \
    && [[ $'\n'${header%%$'\n\n'*} != *$'\n'parent\ * ]] \
    || push_fail "refused commit $commit: not a parentless commit"
  printf -v shown %q "$ref"
  [[ $ref =~ ^refs/heads/$push_lib_mode/[a-z0-9-]+$ ]] \
    || push_fail "refused ref $shown: only refs/heads/$push_lib_mode/<name> ([a-z0-9-]+)"
  name=${ref#refs/heads/}
  git push --no-follow-tags --no-recurse-submodules -- "$push_url" "$commit:$ref" >&2 \
    || push_fail "push of $name failed (an existing $name at another commit, or origin unreachable)"
}
