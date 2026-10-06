import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { getCurrentLocation, startBackgroundTracking, stopBackgroundTracking } from '../../src/services/location';
import { enqueue, getLocal, initLocalDb, newUuid, setLocal } from '../../src/lib/db';
import { syncPendingWork } from '../../src/services/sync';
import { StatusPill } from '../../src/components/StatusPill';
import type { Employee } from '../../src/lib/types';

export default function Home() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [active, setActive] = useState<any>(null);
  const [attendance, setAttendance] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState<any>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.replace('/login');
    const { data: emp } = await supabase.from('employees').select('id,company_id,user_id,full_name,role,status,designation').eq('user_id', user.id).maybeSingle();
    if (!emp) return;
    setEmployee(emp as Employee);
    await initLocalDb();
    await setLocal('current_employee_id', emp.id);
    await setLocal('current_company_id', emp.company_id);
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: att }, { data: session }] = await Promise.all([
      supabase.from('attendance').select('*').eq('employee_id', emp.id).eq('attendance_date', today).maybeSingle(),
      supabase.from('work_sessions').select('*').eq('employee_id', emp.id).eq('status', 'ACTIVE').maybeSingle()
    ]);
    setAttendance(att); setActive(session);
    if (session) await setLocal('active_work_session_id', session.id);
    else await setLocal('active_work_session_id', '');
  }, []);

  useEffect(() => { load().catch(() => undefined); }, [load]);

  async function checkIn() {
    if (!employee) return;
    try {
      const current = await getCurrentLocation();
      const today = new Date().toISOString().slice(0, 10);
      const payload = {
        id: newUuid(),
        company_id: employee.company_id,
        employee_id: employee.id,
        attendance_date: today,
        status: 'PRESENT',
        check_in_at: new Date().toISOString(),
        check_in_latitude: current.coords.latitude,
        check_in_longitude: current.coords.longitude,
        check_in_accuracy_m: current.coords.accuracy
      };
      const { data, error } = await supabase.from('attendance').insert(payload).select().single();
      if (error) {
        if (/network|fetch|offline/i.test(error.message)) {
          await enqueue('attendance_check_in', payload);
          setAttendance(payload);
          Alert.alert('Saved offline', 'Check-in is queued and will sync when the connection returns.');
          return;
        }
        throw error;
      }
      setAttendance(data);
    } catch (error) { Alert.alert('Check-in failed', error instanceof Error ? error.message : String(error)); }
  }

  async function startWork() {
    if (!employee) return;
    try {
      const current = await getCurrentLocation();
      const localSessionId = newUuid();
      const sessionPayload = {
        id: localSessionId,
        company_id: employee.company_id,
        employee_id: employee.id,
        attendance_id: attendance?.id ?? null,
        status: 'ACTIVE',
        started_at: new Date().toISOString(),
        start_latitude: current.coords.latitude,
        start_longitude: current.coords.longitude
      };
      const { data, error } = await supabase.from('work_sessions').insert(sessionPayload).select().single();
      if (error) {
        if (/network|fetch|offline/i.test(error.message)) {
          await enqueue('work_session_start', sessionPayload);
          await setLocal('active_work_session_id', localSessionId);
          await startBackgroundTracking();
          setActive(sessionPayload);
          Alert.alert('Work started offline', 'Your work session is queued locally and location points will sync when connected.');
          return;
        }
        throw error;
      }
      await setLocal('active_work_session_id', data.id);
      await startBackgroundTracking();
      setActive(data);
      Alert.alert('Work session started', 'AURA will record location only for this active field-work session.');
    } catch (error) { Alert.alert('Could not start work', error instanceof Error ? error.message : String(error)); }
  }

  async function endWork() {
    if (!active) return;
    try {
      const current = await getCurrentLocation();
      const { error } = await supabase.from('work_sessions').update({ status: 'ENDED', ended_at: new Date().toISOString(), end_latitude: current.coords.latitude, end_longitude: current.coords.longitude }).eq('id', active.id);
      if (error) throw error;
      await stopBackgroundTracking();
      await setLocal('active_work_session_id', '');
      await syncPendingWork();
      setActive(null);
      Alert.alert('Work session ended', 'Queued field data was synced where a network connection was available.');
    } catch (error) { Alert.alert('Could not end work', error instanceof Error ? error.message : String(error)); }
  }

  async function refresh() { setRefreshing(true); await syncPendingWork(); await load(); setRefreshing(false); }

  return <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} contentContainerStyle={{ padding: 20, gap: 14 }}>
    <View style={{ paddingTop: 16 }}><Text style={{ color: '#64748B', fontSize: 13 }}>GOOD MORNING</Text><Text style={{ color: '#0F172A', fontSize: 30, fontWeight: '800', marginTop: 3 }}>{employee?.full_name?.split(' ')[0] ?? 'Salesman'}</Text></View>
    <View style={{ backgroundColor: '#0B1220', borderRadius: 22, padding: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><View><Text style={{ color: '#94A3B8', fontSize: 12 }}>FIELD STATUS</Text><Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 4 }}>{active ? 'Working' : 'Ready to work'}</Text></View><StatusPill label={active ? 'LIVE' : 'IDLE'} tone={active ? 'success' : 'neutral'} /></View>
      <Text style={{ color: '#CBD5E1', marginTop: 12, lineHeight: 20 }}>{active ? 'Location sharing is active for this authorized work session.' : 'Start a work session when you are ready for field activity.'}</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
        {!attendance ? <Pressable onPress={checkIn} style={buttonStyle}><Text style={buttonText}>Check in</Text></Pressable> : null}
        {!active ? <Pressable onPress={startWork} disabled={!attendance} style={[buttonStyle, !attendance && { opacity: 0.4 }]}><Text style={buttonText}>Start work</Text></Pressable> : <Pressable onPress={endWork} style={[buttonStyle, { backgroundColor: '#FEE2E2' }]}><Text style={{ color: '#991B1B', fontWeight: '800' }}>End work</Text></Pressable>}
      </View>
    </View>
    <View style={{ flexDirection: 'row', gap: 12 }}><Stat label="Attendance" value={attendance ? 'Checked in' : 'Not yet'} /><Stat label="Work session" value={active ? 'Active' : 'Inactive'} /></View>
    <Pressable onPress={async () => { try { setLocation(await getCurrentLocation()); } catch (e) { Alert.alert('Location', String(e)); } }} style={{ backgroundColor: '#fff', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#E2E8F0' }}><Text style={{ color: '#0F172A', fontWeight: '800', fontSize: 16 }}>Check my current location</Text><Text style={{ color: '#64748B', marginTop: 5 }}>{location ? `${location.coords.latitude.toFixed(5)}, ${location.coords.longitude.toFixed(5)} · ±${Math.round(location.coords.accuracy ?? 0)}m` : 'Useful for verifying GPS before a visit.'}</Text></Pressable>
  </ScrollView>;
}

function Stat({ label, value }: { label: string; value: string }) { return <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}><Text style={{ color: '#64748B', fontSize: 12 }}>{label}</Text><Text style={{ color: '#0F172A', fontSize: 16, fontWeight: '800', marginTop: 7 }}>{value}</Text></View>; }
const buttonStyle = { flex: 1, backgroundColor: '#14B8A6', paddingVertical: 13, borderRadius: 13, alignItems: 'center' } as const;
const buttonText = { color: '#06201D', fontWeight: '800' } as const;
