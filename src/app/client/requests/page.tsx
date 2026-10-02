import { FileText } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { requireProfile } from "@/lib/auth";
import { brand } from "@/config/brand";
import { createClient, envConfigured } from "@/lib/supabase/server";
import { progressFor, type StatusKey } from "@/lib/demo";
import { getDemoClientRequests } from "@/lib/demoStore";

export const dynamic = "force-dynamic";

type Req = { id: string; service: string; note: string; status: StatusKey; updated: string };

async function realRequests(clientId: string): Promise<Req[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("requests")
    .select("id,note,status,created_at,service:services(name)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as {
    id: string; note: string | null; status: StatusKey; created_at: string;
    service: { name: string }[] | { name: string } | null;
  }[];
  return rows.map((r) => {
    const svc = Array.isArray(r.service) ? (r.service[0] ?? null) : r.service;
    return {
      id: r.id, service: svc?.name ?? "—", note: r.note ?? "",
      status: r.status,
      updated: new Date(r.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
    };
  });
}

export default async function ClientRequests({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const p = await requireProfile(["client"]);
  const sp = await searchParams;
  const demo = !envConfigured();
  const requests = demo ? getDemoClientRequests(p.username) : await realRequests(p.id);
  return (
    <Shell role="client" fullName={p.full_name} username={p.username} active="/client/requests">
      <div className="flex items-center gap-3 mb-1">
        <span className="tile tile-sm t-emerald"><FileText size={18} /></span>
        <h1 className="font-display font-bold text-2xl">My Requests</h1>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        {demo ? "Demo requests — uploads and live tracking arrive in Phases 2–4." : "Your uploads with live status."}
      </p>
      {sp.ok && <p className="pill mb-4" style={{ background: "#F0FDF4", color: "#16A34A" }}><span className="d" />{sp.ok}</p>}
      {requests.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="font-display font-semibold">No requests yet</p>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Your document uploads will show here with a progress bar.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {requests.map((r) => {
            const s = brand.status[r.status];
            const pct = progressFor[r.status];
            return (
              <div key={r.id} className="glass-card p-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-display font-semibold">{r.service}</p>
                  <span className="pill" style={{ background: s.bg, color: s.fg }}><span className="d" />{s.label}</span>
                </div>
                <p className="text-sm mt-1">{r.note}</p>
                <div className="h-2 rounded-full mt-3" style={{ background: "var(--line)" }}>
                  <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(to right,#0F766E,#047857)" }} />
                </div>
                <p className="text-xs mt-2 num" style={{ color: "var(--muted)" }}>{pct}% · {r.updated}</p>
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
