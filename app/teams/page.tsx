import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getCurrentUserEmail } from "@/lib/auth/get-current-user-email";
import { getOrganizationData } from "@/lib/organization/queries";
import { TeamDeleteForm, TeamMemberForm, TeamMemberRemoveForm } from "@/components/organization/forms";
import { Icon } from "@/components/icon";
import { CrmShell } from "@/components/crm/crm-shell";

export default async function TeamsPage() {
  const [profile, email] = await Promise.all([
    getCurrentProfile(),
    getCurrentUserEmail(),
  ]);
  if (!profile) redirect("/login");
  if (!profile.company_id) redirect("/setup");
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
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--navy)] text-white">
              <Icon name="users-round" size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Organization</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Teams</h1>
              <p className="mt-1 text-sm text-slate-500">Group employees by territory, segment, product or manager.</p>
            </div>
          </div>
          {canManage && (
            <Link
              href="/teams/new"
              className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
            >
              + Create Team
            </Link>
          )}
        </div>

        <section className="mt-6 space-y-4">
          {data.teams.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-700">
                👥
              </div>
              <p className="text-sm font-bold text-slate-800">No teams created yet</p>
              <p className="mt-1 text-xs text-slate-500">Group your sales and field representatives into organized regional squads.</p>
              {canManage && (
                <Link
                  href="/teams/new"
                  className="mt-4 inline-block rounded-xl bg-[var(--navy)] px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  + Create First Team
                </Link>
              )}
            </div>
          ) : (
            data.teams.map((team) => {
              const memberIds = new Set((team.team_members ?? []).map((m) => m.employee_id));
              const members = data.employees.filter((employee) => memberIds.has(employee.id));
              const manager = data.employees.find((employee) => employee.id === team.manager_employee_id);

              return (
                <div key={team.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900">{team.name}</h2>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                            team.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {team.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{team.description ?? "No description"}</p>
                    </div>
                    {canDelete && <TeamDeleteForm id={team.id} />}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <Metric label="Members" value={String(members.length)} />
                    <Metric label="Manager" value={manager?.full_name ?? "Unassigned"} />
                    <Metric label="Coverage" value={members.length ? "Configured" : "Empty"} />
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Team Members</p>
                    <div className="flex flex-wrap gap-2">
                      {members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-2 pr-2.5"
                        >
                          <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-[9px] font-bold text-slate-600">
                            {member.full_name.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-700">{member.full_name}</span>
                          {canDelete && <TeamMemberRemoveForm teamId={team.id} employeeId={member.id} />}
                        </div>
                      ))}
                      {!members.length && (
                        <p className="text-xs text-slate-400 italic">No members assigned yet.</p>
                      )}
                    </div>

                    {canManage && (
                      <div className="mt-4 max-w-lg">
                        <TeamMemberForm
                          teamId={team.id}
                          employees={data.employees.filter((e) => !memberIds.has(e.id))}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </main>
    </CrmShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 truncate text-xs font-bold text-slate-800">{value}</p>
    </div>
  );
}
