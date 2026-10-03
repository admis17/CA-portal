import { Bell } from "lucide-react";
import { markAllRead } from "@/lib/actions/notifications";

export type AlertItem = { id: string; message: string; at: string; read: boolean };

export function Alerts({ items, back }: { items: AlertItem[]; back: string }) {
  const unread = items.filter((i) => !i.read).length;
  return (
    <>
      <div className="flex items-center gap-3 mb-1 flex-wrap">
        <span className="tile tile-sm t-gold"><Bell size={18} /></span>
        <h1 className="font-display font-bold text-2xl">Alerts</h1>
        {unread > 0 && <span className="pill" style={{ background: "#FFFBEB", color: "#D97706" }}><span className="d" />{unread} unread</span>}
        {unread > 0 && (
          <form action={markAllRead} className="ml-auto">
            <input type="hidden" name="from" value={back} />
            <button className="btn-outline !h-8 !text-xs" type="submit">Mark all read</button>
          </form>
        )}
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Every handoff lands here automatically.</p>
      {items.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="font-display font-semibold">All caught up</p>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>New assignments and status changes will appear here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((n) => (
            <div key={n.id} className="glass-card p-4 flex items-start gap-3" style={n.read ? { opacity: 0.65 } : undefined}>
              <span className="pill mt-0.5" style={n.read ? { background: "#F1EEEB", color: "#7A726B" } : { background: "#E8F1FD", color: "#2563EB" }}>
                <span className="d" />{n.read ? "Read" : "New"}
              </span>
              <div><p className="text-sm">{n.message}</p><p className="text-xs num mt-0.5" style={{ color: "var(--muted)" }}>{n.at}</p></div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
