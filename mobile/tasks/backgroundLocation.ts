import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { enqueue } from '@/storage/offlineQueue';
import { LOCATION_TASK } from '@/services/location';

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const locations = (data as { locations: Location.LocationObject[] }).locations ?? [];
  if (!locations.length) return;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { data: employee } = await supabase.from('employees').select('id,company_id').eq('user_id', auth.user.id).maybeSingle();
  if (!employee) return;
  const { data: session } = await supabase.from('work_sessions').select('id').eq('employee_id', employee.id).eq('status','ACTIVE').maybeSingle();
  if (!session) return;
  for (const point of locations) {
    const payload = {
      company_id: employee.company_id,
      work_session_id: session.id,
      employee_id: employee.id,
      latitude: point.coords.latitude,
      longitude: point.coords.longitude,
      accuracy_m: point.coords.accuracy,
      recorded_at: new Date(point.timestamp).toISOString(),
    };
    const { error: insertError } = await supabase.from('work_session_location_points').insert(payload);
    if (insertError) await enqueue('work_session_location', payload);
  }
});
