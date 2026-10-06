import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/get-profile';
import { getCurrentUserEmail } from '@/lib/auth/get-current-user-email';
import { getFinanceDashboard, getFinancePeople } from '@/lib/finance/queries';
import { createPayout } from '@/app/actions/finance';
import { CrmShell } from '@/components/crm/crm-shell';

export default async function PayoutsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (!profile.company_id) redirect('/setup');
  if (!['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR_ACCOUNTS'].includes(profile.role)) {
    redirect('/');
  }

  const [email, { payouts }, people] = await Promise.all([
    getCurrentUserEmail(),
    getFinanceDashboard(),
    getFinancePeople(),
  ]);

  return (
    <CrmShell
      email={email}
      name={profile.full_name ?? 'User'}
      role={profile.role}
      avatarUrl={profile.avatar_url}
      employeeCode={profile.employee_code}
    >
      <main className="page">
        <div className="page-head">
          <div>
            <p className="eyebrow">Payroll bridge</p>
            <h1>Payouts</h1>
            <p>Create a period snapshot of salary, incentives, commissions and reimbursements.</p>
          </div>
        </div>
        <section className="surface">
          <form action={async (fd: FormData) => { "use server"; await createPayout(fd); }} className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <label>Employee</label>
              <select className="input" name="employee_id">
                {people.employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Period start</label>
              <input className="input" name="period_start" type="date" />
            </div>
            <div>
              <label>Period end</label>
              <input className="input" name="period_end" type="date" />
            </div>
            <div>
              <label>Base</label>
              <input className="input" name="base_amount" type="number" min="0" />
            </div>
            <div>
              <label>Incentive</label>
              <input className="input" name="incentive_amount" type="number" min="0" />
            </div>
            <div>
              <label>Commission</label>
              <input className="input" name="commission_amount" type="number" min="0" />
            </div>
            <div>
              <label>Reimbursement</label>
              <input className="input" name="expense_reimbursement" type="number" min="0" />
            </div>
            <div>
              <label>Deductions</label>
              <input className="input" name="deductions" type="number" min="0" />
            </div>
            <div className="md:col-span-3 flex items-end">
              <p className="text-xs text-slate-500">Net = base + incentive + commission + reimbursement − deductions.</p>
            </div>
            <div className="flex justify-end">
              <button className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white">Save payout</button>
            </div>
          </form>
        </section>
        <section className="surface mt-5">
          <h2 className="section-title">Payout history</h2>
          <div className="mt-4 space-y-3">
            {payouts.map((p: any) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4.5 shadow-sm transition hover:bg-slate-50/60">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-900">{p.employee?.full_name || 'Staff Member'}</p>
                    <span className="font-mono text-[10px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                      {p.employee?.employee_code || 'EMP'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Period: {p.period_start} → {p.period_end} · <span className="font-semibold text-slate-700">{p.status}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 font-semibold uppercase">Net Payout</p>
                  <p className="text-lg font-black text-slate-950">₹{Number(p.net_amount).toLocaleString('en-IN')}</p>
                </div>
              </div>
            ))}
            {!payouts.length && <p className="muted mt-3">No payouts yet.</p>}
          </div>
        </section>
      </main>
    </CrmShell>
  );
}

