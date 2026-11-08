import { expect, test, vi } from 'vitest';
import CharacterSheetRoute from './page';
const redirect = vi.fn((href: string) => {
  throw new Error(href);
});
vi.mock('next/navigation', () => ({
  redirect: (href: string) => redirect(href),
}));
test('old campaign sheet links redirect to the independent sheet with officer origin', async () => {
  await expect(
    CharacterSheetRoute({
      params: Promise.resolve({
        campaignId: 'campaign-1',
        characterId: 'hero%20one',
      }),
    }),
  ).rejects.toThrow(
    '/characters/hero%20one?from=%2Fcampaigns%2Fcampaign-1%2Fofficers',
  );
  expect(redirect).toHaveBeenCalledWith(
    '/characters/hero%20one?from=%2Fcampaigns%2Fcampaign-1%2Fofficers',
  );
});
