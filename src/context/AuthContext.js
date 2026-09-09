import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getDb, getMeta, setMeta, clearMeta } from '../db/db';
import { apiPost, apiGet, isOnline } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await getMeta('auth_token');
      const userJson = await getMeta('auth_user');
      if (token && userJson) setUser(JSON.parse(userJson));
      setReady(true);
    })();
  }, []);

  const login = useCallback(async (username, password) => {
    if (!(await isOnline())) {
      throw new Error('You need internet for the first sign-in (to fetch your login and student list). After that, the app works offline.');
    }
    const data = await apiPost('login', { username, password, device_label: 'Field app' });
    await setMeta('auth_token', data.token);
    await setMeta('auth_user', JSON.stringify(data.user));
    setUser(data.user);

    // Pull the student roster right away so offline registration works
    // the moment sign-in finishes.
    await downloadStudents();
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await apiPost('logout', {}); } catch (e) { /* ignore - still log out locally */ }
    await clearMeta('auth_token');
    await clearMeta('auth_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Downloads the full active-student roster into the local cache.
// Called on login, and can be re-called manually from the Sync screen
// to refresh names/classes without a full re-login.
export async function downloadStudents() {
  const data = await apiGet('pull_students');
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const s of data.students) {
      await db.runAsync(
        `INSERT INTO students (id, reg_num, lname, mname, fname, gender, admitted_class, status, pfpics, pfpic_url)
         VALUES (?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           reg_num=excluded.reg_num, lname=excluded.lname, mname=excluded.mname, fname=excluded.fname,
           gender=excluded.gender, admitted_class=excluded.admitted_class, status=excluded.status,
           pfpics=excluded.pfpics, pfpic_url=excluded.pfpic_url`,
        [s.id, s.reg_num, s.lname, s.mname, s.fname, s.gender, s.admitted_class, s.status, s.pfpics, s.pfpic_url]
      );
    }
  });
  await setMeta('students_last_synced', new Date().toISOString());
  return data.count;
}

// Downloads recent submissions into the local cache, used for duplicate
// checks and the movement/report student pickers while offline.
export async function downloadSubmissions() {
  const data = await apiGet('pull_submissions');
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const s of data.submissions) {
      await db.runAsync(
        `INSERT INTO submissions_cache (server_id, reg_no, sname, class, brand, model, status, submitted_at, raw_json)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON CONFLICT(server_id) DO UPDATE SET
           reg_no=excluded.reg_no, sname=excluded.sname, class=excluded.class, brand=excluded.brand,
           model=excluded.model, status=excluded.status, submitted_at=excluded.submitted_at, raw_json=excluded.raw_json`,
        [s.id, s.reg_no, s.sname, s.class, s.brand, s.model, s.status, s.submitted_at, JSON.stringify(s)]
      );
    }
  });
  await setMeta('submissions_last_synced', new Date().toISOString());
  return data.submissions.length;
}
