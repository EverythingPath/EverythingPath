# Safe browser harness

Issues #23 and #24 supply the harness and dedicated service cohort. Issue #25
adds the required organization-access journey and aggregate CI gate. Issue #26
adds the existing-militia setup journey, and issue #27 adds the shared character
and officer ledger journey, to that same gate. Issue #28 adds the complete-week
journey, and issue #29 adds shared Action Slot staging. Normal runs verify existing Clerk users, roles and memberships; they never create or repair
them. Session sign-in and Clerk testing tokens are the expected authentication
writes.

## Local Convex on this machine

Use Docker and the same declared Clerk development cohorts to keep development
E2E database I/O off Convex Cloud:

```bash
pnpm test:e2e:local --preflight
pnpm test:e2e:local --workers 2 --budget-minutes 40
pnpm test:e2e:local --suite mandatory --suite focused --group sheet --workers 2
pnpm test:e2e:local --suite nightly --workers 2 --budget-minutes 45
pnpm test:e2e:local --suite release --budget-minutes 40
pnpm test:e2e:local --journey character-attacks.spec.ts
```

The local wrapper takes the same `--suite`, `--group` and `--journey` options
as Cloud runs (see [Suites](#suites-752)), with the same scope line, required
results, checkpoint and interruption counts.

The local wrapper defaults to `e2e/.private/resources.json` and
`e2e/.private/test-secrets.env`; override either with `--resources` or `--secrets`.
It opts this reviewed checkout into trusted execution. Install the browsers
with `pnpm exec playwright install chromium firefox webkit` (and their OS
dependencies). Docker must be running and able to pull the pinned image in
`scripts/local-convex/backend.ts` on first use.

The local preflight also checks that the Docker daemon answers and the pinned
image is present, pulling it if not (setup stage `local-backend`); it starts no
container.

Every non-preflight run starts a new loopback-only Docker backend and removes
its container and anonymous volume after the run, including ordinary failures
and interruptions. Startup (image check, every Docker call, the readiness wait
and the instance check) ends by the browser stop point less a 30-second cleanup
reserve, and at once on Ctrl+C or SIGTERM; it then removes the container it
created within that reserve and fails as `environment (timeout)` or
`environment (terminated)` with a line naming the cause. Removing the
container is its own cleanup step (`local-backend`): if `docker rm` fails, the
run reports `E2E cleanup failed: local-backend (...)` and still deletes the
temporary directory with `convex.env` and `local-admin.key`. It uses the same production web build, real Clerk sign-in,
fixture capabilities, production denylist, cohort isolation and browser journeys
as the Cloud harness. Release qualification uses the local instance's admin key
and checks its instance name before sending that key. No Convex Cloud deploy
key is needed; an existing declared preview key is validated but discarded.
Clerk requests still go to the dedicated development app.

The resource declaration keeps `team`, `project` and `previewName` for compatibility;
`previewName` names the local fixture namespace and exclusive slot. Each run has
a separate generated backend instance name. Development's persistent backend
and database are never used by E2E. Private temporary files live under the repo
parent's `.ep-tmp/local-e2e/`; safe reports remain in `e2e-artifacts/`.

For a clean orchestration worktree, add `--backend local` to
`scripts/orchestration/e2e-branch.sh`; it combines with any suite or journey
selection, for example
`scripts/orchestration/e2e-branch.sh /abs/worktree --backend local --suite focused --group sheet`
or `scripts/orchestration/e2e-branch.sh /abs/worktree --backend local --journey private-character.spec.ts`.
The generic `pnpm test:e2e` and CI continue to use Cloud previews unless
explicitly passed `--backend local`; CI runs every suite on Cloud. Remaining
Cloud preview runs still consume Cloud database I/O.

After a machine crash or SIGKILL, or a reported `local-backend` cleanup
failure, inspect `docker ps -a --filter label=dev.everythingpath.local-convex`
and the slot lock before recovery. Remove only the abandoned `ep-e2e-...`
container with `docker rm -f -v <name>`, then, after a crash, its run directory
under `.ep-tmp/local-e2e/` (it holds that backend's `convex.env` and
`local-admin.key`) and the stale lock after checking no run process remains. Do
not remove an `ep-dev-...` volume; it contains persistent development data.

### Reuse a prepared environment (#754)

A diagnostic run can skip the deploy (about 16 s) and the production build
(about 32 s) by reusing the environment an earlier `--reuse` run prepared:

```bash
pnpm test:e2e:local --journey character-attacks.spec.ts --reuse
scripts/orchestration/e2e-branch.sh /abs/worktree --backend local --suite focused --group sheet --reuse
pnpm test:e2e:local --discard-prepared   # remove it
```

- **Diagnosis only.** `--reuse` needs `--backend local` and a diagnostic
  selection: `--journey`, `--suite nightly --journey`, or `--suite focused
--group ...` alone. It is a usage error before any setup with mandatory, live,
  the whole nightly suite, release, `--preflight` (the queue's preflight), a
  Cloud preview, `CI` or `--outer-deadline-epoch`. A run that reused an
  environment records `"preparation": "reused"` in `report.json` and
  `progress.json`; its result line, and the wrapper's summary line, end with
  `preparation: reused (diagnostic, not qualifying)`; it never writes
  `GITHUB_OUTPUT`; and it exits **5** even when every result passed, so it can
  never satisfy a gate ("Done: exit 0" in the orchestration runbook). A `--reuse`
  run that found nothing reusable prepares afresh: that run's evidence is
  fresh, and its environment is kept for the next one.
- **What is kept.** `<repo parent>/.ep-tmp/e2e-prepared/<previewName>-<12 hex
of the checkout path's SHA-256>/` (mode 0700): `record.json` (0600, no secret)
  and `workspace/` (the sources, `node_modules` and the built `.next`), plus the
  stopped `ep-e2e-...` container with its volume and loopback ports. No process
  survives a run: the container is `docker stop`ped, and `next start` runs from
  the kept build each run under Playwright, which the reap step stops as usual.
- **When it is reused.** The record holds the reuse fingerprint, the target
  (hashes of the resource declaration and publishable key, the slot and the
  Clerk host), the worker count, the release state (always none: release runs
  never keep an environment), the backend image, instance and URLs, the Write
  Gate epoch and the preparation time. A run reuses it only when every part
  matches (its worker count may be lower), it is less than 24 hours old, the
  container passes the ownership, image and loopback-port checks, starts,
  answers with its instance name, still reports the recorded epoch (a read bounded by the browser stop point and 30 s), and the sources still match after the wait; an edit made while it resumed means it is not reused.
  Otherwise the run removes it (label-checked `docker rm -f -v`, then the
  directory), prints `preparing afresh (<part> changed)`, and prepares a new one.
  A run without `--reuse` discards any kept environment for its checkout and
  slot.
- **The reuse fingerprint** hashes the same files as the run's source
  fingerprint, **except top-level `e2e/*.spec.ts`**; the effective build
  environment (the sorted names of the deploy and build variables, plus the
  values of `NODE_ENV`, `NEXT_PUBLIC_*`, `CI` and `E2E_FORCE_FAILURE`; secret and
  per-run values never enter it); the actual Node and pnpm versions; and the
  installed dependencies (`node_modules/.modules.yaml`,
  `node_modules/.pnpm/lock.yaml` and the `.pnpm` package directory names). A
  file patched by hand in `node_modules` is not detected. The full source
  fingerprint stays the run's evidence only. Excluding specs is safe because
  nothing built or deployed imports one (`support/source-evidence.test.ts`
  checks every import); a reused workspace gets exactly the checkout's specs,
  edited, deleted and renamed ones included.
- **Every run, reused or not,** repeats trusted execution, the preflight and
  read-only Clerk checks, the Docker and image check, the slot lock, a new
  private directory and admin key file, a fresh fixture session and cohort
  capabilities bound before any worker starts, the generated-bindings check,
  each worker's epoch read, per-test `resetCase` with the isolation canary,
  the identity projection and fresh role storage.
- **Ownership.** The key includes the checkout and slot, so the slot lock,
  taken first, excludes other runs; under it the run marks the record `in-use`
  with its lock token. A record another run left `in-use` is discarded if its
  container is stopped (a crash or reboot), and refused if it is running, with
  `E2E setup failed: prepared-environment (validation)`; nothing is removed
  automatically then. Check `docker ps` and `pgrep -af e2e/run`, then use
  `--discard-prepared`.
- **Kept only after a clean run.** Cleanup runs `processes`,
  `release-admin-key`, `local-backend` (stop, keeping the container, only after
  a whole run with no survivors, no interruption, no case left behind by a
  failed cleanup, the Write Gate epoch it was prepared with, and no env or key
  file or Clerk secret in the workspace; otherwise remove it),
  `temporary-directory` (the run's `convex.env`, `local-admin.key`,
  `fixture-config.json` and `run.json`), `prepared-environment` and `slot-lock`.
  The record becomes `ready` only after the private files are gone; if their
  deletion fails, the environment is discarded. A journey that failed with its
  cleanups intact keeps the environment: that is the diagnosis case. If the
  wrapper had to SIGKILL the runner, the record stays `in-use` with a running
  container, so the next `--reuse` run refuses it until you recover by hand.

Code generation for the merge gate (`scripts/orchestration/codegen.sh`) pushes
to an empty disposable database, so it does not check a schema change against
existing documents; a real deploy remains that check.

The sections below describe the Cloud preview path unless stated otherwise.

## Declared resources

Copy `e2e/resources.example.json` to an ignored location such as
`e2e/.private/resources.json` and replace every placeholder. Use a dedicated
Clerk **development** application and a Convex **preview creation** key:
`preview:team:project|secret`. A deployment key, personal development target,
production key, project key or management token is not accepted.

Each cohort contains one GM/admin and player in its member organization and an
outsider in a separate organization. Each user must have exactly that membership.
Configure Clerk's `convex` JWT template as required by the existing application.
The public key's host, the secret key's development instance and both JWKS must
agree. Fill in the real production Clerk hosts and Convex URLs in the denylist.
If you have no Clerk production environment, set `production.clerkHosts` to `[]`.
Keep the field present and add production hosts when you create them. Development
Clerk keys are still required, and any listed production hosts remain blocked.
The checked-in example is documentation, not a runnable resource declaration.

Keep the following three secrets in an ignored, mode-600 file outside artifacts:

```dotenv
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CONVEX_DEPLOY_KEY=preview:your-team:your-project|...
```

Remove inherited `CONVEX_DEPLOYMENT`, frontend Convex URLs, Clerk endpoint overrides
and other target selectors from the invoking shell. The runner intentionally does
not load `.env.local`. It copies application sources into a temporary workspace,
provides an explicit Convex env file and builds using the URL returned by Convex's
preview creation callback. `next start` serves the production build on a free
IPv4 loopback port. Browsers use `127.0.0.1` because WebKit rejects Clerk's
`Domain=localhost` client cookie. The server uses `localhost` with IPv4-first
DNS resolution so Next's internal middleware rewrites use a consistent hostname. The callback installs the preview's Clerk issuer and fixture config.
Every child command pins Convex API authentication to the declared preview key.
The Convex CLI otherwise prefers a saved personal login over a preview key, which
can make an invalid key appear to work locally and then fail in CI. The harness
still rejects inherited authentication overrides; it creates this binding only
from the validated preview-key input.

## Run

Install the browser once with `pnpm exec playwright install chromium`.
Only enable trusted execution for code you have reviewed; this flag is not a
sandbox for hostile code.

```bash
E2E_TRUSTED_EXECUTION=true pnpm test:e2e \
  --resources /absolute/path/to/resources.json \
  --secrets /absolute/path/to/test-secrets.env --preflight

E2E_TRUSTED_EXECUTION=true pnpm test:e2e \
  --resources /absolute/path/to/resources.json \
  --secrets /absolute/path/to/test-secrets.env [--workers N] [--budget-minutes M]
```

On this machine, run it through the orchestration wrapper, which also keeps the
safe evidence and leaves no private file behind (`--workers` and
`--budget-minutes` pass through; see
[Local budget and shutdown](#local-budget-and-shutdown-729-2026-10-15)):

```bash
scripts/orchestration/e2e-branch.sh /absolute/path/to/worktree \
  --resources /absolute/path/to/resources.json --workers 2 --budget-minutes 40
```

The first command performs only local validation and Clerk GET requests. The
second **deletes and recreates the declared named preview**, deploys once, builds,
creates fresh ignored role storage and runs the selected suites (mandatory by
default; see [Suites](#suites-752)) on Chromium tablet at 1194×834 with
touch enabled. It starts one Playwright worker per declared cohort, at most three
and at most one per two available CPUs, unless `--workers N` asks for up to the
declared number; a single cohort runs exactly serially. `--budget-minutes M`
(5 to 120, default 17.5) sets the run's time budget; CI instead passes its job's
deadline as `--outer-deadline-epoch S`, which the runner refuses outside
trusted GitHub CI (the preflight's conditions). Local runs acquire an
exclusive slot lock under `e2e/.private`; CI must additionally serialize by the
preview name across machines. After an ungraceful process termination, verify no
run still owns the slot before removing its exact stale lock directory (see
[Setup failures](#setup-failures)).

In CI, the trusted workflow binds `E2E_REVIEWED_SHA=GITHUB_SHA` to the tested
commit, including PR merge commits. The workflow refuses
fork PRs, bot actors and non-owner authors before accessing the environment.
`pull_request_target` and unknown CI events are refused by preflight. The
workflow must withhold secrets from untrusted code **before** checkout/execution;
an in-repository preflight cannot secure secrets already given to hostile code.

### Setup failures

Every runner step before the browser journeys has a fixed stage label. A failure
prints these lines to stderr and exits 1:

1. the fixed text of a condition the harness itself detected, if any (usage,
   preflight reason, secrets file, cohort, Clerk drift, generated-code drift);
2. `E2E setup failed: <stage> (<class>)`;
3. `E2E evidence log also failed (<class>)` if the command's `failed` entry could
   not be written to `stages.log`; the command's own failure stays on line 2.

```text
E2E preflight: Clerk secret key must be a test key
E2E setup failed: resources (validation)

E2E setup failed: deployment (exit-1)
```

Stages, in order: `arguments` (options and usage), `resources` (declaration,
secrets file and target validation), `workers` (cohort worker count),
`clerk-verification` (read-only Clerk checks), `local-backend` (`--backend
local` only: Docker and the pinned image), `source-root` (the working
directory), `private-directory` (`e2e/.private`), `slot-lock`,
`temporary-directory`, `prepared-environment` (with `--reuse`, the kept
environment's record, resumption and checks; without it, discarding any kept
one; see [Reuse a prepared environment](#reuse-a-prepared-environment-754)),
`source-snapshot` (source fingerprint, workspace copy and
recheck), `environment` (private Convex env file, or the local backend's
startup), `port`, `run-file`,
`evidence` (the deployment command's run-file read and first `stages.log`
write), `deployment` (preview recreation, deploy, fixture binding and web
build), `generated-bindings`, `preview-binding` and `artifact-directory`, and in
the release suite `release-qualification`, `release-admin-key` and
`release-evidence` (see
[Release qualification suite](#release-qualification-suite-753)). From
`deployment` on, `stages.log` and `timings.jsonl` in the evidence directory also
record each command, including the nested fixture binding and `production web
build` steps, as before.

Classes form a closed set: `ENOENT`, `EACCES`, `EPERM`, `EEXIST`, `ENOTDIR`,
`EISDIR`, `ENOTEMPTY`, `ENOSPC`, `EROFS`, `EMFILE`, `EBUSY`, `ETIMEDOUT`,
`ECONNREFUSED`, `ECONNRESET`, `ENOTFOUND`, `EAI_AGAIN`, `EADDRINUSE`,
`EADDRNOTAVAIL`, `exit-N` (a child exited with status N), `terminated` (signal
or timeout), `timeout` (the run deadline or a Clerk request timeout),
`validation` (the harness's own checks, schema, JSON or option errors) and
`unknown`. A class is read only from the harness's typed errors, `ZodError` and
`SyntaxError` (by type), `error.code` matched against the set, an exit status or
signal, and, for `fetch` failures only, `cause.code`: `fetch` rejects with
`TypeError('fetch failed')` and keeps the socket's system error in `cause`. No
message, name, stack, path, file name or provider output is ever read into the
output. Every printed line is rebuilt from fixed labels and typed fields:
generated-code drift names only one of Convex's generated files, and the
evidence directory and lock are shown relative to the checkout. Child-process
stderr is never forwarded (runner commands pipe it through the allowlisted
`diagnostics.log`; `git` and `gh` calls discard it). `unknown` means the error
had no recognized code, so reproduce that stage locally to learn more.

If cleanup fails too, the original failure stays first and a line such as
`E2E cleanup also failed: temporary-directory (EACCES)` follows. Every cleanup
(`processes`, `release-admin-key`, `local-backend`, `temporary-directory`,
`prepared-environment`, `slot-lock`) always runs, so a failed temporary-directory removal cannot keep
the slot locked, and a failed local backend removal cannot keep its credentials.

An existing slot lock stops the run before any preview or build work:

```text
E2E setup failed: slot already locked (active or stale)
Lock: e2e/.private/<previewName>.lock (created 2026-09-30T05:40:40.453Z)
Not removed automatically. Check `docker ps` (and local `pnpm test:e2e` processes) for a running gate before removing it; see "Setup failures" in e2e/README.md.
```

If the lock has no complete `owner.json`, a fourth line reads `Its owner record
is missing or unreadable, so a run probably crashed while acquiring it.` The
lock is still never removed automatically.

The runner never removes a lock it did not create, because an existing lock does
not prove the run that created it has ended. Each lock records a random owner
token and its creation time in `owner.json`, written to a temporary file in the
lock and renamed into place, so the record is either complete or absent. If
writing it fails, the run removes its own partial file and empty lock.

Release is atomic. Cleanup first renames the lock directory to
`<slot>.lock.releasing-<token>`, then checks the owner inside the renamed
directory and deletes only that directory. A lock another run creates at the
lock path after the rename is a different directory, so a replacement is never
deleted. If the renamed lock is not ours, cleanup claims the free lock path with
an exclusive `mkdir` and renames the foreign lock back over that empty
placeholder, then prints `E2E cleanup also failed: slot-lock (validation)`
followed by `E2E slot lock was removed or replaced during the run; any
replacement was left in place`. The same lines appear if the lock disappeared.
Residual cases:

- If another run takes the lock path before the foreign lock can be put back,
  the foreign lock stays at `<slot>.lock.releasing-<token>` and cleanup says so.
  Its owner is not protected by a lock at the path; review it by hand.
- A crash between the rename and the delete leaves our own lock under the
  `.releasing-` name. It never blocks a run and can be deleted.
- Known gap: two live runs can share a slot. Its precondition is a manual
  removal of a live lock: run A's lock is deleted by hand while A is still
  running, and run B then acquires the slot. When A finishes, its cleanup
  renames B's lock aside before checking the owner, run C acquires the now free
  path, and A reports the displacement and leaves B's lock under
  `.releasing-*`. B and C then run on the same slot. Following the locked
  message's advice (check `docker ps` before removing a lock) prevents it.
  Treat any `.releasing-*` directory named in cleanup output as possibly a
  displaced **live** lock: check `docker ps` before deleting it. The planned
  remedy is an OS-level lock (`flock`), tracked in #199.

Before removing a lock by hand, check `docker ps` for a running gate container
(and `pgrep -af 'e2e/run.ts'` for a native run). Remove only that exact lock
directory, and only when no gate owns it.

## Suites (#752)

The owner approved splitting the routine browser suite on 2026-10-16 (#752's
coverage map). [`support/matrix.ts`](support/matrix.ts) defines every suite,
its journeys and its projects; the runner and reporter check a run against
exactly the results its selection requires (`requiredTests`), so a missing,
skipped, retried or extra journey still fails it.

| Suite                                                                | Journeys                                                                                                                                                                                                                                                                                                                                                              | Projects                                                                                |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **mandatory** (default; every application change and `E2E required`) | authentication; `access`; `character-sheet` without its Attack Routines; `complete-week`; the Workspace Upkeep core (save recovery, shared week edits, and zero, a blank clear and a 0.07 gp deposit reaching the player); Drill's rolls and Maximum Rank exception; `membership-loss` (D-9). **7 required results.**                                                 | `authentication`, `mandatory`                                                           |
| **focused** `shell`                                                  | `campaign-home`, `campaign-sections`, `week-links`, `character-navigation`, `private-character` (thin lifecycle)                                                                                                                                                                                                                                                      | `focused-shell`                                                                         |
| **focused** `legal`                                                  | `legal-notices`                                                                                                                                                                                                                                                                                                                                                       | `focused-legal`                                                                         |
| **focused** `setup-corrections`                                      | `existing-militia`, `character-ledger`, the Workspace Upkeep setup part                                                                                                                                                                                                                                                                                               | `focused-setup-corrections`                                                             |
| **focused** `sheet`                                                  | `sheet-selections`, `sheet-classes`, `animal-companion`, `character-attacks` (split from `character-sheet`)                                                                                                                                                                                                                                                           | `focused-sheet`                                                                         |
| **focused** `week-upkeep`                                            | Workspace notoriety, settlement touch, Upkeep layout, and the Upkeep week-frame part                                                                                                                                                                                                                                                                                  | `focused-week-upkeep`                                                                   |
| **focused** `week-activity`                                          | Workspace Activity, recovery Activity, `realtime-action-slot`                                                                                                                                                                                                                                                                                                         | `focused-week-activity`                                                                 |
| **focused** `week-event-review`                                      | Workspace recovery through Event, Event/review layout, persistent events                                                                                                                                                                                                                                                                                              | `focused-week-event-review`                                                             |
| **focused** `week-confirmation`                                      | racing Confirmations                                                                                                                                                                                                                                                                                                                                                  | `focused-week-confirmation`                                                             |
| **live** integration                                                 | the persistence and Confirmation contracts, `character-move`, `account-deletion`                                                                                                                                                                                                                                                                                      | `canonical-confirmation`, `canonical-persistence`, `live`                               |
| **release** qualification                                            | `catalog-release` (see [Release qualification](#release-qualification-suite-753))                                                                                                                                                                                                                                                                                     | `release-qualification`                                                                 |
| **nightly**                                                          | mandatory, every focused group and live, plus the compatibility projects: WebKit tablet (every journey it ran before, with `character-attacks` beside `character-sheet`), Chromium phone (access and its three split journeys, with access's nightly extension) and Firefox desktop (the same four, `existing-militia` and `complete-week`). **64 required results.** | all of the above but release, then `webkit-tablet`, `chromium-phone`, `firefox-desktop` |

Every routine journey belongs to exactly one of mandatory, a focused group and
live, and runs there on Chromium tablet. Projects carry their journeys' exact
titles as `grep` patterns, because one file can hold journeys of several
suites (`canonical-workspace.spec.ts`). The Upkeep journey's setup and
week-frame parts share its `workspaceUpkeep` case: case ownership is per
project, and they never run in the core's project. `character-attacks` has its
own `characterAttacks` case, because WebKit runs it beside `character-sheet`.
Since #754 a new case no longer adds to the fixture config (see
[Fixture contract](#fixture-contract)).

### Run a suite

```bash
# mandatory (the default)
scripts/orchestration/e2e-branch.sh /abs/worktree --resources R --workers 2
# mandatory plus the focused groups a brief names, and live integration, in one run
scripts/orchestration/e2e-branch.sh /abs/worktree --resources R --workers 2 \
  --suite mandatory --suite focused --group sheet --group week-activity --suite live
# a focused group, or live integration, alone
scripts/orchestration/e2e-branch.sh /abs/worktree --resources R --suite focused --group shell
scripts/orchestration/e2e-branch.sh /abs/worktree --resources R --suite live
# nightly: everything but release
scripts/orchestration/e2e-branch.sh /abs/worktree --resources R --workers 2 --suite nightly --budget-minutes 45
# release qualification
scripts/orchestration/e2e-branch.sh /abs/worktree --resources R --suite release
# one journey (a diagnosis, or a test-only fix under D-10): its exact title or its file
scripts/orchestration/e2e-branch.sh /abs/worktree --resources R --journey private-character.spec.ts
# a nightly-only failure: the journey in every nightly project that runs it
scripts/orchestration/e2e-branch.sh /abs/worktree --resources R --suite nightly --journey access.spec.ts
# any of these against a disposable local Convex Docker backend instead of a Cloud preview
scripts/orchestration/e2e-branch.sh /abs/worktree --resources R --backend local --suite focused --group sheet
scripts/orchestration/e2e-branch.sh /abs/worktree --resources R --backend local --journey private-character.spec.ts
```

`pnpm test:e2e` and `pnpm test:e2e:local` take the same `--suite`, `--group`
and `--journey` options, and selection, scope, results and checkpoints are the
same on either backend ([Local Convex on this machine](#local-convex-on-this-machine)).
`--suite` and `--group` repeat; `nightly` and `release` run alone; `focused`
needs at least one `--group`, and a `--group` needs `focused`; `--journey`
(repeatable, a title or a routine journey file) excludes `--group` and every
suite but `nightly`, and runs each journey in its suite's project.
`--suite nightly --journey` (focused diagnosis) instead runs each journey in
every nightly project that runs it: its routine project, each compatibility
project that lists it, and access's nightly extension. It requires exactly
those results, for example `--suite nightly --journey character-sheet.spec.ts`
requires 3 (authentication, `mandatory`, `webkit-tablet`), and its scope reads
`nightly journey (<title>)`. A plain `--journey` run skips the compatibility
projects and the extension, so it cannot reproduce a nightly-only failure.
Anything else is a usage error before any setup. `--nightly` is gone; use
`--suite nightly`.

**Scope.** Every run states its exact scope. Before deploying, the runner
prints `E2E scope: <scope>; <n> required results.`, for example `E2E scope:
mandatory + focused (sheet, week-activity) + live; 18 required results.`, and
its last line is `E2E <scope> browser results: passed` (or `failed or
missing`). `report.json` and `progress.json` record the selection (`suite`),
and the wrapper's summary line ends with `; scope: <scope>, <n> required
results`, rebuilt from the closed suite and journey names.

### When each suite runs (D-8, D-15)

CI runs mandatory on every pull request and push to `main` (`E2E required`) and
nightly at 02:23 UTC, both on Cloud previews. The focused and live triggers are **a documented mapping,
not wired into CI**: the orchestrator names the groups, and live integration,
that a change touches in its brief, and they run in the same run as mandatory.
A focused pass never replaces mandatory. Data-only curation (catalog or
curation data with no application, harness or schema change) needs no browser
suite.

| A change touches                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Add                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `src/components/campaign-home`, `campaign-shell`, `campaign-sections`, `character-navigation`; `src/app/characters`; `src/lib/campaign-routes.ts`, `src/lib/app-navigation.ts`; Character navigation in Convex (`convex/character.ts`)                                                                                                                                                                                                                                                                                                                                                                            | `shell`             |
| `src/components/legal`, `src/lib/catalog/legal-page-data.ts`, the legal notices' data shape, `src/proxy.ts` (Clerk middleware). Notice text from data-only curation does not.                                                                                                                                                                                                                                                                                                                                                                                                                                     | `legal`             |
| `src/components/militia-setup`, `characters-officers`, `militia-corrections`; `convex/canonicalSetup.ts`, `convex/canonicalLedger.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `setup-corrections` |
| `src/components/character-sheet` (selections, classes, Spells, Companions, Attack Routines), `src/lib/character-sheet*.ts`, `convex/characterSheet*.ts` (private sheets too), `convex/companionRelationships.ts`                                                                                                                                                                                                                                                                                                                                                                                                  | `sheet`             |
| `src/components/weekly-draft-workspace` Upkeep, week frame and reference panel files (`upkeep-*`, `choice-cards`, `use-choice-card-drag`, `week-frame`, `reference-facts`, `roll-total-field`, `whole-number-field`, `transfer-form`), `src/lib/rules-upkeep.ts`, `src/lib/gp-money.ts`                                                                                                                                                                                                                                                                                                                           | `week-upkeep`       |
| `weekly-draft-workspace` Activity files (`activity-*`, `use-activity-board`), `src/lib/rules-activity.ts`, `src/lib/activity-slot-removal.ts`; team corrections in `militia-corrections` (`realtime-action-slot` follows a team to another device)                                                                                                                                                                                                                                                                                                                                                                | `week-activity`     |
| `weekly-draft-workspace` Event, persistent and review files (`event-*`, `persistent-*`, `summary-*`, `use-recovery-cost`), `src/lib/event-occurrence-preparation.ts`, `src/lib/rules-event-*.ts`, `src/lib/rules-persistent-events.ts`                                                                                                                                                                                                                                                                                                                                                                            | `week-event-review` |
| Confirmation: `confirm-control`, `summary-confirm-guard`, `summary-review-block`, `store`, `src/lib/weekly-confirmation*.ts`, `convex/lib/canonicalConfirmation.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                               | `week-confirmation` |
| Weekly draft persistence, Confirmation or history (`convex/canonicalDraft*.ts`, `convex/canonicalHistory.ts`, `convex/lib/canonicalDraft*.ts`, `src/lib/convex-draft-persistence.ts`, `src/lib/weekly-draft-persistence*.ts`, `src/lib/draft-target-reader.ts`)                                                                                                                                                                                                                                                                                                                                                   | `live`              |
| Character moves, departures, account or container deletion (`convex/characterMoves.ts`, `convex/lib/characterMove*.ts`, `convex/organizationDepartures.ts`, `convex/accountDeletions.ts`, `convex/campaignDeletions.ts`, `convex/organizationDeletions.ts`, `convex/lib/lifecycleDriver.ts`)                                                                                                                                                                                                                                                                                                                      | `live`              |
| Their shared dependencies: authorization and access helpers (campaign, membership and identity checks: `convex/lib/characterAccess.ts`, `convex/lib/canonicalDraftPersistenceAuthority.ts`, `convex/organizationMembership.ts`, `convex/lib/characterOwnership.ts`); **any** `convex/schema.ts` change; the Character Sheet calculation boundary and the militia facts moves and releases recompute (`src/lib/character-sheet.ts`, `convex/lib/characterSheet*.ts`, `convex/lib/militiaCharacterFacts.ts`); lifecycle dependencies (ownership, Companion relationships, the membership directory, scheduled jobs) | `live`              |
| Any change aimed at Convex runtime limits (pagination, transaction size, scheduling)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `live`              |
| The release artifact or operator (`scripts/catalog-release.ts`, `scripts/catalog/release*`), `convex/lib/catalogFixturePolicy.ts`, or the picker's catalog-choice path; before any release activation; #413                                                                                                                                                                                                                                                                                                                                                                                                       | `release`           |

Checks that moved out of mandatory run only when these triggers fire, and
nightly (D-8). The pagination guard in convex-test (#755) does not certify
production read and write accounting, the real scheduler or OCC contention;
only a real deployment checks those.

### Which suites must pass (D-10, D-11)

| Change                                                                                                                                                                      | Required on the current revision                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Test-only fix** to a journey (its spec, or a helper only it uses)                                                                                                         | **That journey**, rerun with `--journey` on the new revision (`--suite nightly --journey` for a nightly failure). The earlier complete run's other results stand only if the application source fingerprint is unchanged. Report the original failure and each rerun's revision, scope and outcome. (D-10) |
| Application change                                                                                                                                                          | Mandatory plus the focused groups the brief names, in one run; add live when the brief touches its triggers. Rerun failed journeys directly to diagnose.                                                                                                                                                   |
| **Harness change**: runner, wrapper, authentication or core fixtures (`e2e/support/*`, `e2e/fixtures/*`, `convex/e2eFixtures.ts`, `playwright.config.ts`, the CI workflows) | The mandatory suite **and a complete run of every suite**: every focused group, live, nightly's compatibility projects and release. One smoke journey per suite is not enough (D-11 = no).                                                                                                                 |
| Release pipeline or operator change                                                                                                                                         | Release qualification, plus whatever the application rule requires                                                                                                                                                                                                                                         |
| Data-only curation                                                                                                                                                          | None                                                                                                                                                                                                                                                                                                       |
| PRD completion (#713) and #413 activation                                                                                                                                   | All suites, complete, on the qualifying revision                                                                                                                                                                                                                                                           |

Every requirement above needs a **fresh** preparation: a run on a reused
environment (`--reuse`, exit 5) is a diagnosis and never satisfies one (see
[Reuse a prepared environment](#reuse-a-prepared-environment-754)).

### Budgets (D-12, D-17)

- **Nightly** runs everything but release, so its CI budget is raised from
  17.5 to **45 minutes** (`budget_seconds: 2700` in `e2e-nightly.yaml`, a
  48-minute job): enough for the Chromium full regression (mandatory, focused
  and live, estimated at about 15-17 minutes at two workers) and the
  compatibility projects every night. That estimate still holds as an upper
  bound: the whole nightly suite, compatibility projects included, passed 64/64
  in 16 min 31 s on the local Docker backend (see below). Locally, pass
  `--budget-minutes 45`.
- **Mandatory: placeholder.** CI keeps **17.5 minutes** for now
  (`budget_seconds: 1050` in `e2e.yaml`, marked PROVISIONAL); this is not a
  measured budget. D-17 requires measuring the new mandatory suite on GitHub
  against Cloud, which is not possible during the Convex Cloud freeze. The
  budget is set once such a GitHub run exists: the orchestrator sets it to that
  measurement × about 1.6 plus installation (likely about 10 minutes), and the
  job's `timeout_minutes` to the budget plus 2.5 minutes.

  For context only, the orchestrator measured on the local Docker backend
  (one machine, 2 workers, `e2e/.private/resources.json`, wall time from the
  runner's start to its last line, setup included). The old 33-result
  mandatory suite (feature head 7b76d89e) passed 33/33 in 10 min 06 s. Since
  #752, mandatory passed 7/7 in 2 min 44 s, nightly 64/64 in 16 min 31 s and
  release 2/2 in 2 min 24 s. These numbers cannot set the CI budget: local
  runs leave out the Cloud preview deploy and Cloud call latency.

- The release suite and local runs, on either backend, keep the 17.5-minute
  default; any suite can pass `--budget-minutes`.

### Coverage removed or reduced

Moved journeys keep every assertion in their new suite. These are the
assertions #752 removed from every browser suite, with the tests that cover
each below the browser and the owner's approved reduction:

| Removed                                                                                                                                               | Covered by, and the reduction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canonical-cutover`, deleted (D-1)                                                                                                                    | `convex/acceptedCampaign.integration.test.ts` "[retirement.preserve] accepted campaign confirms through one authority and stale paths cannot change successor or history"; `convex/legacyRetirement.integration.test.ts` "[retirement.reject] retired writes reject stale clients even without a cutover control row"; `convex/canonicalHistory.integration.test.ts` "[rules.P86.listing] finished-week listing returns distinct effective weeks latest-first with dates, chain counts and compact headlines". **Reduction R-1:** no browser renders an accepted campaign's Week 9 and then Week 10. No run supplies the rules catalog's `live.cutover` service evidence any more. |
| `private-character`: "edits save with no campaign and survive a reload" and "another member and an outsider see what a missing Character shows" (D-2) | `character-sheet-page.test.tsx` "an independent private URL loads and edits the sheet without a campaign or organization"; `convex/privateCharacters.integration.test.ts` "an owner creates and edits a private Full Character without an organization or campaign" and "private links disclose nothing to another owner, campaign member, outsider or signed-out caller, including through legacy writers"; `src/app/characters/characters-route.test.tsx` "a missing, deleted or returned private character reads the same: not available, with Back and no retry". **Reduction R-2:** no browser reloads a private sheet (`character-sheet` reloads a campaign sheet).          |
| `week-links`: "the GM stays on its own phase" (D-5)                                                                                                   | `src/lib/campaign-routes.test.ts` "opens every supported Phase View locally and falls back to Upkeep" (a phase is local to its URL). **Reduction R-3.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Workspace Upkeep 1e: typed text, the range advisory and the required-value error (D-6)                                                                | `whole-number-field.test.tsx` "[rules.P81.digits] digit entry rejects invalid text, keeps zero, and emits an explicit clear with styled required feedback"; `roll-total-field.test.tsx` "[rules.WEEK-14.total-input] malformed text is blocked before any write, zero is accepted with a range advisory, and blank clears through the caller". **Reduction R-4** (local only). Zero and a blank clear reaching the player stay in the mandatory core; the clipboard paste moved to the week-frame part.                                                                                                                                                                            |
| Workspace Upkeep 1f: empty and too-precise transfer amounts (D-6)                                                                                     | `upkeep-transfers.test.tsx` "[rules.UPK-10.amount-errors] empty and malformed amounts keep their own message in the field and send nothing" and "[rules.UPK-10.add] a deposit or withdrawal is added in gp as exact copper with no character to choose"; `src/lib/gp-money.test.ts` "empty input differs from malformed, too-precise or oversized gp". **Reduction R-4** (local only). The 0.07 gp deposit updating the player's Treasury stays in the mandatory core.                                                                                                                                                                                                             |

Split, not removed (D-7): the Upkeep journey's setup (1a) moved to
`setup-corrections`, and its week frame, reference panel, History failure and
responsive sweep (1i, 1j) to `week-upkeep`; `character-sheet`'s Attack
Routines (1.11) moved to `character-attacks` in `sheet` and on WebKit nightly.
The Upkeep core records `test.step` timings for its phases.

## Release qualification suite (#753)

A separate suite with its own mode qualifies a Catalog Release on the freshly
recreated preview. It never runs inside the mandatory or nightly suites, and
those never run against an active release: every run recreates the preview,
and only a release-mode run activates one.

```bash
scripts/orchestration/e2e-branch.sh /absolute/path/to/worktree \
  --resources /absolute/path/to/resources.json --suite release
# or, directly:
E2E_TRUSTED_EXECUTION=true pnpm test:e2e --resources /absolute/path/to/resources.json \
  --secrets /absolute/path/to/test-secrets.env --suite release
```

`--suite release` runs alone and uses one worker, the first cohort.
It also refuses a temporary directory under `/tmp`: the key file lives there,
so run it through `e2e-branch.sh`, whose `TMPDIR` is `.ep-tmp/e2e-*`.
After the usual recreation, deployment and binding, the runner starts
[`e2e/qualify-release.ts`](qualify-release.ts)
([`release-qualification.ts`](support/release-qualification.ts)) before any
browser, in this order:

1. **Seed** the `catalogRelease` case: a fixture campaign with two Characters
   that keep fixture provenance and no ordinary campaign or private Character,
   so the activation sentinel (`convex/lib/catalogFixturePolicy.ts`) holds
   without any bypass. The second Character already holds the admitted feat
   (through its global identity, which the case installs once per preview), so
   reconciliation evaluates a Character the release changes.
2. **Build** the artifact once per run with `catalog:release build`, from the
   bounded input in
   [the release runbook](../docs/catalog-import/releases.md#qualify-on-the-e2e-preview),
   inside the run's temporary directory (under `TMPDIR`, never `/tmp`), after
   `catalog:pin` confirms the pinned calculator.
3. **Get the admin key** once, through the preview-key exchange the installed
   Convex CLI makes ([`preview-admin-key.ts`](support/preview-admin-key.ts)):
   `POST https://api.convex.dev/api/deployment/authorize_preview` with the
   preview deploy key and the CLI's own payload. The exchange is pinned to the
   installed `convex` version (a unit test reads the CLI's source) and fails
   closed on any other version, an HTTP error, or a response that isn't this
   run's preview: its URL must equal the URL preview creation bound
   (`https://<name>(.<region>)?.convex.cloud`) under the deployment's own
   name, and a `deploymentType`, when present, must be `preview`. A refusal
   names only a fixed sub-reason (`response-json`, `response-schema` with
   `path:code` issues, `response-deployment-type`, `response-url` with three
   booleans), which of the CLI response type's own field names the response
   has, and a count of any other key names, never a value. The release
   operator accepts the same two URL forms for its named deployment (owner
   decision 2026-10-16). Convex doesn't document it; the owner accepted that for
   previews only (2026-10-15). Production (#413) uses an owner-held deployment
   key. The key is written mode 600 to `release-admin.key` in the run's private
   directory and is never printed or kept in evidence.
4. **Operate**: `catalog:release prepare`, `reconcile` (rerun while it stops at
   its step limit, until ready), `activate --fixture-only --target-kind preview`
   and `active`, which must report the built release number and artifact
   fingerprint. The key reaches the operator only through `--admin-key-file`;
   the operator's environment has no deploy key, Clerk key or key path.
5. **Delete** the key file whatever happened. The runner then proves it gone
   before the browsers start (`release-admin-key`), removes it again at cleanup,
   and `e2e-branch.sh` lists any `release-admin.key` in the worktree or a
   surviving run `TMPDIR` as a leftover. Playwright workers never receive the
   key, its path or the run metadata naming it.
6. **Record** `release-qualification.json` (run ID, readiness and work counts,
   the seeded Characters' work, the active release) and
   `release-qualification.md`, the comment text for #753, #318 and #729, in the
   safe evidence directory. The console prints one summary line.

The browser project then runs only
[`catalog-release.spec.ts`](catalog-release.spec.ts): on a fixture-campaign
Fighter, the owner takes the admitted Skill Focus (Acrobatics) from the feat
picker (which offers the read's catalog choices, global and release-projected
definitions included, beside the sheet's own) and both members' sheets show Acrobatics go from +0 to +3. Journeys that
create ordinary private Characters (`private-character`,
`character-navigation`) can't run while a release is active and are not in this
suite. The qualifying run is the orchestrator's, with owner approval.

## Fixture contract

`fixtures/catalog.ts` versions the domain keys. `smoke` provides a rank-1 militia,
one officer and its first Activity week; `isolation` is an independent control
graph for lower-level isolation checks. Names and rules values are deterministic.
Each browser test must use its own catalog case (`test.use({ caseKey: ... })`);
reusing a case across different tests of a project fails. Worker N always uses
cohort `worker-N`, and Playwright never runs two workers with the same index at
once, so a cohort is never shared. A retry may run on another worker and cohort;
it resets its case before creating any browser context and restores that cohort's
role storage. Cleanup is best effort; reset and a fresh preparation provide
correctness, and the isolation canary below turns a leftover campaign into a
failure instead of a silently changed campaign list. A cleanup Convex rejected
with a write conflict (for example with the draft retirement a Confirmation
schedules) runs up to three times, 0.5 s then 1 s apart; `cleanupCase` is one
transaction that deletes whatever is left of the case, so repeating it is safe.
No retry starts once the browsers must stop or the run is cancelled, and Ctrl+C
ends the wait at once. Any other failure, including a timeout and a Write Epoch
change, is not repeated. If cleanup still fails, the warning names the case,
the cohort and the attempts. The composed bound of one case's cleanup is in
[Narrow fixture retries](#narrow-fixture-retries-754).

The Character Sheet journey (`character-sheet.spec.ts`) is required on Chromium
tablet and on nightly WebKit tablet. Its `characterSheet` case is provisioned
automatically by a normal `pnpm test:e2e` run: the deployment callback runs
`bind-preview.ts`, which mints the run's fixture session and cohort
capabilities (below) and binds the resulting config. Before
the journey, `support/fixtures.ts` calls `e2eFixtures:resetCase`, which creates a
PC and initializes its Character Sheet. Cleanup removes the owned graph.
No separate `e2e:provision --bootstrap` step is needed for this case; that command
manages the Clerk users, organizations and memberships, not journey cases.
The private-character journey (`private-character.spec.ts`) runs on the same
projects with its own `privateCharacter` case, provisioned the same way. Its
reset grants the cohort's users private Character Sheets; its reset and cleanup
delete the private sheets they created and withdraw the grant. The two journeys
cannot share a case: each browser test must declare a distinct case key.
The navigation journey (`character-navigation.spec.ts`, #297) uses its own
`characterNavigation` case on Chromium tablet and nightly WebKit tablet. It
starts with a Full Character in a campaign without a militia, grants private
creation for the cohort, and proves No campaign grouping, campaign creation,
independent sheet URLs and origin links, private non-disclosure, fixed phone
tabs and the absent-militia explanation. Reset and cleanup remove its campaign
and private sheet graphs. This adds one mandatory result and two nightly
results.
The membership-loss journey (`membership-loss.spec.ts`, #706) uses its own
`membershipLoss` case on the same projects. Its reset seeds a Full Character
owned by the cohort player in a campaign without a militia and grants private
sheets. During the journey `e2eFixtures:loseMembership` removes the player's
organization membership in Convex through the same removal as the signed
provider event; the Clerk membership itself is untouched, as normal runs never
change Clerk memberships. Reset and cleanup restore the Convex membership,
remove the departure and delete the returned private sheet. This adds one
mandatory result and two nightly results. Browser execution remains the
external harness's responsibility.
The account-deletion journey (`account-deletion.spec.ts`, #708) uses its own
`accountDeletion` case on the same projects. Its reset seeds a Full Character
in a campaign without a militia, owned by a departing member: a Convex account
in the cohort's member organization with no Clerk user and no session. During
the journey `e2eFixtures:deleteAccount` deletes that account through the same
deletion as the signed `user.deleted` event. The cohort's Clerk users, their
Convex accounts and every membership are untouched, so no later journey or run
depends on what it deletes; a real deletion of a cohort user is never
attempted, because the harness never creates or repairs Clerk users. Reset and
cleanup remove the departing account and its deletion record.
The move journey (`character-move.spec.ts`, #316, #703, #711) uses its own
`characterMove` case with `familiarDemo`: a Full Character with an active
familiar of the same owner in a campaign without a militia, plus private
sheets for the cohort. The owner leaves the campaign and joins it again with
both, so the journey needs no second campaign. Cleanup deletes the private
sheets the move created.
Four more journeys (#729) close browser claims that had never run, each on its
own case on the same projects. `sheet-selections.spec.ts` (`sheetSelections`)
adds two representative feats to a Fighter, orders them by keyboard and checks
the sheet blocks' places and widths (#304, #306, #313, #320).
`sheet-classes.spec.ts` (`sheetClasses`) records a Wizard cantrip on the
Spells page at three widths (#315) and switches both levels of a two-level
Rogue to Unchained rules together (#583). `animal-companion.spec.ts` (`animalCompanion`) creates a Druid's
animal companion and sets up its progression at three widths (#325). Those
three start like the move case: one Full sheet in a campaign without a
militia. `legal-notices.spec.ts` (`legalNotices`, a bare campaign) reads the
public legal page from the footer and signed out, and checks every notice's
text verbatim; its expectations come from the committed notice inputs (`support/legal-notices.ts`), so it follows the
Section 15 Registry as it grows. The preview has no Catalog Release, so no
journey can select admitted Catalog content yet. The #729 journeys add six
mandatory and twelve nightly results; the matrices then required 33 and 61
results. Since #752 the mandatory suite requires 7 and nightly 64 (see
[Suites](#suites-752)).

**Capabilities (#754).** Every run, a reused one included, mints a fresh
random `session` ID and one capability per cohort its workers use (32 random
bytes in base64url) and binds them as `E2E_FIXTURE_CONFIG` before any worker
starts; `--workers 2` gets two. Binding replaces the whole config, so an earlier
run's session and capabilities are refused. They live only in the run's private
`fixture-config.json` and `run.json` (mode 0600), which cleanup deletes, and never
reach a browser or a prepared environment. The config no longer grows with the
number of cases: three cohorts take about 1.7 KiB of Convex's 8 KiB value cap
(about 470 bytes each), and `bind-preview.ts` still refuses a config over the cap
before binding it (`support/capabilities.test.ts`).

A fixture call's arguments carry the capability, so they reach the Convex CLI
on **stdin, never argv**, where any local user could read them (`ps`,
`/proc/<pid>/cmdline`). The per-case capabilities before #754 were exposed that
way. `support/convex-run-stdin.mjs` reads the JSON (at most 1 MiB), checks it is
one object and hands the installed CLI exactly `[node, cli, run, function, json,
...flags]`; replacing `process.argv` in JavaScript does not change the kernel's
command line. It also sets `CI=true` and removes `VERCEL` in its own process only, so the CLI never sends a crash report (which could carry the arguments) to Sentry. Admin authentication is unchanged (the `--env-file`). Its own
refusals print fixed text and exit 86 (arguments) or 87 (the CLI could not
load), before the CLI does any network I/O. `support/fixture-arguments.test.ts`
runs the real pinned CLI against a loopback server and checks the actual argv
and command lines, and that reports stay secret-free for oversized stdin, an
import failure, CLI failures and an early pipe closure.

**What replaces per-case capabilities, and what is lost.** Every call checks E2E
mode, the deployment binding and denylist, version, namespace, the session and
the cohort's capability (compared in constant time). The case key comes from a
closed list, and each function keeps its own case limits; every case graph is
found through its `(namespace, workerKey, caseKey)` index, cohort identities come
only from the authorized cohort, and the isolation canary stays. Before, changing
only `caseKey` invalidated the capability; now a cohort's capability authorizes
every valid case of that cohort, cleanup included, so the token no longer catches
a mistaken case. The harness therefore passes the campaign its reset returned
(`expectedCampaignId`) with its inspections, cleanup, `loseMembership` and
`deleteAccount`, and the server refuses (`E2E fixture case mismatch`) when that
campaign exists and belongs to another case; a campaign a later reset replaced
passes. The canonical persistence operations already check their `campaignId`.
**Independent per-case revocation is not kept:** per-case capabilities were never
revoked singly, and each worker process already held all of its cohort's case
capabilities (`run.json` held every cohort's), so they never separated callers.

`e2eFixtures` exposes only internal functions: `seedIdentityProjection`,
`resetCase`, `inspectCase`, `cleanupCase`, the membership-loss journey's
`loseMembership` and the account-deletion journey's `deleteAccount`. The
harness sends every `resetCase`
(including `canonicalPersistenceFixtures:resetAndInitialize`) the cases its
running test owns (`isolatedWith`). In the same transaction, the isolation canary
fails the reset, rolling it back, if the cohort's member organization holds any
other campaign or its outsider organization holds any campaign. Every call verifies E2E mode, the bound
deployment URL against `CONVEX_CLOUD_URL`, the production denylist, namespace,
catalog version, session and the cohort's capability (above). Capabilities are
generated for each run and never sent to a browser. Copying E2E flags to another
deployment fails the URL binding. Do not manually rebind fixture config to
production: deployment administrators are outside this harness's trust boundary.
Clerk projections are worker-owned and cannot overwrite unrelated users. Graph
cleanup follows only owned campaign relationships and rejects oversized graphs
atomically instead of leaving truncated cleanup.

Use `players.gm` and `players.player` for simultaneous contexts, and
`players.outsider` for the separate organization. `interactions.ts` uses semantic
locators, real pointer movement, visible keyboard/tap staging buttons and
auto-retrying domain assertions. Backend inspection is for fixture diagnostics;
journey assertions belong on player-visible behavior. No fixed sleeps, DOM
mutation hooks, fake authentication or hidden staging endpoints are provided.

## Evidence and checks

Only upload the current `e2e-artifacts/<previewName>/<runId>/`, with 30-day retention. The custom
reporter keeps safe assertion messages, test outcomes and timings; auth setup
errors are replaced with a fixed diagnostic. `progress.json` is the run's durable
checkpoint, rewritten atomically: the planned tests (`planned`: id, project, file
and sanitized title) when the run begins, each attempt as it starts (`started`)
and each attempt's evidence as it ends (`evidence`, keyed by `testId`). So an
outer deadline retains the first failure, and what ran, even if `onEnd` cannot
write the final report. While the run lasts its status is `running`; at the end
it becomes `finished` or `interrupted` (SIGINT or the global timeout) with three
lists: `completed` (each with its latest attempt's status), `interrupted` (an
attempt started but never ended, or ended as interrupted) and `unstarted`.
Playwright's `onEnd` writes that final status; if Playwright never reached it, the
runner writes `interrupted` once Playwright and every process it started have
exited, and prints the three counts. No checkpoint can satisfy the aggregate
gate. Each attempt's `steps` time the
journey's own `test.step` phases: the sanitized title path, `start` and
`duration` in milliseconds, and `passed`, `failed` or `interrupted` (a timeout
ended the attempt inside the step, so `duration` is null and `start` shows how
long it ran). At most 100 steps are kept per attempt. Step errors, locations,
parameters, fixtures and Playwright actions are not recorded. `access`, its
two shell parts (see [Access split](#access-split)) and the nightly extension
use steps, as do campaign home (since the area checks), `workspaceActivity`
and the correction layout step of `ledger`; the other journeys do not yet, so
they record none. `stages.log` records stage outcomes;
`timings.jsonl` adds command correlation IDs, timestamps and elapsed milliseconds
without command arguments, environment values or provider output;
`diagnostics.log` retains allowlisted application/service error categories (such
as a failed schema validation, authentication, rate limits, connection failures,
a Convex write conflict, a fixture graph over the cleanup limit and the
isolation canary) without provider payloads. A failed attempt retains a full-page screenshot of every
role's application page, wherever it is (sign-in, provider and blank pages are
not kept), with Clerk's components and the app's account block masked, and an
`observation` per page: its path, `h1`, visible alerts, statuses, named
regions, region-level error text and open dialogs with their text, leaving
those surfaces out. Text is sanitized before it is bounded: tokens, keys,
whole or cut JWTs, emails and URLs are removed, and everything from a
credential key (`token`, `secret`, `password`, `key` and the like, any case)
to the end of the text is replaced: a quoted key in any escaping, and an
unquoted one before `=` or `:`, also when written with `\uXXXX` or `\xXX`
escapes. No value is parsed, so none can leak in part. A value after a
credential keyword and a space is judged by its look: prose words stay
("session token expired"), opaque values go (16 or more characters of
`[A-Za-z0-9._~+/=-]`, or 8 or more with a digit or symbol). Any standalone
run of 32 or more such characters is redacted whatever precedes it; document
IDs in a page path show as `[id]`. Each screenshot and page read gets 5 s,
and the server view below is recorded before any page and gets 20 s, well
inside the 60 s shutdown reserve. A failed `characterMove` or
`membershipLoss` attempt also records the server's view of its case
(`e2eFixtures:inspectMoves`, read-only and scoped like `inspectCase`): each
Character's latest move (state, scan phase, progress, cancellation reason,
origin), the membership-loss departure's failed steps with their last failure,
its next scheduled driver run and how the last one ended, and the Write Gate
the driver checks; the server sanitizes its failure text before capping it
at 4 KiB. A first CI retry retains an action-only trace, recorded without
screenshots or snapshots, with **screencast frames, network, headers,
cookies, storage, snapshots, source and evaluation payloads removed**: trace
frames are not masked, so the masked failure screenshots show the pages.
Video is off. Traces consequently have less detail than raw Playwright traces.
Retry passes remain failed. Private role storage, raw traces, env files and the
temporary workspace are removed on normal completion/failure and excluded from
artifact paths. Do not upload temporary directories or conventional raw
Playwright reports.

Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm test:build` without service
credentials. Safety, identity verification, reset ordering, namespace isolation,
artifact redaction and config discovery have lower-level tests. Live deployment,
auth and subscription parity still require the declared services; a secretless
pass is not evidence that a live smoke has succeeded.

API references: [Convex preview deployment](https://docs.convex.dev/cli/reference/deploy),
[Clerk Playwright authentication](https://clerk.com/docs/guides/development/testing/playwright/test-authenticated-flows),
[Playwright authentication](https://playwright.dev/docs/auth).

## Provision and repair the cohort (#24)

`e2e/resources.ci.json` records the non-secret cohort IDs, development host and
known production denylist. The dedicated **EverythingPath E2E** Clerk application
(`app_3J66fIZKu2oeO8fqN7S1nzHRPwM`) uses development instance
`ins_3J66fNgiREn4Um73GoNT1mpxgr1` at
`sought-gar-1424.clerk.accounts.dev`, with email sign-in, organizations and the
`convex` JWT template enabled. It is separate from the applications used for
normal development. Its preview slot is reserved for CI. Local runs use
`e2e/.private/resources.json` and a separate local slot. Review both declarations
when production targets change. An empty Clerk denylist means no production
Clerk application has been declared; it does not disable the development-key or
instance checks.

Provisioning is a separate, local-only command. Without `--bootstrap`, it only
verifies. The secrets file must be mode 600 and contain only the three keys above.

```bash
E2E_TRUSTED_EXECUTION=true pnpm e2e:provision \
  --resources e2e/.private/resources.json \
  --secrets e2e/.private/test-secrets.env

E2E_TRUSTED_EXECUTION=true pnpm e2e:provision \
  --resources e2e/.private/resources.json \
  --secrets e2e/.private/test-secrets.env --bootstrap
```

Bootstrap validates targets and matches the development instance's JWKS before
any service write. It creates missing synthetic `+clerk_test` users and member /
outsider organizations, restores missing memberships and their `org:admin` /
`org:member` roles, and removes incorrect memberships within the declared cohort.
It refuses to alter an ID belonging to a different email or remove access to an
undeclared organization. Resolve those cases manually. Existing users and
organizations retain their IDs; a recreated object's new ID is written atomically
to the supplied declaration after verification. New organizations carry a stable
private metadata marker so interrupted setup can find them again. Run bootstrap
from one machine at a time; its local lock cannot serialize across machines.
For initial creation, the example's placeholder IDs represent absent resources;
replace all target, denylist and email values before enabling bootstrap.

If bootstrap changes IDs, update both local and CI declarations before another
smoke. Configure the Clerk `convex` JWT template and organization support in the
dedicated development application before provisioning. Application creation,
JWT-template configuration and production inventory are operator setup steps;
bootstrap only manages the declared fixture cohort.

## Trusted CI configuration

The `E2E access` workflow runs on pull requests targeting `main`, pushes to `main`,
and manual dispatches. Merge-queue execution is deferred. The stable aggregate check is **E2E required**. It always
runs after the access job and accepts only a successful job with an explicit
verified result output. Failed, cancelled, neutral, skipped or absent upstream
results fail closed. The reporter independently requires every result of the
mandatory suite (see [Suites](#suites-752)), each with exactly one passing
attempt. Skips, expected failures, quarantine annotations, focused runs, global errors and retry passes
cannot satisfy it. `forbidOnly` rejects focused tests before execution.

Only repository-owner actors and rerun actors can use service credentials; PRs
must additionally be owner-authored and originate in this repository. Other PRs
receive a red aggregate check and must be reviewed and brought onto a trusted
owner branch. Never use `pull_request_target` to execute submitted code.

Store `CLERK_SECRET_KEY` and `CONVEX_PREVIEW_DEPLOY_KEY` only in the `e2e`
environment, and `CLERK_PUBLISHABLE_KEY` as its variable. The environment permits
`main` and `refs/pull/*/merge` branch refs. PR runs test GitHub's proposed merge
commit. This rollout trusts the owner's same-repository changes without an
additional environment approval gate; review workflows, dependencies and install
scripts before submitting them. Branch patterns alone do not establish trust.
Do not move service keys to repository or organization secrets. Revisit this
policy before giving other contributors write access.

Each caller sets its suite's budget (`budget_seconds`, see
[Budgets](#budgets-d-12-d-17)): 17.5 minutes for mandatory, 45 for nightly.
CI shares that one deadline (`E2E_DEADLINE`, from the job's start)
across setup, installation and execution, with interrupt then forced
termination 5 s later. The runner receives it (`--outer-deadline-epoch`) and
ends its own run 30 s earlier, its browsers a minute before that, so the report
and the final checkpoint are written before the interrupt (see
[Local budget and shutdown](#local-budget-and-shutdown-729-2026-10-15)). Locally
the runner budgets 17.5 minutes from its own start (`--budget-minutes`). Artifact upload has a separate one-minute cap.
The mandatory browser job has twenty minutes (`timeout_minutes`) including
installation and artifact finalization, the nightly job 48; the aggregate has one
minute, keeping the mandatory jobs' execution budget at twenty-one.
GitHub queue and environment approval wait time are outside job execution limits.
A hard job cancellation may prevent evidence finalization, and never passes the gate.

Dispatch with `force_failure: true` to exercise the evidence path. The first
attempt fails after the real access assertions; the CI-only diagnostic retry
repeats them and passes, while the overall run stays red. Inspect the safe console
summary, `report.html`, `report.json`, application screenshots, first-retry trace
ZIPs, `stages.log`, and allowlisted service diagnostics when present. CI retains
only the sanitized artifact directory for thirty days. Bootstrap never runs in CI.

Local verification on 2026-09-09 completed a normal journey against a recreated
preview and fresh role sessions. A separate run using CI retry settings completed
the intentional first-attempt failure followed by a passing retry, exited 1, and
retained the HTML/JSON reports, three application screenshots, three sanitized
retry traces and logs. These are local live-service checks, not evidence of a
GitHub Actions run or activated branch protection.

### Current rollout and deferred enforcement

Issue #25 targets the existing private, personally owned GitHub repository.
Owner-authored same-repository PRs targeting `main` receive the **E2E required**
aggregate result. Despite its stable name, this is an advisory check: the current
GitHub plan does not enforce it as a merge requirement. A red result must be
handled by the owner before merging. The `e2e` environment permits both `main`
and `refs/pull/*/merge`; fork and bot runs remain excluded by the workflow.

Mandatory branch protection, environment approval gates and merge queues are
explicitly deferred rather than prerequisites for PR testing. GitHub Pro can
provide private-repository branch protection, but private environment reviewers
and private merge queues require Enterprise Cloud, with organization ownership
also required for merge queues. An organization transfer would require replacing
the workflow's repository-owner/user comparisons with an explicit trusted-user
policy before enabling execution.

When those features become available, configure **E2E required** from GitHub
Actions as a required check while retaining other required checks. Add protected
merge-queue environment refs and restore `merge_group` support in all required
workflows and the E2E preflight. Validate actual PR and queue runs before declaring
mandatory enforcement active.

References: [Clerk users API](https://clerk.com/docs/reference/backend-api/tag/users/post/users),
[Clerk organizations API](https://clerk.com/docs/reference/backend-api/tag/organizations/post/organizations),
[GitHub environment restrictions](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

## Existing-militia journey

`existing-militia.spec.ts` owns the `existingMilitia` fixture and a separate
`isolation` comparison fixture. Both reset before every attempt and clean up
afterward; neither depends on the access journey's campaign. Setup starts with
an empty campaign and enters the militia, officer, teams, settlement, week context,
persistent sickness and next-week bonus through the Ledger.

The journey distinguishes an empty rank from a malformed rank using visible,
field-associated errors. It saves an intentional manager-limit exception with
an explanatory team note and checks the advisory warning. All observations use
production UI roles, labels and text, including reload and campaign switching.
No fixture inspection API is used to assert application behavior. The required
result evaluator rejects a run of its suite that omits this journey.

Live verification on 2026-09-09 passed authentication and both journeys on their
first attempts against the recreated local preview and a production web build.
The existing-militia journey completed in about 25 seconds, including reload,
the comparison campaign checks and switching back to the initialized militia.

## Character and officer ledger journey

`character-ledger.spec.ts` owns the `characterLedger` fixture. It starts with a
militia and an empty character ledger, while two separately authenticated member
contexts open the same campaign before changes begin. The GM creates and assigns
two characters through the production UI; the player observes each update without
reloading. The player then moves one character into the occupied Marshal role,
which replaces the former officer without deleting either record, and the GM
clears that assignment. Both contexts finally reopen the campaign and verify that
the two records and unassigned officer roles persisted. Assertions wait only on
visible ledger rows, role cards, and dialogs.

## Complete-week journey

`complete-week.spec.ts` owns the `completeWeek` fixture, independently reset and
cleaned for every attempt. It begins at week 2 Upkeep with rank 1, training 10,
treasury 100, no staged actions and no event carry. A regular player enters
attrition 2, stages Drill Militia with a successful check of 15 and training gain
4, and enters an event trigger roll of 100 against the default chance of 10.

The player reviews the saved inputs and Resolution Preview, then uses Confirm
Week to submit the reviewed Weekly Draft Revision. The journey checks training
12, treasury 90, notoriety 0, week 3 Upkeep, uneventful carry 1, and cleared draft
inputs through the production board and ledger, both immediately and after reload.
It does not inspect backend state or intercept mutations. Exact revision rejection,
atomicity, calculations, and rule permutations remain in the existing mutation
harness and rules tests. The required aggregate rejects runs missing this journey.

The journey exposed Activity roll edits being lost when phase navigation unmounted
the roll panel before its separate autosave timer fired. Valid edits now enter the
board's existing mutation queue directly; a component regression covers immediate
unmount and keeps malformed numeric input local.

While the week is confirmed, the player's second device keeps an Edit character
dialog open with an unsaved name on Characters & officers. That page must observe
the new week's draft without inserting its skeleton, and the typed name must
survive (#198).

Live verification on 2026-09-09 passed authentication and all four required
journeys on their first attempts against the recreated local preview, including
complete-week Confirmation and reload. Typecheck, lint, and all 318 tests passed.

## Realtime Action Slot journey

`realtime-action-slot.spec.ts` owns the `realtimeActionSlot` fixture. Two separately
signed-in members open the same week 1 Activity board and observe empty Action
Slot 1 before a regular player taps the visible staging control for Drill Militia.
Both contexts then observe that choice marked Staged in week 1, without reloading
or competing writes. The required aggregate rejects a missing or non-passing journey.

Actions have no individual confirmation. The local specification corrects the
original issue’s assumption about a Confirmed Action Choice: Confirm Week commits
the entire Weekly Draft and is covered by the complete-week journey. First-claim
locking, release, cancellation, timeout, reconnect, invalid-drop recovery, and GM
moderation coverage remain deferred until those capabilities exist.

Failure reports identify the journey, expected Action Slot state and choice,
player, and last rendered slot text from both contexts. The shared fixture also
retains application screenshots for both contexts and sanitized traces on CI retry.

Live verification on 2026-09-09 passed authentication and all five journeys on
first attempts against the recreated local preview and production web build.
The realtime Action Slot journey completed in about six seconds. Typecheck,
lint, all 320 tests, and the three build-boundary checks also passed.

## Nightly compatibility matrix (#30)

Run the same isolated harness with `--suite nightly`. Since #752 nightly runs the
mandatory suite, every focused group and live integration on Chromium tablet as
a full regression, plus the compatibility projects below (see
[Suites](#suites-752)); the table shows the selection #30 introduced, and
`canonical-cutover` has since been deleted. Nightly selects:

| Project         | Viewport | Journeys                                                                                             |
| --------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| Chromium tablet | 1194×834 | All twelve, plus navigation/form/persistence and reconnect steps                                     |
| WebKit tablet   | 1194×834 | All twelve critical journeys                                                                         |
| Firefox desktop | 1440×900 | Access and the three journeys split from it, existing-militia initialization, complete week          |
| Chromium phone  | 390×844  | Access with focused navigation, form layout, reload and cross-layout edits; the three split journeys |

The journeys split from access are campaign home, campaign sections and week
links (see [Access split](#access-split)). The private-character journey checks
owner creation, editing and deletion, including refusal of access by another
player. The Character navigation journey checks owned groups, independent campaign
sheets and origin Back within one organization. Cross-organization behavior is
covered by Convex and hook tests. The membership-loss journey checks that a
player who leaves the organization loses its campaign at once while another
member keeps working, and gets their Character back under No campaign. Nightly
requires 64 first-attempt results and the mandatory run 7 (#752), including
authentication.

The access journey's nightly extension creates a character, checks that form
controls fit the viewport, reloads the saved record, edits at the alternate
phone/tablet size, and reloads again at the original size. The Chromium tablet
Action Slot extension disconnects the observing member while the player replaces
the staged choice, then verifies the observer catches up **without reload** and
the player's reload retains the choice. These exercise existing behavior; claim
locks, individual action confirmation and GM moderation remain deferred.

Each concurrently running worker owns one reserved cohort; tests sharing a cohort
never run at the same time (see Parallel cohorts below). Each attempt resets
and cleans its case before the next test in that cohort uses it. Case ownership is
checked within each project; screenshot and trace filenames include the project so
cross-browser evidence cannot overwrite earlier failures. Contexts inherit actual
project viewport, touch and mobile settings. Desktop uses keyboard staging.
Authentication runs once with fresh sessions, then each browser gets independent
contexts. Nightly requires all 17 selected tests (including authentication) with
exactly one successful first attempt, using the mandatory gate's no-skip,
no-quarantine, secret, reset, retry and sanitized-artifact policies.

`.github/workflows/e2e-nightly.yaml` schedules default-branch execution at 02:23
UTC, or accepts an owner-reviewed manual SHA. It shares the CI preview slot's
concurrency group with the mandatory workflow. Its result is advisory: it is not
an input to **E2E required** and never changes a previous merge result. Install
Chromium, WebKit and Firefox with Playwright's supported OS dependencies before
running locally. The CI job runs in `mcr.microsoft.com/playwright:v1.63.0-noble`,
which already contains all three.

Safe reports include project, journey, assertion errors with expected state,
and observing roles' last rendered domain state on failure. Recurrence summaries
contain only fixed journey identifiers and hashes of failing step paths, never
provider payloads. The separate triage job has issue-write permission and no
Clerk or Convex credentials. It compares the current run to the preceding 19
completed workflow runs, counting a diagnostic retry only once. Two consecutive
failures or two failures within that window create or update one issue per
project/journey/failing step; a closed matching issue is reopened on recurrence.
Different failing steps do not count toward each other's threshold. Historical
summaries retain syntactically valid keys from retired journeys; those keys do
not prevent escalation for journeys in the current catalog. Setup failures
produce a dependency-free infrastructure summary. Missing/expired historical
artifacts are unknown, so they do not supply evidence of recurrence. Hard job
cancellation can prevent summary upload and is never treated as a pass.

The summary is retained for 30 days alongside the existing safe evidence. The
nightly schedule and automated issue writes take effect after this workflow lands
on the default branch; local tests do not publish issues.

Live verification on 2026-09-09 passed all 15 nightly tests on their first attempts
in Playwright's Ubuntu container against the dedicated local preview. This
includes all four browser/layout projects, reconnect catch-up before reload, and
phone/tablet persistence. All 17 fixture resets and cleanups completed. This is
local live-service evidence; the GitHub schedule and issue publication have not
been run. Secretless tests also cover the recurrence threshold and GitHub create,
update and reopen behavior using a fake GitHub command.

Both browser workflows call `.github/workflows/e2e-runner.yaml` for setup,
execution budgets, environment credentials, and evidence retention. The callers
own their trigger/trust rules and shared concurrency slot; the mandatory caller
keeps the fail-closed aggregate, while the nightly caller owns issue triage.

## Weekly Draft extraction gate (#60)

Every extraction under #57 must pass the complete supported-path **E2E required**
suite before merging, together with typecheck, lint and relevant lower-level tests.
Run it against the proposed merge commit. The existing owner-enforced merge policy
above still applies; this requirement does not activate GitHub branch protection.
The required result catalog remains independent of Playwright discovery: omitting
the multiplayer journey or passing only on retry leaves the aggregate red.
Reporter integration tests exercise both cases through actual Playwright results.

The required Action Slot journey now uses `support/transport.ts` on the regular
player's page, installed before navigation and restricted to the bound preview's
WebSocket host. It forwards unchanged frames to the actual Convex server using
[Playwright's WebSocket interception](https://playwright.dev/docs/api/class-websocketroute#web-socket-route-connect-to-server).
`next` arms one delayed mutation request, delayed mutation response, or dropped
acknowledgement, matched to the next outgoing mutation’s request ID so an older
response cannot satisfy the fault. `observed` supplies a bounded `expect.poll` synchronization point;
`release` forwards held frames in order. A delay holds subsequent frames in that
direction to avoid manufacturing protocol reordering. Dropping an acknowledgement
never drops or fabricates the transaction itself. Payloads remain in memory and
are never attached to reports.

Both authenticated members open the board before the player stages a choice.
The writer navigates to Event and back while its request is held; the observer
remains in Activity with no staged choice. The observer sees the replacement
while its response is held, and sees the final choice despite a dropped response.
Writer reloads prove persistence after the latter two cases. These are current
supported behaviors; reload recovery does not prove canonical idempotent retry.
The journey retains the same owned fixture, reset/cleanup, CI matrix and failure
screenshots/traces for both players. `force_failure` now also fails the multiplayer
journey's first attempt after the transport assertions, exercising both-player
failure evidence and a diagnostic retry that must remain red.

Extend this same gate as canonical behaviors land, without skipped placeholders:

- Workspace extraction: independent Phase Views, navigation during pending edits,
  immediate feedback and visible recovery after a rejected edit.
- Persistence extraction: disjoint edits, same-target failure, atomic choice
  moves/swaps, obsolete detail rejection, dropped-response idempotent retry and
  ordered/monotonic acknowledgement.
- Confirmation extraction: reviewed-source rejection, racing Confirmations with
  one history outcome and one successor, and delayed old-week edits rejected after
  advancement.

Use rendered domain outcomes for browser assertions and the shared real-adapter
contract suite for deeper transaction cases. Keep canonical behavior isolated
until its approved cutover. The accepted #36/#38 contract supersedes older claim,
lock and individual-confirmation wording elsewhere in this document.

The merged #58 SDK upgrade requires refreshed `convex/_generated` bindings:
platform environment declarations and the aggregate package's component API type.
These are generated output, verified byte-for-byte against the isolated preview;
the drift guard now names a mismatched file for diagnosis.

Live verification on 2026-09-09 passed authentication and all five mandatory
journeys on their first attempts against a recreated local preview and production
web build. A separate local run with CI retry settings reached the deliberate
access and multiplayer failures, then passed both diagnostic retries; its report
remained failed and the runner exited 1. Both multiplayer roles retained failure
screenshots and sanitized retry traces. The final request-ID matching helper was
exercised by that drill. This is local live-service evidence, not a hosted CI run
or activated branch protection. Typecheck, lint, all 347 tests, build-boundary
checks and the rules-catalog check also passed (the catalog retains its explicit
473 implementation gaps).

## Campaign context preparation (#64)

The additive `canonicalCampaignContext` table and unregistered preparation seam
retain settlement context, one-use bonuses, queues, first-use/carry metadata,
per-instance event targets/age/order/mitigation/ending, militia-wide buyoff week,
and copper-precise assets and order delivery/receipt facts. The reusable campaign
facts editor is available for isolated ledger/setup integration; no live route or
canonical endpoint is activated. Referenced teams must be removed from event and
queue facts before roster deletion. Missing facts remain explicit instead of
being inferred from legacy week numbers, rounded delivery weeks or character
levels. Later projection and cutover work still owns rule execution and activation.

Local verification on 2026-09-10 passed the isolated preview deployment,
production web build, authentication and all five required browser journeys.
Generated API declarations were refreshed from the preview and verified by the
harness. Typecheck, lint and all 394 tests passed. The rules catalog reports 21
covered cases and 473 explicit later implementation gaps with zero catalog errors.
New outcome tests cover shared round trips, reference ownership and removal,
unknown versus zero, repeated event instances, receipt consistency, fractional
enchantment input and field-level target repair. Both standards and specification
reviews have no outstanding findings. This is local preview evidence, not a
production deployment or canonical cutover.

## Upkeep extraction (#67)

Local verification on 2026-09-11 passed authentication and all five required
browser journeys on their first attempts against the recreated
`e2e-local-andreasununger-slot-0` preview and production web build. The successful
run is `everythingpath-e2e-sFMIfI`; its safe report records zero errors. This
preserves the supported legacy path while canonical Upkeep remains isolated.

The initial deployment attempt exposed `Array.at()` in the shared progression
module against Convex's older TypeScript library target. Equivalent indexing
restored compatibility. Both application and Convex typechecks, lint, all 541
Vitest tests, and the rules catalog now pass. The catalog records 140 covered
cases, 472 explicit remaining gaps, and zero errors. Upkeep parity compares seven
canonical scenarios through the browser-target bundle and Convex-test stored
source; complete Workspace and Confirmation parity remain later gates. Standards
and specification reviews have no remaining findings. This is local preview
verification, not hosted CI evidence or a production cutover.

Follow-up QA fixes passed on 2026-09-11 in `everythingpath-e2e-aVbLtS`:
all five supported browser journeys passed against the same isolated preview.
All 544 tests, both application and Convex typechecks, lint, and the rules catalog
passed. Independent QA exercised 21 schema-validated projections covering manager
bonus scope, transfer eligibility, funds ordering, Theft, and matching exceptions
without remaining findings. Canonical Workspace browser coverage remains a later
gate.

## Canonical persistence and Confirmation contracts (#79–80)

The mandatory and nightly gates include one `canonical-persistence` Chromium
project after authentication. It runs the same contract scenarios as the memory
adapter against the production Convex transport and actual isolated transactions.
This is service-contract verification; the five existing browser journeys still
exercise the supported user interface while the canonical Workspace is isolated.

Each scenario resets the owned `canonicalPersistence` fixture. Separate GM and
player browser sessions supply genuine Clerk Convex tokens to Node Convex clients;
the clients use production queries, mutations and subscriptions. Tokens stay in
memory, provider logging is disabled, and failures pass through the harness's
sanitizer. Outsider and anonymous sessions must fail to read or edit the draft;
a member request mixing its militia with another owned campaign must also fail,
leaving the entire original draft unchanged. Internal fixture
initialization and closing use the bound preview capability; normal editing still
passes the application's authentication and campaign checks. Existing fixture
cleanup removes the case after the test, including failed attempts.

The same project runs the shared Confirmation scenarios against real transactions:
exact accepted review, a local edit barrier, external source changes, concurrent
confirms, delayed edits, and dropped acknowledgements. An owned closed draft
with a colliding successor identity forces a failure after the outcome writes,
proving that the transaction rolls back. Internal inspection checks the stored
snapshot, history, and single open successor. An additional scenario verifies
literal treasury values after a Special action and table adjustment, and confirms
as an ordinary player. Outsider, anonymous, and cross-campaign Confirmation
requests use a ready accepted preview, so incomplete input cannot mask a missing
authorization check.

`E2E required` rejects a missing, skipped, failed, or retry-only persistence
contract. The nightly matrix runs this contract once, alongside the existing
browser/layout matrix. The aggregate and actual Playwright reporter tests cover
missing-contract and retry-only failures. Run through `pnpm test:e2e` with the
same dedicated resource declaration and secrets as the other journeys.

## Canonical Upkeep Workspace journey (#81)

The required `canonical-workspace` Chromium project opens the isolated Workspace
with two authenticated players. Its owned fixture starts in week four so the
journey enters real Upkeep rolls, checks calculated defaults and shared outcomes,
and stages a deposit in gp, which needs no character or officer (#158). Keyboard and clipboard interactions verify that
invalid text preserves the current digits, zero remains distinct from clearing,
and field errors appear in the application.

The journey holds one outgoing edit at the browser's WebSocket boundary while
queries and authentication continue normally. A second player's same-field edit
then produces a real server rejection when the held edit is released. This checks
immediate pending feedback, independent phase navigation, the page-exit warning,
restoration of the latest accepted value, and a successful explicit retry. An
ordinary player confirms the complete week and both browsers observe its successor.

Successful runs save `canonical-upkeep-tablet.png`, `canonical-upkeep-phone.png`,
`canonical-upkeep-desktop.png`, and `canonical-upkeep-errors-tablet.png` for
visual inspection. The original five
campaign journeys and the deployed editing/Confirmation contracts remain required.
The Workspace route remains unavailable to live campaigns during this extraction.

## Independent service contract deadlines (PR #93)

CI run `34683202465` retained the first failure in `progress.json`: authentication
and all six application journeys passed on their first attempts, while the
combined service test exceeded its 300-second deadline. Its completed fixture
commands consumed about 145 seconds, with continued progress through editing and
Confirmation. The resulting diagnostic retry then reached the unchanged
720-second overall deadline. The isolated local baseline completed the combined
test in 226 seconds, so a local pass alone did not establish adequate CI margin.

The unchanged 11-scenario editing contract and eight-scenario Confirmation
contract now run as separately required tests, each retaining the 300-second
limit. Confirmation still includes its independent literal-state and authority
checks. `canonical-persistence` and `canonical-confirmation` use separate project
ownership namespaces for the existing declared fixture capabilities, with one
worker and a fresh reset per scenario. The fixture ownership guard is unchanged.
The mandatory matrix requires nine first-attempt results and nightly requires 18. Omitting either contract or passing only on a retry fails the aggregate;
neither the 720-second workflow budget nor retry acceptance was relaxed.

Local verification of the split passes 873 tests, typecheck, lint and the rules
catalog (380 covered cases, 290 explicit gaps, zero errors). The focused aggregate
regression first failed when Confirmation was absent, then passed with the new
required test. Actual reporter-protocol tests also reject missing and retry-only
Confirmation results. Fresh full isolated QA and the hosted CI rerun are pending.

## E2E failure follow-up (2026-09-14)

Required CI run `34721636351` reached the 720-second deadline while the final
Confirmation contract was still progressing. Each contract scenario now resets
and initializes its owned fixture in one guarded transaction, and each contract
test reuses its authenticated clients across scenarios. Reset isolation,
per-scenario authorization checks, transaction assertions, and required results
remain intact. A Convex integration regression proves fresh case creation and
rollback when initialization or capability validation fails.

Nightly runs `34745454875` and `34820347494` exhausted the existing-militia
journey's 60-second deadline at different controls. The traces showed continued
progress through more than fifty pointer interactions. That full onboarding and
reload journey now has a 120-second deadline; the aggregate budget stays at 720
seconds and retries still cannot satisfy the gate.

A full local nightly run then exposed WebKit's Clerk redirect loop during the
Action Slot reload assertions. A controlled cookie probe showed that WebKit
rejects `Domain=localhost` but accepts `Domain=127.0.0.1`. The harness now uses
the latter origin, with a localhost server hostname to avoid
[Next's loopback rewrite mismatch](https://github.com/vercel/next.js/issues/94745).
The final hostname pair passed a temporary 30-reload live WebKit stress probe
(`everythingpath-e2e-6JnKBJ`); that focused run intentionally did not satisfy the
aggregate gate. All temporary probes were removed, and the original real reload
assertions remain unchanged.

## Expanded suite deadline (2026-09-15)

PR #93 run `35006064700` was interrupted at the 720-second workflow deadline.
All eight completed required results passed on their first attempts; the ninth,
Confirmation, was still progressing through historical-view assertions. The
expanded canonical Workspace journey, now including new and mid-campaign setup,
took 230 seconds. Installation and preview/build consumed about two minutes
before browser execution, leaving insufficient room for the complete suite.

The aggregate execution budget is now 900 seconds in CI, the local runner,
Playwright, and its application server. The CI job allows another two minutes
for teardown and evidence retention. Individual test deadlines, one-worker
fixture isolation, all required results, and first-attempt acceptance are
unchanged. This explicitly supersedes the earlier 720-second budget; it does
not classify incomplete or retry-only results as passing.

## Expanded compatibility-suite deadline (2026-09-27)

The #154 run at `f9b08db` completed eighteen nightly journeys on their first
attempts with zero recorded errors before the 900-second outer deadline stopped
execution before the phone journey. It is an incomplete gate, not a pass.
The browser stage consumed about 843 seconds; the remaining phone journey
has previously taken about 48 seconds, while outer setup consumed about 57 seconds.
That suggests roughly 950 seconds for the full run before modest runtime variation.

The aggregate execution budget is 1,050 seconds (17.5 minutes) in CI, the local
runner, Playwright, and its application-server lifetime. The CI browser job allows
twenty minutes, leaving 2.5 minutes beyond execution for teardown and evidence.
This supersedes the 900-second aggregate limit above. All nineteen nightly journey
identities, first-attempt acceptance, individual test and assertion deadlines,
one-worker fixture isolation, preview authorization and redaction remain unchanged.
No incomplete run becomes a pass; the complete gate must still be rerun and verified.

## Local budget and shutdown (#729, 2026-10-15)

The first full #729 run (one worker, the 17.5-minute budget) was cut off after
13 results: the runner's deadline terminated Playwright before `onEnd`, so no
report was written and `progress.json` stayed `running`. The server, still
shutting down after the wrapper had copied and deleted the evidence, then
re-created `e2e-artifacts` with one `stages.log` line. Four clocks had started
at different times (the runner's, Playwright's `globalTimeout`, the
application server's and CI's). Now:

- **One deadline.** The runner computes it once, at its start
  (`support/deadline.ts`): the budget (`--budget-minutes M`, 5 to 120, default
  17.5) from that moment. It stores `deadline` and `browserStopAt` (one minute
  earlier) in the run file. Setup must finish by `browserStopAt`; Playwright's
  `globalTimeout` ends there, and the runner sends Playwright's process group
  SIGINT there too, as Ctrl+C would. The minute left covers interrupted tests,
  fixture teardown, the server's 10 s graceful shutdown and the report. At
  `deadline` whatever still runs is terminated. The application server's
  lifetime ends at `deadline`. The runner prints the budget, stop point and
  deadline before deploying. In CI the deadline comes from the workflow's
  own 17.5-minute budget, which starts with the job:
  `--outer-deadline-epoch "$E2E_DEADLINE"` puts the runner's deadline 30 s
  before the workflow's interrupt (`outerDeadlineReserveMs`), time to
  terminate, reap and finalize; the workflow kills 5 s after its interrupt.
  `--budget-minutes` and `--outer-deadline-epoch` exclude each other, and the
  outer deadline is refused outside trusted GitHub CI, so it cannot bypass the
  local budget's 5–120-minute bounds.
- **Process groups.** Each command the harness starts leads its own process
  group. When the command's process exits, anything left in its group gets
  SIGTERM once and SIGKILL 5 s later, and the command settles only once the
  group is empty (before, the SIGKILL was cancelled when the direct child
  closed). A SIGINT or SIGTERM to the runner interrupts the browser stage
  the same way as its stop point, and terminates it if it is still running a
  minute later. Shutdown starts when the command's process exits, not when its
  pipes close, which a descendant holding them could delay until the timeout;
  the pipes are drained afterwards (`support/process-group.ts`). A finished
  command no longer creates the evidence directory: only a starting command
  may, so a late `failed` line cannot re-create it.
- **Every run process.** Playwright starts other groups itself: browsers and
  the application server, whose wrapper starts `next start` in another. The
  runner marks every process it starts (`E2E_RUN_TOKEN`, a fresh UUID) and,
  once the browser stage has ended, stops and awaits every marked process
  (Linux `/proc`, so locally and in CI) before it finalizes the checkpoint.
  The same step runs first among its cleanups. If a process survives SIGKILL,
  the runner keeps the temporary workspace, the slot lock and the unfinalized
  checkpoint, and reports `E2E cleanup also failed: processes`.
- **Wrapper order.** `scripts/orchestration/e2e-branch.sh` marks every process
  of the run (`E2E_PROCESS_TOKEN`, which the runner forwards) and, on exit or
  on INT/TERM, runs: stop (Ctrl+C to the runner's process group), wait and reap
  (the runner, then every marked process, with SIGTERM and SIGKILL after a
  grace), finalize and print the result, copy the evidence, delete. Finalizing
  and the summary line are `e2e/finalize-evidence.ts` from the script's own
  checkout, the same `finalizeProgress` the runner uses: Playwright's result
  or, for an incomplete run, the completed (passed and failed), interrupted
  and unstarted tests. If a marked process survives SIGKILL, it finalizes,
  copies and deletes nothing, keeps the slot guard, prints the survivors and
  the recovery steps, and exits 3.
  `scripts/orchestration/e2e-branch.test.sh` checks this with a stub runner.
- **Per-test limits.** The global budget changes none of these. Five tests
  used 83–90 % of their limits with one local worker (used/limit, seconds):
  Confirmation contract 271/300, settlement/rank (notoriety) 26/30,
  persistent events 71/80, racing Confirmations 49/55 and Upkeep 108/130. With
  parallel workers on GitHub's 4-vCPU runner (#198), journeys took about 1.6
  times their local time, and local runs have no retry. Each limit is
  now 1.6 times its run-1 time, rounded up to 5 s: 440, 45, 115, 80 and 175 s.
  This supersedes those five limits above; the limits still catch a hang, not
  a slowdown. Every other test limit is unchanged. Full run 2 (two local
  workers) then used 90 % of the team recovery journey's limit (112/125 s) and
  82 % of the persistence contract's (245/300 s); by the same rule they are
  now 180 and 395 s.

## Accepted campaign regression (#91)

#752 deleted `canonical-cutover` (owner decision D-1, reduction R-1); see
[Coverage removed or reduced](#coverage-removed-or-reduced). What follows is
its history.

The mandatory matrix still contains ten journeys (nineteen for nightly).
The `canonical-cutover` project now verifies the supported post-cutover path:
an explicit accepted mid-campaign source enters ordinary setup, edits and
Confirmation, then retains its successor and immutable history after rejected
legacy calls and a browser reload. Missing or retried results fail the aggregate.

The completed paused migration, backup restore and bounded-cleanup rehearsals
remain in the private evidence referenced by [legacy retirement](../docs/legacy-retirement.md).
The compatible cleanup release is `b249911`; restore an old backup only with its
compatible release. The narrowed schema deliberately cannot run migration or
resume legacy gameplay. No operational campaign is advanced by these tests.

Ordinary `/campaigns` journeys use canonical-only fixtures and cover membership,
setup/reload, shared characters, persisted officer assignments, Confirmation,
history and shared action choices. The broader Workspace journey continues to
cover independent navigation, conflict recovery, input clearing and phase behavior.

## Parallel cohorts (2026-09-27)

With the owner's approval, one worker per cohort replaces the one-worker fixture
isolation recorded above. Tests are about 93 % of a nightly run, and each cohort
(member organization, outsider organization, GM, player and outsider) is a
complete isolation unit: its organizations are disjoint from every other cohort's.

- **Workers.** `pnpm test:e2e` starts one Playwright worker per declared cohort,
  capped at three and at one per two CPUs of Node's `availableParallelism()`
  (the console line names both). `--workers N` selects between 1 and the
  declared number; use `--workers 1` for a serial baseline on the same
  declaration. The CPU cap exists because each worker drives two or three
  browser contexts, its fixture CLI processes and a share of one production
  server. GitHub's runner reports 4 vCPUs; with three workers
  (run `36546333184`) every journey took about 1.6 times its local time. Steps
  that only resize and measure layout took 2–2.7 times as long, while steps
  that wait for another device took 1.2–1.5 times, and fixture calls rose from
  about 1.05 s with one worker to 1.6 s. The five `canonical-workspace` journeys
  with the least headroom (1.4–1.6 times their local time) then timed out on
  both attempts. Convex latency is not the cause: with one CI worker, `main`
  ran the then-combined Workspace journey in 203–228 s (168–200 s locally)
  and fixture calls of about 1.1–1.3 s (#198). CPU
  quotas such as `docker run --cpus` are not visible to
  `availableParallelism()`; pin CPUs
  with `--cpuset-cpus` or pass `--workers` when emulating a small runner. The runner refuses
  cohorts that are out of order (`worker-0`, `worker-1`, ...) or share a key,
  organization or identity. `fullyParallel` stays off: files run whole on one
  worker, except `canonical-workspace.spec.ts`, which opts in per test. The
  authentication setup seeds and signs in every used cohort one after another,
  because parallel sign-ins would exceed Clerk's per-IP limits. The limit is
  60 s per cohort and cohorts sign in sequentially, so its deadline is 60 s
  times the number of cohorts used (180 s for three). No cohort gets more time
  than the single-cohort setup had.
- **Isolation canary.** Every reset carries its test's owned and comparison
  cases (see Fixture contract). A second test in the cohort, a failed cleanup or
  a campaign created outside the fixtures fails the next reset in that cohort.
  Convex tests prove that the canary rejects each kind of foreign campaign and
  rolls the reset back. After a cleanup finally failed, each later reset the
  canary refuses in that cohort still fails, reported as `fixture resetCase:
blocked by leftover case <case> in worker-N, ...`, so a cascade reads as one
  cause; the case's own next reset removes it and clears the note.
- **Evidence.** Each attempt in `progress.json` and `report.json` records
  `workerKey` (`null` for authentication, which prepares all cohorts). The
  console line names the cohort too.
- **Order.** Projects are listed longest first, so the parallel critical path
  stays close to the longest single test. Since #752: the Confirmation and
  persistence contracts, `live`, the focused groups and `mandatory` by their
  longest journeys, then the compatibility projects (`support/matrix.ts`).

### Workspace journeys

Since #752 the first part is split again: its Setup and its week frame,
reference panel and responsive sweep are journeys of their own in focused
groups, sharing its case (see [Suites](#suites-752)); the rest is history.

`canonical-workspace` was one 242–255 s journey. It is now five independent
tests, split at its four existing reset boundaries. Each test owns a canonical
case, and each case keeps the `canonical-persistence-*` names so that the layout
and overflow assertions measure text of the same length. Moved steps are
unchanged. The first part installs the held-edit socket control on the GM page
where the single journey did. Parts two to four install their own control
before their first navigation, because their GM page had used that control. The
race part uses only fresh pages with their own controls, as before.

| Journey                                                                                                      | Case                        | Starting state                                                                          |
| ------------------------------------------------------------------------------------------------------------ | --------------------------- | --------------------------------------------------------------------------------------- |
| players prepare shared Upkeep with independent navigation and save recovery                                  | `workspaceUpkeep`           | `resetCase`, then plain `initializeUpkeep` (week 4); setup moved out (#752)             |
| players choose the nearest settlement at maximum notoriety and resolve team conditions                       | `workspaceNotoriety`        | `resetCase`, then `initializeUpkeep` with choices, maximum notoriety and a missing team |
| players recover a team at an adjusted cost and confirm a week through Activity and Event                     | `workspaceRecovery`         | `resetCase`, then `initializeUpkeep` with choices                                       |
| players review and buy off carried persistent events before confirming the week                              | `workspacePersistent`       | `resetCase`, then `initializeUpkeep` with persistent events                             |
| racing Confirmations commit one reviewed week and reject stale and delayed changes                           | `workspaceConfirmation`     | `resetCase`, then plain `initializeUpkeep` on three fresh pages                         |
| settlement and rank cards and team repairs stay reachable on phone and desktop                               | `workspaceUpkeepLayout`     | `resetCase`, then `initializeUpkeep` like `workspaceNotoriety`, on the GM page only     |
| Event blocks and the week review stay reachable at phone landscape and on a narrow tablet                    | `workspaceEventReview`      | `resetCase`, then `initializeUpkeep` with persistent events, on the GM page only        |
| Activity fits landscape sizes, pans by touch and follows a correction and a Confirmation from another device | `workspaceActivity`         | `resetCase`, then plain `initializeUpkeep` like `workspaceConfirmation`                 |
| a finger pan over the settlement cards scrolls and chooses nothing, and a tap chooses                        | `workspaceSettlementTouch`  | `resetCase`, then `initializeUpkeep` like `workspaceNotoriety`                          |
| Drill shows its notoriety and Training rolls only when its check needs them, with a maximum-rank exception   | `workspaceDrillRolls`       | `resetCase`, then plain `initializeUpkeep` like `workspaceActivity`                     |
| players set up a new and an existing militia while the other member follows and the outsider is refused      | `workspaceUpkeep`           | New and mid-campaign setup through the UI (#752: split from the Upkeep journey)         |
| the Upkeep week frame, reference panel and a failed History stay usable at every size                        | `workspaceUpkeep`           | `resetCase`, then plain `initializeUpkeep` (#752: split from the Upkeep journey)        |
| players stage, move and clear Activity choices for a recovered team and see a stale replacement rejected     | `workspaceRecoveryActivity` | `resetCase`, then `initializeUpkeep` with choices and the adjusted recovery             |

Each later step started with the same reset and seed, so the database state is
unchanged. The only browser state that crossed a boundary was also checked:

- Every part left both pages at 1194×834, the project viewport.
- The reference panel preference was open, the same as a fresh context.
- The clipboard permission is used only in the first part.
- Back/forward history is exercised only within a part.

The only lost coverage is one GM and player session surviving all five parts. The
first part keeps setup, both campaign states and the full Upkeep journey in one
session. The 420 s test deadline is split in proportion to the measured parts
(130, 30, 125, 80 and 55 s), and no part gets more than its share.

A sixth journey, `workspaceUpkeepLayout`, was added later (#140) rather than
split: it repeats the settlement/rank fixture on one page and checks its
settlement cards, missing-team row, disabled-team cards and rank feat cards at
390×844 and 1440×900. The settlement/rank journey runs about 21 s of its 30 s
limit, so the checks got their own case and a 60 s limit instead of growing it.

A seventh journey, `workspaceEventReview` (#143, #145), is also added rather
than grown into another. The Activity-and-Event journey (89 s of 125 s) and the
persistent journey (54 s of 80 s) keep their margins. On the GM page only, it
rolls an Invasion after an out-of-range chance roll of 0 and records what
happened. It checks the Event blocks at 844×390 and at 1180×820 with the
reference panel closed. Review & confirm is checked at 844×390 and at 1180×820
with the panel open and closed. Review must list the chance warning once in
its Warnings with its phase and place it under the Event chance consequence
(SUM-09). The Invasion's recorded outcome must be quoted under that event
(SUM-11). It has a 60 s limit (`support/event-review-layout.ts`).
An eighth journey, `workspaceActivity`, was added the same way (#142). The
recovery journey that runs the tablet Activity checks takes about 89 s of its
125 s limit, so the Activity checks §6 names got their own case, a 90 s limit
and `test.step` timings: the board, details and picker at 844×390 and
1180×820; a touch pan on the picker (a Chromium touch scroll gesture) that
places nothing, then a tap that places; a Militia correction on the player's
device lowering the allowance under the GM's staged slots; and a Confirmation
arriving while the GM's picker is open, with the GM's successor held so the
locked picker can be observed.

Two more were split out the same way (#198) after GitHub run `36594934978`
(4 CPUs, two workers) timed out the settlement/rank journey (30 s limit;
28.2 s in the last green run, `36561396514`) and the recovery journey (125 s
limit; 113.9 s when green) on both attempts. Each grew with a #198 check that
now has its own case, a 60 s limit like the other split-out journeys, and
`test.step` timings:

- `workspaceSettlementTouch` takes the nearest-settlement touch pan and taps
  (`panAndTapSettlementCards`) from the settlement/rank journey. It seeds the
  same fixture and enters the same Upkeep rolls. A mouse then chooses Phaendar
  and drops Misthome outside the selection area, so the pan starts where it
  did before: after a missed mouse drop, whose suppressed click a tap must not
  inherit. The settlement/rank journey keeps its mouse drag and missed drop.
- `workspaceDrillRolls` takes Drill's conditional rolls from the recovery
  journey (`exerciseDrillRolls` in `support/activity-workspace.ts`): the
  notoriety roll appears only on a natural 1, and the Training roll stays
  hidden until the check succeeds. That needs a reasoned Maximum Rank
  exception, because the rank-2 militia with a level-2 PC is already at its
  maximum rank. The other player then sees the Training total. It stages
  Drill on the plain week that `workspaceActivity` opens. The recovery
  Activity checks (now `workspaceRecoveryActivity`, below) still stage Drill
  for their rejected stale replacement but enter no rolls, and clear it, so
  the recovery journey's confirmed week never used a Drill Training value
  and its expected totals (35 gp, the 20 gp recovery and the 5 gp
  adjustment) are unchanged.

Both were mandatory then, like every Workspace journey (since #752 only the
Upkeep core and Drill are; see [Suites](#suites-752)). The moved checks were
already in the required gate, and splitting a journey does not make its
checks optional. They add two required results to each matrix.
A two-worker run on four pinned CPUs (`PDnriH`) took 20.9 s for the
settlement/rank journey, 96.9 s for recovery, 19.5 s for the touch journey
and 13.9 s for the Drill journey. Unchanged journeys ran about 1.2–1.3 times
as long on GitHub as in that run. At that rate, recovery (about 116–121 s of
125 s) is back to its green margin, which is still thin.

That margin was then restored by splitting the recovery journey itself
(#198). Its tablet Activity checks (`exerciseActivityWorkspace`) moved to
`workspaceRecoveryActivity`, a mandatory Workspace journey with a 90 s limit
like `workspaceActivity`. It starts where those checks started: on Upkeep,
with the Scouts already recovered. `initializeUpkeep` with `choices` and
`adjustedRecovery` seeds the facts that the recovery journey enters through
the page: attrition rolls of 10 and 3 (as total rolls), the recover decision
at the 20 gp rules cost, and the reasoned 5 gp Table Adjustment
(`upkeep-recovery:upkeep-scouts`). A Convex test checks that this seed leaves
no Upkeep requirement. The journey then checks that both devices show the
recovery at 15 gp. The Activity checks clear every choice they stage, so the
recovery journey's week is unchanged without them.

The recovery journey keeps its name, case and 125 s limit, and has
`test.step` timings. It still enters the recovery through the page, then
runs Guarantee Event's candidates on the empty Activity
(`exerciseGuaranteeEvent`), then Event, the settlement adjustment, the
Confirmation that closes the open picker, and the committed record: 35 gp,
the 20 gp recovery and the 5 gp adjustment. No assertion was dropped and no
limit was raised. Each matrix requires one more result: mandatory 23 and
nightly 41. In a two-worker run on four pinned CPUs (`b4drQo`), recovery took
63.4 s of 125 s (51 %) and the recovery Activity journey took 47.5 s of 90 s
(53 %). An earlier run with Guarantee Event still in the Activity part
(`G7ENbY`) took 53.3 s and 56.5 s (63 %).

### Provision and declare the cohorts

`worker-1` and `worker-2` exist in the dedicated development instance.
`e2e/resources.ci.json` declares all three cohorts; CI and local runs
deliberately share them. After this change merges, the owner renames the
provisioned local `e2e/.private/resources-3-cohorts.json` over
`e2e/.private/resources.json`. To recreate the cohorts, declare each one with
distinct `+clerk_test` emails and placeholder IDs, as in
`resources.example.json`. Then run `pnpm e2e:provision ... --bootstrap` from one
machine and copy any rewritten IDs into both declarations.

A local run and a CI run at the same time still share these Clerk users and
organizations, as before: they sign in the same identities concurrently and
share Clerk's rate limits. Their previews are separate. The CI concurrency group
serializes only CI runs.

### Fixture-call overhead

Every fixture operation (`fixtureCall` and `canonicalPersistenceFixtureCall` in
`support/process.ts`) spawns one Convex CLI process through `command()`. Each
spawn takes about 1.0–1.4 s, which is roughly 150 calls and 18 % of nightly
browser time. The canary adds no call because it runs inside the reset. A
persistent guarded client could save an estimated 100–130 s. Measure that before
replacing the spawns. Getting such a client the preview's admin credential
needs a separate design (#751): with only the preview creation key, the one
route is an undocumented Convex endpoint.

Each fixture write used to look up the Write Gate epoch with its own CLI call
first: in the two-worker run 5 of #729, 129 of 313 fixture calls were these
lookups (140 s of 508 s). Since #751 a worker reads the epoch once per session
(`fixture write epoch` appears once per worker in `timings.jsonl`) and passes
it with every fixture write; inspections carry none. Fixture writes never move
the epoch, and the server still rejects a stale one inside each write's
transaction (`convex/lib/writeGate.ts`). Only a write that the server rejects
makes the worker read the epoch again, never one ended by a timeout or signal:

- **Unchanged epoch.** The write's own failure stands.
- **Moved epoch, ordinary write.** The test fails with `E2E fixture write
epoch changed during the session (fixture resetCase: read 0, now 1); ...`,
  and every later fixture write in that worker fails the same way without
  running. Inspections still run.
- **Moved epoch, cleanup.** Cleanup is retried once with the new epoch, so no
  worker is left with its case, and the attempt still fails with the same
  message, ending "the case was cleaned up with the new epoch" or, if the
  retry failed too, that the cohort's next reset fails its isolation check.
  A worker's cleanup after its session saw the move uses the new epoch
  directly. Each worker finds the move on its own next write or cleanup.
- **Moved on purpose.** No journey moves the epoch today. One that does (for
  example by migrating the preview) must call `refreshWriteEpoch(run)`
  afterwards, which adopts the current epoch and clears a failed session.

Playwright replaces a worker after a failed test; the replacement reads the
epoch afresh. The failure has already made the run red.

The automatic `ownedCase` and `comparisonCase` fixtures return the campaign
their reset created. Journeys therefore no longer reset the same case a second
time: Workspace journeys open their Upkeep draft with `initialUpkeep`
(`support/upkeep-scenario.ts`), and contract setup reuses the comparison
campaign. That saves one call per journey, about 1.6 s each on the CI runner.
Resets later in a journey remain explicit `resetCase` calls.

Verified with live services on 2026-09-27: a three-worker (`JxnO44`) and a
serial (`xpy7vn`) nightly on the same fingerprint gave the same verdicts except
for a serial-only `canonical-cutover` race, since fixed (contract clients read
their token from a tab the journey never navigates). The canary never fired in
either run. Still to verify: a deliberate two-tests-on-one-cohort drill that
turns the canary red, and five consecutive parallel nightlies with no flakes.

### Narrow fixture retries (#754)

This host has no local DNS cache, so a fixture call could fail on glibc's 5 s
resolver timeout ("service connection failed"). The harness now retries only
what is provably safe; nothing is ever classified from the CLI's own fetch:

- **Reads after a transport failure.** The read set is the fixtures' declared
  queries: `e2eFixtures:inspectCase`, `e2eFixtures:inspectMoves` and the epoch
  read `initialMigration:clientStatus`. A read is retried when the CLI exited on
  its own with `service connection failed` or `service rate limit reached`
  among its fixed diagnostics, and none that means the call was refused
  (fixture authorization, identity ownership, schema or argument validation, a
  missing function, authentication or issuer, 401, 403).
  `canonicalPersistenceFixtures:inspect` is a mutation that only reads by
  convention, which Convex does not enforce, so it is not in the set.
- **Any call whose process never started.** A spawn the kernel refused with
  `EAGAIN`, `EMFILE` or `ENFILE`: nothing reached the CLI, let alone Convex. The
  harness's other failures before network I/O (an evidence write, the CLI
  package read, the stdin wrapper's exit 86) are not transient, so they are not
  retried.
- **Never a mutation that started.** The Write Gate epoch rejects stale writers
  but does not deduplicate, and `changeSource`, `blockSuccessor`,
  `resetAndInitialize`, `resetCase`, `initialize`, `initializeUpkeep`,
  `acceptedCampaign` and `appendHistory` are not safe to replay. Replaying a
  mutation would first need operation IDs and results stored in the same
  transaction, surviving resets.

At most two retries, after 0.5–1 s and then 1.5–3 s (uniform jitter), and only
when the wait ends before the browsers' stop point; SIGINT or SIGTERM ends the
wait and starts nothing more. A retried write sends the same `writeEpoch`, and a
server rejection takes the epoch path above. Each retry adds a line such as
`fixture inspectCase: retry 1 (read transport)` to `stages.log`.

**Cleanup's composed bound.** `retryCleanup` runs a case's cleanup at most three
times (write conflicts only), and `writeFixture` sends one more cleanup with the
new epoch after the server rejected a stale one, which ends the sequence. So at
most **4 `cleanupCase` executions** reach Convex, and with two spawn retries per
call at most **12 `cleanupCase` processes** start. `support/fixture-retries.test.ts`
drives that worst case, and committed-but-response-lost, duplicate delivery,
stale epochs and cancellation.

## WebKit Clerk redirect loop and fresh role sessions (#187, 2026-09-27)

After #187 the WebKit access journey failed in most nightlies: a reload hit
"Too many redirects" (`C4MBwN`, `IKQBdO`), or Back stayed on
`/campaigns/<id>` (`xsix69`, `JxnO44`, `xpy7vn`). The app was not the cause:
nothing on the campaign list pushes, replaces or redirects. A diagnostic run
(`Jj2TKl`) recorded the document requests:

1. Role storage is created at the start of the run, so its 60 s session token
   has expired when a test loads its first page. Clerk's development middleware
   then sends the document through its handshake on `*.clerk.accounts.dev` and
   back.
2. A document that arrived through that cross-site redirect is still treated as
   cross-site when it reloads: WebKit withholds Clerk's `SameSite=Strict`
   `__client_uat` cookie on every reload of it. Chromium sends it. The
   middleware sees `session-token-but-no-client-uat` and handshakes again. It
   stopped after three rounds in `Jj2TKl`, guarded by its 2-second
   `__clerk_redirect_count` cookie. The likely cause of "Too many redirects" is
   rounds slow enough for that counter to expire, so the loop never stops.
3. In WebKit, a reload that redirects through another origin also adds a
   history entry, so Back lands on the same address.

Production Safari is not affected in the same way: production Clerk has no
cross-site development handshake. Reordering reloads only changed which symptom
appeared, and a separate test would still start with the handshake.

The fix is in the harness (`support/session-token.ts`). Before a test creates
any page, each role context gets a session token minted through Clerk's Backend
API (`POST /v1/sessions/<sid>/tokens`) for the session already in its storage,
so the first page load needs no handshake. Guards:

- On every call the worker re-checks the Clerk part of the preflight
  (`validateClerkKeys`): trusted execution, an `sk_test_` secret key, a
  publishable key that encodes the declared development host (and an equal
  frontend key), and the production denylist. The inherited-selector check stays
  with the runner, which runs it before starting Playwright; the harness itself
  gives Playwright `CONVEX_OVERRIDE_ACCESS_TOKEN` and the server's
  `NEXT_PUBLIC_CONVEX_URL`. Once per worker it also confirms the development
  instance and the matching key pair (JWKS).
- The stored and the issued token must both come from the declared issuer,
  role user and session, the issued one must not have expired, and the cookies
  must belong to the browser host. Any mismatch fails the test before a page
  loads.
- Test workers use `CLERK_SECRET_KEY` only in memory, for this request, as the
  authentication setup already does. The key, tokens and cookie values never
  enter logs, annotations, errors or artifacts; errors name only the guard
  that failed.

It applies to every browser. The handshake belongs to Clerk's development
instance, not to the app, so skipping it in Chromium and Firefox hides no app
behaviour, and every project starts from the same session state. Later expiry
is refreshed by Clerk in the page, as before, and every reload assertion is
unchanged. With the change, the trial run `Fyy86A` passed 23/23, including
WebKit access, and the loop has not recurred since. Running to the end, the
WebKit access journey then took about 60 s against its 60 s limit (60 s in
`Fyy86A`, a timeout at 61.7 s in `rUyJDK` in its final week-host check); before
#187 added the campaign-home checks it took about 48 s.

### Campaign-home journey

The campaign-home checks (`support/campaign-home.ts`) moved out of `access` into
`campaign-home.spec.ts` ("members choose and edit their campaign home and
outsiders never see it"), which runs on every project that runs `access`. Its
case, `campaignHome`, is seeded exactly like `smoke` (same names, a rank-1
militia and one officer, alone in the cohort's member organization), so the
starting state and the measured text are unchanged. Every assertion moved
unchanged, and the GM, player and outsider are still three separate signed-in
sessions. `access` now opens the list with a plain page load before choosing
the week; its landing assertions belong to the new journey. No limit changed:
both journeys keep the 60 s test limit.

### Access split

The access journey still took 42–62 s against its 60 s limit, and under
machine load it timed out on WebKit and Firefox (`XxSqla`, `rUyJDK`, and
`qnkZrD` in its legacy week-link checks). It made about 25 page loads one after another, and
no app regression was found. The journey and its shell checks
(`support/shell-navigation.ts`) are now four parts. Each part runs as its own
test with its own case, on every project that runs `access`
(`accessJourneyFiles` in `support/matrix.ts`), including the mandatory
Chromium tablet run.

| Journey                                                                                                            | File                        | Case               | Checks                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| organization members can open their campaign and outsiders cannot                                                  | `access.spec.ts`            | `smoke`            | GM and player open the week from the list; the outsider is shut out of all five sections of the member campaign; the nightly extension and forced failure                                      |
| members move between campaign sections at every width and through browser history                                  | `campaign-sections.spec.ts` | `campaignSections` | Characters at phone, phone-landscape and short top-bar widths; Militia as a document; Back, Forward and reload                                                                                 |
| week links open their phase in a bounded week without moving other members, and unknown campaigns stay unavailable | `week-links.spec.ts`        | `weekLinks`        | `/campaigns/<id>/week?phase=` links (an unknown phase opens Upkeep), reload, home, Continue week, the bounded week host at two sizes; the GM stays on Event; an unknown id; `/` opens the list |

Every assertion moved unchanged; each part's phases are wrapped in `test.step`
only so the evidence times them. Each part starts where the single journey
reached it, and its state is equivalent:

- **Database.** Each case is seeded exactly like `smoke` by `resetCase`: the
  same names, a rank-1 militia with one officer and an open first-week draft.
  It is alone in the cohort's member organization, so the bare list still
  selects it. The moved checks only navigate and read; the nightly extension,
  which writes a character, stays in `access`.
- **Browser.** Each part's members open the week from the list with Continue
  week (`openWeekFromList`), as access always did. So each part starts on
  Week 1 · Event at the project viewport. Each part reads the campaign's
  address from that page, as the single journey did. The sections part
  started on exactly that page. The address and week-link parts began with a
  full page load, so the page they came from never mattered.
- **Sessions.** GM, player and outsider are still separate signed-in sessions.
  The outsider is still shut out of a real member campaign, the one the player
  has just opened.
- **Moved check.** "The GM stays on Event" was checked after all of the
  player's navigation. It now closes the week-link part, after the player
  follows the `?phase=` links, the only navigation that selects a phase. The
  sections and address parts still open GM and outsider sessions (the
  `players` fixture) but make no assertion with them.

Lost coverage: one player session no longer survives all four parts. Each
part repeats the list-to-week opening, which adds about two page loads. No
limit changed: every part keeps the 60 s test limit.

The legacy addresses were removed at the user's request on 2026-09-29: the
`/canonical-workspace`, `/canonical-setup`, `/canonical-history` and
`/campaigns/<id>/militia/correct` redirects, and their `legacy-addresses`
journey and `legacyAddresses` case. The week-link part (formerly
`legacy-week-links.spec.ts`, case `legacyWeekLinks`) became `week-links.spec.ts`
with the `weekLinks` case. It follows the current `/campaigns/<id>/week?phase=`
links instead of the old redirect, keeps every other check, and took over the
two current checks from the address part: an unknown campaign stays
unavailable, and `/` opens the campaign list. Nightly dropped from 42 required
results to 38 and the mandatory run from 21 to 20.

### Area completion checks

The area review of #140, #144, #146, #147 and #139 found browser layout gaps.
They are closed without raising a limit or adding a page load to a journey
near its limit:

- **Upkeep (#140).** `workspaceUpkeepLayout` (above) checks the settlement
  cards, missing-team row, disabled-team cards and rank feat cards at 390×844 and
  1440×900 (`support/upkeep-layout.ts`).
- **Persistent (#144).** `persistent-qa.ts` adds 844×390 and 1180×820 with the
  reference panel closed to its resize loop; no page load.
- **Event (#143) and Review & confirm (#145).** `workspaceEventReview` (above)
  checks both phases at phone landscape and on the narrow tablet, and checks
  Review's warnings and recorded outcomes in place. The phase-shaped loading
  skeletons are checked at component level only. The campaign shell waits for
  the same Convex connection before the week mounts, so holding every
  response shows the shell's skeleton, not the week's.
- **Finished weeks (#146).** The Confirmation contract's history step (300 s
  limit, about 121 s) appends history through the guarded `appendHistory`
  fixture and checks paging, gap-aware arrows, keyboard use and the three
  layouts (`support/finished-weeks.ts`); one reload.
- **Campaign home (#147).** `home` (60 s limit, 12–15 s) checks the home,
  editor and create form at three sizes and opens one extra page whose Convex
  responses are held to record the list skeleton
  (`support/campaign-home-layout.ts`).
- **Militia corrections (#139).** The sections part of access (60 s limit,
  16–19 s) opens Values and a three-item Items correction at 390×844 on the
  Militia page it already ends on; no page load (`support/militia-phone.ts`).

The final area review of #138, #141 and #142 found three more:

- **Setup (#138).** The Upkeep part's Setup layout loop (130 s limit, about
  71 s) adds 1440×900 and, at each size, reaches every enabled Setup control
  and **Next**; from 768px Next is in the sticky footer, which must be in view
  from the top of the page, and each focused control of the detail pane must
  sit above it. No page load. Headless browsers open no
  on-screen keyboard, so the keyboard-open layout is not covered.
- **Characters & officers (#141).** `ledger` (60 s limit, 15–18 s) opens
  Correct officers (the Assign picker and a holder's ⋯ menu) and Correct
  roster at 390×844 and 1440×900 and cancels both; no page load
  (`support/character-corrections-layout.ts`).
- **Activity (#142).** `workspaceActivity` (above,
  `support/activity-layout.ts`).

Screenshots from these checks are named by project where a journey runs on
several projects.

## Outsider stuck on "Loading campaign…" (#198, 2026-09-29)

`pfXKYi` failed the access journey on Chromium phone: the outsider never saw
"This campaign isn't available". It is the only occurrence of that error in
the slot-0 evidence (1 of 166 outsider steps; the other runs listed with it
failed for unrelated reasons). The step took 45.1 s against 4.7–9 s
everywhere else, and the outsider's screenshot shows the shell before sign-in
has loaded: no organization control, the account placeholder and the campaign
skeleton. The member and missing-user paths render later states, so a
missing outsider user row, an organization switch or an unresolved campaign
query could not have produced it.

- **Not reproduced by load.** Diagnostic runs `XCq6HZ` (kept contexts) and
  `zMmvUK` (a fresh outsider context per round) opened about 2,700 outsider
  pages on three projects in parallel: none stuck, none slower than 1.9 s.
- **Reproduced by one fault.** Holding Clerk's frontend script
  (`clerk.accounts.dev/npm/@clerk/clerk-js@…`) for 30 s and then failing it
  made `goto` take 30.0 s (the script delays the load event) and left the page
  on the same skeleton for good, identical to the `pfXKYi` screenshot
  (`k0vSoF`). Clerk's status is then `error` and its auth never loads. Failing
  or holding Clerk's `/v1/client` instead only delays the page: Clerk runs
  degraded and the unavailable state appears after about 9 s.

So the trigger was a stalled download of Clerk's script from its CDN, outside
the app. The product bug was that the app ignored Clerk's `error` status and
showed a loading skeleton forever; any user whose browser cannot fetch that
script sees the same. `useSession` now returns `unreachable` for it, and the
campaign shell and campaign list show "… could not be loaded. Check your
connection and try again." with a page reload as the retry. The journey's
assertions are unchanged: an outsider who cannot sign in has not been shown
the unavailable state, so the journey still fails, now with that message in
its observations (they include `role=alert` text).

## Settlement tap lost to the pan's momentum (#198, 2026-09-29)

GitHub run `36624233202` (4 CPUs, two workers) failed the first attempt of
`workspaceSettlementTouch`: after the finger pan, `tap()` on Misthome ran but
its `aria-pressed` stayed `false` for 15 s on both devices. The retry passed.

The pan's 20 unpaced touch moves end in a fling, and the helper waited only
until the week had started to scroll. Playwright's `tap()` waits for the card
to be stable across one animation frame, which a starved browser can report
while the fling is still gliding. Chromium, like a phone, treats a tap that
stops a fling as only stopping it: pointer and touch events arrive, but no
click, so nothing is chosen. That is platform behaviour, not a product bug:
a user's tap on a gliding page only stops it too.

A harness page with the real `ChoiceCards`, driven through the same mouse miss,
pan and tap on two pinned CPUs shared with six busy loops, showed it:

- **Before:** 9 of 120 taps chose nothing. In all 9 the week was still
  scrolling within 10 ms of the tap and its `scrollend` arrived after the tap,
  where the tap stopped it; that happened in only 2 of the 111 passing taps.
  Raw CDP taps 0–100 ms after the pan clicked 0 of 24 times; at 200 ms or
  later, 18 of 18.
- **After:** the helper watches for `scrollend` from before the pan
  (`watchScrollEnd`) and taps once the scroll has come to rest. 0 of 120 taps
  failed, and no scroll ended after a tap.

The pan-scrolled, no-choice and both-device tap assertions are unchanged.

Review follow-up: the first version resolved on the first `scrollend` anywhere
in the document, and sampling a scroller for rest cannot prove no momentum is
still to come. The glide is now removed at its source. The pan's finger holds
still at its final point for 150 ms (three more `touchMove`s, 50 ms apart)
before it lifts, so it lifts with no velocity. The distance and direction are
unchanged. On the harness page, an unpaced pan glided about 54 px for about
200 ms after the lift (`scrollend` about 220 ms after it). A held pan did not
move after the lift, and its `scrollend` came about 10 ms later.

`watchScroll` is bound to the card's scrolling ancestor, the same element the
pan-scrolled check measures (the document for the page's own scroller). It
counts only that element's own `scroll` and `scrollend` events. `armed(5 s)`
waits until the element has been quiet for 100 ms (no `scroll` event, no
change of `scrollTop`). `rested(10 s)` then needs the element to have left the
armed position, its own `scrollend` since its last movement, and 100 ms of
quiet again. Movement after a `scrollend` needs a new one. Each wait has its
own bound on a timer, not on animation frames, and resolves false when that
bound expires. A poll that runs late past the deadline cannot succeed.

A harness page with the real `ChoiceCards` in a bounded scroller ran on two
pinned CPUs shared with six busy loops:

- A tap straight after the lift: without the hold, 24 of 60 taps chose
  nothing; with the hold, 0 of 120.
- The full helper, with its pan, waits and both taps: 0 of 120 lost. The
  pre-#198 helper also lost 0 of 120 on this page, because its assertions
  outlast the page's short glide. So the straight-after-lift taps are the
  sensitive measure.
