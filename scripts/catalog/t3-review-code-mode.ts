/** Portable function: its emitted JavaScript runs inside functions.exec, with real tools. */
export async function runT3ReviewCodeMode({
  tools,
  root,
  dir,
  operation,
  config,
  report,
  reviewedRoot,
}: {
  tools: {
    exec_command: (args: {
      cmd: string;
      workdir: string;
      max_output_tokens: number;
    }) => Promise<{
      exit_code?: number;
      session_id?: number;
      output: string;
      original_token_count?: number;
    }>;
    mcp__t3_code__t3_thread_configuration: (args: object) => Promise<unknown>;
    mcp__t3_code__delegate_task: (args: unknown) => Promise<unknown>;
    mcp__t3_code__task_status: (args: { taskId: string }) => Promise<unknown>;
    mcp__t3_code__t3_thread_read: (args: unknown) => Promise<unknown>;
  };
  root: string;
  dir: string;
  operation: 'capture' | 'dispatch' | 'bind' | 'complete';
  config?: string;
  report?: string;
  reviewedRoot?: string;
}) {
  const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";
  function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw Error('Expected tool object.');
    return Object.fromEntries(Object.entries(value));
  }
  function toolData(value: unknown) {
    const envelope = object(value);
    if (envelope.isError) throw Error('T3 tool returned an error.');
    return envelope.structuredContent === undefined
      ? envelope
      : object(envelope.structuredContent);
  }
  async function bridge(payload: object) {
    const bytes = JSON.stringify({ ...payload, dir });
    // Code-mode V8 has ECMAScript intrinsics but no TextEncoder/Buffer.
    let byteLength = 0;
    for (const character of bytes) {
      const point = character.codePointAt(0) ?? 0;
      byteLength +=
        point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    }
    if (byteLength > 60000)
      throw Error('Bridge persistence bound exceeded; no binding written.');
    const result = await tools.exec_command({
      cmd:
        'node --import tsx scripts/catalog/t3-review-bridge.ts ' + quote(bytes),
      workdir: root,
      max_output_tokens: 10000,
    });
    if (
      result.exit_code !== 0 ||
      result.session_id !== undefined ||
      (result.original_token_count ?? 0) > 10000
    )
      throw Error(
        'T3 bridge failed or output was incomplete: ' + result.output,
      );
    const parsed: unknown = JSON.parse(result.output);
    return object(parsed);
  }
  const caller = await tools.mcp__t3_code__t3_thread_configuration({});
  toolData(caller);
  if (operation === 'capture')
    return bridge({
      action: 'capture',
      root: reviewedRoot ?? root,
      config,
      caller,
    });
  const plan = await bridge({ action: 'prepare', caller });
  if (operation === 'complete') {
    if (plan.returned === null)
      throw Error('No capture-owned dispatch return.');
    const task = toolData(plan.returned);
    if (typeof task.taskId !== 'string')
      throw Error('Missing returned task identity.');
    const response = await tools.mcp__t3_code__task_status({
      taskId: task.taskId,
    });
    toolData(response);
    return bridge({ action: 'complete', response, report });
  }
  let returned = plan.returned;
  if (returned === null) {
    if (operation !== 'dispatch')
      throw Error(
        'No capture-owned dispatch return; retry dispatch with the frozen retry key.',
      );
    // The parsed frozen object goes directly to this tool; persist THIS call's return.
    returned = await tools.mcp__t3_code__delegate_task(plan.request);
    toolData(returned);
    await bridge({ action: 'returned', response: returned });
  }
  const dispatched = toolData(returned);
  if (typeof dispatched.taskId !== 'string')
    throw Error('Missing returned task identity.');
  const response = await tools.mcp__t3_code__task_status({
    taskId: dispatched.taskId,
  });
  toolData(response);
  const observations: { args: unknown; response: unknown }[] = [];
  for (let index = 0; index <= 32; index++) {
    const next = await bridge({ action: 'next', response, observations });
    if (next.kind === 'complete')
      return bridge({ action: 'bind', response, observations });
    if (index === 32 || next.kind !== 'next')
      throw Error('Incomplete original-message recovery.');
    const read = await tools.mcp__t3_code__t3_thread_read(next.args);
    toolData(read);
    observations.push({ args: next.args, response: read });
  }
  throw Error('Original-message read bound exceeded.');
}
