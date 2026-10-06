import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/get-profile';
import { getCurrentUserEmail } from '@/lib/auth/get-current-user-email';
import { getFieldDashboard } from '@/lib/field/queries';
import { CrmShell } from '@/components/crm/crm-shell';
import { ShiftAttendanceManager } from '@/components/field/shift-attendance-manager';

export default async function AttendancePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (!profile.company_id) redirect('/setup');

  const email = await getCurrentUserEmail();
  const data = await getFieldDashboard();
  const today = new Intl.DateTimeFormat('en-CA').format(new Date());

  const todayAttendance = data.attendance.find((a) => a.attendance_date === today) ?? null;
  const activeSession = data.sessions.find((s) => s.status === 'ACTIVE') ?? null;

  return (
    <CrmShell
      email={email}
      name={profile.full_name ?? 'User'}
      role={profile.role}
      avatarUrl={profile.avatar_url}
      employeeCode={profile.employee_code}
    >
      <main className="mx-auto max-w-[1300px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-700">Time & Attendance</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Attendance & Shifts</h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time workplace check-in, 6:00 PM standard shift countdown, and field overtime tracking.
          </p>
        </header>

        {/* Live Attendance & Shift Manager Console */}
        <section className="mb-8">
          <ShiftAttendanceManager
            attendance={todayAttendance}
            activeSession={activeSession}
            employeeName={profile.full_name ?? 'Employee'}
          />
        </section>

        {/* History Log Table */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-sm font-bold text-slate-900">Attendance Log History</h2>
            <p className="mt-0.5 text-xs text-slate-500">Verified audit trail of check-ins, office days, and overtime runs.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="p-4">Date</th>
                  <th className="p-4">Photo Selfie</th>
                  <th className="p-4">Workplace Mode</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Check In</th>
                  <th className="p-4">Check Out</th>
                  <th className="p-4">Notes & Overtime</th>
                  <th className="p-4">GPS Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {data.attendance.map((a) => {
                  const checkInNote = String(a.check_in_note ?? '').toUpperCase();
                  const isOffice = checkInNote.includes('OFFICE');
                  const isOvertime = checkInNote.includes('OVERTIME');
                  const photoMatch = a.check_in_note?.match(/PHOTO:([^\s|]+)/);
                  const photoUrl = photoMatch ? photoMatch[1] : null;

                  return (
                    <tr key={a.id} className="hover:bg-slate-50/60">
                      <td className="p-4 font-semibold text-slate-800">
                        {new Date(a.attendance_date + 'T00:00:00').toLocaleDateString('en-IN', {
                          dateStyle: 'medium',
                        })}
                      </td>

                      <td className="p-4">
                        {photoUrl ? (
                          <a
                            href={photoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="group flex items-center gap-1.5"
                            title="Click to view full photo"
                          >
                            <img
                              src={photoUrl}
                              alt="Attendance Selfie"
                              className="h-9 w-9 rounded-full border-2 border-teal-500/50 object-cover shadow-sm transition group-hover:scale-110"
                            />
                            <span className="text-[10px] font-bold text-teal-700 underline group-hover:text-teal-900">
                              View
                            </span>
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                            <span>📷</span>
                            <span>Standard</span>
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            isOffice
                              ? 'bg-emerald-50 text-emerald-800'
                              : isOvertime
                              ? 'bg-purple-50 text-purple-800'
                              : 'bg-blue-50 text-blue-800'
                          }`}
                        >
                          {isOffice ? '🏢 In Office' : isOvertime ? '🌙 Field Overtime' : '🚗 Field Operations'}
                        </span>
                      </td>

                      <td className="p-4">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                          {a.status}
                        </span>
                      </td>

                      <td className="p-4 text-slate-600">
                        {new Date(a.check_in_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="p-4 text-slate-600">
                        {a.check_out_at
                          ? new Date(a.check_out_at).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>

                      <td className="p-4 text-slate-500">
                        <span className="line-clamp-1 max-w-[200px]" title={a.check_out_note || a.check_in_note || '—'}>
                          {a.check_out_note || a.check_in_note || '—'}
                        </span>
                      </td>

                      <td className="p-4 text-slate-500">
                        {a.check_in_accuracy_m ? `±${Math.round(a.check_in_accuracy_m)}m` : '—'}
                      </td>
                    </tr>
                  );
                })}

                {!data.attendance.length && (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-sm text-slate-400">
                      No attendance records found yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </CrmShell>
  );
}
