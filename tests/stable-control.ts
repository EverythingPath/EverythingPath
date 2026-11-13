import { isInaccessible, screen } from '@testing-library/react';
import { expect } from 'vitest';

// A control looked up once by role and name, then re-checked on each use
// instead of re-queried. A screen-wide `getByRole(..., { name })` computes
// every candidate's accessible name, and jsdom recomputes each node's styles
// after any change, so repeated lookups in a large editor dominate a test's
// time. Each use asserts what that lookup asserted for this element: it is
// still in the document, exposed to assistive technology, and has the same
// name. A re-mounted control fails. Uniqueness is asserted only by the first
// lookup: use it only for controls the test never duplicates.
export function stableControl(
  role: string,
  name: string,
  container: Pick<typeof screen, 'getByRole'> = screen,
) {
  const element = container.getByRole(role, { name });
  return () => {
    expect(element).toBeInTheDocument();
    expect(isInaccessible(element)).toBe(false);
    expect(element).toHaveAccessibleName(name);
    return element;
  };
}
