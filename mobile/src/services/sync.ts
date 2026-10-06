import * as Network from 'expo-network';
import { dbPromise } from '../lib/db';
import { supabase } from '../lib/supabase';

export async function syncPendingWork() {
  const state = await Network.getNetworkStateAsync();
  if (!state.isConnected) return { synced: 0, skipped: true };

  const db = await dbPromise;
  let synced = 0;

  const queued = await db.getAllAsync<{ id: string; action: string; payload: string; attempts: number }>(
    'SELECT id, action, payload, attempts FROM sync_queue ORDER BY created_at ASC LIMIT 50'
  );

  for (const item of queued) {
    try {
      const payload = JSON.parse(item.payload);
      if (item.action === 'attendance_check_in') {
        const { error } = await supabase.from('attendance').upsert(payload, { onConflict: 'employee_id,attendance_date' });
        if (error) throw error;
      } else if (item.action === 'attendance_check_out') {
        const { error } = await supabase.from('attendance').update(payload.values).eq('employee_id', payload.employee_id).eq('attendance_date', payload.attendance_date);
        if (error) throw error;
      } else if (item.action === 'work_session_start') {
        const { error } = await supabase.from('work_sessions').upsert(payload, { onConflict: 'id' });
        if (error) throw error;
      } else if (item.action === 'work_session_end') {
        const { error } = await supabase.from('work_sessions').update(payload.values).eq('id', payload.id);
        if (error) throw error;
      } else if (item.action === 'visit_start') {
        const { error } = await supabase.from('customer_visits').update(payload.values).eq('id', payload.id);
        if (error) throw error;
      } else if (item.action === 'visit_complete') {
        const { error } = await supabase.from('customer_visits').update(payload.values).eq('id', payload.id);
        if (error) throw error;
        // Trigger rewards calculation once visit is marked complete
        await supabase.rpc('complete_visit_with_rewards', { p_visit_id: payload.id }).catch(() => null);
      }
      await db.runAsync('DELETE FROM sync_queue WHERE id = ?', item.id);
      synced += 1;
    } catch (error) {
      await db.runAsync(
        'UPDATE sync_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?',
        error instanceof Error ? error.message : String(error), item.id
      );
    }
  }

  const points = await db.getAllAsync<{
    id: string; work_session_id: string; employee_id: string; company_id: string;
    latitude: number; longitude: number; accuracy_m: number | null; recorded_at: string;
  }>('SELECT * FROM location_queue WHERE synced_at IS NULL ORDER BY recorded_at ASC LIMIT 200');

  if (points.length) {
    const { error } = await supabase.from('work_session_location_points').insert(
      points.map((p) => ({
        id: p.id,
        work_session_id: p.work_session_id,
        employee_id: p.employee_id,
        company_id: p.company_id,
        latitude: p.latitude,
        longitude: p.longitude,
        accuracy_m: p.accuracy_m,
        recorded_at: p.recorded_at
      }))
    );
    if (!error) {
      await db.runAsync(
        `UPDATE location_queue SET synced_at = datetime('now') WHERE id IN (${points.map(() => '?').join(',')})`,
        ...points.map((p) => p.id)
      );
      synced += points.length;
    }
  }

  return { synced, skipped: false };
}
