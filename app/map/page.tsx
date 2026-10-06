import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/get-profile';
import { getCurrentUserEmail } from '@/lib/auth/get-current-user-email';
import { getMapData } from '@/lib/maps/queries';
import { CrmShell } from '@/components/crm/crm-shell';
import { LiveMapClient } from '@/components/maps/live-map-client';

export default async function MapPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (!profile.company_id) redirect('/setup');

  const email = await getCurrentUserEmail();
  const data = await getMapData();
  const canManage = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'SALES_MANAGER', 'HR_ACCOUNTS'].includes(profile.role);

  return (
    <CrmShell
      email={email}
      name={profile.full_name ?? 'User'}
      role={profile.role}
      avatarUrl={profile.avatar_url}
      employeeCode={profile.employee_code}
    >
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-700">Real-time Operations</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Live Workforce Map</h1>
            <p className="mt-1 text-sm text-slate-500">
              Real-time GPS visibility for office employees, field personnel, and after-hours overtime routes.
            </p>
          </div>
          <div className="flex gap-2 text-[10px] font-semibold">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">
              {data.employees.length} live employees
            </span>
            <span className="rounded-full bg-teal-50 px-3 py-1.5 text-teal-700">
              {data.customers.length} customer pins
            </span>
          </div>
        </header>

        <LiveMapClient
          initialCustomers={data.customers}
          initialEmployees={data.employees}
          canManage={canManage}
        />
      </main>
    </CrmShell>
  );
}
