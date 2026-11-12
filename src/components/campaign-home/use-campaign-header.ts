'use client';
import { useReducer } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Doc } from '@convex/_generated/dataModel';
import {
  campaignHeaderFields,
  savedHeaderValues,
  type CampaignHeaderField,
} from '~/lib/campaign-fields';
import { classifyWriteFailure } from '~/lib/write-outcome';
import {
  closedHeaderEditor,
  fieldFeedback,
  fieldView,
  headerEditorReducer,
  planHeaderSave,
  type FieldView,
} from './header-editor';

export type HeaderFieldControl = FieldView & {
  feedback: string | null;
  change: (value: string) => void;
};

export type CampaignHeaderEditor = {
  editing: boolean;
  /** Any write is waiting for its acknowledgement. */
  pending: boolean;
  /** Every intended change was accepted and the editor closed. */
  saved: boolean;
  /**
   * While closed: the shown values changed since this device last knew them
   * (another player's edit, or a write whose result was never confirmed).
   */
  updated: boolean;
  fields: Record<CampaignHeaderField, HeaderFieldControl>;
  edit: () => void;
  save: () => void;
  cancel: () => void;
};

// Not react-hook-form: the form's contract is per field. Each field saves
// through its own mutation with its own acknowledgement, untouched fields
// follow the saved campaign as other players change it, and an accepted
// field leaves the form while a failed one stays. The same zod schema
// (campaignHeaderSchema) validates everything that will be sent.
// Mount per campaign and organization (keyed), so a scope change drops the
// editor and any late acknowledgement lands in the discarded instance.
// Each write carries the campaign and organization it was started for.
export function useCampaignHeader(
  campaign: Doc<'campaign'>,
  organizationId: string,
): CampaignHeaderEditor {
  const saved = savedHeaderValues(campaign);
  const [state, dispatch] = useReducer(
    headerEditorReducer,
    saved,
    closedHeaderEditor,
  );
  const updateDescription = useMutation(api.campaign.updateCampaignDescription);
  const updateInGameDate = useMutation(api.campaign.updateCampaignInGameDate);
  const scope = { campaignId: campaign._id, organizationId };

  function send(field: CampaignHeaderField, value: string) {
    return field === 'description'
      ? updateDescription({ ...scope, description: value })
      : updateInGameDate({
          ...scope,
          ...(value === '' ? {} : { inGameDate: value }),
        });
  }

  function save() {
    const plan = planHeaderSave(state, saved);
    switch (plan.kind) {
      case 'busy':
        return;
      case 'invalid':
        dispatch({ type: 'invalid', errors: plan.errors });
        return;
      case 'nothing':
        dispatch({ type: 'close' });
        return;
      case 'send':
        dispatch({ type: 'submit', writes: plan.writes });
        for (const { field, value } of plan.writes)
          send(field, value).then(
            () => dispatch({ type: 'accepted', field, value }),
            (error: unknown) => {
              const failure = classifyWriteFailure(error);
              dispatch(
                failure.kind === 'rejected'
                  ? { type: 'rejected', field, value, message: failure.message }
                  : { type: 'unknown', field, value },
              );
            },
          );
    }
  }

  // Safe cast: built from every entry of campaignHeaderFields.
  const fields = Object.fromEntries(
    campaignHeaderFields.map((field) => {
      const view = fieldView(state, saved, field);
      return [
        field,
        {
          ...view,
          feedback: state.open ? fieldFeedback(view, field) : null,
          change: (value: string) => dispatch({ type: 'change', field, value }),
        },
      ];
    }),
  ) as Record<CampaignHeaderField, HeaderFieldControl>;

  return {
    editing: state.open,
    pending: campaignHeaderFields.some(
      (field) => state.status[field]?.kind === 'pending',
    ),
    saved: state.saved,
    updated:
      !state.open &&
      campaignHeaderFields.some((field) => fields[field].changedElsewhere),
    fields,
    edit: () => dispatch({ type: 'open', saved }),
    save,
    cancel: () => dispatch({ type: 'close' }),
  };
}
