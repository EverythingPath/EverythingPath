/**
 * fg-1a: why the write path refuses a prompt pick. A refusal's `ConvexError`
 * data is a `PromptPickRefusal`, as a blocked deletion's is
 * `{ code: 'DELETION_BLOCKED', message, ... }`.
 */
export const promptPickRefusalMessages = {
  undefinedList: 'Choose a prompt list its source defines',
  undefinedLevel: 'Choose a prompt level its source defines',
  outsidePool: 'Choose an option this prompt offers',
} as const;
export type PromptPickRefusalReason = keyof typeof promptPickRefusalMessages;
export type PromptPickRefusal = {
  code: 'PROMPT_PICK_REFUSED';
  reason: PromptPickRefusalReason;
  message: (typeof promptPickRefusalMessages)[PromptPickRefusalReason];
};

export function promptPickRefusal(
  reason: PromptPickRefusalReason,
): PromptPickRefusal {
  return {
    code: 'PROMPT_PICK_REFUSED',
    reason,
    message: promptPickRefusalMessages[reason],
  };
}
