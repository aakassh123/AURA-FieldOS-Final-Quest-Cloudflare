import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/get-profile';
import { getCurrentUserEmail } from '@/lib/auth/get-current-user-email';
import { getFinanceDashboard } from '@/lib/finance/queries';
import { CrmShell } from '@/components/crm/crm-shell';

export default async function CommissionsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (!profile.company_id) redirect('/setup');

  const [email, { commissions }] = await Promise.all([
    getCurrentUserEmail(),
    getFinanceDashboard(),
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
            <p className="eyebrow">Sales earnings</p>
            <h1>Commissions</h1>
            <p>Commission entries are snapshots of the rule that was active when the sale was calculated.</p>
          </div>
        </div>
        <section className="surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-3">Employee</th>
                  <th>Revenue</th>
                  <th>Rate</th>
                  <th>Commission</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c: any) => (
                  <tr key={c.id} className="border-b border-slate-100">
                    <td className="py-3">{String(c.employee_id).slice(0, 8)}</td>
                    <td>₹{Number(c.revenue_amount).toLocaleString('en-IN')}</td>
                    <td>{c.rate_percent}%</td>
                    <td className="font-semibold">₹{Number(c.commission_amount).toLocaleString('en-IN')}</td>
                    <td><span className="badge">{c.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!commissions.length && <p className="muted py-8">No commission entries yet.</p>}
          </div>
        </section>
      </main>
    </CrmShell>
  );
}

