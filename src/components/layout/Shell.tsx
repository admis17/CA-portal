import Link from "next/link";
import { Briefcase, FileText, Inbox, LayoutDashboard, LogOut, Upload, Users } from "lucide-react";
import { brand, type Role } from "@/config/brand";
import { signOut } from "@/lib/actions/auth";

const nav: Record<Role, { href: string; label: string; Icon: typeof LayoutDashboard }[]> = {
  admin: [
    { href: "/admin/dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { href: "/admin/inbox", label: "Inbox", Icon: Inbox },
    { href: "/admin/employees", label: "Employees", Icon: Users },
  ],
  employee: [{ href: "/employee/today", label: "My Work", Icon: Briefcase }],
  client: [
    { href: "/client/requests", label: "My Requests", Icon: FileText },
    { href: "/client/upload", label: "Upload", Icon: Upload },
  ],
};

// Floating glass top bar with pill navigation (stitch mockup language, no sidebar).
// Collapses to a scrollable pill row on mobile (PRD: employees/clients on phones).
export function Shell({
  role, fullName, username, active, children,
}: { role: Role; fullName: string; username: string; active: string; children: React.ReactNode }) {
  const initials = fullName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
  return (
    <div className="min-h-screen">
      <div className="ambient" aria-hidden><i /><i /><i /></div>
      <header className="topbar-float">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <span className="grid place-items-center w-9 h-9 rounded-[10px] font-bold" style={{ background: brand.colors.gold, color: brand.colors.sidebar }}>M</span>
          <span className="hidden sm:block">
            <span className="block font-display font-bold text-sm leading-tight">{brand.firmName}</span>
            <span className="block text-[11px]" style={{ color: "var(--muted)" }}>{brand.tagline}</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto mx-auto" aria-label="Primary">
          {nav[role].map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={`navpill ${active === href ? "on" : ""}`}>
              <Icon size={15} />{label}
            </Link>
          ))}
        </nav>
        <span className="pill hidden lg:inline-flex shrink-0" style={{ background: "var(--card)", border: "1px solid var(--line)", color: "var(--muted)" }}>
          <span className="d" style={{ background: brand.colors.primary }} />{today}
        </span>
        <span className="avatar-chip shrink-0" title={`${fullName} (@${username})`}>{initials}</span>
        <form action={signOut} className="shrink-0">
          <button className="btn-outline !h-9 !px-3 !text-xs" type="submit" title="Logout">
            <LogOut size={14} /><span className="hidden md:inline">Logout</span>
          </button>
        </form>
      </header>
      <main className="relative z-10 w-full max-w-[1200px] mx-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
