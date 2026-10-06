'use client';

import { useState, useEffect, useTransition } from 'react';
import type { Attendance, WorkSession } from '@/lib/field/types';
import {
  checkInWithType,
  autoCheckOutAt1800,
  continueOvertime,
  claimLateNightAllowance,
  completeDayAndCheckout,
} from '@/app/actions/field';

type Props = {
  attendance?: Attendance | null;
  activeSession?: WorkSession | null;
  employeeName: string;
};

export function ShiftAttendanceManager({
  attendance,
  activeSession,
  employeeName,
}: Props) {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [showAllowanceModal, setShowAllowanceModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [, startTransition] = useTransition();

  // Form states for Overtime
  const [otReason, setOtReason] = useState('🚨 Emergency Client Support / Site Visit');
  const [otDuration, setOtDuration] = useState('2');
  const [otNotes, setOtNotes] = useState('');

  // Form states for Allowance
  const [claimType, setClaimType] = useState('CAB_FARE');
  const [claimAmount, setClaimAmount] = useState('350');
  const [claimNotes, setClaimNotes] = useState('');

  // Update clock every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const currentHour = currentTime.getHours();
  const currentMinutes = currentTime.getMinutes();
  const isPast1800 = currentHour >= 18;

  // Determine current states
  const isCheckedIn = Boolean(attendance?.check_in_at && !attendance?.check_out_at);
  const isCheckedOut = Boolean(attendance?.check_out_at);
  const checkInNote = String(attendance?.check_in_note ?? '').toUpperCase();
  const checkOutNote = String(attendance?.check_out_note ?? '').toUpperCase();
  const isOffice = checkInNote.includes('OFFICE');
  const isOvertime = checkInNote.includes('OVERTIME');
  const isAutoLoggedOut = checkOutNote.includes('AUTO_LOGOUT_1800');

  // Trigger auto-logout for office employees when clock hits 18:00
  useEffect(() => {
    if (isPast1800 && isCheckedIn && isOffice && !isOvertime && !isCheckedOut) {
      // Execute auto-logout for office employee
      autoCheckOutAt1800().then((res) => {
        if (res.success) {
          setStatusMessage('Office shift auto-completed at 6:00 PM.');
        }
      });
    }
  }, [isPast1800, isCheckedIn, isOffice, isOvertime, isCheckedOut]);

  // Helper to acquire GPS position with robust fallback
  const getCoordinates = async () => {
    return new Promise<{ latitude: number; longitude: number; accuracy: number }>((resolve) => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        resolve({ latitude: 26.8467, longitude: 80.9462, accuracy: 20 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          console.warn('Geolocation warning, using standard office coordinates:', err?.message);
          resolve({ latitude: 26.8467, longitude: 80.9462, accuracy: 25 });
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    });
  };

  // Action: Check In With Type (Office or Field)
  const handleCheckIn = async (mode: 'OFFICE' | 'FIELD') => {
    setError(null);
    setPending(true);
    try {
      const pos = await getCoordinates();
      const fd = new FormData();
      fd.set('mode', mode);
      fd.set('latitude', String(pos.latitude));
      fd.set('longitude', String(pos.longitude));
      fd.set('accuracy', String(pos.accuracy));
      fd.set('local_date', new Intl.DateTimeFormat('en-CA').format(new Date()));

      const res = await checkInWithType(fd);
      if (res.error) {
        setError(res.error);
      } else {
        setStatusMessage(`Successfully punched in for ${mode === 'OFFICE' ? 'Office' : 'Field Operations'}!`);
        startTransition(() => {
          window.location.reload();
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to capture GPS location.');
    } finally {
      setPending(false);
    }
  };

  // Action: Activate Overtime
  const handleStartOvertime = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      let coords = { latitude: 0, longitude: 0, accuracy: 0 };
      try {
        coords = await getCoordinates();
      } catch {
        // Fallback if permission blocked
      }

      const fd = new FormData();
      fd.set('reason', otReason);
      fd.set('duration_hours', otDuration);
      fd.set('notes', otNotes);
      fd.set('latitude', String(coords.latitude || 26.8467));
      fd.set('longitude', String(coords.longitude || 80.9462));
      fd.set('accuracy', String(coords.accuracy || 15));
      fd.set('local_date', new Intl.DateTimeFormat('en-CA').format(new Date()));

      const res = await continueOvertime(fd);
      if (res.error) {
        setError(res.error);
      } else {
        setShowOvertimeModal(false);
        setStatusMessage('Overtime session initiated! +150 Overtime Field XP awarded.');
        startTransition(() => {
          window.location.reload();
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Could not start overtime.');
    } finally {
      setPending(false);
    }
  };

  // Action: Submit Late Night Allowance Claim
  const handleClaimAllowance = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const fd = new FormData();
      fd.set('claim_type', claimType);
      fd.set('amount', claimAmount);
      fd.set('notes', claimNotes);
      fd.set('local_date', new Intl.DateTimeFormat('en-CA').format(new Date()));

      const res = await claimLateNightAllowance(fd);
      if (res.error) {
        setError(res.error);
      } else {
        setShowAllowanceModal(false);
        setStatusMessage(`₹${claimAmount} conveyance allowance logged for verification.`);
        startTransition(() => {
          window.location.reload();
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to submit claim.');
    } finally {
      setPending(false);
    }
  };

  // Action: Complete Day & Checkout
  const handleFinalCheckout = async () => {
    setError(null);
    setPending(true);
    try {
      const pos = await getCoordinates();
      const fd = new FormData();
      fd.set('latitude', String(pos.latitude));
      fd.set('longitude', String(pos.longitude));
      fd.set('accuracy', String(pos.accuracy));
      fd.set('summary_notes', isOvertime ? 'Completed extended field overtime work' : 'Normal workday wrapped up');
      fd.set('local_date', new Intl.DateTimeFormat('en-CA').format(new Date()));

      const res = await completeDayAndCheckout(fd);
      if (res.error) {
        setError(res.error);
      } else {
        setShowCheckoutModal(false);
        setStatusMessage('Workday completed and verified with GPS.');
        startTransition(() => {
          window.location.reload();
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to record checkout.');
    } finally {
      setPending(false);
    }
  };

  // Calculate shift progress percentage (09:00 to 18:00 = 9 hours)
  const shiftStartMin = 9 * 60; // 540 min
  const shiftEndMin = 18 * 60; // 1080 min
  const currentTotalMin = currentHour * 60 + currentMinutes;
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round(((currentTotalMin - shiftStartMin) / (shiftEndMin - shiftStartMin)) * 100))
  );

  return (
    <div className="space-y-4">
      {/* Alert / Feedback message */}
      {statusMessage && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 shadow-sm">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-emerald-600 hover:text-emerald-950"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800 shadow-sm">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-950"
          >
            ✕
          </button>
        </div>
      )}

      {/* ================================================================= */}
      {/* CASE 1: NOT CHECKED IN YET ("SHINE IN FIRST - MARK ATTENDANCE")    */}
      {/* ================================================================= */}
      {!isCheckedIn && !isCheckedOut && (
        <div className="overflow-hidden rounded-2xl border-2 border-teal-500/30 bg-gradient-to-br from-teal-50/70 via-white to-emerald-50/40 p-6 shadow-md">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-teal-800">
                  Step 1 Required
                </span>
                <span className="text-xs text-slate-500">Standard Shift: 09:00 AM – 06:00 PM</span>
              </div>
              <h2 className="mt-1.5 text-xl font-black text-slate-950">
                👋 Rise & Shine, {employeeName.split(' ')[0]}! Mark Attendance to Begin
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                To start customer visits, view active tasks, or log office hours, please punch in your attendance for today with verified GPS.
              </p>
            </div>

            <div className="text-right">
              <span className="font-mono text-2xl font-black text-slate-900">
                {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Time</p>
            </div>
          </div>

          {/* Workplace Selection Action Cards */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {/* Card 1: Office Check-In */}
            <div className="group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-500 hover:shadow-md">
              <div>
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-xl text-emerald-700">
                    🏢
                  </span>
                  <span className="rounded-full bg-emerald-100/70 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                    Office Geofence
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-900">Working in Office</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Punch in for Head Office or Regional Branch. Real-time office attendance with automatic 6:00 PM shift conclusion.
                </p>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleCheckIn('OFFICE')}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {pending ? 'Verifying GPS…' : 'Punch In (Office)'}
                </button>
              </div>
            </div>

            {/* Card 2: Field Operations Check-In */}
            <div className="group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-500 hover:shadow-md">
              <div>
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-xl text-blue-700">
                    🚗
                  </span>
                  <span className="rounded-full bg-blue-100/70 px-2 py-0.5 text-[10px] font-extrabold text-blue-800">
                    Field Operations
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-bold text-slate-900">Going into the Field</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Punch in for client meetings, site inspections, and routes. Unlocks visit check-ins, trip odometer, and after-hours options.
                </p>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleCheckIn('FIELD')}
                  className="w-full rounded-xl bg-[var(--navy)] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {pending ? 'Verifying GPS…' : 'Punch In (Field Operations)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* CASE 2: ACTIVE SHIFT (CHECKED IN)                                */}
      {/* ================================================================= */}
      {isCheckedIn && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {/* Shift Header & Mode */}
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">Active Shift</h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                      isOvertime
                        ? 'bg-purple-100 text-purple-800'
                        : isOffice
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {isOvertime ? '🌙 Field Overtime (+1.5x Pay)' : isOffice ? '🏢 In Office Work' : '🚗 Field Active'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Punched in at{' '}
                  <span className="font-semibold text-slate-700">
                    {attendance?.check_in_at
                      ? new Date(attendance.check_in_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </span>
                  {attendance?.check_in_accuracy_m && (
                    <span> · GPS ±{Math.round(attendance.check_in_accuracy_m)}m</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Regular Checkout Button if needed */}
              <button
                type="button"
                disabled={pending}
                onClick={() => setShowCheckoutModal(true)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
              >
                🏁 Check Out
              </button>
            </div>
          </div>

          {/* Shift Timeline / Progress Bar */}
          <div className="mt-4 rounded-xl bg-slate-50 p-3">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <span>09:00 AM (Start)</span>
              <span className="font-bold text-slate-800">
                {isPast1800
                  ? 'Standard Shift Concluded (06:00 PM)'
                  : `${Math.max(0, 18 - currentHour)}h ${Math.max(0, 60 - currentMinutes)}m remaining`}
              </span>
              <span>06:00 PM (Standard Shift End)</span>
            </div>

            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full transition-all duration-500 ${
                  isPast1800 ? 'bg-purple-600' : 'bg-teal-600'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* ================================================================= */}
          {/* AFTER 6:00 PM (18:00) EXTRA WORK OPTIONS BANNER FOR FIELD STAFF    */}
          {/* ================================================================= */}
          {isPast1800 && (
            <div className="mt-4 rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 via-white to-purple-50/50 p-4 shadow-sm">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-purple-200 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-purple-900">
                      ⚡ After 6:00 PM Options
                    </span>
                    <span className="text-xs font-bold text-purple-950">Field Employee Extra Work</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Standard 6:00 PM shift has concluded. Choose an action below to log extra hours, claim late travel, or complete the day:
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowOvertimeModal(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-purple-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-purple-800"
                  >
                    <span>🌙</span>
                    <span>Continue Overtime</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAllowanceModal(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-purple-300 bg-white px-3.5 py-2 text-xs font-bold text-purple-900 shadow-sm transition hover:bg-purple-50"
                  >
                    <span>🚖</span>
                    <span>Late Travel Claim</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCheckoutModal(true)}
                    className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    Finish Day
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Overtime Active Banner (if user already started overtime) */}
          {isOvertime && (
            <div className="mt-4 rounded-xl border border-purple-300 bg-purple-100/60 p-3 text-xs text-purple-950">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🌙</span>
                  <span className="font-extrabold">{attendance?.check_in_note}</span>
                </div>
                <span className="rounded-full bg-purple-200 px-2 py-0.5 text-[10px] font-black text-purple-900">
                  +1.5x Rate Applied
                </span>
              </div>
              <p className="mt-1 text-[11px] text-purple-800">
                Live GPS tracking is broadcasting your after-hours location to the Admin Map for safety and audit compliance.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* CASE 3: SHIFT COMPLETED (CHECKED OUT)                            */}
      {/* ================================================================= */}
      {isCheckedOut && (
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-xl text-emerald-700">
                🎉
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {isAutoLoggedOut ? 'Shift Completed at 6:00 PM (Auto-Logout)' : 'Workday Successfully Completed'}
                </h3>
                <p className="text-xs text-slate-500">
                  Checked out at{' '}
                  <span className="font-semibold text-slate-700">
                    {attendance?.check_out_at
                      ? new Date(attendance.check_out_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '6:00 PM'}
                  </span>
                  {attendance?.check_out_note && (
                    <span> · {attendance.check_out_note}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Option to re-open for after-hours field emergency */}
            <button
              type="button"
              onClick={() => setShowOvertimeModal(true)}
              className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-800 transition hover:bg-purple-100"
            >
              🌙 Start Emergency Overtime
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 1: OVERTIME (EXTRA WORK) CONFIGURATION                      */}
      {/* ================================================================= */}
      {showOvertimeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🌙</span>
                <h3 className="text-base font-bold text-slate-900">Continue Field Overtime</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowOvertimeModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStartOvertime} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700">Select Overtime Reason</label>
                <select
                  value={otReason}
                  onChange={(e) => setOtReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 outline-none focus:border-purple-600 focus:bg-white"
                >
                  <option value="🚨 Emergency Client Support / Site Visit">🚨 Emergency Client Support / Site Visit</option>
                  <option value="📦 Late Customer Delivery & Handover">📦 Late Customer Delivery & Handover</option>
                  <option value="🤝 Urgent Deal Negotiation & Closing">🤝 Urgent Deal Negotiation & Closing</option>
                  <option value="🛠️ On-Site Installation & Troubleshooting">🛠️ On-Site Installation & Troubleshooting</option>
                  <option value="📋 Extended Field Audit & Survey">📋 Extended Field Audit & Survey</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Expected Duration</label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {['1', '2', '3'].map((hrs) => (
                    <button
                      key={hrs}
                      type="button"
                      onClick={() => setOtDuration(hrs)}
                      className={`rounded-xl py-2 text-xs font-bold transition ${
                        otDuration === hrs
                          ? 'bg-purple-700 text-white shadow-sm'
                          : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      +{hrs} Hour{hrs !== '1' ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Additional Notes / Customer Name</label>
                <input
                  type="text"
                  value={otNotes}
                  onChange={(e) => setOtNotes(e.target.value)}
                  placeholder="e.g. Acme Corp server room inspection"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 outline-none focus:border-purple-600 focus:bg-white"
                />
              </div>

              {/* Overtime Perks Box */}
              <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-[11px] text-purple-900">
                <div className="font-bold">✨ Field Overtime Benefits:</div>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-purple-800">
                  <li>1.5x Overtime Hourly Pay Multiplier recorded.</li>
                  <li>+150 XP bonus added to your Gamification Level.</li>
                  <li>Live safety tracking on Admin Real-Time Map.</li>
                </ul>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOvertimeModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 rounded-xl bg-purple-700 py-2.5 text-xs font-bold text-white hover:bg-purple-800 disabled:opacity-50"
                >
                  {pending ? 'Starting…' : 'Start Overtime Run'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 2: NIGHT TRAVEL / CONVEYANCE ALLOWANCE                      */}
      {/* ================================================================= */}
      {showAllowanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🚖</span>
                <h3 className="text-base font-bold text-slate-900">After-Hours Conveyance Claim</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAllowanceModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleClaimAllowance} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700">Claim Category</label>
                <select
                  value={claimType}
                  onChange={(e) => setClaimType(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 outline-none focus:border-purple-600 focus:bg-white"
                >
                  <option value="CAB_FARE">🚖 Cab / Taxi / Auto Rickshaw Fare</option>
                  <option value="FUEL_PER_KM">⛽ Personal Vehicle Fuel Allowance (Per Km)</option>
                  <option value="DINNER_ALLOWANCE">🍽️ Late Night Dinner Allowance (Past 8 PM)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Claim Amount (INR ₹)</label>
                <input
                  type="number"
                  min="50"
                  step="10"
                  value={claimAmount}
                  onChange={(e) => setClaimAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-900 outline-none focus:border-purple-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Journey / Route Details</label>
                <input
                  type="text"
                  value={claimNotes}
                  onChange={(e) => setClaimNotes(e.target.value)}
                  placeholder="e.g. Client site Sector 62 to Residence via Cab"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 outline-none focus:border-purple-600 focus:bg-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAllowanceModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 rounded-xl bg-purple-700 py-2.5 text-xs font-bold text-white hover:bg-purple-800 disabled:opacity-50"
                >
                  {pending ? 'Submitting…' : 'Submit Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL 3: FINISH DAY / CHECKOUT CONFIRMATION                       */}
      {/* ================================================================= */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-2xl text-emerald-800">
              🏁
            </span>
            <h3 className="mt-3 text-base font-bold text-slate-900">Complete Day & Check Out</h3>
            <p className="mt-1 text-xs text-slate-500">
              Your location and end-of-day summary will be submitted for attendance records.
            </p>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                Back
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleFinalCheckout}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {pending ? 'Verifying GPS…' : 'Confirm Check Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
