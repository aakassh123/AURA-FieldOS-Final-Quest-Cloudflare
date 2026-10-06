"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { SignOutButton } from "@/components/sign-out-button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import type { AppRole } from "@/lib/auth/types";

export function Topbar({
  onMenu,
  email,
  name,
  role,
  avatarUrl,
  employeeCode,
}: {
  onMenu: () => void;
  email?: string;
  name?: string;
  role?: AppRole;
  avatarUrl?: string | null;
  employeeCode?: string | null;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const displayName = name || email?.split("@")[0] || "User";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "AS";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && search.trim()) {
      router.push(`/leads?search=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center gap-3 border-b border-[var(--border)] bg-white/95 px-4 backdrop-blur lg:px-7">
      <button
        onClick={onMenu}
        className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        aria-label="Open navigation"
      >
        <Icon name="menu" />
      </button>

      <div className="relative hidden w-full max-w-md items-center sm:flex">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
          <Icon name="search" size={16} />
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search leads, customers, tasks... (Press Enter)"
          className="w-full rounded-xl border border-slate-200/80 bg-slate-50/70 py-2 pl-10 pr-4 text-xs outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100"
          aria-label="Global search"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <NotificationBell />
        <Link
          href="/profile"
          className="hidden items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-teal-300 hover:text-teal-700 sm:flex"
        >
          <Icon name="user" size={14} />
          <span>Profile</span>
        </Link>

        <div ref={profileMenuRef} className="relative ml-1">
          <button
            onClick={() => setProfileOpen((value) => !value)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 hover:bg-slate-50"
            aria-expanded={profileOpen}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-8 w-8 rounded-lg object-cover ring-1 ring-slate-200"
              />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--navy)] text-xs font-bold text-white">
                {initials}
              </span>
            )}
            <div className="hidden text-left sm:block">
              <p className="max-w-28 truncate text-xs font-bold text-slate-800 leading-tight">
                {displayName}
              </p>
              <p className="text-[10px] font-semibold text-slate-400 leading-tight">
                {employeeCode ? `${employeeCode}` : role ? role.replaceAll("_", " ") : "Account"}
              </p>
            </div>
            <Icon name="chevron-down" size={14} />
          </button>

          {profileOpen ? (
            <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-10 w-10 rounded-xl object-cover ring-1 ring-slate-200"
                  />
                ) : (
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-xs font-bold text-teal-800">
                    {initials}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-900">{displayName}</p>
                  <p className="truncate text-[11px] text-slate-500">{email || "Account"}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    {employeeCode && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-700">
                        {employeeCode}
                      </span>
                    )}
                    {role && (
                      <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[9px] font-bold text-teal-700">
                        {role.replaceAll("_", " ")}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1 py-2">
                <Link
                  href="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-teal-700"
                >
                  <Icon name="user" size={15} />
                  <span>My Profile & Photo</span>
                </Link>
                <Link
                  href="/employees"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-teal-700"
                >
                  <Icon name="users" size={15} />
                  <span>Employee Directory</span>
                </Link>
              </div>

              <div className="border-t border-slate-100 pt-2">
                <SignOutButton />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

