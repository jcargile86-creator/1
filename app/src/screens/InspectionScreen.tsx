import React, { useLayoutEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { useInspections } from '../store/InspectionStore';
import { getFlow } from '../flows';
import { sectionProgress, buildQueue, firstPendingIndex } from '../flows/queue';
import { generateReport } from '../report/generate';
import { colors, spacing, touch } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Inspection'>;

export default function InspectionScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { getInspection, updateInspection } = useInspections();
  const inspection = getInspection(id);
  const [busy, setBusy] = useState(false);

  const toggleSectionNa = (sectionId: string, title: string, currentlyNa: boolean) => {
    if (currentlyNa) {
      void updateInspection(id, (d) => {
        delete d.sectionSkipped[sectionId];
      });
      return;
    }
    Alert.alert(`Skip "${title}"?`, 'The whole section will be marked Not Applicable and left out of guided capture. You can restore it anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark N/A',
        style: 'destructive',
        onPress: () =>
          void updateInspection(id, (d) => {
            d.sectionSkipped[sectionId] = true;
          }),
      },
    ]);
  };

  useLayoutEffect(() => {
    navigation.setOptions({ title: inspection ? `Claim ${inspection.claim.claimNumber || '—'}` : 'Inspection' });
  }, [navigation, inspection]);

  if (!inspection) {
    return (
      <View style={styles.center}>
        <Text>Inspection not found.</Text>
      </View>
    );
  }

  const flow = getFlow(inspection.flowId);

  const resumeCapture = () => {
    const queue = buildQueue(flow, inspection);
    const idx = firstPendingIndex(queue, inspection);
    navigation.navigate('Camera', { id, startKey: queue[idx]?.key });
  };

  const makeReport = async () => {
    setBusy(true);
    try {
      await generateReport(inspection, flow);
    } catch (e) {
      Alert.alert('Report failed', String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}>
      <Pressable style={styles.resumeBtn} onPress={resumeCapture}>
        <Text style={styles.resumeText}>📷 Resume Guided Capture</Text>
        <Text style={styles.resumeSub}>Opens the camera at the next needed photo</Text>
      </Pressable>

      <Text style={styles.groupLabel}>Sections — tap to start anywhere</Text>
      <View style={styles.grid}>
        {flow.sections.map((s) => {
          const p = sectionProgress(flow, inspection, s.id);
          const done = p.requiredTotal > 0 && p.requiredDone >= p.requiredTotal;
          const na = p.notApplicable;
          return (
            <Pressable key={s.id} style={[styles.tile, done && styles.tileDone, na && styles.tileNa]} onPress={() => navigation.navigate('Section', { id, sectionId: s.id })}>
              <View style={styles.tileHead}>
                <Text style={styles.tileIcon}>{s.icon}</Text>
                <Pressable
                  hitSlop={8}
                  style={[styles.naPill, na && styles.naPillActive]}
                  onPress={() => toggleSectionNa(s.id, s.title, na)}
                >
                  <Text style={[styles.naPillText, na && styles.naPillTextActive]}>N/A</Text>
                </Pressable>
              </View>
              <Text style={[styles.tileTitle, na && styles.tileTitleNa]}>{s.title}</Text>
              <Text style={styles.tileSub} numberOfLines={2}>{na ? 'Marked not applicable — tap N/A to restore' : s.subtitle}</Text>
              <View style={styles.progressWrap}>
                <View style={[styles.progressBar, { width: na ? '100%' : `${p.requiredTotal ? Math.round((100 * p.requiredDone) / p.requiredTotal) : 0}%` }, na && { backgroundColor: colors.grayLine }]} />
              </View>
              <Text style={styles.tileMeta}>{na ? 'skipped' : `${p.captured} photos · ${p.requiredDone}/${p.requiredTotal} required`}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.groupLabel}>Report & Export</Text>
      <Pressable style={styles.reportBtn} onPress={makeReport} disabled={busy}>
        {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.reportText}>🧾 Generate PDF Inspection Report</Text>}
      </Pressable>
      <Pressable style={[styles.reportBtn, styles.sketchBtn]} onPress={() => navigation.navigate('Sketch', { id })}>
        <Text style={[styles.reportText, { color: colors.navy }]}>✏️ Add Diagram / Sketch ({inspection.sketches.length})</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  resumeBtn: { backgroundColor: colors.red, borderRadius: touch.radius, padding: spacing.md, alignItems: 'center' },
  resumeText: { color: colors.white, fontSize: 20, fontWeight: '800' },
  resumeSub: { color: '#ffd7d7', fontSize: 13, marginTop: 4 },
  groupLabel: { fontSize: 14, fontWeight: '800', color: colors.navy, marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: touch.radius,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.grayLine,
  },
  tileDone: { borderColor: colors.green, borderWidth: 2 },
  tileNa: { opacity: 0.55, backgroundColor: colors.offWhite },
  tileHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  naPill: { borderWidth: 1.5, borderColor: colors.grayLine, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  naPillActive: { backgroundColor: colors.grayText, borderColor: colors.grayText },
  naPillText: { fontSize: 11, fontWeight: '800', color: colors.grayText },
  naPillTextActive: { color: colors.white },
  tileIcon: { fontSize: 30 },
  tileTitle: { fontSize: 16, fontWeight: '800', color: colors.ink, marginTop: 6 },
  tileTitleNa: { textDecorationLine: 'line-through', color: colors.grayText },
  tileSub: { fontSize: 12, color: colors.grayText, marginTop: 2, minHeight: 30 },
  progressWrap: { height: 6, backgroundColor: colors.offWhite, borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  progressBar: { height: 6, backgroundColor: colors.green },
  tileMeta: { fontSize: 11, color: colors.grayText, marginTop: 6 },
  reportBtn: { backgroundColor: colors.navy, borderRadius: touch.radius, minHeight: touch.minHeight + 4, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  sketchBtn: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.navy },
  reportText: { color: colors.white, fontSize: 17, fontWeight: '800' },
});
