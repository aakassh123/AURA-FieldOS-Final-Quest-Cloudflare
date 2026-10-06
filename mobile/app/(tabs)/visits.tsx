import { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { getCurrentLocation } from '../../src/services/location';
import { StatusPill } from '../../src/components/StatusPill';
import { enqueue } from '../../src/lib/db';

const OUTCOMES = [
  { id: 'COMPLETED_SUCCESS', label: 'Sale / Agreement Closed' },
  { id: 'FOLLOW_UP_REQUIRED', label: 'Follow-Up Required' },
  { id: 'DEMO_COMPLETED', label: 'Demo Completed' },
  { id: 'ORDER_TAKEN', label: 'Order Taken' },
  { id: 'NO_SHOW', label: 'Customer Not Available' },
  { id: 'RESCHEDULED', label: 'Rescheduled' },
];

export default function Visits() {
  const [visits, setVisits] = useState<any[]>([]);
  const [filter, setFilter] = useState<'UPCOMING' | 'COMPLETED'>('UPCOMING');
  const [completingVisit, setCompletingVisit] = useState<any | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState('COMPLETED_SUCCESS');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: emp } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!emp) return;

      const statuses =
        filter === 'UPCOMING' ? ['PLANNED', 'STARTED'] : ['COMPLETED', 'CANCELLED'];

      const { data } = await supabase
        .from('customer_visits')
        .select(
          'id,customer_id,status,scheduled_at,completed_at,outcome,notes,geofence_verified,customers(name,address,latitude,longitude,geofence_radius_m)'
        )
        .eq('employee_id', emp.id)
        .in('status', statuses)
        .order(filter === 'UPCOMING' ? 'scheduled_at' : 'completed_at', {
          ascending: filter === 'UPCOMING',
        });

      setVisits(data ?? []);
    } catch (e) {
      console.warn('Visits load error:', e);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function startVisit(visit: any) {
    try {
      const loc = await getCurrentLocation();
      const customer = Array.isArray(visit.customers)
        ? visit.customers[0]
        : visit.customers;

      let verified = false;
      let distanceM = 0;

      if (customer?.latitude && customer?.longitude) {
        const { data: distance } = await supabase.rpc('haversine_meters', {
          lat1: loc.coords.latitude,
          lon1: loc.coords.longitude,
          lat2: customer.latitude,
          lon2: customer.longitude,
        });
        distanceM = Number(distance ?? 999999);
        verified = distanceM <= Number(customer.geofence_radius_m ?? 150);
      }

      const updatePayload = {
        status: 'STARTED',
        started_at: new Date().toISOString(),
        check_in_latitude: loc.coords.latitude,
        check_in_longitude: loc.coords.longitude,
        check_in_accuracy_m: loc.coords.accuracy,
        check_in_distance_m: distanceM,
        geofence_verified: verified,
      };

      const { error } = await supabase
        .from('customer_visits')
        .update(updatePayload)
        .eq('id', visit.id);

      if (error) {
        // Fallback offline queue
        await enqueue('visit_start', { id: visit.id, values: updatePayload });
      }

      await load();
      Alert.alert(
        verified ? 'Visit Started' : 'Visit Started (Warning)',
        verified
          ? 'GPS geofence verified successfully.'
          : customer?.latitude
          ? `You are approx. ${Math.round(distanceM)}m away from customer geofence.`
          : 'Customer GPS is not configured. Visit started with current position.'
      );
    } catch (e) {
      Alert.alert('Could not start visit', e instanceof Error ? e.message : String(e));
    }
  }

  async function handleCompleteSubmit() {
    if (!completingVisit) return;
    setSubmitting(true);
    try {
      const completedAt = new Date().toISOString();
      const updatePayload = {
        status: 'COMPLETED',
        completed_at: completedAt,
        outcome: selectedOutcome,
        notes: notes.trim() || null,
      };

      const { error } = await supabase
        .from('customer_visits')
        .update(updatePayload)
        .eq('id', completingVisit.id);

      if (error) {
        // Queue for offline sync
        await enqueue('visit_complete', {
          id: completingVisit.id,
          values: updatePayload,
        });
        Alert.alert(
          'Offline Mode',
          'Visit marked as completed locally. Rewards will sync once online.'
        );
      } else {
        // Trigger rewards calculation in database
        const { data: rewardResult } = await supabase.rpc(
          'complete_visit_with_rewards',
          { p_visit_id: completingVisit.id }
        );

        const xpAwarded = (rewardResult as any)?.xp_awarded ?? 25;
        const streak = (rewardResult as any)?.current_streak;

        Alert.alert(
          'Visit Completed! 🎉',
          `Earned +${xpAwarded} XP!${streak ? ` Current streak: 🔥 ${streak} days.` : ''}`
        );
      }

      setCompletingVisit(null);
      setNotes('');
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 12 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#0F172A' }}>
          Customer Visits
        </Text>
        <Text style={{ color: '#64748B' }}>
          Execute field visits, verify geofences & earn XP rewards.
        </Text>

        {/* Tab Filters */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: '#E2E8F0',
            borderRadius: 12,
            padding: 3,
            marginVertical: 8,
          }}
        >
          <TouchableOpacity
            onPress={() => setFilter('UPCOMING')}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 10,
              alignItems: 'center',
              backgroundColor: filter === 'UPCOMING' ? '#FFFFFF' : 'transparent',
            }}
          >
            <Text
              style={{
                fontWeight: '700',
                fontSize: 13,
                color: filter === 'UPCOMING' ? '#0F172A' : '#64748B',
              }}
            >
              Active & Upcoming
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter('COMPLETED')}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 10,
              alignItems: 'center',
              backgroundColor: filter === 'COMPLETED' ? '#FFFFFF' : 'transparent',
            }}
          >
            <Text
              style={{
                fontWeight: '700',
                fontSize: 13,
                color: filter === 'COMPLETED' ? '#0F172A' : '#64748B',
              }}
            >
              Completed History
            </Text>
          </TouchableOpacity>
        </View>

        {/* Visits List */}
        {visits.map((visit) => {
          const cust = Array.isArray(visit.customers)
            ? visit.customers[0]
            : visit.customers;
          const isStarted = visit.status === 'STARTED';
          const isCompleted = visit.status === 'COMPLETED';

          return (
            <View
              key={visit.id}
              style={{
                backgroundColor: '#fff',
                padding: 16,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: isStarted ? '#14B8A6' : '#E2E8F0',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 3,
                elevation: 1,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ color: '#0F172A', fontSize: 16, fontWeight: '800' }}>
                    {cust?.name ?? 'Unnamed Customer'}
                  </Text>
                  {cust?.address ? (
                    <Text style={{ color: '#64748B', fontSize: 12, marginTop: 3 }}>
                      📍 {cust.address}
                    </Text>
                  ) : null}
                </View>
                <StatusPill
                  label={visit.status}
                  tone={
                    isCompleted
                      ? 'success'
                      : isStarted
                      ? 'warning'
                      : 'neutral'
                  }
                />
              </View>

              <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 8 }}>
                {isCompleted
                  ? `Completed: ${new Date(visit.completed_at).toLocaleString()}`
                  : visit.scheduled_at
                  ? `Scheduled: ${new Date(visit.scheduled_at).toLocaleString()}`
                  : 'Flexible timing'}
              </Text>

              {visit.outcome && (
                <View
                  style={{
                    backgroundColor: '#F1F5F9',
                    padding: 8,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569' }}>
                    Outcome: {visit.outcome.replaceAll('_', ' ')}
                  </Text>
                  {visit.notes ? (
                    <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      {visit.notes}
                    </Text>
                  ) : null}
                </View>
              )}

              {/* Actions */}
              {!isCompleted && (
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'flex-end',
                    gap: 8,
                    marginTop: 14,
                  }}
                >
                  {visit.status === 'PLANNED' && (
                    <Pressable
                      onPress={() => startVisit(visit)}
                      style={{
                        backgroundColor: '#14B8A6',
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 10,
                      }}
                    >
                      <Text style={{ fontWeight: '800', color: '#FFFFFF', fontSize: 13 }}>
                        Check In & Start
                      </Text>
                    </Pressable>
                  )}

                  {isStarted && (
                    <Pressable
                      onPress={() => {
                        setCompletingVisit(visit);
                        setSelectedOutcome('COMPLETED_SUCCESS');
                        setNotes('');
                      }}
                      style={{
                        backgroundColor: '#0F172A',
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 10,
                      }}
                    >
                      <Text style={{ fontWeight: '800', color: '#FFFFFF', fontSize: 13 }}>
                        Complete Visit & Claim XP ✨
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {visits.length === 0 ? (
          <View
            style={{
              paddingVertical: 40,
              alignItems: 'center',
              backgroundColor: '#fff',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#E2E8F0',
            }}
          >
            <Text style={{ color: '#64748B', fontWeight: '600' }}>
              {filter === 'UPCOMING'
                ? 'No planned visits at this moment.'
                : 'No completed visits recorded yet.'}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Complete Visit Modal */}
      <Modal
        visible={!!completingVisit}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCompletingVisit(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              maxHeight: '85%',
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A' }}>
              Complete Visit
            </Text>
            <Text style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>
              Record meeting outcome and claim your quest XP.
            </Text>

            <ScrollView style={{ marginTop: 16 }} contentContainerStyle={{ gap: 12 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: '#475569',
                  textTransform: 'uppercase',
                }}
              >
                Select Outcome
              </Text>
              <View style={{ gap: 8 }}>
                {OUTCOMES.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setSelectedOutcome(item.id)}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor:
                        selectedOutcome === item.id ? '#14B8A6' : '#E2E8F0',
                      backgroundColor:
                        selectedOutcome === item.id ? '#F0FDFA' : '#FFFFFF',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: selectedOutcome === item.id ? '700' : '500',
                        color:
                          selectedOutcome === item.id ? '#0F766E' : '#334155',
                      }}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: '#475569',
                  textTransform: 'uppercase',
                  marginTop: 6,
                }}
              >
                Meeting Notes
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="What was discussed? Next customer requirements?"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                style={{
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 14,
                  color: '#0F172A',
                  textAlignVertical: 'top',
                  minHeight: 80,
                }}
              />

              <View
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  marginTop: 16,
                  paddingBottom: 20,
                }}
              >
                <TouchableOpacity
                  onPress={() => setCompletingVisit(null)}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: '#F1F5F9',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontWeight: '700', color: '#64748B' }}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleCompleteSubmit}
                  disabled={submitting}
                  style={{
                    flex: 2,
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: '#14B8A6',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontWeight: '800', color: '#FFFFFF' }}>
                    {submitting ? 'Submitting…' : 'Submit & Claim Rewards'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
