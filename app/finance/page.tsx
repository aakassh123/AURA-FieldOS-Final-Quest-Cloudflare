import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/get-profile';
import { getCurrentUserEmail } from '@/lib/auth/get-current-user-email';
import { getFinanceDashboard, getFinancePeople } from '@/lib/finance/queries';
import { DealForm } from '@/components/finance/finance-shell';
import { Wallet, TrendingUp, Percent, Receipt } from 'lucide-react';
import { CrmShell } from '@/components/crm/crm-shell';

const money = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);

export default async function FinancePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (!profile.company_id) redirect('/setup');
  if (!['SUPER_ADMIN', 'COMPANY_ADMIN', 'HR_ACCOUNTS'].includes(profile.role)) {
    redirect('/');
  }

  const [email, dashboardData, people] = await Promise.all([
    getCurrentUserEmail(),
    getFinanceDashboard(),
    getFinancePeople(),
  ]);

  const { expenses, deals, commissions, payouts } = dashboardData;
  const revenue = deals
    .filter((d: any) => d.status === 'WON')
    .reduce((s: number, d: any) => s + Number(d.revenue_amount || 0), 0);
  const commission = commissions.reduce(
    (s: number, c: any) => s + Number(c.commission_amount || 0),
    0
  );
  const pending = expenses
    .filter((e) => e.status === 'SUBMITTED')
    .reduce((s: number, e) => s + Number(e.amount || 0), 0);

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
            <p className="eyebrow">Finance & compensation</p>
            <h1>Money command center</h1>
            <p>Connect sales outcomes, field costs and employee earnings.</p>
          </div>
          <div className="icon-box">
            <Wallet size={20} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Won revenue" value={money(revenue)} icon={<TrendingUp size={18} />} />
          <Metric label="Commission accrued" value={money(commission)} icon={<Percent size={18} />} />
          <Metric label="Expense review" value={money(pending)} icon={<Receipt size={18} />} />
          <Metric label="Payout records" value={String(payouts.length)} icon={<Wallet size={18} />} />
        </div>

        <section className="surface mt-5">
          <div className="mb-5">
            <h2 className="section-title">Record a sale</h2>
            <p className="muted">Won deals can create commission entries from the active employee rule.</p>
          </div>
          <DealForm employees={people.employees} />
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <List title="Recent commissions" rows={commissions} valueKey="commission_amount" labelKey="employee_id" />
          <List title="Recent deals" rows={deals} valueKey="revenue_amount" labelKey="title" />
        </section>
      </main>
    </CrmShell>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="surface">
      <div className="flex justify-between">
        <span className="muted">{label}</span>
        <span className="text-slate-500">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
    </div>
  );
}

function List({
  title,
  rows,
  valueKey,
  labelKey,
}: {
  title: string;
  rows: any[];
  valueKey: string;
  labelKey: string;
}) {
  return (
    <div className="surface">
      <h2 className="section-title">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.slice(0, 8).map((r: any) => {
          const empLabel = r.employee?.full_name
            ? `${r.employee.full_name} (${r.employee.employee_code || 'EMP'})`
            : r.owner?.full_name
            ? `${r.owner.full_name} (${r.owner.employee_code || 'EMP'})`
            : `Employee ${String(r[labelKey] || '').slice(0, 8)}`;

          return (
            <div key={r.id} className="flex justify-between rounded-xl border border-slate-200 p-3">
              <div>
                <p className="text-sm font-semibold">
                  {labelKey === 'employee_id' || labelKey === 'owner_employee_id'
                    ? empLabel
                    : r[labelKey]}
                </p>
                <p className="text-xs text-slate-500">{r.status}</p>
              </div>
              <p className="font-bold">{money(Number(r[valueKey]))}</p>
            </div>
          );
        })}
        {!rows.length && <p className="muted">Nothing here yet.</p>}
      </div>
    </div>
  );
}
