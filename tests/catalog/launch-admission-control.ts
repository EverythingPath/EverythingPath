// The admission evidence the families' committed-inventory controls share:
// the committed projection, the gate's reviewed input on the assessment path
// (the confirmed attribution assessments) and the default-path assertion that
// the committed projection still admits every row of a control's reviewed
// scope, read from that input and not from the projection under test.
import { readFile } from 'node:fs/promises';
import { expect } from 'vitest';
import { parseLaunchVerification } from '../../scripts/catalog/launch-verification';
import { reviewedAdmissionSchema } from '../../src/lib/catalog/admission-schema';

/** The committed launch verification projection. */
export async function committedProjection() {
  return parseLaunchVerification(
    JSON.parse(
      await readFile(
        'scripts/catalog/scopes/campaign-mvp-v1.verification.json',
        'utf8',
      ),
    ),
  );
}

export type ProjectedRows = Awaited<
  ReturnType<typeof committedProjection>
>['rows'];

/** The keys of the committed attribution assessments a reviewer confirmed. */
export async function confirmedAssessments() {
  const assessments = reviewedAdmissionSchema.shape.assessments.parse(
    JSON.parse(
      await readFile(
        'src/lib/catalog/data/attribution-assessments.json',
        'utf8',
      ),
    ),
  );
  return new Set(
    assessments
      .filter(({ status }) => status === 'confirmed')
      .map(({ externalKey }) => externalKey),
  );
}

/**
 * How a projection's rows differ from a control's reviewed scope: at least
 * `missing` (reviewed rows it lacks); a control may report more, each a list
 * of keys.
 */
type Agreement = { missing: string[] } & Record<string, string[]>;

/**
 * The default-path check (#227): the committed projection, built on the
 * gate's default path, still admits every row of a control's reviewed scope,
 * so the #227 rule cannot silently drop a reviewed row. It is a superset
 * check: rows the #227 rule newly admits are outside every family's reviewed
 * scope (`docs/catalog-import/campaign-mvp.md`), so the control doesn't
 * compare them. Negative over the reviewed scope: a projection missing any
 * reviewed row disagrees on that row alone, as `missing`. `expected` is
 * non-empty, so the loop never passes vacuously.
 */
export function expectReviewedScopeAdmitted({
  rows,
  expected,
  agreement,
}: {
  rows: ProjectedRows;
  expected: readonly string[];
  agreement: (rows: ProjectedRows) => Agreement;
}) {
  expect(expected.length).toBeGreaterThan(0);
  const agreed = agreement(rows);
  const none = Object.fromEntries(
    Object.keys(agreed).map((name) => [name, []]),
  );
  expect(agreed).toEqual(none);
  for (const key of expected)
    expect(agreement(rows.filter((row) => row.key !== key)), key).toEqual({
      ...none,
      missing: [key],
    });
}
