"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[var(--page)] flex items-center justify-center p-5 sm:p-8">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--navy)] font-black text-white">A</div>
        <h1 className="mt-7 text-2xl font-bold tracking-tight text-slate-950">Choose a new password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Use at least 8 characters and keep it unique to this account.</p>
        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <label className="block"><span className="text-sm font-semibold text-slate-700">New password</span><input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-50" /></label>
          <label className="block"><span className="text-sm font-semibold text-slate-700">Confirm password</span><input required minLength={8} type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-50" /></label>
          {error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">{error}</p> : null}
          <button disabled={loading} className="w-full rounded-xl bg-[var(--navy)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{loading ? "Updating…" : "Update password"}</button>
        </form>
      </div>
    </main>
  );
}
