import { expect, test } from 'vitest';
import type { PhaseReadiness } from '../types';
import {
  confirmWarnings,
  readinessLine,
  stepCaption,
  stepState,
} from './readiness-copy';

function step(
  phase: PhaseReadiness['phase'],
  overrides: Partial<PhaseReadiness> = {},
): PhaseReadiness {
  return {
    phase,
    available: true,
    ready: true,
    requirements: [],
    warnings: [],
    ...overrides,
  };
}
const item = (id: string) => ({ id, message: id });

test('a step caption is a check-equivalent or the open decisions, with warnings counted separately', () => {
  expect(stepCaption(step('upkeep'))).toBe('Ready');
  expect(stepCaption(step('upkeep', { warnings: [item('a')] }))).toBe(
    'Ready · 1 warning',
  );
  expect(
    stepCaption(
      step('activity', {
        ready: false,
        requirements: [item('a'), item('b')],
        warnings: [item('c'), item('d')],
      }),
    ),
  ).toBe('2 to decide · 2 warnings');
  expect(
    stepCaption(step('event', { ready: false, requirements: [item('a')] })),
  ).toBe('1 to decide');
});

test('a locked Persistent says why and Review & confirm has no caption at all', () => {
  expect(
    stepCaption(
      step('persistent', {
        available: false,
        ready: false,
        requirements: [item('a')],
      }),
    ),
  ).toBe('No carried events');
  expect(
    stepCaption(step('summary', { ready: false, requirements: [item('a')] })),
  ).toBeNull();
  expect(stepCaption(step('summary'))).toBeNull();
});

test('the footer line names the phase, or shows only the disabled-Confirmation reason on Review & confirm', () => {
  expect(readinessLine(step('upkeep'), null)).toBe('Upkeep is ready.');
  expect(readinessLine(step('event', { warnings: [item('a')] }), null)).toBe(
    'Event is ready. 1 warning.',
  );
  expect(
    readinessLine(
      step('activity', { ready: false, requirements: [item('a')] }),
      null,
    ),
  ).toBe('Complete the required rolls and decisions to finish Activity.');
  expect(readinessLine(step('summary'), '2 decisions left')).toBe(
    '2 decisions left',
  );
  expect(readinessLine(step('summary'), null)).toBe('');
  expect(
    readinessLine(
      step('summary', { ready: false, requirements: [item('a')] }),
      null,
    ),
  ).toBe('');
});

test('progress segments distinguish current, done, open and locked positions', () => {
  expect(stepState(step('upkeep'), 'upkeep')).toBe('current');
  expect(stepState(step('upkeep'), 'event')).toBe('done');
  expect(stepState(step('activity', { ready: false }), 'event')).toBe('open');
  expect(stepState(step('persistent', { available: false }), 'event')).toBe(
    'locked',
  );
  expect(stepState(step('summary'), 'event')).toBe('open');
});

test('a skipped first-week Upkeep says so instead of reporting readiness', () => {
  const skipped = step('upkeep', { skipped: true });
  expect(stepCaption(skipped)).toBe('Skipped · first week');
  expect(readinessLine(skipped, null)).toBe(
    'Upkeep is skipped for the militia’s first week.',
  );
});

test('the pinned Confirm counts Review’s warnings: none, one, several', () => {
  expect(confirmWarnings(step('summary'))).toBeNull();
  expect(confirmWarnings(step('summary', { warnings: [item('a')] }))).toBe(
    '1 warning',
  );
  expect(
    confirmWarnings(step('summary', { warnings: [item('a'), item('b')] })),
  ).toBe('2 warnings');
});
