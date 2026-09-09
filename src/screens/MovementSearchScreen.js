import React, { useState, useCallback } from 'react';
import { View, TextInput, FlatList, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { getDb } from '../db/db';

// Movement operates on an existing submission (synced or still-pending),
// found by searching the reg_no across both the synced cache and the
// local offline queue - so "register then immediately check out" works
// in one offline session.
export default function MovementSearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const search = useCallback(async (q) => {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); return; }
    const db = await getDb();
    const like = `%${q.trim()}%`;

    const synced = await db.getAllAsync(
      `SELECT server_id as ref_id, 'synced' as source, reg_no, sname, brand, model, status
       FROM submissions_cache WHERE reg_no LIKE ? OR sname LIKE ? LIMIT 20`,
      [like, like]
    );
    const pending = await db.getAllAsync(
      `SELECT client_uuid as ref_id, 'pending' as source, reg_no, brand, model, 'pending_sync' as status
       FROM pending_entries WHERE reg_no LIKE ? AND sync_status != 'synced' LIMIT 20`,
      [like]
    );
    setResults([...pending, ...synced]);
  }, []);

  const pick = (item) => {
    navigation.navigate('MovementForm', { submission: item });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.helper}>Find the laptop by student reg. number or name</Text>
      <TextInput style={styles.input} placeholder="Search…" value={query} onChangeText={search} autoFocus />
      <FlatList
        data={results}
        keyExtractor={(item, idx) => `${item.source}-${item.ref_id}-${idx}`}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => pick(item)}>
            <Text style={styles.name}>{item.sname || item.reg_no} — {item.brand} {item.model}</Text>
            <Text style={styles.meta}>
              {item.reg_no} · {item.status}{item.source === 'pending' ? ' (not yet synced)' : ''}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={query.trim().length >= 2 ? <Text style={styles.empty}>No matches.</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  helper: { color: '#666', marginBottom: 10, fontSize: 13 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 13, color: '#777', marginTop: 2 },
  empty: { textAlign: 'center', color: '#999', marginTop: 30 },
});
