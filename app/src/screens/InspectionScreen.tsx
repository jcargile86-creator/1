import React, { useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, TextInput } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { useInspections } from '../store/InspectionStore';
import { getFlow } from '../flows';
import { AreaTab, SectionDef, QuestionDef } from '../flows/types';
import { buildQueue, firstPendingIndex, QueueItem, sectionProgress } from '../flows/queue';
import { answerKey } from '../types';
import { generateReport } from '../report/generate';
import PromptChecklist from '../components/PromptChecklist';
import { colors, spacing, touch } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Inspection'>;

/** Tabs in natural inspection-walk order. */
const AREA_TABS: { key: AreaTab; label: string }[] = [
  { key: 'start', label: 'Start' },
  { key: 'elevations', label: 'Elev' },
  { key: 'roof', label: 'Roof' },
  { key: 'inside', label: 'Inside' },
  { key: 'wrapup', label: 'Wrap-Up' },
];

export default function InspectionScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { getInspection, updateInspection } = useInspections();
  const inspection = getInspection(id);
  const [busy, setBusy] = useState(false);
  const [area, setArea] = useState<AreaTab>('start');
  /** Selected sub-tab per area, so switching areas remembers your place. */
  const [subTab, setSubTab] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: inspection ? `Claim ${inspection.claim.claimNumber || '—'}` : 'Inspection' });
  }, [navigation, inspection]);

  const flow = inspection ? getFlow(inspection.flowId) : undefined;

  const areaSections = useMemo(() => {
    const map: Record<AreaTab, SectionDef[]> = { start: [], elevations: [], roof: [], inside: [], wrapup: [] };
    for (const s of flow?.sections ?? []) map[s.area ?? 'wrapup'].push(s);
    return map;
  }, [flow]);

  if (!inspection || !flow) {
    return (
      <View style={styles.center}>
        <Text>Inspection not found.</Text>
      </View>
    );
  }

  /** Sub-tabs for the current area, in walk order. */
  const subTabs: { key: string; label: string; sectionId: string; instance?: string }[] = [];
  for (const s of areaSections[area]) {
    if (s.repeat) {
      for (const inst of inspection.instances[s.id] ?? []) {
        subTabs.push({ key: `${s.id}:${inst}`, label: s.id === 'wind' ? `Facet ${inst}` : inst, sectionId: s.id, instance: inst });
      }
      if ((inspection.instances[s.id] ?? []).length === 0 && s.repeat.addable) {
        subTabs.push({ key: `${s.id}:__add`, label: `${s.title}`, sectionId: s.id });
      }
    } else {
      const short = s.id === 'roof-eave' ? 'Eave' : s.id === 'roof-overview' ? 'Overview' : s.title;
      subTabs.push({ key: s.id, label: short, sectionId: s.id });
    }
  }

  const activeKey = subTab[area] && subTabs.some((t) => t.key === subTab[area]) ? subTab[area] : subTabs[0]?.key;
  const active = subTabs.find((t) => t.key === activeKey);
  const activeSection = active ? flow.sections.find((s) => s.id === active.sectionId) : undefined;
  const items: QueueItem[] = active && activeSection
    ? buildQueue(flow, inspection, active.sectionId, active.instance)
    : [];

  const isNa = active ? inspection.sectionSkipped?.[active.sectionId] === true : false;
  const progress = active ? sectionProgress(flow, inspection, active.sectionId) : undefined;

  /** Question set + answered count for the active sub-section. */
  const questions: QuestionDef[] = activeSection
    ? active?.instance
      ? activeSection.instanceQuestions ?? []
      : activeSection.questions ?? []
    : [];
  const answered = questions.filter((q) => {
    const v = inspection.answers[answerKey(activeSection!.id, q.id, active?.instance)];
    return v !== undefined && v !== '';
  }).length;

  const headerTitle = active
    ? active.instance
      ? activeSection?.id === 'wind'
        ? `Facet ${active.instance}`
        : activeSection?.id === 'test-squares'
          ? `${active.instance} Slope — Test Square`
          : activeSection?.id === 'interior'
            ? active.instance
            : `${active.instance} ${activeSection?.repeat?.noun ?? ''}`
      : activeSection?.title ?? ''
    : '';

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

  const toggleNa = (sectionId: string, title: string) => {
    if (inspection.sectionSkipped?.[sectionId]) {
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

  const addInstance = (sectionId: string) => {
    const name = newName.trim();
    if (!name) return;
    if ((inspection.instances[sectionId] ?? []).includes(name)) {
      Alert.alert('Already exists', `"${name}" is already in the list.`);
      return;
    }
    void updateInspection(id, (d) => {
      d.instances[sectionId] = [...(d.instances[sectionId] ?? []), name];
    });
    setSubTab((s) => ({ ...s, [area]: `${sectionId}:${name}` }));
    setNewName('');
    setAdding(null);
  };

  const addTarget = activeSection?.repeat?.addable
    ? activeSection
    : areaSections[area].find((s) => s.repeat?.addable);

  return (
    <View style={styles.container}>
      <Pressable style={styles.resumeBtn} onPress={resumeCapture}>
        <Text style={styles.resumeText}>Resume Guided Capture</Text>
      </Pressable>

      {/* Top tabs — the walk: Start, Elevations, Roof, Inside, Wrap-Up */}
      <View style={styles.areaTabs}>
        {AREA_TABS.map((t) => (
          <Pressable key={t.key} style={[styles.areaTab, area === t.key && styles.areaTabActive]} onPress={() => setArea(t.key)}>
            <Text style={[styles.areaTabText, area === t.key && styles.areaTabTextActive]} numberOfLines={1}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Sub-section tabs: directions / roof stages / rooms / facets */}
      {(subTabs.length > 1 || addTarget) && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subTabs} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.md }}>
          {subTabs.map((t) => {
            const sel = t.key === activeKey;
            return (
              <Pressable key={t.key} style={[styles.subTab, sel && styles.subTabActive]} onPress={() => setSubTab((s) => ({ ...s, [area]: t.key }))}>
                <Text style={[styles.subTabText, sel && styles.subTabTextActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
          {addTarget && (
            <Pressable style={[styles.subTab, styles.subTabAdd]} onPress={() => setAdding(adding ? null : addTarget.id)}>
              <Text style={styles.subTabText}>+ {addTarget.repeat?.noun}</Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      <ScrollView style={styles.content} contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl * 2 }}>
        {adding && (
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              placeholder={`New ${flow.sections.find((s) => s.id === adding)?.repeat?.noun.toLowerCase() ?? 'item'} name`}
              placeholderTextColor={colors.grayText}
              value={newName}
              onChangeText={setNewName}
              autoFocus
              onSubmitEditing={() => addInstance(adding)}
            />
            <Pressable style={styles.addBtn} onPress={() => addInstance(adding)}>
              <Text style={{ color: colors.white, fontWeight: '800' }}>Add</Text>
            </Pressable>
          </View>
        )}

        {active && activeSection && (
          <>
            {/* Sub-section header — carries the visual weight */}
            <View style={[styles.headerCard, isNa && { opacity: 0.6 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>{headerTitle}</Text>
                {activeSection.subtitle && !active.instance ? <Text style={styles.headerSub}>{activeSection.subtitle}</Text> : null}
                {progress && !isNa && (
                  <View style={styles.progressWrap}>
                    <View style={[styles.progressBar, { width: `${progress.requiredTotal ? Math.round((100 * progress.requiredDone) / progress.requiredTotal) : 0}%` }]} />
                  </View>
                )}
                <Text style={styles.headerMeta}>
                  {isNa ? 'Marked Not Applicable' : `${progress?.requiredDone ?? 0}/${progress?.requiredTotal ?? 0} required photos · ${progress?.captured ?? 0} taken`}
                </Text>
              </View>
              <View style={styles.headerActions}>
                <Pressable
                  style={styles.shootBtn}
                  onPress={() => navigation.navigate('Camera', { id, sectionId: active.sectionId, instance: active.instance })}
                >
                  <Text style={styles.shootText}>Shoot</Text>
                </Pressable>
                <Pressable onPress={() => toggleNa(active.sectionId, activeSection.title)} hitSlop={8}>
                  <Text style={styles.naLink}>{isNa ? 'Restore' : 'Mark N/A'}</Text>
                </Pressable>
              </View>
            </View>

            {/* Questions — prominent, right under the header */}
            {questions.length > 0 && (
              <Pressable
                style={styles.questionsCard}
                onPress={() => navigation.navigate('Questions', { id, sectionId: active.sectionId, instance: active.instance })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.questionsTitle}>Questions & Measurements</Text>
                  <Text style={styles.questionsMeta}>{answered}/{questions.length} answered</Text>
                </View>
                <View style={[styles.questionsBadge, answered >= questions.length && { backgroundColor: colors.green }]}>
                  <Text style={styles.questionsBadgeText}>{answered >= questions.length ? '✓' : `${questions.length - answered}`}</Text>
                </View>
              </Pressable>
            )}

            <Text style={styles.photosLabel}>PHOTOS</Text>
            <PromptChecklist
              items={items}
              inspection={inspection}
              onOpen={(item) => {
                const hasPhotos = inspection.photos.some(
                  (p) => p.sectionId === item.sectionId && p.promptId === item.prompt.id && p.instance === item.instance,
                );
                if (hasPhotos) {
                  navigation.navigate('PhotoReview', { id, sectionId: item.sectionId, promptId: item.prompt.id, instance: item.instance });
                } else {
                  navigation.navigate('Camera', { id, sectionId: item.sectionId, instance: item.instance, startKey: item.key });
                }
              }}
              onToggleSkip={(key) =>
                void updateInspection(id, (d) => {
                  if (d.skipped[key]) delete d.skipped[key];
                  else d.skipped[key] = true;
                })
              }
            />
          </>
        )}

        {area === 'wrapup' && (
          <View style={{ marginTop: spacing.md }}>
            <Pressable style={styles.reportBtn} onPress={makeReport} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.reportText}>Generate PDF Inspection Report</Text>}
            </Pressable>
            <Pressable style={[styles.reportBtn, styles.sketchBtn]} onPress={() => navigation.navigate('Sketch', { id })}>
              <Text style={[styles.reportText, { color: colors.navy }]}>Add Diagram / Sketch ({inspection.sketches.length})</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  resumeBtn: { backgroundColor: colors.red, margin: spacing.md, marginBottom: spacing.sm, borderRadius: touch.radius, minHeight: touch.minHeight, alignItems: 'center', justifyContent: 'center' },
  resumeText: { color: colors.white, fontSize: 18, fontWeight: '800' },
  areaTabs: { flexDirection: 'row', marginHorizontal: spacing.md, backgroundColor: colors.white, borderRadius: touch.radius, borderWidth: 1, borderColor: colors.grayLine, overflow: 'hidden' },
  areaTab: { flex: 1, minHeight: touch.minHeight - 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  areaTabActive: { backgroundColor: colors.navy },
  areaTabText: { fontSize: 13, fontWeight: '800', color: colors.grayText },
  areaTabTextActive: { color: colors.white },
  subTabs: { marginTop: spacing.sm, maxHeight: 44, flexGrow: 0 },
  subTab: { borderRadius: 18, borderWidth: 1.5, borderColor: colors.grayLine, backgroundColor: colors.white, paddingHorizontal: 16, height: 38, alignItems: 'center', justifyContent: 'center' },
  subTabActive: { backgroundColor: colors.red, borderColor: colors.red },
  subTabAdd: { borderStyle: 'dashed' },
  subTabText: { fontSize: 14, fontWeight: '800', color: colors.ink },
  subTabTextActive: { color: colors.white },
  content: { flex: 1 },
  addRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  addInput: { flex: 1, backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.grayLine, paddingHorizontal: spacing.md, minHeight: touch.minHeight - 8, fontSize: 16, color: colors.ink },
  addBtn: { backgroundColor: colors.navy, borderRadius: 10, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.navy,
    borderRadius: touch.radius,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  headerTitle: { color: colors.white, fontSize: 19, fontWeight: '800' },
  headerSub: { color: '#c6c9e8', fontSize: 12, marginTop: 2 },
  progressWrap: { height: 5, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  progressBar: { height: 5, backgroundColor: '#7ee08a' },
  headerMeta: { color: '#c6c9e8', fontSize: 11, marginTop: 5, fontWeight: '600' },
  headerActions: { alignItems: 'center', gap: 8 },
  shootBtn: { backgroundColor: colors.red, borderRadius: 10, paddingHorizontal: 22, minHeight: touch.minHeight - 10, alignItems: 'center', justifyContent: 'center' },
  shootText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  naLink: { color: '#c6c9e8', fontSize: 12, fontWeight: '700' },
  questionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: touch.radius,
    borderWidth: 2,
    borderColor: colors.navy,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  questionsTitle: { color: colors.navy, fontSize: 16, fontWeight: '800' },
  questionsMeta: { color: colors.grayText, fontSize: 12, marginTop: 2, fontWeight: '600' },
  questionsBadge: { backgroundColor: colors.red, borderRadius: 14, minWidth: 28, height: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  questionsBadgeText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  photosLabel: { fontSize: 12, fontWeight: '800', color: colors.grayText, letterSpacing: 1, marginBottom: 6, marginTop: 2 },
  reportBtn: { backgroundColor: colors.navy, borderRadius: touch.radius, minHeight: touch.minHeight + 4, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  sketchBtn: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.navy },
  reportText: { color: colors.white, fontSize: 17, fontWeight: '800' },
});
