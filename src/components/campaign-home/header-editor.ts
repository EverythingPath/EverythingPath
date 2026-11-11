import {
  campaignHeaderFields,
  campaignHeaderSchema,
  type CampaignHeaderField as Field,
  type CampaignHeaderValues as Values,
} from '~/lib/campaign-fields';
import { refusalReason } from '~/lib/write-outcome';

// One header Save sends each changed field through its own mutation. The two
// writes are independent: either can be accepted while the other fails, and
// nothing here pretends otherwise. The model keeps only the player's own
// input; every other value follows the saved campaign as it is observed.

export type FieldStatus =
  | { kind: 'pending'; value: string }
  | { kind: 'saved'; value: string }
  | { kind: 'rejected'; value: string; message: string | null }
  | { kind: 'unknown'; value: string };

export type HeaderEditor = {
  open: boolean;
  /** Saved values as this editor last knew them: at Edit, then its own accepted writes. */
  baseline: Values;
  /** Unsaved input, per field; a field without input shows the saved value. */
  edits: Partial<Values>;
  status: Partial<Record<Field, FieldStatus>>;
  errors: Partial<Record<Field, string>>;
  /** Set when every intended change was accepted and the editor closed. */
  saved: boolean;
};

export type HeaderAction =
  | { type: 'open'; saved: Values }
  | { type: 'change'; field: Field; value: string }
  | { type: 'invalid'; errors: Partial<Record<Field, string>> }
  | { type: 'submit'; writes: HeaderWrite[] }
  | { type: 'accepted'; field: Field; value: string }
  | { type: 'rejected'; field: Field; value: string; message: string | null }
  | { type: 'unknown'; field: Field; value: string }
  | { type: 'close' };

export type HeaderWrite = { field: Field; value: string };

export const closedHeaderEditor = (saved: Values): HeaderEditor => ({
  open: false,
  baseline: saved,
  edits: {},
  status: {},
  errors: {},
  saved: false,
});

function without<T extends object>(value: T, key: keyof T): T {
  const rest = { ...value };
  delete rest[key];
  return rest;
}

const pending = (state: HeaderEditor) =>
  campaignHeaderFields.some((field) => state.status[field]?.kind === 'pending');

// Closes only once every intended change has a definite accepted result and
// no unsaved input is left; a failed or unconfirmed field keeps it open.
function settle(state: HeaderEditor): HeaderEditor {
  if (pending(state)) return state;
  const unresolved = campaignHeaderFields.some(
    (field) =>
      state.edits[field] !== undefined ||
      (state.status[field] && state.status[field].kind !== 'saved'),
  );
  if (unresolved) return state;
  return { ...state, open: false, status: {}, saved: true };
}

export function headerEditorReducer(
  state: HeaderEditor,
  action: HeaderAction,
): HeaderEditor {
  switch (action.type) {
    case 'open':
      return { ...closedHeaderEditor(action.saved), open: true };
    case 'change': {
      if (state.status[action.field]?.kind === 'pending') return state;
      return {
        ...state,
        edits: { ...state.edits, [action.field]: action.value },
        status: without(state.status, action.field),
        errors: without(state.errors, action.field),
      };
    }
    case 'invalid':
      return { ...state, errors: action.errors };
    case 'submit': {
      const status = { ...state.status };
      for (const write of action.writes)
        status[write.field] = { kind: 'pending', value: write.value };
      return { ...state, status, errors: {}, saved: false };
    }
    case 'accepted': {
      const current = state.edits[action.field];
      return settle({
        ...state,
        // The accepted value is the new baseline; input typed since (not
        // possible while pending, but kept if it happens) is not discarded.
        baseline: { ...state.baseline, [action.field]: action.value },
        edits:
          current === action.value
            ? without(state.edits, action.field)
            : state.edits,
        status: {
          ...state.status,
          [action.field]: { kind: 'saved', value: action.value },
        },
      });
    }
    case 'rejected':
      return {
        ...state,
        status: {
          ...state.status,
          [action.field]: {
            kind: 'rejected',
            value: action.value,
            message: action.message,
          },
        },
      };
    case 'unknown':
      return {
        ...state,
        status: {
          ...state.status,
          [action.field]: { kind: 'unknown', value: action.value },
        },
      };
    case 'close':
      return { ...closedHeaderEditor(state.baseline) };
  }
}

export type FieldView = {
  value: string;
  /** Unsaved input that differs from the saved value. */
  dirty: boolean;
  status: FieldStatus | null;
  /** The saved value changed on another device since this editor last knew it. */
  changedElsewhere: boolean;
  error: string | null;
};

export function fieldView(
  state: HeaderEditor,
  saved: Values,
  field: Field,
): FieldView {
  const input = state.edits[field];
  const value = input ?? saved[field];
  let status = state.status[field] ?? null;
  // An unconfirmed write whose value is now observed as saved needs no
  // retry. That establishes the saved value, not who wrote it.
  if (status?.kind === 'unknown' && saved[field] === status.value)
    status = { kind: 'saved', value: status.value };
  return {
    value,
    dirty: input !== undefined && input !== saved[field],
    status,
    changedElsewhere: saved[field] !== state.baseline[field],
    error: state.errors[field] ?? null,
  };
}

export type SavePlan =
  | { kind: 'busy' }
  | { kind: 'invalid'; errors: Partial<Record<Field, string>> }
  | { kind: 'nothing' }
  | { kind: 'send'; writes: HeaderWrite[] };

// Validates everything first, then sends only fields whose input differs
// from the saved value. A field already accepted has no input left, so a
// retry never replays it over a newer remote edit.
export function planHeaderSave(state: HeaderEditor, saved: Values): SavePlan {
  if (pending(state)) return { kind: 'busy' };
  const dirty = campaignHeaderFields.filter(
    (field) => fieldView(state, saved, field).dirty,
  );
  if (dirty.length === 0) return { kind: 'nothing' };
  // Every value to be sent is checked before any is sent. An untouched
  // saved value is not re-validated: it is not being written.
  const values = Object.fromEntries(
    dirty.map((field) => [field, fieldView(state, saved, field).value]),
  );
  const parsed = campaignHeaderSchema.partial().safeParse(values);
  if (!parsed.success) {
    const errors: Partial<Record<Field, string>> = {};
    for (const issue of parsed.error.issues) {
      // Safe cast: the schema is an object of these fields, so each issue's
      // first path segment names one.
      const field = issue.path[0] as Field;
      errors[field] ??= issue.message;
    }
    return { kind: 'invalid', errors };
  }
  return {
    kind: 'send',
    writes: dirty.map((field) => ({ field, value: parsed.data[field] ?? '' })),
  };
}

const labels: Record<Field, { name: string; kept: string }> = {
  description: { name: 'Description', kept: 'Your text is kept.' },
  inGameDate: { name: 'In-game date', kept: 'Your date is kept.' },
};

/** Accessible per-field feedback for the open editor, or null. */
export function fieldFeedback(view: FieldView, field: Field): string | null {
  const { name, kept } = labels[field];
  switch (view.status?.kind) {
    case 'pending':
      return `Saving ${name.toLowerCase()}…`;
    case 'saved':
      return `${name} saved.`;
    case 'rejected':
      return `${name} wasn't saved${refusalReason(view.status.message)} ${kept} Save to try again.`;
    case 'unknown':
      return `${name} may not have been saved. ${kept} Check it, then Save to try again.`;
    default:
      if (view.changedElsewhere)
        return view.dirty
          ? `${name} was changed on another device. Your unsaved change is kept.`
          : `${name} was updated on another device.`;
      return null;
  }
}
