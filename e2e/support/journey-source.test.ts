// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const e2e = join(process.cwd(), 'e2e');
const journeySources = [
  ...readdirSync(e2e)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => join(e2e, name)),
  ...readdirSync(join(e2e, 'support'))
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => join(e2e, 'support', name)),
];

// Playwright's check() and uncheck() assert the new state right after the
// click. A checkbox the server controls changes only once its save returns
// (run 2: `Record Breeze`), so journeys click it and wait on the retrying
// toBeChecked() and the save status instead.
it('journeys click checkboxes and wait for the saved state instead of check()', () => {
  const offenders = journeySources.flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line, index) =>
        /\.(?:check|uncheck|setChecked)\(/.test(line)
          ? [`${file.slice(e2e.length + 1)}:${index + 1}`]
          : [],
      ),
  );
  expect(offenders).toEqual([]);
});
