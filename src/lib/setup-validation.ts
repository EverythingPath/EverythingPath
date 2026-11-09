import type { z } from 'zod';
import {
  militiaSetupFieldsSchema,
  militiaSetupReferenceIssues,
  militiaSetupSchema,
  militiaSetupWarnings,
} from './canonical-setup';
import { setupLocationForPath, type SetupLocation } from './setup-sections';

// Errors without a section belong in a visible summary. `field` errors come
// from a control's own type or format; `refinement` errors from rules across
// values, which a control may not show itself.
export type SetupErrorDescriptor = (SetupLocation | { section?: undefined }) & {
  message: string;
  field?: string;
  kind: 'field' | 'refinement';
};

// Rules warnings for the current form values, grouped by step. Unfinished or
// structurally invalid values have none. `names` names characters by identity.
export function setupWarningDescriptors(
  values: unknown,
  names?: ReadonlyMap<string, string>,
) {
  const parsed = militiaSetupSchema.safeParse(values);
  return parsed.success ? militiaSetupWarnings(parsed.data, names) : [];
}

type Path = readonly PropertyKey[];
const samePath = (left: Path, right: Path) =>
  left.length === right.length && left.every((key, i) => key === right[i]);

// Every validation error for the current form values, located at the step and
// entry that can repair it. Pass a stricter schema built on
// `militiaSetupSchema`, such as `militiaCorrectionSchema`, to include its
// rules.
export function setupErrorDescriptors(
  values: unknown,
  schema: z.ZodType = militiaSetupSchema,
): SetupErrorDescriptor[] {
  const result = schema.safeParse(values);
  if (result.success) return [];
  // Cross-reference issues report a root path. Recompute them from the same
  // values and pair each reported issue with the check that produced it.
  const fields = militiaSetupFieldsSchema.safeParse(values);
  const references = fields.success
    ? militiaSetupReferenceIssues(fields.data)
    : [];
  return result.error.issues.map((issue) => {
    const kind = issue.code === 'custom' ? 'refinement' : 'field';
    const index =
      kind === 'refinement'
        ? references.findIndex(
            (reference) =>
              reference.message === issue.message &&
              samePath(reference.path, issue.path),
          )
        : -1;
    const [reference] = index >= 0 ? references.splice(index, 1) : [];
    const target = reference?.target ?? issue.path;
    const location = setupLocationForPath(target);
    return location
      ? { ...location, field: target.join('.'), message: issue.message, kind }
      : { message: issue.message, kind };
  });
}

// Corrections need a recorded reason; everything else validates as Setup.
export const militiaCorrectionSchema = militiaSetupSchema.refine(
  (setup) => setup.notes.trim().length > 0,
  { path: ['notes'], message: 'A reason is required for this correction.' },
);

// A control's error text: empty input is "required"; other numeric input is
// malformed; any other message comes from validation.
export function setupFieldErrorMessage({
  label,
  value,
  numeric,
  decimal,
  error,
}: {
  label: string;
  value: unknown;
  numeric?: boolean;
  decimal?: boolean;
  error: string | undefined;
}) {
  if (value === null || value === undefined || value === '')
    return `${label} is required.`;
  if (numeric)
    return `Enter a valid ${decimal ? 'number' : 'whole number'} for ${label}.`;
  return error;
}
