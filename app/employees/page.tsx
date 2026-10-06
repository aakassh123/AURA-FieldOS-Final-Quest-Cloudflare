import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getCurrentUserEmail } from "@/lib/auth/get-current-user-email";
import { getOrganizationData } from "@/lib/organization/queries";
import { EmployeeForm, EmployeeDeleteForm } from "@/components/organization/forms";
import { CrmShell } from "@/components/crm/crm-shell";
import { Icon } from "@/components/icon";

export default async function EmployeesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.company_id) redirect("/setup");
  const email = await getCurrentUserEmail();
  const data = await getOrganizationData();
  const canManage = ["SUPER_ADMIN", "COMPANY_ADMIN", "SALES_MANAGER"].includes(profile.role);
  const canDelete = ["SUPER_ADMIN", "COMPANY_ADMIN"].includes(profile.role);

  return (
    <CrmShell
      email={email}
      name={profile.full_name ?? "User"}
      role={profile.role}
      avatarUrl={profile.avatar_url}
      employeeCode={profile.employee_code}
    >
      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <PageHeader title="Employees" description="Manage people, roles, managers and workforce status." icon="users" />
          {canManage && (
            <Link
              href="/employees/new"
              className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
            >
              + Add Employee
            </Link>
          )}
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Employee Directory</h2>
              <p className="mt-1 text-xs text-slate-500">{data.employees.length} people in {data.company?.name ?? "your company"}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-700">{data.employees.filter((e) => e.status === "ACTIVE").length} active</span>
              {canManage && (
                <Link href="/employees/new" className="text-xs font-bold text-teal-700 hover:underline">
                  + Add new
                </Link>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3">Employee</th>
                  <th className="py-3">Role</th>
                  <th className="py-3">Manager</th>
                  <th className="py-3">Status</th>
                  <th className="py-3">Account</th>
                  <th className="py-3 text-right pr-5">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.employees.map((employee) => (
                  <tr key={employee.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{employee.full_name.slice(0, 2).toUpperCase()}</span>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{employee.full_name}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">{employee.employee_code} · {employee.designation ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{employee.role.replaceAll("_", " ")}</span></td>
                    <td className="py-4 text-xs text-slate-500">{employee.manager?.full_name ?? "—"}</td>
                    <td className="py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${employee.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : employee.status === "INVITED" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{employee.status}</span></td>
                    <td className="py-4 text-xs text-slate-500">{employee.user_id ? "Linked" : "Not linked"}</td>
                    <td className="py-4 pr-5 text-right">{canDelete && employee.user_id !== profile.id ? <EmployeeDeleteForm id={employee.id} /> : <span className="text-xs text-slate-400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-600"><Icon name="shield-check" size={17} /></div>
            <div>
              <h3 className="text-sm font-bold">Security model</h3>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">Company ID and role are never trusted from the browser. RLS derives the current company from the authenticated profile, and protected database triggers prevent unsafe role promotion or cross-company manager links.</p>
            </div>
          </div>
        </div>
      </main>
    </CrmShell>
  );
}

function PageHeader({ title, description, icon }: { title: string; description: string; icon: string }) { return <div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--navy)] text-white"><Icon name={icon} size={18} /></div><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Organization</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{title}</h1><p className="mt-1 text-sm text-slate-500">{description}</p></div></div> }
