import { resolve } from 'node:path';
import { buildLaunchInventory } from './catalog/launch-inventory-build.ts';
import {
  launchInventoryPaths,
  verifyLaunchInventoryPins,
} from './catalog/launch-inventory-pins.ts';
import {
  checkLaunchLegalAuthority,
  writeLaunchLegalAuthority,
} from './catalog/launch-legal-authority.ts';

// The launch legal authority from a fresh pinned build: the notice authority,
// its hash and the Section 15 Registry binding (launch-legal-authority.ts).
// --write regenerates them when stale; --check is read-only.
const [mode, ...rest] = process.argv.slice(2);
if ((mode !== '--write' && mode !== '--check') || rest.length)
  throw new Error(
    'Usage: catalog:launch-legal-authority --write | read-only --check.',
  );
const paths = launchInventoryPaths();
await verifyLaunchInventoryPins(paths);
const repoRoot = resolve('.');
const inventory = await buildLaunchInventory({ paths, repoRoot });
if (mode === '--check') await checkLaunchLegalAuthority({ inventory, repoRoot });
else {
  const stale = await writeLaunchLegalAuthority({ inventory, repoRoot });
  process.stdout.write(
    stale.length
      ? `Regenerated (${stale.join('; ')}); now run pnpm -s catalog:launch-inventory --write.\n`
      : 'The launch legal authority is current; nothing written.\n',
  );
}
