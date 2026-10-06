"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerUser } from "@/app/actions/signup";
import { Icon } from "@/components/icon";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("SALESMAN");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{
    code: string;
    email: string;
    name: string;
    role: string;
  } | null>(null);

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const copyCodeToClipboard = () => {
    if (!successInfo?.code) return;
    try {
      navigator.clipboard.writeText(successInfo.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
      formData.set("full_name", fullName.trim());
      formData.set("email", email.trim().toLowerCase());
      formData.set("password", password);
      formData.set("role", role);

      const res = await registerUser(formData);

      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      const assignedCode = res.employeeCode || "EMP-NEW";

      // Save assigned code for easy login
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("aura_fieldos_last_id", assignedCode);
        } catch {
          // Ignore storage quota
        }
      }

      // Auto sign-in in background so active session is established
      try {
        const supabase = createClient();
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
      } catch {
        // Continue even if auto sign-in has a minor delay
      }

      // Display assigned Employee Code so user has full clarity and can copy it!
      setSuccessInfo({
        code: assignedCode,
        email: email.trim().toLowerCase(),
        name: fullName.trim(),
        role:
          role === "COMPANY_ADMIN"
            ? "Company Administrator"
            : role === "SALES_MANAGER"
            ? "Sales Manager"
            : role === "HR_ACCOUNTS"
            ? "HR & Accounts"
            : "Field Representative",
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
              Enterprise Workforce Access
            </p>
            <h1 className="mt-5 text-5xl font-bold leading-tight tracking-tight">
              Start logging field trips, visits & sales opportunities.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-slate-300">
              Create your account in seconds. You will receive an official Employee Code to log in across web, mobile, and offline shift punch-in points.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-xs font-bold text-teal-300">✓ Unique Employee ID</p>
                <p className="mt-1 text-[11px] text-slate-300">One-touch login with ID (e.g. EMP-005) or Email</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <p className="text-xs font-bold text-teal-300">✓ Real-Time Shift Punch</p>
                <p className="mt-1 text-[11px] text-slate-300">Office & field geo-verified attendance</p>
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
              <div className="text-center py-2">
                <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-sm border border-emerald-200">
                  <Icon name="check-circle-2" size={32} />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                  Account Created!
                </h2>
                <p className="mt-1.5 text-xs text-slate-500">
                  Welcome to the company workspace, <strong>{successInfo.name}</strong>!
                </p>

                {/* Prominent Employee ID Card */}
                <div className="my-5 rounded-2xl border border-teal-200 bg-gradient-to-b from-teal-50/90 to-white p-5 text-left shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                      Your Official Employee ID
                    </span>
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                      {successInfo.role}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="font-mono text-3xl font-black text-teal-950 tracking-wider">
                      {successInfo.code}
                    </span>
                    <button
                      type="button"
                      onClick={copyCodeToClipboard}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-teal-300 bg-teal-100/70 px-3 py-1.5 text-xs font-bold text-teal-900 transition hover:bg-teal-200 active:scale-95"
                      title="Copy Employee ID"
                    >
                      <Icon name="copy" size={13} />
                      <span>{copied ? "✓ Copied!" : "Copy ID"}</span>
                    </button>
                  </div>

                  <div className="mt-3 border-t border-teal-100 pt-2 text-[11px] text-teal-800 space-y-0.5">
                    <p>• <strong>Login ID:</strong> {successInfo.code} or {successInfo.email}</p>
                    <p>• <strong>Company:</strong> AURA Technologies</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  <a
                    href="/attendance"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700"
                  >
                    <span>Enter Workspace (Shift Punch)</span>
                    <Icon name="arrow-right" size={16} />
                  </a>
                  <Link
                    href={`/login?id=${encodeURIComponent(successInfo.code)}&registered=true`}
                    className="block w-full rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Sign In with {successInfo.code}
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
                    Join Workspace
                  </p>
                  <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-950">
                    Create your account
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Fill in your details below to activate your user profile and receive your Employee ID.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Full Name
                    </label>
                    <input
                      required
                      type="text"
                      autoComplete="name"
                      autoCapitalize="words"
                      autoCorrect="off"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
                      placeholder="e.g. Rahul Sharma"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Email Address
                    </label>
                    <input
                      required
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
                      placeholder="rahul@company.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Operational Role
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
                    >
                      <option value="SALESMAN">Field Officer / Sales Representative</option>
                      <option value="SALES_MANAGER">Sales Manager</option>
                      <option value="HR_ACCOUNTS">HR & Accounts Executive</option>
                      <option value="COMPANY_ADMIN">Company Administrator</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">Password</label>
                      <span className="text-[11px] text-slate-400">Min 8 characters</span>
                    </div>
                    <div className="relative mt-1.5">
                      <input
                        required
                        minLength={8}
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        autoCapitalize="none"
                        autoCorrect="off"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-11 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
                        placeholder="At least 8 characters"
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

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">Confirm Password</label>
                      {passwordsMatch && (
                        <span className="text-[11px] font-semibold text-emerald-600">✓ Passwords match</span>
                      )}
                      {passwordsMismatch && (
                        <span className="text-[11px] font-semibold text-amber-600">Passwords do not match</span>
                      )}
                    </div>
                    <div className="relative mt-1.5">
                      <input
                        required
                        minLength={8}
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        autoCapitalize="none"
                        autoCorrect="off"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full rounded-xl border bg-white px-4 py-3 pr-11 text-sm text-slate-900 outline-none transition ${
                          passwordsMismatch
                            ? "border-amber-300 focus:border-amber-400 focus:ring-4 focus:ring-amber-50"
                            : "border-slate-200 focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
                        }`}
                        placeholder="Re-enter your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition"
                        title={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        <Icon name={showConfirmPassword ? "eye-off" : "eye"} size={16} />
                      </button>
                    </div>
                  </div>

                  {error ? (
                    <div
                      role="alert"
                      className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
                    >
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-[var(--navy)] py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Creating Account…</span>
                      </>
                    ) : (
                      <span>Create Account & Get Employee ID →</span>
                    )}
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
