import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }) });

export async function registerPushToken() {
  if (!Device.isDevice) return null;
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'AURA alerts', importance: Notifications.AndroidImportance.HIGH });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return token;
  await supabase.from('device_push_tokens').upsert({ user_id: auth.user.id, company_id: (await supabase.from('profiles').select('company_id').eq('id', auth.user.id).single()).data?.company_id, expo_push_token: token, platform: Platform.OS, is_active: true, last_seen_at: new Date().toISOString() }, { onConflict: 'expo_push_token' });
  return token;
}
