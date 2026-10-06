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

  if (!profRes.data) return null;

  return {
    ...profRes.data,
    avatar_url: (user.user_metadata?.avatar_url as string) || null,
    employee_code: empRes.data?.employee_code || null,
    designation: empRes.data?.designation || null,
    phone: empRes.data?.phone || null,
  } as Profile;
}
