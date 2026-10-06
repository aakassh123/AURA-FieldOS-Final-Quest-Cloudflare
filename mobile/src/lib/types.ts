export type Profile = {
  id: string;
  company_id: string | null;
  full_name: string | null;
  role: 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'SALES_MANAGER' | 'SALESMAN' | 'HR_ACCOUNTS';
};

export type Employee = {
  id: string;
  company_id: string;
  user_id: string | null;
  full_name: string;
  role: Profile['role'];
  status: string;
  designation: string | null;
};

export type Task = {
  id: string;
  title: string;
  due_at: string | null;
  priority: string;
  status: string;
};

export type Visit = {
  id: string;
  customer_id: string;
  scheduled_at: string | null;
  status: string;
  customers?: { name: string } | null;
};

export type Database = any;
