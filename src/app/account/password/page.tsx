import { redirect } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { currentProfile } from "@/lib/auth";
import { updateOwnPassword } from "@/lib/actions/auth";
import { createClient, envConfigured } from "@/lib/supabase/server";
import type { Role } from "@/config/brand";

export const dynamic = "force-dynamic";

export default async function PasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (!envConfigured()) redirect("/login");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const p = await currentProfile();
  if (!p) redirect("/login");
  return (
    <Shell role={p.role as Role} fullName={p.full_name} username={p.username} active="">
      <h1 className="font-display font-bold text-2xl">Change password</h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>First login with a temp password? Set your own here.</p>
      {sp.notice && <p className="pill mb-4" style={{ background: "#FFFBEB", color: "#D97706" }}><span className="d" />{sp.notice}</p>}
      {sp.error && <p className="pill mb-4" style={{ background: "#FEF2F2", color: "#DC2626" }}><span className="d" />{sp.error}</p>}
      <div className="glass-card p-6 max-w-[440px]">
        <form action={updateOwnPassword} className="flex flex-col gap-4">
          <div><label className="lbl" htmlFor="password">New password (min 8 chars)</label><input id="password" name="password" type="password" className="input" required minLength={8} autoComplete="new-password" /></div>
          <div><label className="lbl" htmlFor="confirm">Confirm password</label><input id="confirm" name="confirm" type="password" className="input" required minLength={8} autoComplete="new-password" /></div>
          <button className="btn-primary" type="submit">Save password</button>
        </form>
      </div>
    </Shell>
  );
}
