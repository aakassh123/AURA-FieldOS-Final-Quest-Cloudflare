import { supabase } from '@/lib/supabase';
import { pending, remove } from '@/storage/offlineQueue';

export async function syncOfflineQueue() {
  const rows = await pending();
  for (const row of rows) {
    const payload = JSON.parse(row.payload);
    let error: { message: string } | null = null;
    if (row.kind === 'work_session_location') {
      ({ error } = await supabase.from('work_session_location_points').insert(payload));
    } else if (row.kind === 'trip_point') {
      ({ error } = await supabase.from('trip_points').insert(payload));
    } else if (row.kind === 'attendance') {
      ({ error } = await supabase.from('attendance').insert(payload));
    }
    if (!error) await remove(row.id);
  }
}
