import { Download, Inbox } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { requireProfile } from "@/lib/auth";
import { createClient, envConfigured } from "@/lib/supabase/server";
import { assignRequest } from "@/lib/actions/tasks";
import { formatBytes, getDemoInbox, type DemoInboxItem } from "@/lib/demoStore";
import { demoEmployees } from "@/lib/demo";

export const dynamic = "force-dynamic";

type InboxRow = {
  id: string; client: string; phone: string; service: string;
  note: string; received: string;
  files: { key: string; name: string; size: number; hasBytes: boolean }[];
};

async function realInbox(): Promise<InboxRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("requests")
    .select(
      "id,note,created_at,service:services(name),client:profiles!requests_client_id_fkey(full_name,phone,company_name),documents(id,file_name,size_bytes)"
    )
    .eq("status", "unassigned")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as {
    id: string; note: string | null; created_at: string;
    service: { name: string }[] | { name: string } | null;
    client: { full_name: string; phone: string | null; company_name: string | null }[] | { full_name: string; phone: string | null; company_name: string | null } | null;
    documents: { id: string; file_name: string; size_bytes: number | null }[];
  }[];
  const one = <T,>(v: T[] | T | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  return rows.map((r) => {
    const svc = one(r.service);
    const cli = one(r.client);
    return {
      id: r.id,
      client: cli?.company_name ? `${cli.full_name} · ${cli.company_name}` : (cli?.full_name ?? "—"),
      phone: cli?.phone ?? "—",
      service: svc?.name ?? "—",
      note: r.note ?? "",
      received: new Date(r.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
      files: r.documents.map((d) => ({ key: d.id, name: d.file_name, size: d.size_bytes ?? 0, hasBytes: true })),
    };
  });
}

function demoInbox(): InboxRow[] {
  return getDemoInbox().map((i: DemoInboxItem) => ({
    id: i.id, client: i.client, phone: i.phone, service: i.service,
    note: i.note, received: i.received,
    files: i.files.map((f, idx) => ({ key: f.key ?? `${i.id}/${idx}`, name: f.name, size: f.size, hasBytes: Boolean(f.key) })),
  }));
}

export default async function InboxPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const p = await requireProfile(["admin"]);
  const sp = await searchParams;
  const demo = !envConfigured();
  const items = demo ? demoInbox() : await realInbox();
  // Assign-form options: demo usernames, or live active employees.
  let employees: { id: string; full_name: string }[];
  if (demo) {
    employees = demoEmployees.filter((e) => e.is_active).map((e) => ({ id: e.username, full_name: e.full_name }));
  } else {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("id,full_name").eq("role", "employee").eq("is_active", true).order("full_name");
    employees = ((data ?? []) as { id: string; full_name: string }[]);
  }
  return (
    <Shell role="admin" fullName={p.full_name} username={p.username} active="/admin/inbox">
      <div className="flex items-center gap-3 mb-1 flex-wrap">
        <span className="tile tile-sm t-blue"><Inbox size={18} /></span>
        <h1 className="font-display font-bold text-2xl">Document Inbox</h1>
        <span className="pill" style={{ background: "#FEF2F2", color: "#DC2626" }}><span className="d" />{items.length} pending</span>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        {demo
          ? "Demo inbox — assigning moves the task to that employee's My Work."
          : "Unassigned client uploads. Assigning moves the task to that employee's My Work."}
      </p>
      {sp.error && <p className="pill mb-4" style={{ background: "#FEF2F2", color: "#DC2626" }}><span className="d" />{sp.error}</p>}
      {sp.ok && <p className="pill mb-4" style={{ background: "#F0FDF4", color: "#16A34A" }}><span className="d" />{sp.ok}</p>}
      {items.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="font-display font-semibold">Inbox zero</p>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>New client uploads will appear here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((r) => (
            <div key={r.id} className="glass-card p-5">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-display font-semibold">{r.client}</p>
                <span className="pill" style={{ background: "#EFF6FF", color: "#2563EB" }}><span className="d" />{r.service}</span>
              </div>
              <p className="text-sm mt-1 num">{r.phone} · Received {r.received}</p>
              {r.note && <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>“{r.note}”</p>}
              <ul className="flex flex-col gap-2 mt-3">
                {r.files.map((f) => (
                  <li key={f.key}>
                    {f.hasBytes ? (
                      <a href={`/api/files/${f.key}`} className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: "#047857" }}>
                        <Download size={14} />{f.name} <span className="font-normal num" style={{ color: "var(--muted)" }}>({formatBytes(f.size)})</span>
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
                        {f.name} <span className="num">({formatBytes(f.size)} · demo preview)</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <form action={assignRequest} className="grid sm:grid-cols-5 gap-2 mt-4 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
                <input type="hidden" name="requestId" value={r.id} />
                <input type="hidden" name="from" value="/admin/inbox" />
                <select name="employeeId" className="input sm:col-span-2" required defaultValue="">
                  <option value="" disabled>Assign to…</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
                <input name="due" type="date" className="input" required title="Due date" />
                <select name="priority" className="input" defaultValue="normal" title="Priority">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
                <button className="btn-primary !h-10" type="submit">Assign</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
