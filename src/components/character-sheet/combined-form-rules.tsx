'use client';
import type { CompanionsController } from './companion-props';
import { fieldLabel } from './sheet-parts';

type CombinedFormView = NonNullable<
  CompanionsController['combinedForm']['view']
>;

/** The published rules the Combined Form follows, each opening in a new tab. */
export function CombinedFormRules({
  sources,
}: {
  sources: CombinedFormView['sources'];
}) {
  if (sources.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <h4 className={fieldLabel}>Rules</h4>
      <ul aria-label="Rules" className="flex flex-col gap-1 text-sm">
        {sources.map((source) => (
          <li key={source.url}>
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="focus-visible:ring-ring/50 inline-flex min-h-11 items-center [overflow-wrap:anywhere] underline decoration-dotted underline-offset-4 outline-none focus-visible:ring-[3px] md:min-h-7"
            >
              {source.title}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
