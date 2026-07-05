import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, ActivityIndicator, Image, Alert } from 'react-native';
import { CameraView, useCameraPermissions, FlashMode } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Crypto from 'expo-crypto';
import { RootStackParamList } from '../navigation';
import { useInspections } from '../store/InspectionStore';
import { getFlow } from '../flows';
import { buildQueue, firstPendingIndex, isDone, nextSectionIndex } from '../flows/queue';
import { persistPhoto } from '../store/photos';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Camera'>;

/**
 * The guided camera. Shows the next shot's label at the top, captures,
 * auto-advances, and stays open until the inspector taps ✕.
 */
export default function CameraScreen({ route, navigation }: Props) {
  const { id, sectionId, instance, startKey } = route.params;
  const { getInspection, updateInspection } = useInspections();
  const insets = useSafeAreaInsets();
  const inspection = getInspection(id);
  const flow = inspection ? getFlow(inspection.flowId) : undefined;

  const queue = useMemo(
    () => (inspection && flow ? buildQueue(flow, inspection, sectionId, instance) : []),
    [flow, inspection?.instances, sectionId, instance],
  );

  const initialIndex = useMemo(() => {
    if (!inspection) return 0;
    if (startKey) {
      const i = queue.findIndex((q) => q.key === startKey);
      if (i !== -1) return i;
    }
    return firstPendingIndex(queue, inspection);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [index, setIndex] = useState(initialIndex);
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState<FlashMode>('auto');
  const [detail, setDetail] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastThumb, setLastThumb] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  if (!inspection || !flow) return null;

  if (!permission?.granted) {
    return (
      <View style={styles.permWrap}>
        <Text style={styles.permText}>InspectPro needs camera access to run guided capture.</Text>
        <Pressable style={styles.permBtn} onPress={() => void requestPermission()}>
          <Text style={styles.permBtnText}>Grant Camera Access</Text>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.grayText }}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  const current = queue[index];
  const finished = !current;
  const doneCount = queue.filter((q) => isDone(inspection, q.key)).length;

  const advance = () => setIndex((i) => Math.min(i + 1, queue.length));

  const capture = async (stay: boolean) => {
    if (!cameraRef.current || busy || !current) return;
    setBusy(true);
    try {
      const pic = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (!pic?.uri) return;
      const photoId = Crypto.randomUUID();
      const uri = persistPhoto(pic.uri, inspection.id, photoId);
      const caption = detail.trim() ? `${current.label} — ${detail.trim()}` : current.label;
      await updateInspection(inspection.id, (d) => {
        d.photos.push({
          id: photoId,
          uri,
          sectionId: current.sectionId,
          promptId: current.prompt.id,
          instance: current.instance,
          caption,
          takenAt: new Date().toISOString(),
        });
        delete d.skipped[current.key];
      });
      setLastThumb(uri);
      setDetail('');
      setShowDetail(false);
      if (!stay) advance();
    } finally {
      setBusy(false);
    }
  };

  const skip = () => {
    if (!current) return;
    void updateInspection(inspection.id, (d) => {
      d.skipped[current.key] = true;
    });
    advance();
  };

  /** One-tap category skip: mark the current section N/A and jump past it. */
  const skipSection = () => {
    if (!current) return;
    Alert.alert(`Skip "${current.sectionTitle}"?`, 'Marks the whole section Not Applicable. You can restore it from the section menu.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Skip Section',
        style: 'destructive',
        onPress: () => {
          void updateInspection(inspection.id, (d) => {
            d.sectionSkipped[current.sectionId] = true;
          });
          const next = nextSectionIndex(queue, index);
          if (next >= queue.length && sectionId) navigation.goBack();
          else setIndex(next);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} flash={flash} facing="back" />

      {/* Top overlay: what to shoot next */}
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <View style={styles.topRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.closeBtn} hitSlop={12}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
          <Text style={styles.counter}>{Math.min(index + 1, queue.length)}/{queue.length} · {doneCount} done</Text>
          <Pressable onPress={() => setFlash((f) => (f === 'off' ? 'auto' : f === 'auto' ? 'on' : 'off'))} hitSlop={12}>
            <Text style={styles.flashText}>{flash === 'on' ? '⚡︎ ON' : flash === 'auto' ? '⚡︎ AUTO' : '⚡︎ OFF'}</Text>
          </Pressable>
        </View>
        {finished ? (
          <Text style={styles.label}>✅ All prompts covered — add extra shots or exit</Text>
        ) : (
          <>
            <View style={styles.tagRow}>
              <Text style={styles.sectionTag}>{current.sectionTitle}{current.instance ? ` · ${current.instance}` : ''}{isDone(inspection, current.key) ? ' · ✓ captured' : ''}</Text>
              <View style={[styles.badge, current.prompt.optional ? styles.badgeOptional : styles.badgeRequired]}>
                <Text style={styles.badgeText}>{current.prompt.optional ? 'OPTIONAL — SKIP IF N/A' : 'REQUIRED'}</Text>
              </View>
            </View>
            <Text style={styles.label}>{current.label}</Text>
            {current.prompt.hint ? <Text style={styles.hint}>{current.prompt.hint}</Text> : null}
          </>
        )}
      </View>

      {/* Detail/caption input */}
      {showDetail && current && (
        <View style={[styles.detailWrap, { bottom: insets.bottom + 150 }]}>
          <TextInput
            style={styles.detailInput}
            placeholder='Add detail to caption: measurement, adjective… e.g. potential hail 1.25"'
            placeholderTextColor="#aab"
            value={detail}
            onChangeText={setDetail}
            autoFocus
          />
        </View>
      )}

      {/* Bottom controls */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.bottomRow}>
          <Pressable onPress={() => setIndex((i) => Math.max(0, i - 1))} style={styles.sideBtn} hitSlop={10}>
            <Text style={styles.sideText}>‹ Back</Text>
          </Pressable>

          <Pressable onPress={() => void capture(false)} style={styles.shutter} disabled={busy || finished}>
            {busy ? <ActivityIndicator color={colors.navy} /> : <View style={styles.shutterInner} />}
          </Pressable>

          <Pressable onPress={skip} style={styles.sideBtn} hitSlop={10} disabled={finished}>
            <Text style={styles.sideText}>Skip ›</Text>
          </Pressable>
        </View>
        <View style={styles.bottomRow2}>
          {lastThumb ? <Image source={{ uri: lastThumb }} style={styles.lastThumb} /> : <View style={styles.lastThumb} />}
          <Pressable onPress={() => void capture(true)} style={styles.extraBtn} disabled={busy || finished}>
            <Text style={styles.extraText}>＋ Extra shot</Text>
          </Pressable>
          <Pressable onPress={() => setShowDetail((s) => !s)} style={[styles.extraBtn, showDetail && { backgroundColor: colors.red }]}>
            <Text style={styles.extraText}>✏️ Detail</Text>
          </Pressable>
          <Pressable onPress={skipSection} style={styles.extraBtn} disabled={finished}>
            <Text style={styles.extraText}>⏭ N/A Section</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.offWhite },
  permText: { fontSize: 17, color: colors.ink, textAlign: 'center', marginBottom: spacing.md },
  permBtn: { backgroundColor: colors.navy, borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  permBtnText: { color: colors.white, fontWeight: '800', fontSize: 16 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(20,23,55,0.82)', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.white, fontSize: 24, fontWeight: '700' },
  counter: { color: '#c6c9e8', fontSize: 13, fontWeight: '700' },
  flashText: { color: '#ffd54f', fontSize: 13, fontWeight: '800' },
  tagRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  sectionTag: { color: '#9fa5d6', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 1 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeRequired: { backgroundColor: colors.red },
  badgeOptional: { backgroundColor: 'rgba(255,255,255,0.22)' },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  label: { color: colors.white, fontSize: 22, fontWeight: '800', marginTop: 2 },
  hint: { color: '#d5d8f2', fontSize: 13, marginTop: 4 },
  detailWrap: { position: 'absolute', left: spacing.md, right: spacing.md },
  detailInput: { backgroundColor: 'rgba(20,23,55,0.92)', color: colors.white, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(20,23,55,0.82)', paddingTop: spacing.sm, paddingHorizontal: spacing.md },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bottomRow2: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  sideBtn: { minWidth: 80, alignItems: 'center', paddingVertical: spacing.sm },
  sideText: { color: colors.white, fontSize: 17, fontWeight: '700' },
  shutter: { width: 78, height: 78, borderRadius: 39, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, borderWidth: 3, borderColor: colors.navy, backgroundColor: colors.white },
  lastThumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)' },
  extraBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  extraText: { color: colors.white, fontSize: 14, fontWeight: '700' },
});
