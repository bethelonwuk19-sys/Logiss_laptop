import React, { useRef, useState } from 'react';
import { View, TouchableOpacity, Text, Image, StyleSheet, Modal, ScrollView, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';

const MAX_PHOTOS = 5;

// Controlled component: `photos` is an array of local file:// URIs,
// `onChange` is called with the updated array. Keeps captured photos in
// the parent's state so the caller decides when/how to persist them.
export default function PhotoCapture({ photos, onChange, label = 'Photos' }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOpen, setCameraOpen] = useState(false);
  const cameraRef = useRef(null);

  const openCamera = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Camera permission needed', 'LOGISS needs camera access to photograph the student and laptop.');
        return;
      }
    }
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Photo limit reached', `Up to ${MAX_PHOTOS} photos per registration.`);
      return;
    }
    setCameraOpen(true);
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
    // Move it out of the camera's temp cache into permanent app storage so
    // it survives even if the app is killed before syncing.
    const destDir = FileSystem.documentDirectory + 'logiss_photos/';
    await FileSystem.makeDirectoryAsync(destDir, { intermediates: true }).catch(() => {});
    const destUri = destDir + `photo_${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: photo.uri, to: destUri });
    onChange([...photos, destUri]);
    setCameraOpen(false);
  };

  const removePhoto = (uri) => {
    onChange(photos.filter((p) => p !== uri));
  };

  return (
    <View>
      <Text style={styles.label}>{label} ({photos.length}/{MAX_PHOTOS})</Text>
      <ScrollView horizontal style={styles.row}>
        {photos.map((uri) => (
          <View key={uri} style={styles.thumbWrap}>
            <Image source={{ uri }} style={styles.thumb} />
            <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(uri)}>
              <Text style={styles.removeText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
        {photos.length < MAX_PHOTOS && (
          <TouchableOpacity style={styles.addBtn} onPress={openCamera}>
            <Text style={styles.addBtnText}>+ Photo</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={cameraOpen} animationType="slide">
        <View style={{ flex: 1 }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setCameraOpen(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shutterBtn} onPress={takePicture} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 12 },
  row: { flexDirection: 'row' },
  thumbWrap: { marginRight: 10, position: 'relative' },
  thumb: { width: 70, height: 70, borderRadius: 8 },
  removeBtn: {
    position: 'absolute', top: -6, right: -6, backgroundColor: '#b00',
    width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  removeText: { color: '#fff', fontWeight: '700', lineHeight: 18 },
  addBtn: {
    width: 70, height: 70, borderRadius: 8, borderWidth: 1, borderColor: '#ccc',
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { fontSize: 11, color: '#666', textAlign: 'center' },
  cameraControls: {
    position: 'absolute', bottom: 30, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
  },
  shutterBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#fff', borderWidth: 4, borderColor: '#ccc' },
  cancelBtn: { padding: 12 },
  cancelText: { color: '#fff', fontSize: 16 },
});
