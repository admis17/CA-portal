import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { homeForRole, type Role } from "@/config/brand";
import { createClient, envConfigured } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  role: Role;
  username: string;
  full_name: string;
  is_active: boolean;
  must_change_password: boolean;
};

// DEMO ONLY: session from the demo_session cookie; honoured only when Supabase is absent.
export async function demoProfile(): Promise<Profile | null> {
  try {
    const raw = (await cookies()).get("demo_session")?.value;
    if (!raw) return null;
    const d = JSON.parse(raw) as { role?: Role; username?: string; full_name?: string };
    if (!d.role || !homeForRole[d.role] || !d.username || !d.full_name) return null;
    return { id: `demo-${d.username}`, role: d.role, username: d.username, full_name: d.full_name, is_active: true, must_change_password: false };
  } catch {
    return null;
  }
}

// Server-only guard: wrong role -> own home; deactivated/missing -> login.
export async function requireProfile(allowed: Role[]): Promise<Profile> {
  if (!envConfigured()) {
    const d = await demoProfile();
    if (!d) redirect("/login");
    if (!allowed.includes(d.role)) redirect(homeForRole[d.role]);
    return d;
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: p } = await supabase
    .from("profiles")
    .select("id,role,username,full_name,is_active,must_change_password")
    .eq("id", data.user.id)
    .single();
  const profile = p as Profile | null;
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login?error=Account%20is%20deactivated.");
  }
  if (profile.must_change_password) redirect("/account/password");
  if (!allowed.includes(profile.role)) redirect(homeForRole[profile.role]);
  return profile;
}

export async function currentProfile(): Promise<Profile | null> {
  if (!envConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: p } = await supabase
    .from("profiles")
    .select("id,role,username,full_name,is_active,must_change_password")
    .eq("id", data.user.id)
    .single();
  return (p as Profile | null) ?? null;
}
