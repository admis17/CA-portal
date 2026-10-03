"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { homeForRole } from "@/config/brand";
import { demoProfile } from "@/lib/auth";
import { createClient, envConfigured } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mailTemplates, sendEmail } from "@/lib/email";
import {
  addDemoNotif, assignDemoItem, commentDemoItem, getDemoItem, statusDemoItem,
} from "@/lib/demoStore";
import type { StatusKey } from "@/lib/demo";

const ORDER: StatusKey[] = ["unassigned", "assigned", "in_progress", "under_review", "completed"];
const LABEL: Record<StatusKey, string> = {
  unassigned: "Unassigned", assigned: "Assigned", in_progress: "In Progress",
  under_review: "Under Review", completed: "Completed",
};

// Single assign action (PRD §4.3): assignee + due + priority + status, notify + log + email.
// `due`/`priority` optional on reassign (keeps current values); `from` = redirect back.
export async function assignRequest(formData: FormData) {
  const parsed = z.object({
    requestId: z.string().min(1),
    employeeId: z.string().min(1),
    due: z.string().optional(),
    priority: z.enum(["low", "normal", "high"]).optional(),
    from: z.string().startsWith("/").optional(),
  }).safeParse({
    requestId: formData.get("requestId"), employeeId: formData.get("employeeId"),
    due: formData.get("due") || undefined, priority: formData.get("priority") || undefined,
    from: formData.get("from") || undefined,
  });
  if (!parsed.success) redirect("/admin/inbox?error=Invalid%20assignment.");
  const { requestId, employeeId, from } = parsed.data;
  const back = from ?? "/admin/inbox";
  const due = parsed.data.due && !Number.isNaN(Date.parse(parsed.data.due)) ? parsed.data.due : undefined;

  // DEMO ONLY branch.
  if (!envConfigured()) {
    const d = await demoProfile();
    if (!d || d.role !== "admin") redirect("/login");
    const item = getDemoItem(requestId);
    if (!item) redirect(`${back}?error=Request%20not%20found.`);
    if (item.status === "completed") redirect(`${back}?error=Reopen%20it%20before%20reassigning.`);
    const ok = assignDemoItem(requestId, employeeName(employeeId), due ?? item.dueDate ?? "No due date", parsed.data.priority ?? item.priority ?? "normal");
    if (!ok) redirect(`${back}?error=Request%20not%20found.`);
    addDemoNotif(employeeId, `New ${item.service} task assigned (${item.client}). Due: ${due ?? item.dueDate ?? "—"}.`);
    revalidatePath("/admin/inbox");
    revalidatePath("/admin/tasks");
    revalidatePath("/employee/alerts");
    redirect(`${back}?ok=Assigned%20to%20${encodeURIComponent(employeeName(employeeId))}.`);
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  if ((me as { role?: string } | null)?.role !== "admin") redirect(homeForRole.employee);
  const admin = createAdminClient();
  const { data: emp } = await admin.from("profiles").select("id,full_name,email,is_active,role").eq("id", employeeId).single();
  const e = emp as { id: string; full_name: string; email: string | null; is_active: boolean; role: string } | null;
  if (!e || e.role !== "employee" || !e.is_active) redirect(`${back}?error=Pick%20an%20active%20employee.`);
  const { data: req } = await admin.from("requests").select("id,status,client_id,service_id").eq("id", requestId).single();
  const r = req as { id: string; status: StatusKey; client_id: string; service_id: number } | null;
  if (!r) redirect(`${back}?error=Request%20not%20found.`);
  if (r.status === "completed") redirect(`${back}?error=Reopen%20it%20before%20reassigning.`);
  const patch: Record<string, unknown> = {
    assigned_to: e.id, assigned_by: data.user.id, assigned_at: new Date().toISOString(),
  };
  if (due) patch.due_date = due;
  if (parsed.data.priority) patch.priority = parsed.data.priority;
  if (r.status === "unassigned") patch.status = "assigned";
  await admin.from("requests").update(patch).eq("id", requestId);
  const { data: svc } = await admin.from("services").select("name").eq("id", r.service_id).single();
  const { data: cli } = await admin.from("profiles").select("full_name").eq("id", r.client_id).single();
  const service = (svc as { name?: string } | null)?.name ?? "request";
  const client = (cli as { full_name?: string } | null)?.full_name ?? "client";
  try {
    await admin.from("notifications").insert({
      user_id: e.id, request_id: requestId,
      message: `New ${service} task assigned (${client}). Due: ${due ?? "—"}.`,
    });
    await admin.from("activity_log").insert({
      actor_id: data.user.id, action: "assign", entity: "requests", entity_id: requestId,
      meta: { to: e.id, due: due ?? null },
    });
  } catch { /* best-effort */ }
  if (e.email) {
    const t = mailTemplates.assigned(service, client, due ?? "—");
    void sendEmail(e.email, t.subject, t.html);
  }
  revalidatePath("/admin/inbox");
  revalidatePath("/admin/tasks");
  redirect(`${back}?ok=Assigned%20to%20${encodeURIComponent(e.full_name)}.`);
}

// Demo store keys employees by username; map an id back when possible.
function employeeName(employeeId: string) {
  return employeeId;
}

// Status move, one step forward/back (PRD §6). Only admin reopens completed.
export async function updateStatus(formData: FormData) {
  const parsed = z.object({
    requestId: z.string().min(1),
    to: z.enum(["unassigned", "assigned", "in_progress", "under_review", "completed"]),
    from: z.string().startsWith("/").optional(),
  }).safeParse({ requestId: formData.get("requestId"), to: formData.get("to"), from: formData.get("from") || undefined });
  if (!parsed.success) redirect("/employee/today?error=Invalid%20status.");
  const { requestId, to, from } = parsed.data;

  // DEMO ONLY branch.
  if (!envConfigured()) {
    const d = await demoProfile();
    if (!d || (d.role !== "employee" && d.role !== "admin")) redirect("/login");
    const item = getDemoItem(requestId);
    if (!item) redirect(`${from ?? "/employee/today"}?error=Task%20not%20found.`);
    const cur = item.status ?? "unassigned";
    const err = checkMove(cur, to, d.role);
    if (err) redirect(`${from ?? "/employee/today"}?error=${encodeURIComponent(err)}`);
    if (d.role === "employee" && item.assignedTo !== d.username) redirect(`${from ?? "/employee/today"}?error=Not%20your%20task.`);
    statusDemoItem(requestId, to);
    if (item.username !== "seed") addDemoNotif(item.username, `${item.service}: status → ${LABEL[to]}.`);
    if (to === "completed") addDemoNotif("admin", `${item.service} for ${item.client} completed.`);
    revalidatePath("/employee/today");
    revalidatePath("/employee/past");
    revalidatePath("/client/requests");
    revalidatePath("/client/alerts");
    revalidatePath("/admin/alerts");
    redirect(`${from ?? "/employee/today"}?ok=Moved%20to%20${encodeURIComponent(LABEL[to])}.`);
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("id,role,full_name").eq("id", data.user.id).single();
  const caller = me as { id: string; role: "admin" | "employee" | "client"; full_name: string } | null;
  if (!caller || caller.role === "client") redirect("/login");
  const admin = createAdminClient();
  const { data: req } = await admin.from("requests").select("id,status,client_id,assigned_to,service_id").eq("id", requestId).single();
  const r = req as { id: string; status: StatusKey; client_id: string; assigned_to: string | null; service_id: number } | null;
  if (!r) redirect(`${from ?? homeForRole[caller.role]}?error=Task%20not%20found.`);
  if (caller.role === "employee" && r.assigned_to !== caller.id) redirect("/employee/today?error=Not%20your%20task.");
  const err = checkMove(r.status, to, caller.role);
  const back = from ?? homeForRole[caller.role];
  if (err) redirect(`${back}?error=${encodeURIComponent(err)}`);
  const patch: Record<string, unknown> = { status: to };
  if (to === "in_progress" && r.status === "assigned") patch.started_at = new Date().toISOString();
  if (to === "completed") patch.completed_at = new Date().toISOString();
  if (r.status === "completed") patch.completed_at = null; // admin reopen
  await admin.from("requests").update(patch).eq("id", requestId);
  const { data: svc } = await admin.from("services").select("name").eq("id", r.service_id).single();
  const { data: cli } = await admin.from("profiles").select("full_name,email").eq("id", r.client_id).single();
  const service = (svc as { name?: string } | null)?.name ?? "request";
  const client = cli as { full_name?: string; email?: string | null } | null;
  try {
    await admin.from("notifications").insert({
      user_id: r.client_id, request_id: requestId,
      message: `${service}: status → ${LABEL[to]}.`,
    });
    if (to === "completed") {
      const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin").eq("is_active", true);
      const ids = ((admins ?? []) as { id: string }[]).map((a) => a.id).filter((id) => id !== caller.id);
      if (ids.length > 0) {
        await admin.from("notifications").insert(ids.map((id) => ({
          user_id: id, request_id: requestId,
          message: `${service} for ${client?.full_name ?? "client"} completed.`,
        })));
      }
    }
    await admin.from("activity_log").insert({
      actor_id: caller.id, action: "status_change", entity: "requests", entity_id: requestId,
      meta: { from: r.status, to },
    });
  } catch { /* best-effort */ }
  if (client?.email) {
    const t = mailTemplates.statusChanged(service, LABEL[to]);
    void sendEmail(client.email, t.subject, t.html);
  }
  if (to === "completed") {
    try {
      const { data: admins } = await admin.from("profiles").select("email").eq("role", "admin").eq("is_active", true);
      for (const a of ((admins ?? []) as { email: string | null }[])) {
        if (a.email) {
          const t = mailTemplates.taskCompleted(service, client?.full_name ?? "client");
          void sendEmail(a.email, t.subject, t.html);
        }
      }
    } catch { /* best-effort */ }
  }
  revalidatePath("/employee/today");
  revalidatePath("/employee/past");
  revalidatePath("/admin/tasks");
  revalidatePath("/client/requests");
  redirect(`${back}?ok=Moved%20to%20${encodeURIComponent(LABEL[to])}.`);
}

function checkMove(cur: StatusKey, to: StatusKey, role: "admin" | "employee"): string | null {
  if (cur === to) return "Already there.";
  if (cur === "completed" && role !== "admin") return "Only admin can reopen a completed task.";
  const d = ORDER.indexOf(to) - ORDER.indexOf(cur);
  if (Math.abs(d) !== 1) return "Move one step at a time.";
  if (to === "unassigned") return "Tasks can't go back to unassigned.";
  return null;
}

// Internal note on a task (clients never see these — no client view renders them).
export async function addComment(formData: FormData) {
  const parsed = z.object({
    requestId: z.string().min(1), body: z.string().trim().min(1).max(2000),
    from: z.string().startsWith("/").optional(),
  }).safeParse({ requestId: formData.get("requestId"), body: formData.get("body"), from: formData.get("from") || undefined });
  if (!parsed.success) redirect("/employee/today?error=Note%20can't%20be%20empty.");
  const { requestId, body, from } = parsed.data;

  if (!envConfigured()) {
    const d = await demoProfile();
    if (!d || (d.role !== "employee" && d.role !== "admin")) redirect("/login");
    const item = getDemoItem(requestId);
    if (!item) redirect(`${from ?? "/employee/today"}?error=Task%20not%20found.`);
    if (d.role === "employee" && item.assignedTo !== d.username) redirect(`${from ?? "/employee/today"}?error=Not%20your%20task.`);
    commentDemoItem(requestId, d.full_name, body);
    revalidatePath(from ?? "/employee/today");
    redirect(`${from ?? "/employee/today"}?ok=Note%20added.`);
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  // RLS on request_comments permits admin + participating employee; insert as the user.
  const { error } = await supabase.from("request_comments").insert({
    request_id: requestId, author_id: data.user.id, body, internal: true,
  });
  const back = from ?? "/employee/today";
  if (error) redirect(`${back}?error=${encodeURIComponent("Could not save note.")}`);
  revalidatePath(back);
  redirect(`${back}?ok=Note%20added.`);
}
