/** Portable function: its emitted JavaScript runs inside functions.exec, with real tools. */
export async function runT3ReviewCodeMode(
  args: {
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
      // Read form only: passing modelSelection would set the caller's model.
      mcp__t3_code__t3_thread_configure: (
        args: Record<string, never>,
      ) => Promise<unknown>;
      mcp__t3_code__task_status: (args: { taskId: string }) => Promise<unknown>;
      mcp__t3_code__t3_thread_read: (args: unknown) => Promise<unknown>;
    };
    root: string;
    dir: string;
  } & (
    | {
        operation: 'capture';
        config: string;
        reviewedRoot?: string;
        returned?: never;
      }
    | { operation: 'prepare'; returned?: never }
    | {
        operation: 'bind';
        /** The operator's direct delegate_task return, as received. */
        returned?: unknown;
      }
    | { operation: 'complete'; report: string; returned?: never }
  ),
) {
  const { tools, root, dir } = args;
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
      // The launcher turns tsx's disk cache off before tsx loads: tsx would
      // write it into the system temporary directory, which the bridge then
      // checks is not, is not inside and does not contain this round.
      cmd:
        'node scripts/catalog/start-without-tsx-cache.mjs scripts/catalog/t3-review-bridge.ts ' +
        quote(bytes),
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
  /**
   * The return (supplied, else the saved one) and this attempt's transport
   * directories travel in bridge calls of their own; the bounded next and
   * bind payloads are the status and the reads alone.
   */
  const bind = async (supplied: unknown): Promise<Record<string, unknown>> => {
    // A nested MCP error stops here, before the bridge sees the return.
    if (supplied !== undefined) toolData(supplied);
    // Rules 1 to 4, before any T3 tool call, writing nothing.
    const offered = await bridge({ action: 'offer', returned: supplied });
    if (offered.bound === true) return { bound: true };
    const caller = await tools.mcp__t3_code__t3_thread_configure({});
    toolData(caller);
    await bridge({ action: 'prepare', caller });
    const staged = await bridge({ action: 'stage', returned: supplied });
    if (staged.bound === true) return { bound: true };
    const { offer, taskId } = staged;
    if (typeof offer !== 'string' || typeof taskId !== 'string')
      throw Error('No staged dispatch return.');
    let evidence: unknown;
    try {
      const response = await tools.mcp__t3_code__task_status({ taskId });
      toolData(response);
      await bridge({ action: 'check', response, offer });
      const observations: { args: unknown; response: unknown }[] = [];
      for (let index = 0; index <= 32; index++) {
        const next = await bridge({ action: 'next', response, observations });
        if (next.kind === 'complete') {
          evidence = (await bridge({ action: 'bind', response, observations }))
            .evidence;
          if (typeof evidence !== 'string')
            throw Error('No staged dispatch evidence.');
          await bridge({ action: 'publish', offer, evidence });
          return { bound: true };
        }
        if (index === 32 || next.kind !== 'next')
          throw Error('Incomplete original-message recovery.');
        const read = await tools.mcp__t3_code__t3_thread_read(next.args);
        toolData(read);
        observations.push({ args: next.args, response: read });
      }
      throw Error('Original-message read bound exceeded.');
    } catch (error) {
      // Removing this attempt's transport directories is best effort.
      await bridge({ action: 'discard', offer, evidence }).catch(
        () => undefined,
      );
      throw error;
    }
  };
  // The type admits a return on bind only; emitted JavaScript checks it here.
  if (args.returned !== undefined && args.operation !== 'bind')
    throw Error('Only bind takes a dispatch return.');
  if (args.operation === 'bind') return bind(args.returned);
  const caller = await tools.mcp__t3_code__t3_thread_configure({});
  toolData(caller);
  if (args.operation === 'capture')
    return bridge({
      action: 'capture',
      root: args.reviewedRoot ?? root,
      config: args.config,
      caller,
    });
  const plan = await bridge({ action: 'prepare', caller });
  if (args.operation === 'prepare') {
    if (plan.returned !== null)
      throw Error('A dispatch return is already saved; never dispatch again.');
    return { ready: true };
  }
  if (plan.returned === null) throw Error('No capture-owned dispatch return.');
  const task = toolData(plan.returned);
  if (typeof task.taskId !== 'string')
    throw Error('Missing returned task identity.');
  const response = await tools.mcp__t3_code__task_status({
    taskId: task.taskId,
  });
  toolData(response);
  return bridge({ action: 'complete', response, report: args.report });
}
