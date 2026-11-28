// `pnpm catalog:digest --write | --check`: the committed catalog digests
// (tests/catalog/catalog-digest.ts).
import { runCatalogDigest } from '../tests/catalog/catalog-digest.ts';

process.exitCode = await runCatalogDigest(process.argv.slice(2));
