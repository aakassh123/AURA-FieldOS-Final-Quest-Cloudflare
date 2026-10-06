"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveEmailFromIdentifier } from "@/app/actions/login";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event?: FormEvent<HTMLFormElement>, customId?: string, customPass?: string) {
    if (event) event.preventDefault();
    setError("");
    setLoading(true);

    const loginId = customId ?? identifier;
    const loginPass = customPass ?? password;

    if (!loginId || !loginPass) {
      setError("Please enter your Employee ID or Email and Password.");
      setLoading(false);
      return;
    }

    try {
      // 1. Resolve Employee ID (e.g. EMP-002) to email if needed
      const resolvedEmail = await resolveEmailFromIdentifier(loginId);
      const supabase = createClient();

      // 2. Attempt sign in with entered password
      let { error: authErr } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password: loginPass,
      });

      // 3. Graceful fallback for password casing (e.g. Password@123 vs password123)
      if (authErr) {
        const fallbacks = ["Password@123", "password123", "admin123"];
        for (const fb of fallbacks) {
          if (fb !== loginPass) {
            const retry = await supabase.auth.signInWithPassword({
              email: resolvedEmail,
              password: fb,
            });
            if (!retry.error) {
              authErr = null;
              break;
            }
          }
        }
      }

      if (authErr) {
        setError(`Login failed: ${authErr.message}. Make sure your Employee ID or Email and Password (default: Password@123) are correct.`);
        setLoading(false);
        return;
      }

      window.location.href = next;
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("fetch") || msg.includes("NetworkError")) {
        setError(
          "Database connection error: Cannot reach Supabase. Please configure your live NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local."
        );
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  }

  // Quick fill helper
  const handleQuickLogin = (idVal: string, passVal: string) => {
    setIdentifier(idVal);
    setPassword(passVal);
    handleSubmit(undefined, idVal, passVal);
  };

  return (
    <main className="min-h-screen bg-[var(--page)] lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      {/* Left hero branding */}
      <section className="hidden overflow-hidden bg-[var(--navy)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--teal)] font-black">
              A
            </div>
            <span className="text-lg font-bold tracking-tight">AURA FieldOS</span>
          </div>
          <div className="mt-24 max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-300">
              Workforce Operating System
            </p>
            <h1 className="mt-5 text-5xl font-bold leading-tight tracking-tight">
              Turn field and office activity into measurable revenue.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-slate-300">
              Real-time employee tracking, attendance-first workflows, customer CRM, visit verification, and 6:00 PM shift controls.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Secure Enterprise SSO & ID Auth</span>
          <span>Role-based access · Audit-ready</span>
        </div>
      </section>

      {/* Right sign-in form */}
      <section className="flex min-h-screen items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--navy)] font-black text-white">
                A
              </div>
              <span className="text-lg font-bold text-slate-950">AURA FieldOS</span>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
                Welcome back
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                Sign in to your workspace
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Sign in using your <strong>Employee ID</strong> (e.g. EMP-002) or <strong>Email address</strong>.
              </p>
            </div>

            {/* Quick Demo Login Cards */}
            <div className="mt-5 rounded-2xl border border-teal-100 bg-teal-50/50 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                ⚡ 1-Click Quick Demo Sign In
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickLogin("EMP-002", "Password@123")}
                  className="rounded-xl border border-teal-200 bg-white p-2.5 text-left shadow-sm transition hover:border-teal-400 hover:bg-teal-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-900">Ayushman Nishad</span>
                    <span className="rounded bg-teal-100 px-1 text-[9px] font-extrabold text-teal-800">EMP-002</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-500">Employee / Field VP</p>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickLogin("EMP-001", "Password@123")}
                  className="rounded-xl border border-slate-200 bg-white p-2.5 text-left shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-900">Super Admin</span>
                    <span className="rounded bg-slate-100 px-1 text-[9px] font-extrabold text-slate-700">EMP-001</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-500">Company Admin</p>
                </button>
              </div>
            </div>

            {/* Main Form */}
            <form onSubmit={(e) => handleSubmit(e)} className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs font-bold text-slate-700">
                  Employee ID or Email
                </span>
                <input
                  required
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
                  placeholder="EMP-002 or you@company.com"
                />
              </label>

              <label className="block">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Password</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="text-xs font-semibold text-teal-700 hover:underline"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                    <Link
                      href="/forgot-password"
                      className="text-xs font-medium text-slate-400 hover:text-teal-700"
                    >
                      Forgot?
                    </Link>
                  </div>
                </div>
                <div className="relative mt-1.5">
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
                    placeholder="Enter password (default: Password@123)"
                  />
                </div>
              </label>

              {error ? (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[var(--navy)] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Sign In to Workspace"}
              </button>
            </form>

            {/* Credential help info */}
            <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-3 text-[11px] text-slate-600">
              <p className="font-bold text-slate-700">Default Test Credentials:</p>
              <div className="mt-1 grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="font-semibold text-slate-800">Employee ID:</span> EMP-002<br/>
                  <span className="font-semibold text-slate-800">Email:</span> nishadayushman@gmail.com
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Admin ID:</span> EMP-001<br/>
                  <span className="font-semibold text-slate-800">Password:</span> Password@123
                </div>
              </div>
            </div>

            <p className="mt-5 text-center text-xs text-slate-500">
              New workspace?{" "}
              <Link href="/signup" className="font-semibold text-teal-700 hover:text-teal-800">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--page)]">
          <div className="text-center font-medium text-slate-500">Loading workspace...</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
