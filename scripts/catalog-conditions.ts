import { readFile } from 'node:fs/promises';
import { buildConditionCatalogArtifact } from './catalog/conditions.ts';
import { assessCatalogAdmission } from './catalog/admission.ts';
import { readCommittedRegisterAdmission } from './catalog/register-admission.ts';
import { legalResourcesSchema } from '../src/lib/catalog/legal-types.ts';
import { buildLegalPageData } from '../src/lib/catalog/legal-page-data.ts';
import { conditionDefinitions } from '../src/lib/character-sheet-conditions.ts';

async function readCatalogData(name: string): Promise<unknown> {
  return JSON.parse(
    await readFile(
      new URL(`../src/lib/catalog/data/${name}.json`, import.meta.url),
      'utf8',
    ),
  );
}

// The gate reads the notice register only (per-book licensing).
const reviewedAdmission = await readCommittedRegisterAdmission();
const legalResources = legalResourcesSchema.parse(
  await readCatalogData('resources'),
);

const artifact = await buildConditionCatalogArtifact();
const admission = assessCatalogAdmission({ artifact, ...reviewedAdmission });
const legal = buildLegalPageData({
  registry: reviewedAdmission.registry,
  resources: legalResources,
  requiredNotices: admission.requiredNotices,
  permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
});
process.stdout.write(
  JSON.stringify(
    {
      purpose: 'condition-admission',
      localResources: artifact.catalog.localResources,
      inventory: artifact.catalog.entries.length,
      admission,
      outstandingNotices: legal.outstandingNotices,
      quantities: conditionDefinitions.map((definition) => ({
        key: definition.key,
        unmodeled: definition.unmodeled,
      })),
    },
    null,
    2,
  ) + '\n',
);
if (
  !admission.passed ||
  admission.held.length ||
  legal.outstandingNotices.length
)
  process.exitCode = 1;
