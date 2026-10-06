import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentProfile } from '@/lib/auth/get-profile';
import { getCurrentUserEmail } from '@/lib/auth/get-current-user-email';
import { createClient } from '@/lib/supabase/server';
import { CrmShell } from '@/components/crm/crm-shell';
import { markAllNotificationsRead, markNotificationRead } from '@/app/actions/notifications';

export default async function NotificationsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (!profile.company_id) redirect('/setup');
  const email = await getCurrentUserEmail();
  const supabase = await createClient();
  const { data: notifications } = await supabase.from('notifications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(100);
  const unread = (notifications ?? []).filter((item) => !item.read_at).length;

  return <CrmShell email={email} name={profile.full_name ?? 'User'} role={profile.role} avatarUrl={profile.avatar_url} employeeCode={profile.employee_code}>
    <main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
        <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-700">Inbox</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Notifications</h1><p className="mt-1 text-sm text-slate-500">Assignments, visits, finance updates and other events that need your attention.</p></div>
        {unread > 0 && <form action={async () => { "use server"; await markAllNotificationsRead(); }}><button className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Mark all as read</button></form>}
      </header>
      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {(notifications ?? []).length ? (notifications ?? []).map((item) => <div key={item.id} className={`flex gap-4 border-b border-slate-100 p-5 last:border-b-0 ${item.read_at ? '' : 'bg-teal-50/30'}`}>
          <div className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.read_at ? 'bg-slate-100 text-slate-500' : 'bg-teal-100 text-teal-700'}`}><span className="text-xs font-black">{item.type === 'LEAD_ASSIGNED' ? 'L' : item.type === 'TASK_ASSIGNED' ? 'T' : item.type === 'VISIT_PLANNED' ? 'V' : item.type === 'EXPENSE_REVIEWED' ? '₹' : item.type === 'COMMISSION_CREATED' ? '%' : '!'}</span></div>
          <div className="min-w-0 flex-1"><div className="flex flex-col justify-between gap-1 sm:flex-row"><p className="text-sm font-bold text-slate-900">{item.title}</p><time className="text-[10px] text-slate-400">{new Date(item.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</time></div><p className="mt-1 text-xs leading-5 text-slate-500">{item.body}</p><div className="mt-3 flex flex-wrap gap-2">{item.href && <Link href={item.href} className="rounded-lg bg-[var(--navy)] px-3 py-1.5 text-[10px] font-bold text-white">Open</Link>}{!item.read_at && <form action={async (fd: FormData) => { "use server"; await markNotificationRead(fd); }}><input type="hidden" name="notification_id" value={item.id}/><button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-600">Mark read</button></form>}</div></div>
        </div>) : <div className="px-6 py-16 text-center"><p className="text-sm font-semibold text-slate-700">No notifications yet</p><p className="mt-1 text-xs text-slate-400">AURA will notify you when relevant work changes happen.</p></div>}
      </section>
    </main>
  </CrmShell>;
}
