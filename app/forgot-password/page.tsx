"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) setError(error.message);
    else setMessage("If an account exists for that email, a password reset link has been sent.");

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[var(--page)] flex items-center justify-center p-5 sm:p-8">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--navy)] font-black text-white">A</div>
        <p className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Account recovery</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Reset your password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Enter your account email and we’ll send a secure reset link.</p>
        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <label className="block"><span className="text-sm font-semibold text-slate-700">Email</span><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-50" placeholder="you@company.com" /></label>
          {error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">{error}</p> : null}
          {message ? <p role="status" className="rounded-xl bg-teal-50 px-3 py-2.5 text-xs font-medium text-teal-800">{message}</p> : null}
          <button disabled={loading} className="w-full rounded-xl bg-[var(--navy)] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{loading ? "Sending…" : "Send reset link"}</button>
        </form>
        <Link href="/login" className="mt-6 block text-center text-sm font-semibold text-teal-700">Back to sign in</Link>
      </div>
    </main>
  );
}
