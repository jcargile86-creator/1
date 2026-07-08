import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation';
import { useInspections } from '../store/InspectionStore';
import { getFlow } from '../flows';
import { AreaTab, SectionDef, QuestionDef } from '../flows/types';
import { buildQueue, firstPendingIndex, isDone, PhotoQueueItem } from '../flows/queue';
import { answerKey } from '../types';
import { generateReport } from '../report/generate';
import { formatDateTime } from '../lib/schedule';
import PromptChecklist from '../components/PromptChecklist';
import QuestionFields from '../components/QuestionFields';
import { colors, spacing, touch } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Inspection'>;

/** Bottom-nav stops in natural inspection-walk order. */
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
  const { getInspection, updateInspection, acceptInspection, declineInspection, submitInspection, markSeen } = useInspections();
  const insets = useSafeAreaInsets();
  const inspection = getInspection(id);
  const [busy, setBusy] = useState(false);
  const [area, setArea] = useState<AreaTab>('start');
  /** Expanded accordion entries, keyed `${area}:${entryKey}`. */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  /** Required photo items still missing — blocks report generation. */
  const [missing, setMissing] = useState<PhotoQueueItem[] | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: inspection ? `Claim ${inspection.claim.claimNumber || '—'}` : 'Inspection' });
  }, [navigation, inspection]);

  // Opening a freshly-arrived pending claim clears its "new" badge.
  useEffect(() => {
    if (inspection && inspection.seen === false) void markSeen(inspection.id);
  }, [inspection?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
          label: s.id === 'wind' || s.id === 'test-squares' ? `${inst} Slope` : s.id === 'elevations' ? `${inst} Elevation` : inst,
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

  /** Required photos still missing (N/A sections excluded). */
  const missingRequired = () =>
    buildQueue(flow, inspection).filter(
      (q): q is PhotoQueueItem => q.kind === 'photo' && !q.prompt.optional && !isDone(inspection, q),
    );

  const makeReport = async () => {
    // Hard gate: every required photo must be captured or consciously skipped.
    const missed = missingRequired();
    if (missed.length) {
      setMissing(missed);
      return;
    }
    setBusy(true);
    try {
      await generateReport(inspection, flow);
    } catch (e) {
      Alert.alert('Report failed', String(e));
    } finally {
      setBusy(false);
    }
  };

  /** Submit: same required-photo gate, then move the claim to Completed. */
  const submitClaim = () => {
    const missed = missingRequired();
    if (missed.length) {
      setMissing(missed);
      return;
    }
    Alert.alert('Submit this claim?', 'It moves to Completed. Generate/attach the PDF report first if you haven’t.', [
      { text: 'Not yet', style: 'cancel' },
      {
        text: 'Submit',
        onPress: () => {
          void submitInspection(id);
          navigation.goBack();
        },
      },
    ]);
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
    const items = buildQueue(flow, inspection, entry.sectionId, entry.instance).filter(
      (i): i is PhotoQueueItem => i.kind === 'photo',
    );
    const required = items.filter((i) => !i.prompt.optional);
    const reqDone = required.filter((i) => isDone(inspection, i)).length;
    const photoCount = inspection.photos.filter((p) => p.sectionId === entry.sectionId && (!section.repeat || p.instance === entry.instance)).length;
    const na = inspection.sectionSkipped?.[entry.sectionId] === true;
    const complete = required.length > 0 && reqDone >= required.length;
    const open = isExpanded(entry.key);

    const pool: QuestionDef[] = entry.instance ? section.instanceQuestions ?? [] : section.questions ?? [];
    const pinnedQuestions = pool.filter((q) => q.pinned);
    const questions: QuestionDef[] = pool.filter((q) => !q.promptId && !q.pinned);
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

            {pinnedQuestions.length > 0 && (
              <QuestionFields
                inspection={inspection}
                sectionId={entry.sectionId}
                instance={entry.instance}
                questions={pinnedQuestions}
                hideGroups
                onAnswer={(qid, v) =>
                  void updateInspection(id, (d) => {
                    d.answers[answerKey(entry.sectionId, qid, entry.instance)] = v;
                  })
                }
              />
            )}

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
      {inspection.status === 'pending' && (
        <View style={styles.statusBanner}>
          <Text style={styles.statusBannerText}>
            Pending assignment{inspection.scheduledAt ? ` · ${formatDateTime(inspection.scheduledAt)}` : ''}
          </Text>
          <View style={styles.statusActions}>
            <Pressable style={[styles.statusBtn, styles.statusDeny]} onPress={() => { void declineInspection(id); navigation.goBack(); }}>
              <Text style={styles.statusDenyText}>Deny</Text>
            </Pressable>
            <Pressable style={[styles.statusBtn, styles.statusAccept]} onPress={() => void acceptInspection(id)}>
              <Text style={styles.statusAcceptText}>Accept</Text>
            </Pressable>
          </View>
        </View>
      )}
      {inspection.status === 'completed' && (
        <View style={[styles.statusBanner, styles.statusDone]}>
          <Text style={styles.statusDoneText}>
            ✓ Submitted{inspection.submittedAt ? ` ${formatDateTime(inspection.submittedAt)}` : ''}
          </Text>
        </View>
      )}

      <Pressable style={styles.resumeBtn} onPress={resumeCapture}>
        <Text style={styles.resumeText}>Resume Guided Capture</Text>
      </Pressable>

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
            {inspection.status !== 'completed' ? (
              <Pressable style={[styles.reportBtn, styles.submitBtn]} onPress={submitClaim}>
                <Text style={styles.reportText}>Submit Claim</Text>
              </Pressable>
            ) : (
              <Text style={styles.submittedNote}>Submitted {inspection.submittedAt ? formatDateTime(inspection.submittedAt) : ''}</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom nav — the walk: Start, Elevations, Roof, Inside, Wrap-Up */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom || spacing.sm }]}>
        {AREA_TABS.map((t) => {
          const active = area === t.key;
          return (
            <Pressable key={t.key} style={[styles.navItem, active && styles.navItemActive]} onPress={() => setArea(t.key)}>
              <View style={[styles.navIndicator, active && styles.navIndicatorActive]} />
              <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Report gate — missing required photos, each row jumps straight
          to that shot in the camera. */}
      <Modal visible={!!missing} transparent animationType="slide" onRequestClose={() => setMissing(null)}>
        <View style={styles.missingBackdrop}>
          <View style={styles.missingSheet}>
            <Text style={styles.missingTitle}>Missing required photos ({missing?.length ?? 0})</Text>
            <Text style={styles.missingSub}>
              The report is blocked until every required photo is captured. Tap an item to shoot it now — or skip it
              in the camera if it truly doesn't apply.
            </Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {(missing ?? []).map((q) => (
                <Pressable
                  key={q.key}
                  style={styles.missingRow}
                  onPress={() => {
                    setMissing(null);
                    navigation.navigate('Camera', { id, startKey: q.key });
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.missingSection}>{q.sectionTitle}{q.instance ? ` · ${q.instance}` : ''}</Text>
                    <Text style={styles.missingLabel}>{q.label}</Text>
                  </View>
                  <Text style={styles.missingGo}>›</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.missingClose} onPress={() => setMissing(null)}>
              <Text style={styles.missingCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  resumeBtn: { backgroundColor: colors.red, margin: spacing.md, marginBottom: spacing.sm, borderRadius: touch.radius, minHeight: touch.minHeight, alignItems: 'center', justifyContent: 'center' },
  resumeText: { color: colors.white, fontSize: 18, fontWeight: '800' },
  bottomNav: { flexDirection: 'row', backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.grayLine, paddingTop: 8 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  navItemActive: {},
  navIndicator: { height: 3, width: 28, borderRadius: 2, backgroundColor: 'transparent', marginBottom: 6 },
  navIndicatorActive: { backgroundColor: colors.red },
  navLabel: { fontSize: 13, fontWeight: '800', color: colors.grayText },
  navLabelActive: { color: colors.navy },
  content: { flex: 1 },
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
  submitBtn: { backgroundColor: colors.green, marginTop: spacing.sm },
  submittedNote: { textAlign: 'center', color: colors.green, fontWeight: '800', fontSize: 15, marginTop: spacing.sm },
  reportText: { color: colors.white, fontSize: 17, fontWeight: '800' },
  statusBanner: { backgroundColor: colors.navy, borderRadius: touch.radius, padding: spacing.md, marginBottom: spacing.sm },
  statusBannerText: { color: colors.white, fontSize: 15, fontWeight: '800', marginBottom: spacing.sm },
  statusActions: { flexDirection: 'row', gap: spacing.sm },
  statusBtn: { flex: 1, borderRadius: 10, minHeight: touch.minHeight - 8, alignItems: 'center', justifyContent: 'center' },
  statusAccept: { backgroundColor: colors.green, flex: 2 },
  statusAcceptText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  statusDeny: { backgroundColor: 'rgba(255,255,255,0.15)' },
  statusDenyText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  statusDone: { backgroundColor: colors.green },
  statusDoneText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  missingBackdrop: { flex: 1, backgroundColor: 'rgba(10,12,30,0.55)', justifyContent: 'flex-end' },
  missingSheet: { backgroundColor: colors.offWhite, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.md, paddingBottom: spacing.xl },
  missingTitle: { fontSize: 19, fontWeight: '800', color: colors.red, marginBottom: 4 },
  missingSub: { fontSize: 13, color: colors.grayText, marginBottom: spacing.sm, fontWeight: '600' },
  missingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 10, borderWidth: 1, borderColor: colors.grayLine, paddingHorizontal: spacing.md, paddingVertical: 10, marginBottom: 6, gap: spacing.sm },
  missingSection: { fontSize: 11, fontWeight: '800', color: colors.grayText, textTransform: 'uppercase', letterSpacing: 0.5 },
  missingLabel: { fontSize: 15, fontWeight: '700', color: colors.ink, marginTop: 1 },
  missingGo: { fontSize: 22, color: colors.red, fontWeight: '800' },
  missingClose: { marginTop: spacing.sm, borderRadius: touch.radius, borderWidth: 1.5, borderColor: colors.grayLine, minHeight: touch.minHeight - 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  missingCloseText: { color: colors.grayText, fontSize: 15, fontWeight: '800' },
});
