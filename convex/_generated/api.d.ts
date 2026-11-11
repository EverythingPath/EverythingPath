/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountDeletions from "../accountDeletions.js";
import type * as campaign from "../campaign.js";
import type * as campaignDeletions from "../campaignDeletions.js";
import type * as canonicalDraftPersistence from "../canonicalDraftPersistence.js";
import type * as canonicalHistory from "../canonicalHistory.js";
import type * as canonicalLedger from "../canonicalLedger.js";
import type * as canonicalPersistenceFixtures from "../canonicalPersistenceFixtures.js";
import type * as canonicalSetup from "../canonicalSetup.js";
import type * as catalogCopies from "../catalogCopies.js";
import type * as catalogRelease from "../catalogRelease.js";
import type * as catalogReleaseActivation from "../catalogReleaseActivation.js";
import type * as catalogReleaseImpact from "../catalogReleaseImpact.js";
import type * as character from "../character.js";
import type * as characterMoves from "../characterMoves.js";
import type * as characterSheet from "../characterSheet.js";
import type * as characterSheetCombinedForm from "../characterSheetCombinedForm.js";
import type * as characterSheetFamiliars from "../characterSheetFamiliars.js";
import type * as characterSheetLinkedInputs from "../characterSheetLinkedInputs.js";
import type * as characterSheetSpells from "../characterSheetSpells.js";
import type * as clerk from "../clerk.js";
import type * as companionRelationships from "../companionRelationships.js";
import type * as cutover from "../cutover.js";
import type * as e2eFixtures from "../e2eFixtures.js";
import type * as http from "../http.js";
import type * as initialCharacterBackfill from "../initialCharacterBackfill.js";
import type * as initialMigration from "../initialMigration.js";
import type * as legacyRetirement from "../legacyRetirement.js";
import type * as lib_acceptedCampaignFixture from "../lib/acceptedCampaignFixture.js";
import type * as lib_accountDeletion from "../lib/accountDeletion.js";
import type * as lib_campaignDeletion from "../lib/campaignDeletion.js";
import type * as lib_campaignRuntime from "../lib/campaignRuntime.js";
import type * as lib_canonicalCharacterDeparture from "../lib/canonicalCharacterDeparture.js";
import type * as lib_canonicalCharacters from "../lib/canonicalCharacters.js";
import type * as lib_canonicalConfirmation from "../lib/canonicalConfirmation.js";
import type * as lib_canonicalDraftPersistenceAuthority from "../lib/canonicalDraftPersistenceAuthority.js";
import type * as lib_canonicalDraftStorage from "../lib/canonicalDraftStorage.js";
import type * as lib_canonicalDraftTargets from "../lib/canonicalDraftTargets.js";
import type * as lib_canonicalStorageValidators from "../lib/canonicalStorageValidators.js";
import type * as lib_catalogCandidateDefinition from "../lib/catalogCandidateDefinition.js";
import type * as lib_catalogCopies from "../lib/catalogCopies.js";
import type * as lib_catalogFixturePolicy from "../lib/catalogFixturePolicy.js";
import type * as lib_catalogReleaseBoundary from "../lib/catalogReleaseBoundary.js";
import type * as lib_catalogReleaseCompatibility from "../lib/catalogReleaseCompatibility.js";
import type * as lib_catalogReleaseImpact from "../lib/catalogReleaseImpact.js";
import type * as lib_characterAccess from "../lib/characterAccess.js";
import type * as lib_characterMilitiaOnlySheet from "../lib/characterMilitiaOnlySheet.js";
import type * as lib_characterMoveGroup from "../lib/characterMoveGroup.js";
import type * as lib_characterMovePlan from "../lib/characterMovePlan.js";
import type * as lib_characterMoveSpells from "../lib/characterMoveSpells.js";
import type * as lib_characterOwnership from "../lib/characterOwnership.js";
import type * as lib_characterSheet from "../lib/characterSheet.js";
import type * as lib_characterSheetCompanion from "../lib/characterSheetCompanion.js";
import type * as lib_characterSheetData from "../lib/characterSheetData.js";
import type * as lib_characterSheetLinkedInputReader from "../lib/characterSheetLinkedInputReader.js";
import type * as lib_characterSheetLinkedInputs from "../lib/characterSheetLinkedInputs.js";
import type * as lib_companionRelationshipGraph from "../lib/companionRelationshipGraph.js";
import type * as lib_companionRelationships from "../lib/companionRelationships.js";
import type * as lib_initialCharacterBackfill from "../lib/initialCharacterBackfill.js";
import type * as lib_lifecycleDriver from "../lib/lifecycleDriver.js";
import type * as lib_militiaCharacterFacts from "../lib/militiaCharacterFacts.js";
import type * as lib_organizationDeletion from "../lib/organizationDeletion.js";
import type * as lib_organizationDeparture from "../lib/organizationDeparture.js";
import type * as lib_preparedCharacterSheet from "../lib/preparedCharacterSheet.js";
import type * as lib_releaseSpellBrowser from "../lib/releaseSpellBrowser.js";
import type * as lib_representativeArchetypeCatalog from "../lib/representativeArchetypeCatalog.js";
import type * as lib_representativeClassCatalog from "../lib/representativeClassCatalog.js";
import type * as lib_representativeItemCatalog from "../lib/representativeItemCatalog.js";
import type * as lib_representativeRaceCatalog from "../lib/representativeRaceCatalog.js";
import type * as lib_representativeSeeds from "../lib/representativeSeeds.js";
import type * as lib_representativeSelectionCatalog from "../lib/representativeSelectionCatalog.js";
import type * as lib_representativeSpellCatalog from "../lib/representativeSpellCatalog.js";
import type * as lib_representativeSpellEffectCatalog from "../lib/representativeSpellEffectCatalog.js";
import type * as lib_representativeSpellcastingCatalog from "../lib/representativeSpellcastingCatalog.js";
import type * as lib_representativeWeaponCatalog from "../lib/representativeWeaponCatalog.js";
import type * as lib_retiredWorkflow from "../lib/retiredWorkflow.js";
import type * as lib_selectedCanonicalMilitiaState from "../lib/selectedCanonicalMilitiaState.js";
import type * as lib_spellCatalog from "../lib/spellCatalog.js";
import type * as lib_spellCatalogInstall from "../lib/spellCatalogInstall.js";
import type * as lib_spellCatalogSummary from "../lib/spellCatalogSummary.js";
import type * as lib_spellEffectCasterLevel from "../lib/spellEffectCasterLevel.js";
import type * as lib_writeGate from "../lib/writeGate.js";
import type * as migrations from "../migrations.js";
import type * as militia from "../militia.js";
import type * as organizationDeletions from "../organizationDeletions.js";
import type * as organizationDepartures from "../organizationDepartures.js";
import type * as organizationMembership from "../organizationMembership.js";
import type * as spell from "../spell.js";
import type * as types from "../types.js";
import type * as user from "../user.js";
import type * as weekBoard from "../weekBoard.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountDeletions: typeof accountDeletions;
  campaign: typeof campaign;
  campaignDeletions: typeof campaignDeletions;
  canonicalDraftPersistence: typeof canonicalDraftPersistence;
  canonicalHistory: typeof canonicalHistory;
  canonicalLedger: typeof canonicalLedger;
  canonicalPersistenceFixtures: typeof canonicalPersistenceFixtures;
  canonicalSetup: typeof canonicalSetup;
  catalogCopies: typeof catalogCopies;
  catalogRelease: typeof catalogRelease;
  catalogReleaseActivation: typeof catalogReleaseActivation;
  catalogReleaseImpact: typeof catalogReleaseImpact;
  character: typeof character;
  characterMoves: typeof characterMoves;
  characterSheet: typeof characterSheet;
  characterSheetCombinedForm: typeof characterSheetCombinedForm;
  characterSheetFamiliars: typeof characterSheetFamiliars;
  characterSheetLinkedInputs: typeof characterSheetLinkedInputs;
  characterSheetSpells: typeof characterSheetSpells;
  clerk: typeof clerk;
  companionRelationships: typeof companionRelationships;
  cutover: typeof cutover;
  e2eFixtures: typeof e2eFixtures;
  http: typeof http;
  initialCharacterBackfill: typeof initialCharacterBackfill;
  initialMigration: typeof initialMigration;
  legacyRetirement: typeof legacyRetirement;
  "lib/acceptedCampaignFixture": typeof lib_acceptedCampaignFixture;
  "lib/accountDeletion": typeof lib_accountDeletion;
  "lib/campaignDeletion": typeof lib_campaignDeletion;
  "lib/campaignRuntime": typeof lib_campaignRuntime;
  "lib/canonicalCharacterDeparture": typeof lib_canonicalCharacterDeparture;
  "lib/canonicalCharacters": typeof lib_canonicalCharacters;
  "lib/canonicalConfirmation": typeof lib_canonicalConfirmation;
  "lib/canonicalDraftPersistenceAuthority": typeof lib_canonicalDraftPersistenceAuthority;
  "lib/canonicalDraftStorage": typeof lib_canonicalDraftStorage;
  "lib/canonicalDraftTargets": typeof lib_canonicalDraftTargets;
  "lib/canonicalStorageValidators": typeof lib_canonicalStorageValidators;
  "lib/catalogCandidateDefinition": typeof lib_catalogCandidateDefinition;
  "lib/catalogCopies": typeof lib_catalogCopies;
  "lib/catalogFixturePolicy": typeof lib_catalogFixturePolicy;
  "lib/catalogReleaseBoundary": typeof lib_catalogReleaseBoundary;
  "lib/catalogReleaseCompatibility": typeof lib_catalogReleaseCompatibility;
  "lib/catalogReleaseImpact": typeof lib_catalogReleaseImpact;
  "lib/characterAccess": typeof lib_characterAccess;
  "lib/characterMilitiaOnlySheet": typeof lib_characterMilitiaOnlySheet;
  "lib/characterMoveGroup": typeof lib_characterMoveGroup;
  "lib/characterMovePlan": typeof lib_characterMovePlan;
  "lib/characterMoveSpells": typeof lib_characterMoveSpells;
  "lib/characterOwnership": typeof lib_characterOwnership;
  "lib/characterSheet": typeof lib_characterSheet;
  "lib/characterSheetCompanion": typeof lib_characterSheetCompanion;
  "lib/characterSheetData": typeof lib_characterSheetData;
  "lib/characterSheetLinkedInputReader": typeof lib_characterSheetLinkedInputReader;
  "lib/characterSheetLinkedInputs": typeof lib_characterSheetLinkedInputs;
  "lib/companionRelationshipGraph": typeof lib_companionRelationshipGraph;
  "lib/companionRelationships": typeof lib_companionRelationships;
  "lib/initialCharacterBackfill": typeof lib_initialCharacterBackfill;
  "lib/lifecycleDriver": typeof lib_lifecycleDriver;
  "lib/militiaCharacterFacts": typeof lib_militiaCharacterFacts;
  "lib/organizationDeletion": typeof lib_organizationDeletion;
  "lib/organizationDeparture": typeof lib_organizationDeparture;
  "lib/preparedCharacterSheet": typeof lib_preparedCharacterSheet;
  "lib/releaseSpellBrowser": typeof lib_releaseSpellBrowser;
  "lib/representativeArchetypeCatalog": typeof lib_representativeArchetypeCatalog;
  "lib/representativeClassCatalog": typeof lib_representativeClassCatalog;
  "lib/representativeItemCatalog": typeof lib_representativeItemCatalog;
  "lib/representativeRaceCatalog": typeof lib_representativeRaceCatalog;
  "lib/representativeSeeds": typeof lib_representativeSeeds;
  "lib/representativeSelectionCatalog": typeof lib_representativeSelectionCatalog;
  "lib/representativeSpellCatalog": typeof lib_representativeSpellCatalog;
  "lib/representativeSpellEffectCatalog": typeof lib_representativeSpellEffectCatalog;
  "lib/representativeSpellcastingCatalog": typeof lib_representativeSpellcastingCatalog;
  "lib/representativeWeaponCatalog": typeof lib_representativeWeaponCatalog;
  "lib/retiredWorkflow": typeof lib_retiredWorkflow;
  "lib/selectedCanonicalMilitiaState": typeof lib_selectedCanonicalMilitiaState;
  "lib/spellCatalog": typeof lib_spellCatalog;
  "lib/spellCatalogInstall": typeof lib_spellCatalogInstall;
  "lib/spellCatalogSummary": typeof lib_spellCatalogSummary;
  "lib/spellEffectCasterLevel": typeof lib_spellEffectCasterLevel;
  "lib/writeGate": typeof lib_writeGate;
  migrations: typeof migrations;
  militia: typeof militia;
  organizationDeletions: typeof organizationDeletions;
  organizationDepartures: typeof organizationDepartures;
  organizationMembership: typeof organizationMembership;
  spell: typeof spell;
  types: typeof types;
  user: typeof user;
  weekBoard: typeof weekBoard;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  aggregate: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"aggregate">;
};
