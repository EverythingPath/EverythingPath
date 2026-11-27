import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { reviewedAdmissionSchema } from '../../src/lib/catalog/admission-schema';
import { decodeAttributionEvidence } from '../../src/lib/catalog/attribution-evidence-codec';
import { buildLegalPageData } from '../../src/lib/catalog/legal-page-data';
import { legalResourcesSchema } from '../../src/lib/catalog/legal-types';
import {
  siteNoticesSchema,
  withSiteLegal,
} from '../../src/lib/legal/site-legal';

// Playwright's loader cannot import JSON modules, so the legal page's
// committed inputs (`src/lib/catalog/reviewed-data.ts`, the loader's
// fallback while no Catalog Release is active) are read from the same files,
// and the site layer's committed notices (`src/lib/legal/site-legal-data.ts`)
// likewise.
const dataDirectory = join(process.cwd(), 'src', 'lib', 'catalog', 'data');
function readData(file: string): unknown {
  return JSON.parse(readFileSync(join(dataDirectory, file), 'utf8'));
}

// Every book a reviewed condition cites needs its Section 15 notice.
const reviewedConditionsSchema = z.array(
  z.object({
    sources: z.array(z.object({ book: z.string().min(1) })),
  }),
);

/** What the public legal page shows with no active Catalog Release. */
export function loadCommittedLegalPageData() {
  const { registry } = reviewedAdmissionSchema.parse({
    assessments: readData('attribution-assessments.json'),
    evidence: decodeAttributionEvidence(readData('attribution-evidence.json')),
    registry: readData('section15-registry.json'),
  });
  const resources = legalResourcesSchema.parse(readData('resources.json'));
  const conditions = reviewedConditionsSchema.parse(
    readData('reviewed-conditions.json'),
  );
  const page = buildLegalPageData({
    registry,
    resources,
    permanentNoticeSuperset: resources.permanentNoticeSuperset,
    requiredNotices: [
      ...new Set(
        conditions.flatMap((condition) =>
          condition.sources.map((source) => source.book),
        ),
      ),
    ],
  });
  return withSiteLegal(page, {
    paizo: resources.paizo,
    siteNotices: siteNoticesSchema.parse(
      JSON.parse(
        readFileSync(
          join(process.cwd(), 'src', 'lib', 'legal', 'site-notices.json'),
          'utf8',
        ),
      ),
    ),
  });
}
