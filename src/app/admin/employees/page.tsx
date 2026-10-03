import { Users } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { requireProfile } from "@/lib/auth";
import { createEmployee, resetEmployeePassword, setEmployeeActive } from "@/lib/actions/auth";
import { createClient, envConfigured } from "@/lib/supabase/server";
import { demoEmployees } from "@/lib/demo";

type SP = Promise<Record<string, string | undefined>>;
type Employee = { id: string; username: string; full_name: string; is_active: boolean; open: number };

export const dynamic = "force-dynamic";

export default async function EmployeesPage({ searchParams }: { searchParams: SP }) {
  const p = await requireProfile(["admin"]);
  const sp = await searchParams;
  const demo = !envConfigured();
  let employees: Employee[];
  if (demo) {
    employees = demoEmployees;
  } else {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("id,username,full_name,is_active").eq("role", "employee").order("created_at", { ascending: false });
    const rows = (data ?? []) as Omit<Employee, "open">[];
    const { data: openRows } = await supabase.from("requests").select("assigned_to").neq("status", "completed");
    const counts = new Map<string, number>();
    ((openRows ?? []) as { assigned_to: string | null }[]).forEach((r) => {
      if (r.assigned_to) counts.set(r.assigned_to, (counts.get(r.assigned_to) ?? 0) + 1);
    });
    employees = rows.map((r) => ({ ...r, open: counts.get(r.id) ?? 0 }));
  }

  return (
    <Shell role="admin" fullName={p.full_name} username={p.username} active="/admin/employees">
      <div className="flex items-center gap-3 mb-1">
        <span className="tile tile-sm t-gold"><Users size={18} /></span>
        <h1 className="font-display font-bold text-2xl">Employees</h1>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Admin creates login ID + temp password. Deactivated staff keep history but cannot log in.</p>

      {sp.error && <p className="pill mb-4" style={{ background: "#FEF2F2", color: "#DC2626" }}><span className="d" />{sp.error}</p>}
      {sp.ok && <p className="pill mb-4" style={{ background: "#F0FDF4", color: "#16A34A" }}><span className="d" />{sp.ok}</p>}
      {sp.temp && <p className="pill mb-4 num" style={{ background: "#FFFBEB", color: "#D97706" }}><span className="d" />New temp password: {sp.temp}</p>}
      {demo && <p className="pill mb-4" style={{ background: "#FFFBEB", color: "#D97706" }}><span className="d" />Demo data — connect Supabase for live data.</p>}

      <div className="glass-card p-6 mb-4">
        <h2 className="font-display font-semibold mb-4">Create employee</h2>
        <form action={createEmployee} className="grid md:grid-cols-5 gap-3 items-end">
          <div><label className="lbl" htmlFor="full_name">Full name</label><input id="full_name" name="full_name" className="input" required minLength={2} /></div>
          <div><label className="lbl" htmlFor="username">Login username</label><input id="username" name="username" className="input" required minLength={3} pattern="[a-zA-Z0-9._-]+" /></div>
          <div><label className="lbl" htmlFor="password">Temp password</label><input id="password" name="password" type="password" className="input" required minLength={8} /></div>
          <div><label className="lbl" htmlFor="email">Contact email (for alerts)</label><input id="email" name="email" type="email" className="input" placeholder="Optional" /></div>
          <button className="btn-primary" type="submit">Create</button>
        </form>
      </div>

      <div className="glass-card p-2 md:p-4 overflow-x-auto">
        {employees.length === 0 ? (
          <p className="p-6 text-sm text-center" style={{ color: "var(--muted)" }}>No employees yet — create the first one above.</p>
        ) : (
          <table className="tbl">
            <thead><tr><th>Name</th><th>Username</th><th>Status</th><th>Open</th><th>Actions</th></tr></thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td className="font-semibold">{e.full_name}</td>
                  <td className="num">@{e.username}</td>
                  <td>
                    <span className="pill" style={e.is_active ? { background: "#F0FDF4", color: "#16A34A" } : { background: "#F1EEEB", color: "#7A726B" }}>
                      <span className="d" />{e.is_active ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td><span className="open-pill num">{e.open}</span></td>
                  <td>
                    <div className="flex gap-2">
                      <form action={setEmployeeActive}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="active" value={e.is_active ? "false" : "true"} />
                        <button className="btn-outline !h-8 !text-xs" type="submit">{e.is_active ? "Deactivate" : "Reactivate"}</button>
                      </form>
                      <form action={resetEmployeePassword}>
                        <input type="hidden" name="id" value={e.id} />
                        <button className="btn-outline !h-8 !text-xs" type="submit">Reset password</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Shell>
  );
}
