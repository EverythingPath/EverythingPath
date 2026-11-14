# Trying the builder with the party's content (`pnpm dev:trial`)

`pnpm dev:trial` runs the character builder in your browser, on your own
machine, with the party's content. It is a trial: what you create in it stays
on its own local instance, and one command removes it again.

## What you get

- The web app against a local Convex backend of its own, under Character Sheet
  authority, with the party's Catalog Release active. You sign in with your
  Clerk development accounts, create a campaign and build characters.
- A list of the party's characters, by number: which are complete and, for
  each partial one, how many of its entries are missing and why (held for
  review, left out with what they need, not matched to the catalog, and so
  on). The command prints it after the build and keeps it in
  `.local-convex/owner-trial/characters.txt`; read it there. It changes with
  each content landing, so this guide does not repeat it.

## Before you start

The command checks each of these and stops with a message when one is missing.

- **Docker**, with the daemon running. The command pulls the pinned Convex
  backend image from ghcr.io only if your machine does not have it yet;
  ordinary `pnpm dev` uses the same image, so you may have it already.
  Missing Docker prints `Local development failed:
  Docker is not reachable; start the Docker daemon and retry`; an image it
  cannot pull prints `Local development failed: The pinned local Convex
  backend image is missing and could not be pulled; check Docker and network
  access to ghcr.io`.
- **Clerk development keys**, the same ones `pnpm dev` uses:
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_…` and `CLERK_SECRET_KEY=sk_test_…`
  in `.env` or `.env.local` (see the [README](../README.md)). Missing or
  non-development keys print `Local development failed. Check Docker, Clerk
  development keys, and the local backend.`; keys from two different
  applications print `… Clerk secret and publishable keys belong to different
  applications`. Sign-in also needs the network.
- **The pinned source checkouts**, beside this repository under
  `~/repos/everythingpath/`, each clean and at the commit pinned in
  `scripts/catalog/inventory.ts` (`pins`, `pcgenPin`):
  - `sources/foundryvtt-pathfinder1` (the pf1 system, tag `v11.11`);
  - `sources/pf1-content` (tag `11.4.0`);
  - `.ep-cache/pcgen-<first 8 characters of the PCGen commit>` (a PCGen
    checkout).

  These are read only at the build stage, after the backend has started. A
  missing, moved or changed checkout prints `The party build wrote no artifact
  (exit 1); see …/build.log.`, and `build.log` names the checkout (for example
  `pf1 checkout must be at pinned v11.11 (…)` or `PCGen checkout … is not at
  …`).
- `pnpm install` done, as for `pnpm dev`.

## Run it

```bash
pnpm dev:trial
```

It prints, in order:

1. `Target: local owner-trial Convex (ep-dev-…); persistent Docker data.` It
   starts the trial's own backend container, then deploys the functions
   (Convex's own output follows).
2. `Building the party release (this takes a while); output in …/build.log.`
   It builds the party's Catalog Release from the pinned checkouts; the
   build's output goes to `build.log`, not the terminal. **How long this takes
   on your machine, and how much memory it uses there, has not been measured
   yet.** Then `Party scope FAILED; the trial uses the artifact it wrote.` (or
   `QUALIFIED`) and one line per character (`Character <n>: complete` or
   `Character <n>: partial (…)`). FAILED is expected while some characters
   are partial; the trial goes on with what was built.
3. Lines such as `start: …`, `backfill: …`, `activate: …`, `publish: …`,
   `smoke: …` and `reopen: …`. It prepares the release on the trial backend,
   then moves the empty instance to Character Sheet authority with that
   release active, checks it and reopens it for editing.
4. `Local Convex ready at http://127.0.0.1:…; synchronized N development
   identities.` It copies your Clerk development users into the trial
   backend, then starts the web app; Next.js prints its `Local:` address.

Ctrl+C stops it (`Stopping the owner trial, please wait.`). The container
stops; its data stays for the next run.

**A rerun resumes.** It reuses a release it already built, and picks up the
move to sheet authority where it stopped, unless a step ends with `Start
again with pnpm dev:trial --discard, then pnpm dev:trial.` (a failed smoke
check, for example): then do exactly that. Once the instance is open it
builds nothing, even when the code has changed: it prints `The trial instance
is already open under sheet authority.` with the character list, and serves
the app. After pulling new code, see [Refresh after pulling new code or
content](#refresh-after-pulling-new-code-or-content).

## Sign in and build a character

1. Open the `Local:` address Next.js printed.
2. Sign in with a user of your Clerk development application.
3. On **Campaigns**, choose **New campaign** and name it.
4. Open the campaign's **Characters** page and choose **New character**.

## Refresh after pulling new code or content

**After pulling new code, discard the trial and run it again.** An open trial
keeps serving the release it was built with and does not notice that the code
moved: a rerun deploys the new functions but keeps the old release. The same
goes for newer content. Starting over also removes what you created in the
trial:

```bash
pnpm dev:trial --discard
pnpm dev:trial
```

Do not wait for a warning. The message `… built for another calculation.
Start again with pnpm dev:trial --discard, then pnpm dev:trial.` appears only
while the command prepares the release. A trial that is already open skips
that preparation, so it checks nothing and keeps serving the release it was
built with. A run that was interrupted part-way may instead stop at its smoke
check with `The smoke check failed; the trial instance stays closed.` and the
same instruction to discard and start again. **Either way: after pulling new
code, discard the trial and run it again.**

## Undo

`pnpm dev:trial --discard` removes exactly three things, and prints `Discarded
the trial instance ep-dev-…, its data and ….`:

- the trial's container, only if it carries this checkout's trial label;
- its Docker volume `ep-dev-…-data`, the trial's database with every campaign
  and character you created there;
- its directory `.local-convex/owner-trial/` (the built release, reports,
  `build.log`, `characters.txt` and the trial backend's credentials).

Stop a running trial with Ctrl+C first. It leaves the pulled Docker image,
your Clerk users and `public/build-identity.json` (ignored by git; ordinary
builds write it too). A container with the trial's name that this checkout did
not create is left alone, with a message naming `docker inspect`.

## What it never touches

- **Your ordinary `pnpm dev` instance and its data.** The trial has its own
  container name, volume and directory, derived from the checkout path plus
  `#owner-trial`, and refuses to run if they would be `pnpm dev`'s. Moving to
  sheet authority has no way back, which is why it never happens there.
- **Anything that is not local.** The command takes no deployment flags (any
  flag but `--discard` is refused), blanks every `CONVEX_*` variable from your
  shell and `.env` files, targets only the backend it started itself, and runs
  every release and migration step as a local target, never production. Each
  of those steps still runs its own checks (loopback address, instance name,
  key).
- **Your `.env` files** are read, never written. **Clerk** is only read.

Tests: `tests/local-convex-owner-trial.test.ts` and
`tests/initial-migration-local-trial.test.ts`.

## Not tried yet

No one has run the command end to end with real Docker, and no one has signed
in to a trial instance under sheet authority. Your first run is also the test.
If it stops, send back the terminal output and these files from
`.local-convex/owner-trial/`: `build.log`, `characters.txt`,
`trial-release.json` and `release/release-1.scope.json`. Keep the others to
yourself: `settings.env`, `backend.env`, `convex.env` and `local-admin.key`
hold credentials.
