# WIP CI shard reports

`shard-1.json` (green) and `shard-2.json` (two failed tests and a file that failed to load) are real Vitest 4.0.18 JSON reports, the input `wip_ci.py summarize` reads. `wip-ci.test.py` uses them.

They come from these five files under `tests/wip-fixture/`, with this `vitest.config.mjs`:

```js
export default { test: { include: ['tests/**/*.test.ts'] } };
```

```ts
// arithmetic.test.ts
import { expect, it } from 'vitest';
it('adds', () => expect(1 + 1).toBe(2));
it('multiplies', () => expect(2 * 3).toBe(6));

// sorting.test.ts
import { expect, it } from 'vitest';
it('sorts numbers', () => expect([3, 1, 2].sort()).toEqual([1, 2, 3]));

// strings.test.ts
import { expect, it } from 'vitest';
it('joins', () => expect(['a', 'b'].join('-')).toBe('a-b'));
it.skip('is skipped', () => expect(true).toBe(false));

// broken-b.test.ts
throw new Error('module b failed to load');

// catalog-rows.test.ts
import { describe, expect, it } from 'vitest';
describe('catalog rows', () => {
  it('names every missing row', () => {
    const missing = Array.from({ length: 45 }, (_, index) => `missing row ${index + 1}`);
    throw new Error(`45 rows missing:\n${missing.join('\n')}`);
  });
  it('counts rows', () => expect(3).toBe(4));
  it('passes', () => expect(true).toBe(true));
});
```

To regenerate, run each shard from the fixture root, then replace the fixture root and the checkout's absolute paths with `/home/runner/work/everythingpath/everythingpath`, a GitHub runner's checkout:

```sh
node <checkout>/node_modules/vitest/vitest.mjs run --root "$PWD" --config vitest.config.mjs \
  --shard=$i/2 --reporter=dot --reporter=json --outputFile.json=shard-$i.json
```
