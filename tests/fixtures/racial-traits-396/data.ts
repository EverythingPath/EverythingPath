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
  .parse(snapshot('../../../scripts/catalog/legal/racial-traits-396.json'));
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
  'pf1-content/src/pf-racial-traits/Adaro_OAwtdUpYAjTJ1AQo.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_1XqRrec5Ag0n0yM2.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_1alOGz6KPvdQB44E.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_3Z2cUyMD0Y57p7YO.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_96UasAu9CBvgf5hT.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_C4r4Wp69HHAX7XMo.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_HwNbN3nPop23QbOP.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_IGdp7NHex91tWhaA.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_KP5QLO1nPv43LcXI.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_MwigLwh0rjG0FsNO.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_RXJPpac5E8PiR8Qt.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_STxquJXw503JM504.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_d4bGSdKKLFXKTGuf.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_fEstcJ0Ou5ny9rZm.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_hGoMGOJhqQPRBkaV.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_r1IZStLZfXmVsFqh.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_sq4D60KUCFjxImNV.yaml',
  'pf1-content/src/pf-racial-traits/Alternate_zwPcPvkCuK621YpA.yaml',
  'pf1-content/src/pf-racial-traits/Aphorite_A7tmAPKpiadhaETe.yaml',
  'pf1-content/src/pf-racial-traits/Base_Speed_Ogs5hSl1Cu4m6hnG.yaml',
  'pf1-content/src/pf-racial-traits/Catfolk_Pump2OQujqB4q4A4.yaml',
  'pf1-content/src/pf-racial-traits/Changeling_27mzZu02Xb9oYCqD.yaml',
  'pf1-content/src/pf-racial-traits/Core_Races_pnpTI7Hk2nvitW6j.yaml',
  'pf1-content/src/pf-racial-traits/Defense_O32ChmG5bmi7g6OL.yaml',
  'pf1-content/src/pf-racial-traits/Dhampir_QPyW1vOWOSSxqWWv.yaml',
  'pf1-content/src/pf-racial-traits/Drow_Noble_BU8lLJp14WQHGVoh.yaml',
  'pf1-content/src/pf-racial-traits/Drow_ixeSTuEadPDMGyRU.yaml',
  'pf1-content/src/pf-racial-traits/Dwarf_LMZrndmHCbiQ1DZ7.yaml',
  'pf1-content/src/pf-racial-traits/Elf_0Z7LoIqKFrjU0YGN.yaml',
  'pf1-content/src/pf-racial-traits/Gathlain_AlkCBC1auwyzpQjs.yaml',
  'pf1-content/src/pf-racial-traits/Ghoran_viOFOo6JNlLdvo7Q.yaml',
  'pf1-content/src/pf-racial-traits/Gillman_m3MNeFYo6ZHhEq1Q.yaml',
  'pf1-content/src/pf-racial-traits/Gnome_LxJrzlRjZraZ1lA5.yaml',
  'pf1-content/src/pf-racial-traits/Half_Elf_KEDQumXdts1m9M82.yaml',
  'pf1-content/src/pf-racial-traits/Half_Orc_tYMfoPflPK79Z4pj.yaml',
  'pf1-content/src/pf-racial-traits/Halfling_roBc1BFV5m9SIwv7.yaml',
  'pf1-content/src/pf-racial-traits/Human_jQEHwNadJH7G0gdq.yaml',
  'pf1-content/src/pf-racial-traits/Ifrit_tP7ySRN7A6YDD0v1.yaml',
  'pf1-content/src/pf-racial-traits/Kasatha_djQBH83XAsijjtSG.yaml',
  'pf1-content/src/pf-racial-traits/Kobold_70vPWRmINBsSQ90K.yaml',
  'pf1-content/src/pf-racial-traits/Locathah_fn3ISzG5o1dQ7EC7.yaml',
  'pf1-content/src/pf-racial-traits/Magical_1OWNsl3OovdHDbuP.yaml',
  'pf1-content/src/pf-racial-traits/Merfolk_E9mTdkJuwxNmW94n.yaml',
  'pf1-content/src/pf-racial-traits/Monkey_Goblin_4mraNuLbTgXENeoV.yaml',
  'pf1-content/src/pf-racial-traits/Movement_JqYNnxJSPBm6aC5k.yaml',
  'pf1-content/src/pf-racial-traits/Nagaji_BdP7zBLRqwKpJpgz.yaml',
  'pf1-content/src/pf-racial-traits/Naiad_OHZg8sim2p5PHnsi.yaml',
  'pf1-content/src/pf-racial-traits/Offensive_PIVj1MVMqsVbaJAX.yaml',
  'pf1-content/src/pf-racial-traits/Oread_4VSNnpW9YGpm4xC0.yaml',
  'pf1-content/src/pf-racial-traits/Other_Races_Iwrwzoq5uWYKNHty.yaml',
  'pf1-content/src/pf-racial-traits/Race_Builder_DrDUkvfcwfcx6AP9.yaml',
  'pf1-content/src/pf-racial-traits/Racial_Qualities_dfwclEVJRJgllnC2.yaml',
  'pf1-content/src/pf-racial-traits/Racial_Traits_AGG9Qo3pfg5Z2aag.yaml',
  'pf1-content/src/pf-racial-traits/Ratfolk_9KPG9fnmkN8bUNZ1.yaml',
  'pf1-content/src/pf-racial-traits/Reborn_Samsaran_2Ool05yDjjzZueOo.yaml',
  'pf1-content/src/pf-racial-traits/Sahuagin_x0iFYdEXqaCpnp3I.yaml',
  'pf1-content/src/pf-racial-traits/Skinwalker_Yauhqdv1M3VrpYQr.yaml',
  'pf1-content/src/pf-racial-traits/Standard_07mYrADfuCRzN0E6.yaml',
  'pf1-content/src/pf-racial-traits/Standard_0safJrWJGu9FvC5n.yaml',
  'pf1-content/src/pf-racial-traits/Standard_8l8dbrq85930xouu.yaml',
  'pf1-content/src/pf-racial-traits/Standard_CxdqYljBam86Yw6g.yaml',
  'pf1-content/src/pf-racial-traits/Standard_EpCqVk4zDone92PP.yaml',
  'pf1-content/src/pf-racial-traits/Standard_FTeB36YtoshjvAUD.yaml',
  'pf1-content/src/pf-racial-traits/Standard_IR01WybC7O8a3cwc.yaml',
  'pf1-content/src/pf-racial-traits/Standard_Tt3r64jgYimPthNv.yaml',
  'pf1-content/src/pf-racial-traits/Standard_ZqhbmdIOaUZZ0XR2.yaml',
  'pf1-content/src/pf-racial-traits/Standard_ls4DBb0m4J086nVI.yaml',
  'pf1-content/src/pf-racial-traits/Standard_nUET7BmXTWwpAoi3.yaml',
  'pf1-content/src/pf-racial-traits/Standard_oRCDujilxeupPMmL.yaml',
  'pf1-content/src/pf-racial-traits/Standard_pCI4yLdNsBYunKH7.yaml',
  'pf1-content/src/pf-racial-traits/Standard_rTRYq1BgxSICSSXP.yaml',
  'pf1-content/src/pf-racial-traits/Standard_t1SEV5Ghmi1mwBVG.yaml',
  'pf1-content/src/pf-racial-traits/Standard_vqjweZ1lNUDACahi.yaml',
  'pf1-content/src/pf-racial-traits/Standard_wjLQScur1APMahQY.yaml',
  'pf1-content/src/pf-racial-traits/Standard_wyfyAeiz0xjzj8oj.yaml',
  'pf1-content/src/pf-racial-traits/Strix_E7eUF79r7CBaD5z0.yaml',
  'pf1-content/src/pf-racial-traits/Subrace_Standard_2Gz1809xjufRnaum.yaml',
  'pf1-content/src/pf-racial-traits/Subrace_Standard_3vSL52yi5JvMMdeU.yaml',
  'pf1-content/src/pf-racial-traits/Subrace_Standard_oNR6jnt8GAB22AHY.yaml',
  'pf1-content/src/pf-racial-traits/Subrace_Standard_rKQpQ1hrf04fhyGJ.yaml',
  'pf1-content/src/pf-racial-traits/Subraces_4NSgjZqYScI33X8K.yaml',
  'pf1-content/src/pf-racial-traits/Subraces_96blPHvnxXt0b0cn.yaml',
  'pf1-content/src/pf-racial-traits/Subraces_Drhj8jWJrmopXD5K.yaml',
  'pf1-content/src/pf-racial-traits/Subraces_gHQ1oivYXAWN4zdz.yaml',
  'pf1-content/src/pf-racial-traits/Subraces_ttv0r2Ha7k0ji27j.yaml',
  'pf1-content/src/pf-racial-traits/Subraces_u5YT5PXPHcpM2AvO.yaml',
  'pf1-content/src/pf-racial-traits/Suli_2grfqw7hTZjurhUP.yaml',
  'pf1-content/src/pf-racial-traits/Syrinx_f0Uw5byWu52oGfPu.yaml',
  'pf1-content/src/pf-racial-traits/Tiefling_IPPDGMZfb6Lfx9ij.yaml',
  'pf1-content/src/pf-racial-traits/Trox_AVRfXZSXqcyehtLa.yaml',
  'pf1-content/src/pf-racial-traits/Type_1OXMUAUKknfsmQAv.yaml',
  'pf1-content/src/pf-racial-traits/Vanara_e4Ogb9Yb2DVlvYNW.yaml',
  'pf1-content/src/pf-racial-traits/Wyrwood_RU1pTqBVHbGN6X7E.yaml',
  'pf1-content/src/pf-racial-traits/Wyvaran_dmyFia1i5pfWjmWy.yaml',
  'pf1/packs/races/aasimar.FHY3oIk5zSOFncJH.yaml',
  'pf1/packs/races/adaro.LAtTC2NPuqjTLEkn.yaml',
  'pf1/packs/races/aphorite.zlWiqUqxCajrZRe3.yaml',
  'pf1/packs/races/catfolk.VE4d35yiptv2eyxm.yaml',
  'pf1/packs/races/changeling.9FBT6uqlRgaw9gug.yaml',
  'pf1/packs/races/dhampir.puKk997wHX3kIRkR.yaml',
  'pf1/packs/races/drow-noble.jLZAApW8ymudcJpw.yaml',
  'pf1/packs/races/drow.yLaDS5HGbwtgpkbP.yaml',
  'pf1/packs/races/duergar.eV9USBGHA1rYd5P7.yaml',
  'pf1/packs/races/dwarf.nEltI9y37rKJTeWo.yaml',
  'pf1/packs/races/elf.NgIhxRI0axrf3fcO.yaml',
  'pf1/packs/races/gathlain.ubx4PIbRqmVT93Ds.yaml',
  'pf1/packs/races/ghoran.2mWMyKiPWk6Y8cNx.yaml',
  'pf1/packs/races/gillman.Gy4jOckBEwMjByga.yaml',
  'pf1/packs/races/gnome.efwHEwjvL9Z94MJI.yaml',
  'pf1/packs/races/half-elf.cCepRrfH5SalFfT4.yaml',
  'pf1/packs/races/half-orc.dCAXgdA6Db1Z3ccz.yaml',
  'pf1/packs/races/halfling.Hf31mrYb3uucNyLO.yaml',
  'pf1/packs/races/human.e6IaBxKgMxy1yKlr.yaml',
  'pf1/packs/races/ifrit.TPHe88Yhy4SsDpKo.yaml',
  'pf1/packs/races/kasatha.VYbsatEW3DFCLWtD.yaml',
  'pf1/packs/races/kobold.LMNzbqGSRAFQFE2Y.yaml',
  'pf1/packs/races/locathah.WxPc1Nw2V3ohdl2x.yaml',
  'pf1/packs/races/merfolk.3lV30qfiQaWKB0sp.yaml',
  'pf1/packs/races/monkey-goblin.aCyDEyMB5PKJAuTi.yaml',
  'pf1/packs/races/nagaji.ZVzH0qb1Tqety6fU.yaml',
  'pf1/packs/races/naiad.TpfcHDjKatQL3XBl.yaml',
  'pf1/packs/races/oread.4qEXPDlfIj1cIvCe.yaml',
  'pf1/packs/races/ratfolk.rAKaCt6BW3rVv2kN.yaml',
  'pf1/packs/races/reborn-samsaran.LQ7U0315C6CusmsU.yaml',
  'pf1/packs/races/sahuagin.TbZmYyDUxRn9baWy.yaml',
  'pf1/packs/races/skinwalker.apWl6JIJ8U8p0azq.yaml',
  'pf1/packs/races/strix.MF8vCjLIGTmJl3Mo.yaml',
  'pf1/packs/races/suli.Gtz5E4r6tg6spifD.yaml',
  'pf1/packs/races/syrinx.ryBQiQNP6ZrkwZCy.yaml',
  'pf1/packs/races/tiefling.nVjKDLZSRONzYm8f.yaml',
  'pf1/packs/races/trox.qdFPM6gztJxvdiRf.yaml',
  'pf1/packs/races/vanara.VkQBqlEG8GPmNnzI.yaml',
  'pf1/packs/races/wyrwood.PsRZOF49ZKtorZbs.yaml',
  'pf1/packs/races/wyvaran.4i8qiF2QnGnPOyKC.yaml',
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
