import { Shell } from "@/components/layout/Shell";
import { requireProfile } from "@/lib/auth";
import { createClient, envConfigured } from "@/lib/supabase/server";
import { Alerts, type AlertItem } from "@/components/shared/Alerts";
import { getDemoNotifs } from "@/lib/demoStore";

export const dynamic = "force-dynamic";

const fmt = (d: string) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default async function AdminAlerts() {
  const p = await requireProfile(["admin"]);
  let items: AlertItem[];
  if (!envConfigured()) {
    items = getDemoNotifs(p.username);
  } else {
    const supabase = await createClient();
    const { data } = await supabase.from("notifications").select("id,message,is_read,created_at").eq("user_id", p.id).order("created_at", { ascending: false }).limit(50);
    items = ((data ?? []) as { id: string; message: string; is_read: boolean; created_at: string }[]).map((n) => ({ id: n.id, message: n.message, at: fmt(n.created_at), read: n.is_read }));
  }
  return (
    <Shell role="admin" fullName={p.full_name} username={p.username} active="/admin/alerts">
      <Alerts items={items} back="/admin/alerts" />
    </Shell>
  );
}
