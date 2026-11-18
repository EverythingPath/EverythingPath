// PZO9419 and PZO9416 have reviewed PCGen blocks since their confirmations'
// review was recorded (2026-10-31), and Bestiary 6 (PZO1137) since
// notice-ownline-1's (2026-11-17): the gate resolves them, while the legal
// page still lists their own unreviewed Registry records.
const gateResolvedNotices = new Set(['PZO9419', 'PZO9416', 'PZO1137']);

/** The required notices the gate still finds missing. */
export function withoutGateResolvedNotices(codes: readonly string[]) {
  return codes.filter((code) => !gateResolvedNotices.has(code));
}
