import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { StatusPill } from '../../src/components/StatusPill';

export default function Tasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [progress, setProgress] = useState<any>(null);
  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: emp } = await supabase.from('employees').select('id').eq('user_id', user.id).maybeSingle();
    if (!emp) return;
    const [{ data }, { data: game }] = await Promise.all([
      supabase.from('tasks').select('id,title,task_type,due_at,priority,status,customer:customer_id(name),lead:lead_id(title)').eq('assigned_employee_id', emp.id).neq('status', 'DONE').neq('status', 'CANCELLED').order('due_at', { ascending: true }).limit(30),
      supabase.from('employee_gamification').select('xp_total,level,current_streak').eq('employee_id', emp.id).maybeSingle(),
    ]);
    setTasks(data ?? []); setProgress(game ?? null);
  }
  useEffect(() => { load().catch(() => undefined); }, []);
  async function complete(id: string) {
    const { data, error } = await supabase.rpc('complete_task_with_rewards', { p_task_id: id });
    if (error) { Alert.alert('Could not complete mission', error.message); return; }
    Alert.alert('Mission complete', data?.reward_name ? `+${data.xp_earned ?? 0} XP\n🎁 ${data.reward_name}\nCode: ${data.redemption_code ?? '—'}` : `+${data?.xp_earned ?? 0} XP`);
    await load();
  }
  return <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
    <Text style={{ fontSize: 30, fontWeight: '800', color: '#0F172A' }}>AURA Quest</Text>
    <Text style={{ color: '#64748B', marginBottom: 6 }}>Finish useful work, build your streak and unlock company-approved rewards.</Text>
    <View style={{ backgroundColor: '#0B1220', padding: 17, borderRadius: 18 }}><Text style={{ color: '#94A3B8', fontSize: 11 }}>LEVEL {progress?.level ?? 1}</Text><Text style={{ color: '#fff', fontSize: 25, fontWeight: '900', marginTop: 3 }}>{progress?.xp_total ?? 0} XP</Text><Text style={{ color: '#CCFBF1', marginTop: 4 }}>🔥 {progress?.current_streak ?? 0} day streak</Text></View>
    {tasks.map((task) => { const customer = Array.isArray(task.customer) ? task.customer[0] : task.customer; const lead = Array.isArray(task.lead) ? task.lead[0] : task.lead; return <View key={task.id} style={{ backgroundColor: '#fff', padding: 17, borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0' }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}><View style={{ flex: 1 }}><Text style={{ color: '#0F172A', fontSize: 16, fontWeight: '800' }}>{task.title}</Text><Text style={{ color: '#64748B', marginTop: 7 }}>{customer?.name ?? lead?.title ?? 'General work'} · {(task.task_type ?? 'GENERAL').replaceAll('_', ' ')}</Text></View><StatusPill label={task.priority ?? 'Normal'} tone={task.priority === 'HIGH' ? 'danger' : 'neutral'} /></View><Text style={{ color: '#94A3B8', marginTop: 8 }}>{task.due_at ? new Date(task.due_at).toLocaleString() : 'No due date'}</Text><Pressable onPress={() => complete(task.id)} style={{ backgroundColor: '#14B8A6', paddingHorizontal: 15, paddingVertical: 11, borderRadius: 11, marginTop: 14 }}><Text style={{ fontWeight: '900', color: '#06201D', textAlign: 'center' }}>Complete mission →</Text></Pressable></View>; })}
    {tasks.length === 0 ? <Text style={{ color: '#64748B', paddingTop: 30 }}>No open missions assigned to you.</Text> : null}
  </ScrollView>;
}
