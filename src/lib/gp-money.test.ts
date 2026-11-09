import { expect, test } from 'vitest';
import {
  copperToGpInput,
  parseGpInput,
  parseSignedGpInput,
  signedCopperToGpInput,
} from './gp-money';

test('signed gp converts exactly to signed copper, to one copper', () => {
  expect(parseSignedGpInput('-0.07')).toEqual({ kind: 'valid', copper: -7 });
  expect(parseSignedGpInput('−12.5')).toEqual({
    kind: 'valid',
    copper: -1250,
  });
  expect(parseSignedGpInput('+3')).toEqual({ kind: 'valid', copper: 300 });
  expect(parseSignedGpInput('500')).toEqual({ kind: 'valid', copper: 50000 });
  const zero = parseSignedGpInput('-0');
  expect(zero).toEqual({ kind: 'valid', copper: 0 });
  expect(zero.kind === 'valid' && Object.is(zero.copper, -0)).toBe(false);
});

test('signed gp keeps empty separate from malformed, too-precise or oversized input', () => {
  expect(parseSignedGpInput(' ')).toEqual({ kind: 'empty' });
  for (const text of ['-', '+', '--3', '-3a', '1e3', '-.5', '3-'])
    expect(parseSignedGpInput(text)).toMatchObject({ kind: 'invalid' });
  expect(parseSignedGpInput('-0.075')).toEqual({
    kind: 'invalid',
    message: 'Use at most two decimal places (1 cp = 0.01 gp).',
  });
  expect(parseSignedGpInput('-999999999999999999')).toEqual({
    kind: 'invalid',
    message: 'Enter a smaller amount.',
  });
});

test('stored signed copper is shown as editable gp and parses back unchanged', () => {
  expect(signedCopperToGpInput(-7)).toBe('-0.07');
  expect(signedCopperToGpInput(-1250)).toBe('-12.5');
  expect(signedCopperToGpInput(0)).toBe('0');
  for (const copper of [-900719925474099, -1205, -7, 0, 7, 50000])
    expect(parseSignedGpInput(signedCopperToGpInput(copper))).toEqual({
      kind: 'valid',
      copper,
    });
});

test('whole and decimal gp convert exactly to copper', () => {
  expect(parseGpInput('30')).toEqual({ kind: 'valid', copper: 3000 });
  expect(parseGpInput('12.5')).toEqual({ kind: 'valid', copper: 1250 });
  expect(parseGpInput('0.07')).toEqual({ kind: 'valid', copper: 7 });
  expect(parseGpInput('0')).toEqual({ kind: 'valid', copper: 0 });
});

test('empty input differs from malformed, too-precise or oversized gp', () => {
  expect(parseGpInput('')).toEqual({ kind: 'empty' });
  expect(parseGpInput('   ')).toEqual({ kind: 'empty' });
  expect(parseGpInput('12a')).toEqual({
    kind: 'invalid',
    message: 'Enter an amount in gp, such as 12 or 0.07.',
  });
  expect(parseGpInput('-3')).toMatchObject({ kind: 'invalid' });
  expect(parseGpInput('1e3')).toMatchObject({ kind: 'invalid' });
  expect(parseGpInput('.5')).toMatchObject({ kind: 'invalid' });
  expect(parseGpInput('0.075')).toEqual({
    kind: 'invalid',
    message: 'Use at most two decimal places (1 cp = 0.01 gp).',
  });
  expect(parseGpInput('999999999999999999')).toEqual({
    kind: 'invalid',
    message: 'Enter a smaller amount.',
  });
});

test('a trailing decimal point is accepted while typing', () => {
  expect(parseGpInput('12.')).toEqual({ kind: 'valid', copper: 1200 });
});

test('stored copper is shown as editable gp and parses back unchanged', () => {
  expect(copperToGpInput(3000)).toBe('30');
  expect(copperToGpInput(1250)).toBe('12.5');
  expect(copperToGpInput(1205)).toBe('12.05');
  expect(copperToGpInput(7)).toBe('0.07');
  expect(copperToGpInput(0)).toBe('0');
  expect(copperToGpInput(123456789)).toBe('1234567.89');
  for (const copper of [0, 7, 70, 1205, 99999, 900719925474099])
    expect(parseGpInput(copperToGpInput(copper))).toEqual({
      kind: 'valid',
      copper,
    });
});
