import React, { useLayoutEffect } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { useInspections } from '../store/InspectionStore';
import { getFlow } from '../flows';
import { QuestionDef } from '../flows/types';
import { answerKey, AnswerValue } from '../types';
import { colors, spacing, touch } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Questions'>;

export default function QuestionsScreen({ route, navigation }: Props) {
  const { id, sectionId, instance } = route.params;
  const { getInspection, updateInspection } = useInspections();
  const inspection = getInspection(id);
  const flow = inspection ? getFlow(inspection.flowId) : undefined;
  const section = flow?.sections.find((s) => s.id === sectionId);

  useLayoutEffect(() => {
    navigation.setOptions({ title: instance ? `${section?.title ?? ''} · ${instance}` : section?.title ?? 'Questions' });
  }, [navigation, section, instance]);

  if (!inspection || !section) return null;

  const questions: QuestionDef[] = instance ? section.instanceQuestions ?? [] : section.questions ?? [];
  const grouped = questions.reduce<Record<string, QuestionDef[]>>((acc, q) => {
    const g = q.group ?? '';
    (acc[g] = acc[g] ?? []).push(q);
    return acc;
  }, {});

  const getVal = (q: QuestionDef): AnswerValue | undefined => inspection.answers[answerKey(sectionId, q.id, instance)];
  const setVal = (q: QuestionDef, v: AnswerValue) =>
    void updateInspection(id, (d) => {
      d.answers[answerKey(sectionId, q.id, instance)] = v;
    });

  /** Live photo count for auto-counting questions (e.g. vents per type). */
  const autoCount = (q: QuestionDef): number | undefined => {
    if (!q.autoFromPrompt) return undefined;
    return inspection.photos.filter(
      (p) => p.sectionId === sectionId && p.promptId === q.autoFromPrompt && p.instance === instance,
    ).length;
  };

  const noteKey = instance ? `${sectionId}:${instance}` : sectionId;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl * 2 }} keyboardShouldPersistTaps="handled">
      {Object.entries(grouped).map(([group, qs]) => (
        <View key={group || 'default'}>
          {group ? <Text style={styles.groupLabel}>{group}</Text> : null}
          {qs.map((q) => (
            <View key={q.id} style={styles.qCard}>
              <Text style={styles.qText}>{q.text}</Text>
              {q.type === 'yesno' && (
                <View style={styles.rowChoices}>
                  {[true, false].map((v) => (
                    <Pressable key={String(v)} style={[styles.choice, getVal(q) === v && styles.choiceActive]} onPress={() => setVal(q, v)}>
                      <Text style={[styles.choiceText, getVal(q) === v && styles.choiceTextActive]}>{v ? 'Yes' : 'No'}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {q.type === 'choice' && (
                <View style={styles.rowChoices}>
                  {(q.choices ?? []).map((c) => (
                    <Pressable key={c} style={[styles.choice, getVal(q) === c && styles.choiceActive]} onPress={() => setVal(q, c)}>
                      <Text style={[styles.choiceText, getVal(q) === c && styles.choiceTextActive]}>{c}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {(q.type === 'text' || q.type === 'number') && (
                <>
                  <TextInput
                    style={styles.input}
                    keyboardType={q.type === 'number' ? 'numeric' : 'default'}
                    value={getVal(q) !== undefined ? String(getVal(q)) : autoCount(q) !== undefined && autoCount(q)! > 0 ? String(autoCount(q)) : ''}
                    placeholder={autoCount(q) !== undefined ? String(autoCount(q)) : undefined}
                    placeholderTextColor={colors.grayText}
                    onChangeText={(t) => setVal(q, q.type === 'number' ? (t === '' ? '' : Number(t.replace(/[^0-9.\-]/g, '')) || 0) : t)}
                  />
                  {autoCount(q) !== undefined && (
                    <Text style={styles.autoHint}>
                      Auto-counted from photos taken: {autoCount(q)}{getVal(q) !== undefined ? ' (overridden)' : ''}
                    </Text>
                  )}
                </>
              )}
              {q.type === 'multilineText' && (
                <TextInput
                  style={[styles.input, styles.multiline]}
                  multiline
                  value={getVal(q) !== undefined ? String(getVal(q)) : ''}
                  onChangeText={(t) => setVal(q, t)}
                />
              )}
            </View>
          ))}
        </View>
      ))}

      <Text style={styles.groupLabel}>Notes</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        multiline
        placeholder="Free-form notes for this section…"
        placeholderTextColor={colors.grayText}
        value={inspection.notes[noteKey] ?? ''}
        onChangeText={(t) =>
          void updateInspection(id, (d) => {
            d.notes[noteKey] = t;
          })
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  groupLabel: { fontSize: 14, fontWeight: '800', color: colors.navy, marginTop: spacing.md, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },
  qCard: { backgroundColor: colors.white, borderRadius: touch.radius, borderWidth: 1, borderColor: colors.grayLine, padding: spacing.md, marginBottom: spacing.sm },
  qText: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm },
  rowChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  choice: { borderRadius: 20, borderWidth: 1.5, borderColor: colors.grayLine, paddingHorizontal: 14, paddingVertical: 9 },
  choiceActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  choiceText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  choiceTextActive: { color: colors.white },
  input: { backgroundColor: colors.offWhite, borderRadius: 10, borderWidth: 1, borderColor: colors.grayLine, paddingHorizontal: spacing.md, minHeight: touch.minHeight - 8, fontSize: 16, color: colors.ink },
  autoHint: { fontSize: 11, color: colors.grayText, marginTop: 4, fontWeight: '600' },
  multiline: { minHeight: 100, textAlignVertical: 'top', paddingTop: spacing.sm, backgroundColor: colors.white },
});
