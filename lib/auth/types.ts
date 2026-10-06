export const APP_ROLES = [
  "SUPER_ADMIN",
  "COMPANY_ADMIN",
  "SALES_MANAGER",
  "SALESMAN",
  "HR_ACCOUNTS",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type Profile = {
  id: string;
  company_id: string | null;
  full_name: string | null;
  role: AppRole;
  avatar_url?: string | null;
  employee_code?: string | null;
  designation?: string | null;
  phone?: string | null;
};
