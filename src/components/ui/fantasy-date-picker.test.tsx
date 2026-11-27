import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FantasyDatePicker } from './fantasy-date-picker';

describe('FantasyDatePicker', () => {
  it('uses fantasy month names and starts the week on Monday-first headers', () => {
    const onChange = vi.fn();

    render(
      <FantasyDatePicker
        value="2026-03-22"
        onChange={onChange}
        ariaLabel="In-game date"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'In-game date' }));

    expect(screen.getByText('Pharast')).toBeInTheDocument();
    const weekdayHeaders = ['Moon', 'Toil', 'Weal', 'Oath', 'Fire', 'Star', 'Sun'];
    weekdayHeaders.forEach((header) => {
      expect(screen.getByText(header)).toBeInTheDocument();
    });
  });
});
