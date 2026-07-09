import { Inspection } from '../../types';
import { getSupabase } from './client';
import { inspectionToRow, rowToInspection } from './mapping';

export interface SyncResult {
  ok: boolean;
  error?: string;
}

/** Push one inspection up (upsert by id). No-op when sync isn't configured or
 *  there's no authenticated session — the app keeps working locally. */
export async function pushClaim(insp: Inspection): Promise<SyncResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'sync-not-configured' };
  const { data: auth } = await sb.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return { ok: false, error: 'not-authenticated' };
  const { error } = await sb.from('claims').upsert(inspectionToRow(insp, uid), { onConflict: 'id' });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Pull all of the signed-in inspector's claims from the server. */
export async function pullClaims(): Promise<Inspection[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data: auth } = await sb.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];
  const { data, error } = await sb.from('claims').select('*').eq('owner_id', uid);
  if (error || !data) return [];
  return data.map((r) => rowToInspection(r as never));
}

/** Delete a claim server-side (mirrors a local delete). */
export async function deleteClaim(id: string): Promise<SyncResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'sync-not-configured' };
  const { error } = await sb.from('claims').delete().eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
