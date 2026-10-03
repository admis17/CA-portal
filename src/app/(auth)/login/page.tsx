import Link from "next/link";
import { FileCheck2, ShieldCheck, Timer } from "lucide-react";
import { brand } from "@/config/brand";
import { signIn } from "@/lib/actions/auth";

function Banner() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  return (
    <div className="mb-4 rounded-xl p-3 text-xs" style={{ background: "#FFFBEB", color: "#92400e" }}>
      <p className="pill mb-2" style={{ background: "#FFF4D9", color: "#D98B00" }}><span className="d" />Demo mode — no Supabase connected</p>
      <p className="num">admin / demo1234 · employee / demo1234 · client / demo1234</p>
    </div>
  );
}

const features = [
  { Icon: Timer, title: "Live status tracking", text: "Every handoff tracked from upload to completion." },
  { Icon: ShieldCheck, title: "Private document vault", text: "Bank-grade access control on every file." },
  { Icon: FileCheck2, title: "Owner performance reports", text: "Weekly, monthly and lifetime numbers." },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <div className="min-h-screen grid place-items-center p-4 relative">
      <div className="ambient" aria-hidden><i /><i /><i /></div>
      <div className="relative z-10 w-full max-w-[880px] grid md:grid-cols-2 overflow-hidden rounded-[24px]" style={{ background: "var(--card)", border: "1px solid var(--line)", boxShadow: "0 20px 50px -20px rgba(5,46,39,.35)" }}>
        {/* Brand panel (stitch login mockup) */}
        <div className="hidden md:flex flex-col gap-6 p-10 text-white" style={{ background: `linear-gradient(160deg, #052E27, #047857)` }}>
          <div className="flex items-center gap-3">
            <span className="grid place-items-center w-10 h-10 rounded-xl font-bold" style={{ background: brand.colors.gold, color: brand.colors.sidebar }}>M</span>
            <div>
              <p className="font-display font-bold text-sm leading-tight">MEHRA & ASSOCIATES</p>
              <p className="text-[11px] tracking-widest" style={{ color: brand.colors.gold }}>CHARTERED ACCOUNTANTS</p>
            </div>
          </div>
          <h1 className="font-display font-bold text-[32px] leading-tight">Your books, filings and deadlines. <span style={{ color: "#F3D27A" }}>One secure place.</span></h1>
          <div className="flex flex-col gap-4">
            {features.map(({ Icon, title, text }) => (
              <div key={title} className="flex gap-3 rounded-2xl p-4" style={{ background: "rgba(255,255,255,.08)" }}>
                <span className="tile tile-sm" style={{ background: "rgba(212,160,23,.2)", color: "#F3D27A" }}><Icon size={18} /></span>
                <div><p className="font-semibold text-sm">{title}</p><p className="text-xs opacity-70">{text}</p></div>
              </div>
            ))}
          </div>
          <p className="text-[11px] mt-auto opacity-70">Peer Reviewed Practice · Reg. No. 018429N · ICAI Validated</p>
        </div>
        {/* Form panel */}
        <div className="p-8 md:p-10">
          <p className="eyebrow">Fiduciary Secure Gateway</p>
          <h2 className="font-display font-bold text-2xl mt-1">Welcome Back</h2>
          <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Sign in to access your portal.</p>
          <Banner />
          {sp.error && <p className="pill mb-4" style={{ background: "#FEF2F2", color: "#DC2626" }}><span className="d" />{sp.error}</p>}
          {sp.ok && <p className="pill mb-4" style={{ background: "#F0FDF4", color: "#16A34A" }}><span className="d" />{sp.ok}</p>}
          {sp.notice && <p className="pill mb-4" style={{ background: "#FFFBEB", color: "#D97706" }}><span className="d" />{sp.notice}</p>}
          <form action={signIn} className="flex flex-col gap-4">
            <div><label className="lbl" htmlFor="username">Username</label><input id="username" name="username" className="input" autoComplete="username" required minLength={3} placeholder="e.g. priya.sharma" /></div>
            <div><label className="lbl" htmlFor="password">Password</label><input id="password" name="password" type="password" className="input" autoComplete="current-password" required placeholder="••••••••" /></div>
            <div className="flex justify-end"><Link href="/forgot-password" className="text-xs font-bold" style={{ color: brand.colors.primary }}>Forgot password?</Link></div>
            <button className="btn-primary w-full !h-11" type="submit">Sign In to Secure Portal</button>
          </form>
          <p className="text-sm mt-5 text-center" style={{ color: "var(--muted)" }}>
            New client? <Link href="/signup" className="font-bold" style={{ color: brand.colors.primary }}>Create account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
