import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompanySetupForm } from "@/components/organization/forms";

export default async function SetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (profile?.company_id) redirect("/");

  return <main className="min-h-screen bg-[var(--page)] px-4 py-12 sm:px-6"><div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--teal)] font-black text-[var(--navy)]">A</div><div><p className="font-bold">AURA FieldOS</p><p className="text-xs text-slate-500">Company setup</p></div></div><div className="mt-10"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Stage 3 · Organization</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Create your company workspace</h1><p className="mt-2 text-sm leading-6 text-slate-500">Set up the tenant first. Your account becomes the first Company Admin and the workspace is isolated from every other company.</p></div><div className="mt-8"><CompanySetupForm /></div></div></main>;
}
