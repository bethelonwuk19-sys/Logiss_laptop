import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { getDb } from '../db/db';
import { uuid } from '../utils/uuid';

const CATEGORIES = ['hardware', 'software', 'conduct', 'other'];
const SEVERITIES = ['low', 'medium', 'high'];

export default function ReportFormScreen({ route, navigation }) {
  const { student } = route.params;
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('hardware');
  const [severity, setSeverity] = useState('medium');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Missing info', 'Title and description are required.');
      return;
    }
    setSaving(true);
    try {
      const db = await getDb();
      await db.runAsync(
        `INSERT INTO pending_reports (client_uuid, reg_no, title, category, severity, description, filed_for)
         VALUES (?,?,?,?,?,?,?)`,
        [uuid(), student.reg_num, title.trim(), category, severity, description.trim(), 'student']
      );
      setSaving(false);
      Alert.alert('Saved offline', 'Queued. Tap Sync when online.', [
        { text: 'OK', onPress: () => navigation.navigate('Home') },
      ]);
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', e.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.studentBanner}>
        <Text style={styles.studentName}>{student.lname} {student.fname}</Text>
        <Text style={styles.studentMeta}>{student.reg_num} · {student.admitted_class}</Text>
      </View>

      <Text style={styles.fieldLabel}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} />

      <Text style={styles.fieldLabel}>Category</Text>
      <ChoiceRow options={CATEGORIES} value={category} onChange={setCategory} />

      <Text style={styles.fieldLabel}>Severity</Text>
      <ChoiceRow options={SEVERITIES} value={severity} onChange={setSeverity} />

      <Text style={styles.fieldLabel}>Description</Text>
      <TextInput style={[styles.input, { minHeight: 90 }]} value={description} onChangeText={setDescription} multiline />

      <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={saving}>
        <Text style={styles.submitText}>{saving ? 'Saving…' : 'File Report (Offline)'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function ChoiceRow({ options, value, onChange }) {
  return (
    <View style={styles.choiceRow}>
      {options.map((o) => (
        <TouchableOpacity key={o} style={[styles.choice, value === o && styles.choiceActive]} onPress={() => onChange(o)}>
          <Text style={[styles.choiceText, value === o && styles.choiceTextActive]}>{o}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  studentBanner: { backgroundColor: '#f0f4fa', borderRadius: 10, padding: 14, marginBottom: 16 },
  studentName: { fontSize: 17, fontWeight: '700' },
  studentMeta: { fontSize: 13, color: '#666', marginTop: 2 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 15 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderWidth: 1, borderColor: '#ccc', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
  choiceActive: { backgroundColor: '#1a3c6e', borderColor: '#1a3c6e' },
  choiceText: { fontSize: 13, color: '#333', textTransform: 'capitalize' },
  choiceTextActive: { color: '#fff' },
  submitBtn: { backgroundColor: '#1a3c6e', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 40 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
