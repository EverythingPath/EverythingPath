// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import * as spellModule from './spell';

// The legacy spell table sits outside the notice system and has no client
// caller: its read returns the whole table.
// Every Convex function the module registers stays off the public API.
const registered = Object.entries(spellModule).filter(
  ([, value]) =>
    typeof value === 'function' &&
    ('isQuery' in value || 'isMutation' in value || 'isAction' in value),
);

test('the spell module registers its legacy functions', () => {
  expect(registered.map(([name]) => name).sort()).toEqual(['get', 'getCount']);
});

test.each(registered)('spell.%s is internal', (_name, fn) => {
  expect(fn).toHaveProperty('isInternal', true);
  expect(fn).not.toHaveProperty('isPublic');
});
