import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getCurrentUserEmail } from "@/lib/auth/get-current-user-email";
import { getDashboardData } from "@/lib/dashboard/queries";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  if (!profile.company_id) {
    const supabase = await createClient();
    const { data: companies } = await supabase.from("companies").select("id").limit(1);
    if (companies && companies.length > 0) {
      await supabase.from("profiles").update({ company_id: companies[0].id }).eq("id", profile.id);
      profile.company_id = companies[0].id;
    } else {
      redirect("/setup");
    }
  }

  const email = await getCurrentUserEmail();
  const dashboard = await getDashboardData();
  return (
    <AppShell
      email={email}
      name={profile.full_name ?? email.split("@")[0] ?? "User"}
      role={profile.role}
      avatarUrl={profile.avatar_url}
      employeeCode={profile.employee_code}
      dashboard={dashboard}
    />
  );
}
