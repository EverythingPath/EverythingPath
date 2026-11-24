// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  committedSection15Confirmations,
  findSection15RegistryProblems,
  listSection15Reviews,
  type Section15Confirmation,
} from '../../scripts/catalog/legal/section15-confirmations';
import { recordReviewReceipt } from '../../scripts/catalog/review-receipts';
import {
  isPublishableNotice,
  reviewedAdmissionSchema,
} from '../../src/lib/catalog/admission-schema';
import { section15Registry } from '../../src/lib/catalog/section15-registry-data';
import { draftedSection15 } from './section15-drafted';

const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');

it('stores every notice trimmed, apart from PCGen’s blocks, which ship untrimmed', () => {
  for (const [code, { notice, checkedAgainst }] of Object.entries(
    section15Registry,
  ))
    if (checkedAgainst !== 'pcgen') expect(notice, code).toBe(notice.trim());
});

it('gives every hash-keyed notice the SHA-256 of its stored text', () => {
  const hashKeyed = Object.entries(section15Registry).flatMap(
    ([code, notice]) => {
      const hash = /^[\w-]+\/notice\/([0-9a-f]{64})$/.exec(code)?.[1];
      return hash ? [{ code, hash, notice: notice.notice }] : [];
    },
  );
  expect(hashKeyed.length).toBeGreaterThan(300);
  for (const { code, hash, notice } of hashKeyed)
    expect(sha256(notice), code).toBe(hash);
});

// #716 P10a, plan §7 "Publication contract".
describe('PCGen blocks in the Registry', () => {
  const code = 'PZO9451';
  // As the implementer wrote them; the record step may since have checked it.
  const asWritten = draftedSection15();
  const drafted = asWritten.registry[`pcgen:${code}`];
  if (!drafted) throw new Error('No pcgen:PZO9451 record.');
  const confirmation = asWritten.confirmations.find((row) => row.code === code);
  if (confirmation?.status !== 'matched')
    throw new Error('No matched PZO9451 confirmation.');
  const reviewed = {
    ...drafted,
    reviewStatus: 'reviewed' as const,
    checkedOn: '2026-10-20',
  };
  const checked: Section15Confirmation = {
    ...confirmation,
    review: {
      status: 'checked',
      reviewedBy: 'Sol (AI review) for the owner',
      reviewedOn: '2026-10-20',
      receipt: 'reviewer-20261020-000000-1',
    },
  };

  it('accepts a reviewed pcgen record with no candidate in view, and only one that names its confirmation', () => {
    expect(isPublishableNotice(reviewed)).toBe(true);
    expect(
      reviewedAdmissionSchema.shape.registry.safeParse({
        [`pcgen:${code}`]: reviewed,
      }).success,
    ).toBe(true);
    const unnamed = {
      ...reviewed,
      provenance: reviewed.provenance.filter(
        (line) => !line.startsWith('confirmation: '),
      ),
    };
    expect(isPublishableNotice(unnamed)).toBe(false);
    expect(
      reviewedAdmissionSchema.shape.registry.safeParse({
        [`pcgen:${code}`]: unnamed,
      }).success,
    ).toBe(false);
    // A drafted record is not publishable.
    expect(isPublishableNotice(drafted)).toBe(false);
  });

  it('is consistent with the committed confirmations', () => {
    expect(
      findSection15RegistryProblems({ registry: section15Registry }),
    ).toEqual([]);
  });

  it('fails the check for a pcgen record without a matched, current confirmation', () => {
    const registry = { ...section15Registry, [`pcgen:${code}`]: reviewed };
    const others = committedSection15Confirmations.filter(
      (row) => row.code !== code,
    );
    expect(
      findSection15RegistryProblems({
        registry,
        confirmations: [...others, checked],
      }),
    ).toEqual([]);
    expect(
      findSection15RegistryProblems({ registry, confirmations: others }),
    ).toContain(`pcgen:${code} has no confirmation.`);
    expect(
      findSection15RegistryProblems({
        registry,
        confirmations: [
          ...others,
          { ...checked, status: 'mismatch', mismatch: 'uncured-defect' },
        ],
      }),
    ).toContain(`pcgen:${code}'s confirmation is mismatch.`);
    expect(
      findSection15RegistryProblems({
        registry,
        confirmations: [...others, checked],
        currentSha256: () => '0'.repeat(64),
      }),
    ).toContain(`pcgen:${code}'s confirmation is stale.`);
    // Reviewed exactly when the confirmation is checked.
    expect(
      findSection15RegistryProblems({
        registry,
        confirmations: [...others, confirmation],
      }),
    ).toContain(`pcgen:${code} is reviewed but its confirmation is drafted.`);
  });
});

describe('recording a confirmation’s review (#757)', () => {
  it('checks the confirmation and makes its block reviewed on the review’s date', () => {
    const { confirmations, registry } = draftedSection15();
    const records = listSection15Reviews({ confirmations, registry });
    const id = 'section15-confirmation PZO9451';
    const seen = records.map(({ id, sources, payloadSha256 }) => ({
      id,
      sources,
      payloadSha256,
    }));
    const receipts = recordReviewReceipt({
      records,
      receipts: { receipts: [] },
      run: {
        kind: 'legacy',
        runId: 'reviewer-20261020-000000-1',
        reportSha256: 'a'.repeat(64),
        reviewedBy: 'Sol (AI review) for the owner',
        reviewedOn: '2026-10-20',
      },
      ids: [id],
      seen,
    });
    expect(receipts.receipts[0]?.covers.map((cover) => cover.id)).toEqual([id]);
    expect(
      confirmations.find(({ code }) => code === 'PZO9451')?.review,
    ).toMatchObject({
      status: 'checked',
      receipt: 'reviewer-20261020-000000-1',
    });
    expect(registry['pcgen:PZO9451']).toMatchObject({
      reviewStatus: 'reviewed',
      checkedOn: '2026-10-20',
    });
    expect(isPublishableNotice(registry['pcgen:PZO9451'])).toBe(true);
    expect(findSection15RegistryProblems({ registry, confirmations })).toEqual(
      [],
    );
    // Every other confirmation stays drafted, and its block unreviewed.
    expect(registry['pcgen:PZO1140']?.reviewStatus).toBe('unreviewed');
  });
});
