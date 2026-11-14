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
  // #328 S4-A admits this batch's Human, Dwarf and Half-Orc standard traits.
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
  .parse(snapshot('../../../scripts/catalog/legal/racial-traits-391.json'));
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
// entries in their content closures (replaced traits, linked bodies and the
// bodies those reach), which the assessments bind against.
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
  'pf1-content/src/pf-racial-traits/Adaro_OAwtdUpYAjTJ1AQo.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_1XqRrec5Ag0n0yM2.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_1alOGz6KPvdQB44E.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_3Z2cUyMD0Y57p7YO.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_96UasAu9CBvgf5hT.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_I5gERPgPEuK7wW5I.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_MwigLwh0rjG0FsNO.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_NGOeal2hFl2QMV92.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_PZvJlelVbb79phHY.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_PZxrk9JzfGnFGo9P.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_QR0A1ZzY2Alo3j3S.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_RXJPpac5E8PiR8Qt.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_RzalfyOzV6EaGRvl.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_STxquJXw503JM504.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_d4bGSdKKLFXKTGuf.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_fEstcJ0Ou5ny9rZm.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_hGoMGOJhqQPRBkaV.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_mWu5e6p5urTpiqQ7.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_r1IZStLZfXmVsFqh.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_sq4D60KUCFjxImNV.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_wBK65SlE9iZ8jhHG.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_z5fIOFhJ1l9rCS0B.yaml',
  'pf1-content/src/pf-racial-traits/Astomoi_lL4OLlxglFqgdSZu.yaml',
  'pf1-content/src/pf-racial-traits/Cecaelia_dXeL3DD7E9H7ONvk.yaml',
  'pf1-content/src/pf-racial-traits/Changeling_27mzZu02Xb9oYCqD.yaml',
  'pf1-content/src/pf-racial-traits/Core_Races_pnpTI7Hk2nvitW6j.yaml',
  'pf1-content/src/pf-racial-traits/Deep_One_Hybrid_psuYMTF2CZGcl9ZE.yaml',
  'pf1-content/src/pf-racial-traits/Defense_O32ChmG5bmi7g6OL.yaml',
  'pf1-content/src/pf-racial-traits/Drow_ixeSTuEadPDMGyRU.yaml',
  'pf1-content/src/pf-racial-traits/Duergar_WqGT0UXfEhYH82xO.yaml',
  'pf1-content/src/pf-racial-traits/Duskwalker_9rgAk3kusF0mIBqN.yaml',
  'pf1-content/src/pf-racial-traits/Dwarf_LMZrndmHCbiQ1DZ7.yaml',
  'pf1-content/src/pf-racial-traits/Elf_0Z7LoIqKFrjU0YGN.yaml',
  'pf1-content/src/pf-racial-traits/Feat_and_Skill_VvjAmbtqRiEyxX0b.yaml',
  'pf1-content/src/pf-racial-traits/Ganzi_w1CBWJAdeUzckPR8.yaml',
  'pf1-content/src/pf-racial-traits/Gathlain_AlkCBC1auwyzpQjs.yaml',
  'pf1-content/src/pf-racial-traits/Gillman_m3MNeFYo6ZHhEq1Q.yaml',
  'pf1-content/src/pf-racial-traits/Gnome_LxJrzlRjZraZ1lA5.yaml',
  'pf1-content/src/pf-racial-traits/Goblin_O6rs7yvVrpAvi6FF.yaml',
  'pf1-content/src/pf-racial-traits/Grindylow_VdVeZbAwasLj2Tjs.yaml',
  'pf1-content/src/pf-racial-traits/Grippli_y3No4nnP5nx4jf7R.yaml',
  'pf1-content/src/pf-racial-traits/Half_Elf_KEDQumXdts1m9M82.yaml',
  'pf1-content/src/pf-racial-traits/Halfling_roBc1BFV5m9SIwv7.yaml',
  'pf1-content/src/pf-racial-traits/Human_jQEHwNadJH7G0gdq.yaml',
  'pf1-content/src/pf-racial-traits/Ifrit_tP7ySRN7A6YDD0v1.yaml',
  'pf1-content/src/pf-racial-traits/Kobold_70vPWRmINBsSQ90K.yaml',
  'pf1-content/src/pf-racial-traits/Language_UXlI3nAl6Peg1HRL.yaml',
  'pf1-content/src/pf-racial-traits/Lashunta_AdTesmy8kKMUm2wL.yaml',
  'pf1-content/src/pf-racial-traits/Locathah_fn3ISzG5o1dQ7EC7.yaml',
  'pf1-content/src/pf-racial-traits/Magical_1OWNsl3OovdHDbuP.yaml',
  'pf1-content/src/pf-racial-traits/Munavri_mObpPwXSbBNVoXRJ.yaml',
  'pf1-content/src/pf-racial-traits/Naiad_OHZg8sim2p5PHnsi.yaml',
  'pf1-content/src/pf-racial-traits/Offensive_PIVj1MVMqsVbaJAX.yaml',
  'pf1-content/src/pf-racial-traits/Other_Races_Iwrwzoq5uWYKNHty.yaml',
  'pf1-content/src/pf-racial-traits/Racial_Qualities_dfwclEVJRJgllnC2.yaml',
  'pf1-content/src/pf-racial-traits/Racial_Traits_AGG9Qo3pfg5Z2aag.yaml',
  'pf1-content/src/pf-racial-traits/Ratfolk_9KPG9fnmkN8bUNZ1.yaml',
  'pf1-content/src/pf-racial-traits/Reptoid_sZRgX4epaXZlzJMR.yaml',
  'pf1-content/src/pf-racial-traits/Rougarou_rDogS7oJu3Yt8TWP.yaml',
  'pf1-content/src/pf-racial-traits/Sahuagin_x0iFYdEXqaCpnp3I.yaml',
  'pf1-content/src/pf-racial-traits/Samsaran_WGGmNZdRqTXOPmgr.yaml',
  'pf1-content/src/pf-racial-traits/Senses_OXY295BxKtSQhWDC.yaml',
  'pf1-content/src/pf-racial-traits/Shabti_MN4QiTzzMKS4qO0e.yaml',
  'pf1-content/src/pf-racial-traits/Skinwalker_Yauhqdv1M3VrpYQr.yaml',
  'pf1-content/src/pf-racial-traits/Standard_1a9UeeKPwwMOMNoR.yaml',
  'pf1-content/src/pf-racial-traits/Standard_2fWyJqNdoARq7kA2.yaml',
  'pf1-content/src/pf-racial-traits/Standard_CfOTLvo8D5bPPSPB.yaml',
  'pf1-content/src/pf-racial-traits/Standard_Di9Bx0HIUosfwSOu.yaml',
  'pf1-content/src/pf-racial-traits/Standard_N3Yn4wWnzP8UwZp2.yaml',
  'pf1-content/src/pf-racial-traits/Standard_OYizHQkCQbWFXC6A.yaml',
  'pf1-content/src/pf-racial-traits/Standard_XQyOZECH4JHvQaTE.yaml',
  'pf1-content/src/pf-racial-traits/Standard_ZqhbmdIOaUZZ0XR2.yaml',
  'pf1-content/src/pf-racial-traits/Standard_aUftnyakUTetdxwJ.yaml',
  'pf1-content/src/pf-racial-traits/Standard_egPtrKyVhJWvKbJV.yaml',
  'pf1-content/src/pf-racial-traits/Standard_lWQAddC6GTZXQbIx.yaml',
  'pf1-content/src/pf-racial-traits/Standard_t1SEV5Ghmi1mwBVG.yaml',
  'pf1-content/src/pf-racial-traits/Standard_ujs1dsYedoyOtL7N.yaml',
  'pf1-content/src/pf-racial-traits/Standard_wyfyAeiz0xjzj8oj.yaml',
  'pf1-content/src/pf-racial-traits/Standard_yPR1r2nsCco06PKw.yaml',
  'pf1-content/src/pf-racial-traits/Standard_zbWzLBduWzGwPgLs.yaml',
  'pf1-content/src/pf-racial-traits/Standard_zz227zlxQWeF2YQr.yaml',
  'pf1-content/src/pf-racial-traits/Subrace_Standard_2Gz1809xjufRnaum.yaml',
  'pf1-content/src/pf-racial-traits/Subrace_Standard_V0AMHu01ZqnTvZD7.yaml',
  'pf1-content/src/pf-racial-traits/Subrace_Standard_uJ7gNM5P4XNcTc4z.yaml',
  'pf1-content/src/pf-racial-traits/Svirfneblin_xMLSSmnedPlnDveR.yaml',
  'pf1-content/src/pf-racial-traits/Sylph_jfeaqYaSoor0KWpj.yaml',
  'pf1-content/src/pf-racial-traits/Tengu_wfLwcDEpaxjHWcEW.yaml',
  'pf1-content/src/pf-racial-traits/Tiefling_IPPDGMZfb6Lfx9ij.yaml',
  'pf1-content/src/pf-racial-traits/Triton_yj7ChRz79eiCEIlh.yaml',
  'pf1-content/src/pf-racial-traits/Type_1OXMUAUKknfsmQAv.yaml',
  'pf1-content/src/pf-racial-traits/Undine_8zuQiFz3p29tdJKe.yaml',
  'pf1-content/src/pf-racial-traits/Vishkanya_3dgiIO3A3f0Ml8xt.yaml',
  'pf1-content/src/pf-racial-traits/Wayang_q4gMBqtzNrTyECTJ.yaml',
  'pf1-content/src/pf-racial-traits/Yaddithian_P62rxEcFwpYPinoO.yaml',
  'pf1/packs/races/aasimar.FHY3oIk5zSOFncJH.yaml',
  'pf1/packs/races/adaro.LAtTC2NPuqjTLEkn.yaml',
  'pf1/packs/races/astomoi.JxLvkHxDYY98HcAH.yaml',
  'pf1/packs/races/cecaelia.NhEPoXIZWOOunSH7.yaml',
  'pf1/packs/races/changeling.9FBT6uqlRgaw9gug.yaml',
  'pf1/packs/races/deep-one-hybrid.Z76GkfAvnzba4XDd.yaml',
  'pf1/packs/races/drow.yLaDS5HGbwtgpkbP.yaml',
  'pf1/packs/races/duergar.eV9USBGHA1rYd5P7.yaml',
  'pf1/packs/races/duskwalker.HKRRq2tdZVEGlmHG.yaml',
  'pf1/packs/races/dwarf.nEltI9y37rKJTeWo.yaml',
  'pf1/packs/races/elf.NgIhxRI0axrf3fcO.yaml',
  'pf1/packs/races/ganzi.QKrRHanuWwD4pu8Q.yaml',
  'pf1/packs/races/gathlain.ubx4PIbRqmVT93Ds.yaml',
  'pf1/packs/races/gillman.Gy4jOckBEwMjByga.yaml',
  'pf1/packs/races/gnome.efwHEwjvL9Z94MJI.yaml',
  'pf1/packs/races/grindylow.Lt4ZP5GCinGvTfnF.yaml',
  'pf1/packs/races/grippli.MSLlV9YnompTd6xp.yaml',
  'pf1/packs/races/half-elf.cCepRrfH5SalFfT4.yaml',
  'pf1/packs/races/halfling.Hf31mrYb3uucNyLO.yaml',
  'pf1/packs/races/human.e6IaBxKgMxy1yKlr.yaml',
  'pf1/packs/races/ifrit.TPHe88Yhy4SsDpKo.yaml',
  'pf1/packs/races/kitsune.GAoJIy6ycj3OovQT.yaml',
  'pf1/packs/races/kobold.LMNzbqGSRAFQFE2Y.yaml',
  'pf1/packs/races/lashunta-female.7aDvyO68K8hm58Qm.yaml',
  'pf1/packs/races/lashunta-male.g9GYFtD8FOxtUGvJ.yaml',
  'pf1/packs/races/locathah.WxPc1Nw2V3ohdl2x.yaml',
  'pf1/packs/races/merfolk.3lV30qfiQaWKB0sp.yaml',
  'pf1/packs/races/munavri.jhh6z3NZlImHjZ8H.yaml',
  'pf1/packs/races/naiad.TpfcHDjKatQL3XBl.yaml',
  'pf1/packs/races/ratfolk.rAKaCt6BW3rVv2kN.yaml',
  'pf1/packs/races/reptoid.YCCdi4OEC4WuzelM.yaml',
  'pf1/packs/races/rougarou.ZnRc2qF1ZfpajxEe.yaml',
  'pf1/packs/races/sahuagin.TbZmYyDUxRn9baWy.yaml',
  'pf1/packs/races/samsaran.aQ8RQYKVd2hqI4jh.yaml',
  'pf1/packs/races/shabti.H6tsZqHiaTOcFSOn.yaml',
  'pf1/packs/races/skinwalker.apWl6JIJ8U8p0azq.yaml',
  'pf1/packs/races/strix.MF8vCjLIGTmJl3Mo.yaml',
  'pf1/packs/races/svirfneblin.fX9F2amW2BcYoHwb.yaml',
  'pf1/packs/races/sylph.pbX1xj9Z0ZhUfKvZ.yaml',
  'pf1/packs/races/tengu.yAS41rHv0WzDmuRm.yaml',
  'pf1/packs/races/tiefling.nVjKDLZSRONzYm8f.yaml',
  'pf1/packs/races/triton.DQGhOq3M3uxTFKYO.yaml',
  'pf1/packs/races/undine.iqJvhd7NbmybUl0y.yaml',
  'pf1/packs/races/vishkanya.Yder5QR51sDl5X0n.yaml',
  'pf1/packs/races/wayang.Vaf5bV3wpk24pVt2.yaml',
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
