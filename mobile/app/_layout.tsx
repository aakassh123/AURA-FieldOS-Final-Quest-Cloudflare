import '../src/tasks/location';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { initLocalDb } from '../src/lib/db';
import { registerForPushNotifications } from '../src/services/notifications';

export default function RootLayout() {
  useEffect(() => {
    initLocalDb().then(() => registerForPushNotifications()).catch(() => undefined);
  }, []);

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F8FAFC' } }} />;
}
