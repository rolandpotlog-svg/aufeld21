import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      // The portal handles both PKCE self-service and implicit admin mail links.
      // Keep PKCE for outgoing browser requests; avoid a second callback consumer.
      { auth: { detectSessionInUrl: false } },
    );
  }
  return client;
}
