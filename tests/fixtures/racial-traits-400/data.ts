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
  // #328 S4-A: an unresolved origin the launch review resolved, and why.
  resolvedOrigins: z
    .array(
      z.object({
        origin: z.string(),
        resolution: z.string(),
        reviewedBy: z.string(),
        reviewedOn: z.string(),
      }),
    )
    .optional(),
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
  .parse(snapshot('../../../scripts/catalog/legal/racial-traits-400.json'));
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
  'pf1-content/src/pf-racial-traits/Ability_Score_gfLHMG7m7z8gAmQg.yaml',
  'pf1-content/src/pf-racial-traits/Adaro_OAwtdUpYAjTJ1AQo.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_1XqRrec5Ag0n0yM2.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_1g77OsLX5gc6iYzL.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_1oIneGLuXoO7VeNn.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_96UasAu9CBvgf5hT.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_HwNbN3nPop23QbOP.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_IyUQ79MttCnXeN09.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_JuBq7kP20NXqHu1h.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_KP5QLO1nPv43LcXI.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_M1lkxA7VFDzlRtIB.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_PVMoVc8yuZPm39Zq.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_PZxrk9JzfGnFGo9P.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_RXJPpac5E8PiR8Qt.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_Yu6sNWsnd5R2TDkF.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_fEstcJ0Ou5ny9rZm.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_r1IZStLZfXmVsFqh.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_sq4D60KUCFjxImNV.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_zwPcPvkCuK621YpA.yaml',
  'pf1-content/src/pf-racial-traits/Android_VYojkt9Hjlz5f7Oh.yaml',
  'pf1-content/src/pf-racial-traits/Aquatic_Elf_okm3ObSW9p7cjzKT.yaml',
  'pf1-content/src/pf-racial-traits/Catfolk_Pump2OQujqB4q4A4.yaml',
  'pf1-content/src/pf-racial-traits/Changeling_27mzZu02Xb9oYCqD.yaml',
  'pf1-content/src/pf-racial-traits/Core_Races_pnpTI7Hk2nvitW6j.yaml',
  'pf1-content/src/pf-racial-traits/Defense_O32ChmG5bmi7g6OL.yaml',
  'pf1-content/src/pf-racial-traits/Dhampir_QPyW1vOWOSSxqWWv.yaml',
  'pf1-content/src/pf-racial-traits/Duskwalker_9rgAk3kusF0mIBqN.yaml',
  'pf1-content/src/pf-racial-traits/Dwarf_LMZrndmHCbiQ1DZ7.yaml',
  'pf1-content/src/pf-racial-traits/Elf_0Z7LoIqKFrjU0YGN.yaml',
  'pf1-content/src/pf-racial-traits/Feat_and_Skill_VvjAmbtqRiEyxX0b.yaml',
  'pf1-content/src/pf-racial-traits/Fetchling_HZkPgVdKUdcECvIX.yaml',
  'pf1-content/src/pf-racial-traits/Ganzi_w1CBWJAdeUzckPR8.yaml',
  'pf1-content/src/pf-racial-traits/Gathlain_AlkCBC1auwyzpQjs.yaml',
  'pf1-content/src/pf-racial-traits/Gnome_LxJrzlRjZraZ1lA5.yaml',
  'pf1-content/src/pf-racial-traits/Grippli_y3No4nnP5nx4jf7R.yaml',
  'pf1-content/src/pf-racial-traits/Half_Orc_tYMfoPflPK79Z4pj.yaml',
  'pf1-content/src/pf-racial-traits/Halfling_roBc1BFV5m9SIwv7.yaml',
  'pf1-content/src/pf-racial-traits/Ifrit_tP7ySRN7A6YDD0v1.yaml',
  'pf1-content/src/pf-racial-traits/Kasatha_djQBH83XAsijjtSG.yaml',
  'pf1-content/src/pf-racial-traits/Kobold_70vPWRmINBsSQ90K.yaml',
  'pf1-content/src/pf-racial-traits/Locathah_fn3ISzG5o1dQ7EC7.yaml',
  'pf1-content/src/pf-racial-traits/Magical_1OWNsl3OovdHDbuP.yaml',
  'pf1-content/src/pf-racial-traits/Merfolk_E9mTdkJuwxNmW94n.yaml',
  'pf1-content/src/pf-racial-traits/Monkey_Goblin_4mraNuLbTgXENeoV.yaml',
  'pf1-content/src/pf-racial-traits/Movement_JqYNnxJSPBm6aC5k.yaml',
  'pf1-content/src/pf-racial-traits/Offensive_PIVj1MVMqsVbaJAX.yaml',
  'pf1-content/src/pf-racial-traits/Oread_4VSNnpW9YGpm4xC0.yaml',
  'pf1-content/src/pf-racial-traits/Other_NCkgefj8p80D4P5O.yaml',
  'pf1-content/src/pf-racial-traits/Other_Races_Iwrwzoq5uWYKNHty.yaml',
  'pf1-content/src/pf-racial-traits/Primitive_Human_U6bKQWjBdxOE4Xof.yaml',
  'pf1-content/src/pf-racial-traits/Race_Builder_DrDUkvfcwfcx6AP9.yaml',
  'pf1-content/src/pf-racial-traits/Racial_Qualities_dfwclEVJRJgllnC2.yaml',
  'pf1-content/src/pf-racial-traits/Racial_Traits_AGG9Qo3pfg5Z2aag.yaml',
  'pf1-content/src/pf-racial-traits/Ratfolk_9KPG9fnmkN8bUNZ1.yaml',
  'pf1-content/src/pf-racial-traits/Reptoid_sZRgX4epaXZlzJMR.yaml',
  'pf1-content/src/pf-racial-traits/Samsaran_WGGmNZdRqTXOPmgr.yaml',
  'pf1-content/src/pf-racial-traits/Shabti_MN4QiTzzMKS4qO0e.yaml',
  'pf1-content/src/pf-racial-traits/Skinwalker_Yauhqdv1M3VrpYQr.yaml',
  'pf1-content/src/pf-racial-traits/Standard_1a9UeeKPwwMOMNoR.yaml',
  'pf1-content/src/pf-racial-traits/Standard_2fWyJqNdoARq7kA2.yaml',
  'pf1-content/src/pf-racial-traits/Standard_CfOTLvo8D5bPPSPB.yaml',
  'pf1-content/src/pf-racial-traits/Standard_Di9Bx0HIUosfwSOu.yaml',
  'pf1-content/src/pf-racial-traits/Standard_EYjUNGh2RPUDSQDb.yaml',
  'pf1-content/src/pf-racial-traits/Standard_V8NqYeuTjc2CDfT3.yaml',
  'pf1-content/src/pf-racial-traits/Standard_cwJ8fDUFMFRGqsJN.yaml',
  'pf1-content/src/pf-racial-traits/Standard_egPtrKyVhJWvKbJV.yaml',
  'pf1-content/src/pf-racial-traits/Standard_h28fV1La84HjFdFv.yaml',
  'pf1-content/src/pf-racial-traits/Standard_lWQAddC6GTZXQbIx.yaml',
  'pf1-content/src/pf-racial-traits/Standard_nUET7BmXTWwpAoi3.yaml',
  'pf1-content/src/pf-racial-traits/Standard_pCI4yLdNsBYunKH7.yaml',
  'pf1-content/src/pf-racial-traits/Standard_vqjweZ1lNUDACahi.yaml',
  'pf1-content/src/pf-racial-traits/Standard_w73GxQVQz7wDcHah.yaml',
  'pf1-content/src/pf-racial-traits/Standard_yPR1r2nsCco06PKw.yaml',
  'pf1-content/src/pf-racial-traits/Standard_yuxMwwUD5XyQMkUe.yaml',
  'pf1-content/src/pf-racial-traits/Standard_zz227zlxQWeF2YQr.yaml',
  'pf1-content/src/pf-racial-traits/Strix_E7eUF79r7CBaD5z0.yaml',
  'pf1-content/src/pf-racial-traits/Subrace_KMPtEFezdRZosq6n.yaml',
  'pf1-content/src/pf-racial-traits/Subrace_Standard_2Gz1809xjufRnaum.yaml',
  'pf1-content/src/pf-racial-traits/Subrace_Standard_V0AMHu01ZqnTvZD7.yaml',
  'pf1-content/src/pf-racial-traits/Subrace_Standard_oNR6jnt8GAB22AHY.yaml',
  'pf1-content/src/pf-racial-traits/Subrace_Standard_vBJVzeHSaziYyQlM.yaml',
  'pf1-content/src/pf-racial-traits/Subraces_4NSgjZqYScI33X8K.yaml',
  'pf1-content/src/pf-racial-traits/Subraces_Drhj8jWJrmopXD5K.yaml',
  'pf1-content/src/pf-racial-traits/Subraces_u5YT5PXPHcpM2AvO.yaml',
  'pf1-content/src/pf-racial-traits/Svirfneblin_xMLSSmnedPlnDveR.yaml',
  'pf1-content/src/pf-racial-traits/Syrinx_f0Uw5byWu52oGfPu.yaml',
  'pf1-content/src/pf-racial-traits/Tengu_wfLwcDEpaxjHWcEW.yaml',
  'pf1-content/src/pf-racial-traits/Tiefling_IPPDGMZfb6Lfx9ij.yaml',
  'pf1-content/src/pf-racial-traits/Undine_8zuQiFz3p29tdJKe.yaml',
  'pf1-content/src/pf-racial-traits/Vine_Leshy_A10bGnJLwJi8CJF1.yaml',
  'pf1-content/src/pf-racial-traits/Vishkanya_3dgiIO3A3f0Ml8xt.yaml',
  'pf1-content/src/pf-racial-traits/Wyrwood_RU1pTqBVHbGN6X7E.yaml',
  'pf1-content/src/pf-racial-traits/Yaddithian_P62rxEcFwpYPinoO.yaml',
  'pf1/packs/races/aasimar.FHY3oIk5zSOFncJH.yaml',
  'pf1/packs/races/adaro.LAtTC2NPuqjTLEkn.yaml',
  'pf1/packs/races/android.9Fe6mDt0oP52m6Jl.yaml',
  'pf1/packs/races/aquatic-elf.E6bHjOMkRatMQwbR.yaml',
  'pf1/packs/races/catfolk.VE4d35yiptv2eyxm.yaml',
  'pf1/packs/races/changeling.9FBT6uqlRgaw9gug.yaml',
  'pf1/packs/races/dhampir.puKk997wHX3kIRkR.yaml',
  'pf1/packs/races/duskwalker.HKRRq2tdZVEGlmHG.yaml',
  'pf1/packs/races/dwarf.nEltI9y37rKJTeWo.yaml',
  'pf1/packs/races/elf.NgIhxRI0axrf3fcO.yaml',
  'pf1/packs/races/fetchling.6BKIB9hjKwSJorAZ.yaml',
  'pf1/packs/races/ganzi.QKrRHanuWwD4pu8Q.yaml',
  'pf1/packs/races/gathlain.ubx4PIbRqmVT93Ds.yaml',
  'pf1/packs/races/gnome.efwHEwjvL9Z94MJI.yaml',
  'pf1/packs/races/grippli.MSLlV9YnompTd6xp.yaml',
  'pf1/packs/races/half-orc.dCAXgdA6Db1Z3ccz.yaml',
  'pf1/packs/races/halfling.Hf31mrYb3uucNyLO.yaml',
  'pf1/packs/races/human.e6IaBxKgMxy1yKlr.yaml',
  'pf1/packs/races/ifrit.TPHe88Yhy4SsDpKo.yaml',
  'pf1/packs/races/kasatha.VYbsatEW3DFCLWtD.yaml',
  'pf1/packs/races/kobold.LMNzbqGSRAFQFE2Y.yaml',
  'pf1/packs/races/locathah.WxPc1Nw2V3ohdl2x.yaml',
  'pf1/packs/races/merfolk.3lV30qfiQaWKB0sp.yaml',
  'pf1/packs/races/monkey-goblin.aCyDEyMB5PKJAuTi.yaml',
  'pf1/packs/races/oread.4qEXPDlfIj1cIvCe.yaml',
  'pf1/packs/races/primitive-human.m1Yvpz1t8S9x4PPr.yaml',
  'pf1/packs/races/ratfolk.rAKaCt6BW3rVv2kN.yaml',
  'pf1/packs/races/reptoid.YCCdi4OEC4WuzelM.yaml',
  'pf1/packs/races/samsaran.aQ8RQYKVd2hqI4jh.yaml',
  'pf1/packs/races/shabti.H6tsZqHiaTOcFSOn.yaml',
  'pf1/packs/races/skinwalker.apWl6JIJ8U8p0azq.yaml',
  'pf1/packs/races/strix.MF8vCjLIGTmJl3Mo.yaml',
  'pf1/packs/races/svirfneblin.fX9F2amW2BcYoHwb.yaml',
  'pf1/packs/races/sylph.pbX1xj9Z0ZhUfKvZ.yaml',
  'pf1/packs/races/syrinx.ryBQiQNP6ZrkwZCy.yaml',
  'pf1/packs/races/tengu.yAS41rHv0WzDmuRm.yaml',
  'pf1/packs/races/tiefling.nVjKDLZSRONzYm8f.yaml',
  'pf1/packs/races/undine.iqJvhd7NbmybUl0y.yaml',
  'pf1/packs/races/vine-leshy.KMpuFun7YDFyuO8z.yaml',
  'pf1/packs/races/vishkanya.Yder5QR51sDl5X0n.yaml',
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
