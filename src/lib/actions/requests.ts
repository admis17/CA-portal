"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { brand } from "@/config/brand";
import { demoProfile } from "@/lib/auth";
import { createClient, envConfigured } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mailTemplates, sendEmail } from "@/lib/email";
import { addDemoInboxItem, addDemoNotif, putDemoBytes } from "@/lib/demoStore";

const MAX_FILE = 25 * 1024 * 1024;
const ALLOWED_EXT = new Set(["pdf", "png", "jpg", "jpeg", "gif", "webp", "xls", "xlsx", "doc", "docx", "csv"]);

const extOf = (name: string) => (name.split(".").pop() ?? "").toLowerCase();
const sanitized = (name: string) => name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);

function checkFiles(files: File[]): string | null {
  if (files.length === 0) return "Attach at least one file.";
  for (const f of files) {
    if (f.size > MAX_FILE) return `${f.name} exceeds 25 MB.`;
    if (!ALLOWED_EXT.has(extOf(f.name))) return `${f.name}: only PDF, images, Excel, Word, CSV allowed.`;
  }
  return null;
}

const schema = z.object({
  service: z.string().min(1),
  note: z.string().max(500).optional(),
});

// Client uploads files + creates an `unassigned` request (PRD §4.1, TECH_STACK §7).
// Posts files straight to this action (no client JS); 30 MB body cap in next.config.
export async function createRequest(formData: FormData) {
  const parsed = schema.safeParse({ service: formData.get("service"), note: formData.get("note") });
  const service = parsed.success ? parsed.data.service : "";
  const note = (parsed.success && parsed.data.note ? parsed.data.note : "").trim();
  if (!parsed.success || !(brand.services as readonly string[]).includes(service))
    redirect("/client/upload?error=Choose%20a%20valid%20service.");
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const fileErr = checkFiles(files);
  if (fileErr) redirect(`/client/upload?error=${encodeURIComponent(fileErr)}`);

  // DEMO ONLY branch (no Supabase): keep bytes in server memory.
  if (!envConfigured()) {
    const d = await demoProfile();
    if (!d || d.role !== "client") redirect("/login");
    const id = `demo-${Date.now()}`;
    const metas = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const key = `demo/${id}/${i}`;
      putDemoBytes(key, Buffer.from(await f.arrayBuffer()), f.type || "application/octet-stream", f.name);
      metas.push({ name: f.name, size: f.size, mime: f.type, key });
    }
    addDemoInboxItem({
      id, client: d.full_name, phone: "—", service, note,
      received: "Just now", username: d.username, files: metas,
    });
    addDemoNotif("admin", `New ${service} upload from ${d.full_name} (${files.length} file(s)).`);
    revalidatePath("/client/requests");
    revalidatePath("/admin/inbox");
    redirect("/client/requests?ok=Documents%20uploaded.%20Admin%20notified.");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: prof } = await supabase.from("profiles").select("role,full_name").eq("id", data.user.id).single();
  const me = prof as { role?: string; full_name?: string } | null;
  if (!me || me.role !== "client") redirect("/login");

  const { data: svc } = await supabase.from("services").select("id").eq("name", service).single();
  if (!svc) redirect("/client/upload?error=Unknown%20service.");
  const { data: req, error: rErr } = await supabase
    .from("requests")
    .insert({ client_id: data.user.id, service_id: (svc as { id: number }).id, note: note || null })
    .select("id")
    .single();
  if (rErr || !req) redirect("/client/upload?error=Could%20not%20save%20request.");
  const reqId = (req as { id: string }).id;

  const admin = createAdminClient();
  for (const f of files) {
    const path = `${data.user.id}/${reqId}/${randomUUID()}-${sanitized(f.name)}`;
    const { error: uErr } = await admin.storage
      .from("client-docs")
      .upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type || "application/octet-stream", upsert: false });
    if (uErr) redirect(`/client/upload?error=${encodeURIComponent(`Upload failed: ${uErr.message}`)}`);
    await admin.from("documents").insert({
      request_id: reqId, uploaded_by: data.user.id, file_name: f.name,
      storage_path: path, mime_type: f.type || null, size_bytes: f.size,
    });
  }
  // Notify admins + audit log + email (best-effort; never fail the upload over these).
  try {
    const { data: admins } = await admin.from("profiles").select("id,email").eq("role", "admin").eq("is_active", true);
    const list = ((admins ?? []) as { id: string; email: string | null }[]);
    if (list.length > 0) {
      await admin.from("notifications").insert(
        list.map((a) => ({
          user_id: a.id, request_id: reqId,
          message: `New ${service} upload from ${me.full_name} (${files.length} file(s))`,
        }))
      );
    }
    await admin.from("activity_log").insert({
      actor_id: data.user.id, action: "upload", entity: "requests", entity_id: reqId,
      meta: { service, files: files.length },
    });
    for (const a of list) {
      if (a.email) {
        const t = mailTemplates.newUpload(service, me.full_name ?? "client", files.length);
        void sendEmail(a.email, t.subject, t.html);
      }
    }
  } catch { /* notify/log best-effort */ }

  revalidatePath("/client/requests");
  revalidatePath("/admin/inbox");
  redirect("/client/requests?ok=Documents%20uploaded.%20Admin%20notified.");
}
