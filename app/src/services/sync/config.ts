import Constants from 'expo-constants';

export interface SyncConfig {
  url: string;
  anonKey: string;
}

/** Supabase URL + anon key come from app.json -> extra, shippable via OTA.
 *  Absent = the app runs fully offline/local, exactly as before. */
export function getSyncConfig(): SyncConfig | null {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const url = typeof extra.supabaseUrl === 'string' ? extra.supabaseUrl : '';
  const anonKey = typeof extra.supabaseAnonKey === 'string' ? extra.supabaseAnonKey : '';
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export const isSyncConfigured = (): boolean => getSyncConfig() !== null;
