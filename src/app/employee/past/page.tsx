import Link from "next/link";
import { History } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { requireProfile } from "@/lib/auth";
import { brand } from "@/config/brand";
import { createClient, envConfigured } from "@/lib/supabase/server";
import { getDemoEmployeeTasks } from "@/lib/demoStore";

export const dynamic = "force-dynamic";

export default async function EmployeePast() {
  const p = await requireProfile(["employee"]);
  const demo = !envConfigured();
  let tasks: { id: string; service: string; client: string; done: string; late: boolean; href: string | null }[];
  if (demo) {
    tasks = getDemoEmployeeTasks(p.username).past.map((i) => ({
      id: i.id, service: i.service, client: i.client,
      done: i.dueDate ?? "Done", late: false, href: `/employee/tasks/${i.id}`,
    }));
  } else {
    const supabase = await createClient();
    const { data } = await supabase
      .from("requests")
      .select("id,completed_at,due_date,service:services(name),client:profiles!requests_client_id_fkey(full_name)")
      .eq("assigned_to", p.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false });
    const rows = (data ?? []) as {
      id: string; completed_at: string | null; due_date: string | null;
      service: { name: string }[] | { name: string } | null;
      client: { full_name: string }[] | { full_name: string } | null;
    }[];
    tasks = rows.map((r) => {
      const svc = Array.isArray(r.service) ? (r.service[0] ?? null) : r.service;
      const cli = Array.isArray(r.client) ? (r.client[0] ?? null) : r.client;
      const late = !!r.completed_at && !!r.due_date && r.completed_at.slice(0, 10) > r.due_date;
      return {
        id: r.id, service: svc?.name ?? "—", client: cli?.full_name ?? "—",
        done: r.completed_at ? new Date(r.completed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—",
        late, href: `/employee/tasks/${r.id}`,
      };
    });
  }
  return (
    <Shell role="employee" fullName={p.full_name} username={p.username} active="/employee/past">
      <div className="flex items-center gap-3 mb-1">
        <span className="tile tile-sm t-gold"><History size={18} /></span>
        <h1 className="font-display font-bold text-2xl">Past Tasks</h1>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Completed work with on-time / late labels.</p>
      {tasks.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="font-display font-semibold">Nothing completed yet</p>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Finished tasks will show here.</p>
        </div>
      ) : (
        <div className="glass-card p-2 md:p-4 overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Service</th><th>Client</th><th>Completed</th><th>Result</th><th></th></tr></thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td className="font-semibold">{t.service}</td>
                  <td>{t.client}</td>
                  <td className="num">{t.done}</td>
                  <td>
                    <span className="pill" style={t.late ? { background: "#FEF2F2", color: "#DC2626" } : { background: "#F0FDF4", color: "#16A34A" }}>
                      <span className="d" />{t.late ? "Late" : "On time"}
                    </span>
                  </td>
                  <td>{t.href && <Link href={t.href} className="text-sm font-bold" style={{ color: brand.colors.primary }}>Open</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
