import { writeFile } from 'node:fs/promises';
import { frontendBuildIdentity } from '../src/lib/client-compatibility.ts';

// #413 F6c: the identity the published site serves for the operator's
// activate and reopen checks; `dev` outside a Netlify build.
await writeFile(
  new URL('../public/build-identity.json', import.meta.url),
  `${JSON.stringify(frontendBuildIdentity(process.env.COMMIT_REF))}\n`,
);
