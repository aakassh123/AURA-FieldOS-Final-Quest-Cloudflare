import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentProfile } from '@/lib/auth/get-profile';
import { getCurrentUserEmail } from '@/lib/auth/get-current-user-email';
import { getFieldDashboard } from '@/lib/field/queries';
import { CrmShell } from '@/components/crm/crm-shell';
import { LocationAction } from '@/components/field/location-action';
import { startVisit } from '@/app/actions/field';

export default async function VisitsPage() {
  const p = await getCurrentProfile();
  if (!p) redirect('/login');
  if (!p.company_id) redirect('/setup');

  const email = await getCurrentUserEmail();
  const d = await getFieldDashboard();

  return (
    <CrmShell
      email={email}
      name={p.full_name ?? 'User'}
      role={p.role}
      avatarUrl={p.avatar_url}
      employeeCode={p.employee_code}
    >
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-700">Field work</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Customer Visits</h1>
            <p className="mt-1 text-sm text-slate-500">
              Plan, verify and close customer visits with a transparent GPS record.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/customers"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Manage Customer Pins
            </Link>
            <Link
              href="/visits/new"
              className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
            >
              + Plan Visit
            </Link>
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Visit Schedule & Queue</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {d.visits.length} customer visits assigned to your operational scope.
              </p>
            </div>
            <Link
              href="/visits/new"
              className="text-xs font-bold text-teal-700 hover:underline"
            >
              + Plan new visit
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {d.visits.map((v) => (
              <div
                key={v.id}
                className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between transition hover:bg-slate-50/50"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/visits/${v.id}`}
                      className="text-sm font-bold text-slate-900 hover:text-teal-700"
                    >
                      {v.customer?.name}
                    </Link>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        v.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : v.status === 'STARTED'
                          ? 'bg-teal-50 text-teal-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {v.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {v.scheduled_at
                      ? new Date(v.scheduled_at).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : 'Unscheduled'}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {v.geofence_verified
                      ? `✓ GPS Verified (${Math.round(v.check_in_distance_m ?? 0)}m from pin)`
                      : 'Pending GPS verification'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {v.status === 'PLANNED' && (
                    <LocationAction
                      action={startVisit}
                      hidden={{ id: v.id }}
                      label="Start GPS Visit"
                      className="rounded-xl bg-[var(--teal)] px-4 py-2.5 text-xs font-bold text-[var(--navy)]"
                    />
                  )}
                  {v.status === 'STARTED' && (
                    <Link
                      href={`/visits/${v.id}`}
                      className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
                    >
                      Complete Visit →
                    </Link>
                  )}
                  {v.status === 'COMPLETED' && (
                    <Link
                      href={`/visits/${v.id}`}
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      View Report
                    </Link>
                  )}
                </div>
              </div>
            ))}

            {!d.visits.length && (
              <div className="p-16 text-center">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-700">
                  🗺️
                </div>
                <p className="text-sm font-bold text-slate-800">No visits planned yet</p>
                <p className="mt-1 text-xs text-slate-500">
                  Plan your first customer visit with automatic distance and geofence tracking.
                </p>
                <Link
                  href="/visits/new"
                  className="mt-4 inline-block rounded-xl bg-[var(--navy)] px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  + Plan Customer Visit
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>
    </CrmShell>
  );
}
