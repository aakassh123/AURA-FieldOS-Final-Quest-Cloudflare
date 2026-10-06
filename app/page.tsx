import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getCurrentUserEmail } from "@/lib/auth/get-current-user-email";
import { getDashboardData } from "@/lib/dashboard/queries";

export default async function Home() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.company_id) redirect("/setup");

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
