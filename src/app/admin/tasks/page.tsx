import { ClipboardList } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { requireProfile } from "@/lib/auth";
import { brand } from "@/config/brand";
import { createClient, envConfigured } from "@/lib/supabase/server";
import { assignRequest } from "@/lib/actions/tasks";
import { demoActivity, demoEmployees } from "@/lib/demo";
import { getDemoEmployeeTasks, getDemoInbox } from "@/lib/demoStore";
import { progressFor, type StatusKey } from "@/lib/demo";

export const dynamic = "force-dynamic";

const STATUSES: StatusKey[] = ["unassigned", "assigned", "in_progress", "under_review", "completed"];

type Row = {
  id: string; service: string; client: string; employee: string;
  due: string; status: StatusKey; note: string; assigneeKey: string;
};

async function realTasks(f: { status: string; employee: string; service: string }): Promise<Row[]> {
  const supabase = await createClient();
  let q = supabase
    .from("requests")
    .select("id,note,status,due_date,service:services(name),client:profiles!requests_client_id_fkey(full_name),assignee:profiles!requests_assigned_to_fkey(full_name)")
    .order("created_at", { ascending: false });
  if (f.status) q = q.eq("status", f.status);
  if (f.employee) q = q.eq("assigned_to", f.employee);
  if (f.service) q = q.eq("service_id", Number(f.service));
  const { data } = await q;
  const rows = (data ?? []) as {
    id: string; note: string | null; status: StatusKey; due_date: string | null;
    service: { name: string }[] | { name: string } | null;
    client: { full_name: string }[] | { full_name: string } | null;
    assignee: { full_name: string }[] | { full_name: string } | null;
  }[];
  const one = <T,>(v: T[] | T | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  return rows.map((r) => ({
    id: r.id, service: one(r.service)?.name ?? "—", client: one(r.client)?.full_name ?? "—",
    employee: one(r.assignee)?.full_name ?? "—", due: r.due_date ?? "—",
    status: r.status, note: r.note ?? "", assigneeKey: "",
  }));
}

export default async function AllTasks({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const p = await requireProfile(["admin"]);
  const sp = await searchParams;
  const demo = !envConfigured();
  const f = { status: sp.status ?? "", employee: sp.employee ?? "", service: sp.service ?? "" };

  let rows: Row[];
  let employees: { id: string; full_name: string }[];
  let services: { id: number; name: string }[];
  let activity: { text: string; time: string }[];
  if (demo) {
    const byUser = new Map(demoEmployees.map((e) => [e.username, e.full_name]));
    rows = getDemoInbox().map((i) => ({
      id: i.id, service: i.service, client: i.client,
      employee: i.assignedTo ? (byUser.get(i.assignedTo) ?? i.assignedTo) : "—",
      due: i.dueDate ?? "—", status: (i.status ?? "unassigned") as StatusKey, note: i.note,
      assigneeKey: i.assignedTo ?? "",
    }));
    const seen = new Set(rows.map((r) => r.id));
    for (const e of demoEmployees.filter((e) => e.is_active)) {
      const g = getDemoEmployeeTasks(e.username);
      for (const t of [...g.today, ...g.week, ...g.past]) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        rows.push({
          id: t.id, service: t.service, client: t.client, employee: e.full_name,
          due: t.dueDate ?? "—", status: (t.status ?? "assigned") as StatusKey, note: t.note,
          assigneeKey: e.username,
        });
      }
    }
    if (f.status) rows = rows.filter((r) => r.status === f.status);
    if (f.employee) rows = rows.filter((r) => r.assigneeKey === f.employee);
    if (f.service) rows = rows.filter((r) => r.service === brand.services[Number(f.service)]);
    // Demo keys are usernames (the store assigns by username).
    employees = demoEmployees.map((e) => ({ id: e.username, full_name: `${e.full_name}${e.is_active ? "" : " (deactivated)"}` }));
    services = brand.services.map((name, i) => ({ id: i, name }));
    activity = demoActivity;
  } else {
    rows = await realTasks(f);
    const supabase = await createClient();
    const { data: emps } = await supabase.from("profiles").select("id,full_name").eq("role", "employee").order("full_name");
    employees = ((emps ?? []) as { id: string; full_name: string }[]);
    const { data: svcs } = await supabase.from("services").select("id,name").eq("is_active", true).order("name");
    services = ((svcs ?? []) as { id: number; name: string }[]);
    const { data: log } = await supabase.from("activity_log").select("action,entity,created_at").order("created_at", { ascending: false }).limit(8);
    activity = ((log ?? []) as { action: string; entity: string | null; created_at: string }[]).map((l) => ({
      text: `${l.action}${l.entity ? ` · ${l.entity}` : ""}`,
      time: new Date(l.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
    }));
  }

  return (
    <Shell role="admin" fullName={p.full_name} username={p.username} active="/admin/tasks">
      <div className="flex items-center gap-3 mb-1 flex-wrap">
        <span className="tile tile-sm t-violet"><ClipboardList size={18} /></span>
        <h1 className="font-display font-bold text-2xl">All Tasks</h1>
        <span className="pill" style={{ background: "#F1EEEB", color: "#7A726B" }}><span className="d" />{rows.length} shown</span>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Every request with live status. Reassign from any row.</p>
      {sp.error && <p className="pill mb-4" style={{ background: "#FEF2F2", color: "#DC2626" }}><span className="d" />{sp.error}</p>}
      {sp.ok && <p className="pill mb-4" style={{ background: "#F0FDF4", color: "#16A34A" }}><span className="d" />{sp.ok}</p>}

      <form method="GET" action="/admin/tasks" className="glass-card p-4 mb-4 grid sm:grid-cols-4 gap-2">
        <select name="status" className="input" defaultValue={f.status}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{brand.status[s].label}</option>)}
        </select>
        <select name="employee" className="input" defaultValue={f.employee}>
          <option value="">All employees</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
        <select name="service" className="input" defaultValue={f.service}>
          <option value="">All services</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="btn-outline" type="submit">Filter</button>
      </form>

      <div className="glass-card p-2 md:p-4 overflow-x-auto">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-center" style={{ color: "var(--muted)" }}>No tasks match these filters.</p>
        ) : (
          <table className="tbl">
            <thead><tr><th>Client</th><th>Service</th><th>Employee</th><th>Due</th><th>Status</th><th>Progress</th><th>Reassign</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const s = brand.status[r.status];
                const pct = progressFor[r.status];
                return (
                  <tr key={r.id}>
                    <td className="font-semibold">{r.client}</td>
                    <td>{r.service}</td>
                    <td>{r.employee}</td>
                    <td className="num">{r.due}</td>
                    <td><span className="pill" style={{ background: s.bg, color: s.fg }}><span className="d" />{s.label}</span></td>
                    <td className="num" style={{ minWidth: 90 }}>
                      <div className="h-1.5 rounded-full" style={{ background: "var(--line)" }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(to right,#0F766E,#047857)" }} />
                      </div>
                    </td>
                    <td>
                      <form action={assignRequest} className="flex gap-1">
                        <input type="hidden" name="requestId" value={r.id} />
                        <input type="hidden" name="from" value="/admin/tasks" />
                        <select name="employeeId" className="input !h-8 !text-xs" required defaultValue="" title="Reassign">
                          <option value="" disabled>Move to…</option>
                          {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                        </select>
                        <button className="btn-outline !h-8 !text-xs shrink-0" type="submit">Go</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="glass-card p-6 mt-4">
        <h2 className="font-display font-semibold mb-3">Recent activity</h2>
        {activity.length === 0
          ? <p className="text-sm" style={{ color: "var(--muted)" }}>No activity yet.</p>
          : <ul className="flex flex-col gap-2.5">{activity.map((a, i) => (
            <li key={`${a.text}-${i}`} className="text-sm"><p>{a.text}</p><p className="text-xs num" style={{ color: "var(--muted)" }}>{a.time}</p></li>
          ))}</ul>}
      </div>
    </Shell>
  );
}
