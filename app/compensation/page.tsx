import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/get-profile';
import { getCurrentUserEmail } from '@/lib/auth/get-current-user-email';
import { getFinancePeople } from '@/lib/finance/queries';
import { createCompensationRule, assignCompensation } from '@/app/actions/finance';
import { CrmShell } from '@/components/crm/crm-shell';

export default async function CompensationPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (!profile.company_id) redirect('/setup');
  if (!['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR_ACCOUNTS'].includes(profile.role)) {
    redirect('/');
  }

  const [email, { employees, rules }] = await Promise.all([
    getCurrentUserEmail(),
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
            <p className="eyebrow">Finance rules</p>
            <h1>Compensation</h1>
            <p>Versioned rules keep historical salary and commission calculations stable.</p>
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="surface">
            <h2 className="section-title">Create rule version</h2>
            <form action={async (fd: FormData) => { "use server"; await createCompensationRule(fd); }} className="mt-5 grid gap-4">
              <div>
                <label>Name</label>
                <input className="input" name="name" placeholder="Salesman Standard" />
              </div>
              <div>
                <label>Rule type</label>
                <select className="input" name="rule_type">
                  <option>FIXED_SALARY</option>
                  <option>PER_DAY</option>
                  <option>FIXED_PLUS_INCENTIVE</option>
                  <option>COMMISSION</option>
                  <option>HYBRID</option>
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label>Fixed salary</label>
                  <input className="input" name="fixed_salary" type="number" min="0" />
                </div>
                <div>
                  <label>Daily rate</label>
                  <input className="input" name="daily_rate" type="number" min="0" />
                </div>
                <div>
                  <label>Incentive %</label>
                  <input className="input" name="incentive_rate_percent" type="number" min="0" step="0.01" />
                </div>
                <div>
                  <label>Commission %</label>
                  <input className="input" name="commission_rate_percent" type="number" min="0" step="0.01" />
                </div>
              </div>
              <div>
                <label>Effective from</label>
                <input className="input" name="effective_from" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <button className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white">Create version</button>
            </form>
          </section>
          <section className="surface">
            <h2 className="section-title">Assign employee rule</h2>
            <form action={async (fd: FormData) => { "use server"; await assignCompensation(fd); }} className="mt-5 grid gap-4">
              <div>
                <label>Employee</label>
                <select className="input" name="employee_id">
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Rule</label>
                <select className="input" name="rule_id">
                  {rules.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} · v{r.version} · {r.rule_type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Effective from</label>
                <input className="input" name="effective_from" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <button className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white">Assign rule</button>
            </form>
            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="text-sm font-semibold">Active versions</h3>
              <div className="mt-3 space-y-2">
                {rules.map((r) => (
                  <div key={r.id} className="rounded-xl bg-slate-50 p-3 text-xs">
                    <div className="flex justify-between">
                      <span className="font-semibold">{r.name} · v{r.version}</span>
                      <span>{r.rule_type}</span>
                    </div>
                    <p className="mt-1 text-slate-500">Fixed ₹{Number(r.fixed_salary).toLocaleString('en-IN')} · Commission {r.commission_rate_percent}% · From {r.effective_from}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </CrmShell>
  );
}

