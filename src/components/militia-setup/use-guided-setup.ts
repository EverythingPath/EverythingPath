'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { ConvexError } from 'convex/values';
import {
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
} from 'react';
import { useForm } from 'react-hook-form';
import { useBreakpoint } from '~/components/use-breakpoint';
import { newMilitiaSetup, type MilitiaSetup } from '~/lib/canonical-setup';
import {
  setupSchemaForCharacters,
  withRecordKinds,
} from '~/lib/setup-characters';
import type { SetupProgress } from '~/lib/setup-envelope';
import type { SetupSectionMessage } from '~/lib/setup-sections';
import {
  setupStepPreview,
  setupSteps,
  setupSummaryMessage,
  type SetupStepKey,
} from '~/lib/setup-steps';
import {
  setupErrorDescriptors,
  setupWarningDescriptors,
  type SetupErrorDescriptor,
} from '~/lib/setup-validation';
import type { SetupCharacter } from './roster';

// Below 768px the steps are one list of rows; from 768px an index and one
// detail pane. Only one layout is mounted at a time.
export type SetupLayout = 'phone' | 'wide';

// A problem from the error summary or a warning list: its step, and the field
// or entry to focus when there is one.
export type SetupProblem = Pick<SetupErrorDescriptor, 'section' | 'field'>;

type FocusTarget =
  | { kind: 'element'; id: string }
  | { kind: 'field'; field: string; fallback: string };
// The control a focused element represents, found again after a layout change
// remounts the step editors.
type FocusKey =
  | { id: string }
  | { name: string }
  | { path: string; index: number };

function focusKey(element: HTMLElement): FocusKey | null {
  const name = element.getAttribute('name');
  if (name) return { name };
  const group = element.closest<HTMLElement>('[data-setup-path]');
  if (group) {
    const buttons: HTMLElement[] = [...group.querySelectorAll('button')];
    return {
      path: group.dataset.setupPath ?? '',
      index: buttons.indexOf(element),
    };
  }
  return element.id ? { id: element.id } : null;
}
function withAttribute(root: HTMLElement, attribute: string, value: string) {
  return [...root.querySelectorAll<HTMLElement>(`[${attribute}]`)].filter(
    (element) => element.getAttribute(attribute) === value,
  );
}
function findKey(root: HTMLElement, key: FocusKey) {
  if ('id' in key) return document.getElementById(key.id);
  if ('name' in key) return withAttribute(root, 'name', key.name)[0];
  const [group] = withAttribute(root, 'data-setup-path', key.path);
  return group?.querySelectorAll<HTMLElement>('button')[key.index] ?? group;
}
// The control for a form path: the named input, the choice group, or the
// first control of the entry the path names.
export function findSetupField(root: HTMLElement, field: string) {
  const [named] = withAttribute(root, 'name', field);
  if (named) return named;
  const [group] = withAttribute(root, 'data-setup-path', field);
  const choice = group?.querySelector<HTMLElement>('button');
  if (choice) return choice;
  const prefix = `${field}.`;
  return [
    ...root.querySelectorAll<HTMLElement>('[name], [data-setup-path] button'),
  ].find((element) =>
    (
      element.getAttribute('name') ??
      element.closest<HTMLElement>('[data-setup-path]')?.dataset.setupPath ??
      ''
    ).startsWith(prefix),
  );
}
function reveal(element: HTMLElement | null | undefined) {
  if (!element) return false;
  element.focus();
  element.scrollIntoView?.({ block: 'nearest' });
  return true;
}

const failure =
  'Militia setup could not be saved. Your entries are retained. Try again, or open the current week if another player completed setup.';

// One typed form behind the nine guided steps. Values stay in the form while
// step editors unmount; free navigation never validates or submits.
export type GuidedSetupProps = {
  characters: SetupCharacter[];
  onSave: (setup: MilitiaSetup) => Promise<void>;
  /** Values to begin from; a New militia's defaults otherwise. */
  initialValues?: MilitiaSetup;
  /** The step to open and the steps already visited, when resuming. */
  initialStep?: SetupStepKey;
  initialVisited?: readonly SetupStepKey[];
  /** The values were entered earlier; show their field errors straight away. */
  resumed?: boolean;
  /** Called with the whole form position whenever a value or the open step changes. */
  onProgress?: (progress: SetupProgress) => void;
  /** Keeps Start disabled and showing progress, e.g. while the started week opens. */
  starting?: boolean;
  /** Opens character creation from People & officers. */
  onAddCharacter?: () => void;
};
export function useGuidedSetup({
  characters,
  onSave,
  initialValues,
  initialStep = 'startingPoint',
  initialVisited,
  resumed = false,
  onProgress,
  starting = false,
}: Omit<GuidedSetupProps, 'onAddCharacter'>) {
  // Every roster person needs a record in this campaign; the kind each one
  // has is always its record's, for warnings and for what a start sends.
  const schema = useMemo(
    () => setupSchemaForCharacters(characters),
    [characters],
  );
  const form = useForm<MilitiaSetup>({
    resolver: zodResolver(schema),
    defaultValues: initialValues ?? newMilitiaSetup('Loyalty'),
    // Validating as values change, not on blur, keeps rows below a field from
    // moving under a pointer that is leaving it.
    mode: 'onChange',
    shouldFocusError: false,
  });
  const layout: SetupLayout = useBreakpoint('wide') ? 'wide' : 'phone';
  const prefix = useId();
  const ids = {
    header: (key: SetupStepKey) => `${prefix}-${key}-step`,
    heading: (key: SetupStepKey) => `${prefix}-${key}-heading`,
    panel: (key: SetupStepKey) => `${prefix}-${key}-panel`,
    summary: `${prefix}-summary`,
    next: `${prefix}-next`,
  };
  const [stepKey, setStepKey] = useState<SetupStepKey>(initialStep);
  const [visited, setVisited] = useState<ReadonlySet<SetupStepKey>>(
    () => new Set([...(initialVisited ?? []), initialStep]),
  );
  const [attempted, setAttempted] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const values = form.watch();
  const errors = setupErrorDescriptors(values, schema);
  const steps = setupSteps({
    values,
    errors,
    warnings: setupWarningDescriptors(withRecordKinds(values, characters)),
    visited,
    attempted,
  });
  const index = steps.findIndex((step) => step.key === stepKey);
  // Safe cast: setupSteps returns one step per SETUP_STEP_KEYS key, so the
  // SetupStepKey stepKey is always found.
  const current = steps[index]!;
  const next = steps[index + 1];

  // Focus moves after the chosen step has rendered.
  const root = useRef<HTMLDivElement>(null);
  const [focusRequest, setFocusRequest] = useState<FocusTarget | null>(null);
  useEffect(() => {
    if (!focusRequest || !root.current) return;
    if (focusRequest.kind === 'element')
      reveal(document.getElementById(focusRequest.id));
    else if (!reveal(findSetupField(root.current, focusRequest.field)))
      reveal(document.getElementById(focusRequest.fallback));
  }, [focusRequest]);
  // Changing layout remounts the editors; return focus to the same control.
  const lastFocus = useRef<FocusKey | null>(null);
  const shownLayout = useRef(layout);
  useEffect(() => {
    if (shownLayout.current === layout) return;
    shownLayout.current = layout;
    const active = document.activeElement;
    if (!root.current || !lastFocus.current) return;
    if (active && active !== document.body && root.current.contains(active))
      return;
    reveal(findKey(root.current, lastFocus.current));
  }, [layout]);

  // Resumed input shows the field errors it showed before the reload.
  const showResumedErrors = useEffectEvent(() => {
    if (resumed) void form.trigger();
  });
  useEffect(() => showResumedErrors(), []);

  // Every value change and step change is reported with the whole position.
  const progress = (step: SetupStepKey, seen: ReadonlySet<SetupStepKey>) =>
    onProgress?.({ values: form.getValues(), step, visited: [...seen] });
  const reportValues = useEffectEvent(() => progress(stepKey, visited));
  useEffect(() => {
    const subscription = form.watch(() => reportValues());
    return () => subscription.unsubscribe();
  }, [form]);

  function open(key: SetupStepKey, focus: FocusTarget | null) {
    const seen = visited.has(key) ? visited : new Set([...visited, key]);
    setStepKey(key);
    setVisited(seen);
    setFocusRequest(focus);
    if (key !== stepKey || seen !== visited) progress(key, seen);
  }
  // The heading that names a newly opened step in this layout.
  const stepTitle = (key: SetupStepKey) =>
    layout === 'phone' ? ids.header(key) : ids.heading(key);

  const start = form.handleSubmit(
    async (setup) => {
      setSubmitError(undefined);
      try {
        await onSave(withRecordKinds(setup, characters));
      } catch (error) {
        setSubmitError(
          error instanceof ConvexError && typeof error.data === 'string'
            ? error.data
            : failure,
        );
      }
    },
    () => {
      setAttempted(true);
      setFocusRequest({ kind: 'element', id: ids.summary });
    },
  );

  return {
    form,
    layout,
    ids,
    /** Spread on the element that contains the whole guided form. */
    rootProps: {
      ref: root,
      onFocusCapture: (event: FocusEvent<HTMLElement>) => {
        lastFocus.current = focusKey(event.target);
      },
    },
    mode: values.mode,
    characters,
    steps,
    current,
    next,
    attempted,
    /** Every blocking error in step order, shown as the linked summary after a start attempt. */
    summary: attempted
      ? steps.flatMap((step) =>
          step.errors.map((error) => ({
            ...error,
            message: setupSummaryMessage(error, values),
          })),
        )
      : [],
    pending: form.formState.isSubmitting || starting,
    submitError,
    preview: (key: SetupStepKey) => setupStepPreview(key, values, characters),
    /** Choose a step from the index or a row header; focus stays there. */
    select: (key: SetupStepKey) =>
      open(
        key,
        layout === 'phone' ? { kind: 'element', id: ids.header(key) } : null,
      ),
    /** Open the following step and move focus to its title. */
    goNext: () => {
      if (next) open(next.key, { kind: 'element', id: stepTitle(next.key) });
    },
    /** Open the step that owns a problem and focus its field or entry. */
    openProblem: ({ section, field }: SetupProblem | SetupSectionMessage) => {
      const key = section ?? 'review';
      open(
        key,
        field
          ? { kind: 'field', field, fallback: stepTitle(key) }
          : { kind: 'element', id: stepTitle(key) },
      );
    },
    /** Validate everything and start the militia week, or show the summary. */
    start: () => void start(),
  };
}
export type GuidedSetup = ReturnType<typeof useGuidedSetup>;
