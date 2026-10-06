"use client";

export default function GlobalError() {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
          <p className="text-sm font-semibold text-teal-600">AURA FieldOS</p>
          <h1 className="mt-2 text-2xl font-semibold">A critical error occurred</h1>
          <p className="mt-2 text-sm text-slate-500">Please refresh the application. If the problem continues, contact your administrator.</p>
        </main>
      </body>
    </html>
  );
}
