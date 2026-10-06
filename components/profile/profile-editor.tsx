"use client";

import { useState, useRef, type FormEvent, type ChangeEvent } from "react";
import { updateMyProfile } from "@/app/actions/profile";
import { Icon } from "@/components/icon";
import type { AppRole } from "@/lib/auth/types";

const AVATAR_PRESETS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80",
];

export function ProfileEditor({
  initialUser,
}: {
  initialUser: {
    id: string;
    email: string;
    fullName: string;
    role: AppRole;
    avatarUrl?: string | null;
    employeeCode?: string | null;
    designation?: string | null;
    phone?: string | null;
    joinedAt?: string | null;
    companyName?: string | null;
    gamification?: {
      level: number;
      xp: number;
      currentStreak: number;
      bestStreak: number;
      visitsCompleted: number;
      tasksCompleted: number;
    } | null;
  };
}) {
  const [avatar, setAvatar] = useState<string>(initialUser.avatarUrl || "");
  const [fullName, setFullName] = useState(initialUser.fullName || "");
  const [phone, setPhone] = useState(initialUser.phone || "");
  const [designation, setDesignation] = useState(initialUser.designation || "");
  const [employeeCode, setEmployeeCode] = useState(initialUser.employeeCode || "");
  const [joinedAt, setJoinedAt] = useState(initialUser.joinedAt || "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = fullName
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "AS";

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: "Photo must be less than 5MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas to resize/compress to max 400x400
        const canvas = document.createElement("canvas");
        const maxDim = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setAvatar(dataUrl);
        setMessage({ type: "success", text: "Photo selected. Click 'Save Profile Changes' to persist." });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const fd = new FormData();
      fd.set("full_name", fullName);
      fd.set("phone", phone);
      fd.set("designation", designation);
      fd.set("employee_code", employeeCode);
      fd.set("avatar_url", avatar);
      if (joinedAt) fd.set("joined_at", joinedAt);

      const res = await updateMyProfile(fd);

      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "success", text: "Profile details and photo updated successfully!" });
        // Force refresh parent tree
        setTimeout(() => {
          window.location.reload();
        }, 800);
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to save profile." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-500/10 blur-2xl" />
        <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          {/* Avatar with edit overlay */}
          <div className="relative shrink-0">
            <div className="relative h-28 w-28 overflow-hidden rounded-2xl border-2 border-teal-500/20 bg-slate-100 shadow-md">
              {avatar ? (
                <img src={avatar} alt={fullName} className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center bg-[var(--navy)] text-2xl font-black text-white">
                  {initials}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-xl bg-teal-600 text-white shadow-md transition hover:bg-teal-700"
              title="Upload photo"
            >
              <Icon name="camera" size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* User Headline info */}
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-700">
                {employeeCode || "EMP-001"}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {initialUser.role.replaceAll("_", " ")}
              </span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                ● Active
              </span>
            </div>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {fullName || "Employee"}
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {designation || "Sales & Operations Specialist"} · {initialUser.companyName || "AURA Technologies"}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">{initialUser.email}</p>

            {/* Quick avatar preset selector */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="text-[11px] font-semibold text-slate-400">Choose preset:</span>
              {AVATAR_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAvatar(p)}
                  className={`h-7 w-7 overflow-hidden rounded-lg border transition ${
                    avatar === p ? "border-teal-500 ring-2 ring-teal-400" : "border-slate-200 opacity-70 hover:opacity-100"
                  }`}
                >
                  <img src={p} alt="Preset" className="h-full w-full object-cover" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                Custom URL
              </button>
              {avatar && (
                <button
                  type="button"
                  onClick={() => setAvatar("")}
                  className="rounded-lg border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50"
                >
                  Remove photo
                </button>
              )}
            </div>

            {showUrlInput && (
              <div className="mt-3 flex max-w-md items-center gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/photo.jpg"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-teal-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customUrl) setAvatar(customUrl);
                    setShowUrlInput(false);
                  }}
                  className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Gamification Stats if available */}
      {initialUser.gamification && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Level</p>
            <p className="mt-1 text-2xl font-black text-teal-600">Lvl {initialUser.gamification.level}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{initialUser.gamification.xp} Total XP</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Streak</p>
            <p className="mt-1 text-2xl font-black text-amber-500">🔥 {initialUser.gamification.currentStreak} Days</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Best: {initialUser.gamification.bestStreak}d</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Verified Visits</p>
            <p className="mt-1 text-2xl font-black text-slate-800">{initialUser.gamification.visitsCompleted}</p>
            <p className="mt-0.5 text-[11px] text-emerald-600">GPS verified</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Completed Tasks</p>
            <p className="mt-1 text-2xl font-black text-slate-800">{initialUser.gamification.tasksCompleted}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Pipeline tasks</p>
          </div>
        </section>
      )}

      {/* Edit Form */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="border-b border-slate-100 pb-5">
          <h2 className="text-lg font-bold text-slate-900">Personal & Employee Information</h2>
          <p className="mt-1 text-xs text-slate-500">
            Keep your official corporate profile and contact channels up to date.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {message && (
            <div
              className={`rounded-xl p-3 text-xs font-semibold ${
                message.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Full Name *
              </span>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Rohit Kumar"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Employee Code / ID *
              </span>
              <input
                required
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                placeholder="EMP-001"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold tracking-wider outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </label>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Official Designation / Title
              </span>
              <input
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="Senior Field Representative"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Phone Number
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </label>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Official Email (Identity)
              </span>
              <input
                disabled
                value={initialUser.email}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500 outline-none cursor-not-allowed"
              />
              <span className="mt-1 block text-[10px] text-slate-400">
                Managed via Supabase Auth credentials.
              </span>
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Date Joined
              </span>
              <input
                type="date"
                value={joinedAt}
                onChange={(e) => setJoinedAt(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--navy)] px-6 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Icon name="loader" size={14} className="animate-spin" />
                  <span>Saving Changes…</span>
                </>
              ) : (
                <>
                  <Icon name="check" size={14} />
                  <span>Save Profile Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
