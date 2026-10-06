import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentProfile } from '@/lib/auth/get-profile';
import { getCurrentUserEmail } from '@/lib/auth/get-current-user-email';
import { ExpenseForm } from '@/components/finance/finance-shell';
import { CrmShell } from '@/components/crm/crm-shell';

export default async function NewExpensePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (!profile.company_id) redirect('/setup');

  const email = await getCurrentUserEmail();

  return (
    <CrmShell
      email={email}
      name={profile.full_name ?? 'User'}
      role={profile.role}
      avatarUrl={profile.avatar_url}
      employeeCode={profile.employee_code}
    >
      <main className="mx-auto max-w-[900px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-6">
          <Link
            href="/expenses"
            className="inline-flex items-center text-xs font-semibold text-teal-700 hover:text-teal-800"
          >
            ← Back to Expense Claims
          </Link>
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-700">Field Finance</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Submit Expense Claim</h1>
            <p className="mt-1 text-sm text-slate-500">
              Claim travel, fuel, meals, lodging, or operational costs incurred during client visits.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <ExpenseForm redirectTo="/expenses" />
        </div>
      </main>
    </CrmShell>
  );
}
