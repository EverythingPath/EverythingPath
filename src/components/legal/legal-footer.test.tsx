import { render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { LegalFooter } from './legal-footer';

vi.mock('next/link', async () =>
  (await import('~/components/campaign-shell/shell-test-helpers')).linkModule(),
);

test('the footer is a landmark with the legal notices and contact links', () => {
  render(<LegalFooter />);
  const footer = screen.getByRole('contentinfo');
  const link = within(footer).getByRole('link', { name: 'Legal notices' });
  expect(link).toHaveAttribute('href', '/legal');
  expect(within(footer).getAllByRole('link')).toHaveLength(2);
});
