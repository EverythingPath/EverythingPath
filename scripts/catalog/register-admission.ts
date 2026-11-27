import { readFile } from 'node:fs/promises';
import { reviewedAdmissionSchema } from '../../src/lib/catalog/admission-schema.ts';
import { parseReviewedAdmissionInput } from '../../src/lib/catalog/attribution-evidence-codec.ts';
import {
  committedStoredNotices,
  storedNoticesOf,
  type StoredNotices,
} from './stored-required-notices.ts';

type ReviewedAdmission = ReturnType<typeof reviewedAdmissionSchema.parse>;

/**
 * The admission gate's attribution input under per-book licensing (owner
 * decision of 2026-11-25): the notice register, with any retained uses and
 * exceptions, and the notices each stored assessment required
 * (`storedNotices`), but no Attribution Assessment or evidence. The gate then
 * decides every row on the books it comes from and those notices, as it did
 * with the assessments (`decideOnDeclaredBooks`).
 */
export type RegisterAdmission = Omit<
  ReviewedAdmission,
  'assessments' | 'evidence'
> & {
  storedNotices: StoredNotices;
  assessments: [];
  evidence: Record<string, never>;
};

/**
 * An admission's register, retained uses and exceptions and stored notices,
 * without its per-entry proof. The stored notices are the admission's own
 * when it gives them, else its assessments' (`storedNoticesOf`, which refuses
 * a key assessed twice).
 */
export function registerOnly(
  admission: Pick<ReviewedAdmission, 'registry'> &
    Partial<
      Pick<
        ReviewedAdmission,
        'retainedUses' | 'retainedExceptions' | 'assessments'
      >
    > & { storedNotices?: StoredNotices },
): RegisterAdmission {
  return {
    registry: admission.registry,
    retainedUses: admission.retainedUses ?? [],
    retainedExceptions: admission.retainedExceptions ?? [],
    storedNotices:
      admission.storedNotices ?? storedNoticesOf(admission.assessments ?? []),
    assessments: [],
    evidence: {},
  };
}

async function readRegister() {
  const registry: unknown = JSON.parse(
    await readFile(
      new URL(
        '../../src/lib/catalog/data/section15-registry.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  return registerOnly({
    ...reviewedAdmissionSchema.parse({
      registry,
      assessments: [],
      evidence: {},
    }),
    storedNotices: committedStoredNotices,
  });
}

let committed: Promise<RegisterAdmission> | undefined;

/**
 * The committed notice register and frozen stored notices
 * (`stored-required-notices.json`) as the gate's input, read once per
 * process (a failed read is not kept). The release build and the preview,
 * conditions, party-status, verification and notice-coverage commands read
 * this, never the committed Attribution Assessments or evidence.
 */
export function readCommittedRegisterAdmission() {
  committed ??= readRegister().catch((error: unknown) => {
    committed = undefined;
    throw error;
  });
  return committed;
}

/**
 * The gate's input from `--attribution <file>` (the reviewed-admission shape
 * it has always accepted, checked as before). The file replaces both inputs:
 * the committed register by its Registry, and the committed frozen stored
 * notices by the notice lists of its own assessments; its retained uses and
 * exceptions come with them. A key it assesses twice is refused, as the gate
 * refuses it. Without one, the committed register and frozen stored notices.
 */
export async function readRegisterAdmission(
  attributionPath: string | undefined,
): Promise<RegisterAdmission> {
  if (attributionPath === undefined) return readCommittedRegisterAdmission();
  return registerOnly(
    reviewedAdmissionSchema.parse(
      parseReviewedAdmissionInput(await readFile(attributionPath, 'utf8')),
    ),
  );
}
