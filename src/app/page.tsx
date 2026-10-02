import { redirect } from "next/navigation";
import { homeForRole } from "@/config/brand";
import { envConfigured } from "@/lib/supabase/server";
import { currentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!envConfigured()) redirect("/login");
  try {
    const p = await currentProfile();
    redirect(p ? homeForRole[p.role] : "/login");
  } catch {
    redirect("/login");
  }
}
