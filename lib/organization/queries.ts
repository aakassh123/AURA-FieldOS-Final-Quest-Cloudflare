import { createClient } from "@/lib/supabase/server";
import type { Employee, Team } from "@/lib/organization/types";

export async function getOrganizationData() {
  const supabase = await createClient();

  const [companyResult, employeesResult, teamsResult] = await Promise.all([
    supabase.from("companies").select("id, name, slug").maybeSingle(),
    supabase
      .from("employees")
      .select("id, company_id, user_id, employee_code, full_name, email, phone, designation, role, manager_id, status, joined_at, manager:manager_id(full_name)")
      .order("created_at", { ascending: true }),
    supabase
      .from("teams")
      .select("id, company_id, name, description, manager_employee_id, is_active, team_members(employee_id)")
      .order("name", { ascending: true }),
  ]);

  if (companyResult.error) console.warn('Company query notice:', companyResult.error.message);
  if (employeesResult.error) console.warn('Employees query notice:', employeesResult.error.message);
  if (teamsResult.error) console.warn('Teams query notice:', teamsResult.error.message);

  return {
    company: companyResult.data,
    employees: (employeesResult.data ?? []) as unknown as Employee[],
    teams: (teamsResult.data ?? []) as Team[],
  };
}
