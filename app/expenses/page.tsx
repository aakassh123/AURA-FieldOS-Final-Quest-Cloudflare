import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentProfile } from '@/lib/auth/get-profile';
import { getCurrentUserEmail } from '@/lib/auth/get-current-user-email';
import { getFinanceDashboard } from '@/lib/finance/queries';
import { ExpenseReview } from '@/components/finance/finance-shell';
import { ShieldCheck, Receipt, PlusCircle, ArrowLeft } from 'lucide-react';
import { CrmShell } from '@/components/crm/crm-shell';

const CATEGORY_ICONS: Record<string, string> = {
  TRAVEL: '🚗',
  FUEL: '⛽',
  MEALS: '🍽️',
  LODGING: '🏨',
  PHONE: '📱',
  OFFICE: '🏢',
  OTHER: '💼',
};

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

  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const pendingCount = expenses.filter((e) => e.status === 'SUBMITTED').length;
  const approvedCount = expenses.filter((e) => e.status === 'APPROVED').length;

  return (
    <CrmShell
      email={email}
      name={profile.full_name ?? 'User'}
      role={profile.role}
      avatarUrl={profile.avatar_url}
      employeeCode={profile.employee_code}
    >
      <main className="mx-auto max-w-[1300px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-700">Field Finance</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Expense Claims & Reimbursements</h1>
            <p className="mt-1 text-sm text-slate-500">
              Submit, track and approve verified travel, fuel, client hospitality, and field operational costs.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/expenses/new"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--navy)] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800"
            >
              <PlusCircle size={15} />
              <span>Submit Expense Claim</span>
            </Link>
          </div>
        </div>

        {/* Quick KPI Overview */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Claims</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{expenses.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Amount</p>
            <p className="mt-1 text-2xl font-black text-teal-700">
              ₹{totalAmount.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pending Review</p>
            <p className="mt-1 text-2xl font-black text-amber-600">{pendingCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Approved Claims</p>
            <p className="mt-1 text-2xl font-black text-emerald-600">{approvedCount}</p>
          </div>
        </div>

        {/* Expenses List */}
        <section className="mt-6">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-teal-700">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Expense Claims Queue</h2>
                  <p className="text-xs text-slate-500">
                    {canReview
                      ? 'Review and authorize pending employee reimbursement claims.'
                      : 'Audit trail of your field expenditures and reimbursement approvals.'}
                  </p>
                </div>
              </div>
              <Link
                href="/expenses/new"
                className="text-xs font-bold text-teal-700 hover:text-teal-800 hover:underline"
              >
                + Submit new claim
              </Link>
            </div>

            <div className="p-5 space-y-3">
              {expenses.length ? (
                expenses.map((e) => {
                  const emp = e.employee;
                  const catIcon = CATEGORY_ICONS[e.category] || '💼';

                  return (
                    <div
                      key={e.id}
                      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4.5 transition hover:bg-slate-50/60 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-3.5">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-lg">
                          {catIcon}
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-slate-900">{e.description}</p>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                              {e.category}
                            </span>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            {emp && (
                              <span className="font-semibold text-slate-700">
                                👤 {emp.full_name} ({emp.employee_code})
                              </span>
                            )}
                            <span>•</span>
                            <span>📅 {e.expense_date}</span>
                            {e.merchant && (
                              <>
                                <span>•</span>
                                <span>🏪 {e.merchant}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-2 sm:border-0 sm:pt-0">
                        <div className="text-right">
                          <p className="text-lg font-black text-slate-950">
                            ₹{Number(e.amount).toLocaleString('en-IN')}
                          </p>
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                              e.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : e.status === 'REJECTED'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : e.status === 'PAID'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {e.status}
                          </span>
                        </div>

                        {canReview && e.status === 'SUBMITTED' && (
                          <div className="shrink-0">
                            <ExpenseReview expense={e} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-14 text-center">
                  <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-2xl text-teal-700">
                    🧾
                  </div>
                  <p className="text-base font-bold text-slate-800">No expense claims recorded</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Employees can submit claims for client travel, fuel, meals, or field supplies.
                  </p>
                  <Link
                    href="/expenses/new"
                    className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[var(--navy)] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
                  >
                    <PlusCircle size={15} />
                    <span>Submit First Expense</span>
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
