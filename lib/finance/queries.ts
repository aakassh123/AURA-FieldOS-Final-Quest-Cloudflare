import { createClient } from '@/lib/supabase/server';
import type { CompensationRule, Expense, FinanceEmployee } from './types';
export async function getFinanceDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');
  const [{ data: employee }, { data: expenses }, { data: deals }, { data: commissions }, { data: payouts }] = await Promise.all([
    supabase.from('employees').select('id,full_name,role,status').eq('user_id', user.id).maybeSingle(),
    supabase.from('expenses').select('id,employee_id,category,status,expense_date,amount,approved_amount,merchant,description,rejection_reason').order('expense_date',{ascending:false}).limit(20),
    supabase.from('deals').select('id,title,status,revenue_amount,owner_employee_id,closed_at').order('created_at',{ascending:false}).limit(20),
    supabase.from('commissions').select('id,employee_id,revenue_amount,rate_percent,commission_amount,status,calculated_at').order('calculated_at',{ascending:false}).limit(20),
    supabase.from('payouts').select('id,employee_id,period_start,period_end,base_amount,incentive_amount,commission_amount,expense_reimbursement,deductions,net_amount,status').order('period_start',{ascending:false}).limit(20),
  ]);
  return { employee, expenses: (expenses ?? []) as Expense[], deals: deals ?? [], commissions: commissions ?? [], payouts: payouts ?? [] };
}
export async function getFinancePeople() {
  const supabase = await createClient();
  const [{ data: employees }, { data: rules }] = await Promise.all([
    supabase.from('employees').select('id,full_name,role,status').eq('status','ACTIVE').order('full_name'),
    supabase.from('compensation_rules').select('id,name,version,rule_type,fixed_salary,daily_rate,incentive_rate_percent,commission_rate_percent,effective_from,effective_to,is_active').eq('is_active',true).order('effective_from',{ascending:false}),
  ]);
  return { employees: (employees ?? []) as FinanceEmployee[], rules: (rules ?? []) as CompensationRule[] };
}
