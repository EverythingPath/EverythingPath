# Wayfinder sessions in this repo

Several `/wayfinder` sessions often run at once against the same map issue and the same shared docs (`GLOSSARY.md`, `docs/pf-character-sheet-data-model.md` with its section files in `docs/character-sheet/`, `docs/adr/`). These rules keep their output separable.

## Commit once per ticket

- When a ticket's write-up is complete (its decision recorded, its doc edits and glossary terms written), commit those files alone, with the ticket number in the subject: `git add <files> && git commit -m "Record decision for #<n>: <summary>"`.
- Push right after committing: `git pull --rebase` first, then `git push`. A concurrent session's commits are normal; resolve a doc conflict by keeping both sessions' text.
- The session ends with no uncommitted edits of its own. Another session's uncommitted edits stay untouched.

## Check state before writing about another ticket

Ticket state moves while a session runs. Before writing that another ticket is pending, open, decided or blocked, re-read it: `gh issue view <n> --json state,title --jq '.state'`, and its latest comments when the decision matters.
