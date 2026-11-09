import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { conditionDefinitions } from '~/lib/character-sheet-conditions';
import { ConditionPicker } from './condition-fields';

test('condition search keeps its status live region available and changes its message as matches change', () => {
  render(
    <ConditionPicker
      options={conditionDefinitions}
      value={{ kind: 'custom' }}
      isDisabled={false}
      onSelect={vi.fn()}
      onCustom={vi.fn()}
    />,
  );
  const search = screen.getByRole('searchbox', {
    name: 'Find a condition',
  });
  const status = screen.getByRole('status');
  expect(status).toBeEmptyDOMElement();

  fireEvent.change(search, { target: { value: 'zzz' } });
  expect(status).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(
    'No matching conditions.',
  );

  fireEvent.change(search, { target: { value: 'fri' } });
  expect(status).toBeInTheDocument();
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});
