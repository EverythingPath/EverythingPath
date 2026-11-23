import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pcgenPin } from '../inventory.ts';
import { launchInventoryPaths } from '../launch-inventory-pins.ts';
import {
  verifiedPinnedCatalogCheckouts,
  type PinnedCatalogCheckouts,
} from '../pinned-import.ts';

/**
 * The pinned Foundry, content and PCGen checkouts beside this repository,
 * verified at their pins as `catalog:preview --pcgen` verifies them: what
 * `catalog:party-scope` imports the whole catalog from (`pinned-import.ts`).
 */
export async function pinnedCatalogCheckouts(): Promise<PinnedCatalogCheckouts> {
  const paths = launchInventoryPaths();
  return verifiedPinnedCatalogCheckouts({
    system: await realpath(paths.pf1),
    content: await realpath(paths['pf1-content']),
    pcgen: await realpath(
      resolve(paths.pcgen, ...pcgenPin.directory.split('/').map(() => '..')),
    ),
  });
}
