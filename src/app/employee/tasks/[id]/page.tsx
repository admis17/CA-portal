import { ArrowLeft, Download, FileText } from "lucide-react";
import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { requireProfile } from "@/lib/auth";
import { brand } from "@/config/brand";
import { createClient, envConfigured } from "@/lib/supabase/server";
import { addComment, updateStatus } from "@/lib/actions/tasks";
import { formatBytes, getDemoItem } from "@/lib/demoStore";
import type { StatusKey } from "@/lib/demo";

export const dynamic = "force-dynamic";

const ORDER: StatusKey[] = ["unassigned", "assigned", "in_progress", "under_review", "completed"];
const LABEL: Record<StatusKey, string> = {
  unassigned: "Unassigned", assigned: "Assigned", in_progress: "In Progress",
  under_review: "Under Review", completed: "Completed",
};

type Detail = {
  id: string; service: string; note: string; status: StatusKey;
  client: string; phone: string; due: string; priority: string;
  files: { key: string; name: string; size: number; hasBytes: boolean }[];
  history: string[]; comments: { author: string; body: string; at: string }[];
};

async function realDetail(id: string, userId: string): Promise<Detail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("requests")
    .select("id,note,status,due_date,priority,assigned_at,started_at,completed_at,assigned_to,service:services(name),client:profiles!requests_client_id_fkey(full_name,phone,company_name),documents(id,file_name,size_bytes)")
    .eq("id", id)
    .single();
  const r = data as {
    id: string; note: string | null; status: StatusKey; due_date: string | null; priority: string;
    assigned_at: string | null; started_at: string | null; completed_at: string | null; assigned_to: string | null;
    service: { name: string }[] | { name: string } | null;
    client: { full_name: string; phone: string | null; company_name: string | null }[] | { full_name: string; phone: string | null; company_name: string | null } | null;
    documents: { id: string; file_name: string; size_bytes: number | null }[];
  } | null;
  if (!r || r.assigned_to !== userId) return null;
  const svc = Array.isArray(r.service) ? (r.service[0] ?? null) : r.service;
  const cli = Array.isArray(r.client) ? (r.client[0] ?? null) : r.client;
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—");
  const history = [
    r.assigned_at ? `Assigned · ${fmt(r.assigned_at)}` : null,
    r.started_at ? `Started · ${fmt(r.started_at)}` : null,
    r.completed_at ? `Completed · ${fmt(r.completed_at)}` : null,
  ].filter((x): x is string => !!x);
  const { data: cm } = await supabase.from("request_comments").select("author_id,body,created_at").eq("request_id", id).order("created_at");
  const comments = ((cm ?? []) as { author_id: string; body: string; created_at: string }[]).map((c) => ({
    author: c.author_id === userId ? "You" : "CA Team",
    body: c.body,
    at: new Date(c.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
  }));
  return {
    id: r.id, service: svc?.name ?? "—", note: r.note ?? "", status: r.status,
    client: cli?.company_name ? `${cli.full_name} · ${cli.company_name}` : (cli?.full_name ?? "—"),
    phone: cli?.phone ?? "—", due: r.due_date ?? "No due date", priority: r.priority,
    files: r.documents.map((d) => ({ key: d.id, name: d.file_name, size: d.size_bytes ?? 0, hasBytes: true })),
    history, comments,
  };
}

export default async function TaskDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const p = await requireProfile(["employee"]);
  const { id } = await params;
  const sp = await searchParams;
  const demo = !envConfigured();
  let t: Detail | null;
  if (demo) {
    const item = getDemoItem(id);
    t = !item || item.assignedTo !== p.username ? null : {
      id: item.id, service: item.service, note: item.note, status: item.status ?? "assigned",
      client: item.client, phone: item.phone, due: item.dueDate ?? "No due date", priority: item.priority ?? "normal",
      files: item.files.map((f, idx) => ({ key: f.key ?? `${item.id}/${idx}`, name: f.name, size: f.size, hasBytes: Boolean(f.key) })),
      history: item.history ?? [],
      comments: (item.comments ?? []).map((c) => ({ author: c.author === p.full_name ? "You" : c.author, body: c.body, at: c.at })),
    };
  } else {
    t = await realDetail(id, p.id);
  }
  if (!t) {
    return (
      <Shell role="employee" fullName={p.full_name} username={p.username} active="/employee/today">
        <div className="glass-card p-10 text-center">
          <p className="font-display font-semibold">Task not found</p>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>It may belong to someone else.</p>
          <Link href="/employee/today" className="btn-outline mt-4">Back to My Work</Link>
        </div>
      </Shell>
    );
  }
  const s = brand.status[t.status];
  const idx = ORDER.indexOf(t.status);
  const prev = idx > 0 ? ORDER[idx - 1] : null;
  const next = idx < ORDER.length - 1 ? ORDER[idx + 1] : null;
  const from = `/employee/tasks/${t.id}`;
  return (
    <Shell role="employee" fullName={p.full_name} username={p.username} active="/employee/today">
      <Link href="/employee/today" className="inline-flex items-center gap-1.5 text-sm font-semibold mb-3" style={{ color: "var(--muted)" }}>
        <ArrowLeft size={15} />My Work
      </Link>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="tile tile-sm t-emerald"><FileText size={18} /></span>
        <h1 className="font-display font-bold text-2xl">{t.service}</h1>
        <span className="pill" style={{ background: s.bg, color: s.fg }}><span className="d" />{s.label}</span>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        {t.client} · <span className="num">{t.phone}</span> · Due <span className="num">{t.due}</span> · Priority {t.priority}
      </p>
      {sp.error && <p className="pill mb-4" style={{ background: "#FEF2F2", color: "#DC2626" }}><span className="d" />{sp.error}</p>}
      {sp.ok && <p className="pill mb-4" style={{ background: "#F0FDF4", color: "#16A34A" }}><span className="d" />{sp.ok}</p>}
      {t.note && <div className="glass-card p-5 mb-4"><p className="text-sm">{t.note}</p></div>}

      <div className="glass-card p-6 mb-4">
        <h2 className="font-display font-semibold mb-3">Update status</h2>
        <div className="h-2 rounded-full mb-4" style={{ background: "var(--line)" }}>
          <div className="h-2 rounded-full" style={{ width: `${{ unassigned: 0, assigned: 25, in_progress: 50, under_review: 75, completed: 100 }[t.status]}%`, background: "linear-gradient(to right,#0F766E,#047857)" }} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {prev && prev !== "unassigned" && (
            <form action={updateStatus}>
              <input type="hidden" name="requestId" value={t.id} />
              <input type="hidden" name="to" value={prev} />
              <input type="hidden" name="from" value={from} />
              <button className="btn-outline" type="submit">← Back to {LABEL[prev]}</button>
            </form>
          )}
          {next && (
            <form action={updateStatus}>
              <input type="hidden" name="requestId" value={t.id} />
              <input type="hidden" name="to" value={next} />
              <input type="hidden" name="from" value={from} />
              <button className="btn-primary" type="submit">Move to {LABEL[next]} →</button>
            </form>
          )}
          {!prev && !next && <p className="text-sm" style={{ color: "var(--muted)" }}>Completed.</p>}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass-card p-6">
          <h2 className="font-display font-semibold mb-3">Documents</h2>
          {t.files.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>No files.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {t.files.map((f) => (
                <li key={f.key}>
                  {f.hasBytes ? (
                    <a href={`/api/files/${f.key}`} className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: "#047857" }}>
                      <Download size={14} />{f.name} <span className="font-normal num" style={{ color: "var(--muted)" }}>({formatBytes(f.size)})</span>
                    </a>
                  ) : (
                    <span className="text-sm" style={{ color: "var(--muted)" }}>{f.name} <span className="num">({formatBytes(f.size)} · demo preview)</span></span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <h2 className="font-display font-semibold mt-6 mb-2">Status history</h2>
          {t.history.length === 0
            ? <p className="text-sm" style={{ color: "var(--muted)" }}>No events yet.</p>
            : <ul className="text-sm flex flex-col gap-1.5">{t.history.map((h) => <li key={h}>· {h}</li>)}</ul>}
        </div>
        <div className="glass-card p-6">
          <h2 className="font-display font-semibold mb-3">Work notes</h2>
          {t.comments.length === 0
            ? <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>No notes yet. Internal only — clients never see these.</p>
            : <ul className="flex flex-col gap-3 mb-4">
                {t.comments.map((c, i) => (
                  <li key={`${c.at}-${i}`} className="rounded-xl p-3 text-sm" style={{ background: "color-mix(in srgb, var(--ink) 4%, transparent)" }}>
                    <p className="font-bold text-xs mb-1">{c.author} · <span className="font-normal num" style={{ color: "var(--muted)" }}>{c.at}</span></p>
                    <p>{c.body}</p>
                  </li>
                ))}
              </ul>}
          <form action={addComment} className="flex flex-col gap-2">
            <input type="hidden" name="requestId" value={t.id} />
            <input type="hidden" name="from" value={from} />
            <textarea name="body" rows={3} maxLength={2000} required className="input !h-auto !py-2.5" placeholder="Add an internal work note…" />
            <button className="btn-outline self-start" type="submit">Add note</button>
          </form>
        </div>
      </div>
    </Shell>
  );
}
