import { z } from 'zod';

/**
 * The contract a browser bundle was compiled with (#413 F6c; root decision 3).
 * `initialMigration:clientStatus` gives a tab `ready` under sheet authority
 * only when it sends the contract the deployed backend was compiled with, so
 * a bundle from before F6c (it sends none) or from a later, incompatible
 * contract reloads. Raise it whenever the browser's writes or reads change in a
 * way an older bundle would get wrong; a frontend change that keeps it does
 * not lock tabs out.
 */
export const SHEET_CLIENT_CONTRACT = 1;

/**
 * The frontend build identity `pnpm build:web` writes to
 * `public/build-identity.json`: the commit Netlify builds (`COMMIT_REF`), else
 * `DEVELOPMENT_FRONTEND_BUILD`. `initialMigration:start` records it as the
 * run's `frontendBuild`; `activate` and `reopen` compare it with the one the
 * operator reads from the published site.
 */
export const DEVELOPMENT_FRONTEND_BUILD = 'dev';
export const frontendBuildIdentitySchema = z.strictObject({
  frontendBuild: z.union([
    z.literal(DEVELOPMENT_FRONTEND_BUILD),
    z.string().regex(/^[0-9a-f]{40}$/),
  ]),
});
export type FrontendBuildIdentity = z.infer<typeof frontendBuildIdentitySchema>;

/** The identity of a build from `commitRef` (Netlify's `COMMIT_REF`). */
export function frontendBuildIdentity(
  commitRef: string | undefined,
): FrontendBuildIdentity {
  return frontendBuildIdentitySchema.parse({
    // An empty `COMMIT_REF` is no commit.
    frontendBuild: commitRef?.trim()
      ? commitRef.trim()
      : DEVELOPMENT_FRONTEND_BUILD,
  });
}
