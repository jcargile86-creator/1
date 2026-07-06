import React, { useLayoutEffect, useState } from 'react';
import { ScrollView, View, Text, TextInput, Image, Pressable, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { File } from 'expo-file-system';
import { RootStackParamList } from '../navigation';
import { useInspections } from '../store/InspectionStore';
import { getFlow } from '../flows';
import { resolveLabel } from '../flows/queue';
import { promptKey, answerKey } from '../types';
import QuestionFields from '../components/QuestionFields';
import { colors, spacing, touch } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PhotoReview'>;

/** Review the photos already taken for a prompt: edit captions inline
 *  (keyboard only on tap), delete, or add more shots. */
export default function PhotoReviewScreen({ route, navigation }: Props) {
  const { id, sectionId, promptId, instance } = route.params;
  const { getInspection, updateInspection } = useInspections();
  const inspection = getInspection(id);
  const flow = inspection ? getFlow(inspection.flowId) : undefined;
  const section = flow?.sections.find((s) => s.id === sectionId);
  const prompt = section?.prompts.find((p) => p.id === promptId);
  const firstPhoto = inspection?.photos.find(
    (p) => p.sectionId === sectionId && p.promptId === promptId && p.instance === instance,
  );
  // Generated prompts (test-square quadrants) aren't in the static list —
  // fall back to the photo's caption for the title.
  const label = prompt ? resolveLabel(prompt, instance) : firstPhoto?.caption ?? 'Photos';

  /** Local caption drafts — persisted on blur so typing stays smooth. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useLayoutEffect(() => {
    navigation.setOptions({ title: label });
  }, [navigation, label]);

  if (!inspection) return null;

  const photos = inspection.photos.filter(
    (p) => p.sectionId === sectionId && p.promptId === promptId && p.instance === instance,
  );

  /** Questions attached to this specific item — data entry lives here. */
  const itemQuestions = (instance ? section?.instanceQuestions ?? [] : section?.questions ?? []).filter(
    (q) => q.promptId === promptId,
  );

  const saveCaption = (photoId: string) => {
    const draft = drafts[photoId];
    if (draft === undefined) return;
    void updateInspection(id, (d) => {
      const ph = d.photos.find((p) => p.id === photoId);
      if (ph && draft.trim()) ph.caption = draft.trim();
    });
  };

  const deletePhoto = (photoId: string, uri: string) => {
    Alert.alert('Delete this photo?', 'It will be removed from the report.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void updateInspection(id, (d) => {
            d.photos = d.photos.filter((p) => p.id !== photoId);
          });
          try {
            new File(uri).delete();
          } catch {
            // file cleanup is best-effort
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}>
        {prompt?.hint ? <Text style={styles.hint}>{prompt.hint}</Text> : null}
        {photos.length === 0 && <Text style={styles.empty}>No photos yet for this item.</Text>}
        {itemQuestions.length > 0 && (
          <View style={{ marginBottom: spacing.sm }}>
            <QuestionFields
              inspection={inspection}
              sectionId={sectionId}
              instance={instance}
              questions={itemQuestions}
              hideGroups
              onAnswer={(qid, v) =>
                void updateInspection(id, (d) => {
                  d.answers[answerKey(sectionId, qid, instance)] = v;
                })
              }
            />
          </View>
        )}
        {photos.map((p) => (
          <View key={p.id} style={styles.card}>
            <Image source={{ uri: p.uri }} style={styles.photo} />
            <TextInput
              style={styles.captionInput}
              value={drafts[p.id] ?? p.caption}
              onChangeText={(t) => setDrafts((d) => ({ ...d, [p.id]: t }))}
              onEndEditing={() => saveCaption(p.id)}
              onBlur={() => saveCaption(p.id)}
              multiline
              placeholder="Photo caption"
              placeholderTextColor={colors.grayText}
            />
            <View style={styles.cardRow}>
              <Text style={styles.timestamp}>{new Date(p.takenAt).toLocaleString()}</Text>
              <Pressable onPress={() => deletePhoto(p.id, p.uri)} hitSlop={8}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={styles.addBtn}
          onPress={() =>
            navigation.navigate('Camera', { id, sectionId, instance, startKey: promptKey(sectionId, promptId, instance) })
          }
        >
          <Text style={styles.addText}>Add Another Photo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hint: { fontSize: 13, color: colors.grayText, marginBottom: spacing.sm },
  empty: { textAlign: 'center', color: colors.grayText, marginTop: spacing.xl },
  card: { backgroundColor: colors.white, borderRadius: touch.radius, borderWidth: 1, borderColor: colors.grayLine, marginBottom: spacing.md, overflow: 'hidden' },
  photo: { width: '100%', height: 340, backgroundColor: '#111' },
  captionInput: { paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 16, fontWeight: '600', color: colors.ink },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: 10 },
  timestamp: { fontSize: 12, color: colors.grayText },
  deleteText: { fontSize: 14, fontWeight: '800', color: colors.red },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.md, backgroundColor: colors.offWhite },
  addBtn: { backgroundColor: colors.red, borderRadius: touch.radius, minHeight: touch.minHeight + 4, alignItems: 'center', justifyContent: 'center' },
  addText: { color: colors.white, fontSize: 17, fontWeight: '800' },
});
