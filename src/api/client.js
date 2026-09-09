import * as Network from 'expo-network';
import { getMeta } from '../db/db';

// CHANGE THIS to your real server path once deployed.
export const API_BASE = 'https://logiss.org/laptops/api.php';

export async function isOnline() {
  const state = await Network.getNetworkStateAsync();
  return !!(state.isConnected && state.isInternetReachable !== false);
}

async function getToken() {
  return await getMeta('auth_token');
}

// GET requests use the token=... query fallback (works even if a host's
// Apache strips the Authorization header — see api backend README).
export async function apiGet(action, params = {}) {
  const token = await getToken();
  const qs = new URLSearchParams({ action, token: token || '', ...params });
  const res = await fetch(`${API_BASE}?${qs.toString()}`);
  const data = await res.json();
  if (!res.ok || data.ok === false) throw new ApiError(data.error || 'Request failed', res.status, data);
  return data;
}

// POST with plain fields (no photos)
export async function apiPost(action, fields = {}) {
  const token = await getToken();
  const body = new URLSearchParams({ action, token: token || '', ...fields });
  const res = await fetch(API_BASE, { method: 'POST', body });
  const data = await res.json();
  if (!res.ok || data.ok === false) throw new ApiError(data.error || 'Request failed', res.status, data);
  return data;
}

// POST with photos attached (multipart) - used only for push_entry.
// `photoUris` is an array of local file:// URIs.
export async function apiPostWithPhotos(action, fields, photoUris) {
  const token = await getToken();
  const form = new FormData();
  form.append('action', action);
  form.append('token', token || '');
  for (const [k, v] of Object.entries(fields)) {
    form.append(k, v == null ? '' : String(v));
  }
  photoUris.forEach((uri, idx) => {
    const filename = uri.split('/').pop() || `photo_${idx}.jpg`;
    form.append('photos[]', {
      uri,
      name: filename,
      type: 'image/jpeg',
    });
  });

  const res = await fetch(API_BASE, {
    method: 'POST',
    body: form,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const data = await res.json();
  if (!res.ok || data.ok === false) throw new ApiError(data.error || 'Request failed', res.status, data);
  return data;
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.status = status;
    this.payload = payload;
    // 409 = conflict (e.g. duplicate registration, entry not synced yet)
    this.isConflict = status === 409;
  }
}
