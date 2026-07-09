import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSyncConfig } from './config';

let client: SupabaseClient | null = null;

/** Lazily create the Supabase client from config. Returns null when the app
 *  isn't configured for sync (then everything stays local/offline). Sessions
 *  persist in AsyncStorage and auto-refresh. */
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const cfg = getSyncConfig();
  if (!cfg) return null;
  client = createClient(cfg.url, cfg.anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // No URL-based OAuth callbacks in a native app.
      detectSessionInUrl: false,
    },
  });
  return client;
}
