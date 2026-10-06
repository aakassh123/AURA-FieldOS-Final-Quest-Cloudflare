import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentProfile } from '@/lib/auth/get-profile';
import { getCurrentUserEmail } from '@/lib/auth/get-current-user-email';
import { getFieldDashboard } from '@/lib/field/queries';
import { CrmShell } from '@/components/crm/crm-shell';
import { ShiftAttendanceManager } from '@/components/field/shift-attendance-manager';
import { WorkSessionHeartbeat } from '@/components/field/work-session-heartbeat';
import { QuestBoard } from '@/components/rewards/quest-board';

export default async function FieldPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (!profile.company_id) redirect('/setup');

  const email = await getCurrentUserEmail();
  const data = await getFieldDashboard();
  const today = new Intl.DateTimeFormat('en-CA').format(new Date());

  const attendance = data.attendance.find((a) => a.attendance_date === today) ?? null;
  const active = data.sessions.find((s) => s.status === 'ACTIVE') ?? null;
  const isCheckedIn = Boolean(attendance?.check_in_at && !attendance?.check_out_at);

  const todayVisits = data.visits.filter(
    (v) =>
      v.scheduled_at?.slice(0, 10) === today ||
      v.started_at?.slice(0, 10) === today ||
      v.completed_at?.slice(0, 10) === today
  );
  const doneTasks = data.tasks.filter((t: any) => t.status === 'DONE').length;

  return (
    <CrmShell
      email={email}
      name={profile.full_name ?? 'User'}
      role={profile.role}
      avatarUrl={profile.avatar_url}
      employeeCode={profile.employee_code}
    >
      <main className="mx-auto max-w-[1450px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-700">Workforce Operations</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Daily Field & Office Shift</h1>
            <p className="mt-1 text-sm text-slate-500">
              Attendance-first workflow, real-time GPS tracking, standard 9 AM – 6 PM shift, and after-hours overtime.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/map" className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              🗺️ Live Map
            </Link>
            <Link href="/visits" className="rounded-xl bg-[var(--navy)] px-4 py-2 text-xs font-semibold text-white">
              Plan a visit
            </Link>
          </div>
        </header>

        {/* Section 1: Attendance First & Shift Progress Manager */}
        <section className="mb-6">
          <ShiftAttendanceManager
            attendance={attendance}
            activeSession={active}
            employeeName={profile.full_name ?? 'Employee'}
          />
          {active && <WorkSessionHeartbeat sessionId={active.id} />}
        </section>

        {/* Section 2: Progress Metrics */}
        <section className="grid gap-4 sm:grid-cols-3">
          <Metric value={String(data.tasks.length)} label="Assigned Tasks" hint="CRM customer queue" />
          <Metric value={String(todayVisits.length)} label="Today's Visits" hint="Scheduled field meetings" />
          <Metric value={String(doneTasks)} label="Missions Completed" hint="Rewards unlocked" />
        </section>

        {/* Section 3: Tasks & Missions with Check-In Guard */}
        <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_390px]">
          <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Today's Missions & Field Tasks</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Complete field and office missions to earn company-approved XP and rewards.
                </p>
              </div>
              <Link href="/rewards" className="text-xs font-semibold text-teal-700 hover:underline">
                View rewards →
              </Link>
            </div>

            {!isCheckedIn ? (
              <div className="relative rounded-xl border border-dashed border-slate-200 p-8 text-center">
                <span className="text-3xl">🔒</span>
                <h3 className="mt-2 text-sm font-bold text-slate-800">Punch in attendance first</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Select Office or Field check-in above to unlock active tasks and verify your day.
                </p>
              </div>
            ) : (
              <QuestBoard tasks={data.tasks as any} />
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <h2 className="text-sm font-bold text-slate-900">Today's Customer Visits</h2>
              <p className="mt-1 text-xs text-slate-500">GPS geofence verified interactions.</p>
            </div>
            <div className="divide-y divide-slate-100">
              {todayVisits.slice(0, 6).map((v) => (
                <Link
                  href={`/visits/${v.id}`}
                  key={v.id}
                  className="block p-4 transition hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-800">{v.customer?.name}</p>
                    <span
                      className={`text-[9px] font-bold ${
                        v.geofence_verified ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {v.geofence_verified ? 'GPS verified' : v.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {v.outcome || 'No outcome recorded yet'}
                  </p>
                </Link>
              ))}
              {!todayVisits.length && (
                <div className="p-8 text-center text-xs text-slate-400">
                  No visits logged for today.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </CrmShell>
  );
}

function Metric({ value, label, hint }: { value: string; label: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <p className="text-2xl font-black text-slate-900">{value}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
    </div>
  );
}
