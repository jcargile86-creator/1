import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Camera, useCameraDevice, useCameraFormat, useCameraPermission } from 'react-native-vision-camera';
import { File } from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Crypto from 'expo-crypto';
import { RootStackParamList } from '../navigation';
import { useInspections } from '../store/InspectionStore';
import { getFlow } from '../flows';
import { buildQueue, firstPendingIndex, isDone, nextSectionIndex } from '../flows/queue';
import { persistPhoto } from '../store/photos';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Camera'>;

type FlashMode = 'off' | 'auto' | 'on';

/** vision-camera returns bare paths; expo-file-system wants file:// URIs. */
const toFileUri = (p: string) => (p.startsWith('file://') ? p : `file://${p}`);

/** The 2–3 most likely ALDD condition terms for the shot being captioned. */
function suggestTerms(sectionId: string, promptId?: string): string[] {
  switch (sectionId) {
    case 'wind':
      return ['Potential Wind', 'Potential Mechanical'];
    case 'test-squares':
      return ['Potential Hail', 'Granule Loss'];
    case 'interior':
      return ['Potential Leak', 'Water Stain'];
    case 'roof-eave':
      return ['Potential Hail', 'No Potential Hail', 'Painted'];
    case 'roof-overview':
      return ['Potential Hail', 'Painted', 'Clean'];
    case 'elevations':
      return promptId === 'collateral'
        ? ['Clean', 'Spatter Present']
        : ['Potential Hail', 'Potential Wind', 'Potential Mechanical'];
    case 'wrapup':
      return ['Prior Repair', 'Potential Wind'];
    default:
      return ['Potential Hail', 'Potential Wind'];
  }
}

interface PendingPhoto {
  photoId: string;
  /** Null while the shot is still processing in the background. */
  uri: string | null;
  /** True when this was an "extra shot" — confirming keeps the same prompt. */
  stay: boolean;
}

/**
 * The guided camera. Shows the next shot's label at the top, captures,
 * pops a caption card after every shot (smart default = the prompt label,
 * editable, quick-term chips), and the Next arrow advances to the next
 * picture. Stays open until the inspector taps ✕.
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
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [{ photoResolution: 'max' }]);
  const isFocused = useIsFocused();
  // Flash OFF by default: 'auto' adds pre-flash metering lag to every shot.
  const [flash, setFlash] = useState<FlashMode>('off');
  const [lastThumb, setLastThumb] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPhoto | null>(null);
  const [caption, setCaption] = useState('');
  const cameraRef = useRef<Camera>(null);
  /** In-flight capture/save work — caption confirm/retake await this. */
  const captureTask = useRef<Promise<boolean> | null>(null);

  if (!inspection || !flow) return null;

  if (!hasPermission) {
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

  /** Shutter tap: the caption card opens INSTANTLY with the smart default;
   *  the photo is captured, processed, and saved in the background. */
  const capture = (stay: boolean) => {
    if (!cameraRef.current || !current || pending) return;
    const shot = current;
    const photoId = Crypto.randomUUID();
    const takenAt = new Date().toISOString();
    setCaption(shot.label);
    setPending({ photoId, uri: null, stay });
    // Instant preview: grab the live viewfinder frame (~ms) so the caption
    // card never waits on the full-resolution photo's disk write + decode.
    void (async () => {
      try {
        const snap = await cameraRef.current?.takeSnapshot({ quality: 70 });
        if (snap?.path) {
          const snapUri = toFileUri(snap.path);
          setPending((p) => (p && p.photoId === photoId && !p.uri ? { ...p, uri: snapUri } : p));
          setLastThumb(snapUri);
        }
      } catch {
        // full photo below becomes the preview fallback
      }
    })();
    captureTask.current = (async () => {
      try {
        const pic = await cameraRef.current?.takePhoto({ flash, enableShutterSound: false });
        if (!pic?.path) throw new Error('no photo');
        const uri = persistPhoto(toFileUri(pic.path), inspection.id, photoId);
        // Keep showing the lightweight snapshot; only use the full-res file
        // as preview if the snapshot failed.
        setPending((p) => (p && p.photoId === photoId && !p.uri ? { ...p, uri } : p));
        await updateInspection(inspection.id, (d) => {
          d.photos.push({
            id: photoId,
            uri,
            sectionId: shot.sectionId,
            promptId: shot.prompt.id,
            instance: shot.instance,
            caption: shot.label,
            takenAt,
          });
          delete d.skipped[shot.key];
        });
        return true;
      } catch (e) {
        setPending((p) => (p && p.photoId === photoId ? null : p));
        // Never lose a shot silently in the field — surface the real error.
        Alert.alert('Photo failed to save', String(e instanceof Error ? e.message : e));
        return false;
      }
    })();
  };

  /** Next arrow: advance immediately; the caption write catches up in the
   *  background once the capture task lands. */
  const confirmCaption = () => {
    if (!pending) return;
    const { photoId, stay } = pending;
    const finalCaption = caption.trim() || current?.label || 'Photo';
    const task = captureTask.current;
    setPending(null);
    setCaption('');
    if (!stay) advance();
    void (async () => {
      const ok = task ? await task : false;
      if (!ok) return;
      await updateInspection(inspection.id, (d) => {
        const ph = d.photos.find((p) => p.id === photoId);
        if (ph) ph.caption = finalCaption;
      });
    })();
  };

  /** Discard the shot and stay on the same prompt for a reshoot. */
  const retake = () => {
    if (!pending) return;
    const { photoId } = pending;
    const task = captureTask.current;
    setPending(null);
    setCaption('');
    setLastThumb(null);
    void (async () => {
      const ok = task ? await task : false;
      if (!ok) return;
      let uri: string | undefined;
      await updateInspection(inspection.id, (d) => {
        uri = d.photos.find((p) => p.id === photoId)?.uri;
        d.photos = d.photos.filter((p) => p.id !== photoId);
      });
      try {
        if (uri) new File(uri).delete();
      } catch {
        // file cleanup is best-effort
      }
    })();
  };

  const appendTerm = (term: string) => {
    setCaption((c) => {
      const base = c.trim();
      if (!base) return term;
      if (base.toLowerCase().includes(term.toLowerCase())) return base;
      return `${base} — ${term}`;
    });
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
      {device ? (
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          format={format}
          isActive={isFocused}
          photo
          video
          photoQualityBalance="speed"
          enableZoomGesture
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color={colors.white} />
        </View>
      )}

      {/* Top overlay: what to shoot next */}
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <View style={styles.topRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.closeBtn} hitSlop={12}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
          <Text style={styles.counter}>{Math.min(index + 1, queue.length)}/{queue.length} · {doneCount} done</Text>
          <Pressable onPress={() => setFlash((f) => (f === 'off' ? 'auto' : f === 'auto' ? 'on' : 'off'))} hitSlop={12}>
            <Text style={styles.flashText}>{flash === 'on' ? 'FLASH ON' : flash === 'auto' ? 'FLASH AUTO' : 'FLASH OFF'}</Text>
          </Pressable>
        </View>
        {finished ? (
          <Text style={styles.label}>All prompts covered — add extra shots or exit</Text>
        ) : (
          <>
            <View style={styles.tagRow}>
              <Text style={styles.sectionTag}>{current.sectionTitle}{current.instance ? ` · ${current.instance}` : ''}{isDone(inspection, current.key) ? ' · ✓ captured' : ''}</Text>
              {!current.prompt.optional && (
                <View style={[styles.badge, styles.badgeRequired]}>
                  <Text style={styles.badgeText}>REQUIRED</Text>
                </View>
              )}
            </View>
            <Text style={styles.label}>{current.label}</Text>
            {current.prompt.hint ? <Text style={styles.hint}>{current.prompt.hint}</Text> : null}
          </>
        )}
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.bottomRow}>
          <Pressable onPress={() => setIndex((i) => Math.max(0, i - 1))} style={styles.sideBtn} hitSlop={10}>
            <Text style={styles.sideText}>‹ Back</Text>
          </Pressable>

          <Pressable onPress={() => capture(false)} style={styles.shutter} disabled={finished || !!pending}>
            <View style={styles.shutterInner} />
          </Pressable>

          <Pressable onPress={skip} style={styles.sideBtn} hitSlop={10} disabled={finished}>
            <Text style={styles.sideText}>Skip ›</Text>
          </Pressable>
        </View>
        <View style={styles.bottomRow2}>
          {lastThumb ? <Image source={{ uri: lastThumb }} style={styles.lastThumb} /> : <View style={styles.lastThumb} />}
          <Pressable onPress={() => capture(true)} style={styles.extraBtn} disabled={finished || !!pending}>
            <Text style={styles.extraText}>Extra shot</Text>
          </Pressable>
          <Pressable onPress={skipSection} style={styles.extraBtn} disabled={finished}>
            <Text style={styles.extraText}>N/A Section</Text>
          </Pressable>
        </View>
      </View>

      {/* Caption review — full-screen photo with a slim caption bar. The
          keyboard only appears when the inspector taps the caption. */}
      {pending && (
        <View style={styles.captionOverlay}>
          {pending.uri ? (
            <Image source={{ uri: pending.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={styles.captionLoading}>
              <ActivityIndicator color={colors.white} size="large" />
            </View>
          )}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.captionBottomWrap}
            pointerEvents="box-none"
          >
            <View style={[styles.captionBar, { paddingBottom: insets.bottom + spacing.sm }]}>
              <TextInput
                style={styles.captionInput}
                value={caption}
                onChangeText={setCaption}
                multiline
                placeholder="Photo caption"
                placeholderTextColor="#9aa"
              />
              <View style={styles.chipsWrap}>
                {current && suggestTerms(current.sectionId, current.prompt.id).map((t) => (
                  <Pressable key={t} style={styles.chip} onPress={() => appendTerm(t)}>
                    <Text style={styles.chipText}>+ {t}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.captionActions}>
                <Pressable style={styles.retakeBtn} onPress={retake}>
                  <Text style={styles.retakeText}>Retake</Text>
                </Pressable>
                <Pressable style={styles.nextBtn} onPress={confirmCaption}>
                  <Text style={styles.nextText}>{pending.stay ? 'Done →' : 'Next →'}</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
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
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  label: { color: colors.white, fontSize: 22, fontWeight: '800', marginTop: 2 },
  hint: { color: '#d5d8f2', fontSize: 13, marginTop: 4 },
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
  captionOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  captionLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  captionBottomWrap: { flex: 1, justifyContent: 'flex-end' },
  captionBar: { backgroundColor: 'rgba(12,14,36,0.88)', paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  captionInput: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    maxHeight: 84,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.xs + 2 },
  chip: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  captionActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  retakeBtn: { flex: 1, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 12, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  retakeText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  nextBtn: { flex: 2, backgroundColor: colors.red, borderRadius: 12, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  nextText: { color: colors.white, fontSize: 19, fontWeight: '800' },
});
