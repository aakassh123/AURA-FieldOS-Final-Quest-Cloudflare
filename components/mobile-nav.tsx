"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icon";

const items = [
  { label: "Today", icon: "layout-dashboard", href: "/" },
  { label: "Attendance", icon: "calendar-check", href: "/attendance" },
  { label: "My Work", icon: "check-square", href: "/field" },
  { label: "Leads", icon: "users", href: "/leads" },
  { label: "Profile", icon: "user", href: "/profile" },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  // Hide bottom nav on login/signup/auth pages
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/setup")
  ) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/95 px-2 py-1.5 backdrop-blur-md lg:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition ${
                active ? "text-teal-700 font-bold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <div className={`grid h-7 w-7 place-items-center rounded-lg ${active ? "bg-teal-50" : ""}`}>
                <Icon name={item.icon} size={18} />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
