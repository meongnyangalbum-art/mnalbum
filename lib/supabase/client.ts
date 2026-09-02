import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null | undefined;

// These values are intentionally public. Supabase publishable keys are designed
// to be shipped to browser clients; access to user data is enforced by RLS.
const PUBLIC_SUPABASE_URL = "https://rftuuktsmloapyevnacy.supabase.co";
const PUBLIC_SUPABASE_KEY = "sb_publishable_THmo7Uy32EMXfAq51RkMiA_c9POKGfS";

function getPublicConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PUBLIC_SUPABASE_KEY,
  };
}

export function isSupabaseConfigured() {
  const { url, key } = getPublicConfig();
  return Boolean(url && key);
}

export function getSupabase(): SupabaseClient | null {
  if (browserClient !== undefined) return browserClient;
  const { url, key } = getPublicConfig();
  browserClient = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
  return browserClient;
}
