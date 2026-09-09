import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { getDb } from '../db/db';
import PhotoCapture from '../components/PhotoCapture';
import { uuid } from '../utils/uuid';

export default function EntryFormScreen({ route, navigation }) {
  const { student } = route.params;

  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');
  const [color, setColor] = useState('');
  const [ram, setRam] = useState('');
  const [processor, setProcessor] = useState('');
  const [storage, setStorage] = useState('');
  const [condition, setCondition] = useState('Good');
  const [laptopPassword, setLaptopPassword] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (photos.length === 0) {
      Alert.alert('Photo required', 'Take at least one photo of the student with their laptop.');
      return;
    }
    setSaving(true);
    try {
      const db = await getDb();

      // Offline duplicate check: is there already an open (non-returned)
      // registration for this student, either already synced or still
      // waiting in the local queue? This mirrors the server's own check,
      // done here so staff get an immediate warning without needing
      // internet - the server re-checks again at sync time regardless.
      const openCached = await db.getFirstAsync(
        `SELECT server_id FROM submissions_cache WHERE reg_no = ? AND status NOT IN ('returned','checked_out')`,
        [student.reg_num]
      );
      const openPending = await db.getFirstAsync(
        `SELECT client_uuid FROM pending_entries WHERE reg_no = ? AND sync_status != 'error'`,
        [student.reg_num]
      );
      if (openCached || openPending) {
        Alert.alert(
          'Already registered',
          `${student.lname} ${student.fname} already has an open laptop registration. Submitting again may be flagged as a duplicate when you sync.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Submit anyway', onPress: () => saveEntry(db) },
          ]
        );
        setSaving(false);
        return;
      }

      await saveEntry(db);
    } catch (e) {
      Alert.alert('Could not save', e.message);
      setSaving(false);
    }
  };

  const saveEntry = async (db) => {
    const clientUuid = uuid();
    const now = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO pending_entries
        (client_uuid, reg_no, brand, model, serial_number, color, ram_gb, processor, storage,
         condition_on_submit, laptop_password, notes, submitted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [clientUuid, student.reg_num, brand, model, serial, color, ram, processor, storage,
       condition, laptopPassword, notes, now]
    );
    for (const uri of photos) {
      await db.runAsync(
        `INSERT INTO pending_entry_photos (entry_client_uuid, local_uri) VALUES (?, ?)`,
        [clientUuid, uri]
      );
    }

    setSaving(false);
    Alert.alert(
      'Saved offline',
      'This registration is queued. Tap Sync on the home screen once you have internet.',
      [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.studentBanner}>
        <Text style={styles.studentName}>{student.lname} {student.fname} {student.mname}</Text>
        <Text style={styles.studentMeta}>{student.reg_num} · {student.admitted_class}</Text>
      </View>

      <Field label="Brand" value={brand} onChangeText={setBrand} placeholder="e.g. HP, Dell, Lenovo" />
      <Field label="Model" value={model} onChangeText={setModel} />
      <Field label="Serial Number" value={serial} onChangeText={setSerial} autoCapitalize="characters" />
      <Field label="Color" value={color} onChangeText={setColor} />
      <Field label="RAM (GB)" value={ram} onChangeText={setRam} keyboardType="numeric" />
      <Field label="Processor" value={processor} onChangeText={setProcessor} />
      <Field label="Storage" value={storage} onChangeText={setStorage} placeholder="e.g. 256GB SSD" />
      <Field label="Condition on submission" value={condition} onChangeText={setCondition} />
      <Field label="Laptop login password (if any)" value={laptopPassword} onChangeText={setLaptopPassword} />
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline />

      <PhotoCapture photos={photos} onChange={setPhotos} label="Student & laptop photos" />

      <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={saving}>
        <Text style={styles.submitText}>{saving ? 'Saving…' : 'Save Registration (Offline)'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  studentBanner: { backgroundColor: '#f0f4fa', borderRadius: 10, padding: 14, marginBottom: 16 },
  studentName: { fontSize: 17, fontWeight: '700' },
  studentMeta: { fontSize: 13, color: '#666', marginTop: 2 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 15 },
  submitBtn: { backgroundColor: '#1a3c6e', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 40 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
