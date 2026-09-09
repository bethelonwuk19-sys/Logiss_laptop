import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { apiGet, isOnline } from '../api/client';
import { getMeta, setMeta } from '../db/db';

// Deliberately unhurried: downloads a page of laptop photos, waits briefly,
// downloads the next page. Meant to run in the background over many app
// sessions without hogging bandwidth or blocking anything else - exactly
// what was asked for ("don't stress yourself... take your time").
const PHOTO_DIR = FileSystem.documentDirectory + 'downloaded_photos/';
const PAUSE_MS = 400;

export default function PhotoDownloadScreen() {
  const [running, setRunning] = useState(false);
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState('');
  const stopRef = useRef(false);

  const start = async () => {
    if (!(await isOnline())) {
      Alert.alert('No internet', 'Connect to the internet to download photos.');
      return;
    }
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true }).catch(() => {});
    stopRef.current = false;
    setRunning(true);
    setCount(0);
    try {
      await downloadProfilePhotos();
      await downloadLaptopPhotos();
      setStatus('All available photos downloaded.');
    } catch (e) {
      setStatus(`Stopped: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const stop = () => { stopRef.current = true; };

  const downloadProfilePhotos = async () => {
    setStatus('Fetching profile photo list…');
    const data = await apiGet('list_profile_photos');
    for (const p of data.profile_photos) {
      if (stopRef.current) return;
      const dest = PHOTO_DIR + 'profile_' + p.filename;
      const info = await FileSystem.getInfoAsync(dest);
      if (!info.exists) {
        setStatus(`Downloading ${p.reg_num}…`);
        await FileSystem.downloadAsync(p.url, dest).catch(() => {});
        setCount((c) => c + 1);
        await sleep(PAUSE_MS);
      }
    }
  };

  const downloadLaptopPhotos = async () => {
    let sinceId = parseInt((await getMeta('photo_download_since_id')) || '0', 10);
    let hasMore = true;
    while (hasMore && !stopRef.current) {
      setStatus(`Fetching laptop photo list (after #${sinceId})…`);
      const data = await apiGet('list_photos', { since_id: String(sinceId) });
      for (const p of data.photos) {
        if (stopRef.current) return;
        const dest = PHOTO_DIR + p.filename;
        const info = await FileSystem.getInfoAsync(dest);
        if (!info.exists) {
          setStatus(`Downloading ${p.filename}…`);
          await FileSystem.downloadAsync(p.url, dest).catch(() => {});
          setCount((c) => c + 1);
          await sleep(PAUSE_MS);
        }
        sinceId = p.id;
        await setMeta('photo_download_since_id', String(sinceId));
      }
      hasMore = data.has_more;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Download existing photos</Text>
      <Text style={styles.desc}>
        Slowly downloads every student profile photo and laptop registration photo already on the server, so
        they're on the phone even without internet. Safe to stop anytime — it resumes where it left off.
      </Text>

      <Text style={styles.count}>{count} photo(s) downloaded this run</Text>
      {!!status && <Text style={styles.status}>{status}</Text>}

      {running ? (
        <View style={{ alignItems: 'center', marginTop: 20 }}>
          <ActivityIndicator />
          <TouchableOpacity style={styles.stopBtn} onPress={stop}>
            <Text style={styles.stopText}>Stop</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.startBtn} onPress={start}>
          <Text style={styles.startText}>Start Download</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  desc: { fontSize: 13, color: '#666', marginBottom: 20, lineHeight: 19 },
  count: { fontSize: 14, fontWeight: '600' },
  status: { fontSize: 13, color: '#888', marginTop: 4 },
  startBtn: { backgroundColor: '#1a3c6e', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 20 },
  startText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  stopBtn: { backgroundColor: '#b00', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 16, paddingHorizontal: 30 },
  stopText: { color: '#fff', fontWeight: '700' },
});
