import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentProfile } from '@/lib/auth/get-profile';
import { getCurrentUserEmail } from '@/lib/auth/get-current-user-email';
import { getCrmData, getLead } from '@/lib/crm/queries';
import { ActivityForm, StageForm, TaskForm } from '@/components/crm/forms';
import { CrmShell } from '@/components/crm/crm-shell';
export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (!profile.company_id) redirect('/setup');
  const email = await getCurrentUserEmail();
  const [data, detail] = await Promise.all([getCrmData(), getLead(id)]);
  if (!detail) notFound();
  const l = detail.lead as any;
  return (
    <CrmShell
      email={email}
      name={profile.full_name ?? 'User'}
      role={profile.role}
      avatarUrl={profile.avatar_url}
      employeeCode={profile.employee_code}
    >
      <main className="mx-auto max-w-[1300px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Link href="/leads" className="text-xs font-semibold text-slate-500 hover:text-slate-800">← Back to leads</Link>
        <div className="mt-4 flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-700">{l.stage?.name}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{l.priority}</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{l.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{l.customer?.name ?? 'No customer linked'} · {l.owner?.full_name ?? 'Unassigned'}</p>
          </div>
          <StageForm leadId={id} currentStageId={l.stage_id} stages={data.stages}/>
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_380px]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Value" value={money(Number(l.estimated_value))}/>
                <Metric label="Source" value={l.source ?? '—'}/>
                <Metric label="Expected close" value={l.expected_close_date ? new Date(l.expected_close_date).toLocaleDateString('en-IN') : '—'}/>
                <Metric label="Next follow-up" value={l.next_follow_up_at ? new Date(l.next_follow_up_at).toLocaleDateString('en-IN') : '—'}/>
              </div>
              {l.notes && <div className="mt-5 rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Notes</p><p className="mt-2 text-sm leading-6 text-slate-600">{l.notes}</p></div>}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-bold">Activity timeline</h2>
              <p className="mt-1 text-xs text-slate-500">Keep every meaningful customer interaction in one place.</p>
              <div className="mt-5"><ActivityForm leadId={id}/></div>
              <div className="mt-6 space-y-4">
                {detail.activities.map((a: any) => (
                  <div key={a.id} className="relative pl-5">
                    <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-teal-500"/>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{a.type} · {a.employee?.full_name ?? 'Team member'}</p>
                      <time className="text-[10px] text-slate-400">{new Date(a.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</time>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{a.body}</p>
                  </div>
                ))}
                {!detail.activities.length && <p className="text-sm text-slate-400">No activity yet. Add the first useful note.</p>}
              </div>
            </section>
          </div>
          <aside className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-bold">Next action</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">Create a concrete follow-up so this lead never goes silent.</p>
              <div className="mt-5"><TaskForm leadId={id} employees={data.employees as any}/></div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-bold">CRM principle</h2>
              <p className="mt-2 text-xs leading-5 text-slate-500">A lead page should answer three questions quickly: <strong>Where are we?</strong> <strong>What happened?</strong> <strong>What happens next?</strong></p>
            </section>
          </aside>
        </div>
      </main>
    </CrmShell>
  );
}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 truncate text-xs font-bold text-slate-800">{value}</p></div>};function money(v:number){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(v)}
