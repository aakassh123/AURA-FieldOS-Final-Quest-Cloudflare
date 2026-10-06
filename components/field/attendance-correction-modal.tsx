"use client";

import { useState } from "react";
import { correctAttendance } from "@/app/actions/field";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  attendanceId: string;
  currentMode: "OFFICE" | "FIELD";
  isCheckedOut: boolean;
  onSuccess: () => void;
}

export function AttendanceCorrectionModal({
  isOpen,
  onClose,
  attendanceId,
  currentMode,
  isCheckedOut,
  onSuccess,
}: Props) {
  const [actionType, setActionType] = useState<"CHANGE_MODE" | "REOPEN_SHIFT" | "RESET">(
    isCheckedOut ? "REOPEN_SHIFT" : "CHANGE_MODE"
  );
  const [newMode, setNewMode] = useState<"OFFICE" | "FIELD">(
    currentMode === "OFFICE" ? "FIELD" : "OFFICE"
  );
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Please provide a brief reason for the attendance correction.");
      return;
    }

    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.set("attendance_id", attendanceId);
    fd.set("action_type", actionType);
    fd.set("mode", newMode);
    fd.set("reason", reason.trim());

    try {
      const res = await correctAttendance(fd);
      if (res?.error) {
        setError(res.error);
        setLoading(false);
      } else {
        setLoading(false);
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || "Failed to submit correction.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Attendance Mistake Correction</h3>
            <p className="text-xs text-slate-500">Fix check-in mode, undo check-out, or reset record</p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700">What do you want to correct?</label>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 p-3 text-xs font-medium cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="action"
                  checked={actionType === "CHANGE_MODE"}
                  onChange={() => setActionType("CHANGE_MODE")}
                  className="text-teal-600"
                />
                <div>
                  <span className="font-bold text-slate-900">Change Shift Mode</span>
                  <p className="text-[11px] text-slate-500">
                    Switch between Office Mode and Field Operations
                  </p>
                </div>
              </label>

              {isCheckedOut && (
                <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 p-3 text-xs font-medium cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="action"
                    checked={actionType === "REOPEN_SHIFT"}
                    onChange={() => setActionType("REOPEN_SHIFT")}
                    className="text-teal-600"
                  />
                  <div>
                    <span className="font-bold text-slate-900">Re-Open Shift (Undo Accidental Check-Out)</span>
                    <p className="text-[11px] text-slate-500">
                      Resumes your active shift if you accidentally checked out early
                    </p>
                  </div>
                </label>
              )}

              <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 p-3 text-xs font-medium cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="action"
                  checked={actionType === "RESET"}
                  onChange={() => setActionType("RESET")}
                  className="text-teal-600"
                />
                <div>
                  <span className="font-bold text-red-700">Reset & Re-Punch for Today</span>
                  <p className="text-[11px] text-slate-500">
                    Clears today&apos;s record so you can take a fresh camera selfie & punch in again
                  </p>
                </div>
              </label>
            </div>
          </div>

          {actionType === "CHANGE_MODE" && (
            <div>
              <label className="text-xs font-bold text-slate-700">Select Correct Mode</label>
              <select
                value={newMode}
                onChange={(e) => setNewMode(e.target.value as any)}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 outline-none"
              >
                <option value="OFFICE">🏢 Office Mode</option>
                <option value="FIELD">🚗 Field Duty Operations</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700">Reason for Correction *</label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Accidental click, had to switch to client visit, or wrong mode selected"
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 outline-none focus:border-teal-500"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 font-semibold">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-[var(--navy)] py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Updating…" : "Apply Correction ✓"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
