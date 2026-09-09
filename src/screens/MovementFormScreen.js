import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { getDb } from '../db/db';
import { uuid } from '../utils/uuid';

const ACTIONS = [
  { key: 'checkin', label: 'Check In', needsReason: false },
  { key: 'checkout', label: 'Check Out', needsReason: true },
  { key: 'return', label: 'Return', needsReason: false },
];

export default function MovementFormScreen({ route, navigation }) {
  const { submission } = route.params;
  const [action, setAction] = useState('checkin');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const chosen = ACTIONS.find((a) => a.key === action);
    if (chosen.needsReason && !reason.trim()) {
      Alert.alert('Reason required', 'Check-out needs a reason.');
      return;
    }
    setSaving(true);
    try {
      const db = await getDb();
      const clientUuid = uuid();
      await db.runAsync(
        `INSERT INTO pending_movements
          (client_uuid, sub_action, submission_server_id, submission_client_uuid, note, reason, performed_at)
         VALUES (?,?,?,?,?,?,?)`,
        [
          clientUuid,
          action,
          submission.source === 'synced' ? submission.ref_id : null,
          submission.source === 'pending' ? submission.ref_id : null,
          note, reason, new Date().toISOString(),
        ]
      );
      setSaving(false);
      Alert.alert('Saved offline', 'Queued. Tap Sync on the home screen when online.', [
        { text: 'OK', onPress: () => navigation.navigate('Home') },
      ]);
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', e.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>{submission.reg_no} — {submission.brand} {submission.model}</Text>
      {submission.source === 'pending' && (
        <Text style={styles.warn}>Note: this registration hasn't synced yet. This movement will sync right after it.</Text>
      )}

      <Text style={styles.sectionLabel}>Action</Text>
      <View style={styles.actionRow}>
        {ACTIONS.map((a) => (
          <TouchableOpacity
            key={a.key}
            style={[styles.actionBtn, action === a.key && styles.actionBtnActive]}
            onPress={() => setAction(a.key)}
          >
            <Text style={[styles.actionText, action === a.key && styles.actionTextActive]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {action === 'checkout' && (
        <View style={{ marginTop: 12 }}>
          <Text style={styles.fieldLabel}>Reason for check-out</Text>
          <TextInput style={styles.input} value={reason} onChangeText={setReason} multiline />
        </View>
      )}

      <View style={{ marginTop: 12 }}>
        <Text style={styles.fieldLabel}>Note (optional)</Text>
        <TextInput style={styles.input} value={note} onChangeText={setNote} multiline />
      </View>

      <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={saving}>
        <Text style={styles.submitText}>{saving ? 'Saving…' : 'Save (Offline)'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  warn: { color: '#a06a00', fontSize: 13, marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#444', marginTop: 8, marginBottom: 6 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, alignItems: 'center' },
  actionBtnActive: { backgroundColor: '#1a3c6e', borderColor: '#1a3c6e' },
  actionText: { color: '#333', fontWeight: '600', fontSize: 13 },
  actionTextActive: { color: '#fff' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 15, minHeight: 44 },
  submitBtn: { backgroundColor: '#1a3c6e', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 40 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
