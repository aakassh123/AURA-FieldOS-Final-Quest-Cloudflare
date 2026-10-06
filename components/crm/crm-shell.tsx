'use client';
import { useState, type ReactNode } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';
import type { AppRole } from '@/lib/auth/types';
export function CrmShell({
  email,
  name,
  role,
  avatarUrl,
  employeeCode,
  children,
}: {
  email: string;
  name: string;
  role: AppRole;
  avatarUrl?: string | null;
  employeeCode?: string | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[var(--page)] lg:flex">
      <Sidebar
        open={open}
        onClose={() => setOpen(false)}
        role={role}
        name={name}
        avatarUrl={avatarUrl}
        employeeCode={employeeCode}
      />
      <div className="min-w-0 flex-1">
        <Topbar
          onMenu={() => setOpen(true)}
          email={email}
          name={name}
          role={role}
          avatarUrl={avatarUrl}
          employeeCode={employeeCode}
        />
        {children}
      </div>
    </div>
  );
}
