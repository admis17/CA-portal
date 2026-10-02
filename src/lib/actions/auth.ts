"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { homeForRole } from "@/config/brand";
import { createClient, envConfigured } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// DEMO ONLY: hardcoded logins that work solely when Supabase env is absent.
// The moment env vars are set, every branch below is skipped. Never use in prod.
const DEMO_USERS = [
  { username: "admin", password: "demo1234", role: "admin", full_name: "Demo Admin" },
  { username: "employee", password: "demo1234", role: "employee", full_name: "Priya Sharma" },
  { username: "client", password: "demo1234", role: "client", full_name: "Rahul Mehta" },
] as const;

// Login is username + password; Supabase Auth needs an email, so map to a synthetic one.
function toEmail(username: string) {
  return `${username.trim().toLowerCase()}@portal.internal`;
}

const signInSchema = z.object({ username: z.string().min(3).max(50), password: z.string().min(1) });
const signUpSchema = z.object({
  full_name: z.string().min(2).max(100),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9._-]+$/, "letters, numbers, . _ - only"),
  password: z.string().min(8).max(100),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal("")),
});
const employeeSchema = z.object({
  full_name: z.string().min(2).max(100),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9._-]+$/, "letters, numbers, . _ - only"),
  password: z.string().min(8).max(100),
});

async function callerIsAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;
  const { data: p } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  return (p as { role?: string } | null)?.role === "admin";
}

export async function signIn(formData: FormData) {
  const parsed = signInSchema.safeParse({ username: formData.get("username"), password: formData.get("password") });
  if (!parsed.success) redirect("/login?error=Enter%20a%20valid%20username%20and%20password.");
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    // DEMO ONLY (no Supabase configured): check hardcoded demo logins.
    const u = parsed.data.username.toLowerCase();
    const demo = DEMO_USERS.find((d) => d.username === u && d.password === parsed.data.password);
    if (!demo) redirect("/login?error=Invalid%20username%20or%20password.");
    (await cookies()).set(
      "demo_session",
      JSON.stringify({ role: demo.role, username: demo.username, full_name: demo.full_name }),
      { httpOnly: true, sameSite: "lax", path: "/" }
    );
    redirect(homeForRole[demo.role]);
  }
  const { error } = await supabase.auth.signInWithPassword({
    email: toEmail(parsed.data.username),
    password: parsed.data.password,
  });
  if (error) redirect("/login?error=Invalid%20username%20or%20password.");
  const { data } = await supabase.auth.getUser();
  const { data: p } = await supabase
    .from("profiles")
    .select("role,is_active,must_change_password")
    .eq("id", data.user?.id ?? "")
    .single();
  const profile = p as { role?: "admin" | "employee" | "client"; is_active?: boolean; must_change_password?: boolean } | null;
  if (!profile || profile.is_active === false) {
    await supabase.auth.signOut();
    redirect("/login?error=Account%20is%20deactivated.");
  }
  if (profile.must_change_password) redirect("/account/password?notice=Please%20set%20a%20new%20password.");
  redirect(homeForRole[profile.role ?? "client"]);
}

export async function signUpClient(formData: FormData) {
  const raw = {
    full_name: formData.get("full_name"), username: formData.get("username"),
    password: formData.get("password"), phone: formData.get("phone"), email: formData.get("email"),
  };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) redirect("/signup?error=Check%20your%20details%20and%20try%20again.");
  const username = parsed.data.username.toLowerCase();
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    redirect("/signup?error=Server%20not%20configured%20yet.");
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: toEmail(username), password: parsed.data.password, email_confirm: true,
  });
  if (error || !data.user) redirect(`/signup?error=${encodeURIComponent(error?.message ?? "Sign-up failed.")}`);
  const { error: pErr } = await admin.from("profiles").insert({
    id: data.user.id, role: "client", username,
    full_name: parsed.data.full_name,
    email: parsed.data.email || null, phone: parsed.data.phone || null,
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    redirect(`/signup?error=${encodeURIComponent(pErr.message.includes("duplicate") ? "Username is taken." : "Sign-up failed.")}`);
  }
  await admin.from("activity_log").insert({ actor_id: data.user.id, action: "signup", entity: "profiles", entity_id: data.user.id });
  // Auto sign-in after sign-up
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email: toEmail(username), password: parsed.data.password });
  redirect("/client/requests");
}

export async function signOut() {
  (await cookies()).delete("demo_session");
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    /* demo mode: nothing server-side to sign out */
  }
  redirect("/login");
}

function demoGuard() {
  if (!envConfigured()) redirect("/admin/employees?error=Demo%20mode%20—%20connect%20Supabase%20to%20manage%20employees.");
}

export async function createEmployee(formData: FormData) {
  demoGuard();
  if (!(await callerIsAdmin())) redirect("/login");
  const parsed = employeeSchema.safeParse({
    full_name: formData.get("full_name"), username: formData.get("username"), password: formData.get("password"),
  });
  if (!parsed.success) redirect("/admin/employees?error=Check%20name%2C%20username%20and%20password%20(min%208%20chars).");
  const username = parsed.data.username.toLowerCase();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: toEmail(username), password: parsed.data.password, email_confirm: true,
  });
  if (error || !data.user) redirect(`/admin/employees?error=${encodeURIComponent(error?.message ?? "Could not create employee.")}`);
  const { error: pErr } = await admin.from("profiles").insert({
    id: data.user.id, role: "employee", username,
    full_name: parsed.data.full_name, must_change_password: true,
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    redirect(`/admin/employees?error=${encodeURIComponent(pErr.message.includes("duplicate") ? "Username is taken." : "Could not create employee.")}`);
  }
  revalidatePath("/admin/employees");
  redirect(`/admin/employees?ok=Employee%20${encodeURIComponent(username)}%20created.%20Share%20the%20temp%20password%20securely.`);
}

export async function setEmployeeActive(formData: FormData) {
  demoGuard();
  if (!(await callerIsAdmin())) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  const admin = createAdminClient();
  await admin.from("profiles").update({ is_active: active }).eq("id", id);
  revalidatePath("/admin/employees");
  redirect(`/admin/employees?ok=${active ? "Employee%20reactivated." : "Employee%20deactivated.%20History%20kept."}`);
}

export async function resetEmployeePassword(formData: FormData) {
  demoGuard();
  if (!(await callerIsAdmin())) redirect("/login");
  const id = String(formData.get("id") ?? "");
  // ponytail: Math.random temp password; replace with crypto when emailed in Phase 6
  const temp = `Temp${Math.floor(100000 + Math.random() * 900000)}!`;
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password: temp });
  if (error) redirect(`/admin/employees?error=${encodeURIComponent(error.message)}`);
  await admin.from("profiles").update({ must_change_password: true }).eq("id", id);
  revalidatePath("/admin/employees");
  redirect(`/admin/employees?ok=Password%20reset.&temp=${encodeURIComponent(temp)}`);
}

const pwdSchema = z.object({ password: z.string().min(8).max(100), confirm: z.string() });

export async function updateOwnPassword(formData: FormData) {
  const parsed = pwdSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success || parsed.data.password !== parsed.data.confirm)
    redirect("/account/password?error=Passwords%20must%20match%20(min%208%20chars).");
  if (!envConfigured()) {
    // DEMO ONLY: nothing to change; send the demo user to its home.
    const raw = (await cookies()).get("demo_session")?.value;
    let home = "/login";
    try {
      const d = JSON.parse(raw ?? "") as { role?: "admin" | "employee" | "client" };
      if (d.role) home = homeForRole[d.role];
    } catch { /* stay on /login */ }
    redirect(home);
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) redirect(`/account/password?error=${encodeURIComponent(error.message)}`);
  const admin = createAdminClient();
  await admin.from("profiles").update({ must_change_password: false }).eq("id", data.user.id);
  const { data: p } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  redirect(homeForRole[(p as { role?: "admin" | "employee" | "client" } | null)?.role ?? "client"]);
}
