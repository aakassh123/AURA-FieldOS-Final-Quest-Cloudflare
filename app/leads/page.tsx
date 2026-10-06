import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentProfile } from '@/lib/auth/get-profile';
import { getCurrentUserEmail } from '@/lib/auth/get-current-user-email';
import { getCrmData } from '@/lib/crm/queries';
import { LeadForm } from '@/components/crm/forms';
import { CrmShell } from '@/components/crm/crm-shell';

export default async function LeadsPage({ searchParams }: { searchParams?: Promise<{ search?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const query = (params?.search || "").toLowerCase().trim();
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (!profile.company_id) redirect('/setup');
  const email = await getCurrentUserEmail();
  const data = await getCrmData();
  const allLeads = data.leads;
  const filteredLeads = query
    ? allLeads.filter(
        (l) =>
          l.title.toLowerCase().includes(query) ||
          l.customer?.name?.toLowerCase().includes(query) ||
          l.owner?.full_name?.toLowerCase().includes(query)
      )
    : allLeads;
  const open = filteredLeads.filter((l) => l.status === 'OPEN');
  const pipelineValue = open.reduce((s, l) => s + Number(l.estimated_value || 0), 0);

  return (
    <CrmShell
      email={email}
      name={profile.full_name ?? 'User'}
      role={profile.role}
      avatarUrl={profile.avatar_url}
      employeeCode={profile.employee_code}
    >
      <main className="mx-auto max-w-[1550px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-700">Sales CRM</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Leads</h1>
            <p className="mt-1 text-sm text-slate-500">One clean view of every opportunity, owner and next move.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/customers" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Customers</Link>
            <Link href="/leads/new" className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800">+ Create Opportunity</Link>
          </div>
        </header>

        {query && (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-teal-50 px-4 py-2.5 text-xs text-teal-800">
            <p>Showing search results for &ldquo;<strong>{query}</strong>&rdquo; ({filteredLeads.length} leads found)</p>
            <Link href="/leads" className="font-bold underline">Clear search</Link>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Open pipeline" value={String(open.length)}/>
          <Kpi label="Pipeline value" value={money(pipelineValue)}/>
          <Kpi label="High priority" value={String(open.filter(l=>l.priority==='HIGH').length)}/>
          <Kpi label="Follow-ups" value={String(open.filter(l=>l.next_follow_up_at).length)}/>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Pipeline Stages</h2>
              <p className="mt-0.5 text-xs text-slate-500">Move opportunities through your deal stages from discovery to close.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-400">{open.length} open</span>
              <Link href="/leads/new" className="text-xs font-bold text-teal-700 hover:underline">+ New opportunity</Link>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {data.stages.map((stage) => {
              const items = filteredLeads.filter((l) => l.stage_id === stage.id);
              return (
                <div key={stage.id} className="min-h-[180px] rounded-xl bg-slate-50 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{stage.name}</span>
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[9px] font-bold text-slate-500">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((lead) => (
                      <Link href={`/leads/${lead.id}`} key={lead.id} className="block rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold leading-4 text-slate-800">{lead.title}</p>
                          <Priority p={lead.priority}/>
                        </div>
                        <p className="mt-2 truncate text-[10px] text-slate-500">{lead.customer?.name ?? 'No customer linked'}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-700">{money(Number(lead.estimated_value))}</span>
                          <span className="text-[10px] text-slate-400">{lead.owner?.full_name ?? 'Unassigned'}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold">Lead list</h2>
              <p className="mt-1 text-xs text-slate-500">A fast operational view for sorting and follow-up.</p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="pb-3">Opportunity</th>
                  <th className="pb-3">Stage</th>
                  <th className="pb-3">Owner</th>
                  <th className="pb-3">Value</th>
                  <th className="pb-3">Priority</th>
                  <th className="pb-3">Next follow-up</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((l) => (
                  <tr key={l.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-3">
                      <Link href={`/leads/${l.id}`} className="text-xs font-semibold text-slate-800 hover:text-teal-700">{l.title}</Link>
                      <p className="mt-0.5 text-[10px] text-slate-400">{l.customer?.name ?? 'No customer'}</p>
                    </td>
                    <td className="py-3 text-xs text-slate-500">{l.stage?.name}</td>
                    <td className="py-3 text-xs text-slate-500">{l.owner?.full_name ?? 'Unassigned'}</td>
                    <td className="py-3 text-xs font-semibold text-slate-700">{money(Number(l.estimated_value))}</td>
                    <td className="py-3"><Priority p={l.priority}/></td>
                    <td className="py-3 text-xs text-slate-500">{l.next_follow_up_at ? new Date(l.next_follow_up_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </CrmShell>
  );
}
function Kpi({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-xl font-bold tracking-tight text-slate-950">{value}</p></div>}
function Priority({p}:{p:string}){return <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${p==='HIGH'?'bg-red-50 text-red-600':p==='MEDIUM'?'bg-amber-50 text-amber-700':'bg-slate-100 text-slate-500'}`}>{p}</span>}
function money(v:number){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(v)}
