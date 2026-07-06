import React, { useLayoutEffect } from 'react';
import { ScrollView, Text, TextInput, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { useInspections } from '../store/InspectionStore';
import { getFlow } from '../flows';
import { QuestionDef } from '../flows/types';
import { answerKey } from '../types';
import QuestionFields from '../components/QuestionFields';
import { colors, spacing, touch } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Questions'>;

/** Section-level questions only — questions attached to a specific photo
 *  prompt live with that item in the capture flow instead. */
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

  const questions: QuestionDef[] = (instance ? section.instanceQuestions ?? [] : section.questions ?? []).filter(
    (q) => !q.promptId && !q.pinned,
  );

  const noteKey = instance ? `${sectionId}:${instance}` : sectionId;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl * 2 }} keyboardShouldPersistTaps="handled">
      {questions.length === 0 && (
        <Text style={styles.emptyHint}>
          Item-specific questions appear with their photo items in the section list.
        </Text>
      )}
      <QuestionFields
        inspection={inspection}
        sectionId={sectionId}
        instance={instance}
        questions={questions}
        onAnswer={(qid, v) =>
          void updateInspection(id, (d) => {
            d.answers[answerKey(sectionId, qid, instance)] = v;
          })
        }
      />
      <Text style={styles.groupLabel}>Notes</Text>
      <TextInput
        style={styles.notes}
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
  emptyHint: { fontSize: 13, color: colors.grayText, marginBottom: spacing.sm },
  groupLabel: { fontSize: 14, fontWeight: '800', color: colors.navy, marginTop: spacing.md, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },
  notes: { backgroundColor: colors.white, borderRadius: touch.radius, borderWidth: 1, borderColor: colors.grayLine, paddingHorizontal: spacing.md, paddingTop: spacing.sm, minHeight: 100, textAlignVertical: 'top', fontSize: 16, color: colors.ink },
});
