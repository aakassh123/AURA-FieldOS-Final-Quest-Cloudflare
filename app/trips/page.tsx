import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentProfile } from '@/lib/auth/get-profile';
import { getCurrentUserEmail } from '@/lib/auth/get-current-user-email';
import { getTrips } from '@/lib/maps/queries';
import { CrmShell } from '@/components/crm/crm-shell';
import { LocationAction } from '@/components/field/location-action';
import { TripTracker } from '@/components/maps/trip-tracker';
import { startTrip, endTrip } from '@/app/actions/field';
import { createClient } from '@/lib/supabase/server';

export default async function TripsPage() {
  const profile = await getCurrentProfile(); if (!profile) redirect('/login'); if (!profile.company_id) redirect('/setup');
  const email = await getCurrentUserEmail(); const trips = await getTrips(); const supabase = await createClient();
  const { data: employee } = await supabase.from('employees').select('id').eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '').maybeSingle();
  const active = employee ? trips.find(t => t.employee_id === employee.id && t.status === 'ACTIVE') : null;
  return (
    <CrmShell
      email={email}
      name={profile.full_name ?? 'User'}
      role={profile.role}
      avatarUrl={profile.avatar_url}
      employeeCode={profile.employee_code}
    >
    <main className="mx-auto max-w-[1250px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-700">Field work</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Trips & Distance</h1><p className="mt-1 text-sm text-slate-500">Capture field travel as a measurable operational record.</p></div><Link href="/map" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700">Open live map</Link></header>
      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]"><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">My trip status</p>{active?<><div className="mt-2 flex items-center justify-between"><h2 className="text-lg font-bold">Trip in progress</h2><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">ACTIVE</span></div><p className="mt-1 text-xs text-slate-500">Started {new Date(active.started_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})} · {((active.distance_m||0)/1000).toFixed(2)} km recorded</p><div className="mt-4 flex items-center gap-3"><LocationAction action={endTrip} hidden={{trip_id:active.id}} label="End trip with GPS" className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-xs font-bold text-white"/><TripTracker tripId={active.id}/></div></>:<><h2 className="mt-2 text-lg font-bold">Ready to travel</h2><p className="mt-1 text-xs text-slate-500">Start a trip before travelling to the next customer.</p><div className="mt-4"><LocationAction action={startTrip} hidden={{purpose:'Customer visits / sales travel'}} label="Start trip with GPS" className="rounded-xl bg-[var(--teal)] px-4 py-2.5 text-xs font-bold text-[var(--navy)]"/></div></>}</div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Distance model</p><div className="mt-3 grid grid-cols-3 gap-2"><Metric value={String(trips.filter(t=>t.status==='COMPLETED').length)} label="Completed"/><Metric value={`${(trips.reduce((s,t)=>s+(t.distance_m||0),0)/1000).toFixed(1)} km`} label="Recorded"/><Metric value={String(trips.filter(t=>t.status==='ACTIVE').length)} label="Active"/></div><p className="mt-3 text-[11px] leading-5 text-slate-500">Distance is accumulated from consecutive GPS points using the database Haversine calculation. This is a travel metric, not a billing amount.</p></div></section>
      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 p-5"><h2 className="text-sm font-bold">Trip history</h2><p className="mt-1 text-xs text-slate-500">Latest 100 company-visible trips according to your role.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400"><th className="p-4">Employee</th><th className="p-4">Started</th><th className="p-4">Status</th><th className="p-4">Distance</th><th className="p-4">Purpose</th></tr></thead><tbody>{trips.map(t=><tr key={t.id} className="border-b border-slate-50 last:border-0"><td className="p-4 text-xs font-semibold text-slate-800">{t.employee?.full_name ?? 'Employee'}</td><td className="p-4 text-xs text-slate-500">{new Date(t.started_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</td><td className="p-4"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${t.status==='COMPLETED'?'bg-emerald-50 text-emerald-700':t.status==='ACTIVE'?'bg-teal-50 text-teal-700':'bg-slate-100 text-slate-500'}`}>{t.status}</span></td><td className="p-4 text-xs font-semibold text-slate-700">{((t.distance_m||0)/1000).toFixed(2)} km</td><td className="p-4 text-xs text-slate-500">{t.purpose||'—'}</td></tr>)}{!trips.length&&<tr><td colSpan={5} className="p-12 text-center text-sm text-slate-500">No trips recorded yet.</td></tr>}</tbody></table></div></section>
    </main>
  </CrmShell>
  );
}
function Metric({value,label}:{value:string;label:string}){return <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-lg font-bold text-slate-900">{value}</p><p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</p></div>}
