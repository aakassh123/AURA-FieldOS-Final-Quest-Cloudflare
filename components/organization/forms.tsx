"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { bootstrapCompany, createEmployee, createTeam, deleteEmployee, deleteTeam, addTeamMember, removeTeamMember, updateEmployee, updateTeam } from "@/app/actions/organization";
import type { Employee, Team } from "@/lib/organization/types";
import type { AppRole } from "@/lib/auth/types";

const roles: { value: AppRole; label: string }[] = [
  { value: "COMPANY_ADMIN", label: "Company Admin" },
  { value: "SALES_MANAGER", label: "Sales Manager" },
  { value: "SALESMAN", label: "Salesman" },
  { value: "HR_ACCOUNTS", label: "HR / Accounts" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
];

function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[var(--navy-2)] disabled:cursor-not-allowed disabled:opacity-60">{pending ? "Saving…" : children}</button>;
}

function Result({ result }: { result: { error?: string; success?: boolean } | null }) {
  if (!result) return null;
  return <p className={`mt-3 text-xs font-medium ${result.error ? "text-red-600" : "text-emerald-600"}`}>{result.error ?? "Saved successfully."}</p>;
}

export function CompanySetupForm() {
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  async function action(formData: FormData) {
    const response = await bootstrapCompany(formData);
    setResult(response);
    if (response.success) {
      formRef.current?.reset();
      window.location.href = "/";
    }
  }
  return <form ref={formRef} action={action} className="space-y-4">
    <Field label="Company name"><input name="name" required placeholder="AURA Sales Pvt. Ltd." className="input" /></Field>
    <Field label="Workspace slug"><input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="aura-sales" className="input" /></Field>
    <p className="text-[11px] leading-5 text-slate-500">This becomes your company workspace identifier. You will become the first Company Admin.</p>
    <SubmitButton>Create company</SubmitButton>
    <Result result={result} />
  </form>;
}

export function EmployeeForm({
  employees,
  initial,
  redirectTo,
}: {
  employees: Employee[];
  initial?: Employee;
  redirectTo?: string;
}) {
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const action = async (formData: FormData) => {
    const response = initial ? await updateEmployee(formData) : await createEmployee(formData);
    setResult(response);
    if (response.success) {
      if (!initial) formRef.current?.reset();
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    }
  };

  return <form ref={formRef} action={action} className="grid gap-3 md:grid-cols-2">
    {initial && <input type="hidden" name="id" value={initial.id} />}
    <Field label="Full name"><input name="full_name" required defaultValue={initial?.full_name} className="input" placeholder="Rohit Kumar" /></Field>
    <Field label="Employee code"><input name="employee_code" required={!initial} readOnly={Boolean(initial)} defaultValue={initial?.employee_code} className={`input ${initial ? "bg-slate-50" : ""}`} placeholder="EMP-002" /></Field>
    <Field label="Email"><input name="email" type="email" defaultValue={initial?.email ?? ""} className="input" placeholder="rohit@company.com" /></Field>
    <Field label="Phone"><input name="phone" defaultValue={initial?.phone ?? ""} className="input" placeholder="+91 98xxxxxx" /></Field>
    <Field label="Designation"><input name="designation" defaultValue={initial?.designation ?? ""} className="input" placeholder="Sales Executive" /></Field>
    <Field label="Role"><select name="role" defaultValue={initial?.role ?? "SALESMAN"} className="input">{roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></Field>
    <Field label="Manager"><select name="manager_id" defaultValue={initial?.manager_id ?? ""} className="input"><option value="">No manager</option>{employees.filter((employee) => employee.id !== initial?.id).map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} · {employee.role.replaceAll("_", " ")}</option>)}</select></Field>
    <Field label="Status"><select name="status" defaultValue={initial?.status ?? "INVITED"} className="input"><option value="INVITED">Invited</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></Field>
    <Field label="Joined date"><input name="joined_at" type="date" defaultValue={initial?.joined_at ?? ""} className="input" /></Field>
    <div className="md:col-span-2 flex items-center gap-3 pt-2"><SubmitButton>{initial ? "Save changes" : "Add employee"}</SubmitButton><Result result={result} /></div>
  </form>;
}

export function EmployeeDeleteForm({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!confirm("Are you sure you want to delete this employee?")) return;
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await deleteEmployee(fd);
    setLoading(false);
    if (res?.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="id" value={id} />
      <button disabled={loading} className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50">
        {loading ? "…" : "Delete"}
      </button>
    </form>
  );
}

export function TeamForm({
  employees,
  initial,
  redirectTo,
}: {
  employees: Employee[];
  initial?: Team;
  redirectTo?: string;
}) {
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const response = initial ? await updateTeam(fd) : await createTeam(fd);
    setResult(response);
    setLoading(false);
    if (response.success) {
      if (!initial) (e.target as HTMLFormElement).reset();
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <Field label="Team name"><input name="name" required defaultValue={initial?.name} className="input" placeholder="North Zone Sales" /></Field>
      <Field label="Description"><textarea name="description" defaultValue={initial?.description ?? ""} rows={3} className="input resize-none" placeholder="Team focus, region or segment" /></Field>
      <Field label="Team manager"><select name="manager_employee_id" defaultValue={initial?.manager_employee_id ?? ""} className="input"><option value="">No manager</option>{employees.filter((e) => e.status !== "INACTIVE").map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}</select></Field>
      {initial && <Field label="Status"><select name="is_active" defaultValue={initial.is_active ? "true" : "false"} className="input"><option value="true">Active</option><option value="false">Inactive</option></select></Field>}
      <div className="flex items-center gap-3 pt-1">
        <button disabled={loading} className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[var(--navy-2)] disabled:opacity-50">
          {loading ? "Saving…" : initial ? "Save team" : "Create team"}
        </button>
        <Result result={result} />
      </div>
    </form>
  );
}

export function TeamDeleteForm({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!confirm("Are you sure you want to delete this team?")) return;
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await deleteTeam(fd);
    setLoading(false);
    if (res?.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="id" value={id} />
      <button disabled={loading} className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50">
        {loading ? "…" : "Delete"}
      </button>
    </form>
  );
}

export function TeamMemberForm({ teamId, employees }: { teamId: string; employees: Employee[] }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await addTeamMember(fd);
    setLoading(false);
    if (res?.error) {
      alert(res.error);
    } else {
      (e.target as HTMLFormElement).reset();
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input type="hidden" name="team_id" value={teamId} />
      <select name="employee_id" required className="input min-w-0 flex-1">
        <option value="">Add member…</option>
        {employees.filter((e) => e.status !== "INACTIVE").map((employee) => (
          <option key={employee.id} value={employee.id}>{employee.full_name}</option>
        ))}
      </select>
      <button disabled={loading} className="rounded-xl bg-[var(--navy)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
        {loading ? "…" : "Add"}
      </button>
    </form>
  );
}

export function TeamMemberRemoveForm({ teamId, employeeId }: { teamId: string; employeeId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await removeTeamMember(fd);
    setLoading(false);
    if (res?.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="team_id" value={teamId} />
      <input type="hidden" name="employee_id" value={employeeId} />
      <button disabled={loading} aria-label="Remove team member" className="text-slate-400 hover:text-red-600 disabled:opacity-50">
        ×
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>{children}</label>;
}
