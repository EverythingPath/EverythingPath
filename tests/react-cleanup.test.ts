import { render } from '@testing-library/react';
import { createElement, useEffect } from 'react';
import { expect, test } from 'vitest';

// Guards the shared setup: no test file unmounts by hand, so the setup file
// must unmount every rendered tree before the next test starts.
let unmounted = false;

function Subscriber() {
  useEffect(
    () => () => {
      unmounted = true;
    },
    [],
  );
  return createElement('p', null, 'subscribed');
}

test('a rendered component stays mounted during its own test', () => {
  render(createElement(Subscriber));
  expect(unmounted).toBe(false);
});

test('the previous test’s tree is unmounted before the next test runs', () => {
  expect(unmounted).toBe(true);
  expect(document.body).toBeEmptyDOMElement();
});
