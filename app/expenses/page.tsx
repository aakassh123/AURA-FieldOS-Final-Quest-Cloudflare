import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentProfile } from '@/lib/auth/get-profile';
import { getCurrentUserEmail } from '@/lib/auth/get-current-user-email';
import { getFinanceDashboard } from '@/lib/finance/queries';
import { ExpenseReview } from '@/components/finance/finance-shell';
import { Receipt, ShieldCheck } from 'lucide-react';
import { CrmShell } from '@/components/crm/crm-shell';

export default async function ExpensesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (!profile.company_id) redirect('/setup');

  const [email, financeData] = await Promise.all([
    getCurrentUserEmail(),
    getFinanceDashboard(),
  ]);

  const { employee, expenses } = financeData;
  const canReview = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'SALES_MANAGER', 'HR_ACCOUNTS'].includes(
    employee?.role ?? profile.role
  );

  return (
    <CrmShell
      email={email}
      name={profile.full_name ?? 'User'}
      role={profile.role}
      avatarUrl={profile.avatar_url}
      employeeCode={profile.employee_code}
    >
      <main className="page">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="eyebrow">Field finance</p>
            <h1>Expense Claims</h1>
            <p>Submit and review verified travel and field operational costs.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/expenses/new"
              className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
            >
              + Submit Expense
            </Link>
          </div>
        </div>

        <section className="mt-6">
          <div className="surface">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <ShieldCheck size={20} className="text-teal-700" />
                <div>
                  <h2 className="section-title">Expense Queue & Review</h2>
                  <p className="muted">
                    {canReview
                      ? 'Approve or reject submitted reimbursement claims.'
                      : 'Your submitted field expenditures and approval status.'}
                  </p>
                </div>
              </div>
              <Link href="/expenses/new" className="text-xs font-bold text-teal-700 hover:underline">
                + Submit new
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {expenses.length ? (
                expenses.map((e) => (
                  <div key={e.id} className="rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50/50">
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{e.description}</p>
                        <p className="text-xs text-slate-500">
                          {e.category} · {e.expense_date}
                          {e.merchant ? ` · ${e.merchant}` : ''}
                        </p>
                      </div>
                      <p className="text-base font-bold text-slate-950">
                        ₹{Number(e.amount).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          e.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : e.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {e.status}
                      </span>
                      {canReview && e.status === 'SUBMITTED' && <ExpenseReview expense={e} />}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-14 text-center">
                  <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-700">
                    🧾
                  </div>
                  <p className="text-sm font-bold text-slate-800">No expense claims found</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Submit your first field expense reimbursement claim.
                  </p>
                  <Link
                    href="/expenses/new"
                    className="mt-4 inline-block rounded-xl bg-[var(--navy)] px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    + Submit Expense
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </CrmShell>
  );
}
