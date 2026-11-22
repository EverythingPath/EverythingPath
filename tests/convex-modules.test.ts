import { expect, test } from 'vitest';
import { listCalledConvexModules } from './convex-modules';

test('a test file’s api, internal and string function references name the modules it calls, once each', () => {
  expect(
    listCalledConvexModules(`
      await owner.mutation(api.characterSheet.create, args);
      await t.mutation(internal.characterMoves.cleanup, {});
      const start = makeFunctionReference<'mutation', { characterId: string }>(
        'characterMoves:start',
      );
      await owner.query(api.characterSheet.read, { characterId });
      await t.query(makeFunctionReference('lib/helpers:read'), {});
    `),
  ).toEqual(['characterSheet', 'characterMoves', 'lib/helpers']);
});

test('other text names no modules', () => {
  expect(
    listCalledConvexModules(
      "expect(sheet.name).toBe('Vessa'); const time = '10:30';",
    ),
  ).toEqual([]);
});
