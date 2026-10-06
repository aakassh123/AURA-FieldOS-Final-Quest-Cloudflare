import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getCurrentUserEmail } from "@/lib/auth/get-current-user-email";
import { getReportsData } from "@/lib/reports/queries";
import { Icon } from "@/components/icon";
import { CrmShell } from "@/components/crm/crm-shell";

const money = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;
const pct = (v: number) => `${v.toFixed(1)}%`;

function Card({ title, value, helper, icon }: { title: string; value: string; helper: string; icon: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-slate-500">{title}</p><p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-[11px] text-slate-500">{helper}</p></div><div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700"><Icon name={icon} size={18}/></div></div></div>;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const [profile, email, params] = await Promise.all([
    getCurrentProfile(),
    getCurrentUserEmail(),
    searchParams,
  ]);
  if (!profile) redirect("/login");
  if (!profile.company_id) redirect("/setup");
  const data = await getReportsData(params);
  const q = new URLSearchParams({ from: data.filters.from, to: data.filters.to }).toString();
  return (
    <CrmShell
      email={email}
      name={profile.full_name ?? "User"}
      role={profile.role}
      avatarUrl={profile.avatar_url}
      employeeCode={profile.employee_code}
    >
      <main className="min-h-screen bg-slate-50/70 px-4 py-6 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Insights</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Reports</h1><p className="mt-1 text-sm text-slate-500">Decision-ready sales, field and finance reporting.</p></div><div className="flex flex-wrap gap-2"><Link href={`/api/reports/export?${q}`} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"><Icon name="download" size={15}/> Export CSV</Link><Link href="/" className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Dashboard</Link></div></div>
        <form className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end"><label className="grid gap-1 text-xs font-medium text-slate-600">From<input name="from" type="date" defaultValue={data.filters.from} className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-400"/></label><label className="grid gap-1 text-xs font-medium text-slate-600">To<input name="to" type="date" defaultValue={data.filters.to} className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-400"/></label><button className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700">Apply period</button><span className="text-[11px] text-slate-400">All figures respect the signed-in user&apos;s RLS scope.</span></form>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Card title="Won revenue" value={money(data.sales.revenue)} helper={`${data.sales.wonDeals} won deals`} icon="badge-dollar-sign"/><Card title="Open pipeline" value={money(data.sales.openPipeline)} helper="Current open deal value" icon="funnel"/><Card title="Completed visits" value={String(data.field.completed)} helper={`${data.field.geofence_verified} geofence verified`} icon="map-pin-check"/><Card title="Travel distance" value={`${data.field.distance_km.toFixed(1)} km`} helper={`${data.field.trips} trips in period`} icon="route"/></section>
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]"><section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold text-slate-950">Sales performance</h2><p className="mt-1 text-xs text-slate-500">Revenue, deals, leads and completed visits by employee.</p></div></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead><tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400"><th className="px-3 py-2">Employee</th><th className="px-3 py-2">Revenue</th><th className="px-3 py-2">Deals</th><th className="px-3 py-2">Leads</th><th className="px-3 py-2">Visits</th><th className="px-3 py-2">Conversion</th></tr></thead><tbody>{data.sales.rows.map((row)=><tr key={row.employee_id} className="border-b border-slate-50 text-xs"><td className="px-3 py-3 font-semibold text-slate-800">{row.employee}</td><td className="px-3 py-3 font-semibold text-slate-950">{money(row.won_revenue)}</td><td className="px-3 py-3 text-slate-600">{row.deals}</td><td className="px-3 py-3 text-slate-600">{row.leads}</td><td className="px-3 py-3 text-slate-600">{row.visits}</td><td className="px-3 py-3 text-slate-600">{pct(row.conversion_rate)}</td></tr>)}</tbody></table></div></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-bold text-slate-950">Pipeline funnel</h2><p className="mt-1 text-xs text-slate-500">Lead volume and estimated value by stage.</p><div className="mt-5 space-y-3">{data.funnel.map((row, i)=>{const max=Math.max(...data.funnel.map(x=>x.leads),1); return <div key={row.stage}><div className="mb-1 flex items-center justify-between text-xs"><span className="font-semibold text-slate-700">{row.stage}</span><span className="text-slate-400">{row.leads} · {money(row.value)}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-teal-500" style={{width:`${Math.max(6,(row.leads/max)*100)}%`}}/></div></div>})}</div></section></div>
        {data.finance && <section className="rounded-2xl border border-slate-200 bg-white p-5"><div><h2 className="text-sm font-bold text-slate-950">Finance snapshot</h2><p className="mt-1 text-xs text-slate-500">Visible only to finance-authorized roles.</p></div><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Card title="Expenses submitted" value={money(data.finance.expenses_submitted)} helper="Claimed in period" icon="receipt"/><Card title="Expenses approved" value={money(data.finance.expenses_approved)} helper="Approved amount" icon="badge-check"/><Card title="Commission" value={money(data.finance.commissions)} helper="Calculated commission" icon="percent"/><Card title="Payouts" value={money(data.finance.payouts)} helper="Payout periods overlapping" icon="banknote"/></div></section>}
      </div></main>
    </CrmShell>
  );
}
