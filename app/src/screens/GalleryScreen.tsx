import React from 'react';
import { SectionList, View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { useInspections } from '../store/InspectionStore';
import { getFlow } from '../flows';
import { PhotoRecord } from '../types';
import { colors, spacing, touch } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Gallery'>;

/** Pre-submit photo review: every photo in report order, grouped the way
 *  the PDF assembles them. Tap a photo to edit its caption or retake. */
export default function GalleryScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { getInspection } = useInspections();
  const inspection = getInspection(id);
  const flow = inspection ? getFlow(inspection.flowId) : undefined;

  if (!inspection || !flow) return null;

  const order = new Map<string, number>();
  flow.sections.forEach((s, i) => order.set(s.id, i));
  const sorted = [...inspection.photos].sort((a, b) => {
    const sa = order.get(a.sectionId) ?? 99;
    const sb = order.get(b.sectionId) ?? 99;
    if (sa !== sb) return sa - sb;
    return a.takenAt.localeCompare(b.takenAt);
  });

  const groups: { title: string; data: PhotoRecord[] }[] = [];
  for (const p of sorted) {
    const section = flow.sections.find((s) => s.id === p.sectionId);
    const title = section ? (p.instance ? `${section.title} — ${p.instance}` : section.title) : 'Other';
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.data.push(p);
    else groups.push({ title, data: [p] });
  }

  return (
    <SectionList
      style={styles.container}
      sections={groups}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl * 2 }}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <Text style={styles.intro}>
          {sorted.length} photos in report order. Tap any photo to edit its caption, retake, or add more.
        </Text>
      }
      ListEmptyComponent={<Text style={styles.empty}>No photos yet.</Text>}
      renderSectionHeader={({ section }) => (
        <View style={styles.groupHeader}>
          <Text style={styles.groupTitle}>{section.title}</Text>
          <Text style={styles.groupCount}>{section.data.length}</Text>
        </View>
      )}
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() =>
            item.promptId
              ? navigation.navigate('PhotoReview', { id, sectionId: item.sectionId, promptId: item.promptId, instance: item.instance })
              : undefined
          }
        >
          <Image source={{ uri: item.previewUri ?? item.uri }} style={styles.photo} />
          <View style={styles.captionRow}>
            <Text style={styles.caption}>{item.caption}</Text>
            <Text style={styles.time}>{new Date(item.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  intro: { fontSize: 13, color: colors.grayText, marginBottom: spacing.sm },
  empty: { textAlign: 'center', color: colors.grayText, marginTop: spacing.xl },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, marginBottom: spacing.sm },
  groupTitle: { fontSize: 16, fontWeight: '800', color: colors.navy },
  groupCount: { fontSize: 13, fontWeight: '800', color: colors.grayText },
  card: { backgroundColor: colors.white, borderRadius: touch.radius, borderWidth: 1, borderColor: colors.grayLine, marginBottom: spacing.sm, overflow: 'hidden' },
  photo: { width: '100%', height: 300, backgroundColor: '#111' },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, paddingHorizontal: spacing.md },
  caption: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink },
  time: { fontSize: 12, color: colors.grayText },
});
