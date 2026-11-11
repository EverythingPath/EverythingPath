'use client';
import { CompanionCandidateField } from './companion-candidate-field';
import { CompanionKindField } from './companion-kind-field';
import type {
  CompanionFieldProps,
  CompanionsController,
} from './companion-props';
import { CompanionSourceField } from './companion-source-field';
import { CompanionTextField } from './companion-text-field';

type EditorKind = NonNullable<CompanionsController['editor']>['kind'];

/**
 * The fields each editor asks for. Replacement keeps the relationship's
 * kind and Supporting Sources; only the sheet changes.
 */
export function CompanionEditorFields({
  kind,
  ...props
}: CompanionFieldProps & { kind: EditorKind }) {
  if (kind === 'create')
    return (
      <>
        <CompanionTextField {...props} name="name" label="Name" autoFocus />
        <CompanionKindField {...props} />
        <CompanionSourceField {...props} />
      </>
    );
  if (kind === 'link')
    return (
      <>
        <CompanionCandidateField {...props} />
        <CompanionKindField {...props} />
        <CompanionSourceField {...props} />
      </>
    );
  if (kind === 'replace')
    return (
      <>
        <CompanionCandidateField {...props} />
        <p className="text-muted-foreground text-xs">
          The former relationship and Character Sheet are retained.
        </p>
      </>
    );
  return <CompanionSourceField {...props} />;
}
