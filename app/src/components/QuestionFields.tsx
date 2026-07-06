import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { QuestionDef } from '../flows/types';
import { answerKey, AnswerValue, Inspection } from '../types';
import { colors, spacing, touch } from '../theme';

interface Props {
  inspection: Inspection;
  sectionId: string;
  instance?: string;
  questions: QuestionDef[];
  onAnswer: (questionId: string, value: AnswerValue) => void;
  /** Hide group headers (e.g. when rendering under a specific photo item). */
  hideGroups?: boolean;
}

/** Question controls — yes/no and choice chips, numeric/text fields with
 *  photo auto-counting. Shared by the section question screen and the
 *  per-item photo views. */
export default function QuestionFields({ inspection, sectionId, instance, questions, onAnswer, hideGroups }: Props) {
  const getVal = (q: QuestionDef): AnswerValue | undefined => inspection.answers[answerKey(sectionId, q.id, instance)];

  const autoCount = (q: QuestionDef): number | undefined => {
    if (!q.autoFromPrompt) return undefined;
    return inspection.photos.filter(
      (p) => p.sectionId === sectionId && p.promptId === q.autoFromPrompt && p.instance === instance,
    ).length;
  };

  const grouped = questions.reduce<Record<string, QuestionDef[]>>((acc, q) => {
    const g = hideGroups ? '' : q.group ?? '';
    (acc[g] = acc[g] ?? []).push(q);
    return acc;
  }, {});

  return (
    <View>
      {Object.entries(grouped).map(([group, qs]) => (
        <View key={group || 'default'}>
          {group ? <Text style={styles.groupLabel}>{group}</Text> : null}
          {qs.map((q) => (
            <View key={q.id} style={styles.qCard}>
              <Text style={styles.qText}>{q.text}</Text>
              {q.type === 'yesno' && (
                <View style={styles.rowChoices}>
                  {[true, false].map((v) => (
                    <Pressable key={String(v)} style={[styles.choice, getVal(q) === v && styles.choiceActive]} onPress={() => onAnswer(q.id, v)}>
                      <Text style={[styles.choiceText, getVal(q) === v && styles.choiceTextActive]}>{v ? 'Yes' : 'No'}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {q.type === 'choice' && (
                <View style={styles.rowChoices}>
                  {(q.choices ?? []).map((c) => (
                    <Pressable key={c} style={[styles.choice, getVal(q) === c && styles.choiceActive]} onPress={() => onAnswer(q.id, c)}>
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
                    onChangeText={(t) => onAnswer(q.id, q.type === 'number' ? (t === '' ? '' : Number(t.replace(/[^0-9.\-]/g, '')) || 0) : t)}
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
                  onChangeText={(t) => onAnswer(q.id, t)}
                />
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  groupLabel: { fontSize: 14, fontWeight: '800', color: colors.navy, marginTop: spacing.md, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },
  qCard: { backgroundColor: colors.white, borderRadius: touch.radius, borderWidth: 1, borderColor: colors.grayLine, padding: spacing.md, marginBottom: spacing.sm },
  qText: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm },
  rowChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  choice: { borderRadius: 20, borderWidth: 1.5, borderColor: colors.grayLine, paddingHorizontal: 14, paddingVertical: 9 },
  choiceActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  choiceText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  choiceTextActive: { color: colors.white },
  input: { backgroundColor: colors.offWhite, borderRadius: 10, borderWidth: 1, borderColor: colors.grayLine, paddingHorizontal: spacing.md, minHeight: touch.minHeight - 8, fontSize: 16, color: colors.ink },
  multiline: { minHeight: 100, textAlignVertical: 'top', paddingTop: spacing.sm, backgroundColor: colors.white },
  autoHint: { fontSize: 11, color: colors.grayText, marginTop: 4, fontWeight: '600' },
});
