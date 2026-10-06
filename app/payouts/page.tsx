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
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                <div>
                  <p className="font-semibold">Employee {String(p.employee_id).slice(0, 8)}</p>
                  <p className="text-xs text-slate-500">{p.period_start} → {p.period_end} · {p.status}</p>
                </div>
                <p className="text-lg font-bold">₹{Number(p.net_amount).toLocaleString('en-IN')}</p>
              </div>
            ))}
            {!payouts.length && <p className="muted mt-3">No payouts yet.</p>}
          </div>
        </section>
      </main>
    </CrmShell>
  );
}

