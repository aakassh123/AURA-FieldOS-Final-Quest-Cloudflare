export type Notification = {
  id: string;
  company_id: string;
  user_id: string;
  type: 'LEAD_ASSIGNED' | 'TASK_ASSIGNED' | 'VISIT_PLANNED' | 'EXPENSE_REVIEWED' | 'COMMISSION_CREATED' | 'SYSTEM';
  title: string;
  body: string;
  href: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};
