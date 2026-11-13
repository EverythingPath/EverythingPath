import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pcgenPin, pins } from './inventory.ts';
import type { LaunchSourcePaths } from './launch-inventory-sources.ts';
import { verifyPrdCapture } from './prd-pin.ts';

/** The pinned checkouts a launch inventory build reads, beside this repository. */
export function launchInventoryPaths(): LaunchSourcePaths {
  const parent = join(homedir(), 'repos/everythingpath');
  return {
    pf1: join(parent, 'sources/foundryvtt-pathfinder1'),
    'pf1-content': join(parent, 'sources/pf1-content'),
    pcgen: join(
      parent,
      `.ep-cache/pcgen-${pcgenPin.commit.slice(0, 8)}`,
      pcgenPin.directory,
    ),
    prd: join(parent, 'sources/prd-2026-10-20'),
  };
}

const checkoutHead = (path: string) =>
  execFileSync('git', ['-C', path, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();

/** Refuses a build from any checkout other than its pin. */
export async function verifyLaunchInventoryPins(paths: LaunchSourcePaths) {
  for (const repo of ['pf1', 'pf1-content'] as const)
    if (checkoutHead(paths[repo]) !== pins[repo].commit)
      throw new Error(`Wrong pinned ${repo} checkout.`);
  if (checkoutHead(paths.pcgen) !== pcgenPin.commit)
    throw new Error('Wrong pinned PCGen checkout.');
  await verifyPrdCapture(paths.prd);
}
