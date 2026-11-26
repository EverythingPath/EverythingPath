import { readFile, writeFile } from 'node:fs/promises';
import {
  serializeLaunchVerification,
  type LaunchVerification,
} from './launch-verification.ts';

/**
 * `catalog:launch-inventory --verify --check | --write`: the command's verify
 * mode, which the script runs with the real build
 * (`buildLaunchVerification`) and the committed projection's path. It writes
 * the projection or compares it with the committed copy, then prints its
 * summary.
 */
export async function runLaunchVerification({
  write,
  build,
  projection,
  print = (text) => process.stdout.write(text),
}: {
  write: boolean;
  build: () => Promise<LaunchVerification>;
  projection: string;
  print?: (text: string) => void;
}) {
  const document = await build();
  const bytes = serializeLaunchVerification(document);
  if (write) await writeFile(projection, bytes);
  else if (bytes !== (await readFile(projection, 'utf8').catch(() => '')))
    throw new Error(
      'The verification projection is stale: run pnpm -s catalog:launch-inventory --verify --write.',
    );
  const met = document.rows.filter(({ verified }) => verified.length === 4);
  print(
    `${JSON.stringify({ version: document.scopeVersion, identity: document.binding.launchScopeIdentity, projectedRows: document.rows.length, allObservationsVerified: met.length, inputs: Object.keys(document.binding.inputs).length, bytes: Buffer.byteLength(bytes) }, null, 2)}\n`,
  );
}
