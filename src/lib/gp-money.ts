// Gold is shown and entered in gp; copper is what is stored (1 gp = 100 cp).
// Parsing works on the digits, never through floating point, so every stored
// copper amount survives a round trip exactly.
export type GpInput =
  | { kind: 'valid'; copper: number }
  | { kind: 'empty' }
  | { kind: 'invalid'; message: string };

export function parseGpInput(text: string): GpInput {
  const trimmed = text.trim();
  if (trimmed === '') return { kind: 'empty' };
  const match = /^(\d+)(?:\.(\d*))?$/.exec(trimmed);
  if (!match)
    return {
      kind: 'invalid',
      message: 'Enter an amount in gp, such as 12 or 0.07.',
    };
  const [, whole = '', fraction = ''] = match;
  if (fraction.length > 2)
    return {
      kind: 'invalid',
      message: 'Use at most two decimal places (1 cp = 0.01 gp).',
    };
  const copper = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(copper))
    return { kind: 'invalid', message: 'Enter a smaller amount.' };
  return { kind: 'valid', copper };
}

// Signed gp, for amounts that may take treasury away (Table Adjustments).
// A leading minus (ASCII or typographic) or plus applies to the whole amount:
// "-0.07" is −7 copper. A sign on its own is malformed, not empty.
export function parseSignedGpInput(text: string): GpInput {
  const trimmed = text.trim();
  const sign = /^[-−+]/.exec(trimmed)?.[0];
  if (!sign) return parseGpInput(trimmed);
  const amount = parseGpInput(trimmed.slice(1));
  if (amount.kind === 'invalid') return amount;
  if (amount.kind === 'empty')
    return {
      kind: 'invalid',
      message: 'Enter an amount in gp, such as -3 or 0.07.',
    };
  return {
    kind: 'valid',
    copper:
      sign === '+' || amount.copper === 0 ? amount.copper : -amount.copper,
  };
}

export function signedCopperToGpInput(copper: number): string {
  return copper < 0 ? `-${copperToGpInput(-copper)}` : copperToGpInput(copper);
}

export function copperToGpInput(copper: number): string {
  const whole = Math.floor(copper / 100);
  const fraction = String(copper % 100)
    .padStart(2, '0')
    .replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}
