import { CheckCircle2, Gauge, History, Inbox, Timer } from "lucide-react";
import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { requireProfile } from "@/lib/auth";
import { brand } from "@/config/brand";
import { createClient, envConfigured } from "@/lib/supabase/server";
import { demoActivity } from "@/lib/demo";

export const dynamic = "force-dynamic";

type Period = "7" | "30" | "all";
const PERIODS: { v: Period; label: string }[] = [
  { v: "7", label: "This week" },
  { v: "30", label: "This month" },
  { v: "all", label: "Lifetime" },
];

type Metrics = {
  assigned: number; completed: number; onTime: string; turnaround: string;
  team: { name: string; assigned: number; completed: number; onTime: string; open: number }[];
  breakdown: { label: string; count: number; fg: string; bg: string }[];
  activity: { text: string; time: string }[];
};

async function realMetrics(period: Period): Promise<Metrics> {
  const supabase = await createClient();
  const since = period === "all" ? null : new Date(Date.now() - Number(period) * 864e5).toISOString();
  let q = supabase.from("requests").select("id,status,assigned_to,assigned_at,started_at,completed_at,due_date,assignee:profiles!requests_assigned_to_fkey(full_name)");
  if (since) q = q.or(`assigned_at.gte.${since},completed_at.gte.${since}`);
  const { data } = await q;
  const rows = (data ?? []) as {
    id: string; status: "unassigned" | "assigned" | "in_progress" | "under_review" | "completed";
    assigned_to: string | null; assigned_at: string | null; completed_at: string | null; due_date: string | null;
    assignee: { full_name: string }[] | { full_name: string } | null;
  }[];
  const inP = (d: string | null) => !!d && (!since || d >= since);
  const assignedRows = rows.filter((r) => inP(r.assigned_at));
  const completedRows = rows.filter((r) => inP(r.completed_at));
  const withDue = completedRows.filter((r) => r.due_date);
  const onTimeN = withDue.filter((r) => (r.completed_at as string).slice(0, 10) <= (r.due_date as string)).length;
  const turns = completedRows
    .filter((r) => r.completed_at && r.assigned_at)
    .map((r) => (new Date(r.completed_at as string).getTime() - new Date(r.assigned_at as string).getTime()) / 864e5);
  // ponytail: full-table scan in JS; move to SQL aggregates past ~10k requests
  const byEmp = new Map<string, { name: string; assigned: number; completed: number; on: number; due: number; open: number }>();
  for (const r of rows) {
    if (!r.assigned_to) continue;
    const name = (Array.isArray(r.assignee) ? (r.assignee[0] ?? null) : r.assignee)?.full_name ?? "—";
    const e = byEmp.get(r.assigned_to) ?? { name, assigned: 0, completed: 0, on: 0, due: 0, open: 0 };
    if (inP(r.assigned_at)) e.assigned++;
    if (inP(r.completed_at)) {
      e.completed++;
      if (r.due_date) { e.due++; if ((r.completed_at as string).slice(0, 10) <= (r.due_date as string)) e.on++; }
    }
    if (r.status !== "completed") e.open++;
    byEmp.set(r.assigned_to, e);
  }
  const team = [...byEmp.values()]
    .map((e) => ({ ...e, onTime: e.due > 0 ? `${Math.round((e.on / e.due) * 100)}%` : "—" }))
    .sort((a, b) => b.assigned - a.assigned);
  const open = rows.filter((r) => r.status !== "completed");
  const breakdown = (Object.keys(brand.status) as (keyof typeof brand.status)[])
    .filter((k) => k !== "completed")
    .map((k) => ({ label: brand.status[k].label, count: open.filter((r) => r.status === k).length, fg: brand.status[k].fg, bg: brand.status[k].bg }));
  const { data: log } = await supabase.from("activity_log").select("action,entity,created_at").order("created_at", { ascending: false }).limit(6);
  const activity = ((log ?? []) as { action: string; entity: string | null; created_at: string }[]).map((l) => ({
    text: `${l.action}${l.entity ? ` · ${l.entity}` : ""}`,
    time: new Date(l.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
  }));
  return {
    assigned: assignedRows.length,
    completed: completedRows.length,
    onTime: withDue.length > 0 ? `${Math.round((onTimeN / withDue.length) * 100)}%` : "—",
    turnaround: turns.length > 0 ? `${(turns.reduce((a, b) => a + b, 0) / turns.length).toFixed(1)} days` : "—",
    team, breakdown, activity,
  };
}

const demoMetrics: Metrics = {
  assigned: 18, completed: 32, onTime: "92%", turnaround: "2.4 days",
  team: [
    { name: "Priya Sharma", assigned: 8, completed: 6, onTime: "100%", open: 5 },
    { name: "Rohan Das", assigned: 7, completed: 4, onTime: "75%", open: 7 },
    { name: "Sneha Iyer", assigned: 5, completed: 4, onTime: "100%", open: 3 },
  ],
  breakdown: [
    { label: "Unassigned", count: 6, fg: "#DC2626", bg: "#FEF2F2" },
    { label: "Assigned", count: 4, fg: "#2563EB", bg: "#EFF6FF" },
    { label: "In Progress", count: 5, fg: "#D97706", bg: "#FFFBEB" },
    { label: "Under Review", count: 3, fg: "#7C3AED", bg: "#F5F3FF" },
  ],
  activity: demoActivity,
};

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const p = await requireProfile(["admin"]);
  const sp = await searchParams;
  const period: Period = sp.period === "7" || sp.period === "all" ? sp.period : "30";
  const demo = !envConfigured();
  const m = demo ? demoMetrics : await realMetrics(period);
  const maxAssigned = Math.max(1, ...m.team.map((t) => t.assigned));
  const stats = [
    { label: `Assigned · ${PERIODS.find((x) => x.v === period)?.label}`, value: String(m.assigned), hint: "requests picked up in period", tile: "t-blue", Icon: Inbox },
    { label: `Completed · ${PERIODS.find((x) => x.v === period)?.label}`, value: String(m.completed), hint: "finished in period", tile: "t-emerald", Icon: CheckCircle2 },
    { label: "On-time %", value: m.onTime, hint: "completed on/before due date", tile: "t-gold", Icon: Gauge },
    { label: "Avg turnaround", value: m.turnaround, hint: "assigned → completed", tile: "t-violet", Icon: Timer },
  ];
  return (
    <Shell role="admin" fullName={p.full_name} username={p.username} active="/admin/dashboard">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <p className="eyebrow">Firm OS · Portal overview</p>
          <h1 className="font-display font-bold text-2xl mt-1">Dashboard</h1>
        </div>
        <div className="seg ml-auto" role="tablist" aria-label="Period">
          {PERIODS.map((x) => (
            <Link key={x.v} href={`/admin/dashboard?period=${x.v}`} className={`segbtn ${period === x.v ? "on" : ""}`}>{x.label}</Link>
          ))}
        </div>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        {demo ? "Demo data — connect Supabase for live metrics." : "Live numbers from requests and activity."}
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="glass-card p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="eyebrow">{s.label}</p>
              <span className={`tile tile-sm ${s.tile}`}><s.Icon size={18} /></span>
            </div>
            <p className="font-display font-bold text-[32px] leading-none mt-2 num">{s.value}</p>
            <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>{s.hint}</p>
          </div>
        ))}
      </div>

      <div className="glass-card p-6 mt-4">
        <h2 className="font-display font-semibold mb-1">Team performance</h2>
        <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>Assigned vs completed in period, with on-time rate and current open load.</p>
        {m.team.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>No assignments in this period.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {m.team.map((t) => (
              <li key={t.name}>
                <div className="flex items-baseline gap-2 text-sm flex-wrap">
                  <span className="font-semibold">{t.name}</span>
                  <span className="num" style={{ color: "var(--muted)" }}>{t.completed}/{t.assigned} done</span>
                  <span className="open-pill ml-auto">{t.open} open</span>
                  <span className="pill" style={{ background: "#F0FDF4", color: "#16A34A" }}><span className="d" />{t.onTime}</span>
                </div>
                <div className="h-2 rounded-full mt-1.5" style={{ background: "var(--line)" }}>
                  <div className="h-2 rounded-full" title={`${t.completed}/${t.assigned}`} style={{ width: `${Math.round((t.assigned / maxAssigned) * 100)}%`, background: "linear-gradient(to right,#0F766E,#047857)" }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <div className="glass-card p-6">
          <h2 className="font-display font-semibold mb-3">Work status breakdown</h2>
          {m.breakdown.every((b) => b.count === 0) ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>Nothing open right now.</p>
          ) : (
            <>
              <div className="flex h-3 rounded-full overflow-hidden mb-3" style={{ background: "var(--line)" }}>
                {m.breakdown.map((b) => {
                  const total = Math.max(1, m.breakdown.reduce((a, x) => a + x.count, 0));
                  return b.count === 0 ? null : <span key={b.label} title={`${b.label}: ${b.count}`} style={{ width: `${(b.count / total) * 100}%`, background: b.fg }} />;
                })}
              </div>
              <ul className="flex flex-col gap-2">
                {m.breakdown.map((b) => (
                  <li key={b.label} className="flex items-center gap-2 text-sm">
                    <span className="pill" style={{ background: b.bg, color: b.fg }}><span className="d" />{b.label}</span>
                    <span className="ml-auto num font-bold">{b.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="tile tile-sm t-emerald"><History size={18} /></span>
            <h2 className="font-display font-semibold">Recent activity</h2>
          </div>
          {m.activity.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>No activity yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {m.activity.map((a, i) => (
                <li key={`${a.text}-${i}`} className="text-sm">
                  <p>{a.text}</p>
                  <p className="text-xs num" style={{ color: "var(--muted)" }}>{a.time}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Shell>
  );
}
