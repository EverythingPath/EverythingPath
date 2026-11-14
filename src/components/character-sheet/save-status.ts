export type SaveStatus =
  | { kind: 'idle' | 'saving' | 'saved' }
  | { kind: 'error'; message: string };
