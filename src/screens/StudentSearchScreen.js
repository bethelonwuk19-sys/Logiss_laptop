import React, { useState, useCallback } from 'react';
import { View, TextInput, FlatList, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getDb } from '../db/db';

// Reused by Entry, Report, and CBT flows. Which screen it's serving is
// determined by the route name it was reached through (StudentSearch /
// ReportSearch / CbtSearch), not by passing a function through nav params
// (React Navigation params should stay serializable).
const DESTINATION_BY_ROUTE = {
  StudentSearch: 'EntryForm',
  ReportSearch: 'ReportForm',
  CbtSearch: 'CbtForm',
};

export default function StudentSearchScreen({ navigation, route }) {
  const destination = DESTINATION_BY_ROUTE[route.name] || 'EntryForm';
  const onPick = (student) => navigation.navigate(destination, { student });
  const helperText = route.params?.helperText || 'Search by registration number or name';

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const search = useCallback(async (q) => {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); return; }
    const db = await getDb();
    const like = `%${q.trim()}%`;
    const rows = await db.getAllAsync(
      `SELECT * FROM students
       WHERE reg_num LIKE ? OR lname LIKE ? OR fname LIKE ? OR mname LIKE ?
       ORDER BY lname LIMIT 30`,
      [like, like, like, like]
    );
    setResults(rows);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.helper}>{helperText}</Text>
      <TextInput
        style={styles.input}
        placeholder="Type reg. number or name…"
        value={query}
        onChangeText={search}
        autoFocus
      />
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => onPick(item)}>
            <Text style={styles.name}>{item.lname} {item.fname} {item.mname}</Text>
            <Text style={styles.meta}>{item.reg_num} · {item.admitted_class} · {item.gender}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          query.trim().length >= 2 ? <Text style={styles.empty}>No matches in the local roster.</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  helper: { color: '#666', marginBottom: 10, fontSize: 13 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  name: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 13, color: '#777', marginTop: 2 },
  empty: { textAlign: 'center', color: '#999', marginTop: 30 },
});
