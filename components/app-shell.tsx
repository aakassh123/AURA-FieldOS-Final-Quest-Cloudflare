"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { Dashboard } from "@/components/dashboard";
import type { AppRole } from "@/lib/auth/types";
import type { DashboardData } from "@/lib/dashboard/queries";

export function AppShell({
  email,
  name,
  role,
  avatarUrl,
  employeeCode,
  dashboard,
}: {
  email: string;
  name: string;
  role: AppRole;
  avatarUrl?: string | null;
  employeeCode?: string | null;
  dashboard: DashboardData;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[var(--page)] lg:flex">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role={role}
        name={name}
        avatarUrl={avatarUrl}
        employeeCode={employeeCode}
      />
      <div className="min-w-0 flex-1">
        <Topbar
          onMenu={() => setSidebarOpen(true)}
          email={email}
          name={name}
          role={role}
          avatarUrl={avatarUrl}
          employeeCode={employeeCode}
        />
        <Dashboard data={dashboard} role={role} name={name} />
      </div>
    </div>
  );
}
