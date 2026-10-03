"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { homeForRole } from "@/config/brand";
import { demoProfile } from "@/lib/auth";
import { createClient, envConfigured } from "@/lib/supabase/server";
import { markDemoNotifsRead } from "@/lib/demoStore";

export async function markAllRead(formData: FormData) {
  const from = String(formData.get("from") || "");
  const back = from.startsWith("/") ? from : "/";

  if (!envConfigured()) {
    const d = await demoProfile();
    if (!d) redirect("/login");
    markDemoNotifsRead(d.username);
    revalidatePath(back);
    redirect(back);
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  await supabase.from("notifications").update({ is_read: true }).eq("user_id", data.user.id).eq("is_read", false);
  const { data: p } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  const role = (p as { role?: "admin" | "employee" | "client" } | null)?.role ?? "client";
  const dest = back !== "/" ? back : homeForRole[role];
  revalidatePath(dest);
  redirect(dest);
}
