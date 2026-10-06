import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentProfile } from '@/lib/auth/get-profile';
import { getCurrentUserEmail } from '@/lib/auth/get-current-user-email';
import { getCrmData } from '@/lib/crm/queries';
import { CrmShell } from '@/components/crm/crm-shell';
import { CustomerLocationButton } from '@/components/field/customer-location-button';

export default async function CustomersPage() {
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
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-700">Sales CRM</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Customer Directory</h1>
            <p className="mt-1 text-sm text-slate-500">
              Your relationship command center with clean accounts and GPS-verified pins.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/visits"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Field Visits
            </Link>
            <Link
              href="/customers/new"
              className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
            >
              + Add Customer
            </Link>
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">All Customers</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {data.customers.length} registered customer accounts available to your role.
              </p>
            </div>
            <Link
              href="/customers/new"
              className="text-xs font-bold text-teal-700 hover:underline"
            >
              + Add new
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {data.customers.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-4 p-5 transition hover:bg-slate-50/50">
                <div className="flex min-w-0 items-center gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-xs font-bold text-teal-800">
                    {c.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{c.name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {[c.industry, c.city, c.phone].filter(Boolean).join(' · ') || 'No details yet'}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <CustomerLocationButton id={c.id} hasLocation={Boolean(c.latitude && c.longitude)} />
                  <Link
                    href={`/visits/new?customer=${c.id}`}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-teal-300 hover:text-teal-700"
                  >
                    Plan Visit
                  </Link>
                </div>
              </div>
            ))}

            {!data.customers.length && (
              <div className="p-16 text-center">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-700">
                  🏢
                </div>
                <p className="text-sm font-bold text-slate-800">No customers yet</p>
                <p className="mt-1 text-xs text-slate-500">Add your first business account to begin field visits and opportunities.</p>
                <Link
                  href="/customers/new"
                  className="mt-4 inline-block rounded-xl bg-[var(--navy)] px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  + Add Customer
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>
    </CrmShell>
  );
}
