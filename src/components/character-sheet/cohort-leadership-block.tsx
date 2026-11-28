'use client';
import { useId } from 'react';
import { CohortLeadershipSource } from './cohort-leadership-source';
import type { CohortController } from './companion-props';
import { blockHeading, noteText, RemoteNotice } from './sheet-parts';
import { useFocusAfterEditorCloses } from './use-focus-after-editor-closes';

/**
 * The leader's sheet (#417): every cohort it supports, each named with the
 * source that supports it and the Leadership modifiers recorded there, one
 * editor open at a time. Another player's change is announced and never
 * replaces an open draft.
 */
export function CohortLeadershipBlock({
  controller,
  reasonId,
}: {
  controller: CohortController;
  reasonId: string | undefined;
}) {
  const headingId = useId();
  const focus = useFocusAfterEditorCloses(
    controller.leadershipEditor?.key ?? null,
    'h3',
  );
  return (
    <section
      ref={focus.wrapper}
      aria-labelledby={headingId}
      className="border-foreground/10 mt-3 flex flex-col gap-2 border-t pt-3"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id={headingId} className={blockHeading}>
          Leadership
        </h3>
        <p className={noteText}>
          The modifiers each cohort’s source records, with the level this
          Character’s Leadership Score would attract now.
        </p>
      </header>
      <RemoteNotice
        isShown={controller.hasRemoteLeadershipChange}
        message="Leadership modifiers updated by another player."
        subject="Leadership modifiers"
        onDismiss={controller.dismissRemoteLeadershipChange}
      />
      <ul aria-label="Cohorts" className="divide-foreground/10 divide-y">
        {controller.leadershipSources.map((source) => (
          <CohortLeadershipSource
            key={source.key}
            source={source}
            controller={controller}
            reasonId={reasonId}
            rememberOpener={focus.rememberOpener}
          />
        ))}
      </ul>
    </section>
  );
}
