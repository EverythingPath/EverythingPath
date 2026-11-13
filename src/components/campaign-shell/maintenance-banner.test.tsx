import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { MaintenanceBanner } from './maintenance-banner';

const maintenance = vi.fn<() => MigrationMaintenance>();
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

function notice(kind: MigrationMaintenance['kind'], message: string) {
  maintenance.mockReturnValue({ kind, readOnly: kind !== 'ready', message });
}

test('ready keeps the live region mounted and empty', () => {
  notice('ready', '');
  render(<MaintenanceBanner />);
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  expect(
    screen.queryByRole('button', { name: 'Reload page' }),
  ).not.toBeInTheDocument();
});

test('loading shows the check without a reload button', () => {
  notice('loading', 'Checking whether editing is available.');
  render(<MaintenanceBanner />);
  expect(screen.getByRole('status')).toHaveTextContent(
    'Checking whether editing is available.',
  );
  expect(
    screen.queryByRole('button', { name: 'Reload page' }),
  ).not.toBeInTheDocument();
});

test('maintenance shows the message verbatim with no retry or reload button', () => {
  notice('maintenance', 'Editing is paused for maintenance.');
  render(<MaintenanceBanner />);
  expect(screen.getByRole('status')).toHaveTextContent(
    'Editing is paused for maintenance.',
  );
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test.each(['reload_required', 'unavailable'] as const)(
  '%s offers one Reload page button that reloads the document only when pressed',
  (kind) => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    notice(kind, 'Reload this page before saving.');
    render(<MaintenanceBanner />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Reload this page before saving.',
    );
    expect(reload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reload page' }));
    expect(reload).toHaveBeenCalledTimes(1);
  },
);

test('a notice that appears later replaces the empty region in place', () => {
  notice('ready', '');
  const view = render(<MaintenanceBanner />);
  const region = screen.getByRole('status');
  notice('reload_required', 'Unsaved changes will be discarded.');
  view.rerender(<MaintenanceBanner />);
  expect(screen.getByRole('status')).toBe(region);
  expect(region).toHaveTextContent('Unsaved changes will be discarded.');
  expect(screen.getByRole('button', { name: 'Reload page' })).toBeVisible();
});
