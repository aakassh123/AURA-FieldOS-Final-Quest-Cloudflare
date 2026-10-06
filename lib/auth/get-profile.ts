import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/auth/types";

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [profRes, empRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, company_id, full_name, role")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("employees")
      .select("employee_code, designation, phone")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (profRes.data) {
    return {
      ...profRes.data,
      avatar_url: (user.user_metadata?.avatar_url as string) || null,
      employee_code: empRes.data?.employee_code || (user.user_metadata?.employee_code as string) || null,
      designation: empRes.data?.designation || null,
      phone: empRes.data?.phone || null,
    } as Profile;
  }

  // Fallback: If user is authenticated in auth, but profile row does not exist yet
  try {
    const { data: companies } = await supabase.from("companies").select("id").limit(1);
    const companyId = companies?.[0]?.id || null;
    const role = (user.user_metadata?.role as any) || "COMPANY_ADMIN";
    const fullName = (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "User";
    const employeeCode = (user.user_metadata?.employee_code as string) || empRes.data?.employee_code || "EMP-001";

    await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fullName,
      company_id: companyId,
      role,
      updated_at: new Date().toISOString(),
    });

    return {
      id: user.id,
      company_id: companyId,
      full_name: fullName,
      role,
      avatar_url: (user.user_metadata?.avatar_url as string) || null,
      employee_code: employeeCode,
      designation: empRes.data?.designation || null,
      phone: empRes.data?.phone || null,
    } as Profile;
  } catch (err) {
    console.warn("Failed to create fallback profile:", err);
    return {
      id: user.id,
      company_id: null,
      full_name: (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "User",
      role: (user.user_metadata?.role as any) || "COMPANY_ADMIN",
      avatar_url: null,
      employee_code: null,
      designation: null,
      phone: null,
    } as Profile;
  }
}
