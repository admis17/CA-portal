import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient, envConfigured } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDemoBytes, getDemoInbox } from "@/lib/demoStore";

// GET /api/files/<documentId> (real) or /api/files/demo/<reqId>/<idx> (demo).
// Server-side permission check first; bytes/redirect only after. Never a public URL.
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const joined = key.join("/");

  // DEMO ONLY branch: serve bytes kept in server memory.
  if (!envConfigured()) {
    const raw = (await cookies()).get("demo_session")?.value;
    let role: string | null = null;
    let username = "";
    try {
      const d = JSON.parse(raw ?? "") as { role?: string; username?: string };
      if (d.role === "admin" || d.role === "client" || d.role === "employee") { role = d.role; username = d.username ?? ""; }
    } catch { /* no session */ }
    if (!role) return NextResponse.redirect(new URL("/login", _req.url));
    const [, reqId, idx] = joined.split("/");
    const item = getDemoInbox().find((i) => i.id === reqId);
    const file = item?.files[Number(idx)];
    if (!item || !file?.key || file.key !== joined) return new NextResponse("Not found", { status: 404 });
    if (role === "client" && item.username !== username) return new NextResponse("Forbidden", { status: 403 });
    if (role === "employee") return new NextResponse("Forbidden", { status: 403 }); // demo: no assignments yet (Phase 3)
    const hit = getDemoBytes(joined);
    if (!hit) return new NextResponse("Not found", { status: 404 });
    return new Response(hit.buf as unknown as BodyInit, {
      headers: {
        "Content-Type": hit.mime,
        "Content-Disposition": `attachment; filename="${hit.name.replace(/"/g, "")}"`,
      },
    });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return new NextResponse("Unauthorized", { status: 401 });
  // RLS on documents: fetch succeeds only for admin, owning client, or assignee.
  const { data: doc } = await supabase
    .from("documents")
    .select("id,request_id,file_name,storage_path,mime_type")
    .eq("id", joined)
    .single();
  const d = doc as { id: string; request_id: string; file_name: string; storage_path: string; mime_type: string | null } | null;
  if (!d) return new NextResponse("Not found", { status: 404 });
  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage.from("client-docs").createSignedUrl(d.storage_path, 60);
  if (error || !signed) return new NextResponse("Could not sign URL", { status: 500 });
  try {
    await admin.from("activity_log").insert({
      actor_id: data.user.id, action: "file_view", entity: "documents", entity_id: d.id,
    });
  } catch { /* log best-effort */ }
  return NextResponse.redirect(signed.signedUrl);
}
