import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { openDatabaseAsync } from 'expo-sqlite';
import type { Database } from './types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const dbPromise = openDatabaseAsync('aura-fieldos-mobile.db');

const storage = {
  async getItem(key: string) {
    const db = await dbPromise;
    await db.execAsync('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT)');
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
    return row?.value ?? null;
  },
  async setItem(key: string, value: string) {
    const db = await dbPromise;
    await db.execAsync('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT)');
    await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, value);
  },
  async removeItem(key: string) {
    const db = await dbPromise;
    await db.runAsync('DELETE FROM kv WHERE key = ?', key);
  }
};

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
