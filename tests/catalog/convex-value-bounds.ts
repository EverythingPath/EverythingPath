import { releaseByteCount } from '../../src/lib/catalog/release-schema';

/**
 * Convex value limits convex-test does not enforce
 * (`convex/_generated/ai/guidelines.md`, Convex types): an array holds at
 * most 8,192 values, an object at most 1,024 fields, and a document is at
 * most 1 MiB. A release row's size is its canonical JSON size.
 */
const maxArrayValues = 8_192;
const maxObjectFields = 1_024;
const maxDocumentBytes = 1_048_576;

/** Every array or object in `value` that exceeds its Convex limit, by path. */
export function convexValueBoundViolations(
  value: unknown,
  path = '$',
): string[] {
  if (Array.isArray(value))
    return [
      ...(value.length > maxArrayValues
        ? [`${path}: ${value.length} array values`]
        : []),
      ...value.flatMap((item, index) =>
        convexValueBoundViolations(item, `${path}[${index}]`),
      ),
    ];
  if (value === null || typeof value !== 'object') return [];
  const entries = Object.entries(value);
  return [
    ...(entries.length > maxObjectFields
      ? [`${path}: ${entries.length} object fields`]
      : []),
    ...entries.flatMap(([key, item]) =>
      convexValueBoundViolations(item, `${path}.${key}`),
    ),
  ];
}

/** A release row's value and document size violations, named by its key. */
export function releaseRowBoundViolations(row: {
  kind: string;
  key: string;
  payload: unknown;
}) {
  const bytes = releaseByteCount(row);
  return [
    ...(bytes > maxDocumentBytes ? [`${row.key}: ${bytes} bytes`] : []),
    ...convexValueBoundViolations(row.payload, row.key),
  ];
}
