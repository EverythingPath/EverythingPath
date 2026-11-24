// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  computeFingerprint,
  createNoticeReadiness,
} from '../../scripts/catalog/admission';
import {
  findRegistryAliasProblems,
  foundryBooksOf,
} from '../../scripts/catalog/legal/registry-aliases';
import type { Section15Registry } from '../../src/lib/catalog/admission-schema';
import { createNoticeIndex } from '../../src/lib/catalog/resolve-notice';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { section15Registry } from '../../src/lib/catalog/section15-registry-data';
import { readPinned } from './pinned-sources';

// notice-alias-1 (2026-11-16, PRD #251): 37 books whose notice is already a
// reviewed pf1-content line titled as Foundry names the book, so only the
// product-code alias was missing (`docs/catalog-import/notice-alias-227.md`).
// An alias is a reviewed identity, not new text.
const books = foundryBooksOf(
  await readPinned('pf1', 'module/registry/sources.mjs'),
);

/** Each batch code and the hash of the pf1-content line it is aliased to. */
const aliased: Readonly<Record<string, string>> = {
  PZO1141: '31db42761e18ca436dd2d29a69dd92319d3dad63667a06b4f01f81d668d7e2db',
  PZO1136: 'e9d7fc2ea7ea729c11877199ea8072361b7accb29b61f33c35a6153da51fcad5',
  PZO9487: 'a8f3599419b7a015f0bb26776aea3e5f57ac6aaccfdd40031cf7edcb24e34b2f',
  PZO9492: 'a57590179e0fb49d7fd4bea6b8edeaa8772634a48bfa707895630d847c078d27',
  PZO1139: '5a7b36cc37599ef615b10eb9593d4e72011305a2d03bd019988fa87fb717695d',
  PZO9485: '838859a1640d7ad7a03c7d3bd927c9d6546eaba559d208650816c7bfdad6f22c',
  PZO9275: 'd59b8a895cfbc7806f018ecd79940f8aa498fd27cb73d56780891ca89e07b955',
  PZO9408: 'b2470bd2414513b46ee9976822d3b740a5222c8d23a95a263b5a95426ae5ad5e',
  PZO9486: '855e97134187c77e9c9420151f1ddbbb2ba4693f50bc405c549632ad59b821ab',
  PZO9235: 'd2b873cf831ba3c7c3cb32382b76c84272367a10150bbc31ce0c95e3fb6dca3d',
  PZO9293: '5745e0c3c42a55138c2973104a4149b46c931b9e4ba1600ab8346f70cfec9173',
  PZO9484: '42054efa723992232068f9ebb0f06fa969ff32c21d594b05098465f11cdbed09',
  PZO9490: '42d13b5697ed6b9f54a77b102cb12fd81f0c91790e9ec6a66ee09a3d9f857f19',
  PZO9285: '71460df91d3e7d9bdc2be5eb9d7359ae095330019af6f93f98096303a8ae958a',
  PZO9284: '93741e21d25ecfb4bcddbc4a7327b9930270dc095024b353d3a2fe5248f1f0f2',
  PZO9283: 'fa29a3ebcb21440de2a9363e273a623e136a888e3a7178bb19b6d12f57cb7f3b',
  PZO9286: 'd176e960db083ad2c6f1bee6a786ccb0b1e4d6d4c1b294f0a5bd91774c29c19b',
  PZO9295: 'c0b739c83c3a3aa4090e7231829e88150de1a8cbaf1232f7e5a76158463b49ae',
  PZO9246: '9234bebbfeed709c64f70c12c17ae18f16b41d61970a18d01d99fb59d5604d07',
  PZO9210: '6883d43d8c18cdb3604689b75396082cfee5aead4a8eb8bc8427bbb427b86a9f',
  PZO9298: '8b0b2d9d59b78f9ec5a78bff71b4eae5b534e59677dddd694354cdc96fe9cdc6',
  PZO9276: '68317a01184b98b22c8393ebe64d0d9c0988b2bbce5d25c1290c90f50fc89e33',
  PZO9244: '072a665d99814fbe62110c67aec9b38a741175aff12ff6405c22e9e2feefb668',
  PZO9289: '9c92993f12dc80c2c9c3458ea35bbc06faf94c9c8594b2821d83ed813542bd2d',
  PZO92109: '3d247194d154036da2e9ea2c9c490fcf5b611b1e5c1d98cb8acbdfae18352f25',
  PZO9273: '7c34edff6f94287604fbda75522efb0eba6e52f7ca887461111c7851677920d6',
  'PZO9000-13E':
    'b3d1aca48c244dabab8c917e933c1b990f2d71d75f4009ebcf2d5321f3b70262',
  PZO9274: 'c3d847a54c162b5fed7bdb0b0a55f07b5f16dabebeb881daa2f13dabeb6af593',
  PZO9403: '412e4027c4cb1c877079829c6eb836aedc71f84deb2c8e19e6d76061fad4ed4d',
  PZO9238: '596ab229b011c01ad4c2f963dc99b539973ee2d39d0caceac69418dd3e6b2e14',
  PZO9257: 'c956d809f0c44779b23e9f92d71fdf8f20fe319afbeaa542c04bf88c0af85c5c',
  PZO9270: 'c71414f6ea1d6100b8ccb1673439dd481ace41f11719f58ff10bd65d0f6d0336',
  PZO9261: 'a2f9721fa2f41f87f04bbd69cdce8dbff568b75062638df3954c1f37daef6938',
  PZO9291: '943f3d739eea6e161b7ad0db9badad18c18db6123435287241ab3e60408db884',
  PZO9287: 'ff94fa6f14e0f8e897bb95aefadff0237a2348add2715cbc1c51fdd5a47a43a3',
  PZO9227: '658bcecd623a64c9c2b150bfa49a190b51d2b99b052a633493a25a93638c078b',
  PZO9265: 'd5e5de6bfc6ff29a5528b9e813a027cc5782993044938dea69f1fd317af63ee8',
};
const line = (hash: string) => `pf1-content/notice/${hash}`;
const batchLine = (code: string) =>
  `Product-code alias ${code} (notice-alias-1, 2026-11-16): `;

/** The committed Registry without this batch's aliases and their provenance lines. */
const withoutBatch: Section15Registry = Object.fromEntries(
  Object.entries(section15Registry).map(([key, record]) => {
    const codes = record.aliases.filter((alias) =>
      record.provenance.some((entry) => entry.startsWith(batchLine(alias))),
    );
    return [
      key,
      {
        ...record,
        aliases: record.aliases.filter((alias) => !codes.includes(alias)),
        provenance: record.provenance.filter(
          (entry) => !codes.some((code) => entry.startsWith(batchLine(code))),
        ),
      },
    ];
  }),
);

describe('notice-alias-1: same-title reviewed Registry aliases', () => {
  it('aliases exactly the 37 batch codes, one record each', () => {
    const batch = Object.entries(section15Registry).flatMap(([key, record]) =>
      record.aliases
        .filter((alias) =>
          record.provenance.some((entry) => entry.startsWith(batchLine(alias))),
        )
        .map((alias) => [alias, key] as const),
    );
    expect(Object.fromEntries(batch)).toEqual(
      Object.fromEntries(
        Object.entries(aliased).map(([code, hash]) => [code, line(hash)]),
      ),
    );
    expect(batch).toHaveLength(37);
  });

  it.each(Object.entries(aliased))(
    '%s names a reviewed line titled as Foundry names the book, in its year',
    (code, hash) => {
      const record = section15Registry[line(hash)];
      expect(record?.reviewStatus).toBe('reviewed');
      expect(record?.checkedAgainst).toBe('pf1-content');
      expect(record?.aliases).toEqual([code]);
      // The alias rule alone, on this record alone.
      expect(
        findRegistryAliasProblems({
          registry: { [line(hash)]: record! },
          books,
        }),
      ).toEqual([]);
      // The alias is the record's only change: without it, the code names no record.
      expect(withoutBatch[line(hash)]?.aliases).toEqual([]);
      expect(createNoticeIndex({ registry: withoutBatch }).get(code)).toBe(
        undefined,
      );
      expect(
        createNoticeReadiness({ registry: section15Registry })(code),
      ).toEqual({ notices: [code], identity: 'reviewed', holds: [] });
    },
  );

  it('changes the notice reading of no book outside the batch', () => {
    const before = createNoticeReadiness({ registry: withoutBatch });
    const after = createNoticeReadiness({ registry: section15Registry });
    const identifiers = new Set([
      ...books.keys(),
      ...createNoticeIndex({ registry: section15Registry }).keys(),
      ...createNoticeIndex({ registry: withoutBatch }).keys(),
    ]);
    const changed = [...identifiers].filter(
      (identifier) =>
        JSON.stringify(before(identifier)) !==
        JSON.stringify(after(identifier)),
    );
    expect(changed.sort()).toEqual(Object.keys(aliased).sort());
  });

  it('binds every assessment of a batch code to its reviewed line, not to a missing notice', () => {
    const missing = computeFingerprint(null);
    const index = createNoticeIndex({ registry: section15Registry });
    const bound = reviewedAdmission.assessments.flatMap((assessment) =>
      Object.entries(assessment.noticeFingerprints)
        .filter(
          ([identifier]) =>
            Object.hasOwn(aliased, identifier) ||
            Object.values(aliased).some((hash) => identifier === line(hash)),
        )
        .map(([identifier, fingerprint]) => ({ identifier, fingerprint })),
    );
    // 461 bindings of the 37 codes and one of a record's own key.
    expect(bound).toHaveLength(462);
    for (const { identifier, fingerprint } of bound) {
      expect(fingerprint, identifier).not.toBe(missing);
      expect(fingerprint, identifier).toBe(
        computeFingerprint(index.get(identifier) ?? null),
      );
    }
  });
});
