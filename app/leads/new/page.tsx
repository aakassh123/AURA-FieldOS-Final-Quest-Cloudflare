import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentProfile } from '@/lib/auth/get-profile';
import { getCurrentUserEmail } from '@/lib/auth/get-current-user-email';
import { getCrmData } from '@/lib/crm/queries';
import { LeadForm } from '@/components/crm/forms';
import { CrmShell } from '@/components/crm/crm-shell';

export default async function NewLeadPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (!profile.company_id) redirect('/setup');

  const email = await getCurrentUserEmail();
  const data = await getCrmData();

  return (
    <CrmShell
      email={email}
      name={profile.full_name ?? 'User'}
      role={profile.role}
      avatarUrl={profile.avatar_url}
      employeeCode={profile.employee_code}
    >
      <main className="mx-auto max-w-[950px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-6">
          <Link
            href="/leads"
            className="inline-flex items-center text-xs font-semibold text-teal-700 hover:text-teal-800"
          >
            ← Back to Pipeline & Leads
          </Link>
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-700">Sales CRM</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Create Opportunity</h1>
            <p className="mt-1 text-sm text-slate-500">
              Capture a new sales opportunity, assign stage, owner, customer account, and estimated revenue value.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <LeadForm
            stages={data.stages}
            employees={data.employees as any}
            customers={data.customers}
            redirectTo="/leads"
          />
        </div>
      </main>
    </CrmShell>
  );
}
