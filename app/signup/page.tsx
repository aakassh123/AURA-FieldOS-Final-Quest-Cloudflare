"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerUser } from "@/app/actions/signup";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("SALESMAN");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ code: string; email: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify both entries.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.set("full_name", fullName);
      formData.set("email", email);
      formData.set("password", password);
      formData.set("role", role);

      const res = await registerUser(formData);

      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      // Auto sign-in with newly registered credentials in background
      const supabase = createClient();
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // Display assigned Employee Code so the user clearly sees their new ID!
      setSuccessInfo({
        code: res.employeeCode || "EMP-NEW",
        email,
      });
    } catch (err: any) {
      setError(err?.message || "Failed to complete account registration.");
    } finally {
      setLoading(false);
    }
  }

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
          <div className="mt-20 max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-300">
              Instant Workspace Access
            </p>
            <h1 className="mt-5 text-5xl font-bold leading-tight tracking-tight">
              Start logging field trips, visits & sales opportunities.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-slate-300">
              Create your account in seconds. You will receive an official Employee Code to log in across web, mobile, and offline shift punch-in points.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-xs font-bold text-teal-300">✓ Real-Time Shift Punch</p>
                <p className="mt-1 text-[11px] text-slate-300">Office & field geo-verified attendance</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-xs font-bold text-teal-300">✓ Customer CRM</p>
                <p className="mt-1 text-[11px] text-slate-300">Geo-pinned accounts and visit routes</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Enterprise Role Assignment</span>
          <span>Zero Configuration · Ready to Work</span>
        </div>
      </section>

      {/* Right registration form */}
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
            {successInfo ? (
              <div className="text-center py-4">
                <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-3xl">
                  🎉
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                  Account Created!
                </h2>
                <p className="mt-2 text-xs text-slate-500">
                  Your official Employee Code has been generated:
                </p>
                <div className="my-5 rounded-2xl border border-teal-200 bg-teal-50/70 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                    Your Login Identifier
                  </p>
                  <p className="mt-1 text-2xl font-black text-teal-900 tracking-wider">
                    {successInfo.code}
                  </p>
                  <p className="mt-1 text-[11px] text-teal-700">
                    Linked to: {successInfo.email}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <a
                    href="/"
                    className="block w-full rounded-xl bg-teal-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700"
                  >
                    Enter Workspace (Punch In) →
                  </a>
                  <Link
                    href="/login"
                    className="block w-full rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Sign In with ID
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
                    Join Workspace
                  </p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                    Create your account
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Fill in your details below to activate your user profile and workspace credentials.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">Full Name</span>
                    <input
                      required
                      type="text"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
                      placeholder="e.g. Rahul Sharma"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">Email Address</span>
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
                      placeholder="rahul@company.com"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">Operational Role</span>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
                    >
                      <option value="SALESMAN">Field Officer / Sales Representative</option>
                      <option value="SALES_MANAGER">Sales Manager</option>
                      <option value="HR_ACCOUNTS">HR & Accounts</option>
                      <option value="COMPANY_ADMIN">Company Administrator</option>
                    </select>
                  </label>

                  <label className="block">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Password</span>
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="text-xs font-semibold text-teal-700 hover:underline"
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                    <input
                      required
                      minLength={8}
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
                      placeholder="At least 8 characters"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">Confirm Password</span>
                    <input
                      required
                      minLength={8}
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
                      placeholder="Re-enter your password"
                    />
                  </label>

                  {error ? (
                    <div
                      role="alert"
                      className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
                    >
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-[var(--navy)] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Creating Account…" : "Create Account & Get Employee ID"}
                  </button>
                </form>

                <p className="mt-5 text-center text-xs text-slate-500">
                  Already have an account?{" "}
                  <Link href="/login" className="font-semibold text-teal-700 hover:text-teal-800">
                    Sign in with ID or Email
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
