# EverythingPath

EverythingPath is a multiplayer Pathfinder militia operations app for the Ironfang militia subsystem.

It is built to let a table run militia play week-by-week with shared realtime state, card-based action selection, and role-aware collaboration.

## Product Goal

The app supports militia management during live play by guiding users through the weekly sequence:

1. Upkeep
2. Activity
3. Event

It is designed for groups already in-progress as well as fresh starts, including mid-campaign state onboarding.

## Core Experience

- Realtime multiplayer updates
- Multi-device tabletop use (tablet landscape first)
- Card UI for team/action choices (hover, drag, slot, stage, confirm)
- Shared visibility of staged and confirmed changes
- GM moderation controls for adjudication and correction

## Rules Model

Militia rules are implemented from the Ironfang rules corpus in `docs/ai/ironfang-militia/`.

The system is rules-aware but not rules-blocking:

- Structural invalid input is blocked
- Rule mismatches are surfaced as warnings
- Homebrew and table-approved overrides are supported

Form validation is implemented with `react-hook-form` + `zod` for clear field-level errors and consistent payload validation before server mutations.

## Current Data Model Highlights

- Campaign, militia, character, and team ownership tables
- Officer assignments on militia records
- Weekly phase/state tracking tables
- Team condition state tables (`active`, `disabled`, `missing`, `blocked`)
- Event and persistent-event state tracking
- Override notes for intentional rule deviations

## Tech Stack

- Next.js (App Router)
- React + TypeScript
- Convex (database + realtime backend)
- Clerk (auth/org context)
- TanStack Query
- React Hook Form + Zod (form validation)

## Development

Numbered Catalog Releases are described in [the release runbook](docs/catalog-import/releases.md). Their parsers fingerprint includes `src/lib/character-sheet.ts` because its shared schemas validate imported definitions; edits require a new release number even when normalized output remains unchanged.

The production-browser harness and its explicit non-production setup are
documented in [e2e/README.md](e2e/README.md). Use `pnpm test:e2e:local` for
disposable local databases and the dedicated Clerk development fixtures.

Requirements:

- Node.js 22 and pnpm
- Docker with a running daemon
- Clerk development keys in `.env` or `.env.local`:
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...` and `CLERK_SECRET_KEY=sk_test_...`

Install dependencies and start the Next.js app and Convex development process:

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts a pinned Convex Docker backend, deploys the functions, copies
your Clerk development users and organization memberships into it, then watches
Convex and runs Next.js. The backend binds only to IPv4 loopback on free ports;
the launcher supplies its URL to Next.js. Clerk sign-in still needs the network
and the application's `convex` JWT template. No Convex Cloud login is needed.

Press Ctrl+C to stop the services. The launcher waits until every Next.js and
Convex process (each service's whole process group) has exited, then stops the
container. The checkout's named Docker volume retains its database. Different
checkouts get different development databases. Local configuration and
credentials live in ignored `.local-convex/`; the launcher preserves `.env` and
`.env.local` and never deploys to Cloud.

If a start fails after the container started, the launcher stops it again; if
it created the container in that attempt, it removes the container (never its
`ep-dev-<id>-data` volume), so the next start picks new free ports. A failure
with an existing container prints its name and the recovery step. To recover by
hand, remove only the container and rerun `pnpm dev`; the database stays in its
volume:

```bash
docker ps -a --filter label=dev.everythingpath.local-convex
docker rm ep-dev-<id>   # never `docker volume rm` or `docker rm -v`
pnpm dev
```

Use this when the container's port is taken by another service, its image is
no longer the pinned one, or its ports are not bound to `127.0.0.1`. A container
with the same name that this checkout did not create is never touched: inspect
it with `docker inspect ep-dev-<id>` and remove or rename it yourself.

`pnpm dev:local:setup` deploys and syncs identities without starting Next.js,
leaving the backend running. `pnpm dev:local:sync` also refreshes identities
after changes in Clerk; local development does not receive Clerk's hosted
webhooks. Each sync compares Clerk with the accounts and memberships the local
database holds (`user:listIdentityProjection`, an internal query), so a
membership or account Clerk no longer has is removed even after an earlier
sync failed part-way. Application data starts empty: create a campaign in the UI.
Catalog Releases and other application data are not copied automatically.
Importing an old database also imports its authorization state, so it requires
a separate migration that reconciles those identities against Clerk.

To use Cloud development explicitly, run `pnpm dev:cloud`. The individual
`pnpm dev:convex` and `pnpm dev:web` commands retain their Cloud configuration.

The release operator's `--target-kind local` accepts this development backend
(`ep-dev-...`) as well as E2E instances, as `development` does on Cloud:
`catalog:release activate --fixture-only` against it changes the active
release in your development database.

The character-builder merge gate also uses local Convex: code generation
deploys to a disposable Docker backend and removes its container, volume, and
credentials afterwards. It needs no Convex Cloud or Clerk credentials. It
pushes to an empty database, so it does not check a schema change against
existing documents; a real deploy remains that check. A failure names its
phase (Docker backend, local deployment setup, or `convex dev --once`) and
prints the last lines of the Convex CLI's output with keys and secrets
redacted. Its E2E preflight uses local mode: it checks that the Docker daemon
answers and the pinned backend image is present (pulling it if not), starts no
container, and still verifies the declared Clerk test resources.

`dev:convex` ignores deploy keys and deployment tokens so credentials saved for
preview or production builds do not override your local `CONVEX_DEPLOYMENT`.
Cloud development uses your Convex CLI login; run `pnpm exec convex login` if needed.

`pnpm check` runs TypeScript and lint checks. `pnpm lint` runs ESLint (unused
local variables are errors) and [Knip](https://knip.dev), which fails on unused
files, exports, types, and dependencies. ESLint also enforces React's Rules
of Hooks, exhaustive hook dependencies, and `set-state-in-effect` as errors
throughout `src`, including its tests. Run `pnpm lint:unused` for Knip alone.
Knip includes tests and recognizes Next.js and Convex entry points. Playwright
entry points are declared in `knip.jsonc` because loading its config requires
a provisioned E2E run; keep those entries aligned with the runner. Test-only
exports still count as used, so periodically review whether tests exercise
interfaces that gameplay actually uses.

`pnpm install` applies the patch in `patches/` to `@convex-dev/react-query@0.1.0`.
It lets a successful live update recover a query that failed before receiving
its first result. Keep the patch until an upstream release passes the recovery
tests in `src/lib/convex-query-client.test.tsx` without it.

## Build and deployment

`pnpm build` and `pnpm build:web` build only the Next.js application. They use
the generated Convex files committed under `convex/_generated` and do not
select or update a Convex deployment.

Hosting uses `pnpm deploy:convex`, which explicitly deploys the Convex backend,
injects that deployment's URL into `pnpm build:web`, and then verifies that
deployment-time generation did not change the committed generated files. When
backend edits regenerate `convex/_generated`, include those reviewable changes
in the same commit.

With a Convex preview deploy key, rehearse the same path against a disposable
preview by running:

```bash
pnpm deploy:convex -- --preview-create e2e-build-boundary
```

For a build-only check, the safe public configuration is:

```bash
NEXT_PUBLIC_CONVEX_URL=https://e2e-build-placeholder.convex.cloud pnpm build
```

No Convex login, deploy key, or `.env.local` is needed. This placeholder is for
compilation only; running the app requires your actual Convex and Clerk public
configuration. The build needs no network access: the app's fonts are
self-hosted under `src/app/fonts`.

`pnpm dev` keeps running `convex dev` alongside Next.js, so backend edits refresh
the generated files. Commit the resulting runtime utilities, declarations, and
AI guidance as generated output; do not edit bindings by hand. Use the lockfile's
Convex version (`pnpm install --frozen-lockfile`) when refreshing them.

Netlify runs the explicit deployment command in `netlify.toml`. Configure its
`CONVEX_DEPLOY_KEY` for the intended deployment, using a Preview Deploy Key for
preview contexts. The CLI supplies `NEXT_PUBLIC_CONVEX_URL` to the frontend build;
do not wrap this command in another backend deployment or code-generation step.
See the [Convex deployment documentation](https://docs.convex.dev/cli/reference/deploy).

The **Disposable preview rehearsal** GitHub workflow is manually triggered on
the branch to verify. Configure the `convex-preview` environment with the secret
`CONVEX_PREVIEW_DEPLOY_KEY` and, for a usable frontend, the variable
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. Configure the preview defaults in Convex with
`CLERK_FRONTEND_API_URL`, which the backend auth configuration requires. Each run
uses a unique preview name, invokes deployment once, builds with that preview's
URL, and fails on generated-code drift after deployment. Review the CLI log for
the matching build/deployment URL and delete the disposable preview in the Convex
dashboard after verification. A failed drift check does not roll back deployment.
