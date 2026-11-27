import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let storageClient: SupabaseClient | undefined;

export function getSupabaseStorageClient() {
  if (storageClient) return storageClient;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Evidence upload storage is not configured.');
  storageClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return storageClient;
}
