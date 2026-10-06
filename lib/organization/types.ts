import type { AppRole } from "@/lib/auth/types";

export type EmployeeStatus = "INVITED" | "ACTIVE" | "INACTIVE";

export type Employee = {
  id: string;
  company_id: string;
  user_id: string | null;
  employee_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  role: AppRole;
  manager_id: string | null;
  status: EmployeeStatus;
  joined_at: string | null;
  manager?: { full_name: string } | null;
};

export type Team = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  manager_employee_id: string | null;
  is_active: boolean;
  team_members?: { employee_id: string }[];
};
