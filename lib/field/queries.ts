import { createClient } from '@/lib/supabase/server';
import type { Attendance, WorkSession, FieldCustomer, Visit } from './types';

export async function getFieldDashboard() {
  const supabase = await createClient();
  const [{ data: employee }, { data: attendance, error: attendanceError }, { data: session, error: sessionError }, { data: visits, error: visitsError }, { data: customers, error: customersError }, { data: tasks, error: tasksError }] = await Promise.all([
    supabase.from('employees').select('id,full_name,role,status').eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '').maybeSingle(),
    supabase.from('attendance').select('id,employee_id,attendance_date,status,check_in_at,check_out_at,check_in_latitude,check_in_longitude,check_in_accuracy_m,check_in_note,check_out_note,employee:employee_id(id,full_name,employee_code,role)').order('attendance_date',{ascending:false}).limit(100),
    supabase.from('work_sessions').select('id,employee_id,status,started_at,ended_at,total_active_seconds,start_latitude,start_longitude').order('started_at',{ascending:false}).limit(10),
    supabase.from('customer_visits').select('id,customer_id,lead_id,employee_id,status,scheduled_at,started_at,completed_at,check_in_distance_m,geofence_verified,outcome,notes,next_follow_up_at,customer:customer_id(name)').order('scheduled_at',{ascending:false}).limit(12),
    supabase.from('customers').select('id,name,city,latitude,longitude,geofence_radius_m').order('name').limit(100),
    supabase.from('tasks').select('id,title,task_type,due_at,priority,status,lead_id,customer_id,customer:customer_id(name),lead:lead_id(title)').order('due_at',{ascending:true}).limit(12),
  ]);
  for (const result of [attendanceError, sessionError, visitsError, customersError, tasksError]) if (result) console.warn('Field query notice:', result.message);
  return {
    employee,
    attendance: (attendance ?? []) as unknown as Attendance[],
    sessions: (session ?? []) as WorkSession[],
    visits: (visits ?? []) as unknown as Visit[],
    customers: (customers ?? []) as FieldCustomer[],
    tasks: tasks ?? [],
  };
}

export async function getVisit(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('customer_visits').select('id,customer_id,lead_id,employee_id,status,scheduled_at,started_at,completed_at,check_in_latitude,check_in_longitude,check_in_accuracy_m,check_in_distance_m,geofence_verified,outcome,notes,next_follow_up_at,customer:customer_id(name)').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Visit | null;
}
