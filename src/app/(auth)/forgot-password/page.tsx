import Link from "next/link";
import { brand } from "@/config/brand";
import { requestPasswordReset } from "@/lib/actions/auth";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <div className="min-h-screen grid place-items-center p-4 relative">
      <div className="ambient" aria-hidden><i /><i /><i /></div>
      <div className="glass-card relative z-10 w-full max-w-[400px] p-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="grid place-items-center w-11 h-11 rounded-xl font-bold" style={{ background: brand.colors.gold, color: brand.colors.sidebar }}>M</span>
          <div><h1 className="font-display font-bold text-lg leading-tight">Reset password</h1><p className="text-xs" style={{ color: "var(--muted)" }}>We email your contact address on file.</p></div>
        </div>
        {sp.error && <p className="pill mb-4" style={{ background: "#FEF2F2", color: "#DC2626" }}><span className="d" />{sp.error}</p>}
        {sp.ok && <p className="pill mb-4" style={{ background: "#F0FDF4", color: "#16A34A" }}><span className="d" />{sp.ok}</p>}
        <form action={requestPasswordReset} className="flex flex-col gap-4">
          <div><label className="lbl" htmlFor="username">Username</label><input id="username" name="username" className="input" autoComplete="username" required minLength={3} /></div>
          <button className="btn-primary w-full" type="submit">Send reset link</button>
        </form>
        <p className="text-sm mt-5 text-center" style={{ color: "var(--muted)" }}>
          <Link href="/login" className="font-bold" style={{ color: brand.colors.primary }}>Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
