"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveEmailFromIdentifier } from "@/app/actions/login";
import { Icon } from "@/components/icon";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const urlId = searchParams.get("id") || "";
  const registered = searchParams.get("registered") === "true";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState(
    registered ? "✓ Account registered successfully! Enter your password to sign in." : ""
  );
  const [loading, setLoading] = useState(false);

  // Check existing session or load remembered ID on mount
  useEffect(() => {
    if (urlId) {
      setIdentifier(urlId.trim());
    } else {
      const savedId = localStorage.getItem("aura_fieldos_last_id");
      if (savedId) {
        setIdentifier(savedId.trim());
      }
    }

    // Auto-redirect if already signed in
    const checkActiveSession = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          router.replace(next);
        }
      } catch {
        // Silently continue
      }
    };
    checkActiveSession();
  }, [urlId, next, router]);

  async function handleSubmit(event?: FormEvent<HTMLFormElement>, overrideId?: string, overridePass?: string) {
    if (event) event.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    const loginId = (overrideId ?? identifier).trim();
    const loginPass = overridePass ?? password;

    if (!loginId || !loginPass) {
      setError("Please enter your Employee ID (or Email) and Password.");
      setLoading(false);
      return;
    }

    try {
      // 1. Resolve Employee ID (e.g. EMP-001, EMP-004) to email
      const resolveRes = await resolveEmailFromIdentifier(loginId);
      if (!resolveRes.success) {
        setError(resolveRes.error || `Employee ID "${loginId}" was not found. Please verify your ID or create an account.`);
        setLoading(false);
        return;
      }

      const resolvedEmail = resolveRes.email;
      const supabase = createClient();

      // 2. Perform authentication with Supabase
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password: loginPass,
      });

      if (authErr) {
        if (!resolveRes.isEmail && resolveRes.fullName) {
          setError(`Incorrect password for ${resolveRes.employeeCode || loginId} (${resolveRes.fullName}). Please verify and try again.`);
        } else if (!resolveRes.isEmail) {
          setError(`Incorrect password for Employee ID "${loginId}". Please verify and try again.`);
        } else {
          setError("Incorrect password or email. Please check your credentials and try again.");
        }
        setLoading(false);
        return;
      }

      // 3. Save remembered identifier if enabled
      if (rememberMe) {
        localStorage.setItem("aura_fieldos_last_id", loginId);
      } else {
        localStorage.removeItem("aura_fieldos_last_id");
      }

      setSuccessMsg("✓ Authenticated! Entering workspace…");

      // Small delay to ensure cookie persistence across mobile webviews
      setTimeout(() => {
        window.location.href = next;
      }, 350);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("fetch") || msg.includes("NetworkError")) {
        setError("Network error: Cannot reach authentication service. Please check your internet connection.");
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  }

  // Quick fill helper for convenience
  const fillCredentials = (id: string) => {
    setIdentifier(id);
    setError("");
  };

  return (
    <main className="min-h-screen bg-[var(--page)] lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      {/* Left hero branding */}
      <section className="hidden overflow-hidden bg-[var(--navy)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--teal)] font-black text-[var(--navy)]">
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
              Real-time employee tracking, attendance-first workflows, camera selfie verification, customer CRM, visit logging, and 6:00 PM shift controls.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-xs font-bold text-teal-300">✓ Dual ID & Email Login</p>
                <p className="mt-1 text-[11px] text-slate-300">Log in with EMP-001 or Work Email</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-xs font-bold text-teal-300">✓ GPS Attendance & Selfies</p>
                <p className="mt-1 text-[11px] text-slate-300">Geo-verified punch in & out</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Enterprise SSO & ID Auth</span>
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
              <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-950">
                Sign in to your workspace
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Enter your assigned <strong>Employee ID</strong> (e.g. EMP-001, EMP-004) or <strong>Email address</strong>.
              </p>
            </div>

            {/* Success notification banner (e.g. from signup) */}
            {successMsg && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                <Icon name="check-circle-2" size={16} className="text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700"
              >
                {error}
              </div>
            )}

            {/* Main Form */}
            <form onSubmit={(e) => handleSubmit(e)} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Employee ID or Email Address
                </label>
                <div className="relative mt-1.5">
                  <input
                    required
                    type="text"
                    inputMode="text"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
                    placeholder="e.g. EMP-001 or you@company.com"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400">
                    <Icon name="user-round" size={16} />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Password</label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-slate-400 hover:text-teal-700 transition"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative mt-1.5">
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-11 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    <Icon name={showPassword ? "eye-off" : "eye"} size={16} />
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span>Remember my Employee ID</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[var(--navy)] py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <span>Sign In to Workspace →</span>
                )}
              </button>
            </form>

            {/* Quick Login Test Chips */}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Quick Test Identifiers:
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => fillCredentials("EMP-001")}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-900 transition"
                >
                  EMP-001 (Admin)
                </button>
                <button
                  type="button"
                  onClick={() => fillCredentials("EMP-004")}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-900 transition"
                >
                  EMP-004 (Aman)
                </button>
                <button
                  type="button"
                  onClick={() => fillCredentials("EMP-002")}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-900 transition"
                >
                  EMP-002 (Ayushman)
                </button>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-slate-500">
              New employee or need an account?{" "}
              <Link href="/signup" className="font-bold text-teal-700 hover:text-teal-800">
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
          <div className="text-center font-medium text-slate-500">Loading workspace…</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
