import { runCatalogReleaseOperator } from './catalog/release-operator.ts';
import { canonicalReleaseJson } from '../src/lib/catalog/release-schema.ts';

runCatalogReleaseOperator({ args: process.argv.slice(2) })
  .then((result) => {
    process.stdout.write(canonicalReleaseJson(result) + '\n');
  })
  .catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
