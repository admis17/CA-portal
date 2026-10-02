import { Download, Inbox } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { requireProfile } from "@/lib/auth";
import { createClient, envConfigured } from "@/lib/supabase/server";
import { formatBytes, getDemoInbox, type DemoInboxItem } from "@/lib/demoStore";

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

export default async function InboxPage() {
  const p = await requireProfile(["admin"]);
  const demo = !envConfigured();
  const items = demo ? demoInbox() : await realInbox();
  return (
    <Shell role="admin" fullName={p.full_name} username={p.username} active="/admin/inbox">
      <div className="flex items-center gap-3 mb-1 flex-wrap">
        <span className="tile tile-sm t-blue"><Inbox size={18} /></span>
        <h1 className="font-display font-bold text-2xl">Document Inbox</h1>
        <span className="pill" style={{ background: "#FEF2F2", color: "#DC2626" }}><span className="d" />{items.length} pending</span>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        {demo
          ? "Demo inbox — staff assignment arrives in Phase 3."
          : "Unassigned client uploads. Staff assignment arrives in Phase 3."}
      </p>
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
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
