import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { expect, test } from 'vitest';
import { SetupNotesButton } from './setup-notes';

test('no button exists without notes', () => {
  render(<SetupNotesButton notes={undefined} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  cleanup();
  render(<SetupNotesButton notes="" />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('the button opens an accessible dialog with the notes, Escape closes it and focus returns', async () => {
  render(
    <SetupNotesButton notes={'Resumed at week twelve.\nHomebrew treasury.'} />,
  );
  const button = screen.getByRole('button', { name: 'Setup notes' });
  expect(button).toHaveAttribute('aria-haspopup', 'dialog');
  button.focus();
  fireEvent.click(button);
  const dialog = await screen.findByRole('dialog', { name: 'Setup notes' });
  expect(dialog).toHaveTextContent('Resumed at week twelve.');
  expect(dialog).toHaveTextContent('Homebrew treasury.');
  await waitFor(() =>
    expect(dialog.contains(document.activeElement)).toBe(true),
  );
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  await waitFor(() => expect(button).toHaveFocus());
});
