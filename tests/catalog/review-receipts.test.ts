// @vitest-environment node
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  listRuleValueReviews,
  parseCuration,
} from '../../scripts/catalog/curation';
import {
  listLedgerReviews,
  parseIdentityLedger,
} from '../../scripts/catalog/everythingpath-identities';
import ledgerData from '../../scripts/catalog/everythingpath-identities.json';
import {
  grantedSpellMapPath,
  listGrantedSpellReviews,
  parseGrantedSpellMap,
} from '../../scripts/catalog/granted-spells';
import {
  listTraitClassSkillChoiceReviews,
  parseTraitClassSkillChoiceList,
} from '../../scripts/catalog/trait-class-skill-choices';
import traitChoiceListData from '../../scripts/catalog/reviewed-trait-class-skill-choices.json';
import {
  listReviewedPcgenRecordReviews,
  parseReviewedPcgenRecords,
} from '../../scripts/catalog/reviewed-pcgen-records';
import pcgenRecordsData from '../../scripts/catalog/reviewed-pcgen-records.json';
import { pcgenPin } from '../../scripts/catalog/inventory';
import { listSection15Reviews } from '../../scripts/catalog/legal/section15-confirmations';
import {
  describeReviewRun,
  findReceiptProblems,
  hashReport,
  parseReviewReceipts,
  recordReviewReceipt,
  reviewReportsDirectory,
  type ReviewedRecord,
  type ReviewRun,
} from '../../scripts/catalog/review-receipts';
import {
  hashStructureSource,
  listStructureReviews,
  type StructureRecord,
} from '../../scripts/catalog/structure-curation';
import { draftedSection15 } from './section15-drafted';
import {
  p6RulesReview,
  repo,
  p6Run,
  runFile,
  reportsDirectory,
  reportSha256s,
  ledger,
  receipts,
  listLiveRecords,
  perfectScholar,
  p6Ids,
  findRecord,
  findProblemsWith,
  apg,
  apgLines,
  safeShotSha256,
  recordStepHarness,
} from './review-receipts-harness';

/**
 * Review receipts and the records they bind (ledger decisions, structure
 * records, Section 15 confirmations), recording a review, and the record
 * step's promotions (the P6 decisions, mixed selections, granted spells,
 * class-skill choices, reviewed PCGen records, rule values).
 */
describe('review receipts (#757)', () => {
  it('binds every checked record to a recorded review whose report the repo holds', () => {
    expect(findProblemsWith({})).toEqual([]);
  });

  it('records the #716 P6 rules review over its 31 separate-identities decisions', () => {
    const receipt = receipts.receipts.find(
      ({ runId }) => runId === p6RulesReview.runId,
    );
    expect(receipt?.reportSha256).toBe(p6RulesReview.reportSha256);
    const covered = receipt?.covers.map(({ id }) => id) ?? [];
    expect(covered).toHaveLength(31);
    const underP6 = listLiveRecords().filter(
      ({ review }) =>
        review.status === 'checked' && review.receipt === p6RulesReview.runId,
    );
    expect(underP6.map(({ id }) => id).sort()).toEqual([...covered].sort());
    expect(findRecord(underP6, perfectScholar).sources).toEqual([
      {
        subject:
          'pcgen:campaign_setting/inner_sea_intrigue/isi_abilities_class.lst#monk archetype ~ perfect scholar',
        sourceSha256:
          '785b97b0f293b00880af753b2bd1470a3dfa639be7fb285e720251ec2338e9c4',
      },
      {
        subject:
          'pcgen:campaign_setting/inner_sea_intrigue/support/isi_abilities_class_pu.lst#unchained monk archetype ~ perfect scholar',
        sourceSha256:
          'd6c577c773ea2fa0067ecc05acdd53e38aba598222150ad6e950a1834d6724d8',
      },
    ]);
  });

  it('commits the report byte for byte as the run wrote it', async () => {
    expect(
      await readFile(join(reportsDirectory, `${p6RulesReview.runId}.md`)),
    ).toEqual(await readFile(new URL('report.md', p6Run)));
  });

  it('fails a receipt whose report copy is missing or differs', () => {
    // P6's copy only; every other receipt keeps its committed copy.
    const reportsWithP6 = (sha256?: string) => {
      const reports = new Map(reportSha256s);
      if (sha256 === undefined) reports.delete(p6RulesReview.runId);
      else reports.set(p6RulesReview.runId, sha256);
      return reports;
    };
    expect(findProblemsWith({ reports: reportsWithP6() })).toEqual([
      `Review ${p6RulesReview.runId} has no report copy in ${reviewReportsDirectory}.`,
    ]);
    expect(
      findProblemsWith({
        reports: reportsWithP6(hashReport('A forged report.')),
      }),
    ).toEqual([
      `Review ${p6RulesReview.runId}'s report copy does not match its receipt.`,
    ]);
  });

  it('refuses a checked decision without a receipt', () => {
    const withoutReceipt = structuredClone(ledgerData);
    const [decision] = withoutReceipt.variantDecisions;
    if (decision) Reflect.deleteProperty(decision.review, 'receipt');
    expect(() => parseIdentityLedger(withoutReceipt)).toThrow();
  });

  it('fails a receipt that names a review no receipt records', () => {
    expect(
      findProblemsWith({
        edit: (records) => {
          const record = findRecord(records, perfectScholar);
          if (record.review.status === 'checked')
            record.review = {
              ...record.review,
              receipt: 'reviewer-20261018-081620-1216173',
            };
        },
      }),
    ).toEqual([
      `${perfectScholar} names review reviewer-20261018-081620-1216173, which review-receipts.json doesn't record.`,
    ]);
  });

  it('fails a receipt that does not cover the decision', () => {
    // P6's receipt without Perfect Scholar; every other receipt as committed.
    const data = {
      receipts: receipts.receipts.map((receipt) =>
        receipt.runId === p6RulesReview.runId
          ? {
              ...receipt,
              covers: receipt.covers.filter(({ id }) => id !== perfectScholar),
            }
          : receipt,
      ),
    };
    expect(findProblemsWith({ data })).toEqual([
      `Review ${p6RulesReview.runId} doesn't cover ${perfectScholar}.`,
    ]);
  });

  it('fails a decision whose source hashes or payload changed since its review', () => {
    // As if a pin bump re-bound Perfect Scholar to its Unchained row's hash.
    expect(
      findProblemsWith({
        edit: (records) => {
          const [original, unchained] = findRecord(
            records,
            perfectScholar,
          ).sources;
          if (original && unchained)
            original.sourceSha256 = unchained.sourceSha256;
        },
      }),
    ).toEqual([
      `Review ${p6RulesReview.runId} saw ${perfectScholar} with other source hashes than it holds now.`,
    ]);
    // As if the two keys swapped records after the review.
    const swapped = structuredClone(ledger);
    const decision = swapped.variantDecisions.find(
      (candidate) =>
        candidate.decision === 'separate-identities' &&
        candidate.identities[0]?.externalKey ===
          'everythingpath/monk-perfect-scholar',
    );
    if (decision?.decision === 'separate-identities') {
      const [first, second] = decision.identities;
      if (first && second)
        [first.externalKey, second.externalKey] = [
          second.externalKey,
          first.externalKey,
        ];
    }
    expect(
      findReceiptProblems({
        records: listLedgerReviews(swapped),
        receipts,
        reportSha256s,
      }),
    ).toEqual([
      `Review ${p6RulesReview.runId} saw ${perfectScholar} with another decision than it holds now.`,
    ]);
  });

  // #716 P10a: a Section 15 confirmation, checked as the record step would
  // check it after Sol's attribution review. The run is a stand-in.
  describe('a Section 15 confirmation', () => {
    const id = 'section15-confirmation PZO9451';
    const run = {
      runId: 'reviewer-20261020-000000-1',
      reportSha256: hashReport('A stand-in attribution review.'),
    };
    /** The drafted confirmations with PZO9451 checked under the run, after `edit`. */
    const problemsOf = ({
      edit = () => undefined,
      recorded = true,
    }: {
      edit?: (confirmation: { waivedHoldIds: string[] }) => void;
      recorded?: boolean;
    }) => {
      const { confirmations, registry } = draftedSection15();
      const seen = findRecord(
        listSection15Reviews({ confirmations, registry }),
        id,
      );
      const confirmation = confirmations.find(({ code }) => code === 'PZO9451');
      if (!confirmation) throw new Error('No PZO9451 confirmation.');
      confirmation.review = {
        status: 'checked',
        reviewedBy: 'Sol (AI review) for the owner',
        reviewedOn: '2026-10-20',
        receipt: run.runId,
      };
      edit(confirmation);
      return findReceiptProblems({
        records: listSection15Reviews({ confirmations, registry }),
        receipts: {
          receipts: recorded
            ? [
                {
                  ...run,
                  covers: [
                    {
                      id,
                      sources: seen.sources,
                      payloadSha256: seen.payloadSha256,
                    },
                  ],
                },
              ]
            : [],
        },
        reportSha256s: new Map([[run.runId, run.reportSha256]]),
      });
    };

    it('passes while its receipt covers it as reviewed', () => {
      expect(problemsOf({})).toEqual([]);
    });

    it('fails without a recorded receipt', () => {
      expect(problemsOf({ recorded: false })).toEqual([
        `${id} names review ${run.runId}, which review-receipts.json doesn't record.`,
      ]);
    });

    it('fails once its payload changed since the review', () => {
      expect(
        problemsOf({
          edit: (confirmation) => {
            confirmation.waivedHoldIds = confirmation.waivedHoldIds.slice(1);
          },
        }),
      ).toEqual([
        `Review ${run.runId} saw ${id} with another decision than it holds now.`,
      ]);
    });
  });

  it('refuses a receipt without its report hash', () => {
    expect(() =>
      parseReviewReceipts({
        receipts: [{ runId: p6RulesReview.runId, covers: [] }],
      }),
    ).toThrow();
  });
});

describe('a structure record (#716 plan §6)', () => {
  const safeShotId = `structure everythingpath/fighter-archer-safe-shot [] sha256:${safeShotSha256}`;
  const safeShot = (review: Record<string, string>, settles = 'Safe Shot') =>
    parseCuration({
      records: [],
      structures: [
        {
          externalKey: 'everythingpath/fighter-archer-safe-shot',
          sourceSha256: safeShotSha256,
          fields: {},
          noMechanics: true,
          resolves: [
            {
              kind: 'ownedFeature',
              id: `pcgen:${apg}#Fighter Archer ~ ${settles}`,
            },
          ],
          rationale:
            'APG p.104: not provoking attacks of opportunity with a bow is not calculated on the sheet.',
          ...review,
        },
      ],
    }).structures ?? [];
  const checked = {
    status: 'checked',
    reviewedBy: 'Sol (AI review) for the owner',
    reviewedOn: '2026-10-18',
    receipt: p6RulesReview.runId,
  };

  it('is identified by its entry, fields and source hash', () => {
    const [record] = listStructureReviews(safeShot({ status: 'drafted' }));
    expect(record).toMatchObject({
      id: safeShotId,
      sources: [
        {
          subject: 'everythingpath/fighter-archer-safe-shot',
          sourceSha256: safeShotSha256,
        },
      ],
      review: { status: 'drafted' },
    });
  });

  it('binds what it settles: another settled item invalidates its receipt', () => {
    const [record] = listStructureReviews(safeShot({ status: 'drafted' }));
    if (!record) throw new Error('No record.');
    const covers = [
      {
        id: record.id,
        sources: record.sources,
        payloadSha256: record.payloadSha256,
      },
    ];
    const data = {
      receipts: [{ ...p6RulesReview, covers }],
    };
    const problemsOf = (settles: string) =>
      findReceiptProblems({
        records: listStructureReviews(safeShot(checked, settles)),
        receipts: data,
        reportSha256s,
      });
    expect(problemsOf('Safe Shot')).toEqual([]);
    expect(problemsOf('Trick Shot')).toEqual([
      `Review ${p6RulesReview.runId} saw ${safeShotId} with another decision than it holds now.`,
    ]);
  });

  it('carries a receipt exactly when checked', () => {
    expect(() => safeShot({ ...checked, receipt: 'not a run' })).toThrow();
    expect(() =>
      safeShot({
        status: 'checked',
        reviewedBy: checked.reviewedBy,
        reviewedOn: checked.reviewedOn,
      }),
    ).toThrow(/"path": \[\s*"structures",\s*0,\s*"receipt"\s*\]/);
    expect(() =>
      safeShot({ status: 'drafted', receipt: p6RulesReview.runId }),
    ).toThrow('Unrecognized key: \\"receipt\\"');
  });

  it('types the receipt as required exactly when checked', () => {
    type Checked = Extract<StructureRecord, { status: 'checked' }>;
    type Drafted = Extract<StructureRecord, { status: 'drafted' }>;
    expectTypeOf<Checked['receipt']>().toEqualTypeOf<string>();
    expectTypeOf<Drafted>().not.toHaveProperty('receipt');
    expectTypeOf<Extract<ReviewRun, { kind: 'legacy' }>>().not.toHaveProperty(
      'evidence',
    );
    expectTypeOf<
      Extract<ReviewRun, { kind: 't3' }>['evidence']
    >().not.toEqualTypeOf<undefined>();
  });
});

describe('recording a review (runbook, drafted to checked)', () => {
  const p6RunState = {
    kind: 'legacy' as const,
    ...p6RulesReview,
    reviewedBy: 'Sol (AI review) for the owner',
    reviewedOn: '2026-10-18',
  };

  it('reads the reviewer run: its id, report hash, reviewer and date', async () => {
    expect(
      describeReviewRun({
        meta: await runFile('meta'),
        exit: await runFile('exit'),
        report: await runFile('report.md'),
      }),
    ).toEqual(p6RunState);
  });

  it('refuses a run that is no finished cross-model review', async () => {
    const meta = await runFile('meta');
    const report = await runFile('report.md');
    expect(() =>
      describeReviewRun({
        meta: meta.replace('role=reviewer', 'role=implementer'),
        exit: '0\n',
        report,
      }),
    ).toThrow('is not a reviewer run');
    expect(() => describeReviewRun({ meta, exit: '1\n', report })).toThrow(
      'did not finish with exit 0',
    );
    expect(() => describeReviewRun({ meta, exit: '0\n', report: '' })).toThrow(
      'has no report',
    );
  });

  // The P6 decisions as an implementer writes them: drafted.
  const listDraftedRecords = () => {
    const drafted = structuredClone(ledger);
    for (const decision of drafted.variantDecisions)
      if (decision.review.status === 'checked') {
        const { rationale, evidence } = decision.review;
        decision.review = { status: 'drafted', rationale, evidence };
      }
    return listLedgerReviews(drafted);
  };
  const record = ({
    records = listDraftedRecords(),
    ids = [perfectScholar],
    seen = listDraftedRecords(),
    recorded = { receipts: [] },
    run = p6RunState,
  }: {
    records?: ReviewedRecord[];
    ids?: string[];
    seen?: ReviewedRecord[];
    recorded?: typeof receipts;
    run?: typeof p6RunState;
  }) => recordReviewReceipt({ records, receipts: recorded, run, ids, seen });

  it('flips a drafted decision to checked under the run', () => {
    const records = listDraftedRecords();
    record({ records });
    expect(findRecord(records, perfectScholar).review).toEqual({
      status: 'checked',
      reviewedBy: 'Sol (AI review) for the owner',
      reviewedOn: '2026-10-18',
      receipt: p6RulesReview.runId,
    });
  });

  it('adds a record the review covered to its receipt later', () => {
    const records = listDraftedRecords();
    const rest = p6Ids().filter((id) => id !== perfectScholar);
    const first = record({ records, ids: rest });
    const later = record({ records, recorded: first });
    const byId = new Map(
      receipts.receipts[0]?.covers.map((cover) => [cover.id, cover]),
    );
    expect(later).toEqual({
      receipts: [
        {
          ...p6RulesReview,
          covers: [...rest, perfectScholar].map((id) => byId.get(id)),
        },
      ],
    });
    expect(() =>
      record({
        recorded: first,
        run: { ...p6RunState, reportSha256: hashReport('Another report.') },
      }),
    ).toThrow(`Review ${p6RulesReview.runId} is recorded with another report.`);
  });

  it('refuses an unknown record, a checked one, or one changed since the review saw it', () => {
    expect(() =>
      record({ ids: ['separate-identities everythingpath/none'] }),
    ).toThrow('No reviewed record separate-identities everythingpath/none.');
    expect(() => record({ records: listLiveRecords() })).toThrow(
      `${perfectScholar} is already checked under review ${p6RulesReview.runId}.`,
    );
    expect(() => record({ seen: [] })).toThrow(
      `Review ${p6RulesReview.runId} didn't see ${perfectScholar}.`,
    );
    const seen = listDraftedRecords();
    const [original, unchained] = findRecord(seen, perfectScholar).sources;
    if (original && unchained) original.sourceSha256 = unchained.sourceSha256;
    expect(() => record({ seen })).toThrow(
      `${perfectScholar} has other source hashes than review ${p6RulesReview.runId} saw.`,
    );
  });
});
describe('the record step command (catalog-record-review.ts)', () => {
  const {
    command,
    draftReview,
    ledgerReviews,
    snapshotRun,
    draftedCheckout,
    writeIds,
    snapshotTree,
    mixedCuration,
    aco,
    withConfirmation,
    chaosDomain,
    draftedMap,
    writeMap,
    grantedSpellCheckout,
  } = recordStepHarness();
  it('promotes the drafted P6 decisions into exactly the committed ledger, receipt and report', async () => {
    const { root, runDir } = await draftedCheckout();
    const { stdout: listed } = await command('--list', '--root', root);
    expect(listed).toContain(`drafted\t-\t${perfectScholar}\n`);
    await command(
      '--run',
      runDir,
      '--ids',
      await writeIds(root, p6Ids()),
      '--root',
      root,
    );
    const at = (path: string) => readFile(join(root, path));
    const committed = (path: string) => readFile(join(repo, path));
    const format = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
    const reportPath = `${reviewReportsDirectory}/${p6RulesReview.runId}.md`;
    expect(await at(reportPath)).toEqual(await committed(reportPath));
    // The committed ledger holds records later reviews checked: the rebuild
    // is the committed file, as the record step writes it, with every review
    // that P6's receipt doesn't name drafted, as this checkout has them.
    const ledgerPath = 'scripts/catalog/everythingpath-identities.json';
    const committedLedger = (await committed(ledgerPath)).toString('utf8');
    const p6Only = JSON.parse(committedLedger) as typeof ledgerData;
    expect(format(p6Only)).toBe(committedLedger);
    for (const record of ledgerReviews(p6Only))
      if (record.review.receipt !== p6RulesReview.runId) draftReview(record);
    expect((await at(ledgerPath)).toString('utf8')).toBe(format(p6Only));
    // The committed receipts hold later reviews' too: the rebuild is the
    // committed file, as the record step writes it, with P6's receipt alone.
    const receiptsPath = 'scripts/catalog/review-receipts.json';
    const committedReceipts = (await committed(receiptsPath)).toString('utf8');
    const { receipts: all } = JSON.parse(committedReceipts) as {
      receipts: { runId: string }[];
    };
    expect(format({ receipts: all })).toBe(committedReceipts);
    expect((await at(receiptsPath)).toString('utf8')).toBe(
      format({
        receipts: all.filter(({ runId }) => runId === p6RulesReview.runId),
      }),
    );
    await expect(
      command('--verify', '--root', root, '--runs', join(root, 'runs')),
    ).resolves.toMatchObject({
      stdout: expect.stringContaining('1 receipts verified.\n'),
    });
  });
  it('settles the actual mapped Safe Shot feature in the mixed fixture', async () => {
    const { readPcgenFixtureTree } = await import('./pcgen-716-tree');
    const { buildEffectiveView } =
      await import('../../scripts/catalog/pcgen/effective');
    const { mapArchetypeFeature } =
      await import('../../scripts/catalog/pcgen/archetypes');
    const { applyStructureCuration } =
      await import('../../scripts/catalog/structure-curation');
    const tree = await readPcgenFixtureTree([apg]);
    const effective = [...buildEffectiveView(tree).records.values()].find(
      ({ record }) => record.locator.key === 'Fighter Archer ~ Safe Shot',
    );
    if (!effective) throw new Error('No pinned Safe Shot feature.');
    const subject = mapArchetypeFeature({
      effective,
      externalKey: 'everythingpath/fighter-archer-safe-shot',
    });
    const data = parseCuration(mixedCuration());
    const checked = {
      ...data,
      structures: data.structures?.map((record) => ({
        ...record,
        status: 'checked' as const,
        reviewedBy: 'Synthetic fixture',
        reviewedOn: '2026-10-23',
        receipt: p6RulesReview.runId,
      })),
    };
    const reportOf = (data: ReturnType<typeof parseCuration>) =>
      applyStructureCuration({
        subjects: [subject],
        items: [],
        ownedFeatures: [
          {
            externalKey: subject.entry.externalKey,
            sourceSha256: subject.sourceSha256,
            locator: subject.locator,
            owner: `pcgen:${apg}#Fighter Archetype ~ Archer`,
          },
        ],
        data,
        variantDecisions: [],
      });
    const report = reportOf(checked);
    expect(report.passed).toBe(true);
    expect(report.unreviewedFeatures).toEqual([]);
    expect(report.held).toEqual([]);
    expect(subject.locator).toBe(`pcgen:${apg}#Fighter Archer ~ Safe Shot`);
    expect(data.structures?.[0]?.sourceSha256).toBe(subject.sourceSha256);
    const ownerPart = (line: number) => ({
      source: {
        source: 'pcgen' as const,
        locator: { file: apg, line, key: 'Fighter Archetype ~ Archer' },
      },
      text: apgLines[line - 1] ?? '',
    });
    const ownerHash = hashStructureSource([ownerPart(2102), ownerPart(3667)]);
    for (const changes of [
      { externalKey: 'everythingpath/fighter-archer' },
      { sourceSha256: ownerHash },
      {
        resolves: [
          {
            kind: 'ownedFeature' as const,
            id: `pcgen:${apg}#Archer ~ Safe Shot`,
          },
        ],
      },
    ]) {
      const rejected = reportOf({
        ...checked,
        structures: checked.structures?.map((record) => ({
          ...record,
          ...changes,
        })),
      });
      expect(rejected.passed).toBe(false);
      expect(
        rejected.unreviewedFeatures.map((feature) => feature.locator),
      ).toEqual([subject.locator]);
      expect(rejected.held).toEqual([
        'everythingpath/fighter-archer-safe-shot',
      ]);
    }
  });
  it('rejects formatter-invalid mixed ledger/structure promotion without changing any byte or directory', async () => {
    const curation = mixedCuration({ duplicateAlias: true });
    // Structural validation accepts this; the writer's alias invariant rejects it.
    expect(() => parseCuration(curation)).not.toThrow();
    const { root, runDir } = await draftedCheckout({ curation });
    const structureIds = listStructureReviews(
      parseCuration(curation).structures ?? [],
    ).map(({ id }) => id);
    const ids = await writeIds(root, [...p6Ids(), ...structureIds]);
    const before = await snapshotTree(root);
    await expect(
      command('--run', runDir, '--ids', ids, '--root', root),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('Situation alias'),
    });
    expect(await snapshotTree(root)).toEqual(before);
  });
  it('successfully records a valid mixed ledger/structure selection', async () => {
    const curation = mixedCuration();
    const { root, runDir } = await draftedCheckout({ curation });
    const structureIds = listStructureReviews(
      parseCuration(curation).structures ?? [],
    ).map(({ id }) => id);
    await command(
      '--run',
      runDir,
      '--ids',
      await writeIds(root, [...p6Ids(), ...structureIds]),
      '--root',
      root,
    );
    const recorded = parseReviewReceipts(
      JSON.parse(
        await readFile(
          join(root, 'scripts/catalog/review-receipts.json'),
          'utf8',
        ),
      ),
    );
    expect(recorded.receipts[0]?.covers.map(({ id }) => id)).toEqual([
      ...p6Ids(),
      ...structureIds,
    ]);
    expect(
      parseCuration(
        JSON.parse(
          await readFile(
            join(root, 'scripts/catalog/reviewed-curation.json'),
            'utf8',
          ),
        ),
      ).structures?.[0]?.status,
    ).toBe('checked');
    await expect(
      command('--verify', '--root', root, '--runs', join(root, 'runs')),
    ).resolves.toMatchObject({
      stdout: expect.stringContaining('1 receipts verified.'),
    });
  });
  it.each([
    { name: 'empty', ids: [], error: 'lists no record' },
    {
      name: 'duplicate',
      ids: [perfectScholar, perfectScholar],
      error: 'nonempty and unique',
    },
  ])(
    'rejects $name selected IDs without any writes',
    async ({ ids, error }) => {
      const { root, runDir } = await draftedCheckout();
      const idsFile = await writeIds(root, ids);
      const before = await snapshotTree(root);
      await expect(
        command('--run', runDir, '--ids', idsFile, '--root', root),
      ).rejects.toMatchObject({ stderr: expect.stringContaining(error) });
      expect(await snapshotTree(root)).toEqual(before);
    },
  );

  it('writes nothing when the ledger is inconsistent once the records are checked', async () => {
    const { root, runDir } = await draftedCheckout();
    const before = await readFile(
      join(root, 'scripts/catalog/everythingpath-identities.json'),
    );
    await expect(
      command(
        '--run',
        runDir,
        '--ids',
        await writeIds(root, [perfectScholar]),
        '--root',
        root,
      ),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        'no checked separate-identities decision',
      ),
    });
    expect(
      await readFile(
        join(root, 'scripts/catalog/everythingpath-identities.json'),
      ),
    ).toEqual(before);
    await expect(readdir(join(root, reviewReportsDirectory))).rejects.toThrow();
  });

  it('verifies a confirmation against the OGL.txt of the checkout it records into', async () => {
    const { root, runDir } = await draftedCheckout({
      runId: snapshotRun,
      before: withConfirmation,
    });
    // The committed ledger, whose P6 decisions are checked, so the ledger is
    // consistent once the confirmation alone is recorded.
    await cp(
      join(repo, 'scripts/catalog/everythingpath-identities.json'),
      join(root, 'scripts/catalog/everythingpath-identities.json'),
    );
    const recordAco = async () =>
      command(
        '--run',
        runDir,
        '--ids',
        await writeIds(root, ['section15-confirmation PZO9451']),
        '--root',
        root,
      );
    // This checkout pins the file; the selected one doesn't.
    await expect(recordAco()).rejects.toMatchObject({
      stderr: expect.stringContaining("pcgen:PZO9451's confirmation is stale."),
    });
    const pinned = join(
      root,
      'tests/fixtures/pinned/pcgen',
      pcgenPin.directory,
      aco,
    );
    await mkdir(join(pinned, '..'), { recursive: true });
    await writeFile(pinned, 'Another OGL.txt.\n');
    await expect(recordAco()).rejects.toMatchObject({
      stderr: expect.stringContaining("pcgen:PZO9451's confirmation is stale."),
    });
    await cp(
      join(repo, 'tests/fixtures/pinned/pcgen', pcgenPin.directory, aco),
      pinned,
    );
    await recordAco();
    const recorded = JSON.parse(
      await readFile(
        join(root, 'scripts/catalog/legal/section15-confirmations-716.json'),
        'utf8',
      ),
    );
    expect(recorded.confirmations[0].review).toMatchObject({
      status: 'checked',
      receipt: snapshotRun,
    });
    const registry = JSON.parse(
      await readFile(
        join(root, 'src/lib/catalog/data/section15-registry.json'),
        'utf8',
      ),
    );
    expect(registry['pcgen:PZO9451'].reviewStatus).toBe('reviewed');
  });

  it('promotes a drafted granted-spell record and writes only its review into the map', async () => {
    const { root, runDir } = await grantedSpellCheckout();
    const before = parseGrantedSpellMap(draftedMap());
    const [record] = listGrantedSpellReviews(before).filter(({ id }) =>
      id.startsWith(`granted-spells ${chaosDomain} `),
    );
    if (!record) throw new Error('No Chaos Domain map record.');
    await command(
      '--run',
      runDir,
      '--ids',
      await writeIds(root, [record.id]),
      '--root',
      root,
    );
    const recorded = parseGrantedSpellMap(
      JSON.parse(await readFile(join(root, grantedSpellMapPath), 'utf8')),
    );
    const checked = recorded.features.filter(
      ({ status }) => status === 'checked',
    );
    expect(checked.map(({ featureKey }) => featureKey)).toEqual([chaosDomain]);
    expect(checked[0]).toMatchObject({ receipt: snapshotRun });
    // The rest of the map is as it was.
    expect(
      recorded.features.filter(({ featureKey }) => featureKey !== chaosDomain),
    ).toEqual(
      before.features.filter(({ featureKey }) => featureKey !== chaosDomain),
    );
    expect(recorded.optionOwners).toEqual(before.optionOwners);
  });

  it('refuses a granted-spell record whose body hash moved since the review started', async () => {
    const { root, runDir } = await grantedSpellCheckout();
    const map = draftedMap();
    const [first] = map.features;
    if (!first) throw new Error('The committed map has no record.');
    const id = `granted-spells ${first.featureKey} sha256:${first.bodySha256}`;
    first.bodySha256 = 'f'.repeat(64);
    await writeMap(root, map);
    await expect(
      command(
        '--run',
        runDir,
        '--ids',
        await writeIds(root, [id]),
        '--root',
        root,
      ),
    ).rejects.toMatchObject({ stderr: expect.stringContaining(id) });
  });

  // trait-cs: the class-skill choice list's records are promoted the same way.
  it('promotes a drafted class-skill choice record and writes only its review into the list', async () => {
    const listPath = 'scripts/catalog/reviewed-trait-class-skill-choices.json';
    // The committed list with every record drafted, whether or not the record
    // step has checked it since.
    const draftedList = structuredClone(traitChoiceListData);
    for (const record of draftedList.traits) {
      for (const field of ['reviewedBy', 'reviewedOn', 'receipt'])
        delete (record as Record<string, unknown>)[field];
      record.status = 'drafted';
    }
    const checkout = await draftedCheckout({
      runId: snapshotRun,
      before: async (root) => {
        await mkdir(join(root, 'scripts/catalog'), { recursive: true });
        await writeFile(
          join(root, listPath),
          `${JSON.stringify(draftedList, null, 2)}\n`,
        );
      },
    });
    const { root, runDir } = checkout;
    await cp(
      join(repo, 'scripts/catalog/everythingpath-identities.json'),
      join(root, 'scripts/catalog/everythingpath-identities.json'),
    );
    const before = parseTraitClassSkillChoiceList(draftedList);
    const [record] = listTraitClassSkillChoiceReviews(structuredClone(before));
    if (!record) throw new Error('No class-skill choice record.');
    await command(
      '--run',
      runDir,
      '--ids',
      await writeIds(root, [record.id]),
      '--root',
      root,
    );
    const recorded = parseTraitClassSkillChoiceList(
      JSON.parse(await readFile(join(root, listPath), 'utf8')),
    );
    const [first, ...rest] = recorded.traits;
    expect(first).toMatchObject({ status: 'checked', receipt: snapshotRun });
    expect(rest).toEqual(before.traits.slice(1));
  });

  // cavalier-master-tactician: the reviewed PCGen records are promoted the same way.
  it('promotes a drafted reviewed PCGen record and writes only its review into the list', async () => {
    const listPath = 'scripts/catalog/reviewed-pcgen-records.json';
    // The committed list with every record drafted, whether or not the record
    // step has checked it since.
    const draftedList = structuredClone(pcgenRecordsData);
    for (const record of draftedList.records) {
      for (const field of ['reviewedBy', 'reviewedOn', 'receipt'])
        delete (record as Record<string, unknown>)[field];
      record.status = 'drafted';
    }
    const checkout = await draftedCheckout({
      runId: snapshotRun,
      before: async (root) => {
        await mkdir(join(root, 'scripts/catalog'), { recursive: true });
        await writeFile(
          join(root, listPath),
          `${JSON.stringify(draftedList, null, 2)}\n`,
        );
      },
    });
    const { root, runDir } = checkout;
    await cp(
      join(repo, 'scripts/catalog/everythingpath-identities.json'),
      join(root, 'scripts/catalog/everythingpath-identities.json'),
    );
    const before = parseReviewedPcgenRecords(draftedList);
    const [record] = listReviewedPcgenRecordReviews(structuredClone(before));
    if (!record) throw new Error('No reviewed PCGen record.');
    await command(
      '--run',
      runDir,
      '--ids',
      await writeIds(root, [record.id]),
      '--root',
      root,
    );
    const recorded = parseReviewedPcgenRecords(
      JSON.parse(await readFile(join(root, listPath), 'utf8')),
    );
    const [first, ...rest] = recorded.records;
    expect(first).toMatchObject({ status: 'checked', receipt: snapshotRun });
    expect(rest).toEqual(before.records.slice(1));
  });

  // stats-d1: a rule-value record in the overlay is promoted the same way.
  it('promotes a drafted rule-value record and writes only its review into the overlay', async () => {
    const ruleValue = (externalKey: string) => ({
      externalKey,
      descriptionSha256: 'a'.repeat(64),
      outputs: [
        {
          kind: 'ruleValue',
          ruleValue: { kind: 'dice', die: 6, amount: { rows: {} } },
        },
      ],
      rationale: 'Fixture rule-value record.',
      status: 'drafted',
    });
    const curation = {
      records: [],
      situations: [],
      ruleValues: [ruleValue('pf1/first'), ruleValue('pf1/second')],
    };
    const { root, runDir } = await draftedCheckout({
      runId: snapshotRun,
      curation,
    });
    await cp(
      join(repo, 'scripts/catalog/everythingpath-identities.json'),
      join(root, 'scripts/catalog/everythingpath-identities.json'),
    );
    const before = parseCuration(curation);
    const [record] = listRuleValueReviews(
      structuredClone(before.ruleValues ?? []),
    );
    if (!record) throw new Error('No rule-value record.');
    expect(record.id).toBe(`rule-value pf1/first sha256:${'a'.repeat(64)}`);
    await command(
      '--run',
      runDir,
      '--ids',
      await writeIds(root, [record.id]),
      '--root',
      root,
    );
    const recorded = parseCuration(
      JSON.parse(
        await readFile(
          join(root, 'scripts/catalog/reviewed-curation.json'),
          'utf8',
        ),
      ),
    );
    const [first, ...rest] = recorded.ruleValues ?? [];
    expect(first).toMatchObject({ status: 'checked', receipt: snapshotRun });
    expect(rest).toEqual(before.ruleValues?.slice(1));
  });

  // stats-d3 fix r1: two records each within the limit, over it together.
  it('refuses to check a rule-value record that cannot apply beside its entry’s other checked record, writing nothing; one beside a drafted record is checked', async () => {
    const hash = 'a'.repeat(64);
    const sixteenDice = {
      externalKey: 'pf1/first',
      descriptionSha256: hash,
      outputs: Array.from({ length: 16 }, () => ({
        kind: 'ruleValue',
        ruleValue: { kind: 'dice', die: 6, amount: { rows: {} } },
      })),
      rationale: 'Fixture rule-value record.',
      status: 'drafted',
    };
    const perDay = {
      ...sixteenDice,
      outputs: [
        {
          kind: 'ruleValue',
          ruleValue: {
            kind: 'dailyMaximum',
            key: 'classFeat_first',
            unit: 'uses',
            amount: 1,
          },
        },
      ],
    };
    const curation = {
      records: [],
      situations: [],
      ruleValues: [sixteenDice, perDay],
    };
    const diceId = `rule-value pf1/first sha256:${hash}`;
    const perDayId = `rule-value pf1/first per-day sha256:${hash}`;
    const checkout = async () => {
      const made = await draftedCheckout({ runId: snapshotRun, curation });
      await cp(
        join(repo, 'scripts/catalog/everythingpath-identities.json'),
        join(made.root, 'scripts/catalog/everythingpath-identities.json'),
      );
      return made;
    };
    const overlayPath = 'scripts/catalog/reviewed-curation.json';

    const both = await checkout();
    const before = await readFile(join(both.root, overlayPath));
    await expect(
      command(
        '--run',
        both.runDir,
        '--ids',
        await writeIds(both.root, [diceId, perDayId]),
        '--root',
        both.root,
      ),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        `${perDayId} cannot apply beside ${diceId}: together they give 17 rule values, and an entry stores at most 16.`,
      ),
    });
    expect(await readFile(join(both.root, overlayPath))).toEqual(before);
    await expect(
      readdir(join(both.root, reviewReportsDirectory)),
    ).rejects.toMatchObject({ code: 'ENOENT' });

    const alone = await checkout();
    await command(
      '--run',
      alone.runDir,
      '--ids',
      await writeIds(alone.root, [perDayId]),
      '--root',
      alone.root,
    );
    const recorded = parseCuration(
      JSON.parse(await readFile(join(alone.root, overlayPath), 'utf8')),
    );
    expect(recorded.ruleValues?.map(({ status }) => status)).toEqual([
      'drafted',
      'checked',
    ]);
  });
});
