"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("AURA application error", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-20 text-slate-900">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-teal-600">AURA FieldOS</p>
        <h1 className="mt-3 text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-500">The action could not be completed. Try again, and if it keeps happening contact your administrator.</p>
        <button onClick={() => reset()} className="mt-6 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white">
          Try again
        </button>
      </div>
    </main>
  );
}
