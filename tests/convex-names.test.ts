import { convexQuery } from '@convex-dev/react-query';
import { api } from '@convex/_generated/api';
import { anyApi, type FunctionReference } from 'convex/server';
import { expect, test } from 'vitest';
import { convexNames } from './convex-names';

const name = convexNames({ sheet: api.characterSheet.read });

test('a named function matches by its Convex name, not object identity', () => {
  // anyApi builds a fresh proxy on every property read.
  expect(api.characterSheet.read).not.toBe(api.characterSheet.read);
  expect(name(api.characterSheet.read)).toBe('sheet');
});

test('a convexQuery key string matches the same name', () => {
  const [, key] = convexQuery(api.characterSheet.read, {
    characterId: 'character',
  }).queryKey;
  expect(name(key)).toBe('sheet');
});

test('a function the names never list still resolves and can be matched', () => {
  expect(name(api.campaign.createCampaign)).toBe('campaign:createCampaign');
  // A function another branch adds later: the generated api is anyApi at
  // runtime, so a component's reference resolves before codegen lists it.
  const added = anyApi.addedLater?.brandNew as FunctionReference<'mutation'>;
  expect(name(added)).toBe('addedLater:brandNew');
});

test('the names stay typed against the generated api', () => {
  // @ts-expect-error a renamed or removed function fails typecheck
  convexNames({ gone: api.characterSheet.notAFunction });
  // @ts-expect-error an unknown name is no possible result
  expect(name(api.characterSheet.read) === 'sheets').toBe(false);
});
