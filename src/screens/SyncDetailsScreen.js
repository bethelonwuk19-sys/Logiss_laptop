import React, { useCallback, useState } from 'react';
import { View, Text, SectionList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDb } from '../db/db';

const TABLES = [
  { key: 'pending_entries', title: 'Laptop Registrations', label: (r) => `${r.reg_no} — ${r.brand || ''} ${r.model || ''}` },
  { key: 'pending_movements', title: 'Movements', label: (r) => `${r.sub_action}` },
  { key: 'pending_reports', title: 'Reports', label: (r) => r.title },
  { key: 'pending_observations', title: 'Behaviour Notes', label: (r) => `${r.reg_no} — ${r.obs_type}` },
  { key: 'pending_cbt', title: 'CBT Codes', label: (r) => `${r.reg_no} — ${r.session_name}` },
];

export default function SyncDetailsScreen() {
  const [sections, setSections] = useState([]);

  const load = useCallback(async () => {
    const db = await getDb();
    const built = [];
    for (const t of TABLES) {
      const rows = await db.getAllAsync(
        `SELECT * FROM ${t.key} WHERE sync_status != 'synced' ORDER BY created_at DESC`
      );
      if (rows.length) {
        built.push({ title: t.title, data: rows.map((r) => ({ ...r, _label: t.label(r) })) });
      }
    }
    setSections(built);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SectionList
      style={styles.container}
      sections={sections}
      keyExtractor={(item) => item.client_uuid}
      renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.label}>{item._label}</Text>
          <Text style={[styles.status, item.sync_status === 'error' && styles.statusError]}>
            {item.sync_status === 'error' ? `Error: ${item.error_message}` : 'Waiting to sync'}
          </Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>Nothing pending — everything is synced.</Text>}
      contentContainerStyle={{ padding: 16 }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  sectionHeader: { fontSize: 14, fontWeight: '700', marginTop: 16, marginBottom: 6, color: '#1a3c6e' },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  label: { fontSize: 14, fontWeight: '600' },
  status: { fontSize: 12, color: '#888', marginTop: 2 },
  statusError: { color: '#b00' },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
});
