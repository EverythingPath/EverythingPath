import type { EventBlockRules } from './types';

// The rolled event's corpus rules, folded away so a block stays scannable.
// On a second occurrence only the Twice clause resolves, so it leads the
// summary and the list; the base rules follow, labelled as the first
// occurrence's, for the context a clause like "bonus becomes +5" needs.
export function EventRulesDisclosure({ rules }: { rules: EventBlockRules }) {
  return (
    <details className="min-w-0">
      <summary className="text-muted-foreground min-w-0 cursor-pointer text-xs [overflow-wrap:anywhere]">
        {rules.twice === null ? (
          <>Rules: {rules.name}</>
        ) : (
          <>
            <span className="text-foreground font-medium">Twice</span>
            {' · '}
            {rules.twice}
          </>
        )}
      </summary>
      <div className="text-muted-foreground mt-1 min-w-0 space-y-1 text-sm [overflow-wrap:anywhere]">
        {rules.twice !== null && (
          <>
            <p>
              <span className="text-foreground font-medium">Twice:</span>{' '}
              {rules.twice}
            </p>
            <p className="text-xs">
              For this second roll only the Twice subsection is resolved.
            </p>
            <p className="text-xs">
              {rules.name}, as it applied the first time:
            </p>
          </>
        )}
        <ul className="list-disc space-y-1 pl-5">
          {/* An event's rule lines are distinct. */}
          {rules.text.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}
