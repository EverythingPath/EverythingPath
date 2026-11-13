// @vitest-environment node
import { expect, it } from 'vitest';
import failed from '../fixtures/review-766/failed-binding-observation.json';
import request from '../fixtures/review-766/failed-binding-request.json';
import { recoverT3Original } from '../../scripts/catalog/t3-original-message';

const observed = failed.read.structuredContent;
const [savedOriginal] = observed.items;
if (!savedOriginal)
  throw new Error('Saved observation has no original message.');
const original = savedOriginal;
// The saved full response exceeded the adapter's slice size. Only pagination
// envelopes below are synthetic; the original message/metadata and task are unchanged.
function observationsFor(message = original.text) {
  return Array.from(
    { length: Math.ceil(message.length / 2048) },
    (_, index) => {
      const offset = index * 2048;
      const end = Math.min(offset + 2048, message.length);
      return {
        args: {
          threadId: observed.thread.threadId,
          view: 'messages',
          limit: 1,
          maxCharsPerItem: 2048,
          runLimit: 1,
          ...(index === 0
            ? {}
            : { itemId: original.itemId, textOffset: offset }),
        },
        response: {
          ...observed,
          items: [
            {
              ...original,
              text: message.slice(offset, end),
              textTruncated: end < message.length,
              nextTextOffset: end < message.length ? end : null,
            },
          ],
        },
      };
    },
  );
}
it('recovers the unchanged authentic failed review-role original message', () => {
  expect(request.task.length).toBe(4646);
  expect(original.text.length).toBe(4690);
  const result = recoverT3Original({
    parentThreadId: observed.thread.parentThreadId,
    childThreadId: observed.thread.threadId,
    childRunId: original.runId,
    expectedText: request.task,
    role: request.role,
    policy: 'review-role-v1',
    observations: observationsFor(),
    toolData: (value) => value,
  });
  expect(result).toEqual({
    kind: 'complete',
    text: original.text,
    itemId: original.itemId,
    messageId: original.messageId,
  });
});

const prefix = 'Act as the review sub-agent for this task.\n\n';
it.each([
  [
    'changed role wrapper',
    'Act as the implementation sub-agent for this task.\n\n' + request.task,
  ],
  [
    'changed wrapper case',
    'Act as the Review sub-agent for this task.\n\n' + request.task,
  ],
  ['repeated wrapper', prefix + original.text],
  ['arbitrary preamble', 'Review instructions: ' + original.text],
  ['bare payload', request.task],
  ['leading whitespace', ' ' + original.text],
  ['trailing whitespace', original.text + '\n'],
  ['changed wrapper newline', prefix.replaceAll('\n', '\r\n') + request.task],
  [
    'changed body',
    original.text.replace(
      'Review disposable fixture',
      'Review another fixture',
    ),
  ],
  [
    'changed nonce',
    original.text.replace(
      '41fd863e-b0f2-4ae3-b932-5ffbed336b06',
      '41fd863e-b0f2-4ae3-b932-5ffbed336b07',
    ),
  ],
  [
    'changed manifest',
    original.text.replace(
      'ce83f88555c4c2a31ef5815a21de74a14cdb1827a65807309465f1fe93bf2f8f',
      'a'.repeat(64),
    ),
  ],
])(
  'rejects %s with the full authentic payload and lineage otherwise retained',
  (_name, message) => {
    expect(() =>
      recoverT3Original({
        parentThreadId: observed.thread.parentThreadId,
        childThreadId: observed.thread.threadId,
        childRunId: original.runId,
        expectedText: request.task,
        role: request.role,
        policy: 'review-role-v1',
        observations: observationsFor(message),
        toolData: (value) => value,
      }),
    ).toThrow('Original message differs');
  },
);
it('rejects the review wrapper for a different requested role', () => {
  expect(() =>
    recoverT3Original({
      parentThreadId: observed.thread.parentThreadId,
      childThreadId: observed.thread.threadId,
      childRunId: original.runId,
      expectedText: request.task,
      role: 'implementation',
      policy: 'review-role-v1',
      observations: observationsFor(),
      toolData: (value) => value,
    }),
  ).toThrow('Original message differs');
});
it('keeps archived bare-task equality distinct from review-role-v1', () => {
  const args = {
    parentThreadId: observed.thread.parentThreadId,
    childThreadId: observed.thread.threadId,
    childRunId: original.runId,
    expectedText: request.task,
    role: request.role,
    policy: 'bare-task-v2',
    toolData: (value: unknown) => value,
  } as const;
  expect(
    recoverT3Original({ ...args, observations: observationsFor(request.task) }),
  ).toMatchObject({
    kind: 'complete',
    text: request.task,
  });
  expect(() =>
    recoverT3Original({ ...args, observations: observationsFor() }),
  ).toThrow('Original message differs');
});
