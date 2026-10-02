import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Role homes inlined (proxy runs at the edge; no shared imports).
const roleHome = (role: string) =>
  role === "admin" ? "/admin/dashboard" : role === "employee" ? "/employee/today" : "/client/requests";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const res = NextResponse.next({ request });

  // Demo mode: no Supabase env -> honour the demo_session cookie only.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pub = pathname === "/login" || pathname === "/signup";
  const prot =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/employee") ||
    pathname.startsWith("/client") ||
    pathname.startsWith("/account");
  if (!url || !anon) {
    let role: string | null = null;
    try {
      const d = JSON.parse(request.cookies.get("demo_session")?.value ?? "") as { role?: string };
      if (d.role === "admin" || d.role === "employee" || d.role === "client") role = d.role;
    } catch { /* no demo session */ }
    if (!role) return prot ? NextResponse.redirect(new URL("/login", request.url)) : res;
    if (pub) return NextResponse.redirect(new URL(roleHome(role), request.url));
    if (pathname.startsWith("/admin") && role !== "admin")
      return NextResponse.redirect(new URL(roleHome(role), request.url));
    if (pathname.startsWith("/employee") && role !== "employee")
      return NextResponse.redirect(new URL(roleHome(role), request.url));
    if (pathname.startsWith("/client") && role !== "client")
      return NextResponse.redirect(new URL(roleHome(role), request.url));
    return res;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
    },
  });
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) return prot ? NextResponse.redirect(new URL("/login", request.url)) : res;

  const { data: p } = await supabase
    .from("profiles")
    .select("role,is_active,must_change_password")
    .eq("id", user.id)
    .single();
  const profile = p as { role?: string; is_active?: boolean; must_change_password?: boolean } | null;
  if (!profile || profile.is_active === false) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=Account%20is%20deactivated.", request.url));
  }
  if (profile.must_change_password && pathname !== "/account/password")
    return NextResponse.redirect(new URL("/account/password?notice=Please%20set%20a%20new%20password.", request.url));

  if (pub) return NextResponse.redirect(new URL(roleHome(profile.role ?? "client"), request.url));
  if (pathname.startsWith("/admin") && profile.role !== "admin")
    return NextResponse.redirect(new URL(roleHome(profile.role ?? "client"), request.url));
  if (pathname.startsWith("/employee") && profile.role !== "employee")
    return NextResponse.redirect(new URL(roleHome(profile.role ?? "client"), request.url));
  if (pathname.startsWith("/client") && profile.role !== "client")
    return NextResponse.redirect(new URL(roleHome(profile.role ?? "client"), request.url));
  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/employee/:path*", "/client/:path*", "/account/:path*", "/login", "/signup"],
};
