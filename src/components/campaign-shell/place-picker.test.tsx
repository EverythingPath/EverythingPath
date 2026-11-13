import { render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';
import { buildAppNavigation } from '~/lib/app-navigation';
import { PlacePicker } from './place-picker';

const kingmaker = { id: 'c1', name: 'Kingmaker', hasMilitia: true };

test.each([
  ['/campaigns', 'Campaigns'],
  ['/characters', 'Characters'],
  ['/campaigns/c1', 'Kingmaker'],
])('the current place is visible on %s', (pathname, label) => {
  render(
    <PlacePicker
      nav={buildAppNavigation({ pathname, campaigns: [kingmaker] })}
    />,
  );
  expect(
    screen.getByRole('combobox', { name: 'Where you are' }),
  ).toHaveTextContent(label);
});

test.each([
  ['/campaigns', 'Campaigns'],
  ['/characters', 'Characters'],
  ['/campaigns/c1', 'Kingmaker'],
])(
  'the initial page names the current place before hydration on %s',
  (pathname, label) => {
    const page = document.createElement('div');
    page.innerHTML = renderToString(
      <PlacePicker
        nav={buildAppNavigation({ pathname, campaigns: [kingmaker] })}
      />,
    );
    expect(
      within(page).getByRole('combobox', { name: 'Where you are' }),
    ).toHaveTextContent(label);
  },
);
