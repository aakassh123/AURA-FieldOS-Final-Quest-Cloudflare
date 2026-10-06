import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-20 text-slate-900">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-teal-600">404</p>
        <h1 className="mt-3 text-2xl font-semibold">Page not found</h1>
        <Link href="/" className="mt-6 inline-flex rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white">Back to dashboard</Link>
      </div>
    </main>
  );
}
