import { z } from 'zod';

import { requiredTests, suites, type Suite } from './matrix.ts';

export const passedTestSchema = z.object({
  file: z.string(),
  project: z.string(),
  title: z.string(),
  expectedStatus: z.literal('passed'),
  tags: z
    .array(z.string())
    .refine((tags) => !tags.some((tag) => /quarantin|skip|only/i.test(tag))),
  annotations: z
    .array(z.string())
    .refine(
      (annotations) =>
        !annotations.some((type) =>
          /only|skip|fixme|fail|quarantin/i.test(type),
        ),
    ),
  results: z.tuple([
    z.object({ status: z.literal('passed'), retry: z.literal(0) }),
  ]),
});
const reportSchema = z.object({
  status: z.literal('passed'),
  errors: z.literal(0),
  tests: z.array(passedTestSchema),
});

// Count and identify required tests independently of Playwright's selected suite.
// A green runner alone cannot prove that every journey actually ran.
export function evaluateResults(
  report: unknown,
  suite: Suite = suites.mandatory,
): boolean {
  const parsed = reportSchema.safeParse(report);
  if (!parsed.success) return false;
  const required = requiredTests(suite);
  if (parsed.data.tests.length !== required.length) return false;
  return required.every(([file, project, title]) =>
    parsed.data.tests.some(
      (test) =>
        test.file === file && test.project === project && test.title === title,
    ),
  );
}
