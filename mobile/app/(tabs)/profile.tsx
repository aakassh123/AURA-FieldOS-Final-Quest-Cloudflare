import { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { requestFieldLocationPermissions } from '../../src/services/location';

export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null);
  const [quest, setQuest] = useState<any>(null);
  const [claims, setClaims] = useState<any[]>([]);
  const [locationStatus, setLocationStatus] = useState('Not checked');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) return;
      setUser(authUser);

      // Fetch employee profile
      const { data: emp } = await supabase
        .from('employees')
        .select('id,full_name,designation,role,company_id')
        .eq('user_id', authUser.id)
        .maybeSingle();
      setEmployee(emp);

      // Fetch Quest progress
      const { data: questProgress } = await supabase
        .from('user_quest_progress')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();
      setQuest(questProgress);

      // Fetch unlocked reward claims
      const { data: claimList } = await supabase
        .from('reward_claims')
        .select('id,redemption_code,status,unlocked_at,reward:reward_catalog(name,description,category,cost_inr)')
        .eq('user_id', authUser.id)
        .order('unlocked_at', { ascending: false });
      setClaims(claimList ?? []);
    } catch (e) {
      console.warn('Profile load error:', e);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  async function checkPermissions() {
    const result = await requestFieldLocationPermissions();
    setLocationStatus(
      `Foreground: ${result.foreground ? 'Active' : 'Denied'} · Background: ${
        result.background ? 'Active' : 'Denied'
      }`
    );
  }

  async function signOut() {
    Alert.alert('Sign out', 'Are you sure you want to end your session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/login');
        },
      },
    ]);
  }

  const level = quest?.level ?? 1;
  const xp = quest?.xp_total ?? 0;
  const nextLevelXp = Math.pow(level, 2) * 100;
  const currentLevelBase = Math.pow(Math.max(level - 1, 0), 2) * 100;
  const progressPercent = Math.min(
    100,
    Math.max(
      0,
      ((xp - currentLevelBase) / Math.max(1, nextLevelXp - currentLevelBase)) * 100
    )
  );

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 14, backgroundColor: '#F8FAFC' }}
    >
      <Text style={{ fontSize: 28, fontWeight: '800', color: '#0F172A' }}>My Profile</Text>

      {/* Identity Card */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          padding: 20,
          borderWidth: 1,
          borderColor: '#E2E8F0',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: '#0F172A',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800' }}>
              {(employee?.full_name ?? user?.email ?? 'U').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#0F172A', fontSize: 18, fontWeight: '800' }}>
              {employee?.full_name ?? 'Field Representative'}
            </Text>
            <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
              {employee?.designation ?? employee?.role?.replaceAll('_', ' ') ?? 'Field Operative'}
            </Text>
            <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 1 }}>
              {user?.email}
            </Text>
          </View>
        </View>
      </View>

      {/* AURA Quest Gamification Card */}
      <View
        style={{
          backgroundColor: '#0F172A',
          borderRadius: 20,
          padding: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: '#14B8A6', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>
              AURA QUEST
            </Text>
            <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginTop: 4 }}>
              Level {level}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '600' }}>TOTAL XP</Text>
            <Text style={{ color: '#38BDF8', fontSize: 20, fontWeight: '900', marginTop: 2 }}>
              {xp.toLocaleString()} XP
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View
          style={{
            height: 8,
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: 4,
            marginTop: 14,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              backgroundColor: '#14B8A6',
              borderRadius: 4,
              width: `${progressPercent}%`,
            }}
          />
        </View>
        <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 6 }}>
          {Math.max(0, nextLevelXp - xp)} XP needed for Level {level + 1}
        </Text>

        {/* Streaks */}
        <View
          style={{
            flexDirection: 'row',
            marginTop: 16,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.1)',
            gap: 12,
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: 12,
              padding: 12,
            }}
          >
            <Text style={{ color: '#94A3B8', fontSize: 10, fontWeight: '700' }}>
              CURRENT STREAK
            </Text>
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 4 }}>
              🔥 {quest?.current_streak ?? 0} days
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: 12,
              padding: 12,
            }}
          >
            <Text style={{ color: '#94A3B8', fontSize: 10, fontWeight: '700' }}>
              BEST STREAK
            </Text>
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 4 }}>
              🏆 {quest?.best_streak ?? 0} days
            </Text>
          </View>
        </View>
      </View>

      {/* Unlocked Rewards Section */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          padding: 18,
          borderWidth: 1,
          borderColor: '#E2E8F0',
        }}
      >
        <Text style={{ color: '#0F172A', fontWeight: '800', fontSize: 16 }}>
          Unlocked Rewards 🎁
        </Text>
        <Text style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>
          Redeem these voucher codes according to your company rewards policy.
        </Text>

        <View style={{ marginTop: 12, gap: 10 }}>
          {claims.map((claim) => (
            <View
              key={claim.id}
              style={{
                backgroundColor: '#F8FAFC',
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: '#E2E8F0',
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#0F172A', fontWeight: '800', fontSize: 14 }}>
                  {claim.reward?.name ?? 'Company Reward'}
                </Text>
                <View
                  style={{
                    backgroundColor: '#CCFBF1',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ color: '#0F766E', fontSize: 10, fontWeight: '800' }}>
                    {claim.status}
                  </Text>
                </View>
              </View>

              {claim.reward?.description ? (
                <Text style={{ color: '#64748B', fontSize: 11, marginTop: 4 }}>
                  {claim.reward.description}
                </Text>
              ) : null}

              <View
                style={{
                  marginTop: 10,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 14,
                    fontWeight: '900',
                    color: '#0F766E',
                    letterSpacing: 1.5,
                  }}
                >
                  {claim.redemption_code}
                </Text>
                <Text style={{ fontSize: 10, color: '#94A3B8' }}>
                  {new Date(claim.unlocked_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          ))}

          {claims.length === 0 ? (
            <View
              style={{
                paddingVertical: 20,
                alignItems: 'center',
                backgroundColor: '#F8FAFC',
                borderRadius: 12,
              }}
            >
              <Text style={{ color: '#94A3B8', fontSize: 12 }}>
                No unlocked rewards yet. Complete visits to earn XP!
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Permissions Section */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          padding: 18,
          borderWidth: 1,
          borderColor: '#E2E8F0',
        }}
      >
        <Text style={{ color: '#0F172A', fontWeight: '800', fontSize: 16 }}>
          Location Permissions
        </Text>
        <Text style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>
          Location tracking operates exclusively during authorized active field work sessions.
        </Text>
        <Text style={{ color: '#0F172A', marginTop: 10, fontSize: 12, fontWeight: '600' }}>
          Status: {locationStatus}
        </Text>
        <TouchableOpacity
          onPress={checkPermissions}
          style={{
            backgroundColor: '#E2F8F5',
            paddingVertical: 12,
            borderRadius: 12,
            marginTop: 12,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#0F766E', fontWeight: '800', fontSize: 13 }}>
            Verify Permissions
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sign Out */}
      <Pressable
        onPress={signOut}
        style={{
          backgroundColor: '#FEE2E2',
          paddingVertical: 15,
          borderRadius: 14,
          alignItems: 'center',
          marginTop: 6,
        }}
      >
        <Text style={{ color: '#991B1B', fontWeight: '800', fontSize: 14 }}>
          Sign Out of FieldOS
        </Text>
      </Pressable>
    </ScrollView>
  );
}
