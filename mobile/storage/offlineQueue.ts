import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
async function db() {
  if (!dbPromise) dbPromise = SQLite.openDatabaseAsync('aura-offline.db');
  const database = await dbPromise;
  await database.execAsync(`CREATE TABLE IF NOT EXISTS location_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);`);
  return database;
}

export async function enqueue(kind: string, payload: unknown) {
  const database = await db();
  await database.runAsync('INSERT INTO location_queue (kind,payload,created_at) VALUES (?,?,?)', kind, JSON.stringify(payload), new Date().toISOString());
}

export async function pending() {
  const database = await db();
  return database.getAllAsync<{ id: number; kind: string; payload: string }>('SELECT id,kind,payload FROM location_queue ORDER BY id ASC');
}

export async function remove(id: number) {
  const database = await db();
  await database.runAsync('DELETE FROM location_queue WHERE id = ?', id);
}
