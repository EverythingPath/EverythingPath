import type { FunctionReturnType } from 'convex/server';
import type { api } from '@convex/_generated/api';
import { linkedInputKey } from '~/lib/character-sheet-linked-inputs';
import {
  characterSheetPath,
  type CharacterSheetOrigin,
} from '~/lib/campaign-routes';

export type CompanionRelationship = FunctionReturnType<
  typeof api.companionRelationships.list
>[number];
export type CompanionKind = CompanionRelationship['kind'];

export const companionKindLabels: Record<CompanionKind, string> = {
  animalCompanion: 'Animal companion',
  familiar: 'Familiar',
  cohort: 'Cohort',
  eidolon: 'Eidolon',
  unchainedEidolon: 'Unchained eidolon',
};

const interruptionLabels: Record<
  NonNullable<CompanionRelationship['interruption']>,
  string
> = {
  support: 'No supporting source currently supports this relationship.',
  access: 'The Characters need a shared campaign or the same owner in private.',
  conflict: 'This Companion has another active associated Character.',
  cycle: 'Restoring this relationship would create a cycle.',
  manual: 'This relationship was interrupted. Restore it when ready.',
};

/**
 * The named values this relationship borrows, once each, from every
 * curated Supporting Source rule: a lost or switched-off source still names
 * what it supplied, so the value shows as unresolved rather than vanishing.
 */
function listLinkedInputs(inputs: CompanionRelationship['linkedInputs']) {
  return [
    ...new Map(
      inputs.map((descriptor) => [
        linkedInputKey(descriptor.input),
        descriptor,
      ]),
    ).values(),
  ];
}

export function buildCompanionRelationshipView(
  relationship: CompanionRelationship,
  origin?: CharacterSheetOrigin,
) {
  const isAccessible = relationship.endpoint !== null;
  const canManage = isAccessible || relationship.role === 'companion';
  return {
    ...relationship,
    name: relationship.endpoint?.name ?? 'Character unavailable',
    href: relationship.endpoint
      ? characterSheetPath(relationship.endpoint.characterId, origin)
      : null,
    roleLabel:
      relationship.role === 'companion' ? 'Companion' : 'Associated Character',
    kindLabel: companionKindLabels[relationship.kind],
    statusLabel:
      relationship.status === undefined
        ? 'Unavailable'
        : relationship.status === 'active'
          ? 'Active'
          : relationship.status === 'replaced'
            ? 'Replaced'
            : 'Interrupted',
    explanation: !isAccessible
      ? 'This Character is not available to you.'
      : relationship.status === 'replaced'
        ? 'The former relationship and Character Sheet are retained.'
        : relationship.interruption
          ? interruptionLabels[relationship.interruption]
          : null,
    canManage,
    linkedInputs: listLinkedInputs(relationship.linkedInputs),
    canReplace:
      relationship.role === 'companion' && relationship.status !== 'replaced',
    canInterrupt: canManage && relationship.status === 'active',
    canRestore: isAccessible && relationship.status !== 'active',
  };
}

export type CompanionRelationshipView = ReturnType<
  typeof buildCompanionRelationshipView
>;
