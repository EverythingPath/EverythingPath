import { readFile } from 'node:fs/promises';
import {
  parseAttributionEvidenceText,
  reviewedAdmissionFilesSchema,
} from '../../src/lib/catalog/attribution-evidence-codec.ts';

function readCommitted(name: string) {
  return readFile(
    new URL(`../../src/lib/catalog/data/${name}.json`, import.meta.url),
    'utf8',
  );
}

async function readCommittedJson(name: string): Promise<unknown> {
  return JSON.parse(await readCommitted(name));
}

async function readReviewedAdmission() {
  return reviewedAdmissionFilesSchema.parse({
    assessments: await readCommittedJson('attribution-assessments'),
    evidence: parseAttributionEvidenceText(
      await readCommitted('attribution-evidence'),
    ),
    registry: await readCommittedJson('section15-registry'),
  });
}

let committed: ReturnType<typeof readReviewedAdmission> | undefined;

/**
 * The committed reviewed admission, read as files and decoded, as
 * `catalog-conditions.ts` reads it: a CLI never compiles the large evidence
 * JSON into a module (#744). It is checked as `reviewed-data.ts` checks the
 * same files, and evidence named twice is refused by name. Like the module it
 * replaces, it is read once per process; a failed read is not kept.
 */
export function readCommittedReviewedAdmission() {
  committed ??= readReviewedAdmission().catch((error: unknown) => {
    committed = undefined;
    throw error;
  });
  return committed;
}
