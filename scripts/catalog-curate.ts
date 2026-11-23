import { runCatalogCuration } from './catalog/curate.ts';

const { status, stdout, stderr } = await runCatalogCuration({
  args: process.argv.slice(2),
});
process.stdout.write(stdout);
process.stderr.write(stderr);
process.exitCode = status;
