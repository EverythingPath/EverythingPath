// The admission evidence the families' committed-inventory controls share:
// the committed projection, the gate's reviewed input (the confirmed
// attribution assessments) and the assertion that the committed projection
// admits exactly a control's expected rows, read from that input and not
// from the projection under test.
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
 * How a projection's rows differ from a control's expected admission: at
 * least `missing` (expected rows it lacks) and `extra` (rows it admits or
 * proves outside them); a control may report more, each a list of keys.
 */
type Agreement = { missing: string[]; extra: string[] } & Record<
  string,
  string[]
>;

/**
 * The committed projection agrees with a control's expected admission, and
 * the comparison is negative over the control's whole scope: a projection
 * missing any expected row disagrees on that row alone, as `missing`, and one
 * carrying any unadmitted row (`added` builds it) disagrees on it alone, as
 * `extra`. Each side is non-empty, so neither loop passes vacuously.
 */
export function expectAdmissionAgreement({
  rows,
  expected,
  unadmitted,
  agreement,
  added,
}: {
  rows: ProjectedRows;
  expected: readonly string[];
  unadmitted: readonly string[];
  agreement: (rows: ProjectedRows) => Agreement;
  added: (key: string) => ProjectedRows[number];
}) {
  expect(expected.length).toBeGreaterThan(0);
  expect(unadmitted.length).toBeGreaterThan(0);
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
  for (const key of unadmitted)
    expect(agreement([...rows, added(key)]), key).toEqual({
      ...none,
      extra: [key],
    });
}
