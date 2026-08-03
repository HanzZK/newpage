/**
 * Shared between server actions and the client forms that call them, so this
 * file must stay free of any server-only import.
 */
export type ActionState = {
  ok: boolean;
  message: string | null;
};

export const idleState: ActionState = { ok: false, message: null };
