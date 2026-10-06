'use client';
import { useState, type ReactNode, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { addLeadActivity, createCustomer, createLead, createTask, updateLeadStage } from '@/app/actions/organization';
import type { Employee } from '@/lib/organization/types';
import type { PipelineStage, Customer } from '@/lib/crm/types';

function Submit({ children, pending }: { children: ReactNode; pending?: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
    >
      {pending ? 'Saving…' : children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Result({ r }: { r: { error?: string; success?: boolean } | null }) {
  return r ? (
    <p className={`text-xs font-medium ${r.error ? 'text-red-600' : 'text-emerald-600'}`}>
      {r.error ?? 'Saved successfully.'}
    </p>
  ) : null;
}

export function LeadForm({
  stages,
  employees,
  customers,
  redirectTo,
}: {
  stages: PipelineStage[];
  employees: Employee[];
  customers: Customer[];
  redirectTo?: string;
}) {
  const router = useRouter();
  const [r, setR] = useState<any>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setR(null);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await createLead(fd);
      setR(res);
      if (res?.success) {
        (e.target as HTMLFormElement).reset();
        if (redirectTo) {
          router.push(redirectTo);
          router.refresh();
        }
      }
    } catch (err: any) {
      setR({ error: err.message || 'Failed to create lead' });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Field label="Lead / opportunity">
        <input required name="title" className="input" placeholder="Hotel Sunrise — HMS rollout" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Stage">
          <select name="stage_id" className="input">
            {stages.filter((s) => !s.is_closed).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select name="priority" className="input">
            <option>HIGH</option>
            <option>MEDIUM</option>
            <option>LOW</option>
          </select>
        </Field>
        <Field label="Owner">
          <select name="owner_employee_id" className="input">
            <option value="">Unassigned</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
        </Field>
        <Field label="Customer">
          <select name="customer_id" className="input">
            <option value="">New / not linked</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Estimated value">
          <input name="estimated_value" type="number" min="0" step="100" defaultValue="0" className="input" placeholder="250000" />
        </Field>
        <Field label="Expected close">
          <input name="expected_close_date" type="date" className="input" />
        </Field>
      </div>
      <Field label="Source">
        <input name="source" className="input" placeholder="Website, referral, walk-in, OTA…" />
      </Field>
      <Field label="Next follow-up">
        <input name="next_follow_up_at" type="datetime-local" className="input" />
      </Field>
      <Field label="Notes">
        <textarea name="notes" rows={3} className="input resize-none" placeholder="What matters about this opportunity?" />
      </Field>
      <div className="flex items-center gap-3">
        <Submit pending={pending}>Create lead</Submit>
        <Result r={r} />
      </div>
    </form>
  );
}

export function CustomerForm({
  employees,
  redirectTo,
}: {
  employees: Employee[];
  redirectTo?: string;
}) {
  const router = useRouter();
  const [r, setR] = useState<any>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setR(null);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await createCustomer(fd);
      setR(res);
      if (res?.success) {
        (e.target as HTMLFormElement).reset();
        if (redirectTo) {
          router.push(redirectTo);
          router.refresh();
        }
      }
    } catch (err: any) {
      setR({ error: err.message || 'Failed to add customer' });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Field label="Business name">
        <input required name="name" className="input" placeholder="Hotel Sunrise" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Phone">
          <input name="phone" className="input" placeholder="+91…" />
        </Field>
        <Field label="Email">
          <input name="email" type="email" className="input" placeholder="owner@hotel.com" />
        </Field>
        <Field label="City">
          <input name="city" className="input" placeholder="Lucknow" />
        </Field>
        <Field label="Industry">
          <input name="industry" className="input" placeholder="Hotel / Restaurant" />
        </Field>
      </div>
      <Field label="Owner">
        <select name="owner_employee_id" className="input">
          <option value="">Auto-assign to me</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.full_name}</option>
          ))}
        </select>
      </Field>
      <Field label="Address">
        <textarea name="address" rows={2} className="input resize-none" />
      </Field>
      <div className="flex items-center gap-3">
        <Submit pending={pending}>Add customer</Submit>
        <Result r={r} />
      </div>
    </form>
  );
}

export function StageForm({ leadId, currentStageId, stages }: { leadId: string; currentStageId: string; stages: PipelineStage[] }) {
  const [r, setR] = useState<any>(null);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const form = e.currentTarget.form;
    if (!form) return;
    const fd = new FormData(form);
    try {
      const res = await updateLeadStage(fd);
      setR(res);
    } catch (err: any) {
      setR({ error: err.message });
    }
  }

  return (
    <form className="flex items-center gap-2">
      <input type="hidden" name="id" value={leadId} />
      <select name="stage_id" defaultValue={currentStageId} className="input min-w-[150px]" onChange={handleChange}>
        {stages.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <Result r={r} />
    </form>
  );
}

export function ActivityForm({ leadId }: { leadId: string }) {
  const [r, setR] = useState<any>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setR(null);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await addLeadActivity(fd);
      setR(res);
      if (res?.success) (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      setR({ error: err.message });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <div className="flex gap-2">
        <select name="type" className="input w-36">
          <option>NOTE</option>
          <option>CALL</option>
          <option>EMAIL</option>
          <option>MEETING</option>
          <option>WHATSAPP</option>
        </select>
        <textarea required name="body" rows={3} className="input flex-1 resize-none" placeholder="Add a useful note: what happened, what was agreed, what happens next…" />
      </div>
      <div className="flex items-center gap-3">
        <Submit pending={pending}>Add activity</Submit>
        <Result r={r} />
      </div>
    </form>
  );
}

export function TaskForm({ leadId, employees }: { leadId: string; employees: Employee[] }) {
  const [r, setR] = useState<any>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setR(null);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await createTask(fd);
      setR(res);
      if (res?.success) (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      setR({ error: err.message });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="lead_id" value={leadId} />
      <Field label="Task">
        <input required name="title" className="input" placeholder="Call decision maker" />
      </Field>
      <Field label="Assign to">
        <select name="assigned_employee_id" className="input">
          <option value="">Me</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.full_name}</option>
          ))}
        </select>
      </Field>
      <Field label="Task type">
        <select name="task_type" className="input">
          <option value="GENERAL">General</option>
          <option value="CALL">Call</option>
          <option value="FOLLOW_UP">Follow-up</option>
          <option value="MEETING">Meeting</option>
          <option value="DEMO">Demo</option>
          <option value="PROPOSAL">Proposal</option>
          <option value="VISIT">Visit</option>
          <option value="OTHER">Other</option>
        </select>
      </Field>
      <Field label="Due">
        <input name="due_at" type="datetime-local" className="input" />
      </Field>
      <Field label="Priority">
        <select name="priority" className="input">
          <option>HIGH</option>
          <option>MEDIUM</option>
          <option>LOW</option>
        </select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Description">
          <input name="description" className="input" placeholder="Context for the assignee" />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Submit pending={pending}>Create task</Submit>
        <Result r={r} />
      </div>
    </form>
  );
}
