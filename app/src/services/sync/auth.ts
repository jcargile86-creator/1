import { getSupabase } from './client';

export interface RemoteAuthResult {
  ok: boolean;
  userId?: string;
  error?: string;
}

/** Server-backed sign-in (email + password). Enables cross-device and
 *  password recovery. Falls through to not-configured when sync is off. */
export async function signInRemote(email: string, password: string): Promise<RemoteAuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'sync-not-configured' };
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, userId: data.user?.id };
}

/** Create a server account; display name + contact ride in user metadata and
 *  the DB trigger materializes a profile row. */
export async function signUpRemote(
  email: string,
  password: string,
  displayName: string,
  contact?: string,
): Promise<RemoteAuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'sync-not-configured' };
  const { data, error } = await sb.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { display_name: displayName.trim(), contact: contact?.trim() || null } },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, userId: data.user?.id };
}

export async function signOutRemote(): Promise<void> {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}

/** Current authenticated user id, or null. */
export async function getRemoteUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}
