import { describe, expect, it } from 'vitest';
import { unverifiedReasons } from '../../lib/catalog/imported-entry-schema';
import { describeUnverified, describeUnverifiedReasons } from './entry-label';

describe('unverified reasons', () => {
  it('lists the reasons in their order, the unreviewed curation record last', () => {
    expect(unverifiedReasons).toEqual([
      'no verification projection',
      'verification projection stale',
      'outside the launch inventory',
      'structure not verified',
      'definition differs from the verified one',
      'retained without its imported entry',
      'unproven mechanism',
      'no curation record',
      'unresolved curation mechanics',
      'curation record not reviewed',
    ]);
  });

  it('gives an unreviewed curation record its own phrase, not the generic one', () => {
    expect(describeUnverifiedReasons(['curation record not reviewed'])).toEqual(
      ['Curation not yet reviewed'],
    );
    expect(
      describeUnverified([
        'no curation record',
        'curation record not reviewed',
      ]),
    ).toBe('No curation record. Curation not yet reviewed.');
  });

  it('gives every reason a phrase of its own', () => {
    const phrases = unverifiedReasons.map(
      (reason) => describeUnverifiedReasons([reason])[0],
    );
    expect(phrases).not.toContain('Not yet verified');
    expect(new Set(phrases).size).toBe(10);
  });
});
