"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navGroups } from "@/lib/data";
import { Icon } from "@/components/icon";
import type { AppRole } from "@/lib/auth/types";

export function Sidebar({
  open,
  onClose,
  role,
  name,
  avatarUrl,
  employeeCode,
}: {
  open: boolean;
  onClose: () => void;
  role: AppRole;
  name: string;
  avatarUrl?: string | null;
  employeeCode?: string | null;
}) {
  const pathname = usePathname();
  const canSeeOrganization = ["SUPER_ADMIN", "COMPANY_ADMIN", "SALES_MANAGER", "HR_ACCOUNTS"].includes(role);
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "AS";

  return (
    <>
      {open && <button className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden" aria-label="Close navigation" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col bg-[var(--navy)] text-white transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--teal)] font-black text-[var(--navy)]">A</div>
            <div>
              <p className="text-[15px] font-bold tracking-tight">AURA FieldOS</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Sales Operations</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Close navigation"><Icon name="x" size={18} /></button>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {navGroups.filter((group) => (group.label !== "Organization" || canSeeOrganization) && (!group.allowedRoles || group.allowedRoles.includes(role))).map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = item.href === "/" ? pathname === "/" : item.href !== "#" && pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-white/10 text-white font-semibold" : "text-slate-400 hover:bg-white/[0.06] hover:text-white"}`}
                    >
                      <Icon name={item.icon} size={17} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Account</p>
            <div className="space-y-1">
              <Link
                href="/profile"
                onClick={onClose}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${pathname === "/profile" ? "bg-white/10 text-white font-semibold" : "text-slate-400 hover:bg-white/[0.06] hover:text-white"}`}
              >
                <Icon name="user" size={17} />
                <span>My Profile</span>
              </Link>
            </div>
          </div>
        </nav>

        <div className="border-t border-white/10 p-3">
          <Link
            href="/profile"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl bg-white/[0.05] p-3 transition hover:bg-white/[0.10]"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="h-9 w-9 rounded-full object-cover ring-1 ring-teal-400/30" />
            ) : (
              <div className="grid h-9 w-9 place-items-center rounded-full bg-teal-100 text-xs font-bold text-teal-800">{initials}</div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-[11px] text-slate-400">
                {employeeCode ? `${employeeCode} · ` : ""}{role.replaceAll("_", " ")}
              </p>
            </div>
            <Icon name="chevron-right" size={14} className="text-slate-500" />
          </Link>
        </div>
      </aside>
    </>
  );
}

