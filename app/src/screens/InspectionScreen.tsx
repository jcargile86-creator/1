import React, { useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, TextInput } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { useInspections } from '../store/InspectionStore';
import { getFlow } from '../flows';
import { AreaTab, SectionDef, QuestionDef } from '../flows/types';
import { buildQueue, firstPendingIndex, isDone } from '../flows/queue';
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

interface SubEntry {
  key: string;
  label: string;
  sectionId: string;
  instance?: string;
}

export default function InspectionScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { getInspection, updateInspection } = useInspections();
  const inspection = getInspection(id);
  const [busy, setBusy] = useState(false);
  const [area, setArea] = useState<AreaTab>('start');
  /** Expanded accordion entries, keyed `${area}:${entryKey}`. */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
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

  /** Accordion entries for the current area, in walk order. */
  const entries: SubEntry[] = [];
  for (const s of areaSections[area]) {
    if (s.repeat) {
      for (const inst of inspection.instances[s.id] ?? []) {
        entries.push({
          key: `${s.id}:${inst}`,
          label: s.id === 'wind' ? `Facet ${inst}` : s.id === 'test-squares' ? `${inst} Slope` : s.id === 'elevations' ? `${inst} Elevation` : inst,
          sectionId: s.id,
          instance: inst,
        });
      }
    } else {
      entries.push({ key: s.id, label: s.title, sectionId: s.id });
    }
  }

  const isExpanded = (key: string) => expanded[`${area}:${key}`] ?? entries.length === 1;
  const toggle = (key: string) =>
    setExpanded((e) => ({ ...e, [`${area}:${key}`]: !(e[`${area}:${key}`] ?? entries.length === 1) }));

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
    setExpanded((e) => ({ ...e, [`${area}:${sectionId}:${name}`]: true }));
    setNewName('');
    setAdding(null);
  };

  const addTargets = areaSections[area].filter((s) => s.repeat?.addable);

  const renderEntry = (entry: SubEntry) => {
    const section = flow.sections.find((s) => s.id === entry.sectionId);
    if (!section) return null;
    const items = buildQueue(flow, inspection, entry.sectionId, entry.instance);
    const required = items.filter((i) => !i.prompt.optional);
    const reqDone = required.filter((i) => isDone(inspection, i.key)).length;
    const photoCount = inspection.photos.filter((p) => p.sectionId === entry.sectionId && (!section.repeat || p.instance === entry.instance)).length;
    const na = inspection.sectionSkipped?.[entry.sectionId] === true;
    const complete = required.length > 0 && reqDone >= required.length;
    const open = isExpanded(entry.key);

    const questions: QuestionDef[] = (entry.instance ? section.instanceQuestions ?? [] : section.questions ?? []).filter(
      (q) => !q.promptId,
    );
    const answered = questions.filter((q) => {
      const v = inspection.answers[answerKey(section.id, q.id, entry.instance)];
      return v !== undefined && v !== '';
    }).length;

    return (
      <View key={entry.key} style={[styles.entryCard, na && { opacity: 0.55 }]}>
        <Pressable style={styles.entryHeader} onPress={() => toggle(entry.key)}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.entryTitle, na && styles.entryTitleNa]}>{entry.label}</Text>
            <Text style={styles.entryMeta}>
              {na ? 'Not applicable' : `${reqDone}/${required.length} required · ${photoCount} photos${questions.length ? ` · ${answered}/${questions.length} answered` : ''}`}
            </Text>
          </View>
          {!na && complete && <Text style={styles.entryCheck}>✓</Text>}
          <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
        </Pressable>

        {open && (
          <View style={styles.entryBody}>
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: colors.red }]}
                onPress={() => navigation.navigate('Camera', { id, sectionId: entry.sectionId, instance: entry.instance })}
              >
                <Text style={styles.actionText}>Shoot</Text>
              </Pressable>
              {section.skippable !== false && (
                <Pressable style={[styles.actionBtn, styles.naBtn]} onPress={() => toggleNa(entry.sectionId, section.title)}>
                  <Text style={[styles.actionText, { color: colors.grayText }]}>{na ? 'Restore' : 'N/A'}</Text>
                </Pressable>
              )}
            </View>

            {questions.length > 0 && (
              <Pressable
                style={styles.questionsCard}
                onPress={() => navigation.navigate('Questions', { id, sectionId: entry.sectionId, instance: entry.instance })}
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

            <PromptChecklist
              items={items}
              inspection={inspection}
              section={section}
              onAnswer={(questionId, value, instance) =>
                void updateInspection(id, (d) => {
                  d.answers[answerKey(entry.sectionId, questionId, instance)] = value;
                })
              }
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
          </View>
        )}
      </View>
    );
  };

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

      <ScrollView style={styles.content} contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl * 2 }}>
        {entries.map(renderEntry)}

        {addTargets.map((s) => (
          <View key={s.id}>
            {adding === s.id ? (
              <View style={styles.addRow}>
                <TextInput
                  style={styles.addInput}
                  placeholder={`New ${s.repeat?.noun.toLowerCase()} name`}
                  placeholderTextColor={colors.grayText}
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                  onSubmitEditing={() => addInstance(s.id)}
                />
                <Pressable style={styles.addBtn} onPress={() => addInstance(s.id)}>
                  <Text style={{ color: colors.white, fontWeight: '800' }}>Add</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.addEntry} onPress={() => { setAdding(s.id); setNewName(''); }}>
                <Text style={styles.addEntryText}>+ Add {s.repeat?.noun}</Text>
              </Pressable>
            )}
          </View>
        ))}

        {area === 'wrapup' && (
          <View style={{ marginTop: spacing.md }}>
            <Pressable style={[styles.reportBtn, styles.docsBtn]} onPress={() => navigation.navigate('Gallery', { id })}>
              <Text style={[styles.reportText, { color: colors.navy }]}>Photo Review ({inspection.photos.length})</Text>
            </Pressable>
            <Pressable style={styles.reportBtn} onPress={makeReport} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.reportText}>Generate PDF Inspection Report</Text>}
            </Pressable>
            <Pressable style={[styles.reportBtn, styles.docsBtn]} onPress={() => navigation.navigate('Documents', { id })}>
              <Text style={[styles.reportText, { color: colors.navy }]}>Documents ({inspection.documents.length})</Text>
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
  content: { flex: 1, marginTop: spacing.sm },
  entryCard: { backgroundColor: colors.white, borderRadius: touch.radius, borderWidth: 1, borderColor: colors.grayLine, marginBottom: spacing.sm, overflow: 'hidden' },
  entryHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm, minHeight: touch.minHeight + 6, backgroundColor: colors.navy },
  entryTitle: { color: colors.white, fontSize: 17, fontWeight: '800' },
  entryTitleNa: { textDecorationLine: 'line-through' },
  entryMeta: { color: '#c6c9e8', fontSize: 12, marginTop: 2, fontWeight: '600' },
  entryCheck: { color: '#7ee08a', fontSize: 20, fontWeight: '800' },
  chevron: { color: colors.white, fontSize: 18, width: 20, textAlign: 'center' },
  entryBody: { padding: spacing.sm },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  actionBtn: { flex: 1, borderRadius: 10, minHeight: touch.minHeight - 8, alignItems: 'center', justifyContent: 'center' },
  naBtn: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.grayLine, flex: 0.6 },
  actionText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  questionsCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: 10, borderWidth: 2, borderColor: colors.navy, padding: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  questionsTitle: { color: colors.navy, fontSize: 15, fontWeight: '800' },
  questionsMeta: { color: colors.grayText, fontSize: 12, marginTop: 2, fontWeight: '600' },
  questionsBadge: { backgroundColor: colors.red, borderRadius: 14, minWidth: 28, height: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  questionsBadgeText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  addEntry: { borderRadius: touch.radius, borderWidth: 1.5, borderColor: colors.grayLine, borderStyle: 'dashed', minHeight: touch.minHeight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm, backgroundColor: colors.white },
  addEntryText: { color: colors.grayText, fontSize: 15, fontWeight: '800' },
  addRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  addInput: { flex: 1, backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.grayLine, paddingHorizontal: spacing.md, minHeight: touch.minHeight - 8, fontSize: 16, color: colors.ink },
  addBtn: { backgroundColor: colors.navy, borderRadius: 10, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  reportBtn: { backgroundColor: colors.navy, borderRadius: touch.radius, minHeight: touch.minHeight + 4, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  docsBtn: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.navy },
  reportText: { color: colors.white, fontSize: 17, fontWeight: '800' },
});
