import Link from "next/link";
import { brand } from "@/config/brand";
import { confirmPasswordReset } from "@/lib/actions/auth";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const email = sp.email ?? "";
  const token = sp.token ?? "";
  return (
    <div className="min-h-screen grid place-items-center p-4 relative">
      <div className="ambient" aria-hidden><i /><i /><i /></div>
      <div className="glass-card relative z-10 w-full max-w-[400px] p-8">
        <h1 className="font-display font-bold text-xl mb-1">Set a new password</h1>
        <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Links expire after 1 hour.</p>
        {(!email || !token) ? (
          <p className="pill mb-4" style={{ background: "#FEF2F2", color: "#DC2626" }}><span className="d" />This link is incomplete. Request a fresh one.</p>
        ) : (
          <form action={confirmPasswordReset} className="flex flex-col gap-4">
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="token" value={token} />
            <div><label className="lbl" htmlFor="password">New password (min 8 chars)</label><input id="password" name="password" type="password" className="input" required minLength={8} autoComplete="new-password" /></div>
            <div><label className="lbl" htmlFor="confirm">Confirm password</label><input id="confirm" name="confirm" type="password" className="input" required minLength={8} autoComplete="new-password" /></div>
            <button className="btn-primary w-full" type="submit">Save password</button>
          </form>
        )}
        <p className="text-sm mt-5 text-center" style={{ color: "var(--muted)" }}>
          <Link href="/login" className="font-bold" style={{ color: brand.colors.primary }}>Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
