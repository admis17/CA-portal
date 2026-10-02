import Link from "next/link";
import { brand } from "@/config/brand";
import { signUpClient } from "@/lib/actions/auth";

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <div className="min-h-screen grid place-items-center p-4 relative">
      <div className="ambient" aria-hidden><i /><i /><i /></div>
      <div className="glass-card relative z-10 w-full max-w-[440px] p-8">
        <h1 className="font-display font-bold text-xl">Create client account</h1>
        <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>{brand.firmName} · upload documents and track your requests.</p>
        {sp.error && <p className="pill mb-4" style={{ background: "#FEF2F2", color: "#DC2626" }}><span className="d" />{sp.error}</p>}
        <form action={signUpClient} className="flex flex-col gap-4">
          <div><label className="lbl" htmlFor="full_name">Full name</label><input id="full_name" name="full_name" className="input" required minLength={2} placeholder="Your full name" /></div>
          <div><label className="lbl" htmlFor="username">Username (for login)</label><input id="username" name="username" className="input" required minLength={3} pattern="[a-zA-Z0-9._-]+" placeholder="e.g. rahul.mehta" /></div>
          <div><label className="lbl" htmlFor="password">Password (min 8 chars)</label><input id="password" name="password" type="password" className="input" required minLength={8} autoComplete="new-password" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="lbl" htmlFor="phone">Phone</label><input id="phone" name="phone" className="input" placeholder="Optional" /></div>
            <div><label className="lbl" htmlFor="email">Contact email</label><input id="email" name="email" type="email" className="input" placeholder="Optional" /></div>
          </div>
          <button className="btn-primary w-full" type="submit">Create account</button>
        </form>
        <p className="text-sm mt-5 text-center" style={{ color: "var(--muted)" }}>
          Have an account? <Link href="/login" className="font-bold" style={{ color: brand.colors.primary }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
