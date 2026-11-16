import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { section15Registry } from '../src/lib/catalog/section15-registry-data.ts';
import heldNotices from './catalog/legal/held-notices.json';
import {
  checkNoticeDependencies,
  noticeDependencyWaiversPath,
  readNoticeDependencyInputs,
} from './catalog/notice-dependencies.ts';
import { reviewedCuration } from './catalog/reviewed-curation-data.ts';

async function main() {
  const { values } = parseArgs({
    options: {
      help: { type: 'boolean' },
    },
    strict: true,
    allowPositionals: false,
  });
  if (values.help) {
    process.stdout.write(
      `Usage: pnpm catalog:notice-deps\nChecks that every inherited-rule notice dependency a batch inventory in scripts/catalog/legal records for a curated candidate (inherited-rule fields with their books, notice holds) is in that candidate's requiredNotices as a reviewed or held notice. Fails on any other gap unless ${noticeDependencyWaiversPath} waives it, and on a waiver that matches no gap. Reviewed terms in description text and linkedContentReview records whose books are not required print warnings only.\n`,
    );
    return;
  }
  const root = fileURLToPath(new URL('../', import.meta.url));
  const report = checkNoticeDependencies({
    ...(await readNoticeDependencyInputs(root)),
    heldNotices,
    registry: section15Registry,
    descriptions: reviewedCuration.records,
  });
  for (const advisory of report.advisories)
    process.stdout.write(
      `warning: ${advisory.inventory} ${advisory.key} (${advisory.name}) ${
        advisory.kind === 'term'
          ? `mentions ${advisory.term} without ${advisory.notice} [${advisory.finding}]`
          : `links ${advisory.linked} without ${[advisory.notice, ...advisory.alternatives].join(' or ')} [linkedContentReview; prerequisites need no notice]`
      }\n`,
    );
  const { checked } = report;
  process.stdout.write(
    `Checked ${checked.dependencies} recorded notice dependencies on ${checked.candidates} curated candidates in ${checked.inventories} inventories: ${report.gaps.length} gaps, ${report.waived.length} waived, ${report.stale.length} stale; ${report.advisories.length} advisory warnings.\n`,
  );
  for (const gap of report.gaps)
    process.stderr.write(
      `${gap.inventory} ${gap.key} (${gap.name}): ${gap.kind === 'missing' ? `requiredNotices lacks ${[gap.notice, ...gap.alternatives].join(' or ')}` : `required notice ${gap.notice} is neither reviewed nor held`}; recorded by ${gap.recordedBy.join('; ')}\n`,
    );
  for (const entry of report.stale)
    process.stderr.write(
      `Stale waiver ${entry.key} ${entry.notice}: no matching gap; remove it.\n`,
    );
  if (!report.passed) process.exitCode = 1;
}
main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
