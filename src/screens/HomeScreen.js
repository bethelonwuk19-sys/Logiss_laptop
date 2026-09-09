import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getPendingCounts } from '../api/sync';
import { runFullSync } from '../api/sync';
import { isOnline } from '../api/client';

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [pending, setPending] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState('');

  const refresh = useCallback(async () => {
    setPending(await getPendingCounts());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleSync = async () => {
    if (!(await isOnline())) {
      Alert.alert('No internet', 'Connect to the internet, then tap Sync again.');
      return;
    }
    setSyncing(true);
    try {
      const summary = await runFullSync(setSyncStep);
      const total = Object.values(summary).reduce((a, [ok]) => a + ok, 0);
      const failed = Object.values(summary).reduce((a, [, f]) => a + f, 0);
      Alert.alert(
        'Sync complete',
        failed > 0
          ? `${total} item(s) synced. ${failed} still pending (will retry next sync — check the Sync Details screen for why).`
          : `${total} item(s) synced successfully.`
      );
    } catch (e) {
      Alert.alert('Sync failed', e.message);
    } finally {
      setSyncing(false);
      setSyncStep('');
      refresh();
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.greeting}>Hi, {user?.full_name || user?.username}</Text>
      <Text style={styles.role}>{user?.role}</Text>

      <TouchableOpacity style={styles.syncButton} onPress={handleSync} disabled={syncing}>
        {syncing ? (
          <View style={{ alignItems: 'center' }}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.syncButtonText}>{syncStep || 'Syncing…'}</Text>
          </View>
        ) : (
          <Text style={styles.syncButtonText}>
            {pending?.total ? `Sync now (${pending.total} waiting)` : 'Sync now (up to date)'}
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.grid}>
        <MenuCard title="Register Laptop" subtitle="Search student, photos, submit" onPress={() => navigation.navigate('StudentSearch')} badge={pending?.pending_entries} />
        <MenuCard title="Movement" subtitle="Check-in / check-out / return" onPress={() => navigation.navigate('MovementSearch')} badge={pending?.pending_movements} />
        <MenuCard title="Reports" subtitle="File a laptop report" onPress={() => navigation.navigate('ReportSearch')} badge={pending?.pending_reports} />
        <MenuCard title="CBT Codes" subtitle="Generate exam codes" onPress={() => navigation.navigate('CbtSearch')} badge={pending?.pending_cbt} />
      </View>

      <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('SyncDetails')}>
        <Text style={styles.linkText}>Sync details / errors</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('PhotoDownload')}>
        <Text style={styles.linkText}>Download existing photos</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkRow} onPress={logout}>
        <Text style={[styles.linkText, { color: '#b00' }]}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function MenuCard({ title, subtitle, onPress, badge }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      {!!badge && (
        <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>
      )}
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },
  greeting: { fontSize: 22, fontWeight: '700' },
  role: { color: '#666', marginBottom: 20, textTransform: 'capitalize' },
  syncButton: {
    backgroundColor: '#1a3c6e', borderRadius: 10, padding: 18,
    alignItems: 'center', marginBottom: 24,
  },
  syncButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    width: '48%', backgroundColor: '#fff', borderRadius: 10, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: '#e5e5e5',
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSubtitle: { fontSize: 12, color: '#777', marginTop: 4 },
  badge: {
    position: 'absolute', top: 10, right: 10, backgroundColor: '#e0a800',
    borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  linkRow: { paddingVertical: 12 },
  linkText: { color: '#1a3c6e', fontSize: 14, fontWeight: '600' },
});
