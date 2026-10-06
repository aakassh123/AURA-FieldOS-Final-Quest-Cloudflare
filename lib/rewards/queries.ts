import { createClient } from '@/lib/supabase/server';

export async function getRewardsPageData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const { data: employee } = await supabase.from('employees').select('id,company_id,full_name').eq('user_id', user.id).maybeSingle();
  let companyId = employee?.company_id;
  if (!companyId) {
    const { data: profile } = await supabase.from('profiles').select('company_id,full_name').eq('id', user.id).maybeSingle();
    companyId = profile?.company_id ?? undefined;
  }
  if (!companyId) throw new Error('Company workspace not found');

  const employeeId = employee?.id;
  const [{ data: progress }, { data: claims }, { data: rules }, { data: catalog }] = await Promise.all([
    employeeId ? supabase.from('employee_gamification').select('*').eq('employee_id', employeeId).maybeSingle() : Promise.resolve({ data: null }),
    employeeId ? supabase.from('reward_claims').select('id,status,redemption_code,unlocked_at,expires_at,reward:reward_id(name,description,cost_inr,icon)').eq('employee_id', employeeId).order('unlocked_at', { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    supabase.from('reward_rules').select('id,name,trigger_type,task_type,xp_amount,reward:reward_id(name,cost_inr,description,icon)').eq('company_id', companyId).eq('active', true).order('priority', { ascending: true }),
    supabase.from('reward_catalog').select('id,name,description,cost_inr,icon,stock_remaining,active').eq('company_id', companyId).eq('active', true).order('created_at', { ascending: false }),
  ]);

  return { employee, progress, claims: claims ?? [], rules: rules ?? [], catalog: catalog ?? [] };
}
