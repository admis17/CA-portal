import { createClient as createServiceClient } from "@supabase/supabase-js";

// Service-role client. SERVER ONLY — never import from client components.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !service) throw new Error("Supabase service role is not configured.");
  return createServiceClient(url, service, { auth: { persistSession: false } });
}
