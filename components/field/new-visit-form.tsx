'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createVisit } from '@/app/actions/field';

export function NewVisitForm({
  customers,
  defaultCustomerId,
}: {
  customers: Array<{ id: string; name: string; city?: string | null; latitude?: number | null; longitude?: number | null }>;
  defaultCustomerId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError('');

    try {
      const fd = new FormData(e.currentTarget);
      const res = await createVisit(fd);
      if (res.error) {
        setError(res.error);
        setPending(false);
      } else {
        router.push('/visits');
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to schedule customer visit.');
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
          Target Customer Account <span className="text-red-500">*</span>
        </label>
        <select
          required
          name="customer_id"
          defaultValue={defaultCustomerId || ''}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
        >
          <option value="">Select customer account…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.city ? ` · ${c.city}` : ''}
              {c.latitude && c.longitude ? ' · 📍 GPS Pinned' : ' · ⚠️ No GPS'}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-slate-400">
          Accounts with GPS pins allow automatic geofence verification on-site.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
          Scheduled Date & Time
        </label>
        <input
          name="scheduled_at"
          type="datetime-local"
          defaultValue={new Date(Date.now() + 3600000).toISOString().slice(0, 16)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
          Visit Objective / Notes
        </label>
        <textarea
          name="notes"
          rows={4}
          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
          placeholder="Demonstration, contract negotiation, quarterly review, follow-up meeting agenda…"
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[var(--navy)] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? 'Scheduling…' : 'Schedule Visit'}
        </button>
      </div>
    </form>
  );
}
