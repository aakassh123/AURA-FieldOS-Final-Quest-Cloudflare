import { createClient } from '@/lib/supabase/server';
import type { CrmData, Activity } from './types';

export async function getCrmData(): Promise<CrmData> {
  const supabase = await createClient();
  const [stages, leads, customers, employees] = await Promise.all([
    supabase.from('pipeline_stages').select('id,name,position,color,is_closed').order('position'),
    supabase.from('leads').select('id,title,customer_id,contact_id,stage_id,owner_employee_id,source,priority,status,estimated_value,expected_close_date,next_follow_up_at,notes,created_at,stage:pipeline_stages(id,name,position,color,is_closed),owner:owner_employee_id(full_name),customer:customer_id(name)').order('updated_at',{ascending:false}),
    supabase.from('customers').select('id,name,phone,email,city,industry,owner_employee_id,latitude,longitude,geofence_radius_m').order('created_at',{ascending:false}),
    supabase.from('employees').select('id,full_name,role,status').neq('status','INACTIVE').order('full_name'),
  ]);
  for (const result of [stages, leads, customers, employees]) if (result.error) console.warn('CRM query notice:', result.error.message);
  return { stages: stages.data ?? [], leads: (leads.data ?? []) as any, customers: customers.data ?? [], employees: employees.data ?? [] };
}

export async function getLead(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('leads').select('id,title,customer_id,contact_id,stage_id,owner_employee_id,source,priority,status,estimated_value,expected_close_date,next_follow_up_at,notes,created_at,stage:pipeline_stages(id,name,position,color,is_closed),owner:owner_employee_id(full_name),customer:customer_id(name)').eq('id',id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const activities = await supabase.from('lead_activities').select('id,type,body,created_at,employee:employee_id(full_name)').eq('lead_id',id).order('created_at',{ascending:false});
  if (activities.error) throw new Error(activities.error.message);
  return { lead: data as any, activities: (activities.data ?? []) as unknown as Activity[] };
}
