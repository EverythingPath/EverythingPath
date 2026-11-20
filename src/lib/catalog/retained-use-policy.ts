type ExistingUse<Definition> = {
  characterId: string;
  definition: Definition;
  requiredNotices: string[];
};
type RetainedUseRequest<Definition> = {
  status: 'held' | 'withdrawn';
} & (
  | { kind: 'selection' | 'copy' | 'grant' | 'revision' }
  | {
      kind: 'existing-use';
      existingUse: ExistingUse<Definition> | null;
      targetCharacterId: string;
    }
  | {
      kind: 'departure-preservation';
      existingUse: ExistingUse<Definition> | null;
      targetCharacterId: string;
      necessaryForDeparture: boolean;
    }
);

/** Callers load the existing use and its last usable definition from authoritative
 * storage, verify the use identity, and carry the returned hold and notices forward.
 * A proposed revision must never be passed as the existing definition.
 */
export function assessRetainedUse<Definition>(
  request: RetainedUseRequest<Definition>,
):
  | { kind: 'blocked'; reason: string }
  | {
      kind: 'retained';
      definition: Definition;
      requiredNotices: string[];
    } {
  switch (request.kind) {
    case 'selection':
    case 'copy':
    case 'grant':
    case 'revision':
      return {
        kind: 'blocked',
        reason:
          'This content can stay on existing sheets and move with a Character leaving a campaign. It cannot be chosen or copied again.',
      };
    case 'existing-use':
    case 'departure-preservation': {
      const { existingUse, targetCharacterId } = request;
      if (existingUse?.characterId !== targetCharacterId)
        return { kind: 'blocked', reason: 'No existing use to preserve.' };
      if (
        request.kind === 'departure-preservation' &&
        !request.necessaryForDeparture
      )
        return {
          kind: 'blocked',
          reason:
            'This content can stay on existing sheets and move with a Character leaving a campaign. It cannot be chosen or copied again.',
        };
      return {
        kind: 'retained',
        definition: existingUse.definition,
        requiredNotices: existingUse.requiredNotices,
      };
    }
  }
}
