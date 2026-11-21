import { readFile } from 'node:fs/promises';
import { buildConditionCatalogArtifact } from './catalog/conditions.ts';
import { assessCatalogAdmission } from './catalog/admission.ts';
import { reviewedAdmissionSchema } from '../src/lib/catalog/admission-schema.ts';
import { decodeAttributionEvidence } from '../src/lib/catalog/attribution-evidence-codec.ts';
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

// Read the complete catalog without compiling its large evidence JSON into
// JavaScript alongside the test runner. Keep the ordinary schema validation.
const reviewedAdmission = reviewedAdmissionSchema.parse({
  assessments: await readCatalogData('attribution-assessments'),
  evidence: decodeAttributionEvidence(
    await readCatalogData('attribution-evidence'),
  ),
  registry: await readCatalogData('section15-registry'),
});
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
