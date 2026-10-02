import { Briefcase } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { requireProfile } from "@/lib/auth";
import { brand } from "@/config/brand";
import { envConfigured } from "@/lib/supabase/server";
import { demoTasksToday, demoTasksWeek, type DemoTask } from "@/lib/demo";

export const dynamic = "force-dynamic";

function TaskCard({ t }: { t: DemoTask }) {
  const s = brand.status[t.status];
  return (
    <div className="rounded-xl p-4 mt-3" style={{ border: "1px solid var(--line)", background: "var(--card)" }}>
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-semibold text-sm">{t.service}</p>
        <span className="pill" style={{ background: s.bg, color: s.fg }}><span className="d" />{s.label}</span>
        <span className="pill" style={t.dueLate ? { background: "#FEF2F2", color: "#DC2626" } : { background: "#F1EEEB", color: "#7A726B" }}>
          <span className="d" />{t.due}
        </span>
      </div>
      <p className="text-sm mt-2">{t.client} · <span className="num">{t.phone}</span></p>
      <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{t.note}</p>
    </div>
  );
}

export default async function EmployeeToday() {
  const p = await requireProfile(["employee"]);
  const demo = !envConfigured();
  const today = demo ? demoTasksToday : [];
  const week = demo ? demoTasksWeek : [];
  return (
    <Shell role="employee" fullName={p.full_name} username={p.username} active="/employee/today">
      <div className="flex items-center gap-3 mb-1">
        <span className="tile tile-sm t-emerald"><Briefcase size={18} /></span>
        <h1 className="font-display font-bold text-2xl">My Work</h1>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        {demo ? "Demo tasks — live assignment arrives in Phase 3." : "Tasks assigned to you appear here from Phase 3."}
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass-card p-6">
          <h2 className="font-display font-semibold">Due today / overdue</h2>
          {today.length === 0
            ? <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>Nothing assigned yet.</p>
            : today.map((t) => <TaskCard key={t.id} t={t} />)}
        </div>
        <div className="glass-card p-6">
          <h2 className="font-display font-semibold">This week</h2>
          {week.length === 0
            ? <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>Nothing assigned yet.</p>
            : week.map((t) => <TaskCard key={t.id} t={t} />)}
        </div>
      </div>
    </Shell>
  );
}
