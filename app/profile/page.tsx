import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getCurrentUserEmail } from "@/lib/auth/get-current-user-email";
import { createClient } from "@/lib/supabase/server";
import { CrmShell } from "@/components/crm/crm-shell";
import { ProfileEditor } from "@/components/profile/profile-editor";

export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.company_id) redirect("/setup");

  const email = await getCurrentUserEmail();
  const supabase = await createClient();

  // Fetch company details
  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", profile.company_id)
    .maybeSingle();

  // Fetch employee record
  const { data: employee } = await supabase
    .from("employees")
    .select("id, employee_code, full_name, phone, designation, joined_at")
    .eq("user_id", profile.id)
    .maybeSingle();

  // Fetch gamification stats if employee exists
  let gamification = null;
  if (employee?.id) {
    const { data: gameData } = await supabase
      .from("employee_gamification")
      .select("level, xp_total, current_streak, best_streak, visits_completed, tasks_completed")
      .eq("employee_id", employee.id)
      .maybeSingle();

    if (gameData) {
      gamification = {
        level: gameData.level || 1,
        xp: gameData.xp_total || 0,
        currentStreak: gameData.current_streak || 0,
        bestStreak: gameData.best_streak || 0,
        visitsCompleted: gameData.visits_completed || 0,
        tasksCompleted: gameData.tasks_completed || 0,
      };
    }
  }

  const initialUser = {
    id: profile.id,
    email: email,
    fullName: employee?.full_name || profile.full_name || email.split("@")[0],
    role: profile.role,
    avatarUrl: profile.avatar_url,
    employeeCode: employee?.employee_code || profile.employee_code || "EMP-001",
    designation: employee?.designation || profile.designation || "Staff",
    phone: employee?.phone || profile.phone || "",
    joinedAt: employee?.joined_at || "",
    companyName: company?.name || "AURA Technologies",
    gamification,
  };

  return (
    <CrmShell
      email={email}
      name={initialUser.fullName}
      role={profile.role}
      avatarUrl={profile.avatar_url}
      employeeCode={initialUser.employeeCode}
    >
      <main className="mx-auto max-w-[1000px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <ProfileEditor initialUser={initialUser} />
      </main>
    </CrmShell>
  );
}
