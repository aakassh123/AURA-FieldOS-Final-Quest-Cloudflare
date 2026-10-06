import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getCurrentUserEmail } from "@/lib/auth/get-current-user-email";
import { getReportsData } from "@/lib/reports/queries";
import { CrmShell } from "@/components/crm/crm-shell";
import { ZohoReportsDashboard } from "@/components/reports/zoho-reports-dashboard";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const [profile, email, params] = await Promise.all([
    getCurrentProfile(),
    getCurrentUserEmail(),
    searchParams,
  ]);

  if (!profile) redirect("/login");
  if (!profile.company_id) redirect("/setup");

  const data = await getReportsData(params);

  return (
    <CrmShell
      email={email}
      name={profile.full_name ?? "User"}
      role={profile.role}
      avatarUrl={profile.avatar_url}
      employeeCode={profile.employee_code}
    >
      <main className="min-h-screen bg-slate-50/70 px-3 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <ZohoReportsDashboard data={data} />
        </div>
      </main>
    </CrmShell>
  );
}
