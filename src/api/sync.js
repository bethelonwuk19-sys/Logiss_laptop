import { getDb } from '../db/db';
import { apiPost, apiPostWithPhotos, isOnline, ApiError } from './client';

// Sync order matters: entries MUST go before movements/reports, because a
// movement or report made offline right after an entry may reference that
// entry only by its client_uuid (the server doesn't have a real id yet).
export async function runFullSync(onProgress = () => {}) {
  if (!(await isOnline())) {
    throw new Error('No internet connection right now.');
  }

  const summary = { entries: [0, 0], movements: [0, 0], reports: [0, 0], observations: [0, 0], cbt: [0, 0] };

  onProgress('Syncing laptop registrations…');
  summary.entries = await syncEntries();

  onProgress('Syncing check-ins / check-outs / returns…');
  summary.movements = await syncMovements();

  onProgress('Syncing reports…');
  summary.reports = await syncReports();

  onProgress('Syncing behaviour notes…');
  summary.observations = await syncObservations();

  onProgress('Syncing CBT codes…');
  summary.cbt = await syncCbt();

  return summary;
}

// Each sync* function returns [succeeded, failed] counts.

async function syncEntries() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM pending_entries WHERE sync_status IN ('pending','error')`
  );
  let ok = 0, fail = 0;
  for (const row of rows) {
    try {
      const photos = await db.getAllAsync(
        `SELECT local_uri FROM pending_entry_photos WHERE entry_client_uuid = ?`,
        [row.client_uuid]
      );
      const data = await apiPostWithPhotos(
        'push_entry',
        {
          client_uuid: row.client_uuid,
          reg_no: row.reg_no,
          brand: row.brand, model: row.model, serial_number: row.serial_number,
          color: row.color, ram_gb: row.ram_gb, processor: row.processor, storage: row.storage,
          condition_on_submit: row.condition_on_submit, laptop_password: row.laptop_password,
          notes: row.notes, submitted_at: row.submitted_at,
        },
        photos.map((p) => p.local_uri)
      );
      const serverId = data.submission?.id ?? null;
      await db.runAsync(
        `UPDATE pending_entries SET sync_status='synced', server_id=?, error_message=NULL WHERE client_uuid=?`,
        [serverId, row.client_uuid]
      );
      ok++;
    } catch (e) {
      await handleSyncError(db, 'pending_entries', row.client_uuid, e);
      fail++;
    }
  }
  return [ok, fail];
}

async function syncMovements() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM pending_movements WHERE sync_status IN ('pending','error')`
  );
  let ok = 0, fail = 0;
  for (const row of rows) {
    try {
      const data = await apiPost('push_movement', {
        client_uuid: row.client_uuid,
        sub_action: row.sub_action,
        submission_id: row.submission_server_id || '',
        submission_client_uuid: row.submission_client_uuid || '',
        note: row.note || '', reason: row.reason || '',
        performed_at: row.performed_at,
      });
      await db.runAsync(
        `UPDATE pending_movements SET sync_status='synced', error_message=NULL WHERE client_uuid=?`,
        [row.client_uuid]
      );
      ok++;
    } catch (e) {
      // A 409 here usually means "the entry this refers to hasn't synced
      // yet" - leave it as 'pending' (not 'error') so the next sync run
      // retries it automatically once the entry above has gone through.
      if (e instanceof ApiError && e.isConflict && e.payload?.conflict === 'entry_not_synced_yet') {
        fail++;
        continue;
      }
      await handleSyncError(db, 'pending_movements', row.client_uuid, e);
      fail++;
    }
  }
  return [ok, fail];
}

async function syncReports() {
  const db = await getDb();
  const rows = await db.getAllAsync(`SELECT * FROM pending_reports WHERE sync_status IN ('pending','error')`);
  let ok = 0, fail = 0;
  for (const row of rows) {
    try {
      await apiPost('push_report', {
        client_uuid: row.client_uuid, reg_no: row.reg_no, title: row.title,
        category: row.category || '', severity: row.severity || '',
        description: row.description, filed_for: row.filed_for || '',
      });
      await db.runAsync(`UPDATE pending_reports SET sync_status='synced', error_message=NULL WHERE client_uuid=?`, [row.client_uuid]);
      ok++;
    } catch (e) {
      await handleSyncError(db, 'pending_reports', row.client_uuid, e);
      fail++;
    }
  }
  return [ok, fail];
}

async function syncObservations() {
  const db = await getDb();
  const rows = await db.getAllAsync(`SELECT * FROM pending_observations WHERE sync_status IN ('pending','error')`);
  let ok = 0, fail = 0;
  for (const row of rows) {
    try {
      await apiPost('push_observation', {
        client_uuid: row.client_uuid, reg_no: row.reg_no,
        obs_type: row.obs_type || '', context: row.context || '',
        observation: row.observation, follow_up: row.follow_up ? '1' : '',
      });
      await db.runAsync(`UPDATE pending_observations SET sync_status='synced', error_message=NULL WHERE client_uuid=?`, [row.client_uuid]);
      ok++;
    } catch (e) {
      await handleSyncError(db, 'pending_observations', row.client_uuid, e);
      fail++;
    }
  }
  return [ok, fail];
}

async function syncCbt() {
  const db = await getDb();
  const rows = await db.getAllAsync(`SELECT * FROM pending_cbt WHERE sync_status IN ('pending','error')`);
  let ok = 0, fail = 0;
  for (const row of rows) {
    try {
      const data = await apiPost('push_cbt_generate', {
        client_uuid: row.client_uuid, reg_no: row.reg_no,
        session_name: row.session_name, expires_at: row.expires_at || '', qty: String(row.qty || 1),
      });
      await db.runAsync(
        `UPDATE pending_cbt SET sync_status='synced', result_codes=?, error_message=NULL WHERE client_uuid=?`,
        [JSON.stringify(data.codes || []), row.client_uuid]
      );
      ok++;
    } catch (e) {
      await handleSyncError(db, 'pending_cbt', row.client_uuid, e);
      fail++;
    }
  }
  return [ok, fail];
}

async function handleSyncError(db, table, clientUuid, error) {
  const message = error?.message || 'Unknown error';
  await db.runAsync(
    `UPDATE ${table} SET sync_status='error', error_message=? WHERE client_uuid=?`,
    [message, clientUuid]
  );
}

// Returns counts of everything still waiting to sync, for the badge on
// the Sync button / home screen.
export async function getPendingCounts() {
  const db = await getDb();
  const tables = ['pending_entries', 'pending_movements', 'pending_reports', 'pending_observations', 'pending_cbt'];
  const counts = {};
  let total = 0;
  for (const t of tables) {
    const row = await db.getFirstAsync(`SELECT COUNT(*) as c FROM ${t} WHERE sync_status IN ('pending','error')`);
    counts[t] = row.c;
    total += row.c;
  }
  counts.total = total;
  return counts;
}
