'use client';

import { describeRetiredChoice } from './retired-catalog-choices';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import type { FunctionArgs } from 'convex/server';
import {
  archetypeClassApplicability,
  archetypeSelectionBelongsToClass,
  findArchetypeSelection,
} from '~/lib/character-sheet-archetype-helpers';
import { createCharacterSheetOperationId } from '~/lib/character-sheet-operations';
import type { CharacterScope } from './character-scope';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { useEntryWriteStatus } from './use-character-sheet-entries';

export type ArchetypePartChoices = FunctionArgs<
  typeof api.characterSheet.setArchetypePartChoices
>['replacementChoices'];

/** The save status of one class's casting choice: two classes never share one. */
export function castingStatusKey(classEntryId: string, property: string) {
  return `casting:${classEntryId}:${property}`;
}

/** Choices and compatibility follow the live read; each control owns its save acknowledgement. */
export function useCharacterSheetArchetypes(
  scope: CharacterScope,
  snapshot: CharacterSheetSnapshot | null | undefined,
  catalogChoices: CharacterSheetSnapshot['catalogEntries'] = [],
) {
  const select = useMutation(api.characterSheet.setArchetypeSelected);
  const edit = useMutation(api.characterSheet.editSelection);
  const chooseParts = useMutation(api.characterSheet.setArchetypePartChoices);
  const chooseCasting = useMutation(api.characterSheet.chooseArchetypeCasting);
  const catalog = [
    ...new Map<
      Id<'catalogEntry'>,
      CharacterSheetSnapshot['catalogEntries'][number]
    >(
      [...catalogChoices, ...(snapshot?.catalogEntries ?? [])].map((entry) => [
        entry._id,
        entry,
      ]),
    ).values(),
  ];
  const sourceIds = new Set(
    snapshot?.entries.flatMap((entry) =>
      entry.kind === 'classLevel' && entry.state.classEntryId
        ? [entry.state.classEntryId]
        : [],
    ),
  );
  const classes = catalog.flatMap((definition) => {
    if (definition.detail.kind !== 'class' || !sourceIds.has(definition._id))
      return [];
    const calculated = snapshot?.calculated.archetypes.classes.find(
      (row) => row.classEntryId === definition._id,
    );
    const options = catalog.flatMap((archetype) => {
      if (archetype.detail.kind !== 'archetype') return [];
      const applicability = archetypeClassApplicability({
        archetype,
        baseClass: definition,
        catalogEntries: catalog,
      });
      if (!applicability.directlyApplicable && !applicability.familyApplicable)
        return [];
      const recorded = findArchetypeSelection({
        entries: snapshot?.entries ?? [],
        catalogEntries: catalog,
        ruleIdentity: archetype.ruleIdentity,
      });
      const selection =
        recorded &&
        archetypeSelectionBelongsToClass({
          selection: recorded,
          baseClass: definition,
          catalogEntries: catalog,
        })
          ? recorded
          : undefined;
      return [
        {
          definition: archetype,
          unavailableReason: describeRetiredChoice(snapshot, archetype),
          selected: Boolean(
            selection?.active &&
            'catalogEntryId' in selection &&
            selection.catalogEntryId === archetype._id,
          ),
          selection: selection?.kind === 'archetype' ? selection : undefined,
          application: calculated?.archetypes.find(
            (row) => row.ruleIdentity === archetype.ruleIdentity,
          ),
        },
      ];
    });
    const featureOptions =
      'featuresByLevel' in definition.detail
        ? definition.detail.featuresByLevel.flatMap((row) => {
            const feature = catalog.find(
              (entry) => entry._id === row.catalogEntryId,
            );
            return feature?.detail.kind === 'classFeature'
              ? [{ classLevel: row.classLevel, definition: feature }]
              : [];
          })
        : [];
    return [
      {
        classEntryId: definition._id,
        name: definition.name,
        definition,
        calculated,
        // #422: this class's Archetype casting changes and conflicts.
        casting: snapshot?.calculated.archetypeCastings.find(
          (row) => row.classEntryId === definition._id,
        ),
        options,
        featureOptions,
      },
    ];
  });
  const state = useEntryWriteStatus({
    scopeKey: snapshot?.character._id ?? scope.characterId,
    signature: snapshot
      ? JSON.stringify({
          levels: snapshot.entries.flatMap((entry) =>
            entry.kind === 'classLevel'
              ? [[entry._id, entry.active, entry.state.classEntryId]]
              : [],
          ),
          entries: snapshot.entries.filter(
            (entry) => entry.kind === 'archetype',
          ),
          features: snapshot.calculated.resolvedEntries.filter(
            (row) => row.entry.kind === 'classFeature',
          ),
          catalog: catalog.filter((entry) =>
            ['class', 'classFeature', 'archetype'].includes(entry.detail.kind),
          ),
        })
      : null,
    operationId: snapshot?.lastOperationId,
    subject: 'Archetype',
  });
  function operation() {
    if (!snapshot) throw new Error('Character sheet is not available.');
    return {
      ...scope,
      characterId: snapshot.character._id,
      operationId: createCharacterSheetOperationId(),
    };
  }
  return {
    classes,
    /** Every class whose casting Archetypes change, removed casting included. */
    castings: snapshot?.calculated.archetypeCastings ?? [],
    warnings: snapshot?.calculated.archetypes.warnings ?? [],
    selections:
      snapshot?.entries.filter(
        (entry) => entry.kind === 'archetype' && !entry.grantKey,
      ) ?? [],
    statusFor: state.statusFor,
    hasRemoteChange: state.hasRemoteChange,
    dismissRemoteChange: state.dismissRemoteChange,
    setSelected: (
      args: Pick<
        FunctionArgs<typeof api.characterSheet.setArchetypeSelected>,
        'classEntryId' | 'catalogEntryId' | 'selected'
      >,
    ) =>
      state.write(() => select({ ...operation(), ...args }), {
        key: args.catalogEntryId,
        subject: 'Archetype',
      }),
    editSelection: (
      args: Pick<
        FunctionArgs<typeof api.characterSheet.editSelection>,
        'entryId' | 'notes' | 'choice'
      >,
    ) =>
      state.write(() => edit({ ...operation(), ...args }), {
        key: args.entryId,
        subject: 'Archetype',
      }),
    setPartChoices: (
      entryId: Id<'characterSheetEntry'>,
      replacementChoices: ArchetypePartChoices,
    ) =>
      state.write(
        () => chooseParts({ ...operation(), entryId, replacementChoices }),
        { key: entryId, subject: 'Replacement choices', plural: true },
      ),
    /** Saves which Archetype's change applies to one class's conflicting property. */
    chooseCasting: ({
      classEntryId,
      entryId,
      property,
    }: {
      classEntryId: string;
      entryId: Id<'characterSheetEntry'>;
      property: string;
    }) =>
      state.write(() => chooseCasting({ ...operation(), entryId, property }), {
        key: castingStatusKey(classEntryId, property),
        subject: 'Casting choice',
      }),
  };
}
