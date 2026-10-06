import { openDatabaseAsync } from 'expo-sqlite';

export const dbPromise = openDatabaseAsync('aura-fieldos-mobile.db');

export function newUuid() {
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function initLocalDb() {
  const db = await dbPromise;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );
    CREATE TABLE IF NOT EXISTS location_queue (
      id TEXT PRIMARY KEY NOT NULL,
      work_session_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy_m REAL,
      recorded_at TEXT NOT NULL,
      synced_at TEXT
    );
  `);
}

export async function setLocal(key: string, value: string) {
  const db = await dbPromise;
  await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, value);
}

export async function getLocal(key: string) {
  const db = await dbPromise;
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  return row?.value ?? null;
}

export async function enqueue(action: string, payload: unknown) {
  const db = await dbPromise;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await db.runAsync(
    'INSERT INTO sync_queue (id, action, payload, created_at) VALUES (?, ?, ?, ?)',
    id, action, JSON.stringify(payload), new Date().toISOString()
  );
  return id;
}

export async function pendingQueueCount() {
  const db = await dbPromise;
  const row = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM sync_queue');
  return row?.count ?? 0;
}

export async function enqueueLocation(point: {
  work_session_id: string;
  employee_id: string;
  company_id: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number | null;
  recorded_at: string;
}) {
  const db = await dbPromise;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await db.runAsync(
    `INSERT INTO location_queue
      (id, work_session_id, employee_id, company_id, latitude, longitude, accuracy_m, recorded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id, point.work_session_id, point.employee_id, point.company_id,
    point.latitude, point.longitude, point.accuracy_m ?? null, point.recorded_at
  );
}
