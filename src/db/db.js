import * as SQLite from 'expo-sqlite';

// One shared connection for the whole app.
let _db = null;
export async function getDb() {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('logiss.db');
  await initSchema(_db);
  return _db;
}

async function initSchema(db) {
  // NOTE on design: every "pending_*" table mirrors a server table but adds
  // a local uuid (client_uuid) and a sync_status column. Nothing is ever
  // deleted after sync — rows just flip to 'synced' — so the app also
  // works as an offline-first local history, and a failed sync attempt
  // never loses data.
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    -- Cached copy of the server's students table (refreshed on login / pull)
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY,
      reg_num TEXT UNIQUE NOT NULL,
      lname TEXT, mname TEXT, fname TEXT,
      gender TEXT, admitted_class TEXT, status TEXT,
      pfpics TEXT, pfpic_url TEXT
    );

    -- Cached copy of server laptop_submissions, refreshed on pull.
    -- Lets the app show "already registered" warnings and movement/report
    -- pickers to work fully offline.
    CREATE TABLE IF NOT EXISTS submissions_cache (
      server_id INTEGER PRIMARY KEY,
      reg_no TEXT, sname TEXT, class TEXT, brand TEXT, model TEXT,
      status TEXT, submitted_at TEXT, raw_json TEXT
    );

    -- Offline-created laptop registrations, queued for sync
    CREATE TABLE IF NOT EXISTS pending_entries (
      client_uuid TEXT PRIMARY KEY,
      reg_no TEXT NOT NULL,
      brand TEXT, model TEXT, serial_number TEXT, color TEXT,
      ram_gb TEXT, processor TEXT, storage TEXT,
      condition_on_submit TEXT, laptop_password TEXT, notes TEXT,
      submitted_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending', -- pending | syncing | synced | error
      server_id INTEGER,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Photos captured for a pending entry (full-res files live on disk;
    -- this table just tracks their local paths and upload status)
    CREATE TABLE IF NOT EXISTS pending_entry_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_client_uuid TEXT NOT NULL,
      local_uri TEXT NOT NULL,
      uploaded INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (entry_client_uuid) REFERENCES pending_entries(client_uuid)
    );

    -- Offline-created movements (checkin / checkout / return)
    CREATE TABLE IF NOT EXISTS pending_movements (
      client_uuid TEXT PRIMARY KEY,
      sub_action TEXT NOT NULL, -- checkin | checkout | return
      submission_server_id INTEGER,
      submission_client_uuid TEXT,
      note TEXT, reason TEXT,
      performed_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Offline-created reports
    CREATE TABLE IF NOT EXISTS pending_reports (
      client_uuid TEXT PRIMARY KEY,
      reg_no TEXT NOT NULL,
      title TEXT NOT NULL, category TEXT, severity TEXT,
      description TEXT NOT NULL, filed_for TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Offline-created behaviour observations
    CREATE TABLE IF NOT EXISTS pending_observations (
      client_uuid TEXT PRIMARY KEY,
      reg_no TEXT NOT NULL,
      obs_type TEXT, context TEXT, observation TEXT NOT NULL, follow_up INTEGER DEFAULT 0,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Offline-created CBT code generation requests
    CREATE TABLE IF NOT EXISTS pending_cbt (
      client_uuid TEXT PRIMARY KEY,
      reg_no TEXT NOT NULL,
      session_name TEXT NOT NULL, expires_at TEXT, qty INTEGER DEFAULT 1,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      result_codes TEXT, error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Simple key/value store: auth token, user info, last sync time, etc.
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

export async function setMeta(key, value) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

export async function getMeta(key) {
  const db = await getDb();
  const row = await db.getFirstAsync(`SELECT value FROM app_meta WHERE key = ?`, [key]);
  return row ? row.value : null;
}

export async function clearMeta(key) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM app_meta WHERE key = ?`, [key]);
}
