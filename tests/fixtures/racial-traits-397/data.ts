import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';
import { curationSchema } from '../../../scripts/catalog/curation';

function snapshot(name: string): unknown {
  return JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
}
const strings = z.array(z.string());
const source = z.object({
  repo: z.literal('pf1-content'),
  path: z.string(),
  sha256: z.string(),
});
const comparison = z.object({
  path: z.string(),
  line: z.number(),
  literalRow: z.string(),
  comparisonFileSha256: z.string(),
  comparisonLineSha256: z.string(),
  book: z.string().nullable(),
  appliesToRootBody: z.boolean(),
  completeDirectComparison: z.boolean(),
  evidenceRole: z.string(),
  // PCGen Core Essentials support rows name no SOURCELONG book.
  publicationAnchor: z
    .object({
      path: z.string(),
      line: z.number(),
      text: z.string(),
      sha256: z.string(),
    })
    .nullable(),
});
// The PRD capture's Advanced Race Guide paragraph for a trait.
const prdComparison = z.object({
  path: z.string(),
  pageSha256: z.string(),
  book: z.string(),
  heading: z.string(),
  literalParagraph: z.string(),
  paragraphText: z.string(),
  paragraphSha256: z.string(),
  wordDifferences: z.array(z.object({ pinned: z.string(), prd: z.string() })),
  textMatches: z.boolean(),
});
const binding = z.object({
  contentFingerprint: z.string(),
  mappingFingerprint: z.string(),
  evidenceFingerprints: z.record(z.string(), z.string()),
  noticeFingerprints: z.record(z.string(), z.string()),
});
const held = z.object({
  externalKey: z.string(),
  name: z.string(),
  kind: z.literal('racialTrait'),
  racialTraitKind: z.enum(['std', 'alt', 'substd', 'subrace']),
  // #328 S4-B admits this batch's Half-Elf, Elf, Gnome and Halfling standard
  // traits.
  disposition: z.enum(['held', 'admitted']),
  assessmentStatus: z.enum(['unresolved', 'confirmed']),
  source,
  descriptionSha256: z.string(),
  citedSources: z.array(
    z.object({ book: z.string(), pages: z.string().optional() }),
  ),
  requiredNotices: strings,
  noticeRequirementsComplete: z.boolean(),
  evidenceId: z.string(),
  rationale: z.string(),
  holdIds: strings,
  noticeHoldIds: strings,
  sourceFields: z.record(z.string(), z.unknown()),
  comparison: comparison.nullable(),
  prdComparison: prdComparison.nullable(),
  additionalComparisonLeads: z.array(comparison),
  rejectedRootComparisonEvidence: z.array(comparison),
  inheritedRuleComparisonEvidence: z.array(comparison),
  inheritedRuleNotices: z.array(
    z.object({ book: z.string(), rule: z.string(), location: z.string() }),
  ),
  inheritedRuleUnresolvedOrigins: strings,
  linkedContentReview: z.array(
    z.object({
      externalKey: z.string(),
      name: z.string(),
      repo: z.enum(['pf1', 'pf1-content']),
      path: z.string(),
      sha256: z.string(),
      // Pinned Invisibility keeps its page as a number (pages: 301).
      sources: z.array(
        z.object({
          id: z.string(),
          pages: z.union([z.string(), z.number()]).optional(),
        }),
      ),
    }),
  ),
  currentBinding: binding,
  mechanicsReview: z.object({
    descriptionText: z.string(),
    racialTraitReview: z.object({
      kind: z.string(),
      raceKeys: strings,
      races: strings,
      standard: z.boolean(),
      replaces: strings,
      unresolvedReplacements: strings,
      folderPath: strings,
    }),
    curationRecords: curationSchema.shape.records,
    outstandingCalculations: strings,
    proseOnlyRules: z.string(),
    sourceDiscrepancies: strings,
    proficiencyReview: z.object({
      grants: z.array(z.unknown()),
      outstandingFacts: strings,
      review: z.string(),
    }),
    prerequisiteReview: z.object({
      authoredText: z.string(),
      normalizedAtoms: z.array(z.unknown()),
      publishedClauses: z.array(z.object({ text: z.string() })),
      outstandingFacts: strings,
    }),
  }),
});
const excluded = z.object({
  externalKey: z.string(),
  name: z.string(),
  kind: z.enum(['folder', 'raceBuilderTrait']),
  folderPath: strings,
  disposition: z.literal('excluded'),
  rawKey: z.string(),
  source,
  contractReason: z.string(),
});
export const review = z
  .object({
    reviewedBy: z.string(),
    reviewedOn: z.string(),
    counts: z.record(z.string(), z.number()),
    comparisonSources: z.object({
      pcgenFiles: z.array(source.omit({ repo: true })),
    }),
    noticeRequirements: z.array(
      z.object({
        book: z.string(),
        registryKeys: strings,
        holdId: z.string().nullable(),
        candidates: strings,
      }),
    ),
    candidates: z.array(z.union([held, excluded])),
  })
  .parse(snapshot('../../../scripts/catalog/legal/racial-traits-397.json'));
export const assessedTraits = review.candidates.flatMap((row) =>
  row.disposition === 'excluded' ? [] : [row],
);
export const heldTraits = assessedTraits.filter(
  (row) => row.disposition === 'held',
);
export const admittedTraits = assessedTraits.filter(
  (row) => row.disposition === 'admitted',
);
export const excludedRows = review.candidates.flatMap((row) =>
  row.disposition === 'excluded' ? [row] : [],
);
// The full-corpus preview's entries for the batch's racial traits, and the
// entries in their content closures (replaced traits, linked bodies and, for
// the two heritages that replace an ability score trait, that trait and its
// race), which the assessments bind against.
export const preview = z
  .object({
    entries: z.array(importedCatalogEntrySchema),
    closure: z.array(importedCatalogEntrySchema),
  })
  .parse(snapshot('preview.json'));

// Folder records above the batch's records and the pinned race records the
// importer binds them to (by folder name), from the shared store.
const supportFiles = [
  'pf1-content/src/pf-racial-traits/Aasimar_U1wK0c0t4RdHqzbU.yaml',
  'pf1-content/src/pf-racial-traits/Ability_Score_fACLjvCyrx6Mqexi.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_1XqRrec5Ag0n0yM2.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_1alOGz6KPvdQB44E.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_1g77OsLX5gc6iYzL.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_3j4O8P5rShZBFdtY.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_HwNbN3nPop23QbOP.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_I5gERPgPEuK7wW5I.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_KP5QLO1nPv43LcXI.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_MvyTbqu9jQCwjLwg.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_NGOeal2hFl2QMV92.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_NhAdmRaVFFow7cN0.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_PZxrk9JzfGnFGo9P.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_QR0A1ZzY2Alo3j3S.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_QbRefHZlsADS7c1G.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_RXJPpac5E8PiR8Qt.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_d4bGSdKKLFXKTGuf.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_fEstcJ0Ou5ny9rZm.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_fS6BttTRyYNJW2om.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_hGoMGOJhqQPRBkaV.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_sq4D60KUCFjxImNV.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_zwPcPvkCuK621YpA.yaml',
  'pf1-content/src/pf-racial-traits/Android_VYojkt9Hjlz5f7Oh.yaml',
  'pf1-content/src/pf-racial-traits/Aphorite_A7tmAPKpiadhaETe.yaml',
  'pf1-content/src/pf-racial-traits/Aquatic_Elf_okm3ObSW9p7cjzKT.yaml',
  'pf1-content/src/pf-racial-traits/Astomoi_lL4OLlxglFqgdSZu.yaml',
  'pf1-content/src/pf-racial-traits/Base_Speed_Ogs5hSl1Cu4m6hnG.yaml',
  'pf1-content/src/pf-racial-traits/Changeling_27mzZu02Xb9oYCqD.yaml',
  'pf1-content/src/pf-racial-traits/Core_Races_pnpTI7Hk2nvitW6j.yaml',
  'pf1-content/src/pf-racial-traits/Defense_O32ChmG5bmi7g6OL.yaml',
  'pf1-content/src/pf-racial-traits/Drow_ixeSTuEadPDMGyRU.yaml',
  'pf1-content/src/pf-racial-traits/Duergar_WqGT0UXfEhYH82xO.yaml',
  'pf1-content/src/pf-racial-traits/Duskwalker_9rgAk3kusF0mIBqN.yaml',
  'pf1-content/src/pf-racial-traits/Dwarf_LMZrndmHCbiQ1DZ7.yaml',
  'pf1-content/src/pf-racial-traits/Elf_0Z7LoIqKFrjU0YGN.yaml',
  'pf1-content/src/pf-racial-traits/Feat_and_Skill_VvjAmbtqRiEyxX0b.yaml',
  'pf1-content/src/pf-racial-traits/Fetchling_HZkPgVdKUdcECvIX.yaml',
  'pf1-content/src/pf-racial-traits/Gathlain_AlkCBC1auwyzpQjs.yaml',
  'pf1-content/src/pf-racial-traits/Ghoran_viOFOo6JNlLdvo7Q.yaml',
  'pf1-content/src/pf-racial-traits/Gnome_LxJrzlRjZraZ1lA5.yaml',
  'pf1-content/src/pf-racial-traits/Green_Martian_FXD9eTa4oocJE80N.yaml',
  'pf1-content/src/pf-racial-traits/Grindylow_VdVeZbAwasLj2Tjs.yaml',
  'pf1-content/src/pf-racial-traits/Half_Elf_KEDQumXdts1m9M82.yaml',
  'pf1-content/src/pf-racial-traits/Half_Orc_tYMfoPflPK79Z4pj.yaml',
  'pf1-content/src/pf-racial-traits/Halfling_roBc1BFV5m9SIwv7.yaml',
  'pf1-content/src/pf-racial-traits/Human_jQEHwNadJH7G0gdq.yaml',
  'pf1-content/src/pf-racial-traits/Ifrit_tP7ySRN7A6YDD0v1.yaml',
  'pf1-content/src/pf-racial-traits/Kitsune_GAl4uN1LEs0n1Klg.yaml',
  'pf1-content/src/pf-racial-traits/Lashunta_AdTesmy8kKMUm2wL.yaml',
  'pf1-content/src/pf-racial-traits/Magical_1OWNsl3OovdHDbuP.yaml',
  'pf1-content/src/pf-racial-traits/Monkey_Goblin_4mraNuLbTgXENeoV.yaml',
  'pf1-content/src/pf-racial-traits/Movement_JqYNnxJSPBm6aC5k.yaml',
  'pf1-content/src/pf-racial-traits/Offensive_PIVj1MVMqsVbaJAX.yaml',
  'pf1-content/src/pf-racial-traits/Orang_Pendak_ii2SnNaUnihoY5FU.yaml',
  'pf1-content/src/pf-racial-traits/Oread_4VSNnpW9YGpm4xC0.yaml',
  'pf1-content/src/pf-racial-traits/Other_Races_Iwrwzoq5uWYKNHty.yaml',
  'pf1-content/src/pf-racial-traits/Race_Builder_DrDUkvfcwfcx6AP9.yaml',
  'pf1-content/src/pf-racial-traits/Racial_Qualities_dfwclEVJRJgllnC2.yaml',
  'pf1-content/src/pf-racial-traits/Racial_Traits_AGG9Qo3pfg5Z2aag.yaml',
  'pf1-content/src/pf-racial-traits/Reptoid_sZRgX4epaXZlzJMR.yaml',
  'pf1-content/src/pf-racial-traits/Sahuagin_x0iFYdEXqaCpnp3I.yaml',
  'pf1-content/src/pf-racial-traits/Senses_OXY295BxKtSQhWDC.yaml',
  'pf1-content/src/pf-racial-traits/Standard_1J9wfQY8uCA3Q5oM.yaml',
  'pf1-content/src/pf-racial-traits/Standard_2fWyJqNdoARq7kA2.yaml',
  'pf1-content/src/pf-racial-traits/Standard_3DZDrCBIKjspaS47.yaml',
  'pf1-content/src/pf-racial-traits/Standard_CxdqYljBam86Yw6g.yaml',
  'pf1-content/src/pf-racial-traits/Standard_H4spRGnLY4FijVWz.yaml',
  'pf1-content/src/pf-racial-traits/Standard_OYizHQkCQbWFXC6A.yaml',
  'pf1-content/src/pf-racial-traits/Standard_Tt3r64jgYimPthNv.yaml',
  'pf1-content/src/pf-racial-traits/Standard_XQyOZECH4JHvQaTE.yaml',
  'pf1-content/src/pf-racial-traits/Standard_hgugkB6LKBczuduh.yaml',
  'pf1-content/src/pf-racial-traits/Standard_lWQAddC6GTZXQbIx.yaml',
  'pf1-content/src/pf-racial-traits/Standard_s3XA0F2kVN0SkumI.yaml',
  'pf1-content/src/pf-racial-traits/Standard_t1SEV5Ghmi1mwBVG.yaml',
  'pf1-content/src/pf-racial-traits/Standard_wjLQScur1APMahQY.yaml',
  'pf1-content/src/pf-racial-traits/Standard_zz227zlxQWeF2YQr.yaml',
  'pf1-content/src/pf-racial-traits/Strix_E7eUF79r7CBaD5z0.yaml',
  'pf1-content/src/pf-racial-traits/Subrace_Standard_3vSL52yi5JvMMdeU.yaml',
  'pf1-content/src/pf-racial-traits/Subrace_Standard_o1nSxKcbPwxbxxD5.yaml',
  'pf1-content/src/pf-racial-traits/Subrace_Standard_oNR6jnt8GAB22AHY.yaml',
  'pf1-content/src/pf-racial-traits/Subrace_Standard_rKQpQ1hrf04fhyGJ.yaml',
  'pf1-content/src/pf-racial-traits/Subrace_mvGTb4RoFxrIpHMF.yaml',
  'pf1-content/src/pf-racial-traits/Subraces_M7504nqBO2IVR3Kd.yaml',
  'pf1-content/src/pf-racial-traits/Subraces_WuhUXGK47ZMvbYw3.yaml',
  'pf1-content/src/pf-racial-traits/Subraces_dWD4t4Bq2TdYAE3h.yaml',
  'pf1-content/src/pf-racial-traits/Subraces_u5YT5PXPHcpM2AvO.yaml',
  'pf1-content/src/pf-racial-traits/Svirfneblin_xMLSSmnedPlnDveR.yaml',
  'pf1-content/src/pf-racial-traits/Sylph_jfeaqYaSoor0KWpj.yaml',
  'pf1-content/src/pf-racial-traits/Triaxian_tL7HqBZpoUPwqWYc.yaml',
  'pf1-content/src/pf-racial-traits/Wayang_q4gMBqtzNrTyECTJ.yaml',
  'pf1-content/src/pf-racial-traits/Weakness_ufTjeTfin9cK3MtE.yaml',
  'pf1-content/src/pf-racial-traits/Wyvaran_dmyFia1i5pfWjmWy.yaml',
  'pf1-content/src/pf-racial-traits/Yaddithian_P62rxEcFwpYPinoO.yaml',
  'pf1/packs/races/aasimar.FHY3oIk5zSOFncJH.yaml',
  'pf1/packs/races/android.9Fe6mDt0oP52m6Jl.yaml',
  'pf1/packs/races/aquatic-elf.E6bHjOMkRatMQwbR.yaml',
  'pf1/packs/races/astomoi.JxLvkHxDYY98HcAH.yaml',
  'pf1/packs/races/changeling.9FBT6uqlRgaw9gug.yaml',
  'pf1/packs/races/drow.yLaDS5HGbwtgpkbP.yaml',
  'pf1/packs/races/duergar.eV9USBGHA1rYd5P7.yaml',
  'pf1/packs/races/duskwalker.HKRRq2tdZVEGlmHG.yaml',
  'pf1/packs/races/dwarf.nEltI9y37rKJTeWo.yaml',
  'pf1/packs/races/elf.NgIhxRI0axrf3fcO.yaml',
  'pf1/packs/races/fetchling.6BKIB9hjKwSJorAZ.yaml',
  'pf1/packs/races/gathlain.ubx4PIbRqmVT93Ds.yaml',
  'pf1/packs/races/ghoran.2mWMyKiPWk6Y8cNx.yaml',
  'pf1/packs/races/gnome.efwHEwjvL9Z94MJI.yaml',
  'pf1/packs/races/green-martian.YxeSVRbG7lfQybfr.yaml',
  'pf1/packs/races/grindylow.Lt4ZP5GCinGvTfnF.yaml',
  'pf1/packs/races/half-elf.cCepRrfH5SalFfT4.yaml',
  'pf1/packs/races/half-orc.dCAXgdA6Db1Z3ccz.yaml',
  'pf1/packs/races/halfling.Hf31mrYb3uucNyLO.yaml',
  'pf1/packs/races/human.e6IaBxKgMxy1yKlr.yaml',
  'pf1/packs/races/ifrit.TPHe88Yhy4SsDpKo.yaml',
  'pf1/packs/races/kitsune.GAoJIy6ycj3OovQT.yaml',
  'pf1/packs/races/lashunta-female.7aDvyO68K8hm58Qm.yaml',
  'pf1/packs/races/lashunta-male.g9GYFtD8FOxtUGvJ.yaml',
  'pf1/packs/races/monkey-goblin.aCyDEyMB5PKJAuTi.yaml',
  'pf1/packs/races/orang-pendak.m5cdZ1RG7c1mkhqF.yaml',
  'pf1/packs/races/oread.4qEXPDlfIj1cIvCe.yaml',
  'pf1/packs/races/reptoid.YCCdi4OEC4WuzelM.yaml',
  'pf1/packs/races/sahuagin.TbZmYyDUxRn9baWy.yaml',
  'pf1/packs/races/skinwalker.apWl6JIJ8U8p0azq.yaml',
  'pf1/packs/races/strix.MF8vCjLIGTmJl3Mo.yaml',
  'pf1/packs/races/svirfneblin.fX9F2amW2BcYoHwb.yaml',
  'pf1/packs/races/sylph.pbX1xj9Z0ZhUfKvZ.yaml',
  'pf1/packs/races/triaxian.sMHXS804w3UdTVKH.yaml',
  'pf1/packs/races/wayang.Vaf5bV3wpk24pVt2.yaml',
  'pf1/packs/races/wyvaran.4i8qiF2QnGnPOyKC.yaml',
  'pf1/packs/races/yaddithian.sXIQ3MFLInN9SF7m.yaml',
];
// The batch's records and linked bodies (checked against their recorded
// digests), plus the pf-racial-traits folder records above them and their
// pinned race records, which the importer needs to bind each trait to its race.
const pinned = [
  ...review.candidates.map((row) => row.source),
  ...assessedTraits.flatMap((row) => row.linkedContentReview),
];
export const pinnedSha256 = Object.fromEntries(
  pinned.map((row) => [`${row.repo}/${row.path}`, row.sha256]),
);
export const pinnedFiles = [
  ...new Set([
    ...pinned.map((row) => `${row.repo}/${row.path}`),
    ...supportFiles,
  ]),
];
