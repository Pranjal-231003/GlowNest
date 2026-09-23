import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

/* Resolve a Supabase secret key (the RLS-bypassing credential used by the functions).
   Hosted Edge Functions inject named keys as a JSON object, the local CLI stack
   injects a single key, and legacy projects still expose the service_role JWT. */
function secretKey(): string {
  const single = Deno.env.get("SUPABASE_SECRET_KEY");
  if (single) return single;

  const dict = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (dict) {
    try {
      const parsed = JSON.parse(dict) as Record<string, string>;
      const key = parsed.default ?? Object.values(parsed)[0];
      if (key) return key;
    } catch {
      // Malformed JSON: fall through to the legacy key below.
    }
  }

  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;

  throw new Error(
    "Missing Supabase secret key (SUPABASE_SECRET_KEY / SUPABASE_SECRET_KEYS / SUPABASE_SERVICE_ROLE_KEY)",
  );
}

export function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new Error("Missing SUPABASE_URL");
  return createClient(url, secretKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}
