import Link from "next/link";
import { Briefcase } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { requireProfile } from "@/lib/auth";
import { brand } from "@/config/brand";
import { createClient, envConfigured } from "@/lib/supabase/server";
import { getDemoEmployeeTasks } from "@/lib/demoStore";
import type { StatusKey } from "@/lib/demo";

export const dynamic = "force-dynamic";

export type WorkTask = {
  id: string; service: string; client: string; phone: string;
  due: string; dueLate: boolean; status: StatusKey; note: string;
};

async function realTasks(userId: string): Promise<WorkTask[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("requests")
    .select("id,note,status,due_date,priority,service:services(name),client:profiles!requests_client_id_fkey(full_name,phone)")
    .eq("assigned_to", userId)
    .neq("status", "completed")
    .order("due_date", { ascending: true, nullsFirst: false });
  const rows = (data ?? []) as {
    id: string; note: string | null; status: StatusKey; due_date: string | null; priority: string;
    service: { name: string }[] | { name: string } | null;
    client: { full_name: string; phone: string | null }[] | { full_name: string; phone: string | null } | null;
  }[];
  const todayStr = new Date().toISOString().slice(0, 10);
  return rows.map((r) => {
    const svc = Array.isArray(r.service) ? (r.service[0] ?? null) : r.service;
    const cli = Array.isArray(r.client) ? (r.client[0] ?? null) : r.client;
    const late = !!r.due_date && r.due_date < todayStr;
    return {
      id: r.id, service: svc?.name ?? "—", client: cli?.full_name ?? "—", phone: cli?.phone ?? "—",
      due: !r.due_date ? "No due date" : late ? `Overdue · ${r.due_date}` : r.due_date === todayStr ? "Due today" : `Due ${r.due_date}`,
      dueLate: late, status: r.status, note: r.note ?? "",
    };
  });
}

function TaskCard({ t }: { t: WorkTask }) {
  const s = brand.status[t.status];
  return (
    <Link href={`/employee/tasks/${t.id}`} className="block rounded-xl p-4 mt-3 hover:shadow-md transition-shadow" style={{ border: "1px solid var(--line)", background: "var(--card)" }}>
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-semibold text-sm">{t.service}</p>
        <span className="pill" style={{ background: s.bg, color: s.fg }}><span className="d" />{s.label}</span>
        <span className="pill" style={t.dueLate ? { background: "#FEF2F2", color: "#DC2626" } : { background: "#F1EEEB", color: "#7A726B" }}>
          <span className="d" />{t.due}
        </span>
      </div>
      <p className="text-sm mt-2">{t.client} · <span className="num">{t.phone}</span></p>
      <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{t.note}</p>
    </Link>
  );
}

export default async function EmployeeToday({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const p = await requireProfile(["employee"]);
  const sp = await searchParams;
  const demo = !envConfigured();
  let today: WorkTask[];
  let week: WorkTask[];
  if (demo) {
    const g = getDemoEmployeeTasks(p.username);
    const map = (i: (typeof g.today)[number]): WorkTask => ({
      id: i.id, service: i.service, client: i.client, phone: i.phone,
      due: i.dueDate ?? "No due date", dueLate: (i.dueDate ?? "").startsWith("Overdue"),
      status: i.status ?? "assigned", note: i.note,
    });
    today = g.today.map(map);
    week = g.week.map(map);
  } else {
    const all = await realTasks(p.id);
    today = all.filter((t) => t.dueLate || t.due === "Due today" || (t.due !== "No due date" && t.status === "in_progress"));
    week = all.filter((t) => !today.some((x) => x.id === t.id));
  }
  return (
    <Shell role="employee" fullName={p.full_name} username={p.username} active="/employee/today">
      <div className="flex items-center gap-3 mb-1">
        <span className="tile tile-sm t-emerald"><Briefcase size={18} /></span>
        <h1 className="font-display font-bold text-2xl">My Work</h1>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        {demo ? "Demo tasks — live assignment arrives with Supabase." : "Your assigned tasks."}
      </p>
      {sp.error && <p className="pill mb-4" style={{ background: "#FEF2F2", color: "#DC2626" }}><span className="d" />{sp.error}</p>}
      {sp.ok && <p className="pill mb-4" style={{ background: "#F0FDF4", color: "#16A34A" }}><span className="d" />{sp.ok}</p>}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass-card p-6">
          <h2 className="font-display font-semibold">Due today / overdue</h2>
          {today.length === 0
            ? <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>Nothing due — nice.</p>
            : today.map((t) => <TaskCard key={t.id} t={t} />)}
        </div>
        <div className="glass-card p-6">
          <h2 className="font-display font-semibold">This week</h2>
          {week.length === 0
            ? <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>Nothing else this week.</p>
            : week.map((t) => <TaskCard key={t.id} t={t} />)}
        </div>
      </div>
    </Shell>
  );
}
