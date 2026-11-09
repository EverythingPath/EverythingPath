import { runCatalogPreviewCommand } from './catalog/preview.ts';

const { status, stdout, stderr } = await runCatalogPreviewCommand({
  args: process.argv.slice(2),
});
process.stdout.write(stdout);
process.stderr.write(stderr);
process.exitCode = status;
