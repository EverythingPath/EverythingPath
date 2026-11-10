'use client';

import { useRef, useState } from 'react';
import { useForm, type FieldValues, type Resolver } from 'react-hook-form';

/** Keeps accepted values separate from the draft while query updates arrive. */
export function useSheetFormState<Values extends FieldValues>({
  incoming,
  resolver,
  draftPolicy,
  isOwnChange = false,
}: {
  incoming: Values;
  resolver: Resolver<Values>;
  draftPolicy: 'fields' | 'whole';
  isOwnChange?: boolean;
}) {
  const [source, setSource] = useState(incoming);
  const [baseline, setBaseline] = useState(incoming);
  const [pristineValues, setPristineValues] = useState(incoming);
  const [hasRemoteChange, setHasRemoteChange] = useState(false);
  const expected = useRef<string | null>(null);
  const latest = useRef({ source, baseline });
  latest.current = { source, baseline };
  const form = useForm<Values>({
    values: draftPolicy === 'fields' ? source : pristineValues,
    resolver,
    ...(draftPolicy === 'fields'
      ? { resetOptions: { keepDirtyValues: true } }
      : {}),
  });
  const isDirty = form.formState.isDirty;
  void form.formState.errors;
  void form.formState.dirtyFields;
  if (JSON.stringify(source) !== JSON.stringify(incoming)) {
    setSource(incoming);
    setBaseline(incoming);
    if (expected.current === JSON.stringify(incoming)) expected.current = null;
    else if (!isOwnChange) setHasRemoteChange(true);
    if (!isDirty) setPristineValues(incoming);
  }
  return {
    form,
    source,
    baseline,
    setBaseline,
    expected,
    latest,
    hasRemoteChange,
    dismissRemoteChange: () => setHasRemoteChange(false),
  };
}
