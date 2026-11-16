import { resolvePreviewReferences } from '../preview-references';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
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
  // #328 S4-B: Gnome Magic is confirmed but dependently omitted on the four
  // cantrips it links.
  disposition: z.enum(['held', 'admitted', 'dependently-omitted']),
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
  .parse(snapshot('../../../scripts/catalog/legal/racial-traits-393.json'));
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
export const preview = resolvePreviewReferences({
  raw: snapshot('preview.json'),
});

// Folder records above the batch's records and the pinned race records the
// importer binds them to (by folder name), from the shared store.
const supportFiles = [
  'pf1-content/src/pf-racial-traits/Aasimar_U1wK0c0t4RdHqzbU.yaml',
  'pf1-content/src/pf-racial-traits/Adaro_OAwtdUpYAjTJ1AQo.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_1XqRrec5Ag0n0yM2.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_7BVIiJLxMcXsI6IF.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_C4r4Wp69HHAX7XMo.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_HwNbN3nPop23QbOP.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_JuBq7kP20NXqHu1h.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_QbRefHZlsADS7c1G.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_RXJPpac5E8PiR8Qt.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_d4bGSdKKLFXKTGuf.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_hGoMGOJhqQPRBkaV.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_izvlhYC3B5BZD1Pm.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_mWu5e6p5urTpiqQ7.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_oDZJj9N4i2p4QUIT.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_sq4D60KUCFjxImNV.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_zwPcPvkCuK621YpA.yaml',
  'pf1-content/src/pf-racial-traits/Aphorite_A7tmAPKpiadhaETe.yaml',
  'pf1-content/src/pf-racial-traits/Changeling_27mzZu02Xb9oYCqD.yaml',
  'pf1-content/src/pf-racial-traits/Core_Races_pnpTI7Hk2nvitW6j.yaml',
  'pf1-content/src/pf-racial-traits/Defense_O32ChmG5bmi7g6OL.yaml',
  'pf1-content/src/pf-racial-traits/Dhampir_QPyW1vOWOSSxqWWv.yaml',
  'pf1-content/src/pf-racial-traits/Drow_ixeSTuEadPDMGyRU.yaml',
  'pf1-content/src/pf-racial-traits/Elf_0Z7LoIqKFrjU0YGN.yaml',
  'pf1-content/src/pf-racial-traits/Feat_and_Skill_VvjAmbtqRiEyxX0b.yaml',
  'pf1-content/src/pf-racial-traits/Fetchling_HZkPgVdKUdcECvIX.yaml',
  'pf1-content/src/pf-racial-traits/Ganzi_w1CBWJAdeUzckPR8.yaml',
  'pf1-content/src/pf-racial-traits/Gillman_m3MNeFYo6ZHhEq1Q.yaml',
  'pf1-content/src/pf-racial-traits/Goblin_O6rs7yvVrpAvi6FF.yaml',
  'pf1-content/src/pf-racial-traits/Green_Martian_FXD9eTa4oocJE80N.yaml',
  'pf1-content/src/pf-racial-traits/Grindylow_VdVeZbAwasLj2Tjs.yaml',
  'pf1-content/src/pf-racial-traits/Half_Elf_KEDQumXdts1m9M82.yaml',
  'pf1-content/src/pf-racial-traits/Half_Orc_tYMfoPflPK79Z4pj.yaml',
  'pf1-content/src/pf-racial-traits/Halfling_roBc1BFV5m9SIwv7.yaml',
  'pf1-content/src/pf-racial-traits/Hobgoblin_tOl1NTdtFOeDkRK7.yaml',
  'pf1-content/src/pf-racial-traits/Human_jQEHwNadJH7G0gdq.yaml',
  'pf1-content/src/pf-racial-traits/Kitsune_GAl4uN1LEs0n1Klg.yaml',
  'pf1-content/src/pf-racial-traits/Lashunta_AdTesmy8kKMUm2wL.yaml',
  'pf1-content/src/pf-racial-traits/Locathah_fn3ISzG5o1dQ7EC7.yaml',
  'pf1-content/src/pf-racial-traits/Magical_1OWNsl3OovdHDbuP.yaml',
  'pf1-content/src/pf-racial-traits/Merfolk_E9mTdkJuwxNmW94n.yaml',
  'pf1-content/src/pf-racial-traits/Movement_JqYNnxJSPBm6aC5k.yaml',
  'pf1-content/src/pf-racial-traits/Offensive_PIVj1MVMqsVbaJAX.yaml',
  'pf1-content/src/pf-racial-traits/Oread_4VSNnpW9YGpm4xC0.yaml',
  'pf1-content/src/pf-racial-traits/Other_Races_Iwrwzoq5uWYKNHty.yaml',
  'pf1-content/src/pf-racial-traits/Race_Builder_DrDUkvfcwfcx6AP9.yaml',
  'pf1-content/src/pf-racial-traits/Racial_Qualities_dfwclEVJRJgllnC2.yaml',
  'pf1-content/src/pf-racial-traits/Racial_Traits_AGG9Qo3pfg5Z2aag.yaml',
  'pf1-content/src/pf-racial-traits/Reptoid_sZRgX4epaXZlzJMR.yaml',
  'pf1-content/src/pf-racial-traits/Sahuagin_x0iFYdEXqaCpnp3I.yaml',
  'pf1-content/src/pf-racial-traits/Skinwalker_Yauhqdv1M3VrpYQr.yaml',
  'pf1-content/src/pf-racial-traits/Standard_07mYrADfuCRzN0E6.yaml',
  'pf1-content/src/pf-racial-traits/Standard_0safJrWJGu9FvC5n.yaml',
  'pf1-content/src/pf-racial-traits/Standard_1a9UeeKPwwMOMNoR.yaml',
  'pf1-content/src/pf-racial-traits/Standard_3DZDrCBIKjspaS47.yaml',
  'pf1-content/src/pf-racial-traits/Standard_8FVoYW1DHtypWyW6.yaml',
  'pf1-content/src/pf-racial-traits/Standard_8l8dbrq85930xouu.yaml',
  'pf1-content/src/pf-racial-traits/Standard_SXQa7R5j1fC4dn52.yaml',
  'pf1-content/src/pf-racial-traits/Standard_V8NqYeuTjc2CDfT3.yaml',
  'pf1-content/src/pf-racial-traits/Standard_ZqhbmdIOaUZZ0XR2.yaml',
  'pf1-content/src/pf-racial-traits/Standard_cwJ8fDUFMFRGqsJN.yaml',
  'pf1-content/src/pf-racial-traits/Standard_lGtOuDb5QxTmJ4OW.yaml',
  'pf1-content/src/pf-racial-traits/Standard_s3XA0F2kVN0SkumI.yaml',
  'pf1-content/src/pf-racial-traits/Standard_t1SEV5Ghmi1mwBVG.yaml',
  'pf1-content/src/pf-racial-traits/Standard_yuxMwwUD5XyQMkUe.yaml',
  'pf1-content/src/pf-racial-traits/Standard_zz227zlxQWeF2YQr.yaml',
  'pf1-content/src/pf-racial-traits/Strix_E7eUF79r7CBaD5z0.yaml',
  'pf1-content/src/pf-racial-traits/Subrace_Standard_0njM63yOJ0z2N0D9.yaml',
  'pf1-content/src/pf-racial-traits/Subrace_Standard_2Gz1809xjufRnaum.yaml',
  'pf1-content/src/pf-racial-traits/Subrace_Standard_oNR6jnt8GAB22AHY.yaml',
  'pf1-content/src/pf-racial-traits/Subraces_2hvOVmG4lyZ6PZ2G.yaml',
  'pf1-content/src/pf-racial-traits/Subraces_4NSgjZqYScI33X8K.yaml',
  'pf1-content/src/pf-racial-traits/Subraces_Drhj8jWJrmopXD5K.yaml',
  'pf1-content/src/pf-racial-traits/Subraces_dWD4t4Bq2TdYAE3h.yaml',
  'pf1-content/src/pf-racial-traits/Subraces_u5YT5PXPHcpM2AvO.yaml',
  'pf1-content/src/pf-racial-traits/Suli_2grfqw7hTZjurhUP.yaml',
  'pf1-content/src/pf-racial-traits/Sylph_jfeaqYaSoor0KWpj.yaml',
  'pf1-content/src/pf-racial-traits/Tengu_wfLwcDEpaxjHWcEW.yaml',
  'pf1-content/src/pf-racial-traits/Tiefling_IPPDGMZfb6Lfx9ij.yaml',
  'pf1-content/src/pf-racial-traits/Triaxian_tL7HqBZpoUPwqWYc.yaml',
  'pf1-content/src/pf-racial-traits/Triton_yj7ChRz79eiCEIlh.yaml',
  'pf1-content/src/pf-racial-traits/Type_1OXMUAUKknfsmQAv.yaml',
  'pf1-content/src/pf-racial-traits/Undine_8zuQiFz3p29tdJKe.yaml',
  'pf1-content/src/pf-racial-traits/Vine_Leshy_A10bGnJLwJi8CJF1.yaml',
  'pf1-content/src/pf-racial-traits/Wayang_q4gMBqtzNrTyECTJ.yaml',
  'pf1-content/src/pf-racial-traits/Wyvaran_dmyFia1i5pfWjmWy.yaml',
  'pf1-content/src/pf-racial-traits/Yaddithian_P62rxEcFwpYPinoO.yaml',
  'pf1/packs/races/aasimar.FHY3oIk5zSOFncJH.yaml',
  'pf1/packs/races/adaro.LAtTC2NPuqjTLEkn.yaml',
  'pf1/packs/races/aphorite.zlWiqUqxCajrZRe3.yaml',
  'pf1/packs/races/changeling.9FBT6uqlRgaw9gug.yaml',
  'pf1/packs/races/dhampir.puKk997wHX3kIRkR.yaml',
  'pf1/packs/races/drow.yLaDS5HGbwtgpkbP.yaml',
  'pf1/packs/races/dwarf.nEltI9y37rKJTeWo.yaml',
  'pf1/packs/races/elf.NgIhxRI0axrf3fcO.yaml',
  'pf1/packs/races/fetchling.6BKIB9hjKwSJorAZ.yaml',
  'pf1/packs/races/ganzi.QKrRHanuWwD4pu8Q.yaml',
  'pf1/packs/races/gillman.Gy4jOckBEwMjByga.yaml',
  'pf1/packs/races/gnome.efwHEwjvL9Z94MJI.yaml',
  'pf1/packs/races/green-martian.YxeSVRbG7lfQybfr.yaml',
  'pf1/packs/races/grindylow.Lt4ZP5GCinGvTfnF.yaml',
  'pf1/packs/races/half-elf.cCepRrfH5SalFfT4.yaml',
  'pf1/packs/races/half-orc.dCAXgdA6Db1Z3ccz.yaml',
  'pf1/packs/races/halfling.Hf31mrYb3uucNyLO.yaml',
  'pf1/packs/races/hobgoblin.19JcztRuEWbrOqQW.yaml',
  'pf1/packs/races/human.e6IaBxKgMxy1yKlr.yaml',
  'pf1/packs/races/lashunta-female.7aDvyO68K8hm58Qm.yaml',
  'pf1/packs/races/lashunta-male.g9GYFtD8FOxtUGvJ.yaml',
  'pf1/packs/races/locathah.WxPc1Nw2V3ohdl2x.yaml',
  'pf1/packs/races/merfolk.3lV30qfiQaWKB0sp.yaml',
  'pf1/packs/races/oread.4qEXPDlfIj1cIvCe.yaml',
  'pf1/packs/races/reptoid.YCCdi4OEC4WuzelM.yaml',
  'pf1/packs/races/sahuagin.TbZmYyDUxRn9baWy.yaml',
  'pf1/packs/races/skinwalker.apWl6JIJ8U8p0azq.yaml',
  'pf1/packs/races/strix.MF8vCjLIGTmJl3Mo.yaml',
  'pf1/packs/races/suli.Gtz5E4r6tg6spifD.yaml',
  'pf1/packs/races/sylph.pbX1xj9Z0ZhUfKvZ.yaml',
  'pf1/packs/races/tengu.yAS41rHv0WzDmuRm.yaml',
  'pf1/packs/races/tiefling.nVjKDLZSRONzYm8f.yaml',
  'pf1/packs/races/triaxian.sMHXS804w3UdTVKH.yaml',
  'pf1/packs/races/triton.DQGhOq3M3uxTFKYO.yaml',
  'pf1/packs/races/undine.iqJvhd7NbmybUl0y.yaml',
  'pf1/packs/races/vine-leshy.KMpuFun7YDFyuO8z.yaml',
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
