import { CheckCircle2, Gauge, History, Inbox, Loader, Users } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { requireProfile } from "@/lib/auth";
import { envConfigured } from "@/lib/supabase/server";
import { demoActivity, demoEmployees, demoStats } from "@/lib/demo";

const emptyStats = [
  { label: "Awaiting assignment", value: "0", hint: "Phase 2 wires live data", tile: "t-red", Icon: Inbox },
  { label: "In progress", value: "0", hint: "Phase 4 wires live data", tile: "t-amber", Icon: Loader },
  { label: "Completed", value: "0", hint: "Phase 4 wires live data", tile: "t-emerald", Icon: CheckCircle2 },
  { label: "On-time rate", value: "—", hint: "Phase 5 reports", tile: "t-gold", Icon: Gauge },
] as const;

const demoTiles = ["t-red", "t-amber", "t-emerald", "t-gold"] as const;
const demoIcons = [Inbox, Loader, CheckCircle2, Gauge] as const;

export default async function AdminDashboard() {
  const p = await requireProfile(["admin"]);
  const demo = !envConfigured();
  const stats = demo
    ? demoStats.map((s, i) => ({ ...s, tile: demoTiles[i], Icon: demoIcons[i] }))
    : emptyStats.map((s) => ({ ...s }));
  return (
    <Shell role="admin" fullName={p.full_name} username={p.username} active="/admin/dashboard">
      <p className="eyebrow">Firm OS · Portal overview</p>
      <h1 className="font-display font-bold text-2xl mt-1">Dashboard</h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        {demo ? "Demo data — connect Supabase for live metrics." : "Phase 1: shell + access control. Live metrics arrive in Phase 5."}
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
      {demo ? (
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="tile tile-sm t-emerald"><History size={18} /></span>
              <h2 className="font-display font-semibold">Recent activity</h2>
            </div>
            <ul className="flex flex-col gap-3">
              {demoActivity.map((a) => (
                <li key={a.text} className="text-sm">
                  <p>{a.text}</p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>{a.time}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="tile tile-sm t-gold"><Users size={18} /></span>
              <h2 className="font-display font-semibold">Team workload</h2>
            </div>
            <ul className="flex flex-col gap-3">
              {demoEmployees.filter((e) => e.is_active).map((e) => (
                <li key={e.id} className="flex items-center gap-3 text-sm">
                  <span className="avatar-chip !w-8 !h-8 !text-xs !rounded-full">
                    {e.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </span>
                  <span className="font-semibold">{e.full_name}</span>
                  <span className="open-pill ml-auto">{e.open} open</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
      <div className="glass-card p-6 mt-4">
        <h2 className="font-display font-semibold">Setup checklist</h2>
        <ul className="text-sm mt-2 list-disc pl-5" style={{ color: "var(--muted)" }}>
          <li>Run <code>supabase/migrations/001_foundation.sql</code> in your Supabase project (Mumbai region).</li>
          <li>Create the first admin via SQL (see README), then create employees on the Employees page.</li>
          <li>Document inbox, assignment and uploads land in Phases 2–3.</li>
        </ul>
      </div>
      )}
    </Shell>
  );
}
